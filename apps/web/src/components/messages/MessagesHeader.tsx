import React from "react";
import { useHref, useT } from "../../lib/i18n/index.js";

/**
 * Ixcham sarlavha — messenger'ga tez olib keladi. Telefonda suhbat ochiq bo'lsa
 * yashiriladi (chat va yozish maydoni ekranga to'liq sig'sin).
 */
export function MessagesHeader({ role, hideOnMobile }: { role: string | null; hideOnMobile: boolean }) {
  const t = useT();
  const m = t.messagesPage;
  const l = useHref();
  return (
    <header className={`${hideOnMobile ? "hidden md:flex" : "flex"} items-center justify-between gap-6`}>
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
              {m.breadcrumb}
            </li>
          </ol>
        </nav>
        <h1 className="mt-2 font-display text-[26px] font-bold leading-tight tracking-tight text-ink sm:text-[30px]">{m.title}</h1>
        <p className="mt-1 max-w-2xl text-[14.5px] leading-relaxed text-dusk">{role === "employer" ? m.subtitleEmployer : m.subtitle}</p>
      </div>
      <MessagesIllustration />
    </header>
  );
}

/**
 * Berilgan `message.png` (qayta chizilmagan, faqat qora fon shaffoflashtirilgan):
 * yorug' rejimda nuri qisqartirilgan nusxa, tungi rejimda — asl porlash. 768px dan kichikda yashirin.
 */
export function MessagesIllustration() {
  const size = "w-[124px] lg:w-[140px]";
  return (
    <span aria-hidden className="pointer-events-none -my-2 hidden shrink-0 select-none md:block">
      <img src="/messages-chat.webp" alt="" width={352} height={220} decoding="async" className={`block ${size} dark:hidden`} />
      <img src="/messages-chat-dark.webp" alt="" width={352} height={220} decoding="async" loading="lazy" className={`hidden ${size} dark:block`} />
    </span>
  );
}
