/* ISH BOR! — push xabarnomalari uchun service worker.
   Faqat push va bosish hodisalarini boshqaradi; sahifalarni kesh qilmaydi
   (SSR sayti uchun kesh keraksiz murakkablik qo'shardi). */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "ISH BOR!", body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "ISH BOR!";
  const options = {
    body: payload.body || "",
    icon: "/logo-180.png",
    badge: "/logo-48.png",
    tag: payload.tag || "ish-bor",
    data: { url: payload.url || "/" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

/**
 * Faqat sayt ichidagi yo'l ("//host" va "/\host" boshqa saytga olib ketadi).
 * Boshqaruv belgisi (TAB, qator ko'chirish) ham rad etiladi: `new URL()` ularni tashlab
 * yuboradi va "/<TAB>/evil.example" boshqa saytga aylanardi (audit PHASE 6, U13 bilan bir xil qoida).
 */
function safePath(value) {
  if (typeof value !== "string" || !value.startsWith("/")) return "/";
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 32 || code === 127 || code === 92) return "/";
  }
  if (value.startsWith("//")) return "/";
  return value;
}

function sameOriginWindows(clients) {
  return clients.filter((client) => {
    try {
      return new URL(client.url).origin === self.location.origin;
    } catch {
      return false;
    }
  });
}

/**
 * Xabarnoma bosilganda: ochiq oyna bo'lsa o'sha oynada ochamiz, bo'lmasa yangisini.
 *
 * audit R3, realtime-20: `client.navigate()` bu SW boshqarmaydigan oynada (masalan, qattiq
 * yangilangan tab) rad etadi va ilgari butun zanjir shu yerda to'xtab qolardi — bosish
 * hech narsa qilmasdi. Endi har qadam alohida `try` ichida va tartib manzilga yetkazishga
 * qaratilgan: aynan shu sahifa ochiq bo'lsa fokus → boshqarilgan oynada navigate →
 * yangi oyna → (hammasi rad etsa) mavjud oynani fokuslab manzilni xabar bilan berish.
 */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = safePath(event.notification.data && event.notification.data.url);
  const absolute = new URL(target, self.location.origin).href;

  event.waitUntil(
    (async () => {
      let windows = [];
      try {
        windows = sameOriginWindows(await self.clients.matchAll({ type: "window", includeUncontrolled: true }));
      } catch {
        windows = [];
      }

      // 1) Aynan shu sahifa ochiq — faqat fokus (qayta yuklash kerak emas)
      const exact = windows.find((client) => client.url === absolute);
      if (exact && typeof exact.focus === "function") {
        try {
          await exact.focus();
          return;
        } catch {
          /* fokus bermadi — quyidagi yo'llar */
        }
      }

      // 2) Boshqa sahifa ochiq — navigate faqat SW boshqaradigan oynada ishlaydi.
      //    Bitta oyna rad etsa zanjir to'xtamaydi: qolgan oynalar ham sinab ko'riladi.
      for (const client of windows) {
        try {
          if (typeof client.navigate !== "function") continue;
          const navigated = await client.navigate(absolute);
          const focusable = navigated || client;
          if (focusable && typeof focusable.focus === "function") await focusable.focus();
          return;
        } catch {
          /* bu oyna boshqarilmaydi — keyingisi */
        }
      }

      // 3) Hech bir oynani boshqarib bo'lmadi — kerakli manzilni yangi oynada ochamiz
      //    (mavjud oynani fokuslash foydalanuvchini boshqa sahifada qoldirardi)
      try {
        await self.clients.openWindow(absolute);
        return;
      } catch {
        /* brauzer ruxsat bermadi — oxirgi chora quyida */
      }

      // 4) Oxirgi chora: ochiq oynani oldinga chiqaramiz va manzilni xabar bilan beramiz
      for (const client of windows) {
        try {
          await client.focus();
          client.postMessage({ type: "notification-click", url: target });
          return;
        } catch {
          /* bu oyna ishlamadi — keyingisi */
        }
      }
    })()
  );
});
