import {
  applyLocale,
  getLocale,
  LOCALE_KEY,
  subscribeLocale,
  type Locale,
} from "./i18n";

const packaged = () => location.protocol === "chrome-extension:";
export async function setLocale(locale: Locale) {
  if (packaged()) await chrome.storage.local.set({ [LOCALE_KEY]: locale });
  else localStorage.setItem(LOCALE_KEY, locale);
  applyLocale(locale);
}
export async function initializeLocale() {
  let stopStorage: () => void;
  if (packaged()) {
    applyLocale((await chrome.storage.local.get(LOCALE_KEY))[LOCALE_KEY]);
    const storageChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ) => {
      if (area === "local" && LOCALE_KEY in changes)
        applyLocale(changes[LOCALE_KEY].newValue);
    };
    chrome.storage.onChanged.addListener(storageChange);
    stopStorage = () => chrome.storage.onChanged.removeListener(storageChange);
  } else {
    applyLocale(localStorage.getItem(LOCALE_KEY));
    const storageChange = (event: StorageEvent) => {
      if (event.key === LOCALE_KEY) applyLocale(event.newValue);
    };
    window.addEventListener("storage", storageChange);
    stopStorage = () => window.removeEventListener("storage", storageChange);
  }
  const updateDocument = () => {
    document.documentElement.lang = getLocale();
    const ko = getLocale() === "ko";
    document.title = location.pathname.endsWith("dashboard.html")
      ? ko
        ? "내 Glimpse · 단어장과 설정"
        : "Glimpse — My words and settings"
      : ko
        ? "Glimpse — 커서 영어 사전"
        : "Glimpse — English-to-Korean Dictionary";
  };
  updateDocument();
  const stopDocument = subscribeLocale(updateDocument);
  return () => {
    stopStorage();
    stopDocument();
  };
}
