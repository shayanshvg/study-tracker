
const CACHE_NAME = "study-tracker-shell-v3";

const APP_SHELL = [
    "./",
    "./index.html",
    "./style.css",
    "./app.js",
    "./cloud.js",
    "./manifest.json",
    "./icons/icon-192.png",
    "./icons/icon-512.png"
];

self.addEventListener("install", event => {
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE_NAME);
        await cache.addAll(APP_SHELL);
        await self.skipWaiting();
    })());
});

self.addEventListener("activate", event => {
    event.waitUntil((async () => {
        const cacheNames = await caches.keys();

        await Promise.all(
            cacheNames
                .filter(name => name.startsWith("study-tracker-shell-") && name !== CACHE_NAME)
                .map(name => caches.delete(name))
        );

        await self.clients.claim();
    })());
});

self.addEventListener("fetch", event => {
    const request = event.request;
    const url = new URL(request.url);

    if (
        request.method !== "GET" ||
        url.origin !== self.location.origin
    ) {
        return;
    }

    const isAppFile =
        url.pathname.endsWith("/cloud.js") ||
        url.pathname.endsWith("/app.js") ||
        url.pathname.endsWith("/index.html") ||
        request.mode === "navigate";

    if (isAppFile) {
        event.respondWith((async () => {
            try {
                const response = await fetch(request, {
                    cache: "no-store"
                });

                if (response.ok) {
                    const cache = await caches.open(CACHE_NAME);
                    const cacheKey = request.mode === "navigate"
                        ? "./index.html"
                        : request;

                    await cache.put(cacheKey, response.clone());
                }

                return response;
            } catch (error) {
                const cached = await caches.match(request);

                if (cached) return cached;

                if (request.mode === "navigate") {
                    const fallback = await caches.match("./index.html");
                    if (fallback) return fallback;
                }

                throw error;
            }
        })());

        return;
    }

    event.respondWith((async () => {
        const cached = await caches.match(request);

        if (cached) return cached;

        const response = await fetch(request);

        if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(request, response.clone());
        }

        return response;
    })());
});
