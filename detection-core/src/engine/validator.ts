import type { DetectorFinding, ScanInput } from "../types/detection";

export function validateScanInput(input: ScanInput): ScanInput {
  if ((input.source !== "dom" && input.source !== "ocr") || typeof input.content !== "string") {
    throw new TypeError("scan input requires source and string content");
  }

  const hasImageFields = input.imageData || input.imageWidth !== undefined || input.imageHeight !== undefined;
  if (hasImageFields) {
    if (
      !(input.imageData instanceof Uint8ClampedArray) ||
      !Number.isInteger(input.imageWidth) ||
      !Number.isInteger(input.imageHeight) ||
      input.imageWidth <= 0 ||
      input.imageHeight <= 0 ||
      input.imageData.length !== input.imageWidth * input.imageHeight * 4
    ) {
      throw new TypeError("image scans require RGBA imageData and positive imageWidth/imageHeight");
    }
  }

  return input;
}

export function isValidFinding(finding: DetectorFinding, input: ScanInput): boolean {
  const isImageQrFinding = finding.type === "qr_code" && Boolean(input.imageData);
  return (
    (isImageQrFinding || (
      finding.range.start >= 0 &&
      finding.range.end > finding.range.start &&
      finding.range.end <= input.content.length
    )) &&
    Number.isFinite(finding.confidence) &&
    finding.confidence >= 0 &&
    finding.confidence <= 1 &&
    finding.value.length > 0
  );
}
