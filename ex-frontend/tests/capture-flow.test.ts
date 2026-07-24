import { afterEach, describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { ChromeCaptureAdapter } from "../src/extension/capture/chrome-capture-adapter";

const popupSource = readFileSync(new URL("../entrypoints/popup/main.tsx", import.meta.url), "utf8");
const backgroundSource = readFileSync(new URL("../entrypoints/background/index.ts", import.meta.url), "utf8");

const originalChrome = globalThis.chrome;

afterEach(() => {
  globalThis.chrome = originalChrome;
});

describe("Chrome capture flow", () => {
  test("initiates the picker from the popup", () => {
    expect(popupSource).toContain("new ChromeCaptureAdapter");
    expect(popupSource).toContain("requestWindowStreamId");
  });

  test("does not call desktopCapture from the service worker", () => {
    expect(backgroundSource).not.toContain("ChromeCaptureAdapter");
    expect(backgroundSource).not.toContain("chooseDesktopMedia");
    expect(backgroundSource).not.toContain("desktopCapture");
  });

  test("treats empty stream IDs as picker cancellation", async () => {
    globalThis.chrome = {
      runtime: {},
      desktopCapture: {
        chooseDesktopMedia(_sources: string[], callback: (streamId: string) => void) {
          callback("");
          return 1;
        },
        cancelChooseDesktopMedia() {},
      },
    } as unknown as typeof chrome;

    await expect(new ChromeCaptureAdapter().requestWindowStreamId()).rejects.toThrow("User cancelled capture selection");
  });

  test("keeps duplicate sessions blocked in the background", () => {
    expect(backgroundSource).toContain('status === "selecting" || status === "starting" || status === "active"');
    expect(backgroundSource).toContain('code: "session_active"');
  });
});
