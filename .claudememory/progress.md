# Progress & Roadmap

## What is Working
- [x] Flashcards, fill-in-the-blank cards, practice quizzes (mcq / true-false / fill in the blank)
- [x] Nested folders, drag-and-drop, Move to..., CSV import/export
- [x] AI generation from PDF / Drive PDF / pasted text, background jobs in the extension, live progress banner
- [x] Google Drive auto-sync with conflict prompt
- [x] 21 themes, themes library, favorites
- [x] PWA (offline via `sw.js`), extension popup, web dashboard
- [x] Promo video (Remotion) from real UI recordings

## Recent Changes (newest first)
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
