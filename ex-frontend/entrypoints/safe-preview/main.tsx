import { StrictMode, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type { ExtensionMessage, MessageResponse } from "../../src/extension/messages";
import "./style.css";

type PreviewState = "starting" | "active" | "ended" | "error";

function SafePreview() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | undefined>(undefined);
  const [state, setState] = useState<PreviewState>("starting");
  const [message, setMessage] = useState("Preparing capture stream...");

  useEffect(() => {
    let closed = false;

    const resizeCanvas = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(rect.width * devicePixelRatio));
      canvas.height = Math.max(1, Math.floor(rect.height * devicePixelRatio));
    };

    const resizeObserver = new ResizeObserver(resizeCanvas);
    if (canvasRef.current) resizeObserver.observe(canvasRef.current);
    resizeCanvas();

    const runtimeListener = (incoming: ExtensionMessage) => {
      if (incoming.type === "STOP_CAPTURE") stopStream("ended", "Safe Preview stopped.");
    };
    chrome.runtime.onMessage.addListener(runtimeListener);

    const beforeUnload = () => {
      closed = true;
      stopTracks();
      sendMessage({ type: "SAFE_PREVIEW_CLOSED" }).catch(() => undefined);
    };
    window.addEventListener("beforeunload", beforeUnload);

    void startStream().catch(error => {
      const text = error instanceof Error ? error.message : "Capture stream could not be started.";
      setState("error");
      setMessage(text);
      sendMessage({ type: "SAFE_PREVIEW_ERROR", error: { code: "capture_denied", message: text } }).catch(() => undefined);
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
        videoTrack.addEventListener("ended", () => stopStream("ended", "The source window stopped sharing."), { once: true });
      }

      const video = videoRef.current;
      if (!video) throw new Error("Preview video element is unavailable.");
      video.srcObject = stream;
      await video.play();
      setState("active");
      setMessage("VeilCast Protection Active");
      await sendMessage({ type: "SAFE_PREVIEW_STREAM_STARTED" });
    }

    function stopStream(nextState: PreviewState, nextMessage: string) {
      stopTracks();
      setState(nextState);
      setMessage(nextMessage);
      if (nextState === "ended") sendMessage({ type: "SAFE_PREVIEW_STREAM_ENDED" }).catch(() => undefined);
    }

    function stopTracks() {
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
    <main className="preview-shell" data-state={state}>
      <video ref={videoRef} className="preview-video" muted playsInline autoPlay />
      <canvas ref={canvasRef} className="mask-overlay" aria-hidden="true" />
      <div className="active-indicator">
        <span />
        {message}
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
    <SafePreview />
  </StrictMode>,
);
