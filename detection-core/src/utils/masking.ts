import type { DetectionType } from "../types/detection";

export function maskValue(type: DetectionType, value: string): string {
  if (type === "private_key" || type === "database_url") return "********";
  if (type === "email") return maskEmail(value);
  if (type === "phone" || type === "credit_card") return maskTrailingDigits(value);
  return maskSecret(value);
}

function maskEmail(value: string): string {
  const [local, domain] = value.split("@");
  if (!local || !domain) return maskSecret(value);
  return `${local[0]}${"•".repeat(Math.max(3, local.length - 1))}@${domain}`;
}

function maskTrailingDigits(value: string): string {
  const digits = value.replace(/\D/g, "");
  const tail = digits.slice(-4);
  return `${"*".repeat(Math.max(6, digits.length - tail.length))}${tail}`;
}

function maskSecret(value: string): string {
  if (value.length <= 8) return "•".repeat(value.length);
  return `${value.slice(0, 4)}${"•".repeat(6)}${value.slice(-4)}`;
}