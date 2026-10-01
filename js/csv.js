/**
 * csv.js — CSV import/export for flashcard decks and practice quiz decks.
 *
 * Flashcards:  Term, Definition, Type, Example, Status
 * Quiz:        Question, Type, Answer, Choice A … Choice F, Explanation
 *              (a CSV with a Question column becomes a quiz deck)
 */

export const FLASHCARD_CSV_HEADERS = ['Term', 'Definition', 'Type', 'Example', 'Status'];
export const QUIZ_CSV_HEADERS = ['Question', 'Type', 'Answer', 'Choice A', 'Choice B', 'Choice C', 'Choice D', 'Explanation'];

const CHOICE_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

/** Splits CSV text into rows; quoted fields may contain commas, "" and newlines. */
const parseRows = (text) => {
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;
    const src = String(text).replace(/^﻿/, '');
    for (let i = 0; i < src.length; i++) {
        const ch = src[i];
        if (inQuotes) {
            if (ch === '"' && src[i + 1] === '"') { field += '"'; i++; }
            else if (ch === '"') inQuotes = false;
            else field += ch;
        } else if (ch === '"') {
            inQuotes = true;
        } else if (ch === ',') {
            row.push(field.trim()); field = '';
        } else if (ch === '\n' || ch === '\r') {
            if (ch === '\r' && src[i + 1] === '\n') i++;
            row.push(field.trim()); field = '';
            rows.push(row); row = [];
        } else {
            field += ch;
        }
    }
    row.push(field.trim());
    rows.push(row);
    return rows.filter((r) => r.some((cell) => cell !== ''));
};

const headerKey = (h) => String(h).toLowerCase().replace(/[^a-z]/g, '');

// ─── Flashcards ──────────────────────────────────────────────────────
const parseFlashcardRows = (headers, rows) => {
    const col = (name, fallback = -1) => {
        const i = headers.indexOf(name);
        return i === -1 ? fallback : i;
    };
    const c = { term: col('term', 0), definition: col('definition', 1), type: col('type'), example: col('example'), status: col('status') };
    const cards = [];
    for (const r of rows) {
        if (!r[c.term]) continue;
        let type = c.type !== -1 ? (r[c.type] || 'standard').toLowerCase() : 'standard';
        if (type === 'fitb' || type === 'fill-in-the-blank') type = 'cloze';
        if (type !== 'cloze') type = 'standard';
        cards.push({
            term: r[c.term] || '',
            definition: c.definition !== -1 ? (r[c.definition] || '') : '',
            type,
            example: c.example !== -1 ? (r[c.example] || '') : '',
            status: c.status !== -1 ? (r[c.status] || 'new') : 'new'
        });
    }
    return { cards, skipped: 0 };
};

// ─── Practice quiz questions ─────────────────────────────────────────
const QUIZ_TYPE_ALIASES = {
    mcq: 'mcq', mc: 'mcq', multiplechoice: 'mcq', choice: 'mcq',
    tf: 'tf', truefalse: 'tf', trueorfalse: 'tf',
    fitb: 'fitb', fillintheblank: 'fitb', fillintheblanks: 'fitb', blank: 'fitb'
};

const parseTrueFalse = (value) => {
    const v = String(value).trim().toLowerCase();
    if (['true', 't', 'yes', 'y'].includes(v)) return 'true';
    if (['false', 'f', 'no', 'n'].includes(v)) return 'false';
    return null;
};

const parseQuizRows = (headers, rows) => {
    const col = (name) => headers.indexOf(name);
    const c = { question: col('question'), type: col('type'), answer: col('answer'), explanation: col('explanation') };
    // Choice A … Choice F (also accepts Option A … Option F)
    const choiceCols = CHOICE_LETTERS.map((letter) => {
        const l = letter.toLowerCase();
        const i = headers.indexOf(`choice${l}`);
        return i !== -1 ? i : headers.indexOf(`option${l}`);
    });

    const cards = [];
    let skipped = 0;
    for (const r of rows) {
        const question = r[c.question] || '';
        const answerRaw = c.answer !== -1 ? (r[c.answer] || '') : '';
        const explanation = c.explanation !== -1 ? (r[c.explanation] || '') : '';
        const byLetter = choiceCols.map((i) => (i !== -1 ? (r[i] || '').trim() : ''));
        const choices = byLetter.filter(Boolean);

        let type = QUIZ_TYPE_ALIASES[headerKey(c.type !== -1 ? r[c.type] : '')];
        if (!type) type = choices.length ? 'mcq' : (parseTrueFalse(answerRaw) ? 'tf' : 'fitb');

        if (!question || !answerRaw) { skipped++; continue; }

        if (type === 'mcq') {
            // Answer may be a letter (A–F) or the exact text of the correct choice
            const letterIndex = /^[a-f]$/i.test(answerRaw) ? CHOICE_LETTERS.indexOf(answerRaw.toUpperCase()) : -1;
            const correct = letterIndex !== -1
                ? byLetter[letterIndex]
                : choices.find((ch) => ch.toLowerCase() === answerRaw.toLowerCase());
            if (choices.length < 2 || !correct) { skipped++; continue; }
            cards.push({ term: question, definition: correct, type: 'mcq', choices, explanation, example: '', status: 'new' });
        } else if (type === 'tf') {
            const tf = parseTrueFalse(answerRaw);
            if (!tf) { skipped++; continue; }
            cards.push({ term: question, definition: tf, type: 'tf', explanation, example: '', status: 'new' });
        } else {
            cards.push({ term: question, definition: answerRaw, type: 'fitb', explanation, example: '', status: 'new' });
        }
    }
    return { cards, skipped };
};

/**
 * Parses a deck CSV. A Question column means a practice quiz deck.
 * @returns {{ kind: 'flashcards'|'quiz', cards: object[], skipped: number }}
 */
export const parseDeckCSV = (csvText) => {
    const rows = parseRows(csvText);
    if (rows.length < 2) return { kind: 'flashcards', cards: [], skipped: 0 };
    const headers = rows[0].map(headerKey);
    if (headers.includes('question')) return { kind: 'quiz', ...parseQuizRows(headers, rows.slice(1)) };
    return { kind: 'flashcards', ...parseFlashcardRows(headers, rows.slice(1)) };
};

// ─── Export ──────────────────────────────────────────────────────────
const csvCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

const downloadCsv = (fileName, rows) => {
    const csvContent = rows.map((r) => r.map(csvCell).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/** Exports a deck in the same format it imports from (flashcards or quiz). */
export const exportDeckToCSV = (deckName, cards, kind = 'flashcards') => {
    const base = deckName.replace(/\s+/g, '_');
    if (kind === 'quiz') {
        const choiceCount = Math.max(4, ...cards.map((c) => (c.choices || []).length));
        const headers = ['Question', 'Type', 'Answer', ...CHOICE_LETTERS.slice(0, choiceCount).map((l) => `Choice ${l}`), 'Explanation'];
        const rows = cards.map((c) => {
            const choices = c.type === 'mcq' ? (c.choices || []) : [];
            const answer = c.type === 'mcq'
                ? (CHOICE_LETTERS[choices.indexOf(c.definition)] || c.definition)
                : c.type === 'tf' ? (c.definition === 'true' ? 'True' : 'False') : c.definition;
            return [c.term, c.type, answer, ...CHOICE_LETTERS.slice(0, choiceCount).map((_, i) => choices[i] || ''), c.explanation || ''];
        });
        downloadCsv(`${base}_quiz.csv`, [headers, ...rows]);
        return;
    }
    const rows = cards.map((c) => [c.term, c.definition, c.type === 'cloze' ? 'fitb' : 'standard', c.example, c.status || 'new']);
    downloadCsv(`${base}_cards.csv`, [FLASHCARD_CSV_HEADERS, ...rows]);
};
