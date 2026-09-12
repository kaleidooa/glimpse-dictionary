// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { Dashboard } from "./Dashboard";
import { VOCABULARY_KEY } from "./lib/vocabulary";
vi.mock("../extension/dictionary", () => ({
  API_ORIGIN: "https://api.dictionaryapi.dev/*",
  defineWord: vi.fn(async (word: string) => ({
    word,
    meaning: "우연한 발견",
    language: "ko",
    source: "위키낱말사전",
    status: "found",
  })),
}));
beforeEach(() => {
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  localStorage.removeItem(VOCABULARY_KEY);
  history.replaceState(null, "", "/dashboard.html#start");
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.removeItem(VOCABULARY_KEY);
});
async function navigate(page: string) {
  await act(async () => {
    history.replaceState(null, "", "/dashboard.html#" + page);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  });
}
it("starts with actionable help and does not automatically save a query", async () => {
  render(<Dashboard />);
  fireEvent.click(
    screen.getByRole("button", { name: "serendipity" }),
  );
  await screen.findByText("우연한 발견");
  expect(localStorage.getItem(VOCABULARY_KEY)).toBeNull();
  expect(screen.getByRole("link", { name: /읽기 화면에서 연습/ })).toBeTruthy();
});
it("updates the wordbook immediately after an explicit save, then marks, filters and removes it", async () => {
  render(<Dashboard />);
  fireEvent.click(
    screen.getByRole("button", { name: "serendipity" }),
  );
  fireEvent.click(
    await screen.findByRole("button", { name: "단어장에 저장" }),
  );
  await screen.findByRole("button", { name: "단어장에 저장됨 ✓" });
  await navigate("words");
  expect(
    await screen.findByRole("heading", { name: "serendipity" }),
  ).toBeTruthy();
  fireEvent.click(
    screen.getByRole("button", { name: "serendipity 익숙한 단어로 표시" }),
  );
  await screen.findByRole("button", { name: "serendipity 학습 중으로 표시" });
  fireEvent.click(screen.getByRole("button", { name: "학습 중" }));
  expect(screen.queryByRole("heading", { name: "serendipity" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "전체" }));
  fireEvent.click(screen.getByRole("button", { name: "serendipity 삭제" }));
  await waitFor(() =>
    expect(screen.queryByRole("heading", { name: "serendipity" })).toBeNull(),
  );
});
it("does not expose working permission switches in the ordinary web preview", async () => {
  await navigate("settings");
  render(<Dashboard />);
  expect(
    screen
      .getByRole("checkbox", { name: /보조 영영 사전/ })
      .hasAttribute("disabled"),
  ).toBe(true);
  expect(
    screen
      .getByRole("checkbox", { name: /모든 웹사이트에서 자동 사용/ })
      .hasAttribute("disabled"),
  ).toBe(true);
});
