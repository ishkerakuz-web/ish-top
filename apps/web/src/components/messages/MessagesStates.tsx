import React from "react";
import { useHref, useT } from "../../lib/i18n/index.js";
import { Skeleton } from "../Skeleton.js";
import { PRIMARY } from "../vacancies/detail/VacancyDetailStates.js";
import { IconAlert, IconArrowLeft, IconArrowRight, IconChats, IconRefresh } from "./icons.js";

/** Messenger balandligi (md+): sarlavha va header'dan qolgan joy, juda kichik/katta ekranda chegaralangan. */
/* Chat balandligi: yondagi ustun olib tashlangach ekrandan ko'proq foydalaniladi (860 -> 920) */
export const MESSENGER_HEIGHT = "md:h-[clamp(520px,calc(100dvh-13.5rem),920px)]";
/** Telefonda ochiq chat — yozish maydoni doim ekranda. */
export const MOBILE_CHAT_HEIGHT = "h-[calc(100dvh-6rem)] min-h-[420px] md:h-auto md:min-h-0";
export const PANEL = "min-h-0 flex-col overflow-hidden rounded-3xl border border-line bg-surface shadow-card";
export const MESSENGER_COLUMNS = "grid gap-4 md:grid-cols-[272px_minmax(0,1fr)] lg:grid-cols-[300px_minmax(0,1fr)]";

function ListSkeleton() {
  return (
    <>
      <div className="border-b border-line p-3 sm:p-4">
        <Skeleton className="h-11 w-full rounded-xl" />
        <div className="mt-3 flex gap-2">
          <Skeleton className="h-9 w-28 rounded-full" />
          <Skeleton className="h-9 w-32 rounded-full" />
        </div>
      </div>
      <div className="divide-y divide-line/70">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex gap-3 px-4 py-3.5">
            <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1">
              <div className="flex justify-between gap-3">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-9" />
              </div>
              <Skeleton className="mt-2 h-3 w-1/2" />
              <Skeleton className="mt-2 h-3 w-4/5" />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/** Kursor sahifalash holati (audit R3, D-078): hech narsa / yuklanmoqda / xato. */
export type LoadMoreStatus = "idle" | "loading" | "error";

const LOAD_MORE_BUTTON =
  "inline-flex h-9 items-center rounded-xl border border-line bg-surface px-3.5 text-[13px] font-semibold text-ink transition-colors hover:border-signal/40 hover:text-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal disabled:opacity-60";

/**
 * Suhbatlar ro'yxatining davomi (audit R3, D-078). Xato bo'lsa ro'yxat joyida qoladi,
 * xabar va "qayta urinish" ko'rinadi — API xatosi bo'sh ro'yxatga aylanmaydi.
 */
export function ConversationsLoadMore({
  hasMore,
  status,
  showEnd,
  onLoad,
}: {
  hasMore: boolean;
  status: LoadMoreStatus;
  showEnd: boolean;
  onLoad: () => void;
}) {
  const m = useT().messagesPage;
  if (!hasMore) {
    return showEnd ? (
      <p className="border-t border-line px-4 py-3 text-center text-[12.5px] text-dusk">{m.list.end}</p>
    ) : null;
  }
  const loading = status === "loading";
  return (
    <div className="flex flex-col items-center gap-1.5 border-t border-line px-4 py-3">
      {status === "error" && (
        <p role="alert" className="text-center text-[12.5px] text-danger">
          {m.list.loadMoreError}
        </p>
      )}
      <button type="button" onClick={onLoad} disabled={loading} aria-busy={loading} className={LOAD_MORE_BUTTON}>
        {loading ? m.list.loadingMore : status === "error" ? m.chat.retry : m.list.loadMore}
      </button>
      {loading && (
        <span role="status" className="sr-only">
          {m.list.loadingMore}
        </span>
      )}
    </div>
  );
}

/**
 * Suhbat tarixining eskiroq qismi (audit R3, D-078). Tarix boshiga yetilganda "Suhbat boshi"
 * yozuvi qoladi; xato bo'lsa yuklangan xabarlar joyida turadi.
 */
export function OlderMessages({
  hasMore,
  status,
  showStart,
  onLoad,
}: {
  hasMore: boolean;
  status: LoadMoreStatus;
  showStart: boolean;
  onLoad: () => void;
}) {
  const m = useT().messagesPage;
  if (!hasMore) {
    return showStart ? <p className="mb-2 text-center text-[12px] text-dusk">{m.chat.historyStart}</p> : null;
  }
  const loading = status === "loading";
  return (
    <div className="mb-3 flex flex-col items-center gap-1.5">
      {status === "error" && (
        <p role="alert" className="text-center text-[12.5px] text-danger">
          {m.chat.loadOlderError}
        </p>
      )}
      <button type="button" onClick={onLoad} disabled={loading} aria-busy={loading} className={LOAD_MORE_BUTTON}>
        {loading ? m.chat.loadingOlder : status === "error" ? m.chat.retry : m.chat.loadOlder}
      </button>
      {loading && (
        <span role="status" className="sr-only">
          {m.chat.loadingOlder}
        </span>
      )}
    </div>
  );
}

/** Xabar pufaklari skeleti — suhbat tarixi yuklanayotganda. */
export function ThreadSkeleton() {
  const m = useT().messagesPage;
  const rows: [boolean, string][] = [
    [false, "w-3/5"],
    [true, "w-2/5"],
    [false, "w-1/2"],
    [true, "w-3/5"],
    [false, "w-2/5"],
  ];
  return (
    <div aria-busy="true" className="flex-1 space-y-4 overflow-hidden px-3 py-5 sm:px-5">
      <span role="status" className="sr-only">
        {m.chat.loading}
      </span>
      {rows.map(([mine, width], i) => (
        <div key={i} className={`flex items-end gap-2 ${mine ? "justify-end" : "justify-start"}`}>
          {!mine && <Skeleton className="h-8 w-8 shrink-0 rounded-lg" />}
          <Skeleton className={`h-14 rounded-2xl ${width}`} />
        </div>
      ))}
    </div>
  );
}

/** Birinchi yuklanish: ro'yxat va chat skeletlari — tayyor bo'lganda sakrash bo'lmaydi. */
export function MessengerSkeleton() {
  const m = useT().messagesPage;
  return (
    <div aria-busy="true" className={`${MESSENGER_COLUMNS} ${MESSENGER_HEIGHT}`}>
      <span role="status" className="sr-only">
        {m.loading}
      </span>
      <div className={`flex ${PANEL}`}>
        <ListSkeleton />
      </div>
      <div className={`hidden md:flex ${PANEL}`}>
        <div className="flex items-center gap-3 border-b border-line px-5 py-3">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="flex-1">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="mt-2 h-3 w-56" />
          </div>
        </div>
        <ThreadSkeleton />
        <div className="border-t border-line p-3">
          <Skeleton className="h-12 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

/** Umuman suhbat yo'q. CTA — faqat nomzodga (vakansiyalar). */
export function MessagesEmptyState({ role }: { role: string | null }) {
  const e = useT().messagesPage.empty;
  const l = useHref();
  return (
    <section className="flex flex-col items-center rounded-3xl border border-line bg-surface px-6 py-12 text-center shadow-card sm:py-14">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-signal-soft text-signal">
        <IconChats size={30} />
      </span>
      <h2 className="mt-5 font-display text-xl font-bold text-ink">{e.title}</h2>
      <p className="mt-2 max-w-md text-[14.5px] leading-relaxed text-dusk">{role === "employer" ? e.textEmployer : e.text}</p>
      {role === "job_seeker" && (
        <a href={l("/vacancies")} className={`${PRIMARY} mt-7`}>
          {e.cta}
          <IconArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
        </a>
      )}
    </section>
  );
}

/** Suhbatlar ro'yxatini yuklab bo'lmadi — "Qayta urinish" haqiqiy so'rov yuboradi. */
export function MessagesErrorState({ onRetry }: { onRetry: () => void }) {
  const e = useT().messagesPage.error;
  return (
    <div role="alert" className="flex flex-col items-center rounded-3xl border border-dashed border-line bg-surface px-6 py-12 text-center sm:py-14">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-danger/10 text-danger">
        <IconAlert size={26} />
      </span>
      <h2 className="mt-5 font-display text-xl font-bold text-ink">{e.title}</h2>
      <p className="mt-2 max-w-sm text-[14.5px] text-dusk">{e.text}</p>
      <button type="button" onClick={onRetry} className={`${PRIMARY} mt-7`}>
        <IconRefresh size={16} />
        {e.retry}
      </button>
    </div>
  );
}

/** Desktop: suhbat tanlanmagan. */
export function ConversationEmptyState() {
  const s = useT().messagesPage.select;
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-signal-soft text-signal">
        <IconChats size={30} />
      </span>
      <h2 className="mt-5 font-display text-[18px] font-bold text-ink">{s.title}</h2>
      <p className="mt-1.5 max-w-xs text-[14px] leading-relaxed text-dusk">{s.text}</p>
    </div>
  );
}

/** `?c=` dagi suhbat ro'yxatda yo'q (mavjud emas yoki foydalanuvchiga tegishli emas). */
export function ConversationNotFound({ onBack }: { onBack: () => void }) {
  const c = useT().messagesPage.chat;
  return (
    <div role="alert" className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-2 text-dusk">
        <IconChats size={26} />
      </span>
      <h2 className="mt-5 font-display text-[18px] font-bold text-ink">{c.notFoundTitle}</h2>
      <p className="mt-1.5 max-w-xs text-[14px] text-dusk">{c.notFoundText}</p>
      <button
        type="button"
        onClick={onBack}
        className="mt-6 inline-flex h-10 items-center gap-1.5 rounded-xl border border-line bg-surface px-4 text-[13.5px] font-semibold text-ink transition-colors hover:border-signal/40 hover:text-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
      >
        <IconArrowLeft size={16} />
        {c.backToList}
      </button>
    </div>
  );
}

/** Bitta suhbat tarixini yuklab bo'lmadi — faqat shu suhbat uchun qayta urinish. */
export function ThreadErrorState({ onRetry }: { onRetry: () => void }) {
  const c = useT().messagesPage.chat;
  return (
    <div role="alert" className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-danger/10 text-danger">
        <IconAlert size={22} />
      </span>
      <h3 className="mt-4 font-display text-[16px] font-bold text-ink">{c.errorTitle}</h3>
      <p className="mt-1.5 max-w-xs text-[14px] text-dusk">{c.errorText}</p>
      <button type="button" onClick={onRetry} className={`${PRIMARY} mt-5`}>
        <IconRefresh size={16} />
        {c.retry}
      </button>
    </div>
  );
}
