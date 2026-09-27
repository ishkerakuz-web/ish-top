import React from "react";

/**
 * Maosh sahifasi ikonkalari — profil/katalog to'plami bilan bir uslubda
 * (24px grid, 1.8 chiziq, `currentColor`, dekorativ).
 */
export {
  IconArrowRight,
  IconHeart,
  IconPin,
  IconRefresh,
  IconAlert,
  IconX,
  IconBriefcase,
  IconCap,
} from "../profile/icons.js";
export { IconSearch, IconChevronDown, IconChevronRight, IconUsers, IconBuilding, Spinner } from "../companies/icons.js";

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

export const IconChartBars = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3.5 20.5h17" />
    <rect x="5.5" y="12" width="3" height="6" rx="1" />
    <rect x="10.5" y="8" width="3" height="10" rx="1" />
    <rect x="15.5" y="4" width="3" height="14" rx="1" />
  </Svg>
);

export const IconTrendUp = (p: IconProps) => (
  <Svg {...p}>
    <path d="m3.5 16.5 5.5-5.5 4 4 7-7.5" />
    <path d="M15 7.5h5v5" />
  </Svg>
);

export const IconArrowUp = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 19V5M6 11l6-6 6 6" />
  </Svg>
);

export const IconWallet = (p: IconProps) => (
  <Svg {...p}>
    <path d="M18.5 7.5V6a2 2 0 0 0-2-2H6a2.5 2.5 0 0 0 0 5h13a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 19 20H6a2.5 2.5 0 0 1-2.5-2.5v-11" />
    <path d="M16.5 14.5h.01" />
  </Svg>
);

export const IconRange = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 12h16" />
    <path d="m7.5 8.5-3.5 3.5 3.5 3.5M16.5 8.5l3.5 3.5-3.5 3.5" />
  </Svg>
);

export const IconCode = (p: IconProps) => (
  <Svg {...p}>
    <path d="m8.5 7.5-5 4.5 5 4.5M15.5 7.5l5 4.5-5 4.5M13.5 5l-3 14" />
  </Svg>
);

export const IconPenTool = (p: IconProps) => (
  <Svg {...p}>
    <path d="m12 19.5 7.5-7.5-3-3L9 16.5z" />
    <path d="m16.5 9-1.5-5.5L4 6.5l2.5 11 5.5 1.5" />
    <path d="m4 6.5 5 5" />
    <circle cx="10.5" cy="12.5" r="1.5" />
  </Svg>
);

export const IconMegaphone = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 10v4a1 1 0 0 0 1 1h2.5l6 4V5l-6 4H5a1 1 0 0 0-1 1z" />
    <path d="M17 9a4 4 0 0 1 0 6M8 15l1.2 4.5" />
  </Svg>
);

export const IconCalculator = (p: IconProps) => (
  <Svg {...p}>
    <rect x="5" y="3" width="14" height="18" rx="2" />
    <path d="M8.5 7h7M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01M8.5 15h.01M12 15h.01M8.5 18.5h.01M12 18.5h.01M15.5 15v3.5" />
  </Svg>
);

export const IconTarget = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="5" />
    <circle cx="12" cy="12" r="1.5" />
  </Svg>
);

export const IconPieChart = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20.5 13A8.5 8.5 0 1 1 11 3.5" />
    <path d="M14 3.2A7.5 7.5 0 0 1 20.8 10H14z" />
  </Svg>
);
