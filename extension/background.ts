import { t as tr } from "../src/lib/i18n";
import {
  API_ORIGIN,
  defineWord,
  onlineDefinition,
  validWord,
  unavailable,
} from "./dictionary";
import { getSettings, WEB_ORIGINS, sitePattern } from "./settings";
import { VocabularyStore, VOCABULARY_KEY } from "../src/lib/vocabulary";
import { applyLocale, asLocale, LOCALE_KEY } from "../src/lib/i18n";
const localeReady = chrome.storage.local
  .get(LOCALE_KEY)
  .then((data) => applyLocale(data[LOCALE_KEY]))
  .catch(() => {});
const vocabulary = new VocabularyStore({
  async get() {
    return (await chrome.storage.local.get(VOCABULARY_KEY))[VOCABULARY_KEY];
  },
  async set(value) {
    await chrome.storage.local.set({ [VOCABULARY_KEY]: value });
  },
});
// Keep saved words and site preferences outside content-script storage access.
void chrome.storage.local
  .setAccessLevel?.({ accessLevel: "TRUSTED_CONTEXTS" })
  ?.catch(() =>
    console.warn("Glimpse storage access protection could not be applied."),
  );

let syncQueue = Promise.resolve();
function syncScripts(refreshTabs = false) {
  syncQueue = syncQueue
    .catch(() => {})
    .then(async () => {
      if (refreshTabs) await stopReaders();
      const settings = await getSettings();
      const matches: string[] = [];
      if (
        settings.allSites &&
        (await chrome.permissions.contains({ origins: WEB_ORIGINS }))
      )
        matches.push(...WEB_ORIGINS);
      else
        for (const origin of settings.siteOrigins)
          if (await chrome.permissions.contains({ origins: [origin] }))
            matches.push(origin);
      const scripts = await chrome.scripting.getRegisteredContentScripts({
        ids: ["glimpse-reader"],
      });
      if (matches.length) {
        const spec: chrome.scripting.RegisteredContentScript = {
          id: "glimpse-reader",
          matches,
          js: ["content.js"],
          runAt: "document_start",
          allFrames: true,
          persistAcrossSessions: true,
        };
        if (scripts.length) await chrome.scripting.updateContentScripts([spec]);
        else await chrome.scripting.registerContentScripts([spec]);
      } else if (scripts.length)
        await chrome.scripting.unregisterContentScripts({
          ids: ["glimpse-reader"],
        });
      if (refreshTabs && matches.length) {
        const tabs = await chrome.tabs.query({ url: WEB_ORIGINS });
        await Promise.allSettled(
          tabs
            .filter((tab) => {
              const origin = sitePattern(tab.url);
              return (
                tab.id !== undefined &&
                origin &&
                (matches.includes(origin) ||
                  matches.includes(
                    origin.startsWith("https:") ? "https://*/*" : "http://*/*",
                  ))
              );
            })
            .map((tab) => inject(tab.id!)),
        );
      }
    });
  return syncQueue;
}
function scheduleSync(refreshTabs = false) {
  void syncScripts(refreshTabs).catch(() =>
    console.warn(
      "Glimpse could not update automatic site access. Check Chrome's extension settings.",
    ),
  );
}
async function inject(tabId: number) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      files: ["content.js"],
    });
  } catch {
    // Chrome can reject the whole request if a third-party frame lacks permission.
    // Always allow the authorized top document to work independently.
    await chrome.scripting.executeScript({
      target: { tabId, frameIds: [0] },
      files: ["content.js"],
    });
  }
}
async function command(tab?: chrome.tabs.Tab) {
  const active =
    tab ?? (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
  if (active?.id === undefined) return;
  try {
    let ready = false;
    try {
      ready = !!(
        await chrome.tabs.sendMessage(
          active.id,
          { type: "GLIMPSE_PING" },
          { frameId: 0 },
        )
      )?.ready;
    } catch {
      /* first activation */
    }
    if (!ready) {
      await inject(active.id);
      await chrome.tabs.sendMessage(
        active.id,
        { type: "GLIMPSE_READY" },
        { frameId: 0 },
      );
    } else
      await chrome.tabs.sendMessage(active.id, { type: "GLIMPSE_TRIGGER" });
    await chrome.action.setBadgeText({ tabId: active.id, text: "" });
  } catch {
    await chrome.action
      .setBadgeText({ tabId: active.id, text: "!" })
      .catch(() => {});
    await chrome.action
      .setTitle({
        tabId: active.id,
        title: tr(
          "Cannot access this page. Open the extension on a regular webpage.",
          "이 페이지에는 접근할 수 없습니다. 일반 웹페이지에서 확장을 열어 주세요.",
        ),
      })
      .catch(() => {});
  }
}
chrome.commands.onCommand.addListener((name, tab) => {
  if (name === "lookup-word") void command(tab);
});
chrome.runtime.onInstalled.addListener((details) => {
  scheduleSync(true);
  if (details.reason === "install")
    void chrome.tabs.create({
      url: chrome.runtime.getURL("lab/dashboard.html#start"),
    });
});
chrome.runtime.onStartup.addListener(() => {
  scheduleSync();
});
chrome.permissions.onAdded.addListener(() => {
  scheduleSync(true);
});
chrome.permissions.onRemoved.addListener((permissions) => {
  const onlyDictionary =
    permissions.origins?.length &&
    permissions.origins.every((origin) => origin === API_ORIGIN);
  scheduleSync(!onlyDictionary);
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && LOCALE_KEY in changes) {
    applyLocale(changes[LOCALE_KEY].newValue);
    void chrome.tabs.query({}).then((tabs) =>
      Promise.allSettled(
        tabs
          .filter((tab) => tab.id !== undefined)
          .map((tab) =>
            chrome.tabs.sendMessage(tab.id!, {
              type: "GLIMPSE_LOCALE",
              locale: asLocale(changes[LOCALE_KEY].newValue),
            }),
          ),
      ),
    );
  }
  if (
    area === "local" &&
    ["allSites", "siteOrigins"].some((key) => key in changes)
  )
    scheduleSync(true);
});
async function stopReaders() {
  const tabs = await chrome.tabs.query({});
  await Promise.allSettled(
    tabs
      .filter((t) => t.id !== undefined)
      .map((t) => chrome.tabs.sendMessage(t.id!, { type: "GLIMPSE_DISABLE" })),
  );
}
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (
    sender.id !== chrome.runtime.id ||
    !message ||
    typeof message !== "object"
  )
    return;
  const extensionPage = !!sender.url?.startsWith(chrome.runtime.getURL(""));
  const labPage = sender.url?.startsWith(chrome.runtime.getURL("lab/"));
  if (message.type === "GLIMPSE_GET_LOCALE" && (sender.tab || extensionPage)) {
    void chrome.storage.local
      .get(LOCALE_KEY)
      .then((data) => reply(asLocale(data[LOCALE_KEY])))
      .catch(() => reply("en"));
    return true;
  }
  if (
    message.type === "GLIMPSE_DEFINE" &&
    (sender.tab || extensionPage || labPage) &&
    validWord(message.word)
  ) {
    void localeReady
      .then(getSettings)
      .then(async (settings) =>
        defineWord(
          message.word,
          settings.online &&
            (await chrome.permissions.contains({ origins: [API_ORIGIN] })),
        ),
      )
      .then(reply)
      .catch(() =>
        reply({
          word: message.word,
          meaning: tr(
            "Check the dictionary settings.",
            "사전 설정을 확인해 주세요.",
          ),
          language: "ko",
          source: tr("Lookup unavailable", "조회 불가"),
        }),
      );
    return true;
  }
  const respond = (action: Promise<unknown>) => {
    void action
      .then((value) => reply({ ok: true, value }))
      .catch((error) =>
        reply({
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : tr(
                  "Could not save the wordbook.",
                  "단어장을 저장하지 못했습니다.",
                ),
        }),
      );
    return true;
  };
  // Content scripts can save only one explicitly chosen word, never list a user's wordbook.
  if (
    message.type === "GLIMPSE_WORD_SAVE" &&
    (sender.tab || extensionPage) &&
    validWord(message.word)
  ) {
    return respond(
      localeReady
        .then(getSettings)
        .then(async (settings) =>
          defineWord(
            message.word,
            settings.online &&
              (await chrome.permissions.contains({ origins: [API_ORIGIN] })),
          ),
        )
        .then((definition) => vocabulary.save(definition)),
    );
  }
  if (!extensionPage) return;
  if (message.type === "GLIMPSE_WORDS_LIST") return respond(vocabulary.list());
  if (message.type === "GLIMPSE_WORD_REMOVE" && validWord(message.word))
    return respond(vocabulary.remove(message.word));
  if (
    message.type === "GLIMPSE_WORD_MARK" &&
    validWord(message.word) &&
    typeof message.known === "boolean"
  )
    return respond(vocabulary.mark(message.word, message.known));
  if (
    message.type === "GLIMPSE_WORDS_IMPORT" &&
    typeof message.text === "string" &&
    message.text.length <= 5_000_000
  )
    return respond(vocabulary.import(message.text));
  if (message.type === "GLIMPSE_CHECK_ONLINE") {
    void getSettings()
      .then(async (settings) =>
        settings.online &&
        (await chrome.permissions.contains({ origins: [API_ORIGIN] }))
          ? onlineDefinition("serendipity")
          : {
              ...unavailable("serendipity", "online-disabled"),
              meaning: tr(
                "The online English dictionary is off. Enable it in Settings first.",
                "보조 영영 사전이 꺼져 있습니다. 먼저 위 설정을 켜세요.",
              ),
            },
      )
      .then(reply)
      .catch(() => reply(unavailable("serendipity", "network-error")));
    return true;
  }
  if (message.type === "GLIMPSE_ACTIVATE" && Number.isInteger(message.tabId)) {
    void syncScripts()
      .then(() => inject(message.tabId))
      .then(() => reply({ ok: true }))
      .catch(() =>
        reply({
          ok: false,
          error: tr(
            "Cannot access this page. Try a regular HTTP/HTTPS webpage.",
            "이 페이지에는 접근할 수 없습니다. 일반 HTTP/HTTPS 웹페이지에서 다시 시도해 주세요.",
          ),
        }),
      );
    return true;
  }
  if (message.type === "GLIMPSE_STOP") {
    void syncScripts(true)
      .then(() => reply({ ok: true }))
      .catch(() => reply({ ok: false }));
    return true;
  }
});
