import type { DetectorFinding, ScanInput } from "../types/detection";

export function validateScanInput(input: ScanInput): ScanInput {
  if (!["dom", "ocr", "context"].includes(input.source) || typeof input.content !== "string") {
    throw new TypeError("scan input requires source and string content");
  }

  return input;
}

export function isValidFinding(finding: DetectorFinding, input: ScanInput): boolean {
  return (
    finding.range.start >= 0 &&
    finding.range.end > finding.range.start &&
    finding.range.end <= input.content.length &&
    Number.isFinite(finding.confidence) &&
    finding.confidence >= 0 &&
    finding.confidence <= 1 &&
    finding.value.length > 0
  );
}
