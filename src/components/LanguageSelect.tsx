import { useState, useSyncExternalStore } from "react";
import { getLocale, subscribeLocale, t, type Locale } from "../lib/i18n";
import { setLocale } from "../lib/locale-client";
import "./language.css";
export const useLocale = () =>
  useSyncExternalStore(subscribeLocale, getLocale, getLocale);
export function LanguageSelect() {
  const locale = useLocale();
  const [error, setError] = useState("");
  return (
    <label className="language-select">
      <span>{t("Language", "언어")}</span>
      <select
        aria-label={t("Language", "언어")}
        value={locale}
        onChange={async (event) => {
          setError("");
          try {
            await setLocale(event.target.value as Locale);
          } catch {
            setError(
              t(
                "Could not save language. Try again.",
                "언어를 저장하지 못했습니다. 다시 시도해 주세요.",
              ),
            );
          }
        }}
      >
        <option value="en">English</option>
        <option value="ko">한국어</option>
      </select>
      {error && <span role="alert">{error}</span>}
    </label>
  );
}
