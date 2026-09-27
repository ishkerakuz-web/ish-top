import type { FastifyInstance } from "fastify";
import type { ArticleCategory, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../common/prisma.js";
import { Errors } from "../../common/errors.js";
import { boolish } from "../../common/validation.js";
import { ARTICLE_CATEGORIES, isValidSlug, normalizeSearch, searchWords } from "./articles.content.js";
import { recordView } from "../../common/views.js";
import { bumpCounter } from "../../common/counters.js";
import { firstTime, viewerKey } from "../../common/dedupe.js";

/**
 * Ochiq maqolalar API. Faqat `published` holatidagilar — qoralama, ko'rib
 * chiqilayotgan va arxivlangan maqola to'g'ridan-to'g'ri slug bilan ham
 * ochilmaydi (404, mavjud emasdek). Tahrirlash va ko'rib chiqish:
 * articles.admin.routes.ts.
 */

const PUBLISHED = { status: "published" } as const;
export const RELATED_LIMIT = 4;

/** "Foydali bo'ldimi?" ovozi shu muddat davomida bitta ovoz beruvchidan bir marta sanaladi (30 kun). */
const FEEDBACK_MEMORY_SEC = 30 * 24 * 3600;

const cardSelect = {
  id: true,
  slug: true,
  title: true,
  excerpt: true,
  coverImageUrl: true,
  category: true,
  readingMinutes: true,
  publishedAt: true,
} satisfies Prisma.ArticleSelect;

const listQuery = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.enum(ARTICLE_CATEGORIES).optional(),
  sort: z.enum(["newest", "oldest", "popular"]).default("newest"),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(30).default(9),
  // Birinchi sahifada eng tepadagi maqola alohida (katta karta) qaytadi
  featured: boolish().optional(),
});

const ORDER: Record<z.infer<typeof listQuery>["sort"], Prisma.ArticleOrderByWithRelationInput[]> = {
  newest: [{ publishedAt: "desc" }, { id: "desc" }],
  oldest: [{ publishedAt: "asc" }, { id: "asc" }],
  popular: [{ viewsCount: "desc" }, { publishedAt: "desc" }],
};

/**
 * Maqola hisoblagichlari (ko'rish, "foydali") endi bufer orqali yoziladi —
 * `common/counters.ts`. Hisoblagich `updatedAt` ga tegmaydi (aks holda har
 * ko'rish maqolani "tahrirlangan" qilib, sitemap'dagi `lastmod` ni buzardi).
 */

/** Mavzuga oid: bir xil kategoriya (+3) va umumiy teglar (har biri +2), keyin yangiligi. */
async function relatedArticles(article: { id: string; category: ArticleCategory | null; tags: string[] }) {
  const or: Prisma.ArticleWhereInput[] = [];
  if (article.category) or.push({ category: article.category });
  if (article.tags.length) or.push({ tags: { hasSome: article.tags } });
  if (or.length === 0) return [];

  const rows = await prisma.article.findMany({
    where: { ...PUBLISHED, id: { not: article.id }, OR: or },
    orderBy: { publishedAt: "desc" },
    take: 30,
    select: { ...cardSelect, tags: true },
  });
  const tagKeys = new Set(article.tags.map(normalizeSearch));
  return rows
    .map((row) => ({
      row,
      score:
        (row.category && row.category === article.category ? 3 : 0) +
        row.tags.filter((tag) => tagKeys.has(normalizeSearch(tag))).length * 2,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, RELATED_LIMIT)
    .map(({ row: { tags: _tags, ...card } }) => card);
}

export async function articleRoutes(app: FastifyInstance) {
  // Ro'yxat: qidiruv (sarlavha, qisqa tavsif, teglar, kategoriya nomi), kategoriya,
  // saralash va sahifalash. `categories` — faqat maqolasi bor kategoriyalar (haqiqiy sonlar).
  app.get("/api/articles", async (req) => {
    const query = listQuery.parse(req.query);
    const words = searchWords(query.q ?? "");
    const where: Prisma.ArticleWhereInput = {
      ...PUBLISHED,
      ...(query.category ? { category: query.category } : {}),
      ...(words.length ? { AND: words.map((word) => ({ searchText: { contains: word } })) } : {}),
    };

    const [total, groups] = await Promise.all([
      prisma.article.count({ where }),
      prisma.article.groupBy({ by: ["category"], where: PUBLISHED, _count: { _all: true } }),
    ]);

    const lead = query.featured ? 1 : 0;
    const pageCount = total === 0 ? 0 : Math.max(1, Math.ceil((total - lead) / query.pageSize));
    const page = Math.min(query.page, Math.max(1, pageCount));
    const rows =
      total === 0
        ? []
        : await prisma.article.findMany({
            where,
            orderBy: ORDER[query.sort],
            skip: page === 1 ? 0 : lead + (page - 1) * query.pageSize,
            take: page === 1 ? query.pageSize + lead : query.pageSize,
            select: cardSelect,
          });
    const withLead = lead === 1 && page === 1;

    return {
      items: withLead ? rows.slice(1) : rows,
      featured: withLead ? rows[0] ?? null : null,
      total,
      page,
      pageSize: query.pageSize,
      pageCount,
      categories: ARTICLE_CATEGORIES.map((key) => ({
        key,
        count: groups.find((g) => g.category === key)?._count._all ?? 0,
      })).filter((c) => c.count > 0),
      publishedTotal: groups.reduce((sum, g) => sum + g._count._all, 0),
    };
  });

  // Bitta maqola. Eski slug bilan kelinsa — `redirectTo` (sahifa 301 qiladi).
  app.get("/api/articles/:slug", async (req) => {
    const { slug } = req.params as { slug: string };
    if (!isValidSlug(slug)) throw Errors.notFound("Maqola topilmadi");

    const article = await prisma.article.findFirst({
      where: { slug, ...PUBLISHED },
      include: { author: { select: { staffProfile: { select: { fullName: true, position: true, avatarUrl: true } } } } },
    });
    if (!article) {
      const moved = await prisma.article.findFirst({
        where: { previousSlugs: { has: slug }, ...PUBLISHED },
        select: { slug: true },
      });
      if (moved) return { article: null, related: [], redirectTo: moved.slug };
      throw Errors.notFound("Maqola topilmadi");
    }

    // Ko'rish bu yerda sanalmaydi — brauzer `POST /api/articles/:slug/view` yuboradi (audit: views-1)
    const related = await relatedArticles(article);
    const profile = article.author?.staffProfile ?? null;

    return {
      article: {
        id: article.id,
        slug: article.slug,
        title: article.title,
        excerpt: article.excerpt,
        content: article.content,
        coverImageUrl: article.coverImageUrl,
        category: article.category,
        tags: article.tags,
        readingMinutes: article.readingMinutes,
        publishedAt: article.publishedAt,
        updatedAt: article.updatedAt,
        metaTitle: article.metaTitle,
        metaDescription: article.metaDescription,
        // Muallif belgisi: ism, lavozim, avatar. Email va ID ochiq javobga chiqmaydi.
        author: profile ? { name: profile.fullName, position: profile.position, avatarUrl: profile.avatarUrl } : null,
      },
      related,
    };
  });

  /** Ko'rishni qayd etish — sahifa brauzerda ochilgach yuboriladi (audit: views-1). */
  app.post(
    "/api/articles/:slug/view",
    { config: { rateLimit: { max: 120, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const { slug } = req.params as { slug: string };
      const result = await recordView(req, "articles", slug);
      return reply.status(202).send(result);
    }
  );

  /**
   * "Foydali bo'ldimi?" — anonim ovoz, bitta ovoz beruvchidan BIR MARTA (audit: views-2).
   *
   * Ilgari faqat brauzer o'zi eslab qolardi (localStorage): saqlangan belgini tozalab yoki
   * to'g'ridan-to'g'ri so'rov yuborib bir odam hisoblagichni istagancha shishira olardi —
   * yagona to'siq daqiqasiga 20 ta so'rov edi. Endi server ham eslab qoladi
   * (`FEEDBACK_MEMORY_SEC`), takroriy ovoz `counted: false` bilan jim qaytadi.
   */
  app.post(
    "/api/articles/:slug/feedback",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (req) => {
      const { slug } = req.params as { slug: string };
      const { helpful } = z.object({ helpful: z.boolean() }).parse(req.body);
      const article = isValidSlug(slug)
        ? await prisma.article.findFirst({ where: { slug, ...PUBLISHED }, select: { id: true } })
        : null;
      if (!article) throw Errors.notFound("Maqola topilmadi");

      const fresh = await firstTime(`vote:${article.id}:${viewerKey(req)}`, FEEDBACK_MEMORY_SEC);
      if (!fresh) return { ok: true, counted: false };
      bumpCounter("articles", slug, helpful ? "helpful_yes" : "helpful_no");
      return { ok: true, counted: true };
    }
  );
}
