/**
 * ai-quiz.js — "Generate Practice Quiz" form (AI quiz generation), shared by
 * the extension popup and the dashboard (web + mobile).
 *
 * Collects a source (a PDF file, a PDF from Google Drive, or pasted notes)
 * and options, extracts the text, and hands the chunks to the caller, which
 * runs generation: the background worker in the extension, in-page on the web
 * (see processPdfChunks in ai-processor.js with kind: 'quiz').
 */

import { escapeHtml } from './utils.js';

const OPTIONS_KEY = 'ai_quiz_options';
const CHUNK_SIZE = 15000; // characters per AI request, same as flashcard generation
const MIN_TEXT = 80;

const SOURCES = [
    { id: 'pdf', label: 'PDF' },
    { id: 'drive', label: 'Google Drive' },
    { id: 'notes', label: 'Paste Notes' }
];
const COUNTS = [
    { id: 'auto', label: 'Auto' },
    { id: 10, label: '10' },
    { id: 20, label: '20' },
    { id: 30, label: '30' }
];
const TYPES = [
    { id: 'mcq', label: 'Multiple Choice' },
    { id: 'tf', label: 'True / False' },
    { id: 'fitb', label: 'Fill in the Blank' }
];

const loadOptions = () => {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(OPTIONS_KEY)) || {}; } catch { /* ignore */ }
    const types = Array.isArray(saved.types) ? saved.types.filter((t) => TYPES.some((x) => x.id === t)) : [];
    return {
        count: COUNTS.some((c) => c.id === saved.count) ? saved.count : 'auto',
        types: types.length ? types : TYPES.map((t) => t.id)
    };
};

/** Extracts the text of a PDF File with pdf.js (loaded as a global by the page). */
export const extractPdfText = async (file) => {
    if (typeof pdfjsLib === 'undefined') throw new Error('The PDF reader did not load. Reload and try again.');
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) pdfjsLib.GlobalWorkerOptions.workerSrc = 'js/pdf.worker.min.js';
    const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map((item) => item.str).join(' ') + ' \n';
    }
    return text;
};

export const chunkText = (text) => {
    const chunks = [];
    for (let i = 0; i < text.length; i += CHUNK_SIZE) chunks.push(text.substring(i, i + CHUNK_SIZE));
    return chunks;
};

const toggleGroup = (labelId, label, action, items, isOn) => `
    <div class="aq-field">
        <span class="aq-label" id="${labelId}">${label}</span>
        <div class="card-mode-toggle" role="group" aria-labelledby="${labelId}">
            ${items.map((item) => `<button type="button" class="mode-btn${isOn(item.id) ? ' active' : ''}" data-action="${action}" data-value="${item.id}" aria-pressed="${isOn(item.id)}">${item.label}</button>`).join('')}
        </div>
    </div>`;

/**
 * Renders the form into `container`.
 * @param {HTMLElement} container
 * @param {{ onGenerate: (job: { textChunks: string[], deckName: string, quiz: { count: number|'auto', types: string[] } }) => Promise<void>,
 *           onCancel: () => void,
 *           onPickDrive?: (deliver: (file: File) => void) => void }} options
 *   onGenerate  starts generation; throw an Error to show its message in the form
 *   onPickDrive opens the app's Google Drive picker and calls deliver(file)
 */
export function renderAiQuizForm(container, { onGenerate, onCancel, onPickDrive }) {
    const s = { source: 'pdf', file: null, notes: '', name: '', nameEdited: false, error: '', busy: '', ...loadOptions() };

    const defaultName = () => (s.source !== 'notes' && s.file
        ? `${s.file.name.replace(/\.pdf$/i, '')} Quiz`
        : 'Practice Quiz');

    const render = () => {
        const sourcePanel = s.source === 'notes'
            ? `<div class="aq-field">
                    <label class="aq-label" for="aq-notes">Notes</label>
                    <textarea id="aq-notes" class="aq-notes" rows="7" placeholder="Paste your notes, a textbook section, or lecture slide text…">${escapeHtml(s.notes)}</textarea>
                    <p class="aq-hint">${s.notes.trim().length.toLocaleString()} characters</p>
               </div>`
            : `<div class="aq-file">
                    <button type="button" class="secondary" data-action="${s.source === 'drive' ? 'pick-drive' : 'pick-pdf'}">${s.source === 'drive' ? 'Choose from Drive' : 'Choose PDF'}</button>
                    <span class="aq-file-name">${s.file ? escapeHtml(s.file.name) : 'No file chosen'}</span>
               </div>`;
        container.innerHTML = `
            <div class="aq">
                <p class="aq-intro">AI writes multiple choice, true/false and fill-in-the-blank questions from your material and saves them as a new practice quiz deck.</p>
                ${toggleGroup('aq-source-label', 'Source', 'source', SOURCES.filter((x) => x.id !== 'drive' || onPickDrive), (id) => id === s.source)}
                ${sourcePanel}
                <input type="file" class="aq-file-input" accept=".pdf,application/pdf" hidden>
                <div class="aq-field">
                    <label class="aq-label" for="aq-name">Quiz name</label>
                    <input type="text" id="aq-name" value="${escapeHtml(s.nameEdited ? s.name : defaultName())}">
                </div>
                ${toggleGroup('aq-count-label', 'Questions', 'count', COUNTS, (id) => id === s.count)}
                ${toggleGroup('aq-types-label', 'Question types', 'type', TYPES, (id) => s.types.includes(id))}
                <p class="aq-hint">Uses your OpenRouter key and PDF Generation Focus from Settings. Long PDFs take a minute or two; progress shows at the top of your workspace.</p>
                <p class="aq-error" role="alert"${s.error ? '' : ' hidden'}>${escapeHtml(s.error)}</p>
                <div class="aq-actions">
                    <button type="button" data-action="cancel">Cancel</button>
                    <button type="button" class="primary" data-action="generate"${s.busy ? ' disabled' : ''}>${s.busy || 'Generate Quiz'}</button>
                </div>
            </div>`;
    };

    const setFile = (file) => {
        s.file = file;
        s.error = '';
        render();
    };

    const generate = async () => {
        if (s.source !== 'notes' && !s.file) { s.error = 'Choose a PDF first.'; render(); return; }
        if (s.source === 'notes' && s.notes.trim().length < MIN_TEXT) { s.error = 'Paste a bit more text (a paragraph or more) so there is something to quiz on.'; render(); return; }
        s.error = '';
        s.busy = s.source === 'notes' ? 'Starting…' : 'Reading PDF…';
        render();
        try {
            const text = s.source === 'notes' ? s.notes : await extractPdfText(s.file);
            if (text.trim().length < MIN_TEXT) {
                throw new Error('That PDF has almost no selectable text (scanned PDFs can’t be read). Try another file or paste the text.');
            }
            localStorage.setItem(OPTIONS_KEY, JSON.stringify({ count: s.count, types: s.types }));
            await onGenerate({
                textChunks: chunkText(text),
                deckName: (s.nameEdited ? s.name : defaultName()).trim() || 'Practice Quiz',
                quiz: { count: s.count, types: s.types }
            });
        } catch (e) {
            s.busy = '';
            s.error = e.message || String(e);
            render();
        }
    };

    container.onclick = (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn || btn.disabled || !container.contains(btn)) return;
        const { action, value } = btn.dataset;
        switch (action) {
            case 'source':
                if (value !== s.source) { s.source = value; s.file = null; s.error = ''; render(); }
                break;
            case 'pick-pdf':
                container.querySelector('.aq-file-input').click();
                break;
            case 'pick-drive':
                onPickDrive?.(setFile);
                break;
            case 'count':
                s.count = value === 'auto' ? 'auto' : Number(value);
                render();
                break;
            case 'type': {
                const types = s.types.includes(value) ? s.types.filter((t) => t !== value) : [...s.types, value];
                if (types.length === 0) { s.error = 'Keep at least one question type.'; }
                else { s.types = TYPES.map((t) => t.id).filter((t) => types.includes(t)); s.error = ''; }
                render();
                break;
            }
            case 'cancel':
                onCancel();
                break;
            case 'generate':
                generate();
                break;
            default:
                break;
        }
    };
    container.onchange = (e) => {
        if (e.target.matches('.aq-file-input') && e.target.files[0]) setFile(e.target.files[0]);
    };
    // Typing updates state without re-rendering, so focus stays put
    container.oninput = (e) => {
        if (e.target.id === 'aq-notes') {
            s.notes = e.target.value;
            const hint = e.target.parentElement.querySelector('.aq-hint');
            if (hint) hint.textContent = `${s.notes.trim().length.toLocaleString()} characters`;
        } else if (e.target.id === 'aq-name') {
            s.name = e.target.value;
            s.nameEdited = true;
        }
    };

    render();
    return { setFile };
}
