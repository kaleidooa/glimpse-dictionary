import { installReader } from "./reader";
const scope = globalThis as typeof globalThis & { __glimpseReaderV2?: boolean };
if (!scope.__glimpseReaderV2) {
  scope.__glimpseReaderV2 = true;
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
            "단어장을 저장하지 못했습니다. 페이지를 새로고침해 주세요.",
        );
      return result.value;
    },
  );
  const listener = (
    message: { type?: string },
    sender: chrome.runtime.MessageSender,
    reply: (value: unknown) => void,
  ) => {
    if (sender.id !== chrome.runtime.id) return;
    if (message?.type === "GLIMPSE_PING") reply({ ready: true });
    if (message?.type === "GLIMPSE_TRIGGER") void reader.trigger();
    if (message?.type === "GLIMPSE_READY" && window === window.top)
      reader.ready();
    if (message?.type === "GLIMPSE_DISABLE") {
      reader.dispose();
      scope.__glimpseReaderV2 = false;
      chrome.runtime.onMessage.removeListener(listener);
    }
  };
  chrome.runtime.onMessage.addListener(listener);
}
