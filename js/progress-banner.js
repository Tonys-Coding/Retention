/**
 * progress-banner.js — The "AI generation" progress banner (#bg-task-banner),
 * shared by the extension popup and the dashboard (web + mobile).
 *
 * Renders the `pdfProgress` value written by ai-processor.js. A job that stops
 * updating (for example the browser shut down the extension's background
 * worker mid-job) is shown as stopped instead of sitting at 0% forever.
 */

import { escapeHtml } from './utils.js';

// Running jobs refresh `updatedAt` every few seconds while the AI writes
const STALE_AFTER_MS = 150000;

let current = null;
let staleCheck = null;

const $ = (id) => document.getElementById(id);

const isStale = (progress) => (progress.status === 'running' || progress.status === 'saving')
    && Date.now() - (progress.updatedAt || 0) > STALE_AFTER_MS;

const showError = (message) => {
    $('bg-task-title').innerHTML = `<span style="color: #ff4444;">Error: ${escapeHtml(message)}</span>`;
    $('bg-task-percent').textContent = '';
    $('bg-task-fill').style.width = '100%';
    $('bg-task-fill').style.backgroundColor = '#ff4444';
    $('bg-task-spinner').style.display = 'none';
};

const render = () => {
    const banner = $('bg-task-banner');
    if (!banner) return;
    const progress = current;
    if (!progress) {
        banner.style.display = 'none';
        return;
    }
    banner.style.display = 'block';

    if (progress.status === 'error') {
        showError(progress.errorMsg || 'Failed');
        return;
    }
    if (isStale(progress)) {
        showError(`Generating "${progress.deckName}" stopped unexpectedly. Close this and try again.`);
        return;
    }

    $('bg-task-spinner').style.display = 'block';
    const percent = Math.round((progress.current / progress.total) * 100) || 0;
    const isQuiz = progress.kind === 'quiz';
    let title;
    if (progress.status === 'saving') {
        title = isQuiz ? 'Saving Questions...' : 'Saving Cards...';
    } else if (progress.received) {
        // Streaming: show that the model is actively writing
        const section = progress.total > 1 ? ` (section ${progress.current + 1} of ${progress.total})` : '';
        title = `AI is writing "${progress.deckName}"${section}… ${progress.received.toLocaleString()} characters`;
    } else {
        title = `Analyzing "${progress.deckName}"`;
    }
    $('bg-task-title').textContent = title;
    $('bg-task-percent').textContent = `${percent}%`;
    $('bg-task-fill').style.width = `${percent}%`;
    $('bg-task-fill').style.backgroundColor = 'var(--text-primary)';
};

/** Shows (or hides, for a falsy value) the progress banner for a pdfProgress value. */
export const updateProgressBanner = (progress) => {
    current = progress || null;
    render();
    // Re-check while a job is in flight so a dead job is noticed without new updates
    clearInterval(staleCheck);
    staleCheck = null;
    if (current && (current.status === 'running' || current.status === 'saving')) {
        staleCheck = setInterval(render, 15000);
    }
};
