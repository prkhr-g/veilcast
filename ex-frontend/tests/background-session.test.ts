import { describe, expect, test } from "bun:test";
import { createBackgroundSession, type BackgroundSessionApi } from "../src/extension/background-session";
import type { CaptureError, CaptureStatusSnapshot } from "../src/extension/messages";

function makeSession(options: { createFails?: boolean } = {}) {
  const closedWindows: number[] = [];
  const broadcasts: CaptureStatusSnapshot[] = [];
  let createdWindows = 0;
  let stopMessages = 0;

  const api: BackgroundSessionApi = {
    async createPreviewWindow() {
      createdWindows += 1;
      if (options.createFails) throw new Error("window failed");
      return { id: 7 };
    },
    async closePreviewWindow(windowId) {
      closedWindows.push(windowId);
    },
    async sendStopCapture() {
      stopMessages += 1;
    },
    broadcastStatus(snapshot) {
      broadcasts.push(snapshot);
    },
  };

  return {
    session: createBackgroundSession(api),
    closedWindows,
    broadcasts,
    createdWindows: () => createdWindows,
    stopMessages: () => stopMessages,
  };
}

const cancelled: CaptureError = { code: "capture_cancelled", message: "User cancelled capture selection" };

describe("background session lifecycle", () => {
  test("preview is not opened on extension startup", () => {
    const context = makeSession();

    expect(context.session.snapshot()).toEqual({ status: "idle" });
    expect(context.createdWindows()).toBe(0);
  });

  test("picker cancellation returns to Idle with the real error", async () => {
    const context = makeSession();

    await context.session.handleMessage({ type: "PREPARE_SAFE_SHARING" });
    const response = await context.session.handleMessage({ type: "CANCEL_SAFE_SHARING", error: cancelled });

    expect(response.snapshot).toEqual({ status: "idle", error: cancelled });
    expect(context.createdWindows()).toBe(0);
  });

  test("invalid or missing stream IDs do not open a preview", async () => {
    const context = makeSession();

    await context.session.handleMessage({ type: "PREPARE_SAFE_SHARING" });
    const response = await context.session.handleMessage({ type: "START_SAFE_SHARING", streamId: "  " });

    expect(response.ok).toBe(false);
    expect(response.snapshot.status).toBe("idle");
    expect(response.snapshot.error?.code).toBe("invalid_stream_id");
    expect(context.createdWindows()).toBe(0);
  });

  test("duplicate sessions are rejected", async () => {
    const context = makeSession();

    await context.session.handleMessage({ type: "PREPARE_SAFE_SHARING" });
    await context.session.handleMessage({ type: "START_SAFE_SHARING", streamId: "stream-1" });
    const response = await context.session.handleMessage({ type: "PREPARE_SAFE_SHARING" });

    if (response.ok) throw new Error("duplicate session was accepted");
    expect(response.error.code).toBe("session_active");
    expect(context.createdWindows()).toBe(1);
  });

  test("capture failure triggers cleanup", async () => {
    const context = makeSession();
    const captureError: CaptureError = { code: "capture_api_error", message: "getUserMedia failed" };

    await context.session.handleMessage({ type: "PREPARE_SAFE_SHARING" });
    await context.session.handleMessage({ type: "START_SAFE_SHARING", streamId: "stream-1" });
    await context.session.handleMessage({ type: "SAFE_PREVIEW_READY" });
    const response = await context.session.handleMessage({ type: "SAFE_PREVIEW_ERROR", error: captureError });

    expect(context.closedWindows).toEqual([7]);
    expect(response.snapshot).toEqual({ status: "idle", error: captureError });
  });
});


