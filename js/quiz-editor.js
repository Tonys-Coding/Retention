/**
 * quiz-editor.js — Edit Questions for practice quiz decks (dashboard).
 *
 * Lists a quiz deck's questions and provides the Add / Edit question form for
 * the three question types: multiple choice (mcq), true / false (tf) and
 * fill in the blank (fitb). Reuses the deck editor's card rows and Add Card
 * panel styling.
 */

import { getCardsByDeck, addCard, updateCard, deleteCard } from './db.js';
import { escapeHtml } from './utils.js';

const TYPES = [
    { id: 'mcq', label: 'Multiple Choice', short: 'mcq' },
    { id: 'tf', label: 'True / False', short: 'true/false' },
    { id: 'fitb', label: 'Fill in the Blank', short: 'fitb' }
];
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
const MAX_CHOICES = 6;
const MIN_CHOICES = 2;

const ICON_EDIT = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>';
const ICON_TRASH = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';

const answerSummary = (q) => {
    if (q.type === 'tf') return `Answer: ${q.definition === 'true' ? 'True' : 'False'}`;
    if (q.type === 'mcq') return `Answer: ${LETTERS[(q.choices || []).indexOf(q.definition)] || '?'}. ${q.definition}`;
    return `Answer: ${String(q.definition).split('|').map((a) => a.trim()).join(' / ')}`;
};

const blankForm = (type = 'mcq') => ({
    type,
    question: '',
    choices: ['', '', '', ''],
    correctIndex: null,
    tf: null,
    answer: '',
    explanation: ''
});

const formFromQuestion = (q) => ({
    type: q.type,
    question: q.term || '',
    choices: q.type === 'mcq' ? [...(q.choices || [])] : ['', '', '', ''],
    correctIndex: q.type === 'mcq' ? (q.choices || []).indexOf(q.definition) : null,
    tf: q.type === 'tf' ? q.definition : null,
    answer: q.type === 'fitb' ? q.definition : '',
    explanation: q.explanation || ''
});

/**
 * Renders the question list and Add/Edit form for a quiz deck.
 * @param {HTMLElement} container
 * @param {{ deck: { id: number, name: string }, confirm: (message: string) => Promise<boolean>,
 *           toast: (message: string) => void, onChange?: (questionCount: number) => void }} options
 */
export async function renderQuizEditor(container, { deck, confirm, toast, onChange }) {
    const s = { container, deck, confirm, toast, onChange, questions: [], editingId: null, form: blankForm(), error: '' };
    container.onclick = (e) => onClick(s, e);
    container.oninput = (e) => onInput(s, e);
    container.onchange = (e) => onInput(s, e);
    await reload(s);
}

async function reload(s) {
    const cards = await getCardsByDeck(s.deck.id);
    s.questions = cards.filter((c) => TYPES.some((t) => t.id === c.type)).sort((a, b) => a.id - b.id);
    s.onChange?.(s.questions.length);
    render(s);
}

function listHtml(s) {
    if (s.questions.length === 0) {
        return '<div class="db-empty"><h3>No questions yet</h3><p>Add your first question below, or import a quiz CSV.</p></div>';
    }
    return s.questions.map((q, i) => `
        <div class="db-card-row${s.editingId === q.id ? ' qe-row--editing' : ''}">
            <div class="db-card-row-content">
                <div class="db-card-row-term">${i + 1}. ${escapeHtml(q.term)} <span class="pill">${TYPES.find((t) => t.id === q.type).short}</span></div>
                <div class="db-card-row-def">${escapeHtml(answerSummary(q))}</div>
            </div>
            <div class="db-card-row-actions">
                <button type="button" class="icon-btn" data-action="edit" data-id="${q.id}" title="Edit" aria-label="Edit question ${i + 1}">${ICON_EDIT}</button>
                <button type="button" class="icon-btn" data-action="delete" data-id="${q.id}" title="Delete" aria-label="Delete question ${i + 1}" style="color:#ff4444;">${ICON_TRASH}</button>
            </div>
        </div>`).join('');
}

function fieldsHtml(f) {
    if (f.type === 'mcq') {
        return `
            <fieldset class="qe-choices">
                <legend class="qe-label">Choices: select the correct answer</legend>
                ${f.choices.map((choice, i) => `
                    <div class="qe-choice">
                        <input type="radio" name="qe-correct" value="${i}" ${f.correctIndex === i ? 'checked' : ''} aria-label="Choice ${LETTERS[i]} is correct">
                        <span class="qe-letter" aria-hidden="true">${LETTERS[i]}</span>
                        <input type="text" class="qe-choice-text" data-index="${i}" value="${escapeHtml(choice)}" placeholder="Choice ${LETTERS[i]}" aria-label="Choice ${LETTERS[i]}">
                        ${f.choices.length > MIN_CHOICES ? `<button type="button" class="icon-btn qe-remove" data-action="remove-choice" data-index="${i}" aria-label="Remove choice ${LETTERS[i]}">✕</button>` : ''}
                    </div>`).join('')}
                ${f.choices.length < MAX_CHOICES ? '<button type="button" class="secondary qe-add-choice" data-action="add-choice">+ Add choice</button>' : ''}
            </fieldset>`;
    }
    if (f.type === 'tf') {
        return `
            <div class="qe-field">
                <span class="qe-label" id="qe-tf-label">Correct answer</span>
                <div class="card-mode-toggle" role="group" aria-labelledby="qe-tf-label">
                    <button type="button" class="mode-btn${f.tf === 'true' ? ' active' : ''}" data-action="tf" data-value="true" aria-pressed="${f.tf === 'true'}">True</button>
                    <button type="button" class="mode-btn${f.tf === 'false' ? ' active' : ''}" data-action="tf" data-value="false" aria-pressed="${f.tf === 'false'}">False</button>
                </div>
            </div>`;
    }
    return `
        <div class="qe-field">
            <label class="qe-label" for="qe-answer">Answer</label>
            <input type="text" id="qe-answer" data-field="answer" value="${escapeHtml(f.answer)}" placeholder="Word(s) that fill the blank">
            <p class="qe-hint">Write ___ where the blank goes, or include the answer in the question. Separate other accepted answers with | (e.g. TCP|Transmission Control Protocol).</p>
        </div>`;
}

function formHtml(s) {
    const f = s.form;
    const editingIndex = s.questions.findIndex((q) => q.id === s.editingId);
    return `
        <div class="db-add-card qe-form">
            <h3 style="margin:0 0 12px 0;font-size:18px;font-weight:900;text-transform:uppercase;">${editingIndex >= 0 ? `Edit Question ${editingIndex + 1}` : 'Add Question'}</h3>
            <div class="card-mode-toggle qe-types" role="group" aria-label="Question type" style="margin-bottom:16px;">
                ${TYPES.map((t) => `<button type="button" class="mode-btn${f.type === t.id ? ' active' : ''}" data-action="type" data-value="${t.id}" aria-pressed="${f.type === t.id}">${t.label}</button>`).join('')}
            </div>
            <div class="qe-field">
                <label class="qe-label" for="qe-question">${f.type === 'fitb' ? 'Sentence' : f.type === 'tf' ? 'Statement' : 'Question'}</label>
                <textarea id="qe-question" data-field="question" rows="3" placeholder="${f.type === 'fitb' ? 'e.g. TCP uses a three-way ___ to open connections.' : f.type === 'tf' ? 'e.g. UDP guarantees delivery.' : 'e.g. Which protocol guarantees ordered delivery?'}">${escapeHtml(f.question)}</textarea>
            </div>
            ${fieldsHtml(f)}
            <div class="qe-field">
                <label class="qe-label" for="qe-explanation">Explanation (optional)</label>
                <input type="text" id="qe-explanation" data-field="explanation" value="${escapeHtml(f.explanation)}" placeholder="Shown after the question is answered">
            </div>
            <p class="qe-error" role="alert"${s.error ? '' : ' hidden'}>${escapeHtml(s.error)}</p>
            <div class="qe-actions">
                ${editingIndex >= 0 ? '<button type="button" data-action="cancel-edit">Cancel</button>' : ''}
                <button type="button" class="primary" data-action="save">${editingIndex >= 0 ? 'Save Question' : 'Add Question'}</button>
            </div>
        </div>`;
}

function render(s) {
    s.container.innerHTML = `<div class="db-deck-cards">${listHtml(s)}</div>${formHtml(s)}`;
}

function validate(f) {
    const question = f.question.trim();
    if (!question) return { error: 'Write the question first.' };
    const explanation = f.explanation.trim();
    if (f.type === 'mcq') {
        const choices = f.choices.map((c) => c.trim());
        const filled = choices.filter(Boolean);
        if (filled.length < MIN_CHOICES) return { error: 'Add at least two choices.' };
        if (new Set(filled.map((c) => c.toLowerCase())).size !== filled.length) return { error: 'Each choice must be different.' };
        if (f.correctIndex === null || !choices[f.correctIndex]) return { error: 'Select the correct choice.' };
        return { card: { term: question, definition: choices[f.correctIndex], type: 'mcq', choices: filled, explanation } };
    }
    if (f.type === 'tf') {
        if (!f.tf) return { error: 'Choose whether the statement is True or False.' };
        return { card: { term: question, definition: f.tf, type: 'tf', explanation } };
    }
    const answer = f.answer.trim();
    if (!answer) return { error: 'Add the answer that fills the blank.' };
    return { card: { term: question, definition: answer, type: 'fitb', explanation } };
}

async function onClick(s, e) {
    const btn = e.target.closest('[data-action]');
    if (!btn || !s.container.contains(btn)) return;
    const { action, value, id, index } = btn.dataset;
    const f = s.form;
    switch (action) {
        case 'type':
            f.type = value;
            s.error = '';
            render(s);
            s.container.querySelector('#qe-question')?.focus();
            break;
        case 'tf':
            f.tf = value;
            render(s);
            break;
        case 'add-choice':
            if (f.choices.length < MAX_CHOICES) f.choices.push('');
            render(s);
            s.container.querySelector(`.qe-choice-text[data-index="${f.choices.length - 1}"]`)?.focus();
            break;
        case 'remove-choice': {
            const i = Number(index);
            f.choices.splice(i, 1);
            if (f.correctIndex === i) f.correctIndex = null;
            else if (f.correctIndex > i) f.correctIndex -= 1;
            render(s);
            break;
        }
        case 'edit': {
            const q = s.questions.find((x) => String(x.id) === id);
            s.editingId = q.id;
            s.form = formFromQuestion(q);
            s.error = '';
            render(s);
            s.container.querySelector('.qe-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            s.container.querySelector('#qe-question')?.focus({ preventScroll: true });
            break;
        }
        case 'cancel-edit':
            s.editingId = null;
            s.form = blankForm(f.type);
            s.error = '';
            render(s);
            break;
        case 'delete': {
            const q = s.questions.find((x) => String(x.id) === id);
            if (await s.confirm(`Delete question "${q.term.substring(0, 60)}"?`)) {
                await deleteCard(q.id);
                if (s.editingId === q.id) { s.editingId = null; s.form = blankForm(); }
                await reload(s);
            }
            break;
        }
        case 'save': {
            const { card, error } = validate(f);
            if (error) {
                s.error = error;
                render(s);
                return;
            }
            if (s.editingId) {
                const existing = s.questions.find((q) => q.id === s.editingId);
                await updateCard({ ...existing, ...card });
                s.toast('Question saved');
            } else {
                await addCard({ ...card, deckId: s.deck.id, example: '', status: 'new' });
                s.toast('Question added');
            }
            s.editingId = null;
            s.form = blankForm(f.type);
            s.error = '';
            await reload(s);
            s.container.querySelector('#qe-question')?.focus({ preventScroll: true });
            break;
        }
        default:
            break;
    }
}

// Keeps form state in sync as you type, without re-rendering (so focus stays put)
function onInput(s, e) {
    const t = e.target;
    const f = s.form;
    if (t.dataset.field) f[t.dataset.field] = t.value;
    else if (t.classList.contains('qe-choice-text')) f.choices[Number(t.dataset.index)] = t.value;
    else if (t.name === 'qe-correct') f.correctIndex = Number(t.value);
}
