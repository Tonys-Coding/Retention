import { initDB, addDeck, getDecks, addCard } from './db.js';

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
                chrome.notifications.create({
                    type: 'basic',
                    iconUrl: 'icons/icon128.png',
                    title: 'Retention API Error',
                    message: 'Please set your OpenRouter API key in the extension settings.'
                });
                return;
            }
            
            const prompt = `Turn this text into a concise flashcard. Return ONLY a valid JSON object.
            
Strict Guidelines:
- Focus heavily on actual terms, core concepts, and mechanics. Ignore history and background fluff.
- Choose to make it a standard question/answer card OR a fill-in-the-blank card depending on what fits best.

1. Standard: { "type": "standard", "term": "...", "definition": "..." }
   - The 'term' MUST be phrased as a clear question (e.g., "What is the function of X?").
   - The 'definition' MUST be concise (strictly 1-2 sentences).

2. Fill-in-the-blank: { "type": "cloze", "term": "The complete sentence with the answer included.", "definition": "The exact single word or short phrase from the sentence to hide." }
   - The 'term' (the sentence with the blank) MUST be short (1-2 sentences maximum).

Text: "${text}"`;
            
            const aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + apiKey,
                    'HTTP-Referer': 'https://github.com/Tonys-Coding/Retention',
                    'X-Title': 'Retention Chrome Extension'
                },
                body: JSON.stringify({
                    model: "openrouter/free", // Changed to match app.js
                    messages: [
                        { role: "system", content: "You are a helpful assistant that strictly outputs JSON objects representing flashcards." },
                        { role: "user", content: prompt }
                    ]
                })
            });
            
            if (!aiRes.ok) throw new Error('API Request Failed');
            
            const data = await aiRes.json();
            const content = data.choices[0].message.content.trim();
            const jsonStr = content.replace(/^```(?:json)?|```$/gm, '').trim();
            const cardData = JSON.parse(jsonStr);
            
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
            
            chrome.notifications.create({
                type: 'basic',
                iconUrl: 'icons/icon128.png',
                title: 'Flashcard Created!',
                message: 'Saved "' + cardData.term + '" to Inbox.'
            });
            
        } catch (err) {
            console.error(err);
            chrome.notifications.create({
                type: 'basic',
                iconUrl: 'icons/icon128.png',
                title: 'Retention Error',
                message: 'Failed to generate flashcard: ' + err.message
            });
        }
    }
});
