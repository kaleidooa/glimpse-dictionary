// @vitest-environment jsdom
import { beforeEach as beforeLanguageTest } from "vitest";
import { applyLocale } from "./lib/i18n";
beforeLanguageTest(() => applyLocale("ko"));
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import App from "./LabApp";
beforeEach(() => {
  vi.useFakeTimers({
    toFake: [
      "setInterval",
      "clearInterval",
      "setTimeout",
      "clearTimeout",
      "requestAnimationFrame",
      "cancelAnimationFrame",
      "performance",
    ],
  });
  localStorage.clear();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: { ready: Promise.resolve() },
  });
  Object.defineProperty(document, "hidden", {
    configurable: true,
    value: false,
  });
  vi.stubGlobal("scrollY", 0);
  vi.stubGlobal("innerWidth", 1024);
  vi.stubGlobal("innerHeight", 768);
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(JSON.stringify({ enabled: false }))),
  );
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      const id = Number(this.dataset.tokenId ?? 0),
        left = 50 + (id % 8) * 80,
        top = 300 + Math.floor(id / 8) * 32 - window.scrollY;
      return this.hasAttribute("data-token-id")
        ? {
            x: left,
            y: top,
            left,
            right: left + 70,
            top,
            bottom: top + 28,
            width: 70,
            height: 28,
            toJSON() {},
          }
        : {
            x: 0,
            y: 0,
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            width: 0,
            height: 0,
            toJSON() {},
          };
    },
  );
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
const advance = async (ms: number) => {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
};
const point = (x: number, y: number) =>
  fireEvent(window, new MouseEvent("pointermove", { clientX: x, clientY: y }));
const space = () =>
  fireEvent.keyDown(document.body, { key: " ", code: "Space" });
const logs = () =>
  JSON.parse(localStorage.getItem("glimpse.experiment.v1")!).logs;
it("resumes target assignment after scrolling out of and back into the reader", async () => {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "마우스" }));
  fireEvent.click(screen.getByRole("tab", { name: "정확도 실험" }));
  await advance(50);
  expect(document.querySelector(".test-target")).toBeTruthy();
  vi.stubGlobal("scrollY", 10000);
  fireEvent.scroll(window);
  await advance(250);
  expect(document.querySelector(".test-target")).toBeNull();
  vi.stubGlobal("scrollY", 0);
  fireEvent.scroll(window);
  await advance(250);
  expect(document.querySelector(".test-target")).toBeTruthy();
});
it("rejects a scrolling trigger then selects using fresh viewport coordinates", async () => {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "마우스" }));
  point(565, 314);
  await advance(500);
  space();
  expect(logs().at(-1).selectedId).toBe(6);
  vi.stubGlobal("scrollY", 120);
  fireEvent.scroll(window);
  space();
  expect(logs().at(-1).reason).toBe("scroll-settling");
  point(565, 194);
  await advance(650);
  space();
  const result = logs().at(-1);
  expect(result.selectedId).toBe(6);
  expect(result.gazeY).toBeCloseTo(194);
  expect(result.scroll.y).toBe(120);
  expect(
    result.samples.every((s: { timestamp: number }) => s.timestamp >= 680),
  ).toBe(true);
});
it("ends a 50-trial run without counting extra Space presses as trials", async () => {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "마우스" }));
  fireEvent.click(screen.getByRole("tab", { name: "정확도 실험" }));
  await advance(50);
  for (let i = 0; i < 50; i++) {
    const target = document.querySelector(".test-target")!;
    expect(target).toBeTruthy();
    const box = target.getBoundingClientRect();
    point((box.left + box.right) / 2, (box.top + box.bottom) / 2);
    await advance(700);
    space();
    await advance(1400);
  }
  expect(screen.getByText("50회 평가 완료")).toBeTruthy();
  space();
  expect(logs().at(-1).reason).toBe("run-complete");
  expect(logs().filter((l: { trial: unknown }) => l.trial)).toHaveLength(50);
});
