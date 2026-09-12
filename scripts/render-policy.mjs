import { readFile, writeFile } from "node:fs/promises";
import { resolve, posix } from "node:path";
import { fileURLToPath } from "node:url";
export async function renderPolicy(locale = "en") {
  const policyPath = locale === "ko" ? "docs/ko/PRIVACY.md" : "PRIVACY.md";
  const source = await readFile(policyPath, "utf8");
  const escape = (text) =>
    text
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  const inline = (text) =>
    escape(text)
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_all, label, target) => {
        const resolved = posix.normalize(
          posix.join(posix.dirname(policyPath), target),
        );
        const url = /^https:\/\//.test(target)
          ? target
          : resolved === "PRIVACY.md"
            ? "privacy.html"
            : resolved === "docs/ko/PRIVACY.md"
              ? "privacy.ko.html"
              : "https://github.com/kaleidooa/glimpse-dictionary/blob/main/" +
                resolved;
        return `<a href="${url}"${url.startsWith("https:") ? ' target="_blank" rel="noreferrer noopener"' : ""}>${label}</a>`;
      })
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+)`/g, "<code>$1</code>");
  const html = source
    .trim()
    .split(/\r?\n\r?\n/)
    .map((block) => {
      const heading = /^(#{1,3}) (.*)$/.exec(block);
      return heading
        ? `<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`
        : `<p>${inline(block.replace(/\r?\n/g, " "))}</p>`;
    })
    .join("\n");
  const back = locale === "ko" ? "설정으로 돌아가기" : "Back to settings",
    title = locale === "ko" ? "Glimpse 개인정보 안내" : "Glimpse privacy";
  return `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>body{font:16px/1.9 system-ui,sans-serif;max-width:800px;margin:48px auto;padding:0 24px;background:#f9faf5;color:#294132}h1{font-size:30px}h2{font-size:21px;margin-top:36px}a{color:#385e30;text-underline-offset:4px}code{overflow-wrap:anywhere;font-size:14px}header{border-bottom:1px solid #d5dfcc;padding-bottom:20px}a:focus-visible{outline:3px solid #71934e;outline-offset:3px}</style></head><body><header><a href="lab/dashboard.html#settings">glimpse. · ${back}</a></header><main>${html}</main></body></html>\n`;
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  for (const locale of ["en", "ko"])
    await writeFile(
      "extension/privacy" + (locale === "ko" ? ".ko" : "") + ".html",
      await renderPolicy(locale),
    );
