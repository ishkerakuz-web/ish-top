import { useCallback, useEffect, useRef, useState } from "react";
import { apiErrorText } from "../apiExtra.js";

export type Notice = { tone: "success" | "error"; text: string } | null;

/** Admin amallari natijasi: muvaffaqiyat 4 soniyada yo'qoladi, xato qoladi. */
export function useNotice() {
  const [notice, setNotice] = useState<Notice>(null);
  const timer = useRef<number>();
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const show = useCallback((tone: "success" | "error", text: string) => {
    window.clearTimeout(timer.current);
    setNotice({ tone, text });
    if (tone === "success") timer.current = window.setTimeout(() => setNotice(null), 4000);
  }, []);

  const clear = useCallback(() => {
    window.clearTimeout(timer.current);
    setNotice(null);
  }, []);

  return { notice, show, clear };
}

/**
 * Server xabari (API matnlari o'zbekcha) — o'zbek tilida ko'rsatiladi, boshqa
 * tillarda umumiy tarjima qilingan xabar. Audit R3, i18n-3: bitta manba —
 * `apiErrorText` (tarmoq va JSON bo'lmagan javob ham shu yerda hisobga olinadi).
 */
export function errorText(error: unknown, fallback: string, locale: string, network?: string): string {
  return apiErrorText(error, locale, { fallback, network });
}
