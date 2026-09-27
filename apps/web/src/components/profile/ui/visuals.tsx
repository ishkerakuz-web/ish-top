import React, { useEffect, useId, useState } from "react";
import { absoluteUploadUrl } from "../../../lib/api.js";

/** Bo'sh holat, xato holati va ariza belgisi. */


/** Kompaniya avatari va progress ko'rsatkichlari. */

const AVATAR_HUES = [
  { bg: "rgb(59 130 246 / 0.12)", fg: "#2563EB" },
  { bg: "rgb(16 185 129 / 0.13)", fg: "#059669" },
  { bg: "rgb(245 158 11 / 0.15)", fg: "#B45309" },
  { bg: "rgb(139 92 246 / 0.13)", fg: "#7C3AED" },
  { bg: "rgb(236 72 153 / 0.12)", fg: "#DB2777" },
];


/** Kompaniya avatari, doiraviy va chiziqli progress. */

export function CompanyAvatar({
  name,
  logoUrl,
  size = 44,
}: {
  name: string;
  logoUrl?: string | null;
  size?: number;
}) {
  const [broken, setBroken] = useState(false);
  const hash = Array.from(name).reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const hue = AVATAR_HUES[hash % AVATAR_HUES.length];
  const style = { width: size, height: size };

  if (logoUrl && !broken) {
    return (
      <img
        src={absoluteUploadUrl(logoUrl)}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        onError={() => setBroken(true)}
        style={style}
        className="shrink-0 rounded-xl border border-line bg-surface object-contain p-1"
      />
    );
  }
  return (
    <span
      aria-hidden
      style={{ ...style, background: hue.bg, color: hue.fg }}
      className="flex shrink-0 items-center justify-center rounded-xl font-display text-[15px] font-bold"
    >
      {(name.trim().charAt(0) || "?").toUpperCase()}
    </span>
  );
}

/** Aylana progress. Birinchi chizishda 0 dan qiymatgacha yumshoq to'ladi. */
export function ProgressRing({
  value,
  size = 56,
  stroke = 6,
  children,
  label,
}: {
  value: number;
  size?: number;
  stroke?: number;
  children?: React.ReactNode;
  label?: string;
}) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(value));
    return () => cancelAnimationFrame(frame);
  }, [value]);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(100, Math.max(0, shown)) / 100) * c;
  const gradientId = useId();

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      aria-label={label}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#6366F1" />
            <stop offset="100%" stopColor="#8B5CF6" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--line))" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={value >= 100 ? "rgb(var(--growth))" : `url(#${gradientId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.9s cubic-bezier(0.22, 1, 0.36, 1)" }}
        />
      </svg>
      {children && <div className="absolute inset-0 flex items-center justify-center">{children}</div>}
    </div>
  );
}

export function ProgressBar({ value, label }: { value: number; label?: string }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(value));
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-line/70"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      aria-label={label}
    >
      <div
        className={`h-full rounded-full ${value >= 100 ? "bg-growth" : "bg-gradient-to-r from-signal to-[#8B5CF6]"}`}
        style={{ width: `${shown}%`, transition: "width 0.9s cubic-bezier(0.22, 1, 0.36, 1)" }}
      />
    </div>
  );
}

/** Profil ichidagi bo'limga havola: oddiy `<a>` (yangi tabda ochiladi), bosilganda SPA almashinuv. */
