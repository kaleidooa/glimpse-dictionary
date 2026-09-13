import { t } from "../src/lib/i18n";

export const MAX_TRANSLATION_LENGTH = 2000;
export type TranslateOptions = {
  signal: AbortSignal;
  progress: (message: string) => void;
};
export type Translate = (
  text: string,
  options: TranslateOptions,
) => Promise<string>;
type TranslatorInstance = {
  translate(text: string, options: { signal: AbortSignal }): Promise<string>;
  destroy(): void;
};
type TranslatorAPI = {
  create(options: {
    sourceLanguage: string;
    targetLanguage: string;
    signal: AbortSignal;
    monitor: (monitor: {
      addEventListener(
        type: string,
        listener: (event: { loaded: number }) => void,
      ): void;
    }) => void;
  }): Promise<TranslatorInstance>;
};

export const translateText: Translate = async (text, { signal, progress }) => {
  if (!text.trim() || text.length > MAX_TRANSLATION_LENGTH)
    throw new Error(
      t("Select up to 2,000 characters.", "2,000자 이내로 선택해 주세요."),
    );
  const api = (globalThis as typeof globalThis & { Translator?: TranslatorAPI })
    .Translator;
  if (!api)
    throw new Error(
      t(
        "On-device translation isn't available on this page. Try an up-to-date desktop Chrome on an HTTPS page.",
        "이 페이지에서는 기기 내 번역을 사용할 수 없습니다. 최신 데스크톱 Chrome의 HTTPS 페이지에서 시도해 주세요.",
      ),
    );
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal.addEventListener("abort", cancel, { once: true });
  if (signal.aborted) cancel();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    cancel();
  }, 120_000);
  let translator: TranslatorInstance | undefined;
  try {
    controller.signal.throwIfAborted();
    // Start directly from the button click so Chrome can verify user activation.
    translator = await api.create({
      sourceLanguage: "en",
      targetLanguage: "ko",
      signal: controller.signal,
      monitor(monitor) {
        monitor.addEventListener("downloadprogress", (event) => {
          if (!controller.signal.aborted && Number.isFinite(event.loaded))
            progress(
              t(
                "Preparing the translation model… {0}%",
                "번역 모델 준비 중… {0}%",
                Math.round(Math.max(0, Math.min(1, event.loaded)) * 100),
              ),
            );
        });
      },
    });
    controller.signal.throwIfAborted();
    progress(t("Translating on your device…", "기기에서 번역 중…"));
    const output = await translator.translate(text, {
      signal: controller.signal,
    });
    controller.signal.throwIfAborted();
    if (typeof output !== "string" || !output.trim() || output.length > 12000)
      throw new Error("Invalid translation");
    return output.trim();
  } catch (error) {
    if (signal.aborted) throw error;
    throw new Error(
      timedOut
        ? t(
            "Translation took too long. Try again when the model download is ready.",
            "번역 준비가 오래 걸립니다. 모델 다운로드가 준비되면 다시 시도해 주세요.",
          )
        : t(
            "Chrome couldn't translate here. The model may need a download, or this page may restrict translation.",
            "Chrome에서 번역하지 못했습니다. 모델 다운로드가 필요하거나 이 페이지가 번역을 제한할 수 있습니다.",
          ),
    );
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", cancel);
    translator?.destroy();
  }
};

export function googleTranslationURL(text: string): string {
  const url = new URL("https://translate.google.com/");
  url.search = new URLSearchParams({
    sl: "en",
    tl: "ko",
    text,
    op: "translate",
  }).toString();
  return url.href;
}
