import type { PageContext } from "vike/types";
import { pageLocale } from "../lib/i18n/pageLocale.js";

// <html lang> ni server tomonda til bo'yicha o'rnatadi (SSR'da to'g'ri bo'lishi uchun).
// `render(404)` bilan chizilgan xato sahifasida ham URL prefiksidan olinadi.
export default (pageContext: PageContext): string => pageLocale(pageContext).locale;
