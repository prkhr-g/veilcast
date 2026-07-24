import { StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { ChromeCaptureAdapter } from "../../src/extension/capture/chrome-capture-adapter";
import type { CaptureError, CaptureStatusSnapshot, ExtensionMessage, MessageResponse } from "../../src/extension/messages";
import type { ProtectionCategory, ProtectionSettings } from "../../src/extension/protection-settings";
import {
  DEFAULT_PROTECTION_SETTINGS,
  PROTECTION_SETTINGS_KEY,
  normalizeProtectionSettings,
} from "../../src/extension/protection-settings";
import { canStartSharing, canStopSharing, statusText } from "../../src/extension/session-status";
import "./style.css";

const initialSnapshot: CaptureStatusSnapshot = { status: "idle" };

const protectionOptions: { key: ProtectionCategory; label: string }[] = [
  { key: "secret", label: "Secrets" },
  { key: "email", label: "Emails" },
  { key: "phone", label: "Phone numbers" },
  { key: "face", label: "Faces" },
  { key: "photo", label: "Photos" },
  { key: "qr", label: "QR codes" },
];

function Popup() {
  const captureAdapter = useMemo(() => new ChromeCaptureAdapter(), []);
  const [snapshot, setSnapshot] = useState<CaptureStatusSnapshot>(initialSnapshot);
  const [settings, setSettings] = useState<ProtectionSettings>(DEFAULT_PROTECTION_SETTINGS);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void sendMessage({ type: "GET_CAPTURE_STATUS" }).then(response => setSnapshot(response.snapshot));
    void loadProtectionSettings().then(setSettings);

    const listener = (message: ExtensionMessage) => {
      if (message.type === "CAPTURE_STATUS_CHANGED") setSnapshot(message.snapshot);
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  async function startSharing() {
    setBusy(true);
    try {
      await saveProtectionSettings(settings);
      const prepared = await sendMessage({ type: "PREPARE_SAFE_SHARING" });
      setSnapshot(prepared.snapshot);
      if (!prepared.ok) return;

      const streamId = await captureAdapter.requestWindowStreamId();
      const response = await sendMessage({ type: "START_SAFE_SHARING", streamId });
      setSnapshot(response.snapshot);
    } catch (caught) {
      const error = captureError(caught);
      const response = await sendMessage({ type: "CANCEL_SAFE_SHARING", error });
      setSnapshot(response.snapshot);
    } finally {
      setBusy(false);
    }
  }

  async function stopSharing() {
    setBusy(true);
    captureAdapter.cancelPendingPicker();
    try {
      const response = await sendMessage({ type: "STOP_SAFE_SHARING" });
      setSnapshot(response.snapshot);
    } finally {
      setBusy(false);
    }
  }

  function updateSetting(key: ProtectionCategory, enabled: boolean) {
    const nextSettings = { ...settings, [key]: enabled };
    setSettings(nextSettings);
    void saveProtectionSettings(nextSettings);
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

      <section className="settings-panel" aria-label="Protection toggles">
        {protectionOptions.map(option => (
          <label className="toggle-row" key={option.key}>
            <span>{option.label}</span>
            <input
              type="checkbox"
              checked={settings[option.key]}
              disabled={busy || !canStartSharing(snapshot.status)}
              onChange={event => updateSetting(option.key, event.currentTarget.checked)}
            />
          </label>
        ))}
      </section>

      <section className={`status-panel status-${snapshot.status}`}>
        <span className="status-dot" />
        <div>
          <p className="eyebrow">Current status</p>
          <strong>{statusText(snapshot.status)}</strong>
        </div>
      </section>

      {snapshot.error ? (
        <p className="error-text">{snapshot.error.message}</p>
      ) : (
        <p className="hint-text">Create the Safe Preview, then share that window in Meet or Zoom.</p>
      )}

      <div className="button-row">
        <button className="primary-button" type="button" disabled={busy || !canStartSharing(snapshot.status)} onClick={startSharing}>
          Create Safe Preview
        </button>
        <button className="secondary-button" type="button" disabled={busy || !canStopSharing(snapshot.status)} onClick={stopSharing}>
          Stop Sharing
        </button>
      </div>
    </main>
  );
}

function loadProtectionSettings(): Promise<ProtectionSettings> {
  return new Promise(resolve => {
    chrome.storage.local.get(PROTECTION_SETTINGS_KEY, items => {
      resolve(normalizeProtectionSettings(items[PROTECTION_SETTINGS_KEY]));
    });
  });
}

function saveProtectionSettings(settings: ProtectionSettings): Promise<void> {
  return chrome.storage.local.set({ [PROTECTION_SETTINGS_KEY]: settings });
}

function captureError(caught: unknown): CaptureError {
  const message = caught instanceof Error ? caught.message : "Capture could not be started.";
  if (message.toLowerCase().includes("cancel")) return { code: "capture_cancelled", message };
  if (message.toLowerCase().includes("denied")) return { code: "capture_denied", message };
  return { code: "capture_api_error", message };
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
