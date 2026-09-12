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

const packaged = location.protocol === "chrome-extension:";
const privacyURL = packaged
  ? chrome.runtime.getURL("privacy.html")
  : REPOSITORY + "/blob/main/PRIVACY.md";
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
  const [page, setPage] = useState(route),
    [words, setWords] = useState<SavedWord[]>([]);
  const [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all");
  const [shown, setShown] = useState(50);
  const [settings, setSettings] = useState<Settings>({
    online: false,
    allSites: false,
    siteOrigins: [],
  });
  const [shortcut, setShortcut] = useState("Alt + Shift + D");
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
      const commands = await chrome.commands.getAll();
      setShortcut(
        commands.find((c) => c.name === "lookup-word")?.shortcut ||
          "단축키를 지정해 주세요",
      );
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
          : "처리하지 못했습니다. 다시 시도해 주세요.",
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
      !(await chrome.permissions.request({ origins: [API_ORIGIN] }))
    )
      return "접근을 허용하지 않았습니다. 기기 사전은 계속 사용할 수 있어요.";
    await chrome.storage.local.set({ online: enabled });
    if (
      !enabled &&
      !settings.allSites &&
      !settings.siteOrigins.includes(API_ORIGIN)
    )
      await chrome.permissions.remove({ origins: [API_ORIGIN] });
    return enabled
      ? "보조 영영 사전을 켰습니다. 누락 단어만 전송합니다."
      : "보조 사전을 껐습니다.";
  }
  async function toggleAll(enabled: boolean) {
    if (
      enabled &&
      !(await chrome.permissions.request({ origins: WEB_ORIGINS }))
    )
      return "접근을 허용하지 않았습니다.";
    const update: Partial<Settings> = enabled
      ? { allSites: true }
      : { allSites: false, siteOrigins: [], online: false };
    await chrome.storage.local.set(update);
    if (!enabled) {
      await chrome.permissions.remove({ origins: WEB_ORIGINS });
      await chrome.runtime.sendMessage({ type: "GLIMPSE_STOP" });
    }
    return enabled
      ? "자동 사용을 켰습니다. 이미 열어 둔 웹페이지는 새로고침해 주세요."
      : "전체 사이트 권한과 기존 사이트 목록, 보조 사전 설정을 해제했습니다.";
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
        본문으로 이동
      </a>
      <header className="dash-header">
        <a className="wordmark" href="./index.html">
          glimpse<span>.</span>
        </a>
        <span className="dash-edition">영어를 읽는 나만의 도구</span>
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
          <nav aria-label="Glimpse 메뉴">
            {[
              ["start", "처음 사용하기", MousePointer2],
              ["words", "내 단어장", BookOpen],
              ["settings", "설정", Settings2],
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
            <strong>내 기기에, 내가 고른 단어만.</strong>
            <p>
              저장 버튼을 누른 단어만 단어장에 남습니다. 계정과 자동 동기화는
              사용하지 않습니다.
            </p>
            <a href={privacyURL} target="_blank" rel="noreferrer">
              개인정보와 데이터 출처 ↗
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
              <button aria-label="안내 닫기" onClick={() => setNotice("")}>
                ×
              </button>
            </div>
          )}
          {page === "start" && (
            <>
              <div className="page-heading">
                <div className="eyebrow">A SMALL TOOL FOR A GOOD READ</div>
                <h1>
                  읽던 자리에서
                  <br />
                  뜻을 만나세요.
                </h1>
                <p>
                  드래그하거나 검색창을 열 필요 없이.
                  <br />
                  영어 단어에 커서를 두고 <kbd>{shortcut}</kbd>를 누르세요.
                </p>
              </div>
              <div className="onboard-grid">
                <section className="steps-panel">
                  <h2>첫 단어까지, 세 단계.</h2>
                  <ol>
                    <li>
                      <span>01</span>
                      <div>
                        <strong>읽을 웹페이지 열기</strong>
                        <p>
                          뉴스, 블로그, 기술 문서의 일반 텍스트에서 사용할 수
                          있어요.
                        </p>
                      </div>
                    </li>
                    <li>
                      <span>02</span>
                      <div>
                        <strong>확장 아이콘에서 이 사이트 켜기</strong>
                        <p>
                          ‘이번 탭에서 사용’으로 먼저 써 보고, 자주 읽는
                          사이트만 자동 사용을 켜세요.
                        </p>
                      </div>
                    </li>
                    <li>
                      <span>03</span>
                      <div>
                        <strong>커서 두고, 단축키 누르기</strong>
                        <p>
                          뜻에서 ‘단어장에 저장’을 누르면 나중에 다시 볼 수
                          있어요. Esc나 스크롤로 닫습니다.
                        </p>
                      </div>
                    </li>
                  </ol>
                  <a className="button primary" href="./index.html">
                    읽기 화면에서 연습 <ArrowUpRight size={16} />
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
                  <h2>인터넷 사전은 선택이에요.</h2>
                  <p>
                    한국어 뜻 51,109개 표제어를 기기에서 조회합니다. 보조 영영
                    사전은 기본으로 꺼져 있어요.
                  </p>
                </div>
                <div>
                  <h2>단축키가 반응하지 않나요?</h2>
                  <p>
                    단어 위로 커서를 조금 움직여 다시 누르세요. 확장을
                    업데이트했다면 읽던 페이지도 새로고침하세요.
                  </p>
                  {packaged && (
                    <button
                      onClick={() =>
                        void chrome.tabs.create({
                          url: "chrome://extensions/shortcuts",
                        })
                      }
                    >
                      단축키 확인
                    </button>
                  )}
                </div>
              </section>
              <p className="support-note">
                Chrome 내부 화면·웹 스토어·PDF 뷰어·이미지 속 글자는 지원하지
                않습니다. 시선 추적은 설정의 별도 실험실에서 사용할 수 있어요.
              </p>
            </>
          )}
          {page === "words" && (
            <>
              <div className="page-heading compact">
                <div className="eyebrow">YOUR WORDS, AT YOUR PACE</div>
                <h1>읽다가 만난 단어들.</h1>
                <p>
                  기억하고 싶은 단어를 모으고, 익숙해진 단어에는 표시를
                  남기세요.
                </p>
              </div>
              <div className="wordbook-toolbar">
                <label className="word-search">
                  <Search size={17} />
                  <input
                    aria-label="단어장 검색"
                    placeholder="단어 또는 뜻 검색"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
                <div
                  className="word-filters"
                  role="group"
                  aria-label="학습 상태"
                >
                  {[
                    ["all", "전체"],
                    ["learning", "학습 중"],
                    ["known", "익숙한 단어"],
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
                  {visible.length}개 · 전체 {words.length}/1,000
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
                    <Download size={14} /> 백업
                  </button>
                  <button disabled={busy} onClick={() => file.current?.click()}>
                    <Upload size={14} /> 가져오기
                  </button>
                  <input
                    ref={file}
                    hidden
                    type="file"
                    accept=".json,application/json"
                    aria-label="단어장 JSON 백업"
                    onChange={(event) => {
                      const selected = event.target.files?.[0];
                      event.target.value = "";
                      if (!selected) return;
                      void act(async () => {
                        if (selected.size > 5_000_000)
                          throw new Error(
                            "5MB 이하의 JSON 백업을 선택해 주세요.",
                          );
                        const result = await vocabularyClient.import(
                          await selected.text(),
                        );
                        return `${result.added}개를 추가했습니다. 기존 단어는 유지했습니다.`;
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
                      ? "검색에 맞는 단어가 없어요."
                      : "다음에 만날 단어부터, 여기로."}
                  </h2>
                  <p>
                    {words.length
                      ? "다른 검색어나 학습 상태를 선택해 보세요."
                      : "단어 뜻 팝업에서 ‘단어장에 저장’을 눌러 주세요. 단어와 뜻만 저장하고 읽던 문장·주소는 남기지 않습니다."}
                  </p>
                  {!words.length && (
                    <a className="button primary" href="#start">
                      첫 단어 찾아보기
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
                            <small>원형 {word.lemma}</small>
                          )}
                        </div>
                        <div className="word-actions">
                          <button
                            disabled={busy}
                            aria-pressed={word.known}
                            aria-label={`${word.word} ${word.known ? "학습 중으로" : "익숙한 단어로"} 표시`}
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
                            {word.known ? "익숙해요" : "익숙한 단어"}
                          </button>
                          <button
                            disabled={busy}
                            aria-label={`${word.word} 삭제`}
                            onClick={() =>
                              void act(async () => {
                                await vocabularyClient.remove(word.word);
                                return `${word.word}를 단어장에서 삭제했습니다.`;
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
                              <small>{sense.partOfSpeech}</small>
                              {sense.meaning}
                            </li>
                          ))}
                        </ol>
                      ) : (
                        <p>{word.meaning}</p>
                      )}
                      <footer>
                        <span>
                          {word.source} · {word.license}
                        </span>
                        {word.sourceLinks.map((link) => (
                          <a
                            key={link.url}
                            href={link.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {link.label} 출처 ↗
                          </a>
                        ))}
                      </footer>
                    </article>
                  ))}
                  {visible.length > shown && (
                    <button onClick={() => setShown((value) => value + 50)}>
                      다음 {Math.min(50, visible.length - shown)}개 보기
                    </button>
                  )}
                </div>
              )}
              <p className="support-note">
                이 기기의 저장 공간에 보관합니다. 확장을 삭제하면 사라질 수
                있으니 JSON 백업을 내려받아 두세요. CSV는 다른 학습 도구로 옮길
                때 사용할 수 있습니다.
              </p>
            </>
          )}
          {page === "settings" && (
            <>
              <div className="page-heading compact">
                <div className="eyebrow">ONLY WHAT YOU CHOOSE</div>
                <h1>읽는 방식에 맞게.</h1>
                <p>사용할 사이트와 외부 연결을 직접 고릅니다.</p>
              </div>
              {!packaged && (
                <div className="dash-notice">
                  웹 데모에서는 사이트 권한을 바꾸지 않습니다. 설치한 Chrome
                  확장 아이콘에서 설정을 열어 주세요.
                </div>
              )}
              <section className="setting-card">
                <h2>단축키</h2>
                <div className="setting-line">
                  <div>
                    <strong>커서 아래 단어 조회</strong>
                    <p>다른 확장과 겹치면 Chrome에서 변경할 수 있어요.</p>
                  </div>
                  <kbd>{shortcut}</kbd>
                </div>
                {packaged && (
                  <button
                    onClick={() =>
                      void chrome.tabs.create({
                        url: "chrome://extensions/shortcuts",
                      })
                    }
                  >
                    Chrome에서 단축키 변경 ↗
                  </button>
                )}
              </section>
              <section className="setting-card">
                <h2>사전과 연결</h2>
                <div className="setting-line">
                  <div>
                    <strong>기기 영한 사전</strong>
                    <p>
                      51,109개 공개 표제어와 기본 교정 뜻. 항상 사용할 수
                      있습니다.
                    </p>
                  </div>
                  <span className="setting-tag">기본 사용</span>
                </div>
                <label className="setting-line">
                  <div>
                    <strong>보조 영영 사전</strong>
                    <p>
                      기기 사전에 없는 단어 하나만 dictionaryapi.dev로
                      전송합니다. 문장·페이지 주소·쿠키는 보내지 않으며 서버에는
                      IP가 보일 수 있습니다.
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
                          ? "연결되었습니다. 기기 영한 사전을 우선 사용합니다."
                          : result.meaning;
                      })
                    }
                  >
                    온라인 연결 확인
                  </button>
                )}
              </section>
              <section className="setting-card">
                <h2>사이트 접근</h2>
                <label className="setting-line">
                  <div>
                    <strong>모든 웹사이트에서 자동 사용</strong>
                    <p>
                      일반 HTTP/HTTPS 사이트에서 작동합니다. 끄면 전체 권한과
                      기존 사이트 목록, 보조 사전 설정도 해제합니다.
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
                  <h3>개별 허용 사이트</h3>
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
                              if (!(origin === API_ORIGIN && settings.online))
                                await chrome.permissions.remove({
                                  origins: [origin],
                                });
                              await chrome.runtime.sendMessage({
                                type: "GLIMPSE_STOP",
                              });
                              return "사이트 접근을 해제했습니다. 다른 허용 사이트는 새로고침으로 다시 사용할 수 있습니다.";
                            })
                          }
                        >
                          해제
                        </button>
                      </div>
                    ))
                  ) : (
                    <p>
                      허용한 사이트가 없습니다. 읽던 페이지의 확장 아이콘에서
                      추가하세요.
                    </p>
                  )}
                </div>
              </section>
              <section className="setting-card lab-setting">
                <div>
                  <FlaskConical size={22} />
                  <h2>시선 추적 실험실</h2>
                  <span className="setting-tag">BETA</span>
                </div>
                <p>
                  별도 읽기 화면에서 웹캠 보정과 정확도를 실험합니다. 카메라는
                  직접 연결할 때만 켜지며 영상은 저장·전송하지 않습니다. 실험용
                  특징 수치와 문장·기록은 이 브라우저에 보관합니다.
                </p>
                <a className="button" href="./index.html#lab">
                  실험실 열기 ↗
                </a>
              </section>
              <section className="setting-card">
                <h2>함께 더 좋은 사전으로.</h2>
                <p>
                  뜻이 어색하거나 단어를 찾지 못했다면 GitHub에 제보할 수
                  있어요. 비공개 문장이나 페이지 주소는 첨부하지 않아도 됩니다.
                </p>
                <a
                  className="button"
                  href={REPOSITORY + "/issues/new/choose"}
                  target="_blank"
                  rel="noreferrer"
                >
                  문제 제보 ↗
                </a>
                <a
                  className="text-link"
                  href={privacyURL}
                  target="_blank"
                  rel="noreferrer"
                >
                  개인정보·사전 라이선스
                </a>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
