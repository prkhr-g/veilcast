import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { normalizeDetectionRegion } from "../src/extension/messages";

const popupSource = readFileSync(new URL("../entrypoints/popup/main.tsx", import.meta.url), "utf8");
const contentSource = readFileSync(new URL("../entrypoints/content.ts", import.meta.url), "utf8");
const configSource = readFileSync(new URL("../wxt.config.ts", import.meta.url), "utf8");

describe("Safe Share DOM shield", () => {
  test("does not use screen-capture APIs", () => {
    const combined = `${popupSource}\n${contentSource}\n${configSource}`;

    expect(combined).not.toContain("getDisplayMedia");
    expect(combined).not.toContain("desktopCapture");
    expect(combined).not.toContain("tabCapture");
    expect(combined).not.toContain("captureStream");
    expect(combined).not.toContain("MediaStream");
  });


  test("includes browser QR image detection", () => {
    expect(contentSource).toContain("BarcodeDetector");
    expect(contentSource).toContain('type: "qr-code"');
  });

  test("uses only the required permissions", () => {
    expect(configSource).toContain('permissions: ["activeTab", "scripting", "storage"]');
  });

  test("normalizes viewport-relative detection regions", () => {
    expect(
      normalizeDetectionRegion(
        {
          id: "r1",
          type: "api-key",
          x: -10,
          y: 20,
          width: 30,
          height: 40,
          confidence: 0.9,
        },
        { width: 100, height: 100 },
      ),
    ).toMatchObject({ x: 0, y: 20, width: 20, height: 40 });
  });

  test("rejects malformed detection regions", () => {
    expect(
      normalizeDetectionRegion(
        {
          id: "bad",
          type: "email",
          x: 0,
          y: 0,
          width: 0,
          height: 10,
          confidence: 0.5,
        },
        { width: 100, height: 100 },
      ),
    ).toBeUndefined();
  });
});
