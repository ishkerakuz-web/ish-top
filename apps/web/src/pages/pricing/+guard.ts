import { redirect } from "vike/abort";
import type { PageContext } from "vike/types";
import { pageLocale } from "../../lib/i18n/pageLocale.js";
import { localizeHref } from "../../lib/i18n/config.js";

/**
 * Platforma to'liq bepul (D-040) — tariflar sahifasi mahsulotning bir qismi emas.
 * Eski havolalar ish beruvchilar sahifasiga DOIMIY (301) yo'naltiriladi
 * (audit R3, seo-14): 302 bilan Google `/pricing` manzilini indeksda saqlab
 * turardi. Monetizatsiya keyin alohida modul bo'lsa, qaror alohida qabul qilinadi.
 */
export function guard(pageContext: PageContext) {
  throw redirect(localizeHref("/employer", pageLocale(pageContext).locale), 301);
}
