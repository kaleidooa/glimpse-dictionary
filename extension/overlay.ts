import { definitionLabel } from "../src/lib/definition-labels";
import { t as tr } from "../src/lib/i18n";
import type { Definition } from "../src/lib/definitions";
import type { Hit } from "./word-at-point";
import { getLocale, subscribeLocale } from "../src/lib/i18n";
import { googleTranslationURL, type Translate } from "./translation";

export function createOverlay(
  save?: (definition: Definition) => Promise<{ created: boolean }>,
) {
  let host: HTMLDivElement | null = null,
    revision = 0;
  let cancel: (() => void) | undefined;
  const close = () => {
    revision++;
    const stop = cancel;
    cancel = undefined;
    stop?.();
    host?.remove();
    host = null;
  };
  const mount = () => {
    host = document.createElement("div");
    host.dataset.glimpseUi = "";
    for (const [name, value] of Object.entries({
      all: "initial",
      position: "fixed",
      inset: "0",
      "z-index": "2147483647",
      "pointer-events": "none",
      display: "block",
    }))
      host.style.setProperty(name, value, "important");
    const shadow = host.attachShadow({ mode: "closed" });
    document.documentElement.append(host);
    return shadow;
  };
  const style = (shadow: ShadowRoot, text: string) => {
    if (typeof CSSStyleSheet.prototype.replaceSync === "function") {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(text);
      shadow.adoptedStyleSheets = [sheet];
    } else {
      const css = document.createElement("style");
      css.textContent = text;
      shadow.prepend(css);
    }
  };
  const offer = (hit: Hit, isWord: boolean, activate: () => void) => {
    close();
    const shadow = mount();
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = tr(
      isWord ? "Look up" : "Translate",
      isWord ? "뜻 보기" : "번역",
    );
    button.title = isWord
      ? tr("Look up the selected word", "선택한 단어 뜻 보기")
      : tr(
          "English → Korean · On-device translation; first use may download a model",
          "영어 → 한국어 · 기기 내 번역 · 처음에는 모델을 내려받을 수 있습니다",
        );
    button.onpointerdown = (event) => event.preventDefault();
    button.onclick = activate;
    shadow.append(button);
    style(
      shadow,
      ":host{color-scheme:light}button{position:fixed;pointer-events:auto;border:1px solid #c6d2bc;border-radius:7px;padding:5px 9px;background:#fffdf7;color:#3e5b38;box-shadow:0 2px 8px #15302216;font:12px/1.5 system-ui,'Malgun Gothic',sans-serif;cursor:pointer}button:hover{background:#eef3e7}button:focus-visible{outline:2px solid #326a47;outline-offset:2px}",
    );
    const box = button.getBoundingClientRect();
    button.style.left = `${Math.max(8, Math.min(hit.rect.right - box.width, innerWidth - box.width - 8))}px`;
    button.style.top = `${Math.max(8, hit.rect.bottom + box.height + 12 < innerHeight ? hit.rect.bottom + 5 : hit.rect.top - box.height - 5)}px`;
  };
  const show = (
    hit: Hit | null,
    message?: string,
    options: {
      title?: string;
      translation?: boolean;
      cancel?: () => void;
      footer?: HTMLElement;
    } = {},
  ) => {
    close();
    const token = revision;
    cancel = options.cancel;
    const shadow = mount();
    const markers = document.createElement("div");
    markers.setAttribute("aria-hidden", "true");
    for (const rect of hit?.rects ?? []) {
      const mark = document.createElement("div");
      mark.className = "word-marker";
      Object.assign(mark.style, {
        left: `${rect.left - 1}px`,
        top: `${rect.top}px`,
        width: `${rect.width + 2}px`,
        height: `${rect.height}px`,
      });
      markers.append(mark);
    }
    const css = document.createElement("style");
    css.textContent = `:host{color-scheme:light}*{box-sizing:border-box}.card{position:fixed;width:min(320px,calc(100vw - 24px));max-height:calc(100vh - 24px);overflow:auto;padding:20px;background:#fffdf7;color:#263d32;border:1px solid #dce2d4;border-radius:16px;box-shadow:0 12px 44px #15302226;font:14px/1.65 system-ui,'Malgun Gothic',sans-serif;pointer-events:auto;text-align:left;word-break:normal;overflow-wrap:anywhere}.title{display:flex;gap:10px;align-items:start}.word{font:bold 26px/1.2 Georgia,serif;flex:1}button{border:0;background:transparent;color:#53695a;font:20px/1 system-ui;cursor:pointer;padding:2px 4px}p{margin:12px 0}small{display:block;color:#6a7d6f;font-size:11px}button:focus-visible{outline:2px solid #326a47;border-radius:3px}`;
    const card = document.createElement("section");
    css.textContent +=
      ".card{width:min(360px,calc(100vw - 24px))}.lemma{color:#708163;font-size:11px;margin-top:8px}.sense{padding:9px 0;border-bottom:1px solid #e9ecdf;line-height:1.65}.pos{color:#829273;font-size:10px;margin-right:6px}.senses{margin:10px 0 15px}.more{font:11px system-ui;padding:9px 0;color:#587a42}a{color:inherit;text-decoration:underline;text-underline-offset:2px}a:focus-visible{outline:2px solid #326a47;border-radius:3px}";
    css.textContent +=
      ".card{font-size:15px}.lemma,.pos,small,.more{font-size:12px;color:#52634b}.save{font:13px/1.5 system-ui;border:1px solid #b8c7ab;border-radius:7px;padding:7px 10px;color:#304d31;background:#f0f5e9;margin:12px 0 0}.save:disabled{cursor:default;opacity:.7}.save-note{font-size:12px;color:#52634b;margin:6px 0 0}.save-note:empty{display:none}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto}}";
    css.textContent +=
      ".word-marker{position:fixed;pointer-events:none;background:rgba(112,148,99,.12);border-bottom:1px solid rgba(92,128,79,.48);border-radius:3px;box-sizing:border-box}@media(forced-colors:active){.word-marker{background:transparent;border-bottom-color:Highlight}}";
    card.className = options.translation ? "card translation" : "card";
    css.textContent +=
      ".translation .word{font:600 18px/1.5 system-ui}.translation p{white-space:pre-wrap}.translation .retry{font:13px/1.5 system-ui;border:1px solid #b8c7ab;border-radius:7px;padding:6px 10px;margin-top:12px}.translation .retry[hidden]{display:none}";
    card.setAttribute("role", "status");
    card.setAttribute("aria-live", "polite");
    const title = document.createElement("div");
    title.className = "title";
    const word = document.createElement("strong");
    word.className = "word";
    word.textContent = options.title ?? hit?.word ?? "glimpse.";
    const dismiss = document.createElement("button");
    dismiss.textContent = "×";
    dismiss.setAttribute(
      "aria-label",
      options.translation
        ? tr("Close translation", "번역 닫기")
        : tr("Close definition", "뜻 닫기"),
    );
    dismiss.onclick = close;
    const meaning = document.createElement("p");
    meaning.textContent =
      message ?? tr("Looking up the word…", "뜻을 찾고 있어요…");
    const lemma = document.createElement("div");
    lemma.className = "lemma";
    const senses = document.createElement("div");
    senses.className = "senses";
    const source = document.createElement("small");
    source.textContent = tr("GLIMPSE · ESC to close", "GLIMPSE · ESC로 닫기");
    title.append(word, dismiss);
    card.append(title, lemma, meaning, senses, source);
    if (options.footer) card.append(options.footer);
    shadow.append(markers, card);
    style(shadow, css.textContent);
    const position = () => {
      const rect = card.getBoundingClientRect();
      card.style.left = `${Math.max(12, Math.min(hit?.rect.left ?? innerWidth - rect.width - 24, innerWidth - rect.width - 12))}px`;
      const bottom = hit?.rect.bottom ?? 12;
      card.style.top = `${Math.max(12, bottom + rect.height + 20 < innerHeight ? bottom + 8 : (hit?.rect.top ?? innerHeight) - rect.height - 8)}px`;
    };
    position();
    return (definition: Definition) => {
      if (revision !== token || !host?.isConnected) return;
      if (
        hit &&
        (!hit.range.startContainer.isConnected ||
          hit.range.toString() !== hit.word)
      ) {
        close();
        return;
      }
      if (hit) {
        const current = Array.from(hit.range.getClientRects());
        if (
          hit.rects.some(
            (old) =>
              !current.some(
                (rect) =>
                  Math.abs(rect.left - old.left) < 1 &&
                  Math.abs(rect.top - old.top) < 1 &&
                  Math.abs(rect.width - old.width) < 1 &&
                  Math.abs(rect.height - old.height) < 1,
              ),
          )
        ) {
          close();
          return;
        }
      }
      lemma.textContent = [
        definition.matchedBy === "inflection"
          ? tr(
              "Base form: {0}",
              "원형: {0}",
              (definition.lemmas ?? [definition.lemma])
                .filter(
                  (item) =>
                    item?.toLowerCase() !== definition.word.toLowerCase(),
                )
                .join(" · "),
            )
          : "",
        definition.phonetic,
      ]
        .filter(Boolean)
        .join("  ");
      meaning.textContent = definition.senses?.length ? "" : definition.meaning;
      if (options.translation) meaning.lang = definition.language;
      const renderSenses = (expanded: boolean) => {
        senses.replaceChildren();
        for (const item of (definition.senses ?? []).slice(
          0,
          expanded ? 8 : 3,
        )) {
          const row = document.createElement("div");
          row.className = "sense";
          const part = document.createElement("span");
          part.className = "pos";
          part.textContent = [
            definition.lemmas && definition.lemmas.length > 1
              ? item.headword
              : "",
            definitionLabel(item.partOfSpeech),
          ]
            .filter(Boolean)
            .join(" · ");
          row.append(part, document.createTextNode(item.meaning));
          senses.append(row);
        }
        if ((definition.senses?.length ?? 0) > 3) {
          const more = document.createElement("button");
          more.className = "more";
          more.textContent = expanded
            ? tr("Show less", "접기")
            : tr(
                "Show {0} more senses",
                "다른 뜻 {0}개 더 보기",
                (definition.senses?.length ?? 0) - 3,
              );
          more.onclick = () => {
            renderSenses(!expanded);
            position();
          };
          senses.append(more);
        }
      };
      renderSenses(false);
      source.textContent = [
        definitionLabel(definition.source),
        definition.license,
      ]
        .filter(Boolean)
        .join(" · ");
      for (const item of definition.sourceLinks ??
        (definition.sourceUrl
          ? [{ label: tr("Source", "출처"), url: definition.sourceUrl }]
          : []))
        if (
          /^https:\/\/(ko\.wiktionary\.org|github\.com|dictionaryapi\.dev)\//.test(
            item.url,
          ) ||
          (options.translation &&
            item.url.startsWith("https://translate.google.com/?"))
        ) {
          const link = document.createElement("a");
          link.href = item.url;
          link.textContent = item.label;
          link.target = "_blank";
          link.rel = "noreferrer noopener";
          source.append(" · ", link);
        }
      if (!options.translation && save && definition.status === "found") {
        const button = document.createElement("button");
        button.className = "save";
        button.textContent = tr("Save word", "단어장에 저장");
        button.title = tr(
          "Saves this word and its definition on your device, without the sentence or page URL.",
          "이 단어와 뜻만 기기에 저장합니다. 문장과 페이지 주소는 저장하지 않습니다.",
        );
        const note = document.createElement("p");
        note.className = "save-note";
        note.setAttribute("role", "status");
        button.onclick = async () => {
          button.disabled = true;
          button.textContent = tr("Saving…", "저장 중…");
          try {
            const result = await save(definition);
            button.textContent = tr("Saved ✓", "저장됨 ✓");
            note.textContent = result.created
              ? tr(
                  "Saved to this device's wordbook.",
                  "이 기기의 단어장에 저장했습니다.",
                )
              : tr(
                  "This word is already in your wordbook.",
                  "이미 단어장에 있는 단어입니다.",
                );
          } catch (error) {
            button.disabled = false;
            button.textContent = tr("Retry save", "다시 저장");
            note.textContent =
              error instanceof Error
                ? error.message
                : tr("Could not save the word.", "저장하지 못했습니다.");
          }
          if (host?.isConnected && token === revision) position();
        };
        card.append(button, note);
      }
      position();
    };
  };
  const translate = (hit: Hit, text: string, request: Translate) => {
    const controller = new AbortController();
    const retry = document.createElement("button");
    retry.className = "retry";
    retry.hidden = true;
    retry.textContent = tr(
      "Retry on-device translation",
      "기기 내 번역 다시 시도",
    );
    retry.onclick = () => translate(hit, text, request);
    const update = show(hit, undefined, {
      title: tr("English → Korean", "영어 → 한국어"),
      translation: true,
      cancel: () => controller.abort(),
      footer: retry,
    });
    const display = (meaning: string, translated = false) =>
      update({
        word: text,
        meaning,
        language: translated ? "ko" : getLocale(),
        source: tr(
          "Chrome · On-device translation · Text stays on your device",
          "Chrome · 기기 내 번역 · 선택한 글은 외부로 보내지 않습니다",
        ),
      });
    display(
      tr(
        "Preparing translation… First use may download a language model.",
        "번역 준비 중… 처음에는 언어 모델을 내려받을 수 있습니다.",
      ),
    );
    void request(text, { signal: controller.signal, progress: display })
      .then((text) => display(text, true))
      .catch((error) => {
        if (controller.signal.aborted) return;
        update({
          word: text,
          language: getLocale(),
          meaning:
            error instanceof Error
              ? error.message
              : tr(
                  "Translation failed. Please retry.",
                  "번역하지 못했습니다. 다시 시도해 주세요.",
                ),
          source: tr(
            "Optional: the link below sends the selected text to Google Translate and opens a new tab.",
            "선택 사항: 아래 링크를 누르면 선택한 글을 Google 번역에 보내고 새 탭을 엽니다.",
          ),
          sourceLinks: [
            {
              label: tr(
                "Send to Google Translate ↗",
                "Google 번역으로 보내기 ↗",
              ),
              url: googleTranslationURL(text),
            },
          ],
        });
        retry.hidden = false;
      });
  };
  const outside = (e: PointerEvent) => {
    if (host && !e.composedPath().includes(host)) close();
  };
  const escape = (e: KeyboardEvent) => {
    if (e.key === "Escape") close();
  };
  window.addEventListener("pointerdown", outside, true);
  window.addEventListener("keydown", escape, true);
  const scroll = (event: Event) => {
    if (!host || !event.composedPath().includes(host)) close();
  };
  window.addEventListener("scroll", scroll, true);
  window.addEventListener("resize", close);
  window.addEventListener("blur", close);
  const unsubscribeLocale = subscribeLocale(close);
  return {
    close,
    show,
    offer,
    translate,
    dispose() {
      unsubscribeLocale();
      close();
      window.removeEventListener("pointerdown", outside, true);
      window.removeEventListener("keydown", escape, true);
      window.removeEventListener("scroll", scroll, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("blur", close);
    },
  };
}
