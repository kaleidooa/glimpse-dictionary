import { t as tr } from "../src/lib/i18n";
import { installReader } from "./reader";
import { applyLocale } from "../src/lib/i18n";
const scope = globalThis as typeof globalThis & { __glimpseReaderV2?: boolean };
if (!scope.__glimpseReaderV2) {
  scope.__glimpseReaderV2 = true;
  let active = true;
  const localeReady = chrome.runtime
    .sendMessage({ type: "GLIMPSE_GET_LOCALE" })
    .then(applyLocale)
    .catch(() => {});
  const reader = installReader(
    (word) => chrome.runtime.sendMessage({ type: "GLIMPSE_DEFINE", word }),
    async (definition) => {
      const result = await chrome.runtime.sendMessage({
        type: "GLIMPSE_WORD_SAVE",
        word: definition.word,
      });
      if (!result?.ok)
        throw new Error(
          result?.error ??
            tr(
              "Could not save the wordbook. Refresh the page.",
              "단어장을 저장하지 못했습니다. 페이지를 새로고침해 주세요.",
            ),
        );
      return result.value;
    },
  );
  const listener = (
    message: { type?: string; locale?: unknown },
    sender: chrome.runtime.MessageSender,
    reply: (value: unknown) => void,
  ) => {
    if (sender.id !== chrome.runtime.id) return;
    if (message?.type === "GLIMPSE_PING") reply({ ready: true });
    if (message?.type === "GLIMPSE_LOCALE") applyLocale(message.locale);
    if (message?.type === "GLIMPSE_TRIGGER")
      void localeReady.then(() => {
        if (active) void reader.trigger();
      });
    if (message?.type === "GLIMPSE_READY" && window === window.top)
      void localeReady.then(() => {
        if (active) reader.ready();
      });
    if (message?.type === "GLIMPSE_DISABLE") {
      active = false;
      reader.dispose();
      scope.__glimpseReaderV2 = false;
      chrome.runtime.onMessage.removeListener(listener);
    }
  };
  chrome.runtime.onMessage.addListener(listener);
}
