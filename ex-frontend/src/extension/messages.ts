export type DetectionRegionType =
  | "api-key"
  | "password"
  | "token"
  | "email"
  | "phone"
  | "credit-card"
  | "private-key"
  | "sensitive-text"
  | "unknown";

export type DetectionRegion = {
  id: string;
  type: DetectionRegionType;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  label?: string;
};

export type ShieldState = {
  enabled: boolean;
  regionCount: number;
};

export type VielCastMessage =
  | { type: "VIELCAST_ENABLE_SHIELD" }
  | { type: "VIELCAST_DISABLE_SHIELD" }
  | { type: "VIELCAST_TOGGLE_SHIELD" }
  | { type: "VIELCAST_GET_SHIELD_STATE" }
  | { type: "VIELCAST_UPDATE_REGIONS"; regions: DetectionRegion[] };

export type VielCastMessageResponse =
  | { ok: true; state: ShieldState }
  | { ok: false; error: string; state?: ShieldState };

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;

  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown error";
  }
}

export function normalizeDetectionRegion(region: DetectionRegion, viewport: { width: number; height: number }): DetectionRegion | undefined {
  if (
    !region.id ||
    !Number.isFinite(region.x) ||
    !Number.isFinite(region.y) ||
    !Number.isFinite(region.width) ||
    !Number.isFinite(region.height) ||
    !Number.isFinite(region.confidence) ||
    region.width <= 0 ||
    region.height <= 0 ||
    region.confidence < 0 ||
    region.confidence > 1
  ) {
    return undefined;
  }

  const x = Math.max(0, Math.min(viewport.width, region.x));
  const y = Math.max(0, Math.min(viewport.height, region.y));
  const right = Math.max(0, Math.min(viewport.width, region.x + region.width));
  const bottom = Math.max(0, Math.min(viewport.height, region.y + region.height));
  const width = right - x;
  const height = bottom - y;
  if (width <= 0 || height <= 0) return undefined;

  return { ...region, x, y, width, height };
}
