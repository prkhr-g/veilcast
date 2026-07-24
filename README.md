# VeilCast

This repo is split into three top-level packages:

- `detection-core`: standalone local sensitive-content detection and classification logic.
- `main-backend`: Bun + Hono API server, validation, CORS, request IDs, envelopes and logging.
- `ex-frontend`: existing React frontend from the template.

## Commands

```bash
bun install
bun dev
bun test
bun run check-types
bun run build
```

## API Envelopes

Success responses use:

```json
{ "success": true, "data": {} }
```

Failure responses use:

```json
{ "success": false, "error": { "code": "validation_failed", "message": "Request body is invalid" } }
```

Every detection result contains `type`, `category`, `sensitive`, `severity`, `confidence`, `action` and `reason`. QR payloads and other raw secrets are never returned.

## Endpoints

### GET `/api/health`

Response:

```json
{ "success": true, "data": { "status": "ok", "service": "veilcast-detection-api" } }
```

### POST `/api/detections/text`

Request:

```json
{
  "source": "dom",
  "content": "john@example.com",
  "elementId": "optional-element-id",
  "bounds": { "x": 0, "y": 0, "width": 100, "height": 20 },
  "confidence": 1
}
```

Response:

```json
{ "success": true, "data": { "detections": [{ "type": "email", "category": "pii", "sensitive": true, "severity": "medium", "confidence": 0.92, "action": "mask", "reason": "Email address" }] } }
```

### POST `/api/detections/context`

Request:

```json
{ "content": "password=example123", "context": { "fieldName": "password" } }
```

Response:

```json
{ "success": true, "data": { "detections": [] } }
```

The current placeholder adapter uses local text detection only. No external AI provider is connected.

### POST `/api/detections/qr`

Request:

```json
{ "payload": "upi://pay?pa=user@bank" }
```

Response:

```json
{ "success": true, "data": { "detection": { "type": "qr_code", "category": "payment", "sensitive": true, "severity": "high", "confidence": 1, "action": "mask", "reason": "QR payload is a payment URI" } } }
```

Classification rules: `upi://pay` is `payment`, `otpauth://` is `authentication`, `WIFI:` is `wifi`, `BEGIN:VCARD` is `contact`, `http://` and `https://` are `url`, and everything else is `unknown`. The decoded QR payload is never returned or logged.

### POST `/api/detections/image`

Request:

```json
{ "imageBase64": "ZmFrZQ==", "mimeType": "image/png" }
```

Response:

```json
{ "success": true, "data": { "detections": [] } }
```

Image processing is behind an adapter and currently has a safe placeholder implementation.

### POST `/api/detections/batch`

Request:

```json
{
  "requests": [
    { "kind": "text", "input": { "content": "john@example.com" } },
    { "kind": "qr", "input": { "payload": "otpauth://totp/App?secret=ABC" } }
  ]
}
```

Response:

```json
{ "success": true, "data": { "results": [{ "kind": "text", "detections": [] }, { "kind": "qr", "detection": { "type": "qr_code", "category": "authentication", "sensitive": true, "severity": "high", "confidence": 1, "action": "mask", "reason": "QR payload is an authentication secret URI" } }] } }
```

### GET `/api/detections/rules`

Response:

```json
{ "success": true, "data": { "rules": [{ "id": "qr-payment", "type": "qr_code", "category": "payment", "action": "mask", "enabled": true }] } }
```

### POST `/api/detections/events`

Request:

```json
{ "events": [{ "type": "masked", "category": "payment", "action": "mask", "occurredAt": "2026-07-24T00:00:00.000Z" }] }
```

Response:

```json
{ "success": true, "data": { "accepted": 1 } }
```

Events are validated and counted only; they are not stored, forwarded to analytics, or logged with payload data.

## CORS

Set `EXTENSION_ORIGINS` to a comma-separated allowlist such as:

```bash
EXTENSION_ORIGINS=chrome-extension://your-extension-id,http://localhost:5173
```

Production CORS is never unrestricted. Development additionally allows common localhost origins.

## Chrome Extension Safe Preview

The first local capture flow lives in `ex-frontend` as a WXT Manifest V3 Chrome extension. It does not call the backend and does not send captured frames, stream IDs or page information off-device.

### Run In Development

```bash
bun install
bun run dev:extension
```

WXT writes the Chrome development build to `ex-frontend/.output/chrome-mv3`.

### Load Unpacked In Chrome

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click Load unpacked.
4. Select `ex-frontend/.output/chrome-mv3`.
5. Pin VeilCast from the Chrome extensions menu.

### Start Safe Preview

1. Open the browser window you want to present.
2. Click the VeilCast extension icon.
3. Click Start Safe Sharing.
4. In Chrome's picker, choose a window from the Window tab. Do not choose the full desktop.
5. VeilCast opens one Safe Preview window and displays the live captured window with a transparent mask canvas above it.

### Test Switching Tabs

1. Keep the Safe Preview window open.
2. Return to the original captured browser window.
3. Switch tabs or navigate within that same window.
4. Confirm the same Safe Preview window updates live and the original browser pages are not modified.

### Share In Google Meet

1. Start a Google Meet call.
2. Click Present now.
3. Choose A window.
4. Select the VeilCast Safe Preview window, not the original browser window.
5. Stop sharing from Meet or click Stop Sharing in the VeilCast popup.

### Current Capture Limitations

- Chrome/Chromium only; Firefox support is not implemented.
- The picker is restricted to browser/window capture by requesting only `window` sources through `chrome.desktopCapture`.
- Linux Wayland behavior depends on Chrome and the desktop portal. Some environments may show a system picker, omit some windows, or require X11 for stable window capture.
- The Safe Preview overlay is transparent and empty; masking is reserved for a later step.
