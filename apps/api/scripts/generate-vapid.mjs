// VAPID kalit juftini yaratadi (brauzer push xabarnomalari uchun).
// Ishlatish:  npm run push:keys
// Chiqqan qiymatlarni apps/api/.env ga ko'chiring.
import webpush from "web-push";

const keys = webpush.generateVAPIDKeys();

console.log("\nQuyidagi qatorlarni apps/api/.env fayliga qo'shing:\n");
console.log(`VAPID_PUBLIC_KEY="${keys.publicKey}"`);
console.log(`VAPID_PRIVATE_KEY="${keys.privateKey}"`);
console.log(`VAPID_SUBJECT="mailto:siz@example.uz"`);
console.log("\nOchiq kalit brauzerga /api/push/public-key orqali beriladi,");
console.log("maxfiy kalit esa faqat serverda qoladi.\n");
