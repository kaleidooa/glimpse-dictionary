import {
  median,
  type Candidate,
  type Fixation,
  type GazeSample,
  type WordBox,
} from "./selection";
import type { CalibrationRecord } from "./calibration";
import type { LearningReport } from "./calibration";
import type { LearningExample } from "./learning";
export type InputSource = "webcam" | "mouse";
export type Trial = {
  targetWord: string;
  targetId: number;
  targetBox: WordBox;
  predictedWord: string | null;
  predictedId: number | null;
  exactCorrect: boolean;
  adjacentCorrect: boolean;
  top3Correct: boolean;
  lineCorrect: boolean;
  pixelError: number | null;
};
export type TriggerLog = {
  id: string;
  runId: string;
  textId: string;
  timestamp: string;
  performanceTimestamp: number;
  source: InputSource;
  mode: "read" | "test";
  protocol?: "evaluation" | "training";
  trialGoal?: number;
  learningExample?: LearningExample;
  scroll?: {
    x: number;
    y: number;
    revision: number;
    msSinceScroll: number | null;
  };
  calibrationId: string | null;
  word: string | null;
  sentence: string;
  selectedWord: string | null;
  selectedId: number | null;
  gazeX: number | null;
  gazeY: number | null;
  confidence: number;
  fixation: Fixation | null;
  candidateWords: Candidate[];
  samples: GazeSample[];
  reason: string | null;
  viewport: { width: number; height: number; dpr: number };
  trial: Trial | null;
};
export type ExperimentData = {
  version: 1;
  logs: TriggerLog[];
  calibrations: CalibrationRecord[];
  learningReports?: (LearningReport & {
    id: string;
    createdAt: string;
    calibrationId: string;
    newCalibrationId: string | null;
  })[];
};
export function evaluateTrial(
  target: WordBox,
  selected: Candidate | undefined,
  candidates: Candidate[],
  fixation: Fixation | null,
): Trial {
  return {
    targetWord: target.word,
    targetId: target.id,
    targetBox: target,
    predictedWord: selected?.word ?? null,
    predictedId: selected?.id ?? null,
    exactCorrect: selected?.id === target.id,
    adjacentCorrect:
      selected !== undefined && Math.abs(selected.id - target.id) <= 1,
    top3Correct: candidates.some((c) => c.id === target.id),
    lineCorrect: selected?.line === target.line,
    pixelError: fixation
      ? Math.hypot(
          fixation.x - (target.left + target.right) / 2,
          fixation.y - (target.top + target.bottom) / 2,
        )
      : null,
  };
}
export function metrics(logs: TriggerLog[]) {
  const trials = logs.flatMap((l) => (l.trial ? [l.trial] : [])),
    n = trials.length;
  const rate = (
    key: "exactCorrect" | "adjacentCorrect" | "top3Correct" | "lineCorrect",
  ) => (n ? trials.filter((t) => t[key]).length / n : null);
  const errors = trials.flatMap((t) =>
    t.pixelError === null ? [] : [t.pixelError],
  );
  return {
    trials: n,
    exact: rate("exactCorrect"),
    adjacent: rate("adjacentCorrect"),
    top3: rate("top3Correct"),
    line: rate("lineCorrect"),
    medianError: errors.length ? median(errors) : null,
    errorCount: errors.length,
    noPrediction: trials.filter((t) => t.predictedId === null).length,
    p90Error: errors.length
      ? [...errors].sort((a, b) => a - b)[Math.ceil(errors.length * 0.9) - 1]
      : null,
    exactInterval: wilson(trials.filter((t) => t.exactCorrect).length, n),
  };
}
export function wilson(success: number, n: number): [number, number] | null {
  if (!n) return null;
  const z = 1.96,
    p = success / n,
    d = 1 + (z * z) / n;
  const center = (p + (z * z) / (2 * n)) / d,
    half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.max(0, center - half), Math.min(1, center + half)];
}
const STORAGE_KEY = "glimpse.experiment.v1";
export function deleteExperimentData(): string | null {
  try {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  } catch {
    return "기록을 지우지 못했습니다. 브라우저의 사이트 데이터 설정을 확인해 주세요.";
  }
}
export function loadData(): { data: ExperimentData; error: string | null } {
  const empty: ExperimentData = { version: 1, logs: [], calibrations: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { data: empty, error: null };
    const data = JSON.parse(raw);
    if (
      data.version !== 1 ||
      !Array.isArray(data.logs) ||
      !Array.isArray(data.calibrations)
    )
      throw new Error();
    return { data, error: null };
  } catch {
    return {
      data: empty,
      error:
        "이전 기록을 읽지 못했습니다. 이번 기록은 메모리에 보관됩니다. 내보내기를 이용해 주세요.",
    };
  }
}
export function saveData(data: ExperimentData): string | null {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return null;
  } catch {
    return "브라우저 저장 공간이 부족하거나 사용할 수 없습니다. 이번 기록을 잃지 않도록 내보내기를 해 주세요.";
  }
}
export function toCsv(logs: TriggerLog[]): string {
  const headers = [
    "timestamp",
    "runId",
    "textId",
    "source",
    "mode",
    "calibrationId",
    "protocol",
    "trialGoal",
    "scroll",
    "selectedId",
    "selectedWord",
    "sentence",
    "gazeX",
    "gazeY",
    "confidence",
    "reason",
    "targetId",
    "targetWord",
    "exactCorrect",
    "adjacentCorrect",
    "top3Correct",
    "lineCorrect",
    "pixelError",
    "candidateWords",
    "sampleCount",
    "usedCount",
    "spread",
    "viewport",
  ];
  const escape = (value: unknown) => {
    let s =
      value === null || value === undefined
        ? ""
        : typeof value === "object"
          ? JSON.stringify(value)
          : String(value);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  };
  const lines = logs.map((log) => {
    const row: Record<string, unknown> = {
      ...log,
      ...log.trial,
      sampleCount: log.fixation?.sampleCount,
      usedCount: log.fixation?.usedCount,
      spread: log.fixation?.spread,
    };
    return headers.map((h) => escape(row[h])).join(",");
  });
  return "\ufeff" + [headers.join(","), ...lines].join("\r\n");
}
export function downloadData(data: ExperimentData, format: "json" | "csv") {
  const blob = new Blob(
    [format === "json" ? JSON.stringify(data, null, 2) : toCsv(data.logs)],
    { type: format === "json" ? "application/json" : "text/csv;charset=utf-8" },
  );
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = `glimpse-${new Date().toISOString().replace(/[:.]/g, "-")}.${format}`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
