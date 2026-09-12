export type Landmark = { x: number; y: number; z: number };
export type EyeFeatures = {
  values: number[];
  quality: number;
  raw: { x: number; y: number };
  irises: Landmark[];
};
export function extractFeatures(
  points: Landmark[],
  blink = 0,
): EyeFeatures | null {
  if (points.length < 478 || blink > 0.55) return null;
  const eye = (
    a: number,
    b: number,
    top: number,
    bottom: number,
    iris: number,
  ) => {
    const p = points[a],
      q = points[b],
      i = points[iris];
    const dx = q.x - p.x,
      dy = q.y - p.y,
      width = Math.hypot(dx, dy);
    if (width < 0.012) return null;
    const openness =
      Math.hypot(
        points[top].x - points[bottom].x,
        points[top].y - points[bottom].y,
      ) / width;
    const cx = (p.x + q.x) / 2,
      cy = (p.y + q.y) / 2;
    return {
      h: ((i.x - cx) * dx + (i.y - cy) * dy) / (width * width),
      v: (-(i.x - cx) * dy + (i.y - cy) * dx) / (width * width),
      openness,
    };
  };
  const left = eye(33, 133, 159, 145, 468),
    right = eye(362, 263, 386, 374, 473);
  if (!left || !right || Math.min(left.openness, right.openness) < 0.09)
    return null;
  const l = points[33],
    r = points[263],
    nose = points[1],
    forehead = points[10],
    chin = points[152];
  const scale = Math.hypot(r.x - l.x, r.y - l.y);
  const faceX = (l.x + r.x) / 2,
    faceY = (l.y + r.y) / 2;
  // Geometric pose proxies: no assertion of calibrated physical angles.
  const yaw = (nose.x - faceX) / scale,
    pitch = (nose.y - faceY) / Math.max(0.01, chin.y - forehead.y),
    roll = Math.atan2(r.y - l.y, r.x - l.x);
  const values = [
    left.h,
    left.v,
    right.h,
    right.v,
    faceX,
    faceY,
    scale,
    yaw,
    pitch,
    roll,
  ];
  if (!values.every(Number.isFinite)) return null;
  return {
    values,
    quality:
      Math.min(1, Math.min(left.openness, right.openness) / 0.22) * (1 - blink),
    raw: { x: 0.5 - (left.h + right.h) * 1.6, y: 0.5 + (left.v + right.v) * 2 },
    irises: [points[468], points[473]],
  };
}
