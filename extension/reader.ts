import { t as tr } from "../src/lib/i18n";
import { isTypingElement, wordAtPoint } from "./word-at-point";
import { createOverlay } from "./overlay";
import type { Definition } from "../src/lib/definitions";
import { selectedText, sameSelection, type SelectedText } from "./selection";
import { translateText, type Translate } from "./translation";
import { subscribeLocale } from "../src/lib/i18n";
export function installReader(
  lookup: (word: string) => Promise<Definition>,
  save?: (definition: Definition) => Promise<{ created: boolean }>,
  translate: Translate = translateText,
) {
  const overlay = createOverlay(save);
  let point: { x: number; y: number } | null = null,
    scrollTime = -Infinity;
  let selection: SelectedText | null = null,
    dragging = false,
    selectingUI = false;
  let selectionTimer: ReturnType<typeof setTimeout> | undefined;
  const ownUI = (event: Event) =>
    event
      .composedPath()
      .some(
        (node) =>
          node instanceof Element && node.hasAttribute("data-glimpse-ui"),
      );
  const clearSelection = () => {
    clearTimeout(selectionTimer);
    selection = null;
    selectingUI = false;
    overlay.close();
  };
  const move = (event: PointerEvent) => {
    if (event.pointerType !== "touch")
      point = { x: event.clientX, y: event.clientY };
  };
  const leave = (event: PointerEvent) => {
    if (!event.relatedTarget) point = null;
  };
  const scroll = (event: Event) => {
    if (ownUI(event)) return;
    scrollTime = performance.now();
    clearSelection();
  };
  const blur = () => {
    dragging = false;
    selectingUI = false;
    point = null;
    clearSelection();
  };
  window.addEventListener("pointermove", move, {
    passive: true,
    capture: true,
  });
  window.addEventListener("pointerout", leave, true);
  window.addEventListener("scroll", scroll, { passive: true, capture: true });
  window.addEventListener("blur", blur);
  const lookupHit = async (hit: SelectedText["hit"], word: string) => {
    const update = overlay.show(hit, undefined, { title: word });
    try {
      update(await lookup(word));
    } catch {
      update({
        word,
        meaning: tr(
          "If you reloaded the extension, refresh this webpage.",
          "확장을 새로 불러왔다면 이 페이지를 새로고침해 주세요.",
        ),
        language: "ko",
        source: tr("Check connection", "연결 확인 필요"),
      });
    }
  };
  const refreshSelection = () => {
    if (dragging || performance.now() - scrollTime < 180) return;
    const next = selectedText();
    if (!next) {
      if (selection) clearSelection();
      return;
    }
    if (sameSelection(selection?.hit ?? null, next.hit)) return;
    selection = next;
    overlay.offer(next.hit, !!next.word, () => {
      const current = selectedText();
      if (!current || !sameSelection(next.hit, current.hit)) {
        clearSelection();
        return;
      }
      if (current.word) void lookupHit(current.hit, current.word);
      else overlay.translate(current.hit, current.text, translate);
    });
  };
  const scheduleSelection = () => {
    clearTimeout(selectionTimer);
    if (!dragging && !selectingUI)
      selectionTimer = setTimeout(
        refreshSelection,
        Math.max(90, 185 - (performance.now() - scrollTime)),
      );
  };
  const down = (event: PointerEvent) => {
    selectingUI = ownUI(event);
    if (selectingUI) {
      clearTimeout(selectionTimer);
      return;
    }
    dragging = true;
    clearSelection();
  };
  const up = (event: PointerEvent) => {
    dragging = false;
    if (!ownUI(event)) scheduleSelection();
  };
  const escape = (event: KeyboardEvent) => {
    if (!ownUI(event)) selectingUI = false;
    if (event.key === "Escape") clearSelection();
  };
  const cancelDrag = () => {
    dragging = false;
    selectingUI = false;
    clearSelection();
  };
  window.addEventListener("pointerdown", down, true);
  window.addEventListener("pointerup", up, true);
  window.addEventListener("pointercancel", cancelDrag, true);
  window.addEventListener("keydown", escape, true);
  window.addEventListener("resize", clearSelection);
  document.addEventListener("selectionchange", scheduleSelection);
  const stopLocale = subscribeLocale(clearSelection);
  const ready = () =>
    overlay.show(
      null,
      tr(
        "Ready. Move the pointer to a word and press the shortcut.",
        "사용 준비가 되었습니다. 단어 위로 커서를 옮긴 뒤 단축키를 누르세요.",
      ),
    );
  const trigger = async () => {
    if (document.hidden || !point) return;
    if (
      isTypingElement(document.activeElement) ||
      performance.now() - scrollTime < 180
    ) {
      overlay.close();
      return;
    }
    const hit = wordAtPoint(point.x, point.y);
    if (!hit) {
      overlay.close();
      return;
    }
    clearTimeout(selectionTimer);
    selection = null;
    await lookupHit(hit, hit.word);
  };
  return {
    trigger,
    ready,
    dispose() {
      clearSelection();
      stopLocale();
      overlay.dispose();
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("pointerout", leave, true);
      window.removeEventListener("scroll", scroll, true);
      window.removeEventListener("blur", blur);
      window.removeEventListener("pointerdown", down, true);
      window.removeEventListener("pointerup", up, true);
      window.removeEventListener("pointercancel", cancelDrag, true);
      window.removeEventListener("keydown", escape, true);
      window.removeEventListener("resize", clearSelection);
      document.removeEventListener("selectionchange", scheduleSelection);
    },
  };
}
