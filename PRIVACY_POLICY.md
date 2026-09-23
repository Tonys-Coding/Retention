# Privacy Policy for Retention: AI Flashcards

**Last Updated:** September 23, 2026

Retention ("the Extension") is committed to protecting your privacy. This Privacy Policy explains how your data is collected, used, and stored when you use the Extension.

## 1. Data Collection and Storage
Retention is designed with a "local-first" architecture. 
- **Local Storage:** All of your custom folders, flashcard decks, study progress, and your OpenRouter API key are stored strictly locally on your device using Chrome's `chrome.storage.local` API. 
- **No Analytics:** We do not track your study habits, click events, or usage metrics.

## 2. Third-Party Services
Retention interacts with the following third-party services exclusively to provide its core functionality:

**OpenRouter (AI Generation)**
When you upload a PDF or highlight web text to generate flashcards, that specific text is sent directly from your browser to OpenRouter's API using the API key you provide. We do not intercept, log, or store these API requests. Please refer to OpenRouter's privacy policy regarding how they process prompt data.

**Google Drive (Cloud Sync)**
Retention requests permission to access your Google Drive (`drive.file` and `drive.readonly` scopes) strictly for Cloud Sync functionality.
- We only access files created by the Extension itself (your backup JSON files).
- Data is only sent to Google Drive when you manually click "Upload to Drive".
- Data is only retrieved from Google Drive when you manually click "Download from Drive".
- We do not have access to any other personal files in your Google Drive.

## 3. Data Sharing and Selling
We **do not** sell, rent, or share your personal data, flashcards, or API keys with any third parties. Your data remains yours.

## 4. Permissions Justification
- **Storage / UnlimitedStorage:** Required to save your flashcards and API key locally on your device.
- **Identity:** Required to securely authenticate you with Google to backup your flashcards to your personal Google Drive.
- **ContextMenus:** Required so you can right-click highlighted text on websites to instantly generate flashcards.
- **Notifications:** Used to alert you when your AI flashcard generation is complete or when a Google Drive backup succeeds/fails.
- **Host Permission (openrouter.ai):** Required to make direct API requests to OpenRouter to generate your flashcards.

## 5. Changes to this Policy
We may update this Privacy Policy from time to time. Any changes will be reflected by the "Last Updated" date at the top of this page.

## 6. Contact
If you have any questions or concerns about this Privacy Policy or how your data is handled, please open an issue on the official GitHub repository for this extension.
