import { build } from "vite";
import react from "@vitejs/plugin-react";
import { renderPolicy } from "./render-policy.mjs";
import { mkdir, copyFile, readFile, writeFile, cp, rm } from "node:fs/promises";
import { resolve, dirname, basename } from "node:path";
const outDir = resolve("dist-extension");
if (dirname(outDir) !== resolve(".") || basename(outDir) !== "dist-extension")
  throw new Error("Refusing to clean an unexpected output directory");
await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });
await build({
  configFile: false,
  base: "./",
  plugins: [react()],
  build: {
    outDir: resolve(outDir, "lab"),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve("index.html"),
        dashboard: resolve("dashboard.html"),
      },
    },
  },
});
await build({
  configFile: false,
  publicDir: false,
  build: {
    outDir,
    emptyOutDir: false,
    lib: {
      entry: {
        background: resolve("extension/background.ts"),
        popup: resolve("extension/popup.ts"),
      },
      formats: ["es"],
      fileName: (_format, name) => `${name}.js`,
    },
  },
});
await build({
  configFile: false,
  publicDir: false,
  build: {
    outDir,
    emptyOutDir: false,
    lib: {
      entry: resolve("extension/content.ts"),
      name: "GlimpseContent",
      formats: ["iife"],
      fileName: () => "content.js",
    },
  },
});
for (const name of ["manifest.json", "popup.html", "popup.css"])
  await copyFile(`extension/${name}`, resolve(outDir, name));
await writeFile(resolve(outDir, "privacy.html"), await renderPolicy());
await cp("extension/icons", resolve(outDir, "icons"), { recursive: true });
const thirdParty = [];
for (const [name, path] of [
  ["React", "react/LICENSE"],
  ["React DOM", "react-dom/LICENSE"],
  ["scheduler", "scheduler/LICENSE"],
  ["Lucide", "lucide-react/LICENSE"],
]) {
  thirdParty.push(
    `${name}\n${"=".repeat(50)}\n${await readFile(resolve("node_modules", path), "utf8")}`,
  );
}
thirdParty.push(
  `MediaPipe Tasks Vision\n${"=".repeat(50)}\n${await readFile("extension/licenses/mediapipe.txt", "utf8")}`,
);
thirdParty.push(
  "Face Landmarker model source: https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task\nModel information: https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker",
);
for (const name of [
  "README.txt",
  "WORDNET-LICENSE.txt",
  "CC-BY-SA-4.0.txt",
  "MPL-2.0.txt",
])
  thirdParty.push(
    `Dictionary data — ${name}\n${"=".repeat(50)}\n${await readFile("public/dictionary/" + name, "utf8")}`,
  );
await writeFile(
  resolve(outDir, "THIRD-PARTY-NOTICES.txt"),
  thirdParty.join("\n\n"),
);
await copyFile("EXTENSION.md", resolve(outDir, "INSTALL.txt"));
await copyFile("EXTENSION-VALIDATION.md", resolve(outDir, "VALIDATION.txt"));
await copyFile(
  "DICTIONARY-DESIGN.md",
  resolve(outDir, "DICTIONARY-DESIGN.txt"),
);
await copyFile("LICENSE", resolve(outDir, "LICENSE.txt"));
await copyFile("PRIVACY.md", resolve(outDir, "PRIVACY.txt"));
await writeFile(
  resolve(outDir, "BUILD.txt"),
  `Glimpse ${JSON.parse(await readFile("package.json", "utf8")).version}\nBuilt ${new Date().toISOString()}\nLocal unpacked extension; not published to the Chrome Web Store.\n`,
);
console.log(
  `\nChrome → chrome://extensions → 개발자 모드 → 압축해제된 확장 프로그램 로드 → ${outDir}`,
);
