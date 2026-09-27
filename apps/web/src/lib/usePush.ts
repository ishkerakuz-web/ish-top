import { useCallback, useEffect, useState } from "react";
import { fetchPushPublicKey, subscribePush, unsubscribePush } from "./apiExtra.js";

/**
 * Brauzer push xabarnomalari (Web Push).
 *
 * Holatlar:
 *   unsupported   — brauzerda Service Worker / Push API yo'q
 *   unconfigured  — serverda VAPID kalitlari yo'q (funksiya o'chiq)
 *   blocked       — foydalanuvchi ruxsat bermagan
 *   off / on      — obuna yo'q / bor
 */
export type PushState = "loading" | "unsupported" | "unconfigured" | "blocked" | "off" | "on";

const SW_PATH = "/sw.js";

/**
 * VAPID ochiq kaliti base64url ko'rinishida keladi, Push API esa bayt buferini
 * kutadi. `ArrayBuffer` qaytaramiz — `Uint8Array` ning tipi TS 5.7+ da
 * `ArrayBufferLike` bo'lib, `BufferSource` ga to'g'ridan-to'g'ri tushmaydi.
 */
function urlBase64ToBuffer(base64: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(normalized);
  const buffer = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i += 1) view[i] = raw.charCodeAt(i);
  return buffer;
}

function isSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function usePush(token: string | null) {
  const [state, setState] = useState<PushState>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isSupported()) {
      setState("unsupported");
      return;
    }
    let cancelled = false;
    (async () => {
      const key = await fetchPushPublicKey();
      if (cancelled) return;
      if (!key) {
        setState("unconfigured");
        return;
      }
      if (Notification.permission === "denied") {
        setState("blocked");
        return;
      }
      try {
        const reg = await navigator.serviceWorker.getRegistration(SW_PATH);
        const sub = await reg?.pushManager.getSubscription();
        if (!cancelled) setState(sub ? "on" : "off");
      } catch {
        if (!cancelled) setState("off");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const enable = useCallback(async () => {
    if (!token || !isSupported()) return;
    setBusy(true);
    try {
      const key = await fetchPushPublicKey();
      if (!key) {
        setState("unconfigured");
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "blocked" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.register(SW_PATH);
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToBuffer(key),
      });
      const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh: string; auth: string } };
      if (!json.endpoint || !json.keys) {
        setState("off");
        return;
      }
      await subscribePush(token, { endpoint: json.endpoint, keys: json.keys });
      setState("on");
    } catch {
      setState("off");
    } finally {
      setBusy(false);
    }
  }, [token]);

  const disable = useCallback(async () => {
    if (!token || !isSupported()) return;
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration(SW_PATH);
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await unsubscribePush(token, sub.endpoint).catch(() => undefined);
        await sub.unsubscribe().catch(() => undefined);
      }
      setState("off");
    } finally {
      setBusy(false);
    }
  }, [token]);

  return { state, busy, enable, disable };
}
