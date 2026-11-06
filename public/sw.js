/* PokéClasseur service worker: makes the app installable and usable offline.
   - pages: network first, cached copy when offline
   - app files (/assets/*, hashed by Vite): cache first
   - card images, logos, sprites, fonts: cache first, kept up to a size limit
   - TCGdex API: network first, cached copy when offline
   - Supabase (accounts, sync): never cached */
const V = "v1";
const SHELL = `pc-shell-${V}`, IMG = `pc-img-${V}`, API = `pc-api-${V}`, FONT = `pc-font-${V}`;
const KEEP = [SHELL, IMG, API, FONT];
const LIMITS = { [SHELL]: 80, [IMG]: 4000, [API]: 400, [FONT]: 30 };
const SCOPE = new URL(self.registration.scope);
const INDEX = new URL("./", SCOPE).href;

self.addEventListener("install", e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll([INDEX, new URL("manifest.webmanifest", SCOPE).href, new URL("icon-192.png", SCOPE).href]).catch(() => {})));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith("pc-") && !KEEP.includes(k)) await caches.delete(k);
    await self.clients.claim();
  })());
});

async function trim(name) {
  const c = await caches.open(name), keys = await c.keys(), max = LIMITS[name];
  for (let i = 0; i < keys.length - max; i++) await c.delete(keys[i]);   // oldest first
}
const puts = {};   // trimming lists the whole cache, so only do it every 40 writes
const put = (name, req, res) => caches.open(name).then(c => c.put(req, res))
  .then(() => { puts[name] = (puts[name] || 0) + 1; if (puts[name] % 40 === 1) return trim(name); }).catch(() => {});

async function networkFirst(req, name, key = req) {
  try {
    const res = await fetch(req);
    if (res.ok) put(name, key, res.clone());
    return res;
  } catch (err) {
    const hit = await caches.match(key, { ignoreVary: true });
    if (hit) return hit;
    throw err;
  }
}

async function cacheFirst(req, name, cors) {
  const hit = await caches.match(req.url, { ignoreVary: true });
  if (hit) return hit;
  // images are requested by <img> without CORS; ask with CORS so the cached copy is readable
  // (opaque responses would count as several MB each in the storage quota)
  let res;
  try { res = await fetch(cors ? new Request(req.url, { mode: "cors", credentials: "omit" }) : req); }
  catch { res = await fetch(req); return res; }
  if (res.ok && res.type !== "opaque") put(name, req.url, res.clone());
  return res;
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.hostname.endsWith(".supabase.co") || url.hostname.endsWith(".supabase.in")) return;

  if (req.mode === "navigate" && url.origin === SCOPE.origin) {
    e.respondWith(networkFirst(req, SHELL, INDEX).catch(() => caches.match(INDEX)));
    return;
  }
  if (url.origin === SCOPE.origin) {
    if (url.pathname.includes("/assets/")) e.respondWith(cacheFirst(req, SHELL));
    else if (url.pathname.startsWith(SCOPE.pathname) && !url.pathname.endsWith("sw.js")) e.respondWith(networkFirst(req, SHELL));
    return;
  }
  if (url.hostname === "api.tcgdex.net") { e.respondWith(networkFirst(req, API)); return; }
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") { e.respondWith(cacheFirst(req, FONT, true)); return; }
  if (req.destination === "image" || /\.(webp|png|jpe?g|gif|svg)$/i.test(url.pathname)) { e.respondWith(cacheFirst(req, IMG, true)); }
});
