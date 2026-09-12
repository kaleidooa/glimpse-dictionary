import { t as tr } from "./i18n";
import { median, type Point } from "./selection";
export type CalibrationRow = {
  features: number[];
  target: Point;
  pointIndex: number;
  timestamp: number;
  quality: number;
};
export type RidgeModel = {
  featureMode?: "linear" | "quadratic";
  offset?: Point;
  means: number[];
  scales: number[];
  weightsX: number[];
  weightsY: number[];
  lambda: number;
  trainingError: number;
};
export type ValidationPoint = {
  target: Point;
  predicted: Point | null;
  pixelError: number | null;
  sampleCount: number;
};
export type CalibrationRecord = {
  id: string;
  createdAt: string;
  viewport: { width: number; height: number; dpr: number };
  rows: CalibrationRow[];
  model: RidgeModel;
  validation: ValidationPoint[];
  plan?: { points: number; repeats: number };
  selection?: ModelSelection;
  parentId?: string;
  learning?: LearningReport;
};
export type ModelSelection = {
  folds: number;
  groups: number;
  meanError: number;
  candidates: { mode: "linear" | "quadratic"; lambda: number; error: number }[];
};
export type LearningReport = {
  accepted: boolean;
  method: string;
  trainingTrials: number;
  holdoutTrials: number;
  beforeMedian: number;
  afterMedian: number;
  beforeP90: number;
  afterP90: number;
};
function expand(features: number[], mode: "linear" | "quadratic" = "linear") {
  if (mode === "linear") return features;
  const h =
    features.length >= 4 ? (features[0] + features[2]) / 2 : features[0];
  const v =
    features.length >= 4 ? (features[1] + features[3]) / 2 : features[1];
  return [...features, h * h, h * v, v * v];
}
function solve(matrix: number[][], rhs: number[]): number[] {
  const a = matrix.map((row, i) => [...row, rhs[i]]),
    n = rhs.length;
  for (let i = 0; i < n; i++) {
    let pivot = i;
    for (let k = i + 1; k < n; k++)
      if (Math.abs(a[k][i]) > Math.abs(a[pivot][i])) pivot = k;
    [a[i], a[pivot]] = [a[pivot], a[i]];
    if (Math.abs(a[i][i]) < 1e-10)
      throw new Error(
        tr(
          "Calibration data is not diverse enough. Please recalibrate.",
          "보정 데이터가 충분히 다양하지 않습니다. 다시 보정해 주세요.",
        ),
      );
    const divisor = a[i][i];
    for (let j = i; j <= n; j++) a[i][j] /= divisor;
    for (let k = 0; k < n; k++) {
      if (k === i) continue;
      const factor = a[k][i];
      for (let j = i; j <= n; j++) a[k][j] -= factor * a[i][j];
    }
  }
  return a.map((row) => row[n]);
}
export function predict(model: RidgeModel, features: number[]): Point {
  const v = [
    1,
    ...expand(features, model.featureMode).map(
      (f, i) => (f - model.means[i]) / model.scales[i],
    ),
  ];
  return {
    x:
      v.reduce((s, f, i) => s + f * model.weightsX[i], 0) +
      (model.offset?.x ?? 0),
    y:
      v.reduce((s, f, i) => s + f * model.weightsY[i], 0) +
      (model.offset?.y ?? 0),
  };
}
export function trainRidge(
  rawRows: CalibrationRow[],
  regularization = 0.015,
  featureMode: "linear" | "quadratic" = "linear",
): RidgeModel {
  const rows = rawRows.map((r) => ({
    ...r,
    features: expand(r.features, featureMode),
  }));
  if (rows.length < 20)
    throw new Error(
      tr(
        "Not enough calibration samples. Check lighting and face position.",
        "보정 샘플이 부족합니다. 조명과 얼굴 위치를 확인해 주세요.",
      ),
    );
  const n = rows.length,
    d = rows[0].features.length;
  if (
    rows.some(
      (r) => r.features.length !== d || !r.features.every(Number.isFinite),
    )
  )
    throw new Error(
      tr("Invalid calibration data.", "유효하지 않은 보정 데이터입니다."),
    );
  const means = Array.from(
    { length: d },
    (_, i) => rows.reduce((s, r) => s + r.features[i], 0) / n,
  );
  const scales = means.map((m, i) =>
    Math.sqrt(rows.reduce((s, r) => s + (r.features[i] - m) ** 2, 0) / n),
  );
  if (scales.every((s) => s < 0.0001))
    throw new Error(
      tr(
        "No gaze movement detected. Hold your head still and look at each point.",
        "시선의 변화가 감지되지 않았습니다. 머리를 고정하고 각 점을 바라봐 주세요.",
      ),
    );
  const safeScales = scales.map((s) => Math.max(0.0001, s));
  const x = rows.map((r) => [
    1,
    ...r.features.map((f, i) => (f - means[i]) / safeScales[i]),
  ]);
  const matrix = Array.from({ length: d + 1 }, (_, i) =>
    Array.from(
      { length: d + 1 },
      (_, j) =>
        x.reduce((s, r) => s + r[i] * r[j], 0) +
        (i === j && i > 0 ? regularization * n : 0),
    ),
  );
  const fit = (key: "x" | "y") =>
    solve(
      matrix,
      Array.from({ length: d + 1 }, (_, i) =>
        x.reduce((s, r, k) => s + r[i] * rows[k].target[key], 0),
      ),
    );
  const model: RidgeModel = {
    featureMode,
    means,
    scales: safeScales,
    weightsX: fit("x"),
    weightsY: fit("y"),
    lambda: regularization,
    trainingError: 0,
  };
  model.trainingError =
    rawRows.reduce((s, r) => {
      const p = predict(model, r.features);
      return s + Math.hypot(p.x - r.target.x, p.y - r.target.y);
    }, 0) / n;
  return model;
}
export function cleanCalibrationRows(rows: CalibrationRow[]): CalibrationRow[] {
  if (!rows.length) return [];
  const centers = rows[0].features.map((_, i) =>
    median(rows.map((r) => r.features[i])),
  );
  const deviations = centers.map((m, i) =>
    Math.max(
      0.002,
      median(rows.map((r) => Math.abs(r.features[i] - m))) * 1.4826,
    ),
  );
  return rows.filter((r) =>
    r.features.every((f, i) => Math.abs(f - centers[i]) <= 4 * deviations[i]),
  );
}
export function gridPoints(width: number, height: number, size = 3): Point[] {
  return Array.from(
    { length: size },
    (_, i) => 0.14 + (0.72 * i) / (size - 1),
  ).flatMap((y) =>
    Array.from({ length: size }, (_, i) => 0.12 + (0.76 * i) / (size - 1)).map(
      (x) => ({
        x: Math.round(x * width),
        y: Math.round(y * height),
      }),
    ),
  );
}
// All repeated frames at a spatial location stay in the same fold.
export const spatialKey = (p: Point) =>
  `${Math.round(p.x / 24)}:${Math.round(p.y / 24)}`;
export function groupedKeys(rows: { target: Point }[]): string[] {
  const hash = (key: string) =>
    [...key].reduce(
      (n, c) => Math.imul(n ^ c.charCodeAt(0), 16777619) >>> 0,
      2166136261,
    );
  return [...new Set(rows.map((r) => spatialKey(r.target)))].sort(
    (a, b) => hash(a) - hash(b),
  );
}
export function selectModel(rows: CalibrationRow[]): {
  model: RidgeModel;
  selection: ModelSelection;
} {
  const groups = groupedKeys(rows),
    folds = Math.min(5, groups.length);
  if (folds < 3)
    throw new Error(
      tr(
        "Not enough training data from different screen positions.",
        "서로 다른 화면 위치의 학습 데이터가 부족합니다.",
      ),
    );
  const assignments = new Map(groups.map((g, i) => [g, i % folds]));
  const candidates: ModelSelection["candidates"] = [];
  const modes: ("linear" | "quadratic")[] =
    groups.length >= 15 ? ["linear", "quadratic"] : ["linear"];
  for (const mode of modes)
    for (const lambda of [0.005, 0.03, 0.15]) {
      const errors: number[] = [];
      for (let fold = 0; fold < folds; fold++) {
        const training = rows.filter(
          (r) => assignments.get(spatialKey(r.target)) !== fold,
        );
        const held = rows.filter(
          (r) => assignments.get(spatialKey(r.target)) === fold,
        );
        const model = trainRidge(training, lambda, mode);
        for (const group of groupedKeys(held)) {
          const points = held.filter((r) => spatialKey(r.target) === group);
          const predicted = points.map((r) => predict(model, r.features));
          errors.push(
            Math.hypot(
              median(predicted.map((p) => p.x)) - points[0].target.x,
              median(predicted.map((p) => p.y)) - points[0].target.y,
            ),
          );
        }
      }
      candidates.push({
        mode,
        lambda,
        error: errors.reduce((a, b) => a + b, 0) / errors.length,
      });
    }
  candidates.sort((a, b) => a.error - b.error);
  const best = candidates[0],
    simpler = candidates.find(
      (c) => c.mode === "linear" && c.error <= best.error * 1.05,
    );
  const chosen = simpler ?? best;
  return {
    model: trainRidge(rows, chosen.lambda, chosen.mode),
    selection: {
      folds,
      groups: groups.length,
      meanError: chosen.error,
      candidates,
    },
  };
}
