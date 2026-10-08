/**
 * progress-view.js — The Progress page (dashboard) and the small stat widgets
 * reused by the home bar, deck panels and grid cards. Charts are inline SVG and
 * CSS (no libraries) and only use the theme's CSS variables, so every theme
 * works. All numbers come from stats.js.
 */

import { escapeHtml } from './utils.js';
import {
    DEFAULT_DAILY_GOAL, DECK_STALE_DAYS, ACHIEVEMENTS, buildDayMap, summarize, masteryBreakdown, heatmap, dailySeries, rollingAccuracy,
    timePatterns, hardestCards, deckStats, deckAggregates, groupByDate, dayDetails, weeklyComparison, buildInsights,
    quizStats, achievementContext, formatDuration, formatAgo, percent, addDays, dateString
} from './stats.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DECKS_PER_PAGE = 12;

// ─── Small reusable widgets ──────────────────────────────────────────
/** Circular progress (value/max) with the number in the middle. */
export const ringHtml = (value, max, size = 84) => {
    const r = 15.9155, c = 2 * Math.PI * r;
    const pct = Math.max(0, Math.min(1, max ? value / max : 0));
    return `<svg class="pg-ring" width="${size}" height="${size}" viewBox="0 0 36 36" role="img" aria-label="${value} of ${max}">
        <circle cx="18" cy="18" r="${r}" fill="none" stroke="currentColor" stroke-opacity=".15" stroke-width="3.6"></circle>
        <circle cx="18" cy="18" r="${r}" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="${pct > 0 ? 'round' : 'butt'}"
            stroke-dasharray="${(c * pct).toFixed(2)} ${c.toFixed(2)}" transform="rotate(-90 18 18)"></circle>
        <text x="18" y="19.4" text-anchor="middle" font-size="8.4" font-weight="900" fill="currentColor">${value}</text>
        <text x="18" y="25.4" text-anchor="middle" font-size="3.6" font-weight="700" fill="currentColor" opacity=".7">OF ${max}</text>
    </svg>`;
};

/** Stacked bar: mastered / still learning / not studied. */
export const masteryBarHtml = (b, { legend = false, thin = false } = {}) => {
    const t = b.total || 1;
    const seg = (n, cls, label) => (n ? `<span class="pg-seg ${cls}" style="width:${(n / t) * 100}%" title="${label}: ${n}"></span>` : '');
    return `<div class="pg-mastery${thin ? ' pg-mastery--thin' : ''}" role="img" aria-label="${b.mastered} mastered, ${b.learning} still learning, ${b.notStudied} not studied">
        ${seg(b.mastered, 'is-mastered', 'Mastered')}${seg(b.learning, 'is-learning', 'Still learning')}${seg(b.notStudied, 'is-new', 'Not studied')}
    </div>${legend ? `<div class="pg-legend">
        <span><i class="pg-dot is-mastered"></i>Mastered <b>${b.mastered}</b></span>
        <span><i class="pg-dot is-learning"></i>Still learning <b>${b.learning}</b></span>
        <span><i class="pg-dot is-new"></i>Not studied <b>${b.notStudied}</b></span></div>` : ''}`;
};

const tile = (label, value, subs = [], extra = '') =>
    `<div class="pg-tile">${extra}<div class="pg-tile-value">${value}</div><div class="pg-tile-label">${label}</div>${subs.filter(Boolean).map((s) => `<div class="pg-tile-sub">${s}</div>`).join('')}</div>`;

const signed = (n, suffix = '') => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${Math.abs(n)}${suffix}`;
const fmtDate = (date) => {
    const [y, m, d] = date.split('-').map(Number);
    return new Date(y, m - 1, d, 12).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
};
const fmtUs = (date) => { const [y, m, d] = date.split('-'); return `${m}/${d}/${y}`; };
const fmtTime = (ts) => new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

// ─── Charts ──────────────────────────────────────────────────────────
const heatmapSvg = (cols, selected) => {
    const cell = 15, gap = 4, left = 32, top = 20;
    const width = left + cols.length * (cell + gap), height = top + 7 * (cell + gap);
    let months = '', lastMonth = -1;
    const cells = cols.map((col, x) => {
        const m = Number(col[0].date.slice(5, 7)) - 1;
        if (m !== lastMonth && Number(col[0].date.slice(8)) <= 7) { months += `<text x="${left + x * (cell + gap)}" y="11" class="pg-axis">${MONTHS[m]}</text>`; lastMonth = m; }
        return col.map((d, y) => (d.level < 0 ? '' :
            `<rect class="pg-hm l${d.level}${d.date === selected ? ' is-selected' : ''}" data-date="${d.date}" x="${left + x * (cell + gap)}" y="${top + y * (cell + gap)}" width="${cell}" height="${cell}" rx="2"></rect>`)).join('');
    }).join('');
    const labels = [1, 3, 5].map((i) => `<text x="0" y="${top + i * (cell + gap) + 10}" class="pg-axis">${WEEKDAYS[i]}</text>`).join('');
    return `<svg class="pg-heatmap" viewBox="0 0 ${width} ${height}" width="100%" role="img" aria-label="Study activity over the last six months. Hover or tap a day for details.">${months}${labels}${cells}</svg>`;
};

const dayPanelHtml = (d, today) => {
    const head = `<div class="pg-day-date">${fmtDate(d.date)}${d.date === today ? ' <em>Today</em>' : ''}</div>`;
    if (!d.reviews) return `${head}<p class="pg-empty">No studying on this day.</p>`;
    const total = d.know + d.forgot + d.skip || 1;
    const seg = (n, cls, label) => (n ? `<span class="pg-seg ${cls}" style="width:${(n / total) * 100}%" title="${label}: ${n}"></span>` : '');
    return `${head}
        <div class="pg-day-big">${d.reviews}<span> card${d.reviews === 1 ? '' : 's'} answered</span></div>
        <div class="pg-mastery pg-mastery--thin">${seg(d.know, 'is-mastered', 'Knew it')}${seg(d.forgot, 'is-forgot', 'Forgot')}${seg(d.skip, 'is-new', 'Skipped')}</div>
        <div class="pg-legend"><span><i class="pg-dot is-mastered"></i>Knew <b>${d.know}</b></span><span><i class="pg-dot is-forgot"></i>Forgot <b>${d.forgot}</b></span>${d.skip ? `<span><i class="pg-dot is-new"></i>Skipped <b>${d.skip}</b></span>` : ''}</div>
        <div class="pg-day-facts">
            <div><b>${d.know + d.forgot ? d.accuracy + '%' : '–'}</b><span>accuracy</span></div>
            <div><b>${d.ms ? formatDuration(d.ms) : '–'}</b><span>study time</span></div>
            ${d.first ? `<div><b>${fmtTime(d.first)}</b><span>${d.last - d.first > 60000 ? `to ${fmtTime(d.last)}` : 'first answer'}</span></div>` : ''}
        </div>
        ${d.decks.length ? `<div class="pg-day-decks"><span class="pg-day-sub">Decks studied</span>${d.decks.slice(0, 4).map((k) => `<div><span>${escapeHtml(k.name)}</span><b>${k.count}</b></div>`).join('')}${d.decks.length > 4 ? `<div class="pg-day-more">+${d.decks.length - 4} more</div>` : ''}</div>` : ''}
        ${d.legacy ? '<p class="pg-day-note">Only daily totals exist for this day (detailed tracking started later).</p>' : ''}`;
};

const weekCell = (label, value, delta, unit = '%') => `<div class="pg-week-cell"><span>${label}</span><b>${value}</b>${delta == null ? '<em class="pg-delta">–</em>' : `<em class="pg-delta ${delta > 0 ? 'is-up' : delta < 0 ? 'is-down' : ''}">${signed(delta, unit)} vs last week</em>`}</div>`;
const weeklyHtml = (w) => `<div class="pg-week"><div class="pg-types-title">Last 7 days vs the 7 before</div><div class="pg-week-grid">
    ${weekCell('Answers', w.cur.reviews, w.reviewsDelta)}
    ${weekCell('Accuracy', w.cur.accuracy == null ? '–' : w.cur.accuracy + '%', w.accuracyDelta, ' pts')}
    ${weekCell('Study time', formatDuration(w.cur.ms), w.msDelta)}
    ${weekCell('Active days', `${w.cur.days} / 7`, w.cur.days - w.prev.days, '')}</div></div>`;

const trendSvg = (series, rolling) => {
    const w = 640, h = 200, padL = 30, padR = 30, padB = 22, padT = 10;
    const max = Math.max(5, ...series.map((d) => d.reviews));
    const plotW = w - padL - padR, plotH = h - padB - padT;
    const bw = plotW / series.length;
    const bars = series.map((d, i) => {
        const bh = (d.reviews / max) * plotH;
        return `<rect class="pg-bar" x="${(padL + i * bw + bw * 0.15).toFixed(1)}" y="${(h - padB - bh).toFixed(1)}" width="${(bw * 0.7).toFixed(1)}" height="${bh.toFixed(1)}" rx="2"><title>${d.date}: ${d.reviews} cards${d.accuracy == null ? '' : ` · ${d.accuracy}% correct`}</title></rect>`;
    }).join('');
    const pts = rolling.map((v, i) => (v == null ? null : [padL + i * bw + bw / 2, padT + (1 - v / 100) * plotH])).filter(Boolean);
    const line = pts.length > 1 ? `<polyline class="pg-line" points="${pts.map((p) => p.map((n) => n.toFixed(1)).join(',')).join(' ')}" fill="none"></polyline>` : '';
    const every = Math.max(1, Math.round(series.length / 6));
    const ticks = series.map((d, i) => (i % every === 0 ? `<text class="pg-axis" x="${(padL + i * bw + bw / 2).toFixed(1)}" y="${h - 6}" text-anchor="middle">${Number(d.date.slice(5, 7))}/${Number(d.date.slice(8))}</text>` : '')).join('');
    const grid = [0, 0.5, 1].map((f) => {
        const y = (h - padB - f * plotH).toFixed(1);
        return `<line class="pg-grid" x1="${padL}" x2="${w - padR}" y1="${y}" y2="${y}"></line><text class="pg-axis" x="${padL - 6}" y="${(Number(y) + 3).toFixed(1)}" text-anchor="end">${Math.round(max * f)}</text><text class="pg-axis pg-axis--acc" x="${w - padR + 6}" y="${(Number(y) + 3).toFixed(1)}">${Math.round(100 * f)}%</text>`;
    }).join('');
    return `<svg class="pg-trend" viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="Cards answered per day with 7-day accuracy">${grid}${bars}${line}${ticks}</svg>`;
};

const barRow = (labels, items, fmt) => {
    const max = Math.max(1, ...items.map((i) => i.count));
    return `<div class="pg-bars">${items.map((it, i) => `<div class="pg-bars-col" title="${labels[i]}: ${fmt(it)}">
        <div class="pg-bars-bar"><span style="height:${(it.count / max) * 100}%"></span></div><div class="pg-bars-label">${labels[i]}</div></div>`).join('')}</div>`;
};

// ─── Sections ────────────────────────────────────────────────────────
const section = (title, body, { sub = '', cls = '', actions = '', id = '' } = {}) =>
    `<section class="pg-card ${cls}"${id ? ` id="${id}"` : ''}><div class="pg-card-head"><div><h3 class="pg-h">${title}</h3>${sub ? `<p class="pg-sub">${sub}</p>` : ''}</div>${actions}</div>${body}</section>`;

const insightsHtml = (list) => (list.length ? `<section class="pg-board" aria-label="Insights"><h3 class="pg-board-title">Insights</h3><ul class="pg-board-list">${list.map((i, n) => `<li class="pg-board-item pg-board-item--${i.tone}"><span class="pg-insight-dot" aria-hidden="true"></span><span class="pg-board-text">${escapeHtml(i.text)}</span>${i.action ? `<button type="button" class="secondary pg-insight-btn" data-pg="insight" data-n="${n}">${escapeHtml(i.action.label)}</button>` : ''}</li>`).join('')}</ul></section>` : '');

const attemptsChart = (d) => {
    const cls = (p) => (p >= 80 ? 'is-ok' : p >= 50 ? 'is-mid' : 'is-low');
    const base = d.allAttempts - d.attempts.length;
    return `<div class="pg-attempts" role="img" aria-label="Score of each attempt, oldest to newest"><div class="pg-attempts-goal" title="80% goal"></div>${d.attempts.map((a, i) => {
        const when = a.at ? new Date(a.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
        return `<div class="pg-attempt" title="Attempt ${base + i + 1}${when ? ` · ${when}` : ''} · ${a.percent}%${a.total ? ` (${a.correct} of ${a.total})` : ''}${a.durationMs ? ` · ${formatDuration(a.durationMs)}` : ''}">
            <span class="pg-attempt-pct">${a.percent}%</span><div class="pg-attempt-bar"><i class="${cls(a.percent)}" style="height:${Math.max(4, a.percent)}%"></i></div><span class="pg-attempt-n">#${base + i + 1}</span></div>`;
    }).join('')}</div>`;
};

const quizSection = (q) => {
    if (!q.attempts) return '<p class="pg-empty">Take a practice quiz and your scores will show up here.</p>';
    const types = [['mcq', 'Multiple choice'], ['tf', 'True / false'], ['fitb', 'Fill in the blank']].filter(([k]) => q.byType[k].total)
        .map(([k, label]) => `<div class="pg-type"><span>${label}</span><div class="pg-meter"><span style="width:${q.byType[k].accuracy}%"></span></div><b>${q.byType[k].accuracy}%</b><em>${q.byType[k].right}/${q.byType[k].total}</em></div>`).join('');
    const decks = q.perDeck.map((d) => `<article class="pg-quiz">
        <div class="pg-quiz-head"><div><div class="pg-row-name">${escapeHtml(d.name || 'Quiz')}</div><div class="pg-row-sub">${d.allAttempts} attempt${d.allAttempts === 1 ? '' : 's'}${d.allAttempts > d.attempts.length ? ` · showing last ${d.attempts.length}` : ''}</div></div>
            <div class="pg-quiz-stats"><div><b>${d.latest}%</b><span>latest</span></div><div><b>${d.best}%</b><span>best</span></div><div><b>${d.average}%</b><span>average</span></div>
            ${d.allAttempts > 1 ? `<div><b class="${d.improved >= 0 ? 'is-up' : 'is-down'}">${signed(d.improved, ' pts')}</b><span>since attempt 1</span></div>` : ''}</div></div>
        ${attemptsChart(d)}<div class="pg-attempts-cap">Each bar is one attempt, oldest to newest. The dashed line marks 80%.</div></article>`).join('');
    return `<div class="pg-tiles pg-tiles--small">${tile('Attempts', q.attempts)}${tile('Average score', q.average + '%')}${tile('Best score', q.best + '%')}${tile('Time in quizzes', formatDuration(q.ms))}</div>
        ${types ? `<div class="pg-types-title">Accuracy by question type</div><div class="pg-types">${types}</div>` : ''}<div class="pg-quizzes">${decks}</div>`;
};

const hardestSection = (res, deckName) => {
    const { items, source, early } = res;
    if (!items.length) return '<p class="pg-empty">No missed cards yet. Cards you forget will show up here, with the decks they come from.</p>';
    const note = source === 'status' ? 'No answers logged yet, so these are cards currently marked <b>still learning</b>.' : early ? 'Early data: ranked by the cards you have missed so far. It sharpens as you keep studying.' : '';
    return `${note ? `<p class="pg-sub pg-sub--tight">${note}</p>` : ''}<ol class="pg-hard">${items.map((h) => `<li><div class="pg-hard-main"><div class="pg-hard-term">${escapeHtml(String(h.card.term).slice(0, 90))}</div><div class="pg-hard-deck">${escapeHtml(deckName(h.card.deckId))}</div></div>
        <div class="pg-hard-meta">${source === 'status' ? 'still learning' : `<b>${h.forgot}</b> missed of ${h.total}<br>${h.accuracy}% correct`}</div></li>`).join('')}</ol>
        <button type="button" class="primary pg-wide" data-pg="study-hardest">Study these ${items.length}</button>`;
};

const achievementsGrid = (unlocked) => `<div class="pg-achievements">${ACHIEVEMENTS.map((a) => {
    const when = unlocked[a.id];
    return `<div class="pg-ach${when ? ' is-unlocked' : ''}" title="${escapeHtml(a.desc)}"><div class="pg-ach-icon" aria-hidden="true">${when
        ? '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>'
        : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>'}</div>
        <div class="pg-ach-name">${escapeHtml(a.name)}</div><div class="pg-ach-desc">${when ? `Unlocked ${fmtUs(when)}` : escapeHtml(a.desc)}</div></div>`;
}).join('')}</div>`;

// ─── Deck mastery explorer (bottom of the page) ──────────────────────
const STATUS = {
    new: { label: 'Not started', cls: 'is-new' },
    progress: { label: 'In progress', cls: 'is-progress' },
    review: { label: 'Needs review', cls: 'is-review' },
    stale: { label: 'Stale', cls: 'is-stale' },
    mastered: { label: 'Mastered', cls: 'is-mastered' }
};
const deckStatus = (a, now) => {
    if (a.masteredPct >= 90) return 'mastered';
    if (a.lastStudied && (now - a.lastStudied) / 864e5 >= DECK_STALE_DAYS) return 'stale';
    if (!a.mastered && !a.learning) return 'new';
    if ((a.know + a.forgot >= 10 && a.accuracy < 60) || a.learning / a.total >= 0.4) return 'review';
    return 'progress';
};
const SORTS = {
    recent: ['Recently studied', (a, b) => (b.agg.lastStudied || 0) - (a.agg.lastStudied || 0) || b.agg.total - a.agg.total],
    lowest: ['Lowest mastery', (a, b) => a.agg.masteredPct - b.agg.masteredPct || b.agg.total - a.agg.total],
    highest: ['Highest mastery', (a, b) => b.agg.masteredPct - a.agg.masteredPct || b.agg.total - a.agg.total],
    size: ['Most cards', (a, b) => b.agg.total - a.agg.total],
    time: ['Most study time', (a, b) => b.agg.ms - a.agg.ms],
    name: ['Name (A–Z)', (a, b) => a.deck.name.localeCompare(b.deck.name, undefined, { numeric: true })]
};

const buildDeckExplorer = (ctx, deckAgg, now) => {
    const folderById = new Map((ctx.folders || []).map((f) => [f.id, f]));
    const folderPath = (id) => { const names = []; for (let f = folderById.get(id), n = 0; f && n < 8; f = folderById.get(f.parentId), n++) names.unshift(f.name); return names.join(' / '); };
    const descendants = (rootId) => { const ids = new Set([rootId]); let grew = true; while (grew) { grew = false; for (const f of ctx.folders || []) if (!ids.has(f.id) && ids.has(f.parentId)) { ids.add(f.id); grew = true; } } return ids; };
    const rows = ctx.decks.filter((d) => d.kind !== 'quiz').map((deck) => ({ deck, agg: deckAgg.get(deck.id) })).filter((r) => r.agg && r.agg.total > 0)
        .map((r) => ({ ...r, status: deckStatus(r.agg, now), path: folderPath(r.deck.folderId) }));
    return { rows, folderPath, descendants, folderOptions: (ctx.folders || []).filter((f) => rows.some((r) => descendants(f.id).has(r.deck.folderId))) };
};

const decksSection = (explorer, state) => {
    if (!explorer.rows.length) return section('Deck mastery', '<p class="pg-empty">No flashcard decks yet.</p>', { id: 'pg-decks' });
    const chips = ['all', 'new', 'progress', 'review', 'stale', 'mastered'].map((k) => `<button type="button" class="pg-chip" data-pg="dfilter" data-k="${k}" aria-pressed="false"><span>${k === 'all' ? 'All' : STATUS[k].label}</span> <b data-count="${k}">0</b></button>`).join('');
    const folderOpts = ['<option value="all">All folders</option>', ...explorer.folderOptions.map((f) => `<option value="${f.id}">${escapeHtml(explorer.folderPath(f.id) || f.name)}</option>`)].join('');
    const sortOpts = Object.entries(SORTS).map(([k, [label]]) => `<option value="${k}">${label}</option>`).join('');
    return section('Deck mastery', `
        <div class="pg-dk-controls">
            <input type="search" id="pg-dk-q" class="pg-dk-search" placeholder="Search decks…" aria-label="Search decks" autocomplete="off">
            <label class="pg-dk-select">Folder <select id="pg-dk-folder">${folderOpts}</select></label>
            <label class="pg-dk-select">Sort <select id="pg-dk-sort">${sortOpts}</select></label>
        </div>
        <div class="pg-chips pg-chips--wrap" id="pg-dk-chips">${chips}</div>
        <div class="pg-dk-summary" id="pg-dk-summary"></div>
        <div class="pg-dk-grid" id="pg-dk-grid"></div>
        <div class="pg-dk-more" id="pg-dk-more"></div>`, { sub: 'Find the decks that need attention. Filter by status, folder or name.', id: 'pg-decks' });
};

const wireDeckExplorer = (container, explorer, state, handlers, now) => {
    const root = container.querySelector('#pg-decks'); // recreated on every render, so listeners never pile up
    if (!root) return null;
    const $ = (sel) => root.querySelector(sel);
    const grid = $('#pg-dk-grid');
    const sync = () => { $('#pg-dk-q').value = state.q; $('#pg-dk-folder').value = state.folder; $('#pg-dk-sort').value = state.sort; };
    const render = () => {
        const q = state.q.trim().toLowerCase();
        const inFolder = state.folder === 'all' ? null : explorer.descendants(Number(state.folder));
        const base = explorer.rows.filter((r) => (!q || r.deck.name.toLowerCase().includes(q)) && (!inFolder || inFolder.has(r.deck.folderId)));
        const counts = { all: base.length, new: 0, progress: 0, review: 0, stale: 0, mastered: 0 };
        base.forEach((r) => { counts[r.status]++; });
        root.querySelectorAll('#pg-dk-chips .pg-chip').forEach((chip) => {
            const k = chip.dataset.k;
            chip.querySelector('b').textContent = counts[k];
            chip.classList.toggle('is-active', state.filter === k);
            chip.setAttribute('aria-pressed', String(state.filter === k));
        });
        const shown = base.filter((r) => state.filter === 'all' || r.status === state.filter).sort(SORTS[state.sort][1]);
        const agg = shown.reduce((o, r) => ({ total: o.total + r.agg.total, mastered: o.mastered + r.agg.mastered, learning: o.learning + r.agg.learning, notStudied: o.notStudied + r.agg.notStudied }), { total: 0, mastered: 0, learning: 0, notStudied: 0 });
        $('#pg-dk-summary').innerHTML = shown.length ? `<div class="pg-dk-sum-text"><b>${shown.length}</b> deck${shown.length === 1 ? '' : 's'} · <b>${agg.total.toLocaleString()}</b> cards · <b>${percent(agg.mastered, agg.total)}%</b> mastered</div>${masteryBarHtml(agg, { thin: true })}` : '';
        const visible = state.all ? shown : shown.slice(0, DECKS_PER_PAGE);
        grid.innerHTML = visible.length ? visible.map(({ deck, agg: a, status, path }) => `<article class="pg-dk ${STATUS[status].cls}">
            <div class="pg-dk-top"><div class="pg-dk-name" title="${escapeHtml(deck.name)}">${escapeHtml(deck.name)}</div><span class="pg-dk-badge ${STATUS[status].cls}">${STATUS[status].label}</span></div>
            <div class="pg-dk-path">${path ? escapeHtml(path) : 'No folder'}</div>
            ${masteryBarHtml(a, { thin: true })}
            <div class="pg-dk-pct"><b>${a.masteredPct}%</b> mastered <span>${a.mastered}/${a.total} cards</span></div>
            <div class="pg-dk-meta">${a.know + a.forgot ? `${a.accuracy}% accuracy · ` : ''}${a.ms ? `${formatDuration(a.ms)} · ` : ''}${formatAgo(a.lastStudied, now).replace('Studied ', '')}</div>
            <button type="button" class="secondary pg-dk-btn" data-pg="study-deck" data-id="${deck.id}">Study</button></article>`).join('')
            : '<p class="pg-empty">No decks match these filters.</p>';
        $('#pg-dk-more').innerHTML = shown.length > DECKS_PER_PAGE ? `<button type="button" class="secondary" data-pg="dall">${state.all ? 'Show fewer' : `Show all ${shown.length} decks`}</button>` : '';
    };
    root.addEventListener('input', (e) => { if (e.target.id === 'pg-dk-q') { state.q = e.target.value; state.all = false; render(); } });
    root.addEventListener('change', (e) => {
        if (e.target.id === 'pg-dk-folder') { state.folder = e.target.value; state.all = false; render(); }
        if (e.target.id === 'pg-dk-sort') { state.sort = e.target.value; render(); }
    });
    root.addEventListener('click', (e) => {
        const el = e.target.closest('[data-pg]');
        if (!el) return;
        if (el.dataset.pg === 'dfilter') { state.filter = el.dataset.k; state.all = false; render(); }
        else if (el.dataset.pg === 'dall') { state.all = !state.all; render(); }
    });
    sync();
    render();
    return { setFilter: (k) => { state.filter = k; state.all = false; render(); } };
};

// ─── Page ────────────────────────────────────────────────────────────
const state = { range: 30, pinnedDay: null, decks: { filter: 'all', sort: 'recent', folder: 'all', q: '', all: false } };

/**
 * Renders the whole Progress page.
 * ctx: { reviews, legacyStats, cards, decks, folders, quizResults, goal, achievements }
 * handlers: { onGoalChange(n), onStudyDeck(id), onStudyHardest(cards, title), onExport() }
 */
export const renderProgress = (container, ctx, handlers = {}) => {
    const today = dateString();
    const now = Date.now();
    const goal = ctx.goal || DEFAULT_DAILY_GOAL;
    const dayMap = buildDayMap(ctx.reviews, ctx.legacyStats);
    const summary = summarize(dayMap, ctx.cards, { goal, today });
    const weekly = weeklyComparison(dayMap, today);
    const mastery = masteryBreakdown(ctx.cards);
    const patterns = timePatterns(ctx.reviews);
    const hardest = hardestCards(ctx.reviews, ctx.cards, { limit: 5 });
    const quiz = quizStats(ctx.quizResults, ctx.decks, ctx.cards);
    const deckAgg = deckAggregates(ctx.cards, ctx.reviews);
    const byDate = groupByDate(ctx.reviews);
    const unlocked = ctx.achievements || {};
    const deckNameOf = new Map(ctx.decks.map((d) => [d.id, d.name]));
    const deckName = (id) => deckNameOf.get(id) || 'Deleted deck';
    const insights = buildInsights({ summary, weekly, patterns, deckAgg, decks: ctx.decks, quiz, today, now });
    const hasData = summary.reviews > 0 || quiz.attempts > 0;
    const explorer = buildDeckExplorer(ctx, deckAgg, now);

    const lastActive = [...dayMap.keys()].filter((d) => d <= today).sort().pop() || today;
    const selected = state.pinnedDay && state.pinnedDay <= today ? state.pinnedDay : null;
    const hourLabel = (i) => `${i % 12 || 12}${i < 12 ? 'a' : 'p'}`;
    const busiest = patterns.weekdays.map((w, i) => ({ ...w, name: ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'][i] })).sort((a, b) => b.count - a.count)[0];
    const bestHour = patterns.hours.map((h, i) => ({ ...h, i })).filter((h) => h.know + h.forgot >= 5).sort((a, b) => b.accuracy - a.accuracy || b.count - a.count)[0];

    const todayTile = `<div class="pg-tile pg-tile--ring"><div class="pg-tile-ring">${ringHtml(Math.min(summary.today, 9999), goal, 92)}</div><div class="pg-tile-label">Today</div><div class="pg-tile-sub">${summary.goalMet ? 'Daily goal reached' : `${Math.max(0, goal - summary.today)} to reach your goal`}</div></div>`;
    const tiles = `<div class="pg-tiles">
        ${todayTile}
        ${tile('Day streak', summary.streak, [`Longest: ${summary.longestStreak} days`, `Goal streak: ${summary.goalStreak}`])}
        ${tile('Study time this week', formatDuration(summary.ms7), [`Today: ${formatDuration(summary.msToday)}`, `All time: ${formatDuration(summary.msAll)}`])}
        ${tile('Accuracy', summary.know + summary.forgot ? summary.accuracy + '%' : '–', [`${summary.know.toLocaleString()} known · ${summary.forgot.toLocaleString()} forgotten`, weekly.accuracyDelta != null ? `This week: ${weekly.cur.accuracy}%${weekly.accuracyDelta ? ` (${signed(weekly.accuracyDelta)})` : ''}` : ''])}
        ${tile('Cards mastered', summary.mastered.toLocaleString(), [`${mastery.masteredPct}% of ${mastery.total.toLocaleString()} cards`])}
        ${tile('Total answers', summary.reviews.toLocaleString(), [`This week: ${weekly.cur.reviews}${weekly.reviewsDelta != null ? ` (${signed(weekly.reviewsDelta, '%')})` : ''}`, `${summary.activeDays} active days · ${summary.avgPerActiveDay}/day`])}
    </div>`;

    const rangeBtns = [7, 30, 90].map((n) => `<button type="button" class="pg-chip${state.range === n ? ' is-active' : ''}" data-pg="range" data-n="${n}" aria-pressed="${state.range === n}">${n}D</button>`).join('');
    const series = dailySeries(dayMap, state.range, today);

    // "Focus next": decks with the most still-learning cards
    const focus = [...deckAgg.values()].filter((a) => a.learning > 0 && deckNameOf.has(a.deckId)).sort((a, b) => b.learning - a.learning).slice(0, 3);
    const masteryBody = masteryBarHtml(mastery, { legend: true })
        + (focus.length ? `<div class="pg-focus"><div class="pg-types-title">Focus next</div>${focus.map((a) => `<div class="pg-focus-row"><div class="pg-focus-main"><div class="pg-row-name">${escapeHtml(deckName(a.deckId))}</div><div class="pg-row-sub">${a.learning} still learning · ${a.masteredPct}% mastered</div></div><button type="button" class="secondary pg-row-btn" data-pg="study-deck" data-id="${a.deckId}">Study</button></div>`).join('')}</div>` : '')
        + (mastery.learning ? `<button type="button" class="secondary pg-wide" data-pg="study-learning">Review all ${mastery.learning} still-learning cards</button>` : '');

    container.innerHTML = `<div class="pg">
        <div class="pg-top">
            <div><h2 class="pg-title">Your progress</h2><p class="pg-sub">${hasData ? 'Calculated from your own studying; it stays on your devices and in your Drive backup.' : 'Study a few cards and this page fills up with your streaks, accuracy, time and hardest cards.'}</p></div>
            <div class="pg-controls">
                <label class="pg-goal">Daily goal <input type="number" id="pg-goal" min="1" max="500" value="${goal}" aria-label="Daily goal in cards"> cards</label>
                <button type="button" class="secondary" data-pg="export">Download my stats (CSV)</button>
            </div>
        </div>
        ${insightsHtml(insights)}
        ${tiles}
        ${section('Activity', `<div class="pg-activity"><div class="pg-heat-wrap" id="pg-heat">${heatmapSvg(heatmap(dayMap, today), selected)}<div class="pg-hm-legend"><span>Less</span>${[0, 1, 2, 3, 4].map((l) => `<i class="pg-hm l${l}"></i>`).join('')}<span>More</span></div></div><aside class="pg-daypanel" id="pg-daypanel" aria-live="polite"></aside></div>`, { sub: 'Cards answered per day, last 6 months. Hover a day for details, click to pin it.' })}
        <div class="pg-cols">
            ${section('Cards per day', `<div class="pg-legend pg-legend--top"><span><i class="pg-dot is-bar"></i>Cards answered</span><span><i class="pg-dot is-line"></i>7-day accuracy</span></div>${trendSvg(series, rollingAccuracy(dailySeries(dayMap, state.range + 6, today), 7).slice(6))}${weeklyHtml(weekly)}`, { actions: `<div class="pg-chips">${rangeBtns}</div>` })}
            ${section('Mastery', masteryBody, { sub: `${mastery.masteredPct}% of ${mastery.total.toLocaleString()} cards mastered` })}
        </div>
        <div class="pg-cols">
            ${section('Hardest cards', hardestSection(hardest, deckName))}
            ${section('When you study best', (patterns.hours.some((h) => h.count) ? barRow(Array.from({ length: 24 }, (_, i) => (i % 3 === 0 ? hourLabel(i) : '')), patterns.hours, (h) => `${h.count} cards${h.accuracy == null ? '' : ` · ${h.accuracy}%`}`) + barRow(WEEKDAYS, patterns.weekdays, (h) => `${h.count} cards${h.accuracy == null ? '' : ` · ${h.accuracy}%`}`) + (bestHour ? `<p class="pg-note">You are most accurate around <b>${hourLabel(bestHour.i)}</b> (${bestHour.accuracy}%).</p>` : '') + (busiest && busiest.count ? `<p class="pg-note">Your busiest day is <b>${busiest.name}</b> (${busiest.count.toLocaleString()} answers).</p>` : '') : '<p class="pg-empty">Patterns appear after you have studied a bit.</p>'), { sub: 'By hour of day and day of week' })}
        </div>
        ${section('Practice quizzes', quizSection(quiz))}
        ${section('Milestones', achievementsGrid(unlocked) + `<div class="pg-records"><span>Best day <b>${summary.bestDay ? `${summary.bestDay.reviews} cards` : '–'}</b></span><span>Longest streak <b>${summary.longestStreak} days</b></span><span>Best quiz <b>${quiz.attempts ? quiz.best + '%' : '–'}</b></span></div>`, { sub: `${Object.keys(unlocked).length} of ${ACHIEVEMENTS.length} unlocked` })}
        ${decksSection(explorer, state.decks)}
    </div>`;

    // Heatmap: hover previews a day in the side panel, click pins it
    const panel = container.querySelector('#pg-daypanel');
    const heat = container.querySelector('#pg-heat');
    const legacyOf = (date) => { const d = dayMap.get(date); return d && d.legacy ? d : null; };
    const showDay = (date) => { panel.innerHTML = dayPanelHtml(dayDetails(date, byDate, deckName, legacyOf(date)), today); };
    const restingDay = () => state.pinnedDay || lastActive;
    showDay(restingDay());
    heat.addEventListener('mouseover', (e) => { const r = e.target.closest('[data-date]'); if (r) showDay(r.dataset.date); });
    heat.addEventListener('mouseleave', () => showDay(restingDay()));
    heat.addEventListener('click', (e) => {
        const r = e.target.closest('[data-date]');
        if (!r) return;
        state.pinnedDay = state.pinnedDay === r.dataset.date ? null : r.dataset.date;
        heat.querySelectorAll('.pg-hm.is-selected').forEach((n) => n.classList.remove('is-selected'));
        if (state.pinnedDay) r.classList.add('is-selected');
        showDay(restingDay());
    });

    const explorerApi = wireDeckExplorer(container, explorer, state.decks, handlers, now);

    container.onclick = (e) => {
        const el = e.target.closest('[data-pg]');
        if (!el) return;
        const action = el.dataset.pg;
        if (action === 'range') { state.range = Number(el.dataset.n); renderProgress(container, ctx, handlers); }
        else if (action === 'study-deck') handlers.onStudyDeck?.(Number(el.dataset.id));
        else if (action === 'study-hardest') handlers.onStudyHardest?.(hardest.items.map((h) => h.card));
        else if (action === 'study-learning') handlers.onStudyHardest?.(ctx.cards.filter((c) => c.status === 'learning'), 'Still learning');
        else if (action === 'export') handlers.onExport?.();
        else if (action === 'insight') {
            const act = insights[Number(el.dataset.n)]?.action;
            if (act?.type === 'study-deck') handlers.onStudyDeck?.(act.value);
            else if (act?.type === 'filter') { explorerApi?.setFilter(act.value); container.querySelector('#pg-decks')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
        }
    };
    const goalInput = container.querySelector('#pg-goal');
    goalInput.onchange = () => {
        const n = Math.max(1, Math.min(500, Math.round(Number(goalInput.value) || DEFAULT_DAILY_GOAL)));
        goalInput.value = n;
        handlers.onGoalChange?.(n);
    };
};

// ─── Deck panel (deck editor header) ─────────────────────────────────
export const deckPanelHtml = (deckId, ctx) => {
    const s = deckStats(deckId, ctx.reviews, ctx.cards);
    if (!s.total) return '';
    const hard = hardestCards(ctx.reviews.filter((r) => r.deckId === deckId), ctx.cards.filter((c) => c.deckId === deckId), { limit: 3 });
    return `<div class="pg-deckpanel">
        <div class="pg-deckpanel-tiles">
            <div><b>${s.masteredPct}%</b><span>mastered</span></div>
            <div><b>${s.reviews ? s.accuracy + '%' : '–'}</b><span>accuracy</span></div>
            <div><b>${s.reviews}</b><span>answers</span></div>
            <div><b>${formatDuration(s.ms)}</b><span>time</span></div>
            <div><b>${s.lastStudied ? formatAgo(s.lastStudied).replace('Studied ', '') : 'Never'}</b><span>last studied</span></div>
        </div>
        ${masteryBarHtml(s, { legend: true })}
        ${hard.items.length && hard.source === 'reviews' ? `<div class="pg-deckpanel-hard"><span>Trouble cards:</span> ${hard.items.map((h) => `<em>${escapeHtml(String(h.card.term).slice(0, 36))}</em>`).join(' ')}</div>` : ''}
    </div>`;
};

// ─── Home stat bar pieces ────────────────────────────────────────────
export const todayCardHtml = (summary) => `<div class="pg-home-ring">${ringHtml(Math.min(summary.today, 9999), summary.goal, 64)}</div>`;

export { buildDayMap, summarize, masteryBreakdown, achievementContext, dateString, addDays, percent };
