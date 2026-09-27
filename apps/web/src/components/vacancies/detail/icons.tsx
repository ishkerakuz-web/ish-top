import React from "react";

/**
 * Vakansiya detail ikonkalari — profil/katalog to'plami bilan bir uslubda
 * (24px grid, 1.8 chiziq, `currentColor`, dekorativ). Umumiylari qayta eksport.
 */
export {
  IconHeart,
  IconCheck,
  IconCheckCircle,
  IconMail,
  IconPhone,
  IconTelegram,
  IconGlobe,
  IconEye,
  IconSpark,
  IconFile,
} from "../../profile/icons.js";
export {
  IconBriefcase,
  IconPin,
  IconX,
  IconArrowRight,
  IconRefresh,
  IconAlert,
  IconChevronLeft,
  IconChevronRight,
  IconVerified,
  Spinner,
  IconClock,
  IconCalendar,
} from "../icons.js";
export { IconStar, IconUsers } from "../../companies/icons.js";

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

export const IconShare = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="18" cy="5.5" r="2.5" />
    <circle cx="6" cy="12" r="2.5" />
    <circle cx="18" cy="18.5" r="2.5" />
    <path d="m8.2 10.8 7.6-4.1M8.2 13.2l7.6 4.1" />
  </Svg>
);

export const IconLink = (p: IconProps) => (
  <Svg {...p}>
    <path d="M10 14a4.5 4.5 0 0 0 6.4 0l2.8-2.8a4.5 4.5 0 0 0-6.4-6.4L11.5 6" />
    <path d="M14 10a4.5 4.5 0 0 0-6.4 0l-2.8 2.8a4.5 4.5 0 0 0 6.4 6.4l1.3-1.2" />
  </Svg>
);

export const IconFlag = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5.5 20.5v-16M5.5 4.5h11l-2 4 2 4h-11" />
  </Svg>
);

export const IconImages = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="5" width="17" height="14" rx="2.5" />
    <circle cx="9" cy="10" r="1.6" />
    <path d="m20.5 15.5-4.8-4.8L7 19" />
  </Svg>
);

export const IconClipboardCheck = (p: IconProps) => (
  <Svg {...p}>
    <rect x="5" y="4.5" width="14" height="16" rx="2.2" />
    <path d="M9 4.5V3.8c0-.7.6-1.3 1.3-1.3h3.4c.7 0 1.3.6 1.3 1.3v.7M9 12.5l2 2 4-4" />
  </Svg>
);

export const IconFacebook = ({ size = 18, className = "" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
    <path
      fill="currentColor"
      d="M13.5 21v-7.5h2.5l.4-3h-2.9V8.6c0-.87.25-1.46 1.5-1.46h1.55V4.47a20.6 20.6 0 0 0-2.25-.12c-2.25 0-3.8 1.37-3.8 3.9v2.25H8v3h2.5V21h3Z"
    />
  </svg>
);

export const IconLinkedIn = ({ size = 18, className = "" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
    <path
      fill="currentColor"
      d="M6.94 8.5H3.56V20h3.38V8.5ZM5.25 3a1.96 1.96 0 1 0 0 3.92 1.96 1.96 0 0 0 0-3.92Zm15.19 10.4c0-3.1-.66-5.2-4.26-5.2-1.73 0-2.9.95-3.37 1.85h-.05V8.5H9.52V20h3.37v-5.7c0-1.5.28-2.95 2.14-2.95 1.83 0 1.86 1.72 1.86 3.05V20h3.55v-6.6Z"
    />
  </svg>
);

export const IconXBrand = ({ size = 18, className = "" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
    <path
      fill="currentColor"
      d="M17.75 3h3.07l-6.7 7.66L22 21h-6.17l-4.83-6.32L5.47 21H2.4l7.17-8.2L2 3h6.33l4.37 5.78L17.75 3Zm-1.08 16.2h1.7L7.4 4.74H5.58L16.67 19.2Z"
    />
  </svg>
);
