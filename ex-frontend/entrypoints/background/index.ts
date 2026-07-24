import { defineBackground } from "wxt/utils/define-background";
import { createBackgroundSession } from "../../src/extension/background-session";
import type { CaptureStatusSnapshot, ExtensionMessage } from "../../src/extension/messages";

export default defineBackground(() => {
  const session = createBackgroundSession({
    createPreviewWindow,
    closePreviewWindow,
    sendStopCapture,
    broadcastStatus,
  });

  chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
    void session.handleMessage(message).then(sendResponse);
    return true;
  });

  chrome.windows.onRemoved.addListener(windowId => {
    session.onPreviewWindowRemoved(windowId);
  });

  function sendStopCapture(): Promise<void> {
    return chrome.runtime.sendMessage({ type: "STOP_CAPTURE" } satisfies ExtensionMessage).catch(() => undefined);
  }

  function closePreviewWindow(windowId: number): Promise<void> {
    return chrome.windows.remove(windowId).catch(() => undefined);
  }

  function broadcastStatus(snapshot: CaptureStatusSnapshot): void {
    chrome.runtime.sendMessage({ type: "CAPTURE_STATUS_CHANGED", snapshot } satisfies ExtensionMessage).catch(() => undefined);
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
