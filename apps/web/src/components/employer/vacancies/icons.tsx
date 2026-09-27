import React from "react";

/** Vakansiyalar dashboard'i ikonkalari — mavjud to'plamlardan (24px grid, 1.8 chiziq) + bir nechta yangisi. */
export {
  IconBriefcase,
  IconPlus,
  IconPencil,
  IconTrash,
  IconEye,
  IconFile,
  IconAlert,
  IconRefresh,
  IconArrowLeft,
  IconX,
  IconCheckCircle,
} from "../../profile/icons.js";
export { IconSearch, IconUsers, Spinner } from "../../companies/icons.js";
export { IconCalendar, IconClock } from "../../vacancies/icons.js";
export { IconXCircle } from "../../applications/icons.js";
// Vakansiya formasi
export { IconMail, IconPhone, IconTelegram, IconArrowRight, IconCheck, IconUser, IconPin, IconSpark, IconShield } from "../../profile/icons.js";
export { IconBuilding, IconChevronDown } from "../../companies/icons.js";
export { IconListBullet, IconListNumber, IconHeading } from "../../admin/icons.js";
export { IconLightbulb } from "../../articles/icons.js";
export { IconGlobe } from "../../profile/icons.js";
export { IconHome } from "../../favorites/icons.js";
export { IconTarget } from "../../salaries/icons.js";
export { IconClipboardCheck } from "../../vacancies/detail/icons.js";

type IconProps = { size?: number; className?: string };

function Svg({ size = 20, className = "", children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      {children}
    </svg>
  );
}

export const IconPlay = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 5.5v13l10-6.5-10-6.5Z" fill="currentColor" />
  </Svg>
);

export const IconPause = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 5.5v13M15 5.5v13" strokeWidth={2.6} />
  </Svg>
);

export const IconSort = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 4.5v15M7 19.5l-3-3M7 19.5l3-3M17 19.5v-15M17 4.5l-3 3M17 4.5l3 3" />
  </Svg>
);
