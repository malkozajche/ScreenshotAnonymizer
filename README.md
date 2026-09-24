# Screenshot Anonymizer

Upload screenshots on phone or desktop → detect private data on-device → anonymize → download docs-ready images.

**Status:** Plan locked + Phase 1 scaffolding. See [PLAN.md](./PLAN.md).

## Quick mental model

```
upload (files / camera) → scan on-device → review → approve → download
```

Human approval is required before export. Screenshots stay in the browser by default.

## Run anywhere

```bash
npm install
npm run dev --workspace=apps/web
```

Open the URL on your laptop or phone (same Wi‑Fi / tunneled host). Install as a PWA from the browser menu when prompted.

## Decisions locked

| Topic | Choice |
|---|---|
| Surface | Mobile-first web PWA |
| Processing | On-device (browser) |
| Personas | International pack in `policies/default.yaml` |
| Secrets | Solid redaction only |

## Repo layout

```
apps/web              Vite React PWA
packages/pipeline     detect / redact / policy (shared)
policies/             YAML redaction policies
fixtures/             synthetic test data
```
