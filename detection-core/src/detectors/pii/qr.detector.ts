import type { Detector, DetectorFinding, ScanInput } from "../../types/detection";

export const qrDetector: Detector = {
  name: "qr-code",
  detect(input: ScanInput): DetectorFinding[] {
    if (!input.content.startsWith("qr:")) return [];
    const value = input.content.slice(3);
    if (!value) return [];

    return [{
      type: "qr_code",
      value,
      confidence: 1,
      severity: "high",
      range: { start: 0, end: input.content.length },
      reason: "QR payload detected",
      detector: qrDetector.name,
    }];
  },
};
