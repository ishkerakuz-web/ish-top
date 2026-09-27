import crypto from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { ArticleStatus, Prisma, UserRole } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../common/prisma.js";
import { AppError, Errors } from "../../common/errors.js";
import { requireAuth, requireStaff } from "../../common/auth-guard.js";
import { isObjectId, objectId } from "../../common/validation.js";
import { removeUploadedFile, saveUpload } from "../../common/uploads.js";
import {
  ARTICLE_CATEGORIES,
  COVER_URL_RE,
  MIN_PUBLISH_CHARS,
  articleDerived,
  articleSlug,
  hasEnoughContent,
  isValidSlug,
  normalizeTags,
} from "./articles.content.js";
import {
  EDITOR_ROLES,
  STAFF_ROLES,
  TRANSITIONS,
  TRANSITION_TARGET,
  articlePermissions,
  canViewArticle,
  isEditorRole,
} from "./articles.permissions.js";

/**
 * Kontent boshqaruvi (CMS). Har bir yo'l `requireStaff` bilan himoyalangan:
 * nomzod va ish beruvchi — 403, tokensiz — 401. Rol va blok holati har
 * so'rovda BAZADAN o'qiladi. Amal ruxsatlari: articles.permissions.ts.
 */

const staffOnly = { preHandler: [requireAuth, requireStaff(...STAFF_ROLES)] };
const editorsOnly = { preHandler: [requireAuth, requireStaff(...EDITOR_ROLES)] };

/** Berilmagan — o'zgarmaydi (`undefined`), bo'sh satr — tozalanadi (`null`). */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => (v === undefined ? undefined : v || null));

const articleBody = z.object({
  title: z.string().trim().min(3).max(160),
  slug: z.string().trim().max(90).optional(),
  excerpt: optionalText(300),
  content: z.string().max(60_000),
  coverImageUrl: optionalText(500).refine((v) => v == null || COVER_URL_RE.test(v), "Muqova manzili noto'g'ri"),
  category: z.enum(ARTICLE_CATEGORIES).nullable().optional(),
  tags: z.array(z.string().max(60)).max(20).optional(),
  authorId: objectId().nullable().optional(),
  metaTitle: optionalText(70),
  metaDescription: optionalText(170),
  // Saqlash bilan birga holat: qoralama (o'zgarmaydi), ko'rib chiqishga yoki chop etish
  intent: z.enum(["draft", "review", "publish"]).optional(),
});

const withAuthor = {
  author: {
    select: {
      id: true,
      email: true,
      staffProfile: { select: { fullName: true, position: true, avatarUrl: true } },
    },
  },
} satisfies Prisma.ArticleInclude;

type ArticleWithAuthor = Prisma.ArticleGetPayload<{ include: typeof withAuthor }>;

function forbidden(message: string): AppError {
  return new AppError(403, "FORBIDDEN", message);
}

function authorView(author: ArticleWithAuthor["author"]) {
  if (!author) return null;
  return {
    id: author.id,
    name: author.staffProfile?.fullName || author.email.split("@")[0],
    position: author.staffProfile?.position ?? null,
    avatarUrl: author.staffProfile?.avatarUrl ?? null,
  };
}

function listItem(a: ArticleWithAuthor, role: UserRole, userId: string) {
  return {
    id: a.id,
    title: a.title,
    slug: a.slug,
    status: a.status,
    category: a.category,
    coverImageUrl: a.coverImageUrl,
    readingMinutes: a.readingMinutes,
    reviewNote: a.reviewNote,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
    publishedAt: a.publishedAt,
    author: authorView(a.author),
    permissions: articlePermissions(role, userId, a),
  };
}

function detail(a: ArticleWithAuthor, role: UserRole, userId: string) {
  return {
    ...listItem(a, role, userId),
    excerpt: a.excerpt,
    content: a.content,
    tags: a.tags,
    metaTitle: a.metaTitle,
    metaDescription: a.metaDescription,
    previousSlugs: a.previousSlugs,
    stats: { views: a.viewsCount, helpfulYes: a.helpfulYes, helpfulNo: a.helpfulNo },
  };
}

function staffOf(req: FastifyRequest) {
  return { userId: req.user!.sub, role: req.user!.role };
}

async function findVisible(req: FastifyRequest) {
  const { id } = req.params as { id: string };
  if (!isObjectId(id)) throw Errors.notFound("Maqola topilmadi");
  const article = await prisma.article.findUnique({ where: { id }, include: withAuthor });
  if (!article) throw Errors.notFound("Maqola topilmadi");
  const { userId, role } = staffOf(req);
  if (!canViewArticle(role, userId, article)) throw forbidden("Bu maqola sizga tegishli emas");
  return article;
}

/** Slug band: boshqa maqolaning joriy yoki eski (yo'naltiriladigan) slug'i. */
async function slugTaken(slug: string, excludeId?: string): Promise<boolean> {
  const found = await prisma.article.findFirst({
    where: { OR: [{ slug }, { previousSlugs: { has: slug } }], ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { id: true },
  });
  return Boolean(found);
}

/** Qo'lda berilgan slug band bo'lsa — 409; sarlavhadan yasalgani band bo'lsa — "-2", "-3"… */
async function resolveSlug(title: string, requested: string | undefined, excludeId?: string): Promise<string> {
  const explicit = requested?.trim();
  if (explicit) {
    if (!isValidSlug(explicit)) {
      throw new AppError(400, "INVALID_SLUG", "Slug faqat kichik lotin harflari, raqam va chiziqchadan iborat bo'lsin (3–90 belgi)");
    }
    if (await slugTaken(explicit, excludeId)) throw new AppError(409, "SLUG_TAKEN", "Bu slug boshqa maqolada band");
    return explicit;
  }
  const fromTitle = articleSlug(title);
  const base = fromTitle.length >= 3 ? fromTitle : fromTitle ? `${fromTitle}-maqola` : "maqola";
  for (let i = 1; i <= 50; i++) {
    const candidate = i === 1 ? base : `${base}-${i}`;
    if (!(await slugTaken(candidate, excludeId))) return candidate;
  }
  return `${base}-${crypto.randomBytes(3).toString("hex")}`;
}

/**
 * Muallif: CONTENT_AUTHOR har doim o'zi (boshqaga o'tkaza olmaydi). Muharrir va
 * admin jamoa a'zosini tanlaydi yoki muallifsiz qoldiradi (`null`).
 */
async function resolveAuthorId(
  role: UserRole,
  userId: string,
  requested: string | null | undefined,
  current?: string | null
): Promise<string | null> {
  if (!isEditorRole(role) || requested === undefined) return current === undefined ? userId : current;
  if (requested === null) return null;
  const staff = await prisma.user.findUnique({ where: { id: requested }, select: { role: true } });
  if (!staff || !STAFF_ROLES.includes(staff.role)) {
    throw new AppError(400, "INVALID_AUTHOR", "Muallif kontent jamoasi a'zosi bo'lishi kerak");
  }
  return requested;
}

function assertPublishable(content: string) {
  if (!hasEnoughContent(content)) {
    throw new AppError(
      400,
      "CONTENT_TOO_SHORT",
      `Ko'rib chiqishga yuborish yoki chop etish uchun maqola matni kamida ${MIN_PUBLISH_CHARS} belgi bo'lsin`
    );
  }
}

/** Faqat shu jarayon yuklagan muqova fayli (demo va boshqa fayllarga tegilmaydi). */
function removeCoverFile(url: string | null) {
  removeUploadedFile(url, "article-cover-");
}

export async function articleAdminRoutes(app: FastifyInstance) {
  // ---------------------------------------------------------
  // Ro'yxat: qidiruv (sarlavha / muallif), holat filtri, holatlar soni
  // ---------------------------------------------------------
  app.get("/api/admin/articles", staffOnly, async (req) => {
    const { userId, role } = staffOf(req);
    const query = z
      .object({
        q: z.string().trim().max(120).optional(),
        status: z.enum(["draft", "in_review", "published", "archived"]).optional(),
        page: z.coerce.number().int().min(1).max(10_000).default(1),
        pageSize: z.coerce.number().int().min(1).max(50).default(20),
      })
      .parse(req.query);

    const like = query.q ? { contains: query.q, mode: "insensitive" as const } : null;
    // Muallif bo'yicha qidiruv ikki bosqichda: MongoDB'da sarlavha sharti bilan relation
    // filtrini bitta OR ichida birlashtirish Prisma aggregatsiyasini yiqitadi ($size null).
    const authorIds = like
      ? (
          await prisma.user.findMany({
            where: { role: { in: STAFF_ROLES }, OR: [{ email: like }, { staffProfile: { is: { fullName: like } } }] },
            select: { id: true },
          })
        ).map((u) => u.id)
      : [];
    const visible: Prisma.ArticleWhereInput = {
      ...(isEditorRole(role) ? {} : { authorId: userId }),
      ...(like ? { OR: [{ title: like }, ...(authorIds.length ? [{ authorId: { in: authorIds } }] : [])] } : {}),
    };
    const where: Prisma.ArticleWhereInput = { ...visible, ...(query.status ? { status: query.status } : {}) };

    const [total, groups] = await Promise.all([
      prisma.article.count({ where }),
      prisma.article.groupBy({ by: ["status"], where: visible, _count: { _all: true } }),
    ]);
    const pageCount = Math.max(1, Math.ceil(total / query.pageSize));
    const page = Math.min(query.page, pageCount);
    const rows = await prisma.article.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * query.pageSize,
      take: query.pageSize,
      include: withAuthor,
    });

    const count = (status: ArticleStatus) => groups.find((g) => g.status === status)?._count._all ?? 0;
    return {
      items: rows.map((row) => listItem(row, role, userId)),
      total,
      page,
      pageSize: query.pageSize,
      pageCount,
      counts: {
        all: groups.reduce((sum, g) => sum + g._count._all, 0),
        draft: count("draft"),
        in_review: count("in_review"),
        published: count("published"),
        archived: count("archived"),
      },
    };
  });

  // Muallif tanlovi uchun jamoa ro'yxati (faqat muharrir va admin)
  app.get("/api/admin/articles/authors", editorsOnly, async () => {
    const users = await prisma.user.findMany({
      where: { role: { in: STAFF_ROLES }, isBlocked: false },
      orderBy: { createdAt: "asc" },
      select: { id: true, email: true, role: true, staffProfile: { select: { fullName: true, position: true } } },
    });
    return {
      items: users.map((u) => ({
        id: u.id,
        name: u.staffProfile?.fullName || u.email.split("@")[0],
        position: u.staffProfile?.position ?? null,
        role: u.role,
      })),
    };
  });

  // Muqova rasmi (PNG/JPG/WebP, maks 5MB — multipart limiti). SVG ataylab qabul
  // qilinmaydi: ichida skript bo'lishi mumkin.
  app.post(
    "/api/admin/articles/cover",
    { ...staffOnly, config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (req, reply) => {
      if (!req.isMultipart()) throw Errors.badRequest("Fayl multipart/form-data sifatida yuborilishi kerak");
      const data = await req.file();
      if (!data) throw Errors.badRequest("Fayl topilmadi");
      // Tur mijoz sarlavhasidan emas, fayl baytlaridan aniqlanadi; nomi tasodifiy (audit ISSUE-043)
      const url = await saveUpload(data, "article-cover-", ["png", "jpg", "webp"], "Faqat PNG, JPG yoki WebP rasm qabul qilinadi", "public");
      return reply.status(201).send({ url });
    }
  );

  // Bitta maqola — tahrirlash va ko'rib chiqish (preview) uchun
  app.get("/api/admin/articles/:id", staffOnly, async (req) => {
    const { userId, role } = staffOf(req);
    return detail(await findVisible(req), role, userId);
  });

  // ---------------------------------------------------------
  // Yaratish
  // ---------------------------------------------------------
  app.post("/api/admin/articles", staffOnly, async (req, reply) => {
    const { userId, role } = staffOf(req);
    const body = articleBody.parse(req.body);
    const status: ArticleStatus = body.intent === "publish" ? "published" : body.intent === "review" ? "in_review" : "draft";
    if (status === "published" && !isEditorRole(role)) throw forbidden("Chop etish huquqingiz yo'q");
    if (status !== "draft") assertPublishable(body.content);

    const tags = normalizeTags(body.tags ?? []);
    const excerpt = body.excerpt ?? null;
    const category = body.category ?? null;
    const created = await prisma.article.create({
      data: {
        title: body.title,
        slug: await resolveSlug(body.title, body.slug),
        excerpt,
        content: body.content,
        coverImageUrl: body.coverImageUrl ?? null,
        category,
        tags,
        authorId: await resolveAuthorId(role, userId, body.authorId),
        status,
        metaTitle: body.metaTitle ?? null,
        metaDescription: body.metaDescription ?? null,
        publishedAt: status === "published" ? new Date() : null,
        ...articleDerived({ title: body.title, excerpt, content: body.content, tags, category }),
      },
      include: withAuthor,
    });
    return reply.status(201).send(detail(created, role, userId));
  });

  // ---------------------------------------------------------
  // Tahrirlash (+ ixtiyoriy holat o'tishi)
  // ---------------------------------------------------------
  app.put("/api/admin/articles/:id", staffOnly, async (req) => {
    const { userId, role } = staffOf(req);
    const existing = await findVisible(req);
    const permissions = articlePermissions(role, userId, existing);
    if (!permissions.edit) {
      throw forbidden(
        existing.status === "draft" ? "Bu maqolani tahrirlash huquqingiz yo'q" : "Ko'rib chiqilayotgan yoki chop etilgan maqolani faqat muharrir o'zgartiradi"
      );
    }
    const body = articleBody.parse(req.body);

    let status = existing.status;
    let publishedAt = existing.publishedAt;
    let reviewNote = existing.reviewNote;
    if (body.intent === "review") {
      if (!permissions.submit) throw forbidden("Ko'rib chiqishga faqat qoralama yuboriladi");
      status = "in_review";
      reviewNote = null;
    } else if (body.intent === "publish") {
      if (!isEditorRole(role)) throw forbidden("Chop etish huquqingiz yo'q");
      status = "published";
      publishedAt = publishedAt ?? new Date();
      reviewNote = null;
    }
    if (status !== "draft" && status !== "archived") assertPublishable(body.content);

    const requestedSlug = body.slug?.trim();
    const slug = requestedSlug && requestedSlug !== existing.slug ? await resolveSlug(body.title, requestedSlug, existing.id) : existing.slug;
    // Chop etilgan (havolasi tarqalgan bo'lishi mumkin) maqolaning eski slug'i saqlanadi
    const previousSlugs = [
      ...new Set([
        ...existing.previousSlugs,
        ...(slug !== existing.slug && existing.publishedAt ? [existing.slug] : []),
      ]),
    ].filter((s) => s !== slug);

    const tags = body.tags === undefined ? existing.tags : normalizeTags(body.tags);
    const excerpt = body.excerpt === undefined ? existing.excerpt : body.excerpt;
    const category = body.category === undefined ? existing.category : body.category;
    const coverImageUrl = body.coverImageUrl === undefined ? existing.coverImageUrl : body.coverImageUrl;

    const updated = await prisma.article.update({
      where: { id: existing.id },
      data: {
        title: body.title,
        slug,
        previousSlugs,
        excerpt,
        content: body.content,
        coverImageUrl,
        category,
        tags,
        authorId: await resolveAuthorId(role, userId, body.authorId, existing.authorId),
        status,
        publishedAt,
        reviewNote,
        metaTitle: body.metaTitle === undefined ? existing.metaTitle : body.metaTitle,
        metaDescription: body.metaDescription === undefined ? existing.metaDescription : body.metaDescription,
        ...articleDerived({ title: body.title, excerpt, content: body.content, tags, category }),
      },
      include: withAuthor,
    });
    // Eski muqova boshqa maqolada ham ishlatilsa fayl o'chirilmaydi (DELETE bilan bir xil). Aks holda muallif
    // qoralamaga chop etilgan maqola muqovasini qo'yib, so'ng almashtirib, uning faylini o'chira olardi (audit PHASE 6, V4)
    if (existing.coverImageUrl && existing.coverImageUrl !== coverImageUrl) {
      const sharedCover = await prisma.article.count({
        where: { coverImageUrl: existing.coverImageUrl, id: { not: existing.id } },
      });
      if (sharedCover === 0) removeCoverFile(existing.coverImageUrl);
    }
    return detail(updated, role, userId);
  });

  // ---------------------------------------------------------
  // Holat o'tishlari: submit | return | publish | unpublish | archive | restore
  // ---------------------------------------------------------
  app.post("/api/admin/articles/:id/:action", staffOnly, async (req) => {
    const { userId, role } = staffOf(req);
    const { action } = z.object({ action: z.enum(TRANSITIONS) }).parse(req.params);
    const { note } = z.object({ note: z.string().trim().max(500).optional() }).parse(req.body ?? {});
    const existing = await findVisible(req);
    if (!articlePermissions(role, userId, existing)[action]) throw forbidden("Bu amalni bajarish huquqingiz yo'q");
    if (action === "submit" || action === "publish") assertPublishable(existing.content);

    const updated = await prisma.article.update({
      where: { id: existing.id },
      data: {
        status: TRANSITION_TARGET[action],
        ...(action === "publish" ? { publishedAt: existing.publishedAt ?? new Date() } : {}),
        // Izoh faqat muharrir qaytarganda yoziladi (muallif o'zi qaytarib olsa — yo'q);
        // qayta yuborish yoki chop etishda eskisi tozalanadi
        reviewNote:
          action === "return"
            ? (isEditorRole(role) && note) || null
            : action === "submit" || action === "publish"
              ? null
              : existing.reviewNote,
      },
      include: withAuthor,
    });
    return detail(updated, role, userId);
  });

  // O'chirish — faqat SUPER_ADMIN
  app.delete("/api/admin/articles/:id", staffOnly, async (req) => {
    const { userId, role } = staffOf(req);
    const existing = await findVisible(req);
    if (!articlePermissions(role, userId, existing).delete) throw forbidden("Maqolani faqat super administrator o'chiradi");
    await prisma.article.delete({ where: { id: existing.id } });
    const sharedCover = existing.coverImageUrl
      ? await prisma.article.count({ where: { coverImageUrl: existing.coverImageUrl } })
      : 0;
    if (sharedCover === 0) removeCoverFile(existing.coverImageUrl);
    return { ok: true };
  });
}
