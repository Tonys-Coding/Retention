# Privacy Policy for Retention: AI Flashcards

**Last Updated:** October 1, 2026

Retention ("the Extension") is committed to protecting your privacy. This Privacy Policy explains how your data is collected, used, and stored when you use the Extension and its companion web dashboard.

## 1. Data Collection & Storage
Retention is designed with a "local-first" architecture. Your folders, flashcard decks, cards (including any images you attach), and daily study statistics are stored locally on your device in your browser's IndexedDB database. Settings such as your OpenRouter API key and preferences are stored locally using Chrome's `chrome.storage.local` API (or your browser's `localStorage` on the web dashboard). We do not operate any servers, and we do not track your study habits, click events, or usage metrics.

**Specific Types of Data Handled:**
To comply with Chrome Web Store transparency requirements, we explicitly disclose the handling of the following data types:
- **Website Content:** When you highlight text on a webpage and choose "Add to Retention (AI)" from the right-click menu, the Extension reads that specific selected text and sends it to the AI provider to generate a flashcard. The Extension does not monitor, read, or collect any other website content or browsing history.
- **Authentication Information:** The Extension stores your OpenRouter API key locally on your device to authenticate your AI requests. If you sign in to Google for Cloud Sync, the Extension uses Google OAuth access tokens to access your Google Drive on your behalf. These tokens are kept locally and are never sent anywhere other than Google.

## 2. Third-Party Services
Retention interacts with the following third-party services exclusively to provide its core functionality:

**OpenRouter (AI Generation)**
When you generate flashcards from a PDF or from highlighted web text, the extracted text is sent directly from your browser to OpenRouter's API using the API key you provide. OpenRouter forwards it to the AI model that handles the request. We do not intercept, log, or store these requests. Please refer to OpenRouter's privacy policy regarding how they process prompt data.

**Google Drive (Cloud Sync & PDF Import)**
Retention requests two Google Drive permissions:
- **`drive.file`**: used to create and update a single backup file (`retention_backup.json`) containing your folders, decks, cards, and study statistics. Once you have signed in, Retention syncs automatically: it uploads a few seconds after you make changes, and checks for a newer backup when the app is opened or brought back into focus. You can also upload or download manually from Settings.
- **`drive.readonly`**: used only when you open "Import PDF from Drive". Retention lists the PDF files in your Drive so you can choose one, then downloads only the PDF you select in order to extract its text. Retention never modifies or deletes your files and does not read any other file types.

## 3. Data Sharing and Selling
We **do not** sell, rent, or share your personal data, website content, flashcards, or authentication information with any third parties. Data leaves your device only when you use the features described above (AI generation via OpenRouter and Cloud Sync / PDF import via your own Google Drive). Your data remains yours.

## 4. Permissions Justification
- **Storage / UnlimitedStorage:** Required to save your flashcards, images, settings, and API key locally on your device.
- **Identity:** Required to securely authenticate you with Google for Cloud Sync and Drive PDF import.
- **ContextMenus:** Required so you can right-click highlighted text on websites to instantly generate flashcards.
- **Notifications:** Used to tell you when AI flashcard generation starts, completes, or fails.
- **Host Permission (openrouter.ai):** Required to make direct API requests to OpenRouter to generate your flashcards.

## 5. Contact
If you have any questions or concerns about this Privacy Policy or how your data is handled, please open an issue on the official GitHub repository for this extension.
