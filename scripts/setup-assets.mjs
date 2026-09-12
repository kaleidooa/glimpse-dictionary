import { mkdir, cp, stat, writeFile, rename } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const root = new URL("../", import.meta.url);
await mkdir(new URL("public/mediapipe/", root), { recursive: true });
await cp(
  new URL("node_modules/@mediapipe/tasks-vision/wasm/", root),
  new URL("public/mediapipe/", root),
  { recursive: true },
);
const model = new URL("public/models/face_landmarker.task", root);
await mkdir(new URL("public/models/", root), { recursive: true });
try {
  const existing = await stat(model).catch(() => null);
  if (!existing || existing.size < 1000000) {
    console.log(
      "Downloading MediaPipe Face Landmarker (local browser inference)…",
    );
    const response = await fetch(
      "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
      { signal: AbortSignal.timeout(60000) },
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length < 1000000) throw new Error("Incomplete model download");
    await writeFile(new URL(`${model.href}.tmp`), bytes);
    await rename(new URL(`${model.href}.tmp`), model);
  }
  console.log(`MediaPipe assets ready: ${fileURLToPath(model)}`);
} catch (error) {
  console.warn(
    "Model download failed. Mouse mode still works. Retry with npm run assets.",
    error.message,
  );
}
