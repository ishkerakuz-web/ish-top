import React, { useEffect } from "react";
import { useAuth } from "../../components/AuthContext.js";
import { NotificationsView } from "../../components/notifications/NotificationsView.js";
import { useHref } from "../../lib/i18n/index.js";
import { useNotificationCenter } from "../../lib/notifications/useNotificationCenter.js";

/**
 * Bildirishnomalar markazi (akkaunt bo'limi). Mehmon — login sahifasiga (sahifaning
 * mavjud qoidasi). Ma'lumot mavjud `/api/notifications` endpointlaridan: backend faqat
 * token egasining bildirishnomalarini qaytaradi, begona o'qish/o'chirish — 403.
 */
export default function Page() {
  const { status, user, accessToken } = useAuth();
  const l = useHref();

  useEffect(() => {
    if (status === "guest") window.location.assign(l("/login"));
  }, [status, l]);

  if (status !== "authed" || !user || !accessToken) return <NotificationsView center={null} role={null} token={null} />;
  return <AuthedNotifications token={accessToken} role={user.role} />;
}

function AuthedNotifications({ token, role }: { token: string; role: string }) {
  const center = useNotificationCenter(token);
  return <NotificationsView center={center} role={role} token={token} />;
}
