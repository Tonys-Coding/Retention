/**
 * practice-test.js — Practice tests for quiz decks (dashboard, web/mobile,
 * and the extension popup).
 *
 * Every question is on one scrolling page with a numbered question list, like
 * a printed test. Question types: multiple choice (mcq), true / false (tf)
 * and fill in the blank (fitb). Answers are shown either right away (each
 * question locks and is marked as you answer) or at the end (change answers
 * freely, then Submit). Attempts are saved to the quizResults store; they
 * never change card mastery or study stats.
 */

import { getCardsByDeck, getQuizResults, addQuizResult, updateQuizResult } from './db.js';
import { escapeHtml } from './utils.js';

const MODE_KEY = 'practice_test_mode';
const TYPE_LABELS = { mcq: 'Multiple choice', tf: 'True / false', fitb: 'Fill in the blank' };

export const getAnswerMode = () => (localStorage.getItem(MODE_KEY) === 'end' ? 'end' : 'immediate');

/** The quiz deck icon: the deck shape as a test sheet with answer boxes. */
export const quizDeckIcon = (width = 16, height = 19) => `<svg width="${width}" height="${height}" viewBox="0 0 28 36" style="flex-shrink:0;overflow:visible;" aria-hidden="true"><rect x="4" y="4" width="24" height="32" fill="var(--shadow-color)"></rect><rect x="0" y="0" width="24" height="32" fill="var(--bg-secondary)" stroke="var(--text-primary)" stroke-width="3"></rect><rect x="5" y="6" width="5" height="5" fill="var(--text-primary)"></rect><rect x="5" y="14" width="5" height="5" fill="none" stroke="var(--text-primary)" stroke-width="2"></rect><rect x="5" y="22" width="5" height="5" fill="none" stroke="var(--text-primary)" stroke-width="2"></rect><path d="M13 8.5h6M13 16.5h6M13 24.5h6" stroke="var(--text-primary)" stroke-width="2.2"></path></svg>`;

// ─── Grading ─────────────────────────────────────────────────────────
const normalize = (text) => String(text ?? '')
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

/** Accepted answers for a fill-in-the-blank question ("TCP|Transmission Control Protocol"). */
const blankAnswers = (q) => String(q.definition).split('|').map((a) => a.trim()).filter(Boolean);

/** Typed answers ignore case, accents, punctuation and allow a typo on longer words. */
export const isBlankCorrect = (input, q) => {
    const typed = normalize(input);
    if (!typed) return false;
    return blankAnswers(q).some((answer) => {
        const target = normalize(answer);
        if (typed === target) return true;
        const allowed = target.length <= 4 ? 0 : target.length <= 8 ? 1 : 2;
        return levenshtein(typed, target) <= allowed;
    });
};

const correctAnswerText = (q) => {
    if (q.type === 'tf') return q.definition === 'true' ? 'True' : 'False';
    if (q.type === 'fitb') return blankAnswers(q).join(' / ');
    return q.definition;
};

/** Splits a fill-in-the-blank question around its blank. */
const blankParts = (q) => {
    const text = q.term || '';
    const underscores = text.match(/_{2,}/);
    if (underscores) return { before: text.slice(0, underscores.index), after: text.slice(underscores.index + underscores[0].length) };
    for (const answer of blankAnswers(q)) {
        const i = text.toLowerCase().indexOf(answer.toLowerCase());
        if (i >= 0) return { before: text.slice(0, i), after: text.slice(i + answer.length) };
    }
    return { before: `${text} `, after: '' };
};

// ─── Attempts ────────────────────────────────────────────────────────
export const summarizeAttempts = (results, deckId) => {
    const attempts = results.filter((r) => r.deckId === deckId);
    return {
        attempts: attempts.length,
        best: attempts.length ? Math.max(...attempts.map((r) => r.percent)) : null
    };
};

/** "12 questions · Best 85%" for deck lists. */
export const quizDeckMeta = (questionCount, summary) =>
    `${questionCount} question${questionCount === 1 ? '' : 's'}${summary?.best != null ? ` · Best ${summary.best}%` : ''}`;

const formatDuration = (ms) => {
    const total = Math.max(1, Math.round(ms / 1000));
    const m = Math.floor(total / 60);
    return m ? `${m}m ${total % 60}s` : `${total}s`;
};

// ─── Rendering ───────────────────────────────────────────────────────
const isAnswered = (s, q) => s.responses[q.id] !== undefined && s.responses[q.id] !== '';
const isRevealed = (s, q) => s.submitted || !!s.revealed[q.id];

const isCorrect = (s, q) => {
    if (s.overrides[q.id]) return true;
    const r = s.responses[q.id];
    if (r === undefined || r === '') return false;
    if (q.type === 'mcq') return q.choices[Number(r)] === q.definition;
    if (q.type === 'tf') return r === q.definition;
    return isBlankCorrect(r, q);
};

const choiceRow = (q, value, label) => `
    <label class="pt-choice">
        <input type="radio" name="pt-${q.id}" value="${value}" data-id="${q.id}">
        <span class="pt-radio" aria-hidden="true"></span>
        <span class="pt-choice-text">${escapeHtml(label)}</span>
        <span class="pt-choice-tag"></span>
    </label>`;

const questionHtml = (s, q, index) => {
    let prompt;
    if (q.type === 'fitb') {
        const { before, after } = blankParts(q);
        prompt = `${escapeHtml(before)}<span class="pt-blank" role="img" aria-label="blank"></span>${escapeHtml(after)}`;
    } else {
        prompt = escapeHtml(q.term);
    }

    let answers;
    if (q.type === 'mcq') {
        answers = `<div class="pt-choices" role="radiogroup" aria-labelledby="pt-text-${q.id}">${q.choices.map((c, i) => choiceRow(q, i, c)).join('')}</div>`;
    } else if (q.type === 'tf') {
        answers = `<div class="pt-choices pt-choices--tf" role="radiogroup" aria-labelledby="pt-text-${q.id}">${choiceRow(q, 'true', 'True')}${choiceRow(q, 'false', 'False')}</div>`;
    } else {
        answers = `<div class="pt-fitb">
            <input type="text" class="pt-input" data-id="${q.id}" aria-labelledby="pt-text-${q.id}" placeholder="Type your answer" autocomplete="off" autocapitalize="off" spellcheck="false">
            <button type="button" class="secondary pt-check" data-action="check" data-id="${q.id}">Check</button>
        </div>`;
    }

    return `<li class="pt-question" id="pt-q-${q.id}" data-id="${q.id}" tabindex="-1">
        <div class="pt-q-head"><span class="pt-q-num">${index + 1}</span><span class="pt-q-type">${TYPE_LABELS[q.type]}</span></div>
        <p class="pt-q-text" id="pt-text-${q.id}">${prompt}</p>
        ${answers}
        <div class="pt-q-feedback"></div>
    </li>`;
};

function paintQuestion(s, q) {
    const li = s.container.querySelector(`#pt-q-${q.id}`);
    if (!li) return;
    const revealed = isRevealed(s, q);
    const answered = isAnswered(s, q);
    const correct = isCorrect(s, q);
    const response = s.responses[q.id];

    li.querySelectorAll('.pt-choice').forEach((label) => {
        const input = label.querySelector('input');
        const picked = response !== undefined && String(response) === input.value;
        const isAnswer = q.type === 'mcq' ? q.choices[Number(input.value)] === q.definition : input.value === q.definition;
        input.checked = picked;
        input.disabled = revealed;
        label.classList.toggle('is-selected', picked);
        label.classList.toggle('is-correct', revealed && isAnswer);
        label.classList.toggle('is-wrong', revealed && picked && !isAnswer);
        label.querySelector('.pt-choice-tag').textContent = revealed && isAnswer ? 'Correct answer' : (revealed && picked ? 'Your answer' : '');
    });

    const input = li.querySelector('.pt-input');
    if (input) {
        if (document.activeElement !== input) input.value = response ?? '';
        input.disabled = revealed;
        const check = li.querySelector('.pt-check');
        check.hidden = revealed || s.mode === 'end';
    }

    li.classList.toggle('is-answered', answered);
    li.classList.toggle('is-correct', revealed && correct);
    li.classList.toggle('is-wrong', revealed && !correct);

    const feedback = li.querySelector('.pt-q-feedback');
    if (!revealed) {
        feedback.innerHTML = '';
        return;
    }
    const status = correct ? (s.overrides[q.id] ? '✓ Counted as correct' : '✓ Correct') : (answered ? '✗ Incorrect' : '✗ Not answered');
    // Choices already tag the correct answer; typed answers need it spelled out
    const answerLine = correct || q.type !== 'fitb' ? '' : `<span class="pt-feedback-answer">Correct answer: <strong>${escapeHtml(correctAnswerText(q))}</strong></span>`;
    const override = q.type === 'fitb' && answered && !correct
        ? `<button type="button" class="pt-link" data-action="override" data-id="${q.id}">I was right</button>` : '';
    feedback.innerHTML = `
        <p class="pt-feedback ${correct ? 'is-correct' : 'is-wrong'}"><span class="pt-feedback-status">${status}</span>${answerLine}${override}</p>
        ${q.explanation ? `<p class="pt-explanation">${escapeHtml(q.explanation)}</p>` : ''}`;
}

function resultsHtml(s) {
    const total = s.questions.length;
    const correct = s.questions.filter((q) => isCorrect(s, q)).length;
    const percent = total ? Math.round((correct / total) * 100) : 0;
    const missed = total - correct;
    let note = '';
    if (s.practice) note = 'Practice round: not counted toward your best score.';
    else if (s.previousBest === null) note = 'First attempt on this quiz.';
    else if (percent > s.previousBest) note = `New best! Previous best was ${s.previousBest}%.`;
    else note = `Your best: ${s.previousBest}%.`;
    return `
        <div class="pt-results-score"><span class="pt-results-value">${percent}%</span><span class="pt-results-label">Score</span></div>
        <div class="pt-results-body">
            <h3 class="pt-results-title" id="pt-results-title">${s.practice ? 'Practice round complete' : 'Test complete'}</h3>
            <p class="pt-results-detail">${correct} of ${total} correct · ${formatDuration(s.finishedAt - s.startedAt)}</p>
            <p class="pt-results-note">${note}</p>
            <div class="pt-results-actions">
                <button type="button" class="primary" data-action="retake">Retake test</button>
                ${missed ? `<button type="button" data-action="retake-missed">Retake missed (${missed})</button>` : ''}
                <button type="button" data-action="done">Done</button>
            </div>
        </div>`;
}

function updateChrome(s) {
    const total = s.questions.length;
    const answered = s.questions.filter((q) => isAnswered(s, q)).length;
    const revealedCount = s.questions.filter((q) => isRevealed(s, q)).length;
    const correctSoFar = s.questions.filter((q) => isRevealed(s, q) && isCorrect(s, q)).length;
    const progress = s.container.querySelector('.pt-progress');
    progress.textContent = s.mode === 'immediate' || s.submitted
        ? `${answered} of ${total} answered · ${correctSoFar} correct`
        : `${answered} of ${total} answered`;

    s.container.querySelectorAll('.pt-rail-item').forEach((item) => {
        const q = s.questions.find((x) => String(x.id) === item.dataset.id);
        const revealed = isRevealed(s, q);
        item.classList.toggle('is-answered', isAnswered(s, q));
        item.classList.toggle('is-correct', revealed && isCorrect(s, q));
        item.classList.toggle('is-wrong', revealed && !isCorrect(s, q));
    });

    s.container.querySelectorAll('.pt-mode .mode-btn').forEach((btn) => {
        const on = btn.dataset.value === s.mode;
        btn.classList.toggle('active', on);
        btn.setAttribute('aria-pressed', String(on));
    });

    const submitBar = s.container.querySelector('.pt-submit');
    submitBar.hidden = s.mode !== 'end' || s.submitted;
    const unanswered = total - answered;
    submitBar.querySelector('.pt-submit-note').textContent = s.confirmSubmit && unanswered
        ? `${unanswered} question${unanswered === 1 ? ' is' : 's are'} unanswered. Submit anyway?`
        : `${answered} of ${total} answered`;
    submitBar.querySelector('[data-action="submit"]').textContent = s.confirmSubmit && unanswered ? 'Submit anyway' : 'Submit test';

    const complete = s.submitted || (s.mode === 'immediate' && revealedCount === total && total > 0);
    const results = s.container.querySelector('.pt-results');
    if (complete && !s.finishedAt) finishAttempt(s);
    results.hidden = !complete;
    if (complete) results.innerHTML = resultsHtml(s);
}

async function finishAttempt(s) {
    s.finishedAt = Date.now();
    s.previousBest = s.history.best;
    if (s.practice) return;
    const total = s.questions.length;
    const correct = s.questions.filter((q) => isCorrect(s, q)).length;
    s.record = {
        deckId: s.deck.id,
        deckName: s.deck.name,
        mode: s.mode,
        correct,
        total,
        percent: total ? Math.round((correct / total) * 100) : 0,
        startedAt: new Date(s.startedAt).toISOString(),
        finishedAt: new Date(s.finishedAt).toISOString(),
        durationMs: s.finishedAt - s.startedAt,
        answers: s.questions.map((q) => ({ cardId: q.id, correct: isCorrect(s, q), overridden: !!s.overrides[q.id] }))
    };
    try {
        s.record.id = await addQuizResult(s.record);
    } catch (e) {
        console.error('Failed to save practice test attempt:', e);
    }
    // Scroll the score into view once the attempt is complete
    s.container.querySelector('.pt-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderTest(s) {
    const total = s.questions.length;
    const meta = `${quizDeckMeta(s.allQuestions.length, s.history)}${s.history.attempts ? ` · ${s.history.attempts} attempt${s.history.attempts === 1 ? '' : 's'}` : ''}`;
    s.container.innerHTML = `
        <div class="pt">
            <section class="pt-panel pt-header" aria-labelledby="pt-title">
                <div class="pt-header-text">
                    <span class="pt-kicker">${s.practice ? 'Practice round · missed questions' : 'Practice test'}</span>
                    <h2 class="pt-title" id="pt-title">${escapeHtml(s.deck.name)}</h2>
                    <p class="pt-meta">${meta}</p>
                </div>
                <div class="pt-header-side">
                    <span class="pt-label" id="pt-mode-label">Show answers</span>
                    <div class="card-mode-toggle pt-mode" role="group" aria-labelledby="pt-mode-label">
                        <button type="button" class="mode-btn" data-action="mode" data-value="immediate">Right away</button>
                        <button type="button" class="mode-btn" data-action="mode" data-value="end">At the end</button>
                    </div>
                    <p class="pt-progress" aria-live="polite"></p>
                </div>
            </section>
            <section class="pt-panel pt-results" aria-labelledby="pt-results-title" hidden></section>
            <div class="pt-body">
                <nav class="pt-rail" aria-label="Question list">
                    <h3 class="pt-rail-title">Question list</h3>
                    <ol class="pt-rail-list">
                        ${s.questions.map((q, i) => `<li><button type="button" class="pt-rail-item" data-action="jump" data-id="${q.id}" aria-label="Question ${i + 1}">${i + 1}</button></li>`).join('')}
                    </ol>
                </nav>
                <ol class="pt-list">${s.questions.map((q, i) => questionHtml(s, q, i)).join('')}</ol>
            </div>
            <div class="pt-panel pt-submit" hidden>
                <p class="pt-submit-note"></p>
                <button type="button" class="primary" data-action="submit">Submit test</button>
            </div>
        </div>`;
    s.questions.forEach((q) => paintQuestion(s, q));
    updateChrome(s);
    trackCurrentQuestion(s);
    if (total === 0) {
        s.container.querySelector('.pt-body').innerHTML = '<p class="pt-empty">This quiz has no questions yet. Import a quiz CSV or add questions in Edit Questions.</p>';
    }
}

// Highlights the question you're looking at in the question list
function trackCurrentQuestion(s) {
    s.observer?.disconnect();
    if (!('IntersectionObserver' in window)) return;
    s.observer = new IntersectionObserver((entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (!visible) return;
        s.container.querySelectorAll('.pt-rail-item').forEach((item) => {
            if (item.dataset.id === visible.target.dataset.id) item.setAttribute('aria-current', 'true');
            else item.removeAttribute('aria-current');
        });
    }, { rootMargin: '-20% 0px -60% 0px' });
    s.container.querySelectorAll('.pt-question').forEach((li) => s.observer.observe(li));
}

function resetAttempt(s, questions, practice) {
    s.questions = questions;
    s.practice = practice;
    s.responses = {};
    s.revealed = {};
    s.overrides = {};
    s.submitted = false;
    s.confirmSubmit = false;
    s.finishedAt = null;
    s.record = null;
    s.startedAt = Date.now();
    renderTest(s);
    s.container.querySelector('.pt')?.scrollIntoView({ block: 'start' });
}

// ─── Events ──────────────────────────────────────────────────────────
function answer(s, q, response) {
    s.responses[q.id] = response;
    s.confirmSubmit = false;
    if (s.mode === 'immediate' && response !== '') s.revealed[q.id] = true;
    paintQuestion(s, q);
    updateChrome(s);
    if (s.revealed[q.id]) s.container.querySelector(`#pt-q-${q.id}`)?.focus({ preventScroll: true });
}

async function onClick(s, e) {
    const btn = e.target.closest('[data-action]');
    if (!btn || btn.disabled || !s.container.contains(btn)) return;
    const { action, id, value } = btn.dataset;
    const q = id ? s.questions.find((x) => String(x.id) === id) : null;
    switch (action) {
        case 'mode':
            if (s.submitted || value === s.mode) return;
            s.mode = value;
            localStorage.setItem(MODE_KEY, value);
            // Switching to "right away" marks questions you've already answered
            if (value === 'immediate') s.questions.forEach((x) => { if (isAnswered(s, x)) s.revealed[x.id] = true; });
            s.questions.forEach((x) => paintQuestion(s, x));
            updateChrome(s);
            break;
        case 'check': {
            const input = s.container.querySelector(`.pt-input[data-id="${id}"]`);
            if (!input.value.trim()) { input.focus(); return; }
            answer(s, q, input.value.trim());
            break;
        }
        case 'override':
            s.overrides[q.id] = true;
            paintQuestion(s, q);
            updateChrome(s);
            if (s.record?.id) {
                const total = s.questions.length;
                const correct = s.questions.filter((x) => isCorrect(s, x)).length;
                Object.assign(s.record, {
                    correct,
                    percent: Math.round((correct / total) * 100),
                    answers: s.questions.map((x) => ({ cardId: x.id, correct: isCorrect(s, x), overridden: !!s.overrides[x.id] }))
                });
                updateQuizResult(s.record).catch(console.error);
            }
            break;
        case 'jump':
            s.container.querySelector(`#pt-q-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            s.container.querySelector(`#pt-q-${id}`)?.focus({ preventScroll: true });
            break;
        case 'submit': {
            const unanswered = s.questions.filter((x) => !isAnswered(s, x)).length;
            if (unanswered && !s.confirmSubmit) {
                s.confirmSubmit = true;
                updateChrome(s);
                return;
            }
            s.submitted = true;
            s.questions.forEach((x) => paintQuestion(s, x));
            updateChrome(s);
            break;
        }
        case 'retake':
            s.history = summarizeAttempts(await getQuizResults(), s.deck.id);
            resetAttempt(s, s.allQuestions, false);
            break;
        case 'retake-missed':
            resetAttempt(s, s.questions.filter((x) => !isCorrect(s, x)), true);
            break;
        case 'done':
            s.observer?.disconnect();
            s.onExit?.();
            break;
        default:
            break;
    }
}

function onChange(s, e) {
    const target = e.target;
    if (target.matches('.pt-choice input[type="radio"]')) {
        const q = s.questions.find((x) => String(x.id) === target.dataset.id);
        if (q && !isRevealed(s, q)) answer(s, q, target.value);
    }
}

function onInput(s, e) {
    // "At the end": typed answers are recorded as you type and can change until Submit
    if (!e.target.matches('.pt-input') || s.mode !== 'end') return;
    const q = s.questions.find((x) => String(x.id) === e.target.dataset.id);
    if (!q || isRevealed(s, q)) return;
    s.responses[q.id] = e.target.value.trim();
    s.confirmSubmit = false;
    s.container.querySelector(`#pt-q-${q.id}`).classList.toggle('is-answered', isAnswered(s, q));
    updateChrome(s);
}

function onKeyDown(s, e) {
    if (e.key === 'Enter' && e.target.matches('.pt-input') && s.mode === 'immediate') {
        e.preventDefault();
        s.container.querySelector(`.pt-check[data-id="${e.target.dataset.id}"]`)?.click();
    }
}

/**
 * Renders a practice test for a quiz deck into `container`.
 * @param {HTMLElement} container
 * @param {{ deck: { id: number, name: string }, onExit: () => void }} options
 */
export async function renderPracticeTest(container, { deck, onExit }) {
    container.innerHTML = '<p class="pt-empty">Loading quiz…</p>';
    const [cards, results] = await Promise.all([getCardsByDeck(deck.id), getQuizResults()]);
    const questions = cards
        .filter((c) => c.type === 'mcq' || c.type === 'tf' || c.type === 'fitb')
        .sort((a, b) => a.id - b.id);
    const s = {
        container, deck, onExit,
        mode: getAnswerMode(),
        allQuestions: questions,
        history: summarizeAttempts(results, deck.id)
    };
    container.onclick = (e) => onClick(s, e);
    container.onchange = (e) => onChange(s, e);
    container.oninput = (e) => onInput(s, e);
    container.onkeydown = (e) => onKeyDown(s, e);
    resetAttempt(s, questions, false);
}
