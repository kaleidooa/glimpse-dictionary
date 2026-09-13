import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { translateText, googleTranslationURL } from "./translation";
import { applyLocale } from "../src/lib/i18n";
beforeEach(() => {
  applyLocale("en");
  vi.useFakeTimers();
  vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it("creates an English-to-Korean translator only on request, reports download progress and releases it", async () => {
  const translate = vi.fn(async () => "  독서는 새로운 문을 엽니다.  "),
    destroy = vi.fn();
  const create = vi.fn(async (options) => {
    expect(options.sourceLanguage).toBe("en");
    expect(options.targetLanguage).toBe("ko");
    options.monitor({
      addEventListener: (
        _type: string,
        listener: (event: { loaded: number }) => void,
      ) => listener({ loaded: 0.5 }),
    });
    return { translate, destroy };
  });
  vi.stubGlobal("Translator", { create });
  expect(create).not.toHaveBeenCalled();
  const progress = vi.fn();
  const result = await translateText("Reading opens new doors.", {
    signal: new AbortController().signal,
    progress,
  });
  expect(result).toBe("독서는 새로운 문을 엽니다.");
  expect(progress).toHaveBeenCalledWith(expect.stringContaining("50%"));
  expect(translate).toHaveBeenCalledWith(
    "Reading opens new doors.",
    expect.objectContaining({ signal: expect.any(AbortSignal) }),
  );
  expect(destroy).toHaveBeenCalledOnce();
  expect(fetch).not.toHaveBeenCalled();
});
it("rejects unsupported browsers and oversized text without sending it anywhere", async () => {
  vi.stubGlobal("Translator", undefined);
  await expect(
    translateText("Read this sentence.", {
      signal: new AbortController().signal,
      progress: vi.fn(),
    }),
  ).rejects.toThrow("isn't available");
  const create = vi.fn();
  vi.stubGlobal("Translator", { create });
  await expect(
    translateText("a".repeat(2001), {
      signal: new AbortController().signal,
      progress: vi.fn(),
    }),
  ).rejects.toThrow("2,000");
  expect(create).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
});
it("destroys a translator that finishes creating after its popup was closed", async () => {
  let resolve!: (translator: {
    translate: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
  }) => void;
  const create = vi.fn(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  vi.stubGlobal("Translator", { create });
  const controller = new AbortController(),
    translate = vi.fn(),
    destroy = vi.fn();
  const pending = translateText("Read this sentence.", {
    signal: controller.signal,
    progress: vi.fn(),
  });
  const rejected = expect(pending).rejects.toThrow();
  controller.abort();
  resolve({ translate, destroy });
  await rejected;
  expect(destroy).toHaveBeenCalledOnce();
  expect(translate).not.toHaveBeenCalled();
});
it("aborts a stalled model download and provides a retryable message", async () => {
  vi.stubGlobal("Translator", {
    create: ({ signal }: { signal: AbortSignal }) =>
      new Promise((_resolve, reject) =>
        signal.addEventListener("abort", () => reject(new Error("aborted")), {
          once: true,
        }),
      ),
  });
  const pending = translateText("Read this sentence.", {
    signal: new AbortController().signal,
    progress: vi.fn(),
  });
  const rejected = expect(pending).rejects.toThrow("took too long");
  await vi.advanceTimersByTimeAsync(120000);
  await rejected;
});
it("encodes the selected text as data in the optional Google Translate link", () => {
  const text = "What about A&B? #reading / 문장";
  const url = new URL(googleTranslationURL(text));
  expect(url.origin).toBe("https://translate.google.com");
  expect(url.searchParams.get("text")).toBe(text);
  expect(url.searchParams.get("sl")).toBe("en");
  expect(url.searchParams.get("tl")).toBe("ko");
});
