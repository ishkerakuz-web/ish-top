import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../components/AuthContext.js";
import { isPhoneGateError } from "../../components/PhoneGateNotice.js";
import { ApiError, applyToVacancy, fetchMyApplications, fetchResume } from "../api.js";
import type { ApplicationStatus } from "../types.js";

export type ApplyPhase =
  | { kind: "loading" }
  | { kind: "guest" }
  /** Ish beruvchi yoki admin — ariza yubora olmaydi. */
  | { kind: "blocked" }
  /** `resume` — nomzodning asosiy rezyumesi; `resumeKnown=false` — holatini aniqlab bo'lmadi. */
  | { kind: "ready"; resume: { title: string } | null; resumeKnown: boolean }
  /** Haqiqiy ariza holati (backend'dan) — to'qima status yo'q. */
  | { kind: "applied"; status: ApplicationStatus; appliedAt: string | null };

export type ApplyError = { kind: "phone" } | { kind: "resume" } | { kind: "failed" } | null;

interface SeekerState {
  applied: { status: ApplicationStatus; appliedAt: string | null } | null;
  resume: { title: string } | null;
  resumeKnown: boolean;
}

/**
 * Vakansiyaga ariza oqimi — mavjud API'lar ustida:
 * - holat: `GET /api/applications` (nomzodning arizalari ichidan shu vakansiya);
 * - rezyume: `GET /api/resume` (backend ariza paytida birinchi rezyumeni biriktiradi);
 * - yuborish: `POST /api/vacancies/:id/apply` — takroriy so'rovda backend
 *   mavjud arizani qaytaradi, shuning uchun holat har doim haqiqiy.
 * Sahifada bir marta chaqiriladi; karta, yopishqoq panel va mobil panel
 * bir xil holatni ko'rsatadi.
 */
export function useApplication(vacancyId: string, loginHref: string) {
  const { status, user, accessToken } = useAuth();
  const isSeeker = status === "authed" && user?.role === "job_seeker" && Boolean(accessToken);
  const [seeker, setSeeker] = useState<SeekerState | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ApplyError>(null);

  useEffect(() => {
    if (!isSeeker || !accessToken) {
      setSeeker(null);
      return;
    }
    let cancelled = false;
    void Promise.allSettled([fetchMyApplications(accessToken), fetchResume(accessToken)]).then(([apps, resume]) => {
      if (cancelled) return;
      const mine = apps.status === "fulfilled" ? apps.value.find((a) => a.vacancy.id === vacancyId) : undefined;
      setSeeker((prev) => ({
        // Yuborilgandan keyin token yangilansa ham holat yo'qolmasin
        applied: mine ? { status: mine.status, appliedAt: mine.createdAt } : prev?.applied ?? null,
        resume: resume.status === "fulfilled" && resume.value?.title ? { title: resume.value.title } : null,
        // fetchResume xatoda uloqtiradi — rezyume holati faqat so'rov muvaffaqiyatli bo'lganda ma'lum
        resumeKnown: resume.status === "fulfilled",
      }));
    });
    return () => {
      cancelled = true;
    };
  }, [isSeeker, accessToken, vacancyId]);

  const apply = useCallback(async () => {
    if (!accessToken) {
      window.location.assign(loginHref);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const application = await applyToVacancy(vacancyId, accessToken);
      setSeeker((prev) => ({
        resume: prev?.resume ?? null,
        resumeKnown: prev?.resumeKnown ?? false,
        applied: { status: application?.status ?? "sent", appliedAt: application?.createdAt ?? null },
      }));
    } catch (err) {
      if (isPhoneGateError(err)) setError({ kind: "phone" });
      else if (err instanceof ApiError && err.status === 401) window.location.assign(loginHref);
      // Ariza tanasi qat'iy — 400 faqat "avval rezyumeni to'ldiring" holatida keladi
      else if (err instanceof ApiError && err.status === 400) setError({ kind: "resume" });
      else setError({ kind: "failed" });
    } finally {
      setSubmitting(false);
    }
  }, [accessToken, vacancyId, loginHref]);

  const phase: ApplyPhase =
    status === "loading"
      ? { kind: "loading" }
      : status === "guest"
        ? { kind: "guest" }
        : !isSeeker
          ? { kind: "blocked" }
          : !seeker
            ? { kind: "loading" }
            : seeker.applied
              ? { kind: "applied", ...seeker.applied }
              : { kind: "ready", resume: seeker.resume, resumeKnown: seeker.resumeKnown };

  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.email?.split("@")[0] || "";

  return { phase, apply, submitting, error, displayName };
}
