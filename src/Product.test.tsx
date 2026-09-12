// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import App from "./App";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("defaults to cursor mode without camera requests, network calls, or touching existing lab logs", () => {
  history.replaceState(null, "", "/");
  const logs = '{"version":1,"logs":[{"id":"preserved"}],"calibrations":[]}';
  localStorage.setItem("glimpse.experiment.v1", logs);
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  const camera = vi.fn();
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: camera },
  });
  render(<App />);
  expect(screen.getByRole("button", { name: /실험실 열기/ })).toBeTruthy();
  expect(
    screen
      .getByRole("checkbox", { name: "보조 영영 사전 사용" })
      .getAttribute("checked"),
  ).toBeNull();
  expect(camera).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
  expect(screen.queryByText("정확도 실험")).toBeNull();
  expect(localStorage.getItem("glimpse.experiment.v1")).toBe(logs);
});
