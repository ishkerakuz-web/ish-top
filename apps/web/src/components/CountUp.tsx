import React, { useEffect, useRef, useState } from "react";

/** Ko'rinish maydoniga kirganda 0 dan qiymatgacha sanaydi (IO + rAF, kutubxonasiz). */
export function CountUp({ value, suffix = "" }: { value: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  // SSR va birinchi paint'da YAKUNIY qiymat ko'rinadi (LCP kechikmaydi, JS'siz ham
  // to'g'ri raqam). Animatsiya faqat element ko'ringanda 0 dan boshlab yuradi.
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    let raf = 0;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        io.disconnect();
        const start = performance.now();
        const duration = 1400;
        const tick = (now: number) => {
          const p = Math.min((now - start) / duration, 1);
          const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
          setDisplay(Math.round(eased * value));
          if (p < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { rootMargin: "-10%" },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value]);

  return (
    <span ref={ref} className="font-mono">
      {new Intl.NumberFormat("ru-RU").format(display)}
      {suffix}
    </span>
  );
}
