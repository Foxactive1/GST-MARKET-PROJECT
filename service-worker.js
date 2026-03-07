/**
 * Service Worker - Supermercado Pro (Gst Tech)
 * Desenvolvido por: Dione Castro Alves - InNovaIdeia
 * Refatorado: Performance + PWA
 *
 * Estratégias de Cache:
 * - Cache First:             Assets estáticos (CSS, JS, fontes, ícones)
 * - Cache First (CDN):       Recursos externos — cache isolado
 * - Network First:           API e dados dinâmicos
 * - Stale While Revalidate:  Páginas HTML
 */

const CACHE_VERSION = 'v1.0.1';

// Caches separados por tipo — facilita invalidação seletiva
const CACHE_STATIC  = `gst-static-${CACHE_VERSION}`;
const CACHE_CDN     = `gst-cdn-${CACHE_VERSION}`;
const CACHE_DYNAMIC = `gst-dynamic-${CACHE_VERSION}`;
const CACHE_IMAGES  = `gst-images-${CACHE_VERSION}`;

// Todos os caches válidos nesta versão
const VALID_CACHES = [CACHE_STATIC, CACHE_CDN, CACHE_DYNAMIC, CACHE_IMAGES];

/**
 * Base URL derivada da localização do próprio SW.
 * Garante funcionamento em root ("/") e subdiretórios ("/app/", etc.)
 * sem hardcoding de caminhos absolutos.
 *
 * Exemplo:
 *   SW em http://localhost:26543/service-worker.js
 *   → BASE = "http://localhost:26543/"
 *
 *   SW em https://example.com/app/service-worker.js
 *   → BASE = "https://example.com/app/"
 */
const BASE = self.location.href.replace(/\/[^/]*$/, '/');

// Assets locais — pré-cache no install (endereços resolvidos via BASE)
const STATIC_ASSETS = [
  BASE,
  `${BASE}index.html`,
  `${BASE}manifest.json`,
  `${BASE}css/style.css`,
  `${BASE}js/app.js`,
  `${BASE}js/utils.js`,
  `${BASE}js/state.js`,
  `${BASE}js/theme.js`,
  `${BASE}js/commands.js`,
  `${BASE}js/init.js`,
  `${BASE}js/components/modals.js`,
  `${BASE}js/modules/auth.js`,
  `${BASE}js/modules/dashboard.js`,
  `${BASE}js/modules/pdv.js`,
  `${BASE}js/modules/estoque.js`,
  `${BASE}js/modules/clientes.js`,
  `${BASE}js/modules/fornecedores.js`,
  `${BASE}js/modules/relatorios.js`,
  `${BASE}js/modules/fidelidade.js`,
  `${BASE}icons/icon-192.png`,
  `${BASE}icons/icon-512.png`,
];

// CDN — cache isolado para não contaminar CACHE_STATIC
const CDN_ASSETS = [
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
];

// Limites de tamanho dos caches dinâmicos
const MAX_CACHE_SIZE = { dynamic: 50, images: 30 };

// ============================================
// Install — pré-cache com resiliência
// CORREÇÃO: Promise.all → Promise.allSettled
// Uma falha de asset não aborta mais o install inteiro
// ============================================
self.addEventListener('install', event => {
  console.log('[SW] Instalando...');

  event.waitUntil(
    Promise.all([
      // Cache de assets locais
      caches.open(CACHE_STATIC).then(cache =>
        Promise.allSettled(
          STATIC_ASSETS.map(url =>
            cache.add(url).catch(err =>
              console.warn(`[SW] Falha ao cachear ${url}:`, err)
            )
          )
        )
      ),
      // Cache de recursos CDN — separado
      caches.open(CACHE_CDN).then(cache =>
        Promise.allSettled(
          CDN_ASSETS.map(url =>
            cache.add(url).catch(err =>
              console.warn(`[SW] Falha ao cachear CDN ${url}:`, err)
            )
          )
        )
      ),
    ]).then(() => {
      console.log('[SW] Instalação completa');
      return self.skipWaiting();
    })
  );
});

// ============================================
// Activate — limpa caches obsoletos
// ============================================
self.addEventListener('activate', event => {
  console.log('[SW] Ativando...');

  event.waitUntil(
    Promise.all([
      // Remove caches de versões anteriores
      caches.keys().then(keys =>
        Promise.all(
          keys
            .filter(key => !VALID_CACHES.includes(key))
            .map(key => {
              console.log('[SW] Removendo cache obsoleto:', key);
              return caches.delete(key);
            })
        )
      ),
      // PERF: Habilita Navigation Preload (~300ms de ganho em suporte)
      self.registration.navigationPreload?.enable(),
    ]).then(() => {
      console.log('[SW] Ativação completa');
      return self.clients.claim();
    })
  );
});

// ============================================
// Fetch — roteamento por estratégia
// ============================================
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignora métodos não-GET e protocolos não-http
  if (request.method !== 'GET' || !url.protocol.startsWith('http')) return;

  // Roteamento por tipo de recurso
  if (isCdnResource(url))    return event.respondWith(cacheFirst(request, CACHE_CDN));
  if (isStaticAsset(url))    return event.respondWith(cacheFirst(request, CACHE_STATIC));
  if (isImage(url))          return event.respondWith(cacheFirst(request, CACHE_IMAGES));
  if (isApiRequest(url))     return event.respondWith(networkFirst(request, CACHE_DYNAMIC));
  /* default: HTML pages */  event.respondWith(staleWhileRevalidate(request, CACHE_DYNAMIC));
});

// ============================================
// Estratégias de Cache
// ============================================

/**
 * Cache First
 * Serve do cache; busca na rede apenas se ausente.
 * Ideal para: assets estáticos, CDN, ícones.
 */
async function cacheFirst(request, cacheName) {
  try {
    const cache  = await caches.open(cacheName);
    const cached = await cache.match(request);
    if (cached) return cached;

    const response = await fetch(request);
    if (response?.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    console.warn('[SW] cacheFirst falhou:', err);
    return offlinePage();
  }
}

/**
 * Network First
 * Tenta a rede; usa cache como fallback offline.
 * Ideal para: chamadas de API, dados dinâmicos.
 */
async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response?.status === 200) {
      const cache = await caches.open(cacheName);
      await cache.put(request, response.clone());
      trimCache(cacheName, MAX_CACHE_SIZE.dynamic); // fire-and-forget intencional
    }
    return response;
  } catch (err) {
    console.warn('[SW] networkFirst: rede indisponível, tentando cache');
    const cached = await caches.match(request);
    return cached ?? offlinePage();
  }
}

/**
 * Stale While Revalidate
 * Serve do cache imediatamente e atualiza em background.
 * Ideal para: páginas HTML.
 *
 * CORREÇÃO: versão anterior retornava Promise em vez de Response
 * quando não havia cache — causava falha silenciosa.
 */
async function staleWhileRevalidate(request, cacheName) {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(request);

  // Revalidação em background — não bloqueia a resposta
  const networkFetch = fetch(request)
    .then(response => {
      if (response?.status === 200) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  // Retorna cache imediatamente se disponível; aguarda rede se não
  // CORREÇÃO: await garante Response, não Promise
  return cached ?? (await networkFetch) ?? offlinePage();
}

// ============================================
// Helpers de classificação de URL
// ============================================

function isCdnResource(url) {
  return url.hostname.includes('cdn.jsdelivr.net') ||
         url.hostname.includes('fonts.googleapis.com') ||
         url.hostname.includes('fonts.gstatic.com') ||
         url.hostname.includes('cdnjs.cloudflare.com');
}

function isStaticAsset(url) {
  return /\.(css|js|woff2?|ttf|eot|svg|ico)$/.test(url.pathname);
}

function isImage(url) {
  return /\.(jpe?g|png|gif|webp|avif)$/.test(url.pathname);
}

function isApiRequest(url) {
  return url.pathname.startsWith('/api/') || url.pathname.startsWith('/data/');
}

// ============================================
// Limite de tamanho do cache dinâmico
// ============================================
async function trimCache(cacheName, maxSize) {
  const cache = await caches.open(cacheName);
  const keys  = await cache.keys();
  if (keys.length > maxSize) {
    await Promise.all(keys.slice(0, keys.length - maxSize).map(k => cache.delete(k)));
  }
}

// ============================================
// Página offline (fallback HTML)
// ============================================
function offlinePage() {
  return new Response(
    `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Offline — Gst Tech</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; margin: 0;
      background: linear-gradient(135deg, #0d6efd 0%, #0a58ca 100%);
      color: #fff; text-align: center; padding: 1.5rem;
    }
    .card { max-width: 480px; }
    .icon { font-size: 4rem; margin-bottom: 1rem; }
    h1 { font-size: 2rem; margin: 0 0 .75rem; }
    p  { font-size: 1.1rem; opacity: .85; margin: 0 0 2rem; }
    button {
      background: #fff; color: #0d6efd; border: none;
      padding: .75rem 2rem; font-size: 1rem; font-weight: 600;
      border-radius: 8px; cursor: pointer; transition: transform .15s;
    }
    button:hover { transform: scale(1.04); }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">📡</div>
    <h1>Você está offline</h1>
    <p>Verifique sua conexão e tente novamente.</p>
    <button onclick="location.reload()">Tentar novamente</button>
  </div>
</body>
</html>`,
    {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'text/html;charset=utf-8', 'Cache-Control': 'no-store' },
    }
  );
}

// ============================================
// Mensagens do cliente (SKIP_WAITING, CACHE_URLS, CLEAR_CACHE)
// ============================================
self.addEventListener('message', event => {
  const type = event.data?.type;

  if (type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (type === 'CACHE_URLS') {
    const urls = event.data.urls ?? [];
    caches.open(CACHE_DYNAMIC)
      .then(cache => Promise.allSettled(urls.map(u => cache.add(u))))
      .catch(err => console.error('[SW] Erro ao cachear URLs:', err));
  }

  if (type === 'CLEAR_CACHE') {
    caches.keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => console.log('[SW] Todos os caches removidos'));
  }
});

// ============================================
// Background Sync
// ============================================
self.addEventListener('sync', event => {
  if (event.tag === 'sync-data') {
    event.waitUntil(syncOfflineData());
  }
});

async function syncOfflineData() {
  console.log('[SW] Sincronizando dados offline...');
  // TODO: processar fila de operações pendentes (IndexedDB → API)
}

// ============================================
// Push Notifications
// ============================================
self.addEventListener('push', event => {
  if (!event.data) return;
  const { title = 'Gst Tech', body = 'Nova notificação', data = {}, actions = [] } = event.data.json();

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      vibrate: [200, 100, 200],
      data,
      actions,
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url ?? '/'));
});

console.log(`[SW] Carregado — ${CACHE_VERSION} | scope: ${self.registration?.scope ?? 'desconhecido'}`);
