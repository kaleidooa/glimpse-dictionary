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
import { applyLocale, getLocale, LOCALE_KEY, t } from "./lib/i18n";
import { initializeLocale as initializeLocaleClient } from "./lib/locale-client";
import { unavailable } from "../extension/dictionary";
import { definitionLabel } from "./lib/definition-labels";
import { VOCABULARY_KEY } from "./lib/vocabulary";
let disposeLocale: (() => void)[] = [];
async function initializeLocale() {
  disposeLocale.push(await initializeLocaleClient());
}

beforeEach(() => {
  applyLocale("en");
  localStorage.clear();
  history.replaceState(null, "", "/dashboard.html#settings");
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  disposeLocale.forEach((dispose) => dispose());
  disposeLocale = [];
  vi.restoreAllMocks();
  applyLocale("en");
});

it("defaults to English, saves a Korean preference and restores it on startup without changing the wordbook", async () => {
  const wordbook = '{"version":1,"entries":[]}';
  localStorage.setItem(VOCABULARY_KEY, wordbook);
  await initializeLocale();
  render(<Dashboard />);
  expect(
    screen.getByRole("heading", { name: "Settings", level: 1 }),
  ).toBeTruthy();
  expect(
    (screen.getByRole("combobox", { name: "Language" }) as HTMLSelectElement)
      .value,
  ).toBe("en");
  fireEvent.change(screen.getByRole("combobox", { name: "Language" }), {
    target: { value: "ko" },
  });
  await screen.findByRole("heading", { name: "읽는 방식에 맞게." });
  expect(localStorage.getItem(LOCALE_KEY)).toBe("ko");
  expect(document.documentElement.lang).toBe("ko");
  expect(localStorage.getItem(VOCABULARY_KEY)).toBe(wordbook);
  await act(async () => {
    applyLocale("en");
    await initializeLocale();
  });
  expect(getLocale()).toBe("ko");
  expect(screen.getByRole("combobox", { name: "언어" })).toBeTruthy();
  fireEvent.change(screen.getByRole("combobox", { name: "언어" }), {
    target: { value: "en" },
  });
  await screen.findByRole("heading", { name: "Settings", level: 1 });
  expect(document.documentElement.lang).toBe("en");
});

it("updates an open page when the saved language changes in another tab", async () => {
  await initializeLocale();
  render(<Dashboard />);
  await act(async () =>
    window.dispatchEvent(
      new StorageEvent("storage", { key: LOCALE_KEY, newValue: "ko" }),
    ),
  );
  expect(
    screen.getByRole("heading", { name: "읽는 방식에 맞게." }),
  ).toBeTruthy();
  await act(async () =>
    window.dispatchEvent(
      new StorageEvent("storage", { key: LOCALE_KEY, newValue: "unsupported" }),
    ),
  );
  expect(
    screen.getByRole("heading", { name: "Settings", level: 1 }),
  ).toBeTruthy();
});

it("keeps the current language if writing the preference fails", async () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("quota");
  });
  render(<Dashboard />);
  fireEvent.change(screen.getByRole("combobox", { name: "Language" }), {
    target: { value: "ko" },
  });
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toContain(
      "Could not save language",
    ),
  );
  expect(getLocale()).toBe("en");
});

it("translates status and source labels at call time while leaving dictionary glosses alone", () => {
  expect(unavailable("missingword", "online-disabled").meaning).toContain(
    "local dictionary",
  );
  expect(definitionLabel("명사")).toBe("noun");
  expect(definitionLabel("우연한 발견")).toBe("우연한 발견");
  expect(t("Removed {0}.", "{0} 삭제", "{1}")).toBe("Removed {1}.");
  applyLocale("ko");
  expect(unavailable("missingword", "online-disabled").meaning).toContain(
    "기기 사전",
  );
  expect(definitionLabel("noun")).toBe("명사");
});
