import {
  groupedKeys,
  predict,
  selectModel,
  spatialKey,
  type CalibrationRecord,
  type CalibrationRow,
  type LearningReport,
} from "./calibration";
import { median, type Point } from "./selection";
import type { TriggerLog } from "./experiment";
export type LearningExample = {
  target: Point;
  frames: { features: number[]; timestamp: number; quality: number }[];
};
export function learningLogs(logs: TriggerLog[], calibrationId: string) {
  return logs.filter(
    (l) =>
      l.source === "webcam" &&
      l.protocol === "training" &&
      l.calibrationId === calibrationId &&
      l.learningExample &&
      l.learningExample.frames.length >= 4,
  );
}
export function improveCalibration(
  base: CalibrationRecord,
  logs: TriggerLog[],
): { record: CalibrationRecord | null; report: LearningReport } {
  const usable = learningLogs(logs, base.id),
    examples = usable.map((l) => l.learningExample!);
  if (examples.length < 30)
    throw new Error("안정적인 추가 학습 30회 이상이 필요합니다.");
  const keys = groupedKeys(examples);
  if (keys.length < 15)
    throw new Error(
      "화면의 다양한 위치에서 측정해 주세요. 서로 다른 15개 영역이 필요합니다.",
    );
  const heldKeys = new Set(keys.filter((_, i) => i % 4 === 0));
  const train = examples.filter((e) => !heldKeys.has(spatialKey(e.target))),
    held = examples.filter((e) => heldKeys.has(spatialKey(e.target)));
  if (held.length < 5) throw new Error("별도 확인용 데이터가 부족합니다.");
  const added: CalibrationRow[] = train.flatMap((e, i) =>
    e.frames.map((f) => ({ ...f, target: e.target, pointIndex: 1000 + i })),
  );
  // Do not reintroduce held-out spatial groups through the original point calibration.
  const rows = [
    ...base.rows.filter((r) => !heldKeys.has(spatialKey(r.target))),
    ...added,
  ];
  const fitted = selectModel(rows);
  const centers = (
    model: CalibrationRecord["model"],
    items: LearningExample[],
  ) =>
    items.map((e) => {
      const p = e.frames.map((f) => predict(model, f.features));
      return { x: median(p.map((p) => p.x)), y: median(p.map((p) => p.y)) };
    });
  const original = centers(base.model, train);
  const drift = {
    x: median(train.map((e, i) => e.target.x - original[i].x)),
    y: median(train.map((e, i) => e.target.y - original[i].y)),
  };
  const shifted = {
    ...base.model,
    offset: {
      x: (base.model.offset?.x ?? 0) + drift.x,
      y: (base.model.offset?.y ?? 0) + drift.y,
    },
  };
  const errorOf = (model: CalibrationRecord["model"]) =>
    centers(model, held).map((p, i) =>
      Math.hypot(p.x - held[i].target.x, p.y - held[i].target.y),
    );
  const before = errorOf(base.model);
  const choices = [
    { model: fitted.model, method: "ridge-refit" },
    { model: shifted, method: "drift-offset" },
  ]
    .map((c) => ({ ...c, errors: errorOf(c.model) }))
    .sort((a, b) => median(a.errors) - median(b.errors));
  const choice = choices[0],
    p90 = (v: number[]) =>
      [...v].sort((a, b) => a - b)[Math.ceil(v.length * 0.9) - 1];
  const report: LearningReport = {
    accepted:
      median(choice.errors) < median(before) * 0.95 &&
      p90(choice.errors) <= p90(before) * 1.05,
    method: choice.method,
    trainingTrials: train.length,
    holdoutTrials: held.length,
    beforeMedian: median(before),
    afterMedian: median(choice.errors),
    beforeP90: p90(before),
    afterP90: p90(choice.errors),
  };
  const predicted = centers(choice.model, held);
  return {
    report,
    record: report.accepted
      ? {
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          viewport: base.viewport,
          rows,
          model: choice.model,
          selection:
            choice.method === "ridge-refit" ? fitted.selection : base.selection,
          parentId: base.id,
          learning: report,
          plan: base.plan,
          validation: held.map((e, i) => ({
            target: e.target,
            predicted: predicted[i],
            pixelError: choice.errors[i],
            sampleCount: e.frames.length,
          })),
        }
      : null,
  };
}
