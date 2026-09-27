import React from "react";

/** Admin (kontent boshqaruvi) ikonkalari — umumiy to'plam uslubida (24px, 1.8 chiziq). */
export { IconEye, IconPlus, IconSend } from "../profile/icons.js";
export { IconAlert, IconArrowRight, IconRefresh, IconX } from "../profile/icons.js";
export { IconSearch, Spinner, IconChevronLeft } from "../companies/icons.js";
export { IconArticle, IconLightbulb, IconQuote, IconCheck, IconLink } from "../articles/icons.js";

type IconProps = { size?: number; className?: string };

function Svg({ size = 18, className = "", children }: IconProps & { children: React.ReactNode }) {
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

export const IconEdit = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 20h4L19.2 8.8a2.3 2.3 0 0 0-3.2-3.2L4.8 16.8 4 20Z" />
    <path d="m14.5 7 2.5 2.5" />
  </Svg>
);

export const IconExternal = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14 4.5h5.5V10M19.5 4.5 11 13" />
    <path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />
  </Svg>
);

export const IconUndo = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 8H5V4" />
    <path d="M5.3 8A7.5 7.5 0 1 1 4.5 12" />
  </Svg>
);

export const IconGlobe = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M3.5 12h17M12 3.5c2.3 2.4 3.5 5.2 3.5 8.5s-1.2 6.1-3.5 8.5c-2.3-2.4-3.5-5.2-3.5-8.5S9.7 5.9 12 3.5Z" />
  </Svg>
);

export const IconEyeOff = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 3l18 18" />
    <path d="M10.6 5.6A9.7 9.7 0 0 1 12 5.5c5 0 8.5 4.2 9.5 6.5a12 12 0 0 1-2.6 3.6M6.4 6.9C4.4 8.2 3.1 10.3 2.5 12c1 2.3 4.5 6.5 9.5 6.5 1.6 0 3-.4 4.2-1" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
  </Svg>
);

export const IconArchive = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="4" width="17" height="4.5" rx="1.2" />
    <path d="M5 8.5v9.5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5M10 12.5h4" />
  </Svg>
);

export const IconTrash = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4.5 7h15M9.5 7V5a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 14.5 5v2M6.5 7l.8 11.5A2 2 0 0 0 9.3 20.5h5.4a2 2 0 0 0 2-2L17.5 7" />
  </Svg>
);

export const IconImage = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="5" width="17" height="14" rx="2.5" />
    <circle cx="9" cy="10" r="1.6" />
    <path d="m20.5 15.5-4.8-4.8L7 19" />
  </Svg>
);

export const IconUpload = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 15.5V4.5M7.5 9 12 4.5 16.5 9" />
    <path d="M4.5 15v2.5a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V15" />
  </Svg>
);

export const IconUserPlus = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="9.5" cy="8.5" r="3.5" />
    <path d="M3.5 19.5a6 6 0 0 1 12 0M18.5 8v6M15.5 11h6" />
  </Svg>
);

export const IconCopy = (p: IconProps) => (
  <Svg {...p}>
    <rect x="8.5" y="8.5" width="11" height="11" rx="2" />
    <path d="M15.5 8.5V6.5a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2" />
  </Svg>
);

/* ---- Matn muharriri asboblar paneli ---- */

export const IconBold = (p: IconProps) => (
  <Svg {...p} >
    <path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z" strokeWidth={2.2} />
  </Svg>
);

export const IconItalic = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14 5h-4M14 19h-4M13.5 5l-3 14" />
  </Svg>
);

export const IconListBullet = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9.5 6.5h10M9.5 12h10M9.5 17.5h10" />
    <path d="M4.75 6.5h.01M4.75 12h.01M4.75 17.5h.01" strokeWidth={2.8} />
  </Svg>
);

export const IconListNumber = (p: IconProps) => (
  <Svg {...p}>
    <path d="M10 6.5h9.5M10 12h9.5M10 17.5h9.5" />
    <path d="M4 5.5 5.5 4.5v4M4 11.2a1.3 1.3 0 1 1 2.3.8L4 14h2.6M4 16.4h2.4l-1.2 1.4a1.1 1.1 0 1 1-1.2 1.6" strokeWidth={1.4} />
  </Svg>
);

export const IconDivider = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3.5 12h17" />
    <path d="M7 6.5h10M7 17.5h10" strokeOpacity={0.45} />
  </Svg>
);

export function IconHeading({ level, size = 18, className = "" }: IconProps & { level: 2 | 3 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      <text x="1.5" y="17.5" fontFamily="inherit" fontSize="14" fontWeight="700" fill="currentColor">
        H{level}
      </text>
    </svg>
  );
}
