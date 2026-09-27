import { API_URL, ApiError } from "../api.js";
import { mapArticleListPage, type ArticleCardVM } from "../articles/adapter.js";
import type { ContactSubjectKey } from "../i18n/types.js";
import { mapSupportContacts, type SupportContactsVM } from "./contacts.js";

/**
 * Yordam markazi va aloqa sahifasi API'si. Xatoda `ApiError` (tarmoq uzilsa
 * status 0), bekor qilinsa AbortError — "bo'sh" va "yuklab bo'lmadi" farqlanadi.
 */
async function request(path: string, init?: RequestInit): Promise<{ res: Response; json: Record<string, unknown> | null }> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, init);
  } catch (err) {
    if ((err as Error)?.name === "AbortError") throw err;
    throw new ApiError(0, "Serverga ulanib bo'lmadi");
  }
  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok || !json) {
    throw new ApiError(res.status, typeof json?.message === "string" ? json.message : "Kutilmagan xatolik", typeof json?.error === "string" ? json.error : undefined);
  }
  return { res, json };
}

export async function fetchSupportContacts(signal?: AbortSignal): Promise<SupportContactsVM> {
  const { json } = await request("/api/support/contacts", { signal });
  return mapSupportContacts(json);
}

export interface ContactMessageInput {
  name: string;
  email: string;
  subject: ContactSubjectKey | "";
  message: string;
  /** Honeypot — odam uchun bo'sh qoladi. */
  website: string;
}

/** Mavjud `POST /api/support`. Token bo'lsa yuboriladi — jamoa kim yozganini ko'radi. */
export async function sendContactMessage(input: ContactMessageInput, token: string | null): Promise<void> {
  await request("/api/support", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({
      name: input.name.trim(),
      email: input.email.trim(),
      ...(input.subject ? { subject: input.subject } : {}),
      message: input.message.trim(),
      ...(input.website ? { website: input.website } : {}),
    }),
  });
}

/** Yordam qidiruvida mavzuga oid maqolalar — mavjud `GET /api/articles` (faqat chop etilganlar). */
export async function fetchArticleMatches(q: string, limit: number, signal?: AbortSignal): Promise<{ items: ArticleCardVM[]; total: number }> {
  const params = new URLSearchParams({ q, pageSize: String(limit) });
  const { json } = await request(`/api/articles?${params}`, { signal });
  const page = mapArticleListPage(json);
  return { items: page.items.slice(0, limit), total: page.total };
}
