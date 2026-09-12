import { describe, expect, it } from "vitest";
import { candidatesAt, fixationFrom, type WordBox } from "./selection";
import { tokenize } from "./text";
const boxes: WordBox[] = [
  {
    id: 0,
    word: "a",
    sentence: "a tenuous claim.",
    start: 0,
    end: 1,
    left: 0,
    right: 10,
    top: 10,
    bottom: 30,
    line: 0,
  },
  {
    id: 1,
    word: "tenuous",
    sentence: "a tenuous claim.",
    start: 2,
    end: 9,
    left: 20,
    right: 100,
    top: 10,
    bottom: 30,
    line: 0,
  },
  {
    id: 2,
    word: "claim",
    sentence: "a tenuous claim.",
    start: 10,
    end: 15,
    left: 110,
    right: 160,
    top: 10,
    bottom: 30,
    line: 0,
  },
];
describe("word geometry", () => {
  it("keeps context for paragraphs without terminal punctuation", () => {
    const words = tokenize("A tenuous connection\nA new perspective");
    expect(words[1].sentence).toBe("A tenuous connection");
    expect(words[4].sentence).toBe("A new perspective");
  });
  it("selects the containing box and ranks three candidates", () => {
    const result = candidatesAt({ x: 70, y: 20 }, boxes);
    expect(result[0].word).toBe("tenuous");
    expect(result).toHaveLength(3);
  });
  it("rejects points too far from the text", () =>
    expect(candidatesAt({ x: 70, y: 400 }, boxes)).toEqual([]));
  it("uses distinct IDs for repeated words and preserves punctuation outside tokens", () => {
    const input = "It's a well-known word. A word, again!";
    const words = tokenize(input);
    expect(words.map((w) => w.word)).toEqual([
      "It's",
      "a",
      "well-known",
      "word",
      "A",
      "word",
      "again",
    ]);
    expect(words[5].sentence).toBe("A word, again!");
    expect(input.slice(words[2].start, words[2].end)).toBe("well-known");
    expect(words[3].id).not.toBe(words[5].id);
  });
});
describe("pre-trigger fixation", () => {
  it("rejects outliers and ignores both future and stale samples", () => {
    const samples = Array.from({ length: 8 }, (_, i) => ({
      x: 60 + (i % 2),
      y: 20,
      timestamp: 650 + i * 40,
      confidence: 1,
    }));
    samples.push(
      { x: 2000, y: 1000, timestamp: 980, confidence: 1 },
      { x: 0, y: 0, timestamp: 1100, confidence: 1 },
      { x: 0, y: 0, timestamp: 200, confidence: 1 },
    );
    const fixation = fixationFrom(samples, 1000)!;
    expect(fixation.x).toBeGreaterThan(60);
    expect(fixation.x).toBeLessThan(61);
    expect(fixation.usedCount).toBe(8);
    expect(fixation.sampleCount).toBe(9);
  });
  it("does not select from a single frame or after losing the face", () => {
    expect(
      fixationFrom([{ x: 0, y: 0, timestamp: 990, confidence: 1 }], 1000),
    ).toBeNull();
    expect(
      fixationFrom(
        Array.from({ length: 5 }, (_, i) => ({
          x: 0,
          y: 0,
          timestamp: 600 + i * 40,
          confidence: 1,
        })),
        1000,
      ),
    ).toBeNull();
  });
});
