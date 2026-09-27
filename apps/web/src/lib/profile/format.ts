import type { Locale } from "../i18n/config.js";
import { UZ_MONTHS } from "../format.js";

const LOCALE_TAG: Record<Locale, string> = { uz: "uz-Latn-UZ", ru: "ru-RU", en: "en-US" };

/** "2021-03" -> "mar 2021" (joriy tilda). Noto'g'ri qiymat o'zicha qaytadi. */
export function formatYearMonth(value: string | null | undefined, locale: Locale): string {
  if (!value) return "";
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return value;
  if (locale === "uz") return `${UZ_MONTHS[Number(match[2]) - 1] ?? match[2]} ${match[1]}`;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
  try {
    return new Intl.DateTimeFormat(LOCALE_TAG[locale], { month: "short", year: "numeric", timeZone: "UTC" }).format(date);
  } catch {
    return value;
  }
}
