/*
 * Service worker do app: só permite abrir a interface sem internet (tela de ponto offline).
 * Nunca intercepta a API; HTML é sempre "rede primeiro" para não prender o usuário numa versão antiga.
 * Para desligar em produção: publicar um sw.js que apenas chame self.registration.unregister().
 */
const VERSAO = 'v1';
const CACHE_SHELL = `coopvitta-shell-${VERSAO}`;
const CACHE_ASSETS = `coopvitta-assets-${VERSAO}`;
const ESCOPO = new URL(self.registration.scope);
const INDEX_URL = new URL('index.html', ESCOPO).toString();

async function precacheShell() {
  const cache = await caches.open(CACHE_SHELL);
  const resp = await fetch(INDEX_URL, { cache: 'no-store' });
  if (!resp.ok) return;
  await cache.put(INDEX_URL, resp.clone());
  const html = await resp.text();
  const assets = [...html.matchAll(/(?:src|href)="([^"]+\/assets\/[^"]+)"/g)].map((m) => new URL(m[1], ESCOPO).toString());
  if (assets.length) {
    const cacheAssets = await caches.open(CACHE_ASSETS);
    await Promise.all(assets.map((u) => cacheAssets.add(u).catch(() => undefined)));
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(precacheShell().catch(() => undefined).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const nomes = await caches.keys();
      await Promise.all(
        nomes.filter((n) => n.startsWith('coopvitta-') && n !== CACHE_SHELL && n !== CACHE_ASSETS).map((n) => caches.delete(n))
      );
      await self.clients.claim();
    })()
  );
});

async function redePrimeiroHtml(request) {
  try {
    const resp = await fetch(request);
    if (resp.ok) {
      const cache = await caches.open(CACHE_SHELL);
      await cache.put(INDEX_URL, resp.clone());
    }
    return resp;
  } catch {
    const cache = await caches.open(CACHE_SHELL);
    const hit = await cache.match(INDEX_URL);
    if (hit) return hit;
    throw new Error('offline sem cache');
  }
}

async function cachePrimeiroAsset(request) {
  const cache = await caches.open(CACHE_ASSETS);
  const hit = await cache.match(request);
  if (hit) return hit;
  const resp = await fetch(request);
  if (resp.ok) await cache.put(request, resp.clone());
  return resp;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== ESCOPO.origin || !url.pathname.startsWith(ESCOPO.pathname)) return;
  if (url.pathname.includes('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(redePrimeiroHtml(request));
    return;
  }
  if (url.pathname.includes('/assets/')) {
    event.respondWith(cachePrimeiroAsset(request));
  }
});
