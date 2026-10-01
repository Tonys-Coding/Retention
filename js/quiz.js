/**
 * quiz.js — Quiz engine (no DOM).
 *
 * Builds quiz questions from a deck's or folder's cards, checks answers, and
 * summarizes results. Quizzes are graded practice: they never change card
 * mastery or study stats; their results live in the separate `quizResults`
 * store (see db.js) and feed their own performance metrics.
 *
 * Question types
 *   mc     Multiple choice: the term, pick the definition (or the missing word
 *          of a fill-in-the-blank card). Wrong options come from other cards.
 *   tf     True / false: the term paired with its definition or another card's.
 *   typed  Type the answer: used only when the answer is short enough to type.
 *   fitb   Fill in the blank: fill-in-the-blank cards, typed.
 */

export const QUESTION_TYPES = [
    { id: 'mc', label: 'Multiple choice' },
    { id: 'tf', label: 'True / false' },
    { id: 'typed', label: 'Type the answer' },
    { id: 'fitb', label: 'Fill in the blank' }
];

export const QUICK_QUIZ_SIZE = 10;
const SETTINGS_KEY = 'quiz_settings';
const DEFAULT_SETTINGS = { count: 10, types: QUESTION_TYPES.map((t) => t.id), feedback: 'each' };

// Answers longer than this are too long to type exactly; those cards become
// multiple choice or true/false instead
const TYPED_MAX_WORDS = 4;

// ─── Settings (remembered per device) ────────────────────────────────
export const getQuizSettings = () => {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; } catch { /* ignore */ }
    const types = Array.isArray(saved.types) ? saved.types.filter((t) => QUESTION_TYPES.some((q) => q.id === t)) : [];
    return {
        count: [10, 20, 'all'].includes(saved.count) ? saved.count : DEFAULT_SETTINGS.count,
        types: types.length ? types : DEFAULT_SETTINGS.types,
        feedback: saved.feedback === 'end' ? 'end' : 'each'
    };
};

export const saveQuizSettings = (settings) => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
};

// ─── Answer checking ─────────────────────────────────────────────────
/** Lowercase, strip accents, punctuation, articles and extra spaces. */
export const normalizeAnswer = (text) => String(text ?? '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(the|a|an)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const levenshtein = (a, b) => {
    const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
        let diag = prev[0];
        prev[0] = i;
        for (let j = 1; j <= b.length; j++) {
            const temp = prev[j];
            prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
            diag = temp;
        }
    }
    return prev[b.length];
};

/** Typed answers forgive case, punctuation, accents and small typos. */
export const isTypedAnswerCorrect = (input, answer) => {
    const a = normalizeAnswer(input);
    const b = normalizeAnswer(answer);
    if (!a || !b) return false;
    if (a === b) return true;
    const allowedTypos = b.length <= 4 ? 0 : b.length <= 8 ? 1 : 2;
    return levenshtein(a, b) <= allowedTypos;
};

// ─── Question building ───────────────────────────────────────────────
const shuffle = (items) => {
    const arr = [...items];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
};

const isCloze = (card) => card.type === 'cloze';
const wordCount = (text) => String(text ?? '').trim().split(/\s+/).filter(Boolean).length;

/**
 * Splits a fill-in-the-blank sentence around its blank: { before, after }.
 * Supports sentences written with ___ and sentences that contain the answer.
 */
export const clozeParts = (card) => {
    const sentence = card.term || '';
    const answer = (card.definition || '').trim();
    const underscores = sentence.match(/_{2,}/);
    if (underscores) {
        return { before: sentence.slice(0, underscores.index), after: sentence.slice(underscores.index + underscores[0].length) };
    }
    const index = answer ? sentence.toLowerCase().indexOf(answer.toLowerCase()) : -1;
    if (index >= 0) {
        return { before: sentence.slice(0, index), after: sentence.slice(index + answer.length) };
    }
    return { before: `${sentence} `, after: '' };
};

/** Up to `count` distinct wrong answers for `answer`, preferring `primary`. */
const pickDistractors = (answer, primary, fallback, count) => {
    const answerKey = normalizeAnswer(answer);
    const seen = new Set([answerKey]);
    const picked = [];
    for (const pool of [shuffle(primary), shuffle(fallback)]) {
        for (const value of pool) {
            const key = normalizeAnswer(value);
            if (!key || seen.has(key)) continue;
            seen.add(key);
            picked.push(String(value).trim());
            if (picked.length === count) return picked;
        }
    }
    return picked;
};

const makeQuestion = (card, index, enabled, pools) => {
    const cloze = isCloze(card);
    const answer = (card.definition || '').trim();
    const [localPool, workspacePool] = cloze ? pools.cloze : pools.standard;
    const distractors = pickDistractors(answer, localPool, workspacePool, 3);

    const possible = [];
    if (enabled.has('mc') && distractors.length >= 3) possible.push('mc');
    if (enabled.has('tf') && distractors.length >= 1) possible.push('tf');
    if (cloze && enabled.has('fitb')) possible.push('fitb');
    if (!cloze && enabled.has('typed') && wordCount(answer) <= TYPED_MAX_WORDS) possible.push('typed');
    if (possible.length === 0 || !answer) return null;

    const type = possible[Math.floor(Math.random() * possible.length)];
    const question = {
        id: `${card.id}-${index}`,
        cardId: card.id,
        type,
        cloze,
        term: card.term,
        parts: cloze ? clozeParts(card) : null,
        answer
    };
    if (type === 'mc') {
        question.options = shuffle([answer, ...distractors]);
    } else if (type === 'tf') {
        question.truth = Math.random() < 0.5;
        question.shown = question.truth ? answer : distractors[0];
    }
    return question;
};

/**
 * Builds a quiz.
 * @param {{ cards: object[], workspaceCards: object[], count: number|'all', types: string[] }} options
 *   cards           the deck's or folder's cards (questions come from these)
 *   workspaceCards  every card, used for wrong answers when the deck is small
 */
export const buildQuiz = ({ cards, workspaceCards = [], count, types }) => {
    const enabled = new Set(types);
    const ids = new Set(cards.map((c) => c.id));
    const others = workspaceCards.filter((c) => !ids.has(c.id));
    const pools = {
        standard: [cards.filter((c) => !isCloze(c)).map((c) => c.definition), others.filter((c) => !isCloze(c)).map((c) => c.definition)],
        cloze: [cards.filter(isCloze).map((c) => c.definition), others.filter(isCloze).map((c) => c.definition)]
    };
    const limit = count === 'all' ? Infinity : count;
    const questions = [];
    for (const card of shuffle(cards)) {
        if (questions.length >= limit) break;
        const question = makeQuestion(card, questions.length, enabled, pools);
        if (question) questions.push(question);
    }
    return questions;
};

/** Grades a response: an option string (mc), a boolean (tf) or typed text. */
export const gradeAnswer = (question, response) => {
    if (question.type === 'mc') return response === question.answer;
    if (question.type === 'tf') return response === question.truth;
    return isTypedAnswerCorrect(response, question.answer);
};

// ─── Scoring and metrics ─────────────────────────────────────────────
export const scoreAnswers = (answers) => {
    const correct = answers.filter((a) => a.correct).length;
    const total = answers.length;
    return { correct, total, percent: total ? Math.round((correct / total) * 100) : 0 };
};

/**
 * Quiz performance for a set of saved results (optionally one deck/folder):
 * attempts, average and best score, and the most recent attempts.
 */
export const summarizeQuizResults = (results, source = null) => {
    const relevant = results
        .filter((r) => !source || (r.sourceType === source.type && r.sourceId === source.id))
        .sort((a, b) => new Date(b.finishedAt) - new Date(a.finishedAt));
    if (relevant.length === 0) return { attempts: 0, average: null, best: null, last: null, recent: [] };
    const percents = relevant.map((r) => r.percent);
    return {
        attempts: relevant.length,
        average: Math.round(percents.reduce((sum, p) => sum + p, 0) / percents.length),
        best: Math.max(...percents),
        last: relevant[0],
        recent: relevant.slice(0, 5)
    };
};
