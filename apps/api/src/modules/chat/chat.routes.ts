import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { idParams, isObjectId } from "../../common/validation.js";
import { prisma } from "../../common/prisma.js";
import { Errors, AppError } from "../../common/errors.js";
import { requireAuth, requirePhoneVerified } from "../../common/auth-guard.js";
import { sendToUser } from "../../common/realtime.js";
import { ownedVacancyIds, primaryCompany } from "../../common/ownership.js";
import { assertQuota } from "../../common/quota.js";
import { chatSocketRoutes } from "./chat.ws.js";
import {
  CONTEXT_APPLICATION_LIMIT,
  CONTEXT_RANK,
  CONVERSATIONS_PAGE_DEFAULT,
  DAY_MS,
  MESSAGES_PAGE_DEFAULT,
  NEW_CONVERSATIONS_PER_DAY,
  cachedOwnedVacancyIds,
  conversationIdsOf,
  conversationsQuery,
  getOrCreateConversation,
  hideSalary,
  isMutualConversation,
  lastMessages,
  messagesQuery,
  participantsOf,
  rateSchema,
  startSchema,
} from "./chat.service.js";

/**
 * Chat REST marshrutlari: suhbat ochish, ro'yxat, xabarlar tarixi va o'zaro baho.
 * Real vaqt (`/ws/chat`) — `chat.ws.ts`, mantiq — `chat.service.ts`.
 */
export async function chatRoutes(app: FastifyInstance) {
  chatSocketRoutes(app);

  // Suhbat ochish/topish: ish beruvchi -> nomzod yoki nomzod -> kompaniya
  app.post("/api/conversations/start", { preHandler: [requireAuth, requirePhoneVerified] }, async (req) => {
    const me = req.user!.sub;
    const role = req.user!.role;
    const body = startSchema.parse(req.body);

    /**
     * Yangi suhbat ochish chegarasi (audit R3, authz-idor-10): mavjud suhbatda yozish
     * cheklanmaydi, faqat YANGI suhbat ochish kuniga `NEW_CONVERSATIONS_PER_DAY` marta.
     */
    const limitNewConversation = async (employerUserId: string, seekerUserId: string) => {
      const existing = await prisma.conversation.findUnique({
        where: { employerUserId_seekerUserId: { employerUserId, seekerUserId } },
        select: { id: true },
      });
      if (!existing) await assertQuota(`conv:new:${me}`, NEW_CONVERSATIONS_PER_DAY, DAY_MS);
    };

    let conv;
    if (role === "employer" || role === "admin") {
      if (!body.candidateUserId) throw Errors.badRequest("candidateUserId kerak");
      const candidate = await prisma.user.findUnique({
        where: { id: body.candidateUserId },
        select: {
          id: true,
          role: true,
          isBlocked: true,
          jobSeekerProfile: {
            select: { isOpenToWork: true, resumes: { where: { status: "published" }, select: { id: true }, take: 1 } },
          },
        },
      });
      // Bloklangan hisob bilan suhbat ochilmaydi (audit R3, ma'lumot yaxlitligi xaritasi)
      if (!candidate || candidate.role !== "job_seeker" || candidate.isBlocked) throw Errors.notFound();

      if (role === "employer") {
        // Ish beruvchi faqat ish qidirayotgan (ochiq rezyumeli) yoki o'z vakansiyasiga ariza
        // yuborgan nomzodga yozadi (audit ISSUE-039). Mavjud suhbat davom etaveradi.
        const discoverable = Boolean(candidate.jobSeekerProfile?.isOpenToWork && candidate.jobSeekerProfile.resumes.length);
        let allowed = discoverable;
        if (!allowed) {
          const existing = await prisma.conversation.findUnique({
            where: { employerUserId_seekerUserId: { employerUserId: me, seekerUserId: candidate.id } },
            select: { id: true },
          });
          allowed = Boolean(existing);
        }
        if (!allowed) {
          const vacancyIds = await ownedVacancyIds(me);
          allowed = vacancyIds.length > 0 && Boolean(
            await prisma.application.findFirst({
              where: { jobSeekerId: candidate.id, vacancyId: { in: vacancyIds } },
              select: { id: true },
            })
          );
        }
        if (!allowed) {
          throw new AppError(403, "CANDIDATE_NOT_AVAILABLE", "Bu nomzod hozir ish qidirmayapti va vakansiyangizga ariza yubormagan");
        }
      }

      const company = await primaryCompany(me);
      await limitNewConversation(me, candidate.id);
      conv = await getOrCreateConversation(me, candidate.id, company?.id ?? null);
    } else if (role === "job_seeker") {
      // job_seeker -> kompaniyaga yozadi
      if (!body.companySlug) throw Errors.badRequest("companySlug kerak");
      const company = await prisma.company.findUnique({
        where: { slug: body.companySlug },
        select: { id: true, ownerUserId: true, owner: { select: { isBlocked: true } } },
      });
      // Egasi bloklangan kompaniya bilan suhbat ochilmaydi (audit R3, ma'lumot yaxlitligi xaritasi):
      // bunday kompaniya katalogda ham ko'rinmaydi, xabar esa hech qachon o'qilmasdi.
      if (!company || company.owner.isBlocked) throw Errors.notFound();
      await limitNewConversation(company.ownerUserId, me);
      conv = await getOrCreateConversation(company.ownerUserId, me, company.id);
    } else {
      // Kontent jamoasi (muharrir/muallif) nomzod sifatida yozishmaydi
      throw Errors.forbidden();
    }
    return { id: conv.id };
  });

  /**
   * Joriy foydalanuvchining suhbatlari — kursor bilan sahifalanadi (audit R3, D-078 / db-perf-7 /
   * employer-flows-9 / scale-10k-6).
   *
   * Ilgari BARCHA suhbatlar og'ir maydonlari (kompaniya tavsifi, nomzod profili) bilan bir javobda
   * kelardi, so'ng har kompaniya vakansiyalarining hammasi va ularning arizalari o'qilardi:
   * 500 suhbatli ish beruvchida ~500 KB va p95 ~1.1 s. Endi:
   *   1) yengil ro'yxat (faqat ID va ishtirokchilar) + bitta agregatsiya bilan oxirgi xabarlar,
   *   2) xotirada tartiblash va kursor bo'yicha kesish,
   *   3) og'ir maydonlar, o'qilmaganlar va vakansiya konteksti FAQAT shu sahifa uchun.
   * `Conversation.lastMessageAt` denormalizatsiyasi sxema o'zgarishini talab qiladi (bu guruh mulki emas).
   */
  app.get("/api/conversations", { preHandler: [requireAuth] }, async (req) => {
    const userId = req.user!.sub;
    const { limit, before } = conversationsQuery.parse(req.query);
    const take = limit ?? CONVERSATIONS_PAGE_DEFAULT;

    const light = await prisma.conversation.findMany({
      where: { OR: [{ employerUserId: userId }, { seekerUserId: userId }] },
      select: { id: true, createdAt: true },
    });
    const lastByConversation = await lastMessages(light.map((c) => c.id));
    const ordered = light
      .map((c) => ({ id: c.id, at: (lastByConversation.get(c.id)?.createdAt ?? c.createdAt).getTime() }))
      // Teng vaqtda ID bo'yicha barqaror tartib — kursor sahifalari kesishmaydi
      .sort((a, b) => b.at - a.at || (a.id < b.id ? 1 : -1));

    // Kursor: oldingi sahifaning oxirgi suhbati ID'si yoki uning `lastMessageAt` (ISO) qiymati
    let start = 0;
    if (before) {
      if (isObjectId(before)) {
        const index = ordered.findIndex((o) => o.id === before);
        // Suhbat topilmasa (o'chirilgan) — sahifa hisoblab bo'lmaydi: bo'sh javob, halqa yo'q
        start = index >= 0 ? index + 1 : ordered.length;
      } else {
        const at = new Date(before).getTime();
        if (Number.isNaN(at)) throw Errors.badRequest("before noto'g'ri");
        const index = ordered.findIndex((o) => o.at < at);
        start = index >= 0 ? index : ordered.length;
      }
    }
    const window = ordered.slice(start, start + take + 1);
    const hasMore = window.length > take;
    const pageOrder = hasMore ? window.slice(0, take) : window;
    const pageIds = pageOrder.map((o) => o.id);
    if (pageIds.length === 0) return { items: [], nextCursor: null };

    const rows = await prisma.conversation.findMany({
      where: { id: { in: pageIds } },
      include: {
        company: {
          select: {
            name: true,
            slug: true,
            logoUrl: true,
            isVerified: true,
            industry: true,
            description: true,
            region: { select: { name: true } },
          },
        },
        // Email umuman o'qilmaydi (audit PHASE 6, V1): ilgari ism bo'sh nomzodning emaili sarlavha
        // bo'lib ish beruvchiga, kompaniyasiz suhbatda ish beruvchi/admin emaili nomzodga ochilardi
        seeker: {
          select: {
            jobSeekerProfile: { select: { firstName: true, lastName: true, headline: true, avatarUrl: true } },
          },
        },
        employer: { select: { role: true } },
      },
    });
    const byId = new Map(rows.map((r) => [r.id, r]));
    const convs = pageIds.map((id) => byId.get(id)).filter((c): c is (typeof rows)[number] => Boolean(c));

    const unreadRows = await prisma.message.groupBy({
      by: ["conversationId"],
      where: { conversationId: { in: pageIds }, senderId: { not: userId }, isRead: false },
      _count: { _all: true },
    });
    const unreadMap = new Map(unreadRows.map((r) => [r.conversationId, r._count._all]));

    // Vakansiya konteksti: suhbatda vakansiya maydoni yo'q — nomzodning shu kompaniya
    // vakansiyalariga bergan arizasidan olinadi (bir nechta bo'lsa — faol bosqichdagisi).
    // Endi qidiruv NOMZOD bo'yicha (indekslangan `jobSeekerId`) va faqat shu sahifadagi suhbatlar uchun:
    // ilgari kompaniyaning BARCHA vakansiya ID'lari `$in` ro'yxatiga yig'ilardi — katta kompaniya bilan
    // yozishgan nomzodda bu ro'yxat minglab element bo'lardi (audit R3, scale-10k-6).
    const withCompany = convs.filter((c) => c.companyId);
    const companyIds = new Set(withCompany.map((c) => c.companyId as string));
    const applications = withCompany.length
      ? await prisma.application.findMany({
          where: { jobSeekerId: { in: [...new Set(withCompany.map((c) => c.seekerUserId))] } },
          select: {
            jobSeekerId: true,
            status: true,
            createdAt: true,
            vacancy: {
              select: {
                companyId: true,
                title: true,
                slug: true,
                status: true,
                employmentType: true,
                experienceRequired: true,
                salaryMin: true,
                salaryMax: true,
                currency: true,
                isSalaryHidden: true,
                region: { select: { name: true } },
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: CONTEXT_APPLICATION_LIMIT,
        })
      : [];
    const contextOf = new Map<string, (typeof applications)[number]>();
    for (const application of applications) {
      if (!companyIds.has(application.vacancy.companyId)) continue;
      const key = `${application.jobSeekerId}:${application.vacancy.companyId}`;
      const current = contextOf.get(key);
      const rank = CONTEXT_RANK[application.status];
      if (
        !current ||
        rank < CONTEXT_RANK[current.status] ||
        (rank === CONTEXT_RANK[current.status] && application.createdAt > current.createdAt)
      ) {
        contextOf.set(key, application);
      }
    }

    const items = convs.map((c) => {
      const iAmEmployer = c.employerUserId === userId;
      const sp = c.seeker.jobSeekerProfile;
      // Nom bo'lmasa — `null` (klient rol yorlig'ini chizadi), email hech qachon (audit PHASE 6, V1)
      const seekerName = [sp?.firstName, sp?.lastName].filter(Boolean).join(" ") || null;
      const title = iAmEmployer ? seekerName : c.company?.name ?? null;
      const subtitle = iAmEmployer ? sp?.headline ?? null : c.company?.name ? "Ish beruvchi" : null;
      const last = lastByConversation.get(c.id);
      const vacancy = c.companyId ? contextOf.get(`${c.seekerUserId}:${c.companyId}`)?.vacancy : undefined;
      return {
        id: c.id,
        title,
        subtitle,
        companySlug: c.company?.slug ?? null,
        otherUserId: iAmEmployer ? c.seekerUserId : c.employerUserId,
        lastMessage: last?.body ?? null,
        lastMessageAt: last?.createdAt ?? c.createdAt,
        unread: unreadMap.get(c.id) ?? 0,
        // /messages sahifasi uchun qo'shimcha (ixtiyoriy) maydonlar
        otherRole: iAmEmployer ? "job_seeker" : c.employer.role,
        otherHeadline: iAmEmployer ? sp?.headline ?? null : null,
        avatarUrl: iAmEmployer ? sp?.avatarUrl ?? null : c.company?.logoUrl ?? null,
        lastMessageMine: last ? last.senderId === userId : false,
        lastMessageRead: last?.isRead ?? false,
        company: c.company
          ? {
              name: c.company.name,
              slug: c.company.slug,
              logoUrl: c.company.logoUrl,
              isVerified: c.company.isVerified,
              industry: c.company.industry,
              description: c.company.description,
              regionName: c.company.region?.name ?? null,
            }
          : null,
        vacancy: vacancy
          ? {
              title: vacancy.title,
              slug: vacancy.slug,
              isClosed: vacancy.status !== "active",
              // Moderatsiyadagi yoki rad etilgan e'lonning maosh raqamlari ko'rsatilmaydi
              // (audit R3, gap4-2 — GET /api/applications bilan bir xil qoida)
              isUnavailable: vacancy.status === "moderation" || vacancy.status === "rejected",
              employmentType: vacancy.employmentType,
              experienceRequired: vacancy.experienceRequired,
              // Yashirilgan maosh raqamlari javobga umuman qo'shilmaydi
              salaryMin: hideSalary(vacancy) ? null : vacancy.salaryMin,
              salaryMax: hideSalary(vacancy) ? null : vacancy.salaryMax,
              currency: vacancy.currency,
              regionName: vacancy.region?.name ?? null,
            }
          : null,
      };
    });

    // Tartib yuqorida (kursor bilan bir xil ro'yxatda) aniqlangan — qayta tartiblash kerak emas
    return {
      items,
      /** Keyingi sahifa uchun `?before=` qiymati; yana suhbat bo'lmasa `null` (audit R3, D-078). */
      nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null,
    };
  });

  /**
   * Bitta suhbat tarixi. Parametrsiz — eng yangi sahifa (ochilganda o'qilgan deb belgilanadi),
   * `?before=<messageId>` — undan eskiroqlari (audit R3, D-078 / db-perf-10 / scale-10k-9).
   * Javob shakli o'zgarmadi: `items` (xronologik tartibda) va `me`; `hasMore` qo'shildi.
   */
  app.get("/api/conversations/:id/messages", { preHandler: [requireAuth] }, async (req) => {
    const { id } = idParams.parse(req.params);
    const { limit, before } = messagesQuery.parse(req.query);
    const take = limit ?? MESSAGES_PAGE_DEFAULT;
    const parts = await participantsOf(id);
    if (!parts) throw Errors.notFound();
    const me = req.user!.sub;
    if (me !== parts.seekerId && me !== parts.employerId) throw Errors.forbidden();

    // Eski sahifani yuklash o'qilgan belgisini qo'ymaydi — belgilash faqat eng yangi sahifada
    if (!before) {
      const marked = await prisma.message.updateMany({
        where: { conversationId: id, senderId: { not: me }, isRead: false },
        data: { isRead: true },
      });
      // O'qilganini yuboruvchiga real-time bildiramiz (ikki belgi)
      if (marked.count > 0) {
        const otherId = me === parts.seekerId ? parts.employerId : parts.seekerId;
        sendToUser(otherId, JSON.stringify({ type: "read", conversationId: id }));
      }
    }

    // Kursor: shu xabardan eskiroqlari. Xabar shu suhbatga tegishli bo'lishi shart — begona
    // suhbat xabarining vaqti bilan sahifalash mumkin emas.
    let cursorWhere: object = {};
    if (before) {
      if (!isObjectId(before)) throw Errors.badRequest("before noto'g'ri");
      const anchor = await prisma.message.findFirst({
        where: { id: before, conversationId: id },
        select: { createdAt: true },
      });
      if (!anchor) throw Errors.notFound();
      cursorWhere = {
        OR: [{ createdAt: { lt: anchor.createdAt } }, { createdAt: anchor.createdAt, id: { lt: before } }],
      };
    }

    const recent = await prisma.message.findMany({
      where: { conversationId: id, ...cursorWhere },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      // Bittasi ortiqcha — eskiroq xabar borligini shundan bilamiz
      take: take + 1,
    });
    const hasMore = recent.length > take;
    // Javob doim xronologik tartibda (eskisidan yangisiga) — klient shu tartibni kutadi
    const ascending = (hasMore ? recent.slice(0, take) : recent).reverse();
    return {
      items: ascending,
      me,
      /** Yana eskiroq xabar bormi (klient "eskiroq xabarlar" tugmasini shunga qarab chizadi). */
      hasMore,
      /** Keyingi (eskiroq) sahifa uchun `?before=` qiymati — shu sahifadagi ENG ESKI xabar. */
      nextCursor: hasMore ? ascending[0]?.id ?? null : null,
    };
  });

  // Suhbat bo'yicha baho holati: berish mumkinmi, mening bahom, suhbatdoshning o'rtachasi
  app.get("/api/conversations/:id/rating", { preHandler: [requireAuth] }, async (req) => {
    const { id } = idParams.parse(req.params);
    const me = req.user!.sub;
    const parts = await participantsOf(id);
    if (!parts) throw Errors.notFound();
    if (me !== parts.seekerId && me !== parts.employerId) throw Errors.forbidden();
    const otherId = me === parts.seekerId ? parts.employerId : parts.seekerId;

    const [eligible, mine, agg] = await Promise.all([
      isMutualConversation(id, parts.seekerId, parts.employerId),
      prisma.peerRating.findUnique({
        where: { conversationId_raterUserId: { conversationId: id, raterUserId: me } },
        select: { score: true, comment: true },
      }),
      prisma.peerRating.aggregate({
        where: { ratedUserId: otherId },
        _avg: { score: true },
        _count: { _all: true },
      }),
    ]);

    return {
      eligible,
      myScore: mine?.score ?? null,
      myComment: mine?.comment ?? null,
      otherAvg: agg._avg.score ? Math.round(agg._avg.score * 10) / 10 : null,
      otherCount: agg._count._all,
    };
  });

  // Suhbatdoshga 1–5 yulduz baho (faqat ikkala tomon ham yozgan bo'lsa)
  app.post("/api/conversations/:id/rating", { preHandler: [requireAuth] }, async (req) => {
    const { id } = idParams.parse(req.params);
    const me = req.user!.sub;
    const body = rateSchema.parse(req.body);
    const parts = await participantsOf(id);
    if (!parts) throw Errors.notFound();
    if (me !== parts.seekerId && me !== parts.employerId) throw Errors.forbidden();
    const otherId = me === parts.seekerId ? parts.employerId : parts.seekerId;

    const eligible = await isMutualConversation(id, parts.seekerId, parts.employerId);
    if (!eligible) {
      throw new AppError(
        403,
        "RATING_NOT_ELIGIBLE",
        "Baho berish uchun suhbatda ikkala tomon ham yozgan bo'lishi kerak"
      );
    }

    // Baho BIR MARTA beriladi — keyin o'zgartirib bo'lmaydi (adolatli reyting).
    const existing = await prisma.peerRating.findUnique({
      where: { conversationId_raterUserId: { conversationId: id, raterUserId: me } },
    });
    if (existing) {
      throw new AppError(409, "ALREADY_RATED", "Siz bu suhbatdoshga allaqachon baho bergansiz");
    }

    const saved = await prisma.peerRating.create({
      data: {
        conversationId: id,
        raterUserId: me,
        ratedUserId: otherId,
        score: body.score,
        comment: body.comment ?? null,
      },
    });
    return { score: saved.score, comment: saved.comment };
  });

  // Suhbatdoshning qisqa profili (modal uchun). Maxfiylik: faqat oramizda
  // suhbat mavjud bo'lgan foydalanuvchining ma'lumotini ko'rish mumkin.
  app.get("/api/users/:id/summary", { preHandler: [requireAuth] }, async (req) => {
    const { id } = idParams.parse(req.params);
    const me = req.user!.sub;
    const conv = await prisma.conversation.findFirst({
      where: {
        OR: [
          { employerUserId: me, seekerUserId: id },
          { employerUserId: id, seekerUserId: me },
        ],
      },
      select: { id: true },
    });
    if (!conv) throw Errors.forbidden();

    const user = await prisma.user.findUnique({
      where: { id },
      // Faqat kerakli maydonlar: email (va parol xeshi) umuman o'qilmaydi (audit PHASE 6, V1)
      select: {
        role: true,
        jobSeekerProfile: {
          include: {
            region: true,
            // Faqat chop etilgan rezyume (qoralama mazmuni ochilmaydi)
            resumes: {
              where: { status: "published" },
              orderBy: { updatedAt: "desc" },
              take: 1,
              include: { skills: true },
            },
          },
        },
        ownedCompanies: { take: 1, orderBy: { createdAt: "asc" }, include: { region: true } },
      },
    });
    if (!user) throw Errors.notFound();

    const agg = await prisma.peerRating.aggregate({
      where: { ratedUserId: id },
      _avg: { score: true },
      _count: { _all: true },
    });

    const p = user.jobSeekerProfile;
    const resume = p?.resumes[0];
    const comp = user.ownedCompanies[0];
    const fullName = p ? [p.firstName, p.lastName].filter(Boolean).join(" ") : "";
    return {
      role: user.role,
      // Ism yoki kompaniya nomi; ikkalasi ham bo'lmasa — `null`, email emas (audit PHASE 6, V1)
      name: fullName || comp?.name || null,
      headline: p?.headline ?? null,
      regionName: p?.region?.name ?? comp?.region?.name ?? null,
      ratingAvg: agg._avg.score ? Math.round(agg._avg.score * 10) / 10 : null,
      ratingCount: agg._count._all,
      isOpenToWork: p?.isOpenToWork ?? null,
      resumeTitle: resume?.title ?? null,
      skills: resume?.skills.map((s) => s.skillName) ?? [],
      company: comp
        ? {
            name: comp.name,
            slug: comp.slug,
            logoUrl: comp.logoUrl,
            industry: comp.industry,
            description: comp.description,
          }
        : null,
    };
  });

  // Header uchun: o'qilmagan xabarlar + yangi arizalar
  app.get("/api/inbox/summary", { preHandler: [requireAuth] }, async (req) => {
    const userId = req.user!.sub;
    const isEmployer = req.user!.role === "employer";
    // Suhbat ID'lari 60 s keshlanadi, yangi suhbatda darrov bekor bo'ladi (audit R3, scale-10k-7)
    const ids = await conversationIdsOf(userId);
    const [unreadMessages, newApplications] = await Promise.all([
      ids.length
        ? prisma.message.count({
            where: { conversationId: { in: ids }, senderId: { not: userId }, isRead: false },
          })
        : Promise.resolve(0),
      // Relation filter ($lookup) o'rniga: o'z vakansiyalari → [vacancyId, status] indeksi (audit ISSUE-046).
      // Vakansiya ID'lari 60 s keshlanadi (audit R3, scale-10k-7): bu so'rov har varaqdan 20 soniyada
      // bir marta keladi va har safar barcha ID'lar qayta o'qilardi (500 vakansiyada ~125 ms).
      isEmployer
        ? cachedOwnedVacancyIds(userId, () => ownedVacancyIds(userId)).then((vacancyIds) =>
            vacancyIds.length ? prisma.application.count({ where: { vacancyId: { in: vacancyIds }, status: "sent" } }) : 0
          )
        : Promise.resolve(0),
    ]);
    return { unreadMessages, newApplications };
  });
}

