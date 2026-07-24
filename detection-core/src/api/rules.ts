export type DetectionRule = {
  id: string;
  type: string;
  category: string;
  action: "mask" | "allow" | "review";
  enabled: boolean;
};

export const detectionRules: DetectionRule[] = [
  { id: "qr-payment", type: "qr_code", category: "payment", action: "mask", enabled: true },
  { id: "qr-authentication", type: "qr_code", category: "authentication", action: "mask", enabled: true },
  { id: "qr-wifi", type: "qr_code", category: "wifi", action: "mask", enabled: true },
  { id: "qr-contact", type: "qr_code", category: "contact", action: "mask", enabled: true },
  { id: "qr-url", type: "qr_code", category: "url", action: "allow", enabled: true },
  { id: "qr-unknown", type: "qr_code", category: "unknown", action: "review", enabled: true },
  { id: "text-secrets", type: "secret", category: "secret", action: "mask", enabled: true },
  { id: "text-pii", type: "pii", category: "pii", action: "mask", enabled: true },
];
