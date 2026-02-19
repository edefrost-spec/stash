// Stash Service Worker
const CACHE_NAME = 'stash-v8';
const ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/config.js',
  '/manifest.json',
  '/js/app.js',
  '/js/core.js',
  '/js/events.js',
  '/js/images.js',
  '/js/data.js',
  '/js/cards.js',
  '/js/card-templates.js',
  '/js/views.js',
  '/js/modal.js',
  '/js/audio.js',
  '/js/tags-and-saves.js',
  '/js/kindle.js',
  '/js/quick-note.js',
  '/js/note-editor.js',
  '/js/format-bar.js',
  '/js/spaces.js',
  '/js/focus-bar.js',
  '/js/context-menu.js',
  '/css/variables.css',
  '/css/base.css',
  '/css/layout.css',
  '/css/grid.css',
  '/css/states.css',
  '/css/reading-pane.css',
  '/css/responsive.css',
  '/css/modal.css',
  '/css/quick-add.css',
  '/css/digest.css',
  '/css/kindle.css',
  '/css/card-types.css',
  '/css/quick-note.css',
  '/css/focus-bar.css',
  '/css/unified-modal.css',
  '/css/card-styles.css',
  '/css/context-menu.css',
  '/css/voice.css',
  '/js/voice.js',
  '/css/canvas.css',
  '/js/canvas.js',
];

// Install
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch - Network first, fallback to cache
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip API requests (let them go to network)
  if (event.request.url.includes('supabase.co')) return;

  // ✅ Skip non-http(s) requests (chrome-extension:, data:, etc.)
  const url = new URL(event.request.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clone and cache successful responses
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return response;
      })
      .catch(() => {
        // Fallback to cache
        return caches.match(event.request);
      })
  );
});
