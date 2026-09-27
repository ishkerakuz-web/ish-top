import React from "react";
import type { EmploymentType } from "../../lib/types.js";
import { IconBriefcase } from "../profile/icons.js";
import { IconClock } from "../vacancies/icons.js";

/** Saqlanganlar sahifasi ikonkalari — mavjud to'plamlar bilan bir uslubda (24px grid, 1.8 chiziq, dekorativ). */
export { IconAlert, IconArrowRight, IconBell, IconBriefcase, IconEye, IconFile, IconHeart, IconPin, IconRefresh, IconUser, IconX } from "../profile/icons.js";
export { IconBuilding, IconSearch, IconVerified } from "../companies/icons.js";
export { IconClock } from "../vacancies/icons.js";
export { IconWallet } from "../applications/icons.js";

type IconProps = { size?: number; className?: string };

function Svg({ size = 20, className = "", filled = false, children }: IconProps & { filled?: boolean; children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {children}
    </svg>
  );
}

/** Masofaviy ish. */
export const IconHome = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 10.5L12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-3.5v-6h-6v6H5.5A1.5 1.5 0 0 1 4 19v-8.5z" />
  </Svg>
);

/** Smenali ish — aylanma. */
export const IconShift = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20 12a8 8 0 0 1-13.7 5.6M4 12a8 8 0 0 1 13.7-5.6" />
    <path d="M18 3v3.6h-3.6M6 21v-3.6h3.6" />
  </Svg>
);

/** Saqlangan (faol) bookmark. */
export const IconBookmarkFilled = (p: IconProps) => (
  <Svg {...p} filled>
    <path d="M6.5 3.5h11a1 1 0 0 1 1 1v16l-6.5-4.2-6.5 4.2v-16a1 1 0 0 1 1-1z" />
  </Svg>
);

const EMPLOYMENT_ICON: Record<EmploymentType, (p: IconProps) => React.ReactElement> = {
  remote: IconHome,
  full_time: IconBriefcase,
  part_time: IconClock,
  shift: IconShift,
};

export function EmploymentIcon({ type, size = 16, className }: { type: EmploymentType; size?: number; className?: string }) {
  const Icon = EMPLOYMENT_ICON[type];
  return <Icon size={size} className={className} />;
}
