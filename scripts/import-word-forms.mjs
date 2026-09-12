import { readFile, writeFile, copyFile } from "node:fs/promises";
const forms = {};
for (const [file, pos] of [
  ["verb", "verb"],
  ["noun", "noun"],
  ["adj", "adj"],
  ["adv", "adv"],
]) {
  const data = await readFile(`.qa/wordnet-${file}.exc`, "utf8");
  for (const line of data.trim().split("\n")) {
    const [form, ...lemmas] = line.trim().split(/\s+/);
    if (!/^[a-z]+(?:['-][a-z]+)*$/.test(form)) continue;
    const list = forms[form] ?? [];
    for (const lemma of lemmas)
      if (
        /^[a-z]+(?:['-][a-z]+)*$/.test(lemma) &&
        lemma !== form &&
        !list.some((v) => v[0] === lemma && v[1] === pos)
      )
        list.push([lemma, pos]);
    if (list.length) forms[form] = list;
  }
}
await writeFile("src/lib/word-forms.json", JSON.stringify(forms));
await copyFile(".qa/wordnet-LICENSE", "public/dictionary/WORDNET-LICENSE.txt");
console.log(
  `${Object.keys(forms).length} attested inflected spellings imported from Princeton WordNet 3.0 (NLTK distribution).`,
);
