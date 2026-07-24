import type { ProtectionSettings } from "./protection-settings";

export type ProtectionRegion = {
  id: string;
  type: "secret" | "email" | "phone" | "face" | "photo" | "qr";
  x: number;
  y: number;
  width: number;
  height: number;
  confidence?: number;
  label?: string;
  effect: "blur" | "pixelate" | "cover";
};

export type Size = {
  width: number;
  height: number;
};

export type VideoBounds = Size & {
  x: number;
  y: number;
  scale: number;
};

export type MappedProtectionRegion = {
  id: string;
  type: ProtectionRegion["type"];
  effect: ProtectionRegion["effect"];
  label?: string;
  left: number;
  top: number;
  width: number;
  height: number;
};

export function getContainedVideoBounds(source: Size, container: Size): VideoBounds {
  if (source.width <= 0 || source.height <= 0 || container.width <= 0 || container.height <= 0) {
    return { x: 0, y: 0, width: 0, height: 0, scale: 0 };
  }

  const scale = Math.min(container.width / source.width, container.height / source.height);
  const width = source.width * scale;
  const height = source.height * scale;

  return {
    x: (container.width - width) / 2,
    y: (container.height - height) / 2,
    width,
    height,
    scale,
  };
}

export function mapRegionToPreview(region: ProtectionRegion, source: Size, container: Size): MappedProtectionRegion {
  const bounds = getContainedVideoBounds(source, container);

  return {
    id: region.id,
    type: region.type,
    effect: region.effect,
    label: region.label,
    left: bounds.x + region.x * bounds.scale,
    top: bounds.y + region.y * bounds.scale,
    width: region.width * bounds.scale,
    height: region.height * bounds.scale,
  };
}

export function createDebugProtectionRegions(source: Size, settings: ProtectionSettings): ProtectionRegion[] {
  const regions: ProtectionRegion[] = [
    {
      id: "debug-secret",
      type: "secret",
      x: Math.round(source.width * 0.11),
      y: Math.round(source.height * 0.16),
      width: Math.round(source.width * 0.34),
      height: Math.round(source.height * 0.09),
      label: "SECRET",
      confidence: 0.99,
      effect: "cover",
    },
    {
      id: "debug-face",
      type: "face",
      x: Math.round(source.width * 0.62),
      y: Math.round(source.height * 0.14),
      width: Math.round(source.width * 0.16),
      height: Math.round(source.height * 0.24),
      label: "FACE",
      confidence: 0.92,
      effect: "blur",
    },
    {
      id: "debug-phone",
      type: "phone",
      x: Math.round(source.width * 0.5),
      y: Math.round(source.height * 0.68),
      width: Math.round(source.width * 0.26),
      height: Math.round(source.height * 0.08),
      label: "PHONE",
      confidence: 0.96,
      effect: "pixelate",
    },
  ];

  return regions.filter(region => settings[region.type]);
}
