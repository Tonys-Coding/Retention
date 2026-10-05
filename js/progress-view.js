/**
 * progress-view.js — The Progress page (dashboard) and the small stat widgets
 * reused by the home bar, deck panels and grid cards. Charts are inline SVG and
 * CSS (no libraries) and only use the theme's CSS variables, so every theme
 * works. All numbers come from stats.js.
 */

import { escapeHtml } from './utils.js';
import {
    DEFAULT_DAILY_GOAL, ACHIEVEMENTS, buildDayMap, summarize, masteryBreakdown, heatmap, dailySeries,
    timePatterns, hardestCards, deckStats, quizStats, achievementContext, formatDuration, formatAgo, percent, addDays, dateString
} from './stats.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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

const sparkline = (values, w = 90, h = 26) => {
    if (values.length < 2) return '';
    const step = w / (values.length - 1);
    const pts = values.map((v, i) => `${(i * step).toFixed(1)},${(h - 2 - (v / 100) * (h - 4)).toFixed(1)}`).join(' ');
    return `<svg class="pg-spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"></polyline></svg>`;
};

const tile = (label, value, sub = '', extra = '') => `<div class="pg-tile">${extra}<div class="pg-tile-value">${value}</div><div class="pg-tile-label">${label}</div>${sub ? `<div class="pg-tile-sub">${sub}</div>` : ''}</div>`;

// ─── Charts ──────────────────────────────────────────────────────────
const heatmapSvg = (cols) => {
    const cell = 13, gap = 3, left = 28, top = 18;
    const width = left + cols.length * (cell + gap), height = top + 7 * (cell + gap);
    let months = '', lastMonth = -1;
    const cells = cols.map((col, x) => {
        const m = Number(col[0].date.slice(5, 7)) - 1;
        if (m !== lastMonth && Number(col[0].date.slice(8)) <= 7) { months += `<text x="${left + x * (cell + gap)}" y="11" class="pg-axis">${MONTHS[m]}</text>`; lastMonth = m; }
        return col.map((d, y) => (d.level < 0 ? '' :
            `<rect class="pg-hm l${d.level}" x="${left + x * (cell + gap)}" y="${top + y * (cell + gap)}" width="${cell}" height="${cell}" rx="2"><title>${d.date}: ${d.reviews} card${d.reviews === 1 ? '' : 's'}${d.ms ? ` · ${formatDuration(d.ms)}` : ''}</title></rect>`)).join('');
    }).join('');
    const labels = [1, 3, 5].map((i) => `<text x="0" y="${top + i * (cell + gap) + 10}" class="pg-axis">${WEEKDAYS[i]}</text>`).join('');
    return `<svg class="pg-heatmap" viewBox="0 0 ${width} ${height}" width="${Math.round(width * 1.65)}" role="img" aria-label="Study activity over the last six months">${months}${labels}${cells}</svg>`;
};

const trendSvg = (series) => {
    const w = 640, h = 190, padL = 30, padB = 22, padT = 10;
    const max = Math.max(5, ...series.map((d) => d.reviews));
    const bw = (w - padL) / series.length;
    const bars = series.map((d, i) => {
        const bh = (d.reviews / max) * (h - padB - padT);
        return `<rect class="pg-bar" x="${(padL + i * bw + bw * 0.15).toFixed(1)}" y="${(h - padB - bh).toFixed(1)}" width="${(bw * 0.7).toFixed(1)}" height="${bh.toFixed(1)}" rx="2"><title>${d.date}: ${d.reviews} cards${d.accuracy == null ? '' : ` · ${d.accuracy}% correct`}</title></rect>`;
    }).join('');
    const pts = series.map((d, i) => (d.accuracy == null ? null : [padL + i * bw + bw / 2, padT + (1 - d.accuracy / 100) * (h - padB - padT)])).filter(Boolean);
    const line = pts.length > 1 ? `<polyline class="pg-line" points="${pts.map((p) => p.map((n) => n.toFixed(1)).join(',')).join(' ')}" fill="none"></polyline>` : '';
    const every = Math.max(1, Math.round(series.length / 6));
    const ticks = series.map((d, i) => (i % every === 0 ? `<text class="pg-axis" x="${(padL + i * bw + bw / 2).toFixed(1)}" y="${h - 6}" text-anchor="middle">${Number(d.date.slice(5, 7))}/${Number(d.date.slice(8))}</text>` : '')).join('');
    const grid = [0, 0.5, 1].map((f) => `<line class="pg-grid" x1="${padL}" x2="${w}" y1="${(h - padB - f * (h - padB - padT)).toFixed(1)}" y2="${(h - padB - f * (h - padB - padT)).toFixed(1)}"></line><text class="pg-axis" x="0" y="${(h - padB - f * (h - padB - padT) + 3).toFixed(1)}">${Math.round(max * f)}</text>`).join('');
    return `<svg class="pg-trend" viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="Cards answered per day">${grid}${bars}${line}${ticks}</svg>`;
};

const barRow = (labels, items, fmt) => {
    const max = Math.max(1, ...items.map((i) => i.count));
    return `<div class="pg-bars">${items.map((it, i) => `<div class="pg-bars-col" title="${labels[i]}: ${fmt(it)}">
        <div class="pg-bars-bar"><span style="height:${(it.count / max) * 100}%"></span></div><div class="pg-bars-label">${labels[i]}</div></div>`).join('')}</div>`;
};

// ─── Page ────────────────────────────────────────────────────────────
const state = { range: 30 };

const buildModel = (ctx) => {
    const goal = ctx.goal || DEFAULT_DAILY_GOAL;
    const dayMap = buildDayMap(ctx.reviews, ctx.legacyStats);
    const summary = summarize(dayMap, ctx.cards, { goal });
    return { goal, dayMap, summary };
};

const section = (title, body, { sub = '', cls = '', actions = '' } = {}) =>
    `<section class="pg-card ${cls}"><div class="pg-card-head"><div><h3 class="pg-h">${title}</h3>${sub ? `<p class="pg-sub">${sub}</p>` : ''}</div>${actions}</div>${body}</section>`;

const decksTable = (ctx) => {
    const quizIds = new Set(ctx.decks.filter((d) => d.kind === 'quiz').map((d) => d.id));
    const rows = ctx.decks.filter((d) => !quizIds.has(d.id)).map((d) => ({ d, s: deckStats(d.id, ctx.reviews, ctx.cards) }))
        .filter((r) => r.s.total > 0)
        .sort((a, b) => (b.s.lastStudied || 0) - (a.s.lastStudied || 0) || b.s.total - a.s.total);
    if (!rows.length) return '<p class="pg-empty">No flashcard decks yet.</p>';
    return `<div class="pg-table" role="table">${rows.map(({ d, s }) => `<div class="pg-row" role="row">
        <div class="pg-row-main"><div class="pg-row-name">${escapeHtml(d.name)}</div><div class="pg-row-sub">${s.total} cards · ${formatAgo(s.lastStudied)}</div></div>
        <div class="pg-row-bar">${masteryBarHtml(s, { thin: true })}</div>
        <div class="pg-row-num"><b>${s.masteredPct}%</b><span>mastered</span></div>
        <div class="pg-row-num"><b>${s.reviews ? s.accuracy + '%' : '–'}</b><span>accuracy</span></div>
        <div class="pg-row-num"><b>${formatDuration(s.ms)}</b><span>time</span></div>
        <button type="button" class="secondary pg-row-btn" data-pg="study-deck" data-id="${d.id}">Study</button></div>`).join('')}</div>`;
};

const quizSection = (q) => {
    if (!q.attempts) return '<p class="pg-empty">Take a practice quiz and your scores will show up here.</p>';
    const types = [['mcq', 'Multiple choice'], ['tf', 'True / false'], ['fitb', 'Fill in the blank']].filter(([k]) => q.byType[k].total)
        .map(([k, label]) => `<div class="pg-type"><span>${label}</span><div class="pg-meter"><span style="width:${q.byType[k].accuracy}%"></span></div><b>${q.byType[k].accuracy}%</b></div>`).join('');
    const decks = q.perDeck.map((d) => `<div class="pg-row pg-row--quiz"><div class="pg-row-main"><div class="pg-row-name">${escapeHtml(d.name || 'Quiz')}</div><div class="pg-row-sub">${d.attempts} attempt${d.attempts === 1 ? '' : 's'}</div></div>
        <div class="pg-row-bar">${sparkline(d.history)}</div>
        <div class="pg-row-num"><b>${d.latest}%</b><span>latest</span></div><div class="pg-row-num"><b>${d.best}%</b><span>best</span></div><div class="pg-row-num"><b>${d.average}%</b><span>average</span></div>
        <div class="pg-row-num"><b class="${d.improved >= 0 ? 'is-up' : 'is-down'}">${d.improved >= 0 ? '+' : ''}${d.improved}</b><span>since first</span></div></div>`).join('');
    return `<div class="pg-tiles pg-tiles--small">${tile('Attempts', q.attempts)}${tile('Average score', q.average + '%')}${tile('Best score', q.best + '%')}${tile('Time in quizzes', formatDuration(q.ms))}</div>
        ${types ? `<div class="pg-types">${types}</div>` : ''}<div class="pg-table">${decks}</div>`;
};

const achievementsGrid = (ctx, unlocked) => `<div class="pg-achievements">${ACHIEVEMENTS.map((a) => {
    const when = unlocked[a.id];
    return `<div class="pg-ach${when ? ' is-unlocked' : ''}" title="${escapeHtml(a.desc)}"><div class="pg-ach-icon" aria-hidden="true">${when
        ? '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>'
        : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>'}</div>
        <div class="pg-ach-name">${escapeHtml(a.name)}</div><div class="pg-ach-desc">${when ? `Unlocked ${when}` : escapeHtml(a.desc)}</div></div>`;
}).join('')}</div>`;

/**
 * Renders the whole Progress page.
 * ctx: { reviews, legacyStats, cards, decks, quizResults, goal, achievements }
 * handlers: { onGoalChange(n), onStudyDeck(id), onStudyHardest(cards), onExport() }
 */
export const renderProgress = (container, ctx, handlers = {}) => {
    const { goal, dayMap, summary } = buildModel(ctx);
    const mastery = masteryBreakdown(ctx.cards);
    const patterns = timePatterns(ctx.reviews);
    const hardest = hardestCards(ctx.reviews, ctx.cards, { limit: 10 });
    const quiz = quizStats(ctx.quizResults, ctx.decks, ctx.cards);
    const unlocked = ctx.achievements || {};
    const hasData = summary.reviews > 0 || quiz.attempts > 0;
    const bestHour = patterns.hours.map((h, i) => ({ ...h, i })).filter((h) => h.know + h.forgot >= 5).sort((a, b) => b.accuracy - a.accuracy || b.count - a.count)[0];
    const hourLabel = (i) => `${i % 12 || 12}${i < 12 ? 'a' : 'p'}`;

    const todayTile = `<div class="pg-tile pg-tile--ring"><div class="pg-tile-ring">${ringHtml(Math.min(summary.today, 9999), goal, 92)}</div><div class="pg-tile-label">Today</div><div class="pg-tile-sub">${summary.goalMet ? 'Daily goal reached' : `${Math.max(0, goal - summary.today)} to reach your goal`}</div></div>`;
    const tiles = `<div class="pg-tiles">
        ${todayTile}
        ${tile('Day streak', summary.streak, `Longest ${summary.longestStreak} · Goal streak ${summary.goalStreak}`)}
        ${tile('Study time', formatDuration(summary.msToday), `This week ${formatDuration(summary.ms7)} · All time ${formatDuration(summary.msAll)}`)}
        ${tile('Accuracy', summary.know + summary.forgot ? summary.accuracy + '%' : '–', `${summary.know} known · ${summary.forgot} forgotten`)}
        ${tile('Cards mastered', summary.mastered, `${mastery.masteredPct}% of ${mastery.total} cards`)}
        ${tile('Total answers', summary.reviews.toLocaleString(), `${summary.activeDays} active day${summary.activeDays === 1 ? '' : 's'} · ${summary.avgPerActiveDay} per day`)}
    </div>`;

    const rangeBtns = [7, 30, 90].map((n) => `<button type="button" class="pg-chip${state.range === n ? ' is-active' : ''}" data-pg="range" data-n="${n}" aria-pressed="${state.range === n}">${n}D</button>`).join('');
    const series = dailySeries(dayMap, state.range);

    container.innerHTML = `<div class="pg">
        <div class="pg-top">
            <div><h2 class="pg-title">Your progress</h2><p class="pg-sub">${hasData ? 'Everything here is calculated from your own studying and stays on your devices (and your Drive backup).' : 'Study a few cards and this page fills up with your streaks, accuracy, time and hardest cards.'}</p></div>
            <div class="pg-controls">
                <label class="pg-goal">Daily goal <input type="number" id="pg-goal" min="1" max="500" value="${goal}" aria-label="Daily goal in cards"> cards</label>
                <button type="button" class="secondary" data-pg="export">Download my stats (CSV)</button>
            </div>
        </div>
        ${tiles}
        ${section('Activity', heatmapSvg(heatmap(dayMap)) + `<div class="pg-hm-legend"><span>Less</span>${[0, 1, 2, 3, 4].map((l) => `<i class="pg-hm l${l}"></i>`).join('')}<span>More</span></div>`, { sub: 'Cards answered per day, last 6 months' })}
        <div class="pg-cols">
            ${section('Cards per day', `<div class="pg-legend pg-legend--top"><span><i class="pg-dot is-bar"></i>Cards answered</span><span><i class="pg-dot is-line"></i>Accuracy</span></div>${trendSvg(series)}`, { actions: `<div class="pg-chips">${rangeBtns}</div>` })}
            ${section('Mastery', masteryBarHtml(mastery, { legend: true }) + (mastery.learning ? `<button type="button" class="secondary pg-wide" data-pg="study-learning">Review ${mastery.learning} still-learning card${mastery.learning === 1 ? '' : 's'}</button>` : ''), { sub: `${mastery.masteredPct}% of ${mastery.total} cards mastered` })}
        </div>
        ${section('Decks', decksTable(ctx), { sub: 'Mastery, accuracy and time per flashcard deck' })}
        <div class="pg-cols">
            ${section('Hardest cards', hardest.length ? `<ol class="pg-hard">${hardest.map((h) => `<li><div class="pg-hard-term">${escapeHtml(String(h.card.term).slice(0, 90))}</div><div class="pg-hard-meta">${h.accuracy}% · ${h.forgot} miss${h.forgot === 1 ? '' : 'es'} in ${h.total}</div></li>`).join('')}</ol><button type="button" class="primary pg-wide" data-pg="study-hardest">Study these ${hardest.length}</button>` : '<p class="pg-empty">Cards you often forget will appear here after a few reviews.</p>')}
            ${section('When you study best', (patterns.hours.some((h) => h.count) ? barRow(Array.from({ length: 24 }, (_, i) => (i % 3 === 0 ? hourLabel(i) : '')), patterns.hours, (h) => `${h.count} cards${h.accuracy == null ? '' : ` · ${h.accuracy}%`}`) + barRow(WEEKDAYS, patterns.weekdays, (h) => `${h.count} cards${h.accuracy == null ? '' : ` · ${h.accuracy}%`}`) + (bestHour ? `<p class="pg-insight">You are most accurate around <b>${hourLabel(bestHour.i)}</b> (${bestHour.accuracy}%).</p>` : '') : '<p class="pg-empty">Patterns appear after you have studied a bit.</p>'), { sub: 'By hour of day and day of week' })}
        </div>
        ${section('Practice quizzes', quizSection(quiz))}
        ${section('Milestones', achievementsGrid(ctx, unlocked) + `<div class="pg-records"><span>Best day <b>${summary.bestDay ? `${summary.bestDay.reviews} cards` : '–'}</b></span><span>Longest streak <b>${summary.longestStreak} days</b></span><span>Best quiz <b>${quiz.attempts ? quiz.best + '%' : '–'}</b></span></div>`, { sub: `${Object.keys(unlocked).length} of ${ACHIEVEMENTS.length} unlocked` })}
    </div>`;

    container.onclick = (e) => {
        const el = e.target.closest('[data-pg]');
        if (!el) return;
        const action = el.dataset.pg;
        if (action === 'range') { state.range = Number(el.dataset.n); renderProgress(container, ctx, handlers); }
        else if (action === 'study-deck') handlers.onStudyDeck?.(Number(el.dataset.id));
        else if (action === 'study-hardest') handlers.onStudyHardest?.(hardest.map((h) => h.card));
        else if (action === 'study-learning') handlers.onStudyHardest?.(ctx.cards.filter((c) => c.status === 'learning'), 'Still learning');
        else if (action === 'export') handlers.onExport?.();
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
    const hard = hardestCards(ctx.reviews.filter((r) => r.deckId === deckId), ctx.cards, { limit: 3 });
    return `<div class="pg-deckpanel">
        <div class="pg-deckpanel-tiles">
            <div><b>${s.masteredPct}%</b><span>mastered</span></div>
            <div><b>${s.reviews ? s.accuracy + '%' : '–'}</b><span>accuracy</span></div>
            <div><b>${s.reviews}</b><span>answers</span></div>
            <div><b>${formatDuration(s.ms)}</b><span>time</span></div>
            <div><b>${s.lastStudied ? formatAgo(s.lastStudied).replace('Studied ', '') : 'Never'}</b><span>last studied</span></div>
        </div>
        ${masteryBarHtml(s, { legend: true })}
        ${hard.length ? `<div class="pg-deckpanel-hard"><span>Trouble cards:</span> ${hard.map((h) => `<em>${escapeHtml(String(h.card.term).slice(0, 36))}</em>`).join(' ')}</div>` : ''}
    </div>`;
};

// ─── Home stat bar pieces ────────────────────────────────────────────
export const todayCardHtml = (summary) => `<div class="pg-home-ring">${ringHtml(Math.min(summary.today, 9999), summary.goal, 64)}</div>`;

export { buildDayMap, summarize, masteryBreakdown, achievementContext, dateString, addDays, percent };
