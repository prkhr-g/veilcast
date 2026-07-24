import type { Detector, DetectorFinding, ScanInput } from "../../types/detection";

const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,63}\b/gi;

export const emailDetector: Detector = {
  name: "email",
  detect(input: ScanInput): DetectorFinding[] {
    const findings: DetectorFinding[] = [];
    for (const match of input.content.matchAll(emailPattern)) {
      const value = match[0];
      const start = match.index ?? 0;
      findings.push({
        type: "email",
        value,
        confidence: 0.92,
        severity: "medium",
        range: { start, end: start + value.length },
        reason: "Email address",
        detector: emailDetector.name,
      });
    }
    return findings;
  },
};