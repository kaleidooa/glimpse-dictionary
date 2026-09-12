import { execFileSync } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean);
if (!files.length) throw new Error("No staged/tracked public files to check");
const rejected = [];
for (const file of files) {
  if (
    /^(\.qa|node_modules|dist|dist-extension|release|\.openai)\//.test(file) ||
    /(^|\/)\.env(?!\.example$)/.test(file) ||
    /\.(pem|p12|key|log)$/.test(file)
  ) {
    rejected.push(file + ": private/generated path");
    continue;
  }
  if (
    (await stat(file)).size > 2_000_000 ||
    /\.(png|jpg|jpeg|wasm|task|zip)$/.test(file)
  )
    continue;
  const text = await readFile(file, "utf8");
  if (
    /sk-[A-Za-z0-9_-]{24,}|gh[pousr]_[A-Za-z0-9]{30,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(
      text,
    )
  )
    rejected.push(file + ": possible credential");
}
if (rejected.length)
  throw new Error(
    "Public source audit failed (values omitted):\n" + rejected.join("\n"),
  );
console.log(
  `Public source audit: ${files.length} tracked files; no excluded paths or recognized credential patterns. This does not replace manual review.`,
);
