// public/logo.png (512x512 master) dan sayt ishlatadigan kichik variantlarni chiqaradi.
//
//   npm i -D sharp && node scripts/build-logos.mjs
//
// sharp ATAYLAB doimiy bog'liqlik EMAS: u ~10 MB native paket, natijalari esa
// repoda tayyor turadi va yiliga bir-ikki marta o'zgaradi. Logo almashsa —
// public/logo.png ni almashtiring va shu skriptni bir marta yuriting.
//
// Nima uchun bu o'lchamlar:
//   logo-108.webp — header/footer logosi 36 CSS px, @3x uchun 108px yetadi
//   logo-256.webp — BrandLogo `hero` varianti 96-112 CSS px, @2x uchun 256px
//   logo-48.png   — favicon; brauzer uni yorliqda 16-32 px qilib chizadi, shuning
//                   uchun 48px @1.5x-@3x uchun yetadi (96px 5.5 KB, 48px 2.5 KB).
//                   PNG qoladi: eski brauzerlar WebP favicon'ni qo'llamaydi
//   logo-180.png  — apple-touch-icon (iOS "Bosh ekranga qo'shish")
//
// Ikonkalarga havolalar ikki joyda: src/components/HeadDefault.tsx (favicon,
// apple-touch-icon) va public/sw.js (push bildirishnoma icon/badge).
//
// logo.png ning o'zi TEGILMAYDI: u master va og:image sifatida ishlatiladi
// (ijtimoiy tarmoqlarga katta rasm kerak, sahifa yuklanishiga ta'sir qilmaydi).

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const PUBLIC_DIR = join(dirname(dirname(fileURLToPath(import.meta.url))), "public");
const MASTER = join(PUBLIC_DIR, "logo.png");

const square = (size) => sharp(MASTER).resize(size, size, { fit: "cover", position: "centre" });

const OUTPUTS = [
  ["logo-108.webp", () => square(108).webp({ quality: 82, effort: 6 })],
  ["logo-256.webp", () => square(256).webp({ quality: 82, effort: 6 })],
  ["logo-48.png", () => square(48).png({ compressionLevel: 9, palette: true, quality: 90 })],
  ["logo-180.png", () => square(180).png({ compressionLevel: 9, palette: true, quality: 90 })],
];

for (const [name, make] of OUTPUTS) {
  // toBuffer() -> writeFileSync: toFile() bo'lsa sharp buferni QAYTA kodlaydi
  // va palette/quality sozlamalari yo'qoladi (PNG ikki barobar kattayadi).
  const buffer = await make().toBuffer();
  writeFileSync(join(PUBLIC_DIR, name), buffer);
  console.log(`${name.padEnd(16)} ${String(buffer.length).padStart(7)} bayt`);
}
