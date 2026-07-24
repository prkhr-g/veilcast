import type { CaptureAdapter } from "./capture-adapter";

export class ChromeCaptureAdapter implements CaptureAdapter {
  private pendingRequestId: number | undefined;

  requestWindowStreamId(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!chrome.desktopCapture?.chooseDesktopMedia) {
        reject(new Error("Chrome desktop capture API is unavailable"));
        return;
      }

      this.pendingRequestId = chrome.desktopCapture.chooseDesktopMedia(["window"], streamId => {
        this.pendingRequestId = undefined;
        const lastError = chrome.runtime.lastError;
        if (lastError) {
          reject(new Error(lastError.message));
          return;
        }
        if (!streamId) {
          reject(new Error("User cancelled capture selection"));
          return;
        }
        resolve(streamId);
      });
    });
  }

  cancelPendingPicker(): void {
    if (this.pendingRequestId === undefined) return;
    chrome.desktopCapture.cancelChooseDesktopMedia(this.pendingRequestId);
    this.pendingRequestId = undefined;
  }
}
