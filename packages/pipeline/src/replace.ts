import type { Detection, DetectionCategory, Policy } from "./types.js";

/** Stable hash → index into replacement list so the same source string maps consistently. */
export function stableIndex(key: string, modulo: number): number {
  if (modulo <= 0) return 0;
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % modulo;
}

function asList(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

export function pickReplacement(
  policy: Policy,
  category: DetectionCategory,
  sourceText: string,
): string | null {
  const list = asList(policy.replacements[category]);
  if (list.length === 0) return null;
  return list[stableIndex(sourceText.toLowerCase().trim(), list.length)] ?? list[0];
}

export interface ProposedRedaction {
  detection: Detection;
  action: Detection["suggestedAction"];
  replacement: string | null;
}

export function proposeRedactions(
  detections: Detection[],
  policy: Policy,
): ProposedRedaction[] {
  const seen = new Map<string, string>();

  return detections.map((detection) => {
    const action = detection.suggestedAction;
    if (action !== "replace_text" || !detection.text) {
      return { detection, action, replacement: null };
    }

    const key = `${detection.category}:${detection.text.toLowerCase().trim()}`;
    let replacement = seen.get(key);
    if (!replacement) {
      replacement =
        pickReplacement(policy, detection.category, detection.text) ??
        "[redacted]";
      seen.set(key, replacement);
    }
    return { detection, action, replacement };
  });
}
