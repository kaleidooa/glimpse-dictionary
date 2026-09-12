import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  Fragment,
} from "react";
import {
  Eye,
  ArrowUpRight,
  MousePointer2,
  Camera,
  Crosshair,
  Activity,
  Download,
  ArrowRight,
  BookOpen,
  FlaskConical,
  Check,
  FileText,
  RotateCcw,
} from "lucide-react";
import { SAMPLE, tokenize } from "./lib/text";
import {
  candidatesAt,
  fixationFrom,
  measureWords,
  type GazeSample,
  type Point,
  type WordBox,
} from "./lib/selection";
import { CameraPanel, type CameraStatus } from "./components/CameraPanel";
import { Calibration } from "./components/Calibration";
import { MeaningPopup } from "./components/MeaningPopup";
import {
  predict,
  type CalibrationRecord,
  type LearningReport,
} from "./lib/calibration";
import { improveCalibration, learningLogs } from "./lib/learning";
import {
  ScrollGuard,
  SCROLL_SETTLE_MS,
  chooseBalancedTarget,
} from "./lib/scroll";
import type { FeatureFrame } from "./lib/tracker";
import {
  downloadData,
  deleteExperimentData,
  evaluateTrial,
  loadData,
  metrics,
  saveData,
  type InputSource,
  type TriggerLog,
  type ExperimentData,
} from "./lib/experiment";
const pct = (n: number | null) =>
  n === null ? "—" : `${Math.round(n * 100)}%`;
const px = (n: number | null | undefined) =>
  n === null || n === undefined ? "—" : `${Math.round(n)} px`;
export default function LabApp() {
  const [text, setText] = useState(SAMPLE),
    [draft, setDraft] = useState(SAMPLE),
    [editing, setEditing] = useState(false),
    [textId, setTextId] = useState(() => crypto.randomUUID());
  const tokens = useMemo(() => tokenize(text), [text]);
  const [source, setSource] = useState<InputSource>("mouse"),
    [cameraStatus, setCameraStatus] = useState<CameraStatus>("off");
  const [calibration, setCalibration] = useState<CalibrationRecord | null>(
      null,
    ),
    [calibrating, setCalibrating] = useState(false),
    [overlay, setOverlay] = useState(false);
  const [gaze, setGaze] = useState<GazeSample | null>(null),
    [nearest, setNearest] = useState("—"),
    [fps, setFps] = useState(0);
  const [mode, setMode] = useState<"read" | "test">("read"),
    [targetId, setTargetId] = useState<number | null>(null),
    [trialPending, setTrialPending] = useState(false);
  const [protocol, setProtocol] = useState<"evaluation" | "training">(
    "evaluation",
  );
  const [trialGoal, setTrialGoal] = useState(50),
    [runComplete, setRunComplete] = useState(false);
  const [scrolling, setScrolling] = useState(false),
    [learningReport, setLearningReport] = useState<LearningReport | null>(null),
    [learningBusy, setLearningBusy] = useState(false);
  const scrollGuard = useRef(new ScrollGuard()),
    targetSince = useRef(0),
    visits = useRef(new Map<string, number>());
  const featureHistory = useRef<
    {
      features: number[];
      timestamp: number;
      quality: number;
      x: number;
      y: number;
    }[]
  >([]);
  const pickRef = useRef<() => boolean>(() => false);
  const [runId, setRunId] = useState(() => crypto.randomUUID()),
    [notice, setNotice] = useState(""),
    [lastLog, setLastLog] = useState<TriggerLog | null>(null);
  const initial = useMemo(() => loadData(), []),
    [data, setData] = useState<ExperimentData>(initial.data),
    [storageError, setStorageError] = useState(initial.error);
  const [popup, setPopup] = useState<{ word: WordBox; id: string } | null>(
    null,
  );
  const reader = useRef<HTMLDivElement>(null),
    frame = useRef<FeatureFrame | null>(null),
    samples = useRef<GazeSample[]>([]),
    boxes = useRef<WordBox[]>([]),
    mouse = useRef<Point | null>(null);
  const dataRef = useRef(data),
    live = useRef({
      source,
      calibration,
      calibrating,
      mode,
      targetId,
      trialPending,
      runComplete,
      editing,
    });
  dataRef.current = data;
  live.current = {
    source,
    calibration,
    calibrating,
    mode,
    targetId,
    trialPending,
    runComplete,
    editing,
  };
  const lastUi = useRef(0),
    frameTimes = useRef<number[]>([]),
    nextTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusReader = () =>
    requestAnimationFrame(() => reader.current?.focus({ preventScroll: true }));
  const clearHistory = () => {
    samples.current = [];
    featureHistory.current = [];
    setGaze(null);
    setNearest("—");
  };
  const refreshBoxes = useCallback(() => {
    boxes.current = reader.current ? measureWords(reader.current, tokens) : [];
    return boxes.current;
  }, [tokens]);
  const persist = (next: ExperimentData) => {
    dataRef.current = next;
    setData(next);
    if (!initial.error) {
      const error = saveData(next);
      if (error) setStorageError(error);
    }
  };
  const append = (log: TriggerLog) => {
    persist({ ...dataRef.current, logs: [...dataRef.current.logs, log] });
    setLastLog(log);
  };
  const acceptSample = useCallback((sample: GazeSample) => {
    if (!Number.isFinite(sample.x) || !Number.isFinite(sample.y)) return;
    if (scrollGuard.current.isSettling(sample.timestamp)) return;
    const now = sample.timestamp;
    samples.current = samples.current.filter((s) => now - s.timestamp <= 1000);
    samples.current.push(sample);
    if (now - lastUi.current > 90) {
      lastUi.current = now;
      setGaze(sample);
      setNearest(candidatesAt(sample, boxes.current)[0]?.word ?? "—");
    }
  }, []);
  const onFrame = useCallback(
    (f: FeatureFrame | null) => {
      frame.current = f;
      if (!f) {
        samples.current = [];
        featureHistory.current = [];
        setGaze(null);
        setNearest("—");
        setFps(0);
        return;
      }
      frameTimes.current = frameTimes.current.filter(
        (t) => f.timestamp - t < 1000,
      );
      frameTimes.current.push(f.timestamp);
      setFps(frameTimes.current.length);
      const state = live.current;
      if (state.source !== "webcam") return;
      const point = state.calibration
        ? predict(state.calibration.model, f.values)
        : { x: f.raw.x * innerWidth, y: f.raw.y * innerHeight };
      if (state.calibrating) {
        setGaze(null);
        return;
      }
      if (scrollGuard.current.isSettling(f.timestamp)) return;
      featureHistory.current = featureHistory.current.filter(
        (p) => f.timestamp - p.timestamp <= 1000,
      );
      featureHistory.current.push({
        features: f.values,
        timestamp: f.timestamp,
        quality: f.quality,
        ...point,
      });
      acceptSample({ ...point, timestamp: f.timestamp, confidence: f.quality });
    },
    [acceptSample],
  );
  const onCameraStatus = useCallback((s: CameraStatus) => {
    setCameraStatus(s);
    if (s === "off" || s === "error") {
      setCalibration(null);
      samples.current = [];
      setFps(0);
    }
  }, []);
  useEffect(() => {
    const move = (e: PointerEvent) => {
      mouse.current = { x: e.clientX, y: e.clientY };
    };
    const leave = () => {
      mouse.current = null;
      if (live.current.source === "mouse") {
        samples.current = [];
        setGaze(null);
      }
    };
    const timer = setInterval(() => {
      if (
        live.current.source === "mouse" &&
        mouse.current &&
        !document.hidden &&
        !live.current.editing
      )
        acceptSample({
          ...mouse.current,
          timestamp: performance.now(),
          confidence: 1,
        });
    }, 40);
    window.addEventListener("pointermove", move);
    document.documentElement.addEventListener("pointerleave", leave);
    return () => {
      clearInterval(timer);
      window.removeEventListener("pointermove", move);
      document.documentElement.removeEventListener("pointerleave", leave);
      if (nextTimer.current) clearTimeout(nextTimer.current);
    };
  }, [acceptSample]);
  useEffect(() => {
    refreshBoxes();
    const observer = new ResizeObserver(() => {
      refreshBoxes();
      samples.current = [];
      featureHistory.current = [];
    });
    if (reader.current) observer.observe(reader.current);
    let settleTimer: ReturnType<typeof setTimeout> | undefined;
    let layoutFrame = 0;
    const scroll = () => {
      const now = performance.now();
      scrollGuard.current.mark(now);
      targetSince.current = now;
      samples.current = [];
      featureHistory.current = [];
      setScrolling(true);
      setGaze(null);
      setNearest("—");
      setPopup(null);
      cancelAnimationFrame(layoutFrame);
      layoutFrame = requestAnimationFrame(refreshBoxes);
      clearTimeout(settleTimer);
      settleTimer = setTimeout(() => {
        const measured = refreshBoxes();
        setScrolling(false);
        if (
          live.current.mode === "test" &&
          !live.current.runComplete &&
          !live.current.trialPending
        ) {
          const visible = measured.some(
            (b) =>
              b.id === live.current.targetId &&
              b.top > 100 &&
              b.bottom < innerHeight - 20,
          );
          if (!visible) pickRef.current();
        }
      }, SCROLL_SETTLE_MS);
    };
    const resize = () => {
      refreshBoxes();
      samples.current = [];
      featureHistory.current = [];
      setPopup(null);
      if (live.current.calibration) {
        setCalibration(null);
        setNotice("화면 크기가 변경되었습니다. 시선을 다시 보정해 주세요.");
      }
      setMode("read");
      setTargetId(null);
    };
    const hidden = () => {
      if (document.hidden) {
        samples.current = [];
        mouse.current = null;
        setGaze(null);
      }
    };
    window.addEventListener("scroll", scroll, true);
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", hidden);
    let mounted = true;
    void document.fonts.ready.then(() => {
      if (mounted) refreshBoxes();
    });
    return () => {
      clearTimeout(settleTimer);
      cancelAnimationFrame(layoutFrame);
      mounted = false;
      observer.disconnect();
      window.removeEventListener("scroll", scroll, true);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [refreshBoxes, editing]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 5500);
    return () => clearTimeout(timer);
  }, [notice]);
  const pickTarget = () => {
    if (scrollGuard.current.isSettling(performance.now())) {
      if (nextTimer.current) clearTimeout(nextTimer.current);
      nextTimer.current = setTimeout(() => {
        if (live.current.mode === "test") pickRef.current();
      }, SCROLL_SETTLE_MS + 1);
      return false;
    }
    const banner = document
      .querySelector(".test-banner")
      ?.getBoundingClientRect();
    const minTop =
      banner && banner.top >= 0 && banner.bottom < innerHeight
        ? banner.bottom + 8
        : 12;
    const visible = refreshBoxes().filter(
      (b) =>
        b.top > minTop &&
        b.bottom < innerHeight - 20 &&
        b.word.length >= 3 &&
        b.id !== live.current.targetId,
    );
    if (!visible.length) {
      setTargetId(null);
      setTrialPending(false);
      setNotice("실험할 영어 단어가 화면에 보이도록 스크롤해 주세요.");
      return false;
    }
    const target = chooseBalancedTarget(
      visible,
      visits.current,
      innerWidth,
      innerHeight,
    )!;
    setTargetId(target.id);
    targetSince.current = performance.now();
    setTrialPending(false);
    samples.current = [];
    featureHistory.current = [];
    return true;
  };
  pickRef.current = pickTarget;
  useEffect(() => {
    if (mode === "test") {
      const id = requestAnimationFrame(() => pickRef.current());
      return () => cancelAnimationFrame(id);
    }
  }, [mode]);
  const newRun = () => {
    if (nextTimer.current) clearTimeout(nextTimer.current);
    setRunId(crypto.randomUUID());
    setLastLog(null);
    setRunComplete(false);
    visits.current.clear();
    setTrialPending(false);
    setTargetId(null);
    setPopup(null);
    clearHistory();
  };
  const changeSource = (next: InputSource) => {
    if (next === source) return;
    newRun();
    setSource(next);
    setProtocol("evaluation");
    setLearningReport(null);
    setCalibration(null);
    setMode("read");
    frame.current = null;
    focusReader();
  };
  const changeMode = (next: "read" | "test") => {
    if (next === mode) return;
    if (next === "test" && runComplete) newRun();
    setPopup(null);
    setTrialPending(false);
    if (nextTimer.current) clearTimeout(nextTimer.current);
    if (next !== "test") setTargetId(null);
    setMode(next);
    focusReader();
  };
  const ready =
    source === "mouse" || (!!calibration && cameraStatus === "tracking");
  const trigger = () => {
    const now = performance.now(),
      currentBoxes = refreshBoxes();
    const blocked = scrollGuard.current.isSettling(now)
      ? "scroll-settling"
      : mode === "test" && runComplete
        ? "run-complete"
        : mode === "test" && now - targetSince.current < 650
          ? "target-settling"
          : null;
    const eligible = source === "mouse" || !!calibration,
      fixation =
        eligible && !blocked ? fixationFrom(samples.current, now) : null;
    const candidates = fixation ? candidatesAt(fixation, currentBoxes) : [];
    const target = currentBoxes.find(
      (b) => b.id === targetId && b.top >= 0 && b.bottom <= innerHeight,
    );
    const reason =
      blocked ??
      (trialPending
        ? "next-target-pending"
        : !eligible
          ? "not-calibrated"
          : !fixation
            ? "insufficient-recent-gaze"
            : !candidates.length
              ? "too-far-from-text"
              : mode === "test" && !target
                ? "target-not-visible"
                : null);
    const selected =
        reason === "next-target-pending" || reason === "target-not-visible"
          ? undefined
          : candidates[0],
      word = currentBoxes.find((b) => b.id === selected?.id);
    const trial =
      mode === "test" && target && !trialPending && !blocked
        ? evaluateTrial(target, selected, candidates, fixation)
        : null;
    const log: TriggerLog = {
      id: crypto.randomUUID(),
      runId,
      textId,
      timestamp: new Date().toISOString(),
      performanceTimestamp: now,
      source,
      mode,
      protocol,
      trialGoal,
      scroll: {
        x: window.scrollX,
        y: window.scrollY,
        revision: scrollGuard.current.revision,
        msSinceScroll: scrollGuard.current.age(now),
      },
      calibrationId: calibration?.id ?? null,
      word: word?.word ?? null,
      sentence: word?.sentence ?? target?.sentence ?? "",
      selectedWord: word?.word ?? null,
      selectedId: word?.id ?? null,
      gazeX: fixation?.x ?? null,
      gazeY: fixation?.y ?? null,
      confidence:
        fixation && selected ? fixation.confidence * selected.score : 0,
      fixation,
      candidateWords: candidates,
      samples: samples.current.filter(
        (s) => s.timestamp >= now - 400 && s.timestamp <= now,
      ),
      reason,
      viewport: {
        width: innerWidth,
        height: innerHeight,
        dpr: devicePixelRatio,
      },
      trial,
    };
    if (
      protocol === "training" &&
      source === "webcam" &&
      trial &&
      fixation &&
      fixation.confidence >= 0.35 &&
      fixation.spread < 80
    ) {
      const recent = featureHistory.current.filter(
        (f) =>
          f.timestamp >= now - 400 &&
          f.timestamp <= now &&
          f.quality >= 0.4 &&
          Math.hypot(f.x - fixation.x, f.y - fixation.y) <=
            Math.max(30, fixation.spread * 2.5),
      );
      if (recent.length >= 4)
        log.learningExample = {
          target: {
            x: (target!.left + target!.right) / 2,
            y: (target!.top + target!.bottom) / 2,
          },
          frames: recent.map(({ features, timestamp, quality }) => ({
            features,
            timestamp,
            quality,
          })),
        };
    }
    append(log);
    setPopup(word ? { word, id: log.id } : null);
    if (trial) {
      setTrialPending(true);
      const completed = dataRef.current.logs.filter(
        (l) => l.runId === runId && l.trial,
      ).length;
      nextTimer.current = setTimeout(() => {
        if (live.current.mode === "test") {
          setPopup(null);
          if (completed >= trialGoal) {
            setRunComplete(true);
            setTargetId(null);
            setTrialPending(false);
          } else pickRef.current();
        }
      }, 1300);
    }
    if (reason && reason !== "next-target-pending")
      setNotice(
        (
          {
            "scroll-settling":
              "스크롤이 멈춘 뒤 단어를 잠시 바라보고 Space를 누르세요.",
            "target-settling": "새 목표를 잠시 바라본 다음 Space를 누르세요.",
            "run-complete":
              "실험이 끝났습니다. 새 실험을 시작하거나 읽기로 돌아가세요.",
            "not-calibrated": "웹캠을 연결한 뒤 9점 시선 보정을 진행해 주세요.",
            "insufficient-recent-gaze":
              "최근 시선 데이터가 부족합니다. 단어를 잠시 바라본 뒤 다시 Space를 누르세요.",
            "too-far-from-text":
              "시선이 글에서 너무 멉니다. 자세를 확인하거나 다시 보정해 주세요.",
            "target-not-visible":
              "목표 단어가 화면 밖에 있습니다. 다음 목표를 선택해 주세요.",
          } as Record<string, string>
        )[reason],
      );
  };
  const action = useRef(trigger);
  action.current = trigger;
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPopup(null);
        return;
      }
      if (
        e.code !== "Space" ||
        e.repeat ||
        e.isComposing ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        live.current.calibrating ||
        live.current.editing
      )
        return;
      if (
        e.target instanceof Element &&
        e.target.closest(
          'input,textarea,select,button,a,[contenteditable="true"]',
        )
      )
        return;
      e.preventDefault();
      action.current();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  const completeCalibration = (record: CalibrationRecord) => {
    setCalibration(record);
    persist({
      ...dataRef.current,
      calibrations: [...dataRef.current.calibrations, record],
    });
    setCalibrating(false);
    setMode("read");
    newRun();
    setNotice("보정이 완료되었습니다. 단어를 바라보고 Space를 누르세요.");
    focusReader();
  };
  const currentLogs = data.logs.filter(
      (l) => l.runId === runId && l.source === source,
    ),
    stats = metrics(currentLogs);
  const eligibleLearning = calibration
    ? learningLogs(data.logs, calibration.id).length
    : 0;
  const afterScrollStats = metrics(
    currentLogs.filter(
      (l) =>
        l.scroll?.msSinceScroll !== null &&
        l.scroll?.msSinceScroll !== undefined &&
        l.scroll.msSinceScroll < 2000,
    ),
  );
  const applyLearning = async () => {
    if (!calibration) return;
    const base = calibration;
    setLearningBusy(true);
    setLearningReport(null);
    await new Promise((resolve) => setTimeout(resolve, 0));
    try {
      const result = improveCalibration(base, dataRef.current.logs);
      setLearningReport(result.report);
      if (live.current.calibration?.id !== base.id) return;
      persist({
        ...dataRef.current,
        learningReports: [
          ...(dataRef.current.learningReports ?? []),
          {
            ...result.report,
            id: crypto.randomUUID(),
            createdAt: new Date().toISOString(),
            calibrationId: base.id,
            newCalibrationId: result.record?.id ?? null,
          },
        ],
      });
      if (result.record) {
        setCalibration(result.record);
        persist({
          ...dataRef.current,
          calibrations: [...dataRef.current.calibrations, result.record],
        });
        newRun();
        setProtocol("evaluation");
        setMode("read");
        setNotice(
          "개선된 보정을 적용했습니다. 새 평가 실험으로 단어 정확도를 확인하세요.",
        );
      } else
        setNotice(
          "별도 확인 데이터에서 충분한 개선이 없어 기존 보정을 유지합니다.",
        );
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setLearningBusy(false);
    }
  };
  const statsRef = useRef({ source, stats });
  const configureRun = (
    nextProtocol: "evaluation" | "training",
    nextGoal: number,
  ) => {
    newRun();
    setProtocol(nextProtocol);
    setTrialGoal(nextGoal);
    if (mode === "test") requestAnimationFrame(() => pickRef.current());
    focusReader();
  };
  statsRef.current = { source, stats };
  useEffect(() => {
    const context = (
      document as Document & {
        modelContext?: {
          registerTool: (
            tool: unknown,
            options: { signal: AbortSignal },
          ) => void | Promise<void>;
        };
      }
    ).modelContext;
    if (!context?.registerTool) return;
    const controller = new AbortController();
    try {
      void Promise.resolve(
        context.registerTool(
          {
            name: "read_experiment_metrics",
            description:
              "현재 Glimpse 실험의 입력 방식과 집계 정확도를 읽습니다. 원본 시선, 얼굴 특징, 본문은 반환하지 않습니다.",
            inputSchema: {
              type: "object",
              properties: {},
              additionalProperties: false,
            },
            annotations: { readOnlyHint: true },
            execute: (input: unknown) => {
              if (
                !input ||
                typeof input !== "object" ||
                Object.keys(input).length
              )
                throw new Error("Empty object required");
              return statsRef.current;
            },
          },
          { signal: controller.signal },
        ),
      ).catch(() => {});
    } catch {
      /* Optional browser API. */
    }
    return () => controller.abort();
  }, []);
  const validationError = calibration?.validation.length
    ? calibration.validation.reduce((s, v) => s + (v.pixelError ?? 0), 0) /
      calibration.validation.length
    : null;
  const applyText = () => {
    if (!tokenize(draft).length) {
      setNotice("영어 단어를 한 개 이상 입력해 주세요.");
      return;
    }
    setText(draft.slice(0, 50000));
    setTextId(crypto.randomUUID());
    setEditing(false);
    setMode("read");
    newRun();
    focusReader();
  };
  let cursor = 0;
  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="./index.html" aria-label="Glimpse 홈">
          <Eye size={24} />
          <strong>
            glimpse<span>.</span>
          </strong>
        </a>
        <span className="app-label">
          시선 추적 실험실 <span className="version">BETA</span>
        </span>
        <span className="local-badge">
          <i /> 기기 안에서 실험
        </span>
      </header>
      <main>
        <div className="intro">
          <div>
            <div className="eyebrow">
              A LITTLE LESS FRICTION. A LITTLE MORE DISCOVERY.
            </div>
            <h1>읽는 흐름은 그대로.</h1>
            <p>
              모르는 단어를 바라보고 <kbd>Space</kbd> 를 누르세요.
            </p>
          </div>
          <div className="flow">
            Look <span>→</span> Space <span>→</span> Meaning{" "}
            <ArrowUpRight size={18} />
          </div>
        </div>
        <div className="workspace">
          <div className="reader-column">
            <div className="mode-tabs" role="tablist" aria-label="읽기 모드">
              <button
                role="tab"
                aria-selected={mode === "read"}
                onClick={() => changeMode("read")}
              >
                <BookOpen size={14} /> 읽기
              </button>
              <button
                role="tab"
                aria-selected={mode === "test"}
                onClick={() => changeMode("test")}
                disabled={editing || !ready}
              >
                <FlaskConical size={14} /> 정확도 실험
              </button>
              <span>
                {scrolling
                  ? "스크롤 후 시선 대기"
                  : source === "mouse"
                    ? "마우스 시뮬레이션"
                    : calibration
                      ? "시선 보정 완료"
                      : "웹캠 연결 → 정밀 보정"}
              </span>
            </div>
            {mode === "test" && (
              <div className="test-banner">
                <Crosshair size={18} />
                <div>
                  <strong>
                    {runComplete
                      ? `${trialGoal}회 ${protocol === "training" ? "추가 학습" : "평가"} 완료`
                      : trialPending && lastLog?.trial
                        ? lastLog.trial.exactCorrect
                          ? "정확한 단어를 찾았어요."
                          : `예측: ${lastLog.trial.predictedWord ?? "선택 없음"}`
                        : `목표: ${tokens.find((t) => t.id === targetId)?.word ?? "—"}`}
                  </strong>
                  <p>
                    {runComplete
                      ? "결과를 확인하고 새 평가 또는 추가 학습을 진행하세요."
                      : scrolling
                        ? "스크롤이 멈춘 후 새 시선을 수집합니다."
                        : trialPending
                          ? "결과를 기록했습니다. 다음 목표를 준비합니다."
                          : "밑줄 표시된 단어를 바라보고 Space를 누르세요."}
                  </p>
                </div>
                <span>
                  {protocol === "training" ? "학습" : "평가"}{" "}
                  {Math.min(
                    trialGoal,
                    stats.trials + (trialPending || runComplete ? 0 : 1),
                  )}{" "}
                  / {trialGoal}
                </span>
                <button
                  disabled={runComplete}
                  onClick={() => {
                    if (nextTimer.current) clearTimeout(nextTimer.current);
                    pickTarget();
                    focusReader();
                  }}
                  aria-label="다음 목표 단어"
                >
                  <ArrowRight size={16} />
                </button>
              </div>
            )}
            <section className="reader-card">
              <div className="reader-toolbar">
                <span>
                  <i className="dot" /> READER{" "}
                  <span className="toolbar-separator">/</span> ENGLISH
                </span>
                <button
                  onClick={() => {
                    setDraft(text);
                    setEditing(!editing);
                    setPopup(null);
                    setMode("read");
                    setTargetId(null);
                    setTrialPending(false);
                    if (nextTimer.current) clearTimeout(nextTimer.current);
                  }}
                >
                  <FileText size={12} />{" "}
                  {editing ? "편집 닫기" : "텍스트 바꾸기"}
                </button>
              </div>
              {editing ? (
                <div className="editor">
                  <label htmlFor="reading-input">
                    읽고 싶은 영어 글을 붙여넣으세요.
                  </label>
                  <textarea
                    id="reading-input"
                    autoFocus
                    maxLength={50000}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                  />
                  <div className="button-row">
                    <button onClick={() => setDraft(SAMPLE)}>
                      샘플 불러오기
                    </button>
                    <button className="primary" onClick={applyText}>
                      읽기 시작 <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="article-heading">
                    <span className="eyebrow">
                      {text === SAMPLE
                        ? "ON CURIOSITY · SAMPLE TEXT"
                        : "YOUR WORDS · PERSONAL READING"}
                    </span>
                    <h2>
                      {text === SAMPLE
                        ? "The art of paying attention"
                        : "A new perspective"}
                    </h2>
                    <p>
                      {tokens.length} words <span>·</span>{" "}
                      {Math.max(1, Math.ceil(tokens.length / 130))} min read
                    </p>
                  </div>
                  <div
                    className="reading-text"
                    ref={reader}
                    tabIndex={0}
                    aria-label="영어 읽기 영역"
                  >
                    {tokens.map((token) => {
                      const gap = text.slice(cursor, token.start);
                      cursor = token.end;
                      return (
                        <Fragment key={token.id}>
                          {gap}
                          <span
                            data-token-id={token.id}
                            className={[
                              popup?.word.id === token.id ? "selected" : "",
                              mode === "test" && targetId === token.id
                                ? "test-target"
                                : "",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                          >
                            {token.word}
                          </span>
                        </Fragment>
                      );
                    })}
                    {text.slice(cursor)}
                  </div>
                  <footer className="reader-footer">
                    시선은 단어에. 뜻이 필요할 때만 <kbd>Space</kbd>
                    <span>EN → KO</span>
                  </footer>
                </>
              )}
            </section>
            {mode === "test" && (
              <section className="results-card">
                <div className="results-title">
                  <div>
                    <span className="eyebrow">THIS EXPERIMENT</span>
                    <h3>작은 실험, 확인 가능한 결과.</h3>
                  </div>
                  <span className="tiny-badge">
                    {source === "mouse"
                      ? "MOUSE · 시선 정확도 아님"
                      : protocol === "training"
                        ? "추가 학습 · 최종 평가 아님"
                        : "독립 평가 · 모델 고정"}
                  </span>
                </div>
                <div className="metric-grid">
                  {[
                    ["Exact word", pct(stats.exact)],
                    ["±1 word", pct(stats.adjacent)],
                    ["Top-3", pct(stats.top3)],
                    ["Correct line", pct(stats.line)],
                    ["Median error", px(stats.medianError)],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <strong>{value}</strong>
                      <span>{label}</span>
                    </div>
                  ))}
                </div>
                <p className="muted">
                  {stats.trials} trials · 미선택 {stats.noPrediction}회 포함 ·
                  오차 계산 {stats.errorCount}회
                </p>
                <p className="muted">
                  큰 오차 확인 · P90 {px(stats.p90Error)} · 정답률 95% 구간{" "}
                  {stats.exactInterval
                    ? `${pct(stats.exactInterval[0])}–${pct(stats.exactInterval[1])}`
                    : "—"}
                </p>
                <p className="muted">
                  스크롤 후 2초 이내: {afterScrollStats.trials}회 · Exact{" "}
                  {pct(afterScrollStats.exact)} · 오차{" "}
                  {px(afterScrollStats.medianError)}
                </p>
                {protocol === "training" && (
                  <p className="muted">
                    추가 학습은 정답 단어의 화면 위치와 눈 특징을 저장합니다.
                    모델은 ‘학습 반영’ 전까지 고정되며, 적용 후 새 평가 데이터로
                    성능을 확인하세요.
                  </p>
                )}
              </section>
            )}
          </div>
          <aside>
            <section className="panel">
              <div className="panel-title">
                <Eye size={16} /> 시선 연결{" "}
                <span className="tiny-badge">
                  {source === "mouse"
                    ? "SIMULATION"
                    : ready
                      ? "READY"
                      : "SETUP"}
                </span>
              </div>
              <div className="source-switch" aria-label="입력 방식">
                <button
                  aria-pressed={source === "webcam"}
                  onClick={() => changeSource("webcam")}
                >
                  <Camera size={13} /> 웹캠
                </button>
                <button
                  aria-pressed={source === "mouse"}
                  onClick={() => changeSource("mouse")}
                >
                  <MousePointer2 size={13} /> 마우스
                </button>
              </div>
              <div hidden={source !== "webcam"}>
                <CameraPanel
                  enabled={source === "webcam"}
                  onStatus={onCameraStatus}
                  onFrame={onFrame}
                />
                <div className="calibration-row">
                  <span>
                    <i className={calibration ? "ready-dot" : "waiting-dot"} />
                    {calibration
                      ? calibration.learning
                        ? "추가 학습 확인 오차"
                        : `${calibration.plan?.points ?? 9}점 보정 완료`
                      : "시선 보정이 필요해요"}
                  </span>
                  <span>{calibration ? px(validationError) : "미보정"}</span>
                </div>
                <button
                  className="full"
                  disabled={cameraStatus !== "tracking"}
                  onClick={() => {
                    setPopup(null);
                    setMode("read");
                    setCalibrating(true);
                    clearHistory();
                  }}
                >
                  <Crosshair size={14} />
                  {calibration ? "다시 보정하기" : "정밀 시선 보정"}
                </button>
              </div>
              {source === "mouse" && (
                <div className="mouse-guide">
                  <MousePointer2 size={27} />
                  <h3>카메라 없이 먼저 살펴보기</h3>
                  <p>
                    단어 위에 마우스를 두고
                    <br />
                    잠시 기다린 뒤 Space를 누르세요.
                  </p>
                  <span>시뮬레이션 결과는 웹캠 결과와 분리됩니다.</span>
                </div>
              )}
            </section>
            <section className="panel debug-panel">
              <div className="panel-title">
                <Activity size={15} /> 실시간 신호{" "}
                <label className="toggle">
                  <input
                    type="checkbox"
                    aria-label="시선 점 표시"
                    checked={overlay}
                    onChange={(e) => setOverlay(e.target.checked)}
                  />
                  <span />
                </label>
              </div>
              <div className="debug-caption">
                {source === "mouse"
                  ? "MOUSE INPUT"
                  : calibration
                    ? "CALIBRATED GAZE"
                    : "RAW · 보정 전 참고 좌표"}
                <span>{source === "mouse" ? "25 Hz" : `${fps} Hz`}</span>
              </div>
              <div className="coordinate-grid">
                <div>
                  <span>X</span>
                  <strong>{gaze ? Math.round(gaze.x) : "—"}</strong>
                  <small>px</small>
                </div>
                <div>
                  <span>Y</span>
                  <strong>{gaze ? Math.round(gaze.y) : "—"}</strong>
                  <small>px</small>
                </div>
              </div>
              <div className="data-row">
                <span>가장 가까운 단어</span>
                <strong>{nearest}</strong>
              </div>
              <div className="data-row">
                <span>Space 선택</span>
                <strong>{lastLog?.selectedWord ?? "—"}</strong>
              </div>
              <div className="data-row">
                <span>선택 신뢰도</span>
                <strong>{lastLog ? pct(lastLog.confidence) : "—"}</strong>
              </div>
              <div className="data-row">
                <span>거리 / 흔들림</span>
                <code>
                  {px(lastLog?.candidateWords[0]?.distance)} /{" "}
                  {px(lastLog?.fixation?.spread)}
                </code>
              </div>
              <div className="data-row">
                <span>사용한 샘플</span>
                <code>
                  {lastLog?.fixation
                    ? `${lastLog.fixation.usedCount} / ${lastLog.fixation.sampleCount}`
                    : "—"}{" "}
                  <span>· 400 ms</span>
                </code>
              </div>
              {lastLog?.candidateWords.length ? (
                <div className="candidate-list">
                  {lastLog.candidateWords.map((c, i) => (
                    <span key={c.id}>
                      {i + 1}. {c.word} <b>{Math.round(c.score * 100)}</b>
                    </span>
                  ))}
                </div>
              ) : null}
              <p className="debug-footnote">
                신뢰도는 거리·시선 안정성의 참고 점수입니다.
              </p>
            </section>
            <section className="panel experiment-panel">
              <div className="panel-title">
                <FlaskConical size={15} /> 실험 기록{" "}
                <span className="record-count">{stats.trials}</span>
              </div>
              <div className="experiment-options">
                <label>
                  실험 목적
                  <select
                    aria-label="실험 목적"
                    value={protocol}
                    onChange={(e) =>
                      configureRun(
                        e.target.value as "evaluation" | "training",
                        trialGoal,
                      )
                    }
                    disabled={learningBusy}
                  >
                    <option value="evaluation">평가 전용</option>
                    <option value="training" disabled={source !== "webcam"}>
                      추가 학습
                    </option>
                  </select>
                </label>
                <label>
                  시행 수
                  <select
                    aria-label="실험 시행 수"
                    value={trialGoal}
                    onChange={(e) =>
                      configureRun(protocol, Number(e.target.value))
                    }
                    disabled={learningBusy}
                  >
                    {[50, 100, 200].map((n) => (
                      <option key={n} value={n}>
                        {n}회
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <p className="protocol-note">
                {protocol === "training"
                  ? "목표 단어를 보며 수집 → 학습 반영 → 새 평가"
                  : "이번 실험 중 모델을 바꾸지 않고 정확도를 측정합니다."}
              </p>
              <div className="experiment-summary">
                <div>
                  <strong>{pct(stats.exact)}</strong>
                  <span>Exact word</span>
                </div>
                <div>
                  <strong>{px(stats.medianError)}</strong>
                  <span>Median error</span>
                </div>
              </div>
              <p className="muted">
                {stats.trials
                  ? `이번 ${source === "mouse" ? "마우스" : "웹캠"} 실험의 결과입니다.`
                  : "실험을 시작하면 정확도가 여기에 쌓입니다."}
              </p>
              <button
                className="full"
                disabled={!ready || editing}
                onClick={() => {
                  if (mode === "test") {
                    newRun();
                    pickTarget();
                    focusReader();
                  } else changeMode("test");
                }}
              >
                {mode === "test" ? (
                  <RotateCcw size={13} />
                ) : (
                  <ArrowRight size={13} />
                )}{" "}
                {mode === "test" ? "새 실험 시작" : "정확도 실험 시작"}
              </button>
              {source === "webcam" && (
                <div className="learning-control">
                  <span>현재 보정의 유효 학습 {eligibleLearning}회</span>
                  <button
                    className="full"
                    disabled={
                      !calibration ||
                      eligibleLearning < 30 ||
                      learningBusy ||
                      calibrating
                    }
                    onClick={applyLearning}
                  >
                    {learningBusy
                      ? "별도 데이터로 개선 확인 중…"
                      : "학습 반영 · 개선될 때만 적용"}
                  </button>
                  <small>
                    최소 30회·15개 화면 영역 필요. 전체의 약 25%는 모델 적용
                    확인용으로 남깁니다.
                  </small>
                </div>
              )}
              {learningReport && (
                <div className="learning-report" role="status">
                  <strong>
                    {learningReport.accepted
                      ? "새 보정 적용"
                      : "기존 보정 유지"}
                  </strong>
                  <p>
                    별도 {learningReport.holdoutTrials}회 확인
                    <br />
                    중앙값 {px(learningReport.beforeMedian)} →{" "}
                    {px(learningReport.afterMedian)}
                    <br />
                    P90 {px(learningReport.beforeP90)} →{" "}
                    {px(learningReport.afterP90)}
                  </p>
                  <small>
                    이 수치는 모델 선택용입니다. 새 평가 실험이 최종 확인입니다.
                  </small>
                </div>
              )}
              <div className="export-row">
                <span>
                  <Download size={12} /> 전체 {data.logs.length}개
                </span>
                <button
                  disabled={!data.logs.length && !data.calibrations.length}
                  onClick={() => downloadData(data, "json")}
                >
                  JSON
                </button>
                <button
                  disabled={!data.logs.length}
                  onClick={() => downloadData(data, "csv")}
                >
                  CSV
                </button>
              </div>
              {storageError && (
                <p className="error-text" role="alert">
                  {storageError}
                </p>
              )}
              <button
                className="delete-experiments"
                onClick={() => {
                  if (
                    !window.confirm(
                      "이 브라우저의 실험 기록과 보정을 모두 삭제할까요? 되돌릴 수 없습니다. 필요한 기록은 먼저 JSON으로 내보내세요.",
                    )
                  )
                    return;
                  const error = deleteExperimentData();
                  if (error) setStorageError(error);
                  else window.location.reload();
                }}
              >
                실험 기록 삭제
              </button>
            </section>
            <div className="side-note">
              01 / READING EXPERIMENT
              <br />
              일반 웹캠으로, 단어 수준의 시선을 찾을 수 있을까요?
            </div>
          </aside>
        </div>
      </main>
      <footer className="app-footer">
        <span>GLIMPSE — A READING EXPERIMENT</span>
        <span>Look closer. Keep reading.</span>
      </footer>
      {overlay && gaze && !calibrating && (
        <div
          className={`gaze-dot ${!calibration && source === "webcam" ? "raw" : ""}`}
          style={{ left: gaze.x, top: gaze.y }}
          aria-hidden="true"
        />
      )}
      {popup && !calibrating && (
        <MeaningPopup
          key={popup.id}
          word={popup.word}
          triggerId={popup.id}
          onClose={() => setPopup(null)}
        />
      )}
      {notice && (
        <div className="notice" role="status">
          <Check size={15} />
          {notice}
        </div>
      )}
      {calibrating && (
        <Calibration
          getFrame={() => frame.current}
          onClose={() => {
            setCalibrating(false);
            clearHistory();
            focusReader();
          }}
          onDone={completeCalibration}
        />
      )}
    </div>
  );
}
