import { getSettings, sitePattern, WEB_ORIGINS } from "./settings";
import { VERSION, DASHBOARD_PATH } from "../src/lib/product";
import type { Definition } from "../src/lib/definition-types";
const byId = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const say = (message: string) => {
  byId("status").textContent = message;
};
let tab: chrome.tabs.Tab | undefined,
  origin: string | null = null,
  busy = false;
const once = byId<HTMLButtonElement>("once"),
  always = byId<HTMLButtonElement>("site-enable"),
  disable = byId<HTMLButtonElement>("site-disable");
const open = (page: string) => {
  void chrome.tabs.create({
    url: chrome.runtime.getURL(DASHBOARD_PATH + "#" + page),
  });
};
byId("words").onclick = () => open("words");
byId("settings").onclick = () => open("settings");
byId("help").onclick = () => open("start");
byId("privacy").onclick = () => {
  void chrome.tabs.create({ url: chrome.runtime.getURL("privacy.html") });
};
byId("version").textContent = "v" + VERSION;
async function refresh() {
  const settings = await getSettings();
  const all =
    settings.allSites &&
    (await chrome.permissions.contains({ origins: WEB_ORIGINS }));
  const allowed =
    !!origin &&
    (all ||
      (settings.siteOrigins.includes(origin) &&
        (await chrome.permissions.contains({ origins: [origin] }))));
  once.disabled = !origin;
  always.disabled = !origin || allowed;
  always.textContent = allowed ? "자동 사용 중 ✓" : "이 사이트에서 항상 사용";
  disable.hidden = !origin || !settings.siteOrigins.includes(origin) || all;
  byId("site-state").textContent = !origin
    ? "이 화면에서는 아래 검색창을 사용하세요. 일반 웹페이지에서 커서 사전을 켤 수 있습니다."
    : allowed
      ? "단어 위에서 단축키를 누르면 바로 뜻이 나옵니다."
      : "먼저 이번 탭에서 사용해 보세요. 자동 사용은 선택할 수 있어요.";
}
function run(action: () => Promise<void>) {
  if (busy) return;
  busy = true;
  const controls = Array.from(
    document.querySelectorAll<HTMLButtonElement | HTMLInputElement>(
      "main input, main button",
    ),
  );
  controls.forEach((control) => {
    control.disabled = true;
  });
  void action()
    .catch((error) =>
      say(error instanceof Error ? error.message : "처리하지 못했습니다."),
    )
    .finally(async () => {
      controls.forEach((control) => {
        control.disabled = false;
      });
      await refresh().catch(() =>
        say("확장 설정을 읽지 못했습니다. 다시 열어 주세요."),
      );
      busy = false;
    });
}
async function activate() {
  if (tab?.id === undefined) return;
  const result = await chrome.runtime.sendMessage({
    type: "GLIMPSE_ACTIVATE",
    tabId: tab.id,
  });
  if (!result?.ok)
    throw new Error(
      result?.error ?? "웹페이지를 새로고침한 뒤 다시 시도해 주세요.",
    );
  say("준비됐어요. 이 창을 닫고 단어 위로 커서를 옮긴 뒤 단축키를 누르세요.");
}
once.onclick = () => run(activate);
always.onclick = () =>
  run(async () => {
    if (!origin) return;
    if (!(await chrome.permissions.request({ origins: [origin] }))) {
      say("허용하지 않았습니다. 이번 탭에서 사용은 계속 이용할 수 있어요.");
      return;
    }
    const settings = await getSettings();
    await chrome.storage.local.set({
      siteOrigins: [...new Set([...settings.siteOrigins, origin])],
    });
    await activate();
  });
disable.onclick = () =>
  run(async () => {
    const settings = await getSettings();
    await chrome.storage.local.set({
      siteOrigins: settings.siteOrigins.filter((s) => s !== origin),
    });
    if (
      origin &&
      !(origin === "https://api.dictionaryapi.dev/*" && settings.online)
    )
      await chrome.permissions.remove({ origins: [origin] });
    await chrome.runtime.sendMessage({ type: "GLIMPSE_STOP" });
    say(
      "자동 사용을 해제했습니다. 다른 허용 사이트는 새로고침으로 다시 사용할 수 있습니다.",
    );
  });
byId("dictionary-form").onsubmit = (event) => {
  event.preventDefault();
  const word = byId<HTMLInputElement>("dictionary-word").value.trim(),
    result = byId("dictionary-result");
  if (word.length > 80 || !/^[A-Za-z]+(?:['’\-][A-Za-z]+)*$/.test(word)) {
    result.textContent = "영어 단어 하나를 입력해 주세요.";
    return;
  }
  run(async () => {
    result.textContent = "뜻을 찾고 있어요…";
    const definition: Definition = await chrome.runtime.sendMessage({
      type: "GLIMPSE_DEFINE",
      word,
    });
    result.replaceChildren();
    const heading = document.createElement("strong");
    heading.className = "result-word";
    heading.textContent = word;
    const meaning = document.createElement("p");
    meaning.textContent =
      definition.senses
        ?.slice(0, 3)
        .map((sense) =>
          [sense.partOfSpeech, sense.meaning].filter(Boolean).join(" · "),
        )
        .join("\n") ?? definition.meaning;
    const info = document.createElement("small");
    info.textContent = [
      definition.matchedBy === "inflection"
        ? `원형 ${(definition.lemmas ?? [definition.lemma]).filter((item) => item?.toLowerCase() !== word.toLowerCase()).join(", ")}`
        : "",
      definition.source,
      definition.license,
    ]
      .filter(Boolean)
      .join(" · ");
    result.append(heading, meaning, info);
    for (const source of definition.sourceLinks ?? []) {
      const link = document.createElement("a");
      link.href = source.url;
      link.textContent = source.label + " 출처";
      link.target = "_blank";
      link.rel = "noreferrer noopener";
      result.append(link);
    }
    if (definition.status === "found") {
      const save = document.createElement("button");
      save.className = "save-word";
      save.textContent = "단어장에 저장";
      save.onclick = () =>
        run(async () => {
          const reply = await chrome.runtime.sendMessage({
            type: "GLIMPSE_WORD_SAVE",
            word,
          });
          if (!reply?.ok)
            throw new Error(reply?.error ?? "저장하지 못했습니다.");
          save.textContent = "단어장에 저장됨 ✓";
          say(
            reply.value.created
              ? "단어와 뜻만 이 기기에 저장했습니다."
              : "이미 저장한 단어입니다.",
          );
        });
      result.append(document.createElement("br"), save);
    }
  });
};
run(async () => {
  [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  origin = sitePattern(tab?.url);
  byId("site").textContent = origin
    ? new URL(tab!.url!).hostname
    : "직접 단어 조회";
  const commands = await chrome.commands.getAll();
  const shortcut = commands.find((c) => c.name === "lookup-word")?.shortcut;
  byId("shortcut").textContent = shortcut || "단축키 미설정";
  if (!shortcut)
    say("단축키가 비어 있습니다. 설정에서 Chrome 단축키를 지정해 주세요.");
});
