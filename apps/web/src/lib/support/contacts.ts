/**
 * `GET /api/support/contacts` → UI view-model. Faqat haqiqiy (sozlangan) kanallar:
 * bo'sh, noto'g'ri yoki noma'lum qiymat tashlab yuboriladi va sahifa o'sha qatorni,
 * ro'yxat bo'sh bo'lsa — kartani ham chizmaydi. Kontakt hech qachon to'qib qo'yilmaydi.
 */
import type { ContactSubjectKey } from "../i18n/types.js";

export const CONTACT_SUBJECTS: readonly ContactSubjectKey[] = ["general", "technical", "partnership", "vacancy", "suggestion", "other"];
export const MESSAGE_MIN = 3;
export const MESSAGE_MAX = 4000;
export const NAME_MAX = 120;

export type ContactChannelKind = "email" | "telegram" | "phone" | "address";
const CHANNEL_ORDER: readonly ContactChannelKind[] = ["email", "telegram", "phone", "address"];

export interface ContactChannelVM {
  kind: ContactChannelKind;
  value: string;
  href: string | null;
  external: boolean;
  /** Telegram support akkaunti emas, sayt boti (xabarni jamoaga uzatadi). */
  bot: boolean;
}

export interface SupportContactsVM {
  formEnabled: boolean;
  subjects: ContactSubjectKey[];
  channels: ContactChannelVM[];
  hours: string | null;
  responseHours: number | null;
  partnership: { email: string | null; viaForm: boolean } | null;
}

export const EMAIL_RE = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;

const str = (value: unknown): string | null => (typeof value === "string" && value.trim() ? value.trim() : null);
const record = (value: unknown): Record<string, unknown> => (value && typeof value === "object" ? (value as Record<string, unknown>) : {});

export function mapContactChannelToViewModel(kind: ContactChannelKind, raw: unknown): ContactChannelVM | null {
  switch (kind) {
    case "email": {
      const email = str(raw);
      return email && EMAIL_RE.test(email) ? { kind, value: email, href: `mailto:${email}`, external: false, bot: false } : null;
    }
    case "telegram": {
      const r = record(raw);
      const username = str(r.username)?.replace(/^@/, "");
      if (!username || !/^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(username)) return null;
      return { kind, value: `@${username}`, href: `https://t.me/${username}`, external: true, bot: r.kind === "bot" };
    }
    case "phone": {
      const phone = str(raw);
      const dial = phone?.replace(/[^\d+]/g, "") ?? "";
      return phone && dial.replace(/\D/g, "").length >= 7 ? { kind, value: phone, href: `tel:${dial}`, external: false, bot: false } : null;
    }
    case "address": {
      const address = str(raw);
      return address ? { kind, value: address, href: null, external: false, bot: false } : null;
    }
  }
}

export function mapSupportContacts(raw: unknown): SupportContactsVM {
  const r = record(raw);
  const form = record(r.form);
  const channelsRaw = record(r.channels);
  const formEnabled = form.enabled === true;
  const subjects = Array.isArray(form.subjects) ? CONTACT_SUBJECTS.filter((s) => (form.subjects as unknown[]).includes(s)) : [];
  const responseHours =
    typeof r.responseHours === "number" && Number.isInteger(r.responseHours) && r.responseHours > 0 && r.responseHours <= 168 ? r.responseHours : null;
  const partnershipRaw = r.partnership && typeof r.partnership === "object" ? record(r.partnership) : null;
  const partnershipEmail = str(partnershipRaw?.email);
  const email = partnershipEmail && EMAIL_RE.test(partnershipEmail) ? partnershipEmail : null;
  // "Hamkorlik" mavzusi orqali yozish faqat forma ishlasa ma'noli
  const viaForm = partnershipRaw?.viaForm === true && formEnabled;
  return {
    formEnabled,
    subjects: subjects.length ? subjects : [...CONTACT_SUBJECTS],
    channels: CHANNEL_ORDER.map((kind) => mapContactChannelToViewModel(kind, channelsRaw[kind])).filter((c): c is ContactChannelVM => c !== null),
    hours: str(r.hours),
    responseHours,
    partnership: email || viaForm ? { email, viaForm } : null,
  };
}
