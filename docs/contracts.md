# Job & report contracts (Phase 0)

These JSON Schema drafts are the API between CLI, detectors, redact, and review UI.
Implementations should validate against these (or generated Zod types) before writing disk state.

## Job folder layout

```
jobs/<job-id>/
  original/           # never published
  working/            # normalized PNG(s)
  detections.json     # DetectionSet
  decisions.json      # DecisionSet (from review or defaults)
  preview/            # anonymized preview frames
  publish/            # only after status=approved
  report.json         # final audit Report
  job.json            # Job meta
```

## Job

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://screenshot-anonymizer.local/schema/job.json",
  "type": "object",
  "required": ["id", "createdAt", "status", "policyId", "sources"],
  "properties": {
    "id": { "type": "string", "format": "uuid" },
    "createdAt": { "type": "string", "format": "date-time" },
    "updatedAt": { "type": "string", "format": "date-time" },
    "status": {
      "enum": [
        "ingested",
        "normalized",
        "detected",
        "proposed",
        "in_review",
        "approved",
        "rejected",
        "exported"
      ]
    },
    "policyId": { "type": "string" },
    "policyHash": { "type": "string", "description": "sha256 of policy file" },
    "sources": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["path", "sha256", "width", "height"],
        "properties": {
          "path": { "type": "string" },
          "sha256": { "type": "string" },
          "width": { "type": "integer" },
          "height": { "type": "integer" },
          "originalFilename": { "type": "string" }
        }
      }
    },
    "approvedBy": { "type": ["string", "null"] },
    "approvedAt": { "type": ["string", "null"], "format": "date-time" }
  }
}
```

## Detection

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://screenshot-anonymizer.local/schema/detection.json",
  "type": "object",
  "required": ["id", "sourcePath", "category", "bbox", "confidence", "layer", "suggestedAction"],
  "properties": {
    "id": { "type": "string" },
    "sourcePath": { "type": "string" },
    "category": {
      "enum": [
        "email",
        "phone",
        "person_name",
        "address",
        "account_id",
        "api_key",
        "token",
        "password",
        "ip",
        "hostname",
        "url_secret",
        "face",
        "org_name",
        "financial",
        "free_text_pii",
        "other"
      ]
    },
    "bbox": {
      "type": "object",
      "required": ["x", "y", "w", "h"],
      "properties": {
        "x": { "type": "number" },
        "y": { "type": "number" },
        "w": { "type": "number" },
        "h": { "type": "number" }
      }
    },
    "text": { "type": ["string", "null"] },
    "confidence": { "type": "number", "minimum": 0, "maximum": 1 },
    "layer": {
      "enum": ["ocr", "regex", "ner", "vision", "allowlist", "heuristic"]
    },
    "suggestedAction": {
      "enum": ["replace_text", "redact_block", "blur", "crop", "dismiss"]
    },
    "severity": {
      "enum": ["critical", "high", "medium", "low"]
    }
  }
}
```

## Decision

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://screenshot-anonymizer.local/schema/decision.json",
  "type": "object",
  "required": ["detectionId", "action"],
  "properties": {
    "detectionId": { "type": "string" },
    "action": {
      "enum": ["replace_text", "redact_block", "blur", "crop", "dismiss"]
    },
    "replacement": { "type": ["string", "null"] },
    "reason": { "type": ["string", "null"] },
    "decidedBy": { "type": "string" },
    "decidedAt": { "type": "string", "format": "date-time" }
  }
}
```

## Report

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://screenshot-anonymizer.local/schema/report.json",
  "type": "object",
  "required": ["jobId", "generatedAt", "status", "counts", "outputs"],
  "properties": {
    "jobId": { "type": "string" },
    "generatedAt": { "type": "string", "format": "date-time" },
    "status": { "enum": ["approved", "rejected", "exported"] },
    "policyHash": { "type": "string" },
    "counts": {
      "type": "object",
      "properties": {
        "detections": { "type": "integer" },
        "applied": { "type": "integer" },
        "dismissed": { "type": "integer" },
        "byCategory": { "type": "object", "additionalProperties": { "type": "integer" } }
      }
    },
    "outputs": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["path", "sha256"],
        "properties": {
          "path": { "type": "string" },
          "sha256": { "type": "string" }
        }
      }
    },
    "verifier": {
      "type": "object",
      "description": "Post-export pattern scan results",
      "properties": {
        "passed": { "type": "boolean" },
        "hits": { "type": "array", "items": { "type": "object" } }
      }
    }
  }
}
```
