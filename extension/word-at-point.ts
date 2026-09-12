export type Hit = {
  word: string;
  rect: DOMRect;
  rects: DOMRect[];
  range: Range;
};
const ignored =
  'input,textarea,select,button,[contenteditable]:not([contenteditable="false"]),[role="textbox"],script,style,noscript,svg,canvas,iframe,object,embed,[data-glimpse-ui]';
const wordPattern = /[A-Za-z]+(?:['’\-][A-Za-z]+)*/g;

function parent(element: Element): Element | null {
  return (
    element.parentElement ??
    (element.getRootNode() instanceof ShadowRoot
      ? (element.getRootNode() as ShadowRoot).host
      : null)
  );
}
export function isPrivateElement(element: Element | null): boolean {
  for (let e = element; e; e = parent(e)) {
    if (e.matches(ignored) || (e instanceof HTMLElement && e.isContentEditable))
      return true;
  }
  return false;
}
export function isTypingElement(element: Element | null): boolean {
  while (element?.shadowRoot?.activeElement)
    element = element.shadowRoot.activeElement;
  for (let e = element; e; e = parent(e)) {
    if (
      e.matches(
        'input,textarea,select,[role="textbox"],[contenteditable]:not([contenteditable="false"])',
      ) ||
      (e instanceof HTMLElement && e.isContentEditable)
    )
      return true;
  }
  return false;
}
function inline(element: Element) {
  const display = getComputedStyle(element).display;
  return display === "inline" || display === "contents";
}
/** Bounded, transient text window. No DOM wrapping, selection changes or page-wide scan. */
export function textWindow(node: Text) {
  let root: Node = node;
  while (
    root.parentElement &&
    inline(root.parentElement) &&
    !isPrivateElement(root.parentElement)
  )
    root = root.parentElement;
  if (root.parentElement && !isPrivateElement(root.parentElement))
    root = root.parentElement;
  const parts: { node: Text; start: number; end: number }[] = [];
  let text = "",
    visited = 0;
  const visit = (current: Node) => {
    if (++visited > 2000 || text.length > 32000) return;
    if (current.nodeType === Node.TEXT_NODE) {
      const value = current.textContent ?? "";
      if (value.length > 32000) {
        text += "\n";
        return;
      }
      parts.push({
        node: current as Text,
        start: text.length,
        end: text.length + value.length,
      });
      text += value;
    } else if (current instanceof Element) {
      const style = getComputedStyle(current);
      if (
        isPrivateElement(current) ||
        style.display === "none" ||
        style.visibility === "hidden"
      ) {
        text += "\n";
        return;
      }
      const boundary = current.tagName === "BR" || !inline(current);
      if (boundary) text += "\n";
      for (const child of current.childNodes) visit(child);
      if (boundary) text += "\n";
    }
  };
  visit(root);
  return { text, parts };
}
export function wordAtCaret(
  node: Text,
  offset: number,
  x: number,
  y: number,
): Hit | null {
  if (!node.isConnected || isPrivateElement(node.parentElement)) return null;
  const { text, parts } = textWindow(node);
  const part = parts.find((p) => p.node === node);
  if (!part) return null;
  const caret = part.start + offset;
  // A caret lies on either side of a glyph. Test both adjacent candidates by their actual rectangles.
  for (const match of text.matchAll(wordPattern)) {
    const start = match.index,
      end = start + match[0].length;
    if (caret < start || caret > end || match[0].length > 80) continue;
    const first = parts.find((p) => p.start <= start && p.end > start);
    const last = parts.find((p) => p.start < end && p.end >= end);
    if (!first || !last) continue;
    const range = document.createRange();
    range.setStart(first.node, start - first.start);
    range.setEnd(last.node, end - last.start);
    const rects = Array.from(range.getClientRects()).filter(
      (r) => r.width > 0 && r.height > 0,
    );
    const rect = rects.find(
      (r) =>
        r.width > 0 &&
        r.height > 0 &&
        x >= r.left &&
        x <= r.right &&
        y >= r.top &&
        y <= r.bottom,
    );
    if (rect) {
      // Inline element and text boxes can overlap; do not stack the highlight tint.
      const fragments = rects.filter(
        (r, i) =>
          !rects.some(
            (other, j) =>
              j !== i &&
              other.left <= r.left &&
              other.right >= r.right &&
              other.top <= r.top &&
              other.bottom >= r.bottom &&
              (j < i || other.width > r.width || other.height > r.height),
          ),
      );
      return { word: match[0], rect, rects: fragments, range };
    }
  }
  return null;
}
export function wordAtPoint(x: number, y: number): Hit | null {
  let element = document.elementFromPoint(x, y);
  const roots: ShadowRoot[] = [];
  while (element?.shadowRoot) {
    const shadow = element.shadowRoot;
    roots.push(shadow);
    const child = shadow.elementFromPoint(x, y);
    if (!child || child === element) break;
    element = child;
  }
  if (!element || isPrivateElement(element)) return null;
  const doc = document as Document & {
    caretPositionFromPoint?: (
      x: number,
      y: number,
      options?: { shadowRoots: ShadowRoot[] },
    ) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  const pos = doc.caretPositionFromPoint?.(x, y, { shadowRoots: roots });
  const range = !pos ? doc.caretRangeFromPoint?.(x, y) : null;
  const node = pos?.offsetNode ?? range?.startContainer;
  const offset = pos?.offset ?? range?.startOffset ?? 0;
  if (node?.nodeType !== Node.TEXT_NODE) return null;
  return wordAtCaret(node as Text, offset, x, y);
}
