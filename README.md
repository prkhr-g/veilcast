# VeilCast

This repo is split into three top-level packages:

- `detection-core`: standalone local sensitive-content detector.
- `main-backend`: Bun server and API routes.
- `ex-frontend`: existing React frontend from the template.

## Commands

```bash
bun install
bun dev
bun test
bun run build
```

The current frontend is still the original Bun/React template UI. The backend serves it and exposes `POST /api/scan`, which delegates to `detection-core` and returns masked detections only.