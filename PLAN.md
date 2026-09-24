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
| Direct PII | names, emails, phones, postal addresses | replace with international generics (`Amara Okafor`, `user@example.com`, `+44 7700 900123`) |
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

**Mobile-first PWA; processing stays on-device**, one repo.

```
screenshot-anonymizer/
├── apps/
│   └── web/                 # Vite React PWA (phone + desktop)
├── packages/
│   └── pipeline/            # detect, redact, policy, types (isomorphic)
├── policies/
│   └── default.yaml         # international persona pack + rules
├── fixtures/                # synthetic screenshots / text for tests
└── PLAN.md
```

### Tech stack (locked)

| Concern | Choice | Why |
|---|---|---|
| Language | TypeScript end-to-end | One stack for web + future CLI |
| App | Vite + React PWA | Install on phone, works offline, deploy anywhere |
| Processing | Browser (Canvas + Tesseract.js) | Screenshots never uploaded by default |
| Job storage | IndexedDB | Per-device, no account |
| Patterns | Regex / secret scanners | High precision for keys/tokens |
| Redaction | Canvas overlays + solid blocks | Deterministic, docs-friendly |
| Config | YAML policy (bundled + editable later) | Diffable international personas |
| Packaging | Static host or Docker nginx | One URL from anywhere |

**Later (v2+):** optional self-hosted server assist, team review queue, headless CLI for CI, Figma plugin.

---

## Policy model

`policies/default.yaml` drives behavior, not hardcoded ifs.

```yaml
version: 1
replacements:
  email: ["user@example.com", "contact@example.org"]
  person_name: ["Amara Okafor", "Yuki Tanaka", "Sofía Mendoza", "Lars Nielsen"]
  phone: ["+44 7700 900123", "+81 90-1234-5678", "+55 11 98765-4321"]
  org_name: ["Meridian GmbH", "Sakura Systems", "Lagos Labs"]
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
| Operator publishes original by mistake | Download only from approved state; originals stay in IndexedDB until cleared |
| Missed PII in noisy UI | Multi-layer detect + fail-closed + mandatory review |
| Realistic fake secrets confuse readers | Secrets always solid-redact, never “sk-live-xxxx” fakes |
| Model/API leak of screenshots | Default local; cloud detectors behind explicit flag + warning |
| Inconsistent fakes across a guide | Stable replacement map keyed by normalized source string |
| Residual EXIF | Strip on ingest; verify in export checks |
| Reviewer fatigue | Severity sorting, auto-group identical strings, keyboard UI |

---

## Acceptance criteria (definition of done for v1)

1. Open the web app on desktop or phone → upload from files or camera roll.
2. Detector finds at least: emails, phones, IPv4, JWT-like tokens, AWS-like keys, common URL token params.
3. OCR bounding boxes drive text replacements that remain legible in typical UI screenshots.
4. Mobile-friendly review UI shows original vs preview; user can edit/dismiss detections; approve locks the job.
5. Download anonymized images + `report.json`; export blocked until approved (or explicit clean-accept).
6. Unit/fixture suite with synthetic PII; verify step fails if known entities survive.
7. One URL (or Docker) runs the full PWA offline-capable; installable on phone home screen.

---

## Phased delivery

### Phase 0 — Plan & contracts *(this doc)*
- Schema for Job / Detection / Decision / Report
- Policy YAML shape
- Locked product decisions (below)

### Phase 1 — Web PWA spine + regex detect/redact
- Vite React TypeScript PWA (mobile-first)
- Browser pipeline: ingest → regex detect → block/replace propose → review → download
- IndexedDB job storage (device-local)
- International persona policy pack

### Phase 2 — OCR + text replace
- Tesseract.js in-browser OCR, bbox merge, styled overlays
- Consistency map for replacements across a batch

### Phase 3 — Polish for phone + share
- Camera capture, share-target, better touch review gestures
- PWA install prompt + offline shell

### Phase 4 — Hardening
- Faces/QR optional detector
- Fixture CI gates
- Docker image for self-host / air-gapped teams
- Optional headless CLI wrapping the same `packages/pipeline` for CI

### Phase 5 — Nice-to-haves
- Batch “docs set” consistency across many images
- Opt-in cloud vision assist
- CI action: fail PR if unapproved screenshots added

---

## Product UX sketch

```
Phone / laptop browser
  → open deployed URL (or localhost / Docker)
  → Upload or take screenshot
  → Scan (on-device)
  → Review detections (tap to edit / dismiss)
  → Approve → Download PNG + report.json
```

Optional later CLI (same pipeline package):

```bash
sa scan ./raw-shots --out ./publish
sa verify ./publish
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

## Locked decisions

| Decision | Choice | Why |
|---|---|---|
| **Runtime** | TypeScript everywhere; Vite + React **PWA**; Tesseract.js in-browser for OCR | Runs from any URL on phone or desktop; no Python sidecar; deploy to static host or Docker |
| **Where processing happens** | **On-device (browser) by default** | Screenshots never leave the phone/laptop unless operator self-hosts a future optional server assist |
| **Storage** | IndexedDB per device for jobs; download for publish artifacts | Works offline; no account required for v1 |
| **Text replace** | Overlay rectangles + approximate font size first | Fast, predictable; inpainting later if needed |
| **Persona pack** | International names, phones, orgs (see `policies/default.yaml`) | Docs look global, not US-only |
| **Secrets** | Always solid `redact_block` | Never emit realistic-looking fake keys |

---

## Immediate next implementation step

1. Scaffold `apps/web` PWA + `packages/pipeline` (detect / redact / types).
2. Ship Phase 1: upload → regex scan → review → download on mobile + desktop.
3. Add fixtures + unit tests for detectors.
4. Layer OCR (Phase 2) on the same review UI.
