import { initDB, addDeck, getDecks, addCard } from './db.js';
import { processPdfChunks } from './ai-processor.js';
import { requestCompletion, parseAIJson, buildSelectionPrompt, SELECTION_SYSTEM_PROMPT } from './ai.js';
import { startBackgroundSync } from './drive.js';

// Uploads changes to Google Drive even after the popup closes, including
// cards created here from the right-click menu or PDF generation
startBackgroundSync();

const notify = (title, message) => {
    chrome.notifications.create(Date.now().toString(), {
        type: 'basic',
        iconUrl: chrome.runtime.getURL("icons/icon128.png"),
        title,
        message
    });
};

chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "generate-retention-flashcard",
        title: "Add to Retention (AI)",
        contexts: ["selection"]
    });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === "generate-retention-flashcard") {
        const text = info.selectionText;
        if (!text) return;

        try {
            const res = await chrome.storage.local.get(['openrouter_api_key']);
            const apiKey = res.openrouter_api_key;

            if (!apiKey) {
                notify('Retention API Error', 'Please set your OpenRouter API key in the extension settings.');
                return;
            }

            const aiRes = await requestCompletion(apiKey, [
                { role: "system", content: SELECTION_SYSTEM_PROMPT },
                { role: "user", content: buildSelectionPrompt(text) }
            ]);

            if (!aiRes.ok) {
                let errMsg = aiRes.statusText || `HTTP ${aiRes.status}`;
                try {
                    const errData = await aiRes.json();
                    errMsg = errData.error?.message || errMsg;
                } catch (e) { /* ignore */ }
                throw new Error(errMsg);
            }

            const data = await aiRes.json();
            const cardData = parseAIJson(data.choices?.[0]?.message?.content);

            if (!cardData.term || !cardData.definition) throw new Error('Invalid AI response format');

            await initDB();
            const decks = await getDecks();
            let inboxDeck = decks.find(d => d.name === "Inbox");
            let inboxId;

            if (inboxDeck) {
                inboxId = inboxDeck.id;
            } else {
                inboxId = await addDeck("Inbox");
            }

            await addCard({
                deckId: inboxId,
                term: cardData.term,
                definition: cardData.definition,
                example: '',
                status: 'new',
                type: cardData.type === 'cloze' ? 'cloze' : 'standard'
            });

            notify('Flashcard Created!', 'Saved "' + cardData.term + '" to Inbox.');
            chrome.runtime.sendMessage({ action: 'REFRESH_DECKS' }).catch(() => {});

        } catch (err) {
            console.error(err);
            notify('Retention Error', 'Failed to generate flashcard: ' + err.message);
        }
    }
});

// Process PDF Chunks in the background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'PROCESS_PDF_CHUNKS') {
        processPdfChunks(request.textChunks, request.deckName, request.folderId, { notify }).catch(console.error);
        sendResponse({status: 'started'});
    }
});
