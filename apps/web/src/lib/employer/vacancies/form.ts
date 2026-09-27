/**
 * Vakansiya formasi (`/employer/vacancies/new`, `/:id/edit`) — qiymatlar, backend bilan
 * bir xil validatsiya (`vacancies.routes.ts` → `createSchema`) va payload.
 *
 * Qoida: formada faqat backend saqlaydigan maydonlar. Majburiy — backend bilan bir xil:
 * nom, tavsif, bandlik turi, kategoriya, ish joylashuvi; hudud — masofaviy bo'lmasa
 * (`vacancies.rules.ts`). Qolganlari ixtiyoriy.
 */
import { toItems } from "../../vacancies/detail.js";
import type { EmployerVacancy, EmploymentType, ExperienceLevel, ScheduleType, VacancyCreateInput, WorkplaceType } from "../../types.js";

export const TITLE_MIN = 3;
export const DESCRIPTION_MIN = 10;
export const EMAIL_MAX = 120;
export const TELEGRAM_MAX = 64;
export const PHONE_MAX = 32;
/** Prisma `Int` chegarasi. */
export const SALARY_MAX = 2_147_483_647;

export const EMPLOYMENT_TYPES: readonly EmploymentType[] = ["full_time", "part_time", "remote", "shift"];
export const SCHEDULE_TYPES: readonly ScheduleType[] = ["five_two", "two_two", "vahta", "gibkiy", "smenniy"];
export const EXPERIENCE_LEVELS: readonly ExperienceLevel[] = ["none", "one_to_three", "three_to_six", "six_plus"];
export const WORKPLACE_TYPES: readonly WorkplaceType[] = ["office", "hybrid", "remote"];

/**
 * Bandlik turi tanlovi. Masofaviylik endi "Ish joylashuvi"da — "Masofaviy" bandlik turi
 * faqat eski e'londa shu qiymat saqlangan bo'lsa ko'rsatiladi (jimgina o'zgarib ketmasin).
 */
export function employmentChoices(current: EmploymentType | ""): EmploymentType[] {
  return EMPLOYMENT_TYPES.filter((type) => type !== "remote" || current === "remote");
}

/** Hudud masofaviy ishdan boshqa hollarda MAJBURIY; masofaviyda ixtiyoriy (yashirilmaydi). */
export const isRegionRequired = (workplace: WorkplaceType | "") => workplace !== "remote";

export interface VacancyFormValues {
  title: string;
  categoryId: string;
  /** Masofaviy ishda yashiriladi va yuborilmaydi (qiymat holatda saqlanadi — qaytib tanlansa tiklanadi). */
  regionId: string;
  workplaceType: WorkplaceType | "";
  employmentType: EmploymentType | "";
  scheduleType: ScheduleType | "";
  experienceRequired: ExperienceLevel;
  /** Faqat raqamlar (so'm); bo'sh — maosh ko'rsatilmagan. */
  salaryMin: string;
  salaryMax: string;
  isSalaryHidden: boolean;
  description: string;
  requirements: string;
  conditions: string;
  applyWithoutResume: boolean;
  contactEmail: string;
  contactTelegram: string;
  contactPhone: string;
}

export type VacancyFieldKey = keyof VacancyFormValues;

export type VacancyErrorCode =
  | "titleRequired"
  | "titleShort"
  | "descriptionRequired"
  | "descriptionShort"
  | "employmentRequired"
  | "categoryRequired"
  | "regionRequired"
  | "workplaceRequired"
  | "salaryInvalid"
  | "salaryRange"
  | "emailInvalid"
  | "telegramLong"
  | "phoneLong";

export type VacancyFormErrors = Partial<Record<VacancyFieldKey, VacancyErrorCode>>;

/** Bosqichlar indikatori bo'limlari (4-bosqich — "Ko'rib chiqish", alohida holat). */
export const FORM_SECTIONS = ["basic", "details", "extra"] as const;
export type FormSectionKey = (typeof FORM_SECTIONS)[number];

export const SECTION_FIELDS: Record<FormSectionKey, readonly VacancyFieldKey[]> = {
  basic: ["title", "categoryId", "employmentType", "workplaceType", "regionId", "scheduleType", "experienceRequired", "salaryMin", "salaryMax", "isSalaryHidden"],
  details: ["description", "requirements", "conditions"],
  extra: ["applyWithoutResume", "contactEmail", "contactTelegram", "contactPhone"],
};

/** DOM tartibi — xato bo'lsa birinchi xatoli maydonga fokus. */
export const FIELD_ORDER: readonly VacancyFieldKey[] = FORM_SECTIONS.flatMap((s) => SECTION_FIELDS[s]);

export const fieldId = (key: VacancyFieldKey) => `vf-${key}`;
export const sectionId = (key: FormSectionKey) => `vf-section-${key}`;

export function emptyVacancyForm(): VacancyFormValues {
  return {
    title: "",
    categoryId: "",
    regionId: "",
    workplaceType: "",
    employmentType: "",
    scheduleType: "",
    experienceRequired: "none",
    salaryMin: "",
    salaryMax: "",
    isSalaryHidden: false,
    description: "",
    requirements: "",
    conditions: "",
    // Avvalgi forma ham standart holatda rezyumesiz arizaga ruxsat berardi
    applyWithoutResume: true,
    contactEmail: "",
    contactTelegram: "",
    contactPhone: "",
  };
}

const text = (value: unknown) => (typeof value === "string" ? value : "");
const amount = (value: unknown) => (typeof value === "number" && Number.isFinite(value) && value > 0 ? String(Math.trunc(value)) : "");
const oneOf = <T extends string>(value: unknown, allowed: readonly T[]): T | "" =>
  typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : "";

/** Tahrirlanadigan yozuv → forma (yo'q maydon bo'sh qoladi, hech narsa to'qilmaydi). */
export function formFromVacancy(v: EmployerVacancy): VacancyFormValues {
  return {
    title: text(v.title),
    categoryId: text(v.categoryId),
    regionId: text(v.regionId),
    // Eski e'londa maydon yo'q: bandlik turi "remote" — masofaviy; aks holda ish beruvchi tanlaydi
    workplaceType: oneOf(v.workplaceType, WORKPLACE_TYPES) || (v.employmentType === "remote" ? "remote" : ""),
    employmentType: oneOf(v.employmentType, EMPLOYMENT_TYPES),
    scheduleType: oneOf(v.scheduleType, SCHEDULE_TYPES),
    experienceRequired: oneOf(v.experienceRequired, EXPERIENCE_LEVELS) || "none",
    salaryMin: amount(v.salaryMin),
    salaryMax: amount(v.salaryMax),
    isSalaryHidden: v.isSalaryHidden === true,
    description: text(v.description),
    requirements: text(v.requirements),
    conditions: text(v.conditions),
    applyWithoutResume: v.applyWithoutResume === true,
    contactEmail: text(v.contactEmail),
    contactTelegram: text(v.contactTelegram),
    contactPhone: text(v.contactPhone),
  };
}

/** `""` → `null`; butun musbat son (0 — maosh yo'q); noto'g'ri yoki juda katta → `undefined`. */
export function parseSalary(raw: string): number | null | undefined {
  const s = raw.trim();
  if (!s) return null;
  if (!/^\d+$/.test(s)) return undefined;
  const n = Number(s);
  if (n > SALARY_MAX) return undefined;
  return n > 0 ? n : null;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateVacancyForm(v: VacancyFormValues): VacancyFormErrors {
  const errors: VacancyFormErrors = {};
  const title = v.title.trim();
  if (!title) errors.title = "titleRequired";
  else if (title.length < TITLE_MIN) errors.title = "titleShort";

  if (!v.categoryId) errors.categoryId = "categoryRequired";
  if (!v.employmentType) errors.employmentType = "employmentRequired";
  if (!v.workplaceType) errors.workplaceType = "workplaceRequired";
  if (isRegionRequired(v.workplaceType) && !v.regionId) errors.regionId = "regionRequired";

  const min = parseSalary(v.salaryMin);
  const max = parseSalary(v.salaryMax);
  if (min === undefined) errors.salaryMin = "salaryInvalid";
  if (max === undefined) errors.salaryMax = "salaryInvalid";
  else if (typeof min === "number" && typeof max === "number" && min > max) errors.salaryMax = "salaryRange";

  const description = v.description.trim();
  if (!description) errors.description = "descriptionRequired";
  else if (description.length < DESCRIPTION_MIN) errors.description = "descriptionShort";

  const email = v.contactEmail.trim();
  if (email && (email.length > EMAIL_MAX || !EMAIL.test(email))) errors.contactEmail = "emailInvalid";
  if (v.contactTelegram.trim().length > TELEGRAM_MAX) errors.contactTelegram = "telegramLong";
  if (v.contactPhone.trim().length > PHONE_MAX) errors.contactPhone = "phoneLong";
  return errors;
}

export function firstErrorField(errors: VacancyFormErrors): VacancyFieldKey | null {
  return FIELD_ORDER.find((key) => errors[key]) ?? null;
}

export function sectionHasErrors(section: FormSectionKey, errors: VacancyFormErrors): boolean {
  return SECTION_FIELDS[section].some((key) => errors[key]);
}

/**
 * Forma → `POST`/`PUT` tanasi. Yaratishda bo'sh ixtiyoriy maydon yuborilmaydi;
 * tahrirlashda bo'sh qiymat "olib tashlash" ma'nosida (`""` yoki `null`).
 */
export function toVacancyPayload(v: VacancyFormValues, mode: "new" | "edit"): VacancyCreateInput {
  const edit = mode === "edit";
  const cleared = <T,>(value: T | null) => (value === null ? (edit ? null : undefined) : value);
  const optionalText = (value: string) => (value.trim() ? value.trim() : edit ? "" : undefined);
  return {
    title: v.title.trim(),
    description: v.description.trim(),
    requirements: optionalText(v.requirements),
    conditions: optionalText(v.conditions),
    categoryId: v.categoryId,
    workplaceType: v.workplaceType as WorkplaceType,
    // Hudud masofaviy ishda ham saqlanadi (audit R3, employer-flows-17): tanlangan bo'lsa yuboriladi,
    // bo'sh bo'lsa tahrirlashda `null` (olib tashlanadi), yaratishda umuman yuborilmaydi.
    regionId: v.regionId ? v.regionId : edit ? null : undefined,
    employmentType: v.employmentType as EmploymentType,
    scheduleType: cleared(v.scheduleType || null),
    experienceRequired: v.experienceRequired,
    salaryMin: cleared(parseSalary(v.salaryMin) ?? null),
    salaryMax: cleared(parseSalary(v.salaryMax) ?? null),
    isSalaryHidden: v.isSalaryHidden,
    applyWithoutResume: v.applyWithoutResume,
    contactEmail: v.contactEmail.trim(),
    contactTelegram: v.contactTelegram.trim(),
    contactPhone: v.contactPhone.trim(),
  };
}

export function isFormDirty(initial: VacancyFormValues, current: VacancyFormValues): boolean {
  return (Object.keys(initial) as VacancyFieldKey[]).some((key) => initial[key] !== current[key]);
}

/** Talablar / sharoitlar: vakansiya sahifasida har qator — alohida band. */
export function listItemCount(value: string): number {
  return toItems(value).length;
}

/** Preview uchun qisqa matn: ro'yxat belgilari va qatorlarsiz. */
export function excerpt(value: string, max = 160): string {
  const flat = toItems(value).join(" ").replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
}

export type TextFormat = "bullet" | "numbered" | "heading";

const ANY_MARK = /^\s*(?:[-•*–·▪●✓✔]|\d{1,2}[.)])\s+/;
const BULLET_MARK = /^\s*[-•*–·▪●✓✔]\s+/;
const NUMBER_MARK = /^\s*\d{1,2}[.)]\s+/;

/**
 * Tavsif asboblar paneli — vakansiya sahifasi tushunadigan belgilar
 * (`parseRichText`): "- " ro'yxat, "1. " raqamli ro'yxat, ":" bilan tugagan qator — sarlavha.
 * Tanlangan qatorlarga qo'llanadi; hammasida bor bo'lsa — olib tashlanadi.
 */
export function applyTextFormat(value: string, start: number, end: number, kind: TextFormat): { value: string; start: number; end: number } {
  const lineStart = value.lastIndexOf("\n", start - 1) + 1;
  const selectionEnd = end > start && value[end - 1] === "\n" ? end - 1 : end;
  const found = value.indexOf("\n", selectionEnd);
  const lineEnd = found === -1 ? value.length : found;
  const lines = value.slice(lineStart, lineEnd).split("\n");
  const filled = lines.filter((line) => line.trim());

  let next: string[];
  if (filled.length === 0) {
    next = [kind === "bullet" ? "- " : kind === "numbered" ? "1. " : ""];
  } else if (kind === "heading") {
    const all = filled.every((line) => line.trimEnd().endsWith(":"));
    next = lines.map((line) => {
      if (!line.trim()) return line;
      const bare = line.replace(ANY_MARK, "").trimEnd();
      return all ? bare.replace(/:$/, "") : bare.endsWith(":") ? bare : `${bare}:`;
    });
  } else {
    const mark = kind === "bullet" ? BULLET_MARK : NUMBER_MARK;
    const all = filled.every((line) => mark.test(line));
    let n = 0;
    next = lines.map((line) => {
      if (!line.trim()) return line;
      const bare = line.replace(ANY_MARK, "");
      if (all) return bare;
      n += 1;
      return kind === "bullet" ? `- ${bare}` : `${n}. ${bare}`;
    });
  }

  const replaced = next.join("\n");
  const result = value.slice(0, lineStart) + replaced + value.slice(lineEnd);
  const caret = lineStart + replaced.length;
  return start === end ? { value: result, start: caret, end: caret } : { value: result, start: lineStart, end: caret };
}
