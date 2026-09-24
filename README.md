# Screenshot Anonymizer

Upload screenshots → detect private data → anonymize → export docs-ready images.

**Status:** Planning. See [PLAN.md](./PLAN.md) for the full architecture, threat model, and phased delivery.

## Quick mental model

```
ingest → normalize (strip EXIF) → detect (OCR + patterns) → propose masks
      → human review → export publishable assets + audit report
```

Human approval is required before anything is considered publishable.

## Repo layout (target)

```
apps/cli            batch & CI entrypoint
apps/review-ui      local approve/edit UI
packages/core       pipeline orchestration
packages/detectors  OCR, regex, NER, vision
packages/redact     blur / block / text replace
packages/schema     job + report contracts
policies/           YAML redaction policies
fixtures/           synthetic screenshots for CI
```

## Principles

- Local-first; originals never published
- Fail closed on ambiguous detections
- Replace with generics for docs readability; solid-redact secrets
- Full audit trail per job
