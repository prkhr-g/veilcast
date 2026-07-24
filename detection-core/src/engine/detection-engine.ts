import { apiKeyDetector } from "../detectors/secrets/api-key.detector";
import { databaseUrlDetector } from "../detectors/secrets/database-url.detector";
import { jwtDetector } from "../detectors/secrets/jwt.detector";
import { privateKeyDetector } from "../detectors/secrets/private-key.detector";
import { passwordDetector } from "../detectors/contextual/password.detector";
import { creditCardDetector } from "../detectors/pii/credit-card.detector";
import { emailDetector } from "../detectors/pii/email.detector";
import { phoneDetector } from "../detectors/pii/phone.detector";
import { deduplicateFindings } from "./deduplicator";
import { isValidFinding, validateScanInput } from "./validator";
import { maskValue } from "../utils/masking";
import type { Detection, Detector, ScanInput } from "../types/detection";

const defaultDetectors = [
  privateKeyDetector,
  jwtDetector,
  databaseUrlDetector,
  apiKeyDetector,
  passwordDetector,
  creditCardDetector,
  emailDetector,
  phoneDetector,
];

export class DetectionEngine {
  private readonly detectors = new Map<string, Detector>();
  private readonly disabled = new Set<string>();

  constructor(detectors: Detector[] = defaultDetectors) {
    for (const detector of detectors) this.registerDetector(detector);
  }

  registerDetector(detector: Detector): void {
    this.detectors.set(detector.name, detector);
    this.disabled.delete(detector.name);
  }

  disableDetector(name: string): void {
    this.disabled.add(name);
  }

  enableDetector(name: string): void {
    this.disabled.delete(name);
  }

  scan(rawInput: ScanInput): Detection[] {
    const input = validateScanInput(rawInput);
    if (input.content.length === 0) return [];

    const findings = [...this.detectors.values()]
      .filter(detector => !this.disabled.has(detector.name))
      .flatMap(detector => detector.detect(input))
      .filter(finding => isValidFinding(finding, input));

    return deduplicateFindings(findings).map(finding => {
      // Security: raw values are masked here and never copied into the public detection.
      const detection: Detection = {
        id: stableId(input, finding.detector, finding.type, finding.range.start, finding.range.end),
        type: finding.type,
        maskedValue: maskValue(finding.type, finding.value),
        confidence: Math.min(1, Math.max(0, finding.confidence * (input.confidence ?? 1))),
        severity: finding.severity,
        source: input.source,
        range: finding.range,
        reason: finding.reason,
        detector: finding.detector,
      };

      if (input.elementId) detection.elementId = input.elementId;
      if (input.bounds) detection.bounds = input.bounds;
      return detection;
    });
  }
}

function stableId(input: ScanInput, detector: string, type: string, start: number, end: number): string {
  return `det_${hash(`${input.source}:${input.elementId ?? ""}:${detector}:${type}:${start}:${end}`)}`;
}

function hash(value: string): string {
  let output = 2166136261;
  for (let index = 0; index < value.length; index++) {
    output ^= value.charCodeAt(index);
    output = Math.imul(output, 16777619);
  }
  return (output >>> 0).toString(36);
}

export const detectionEngine = new DetectionEngine();