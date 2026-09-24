import type { Detection, ProposedRedaction } from "@sa/pipeline";
import {
  defaultPolicy,
  detectInText,
  detectionsFromOcrTokens,
  proposeRedactions,
} from "@sa/pipeline";

export interface OcrToken {
  text: string;
  bbox: { x: number; y: number; w: number; h: number };
}

export interface ScanBundle {
  detections: Detection[];
  proposals: ProposedRedaction[];
  ocrText: string;
  tokens: OcrToken[];
}

/** Run Tesseract OCR in-browser and map sensitive tokens to boxes. */
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

  const tokens: OcrToken[] = [];
  const words = result.data.words ?? [];
  for (const word of words) {
    const text = word.text?.trim();
    if (!text) continue;
    const b = word.bbox;
    tokens.push({
      text,
      bbox: {
        x: b.x0,
        y: b.y0,
        w: Math.max(1, b.x1 - b.x0),
        h: Math.max(1, b.y1 - b.y0),
      },
    });
  }

  // Also scan full OCR text for multi-token patterns (emails, URLs, JWTs)
  const ocrText = result.data.text ?? "";
  const fromTokens = detectionsFromOcrTokens(tokens, sourcePath, defaultPolicy);
  const fullMatches = detectInText(ocrText);

  // Attach approximate boxes for full-text matches not already covered
  const covered = new Set(
    fromTokens.map((d) => (d.text ?? "").toLowerCase()),
  );
  const extras: Detection[] = [];
  let i = 0;
  for (const match of fullMatches) {
    if (covered.has(match.text.toLowerCase())) continue;
    // find a token that contains this match, else use first token-ish band
    const host = tokens.find((t) =>
      t.text.toLowerCase().includes(match.text.toLowerCase().slice(0, 8)),
    );
    const bbox = host?.bbox ?? {
      x: 16,
      y: 16 + i * 30,
      w: Math.min(480, match.text.length * 10),
      h: 24,
    };
    extras.push({
      id: `det_full_${i++}_${match.text.length}`,
      sourcePath,
      category: match.category,
      bbox,
      text: match.text,
      confidence: match.confidence,
      layer: "regex",
      suggestedAction:
        defaultPolicy.categories[match.category]?.action ?? "redact_block",
      severity: defaultPolicy.categories[match.category]?.severity ?? "medium",
    });
  }

  const detections = mergeDetections([...fromTokens, ...extras]);
  const proposals = proposeRedactions(detections, defaultPolicy);
  return { detections, proposals, ocrText, tokens };
}

function mergeDetections(list: Detection[]): Detection[] {
  const out: Detection[] = [];
  for (const d of list) {
    const dup = out.find(
      (o) =>
        o.text &&
        d.text &&
        o.text.toLowerCase() === d.text.toLowerCase() &&
        overlap(o.bbox, d.bbox) > 0.4,
    );
    if (dup) continue;
    out.push(d);
  }
  return out;
}

function overlap(
  a: Detection["bbox"],
  b: Detection["bbox"],
): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  const w = Math.max(0, x2 - x1);
  const h = Math.max(0, y2 - y1);
  const inter = w * h;
  const union = a.w * a.h + b.w * b.h - inter;
  return union <= 0 ? 0 : inter / union;
}
