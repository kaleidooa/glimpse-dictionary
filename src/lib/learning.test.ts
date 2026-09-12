import { describe, it, expect } from "vitest";
import { improveCalibration } from "./learning";
import {
  predict,
  selectModel,
  trainRidge,
  spatialKey,
  type CalibrationRecord,
  type CalibrationRow,
} from "./calibration";
import type { TriggerLog } from "./experiment";
import { ScrollGuard, chooseBalancedTarget } from "./scroll";
import { wilson } from "./experiment";
const baseRows: CalibrationRow[] = [];
for (let i = 0; i < 5; i++)
  for (let j = 0; j < 5; j++)
    for (let k = 0; k < 10; k++)
      baseRows.push({
        features: [i / 4, j / 4],
        target: { x: 100 + (800 * i) / 4, y: 80 + (600 * j) / 4 },
        pointIndex: i * 5 + j,
        timestamp: k,
        quality: 1,
      });
const baseline = (): CalibrationRecord => ({
  id: "base",
  createdAt: "test",
  viewport: { width: 1200, height: 900, dpr: 1 },
  rows: baseRows,
  model: trainRidge(baseRows, 0.000001),
  validation: [],
});
const makeLogs = (
  base: CalibrationRecord,
  dx: number,
  dy: number,
): TriggerLog[] =>
  Array.from({ length: 60 }, (_, i) => {
    const features = [
        0.05 + (i % 10) * 0.095,
        0.06 + Math.floor(i / 10) * 0.17,
      ],
      p = predict(base.model, features);
    return {
      id: String(i),
      calibrationId: base.id,
      protocol: "training",
      source: "webcam",
      learningExample: {
        target: { x: p.x + dx, y: p.y + dy },
        frames: Array.from({ length: 8 }, (_, k) => ({
          features,
          timestamp: 100000 + i * 100 + k,
          quality: 1,
        })),
      },
    } as TriggerLog;
  });
describe("supervised reading adaptation", () => {
  it("corrects a known drift using training data and reports unseen trials separately", () => {
    const base = baseline(),
      logs = makeLogs(base, 70, -45),
      result = improveCalibration(base, logs);
    expect(result.report.accepted).toBe(true);
    expect(result.report.afterMedian).toBeLessThan(1);
    expect(result.report.beforeMedian).toBeGreaterThan(80);
    expect(result.report.holdoutTrials).toBeGreaterThanOrEqual(5);
    expect(result.record?.parentId).toBe(base.id);
    const held = new Set(
      result.record!.validation.map((v) => spatialKey(v.target)),
    );
    expect(
      result.record!.rows.every((r) => !held.has(spatialKey(r.target))),
    ).toBe(true);
  });
  it("never learns from evaluation or mouse trials", () => {
    const base = baseline(),
      logs = makeLogs(base, 70, -45);
    const poison = makeLogs(base, 1000, 1000).flatMap((l) => [
      { ...l, protocol: "evaluation" as const },
      { ...l, source: "mouse" as const },
    ]);
    expect(improveCalibration(base, [...logs, ...poison]).report).toEqual(
      improveCalibration(base, logs).report,
    );
  });
  it("preserves a model when the check set does not improve", () => {
    const base = baseline(),
      result = improveCalibration(base, makeLogs(base, 0, 0));
    expect(result.report.accepted).toBe(false);
    expect(result.record).toBeNull();
  });
  it("requires enough distinct target regions", () => {
    const base = baseline(),
      logs = makeLogs(base, 70, -45).map((l) => ({
        ...l,
        learningExample: { ...l.learningExample!, target: { x: 100, y: 100 } },
      }));
    expect(() => improveCalibration(base, logs)).toThrow(/15개/);
  });
});
it("selects nonlinearity for a nonlinear mapping using held-out target groups", () => {
  const rows = baseRows.map((r) => ({
    ...r,
    target: {
      x: 100 + 500 * r.features[0] + 300 * r.features[0] ** 2,
      y: 80 + 600 * r.features[1],
    },
  }));
  const result = selectModel(rows);
  expect(result.model.featureMode).toBe("quadratic");
  expect(result.selection.groups).toBe(25);
  expect(result.selection.folds).toBe(5);
  const p = predict(result.model, [0.33, 0.67]);
  expect(Math.abs(p.x - (100 + 500 * 0.33 + 300 * 0.33 ** 2))).toBeLessThan(15);
});
it("blocks continuous scrolling and uses a fixed settling interval", () => {
  const guard = new ScrollGuard();
  expect(guard.isSettling(0)).toBe(false);
  guard.mark(100);
  guard.mark(240);
  expect(guard.isSettling(400)).toBe(true);
  expect(guard.isSettling(420)).toBe(false);
  expect(guard.revision).toBe(2);
});
it("assigns targets to less sampled screen regions", () => {
  const boxes = [
    { id: 1, left: 10, right: 40, top: 20, bottom: 40 },
    { id: 2, left: 800, right: 820, top: 600, bottom: 620 },
  ] as Parameters<typeof chooseBalancedTarget>[0];
  const visits = new Map<string, number>();
  expect(chooseBalancedTarget(boxes, visits, 1000, 800, () => 0)?.id).toBe(1);
  expect(chooseBalancedTarget(boxes, visits, 1000, 800, () => 0)?.id).toBe(2);
});
it("shows narrower uncertainty with more trials instead of claiming a higher accuracy", () => {
  const small = wilson(8, 10)!,
    large = wilson(80, 100)!;
  expect(large[1] - large[0]).toBeLessThan(small[1] - small[0]);
  expect(wilson(0, 0)).toBeNull();
});
