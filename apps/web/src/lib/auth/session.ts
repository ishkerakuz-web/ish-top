import { API_URL } from "../api.js";

/**
 * Brauzerdagi seans tokeni (audit ISSUE-019, ISSUE-020).
 *
 * - Access token ~15 daqiqada tugaydi. Fonda yangilanganda React holati O'ZGARMAYDI: sahifalar
 *   skeletga qaytmaydi, saqlanmagan qoralama yo'qolmaydi, WebSocket qayta ulanmaydi. Kontekstdagi
 *   `accessToken` faqat kirish/chiqishda o'zgaradi (seans identifikatori).
 * - API'ga ketayotgan har bir `Authorization: Bearer` so'rovi eng yangi tokenni oladi; 401 kelsa
 *   bitta umumiy refresh bajariladi va so'rov bir marta takrorlanadi. Refresh seans yo'qligini
 *   tasdiqlasa — `onSessionExpired` (mehmon holati). Tarmoq xatosi seansni o'chirmaydi.
 *
 * Nega global `fetch` o'rab olinadi: API chaqiruvlari o'nlab modulda to'g'ridan-to'g'ri `fetch` bilan
 * yozilgan. Har birini o'zgartirish katta va xavfli; bu yerda faqat API manziliga Bearer bilan
 * ketayotgan so'rovlar ushlanadi (auth yo'llari va boshqa domenlar tegilmaydi).
 *
 * Audit PHASE 6:
 * - V2: refresh cookie butun brauzer profiliga umumiy. Boshqa tabda boshqa hisobga kirilgan bo'lsa,
 *   refresh o'sha hisob tokenini qaytaradi — u OLINMAYDI, sahifa haqiqiy seans bilan qayta yuklanadi.
 *   Boshqa tabdagi kirish/chiqish `storage` hodisasi orqali ham shu tabga yetadi.
 * - U20: seans davri (epoch) kirish/chiqish/mehmon holatida oshadi; davr o'zgargach tugagan refresh
 *   natijasi yozilmaydi (chiqishdan keyin token qaytib kelmaydi).
 */

const STORAGE_KEY = "ish-top:accessToken";

let current: string | null = null;
let inflight: Promise<string | null | undefined> | null = null;
/** `inflight` boshlangan davr — kirish/chiqishdan keyin eski refresh qayta ishlatilmaydi. */
let inflightEpoch = -1;
let nativeFetch: typeof fetch = (input, init) => fetch(input, init);
let installed = false;
let onSessionExpired: (() => void) | null = null;
/** Seans davri (audit PHASE 6, U20). */
let epoch = 0;
/** Boshqa hisobga o'tilgani aniqlandi — sahifa qayta yuklanmoqda (audit PHASE 6, V2). */
let reloading = false;

/** Interceptor tegmaydigan seans endpointlari (o'zlari token beradi yoki bekor qiladi). */
const SESSION_PATHS = ["/api/auth/login", "/api/auth/register", "/api/auth/refresh", "/api/auth/logout", "/api/auth/google", "/api/auth/recovery/"];

/** Hozirgi seans davri: refresh natijasi qaysi davrga tegishli ekanini solishtirish uchun. */
export function getSessionEpoch(): number {
  return epoch;
}

/** Kirish, chiqish va mehmon holatida chaqiriladi: yarim yo'lda qolgan refresh natijasi tashlanadi (audit PHASE 6, U20). */
export function bumpSessionEpoch(): void {
  epoch += 1;
}

/**
 * Refresh seans yo'qligini tasdiqladi — AuthProvider mehmon holatiga o'tadi (audit PHASE 6, U23).
 * `since` — refresh chaqirilgan davr: shu orada kirish/chiqish bo'lgan bo'lsa hech narsa qilinmaydi
 * (aks holda eski seansning "null"i yangi kirishni o'chirib yuborardi).
 */
export function expireSession(since?: number): void {
  if (since !== undefined && since !== epoch) return;
  onSessionExpired?.();
}

/** JWT payload'idagi `sub` — imzo tekshirilmaydi, faqat solishtirish uchun; o'qib bo'lmasa `null` (audit PHASE 6, V2). */
function tokenSubject(token: string | null): string | null {
  if (!token) return null;
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4))) as { sub?: unknown } | null;
    return typeof payload?.sub === "string" && payload.sub ? payload.sub : null;
  } catch {
    return null;
  }
}

/** Ikki token boshqa-boshqa foydalanuvchiniki: ikkala `sub` o'qilgan va farq qiladi (o'qilmasa — bir xil deb olinadi). */
function differentUser(a: string | null, b: string | null): boolean {
  const subA = tokenSubject(a);
  const subB = tokenSubject(b);
  return subA !== null && subB !== null && subA !== subB;
}

/** Shu tab boshqa hisob nomidan ishlamasin: to'liq qayta yuklash — seans noldan tiklanadi (audit PHASE 6, V2). */
function reloadForIdentityChange(): void {
  if (reloading || typeof window === "undefined") return;
  reloading = true;
  window.location.reload();
  // `beforeunload` so'rovi (saqlanmagan forma) qayta yuklashni bekor qilsa, tab shu holatda qotib qolmasin:
  // sahifa hali tirik bo'lsa bayroq tushiriladi va keyingi refresh yana tekshiradi (audit PHASE 6, V2 review)
  window.setTimeout(() => {
    reloading = false;
  }, 5000);
}

export function getAccessToken(): string | null {
  return current;
}

export function setAccessToken(token: string | null): void {
  current = token;
  try {
    if (token) window.localStorage.setItem(STORAGE_KEY, token);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* saqlash bloklangan (maxfiy rejim) — xotiradagi token yetarli */
  }
}

export function readStoredToken(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * `string` — yangi token; `null` — seans yo'q (refresh cookie yo'q, bekor qilingan yoki muddati tugagan);
 * `undefined` — tarmoq yoki server xatosi (seans holati noma'lum, token o'chirilmaydi).
 */
async function requestRefresh(): Promise<string | null | undefined> {
  try {
    const res = await nativeFetch(`${API_URL}/api/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    if (!res.ok) return res.status >= 500 || res.status === 429 ? undefined : null;
    const json = (await res.json().catch(() => null)) as { accessToken?: unknown } | null;
    return typeof json?.accessToken === "string" && json.accessToken ? json.accessToken : null;
  } catch {
    return undefined;
  }
}

/**
 * Bir vaqtda bitta refresh: parallel 401'lar bitta so'rovni kutadi (bitta seans davri ichida).
 * Davr o'zgargach tugasa — natija yozilmaydi, `null` (audit PHASE 6, U20).
 * Boshqa foydalanuvchi tokeni kelsa — olinmaydi, `undefined` va sahifa qayta yuklanadi (audit PHASE 6, V2).
 */
export function refreshSession(): Promise<string | null | undefined> {
  if (reloading) return Promise.resolve(undefined);
  if (!inflight || inflightEpoch !== epoch) {
    const started = epoch;
    const promise: Promise<string | null | undefined> = requestRefresh()
      .then((token) => {
        // Shu orada chiqildi/kirildi — eski seans natijasi xotiraga ham, localStorage'ga ham yozilmaydi
        if (started !== epoch) return null;
        if (!token) return token;
        // Cookie endi boshqa hisobniki (boshqa tabda kirilgan): token olinmaydi, so'rov takrorlanmaydi
        if (current && differentUser(current, token)) {
          reloadForIdentityChange();
          return undefined;
        }
        setAccessToken(token);
        return token;
      })
      .finally(() => {
        if (inflight === promise) inflight = null;
      });
    inflight = promise;
    inflightEpoch = started;
  }
  return inflight;
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

/** Brauzerda bir marta o'rnatiladi (AuthProvider). `onExpired` har chaqiruvda yangilanadi. */
export function installAuthFetch(onExpired: () => void): void {
  onSessionExpired = onExpired;
  if (installed || typeof window === "undefined") return;
  installed = true;

  const original = window.fetch.bind(window);
  nativeFetch = original;

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = requestUrl(input);
    // Faqat seans endpointlari chetlab o'tiladi (login, register, refresh, logout, google, tiklash):
    // ilgari butun /api/auth/ prefiksi o'tkazilardi va autentifikatsiyali /api/auth/phone/* chaqiruvlari
    // eskirgan token bilan 401 olardi (audit R3 ikkinchi audit, frontend-docs-1).
    if (!url.startsWith(`${API_URL}/`) || SESSION_PATHS.some((path) => url.startsWith(`${API_URL}${path}`))) return original(input, init);

    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    const auth = headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return original(input, init);

    const since = epoch;
    const sent = auth.slice("Bearer ".length);
    // Render paytida olingan (eskirgan) token bilan chaqirilgan bo'lsa — eng yangisi qo'yiladi.
    // Boshqa foydalanuvchi tokeniga almashtirilmaydi: eski UI ma'lumoti boshqa hisob nomidan ketmasin (audit PHASE 6, V2)
    if (current && sent !== current && !differentUser(sent, current)) headers.set("Authorization", `Bearer ${current}`);
    const response = await original(input, { ...init, headers });
    if (response.status === 403 && since === epoch && !reloading) {
      // Hisob bloklangan: server endi har autentifikatsiyalangan so'rovga 403 USER_BLOCKED qaytaradi.
      // Tab xato ko'rsatib qolmasin — seans tugagan deb mehmon holatiga o'tiladi (audit PHASE 6, V5)
      const code = await response
        .clone()
        .json()
        .then((body: { error?: unknown } | null) => body?.error, () => undefined);
      if (code === "USER_BLOCKED") expireSession(since);
      return response;
    }
    if (response.status !== 401) return response;
    // So'rov yuborilgach chiqildi/kirildi — eski so'rov yangi seans bilan takrorlanmaydi (audit PHASE 6, U20)
    if (since !== epoch || reloading) return response;

    const fresh = await refreshSession();
    if (fresh === null) {
      expireSession(since);
      return response;
    }
    if (!fresh || differentUser(sent, fresh)) return response;
    headers.set("Authorization", `Bearer ${fresh}`);
    return original(input, { ...init, headers });
  };

  // Boshqa tabdagi kirish/chiqish/yangilash (audit PHASE 6, V2). Faqat xotiraga yoziladi — tablar
  // bir-birining yozuvini qaytarib yozmaydi (aks holda cheksiz aylanish bo'lardi).
  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY || reloading) return;
    try {
      if (event.storageArea && event.storageArea !== window.localStorage) return;
    } catch {
      return;
    }
    const next = event.newValue;
    if (next === current) return;
    if (!next) {
      // Boshqa tabda chiqildi (yoki seans tugadi) — shu tab ham mehmon holatiga o'tadi
      onSessionExpired?.();
      return;
    }
    // Mehmon yoki seans tiklanayotgan tab — o'z tiklash oqimi hal qiladi (yozilayotgan forma yo'qolmasin)
    if (!current) return;
    if (differentUser(current, next)) reloadForIdentityChange();
    else current = next;
  });
}
