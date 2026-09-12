import { t as tr } from "./lib/i18n";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  BookOpen,
  FlaskConical,
  MousePointer2,
  ShieldCheck,
} from "lucide-react";
import { SAMPLE } from "./lib/text";
import { installReader } from "../extension/reader";
import { defineWord } from "../extension/dictionary";
import { DictionaryCheck } from "./components/DictionaryCheck";
import { vocabularyClient } from "./lib/vocabulary-client";
import { VERSION } from "./lib/product";
import "./product.css";
import { LanguageSelect, useLocale } from "./components/LanguageSelect";
const Lab = lazy(() => import("./LabApp"));
export default function App() {
  useLocale();
  const [lab, setLab] = useState(location.hash === "#lab");
  const [online, setOnline] = useState(false);
  const onlineRef = useRef(online);
  onlineRef.current = online;
  const packaged = location.protocol === "chrome-extension:";
  useEffect(() => {
    if (lab) return;
    const reader = installReader(
      (word) =>
        packaged
          ? chrome.runtime.sendMessage({ type: "GLIMPSE_DEFINE", word })
          : defineWord(word, onlineRef.current),
      vocabularyClient.save,
    );
    const key = (e: KeyboardEvent) => {
      if (
        e.altKey &&
        e.shiftKey &&
        e.code === "KeyD" &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.repeat
      ) {
        e.preventDefault();
        void reader.trigger();
      }
    };
    const message = (
      value: { type?: string },
      sender: chrome.runtime.MessageSender,
      reply: (value: unknown) => void,
    ) => {
      if (sender.id !== chrome.runtime.id) return;
      if (value.type === "GLIMPSE_PING") reply({ ready: true });
      if (value.type === "GLIMPSE_TRIGGER") void reader.trigger();
    };
    if (packaged) chrome.runtime.onMessage.addListener(message);
    else window.addEventListener("keydown", key);
    return () => {
      reader.dispose();
      window.removeEventListener("keydown", key);
      if (packaged) chrome.runtime.onMessage.removeListener(message);
    };
  }, [lab, packaged]);
  if (lab)
    return (
      <>
        <div className="lab-return">
          <LanguageSelect />
          <button
            onClick={() => {
              setLab(false);
              history.replaceState(null, "", location.pathname);
            }}
          >
            {tr("← Back to dictionary", "← 커서 사전으로 돌아가기")}{" "}
          </button>
          <span>
            {tr(
              "Eye lab BETA · Connect a webcam to start",
              "실험실 BETA · 웹캠을 직접 연결해야 시작합니다",
            )}
          </span>
        </div>
        <Suspense
          fallback={
            <p className="loading-lab">
              {tr("Opening the lab…", "실험실을 열고 있어요…")}
            </p>
          }
        >
          <Lab />
        </Suspense>
      </>
    );
  return (
    <div className="product">
      <header className="product-nav">
        <a href="./index.html" className="product-brand">
          glimpse<span>.</span>
        </a>
        <a href="./dashboard.html#words">{tr("My words", "내 단어장")}</a>
        <LanguageSelect />
        <button
          onClick={() => {
            setLab(true);
            history.replaceState(null, "", "#lab");
          }}
        >
          <FlaskConical size={15} /> {tr("Lab", "실험실")} <b>BETA</b>
        </button>
      </header>
      <main className="product-main">
        <section className="product-intro" data-glimpse-ui>
          <div>
            <div className="eyebrow">KEEP YOUR PLACE. FIND THE MEANING.</div>
            <h1>
              {tr("Keep your place.", "읽던 자리에서,")} <br />
              <em>{tr("Find the meaning.", "바로 이해하기.")}</em>
            </h1>
            <p>
              {tr(
                "Point at an unfamiliar English word and press the shortcut.",
                "모르는 영어 단어에 커서를 두고 단축키를 누르세요.",
              )}{" "}
              <br />
              {tr(
                "The definition appears beside the word.",
                "뜻은 단어 옆에, 읽는 흐름은 그대로.",
              )}{" "}
            </p>
          </div>
          <div className="shortcut-card">
            <MousePointer2 size={23} />
            <span>{tr("Point at a word", "단어에 커서 두기")}</span>
            <div>
              <kbd>Alt</kbd>
              <i>+</i>
              <kbd>Shift</kbd>
              <i>+</i>
              <kbd>D</kbd>
            </div>
            <small>
              {tr(
                "No selection or search box needed",
                "드래그 없이 · 검색창 없이",
              )}
            </small>
          </div>
        </section>
        <div className="product-columns">
          <article className="product-reader">
            <div className="reader-kicker">
              <BookOpen size={15} />
              <span>TRY IT HERE</span>
              <span>{tr("1 min read", "약 1분 읽기")}</span>
            </div>
            <h2>The quiet art of curiosity</h2>
            <p className="reader-deck">
              Small moments. Unexpected discoveries.
            </p>
            {SAMPLE.split(/\n\s*\n/).map((p, i) => (
              <p className="reading-paragraph" key={i}>
                {p}
              </p>
            ))}
            <div className="reader-bottom">
              {tr("Point and press", "단어 위에서")}{" "}
              <strong>Alt + Shift + D</strong> {tr("· Close with", "· 닫기")}{" "}
              <strong>Esc</strong>
              <ArrowUpRight size={17} />
            </div>
          </article>
          <aside className="product-aside" data-glimpse-ui>
            <section className="product-panel">
              <div className="panel-icon">
                <ShieldCheck size={19} />
              </div>
              <h3>{tr("Works on your device.", "기본은, 기기 안에서.")}</h3>
              <p>
                {tr(
                  "No camera needed. Lookups do not save words, page content or browsing history.",
                  "카메라를 켜지 않습니다. 일반 조회의 단어·본문·방문 기록을 저장하지 않습니다.",
                )}{" "}
              </p>
              <div className="quiet-rule" />
              {!packaged ? (
                <>
                  <label className="online-switch">
                    <input
                      type="checkbox"
                      checked={online}
                      onChange={(e) => setOnline(e.target.checked)}
                    />
                    <span>
                      {tr(
                        "Use online English dictionary",
                        "보조 영영 사전 사용",
                      )}
                    </span>
                  </label>
                  <small>
                    {tr(
                      "Only words missing from the local dictionary go to dictionaryapi.dev. Sentences and page URLs are omitted. The server can see your IP address. This option resets when you close the page.",
                      "기기 영한 사전에 없는 단어만 dictionaryapi.dev로 전송합니다. 문장과 페이지 주소는 보내지 않습니다. 서버에는 IP 주소가 보일 수 있습니다. 이 화면을 닫으면 꺼집니다.",
                    )}{" "}
                  </small>
                </>
              ) : (
                <small>
                  {tr(
                    "Manage the online English dictionary in extension settings.",
                    "보조 영영 사전 사용 여부는 Chrome 확장 설정에서 바꿀 수 있습니다.",
                  )}{" "}
                </small>
              )}
            </section>
            <DictionaryCheck
              lookup={(word) =>
                packaged
                  ? chrome.runtime.sendMessage({ type: "GLIMPSE_DEFINE", word })
                  : defineWord(word, onlineRef.current)
              }
            />
            <section className="product-panel install-panel">
              <span className="eyebrow">BEYOND THIS PAGE</span>
              <h3>{tr("Use it on other websites.", "읽는 웹사이트에서도.")}</h3>
              <p>
                {tr(
                  "Install the Chrome extension to use the shortcut in articles, blogs and documentation.",
                  "Chrome 확장을 설치하면 뉴스, 블로그, 문서의 영어 텍스트에도 같은 단축키를 쓸 수 있어요.",
                )}{" "}
              </p>
              <ol>
                <li>
                  {tr("Open extension settings:", "확장 관리 화면 열기:")}{" "}
                  <code>chrome://extensions</code>
                </li>
                <li>{tr("Enable Developer mode", "개발자 모드 켜기")}</li>
                <li>
                  {tr(
                    "In “Load unpacked”, choose",
                    "‘압축해제된 확장 프로그램 로드’에서",
                  )}{" "}
                  <code>dist-extension</code> {tr("as the folder", "선택")}{" "}
                </li>
                <li>
                  {tr(
                    "Enable the site from the extension popup",
                    "확장 아이콘에서 사이트 사용 켜기",
                  )}
                </li>
              </ol>
              <small>
                {tr(
                  "Chrome internal pages, the Web Store, PDF viewers and text in images are unsupported.",
                  "Chrome 내부 페이지, 웹 스토어, PDF 뷰어, 이미지 속 글자는 지원하지 않습니다.",
                )}{" "}
              </small>
            </section>
            <section className="lab-preview">
              <div>
                <FlaskConical size={18} />
                <b>{tr("Eye tracking", "시선 추적")}</b>
                <span>BETA</span>
              </div>
              <p>
                {tr(
                  "An experimental lab for webcam calibration, scrolling trials and additional training. Accuracy depends on your setup.",
                  "웹캠 보정, 스크롤 평가, 반복 학습을 위한 실험실입니다. 정확도는 환경에 따라 달라집니다.",
                )}{" "}
              </p>
              <small>
                {tr(
                  "The lab saves gaze features and experiment records in this browser. Camera frames are not saved or sent anywhere.",
                  "실험실에서는 시선 특징과 실험 기록이 이 브라우저에 저장됩니다. 카메라 영상은 전송·저장하지 않습니다.",
                )}{" "}
              </small>
              <button
                onClick={() => {
                  setLab(true);
                  history.replaceState(null, "", "#lab");
                }}
              >
                {tr("Open lab", "실험실 열기")} <ArrowUpRight size={15} />
              </button>
            </section>
          </aside>
        </div>
        <footer className="product-footer">
          <span>
            glimpse. <i>A little less friction.</i>
          </span>
          <span>LOCAL FIRST · v{VERSION}</span>
        </footer>
      </main>
    </div>
  );
}
