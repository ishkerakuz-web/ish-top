import React, { useCallback, useRef } from "react";
import { useAuth } from "../../components/AuthContext.js";
import { FavoritesView } from "../../components/favorites/FavoritesView.js";
import type { SavedVacancy } from "../../lib/favorites/adapter.js";
import { fetchSavedVacancies } from "../../lib/favorites/api.js";
import { useProfileCompletion, type ProfileCompletionState } from "../../lib/profile/useProfileCompletion.js";
import { useRemoteList } from "../../lib/profile/useProfileData.js";
import { useRequireRole } from "../../lib/useRoleGuard.js";

const COMPLETION_PENDING: ProfileCompletionState = { status: "loading" };

/**
 * Saqlangan vakansiyalar (akkaunt bo'limi). Mehmon — login sahifasiga, ish beruvchi —
 * nomzodlar bazasiga (mavjud rol guard'i). Ma'lumot mavjud `GET /api/favorites` dan:
 * backend faqat token egasining saqlanganlarini qaytaradi.
 */
export default function Page() {
  const { status, user, accessToken } = useAuth();
  useRequireRole("job_seeker", "/employer/candidates");

  if (status !== "authed" || user?.role !== "job_seeker" || !accessToken) {
    return <FavoritesView list={null} completion={COMPLETION_PENDING} token={null} />;
  }
  return <SeekerFavorites token={accessToken} />;
}

function SeekerFavorites({ token }: { token: string }) {
  // Token har 12 daqiqada yangilanadi — ro'yxat shu sabab qayta so'ralmasin
  const tokenRef = useRef(token);
  tokenRef.current = token;
  // StrictMode'dagi ikkinchi effekt o'sha so'rovni kutadi; "Qayta urinish" — har doim yangi so'rov
  const inflight = useRef<Promise<SavedVacancy[]> | null>(null);
  const loader = useCallback(() => {
    inflight.current ??= fetchSavedVacancies(tokenRef.current).finally(() => {
      inflight.current = null;
    });
    return inflight.current;
  }, []);
  const list = useRemoteList(loader);
  // Maslahatlardagi "Profilingizni to'ldiring" — /profile sahifasidagi to'liqlik hisobi
  const completion = useProfileCompletion(token);
  return <FavoritesView list={list} completion={completion} token={token} />;
}
