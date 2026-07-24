import { describe, expect, test } from "bun:test";
import { createDebugProtectionRegions, mapRegionToPreview, type ProtectionRegion } from "../src/extension/overlay";
import type { ProtectionSettings } from "../src/extension/protection-settings";

const region: ProtectionRegion = {
  id: "r1",
  type: "secret",
  x: 100,
  y: 50,
  width: 200,
  height: 100,
  effect: "cover",
};

const allEnabled: ProtectionSettings = {
  secret: true,
  email: true,
  phone: true,
  face: true,
  photo: true,
  qr: true,
};

describe("overlay coordinate mapping", () => {
  test("maps with no letterboxing", () => {
    expect(mapRegionToPreview(region, { width: 1000, height: 500 }, { width: 2000, height: 1000 })).toMatchObject({
      left: 200,
      top: 100,
      width: 400,
      height: 200,
    });
  });

  test("maps with horizontal letterboxing", () => {
    expect(mapRegionToPreview(region, { width: 1000, height: 500 }, { width: 1000, height: 1000 })).toMatchObject({
      left: 100,
      top: 300,
      width: 200,
      height: 100,
    });
  });

  test("maps with vertical letterboxing", () => {
    expect(mapRegionToPreview(region, { width: 500, height: 1000 }, { width: 1000, height: 1000 })).toMatchObject({
      left: 350,
      top: 50,
      width: 200,
      height: 100,
    });
  });

  test("disabled categories do not render mock regions", () => {
    const regions = createDebugProtectionRegions(
      { width: 1000, height: 500 },
      { ...allEnabled, secret: false, phone: false },
    );

    expect(regions.map(item => item.label)).toEqual(["FACE"]);
  });
});
