import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { CaptureStatusSnapshot, ExtensionMessage, MessageResponse } from "../../src/extension/messages";
import { canStartSharing, canStopSharing, statusText } from "../../src/extension/session-status";
import "./style.css";

const initialSnapshot: CaptureStatusSnapshot = { status: "idle" };

function Popup() {
  const [snapshot, setSnapshot] = useState<CaptureStatusSnapshot>(initialSnapshot);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void sendMessage({ type: "GET_CAPTURE_STATUS" }).then(response => setSnapshot(response.snapshot));

    const listener = (message: ExtensionMessage) => {
      if (message.type === "CAPTURE_STATUS_CHANGED") setSnapshot(message.snapshot);
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  async function startSharing() {
    setBusy(true);
    try {
      const response = await sendMessage({ type: "START_SAFE_SHARING" });
      setSnapshot(response.snapshot);
    } finally {
      setBusy(false);
    }
  }

  async function stopSharing() {
    setBusy(true);
    try {
      const response = await sendMessage({ type: "STOP_SAFE_SHARING" });
      setSnapshot(response.snapshot);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="popup-shell">
      <section className="brand-row" aria-label="VeilCast">
        <div className="brand-mark">VC</div>
        <div>
          <h1>VeilCast</h1>
          <p>Safe Preview</p>
        </div>
      </section>

      <section className={`status-panel status-${snapshot.status}`}>
        <span className="status-dot" />
        <div>
          <p className="eyebrow">Current status</p>
          <strong>{statusText(snapshot.status)}</strong>
        </div>
      </section>

      {snapshot.error ? <p className="error-text">{snapshot.error.message}</p> : <p className="hint-text">Capture stays local. No frames are sent to VeilCast APIs.</p>}

      <div className="button-row">
        <button className="primary-button" type="button" disabled={busy || !canStartSharing(snapshot.status)} onClick={startSharing}>
          Start Safe Sharing
        </button>
        <button className="secondary-button" type="button" disabled={busy || !canStopSharing(snapshot.status)} onClick={stopSharing}>
          Stop Sharing
        </button>
      </div>
    </main>
  );
}

function sendMessage(message: ExtensionMessage): Promise<MessageResponse> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, response => {
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        reject(new Error(lastError.message));
        return;
      }
      resolve(response as MessageResponse);
    });
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Popup />
  </StrictMode>,
);
