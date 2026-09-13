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
import { applyLocale } from "./lib/i18n";
import { SHORTCUTS_URL } from "./lib/shortcut";
import { useShortcut } from "./components/useShortcut";
import { Dashboard } from "./Dashboard";
import App from "./App";
import { installReader } from "../extension/reader";

vi.mock("../extension/reader", () => ({ installReader: vi.fn() }));
vi.mock("./lib/vocabulary-client", () => ({
  vocabularyClient: { list: vi.fn(async () => []), save: vi.fn() },
}));
const trigger = vi.fn(),
  dispose = vi.fn();
let getAll: ReturnType<typeof vi.fn>, create: ReturnType<typeof vi.fn>;
beforeEach(() => {
  applyLocale("en");
  history.replaceState(null, "", "/dashboard.html#settings");
  vi.mocked(installReader).mockReturnValue({
    trigger,
    dispose,
    ready: vi.fn(),
  });
  getAll = vi.fn(async () => [
    { name: "lookup-word", shortcut: "Alt+Shift+D" },
  ]);
  create = vi.fn(async () => ({}));
  vi.stubGlobal("chrome", {
    commands: { getAll },
    tabs: { create },
    runtime: {
      id: "test-id",
      getURL: (path: string) => "chrome-extension://test-id/" + path,
      onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
    },
    storage: {
      local: { get: vi.fn(async () => ({})) },
      onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
    },
    permissions: { contains: vi.fn(async () => true) },
  });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});
function installed() {
  vi.stubGlobal("location", {
    protocol: "chrome-extension:",
    hash: "#settings",
    pathname: "/lab/dashboard.html",
  });
}

it("shows the real existing binding and refreshes after returning from Chrome's shortcut editor", async () => {
  installed();
  render(<Dashboard />);
  const field = (await screen.findByLabelText(
    "Current shortcut",
  )) as HTMLInputElement;
  await waitFor(() => expect(field.value).toBe("Alt + Shift + D"));
  expect(field.readOnly).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Change shortcut ↗" }));
  expect(create).toHaveBeenCalledWith({ url: SHORTCUTS_URL });
  getAll.mockResolvedValue([{ name: "lookup-word", shortcut: "Alt+Q" }]);
  fireEvent.focus(window);
  await waitFor(() => expect(field.value).toBe("Alt + Q"));
});
it("shows an unassigned shortcut and keeps the change action available in both languages", async () => {
  installed();
  getAll.mockResolvedValue([{ name: "lookup-word", shortcut: "" }]);
  render(<Dashboard />);
  await waitFor(() =>
    expect(
      (screen.getByLabelText("Current shortcut") as HTMLInputElement).value,
    ).toBe("Not assigned"),
  );
  expect(screen.getByText(/No shortcut is assigned/)).toBeTruthy();
  await act(async () => applyLocale("ko"));
  expect((screen.getByLabelText("현재 단축키") as HTMLInputElement).value).toBe(
    "미설정",
  );
  fireEvent.click(screen.getByRole("button", { name: "단축키 변경 ↗" }));
  expect(create).toHaveBeenCalledWith({ url: SHORTCUTS_URL });
});
it("does not replace a newer binding with an older response or invent a default on API failure", async () => {
  installed();
  let resolve!: (value: { name: string; shortcut: string }[]) => void;
  getAll.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  function Current() {
    return <output>{useShortcut() ?? "unavailable"}</output>;
  }
  const view = render(<Current />);
  getAll.mockResolvedValue([{ name: "lookup-word", shortcut: "Alt+X" }]);
  fireEvent.focus(window);
  await screen.findByText("Alt+X");
  await act(async () =>
    resolve([{ name: "lookup-word", shortcut: "Alt+Shift+D" }]),
  );
  expect(screen.getByText("Alt+X")).toBeTruthy();
  getAll.mockRejectedValue(new Error("Extension reloaded"));
  fireEvent.focus(window);
  await screen.findByText("unavailable");
  view.unmount();
  getAll.mockClear();
  fireEvent.focus(window);
  expect(getAll).not.toHaveBeenCalled();
});
it("uses Alt+Q in the web demo, ignores extra modifiers and repeats, and removes its handler on unmount", () => {
  history.replaceState(null, "", "/");
  const view = render(<App />);
  fireEvent.keyDown(window, { code: "KeyQ", altKey: true });
  for (const keys of [
    { shiftKey: true },
    { ctrlKey: true },
    { metaKey: true },
    { repeat: true },
    { altKey: false },
    { code: "KeyD", shiftKey: true },
  ])
    fireEvent.keyDown(window, { code: "KeyQ", altKey: true, ...keys });
  expect(trigger).toHaveBeenCalledTimes(1);
  expect(getAll).not.toHaveBeenCalled();
  view.unmount();
  fireEvent.keyDown(window, { code: "KeyQ", altKey: true });
  expect(trigger).toHaveBeenCalledTimes(1);
});
