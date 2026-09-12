import { expect, it, vi } from "vitest";
import {
  VocabularyStore,
  parseVocabularyBackup,
  vocabularyJSON,
  vocabularyCSV,
  type SavedWord,
} from "./vocabulary";
import type { Definition } from "./definition-types";
const definition: Definition = {
  word: "Serendipity",
  meaning: "우연한 발견",
  language: "ko",
  source: "위키낱말사전",
  sourceLinks: [
    { label: "serendipity", url: "https://ko.wiktionary.org/wiki/serendipity" },
  ],
  license: "CC BY-SA 4.0",
  status: "found",
};
function fixture() {
  let value: unknown;
  const set = vi.fn(async (next: unknown) => {
    value = structuredClone(next);
  });
  const store = new VocabularyStore({
    async get() {
      return value;
    },
    set,
  });
  return { store, set, raw: () => value };
}
it("does not store anything merely because the wordbook was opened", async () => {
  const { store, set } = fixture();
  expect(await store.list()).toEqual([]);
  expect(set).not.toHaveBeenCalled();
});
it("saves only chosen dictionary fields, never surrounding sentences, URLs or gaze features", async () => {
  const { store, raw } = fixture();
  await store.save({
    ...definition,
    sentence: "private sentence",
    pageUrl: "https://private.example",
    features: [1, 2],
  } as Definition);
  const text = JSON.stringify(raw());
  expect(text).not.toContain("private");
  expect(text).not.toContain("features");
  expect((await store.list())[0]).toMatchObject({
    word: "serendipity",
    meaning: "우연한 발견",
    license: "CC BY-SA 4.0",
    known: false,
  });
});
it("serializes concurrent saves, deduplicates case, and preserves known state", async () => {
  const { store } = fixture();
  await Promise.all([
    store.save(definition),
    store.save({ ...definition, word: "serendipity" }),
    store.save({ ...definition, word: "resilient" }),
  ]);
  expect(await store.list()).toHaveLength(2);
  await store.mark("serendipity", true);
  expect(await store.save(definition)).toEqual({ created: false });
  expect(
    (await store.list()).find((word) => word.word === "serendipity")?.known,
  ).toBe(true);
});
it("round-trips a backup with attribution and merges without replacing existing entries", async () => {
  const { store } = fixture();
  await store.save(definition);
  const entries = await store.list(),
    backup = vocabularyJSON(entries);
  expect(parseVocabularyBackup("\ufeff" + backup)).toEqual(entries);
  await store.mark("serendipity", true);
  expect(await store.import(backup)).toEqual({ added: 0 });
  expect((await store.list())[0].known).toBe(true);
  await store.remove("serendipity");
  expect(await store.list()).toEqual([]);
  expect(await store.import(backup)).toEqual({ added: 1 });
});
it("rejects malformed and oversized imports atomically without modifying a good wordbook", async () => {
  const { store, raw } = fixture();
  await store.save(definition);
  const before = JSON.stringify(raw());
  for (const bad of [
    "not json",
    "{}",
    JSON.stringify({ format: "glimpse-vocabulary", version: 99, entries: [] }),
    JSON.stringify({
      format: "glimpse-vocabulary",
      version: 1,
      entries: [{ word: "<script>" }],
    }),
    "x".repeat(5_000_001),
  ]) {
    await expect(async () => store.import(bad)).rejects.toThrow();
    expect(JSON.stringify(raw())).toBe(before);
  }
});
it("does not overwrite a corrupt or newer storage format", async () => {
  const set = vi.fn(),
    store = new VocabularyStore({
      async get() {
        return { version: 2, entries: [] };
      },
      set,
    });
  await expect(store.save(definition)).rejects.toThrow();
  expect(set).not.toHaveBeenCalled();
});
it("refuses to save dictionary error messages and propagates write failures", async () => {
  const { store } = fixture();
  await expect(
    store.save({ ...definition, status: "timeout" }),
  ).rejects.toThrow();
  const broken = new VocabularyStore({
    async get() {},
    async set() {
      throw new Error("quota");
    },
  });
  await expect(broken.save(definition)).rejects.toThrow("quota");
});
it("neutralizes spreadsheet formulas and preserves Korean text and source attribution", async () => {
  const { store } = fixture();
  await store.save(definition);
  const entries = await store.list();
  const dangerous: SavedWord = {
    ...entries[0],
    meaning: '=HYPERLINK("https://example.com")\n뜻,쉼표',
  };
  const csv = vocabularyCSV([dangerous]);
  expect(csv.startsWith("\ufeff")).toBe(true);
  expect(csv).toContain('"\'=HYPERLINK(""');
  expect(csv).toContain("CC BY-SA 4.0");
  expect(csv).toContain("https://ko.wiktionary.org/wiki/serendipity");
});
it("strips active links outside the dictionary source allowlist when importing", async () => {
  const { store } = fixture();
  await store.save(definition);
  const [entry] = await store.list();
  const clean = parseVocabularyBackup(
    vocabularyJSON([
      {
        ...entry,
        sourceLinks: [{ label: "attack", url: "javascript:alert(1)" }],
      },
    ]),
  );
  expect(clean[0].sourceLinks).toEqual([]);
});
