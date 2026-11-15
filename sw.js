/* Nexus AI Books — service worker: chỉ cache vỏ app cùng origin.
   Mọi API Google / Firebase / AI luôn đi qua mạng, không bao giờ cache.
   ai13: điều hướng trang + index.html dùng Network-First (có mạng lấy bản mới,
   mất mạng mới dùng cache) để không còn kẹt bản cũ; version.json không bao giờ cache. */
var CACHE = "nexus-shell-v2";
var SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192-pwa.png",
  "./icon-512-pwa.png",
  "./icon-192-maskable.png",
  "./icon-512-maskable.png",
  "./apple-touch-icon-180.png",
  "./favicon-32.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) { return k === CACHE ? null : caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  var url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== self.location.origin) return; // API ngoài: luôn qua mạng
  if (url.pathname.endsWith("/version.json") || url.pathname === "version.json") return; // kiểm tra phiên bản: không chặn, không cache
  var isNav = e.request.mode === "navigate" || url.pathname.endsWith("/index.html") || url.pathname.endsWith("/");
  if (isNav) {
    // Network-First cho điều hướng/index: có mạng là bản mới nhất, mất mạng mới lấy cache
    e.respondWith(
      fetch(e.request).then(function (res) {
        if (res && res.status === 200) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put("./index.html", copy); });
        }
        return res;
      }).catch(function () {
        return caches.match("./index.html", { ignoreSearch: true }).then(function (cached) {
          return cached || caches.match(e.request, { ignoreSearch: true });
        });
      })
    );
    return;
  }
  // Stale-while-revalidate cho tài sản tĩnh còn lại của vỏ app (icon, manifest...)
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(function (cached) {
      var network = fetch(e.request).then(function (res) {
        if (res && res.status === 200) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
        }
        return res;
      }).catch(function () { return cached; });
      return cached || network;
    })
  );
});
