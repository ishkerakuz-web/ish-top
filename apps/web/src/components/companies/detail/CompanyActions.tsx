import React, { useState } from "react";
import type { CompanyDetailVM } from "../../../lib/companies/detail.js";
import { useHref, useT } from "../../../lib/i18n/index.js";
import { useAuth } from "../../AuthContext.js";
import { useSavedCompanies } from "../../../lib/companies/useSavedCompanies.js";
import { loginHrefWithReturn } from "../../../lib/auth/returnTo.js";
import { startConversation } from "../../../lib/api.js";
import { PhoneGateNotice, isPhoneGateError } from "../../PhoneGateNotice.js";
import { OUTLINE_BUTTON } from "./styles.js";
import { IconCheck, IconPlus, IconSend, IconShare, Spinner } from "./icons.js";

/**
 * Sarlavhadagi amallar — faqat mavjud mexanizmlar:
 * - "Kuzatish" — `/companies` dagi saqlangan kompaniyalar (SavedCompany):
 *   optimistik, xatoda qaytadi; mehmon bosganda kirish sahifasi. Ish beruvchida yo'q.
 * - "Ulashish" — tizim oynasi yoki havolani nusxalash (sahifadan).
 * - "Xabar yozish" — nomzod uchun mavjud suhbat ochish (telefon tasdig'i talabi bilan).
 * Tahrirlash / vakansiya yaratish kabi ish beruvchi boshqaruvlari bu sahifada yo'q.
 */
export function CompanyActions({ company, onShare }: { company: CompanyDetailVM; onShare: () => void }) {
  const t = useT();
  const a = t.companyDetail.actions;
  const l = useHref();
  const { status, user, accessToken } = useAuth();
  const saved = useSavedCompanies();
  const [messaging, setMessaging] = useState(false);
  const [gated, setGated] = useState(false);

  const isSeeker = status === "authed" && user?.role === "job_seeker" && Boolean(accessToken);
  const canFollow = status !== "authed" || isSeeker;
  const following = saved.isSaved(company.id);

  function onFollow() {
    if (status === "loading") return;
    if (!saved.enabled) {
      // Audit R3, candidate-flows-12: kirishdan keyin shu kompaniya sahifasiga qaytadi
      window.location.assign(loginHrefWithReturn(l("/login")));
      return;
    }
    void saved.toggle(company.id);
  }

  async function onMessage() {
    if (!accessToken) return;
    setMessaging(true);
    setGated(false);
    try {
      const id = await startConversation(accessToken, { companySlug: company.slug });
      window.location.assign(l(`/messages?c=${id}`));
    } catch (err) {
      if (isPhoneGateError(err)) setGated(true);
      setMessaging(false);
    }
  }

  return (
    <div className="w-full md:w-auto">
      <div className="flex flex-wrap gap-2 [&>*]:min-w-[8.5rem] [&>*]:flex-1 md:justify-end md:[&>*]:flex-none">
        {canFollow && (
          <button
            type="button"
            aria-pressed={following}
            onClick={onFollow}
            className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-[14px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${
              following ? "border border-signal/40 bg-signal-soft text-signal hover:bg-signal-soft/70" : "bg-signal text-white hover:bg-signal-dark"
            }`}
          >
            {following ? <IconCheck size={18} /> : <IconPlus size={18} />}
            {following ? a.following : a.follow}
          </button>
        )}
        <button type="button" onClick={onShare} className={OUTLINE_BUTTON}>
          <IconShare size={17} />
          {a.share}
        </button>
        {isSeeker && (
          <button type="button" onClick={() => void onMessage()} disabled={messaging} aria-busy={messaging || undefined} className={OUTLINE_BUTTON}>
            {messaging ? <Spinner size={16} /> : <IconSend size={17} />}
            {a.message}
          </button>
        )}
      </div>
      {gated && <PhoneGateNotice className="mt-3 md:ml-auto md:max-w-sm" />}
    </div>
  );
}
