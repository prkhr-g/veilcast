import type { CaptureStatus } from "./session-status";

export type CaptureErrorCode =
  | "capture_cancelled"
  | "capture_denied"
  | "capture_api_error"
  | "preview_unavailable"
  | "session_active"
  | "no_pending_stream"
  | "stream_ended";

export type CaptureError = {
  code: CaptureErrorCode;
  message: string;
};

export type CaptureStatusSnapshot = {
  status: CaptureStatus;
  error?: CaptureError;
};

export type PopupToBackgroundMessage =
  | { type: "GET_CAPTURE_STATUS" }
  | { type: "PREPARE_SAFE_SHARING" }
  | { type: "START_SAFE_SHARING"; streamId: string }
  | { type: "CANCEL_SAFE_SHARING"; error?: CaptureError }
  | { type: "STOP_SAFE_SHARING" };

export type PreviewToBackgroundMessage =
  | { type: "SAFE_PREVIEW_READY" }
  | { type: "SAFE_PREVIEW_STREAM_STARTED" }
  | { type: "SAFE_PREVIEW_STREAM_ENDED" }
  | { type: "SAFE_PREVIEW_CLOSED" }
  | { type: "SAFE_PREVIEW_ERROR"; error: CaptureError };

export type BackgroundBroadcastMessage =
  | { type: "CAPTURE_STATUS_CHANGED"; snapshot: CaptureStatusSnapshot }
  | { type: "STOP_CAPTURE" };

export type ExtensionMessage = PopupToBackgroundMessage | PreviewToBackgroundMessage | BackgroundBroadcastMessage;

export type MessageResponse =
  | { ok: true; snapshot: CaptureStatusSnapshot; streamId?: string }
  | { ok: false; snapshot: CaptureStatusSnapshot; error: CaptureError };
