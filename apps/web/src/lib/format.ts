import type { Messages } from "./i18n/messages.js";
import { REGION_NAMES } from "./i18n/regions.js";

/**
 * Raqam guruhlash tili (audit R3, i18n-6): EN uchun "1,207", uz/ru uchun "1 207".
 * `ru-RU` va `en-US` ICU'da barqaror — SSR va brauzer bir xil natija beradi
 * (o'zbekcha teg ataylab ishlatilmaydi: Node va Chrome farqli formatlaydi).
 */
const NUMBER_TAG: Record<string, string> = { uz: "ru-RU", ru: "ru-RU", en: "en-US" };
const numberFmts = new Map<string, Intl.NumberFormat>();

function numberFmt(locale?: string): Intl.NumberFormat {
  const tag = NUMBER_TAG[locale ?? ""] ?? "ru-RU";
  let fmt = numberFmts.get(tag);
  if (!fmt) {
    fmt = new Intl.NumberFormat(tag);
    numberFmts.set(tag, fmt);
  }
  return fmt;
}

/** `locale` berilmasa eski xatti-harakat (ru-RU) saqlanadi — chaqiruvchilar bosqichma-bosqich o'tadi. */
export function formatNumber(n: number, locale?: string): string {
  return numberFmt(locale).format(n);
}

/** Maoshni joriy tilga mos formatlaydi. */
export function formatSalary(
  min: number | null | undefined,
  max: number | null | undefined,
  fmt: Messages["fmt"],
  isHidden = false,
  locale?: string
): string {
  if (isHidden || (!min && !max)) return fmt.salaryHidden;
  const f = (n: number) => numberFmt(locale).format(n);
  if (min && max) return fmt.salaryRange(f(min), f(max));
  if (min) return fmt.salaryFrom(f(min));
  return fmt.salaryTo(f(max!));
}

/**
 * Hudud nomini joriy tilda ko'rsatish (audit R3, i18n-4).
 *
 * Slug bo'lsa — to'g'ridan-to'g'ri lug'atdan. Ba'zi API javoblarida (profil,
 * saqlangan e'lonlar, katalog kartasi) faqat o'zbekcha `name` keladi: u holda
 * nom bo'yicha teskari qidiruv qilinadi (apostrof variantlari bir xil deb
 * hisoblanadi, D-080 bilan bir uslubda). Topilmasa — kelgan nom o'zgarmaydi.
 */
/** Apostrof variantlari: ' (0x27), ` (0x60), 0x2BB, 0x2BC, 0x2018, 0x2019 — bir xil hisoblanadi. */
function isApostropheCode(code: number): boolean {
  return code === 0x27 || code === 0x60 || code === 0x2bb || code === 0x2bc || code === 0x2018 || code === 0x2019;
}

function regionKey(value: string): string {
  const lower = value.trim().toLocaleLowerCase();
  let out = "";
  for (let i = 0; i < lower.length; i += 1) {
    out += isApostropheCode(lower.charCodeAt(i)) ? "'" : lower.charAt(i);
  }
  return out;
}

let uzSlugByName: Map<string, string> | null = null;

function slugByUzName(name: string): string | null {
  if (!uzSlugByName) {
    uzSlugByName = new Map();
    for (const [slug, label] of Object.entries(REGION_NAMES.uz)) uzSlugByName.set(regionKey(label), slug);
  }
  return uzSlugByName.get(regionKey(name)) ?? null;
}

export function regionDisplayName(
  locale: string,
  name: string | null | undefined,
  slug?: string | null
): string | null {
  const fallback = name?.trim() || null;
  const names = REGION_NAMES[locale as keyof typeof REGION_NAMES];
  if (!names) return fallback;
  if (slug && names[slug]) return names[slug];
  if (!fallback) return null;
  const found = slugByUzName(fallback);
  return found && names[found] ? names[found] : fallback;
}

/**
 * Brauzerlarning ko'pchiligida (Chrome ICU) o'zbekcha oy nomlari yo'q —
 * `Intl` "2026 M09 07" ga tushib qoladi, Node esa "07-sen, 2026" beradi va
 * SSR sahifada hydration xatosi chiqadi. Shuning uchun o'zbekcha nomlar qo'lda.
 */
export const UZ_MONTHS = ["yan", "fev", "mar", "apr", "may", "iyun", "iyul", "avg", "sen", "okt", "noy", "dek"];

const DATE_TAG: Record<string, string> = { uz: "uz-Latn-UZ", ru: "ru-RU", en: "en-US" };
// Server (UTC) va brauzer bir xil kunni ko'rsatsin
const TIME_ZONE = "Asia/Tashkent";

/** ISO sana -> "07 sen 2026" / "07 сент. 2026 г." / "Sep 07, 2026". */
export function formatDate(iso: string, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  if (locale === "uz") {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, day: "2-digit", month: "numeric", year: "numeric" }).formatToParts(date);
    const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
    return `${part("day")} ${UZ_MONTHS[Number(part("month")) - 1]} ${part("year")}`;
  }
  return date.toLocaleDateString(DATE_TAG[locale] ?? locale, { timeZone: TIME_ZONE, day: "2-digit", month: "short", year: "numeric" });
}

/** ISO sanadan «Bugun / Kecha / N kun oldin» (joriy tilda). */
export function formatRelativeDays(publishedAt: string | null, fmt: Messages["fmt"]): string {
  if (!publishedAt) return "";
  const diff = Date.now() - new Date(publishedAt).getTime();
  const days = Math.max(0, Math.floor(diff / 86_400_000));
  if (days === 0) return fmt.today;
  if (days === 1) return fmt.yesterday;
  return fmt.daysAgo(days);
}
