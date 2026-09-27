import { useEffect, useRef } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Modal dialog xatti-harakati (filtr drawer'idagi naqsh): fokus dialog ichida
 * aylanadi, Esc yopadi, sahifa orqada aylanmaydi, yopilganda fokus ochgan
 * elementga qaytadi. `onKey` — dialogga xos tugmalar (galereyada ←/→).
 * Birinchi fokus `[data-autofocus]` elementiga, bo'lmasa panelning o'ziga.
 */
export function useDialog(
  open: boolean,
  panelRef: React.RefObject<HTMLElement>,
  onClose: () => void,
  onKey?: (e: KeyboardEvent) => void
) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const keyRef = useRef(onKey);
  keyRef.current = onKey;

  useEffect(() => {
    if (!open) return;
    const trigger = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    (panel?.querySelector<HTMLElement>("[data-autofocus]") ?? panel)?.focus();

    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeRef.current();
        return;
      }
      keyRef.current?.(e);
      if (e.key !== "Tab" || !panel) return;
      const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = overflow;
      trigger?.focus?.({ preventScroll: true });
    };
  }, [open, panelRef]);
}
