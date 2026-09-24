# Screenshot Anonymizer — Rock-Solid Plan

## Goal

Upload product screenshots → detect private / identifiable data → anonymize it → export docs-ready images that are safe to publish.

**North star:** No screenshot leaves the pipeline for publishing unless a human has either approved the redactions or the automated scan found zero hits *and* that “clean” verdict was explicitly accepted.

---

## Design principles

1. **Privacy by default.** Prefer local / self-hosted processing. Originals never go to a third-party API unless the operator opts in.
2. **Detect → propose → apply → review.** Automation proposes; humans decide. Never auto-publish.
3. **Replace, don’t just smear.** For documentation, black bars look broken. Prefer generic lookalike text (or styled overlays) that keep the UI readable.
4. **Fail closed.** Ambiguous detections are treated as sensitive until cleared.
5. **Audit everything.** Every run produces a machine-readable report: what was found, where, what was done, who approved.
6. **Reversible workspace, irreversible publish.** Keep originals + masks in a private staging area. Publish only baked anonymized outputs.

---

## What counts as “identifiable / private”

| Category | Examples | Default action |
|---|---|---|
| Direct PII | names, emails, phones, postal addresses | replace with generics (`Jane Doe`, `user@example.com`, `+1 555 0100`) |
| Account IDs | user IDs, org IDs, customer numbers | replace with stable fake IDs |
| Auth secrets | API keys, tokens, JWTs, passwords, cookies | solid redact (never fake “realistic” secrets) |
| Network | private IPs, internal hostnames, VPN endpoints | replace with `10.0.0.x` / `app.example.com` |
| URLs with secrets | query params with tokens, signed URLs | strip or replace sensitive segments |
| Faces / people | employee photos in screenshots | blur / crop / replace avatar |
| Org-specific chrome | real company names, logos, tenant slugs in demos | replace with product’s public brand or `Acme` |
| Financial | card numbers, IBAN, invoice amounts (when sensitive) | mask per PCI-style rules |
| Free-text blobs | chat messages, ticket bodies, notes | OCR + NER; redact entities or whole region |
| Metadata | EXIF GPS, author, device serials | strip on ingest |

Rules are configurable per project (e.g. keep public product name, always redact customer names).

---

## Pipeline stages

```
┌─────────┐   ┌──────────┐   ┌────────────┐   ┌──────────┐   ┌────────┐   ┌────────┐
│ Ingest  │ → │ Normalize│ → │  Detect    │ → │ Propose  │ → │ Review │ → │ Export │
│ upload  │   │ strip    │   │ OCR+vision │   │ masks +  │   │ approve│   │ docs   │
│         │   │ EXIF     │   │ + rules    │   │ swaps    │   │ / edit │   │ assets │
└─────────┘   └──────────┘   └────────────┘   └──────────┘   └────────┘   └────────┘
     │              │               │               │              │            │
     └──────────────┴───────────────┴───────────────┴──────────────┴────────────┘
                              Job record + audit log
```

### 1. Ingest
- Accept PNG, JPEG, WebP, (optional) HEIC → convert to PNG working copy.
- Create a **job** with UUID, source hash, timestamps.
- Store original in private `originals/` (never published).
- Reject huge / weird files early (size + dimension guards).

### 2. Normalize
- Strip EXIF / XMP / ICC author tags.
- Optional: sRGB convert, max dimension cap for OCR cost, keep a full-res copy for final bake.
- Generate a preview thumbnail for the review UI.

### 3. Detect (multi-layer — this is the core)
Run layers independently; merge into one detection set with confidence + source.

| Layer | Purpose | Notes |
|---|---|---|
| **OCR** | Find text + bounding boxes | Tesseract or PaddleOCR as default local path |
| **Regex / patterns** | Emails, phones, IPs, JWTs, AWS keys, UUIDs, URLs | Fast, high precision for structured secrets |
| **NER / entity rules** | Person names, orgs, locations in OCR text | spaCy or similar; language packs as needed |
| **Vision / layout** | Faces, avatars, QR codes, barcode regions | Optional model; can be local |
| **Allow / deny lists** | Project vocabulary | “Cursor” keep; customer tenant slug redact |
| **Heuristic UI regions** | Sidebar user chip, profile menu, “Signed in as” | Template hints for common app chrome |

Each detection: `{ id, category, bbox, text, confidence, layer, suggested_action }`.

Overlapping boxes get merged; higher-severity category wins (secret > PII > generic).

### 4. Propose anonymization
Map each detection to an action:

- **replace_text** — overlay generic text styled to approximate font size/color (docs-friendly).
- **redact_block** — solid or soft blur for secrets / faces / unreadable regions.
- **crop** — remove margin chrome if configured.
- **metadata_strip** — already done at normalize; reaffirm in report.

Consistency: same source string → same replacement within a job (and optionally across a docs set) so “Ada Lovelace” doesn’t become three different fake names in one guide.

### 5. Review (human gate — non-negotiable for v1)
- Side-by-side: original | anonymized preview.
- Toggle detection overlays; click a box to change action / replacement / dismiss (with reason).
- Keyboard-friendly approve / reject.
- “Mark as false positive” feeds project allowlist (optional learning).

**Publish is blocked** until status = `approved`.

### 6. Export
- Bake final PNG/WebP at target resolution (docs site sizes).
- Emit companion artifacts:
  - `report.json` — detections + decisions
  - `manifest.json` — filenames, hashes, approval metadata
  - optional Markdown snippet with image alt text (scrubbed)
- Outputs land in `publish/` only after approval.

---

## Recommended architecture (v1)

**Local-first CLI + small web review UI**, one repo.

```
screenshot-anonymizer/
├── apps/
│   ├── cli/                 # batch & CI entrypoint
│   └── review-ui/           # local web UI for approve/edit
├── packages/
│   ├── core/                # pipeline orchestration
│   ├── detectors/           # OCR, regex, NER, vision adapters
│   ├── redact/              # mask apply, text overlay, blur
│   └── schema/              # job + report Zod/JSON schemas
├── policies/
│   └── default.yaml         # PII rules, replacements, severity
├── fixtures/                # synthetic screenshots for tests
└── PLAN.md
```

### Tech stack (pragmatic defaults)

| Concern | Choice | Why |
|---|---|---|
| Language | TypeScript (Node) + Python workers where models are easier | One product surface; Python for OCR/NER if needed |
| Orchestration | Job folder on disk + SQLite (or JSONL) index | Simple, auditable, no cloud required |
| OCR | PaddleOCR or Tesseract | Local, free, good enough for UI text |
| Patterns | Own regex pack + secret scanners (gitleaks-style) | High precision for keys/tokens |
| Redaction draw | Sharp / Canvas / Pillow | Deterministic pixel output |
| Review UI | Vite + React | Fast local loop |
| Config | YAML policy files | Diffable, per-docs-site policies |
| Packaging | `npx` / Docker image | Same pipeline on laptop and CI |

**Later (v2+):** optional cloud vision LLM assist (opt-in), team review queue, Figma/plugin upload, docs-site PR bot.

---

## Policy model

`policies/default.yaml` drives behavior, not hardcoded ifs.

```yaml
version: 1
replacements:
  email: "user@example.com"
  person_name: ["Alex Rivera", "Sam Patel", "Jordan Lee"]
  phone: "+1 555 0100"
  hostname: "app.example.com"
severity:
  keep: ["Example Product", "Docs"]
  redact: []
categories:
  api_key: { action: redact_block, severity: critical }
  email: { action: replace_text, severity: high }
  person_name: { action: replace_text, severity: high }
  face: { action: blur, severity: high }
fail_closed: true
require_human_approval: true
```

Projects fork/extend this file. CI can pin a policy hash in the job report.

---

## Threat model (what we’re defending against)

| Risk | Mitigation |
|---|---|
| Operator publishes original by mistake | Separate `originals/` vs `publish/`; CLI `export` only reads approved jobs |
| Missed PII in noisy UI | Multi-layer detect + fail-closed + mandatory review |
| Realistic fake secrets confuse readers | Secrets always solid-redact, never “sk-live-xxxx” fakes |
| Model/API leak of screenshots | Default local; cloud detectors behind explicit flag + warning |
| Inconsistent fakes across a guide | Stable replacement map keyed by normalized source string |
| Residual EXIF | Strip on ingest; verify in export checks |
| Reviewer fatigue | Severity sorting, auto-group identical strings, keyboard UI |

---

## Acceptance criteria (definition of done for v1)

1. Upload / point CLI at a folder of screenshots → job created, EXIF stripped.
2. Detector finds at least: emails, phones, IPv4, JWT-like tokens, AWS-like keys, common URL token params.
3. OCR bounding boxes drive text replacements that remain legible in typical UI screenshots.
4. Review UI shows original vs preview; user can edit/dismiss detections; approve locks the job.
5. Export writes anonymized images + `report.json`; refuses unapproved jobs.
6. Fixture suite with synthetic PII; CI fails if known entities survive in `publish/` outputs (grep/OCR round-trip test).
7. One Docker command runs CLI + review UI offline.

---

## Phased delivery

### Phase 0 — Plan & contracts *(this doc)*
- Schema for Job / Detection / Decision / Report
- Policy YAML shape
- Folder layout + CLI command sketch

### Phase 1 — Core CLI spine
- Ingest, normalize, regex detectors, block redaction, JSON report
- No UI yet; `--dry-run` and `--apply` with manual JSON edits OK

### Phase 2 — OCR + text replace
- OCR layer, bbox merge, styled text overlays
- Consistency map for replacements

### Phase 3 — Review UI
- Local server, side-by-side, approve flow
- Export gate

### Phase 4 — Hardening
- Faces/QR optional detector
- Fixture CI gates
- Docker image, policy packs, docs

### Phase 5 — Nice-to-haves
- Batch “docs set” consistency across many images
- Opt-in cloud vision assist
- VS Code / CI action: fail PR if unapproved screenshots added

---

## CLI sketch (target UX)

```bash
# Create job from a folder
sa ingest ./raw-shots --policy policies/docs.yaml

# Run detection + proposal
sa scan <job-id>

# Open review UI
sa review <job-id>

# Bake publishable outputs
sa export <job-id> --out ./publish

# CI guard: fail if publish/ still contains known patterns
sa verify ./publish --policy policies/docs.yaml
```

---

## Testing strategy

- **Unit:** regex/NER fixtures, bbox merge, replacement stability.
- **Golden images:** synthetic screenshots with planted PII; compare masks + OCR-after-export.
- **Property:** export images contain zero matches for planted secret corpus.
- **Manual checklist:** real product screenshots (private fixtures, not in git).

---

## Explicit non-goals (v1)

- Fully autonomous publish with no human review
- Perfect font matching / pixel-perfect UI reconstruction
- Video or PDF multi-page as first-class (images only)
- Guaranteeing 100% recall on handwriting or tiny anti-aliased text (mitigated by review)

---

## Open decisions (resolve before Phase 1 code)

1. **Runtime:** TypeScript-only with external OCR binary vs TS + Python sidecar?
2. **Storage:** filesystem jobs only vs SQLite index from day one?
3. **Text replace quality:** simple overlay rectangles vs inpainting + font estimate?
4. **Brand defaults:** what generic persona/company set for this repo’s sample policy?

**Proposed defaults:** TypeScript CLI + Tesseract/Paddle via subprocess; filesystem jobs + `manifest.json`; overlay rectangles first (good enough for docs); `Alex Rivera` / `Acme Corp` / `app.example.com` persona pack.

---

## Immediate next implementation step

After this plan is accepted:

1. Scaffold monorepo + JSON schemas for Job/Detection/Report.
2. Implement `sa ingest` / `sa scan` with regex detectors + solid redaction.
3. Add synthetic fixtures and `sa verify`.
4. Only then build OCR + review UI.

That order gets a **useful, safe MVP** in the fewest moving parts, then layers quality and UX.
