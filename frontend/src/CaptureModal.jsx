import { useEffect, useRef, useState } from "react";

const MAX_DIMENSION = 960; // keep captured frames reasonably sized over the wire

/**
 * Shows a genuinely live video preview (camera or screen share) and
 * lets you capture a single frame to send for analysis.
 *
 * Important distinction, worth being upfront about: this is
 * "live preview, capture a moment" — not continuous frame-by-frame
 * analysis while you watch. True live analysis (the model looking at
 * every frame in real time) is a fundamentally different, far more
 * expensive architecture than a request/response chat API supports
 * well. What's here is the same pattern most camera-input chat
 * features actually use: you see the real feed, you choose the
 * moment, one frame gets analyzed.
 */
export default function CaptureModal({ mode, onCapture, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        const stream =
          mode === "camera"
            ? await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "user" },
                audio: false,
              })
            : await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: false,
              });

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setReady(true);

        // Screen share can be stopped from the browser's own "Stop
        // sharing" UI, not just our modal — detect that and close.
        stream.getVideoTracks()[0]?.addEventListener("ended", () => {
          if (!cancelled) onClose();
        });
      } catch (e) {
        if (!cancelled) {
          setError(
            e.name === "NotAllowedError"
              ? "Permission denied. Allow access and try again."
              : "Couldn't start the feed."
          );
        }
      }
    }

    start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  function handleCapture() {
    const video = videoRef.current;
    if (!video) return;

    const scale = Math.min(1, MAX_DIMENSION / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.75);

    streamRef.current?.getTracks().forEach((t) => t.stop());
    onCapture(dataUrl);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="capture-modal" onClick={(e) => e.stopPropagation()}>
        <div className="capture-modal-header">
          <h2>{mode === "camera" ? "Camera" : "Screen"}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {error ? (
          <div className="capture-error">{error}</div>
        ) : (
          <>
            <div className="capture-video-wrap">
              <video ref={videoRef} muted playsInline className="capture-video" />
              {!ready && <div className="capture-loading">Starting feed…</div>}
            </div>
            <button
              className="send-btn capture-btn"
              onClick={handleCapture}
              disabled={!ready}
            >
              Capture frame
            </button>
          </>
        )}
      </div>
    </div>
  );
}
