/**
 * background-jobs.js — Hands AI generation jobs from an extension page (popup
 * or dashboard) to the background service worker.
 *
 * Chrome keeps running the background worker it already loaded until the
 * extension is reloaded, so after an update the pages can be newer than the
 * worker. An outdated worker can't do new kinds of jobs (and one from before
 * database v4 can't even open the database), so check its version first and
 * offer a reload instead of starting a job that is bound to fail.
 */

import { GENERATION_PROTOCOL } from './ai-processor.js';

export class OutdatedBackgroundError extends Error {
    constructor() {
        super('Retention\'s background helper is out of date. Reload the extension to finish updating.');
        this.name = 'OutdatedBackgroundError';
    }
}

/** Starts a PROCESS_PDF_CHUNKS job in the background worker, or throws OutdatedBackgroundError. */
export const startBackgroundGeneration = async (job) => {
    let reply = null;
    try {
        reply = await chrome.runtime.sendMessage({ action: 'GET_GENERATION_PROTOCOL' });
    } catch {
        // An older worker has no handler for this message, so nobody answers
    }
    if (reply?.protocol !== GENERATION_PROTOCOL) throw new OutdatedBackgroundError();
    await chrome.runtime.sendMessage({ action: 'PROCESS_PDF_CHUNKS', ...job });
};

/** Asks to reload the extension (which loads the new background worker). */
export const offerExtensionReload = async (confirm) => {
    const ok = await confirm(
        'Retention was updated, but Chrome is still running the old version of its background helper, so it can\'t generate or save new decks. Reload the extension to finish updating? Retention\'s open tabs will close; just open it again afterwards.',
        'Reload', false, 'Not now', 'Update needed'
    );
    if (ok) chrome.runtime.reload();
};
