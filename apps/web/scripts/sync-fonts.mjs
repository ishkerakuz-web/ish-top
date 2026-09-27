// @fontsource-variable paketlaridan kerakli woff2 fayllarni public/fonts ga ko'chiradi.
//
//   node scripts/sync-fonts.mjs
//
// NEGA public/ ga ko'chiriladi, to'g'ridan-to'g'ri import qilinmaydi:
// @fontsource CSS'ini import qilsak, Vike shrift fayllarini asset-grafigiga
// qo'shadi va HAMMASINI <link rel="preload"> qiladi — barcha subsetlar bilan
// birga ~500 KB. public/ dagi fayllar grafikka kirmaydi, shuning uchun
// nimani preload qilishni biz o'zimiz hal qilamiz (HeadDefault.tsx).
//
// Qaysi subset kerakligini `src/styles/fonts.css` dagi unicode-range belgilaydi:
// brauzer sahifada haqiqatan ishlatilgan belgilar uchun faqat kerakli faylni oladi.
// Shu sababli bu yerdagi ro'yxat fonts.css bilan bir xil bo'lishi shart.

import { copyFileSync, mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT = join(ROOT, "public", "fonts");

// Plus Jakarta Sans'da bazaviy kirill subseti yo'q (faqat cyrillic-ext) — ruscha
// sarlavhalar sans-serif zaxirasiga tushadi. fonts.css'da ham shunday izohlangan.
const FAMILIES = {
  inter: ["latin", "latin-ext", "cyrillic"],
  "plus-jakarta-sans": ["latin", "latin-ext"],
  "jetbrains-mono": ["latin", "latin-ext", "cyrillic"],
};

mkdirSync(OUT, { recursive: true });

let total = 0;
for (const [family, subsets] of Object.entries(FAMILIES)) {
  for (const subset of subsets) {
    const file = `${family}-${subset}-wght-normal.woff2`;
    const from = join(ROOT, "node_modules", "@fontsource-variable", family, "files", file);
    copyFileSync(from, join(OUT, file));
    const { size } = statSync(join(OUT, file));
    total += size;
    console.log(`${file.padEnd(46)} ${String(size).padStart(7)} bayt`);
  }
}
console.log(`\n${Object.values(FAMILIES).flat().length} ta fayl, jami ${(total / 1024).toFixed(1)} KB`);
