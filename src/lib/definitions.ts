import type { Definition, DefinitionProvider } from "./definition-types";
import { localLexicon } from "./local-lexicon";
import { unavailable, type LocalLookup } from "../../extension/dictionary";
import { validWord } from "./morphology";
export type { Definition, DefinitionProvider } from "./definition-types";

/** The localhost lab may use an explicitly configured server key for missing words. */
export class BrowserDefinitionProvider implements DefinitionProvider {
  private cache = new Map<string, Definition>();
  private llmAvailable: boolean | null = null;
  constructor(
    private local: LocalLookup = (word) => localLexicon.lookup(word),
  ) {}
  async getDefinition(word: string, sentence: string): Promise<Definition> {
    if (!validWord(word)) return unavailable(word, "not-found");
    if (
      typeof location !== "undefined" &&
      location.protocol === "chrome-extension:"
    ) {
      return chrome.runtime.sendMessage({ type: "GLIMPSE_DEFINE", word });
    }
    try {
      const found = await this.local(word);
      if (found) return found;
    } catch {
      return unavailable(word, "data-error");
    }
    const cacheKey = word.toLowerCase() + "\n" + sentence;
    const existing = this.cache.get(cacheKey);
    if (existing) return existing;
    if (this.llmAvailable === null) {
      try {
        const r = await fetch("/api/definition/status", {
          signal: AbortSignal.timeout(1500),
        });
        this.llmAvailable = r.ok && (await r.json()).enabled === true;
      } catch {
        this.llmAvailable = false;
      }
    }
    if (this.llmAvailable) {
      try {
        const r = await fetch("/api/definition", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ word, sentence }),
          signal: AbortSignal.timeout(9000),
        });
        if (r.ok) {
          const data = await r.json();
          if (typeof data.meaning === "string" && data.meaning.trim()) {
            const result: Definition = {
              word,
              meaning: data.meaning,
              language: "ko",
              source: "OpenAI · 실험용 문맥 해석",
              status: "found",
            };
            this.cache.set(cacheKey, result);
            if (this.cache.size > 64)
              this.cache.delete(this.cache.keys().next().value!);
            return result;
          }
        }
      } catch {
        /* Keep a missing dictionary entry explicit when the optional model fails. */
      }
    }
    return unavailable(word, "online-disabled");
  }
}
