import React from "react";

/**
 * Haqiqiy ISH BOR! logosi (public/logo.png).
 *
 * Yangi identitetda logo "yulduz" emas, muhr: sayt palitrasi logoning o'z
 * oltin-sarig'idan qurilgani uchun u endi bezaksiz ham uyg'un turadi.
 * - "nav":  kichik, sokin ramkada; hover'da yengil jonlanadi
 * - "hero": kattaroq, faqat yumshoq nafas oluvchi amber nur bilan
 *           (avvalgi puls halqalari va orbita olib tashlangan — ortiqcha shovqin edi)
 */
export function BrandLogo({
  variant = "nav",
  className = "",
}: {
  variant?: "nav" | "hero";
  className?: string;
}) {
  if (variant === "nav") {
    return (
      <span className={`relative inline-flex ${className}`}>
        <img
          // 108px WebP — 32px @3x uchun yetarli (512px/207KB o'rniga ~3KB).
          src="/logo-108.webp"
          // Yonida "ISH BOR!" wordmark bor — logo dekorativ (alt bo'sh),
          // skrinrider matnni ikki marta o'qimaydi.
          alt=""
          width={32}
          height={32}
          decoding="async"
          className="h-8 w-8 rounded-lg object-cover ring-1 ring-line transition-transform duration-300 group-hover:scale-105 [aspect-ratio:1/1]"
        />
      </span>
    );
  }

  return (
    <span className={`relative inline-flex ${className}`} aria-hidden>
      {/* Yumshoq nafas oluvchi amber nur — yagona bezak */}
      <span className="breathe absolute -inset-3 rounded-2xl bg-[radial-gradient(circle,rgb(240_180_40/0.3),transparent_70%)] blur-lg" />
      <img
        // 256px WebP — 96/112px displey uchun @2x
        src="/logo-256.webp"
        alt="ISH BOR!"
        width={112}
        height={112}
        decoding="async"
        className="relative h-24 w-24 rounded-2xl object-cover ring-1 ring-line sm:h-28 sm:w-28"
      />
    </span>
  );
}
