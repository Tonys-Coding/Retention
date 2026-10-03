# System Patterns

## Codebase Structure
- `index.html`, `js/app.js`, `css/style.css`: extension popup UI.
- `dashboard.html`, `js/dashboard.js`, `css/dashboard.css`: web/mobile dashboard.
- `js/db.js`: ALL IndexedDB access (decks, cards, folders, stats, quizResults).
- `js/env.js`: extension-vs-web detection, `storage`, messaging.
- `js/ai*.js`, `js/background*.js`, `js/progress-banner.js`: AI generation and background jobs.
- `js/drive.js`: Google Drive picker + backup sync.
- `js/themes*.js`, `css/style.css`: theming. `js/csv.js`, `js/import-help.js`: CSV import/export.
- `Store_Assets/`: Chrome Web Store images. `docs/`: GitHub Pages landing page.
- `promo-video/`: separate Remotion project for the promo video (not part of the extension).
- `scratch/`, `brag-output-*/`, `test_*.js`: untracked local scratch, never commit.

## Design Decisions
- **Zero dependencies / no build.** Edit files and reload. Keep it that way.
- **Styling:** hand-written CSS with variables (`--bg-primary`, `--border-color`, ...). Brutalist look: thick borders, hard drop shadows, high contrast. New themes need `body.theme-<id>` rules plus an entry in `THEMES` (`themes.js`).
- **Data model:** folders nest via `parentId`; decks belong to a folder via `folderId` (null = workspace root); a deck with `kind: 'quiz'` is a quiz deck. Card `type: 'cloze'` = fill-in-the-blank flashcard; quiz questions use `type` of `mcq` / `tf` / `fitb`.
- **Navigation:** `dashboard.js` tracks `currentView`, `currentFolderId`, `editingDeckId`; the back arrow handler (`dom.btnBack.onclick`) decides where to return. Folder -> parent folder (or workspace if top-level).
- **Mastery:** card `status` ('new' | 'learning' | 'mastered'); quiz scores are stored separately and never affect it.

## Critical Rules
- Never write to IndexedDB outside `js/db.js`. Write functions call `markDbDirty()` so sync uploads.
- Escape user text with `escapeHtml` (`js/utils.js`) before putting it in `innerHTML`.
- After changing shipped JS/CSS: bump `CACHE_NAME` in `sw.js`.
- Commit AND push after every change; then also `git push origin main:gh-pages` or the web app never updates. Stage only files you touched.
- Update README.md when a change affects documented features or usage.
