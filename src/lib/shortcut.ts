import manifest from "../../extension/manifest.json";
import { t } from "./i18n";

export const DEFAULT_SHORTCUT =
  manifest.commands["lookup-word"].suggested_key.default;
export const SHORTCUTS_URL = "chrome://extensions/shortcuts";

export async function readShortcut(): Promise<string> {
  if (location.protocol !== "chrome-extension:") return DEFAULT_SHORTCUT;
  const commands = await chrome.commands.getAll();
  return (
    commands.find((command) => command.name === "lookup-word")?.shortcut ?? ""
  );
}

export function shortcutLabel(shortcut: string | null): string {
  if (shortcut === null) return t("Check in Chrome", "Chrome에서 확인");
  return shortcut
    ? shortcut.split("+").join(" + ")
    : t("Not assigned", "미설정");
}
