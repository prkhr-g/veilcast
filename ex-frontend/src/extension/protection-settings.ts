import type { ProtectionRegion } from "./overlay";

export type ProtectionCategory = ProtectionRegion["type"];

export type ProtectionSettings = Record<ProtectionCategory, boolean>;

export const PROTECTION_SETTINGS_KEY = "veilcast.protectionSettings";

export const DEFAULT_PROTECTION_SETTINGS: ProtectionSettings = {
  secret: true,
  email: true,
  phone: true,
  face: true,
  photo: true,
  qr: true,
};

export function normalizeProtectionSettings(value: unknown): ProtectionSettings {
  if (!value || typeof value !== "object") return DEFAULT_PROTECTION_SETTINGS;
  const stored = value as Partial<Record<ProtectionCategory, unknown>>;

  return {
    secret: typeof stored.secret === "boolean" ? stored.secret : DEFAULT_PROTECTION_SETTINGS.secret,
    email: typeof stored.email === "boolean" ? stored.email : DEFAULT_PROTECTION_SETTINGS.email,
    phone: typeof stored.phone === "boolean" ? stored.phone : DEFAULT_PROTECTION_SETTINGS.phone,
    face: typeof stored.face === "boolean" ? stored.face : DEFAULT_PROTECTION_SETTINGS.face,
    photo: typeof stored.photo === "boolean" ? stored.photo : DEFAULT_PROTECTION_SETTINGS.photo,
    qr: typeof stored.qr === "boolean" ? stored.qr : DEFAULT_PROTECTION_SETTINGS.qr,
  };
}
