export type Locale = "en" | "ko";
export const LOCALE_KEY = "glimpse.language";
let locale: Locale = "en";
const listeners = new Set<() => void>();
export const getLocale = () => locale;
export const asLocale = (value: unknown): Locale =>
  value === "ko" ? "ko" : "en";
export function applyLocale(value: unknown) {
  const next = asLocale(value);
  if (next === locale) return;
  locale = next;
  listeners.forEach((listener) => listener());
}
export function subscribeLocale(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function t(
  english: string,
  korean: string,
  ...values: (string | number)[]
) {
  const message = locale === "ko" ? korean : english;
  return values.length
    ? message.replace(/\{(\d+)\}/g, (_, index) =>
        String(values[Number(index)] ?? ""),
      )
    : message;
}
