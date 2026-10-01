/**
 * drive.js — Google Drive auth, PDF import, and two-way backup sync.
 *
 * Every device keeps a full copy of the database in IndexedDB and syncs it
 * through a single `retention_backup.json` file in the user's Drive:
 *   - Only this device changed      → upload
 *   - Only Drive changed            → download, then reload the UI
 *   - Both changed since last sync  → ask the user which copy to keep
 *                                     (never silently overwrite either side)
 *
 * The backup also carries preferences that should follow the user across
 * devices (currently their ordered theme favorites).
 *
 * Sync bookkeeping lives in the env.js storage layer (chrome.storage in the
 * extension, so the background service worker shares it; localStorage on the
 * web/PWA).
 */

import { getDecks, getFolders, getStats, db, SYNC_DIRTY_KEY } from './db.js';
import { isExtension, storage } from './env.js';
import { getSyncedFavorites, restoreFavorites } from './themes.js';

const BACKUP_NAME = 'retention_backup.json';
const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';
const SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly';

// Sync state keys
const K = {
    dirtyAt: SYNC_DIRTY_KEY,              // time of the latest unsynced local change
    lastModified: 'drive_last_modified',  // Drive modifiedTime of the backup we last synced with
    fileId: 'drive_backup_file_id',       // backup file this app can write to
    status: 'sync_status',                // { state, message, at } for the UI
    connected: 'drive_connected'          // user has signed in to Drive on this device
};

// ─── Web OAuth (Google Identity Services) ────────────────────────────
let webAccessToken = null;
let webTokenExpiry = 0;
let gisClientId = null;
let gisTokenClient = null;
let pendingTokenRequest = null;

const createGisClient = () => {
    if (gisTokenClient || !gisClientId || typeof google === 'undefined' || !google.accounts?.oauth2) return gisTokenClient;
    gisTokenClient = google.accounts.oauth2.initTokenClient({
        client_id: gisClientId,
        scope: SCOPES,
        callback: (response) => {
            const request = pendingTokenRequest;
            pendingTokenRequest = null;
            if (!request) return;
            if (response.error) return request.reject(new Error(response.error_description || response.error));
            webAccessToken = response.access_token;
            webTokenExpiry = Date.now() + ((Number(response.expires_in) || 3600) - 60) * 1000;
            localStorage.setItem('google_access_token', webAccessToken);
            localStorage.setItem('google_access_token_expiry', String(webTokenExpiry));
            storage.set({ [K.connected]: true });
            request.resolve(webAccessToken);
        },
        error_callback: (err) => {
            const request = pendingTokenRequest;
            pendingTokenRequest = null;
            request?.reject(new Error(err?.type === 'popup_closed' ? 'Google sign-in was closed.' : (err?.message || 'Google sign-in failed.')));
        }
    });
    return gisTokenClient;
};

/**
 * Sets the Web OAuth client ID (web only). The GIS script loads async, so the
 * client is created lazily once `google.accounts` is available.
 */
export const initGoogleAuth = (clientId) => {
    if (clientId !== gisClientId) gisTokenClient = null;
    gisClientId = clientId;
    createGisClient();
};

const waitForGisClient = async (timeoutMs = 10000) => {
    const deadline = Date.now() + timeoutMs;
    while (!createGisClient() && Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 200));
    }
    return gisTokenClient;
};

const requestWebToken = (client) => new Promise((resolve, reject) => {
    pendingTokenRequest = { resolve, reject };
    client.requestAccessToken({ prompt: '' });
});

// ─── Unified Auth ────────────────────────────────────────────────────
// Not async on purpose: an interactive web request must open the Google popup
// synchronously inside the user's click, or mobile browsers block it.
export const getAuthToken = (interactive = true) => {
    if (isExtension) {
        return new Promise((resolve, reject) => {
            chrome.identity.getAuthToken({ interactive }, (result) => {
                const token = typeof result === 'string' ? result : result?.token;
                if (chrome.runtime.lastError || !token) {
                    reject(new Error(chrome.runtime.lastError?.message || 'Not signed in to Google.'));
                    return;
                }
                if (interactive) storage.set({ [K.connected]: true });
                resolve(token);
            });
        });
    }

    if (webAccessToken && Date.now() < webTokenExpiry) return Promise.resolve(webAccessToken);

    const cachedToken = localStorage.getItem('google_access_token');
    const cachedExpiry = parseInt(localStorage.getItem('google_access_token_expiry'), 10);
    if (cachedToken && Date.now() < cachedExpiry) {
        webAccessToken = cachedToken;
        webTokenExpiry = cachedExpiry;
        return Promise.resolve(webAccessToken);
    }

    if (!interactive) return Promise.reject(new Error('Google sign-in expired. Interactive sign-in required.'));

    const client = createGisClient();
    if (client) return requestWebToken(client);
    if (!gisClientId) return Promise.reject(new Error('Google Sign-In is not configured. Add your Web OAuth Client ID in Settings.'));
    return waitForGisClient().then(c => c
        ? requestWebToken(c)
        : Promise.reject(new Error('Google Sign-In failed to load. Check your connection and try again.')));
};

const clearToken = () => {
    webAccessToken = null;
    webTokenExpiry = 0;
    if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('google_access_token');
        localStorage.removeItem('google_access_token_expiry');
    }
    if (isExtension) {
        chrome.identity.clearAllCachedAuthTokens(() => {});
    }
};

const driveFetch = async (token, url, options = {}) => {
    const res = await fetch(url, { ...options, headers: { ...(options.headers || {}), Authorization: `Bearer ${token}` } });
    if (res.status === 401) clearToken();
    return res;
};

// ─── Drive PDF import ────────────────────────────────────────────────
export const listDrivePdfs = async (query = '', pageToken = '') => {
    const token = await getAuthToken();
    let qStr = 'mimeType="application/pdf" and trashed=false';
    if (query) {
        qStr += ` and name contains '${query.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
    }
    let url = `${DRIVE_FILES_URL}?q=${encodeURIComponent(qStr)}&fields=nextPageToken,files(id,name)&pageSize=50`;
    if (pageToken) {
        url += `&pageToken=${encodeURIComponent(pageToken)}`;
    }
    const res = await driveFetch(token, url);
    if (!res.ok) throw new Error('Failed to fetch PDFs from Drive');
    return await res.json();
};

export const downloadPdfFromDrive = async (fileId) => {
    const token = await getAuthToken();
    const res = await driveFetch(token, `${DRIVE_FILES_URL}/${fileId}?alt=media`);
    if (!res.ok) throw new Error('Failed to download PDF from Drive');
    return await res.arrayBuffer();
};

// ─── Backup file I/O ─────────────────────────────────────────────────
// All backup files visible to this app, newest first. There is normally one,
// but the extension and the web app can each own a copy (see writeBackup).
const listBackups = async (token) => {
    const q = encodeURIComponent(`name='${BACKUP_NAME}' and trashed=false`);
    const res = await driveFetch(token, `${DRIVE_FILES_URL}?q=${q}&spaces=drive&orderBy=${encodeURIComponent('modifiedTime desc')}&fields=files(id,modifiedTime)`);
    if (!res.ok) throw new Error(`Couldn't read your Drive backup (HTTP ${res.status}).`);
    return (await res.json()).files || [];
};

const readAll = (storeName) => new Promise((resolve, reject) => {
    const request = db.transaction([storeName], 'readonly').objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
});

const buildBackup = async () => {
    const backup = {
        folders: await getFolders(),
        decks: await getDecks(),
        cards: await readAll('cards'),
        stats: await getStats(),
        quizResults: await readAll('quizResults'),
        exportedAt: new Date().toISOString()
    };
    // Only once customized, so a default list never overwrites another device's
    const themeFavorites = await getSyncedFavorites();
    if (themeFavorites) backup.preferences = { themeFavorites };
    return JSON.stringify(backup);
};

const isPermissionError = async (res) => {
    if (res.status === 404) return true;
    if (res.status !== 403) return false;
    try {
        const reason = (await res.clone().json()).error?.errors?.[0]?.reason || '';
        return /permission|appNotAuthorized/i.test(reason);
    } catch {
        return false;
    }
};

/** Writes this device's data to Drive and returns the file's { id, modifiedTime }. */
const writeBackup = async (token, files) => {
    const { [K.fileId]: ownFileId } = await storage.get([K.fileId]);
    const targetId = files.find(f => f.id === ownFileId)?.id || files[0]?.id;
    const body = await buildBackup();
    const makeForm = () => {
        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify({ name: BACKUP_NAME, mimeType: 'application/json' })], { type: 'application/json' }));
        form.append('file', new Blob([body], { type: 'application/json' }));
        return form;
    };

    let res = targetId
        ? await driveFetch(token, `${DRIVE_UPLOAD_URL}/${targetId}?uploadType=multipart&fields=id,modifiedTime`, { method: 'PATCH', body: makeForm() })
        : null;
    // drive.file can only write files created by the same Google Cloud app. If the
    // backup belongs to a different client (e.g. extension vs. web), keep our own
    // copy instead; reads always use whichever copy is newest.
    if (!res || await isPermissionError(res)) {
        res = await driveFetch(token, `${DRIVE_UPLOAD_URL}?uploadType=multipart&fields=id,modifiedTime`, { method: 'POST', body: makeForm() });
    }
    if (!res.ok) throw new Error(`Upload to Drive failed (HTTP ${res.status}).`);
    const file = await res.json();
    await storage.set({ [K.fileId]: file.id });
    return file;
};

/** Replaces the local database with a backup's contents in one transaction. */
const restoreBackup = async (token, file) => {
    const res = await driveFetch(token, `${DRIVE_FILES_URL}/${file.id}?alt=media`);
    if (!res.ok) throw new Error(`Download from Drive failed (HTTP ${res.status}).`);
    const data = await res.json();

    if (Array.isArray(data.preferences?.themeFavorites)) {
        await restoreFavorites(data.preferences.themeFavorites);
    }

    // Older backups may lack a store (e.g. quizResults); leave that local data alone
    const storeNames = ['folders', 'decks', 'cards', 'stats', 'quizResults'].filter(name => Array.isArray(data[name]));
    if (storeNames.length === 0) return;
    await new Promise((resolve, reject) => {
        const tx = db.transaction(storeNames, 'readwrite');
        storeNames.forEach(name => {
            const store = tx.objectStore(name);
            store.clear();
            data[name].forEach(item => store.put(item));
        });
        tx.oncomplete = () => resolve();
        tx.onerror = (e) => { e.preventDefault(); reject(tx.error); };
        tx.onabort = () => reject(tx.error || new Error('Restore aborted'));
    });
};

// ─── Sync state ──────────────────────────────────────────────────────
const setStatus = (state, message = '') => storage.set({ [K.status]: { state, message, at: Date.now() } });

const getDirtyAt = async () => (await storage.get([K.dirtyAt]))[K.dirtyAt] || 0;

// Clears the dirty flag only if no new change arrived while we were uploading
const clearDirtyIfUnchanged = async (dirtyAt) => {
    if ((await getDirtyAt()) === dirtyAt) await storage.remove(K.dirtyAt);
};

/** Current sync info for the UI. */
export const getSyncInfo = async () => {
    const res = await storage.get([K.status, K.lastModified, K.connected, K.dirtyAt]);
    return {
        status: res[K.status] || null,
        lastModified: res[K.lastModified] || null,
        connected: !!res[K.connected],
        pendingChanges: !!res[K.dirtyAt]
    };
};

/** Calls fn whenever the sync status changes (in any extension context). */
export const onSyncStatusChange = (fn) => {
    storage.onChange((changes) => {
        if (changes[K.status] || changes[K.dirtyAt] || changes[K.lastModified]) fn();
    });
};

/** One-line, human-readable sync status for Settings. */
export const describeSyncInfo = ({ status, lastModified, connected, pendingChanges }) => {
    if (!connected && !lastModified) {
        return 'Not connected. Use Upload or Download once to sign in to Google Drive and turn on auto sync.';
    }
    switch (status?.state) {
        case 'paused': return 'Paused: your Google sign-in expired. Reconnect to resume syncing.';
        case 'conflict': return 'Paused: this device and your Drive backup both changed. Choose which version to keep.';
        case 'error': return `Sync error: ${status.message}`;
    }
    const when = lastModified
        ? new Date(lastModified).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
        : null;
    let text = when ? `Auto sync is on. Last synced backup: ${when}` : 'Auto sync is on.';
    if (pendingChanges) text += ' (changes waiting to upload)';
    return text;
};

/** Text for the "both sides changed" prompt. */
export const conflictMessage = (remoteModified) => {
    const when = new Date(remoteModified).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
    return `Your Google Drive backup was updated on another device (${when}), and this device also has changes that haven't synced yet. Which version do you want to keep? The other one will be replaced.`;
};

let conflictHandler = null;
/**
 * Registers the UI prompt used when both this device and Drive changed since
 * the last sync. It must resolve to 'drive', 'local', or null (decide later).
 */
export const setConflictHandler = (fn) => { conflictHandler = fn; };

// Other open extension pages (popup / dashboard tab) reload to show new data
const notifyOtherPages = () => {
    if (isExtension) chrome.runtime.sendMessage({ action: 'SYNC_RELOAD' })?.catch?.(() => {});
};

const notifyReload = () => {
    globalThis.dispatchEvent?.(new Event('sync_complete_reload'));
    notifyOtherPages();
};

const pushLocal = async (token, files, dirtyAt) => {
    const file = await writeBackup(token, files);
    await storage.set({ [K.lastModified]: file.modifiedTime });
    await clearDirtyIfUnchanged(dirtyAt);
    await setStatus('ok');
};

const pullRemote = async (token, remote) => {
    await restoreBackup(token, remote);
    await storage.set({ [K.lastModified]: remote.modifiedTime });
    await storage.remove(K.dirtyAt);
    await setStatus('ok');
    notifyReload();
};

// ─── Manual actions (Settings buttons) ───────────────────────────────
/** Overwrites the Drive backup with this device's data. */
export const uploadToDrive = async () => {
    const token = await getAuthToken(true);
    const dirtyAt = await getDirtyAt();
    await pushLocal(token, await listBackups(token), dirtyAt);
};

/** Replaces this device's data with the newest Drive backup. */
export const downloadFromDrive = async () => {
    const token = await getAuthToken(true);
    const [remote] = await listBackups(token);
    if (!remote) throw new Error('No backup found on Drive.');
    await restoreBackup(token, remote);
    await storage.set({ [K.lastModified]: remote.modifiedTime });
    await storage.remove(K.dirtyAt);
    await setStatus('ok');
    notifyOtherPages();
};

// ─── Auto sync ───────────────────────────────────────────────────────
let isSyncing = false;
let syncQueued = false;
let syncTimer = null;

const scheduleSync = (delay = 1500, options = {}) => {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => doAutoSync(options), delay);
};

const hasLocalData = async () => (await getFolders()).length > 0 || (await getDecks()).length > 0;

/**
 * Two-way sync with Drive.
 * @param {{ interactive?: boolean, pushOnly?: boolean }} options
 *   interactive — allow a Google sign-in prompt (must be called from a click)
 *   pushOnly    — only upload (used by the extension's background worker,
 *                 which has no UI to reload or to ask about conflicts)
 */
export const doAutoSync = async ({ interactive = false, pushOnly = false } = {}) => {
    if (isSyncing) { syncQueued = true; return; }
    isSyncing = true;
    try {
        const token = await getAuthToken(interactive).catch(() => null);
        if (!token) {
            const { [K.connected]: connected } = await storage.get([K.connected]);
            if (connected) await setStatus('paused', 'Google sign-in expired. Reconnect to resume syncing.');
            return;
        }

        const state = await storage.get([K.dirtyAt, K.lastModified]);
        const dirtyAt = state[K.dirtyAt] || 0;
        const lastSynced = state[K.lastModified] ? new Date(state[K.lastModified]).getTime() : 0;
        const files = await listBackups(token);
        const remote = files[0] || null;
        const remoteChanged = !!remote && new Date(remote.modifiedTime).getTime() > lastSynced;
        // A device that has never synced but already has decks counts as changed
        const localChanged = !!dirtyAt || (!lastSynced && await hasLocalData());

        if (localChanged && remoteChanged) {
            const choice = (!pushOnly && conflictHandler) ? await conflictHandler({ remoteModified: remote.modifiedTime }) : null;
            if (choice === 'drive') await pullRemote(token, remote);
            else if (choice === 'local') await pushLocal(token, files, dirtyAt);
            else await setStatus('conflict', 'This device and your Drive backup both changed. Open Retention to choose which to keep.');
        } else if (localChanged) {
            await pushLocal(token, files, dirtyAt);
        } else if (remoteChanged) {
            if (!pushOnly) await pullRemote(token, remote);
        } else {
            await setStatus('ok');
        }
    } catch (e) {
        console.error('Auto Sync Error:', e);
        await setStatus('error', e.message || String(e));
    } finally {
        isSyncing = false;
        if (syncQueued) {
            syncQueued = false;
            scheduleSync(500, { pushOnly });
        }
    }
};

// Older versions kept sync flags in localStorage; carry them over once.
const migrateLegacySyncState = async () => {
    const updates = {};
    const current = await storage.get([K.lastModified, K.dirtyAt]);
    const legacyModified = localStorage.getItem('drive_last_modified');
    const legacyDirty = localStorage.getItem('needs_sync') === 'true';
    let legacyBgDirty = false;
    if (isExtension) {
        legacyBgDirty = !!(await chrome.storage.local.get(['bg_needs_sync'])).bg_needs_sync;
        await chrome.storage.local.remove('bg_needs_sync');
    }
    if (legacyModified && !current[K.lastModified]) {
        updates[K.lastModified] = legacyModified;
        updates[K.connected] = true;
    }
    if ((legacyDirty || legacyBgDirty) && !current[K.dirtyAt]) updates[K.dirtyAt] = Date.now();
    if (Object.keys(updates).length > 0) await storage.set(updates);
    localStorage.removeItem('drive_last_modified');
    localStorage.removeItem('needs_sync');
};

/** Starts auto sync in a page (popup, dashboard, or web/PWA). */
export const startAutoSync = async () => {
    await migrateLegacySyncState().catch(console.error);

    window.addEventListener('db_updated', () => {
        if (isExtension) {
            // The popup can close at any moment; the background worker finishes the upload
            chrome.runtime.sendMessage({ action: 'SYNC_PUSH' })?.catch?.(() => scheduleSync());
        } else {
            scheduleSync();
        }
    });

    // Sync on open and whenever the app comes back to the foreground
    scheduleSync(300);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            scheduleSync(300);
        } else if (!isExtension) {
            // Mobile browsers may suspend the page soon; try to flush pending changes now
            getDirtyAt().then(dirtyAt => { if (dirtyAt) doAutoSync({ pushOnly: true }); });
        }
    });
};

/** Starts upload-only sync in the extension's background service worker. */
export const startBackgroundSync = () => {
    const schedulePush = () => scheduleSync(1500, { pushOnly: true });
    globalThis.addEventListener('db_updated', schedulePush);
    chrome.runtime.onMessage.addListener((request) => {
        if (request?.action === 'SYNC_PUSH') schedulePush();
    });
};
