export type DetectionCategory =
  | "email"
  | "phone"
  | "person_name"
  | "address"
  | "account_id"
  | "api_key"
  | "token"
  | "password"
  | "ip"
  | "hostname"
  | "url_secret"
  | "face"
  | "org_name"
  | "financial"
  | "free_text_pii"
  | "other";

export type DetectionLayer =
  | "ocr"
  | "regex"
  | "ner"
  | "vision"
  | "allowlist"
  | "heuristic";

export type RedactionAction =
  | "replace_text"
  | "redact_block"
  | "blur"
  | "crop"
  | "dismiss";

export type Severity = "critical" | "high" | "medium" | "low";

export type JobStatus =
  | "ingested"
  | "normalized"
  | "detected"
  | "proposed"
  | "in_review"
  | "approved"
  | "rejected"
  | "exported";

export interface BBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Detection {
  id: string;
  sourcePath: string;
  category: DetectionCategory;
  bbox: BBox;
  text: string | null;
  confidence: number;
  layer: DetectionLayer;
  suggestedAction: RedactionAction;
  severity: Severity;
}

export interface Decision {
  detectionId: string;
  action: RedactionAction;
  replacement: string | null;
  reason: string | null;
  decidedBy: string;
  decidedAt: string;
}

export interface PolicyCategoryRule {
  action: RedactionAction;
  severity: Severity;
}

export interface Policy {
  version: number;
  name: string;
  fail_closed: boolean;
  require_human_approval: boolean;
  replacements: Record<string, string | string[]>;
  vocabulary: {
    keep: string[];
    redact: string[];
  };
  categories: Record<string, PolicyCategoryRule>;
  export: {
    format: "png" | "webp";
    strip_metadata: boolean;
    max_width: number;
  };
}

export interface JobSource {
  path: string;
  sha256: string;
  width: number;
  height: number;
  originalFilename: string;
}

export interface Job {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: JobStatus;
  policyId: string;
  policyHash: string;
  sources: JobSource[];
  approvedBy: string | null;
  approvedAt: string | null;
}
