import type { Detector, DetectorFinding, ScanInput } from "../../types/detection";

type SecretPattern = {
  reason: string;
  regex: RegExp;
  capture?: number;
};

const patterns: SecretPattern[] = [
  { reason: "OpenAI-style secret key", regex: /\bsk-[A-Za-z0-9_-]{20,}\b/g },
  { reason: "GitHub token", regex: /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g },
  { reason: "AWS access key ID", regex: /\bAKIA[0-9A-Z]{16}\b/g },
  { reason: "Stripe API key", regex: /\b[rs]k_(?:live|test)_[A-Za-z0-9]{16,}\b/g },
  { reason: "Bearer token", regex: /\bBearer\s+([A-Za-z0-9._~+/=-]{20,})\b/g, capture: 1 },
  {
    reason: "High-confidence secret assignment",
    regex: /\b(?:api[_-]?key|token|access[_-]?token|client[_-]?secret)\s*[:=]\s*["']?([A-Za-z0-9._~+/=-]{12,})["']?/gi,
    capture: 1,
  },
];

export const apiKeyDetector: Detector = {
  name: "api-key",
  detect(input: ScanInput): DetectorFinding[] {
    const findings: DetectorFinding[] = [];
    for (const pattern of patterns) {
      for (const match of input.content.matchAll(pattern.regex)) {
        const value = pattern.capture ? match[pattern.capture] : match[0];
        if (!value || value.length < 12) continue;
        const start = pattern.capture ? (match.index ?? 0) + match[0].indexOf(value) : (match.index ?? 0);
        findings.push({
          type: "api_key",
          value,
          confidence: 0.95,
          severity: "critical",
          range: { start, end: start + value.length },
          reason: pattern.reason,
          detector: apiKeyDetector.name,
        });
      }
    }
    return findings;
  },
};