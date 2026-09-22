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
- Choose to make it a standard card OR a fill-in-the-blank card depending on what fits best.

1. Standard: { "type": "standard", "term": "...", "definition": "..." }
   - The 'term' MUST be phrased as a clear question (e.g., "What is the function of X?", "Define X"). NEVER just output the standalone word.
   - The 'definition' MUST be highly concise (strictly 1-2 short sentences).

2. Fill-in-the-blank: { "type": "cloze", "term": "The complete sentence with the answer included.", "definition": "The exact word to hide." }
   - The 'term' (the full sentence) MUST be highly concise (strictly 1-2 short sentences). DO NOT replace the answer with "___" in the sentence; provide the full intact sentence.
   - The 'definition' (the exact text to hide) MUST be extremely short: 1 to 3 words MAX. Do NOT hide long phrases.

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

// Process PDF Chunks in the background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'PROCESS_PDF_CHUNKS') {
        processPdfChunksInBackground(request.textChunks, request.deckName, request.folderId).catch(console.error);
        sendResponse({status: 'started'});
    }
});

async function processPdfChunksInBackground(textChunks, deckName, folderId) {
    const res = await chrome.storage.local.get(['openrouter_api_key']);
    const apiKey = res.openrouter_api_key;
    
    if (!apiKey) {
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon128.png',
            title: 'Retention API Error',
            message: 'Cannot process PDF. Please set your OpenRouter API key.'
        });
        return;
    }
    
    chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'PDF Processing Started',
        message: `Analyzing ${textChunks.length} sections of "${deckName}" in the background...`
    });

    let allFlashcards = [];
    let successfulChunks = 0;

    await chrome.storage.local.set({ 
        pdfProgress: { status: 'running', current: 0, total: textChunks.length, deckName } 
    });

    for (let i = 0; i < textChunks.length; i++) {
        await chrome.storage.local.set({ 
            pdfProgress: { status: 'running', current: i, total: textChunks.length, deckName } 
        });
        
        const prompt = `Extract the most important concepts, facts, and terms from this text and turn them into flashcards.
Return ONLY a valid JSON array of objects.

Strict Guidelines:
- Focus heavily on actual terms, core concepts, and mechanics. Ignore history and background fluff.
- Scale intelligently: Extract thoroughly for dense texts, but don't over-generate for sparse texts.
- Keep definitions EXTREMELY short. NEVER write a paragraph. 

1. Standard cards: { "type": "standard", "term": "...", "definition": "..." }
   - The 'term' MUST be phrased as a clear question (e.g., "What is the function of X?", "Define X"). NEVER just output the standalone word/concept with no context.
   - The 'definition' MUST be a single ultra-short fragment or sentence (MAXIMUM 15 WORDS). Use extreme brevity.

2. Fill-in-the-blank cards: { "type": "cloze", "term": "The complete sentence with the answer included.", "definition": "The exact word to hide." }
   - The 'term' (the full sentence) MUST be a single short sentence (MAXIMUM 15 WORDS). DO NOT replace the answer with "___".
   - The 'definition' MUST be exactly 1 to 2 words MAX.

Here is the text:\n\n${textChunks[i]}`;

        let retries = 3;
        let success = false;
        
        while (retries > 0 && !success) {
            try {
                const response = await fetch(`https://openrouter.ai/api/v1/chat/completions`, {
                    method: 'POST',
                    headers: { 
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json',
                        'HTTP-Referer': 'https://github.com/Tonys-Coding/Retention',
                        'X-Title': 'Retention Chrome Extension'
                    },
                    body: JSON.stringify({
                        model: "openrouter/free",
                        messages: [
                            { role: "system", content: "You are a helpful assistant that strictly outputs JSON arrays of objects representing flashcards. If no highly-valuable content exists in this text chunk, return an empty array []." },
                            { role: "user", content: prompt }
                        ]
                    })
                });
                
                if (response.status === 429) {
                    retries--;
                    console.warn(`Rate limited (429) on chunk ${i}. Retrying in 5s...`);
                    await new Promise(r => setTimeout(r, 5000));
                    continue;
                }
                
                if (!response.ok) {
                    let errMsg = response.statusText;
                    try {
                        const errData = await response.json();
                        errMsg = errData.error?.message || errMsg;
                    } catch(e) {}
                    
                    // If it's a hard auth/quota error, abort the entire PDF job instantly
                    if (response.status === 401 || response.status === 402 || response.status === 403) {
                        await chrome.storage.local.set({ 
                            pdfProgress: { status: 'error', errorMsg: `API Error: ${errMsg}`, deckName } 
                        });
                        return; // Halt completely
                    }
                    console.warn("Chunk failed:", errMsg);
                    break;
                }
                
                const data = await response.json();
                const textResult = data.choices[0].message.content;
                const cleanText = textResult.replace(/```json/g, '').replace(/```/g, '').trim();
                
                try {
                    const chunkCards = JSON.parse(cleanText);
                    if (Array.isArray(chunkCards) && chunkCards.length > 0) {
                        allFlashcards = allFlashcards.concat(chunkCards);
                    }
                    successfulChunks++;
                    success = true;
                } catch (parseErr) {
                    console.warn("JSON parse error on chunk", i);
                    break; // break retry loop if it's a parsing error
                }
                
            } catch (networkErr) {
                retries--;
                console.warn("Network error on chunk", i, "retrying in 5s...", networkErr);
                await new Promise(r => setTimeout(r, 5000));
            }
        }
        
        // Add a small delay between successful chunks to avoid hitting RPM limits
        if (success && i < textChunks.length - 1) {
            await new Promise(r => setTimeout(r, 2000));
        }
    }
    
    await chrome.storage.local.set({ 
        pdfProgress: { status: 'saving', current: textChunks.length, total: textChunks.length, deckName } 
    });
    
    if (allFlashcards.length > 0) {
        try {
            await initDB();
            const finalDeckName = deckName || 'AI Generated Deck';
            const deckId = await addDeck(finalDeckName, folderId);
            for (const card of allFlashcards) {
                await addCard({
                    deckId: deckId,
                    term: card.term,
                    definition: card.definition,
                    status: 'new',
                    type: card.type === 'cloze' ? 'cloze' : 'standard'
                });
            }
            chrome.notifications.create({
                type: 'basic',
                iconUrl: 'icons/icon128.png',
                title: 'PDF Processing Complete!',
                message: `Successfully created ${allFlashcards.length} flashcards in "${finalDeckName}".`
            });
            chrome.runtime.sendMessage({ action: 'REFRESH_DECKS' }).catch(() => {});
            // Clear progress smoothly
            setTimeout(async () => {
                await chrome.storage.local.remove('pdfProgress');
            }, 2000);
        } catch(e) {
            console.error("DB Save Error:", e);
            await chrome.storage.local.set({ 
                pdfProgress: { status: 'error', errorMsg: 'Failed to save to database.', deckName } 
            });
        }
    } else {
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon128.png',
            title: 'PDF Processing Failed',
            message: `Could not generate any flashcards for "${deckName}".`
        });
        await chrome.storage.local.set({ 
            pdfProgress: { status: 'error', errorMsg: 'API returned empty data. Rate limit or quota exceeded.', deckName } 
        });
    }
}
