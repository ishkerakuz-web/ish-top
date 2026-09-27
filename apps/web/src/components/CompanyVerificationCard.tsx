import React, { useId, useState } from "react";
import { apiErrorText, requestCompanyVerification } from "../lib/apiExtra.js";
import type { MyCompany } from "../lib/types.js";
import { useLocale, useT } from "../lib/i18n/index.js";

/**
 * "Tasdiqlangan ish beruvchi" belgisi uchun so'rov: yuridik nom + STIR. Holatlar — tasdiqlangan,
 * ko'rib chiqilmoqda, rad etilgan (izoh bilan) yoki hali so'ralmagan. Tasdiqlangan kompaniya e'lonlari
 * oldindan moderatsiyasiz chiqadi — bu ish beruvchi uchun asosiy foyda.
 */
export function CompanyVerificationCard({ token, company }: { token: string; company: MyCompany | null }) {
  const t = useT();
  const v = t.employerProfile.verification;
  const { locale } = useLocale();
  const [legalName, setLegalName] = useState(company?.legalName ?? "");
  const [stir, setStir] = useState(company?.stir ?? "");
  const [state, setState] = useState<Pick<MyCompany, "isVerified" | "verificationRequestedAt" | "verificationNote"> | null>(
    company ? { isVerified: company.isVerified, verificationRequestedAt: company.verificationRequestedAt ?? null, verificationNote: company.verificationNote ?? null } : null
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const legalId = useId();
  const stirId = useId();

  const input =
    "mt-1.5 w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-dusk focus:border-signal focus:outline-none focus:ring-4 focus:ring-signal/10";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{9}$/.test(stir.trim())) {
      setError(v.stirInvalid);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await requestCompanyVerification(token, { legalName: legalName.trim(), stir: stir.trim() });
      setState({
        isVerified: res.company.isVerified,
        verificationRequestedAt: res.company.verificationRequestedAt ?? null,
        verificationNote: res.company.verificationNote ?? null,
      });
      setSent(true);
    } catch (err) {
      setError(apiErrorText(err, locale, { fallback: t.profileHub.states.saveError, network: t.profileHub.states.loadErrorHint }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6" aria-labelledby={`${legalId}-title`}>
      <h2 id={`${legalId}-title`} className="font-display text-lg font-bold text-ink">
        {v.title}
      </h2>

      {!company || !state ? (
        <p className="mt-2 text-sm text-dusk">{v.needCompany}</p>
      ) : state.isVerified ? (
        <div className="mt-3 rounded-xl border border-growth/25 bg-growth/[0.07] px-4 py-3">
          <p className="text-sm font-semibold text-growth">✓ {v.verified}</p>
          <p className="mt-0.5 text-xs text-dusk">{v.verifiedHint}</p>
        </div>
      ) : state.verificationRequestedAt ? (
        <div role="status" className="mt-3 rounded-xl border border-gold/30 bg-gold/10 px-4 py-3">
          <p className="text-sm font-semibold text-gold-deep">{sent ? v.sent : v.pending}</p>
          <p className="mt-0.5 text-xs text-dusk">{v.pendingHint(new Date(state.verificationRequestedAt).toLocaleString(locale))}</p>
        </div>
      ) : (
        <>
          <p className="mt-1.5 text-sm text-dusk">{v.intro}</p>
          {state.verificationNote && (
            <p className="mt-3 rounded-xl border border-danger/25 bg-danger/5 px-4 py-2.5 text-sm text-ink">
              <span className="font-semibold text-danger">{v.rejected}: </span>
              {state.verificationNote}
            </p>
          )}
          <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-[1fr_180px_auto] sm:items-end">
            <div>
              <label htmlFor={legalId} className="text-[13px] font-semibold text-ink">
                {v.legalName}
              </label>
              <input
                id={legalId}
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                required
                minLength={2}
                maxLength={200}
                placeholder={v.legalNamePlaceholder}
                className={input}
              />
            </div>
            <div>
              <label htmlFor={stirId} className="text-[13px] font-semibold text-ink">
                {v.stir} <span className="font-normal text-dusk">({v.stirHint})</span>
              </label>
              <input
                id={stirId}
                value={stir}
                onChange={(e) => setStir(e.target.value.replace(/\D/g, "").slice(0, 9))}
                inputMode="numeric"
                required
                className={`${input} font-mono`}
              />
            </div>
            <button
              type="submit"
              disabled={busy || legalName.trim().length < 2}
              className="h-[42px] rounded-xl bg-signal px-5 text-sm font-semibold text-white transition-colors hover:bg-signal-dark disabled:opacity-60"
            >
              {state.verificationNote ? v.resubmit : v.submit}
            </button>
          </form>
          {error && (
            <p role="alert" className="mt-2 text-sm text-danger">
              {error}
            </p>
          )}
        </>
      )}
    </section>
  );
}
