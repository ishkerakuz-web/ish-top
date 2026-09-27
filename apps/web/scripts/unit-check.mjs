// ============================================================
// Frontend yordamchilarining bazasiz (unit) tekshiruvi (audit PHASE 6, U9; R3, docs-13).
//
// Yangi kutubxona qo'shilmaydi: esbuild (vite bog'liqligi) apps/web'dan topiladi.
// Kichik kirish moduli tekshiriladigan SOF funksiyalarni bitta ESM faylga yig'adi;
// fayl OS vaqtinchalik papkasiga yoziladi, import qilinadi va tekshiriladi.
//
// Qamrov:
//  - JsonLd.tsx, returnTo.ts, notifications/adapter.ts (XSS va ochiq yo'naltirish);
//  - employer/applications/query.ts — "Murojaatlar" URL holati (audit R3, D-061);
//  - auth/recovery.ts — parol tiklash rejimlari va xato tasnifi (audit R3, D-045/D-063);
//  - files/resume.ts — himoyalangan PDF rezyume manzillari (audit R3, D-058).
//  - notifications/adapter.ts va uch tildagi lug'atlar — bildirishnoma payload.i18n tarjimasi (audit R3, D-059).
//  - format.ts — til bo'yicha raqam/maosh formati va hudud nomi (audit R3, i18n-4/i18n-6/i18n-7).
//
// Ishlatish:
//   npm run test:unit                    (apps/web ichida)
//   npm --prefix apps/web run test:unit  (repo ildizidan)
// ============================================================
import { createRequire } from "node:module";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";

const WEB_ROOT = fileURLToPath(new URL("..", import.meta.url));
const requireFromWeb = createRequire(join(WEB_ROOT, "package.json"));

/** esbuild apps/web'dan; topilmasa — vite'ning o'z bog'liqligidan. */
function loadEsbuild() {
  try {
    return requireFromWeb("esbuild");
  } catch {
    return createRequire(requireFromWeb.resolve("vite/package.json"))("esbuild");
  }
}

// Kirish moduli — faqat tekshiriladigan funksiyalar (bundle qolganini tashlab yuboradi)
const ENTRY = [
  'export { serializeJsonLd } from "./src/components/JsonLd.tsx";',
  'export { safeReturnTo } from "./src/lib/auth/returnTo.ts";',
  'export { safeInternalUrl } from "./src/lib/notifications/adapter.ts";',
  // Audit R3, D-059: bildirishnoma tarjima kaliti (payload.i18n) va zaxira matn
  'export { mapNotificationToViewModel, readNotificationI18n, renderNotificationTemplate } from "./src/lib/notifications/adapter.ts";',
  'export { default as messagesUz } from "./src/lib/i18n/messages.uz.ts";',
  'export { default as messagesRu } from "./src/lib/i18n/messages.ru.ts";',
  'export { default as messagesEn } from "./src/lib/i18n/messages.en.ts";',
  // Audit R3, D-061: ish beruvchi "Murojaatlar" sahifasining URL holati (server sahifalashi uchun)
  'export { parseEmployerApplicationQuery, employerApplicationSearch, hasApplicationFilters, panelFilterCount } from "./src/lib/employer/applications/query.ts";',
  // Audit R3, D-045/D-063: /login ichidagi tiklash rejimlari va xato tasnifi
  'export { recoveryModeFrom, recoveryErrorKind, minutesUntil } from "./src/lib/auth/recovery.ts";',
  'export { ApiError, API_URL } from "./src/lib/api.ts";',
  // Audit R3, D-058: rezyume fayli endi statik /uploads/ dan emas, vakolatli endpointdan olinadi
  'export { ownResumeFileUrl, applicationResumeFileUrl } from "./src/lib/files/resume.ts";',
  // Audit R3, i18n-4/i18n-6/i18n-7: raqam, maosh va hudud nomi joriy tilga bog'liq (sof funksiyalar)
  'export { formatNumber, formatSalary, regionDisplayName } from "./src/lib/format.ts";',
].join("\n");

/**
 * Paketlar (react va boshqalar) bundle'ga kirmaydi. Bundle vaqtinchalik papkadan import
 * qilinadi, u yerda node_modules yo'q — shuning uchun paket apps/web'dagi to'liq yo'lga
 * (file://) aylantiriladi; aniqlab bo'lmasa nomi o'zicha qoladi.
 */
const externalPackages = {
  name: "web-packages-external",
  setup(build) {
    build.onResolve({ filter: /^[^./]/ }, (args) => {
      try {
        return { path: pathToFileURL(requireFromWeb.resolve(args.path)).href, external: true };
      } catch {
        return { path: args.path, external: true };
      }
    });
  },
};

/**
 * `import.meta.env` — Vite'ning build-time qiymati; Node'da u yo'q va `api.ts` dagi
 * `import.meta.env.VITE_API_URL` import paytidayoq yiqilardi. Bundle uchun sobit qiymat
 * qo'yamiz (tekshiriladigan funksiyalar tarmoqqa chiqmaydi).
 */
const VITE_ENV = { SSR: false, DEV: false, PROD: true, MODE: "test", VITE_API_URL: "http://localhost:3000" };

async function loadModule() {
  const esbuild = loadEsbuild();
  const result = await esbuild.build({
    stdin: { contents: ENTRY, resolveDir: WEB_ROOT, sourcefile: "unit-check-entry.ts", loader: "ts" },
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node20",
    write: false,
    logLevel: "silent",
    define: { "import.meta.env": JSON.stringify(VITE_ENV) },
    plugins: [externalPackages],
  });
  const dir = mkdtempSync(join(tmpdir(), "ishbor-unit-"));
  try {
    const file = join(dir, "unit-bundle.mjs");
    writeFileSync(file, result.outputFiles[0].text);
    return await import(pathToFileURL(file).href);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

let mod;
try {
  mod = await loadModule();
} catch (e) {
  console.error("  XATO bundle: " + (e?.message ?? e));
  process.exit(1);
}

let failed = 0;
function check(name, fn) {
  try {
    fn();
    console.log("  OK  " + name);
  } catch (e) {
    failed++;
    console.error("  XATO " + name + ": " + (e?.message ?? e));
  }
}

// Boshqaruv va ajratgich belgilari manba matniga escape ko'rinishida yozilmaydi — kod bo'yicha yasaladi
const TAB = String.fromCharCode(9);
const BACKSLASH = String.fromCharCode(92);
const LINE_SEPARATOR = String.fromCharCode(0x2028);
const PARAGRAPH_SEPARATOR = String.fromCharCode(0x2029);

check("serializeJsonLd: </script>, U+2028/U+2029 va & bilan chiqish skript blokini yopmaydi, JSON ma'nosi o'zgarmaydi", () => {
  const input = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: "</script><script>alert(1)</script>",
    description: `Qator${LINE_SEPARATOR}ajratgich${PARAGRAPH_SEPARATOR}paragraf & "qo'shtirnoq"`,
    nested: { list: ["</SCRIPT >", "a&b", LINE_SEPARATOR + PARAGRAPH_SEPARATOR], count: 3, ok: true, empty: null },
  };
  const out = mod.serializeJsonLd(input);
  if (typeof out !== "string") throw new Error("satr qaytmadi: " + typeof out);
  if (out.toLowerCase().includes("</script")) throw new Error("chiqishda </script bor");
  for (let i = 0; i < out.length; i++) {
    const code = out.charCodeAt(i);
    if (code === 0x2028 || code === 0x2029) throw new Error(`xom U+${code.toString(16).toUpperCase()} belgisi, ${i}-pozitsiya`);
  }
  if (!isDeepStrictEqual(JSON.parse(out), input)) throw new Error("JSON.parse natijasi kirish bilan teng emas");
});

check("safeReturnTo: //host, /<backslash>host, /<tab>/host rad etiladi; /vacancies?x=1 qabul qilinadi", () => {
  for (const bad of ["//evil.example", "/" + BACKSLASH + "evil.example", "/" + TAB + "/evil.example"]) {
    const got = mod.safeReturnTo(bad);
    if (got !== null) throw new Error(`${JSON.stringify(bad)} -> ${JSON.stringify(got)}`);
  }
  const ok = mod.safeReturnTo("/vacancies?x=1");
  if (ok !== "/vacancies?x=1") throw new Error("/vacancies?x=1 -> " + JSON.stringify(ok));
});

check("safeInternalUrl: //x, /<backslash>x, /<tab>/x rad etiladi; /applications qabul qilinadi", () => {
  for (const bad of ["//x", "/" + BACKSLASH + "x", "/" + TAB + "/x"]) {
    const got = mod.safeInternalUrl(bad);
    if (got !== null) throw new Error(`${JSON.stringify(bad)} -> ${JSON.stringify(got)}`);
  }
  const ok = mod.safeInternalUrl("/applications");
  if (ok !== "/applications") throw new Error("/applications -> " + JSON.stringify(ok));
});

// ------------------------------------------------------------
// Audit R3, D-061: "Murojaatlar" URL holati (server tomonidagi sahifalash uchun)
// ------------------------------------------------------------
const OBJECT_ID = "0123456789abcdef01234567";

check("[D-061] parseEmployerApplicationQuery: noto'g'ri qiymatlar standartga tushadi, ObjectId tekshiriladi", () => {
  const q = mod.parseEmployerApplicationQuery({
    q: "   react     dasturchi  ",
    status: "yoq-holat",
    vacancy: "notogri-id",
    application: OBJECT_ID,
    region: "tashkent",
    period: "100y",
    sort: "tasodifiy",
    page: "0",
    size: "999",
  });
  if (q.q !== "react dasturchi") throw new Error("q: " + JSON.stringify(q.q));
  if (q.status !== null) throw new Error("status: " + JSON.stringify(q.status));
  if (q.vacancy !== "") throw new Error("noto'g'ri vacancy ID o'tib ketdi: " + JSON.stringify(q.vacancy));
  if (q.application !== OBJECT_ID) throw new Error("application: " + JSON.stringify(q.application));
  if (q.period !== "") throw new Error("period: " + JSON.stringify(q.period));
  if (q.sort !== "newest") throw new Error("sort: " + JSON.stringify(q.sort));
  if (q.page !== 1) throw new Error("page: " + q.page);
  if (q.size !== 10) throw new Error("size: " + q.size);
  // Juda uzun qidiruv kesiladi (server ham 100 belgi bilan cheklaydi)
  const long = mod.parseEmployerApplicationQuery({ q: "a".repeat(500) });
  if (long.q.length !== 100) throw new Error("uzun qidiruv: " + long.q.length);
  // URLSearchParams ham manba bo'la oladi
  const fromParams = mod.parseEmployerApplicationQuery(new URLSearchParams(`status=invited&page=3&size=20&vacancy=${OBJECT_ID}`));
  if (fromParams.status !== "invited" || fromParams.page !== 3 || fromParams.size !== 20 || fromParams.vacancy !== OBJECT_ID) {
    throw new Error("URLSearchParams: " + JSON.stringify(fromParams));
  }
});

check("[D-061] employerApplicationSearch: standart qiymatlar yozilmaydi, to'liq holat parse bilan aylanadi", () => {
  const empty = mod.employerApplicationSearch(mod.parseEmployerApplicationQuery({}));
  if (empty !== "") throw new Error("standart holat: " + JSON.stringify(empty));
  const source = { q: "react", status: "invited", vacancy: OBJECT_ID, region: "tashkent", period: "7d", sort: "oldest", page: "4", size: "20", application: OBJECT_ID };
  const parsed = mod.parseEmployerApplicationQuery(source);
  const search = mod.employerApplicationSearch(parsed);
  if (!search.startsWith("?")) throw new Error("search: " + search);
  const round = mod.parseEmployerApplicationQuery(new URLSearchParams(search.slice(1)));
  if (!isDeepStrictEqual(round, parsed)) throw new Error("aylanma teng emas: " + JSON.stringify({ parsed, round }));
});

check("[D-061] hasApplicationFilters va panelFilterCount: holat tabi filtr, saralash panel belgisiga kiradi", () => {
  const none = mod.parseEmployerApplicationQuery({});
  if (mod.hasApplicationFilters(none) !== false) throw new Error("bo'sh holat filtrli deb topildi");
  if (mod.panelFilterCount(none) !== 0) throw new Error("bo'sh holat paneli: " + mod.panelFilterCount(none));
  const status = mod.parseEmployerApplicationQuery({ status: "sent" });
  if (mod.hasApplicationFilters(status) !== true) throw new Error("holat tabi filtr sifatida sanalmadi");
  if (mod.panelFilterCount(status) !== 0) throw new Error("holat tabi panel belgisiga kirdi");
  const full = mod.parseEmployerApplicationQuery({ vacancy: OBJECT_ID, region: "tashkent", period: "30d", sort: "oldest" });
  if (mod.panelFilterCount(full) !== 4) throw new Error("panel belgisi: " + mod.panelFilterCount(full));
});

// ------------------------------------------------------------
// Audit R3, D-045/D-063: /login ichidagi tiklash rejimlari (yangi sahifa yaratilmaydi)
// ------------------------------------------------------------
check("[D-063] recoveryModeFrom: ?reset= ustun, ?recover= qiymatlari, noma'lum qiymat — rejim yo'q", () => {
  const cases = [
    [{}, null],
    [{ recover: "1" }, "phone"],
    [{ recover: "phone" }, "phone"],
    [{ recover: "true" }, "phone"],
    [{ recover: "manual" }, "manual"],
    [{ recover: "status" }, "status"],
    [{ recover: "boshqa" }, null],
    [{ reset: "abc" }, "reset"],
    [{ reset: "abc", recover: "manual" }, "reset"],
  ];
  for (const [input, expected] of cases) {
    const got = mod.recoveryModeFrom(input);
    if (got !== expected) throw new Error(`${JSON.stringify(input)} -> ${JSON.stringify(got)} (kutilgan ${JSON.stringify(expected)})`);
  }
});

check("[D-051] recoveryErrorKind: 503/TELEGRAM_UNAVAILABLE, 429, RECOVERY_NOT_APPROVED va 400 ajratiladi", () => {
  const { ApiError } = mod;
  const cases = [
    [new ApiError(503, "xabar", "TELEGRAM_UNAVAILABLE"), "unavailable"],
    [new ApiError(503, "xabar"), "unavailable"],
    [new ApiError(500, "xabar", "TELEGRAM_UNAVAILABLE"), "unavailable"],
    [new ApiError(429, "xabar", "RATE_LIMITED"), "rateLimit"],
    [new ApiError(409, "xabar", "RECOVERY_NOT_APPROVED"), "notApproved"],
    [new ApiError(400, "xabar", "VALIDATION_ERROR"), "invalidPhone"],
    [new ApiError(0, "tarmoq", "NETWORK"), "generic"],
    [new Error("oddiy xato"), "generic"],
    [null, "generic"],
  ];
  for (const [input, expected] of cases) {
    const got = mod.recoveryErrorKind(input);
    if (got !== expected) throw new Error(`${input?.status ?? input} -> ${got} (kutilgan ${expected})`);
  }
});

check("[D-045] minutesUntil: sanasiz null, buzilgan sana null, o'tgan vaqt kamida 1 daqiqa", () => {
  if (mod.minutesUntil(null) !== null) throw new Error("null: " + mod.minutesUntil(null));
  if (mod.minutesUntil("") !== null) throw new Error("bo'sh satr");
  if (mod.minutesUntil("sana emas") !== null) throw new Error("buzilgan sana: " + mod.minutesUntil("sana emas"));
  const soon = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const minutes = mod.minutesUntil(soon);
  if (minutes !== 15 && minutes !== 14) throw new Error("15 daqiqa: " + minutes);
  const past = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  if (mod.minutesUntil(past) !== 1) throw new Error("o'tgan vaqt: " + mod.minutesUntil(past));
});

// ------------------------------------------------------------
// Audit R3, D-058: PDF rezyume faqat vakolatli endpointdan
// ------------------------------------------------------------
check("[D-058] rezyume fayli manzillari: /api/resume-files/... (statik /uploads/ yo'li ishlatilmaydi)", () => {
  const mine = mod.ownResumeFileUrl();
  if (mine !== `${mod.API_URL}/api/resume-files/me`) throw new Error("o'z fayli: " + mine);
  const byApplication = mod.applicationResumeFileUrl(OBJECT_ID);
  if (byApplication !== `${mod.API_URL}/api/resume-files/application/${OBJECT_ID}`) throw new Error("ariza fayli: " + byApplication);
  for (const url of [mine, byApplication]) {
    if (url.includes("/uploads/")) throw new Error("manzil hali statik /uploads/ ga ishora qiladi: " + url);
  }
  // ID manzilga XOM holda qo'shilmaydi: yo'ldan chiqish urinishi kodlanadi
  const evil = mod.applicationResumeFileUrl("../../uploads/resume-a.pdf");
  if (!evil.startsWith(`${mod.API_URL}/api/resume-files/application/`)) throw new Error("prefiks buzildi: " + evil);
  if (evil.includes("../") || evil.includes("/uploads/")) throw new Error("ID kodlanmadi: " + evil);
});
// ------------------------------------------------------------
// Audit R3, D-059: bildirishnoma tarjima kaliti (payload.i18n) va zaxira matn.
// Shartnoma: notification_i18n_contract.md — server `payload.i18n = { key, params }` yuboradi,
// bazada o'zbekcha `title`/`body` qoladi; web kalitni joriy tilda chizadi, kalit noma'lum yoki
// parametr yetishmasa — bazadagi matnni ko'rsatadi (hech qachon bo'sh bildirishnoma emas).
// ------------------------------------------------------------

/** Shartnomadagi kalitlar va ularning parametrlari (notification_i18n_contract.md). */
const CONTRACT_KEYS = {
  "application.new": ["vacancyTitle"],
  "application.statusChanged": ["vacancyTitle", "status"],
  "alerts.newMatches": ["searchName", "count", "titles"],
  "vacancy.rejected": ["vacancyTitle", "reason"],
  "vacancy.archivedByAdmin": ["vacancyTitle"],
  "company.verified": ["companyName"],
  "company.verificationRemoved": ["companyName"],
  "payment.confirmed": ["planName"],
  "security.phone_changed": [],
  "security.recovery_completed": [],
  "security.sessions_invalidated": [],
};

const LOCALES = [
  ["uz", mod.messagesUz],
  ["ru", mod.messagesRu],
  ["en", mod.messagesEn],
];

check("[D-059] readNotificationI18n: payload.i18n va WS freymidagi i18n o'qiladi, oddiy bo'lmagan parametr tashlanadi", () => {
  const fromPayload = mod.readNotificationI18n({ payload: { i18n: { key: "application.new", params: { vacancyTitle: "Frontend" } } } });
  if (fromPayload?.key !== "application.new" || fromPayload.params.vacancyTitle !== "Frontend") {
    throw new Error("payload.i18n: " + JSON.stringify(fromPayload));
  }
  const fromFrame = mod.readNotificationI18n({ i18n: { key: "company.verified", params: { companyName: "NextBrain" } } });
  if (fromFrame?.key !== "company.verified") throw new Error("freym i18n: " + JSON.stringify(fromFrame));
  // Son va mantiqiy qiymat matnga aylanadi, obyekt/massiv tashlab yuboriladi
  const mixed = mod.readNotificationI18n({ payload: { i18n: { key: "alerts.newMatches", params: { count: 3, ok: true, bad: { x: 1 }, list: [1, 2] } } } });
  if (mixed?.params.count !== "3" || mixed.params.ok !== "true") throw new Error("parametr turlari: " + JSON.stringify(mixed));
  if ("bad" in mixed.params || "list" in mixed.params) throw new Error("obyekt/massiv parametr o'tib ketdi: " + JSON.stringify(mixed.params));
  for (const bad of [null, undefined, "matn", {}, { payload: {} }, { payload: { i18n: {} } }, { payload: { i18n: { key: "   " } } }]) {
    if (mod.readNotificationI18n(bad) !== null) throw new Error("kutilgan null: " + JSON.stringify(bad));
  }
});

check("[D-059] renderNotificationTemplate: kalit joriy tilda chiziladi, status yorlig'i qo'yiladi, noma'lum kalit — null", () => {
  const [, uz] = LOCALES[0];
  const [, en] = LOCALES[2];
  const rendered = mod.renderNotificationTemplate({ key: "application.new", params: { vacancyTitle: "Frontend dasturchi" } }, uz);
  if (!rendered?.body?.includes("Frontend dasturchi")) throw new Error("uz matn: " + JSON.stringify(rendered));
  if (rendered.title !== uz.notificationTemplates["application.new"].title) throw new Error("uz sarlavha: " + JSON.stringify(rendered));
  const english = mod.renderNotificationTemplate({ key: "application.new", params: { vacancyTitle: "Frontend" } }, en);
  if (english?.title !== en.notificationTemplates["application.new"].title) throw new Error("en sarlavha: " + JSON.stringify(english));

  // `status` — backend enum'i; mavjud ariza holati yorliqlari bilan chiziladi (raw "invited" qolmaydi)
  const status = mod.renderNotificationTemplate({ key: "application.statusChanged", params: { vacancyTitle: "Frontend", status: "invited" } }, uz);
  if (!status?.body?.includes(uz.applicationsPage.status.invited)) throw new Error("status yorlig'i: " + JSON.stringify(status));
  if (status.body.includes("invited")) throw new Error("xom enum qiymati matnda qoldi: " + status.body);

  // Noma'lum kalit, lug'atsiz chaqiruv va yetishmayotgan parametr — null (chaqiruvchi bazadagi matnga qaytadi)
  if (mod.renderNotificationTemplate({ key: "yoq.kalit", params: {} }, uz) !== null) throw new Error("noma'lum kalit null emas");
  if (mod.renderNotificationTemplate({ key: "application.new", params: { vacancyTitle: "X" } }, null) !== null) throw new Error("lug'atsiz null emas");
  if (mod.renderNotificationTemplate(null, uz) !== null) throw new Error("i18n'siz null emas");
  const missing = mod.renderNotificationTemplate({ key: "application.new", params: {} }, uz);
  if (missing !== null && typeof missing.body === "string" && missing.body.includes("{vacancyTitle}")) {
    throw new Error("to'ldirilmagan o'rin matnda qoldi: " + missing.body);
  }
});

check("[D-059] mapNotificationToViewModel: lug'at bilan tarjima, lug'atsiz/noma'lum kalitda bazadagi matn", () => {
  const [, uz] = LOCALES[0];
  const [, ru] = LOCALES[1];
  const row = {
    id: "n1",
    type: "new_application",
    title: "Yangi ariza",
    body: "«Frontend dasturchi» vakansiyasiga yangi nomzod ariza yubordi",
    url: "/employer/applications",
    isRead: false,
    createdAt: new Date().toISOString(),
    payload: { i18n: { key: "application.new", params: { vacancyTitle: "Frontend dasturchi" } } },
  };
  const localized = mod.mapNotificationToViewModel(row, ru);
  if (!localized) throw new Error("model chizilmadi");
  if (localized.localized !== true) throw new Error("localized bayrog'i: " + JSON.stringify(localized));
  if (localized.title !== ru.notificationTemplates["application.new"].title) throw new Error("ru sarlavha: " + localized.title);
  if (!localized.body.includes("Frontend dasturchi")) throw new Error("parametr chizilmadi: " + localized.body);
  if (localized.url !== "/employer/applications" || localized.target !== "employer") throw new Error("havola: " + JSON.stringify(localized));

  // Lug'atsiz — bazadagi o'zbekcha matn (eski klient bilan bir xil xulq)
  const fallback = mod.mapNotificationToViewModel(row);
  if (fallback.title !== row.title || fallback.body !== row.body) throw new Error("zaxira matn: " + JSON.stringify(fallback));
  if (fallback.localized !== false) throw new Error("lug'atsiz localized=true");

  // Noma'lum kalit (kelajakdagi server) — bazadagi matn, xato yo'q
  const unknown = mod.mapNotificationToViewModel({ ...row, payload: { i18n: { key: "kelajak.kalit", params: {} } } }, uz);
  if (unknown.title !== row.title || unknown.localized !== false) throw new Error("noma'lum kalit: " + JSON.stringify(unknown));

  // Eski yozuv (payload yo'q) — bazadagi matn
  const legacy = mod.mapNotificationToViewModel({ id: "n2", type: "system", title: "Eski", body: "Matn" }, uz);
  if (legacy.title !== "Eski" || legacy.localized !== false) throw new Error("eski yozuv: " + JSON.stringify(legacy));

  // Matnsiz va kalitsiz yozuv — null (bo'sh bildirishnoma chizilmaydi)
  if (mod.mapNotificationToViewModel({ id: "n3", type: "system" }, uz) !== null) throw new Error("matnsiz yozuv null emas");
  // Eski yozuvda havola payload ichida
  const payloadUrl = mod.mapNotificationToViewModel({ id: "n4", type: "system", title: "X", payload: { url: "/applications" } }, uz);
  if (payloadUrl.url !== "/applications" || payloadUrl.target !== "applications") throw new Error("payload.url: " + JSON.stringify(payloadUrl));
  // Tashqi havola payload ichidan ham o'tmaydi
  const evil = mod.mapNotificationToViewModel({ id: "n5", type: "system", title: "X", payload: { url: "//evil.example" } }, uz);
  if (evil.url !== null) throw new Error("tashqi havola o'tdi: " + evil.url);
});

check("[D-059] notificationTemplates: uchala tilda bir xil kalitlar, shartnomadagi barcha kalitlar va faqat ruxsat etilgan parametrlar", () => {
  const PLACEHOLDER = /\{([A-Za-z0-9_]+)\}/g;
  const keysOf = (messages) => Object.keys(messages.notificationTemplates ?? {}).sort();
  const base = keysOf(LOCALES[0][1]);
  for (const [locale, messages] of LOCALES) {
    const keys = keysOf(messages);
    if (JSON.stringify(keys) !== JSON.stringify(base)) throw new Error(`${locale} kalitlari farq qiladi: ` + keys.join(","));
    for (const key of Object.keys(CONTRACT_KEYS)) {
      const template = messages.notificationTemplates?.[key];
      if (!template || typeof template.title !== "string" || typeof template.body !== "string") {
        throw new Error(`${locale}: "${key}" shabloni yo'q (notification_i18n_contract.md)`);
      }
      const allowed = CONTRACT_KEYS[key];
      for (const text of [template.title, template.body]) {
        for (const match of text.matchAll(PLACEHOLDER)) {
          if (!allowed.includes(match[1])) {
            throw new Error(`${locale}: "${key}" shablonida server yubormaydigan parametr {${match[1]}} — matn bazadagi matnga qaytib ketadi`);
          }
        }
      }
    }
    // `status` parametri mavjud ariza holati yorliqlari bilan chiziladi — beshala enum qiymati bo'lishi shart
    for (const value of ["sent", "viewed", "invited", "accepted", "rejected"]) {
      if (typeof messages.applicationsPage?.status?.[value] !== "string") {
        throw new Error(`${locale}: applicationsPage.status.${value} yo'q (statusChanged shabloni uchun kerak)`);
      }
    }
  }
  const extra = base.filter((key) => !(key in CONTRACT_KEYS));
  if (extra.length) console.log("  ESLATMA shartnomada yo'q qo'shimcha shablon kalitlari: " + extra.join(", "));
});

// ------------------------------------------------------------
// Audit R3, i18n-4/i18n-6/i18n-7: format.ts — til bo'yicha raqam, maosh va hudud nomi.
// Shartnoma: `locale` berilmasa ESKI xulq (ru-RU) saqlanadi — chaqiruvchilar bosqichma-bosqich o'tadi.
// ------------------------------------------------------------
const onlyDigits = (value) => [...value].filter((ch) => ch >= "0" && ch <= "9").join("");

check("[i18n-6] formatNumber: en verguli bilan, uz/ru probel bilan guruhlaydi; locale'siz eski xulq saqlanadi", () => {
  const en = mod.formatNumber(1207000, "en");
  const uz = mod.formatNumber(1207000, "uz");
  const ru = mod.formatNumber(1207000, "ru");
  const legacy = mod.formatNumber(1207000);
  if (!en.includes(",")) throw new Error("en guruhlash verguli yo'q: " + en);
  if (uz.includes(",")) throw new Error("uz guruhlashda vergul: " + uz);
  if (uz !== ru) throw new Error(`uz va ru bir xil bo'lishi kerak: ${uz} / ${ru}`);
  // Orqaga moslik: locale'siz chaqiruv avvalgidek ru-RU
  if (legacy !== ru) throw new Error("locale'siz xulq o'zgardi: " + legacy);
  // Noma'lum til xato bermaydi va eski xulqqa tushadi
  if (mod.formatNumber(1207000, "de") !== legacy) throw new Error("noma'lum til: " + mod.formatNumber(1207000, "de"));
  // Ajratgich qanday bo'lishidan qat'i nazar raqamlar o'zgarmaydi
  for (const value of [en, uz, ru, legacy]) {
    if (onlyDigits(value) !== "1207000") throw new Error("raqamlar buzildi: " + value);
  }
});

check("[i18n-7] formatSalary: yashirin maosh, bir tomonlama chegara va til bo'yicha guruhlash", () => {
  const fmt = mod.messagesUz.fmt;
  if (mod.formatSalary(null, null, fmt) !== fmt.salaryHidden) throw new Error("maoshsiz: " + mod.formatSalary(null, null, fmt));
  if (mod.formatSalary(5000000, 9000000, fmt, true) !== fmt.salaryHidden) throw new Error("yashirin maosh raqam bilan chizildi");
  const range = mod.formatSalary(5000000, 9000000, fmt, false, "en");
  if (!range.includes("5,000,000") || !range.includes("9,000,000")) throw new Error("en oralig'i: " + range);
  if (mod.formatSalary(5000000, null, fmt, false, "en") !== fmt.salaryFrom("5,000,000")) {
    throw new Error("faqat quyi chegara: " + mod.formatSalary(5000000, null, fmt, false, "en"));
  }
  if (mod.formatSalary(null, 9000000, fmt, false, "en") !== fmt.salaryTo("9,000,000")) {
    throw new Error("faqat yuqori chegara: " + mod.formatSalary(null, 9000000, fmt, false, "en"));
  }
  // Orqaga moslik: locale'siz eski (ru-RU) guruhlash
  if (mod.formatSalary(5000000, null, fmt) !== fmt.salaryFrom(mod.formatNumber(5000000))) {
    throw new Error("locale'siz maosh xulqi o'zgardi: " + mod.formatSalary(5000000, null, fmt));
  }
});

check("[i18n-4] regionDisplayName: slug bo'yicha tarjima, o'zbekcha nomdan teskari qidiruv (apostrof variantlari bir xil)", () => {
  const bySlug = mod.regionDisplayName("ru", null, "fargona");
  if (typeof bySlug !== "string" || !bySlug) throw new Error("slug bo'yicha nom: " + JSON.stringify(bySlug));
  // Lug'atdagi o'zbekcha nom ASCII apostrof bilan yozilgan; qolgan variantlar ham shu hududga tushishi kerak
  // (format.ts `isApostropheCode` — API'dagi search-text.ts bilan bir uslubda, audit R3, D-080)
  for (const code of [0x27, 0x60, 0x02bb, 0x02bc, 0x2018, 0x2019]) {
    const name = "Farg" + String.fromCharCode(code) + "ona";
    const got = mod.regionDisplayName("ru", name);
    if (got !== bySlug) throw new Error(`apostrof varianti (kod ${code}) boshqa natija berdi: ${JSON.stringify(got)}`);
  }
  // Noma'lum til — kelgan nom o'zgarmaydi (bo'sh yozuv emas)
  if (mod.regionDisplayName("de", "Farg'ona") !== "Farg'ona") throw new Error("noma'lum til: " + mod.regionDisplayName("de", "Farg'ona"));
  // Lug'atda yo'q hudud nomi o'zgarmaydi
  if (mod.regionDisplayName("ru", "Yo'q hudud") !== "Yo'q hudud") throw new Error("noma'lum hudud o'zgardi");
  // Nom ham, slug ham yo'q — null (UI bo'sh yozuv chizmaydi)
  if (mod.regionDisplayName("ru", null) !== null) throw new Error("nomsiz null emas");
  if (mod.regionDisplayName("ru", "   ") !== null) throw new Error("bo'sh nom null emas");
});

console.log(failed === 0 ? "\nHAMMASI O'TDI" : `\n${failed} TA XATO`);
process.exit(failed === 0 ? 0 : 1);
