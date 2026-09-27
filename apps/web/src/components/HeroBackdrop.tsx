import React from "react";

// Sekin ko'tarilib turuvchi porloq uchqunlar (pozitsiya/tezlik/kechikish oldindan)
const PARTICLES = [
  { left: "6%", size: 5, delay: 0, dur: 11, color: "gold" },
  { left: "18%", size: 4, delay: 3.5, dur: 13, color: "blue" },
  { left: "32%", size: 5, delay: 6.5, dur: 10, color: "gold" },
  { left: "47%", size: 3, delay: 1.5, dur: 14, color: "blue" },
  { left: "61%", size: 5, delay: 8, dur: 11, color: "gold" },
  { left: "74%", size: 4, delay: 4.5, dur: 12, color: "blue" },
  { left: "86%", size: 5, delay: 2, dur: 10, color: "gold" },
  { left: "94%", size: 3, delay: 6, dur: 13, color: "blue" },
] as const;

/**
 * Jonli mesh-gradient fon: indigo, binafsha va pushti blob'lar keng
 * amplitudada suzadi, donador tekstura "materiallik" beradi. Butun qatlam
 * pastga qarab fonga singiydi (mask) — bo'lim chegarasida chok qolmaydi.
 * Faqat transform/opacity — GPU'da yengil. Ota element `relative overflow-hidden`.
 * `variant="soft"` — auth sahifalar uchun yengilroq (kichik blob, kam uchqun).
 */
export function HeroBackdrop({ variant = "full" }: { variant?: "full" | "soft" }) {
  const full = variant === "full";
  const particles = full ? PARTICLES : PARTICLES.slice(0, 3);
  return (
    <div className="hero-backdrop pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {/* Qorishma blob'lar — katta, sekin, ko'rkam suzadi */}
      <div className="orb orb-blue orb-glow drift-b right-[-6%] top-[-12%] h-[30rem] w-[30rem]" />
      <div
        className="orb orb-gold orb-glow drift-a left-[-8%] top-[18%] h-[26rem] w-[26rem]"
        style={{ animationDelay: "-6s" }}
      />
      {full && (
        <div
          className="orb orb-rose orb-glow drift-c bottom-[-18%] left-[30%] h-[24rem] w-[24rem]"
          style={{ animationDelay: "-3s" }}
        />
      )}

      {/* Donador tekstura — gradientlar ustidan premium qatlam */}
      <div className="grain absolute inset-0" />

      {/* Porloq uchqunlar */}
      {particles.map((pt, i) => (
        <span
          key={i}
          className={`particle ${pt.color === "gold" ? "particle-gold" : "particle-blue"}`}
          style={{
            left: pt.left,
            width: pt.size,
            height: pt.size,
            animationDelay: `${pt.delay}s`,
            animationDuration: `${pt.dur}s`,
          }}
        />
      ))}
    </div>
  );
}
