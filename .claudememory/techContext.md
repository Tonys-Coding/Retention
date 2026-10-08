# Technical Context

## Core Stack
- **App:** 100% vanilla HTML/CSS/JavaScript (ES modules). No framework, no bundler, no build step.
- **Targets (one codebase):** Chrome extension (Manifest V3 popup `index.html` + service worker `js/background.js`), web dashboard `dashboard.html`, and an installable mobile PWA (`manifest.webmanifest`, `sw.js`).
- **Database:** IndexedDB `RetentionDB` (v4) in `js/db.js`. Stores: `decks`, `cards`, `stats`, `folders`, `quizResults`, `reviews` (v5).
- **Storage abstraction:** `js/env.js` wraps `chrome.storage.local` in the extension and `localStorage` (keys prefixed `retention_`) on the web. Also an event bus and runtime messaging shim.
- **AI:** OpenRouter via `js/ai.js` (prompts, free model list, retry on `openrouter/free`). User supplies their own API key in Settings.
- **Libraries (vendored in `js/`):** `marked.min.js` (Markdown), `pdf.min.js` + worker (PDF text), `confetti.min.js`.

## Architecture & Data Flow
- `js/dashboard.js` (~2k lines) drives the web/mobile UI: views (`home`, `folder`, `deck`, `study`, `test`, `themes`, `complete`) switched by `currentView`; `showHome()` / `showFolder()` / `openDeckEdit()` render into `#main-body`.
- `js/app.js` is the extension popup equivalent (separate UI code, same `db.js`).
- AI generation: `ai-processor.js` (flashcards from PDF/text), `ai-quiz.js` (quizzes). In the extension they run in the background worker via `background-jobs.js` and report progress through `progress-banner.js`.
- Quizzes: `practice-test.js` (take a test), `quiz-editor.js` (edit questions).
- Sync: `drive.js` syncs IndexedDB to `retention_backup.json` in the user's Google Drive. Extension auth = `chrome.identity`; web = Google Identity Services tokens (expire ~1h, "Sync paused" banner offers Reconnect). `db.js` `markDbDirty()` triggers auto-upload.
- Themes: `themes.js` (catalog, favorites, quick menu), `themes-library.js` (full gallery). Theme = `body.theme-<id>` CSS class; CSS variables in `css/style.css`.

## Deployment Strategy
- **Web/PWA:** GitHub Pages serves the **`gh-pages`** branch (a plain mirror of `main`) at `https://Tonys-Coding.github.io/Retention/dashboard.html`.
- **Extension:** loaded unpacked from the repo root (or Chrome Web Store); click **Reload** on `chrome://extensions` after changes.
- **Cache busting (important):** bump `CACHE_NAME` in `sw.js` (currently `retention-v59`) on every shipped change, otherwise PWA users keep stale files. CSS/JS URLs carry `?v=27` in `dashboard.html` and `sw.js`.
- **No production DB:** all data is local to each device; Drive backup is the only cloud copy.

## Tooling
- Node 24 / npm 11 / ffmpeg are installed locally; only the `promo-video/` subproject uses npm.
- No automated test suite. `test_app.js` / `test_syntax.js` are untracked scratch files. Verify UI changes by serving the repo (`python3 -m http.server 8765`) and driving `dashboard.html` (Playwright with system Chrome works; see `promo-video/record/`).

## Animated themes
- An animated theme = a theme entry with `animated: true` and `scene: '<kind>'`; `createScene(kind)` in `themes.js` builds a DOM overlay (mounted into `<body>` by `syncScene`, and into library previews) animated in CSS with transform/opacity only. The scene supplies ALL artwork (body gets no background image and no `background-attachment: fixed`, which forces full repaints on scroll); `theme.img` is a tiny WebP *still* used only for swatches/preview bases.
- **Performance rules (learned the hard way):** (1) never ship SVGs with filters/feTurbulence or thousands of shapes as runtime backgrounds: generate SVG in `tools/art/` (`tools/gen_*_scene.py`) and pre-render to WebP with `node tools/rasterize_scenes.mjs` (outputs `images/*.webp`; needs Chrome + `cwebp`); (2) no CSS `mask-image` on animated content (bake fades into the art instead); (3) size each layer to the canvas rectangle it covers (Storm uses `--u` = canvas unit in px and `.st-box` with `--x0/--y0/--x1/--y1`, same cover/bottom-centre mapping as the 1600x900 art); (4) rare effects (lightning) are `display:none` layers switched on by a JS-added class for the duration of a flash; (5) library previews pause off-screen via `.is-paused` (IntersectionObserver); (6) keep a `prefers-reduced-motion` rule.
- Add new scene assets to `APP_SHELL` in `sw.js` and bump `CACHE_NAME`. Idle cost measured with CDP tracing (bisect by hiding layers): Storm ~890ms -> ~390ms of `RunTask` per 5s, Campfire ~370ms (near the floor for any compositor animation); plain themes ~25ms.

## Progress / analytics
- Source of truth for history is the `reviews` store (`{ts, date (local YYYY-MM-DD), deckId, cardId, result: know|forgot|skip, type, ms}`); `stats` (UTC daily totals) is kept for legacy history and fills only days before the first review. All calculations live in `js/stats.js` (pure, no DOM): add metrics there, render in `progress-view.js`. Streaks use local dates.
- Study entry points must pass context: `recordStudyResult(know, {deckId, cardId, type, ms})` / `recordSkip(ctx)` (dashboard `handleResult`, popup `handleTraditionalResult` + skip buttons).
- City Lights windows: static skyline WebP has NO windows; `images/city-windows.json` (palette + `[x,y,w,h,colorIdx,on,alpha,p]`, art units) is drawn on `<canvas class=ct-windows>` and random windows are re-rolled every 0.5-1.6s (only dirty rects repaint). Pattern to reuse for any "many tiny things that change rarely" effect: canvas + timer instead of CSS animations on many layers.
