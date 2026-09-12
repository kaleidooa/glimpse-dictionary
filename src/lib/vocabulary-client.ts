import { t as tr } from "./i18n";
import { VocabularyStore, VOCABULARY_KEY, type SavedWord } from "./vocabulary";
import type { Definition } from "./definition-types";
const packaged = () => location.protocol === "chrome-extension:";
const local = new VocabularyStore({
  async get() {
    const value = localStorage.getItem(VOCABULARY_KEY);
    return value ? JSON.parse(value) : undefined;
  },
  async set(value) {
    localStorage.setItem(VOCABULARY_KEY, JSON.stringify(value));
  },
});
async function message<T>(
  type: string,
  payload: Record<string, unknown> = {},
): Promise<T> {
  const response = await chrome.runtime.sendMessage({ type, ...payload });
  if (!response?.ok)
    throw new Error(
      response?.error ??
        tr(
          "If you updated the extension, refresh this page too.",
          "확장을 업데이트했다면 이 페이지도 새로고침해 주세요.",
        ),
    );
  return response.value as T;
}
const locked = async <T>(action: () => Promise<T>): Promise<T> => {
  const result = navigator.locks
    ? await navigator.locks.request("glimpse-vocabulary", action)
    : await action();
  window.dispatchEvent(new Event("glimpse-vocabulary-change"));
  return result;
};
export const vocabularyClient = {
  list: () =>
    packaged() ? message<SavedWord[]>("GLIMPSE_WORDS_LIST") : local.list(),
  save: (definition: Definition) =>
    packaged()
      ? message<{ created: boolean }>("GLIMPSE_WORD_SAVE", {
          word: definition.word,
        })
      : locked(() => local.save(definition)),
  remove: (word: string) =>
    packaged()
      ? message<void>("GLIMPSE_WORD_REMOVE", { word })
      : locked(() => local.remove(word)),
  mark: (word: string, known: boolean) =>
    packaged()
      ? message<void>("GLIMPSE_WORD_MARK", { word, known })
      : locked(() => local.mark(word, known)),
  import: (text: string) =>
    packaged()
      ? message<{ added: number }>("GLIMPSE_WORDS_IMPORT", { text })
      : locked(() => local.import(text)),
};
