import { useEffect, useState } from "react";
import { DEFAULT_SHORTCUT, readShortcut } from "../lib/shortcut";

export function useShortcut() {
  const [shortcut, setShortcut] = useState<string | null>(
    location.protocol === "chrome-extension:" ? null : DEFAULT_SHORTCUT,
  );
  useEffect(() => {
    let active = true,
      revision = 0;
    const refresh = async () => {
      const current = ++revision;
      let value: string | null = null;
      try {
        value = await readShortcut();
      } catch {
        /* The extension may have been reloaded. */
      }
      if (active && current === revision) setShortcut(value);
    };
    const visible = () => {
      if (!document.hidden) void refresh();
    };
    void refresh();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", visible);
    return () => {
      active = false;
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", visible);
    };
  }, []);
  return shortcut;
}
