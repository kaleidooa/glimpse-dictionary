import type { Definition } from "../src/lib/definition-types";
import { localLexicon } from "../src/lib/local-lexicon";
import { validWord, normalizeWord } from "../src/lib/morphology";
export { validWord } from "../src/lib/morphology";
export const API_ORIGIN = "https://api.dictionaryapi.dev/*";
export type LocalLookup = (word: string) => Promise<Definition | null>;
const messages = {
  "online-disabled":
    "기기 사전에 없는 단어입니다. 필요하면 확장 설정에서 보조 영영 사전을 켜세요.",
  "not-found":
    "등록된 뜻을 찾지 못했습니다. 철자나 전문 용어·고유명사 여부를 확인해 주세요.",
  timeout:
    "보조 영영 사전의 응답이 늦습니다. 잠시 후 다시 시도해 주세요. 기기 영한 사전은 계속 사용할 수 있습니다.",
  "network-error":
    "보조 영영 사전에 연결하지 못했습니다. 기기 영한 사전은 계속 사용할 수 있습니다.",
  "rate-limited":
    "보조 영영 사전의 요청 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.",
  "service-error":
    "보조 영영 사전이 일시적으로 응답하지 않습니다. 기기 영한 사전은 계속 사용할 수 있습니다.",
  "data-error":
    "기기 사전 파일을 읽지 못했습니다. Glimpse 확장과 읽던 페이지를 새로고침해 주세요.",
};
export function unavailable(
  word: string,
  status: keyof typeof messages,
): Definition {
  return {
    word,
    meaning: messages[status],
    language: "ko",
    source:
      status === "online-disabled"
        ? "온라인 조회 꺼짐"
        : status === "data-error"
          ? "사전 파일 확인 필요"
          : "보조 사전 · 조회 불가",
    status,
  };
}
export async function onlineDefinition(
  word: string,
  request: typeof fetch = fetch,
): Promise<Definition> {
  if (!validWord(word)) throw new Error("올바른 영어 단어가 아닙니다.");
  const started = performance.now();
  try {
    const response = await request(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(normalizeWord(word))}`,
      {
        signal: AbortSignal.timeout(2500),
        credentials: "omit",
        referrerPolicy: "no-referrer",
        cache: "no-store",
        redirect: "error",
      },
    );
    if (!response.ok)
      return unavailable(
        word,
        response.status === 404
          ? "not-found"
          : response.status === 429
            ? "rate-limited"
            : "service-error",
      );
    let data: unknown;
    try {
      data = await response.json();
    } catch {
      return unavailable(word, "service-error");
    }
    if (!Array.isArray(data)) return unavailable(word, "service-error");
    const senses: NonNullable<Definition["senses"]> = [];
    let phonetic: string | undefined;
    for (const entry of data) {
      if (!phonetic && typeof entry?.phonetic === "string")
        phonetic = entry.phonetic.slice(0, 120);
      for (const part of Array.isArray(entry?.meanings) ? entry.meanings : []) {
        if (!Array.isArray(part?.definitions)) continue;
        for (const result of part.definitions)
          if (
            typeof result?.definition === "string" &&
            result.definition.trim() &&
            senses.length < 8
          )
            senses.push({
              meaning: result.definition.slice(0, 1500),
              partOfSpeech:
                typeof part.partOfSpeech === "string"
                  ? part.partOfSpeech.slice(0, 60)
                  : undefined,
            });
      }
    }
    if (!senses.length) return unavailable(word, "not-found");
    return {
      word,
      meaning: senses.map((s) => s.meaning).join("; "),
      senses,
      language: "en",
      source: "Free Dictionary API · 영영",
      sourceUrl: "https://dictionaryapi.dev/",
      phonetic,
      status: "found",
      elapsedMs: performance.now() - started,
    };
  } catch (error) {
    return unavailable(
      word,
      error instanceof Error &&
        ["TimeoutError", "AbortError"].includes(error.name)
        ? "timeout"
        : "network-error",
    );
  }
}
export async function defineWord(
  word: string,
  online: boolean,
  request: typeof fetch = fetch,
  local: LocalLookup = (w) => localLexicon.lookup(w),
): Promise<Definition> {
  if (!validWord(word)) throw new Error("올바른 영어 단어가 아닙니다.");
  try {
    const found = await local(word);
    if (found) return found;
  } catch {
    return unavailable(word, "data-error");
  }
  return online
    ? onlineDefinition(word, request)
    : unavailable(word, "online-disabled");
}
