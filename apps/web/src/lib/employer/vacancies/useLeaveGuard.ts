import { useCallback, useEffect, useRef } from "react";

/**
 * Saqlanmagan o'zgarishlar himoyasi (`active` bo'lganda):
 * - sayt ichidagi havolalar (navbar, breadcrumb, footer) — Vike client routing
 *   `beforeunload`ni chaqirmaydi va `preventDefault`ni hisobga olmaydi, shuning uchun
 *   bosish `document` capture bosqichida ushlanadi va `onIntercept(href)` — formaning tasdiq oynasi;
 * - sahifani yopish / tashqi manzil — brauzerning o'z ogohlantirishi.
 * Muvaffaqiyatli saqlangach yoki "Chiqish" tasdiqlangach `allowLeave()` — ogohlantirish chiqmaydi.
 */
export function useLeaveGuard(active: boolean, onIntercept: (href: string) => void) {
  const bypass = useRef(false);
  const interceptRef = useRef(onIntercept);
  interceptRef.current = onIntercept;

  useEffect(() => {
    if (!active) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (bypass.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const onClick = (event: MouseEvent) => {
      if (bypass.current || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link || (link.target && link.target !== "_self") || link.hasAttribute("download")) return;
      const url = new URL(link.href, window.location.href);
      // Tashqi manzil — `beforeunload`; shu sahifaning o'zi (yoki #langar) — ma'lumot yo'qolmaydi
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      event.preventDefault();
      event.stopPropagation();
      interceptRef.current(url.pathname + url.search + url.hash);
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [active]);

  const allowLeave = useCallback(() => {
    bypass.current = true;
  }, []);

  return { allowLeave };
}
