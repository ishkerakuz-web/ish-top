import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import vike from "vike/plugin";

// Xavfsizlik sarlavhalari — HTML hujjatni beruvchi web server uchun
// (Lighthouse Best Practices: COOP, X-Frame-Options, nosniff).
//
// MUHIM: ro'yxat to'rt joyda bir xil bo'lishi kerak — bu fayl (dev/preview),
// `server/index.mjs` (self-hosted), `api/ssr.js` va `vercel.json` (Vercel).
// Content-Security-Policy bu ro'yxatda YO'Q: u har so'rovga nonce bilan
// `src/pages/+headersResponse.ts` da quriladi va Vike javob sarlavhalariga
// qo'shiladi (audit R3, D-057). Dev serverda CSP ataylab qo'yilmaydi.
const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  // `same-origin` Google Sign-In popup'ining sahifaga qaytadigan aloqasini uzadi
  // — GIS popup oqimi uchun `allow-popups` kerak (audit R3, headers-infra-10).
  "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  // Sayt bu qurilmalarni ishlatmaydi (audit R3, headers-infra-14).
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
};

/** localhost / bo'sh qiymat — production deploy uchun yaroqsiz. */
function isLocalOrigin(value: string | undefined): boolean {
  if (!value) return true;
  return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(value.trim());
}

/**
 * audit R3, seo-10 — canonical/hreflang manzili jimgina localhost'ga tushmasin.
 *
 * Haqiqiy deployda (Vercel `VERCEL=1` yoki aniq `STRICT_SITE_URL=1`) qiymat
 * yo'q yoki localhost bo'lsa build TO'XTAYDI. Lokal `npm run build` esa faqat
 * ogohlantirish oladi — ishlab chiqish jarayoni buzilmaydi.
 */
function siteUrlGuard(): Plugin {
  return {
    name: "ishbor-site-url-guard",
    apply: "build",
    configResolved(config) {
      const env = loadEnv(config.mode, config.envDir ?? process.cwd(), "VITE_");
      const site = env.VITE_SITE_URL;
      const api = env.VITE_API_URL;
      const problems: string[] = [];
      if (isLocalOrigin(site)) problems.push(`VITE_SITE_URL=${site ?? "(yo'q)"}`);
      if (isLocalOrigin(api)) problems.push(`VITE_API_URL=${api ?? "(yo'q)"}`);
      if (problems.length === 0) return;
      const strict = Boolean(process.env.VERCEL || process.env.STRICT_SITE_URL);
      const message =
        `[ishbor] Ommaviy manzillar sozlanmagan: ${problems.join(", ")}. ` +
        "canonical, hreflang, og:url va CSP connect-src shu qiymatlardan quriladi.";
      if (strict) throw new Error(message);
      config.logger.warn(message);
    },
  };
}

export default defineConfig({
  plugins: [react(), vike(), siteUrlGuard()],
  server: {
    port: 5173,
    strictPort: true,
    headers: SECURITY_HEADERS,
  },
  preview: {
    // 3000 (API) va 5173 (dev) bilan to'qnashmasin
    port: 4173,
    strictPort: true,
    headers: SECURITY_HEADERS,
  },
  // Eslatma: bu yerda `manualChunks` bor edi va u /lib/i18n/messages* ni BITTA
  // "i18n-messages" chunk'iga yopishtirardi. Endi har til alohida modul
  // (messages.uz/ru/en.ts) va dinamik import qilinadi — bundler ularni o'zi
  // alohida chunk qiladi, faqat kerakli til tarmoqdan keladi. Qo'lda
  // guruhlash aynan shu bo'linishni buzardi, shuning uchun olib tashlandi.
});
