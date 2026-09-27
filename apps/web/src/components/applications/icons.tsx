import React from "react";

/** Arizalar sahifasi ikonkalari — mavjud to'plamlar bilan bir uslubda (24px grid, 1.8 chiziq, dekorativ). */
export {
  IconSend,
  IconArrowRight,
  IconX,
  IconAlert,
  IconRefresh,
  IconBriefcase,
  IconPin,
  IconUser,
  IconFile,
  IconBell,
  IconCheckCircle,
  IconEye,
} from "../profile/icons.js";
export { IconSearch, IconVerified, IconChevronLeft, IconChevronRight, IconBuilding } from "../companies/icons.js";
export { IconClock } from "../vacancies/icons.js";

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

export const IconMore = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="5.5" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="12" cy="18.5" r="1.3" fill="currentColor" stroke="none" />
  </Svg>
);

export const IconXCircle = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M15 9l-6 6M9 9l6 6" />
  </Svg>
);

/** Suhbat — belgilangan kun. */
export const IconInterview = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
    <path d="M9.2 14.6l1.9 1.9 3.8-3.8" />
  </Svg>
);

export const IconWallet = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="6" width="18" height="13" rx="2.5" />
    <path d="M3 10h18M16 14.5h2" />
  </Svg>
);

export const IconChat = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 5h16v11H8l-4 4V5z" />
  </Svg>
);

export const IconStack = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3l9 5-9 5-9-5 9-5z" />
    <path d="M3 13l9 5 9-5" />
  </Svg>
);

export const IconInfo = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 7.8h.01" />
  </Svg>
);

export const IconTrophy = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 4h10v5a5 5 0 0 1-10 0V4z" />
    <path d="M7 6H4.5a2.5 2.5 0 0 0 2.9 3.9M17 6h2.5a2.5 2.5 0 0 1-2.9 3.9M12 14v3M9.5 17h5v3h-5z" />
  </Svg>
);

export const IconHeadset = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
    <rect x="3" y="13" width="4" height="6" rx="1.5" />
    <rect x="17" y="13" width="4" height="6" rx="1.5" />
    <path d="M19 19a3 3 0 0 1-3 3h-3" />
  </Svg>
);

export const IconChart = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 20h16M7 16v-5M12 16V7M17 16v-8" />
  </Svg>
);
