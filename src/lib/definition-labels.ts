import { getLocale } from "./i18n";
const pairs = [
  ["noun", "명사"],
  ["verb", "동사"],
  ["adjective", "형용사"],
  ["adverb", "부사"],
  ["preposition", "전치사"],
  ["pronoun", "대명사"],
  ["conjunction", "접속사"],
  ["determiner", "한정사"],
  ["interjection", "감탄사"],
  ["article", "관사"],
  ["numeral", "수사"],
  ["proper noun", "고유명사"],
  ["Glimpse dictionary · offline", "Glimpse 기본 사전 · 오프라인"],
  ["Korean Wiktionary · offline", "위키낱말사전 · 오프라인"],
  ["Kengdic · offline", "Kengdic 보조 사전 · 오프라인"],
  ["Free Dictionary API · English", "Free Dictionary API · 영영"],
];
const english = new Map(pairs.map(([en, ko]) => [ko, en]));
const korean = new Map(pairs.map(([en, ko]) => [en, ko]));
export function definitionLabel(value?: string) {
  if (!value) return "";
  return (getLocale() === "ko" ? korean : english).get(value) ?? value;
}
