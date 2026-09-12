import type { Definition, DefinitionSense } from "./definition-types";
import { normalizeWord, validWord } from "./morphology";

export const VOCABULARY_KEY = "glimpse.vocabulary.v1";
export const VOCABULARY_LIMIT = 1000;
export type SavedWord = {
  word: string;
  lemma?: string;
  meaning: string;
  language: "ko" | "en";
  senses: DefinitionSense[];
  source: string;
  license?: string;
  sourceLinks: { label: string; url: string }[];
  savedAt: number;
  known: boolean;
};
export type VocabularyStorage = {
  get(): Promise<unknown>;
  set(value: unknown): Promise<void>;
};
const clean = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";
export const isDictionarySource = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length <= 500 &&
  /^https:\/\/(ko\.wiktionary\.org|github\.com|dictionaryapi\.dev)\//.test(
    value,
  );
function parseEntry(value: unknown): SavedWord {
  if (!value || typeof value !== "object")
    throw new Error("올바른 단어장 파일이 아닙니다.");
  const data = value as Record<string, unknown>;
  if (
    !validWord(data.word) ||
    !["ko", "en"].includes(String(data.language)) ||
    !clean(data.meaning, 1800) ||
    !Number.isSafeInteger(data.savedAt) ||
    Number(data.savedAt) < 0 ||
    Number(data.savedAt) > 1e13
  )
    throw new Error("단어장에 올바르지 않은 항목이 있습니다.");
  const senses: DefinitionSense[] = Array.isArray(data.senses)
    ? data.senses
        .slice(0, 3)
        .flatMap((s) =>
          s && typeof s === "object" && clean(s.meaning, 600)
            ? [
                {
                  meaning: clean(s.meaning, 600),
                  partOfSpeech: clean(s.partOfSpeech, 40) || undefined,
                  headword: validWord(s.headword)
                    ? normalizeWord(s.headword)
                    : undefined,
                },
              ]
            : [],
        )
    : [];
  const sourceLinks = Array.isArray(data.sourceLinks)
    ? data.sourceLinks
        .slice(0, 8)
        .flatMap((link) =>
          link && isDictionarySource(link.url)
            ? [{ label: clean(link.label, 80) || "출처", url: link.url }]
            : [],
        )
    : [];
  return {
    word: normalizeWord(data.word),
    lemma: validWord(data.lemma) ? normalizeWord(data.lemma) : undefined,
    meaning: clean(data.meaning, 1800),
    language: data.language as "ko" | "en",
    senses,
    source: clean(data.source, 120),
    license: clean(data.license, 80) || undefined,
    sourceLinks,
    savedAt: Number(data.savedAt),
    known: data.known === true,
  };
}
export function parseVocabularyBackup(text: string): SavedWord[] {
  if (text.length > 5_000_000)
    throw new Error("5MB 이하의 Glimpse JSON 백업을 선택해 주세요.");
  let data;
  try {
    data = JSON.parse(text.replace(/^\ufeff/, ""));
  } catch {
    throw new Error("JSON 파일을 읽지 못했습니다.");
  }
  if (
    data?.format !== "glimpse-vocabulary" ||
    data.version !== 1 ||
    !Array.isArray(data.entries) ||
    data.entries.length > VOCABULARY_LIMIT
  )
    throw new Error("Glimpse 단어장 JSON 백업이 아닙니다.");
  return data.entries.map(parseEntry);
}
export function vocabularyJSON(entries: SavedWord[]) {
  return JSON.stringify(
    {
      format: "glimpse-vocabulary",
      version: 1,
      exportedAt: new Date().toISOString(),
      entries,
    },
    null,
    2,
  );
}
export function vocabularyCSV(entries: SavedWord[]) {
  const cell = (value: unknown) => {
    const text = String(value ?? "");
    return (
      '"' +
      (/^[\s]*[=+@\-\t\r]/.test(text) ? "'" + text : text).replace(/"/g, '""') +
      '"'
    );
  };
  const rows = [
    [
      "word",
      "lemma",
      "meaning",
      "source",
      "license",
      "source_urls",
      "saved_at",
      "known",
    ],
    ...entries.map((e) => [
      e.word,
      e.lemma,
      e.meaning,
      e.source,
      e.license,
      e.sourceLinks.map((s) => s.url).join(" "),
      new Date(e.savedAt).toISOString(),
      e.known,
    ]),
  ];
  return "\ufeff" + rows.map((row) => row.map(cell).join(",")).join("\r\n");
}
export class VocabularyStore {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private storage: VocabularyStorage) {}
  async list(): Promise<SavedWord[]> {
    const raw = await this.storage.get();
    if (raw === undefined || raw === null) return [];
    if (
      typeof raw !== "object" ||
      !("version" in raw) ||
      raw.version !== 1 ||
      !("entries" in raw) ||
      !Array.isArray(raw.entries) ||
      raw.entries.length > VOCABULARY_LIMIT
    )
      throw new Error(
        "저장된 단어장을 읽지 못했습니다. 기존 데이터를 덮어쓰지 않았습니다.",
      );
    return raw.entries.map(parseEntry).sort((a, b) => b.savedAt - a.savedAt);
  }
  private mutate<T>(
    fn: (entries: SavedWord[]) => { entries: SavedWord[]; result: T },
  ): Promise<T> {
    const operation = this.queue
      .catch(() => {})
      .then(async () => {
        const next = fn(await this.list());
        if (next.entries.length > VOCABULARY_LIMIT)
          throw new Error(
            `이 기기에는 ${VOCABULARY_LIMIT.toLocaleString()}개까지 보관할 수 있습니다. 백업 후 일부를 정리해 주세요.`,
          );
        const value = { version: 1, entries: next.entries };
        if (new TextEncoder().encode(JSON.stringify(value)).length > 4_000_000)
          throw new Error(
            "단어장 저장 공간이 가득 찼습니다. 백업 후 일부를 정리해 주세요.",
          );
        await this.storage.set(value);
        return next.result;
      });
    this.queue = operation;
    return operation;
  }
  save(definition: Definition): Promise<{ created: boolean }> {
    if (definition.status !== "found")
      return Promise.reject(new Error("뜻을 찾은 단어만 저장할 수 있습니다."));
    const senses = definition.senses?.slice(0, 3) ?? [
      { meaning: definition.meaning, partOfSpeech: definition.partOfSpeech },
    ];
    const entry = parseEntry({
      ...definition,
      senses,
      meaning: senses.map((s) => s.meaning).join("; "),
      sourceLinks:
        definition.sourceLinks ??
        (definition.sourceUrl
          ? [{ label: "출처", url: definition.sourceUrl }]
          : []),
      savedAt: Date.now(),
      known: false,
    });
    return this.mutate<{ created: boolean }>((entries) =>
      entries.some((e) => e.word === entry.word)
        ? { entries, result: { created: false } }
        : { entries: [entry, ...entries], result: { created: true } },
    );
  }
  remove(word: string) {
    return this.mutate((entries) => ({
      entries: entries.filter((e) => e.word !== normalizeWord(word)),
      result: undefined,
    }));
  }
  mark(word: string, known: boolean) {
    return this.mutate((entries) => ({
      entries: entries.map((e) =>
        e.word === normalizeWord(word) ? { ...e, known } : e,
      ),
      result: undefined,
    }));
  }
  import(text: string) {
    const imported = parseVocabularyBackup(text);
    return this.mutate((entries) => {
      const merged = new Map(entries.map((e) => [e.word, e]));
      let added = 0;
      for (const entry of imported)
        if (!merged.has(entry.word)) {
          merged.set(entry.word, entry);
          added++;
        }
      return { entries: [...merged.values()], result: { added } };
    });
  }
}
