export type DefinitionSense = {
  meaning: string;
  partOfSpeech?: string;
  headword?: string;
  labels?: string[];
};
export type Definition = {
  word: string;
  meaning: string;
  language: "ko" | "en";
  source: string;
  phonetic?: string;
  partOfSpeech?: string;
  lemma?: string;
  lemmas?: string[];
  matchedBy?: "exact" | "inflection";
  senses?: DefinitionSense[];
  sourceUrl?: string;
  sourceLinks?: { label: string; url: string }[];
  license?: string;
  elapsedMs?: number;
  status?:
    | "found"
    | "not-found"
    | "online-disabled"
    | "timeout"
    | "network-error"
    | "rate-limited"
    | "data-error"
    | "service-error";
};
export interface DefinitionProvider {
  getDefinition(word: string, sentence: string): Promise<Definition>;
}
