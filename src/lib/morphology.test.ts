import { expect, it } from "vitest";
import { lemmaCandidates, normalizeWord, validWord } from "./morphology";

it.each([
  ["went", "go"],
  ["children", "child"],
  ["mice", "mouse"],
  ["bought", "buy"],
  ["wrote", "write"],
  ["studied", "study"],
  ["companies", "company"],
  ["boxes", "box"],
  ["hoped", "hope"],
  ["hoping", "hope"],
  ["hopped", "hop"],
  ["hopping", "hop"],
  ["making", "make"],
  ["lying", "lie"],
  ["tied", "tie"],
  ["stopped", "stop"],
  ["agreed", "agree"],
  ["happier", "happy"],
  ["biggest", "big"],
  ["analyses", "analysis"],
  ["reader's", "reader"],
  ["saw", "see"],
  ["feet", "foot"],
  ["leaves", "leaf"],
  ["running", "run"],
])(
  "finds the attested or round-trip-compatible root of %s",
  (surface, lemma) => {
    expect(lemmaCandidates(surface).map((c) => c.lemma)).toContain(lemma);
  },
);
it("does not confuse silent-e and doubled-consonant verbs", () => {
  for (const word of ["hoped", "hoping"])
    expect(lemmaCandidates(word).map((c) => c.lemma)).not.toContain("hop");
  for (const word of ["hopped", "hopping"])
    expect(lemmaCandidates(word).map((c) => c.lemma)).not.toContain("hope");
});
it("handles apostrophes and case without accepting sentences or URL payloads", () => {
  expect(normalizeWord("Reader’S")).toBe("reader's");
  expect(validWord("trade-off")).toBe(true);
  for (const invalid of [
    "",
    "two words",
    "https://example.com",
    "<img>",
    "abc?key=secret",
    "한글",
    "a".repeat(81),
  ])
    expect(validWord(invalid)).toBe(false);
});
