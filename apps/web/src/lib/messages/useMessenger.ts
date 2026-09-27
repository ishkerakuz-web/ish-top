import { useCallback, useEffect, useRef, useState } from "react";
import { fetchConversationRating, fetchUserSummary, submitConversationRating } from "../api.js";
import type { ConversationRating, UserSummary } from "../types.js";
import { useChatSocket, type SocketMessage } from "../useChatSocket.js";
import { mapMessageToViewModel, type ConversationView, type MessageStatus, type MessageView } from "./adapter.js";
import { fetchConversationList, fetchConversationMessages } from "./api.js";
import { emitInboxChanged } from "./events.js";
import { isPageActive, isPageVisible, onPageActive, staggerDelay } from "./live.js";

/** Server tasdig'i shu vaqtda kelmasa — xabar "Yuborilmadi" deb belgilanadi. */
export const SEND_TIMEOUT_MS = 10_000;

/** Havola bilan ochilgan suhbatni qidirishda avtomatik yuklanadigan sahifalar chegarasi (D-078). */
const AUTO_PAGE_LIMIT = 10;

/** Ro'yxat/tarix davomini yuklash holati (audit R3, D-078). */
export type MoreStatus = "idle" | "loading" | "error";

export type ListState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; items: ConversationView[]; nextCursor: string | null; more: MoreStatus };

export interface ThreadState {
  status: "loading" | "error" | "ready";
  items: MessageView[];
  /** Suhbat ochilganda o'qilmagan bo'lgan birinchi xabar — "Yangi xabarlar" ajratgichi. */
  newFromId: string | null;
  /** Serverda eskiroq xabarlar bormi (audit R3, D-078). */
  hasMore: boolean;
  /** "Eskiroq xabarlar" tugmasi holati. */
  older: MoreStatus;
}

export type PartnerState = UserSummary | "loading" | "error";

function makeClientId(): string {
  const c = typeof crypto !== "undefined" ? crypto : undefined;
  return c?.randomUUID ? c.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Suhbatni yangilab ro'yxat boshiga ko'taradi. */
function bump(items: ConversationView[], id: string, patch: (c: ConversationView) => ConversationView): ConversationView[] {
  const index = items.findIndex((c) => c.id === id);
  if (index < 0) return items;
  const next = items.slice();
  const [item] = next.splice(index, 1);
  return [patch(item), ...next];
}

function timeOf(message: MessageView): number {
  return message.createdAt ? new Date(message.createdAt).getTime() : 0;
}

/**
 * Serverdan kelgan xabarlarni mavjudlari bilan birlashtiradi (id bo'yicha, xronologik tartibda).
 * Eskiroq sahifa yuklangandan keyin jimgina yangilash eski xabarlarni o'chirib yubormaydi.
 */
function mergeMessages(existing: MessageView[], incoming: MessageView[]): MessageView[] {
  const byId = new Map<string, MessageView>();
  for (const message of existing) if (message.status === "sent") byId.set(message.id, message);
  for (const message of incoming) byId.set(message.id, message);
  return [...byId.values()].sort((a, b) => timeOf(a) - timeOf(b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * Yuborilmagan (mahalliy) pufak aslida serverga yetib borganmi (audit R3, realtime-12).
 * `clientId` server javobida bo'lsa aynan shu bo'yicha; bo'lmasa — o'sha matnli, o'zim yuborgan
 * va shu vaqt oralig'idagi xabar. Shu tekshiruv bo'lmasa "Yuborilmadi" pufagi saqlangan nusxa
 * yonida turaverar va "Qayta yuborish" ikkinchi nusxani yaratardi.
 */
function alreadyDelivered(local: MessageView, server: MessageView[], userId: string): boolean {
  const body = local.body.trim();
  const at = local.createdAt ? new Date(local.createdAt).getTime() : null;
  return server.some((message) => {
    if (local.clientId && message.clientId && message.clientId === local.clientId) return true;
    if (message.senderId !== userId || message.body.trim() !== body) return false;
    if (at === null || !message.createdAt) return false;
    const delta = new Date(message.createdAt).getTime() - at;
    return delta >= -60_000 && delta <= 600_000;
  });
}

/**
 * `/messages` ma'lumot qatlami: suhbatlar ro'yxati, ochilgan suhbat tarixi va mavjud
 * WebSocket (`/ws/chat`) orqali real-time xabar/o'qildi hodisalari.
 *
 * - Suhbat ochilganda tarix REST orqali olinadi (server o'qilgan deb belgilaydi) va
 *   header'dagi "Xabarlar" soni yangilanadi.
 * - Yuborish: pufak darhol "yuborilmoqda" holatida chiziladi, server `clientId` bilan
 *   qaytargach "yuborildi"ga o'tadi; ulanish yo'q yoki tasdiq kelmasa — "Yuborilmadi"
 *   va "Qayta yuborish".
 * - `activeId` — ekranda ochiq turgan suhbat (mobil ro'yxat ko'rinishida `null`).
 *
 * Audit R3:
 * - D-078: suhbatlar ro'yxati va tarix kursor bilan sahifalanadi ("Yana suhbatlar",
 *   "Eskiroq xabarlar"), har bir holat (yuklanmoqda, xato, oxiri) ko'rinib turadi;
 * - realtime-6: "o'qildi" faqat sahifa ko'rinib turganda va fokusda yuboriladi; yashirin
 *   tabda qayta ulanish tarixni qayta so'ramaydi (REST so'rovi o'qilgan deb belgilaydi);
 * - realtime-12: qayta yuklashda serverga yetib borgan mahalliy pufak takrorlanmaydi;
 * - realtime-16: tasdiq kelmasa ulanish yarim ochiq deb hisoblanadi va qayta ulanadi.
 */
export function useMessenger(token: string, userId: string, activeId: string | null) {
  const [list, setList] = useState<ListState>({ status: "loading" });
  const [threads, setThreads] = useState<Record<string, ThreadState>>({});
  const [ratings, setRatings] = useState<Record<string, ConversationRating | null>>({});
  const [partners, setPartners] = useState<Record<string, PartnerState>>({});

  const listRef = useRef(list);
  listRef.current = list;
  const threadsRef = useRef(threads);
  threadsRef.current = threads;
  const activeRef = useRef(activeId);
  activeRef.current = activeId;

  const listInflight = useRef<Promise<void> | null>(null);
  const threadInflight = useRef(new Map<string, Promise<void>>());
  const timers = useRef(new Map<string, number>());
  /** Yashirin tabda kelgan xabarlar: sahifa ko'ringanda "o'qildi" yuboriladi (audit R3, realtime-6). */
  const pendingRead = useRef(new Set<string>());
  /** Yashirin tabda qayta ulanish bo'ldi — tarix sahifa ko'ringanda yangilanadi. */
  const pendingThreadReload = useRef<string | null>(null);
  /** Havola bilan ochilgan suhbatni qidirishda yuklangan qo'shimcha sahifalar soni (cheklangan). */
  const autoPages = useRef(0);

  const reloadList = useCallback(
    (silent = false) => {
      if (listInflight.current) return listInflight.current;
      if (!silent) setList({ status: "loading" });
      const request = fetchConversationList(token)
        .then(
          (page) => {
            // Ochiq suhbat tarixi allaqachon olingan — server hisobidagi eski o'qilmaganlar ko'rinmasin
            const active = activeRef.current;
            const loaded = active ? threadsRef.current[active]?.status === "ready" : false;
            const items = loaded ? page.items.map((c) => (c.id === active ? { ...c, unread: 0 } : c)) : page.items;
            // audit R3, D-078: jimgina yangilash ("Yana suhbatlar" bilan) yuklangan keyingi
            // sahifalarni o'chirmasin — aks holda ochiq suhbat ro'yxatdan tushib, "topilmadi" ko'rinardi
            setList((prev) => {
              const ids = new Set(items.map((c) => c.id));
              const tail = prev.status === "ready" ? prev.items.filter((c) => !ids.has(c.id)) : [];
              return {
                status: "ready",
                items: [...items, ...tail],
                // Davomi saqlanib qolgan bo'lsa kursor ham oldingi (eng oxirgi yuklangan) joyda qoladi
                nextCursor: tail.length > 0 && prev.status === "ready" ? prev.nextCursor : page.nextCursor,
                more: "idle",
              };
            });
          },
          () => {
            if (!silent || listRef.current.status !== "ready") setList({ status: "error" });
          }
        )
        .finally(() => {
          listInflight.current = null;
        });
      listInflight.current = request;
      return request;
    },
    [token]
  );

  /** Suhbatlar ro'yxatining davomi (audit R3, D-078). Xatoda ro'yxat saqlanadi, tugma xato holatiga o'tadi. */
  const loadMoreConversations = useCallback(() => {
    const current = listRef.current;
    if (current.status !== "ready" || !current.nextCursor || current.more === "loading") return Promise.resolve();
    const cursor = current.nextCursor;
    setList({ ...current, more: "loading" });
    return fetchConversationList(token, { before: cursor }).then(
      (page) => {
        setList((prev) => {
          if (prev.status !== "ready") return prev;
          const seen = new Set(prev.items.map((c) => c.id));
          const fresh = page.items.filter((c) => !seen.has(c.id));
          return {
            status: "ready",
            items: [...prev.items, ...fresh],
            // Server o'sha kursorni qaytarsa cheksiz aylanmasin
            nextCursor: page.nextCursor && page.nextCursor !== cursor ? page.nextCursor : null,
            more: "idle",
          };
        });
      },
      () => {
        setList((prev) => (prev.status === "ready" ? { ...prev, more: "error" } : prev));
      }
    );
  }, [token]);

  const loadThread = useCallback(
    (id: string, silent = false) => {
      const pending = threadInflight.current.get(id);
      if (pending) return pending;
      const current = listRef.current;
      const unreadBefore = current.status === "ready" ? current.items.find((c) => c.id === id)?.unread ?? 0 : 0;
      if (!silent) {
        setThreads((prev) => ({
          ...prev,
          [id]: {
            status: "loading",
            items: prev[id]?.items ?? [],
            newFromId: prev[id]?.newFromId ?? null,
            hasMore: prev[id]?.hasMore ?? false,
            older: "idle",
          },
        }));
      }
      const request = fetchConversationMessages(token, id)
        .then(
          (page) => {
            const items = page.items;
            setThreads((prev) => {
              const before = prev[id];
              const existing = before?.items ?? [];
              // Serverga yetib borgan mahalliy pufaklar takrorlanmaydi (audit R3, realtime-12).
              // Solishtirish faqat YANGI kelgan server xabarlari bilan: ilgari ko'rilgan bir xil
              // matnli xabar (foydalanuvchi "ok" ni ikki marta yozgan) yuborilmagan pufakni
              // jimgina yo'q qilib yubormasin — "Yuborilmadi" belgisi joyida qoladi.
              const known = new Set(existing.filter((m) => m.status === "sent").map((m) => m.id));
              const arrived = items.filter((m) => !known.has(m.id));
              const local = existing.filter((m) => m.status !== "sent" && !alreadyDelivered(m, arrived, userId));
              const incoming = items.filter((m) => m.senderId !== userId);
              const newFromId =
                unreadBefore > 0 && incoming.length > 0
                  ? incoming[Math.max(0, incoming.length - unreadBefore)].id
                  : silent
                    ? before?.newFromId ?? null
                    : null;
              const merged = mergeMessages(before?.items ?? [], items);
              // audit R3, D-078: "Eskiroq xabarlar" bilan allaqachon yuklangan bo'lsak, eng yangi
              // sahifaning `hasMore` qiymati eskirgan — aks holda qayta ulangach ishlamaydigan
              // tugma qaytib chiqardi. Shu holda oldingi qiymat saqlanadi.
              const oldestAt = items.length > 0 ? timeOf(items[0]) : 0;
              const pagedOlder = oldestAt > 0 && existing.some((m) => m.status === "sent" && timeOf(m) > 0 && timeOf(m) < oldestAt);
              return {
                ...prev,
                [id]: {
                  status: "ready",
                  items: [...merged, ...local],
                  newFromId,
                  hasMore: pagedOlder && before ? before.hasMore : page.hasMore,
                  older: "idle",
                },
              };
            });
            if (unreadBefore > 0) {
              setList((prev) => (prev.status === "ready" ? { ...prev, items: prev.items.map((c) => (c.id === id ? { ...c, unread: 0 } : c)) } : prev));
              pendingRead.current.delete(id);
              emitInboxChanged();
            }
          },
          () => {
            setThreads((prev) =>
              silent && prev[id]?.status === "ready"
                ? prev
                : {
                    ...prev,
                    [id]: {
                      status: "error",
                      items: prev[id]?.items ?? [],
                      newFromId: null,
                      hasMore: prev[id]?.hasMore ?? false,
                      older: "idle",
                    },
                  }
            );
          }
        )
        .finally(() => {
          threadInflight.current.delete(id);
        });
      threadInflight.current.set(id, request);
      return request;
    },
    [token, userId]
  );

  /** Eskiroq xabarlar (audit R3, D-078): eng eski yuklangan xabardan oldingilari ro'yxat boshiga qo'shiladi. */
  const loadOlder = useCallback(
    (id: string) => {
      const thread = threadsRef.current[id];
      if (!thread || thread.status !== "ready" || !thread.hasMore || thread.older === "loading") return Promise.resolve();
      const oldest = thread.items.find((m) => m.status === "sent");
      if (!oldest) return Promise.resolve();
      setThreads((prev) => (prev[id] ? { ...prev, [id]: { ...prev[id], older: "loading" } } : prev));
      return fetchConversationMessages(token, id, { before: oldest.id }).then(
        (page) => {
          setThreads((prev) => {
            const now = prev[id];
            if (!now) return prev;
            const seen = new Set(now.items.map((m) => m.id));
            const older = page.items.filter((m) => !seen.has(m.id));
            return {
              ...prev,
              [id]: {
                ...now,
                items: [...older, ...now.items],
                // Hech narsa kelmasa "yana bor" deb turmaymiz (cheksiz tugma bo'lmasin)
                hasMore: older.length > 0 && page.hasMore,
                older: "idle",
              },
            };
          });
        },
        () => {
          setThreads((prev) => (prev[id] ? { ...prev, [id]: { ...prev[id], older: "error" } } : prev));
        }
      );
    },
    [token]
  );

  const setStatus = useCallback((conversationId: string, clientId: string, status: MessageStatus) => {
    setThreads((prev) => {
      const thread = prev[conversationId];
      if (!thread) return prev;
      const index = thread.items.findIndex((m) => m.clientId === clientId && m.status !== "sent");
      if (index < 0) return prev;
      const items = thread.items.slice();
      items[index] = { ...items[index], status, ...(status === "pending" ? { createdAt: new Date().toISOString() } : {}) };
      return { ...prev, [conversationId]: { ...thread, items } };
    });
  }, []);

  const clearTimer = (clientId: string) => {
    const timer = timers.current.get(clientId);
    if (timer !== undefined) window.clearTimeout(timer);
    timers.current.delete(clientId);
  };

  const socket = useChatSocket(token, {
    onMessage: (raw: SocketMessage) => {
      const message = mapMessageToViewModel(raw);
      if (!message) return;
      const mine = message.senderId === userId;
      const conversationId = message.conversationId;
      const isActive = conversationId === activeRef.current;
      // audit R3, realtime-6: yashirin yoki fokussiz tabda xabar o'qilgan hisoblanmaydi
      const readNow = isActive && isPageActive();
      if (raw.clientId) clearTimer(raw.clientId);

      setThreads((prev) => {
        const thread = prev[conversationId];
        if (!thread || thread.items.some((m) => m.id === message.id)) return prev;
        const index = raw.clientId ? thread.items.findIndex((m) => m.clientId === raw.clientId) : -1;
        const items = thread.items.slice();
        if (index >= 0) items[index] = { ...message, clientId: raw.clientId ?? null };
        else items.push(message);
        return { ...prev, [conversationId]: { ...thread, items } };
      });

      const current = listRef.current;
      if (current.status !== "ready" || !current.items.some((c) => c.id === conversationId)) {
        // Yangi suhbat (masalan, ish beruvchi birinchi marta yozdi) — ro'yxat qayta olinadi
        void reloadList(true);
        if (!mine) emitInboxChanged();
        if (!mine && isActive && !readNow) pendingRead.current.add(conversationId);
        return;
      }
      setList((prev) =>
        prev.status !== "ready"
          ? prev
          : {
              ...prev,
              items: bump(prev.items, conversationId, (c) => ({
                ...c,
                lastMessage: message.body.trim(),
                lastMessageAt: message.createdAt,
                lastMessageMine: mine,
                lastMessageRead: false,
                unread: mine || readNow ? c.unread : c.unread + 1,
              })),
            }
      );
      if (!mine && readNow) {
        socket.markRead(conversationId);
        // Server o'qildi yozuvini saqlab ulgursin — keyin header soni so'raladi
        window.setTimeout(emitInboxChanged, 500);
      } else if (!mine) {
        // Ochiq, lekin ko'rinmayotgan suhbat: o'qildi sahifa faollashganda yuboriladi
        if (isActive) pendingRead.current.add(conversationId);
        emitInboxChanged();
      }
    },
    onRead: (conversationId) => {
      // Qarshi tomon o'qidi — mening xabarlarim ikki belgiga o'tadi
      setThreads((prev) => {
        const thread = prev[conversationId];
        if (!thread) return prev;
        return {
          ...prev,
          [conversationId]: { ...thread, items: thread.items.map((m) => (m.senderId === userId && m.status === "sent" ? { ...m, isRead: true } : m)) },
        };
      });
      setList((prev) =>
        prev.status === "ready"
          ? { ...prev, items: prev.items.map((c) => (c.id === conversationId && c.lastMessageMine ? { ...c, lastMessageRead: true } : c)) }
          : prev
      );
    },
    onOpen: (reconnected) => {
      if (!reconnected) return;
      // Uzilish paytida o'tkazib yuborilgan xabarlar. audit R3, realtime-7: so'rovlar 0..3 s ga tarqatiladi
      const active = activeRef.current;
      window.setTimeout(() => {
        void reloadList(true);
      }, staggerDelay());
      if (!active) return;
      // audit R3, realtime-6: tarix so'rovi serverda "o'qildi" yozadi — yashirin tabda kutib turamiz
      if (!isPageVisible()) {
        pendingThreadReload.current = active;
        return;
      }
      window.setTimeout(() => {
        if (activeRef.current === active) void loadThread(active, true);
      }, staggerDelay());
    },
  });

  // Sahifa yana ko'rindi: kutib turgan "o'qildi" va tarix yangilanishi bajariladi (audit R3, realtime-6)
  const socketRef = useRef(socket);
  socketRef.current = socket;
  useEffect(() => {
    return onPageActive(() => {
      const waiting = [...pendingRead.current];
      pendingRead.current.clear();
      for (const conversationId of waiting) {
        if (conversationId !== activeRef.current) continue;
        socketRef.current.markRead(conversationId);
        setList((prev) => (prev.status === "ready" ? { ...prev, items: prev.items.map((c) => (c.id === conversationId ? { ...c, unread: 0 } : c)) } : prev));
      }
      if (waiting.length > 0) window.setTimeout(emitInboxChanged, 500);
      const deferred = pendingThreadReload.current;
      pendingThreadReload.current = null;
      if (deferred && deferred === activeRef.current) {
        const existing = threadsRef.current[deferred];
        void loadThread(deferred, existing?.status === "ready");
      }
    });
  }, [loadThread]);

  const dispatch = useCallback(
    (message: MessageView) => {
      const clientId = message.clientId as string;
      clearTimer(clientId);
      if (!socket.send(message.conversationId, message.body, clientId)) {
        setStatus(message.conversationId, clientId, "failed");
        return;
      }
      timers.current.set(
        clientId,
        window.setTimeout(() => {
          timers.current.delete(clientId);
          setStatus(message.conversationId, clientId, "failed");
          // Tasdiq kelmadi — ulanish yarim ochiq bo'lishi mumkin (audit R3, realtime-16)
          socketRef.current.reset();
        }, SEND_TIMEOUT_MS)
      );
    },
    [socket.send, setStatus] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const send = useCallback(
    (conversationId: string, body: string) => {
      const text = body.trim();
      if (!text) return;
      const clientId = makeClientId();
      const message: MessageView = {
        id: `local-${clientId}`,
        conversationId,
        senderId: userId,
        body: text,
        isRead: false,
        createdAt: new Date().toISOString(),
        status: "pending",
        clientId,
      };
      setThreads((prev) => {
        const thread = prev[conversationId] ?? { status: "ready" as const, items: [], newFromId: null, hasMore: false, older: "idle" as const };
        return { ...prev, [conversationId]: { ...thread, items: [...thread.items, message] } };
      });
      dispatch(message);
    },
    [userId, dispatch]
  );

  const retry = useCallback(
    (conversationId: string, clientId: string) => {
      const message = threadsRef.current[conversationId]?.items.find((m) => m.clientId === clientId && m.status === "failed");
      if (!message) return;
      setStatus(conversationId, clientId, "pending");
      dispatch(message);
    },
    [dispatch, setStatus]
  );

  const discard = useCallback((conversationId: string, clientId: string) => {
    clearTimer(clientId);
    setThreads((prev) => {
      const thread = prev[conversationId];
      if (!thread) return prev;
      return { ...prev, [conversationId]: { ...thread, items: thread.items.filter((m) => !(m.clientId === clientId && m.status !== "sent")) } };
    });
  }, []);

  const loadRating = useCallback(
    (conversationId: string) => {
      fetchConversationRating(token, conversationId)
        .then((rating) => setRatings((prev) => ({ ...prev, [conversationId]: rating })))
        .catch(() => setRatings((prev) => ({ ...prev, [conversationId]: null })));
    },
    [token]
  );

  /** Baho bir marta beriladi; xato bo'lsa uloqtiradi (dialog xabarni ko'rsatadi). */
  const rate = useCallback(
    async (conversationId: string, score: number, comment?: string) => {
      await submitConversationRating(token, conversationId, score, comment);
      setRatings((prev) => {
        const r = prev[conversationId];
        if (!r) return prev;
        const otherAvg = Math.round((((r.otherAvg ?? 0) * r.otherCount + score) / (r.otherCount + 1)) * 10) / 10;
        return { ...prev, [conversationId]: { ...r, myScore: score, myComment: comment ?? null, otherAvg, otherCount: r.otherCount + 1 } };
      });
    },
    [token]
  );

  /** Suhbatdoshning qisqa profili (ish beruvchi ko'rinishidagi nomzod paneli uchun). */
  const loadPartner = useCallback(
    (otherUserId: string, force = false) => {
      const state = partnersRef.current[otherUserId];
      if (!force && state && state !== "error") return;
      setPartners((prev) => ({ ...prev, [otherUserId]: "loading" }));
      // Xatoda panel "loading"da qotib qolmasin (audit ISSUE-068)
      fetchUserSummary(token, otherUserId)
        .then((summary) => setPartners((prev) => ({ ...prev, [otherUserId]: summary ?? "error" })))
        .catch(() => setPartners((prev) => ({ ...prev, [otherUserId]: "error" })));
    },
    [token]
  );
  const partnersRef = useRef(partners);
  partnersRef.current = partners;

  useEffect(() => {
    void reloadList();
  }, [reloadList]);

  // audit R3, D-078: havola bilan ochilgan suhbat birinchi sahifada bo'lmasligi mumkin —
  // topilmaguncha (yoki sahifalar tugaguncha) ro'yxat davomi yuklanadi, "topilmadi" deyilmaydi
  useEffect(() => {
    autoPages.current = 0;
  }, [activeId]);
  useEffect(() => {
    if (!activeId || list.status !== "ready") return;
    if (list.items.some((c) => c.id === activeId)) return;
    if (!list.nextCursor || list.more !== "idle" || autoPages.current >= AUTO_PAGE_LIMIT) return;
    autoPages.current += 1;
    void loadMoreConversations();
  }, [activeId, list, loadMoreConversations]);

  // Suhbat ochildi: tarix (keshlangan bo'lsa — jimgina yangilanadi) va baho holati
  // Faol suhbat ro'yxatda paydo bo'lgan zahoti (avto-sahifalash keyingi sahifadan topsa ham) effekt
  // qayta ishlaydi: ilgari faqat `listReady` ga qaralardi va u sahifa qo'shilganda o'zgarmagani uchun
  // havola bilan ochilgan suhbat tarixi yuklanmay qolardi (audit R3 ikkinchi audit, frontend-docs-3).
  const activeInList = list.status === "ready" && activeId !== null && list.items.some((c) => c.id === activeId);
  useEffect(() => {
    if (!activeId || !activeInList) return;
    const thread = threadsRef.current[activeId];
    if (!(activeId in ratingsRef.current)) loadRating(activeId);
    // audit R3, realtime-6: tarix so'rovi serverda "o'qildi" yozadi — fon tabida (masalan
    // havola yangi tabda ochilganda) so'ramaymiz, tab ko'ringanda yuklanadi
    if (!isPageVisible()) {
      pendingThreadReload.current = activeId;
      return;
    }
    void loadThread(activeId, thread?.status === "ready");
  }, [activeId, activeInList, loadThread, loadRating]);
  const ratingsRef = useRef(ratings);
  ratingsRef.current = ratings;

  useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach((timer) => window.clearTimeout(timer));
      map.clear();
    };
  }, []);

  // Havola bilan ochilgan suhbat hali topilmadi, lekin qidiruv davom etyapti — "topilmadi" deyilmaydi
  const activeMissing = activeId !== null && list.status === "ready" && !list.items.some((c) => c.id === activeId);
  const findingActive =
    activeMissing && (list.status === "ready" ? list.more === "loading" || (list.nextCursor !== null && autoPages.current < AUTO_PAGE_LIMIT) : false);

  return {
    list,
    threads,
    ratings,
    partners,
    /** Ro'yxat davomidan tanlangan suhbat qidirilmoqda (audit R3, D-078). */
    findingActive,
    connected: socket.connected,
    reloadList,
    loadMoreConversations,
    loadThread,
    loadOlder,
    send,
    retry,
    discard,
    rate,
    loadPartner,
  };
}

export type Messenger = ReturnType<typeof useMessenger>;
