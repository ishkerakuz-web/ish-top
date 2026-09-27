/**
 * Real-time yordamchi: ko'rinuvchanlik, ulanish holati va kechikish tasodifiyligi.
 *
 * audit R3, realtime-6: yashirin yoki fokussiz tabdan "o'qildi" yuborilmaydi;
 * audit R3, realtime-7: qayta ulanish kechikishiga tasodifiy qism qo'shiladi —
 *   deploydan keyin barcha klientlar bir vaqtda urilmaydi;
 * audit R3, realtime-9 / scale-10k-7: WebSocket ochiq bo'lsa davriy so'rovlar sekinlashadi,
 *   yashirin tabda esa umuman yuborilmaydi.
 *
 * Fayl `lib/messages/` ichida: chat socket'i shu yerda, qo'ng'iroq va header ham shundan foydalanadi.
 */

/** Ochiq WebSocket'lar soni (bitta tabda qo'ng'iroq + `/messages` bo'lishi mumkin). */
let openSockets = 0;
const liveListeners = new Set<(live: boolean) => void>();

function notifyLive(): void {
  const live = openSockets > 0;
  for (const listener of liveListeners) listener(live);
}

/** Ulanish ochildi. Qaytgan funksiya ulanish yopilganda chaqiriladi (bir marta hisoblanadi). */
export function socketOpened(): () => void {
  openSockets += 1;
  notifyLive();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    openSockets = Math.max(0, openSockets - 1);
    notifyLive();
  };
}

export function isSocketLive(): boolean {
  return openSockets > 0;
}

export function subscribeSocketLive(listener: (live: boolean) => void): () => void {
  liveListeners.add(listener);
  return () => liveListeners.delete(listener);
}

/** Sahifa ko'rinib turibdimi (SSR va eski brauzerda — ha). */
export function isPageVisible(): boolean {
  if (typeof document === "undefined") return true;
  return document.visibilityState !== "hidden";
}

/**
 * Foydalanuvchi haqiqatan ham shu oynaga qarab turibdimi: ko'rinadi va oyna fokusda.
 * "O'qildi" belgisi faqat shunda yuboriladi (audit R3, realtime-6).
 */
export function isPageActive(): boolean {
  if (typeof document === "undefined") return true;
  if (!isPageVisible()) return false;
  return typeof document.hasFocus === "function" ? document.hasFocus() : true;
}

/**
 * Sahifa yana faollashganda (ko'rindi yoki fokus qaytdi) chaqiriladi.
 * Qaytgan funksiya tinglovchilarni olib tashlaydi.
 */
export function onPageActive(handler: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const onVisible = () => {
    if (isPageActive()) handler();
  };
  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("focus", onVisible);
  return () => {
    document.removeEventListener("visibilitychange", onVisible);
    window.removeEventListener("focus", onVisible);
  };
}

/**
 * To'liq tasodifiy kechikish: 0..base oralig'ida (audit R3, realtime-7).
 * Serverni qayta ishga tushirgandan keyin minglab klient bir soniyada urilmaydi.
 */
export function fullJitter(base: number): number {
  return Math.round(Math.random() * Math.max(0, base));
}

/** Qayta ulangandan keyingi og'ir so'rovlarni 0..ms oralig'ida tarqatish. */
export function staggerDelay(ms = 3000): number {
  return fullJitter(ms);
}
