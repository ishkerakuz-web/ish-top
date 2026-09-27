import React, { useState } from "react";

// Brendga mos gradient juftliklari — indigo oilasi asosida, kartalar ro'yxatda
// rang-barang lekin bir uslubda ko'rinsin. Oq harf har birida AA kontrastdan o'tadi.
const PALETTES: [string, string][] = [
  ["#4F46E5", "#7C3AED"],
  ["#2563EB", "#4F46E5"],
  ["#0E7490", "#0891B2"],
  ["#047857", "#059669"],
  ["#B45309", "#D97706"],
  ["#BE185D", "#DB2777"],
  ["#6D28D9", "#9333EA"],
  ["#1D4ED8", "#0284C7"],
  ["#B91C1C", "#E11D48"],
  ["#0F766E", "#0D9488"],
];

function hashName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h;
}

/** "Payla Fintech" -> "PF", "NextBrain" -> "N". */
function initials(name: string): string {
  const words = name.replace(/["'’ʻ]/g, "").split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const letters = words.length > 1 ? words[0][0] + words[1][0] : words[0][0];
  return letters.toUpperCase();
}

const SIZES = {
  xs: "h-8 w-8 rounded-lg text-[11px]",
  sm: "h-10 w-10 rounded-xl text-sm",
  md: "h-14 w-14 rounded-2xl text-lg",
  lg: "h-16 w-16 rounded-2xl text-xl",
  xl: "h-[88px] w-[88px] rounded-3xl text-[26px]",
} as const;

/**
 * Kompaniya logosi. Rasm bo'lsa — oq plashkada (logolar odatda och fon uchun
 * chiziladi, tungi rejimda ham shunday). Rasm yo'q yoki yuklanmasa — nomdan
 * barqaror rang tanlangan bosh harfli belgi.
 */
export function CompanyLogo({ name, src, size = "md" }: { name: string; src?: string | null; size?: keyof typeof SIZES }) {
  const [failed, setFailed] = useState(false);
  const box = SIZES[size];

  if (src && !failed) {
    return (
      <span className={`flex shrink-0 items-center justify-center overflow-hidden border border-line bg-white p-1.5 ${box}`}>
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="h-full w-full object-contain"
        />
      </span>
    );
  }

  const [from, to] = PALETTES[hashName(name) % PALETTES.length];
  return (
    <span
      aria-hidden
      style={{ backgroundImage: `linear-gradient(135deg, ${from}, ${to})` }}
      className={`relative flex shrink-0 select-none items-center justify-center overflow-hidden font-display font-bold tracking-tight text-white shadow-xs ${box}`}
    >
      {/* yumshoq yorug'lik — tekis rang "placeholder"dek ko'rinmasin */}
      <span className="pointer-events-none absolute -right-3 -top-4 h-10 w-10 rounded-full bg-white/20 blur-md" />
      <span className="relative">{initials(name)}</span>
    </span>
  );
}
