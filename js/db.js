const DB_NAME = 'RetentionDB';
const DB_VERSION = 1;

let db;

export const initDB = () => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = (event) => reject(event.target.error);

        request.onsuccess = (event) => {
            db = event.target.result;
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
        };
    });
};

export const addDeck = (name) => {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['decks'], 'readwrite');
        const store = transaction.objectStore('decks');
        const request = store.add({ name, createdAt: new Date().toISOString() });
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

export const getDecks = () => {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['decks'], 'readonly');
        const store = transaction.objectStore('decks');
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

export const updateDeck = (id, newName) => {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['decks'], 'readwrite');
        const store = transaction.objectStore('decks');
        const request = store.get(id);
        request.onsuccess = () => {
            const deck = request.result;
            deck.name = newName;
            const putReq = store.put(deck);
            putReq.onsuccess = () => resolve();
            putReq.onerror = () => reject(putReq.error);
        };
        request.onerror = () => reject(request.error);
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
        
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
}

export const addCard = (card) => {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['cards'], 'readwrite');
        const store = transaction.objectStore('cards');
        if (!card.status) card.status = 'new';
        const request = store.add(card);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

export const updateCard = (card) => {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['cards'], 'readwrite');
        const store = transaction.objectStore('cards');
        const request = store.put(card);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

export const getCardsByDeck = (deckId) => {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['cards'], 'readonly');
        const store = transaction.objectStore('cards');
        const index = store.index('deckId');
        const request = index.getAll(deckId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

export const deleteCard = (id) => {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['cards'], 'readwrite');
        const store = transaction.objectStore('cards');
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}
