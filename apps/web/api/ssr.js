// Vercel Serverless Function — saytning SSR ishlovchisi.
//
// `vercel.json` dagi rewrites statik fayl topilmagan HAR QANDAY so'rovni shu
// yerga uzatadi. `renderPage()` `dist/server/entry.mjs` ni o'zi yuklaydi
// (shuning uchun uni qo'lda import qilish shart emas) — build natijasi
// funksiya ichiga `vercel.json#functions.includeFiles` orqali qo'shiladi.
//
// TypeScript emas, JS + JSDoc: Vercel `/api/**/*.ts` bilan noturg'un ishlaydi
// (Vike'ning rasmiy namunasi ham shundan JS ishlatadi).

import { renderPage } from "vike/server";

// apps/web/server/index.mjs, vite.config.ts va vercel.json dagilar bilan bir xil
// bo'lishi kerak — dev, self-hosted prod va Vercel bir xil sarlavha bersin.
//
// Content-Security-Policy bu yerda YO'Q: u har so'rovga nonce bilan
// `src/pages/+headersResponse.ts` da quriladi va quyida Vike sarlavhalari
// bilan birga ko'chiriladi (audit R3, D-057).
const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  // Google Sign-In popup oqimi uchun (audit R3, headers-infra-10).
  "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
};

/**
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 */
export default async function handler(req, res) {
  const url = req.url;
  if (!url) {
    res.statusCode = 400;
    res.end("Bad request");
    return;
  }

  try {
    const pageContext = await renderPage({
      urlOriginal: url,
      headersOriginal: req.headers,
    });
    const { httpResponse } = pageContext;

    for (const [name, value] of Object.entries(SECURITY_HEADERS)) res.setHeader(name, value);

    // Vike noma'lum yo'l uchun ham 404 SAHIFASINI qaytaradi; httpResponse
    // bo'lmasligi — Vike umuman javob bermagan holat.
    if (!httpResponse) {
      res.statusCode = 404;
      res.end("Not found");
      return;
    }

    // Vike sarlavhalari: CSP (nonce bilan), Retry-After va Cache-Control.
    for (const [name, value] of httpResponse.headers) res.setHeader(name, value);

    // `no-cache` — brauzer har safar tekshiradi, LEKIN sahifani saqlaydi.
    // `no-store` bo'lsa bfcache o'chadi va "orqaga" tugmasi sahifani qaytadan
    // yuklaydi, shuning uchun Vike'ning sukut `no-store` qiymati almashtiriladi.
    // Xato javoblari (404/503) esa `no-store` bo'lib qoladi — vaqtinchalik
    // xato keshlanmasin (audit R3, api-errors-1).
    if (httpResponse.statusCode < 400) res.setHeader("Cache-Control", "no-cache");
    res.statusCode = httpResponse.statusCode;
    res.end(await httpResponse.getBody());
  } catch (err) {
    console.error("[ssr] render xatosi:", err);
    res.statusCode = 500;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.end("<!doctype html><meta charset=utf-8><title>Xatolik</title><h1>Kutilmagan xatolik</h1>");
  }
}
