import { absoluteUploadUrl } from "../api.js";
import type { EmploymentType, ExperienceLevel } from "../types.js";

/**
 * `/messages` ko'rinish modellari. Backend javobidagi `null`/`undefined`/bo'sh
 * qator — `null` (UI o'sha qatorni, kartani yoki belgini chizmaydi).
 */

export type ParticipantRole = "employer" | "job_seeker" | "admin";

export interface ConversationCompany {
  name: string;
  slug: string | null;
  logoUrl: string | null;
  isVerified: boolean;
  industry: string | null;
  description: string | null;
  regionName: string | null;
}

/** Suhbat konteksti — nomzodning shu kompaniyaga bergan arizasidagi vakansiya. */
export interface ConversationVacancy {
  title: string;
  slug: string;
  /** Vakansiya faol emas — havola ko'rsatilmaydi. */
  isClosed: boolean;
  regionName: string | null;
  employmentType: EmploymentType | null;
  experience: ExperienceLevel | null;
  /** `null` — maosh yashirilgan yoki kiritilmagan. */
  salary: { min: number | null; max: number | null; currency: string } | null;
}

export interface ConversationView {
  id: string;
  /**
   * Nomzod ismi yoki kompaniya nomi; `null` — nom yo'q (server email bermaydi, audit PHASE 6, V1).
   * Ekranda to'g'ridan-to'g'ri emas, `displayName()` orqali chiziladi (lokallashtirilgan fallback).
   */
  title: string | null;
  otherRole: ParticipantRole | null;
  otherUserId: string | null;
  /** Ish beruvchi ko'rinishida nomzodning sarlavhasi (lavozimi). */
  headline: string | null;
  avatarUrl: string | null;
  company: ConversationCompany | null;
  vacancy: ConversationVacancy | null;
  lastMessage: string | null;
  /** Faqat oxirgi xabar bo'lsa — bo'lmasa vaqt ko'rsatilmaydi. */
  lastMessageAt: string | null;
  lastMessageMine: boolean;
  lastMessageRead: boolean;
  unread: number;
}

/** `pending` — WebSocket'ga yuborildi, server tasdig'i kutilmoqda; `failed` — yetib bormadi. */
export type MessageStatus = "sent" | "pending" | "failed";

export interface MessageView {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  isRead: boolean;
  createdAt: string | null;
  status: MessageStatus;
  clientId: string | null;
}

export interface MessageLink {
  href: string;
  host: string;
  path: string;
  at: string | null;
}

const ROLES: readonly ParticipantRole[] = ["employer", "job_seeker", "admin"];
const EMPLOYMENT: readonly EmploymentType[] = ["full_time", "part_time", "remote", "shift"];
const EXPERIENCE: readonly ExperienceLevel[] = ["none", "one_to_three", "three_to_six", "six_plus"];

type Row = Record<string, unknown>;

function asRow(value: unknown): Row | null {
  return value && typeof value === "object" ? (value as Row) : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function positive(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function isoDate(value: unknown): string | null {
  if (typeof value !== "string" && !(value instanceof Date)) return null;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

function pick<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

export function mapCompanyToConversationViewModel(raw: unknown): ConversationCompany | null {
  const r = asRow(raw);
  const name = r ? text(r.name) : null;
  if (!r || !name) return null;
  const logo = text(r.logoUrl);
  return {
    name,
    slug: text(r.slug),
    logoUrl: logo ? absoluteUploadUrl(logo) : null,
    isVerified: r.isVerified === true,
    industry: text(r.industry),
    description: text(r.description),
    regionName: text(r.regionName),
  };
}

function mapVacancy(raw: unknown): ConversationVacancy | null {
  const r = asRow(raw);
  if (!r) return null;
  const title = text(r.title);
  const slug = text(r.slug);
  if (!title || !slug) return null;
  const min = positive(r.salaryMin);
  const max = positive(r.salaryMax);
  return {
    title,
    slug,
    isClosed: r.isClosed === true,
    regionName: text(r.regionName),
    employmentType: pick(r.employmentType, EMPLOYMENT),
    experience: pick(r.experienceRequired, EXPERIENCE),
    salary: min === null && max === null ? null : { min, max, currency: text(r.currency) ?? "UZS" },
  };
}

/**
 * `GET /api/conversations` qatori. Faqat id bo'lmasa tashlab yuboriladi: nomsiz suhbat (ismi bo'sh nomzod,
 * kompaniyasiz ish beruvchi) ham ro'yxatda qoladi — ilgari ko'rinmay qolardi (audit PHASE 6, V1).
 */
export function mapConversationToViewModel(raw: unknown): ConversationView | null {
  const r = asRow(raw);
  if (!r) return null;
  const id = text(r.id);
  if (!id) return null;
  const company = mapCompanyToConversationViewModel(r.company);
  const otherRole = pick(r.otherRole, ROLES);
  // Ish beruvchi ko'rinishida `company` — uning o'z kompaniyasi: nomzod nomi o'rniga qo'yilmaydi
  const title = text(r.title) ?? (otherRole === "job_seeker" ? null : company?.name ?? null);
  const lastMessage = text(r.lastMessage);
  const avatar = text(r.avatarUrl);
  const unread = typeof r.unread === "number" && Number.isFinite(r.unread) ? Math.max(0, Math.floor(r.unread)) : 0;
  return {
    id,
    title,
    otherRole,
    otherUserId: text(r.otherUserId),
    headline: text(r.otherHeadline),
    avatarUrl: avatar ? absoluteUploadUrl(avatar) : null,
    company,
    vacancy: mapVacancy(r.vacancy),
    lastMessage,
    lastMessageAt: lastMessage ? isoDate(r.lastMessageAt) : null,
    lastMessageMine: lastMessage ? r.lastMessageMine === true : false,
    lastMessageRead: lastMessage ? r.lastMessageRead === true : false,
    unread,
  };
}

/** REST tarixidagi yoki WebSocket orqali kelgan xabar. Matnsiz xabar chizilmaydi. */
export function mapMessageToViewModel(raw: unknown): MessageView | null {
  const r = asRow(raw);
  if (!r) return null;
  const id = text(r.id);
  const conversationId = text(r.conversationId);
  const senderId = text(r.senderId);
  const body = typeof r.body === "string" && r.body.trim() ? r.body : null;
  if (!id || !conversationId || !senderId || !body) return null;
  return {
    id,
    conversationId,
    senderId,
    body,
    isRead: r.isRead === true,
    createdAt: isoDate(r.createdAt),
    status: "sent",
    clientId: text(r.clientId),
  };
}

const LINK_RE = /\bhttps?:\/\/[^\s<>"'«»]+/gi;
const TRAILING = /[.,!?:;)\]}]+$/;

export type TextPart = { kind: "text"; value: string } | { kind: "link"; value: string; href: string };

function safeHref(candidate: string): string | null {
  try {
    const url = new URL(candidate);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

/** Xabar matnini oddiy matn va http(s) havolalarga ajratadi (havola bosiladigan bo'lsin). */
export function splitMessageText(body: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  for (const match of body.matchAll(LINK_RE)) {
    const raw = match[0].replace(TRAILING, "");
    const start = match.index ?? 0;
    const href = safeHref(raw);
    if (!href) continue;
    if (start > last) parts.push({ kind: "text", value: body.slice(last, start) });
    parts.push({ kind: "link", value: raw, href });
    last = start + raw.length;
  }
  if (last < body.length) parts.push({ kind: "text", value: body.slice(last) });
  return parts;
}

/** Suhbatda yuborilgan havolalar (yangisi birinchi, takrorlanmasdan) — "Havolalar" kartasi uchun. */
export function extractLinks(messages: MessageView[]): MessageLink[] {
  const seen = new Set<string>();
  const links: MessageLink[] = [];
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.status !== "sent") continue;
    for (const part of splitMessageText(m.body)) {
      if (part.kind !== "link" || seen.has(part.href)) continue;
      seen.add(part.href);
      const url = new URL(part.href);
      const path = `${url.pathname === "/" ? "" : url.pathname}${url.search}`;
      links.push({ href: part.href, host: url.host.replace(/^www\./, ""), path, at: m.createdAt });
    }
  }
  return links;
}
