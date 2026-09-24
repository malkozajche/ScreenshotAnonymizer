import type { Detection, ProposedRedaction } from "@sa/pipeline";
import {
  defaultPolicy,
  detectInText,
  proposeRedactions,
} from "@sa/pipeline";

export interface OcrToken {
  text: string;
  bbox: { x: number; y: number; w: number; h: number };
  start: number;
  end: number;
}

export interface ScanBundle {
  detections: Detection[];
  proposals: ProposedRedaction[];
  ocrText: string;
  tokens: OcrToken[];
}

/** Run Tesseract OCR in-browser and map sensitive spans to boxes. */
export async function scanImageWithOcr(
  imageSource: HTMLImageElement | HTMLCanvasElement | File | Blob | string,
  sourcePath: string,
  onProgress?: (status: string, progress: number) => void,
): Promise<ScanBundle> {
  const Tesseract = await import("tesseract.js");
  const result = await Tesseract.recognize(imageSource, "eng", {
    logger: (m) => {
      if (m.status && typeof m.progress === "number") {
        onProgress?.(m.status, m.progress);
      }
    },
  });

  const { ocrText, tokens } = buildTokenIndex(result.data.words ?? []);
  const matches = detectInText(ocrText);

  const detections: Detection[] = matches.map((match, i) => {
    const matchStart = match.index;
    const matchEnd = match.index + match.text.length;
    const bbox =
      unionBoxesCovering(tokens, matchStart, matchEnd) ??
      fuzzyBoxesForText(tokens, match.text) ?? {
        x: 16,
        y: 16 + i * 30,
        w: Math.min(480, match.text.length * 10),
        h: 24,
      };

    return {
      id: `det_${i}_${hashShort(match.text)}`,
      sourcePath,
      category: match.category,
      bbox,
      text: match.text,
      confidence: match.confidence,
      layer: "regex",
      suggestedAction:
        defaultPolicy.categories[match.category]?.action ?? "redact_block",
      severity: defaultPolicy.categories[match.category]?.severity ?? "medium",
    };
  });

  const proposals = proposeRedactions(detections, defaultPolicy);
  return { detections, proposals, ocrText, tokens };
}

/** Rebuild text from OCR words so character offsets align with token boxes. */
function buildTokenIndex(
  words: Array<{ text: string; bbox: { x0: number; y0: number; x1: number; y1: number } }>,
): { ocrText: string; tokens: OcrToken[] } {
  const tokens: OcrToken[] = [];
  let ocrText = "";
  let prev: (typeof words)[number] | null = null;

  for (const word of words) {
    const text = word.text?.trim();
    if (!text) continue;

    if (prev) {
      const sameLine = Math.abs(word.bbox.y0 - prev.bbox.y0) < 18;
      ocrText += sameLine ? " " : "\n";
    }

    const start = ocrText.length;
    ocrText += text;
    const end = ocrText.length;
    tokens.push({
      text,
      bbox: {
        x: word.bbox.x0,
        y: word.bbox.y0,
        w: Math.max(1, word.bbox.x1 - word.bbox.x0),
        h: Math.max(1, word.bbox.y1 - word.bbox.y0),
      },
      start,
      end,
    });
    prev = word;
  }

  return { ocrText, tokens };
}

function unionBoxesCovering(
  tokens: OcrToken[],
  start: number,
  end: number,
): Detection["bbox"] | null {
  const hit = tokens.filter((t) => t.start < end && t.end > start);
  if (hit.length === 0) return null;
  return union(hit.map((t) => t.bbox));
}

/** Fallback when offsets miss: gather tokens that appear in the match string. */
function fuzzyBoxesForText(
  tokens: OcrToken[],
  matchText: string,
): Detection["bbox"] | null {
  const lower = matchText.toLowerCase();
  const parts = lower.split(/[^\p{L}\p{N}+@.]+/u).filter((p) => p.length >= 2);
  const hit = tokens.filter((t) => {
    const tt = t.text.toLowerCase();
    return lower.includes(tt) || parts.some((p) => p.includes(tt) || tt.includes(p));
  });
  if (hit.length === 0) return null;

  // Keep the densest vertical cluster (same UI line)
  hit.sort((a, b) => a.bbox.y - b.bbox.y);
  let best = [hit[0]];
  let cur = [hit[0]];
  for (let i = 1; i < hit.length; i++) {
    if (Math.abs(hit[i].bbox.y - cur[0].bbox.y) < 20) {
      cur.push(hit[i]);
    } else {
      if (cur.length > best.length) best = cur;
      cur = [hit[i]];
    }
  }
  if (cur.length > best.length) best = cur;
  return union(best.map((t) => t.bbox));
}

function union(
  boxes: Array<{ x: number; y: number; w: number; h: number }>,
): Detection["bbox"] {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const b of boxes) {
    x0 = Math.min(x0, b.x);
    y0 = Math.min(y0, b.y);
    x1 = Math.max(x1, b.x + b.w);
    y1 = Math.max(y1, b.y + b.h);
  }
  return { x: x0, y: y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) };
}

function hashShort(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).slice(0, 8);
}
