/**
 * Service Worker — Offline caching for Retention PWA
 * 
 * Caches the app shell (HTML, CSS, JS, icons) on install so that
 * the flashcard app works fully offline on mobile devices.
 * Only network requests to openrouter.ai and googleapis.com are
 * left un-cached (they require live connectivity).
 */

const CACHE_NAME = 'retention-v54';

const APP_SHELL = [
    './dashboard.html',
    './css/style.css?v=27',
    './css/dashboard.css?v=27',
    './js/dashboard.js?v=27',
    './js/db.js',
    './js/csv.js',
    './js/env.js',
    './js/ai.js',
    './js/workspace.js',
    './js/themes.js',
    './js/themes-library.js',
    './js/utils.js',
    './js/stats.js',
    './js/progress-data.js',
    './js/progress-view.js',
    './images/campfire-scene.svg',
    './images/storm-still.svg',
    './images/storm-sky.svg',
    './images/storm-land.svg',
    './images/storm-wisps.svg',
    './images/storm-grass.svg',
    './images/storm-rain.svg',
    './images/storm-bolt-a.svg',
    './images/storm-bolt-b.svg',
    './js/practice-test.js',
    './js/quiz-editor.js',
    './js/import-help.js',
    './js/ai-quiz.js',
    './js/progress-banner.js',
    './js/background-jobs.js',
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
        // Always revalidate with the server (a cheap 304 when unchanged) so a new
        // page never runs against an older, HTTP-cached copy of one of its modules
        fetch(event.request, { cache: 'no-cache' })
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
