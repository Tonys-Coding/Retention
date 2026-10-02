/**
 * progress-banner.js — The "AI generation" progress banner (#bg-task-banner),
 * shared by the extension popup and the dashboard (web + mobile).
 *
 * Renders the `pdfProgress` value written by ai-processor.js. A job that stops
 * updating (for example the browser shut down the extension's background
 * worker mid-job) is shown as stopped instead of sitting at 0% forever.
 */

import { escapeHtml } from './utils.js';
import { storage } from './env.js';

// Running jobs refresh `updatedAt` every few seconds while the AI writes
const STALE_AFTER_MS = 150000;
// How long a finished job's success message stays up
const DONE_VISIBLE_MS = 5000;

let current = null;
let receivedAt = 0;
let staleCheck = null;
let doneTimer = null;

const $ = (id) => document.getElementById(id);

// Jobs from an older background worker carry no timestamp: measure from the
// last update this page received instead
const isStale = (progress) => (progress.status === 'running' || progress.status === 'saving')
    && Date.now() - (progress.updatedAt || receivedAt) > STALE_AFTER_MS;

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
    if (progress.status === 'done') {
        const what = progress.kind === 'quiz' ? 'questions' : 'flashcards';
        $('bg-task-spinner').style.display = 'none';
        const count = progress.count ? `${progress.count} ` : '';
        $('bg-task-title').textContent = `✓ Created ${count}${what} in "${progress.deckName}"`;
        $('bg-task-percent').textContent = '100%';
        $('bg-task-fill').style.width = '100%';
        $('bg-task-fill').style.backgroundColor = '#00cc00';
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
    receivedAt = Date.now();
    render();
    // Re-check while a job is in flight so a dead job is noticed without new updates
    clearInterval(staleCheck);
    staleCheck = null;
    clearTimeout(doneTimer);
    if (current && (current.status === 'running' || current.status === 'saving')) {
        staleCheck = setInterval(render, 15000);
    }
    // Clear a finished job after a moment (unless a newer job has replaced it)
    if (current?.status === 'done') {
        const finished = current;
        doneTimer = setTimeout(async () => {
            const { pdfProgress } = await storage.get(['pdfProgress']);
            if (pdfProgress?.status === 'done' && pdfProgress.updatedAt === finished.updatedAt) await storage.remove('pdfProgress');
            if (current === finished) updateProgressBanner(null);
        }, DONE_VISIBLE_MS);
    }
};
