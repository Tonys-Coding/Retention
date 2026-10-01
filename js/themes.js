/**
 * themes.js — Theme catalog, favorites, and the quick theme menu.
 *
 * Shared by the extension popup (app.js) and the web/mobile dashboard
 * (dashboard.js, themes-library.js). The theme itself is applied by
 * css/style.css (`body.theme-<id>`); the colors and background artwork below
 * only drive previews and swatches, so keep them in sync with style.css.
 */

const THEME_KEY = 'theme';
const FAVORITES_KEY = 'theme_favorites';

export const THEME_GROUPS = ['Classics', 'Aesthetics', 'Star Wars Collection'];

const CHECKER = (c) => `linear-gradient(45deg, ${c} 25%, transparent 25%, transparent 75%, ${c} 75%), linear-gradient(45deg, ${c} 25%, transparent 25%, transparent 75%, ${c} 75%)`;
const KYLO_CRACKS = 'linear-gradient(65deg, transparent calc(25% - 1px), rgba(234, 28, 28, 0.9) 25%, transparent calc(25% + 1px)), linear-gradient(25deg, transparent calc(38% - 1px), rgba(234, 28, 28, 0.9) 38%, transparent calc(38% + 1px)), linear-gradient(-55deg, transparent calc(65% - 1px), rgba(234, 28, 28, 0.9) 65%, transparent calc(65% + 1px)), linear-gradient(-35deg, transparent calc(72% - 1px), rgba(234, 28, 28, 0.9) 72%, transparent calc(72% + 1px)), linear-gradient(80deg, transparent calc(80% - 1px), rgba(234, 28, 28, 0.9) 80%, transparent calc(80% + 1px))';
const KYLO_VISOR = 'radial-gradient(620px 330px at 50% -90px, transparent calc(45% - 1px), rgba(144, 144, 144, 0.2) 45%, rgba(200, 200, 200, 0.4) calc(45% + 6px), transparent calc(45% + 7px), transparent calc(48% - 1px), rgba(144, 144, 144, 0.2) 48%, rgba(200, 200, 200, 0.4) calc(48% + 6px), transparent calc(48% + 7px), transparent calc(51% - 1px), rgba(144, 144, 144, 0.2) 51%, rgba(200, 200, 200, 0.4) calc(51% + 6px), transparent calc(51% + 7px), transparent calc(54% - 1px), rgba(144, 144, 144, 0.2) 54%, rgba(200, 200, 200, 0.4) calc(54% + 6px), transparent calc(54% + 7px))';

/**
 * Every theme: `bg`/`card`/`text`/`sub`/`border`/`shadow` mirror the theme's
 * --bg-primary/--bg-secondary/--text-primary/--text-secondary/--border-color/
 * --shadow-color; `btnBg`/`btnText` its primary button; `img`/`size`/`pos` its
 * body background artwork (`tileImg` is a simplified version for tiny swatches).
 */
export const THEMES = [
    { id: 'light', name: 'Light', group: 'Classics', bg: '#ffffff', card: '#ffffff', text: '#000000', sub: '#666666', border: '#000000', shadow: '#000000', btnBg: '#000000', btnText: '#ffffff',
        pattern: 'Checker', img: CHECKER('rgba(0, 0, 0, 0.05)'), size: '20px 20px', pos: '0 0, 10px 10px' },
    { id: 'dark', name: 'Dark', group: 'Classics', bg: '#121212', card: '#1e1e1e', text: '#e5e5e5', sub: '#a0a0a0', border: '#404040', shadow: '#000000', btnBg: '#e5e5e5', btnText: '#121212',
        pattern: 'Checker', img: CHECKER('rgba(64, 64, 64, 0.08)'), size: '20px 20px', pos: '0 0, 10px 10px' },
    { id: 'autumn', name: 'Autumn', group: 'Aesthetics', bg: '#c25e29', card: '#f4ebd8', text: '#2d1b0f', sub: '#5c3924', border: '#2d1b0f', shadow: '#2d1b0f', btnBg: '#2d1b0f', btnText: '#f4ebd8',
        pattern: 'Plaid', img: 'repeating-linear-gradient(90deg, transparent, transparent 40px, rgba(45, 27, 15, 0.1) 40px, rgba(45, 27, 15, 0.1) 80px), repeating-linear-gradient(180deg, transparent, transparent 40px, rgba(45, 27, 15, 0.1) 40px, rgba(45, 27, 15, 0.1) 80px)' },
    { id: 'terminal', name: 'Terminal', group: 'Aesthetics', bg: '#0a0a0a', card: '#111111', text: '#4ade80', sub: '#22c55e', border: '#22c55e', shadow: '#166534', btnBg: '#4ade80', btnText: '#0a0a0a',
        pattern: 'Checker', img: CHECKER('rgba(34, 197, 94, 0.06)'), size: '20px 20px', pos: '0 0, 10px 10px' },
    { id: 'vaporwave', name: 'Vaporwave', group: 'Aesthetics', bg: '#ff71ce', card: '#01cdfe', text: '#000000', sub: '#ffffff', border: '#000000', shadow: '#b967ff', btnBg: '#b967ff', btnText: '#ffffff',
        pattern: 'Grid', img: 'linear-gradient(rgba(255, 255, 255, 0.4) 2px, transparent 2px), linear-gradient(90deg, rgba(255, 255, 255, 0.4) 2px, transparent 2px)', size: '30px 30px' },
    { id: 'blueprint', name: 'Blueprint', group: 'Aesthetics', bg: '#0a3d91', card: '#ffffff', text: '#0a3d91', sub: '#062a66', border: '#000000', shadow: '#000000', btnBg: '#0a3d91', btnText: '#ffffff',
        pattern: 'Drafting grid', img: 'linear-gradient(rgba(255, 255, 255, 0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.3) 1px, transparent 1px), linear-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.1) 1px, transparent 1px)', size: '40px 40px, 40px 40px, 10px 10px, 10px 10px' },
    { id: 'neopop', name: 'Neo-Pop', group: 'Aesthetics', bg: '#a7f3d0', card: '#fbcfe8', text: '#000000', sub: '#333333', border: '#000000', shadow: '#000000', btnBg: '#000000', btnText: '#a7f3d0',
        pattern: 'Halftone', img: 'radial-gradient(#000000 15%, transparent 15%)', size: '20px 20px' },
    { id: 'composition', name: 'Composition', group: 'Aesthetics', bg: '#fdf6e3', card: '#ffffff', text: '#000000', sub: '#444444', border: '#000000', shadow: '#000000', btnBg: '#000000', btnText: '#ffffff',
        pattern: 'Notebook paper', img: 'linear-gradient(90deg, transparent 40px, #ff4d6d 40px, #ff4d6d 43px, transparent 43px), repeating-linear-gradient(0deg, transparent, transparent 27px, #3b82f6 27px, #3b82f6 29px)' },
    { id: 'dracula', name: 'Dracula', group: 'Aesthetics', bg: '#15161e', card: '#282a36', text: '#f8f8f2', sub: '#bd93f9', border: '#ff5555', shadow: '#000000', btnBg: '#ff5555', btnText: '#ffffff',
        pattern: 'Solid', img: 'none' },
    { id: 'earthy', name: 'Earthy', group: 'Aesthetics', bg: '#3b5240', card: '#e0d5c1', text: '#1f140c', sub: '#4a3626', border: '#1f140c', shadow: '#1f140c', btnBg: '#1f140c', btnText: '#e0d5c1',
        pattern: 'Ripples', img: 'repeating-radial-gradient(circle at 0 0, transparent, transparent 40px, rgba(31, 20, 12, 0.1) 40px, rgba(31, 20, 12, 0.1) 42px)' },
    { id: 'space', name: 'Space', group: 'Aesthetics', bg: '#04050a', card: '#101423', text: '#e2e8f0', sub: '#8b99af', border: '#00f0ff', shadow: '#00f0ff', btnBg: '#00f0ff', btnText: '#04050a',
        pattern: 'Starfield', img: 'radial-gradient(white, rgba(255, 255, 255, 0.2) 2px, transparent 4px), radial-gradient(white, rgba(255, 255, 255, 0.15) 1px, transparent 3px), radial-gradient(white, rgba(255, 255, 255, 0.1) 2px, transparent 4px), radial-gradient(rgba(255, 255, 255, 0.4), rgba(255, 255, 255, 0.1) 2px, transparent 3px)', size: '50px 50px, 40px 40px, 30px 30px, 60px 60px', pos: '0 0, 20px 20px, 15px 5px, 35px 25px' },
    { id: 'moon', name: 'Moon', group: 'Aesthetics', bg: '#8a8d91', card: '#ffffff', text: '#000000', sub: '#333333', border: '#000000', shadow: '#000000', btnBg: '#000000', btnText: '#ffffff',
        pattern: 'Craters', img: 'radial-gradient(rgba(0, 0, 0, 0.15) 2px, transparent 2px)', size: '20px 20px' },
    { id: 'cabin', name: 'Cozy Cabin', group: 'Aesthetics', bg: '#382215', card: '#e6cda3', text: '#211204', sub: '#4a2c16', border: '#1a0f09', shadow: '#1a0f09', btnBg: '#8a2522', btnText: '#ffffff',
        pattern: 'Log walls', img: 'repeating-linear-gradient(180deg, #382215, #382215 38px, #1a0f09 38px, #1a0f09 42px)' },
    { id: 'matcha', name: 'Matcha', group: 'Aesthetics', bg: '#d1deb9', card: '#fcf9f2', text: '#2c3d25', sub: '#4c6b41', border: '#2c3d25', shadow: '#2c3d25', btnBg: '#2c3d25', btnText: '#ffffff',
        pattern: 'Diagonal stripes', img: 'repeating-linear-gradient(45deg, rgba(255, 255, 255, 0.5), rgba(255, 255, 255, 0.5) 2px, transparent 2px, transparent 12px)' },
    { id: 'tatooine', name: 'Tatooine', group: 'Star Wars Collection', bg: '#e6c280', card: '#f4dca6', text: '#3d2314', sub: '#6e3d22', border: '#3d2314', shadow: '#8c4a22', btnBg: '#8c4a22', btnText: '#f4dca6',
        pattern: 'Twin suns', img: 'radial-gradient(circle at 80% 20%, rgba(255, 165, 0, 0.4) 10px, transparent 40px), radial-gradient(circle at 65% 15%, rgba(255, 69, 0, 0.5) 15px, transparent 50px)' },
    { id: 'kylo', name: 'Kylo', group: 'Star Wars Collection', bg: '#000000', card: '#120202', text: '#909090', sub: '#ea1c1c', border: '#3f1b1b', shadow: '#120202', btnBg: '#3f1b1b', btnText: '#909090',
        pattern: 'Kintsugi + chrome', img: `${KYLO_CRACKS}, ${KYLO_VISOR}`, tileImg: KYLO_CRACKS },
    { id: 'strawberry', name: 'Strawberry', group: 'Aesthetics', bg: '#FA2A28', card: '#FEC0A9', text: '#B60D17', sub: '#336B26', border: '#B60D17', shadow: '#B60D17', btnBg: '#C9CF56', btnText: '#336B26',
        pattern: 'Seeds', img: 'radial-gradient(ellipse at center, #C9CF56 3px, transparent 4px), radial-gradient(ellipse at center, #C9CF56 3px, transparent 4px)', size: '60px 80px', pos: '0 0, 30px 40px' }
].map((t) => ({ size: 'auto', pos: '0 0', tileImg: t.img, ...t }));

const luminance = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export const getTheme = (id) => THEMES.find((t) => t.id === id) || THEMES[0];
export const isDarkTheme = (theme) => luminance(theme.card) < 0.2;

/** Paints an element with a theme's background color and artwork. */
export const paintThemeBackground = (el, theme, { tile = false } = {}) => {
    el.style.backgroundColor = theme.bg;
    el.style.backgroundImage = tile ? theme.tileImg : theme.img;
    el.style.backgroundSize = theme.size;
    el.style.backgroundPosition = theme.pos;
};

/** A small swatch: the theme's background artwork with a card-colored chip. */
export const createThemeTile = (theme, className = 'theme-tile') => {
    const tile = document.createElement('span');
    tile.className = className;
    tile.setAttribute('aria-hidden', 'true');
    paintThemeBackground(tile, theme, { tile: true });
    const chip = document.createElement('span');
    chip.style.background = theme.card;
    chip.style.borderColor = theme.border;
    tile.appendChild(chip);
    return tile;
};

// ─── Active theme ────────────────────────────────────────────────────
export const getActiveThemeId = () => {
    const id = localStorage.getItem(THEME_KEY);
    return THEMES.some((t) => t.id === id) ? id : 'light';
};

const setBodyThemeClass = (id) => {
    document.body.classList.remove('dark-mode', ...THEMES.map((t) => `theme-${t.id}`));
    if (id !== 'light') document.body.classList.add(`theme-${id}`);
};

export const applyTheme = (id) => {
    setBodyThemeClass(id);
    localStorage.setItem(THEME_KEY, id);
    window.dispatchEvent(new CustomEvent('retention:themechange', { detail: id }));
};

/** Applies the saved theme and follows changes made in other tabs/popups. */
export const initTheme = () => {
    setBodyThemeClass(getActiveThemeId());
    window.addEventListener('storage', (e) => {
        if (e.key === THEME_KEY) {
            setBodyThemeClass(getActiveThemeId());
            window.dispatchEvent(new CustomEvent('retention:themechange', { detail: getActiveThemeId() }));
        } else if (e.key === FAVORITES_KEY) {
            window.dispatchEvent(new Event('retention:favoriteschange'));
        }
    });
};

// ─── Favorites (ordered; the quick menu lists them in this order) ───
export const getFavorites = () => {
    let ids = null;
    try { ids = JSON.parse(localStorage.getItem(FAVORITES_KEY)); } catch { /* ignore */ }
    if (!Array.isArray(ids)) {
        // First run: start with the classics plus whatever theme is in use
        ids = [...new Set(['light', 'dark', getActiveThemeId()])];
    }
    return ids.filter((id, i) => THEMES.some((t) => t.id === id) && ids.indexOf(id) === i);
};

export const setFavorites = (ids) => {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(ids));
    window.dispatchEvent(new Event('retention:favoriteschange'));
};

export const isFavorite = (id) => getFavorites().includes(id);

export const toggleFavorite = (id) => {
    const favs = getFavorites();
    setFavorites(favs.includes(id) ? favs.filter((f) => f !== id) : [...favs, id]);
};

/** Moves a favorite to a new position in the list. */
export const moveFavorite = (id, toIndex) => {
    const favs = getFavorites().filter((f) => f !== id);
    favs.splice(Math.max(0, Math.min(toIndex, favs.length)), 0, id);
    setFavorites(favs);
};

// ─── Quick theme menu (palette button) ───────────────────────────────
const CHECK_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>';
const ARROW_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>';
const EXTERNAL_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>';
const STAR_SVG = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>';

let openMenu = null;

const closeThemeMenu = () => {
    if (!openMenu) return;
    openMenu.cleanup();
    openMenu.el.remove();
    openMenu.anchor.setAttribute('aria-expanded', 'false');
    openMenu = null;
};

/**
 * Toggles the favorites-only theme menu under `anchor`.
 * @param {HTMLElement} anchor  the palette button
 * @param {{ onBrowse: () => void, browseLabel: string, browseHint: string, external?: boolean }} options
 */
export const toggleThemeMenu = (anchor, { onBrowse, browseLabel, browseHint, external = false }) => {
    if (openMenu) {
        const wasSame = openMenu.anchor === anchor;
        closeThemeMenu();
        if (wasSame) return;
    }

    const menu = document.createElement('div');
    menu.className = 'theme-menu theme-quick-menu';
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', 'Favorite themes');

    const favorites = getFavorites().map(getTheme);
    const activeId = getActiveThemeId();

    const header = document.createElement('div');
    header.className = 'tq-header';
    header.innerHTML = '<span>Favorite themes</span>';
    menu.appendChild(header);

    if (favorites.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'tq-empty';
        empty.innerHTML = `<span class="tq-empty-icon">${STAR_SVG}</span><strong>No favorites yet</strong><span>Star themes in the library to pin them here for one-click switching.</span>`;
        menu.appendChild(empty);
    }

    favorites.forEach((theme) => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'theme-option';
        item.setAttribute('role', 'menuitemradio');
        item.setAttribute('aria-checked', String(theme.id === activeId));
        item.appendChild(createThemeTile(theme));
        const label = document.createElement('span');
        label.className = 'tq-name';
        label.textContent = theme.name;
        item.appendChild(label);
        if (theme.id === activeId) item.insertAdjacentHTML('beforeend', CHECK_SVG);
        item.addEventListener('click', () => {
            applyTheme(theme.id);
            closeThemeMenu();
        });
        menu.appendChild(item);
    });

    const browse = document.createElement('button');
    browse.type = 'button';
    browse.className = 'tq-browse';
    browse.setAttribute('role', 'menuitem');
    browse.innerHTML = `<span><strong></strong><small></small></span>${external ? EXTERNAL_SVG : ARROW_SVG}`;
    browse.querySelector('strong').textContent = browseLabel;
    browse.querySelector('small').textContent = browseHint;
    browse.addEventListener('click', () => {
        closeThemeMenu();
        onBrowse();
    });
    menu.appendChild(browse);

    document.body.appendChild(menu);
    menu.style.display = 'flex';
    // Right-align under the button, but keep the whole menu inside the window
    // (the popup's palette button sits left of center in a 480px window)
    const position = () => {
        const rect = anchor.getBoundingClientRect();
        const left = Math.min(rect.right - menu.offsetWidth, window.innerWidth - menu.offsetWidth - 8);
        menu.style.top = `${rect.bottom + 8}px`;
        menu.style.left = `${Math.max(8, left)}px`;
    };
    position();
    anchor.setAttribute('aria-expanded', 'true');

    const items = () => [...menu.querySelectorAll('button')];
    const onDocClick = (e) => {
        if (!menu.contains(e.target) && !anchor.contains(e.target)) closeThemeMenu();
    };
    const onKey = (e) => {
        if (e.key === 'Escape') {
            closeThemeMenu();
            anchor.focus();
        } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            const list = items();
            const i = list.indexOf(document.activeElement);
            const next = e.key === 'ArrowDown' ? (i + 1) % list.length : (i - 1 + list.length) % list.length;
            list[next].focus();
        }
    };
    // Defer so the click that opened the menu doesn't immediately close it
    setTimeout(() => document.addEventListener('click', onDocClick), 0);
    document.addEventListener('keydown', onKey);
    // Mobile browsers resize when the address bar or keyboard moves: follow the button
    window.addEventListener('resize', position);

    openMenu = {
        el: menu,
        anchor,
        cleanup: () => {
            document.removeEventListener('click', onDocClick);
            document.removeEventListener('keydown', onKey);
            window.removeEventListener('resize', position);
        }
    };
    (menu.querySelector('[aria-checked="true"]') || items()[0])?.focus();
};
