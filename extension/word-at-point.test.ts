// @vitest-environment jsdom
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import {
  isPrivateElement,
  isTypingElement,
  textWindow,
  wordAtCaret,
  wordAtPoint,
} from "./word-at-point";
const rect = {
  left: 40,
  right: 180,
  top: 30,
  bottom: 50,
  width: 140,
  height: 20,
};
beforeEach(() => {
  document.body.innerHTML = "";
  Object.defineProperty(Range.prototype, "getClientRects", {
    configurable: true,
    value: vi.fn(() => [rect]),
  });
});
afterEach(() => vi.restoreAllMocks());
it("finds a word split across formatting tags without changing DOM or selection", () => {
  document.body.innerHTML = "<p>A te<b>nu</b>ous connection.</p>";
  const p = document.querySelector("p")!;
  const node = p.querySelector("b")!.firstChild as Text;
  const before = p.innerHTML;
  expect(wordAtCaret(node, 1, 70, 40)?.word).toBe("tenuous");
  expect(p.innerHTML).toBe(before);
  expect(getSelection()?.toString()).toBe("");
});
it("handles apostrophes and hyphens and does not merge block boundaries", () => {
  document.body.innerHTML =
    "<div><p>don<span>’</span>t well-known</p><p>another</p></div>";
  const span = document.querySelector("span")!;
  expect(wordAtCaret(span.firstChild as Text, 0, 70, 40)?.word).toBe("don’t");
  const last = document.querySelector("p")!.lastChild as Text;
  expect(wordAtCaret(last, 6, 70, 40)?.word).toBe("well-known");
  expect(textWindow(last).text).not.toContain("knownanother");
});
it("rejects whitespace, adjacent lines and points outside actual word fragments", () => {
  document.body.innerHTML = "<p>tenuous   claim</p>";
  const text = document.querySelector("p")!.firstChild as Text;
  expect(wordAtCaret(text, 3, 70, 40)?.word).toBe("tenuous");
  for (const [x, y] of [
    [181, 40],
    [70, 29],
    [39, 50],
    [70, 51],
  ])
    expect(wordAtCaret(text, 3, x, y)).toBeNull();
  expect(wordAtCaret(text, 8, 70, 40)).toBeNull();
});
it("rejects form fields and inherited contenteditable, even inside an open shadow tree", () => {
  for (const html of [
    '<input value="secret">',
    "<textarea>secret</textarea>",
    '<div contenteditable=""><span>secret</span></div>',
    '<div contenteditable="plaintext-only"><b>secret</b></div>',
    '<div role="textbox"><span>secret</span></div>',
  ]) {
    document.body.innerHTML = html;
    expect(
      isPrivateElement(
        document.body.firstElementChild!.lastElementChild ??
          document.body.firstElementChild,
      ),
    ).toBe(true);
  }
  document.body.innerHTML = '<div contenteditable="true"><aside></aside></div>';
  const shadow = document
    .querySelector("aside")!
    .attachShadow({ mode: "open" });
  shadow.innerHTML = "<span>secret</span>";
  expect(isPrivateElement(shadow.querySelector("span"))).toBe(true);
});
it("resolves the current geometry after scrolling and fresh DOM after updates", () => {
  document.body.innerHTML = "<p>curiosity</p>";
  const p = document.querySelector("p")!;
  Object.defineProperty(document, "elementFromPoint", {
    configurable: true,
    value: () => p,
  });
  Object.defineProperty(document, "caretPositionFromPoint", {
    configurable: true,
    value: () => ({ offsetNode: p.firstChild!, offset: 2 }),
  });
  expect(wordAtPoint(70, 40)?.word).toBe("curiosity");
  p.textContent = "discovery";
  expect(wordAtPoint(70, 40)?.word).toBe("discovery");
  Object.defineProperty(Range.prototype, "getClientRects", {
    configurable: true,
    value: () => [{ ...rect, top: 330, bottom: 350 }],
  });
  expect(wordAtPoint(70, 40)).toBeNull();
  expect(wordAtPoint(70, 340)?.word).toBe("discovery");
});
it("validates word extraction over 240 inline split and casing combinations", () => {
  const words = [
    "perspective",
    "curiosity",
    "well-known",
    "don’t",
    "Unfamiliar",
    "understanding",
  ];
  for (let i = 0; i < 240; i++) {
    const word = words[i % words.length],
      at = 1 + (i % (word.length - 1));
    document.body.innerHTML = `<p>Before ${word.slice(0, at)}<em>${word.slice(at)}</em> after.</p>`;
    const node = document.querySelector("em")!.firstChild as Text;
    expect(wordAtCaret(node, Math.min(1, node.length), 70, 40)?.word).toBe(
      word,
    );
  }
});
it("limits oversized traversal and excludes hidden content from words", () => {
  document.body.innerHTML = "<p>te<span hidden>SECRET</span>nuous</p>";
  const text = document.querySelector("p")!.firstChild as Text;
  expect(textWindow(text).text).not.toContain("SECRET");
  document.body.innerHTML = `<p>${"<span>word </span>".repeat(2200)}</p>`;
  expect(
    textWindow(document.querySelector("span")!.firstChild as Text).parts.length,
  ).toBeLessThan(2000);
});
it("distinguishes focused shadow inputs from buttons without traversing in circles", () => {
  const host = document.createElement("div");
  document.body.append(host);
  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = "<input><button>Go</button>";
  shadow.querySelector("button")!.focus();
  expect(isTypingElement(document.activeElement)).toBe(false);
  shadow.querySelector("input")!.focus();
  expect(isTypingElement(document.activeElement)).toBe(true);
});
