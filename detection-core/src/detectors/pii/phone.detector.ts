import type { Detector, DetectorFinding, ScanInput } from "../../types/detection";

const phonePattern = /(?<![\w])(?:\+91[\s-]?)?[6-9]\d{9}(?![\w])|(?<![\w])\+\d{1,3}[\s-]?(?:\(?\d{2,4}\)?[\s-]?){2,4}\d{3,4}(?![\w])/g;

export const phoneDetector: Detector = {
  name: "phone",
  detect(input: ScanInput): DetectorFinding[] {
    const findings: DetectorFinding[] = [];
    for (const match of input.content.matchAll(phonePattern)) {
      const value = match[0];
      const digits = value.replace(/\D/g, "");
      if (digits.length < 10 || digits.length > 15) continue;
      const isIndianMobile = /^(?:91)?[6-9]\d{9}$/.test(digits);
      const isInternational = value.trim().startsWith("+") && /[\s()-]/.test(value);
      if (!isIndianMobile && !isInternational) continue;
      const start = match.index ?? 0;
      findings.push({
        type: "phone",
        value,
        confidence: isIndianMobile ? 0.9 : 0.82,
        severity: "medium",
        range: { start, end: start + value.length },
        reason: "Phone number format",
        detector: phoneDetector.name,
      });
    }
    return findings;
  },
};