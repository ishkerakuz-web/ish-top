import { render } from "vike/abort";
import { fetchCompanyPage, fetchStats, fetchVacancyFacets, fetchVacancyPage } from "../../lib/api.js";

/**
 * Bosh sahifa ma'lumotlari. Har blok mustaqil va xatosi alohida (audit ISSUE-016):
 * API javob bermasa "0 vakansiya" yoki bo'sh blok o'rniga `null` qaytadi — sahifa statistikani
 * yashiradi, ro'yxat bloklarida "yuklab bo'lmadi" deydi. Kategoriya sonlari qattiq yozilgan
 * taxminiy raqamlar emas, haqiqiy filtr sonlari (audit ISSUE-015); bo'lmasa son ko'rsatilmaydi.
 *
 * Asosiy blok — so'nggi vakansiyalar ro'yxati. SSR'da u kelmasa (API o'chiq yoki
 * timeout) sahifa 503 qaytaradi (audit R3, seo-3 / api-errors-1): bosh sahifa
 * uzilish paytida "yuklab bo'lmadi" matni bilan indekslanmasin. Statistika,
 * kompaniyalar va kategoriya sonlari ikkinchi darajali — ularsiz sahifa 200.
 */
export async function data(pageContext: { isClientSideNavigation?: boolean }) {
  const [stats, vacancies, companies, facets] = await Promise.all([
    fetchStats(),
    fetchVacancyPage(new URLSearchParams({ pageSize: "6" })).then(
      (page) => page.items.slice(0, 6),
      () => null
    ),
    fetchCompanyPage(new URLSearchParams(), { limit: 4 }).then(
      (page) => page.items.slice(0, 4),
      () => null
    ),
    fetchVacancyFacets(new URLSearchParams()),
  ]);
  if (!vacancies && !pageContext.isClientSideNavigation) throw render(503);
  const categoryCounts: Record<string, number> | null = facets
    ? Object.fromEntries(facets.categories.map((c) => [c.slug, c.count]))
    : null;
  return { stats, vacancies, companies, categoryCounts };
}
