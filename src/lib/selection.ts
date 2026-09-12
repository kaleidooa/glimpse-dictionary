import type { Token } from "./text";
export type Point = { x: number; y: number };
export type GazeSample = Point & { timestamp: number; confidence: number };
export type WordBox = Token & {
  left: number;
  right: number;
  top: number;
  bottom: number;
  line: number;
};
export type Candidate = {
  id: number;
  word: string;
  distance: number;
  score: number;
  line: number;
};
export const median = (values: number[]) => {
  if (!values.length) return 0;
  const v = [...values].sort((a, b) => a - b),
    middle = Math.floor(v.length / 2);
  return v.length % 2 ? v[middle] : (v[middle - 1] + v[middle]) / 2;
};
export type Fixation = Point & {
  confidence: number;
  sampleCount: number;
  usedCount: number;
  spread: number;
  duration: number;
};
export function fixationFrom(
  samples: GazeSample[],
  now: number,
  windowMs = 400,
): Fixation | null {
  const recent = samples
    .filter(
      (s) =>
        s.timestamp <= now &&
        s.timestamp >= now - windowMs &&
        s.confidence >= 0.3 &&
        Number.isFinite(s.x) &&
        Number.isFinite(s.y),
    )
    .sort((a, b) => a.timestamp - b.timestamp);
  if (
    recent.length < 4 ||
    now - recent[recent.length - 1].timestamp > 150 ||
    recent[recent.length - 1].timestamp - recent[0].timestamp < 100
  )
    return null;
  const mx = median(recent.map((s) => s.x)),
    my = median(recent.map((s) => s.y));
  const distances = recent.map((s) => Math.hypot(s.x - mx, s.y - my)),
    md = median(distances);
  const mad = median(distances.map((d) => Math.abs(d - md)));
  const threshold = Math.max(20, md + 3 * 1.4826 * mad);
  const retained = recent.filter((_, i) => distances[i] <= threshold);
  if (retained.length < 4) return null;
  let total = 0,
    x = 0,
    y = 0,
    quality = 0;
  for (const s of retained) {
    const weight = s.confidence * Math.exp(-(now - s.timestamp) / 200);
    total += weight;
    x += s.x * weight;
    y += s.y * weight;
    quality += s.confidence * weight;
  }
  x /= total;
  y /= total;
  const spread = Math.sqrt(
    retained.reduce((s, p) => s + (p.x - x) ** 2 + (p.y - y) ** 2, 0) /
      retained.length,
  );
  return {
    x,
    y,
    confidence: Math.max(
      0,
      Math.min(1, (quality / total) * Math.exp(-spread / 100)),
    ),
    sampleCount: recent.length,
    usedCount: retained.length,
    spread,
    duration: recent[recent.length - 1].timestamp - recent[0].timestamp,
  };
}
export function candidatesAt(
  point: Point,
  boxes: WordBox[],
  maxDistance = 90,
): Candidate[] {
  return boxes
    .map((box) => {
      const dx = Math.max(box.left - point.x, 0, point.x - box.right);
      const dy = Math.max(box.top - point.y, 0, point.y - box.bottom);
      const distance = Math.hypot(dx, dy);
      const cost = Math.hypot(dx, dy * 1.8);
      return {
        id: box.id,
        word: box.word,
        line: box.line,
        distance,
        cost,
        centerDistance: Math.hypot(
          point.x - (box.left + box.right) / 2,
          point.y - (box.top + box.bottom) / 2,
        ),
        score: Math.exp(-cost / 45),
      };
    })
    .filter((c) => c.distance <= maxDistance)
    .sort((a, b) => a.cost - b.cost || a.centerDistance - b.centerDistance)
    .slice(0, 3)
    .map(({ cost: _cost, centerDistance: _center, ...c }) => c);
}
export function measureWords(root: HTMLElement, tokens: Token[]): WordBox[] {
  const boxes: WordBox[] = [];
  let line = -1,
    previousTop = -100;
  root.querySelectorAll<HTMLElement>("[data-token-id]").forEach((el) => {
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    if (Math.abs(rect.top - previousTop) > 5) {
      line++;
      previousTop = rect.top;
    }
    if (
      rect.bottom < 0 ||
      rect.top > window.innerHeight ||
      rect.right < 0 ||
      rect.left > window.innerWidth
    )
      return;
    const token = tokens[Number(el.dataset.tokenId)];
    if (token)
      boxes.push({
        ...token,
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        line,
      });
  });
  return boxes;
}
