import { isPrivateElement, isTypingElement, type Hit } from "./word-at-point";
import { MAX_TRANSLATION_LENGTH } from "./translation";

export type SelectedText = { hit: Hit; text: string; word: string | null };
export function selectedText(): SelectedText | null {
  if (document.hidden || isTypingElement(document.activeElement)) return null;
  const selection = document.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount !== 1)
    return null;
  const range = selection.getRangeAt(0).cloneRange();
  const root = range.commonAncestorContainer;
  if (!root.isConnected) return null;
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) =>
        range.intersectsNode(node)
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT,
    },
  );
  let node: Node | null = root,
    visited = 0,
    length = 0;
  // Bound work to the selected region, including selections that cross editable fields.
  while (node) {
    if (++visited > 2000) return null;
    const element = node instanceof Element ? node : node.parentElement;
    if (isPrivateElement(element)) return null;
    if (node.nodeType === Node.TEXT_NODE) {
      const start = node === range.startContainer ? range.startOffset : 0;
      const end =
        node === range.endContainer
          ? range.endOffset
          : (node.textContent?.length ?? 0);
      length += end - start;
      if (length > MAX_TRANSLATION_LENGTH) return null;
    }
    node = walker.nextNode();
  }
  const raw = range.toString();
  const text = selection.toString().trim().replace(/\s+/g, " ");
  if (!text || text.length > MAX_TRANSLATION_LENGTH || !/[a-z]/i.test(text))
    return null;
  const rects = Array.from(range.getClientRects()).filter(
    (rect) => rect.width > 0 && rect.height > 0,
  );
  if (!rects.length || rects.length > 128) return null;
  const visible = rects.filter(
    (rect) =>
      rect.bottom > 0 &&
      rect.top < innerHeight &&
      rect.right > 0 &&
      rect.left < innerWidth,
  );
  if (!visible.length) return null;
  const backwards =
    selection.focusNode === range.startContainer &&
    selection.focusOffset === range.startOffset;
  const rect = backwards ? visible[0] : visible[visible.length - 1];
  const candidate = text.replace(/^[\s“”"'‘’([{]+|[\s“”"'‘’).,!?;:\]}]+$/g, "");
  const word =
    candidate.length <= 80 && /^[A-Za-z]+(?:['’\-][A-Za-z]+)*$/.test(candidate)
      ? candidate
      : null;
  return { hit: { word: raw, range, rect, rects }, text, word };
}

export function sameSelection(a: Hit | null, b: Hit): boolean {
  return (
    !!a &&
    a.word === b.word &&
    a.range.startContainer === b.range.startContainer &&
    a.range.endContainer === b.range.endContainer &&
    a.range.startOffset === b.range.startOffset &&
    a.range.endOffset === b.range.endOffset
  );
}
