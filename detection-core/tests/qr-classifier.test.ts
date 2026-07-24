import { describe, expect, test } from "bun:test";
import type { DetectionAction } from "../src/api-results";
import { classifyQrPayload } from "../src/index";

const qrCases: ReadonlyArray<readonly [string, string, DetectionAction]> = [
  ["upi://pay?pa=user@bank", "payment", "mask"],
  ["otpauth://totp/App?secret=ABC", "authentication", "mask"],
  ["WIFI:T:WPA;S:Home;P:secret;;", "wifi", "mask"],
  ["BEGIN:VCARD\nFN:Example\nEND:VCARD", "contact", "mask"],
  ["https://example.com", "url", "allow"],
];

describe("QR classification", () => {
  test.each(qrCases)("classifies %s", (payload, category, action) => {
    const result = classifyQrPayload(payload);
    expect(result.type).toBe("qr_code");
    expect(result.category).toBe(category);
    expect(result.action).toBe(action);
    expect(result).not.toHaveProperty("payload");
  });
});
