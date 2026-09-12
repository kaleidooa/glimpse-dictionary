// The generated datasets remain separate to preserve their upstream licenses.
// Run with already downloaded input files; the runtime never downloads a database.
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
const output = resolve('public/dictionary');
const koPath = process.argv[2] ?? '.qa/kowik-en.jsonl';
const kengPath = process.argv[3] ?? '.qa/kengdic.tsv';
const koRaw = await readFile(koPath, 'utf8'), kengRaw = await readFile(kengPath, 'utf8');
const normalize = value => value.normalize('NFKC').trim().replace(/’/g, "'").toLowerCase();
const valid = value => /^[a-z]+(?:['-][a-z]+)*$/.test(value) && value.length <= 80;
const clean = value => value.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
const sources = {
  wiktionary: { name: '한국어 위키낱말사전', license: 'CC-BY-SA-4.0', url: 'https://kaikki.org/kowiktionary/%EC%98%81%EC%96%B4/index.html', sha256: createHash('sha256').update(koRaw).digest('hex') },
  kengdic: { name: 'Kengdic · Joe Speigle 및 기여자', license: 'MPL-2.0', url: 'https://github.com/garfieldnate/kengdic', sha256: createHash('sha256').update(kengRaw).digest('hex') },
};
const wiki = new Map(), keng = new Map();
function add(map, word, entry) {
  const list = map.get(word) ?? [];
  if (!list.some(e => e.pos === entry.pos && e.gloss === entry.gloss)) list.push(entry);
  map.set(word, list);
}
for (const line of koRaw.trim().split('\n')) {
  const item = JSON.parse(line), word = normalize(item.word ?? '');
  if (item.lang_code !== 'en' || !valid(word) || /[A-Z]/.test(item.word[0]) && item.pos === 'name') continue;
  let pos = item.pos;
  if (pos === 'unknown') {
    const category = item.categories?.map(c => c.name).join(' ') ?? '';
    pos = /영어 형용사/.test(category) ? 'adj' : /영어 부사/.test(category) ? 'adv' : /영어 동사/.test(category) ? 'verb' : /영어 명사/.test(category) ? 'noun' : '';
  }
  const ipa = item.sounds?.find(s => typeof s.ipa === 'string' && !/^(?:en|US|UK)$/i.test(s.ipa) && s.ipa.length < 90)?.ipa;
  for (const sense of item.senses ?? []) {
    const gloss = clean((sense.glosses ?? []).at(-1) ?? '');
    if (!/[가-힣]/.test(gloss) || gloss.length > 800 || sense.tags?.includes('no-gloss')) continue;
    const tags = [...(sense.tags ?? []), ...(sense.raw_tags ?? [])].slice(0, 4);
    add(wiki, word, { gloss, ...(pos ? { pos } : {}), ...(ipa ? { ipa } : {}), ...(tags.length ? { tags } : {}), id: sense.id, title: item.word });
  }
}
for (const line of kengRaw.trim().split('\n').slice(1)) {
  const [id, surface, , gloss] = line.replace(/\r$/, '').split('\t');
  if (!gloss || !surface) continue;
  const word = normalize(gloss.replace(/^to\s+/i, ''));
  const meaning = clean(surface);
  // Exact whole headwords only: never turn an arbitrary definition fragment into a translation.
  if (!valid(word) || !/[가-힣]/.test(meaning) || meaning.length > 100 || /^[은는이가을를의에]\s/.test(meaning)) continue;
  add(keng, word, { gloss: meaning, id });
}
await mkdir(output, { recursive: true });
const counts = {}, bytes = {};
for (const [name, map] of [['wiktionary', wiki], ['kengdic', keng]]) {
  await mkdir(resolve(output, name), { recursive: true });
  let senses = 0, total = 0;
  for (const letter of 'abcdefghijklmnopqrstuvwxyz') {
    const shard = Object.fromEntries([...map].filter(([word]) => word[0] === letter).sort(([a], [b]) => a.localeCompare(b)));
    for (const list of Object.values(shard)) senses += list.length;
    const json = JSON.stringify(shard);
    await writeFile(resolve(output, name, `${letter}.json`), json);
    total += Buffer.byteLength(json);
  }
  counts[name] = { words: map.size, senses }; bytes[name] = total;
}
const all = new Set([...wiki.keys(), ...keng.keys()]);
const manifest = { version: 1, builtAt: new Date().toISOString(), uniqueWords: all.size, sources, counts, bytes, changes: 'English single-word entries only; whitespace/markup normalization; duplicate removal; Korean gloss filter; exact reversal of Kengdic glosses; alphabetical JSON shards. WordNet forms and Glimpse editorial entries are stored separately.' };
await writeFile(resolve(output, 'manifest.json'), JSON.stringify(manifest, null, 2));
// Ship the transformed, human-readable source plus the transformation script under the applicable licenses.
await copyFile('scripts/import-dictionary.mjs', resolve(output, 'import-dictionary.mjs'));
console.log(JSON.stringify(manifest, null, 2));
