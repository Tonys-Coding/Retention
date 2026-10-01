/**
 * ai-processor.js — PDF → Flashcards AI Processing
 *
 * Processes PDF text chunks through OpenRouter, writing progress to the
 * storage abstraction layer so the progress banner updates live.
 *
 * Runs in two places:
 *   - Extension: inside the background service worker (js/background.js)
 *   - Web / PWA: directly in the dashboard page (no service worker available)
 *
 * Usage:
 *   import { processPdfChunks } from './ai-processor.js';
 *   processPdfChunks(textChunks, deckName, folderId, { notify });
 */

import { initDB, addDeck, addCard } from './db.js';
import { storage, runtime } from './env.js';
import { requestCompletion, parseAIJson, buildPdfPrompt, PDF_SYSTEM_PROMPT } from './ai.js';

/**
 * @param {string[]} textChunks
 * @param {string} deckName
 * @param {number|null} folderId
 * @param {{ notify?: (title: string, message: string) => void }} [options]
 *   notify — optional system-notification hook (used by the extension)
 */
export async function processPdfChunks(textChunks, deckName, folderId, { notify = () => {} } = {}) {
    const res = await storage.get(['openrouter_api_key', 'ai_focus']);
    const apiKey = res.openrouter_api_key;
    const focus = res.ai_focus || 'general';

    if (!apiKey) {
        notify('Retention API Error', 'Cannot process PDF. Please set your OpenRouter API key.');
        await storage.set({
            pdfProgress: { status: 'error', errorMsg: 'No API key set.', deckName }
        });
        return;
    }

    notify('PDF Processing Started', `Analyzing ${textChunks.length} sections of "${deckName}" in the background...`);

    let allFlashcards = [];

    await storage.set({
        pdfProgress: { status: 'running', current: 0, total: textChunks.length, deckName }
    });

    for (let i = 0; i < textChunks.length; i++) {
        await storage.set({
            pdfProgress: { status: 'running', current: i, total: textChunks.length, deckName }
        });

        const messages = [
            { role: 'system', content: PDF_SYSTEM_PROMPT },
            { role: 'user', content: buildPdfPrompt(textChunks[i], focus) }
        ];

        let retries = 3;
        let success = false;

        while (retries > 0 && !success) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 60000);

                const response = await requestCompletion(apiKey, messages, controller.signal);

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

                    // Hard auth/quota error: abort the entire PDF job
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
                clearTimeout(timeoutId); // Only clear once the BODY is fully received

                try {
                    const chunkCards = parseAIJson(data.choices?.[0]?.message?.content);
                    if (Array.isArray(chunkCards) && chunkCards.length > 0) {
                        allFlashcards = allFlashcards.concat(chunkCards);
                    }
                    success = true;
                } catch (parseErr) {
                    console.warn("JSON parse error on chunk", i);
                    break;
                }

            } catch (networkErr) {
                retries--;
                const isTimeout = networkErr.name === 'AbortError';
                console.warn(isTimeout ? "Timeout on chunk" : "Network error on chunk", i, networkErr);

                // Out of retries on a timeout: fail the whole job so it doesn't hang invisibly
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

    const validCards = allFlashcards.filter(c => c && c.term && c.definition);

    if (validCards.length > 0) {
        try {
            await initDB();
            const finalDeckName = deckName || 'AI Generated Deck';
            const deckId = await addDeck(finalDeckName, folderId);
            for (const card of validCards) {
                await addCard({
                    deckId: deckId,
                    term: card.term,
                    definition: card.definition,
                    status: 'new',
                    type: card.type === 'cloze' ? 'cloze' : 'standard'
                });
            }

            notify('PDF Processing Complete!', `Successfully created ${validCards.length} flashcards in "${finalDeckName}".`);

            // Tell any open UI to refresh
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
        notify('PDF Processing Failed', `Could not generate any flashcards for "${deckName}".`);
        await storage.set({
            pdfProgress: { status: 'error', errorMsg: 'AI returned no usable flashcards. Try a different PDF or try again later.', deckName }
        });
    }
}
