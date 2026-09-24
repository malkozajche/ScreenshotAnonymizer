import {
  defaultPolicy,
  detectInText,
  matchesToDetections,
  proposeRedactions,
  applyRedactions,
  type Detection,
  type ProposedRedaction,
} from "@sa/pipeline";

export interface ScanResult {
  objectUrl: string;
  width: number;
  height: number;
  fileName: string;
  extractedText: string;
  detections: Detection[];
  proposals: ProposedRedaction[];
}

/**
 * Load an image and re-encode via canvas so EXIF/XMP (GPS, device, author)
 * are stripped before review/export.
 */
export async function loadImageFile(file: File): Promise<{
  img: HTMLImageElement;
  objectUrl: string;
  width: number;
  height: number;
  strippedExif: boolean;
}> {
  const rawUrl = URL.createObjectURL(file);
  try {
    const raw = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Could not load image"));
      el.src = rawUrl;
    });

    const canvas = document.createElement("canvas");
    canvas.width = raw.naturalWidth;
    canvas.height = raw.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unsupported");
    ctx.drawImage(raw, 0, 0);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("EXIF strip encode failed"))),
        "image/png",
      );
    });

    const objectUrl = URL.createObjectURL(blob);
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Could not load stripped image"));
      el.src = objectUrl;
    });

    return {
      img,
      objectUrl,
      width: img.naturalWidth,
      height: img.naturalHeight,
      strippedExif: true,
    };
  } finally {
    URL.revokeObjectURL(rawUrl);
  }
}

export function scanFromText(
  sourcePath: string,
  text: string,
  width: number,
  height: number,
): { detections: Detection[]; proposals: ProposedRedaction[] } {
  const matches = detectInText(text);
  const detections = matchesToDetections(
    matches,
    sourcePath,
    defaultPolicy,
    width,
    Math.max(22, Math.round(height * 0.035)),
  );
  const proposals = proposeRedactions(detections, defaultPolicy);
  return { detections, proposals };
}

export function bakePreview(
  img: HTMLImageElement,
  proposals: ProposedRedaction[],
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unsupported");
  ctx.drawImage(img, 0, 0);
  const active = proposals.filter((p) => p.action !== "dismiss");
  applyRedactions(ctx, active);
  return canvas;
}

export async function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("PNG encode failed"))),
      "image/png",
    );
  });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export { defaultPolicy };
