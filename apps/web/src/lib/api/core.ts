// Real backend bilan ishlovchi data qatlami — faqat haqiqiy API'dan o'qiydi
// (namunaviy/mock ma'lumot ishlatilmaydi). Server o'chiq bo'lsa bo'sh natija qaytadi.


/** Umumiy qism: API manzili, xato turi, SSR sarlavhalari va so'rov yordamchilari. */

// Real backend bilan ishlovchi data qatlami — faqat haqiqiy API'dan o'qiydi
// (namunaviy/mock ma'lumot ishlatilmaydi). Server o'chiq bo'lsa bo'sh natija qaytadi.

/**
 * API manzili. Oxiridagi "/" olib tashlanadi — yo'llar ("/api/...") unga
 * qo'shib yoziladi, aks holda "https://api.sayt.uz//api/vacancies" chiqadi.
 */
export const API_URL = (import.meta.env.VITE_API_URL ?? "http://localhost:3000").replace(/\/+$/, "");

/** WebSocket manzili (http -> ws). */
export const WS_URL = API_URL.replace(/^http/i, "ws");

/** "/uploads/x.png" kabi nisbiy yo'lni API origin'iga to'liq URL qiladi. */
export function absoluteUploadUrl(path: string): string {
  return path.startsWith("/") ? `${API_URL}${path}` : path;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** SSR'da API javobini kutish chegarasi: sekin API barcha ochiq sahifalarni osiltirib qo'ymasin (audit ISSUE-069). */
export const SERVER_FETCH_TIMEOUT_MS = 8000;

/**
 * Serverda (SSR) so'rovga vaqt chegarasi qo'shadi; brauzerda chaqiruvchining signali o'zgarishsiz.
 * Timeout `TimeoutError` bo'lib keladi (AbortError emas) — chaqiruvchilar uni tarmoq xatosi deb biladi.
 */
export function withServerTimeout(signal?: AbortSignal | null): AbortSignal | undefined {
  if (typeof window !== "undefined") return signal ?? undefined;
  const timeout = AbortSignal.timeout(SERVER_FETCH_TIMEOUT_MS);
  if (!signal) return timeout;
  const any = (AbortSignal as unknown as { any?: (signals: AbortSignal[]) => AbortSignal }).any;
  return typeof any === "function" ? any([signal, timeout]) : signal;
}

/**
 * SSR so'rovlariga `x-ssr-key` qo'shadi (audit R3, D-074): butun web serverdan
 * keladigan trafik umumiy IP bucket'iga emas, alohida yuqori limitli bucket'ga tushadi.
 * `import.meta.env.SSR` bundler tomonidan statik almashtiriladi — kalit klient
 * bundle'iga hech qachon tushmaydi; `VITE_` o'zgaruvchisi ishlatilmaydi.
 */
export function ssrHeaders(): Record<string, string> {
  if (!import.meta.env.SSR) return {};
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  const key = env?.SSR_API_KEY;
  return key ? { "x-ssr-key": key } : {};
}

/** Ulanish xatosida null qaytaradi (server o'chiq bo'lsa ham sayt ishlashi uchun). */
export async function tryFetch(path: string, init?: RequestInit): Promise<Response | null> {
  try {
    return await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { ...(init?.headers as Record<string, string> | undefined), ...ssrHeaders() },
      signal: withServerTimeout(init?.signal),
    });
  } catch {
    return null;
  }
}

/** Server xabari va kodi bilan `ApiError` — umumiy "Xatolik" o'rniga (audit ISSUE-102). */
export async function throwApiError(res: Response): Promise<never> {
  const json = (await res.json().catch(() => null)) as { message?: unknown; error?: unknown } | null;
  throw new ApiError(
    res.status,
    typeof json?.message === "string" ? json.message : "Xatolik",
    typeof json?.error === "string" ? json.error : undefined
  );
}

export function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export async function authGet<T>(path: string, token: string, fallback: T): Promise<T> {
  const res = await tryFetch(path, { headers: authHeaders(token) });
  if (!res || !res.ok) return fallback;
  return (await res.json()) as T;
}
