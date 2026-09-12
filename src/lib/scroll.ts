export const SCROLL_SETTLE_MS = 180;
import type { WordBox } from "./selection";
export function chooseBalancedTarget(
  boxes: WordBox[],
  visits: Map<string, number>,
  width: number,
  height: number,
  random = Math.random,
): WordBox | null {
  const cell = (b: WordBox) =>
    `${Math.min(2, Math.floor(((b.left + b.right) / 2 / width) * 3))}:${Math.min(2, Math.floor(((b.top + b.bottom) / 2 / height) * 3))}`;
  if (!boxes.length) return null;
  const least = Math.min(...boxes.map((b) => visits.get(cell(b)) ?? 0));
  const possible = boxes.filter((b) => (visits.get(cell(b)) ?? 0) === least);
  const target =
    possible[
      Math.min(possible.length - 1, Math.floor(random() * possible.length))
    ];
  visits.set(cell(target), (visits.get(cell(target)) ?? 0) + 1);
  return target;
}
export class ScrollGuard {
  lastAt: number | null = null;
  revision = 0;
  mark(now: number) {
    this.lastAt = now;
    this.revision++;
  }
  isSettling(now: number) {
    return this.lastAt !== null && now - this.lastAt < SCROLL_SETTLE_MS;
  }
  age(now: number) {
    return this.lastAt === null ? null : Math.max(0, now - this.lastAt);
  }
}
