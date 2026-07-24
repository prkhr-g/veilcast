import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  getErrorMessage,
  type ShieldState,
  type VielCastMessage,
  type VielCastMessageResponse,
} from "../../src/extension/messages";
import "./style.css";

const CONTENT_SCRIPT_FILE = "content-scripts/content.js";
const unsupportedPageMessage = "Safe Share works on http and https browser tabs only.";

function Popup() {
  const [state, setState] = useState<ShieldState>({ enabled: false, regionCount: 0 });
  const [status, setStatus] = useState("Select a browser tab to protect.");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void refreshState();
  }, []);

  async function refreshState() {
    setError(undefined);
    try {
      const tab = await getActiveTab();
      assertSupportedTab(tab);
      const response = await sendTabMessage(tab.id, { type: "VIELCAST_GET_SHIELD_STATE" }).catch(() => undefined);
      if (response?.ok) {
        setState(response.state);
        setStatus(response.state.enabled ? "Protecting this browser tab" : "Protection disabled");
      } else {
        setState({ enabled: false, regionCount: 0 });
        setStatus("Protection disabled");
      }
    } catch (caught) {
      setState({ enabled: false, regionCount: 0 });
      setStatus("Protection unavailable");
      setError(getErrorMessage(caught));
    }
  }

  async function toggleShield() {
    setBusy(true);
    setError(undefined);

    try {
      const tab = await getActiveTab();
      assertSupportedTab(tab);
      await injectContentScript(tab.id);
      const response = await sendTabMessage(tab.id, { type: "VIELCAST_TOGGLE_SHIELD" });
      if (!response.ok) throw new Error(response.error);
      setState(response.state);
      setStatus(response.state.enabled ? "Protecting this browser tab" : "Protection disabled");
    } catch (caught) {
      setStatus("Protection unavailable");
      setError(getErrorMessage(caught));
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
          <p>Safe Share</p>
        </div>
      </section>

      <section className={`status-panel ${state.enabled ? "status-active" : "status-idle"}`}>
        <span className="status-dot" />
        <div>
          <p className="eyebrow">Current status</p>
          <strong>{state.enabled ? "Safe Share Active" : "Disabled"}</strong>
          <p className="region-count">{state.enabled ? `${state.regionCount} protected region${state.regionCount === 1 ? "" : "s"}` : status}</p>
        </div>
      </section>

      {error ? <p className="error-text">{error}</p> : <p className="hint-text">{status}</p>}

      <button className="primary-button" type="button" disabled={busy} onClick={toggleShield}>
        {state.enabled ? "Safe Share Active" : "Enable Safe Share"}
      </button>
    </main>
  );
}

function getActiveTab(): Promise<chrome.tabs.Tab> {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      const tab = tabs[0];
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else if (!tab?.id) {
        reject(new Error("No active tab is available."));
      } else {
        resolve(tab);
      }
    });
  });
}

function assertSupportedTab(tab: chrome.tabs.Tab): asserts tab is chrome.tabs.Tab & { id: number } {
  if (!tab.id) throw new Error("No active tab is available.");
  const url = tab.url ?? "";
  if (!/^https?:\/\//i.test(url)) throw new Error(unsupportedPageMessage);
}

function injectContentScript(tabId: number): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.scripting.executeScript({ target: { tabId }, files: [CONTENT_SCRIPT_FILE] }, () => {
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        reject(new Error(lastError.message ?? "Content script injection failed."));
      } else {
        resolve();
      }
    });
  });
}

function sendTabMessage(tabId: number, message: VielCastMessage): Promise<VielCastMessageResponse> {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, response => {
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        reject(new Error(lastError.message ?? "Content script unavailable."));
      } else {
        resolve(response as VielCastMessageResponse);
      }
    });
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Popup />
  </StrictMode>,
);
