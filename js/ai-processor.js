/**
 * ai-processor.js — AI generation from text chunks (PDFs, pasted notes,
 * selected web text): flashcard decks or practice quiz decks.
 *
 * Processes text chunks through OpenRouter, writing progress to the
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

import { initDB, addDeckWithCards } from './db.js';
import { storage, runtime } from './env.js';
import {
    requestCompletion, parseAIJson, buildPdfPrompt, PDF_SYSTEM_PROMPT,
    buildQuizPrompt, QUIZ_SYSTEM_PROMPT, QUIZ_QUESTION_TYPES, quizCardFromAI
} from './ai.js';

const normalizeQuestion = (text) => String(text).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * @param {string[]} textChunks
 * @param {string} deckName
 * @param {number|null} folderId
 * @param {{ notify?: (title: string, message: string) => void, kind?: 'flashcards'|'quiz',
 *           quiz?: { count?: number|'auto', types?: string[] } }} [options]
 *   notify — optional system-notification hook (used by the extension)
 *   kind   — 'quiz' builds a practice quiz deck instead of flashcards
 *   quiz   — question count ('auto' scales with the material) and question types
 */
export async function processPdfChunks(textChunks, deckName, folderId, { notify = () => {}, kind = 'flashcards', quiz = {} } = {}) {
    const isQuiz = kind === 'quiz';
    const requestedTypes = (quiz.types || []).filter((t) => QUIZ_QUESTION_TYPES.includes(t));
    const quizTypes = requestedTypes.length ? requestedTypes : QUIZ_QUESTION_TYPES;
    const quizCount = Number.isInteger(quiz.count) && quiz.count > 0 ? quiz.count : null;
    // Spread a requested count across chunks; trimmed to the exact count at the end
    const perChunkTarget = quizCount ? Math.max(1, Math.ceil(quizCount / textChunks.length)) : null;
    const unit = isQuiz ? 'questions' : 'flashcards';
    const res = await storage.get(['openrouter_api_key', 'ai_focus']);
    const apiKey = res.openrouter_api_key;
    const focus = res.ai_focus || 'general';

    if (!apiKey) {
        notify('Retention API Error', 'Cannot process PDF. Please set your OpenRouter API key.');
        await storage.set({
            pdfProgress: { status: 'error', errorMsg: 'No API key set.', deckName, kind }
        });
        return;
    }

    notify(isQuiz ? 'Writing Practice Quiz' : 'PDF Processing Started', `Analyzing ${textChunks.length} section${textChunks.length === 1 ? '' : 's'} of "${deckName}" in the background...`);

    let allFlashcards = [];

    await storage.set({
        pdfProgress: { status: 'running', current: 0, total: textChunks.length, deckName, kind }
    });

    for (let i = 0; i < textChunks.length; i++) {
        await storage.set({
            pdfProgress: { status: 'running', current: i, total: textChunks.length, deckName, kind }
        });

        const messages = isQuiz
            ? [
                { role: 'system', content: QUIZ_SYSTEM_PROMPT },
                { role: 'user', content: buildQuizPrompt(textChunks[i], { types: quizTypes, focus, target: perChunkTarget }) }
            ]
            : [
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
                            pdfProgress: { status: 'error', errorMsg: `API Error: ${errMsg}`, deckName, kind }
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
                        pdfProgress: { status: 'error', errorMsg: 'AI model timed out after 60s. The free tier may be heavily congested.', deckName, kind }
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
        pdfProgress: { status: 'saving', current: textChunks.length, total: textChunks.length, deckName, kind }
    });

    let validCards;
    if (isQuiz) {
        // Validate every AI question, drop duplicates across chunks, then trim to the requested count
        const seen = new Set();
        validCards = allFlashcards
            .map((q) => quizCardFromAI(q, quizTypes))
            .filter((c) => {
                if (!c) return false;
                const key = normalizeQuestion(c.term);
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });
        if (quizCount) validCards = validCards.slice(0, quizCount);
    } else {
        validCards = allFlashcards.filter(c => c && c.term && c.definition);
    }

    if (validCards.length > 0) {
        const finalDeckName = deckName || (isQuiz ? 'AI Practice Quiz' : 'AI Generated Deck');
        const cards = isQuiz
            ? validCards.map((card) => ({ ...card, example: '', status: 'new' }))
            : validCards.map((card) => ({
                term: card.term,
                definition: card.definition,
                status: 'new',
                type: card.type === 'cloze' ? 'cloze' : 'standard'
            }));
        // Deck and cards are written in one transaction (nothing half-saved). A
        // failed save is retried once on a fresh database connection.
        const save = async () => {
            await initDB();
            return addDeckWithCards(finalDeckName, folderId ?? null, isQuiz ? 'quiz' : 'flashcards', cards);
        };
        try {
            try {
                await save();
            } catch (e) {
                console.warn('Saving the deck failed, retrying:', e);
                await new Promise(r => setTimeout(r, 500));
                await save();
            }
        } catch (e) {
            console.error("DB Save Error:", e);
            const reason = e?.message || e?.name || String(e);
            notify(isQuiz ? 'Practice Quiz Failed' : 'PDF Processing Failed', `Couldn't save "${finalDeckName}": ${reason}`);
            await storage.set({
                pdfProgress: { status: 'error', errorMsg: `Failed to save to database (${reason}).`, deckName, kind }
            });
            return;
        }

        // Saved: problems from here on (notifications, refreshing open pages) are
        // not save failures, so they must not be reported as one
        try {
            notify(isQuiz ? 'Practice Quiz Ready!' : 'PDF Processing Complete!', `Successfully created ${validCards.length} ${unit} in "${finalDeckName}".`);
        } catch (e) {
            console.error('Notification failed:', e);
        }
        try {
            // Tell any open UI to refresh
            runtime.sendMessage({ action: 'REFRESH_DECKS' });
        } catch (e) {
            console.error('Refreshing open pages failed:', e);
        }
        // Clear progress after a brief pause, unless another job has started since
        setTimeout(async () => {
            const { pdfProgress } = await storage.get(['pdfProgress']);
            if (pdfProgress?.status === 'saving' && pdfProgress.deckName === deckName) await storage.remove('pdfProgress');
        }, 2000);
    } else {
        notify(isQuiz ? 'Practice Quiz Failed' : 'PDF Processing Failed', `Could not generate any ${unit} for "${deckName}".`);
        await storage.set({
            pdfProgress: { status: 'error', errorMsg: `AI returned no usable ${unit}. Try different material or try again later.`, deckName, kind }
        });
    }
}
