import React, { useEffect, useState } from "react";
import { useData } from "vike-react/useData";
import type { data } from "./+data.js";
import { useT, useHref } from "../../lib/i18n/index.js";
import { useAuth } from "../../components/AuthContext.js";
import { formatNumber } from "../../lib/format.js";
import { fetchMyPayments, fetchSubscription, startCheckout } from "../../lib/apiExtra.js";
import type { PaymentRecord, SubscriptionState, SubscriptionPlan } from "../../lib/types.js";

/**
 * Tariflar sahifasi — real rejalar bazadan, sotib olish esa to'lov yozuvini
 * yaratib provayder sahifasiga olib boradi. Provayder ulanmagan bo'lsa
 * so'rov "kutilmoqda" holatida qoladi va admin uni tasdiqlaydi.
 */
export default function Page() {
  const { plans } = useData<Awaited<ReturnType<typeof data>>>();
  const t = useT();
  const l = useHref();
  const { status, user, accessToken } = useAuth();
  const isEmployer = status === "authed" && user?.role === "employer";

  const [subscription, setSubscription] = useState<SubscriptionState | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [provider, setProvider] = useState<"payme" | "click">(
    plans.providers.payme ? "payme" : plans.providers.click ? "click" : "payme"
  );
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isEmployer || !accessToken) return;
    let cancelled = false;
    void Promise.all([fetchSubscription(accessToken), fetchMyPayments(accessToken)]).then(
      ([sub, pays]) => {
        if (cancelled) return;
        setSubscription(sub);
        setPayments(pays);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [isEmployer, accessToken]);

  async function buy(plan: SubscriptionPlan) {
    if (!accessToken) {
      window.location.assign(l("/login"));
      return;
    }
    setBusySlug(plan.slug);
    setError(null);
    setNotice(null);
    try {
      const result = await startCheckout(accessToken, plan.slug, provider);
      if (result.manual) {
        setNotice(t.pricingExtra.manualNotice);
        setPayments(await fetchMyPayments(accessToken));
      } else {
        window.location.assign(result.checkoutUrl);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t.pricingExtra.checkoutError);
    } finally {
      setBusySlug(null);
    }
  }

  const statusLabel: Record<PaymentRecord["status"], string> = {
    pending: t.pricingExtra.statusPending,
    paid: t.pricingExtra.statusPaid,
    failed: t.pricingExtra.statusFailed,
    refunded: t.pricingExtra.statusRefunded,
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-2 text-sm text-dusk">
        <a href={l("/")} className="hover:text-signal">
          {t.search.breadcrumbHome}
        </a>{" "}
        / {t.pricing.breadcrumb}
      </div>
      <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">{t.pricing.title}</h1>
      <p className="mt-1 text-sm text-dusk">{t.pricing.subtitle}</p>

      {subscription && (
        <div className="mt-6 rounded-2xl border border-signal/40 bg-signal/[0.05] p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-dusk">
            {t.pricingExtra.currentPlan}
          </p>
          <div className="mt-1.5 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className="font-display text-lg font-bold text-ink">{subscription.name}</span>
            <span className="font-mono text-sm text-dusk">
              {t.pricingExtra.usage(subscription.activeVacancies, subscription.maxActiveVacancies)}
            </span>
            {subscription.expiresAt && !subscription.expired && (
              <span className="text-sm text-dusk">
                {t.pricingExtra.activeUntil}:{" "}
                {new Date(subscription.expiresAt).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      )}

      {(plans.providers.payme || plans.providers.click) && isEmployer && (
        <div className="mt-6 flex items-center gap-3">
          <span className="text-sm font-medium text-dusk">{t.pricingExtra.payWith}</span>
          <div className="flex overflow-hidden rounded-lg border border-line">
            {plans.providers.payme && (
              <ProviderButton
                active={provider === "payme"}
                onClick={() => setProvider("payme")}
                label={t.pricingExtra.payme}
              />
            )}
            {plans.providers.click && (
              <ProviderButton
                active={provider === "click"}
                onClick={() => setProvider("click")}
                label={t.pricingExtra.click}
              />
            )}
          </div>
        </div>
      )}

      {notice && (
        <p className="mt-5 rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm text-ink">{notice}</p>
      )}
      {error && (
        <p className="mt-5 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>
      )}

      <div className="mt-8 grid gap-5 md:grid-cols-3">
        {plans.items.map((plan, i) => {
          const popular = i === 1;
          const isCurrent = subscription?.slug === plan.slug;
          return (
            <div
              key={plan.slug}
              style={{ animationDelay: `${i * 80}ms` }}
              className={`relative flex animate-fade-up flex-col rounded-2xl border p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover ${
                popular ? "border-signal/50 bg-surface shadow-card-hover" : "border-line bg-surface"
              }`}
            >
              {popular && !isCurrent && (
                <span className="absolute -top-3 left-6 rounded-full bg-signal px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
                  {t.pricing.popular}
                </span>
              )}
              {isCurrent && (
                <span className="absolute -top-3 left-6 rounded-full bg-growth px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
                  {t.pricingExtra.current}
                </span>
              )}

              <h2 className="font-display text-lg font-bold text-ink">{plan.name}</h2>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="font-display text-2xl font-bold text-ink">
                  {plan.price === 0 ? t.pricingExtra.free : formatNumber(plan.price)}
                </span>
                {plan.price > 0 && (
                  <span className="text-xs text-dusk">{t.pricingExtra.perMonthShort}</span>
                )}
              </div>

              <ul className="mt-5 flex-1 space-y-2.5">
                <PlanFeature>{t.pricingExtra.featureVacancies(plan.maxActiveVacancies)}</PlanFeature>
                {plan.maxFeaturedVacancies > 0 && (
                  <PlanFeature>
                    {t.pricingExtra.featureFeatured(plan.maxFeaturedVacancies)}
                  </PlanFeature>
                )}
                {plan.canSearchCandidates && (
                  <PlanFeature>{t.pricingExtra.featureCandidates}</PlanFeature>
                )}
                {plan.features
                  .filter(
                    (f) =>
                      !f.includes(String(plan.maxActiveVacancies)) &&
                      !f.includes(String(plan.maxFeaturedVacancies))
                  )
                  .map((f) => (
                    <PlanFeature key={f}>{f}</PlanFeature>
                  ))}
              </ul>

              {isCurrent ? (
                <span className="mt-6 rounded-xl border border-growth/40 bg-growth/10 py-2.5 text-center text-sm font-semibold text-growth">
                  {t.pricingExtra.current}
                </span>
              ) : plan.price === 0 ? (
                <span className="mt-6 rounded-xl border border-line py-2.5 text-center text-sm font-medium text-dusk">
                  {t.pricingExtra.free}
                </span>
              ) : !isEmployer ? (
                <a
                  href={l(status === "authed" ? "/employer" : "/signup")}
                  className={`mt-6 rounded-xl py-2.5 text-center text-sm font-semibold transition-colors ${
                    popular
                      ? "bg-signal text-white hover:bg-signal-dark"
                      : "border border-line text-ink hover:border-signal hover:text-signal"
                  }`}
                >
                  {status === "authed" ? t.pricingExtra.employersOnly : t.pricingExtra.loginToBuy}
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => void buy(plan)}
                  disabled={busySlug === plan.slug}
                  className={`mt-6 rounded-xl py-2.5 text-center text-sm font-semibold transition-colors disabled:opacity-60 ${
                    popular
                      ? "bg-signal text-white hover:bg-signal-dark"
                      : "border border-line text-ink hover:border-signal hover:text-signal"
                  }`}
                >
                  {t.pricingExtra.activate}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {isEmployer && (
        <section className="mt-10">
          <h2 className="font-display text-lg font-bold text-ink">{t.pricingExtra.paymentsTitle}</h2>
          {payments.length === 0 ? (
            <p className="mt-3 rounded-xl border border-line bg-surface p-6 text-center text-sm text-dusk">
              {t.pricingExtra.noPayments}
            </p>
          ) : (
            <div className="mt-3 overflow-x-auto rounded-xl border border-line bg-surface">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-dusk">
                    <th className="px-4 py-2.5 font-semibold">{t.admin.payments.plan}</th>
                    <th className="px-4 py-2.5 font-semibold">{t.admin.payments.amount}</th>
                    <th className="px-4 py-2.5 font-semibold">{t.admin.payments.provider}</th>
                    <th className="px-4 py-2.5 font-semibold">{t.admin.payments.status}</th>
                    <th className="px-4 py-2.5 font-semibold">{t.admin.users.registered}</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-b border-line/60 last:border-0">
                      <td className="px-4 py-2.5 text-ink">{p.planName}</td>
                      <td className="px-4 py-2.5 font-mono text-[13px] text-ink">
                        {formatNumber(p.amount)}
                      </td>
                      <td className="px-4 py-2.5 text-dusk">{p.provider}</td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
                            p.status === "paid"
                              ? "bg-growth/10 text-growth"
                              : "bg-surface-2 text-dusk"
                          }`}
                        >
                          {statusLabel[p.status]}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-dusk">
                        {new Date(p.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function PlanFeature({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5 text-sm text-ink/80">
      <span className="mt-1 text-growth">✓</span>
      {children}
    </li>
  );
}

function ProviderButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3.5 py-1.5 text-sm font-medium transition-colors ${
        active ? "bg-signal/10 text-signal" : "text-dusk hover:text-ink"
      }`}
    >
      {label}
    </button>
  );
}
