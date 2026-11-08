// The service worker, served from the site root so that it controls every page. Generated once at
// build time: VERSION changes with each deployment, which empties the caches of the previous one.
export const dynamic = "force-static";

const VERSION = Date.now().toString(36);

const SOURCE = `// French Track Prono service worker (${VERSION}).
const STATIC = "ftp-static-${VERSION}";
const PAGES = "ftp-pages-${VERSION}";
const OFFLINE = "/offline.html";
const PRECACHE = [OFFLINE, "/icons/icon-192.png", "/brand/frenchtrack-light.png", "/brand/frenchtrack-dark.png"];
// Public pages a visitor can reopen offline. A signed-in player's pages are never stored: they
// hold personal data, and a device can be shared.
const PUBLIC_PAGES = [/^\\/$/, /^\\/epreuves$/, /^\\/epreuves\\/[^/]+$/, /^\\/athletes\\/[^/]+$/];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== STATIC && k !== PAGES).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function cacheFirst(request) {
  const cached = await caches.match(request, { cacheName: STATIC });
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) (await caches.open(STATIC)).put(request, response.clone());
  return response;
}

// Network first, so a page is never stale online; the stored copy only serves offline. Only a
// visitor's copy is stored (header set by the proxy); a player's visit drops any stored copy.
async function publicPage(request, path) {
  const cache = await caches.open(PAGES);
  try {
    const response = await fetch(request);
    const viewer = response.headers.get("x-ftp-viewer");
    if (response.ok && viewer === "visitor") await cache.put(path, response.clone());
    else if (viewer === "player") await cache.delete(path);
    return response;
  } catch {
    return (await cache.match(path)) ?? (await caches.match(OFFLINE));
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  // Mutations, other sites (Supabase) and sign-in links always go to the network, untouched.
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/auth/")) return;
  if (url.pathname.startsWith("/_next/static/") || /^\\/(icons|brand)\\//.test(url.pathname)) {
    event.respondWith(cacheFirst(request));
  } else if (request.mode === "navigate") {
    if (PUBLIC_PAGES.some((page) => page.test(url.pathname))) {
      event.respondWith(publicPage(request, url.pathname));
    } else {
      event.respondWith(fetch(request).catch(() => caches.match(OFFLINE)));
    }
  }
});
`;

export function GET() {
  return new Response(SOURCE, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-cache",
      "Service-Worker-Allowed": "/",
    },
  });
}
