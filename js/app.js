import { initDB, addFolder, getFolders, updateFolder, deleteFolder, addDeck, getDecks, deleteDeck, addCard, getCardsByDeck, getCardsByFolder, deleteCard, updateCard, updateDeck, getStats, recordStudyResult } from './db.js';
import { exportDeckToCSV, parseCSV } from './csv.js';
import { uploadToDrive, downloadFromDrive, listDrivePdfs, downloadPdfFromDrive } from './drive.js';

// State
let currentDeckId = null;
let currentDeckName = '';
let currentCards = [];
let studyCards = [];
let studyIndex = 0;
let studyStats = { know: 0, forgot: 0 };
let deckToRenameId = null;
let studySourceView = 'decks';

const showToast = (message) => {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.style.transform = 'translateX(-50%) translateY(0)';
    toast.style.opacity = '1';
    
    if (toast.timeoutId) clearTimeout(toast.timeoutId);
    toast.timeoutId = setTimeout(() => {
        toast.style.transform = 'translateX(-50%) translateY(100px)';
        toast.style.opacity = '0';
    }, 3000);
};

// UI Progress updater
const updateProgressBanner = (progress) => {
    const banner = document.getElementById('bg-task-banner');
    if (!progress) {
        banner.style.display = 'none';
        return;
    }
    banner.style.display = 'block';
    
    if (progress.status === 'error') {
        document.getElementById('bg-task-title').innerHTML = `<span style="color: red;">Error: ${progress.errorMsg || 'Failed'}</span>`;
        document.getElementById('bg-task-percent').textContent = '';
        document.getElementById('bg-task-fill').style.width = '100%';
        document.getElementById('bg-task-fill').style.backgroundColor = 'red';
        document.getElementById('bg-task-spinner').style.display = 'none';
        return;
    }

    document.getElementById('bg-task-spinner').style.display = 'block';
    const percent = Math.round((progress.current / progress.total) * 100) || 0;
    
    if (progress.status === 'saving') {
        document.getElementById('bg-task-title').textContent = 'Saving Cards...';
    } else {
        document.getElementById('bg-task-title').textContent = `Analyzing "${progress.deckName}"`;
    }
    
    document.getElementById('bg-task-percent').textContent = `${percent}%`;
    document.getElementById('bg-task-fill').style.width = `${percent}%`;
    document.getElementById('bg-task-fill').style.backgroundColor = 'var(--text-primary)';
};

document.getElementById('btn-close-bg-task')?.addEventListener('click', () => {
    chrome.storage.local.remove('pdfProgress');
    document.getElementById('bg-task-banner').style.display = 'none';
});

// Listen for progress updates
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.pdfProgress) {
        updateProgressBanner(changes.pdfProgress.newValue);
    }
});

// Check on boot
chrome.storage.local.get(['pdfProgress'], (res) => {
    if (res.pdfProgress) updateProgressBanner(res.pdfProgress);
});

const showConfirm = (message, okText = "Delete", isDanger = true) => {
    return new Promise((resolve) => {
        const modal = document.getElementById('modal-confirm');
        document.getElementById('confirm-message').textContent = message;
        modal.style.display = 'flex';
        
        const btnOk = document.getElementById('btn-ok-confirm');
        btnOk.textContent = okText.toUpperCase();
        if (isDanger) {
            btnOk.classList.add('danger');
            btnOk.classList.remove('primary');
        } else {
            btnOk.classList.remove('danger');
            btnOk.classList.add('primary');
        }
        const btnCancel = document.getElementById('btn-cancel-confirm');
        
        const cleanup = () => {
            modal.style.display = 'none';
            btnOk.removeEventListener('click', onOk);
            btnCancel.removeEventListener('click', onCancel);
        };
        
        const onOk = () => { cleanup(); resolve(true); };
        const onCancel = () => { cleanup(); resolve(false); };
        
        btnOk.addEventListener('click', onOk);
        btnCancel.addEventListener('click', onCancel);
    });
};

const views = {
    decks: document.getElementById('view-decks'),
    deckDetails: document.getElementById('view-deck-details'),
    study: document.getElementById('view-study'),
    studyComplete: document.getElementById('view-study-complete'),
    stats: document.getElementById('view-stats')
};

const showView = (viewName) => {
    Object.values(views).forEach(v => v.classList.remove('active'));
    views[viewName].classList.add('active');
};


const saveStudySession = () => {
    if (studyCards && studyCards.length > 0 && studyIndex < studyCards.length) {
        try {
            localStorage.setItem('activeStudySession', JSON.stringify({
                deckId: currentDeckId,
                deckName: currentDeckName,
                cardIds: studyCards.map(c => c.id),
                index: studyIndex,
                stats: studyStats,
                sourceView: studySourceView
            }));
        } catch(e) {
            console.error("Failed to save session:", e);
        }
    } else {
        clearStudySession();
    }
};

const clearStudySession = () => {
    localStorage.removeItem('activeStudySession');
};

const checkSavedSession = async () => {
    const saved = localStorage.getItem('activeStudySession');
    if (saved) {
        try {
            const session = JSON.parse(saved);
            const hasCards = session.cardIds || session.cards;
            
            if (session.deckId !== undefined && session.deckName && hasCards && session.index !== undefined) {
                currentDeckId = session.deckId;
                currentDeckName = session.deckName;
                studyIndex = session.index;
                studyStats = session.stats || { know: 0, forgot: 0 };
                studySourceView = session.sourceView || 'deckDetails';
                
                document.getElementById('deck-title').textContent = currentDeckName;
                
                const allCards = await getCardsByDeck(currentDeckId);
                currentCards = allCards;
                
                if (session.cardIds) {
                    studyCards = session.cardIds.map(id => allCards.find(c => c.id === id)).filter(c => c);
                } else {
                    studyCards = session.cards;
                }
                
                if (studyCards.length === 0 || studyIndex >= studyCards.length) {
                    clearStudySession();
                    return false;
                }
                
                document.getElementById('traditional-actions-container').style.display = 'flex';
                updateStudyView();
                showView('study');
                return true;
            } else {
                clearStudySession();
            }
        } catch (e) {
            clearStudySession();
        }
    }
    return false;
};

document.addEventListener('DOMContentLoaded', async () => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
    }

    await initDB();
    await loadDecks();
    await checkSavedSession();
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

let currentFolderId = null;

const getWorkspaceName = () => localStorage.getItem('workspace_name') || 'My Workspace';

document.getElementById('btn-edit-workspace').addEventListener('click', () => {
    document.getElementById('edit-workspace-name').value = getWorkspaceName();
    document.getElementById('modal-edit-workspace').style.display = 'flex';
    document.getElementById('edit-workspace-name').focus();
});

document.getElementById('btn-cancel-edit-workspace').addEventListener('click', () => {
    document.getElementById('modal-edit-workspace').style.display = 'none';
});

document.getElementById('btn-save-edit-workspace').addEventListener('click', () => {
    const newName = document.getElementById('edit-workspace-name').value.trim();
    if (newName) {
        localStorage.setItem('workspace_name', newName);
        document.getElementById('workspace-title').textContent = newName;
        loadDecks();
    }
    document.getElementById('modal-edit-workspace').style.display = 'none';
});

// Initialize workspace title
document.getElementById('workspace-title').textContent = getWorkspaceName();

let folderPath = []; // Array of {id, name} for breadcrumbs

const loadDecks = async (searchQuery = '') => {
    let allDecks = await getDecks();
    let allFolders = await getFolders();
    
    // Filter to current folder
    let decks = allDecks.filter(d => (d.folderId || null) === currentFolderId);
    let folders = allFolders.filter(f => (f.parentId || null) === currentFolderId);
    
    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        decks = allDecks.filter(d => d.name.toLowerCase().includes(q));
        folders = allFolders.filter(f => f.name.toLowerCase().includes(q));
    }
    
    const list = document.getElementById('decks-list');
    list.innerHTML = '';
    
    // Breadcrumb UI
    if (currentFolderId !== null) {
        const backEl = document.createElement('div');
        backEl.className = 'deck-item';
        backEl.style.cursor = 'pointer';
        backEl.innerHTML = `<div style="font-weight: bold; display: flex; align-items: center; gap: 8px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
            Back to ${folderPath.length > 1 ? folderPath[folderPath.length-2].name : getWorkspaceName()}
        </div>`;
        backEl.addEventListener('click', () => {
            folderPath.pop();
            currentFolderId = folderPath.length > 0 ? folderPath[folderPath.length-1].id : null;
            loadDecks();
        });
        
        backEl.addEventListener('dragover', (e) => {
            e.preventDefault();
            backEl.classList.add('drag-over');
        });
        backEl.addEventListener('dragleave', (e) => {
            e.preventDefault();
            backEl.classList.remove('drag-over');
        });
        backEl.addEventListener('drop', async (e) => {
            e.preventDefault();
            backEl.classList.remove('drag-over');
            
            const targetParentId = folderPath.length > 1 ? folderPath[folderPath.length-2].id : null;
            const targetName = folderPath.length > 1 ? folderPath[folderPath.length-2].name : getWorkspaceName();
            
            try {
                const data = JSON.parse(e.dataTransfer.getData('application/json'));
                if (data.type === 'deck') {
                    const deckToMove = allDecks.find(d => d.id == data.id);
                    if (deckToMove && await showConfirm(`Move "${deckToMove.name}" to "${targetName}"?`, "Move", false)) {
                        await updateDeck(deckToMove.id, deckToMove.name, targetParentId);
                        loadDecks();
                    }
                } else if (data.type === 'folder') {
                    const folderToMove = allFolders.find(f => f.id == data.id);
                    if (folderToMove && await showConfirm(`Move "${folderToMove.name}" to "${targetName}"?`, "Move", false)) {
                        await updateFolder(folderToMove.id, undefined, undefined, targetParentId);
                        loadDecks();
                    }
                }
            } catch (err) {}
        });
        
        list.appendChild(backEl);
    }
    
    // Render Folders
    for (const folder of folders) {
        const el = document.createElement('div');
        el.className = 'deck-item';
        el.style.borderLeft = `8px solid ${folder.color || 'var(--border-color)'}`;
        el.innerHTML = `
            <div class="deck-item-info" title="Open Folder" style="display: flex; align-items: center; gap: 12px; min-width: 0;">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="${folder.color || 'var(--bg-secondary)'}" stroke="${folder.color || 'currentColor'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                <div class="deck-title-text">${folder.name}</div>
            </div>
            <div class="dropdown">
                <button class="icon-btn btn-deck-menu" data-id="${folder.id}" style="display: flex; align-items: center; justify-content: center;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>
                </button>
                <div class="dropdown-content" id="dropdown-folder-${folder.id}">
                    <button class="btn-folder-study" data-id="${folder.id}">Study Decks</button>
                    <button class="btn-folder-edit" data-id="${folder.id}">Edit</button>
                    <button class="btn-folder-delete" data-id="${folder.id}">Delete</button>
                </div>
            </div>
        `;
        
        // Make Folder Draggable
        el.draggable = true;
        el.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('application/json', JSON.stringify({ type: 'folder', id: folder.id }));
            e.dataTransfer.effectAllowed = 'move';
        });

        // Folder Drop Target
        el.addEventListener('dragover', (e) => {
            e.preventDefault();
            el.classList.add('drag-over');
        });
        el.addEventListener('dragleave', (e) => {
            e.preventDefault();
            el.classList.remove('drag-over');
        });
        el.addEventListener('drop', async (e) => {
            e.preventDefault();
            el.classList.remove('drag-over');
            try {
                // Try JSON parsing first
                const dataStr = e.dataTransfer.getData('application/json');
                if (dataStr) {
                    const data = JSON.parse(dataStr);
                    if (data.type === 'deck') {
                        const deckToMove = allDecks.find(d => d.id == data.id);
                        if (deckToMove && await showConfirm(`Move "${deckToMove.name}" to "${folder.name}"?`, "Move", false)) {
                            await updateDeck(deckToMove.id, deckToMove.name, folder.id);
                            loadDecks();
                        }
                    } else if (data.type === 'folder') {
                        if (data.id == folder.id) return;
                        
                        let current = folder;
                        while (current.parentId) {
                            if (current.parentId == data.id) {
                                showToast("Cannot move a folder into its own subfolder.");
                                return;
                            }
                            current = allFolders.find(f => f.id == current.parentId);
                            if (!current) break;
                        }
                        
                        const folderToMove = allFolders.find(f => f.id == data.id);
                        if (folderToMove && await showConfirm(`Move "${folderToMove.name}" to "${folder.name}"?`, "Move", false)) {
                            await updateFolder(folderToMove.id, undefined, undefined, folder.id);
                            loadDecks();
                        }
                    }
                } else {
                    // Fallback for old text/plain deck drags if any
                    const deckId = e.dataTransfer.getData('text/plain');
                    if (deckId) {
                        const deckToMove = allDecks.find(d => d.id == deckId);
                        if (deckToMove && await showConfirm(`Move "${deckToMove.name}" to "${folder.name}"?`, "Move", false)) {
                            await updateDeck(deckToMove.id, deckToMove.name, folder.id);
                            loadDecks();
                        }
                    }
                }
            } catch (err) {}
        });
        
        el.addEventListener('click', () => {
            currentFolderId = folder.id;
            folderPath.push({id: folder.id, name: folder.name});
            loadDecks();
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
        
        el.querySelector('.btn-folder-study').addEventListener('click', async (e) => {
            e.stopPropagation();
            dropdown.classList.remove('show');
            const cards = await getCardsByFolder(folder.id);
            if (cards.length === 0) {
                showToast("No cards found in this folder's decks.");
                return;
            }
            currentDeckName = `${folder.name} (Folder)`;
            currentDeckId = `folder_${folder.id}`; 
            currentCards = cards;
            startStudySession('decks');
        });

        el.querySelector('.btn-folder-edit').addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.remove('show');
            openAddItemModal('folder', folder);
        });

        el.querySelector('.btn-folder-delete').addEventListener('click', async (e) => {
            e.stopPropagation();
            dropdown.classList.remove('show');
            if (await showConfirm(`Delete folder "${folder.name}"? Decks inside will be moved to workspace.`)) {
                const childrenDecks = allDecks.filter(d => d.folderId === folder.id);
                for (let d of childrenDecks) {
                    await updateDeck(d.id, d.name, null);
                }
                const childrenFolders = allFolders.filter(f => f.parentId === folder.id);
                for (let f of childrenFolders) {
                    await updateFolder(f.id, f.name, f.color, null);
                }
                await deleteFolder(folder.id);
                loadDecks();
            }
        });
        
        list.appendChild(el);
    }
    
    // Render Decks
    for (const deck of decks) {
        const cards = await getCardsByDeck(deck.id);
        const mastered = cards.filter(c => c.status === 'mastered').length;
        
        const el = document.createElement('div');
        el.className = 'deck-item';
        el.innerHTML = `
            <div class="deck-item-info" title="Click to Study" style="display: flex; align-items: center; gap: 12px; min-width: 0;">
                <svg width="20" height="24" viewBox="0 0 28 36" style="flex-shrink: 0; overflow: visible;"><rect x="4" y="4" width="24" height="32" fill="var(--shadow-color)"></rect><rect x="0" y="0" width="24" height="32" fill="var(--bg-secondary)" stroke="var(--text-primary)" stroke-width="3"></rect></svg>
                <div style="min-width: 0;">
                    <div class="deck-title-text">${deck.name}</div>
                    <div class="deck-stats">${cards.length} cards | ${mastered} mastered</div>
                </div>
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
        
        // Make Deck Draggable
        el.draggable = true;
        el.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('application/json', JSON.stringify({ type: 'deck', id: deck.id }));
            // Also set text/plain as fallback if needed elsewhere
            e.dataTransfer.setData('text/plain', deck.id);
            e.dataTransfer.effectAllowed = 'move';
        });
        
        el.addEventListener('click', async () => {
            currentDeckId = deck.id;
            currentDeckName = deck.name;
            currentCards = await getCardsByDeck(deck.id);
            if (currentCards.length === 0) {
                showToast("This deck is empty! Taking you to Edit mode to add cards.");
                openDeck(deck.id, deck.name);
            } else {
                document.getElementById('deck-title').textContent = deck.name;
                startStudySession('decks');
            }
        });
        
        const menuBtn = el.querySelector('.btn-deck-menu');
        const dropdown = el.querySelector('.dropdown');
        
        menuBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            document.querySelectorAll('.dropdown.show').forEach(d => {
                if (d !== dropdown) d.classList.remove('show');
            });
            dropdown.classList.toggle('show');
        });

        el.querySelector('.btn-deck-edit').addEventListener('click', async (e) => {
            e.stopPropagation();
            dropdown.classList.remove('show');
            openDeck(deck.id, deck.name);
        });

        el.querySelector('.btn-deck-delete').addEventListener('click', async (e) => {
            e.stopPropagation();
            dropdown.classList.remove('show');
            if (await showConfirm(`Delete deck "${deck.name}"?`)) {
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
                showToast("No cards to export.");
            } else {
                exportDeckToCSV(deck.name, cards);
            }
        });
        
        list.appendChild(el);
    }
};


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

document.getElementById('file-import').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (file.type === 'application/pdf') {
        await handlePDFUpload(file);
        e.target.value = '';
        return;
    }
    
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
            showToast(`Imported ${cards.length} cards into "${deckName}"`);
        } else {
            showToast("No cards found or invalid CSV format.");
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
    
    const mastered = currentCards.filter(c => c.status === 'mastered').length;
    const total = currentCards.length;
    const mastery = total > 0 ? Math.round((mastered / total) * 100) : 0;
    document.getElementById('deck-accuracy').textContent = `${mastery}% Mastery (${mastered}/${total})`;
    
    const list = document.getElementById('cards-list');
    list.innerHTML = '';
    
    currentCards.forEach(card => {
        const el = document.createElement('div');
        el.className = 'card-item';
        el.style.display = 'flex';
        el.style.gap = '12px';
        el.style.justifyContent = 'space-between';
        
        el.innerHTML = `
            <div class="card-content-area" style="cursor: pointer; flex: 1; min-width: 0;">
                <div class="term" style="margin-bottom: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${card.term} ${card.type === 'cloze' ? `<span class="pill">cloze</span>` : ''} ${card.image ? ` <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>` : ''}</div>
                <div class="definition" style="color: var(--text-secondary); font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${card.definition}</div>
                <div style="margin-top: 8px; font-size: 10px; font-weight: bold;">Status: ${card.status.toUpperCase()}</div>
            </div>
            <div class="card-actions" style="display: flex; gap: 8px; flex-direction: column; justify-content: center;">
                <button class="icon-btn btn-preview-card" data-id="${card.id}" title="Preview Card" style="border: 2px solid var(--border-color); background: var(--bg-secondary);">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                </button>
                <button class="icon-btn btn-delete-card" data-id="${card.id}" title="Delete Card" style="border: 2px solid #ff4444; color: #ff4444; background: var(--bg-secondary);">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
            </div>
        `;
        
        el.querySelector('.card-content-area').addEventListener('click', () => openEditCardModal(card));
        
        el.querySelector('.btn-preview-card').addEventListener('click', (e) => {
            e.stopPropagation();
            openPreviewModal(card);
        });
        
        el.querySelector('.btn-delete-card').addEventListener('click', async (e) => {
            e.stopPropagation();
            if (await showConfirm(`Delete card "${card.term}"?`)) {
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

// Card mode toggle
let addCardMode = 'standard'; // 'standard' or 'fitb'

document.getElementById('btn-mode-card').addEventListener('click', () => {
    addCardMode = 'standard';
    document.getElementById('btn-mode-card').classList.add('active');
    document.getElementById('btn-mode-fitb').classList.remove('active');
    document.getElementById('card-fields-standard').style.display = 'block';
    document.getElementById('card-fields-fitb').style.display = 'none';
    document.getElementById('btn-add-card').textContent = 'Add Card';
});

document.getElementById('btn-mode-fitb').addEventListener('click', () => {
    addCardMode = 'fitb';
    document.getElementById('btn-mode-fitb').classList.add('active');
    document.getElementById('btn-mode-card').classList.remove('active');
    document.getElementById('card-fields-standard').style.display = 'none';
    document.getElementById('card-fields-fitb').style.display = 'block';
    document.getElementById('btn-add-card').textContent = 'Add Fill in the Blank';
});

document.getElementById('btn-add-card').addEventListener('click', async () => {
    if (addCardMode === 'fitb') {
        const sentence = document.getElementById('input-fitb-sentence').value.trim();
        const answer = document.getElementById('input-fitb-answer').value.trim();
        
        if (!sentence || !answer) {
            showToast("Sentence and Answer are required.");
            return;
        }
        
        if (!sentence.toLowerCase().includes(answer.toLowerCase())) {
            showToast("The answer must appear in the sentence.");
            return;
        }
        
        await addCard({
            deckId: currentDeckId,
            term: sentence,
            definition: answer,
            example: '',
            status: 'new',
            type: 'cloze'
        });
        
        document.getElementById('input-fitb-sentence').value = '';
        document.getElementById('input-fitb-answer').value = '';
        loadCards();
    } else {
        const term = document.getElementById('input-term').value.trim();
        const def = document.getElementById('input-def').value.trim();
        const ex = document.getElementById('input-ex').value.trim();
        
        if (term && def) {
            await addCard({
                deckId: currentDeckId,
                term,
                definition: def,
                example: ex,
                status: 'new',
                image: currentPastedImage,
                type: 'standard'
            });
            document.getElementById('input-term').value = '';
            document.getElementById('input-def').value = '';
            document.getElementById('input-ex').value = '';
            document.getElementById('input-image-paste').value = '';
            
            currentPastedImage = null;
            document.getElementById('image-preview').src = '';
            document.getElementById('image-preview-container').style.display = 'none';
            
            loadCards();
        } else {
            showToast("Term and Definition are required.");
        }
    }
});






let currentStudyMode = 'traditional';

const startStudySession = (source) => {
    studySourceView = source || 'deckDetails';
    currentStudyMode = 'traditional';
    
    if (currentCards.length === 0) {
        showToast("Add some cards to study first!");
        return;
    }
    
    studyCards = [...currentCards].sort(() => Math.random() - 0.5);
    document.getElementById('traditional-actions-container').style.display = 'flex';
    
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
    saveStudySession();
    
    const card = studyCards[studyIndex];
    document.getElementById('study-progress-text').textContent = `${studyIndex + 1} of ${studyCards.length}`;
    document.getElementById('study-progress-fill').style.width = `${((studyIndex) / studyCards.length) * 100}%`;
    
    // Reset UI state
    document.getElementById('flashcard').className = 'flashcard';
    document.getElementById('cloze-input-container').style.display = 'none';
    document.getElementById('input-cloze').value = '';
    document.getElementById('input-cloze').className = '';
    document.getElementById('btn-submit-cloze').textContent = 'Check';
    document.getElementById('btn-submit-cloze').className = 'primary';
    
    // Clean up any old feedback
    const oldFeedback = document.getElementById('cloze-feedback-msg');
    if (oldFeedback) oldFeedback.remove();
    
    // Image support
    const imgEl = document.getElementById('study-image-front');
    if (card.image) {
        imgEl.src = card.image;
        imgEl.style.display = 'block';
    } else {
        imgEl.style.display = 'none';
    }
    
    const exEl = document.getElementById('study-ex');
    
    if (card.type === 'cloze') {
        // FITB card UI
        document.getElementById('traditional-actions-container').style.display = 'none';
        document.getElementById('study-hint-tap').style.display = 'none';
        document.getElementById('cloze-input-container').style.display = 'block';
        
        let answer = card.definition.trim();
        const escapedAnswer = answer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const answerRegex = new RegExp(escapedAnswer, 'i');
        
        let frontText = '';
        let backText = '';
        
        // If the AI put '___' or '___' in the term itself:
        if (card.term.includes('___')) {
            frontText = card.term.replace(/_+/g, '<span class="cloze-blank"></span>');
            backText = card.term.replace(/_+/g, '<span class="cloze-highlight" id="study-cloze-highlight">' + answer + '</span>');
        } 
        // If the AI provided the full sentence and we need to hide the answer:
        else if (answerRegex.test(card.term)) {
            frontText = card.term.replace(answerRegex, '<span class="cloze-blank"></span>');
            backText = card.term.replace(answerRegex, '<span class="cloze-highlight" id="study-cloze-highlight">' + answer + '</span>');
        } 
        // Fallback: AI provided a sentence that doesn't perfectly contain the exact answer string
        else {
            frontText = card.term + '<br><br><span class="cloze-blank"></span>';
            backText = card.term + '<br><br><span class="cloze-highlight" id="study-cloze-highlight">' + answer + '</span>';
        }
        
        document.getElementById('study-term').innerHTML = frontText;
        document.getElementById('study-def').innerHTML = backText;
        exEl.style.display = 'none';
        
        // Auto-focus input for convenience
        setTimeout(() => document.getElementById('input-cloze').focus(), 100);
        
    } else {
        // Standard card UI
        document.getElementById('traditional-actions-container').style.display = 'flex';
        document.getElementById('study-hint-tap').style.display = 'block';
        
        document.getElementById('study-term').innerHTML = marked.parse(card.term);
        document.getElementById('study-def').innerHTML = marked.parse(card.definition);
        
        if (card.example) {
            exEl.innerHTML = marked.parse(`> "${card.example}"`);
            exEl.style.display = 'block';
        } else {
            exEl.style.display = 'none';
        }
    }
};

document.getElementById('flashcard').addEventListener('click', (e) => {
    if (e.target.closest('#cloze-input-container')) return; // Don't flip if interacting with input
    
    const card = studyCards[studyIndex];
    if (card && card.type !== 'cloze') {
        document.getElementById('flashcard').classList.toggle('flipped');
    }
});

document.getElementById('btn-submit-cloze').addEventListener('click', () => {
    const card = studyCards[studyIndex];
    if (!card || card.type !== 'cloze') return;
    
    const inputEl = document.getElementById('input-cloze');
    const btn = document.getElementById('btn-submit-cloze');
    
    if (btn.textContent === 'Continue') {
        // Automatically mark as know or forgot based on if they were right or wrong?
        // Let's assume if it had the correct class, it's a 'know', else 'forgot'
        const isCorrect = inputEl.classList.contains('cloze-input-correct');
        handleTraditionalResult(isCorrect);
        return;
    }
    
    const userAnswer = inputEl.value.trim().toLowerCase();
    const correctAnswer = card.definition.toLowerCase();
    
    // Clean up old feedback just in case it existed
    const oldFeedback = document.getElementById('cloze-feedback-msg');
    if (oldFeedback) oldFeedback.remove();
    
    const highlightEl = document.getElementById('study-cloze-highlight');
    
    if (userAnswer === correctAnswer) {
        inputEl.className = 'cloze-input-correct cloze-correct';
        if (highlightEl) highlightEl.className = 'cloze-highlight cloze-highlight-correct';
    } else {
        inputEl.className = 'cloze-input-wrong cloze-wrong';
        if (highlightEl) highlightEl.className = 'cloze-highlight cloze-highlight-wrong';
    }
    
    // Flip the card to reveal the highlight
    document.getElementById('flashcard').classList.add('flipped');
    
    // Change button to Continue
    btn.textContent = 'Continue';
    btn.className = 'secondary';
});

document.getElementById('input-cloze').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        document.getElementById('btn-submit-cloze').click();
    }
});

const handleTraditionalResult = async (know) => {
    try {
        const card = studyCards[studyIndex];
        if (know) {
            studyStats.know++;
            card.status = 'mastered';
        } else {
            studyStats.forgot++;
            card.status = 'learning';
        }
        await updateCard(card);
        await recordStudyResult(know);
        
        studyIndex++;
        updateStudyView();
    } catch(err) {
        console.error(err);
    }
};

document.getElementById('btn-study-forgot-trad').addEventListener('click', () => handleTraditionalResult(false));
document.getElementById('btn-study-know-trad').addEventListener('click', () => handleTraditionalResult(true));
document.getElementById('btn-study-skip-trad').addEventListener('click', () => {
    studyIndex++;
    updateStudyView();
});

document.getElementById('btn-back-details').addEventListener('click', () => {
    clearStudySession();
    if (studySourceView === 'decks') {
        loadDecks();
        showView('decks');
    } else {
        loadCards();
        showView('deckDetails');
    }
});

const showStudyComplete = () => {
    clearStudySession();
    document.getElementById('study-progress-fill').style.width = '100%';
    document.getElementById('study-results').innerHTML = `
        <strong>${studyStats.know}</strong> Known <br>
        <strong>${studyStats.forgot}</strong> to Review
    `;
    showView('studyComplete');
    if (typeof confetti === 'function') {
        confetti({
            particleCount: 150,
            spread: 80,
            origin: { y: 0.6 }
        });
    }

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

// Modal Close handlers
document.getElementById('btn-cancel-import').addEventListener('click', () => {
    document.getElementById('modal-import-instructions').style.display = 'none';
    if (document.getElementById('checkbox-dont-show-import').checked) {
        chrome.storage.local.set({ hideImportInstructions: true });
    }
});

document.getElementById('btn-continue-import').addEventListener('click', () => {
    document.getElementById('modal-import-instructions').style.display = 'none';
    if (document.getElementById('checkbox-dont-show-import').checked) {
        chrome.storage.local.set({ hideImportInstructions: true });
    }
    document.getElementById('file-import-deck').click();
});

document.getElementById('link-download-ai-skill')?.addEventListener('click', (e) => {
    e.preventDefault();
    const skillContent = `# Retention Extension - CSV Generation Skill

You are an AI assistant generating flashcards for the "Retention" Chrome Extension. 

## Core Directives
Extract the most important concepts, facts, and terms from the text provided by the user. 
- Focus heavily on actual terms, core concepts, and mechanics. Ignore history and background fluff.
- Scale intelligently: Extract thoroughly for dense texts, but don't over-generate for sparse texts.
- Keep definitions EXTREMELY short. NEVER write a paragraph.

## Output Format
Create a **downloadable .csv file** for the user containing the flashcards.
The CSV MUST have exactly these columns in the header:
Term, Definition, Type, Example, Status

## Card Types & Strict Rules
The 'Type' column must be exactly 'standard' or 'fitb'.

1. 'standard' (Flashcard)
   - The 'Term' MUST be phrased as a clear question (e.g., "What is the function of X?", "Define X"). NEVER just output the standalone word/concept with no context.
   - The 'Definition' MUST be a single ultra-short fragment or sentence (MAXIMUM 15 WORDS). Use extreme brevity.

2. 'fitb' (Fill-in-the-blank)
   - The 'Term' (the full sentence) MUST be a single short sentence (MAXIMUM 15 WORDS). DO NOT replace the answer with "___".
   - The 'Definition' MUST be exactly 1 to 2 words MAX (this is the hidden answer).

## Example CSV Data
Term, Definition, Type, Example, Status
"What is the powerhouse of the cell?","Mitochondria","standard","It generates ATP.","new"
"The mitochondria generates most of the cell's ATP.","mitochondria","fitb","","new"
`;
    const blob = new Blob([skillContent], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'Retention_AI_Skill.md');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

const loadStats = async () => {
    const stats = await getStats();
    let totalKnow = 0;
    let totalForgot = 0;
    let streak = 0;
    
    if (stats.length > 0) {
        stats.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        for (const stat of stats) {
            totalKnow += stat.know;
            totalForgot += stat.forgot;
        }
        
        const today = new Date();
        today.setHours(0,0,0,0);
        let currentCheck = new Date(today);
        
        const hasToday = stats.some(s => s.date === today.toISOString().split('T')[0]);
        if (!hasToday) {
            currentCheck.setDate(currentCheck.getDate() - 1);
        }
        
        for (let i = 0; i < stats.length; i++) {
            const statDateStr = currentCheck.toISOString().split('T')[0];
            const found = stats.find(s => s.date === statDateStr);
            if (found) {
                streak++;
                currentCheck.setDate(currentCheck.getDate() - 1);
            } else {
                break;
            }
        }
    }
    
    const accuracy = totalKnow + totalForgot > 0 ? Math.round((totalKnow / (totalKnow + totalForgot)) * 100) : 0;
    
    const decks = await getDecks();
    let masteredCount = 0;
    for (const deck of decks) {
        const cards = await getCardsByDeck(deck.id);
        masteredCount += cards.filter(c => c.status === 'mastered').length;
    }
    
    document.getElementById('stat-streak').textContent = streak;
    document.getElementById('stat-accuracy').textContent = accuracy + '%';
    document.getElementById('stat-mastered').textContent = masteredCount;
};

document.getElementById('btn-view-stats').addEventListener('click', async () => {
    await loadStats();
    showView('stats');
});

document.getElementById('btn-back-stats').addEventListener('click', () => {
    showView('decks');
});

let currentPastedImage = null;

document.addEventListener('paste', (e) => {
    if (!views.deckDetails.classList.contains('active')) return;
    
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    for (let item of items) {
        if (item.type.indexOf('image') === 0) {
            const blob = item.getAsFile();
            const reader = new FileReader();
            reader.onload = (event) => {
                currentPastedImage = event.target.result;
                document.getElementById('image-preview').src = currentPastedImage;
                document.getElementById('image-preview-container').style.display = 'block';
            };
            reader.readAsDataURL(blob);
        }
    }
});

document.getElementById('btn-remove-image').addEventListener('click', () => {
    currentPastedImage = null;
    document.getElementById('image-preview').src = '';
    document.getElementById('image-preview-container').style.display = 'none';
});

pdfjsLib.GlobalWorkerOptions.workerSrc = 'js/pdf.worker.min.js';

document.getElementById('btn-open-settings').addEventListener('click', () => {
    chrome.storage.local.get(['openrouter_api_key'], (res) => {
        document.getElementById('input-api-key').value = res.openrouter_api_key || '';
    });
    document.getElementById('modal-settings').style.display = 'flex';
});

document.getElementById('btn-cancel-settings').addEventListener('click', () => {
    document.getElementById('modal-settings').style.display = 'none';
});

document.getElementById('btn-save-settings').addEventListener('click', () => {
    const key = document.getElementById('input-api-key').value.trim();
    if (key) {
        chrome.storage.local.set({ 'openrouter_api_key': key });
    } else {
        chrome.storage.local.remove('openrouter_api_key');
    }
    document.getElementById('modal-settings').style.display = 'none';
});

const dropzone = document.getElementById('dropzone-overlay');

let dragCounter = 0;
document.body.addEventListener('dragenter', (e) => {
    e.preventDefault();
    if (!e.dataTransfer.types.includes('Files')) return;
    dragCounter++;
    if (views.decks.classList.contains('active')) {
        dropzone.style.display = 'flex';
        dropzone.classList.remove('dropzone-loading');
    }
});

document.body.addEventListener('dragover', (e) => {
    e.preventDefault();
});

document.body.addEventListener('dragleave', (e) => {
    e.preventDefault();
    if (!e.dataTransfer.types.includes('Files')) return;
    dragCounter--;
    if (dragCounter === 0) {
        dropzone.style.display = 'none';
        dropzone.classList.remove('dropzone-loading');
    }
});

const brutalistLoaderHtml = `<div class="brutalist-loader"><div class="block"></div><div class="block"></div><div class="block"></div></div>`;

const handlePDFUpload = async (file) => {
    const res = await chrome.storage.local.get(['openrouter_api_key']);
    const apiKey = res.openrouter_api_key;
    if (!apiKey) {
        showToast("Please set your OpenRouter API key in Settings first!");
        document.getElementById('btn-open-settings').click();
        return;
    }
    
    try {
        dropzone.innerHTML = `${brutalistLoaderHtml}<h2 style="margin-bottom: 12px; font-size: 24px;">Processing PDF<span class="animated-dots"></span></h2><p style="color: var(--text-secondary); text-align: center; font-size: 14px;">Extracting text from all pages...</p>`;
        dropzone.style.display = 'flex';
        dropzone.classList.add('dropzone-loading');
        
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        
        let allText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            allText += pageText + ' \n';
        }
        
        // Chunk the text to prevent token limits on large PDFs
        const chunkSize = 15000; // Roughly 15k characters per chunk
        const textChunks = [];
        for (let i = 0; i < allText.length; i += chunkSize) {
            textChunks.push(allText.substring(i, i + chunkSize));
        }
        
        const deckName = file.name.replace('.pdf', '') || 'AI Generated Deck';
        
        chrome.runtime.sendMessage({
            action: 'PROCESS_PDF_CHUNKS',
            textChunks: textChunks,
            deckName: deckName,
            folderId: currentFolderId
        });
        
        dropzone.style.display = 'none';
        showToast("Processing PDF in background! You will receive a notification when finished.");
        
    } catch (err) {
        dropzone.style.display = 'none';
        showToast("PDF Error: " + err.message);
        console.error(err);
    }
};

document.body.addEventListener('drop', async (e) => {
    dragCounter = 0;
    e.preventDefault();
    dropzone.style.display = 'none';
        dropzone.classList.remove('dropzone-loading');
    
    if (!views.decks.classList.contains('active')) return;
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') {
        await handlePDFUpload(file);
    }
});

document.getElementById('btn-add-image').addEventListener('click', () => {
    document.getElementById('input-image').click();
});

document.getElementById('input-image').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.type.indexOf('image') === 0) {
        const reader = new FileReader();
        reader.onload = (event) => {
            currentPastedImage = event.target.result;
            document.getElementById('image-preview').src = currentPastedImage;
            document.getElementById('image-preview-container').style.display = 'block';
        };
        reader.readAsDataURL(file);
    }
    e.target.value = '';
});


document.getElementById('file-ai-pdf').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
        await handlePDFUpload(file);
    }
    e.target.value = '';
});

// Edit Card Modal Logic
let currentEditCardId = null;
let currentEditPastedImage = null;
let editCardMode = 'standard';

document.getElementById('btn-edit-mode-card').addEventListener('click', () => {
    editCardMode = 'standard';
    document.getElementById('btn-edit-mode-card').classList.add('active');
    document.getElementById('btn-edit-mode-fitb').classList.remove('active');
    document.getElementById('edit-card-fields-standard').style.display = 'block';
    document.getElementById('edit-card-fields-fitb').style.display = 'none';
});

document.getElementById('btn-edit-mode-fitb').addEventListener('click', () => {
    editCardMode = 'fitb';
    document.getElementById('btn-edit-mode-fitb').classList.add('active');
    document.getElementById('btn-edit-mode-card').classList.remove('active');
    document.getElementById('edit-card-fields-standard').style.display = 'none';
    document.getElementById('edit-card-fields-fitb').style.display = 'block';
});

const openEditCardModal = (card) => {
    currentEditCardId = card.id;
    currentEditPastedImage = card.image || null;
    
    if (card.type === 'cloze') {
        document.getElementById('btn-edit-mode-fitb').click();
        document.getElementById('edit-input-fitb-sentence').value = card.term || '';
        document.getElementById('edit-input-fitb-answer').value = card.definition || '';
    } else {
        document.getElementById('btn-edit-mode-card').click();
        document.getElementById('edit-input-term').value = card.term || '';
        document.getElementById('edit-input-def').value = card.definition || '';
        document.getElementById('edit-input-ex').value = card.example || '';
    }
    
    document.getElementById('edit-input-image-paste').value = '';
    
    if (card.image && card.type !== 'cloze') {
        document.getElementById('edit-image-preview').src = card.image;
        document.getElementById('edit-image-preview-container').style.display = 'block';
    } else {
        document.getElementById('edit-image-preview').src = '';
        document.getElementById('edit-image-preview-container').style.display = 'none';
    }
    
    document.getElementById('modal-edit-card').style.display = 'flex';
};

document.getElementById('btn-cancel-edit-card').addEventListener('click', () => {
    document.getElementById('modal-edit-card').style.display = 'none';
});

document.getElementById('btn-save-edit-card').addEventListener('click', async () => {
    if (!currentEditCardId) return;
    
    if (editCardMode === 'fitb') {
        const sentence = document.getElementById('edit-input-fitb-sentence').value.trim();
        const answer = document.getElementById('edit-input-fitb-answer').value.trim();
        
        if (!sentence || !answer) {
            showToast("Sentence and Answer are required.");
            return;
        }
        
        if (!sentence.toLowerCase().includes(answer.toLowerCase())) {
            showToast("The answer must appear in the sentence.");
            return;
        }
        
        await updateCard({
            id: currentEditCardId,
            deckId: currentDeckId,
            term: sentence,
            definition: answer,
            example: '',
            status: 'new',
            image: null,
            type: 'cloze'
        });
        document.getElementById('modal-edit-card').style.display = 'none';
        loadCards();
    } else {
        const term = document.getElementById('edit-input-term').value.trim();
        const def = document.getElementById('edit-input-def').value.trim();
        const ex = document.getElementById('edit-input-ex').value.trim();
        
        if (term && def) {
            await updateCard({
                id: currentEditCardId,
                deckId: currentDeckId,
                term,
                definition: def,
                example: ex,
                status: 'new',
                image: currentEditPastedImage,
                type: 'standard'
            });
            document.getElementById('modal-edit-card').style.display = 'none';
            loadCards();
        } else {
            showToast("Term and Definition are required!");
        }
    }
});

document.getElementById('btn-edit-image').addEventListener('click', () => {
    document.getElementById('edit-input-image').click();
});

document.getElementById('edit-input-image').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.type.indexOf('image') === 0) {
        const reader = new FileReader();
        reader.onload = (event) => {
            currentEditPastedImage = event.target.result;
            document.getElementById('edit-image-preview').src = currentEditPastedImage;
            document.getElementById('edit-image-preview-container').style.display = 'block';
        };
        reader.readAsDataURL(file);
    }
    e.target.value = '';
});

document.getElementById('btn-remove-edit-image').addEventListener('click', () => {
    currentEditPastedImage = null;
    document.getElementById('edit-image-preview').src = '';
    document.getElementById('edit-image-preview-container').style.display = 'none';
});

// Preview Modal Logic
const openPreviewModal = (card) => {
    
    const exEl = document.getElementById('preview-ex');
    
    if (card.type === 'cloze') {
        const answer = card.definition;
        const regex = new RegExp(answer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        const frontText = card.term.replace(regex, '<span class="cloze-blank"></span>');
        const backText = card.term.replace(regex, '<span class="cloze-highlight">' + answer + '</span>');
        
        document.getElementById('preview-term').innerHTML = frontText;
        document.getElementById('preview-def').innerHTML = backText;
        exEl.style.display = 'none';
        
    } else {
        document.getElementById('preview-term').innerHTML = marked.parse(card.term);
        document.getElementById('preview-def').innerHTML = marked.parse(card.definition);
        
        if (card.example) {
            exEl.innerHTML = marked.parse(`> "${card.example}"`);
            exEl.style.display = 'block';
        } else {
            exEl.style.display = 'none';
        }
    }
    
    const imgEl = document.getElementById('preview-image-front');
    if (card.image) {
        imgEl.src = card.image;
        imgEl.style.display = 'block';
    } else {
        imgEl.style.display = 'none';
    }
    
    // Hide the legacy cloze container if it exists
    const clozeContainer = document.getElementById('preview-cloze-container');
    if (clozeContainer) clozeContainer.style.display = 'none';
    
    document.getElementById('preview-flashcard').classList.remove('flipped');
    document.getElementById('modal-preview-card').style.display = 'flex';
};

document.getElementById('preview-flashcard').addEventListener('click', () => {
    document.getElementById('preview-flashcard').classList.toggle('flipped');
});

document.getElementById('btn-close-preview').addEventListener('click', () => {
    document.getElementById('modal-preview-card').style.display = 'none';
});

// Bind paste event for the edit modal as well
document.addEventListener('paste', (e) => {
    if (document.getElementById('modal-edit-card').style.display === 'flex') {
        const items = (e.clipboardData || e.originalEvent.clipboardData).items;
        for (let item of items) {
            if (item.type.indexOf('image') === 0) {
                const blob = item.getAsFile();
                const reader = new FileReader();
                reader.onload = (event) => {
                    currentEditPastedImage = event.target.result;
                    document.getElementById('edit-image-preview').src = currentEditPastedImage;
                    document.getElementById('edit-image-preview-container').style.display = 'block';
                };
                reader.readAsDataURL(blob);
            }
        }
    }
});

let addItemType = 'deck'; // 'deck' or 'folder'

document.getElementById('btn-add-menu').addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('add-dropdown-container').classList.toggle('show');
});

document.addEventListener('click', () => {
    document.getElementById('add-dropdown-container').classList.remove('show');
});

let editingFolderId = null;

document.getElementById('add-folder-color').addEventListener('input', (e) => {
    const preview = document.getElementById('preview-folder-icon');
    if (preview) {
        preview.setAttribute('fill', e.target.value);
        preview.setAttribute('stroke', e.target.value);
    }
});

const openAddItemModal = (type, editFolder = null) => {
    addItemType = type;
    editingFolderId = editFolder ? editFolder.id : null;
    document.getElementById('btn-save-add-item').textContent = editFolder ? 'Save' : 'Create';
    
    document.getElementById('add-item-name').value = editFolder ? editFolder.name : '';
    
    if (type === 'folder') {
        document.getElementById('add-item-title').textContent = editFolder ? 'Edit Folder' : 'New Folder';
        document.getElementById('add-folder-color-picker').style.display = 'flex';
        const color = editFolder ? (editFolder.color || '#4488ff') : '#4488ff';
        document.getElementById('add-folder-color').value = color;
        const preview = document.getElementById('preview-folder-icon');
        if (preview) {
            preview.setAttribute('fill', color);
            preview.setAttribute('stroke', color);
        }
    } else {
        document.getElementById('add-item-title').textContent = 'New Deck';
        document.getElementById('add-folder-color-picker').style.display = 'none';
    }
    
    document.getElementById('modal-add-item').style.display = 'flex';
    document.getElementById('add-item-name').focus();
};

document.getElementById('btn-menu-add-deck').addEventListener('click', () => openAddItemModal('deck'));
document.getElementById('btn-menu-add-folder').addEventListener('click', () => openAddItemModal('folder'));
document.getElementById('btn-menu-add-pdf').addEventListener('click', () => {
    document.getElementById('file-ai-pdf').click();
});

let currentDrivePageToken = '';
let currentDriveQuery = '';

const renderDriveFiles = (files, append = false) => {
    const listContainer = document.getElementById('drive-files-list');
    if (!append) listContainer.innerHTML = '';
    
    if (files.length === 0 && !append) {
        listContainer.innerHTML = '<p style="font-size: 14px; text-align: center; color: var(--text-secondary);">No PDFs found.</p>';
        return;
    }
    
    files.forEach(file => {
        const el = document.createElement('div');
        el.style.padding = '8px 12px';
        el.style.border = '2px solid var(--border-color)';
        el.style.cursor = 'pointer';
        el.style.display = 'flex';
        el.style.alignItems = 'center';
        el.style.gap = '8px';
        el.style.background = 'var(--bg-primary)';
        el.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink: 0;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            <span style="font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;">${file.name}</span>
        `;
        el.addEventListener('click', async () => {
            document.getElementById('modal-drive-picker').style.display = 'none';
            try {
                const dropzone = document.getElementById('dropzone-overlay');
                dropzone.style.display = 'flex';
                dropzone.classList.add('dropzone-loading');
                dropzone.innerHTML = `<h2 style="margin-bottom: 12px; font-size: 24px;">Downloading from Drive...</h2>`;
                
                const arrayBuffer = await downloadPdfFromDrive(file.id);
                const pdfFile = new File([arrayBuffer], file.name, { type: 'application/pdf' });
                await handlePDFUpload(pdfFile);
            } catch (err) {
                document.getElementById('dropzone-overlay').style.display = 'none';
                showToast("Drive Error: " + err.message);
            }
        });
        listContainer.appendChild(el);
    });
};

const loadDrivePdfs = async (append = false) => {
    const listContainer = document.getElementById('drive-files-list');
    const loadMoreBtn = document.getElementById('btn-drive-picker-load-more');
    if (!append) listContainer.innerHTML = '<p style="font-size: 14px; text-align: center; color: var(--text-secondary);">Loading...</p>';
    
    try {
        const data = await listDrivePdfs(currentDriveQuery, append ? currentDrivePageToken : '');
        renderDriveFiles(data.files || [], append);
        
        currentDrivePageToken = data.nextPageToken || '';
        loadMoreBtn.style.display = currentDrivePageToken ? 'block' : 'none';
    } catch (e) {
        if (!append) listContainer.innerHTML = `<p style="font-size: 14px; text-align: center; color: #ff4444;">${e.message}</p>`;
        showToast("Drive Error: " + e.message);
    }
};

document.getElementById('btn-menu-add-pdf-drive').addEventListener('click', () => {
    document.getElementById('drive-picker-search').value = '';
    currentDriveQuery = '';
    currentDrivePageToken = '';
    document.getElementById('modal-drive-picker').style.display = 'flex';
    document.getElementById('btn-drive-picker-load-more').style.display = 'none';
    loadDrivePdfs();
});

document.getElementById('drive-picker-search').addEventListener('input', (e) => {
    currentDriveQuery = e.target.value.trim();
    currentDrivePageToken = '';
    // Debounce or just load on every keystroke (with a small delay)
    clearTimeout(window.driveSearchTimeout);
    window.driveSearchTimeout = setTimeout(() => {
        loadDrivePdfs();
    }, 500);
});

document.getElementById('btn-drive-picker-load-more').addEventListener('click', () => {
    if (currentDrivePageToken) {
        document.getElementById('btn-drive-picker-load-more').textContent = 'Loading...';
        loadDrivePdfs(true).finally(() => {
            document.getElementById('btn-drive-picker-load-more').textContent = 'Load More';
        });
    }
});

document.getElementById('btn-cancel-drive-picker').addEventListener('click', () => {
    document.getElementById('modal-drive-picker').style.display = 'none';
});

document.getElementById('btn-cancel-add-item').addEventListener('click', () => {
    document.getElementById('modal-add-item').style.display = 'none';
    editingFolderId = null;
});

document.getElementById('btn-save-add-item').addEventListener('click', async () => {
    const name = document.getElementById('add-item-name').value.trim();
    if (!name) return;
    
    if (addItemType === 'folder') {
        const color = document.getElementById('add-folder-color').value;
        if (editingFolderId) {
            await updateFolder(editingFolderId, name, color);
        } else {
            await addFolder(name, color, currentFolderId);
        }
    } else {
        await addDeck(name, currentFolderId);
    }
    
    document.getElementById('modal-add-item').style.display = 'none';
    editingFolderId = null;
    loadDecks(); // reload workspace
});


document.getElementById('input-search').addEventListener('input', (e) => {
    loadDecks(e.target.value.trim());
});


document.getElementById('btn-sync-upload').addEventListener('click', async () => {
    try {
        const btn = document.getElementById('btn-sync-upload');
        btn.textContent = 'Uploading...';
        await uploadToDrive();
        showToast("Successfully backed up to Google Drive!");
    } catch (e) {
        showToast("Error: " + (e.message || e));
    } finally {
        document.getElementById('btn-sync-upload').textContent = 'Upload to Drive';
    }
});

document.getElementById('btn-sync-download').addEventListener('click', async () => {
    try {
        const btn = document.getElementById('btn-sync-download');
        btn.textContent = 'Downloading...';
        await downloadFromDrive();
        showToast("Successfully restored from Google Drive!");
        loadDecks();
    } catch (e) {
        showToast("Error: " + (e.message || e));
    } finally {
        document.getElementById('btn-sync-download').textContent = 'Download from Drive';
    }
});

chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'REFRESH_DECKS') {
        loadDecks();
    }
});
