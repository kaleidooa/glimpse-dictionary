import { t as tr } from "../src/lib/i18n";
import { isTypingElement, wordAtPoint } from "./word-at-point";
import { createOverlay } from "./overlay";
import type { Definition } from "../src/lib/definitions";
export function installReader(
  lookup: (word: string) => Promise<Definition>,
  save?: (definition: Definition) => Promise<{ created: boolean }>,
) {
  const overlay = createOverlay(save);
  let point: { x: number; y: number } | null = null,
    scrollTime = -Infinity;
  const move = (event: PointerEvent) => {
    if (event.pointerType !== "touch")
      point = { x: event.clientX, y: event.clientY };
  };
  const leave = (event: PointerEvent) => {
    if (!event.relatedTarget) point = null;
  };
  const scroll = () => {
    scrollTime = performance.now();
  };
  const blur = () => {
    point = null;
    overlay.close();
  };
  window.addEventListener("pointermove", move, {
    passive: true,
    capture: true,
  });
  window.addEventListener("pointerout", leave, true);
  window.addEventListener("scroll", scroll, { passive: true, capture: true });
  window.addEventListener("blur", blur);
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
    const update = overlay.show(hit);
    try {
      update(await lookup(hit.word));
    } catch {
      update({
        word: hit.word,
        meaning: tr(
          "If you reloaded the extension, refresh this webpage.",
          "확장을 새로 불러왔다면 이 페이지를 새로고침해 주세요.",
        ),
        language: "ko",
        source: tr("Check connection", "연결 확인 필요"),
      });
    }
  };
  return {
    trigger,
    ready,
    dispose() {
      overlay.dispose();
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("pointerout", leave, true);
      window.removeEventListener("scroll", scroll, true);
      window.removeEventListener("blur", blur);
    },
  };
}
