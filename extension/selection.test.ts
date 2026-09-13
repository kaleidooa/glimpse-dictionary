// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { installReader } from "./reader";
import { selectedText } from "./selection";
import { applyLocale } from "../src/lib/i18n";
import type { Translate } from "./translation";
let reader: ReturnType<typeof installReader> | undefined;
let roots: ShadowRoot[];
const meaning = {
  word: "curiosity",
  meaning: "호기심",
  language: "ko" as const,
  source: "Local dictionary",
  status: "found" as const,
};
beforeEach(() => {
  vi.useFakeTimers();
  applyLocale("en");
  document.body.innerHTML = "<p>curiosity</p>";
  document.getSelection()!.removeAllRanges();
  Object.defineProperty(document, "hidden", {
    configurable: true,
    value: false,
  });
  Object.defineProperty(Range.prototype, "getClientRects", {
    configurable: true,
    value: () => [
      { left: 20, right: 180, top: 20, bottom: 50, width: 160, height: 30 },
    ],
  });
  roots = [];
  const attach = Element.prototype.attachShadow;
  vi.spyOn(Element.prototype, "attachShadow").mockImplementation(function (
    this: Element,
    init,
  ) {
    const root = attach.call(this, init);
    roots.push(root);
    return root;
  });
  vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => {
  reader?.dispose();
  reader = undefined;
  document.getSelection()!.removeAllRanges();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
function select(element: Element = document.querySelector("p")!) {
  const range = document.createRange();
  range.selectNodeContents(element);
  const selection = document.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
  document.dispatchEvent(new Event("selectionchange"));
}
async function settle() {
  await vi.advanceTimersByTimeAsync(100);
}

it("offers a small word button after selection, looks up only on click, and preserves native selection", async () => {
  document.querySelector("p")!.textContent = "curiosity,";
  const lookup = vi.fn(async () => meaning),
    translate = vi.fn<Translate>();
  reader = installReader(lookup, undefined, translate);
  select();
  await settle();
  const button = roots.at(-1)!.querySelector("button")!;
  expect(button.getAttribute("aria-label")).toBe("Look up");
  expect(button.textContent).toBe("");
  expect(button.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  expect(lookup).not.toHaveBeenCalled();
  expect(translate).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
  button.click();
  await settle();
  expect(lookup).toHaveBeenCalledWith("curiosity");
  expect(translate).not.toHaveBeenCalled();
  expect(document.getSelection()!.toString()).toBe("curiosity,");
  expect(roots.at(-1)!.textContent).toContain("호기심");
});
it("translates only the selected sentence, renders it as text, and does not offer wordbook saving", async () => {
  document.querySelector("p")!.textContent = "Reading opens new doors.";
  const lookup = vi.fn(),
    save = vi.fn(),
    translate = vi
      .fn<Translate>()
      .mockResolvedValue("독서는 <img src=x> 새로운 문을 엽니다.");
  reader = installReader(lookup, save, translate);
  select();
  await settle();
  expect(
    roots.at(-1)!.querySelector("button")!.getAttribute("aria-label"),
  ).toBe("Translate");
  expect(translate).not.toHaveBeenCalled();
  roots.at(-1)!.querySelector("button")!.click();
  await settle();
  expect(translate).toHaveBeenCalledWith(
    "Reading opens new doors.",
    expect.objectContaining({ signal: expect.any(AbortSignal) }),
  );
  expect(lookup).not.toHaveBeenCalled();
  expect(save).not.toHaveBeenCalled();
  const popup = roots.at(-1)!;
  expect(popup.textContent).toContain("독서는 <img src=x> 새로운 문을 엽니다.");
  expect(popup.querySelector("img")).toBeNull();
  expect(popup.querySelector(".save")).toBeNull();
  popup
    .querySelector(".card")!
    .dispatchEvent(new Event("scroll", { composed: true }));
  expect(popup.host.isConnected).toBe(true);
  window.dispatchEvent(new Event("scroll"));
  expect(popup.host.isConnected).toBe(false);
});
it("keeps the translation open while selecting its text for copying", async () => {
  document.querySelector("p")!.textContent = "Reading opens new doors.";
  reader = installReader(
    vi.fn(),
    undefined,
    vi.fn<Translate>().mockResolvedValue("독서는 새로운 문을 엽니다."),
  );
  select();
  await settle();
  roots.at(-1)!.querySelector("button")!.click();
  await settle();
  const popup = roots.at(-1)!;
  const result = popup.querySelector("p")!;
  result.dispatchEvent(new MouseEvent("pointerdown", { composed: true }));
  select(result);
  await settle();
  result.dispatchEvent(new MouseEvent("pointerup", { composed: true }));
  document.dispatchEvent(new Event("selectionchange"));
  await settle();
  expect(popup.host.isConnected).toBe(true);
  expect(popup.textContent).toContain("독서는 새로운 문을 엽니다.");
  document.body.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
  expect(popup.host.isConnected).toBe(false);
});
it("cancels a pending translation on reselection and ignores its late result", async () => {
  document.querySelector("p")!.textContent = "Reading opens new doors.";
  let finish!: (text: string) => void;
  const translate = vi.fn<Translate>(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  reader = installReader(
    vi.fn(async () => meaning),
    undefined,
    translate,
  );
  select();
  await settle();
  roots.at(-1)!.querySelector("button")!.click();
  const signal = translate.mock.calls[0][1].signal;
  document.body.querySelector("p")!.textContent = "curiosity";
  select();
  await settle();
  expect(signal.aborted).toBe(true);
  finish("STALE TRANSLATION");
  await settle();
  expect(
    roots.at(-1)!.querySelector("button")!.getAttribute("aria-label"),
  ).toBe("Look up");
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
  expect(document.querySelector("div[data-glimpse-ui]")).toBeNull();
});
it("clears a scheduled button on scrolling and removes selection listeners on disposal", async () => {
  reader = installReader(vi.fn());
  select();
  window.dispatchEvent(new Event("scroll"));
  await settle();
  expect(document.querySelector("div[data-glimpse-ui]")).toBeNull();
  reader.dispose();
  select();
  await settle();
  expect(document.querySelector("div[data-glimpse-ui]")).toBeNull();
});
it("waits until a scrolling drag ends before offering the action", async () => {
  reader = installReader(vi.fn());
  window.dispatchEvent(new MouseEvent("pointerdown", { button: 0 }));
  select();
  await settle();
  expect(document.querySelector("div[data-glimpse-ui]")).toBeNull();
  window.dispatchEvent(new Event("scroll"));
  window.dispatchEvent(new MouseEvent("pointerup", { button: 0 }));
  await settle();
  expect(document.querySelector("div[data-glimpse-ui]")).toBeNull();
  await settle();
  expect(
    roots.at(-1)!.querySelector("button")!.getAttribute("aria-label"),
  ).toBe("Look up");
});
it.each([
  "<p contenteditable>private text</p>",
  "<div><p>first</p><input value='secret'><p>last</p></div>",
  "<p data-glimpse-ui>extension text</p>",
  `<p>${"word ".repeat(500)}</p>`,
])("ignores private, extension-owned or oversized selections: %s", (html) => {
  document.body.innerHTML = html;
  select(document.body.firstElementChild!);
  expect(selectedText()).toBeNull();
});
it("handles formatting and multiline selections without changing page markup", () => {
  document.body.innerHTML = "<p>well-<em>known</em></p>";
  const original = document.body.innerHTML;
  select();
  expect(selectedText()?.word).toBe("well-known");
  expect(document.body.innerHTML).toBe(original);
});
it("offers a labeled external fallback only after local translation fails and allows a local retry", async () => {
  applyLocale("ko");
  document.querySelector("p")!.textContent = "Reading opens new doors.";
  const translate = vi
    .fn<Translate>()
    .mockRejectedValueOnce(new Error("Not supported"))
    .mockResolvedValue("독서는 새로운 문을 엽니다.");
  reader = installReader(vi.fn(), undefined, translate);
  select();
  await settle();
  expect(
    roots.at(-1)!.querySelector("button")!.getAttribute("aria-label"),
  ).toBe("번역");
  roots.at(-1)!.querySelector("button")!.click();
  await settle();
  const link = roots.at(-1)!.querySelector("a")!;
  expect(new URL(link.href).hostname).toBe("translate.google.com");
  expect(new URL(link.href).searchParams.get("text")).toBe(
    "Reading opens new doors.",
  );
  expect(link.rel).toContain("noreferrer");
  expect(roots.at(-1)!.textContent).toContain(
    "선택한 글을 Google 번역에 보내고",
  );
  expect(fetch).not.toHaveBeenCalled();
  roots.at(-1)!.querySelector<HTMLButtonElement>(".retry")!.click();
  await settle();
  expect(translate).toHaveBeenCalledTimes(2);
  expect(roots.at(-1)!.textContent).toContain("독서는 새로운 문을 엽니다.");
});
