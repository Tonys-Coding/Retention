/**
 * utils.js — Small helpers shared by the popup and the dashboard.
 */

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/**
 * Escapes text for safe use inside an HTML template string. User content
 * (deck/folder names, card text, file names, error messages) must go through
 * this: a name like "Bio <3" would otherwise vanish or break the markup.
 */
export const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);

// ─── Typed-answer matching (fill in the blank) ───────────────────────
const normalizeAnswer = (text) => String(text ?? '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(the|a|an)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const levenshtein = (a, b) => {
    const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
        let diag = prev[0];
        prev[0] = i;
        for (let j = 1; j <= b.length; j++) {
            const temp = prev[j];
            prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
            diag = temp;
        }
    }
    return prev[b.length];
};

/**
 * True when the typed text matches the answer, ignoring case, accents,
 * punctuation and articles, and forgiving a typo on longer answers
 * (none up to 4 letters, one up to 8, two beyond).
 */
export const isCloseAnswer = (input, answer) => {
    const typed = normalizeAnswer(input);
    const target = normalizeAnswer(answer);
    if (!typed || !target) return false;
    if (typed === target) return true;
    const allowed = target.length <= 4 ? 0 : target.length <= 8 ? 1 : 2;
    return levenshtein(typed, target) <= allowed;
};

// ─── Quick 10 ────────────────────────────────────────────────────────
/** In-place Fisher-Yates shuffle (unbiased, unlike sort(() => Math.random() - 0.5)). */
export const shuffleInPlace = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
};

/**
 * Picks 10 random cards, favouring cards that were NOT in this deck's previous
 * Quick 10, so repeated rounds keep surfacing different cards. Once the whole
 * deck has been cycled through, it starts over.
 */
export const pickQuickTen = (cards, deckKey) => {
    const storageKey = `quick10_seen_${deckKey}`;
    let seen = [];
    try { seen = JSON.parse(localStorage.getItem(storageKey)) || []; } catch { seen = []; }
    const seenSet = new Set(seen);
    const fresh = shuffleInPlace(cards.filter((c) => !seenSet.has(c.id)));
    const picked = fresh.slice(0, 10);
    if (picked.length < 10) {
        // Every card has had a turn: top up from the old pool and begin a new cycle
        const pickedIds = new Set(picked.map((c) => c.id));
        const topUp = shuffleInPlace(cards.filter((c) => !pickedIds.has(c.id))).slice(0, 10 - picked.length);
        picked.push(...topUp);
        seen = topUp.map((c) => c.id);
    } else {
        seen = [...seen, ...picked.map((c) => c.id)];
    }
    try { localStorage.setItem(storageKey, JSON.stringify(seen)); } catch {}
    return shuffleInPlace(picked);
};

// ─── Shared labels and icons (dashboard + popup) ─────────────────────
export const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * "3 decks · 2 folders · 1 quiz" for a folder's direct children. Zero counts are left out entirely,
 * so an empty folder returns ''. Quiz decks are counted as quizzes, not decks.
 */
export const folderSummary = (folderId, decks, folders) => {
    const inside = decks.filter((d) => d.folderId === folderId);
    const quizzes = inside.filter((d) => d.kind === 'quiz').length;
    const parts = [
        [inside.length - quizzes, 'deck'],
        [folders.filter((f) => f.parentId === folderId).length, 'folder'],
        [quizzes, 'quiz', 'zes']
    ].filter(([n]) => n > 0).map(([n, word, suffix]) => (suffix ? `${n} ${word}${n === 1 ? '' : suffix}` : plural(n, word)));
    return parts.join(' · ');
};

/**
 * The flashcard deck icon: an outlined card with a hard shadow at the bottom right.
 */
export const deckIconSvg = (width = 16, height = 19) => `<svg width="${width}" height="${height}" viewBox="0 0 28 36" style="flex-shrink:0;overflow:visible;" aria-hidden="true"><rect x="4" y="4" width="24" height="32" fill="var(--shadow-color)"></rect><rect x="0" y="0" width="24" height="32" fill="var(--bg-secondary)" stroke="var(--text-primary)" stroke-width="3"></rect></svg>`;
