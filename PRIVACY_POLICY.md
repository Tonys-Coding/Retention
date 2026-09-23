# Privacy Policy for Retention: AI Flashcards

**Last Updated:** September 23, 2026

Retention ("the Extension") is committed to protecting your privacy. This Privacy Policy explains how your data is collected, used, and stored when you use the Extension.

## 1. Data Collection & Storage
Retention is designed with a "local-first" architecture. All of your custom folders, flashcard decks, and study progress are stored strictly locally on your device using Chrome's `chrome.storage.local` API. We do not track your study habits, click events, or usage metrics.

**Specific Types of Data Handled:**
To comply with Chrome Web Store transparency requirements, we explicitly disclose the handling of the following data types:
- **Website Content:** When you highlight text on a webpage and use the right-click menu to "Generate Flashcards," the Extension temporarily reads that specific selected website content and sends it to the AI provider to generate your study materials. The Extension does not monitor, read, or collect any other website content or browsing history.
- **Authentication Information:** The Extension stores your OpenRouter API key locally on your device to authenticate your AI requests. Additionally, if you choose to use the Cloud Sync feature, the Extension requests Google OAuth authentication tokens strictly to verify your identity and enable backing up/restoring your flashcard database to your personal Google Drive.

## 2. Third-Party Services
Retention interacts with the following third-party services exclusively to provide its core functionality:

**OpenRouter (AI Generation)**
When you upload a PDF or highlight web text, that specific text is sent directly from your browser to OpenRouter's API using the API key you provide. We do not intercept, log, or store these API requests. Please refer to OpenRouter's privacy policy regarding how they process prompt data.

**Google Drive (Cloud Sync)**
Retention requests permission to access your Google Drive (`drive.file` and `drive.readonly` scopes) strictly for Cloud Sync functionality.
- We only access files created by the Extension itself (your backup JSON files).
- Data is only sent to Google Drive when you manually click "Upload to Drive".
- Data is only retrieved from Google Drive when you manually click "Download from Drive".
- We do not have access to any other personal files in your Google Drive.

## 3. Data Sharing and Selling
We **do not** sell, rent, or share your personal data, website content, flashcards, or authentication information with any third parties. Your data remains yours.

## 4. Permissions Justification
- **Storage / UnlimitedStorage:** Required to save your flashcards and API key locally on your device.
- **Identity:** Required to securely authenticate you with Google to backup your flashcards to your personal Google Drive.
- **ContextMenus:** Required so you can right-click highlighted text on websites to instantly generate flashcards.
- **Notifications:** Used to alert you when your AI flashcard generation is complete or when a Google Drive backup succeeds/fails.
- **Host Permission (openrouter.ai):** Required to make direct API requests to OpenRouter to generate your flashcards.

## 5. Contact
If you have any questions or concerns about this Privacy Policy or how your data is handled, please open an issue on the official GitHub repository for this extension.
