import type { Detector, DetectorFinding, ScanInput } from "../../types/detection";

const jwtPattern = /\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\b/g;

export const jwtDetector: Detector = {
  name: "jwt",
  detect(input: ScanInput): DetectorFinding[] {
    const findings: DetectorFinding[] = [];
    for (const match of input.content.matchAll(jwtPattern)) {
      const value = match[0];
      if (!looksLikeJwt(value)) continue;
      const start = match.index ?? 0;
      findings.push({
        type: "jwt",
        value,
        confidence: 0.98,
        severity: "critical",
        range: { start, end: start + value.length },
        reason: "JWT token with decodable JSON header and payload",
        detector: jwtDetector.name,
      });
    }
    return findings;
  },
};

function looksLikeJwt(value: string): boolean {
  const [header, payload] = value.split(".");
  return Boolean(header && payload && safeJson(header) && safeJson(payload));
}

function safeJson(value: string): unknown {
  try {
    return JSON.parse(atob(value.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return undefined;
  }
}