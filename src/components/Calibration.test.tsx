// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { Calibration } from "./Calibration";
import type { FeatureFrame } from "../lib/tracker";
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
it.each([
  { precision: false, points: 9, repeats: 1, validation: 5 },
  { precision: true, points: 25, repeats: 2, validation: 9 },
])(
  "completes the calibration plan: $points points × $repeats and $validation independent checks",
  async (plan) => {
    vi.useFakeTimers({
      toFake: [
        "setInterval",
        "clearInterval",
        "setTimeout",
        "clearTimeout",
        "performance",
      ],
    });
    const done = vi.fn();
    const getFrame = (): FeatureFrame | null => {
      const target = document.querySelector<HTMLElement>(".calibration-target");
      if (!target) return null;
      const x = parseFloat(target.style.left) / innerWidth,
        y = parseFloat(target.style.top) / innerHeight;
      return {
        timestamp: performance.now(),
        values: [x, y],
        quality: 1,
        raw: { x, y },
        irises: [],
      };
    };
    render(
      <Calibration getFrame={getFrame} onClose={() => {}} onDone={done} />,
    );
    if (!plan.precision)
      fireEvent.click(screen.getByRole("button", { name: /빠른 보정/ }));
    fireEvent.click(screen.getByRole("button", { name: /보정 시작/ }));
    for (let i = 0; i < plan.points * plan.repeats + plan.validation; i++)
      await act(async () => {
        vi.advanceTimersByTime(1900);
      });
    expect(screen.getByText("시선 보정이 끝났어요.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /읽기로 돌아가기/ }));
    expect(done).toHaveBeenCalledOnce();
    const record = done.mock.calls[0][0];
    expect(
      new Set(record.rows.map((r: { pointIndex: number }) => r.pointIndex))
        .size,
    ).toBe(plan.points);
    expect(record.validation).toHaveLength(plan.validation);
    expect(record.plan).toEqual({ points: plan.points, repeats: plan.repeats });
    expect(
      record.validation.every((v: { pixelError: number }) => v.pixelError < 20),
    ).toBe(true);
    expect(record.rows.length).toBeGreaterThan(120);
  },
);
it("does not invent calibration samples when no face is present and supports Escape", async () => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "performance"] });
  const done = vi.fn(),
    close = vi.fn();
  render(<Calibration getFrame={() => null} onClose={close} onDone={done} />);
  fireEvent.click(screen.getByRole("button", { name: /빠른 보정/ }));
  fireEvent.click(screen.getByRole("button", { name: /9점 보정 시작/ }));
  await act(async () => {
    vi.advanceTimersByTime(8200);
  });
  expect(screen.getByText(/유효한 눈 데이터가 부족합니다/)).toBeTruthy();
  expect(done).not.toHaveBeenCalled();
  fireEvent.keyDown(window, { key: "Escape" });
  expect(close).toHaveBeenCalledOnce();
});
