# Progress & Roadmap

## What is Working
- [x] Flashcards, fill-in-the-blank cards, practice quizzes (mcq / true-false / fill in the blank)
- [x] Nested folders, drag-and-drop, Move to..., CSV import/export
- [x] AI generation from PDF / Drive PDF / pasted text, background jobs in the extension, live progress banner
- [x] Google Drive auto-sync with conflict prompt
- [x] 22 themes (1 animated), themes library, favorites
- [x] PWA (offline via `sw.js`), extension popup, web dashboard
- [x] Promo video (Remotion) from real UI recordings

## Recent Changes (newest first)
- 2026-10-03: Campfire reworked: small, quiet fire built as a DOM overlay (`createScene` in `themes.js`, `.scene` CSS in `style.css`) animating only transform/opacity so it stays smooth when idle (SVG-image animations stalled); static backdrop in `images/campfire-scene.svg`; moved back into Cozy & Earthy (no Animated collection); badge icon is now a play symbol. `sw.js` cache v49.
- 2026-10-03: First animated theme, **Campfire** (`images/campfire-scene.svg`, `animated: true` in `themes.js`, "Animated" badge in the library, new `animated` collection). Folder color picker now has a live folder preview + quick swatches (dashboard modal only; the popup still uses its own picker). Folder cards hide "0 folders". `sw.js` cache v48.
- 2026-10-03: Quick 10 avoids the previous round's cards (`pickQuickTen` in `utils.js`; popup used a biased `sort(random)` shuffle, now Fisher-Yates). Fill-in-the-blank study accepts typos (`isCloseAnswer`, shared with practice tests) and has a Skip button (dashboard + popup). Folder cards show "N decks · M folders" and keep their own height (`.db-card--folder`). `sw.js` cache v47.
- 2026-10-03: Back arrow in a nested folder now goes to the parent folder instead of the workspace (`js/dashboard.js`, back handler). `sw.js` cache bumped to v46. Created this memory bank.
- 2026-10-02: Promo video rebuilt from recorded UI, human-like cursor, copy rewritten.
- 2026-10-01: Fjord / Night Library themes; R2-D2 and Boba Fett themes; fixes for AI generation stuck at 0%, outdated background worker detection, progress banner stuck on "Saving".

## Known Issues / Tech Debt
- [ ] No automated tests; verification is manual or via Playwright scripts.
- [ ] `dashboard.js` is ~2k lines; `app.js` (popup) duplicates much of its UI logic.
- [ ] `gh-pages` must be pushed manually after `main`.

## Next Ideas
- [ ] Background music for the promo video; "answers at the end" mode in the quiz scene.
