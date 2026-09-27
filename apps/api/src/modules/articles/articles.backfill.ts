import type { ArticleCategory, Prisma } from "@prisma/client";
import { prisma } from "../../common/prisma.js";
import { articleDerived } from "./articles.content.js";

/**
 * Maqolalar sxemasi kengaytirilishidan (status, teglar, hisoblagichlar…) OLDIN
 * yaratilgan hujjatlarni moslashtiradi. MongoDB'da migratsiya yo'q, Prisma esa
 * majburiy maydoni yo'q hujjatni o'qishda xato beradi. Idempotent: faqat
 * yetishmayotgan maydonlar yoziladi; chop etilgan sanasi bor maqola `published`,
 * qolgani `draft` bo'ladi. Server startup'ida (bootstrap) chaqiriladi.
 */

type RawDate = { $date: string | { $numberLong: string } };

interface RawArticle {
  _id: { $oid: string };
  title?: string;
  excerpt?: string | null;
  content?: string;
  tags?: string[];
  category?: ArticleCategory | null;
  status?: string;
  published_at?: RawDate | null;
  created_at?: RawDate;
  updated_at?: RawDate;
  search_text?: string;
  reading_minutes?: number | null;
  previous_slugs?: string[];
  views_count?: number;
  helpful_yes?: number;
  helpful_no?: number;
}

const REQUIRED = ["status", "tags", "previous_slugs", "views_count", "helpful_yes", "helpful_no", "search_text", "created_at", "updated_at"];

function toIso(value: RawDate | null | undefined): string | null {
  const raw = value?.$date;
  if (typeof raw === "string") return raw;
  if (raw && typeof raw === "object" && "$numberLong" in raw) return new Date(Number(raw.$numberLong)).toISOString();
  return null;
}

export async function backfillArticles(log?: { info: (o: unknown, m?: string) => void }): Promise<number> {
  const docs = (await prisma.article.findRaw({
    filter: { $or: REQUIRED.map((field) => ({ [field]: { $exists: false } })) },
  })) as unknown as RawArticle[];

  for (const doc of docs) {
    const publishedAt = toIso(doc.published_at);
    const stamp = { $date: publishedAt ?? new Date().toISOString() };
    const derived = articleDerived({
      title: doc.title ?? "",
      excerpt: doc.excerpt ?? null,
      content: doc.content ?? "",
      tags: doc.tags ?? [],
      category: doc.category ?? null,
    });
    const set: Record<string, unknown> = {};
    if (doc.status === undefined) set.status = publishedAt ? "published" : "draft";
    if (doc.tags === undefined) set.tags = [];
    if (doc.previous_slugs === undefined) set.previous_slugs = [];
    if (doc.views_count === undefined) set.views_count = 0;
    if (doc.helpful_yes === undefined) set.helpful_yes = 0;
    if (doc.helpful_no === undefined) set.helpful_no = 0;
    if (doc.search_text === undefined) set.search_text = derived.searchText;
    if (doc.reading_minutes === undefined) set.reading_minutes = derived.readingMinutes;
    if (doc.created_at === undefined) set.created_at = stamp;
    if (doc.updated_at === undefined) set.updated_at = stamp;

    await prisma.$runCommandRaw({
      update: "articles",
      updates: [{ q: { _id: { $oid: doc._id.$oid } }, u: { $set: set } }],
    } as Prisma.InputJsonObject);
  }

  if (docs.length > 0) log?.info({ count: docs.length }, "Eski maqolalar yangi sxemaga moslashtirildi");
  return docs.length;
}
