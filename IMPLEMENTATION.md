# VeilCast Implementation Status

Last updated: 2026-07-24

## Repository Layout

The repo is organized as a Bun workspace with three top-level packages:

- `detection-core`: local-only detection and classification logic.
- `main-backend`: Bun + Hono HTTP API, request validation, CORS, request IDs, response envelopes and privacy-safe logging.
- `ex-frontend`: existing React frontend template. No product frontend has been implemented yet.

Core rule: backend routes stay thin. Anything detector-shaped belongs in `detection-core`; HTTP-only concerns belong in `main-backend`.

## Detection Core

Implemented in `detection-core/src`:

- Text detection engine with detector registration and disabling.
- Standard detection model with ranges, confidence, severity, source, optional bounds and masked values.
- Masking utilities that avoid returning raw secrets.
- Deduplication/overlap handling that prefers more specific and higher-severity detections.
- Detectors for API keys, JWTs, database URLs, PEM private keys, password/secret assignments, emails, phones and Luhn-valid credit cards.
- API-facing result mapping in `detection-core/src/api-results.ts`.
- Deterministic QR classification in `detection-core/src/api/qr-classifier.ts`:
  - `upi://pay` -> `payment`, `action: mask`
  - `otpauth://` -> `authentication`, `action: mask`
  - `WIFI:` -> `wifi`, `action: mask`
  - `BEGIN:VCARD` -> `contact`, `action: mask`
  - `http://` or `https://` -> `url`, `action: allow`
  - everything else -> `unknown`, `action: review`
- Detection rules exported from `detection-core/src/api/rules.ts`.
- Adapter interfaces and safe placeholders in `detection-core/src/api/adapters.ts` for text, context and image processing.

Privacy behavior so far:

- Raw detected text is masked before public detection results are returned.
- QR API classification does not return the decoded QR payload.
- Events are validated and counted only; they are not stored or forwarded.

## Main Backend API

Implemented in `main-backend/src`:

- `app.ts`: Hono app, routes, CORS, request IDs, size checks and privacy-safe logging.
- `schemas.ts`: Zod request schemas.
- `responses.ts`: success/failure envelopes and JSON parsing errors.
- `index.ts`: Bun server bootstrap using `app.fetch`.

Endpoints implemented:

- `GET /api/health`
- `POST /api/detections/text`
- `POST /api/detections/context`
- `POST /api/detections/qr`
- `POST /api/detections/image`
- `POST /api/detections/batch`
- `GET /api/detections/rules`
- `POST /api/detections/events`

Response envelopes:

```json
{ "success": true, "data": {} }
```

```json
{ "success": false, "error": { "code": "validation_failed", "message": "Request body is invalid" } }
```

Every detection result contains:

- `type`
- `category`
- `sensitive`
- `severity`
- `confidence`
- `action`
- `reason`

CORS behavior:

- Uses `EXTENSION_ORIGINS` as a comma-separated allowlist.
- Production does not allow unrestricted CORS.
- Development allows common localhost origins.

Request limits:

- Global request body size limit: `1_000_000` bytes from `content-length`.
- Text/context body content max: `100_000` characters.
- QR payload max: `4096` characters.
- Image payload max: `1_000_000` characters.
- Batch max: `25` requests.
- Events max: `100` events.

## Tests

Implemented tests:

- `detection-core/tests/detection-engine.test.ts`
- `detection-core/tests/qr-classifier.test.ts`
- `main-backend/tests/api.test.ts`

Coverage includes:

- All existing text detector families.
- Luhn validation.
- Deduplication/overlap behavior.
- Secret masking and no raw secret serialization.
- QR classification categories/actions.
- QR API response does not return payload.
- Missing/malformed input validation.
- Request-size rejection.
- Response envelope contracts.
- Production CORS is not unrestricted.

Last verified commands:

```bash
bun test
bun test --typecheck
bun run build
```

Last known result: `26` tests passing, typecheck passing, build passing.

## Dependencies

Backend API dependencies:

- `hono`
- `zod`

`hono` and `zod` are owned by `main-backend/package.json`.

The previous QR image-decoding dependency was removed from `detection-core/package.json`; current QR work is deterministic payload classification only.

## Current Limitations

- QR endpoint classifies an already-decoded payload; it does not decode QR codes from images.
- Image detection is a safe placeholder and returns no detections.
- Context detection uses local text detection only; no external AI provider is connected.
- No authentication, database, analytics provider or product frontend has been added.
- `ex-frontend` is still the original Bun/React template.

## Recommended Next Step

Implement real local image/QR decoding behind the `detection-core` image adapter, then have `POST /api/detections/image` call that adapter without moving decoding logic into `main-backend`.

## Chrome Extension Safe Share

Implemented in `ex-frontend` as a WXT Manifest V3 Chrome extension:

- `entrypoints/popup`: React popup with a one-click Safe Share toggle and active-tab error handling.
- `entrypoints/content.ts`: injected content script that owns the DOM shield, local detection scan, masks and cleanup.
- `src/extension/messages.ts`: typed runtime message contracts and detection-region validation.
- `test-fixtures/safe-share.html`: local manual fixture with fake secrets, dynamic content, scrolling and moving content.

Safe Share does not start capture, does not open a source picker, does not call the Hono backend and does not send page content off-device.

Manual acceptance flow:

1. Run `bun run dev:extension`.
2. Load `ex-frontend/.output/chrome-mv3` unpacked in Chrome.
3. Open an HTTP/HTTPS test page, such as the fixture through a local static server.
4. Click Enable Safe Share in the popup.
5. Confirm one `#vielcast-shield-root` exists, masks cover fake sensitive regions and normal page clicks still work.
6. Scroll, resize, wait for dynamic content and confirm masks stay aligned.
7. Click Safe Share Active and confirm the root is removed.
8. Open a browser-internal page and confirm the popup shows the unsupported-page error.

Known extension limitations:

- Chrome/Chromium only.
- Browser-tab DOM content only; native apps and whole-screen content outside the page are out of scope.
- No OCR, face/photo masking or QR image decoding in this step.

## Safe Share Message Flow

1. Popup resolves the active tab and rejects unsupported URLs.
2. Popup injects the WXT content-script bundle with the `scripting` permission.
3. Popup sends typed `VIELCAST_*` messages to the content script.
4. Content script owns per-tab shield state and answers state queries directly.
5. Detection regions are viewport-relative and rendered as mostly opaque fixed-position Shadow DOM masks.
6. Disable disconnects observers, removes listeners, cancels pending refresh and removes VielCast DOM.
