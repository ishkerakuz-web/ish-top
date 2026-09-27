import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { deleteNotification, markAllNotificationsRead, markNotificationRead } from "../apiExtra.js";
import { useT } from "../i18n/index.js";
import { isNotificationRow, mapNotificationRows, notificationRowId, type NotificationRow, type NotificationView } from "./adapter.js";
import { NOTIFICATIONS_LIMIT, fetchNotificationCenter, type NotificationCenterData } from "./api.js";
import { NOTIFICATION_RECEIVED, emitNotificationsChanged } from "./events.js";

export type CenterStatus = "loading" | "ready" | "error";
/** "Yana yuklash" holati: hech narsa, yuklanmoqda, xato (qayta urinish tugmasi). */
export type MoreStatus = "idle" | "loading" | "error";

interface CenterState {
  status: CenterStatus;
  /** Xom qatorlar — matn har chizishda joriy tilda tuziladi (audit R3, D-059). */
  rows: NotificationRow[];
  unreadCount: number;
  /** audit R3, D-078: keyingi sahifa kursori (`null` — davomi yo'q). */
  nextCursor: string | null;
  cursorSupported: boolean;
  more: MoreStatus;
}

const EMPTY: CenterState = { status: "loading", rows: [], unreadCount: 0, nextCursor: null, cursorSupported: false, more: "idle" };

/** Qatorni o'qilgan/o'qilmagan qilib nusxalaydi (xom qator o'zgartirilmaydi). */
function withRead(row: NotificationRow, isRead: boolean): NotificationRow {
  return { ...row, isRead };
}

/**
 * `/notifications` markazi holati. Amallar mavjud endpointlar bilan, optimistik:
 * UI darhol o'zgaradi, server rad etsa aynan o'sha o'zgarish qaytariladi (boshqa
 * o'zgarishlar ustidan yozilmaydi) va `false` qaytadi — sahifa xabar ko'rsatadi.
 * Muvaffaqiyatdan keyin header qo'ng'irog'i yangilanadi. StrictMode'da takroriy so'rov yo'q.
 *
 * audit R3, D-078: ro'yxat kursor bilan sahifalanadi — "Yana yuklash" eski
 * bildirishnomalarni qo'shadi; yuklanmoqda/xato/oxiri holatlari ko'rinib turadi va
 * API xatosi hech qachon bo'sh ro'yxatga aylanmaydi.
 */
export function useNotificationCenter(token: string) {
  const t = useT();
  const [state, setState] = useState<CenterState>(EMPTY);
  const stateRef = useRef(state);
  const tokenRef = useRef(token);
  tokenRef.current = token;
  const inflight = useRef<Promise<NotificationCenterData> | null>(null);

  const commit = useCallback((next: CenterState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const reload = useCallback(async () => {
    commit({ ...stateRef.current, status: "loading", more: "idle" });
    inflight.current ??= fetchNotificationCenter(tokenRef.current).finally(() => {
      inflight.current = null;
    });
    try {
      const data = await inflight.current;
      commit({
        status: "ready",
        rows: data.rows,
        unreadCount: data.unreadCount,
        nextCursor: data.nextCursor,
        cursorSupported: data.cursorSupported,
        more: "idle",
      });
    } catch {
      commit({ ...stateRef.current, status: "error" });
    }
  }, [commit]);

  useEffect(() => {
    void reload();
  }, [reload]);

  /** Keyingi sahifa (eskiroq bildirishnomalar). Xato bo'lsa ro'yxat saqlanadi, tugma xato holatiga o'tadi. */
  const loadMore = useCallback(async () => {
    const current = stateRef.current;
    if (current.status !== "ready" || !current.nextCursor || current.more === "loading") return;
    const cursor = current.nextCursor;
    commit({ ...current, more: "loading" });
    try {
      const data = await fetchNotificationCenter(tokenRef.current, { before: cursor });
      const now = stateRef.current;
      const seen = new Set(now.rows.map((row) => notificationRowId(row)));
      const fresh = data.rows.filter((row) => !seen.has(notificationRowId(row)));
      commit({
        ...now,
        rows: [...now.rows, ...fresh],
        unreadCount: data.unreadCount,
        // Server bir xil kursorni qaytarsa cheksiz aylanmasin
        nextCursor: data.nextCursor && data.nextCursor !== cursor ? data.nextCursor : null,
        cursorSupported: data.cursorSupported,
        more: "idle",
      });
    } catch {
      commit({ ...stateRef.current, more: "error" });
    }
  }, [commit]);

  // Header qo'ng'irog'i WebSocket orqali olgan yangi bildirishnoma — ro'yxat boshiga
  useEffect(() => {
    const onReceived = (event: Event) => {
      const raw = (event as CustomEvent).detail;
      if (!isNotificationRow(raw)) return;
      const id = notificationRowId(raw);
      const current = stateRef.current;
      if (!id || current.status !== "ready" || current.rows.some((row) => notificationRowId(row) === id)) return;
      commit({ ...current, rows: [raw, ...current.rows], unreadCount: current.unreadCount + (raw.isRead === false ? 1 : 0) });
    };
    window.addEventListener(NOTIFICATION_RECEIVED, onReceived);
    return () => window.removeEventListener(NOTIFICATION_RECEIVED, onReceived);
  }, [commit]);

  const markRead = useCallback(
    async (id: string): Promise<boolean> => {
      const current = stateRef.current;
      const target = current.rows.find((row) => notificationRowId(row) === id);
      if (!target || target.isRead !== false) return true;
      commit({
        ...current,
        rows: current.rows.map((row) => (notificationRowId(row) === id ? withRead(row, true) : row)),
        unreadCount: Math.max(0, current.unreadCount - 1),
      });
      try {
        await markNotificationRead(tokenRef.current, id);
        emitNotificationsChanged();
        return true;
      } catch {
        const now = stateRef.current;
        const still = now.rows.some((row) => notificationRowId(row) === id);
        commit({
          ...now,
          rows: now.rows.map((row) => (notificationRowId(row) === id ? withRead(row, false) : row)),
          unreadCount: still ? now.unreadCount + 1 : now.unreadCount,
        });
        return false;
      }
    },
    [commit]
  );

  const markAllRead = useCallback(async (): Promise<boolean> => {
    const current = stateRef.current;
    const unreadIds = new Set(current.rows.filter((row) => row.isRead === false).map((row) => notificationRowId(row)));
    const previousCount = current.unreadCount;
    if (previousCount === 0 && unreadIds.size === 0) return true;
    commit({ ...current, rows: current.rows.map((row) => (row.isRead === false ? withRead(row, true) : row)), unreadCount: 0 });
    try {
      await markAllNotificationsRead(tokenRef.current);
      emitNotificationsChanged();
      return true;
    } catch {
      const now = stateRef.current;
      commit({
        ...now,
        rows: now.rows.map((row) => (unreadIds.has(notificationRowId(row)) ? withRead(row, false) : row)),
        unreadCount: previousCount,
      });
      return false;
    }
  }, [commit]);

  const remove = useCallback(
    async (id: string): Promise<boolean> => {
      const current = stateRef.current;
      const index = current.rows.findIndex((row) => notificationRowId(row) === id);
      if (index < 0) return true;
      const removed = current.rows[index];
      commit({
        ...current,
        rows: current.rows.filter((row) => notificationRowId(row) !== id),
        unreadCount: removed.isRead === false ? Math.max(0, current.unreadCount - 1) : current.unreadCount,
      });
      try {
        await deleteNotification(tokenRef.current, id);
        emitNotificationsChanged();
        return true;
      } catch {
        const now = stateRef.current;
        if (!now.rows.some((row) => notificationRowId(row) === id)) {
          const rows = [...now.rows];
          rows.splice(Math.min(index, rows.length), 0, removed);
          commit({ ...now, rows, unreadCount: removed.isRead === false ? now.unreadCount + 1 : now.unreadCount });
        }
        return false;
      }
    },
    [commit]
  );

  // Til almashtirilganda ham matn joriy tilda qayta chiziladi (audit R3, D-059)
  const items: NotificationView[] = useMemo(() => mapNotificationRows(state.rows, t), [state.rows, t]);
  const hasMore = state.nextCursor !== null;

  return {
    status: state.status,
    items,
    unreadCount: state.unreadCount,
    /** Serverda yana bildirishnoma bor (kursor). */
    hasMore,
    moreStatus: state.more,
    /**
     * Ro'yxat serverdagi hammasini qamramadi: kursor bor (yana yuklash mumkin) yoki
     * server kursorni umuman qo'llab-quvvatlamay chegaraga yetdi.
     */
    truncated: hasMore || (!state.cursorSupported && state.rows.length >= NOTIFICATIONS_LIMIT),
    /** Kursor bilan oxirigacha yuklandi — "ro'yxat oxiri" xabari shundagina ko'rsatiladi. */
    reachedEnd: state.cursorSupported && !hasMore && state.rows.length >= NOTIFICATIONS_LIMIT,
    reload,
    loadMore,
    markRead,
    markAllRead,
    remove,
  };
}

export type NotificationCenter = ReturnType<typeof useNotificationCenter>;
