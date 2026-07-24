import type { Detection } from "./types/detection";

export type DetectionAction = "mask" | "allow" | "review";

export type ApiDetectionResult = {
  type: string;
  category: string;
  sensitive: boolean;
  severity: "low" | "medium" | "high" | "critical";
  confidence: number;
  action: DetectionAction;
  reason: string;
};

const categoryByType: Record<string, string> = {
  api_key: "secret",
  jwt: "secret",
  database_url: "secret",
  private_key: "secret",
  password: "secret",
  email: "pii",
  phone: "pii",
  credit_card: "payment",
  qr_code: "qr",
  chats: "chat",
  ip: "ip",
};

export function toApiDetectionResult(detection: Detection): ApiDetectionResult {
  return {
    type: detection.type,
    category: categoryByType[detection.type] ?? "unknown",
    sensitive: detection.severity !== "low",
    severity: detection.severity,
    confidence: detection.confidence,
    action: detection.severity === "low" ? "review" : "mask",
    reason: detection.reason,
  };
}
