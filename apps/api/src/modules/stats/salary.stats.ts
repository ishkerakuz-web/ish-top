import { z } from "zod";
import { prisma } from "../../common/prisma.js";
import { cached } from "../../common/cache.js";
import { normalizeApostrophes } from "../../common/search-text.js";

/**
 * Maosh tahlili — hh.uz'dagi "maosh statistikasi" sahifasining analogi:
 * kasb, hudud va tajriba kesimida mediana/o'rtacha maosh, taqsimot va
 * eng yaxshi to'lanadigan yo'nalishlar. Faqat maoshi ochiq ko'rsatilgan,
 * so'mdagi faol vakansiyalar hisobga olinadi (valyutalar aralashmasin).
 *
 * Bitta so'rov: faol vakansiyalarning yengil proyeksiyasi o'qiladi, qolgan
 * hammasi xotirada. Shu tufayli barcha raqamlar bir-biriga mos keladi va
 * jadvallar "o'z" filtrini chetlab hisoblanadi: masalan hudud tanlanganda
 * hududlar jadvali bitta qatorga qisqarib qolmaydi — tanlangani ajratiladi.
 */

export const EXPERIENCE_LEVELS = ["none", "one_to_three", "three_to_six", "six_plus"] as const;
type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];

/**
 * Ommabop kasblar. Kalit so'zlar sarlavhada so'z boshidan qidiriladi
 * ("sotuv" → "sotuvchi" ham), qisqa so'zlar (hr, smm, php) esa butun so'z
 * sifatida — "shahri" HR bo'lib qolmasin. Lotin, kirill va inglizcha
 * yozilishlar birga.
 */
const ROLE_KEYWORDS = {
  "frontend-developer": {
    include: ["frontend", "front-end", "front end", "фронтенд", "фронт-энд", "react", "vue", "angular", "верстальщик"],
    exclude: ["react native"],
  },
  "backend-developer": {
    include: ["backend", "back-end", "back end", "бэкенд", "бекенд", "node.js", "nodejs", "python", "php", "golang", "laravel", "django", ".net"],
  },
  "ui-ux-designer": {
    include: ["ui/ux", "ux/ui", "ui-ux", "ux-ui", "ux", "product designer", "mahsulot dizayner", "web dizayner", "web-dizayner", "веб-дизайнер", "дизайнер интерфейсов"],
  },
  marketer: {
    include: ["marketolog", "маркетолог", "marketer", "marketing", "маркетинг", "smm", "targetolog", "таргетолог"],
  },
  accountant: { include: ["buxgalter", "бухгалтер", "accountant", "hisobchi"] },
  "sales-manager": {
    include: ["sotuv", "sales", "продаж", "savdo menejeri", "savdo vakili", "торговый представитель"],
  },
  hr: { include: ["hr", "kadrlar", "rekruter", "recruiter", "рекрутер", "кадр", "personal bo'yicha"] },
  "data-analyst": {
    include: ["data analit", "data analyst", "data scientist", "bi analit", "bi-analit", "ma'lumotlar tahlil", "аналитик данных"],
  },
} as const satisfies Record<string, { include: readonly string[]; exclude?: readonly string[] }>;

export const SALARY_ROLES = Object.keys(ROLE_KEYWORDS) as [keyof typeof ROLE_KEYWORDS, ...(keyof typeof ROLE_KEYWORDS)[]];
export type SalaryRole = keyof typeof ROLE_KEYWORDS;

const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);

export const salaryQuerySchema = z.object({
  categorySlug: z.string().max(80).optional(),
  area: z.string().max(80).optional(),
  experience: z.preprocess(emptyToUndefined, z.enum(EXPERIENCE_LEVELS).optional()),
  role: z.preprocess(emptyToUndefined, z.enum(SALARY_ROLES).optional()),
  q: z.string().trim().max(100).optional(),
});

export type SalaryQuery = z.infer<typeof salaryQuerySchema>;

/** Taqsimot uchun ustunlar: 0–3, 3–6, 6–10, 10–15, 15–25, 25+ mln so'm. */
const BUCKETS: { from: number; to: number | null; label: string }[] = [
  { from: 0, to: 3_000_000, label: "0–3 mln" },
  { from: 3_000_000, to: 6_000_000, label: "3–6 mln" },
  { from: 6_000_000, to: 10_000_000, label: "6–10 mln" },
  { from: 10_000_000, to: 15_000_000, label: "10–15 mln" },
  { from: 15_000_000, to: 25_000_000, label: "15–25 mln" },
  { from: 25_000_000, to: null, label: "25 mln+" },
];

/** Bitta so'rovda o'qiladigan eng ko'p vakansiya (eng yangilari). */
const MAX_ROWS = 20_000;

/** Vakansiyaning "vakil" maoshi — oraliq berilgan bo'lsa o'rtasi. */
function midpoint(min: number | null, max: number | null): number | null {
  if (min && max) return Math.round((min + max) / 2);
  return min ?? max ?? null;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return Math.round(sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo));
}

function average(values: number[]): number {
  return values.length ? Math.round(values.reduce((s, n) => s + n, 0) / values.length) : 0;
}

/**
 * Katta-kichik harf va tutuq belgisi turlari farq qilmasin — variantlar ro'yxati qidiruv
 * bilan bitta manbadan (audit R3, D-080).
 */
function normalize(text: string): string {
  return normalizeApostrophes(text).toLocaleLowerCase("ru-RU");
}

function escapeRegex(text: string): string {
  // `-` ataylab yo'q: `u` bayrog'ida sinfdan tashqari `\-` sintaksis xatosi
  return text.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
}

const WORD = "[\\p{L}\\p{N}]";

const roleMatchers = new Map<SalaryRole, { include: RegExp; exclude: RegExp | null }>();

function roleMatcher(role: SalaryRole) {
  let matcher = roleMatchers.get(role);
  if (!matcher) {
    const build = (words: readonly string[]) =>
      new RegExp(
        `(?<!${WORD})(?:${words
          .map((w) => escapeRegex(normalize(w)) + (w.length <= 3 ? `(?!${WORD})` : ""))
          .join("|")})`,
        "u"
      );
    const spec: { include: readonly string[]; exclude?: readonly string[] } = ROLE_KEYWORDS[role];
    matcher = { include: build(spec.include), exclude: spec.exclude ? build(spec.exclude) : null };
    roleMatchers.set(role, matcher);
  }
  return matcher;
}

interface Row {
  title: string;
  value: number | null;
  experience: ExperienceLevel;
  category: { name: string; slug: string } | null;
  region: { name: string; slug: string } | null;
}

interface GroupStat {
  name: string;
  slug: string;
  count: number;
  median: number;
  average: number;
}

function groupBy(rows: Row[], pick: (row: Row) => { name: string; slug: string } | null): GroupStat[] {
  const groups = new Map<string, { name: string; slug: string; values: number[] }>();
  for (const row of rows) {
    const key = pick(row);
    if (!key || row.value === null) continue;
    const entry = groups.get(key.slug) ?? { name: key.name, slug: key.slug, values: [] };
    entry.values.push(row.value);
    groups.set(key.slug, entry);
  }
  return [...groups.values()]
    .map((g) => {
      const sorted = [...g.values].sort((a, b) => a - b);
      return { name: g.name, slug: g.slug, count: sorted.length, median: percentile(sorted, 0.5), average: average(sorted) };
    })
    .sort((a, b) => b.median - a.median || b.count - a.count);
}

/**
 * Faol vakansiyalarning yengil proyeksiyasi — 5 daqiqa kesh (audit ISSUE-051). Filtrlar xotirada
 * qo'llanadi, shuning uchun bitta umumiy to'plam yetarli; vakansiya yozilganda (`bumpDataVersion`)
 * kesh darhol yangilanadi. To'plam faqat o'qiladi: pastdagi hisoblar uni o'zgartirmaydi.
 *
 * Audit R3 (db-perf-6, scale-10k-5): kesh endi FAQAT `vacancies` bo'limiga bog'liq — sharh yoki
 * kompaniya profili yozilishi 20 000 qatorli to'plamni qaytadan o'qitmaydi.
 */
const loadDataset = cached(
  5 * 60_000,
  async () => {
    const vacancies = await prisma.vacancy.findMany({
      where: { status: "active" },
      select: {
        title: true,
        salaryMin: true,
        salaryMax: true,
        currency: true,
        isSalaryHidden: true,
        experienceRequired: true,
        category: { select: { name: true, slug: true } },
        region: { select: { name: true, slug: true } },
      },
      orderBy: { publishedAt: "desc" },
      take: MAX_ROWS,
    });

    // Chegaraga yetildi: statistika eng yangi MAX_ROWS ta e'lon bo'yicha hisoblanadi — buni
    // javobdagi `truncated` bayrog'i va log ochiq aytadi (audit R3, db-perf-17 / scale-10k-18)
    const truncated = vacancies.length >= MAX_ROWS;
    if (truncated) {
      console.warn(`[stats] maosh to'plami ${MAX_ROWS} ta faol vakansiya bilan chegaralandi`);
    }

    const rows: Row[] = vacancies.map((v: (typeof vacancies)[number]) => {
      const value = v.currency === "UZS" && !v.isSalaryHidden ? midpoint(v.salaryMin, v.salaryMax) : null;
      return {
        title: normalize(v.title),
        value: value && value > 0 ? value : null,
        experience: v.experienceRequired as ExperienceLevel,
        category: v.category,
        region: v.region,
      };
    });

    // Bozor bazasi — hech qanday filtrsiz (kartalardagi "bozorga nisbatan" farq uchun)
    const marketValues = rows.flatMap((r) => (r.value === null ? [] : [r.value])).sort((a, b) => a - b);
    return { rows, marketValues, truncated };
  },
  ["vacancies"]
);

export async function salaryStats(query: SalaryQuery) {
  const { rows, marketValues, truncated } = await loadDataset();

  // Kasb yoki erkin matn: har bir so'z sarlavhada yoki kategoriya nomida uchrashi shart
  const role = query.role ? roleMatcher(query.role) : null;
  const terms = (query.q ?? "")
    .split(/\s+/)
    .map(normalize)
    .filter((t) => t.length >= 2)
    .slice(0, 6);
  const matched = rows.filter((r) => {
    if (role && (!role.include.test(r.title) || role.exclude?.test(r.title))) return false;
    if (terms.length) {
      const haystack = `${r.title} ${r.category ? normalize(r.category.name) : ""}`;
      if (!terms.every((t) => haystack.includes(t))) return false;
    }
    return true;
  });

  const inCategory = (r: Row) => !query.categorySlug || r.category?.slug === query.categorySlug;
  const inRegion = (r: Row) => !query.area || r.region?.slug === query.area;
  const inExperience = (r: Row) => !query.experience || r.experience === query.experience;

  const selected = matched.filter((r) => inCategory(r) && inRegion(r) && inExperience(r));
  const salaried = matched.filter((r) => r.value !== null);
  const values = selected.flatMap((r) => (r.value === null ? [] : [r.value])).sort((a, b) => a - b);

  const summary = {
    count: values.length,
    currency: "UZS",
    min: values[0] ?? 0,
    max: values[values.length - 1] ?? 0,
    average: average(values),
    median: percentile(values, 0.5),
    p25: percentile(values, 0.25),
    p75: percentile(values, 0.75),
  };

  const distribution = BUCKETS.map((b) => ({
    label: b.label,
    from: b.from,
    to: b.to,
    count: values.filter((v) => v >= b.from && (b.to === null || v < b.to)).length,
  }));

  const byExperience = EXPERIENCE_LEVELS.map((level) => {
    const levelValues = salaried
      .filter((r) => r.experience === level && inCategory(r) && inRegion(r))
      .map((r) => r.value as number)
      .sort((a, b) => a - b);
    return { level, count: levelValues.length, median: percentile(levelValues, 0.5), average: average(levelValues) };
  });

  return {
    summary,
    distribution,
    byCategory: groupBy(salaried.filter((r) => inRegion(r) && inExperience(r)), (r) => r.category),
    byRegion: groupBy(salaried.filter((r) => inCategory(r) && inExperience(r)), (r) => r.region),
    byExperience,
    /** Tanlovga mos faol vakansiyalar — maoshi yashirinlari ham. */
    vacancyCount: selected.length,
    /** To'plam chegaraga yetgan bo'lsa `true`: raqamlar eng yangi e'lonlar bo'yicha (audit R3, db-perf-17). */
    truncated,
    market: { count: marketValues.length, median: percentile(marketValues, 0.5), average: average(marketValues) },
  };
}
