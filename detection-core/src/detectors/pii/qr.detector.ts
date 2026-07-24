import jsQR from "jsqr";
import type { Bounds, Detector, DetectorFinding, ScanInput } from "../../types/detection";

function boundsForQr(location: {
  topLeftCorner: { x: number; y: number };
  topRightCorner: { x: number; y: number };
  bottomLeftCorner: { x: number; y: number };
  bottomRightCorner: { x: number; y: number };
}): Bounds {
  const points = [
    location.topLeftCorner,
    location.topRightCorner,
    location.bottomLeftCorner,
    location.bottomRightCorner,
  ];
  const x = Math.floor(Math.min(...points.map(point => point.x)));
  const y = Math.floor(Math.min(...points.map(point => point.y)));
  const right = Math.ceil(Math.max(...points.map(point => point.x)));
  const bottom = Math.ceil(Math.max(...points.map(point => point.y)));
  return { x, y, width: right - x, height: bottom - y };
}

export const qrDetector: Detector = {
  name: "qr-code",
  detect(input: ScanInput): DetectorFinding[] {
    if (!input.imageData || !input.imageWidth || !input.imageHeight) return [];

    const code = jsQR(input.imageData, input.imageWidth, input.imageHeight, {
      inversionAttempts: "attemptBoth",
    });
    if (!code || !code.data) return [];

    return [{
      type: "qr_code",
      value: code.data,
      confidence: 0.98,
      severity: "high",
      // QR data is not part of the scanned text, so it has no text range.
      range: { start: 0, end: 0 },
      bounds: boundsForQr(code.location),
      reason: "QR code may expose payment or authentication data",
      detector: qrDetector.name,
    }];
  },
};
