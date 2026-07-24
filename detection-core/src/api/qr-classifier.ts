import type { ApiDetectionResult } from "../api-results";

export type QrCategory = "payment" | "authentication" | "wifi" | "contact" | "url" | "unknown";

const maskedCategories = new Set<QrCategory>(["payment", "authentication", "wifi", "contact"]);

export function classifyQrPayload(payload: string): ApiDetectionResult {
  const category = qrCategory(payload);
  const sensitive = maskedCategories.has(category);

  return {
    type: "qr_code",
    category,
    sensitive,
    severity: category === "payment" || category === "authentication" ? "high" : sensitive ? "medium" : "low",
    confidence: 1,
    action: sensitive ? "mask" : category === "unknown" ? "review" : "allow",
    reason: qrReason(category),
  };
}

function qrCategory(payload: string): QrCategory {
  const trimmed = payload.trim();
  const lower = trimmed.toLowerCase();
  if (lower.startsWith("upi://pay")) return "payment";
  if (lower.startsWith("otpauth://")) return "authentication";
  if (trimmed.startsWith("WIFI:")) return "wifi";
  if (trimmed.startsWith("BEGIN:VCARD")) return "contact";
  if (lower.startsWith("http://") || lower.startsWith("https://")) return "url";
  return "unknown";
}

function qrReason(category: QrCategory): string {
  return {
    payment: "QR payload is a payment URI",
    authentication: "QR payload is an authentication secret URI",
    wifi: "QR payload contains Wi-Fi connection details",
    contact: "QR payload contains contact details",
    url: "QR payload is a URL",
    unknown: "QR payload format is unknown",
  }[category];
}
