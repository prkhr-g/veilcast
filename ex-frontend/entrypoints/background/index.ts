import { defineBackground } from "wxt/utils/define-background";
import { ChromeCaptureAdapter } from "../../src/extension/capture/chrome-capture-adapter";
import type {
  CaptureError,
  CaptureStatusSnapshot,
  ExtensionMessage,
  MessageResponse,
} from "../../src/extension/messages";
import type { CaptureStatus } from "../../src/extension/session-status";

export default defineBackground(() => {
  const adapter = new ChromeCaptureAdapter();
  let status: CaptureStatus = "idle";
  let error: CaptureError | undefined;
  let previewWindowId: number | undefined;
  let pendingStreamId: string | undefined;

  chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
    void handleMessage(message).then(sendResponse);
    return true;
  });

  chrome.windows.onRemoved.addListener(windowId => {
    if (windowId !== previewWindowId) return;
    previewWindowId = undefined;
    pendingStreamId = undefined;
    if (status !== "idle") setStatus("idle");
  });

  async function handleMessage(message: ExtensionMessage): Promise<MessageResponse> {
    switch (message.type) {
      case "GET_CAPTURE_STATUS":
        return ok();
      case "START_SAFE_SHARING":
        return startSafeSharing();
      case "STOP_SAFE_SHARING":
        await stopSafeSharing();
        return ok();
      case "SAFE_PREVIEW_READY":
        return provideStreamIdToPreview();
      case "SAFE_PREVIEW_STREAM_STARTED":
        setStatus("active");
        return ok();
      case "SAFE_PREVIEW_STREAM_ENDED":
        setError({ code: "stream_ended", message: "The selected source window stopped sharing." });
        return ok();
      case "SAFE_PREVIEW_CLOSED":
        await stopSafeSharing(false);
        return ok();
      case "SAFE_PREVIEW_ERROR":
        setError(message.error);
        return ok();
      default:
        return ok();
    }
  }

  async function startSafeSharing(): Promise<MessageResponse> {
    if (status === "selecting" || status === "starting" || status === "active") {
      return fail({ code: "session_active", message: "A Safe Preview session is already running." });
    }

    setStatus("selecting");
    try {
      pendingStreamId = await adapter.requestWindowStreamId();
      setStatus("starting");
      const preview = await createPreviewWindow();
      previewWindowId = preview.id;
      return ok();
    } catch (caught) {
      pendingStreamId = undefined;
      const message = caught instanceof Error ? caught.message : "Capture could not be started.";
      setError({ code: message.includes("cancelled") ? "capture_cancelled" : "capture_api_error", message });
      return fail(error!);
    }
  }

  function provideStreamIdToPreview(): MessageResponse {
    if (!pendingStreamId) {
      const noStream = { code: "no_pending_stream", message: "No pending capture stream is available." } satisfies CaptureError;
      setError(noStream);
      return fail(noStream);
    }

    const streamId = pendingStreamId;
    pendingStreamId = undefined;
    return { ok: true, snapshot: snapshot(), streamId };
  }

  async function stopSafeSharing(closeWindow = true): Promise<void> {
    adapter.cancelPendingPicker();
    pendingStreamId = undefined;
    chrome.runtime.sendMessage({ type: "STOP_CAPTURE" } satisfies ExtensionMessage).catch(() => undefined);

    if (closeWindow && previewWindowId !== undefined) {
      const windowId = previewWindowId;
      previewWindowId = undefined;
      await chrome.windows.remove(windowId).catch(() => undefined);
    }

    setStatus("idle");
  }

  function setStatus(nextStatus: CaptureStatus): void {
    status = nextStatus;
    if (nextStatus !== "error") error = undefined;
    broadcastStatus();
  }

  function setError(nextError: CaptureError): void {
    error = nextError;
    status = "error";
    pendingStreamId = undefined;
    broadcastStatus();
  }

  function snapshot(): CaptureStatusSnapshot {
    return error ? { status, error } : { status };
  }

  function ok(): MessageResponse {
    return { ok: true, snapshot: snapshot() };
  }

  function fail(nextError: CaptureError): MessageResponse {
    return { ok: false, snapshot: snapshot(), error: nextError };
  }

  function broadcastStatus(): void {
    chrome.runtime.sendMessage({ type: "CAPTURE_STATUS_CHANGED", snapshot: snapshot() } satisfies ExtensionMessage).catch(() => undefined);
  }

  function createPreviewWindow(): Promise<chrome.windows.Window> {
    return new Promise((resolve, reject) => {
      chrome.windows.create(
        {
          url: chrome.runtime.getURL("/safe-preview.html"),
          type: "popup",
          focused: true,
          width: 1280,
          height: 800,
        },
        window => {
          const lastError = chrome.runtime.lastError;
          if (lastError || !window?.id) {
            reject(new Error(lastError?.message ?? "Safe Preview window could not be opened."));
            return;
          }
          resolve(window);
        },
      );
    });
  }
});
