// @vitest-environment jsdom
import { beforeEach as beforeLanguageTest } from "vitest";
import { applyLocale } from "../src/lib/i18n";
beforeLanguageTest(() => applyLocale("ko"));
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { installReader } from "./reader";
import type { Definition } from "../src/lib/definitions";
const response: Definition = {
  word: "curiosity",
  meaning: "호기심",
  language: "ko",
  source: "내장 사전",
};
let reader: ReturnType<typeof installReader>;
let roots: ShadowRoot[];
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["performance"] });
  document.body.innerHTML = "<p>curiosity</p>";
  const p = document.querySelector("p")!;
  Object.defineProperty(document, "hidden", {
    configurable: true,
    value: false,
  });
  Object.defineProperty(document, "elementFromPoint", {
    configurable: true,
    value: () => p,
  });
  Object.defineProperty(document, "caretPositionFromPoint", {
    configurable: true,
    value: () => ({ offsetNode: p.firstChild!, offset: 2 }),
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
});
afterEach(() => {
  reader?.dispose();
  vi.restoreAllMocks();
  vi.useRealTimers();
});
function point() {
  window.dispatchEvent(
    new MouseEvent("pointermove", { clientX: 70, clientY: 40 }),
  );
}
it("does nothing until a pointer position and explicit trigger are available", async () => {
  const lookup = vi.fn().mockResolvedValue(response);
  reader = installReader(lookup);
  await reader.trigger();
  expect(lookup).not.toHaveBeenCalled();
  point();
  expect(lookup).not.toHaveBeenCalled();
  await reader.trigger();
  expect(lookup).toHaveBeenCalledWith("curiosity");
});
it("closes on nested scroll, ignores moving geometry, then works at the unchanged pointer", async () => {
  const lookup = vi.fn().mockResolvedValue(response);
  reader = installReader(lookup);
  point();
  await reader.trigger();
  expect(document.querySelector("[data-glimpse-ui]")).not.toBeNull();
  document
    .querySelector("p")!
    .dispatchEvent(new Event("scroll", { bubbles: false }));
  expect(document.querySelector("[data-glimpse-ui]")).toBeNull();
  await reader.trigger();
  expect(lookup).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(181);
  await reader.trigger();
  expect(lookup).toHaveBeenCalledTimes(2);
});
it("does not reopen or overwrite with a late network response", async () => {
  let resolve!: (d: Definition) => void;
  const lookup = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<Definition>((r) => {
          resolve = r;
        }),
    )
    .mockResolvedValue(response);
  reader = installReader(lookup);
  point();
  const old = reader.trigger();
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
  await reader.trigger();
  const root = roots.at(-1)!;
  resolve({ ...response, meaning: "STALE RESULT" });
  await old;
  expect(root.textContent).toContain("호기심");
  expect(root.textContent).not.toContain("STALE RESULT");
});
it("uses text content for untrusted definitions and removes listeners on disposal", async () => {
  const lookup = vi.fn().mockResolvedValue({
    ...response,
    meaning: "<img src=x onerror=alert(1)>",
  });
  reader = installReader(lookup);
  point();
  await reader.trigger();
  expect(roots[0].querySelector("img")).toBeNull();
  expect(roots[0].textContent).toContain("<img");
  reader.dispose();
  expect(document.querySelector("[data-glimpse-ui]")).toBeNull();
});
it("does not query while typing in a focused text input and clears pointers on blur", async () => {
  const lookup = vi.fn().mockResolvedValue(response);
  reader = installReader(lookup);
  point();
  const input = document.createElement("input");
  document.body.append(input);
  input.focus();
  await reader.trigger();
  expect(lookup).not.toHaveBeenCalled();
  input.blur();
  window.dispatchEvent(new Event("blur"));
  await reader.trigger();
  expect(lookup).not.toHaveBeenCalled();
});
it("renders multiple senses, roots and source links without expanding unsolicited markup", async () => {
  const lookup = vi.fn().mockResolvedValue({
    ...response,
    matchedBy: "inflection",
    lemma: "go",
    lemmas: ["go"],
    senses: [1, 2, 3, 4].map((i) => ({
      meaning: "뜻 " + i,
      partOfSpeech: "동사",
    })),
    license: "CC BY-SA 4.0",
    sourceLinks: [
      { label: "go", url: "https://ko.wiktionary.org/wiki/go" },
      { label: "unsafe", url: "javascript:alert(1)" },
    ],
  });
  reader = installReader(lookup);
  point();
  await reader.trigger();
  const root = roots.at(-1)!;
  expect(root.textContent).toContain("원형: go");
  expect(root.querySelectorAll(".sense")).toHaveLength(3);
  expect(root.querySelectorAll("a")).toHaveLength(1);
  expect(root.querySelector("a")?.rel).toContain("noreferrer");
  root.querySelector<HTMLButtonElement>(".more")!.click();
  expect(root.querySelectorAll(".sense")).toHaveLength(4);
});
it("saves only after the save button is explicitly clicked and does not resurrect a closed popup", async () => {
  const save = vi.fn().mockResolvedValue({ created: true });
  reader = installReader(async () => ({ ...response, status: "found" }), save);
  point();
  await reader.trigger();
  expect(save).not.toHaveBeenCalled();
  roots.at(-1)!.querySelector<HTMLButtonElement>(".save")!.click();
  window.dispatchEvent(new Event("scroll"));
  await Promise.resolve();
  expect(save).toHaveBeenCalledTimes(1);
  expect(document.querySelector("[data-glimpse-ui]")).toBeNull();
});
