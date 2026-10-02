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

// ─── Practice quiz generation ────────────────────────────────────────
export const QUIZ_QUESTION_TYPES = ['mcq', 'tf', 'fitb'];

export const QUIZ_SYSTEM_PROMPT = 'You are a helpful assistant that writes practice test questions and strictly outputs a JSON array of question objects. If the text contains nothing worth testing, return an empty array [].';

const QUIZ_TYPE_RULES = {
    mcq: `Multiple choice: {"type":"mcq","question":"...","choices":["...","...","...","..."],"answer":"B","explanation":"..."}
   - Exactly 4 choices: ONE correct and three plausible wrong choices of similar length, style and specificity.
   - "answer" is the LETTER (A-D) of the correct choice. Vary which letter is correct.
   - No "all of the above" / "none of the above". Don't make the correct choice the longest one by habit.`,
    tf: `True / false: {"type":"tf","statement":"...","answer":true,"explanation":"..."}
   - A single factual statement (not a question). "answer" is true or false.
   - Mix true and false. Make false statements plausible by changing ONE key detail (a term, number, or relationship).`,
    fitb: `Fill in the blank: {"type":"fitb","sentence":"... ___ ...","answer":"...","alternatives":["..."],"explanation":"..."}
   - One sentence (MAXIMUM 20 WORDS) with ___ where the missing 1 to 3 word(s) go.
   - "answer" is the missing word(s). "alternatives" lists other correct spellings or synonyms (may be empty).
   - Blank out a key term, never a filler word.`
};

const TYPE_NAMES = { mcq: 'multiple choice', tf: 'true / false', fitb: 'fill in the blank' };

/**
 * Prompt for one chunk of a practice quiz.
 * @param {string} text
 * @param {{ types: string[], focus?: string, target?: number|null }} options
 *   target  questions wanted from this chunk (null = scale with the material)
 */
export const buildQuizPrompt = (text, { types, focus, target }) => {
    const allowed = QUIZ_QUESTION_TYPES.filter((t) => types.includes(t));
    const mix = allowed.length > 1
        ? `- Mix these types: ${allowed.map((t) => TYPE_NAMES[t]).join(', ')}${allowed.includes('mcq') ? ' (about 60% multiple choice)' : ''}.\n`
        : `- Use ONLY ${TYPE_NAMES[allowed[0]]} questions.\n`;
    const amount = target
        ? `- Write exactly ${target} question${target === 1 ? '' : 's'} (fewer only if the text truly cannot support that many).\n`
        : '- Scale with the material: about one question per key concept, at most 15 for this text.\n';
    return `Write practice test questions that check understanding of this text. Return ONLY a valid JSON array of question objects.

Strict Guidelines:
- Test key concepts, terms, facts and mechanics. Skip trivia, page numbers and background fluff.
- Every question must be answerable from the text alone, and must make sense on its own (never "according to the text" or "in this passage").
- Each question tests a different idea; no duplicates or near-duplicates.
${focusLine(focus)}${mix}${amount}- "explanation" is one short sentence saying why the answer is correct.

Question formats:
${allowed.map((t, i) => `${i + 1}. ${QUIZ_TYPE_RULES[t]}`).join('\n\n')}

Here is the text:\n\n${text}`;
};

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
const norm = (value) => String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * Validates one AI-written question and converts it to a quiz card
 * ({ term, definition, type, choices?, explanation }), or null if unusable.
 */
export const quizCardFromAI = (q, allowedTypes = QUIZ_QUESTION_TYPES) => {
    if (!q || typeof q !== 'object') return null;
    const type = String(q.type || '').toLowerCase().replace(/[^a-z]/g, '');
    const kind = { mcq: 'mcq', multiplechoice: 'mcq', tf: 'tf', truefalse: 'tf', fitb: 'fitb', fillintheblank: 'fitb' }[type];
    if (!kind || !allowedTypes.includes(kind)) return null;
    const explanation = typeof q.explanation === 'string' ? q.explanation.trim() : '';

    if (kind === 'mcq') {
        const question = String(q.question || '').trim();
        const choices = Array.isArray(q.choices) ? q.choices.map((c) => String(c ?? '').trim()).filter(Boolean) : [];
        // Choices must be distinct, 2-6 of them, and the answer must point at one
        if (!question || choices.length < 2 || choices.length > 6) return null;
        if (new Set(choices.map(norm)).size !== choices.length) return null;
        let correct = null;
        const answer = q.answer;
        if (typeof answer === 'string' && /^[a-f]$/i.test(answer.trim())) correct = choices[LETTERS.indexOf(answer.trim().toUpperCase())];
        else if (typeof answer === 'number' && Number.isInteger(answer)) correct = choices[answer];
        else if (typeof answer === 'string') correct = choices.find((c) => norm(c) === norm(answer));
        if (!correct) return null;
        return { term: question, definition: correct, type: 'mcq', choices, explanation };
    }

    if (kind === 'tf') {
        const statement = String(q.statement || q.question || '').trim();
        const a = typeof q.answer === 'string' ? q.answer.trim().toLowerCase() : q.answer;
        const value = a === true || a === 'true' || a === 't' ? 'true' : a === false || a === 'false' || a === 'f' ? 'false' : null;
        if (!statement || !value) return null;
        return { term: statement, definition: value, type: 'tf', explanation };
    }

    const sentence = String(q.sentence || q.question || '').trim();
    const answer = String(q.answer ?? '').trim();
    if (!sentence || !answer || answer.split(/\s+/).length > 4) return null;
    // The blank has to be visible: either ___ or the answer itself appears in the sentence
    if (!/_{2,}/.test(sentence) && !sentence.toLowerCase().includes(answer.toLowerCase())) return null;
    const alternatives = Array.isArray(q.alternatives)
        ? q.alternatives.map((a) => String(a ?? '').trim()).filter((a) => a && norm(a) !== norm(answer))
        : [];
    return { term: sentence, definition: [answer, ...new Set(alternatives)].join('|'), type: 'fitb', explanation };
};

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
 * `options` is merged into the request body (e.g. { stream: true }).
 */
export const requestCompletion = async (apiKey, messages, signal, options = {}) => {
    const res = await postCompletion(apiKey, { models: AI_MODELS, messages, ...options }, signal);
    if (res.status === 400 || res.status === 404) {
        console.warn(`OpenRouter returned ${res.status} for the model list; retrying with ${FALLBACK_MODEL}`);
        return postCompletion(apiKey, { model: FALLBACK_MODEL, messages, ...options }, signal);
    }
    return res;
};

/**
 * Reads the reply text from a completion requested with { stream: true }.
 * Streaming keeps data flowing while a slow model writes (OpenRouter also
 * sends keep-alive comments while it waits), which keeps the extension's
 * background worker alive and lets the UI show progress.
 *   onActivity  called whenever any data arrives (including keep-alives)
 *   onText      called with the reply length so far
 * Falls back to a regular JSON body if the server didn't stream.
 */
export const readCompletionText = async (response, { onActivity = () => {}, onText = () => {} } = {}) => {
    const type = response.headers.get('content-type') || '';
    if (!type.includes('text/event-stream') || !response.body) {
        const data = await response.json();
        if (data.error) throw new Error(data.error.message || 'The AI provider returned an error.');
        return data.choices?.[0]?.message?.content ?? '';
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let content = '';
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        onActivity();
        buffer += decoder.decode(value, { stream: true });
        let newline;
        while ((newline = buffer.indexOf('\n')) !== -1) {
            const line = buffer.slice(0, newline).trim();
            buffer = buffer.slice(newline + 1);
            if (!line.startsWith('data:')) continue; // blank lines and ": keep-alive" comments
            const payload = line.slice(5).trim();
            if (payload === '[DONE]') return content;
            let event;
            try { event = JSON.parse(payload); } catch { continue; }
            if (event.error) throw new Error(event.error.message || 'The AI provider returned an error.');
            const delta = event.choices?.[0]?.delta?.content;
            if (delta) {
                content += delta;
                onText(content.length);
            }
        }
    }
    return content;
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
