/**
 * Service Worker — Offline caching for Retention PWA
 * 
 * Caches the app shell (HTML, CSS, JS, icons) on install so that
 * the flashcard app works fully offline on mobile devices.
 * Only network requests to openrouter.ai and googleapis.com are
 * left un-cached (they require live connectivity).
 */

const CACHE_NAME = 'retention-v5';

const APP_SHELL = [
    './dashboard.html',
    './css/style.css',
    './css/dashboard.css',
    './js/dashboard.js',
    './js/db.js',
    './js/csv.js',
    './js/env.js',
    './js/ai-processor.js',
    './js/drive.js',
    './js/marked.min.js',
    './js/confetti.min.js',
    './js/pdf.min.js',
    './js/pdf.worker.min.js',
    './icons/icon48.png',
    './icons/icon128.png'
];

// ─── Install: pre-cache the app shell ────────────────────────────────
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(APP_SHELL);
        }).then(() => self.skipWaiting())
    );
});

// ─── Activate: clean old caches ──────────────────────────────────────
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
            )
        ).then(() => self.clients.claim())
    );
});

// ─── Fetch: Network First, fallback to cache ───────────────────────
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Never cache API calls
    if (
        url.hostname === 'openrouter.ai' ||
        url.hostname.includes('googleapis.com') ||
        url.hostname.includes('accounts.google.com') ||
        url.hostname.includes('gstatic.com')
    ) {
        return; // Let the browser handle it normally
    }

    event.respondWith(
        fetch(event.request)
            .then(networkResponse => {
                // If we get a valid response from the network, update the cache
                if (networkResponse && networkResponse.ok) {
                    const clone = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, clone);
                    });
                }
                return networkResponse;
            })
            .catch(() => {
                // If network fails (offline), fall back to the cache
                return caches.match(event.request);
            })
    );
});
