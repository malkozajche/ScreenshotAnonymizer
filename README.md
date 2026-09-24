# Screenshot Anonymizer

Upload screenshots on phone or desktop → detect private data on-device → anonymize → download docs-ready images.

See [PLAN.md](./PLAN.md) for architecture.

## Quick mental model

```
upload (files / camera) → strip EXIF → OCR scan on-device → review → approve → download
```

Human approval is required before export. Screenshots stay in the browser by default.

## Run locally (laptop + phone on same Wi‑Fi)

```bash
npm install
npm run dev
```

Open the **Network** URL Vite prints (e.g. `http://192.168.x.x:5173`) on your phone.  
Tap **Camera / photos**, or install via the browser “Add to Home Screen” menu.

## Run anywhere with Docker

```bash
docker compose up --build
```

Then open `http://<host>:8080` from any device — phone included.

Or:

```bash
docker build -t screenshot-anonymizer .
docker run --rm -p 8080:8080 screenshot-anonymizer
```

## What gets anonymized

| Kind | Action |
|---|---|
| Emails, phones, IPs, names | Replace with international stand-ins |
| API keys, tokens, URL secrets | Solid redaction (never faked) |
| EXIF metadata | Stripped on ingest |

Personas live in `policies/default.yaml` (`Amara Okafor`, `Yuki Tanaka`, `Sofía Mendoza`, `+234…`, `Meridian GmbH`, …).

## Repo layout

```
apps/web              Vite React PWA
packages/pipeline     detect / redact / policy (shared)
policies/             YAML redaction policies
fixtures/             synthetic test data
deploy/               nginx config for Docker
```
