import { useEffect, useRef, useState } from "react";
import { Check, Crosshair, X, ArrowRight } from "lucide-react";
import {
  cleanCalibrationRows,
  gridPoints,
  predict,
  selectModel,
  type ModelSelection,
  type CalibrationRecord,
  type CalibrationRow,
  type RidgeModel,
  type ValidationPoint,
} from "../lib/calibration";
import { median, type Point } from "../lib/selection";
import type { FeatureFrame } from "../lib/tracker";
export function Calibration({
  getFrame,
  onClose,
  onDone,
}: {
  getFrame: () => FeatureFrame | null;
  onClose: () => void;
  onDone: (record: CalibrationRecord) => void;
}) {
  const [phase, setPhase] = useState<
      "intro" | "training" | "validation" | "done"
    >("intro"),
    [index, setIndex] = useState(0),
    [progress, setProgress] = useState(0),
    [message, setMessage] = useState(""),
    [retry, setRetry] = useState(0),
    [failed, setFailed] = useState(false);
  const [validation, setValidation] = useState<ValidationPoint[]>([]);
  const [precision, setPrecision] = useState(true);
  const selection = useRef<ModelSelection | undefined>(undefined);
  const viewport = useRef({
    width: innerWidth,
    height: innerHeight,
    dpr: devicePixelRatio,
  });
  const points = useRef(gridPoints(innerWidth, innerHeight));
  const validationTargets = useRef(
    Array.from({ length: 5 }, () => ({
      x: innerWidth * (0.18 + Math.random() * 0.64),
      y: innerHeight * (0.18 + Math.random() * 0.64),
    })),
  );
  const rows = useRef<CalibrationRow[]>([]),
    model = useRef<RidgeModel | null>(null),
    record = useRef<CalibrationRecord | null>(null);
  const begin = () => {
    const base = gridPoints(innerWidth, innerHeight, precision ? 5 : 3);
    const shuffle = (items: Point[]) => {
      const result = [...items];
      for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
      }
      return result;
    };
    points.current = Array.from({ length: precision ? 2 : 1 }, () =>
      shuffle(base),
    ).flat();
    validationTargets.current = Array.from(
      { length: precision ? 9 : 5 },
      () => ({
        x: innerWidth * (0.15 + Math.random() * 0.7),
        y: innerHeight * (0.16 + Math.random() * 0.68),
      }),
    );
    rows.current = [];
    setValidation([]);
    setIndex(0);
    setPhase("training");
  };
  const callbacks = useRef({ getFrame, onClose, onDone });
  callbacks.current = { getFrame, onClose, onDone };
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    closeButton.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        callbacks.current.onClose();
      }
      if (e.code === "Space") e.preventDefault();
    };
    const resize = () => callbacks.current.onClose();
    window.addEventListener("keydown", key);
    window.addEventListener("resize", resize);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", key);
      window.removeEventListener("resize", resize);
      before?.focus();
    };
  }, []);
  useEffect(() => {
    if (phase !== "training" && phase !== "validation") return;
    setProgress(0);
    setMessage("점을 바라보세요");
    setFailed(false);
    const target = (
      phase === "training" ? points.current : validationTargets.current
    )[index];
    let last = -1;
    const start = performance.now(),
      collected: CalibrationRow[] = [];
    const interval = window.setInterval(() => {
      const now = performance.now(),
        elapsed = now - start,
        frame = callbacks.current.getFrame();
      const valid =
        frame && now - frame.timestamp < 200 && frame.quality >= 0.4;
      if (elapsed >= 750 && valid && frame.timestamp !== last) {
        last = frame.timestamp;
        collected.push({
          features: frame.values,
          target,
          pointIndex: points.current.findIndex(
            (p) => p.x === target.x && p.y === target.y,
          ),
          timestamp: frame.timestamp,
          quality: frame.quality,
        });
      }
      setMessage(
        !valid
          ? "눈이 잘 보이도록 정면을 향해 주세요"
          : elapsed < 750
            ? "점에 시선을 옮기세요"
            : "좋아요. 조금만 더 바라보세요",
      );
      setProgress(
        Math.min(
          1,
          Math.min(Math.max(0, elapsed - 750) / 1100, collected.length / 14),
        ),
      );
      if (elapsed >= 1850 && collected.length >= 14) {
        clearInterval(interval);
        const cleaned = cleanCalibrationRows(collected);
        if (cleaned.length < 10) {
          setFailed(true);
          setMessage("시선이 불안정했습니다. 이 점을 다시 측정해 주세요.");
          return;
        }
        if (phase === "training") {
          rows.current.push(...cleaned);
          if (index < points.current.length - 1) setIndex(index + 1);
          else {
            try {
              const fitted = selectModel(rows.current);
              model.current = fitted.model;
              selection.current = fitted.selection;
              setIndex(0);
              setPhase("validation");
            } catch (e) {
              setFailed(true);
              setMessage((e as Error).message);
              rows.current = [];
            }
          }
        } else {
          const predictedPoints = cleaned.map((r) =>
            predict(model.current!, r.features),
          );
          const predicted: Point = {
            x: median(predictedPoints.map((p) => p.x)),
            y: median(predictedPoints.map((p) => p.y)),
          };
          const item: ValidationPoint = {
            target,
            predicted,
            pixelError: Math.hypot(
              predicted.x - target.x,
              predicted.y - target.y,
            ),
            sampleCount: cleaned.length,
          };
          setValidation((previous) => [...previous, item]);
          if (index < validationTargets.current.length - 1) setIndex(index + 1);
          else setPhase("done");
        }
      } else if (elapsed > 8000) {
        clearInterval(interval);
        setFailed(true);
        setMessage(
          "유효한 눈 데이터가 부족합니다. 카메라와 조명을 확인하고 다시 시도하세요.",
        );
      }
    }, 40);
    return () => clearInterval(interval);
  }, [phase, index, retry]);
  useEffect(() => {
    if (phase === "done" && model.current) {
      record.current = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        viewport: viewport.current,
        rows: rows.current,
        model: model.current,
        validation,
        selection: selection.current,
        plan: { points: precision ? 25 : 9, repeats: precision ? 2 : 1 },
      };
    }
  }, [phase, validation]);
  const average = validation.length
    ? validation.reduce((s, p) => s + (p.pixelError ?? 0), 0) /
      validation.length
    : 0;
  const target = (
    phase === "training" ? points.current : validationTargets.current
  )[index];
  return (
    <div
      className="calibration-screen"
      role="dialog"
      aria-modal="true"
      aria-label="시선 보정"
      onKeyDown={(e) => {
        if (e.key === "Tab") {
          const items = e.currentTarget.querySelectorAll<HTMLButtonElement>(
            "button:not(:disabled)",
          );
          const first = items[0],
            last = items[items.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last?.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first?.focus();
          }
        }
      }}
    >
      <div className="calibration-top">
        <span>
          <Crosshair size={18} /> GLIMPSE / CALIBRATION
        </span>
        <button ref={closeButton} onClick={onClose} aria-label="보정 닫기">
          <X size={18} />
        </button>
      </div>
      {phase === "intro" ? (
        <div className="calibration-intro">
          <div className="calibration-icon">
            <Crosshair size={34} />
          </div>
          <div className="eyebrow">LET’S FIND YOUR POINT OF VIEW</div>
          <h2>화면의 점을 따라 바라보세요.</h2>
          <p>
            머리는 편안하게 고정하고, 눈으로만 점을 따라갑니다.
            <br />
            {precision
              ? "25개 위치를 두 번씩 측정하고, 새로운 9개 점으로 확인합니다."
              : "9개의 점으로 보정한 뒤, 새로운 5개 점으로 확인합니다."}
            <br />
            {precision ? "약 2분" : "약 30초"}가 걸립니다. 클릭하거나 Space를
            누를 필요는 없어요.
          </p>
          <div className="calibration-options">
            <button aria-pressed={precision} onClick={() => setPrecision(true)}>
              정밀 · 25점 × 2회
            </button>
            <button
              aria-pressed={!precision}
              onClick={() => setPrecision(false)}
            >
              빠른 보정 · 9점
            </button>
          </div>
          <button className="primary" onClick={begin}>
            {precision ? "50회" : "9점"} 보정 시작 <ArrowRight size={15} />
          </button>
          <small>
            안경 반사와 역광을 피하고, 얼굴 전체가 보이도록 앉아 주세요.
          </small>
        </div>
      ) : phase === "done" ? (
        <div className="calibration-intro">
          <div className="calibration-icon">
            <Check size={30} />
          </div>
          <div className="eyebrow">VALIDATION COMPLETE</div>
          <h2>시선 보정이 끝났어요.</h2>
          <div className="validation-value">
            {Math.round(average)}
            <span> px</span>
          </div>
          <p>
            새로운 {validation.length}개 지점에서 측정한 평균 오차
            <br />
            {average > 100
              ? "오차가 큽니다. 조명과 자세를 조정한 뒤 다시 보정하는 것을 권장합니다."
              : "이제 읽기 실험에서 실제 단어 정확도를 측정해 보세요."}
          </p>
          <div className="validation-points">
            {validation.map((v, i) => (
              <span key={i}>
                지점 {i + 1}
                <b>{Math.round(v.pixelError ?? 0)} px</b>
              </span>
            ))}
          </div>
          <p className="model-detail">
            {model.current?.featureMode === "quadratic" ? "2차" : "선형"} 회귀 ·
            위치를 분리한 {selection.current?.folds}겹 검증으로 선택
            <br />
            학습 위치 검증 {Math.round(selection.current?.meanError ?? 0)} px ·
            최종 점들은 학습에 사용하지 않았습니다.
          </p>
          <div className="button-row">
            <button
              onClick={() => {
                rows.current = [];
                setValidation([]);
                setIndex(0);
                setPhase("intro");
              }}
            >
              다시 보정
            </button>
            <button
              className="primary"
              onClick={() => {
                if (record.current) onDone(record.current);
              }}
            >
              읽기로 돌아가기 <ArrowRight size={14} />
            </button>
          </div>
          <small>
            웹캠 단어 정확도를 보장하는 수치가 아닙니다. Test Mode에서
            검증하세요.
          </small>
        </div>
      ) : (
        <>
          <div
            className="calibration-instruction"
            style={{
              left:
                target.x < innerWidth / 2
                  ? innerWidth * 0.75
                  : innerWidth * 0.25,
              top:
                target.y < innerHeight / 2
                  ? innerHeight * 0.7
                  : innerHeight * 0.2,
            }}
          >
            <span className="eyebrow">
              {phase === "training"
                ? "PERSONAL CALIBRATION"
                : "INDEPENDENT VALIDATION"}
            </span>
            <h3>
              {phase === "training" ? "시선 보정" : "보정 결과 확인"}{" "}
              <span>
                {index + 1} /{" "}
                {phase === "training"
                  ? points.current.length
                  : validationTargets.current.length}
              </span>
            </h3>
            <p role="status">{message}</p>
            {failed && (
              <button
                className="primary"
                onClick={() => {
                  if (!rows.current.length && phase === "training") setIndex(0);
                  setRetry(retry + 1);
                }}
              >
                이 단계 다시 시도
              </button>
            )}
          </div>
          <div
            className="calibration-target"
            style={{ left: target.x, top: target.y }}
            aria-label={`보정 지점 ${index + 1}`}
          >
            <div
              style={{
                background: `conic-gradient(#648b54 ${progress * 360}deg, #e1e8d6 0deg)`,
              }}
            >
              <i />
            </div>
          </div>
          <div className="calibration-bottom">
            {phase === "validation"
              ? "학습에 사용하지 않은 새 지점입니다."
              : "점이 옮겨질 때까지 계속 바라보세요."}{" "}
            <span>Esc로 취소</span>
          </div>
        </>
      )}
    </div>
  );
}
