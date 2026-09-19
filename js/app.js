import { initDB, addDeck, getDecks, deleteDeck, addCard, getCardsByDeck, deleteCard, updateCard, updateDeck } from './db.js';
import { exportDeckToCSV, parseCSV } from './csv.js';

// State
let currentDeckId = null;
let currentDeckName = '';
let currentCards = [];
let studyCards = [];
let studyIndex = 0;
let studyStats = { know: 0, forgot: 0 };
let deckToRenameId = null;
let studySourceView = 'decks';

const views = {
    decks: document.getElementById('view-decks'),
    deckDetails: document.getElementById('view-deck-details'),
    study: document.getElementById('view-study'),
    studyComplete: document.getElementById('view-study-complete')
};

const showView = (viewName) => {
    Object.values(views).forEach(v => v.classList.remove('active'));
    views[viewName].classList.add('active');
};

document.addEventListener('DOMContentLoaded', async () => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
    }

    await initDB();
    await loadDecks();
});

document.getElementById('btn-toggle-theme').addEventListener('click', () => {
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
});

document.addEventListener('click', () => {
    document.querySelectorAll('.dropdown.show').forEach(d => {
        d.classList.remove('show');
    });
});

const loadDecks = async () => {
    const decks = await getDecks();
    const list = document.getElementById('decks-list');
    list.innerHTML = '';
    
    for (const deck of decks) {
        const cards = await getCardsByDeck(deck.id);
        const mastered = cards.filter(c => c.status === 'mastered').length;
        
        const el = document.createElement('div');
        el.className = 'deck-item';
        el.innerHTML = `
            <div class="deck-item-info" title="Click to Study">
                <div class="deck-title-text">${deck.name}</div>
                <div class="deck-stats">${cards.length} cards | ${mastered} mastered</div>
            </div>
            <div class="dropdown">
                <button class="icon-btn btn-deck-menu" data-id="${deck.id}" style="display: flex; align-items: center; justify-content: center;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>
                </button>
                <div class="dropdown-content" id="dropdown-${deck.id}">
                    <button class="btn-deck-edit" data-id="${deck.id}">Edit</button>
                    <button class="btn-deck-rename" data-id="${deck.id}">Rename</button>
                    <button class="btn-deck-export" data-id="${deck.id}">Export</button>
                    <button class="btn-deck-delete" data-id="${deck.id}">Delete</button>
                </div>
            </div>
        `;
        
        el.querySelector('.deck-item-info').addEventListener('click', async () => {
            currentDeckId = deck.id;
            currentDeckName = deck.name;
            currentCards = await getCardsByDeck(deck.id);
            if (currentCards.length === 0) {
                alert("This deck is empty! Taking you to Edit mode to add cards.");
                openDeck(deck.id, deck.name);
            } else {
                document.getElementById('deck-title').textContent = deck.name;
                startStudySession('decks');
            }
        });
        
        const menuBtn = el.querySelector('.btn-deck-menu');
        const dropdown = el.querySelector('.dropdown');
        
        menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            document.querySelectorAll('.dropdown.show').forEach(d => {
                if (d !== dropdown) d.classList.remove('show');
            });
            dropdown.classList.toggle('show');
        });

        el.querySelector('.btn-deck-edit').addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.remove('show');
            openDeck(deck.id, deck.name);
        });

        el.querySelector('.btn-deck-delete').addEventListener('click', async (e) => {
            e.stopPropagation();
            dropdown.classList.remove('show');
            if (confirm(`Delete deck "${deck.name}"?`)) {
                await deleteDeck(deck.id);
                loadDecks();
            }
        });

        el.querySelector('.btn-deck-rename').addEventListener('click', async (e) => {
            e.stopPropagation();
            dropdown.classList.remove('show');
            deckToRenameId = deck.id;
            const renameInput = document.getElementById('input-rename-deck');
            renameInput.value = deck.name;
            document.getElementById('modal-rename-deck').style.display = 'flex';
            renameInput.focus();
        });

        el.querySelector('.btn-deck-export').addEventListener('click', async (e) => {
            e.stopPropagation();
            dropdown.classList.remove('show');
            if (cards.length === 0) {
                alert("No cards to export.");
            } else {
                exportDeckToCSV(deck.name, cards);
            }
        });
        
        list.appendChild(el);
    }
};

document.getElementById('btn-add-deck').addEventListener('click', async () => {
    const input = document.getElementById('input-new-deck');
    const name = input.value.trim();
    if (name) {
        await addDeck(name);
        input.value = '';
        loadDecks();
    }
});

document.getElementById('btn-import-csv').addEventListener('click', () => {
    const hideInstructions = localStorage.getItem('hideImportInstructions');
    if (hideInstructions === 'true') {
        document.getElementById('file-import').click();
    } else {
        document.getElementById('modal-import-instructions').style.display = 'flex';
    }
});

document.getElementById('btn-cancel-import').addEventListener('click', () => {
    document.getElementById('modal-import-instructions').style.display = 'none';
});

document.getElementById('btn-continue-import').addEventListener('click', () => {
    const dontShowAgain = document.getElementById('checkbox-dont-show-import').checked;
    if (dontShowAgain) {
        localStorage.setItem('hideImportInstructions', 'true');
    }
    document.getElementById('modal-import-instructions').style.display = 'none';
    document.getElementById('file-import').click();
});

document.getElementById('file-import').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (event) => {
        const csvText = event.target.result;
        const cards = parseCSV(csvText);
        if (cards.length > 0) {
            const deckName = file.name.replace('.csv', '') || 'Imported Deck';
            const deckId = await addDeck(deckName);
            for (const card of cards) {
                card.deckId = deckId;
                await addCard(card);
            }
            loadDecks();
            alert(`Imported ${cards.length} cards into "${deckName}"`);
        } else {
            alert("No cards found or invalid CSV format.");
        }
        e.target.value = '';
    };
    reader.readAsText(file);
});

const openDeck = async (id, name) => {
    currentDeckId = id;
    currentDeckName = name;
    document.getElementById('deck-title').textContent = name;
    await loadCards();
    showView('deckDetails');
};

const loadCards = async () => {
    currentCards = await getCardsByDeck(currentDeckId);
    const list = document.getElementById('cards-list');
    list.innerHTML = '';
    
    currentCards.forEach(card => {
        const el = document.createElement('div');
        el.className = 'card-item';
        el.innerHTML = `
            <div class="term">${card.term} ${card.partOfSpeech ? `<span class="pill">${card.partOfSpeech}</span>` : ''}</div>
            <div class="definition">${card.definition}</div>
            ${card.example ? `<div class="example">"${card.example}"</div>` : ''}
            <div style="margin-top: 8px; font-size: 10px; font-weight: bold;">Status: ${card.status.toUpperCase()}</div>
            <div class="card-actions">
                <button class="btn-delete-card" data-id="${card.id}">Delete</button>
            </div>
        `;
        
        el.querySelector('.btn-delete-card').addEventListener('click', async () => {
            if (confirm(`Delete card "${card.term}"?`)) {
                await deleteCard(card.id);
                loadCards();
            }
        });
        
        list.appendChild(el);
    });
};

document.getElementById('btn-back-decks').addEventListener('click', () => {
    loadDecks();
    showView('decks');
});

document.getElementById('btn-add-card').addEventListener('click', async () => {
    const term = document.getElementById('input-term').value.trim();
    const pos = document.getElementById('input-pos').value.trim();
    const def = document.getElementById('input-def').value.trim();
    const ex = document.getElementById('input-ex').value.trim();
    
    if (term && def) {
        await addCard({
            deckId: currentDeckId,
            term,
            partOfSpeech: pos,
            definition: def,
            example: ex,
            status: 'new'
        });
        document.getElementById('input-term').value = '';
        document.getElementById('input-pos').value = '';
        document.getElementById('input-def').value = '';
        document.getElementById('input-ex').value = '';
        loadCards();
    } else {
        alert("Term and Definition are required.");
    }
});

document.getElementById('btn-export-csv').addEventListener('click', () => {
    if (currentCards.length === 0) {
        alert("No cards to export.");
        return;
    }
    exportDeckToCSV(currentDeckName, currentCards);
});

const startStudySession = (source) => {
    studySourceView = source || 'deckDetails';
    
    if (currentCards.length === 0) {
        alert("Add some cards to study first!");
        return;
    }
    
    studyCards = [...currentCards].sort(() => Math.random() - 0.5);
    studyIndex = 0;
    studyStats = { know: 0, forgot: 0 };
    
    updateStudyView();
    showView('study');
};

document.getElementById('btn-start-study').addEventListener('click', () => startStudySession('deckDetails'));

const updateStudyView = () => {
    if (studyIndex >= studyCards.length) {
        showStudyComplete();
        return;
    }
    
    const card = studyCards[studyIndex];
    document.getElementById('study-progress-text').textContent = `${studyIndex + 1} of ${studyCards.length}`;
    document.getElementById('study-progress-fill').style.width = `${((studyIndex) / studyCards.length) * 100}%`;
    
    document.getElementById('study-term').textContent = card.term;
    
    const posEl = document.getElementById('study-pos');
    if (card.partOfSpeech) {
        posEl.textContent = card.partOfSpeech;
        posEl.style.display = 'inline-block';
    } else {
        posEl.style.display = 'none';
    }
    
    document.getElementById('study-def').textContent = card.definition;
    const exEl = document.getElementById('study-ex');
    if (card.example) {
        exEl.textContent = `"${card.example}"`;
        exEl.style.display = 'block';
    } else {
        exEl.style.display = 'none';
    }
    
    const flashcard = document.getElementById('flashcard');
    flashcard.classList.remove('flipped');
};

document.getElementById('flashcard').addEventListener('click', () => {
    document.getElementById('flashcard').classList.toggle('flipped');
});

const handleStudyResult = async (know) => {
    const card = studyCards[studyIndex];
    if (know) {
        studyStats.know++;
        card.status = 'mastered';
    } else {
        studyStats.forgot++;
        card.status = 'learning';
    }
    
    await updateCard(card);
    
    studyIndex++;
    updateStudyView();
};

document.getElementById('btn-study-forgot').addEventListener('click', () => handleStudyResult(false));
document.getElementById('btn-study-know').addEventListener('click', () => handleStudyResult(true));

document.getElementById('btn-back-details').addEventListener('click', () => {
    if (studySourceView === 'decks') {
        loadDecks();
        showView('decks');
    } else {
        loadCards();
        showView('deckDetails');
    }
});

const showStudyComplete = () => {
    document.getElementById('study-progress-fill').style.width = '100%';
    document.getElementById('study-results').innerHTML = `
        <strong>${studyStats.know}</strong> Known <br>
        <strong>${studyStats.forgot}</strong> to Review
    `;
    showView('studyComplete');
};

document.getElementById('btn-back-details-complete').addEventListener('click', () => {
    if (studySourceView === 'decks') {
        loadDecks();
        showView('decks');
    } else {
        loadCards();
        showView('deckDetails');
    }
});

document.getElementById('btn-restart-study').addEventListener('click', () => {
    document.getElementById('btn-start-study').click();
});

// Rename Modal Logic
document.getElementById('btn-cancel-rename').addEventListener('click', () => {
    document.getElementById('modal-rename-deck').style.display = 'none';
    deckToRenameId = null;
});

document.getElementById('btn-save-rename').addEventListener('click', async () => {
    if (!deckToRenameId) return;
    
    const newName = document.getElementById('input-rename-deck').value.trim();
    if (newName) {
        await updateDeck(deckToRenameId, newName);
        document.getElementById('modal-rename-deck').style.display = 'none';
        deckToRenameId = null;
        loadDecks();
    }
});

document.getElementById('input-rename-deck').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        document.getElementById('btn-save-rename').click();
    }
});
