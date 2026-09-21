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
            // Get API key
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
            
            // Generate flashcard
            const prompt = \`Turn this text into a concise flashcard. Return ONLY a valid JSON object with 'term' and 'definition' string properties. Text: "\${text}"\`;
            
            const aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': \`Bearer \${apiKey}\`
                },
                body: JSON.stringify({
                    model: "openai/gpt-4o-mini",
                    messages: [{ role: "user", content: prompt }]
                })
            });
            
            if (!aiRes.ok) throw new Error('API Request Failed');
            
            const data = await aiRes.json();
            const content = data.choices[0].message.content.trim();
            const jsonStr = content.replace(/^```(?:json)?|```$/gm, '');
            const cardData = JSON.parse(jsonStr);
            
            if (!cardData.term || !cardData.definition) throw new Error('Invalid AI response format');
            
            // Save to Inbox deck
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
                type: (cardData.term.includes('{{') || cardData.definition.includes('{{')) ? 'cloze' : 'standard'
            });
            
            chrome.notifications.create({
                type: 'basic',
                iconUrl: 'icons/icon128.png',
                title: 'Flashcard Created!',
                message: \`Saved "\${cardData.term}" to Inbox.\`
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
