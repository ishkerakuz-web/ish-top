import React, { useEffect, useState } from "react";
import { useT } from "../../../lib/i18n/index.js";
import { useAuth } from "../../AuthContext.js";
import { fetchTeam, type TeamData } from "../../../lib/admin/team.js";
import { Skeleton } from "../../Skeleton.js";
import { AdminError } from "../AdminStates.js";
import { TeamInvite } from "./TeamInvite.js";
import { TeamList } from "./TeamList.js";

/** `/admin/team` — faqat SUPER_ADMIN: taklif, a'zolar, rol va faollik. */
export function TeamView() {
  const team = useT().contentAdmin.team;
  const { accessToken } = useAuth();
  const [data, setData] = useState<TeamData | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!accessToken) return;
    const ctrl = new AbortController();
    setState("loading");
    fetchTeam(accessToken, ctrl.signal)
      .then((res) => {
        setData(res);
        setState("ready");
      })
      .catch((err: unknown) => {
        if ((err as Error)?.name !== "AbortError") setState("error");
      });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload, Boolean(accessToken)]);

  return (
    <section aria-labelledby="team-title" className="space-y-5">
      <div>
        <h2 id="team-title" className="font-display text-xl font-bold text-ink">
          {team.title}
        </h2>
        <p className="mt-1 text-sm text-dusk">{team.subtitle}</p>
      </div>

      {accessToken && <TeamInvite token={accessToken} onCreated={() => setReload((n) => n + 1)} />}

      {state === "error" && !data ? (
        <AdminError testId="team-error" title={team.error.title} text={team.error.text} retry={team.error.retry} onRetry={() => setReload((n) => n + 1)} />
      ) : !data || !accessToken ? (
        <div aria-busy="true">
          <span role="status" className="sr-only">
            {team.loading}
          </span>
          <div aria-hidden className="space-y-3 rounded-2xl border border-line bg-surface p-5">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="mt-2 h-3 w-64 max-w-full" />
                </div>
                <Skeleton className="h-10 w-40 rounded-xl" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <TeamList token={accessToken} data={data} onChanged={() => setReload((n) => n + 1)} />
      )}
    </section>
  );
}
