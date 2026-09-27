import { useEffect, type RefObject } from "react";

/**
 * Element tashqarisiga bosilganda (yoki Escape bosilganda) `onOutside` chaqiriladi.
 * `fixed` overlay'dan farqli — hujjat darajasida ishlaydi, shu sababli
 * `backdrop-blur` qilingan header ichida ham to'g'ri ishlaydi.
 */
export function useClickOutside<T extends HTMLElement>(
  ref: RefObject<T>,
  onOutside: () => void,
  active: boolean
) {
  useEffect(() => {
    if (!active) return;
    function handlePointer(e: MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside();
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onOutside();
    }
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("touchstart", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("touchstart", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [ref, onOutside, active]);
}
