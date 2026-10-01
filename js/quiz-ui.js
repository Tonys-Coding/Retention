/**
 * quiz-ui.js — Quiz screens, shared by the dashboard (web + mobile) and the
 * extension popup's Quick Quiz.
 *
 *   setup     full quiz: question count, question types, when to show answers,
 *             and this deck/folder's quiz performance
 *   intro     Quick Quiz (popup): 10 questions, all types; only the answers setting
 *   question  one question at a time; answers shown after each or at the end
 *   results   score, time, best score, per-question review, retry missed
 *
 * Results are saved to the separate quizResults store; quizzes never change
 * card mastery or study stats.
 */

import { getCardsByDeck, getCardsByFolder, getAllCards, getQuizResults, addQuizResult, updateQuizResult } from './db.js';
import {
    QUESTION_TYPES, QUICK_QUIZ_SIZE, getQuizSettings, saveQuizSettings, buildQuiz,
    gradeAnswer, scoreAnswers, summarizeQuizResults
} from './quiz.js';
import { escapeHtml } from './utils.js';

const TYPE_LABELS = Object.fromEntries(QUESTION_TYPES.map((t) => [t.id, t.label]));
const ALL_TYPES = QUESTION_TYPES.map((t) => t.id);

// Card text supports Markdown, like the rest of the app
const rich = (text) => (typeof marked !== 'undefined' ? marked.parse(String(text ?? '')) : `<p>${escapeHtml(text)}</p>`);
const inline = (text) => (typeof marked !== 'undefined' && marked.parseInline ? marked.parseInline(String(text ?? '')) : escapeHtml(text));

const formatDuration = (ms) => {
    const total = Math.max(1, Math.round(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return m ? `${m}m ${s}s` : `${s}s`;
};
const formatDate = (iso) => new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });

let activeSession = null;
let keyListenerInstalled = false;

/**
 * Starts a quiz in `container`.
 * @param {HTMLElement} container
 * @param {{ source: { type: 'deck'|'folder', id: number, name: string }, quick?: boolean,
 *           onExit: () => void, onOpenDashboard?: () => void }} options
 */
export async function startQuiz(container, { source, quick = false, onExit, onOpenDashboard }) {
    const session = {
        container, source, quick, onExit, onOpenDashboard,
        phase: 'loading',
        settings: getQuizSettings(),
        questions: [], index: 0, answers: [],
        revealed: false, practice: false, record: null, error: ''
    };
    if (quick) session.settings = { ...session.settings, count: QUICK_QUIZ_SIZE, types: ALL_TYPES };
    activeSession = session;
    container.innerHTML = '<p class="qz-loading">Loading quiz…</p>';
    container.onclick = (e) => handleClick(session, e);
    container.onsubmit = (e) => handleSubmit(session, e);
    if (!keyListenerInstalled) {
        document.addEventListener('keydown', onKeyDown);
        keyListenerInstalled = true;
    }

    const [cards, workspaceCards, results] = await Promise.all([
        source.type === 'folder' ? getCardsByFolder(source.id) : getCardsByDeck(source.id),
        getAllCards(),
        getQuizResults()
    ]);
    if (activeSession !== session) return;
    session.cards = cards;
    session.workspaceCards = workspaceCards;
    session.history = summarizeQuizResults(results, source);
    session.phase = cards.length === 0 ? 'empty' : (quick ? 'intro' : 'setup');
    render(session);
}

// ─── Rendering ───────────────────────────────────────────────────────
function render(s) {
    if (s.phase === 'empty') renderEmpty(s);
    else if (s.phase === 'setup' || s.phase === 'intro') renderSetup(s);
    else if (s.phase === 'question') renderQuestion(s);
    else if (s.phase === 'results') renderResults(s);
}

const pill = (action, value, label, pressed) =>
    `<button type="button" class="qz-pill" data-action="${action}" data-value="${value}" aria-pressed="${pressed}">${label}</button>`;

function historySummary(h) {
    if (!h.attempts) return '';
    return `Best ${h.best}% · Average ${h.average}% · ${h.attempts} quiz${h.attempts === 1 ? '' : 'zes'}`;
}

function renderSetup(s) {
    const { settings, history, quick } = s;
    const n = s.cards.length;
    const countOptions = [10, 20, 'all'].map((c) => pill('count', c, c === 'all' ? `All (${n})` : String(c), settings.count === c)).join('');
    const typeOptions = QUESTION_TYPES.map((t) => pill('type', t.id, t.label, settings.types.includes(t.id))).join('');
    const feedbackOptions = pill('feedback', 'each', 'After each question', settings.feedback === 'each') +
        pill('feedback', 'end', 'At the end', settings.feedback === 'end');

    const historyPanel = quick ? '' : `
        <section class="qz-panel qz-history" aria-labelledby="qz-history-title">
            <h3 id="qz-history-title" class="qz-h3">Quiz performance</h3>
            ${history.attempts ? `
                <div class="qz-stats">
                    <div class="qz-stat"><span class="qz-stat-value">${history.attempts}</span><span class="qz-stat-label">Quizzes</span></div>
                    <div class="qz-stat"><span class="qz-stat-value">${history.average}%</span><span class="qz-stat-label">Average</span></div>
                    <div class="qz-stat"><span class="qz-stat-value">${history.best}%</span><span class="qz-stat-label">Best</span></div>
                </div>
                <ol class="qz-recent" aria-label="Recent quizzes">
                    ${history.recent.map((r) => `<li><span>${formatDate(r.finishedAt)}</span><span class="qz-recent-bar" aria-hidden="true"><span style="width:${r.percent}%"></span></span><strong>${r.percent}%</strong></li>`).join('')}
                </ol>` : '<p class="qz-sub">No quizzes yet. Your scores will show up here.</p>'}
        </section>`;

    s.container.innerHTML = `
        <div class="qz qz-setup">
            <section class="qz-panel" aria-labelledby="qz-setup-title">
                <div class="qz-head">
                    <h2 id="qz-setup-title" class="qz-title">${quick ? 'Quick Quiz' : 'Quiz'}: ${escapeHtml(s.source.name)}</h2>
                    <p class="qz-sub">${n} card${n === 1 ? '' : 's'}${quick ? ` · ${QUICK_QUIZ_SIZE} questions · all question types` : ''}</p>
                    ${quick && history.attempts ? `<p class="qz-sub">${historySummary(history)}</p>` : ''}
                </div>
                ${quick ? '' : `
                    <fieldset class="qz-group"><legend>Questions</legend><div class="qz-pills">${countOptions}</div></fieldset>
                    <fieldset class="qz-group"><legend>Question types</legend><div class="qz-pills">${typeOptions}</div></fieldset>`}
                <fieldset class="qz-group"><legend>Show answers</legend><div class="qz-pills">${feedbackOptions}</div></fieldset>
                <p class="qz-note">Quiz scores are tracked separately and never change your card mastery.</p>
                <p class="qz-error" role="alert"${s.error ? '' : ' hidden'}>${escapeHtml(s.error)}</p>
                <button type="button" class="primary qz-start" data-action="start">Start quiz</button>
            </section>
            ${historyPanel}
        </div>`;
}

function renderEmpty(s) {
    s.container.innerHTML = `
        <div class="qz">
            <section class="qz-panel">
                <h2 class="qz-title">Nothing to quiz yet</h2>
                <p class="qz-sub">${escapeHtml(s.source.name)} has no cards. Add a few cards first.</p>
                <button type="button" class="primary qz-start" data-action="done">Back</button>
            </section>
        </div>`;
}

const clozeSentence = (q, fill) =>
    `${escapeHtml(q.parts.before)}${fill}${escapeHtml(q.parts.after)}`;

function promptHtml(q) {
    if (q.cloze) {
        const fill = q.type === 'tf'
            ? `<mark class="qz-fill">${escapeHtml(q.shown)}</mark>`
            : '<span class="qz-blank" role="img" aria-label="blank"></span>';
        const ask = q.type === 'tf' ? '<p class="qz-ask">Is the highlighted word correct?</p>' : '';
        return `<p class="qz-cloze">${clozeSentence(q, fill)}</p>${ask}`;
    }
    const statement = q.type === 'tf'
        ? `<div class="qz-statement"><span class="qz-statement-label">Definition</span><div>${inline(q.shown)}</div></div><p class="qz-ask">Is this the right definition?</p>`
        : '';
    return `<div class="qz-term">${rich(q.term)}</div>${statement}`;
}

function optionState(q, answer, value) {
    if (!answer) return '';
    const isAnswer = q.type === 'mc' ? value === q.answer : value === q.truth;
    const isPicked = answer.response === value;
    if (isAnswer) return ' is-correct';
    if (isPicked) return ' is-wrong';
    return '';
}

function answersHtml(s, q, answer) {
    const locked = s.revealed ? ' disabled' : '';
    if (q.type === 'mc') {
        return `<div class="qz-options" role="group" aria-label="Answer choices">
            ${q.options.map((opt, i) => `<button type="button" class="qz-option${s.revealed ? optionState(q, answer, opt) : ''}" data-action="answer-mc" data-value="${i}"${locked}><span class="qz-key" aria-hidden="true">${i + 1}</span><span class="qz-option-text">${inline(opt)}</span></button>`).join('')}
        </div>`;
    }
    if (q.type === 'tf') {
        return `<div class="qz-options qz-options--tf" role="group" aria-label="True or false">
            ${[[true, 'True'], [false, 'False']].map(([value, label], i) => `<button type="button" class="qz-option${s.revealed ? optionState(q, answer, value) : ''}" data-action="answer-tf" data-value="${value}"${locked}><span class="qz-key" aria-hidden="true">${i + 1}</span><span class="qz-option-text">${label}</span></button>`).join('')}
        </div>`;
    }
    const value = answer ? escapeHtml(answer.response) : '';
    return `<form class="qz-typed" data-form="typed">
        <label for="qz-input" class="qz-label">${q.type === 'fitb' ? 'Missing word(s)' : 'Your answer'}</label>
        <div class="qz-typed-row">
            <input id="qz-input" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" value="${value}"${locked}>
            <button type="submit" class="primary"${locked}>Check</button>
        </div>
    </form>`;
}

function feedbackHtml(q, answer) {
    const canOverride = !answer.correct && (q.type === 'typed' || q.type === 'fitb');
    const correctText = q.type === 'tf' ? (q.truth ? 'True' : `False. The answer is “${escapeHtml(q.answer)}”`) : inline(q.answer);
    return `<div class="qz-feedback ${answer.correct ? 'is-correct' : 'is-wrong'}" role="status">
        <p class="qz-feedback-title">${answer.correct ? (answer.overridden ? '✓ Counted as correct' : '✓ Correct!') : '✗ Not quite'}</p>
        ${answer.correct ? '' : `<p class="qz-feedback-answer">Answer: <strong>${correctText}</strong></p>`}
        <div class="qz-feedback-actions">
            ${canOverride ? '<button type="button" class="qz-link" data-action="override">I was right</button>' : ''}
            <button type="button" class="primary qz-next" data-action="next">Next →</button>
        </div>
    </div>`;
}

function renderQuestion(s) {
    const q = s.questions[s.index];
    const answer = s.answers[s.index];
    const total = s.questions.length;
    s.container.innerHTML = `
        <div class="qz qz-run">
            <div class="qz-progress">
                <div class="qz-progress-row"><span>Question ${s.index + 1} of ${total}</span><span class="qz-type">${TYPE_LABELS[q.type]}</span></div>
                <div class="qz-bar" role="progressbar" aria-label="Quiz progress" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${s.index}"><div class="qz-bar-fill" style="width:${(s.index / total) * 100}%"></div></div>
            </div>
            <section class="qz-panel qz-question" aria-label="Question ${s.index + 1}">${promptHtml(q)}</section>
            ${answersHtml(s, q, answer)}
            ${s.revealed && answer ? feedbackHtml(q, answer) : ''}
            <div class="qz-footer">
                <button type="button" class="qz-link" data-action="quit">Quit quiz</button>
                <span>${s.practice ? 'Practice round · ' : ''}${s.settings.feedback === 'each' ? 'Answers shown after each question' : 'Answers shown at the end'}</span>
            </div>
        </div>`;

    if (s.revealed) {
        s.container.querySelector('.qz-next')?.focus();
    } else if (q.type === 'typed' || q.type === 'fitb') {
        s.container.querySelector('#qz-input')?.focus();
    }
}

function reviewAnswerText(q, answer) {
    if (q.type === 'tf') return answer.response ? 'True' : 'False';
    return answer.response === '' ? '(blank)' : escapeHtml(answer.response);
}

function reviewItem(q, answer, i) {
    const prompt = q.cloze ? clozeSentence(q, '<span class="qz-blank qz-blank--sm" role="img" aria-label="blank"></span>') : escapeHtml(q.term);
    const shown = q.type === 'tf' ? `<p class="qz-review-line">Shown: ${escapeHtml(q.shown)}</p>` : '';
    const correctText = q.type === 'tf' ? (q.truth ? 'True' : `False (answer: ${escapeHtml(q.answer)})`) : escapeHtml(q.answer);
    const canOverride = !answer.correct && (q.type === 'typed' || q.type === 'fitb');
    return `<li class="qz-review-item ${answer.correct ? 'is-correct' : 'is-wrong'}">
        <span class="qz-review-mark" aria-label="${answer.correct ? 'Correct' : 'Incorrect'}">${answer.correct ? '✓' : '✗'}</span>
        <div class="qz-review-body">
            <p class="qz-review-q">${prompt}</p>
            ${shown}
            <p class="qz-review-line">Your answer: ${reviewAnswerText(q, answer)}${answer.overridden ? ' (counted as correct)' : ''}</p>
            ${answer.correct && !answer.overridden ? '' : `<p class="qz-review-line">Correct answer: <strong>${correctText}</strong></p>`}
            ${canOverride ? `<button type="button" class="qz-link" data-action="review-override" data-value="${i}">Count as correct</button>` : ''}
        </div>
    </li>`;
}

function renderResults(s) {
    const score = scoreAnswers(s.answers);
    const missed = s.answers.filter((a) => !a.correct).length;
    let badge = '';
    if (s.practice) badge = 'Practice rounds don’t count toward your quiz scores.';
    else if (s.previousBest === null) badge = 'First score recorded for this ' + s.source.type + '.';
    else if (score.percent > s.previousBest) badge = `New best score! (previous best ${s.previousBest}%)`;
    else badge = `Your best: ${s.previousBest}%`;

    s.container.innerHTML = `
        <div class="qz qz-results">
            <section class="qz-panel qz-score-panel" aria-labelledby="qz-score">
                <p class="qz-sub">${s.quick ? 'Quick Quiz' : 'Quiz'} · ${escapeHtml(s.source.name)}</p>
                <p id="qz-score" class="qz-score">${score.percent}%</p>
                <p class="qz-score-detail">${score.correct} of ${score.total} correct · ${formatDuration(s.durationMs)}</p>
                <p class="qz-badge">${badge}</p>
                <div class="qz-actions">
                    ${missed ? `<button type="button" class="primary" data-action="retry-missed">Retry missed (${missed})</button>` : ''}
                    <button type="button" data-action="again">${s.quick ? 'Quiz again' : 'New quiz'}</button>
                    <button type="button" data-action="done">Done</button>
                </div>
                ${s.quick && s.onOpenDashboard ? '<button type="button" class="qz-link" data-action="open-dashboard">More quiz options in the dashboard ↗</button>' : ''}
            </section>
            <section class="qz-panel" aria-labelledby="qz-review-title">
                <h3 id="qz-review-title" class="qz-h3">Review</h3>
                <ol class="qz-review-list">${s.questions.map((q, i) => reviewItem(q, s.answers[i], i)).join('')}</ol>
            </section>
        </div>`;
    s.container.querySelector('.qz-score-panel')?.scrollIntoView?.({ block: 'nearest' });
}

// ─── Flow ────────────────────────────────────────────────────────────
function beginQuestions(s, questions, practice) {
    s.questions = questions;
    s.index = 0;
    s.answers = [];
    s.revealed = false;
    s.practice = practice;
    s.record = null;
    s.startedAt = Date.now();
    s.phase = 'question';
    render(s);
}

function submitAnswer(s, response) {
    if (s.revealed) return;
    const q = s.questions[s.index];
    s.answers[s.index] = { cardId: q.cardId, type: q.type, response, correct: gradeAnswer(q, response), overridden: false };
    if (s.settings.feedback === 'each') {
        s.revealed = true;
        render(s);
    } else {
        advance(s);
    }
}

function advance(s) {
    s.revealed = false;
    s.index++;
    if (s.index >= s.questions.length) finish(s);
    else render(s);
}

async function finish(s) {
    s.durationMs = Date.now() - s.startedAt;
    s.previousBest = s.history.best;
    s.phase = 'results';
    if (!s.practice) {
        const score = scoreAnswers(s.answers);
        s.record = {
            sourceType: s.source.type,
            sourceId: s.source.id,
            sourceName: s.source.name,
            kind: s.quick ? 'quick' : 'full',
            startedAt: new Date(s.startedAt).toISOString(),
            finishedAt: new Date().toISOString(),
            durationMs: s.durationMs,
            settings: { count: s.settings.count, types: s.settings.types, feedback: s.settings.feedback },
            ...score,
            answers: s.answers.map(({ cardId, type, correct, overridden }) => ({ cardId, type, correct, overridden }))
        };
        try {
            s.record.id = await addQuizResult(s.record);
            s.history = summarizeQuizResults(await getQuizResults(), s.source);
        } catch (e) {
            console.error('Failed to save quiz result:', e);
        }
    }
    render(s);
}

async function overrideAnswer(s, index) {
    const answer = s.answers[index];
    if (!answer || answer.correct) return;
    answer.correct = true;
    answer.overridden = true;
    if (s.record?.id) {
        Object.assign(s.record, scoreAnswers(s.answers), {
            answers: s.answers.map(({ cardId, type, correct, overridden }) => ({ cardId, type, correct, overridden }))
        });
        await updateQuizResult(s.record).catch(console.error);
        s.history = summarizeQuizResults(await getQuizResults(), s.source);
    }
}

// ─── Events ──────────────────────────────────────────────────────────
function persistSettings(s) {
    if (s.quick) {
        // Quick Quiz only changes the answers setting; keep the full quiz's other choices
        saveQuizSettings({ ...getQuizSettings(), feedback: s.settings.feedback });
    } else {
        saveQuizSettings(s.settings);
    }
}

async function handleClick(s, e) {
    const btn = e.target.closest('[data-action]');
    if (!btn || btn.disabled || !s.container.contains(btn)) return;
    const { action, value } = btn.dataset;
    const q = s.questions[s.index];

    switch (action) {
        case 'count':
            s.settings.count = value === 'all' ? 'all' : Number(value);
            persistSettings(s);
            s.error = '';
            render(s);
            break;
        case 'type': {
            const types = s.settings.types.includes(value)
                ? s.settings.types.filter((t) => t !== value)
                : [...s.settings.types, value];
            if (types.length === 0) {
                s.error = 'Pick at least one question type.';
            } else {
                s.settings.types = QUESTION_TYPES.map((t) => t.id).filter((t) => types.includes(t));
                s.error = '';
                persistSettings(s);
            }
            render(s);
            break;
        }
        case 'feedback':
            s.settings.feedback = value;
            persistSettings(s);
            render(s);
            break;
        case 'start': {
            const questions = buildQuiz({ cards: s.cards, workspaceCards: s.workspaceCards, count: s.settings.count, types: s.settings.types });
            if (questions.length === 0) {
                s.error = 'Not enough cards for these question types. Add more cards or turn on more question types.';
                render(s);
            } else {
                beginQuestions(s, questions, false);
            }
            break;
        }
        case 'answer-mc':
            submitAnswer(s, q.options[Number(value)]);
            break;
        case 'answer-tf':
            submitAnswer(s, value === 'true');
            break;
        case 'override':
            s.answers[s.index].correct = true;
            s.answers[s.index].overridden = true;
            render(s);
            break;
        case 'next':
            advance(s);
            break;
        case 'quit':
            s.phase = s.quick ? 'intro' : 'setup';
            render(s);
            break;
        case 'review-override':
            await overrideAnswer(s, Number(value));
            render(s);
            break;
        case 'retry-missed': {
            const missedIds = new Set(s.answers.filter((a) => !a.correct).map((a) => a.cardId));
            const cards = s.cards.filter((c) => missedIds.has(c.id));
            const questions = buildQuiz({ cards, workspaceCards: s.workspaceCards, count: 'all', types: s.settings.types });
            if (questions.length) beginQuestions(s, questions, true);
            break;
        }
        case 'again':
            s.phase = s.quick ? 'intro' : 'setup';
            s.error = '';
            render(s);
            break;
        case 'open-dashboard':
            s.onOpenDashboard?.();
            break;
        case 'done':
            s.onExit?.();
            break;
        default:
            break;
    }
}

function handleSubmit(s, e) {
    if (!e.target.matches('[data-form="typed"]')) return;
    e.preventDefault();
    const input = s.container.querySelector('#qz-input');
    if (!input || s.revealed) return;
    if (!input.value.trim()) {
        input.focus();
        return;
    }
    submitAnswer(s, input.value.trim());
}

function onKeyDown(e) {
    const s = activeSession;
    if (!s || s.phase !== 'question' || !s.container.isConnected || !s.container.offsetParent) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const target = e.target;
    const inField = target.matches?.('input, textarea, select');
    const onButton = target.matches?.('button, a');
    const q = s.questions[s.index];

    if (s.revealed) {
        if (e.key === 'Enter' && !onButton) {
            e.preventDefault();
            advance(s);
        }
        return;
    }
    if (inField) return;
    if (q.type === 'mc' && /^[1-9]$/.test(e.key)) {
        const option = q.options[Number(e.key) - 1];
        if (option !== undefined) {
            e.preventDefault();
            submitAnswer(s, option);
        }
    } else if (q.type === 'tf') {
        const key = e.key.toLowerCase();
        if (key === '1' || key === 't') { e.preventDefault(); submitAnswer(s, true); }
        if (key === '2' || key === 'f') { e.preventDefault(); submitAnswer(s, false); }
    }
}
