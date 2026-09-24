import type { Detection, Policy } from "./types.js";

export interface ProposedRedaction {
  detection: Detection;
  action: Detection["suggestedAction"];
  replacement: string | null;
}

/** Propose blur for every active detection (no text stand-ins). */
export function proposeRedactions(
  detections: Detection[],
  _policy: Policy,
): ProposedRedaction[] {
  return detections.map((detection) => ({
    detection,
    action: detection.suggestedAction === "dismiss" ? "dismiss" : "blur",
    replacement: null,
  }));
}

/** Kept for API compatibility — blur-only mode does not use replacements. */
export function pickReplacement(
  _policy: Policy,
  _category: string,
  _sourceText: string,
): string | null {
  return null;
}

export function stableIndex(key: string, modulo: number): number {
  if (modulo <= 0) return 0;
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % modulo;
}
