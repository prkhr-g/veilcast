import type { Detector, DetectorFinding, ScanInput } from "../../types/detection";

const cardPattern = /(?<!\d)(?:\d[ -]?){13,19}(?!\d)/g;

export const creditCardDetector: Detector = {
  name: "credit-card",
  detect(input: ScanInput): DetectorFinding[] {
    const findings: DetectorFinding[] = [];
    for (const match of input.content.matchAll(cardPattern)) {
      const value = match[0].trim();
      const digits = value.replace(/\D/g, "");
      if (digits.length < 13 || digits.length > 19 || !passesLuhn(digits)) continue;
      const start = (match.index ?? 0) + match[0].indexOf(value);
      findings.push({
        type: "credit_card",
        value,
        confidence: 0.95,
        severity: "high",
        range: { start, end: start + value.length },
        reason: "Luhn-valid credit-card candidate",
        detector: creditCardDetector.name,
      });
    }
    return findings;
  },
};

export function passesLuhn(digits: string): boolean {
  let sum = 0;
  let doubleDigit = false;

  for (let index = digits.length - 1; index >= 0; index--) {
    const char = digits[index];
    if (!char) return false;
    let value = Number(char);
    if (doubleDigit) {
      value *= 2;
      if (value > 9) value -= 9;
    }
    sum += value;
    doubleDigit = !doubleDigit;
  }

  return sum > 0 && sum % 10 === 0;
}