import React from "react";

/** U+2028 / U+2029 — JSON'da ruxsat, lekin ba'zi JS muhitlarida qator tugashi deb o'qiladi. */
const LINE_SEPARATOR = String.fromCharCode(0x2028);
const PARAGRAPH_SEPARATOR = String.fromCharCode(0x2029);

/**
 * `<script>` ichiga xavfsiz joylanadigan JSON: `<`, `>`, `&` va U+2028/U+2029 unicode-escape qilinadi.
 * JSON ma'nosi o'zgarmaydi (Google bir xil o'qiydi), lekin ish beruvchi kiritgan matndagi
 * `</script>` HTML parser uchun skript blokini yopa olmaydi (audit ISSUE-005, stored XSS).
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .split(LINE_SEPARATOR)
    .join("\\u2028")
    .split(PARAGRAPH_SEPARATOR)
    .join("\\u2029");
}

/**
 * JSON-LD structured data. Oddiy <script>{JSON.stringify(...)}</script> ishlatib
 * bo'lmaydi — React matnni HTML-escape qiladi (&quot;) va Google o'qiy olmaydi.
 */
export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}
