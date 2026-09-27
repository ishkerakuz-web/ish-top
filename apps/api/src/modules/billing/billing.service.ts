import crypto from "node:crypto";
import type { PaymentProvider } from "@prisma/client";
import { prisma } from "../../common/prisma.js";
import { Errors, AppError } from "../../common/errors.js";
import { env, features } from "../../common/env.js";

/**
 * Monetizatsiya: obuna rejalari, limitlar va to'lov yozuvlari.
 *
 * To'lov provayderlari (Payme / Click) .env orqali yoqiladi. Kalitlar yo'q bo'lsa
 * tizim "qo'lda tasdiqlash" rejimida ishlaydi: to'lov yozuvi `pending` holatida
 * yaratiladi va admin panelidan tasdiqlanadi. Shu sababli rejalar mexanizmi
 * provayder shartnomasisiz ham to'liq sinaladi.
 */

/** Standart rejalar — baza bo'sh bo'lsa server ko'tarilganda yaratiladi. */
export const DEFAULT_PLANS = [
  {
    slug: "free",
    name: "Boshlang'ich",
    price: 0,
    maxActiveVacancies: 3,
    maxFeaturedVacancies: 0,
    canSearchCandidates: false,
    durationDays: 36500,
    sortOrder: 1,
    features: ["3 ta faol vakansiya", "Arizalarni boshqarish", "Nomzod bilan chat"],
  },
  {
    slug: "standard",
    name: "Standart",
    price: 490_000,
    maxActiveVacancies: 15,
    maxFeaturedVacancies: 2,
    canSearchCandidates: true,
    durationDays: 30,
    sortOrder: 2,
    features: [
      "15 ta faol vakansiya",
      "2 ta vakansiyani yuqoriga chiqarish",
      "Nomzodlar bazasidan qidiruv",
      "Kompaniya profili va logotip",
    ],
  },
  {
    slug: "premium",
    name: "Premium",
    price: 1_290_000,
    maxActiveVacancies: 100,
    maxFeaturedVacancies: 10,
    canSearchCandidates: true,
    durationDays: 30,
    sortOrder: 3,
    features: [
      "100 ta faol vakansiya",
      "10 ta vakansiyani yuqoriga chiqarish",
      "Nomzodlar bazasidan qidiruv",
      "Tasdiqlangan kompaniya belgisi",
      "Ustuvor qo'llab-quvvatlash",
    ],
  },
] as const;

/** Rejalar jadvalini to'ldiradi (mavjudlari yangilanadi, o'chirilmaydi). */
export async function ensurePlans(): Promise<void> {
  for (const plan of DEFAULT_PLANS) {
    await prisma.subscriptionPlan.upsert({
      where: { slug: plan.slug },
      update: {
        name: plan.name,
        price: plan.price,
        maxActiveVacancies: plan.maxActiveVacancies,
        maxFeaturedVacancies: plan.maxFeaturedVacancies,
        canSearchCandidates: plan.canSearchCandidates,
        durationDays: plan.durationDays,
        sortOrder: plan.sortOrder,
        features: [...plan.features],
      },
      create: {
        slug: plan.slug,
        name: plan.name,
        price: plan.price,
        currency: "UZS",
        maxActiveVacancies: plan.maxActiveVacancies,
        maxFeaturedVacancies: plan.maxFeaturedVacancies,
        canSearchCandidates: plan.canSearchCandidates,
        durationDays: plan.durationDays,
        sortOrder: plan.sortOrder,
        features: [...plan.features],
      },
    });
  }
}

export interface EffectivePlan {
  slug: string;
  name: string;
  price: number;
  maxActiveVacancies: number;
  maxFeaturedVacancies: number;
  canSearchCandidates: boolean;
  expiresAt: Date | null;
  /** Reja muddati tugagani uchun bepul rejaga tushgan bo'lsa — true. */
  expired: boolean;
}

const FREE_FALLBACK: EffectivePlan = {
  slug: "free",
  name: DEFAULT_PLANS[0].name,
  price: 0,
  maxActiveVacancies: DEFAULT_PLANS[0].maxActiveVacancies,
  maxFeaturedVacancies: 0,
  canSearchCandidates: false,
  expiresAt: null,
  expired: false,
};

/**
 * Kompaniyaning amaldagi rejasi. Muddati o'tgan pullik reja avtomatik ravishda
 * bepul rejaga tushadi (bazada saqlanadi, lekin kuchga kirmaydi).
 */
export async function getEffectivePlan(companyId: string): Promise<EffectivePlan> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: { subscriptionPlan: true },
  });
  if (!company?.subscriptionPlan) return FREE_FALLBACK;

  const plan = company.subscriptionPlan;
  const expiresAt = company.subscriptionExpiresAt;
  const expired = Boolean(expiresAt && expiresAt.getTime() < Date.now());

  if (expired) return { ...FREE_FALLBACK, expiresAt, expired: true };

  return {
    slug: plan.slug,
    name: plan.name,
    price: plan.price,
    maxActiveVacancies: plan.maxActiveVacancies,
    maxFeaturedVacancies: plan.maxFeaturedVacancies,
    canSearchCandidates: plan.canSearchCandidates,
    expiresAt,
    expired: false,
  };
}

export interface SubscriptionState extends EffectivePlan {
  activeVacancies: number;
  featuredVacancies: number;
  canPostMore: boolean;
}

export async function getSubscriptionState(companyId: string): Promise<SubscriptionState> {
  const [plan, activeVacancies, featuredVacancies] = await Promise.all([
    getEffectivePlan(companyId),
    prisma.vacancy.count({ where: { companyId, status: "active" } }),
    prisma.vacancy.count({ where: { companyId, status: "active", isPremium: true } }),
  ]);
  return {
    ...plan,
    activeVacancies,
    featuredVacancies,
    canPostMore: activeVacancies < plan.maxActiveVacancies,
  };
}

// Faol vakansiyalar limiti (`assertCanPostVacancy`, 402 PLAN_LIMIT_REACHED) olib tashlandi:
// platforma hozircha bepul, ish beruvchi cheklanmagan sonda faol vakansiya joylaydi.

/** Nomzodlar bazasidan qidirish huquqi (Standart va yuqori rejalarda). */
export async function assertCanSearchCandidates(companyId: string): Promise<void> {
  const plan = await getEffectivePlan(companyId);
  if (!plan.canSearchCandidates) {
    throw new AppError(
      402,
      "PLAN_FEATURE_LOCKED",
      "Nomzodlar bazasidan qidiruv Standart va Premium rejalarda mavjud."
    );
  }
}

// ---------------------------------------------------------
// To'lov
// ---------------------------------------------------------

export interface CheckoutResult {
  paymentId: string;
  transactionId: string;
  amount: number;
  provider: PaymentProvider;
  /** Provayder to'lov sahifasi. Provayder sozlanmagan bo'lsa — ichki sahifa. */
  checkoutUrl: string;
  /** true — provayder ulanmagan, to'lovni admin qo'lda tasdiqlaydi. */
  manual: boolean;
}

/** To'lovni boshlaydi: `pending` yozuv yaratadi va provayder havolasini qaytaradi. */
export async function createCheckout(
  companyId: string,
  planSlug: string,
  provider: PaymentProvider
): Promise<CheckoutResult> {
  const plan = await prisma.subscriptionPlan.findUnique({ where: { slug: planSlug } });
  if (!plan || !plan.isActive) throw Errors.notFound("Bunday tarif topilmadi");
  if (plan.price <= 0) throw Errors.badRequest("Bepul reja uchun to'lov talab qilinmaydi");

  const transactionId = `ib-${crypto.randomBytes(9).toString("hex")}`;

  const payment = await prisma.payment.create({
    data: {
      companyId,
      planId: plan.id,
      amount: plan.price,
      provider,
      transactionId,
      status: "pending",
    },
  });

  const configured = provider === "payme" ? features.payme : features.click;
  const checkoutUrl = configured
    ? buildProviderUrl(provider, transactionId, plan.price)
    : `${env.WEB_ORIGIN}/profile?pending=${transactionId}`;

  return {
    paymentId: payment.id,
    transactionId,
    amount: plan.price,
    provider,
    checkoutUrl,
    manual: !configured,
  };
}

/** Provayderning to'lov sahifasi manzili (summa tiyinda uzatiladi). */
function buildProviderUrl(provider: PaymentProvider, transactionId: string, amountSum: number) {
  const amountTiyin = amountSum * 100;
  if (provider === "payme") {
    const params = `m=${env.PAYME_MERCHANT_ID};ac.order_id=${transactionId};a=${amountTiyin};c=${env.WEB_ORIGIN}/profile`;
    return `https://checkout.paycom.uz/${Buffer.from(params).toString("base64")}`;
  }
  const qs = new URLSearchParams({
    service_id: env.CLICK_SERVICE_ID,
    merchant_id: env.CLICK_MERCHANT_ID,
    amount: String(amountSum),
    transaction_param: transactionId,
    return_url: `${env.WEB_ORIGIN}/profile`,
  });
  return `https://my.click.uz/services/pay?${qs.toString()}`;
}

/**
 * To'lovni "to'langan" deb belgilaydi va obunani faollashtiradi.
 * Provayder webhook'i ham, admin qo'lda tasdiqlashi ham shu funksiyani chaqiradi.
 */
export async function markPaymentPaid(transactionId: string): Promise<{ ok: true }> {
  const payment = await prisma.payment.findUnique({
    where: { transactionId },
    include: { plan: true },
  });
  if (!payment) throw Errors.notFound("To'lov topilmadi");
  if (payment.status === "paid") return { ok: true };

  const now = new Date();
  const company = await prisma.company.findUnique({
    where: { id: payment.companyId },
    select: { subscriptionExpiresAt: true, subscriptionPlanId: true },
  });

  // Amaldagi obuna hali tugamagan bo'lsa — muddat ustiga qo'shiladi
  const base =
    company?.subscriptionPlanId === payment.planId &&
    company.subscriptionExpiresAt &&
    company.subscriptionExpiresAt > now
      ? company.subscriptionExpiresAt
      : now;
  const expiresAt = new Date(base.getTime() + payment.plan.durationDays * 24 * 60 * 60 * 1000);

  await prisma.$transaction([
    prisma.payment.update({
      where: { id: payment.id },
      data: { status: "paid", paidAt: now },
    }),
    prisma.company.update({
      where: { id: payment.companyId },
      data: { subscriptionPlanId: payment.planId, subscriptionExpiresAt: expiresAt },
    }),
  ]);

  return { ok: true };
}

/**
 * Webhook imzosini tekshiradi.
 *
 * Click `md5(click_trans_id + service_id + SECRET_KEY + ...)` sxemasidan,
 * Payme esa `Authorization: Basic base64(Paycom:KEY)` sarlavhasidan foydalanadi.
 * Kalit .env'da bo'lmasa webhook qabul qilinmaydi (400) — soxta "to'landi"
 * so'rovlari obunani ochib yuborishining oldini oladi.
 */
export function verifyWebhookAuth(
  provider: PaymentProvider,
  headers: Record<string, unknown>,
  body: Record<string, unknown>
): boolean {
  if (provider === "payme") {
    if (!env.PAYME_KEY) return false;
    const auth = String(headers.authorization ?? "");
    if (!auth.startsWith("Basic ")) return false;
    const decoded = Buffer.from(auth.slice(6), "base64").toString("utf8");
    const [login, key] = decoded.split(":");
    return login === "Paycom" && key === env.PAYME_KEY;
  }

  if (!env.CLICK_SECRET_KEY) return false;
  const signString = [
    body.click_trans_id,
    body.service_id,
    env.CLICK_SECRET_KEY,
    body.merchant_trans_id,
    body.amount,
    body.action,
    body.sign_time,
  ].join("");
  const expected = crypto.createHash("md5").update(signString).digest("hex");
  return expected === String(body.sign_string ?? "");
}
