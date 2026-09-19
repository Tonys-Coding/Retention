import { initDB, addDeck, getDecks, deleteDeck, addCard, getCardsByDeck, deleteCard, updateCard, updateDeck, getStats, recordStudyResult } from './db.js';
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

const showConfirm = (message) => {
    return new Promise((resolve) => {
        const modal = document.getElementById('modal-confirm');
        document.getElementById('confirm-message').textContent = message;
        modal.style.display = 'flex';
        
        const btnOk = document.getElementById('btn-ok-confirm');
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


let folderPath = []; // Array of {id, name} for breadcrumbs

const loadDecks = async () => {
    let allDecks = await getDecks();
    let allFolders = await getFolders();
    
    // Filter to current folder
    const decks = allDecks.filter(d => (d.folderId || null) === currentFolderId);
    const folders = allFolders.filter(f => (f.parentId || null) === currentFolderId);
    
    const list = document.getElementById('decks-list');
    list.innerHTML = '';
    
    // Breadcrumb UI
    if (currentFolderId !== null) {
        const backEl = document.createElement('div');
        backEl.className = 'deck-item';
        backEl.style.cursor = 'pointer';
        backEl.style.background = 'var(--text-primary)';
        backEl.style.color = 'var(--bg-primary)';
        backEl.innerHTML = `<div style="font-weight: bold; display: flex; align-items: center; gap: 8px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
            Back to ${folderPath.length > 1 ? folderPath[folderPath.length-2].name : 'Workspace'}
        </div>`;
        backEl.addEventListener('click', () => {
            folderPath.pop();
            currentFolderId = folderPath.length > 0 ? folderPath[folderPath.length-1].id : null;
            loadDecks();
        });
        list.appendChild(backEl);
    }
    
    // Render Folders
    for (const folder of folders) {
        const el = document.createElement('div');
        el.className = 'deck-item';
        el.style.borderLeft = `8px solid ${folder.color || 'var(--border-color)'}`;
        el.innerHTML = `
            <div class="deck-item-info" title="Open Folder" style="display: flex; align-items: center; gap: 12px;">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${folder.color || 'currentColor'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                <div class="deck-title-text">${folder.name}</div>
            </div>
            <div class="dropdown">
                <button class="icon-btn btn-deck-menu" data-id="${folder.id}" style="display: flex; align-items: center; justify-content: center;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>
                </button>
                <div class="dropdown-content" id="dropdown-folder-${folder.id}">
                    <button class="btn-folder-delete" data-id="${folder.id}">Delete</button>
                </div>
            </div>
        `;
        
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
        
        el.querySelector('.btn-folder-delete').addEventListener('click', async (e) => {
            e.stopPropagation();
            if (await showConfirm(`Delete folder "${folder.name}"? Decks inside will be moved to workspace.`)) {
                // Move children to root
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
        
        el.querySelector('.btn-deck-edit').addEventListener('click', (e) => {
            e.stopPropagation();
            openDeck(deck.id, deck.name);
        });
        
        el.querySelector('.btn-deck-rename').addEventListener('click', async (e) => {
            e.stopPropagation();
            const newName = prompt('New deck name:', deck.name);
            if (newName && newName.trim()) {
                await updateDeck(deck.id, newName.trim(), deck.folderId);
                loadDecks();
            }
        });
        
        el.querySelector('.btn-deck-export').addEventListener('click', async (e) => {
            e.stopPropagation();
            const cards = await getCardsByDeck(deck.id);
            if (cards.length === 0) {
                showToast("No cards to export.");
                return;
            }
            exportDeckToCSV(deck.name, cards);
        });
        
        el.querySelector('.btn-deck-delete').addEventListener('click', async (e) => {
            e.stopPropagation();
            if (await showConfirm(`Delete deck "${deck.name}"?`)) {
                await deleteDeck(deck.id);
                loadDecks();
            }
        });
        
        list.appendChild(el);
    }
};

document.getElementById('btn-open-settings').addEventListener('click', () => {
    document.getElementById('input-api-key').value = localStorage.getItem('openrouter_api_key') || '';
    document.getElementById('modal-settings').style.display = 'flex';
});

document.getElementById('btn-cancel-settings').addEventListener('click', () => {
    document.getElementById('modal-settings').style.display = 'none';
});

document.getElementById('btn-save-settings').addEventListener('click', () => {
    const key = document.getElementById('input-api-key').value.trim();
    if (key) {
        localStorage.setItem('openrouter_api_key', key);
    } else {
        localStorage.removeItem('openrouter_api_key');
    }
    document.getElementById('modal-settings').style.display = 'none';
});

const dropzone = document.getElementById('dropzone-overlay');

document.body.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (views.decks.classList.contains('active')) {
        dropzone.style.display = 'flex';
        dropzone.classList.add('dropzone-loading');
    }
});

document.body.addEventListener('dragleave', (e) => {
    e.preventDefault();
    if (e.target === dropzone) {
        dropzone.style.display = 'none';
        dropzone.classList.remove('dropzone-loading');
    }
});

const brutalistLoaderHtml = `<div class="brutalist-loader"><div class="block"></div><div class="block"></div><div class="block"></div></div>`;

const handlePDFUpload = async (file) => {
    const apiKey = localStorage.getItem('openrouter_api_key');
    if (!apiKey) {
        showToast("Please set your OpenRouter API key in Settings first!");
        document.getElementById('btn-open-settings').click();
        return;
    }
    
    try {
        dropzone.innerHTML = `${brutalistLoaderHtml}<h2 style="margin-bottom: 8px;">Processing PDF...</h2><p style="color: var(--text-secondary); text-align: center; font-size: 14px;">Extracting text...</p>`;
        dropzone.style.display = 'flex';
        dropzone.classList.add('dropzone-loading');
        
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';
        const pagesToExtract = Math.min(pdf.numPages, 50); 
        for (let i = 1; i <= pagesToExtract; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            fullText += pageText + '\n';
        }
        
        dropzone.innerHTML = `${brutalistLoaderHtml}<h2 style="margin-bottom: 8px;">Generating Cards...</h2><p style="color: var(--text-secondary); text-align: center; font-size: 14px;">Looking for terms and definitions...</p>`;
        
        const prompt = `Extract the most important terms and definitions from this text. Return ONLY a valid JSON array of objects. Each object should have 'term' and 'definition' strings. Make the definitions concise. Here is the text:\n\n${fullText.substring(0, 150000)}`;
        
        const response = await fetch(`https://openrouter.ai/api/v1/chat/completions`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: "openrouter/free",
                messages: [
                    { role: "system", content: "You are a helpful assistant that strictly outputs JSON arrays of objects representing flashcards." },
                    { role: "user", content: prompt }
                ]
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            console.error("OpenRouter API Error details:", errorData);
            throw new Error(errorData.error?.message || "Unknown API Error");
        }
        const data = await response.json();
        const textResult = data.choices[0].message.content;
        
        const cleanText = textResult.replace(/```json/g, '').replace(/```/g, '').trim();
        const flashcards = JSON.parse(cleanText);
        
        if (flashcards && flashcards.length > 0) {
            const deckName = file.name.replace('.pdf', '') || 'AI Generated Deck';
            const deckId = await addDeck(deckName);
            for (const card of flashcards) {
                await addCard({
                    deckId: deckId,
                    term: card.term,
                    definition: card.definition,
                    status: 'new',
                    type: 'standard'
                });
            }
            loadDecks();
            showToast(`Successfully generated ${flashcards.length} cards from PDF!`);
        } else {
            showToast("No cards could be generated from this document.");
        }
        
    } catch (error) {
        console.error(error);
        showToast("Error generating cards: " + error.message);
    } finally {
        dropzone.style.display = 'none';
        dropzone.classList.remove('dropzone-loading');
        dropzone.innerHTML = `
            <h2 style="margin-bottom: 8px;">Drop PDF to generate cards</h2>
            <p style="color: var(--text-secondary); text-align: center; font-size: 14px; padding: 0 16px;">We'll use your OpenRouter API Key to extract terms and definitions automatically.</p>
        `;
    }
};

document.body.addEventListener('drop', async (e) => {
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

const openEditCardModal = (card) => {
    currentEditCardId = card.id;
    currentEditPastedImage = card.image || null;
    
    document.getElementById('edit-input-term').value = card.term || '';
    document.getElementById('edit-input-def').value = card.definition || '';
    document.getElementById('edit-input-ex').value = card.example || '';
    document.getElementById('edit-input-image-paste').value = '';
    
    if (card.image) {
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
    const term = document.getElementById('edit-input-term').value.trim();
    const def = document.getElementById('edit-input-def').value.trim();
    const ex = document.getElementById('edit-input-ex').value.trim();
    const isCloze = term.includes('{{') && term.includes('}}') || def.includes('{{') && def.includes('}}');
    
    if (term && def) {
        await updateCard({
            id: currentEditCardId,
            deckId: currentDeckId,
            term,
            definition: def,
            example: ex,
            status: 'new',
            image: currentEditPastedImage,
            type: isCloze ? 'cloze' : 'standard'
        });
        document.getElementById('modal-edit-card').style.display = 'none';
        loadCards();
    } else {
        showToast("Term and Definition are required!");
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
    document.getElementById('preview-term').textContent = card.type === 'cloze' ? card.term.replace(/{{(.*?)}}/g, '[___]') : card.term;
    document.getElementById('preview-def').textContent = card.definition;
    
    const exEl = document.getElementById('preview-ex');
    if (card.example) {
        exEl.textContent = `"${card.example}"`;
        exEl.style.display = 'block';
    } else {
        exEl.style.display = 'none';
    }
    
    const imgEl = document.getElementById('preview-image-front');
    if (card.image) {
        imgEl.src = card.image;
        imgEl.style.display = 'block';
    } else {
        imgEl.style.display = 'none';
    }
    
    const clozeContainer = document.getElementById('preview-cloze-container');
    if (card.type === 'cloze') {
        clozeContainer.style.display = 'block';
    } else {
        clozeContainer.style.display = 'none';
    }
    
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

// Workspace & Folder Logic
let currentFolderId = null; // null means root
let addItemType = 'deck'; // 'deck' or 'folder'

document.getElementById('btn-add-menu').addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('dropdown-add-menu').classList.toggle('show');
});

document.addEventListener('click', () => {
    document.getElementById('dropdown-add-menu').classList.remove('show');
});

const openAddItemModal = (type) => {
    addItemType = type;
    document.getElementById('add-item-name').value = '';
    document.getElementById('add-item-title').textContent = type === 'folder' ? 'New Folder' : 'New Deck';
    
    if (type === 'folder') {
        document.getElementById('add-folder-color-picker').style.display = 'flex';
    } else {
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

document.getElementById('btn-cancel-add-item').addEventListener('click', () => {
    document.getElementById('modal-add-item').style.display = 'none';
});

document.getElementById('btn-save-add-item').addEventListener('click', async () => {
    const name = document.getElementById('add-item-name').value.trim();
    if (!name) return;
    
    if (addItemType === 'folder') {
        const color = document.getElementById('add-folder-color').value;
        await addFolder(name, color, currentFolderId);
    } else {
        await addDeck(name, currentFolderId);
    }
    
    document.getElementById('modal-add-item').style.display = 'none';
    loadDecks(); // reload workspace
});

