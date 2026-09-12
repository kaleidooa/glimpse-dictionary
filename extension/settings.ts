export const WEB_ORIGINS = ["http://*/*", "https://*/*"];
export type Settings = {
  online: boolean;
  allSites: boolean;
  siteOrigins: string[];
};
export async function getSettings(): Promise<Settings> {
  const data = await chrome.storage.local.get([
    "online",
    "allSites",
    "siteOrigins",
  ]);
  return {
    online: data.online === true,
    allSites: data.allSites !== false,
    siteOrigins: Array.isArray(data.siteOrigins)
      ? data.siteOrigins.filter(
          (v: unknown): v is string =>
            typeof v === "string" && /^https?:\/\/[^/]+\/\*$/.test(v),
        )
      : [],
  };
}
export function sitePattern(url?: string): string | null {
  try {
    const parsed = new URL(url ?? "");
    if (
      !["http:", "https:"].includes(parsed.protocol) ||
      ["chromewebstore.google.com", "chrome.google.com"].includes(
        parsed.hostname,
      )
    )
      return null;
    // Match patterns do not support ports; a site grant covers this host's ports.
    return `${parsed.protocol}//${parsed.hostname}/*`;
  } catch {
    return null;
  }
}
