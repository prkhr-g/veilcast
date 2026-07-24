import type { Detector, DetectorFinding, ScanInput } from "../../types/detection";

const privateKeyPattern = /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]{0,8000}?-----END [A-Z ]*PRIVATE KEY-----/g;

export const privateKeyDetector: Detector = {
  name: "private-key",
  detect(input: ScanInput): DetectorFinding[] {
    const findings: DetectorFinding[] = [];
    for (const match of input.content.matchAll(privateKeyPattern)) {
      const value = match[0];
      const start = match.index ?? 0;
      findings.push({
        type: "private_key",
        value,
        confidence: 0.99,
        severity: "critical",
        range: { start, end: start + value.length },
        reason: "PEM private key block",
        detector: privateKeyDetector.name,
      });
    }
    return findings;
  },
};