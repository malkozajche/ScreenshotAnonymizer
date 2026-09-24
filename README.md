# Screenshot Anonymizer

Upload screenshots on phone or desktop → detect private data on-device → **blur** those regions → download docs-ready images.

Live UI: https://malkozajche.github.io/ScreenshotAnonymizer/

## Quick mental model

```
upload (files / camera) → strip EXIF → OCR scan on-device → blur regions → review → approve → download
```

Human approval is required before export. Screenshots stay in the browser by default.

## Run locally

```bash
npm install
npm run dev
```

## Docker

```bash
docker compose up --build
# http://localhost:8080
```

## Behavior

Detected emails, phones, names, IPs, API keys, and similar hits are **blurred in place**. No fake stand-in text. Dismiss a hit in review if it was a false positive.
