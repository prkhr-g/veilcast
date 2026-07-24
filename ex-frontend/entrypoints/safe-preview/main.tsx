import { StrictMode, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type { CaptureError, ExtensionMessage, MessageResponse } from "../../src/extension/messages";
import {
  createDebugProtectionRegions,
  getContainedVideoBounds,
  mapRegionToPreview,
  type Size,
} from "../../src/extension/overlay";
import type { ProtectionSettings } from "../../src/extension/protection-settings";
import {
  DEFAULT_PROTECTION_SETTINGS,
  PROTECTION_SETTINGS_KEY,
  normalizeProtectionSettings,
} from "../../src/extension/protection-settings";
import "./style.css";

type PreviewState = "starting" | "active" | "ended" | "error";

const emptySize: Size = { width: 0, height: 0 };

function SafePreview() {
  const shellRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | undefined>(undefined);
  const [state, setState] = useState<PreviewState>("starting");
  const [message, setMessage] = useState("Preparing capture stream...");
  const [sourceSize, setSourceSize] = useState<Size>(emptySize);
  const [containerSize, setContainerSize] = useState<Size>(emptySize);
  const [settings, setSettings] = useState<ProtectionSettings>(DEFAULT_PROTECTION_SETTINGS);

  const videoBounds = useMemo(() => getContainedVideoBounds(sourceSize, containerSize), [sourceSize, containerSize]);
  const regions = useMemo(() => {
    if (!sourceSize.width || !sourceSize.height || !containerSize.width || !containerSize.height) return [];
    return createDebugProtectionRegions(sourceSize, settings).map(region => {
      const mapped = mapRegionToPreview(region, sourceSize, containerSize);
      return { ...mapped, left: mapped.left - videoBounds.x, top: mapped.top - videoBounds.y };
    });
  }, [containerSize, settings, sourceSize, videoBounds.x, videoBounds.y]);

  useEffect(() => {
    let closed = false;
    let ignoreTrackEnd = false;

    const resizeObserver = new ResizeObserver(entries => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      setContainerSize({ width: rect.width, height: rect.height });
    });
    if (shellRef.current) resizeObserver.observe(shellRef.current);

    void loadProtectionSettings().then(setSettings);

    const runtimeListener = (incoming: ExtensionMessage) => {
      if (incoming.type === "STOP_CAPTURE") finish("ended", "Safe Preview stopped.", false);
    };
    chrome.runtime.onMessage.addListener(runtimeListener);

    const beforeUnload = () => {
      closed = true;
      stopTracks();
      sendMessage({ type: "SAFE_PREVIEW_CLOSED" }).catch(() => undefined);
    };
    window.addEventListener("beforeunload", beforeUnload);

    void startStream().catch(error => {
      const capture = toCaptureError(error);
      setState("error");
      setMessage(capture.message);
      stopTracks();
      sendMessage({ type: "SAFE_PREVIEW_ERROR", error: capture }).catch(() => undefined);
    });

    async function startStream() {
      const response = await sendMessage({ type: "SAFE_PREVIEW_READY" });
      if (!response.ok || !response.streamId) throw new Error(response.ok ? "Missing capture stream identifier." : response.error.message);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: "desktop",
            chromeMediaSourceId: response.streamId,
            maxFrameRate: 30,
          },
        } as unknown as MediaTrackConstraints,
      });

      if (closed) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }

      streamRef.current = stream;
      const [videoTrack] = stream.getVideoTracks();
      if (videoTrack) {
        ignoreTrackEnd = false;
        videoTrack.addEventListener("ended", () => {
          if (!ignoreTrackEnd) finish("ended", "The source window stopped sharing.", true);
        }, { once: true });
      }

      const video = videoRef.current;
      if (!video) throw new Error("Preview video element is unavailable.");
      video.srcObject = stream;
      await waitForMetadata(video);
      setSourceSize({ width: video.videoWidth, height: video.videoHeight });
      await video.play();
      setState("active");
      setMessage("VeilCast Protection Active");
      await sendMessage({ type: "SAFE_PREVIEW_STREAM_STARTED" });
    }

    function finish(nextState: PreviewState, nextMessage: string, notifyEnded: boolean) {
      stopTracks();
      setState(nextState);
      setMessage(nextMessage);
      if (notifyEnded) sendMessage({ type: "SAFE_PREVIEW_STREAM_ENDED" }).catch(() => undefined);
    }

    function stopTracks() {
      ignoreTrackEnd = true;
      streamRef.current?.getTracks().forEach(track => track.stop());
      streamRef.current = undefined;
      if (videoRef.current) videoRef.current.srcObject = null;
    }

    return () => {
      resizeObserver.disconnect();
      chrome.runtime.onMessage.removeListener(runtimeListener);
      window.removeEventListener("beforeunload", beforeUnload);
      stopTracks();
    };
  }, []);

  return (
    <main ref={shellRef} className="preview-shell" data-state={state}>
      <video ref={videoRef} className="preview-video" muted playsInline autoPlay />
      <div
        className="protection-overlay"
        aria-hidden="true"
        style={{
          left: `${videoBounds.x}px`,
          top: `${videoBounds.y}px`,
          width: `${videoBounds.width}px`,
          height: `${videoBounds.height}px`,
        }}
      >
        {regions.map(region => (
          <div
            className={`protection-region effect-${region.effect}`}
            data-kind={region.type}
            key={region.id}
            style={{
              left: `${region.left}px`,
              top: `${region.top}px`,
              width: `${region.width}px`,
              height: `${region.height}px`,
            }}
          >
            {region.label ? <span>{region.label}</span> : null}
          </div>
        ))}
      </div>
      <div className="active-indicator">
        <span />
        {message}
      </div>
    </main>
  );
}

function waitForMetadata(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= HTMLMediaElement.HAVE_METADATA && video.videoWidth > 0 && video.videoHeight > 0) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const onLoaded = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("Capture video metadata could not be loaded."));
    };
    const cleanup = () => {
      video.removeEventListener("loadedmetadata", onLoaded);
      video.removeEventListener("error", onError);
    };

    video.addEventListener("loadedmetadata", onLoaded, { once: true });
    video.addEventListener("error", onError, { once: true });
  });
}

function loadProtectionSettings(): Promise<ProtectionSettings> {
  return new Promise(resolve => {
    chrome.storage.local.get(PROTECTION_SETTINGS_KEY, items => {
      resolve(normalizeProtectionSettings(items[PROTECTION_SETTINGS_KEY]));
    });
  });
}

function toCaptureError(caught: unknown): CaptureError {
  const message = caught instanceof Error ? caught.message : "Capture stream could not be started.";
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
    <SafePreview />
  </StrictMode>,
);
