import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Vacancy } from "../../../lib/types.js";
import type { VacancyDetailVM } from "../../../lib/vacancies/detail.js";
import { useHref, useT } from "../../../lib/i18n/index.js";
import { loginHrefWithReturn } from "../../../lib/auth/returnTo.js";
import { useAuth } from "../../AuthContext.js";
import { useFavorites } from "../../../lib/useFavorites.js";
import { useShare } from "../../../lib/useShare.js";
import { useAnyInView } from "../../../lib/useAnyInView.js";
import { useApplication } from "../../../lib/vacancies/useApplication.js";
import { VacancyDetailHeader } from "./VacancyDetailHeader.js";
import { VacancyActions } from "./VacancyActions.js";
import { ApplyCard, type ApplyLinks } from "./ApplyCard.js";
import { StickyApplyBar, StickyApplyMini } from "./StickyApply.js";
import { VacancyGallery } from "./VacancyGallery.js";
import { VacancyTabs, panelId, tabId, type DetailTab } from "./VacancyTabs.js";
import { VacancyDescription } from "./VacancyDescription.js";
import { VacancyChecklist } from "./VacancyChecklist.js";
import { ShareActions } from "./ShareActions.js";
import { CompanyCard } from "./CompanyCard.js";
import { CompanyAbout, hasCompanyAbout } from "./CompanyAbout.js";
import { CompanyReviewsPanel } from "./CompanyReviewsPanel.js";
import { SimilarVacancies } from "./SimilarVacancies.js";
import { ReportDialog } from "./ReportDialog.js";
import { IconClipboardCheck, IconSpark } from "./icons.js";

const TABS_ID = "vacancy";

/**
 * Vakansiya detail sahifasining asosiy qismi. Layout ma'lumotga qarab
 * o'zgaradi: rasm yo'q — galereya yo'q, sharh yo'q — "Sharhlar" tabi yo'q,
 * o'xshash vakansiya yo'q — blok yo'q; qolgan bloklar joyni egallaydi.
 *
 * Desktop: chapda sarlavha → galereya → tablar; o'ngda ariza kartasi,
 * kompaniya, o'xshashlar va (karta ko'rinmay qolganda) yopishqoq ixcham karta.
 * Telefon: sarlavha → ariza kartasi → galereya → tavsif → kompaniya →
 * o'xshashlar, karta ekrandan chiqqach pastda qotirilgan "Ariza yuborish".
 */
export function VacancyDetailView({ vacancy, similar }: { vacancy: VacancyDetailVM; similar: Vacancy[] }) {
  const t = useT();
  const d = t.vacancyDetail;
  const l = useHref();
  const { status } = useAuth();
  const favorites = useFavorites();
  const { share, copy, notice } = useShare();

  /**
   * Audit R3, candidate-flows-12: mehmon "Ariza yuborish" yoki "Saqlash" ni
   * bosgach kirishdan keyin shu vakansiyaga qaytadi. `returnTo` faqat brauzerda
   * qo'shiladi — SSR va birinchi render bir xil bo'lsin (hydration).
   */
  const loginHref = l("/login");
  const signupHref = l("/signup");
  const [authLinks, setAuthLinks] = useState({ login: loginHref, signup: signupHref });
  useEffect(() => {
    setAuthLinks({ login: loginHrefWithReturn(loginHref), signup: loginHrefWithReturn(signupHref) });
  }, [loginHref, signupHref]);

  const links: ApplyLinks = useMemo(
    () => ({
      login: authLinks.login,
      signup: authLinks.signup,
      resume: l("/profile?tab=resume"),
      applications: l("/applications"),
    }),
    [l, authLinks]
  );
  const apply = useApplication(vacancy.id, links.login);

  const mobileCardRef = useRef<HTMLElement>(null);
  const desktopCardRef = useRef<HTMLElement>(null);
  const cardVisible = useAnyInView([mobileCardRef, desktopCardRef]);

  // Pastki paneldan yuborishda xato bo'lsa (telefon tasdiqlanmagan va h.k.) —
  // izoh ko'rinadigan asosiy kartaga olib boramiz
  useEffect(() => {
    if (!apply.error) return;
    const card = [mobileCardRef.current, desktopCardRef.current].find((el) => el && el.offsetParent !== null);
    card?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [apply.error]);

  // Saqlash — mavjud sevimlilar (optimistik, xatoda qaytadi). Mehmon — kirishga.
  const saved = favorites.isFavorite(vacancy.id);
  const { enabled: canSave, toggle } = favorites;
  const onToggleSave = useMemo(() => {
    if (canSave) return () => void toggle(vacancy.id);
    if (status === "guest") return () => window.location.assign(links.login);
    return undefined;
  }, [canSave, toggle, vacancy.id, status, links.login]);

  const onShare = useCallback(() => {
    void share({ title: `${vacancy.title} — ${vacancy.company.name}`, url: `${window.location.origin}${window.location.pathname}` });
  }, [share, vacancy.title, vacancy.company.name]);
  const onCopy = useCallback((url: string) => void copy(url), [copy]);

  const [reportOpen, setReportOpen] = useState(false);
  const closeReport = useCallback(() => setReportOpen(false), []);

  const tabs: DetailTab[] = [{ id: "about", label: d.tabs.about }];
  if (hasCompanyAbout(vacancy.company)) tabs.push({ id: "company", label: d.tabs.company });
  if (vacancy.company.reviewCount > 0) tabs.push({ id: "reviews", label: d.tabs.reviews(vacancy.company.reviewCount) });
  const [activeTab, setActiveTab] = useState("about");
  const showTabs = tabs.length > 1;

  const panel = (id: string, children: React.ReactNode) =>
    showTabs ? (
      <div
        key={id}
        role="tabpanel"
        id={panelId(TABS_ID, id)}
        aria-labelledby={tabId(TABS_ID, id)}
        hidden={activeTab !== id}
        tabIndex={0}
        className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-4 focus-visible:ring-offset-surface"
      >
        {children}
      </div>
    ) : (
      <div key={id}>{children}</div>
    );

  const actions = <VacancyActions saved={saved} onToggleSave={onToggleSave} onShare={onShare} />;

  return (
    <>
      <div className="mt-5 grid grid-cols-1 gap-6 lg:mt-6 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_372px] xl:gap-8">
        <div className="min-w-0 space-y-6">
          <VacancyDetailHeader vacancy={vacancy} actions={actions} />
          <ApplyCard vacancy={vacancy} apply={apply} links={links} cardRef={mobileCardRef} className="lg:hidden" />
          <VacancyGallery images={vacancy.images} companyName={vacancy.company.name} />

          <div className="animate-fade-up rounded-3xl border border-line bg-surface shadow-card">
            {showTabs && <VacancyTabs tabs={tabs} active={activeTab} onChange={setActiveTab} idPrefix={TABS_ID} label={d.tabs.label} />}
            <div className="p-5 sm:p-7">
              {panel(
                "about",
                <div className="space-y-8">
                  <VacancyDescription text={vacancy.description} title={d.tabs.about} />
                  <VacancyChecklist title={d.sections.requirements} items={vacancy.requirements} icon={<IconClipboardCheck size={19} />} tone="growth" />
                  <VacancyChecklist title={d.sections.conditions} items={vacancy.conditions} icon={<IconSpark size={19} />} tone="signal" />
                  <ShareActions
                    title={vacancy.title}
                    path={`/vacancies/${vacancy.slug}`}
                    saved={saved}
                    onToggleSave={onToggleSave}
                    onShare={onShare}
                    onCopy={onCopy}
                    onReport={() => setReportOpen(true)}
                  />
                </div>
              )}
              {hasCompanyAbout(vacancy.company) && panel("company", <CompanyAbout company={vacancy.company} />)}
              {vacancy.company.reviewCount > 0 &&
                panel("reviews", <CompanyReviewsPanel company={vacancy.company} active={activeTab === "reviews"} />)}
            </div>
          </div>
        </div>

        <aside className="flex min-w-0 flex-col gap-6">
          <ApplyCard vacancy={vacancy} apply={apply} links={links} cardRef={desktopCardRef} className="hidden lg:block" />
          <div className={`grid items-start gap-6 ${similar.length > 0 ? "md:grid-cols-2 lg:grid-cols-1" : ""}`}>
            <CompanyCard company={vacancy.company} />
            <SimilarVacancies items={similar} categorySlug={vacancy.categorySlug} />
          </div>
          <div className="hidden flex-1 lg:block">
            <StickyApplyMini visible={!cardVisible} vacancy={vacancy} apply={apply} links={links} />
          </div>
        </aside>
      </div>

      <StickyApplyBar visible={!cardVisible} vacancy={vacancy} apply={apply} links={links} />
      <ReportDialog open={reportOpen} onClose={closeReport} vacancyTitle={vacancy.title} companyName={vacancy.company.name} vacancySlug={vacancy.slug} />

      <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-24 z-[70] flex justify-center px-4 lg:bottom-8">
        {notice && (
          <span className="animate-pop rounded-xl bg-ink px-4 py-2.5 text-[13.5px] font-semibold text-paper shadow-pop">
            {notice === "copied" ? d.actions.copied : d.actions.copyFailed}
          </span>
        )}
      </div>
    </>
  );
}
