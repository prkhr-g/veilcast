# @veilcast/detection-core

Standalone local detector for sensitive browser text. It returns masked findings with character ranges, element IDs, and bounds so callers can hide sensitive regions without receiving raw secrets.

```ts
import { detectionEngine } from "@veilcast/detection-core";

const detections = detectionEngine.scan({
  source: "dom",
  content: "OPENAI_API_KEY=sk-liveExampleSecretValue123456",
  elementId: "settings-panel",
  bounds: { x: 100, y: 200, width: 400, height: 24 },
});
```

The engine currently detects API keys, JWTs, database URLs, private keys, passwords/secrets, email addresses, phone numbers, and Luhn-valid credit-card candidates.

Raw sensitive values are never returned. Detector authors should return raw matches only through the internal `DetectorFinding.value` field so the engine can mask and discard them immediately.