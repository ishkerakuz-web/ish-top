import React from "react";

/**
 * Vakansiyalar sahifasi ikonkalari — profil/katalog to'plami bilan bir uslubda
 * (24px grid, 1.8 chiziq, `currentColor`, dekorativ).
 */
export { IconBriefcase, IconPin, IconX, IconArrowRight, IconRefresh, IconAlert } from "../profile/icons.js";
export {
  IconSearch,
  IconSliders,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconVerified,
  IconBuilding,
  Spinner,
} from "../companies/icons.js";

type IconProps = { size?: number; className?: string };

function Svg({ size = 20, className = "", children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
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

export const IconClock = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Svg>
);

export const IconCalendar = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </Svg>
);

export const IconBookmark = ({ size = 20, className = "", filled = false }: IconProps & { filled?: boolean }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={filled ? "currentColor" : "none"}
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinejoin="round"
    className={className}
    aria-hidden
  >
    <path d="M6.5 3.5h11A1.5 1.5 0 0 1 19 5v15.5l-7-4.4-7 4.4V5a1.5 1.5 0 0 1 1.5-1.5z" />
  </svg>
);
