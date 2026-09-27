import type { FastifyInstance } from "fastify";
import { prisma } from "../../common/prisma.js";
import { renderVacancyOgImage } from "./og.service.js";
import { formatSalaryLabel } from "../../common/format.js";
import { keyedCache } from "../../common/cache.js";

/**
 * Ulashish rasmi tilga qarab (audit R3, i18n-10): `?lang=ru|en` berilmasa o'zbekcha —
 * ya'ni eski chaqiruvlar uchun natija o'zgarmaydi. Hudud nomi bazada faqat o'zbekcha
 * saqlanadi, shuning uchun faqat maosh yozuvi va hududsiz zaxira nomi tarjima qilinadi.
 */
const OG_LANGS = ["uz", "ru", "en"] as const;
type OgLang = (typeof OG_LANGS)[number];

const OG_TEXT: Record<OgLang, { country: string; hidden: string; from: string; to: string; currency: string; locale: string }> = {
  uz: { country: "O'zbekiston", hidden: "Maosh ko'rsatilmagan", from: "dan", to: "gacha", currency: "so'm", locale: "ru-RU" },
  ru: { country: "Узбекистан", hidden: "Зарплата не указана", from: "от", to: "до", currency: "сум", locale: "ru-RU" },
  en: { country: "Uzbekistan", hidden: "Salary not specified", from: "from", to: "up to", currency: "UZS", locale: "en-US" },
};

function ogLang(value: unknown): OgLang {
  return typeof value === "string" && (OG_LANGS as readonly string[]).includes(value) ? (value as OgLang) : "uz";
}

function salaryLabel(lang: OgLang, min: number | null, max: number | null, currency: string): string {
  // O'zbekcha matn umumiy yordamchidan — mavjud rasmlar aynan o'zgarmasin
  if (lang === "uz") return formatSalaryLabel(min, max, currency);
  const text = OG_TEXT[lang];
  const cur = currency === "UZS" ? text.currency : currency;
  const fmt = (n: number) => new Intl.NumberFormat(text.locale).format(n);
  if (!min && !max) return text.hidden;
  if (min && max) return `${fmt(min)} – ${fmt(max)} ${cur}`;
  if (min) return `${text.from} ${fmt(min)} ${cur}`;
  return `${text.to} ${fmt(max as number)} ${cur}`;
}

/**
 * Tayyor PNG keshi (audit R3, seo-16): har ochilishda satori + resvg qaytadan chizardi.
 * Kalit — slug, til va e'lonning `updatedAt` vaqti, shuning uchun sarlavha yoki maosh
 * o'zgarsa kesh o'z-o'zidan chetlab o'tiladi (versiya bo'limlariga bog'liq emas).
 */
const ogCache = keyedCache<Buffer>(30 * 60_000, 50, []);

export async function ogRoutes(app: FastifyInstance) {
  app.get("/api/og/vacancy/:slug", async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const lang = ogLang((req.query as { lang?: unknown } | undefined)?.lang);

    const vacancy = await prisma.vacancy.findUnique({
      where: { slug },
      select: {
        title: true,
        status: true,
        salaryMin: true,
        salaryMax: true,
        currency: true,
        isSalaryHidden: true,
        updatedAt: true,
        company: { select: { name: true } },
        region: { select: { name: true } },
      },
    });

    // Faqat ochiq (faol) e'lon: qoralama, rad etilgan yoki yopilgan e'lon sarlavhasi rasm orqali
    // oshkor bo'lmasin (audit ISSUE-034)
    if (!vacancy || vacancy.status !== "active") {
      return reply.status(404).send({ error: "NOT_FOUND", message: "Topilmadi" });
    }

    const png = await ogCache(`${slug}:${lang}:${vacancy.updatedAt.getTime()}`, () =>
      renderVacancyOgImage({
        title: vacancy.title,
        companyName: vacancy.company.name,
        regionName: vacancy.region?.name ?? OG_TEXT[lang].country,
        // Yashirilgan maosh rasmga ham chiqmaydi
        salaryLabel: vacancy.isSalaryHidden
          ? salaryLabel(lang, null, null, vacancy.currency)
          : salaryLabel(lang, vacancy.salaryMin, vacancy.salaryMax, vacancy.currency),
      })
    );

    reply.header("Content-Type", "image/png");
    // `immutable` emas: e'lon yopilsa yoki maosh o'zgarsa ulashish rasmi ham yangilanadi
    reply.header("Cache-Control", "public, max-age=3600");
    return reply.send(png);
  });
}
