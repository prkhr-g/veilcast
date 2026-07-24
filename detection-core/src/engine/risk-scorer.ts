import type { DetectionSeverity, DetectionType } from "../types/detection";

const severityByType: Record<DetectionType, DetectionSeverity> = {
  api_key: "critical",
  jwt: "critical",
  database_url: "critical",
  private_key: "critical",
  password: "high",
  credit_card: "high",
  email: "medium",
  phone: "medium",
  qr_code: "high",
};

export function defaultSeverity(type: DetectionType): DetectionSeverity {
  return severityByType[type];
}

export function severityScore(severity: DetectionSeverity): number {
  return { low: 1, medium: 2, high: 3, critical: 4 }[severity];
}
