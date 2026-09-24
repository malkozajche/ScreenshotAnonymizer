import type { Detection, DetectionCategory, Policy, Severity } from "./types.js";

export interface TextMatch {
  category: DetectionCategory;
  text: string;
  index: number;
  confidence: number;
}

const EMAIL =
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;

// International-ish phone: +country and common separators, 8–15 digits total
const PHONE =
  /(?:\+|00)?\d{1,3}[\s.-]?(?:\(?\d{1,4}\)?[\s.-]?){2,4}\d{2,4}/g;

const IPV4 =
  /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g;

const JWT =
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g;

const AWS_KEY = /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g;

const GENERIC_API_KEY =
  /\b(?:sk|pk|api|key|token|secret)[_-](?:live|test|prod)?[_-]?[A-Za-z0-9]{16,}\b/gi;

const BEARER = /\bBearer\s+[A-Za-z0-9._~+/=-]{20,}\b/gi;

const URL_SECRET =
  /(?:https?:\/\/[^\s"'<>]+|[?&](?:token|access_token|api_key|key|sig|signature|auth)=)[^\s"'<>]*/gi;

const UUID =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;

/** "Signed in as: Jane Smith" / "User: Priya Sharma" style labels in product UIs. */
const NAME_LABELED =
  /(?:signed\s+in\s+as|logged\s+in\s+as|user\s*name|full\s+name|display\s+name|account\s+holder|customer\s+name|created\s+by|assignee|owner|employee|profile\s+name|\buser)\s*[:\-–]\s*([\p{L}][\p{L}'’.\-]*(?:[ \t]+[\p{L}][\p{L}'’.\-]*){1,3})/giu;

/** Bare "First Last" (and optional middle) — filtered heavily for UI chrome. */
const NAME_BARE =
  /\b([\p{Lu}][\p{L}'’.\-]*(?:[ \t]+[\p{Lu}][\p{L}'’.\-]*){1,2})\b/gu;

const NAME_STOP = new Set([
  "acme",
  "console",
  "admin",
  "server",
  "email",
  "phone",
  "api",
  "key",
  "token",
  "secret",
  "home",
  "settings",
  "dashboard",
  "account",
  "profile",
  "signed",
  "user",
  "password",
  "login",
  "logout",
  "welcome",
  "example",
  "docs",
  "documentation",
  "screenshot",
  "anonymizer",
  "northwind",
  "meridian",
  "sakura",
  "systems",
  "digital",
  "labs",
  "ltd",
  "gmbh",
  "corp",
  "inc",
]);

function looksLikePersonName(value: string): boolean {
  const parts = value.trim().split(/\s+/);
  if (parts.length < 2 || parts.length > 4) return false;
  if (parts.some((p) => NAME_STOP.has(p.toLowerCase()))) return false;
  if (parts.some((p) => /\d/.test(p))) return false;
  // Avoid ALL-CAPS product labels
  if (parts.every((p) => p === p.toUpperCase() && p.length <= 4)) return false;
  return parts.every((p) => /^[\p{L}][\p{L}'’.\-]*$/u.test(p));
}

function pushMatches(
  text: string,
  pattern: RegExp,
  category: DetectionCategory,
  confidence: number,
  out: TextMatch[],
  validate?: (m: string) => boolean,
): void {
  pattern.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text)) !== null) {
    const value = m[0];
    if (validate && !validate(value)) continue;
    out.push({
      category,
      text: value,
      index: m.index,
      confidence,
    });
  }
}

function looksLikePhone(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) return false;
  // Avoid matching IPv4 / version numbers already caught elsewhere
  if (/^\d+(\.\d+){2,}$/.test(value.trim())) return false;
  return true;
}

function looksLikeUrlSecret(value: string): boolean {
  const lower = value.toLowerCase();
  return (
    /[?&](token|access_token|api_key|key|sig|signature|auth)=/.test(lower) ||
    /(?:token|sig|signature|auth)=/.test(lower)
  );
}

/** Scan plain text (OCR output or pasted UI copy) for structured PII/secrets. */
export function detectInText(text: string): TextMatch[] {
  const out: TextMatch[] = [];
  pushMatches(text, EMAIL, "email", 0.95, out);
  pushMatches(text, AWS_KEY, "api_key", 0.98, out);
  pushMatches(text, JWT, "token", 0.97, out);
  pushMatches(text, BEARER, "token", 0.96, out);
  pushMatches(text, GENERIC_API_KEY, "api_key", 0.9, out);
  pushMatches(text, URL_SECRET, "url_secret", 0.9, out, looksLikeUrlSecret);
  pushMatches(text, IPV4, "ip", 0.92, out);
  pushMatches(text, UUID, "account_id", 0.7, out);
  pushMatches(text, PHONE, "phone", 0.75, out, looksLikePhone);

  // Labeled names: capture group only
  NAME_LABELED.lastIndex = 0;
  let labeled: RegExpExecArray | null;
  while ((labeled = NAME_LABELED.exec(text)) !== null) {
    const value = labeled[1]?.trim();
    if (!value || !looksLikePersonName(value)) continue;
    out.push({
      category: "person_name",
      text: value,
      index: labeled.index + labeled[0].lastIndexOf(value),
      confidence: 0.88,
    });
  }

  // Bare names after structured hits so emails/phones win overlaps
  pushMatches(text, NAME_BARE, "person_name", 0.62, out, looksLikePersonName);

  const severityRank: Record<string, number> = {
    api_key: 100,
    token: 95,
    password: 95,
    url_secret: 90,
    financial: 90,
    email: 80,
    phone: 75,
    person_name: 70,
    ip: 65,
    account_id: 60,
    hostname: 50,
    org_name: 45,
    other: 10,
  };

  // Highest severity first so secrets win overlaps; then longer spans.
  out.sort(
    (a, b) =>
      (severityRank[b.category] ?? 0) - (severityRank[a.category] ?? 0) ||
      b.text.length - a.text.length ||
      a.index - b.index,
  );
  const kept: TextMatch[] = [];
  for (const match of out) {
    const overlaps = kept.some(
      (k) =>
        match.index < k.index + k.text.length &&
        match.index + match.text.length > k.index,
    );
    if (!overlaps) kept.push(match);
  }
  kept.sort((a, b) => a.index - b.index);
  return kept;
}

function severityFor(policy: Policy, category: DetectionCategory): Severity {
  return policy.categories[category]?.severity ?? "medium";
}

function actionFor(policy: Policy, category: DetectionCategory) {
  return policy.categories[category]?.action ?? "redact_block";
}

/**
 * Convert text matches into Detection objects.
 * Without layout/OCR boxes, bbox is a synthetic line band for UI highlighting.
 */
export function matchesToDetections(
  matches: TextMatch[],
  sourcePath: string,
  policy: Policy,
  imageWidth = 1000,
  lineHeight = 28,
): Detection[] {
  return matches.map((match, i) => {
    const line = Math.floor(i / 2);
    return {
      id: `det_${i}_${hashShort(match.text)}`,
      sourcePath,
      category: match.category,
      bbox: {
        x: 24,
        y: 24 + line * (lineHeight + 8),
        w: Math.min(imageWidth - 48, Math.max(120, match.text.length * 9)),
        h: lineHeight,
      },
      text: match.text,
      confidence: match.confidence,
      layer: "regex",
      suggestedAction: actionFor(policy, match.category),
      severity: severityFor(policy, match.category),
    };
  });
}

/** Attach OCR-derived bounding boxes when available. */
export function detectionsFromOcrTokens(
  tokens: Array<{ text: string; bbox: Detection["bbox"] }>,
  sourcePath: string,
  policy: Policy,
): Detection[] {
  const detections: Detection[] = [];
  let i = 0;
  for (const token of tokens) {
    const matches = detectInText(token.text);
    for (const match of matches) {
      detections.push({
        id: `det_${i++}_${hashShort(match.text)}`,
        sourcePath,
        category: match.category,
        bbox: token.bbox,
        text: match.text,
        confidence: match.confidence,
        layer: "regex",
        suggestedAction: actionFor(policy, match.category),
        severity: severityFor(policy, match.category),
      });
    }
  }
  return detections;
}

function hashShort(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).slice(0, 8);
}
