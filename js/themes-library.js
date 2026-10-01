/**
 * themes-library.js — The Themes library page (dashboard, web and mobile).
 *
 * Browse every theme with a live preview of its colors and background art,
 * apply one, star favorites, and reorder them (drag on desktop, or Reorder
 * mode with arrow buttons for keyboard and touch). Favorites feed the quick
 * theme menu behind the palette button.
 */

import {
    THEMES, THEME_COLLECTIONS, getTheme, isDarkTheme, paintThemeBackground, createThemeTile,
    getActiveThemeId, applyTheme, getFavorites, toggleFavorite, moveFavorite
} from './themes.js';

const ICON = {
    star: (filled) => `<svg width="22" height="22" viewBox="0 0 24 24" fill="${filled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`,
    check: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>',
    grip: '<svg width="14" height="20" viewBox="0 0 14 20" fill="currentColor" aria-hidden="true"><circle cx="4" cy="4" r="1.8"></circle><circle cx="10" cy="4" r="1.8"></circle><circle cx="4" cy="10" r="1.8"></circle><circle cx="10" cy="10" r="1.8"></circle><circle cx="4" cy="16" r="1.8"></circle><circle cx="10" cy="16" r="1.8"></circle></svg>',
    earlier: '<svg class="tl-move-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"></polyline></svg>',
    later: '<svg class="tl-move-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"></polyline></svg>',
    remove: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>',
    search: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>'
};

const FILTERS = [
    { id: 'all', label: 'All', test: () => true },
    { id: 'favorites', label: 'Favorites', test: (t, favs) => favs.includes(t.id) },
    { id: 'light', label: 'Light', test: (t) => !isDarkTheme(t) },
    { id: 'dark', label: 'Dark', test: (t) => isDarkTheme(t) }
];

const state = { filter: 'all', query: '', reordering: false, dragId: null };
let root = null;
let globalListenersBound = false;

const el = (tag, className, html) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (html !== undefined) node.innerHTML = html;
    return node;
};

const actionButton = (action, id, className, html, label) => {
    const btn = el('button', className, html);
    btn.type = 'button';
    btn.dataset.action = action;
    if (id) btn.dataset.id = id;
    if (label) btn.setAttribute('aria-label', label);
    return btn;
};

// ─── Favorites shelf ─────────────────────────────────────────────────
function renderShelf() {
    const shelf = root.querySelector('.tl-shelf');
    const favs = getFavorites();
    const activeId = getActiveThemeId();

    shelf.classList.toggle('is-reordering', state.reordering);
    root.querySelector('.tl-fav-count').textContent = `${favs.length} of ${THEMES.length} starred`;
    const canDrag = window.matchMedia('(hover: hover)').matches;
    root.querySelector('.tl-shelf-hint').textContent = state.reordering
        ? `${canDrag ? 'Drag the chips or use the arrows' : 'Use the arrows'}. The palette menu lists your favorites in this order.`
        : `Starred themes show up in the palette menu for one-click switching. ${canDrag ? 'Drag them or tap Reorder' : 'Tap Reorder'} to change their order.`;

    const reorderBtn = root.querySelector('[data-action="reorder"]');
    reorderBtn.hidden = favs.length < 2;
    reorderBtn.textContent = state.reordering ? 'Done' : 'Reorder';
    reorderBtn.setAttribute('aria-pressed', String(state.reordering));
    if (favs.length < 2) state.reordering = false;

    const list = root.querySelector('.tl-chips');
    list.innerHTML = '';
    root.querySelector('.tl-shelf-empty').hidden = favs.length > 0;

    favs.forEach((id, index) => {
        const theme = getTheme(id);
        const isActive = id === activeId;
        const chip = el('li', `tl-chip${isActive ? ' is-active' : ''}`);
        chip.draggable = true;
        chip.dataset.id = id;
        chip.appendChild(el('span', 'tl-grip', ICON.grip));

        const apply = actionButton('apply', id, 'tl-chip-apply', '', `Apply ${theme.name} theme`);
        apply.setAttribute('aria-pressed', String(isActive));
        apply.appendChild(createThemeTile(theme, 'theme-tile theme-tile--lg'));
        if (state.reordering) apply.appendChild(el('span', 'tl-chip-pos', `${index + 1}.`));
        const name = el('span', 'tl-chip-name');
        name.textContent = theme.name;
        apply.appendChild(name);
        if (isActive) apply.insertAdjacentHTML('beforeend', ICON.check);
        chip.appendChild(apply);

        if (state.reordering) {
            const controls = el('div', 'tl-chip-controls');
            const earlier = actionButton('move-earlier', id, 'tl-chip-ctrl', ICON.earlier, `Move ${theme.name} earlier`);
            earlier.disabled = index === 0;
            const later = actionButton('move-later', id, 'tl-chip-ctrl', ICON.later, `Move ${theme.name} later`);
            later.disabled = index === favs.length - 1;
            controls.append(earlier, later, actionButton('toggle-fav', id, 'tl-chip-ctrl', ICON.remove, `Remove ${theme.name} from favorites`));
            chip.appendChild(controls);
        }
        list.appendChild(chip);
    });
}

// ─── Theme grid ──────────────────────────────────────────────────────
function renderThemeCard(theme, favs, activeId) {
    const isFav = favs.includes(theme.id);
    const isActive = theme.id === activeId;
    const card = el('article', `tl-card${isActive ? ' is-active' : ''}`);

    const preview = el('div', 'tl-preview');
    preview.setAttribute('aria-hidden', 'true');
    paintThemeBackground(preview, theme);
    const mini = el('div', 'tl-mini-card');
    Object.assign(mini.style, { background: theme.card, borderColor: theme.border, boxShadow: `6px 6px 0 ${theme.shadow}` });
    const q = el('span', 'tl-mini-term');
    q.textContent = 'What is TCP?';
    q.style.color = theme.text;
    const hint = el('span', 'tl-mini-hint');
    hint.textContent = '(tap to flip)';
    hint.style.color = theme.sub;
    mini.append(q, hint);
    const buttons = el('div', 'tl-mini-buttons');
    const forgot = el('span', 'tl-mini-btn');
    forgot.textContent = 'Forgot';
    Object.assign(forgot.style, { background: theme.card, color: theme.text, borderColor: theme.border, boxShadow: `2px 2px 0 ${theme.shadow}` });
    const know = el('span', 'tl-mini-btn');
    know.textContent = 'Know';
    Object.assign(know.style, { background: theme.btnBg, color: theme.btnText, borderColor: theme.border, boxShadow: `2px 2px 0 ${theme.shadow}` });
    buttons.append(forgot, know);
    preview.append(mini, buttons);

    const footer = el('div', 'tl-card-footer');
    const info = el('div', 'tl-card-info');
    const name = el('h3', 'tl-card-name');
    name.textContent = theme.name;
    const meta = el('span', 'tl-card-meta');
    meta.textContent = `${isDarkTheme(theme) ? 'Dark' : 'Light'} · ${theme.pattern}`;
    info.append(name, meta);

    const star = actionButton('toggle-fav', theme.id, 'tl-star', ICON.star(isFav),
        isFav ? `Remove ${theme.name} from favorites` : `Add ${theme.name} to favorites`);
    star.setAttribute('aria-pressed', String(isFav));
    star.title = star.getAttribute('aria-label');

    footer.append(info, star);
    if (isActive) {
        footer.appendChild(el('span', 'tl-active-badge', 'Active'));
    } else {
        footer.appendChild(actionButton('apply', theme.id, 'tl-apply', 'Apply', `Apply ${theme.name} theme`));
    }
    card.append(preview, footer);
    return card;
}

function renderGrid() {
    const favs = getFavorites();
    const activeId = getActiveThemeId();
    const filter = FILTERS.find((f) => f.id === state.filter);
    const q = state.query.trim().toLowerCase();
    const matches = (t) => (!q || t.name.toLowerCase().includes(q)) && filter.test(t, favs);

    root.querySelectorAll('[data-action="filter"]').forEach((btn) => {
        const f = FILTERS.find((x) => x.id === btn.dataset.id);
        btn.textContent = `${f.label} · ${THEMES.filter((t) => f.test(t, favs)).length}`;
        btn.setAttribute('aria-pressed', String(f.id === state.filter));
    });

    const results = root.querySelector('.tl-results');
    results.innerHTML = '';
    let shown = 0;
    THEME_COLLECTIONS.forEach((collection) => {
        const themes = THEMES.filter((t) => t.collection === collection.id && matches(t));
        if (themes.length === 0) return;
        shown += themes.length;
        const section = el('section', 'tl-group');
        section.setAttribute('aria-labelledby', `tl-collection-${collection.id}`);
        const head = el('div', 'tl-group-head');
        const title = el('h2', 'tl-group-title');
        title.id = `tl-collection-${collection.id}`;
        title.textContent = collection.name;
        title.appendChild(el('span', 'tl-group-count', String(themes.length)));
        const description = el('p', 'tl-group-desc');
        description.textContent = collection.description;
        head.append(title, description);
        const grid = el('div', 'tl-grid');
        themes.forEach((t) => grid.appendChild(renderThemeCard(t, favs, activeId)));
        section.append(head, grid);
        results.appendChild(section);
    });
    if (shown === 0) {
        results.appendChild(el('p', 'tl-no-results', 'No themes match. Try another name or clear the filter.'));
    }
}

function renderAll(focusAfter) {
    if (!root || !root.isConnected) return;
    renderShelf();
    renderGrid();
    // Re-rendering replaces the buttons: keep keyboard focus on the same control
    if (focusAfter) {
        const [action, id] = focusAfter;
        (root.querySelector(`[data-action="${action}"][data-id="${id}"]`) ||
            root.querySelector(`[data-action="toggle-fav"][data-id="${id}"]`))?.focus();
    }
}

// ─── Events ──────────────────────────────────────────────────────────
function onClick(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn || !root.contains(btn) || btn.disabled) return;
    const { action, id } = btn.dataset;
    const favs = getFavorites();
    switch (action) {
        case 'apply':
            applyTheme(id);
            break;
        case 'toggle-fav':
            toggleFavorite(id);
            break;
        case 'move-earlier':
            moveFavorite(id, favs.indexOf(id) - 1);
            break;
        case 'move-later':
            moveFavorite(id, favs.indexOf(id) + 1);
            break;
        case 'reorder':
            state.reordering = !state.reordering;
            break;
        case 'filter':
            state.filter = id;
            break;
        default:
            return;
    }
    renderAll([action, id]);
}

const clearDropTargets = () => root.querySelectorAll('.tl-chip').forEach((c) => c.classList.remove('is-dragging', 'is-drop-target'));

function bindDragAndDrop(list) {
    list.addEventListener('dragstart', (e) => {
        const chip = e.target.closest('.tl-chip');
        if (!chip) return;
        state.dragId = chip.dataset.id;
        chip.classList.add('is-dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', chip.dataset.id);
    });
    list.addEventListener('dragover', (e) => {
        const chip = e.target.closest('.tl-chip');
        if (!chip || !state.dragId) return;
        e.preventDefault();
        root.querySelectorAll('.tl-chip.is-drop-target').forEach((c) => c !== chip && c.classList.remove('is-drop-target'));
        if (chip.dataset.id !== state.dragId) chip.classList.add('is-drop-target');
    });
    list.addEventListener('drop', (e) => {
        const chip = e.target.closest('.tl-chip');
        if (!chip || !state.dragId) return;
        e.preventDefault();
        if (chip.dataset.id !== state.dragId) {
            moveFavorite(state.dragId, getFavorites().indexOf(chip.dataset.id));
        }
        state.dragId = null;
        renderAll();
    });
    list.addEventListener('dragend', () => {
        state.dragId = null;
        clearDropTargets();
    });
}

/** Renders the Themes library into `container` (call each time the view opens). */
export function renderThemesLibrary(container) {
    root = container;
    root.innerHTML = `
        <section class="tl-shelf" aria-labelledby="tl-fav-title">
            <div class="tl-shelf-head">
                <div class="tl-shelf-text">
                    <h2 id="tl-fav-title">Your favorites</h2>
                    <p class="tl-shelf-hint"></p>
                </div>
                <div class="tl-shelf-actions">
                    <span class="tl-fav-count"></span>
                    <button type="button" class="tl-toggle" data-action="reorder" aria-pressed="false">Reorder</button>
                </div>
            </div>
            <ol class="tl-chips" aria-label="Favorite themes, in palette menu order"></ol>
            <p class="tl-shelf-empty" hidden>No favorites yet. Tap the star on any theme below to pin it to your palette menu.</p>
        </section>
        <div class="tl-controls">
            <div class="tl-search">
                <label for="tl-search-input">Search themes</label>
                <div class="tl-search-box">
                    ${ICON.search}
                    <input id="tl-search-input" type="search" placeholder="Kylo, Matcha, Terminal…" autocomplete="off">
                </div>
            </div>
            <div class="tl-filters" role="group" aria-label="Filter themes">
                ${FILTERS.map((f) => `<button type="button" class="tl-toggle" data-action="filter" data-id="${f.id}" aria-pressed="false"></button>`).join('')}
            </div>
        </div>
        <div class="tl-results"></div>
    `;

    const search = root.querySelector('#tl-search-input');
    search.value = state.query;
    search.addEventListener('input', () => {
        state.query = search.value;
        renderGrid();
    });
    // The container persists between visits; its contents (and their listeners) don't
    if (!root.dataset.tlBound) {
        root.addEventListener('click', onClick);
        root.dataset.tlBound = 'true';
    }
    bindDragAndDrop(root.querySelector('.tl-chips'));

    if (!globalListenersBound) {
        // Theme or favorites changed elsewhere (quick menu, another tab, the popup)
        window.addEventListener('retention:themechange', () => renderAll());
        window.addEventListener('retention:favoriteschange', () => renderAll());
        globalListenersBound = true;
    }
    renderAll();
}
