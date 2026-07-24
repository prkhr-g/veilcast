import type { Detector, DetectorFinding, ScanInput } from "../../types/detection";

const databaseUrlPattern = /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/[^\s"'<>]+/gi;

export const databaseUrlDetector: Detector = {
  name: "database-url",
  detect(input: ScanInput): DetectorFinding[] {
    const findings: DetectorFinding[] = [];
    for (const match of input.content.matchAll(databaseUrlPattern)) {
      const value = match[0];
      const start = match.index ?? 0;
      findings.push({
        type: "database_url",
        value,
        confidence: 0.97,
        severity: "critical",
        range: { start, end: start + value.length },
        reason: "Database connection URL",
        detector: databaseUrlDetector.name,
      });
    }
    return findings;
  },
};