<div align="center">
  <img src="icons/icon128.png" alt="Retention Logo" width="128" height="128">
  <h1>Retention: AI Flashcard Ecosystem</h1>
  <p><strong>A brutally minimalist, highly customizable, AI-powered study system spanning your Browser, Desktop, and Mobile devices.</strong></p>
</div>

Retention is no longer just a Chrome Extension. It has evolved into a fully autonomous, offline-capable study ecosystem. Whether you are highlighting text on a webpage, organizing decks on your desktop monitor, or studying on your phone during a commute, Retention syncs seamlessly across all platforms to keep you deeply focused on learning.

##  Key Features

###  Tri-Platform Ecosystem
Retention is available wherever you need it:
*   **Google Chrome Extension:** Lives in your toolbar. Perfect for quickly capturing text from web pages using the right-click Context Menu.
*   **Web Dashboard:** A sprawling, full-screen desktop experience hosted on GitHub Pages. Perfect for organizing massive decks and dragging-and-dropping textbook PDFs.
*   **Mobile PWA (Progressive Web App):** Installable directly to your iOS or Android home screen. Designed to behave exactly like a native app, complete with offline capabilities, custom iOS viewport handling to prevent keyboard clipping, and touch-friendly gestures.

###  Seamless Background Auto-Sync
Never worry about transferring your decks manually again. 
Retention features a background auto-sync engine built on Google Drive. Every device keeps a full offline copy of your workspace and syncs it through a single backup file in your own Drive:
*   **Changes upload automatically** a moment after you make them. In the Chrome extension the background service worker finishes the upload even if you close the popup, including cards created from the right-click menu.
*   **Other devices pull updates** when you open the app or switch back to it, then refresh to show them.
*   **No silent overwrites:** if a device was offline (or its sign-in expired) while you made changes elsewhere, Retention asks whether to keep the Drive version or this device's version instead of guessing.
*   **Visible status:** Settings shows when you last synced. On the web/mobile app, Google sign-in expires after about an hour; when that happens a "Sync paused" banner offers a one-tap **Reconnect** so your phone never quietly falls out of date.

###  Massive Theming Engine
Retention features a beautiful, brutalist, high-contrast aesthetic—featuring thick borders, aggressive drop shadows, and incredibly rich themes. Choose between 21 custom styles, organized into collections:
*   **Monochrome:** Light, Dark.
*   **Retro Tech:** Terminal, Dracula, Vaporwave.
*   **Paper & Print:** Composition (notebook paper), Blueprint (drafting grid), Neo-Pop (comic halftone).
*   **Cozy & Earthy:** Autumn, Earthy, Cozy Cabin, Night Library (lamp-lit shelves of muted book spines on warm navy).
*   **Café Treats:** Matcha, Strawberry.
*   **Celestial:** Space (starfield), Moon (lunar craters).
*   **Landscapes:** Fjord (soft slate blues with misty layered mountains, a snowcap and still water).
*   **Star Wars:** Tatooine (desert hues and twin suns), **Kylo** (pitch black background featuring sweeping radial chrome bands and razor-sharp, glowing red Kintsugi mask fractures), **R2-D2** (a silver astromech dome with the radar eye, holo-projector and blue panel bands over a white body), and **Boba Fett** (a weathered green Mandalorian helmet with the black T-visor, brown trim, rangefinder and kill stripes).

**Themes Library & Favorites**
*   **Themes Library:** A dedicated page in the dashboard (sidebar **Themes**, or **Browse all themes** in the palette menu) shows every theme as a large live preview with its real colors and background artwork. Search, filter by Favorites / Light / Dark, and apply any theme with one click.
*   **Favorites:** Star the themes you love. The palette button becomes a quick menu of just your favorites for one-click switching, in the extension popup, the web dashboard, and the mobile app.
*   **Reorder:** Drag favorites into the order you want (or tap **Reorder** and use the arrows on touch screens and keyboards). The quick menu follows that order.
*   **Extension hand-off:** In the popup, **Manage themes** opens the full library in the dashboard.
*   **Synced everywhere:** Your favorites and their order travel with your Google Drive backup, so the extension, web dashboard, and phone share the same list. (The active theme stays per device.)

###  AI-Powered Flashcard Generation (OpenRouter)
Don't waste hours typing out flashcards manually. Supply an OpenRouter API key and let the AI do the heavy lifting:
*   **Drag & Drop PDFs:** Drag any local PDF directly onto the Web Dashboard dropzone.
*   **Google Drive PDF Picker:** Browse and select PDFs directly from your cloud storage.
*   **Focus Modifiers:** Choose in Settings what the AI should prioritize when generating from PDFs (e.g., *Dates & Events*, *Formulas & Math*, *Vocabulary / Jargon*, *People & Quotes*, *Code & Syntax*, *Language Translation*).
*   **Live progress:** Responses stream in, so the progress banner shows the AI writing in real time, and long generations keep running in the extension's background even when the model is slow.
*   **Context Menu Magic:** Highlight text on any website, right-click, and select "Add to Retention (AI)" to instantly beam a generated flashcard into your Inbox.
*   **Practice quizzes too:** The same AI can write multiple choice, true/false and fill-in-the-blank practice quizzes (see Practice Quiz Decks below).

###  Practice Quiz Decks
Alongside flashcard decks, Retention has **practice quiz decks** (with their own test-sheet icon) for exam-style review:
*   **Three question types:** Multiple choice (2–6 choices), True / False, and Fill in the blank (forgiving of case, punctuation and small typos, with an "I was right" override).
*   **Practice test page:** Every question on one page with a numbered **Question list** to jump around, like a real test. Choose to see answers **right away** (each question is marked as you answer) or **at the end** (change answers freely, then Submit).
*   **Results:** Score, time, and your best score; **Retake test** or **Retake missed** questions. Quiz scores are tracked separately and never change flashcard mastery.
*   **Create them your way:** Import a quiz CSV, or use **Add New → New Quiz Deck** and **Edit Questions** in the dashboard. Quiz decks can be renamed, moved, exported, and synced like any other deck.
*   **Quiz CSV format:** `Question, Type, Answer, Choice A, Choice B, Choice C, Choice D, Explanation` with Type `mcq`, `tf`, or `fitb` (mcq Answer = the correct letter; tf Answer = True/False; fitb uses `___` for the blank and `|` between accepted answers). The downloadable **AI Prompt** (in the import instructions) teaches any AI chatbot to write both flashcard and quiz CSVs.
*   **Generate quizzes with AI:** **Add New → Generate Quiz with AI** (popup, web, and mobile) turns a PDF, a PDF from Google Drive, or pasted notes into a practice quiz deck in the folder you have open. Pick how many questions (Auto, 10, 20, 30) and which types to include; your Settings focus modifier applies too. Every question is checked before it's saved (one correct answer, distinct choices, short blanks) and duplicates are dropped. In the extension it runs in the background, so you can close the popup.
*   **Right-click quizzes:** Highlight text on any page, right-click, and choose **Make practice quiz (AI)** to turn it into a quiz deck.

###  Infinite Organization & Study Flows
*   **Nested Folders & Drag-and-Drop:** Organize decks into folders, and nest folders within folders infinitely. Easily drag decks across your workspace.
*   **Move To…:** Every deck and folder's ⋮ menu has a "Move to…" option that opens a tree of your entire workspace, so you can relocate anything in one tap (works on desktop and mobile, where drag-and-drop isn't practical).
*   **Create Where You Are:** New folders, new decks, and imports (CSV, PDF, and Google Drive PDFs) are created inside the folder you currently have open instead of the workspace root.
*   **Bulk CSV Import:** Select as many CSV files as you like at once; each becomes its own deck. Files with no cards are skipped and listed so nothing fails silently. Decks can also be exported back to CSV.
*   **Quick 10:** A random 10-card round that favors cards you did not see in the previous Quick 10, cycling through the whole deck before repeating.
*   **Folder counts:** Each folder card shows how many decks and sub-folders it holds.
*   **Bulk Studying:** Click "Study Decks" on any folder to instantly aggregate and shuffle every flashcard from all of its child decks into one massive study session.
*   **State Persistence:** If you accidentally close the app mid-session, Retention remembers your exact place and drops you right back to the card you were studying.

###  Rich Markdown & Flexible Media
*   **Markdown Support:** Easily format cards with `code blocks`, lists, **bold**, and *italics*.
*   **Intelligent Image Scaling:** Paste standard markdown images (`![alt](url)`). Retention features advanced dynamic flexbox polyfills that guarantee your images will flawlessly scale up to fill the available space on both massive desktop monitors and tiny iPhone screens without breaking aspect ratios or flowing out of bounds.
*   **Interactive Fill-in-the-Blank (FITB):** Create active-recall cloze deletions to test contextual knowledge. Answers forgive case, punctuation and small typos, and a **Skip** button moves on without counting the card.

---

##  Getting Started

### Option 1: The Web & Mobile App (Recommended)
The Web Dashboard is fully hosted and ready to use immediately.
1. Navigate to: `https://Tonys-Coding.github.io/Retention/dashboard.html`
2. **Desktop:** Bookmark the page or install it as a desktop app via Chrome.
3. **Mobile (iOS):** Open the link in Safari, tap the Share button, and select **Add to Home Screen**. It will now behave identically to a native app.
4. Open the Settings (Gear) icon to sign in to Google Drive (to enable cloud syncing) and paste your OpenRouter API key (to enable AI generation).

### Option 2: The Chrome Extension
To install the extension companion for right-click web capturing:
1. Clone or download this repository.
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** in the top right corner.
4. Click on **Load unpacked** and select the `Retention` directory.
5. After updating the files (e.g. `git pull`), click the extension's **Reload** button on `chrome://extensions`. Chrome keeps running the old background worker until you do; if you forget, Retention notices when you start an AI generation and offers to reload for you.

---

##  Architecture & Tech Stack
Retention was built to be lightning fast, zero-dependency, and incredibly resilient.
*   **Frontend:** 100% Vanilla HTML, CSS, and JavaScript. No React, no build steps, no bloat.
*   **Database:** IndexedDB (`js/db.js`). All flashcards are stored instantly and securely on your local device for true offline capabilities.
*   **Service Workers:** `sw.js` aggressively caches the app shell, CSS, and JS so the mobile app boots instantly without an internet connection.
*   **Cloud Sync:** `js/drive.js` syncs IndexedDB with a `retention_backup.json` file via the Google Drive API. The extension authenticates with `chrome.identity`; the web/PWA uses Google Identity Services (GIS) tokens. Sync state lives in `chrome.storage` (extension, shared with the background worker) or `localStorage` (web).
*   **Hosting:** GitHub Pages serves the web/mobile app from the `gh-pages` branch, so pushes to `main` must also be pushed to `gh-pages` to deploy.
*   **Parsing:** Uses `marked.js` for Markdown parsing and `pdf.js` for extracting text from dense textbooks.

---

<div align="center">
  <i>Built for absolute focus and ultimate retention.</i>
</div>

## Promo video (Remotion)

`promo-video/` is a separate [Remotion](https://www.remotion.dev) project (not part of the extension package). It composes **screen recordings of the real dashboard** (AI generation, flashcards, fill-in-the-blank, practice quizzes, theme switching) with animated titles.

```bash
cd promo-video
npm install
npm run dev              # live preview in Remotion Studio
npm run build            # out/promo.mp4 (1920x1080, ~45s)
npm run build:vertical   # out/promo-vertical.mp4 (1080x1920)
```

To re-record the clips after a UI change (needs Google Chrome installed):

```bash
python3 -m http.server 8765        # in the repo root, leave running
cd promo-video && node record/record.mjs   # writes public/clips/*.mp4
```

`record/seed.mjs` seeds demo decks through the app's own `db.js`. The AI scene drives the real progress banner with a scripted animation (no API key needed).
