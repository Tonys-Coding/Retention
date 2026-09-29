/**
 * ai-processor.js — Web-based PDF AI Processing
 * 
 * When running on the open web (not inside the Chrome Extension),
 * there is no background service worker to offload AI generation to.
 * This module processes PDF text chunks directly in the page,
 * writing progress to the storage abstraction layer so the
 * progress banner updates live — exactly like the extension does.
 * 
 * Usage (from dashboard.js):
 *   import { processChunksInPage } from './ai-processor.js';
 *   processChunksInPage(textChunks, deckName, folderId);
 */

import { initDB, addDeck, addCard } from './db.js';
import { storage, runtime } from './env.js';

export async function processChunksInPage(textChunks, deckName, folderId) {
    const res = await storage.get(['openrouter_api_key']);
    const apiKey = res.openrouter_api_key;

    if (!apiKey) {
        await storage.set({
            pdfProgress: { status: 'error', errorMsg: 'No API key set.', deckName }
        });
        return;
    }

    let allFlashcards = [];
    let successfulChunks = 0;

    await storage.set({
        pdfProgress: { status: 'running', current: 0, total: textChunks.length, deckName }
    });

    for (let i = 0; i < textChunks.length; i++) {
        await storage.set({
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
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 60000);

                const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                    method: 'POST',
                    signal: controller.signal,
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json',
                        'HTTP-Referer': 'https://github.com/Tonys-Coding/Retention',
                        'X-Title': 'Retention Flashcards'
                    },
                    body: JSON.stringify({
                        models: [
                            "google/gemini-2.0-flash-lite-preview-02-05:free",
                            "meta-llama/llama-3.1-8b-instruct:free",
                            "meta-llama/llama-3-8b-instruct:free",
                            "mistralai/mistral-7b-instruct:free"
                        ],
                        messages: [
                            { role: "system", content: "You are a helpful assistant that strictly outputs JSON arrays of objects representing flashcards. If no highly-valuable content exists in this text chunk, return an empty array []." },
                            { role: "user", content: prompt }
                        ]
                    })
                });

                if (response.status === 429) {
                    clearTimeout(timeoutId);
                    retries--;
                    console.warn(`Rate limited (429) on chunk ${i}. Retrying in 5s...`);
                    await new Promise(r => setTimeout(r, 5000));
                    continue;
                }

                if (!response.ok) {
                    clearTimeout(timeoutId);
                    let errMsg = response.statusText;
                    try {
                        const errData = await response.json();
                        errMsg = errData.error?.message || errMsg;
                    } catch (e) { /* ignore */ }

                    if (response.status === 401 || response.status === 402 || response.status === 403) {
                        await storage.set({
                            pdfProgress: { status: 'error', errorMsg: `API Error: ${errMsg}`, deckName }
                        });
                        return;
                    }
                    console.warn("Chunk failed:", errMsg);
                    break;
                }

                const data = await response.json();
                clearTimeout(timeoutId);

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
                    break;
                }

            } catch (networkErr) {
                retries--;
                const isTimeout = networkErr.name === 'AbortError';
                console.warn(isTimeout ? "Timeout on chunk" : "Network error on chunk", i, networkErr);

                if (retries === 0 && isTimeout) {
                    await storage.set({
                        pdfProgress: { status: 'error', errorMsg: 'AI model timed out after 60s. The free tier may be heavily congested.', deckName }
                    });
                    return;
                }

                await new Promise(r => setTimeout(r, 5000));
            }
        }

        // Delay between chunks to avoid RPM limits
        if (success && i < textChunks.length - 1) {
            await new Promise(r => setTimeout(r, 2000));
        }
    }

    // ─── Save to IndexedDB ───────────────────────────────────────────
    await storage.set({
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

            // Tell the dashboard to refresh
            runtime.sendMessage({ action: 'REFRESH_DECKS' });

            // Clear progress after a brief pause
            setTimeout(async () => {
                await storage.remove('pdfProgress');
            }, 2000);

        } catch (e) {
            console.error("DB Save Error:", e);
            await storage.set({
                pdfProgress: { status: 'error', errorMsg: 'Failed to save to database.', deckName }
            });
        }
    } else {
        await storage.set({
            pdfProgress: { status: 'error', errorMsg: 'AI returned no usable flashcards. Try a different PDF or try again later.', deckName }
        });
    }
}
