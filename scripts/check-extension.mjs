import { readFile, stat, readdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import vm from "node:vm";
import { pathToFileURL } from "node:url";
const root = resolve("dist-extension");
const manifest = JSON.parse(
  await readFile(resolve(root, "manifest.json"), "utf8"),
);
if (manifest.manifest_version !== 3) throw new Error("Manifest must be V3");
if (
  JSON.stringify([...manifest.host_permissions].sort()) !==
  JSON.stringify(["http://*/*", "https://*/*"])
)
  throw new Error("Automatic lookup requires HTTP and HTTPS host access");
if (
  manifest.version !==
  JSON.parse(await readFile("package.json", "utf8")).version
)
  throw new Error("Manifest/package version mismatch");
const required = [
  manifest.background.service_worker,
  manifest.action.default_popup,
  "content.js",
  "privacy.html",
  "popup.css",
  "lab/index.html",
  "lab/models/face_landmarker.task",
  "lab/mediapipe/vision_wasm_internal.wasm",
  "THIRD-PARTY-NOTICES.txt",
  "lab/dictionary/manifest.json",
  "lab/dictionary/README.txt",
  "lab/dictionary/CC-BY-SA-4.0.txt",
  "lab/dictionary/MPL-2.0.txt",
  "lab/dictionary/WORDNET-LICENSE.txt",
  ...Object.values(manifest.icons),
];
required.push(
  manifest.options_page.split("#")[0],
  "lab/favicon.png",
  "LICENSE.txt",
  "PRIVACY.txt",
  "privacy.ko.html",
  "_locales/en/messages.json",
  "_locales/ko/messages.json",
);
if (manifest.default_locale !== "en")
  throw new Error("Default locale must be English");
for (const locale of ["en", "ko"]) {
  const messages = JSON.parse(
    await readFile(resolve(root, "_locales", locale, "messages.json"), "utf8"),
  );
  for (const key of ["extensionName", "extensionDescription", "lookupCommand"])
    if (!messages[key]?.message)
      throw new Error("Missing manifest translation: " + locale + "/" + key);
}
for (const source of ["wiktionary", "kengdic"])
  for (const letter of "abcdefghijklmnopqrstuvwxyz")
    required.push(`lab/dictionary/${source}/${letter}.json`);
for (const path of required)
  if (!(await stat(resolve(root, path))).size)
    throw new Error(`Empty asset: ${path}`);
new vm.Script(await readFile(resolve(root, "content.js"), "utf8"), {
  filename: "content.js",
});
let checked = 0;
async function scan(folder) {
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const path = resolve(folder, entry.name);
    if (entry.isDirectory()) {
      await scan(path);
      continue;
    }
    if (!/\.(js|html|css)$/.test(path)) continue;
    const source = await readFile(path, "utf8");
    for (const match of source.matchAll(
      /(?:from\s*|import\s*)["'](\.\.?\/[^"']+\.js)["']/g,
    )) {
      await stat(resolve(dirname(path), match[1]));
      checked++;
    }
    if (/\.html$/.test(path))
      for (const match of source.matchAll(
        /(?:src|href)=["']([^"']+\.(?:css|js))["']/g,
      )) {
        if (/^https?:/.test(match[1]))
          throw new Error(`Remote executable/style: ${path}`);
        await stat(resolve(dirname(path), match[1]));
        checked++;
      }
    if (/\.css$/.test(path) && /@import\s+url\(["']?https?:/.test(source))
      throw new Error(`Remote font/style: ${path}`);
  }
}
await scan(root);
// Execute the actual bundled worker with a Chrome API test double, loading the packaged JSON files.
// No browser profile is touched and no external requests are permitted.
let listener;
const event = { addListener() {} };
const localStorage = {};
globalThis.chrome = {
  runtime: {
    id: "package-check",
    getURL: (path) => "chrome-extension://package-check/" + path,
    onMessage: {
      addListener(fn) {
        listener = fn;
      },
    },
    onInstalled: event,
    onStartup: event,
  },
  commands: { onCommand: event },
  storage: {
    local: {
      async get(key) {
        return { [key]: localStorage[key] };
      },
      async set(values) {
        Object.assign(localStorage, structuredClone(values));
      },
      async setAccessLevel() {},
    },
    onChanged: event,
  },
  permissions: {
    async contains() {
      return false;
    },
    onAdded: event,
    onRemoved: event,
  },
};
let localReads = 0;
globalThis.fetch = async (url) => {
  const parsed = new URL(url);
  if (
    parsed.protocol !== "chrome-extension:" ||
    parsed.hostname !== "package-check" ||
    !parsed.pathname.startsWith("/lab/dictionary/")
  )
    throw new Error("Unexpected external request: " + url);
  localReads++;
  return new Response(
    await readFile(resolve(root, parsed.pathname.slice(1)), "utf8"),
  );
};
await import(
  pathToFileURL(resolve(root, manifest.background.service_worker)).href
);
for (const word of [
  "serendipity",
  "went",
  "children",
  "bank",
  "hoped",
  "hopped",
  "saw",
  "enhanced",
  "constructor",
]) {
  const response = await new Promise((resolveReply) => {
    const accepted = listener(
      { type: "GLIMPSE_DEFINE", word },
      { id: "package-check", tab: { id: 1 }, url: "https://example.com/" },
      resolveReply,
    );
    if (accepted !== true) throw new Error("Worker rejected a valid lookup");
  });
  if (response?.status !== "found" || response.language !== "ko")
    throw new Error(
      `Packaged worker failed ${word}: ${JSON.stringify(response)}`,
    );
}
const ownPage = {
  id: "package-check",
  url: "chrome-extension://package-check/lab/dashboard.html",
};
const contentPage = {
  id: "package-check",
  tab: { id: 1 },
  url: "https://example.com/",
};
async function message(payload, sender = ownPage) {
  return new Promise((resolveReply, reject) => {
    if (listener(payload, sender, resolveReply) !== true)
      reject(new Error("Worker rejected " + payload.type));
  });
}
const initialWords = await message({ type: "GLIMPSE_WORDS_LIST" });
if (!initialWords.ok || initialWords.value.length)
  throw new Error("Lookups must not create saved words");
for (let i = 0; i < 2; i++) {
  const saved = await message(
    { type: "GLIMPSE_WORD_SAVE", word: "serendipity" },
    contentPage,
  );
  if (!saved.ok) throw new Error("Packaged save failed");
}
const marked = await message({
  type: "GLIMPSE_WORD_MARK",
  word: "serendipity",
  known: true,
});
const savedWords = await message({ type: "GLIMPSE_WORDS_LIST" });
if (!marked.ok || savedWords.value.length !== 1 || !savedWords.value[0].known)
  throw new Error("Packaged vocabulary persistence/deduplication failed");
for (const type of [
  "GLIMPSE_WORDS_LIST",
  "GLIMPSE_WORD_REMOVE",
  "GLIMPSE_WORD_MARK",
  "GLIMPSE_WORDS_IMPORT",
]) {
  if (
    listener(
      { type, word: "serendipity", known: false, text: "{}" },
      contentPage,
      () => {
        throw new Error("Content script read or mutated private wordbook");
      },
    ) !== undefined
  )
    throw new Error("Untrusted wordbook message accepted");
}
const removed = await message({
  type: "GLIMPSE_WORD_REMOVE",
  word: "serendipity",
});
if (!removed.ok || (await message({ type: "GLIMPSE_WORDS_LIST" })).value.length)
  throw new Error("Packaged word removal failed");
console.log(
  "Packaged wordbook verified: explicit save, duplicate prevention, persistence, learning status, deletion and content-script access boundary.",
);
console.log(
  `Extension package verified: ${required.length} required files and ${checked} script/style references. Classic content script parses; bundled worker resolved 9 words using ${localReads} local reads with external requests blocked. This is not a live Chrome extension integration test.`,
);
