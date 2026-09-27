import React, { useCallback, useRef } from "react";
import { useAuth } from "../../components/AuthContext.js";
import { ApplicationsView } from "../../components/applications/ApplicationsView.js";
import { fetchMyApplications } from "../../lib/api.js";
import { useProfileCompletion, type ProfileCompletionState } from "../../lib/profile/useProfileCompletion.js";
import { useRemoteList } from "../../lib/profile/useProfileData.js";
import type { MyApplication } from "../../lib/types.js";
import { useRequireRole } from "../../lib/useRoleGuard.js";

const COMPLETION_PENDING: ProfileCompletionState = { status: "loading" };

/**
 * Nomzodning arizalari (akkaunt bo'limi). Mehmon — login sahifasiga, ish
 * beruvchi — o'z "Murojaatlar" paneliga (mavjud rol guard'i). Ma'lumot
 * mavjud `GET /api/applications` dan: backend faqat token egasining arizalarini qaytaradi.
 */
export default function Page() {
  const { status, user, accessToken } = useAuth();
  useRequireRole("job_seeker", "/employer/applications");

  if (status !== "authed" || user?.role !== "job_seeker" || !accessToken) {
    return <ApplicationsView list={null} completion={COMPLETION_PENDING} />;
  }
  return <SeekerApplications token={accessToken} />;
}

function SeekerApplications({ token }: { token: string }) {
  // Token har 12 daqiqada yangilanadi — ro'yxat shu sabab qayta so'ralmasin
  const tokenRef = useRef(token);
  tokenRef.current = token;
  // Bir vaqtda ikkinchi chaqiruv (StrictMode effekti) — o'sha so'rovni kutadi, takroriy so'rov yo'q.
  // "Qayta urinish" oldingisi tugagach chaqiriladi — har doim yangi so'rov.
  const inflight = useRef<Promise<MyApplication[]> | null>(null);
  const loader = useCallback(() => {
    inflight.current ??= fetchMyApplications(tokenRef.current).finally(() => {
      inflight.current = null;
    });
    return inflight.current;
  }, []);
  const list = useRemoteList(loader);
  // "Faol bo'ling!" — /profile sahifasidagi to'liqlik hisobi (computeCompletion)
  const completion = useProfileCompletion(token);
  return <ApplicationsView list={list} completion={completion} />;
}
