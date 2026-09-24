import type { ProposedRedaction } from "./replace.js";
import type { BBox } from "./types.js";

/**
 * Apply proposed redactions onto a canvas that already has the source image drawn.
 * Default path is blur-only.
 */
export function applyRedactions(
  ctx: CanvasRenderingContext2D,
  proposals: ProposedRedaction[],
): void {
  for (const proposal of proposals) {
    if (proposal.action === "dismiss") continue;
    const bbox = padBBox(proposal.detection.bbox, 3);
    // Blur is the product default; keep block/replace as rare overrides.
    if (proposal.action === "replace_text" && proposal.replacement) {
      drawTextReplacement(ctx, bbox, proposal.replacement);
    } else if (proposal.action === "redact_block") {
      drawBlock(ctx, bbox);
    } else {
      drawBlur(ctx, bbox);
    }
  }
}

function padBBox(bbox: BBox, pad: number): BBox {
  return {
    x: Math.max(0, bbox.x - pad),
    y: Math.max(0, bbox.y - pad),
    w: bbox.w + pad * 2,
    h: bbox.h + pad * 2,
  };
}

function drawBlock(ctx: CanvasRenderingContext2D, bbox: BBox): void {
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(bbox.x, bbox.y, bbox.w, bbox.h);
}

function drawBlur(ctx: CanvasRenderingContext2D, bbox: BBox): void {
  const canvas = ctx.canvas;
  const x = Math.max(0, Math.floor(bbox.x));
  const y = Math.max(0, Math.floor(bbox.y));
  const w = Math.max(1, Math.min(Math.ceil(bbox.w), canvas.width - x));
  const h = Math.max(1, Math.min(Math.ceil(bbox.h), canvas.height - y));

  try {
    const sample = ctx.getImageData(x, y, w, h);
    // Strong pixelation/blur so text is unreadable
    const scale = 0.06;
    const sw = Math.max(1, Math.floor(w * scale));
    const sh = Math.max(1, Math.floor(h * scale));

    if (typeof document === "undefined") {
      drawBlock(ctx, { x, y, w, h });
      return;
    }

    const tmp = document.createElement("canvas");
    tmp.width = w;
    tmp.height = h;
    const tctx = tmp.getContext("2d");
    if (!tctx) {
      drawBlock(ctx, { x, y, w, h });
      return;
    }
    tctx.putImageData(sample, 0, 0);

    const off = document.createElement("canvas");
    off.width = sw;
    off.height = sh;
    const octx = off.getContext("2d");
    if (!octx) {
      drawBlock(ctx, { x, y, w, h });
      return;
    }

    octx.imageSmoothingEnabled = true;
    octx.drawImage(tmp, 0, 0, sw, sh);

    // Second pass for heavier smear
    const mid = document.createElement("canvas");
    mid.width = Math.max(1, Math.floor(sw * 0.5));
    mid.height = Math.max(1, Math.floor(sh * 0.5));
    const mctx = mid.getContext("2d");
    if (mctx) {
      mctx.imageSmoothingEnabled = true;
      mctx.drawImage(off, 0, 0, mid.width, mid.height);
      octx.clearRect(0, 0, sw, sh);
      octx.drawImage(mid, 0, 0, sw, sh);
    }

    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(off, 0, 0, sw, sh, x, y, w, h);
  } catch {
    drawBlock(ctx, { x, y, w, h });
  }
}

function drawTextReplacement(
  ctx: CanvasRenderingContext2D,
  bbox: BBox,
  text: string,
): void {
  ctx.fillStyle = "#f4f4f5";
  ctx.fillRect(bbox.x, bbox.y, bbox.w, bbox.h);
  const fontSize = Math.max(10, Math.min(bbox.h * 0.62, 22));
  ctx.fillStyle = "#18181b";
  ctx.font = `500 ${fontSize}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textBaseline = "middle";
  const padding = 6;
  const maxWidth = Math.max(8, bbox.w - padding * 2);
  ctx.fillText(text, bbox.x + padding, bbox.y + bbox.h / 2, maxWidth);
}
