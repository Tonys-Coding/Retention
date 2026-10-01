import { storage } from './env.js';

const DB_NAME = 'RetentionDB';
const DB_VERSION = 4;

export let db;

// Storage key holding the time of the latest local change not yet synced to Drive
export const SYNC_DIRTY_KEY = 'sync_dirty_at';

export const markDbDirty = () => {
    // Runs inside IndexedDB success handlers: it must never throw, or the write is
    // aborted. Works in pages and in the extension's background service worker
    // (via env.js storage: chrome.storage in the extension, localStorage on web).
    try {
        storage.set({ [SYNC_DIRTY_KEY]: Date.now() })?.catch?.(console.error);
        globalThis.dispatchEvent?.(new Event('db_updated'));
    } catch (e) {
        console.error('markDbDirty failed:', e);
    }
};


export const initDB = () => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = (event) => { event.preventDefault(); reject(event.target.error); };

        request.onsuccess = (event) => {
            db = event.target.result;
            // Another context (popup, dashboard tab, background worker) is upgrading the
            // database: release this connection so the upgrade isn't blocked
            db.onversionchange = () => db.close();
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            db = event.target.result;
            
            if (!db.objectStoreNames.contains('decks')) {
                db.createObjectStore('decks', { keyPath: 'id', autoIncrement: true });
            }
            
            if (!db.objectStoreNames.contains('cards')) {
                const cardStore = db.createObjectStore('cards', { keyPath: 'id', autoIncrement: true });
                cardStore.createIndex('deckId', 'deckId', { unique: false });
            }
            
            if (!db.objectStoreNames.contains('stats')) {
                db.createObjectStore('stats', { keyPath: 'date' });
            }
            
            if (!db.objectStoreNames.contains('folders')) {
                const folderStore = db.createObjectStore('folders', { keyPath: 'id', autoIncrement: true });
                folderStore.createIndex('parentId', 'parentId', { unique: false });
            }

            // v4: quiz attempts, kept separate from study stats and card mastery
            if (!db.objectStoreNames.contains('quizResults')) {
                db.createObjectStore('quizResults', { keyPath: 'id', autoIncrement: true });
            }
        };
    });
};

export const addFolder = (name, color, parentId = null) => {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['folders'], 'readwrite');
        const store = transaction.objectStore('folders');
        const request = store.add({ name, color, parentId, createdAt: new Date().toISOString() });
        request.onsuccess = () => { markDbDirty(); resolve(request.result); };
        request.onerror = (e) => { e.preventDefault(); reject(request.error); };
        transaction.onerror = (e) => { e.preventDefault(); reject(transaction.error); };
    });
};

export const getFolders = () => {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['folders'], 'readonly');
        const store = transaction.objectStore('folders');
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = (e) => { e.preventDefault(); reject(request.error); };
        transaction.onerror = (e) => { e.preventDefault(); reject(transaction.error); };
    });
};

export const updateFolder = (id, newName, newColor, newParentId = undefined) => {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['folders'], 'readwrite');
        const store = transaction.objectStore('folders');
        const request = store.get(id);
        request.onsuccess = () => {
            const folder = request.result;
            if (newName !== undefined) folder.name = newName;
            if (newColor !== undefined) folder.color = newColor;
            if (newParentId !== undefined) folder.parentId = newParentId;
            const putReq = store.put(folder);
            putReq.onsuccess = () => { markDbDirty(); resolve(); };
            putReq.onerror = () => reject(putReq.error);
        };
        request.onerror = (e) => { e.preventDefault(); reject(request.error); };
        transaction.onerror = (e) => { e.preventDefault(); reject(transaction.error); };
    });
};

export const deleteFolder = (id) => {
    // Note: deleting a folder shouldn't automatically delete all nested decks and folders unless explicitly handled.
    // For now we just delete the folder itself. We'll handle moving children to root in app.js
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['folders'], 'readwrite');
        const store = transaction.objectStore('folders');
        const request = store.delete(id);
        request.onsuccess = () => { markDbDirty(); resolve(); };
        request.onerror = (e) => { e.preventDefault(); reject(request.error); };
    });
};

/**
 * Moves folders/decks whose parent folder no longer exists back to the
 * workspace root (older versions could leave sub-folders orphaned when
 * their parent was deleted, making them invisible).
 * Deliberately does not mark the DB dirty: it is an idempotent local repair,
 * and flagging it at startup could upload stale data over a newer backup.
 */
export const reparentOrphans = () => {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['folders', 'decks'], 'readwrite');
        const folderStore = transaction.objectStore('folders');
        const deckStore = transaction.objectStore('decks');
        let repaired = 0;
        const foldersReq = folderStore.getAll();
        foldersReq.onsuccess = () => {
            const folderIds = new Set(foldersReq.result.map(f => f.id));
            foldersReq.result.forEach(f => {
                if (f.parentId != null && (!folderIds.has(f.parentId) || f.parentId === f.id)) {
                    f.parentId = null;
                    folderStore.put(f);
                    repaired++;
                }
            });
            const decksReq = deckStore.getAll();
            decksReq.onsuccess = () => {
                decksReq.result.forEach(d => {
                    if (d.folderId != null && !folderIds.has(d.folderId)) {
                        d.folderId = null;
                        deckStore.put(d);
                        repaired++;
                    }
                });
            };
        };
        transaction.oncomplete = () => resolve(repaired);
        transaction.onerror = (e) => { e.preventDefault(); reject(transaction.error); };
    });
};

export const addDeck = (name, folderId = null) => {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['decks'], 'readwrite');
        const store = transaction.objectStore('decks');
        const request = store.add({ name, folderId, createdAt: new Date().toISOString() });
        request.onsuccess = () => { markDbDirty(); resolve(request.result); };
        request.onerror = (e) => { e.preventDefault(); reject(request.error); };
        transaction.onerror = (e) => { e.preventDefault(); reject(transaction.error); };
    });
};

export const getDecks = () => {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['decks'], 'readonly');
        const store = transaction.objectStore('decks');
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = (e) => { e.preventDefault(); reject(request.error); };
        transaction.onerror = (e) => { e.preventDefault(); reject(transaction.error); };
    });
};

export const updateDeck = (id, newName, folderId = undefined) => {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['decks'], 'readwrite');
        const store = transaction.objectStore('decks');
        const request = store.get(id);
        request.onsuccess = () => {
            const deck = request.result;
            if (newName !== undefined) deck.name = newName;
            if (folderId !== undefined) deck.folderId = folderId;
            const putReq = store.put(deck);
            putReq.onsuccess = () => { markDbDirty(); resolve(); };
            putReq.onerror = () => reject(putReq.error);
        };
        request.onerror = (e) => { e.preventDefault(); reject(request.error); };
        transaction.onerror = (e) => { e.preventDefault(); reject(transaction.error); };
    });
};

export const deleteDeck = (id) => {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['decks', 'cards'], 'readwrite');
        const deckStore = transaction.objectStore('decks');
        deckStore.delete(id);
        
        const cardStore = transaction.objectStore('cards');
        const index = cardStore.index('deckId');
        const request = index.getAllKeys(id);
        request.onsuccess = () => {
            request.result.forEach(cardId => cardStore.delete(cardId));
        };
        
        transaction.oncomplete = () => { markDbDirty(); resolve(); };
        transaction.onerror = (e) => { e.preventDefault(); reject(transaction.error); };
    });
}

export const addCard = (card) => {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['cards'], 'readwrite');
        const store = transaction.objectStore('cards');
        if (!card.status) card.status = 'new';
        if (card.interval === undefined) card.interval = 0;
        if (card.repetition === undefined) card.repetition = 0;
        if (card.efactor === undefined) card.efactor = 2.5;
        if (card.nextReviewDate === undefined) card.nextReviewDate = Date.now();
        
        const request = store.add(card);
        request.onsuccess = () => { markDbDirty(); resolve(request.result); };
        request.onerror = (e) => { e.preventDefault(); reject(request.error); };
    });
};

export const updateCard = (card) => {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['cards'], 'readwrite');
        const store = transaction.objectStore('cards');
        const request = store.put(card);
        request.onsuccess = () => { markDbDirty(); resolve(); };
        request.onerror = (e) => { e.preventDefault(); reject(request.error); };
        transaction.onerror = (e) => { e.preventDefault(); reject(transaction.error); };
    });
};

export const getCardsByDeck = (deckId) => {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['cards'], 'readonly');
        const store = transaction.objectStore('cards');
        const index = store.index('deckId');
        const request = index.getAll(deckId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = (e) => { e.preventDefault(); reject(request.error); };
        transaction.onerror = (e) => { e.preventDefault(); reject(transaction.error); };
    });
};

export const getCardsByFolder = async (folderId) => {
    const allDecks = await getDecks();
    const folderDecks = allDecks.filter(d => d.folderId === folderId);
    let allCards = [];
    for (const deck of folderDecks) {
        const cards = await getCardsByDeck(deck.id);
        allCards = allCards.concat(cards);
    }
    return allCards;
};

export const deleteCard = (id) => {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['cards'], 'readwrite');
        const store = transaction.objectStore('cards');
        const request = store.delete(id);
        request.onsuccess = () => { markDbDirty(); resolve(); };
        request.onerror = (e) => { e.preventDefault(); reject(request.error); };
    });
}

export const recordStudyResult = (know) => {
    return new Promise((resolve, reject) => {
        const dateStr = new Date().toISOString().split('T')[0];
        const transaction = db.transaction(['stats'], 'readwrite');
        const store = transaction.objectStore('stats');
        const request = store.get(dateStr);
        request.onsuccess = () => {
            const data = request.result || { date: dateStr, know: 0, forgot: 0 };
            if (know) data.know++;
            else data.forgot++;
            store.put(data);
        };
        transaction.oncomplete = () => { markDbDirty(); resolve(); };
        transaction.onerror = (e) => { e.preventDefault(); reject(transaction.error); };
    });
};

export const getStats = () => {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['stats'], 'readonly');
        const store = transaction.objectStore('stats');
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = (e) => { e.preventDefault(); reject(request.error); };
        transaction.onerror = (e) => { e.preventDefault(); reject(transaction.error); };
    });
};

export const getAllCards = () => {
    return new Promise((resolve, reject) => {
        const request = db.transaction(['cards'], 'readonly').objectStore('cards').getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = (e) => { e.preventDefault(); reject(request.error); };
    });
};

// ─── Quiz results (separate from study stats; never change card mastery) ───
export const addQuizResult = (result) => {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['quizResults'], 'readwrite');
        const request = transaction.objectStore('quizResults').add(result);
        request.onsuccess = () => { markDbDirty(); resolve(request.result); };
        request.onerror = (e) => { e.preventDefault(); reject(request.error); };
    });
};

export const updateQuizResult = (result) => {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['quizResults'], 'readwrite');
        const request = transaction.objectStore('quizResults').put(result);
        request.onsuccess = () => { markDbDirty(); resolve(); };
        request.onerror = (e) => { e.preventDefault(); reject(request.error); };
    });
};

export const getQuizResults = () => {
    return new Promise((resolve, reject) => {
        const request = db.transaction(['quizResults'], 'readonly').objectStore('quizResults').getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = (e) => { e.preventDefault(); reject(request.error); };
    });
};
