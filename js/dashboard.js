import { isExtension, storage, runtime } from './env.js';
import { processChunksInPage } from './ai-processor.js';
import { uploadToDrive, downloadFromDrive, listDrivePdfs, downloadPdfFromDrive, initGoogleAuth } from './drive.js';
import { initDB, addFolder, getFolders, getDecks, addDeck, getCardsByDeck, getCardsByFolder, recordStudyResult, updateFolder, deleteFolder, updateDeck, deleteDeck, addCard, updateCard, deleteCard, getStats } from './db.js';
import { exportDeckToCSV } from './csv.js';

// ===== SVG ICONS =====
const ICON = {
    folder: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`,
    chevron: `<svg class="db-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`,
    deck: `<svg width="16" height="19" viewBox="0 0 28 36" style="flex-shrink:0;overflow:visible;"><rect x="4" y="4" width="24" height="32" fill="var(--shadow-color)"></rect><rect x="0" y="0" width="24" height="32" fill="var(--bg-secondary)" stroke="var(--text-primary)" stroke-width="3"></rect></svg>`,
    dots: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>`,
    trash: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`,
    eye: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`,
};

// ===== STATE =====
let currentView = 'home';
let currentFolderId = null;
let currentFolderName = '';
let editingDeckId = null;
let editingDeckName = '';
let studyCards = [];
let studyIndex = 0;
let studyStats = { know: 0, forgot: 0 };
let isFlipped = false;
let hasRevealed = false;
let isCloze = false;
let currentPastedImage = null;
let editPastedImage = null;

// ===== DOM REFS =====
const $ = id => document.getElementById(id);
const dom = {
    sidebarNav: $('sidebar-nav'),
    mainTitle: $('main-title'),
    btnBack: $('btn-back'),
    btnStudy: $('btn-study'),
    btnRestart: $('btn-restart'),
    btnEditWorkspace: $('btn-edit-workspace'),
    viewStatsBar: $('view-stats-bar'),
    statStreak: $('db-stat-streak'),
    statAccuracy: $('db-stat-accuracy'),
    statMastered: $('db-stat-mastered'),
    mainBody: $('main-body'),
    viewGrid: $('view-grid'),
    viewStudy: $('view-study'),
    viewComplete: $('view-complete'),
    viewDeck: $('view-deck'),
    flashcard: $('flashcard'),
    fcTerm: $('fc-term'),
    fcDef: $('fc-def'),
    fcEx: $('fc-ex'),
    fcImg: $('fc-img'),
    fcHint: $('fc-hint'),
    clozeArea: $('cloze-area'),
    clozeInput: $('cloze-input'),
    studyActions: $('study-actions'),
    studyProgress: $('study-progress'),
    studyMastery: $('study-mastery'),
    completeCount: $('complete-count'),
    modalOverlay: $('modal-add'),
    modalTitle: $('modal-title'),
    modalName: $('modal-name'),
    modalColorRow: $('modal-color-row'),
    modalColor: $('modal-color'),
};

// ===== TOAST =====
function showToast(msg) {
    let t = document.getElementById('db-toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('visible');
    
    if (t.timeoutId) clearTimeout(t.timeoutId);
    t.timeoutId = setTimeout(() => {
        t.classList.remove('visible');
    }, 2500);
}

// ===== WORKSPACE =====
const getWorkspaceName = () => localStorage.getItem('workspace_name') || 'My Workspace';

// ===== CONFIRM =====
function showConfirm(message, okText = 'Delete', isDanger = true) {
    return new Promise(resolve => {
        const overlay = $('modal-confirm');
        $('confirm-msg').textContent = message;
        const okBtn = $('confirm-ok');
        okBtn.textContent = okText;
        okBtn.className = isDanger ? 'danger' : 'primary';
        overlay.classList.add('active');
        $('confirm-cancel').onclick = () => { overlay.classList.remove('active'); resolve(false); };
        okBtn.onclick = () => { overlay.classList.remove('active'); resolve(true); };
    });
}

// ===== CONTEXT MENU =====
let activeMenu = null;
function closeMenus() {
    if (activeMenu) { activeMenu.remove(); activeMenu = null; }
}
document.addEventListener('click', closeMenus);

function showContextMenu(e, items) {
    e.stopPropagation();
    closeMenus();
    const menu = document.createElement('div');
    menu.className = 'db-context-menu';
    items.forEach(item => {
        const btn = document.createElement('button');
        btn.textContent = item.label;
        if (item.danger) btn.classList.add('danger-text');
        btn.onclick = (ev) => { ev.stopPropagation(); closeMenus(); item.action(); };
        menu.appendChild(btn);
    });
    document.body.appendChild(menu);
    // Position near click
    const x = Math.min(e.clientX, window.innerWidth - 160);
    const y = Math.min(e.clientY, window.innerHeight - (items.length * 44 + 8));
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    activeMenu = menu;
}

// ===== INIT =====
async function init() {

    const sidebarHome = document.getElementById('sidebar-home');
    sidebarHome.addEventListener('dragover', (e) => {
        e.preventDefault();
        sidebarHome.style.background = 'var(--hover-bg)';
    });
    sidebarHome.addEventListener('dragleave', (e) => {
        e.preventDefault();
        sidebarHome.style.background = '';
    });
    sidebarHome.addEventListener('drop', async (e) => {
        e.preventDefault();
        sidebarHome.style.background = '';
        await handleDrop(e, null);
    });
    
    // Add click to sidebarHome to go home
    sidebarHome.style.cursor = 'pointer';
    sidebarHome.onclick = () => showHome();

    await initDB();
    const savedTheme = localStorage.getItem('theme') || 'light';
    if (savedTheme !== 'light') document.body.classList.add('theme-' + savedTheme);
    

const themeData = [
    { id: 'light', name: 'Light', color: '#ffffff' },
    { id: 'dark', name: 'Dark', color: '#121212' },
    { id: 'autumn', name: 'Autumn', color: '#c25e29' },
    { id: 'terminal', name: 'Terminal', color: '#4ade80' },
    { id: 'vaporwave', name: 'Vaporwave', color: '#ff71ce' },
    { id: 'blueprint', name: 'Blueprint', color: '#0a3d91' },
    { id: 'neopop', name: 'Neo-Pop', color: '#a7f3d0' },
    { id: 'composition', name: 'Composition', color: '#fdf6e3' },
    { id: 'dracula', name: 'Dracula', color: '#282a36' },
    { id: 'earthy', name: 'Earthy', color: '#3b5240' },
    { id: 'space', name: 'Space', color: '#04050a' },
    { id: 'moon', name: 'Moon', color: '#8a8d91' },
    { id: 'cabin', name: 'Cozy Cabin', color: '#382215' },
    { id: 'matcha', name: 'Matcha', color: '#d1deb9' }
];

const applyTheme = (theme) => {
    document.body.className = document.body.className.replace(/theme-\w+/g, '').replace('dark-mode', '').trim();
    if (theme !== 'light') document.body.classList.add('theme-' + theme);
    localStorage.setItem('theme', theme);
};

let themeMenuEl = null;
const toggleThemeMenu = (e) => {
    e.stopPropagation();
    if (!themeMenuEl) {
        themeMenuEl = document.createElement('div');
        themeMenuEl.className = 'theme-menu';
        themeData.forEach(t => {
            const opt = document.createElement('div');
            opt.className = 'theme-option';
            opt.innerHTML = `<div class="theme-color-box" style="background-color: ${t.color};"></div> <span>${t.name}</span>`;
            opt.onclick = () => {
                applyTheme(t.id);
                showToast(`Theme: ${t.name}`);
                themeMenuEl.style.display = 'none';
            };
            themeMenuEl.appendChild(opt);
        });
        document.body.appendChild(themeMenuEl);
        
        document.addEventListener('click', (ev) => {
            if (!themeMenuEl.contains(ev.target)) {
                themeMenuEl.style.display = 'none';
            }
        });
    }
    
    if (themeMenuEl.style.display === 'flex') {
        themeMenuEl.style.display = 'none';
    } else {
        const rect = e.currentTarget.getBoundingClientRect();
        themeMenuEl.style.top = (rect.bottom + 8) + 'px';
        themeMenuEl.style.right = (window.innerWidth - rect.right) + 'px';
        themeMenuEl.style.display = 'flex';
    }
};

    $('btn-theme').onclick = toggleThemeMenu;
    $('sidebar-home').onclick = () => showHome();
    setupEvents();
    await refreshSidebar();
    showHome();
}

// ===== SIDEBAR =====
const getFolderIcon = (color) => {
    return `<svg width="16" height="16" viewBox="0 0 24 24" fill="${color || 'none'}" stroke="${color || 'currentColor'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`;
};


async function refreshSidebar() {
    const folders = await getFolders();
    const decks = await getDecks();
    dom.sidebarNav.innerHTML = '';

    // Folders section
    if (folders.length > 0) {
        
        const sec = document.createElement('div');
        sec.className = 'db-nav-section';
        sec.textContent = 'Folders';
        
        // Root drop zone for folders section
        sec.addEventListener('dragover', (e) => {
            e.preventDefault();
            sec.style.background = 'var(--hover-bg)';
        });
        sec.addEventListener('dragleave', (e) => {
            e.preventDefault();
            sec.style.background = '';
        });
        sec.addEventListener('drop', async (e) => {
            e.preventDefault();
            sec.style.background = '';
            await handleDrop(e, null);
        });
        
        dom.sidebarNav.appendChild(sec);


        const buildFolderNode = (folder, container, level) => {
            const nestedDecks = decks.filter(d => d.folderId === folder.id);
            const nestedFolders = folders.filter(f => f.parentId === folder.id);
            
            const fRow = document.createElement('div');
            fRow.className = 'db-nav-item';
            fRow.dataset.id = `f-${folder.id}`;
            fRow.style.paddingLeft = `${8 + (level * 16)}px`;
            fRow.style.borderLeft = `4px solid ${folder.color || '#4488ff'}`;
            fRow.innerHTML = `
                <span class="db-nav-toggle">${ICON.chevron}</span>
                ${getFolderIcon(folder.color)}
                <span class="db-nav-label">${folder.name}</span>
                <span class="db-nav-count">${nestedDecks.length + nestedFolders.length}</span>
                <button class="db-nav-menu">${ICON.dots}</button>
            `;
            
            // Drop zone for sidebar folder
            fRow.draggable = true;
            fRow.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('application/json', JSON.stringify({ type: 'folder', id: folder.id }));
                e.dataTransfer.effectAllowed = 'move';
            });
            fRow.addEventListener('dragover', (e) => {
                e.preventDefault();
                fRow.style.background = 'var(--hover-bg)';
            });
            fRow.addEventListener('dragleave', (e) => {
                e.preventDefault();
                fRow.style.background = '';
            });
            fRow.addEventListener('drop', async (e) => {
                e.preventDefault();
                fRow.style.background = '';
                await handleDrop(e, folder.id);
            });
            
            const childContainer = document.createElement('div');
            childContainer.className = 'db-nav-children';
            
            fRow.onclick = (e) => {
                if (e.target.closest('.db-nav-toggle') || e.target.closest('.db-nav-menu')) return;
                showFolder(folder.id, folder.name);
            };
            
            fRow.querySelector('.db-nav-toggle').onclick = (e) => {
                e.stopPropagation();
                childContainer.classList.toggle('collapsed');
                fRow.querySelector('.db-nav-toggle').classList.toggle('rotated');
            };
            fRow.querySelector('.db-nav-menu').onclick = (e) => showContextMenu(e, [
                { label: 'Study All', action: () => startStudyFolder(folder.id, folder.name) },
                { label: 'Edit Folder', action: () => promptRename('folder', folder) },
                { label: 'Delete Folder', danger: true, action: () => confirmDeleteFolder(folder) },
            ]);
            
            container.appendChild(fRow);
            container.appendChild(childContainer);
            
            for (const subF of nestedFolders) {
                buildFolderNode(subF, childContainer, level + 1);
            }
            
            for (const d of nestedDecks) {
                const dEl = document.createElement('div');
                dEl.className = 'db-nav-item db-nav-item--sub';
                dEl.dataset.id = `d-${d.id}`;
                dEl.style.paddingLeft = `${8 + ((level + 1) * 16)}px`;
                dEl.innerHTML = `${ICON.deck}<span class="db-nav-label">${d.name}</span><button class="db-nav-menu">${ICON.dots}</button>`;
                
                // Drag start for deck
                dEl.draggable = true;
                dEl.addEventListener('dragstart', (e) => {
                    e.dataTransfer.setData('application/json', JSON.stringify({ type: 'deck', id: d.id }));
                    e.dataTransfer.effectAllowed = 'move';
                });
                
                dEl.onclick = (e) => {
                    if (e.target.closest('.db-nav-menu')) return;
                    startStudyDeck(d.id, d.name);
                };
                dEl.querySelector('.db-nav-menu').onclick = (e) => showDeckMenu(e, d);
                childContainer.appendChild(dEl);
            }
        };

        const rootFolders = folders.filter(f => !f.parentId);
        for (const f of rootFolders) {
            buildFolderNode(f, dom.sidebarNav, 0);
        }
    }

    // Standalone Decks
    const rootDecks = decks.filter(d => !d.folderId);
    if (rootDecks.length) {
        const sec = document.createElement('div');
        sec.className = 'db-nav-section';
        sec.textContent = 'Standalone Decks';
        
        // Root drop zone
        sec.addEventListener('dragover', (e) => {
            e.preventDefault();
            sec.style.background = 'var(--hover-bg)';
        });
        sec.addEventListener('dragleave', (e) => {
            e.preventDefault();
            sec.style.background = '';
        });
        sec.addEventListener('drop', async (e) => {
            e.preventDefault();
            sec.style.background = '';
            await handleDrop(e, null);
        });
        
        dom.sidebarNav.appendChild(sec);
        for (const d of rootDecks) {
            const dEl = document.createElement('div');
            dEl.className = 'db-nav-item';
            dEl.dataset.id = `d-${d.id}`;
            dEl.innerHTML = `${ICON.deck}<span class="db-nav-label">${d.name}</span><button class="db-nav-menu">${ICON.dots}</button>`;
            
            // Drag start for deck
            dEl.draggable = true;
            dEl.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('application/json', JSON.stringify({ type: 'deck', id: d.id }));
                e.dataTransfer.effectAllowed = 'move';
            });
            
            dEl.onclick = (e) => {
                if (e.target.closest('.db-nav-menu')) return;
                startStudyDeck(d.id, d.name);
            };
            dEl.querySelector('.db-nav-menu').onclick = (e) => showDeckMenu(e, d);
            dom.sidebarNav.appendChild(dEl);
        }
    }
}

async function showDeckMenu(e, deck) {
    const cards = await getCardsByDeck(deck.id);
    const cardCount = cards.length;
    
    const menuItems = [
        { label: 'Study', action: () => startStudyDeck(deck.id, deck.name) },
        { label: 'Edit Cards', action: () => openDeckEdit(deck.id, deck.name) }
    ];
    
    if (cardCount > 10) {
        menuItems.push({ label: 'Quick 10', action: () => startStudyDeck(deck.id, deck.name, true) });
    }
    
    menuItems.push(
        { label: 'Rename', action: () => promptRename('deck', deck) },
        { label: 'Export CSV', action: () => {
            if (!cards.length) showToast('No cards to export.');
            else exportDeckToCSV(deck.name, cards);
        }},
        { label: 'Delete', danger: true, action: () => confirmDeleteDeck(deck) }
    );
    
    showContextMenu(e, menuItems);
}

function promptRenameWorkspace() {
    const overlay = $('modal-add');
    dom.modalTitle.textContent = 'Edit Workspace';
    dom.modalName.value = getWorkspaceName();
    dom.modalColorRow.style.display = 'none';
    overlay.classList.add('active');
    dom.modalName.focus();
    
    $('modal-save').onclick = () => {
        const name = dom.modalName.value.trim();
        if (!name) { showToast('Name required.'); return; }
        localStorage.setItem('workspace_name', name);
        dom.mainTitle.textContent = name;
        overlay.classList.remove('active');
        rebindModalSave();
        showToast('Workspace renamed!');
    };
}

async function promptRename(type, item) {
    const overlay = $('modal-add');
    dom.modalTitle.textContent = type === 'folder' ? 'Edit Folder' : 'Rename Deck';
    dom.modalName.value = item.name;
    dom.modalColorRow.style.display = type === 'folder' ? 'block' : 'none';
    if (type === 'folder') dom.modalColor.value = item.color || '#4488ff';
    overlay.classList.add('active');
    dom.modalName.focus();
    // Temporarily override save
    $('modal-save').onclick = async () => {
        const name = dom.modalName.value.trim();
        if (!name) return;
        if (type === 'folder') await updateFolder(item.id, name, dom.modalColor.value);
        else await updateDeck(item.id, name);
        overlay.classList.remove('active');
        await refreshSidebar();
        if (currentView === 'folder' && currentFolderId === item.id) {
            currentFolderName = name;
            dom.mainTitle.textContent = name;
        }
        if (currentView === 'deck' && editingDeckId === item.id) {
            editingDeckName = name;
            dom.mainTitle.textContent = name;
        }
        if (currentView === 'home') showHome();
        rebindModalSave();
    };
}

async function confirmDeleteFolder(f) {
    if (await showConfirm(`Delete folder "${f.name}"? Decks inside will be moved to workspace.`)) {
        const decks = await getDecks();
        for (const d of decks.filter(dk => dk.folderId === f.id)) {
            await updateDeck(d.id, d.name, null);
        }
        await deleteFolder(f.id);
        await refreshSidebar();
        if (currentFolderId === f.id) showHome();
        else if (currentView === 'home') showHome();
    }
}

async function confirmDeleteDeck(d) {
    if (await showConfirm(`Delete deck "${d.name}"?`)) {
        await deleteDeck(d.id);
        await refreshSidebar();
        if (editingDeckId === d.id) showHome();
        else if (currentView === 'home') showHome();
        else if (currentView === 'folder') showFolder(currentFolderId, currentFolderName);
    }
}

function highlightNav(id) {
    dom.sidebarNav.querySelectorAll('.db-nav-item').forEach(el => {
        el.classList.toggle('active', el.dataset.id === id);
    });
}

// ===== VIEWS =====
async function loadStats() {
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
            } else break;
        }
    }
    
    dom.statStreak.textContent = streak;
    const total = totalKnow + totalForgot;
    dom.statAccuracy.textContent = total === 0 ? '0%' : Math.round((totalKnow / total) * 100) + '%';
    dom.statMastered.textContent = totalKnow;
}

function hideAll() {
    dom.viewGrid.style.display = 'none';
    dom.viewStatsBar.style.display = 'none';
    dom.viewStudy.classList.remove('active');
    dom.viewComplete.classList.remove('active');
    dom.viewDeck.classList.remove('active');
    dom.btnRestart.style.display = 'none';
    dom.btnEditWorkspace.style.display = 'none';
    dom.mainBody.querySelectorAll('.db-empty').forEach(e => e.remove());
}


async function showHome() {
    currentView = 'home';
    currentFolderId = null;
    hideAll();
    await loadStats();
    dom.viewStatsBar.style.display = 'flex';
    dom.mainTitle.textContent = getWorkspaceName();
    dom.btnEditWorkspace.style.display = 'block';
    dom.btnBack.style.display = 'none';
    dom.btnStudy.style.display = 'none';
    dom.viewGrid.style.display = 'grid';
    highlightNav('');

    const folders = await getFolders();
    const decks = await getDecks();
    dom.viewGrid.innerHTML = '';

    if (folders.length === 0 && decks.length === 0) {
        dom.viewGrid.style.display = 'none';
        const empty = document.createElement('div');
        empty.className = 'db-empty';
        empty.innerHTML = `<h3>No decks yet</h3><p>Create a folder or deck to get started.</p>`;
        dom.mainBody.appendChild(empty);
        return;
    }

    const rootFolders = folders.filter(f => !f.parentId);
    for (const f of rootFolders) {
        const folderDecks = decks.filter(d => d.folderId === f.id);
        const dragData = { type: 'folder', id: f.id };
        const onDrop = async (e) => await handleDrop(e, f.id);
        
        dom.viewGrid.appendChild(makeGridCard(
            getFolderIcon(f.color), f.name, `${folderDecks.length} decks`,
            () => showFolder(f.id, f.name),
            (e) => showContextMenu(e, [
                { label: 'Study All', action: () => startStudyFolder(f.id, f.name) },
                { label: 'Edit Folder', action: () => promptRename('folder', f) },
                { label: 'Delete Folder', danger: true, action: () => confirmDeleteFolder(f) },
            ]),
            f.color,
            null,
            dragData,
            onDrop
        ));
    }
    
    const rootDecks = decks.filter(d => !d.folderId);
    for (const d of rootDecks) {
        const cards = await getCardsByDeck(d.id);
        const quickStudyAction = cards.length > 10 ? () => startStudyDeck(d.id, d.name, true) : null;
        const dragData = { type: 'deck', id: d.id };
        
        dom.viewGrid.appendChild(makeGridCard(
            ICON.deck, d.name, `${cards.length} cards`,
            () => startStudyDeck(d.id, d.name),
            (e) => showDeckMenu(e, d),
            null,
            quickStudyAction,
            dragData,
            null
        ));
    }
}

async function showFolder(folderId, folderName) {
    currentView = 'folder';
    currentFolderId = folderId;
    currentFolderName = folderName;
    hideAll();
    dom.mainTitle.textContent = folderName;
    dom.btnBack.style.display = 'block';
    dom.btnStudy.style.display = 'inline-block';
    dom.btnStudy.onclick = () => startStudyFolder(folderId, folderName);
    dom.viewGrid.style.display = 'grid';
    highlightNav(`f-${folderId}`);

    const decks = await getDecks();
    const folders = await getFolders();
    
    const folderDecks = decks.filter(d => d.folderId === folderId);
    const childFolders = folders.filter(f => f.parentId === folderId);
    dom.viewGrid.innerHTML = '';

    if (folderDecks.length === 0 && childFolders.length === 0) {
        dom.viewGrid.style.display = 'none';
        const empty = document.createElement('div');
        empty.className = 'db-empty';
        empty.innerHTML = `<h3>Empty folder</h3><p>Add a deck or sub-folder.</p>`;
        dom.mainBody.appendChild(empty);
        return;
    }

    for (const f of childFolders) {
        const nestedDecks = decks.filter(d => d.folderId === f.id);
        const dragData = { type: 'folder', id: f.id };
        const onDrop = async (e) => await handleDrop(e, f.id);
        
        dom.viewGrid.appendChild(makeGridCard(
            getFolderIcon(f.color), f.name, `${nestedDecks.length} decks`,
            () => showFolder(f.id, f.name),
            (e) => showContextMenu(e, [
                { label: 'Study All', action: () => startStudyFolder(f.id, f.name) },
                { label: 'Edit Folder', action: () => promptRename('folder', f) },
                { label: 'Delete Folder', danger: true, action: () => confirmDeleteFolder(f) },
            ]),
            f.color,
            null,
            dragData,
            onDrop
        ));
    }

    for (const d of folderDecks) {
        const cards = await getCardsByDeck(d.id);
        const quickStudyAction = cards.length > 10 ? () => startStudyDeck(d.id, d.name, true) : null;
        const dragData = { type: 'deck', id: d.id };
        
        dom.viewGrid.appendChild(makeGridCard(
            ICON.deck, d.name, `${cards.length} cards`,
            () => startStudyDeck(d.id, d.name),
            (e) => showDeckMenu(e, d),
            null,
            quickStudyAction,
            dragData,
            null
        ));
    }
}


function makeGridCard(icon, title, meta, onClick, onMenu, accentColor, onQuickStudy, dragData, onDrop) {
    const card = document.createElement('div');
    card.className = 'db-card';
    if (accentColor) card.style.borderTop = `6px solid ${accentColor}`;
    
    let quickHtml = '';
    if (onQuickStudy) {
        quickHtml = `<button class="btn-quick-study" title="Quick Study 10 Random Cards">Quick 10</button>`;
    }
    
    card.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
            <h3>${icon} ${title}</h3>
            <button class="db-card-menu">${ICON.dots}</button>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-top: auto;">
            <span class="db-card-meta">${meta}</span>
            ${quickHtml}
        </div>
    `;
    
    card.querySelector('h3').style.cursor = 'pointer';
    card.querySelector('h3').onclick = onClick;
    card.querySelector('.db-card-menu').onclick = onMenu;
    
    if (onQuickStudy) {
        card.querySelector('.btn-quick-study').onclick = (e) => {
            e.stopPropagation();
            onQuickStudy();
        };
    }
    
    card.onclick = (e) => {
        if (!e.target.closest('.db-card-menu') && !e.target.closest('.btn-quick-study') && !e.target.closest('h3')) onClick();
    };

    if (dragData) {
        card.draggable = true;
        card.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('application/json', JSON.stringify(dragData));
            e.dataTransfer.effectAllowed = 'move';
        });
    }
    if (onDrop) {
        card.addEventListener('dragover', (e) => {
            e.preventDefault();
            card.classList.add('drag-over');
        });
        card.addEventListener('dragleave', (e) => {
            e.preventDefault();
            card.classList.remove('drag-over');
        });
        card.addEventListener('drop', (e) => {
            e.preventDefault();
            card.classList.remove('drag-over');
            onDrop(e);
        });
    }

    return card;
}

async function openDeckEdit(deckId, deckName) {
    currentView = 'deck';
    editingDeckId = deckId;
    editingDeckName = deckName;
    hideAll();
    dom.mainTitle.textContent = deckName;
    dom.btnBack.style.display = 'block';
    dom.btnStudy.style.display = 'inline-block';
    dom.btnStudy.onclick = () => startStudyDeck(deckId, deckName);
    dom.viewDeck.classList.add('active');
    highlightNav(`d-${deckId}`);
    await loadDeckCards();
}

async function loadDeckCards() {
    const cards = await getCardsByDeck(editingDeckId);
    const mastered = cards.filter(c => c.status === 'mastered').length;
    $('deck-mastery').textContent = `${cards.length} cards · ${mastered} mastered · ${cards.length > 0 ? Math.round((mastered / cards.length) * 100) : 0}% mastery`;

    const list = $('deck-cards-list');
    list.innerHTML = '';

    if (cards.length === 0) {
        list.innerHTML = `<div class="db-empty"><h3>No cards yet</h3><p>Add your first card below.</p></div>`;
        return;
    }

    cards.forEach(card => {
        const el = document.createElement('div');
        el.className = 'db-card-row';
        el.innerHTML = `
            <div class="db-card-row-content" title="Click to edit">
                <div class="db-card-row-term">${card.term}${card.type === 'cloze' ? ' <span class="pill">fitb</span>' : ''}</div>
                <div class="db-card-row-def">${card.definition}</div>
            </div>
            <div class="db-card-row-actions">
                <button class="icon-btn btn-preview" title="Preview">${ICON.eye}</button>
                <button class="icon-btn btn-delete-card" title="Delete" style="color:#ff4444;">${ICON.trash}</button>
            </div>
        `;
        el.querySelector('.db-card-row-content').onclick = () => openEditCardModal(card);
        el.querySelector('.btn-preview').onclick = (e) => { e.stopPropagation(); openPreviewModal(card); };
        el.querySelector('.btn-delete-card').onclick = async (e) => {
            e.stopPropagation();
            if (await showConfirm(`Delete card "${card.term.substring(0, 40)}..."?`)) {
                await deleteCard(card.id);
                loadDeckCards();
            }
        };
        list.appendChild(el);
    });
}

// ===== CARD MODALS =====
function openEditCardModal(card) {
    const overlay = $('modal-edit-card');
    $('edit-card-term').value = card.term;
    $('edit-card-def').value = card.definition;
    $('edit-card-ex').value = card.example || '';
    
    $('edit-image-paste').value = '';
    editPastedImage = null;
    if (card.image && card.type !== 'cloze') {
        $('edit-image-preview').src = card.image;
        $('edit-image-preview-container').style.display = 'block';
    } else {
        $('edit-image-preview').src = '';
        $('edit-image-preview-container').style.display = 'none';
    }
    $('edit-card-image-section').style.display = card.type === 'cloze' ? 'none' : 'block';

    overlay.classList.add('active');
    $('edit-card-save').onclick = async () => {
        card.term = $('edit-card-term').value.trim();
        card.definition = $('edit-card-def').value.trim();
        card.example = $('edit-card-ex').value.trim();
        if (editPastedImage) card.image = editPastedImage;
        else if ($('edit-image-preview-container').style.display === 'none') card.image = null;
        
        if (!card.term || !card.definition) { showToast('Term and Definition required.'); return; }
        await updateCard(card);
        overlay.classList.remove('active');
        loadDeckCards();
    };
    $('edit-card-cancel').onclick = () => overlay.classList.remove('active');
}

function openPreviewModal(card) {
    const overlay = $('modal-preview');
    $('preview-term').innerHTML = marked.parse(card.term);
    $('preview-def').innerHTML = marked.parse(card.definition);
    $('preview-ex').innerHTML = card.example ? marked.parse(card.example) : '';
    overlay.classList.add('active');
    $('preview-close').onclick = () => overlay.classList.remove('active');
}

// ===== ADD CARD =====
function setupAddCard() {
    let mode = 'standard';
    $('btn-mode-standard').onclick = () => {
        mode = 'standard';
        $('btn-mode-standard').classList.add('active');
        $('btn-mode-fitb').classList.remove('active');
        $('add-fields-standard').style.display = 'block';
        $('add-fields-fitb').style.display = 'none';
    };
    $('btn-mode-fitb').onclick = () => {
        mode = 'fitb';
        $('btn-mode-fitb').classList.add('active');
        $('btn-mode-standard').classList.remove('active');
        $('add-fields-standard').style.display = 'none';
        $('add-fields-fitb').style.display = 'block';
    };
    
    // Image Handling Logic
    const handleImageFile = (file, isEdit) => {
        if (!file || !file.type.startsWith('image/')) { showToast('Please select a valid image file'); return; }
        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUrl = e.target.result;
            if (isEdit) {
                editPastedImage = dataUrl;
                $('edit-image-preview').src = dataUrl;
                $('edit-image-preview-container').style.display = 'block';
                $('edit-image-paste').value = 'Image attached';
            } else {
                currentPastedImage = dataUrl;
                $('add-image-preview').src = dataUrl;
                $('add-image-preview-container').style.display = 'block';
                $('add-image-paste').value = 'Image attached';
            }
        };
        reader.readAsDataURL(file);
    };

    $('btn-add-image').onclick = () => $('add-image-file').click();
    $('add-image-file').onchange = (e) => handleImageFile(e.target.files[0], false);
    $('add-image-paste').onpaste = (e) => {
        const item = Array.from(e.clipboardData.items).find(x => /^image\//.test(x.type));
        if (item) handleImageFile(item.getAsFile(), false);
        e.preventDefault();
    };
    $('btn-remove-add-image').onclick = () => {
        currentPastedImage = null;
        $('add-image-preview').src = '';
        $('add-image-preview-container').style.display = 'none';
        $('add-image-paste').value = '';
        $('add-image-file').value = '';
    };

    $('btn-edit-image').onclick = () => $('edit-image-file').click();
    $('edit-image-file').onchange = (e) => handleImageFile(e.target.files[0], true);
    $('edit-image-paste').onpaste = (e) => {
        const item = Array.from(e.clipboardData.items).find(x => /^image\//.test(x.type));
        if (item) handleImageFile(item.getAsFile(), true);
        e.preventDefault();
    };
    $('btn-remove-edit-image').onclick = () => {
        editPastedImage = null;
        $('edit-image-preview').src = '';
        $('edit-image-preview-container').style.display = 'none';
        $('edit-image-paste').value = '';
        $('edit-image-file').value = '';
    };

    $('btn-add-card').onclick = async () => {
        if (mode === 'fitb') {
            const sentence = $('add-fitb-sentence').value.trim();
            const answer = $('add-fitb-answer').value.trim();
            if (!sentence || !answer) { showToast('Sentence and Answer required.'); return; }
            if (!sentence.toLowerCase().includes(answer.toLowerCase())) { showToast('Answer must appear in sentence.'); return; }
            await addCard({ deckId: editingDeckId, term: sentence, definition: answer, example: '', status: 'new', type: 'cloze' });
            $('add-fitb-sentence').value = '';
            $('add-fitb-answer').value = '';
        } else {
            const term = $('add-term').value.trim();
            const def = $('add-def').value.trim();
            const ex = $('add-ex').value.trim();
            if (!term || !def) { showToast('Term and Definition required.'); return; }
            await addCard({ deckId: editingDeckId, term, definition: def, example: ex, status: 'new', type: 'standard', image: currentPastedImage });
            $('add-term').value = '';
            $('add-def').value = '';
            $('add-ex').value = '';
            $('btn-remove-add-image').click();
        }
        loadDeckCards();
        showToast('Card added!');
    };
}

// ===== STUDY =====
function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
}

let currentStudySessionKey = null;

function saveProgress() {
    if (!currentStudySessionKey) return;
    const data = {
        cardIds: studyCards.map(c => c.id),
        studyIndex,
        studyStats
    };
    localStorage.setItem(`study_progress_${currentStudySessionKey}`, JSON.stringify(data));
}

async function startStudyFolder(folderId, folderName) {
    const cards = await getCardsByFolder(folderId);
    beginStudy(cards, `Studying: ${folderName}`, `folder_${folderId}`);
}

async function startStudyDeck(deckId, deckName, isQuickStudy = false) {
    let cards = await getCardsByDeck(deckId);
    
    if (isQuickStudy) {
        // Quick study mode: 10 random cards
        shuffle(cards);
        cards = cards.slice(0, 10);
        beginStudy(cards, `Quick Study: ${deckName}`, null);
    } else {
        // Normal study mode
        beginStudy(cards, `Studying: ${deckName}`, `deck_${deckId}`);
    }
    highlightNav(`d-${deckId}`);
}

function beginStudy(cards, title, sessionKey) {
    if (!cards.length) { showToast('No cards to study.'); return; }
    currentView = 'study';
    hideAll();
    dom.mainTitle.textContent = title;
    dom.btnBack.style.display = 'block';
    dom.btnStudy.style.display = 'none';
    dom.btnRestart.style.display = 'inline-block';
    currentStudySessionKey = sessionKey;

    let resume = false;
    const saved = sessionKey ? localStorage.getItem(`study_progress_${sessionKey}`) : null;
    if (saved) {
        try {
            const data = JSON.parse(saved);
            const currentIds = cards.map(c => c.id).sort().join(',');
            const savedIds = [...data.cardIds].sort().join(',');
            if (currentIds === savedIds && data.studyIndex < data.cardIds.length) {
                studyCards = data.cardIds.map(id => cards.find(c => c.id === id));
                studyIndex = data.studyIndex;
                studyStats = data.studyStats;
                resume = true;
            }
        } catch (e) {}
    }

    if (!resume) {
        studyCards = [...cards];
        shuffle(studyCards);
        studyIndex = 0;
        studyStats = { know: 0, forgot: 0 };
        saveProgress();
    }
    
    dom.viewStudy.classList.add('active');
    renderCard();
}

function renderCard() {
    if (studyIndex >= studyCards.length) { showComplete(); return; }
    isFlipped = false;
    hasRevealed = false;
    dom.flashcard.classList.remove('flipped');
    dom.studyActions.classList.remove('visible');
    const c = studyCards[studyIndex];
    isCloze = (c.type === 'cloze');
    dom.studyProgress.textContent = `${studyIndex + 1} / ${studyCards.length}`;
    const total = studyStats.know + studyStats.forgot;
    dom.studyMastery.textContent = `Mastery: ${total === 0 ? 0 : Math.round((studyStats.know / total) * 100)}%`;
    if (c.image) { dom.fcImg.src = c.image; dom.fcImg.style.display = 'block'; } else { dom.fcImg.style.display = 'none'; }
    
    if (isCloze) {
        let frontText = '';
        let backText = '';
        const answer = c.definition;
        const answerRegex = new RegExp(answer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        
        if (c.term.includes('___')) {
            frontText = c.term.replace(/_+/g, '<span class="cloze-blank"></span>');
            backText = c.term.replace(/_+/g, '<span class="cloze-highlight" id="db-cloze-highlight">' + answer + '</span>');
        } else if (answerRegex.test(c.term)) {
            frontText = c.term.replace(answerRegex, '<span class="cloze-blank"></span>');
            backText = c.term.replace(answerRegex, '<span class="cloze-highlight" id="db-cloze-highlight">' + answer + '</span>');
        } else {
            frontText = c.term + '<br><br><span class="cloze-blank"></span>';
            backText = c.term + '<br><br><span class="cloze-highlight" id="db-cloze-highlight">' + answer + '</span>';
        }
        
        dom.fcTerm.innerHTML = frontText;
        dom.fcDef.innerHTML = backText;
        dom.fcHint.style.display = 'none';
        dom.clozeArea.style.display = 'flex';
        dom.clozeInput.value = '';
        dom.clozeInput.className = '';
        const checkBtn = document.getElementById('btn-cloze-check');
        checkBtn.textContent = 'Check';
        checkBtn.className = 'primary';
        setTimeout(() => dom.clozeInput.focus(), 100);
    } else {
        dom.fcTerm.innerHTML = marked.parse(c.term);
        dom.fcDef.innerHTML = marked.parse(c.definition);
        dom.fcHint.style.display = 'block';
        dom.clozeArea.style.display = 'none';
    }
    
    dom.fcEx.innerHTML = c.example ? marked.parse(c.example) : '';
}

function flipCard() { 
    if (isCloze) return; 
    isFlipped = !isFlipped; 
    dom.flashcard.classList.toggle('flipped', isFlipped); 
    if (!hasRevealed) {
        hasRevealed = true;
        dom.studyActions.classList.add('visible');
    }
}

function checkCloze() {
    if (!isCloze) return;
    
    const btn = document.getElementById('btn-cloze-check');
    if (btn.textContent === 'Continue') {
        const isCorrect = dom.clozeInput.classList.contains('cloze-correct');
        handleResult(isCorrect);
        return;
    }

    const ans = dom.clozeInput.value.trim().toLowerCase();
    const correct = studyCards[studyIndex].definition.trim().toLowerCase();
    
    isFlipped = true;
    hasRevealed = true;
    dom.flashcard.classList.add('flipped');
    
    const highlightEl = document.getElementById('db-cloze-highlight');
    if (ans === correct) {
        dom.clozeInput.className = 'cloze-correct';
        if (highlightEl) highlightEl.className = 'cloze-highlight cloze-highlight-correct';
    } else {
        dom.clozeInput.className = 'cloze-wrong';
        if (highlightEl) highlightEl.className = 'cloze-highlight cloze-highlight-wrong';
    }
    
    btn.textContent = 'Continue';
    btn.className = 'secondary';
}

function handleResult(isCorrect) {
    if (!hasRevealed) return;
    if (isCorrect === true) { studyStats.know++; recordStudyResult(true); }
    else if (isCorrect === false) { studyStats.forgot++; recordStudyResult(false); }
    studyIndex++;
    saveProgress();
    renderCard();
}

function triggerCelebration() {
    if (!window.confetti) return;
    
    const rect = dom.viewComplete.getBoundingClientRect();
    const centerX = (rect.left + (rect.width / 2)) / window.innerWidth;
    const leftEdge = (rect.left + 24) / window.innerWidth; // Add slight padding
    const rightEdge = (rect.right - 24) / window.innerWidth;

    const effects = [
        // 1. Double Side Cannons
        () => {
            confetti({ particleCount: 100, spread: 70, origin: { x: leftEdge, y: 0.7 }, angle: 60 });
            confetti({ particleCount: 100, spread: 70, origin: { x: rightEdge, y: 0.7 }, angle: 120 });
        },
        // 2. Continuous Fireworks
        () => {
            const duration = 2500;
            const end = Date.now() + duration;
            (function frame() {
                confetti({
                    particleCount: 7,
                    angle: 60,
                    spread: 55,
                    origin: { x: leftEdge + (Math.random() * (rightEdge - leftEdge)), y: Math.random() - 0.2 }
                });
                if (Date.now() < end) requestAnimationFrame(frame);
            }());
        },
        // 3. Realistic Explosion
        () => {
            const count = 200;
            const defaults = { origin: { x: centerX, y: 0.6 } };
            function fire(particleRatio, opts) {
                confetti(Object.assign({}, defaults, opts, { particleCount: Math.floor(count * particleRatio) }));
            }
            fire(0.25, { spread: 26, startVelocity: 55 });
            fire(0.2, { spread: 60 });
            fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
            fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
            fire(0.1, { spread: 120, startVelocity: 45 });
        },
        // 4. Standard Big Burst
        () => {
            confetti({ particleCount: 200, spread: 100, origin: { x: centerX, y: 0.6 }, startVelocity: 45 });
        },
        // 5. Golden Shooting Stars
        () => {
            confetti({ particleCount: 80, spread: 120, origin: { x: centerX, y: 0.6 }, shapes: ['star'], colors: ['#FFD700', '#FFB14E', '#FAEA48', '#E89400'] });
            confetti({ particleCount: 40, spread: 90, origin: { x: centerX, y: 0.6 }, shapes: ['circle'], colors: ['#FFD700', '#FFFFFF'] });
        },
        // 6. Winter Snowfall
        () => {
            const duration = 4000;
            const end = Date.now() + duration;
            (function frame() {
                confetti({
                    particleCount: 3,
                    angle: 270,
                    spread: 40,
                    startVelocity: 15,
                    decay: 0.9,
                    gravity: 0.8,
                    origin: { x: leftEdge + (Math.random() * (rightEdge - leftEdge)), y: -0.1 },
                    colors: ['#ffffff', '#e0f7fa', '#bbdefb'],
                    shapes: ['circle'],
                    scalar: Math.random() * 0.8 + 0.4
                });
                if (Date.now() < end) requestAnimationFrame(frame);
            }());
        }
    ];

    const randomEffect = effects[Math.floor(Math.random() * effects.length)];
    randomEffect();
}

function showComplete() {
    if (currentStudySessionKey) localStorage.removeItem(`study_progress_${currentStudySessionKey}`);
    currentView = 'complete';
    hideAll();
    dom.viewComplete.classList.add('active');
    dom.completeCount.textContent = studyCards.length;
    triggerCelebration();
}

// ===== EVENTS =====
let modalSaveDefault;
function rebindModalSave() { $('modal-save').onclick = modalSaveDefault; }

function setupEvents() {
    dom.btnEditWorkspace.onclick = promptRenameWorkspace;
    dom.btnRestart.onclick = () => {
        shuffle(studyCards);
        studyIndex = 0;
        studyStats = { know: 0, forgot: 0 };
        saveProgress();
        renderCard();
        showToast('Deck restarted');
    };

    dom.btnBack.onclick = () => {
        if (currentView === 'study' || currentView === 'complete') {
            if (editingDeckId) openDeckEdit(editingDeckId, editingDeckName);
            else if (currentFolderId) showFolder(currentFolderId, currentFolderName);
            else showHome();
        } else if (currentView === 'deck') {
            if (currentFolderId) showFolder(currentFolderId, currentFolderName);
            else showHome();
        } else { showHome(); }
    };
    dom.flashcard.onclick = (e) => { if (!e.target.closest('.db-cloze-area')) flipCard(); };
    $('btn-cloze-check').onclick = checkCloze;
    dom.clozeInput.onkeydown = (e) => { if (e.key === 'Enter') checkCloze(); };
    $('btn-forgot').onclick = () => handleResult(false);
    $('btn-skip').onclick = () => handleResult(null);
    $('btn-know').onclick = () => handleResult(true);
    $('btn-again').onclick = () => { shuffle(studyCards); studyIndex = 0; studyStats = { know: 0, forgot: 0 }; hideAll(); dom.viewStudy.classList.add('active'); renderCard(); };
    $('btn-home').onclick = () => showHome();

    // Modal (new item)
    let addMode = '';
    $('btn-new-folder').onclick = () => {
        addMode = 'folder';
        dom.modalTitle.textContent = 'New Folder';
        dom.modalColorRow.style.display = 'block';
        dom.modalName.value = '';
        dom.modalOverlay.classList.add('active');
        dom.modalName.focus();
        rebindModalSave();
    };
    $('btn-new-deck').onclick = () => {
        addMode = 'deck';
        dom.modalTitle.textContent = 'New Deck';
        dom.modalColorRow.style.display = 'none';
        dom.modalName.value = '';
        dom.modalOverlay.classList.add('active');
        dom.modalName.focus();
        rebindModalSave();
    };
    $('modal-cancel').onclick = () => dom.modalOverlay.classList.remove('active');
    modalSaveDefault = async () => {
        const name = dom.modalName.value.trim();
        if (!name) return;
        if (addMode === 'folder') await addFolder(name, dom.modalColor.value);
        else await addDeck(name, currentFolderId);
        dom.modalOverlay.classList.remove('active');
        await refreshSidebar();
        if (currentView === 'folder') showFolder(currentFolderId, currentFolderName);
        else showHome();
    };
    $('modal-save').onclick = modalSaveDefault;

    // Keyboard
    document.addEventListener('keydown', (e) => {
        if (currentView !== 'study') return;
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        if (e.code === 'Space') { e.preventDefault(); flipCard(); }
        else if (hasRevealed) { if (e.key === '1') handleResult(false); if (e.key === '2') handleResult(null); if (e.key === '3') handleResult(true); }
    });

    setupAddCard();
}

init();


async function handleDrop(e, targetFolderId) {
    try {
        const dataStr = e.dataTransfer.getData('application/json');
        if (!dataStr) return;
        const data = JSON.parse(dataStr);
        
        // Prevent moving a folder into itself
        if (data.type === 'folder' && data.id === targetFolderId) return;

        
        if (data.type === 'folder' && targetFolderId) {
            const folders = await getFolders();
            let current = folders.find(f => f.id === targetFolderId);
            while (current && current.parentId) {
                if (current.parentId === data.id) {
                    showToast("Cannot move a folder into its own subfolder.");
                    return;
                }
                current = folders.find(f => f.id === current.parentId);
            }
        }
        if (data.type === 'folder') {
            const folders = await getFolders();
            const folderToMove = folders.find(f => f.id === data.id);
            
            if (folderToMove) {
                if ((folderToMove.parentId || null) === (targetFolderId || null)) {
                    showToast("Already in this location.");
                    return;
                }

                const targetFolder = targetFolderId ? folders.find(f => f.id === targetFolderId) : null;
                const msg = targetFolderId ? `Move "${folderToMove.name}" to "${targetFolder.name}"?` : `Move "${folderToMove.name}" to Workspace Root?`;
                if (await showConfirm(msg, 'Move', false)) {
                    await updateFolder(folderToMove.id, folderToMove.name, folderToMove.color, targetFolderId);
                    refreshSidebar();
                    if (currentView === 'home') showHome();
                    else if (currentView === 'folder') showFolder(currentFolderId, currentFolderName);
                }
            }
        } else if (data.type === 'deck') {
            const decks = await getDecks();
            const deckToMove = decks.find(d => d.id == data.id);
            
            if (deckToMove) {
                if ((deckToMove.folderId || null) === (targetFolderId || null)) {
                    showToast("Already in this location.");
                    return;
                }

                const folders = await getFolders();
                const targetFolder = targetFolderId ? folders.find(f => f.id === targetFolderId) : null;
                const msg = targetFolderId ? `Move "${deckToMove.name}" to "${targetFolder.name}"?` : `Move "${deckToMove.name}" to Workspace Root?`;
                if (await showConfirm(msg, 'Move', false)) {
                    await updateDeck(deckToMove.id, deckToMove.name, targetFolderId);
                    refreshSidebar();
                    if (currentView === 'home') showHome();
                    else if (currentView === 'folder') showFolder(currentFolderId, currentFolderName);
                }
            }
        }
    } catch (err) {
        console.error(err);
    }
}



// ==========================================
// PORTED FROM EXTENSION: Settings, Drive, PDF
// ==========================================

const brutalistLoaderHtml = `<div class="brutalist-loader"><div class="block"></div><div class="block"></div><div class="block"></div></div>`;

const updateProgressBanner = (progress) => {
    const banner = document.getElementById('bg-task-banner');
    if (!progress) {
        if (banner) banner.style.display = 'none';
        return;
    }
    if (banner) banner.style.display = 'block';
    
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

if (document.getElementById('btn-close-bg-task')) {
    document.getElementById('btn-close-bg-task').addEventListener('click', () => {
        storage.remove('pdfProgress');
        document.getElementById('bg-task-banner').style.display = 'none';
    });
}

// Listen for progress updates
storage.onChange((changes) => {
    if (changes.pdfProgress) {
        if (changes.pdfProgress.newValue) {
            updateProgressBanner(changes.pdfProgress.newValue);
        } else {
            const banner = document.getElementById('bg-task-banner');
            if (banner) banner.style.display = 'none';
        }
    }
});

// Check on boot
storage.get(['pdfProgress', 'web_google_client_id']).then(res => {
    if (res.pdfProgress) updateProgressBanner(res.pdfProgress);
    if (!isExtension && res.web_google_client_id) {
        initGoogleAuth(res.web_google_client_id);
    }
});

// SETTINGS & API KEY
if (document.getElementById('btn-open-settings')) {
    document.getElementById('btn-open-settings').addEventListener('click', async () => {
        const res = await storage.get(['openrouter_api_key', 'web_google_client_id']);
        document.getElementById('input-api-key').value = res.openrouter_api_key || '';
        document.getElementById('input-api-key').type = 'password';
        document.getElementById('icon-api-key-locked').style.display = 'block';
        document.getElementById('icon-api-key-unlocked').style.display = 'none';
        
        if (!isExtension) {
            document.getElementById('web-oauth-section').style.display = 'block';
            document.getElementById('input-google-client-id').value = res.web_google_client_id || '';
        }
        
        document.getElementById('modal-settings').style.display = 'flex';
    });
}

if (document.getElementById('btn-save-settings')) {
    document.getElementById('btn-save-settings').addEventListener('click', () => {
        const key = document.getElementById('input-api-key').value.trim();
        if (key) {
            storage.set({ 'openrouter_api_key': key });
        } else {
            storage.remove('openrouter_api_key');
        }
        
        if (!isExtension) {
            const googleKey = document.getElementById('input-google-client-id').value.trim();
            if (googleKey) {
                storage.set({ 'web_google_client_id': googleKey });
                initGoogleAuth(googleKey); // Re-init immediately
            } else {
                storage.remove('web_google_client_id');
            }
        }
        
        document.getElementById('modal-settings').style.display = 'none';
        showToast("Settings saved.");
    });
}

if (document.getElementById('btn-cancel-settings')) {
    document.getElementById('btn-cancel-settings').addEventListener('click', () => {
        document.getElementById('modal-settings').style.display = 'none';
    });
}

if (document.getElementById('btn-toggle-api-key')) {
    document.getElementById('btn-toggle-api-key').addEventListener('click', () => {
        const input = document.getElementById('input-api-key');
        const locked = document.getElementById('icon-api-key-locked');
        const unlocked = document.getElementById('icon-api-key-unlocked');
        if (input.type === 'password') {
            input.type = 'text';
            locked.style.display = 'none';
            unlocked.style.display = 'block';
        } else {
            input.type = 'password';
            locked.style.display = 'block';
            unlocked.style.display = 'none';
        }
    });
}

// SYNC
if (document.getElementById('btn-sync-upload')) {
    document.getElementById('btn-sync-upload').addEventListener('click', async () => {
        try {
            document.getElementById('btn-sync-upload').innerText = 'UPLOADING...';
            document.getElementById('btn-sync-upload').disabled = true;
            await uploadToDrive();
            showToast("Successfully uploaded to Google Drive!");
        } catch (e) {
            showToast("Upload failed: " + e.message);
        } finally {
            document.getElementById('btn-sync-upload').innerText = 'UPLOAD TO DRIVE';
            document.getElementById('btn-sync-upload').disabled = false;
        }
    });
}

if (document.getElementById('btn-sync-download')) {
    document.getElementById('btn-sync-download').addEventListener('click', async () => {
        if (!confirm("This will merge downloaded flashcards with your current data. Continue?")) return;
        try {
            document.getElementById('btn-sync-download').innerText = 'DOWNLOADING...';
            document.getElementById('btn-sync-download').disabled = true;
            await downloadFromDrive();
            showToast("Successfully downloaded and merged from Google Drive!");
            if (typeof renderDecksView === 'function') renderDecksView(); // Refresh UI
        } catch (e) {
            showToast("Download failed: " + e.message);
        } finally {
            document.getElementById('btn-sync-download').innerText = 'DOWNLOAD FROM DRIVE';
            document.getElementById('btn-sync-download').disabled = false;
        }
    });
}

// PDF UPLOAD LOGIC
const handlePDFUpload = async (file) => {
    const res = await storage.get(['openrouter_api_key']);
    const apiKey = res.openrouter_api_key;
    if (!apiKey) {
        showToast("Please set your OpenRouter API key in Settings first!");
        document.getElementById('btn-open-settings').click();
        return;
    }
    
    const dropzoneOverlay = document.getElementById('dropzone-overlay');
    const dropzoneContent = document.getElementById('dropzone-content');
    try {
        if (dropzoneContent) {
            if (!window.originalDropzoneHtml) window.originalDropzoneHtml = dropzoneContent.innerHTML;
            dropzoneContent.innerHTML = `${brutalistLoaderHtml}<h2 style="margin-bottom: 12px; font-size: 24px;">Processing PDF<span class="animated-dots"></span></h2><p style="color: var(--text-secondary); text-align: center; font-size: 14px;">Extracting text from all pages...</p>`;
        }
        if (dropzoneOverlay) {
            dropzoneOverlay.style.display = 'flex';
            dropzoneOverlay.classList.add('dropzone-loading');
        }
        
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'js/pdf.worker.min.js';
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
        const chunkSize = 15000;
        const textChunks = [];
        for (let i = 0; i < allText.length; i += chunkSize) {
            textChunks.push(allText.substring(i, i + chunkSize));
        }
        
        const deckName = file.name.replace('.pdf', '') || 'AI Generated Deck';
        const targetFolder = (typeof currentFolderId !== 'undefined') ? currentFolderId : null;
        
        if (isExtension) {
            // Extension: delegate to background service worker
            chrome.runtime.sendMessage({
                action: 'PROCESS_PDF_CHUNKS',
                textChunks: textChunks,
                deckName: deckName,
                folderId: targetFolder
            });
        } else {
            // Web / PWA: process directly in-page
            processChunksInPage(textChunks, deckName, targetFolder);
        }
        
        if (dropzoneOverlay) {
            dropzoneOverlay.style.display = 'none';
            if (dropzoneContent && window.originalDropzoneHtml) {
                dropzoneContent.innerHTML = window.originalDropzoneHtml;
                // rebind cancel button
                document.getElementById('btn-cancel-dropzone')?.addEventListener('click', () => {
                    dropzoneOverlay.style.display = 'none';
                });
            }
        }
        showToast("Processing PDF in background! You will receive a notification when finished.");
        
    } catch (err) {
        if (dropzoneOverlay) {
            dropzoneOverlay.style.display = 'none';
            if (dropzoneContent && window.originalDropzoneHtml) {
                dropzoneContent.innerHTML = window.originalDropzoneHtml;
                document.getElementById('btn-cancel-dropzone')?.addEventListener('click', () => {
                    dropzoneOverlay.style.display = 'none';
                });
            }
        }
        showToast("PDF Error: " + err.message);
        console.error(err);
    }
};

if (document.getElementById('btn-menu-add-pdf')) {
    document.getElementById('btn-menu-add-pdf').addEventListener('click', () => {
        document.getElementById('file-ai-pdf').click();
    });
}
if (document.getElementById('file-ai-pdf')) {
    document.getElementById('file-ai-pdf').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            document.getElementById('dropzone-overlay').style.display = 'flex';
            await handlePDFUpload(file);
        }
        e.target.value = '';
    });
}

// DROPZONE OVERLAY DRAG & DROP
const overlay = document.getElementById('dropzone-overlay');
if (overlay) {
    document.body.addEventListener('dragenter', (e) => {
        // Exclude internal draggable items (like folders/decks)
        if (e.dataTransfer.types.includes('Files')) {
            overlay.style.display = 'flex';
        }
    });

    overlay.addEventListener('dragover', (e) => {
        e.preventDefault();
        overlay.classList.add('drag-over');
    });

    overlay.addEventListener('dragleave', (e) => {
        e.preventDefault();
        if (e.target === overlay) {
            overlay.classList.remove('drag-over');
            overlay.style.display = 'none';
        }
    });

    overlay.addEventListener('drop', async (e) => {
        e.preventDefault();
        overlay.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        
        if (!file || file.type !== 'application/pdf') {
            overlay.style.display = 'none';
            if (file) showToast("Only PDF files are supported for AI generation.");
            return;
        }

        await handlePDFUpload(file);
    });

    document.getElementById('btn-cancel-dropzone')?.addEventListener('click', () => {
        overlay.style.display = 'none';
    });
}

// DRIVE PDF PICKER
let drivePickerNextPageToken = null;

const loadDrivePdfs = async (append = false) => {
    const listContainer = document.getElementById('drive-picker-list');
    const loadMoreBtn = document.getElementById('drive-picker-load-more');
    const query = document.getElementById('drive-picker-search').value.trim();
    
    if (!append) {
        listContainer.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-secondary);">Loading PDFs...</div>';
        drivePickerNextPageToken = null;
    }
    
    try {
        const result = await listDrivePdfs(query, drivePickerNextPageToken);
        if (!append) listContainer.innerHTML = '';
        
        if (result.files.length === 0 && !append) {
            listContainer.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-secondary);">No PDFs found.</div>';
        }
        
        result.files.forEach(file => {
            const el = document.createElement('div');
            el.style.cssText = 'padding:12px; border:2px solid var(--border-color); background:var(--bg-secondary); cursor:pointer; display:flex; justify-content:space-between; align-items:center;';
            el.innerHTML = `<span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:85%;">${file.name}</span> <span style="font-size:12px; color:var(--text-secondary);">Select</span>`;
            
            el.addEventListener('mouseenter', () => el.style.background = 'var(--hover-bg)');
            el.addEventListener('mouseleave', () => el.style.background = 'var(--bg-secondary)');
            
            el.addEventListener('click', async () => {
                document.getElementById('modal-drive-picker').style.display = 'none';
                document.getElementById('dropzone-overlay').style.display = 'flex';
                
                try {
                    const blob = await downloadPdfFromDrive(file.id);
                    const pdfFile = new File([blob], file.name, { type: 'application/pdf' });
                    await handlePDFUpload(pdfFile);
                } catch (err) {
                    document.getElementById('dropzone-overlay').style.display = 'none';
                    showToast("Drive Error: " + err.message);
                }
            });
            listContainer.appendChild(el);
        });
        
        drivePickerNextPageToken = result.nextPageToken;
        loadMoreBtn.style.display = drivePickerNextPageToken ? 'block' : 'none';
        
    } catch (err) {
        if (!append) listContainer.innerHTML = `<div style="color:var(--border-color); text-align:center; padding:20px;">${err.message}</div>`;
    }
};

if (document.getElementById('btn-menu-add-pdf-drive')) {
    document.getElementById('btn-menu-add-pdf-drive').addEventListener('click', () => {
        document.getElementById('modal-drive-picker').style.display = 'flex';
        document.getElementById('drive-picker-search').value = '';
        loadDrivePdfs();
    });
}
if (document.getElementById('btn-cancel-drive-picker')) {
    document.getElementById('btn-cancel-drive-picker').addEventListener('click', () => {
        document.getElementById('modal-drive-picker').style.display = 'none';
    });
}
if (document.getElementById('drive-picker-search')) {
    document.getElementById('drive-picker-search').addEventListener('input', () => {
        clearTimeout(window.driveSearchTimeout);
        window.driveSearchTimeout = setTimeout(() => {
            loadDrivePdfs();
        }, 500);
    });
}
if (document.getElementById('drive-picker-load-more')) {
    document.getElementById('drive-picker-load-more').addEventListener('click', () => {
        loadDrivePdfs(true);
    });
}



if (document.getElementById('btn-add-menu')) {
    document.getElementById('btn-add-menu').addEventListener('click', (e) => {
        e.stopPropagation();
        document.getElementById('add-dropdown-container').classList.toggle('show');
    });

    document.addEventListener('click', () => {
        const container = document.getElementById('add-dropdown-container');
        if (container) container.classList.remove('show');
    });
}


runtime.onMessage((msg) => {
    if (msg.action === 'REFRESH_DECKS') {
        if (typeof refreshSidebar === 'function') refreshSidebar();
        if (typeof showHome === 'function') {
            if (currentView === 'home') showHome();
            else if (currentView === 'folder') showFolder(currentFolderId, currentFolderName);
        }
    }
});
