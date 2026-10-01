import { getDecks, getFolders, getStats, db, BG_SYNC_FLAG } from './db.js';
import { isExtension } from './env.js';

// ─── Web OAuth state ─────────────────────────────────────────────────
let webAccessToken = null;
let gisTokenClient = null;

/**
 * Initialise the Google Identity Services token client (web only).
 * Call this once after the GIS library has loaded.
 */
export const initGoogleAuth = (clientId) => {
    if (typeof google === 'undefined' || !google.accounts) return;
    gisTokenClient = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly',
        callback: () => {} // overwritten per-call in getAuthToken
    });
};

// ─── Unified Auth ────────────────────────────────────────────────────
export const getAuthToken = (interactive = true) => {
    if (isExtension) {
        return new Promise((resolve, reject) => {
            chrome.identity.getAuthToken({ interactive }, (token) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message || chrome.runtime.lastError || "Auth error"));
                } else {
                    resolve(token);
                }
            });
        });
    }

    return new Promise((resolve, reject) => {
        if (webAccessToken) return resolve(webAccessToken);
        
        const cachedToken = localStorage.getItem('google_access_token');
        const tokenExpiry = localStorage.getItem('google_access_token_expiry');
        if (cachedToken && tokenExpiry && Date.now() < parseInt(tokenExpiry)) {
            webAccessToken = cachedToken;
            return resolve(webAccessToken);
        }

        if (!interactive) {
            return reject(new Error("Token expired or missing. Interactive auth required."));
        }

        if (!gisTokenClient) {
            return reject(new Error('Google Sign-In is not configured.'));
        }

        gisTokenClient.callback = (response) => {
            if (response.error) return reject(new Error(response.error));
            webAccessToken = response.access_token;
            localStorage.setItem('google_access_token', webAccessToken);
            localStorage.setItem('google_access_token_expiry', Date.now() + (3500 * 1000));
            setTimeout(() => { webAccessToken = null; }, 3500 * 1000);
            resolve(webAccessToken);
        };
        gisTokenClient.requestAccessToken({ prompt: '' });
    });
};


const clearToken = () => {
    webAccessToken = null;
    localStorage.removeItem('google_access_token');
    localStorage.removeItem('google_access_token_expiry');
    if (isExtension) {
        chrome.identity.clearAllCachedAuthTokens(() => {});
    }
};

export const listDrivePdfs = async (query = '', pageToken = '') => {
    const token = await getAuthToken();
    let qStr = 'mimeType="application/pdf" and trashed=false';
    if (query) {
        qStr += ` and name contains '${query}'`;
    }
    let url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(qStr)}&fields=nextPageToken,files(id,name)&pageSize=50`;
    if (pageToken) {
        url += `&pageToken=${encodeURIComponent(pageToken)}`;
    }
    
    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
    });
    if (res.status === 401) clearToken();
    if (!res.ok) throw new Error('Failed to fetch PDFs from Drive');
    return await res.json();
};

export const downloadPdfFromDrive = async (fileId) => {
    const token = await getAuthToken();
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    if (res.status === 401) clearToken();
    if (!res.ok) throw new Error('Failed to download PDF from Drive');
    return await res.arrayBuffer();
};

const getBackupFile = async (token) => {
    const res = await fetch('https://www.googleapis.com/drive/v3/files?q=name="retention_backup.json" and trashed=false&spaces=drive&fields=files(id,modifiedTime)', {
        headers: { Authorization: `Bearer ${token}` }
    });
    if (res.status === 401) clearToken();
    if (!res.ok) throw new Error('Failed to fetch backup file info');
    const data = await res.json();
    if (data.files && data.files.length > 0) return data.files[0];
    return null;
};

export const uploadToDrive = async () => {
    try {
        const token = await getAuthToken();
        
        // Gather all data
        const decks = await getDecks();
        const folders = await getFolders();
        const stats = await getStats();
        
        // Gather all cards
        const cards = await new Promise((resolve, reject) => {
            const transaction = db.transaction(['cards'], 'readonly');
            const store = transaction.objectStore('cards');
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });

        const backupData = JSON.stringify({ decks, folders, cards, stats });
        const fileId = (await getBackupFile(token))?.id;
        
        const metadata = {
            name: 'retention_backup.json',
            mimeType: 'application/json'
        };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', new Blob([backupData], { type: 'application/json' }));

        const url = fileId 
            ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`
            : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`;
            
        const method = fileId ? 'PATCH' : 'POST';

        const res = await fetch(url, {
            method: method,
            headers: { Authorization: `Bearer ${token}` },
            body: form
        });
        
        if (res.status === 401) clearToken();
    if (!res.ok) throw new Error('Failed to upload to Drive');
        return true;
    } catch (e) {
        console.error(e);
        throw e;
    }
};

export const downloadFromDrive = async () => {
    try {
        const token = await getAuthToken();
        const file = await getBackupFile(token);
        const fileId = file?.id;
        if (!fileId) throw new Error('No backup found on Drive.');
        
        const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        
        if (res.status === 401) clearToken();
    if (!res.ok) throw new Error('Failed to download from Drive');
        const data = await res.json();
        
        // Restore data in a single transaction so a partial restore can't happen,
        // and wait for it to commit before callers reload the page.
        const storeNames = ['folders', 'decks', 'cards', 'stats'].filter(name => Array.isArray(data[name]));
        if (storeNames.length > 0) {
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
        }
        
        if (file) localStorage.setItem('drive_last_modified', file.modifiedTime);
        await clearSyncFlags();
        
        return true;
    } catch (e) {
        console.error(e);
        throw e;
    }
};

let syncTimer = null;
let isSyncing = false;

// Changes made by the extension's background worker (e.g. right-click cards,
// PDF decks) are flagged in chrome.storage, since it has no localStorage.
const hasPendingChanges = async () => {
    if (localStorage.getItem('needs_sync') === 'true') return true;
    if (isExtension) {
        const res = await chrome.storage.local.get([BG_SYNC_FLAG]);
        return !!res[BG_SYNC_FLAG];
    }
    return false;
};

export const clearSyncFlags = async () => {
    localStorage.setItem('needs_sync', 'false');
    if (isExtension) await chrome.storage.local.remove(BG_SYNC_FLAG);
};

export const startAutoSync = () => {
    window.addEventListener('db_updated', () => {
        clearTimeout(syncTimer);
        syncTimer = setTimeout(doAutoSync, 3000); // Debounce 3s
    });
    // Run on boot
    setTimeout(doAutoSync, 2000);
    
    // Run on tab focus
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            doAutoSync();
        }
    });
};

export const doAutoSync = async () => {
    if (isSyncing) return;
    isSyncing = true;
    try {
        const token = await getAuthToken(false).catch(() => null);
        if (!token) {
            isSyncing = false;
            return; // Not authenticated
        }
        
        const file = await getBackupFile(token);
        const needsSync = await hasPendingChanges();
        const lastKnownTime = localStorage.getItem('drive_last_modified');
        
        if (needsSync) {
            // Local changes exist, upload them
            await uploadToDrive();
            // Fetch the new time
            const newFile = await getBackupFile(token);
            if (newFile) localStorage.setItem('drive_last_modified', newFile.modifiedTime);
            await clearSyncFlags();
        } else if (file) {
            // Check if drive file is newer
            if (!lastKnownTime || new Date(file.modifiedTime) > new Date(lastKnownTime)) {
                // Remote is newer!
                await downloadFromDrive();
                localStorage.setItem('drive_last_modified', file.modifiedTime);
                window.dispatchEvent(new Event('sync_complete_reload'));
            }
        }
    } catch (e) {
        console.error("Auto Sync Error:", e);
    }
    isSyncing = false;
};
