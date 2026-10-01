/**
 * workspace.js — Shared folder/deck location helpers
 *
 * Used by both the extension popup (app.js) and the web/mobile
 * dashboard (dashboard.js): moving items, deleting folders without
 * losing their contents, and the "Move to…" destination picker.
 */

import { getFolders, getDecks, updateFolder, updateDeck, deleteFolder, addDeck, addCard } from './db.js';
import { parseDeckCSV } from './csv.js';

const FOLDER_SVG = (color) => `<svg width="18" height="18" viewBox="0 0 24 24" fill="${color || 'none'}" stroke="${color || 'currentColor'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex-shrink:0;"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`;
const HOME_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex-shrink:0;"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>`;

// Returns the ids of a folder and every folder nested beneath it
const getFolderSubtree = (folders, rootId) => {
    const ids = new Set([rootId]);
    let grew = true;
    while (grew) {
        grew = false;
        for (const f of folders) {
            if (f.parentId != null && ids.has(f.parentId) && !ids.has(f.id)) {
                ids.add(f.id);
                grew = true;
            }
        }
    }
    return ids;
};

/** Display name of a folder, or the workspace name for the root (null). */
export const getLocationName = async (folderId, rootName) => {
    if (folderId == null) return rootName;
    const folder = (await getFolders()).find(f => f.id === folderId);
    return folder ? folder.name : rootName;
};

/** Moves a deck or folder into targetFolderId (null = workspace root). */
export const moveItem = (type, item, targetFolderId) => type === 'folder'
    ? updateFolder(item.id, undefined, undefined, targetFolderId)
    : updateDeck(item.id, undefined, targetFolderId);

/**
 * Imports one or more CSV files into folderId (null = workspace root),
 * each file becoming its own deck named after the file. A CSV with a
 * Question column becomes a practice quiz deck; otherwise a flashcard deck.
 * A file that fails or contains nothing usable is skipped without stopping
 * the rest.
 *
 * @returns {Promise<{ decks: { name: string, cards: number, kind: string, skippedRows: number }[], skipped: string[] }>}
 */
export const importCsvFiles = async (files, folderId) => {
    const decks = [];
    const skipped = [];
    for (const file of files) {
        try {
            const { kind, cards, skipped: skippedRows } = parseDeckCSV(await file.text());
            if (cards.length === 0) {
                skipped.push(file.name);
                continue;
            }
            const name = file.name.replace(/\.csv$/i, '') || (kind === 'quiz' ? 'Imported Quiz' : 'Imported Deck');
            const deckId = await addDeck(name, folderId, kind);
            for (const card of cards) {
                await addCard({ ...card, deckId });
            }
            decks.push({ name, cards: cards.length, kind, skippedRows });
        } catch (err) {
            console.error(`CSV import failed for ${file.name}:`, err);
            skipped.push(file.name);
        }
    }
    return { decks, skipped };
};

/** Toast text summarising an importCsvFiles() result. */
export const describeCsvImport = ({ decks, skipped }, locationName) => {
    if (decks.length === 0) {
        return skipped.length > 1 ? 'Nothing to import in the selected CSV files.' : 'No cards or questions found. Check the CSV format.';
    }
    const unit = (d) => (d.kind === 'quiz' ? 'questions' : 'cards');
    let message = decks.length === 1
        ? `Imported ${decks[0].cards} ${unit(decks[0])} into ${decks[0].kind === 'quiz' ? 'quiz ' : ''}"${decks[0].name}" in "${locationName}"`
        : `Imported ${decks.length} decks into "${locationName}"`;
    const badRows = decks.reduce((sum, d) => sum + (d.skippedRows || 0), 0);
    if (badRows > 0) message += ` · Skipped ${badRows} incomplete question${badRows > 1 ? 's' : ''}`;
    if (skipped.length > 0) {
        message += ` · Skipped ${skipped.length} file${skipped.length > 1 ? 's' : ''}: ${skipped.join(', ')}`;
    }
    return message;
};

/**
 * Deletes a folder, moving its decks and sub-folders up into the
 * folder's parent so nothing is lost or left orphaned.
 */
export const deleteFolderKeepContents = async (folder) => {
    const parentId = folder.parentId ?? null;
    const [folders, decks] = await Promise.all([getFolders(), getDecks()]);
    for (const d of decks.filter(d => d.folderId === folder.id)) {
        await updateDeck(d.id, undefined, parentId);
    }
    for (const f of folders.filter(f => f.parentId === folder.id)) {
        await updateFolder(f.id, undefined, undefined, parentId);
    }
    await deleteFolder(folder.id);
};

/**
 * Opens the "Move to…" picker for a deck or folder.
 * A folder can't be moved into itself or any of its own sub-folders.
 *
 * @param {{ type: 'deck'|'folder', item: object, rootName: string,
 *           onMoved?: (targetFolderId: number|null, targetName: string) => void }} opts
 */
export const openMovePicker = async ({ type, item, rootName, onMoved }) => {
    const folders = await getFolders();
    const currentParentId = (type === 'folder' ? item.parentId : item.folderId) ?? null;
    const blocked = type === 'folder' ? getFolderSubtree(folders, item.id) : new Set();

    const overlay = document.createElement('div');
    overlay.className = 'move-overlay';
    overlay.innerHTML = `
        <div class="move-modal" role="dialog" aria-modal="true" aria-labelledby="move-title">
            <h2 id="move-title">Move to…</h2>
            <p class="move-subtitle">Choose a new location for <strong></strong></p>
            <div class="move-list" role="list"></div>
            <button type="button" class="move-cancel">Cancel</button>
        </div>
    `;
    overlay.querySelector('.move-subtitle strong').textContent = `"${item.name}"`;
    const list = overlay.querySelector('.move-list');

    const close = () => {
        document.removeEventListener('keydown', onKey);
        overlay.remove();
    };
    const onKey = (e) => { if (e.key === 'Escape') close(); };

    const addRow = (folderId, name, depth, color) => {
        const isCurrent = folderId === currentParentId;
        const isSelf = type === 'folder' && folderId === item.id;
        const isBlocked = folderId !== null && blocked.has(folderId);

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'move-target';
        btn.setAttribute('role', 'listitem');
        btn.style.paddingLeft = `${12 + depth * 18}px`;
        btn.disabled = isCurrent || isBlocked;
        btn.innerHTML = folderId === null ? HOME_SVG : FOLDER_SVG(color);

        const label = document.createElement('span');
        label.className = 'move-target-label';
        label.textContent = name;
        btn.appendChild(label);

        const tagText = isCurrent ? 'Current' : (isSelf ? 'This folder' : '');
        if (tagText) {
            const tag = document.createElement('span');
            tag.className = 'move-tag';
            tag.textContent = tagText;
            btn.appendChild(tag);
        }

        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await moveItem(type, item, folderId);
            close();
            onMoved?.(folderId, name);
        });
        list.appendChild(btn);
    };

    addRow(null, rootName, 0);
    const walk = (parentId, depth) => {
        folders
            .filter(f => (f.parentId ?? null) === parentId)
            .forEach(f => {
                addRow(f.id, f.name, depth, f.color);
                walk(f.id, depth + 1);
            });
    };
    walk(null, 1);

    overlay.addEventListener('click', (e) => {
        e.stopPropagation();
        if (e.target === overlay) close();
    });
    overlay.querySelector('.move-cancel').addEventListener('click', close);
    document.addEventListener('keydown', onKey);

    document.body.appendChild(overlay);
    overlay.querySelector('.move-target:not(:disabled)')?.focus();
};
