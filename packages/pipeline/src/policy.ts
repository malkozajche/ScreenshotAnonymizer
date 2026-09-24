import type { Policy } from "./types.js";

/** Bundled default policy — blur-only redaction. */
export const defaultPolicy: Policy = {
  version: 1,
  name: "default",
  fail_closed: true,
  require_human_approval: true,
  replacements: {},
  vocabulary: {
    keep: [],
    redact: [],
  },
  categories: {
    api_key: { action: "blur", severity: "critical" },
    token: { action: "blur", severity: "critical" },
    password: { action: "blur", severity: "critical" },
    url_secret: { action: "blur", severity: "critical" },
    financial: { action: "blur", severity: "critical" },
    email: { action: "blur", severity: "high" },
    phone: { action: "blur", severity: "high" },
    person_name: { action: "blur", severity: "high" },
    address: { action: "blur", severity: "high" },
    account_id: { action: "blur", severity: "high" },
    ip: { action: "blur", severity: "high" },
    hostname: { action: "blur", severity: "medium" },
    org_name: { action: "blur", severity: "medium" },
    face: { action: "blur", severity: "high" },
    free_text_pii: { action: "blur", severity: "high" },
    other: { action: "blur", severity: "medium" },
  },
  export: {
    format: "png",
    strip_metadata: true,
    max_width: 2400,
  },
};
