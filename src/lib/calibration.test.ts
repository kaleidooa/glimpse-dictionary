import { describe, it, expect } from "vitest";
import {
  trainRidge,
  predict,
  gridPoints,
  type CalibrationRow,
} from "./calibration";
import { extractFeatures, type Landmark } from "./features";
describe("calibration", () => {
  it("learns a feature-to-viewport mapping on independent held-out positions", () => {
    const rows: CalibrationRow[] = [];
    for (const x of [-1, 0, 1])
      for (const y of [-1, 0, 1])
        for (let i = 0; i < 10; i++)
          rows.push({
            features: [x, y],
            target: { x: 600 + 400 * x + 40 * y, y: 450 + 300 * y },
            pointIndex: rows.length,
            timestamp: 0,
            quality: 1,
          });
    const model = trainRidge(rows);
    for (const [x, y] of [
      [0.35, -0.6],
      [-0.75, 0.2],
    ]) {
      const p = predict(model, [x, y]);
      expect(
        Math.hypot(p.x - (600 + 400 * x + 40 * y), p.y - (450 + 300 * y)),
      ).toBeLessThan(8);
    }
    expect(gridPoints(1000, 800)).toHaveLength(9);
  });
  it("rejects insufficient or stationary training data", () => {
    expect(() => trainRidge([])).toThrow();
    expect(() =>
      trainRidge(
        Array.from({ length: 30 }, () => ({
          features: [1, 1],
          target: { x: 0, y: 0 },
          pointIndex: 0,
          timestamp: 0,
          quality: 1,
        })),
      ),
    ).toThrow();
  });
});
describe("eye features", () => {
  it("rejects absent faces and blinks", () => {
    expect(extractFeatures([])).toBeNull();
    expect(
      extractFeatures(
        Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 })),
        0.9,
      ),
    ).toBeNull();
  });
  it("extracts ten finite features from open eyes with iris centers", () => {
    const p: Landmark[] = Array.from({ length: 478 }, () => ({
      x: 0.5,
      y: 0.5,
      z: 0,
    }));
    const set = (i: number, x: number, y: number) => (p[i] = { x, y, z: 0 });
    for (const [a, b, t, bt, iris, cx] of [
      [33, 133, 159, 145, 468, 0.35],
      [362, 263, 386, 374, 473, 0.65],
    ]) {
      set(a, cx - 0.05, 0.4);
      set(b, cx + 0.05, 0.4);
      set(t, cx, 0.38);
      set(bt, cx, 0.42);
      set(iris, cx, 0.4);
    }
    set(1, 0.5, 0.5);
    set(10, 0.5, 0.2);
    set(152, 0.5, 0.8);
    const f = extractFeatures(p);
    expect(f?.values).toHaveLength(10);
    expect(f?.values.every(Number.isFinite)).toBe(true);
    expect(f?.quality).toBe(1);
  });
});
