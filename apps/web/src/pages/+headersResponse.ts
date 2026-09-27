import type { PageContextServer } from "vike/types";

/**
 * audit R3, D-057 — HTML hujjat uchun HTTP sarlavhalari (bitta manba).
 *
 * Vike bu qiymatlarni `httpResponse.headers` ga qo'yadi; `server/index.mjs`,
 * `api/ssr.js` va `vike preview` ularni javobga ko'chiradi, shuning uchun
 * siyosat uchta serving yo'lida ham bir xil bo'ladi va qo'lda takrorlanmaydi.
 *
 * API manzili `lib/api.ts` bilan BIR XIL manbadan olinadi (`VITE_API_URL`) —
 * aks holda XHR/WebSocket ulanishlari jimgina bloklanardi.
 */

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:3000";

/** "https://api.example.com/x" -> "https://api.example.com"; noto'g'ri qiymatda "". */
function originOf(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
}

const API_ORIGIN = originOf(API_URL);
/**
 * Yuklangan rasmlar S3/R2 kabi tashqi xotiradan berilsa (API `S3_PUBLIC_BASE_URL` bilan
 * sozlanganda), ular API domenida emas — shu origin'dan keladi va CSP'da ruxsat berilishi
 * shart, aks holda logolar va muqovalar JIMGINA bloklanadi (audit: storage-1).
 * Sozlanmagan bo'lsa qiymat bo'sh va siyosat avvalgidek qoladi.
 */
const MEDIA_ORIGIN = originOf((import.meta.env.VITE_MEDIA_URL as string | undefined) ?? "");
/** WebSocket manzili `lib/api.ts` dagi `WS_URL` bilan bir xil qoidada (http -> ws). */
const WS_ORIGIN = API_ORIGIN ? API_ORIGIN.replace(/^http/i, "ws") : "";

// Google Identity Services (kirish tugmasi) — skript, uslub, iframe va suratlar.
const GOOGLE = "https://accounts.google.com";
const GOOGLE_STYLE = "https://accounts.google.com/gsi/style";
const GOOGLE_AVATARS = "https://*.googleusercontent.com";

/** Bo'sh qiymatlarni tashlab, direktiva satrini yig'adi. */
function directive(name: string, ...sources: string[]): string {
  return [name, ...sources.filter(Boolean)].join(" ");
}

function contentSecurityPolicy(nonce: string): string {
  return [
    // Inline skript faqat nonce bilan: mavzu init skripti (HeadDefault) va Vike'ning o'z skriptlari.
    directive("script-src", "'self'", `'nonce-${nonce}'`, GOOGLE),
    // React `style={...}` atributlari va Tailwind'ning inline uslublari uchun 'unsafe-inline' zarur.
    directive("style-src", "'self'", "'unsafe-inline'", GOOGLE_STYLE),
    // data: — SVG/placeholder, blob: — himoyalangan PDF (lib/files/resume.ts), API — yuklangan logolar.
    directive("img-src", "'self'", "data:", "blob:", API_ORIGIN, MEDIA_ORIGIN, GOOGLE_AVATARS),
    directive("font-src", "'self'"),
    directive("connect-src", "'self'", API_ORIGIN, WS_ORIGIN, GOOGLE),
    directive("frame-src", GOOGLE),
    directive("worker-src", "'self'"),
    directive("manifest-src", "'self'"),
    // blob: — vakolatli PDF rezyume (lib/files/resume.ts) yangi tabda blob URL sifatida ochiladi va bu
    // hujjat shu CSP ni meros qiladi; `'none'` Chromium'ning ichki PDF ko'ruvchisini bloklashi mumkin
    // (audit R3 ikkinchi audit, backend-4). blob URL ni faqat saytning o'z skripti yarata oladi,
    // boshqa origin'dagi plagin kontenti avvalgidek taqiqlanadi.
    directive("object-src", "blob:"),
    directive("base-uri", "'self'"),
    directive("form-action", "'self'"),
    directive("frame-ancestors", "'self'"),
  ].join("; ");
}

export default function headersResponse(pageContext: PageContextServer): HeadersInit {
  const headers: Record<string, string> = {};

  // API vaqtincha javob bermadi (`throw render(503)`) — brauzer va qidiruv
  // tizimi keyin qayta uradi, sahifa indeksdan chiqmaydi (audit R3, seo-2).
  const status = (pageContext as { abortStatusCode?: number }).abortStatusCode;
  if (status === 503) headers["Retry-After"] = "120";

  // Dev serverda nonce yo'q (`+csp.ts`) — CSP ham qo'yilmaydi.
  const nonce = pageContext.cspNonce;
  if (nonce) headers["Content-Security-Policy"] = contentSecurityPolicy(nonce);

  return headers;
}
