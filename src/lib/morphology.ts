import exceptions from "./word-forms.json";
export const normalizeWord = (word: string) =>
  word.normalize("NFKC").trim().replace(/’/g, "'").toLowerCase();
export const validWord = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length <= 80 &&
  /^[A-Za-z]+(?:['’\-][A-Za-z]+)*$/.test(value);
export type LemmaCandidate = { lemma: string; pos: string; attested: boolean };
function regularForms(lemma: string, pos: string): string[] {
  const y = /[^aeiou]y$/.test(lemma);
  const doubled =
    /[b-df-hj-np-tv-z][aeiou][b-df-hj-np-tv-z]$/.test(lemma) &&
    !/[wxy]$/.test(lemma) &&
    (lemma.match(/[aeiou]+/g)?.length ?? 0) === 1;
  const double = lemma + lemma.at(-1);
  if (pos === "noun")
    return [
      y
        ? lemma.slice(0, -1) + "ies"
        : /(s|x|z|ch|sh|o)$/.test(lemma)
          ? lemma + "es"
          : lemma + "s",
    ];
  if (pos === "verb")
    return [
      ...regularForms(lemma, "noun"),
      y
        ? lemma.slice(0, -1) + "ied"
        : lemma.endsWith("e")
          ? lemma + "d"
          : (doubled ? double : lemma) + "ed",
      lemma.endsWith("ie")
        ? lemma.slice(0, -2) + "ying"
        : /[^e]e$/.test(lemma)
          ? lemma.slice(0, -1) + "ing"
          : (doubled ? double : lemma) + "ing",
    ];
  if (pos === "adj")
    return ["er", "est"].map((suffix) =>
      y
        ? lemma.slice(0, -1) + "i" + suffix
        : lemma.endsWith("e")
          ? lemma.slice(0, -1) + suffix
          : (doubled ? double : lemma) + suffix,
    );
  return [];
}
export function lemmaCandidates(word: string): LemmaCandidate[] {
  const key = normalizeWord(word),
    candidates: LemmaCandidate[] = [];
  const add = (lemma: string, pos: string, attested = false) => {
    if (!attested && !regularForms(lemma, pos).includes(key)) return;
    if (
      lemma !== key &&
      lemma.length > 1 &&
      validWord(lemma) &&
      !candidates.some((c) => c.lemma === lemma && c.pos === pos)
    )
      candidates.push({ lemma, pos, attested });
  };
  const irregular = exceptions as Record<string, string[][]>;
  if (Object.hasOwn(irregular, key))
    for (const [lemma, pos] of irregular[key]) add(lemma, pos, true);
  if (/['’]s$/.test(key)) add(key.slice(0, -2), "", true);
  if (key.length > 4 && key.endsWith("ies")) {
    add(key.slice(0, -3) + "y", "noun");
    add(key.slice(0, -3) + "y", "verb");
  }
  if (key.length > 3 && key.endsWith("s") && !/(ss|us|is)$/.test(key)) {
    add(key.slice(0, -1), "noun");
    add(key.slice(0, -1), "verb");
    if (/(ches|shes|xes|zes|sses|oes)$/.test(key)) {
      add(key.slice(0, -2), "noun");
      add(key.slice(0, -2), "verb");
    }
  }
  if (key.length > 4 && key.endsWith("ied"))
    add(key.slice(0, -3) + "y", "verb");
  for (const suffix of ["ing", "ed"])
    if (key.length >= suffix.length + 2 && key.endsWith(suffix)) {
      const stem = key.slice(0, -suffix.length);
      add(stem, "verb");
      add(stem + "e", "verb");
      if (/([b-df-hj-np-tv-z])\1$/.test(stem)) add(stem.slice(0, -1), "verb");
      if (suffix === "ing" && stem.endsWith("y"))
        add(stem.slice(0, -1) + "ie", "verb");
    }
  for (const suffix of ["er", "est"])
    if (key.length > suffix.length + 2 && key.endsWith(suffix)) {
      const stem = key.slice(0, -suffix.length);
      add(stem, "adj");
      add(stem + "e", "adj");
      if (stem.endsWith("i")) add(stem.slice(0, -1) + "y", "adj");
      if (/([b-df-hj-np-tv-z])\1$/.test(stem)) add(stem.slice(0, -1), "adj");
    }
  return candidates.slice(0, 16);
}
