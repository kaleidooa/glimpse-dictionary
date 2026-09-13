import { definitionLabel } from "./lib/definition-labels";
import { t as tr } from "./lib/i18n";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  BookOpen,
  Check,
  Download,
  FlaskConical,
  Github,
  MousePointer2,
  Search,
  Settings2,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import { DictionaryCheck } from "./components/DictionaryCheck";
import { LanguageSelect, useLocale } from "./components/LanguageSelect";
import { vocabularyClient } from "./lib/vocabulary-client";
import {
  VOCABULARY_KEY,
  vocabularyCSV,
  vocabularyJSON,
  type SavedWord,
} from "./lib/vocabulary";
import { REPOSITORY, VERSION } from "./lib/product";
import { defineWord, API_ORIGIN } from "../extension/dictionary";
import { getSettings, WEB_ORIGINS, type Settings } from "../extension/settings";
import { useShortcut } from "./components/useShortcut";
import { DEFAULT_SHORTCUT, SHORTCUTS_URL, shortcutLabel } from "./lib/shortcut";

const route = () =>
  ["start", "words", "settings"].includes(location.hash.slice(1))
    ? location.hash.slice(1)
    : "start";
function download(text: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type })),
    anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function Dashboard() {
  const packaged = location.protocol === "chrome-extension:";
  const locale = useLocale();
  const privacyURL = packaged
    ? chrome.runtime.getURL(
        locale === "ko" ? "privacy.ko.html" : "privacy.html",
      )
    : REPOSITORY +
      "/blob/main/" +
      (locale === "ko" ? "docs/ko/PRIVACY.md" : "PRIVACY.md");
  const [page, setPage] = useState(route),
    [words, setWords] = useState<SavedWord[]>([]);
  const [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all");
  const [shown, setShown] = useState(50);
  const [settings, setSettings] = useState<Settings>({
    online: false,
    allSites: true,
    siteOrigins: [],
  });
  const shortcut = useShortcut();
  const file = useRef<HTMLInputElement>(null);
  const refresh = useCallback(async () => {
    setWords(await vocabularyClient.list());
    if (packaged) {
      const data = await getSettings();
      setSettings({
        ...data,
        online:
          data.online &&
          (await chrome.permissions.contains({ origins: [API_ORIGIN] })),
        allSites:
          data.allSites &&
          (await chrome.permissions.contains({ origins: WEB_ORIGINS })),
      });
    }
  }, []);
  useEffect(() => {
    void refresh().catch((error) => setNotice(error.message));
    const hash = () => {
      setPage(route());
      setNotice("");
      window.scrollTo(0, 0);
    };
    const change = (changes: Record<string, unknown>) => {
      if (
        VOCABULARY_KEY in changes ||
        ["online", "siteOrigins", "allSites"].some((key) => key in changes)
      )
        void refresh().catch((error) => setNotice(error.message));
    };
    const storage = (event: StorageEvent) => {
      if (event.key === VOCABULARY_KEY)
        void refresh().catch((error) => setNotice(error.message));
    };
    const localChange = () => {
      void refresh().catch((error) => setNotice(error.message));
    };
    window.addEventListener("hashchange", hash);
    window.addEventListener("storage", storage);
    window.addEventListener("glimpse-vocabulary-change", localChange);
    if (packaged) chrome.storage.onChanged.addListener(change);
    return () => {
      window.removeEventListener("hashchange", hash);
      window.removeEventListener("storage", storage);
      window.removeEventListener("glimpse-vocabulary-change", localChange);
      if (packaged) chrome.storage.onChanged.removeListener(change);
    };
  }, [refresh]);
  useEffect(() => setShown(50), [query, filter]);
  async function act(action: () => Promise<string | void>) {
    if (busy) return;
    setBusy(true);
    setNotice("");
    try {
      const message = await action();
      await refresh();
      if (message) setNotice(message);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : tr(
              "Could not complete the request. Please retry.",
              "처리하지 못했습니다. 다시 시도해 주세요.",
            ),
      );
    } finally {
      setBusy(false);
    }
  }
  const visible = words.filter(
    (word) =>
      (filter === "all" || word.known === (filter === "known")) &&
      `${word.word} ${word.lemma ?? ""} ${word.meaning}`
        .toLowerCase()
        .includes(query.toLowerCase().trim()),
  );
  async function toggleOnline(enabled: boolean) {
    if (
      enabled &&
      !(await chrome.permissions.contains({ origins: [API_ORIGIN] }))
    )
      return tr(
        "Access was not granted. You can still use the local dictionary.",
        "접근을 허용하지 않았습니다. 기기 사전은 계속 사용할 수 있어요.",
      );
    await chrome.storage.local.set({ online: enabled });
    return enabled
      ? tr(
          "Online English dictionary enabled. Only missing words will be sent.",
          "보조 영영 사전을 켰습니다. 누락 단어만 전송합니다.",
        )
      : tr("Online dictionary disabled.", "보조 사전을 껐습니다.");
  }
  async function toggleAll(enabled: boolean) {
    if (
      enabled &&
      !(await chrome.permissions.contains({ origins: WEB_ORIGINS }))
    )
      return tr(
        "Allow site access in Chrome's extension settings first.",
        "먼저 Chrome 확장 관리에서 사이트 접근을 허용해 주세요.",
      );
    const update: Partial<Settings> = enabled
      ? { allSites: true }
      : { allSites: false, siteOrigins: [] };
    await chrome.storage.local.set(update);
    if (!enabled) {
      await chrome.runtime.sendMessage({ type: "GLIMPSE_STOP" });
    }
    return enabled
      ? tr(
          "Automatic use enabled on regular websites.",
          "일반 웹사이트에서 자동 사용을 켰습니다.",
        )
      : tr(
          "Automatic use stopped and the site list was cleared. Chrome permissions and saved words are unchanged.",
          "자동 사용을 멈추고 사이트 목록을 비웠습니다. Chrome 권한과 저장한 단어는 유지됩니다.",
        );
  }
  return (
    <div className="dashboard">
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        {tr("Skip to content", "본문으로 이동")}{" "}
      </a>
      <header className="dash-header">
        <a className="wordmark" href="./index.html">
          glimpse<span>.</span>
        </a>
        <span className="dash-edition">
          {tr("An English reading companion", "영어를 읽는 나만의 도구")}
        </span>
        <LanguageSelect />
        <a
          className="github-link"
          href={REPOSITORY}
          target="_blank"
          rel="noreferrer"
        >
          <Github size={17} /> GitHub
        </a>
      </header>
      <div className="dash-layout">
        <aside className="dash-sidebar">
          <nav aria-label={tr("Glimpse navigation", "Glimpse 메뉴")}>
            {[
              ["start", tr("Getting started", "처음 사용하기"), MousePointer2],
              ["words", tr("My words", "내 단어장"), BookOpen],
              ["settings", tr("Settings", "설정"), Settings2],
            ].map(([key, label, Icon]) => {
              const Symbol = Icon as typeof BookOpen;
              return (
                <a
                  key={String(key)}
                  href={"#" + key}
                  aria-current={page === key ? "page" : undefined}
                >
                  <Symbol size={18} />
                  {String(label)}
                  {key === "words" && <span>{words.length}</span>}
                </a>
              );
            })}
          </nav>
          <div className="local-note">
            <ShieldCheck size={20} />
            <strong>
              {tr(
                "Your words, on your device.",
                "내 기기에, 내가 고른 단어만.",
              )}
            </strong>
            <p>
              {tr(
                "Only words you explicitly save go into the wordbook. No account or automatic sync.",
                "저장 버튼을 누른 단어만 단어장에 남습니다. 계정과 자동 동기화는 사용하지 않습니다.",
              )}{" "}
            </p>
            <a href={privacyURL} target="_blank" rel="noreferrer">
              {tr(
                "Privacy and data sources ↗",
                "개인정보와 데이터 출처 ↗",
              )}{" "}
            </a>
          </div>
          <small className="dash-version">
            Glimpse {VERSION} · Open source
          </small>
        </aside>
        <main id="main-content" className="dash-content" tabIndex={-1}>
          {notice && (
            <div className="dash-notice" role="status">
              <span>{notice}</span>
              <button
                aria-label={tr("Dismiss message", "안내 닫기")}
                onClick={() => setNotice("")}
              >
                ×
              </button>
            </div>
          )}
          {page === "start" && (
            <>
              <div className="page-heading">
                <div className="eyebrow">A SMALL TOOL FOR A GOOD READ</div>
                <h1>
                  {tr("Look up a word.", "읽던 자리에서")} <br />
                  {tr("Keep reading.", "뜻을 만나세요.")}{" "}
                </h1>
                <p>
                  {tr(
                    "No need to select text or open a search box.",
                    "드래그하거나 검색창을 열 필요 없이.",
                  )}{" "}
                  <br />
                  {shortcut ? (
                    <>
                      {tr(
                        "Point at an English word and press",
                        "영어 단어에 커서를 두고",
                      )}{" "}
                      <kbd>{shortcutLabel(shortcut)}</kbd>
                      {tr(".", "를 누르세요.")}
                    </>
                  ) : (
                    tr(
                      "Choose your lookup shortcut in Settings.",
                      "설정에서 조회 단축키를 확인해 주세요.",
                    )
                  )}
                </p>
              </div>
              <div className="onboard-grid">
                <section className="steps-panel">
                  <h2>
                    {tr(
                      "Three steps to your first word.",
                      "첫 단어까지, 세 단계.",
                    )}
                  </h2>
                  <ol>
                    <li>
                      <span>01</span>
                      <div>
                        <strong>
                          {tr("Open a webpage", "읽을 웹페이지 열기")}
                        </strong>
                        <p>
                          {tr(
                            "Works with regular text in articles, blogs and technical documentation.",
                            "뉴스, 블로그, 기술 문서의 일반 텍스트에서 사용할 수 있어요.",
                          )}{" "}
                        </p>
                      </div>
                    </li>
                    <li>
                      <span>02</span>
                      <div>
                        <strong>
                          {tr(
                            "Move the pointer to a word",
                            "단어 위로 커서 옮기기",
                          )}
                        </strong>
                        <p>
                          {tr(
                            "Glimpse is ready on regular websites by default. No need to open the extension popup first.",
                            "일반 웹사이트에서는 기본으로 준비됩니다. 확장 아이콘을 먼저 누를 필요가 없어요.",
                          )}{" "}
                        </p>
                      </div>
                    </li>
                    <li>
                      <span>03</span>
                      <div>
                        <strong>
                          {tr(
                            "Point and press the shortcut",
                            "커서 두고, 단축키 누르기",
                          )}
                        </strong>
                        <p>
                          {tr(
                            "Or select text and click the small button: Look up for a word, Translate for a sentence. Esc or scrolling closes the result.",
                            "드래그 후 작은 버튼을 눌러도 됩니다. 단어는 뜻 보기, 문장은 번역을 제공합니다. Esc나 스크롤로 닫습니다.",
                          )}{" "}
                        </p>
                      </div>
                    </li>
                  </ol>
                  <a className="button primary" href="./index.html">
                    {tr("Practice on the reading page", "읽기 화면에서 연습")}{" "}
                    <ArrowUpRight size={16} />
                  </a>
                </section>
                <DictionaryCheck
                  lookup={(word) =>
                    packaged
                      ? chrome.runtime.sendMessage({
                          type: "GLIMPSE_DEFINE",
                          word,
                        })
                      : defineWord(word, false)
                  }
                />
              </div>
              <section className="help-row">
                <div>
                  <h2>
                    {tr(
                      "Online lookup is optional.",
                      "인터넷 사전은 선택이에요.",
                    )}
                  </h2>
                  <p>
                    {tr(
                      "Look up Korean definitions for 51,109 headwords on your device. The online English dictionary is off by default.",
                      "한국어 뜻 51,109개 표제어를 기기에서 조회합니다. 보조 영영 사전은 기본으로 꺼져 있어요.",
                    )}{" "}
                  </p>
                </div>
                <div>
                  <h2>
                    {tr(
                      "Shortcut not responding?",
                      "단축키가 반응하지 않나요?",
                    )}
                  </h2>
                  <p>
                    {tr(
                      "Move the pointer over the word and try again. After updating the extension, refresh the webpage too.",
                      "단어 위로 커서를 조금 움직여 다시 누르세요. 확장을 업데이트했다면 읽던 페이지도 새로고침하세요.",
                    )}{" "}
                  </p>
                  {packaged && (
                    <button
                      onClick={() =>
                        void chrome.tabs.create({
                          url: SHORTCUTS_URL,
                        })
                      }
                    >
                      {tr("Check shortcut", "단축키 확인")}{" "}
                    </button>
                  )}
                </div>
              </section>
              <p className="support-note">
                {tr(
                  "Chrome internal pages, the Web Store, PDF viewers and text in images are unsupported. Eye tracking is available in the separate lab in Settings.",
                  "Chrome 내부 화면·웹 스토어·PDF 뷰어·이미지 속 글자는 지원하지 않습니다. 시선 추적은 설정의 별도 실험실에서 사용할 수 있어요.",
                )}{" "}
              </p>
            </>
          )}
          {page === "words" && (
            <>
              <div className="page-heading compact">
                <div className="eyebrow">YOUR WORDS, AT YOUR PACE</div>
                <h1>{tr("Your saved words.", "읽다가 만난 단어들.")}</h1>
                <p>
                  {tr(
                    "Keep words for later and mark the ones you know.",
                    "기억하고 싶은 단어를 모으고, 익숙해진 단어에는 표시를 남기세요.",
                  )}{" "}
                </p>
              </div>
              <div className="wordbook-toolbar">
                <label className="word-search">
                  <Search size={17} />
                  <input
                    aria-label={tr("Search saved words", "단어장 검색")}
                    placeholder={tr(
                      "Search by word or meaning",
                      "단어 또는 뜻 검색",
                    )}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
                <div
                  className="word-filters"
                  role="group"
                  aria-label={tr("Learning status", "학습 상태")}
                >
                  {[
                    ["all", tr("All", "전체")],
                    ["learning", tr("Learning", "학습 중")],
                    ["known", tr("Familiar", "익숙한 단어")],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      aria-pressed={filter === value}
                      onClick={() => setFilter(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="wordbook-summary">
                <span>
                  {tr(
                    "{0} shown · {1}/1,000 total",
                    "{0}개 · 전체 {1}/1,000",
                    visible.length,
                    words.length,
                  )}
                </span>
                <div>
                  <button
                    disabled={!words.length}
                    onClick={() =>
                      download(
                        vocabularyCSV(words),
                        "glimpse-words.csv",
                        "text/csv;charset=utf-8",
                      )
                    }
                  >
                    <Download size={14} /> CSV
                  </button>
                  <button
                    disabled={!words.length}
                    onClick={() =>
                      download(
                        vocabularyJSON(words),
                        "glimpse-backup.json",
                        "application/json",
                      )
                    }
                  >
                    <Download size={14} /> {tr("Backup", "백업")}{" "}
                  </button>
                  <button disabled={busy} onClick={() => file.current?.click()}>
                    <Upload size={14} /> {tr("Import", "가져오기")}{" "}
                  </button>
                  <input
                    ref={file}
                    hidden
                    type="file"
                    accept=".json,application/json"
                    aria-label={tr("Wordbook JSON backup", "단어장 JSON 백업")}
                    onChange={(event) => {
                      const selected = event.target.files?.[0];
                      event.target.value = "";
                      if (!selected) return;
                      void act(async () => {
                        if (selected.size > 5_000_000)
                          throw new Error(
                            tr(
                              "Choose a JSON backup no larger than 5 MB.",
                              "5MB 이하의 JSON 백업을 선택해 주세요.",
                            ),
                          );
                        const result = await vocabularyClient.import(
                          await selected.text(),
                        );
                        return tr(
                          "Added {0} words. Existing words were kept.",
                          "{0}개를 추가했습니다. 기존 단어는 유지했습니다.",
                          result.added,
                        );
                      });
                    }}
                  />
                </div>
              </div>
              {!visible.length ? (
                <div className="wordbook-empty">
                  <BookOpen size={34} />
                  <h2>
                    {words.length
                      ? tr("No matching words.", "검색에 맞는 단어가 없어요.")
                      : tr(
                          "No saved words yet.",
                          "다음에 만날 단어부터, 여기로.",
                        )}
                  </h2>
                  <p>
                    {words.length
                      ? tr(
                          "Try another search or learning filter.",
                          "다른 검색어나 학습 상태를 선택해 보세요.",
                        )
                      : tr(
                          "Click “Save word” in a definition. Only the word and meaning are saved, without the sentence or page URL.",
                          "단어 뜻 팝업에서 ‘단어장에 저장’을 눌러 주세요. 단어와 뜻만 저장하고 읽던 문장·주소는 남기지 않습니다.",
                        )}
                  </p>
                  {!words.length && (
                    <a className="button primary" href="#start">
                      {tr("Look up your first word", "첫 단어 찾아보기")}{" "}
                    </a>
                  )}
                </div>
              ) : (
                <div className="saved-words">
                  {visible.slice(0, shown).map((word) => (
                    <article
                      key={word.word}
                      className={word.known ? "saved-word known" : "saved-word"}
                    >
                      <div className="saved-word-heading">
                        <div>
                          <h2>{word.word}</h2>
                          {word.lemma && word.lemma !== word.word && (
                            <small>
                              {tr("Base form", "원형")} {word.lemma}
                            </small>
                          )}
                        </div>
                        <div className="word-actions">
                          <button
                            disabled={busy}
                            aria-pressed={word.known}
                            aria-label={tr(
                              "Mark {0} as {1}",
                              "{0} {1} 표시",
                              word.word,
                              word.known
                                ? tr("learning", "학습 중으로")
                                : tr("familiar", "익숙한 단어로"),
                            )}
                            onClick={() =>
                              void act(async () => {
                                await vocabularyClient.mark(
                                  word.word,
                                  !word.known,
                                );
                              })
                            }
                          >
                            <Check size={16} />
                            {word.known
                              ? tr("Familiar", "익숙해요")
                              : tr("Familiar", "익숙한 단어")}
                          </button>
                          <button
                            disabled={busy}
                            aria-label={tr("Delete {0}", "{0} 삭제", word.word)}
                            onClick={() =>
                              void act(async () => {
                                await vocabularyClient.remove(word.word);
                                return tr(
                                  "Removed {0} from your wordbook.",
                                  "{0}를 단어장에서 삭제했습니다.",
                                  word.word,
                                );
                              })
                            }
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                      {word.senses.length ? (
                        <ol>
                          {word.senses.map((sense, i) => (
                            <li key={i}>
                              <small>
                                {definitionLabel(sense.partOfSpeech)}
                              </small>
                              {sense.meaning}
                            </li>
                          ))}
                        </ol>
                      ) : (
                        <p>{word.meaning}</p>
                      )}
                      <footer>
                        <span>
                          {definitionLabel(word.source)} · {word.license}
                        </span>
                        {word.sourceLinks.map((link) => (
                          <a
                            key={link.url}
                            href={link.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {link.label} {tr("source ↗", "출처 ↗")}{" "}
                          </a>
                        ))}
                      </footer>
                    </article>
                  ))}
                  {visible.length > shown && (
                    <button onClick={() => setShown((value) => value + 50)}>
                      {tr("Show next", "다음")}{" "}
                      {Math.min(50, visible.length - shown)}
                      {tr(" words", "개 보기")}{" "}
                    </button>
                  )}
                </div>
              )}
              <p className="support-note">
                {tr(
                  "Saved on this device. Removing the extension can delete the wordbook, so keep a JSON backup. Use CSV to move words to another study tool.",
                  "이 기기의 저장 공간에 보관합니다. 확장을 삭제하면 사라질 수 있으니 JSON 백업을 내려받아 두세요. CSV는 다른 학습 도구로 옮길 때 사용할 수 있습니다.",
                )}{" "}
              </p>
            </>
          )}
          {page === "settings" && (
            <>
              <div className="page-heading compact">
                <div className="eyebrow">ONLY WHAT YOU CHOOSE</div>
                <h1>{tr("Settings", "읽는 방식에 맞게.")}</h1>
                <p>
                  {tr(
                    "Choose your sites and dictionary connections.",
                    "사용할 사이트와 외부 연결을 직접 고릅니다.",
                  )}
                </p>
              </div>
              {!packaged && (
                <div className="dash-notice">
                  {tr(
                    "Site permissions are available only in the installed Chrome extension. Open Settings from its popup.",
                    "웹 데모에서는 사이트 권한을 바꾸지 않습니다. 설치한 Chrome 확장 아이콘에서 설정을 열어 주세요.",
                  )}{" "}
                </div>
              )}
              <section className="setting-card">
                <h2>{tr("Keyboard shortcut", "단축키")}</h2>
                <p>
                  {tr(
                    "Look up the word under the pointer. Choose a combination that's comfortable for you.",
                    "커서 아래 단어를 조회합니다. 손에 편한 조합으로 바꿔 보세요.",
                  )}
                </p>
                <label className="shortcut-label" htmlFor="lookup-shortcut">
                  {tr("Current shortcut", "현재 단축키")}
                </label>
                <div className="shortcut-control">
                  <input
                    id="lookup-shortcut"
                    readOnly
                    value={shortcutLabel(shortcut)}
                    aria-describedby="shortcut-help"
                  />
                  <button
                    disabled={!packaged}
                    onClick={() =>
                      void chrome.tabs.create({ url: SHORTCUTS_URL })
                    }
                  >
                    {tr("Change shortcut ↗", "단축키 변경 ↗")}
                  </button>
                </div>
                <p id="shortcut-help">
                  {packaged
                    ? tr(
                        "In Chrome, find Glimpse, click the pencil beside its shortcut, then press your new keys. Changes appear here when you return.",
                        "Chrome에서 Glimpse를 찾고 단축키 옆 연필을 누른 뒤 원하는 키 조합을 누르세요. 돌아오면 변경한 조합이 여기에 표시됩니다.",
                      )
                    : tr(
                        "This demo uses {0}. To choose a different shortcut, open Settings from the installed extension.",
                        "이 데모는 {0}를 사용합니다. 단축키를 바꾸려면 설치한 확장의 설정을 열어 주세요.",
                        shortcutLabel(DEFAULT_SHORTCUT),
                      )}
                </p>
                {packaged && (
                  <p>
                    {shortcut === ""
                      ? tr(
                          "No shortcut is assigned. Another extension may already use the default; choose an available combination.",
                          "등록된 단축키가 없습니다. 다른 확장이 기본 조합을 사용 중일 수 있으니 사용 가능한 조합을 지정해 주세요.",
                        )
                      : tr(
                          "Default for new installs: {0}. An earlier or custom shortcut may still be assigned.",
                          "새 설치 기본값: {0}. 기존 설치에서는 이전 단축키나 직접 지정한 조합이 유지될 수 있습니다.",
                          shortcutLabel(DEFAULT_SHORTCUT),
                        )}
                  </p>
                )}
              </section>
              <section className="setting-card">
                <h2>{tr("Dictionaries", "사전과 연결")}</h2>
                <div className="setting-line">
                  <div>
                    <strong>
                      {tr(
                        "Offline English-to-Korean dictionary",
                        "기기 영한 사전",
                      )}
                    </strong>
                    <p>
                      {tr(
                        "51,109 public headwords plus original corrections. Always available.",
                        "51,109개 공개 표제어와 기본 교정 뜻. 항상 사용할 수 있습니다.",
                      )}{" "}
                    </p>
                  </div>
                  <span className="setting-tag">
                    {tr("Always on", "기본 사용")}
                  </span>
                </div>
                <label className="setting-line">
                  <div>
                    <strong>
                      {tr("Online English dictionary", "보조 영영 사전")}
                    </strong>
                    <p>
                      {tr(
                        "Sends only a missing word to dictionaryapi.dev. No sentences, page URLs or cookies. The server can see your IP address.",
                        "기기 사전에 없는 단어 하나만 dictionaryapi.dev로 전송합니다. 문장·페이지 주소·쿠키는 보내지 않으며 서버에는 IP가 보일 수 있습니다.",
                      )}{" "}
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.online}
                    disabled={!packaged || busy}
                    onChange={(e) =>
                      void act(() => toggleOnline(e.target.checked))
                    }
                  />
                </label>
                {packaged && (
                  <button
                    disabled={!settings.online || busy}
                    onClick={() =>
                      void act(async () => {
                        const result = await chrome.runtime.sendMessage({
                          type: "GLIMPSE_CHECK_ONLINE",
                        });
                        return result.status === "found"
                          ? tr(
                              "Connected. The offline dictionary is still used first.",
                              "연결되었습니다. 기기 영한 사전을 우선 사용합니다.",
                            )
                          : result.meaning;
                      })
                    }
                  >
                    {tr("Check online connection", "온라인 연결 확인")}{" "}
                  </button>
                )}
              </section>
              <section className="setting-card">
                <h2>{tr("Site access", "사이트 접근")}</h2>
                <label className="setting-line">
                  <div>
                    <strong>
                      {tr(
                        "Use automatically on all websites",
                        "모든 웹사이트에서 자동 사용",
                      )}
                    </strong>
                    <p>
                      {tr(
                        "On by default for HTTP/HTTPS pages. Turn it off to choose individual sites. This controls automatic use; browser permissions are managed in Chrome.",
                        "HTTP/HTTPS 페이지에서 기본으로 켜져 있습니다. 끄면 사이트를 개별 선택할 수 있습니다. 자동 실행 여부를 바꾸는 설정이며, 브라우저 권한은 Chrome에서 관리합니다.",
                      )}{" "}
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.allSites}
                    disabled={!packaged || busy}
                    onChange={(e) =>
                      void act(() => toggleAll(e.target.checked))
                    }
                  />
                </label>
                <div className="site-list">
                  {packaged && (
                    <button
                      onClick={() =>
                        void chrome.tabs.create({
                          url: "chrome://extensions/?id=" + chrome.runtime.id,
                        })
                      }
                    >
                      {tr(
                        "Manage access in Chrome ↗",
                        "Chrome에서 접근 권한 관리 ↗",
                      )}
                    </button>
                  )}
                  <h3>{tr("Allowed sites", "개별 허용 사이트")}</h3>
                  {settings.siteOrigins.length ? (
                    settings.siteOrigins.map((origin) => (
                      <div key={origin}>
                        <code>{origin}</code>
                        <button
                          disabled={busy || settings.allSites}
                          onClick={() =>
                            void act(async () => {
                              await chrome.storage.local.set({
                                siteOrigins: settings.siteOrigins.filter(
                                  (s) => s !== origin,
                                ),
                              });
                              await chrome.runtime.sendMessage({
                                type: "GLIMPSE_STOP",
                              });
                              return tr(
                                "Automatic use stopped on this site.",
                                "이 사이트에서 자동 사용을 멈췄습니다.",
                              );
                            })
                          }
                        >
                          {tr("Remove", "해제")}{" "}
                        </button>
                      </div>
                    ))
                  ) : (
                    <p>
                      {tr(
                        "No individual sites selected. When all-site mode is off, add sites from the extension popup.",
                        "개별 선택한 사이트가 없습니다. 전체 사이트 모드를 끈 경우 확장 아이콘에서 사이트를 추가하세요.",
                      )}{" "}
                    </p>
                  )}
                </div>
              </section>
              <section className="setting-card">
                <h2>{tr("Sentence translation", "문장 번역")}</h2>
                <p>
                  {tr(
                    "Select an English sentence and click Translate. Supported desktop Chrome pages translate to Korean on your device; first use may download a model. Up to 2,000 characters, with no translation history saved.",
                    "영어 문장을 드래그하고 번역을 누르세요. 지원하는 데스크톱 Chrome 페이지에서는 기기 안에서 한국어로 번역합니다. 처음에는 모델을 내려받을 수 있습니다. 최대 2,000자를 번역하며 번역 기록은 저장하지 않습니다.",
                  )}
                </p>
                <p>
                  {tr(
                    "If local translation is unavailable, an optional Google Translate link opens a new tab and sends only your selection when clicked.",
                    "기기 내 번역을 사용할 수 없으면 Google 번역 링크를 제공합니다. 직접 눌렀을 때만 선택한 글을 전송하고 새 탭을 엽니다.",
                  )}
                </p>
              </section>
              <section className="setting-card lab-setting">
                <div>
                  <FlaskConical size={22} />
                  <h2>{tr("Eye-tracking lab", "시선 추적 실험실")}</h2>
                  <span className="setting-tag">BETA</span>
                </div>
                <p>
                  {tr(
                    "Test webcam calibration and accuracy on a separate reading page. The camera starts only when connected; frames are not saved or transmitted. Features, sentences and experiment records stay in this browser.",
                    "별도 읽기 화면에서 웹캠 보정과 정확도를 실험합니다. 카메라는 직접 연결할 때만 켜지며 영상은 저장·전송하지 않습니다. 실험용 특징 수치와 문장·기록은 이 브라우저에 보관합니다.",
                  )}{" "}
                </p>
                <a className="button" href="./index.html#lab">
                  {tr("Open lab ↗", "실험실 열기 ↗")}{" "}
                </a>
              </section>
              <section className="setting-card">
                <h2>
                  {tr("Report a dictionary issue", "함께 더 좋은 사전으로.")}
                </h2>
                <p>
                  {tr(
                    "Found a missing word or an odd definition? Report it on GitHub. Private sentences and page URLs are not needed.",
                    "뜻이 어색하거나 단어를 찾지 못했다면 GitHub에 제보할 수 있어요. 비공개 문장이나 페이지 주소는 첨부하지 않아도 됩니다.",
                  )}{" "}
                </p>
                <a
                  className="button"
                  href={REPOSITORY + "/issues/new/choose"}
                  target="_blank"
                  rel="noreferrer"
                >
                  {tr("Report an issue ↗", "문제 제보 ↗")}{" "}
                </a>
                <a
                  className="text-link"
                  href={privacyURL}
                  target="_blank"
                  rel="noreferrer"
                >
                  {tr(
                    "Privacy and dictionary licenses",
                    "개인정보·사전 라이선스",
                  )}{" "}
                </a>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
