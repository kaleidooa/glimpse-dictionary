import { createServer } from "vite";
import { readFile, writeFile, mkdir } from "node:fs/promises";

// Lookup coverage and timing only; not an independent semantic-accuracy benchmark.
const readingWords =
  `abandon abundant accessible accommodate accomplish accumulate acknowledge acquire adapt adequate adjacent advocate affect aggregate allocate alternative ambitious ambiguous amend anticipate apparent applicable appreciate appropriate arbitrary assumption attain attribute authentic aware beneficial bias capacity circumstance coherent collaborate compelling compensate complement complex component comprehensive comprise conceive conclude concrete conduct conflict consistent constitute constrain contemporary contradict conventional convey coordinate correspond crucial currency decline deduce define deliberate demonstrate denote derive detect determine diminish discrete discriminate diverse domain dynamic efficient elaborate emerge emphasize empirical enable encounter enhance enormous ensure entity equivalent establish evaluate evident evolve exceed exclude exhibit expand explicit exploit facilitate fluctuate focus foundation framework fundamental generate hence hypothesis identify illustrate imply impose incentive incorporate indicate individual infer inhibit initial innovation insight instance integrate interpret interval intervene intrinsic investigate invoke isolate justify mechanism modify monitor neglect neutral nevertheless notion objective obtain obvious occupy offset ongoing outcome overall participate perceive persist phenomenon potential precise predict preliminary presume previous primary principle priority proceed proportion prospect pursue qualitative quantify rational recover refine reinforce reject relevant reliable require resolve retain reveal rigorous scope seek significant simulate sole specify stable stimulate straightforward subsequent sufficient supplement sustain target temporary tendency theoretical thereby threshold tolerate trace transfer transform transition transmit trend trigger ultimate undergo underlying uniform unique valid vary verify visible whereas widespread achieve achievement adjustment adversity ambitious analogy assessment awareness coherent commitment complexity consensus consistency correlation credible critical deficiency distinction economics effective eligibility empirical engagement expertise exposure financial flexibility functional governance gradual implication independence inevitable influential inherent intellectual interaction investment legislation legitimate mainstream management meaningful motivation obligation perception practical preference probability productivity prominent proportionate recommendation regulation relevance requirement resource responsibility restrictive sensitivity strategic strategy structural systematic tangible transparent uncertainty valuable verification vulnerability aggregate aggregating aggregated aggregates study studying studied studies company companies develop developed developing development build built building begin began begun choose chosen drive drove driven forget forgotten forgets write written wrote see seen saw mouse mice child children foot feet leaf leaves axis axes analysis analyses criterion criteria phenomenon phenomena woman women man men person people good better best bad worse worst make making made hope hoped hoping hop hopped hopping tie tied lying lie went goes gone algorithm database browser server client software hardware application programming function variable asynchronous parallel concurrent dependency deployment repository scalability latency throughput authentication authorization encryption decryption bandwidth protocol endpoint interface documentation debugging regression runtime compile compilation callback closure cache caching infrastructure deterministic heuristic adversarial counterintuitive`.split(
    /\s+/,
  );
const server = await createServer({
  configFile: false,
  server: { watch: null },
  logLevel: "error",
});
try {
  const { LocalLexicon } = await server.ssrLoadModule(
    "/src/lib/local-lexicon.ts",
  );
  let reads = 0;
  const loader = async (path) => {
    reads++;
    return JSON.parse(await readFile("public/dictionary/" + path, "utf8"));
  };
  const all = new Set();
  for (const source of ["wiktionary", "kengdic"])
    for (const letter of "abcdefghijklmnopqrstuvwxyz")
      for (const word of Object.keys(await loader(`${source}/${letter}.json`)))
        all.add(word);
  let seed = 20260912;
  const shuffled = [...all];
  for (let i = shuffled.length - 1; i > 0; i--) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const j = seed % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const percentile = (values, p) =>
    Number(
      [...values]
        .sort((a, b) => a - b)
        [Math.ceil(values.length * p) - 1].toFixed(3),
    );
  async function timed(words, cold) {
    const times = [],
      db = new LocalLexicon(loader);
    reads = 0;
    for (const word of words) {
      const instance = cold ? new LocalLexicon(loader) : db;
      const start = performance.now();
      await instance.lookup(word);
      times.push(performance.now() - start);
    }
    return {
      trials: words.length,
      p50Ms: percentile(times, 0.5),
      p95Ms: percentile(times, 0.95),
      maxMs: Number(Math.max(...times).toFixed(3)),
      fileReads: reads,
    };
  }
  const cold = await timed(shuffled.slice(0, 250), true);
  const mixed = await timed(shuffled.slice(0, 2000), false);
  const repeated = await timed(Array(1000).fill("serendipity"), false);
  const db = new LocalLexicon(loader),
    missing = [],
    sources = {};
  for (const word of [...new Set(readingWords)]) {
    const result = await db.lookup(word);
    if (!result) missing.push(word);
    else sources[result.source] = (sources[result.source] ?? 0) + 1;
  }
  const unreachable = [];
  for (const word of [...all].sort())
    if (!(await db.lookup(word))) unreachable.push(word);
  const report = {
    measuredAt: new Date().toISOString(),
    node: process.version,
    environment:
      "Windows / Node / real filesystem JSON loader / Vite SSR; excludes Chrome IPC, popup rendering and process/module startup; cold means new application cache, not cold OS cache",
    dictionaryWords: all.size,
    reachableHeadwords: all.size - unreachable.length,
    unreachable,
    readingSample: {
      total: new Set(readingWords).size,
      found: new Set(readingWords).size - missing.length,
      missing,
      sources,
      limitation:
        "Author-selected common reading and technology terms. Lookup availability, not correctness or population coverage. Not a held-out corpus.",
    },
    timings: { cold, mixed, repeated },
  };
  await mkdir("reports", { recursive: true });
  await writeFile(
    "reports/dictionary-benchmark.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
  if (unreachable.length) process.exitCode = 1;
} finally {
  await server.close();
}
