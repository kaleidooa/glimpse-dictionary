import { t as tr } from "../lib/i18n";
import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff } from "lucide-react";
import { WebcamTracker, type FeatureFrame } from "../lib/tracker";
export type CameraStatus = "off" | "loading" | "tracking" | "lost" | "error";
export function CameraPanel({
  onFrame,
  onStatus,
  enabled,
}: {
  onFrame: (frame: FeatureFrame | null) => void;
  onStatus: (s: CameraStatus) => void;
  enabled: boolean;
}) {
  const video = useRef<HTMLVideoElement>(null),
    tracker = useRef<WebcamTracker | null>(null),
    callbacks = useRef({ onFrame, onStatus });
  callbacks.current = { onFrame, onStatus };
  const [status, setStatus] = useState<CameraStatus>("off"),
    [error, setError] = useState(""),
    [waiting, setWaiting] = useState(false);
  useEffect(() => {
    setWaiting(false);
    if (status !== "loading") return;
    const timer = setTimeout(() => setWaiting(true), 6000);
    return () => clearTimeout(timer);
  }, [status]);
  const change = (s: CameraStatus) => {
    setStatus(s);
    callbacks.current.onStatus(s);
  };
  const stop = () => {
    tracker.current?.stop();
    tracker.current = null;
    if (video.current) video.current.srcObject = null;
    callbacks.current.onFrame(null);
    change("off");
  };
  useEffect(() => {
    if (!enabled) stop();
    return () => {
      tracker.current?.stop();
      tracker.current = null;
    };
  }, [enabled]);
  const start = async () => {
    if (!video.current) return;
    setError("");
    change("loading");
    const next = new WebcamTracker();
    tracker.current = next;
    const fail = (message: string) => {
      if (tracker.current !== next) return;
      setError(message);
      change("error");
      callbacks.current.onFrame(null);
    };
    try {
      await next.start(
        video.current,
        (frame) => {
          if (tracker.current !== next) return;
          change(frame ? "tracking" : "lost");
          callbacks.current.onFrame(frame);
        },
        fail,
      );
    } catch (e) {
      fail(
        e instanceof Error
          ? e.message
          : tr(
              "Could not connect the camera.",
              "카메라를 연결하지 못했습니다.",
            ),
      );
    }
  };
  return (
    <>
      <div className="camera-preview">
        <video
          ref={video}
          autoPlay
          muted
          playsInline
          aria-label={tr("Webcam preview", "웹캠 미리보기")}
        />
        {(status === "off" || status === "error" || status === "loading") && (
          <div className="camera-placeholder">
            <CameraOff size={24} />
            <span>
              {status === "loading"
                ? tr("Preparing camera and model…", "카메라와 모델 준비 중…")
                : tr("Webcam", "시선이 시작되는 곳")}
            </span>
          </div>
        )}
        <span
          className={`camera-state ${status === "tracking" ? "active" : ""}`}
        >
          <i />
          {
            {
              off: "CAMERA OFF",
              loading: "CONNECTING",
              tracking: "FACE DETECTED",
              lost: tr("Looking for eyes", "눈을 찾는 중"),
              error: tr("Check connection", "연결 확인"),
            }[status]
          }
        </span>
      </div>
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      {waiting && (
        <p className="muted" role="status">
          {tr(
            "Check the browser camera permission prompt. If already allowed, wait for the model to load.",
            "브라우저의 카메라 권한 요청을 확인해 주세요. 이미 허용했다면 모델 준비를 잠시 기다려 주세요.",
          )}{" "}
        </p>
      )}
      {status === "off" || status === "error" ? (
        <button className="primary full" onClick={start} disabled={!enabled}>
          <Camera size={14} /> {tr("Connect webcam", "웹캠 연결")}{" "}
        </button>
      ) : (
        <button className="full" onClick={stop}>
          {status === "loading"
            ? tr("Cancel connection", "연결 취소")
            : tr("Disconnect camera", "카메라 끄기")}
        </button>
      )}
      <p className="privacy-note">
        {tr(
          "Frames are processed in this browser only.",
          "영상은 이 브라우저에서만 처리됩니다.",
        )}
      </p>
    </>
  );
}
