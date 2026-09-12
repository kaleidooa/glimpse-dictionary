import { readFile } from "node:fs/promises";
import { expect, it, vi } from "vitest";
import { DICTIONARY_WORDS, LocalLexicon } from "./local-lexicon";
const loader = async (path: string) =>
  JSON.parse(await readFile("public/dictionary/" + path, "utf8"));
const dictionary = new LocalLexicon(loader);
it.each([
  ["serendipity", "우연"],
  ["dictionary", "사전"],
  ["resilient", "회복"],
  ["cohesive", "결속"],
  ["ubiquitous", "어디에나"],
  ["feasible", "가능"],
  ["infrastructure", "기반"],
  ["asynchronous", "비동기"],
  ["abandon", "포기"],
  ["ambiguity", "애매"],
  ["ambiguous", "애매"],
  ["evidence", "증거"],
  ["comprehension", "이해"],
  ["initiative", "주도"],
  ["consequence", "결과"],
  ["adequate", "충분"],
  ["accountability", "책임"],
  ["obsolete", "쓸모없"],
  ["constraint", "제약"],
  ["sustainable", "지속"],
  ["hypothesis", "가설"],
  ["cognitive", "인지"],
  ["profound", "심오"],
  ["plausible", "그럴듯"],
  ["inevitable", "피할"],
  ["counterintuitive", "직관"],
  ["constructor", "생성자"],
  ["adversarial", "적대"],
  ["went", "가다"],
  ["children", "어린이"],
  ["bought", "구입"],
  ["studied", "공부"],
  ["companies", "회사"],
  ["hoped", "희망"],
  ["hopped", "뛰다"],
  ["making", "만들"],
  ["news", "소식"],
  ["scissors", "가위"],
  ["business", "사업"],
  ["better", "더 좋은"],
  ["enhanced", "향상"],
  ["evaluating", "평가"],
  ["components", "구성"],
  ["quantified", "수량"],
])(
  "finds a useful Korean sense for %s in actual packaged data",
  async (word, expected) => {
    const result = await dictionary.lookup(word);
    expect(result?.status).toBe("found");
    expect(result?.language).toBe("ko");
    expect(result?.meaning).toContain(expected);
  },
);
it("preserves bank meanings and both saw/see interpretations with attribution", async () => {
  const bank = await dictionary.lookup("bank");
  expect(bank?.meaning).toContain("은행");
  expect(bank?.meaning).toContain("제방");
  const saw = await dictionary.lookup("saw");
  expect(saw?.lemmas).toEqual(expect.arrayContaining(["see", "saw"]));
  expect(saw?.sourceLinks?.map((link) => link.label)).toEqual(
    expect.arrayContaining(["see", "saw"]),
  );
});
it("keeps registered nouns such as news and scissors intact", async () => {
  for (const word of ["news", "business", "scissors", "analysis"])
    expect((await dictionary.lookup(word))?.lemma).toBe(word);
});
it("validates all shipped entries and the manifest counts", async () => {
  const manifest = JSON.parse(
    await readFile("public/dictionary/manifest.json", "utf8"),
  );
  const words = new Set<string>();
  for (const source of ["wiktionary", "kengdic"]) {
    let count = 0,
      senses = 0;
    for (const letter of "abcdefghijklmnopqrstuvwxyz") {
      const data = await loader(`${source}/${letter}.json`);
      for (const [word, entries] of Object.entries(data)) {
        if (
          !Array.isArray(entries) ||
          !entries.length ||
          word[0] !== letter ||
          entries.some((e) => !/[가-힣]/.test(e.gloss))
        )
          throw new Error(`${source}: invalid ${word}`);
        words.add(word);
        count++;
        senses += entries.length;
      }
    }
    expect(count).toBe(manifest.counts[source].words);
    expect(senses).toBe(manifest.counts[source].senses);
  }
  expect(words.size).toBe(DICTIONARY_WORDS);
  expect(DICTIONARY_WORDS).toBeGreaterThan(50000);
});
it("shares concurrent local reads and never reads the network for built-in corrections", async () => {
  const read = vi.fn(loader),
    db = new LocalLexicon(read);
  await db.lookup("resilient");
  expect(read).not.toHaveBeenCalled();
  await Promise.all([
    db.lookup("serendipity"),
    db.lookup("sustainable"),
    db.lookup("serendipity"),
  ]);
  expect(
    read.mock.calls.filter(([path]) => path === "wiktionary/s.json"),
  ).toHaveLength(1);
});
it("retries failed file reads and bounds the shard cache", async () => {
  const read = vi
      .fn(loader)
      .mockRejectedValueOnce(new Error("temporary missing file")),
    db = new LocalLexicon(read);
  await expect(db.lookup("serendipity")).rejects.toThrow();
  expect((await db.lookup("serendipity"))?.language).toBe("ko");
  for (const word of [
    "abandon",
    "bank",
    "constraint",
    "dictionary",
    "exile",
    "faith",
    "go",
    "hypothesis",
    "inevitable",
    "justice",
    "king",
    "language",
    "mouse",
    "news",
  ])
    await db.lookup(word);
  const before = read.mock.calls.filter(
    ([path]) => path === "wiktionary/s.json",
  ).length;
  await db.lookup("serendipity");
  expect(
    read.mock.calls.filter(([path]) => path === "wiktionary/s.json"),
  ).toHaveLength(before + 1);
});
it("returns explicit misses instead of invented meanings or inherited properties", async () => {
  for (const word of ["zzqxnotaword", "hasOwnProperty", "toString"])
    expect(await dictionary.lookup(word)).toBeNull();
});
