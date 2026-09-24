import { detectInText } from "./detect.js";

/** Return residual structured PII/secret hits found in text (empty = clean). */
export function verifyTextClean(text: string): string[] {
  return detectInText(text).map((m) => `${m.category}:${m.text}`);
}
