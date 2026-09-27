import { useCallback, useEffect, useRef, useState } from "react";

export type ShareOutcome = "shared" | "copied" | "failed" | "cancelled";

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* ruxsat yo'q yoki xavfsiz kontekst emas — eski usulga o'tamiz */
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

/**
 * Ulashish: qurilmada tizim oynasi bo'lsa (Web Share API) — o'sha, bo'lmasa
 * havola nusxalanadi. `notice` — qisqa muddatli "nusxalandi / bo'lmadi" xabari
 * (`role="status"` bilan e'lon qilinadi).
 */
export function useShare() {
  const [notice, setNotice] = useState<"copied" | "failed" | null>(null);
  const timer = useRef<number>();
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const flash = useCallback((kind: "copied" | "failed") => {
    setNotice(kind);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setNotice(null), 2600);
  }, []);

  const copy = useCallback(
    async (url: string) => {
      const ok = await copyText(url);
      flash(ok ? "copied" : "failed");
      return ok;
    },
    [flash]
  );

  const share = useCallback(
    async (data: { title: string; text?: string; url: string }): Promise<ShareOutcome> => {
      if (typeof navigator.share === "function") {
        try {
          await navigator.share(data);
          return "shared";
        } catch (err) {
          if ((err as Error)?.name === "AbortError") return "cancelled";
          // Boshqa xato (masalan ruxsat yo'q) — nusxalashga o'tamiz
        }
      }
      return (await copy(data.url)) ? "copied" : "failed";
    },
    [copy]
  );

  return { share, copy, notice };
}
