import type { CaptureError, CaptureStatusSnapshot, ExtensionMessage, MessageResponse } from "./messages";
import type { CaptureStatus } from "./session-status";

type PreviewWindow = {
  id?: number;
};

export type BackgroundSessionApi = {
  createPreviewWindow(): Promise<PreviewWindow>;
  closePreviewWindow(windowId: number): Promise<void>;
  sendStopCapture(): Promise<void>;
  broadcastStatus(snapshot: CaptureStatusSnapshot): void;
};

export function createBackgroundSession(api: BackgroundSessionApi) {
  let status: CaptureStatus = "idle";
  let error: CaptureError | undefined;
  let previewWindowId: number | undefined;
  let pendingStreamId: string | undefined;

  async function handleMessage(message: ExtensionMessage): Promise<MessageResponse> {
    switch (message.type) {
      case "GET_CAPTURE_STATUS":
        return ok();
      case "PREPARE_SAFE_SHARING":
        return prepareSafeSharing();
      case "START_SAFE_SHARING":
        return startSafeSharing(message.streamId);
      case "CANCEL_SAFE_SHARING":
        setIdle(message.error);
        return ok();
      case "STOP_SAFE_SHARING":
        await cleanup({ closeWindow: true, notifyPreview: true });
        setIdle();
        return ok();
      case "SAFE_PREVIEW_READY":
        return provideStreamIdToPreview();
      case "SAFE_PREVIEW_STREAM_STARTED":
        setStatus("active");
        return ok();
      case "SAFE_PREVIEW_STREAM_ENDED": {
        const streamEnded = { code: "stream_ended", message: "The selected source window stopped sharing." } satisfies CaptureError;
        await cleanup({ closeWindow: true, notifyPreview: false });
        setIdle(streamEnded);
        return ok();
      }
      case "SAFE_PREVIEW_CLOSED":
        if (previewWindowId === undefined) return ok();
        await cleanup({ closeWindow: false, notifyPreview: false });
        setIdle();
        return ok();
      case "SAFE_PREVIEW_ERROR":
        await cleanup({ closeWindow: true, notifyPreview: false });
        setIdle(message.error);
        return ok();
      case "CAPTURE_STATUS_CHANGED":
      case "STOP_CAPTURE":
        return ok();
    }
  }

  function onPreviewWindowRemoved(windowId: number): void {
    if (windowId !== previewWindowId) return;
    previewWindowId = undefined;
    pendingStreamId = undefined;
    setIdle();
  }

  function prepareSafeSharing(): MessageResponse {
    if (status !== "idle" || previewWindowId !== undefined) {
      return fail({ code: "session_active", message: "A Safe Preview session is already running." });
    }

    error = undefined;
    pendingStreamId = undefined;
    setStatus("selecting");
    return ok();
  }

  async function startSafeSharing(streamId: string): Promise<MessageResponse> {
    if (status !== "selecting" || previewWindowId !== undefined) {
      return fail({ code: "session_active", message: "A Safe Preview session is already running." });
    }

    const safeStreamId = streamId.trim();
    if (!safeStreamId) {
      const invalidStream = { code: "invalid_stream_id", message: "No valid window stream was selected." } satisfies CaptureError;
      setIdle(invalidStream);
      return fail(invalidStream);
    }

    pendingStreamId = safeStreamId;
    setStatus("starting");

    try {
      const preview = await api.createPreviewWindow();
      if (preview.id === undefined) throw new Error("Safe Preview window could not be opened.");
      previewWindowId = preview.id;
      return ok();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Safe Preview window could not be opened.";
      const nextError = { code: "preview_unavailable", message } satisfies CaptureError;
      await cleanup({ closeWindow: false, notifyPreview: false });
      setIdle(nextError);
      return fail(nextError);
    }
  }

  async function provideStreamIdToPreview(): Promise<MessageResponse> {
    if (!pendingStreamId) {
      const noStream = { code: "no_pending_stream", message: "No pending capture stream is available." } satisfies CaptureError;
      await cleanup({ closeWindow: true, notifyPreview: false });
      setIdle(noStream);
      return fail(noStream);
    }

    const streamId = pendingStreamId;
    pendingStreamId = undefined;
    return { ok: true, snapshot: snapshot(), streamId };
  }

  async function cleanup(options: { closeWindow: boolean; notifyPreview: boolean }): Promise<void> {
    pendingStreamId = undefined;
    if (options.notifyPreview) await api.sendStopCapture().catch(() => undefined);

    if (options.closeWindow && previewWindowId !== undefined) {
      const windowId = previewWindowId;
      previewWindowId = undefined;
      await api.closePreviewWindow(windowId).catch(() => undefined);
    }

    if (!options.closeWindow) previewWindowId = undefined;
  }

  function setStatus(nextStatus: CaptureStatus): void {
    status = nextStatus;
    api.broadcastStatus(snapshot());
  }

  function setIdle(nextError?: CaptureError): void {
    status = "idle";
    error = nextError;
    api.broadcastStatus(snapshot());
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

  return {
    handleMessage,
    onPreviewWindowRemoved,
    snapshot,
  };
}



