export type Token = {
  id: number;
  word: string;
  sentence: string;
  start: number;
  end: number;
};
export const SAMPLE = `There is a quiet kind of discovery that happens when we slow down. A familiar street reveals an unfamiliar doorway. A conversation offers an unexpected perspective. Even a few pages of a book can change the way we see the world.

Curiosity is not simply a desire for answers. It is a willingness to remain uncertain, to notice what others overlook, and to follow a question a little further. The connection between two ideas may seem tenuous at first, yet patient attention can reveal a remarkable pattern.

Reading gives us a place to practice this attention. We encounter unfamiliar words, consider subtle distinctions, and gradually build a more nuanced understanding. Each small discovery becomes part of a larger landscape of meaning.

Perhaps the most valuable habit is to keep exploring. We do not need to understand everything at once. Sometimes, all it takes is a moment of stillness, an open mind, and the courage to turn the next page.`;

export function tokenize(text: string): Token[] {
  const sentences = [...text.matchAll(/[^.!?\n]+(?:[.!?]+|(?=\n|$))/g)].map(
    (m) => ({
      start: m.index!,
      end: m.index! + m[0].length,
      text: m[0].trim(),
    }),
  );
  return [...text.matchAll(/[A-Za-z]+(?:['’\-][A-Za-z]+)*/g)].map((m, id) => ({
    id,
    word: m[0],
    start: m.index!,
    end: m.index! + m[0].length,
    sentence:
      sentences.find((s) => s.start <= m.index! && s.end > m.index!)?.text ??
      m[0],
  }));
}
