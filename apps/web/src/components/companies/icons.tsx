import React from "react";

/**
 * Katalog ikonkalari — profil ikonkalari bilan bir uslubda (24px grid, 1.8 chiziq,
 * `currentColor`, dekorativ). Umumiylari profil to'plamidan qayta eksport qilinadi.
 */
export {
  IconBriefcase,
  IconPin,
  IconHeart,
  IconX,
  IconArrowRight,
  IconRefresh,
  IconAlert,
  IconGrid,
} from "../profile/icons.js";

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

export const IconSearch = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4.2-4.2" />
  </Svg>
);

export const IconSliders = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
    <circle cx="15" cy="7" r="2" />
    <circle cx="9" cy="17" r="2" />
  </Svg>
);

export const IconList = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 6.5h11M9 12h11M9 17.5h11" />
    <circle cx="4.75" cy="6.5" r="0.9" fill="currentColor" />
    <circle cx="4.75" cy="12" r="0.9" fill="currentColor" />
    <circle cx="4.75" cy="17.5" r="0.9" fill="currentColor" />
  </Svg>
);

export const IconBuilding = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4.5 20.5V5A1.5 1.5 0 0 1 6 3.5h7A1.5 1.5 0 0 1 14.5 5v15.5M14.5 9.5H18A1.5 1.5 0 0 1 19.5 11v9.5M3 20.5h18" />
    <path d="M8 7.5h3M8 11h3M8 14.5h3M17 13.5v.01M17 17v.01" />
  </Svg>
);

export const IconUsers = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="9" cy="8.5" r="3.2" />
    <path d="M3.5 19.5a5.5 5.5 0 0 1 11 0M15.5 5.6a3.2 3.2 0 0 1 0 5.8M17.5 14.2a5.5 5.5 0 0 1 3 5.3" />
  </Svg>
);

export const IconChevronLeft = (p: IconProps) => (
  <Svg {...p}>
    <path d="m14.5 6-6 6 6 6" />
  </Svg>
);

export const IconChevronRight = (p: IconProps) => (
  <Svg {...p}>
    <path d="m9.5 6 6 6-6 6" />
  </Svg>
);

export const IconChevronDown = (p: IconProps) => (
  <Svg {...p}>
    <path d="m6 9.5 6 6 6-6" />
  </Svg>
);

/** To'ldirilgan yulduz — reyting uchun (rang `text-gold`). */
export const IconStar = ({ size = 16, className = "" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
    <path
      fill="currentColor"
      d="M12 2.8l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.6l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8L12 2.8z"
    />
  </svg>
);

/** Tasdiqlangan kompaniya belgisi (to'ldirilgan). */
export const IconVerified = ({ size = 16, className = "" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
    <path
      fill="currentColor"
      d="M12 1.8l2.6 1.9 3.2-.1 1 3 2.6 1.9-1 3 1 3.1-2.6 1.8-1 3.1-3.2-.1L12 21.2l-2.6-1.8-3.2.1-1-3.1L2.6 14.6l1-3.1-1-3 2.6-1.9 1-3 3.2.1L12 1.8z"
    />
    <path d="m8.2 12.2 2.5 2.5 5.1-5.3" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const Spinner = ({ size = 18, className = "" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={`animate-spin ${className}`} aria-hidden>
    <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
    <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
);
