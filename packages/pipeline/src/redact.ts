import type { ProposedRedaction } from "./replace.js";
import type { BBox } from "./types.js";

export interface CanvasLike {
  width: number;
  height: number;
  getContext(type: "2d"): CanvasRenderingContext2D | null;
}

/**
 * Apply proposed redactions onto a canvas that already has the source image drawn.
 * Works in browser and in Node with node-canvas compatible contexts.
 */
export function applyRedactions(
  ctx: CanvasRenderingContext2D,
  proposals: ProposedRedaction[],
): void {
  for (const proposal of proposals) {
    if (proposal.action === "dismiss") continue;
    const { bbox } = proposal.detection;
    if (proposal.action === "replace_text" && proposal.replacement) {
      drawTextReplacement(ctx, bbox, proposal.replacement);
    } else if (proposal.action === "blur") {
      drawBlur(ctx, bbox);
    } else {
      drawBlock(ctx, bbox);
    }
  }
}

function drawBlock(ctx: CanvasRenderingContext2D, bbox: BBox): void {
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(bbox.x, bbox.y, bbox.w, bbox.h);
}

function drawBlur(ctx: CanvasRenderingContext2D, bbox: BBox): void {
  // Approximate blur with downscale/upscale of the region
  const { x, y, w, h } = bbox;
  try {
    const sample = ctx.getImageData(x, y, w, h);
    const scale = 0.12;
    const sw = Math.max(1, Math.floor(w * scale));
    const sh = Math.max(1, Math.floor(h * scale));
    const off = typeof document !== "undefined" ? document.createElement("canvas") : null;
    if (!off) {
      drawBlock(ctx, bbox);
      return;
    }
    off.width = sw;
    off.height = sh;
    const octx = off.getContext("2d");
    if (!octx) {
      drawBlock(ctx, bbox);
      return;
    }
    const tmp = typeof document !== "undefined" ? document.createElement("canvas") : null;
    if (!tmp) {
      drawBlock(ctx, bbox);
      return;
    }
    tmp.width = w;
    tmp.height = h;
    const tctx = tmp.getContext("2d");
    if (!tctx) {
      drawBlock(ctx, bbox);
      return;
    }
    tctx.putImageData(sample, 0, 0);
    octx.imageSmoothingEnabled = true;
    octx.drawImage(tmp, 0, 0, sw, sh);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(off, 0, 0, sw, sh, x, y, w, h);
  } catch {
    drawBlock(ctx, bbox);
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
