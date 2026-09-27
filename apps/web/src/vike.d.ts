// Vike pageContext'ga maxsus maydonlar qo'shamiz (server `+onBeforeRender`da to'ldiriladi).
import type { Locale } from "./lib/i18n/config.js";

declare global {
  namespace Vike {
    interface PageContext {
      /** URL prefiksidan aniqlangan til; `passToClient` orqali clientga uzatiladi. */
      locale?: Locale;
      /** Til prefiksisiz pathname (hreflang/canonical va til almashtirish uchun). */
      localePathname?: string;
    }
  }
}

export {};
