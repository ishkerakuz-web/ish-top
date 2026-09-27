import React from "react";

/**
 * Maqolalar ikonkalari — mavjud to'plam bilan bir uslubda (24px grid, 1.8 chiziq,
 * `currentColor`, dekorativ). Umumiylari qayta eksport qilinadi.
 */
export { IconAlert, IconArrowRight, IconRefresh, IconX } from "../profile/icons.js";
export { IconSearch, IconChevronLeft, IconChevronRight, Spinner } from "../companies/icons.js";
export { IconClock, IconCalendar } from "../vacancies/icons.js";
export { IconShare, IconLink } from "../vacancies/detail/icons.js";

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

export const IconArticle = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4" y="3.5" width="16" height="17" rx="2.5" />
    <path d="M8 8h8M8 12h8M8 16h5" />
  </Svg>
);

export const IconLightbulb = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 18h6M10 21h4" />
    <path d="M12 3a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.3 1.1 2.2h5c0-.9.4-1.7 1.1-2.2A6 6 0 0 0 12 3Z" />
  </Svg>
);

export const IconQuote = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9.5 7H6.8A1.8 1.8 0 0 0 5 8.8v2.4A1.8 1.8 0 0 0 6.8 13H9v1.5A2.5 2.5 0 0 1 6.5 17M18.5 7h-2.7A1.8 1.8 0 0 0 14 8.8v2.4a1.8 1.8 0 0 0 1.8 1.8H18v1.5a2.5 2.5 0 0 1-2.5 2.5" />
  </Svg>
);

export const IconThumbUp = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7.5 10.5v9H5a1.5 1.5 0 0 1-1.5-1.5v-6A1.5 1.5 0 0 1 5 10.5h2.5Zm0 0 3.6-6.3a1.6 1.6 0 0 1 2.9 1.2l-.8 3.6h4.9a2 2 0 0 1 2 2.4l-1.2 6.2a2 2 0 0 1-2 1.9H7.5" />
  </Svg>
);

export const IconThumbDown = (p: IconProps) => (
  <Svg {...p}>
    <path d="M16.5 13.5v-9H19a1.5 1.5 0 0 1 1.5 1.5v6a1.5 1.5 0 0 1-1.5 1.5h-2.5Zm0 0-3.6 6.3a1.6 1.6 0 0 1-2.9-1.2l.8-3.6H5.9a2 2 0 0 1-2-2.4l1.2-6.2a2 2 0 0 1 2-1.9h9.4" />
  </Svg>
);

export const IconTag = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3.5 12.1V5A1.5 1.5 0 0 1 5 3.5h7.1a1.5 1.5 0 0 1 1.06.44l7 7a1.5 1.5 0 0 1 0 2.12l-7.1 7.1a1.5 1.5 0 0 1-2.12 0l-7-7a1.5 1.5 0 0 1-.44-1.06Z" />
    <circle cx="8.5" cy="8.5" r="1.3" />
  </Svg>
);

export const IconToc = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 6.5h11M9 12h11M12 17.5h8" />
    <path d="M4.5 6.5h.01M4.5 12h.01M7.5 17.5h.01" strokeWidth={2.6} />
  </Svg>
);

export const IconCheck = (p: IconProps) => (
  <Svg {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Svg>
);
