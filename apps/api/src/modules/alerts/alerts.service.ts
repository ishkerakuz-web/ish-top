import { prisma } from "../../common/prisma.js";
import { env } from "../../common/env.js";
import { acquireLock } from "../../common/redis.js";
import { escapeHtml } from "../../common/mailer.js";
import { notify } from "../notifications/notifications.service.js";
import { listVacancies, type VacancyListQuery } from "../vacancies/vacancies.service.js";

/**
 * Saqlangan qidiruv bo'yicha xabarnoma ("bu so'rov bo'yicha yangi vakansiya
 * chiqsa menga xabar bering").
 *
 * Ishlash tartibi: har `ALERTS_INTERVAL_MINUTES` daqiqada obunalar ko'rib
 * chiqiladi. Har biri uchun oxirgi xabardan keyin **chop etilgan**
 * vakansiyalar qidiriladi; topilsa foydalanuvchiga bitta yig'ma bildirishnoma
 * boradi va `lastNotifiedAt` yangilanadi.
 *
 * `frequency`:
 *   instant — har tekshiruvda yuboriladi
 *   daily   — oxirgi xabardan kamida 20 soat o'tgan bo'lsa
 *
 * Miqyos (audit ISSUE-055): obunalar 500 tadan keyset (`id > oxirgi`) bilan o'qiladi; oxirgi
 * chop etilgan vakansiyadan keyin tekshirilgan obunaga qidiruv yuborilmaydi;
 * bir vaqtda faqat bitta aylanish ishlaydi (jadval + admin tugmasi) va obuna
 * optimistik qulf bilan olinadi — bitta obunaga ikki marta xabar ketmaydi.
 * Har obuna (lastNotifiedAt; qulf vaqti] oralig'ini tekshiradi: oraliqlar kesishmaydi va uzilmaydi;
 * qidiruv xato bersa qulf qaytariladi (audit PHASE 6, V6/V7/U15).
 */

const DAILY_GAP_MS = 20 * 60 * 60 * 1000;
/** Bir xabarnomada nechta vakansiya nomi ko'rsatiladi. */
const PREVIEW_COUNT = 5;
/** Bir so'rovda o'qiladigan obunalar soni. */
const BATCH = 500;

export interface SavedSearchParams {
  text?: string;
  categorySlug?: string;
  /** Vergul bilan bir nechta bo'lishi mumkin (area, experience, employment, company). */
  area?: string;
  experience?: string;
  employment?: string;
  salary?: number;
  salaryTo?: number;
  company?: string;
  verified?: boolean;
  premium?: boolean;
}

/** API enum → sayt URL'idagi o'qiladigan qiymat (apps/web/src/lib/vacancies/query.ts bilan bir xil). */
const EXPERIENCE_URL: Record<string, string> = { none: "junior", one_to_three: "middle", three_to_six: "senior", six_plus: "lead" };
const EMPLOYMENT_URL: Record<string, string> = { full_time: "full-time", part_time: "part-time", remote: "remote", shift: "shift" };

/** Json ustunidan qidiruv parametrlarini xavfsiz o'qiydi. */
export function parseQueryParams(value: unknown): SavedSearchParams {
  if (!value || typeof value !== "object") return {};
  const raw = value as Record<string, unknown>;
  const str = (k: string) => (typeof raw[k] === "string" && raw[k] ? String(raw[k]) : undefined);
  const num = (k: string) => {
    const n = Number(raw[k]);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  };
  return {
    text: str("text"),
    categorySlug: str("categorySlug"),
    area: str("area"),
    experience: str("experience"),
    employment: str("employment"),
    salary: num("salary"),
    salaryTo: num("salaryTo"),
    company: str("company"),
    verified: raw.verified === true ? true : undefined,
    premium: raw.premium === true ? true : undefined,
  };
}

/** Saqlangan qidiruvni sayt URL'iga aylantiradi (xabarnomadagi havola uchun): `/vacancies?q=&region=…`. */
export function paramsToUrl(params: SavedSearchParams): string {
  const qs = new URLSearchParams();
  const list = (value: string | undefined, map?: Record<string, string>) =>
    (value ?? "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean)
      .map((v) => map?.[v] ?? v)
      .join(",");
  if (params.text) qs.set("q", params.text);
  if (params.categorySlug) qs.set("category", params.categorySlug);
  if (params.area) qs.set("region", list(params.area));
  if (params.employment) qs.set("workType", list(params.employment, EMPLOYMENT_URL));
  if (params.experience) qs.set("experience", list(params.experience, EXPERIENCE_URL));
  if (params.salary) qs.set("salaryFrom", String(params.salary));
  if (params.salaryTo) qs.set("salaryTo", String(params.salaryTo));
  if (params.company) qs.set("company", list(params.company));
  if (params.verified) qs.set("verified", "1");
  if (params.premium) qs.set("premium", "1");
  const str = qs.toString();
  return str ? `/vacancies?${str}` : "/vacancies";
}

interface SweepResult {
  checked: number;
  notified: number;
  matched: number;
  /** Boshqa aylanish hali tugamagani uchun bu chaqiruv o'tkazib yuborildi. */
  skipped?: boolean;
}

let running = false;

/**
 * Bir marta to'liq aylanib chiqadi. Qo'lda ham chaqirsa bo'ladi
 * (admin paneldagi "obunalarni hozir tekshirish" tugmasi).
 */
export async function runAlertSweep(): Promise<SweepResult> {
  if (running) return { checked: 0, notified: 0, matched: 0, skipped: true };
  running = true;
  try {
    return await sweep();
  } finally {
    running = false;
  }
}

async function sweep(): Promise<SweepResult> {
  const now = new Date();
  // Eng oxirgi chop etilgan faol vakansiya — undan keyin tekshirilgan obunaga qidiruv kerak emas
  const newest = await prisma.vacancy.findFirst({
    where: { status: "active", publishedAt: { not: null } },
    orderBy: { publishedAt: "desc" },
    select: { publishedAt: true },
  });

  let checked = 0;
  let notified = 0;
  let matched = 0;
  let lastId: string | undefined;

  for (;;) {
    // Keyset sahifalash (`id > oxirgi`): Prisma cursor chegaradagi yozuv aylanish paytida o'chirilsa
    // skanerlashni muddatidan oldin tugatardi (audit PHASE 6, U15)
    const searches = await prisma.savedSearch.findMany({
      where: { emailAlertsEnabled: true, ...(lastId ? { id: { gt: lastId } } : {}) },
      include: { user: { select: { id: true, isBlocked: true } } },
      orderBy: { id: "asc" },
      take: BATCH,
    });
    if (searches.length === 0) break;
    lastId = searches[searches.length - 1].id;

    for (const search of searches) {
      checked += 1;
      if (search.user.isBlocked) continue;

      // Kunlik obuna — kuniga bir marta
      if (
        search.frequency === "daily" &&
        search.lastNotifiedAt &&
        now.getTime() - search.lastNotifiedAt.getTime() < DAILY_GAP_MS
      ) {
        continue;
      }

      // Birinchi tekshiruvda eski bazani "yangilik" deb yubormaymiz —
      // faqat vaqt belgisini qo'yamiz va keyingi safardan boshlab kuzatamiz.
      const since = search.lastNotifiedAt;
      if (!since) {
        // `updateMany` — obuna aylanish paytida o'chirilgan bo'lsa ham xato bermaydi, butun aylanish to'xtamaydi
        await prisma.savedSearch.updateMany({ where: { id: search.id }, data: { lastNotifiedAt: now } });
        continue;
      }

      // Oxirgi tekshiruvdan keyin umuman yangi e'lon chiqmagan — qidiruvsiz o'tamiz
      if (!newest?.publishedAt || newest.publishedAt <= since) continue;

      // Optimistik qulf: boshqa jarayon (deploy overlap) shu obunani allaqachon olgan bo'lsa — o'tkazamiz.
      // Belgi — aynan qulf olingan payt, qidiruv esa (since; claimedAt] oralig'i bilan cheklanadi. Ilgari aylanish
      // boshlangan vaqt yozilib, qidiruv yuqori chegarasiz edi: oraliqda chiqqan e'lon hozir ham, keyingi
      // aylanishda ham yuborilardi (audit PHASE 6, V6)
      const claimedAt = new Date();
      const claimed = await prisma.savedSearch.updateMany({
        where: { id: search.id, lastNotifiedAt: since },
        data: { lastNotifiedAt: claimedAt },
      });
      if (claimed.count === 0) continue;

      try {
        const params = parseQueryParams(search.queryParams);
        const query: VacancyListQuery = {
          ...params,
          sort: "date",
          page: 1,
          pageSize: 20,
          publishedAfter: since,
          publishedBefore: claimedAt,
        };
        const { items } = await listVacancies(query);

        const fresh = (items as { id: string; title: string; slug: string; publishedAt: Date | null }[]).filter(
          (v) => v.publishedAt && v.publishedAt > since && v.publishedAt <= claimedAt
        );
        if (fresh.length === 0) continue;

        const preview = fresh.slice(0, PREVIEW_COUNT);
        const listHtml = preview
          .map(
            (v) =>
              `<li style="margin:0 0 6px"><a href="${env.WEB_ORIGIN}/vacancies/${encodeURIComponent(
                v.slug
              )}" style="color:#1f6feb;text-decoration:none">${escapeHtml(v.title)}</a></li>`
          )
          .join("");
        const more =
          fresh.length > preview.length
            ? `<p style="margin:10px 0 0;color:#6b7280">...va yana ${fresh.length - preview.length} ta</p>`
            : "";

        // Yuborish xatosi shu yerda yutiladi: qisman yuborilgan xabarnoma qulf qaytarilib takrorlanmasin
        await notify({
          userId: search.userId,
          type: "new_vacancy_match",
          title: `"${search.name}" bo'yicha ${fresh.length} ta yangi vakansiya`,
          body: preview.map((v) => v.title).join(", "),
          url: paramsToUrl(params),
          payload: { savedSearchId: search.id, count: fresh.length },
          // Web matnni joriy tilda chizadi; bazadagi `title`/`body` o'zbekcha qoladi (audit R3, D-059)
          i18n: {
            key: "alerts.newMatches",
            params: {
              searchName: search.name,
              count: fresh.length,
              titles: preview.map((v) => v.title).join(", "),
            },
          },
          ctaLabel: "Barchasini ko'rish",
          emailHtml: `<p style="margin:0 0 12px">Siz obuna bo'lgan <b>${escapeHtml(
            search.name
          )}</b> so'rovi bo'yicha yangi vakansiyalar chiqdi:</p>
          <ul style="margin:0;padding-left:18px">${listHtml}</ul>${more}`,
        }).catch(() => undefined);

        matched += fresh.length;
        notified += 1;
      } catch (error) {
        // Qidiruv xatosi (masalan vaqtinchalik baza xatosi): oyna yo'qolmasin — qulf faqat hali biz qo'ygan belgi
        // turgan bo'lsa qaytariladi va keyingi obunaga o'tiladi; ilgari butun aylanish to'xtardi (audit PHASE 6, V7)
        await prisma.savedSearch
          .updateMany({ where: { id: search.id, lastNotifiedAt: claimedAt }, data: { lastNotifiedAt: since } })
          .catch(() => undefined);
        console.warn(`[alerts] obuna ${search.id} tekshiruvi xatosi:`, (error as Error).message);
      }
    }

    if (searches.length < BATCH) break;
  }

  return { checked, notified, matched };
}

let timer: NodeJS.Timeout | null = null;

/** Rejalashtirilgan tekshiruvni yoqadi (server ko'tarilganda chaqiriladi). */
export function startAlertScheduler(log?: { info: (o: unknown, m?: string) => void }): void {
  if (timer) return;
  const intervalMs = Math.max(env.ALERTS_INTERVAL_MINUTES, 1) * 60 * 1000;

  const tick = async () => {
    try {
      // Bir nechta nusxada ishlayotgan bo'lsa tekshiruvni FAQAT bittasi bajaradi (audit: scale-redis-5):
      // aks holda har bir nusxa o'z navbatida bir xil obunachiga xat yuborardi. Qulf muddati
      // oraliqdan biroz qisqa — navbatdagi tekshiruv baribir o'tkazib yuborilmaydi.
      const mine = await acquireLock("alerts:sweep", Math.max(30_000, intervalMs - 5_000), "deny");
      if (!mine) return;
      const result = await runAlertSweep();
      if (result.notified > 0) {
        log?.info(result, "Obuna xabarnomalari yuborildi");
      }
    } catch (e) {
      console.warn("[alerts] tekshiruv xatosi:", (e as Error).message);
    }
  };

  // Server ko'tarilishini kutamiz (birinchi tekshiruv 1 daqiqadan keyin)
  setTimeout(tick, 60_000).unref?.();
  timer = setInterval(tick, intervalMs);
  timer.unref?.();
}

/** Graceful shutdown uchun. */
export function stopAlertScheduler(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
