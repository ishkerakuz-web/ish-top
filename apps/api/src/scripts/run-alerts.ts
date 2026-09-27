import "dotenv/config";
import { prisma } from "../common/prisma.js";
import { runAlertSweep } from "../modules/alerts/alerts.service.js";

/**
 * Obuna xabarnomalarini bir marta tekshiradi va chiqadi.
 *
 * Server ishlab turganda bu ish o'z-o'zidan bajariladi (ichki jadval), lekin
 * alohida cron (masalan systemd timer yoki Railway cron) qo'yishni istasangiz:
 *   npm run alerts:run
 */
const result = await runAlertSweep();
console.log(
  `Tekshirildi: ${result.checked} ta obuna, xabar yuborildi: ${result.notified} ta, ` +
    `yangi vakansiyalar: ${result.matched} ta`
);
await prisma.$disconnect();
