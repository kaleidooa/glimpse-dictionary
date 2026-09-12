import type { FaceLandmarker } from "@mediapipe/tasks-vision";
import { extractFeatures, type EyeFeatures } from "./features";
export type FeatureFrame = EyeFeatures & { timestamp: number };
export class WebcamTracker {
  private stream: MediaStream | null = null;
  private detector: FaceLandmarker | null = null;
  private raf = 0;
  private stopped = false;
  async start(
    video: HTMLVideoElement,
    onFrame: (frame: FeatureFrame | null) => void,
    onError: (message: string) => void,
  ) {
    if (!navigator.mediaDevices?.getUserMedia)
      throw new Error("카메라는 localhost 또는 HTTPS에서 사용할 수 있습니다.");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user",
        },
        audio: false,
      });
      if (this.stopped) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      this.stream = stream;
      video.srcObject = stream;
      await video.play();
      const { FaceLandmarker, FilesetResolver } = await import(
        "@mediapipe/tasks-vision"
      );
      const vision = await FilesetResolver.forVisionTasks(
        new URL("mediapipe", document.baseURI).href,
      );
      const options = {
        runningMode: "VIDEO" as const,
        numFaces: 1,
        outputFaceBlendshapes: true,
        minFaceDetectionConfidence: 0.6,
        minFacePresenceConfidence: 0.6,
        minTrackingConfidence: 0.6,
      };
      let detector: FaceLandmarker;
      try {
        detector = await FaceLandmarker.createFromOptions(vision, {
          ...options,
          baseOptions: {
            modelAssetPath: new URL(
              "models/face_landmarker.task",
              document.baseURI,
            ).href,
            delegate: "GPU",
          },
        });
      } catch {
        detector = await FaceLandmarker.createFromOptions(vision, {
          ...options,
          baseOptions: {
            modelAssetPath: new URL(
              "models/face_landmarker.task",
              document.baseURI,
            ).href,
            delegate: "CPU",
          },
        });
      }
      if (this.stopped) {
        detector.close();
        return;
      }
      this.detector = detector;
      this.stream.getVideoTracks()[0]?.addEventListener("ended", () => {
        if (!this.stopped) {
          this.stop();
          onError("카메라 연결이 종료되었습니다. 다시 연결해 주세요.");
        }
      });
      let lastTime = -1,
        lastInference = 0;
      const loop = () => {
        if (this.stopped) return;
        const now = performance.now();
        if (
          !document.hidden &&
          video.readyState >= 2 &&
          video.currentTime !== lastTime &&
          now - lastInference >= 45
        ) {
          lastTime = video.currentTime;
          lastInference = now;
          try {
            const result = detector.detectForVideo(video, now);
            const blinks =
              result.faceBlendshapes[0]?.categories
                .filter(
                  (c) =>
                    c.categoryName === "eyeBlinkLeft" ||
                    c.categoryName === "eyeBlinkRight",
                )
                .map((c) => c.score) ?? [];
            const features = extractFeatures(
              result.faceLandmarks[0] ?? [],
              Math.max(0, ...blinks),
            );
            onFrame(features ? { ...features, timestamp: now } : null);
          } catch {
            this.stop();
            onError("얼굴 분석이 중단되었습니다. 카메라를 다시 연결해 주세요.");
            return;
          }
        }
        this.raf = requestAnimationFrame(loop);
      };
      this.raf = requestAnimationFrame(loop);
    } catch (error) {
      this.stop();
      const name = error instanceof Error ? error.name : "";
      if (name === "NotAllowedError")
        throw new Error(
          "카메라 권한이 허용되지 않았습니다. 주소창의 사이트 설정에서 카메라를 허용한 뒤 다시 연결해 주세요.",
        );
      if (name === "NotFoundError")
        throw new Error(
          "사용 가능한 웹캠이 없습니다. 카메라 연결을 확인하거나 마우스 시뮬레이션을 사용하세요.",
        );
      if (name === "NotReadableError")
        throw new Error(
          "카메라를 열 수 없습니다. 다른 앱에서 사용 중인지 확인하세요.",
        );
      throw new Error(
        "모델 또는 카메라를 불러오지 못했습니다. npm run assets 실행 후 다시 연결하세요.",
      );
    }
  }
  stop() {
    this.stopped = true;
    cancelAnimationFrame(this.raf);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.detector?.close();
    this.detector = null;
  }
}
