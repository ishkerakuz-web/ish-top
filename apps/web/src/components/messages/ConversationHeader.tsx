import React from "react";
import type { ConversationView } from "../../lib/messages/adapter.js";
import { useHref, useT } from "../../lib/i18n/index.js";
import type { ConversationRating } from "../../lib/types.js";
import { ActionsMenu, type ActionItem } from "../ActionsMenu.js";
import { IconArrowLeft, IconBriefcase, IconBuilding, IconInfo, IconStar, IconVerified } from "./icons.js";
import { ParticipantAvatar, participantLabel } from "./participant.js";

/**
 * Chat sarlavhasi: suhbatdosh, turi, reyting (faqat baholar bo'lsa), "i" (kontekst modali)
 * va "⋮" — faqat mavjud amallar: baho berish (hali berilmagan bo'lsa), kompaniya sahifasi,
 * vakansiya. Amal bo'lmasa menyu chizilmaydi. Suhbatdosh NOMI ham modalni ochadi.
 */
export function ConversationHeader({
  conversation,
  name,
  rating,
  headingRef,
  onBack,
  onOpenDetails,
  onRate,
}: {
  conversation: ConversationView;
  name: string;
  rating: ConversationRating | null;
  headingRef: React.RefObject<HTMLHeadingElement>;
  onBack: () => void;
  onOpenDetails: () => void;
  onRate: () => void;
}) {
  const t = useT();
  const m = t.messagesPage;
  const l = useHref();
  const isCompany = conversation.otherRole === "employer" && conversation.company !== null;
  const verified = isCompany && conversation.company?.isVerified === true;
  const avg = rating && rating.otherCount > 0 && rating.otherAvg !== null ? rating.otherAvg : null;

  const items: ActionItem[] = [];
  if (rating && !rating.myScore) items.push({ key: "rate", label: m.actions.rate, icon: <IconStar size={16} />, onSelect: onRate });
  if (isCompany && conversation.company?.slug) {
    items.push({ key: "company", label: m.actions.company, icon: <IconBuilding size={16} />, href: l(`/companies/${conversation.company.slug}`) });
  }
  if (conversation.vacancy && !conversation.vacancy.isClosed) {
    items.push({ key: "vacancy", label: m.actions.vacancy, icon: <IconBriefcase size={16} />, href: l(`/vacancies/${conversation.vacancy.slug}`) });
  }

  return (
    <div className="flex items-center gap-2.5 border-b border-line px-3 py-3 sm:gap-3 sm:px-5">
      <button
        type="button"
        onClick={onBack}
        className="-ml-1 inline-flex h-10 shrink-0 items-center gap-1 rounded-xl pl-1 pr-2 text-[13.5px] font-semibold text-signal transition-colors hover:bg-signal-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal md:hidden"
      >
        <IconArrowLeft size={18} />
        {m.chat.back}
      </button>
      <span className="hidden sm:block">
        <ParticipantAvatar conversation={conversation} name={name} size="sm" />
      </span>
      <div className="min-w-0 flex-1">
        {/* Nomni bosish kontekst modalini ochadi — ilgari bu ma'lumot yondagi ustunda turardi */}
        <h2 ref={headingRef} tabIndex={-1} className="flex min-w-0 font-display text-[16px] font-bold leading-tight text-ink focus:outline-none">
          <button
            type="button"
            onClick={onOpenDetails}
            aria-haspopup="dialog"
            className="flex min-w-0 items-center gap-1.5 rounded-lg text-left transition-colors hover:text-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
          >
            <span className="truncate">{name}</span>
            {verified && (
              <>
                <IconVerified size={16} className="shrink-0 text-signal" />
                <span className="sr-only">{m.chat.verified}</span>
              </>
            )}
          </button>
        </h2>
        <p className="mt-0.5 flex min-w-0 items-center gap-x-2 text-[12.5px] text-dusk">
          <span className="truncate">{participantLabel(conversation, m)}</span>
          {avg !== null && rating && (
            <span data-testid="chat-rating" className="hidden shrink-0 items-center gap-1 sm:inline-flex">
              <span aria-hidden>·</span>
              <IconStar size={13} className="text-gold" />
              {m.chat.rating(avg.toFixed(1), rating.otherCount)}
            </span>
          )}
        </p>
      </div>
      <button
        type="button"
        onClick={onOpenDetails}
        aria-label={m.chat.details}
        aria-haspopup="dialog"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-surface text-dusk transition-colors hover:border-signal/40 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
      >
        <IconInfo size={18} />
      </button>
      {items.length > 0 && <ActionsMenu label={m.actions.menu} items={items} />}
    </div>
  );
}
