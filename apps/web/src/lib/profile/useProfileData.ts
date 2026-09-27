import { useCallback, useEffect, useRef, useState } from "react";
import { fetchProfile, fetchRegionsStrict, fetchResume, saveResume as putResume, updateProfile } from "../api.js";
import type { Profile, ProfileUpdate, Region, ResumeData, ResumeInput } from "../types.js";

export type LoadStatus = "loading" | "ready" | "error";

const EMPTY_RESUME: ResumeData = {
  title: "",
  summary: null,
  desiredSalary: null,
  skills: [],
  experience: [],
  education: [],
};

/**
 * Serverga yuboriladigan shakl. `PUT /api/resume` butun hujjatni ALMASHTIRADI,
 * shuning uchun har saqlashda to'liq rezyume yuboriladi; server sxemasidan
 * o'tmaydigan qatorlar (to'ldirilmagan tajriba/ta'lim) chiqarib tashlanadi.
 */
function toInput(resume: ResumeData, fallbackTitle: string): ResumeInput {
  return {
    title: resume.title.trim() || fallbackTitle,
    summary: resume.summary?.trim() || null,
    desiredSalary: resume.desiredSalary ?? null,
    skills: resume.skills,
    experience: resume.experience.filter(
      (x) => x.position.trim() && x.companyName.trim() && /^\d{4}-\d{2}$/.test(x.startDate)
    ),
    education: resume.education.filter((x) => x.institution.trim() && x.startYear >= 1950),
  };
}

/**
 * Profil sahifasining asosiy ma'lumotlari: profil, rezyume, hududlar.
 *
 * Rezyumeni saqlash navbatga qo'yiladi: tajriba, ta'lim va ko'nikmalar alohida
 * bo'limlarda tahrirlanadi, lekin API bitta hujjat qabul qiladi. Ketma-ket
 * saqlashlar bir-birining o'zgarishini ustidan yozib yubormasligi uchun har
 * biri oldingisi tugagach, eng so'nggi holat ustiga qo'llanadi.
 */
export function useProfileCore(token: string | null, fallbackTitle: string) {
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [resume, setResume] = useState<ResumeData | null>(null);
  const [regions, setRegions] = useState<Region[]>([]);

  const resumeRef = useRef<ResumeData | null>(null);
  const profileRef = useRef<Profile | null>(null);
  profileRef.current = profile;
  const fallbackRef = useRef(fallbackTitle);
  fallbackRef.current = fallbackTitle;
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    if (!token) return;
    setStatus("loading");
    let p: Profile | null;
    let r: ResumeData | null;
    let reg: Region[];
    try {
      // Hududlar ham qat'iy: xatoda bo'sh ro'yxat bilan forma hududni "tanlanmagan" ko'rsatib, saqlash uni
      // o'chirib yuborardi — endi xato holati va qayta urinish chiqadi (audit PHASE 6, U30)
      [p, r, reg] = await Promise.all([fetchProfile(token), fetchResume(token), fetchRegionsStrict()]);
    } catch {
      // Rezyume yuklanmadi — "rezyume yo'q" deb bo'sh holat bilan davom etilmaydi: keyingi saqlash
      // (PUT butun hujjat) mavjud tajriba, ta'lim va ko'nikmalarni o'chirib yuborardi (audit ISSUE-017)
      if (aliveRef.current) setStatus("error");
      return;
    }
    if (!aliveRef.current) return;
    setRegions(reg);
    // Nomzod uchun server har doim profil qaytaradi (bo'sh bo'lsa ham) — null faqat xatoda.
    if (!p) {
      setStatus("error");
      return;
    }
    setProfile(p);
    resumeRef.current = r;
    setResume(r);
    setStatus("ready");
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveProfile = useCallback(
    async (update: ProfileUpdate) => {
      if (!token) throw new Error("unauthorized");
      const next = await updateProfile(token, update);
      if (aliveRef.current) setProfile(next);
      return next;
    },
    [token]
  );

  /** Telegram orqali tasdiqlangandan keyin telefon holatini jimgina yangilash. */
  const refreshProfile = useCallback(async () => {
    if (!token) return;
    const next = await fetchProfile(token);
    if (next && aliveRef.current) setProfile(next);
  }, [token]);

  const setResumeUrl = useCallback((resumeUrl: string | null) => {
    setProfile((prev) => (prev ? { ...prev, resumeUrl } : prev));
  }, []);

  const saveResume = useCallback(
    (patch: Partial<ResumeData>): Promise<ResumeData> => {
      const run = async () => {
        if (!token) throw new Error("unauthorized");
        const merged: ResumeData = { ...EMPTY_RESUME, ...(resumeRef.current ?? {}), ...patch };
        // Sarlavha bo'sh bo'lsa — nomzodning kasbiy sarlavhasi, u ham bo'lmasa umumiy nom.
        const fallback = profileRef.current?.headline?.trim() || fallbackRef.current;
        const saved = await putResume(token, toInput(merged, fallback));
        const value = saved ?? merged;
        resumeRef.current = value;
        if (aliveRef.current) setResume(value);
        return value;
      };
      const pending = queueRef.current.then(run, run);
      queueRef.current = pending.catch(() => undefined);
      return pending;
    },
    [token]
  );

  return {
    status,
    profile,
    resume,
    regions,
    reload: load,
    saveProfile,
    refreshProfile,
    setResumeUrl,
    saveResume,
  };
}

export type ProfileCore = ReturnType<typeof useProfileCore>;

/**
 * Ro'yxat yuklash holati (arizalar, saqlanganlar). Sahifa ochilganda bir marta
 * yuklanadi va bo'limlar orasida almashganda qayta so'ralmaydi.
 */
export function useRemoteList<T>(loader: (() => Promise<T[]>) | null) {
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [items, setItems] = useState<T[]>([]);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const reload = useCallback(async () => {
    if (!loader) return;
    setStatus("loading");
    try {
      const list = await loader();
      if (!aliveRef.current) return;
      setItems(list);
      setStatus("ready");
    } catch {
      if (aliveRef.current) setStatus("error");
    }
  }, [loader]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { status, items, setItems, reload };
}

export type RemoteList<T> = ReturnType<typeof useRemoteList<T>>;
