<div align="center">
  <img src="icons/icon128.png" alt="Retention Logo" width="128" height="128">
  <h1>Retention: AI Flashcards</h1>
</div>

Retention is a powerful, minimalistic flashcard study system built directly into your browser as a Chrome Extension. Featuring a sleek, brutalist high-contrast aesthetic, Retention is designed for deep focus and efficient learning without distractions.

## Features

### Organization & Workspace
*   **Decks & Nested Folders:** Organize your flashcards into custom decks. Group related decks into folders, and even nest folders within other folders for infinite organization.
*   **Intuitive Drag & Drop:** Effortlessly reorganize your workspace. Drag decks into folders, drop folders into other folders, or drag items to the breadcrumb navigation at the top to move them back to the parent directory.
*   **Study Entire Folders:** Want to prepare for finals? Click "Study Decks" on any folder to instantly aggregate and shuffle every flashcard from all of its decks into one massive study session.

### Study Modes
*   **Traditional & Fill-in-the-Blank (FITB):** Retention supports both standard Q&A flashcards and highly interactive Fill-in-the-Blank exercises for testing contextual knowledge.
*   **Study Flow:** Shuffle and study your decks using a simple, effective 3-button self-assessment interface: *Forgot*, *Skip*, and *Know*.
*   **Seamless Session Resuming:** Life happens. If you accidentally close the popup or click away in the middle of a study session, Retention silently saves your exact place. Reopen the extension, and you'll be dropped right back to the exact flashcard you were on.
*   **Progress Tracking:** Cards dynamically update their status to track your Mastery percentage. 

### Rich Flashcard Editing
*   **Markdown Support:** Flashcards support rich Markdown formatting. Easily add `code blocks`, lists, **bold**, and *italic* text to format complex subjects efficiently.
*   **Image Support:** Drag and drop or paste images directly into your flashcards.

### AI Integration & Document Extraction
*   **Generate from Local PDF:** Instantly create flashcard decks from your study materials. Select a local PDF, and the extension will parse the text and generate a massive deck of standard and FITB cards.
*   **Import PDFs from Google Drive:** A fully integrated native Drive Picker allows you to search and load your textbook PDFs directly from your cloud storage.
*   **Right-Click Context Menu:** Reading an article online? Simply highlight any text on any webpage, right-click, and select "Add to Retention (AI)" to instantly generate and beam a flashcard directly into your Inbox.
*   **Powered by OpenRouter:** Simply plug in an OpenRouter API key, and the extension automatically processes your documents and intelligently generates high-quality flashcards for you.

### Import, Export, & Cloud Sync
*   **CSV Import/Export:** Easily backup or share individual decks using standard CSV files (supports importing decks containing mixed formats like FITB and standard cards).
*   **Google Drive Sync:** Securely back up and restore your entire workspace directly to/from your Google Drive.
*   **Offline First:** Your workspace is stored entirely locally on your device via IndexedDB, making it lightning-fast and fully functional without an internet connection (aside from AI generation and Drive interactions).

### Theming
*   **Light & Dark Modes:** Toggle seamlessly between a crisp Light Mode and an eye-friendly Dark Mode.
*   **Brutalist UI:** A distraction-free, high-contrast aesthetic with thick borders, custom scrollbars, and drop shadows designed for high readability. Expanded UI dimensions comfortably fit longer text and code snippets.

---

## Installation

1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** in the top right corner.
3. Click on **Load unpacked**.
4. Select the directory containing this extension (`Retention Flashcard Chrome Extension`).
5. *Optional:* Pin the extension to your Chrome toolbar for easy access.

---

## Integrations Setup

### OpenRouter API (AI Flashcard Generation)
To use the AI generation features:
1. Open the Retention extension.
2. Click the **Settings (Gear)** icon in the top right.
3. Paste your [OpenRouter API Key](https://openrouter.ai/) into the API Key field and save.

### Google Drive Sync & PDF Picker
To enable cloud backups and Google Drive PDF loading, you must provide a Google Client ID in the extension's `manifest.json`.
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project and enable the **Google Drive API**.
3. Configure the OAuth Consent Screen (add your email as a test user).
4. Create **OAuth 2.0 Client ID** credentials (choose "Chrome Extension" and provide the Extension ID found in `chrome://extensions/`).
5. Copy the generated **Client ID**.
6. Open `manifest.json` and add the following block:
   ```json
   "oauth2": {
     "client_id": "YOUR_CLIENT_ID_HERE.apps.googleusercontent.com",
     "scopes": [
       "https://www.googleapis.com/auth/drive.file",
       "https://www.googleapis.com/auth/drive.readonly"
     ]
   },
   "key": "YOUR_OPTIONAL_FIXED_EXTENSION_KEY"
   ```

---

## 💻 Usage Guide

*   **Creating Items:** Use the **+ New Deck** or **+ New Folder** buttons on the dashboard to build your workspace.
*   **Editing Cards:** Click a deck, then click the **Edit (Pencil)** icon to add new cards. Fill out the Term, Definition, and Example fields. 
*   **Formatting:** Use standard Markdown syntax in the Definition/Example boxes.
*   **Studying:** Click a deck and press **Start Study**. Tap the flashcard to flip it and reveal the answer, then honestly rate your memory using the bottom buttons.
*   **Navigating:** Use the breadcrumb trail at the top of the app to navigate backward through nested folders.
