import type { Definition, DefinitionSense } from "./definition-types";
import { editorial } from "./editorial";
import { offlineMeaning } from "./offline-dictionary";
import {
  lemmaCandidates,
  normalizeWord,
  validWord,
  type LemmaCandidate,
} from "./morphology";
import metadata from "../../public/dictionary/manifest.json";
export const DICTIONARY_WORDS = metadata.uniqueWords;
export type LexiconEntry = {
  gloss: string;
  pos?: string;
  ipa?: string;
  tags?: string[];
  id?: string;
  title?: string;
};
type Shard = Record<string, LexiconEntry[]>;
type Source = "wiktionary" | "kengdic";
type Match = { lemma: string; entries: LexiconEntry[] };
export type ResourceLoader = (path: string) => Promise<unknown>;
const posNames: Record<string, string> = {
  noun: "명사",
  verb: "동사",
  adj: "형용사",
  adv: "부사",
  prep: "전치사",
  pron: "대명사",
  conj: "접속사",
  det: "한정사",
  intj: "감탄사",
  article: "관사",
  num: "수사",
  name: "고유명사",
};
export function dictionaryResource(path: string) {
  if (
    typeof chrome !== "undefined" &&
    chrome.runtime?.id &&
    chrome.runtime.getURL
  )
    return chrome.runtime.getURL("lab/dictionary/" + path);
  return new URL(
    (import.meta.env?.BASE_URL ?? "/") + "dictionary/" + path,
    typeof document !== "undefined" ? document.baseURI : "http://localhost/",
  ).href;
}
const loadResource: ResourceLoader = async (path) => {
  const response = await fetch(dictionaryResource(path), {
    signal: AbortSignal.timeout(4000),
    credentials: "omit",
  });
  if (!response.ok) throw new Error("Dictionary resource missing: " + path);
  return response.json();
};
export class LocalLexicon {
  // Cache database shards, never a history of looked-up words. Shared requests avoid duplicate reads.
  private shards = new Map<string, Promise<Shard>>();
  constructor(private loader: ResourceLoader = loadResource) {}
  private async shard(source: Source, letter: string): Promise<Shard> {
    const key = `${source}/${letter}.json`;
    const cached = this.shards.get(key);
    if (cached) {
      this.shards.delete(key);
      this.shards.set(key, cached);
      return cached;
    }
    const pending = this.loader(key)
      .then((data) => {
        if (!data || typeof data !== "object" || Array.isArray(data))
          throw new Error("Invalid dictionary shard");
        return data as Shard;
      })
      .catch((error) => {
        this.shards.delete(key);
        throw error;
      });
    this.shards.set(key, pending);
    if (this.shards.size > 12)
      this.shards.delete(this.shards.keys().next().value!);
    return pending;
  }
  private async entries(source: Source, key: string): Promise<LexiconEntry[]> {
    const data = await this.shard(source, key[0]);
    return Object.hasOwn(data, key) && Array.isArray(data[key])
      ? data[key].filter((e) => typeof e?.gloss === "string" && e.gloss.trim())
      : [];
  }
  private async forms(
    source: Source,
    candidates: LemmaCandidate[],
  ): Promise<Match[]> {
    const results = await Promise.all(
      candidates.map(async (candidate) => {
        const entries = (await this.entries(source, candidate.lemma)).filter(
          (e) => !candidate.pos || !e.pos || e.pos === candidate.pos,
        );
        return { candidate, entries };
      }),
    );
    const matches: Match[] = [];
    for (const { candidate, entries } of results)
      if (entries.length && !matches.some((m) => m.lemma === candidate.lemma)) {
        matches.push({ lemma: candidate.lemma, entries });
        if (matches.length === 3) break;
      }
    return matches;
  }
  async lookup(word: string): Promise<Definition | null> {
    if (!validWord(word)) return null;
    const key = normalizeWord(word),
      started = performance.now();
    const curated = Object.hasOwn(editorial, key) ? editorial[key] : undefined;
    const builtIn = offlineMeaning(key);
    if (curated || builtIn) {
      const senses = curated?.map((e) => ({
        meaning: e.gloss,
        partOfSpeech: posNames[e.pos],
        headword: key,
      })) ?? [{ meaning: builtIn!, headword: key }];
      return {
        word,
        lemma: key,
        meaning: senses.map((s) => s.meaning).join("; "),
        senses,
        language: "ko",
        source: "Glimpse 기본 사전 · 오프라인",
        matchedBy: "exact",
        status: "found",
        elapsedMs: performance.now() - started,
      };
    }
    const primary = await this.entries("wiktionary", key);
    const candidates = lemmaCandidates(key);
    if (primary.length) {
      // A spelling can be both its own headword and an inflection (saw/see, making/make).
      const alternatives = await this.forms(
        "wiktionary",
        candidates.filter((c) => c.attested || c.pos === "verb"),
      );
      return this.result(
        word,
        [...alternatives, { lemma: key, entries: primary }],
        "wiktionary",
        started,
      );
    }
    const corrected = candidates.flatMap((candidate) =>
      Object.hasOwn(editorial, candidate.lemma)
        ? editorial[candidate.lemma]
            .filter((e) => !candidate.pos || e.pos === candidate.pos)
            .map((e) => ({
              meaning: e.gloss,
              partOfSpeech: posNames[e.pos],
              headword: candidate.lemma,
            }))
        : [],
    );
    if (corrected.length) {
      const senses = corrected
        .filter(
          (entry, i) =>
            corrected.findIndex(
              (other) =>
                other.meaning === entry.meaning &&
                other.headword === entry.headword,
            ) === i,
        )
        .slice(0, 8);
      const lemmas = [...new Set(senses.map((s) => s.headword))];
      return {
        word,
        lemma: lemmas[0],
        lemmas,
        senses,
        meaning: senses.map((s) => s.meaning).join("; "),
        source: "Glimpse 기본 사전 · 오프라인",
        language: "ko",
        matchedBy: "inflection",
        status: "found",
        elapsedMs: performance.now() - started,
      };
    }
    const primaryForms = await this.forms("wiktionary", candidates);
    if (primaryForms.length)
      return this.result(word, primaryForms, "wiktionary", started);
    const secondary = await this.entries("kengdic", key);
    if (secondary.length)
      return this.result(
        word,
        [{ lemma: key, entries: secondary }],
        "kengdic",
        started,
      );
    const secondaryForms = await this.forms("kengdic", candidates);
    return secondaryForms.length
      ? this.result(word, secondaryForms, "kengdic", started)
      : null;
  }
  private result(
    word: string,
    matches: Match[],
    source: Source,
    started: number,
  ): Definition {
    const senses: DefinitionSense[] = [];
    // Round-robin parts of speech/headwords so short popups do not hide every alternate meaning.
    const groups = new Map<string, DefinitionSense[]>();
    for (const match of matches)
      for (const entry of match.entries) {
        const group = `${match.lemma}:${entry.pos ?? ""}`,
          list = groups.get(group) ?? [];
        if (!list.some((s) => s.meaning === entry.gloss))
          list.push({
            meaning: entry.gloss,
            partOfSpeech: posNames[entry.pos ?? ""],
            headword: match.lemma,
            labels: entry.tags,
          });
        groups.set(group, list);
      }
    for (let depth = 0; depth < 6; depth++)
      for (const list of groups.values())
        if (list[depth] && senses.length < 8) senses.push(list[depth]);
    const lemma = matches[0].lemma,
      entries = matches.flatMap((m) => m.entries);
    const isWiki = source === "wiktionary";
    const sourceLinks = isWiki
      ? [
          ...new Set(
            matches.flatMap((m) => m.entries.map((e) => e.title ?? m.lemma)),
          ),
        ].map((title) => ({
          label: title,
          url: `https://ko.wiktionary.org/wiki/${encodeURIComponent(title)}`,
        }))
      : [{ label: "Kengdic", url: "https://github.com/garfieldnate/kengdic" }];
    return {
      word,
      lemma,
      lemmas: matches.map((m) => m.lemma),
      senses,
      meaning: senses.map((s) => s.meaning).join("; "),
      language: "ko",
      source: isWiki
        ? "위키낱말사전 · 오프라인"
        : "Kengdic 보조 사전 · 오프라인",
      sourceUrl: sourceLinks[0].url,
      sourceLinks,
      license: isWiki ? "CC BY-SA 4.0" : "MPL 2.0",
      phonetic: entries.find((e) => e.ipa)?.ipa,
      matchedBy: normalizeWord(word) === lemma ? "exact" : "inflection",
      status: "found",
      elapsedMs: performance.now() - started,
    };
  }
}
export const localLexicon = new LocalLexicon();
