import type { Profile, ResumeData } from "../types.js";
import type { ProfileTab } from "./tabs.js";

export type CompletionKey =
  | "name"
  | "phone"
  | "region"
  | "headline"
  | "skills"
  | "experience"
  | "education"
  | "resume";

export interface CompletionItem {
  key: CompletionKey;
  done: boolean;
  /** "Qo'shish" bosilganda ochiladigan bo'lim. */
  tab: ProfileTab;
}

/** Ko'nikmalar bandi shu sondan boshlab bajarilgan hisoblanadi. */
export const SKILLS_TARGET = 3;

/**
 * Profil to'liqligi — faqat real ma'lumotdan hisoblanadi, har band teng vaznli.
 * Tartib muhim: ro'yxat foydalanuvchiga shu ketma-ketlikda ko'rsatiladi
 * (avval tez to'ldiriladiganlar, keyin ko'proq vaqt oladiganlar).
 */
export function computeCompletion(profile: Profile | null, resume: ResumeData | null) {
  const items: CompletionItem[] = [
    { key: "name", tab: "personal", done: Boolean(profile?.firstName?.trim() && profile?.lastName?.trim()) },
    { key: "phone", tab: "telegram", done: Boolean(profile?.isPhoneVerified) },
    { key: "region", tab: "personal", done: Boolean(profile?.regionId) },
    { key: "headline", tab: "personal", done: Boolean(profile?.headline?.trim()) },
    { key: "resume", tab: "resume", done: Boolean(resume?.title?.trim() && resume?.summary?.trim()) },
    { key: "skills", tab: "skills", done: (resume?.skills.length ?? 0) >= SKILLS_TARGET },
    { key: "experience", tab: "experience", done: (resume?.experience.length ?? 0) > 0 },
    { key: "education", tab: "education", done: (resume?.education.length ?? 0) > 0 },
  ];
  const done = items.filter((item) => item.done).length;
  return {
    items,
    done,
    total: items.length,
    percent: Math.round((done / items.length) * 100),
  };
}

/** Rezyume ish beruvchiga ko'rsatishga yaroqli: sarlavha, tavsif, ko'nikma va tajriba yoki ta'lim. */
export function isResumeReady(resume: ResumeData | null): boolean {
  if (!resume) return false;
  return Boolean(
    resume.title?.trim() &&
      resume.summary?.trim() &&
      resume.skills.length > 0 &&
      (resume.experience.length > 0 || resume.education.length > 0)
  );
}
