import React from "react";
import { useHref, useT } from "../../lib/i18n/index.js";
import { IconBell } from "./icons.js";

/**
 * Sarlavha: breadcrumb, h1, izoh va o'qilmaganlar soni (serverdagi aniq son).
 * O'ngda (md+) kichik dekorativ illyustratsiya — berilgan `bell.png` dan shaffof
 * qilib tayyorlangan `notifications-bell.webp` (qayta chizilmagan, telefonda yashirin).
 */
export function NotificationsHeader({ unreadCount }: { unreadCount: number | null }) {
  const t = useT();
  const n = t.notificationsPage;
  const l = useHref();
  return (
    <header className="flex items-center justify-between gap-6">
      <div className="min-w-0">
        <nav aria-label={t.companyDetail.breadcrumb}>
          <ol className="flex flex-wrap items-center gap-1.5 text-[13px] text-dusk">
            <li>
              <a href={l("/")} className="transition-colors hover:text-ink">
                {t.search.breadcrumbHome}
              </a>
            </li>
            <li aria-hidden>/</li>
            <li aria-current="page" className="font-medium text-ink">
              {n.breadcrumb}
            </li>
          </ol>
        </nav>
        <h1 className="mt-3 font-display text-[26px] font-bold leading-tight tracking-tight text-ink sm:text-[30px]">{n.title}</h1>
        <p className="mt-1.5 max-w-2xl text-[14.5px] leading-relaxed text-dusk">{n.subtitle}</p>
        {unreadCount !== null && (
          <p
            data-testid="notifications-unread"
            className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12.5px] font-semibold ${
              unreadCount > 0 ? "bg-signal-soft text-signal" : "bg-surface-2 text-dusk"
            }`}
          >
            <IconBell size={13} />
            {unreadCount > 0 ? n.unreadChip(unreadCount) : n.allRead}
          </p>
        )}
      </div>
      {/* Rasm ichidagi och yarim doira tungi fonda "dog'" bo'lib qolmasin — tungi rejimda och kartaga joylanadi */}
      <span className="pointer-events-none hidden shrink-0 select-none rounded-[28px] md:block dark:bg-[#EEF1FE] dark:p-2 dark:shadow-card">
        <img
          src="/notifications-bell.webp"
          alt=""
          width={352}
          height={220}
          decoding="async"
          className="block w-[150px] drop-shadow-[0_10px_18px_rgba(79,70,229,0.18)] xl:w-[176px]"
        />
      </span>
    </header>
  );
}
