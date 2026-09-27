import { useEffect, useRef, useState } from "react";
import { fetchProfile, fetchResume } from "../api.js";
import { computeCompletion, isResumeReady } from "./completion.js";

export type ProfileCompletionState =
  | { status: "loading" }
  /** Profil yoki rezyume yuklanmadi — foiz noma'lum (0% deb taxmin qilinmaydi). */
  | { status: "error" }
  | { status: "ready"; percent: number; done: number; total: number; resumeReady: boolean };

async function load(token: string): Promise<ProfileCompletionState> {
  try {
    const [profile, resume] = await Promise.all([fetchProfile(token), fetchResume(token)]);
    if (!profile) return { status: "error" };
    const { percent, done, total } = computeCompletion(profile, resume);
    return { status: "ready", percent, done, total, resumeReady: isResumeReady(resume) };
  } catch {
    // Rezyume so'rovi xato berdi (fetchResume endi uloqtiradi) — "rezyume yo'q" deb hisoblanmaydi
    return { status: "error" };
  }
}

/**
 * Profil to'liqligi akkaunt sahifalari uchun ("Faol bo'ling!", maslahatlar).
 * Hisob — `/profile` sahifasidagi `computeCompletion` ning o'zi (parallel formula yo'q),
 * ma'lumot — o'sha `GET /api/profile` va `GET /api/resume`.
 *
 * Sahifa ochilganda bir marta so'raladi; StrictMode'dagi ikkinchi effekt o'sha so'rovni kutadi.
 */
export function useProfileCompletion(token: string): ProfileCompletionState {
  const [state, setState] = useState<ProfileCompletionState>({ status: "loading" });
  const tokenRef = useRef(token);
  tokenRef.current = token;
  const inflight = useRef<Promise<ProfileCompletionState> | null>(null);

  useEffect(() => {
    let alive = true;
    inflight.current ??= load(tokenRef.current);
    void inflight.current.then((next) => {
      if (alive) setState(next);
    });
    return () => {
      alive = false;
    };
  }, []);

  return state;
}
