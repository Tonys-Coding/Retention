/**
 * ai.js — Shared OpenRouter prompts, model list and request helpers.
 *
 * Used by both the extension's background service worker and the
 * web/PWA in-page processor, so there is a single place to update
 * prompts and models.
 */

// Free models change frequently on OpenRouter. If any of these IDs is
// retired, the request falls back to the `openrouter/free` router, which
// always routes to a currently-available free model.
export const AI_MODELS = [
    'google/gemma-4-31b-it:free',
    'nvidia/nemotron-3-super-120b-a12b:free',
    'qwen/qwen3.8-27b:free'
];
const FALLBACK_MODEL = 'openrouter/free';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

// ─── Focus modifiers (chosen in Settings) ────────────────────────────
export const AI_FOCUS_OPTIONS = {
    general: { label: 'General (Key Terms & Concepts)', instruction: '' },
    dates: { label: 'Dates & Events', instruction: 'Prioritize dates, timelines, historical events, and their significance.' },
    vocabulary: { label: 'Vocabulary / Jargon', instruction: 'Prioritize vocabulary, technical jargon, and precise definitions of terms.' },
    formulas: { label: 'Formulas & Math', instruction: 'Prioritize formulas, equations, units, and what each variable represents.' },
    people: { label: 'People & Quotes', instruction: 'Prioritize key people, what they are known for, and notable quotes.' },
    code: { label: 'Code & Syntax', instruction: 'Prioritize code snippets, syntax, APIs, and what they do.' },
    language: { label: 'Language Translation', instruction: 'Prioritize foreign-language words and phrases with their translations.' }
};

const focusLine = (focus) => {
    const instruction = AI_FOCUS_OPTIONS[focus]?.instruction;
    return instruction ? `- FOCUS: ${instruction}\n` : '';
};

// ─── Prompts ─────────────────────────────────────────────────────────
export const SELECTION_SYSTEM_PROMPT = 'You are a helpful assistant that strictly outputs JSON objects representing flashcards.';

export const buildSelectionPrompt = (text) => `Turn this text into a concise flashcard. Return ONLY a valid JSON object.

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

export const PDF_SYSTEM_PROMPT = 'You are a helpful assistant that strictly outputs JSON arrays of objects representing flashcards. If no highly-valuable content exists in this text chunk, return an empty array [].';

export const buildPdfPrompt = (text, focus) => `Extract the most important concepts, facts, and terms from this text and turn them into flashcards.
Return ONLY a valid JSON array of objects.

Strict Guidelines:
- Focus heavily on actual terms, core concepts, and mechanics. Ignore history and background fluff.
${focusLine(focus)}- Scale intelligently: Extract thoroughly for dense texts, but don't over-generate for sparse texts.
- Keep definitions EXTREMELY short. NEVER write a paragraph.

1. Standard cards: { "type": "standard", "term": "...", "definition": "..." }
   - The 'term' MUST be phrased as a clear question (e.g., "What is the function of X?", "Define X"). NEVER just output the standalone word/concept with no context.
   - The 'definition' MUST be a single ultra-short fragment or sentence (MAXIMUM 15 WORDS). Use extreme brevity.

2. Fill-in-the-blank cards: { "type": "cloze", "term": "The complete sentence with the answer included.", "definition": "The exact word to hide." }
   - The 'term' (the full sentence) MUST be a single short sentence (MAXIMUM 15 WORDS). DO NOT replace the answer with "___".
   - The 'definition' MUST be exactly 1 to 2 words MAX.

Here is the text:\n\n${text}`;

// ─── Requests ────────────────────────────────────────────────────────
const postCompletion = (apiKey, body, signal) => fetch(OPENROUTER_URL, {
    method: 'POST',
    signal,
    headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/Tonys-Coding/Retention',
        'X-Title': 'Retention Flashcards'
    },
    body: JSON.stringify(body)
});

/**
 * POSTs a chat completion, trying AI_MODELS first. A 400/404 (e.g. a
 * retired model ID) is retried once against the `openrouter/free` router.
 * Returns the raw Response so callers can handle status codes themselves.
 */
export const requestCompletion = async (apiKey, messages, signal) => {
    const res = await postCompletion(apiKey, { models: AI_MODELS, messages }, signal);
    if (res.status === 400 || res.status === 404) {
        console.warn(`OpenRouter returned ${res.status} for the model list; retrying with ${FALLBACK_MODEL}`);
        return postCompletion(apiKey, { model: FALLBACK_MODEL, messages }, signal);
    }
    return res;
};

/**
 * Extracts the JSON object/array from a model reply, tolerating
 * markdown code fences or stray text around it.
 */
export const parseAIJson = (content) => {
    const text = (content || '').replace(/```(?:json)?/g, '').trim();
    const start = text.search(/[[{]/);
    const end = Math.max(text.lastIndexOf(']'), text.lastIndexOf('}'));
    if (start === -1 || end < start) throw new Error('AI response did not contain JSON');
    return JSON.parse(text.slice(start, end + 1));
};
