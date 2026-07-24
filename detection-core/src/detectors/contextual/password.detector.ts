import type { Detector, DetectorFinding, ScanInput } from "../../types/detection";

const passwordPattern =
  /\b(?:password|passwd|pwd|secret)\s*[:=]\s*["']?([^\s"',;<>]{6,})["']?|\bAuthorization\s*:\s*Bearer\s+([A-Za-z0-9._~+/=-]{12,})/gi;

export const passwordDetector: Detector = {
  name: "password",
  detect(input: ScanInput): DetectorFinding[] {
    const findings: DetectorFinding[] = [];
    for (const match of input.content.matchAll(passwordPattern)) {
      const value = match[1] ?? match[2];
      if (!value) continue;
      const start = (match.index ?? 0) + match[0].indexOf(value);
      findings.push({
        type: "password",
        value,
        confidence: 0.9,
        severity: "high",
        range: { start, end: start + value.length },
        reason: "Sensitive assignment or authorization header",
        detector: passwordDetector.name,
      });
    }
    return findings;
  },
};