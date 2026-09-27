import { useEffect, useState } from "react";

/**
 * Kuzatilayotgan elementlardan birortasi ekranda ko'rinib turibdimi.
 * `display: none` bo'lgan nusxa (masalan faqat desktop'da ko'rinadigan karta)
 * hech qachon "ko'rinmaydi", shuning uchun joriy o'lchamdagi nusxa hal qiladi.
 * Server render va birinchi paint'da `initial` qaytadi.
 */
export function useAnyInView(refs: React.RefObject<Element>[], initial = true): boolean {
  const [inView, setInView] = useState(initial);

  useEffect(() => {
    const elements = refs.map((r) => r.current).filter((el): el is Element => Boolean(el));
    if (elements.length === 0 || typeof IntersectionObserver === "undefined") return;
    const visible = new Map<Element, boolean>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) visible.set(entry.target, entry.isIntersecting);
      setInView([...visible.values()].some(Boolean));
    });
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
    // ref obyektlari barqaror — faqat mount paytida ulanadi
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return inView;
}
