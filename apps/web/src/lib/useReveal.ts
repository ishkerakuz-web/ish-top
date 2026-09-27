import { useEffect, useRef } from "react";

/**
 * Scroll-reveal: element ko'rinish maydoniga kirganda yumshoq fade-up bo'ladi.
 *
 * Performance uchun muhim: SSR HTML'da element KO'RINGAN holda chiqadi
 * (LCP darhol qayd etiladi, JS'siz ham kontent ko'rinadi). JS yuklangach
 * faqat hali ekrandan PASTDA turgan elementlar yashiriladi va scroll'da ochiladi.
 *
 * "Element qayerda?" degan savolga IntersectionObserver'ning O'Z hisoboti javob
 * beradi — getBoundingClientRect() ishlatilmaydi. getBoundingClientRect() effekt
 * ichida chaqirilsa brauzerni majburiy reflow'ga soladi (Lighthouse: "Forced
 * reflow"), sahifada o'nlab kartochka bo'lsa bu bir necha ms qimmatga tushadi.
 * IO esa geometriyani kadr chegarasida, layout'ni buzmasdan o'lchaydi.
 */
export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    let first = true;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        if (first) {
          first = false;
          // Birinchi hisobot — element allaqachon ko'rinishda yoki ekrandan
          // yuqorida bo'lsa, tegmaymiz (yashirib-ochish miltillashi bo'lmasin).
          // boundingClientRect IO tomonidan o'lchab berilgan — reflow yo'q.
          if (entry.isIntersecting || entry.boundingClientRect.top < 0) {
            io.disconnect();
            return;
          }
          el.classList.add("reveal-pending");
          return;
        }
        if (entry.isIntersecting) {
          el.classList.add("reveal-in");
          el.classList.remove("reveal-pending");
          io.disconnect();
        }
      },
      { rootMargin: "-40px 0px" },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      el.classList.remove("reveal-pending");
    };
  }, []);
  return ref;
}
