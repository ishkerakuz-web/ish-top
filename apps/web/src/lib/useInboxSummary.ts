import { useCallback, useEffect, useRef, useState } from "react";
import { fetchInboxSummaryStrict } from "./apiExtra.js";
import { INBOX_CHANGED } from "./messages/events.js";
import { isPageVisible, isSocketLive, onPageActive, subscribeSocketLive } from "./messages/live.js";
import type { InboxSummary } from "./types.js";

const EMPTY: InboxSummary = { unreadMessages: 0, newApplications: 0 };

/** WebSocket yopiq bo'lsa — odatiy tezlik; ochiq bo'lsa xabarlar socket orqali keladi, so'rov faqat zaxira. */
const POLL_MS = 20_000;
const POLL_LIVE_MS = 120_000;

/**
 * Header uchun o'qilmagan xabarlar + yangi arizalar sonini oladi.
 *
 * Audit PHASE 6, U22: so'rov xato bersa oldingi son saqlanadi (0 ga tushmaydi); kechikib kelgan
 * eski javob yangisini yozmaydi. 0 ga faqat seans o'zgarganda (chiqish yoki boshqa hisob) qaytadi.
 *
 * Audit R3, realtime-9 / scale-10k-7: yashirin tabdan umuman so'ralmaydi (tab ko'ringanda darhol
 * bir marta so'raladi), WebSocket ochiq bo'lsa oraliq 2 daqiqaga cho'ziladi — xabar va ariza
 * hodisalari baribir socket orqali `INBOX_CHANGED` bo'lib keladi va sonni darhol yangilaydi.
 */
export function useInboxSummary(token: string | null) {
  const [summary, setSummary] = useState<InboxSummary>(EMPTY);
  /** Oxirgi boshlangan so'rov raqami. */
  const seq = useRef(0);
  /** Ekrandagi javob qaysi so'rovniki — undan eski javob e'tiborsiz qoldiriladi. */
  const shown = useRef(0);

  const refresh = useCallback(() => {
    if (!token) {
      setSummary(EMPTY);
      return;
    }
    const mine = ++seq.current;
    fetchInboxSummaryStrict(token)
      .then((next) => {
        if (mine <= shown.current) return;
        shown.current = mine;
        setSummary(next);
      })
      .catch(() => {
        /* tarmoq/server xatosi — oldingi son qoladi, keyingi so'rov tiklaydi */
      });
  }, [token]);

  useEffect(() => {
    // Seans o'zgardi: oldingi seans so'rovlarining kechikkan javobi yozilmaydi, eski son ko'rsatilmaydi
    shown.current = seq.current;
    setSummary(EMPTY);
    if (!token || typeof window === "undefined") return;

    let timer = 0;
    /**
     * Oxirgi davr boshlangan vaqt. Kechikish shu nuqtadan hisoblanadi — socket ochilib-yopilib
     * turganda (`subscribeSocketLive`) qayta rejalashtirish davriy so'rovni cheksiz kechiktirmasin.
     */
    let periodAt = Date.now();
    const schedule = () => {
      window.clearTimeout(timer);
      const interval = isSocketLive() ? POLL_LIVE_MS : POLL_MS;
      timer = window.setTimeout(tick, Math.max(0, interval - (Date.now() - periodAt)));
    };
    function tick() {
      // Davr boshlandi: yashirin tabda so'rov yuborilmaydi — tab ko'ringanda darhol yangilanadi
      periodAt = Date.now();
      if (isPageVisible()) refresh();
      schedule();
    }

    refresh();
    schedule();

    const onChanged = () => refresh();
    // Boshqa sahifadan qaytganda va /messages'da suhbat o'qilganda darrov yangilash uchun
    const stopActive = onPageActive(() => {
      periodAt = Date.now();
      refresh();
      schedule();
    });
    window.addEventListener(INBOX_CHANGED, onChanged);
    // Socket ochildi/yopildi — keyingi oraliq mos tezlikda
    const stopLive = subscribeSocketLive(() => schedule());
    return () => {
      window.clearTimeout(timer);
      stopActive();
      stopLive();
      window.removeEventListener(INBOX_CHANGED, onChanged);
    };
  }, [token, refresh]);

  return { summary, refresh };
}
