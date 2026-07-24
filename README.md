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

## Chrome Extension Safe Share

The extension lives in `ex-frontend` as a WXT Manifest V3 Chrome extension. Safe Share no longer starts a capture session or opens Chrome's source picker; it injects a local DOM shield into the active HTTP/HTTPS tab.

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

### Use Safe Share

1. Start sharing the browser tab normally in Meet, Zoom, Teams or another meeting app.
2. Open the VeilCast popup on that same tab.
3. Click Enable Safe Share.
4. Confirm `#vielcast-shield-root` appears in the page and the page remains clickable.
5. Click Safe Share Active to remove the shield.

### Local Fixture

Open `ex-frontend/test-fixtures/safe-share.html` in an HTTP server or any test page URL the extension can access. It includes fake secrets, dynamic content, a password field, scroll height and a moving sensitive element.

### Current Limitations

- Chrome/Chromium only.
- Protection applies only inside browser-tab DOM content. It does not protect native desktop apps or whole-screen shares outside the browser page.
- Text, password inputs and `data-vielcast-sensitive="true"` elements are handled locally; OCR, face/photo masking and QR image decoding are not implemented in this step.

## Safe Share Message Flow

1. Popup queries the active tab and rejects browser-internal URLs.
2. Popup injects `content-scripts/content.js` into the active tab with `chrome.scripting.executeScript`.
3. Popup sends `VIELCAST_TOGGLE_SHIELD` or `VIELCAST_GET_SHIELD_STATE` with the typed runtime message contract.
4. Content script scans local DOM text with `detection-core`, converts text ranges to viewport-relative client rects, and renders opaque masks in a Shadow DOM overlay.
5. Disable removes the root, masks, observers, listeners and pending animation frame.
