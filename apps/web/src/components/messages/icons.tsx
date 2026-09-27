import React from "react";

export { IconAlert, IconArrowLeft, IconArrowRight, IconBriefcase, IconPin, IconRefresh, IconSend, IconX } from "../profile/icons.js";
export { IconBuilding, IconSearch, IconStar, IconVerified, Spinner } from "../companies/icons.js";
export { IconChat, IconInfo, IconWallet } from "../applications/icons.js";
export { IconClock } from "../vacancies/icons.js";
export { IconLink } from "../vacancies/detail/icons.js";
export { EmploymentIcon } from "../favorites/icons.js";

type IconProps = { size?: number; className?: string };

/** Telegram uslubidagi belgi: bitta — yuborildi, ikkita — o'qildi (faqat server holati bo'lsa). */
export const IconTicks = ({ read, size = 16, className = "" }: IconProps & { read: boolean }) => (
  <svg width={size} height={Math.round(size * 0.75)} viewBox="0 0 20 15" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    {read ? (
      <>
        <path d="M1.5 8 5 11.5 12 4" />
        <path d="M9 11.5 16 4" />
      </>
    ) : (
      <path d="M4 8l3.5 3.5L15 4" />
    )}
  </svg>
);

export const IconExternal = ({ size = 16, className = "" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <path d="M14 4h6v6" />
    <path d="M20 4 11 13" />
    <path d="M18 14v4.5A1.5 1.5 0 0 1 16.5 20h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10" />
  </svg>
);

/** Ikki pufak — bo'sh holatlar uchun. */
export const IconChats = ({ size = 28, className = "" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <path d="M14.5 3.5h5A1.5 1.5 0 0 1 21 5v5.5A1.5 1.5 0 0 1 19.5 12H18v2.5L15 12h-2" />
    <path d="M4.5 7.5h9A1.5 1.5 0 0 1 15 9v6.5a1.5 1.5 0 0 1-1.5 1.5H9l-3.5 3v-3h-1A1.5 1.5 0 0 1 3 15.5V9a1.5 1.5 0 0 1 1.5-1.5Z" />
    <path d="M6.5 11.5h5M6.5 14h3" />
  </svg>
);
