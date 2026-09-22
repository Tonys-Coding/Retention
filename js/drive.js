import { getDecks, getFolders, db } from './db.js';

export const getAuthToken = () => {
    return new Promise((resolve, reject) => {
        chrome.identity.getAuthToken({ interactive: true }, (token) => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message || chrome.runtime.lastError || "Auth error"));
            } else {
                resolve(token);
            }
        });
    });
};

export const listDrivePdfs = async () => {
    const token = await getAuthToken();
    const res = await fetch('https://www.googleapis.com/drive/v3/files?q=mimeType="application/pdf" and trashed=false&fields=files(id,name)&pageSize=50', {
        headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to fetch PDFs from Drive');
    const data = await res.json();
    return data.files || [];
};

export const downloadPdfFromDrive = async (fileId) => {
    const token = await getAuthToken();
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to download PDF from Drive');
    return await res.arrayBuffer();
};

const getBackupFileId = async (token) => {
    const res = await fetch('https://www.googleapis.com/drive/v3/files?q=name="retention_backup.json" and trashed=false&spaces=drive', {
        headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.files && data.files.length > 0) return data.files[0].id;
    return null;
};

export const uploadToDrive = async () => {
    try {
        const token = await getAuthToken();
        
        // Gather all data
        const decks = await getDecks();
        const folders = await getFolders();
        
        // Gather all cards
        const cards = await new Promise((resolve, reject) => {
            const transaction = db.transaction(['cards'], 'readonly');
            const store = transaction.objectStore('cards');
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });

        const backupData = JSON.stringify({ decks, folders, cards });
        const fileId = await getBackupFileId(token);
        
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
        const fileId = await getBackupFileId(token);
        if (!fileId) throw new Error('No backup found on Drive.');
        
        const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        
        if (!res.ok) throw new Error('Failed to download from Drive');
        const data = await res.json();
        
        // Restore data
        if (data.folders) {
            const fTx = db.transaction(['folders'], 'readwrite');
            const fStore = fTx.objectStore('folders');
            fStore.clear();
            data.folders.forEach(f => fStore.add(f));
        }
        if (data.decks) {
            const dTx = db.transaction(['decks'], 'readwrite');
            const dStore = dTx.objectStore('decks');
            dStore.clear();
            data.decks.forEach(d => dStore.add(d));
        }
        if (data.cards) {
            const cTx = db.transaction(['cards'], 'readwrite');
            const cStore = cTx.objectStore('cards');
            cStore.clear();
            data.cards.forEach(c => cStore.add(c));
        }
        
        return true;
    } catch (e) {
        console.error(e);
        throw e;
    }
};
