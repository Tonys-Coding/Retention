/**
 * stats.js — Pure functions that turn the review log, daily totals, cards and
 * quiz attempts into the numbers shown on the Progress page, the home stats
 * bar, deck panels and the popup summary. No DOM and no database access, so it
 * is easy to test with plain arrays.
 *
 * Dates are local calendar days as "YYYY-MM-DD" strings.
 */

export const DEFAULT_DAILY_GOAL = 20;

// ─── Dates ───────────────────────────────────────────────────────────
export const dateString = (ts = Date.now()) => {
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Shifts a "YYYY-MM-DD" string by whole days (noon avoids DST edge cases). */
export const addDays = (date, n) => {
    const [y, m, d] = date.split('-').map(Number);
    return dateString(new Date(y, m - 1, d + n, 12).getTime());
};

const weekdayOf = (date) => {
    const [y, m, d] = date.split('-').map(Number);
    return new Date(y, m - 1, d, 12).getDay();
};

export const formatDuration = (ms) => {
    const totalMin = Math.round((ms || 0) / 60000);
    if (totalMin < 1) return ms >= 10000 ? `${Math.round(ms / 1000)}s` : '0m';
    if (totalMin < 60) return `${totalMin}m`;
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
};

export const percent = (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

// ─── Per-day activity ────────────────────────────────────────────────
/**
 * One entry per active day: { date, reviews, know, forgot, skip, ms }.
 * Reviews are the source of truth. Daily totals from before the review log
 * existed (`legacyStats`, UTC dates) fill in only the days before the first
 * review, so the streak and heatmap keep their history.
 */
export const buildDayMap = (reviews = [], legacyStats = []) => {
    const days = new Map();
    const blank = (date) => ({ date, reviews: 0, know: 0, forgot: 0, skip: 0, ms: 0 });
    let firstReview = null;
    for (const r of reviews) {
        if (!firstReview || r.date < firstReview) firstReview = r.date;
        const day = days.get(r.date) || blank(r.date);
        day.reviews++;
        day.ms += r.ms || 0;
        if (r.result === 'know') day.know++;
        else if (r.result === 'forgot') day.forgot++;
        else day.skip++;
        days.set(r.date, day);
    }
    for (const s of legacyStats) {
        if (firstReview && s.date >= firstReview) continue;
        const total = (s.know || 0) + (s.forgot || 0);
        if (!total) continue;
        days.set(s.date, { ...blank(s.date), reviews: total, know: s.know || 0, forgot: s.forgot || 0, legacy: true });
    }
    return days;
};

/** Current and longest streak of consecutive active days (today may still be empty). */
export const streaks = (dayMap, today = dateString()) => {
    let current = 0;
    let cursor = dayMap.has(today) ? today : addDays(today, -1);
    while (dayMap.has(cursor)) { current++; cursor = addDays(cursor, -1); }

    const dates = [...dayMap.keys()].sort();
    let longest = 0, run = 0, prev = null;
    for (const date of dates) {
        run = prev && addDays(prev, 1) === date ? run + 1 : 1;
        if (run > longest) longest = run;
        prev = date;
    }
    return { current, longest };
};

/** Consecutive days (ending today/yesterday) on which the daily goal was met. */
export const goalStreak = (dayMap, goal, today = dateString()) => {
    const met = (date) => (dayMap.get(date)?.reviews || 0) >= goal;
    let cursor = met(today) ? today : addDays(today, -1);
    let n = 0;
    while (met(cursor)) { n++; cursor = addDays(cursor, -1); }
    return n;
};

// ─── Summary tiles ───────────────────────────────────────────────────
export const summarize = (dayMap, cards = [], { goal = DEFAULT_DAILY_GOAL, today = dateString() } = {}) => {
    let reviews = 0, know = 0, forgot = 0, ms = 0, ms7 = 0, ms30 = 0, best = null;
    const from7 = addDays(today, -6), from30 = addDays(today, -29);
    for (const day of dayMap.values()) {
        reviews += day.reviews; know += day.know; forgot += day.forgot; ms += day.ms;
        if (day.date >= from7) ms7 += day.ms;
        if (day.date >= from30) ms30 += day.ms;
        if (!best || day.reviews > best.reviews) best = day;
    }
    const todayDay = dayMap.get(today) || { reviews: 0, know: 0, forgot: 0, ms: 0 };
    const { current, longest } = streaks(dayMap, today);
    return {
        reviews, know, forgot, accuracy: percent(know, know + forgot),
        activeDays: dayMap.size, avgPerActiveDay: dayMap.size ? Math.round(reviews / dayMap.size) : 0,
        msToday: todayDay.ms, ms7, ms30, msAll: ms,
        today: todayDay.reviews, goal, goalMet: todayDay.reviews >= goal,
        streak: current, longestStreak: longest, goalStreak: goalStreak(dayMap, goal, today),
        bestDay: best ? { date: best.date, reviews: best.reviews } : null,
        mastered: cards.filter((c) => c.status === 'mastered').length
    };
};

// ─── Mastery (Quizlet-style buckets) ─────────────────────────────────
export const masteryBreakdown = (cards = []) => {
    let mastered = 0, learning = 0, fresh = 0;
    for (const c of cards) {
        if (c.status === 'mastered') mastered++;
        else if (c.status === 'learning') learning++;
        else fresh++;
    }
    const total = cards.length;
    return { total, mastered, learning, notStudied: fresh, masteredPct: percent(mastered, total) };
};

// ─── Charts ──────────────────────────────────────────────────────────
/** Weeks (columns, Sunday first) of day cells with a 0-4 intensity level. */
export const heatmap = (dayMap, today = dateString(), weeks = 26) => {
    const start = addDays(today, -(weeks * 7 - 1));
    const first = addDays(start, -weekdayOf(start));
    const counts = [...dayMap.values()].map((d) => d.reviews).filter(Boolean).sort((a, b) => a - b);
    const q = (p) => counts[Math.min(counts.length - 1, Math.floor(counts.length * p))] || 1;
    const t1 = q(0.25), t2 = q(0.5), t3 = q(0.75);
    const levelOf = (n) => (n <= 0 ? 0 : n <= t1 ? 1 : n <= t2 ? 2 : n <= t3 ? 3 : 4);
    const cols = [];
    for (let cursor = first; cursor <= today; ) {
        const col = [];
        for (let i = 0; i < 7; i++, cursor = addDays(cursor, 1)) {
            const day = dayMap.get(cursor);
            col.push({ date: cursor, reviews: day?.reviews || 0, ms: day?.ms || 0, level: cursor > today ? -1 : levelOf(day?.reviews || 0) });
        }
        cols.push(col);
    }
    return cols;
};

/** Last `days` calendar days (including empty ones), oldest first. */
export const dailySeries = (dayMap, days = 30, today = dateString()) => {
    const out = [];
    for (let i = days - 1; i >= 0; i--) {
        const date = addDays(today, -i);
        const d = dayMap.get(date);
        out.push({ date, reviews: d?.reviews || 0, know: d?.know || 0, forgot: d?.forgot || 0, ms: d?.ms || 0, accuracy: d ? percent(d.know, d.know + d.forgot) : null });
    }
    return out;
};

/** Volume and accuracy by hour of day and by weekday. */
export const timePatterns = (reviews = []) => {
    const hours = Array.from({ length: 24 }, () => ({ count: 0, know: 0, forgot: 0 }));
    const weekdays = Array.from({ length: 7 }, () => ({ count: 0, know: 0, forgot: 0 }));
    for (const r of reviews) {
        const h = new Date(r.ts).getHours();
        const w = weekdayOf(r.date);
        for (const bucket of [hours[h], weekdays[w]]) {
            bucket.count++;
            if (r.result === 'know') bucket.know++;
            else if (r.result === 'forgot') bucket.forgot++;
        }
    }
    const withAcc = (b) => ({ ...b, accuracy: b.know + b.forgot ? percent(b.know, b.know + b.forgot) : null });
    return { hours: hours.map(withAcc), weekdays: weekdays.map(withAcc) };
};

// ─── Cards and decks ─────────────────────────────────────────────────
/**
 * Cards you forget most often. Per-card history is thin at first (every card is only seen now and then), so
 * this works in tiers: cards missed at least twice or with 3+ answers first, then any card missed once, then,
 * if there are no logged misses at all, cards currently marked "still learning".
 * Returns { items: [{ card, know, forgot, total, accuracy }], source: 'reviews' | 'status', early: boolean }.
 */
export const hardestCards = (reviews = [], cards = [], { limit = 10, minReviews = 3 } = {}) => {
    const byCard = new Map();
    for (const r of reviews) {
        if (r.cardId == null || r.result === 'skip') continue;
        const e = byCard.get(r.cardId) || { know: 0, forgot: 0, last: 0 };
        if (r.result === 'know') e.know++; else e.forgot++;
        if (r.ts > e.last) e.last = r.ts;
        byCard.set(r.cardId, e);
    }
    const cardById = new Map(cards.map((c) => [c.id, c]));
    const rows = [...byCard.entries()]
        .map(([id, e]) => ({ card: cardById.get(id), ...e, total: e.know + e.forgot, accuracy: percent(e.know, e.know + e.forgot) }))
        .filter((x) => x.card && x.forgot > 0);
    const rank = (a, b) => a.accuracy - b.accuracy || b.forgot - a.forgot || b.last - a.last;
    const solid = rows.filter((x) => x.total >= minReviews || x.forgot >= 2).sort(rank);
    const solidIds = new Set(solid.map((x) => x.card.id));
    const rest = rows.filter((x) => !solidIds.has(x.card.id)).sort((a, b) => b.last - a.last);
    const items = [...solid, ...rest].slice(0, limit);
    if (items.length) return { items, source: 'reviews', early: solid.length < Math.min(limit, items.length) };
    const learning = cards.filter((c) => c.status === 'learning').slice(0, limit)
        .map((card) => ({ card, know: 0, forgot: 0, total: 0, accuracy: 0 }));
    return { items: learning, source: 'status', early: false };
};

/** Stats for one deck, or for several (a folder's decks) when `deckIds` is a Set/array. */
export const deckStats = (deckIds, reviews = [], cards = []) => {
    const ids = new Set(Array.isArray(deckIds) || deckIds instanceof Set ? deckIds : [deckIds]);
    const deckCards = cards.filter((c) => ids.has(c.deckId));
    const deckReviews = reviews.filter((r) => ids.has(r.deckId));
    let know = 0, forgot = 0, ms = 0, last = 0;
    for (const r of deckReviews) {
        if (r.result === 'know') know++; else if (r.result === 'forgot') forgot++;
        ms += r.ms || 0;
        if (r.ts > last) last = r.ts;
    }
    return {
        ...masteryBreakdown(deckCards),
        reviews: deckReviews.length, know, forgot, accuracy: percent(know, know + forgot),
        ms, lastStudied: last || null
    };
};

export const formatAgo = (ts, now = Date.now()) => {
    if (!ts) return 'Never studied';
    const days = Math.floor((new Date(dateString(now) + 'T12:00').getTime() - new Date(dateString(ts) + 'T12:00').getTime()) / 864e5);
    if (days <= 0) return 'Studied today';
    if (days === 1) return 'Studied yesterday';
    if (days < 30) return `Studied ${days} days ago`;
    return `Studied ${Math.round(days / 30)} mo ago`;
};

// ─── Quizzes ─────────────────────────────────────────────────────────
export const quizStats = (quizResults = [], decks = [], cards = []) => {
    const cardById = new Map(cards.map((c) => [c.id, c]));
    const byDeck = new Map();
    const types = { mcq: { right: 0, total: 0 }, tf: { right: 0, total: 0 }, fitb: { right: 0, total: 0 } };
    for (const r of [...quizResults].sort((a, b) => (a.finishedAt || '').localeCompare(b.finishedAt || ''))) {
        const e = byDeck.get(r.deckId) || { deckId: r.deckId, name: r.deckName, attempts: [] };
        e.attempts.push({ percent: r.percent, at: r.finishedAt, durationMs: r.durationMs || 0, mode: r.mode, correct: r.correct, total: r.total });
        byDeck.set(r.deckId, e);
        for (const a of r.answers || []) {
            const t = types[cardById.get(a.cardId)?.type];
            if (t) { t.total++; if (a.correct) t.right++; }
        }
    }
    const deckName = new Map(decks.map((d) => [d.id, d.name]));
    const perDeck = [...byDeck.values()].map((e) => {
        const ps = e.attempts.map((a) => a.percent);
        return {
            deckId: e.deckId, name: deckName.get(e.deckId) || e.name, attempts: e.attempts.length,
            best: Math.max(...ps), latest: ps[ps.length - 1], average: Math.round(ps.reduce((x, y) => x + y, 0) / ps.length),
            history: ps.slice(-12), attempts: e.attempts.slice(-12), allAttempts: e.attempts.length, improved: ps.length > 1 ? ps[ps.length - 1] - ps[0] : 0
        };
    }).sort((a, b) => b.attempts - a.attempts);
    const all = quizResults;
    return {
        attempts: all.length, perDeck,
        average: all.length ? Math.round(all.reduce((n, r) => n + (r.percent || 0), 0) / all.length) : 0,
        best: all.length ? Math.max(...all.map((r) => r.percent || 0)) : 0,
        ms: all.reduce((n, r) => n + (r.durationMs || 0), 0),
        byType: Object.fromEntries(Object.entries(types).map(([k, v]) => [k, { ...v, accuracy: percent(v.right, v.total) }])),
        recent: [...all].sort((a, b) => (b.finishedAt || '').localeCompare(a.finishedAt || '')).slice(0, 8)
    };
};

// ─── Achievements ────────────────────────────────────────────────────
export const ACHIEVEMENTS = [
    { id: 'first-review', name: 'First step', desc: 'Answer your first card', test: (c) => c.summary.reviews >= 1 },
    { id: 'streak-3', name: 'On a roll', desc: 'Study 3 days in a row', test: (c) => c.summary.longestStreak >= 3 },
    { id: 'streak-7', name: 'One week strong', desc: 'Study 7 days in a row', test: (c) => c.summary.longestStreak >= 7 },
    { id: 'streak-30', name: 'Habit formed', desc: 'Study 30 days in a row', test: (c) => c.summary.longestStreak >= 30 },
    { id: 'streak-100', name: 'Unstoppable', desc: 'Study 100 days in a row', test: (c) => c.summary.longestStreak >= 100 },
    { id: 'reviews-100', name: 'Hundred club', desc: 'Answer 100 cards', test: (c) => c.summary.reviews >= 100 },
    { id: 'reviews-1000', name: 'Thousand club', desc: 'Answer 1,000 cards', test: (c) => c.summary.reviews >= 1000 },
    { id: 'goal-met', name: 'Goal getter', desc: 'Hit your daily goal', test: (c) => c.summary.goalStreak >= 1 || c.hitGoalEver },
    { id: 'goal-streak-7', name: 'Goal streak', desc: 'Hit your daily goal 7 days in a row', test: (c) => c.summary.goalStreak >= 7 },
    { id: 'mastered-25', name: 'Getting it', desc: 'Master 25 cards', test: (c) => c.summary.mastered >= 25 },
    { id: 'mastered-deck', name: 'Deck cleared', desc: 'Master every card in a deck (5+ cards)', test: (c) => c.masteredDeck },
    { id: 'perfect-quiz', name: 'Flawless', desc: 'Score 100% on a practice quiz', test: (c) => c.quiz.best >= 100 },
    { id: 'quiz-10', name: 'Quiz regular', desc: 'Finish 10 practice quizzes', test: (c) => c.quiz.attempts >= 10 },
    { id: 'hours-5', name: 'Time well spent', desc: 'Study for 5 hours in total', test: (c) => c.summary.msAll + c.quiz.ms >= 5 * 3600000 }
];

/** Builds the facts achievements are checked against. */
export const achievementContext = ({ reviews, legacyStats, cards, quizResults, decks, goal }) => {
    const dayMap = buildDayMap(reviews, legacyStats);
    const summary = summarize(dayMap, cards, { goal });
    const hitGoalEver = [...dayMap.values()].some((d) => d.reviews >= goal);
    const byDeck = new Map();
    for (const c of cards) byDeck.set(c.deckId, [...(byDeck.get(c.deckId) || []), c]);
    const masteredDeck = [...byDeck.values()].some((list) => list.length >= 5 && list.every((c) => c.status === 'mastered'));
    return { summary, hitGoalEver, masteredDeck, quiz: quizStats(quizResults, decks, cards), dayMap };
};

/** Returns { unlocked: [defs], all: Map id -> true } for ids not yet in `already`. */
export const newAchievements = (ctx, already = {}) =>
    ACHIEVEMENTS.filter((a) => !already[a.id] && a.test(ctx));

// ─── Export ──────────────────────────────────────────────────────────
export const reviewsToCsv = (reviews = [], decks = [], cards = []) => {
    const deckName = new Map(decks.map((d) => [d.id, d.name]));
    const cardTerm = new Map(cards.map((c) => [c.id, c.term]));
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = reviews.map((r) => [new Date(r.ts).toISOString(), r.date, deckName.get(r.deckId) || '', cardTerm.get(r.cardId) || '', r.result, r.type, (r.ms / 1000).toFixed(1)].map(esc).join(','));
    return ['timestamp,date,deck,card,result,type,seconds', ...rows].join('\n');
};


// ─── Aggregates (single pass, so big libraries stay fast) ────────────
/** Map deckId -> mastery counts + review stats, built in one pass over cards and reviews. */
export const deckAggregates = (cards = [], reviews = []) => {
    const map = new Map();
    const get = (id) => {
        let e = map.get(id);
        if (!e) { e = { deckId: id, total: 0, mastered: 0, learning: 0, notStudied: 0, reviews: 0, know: 0, forgot: 0, ms: 0, lastStudied: null }; map.set(id, e); }
        return e;
    };
    for (const c of cards) {
        const e = get(c.deckId);
        e.total++;
        if (c.status === 'mastered') e.mastered++; else if (c.status === 'learning') e.learning++; else e.notStudied++;
    }
    for (const r of reviews) {
        if (r.deckId == null) continue;
        const e = get(r.deckId);
        e.reviews++;
        e.ms += r.ms || 0;
        if (r.result === 'know') e.know++; else if (r.result === 'forgot') e.forgot++;
        if (!e.lastStudied || r.ts > e.lastStudied) e.lastStudied = r.ts;
    }
    for (const e of map.values()) { e.masteredPct = percent(e.mastered, e.total); e.accuracy = percent(e.know, e.know + e.forgot); }
    return map;
};

/** Reviews grouped by local date (for the heatmap's day panel). */
export const groupByDate = (reviews = []) => {
    const map = new Map();
    for (const r of reviews) { const list = map.get(r.date); if (list) list.push(r); else map.set(r.date, [r]); }
    return map;
};

export const dayDetails = (date, byDate, deckName, legacyDay) => {
    const list = byDate.get(date) || [];
    const d = { date, reviews: list.length, know: 0, forgot: 0, skip: 0, ms: 0, decks: [], first: null, last: null, legacy: false };
    const perDeck = new Map();
    for (const r of list) {
        d.ms += r.ms || 0;
        if (r.result === 'know') d.know++; else if (r.result === 'forgot') d.forgot++; else d.skip++;
        perDeck.set(r.deckId, (perDeck.get(r.deckId) || 0) + 1);
        if (!d.first || r.ts < d.first) d.first = r.ts;
        if (!d.last || r.ts > d.last) d.last = r.ts;
    }
    if (!list.length && legacyDay) { d.reviews = legacyDay.reviews; d.know = legacyDay.know; d.forgot = legacyDay.forgot; d.legacy = true; }
    d.accuracy = percent(d.know, d.know + d.forgot);
    d.decks = [...perDeck.entries()].map(([id, count]) => ({ name: deckName(id), count })).sort((a, b) => b.count - a.count);
    return d;
};

/** Last 7 days vs the 7 before: volume, accuracy and time with deltas. */
export const weeklyComparison = (dayMap, today = dateString()) => {
    const sum = (from, to) => {
        const o = { reviews: 0, know: 0, forgot: 0, ms: 0, days: 0 };
        for (let i = from; i <= to; i++) {
            const d = dayMap.get(addDays(today, -i));
            if (!d) continue;
            o.reviews += d.reviews; o.know += d.know; o.forgot += d.forgot; o.ms += d.ms; o.days++;
        }
        o.accuracy = o.know + o.forgot ? percent(o.know, o.know + o.forgot) : null;
        return o;
    };
    const cur = sum(0, 6), prev = sum(7, 13);
    return { cur, prev,
        reviewsDelta: prev.reviews ? Math.round(((cur.reviews - prev.reviews) / prev.reviews) * 100) : null,
        accuracyDelta: cur.accuracy != null && prev.accuracy != null ? cur.accuracy - prev.accuracy : null,
        msDelta: prev.ms ? Math.round(((cur.ms - prev.ms) / prev.ms) * 100) : null };
};

/** Rolling accuracy over `window` days (weighted by answers), null where there is no data yet. */
export const rollingAccuracy = (series, window = 7) => series.map((_, i) => {
    let know = 0, forgot = 0;
    for (let j = Math.max(0, i - window + 1); j <= i; j++) { know += series[j].know; forgot += series[j].forgot; }
    return know + forgot >= 3 ? percent(know, know + forgot) : null;
});

export const DECK_STALE_DAYS = 14;

/** Plain-language observations with an optional action, most important first. */
export const buildInsights = ({ summary, weekly, patterns, deckAgg, decks, quiz, today = dateString(), now = Date.now() }) => {
    const out = [];
    const flash = (tone, text, action) => out.push({ tone, text, action });
    if (!summary.today && summary.streak > 0) flash('warn', `Study today to keep your ${summary.streak}-day streak alive.`);
    else if (summary.today && !summary.goalMet) flash('info', `${summary.goal - summary.today} more card${summary.goal - summary.today === 1 ? '' : 's'} to reach today's goal.`);
    else if (summary.goalMet && summary.goalStreak > 1) flash('good', `Daily goal met ${summary.goalStreak} days in a row.`);
    if (weekly.reviewsDelta != null && Math.abs(weekly.reviewsDelta) >= 20) flash(weekly.reviewsDelta > 0 ? 'good' : 'info', `You answered ${Math.abs(weekly.reviewsDelta)}% ${weekly.reviewsDelta > 0 ? 'more' : 'fewer'} cards than the week before.`);
    if (weekly.accuracyDelta != null && Math.abs(weekly.accuracyDelta) >= 5) flash(weekly.accuracyDelta > 0 ? 'good' : 'warn', `Accuracy ${weekly.accuracyDelta > 0 ? 'up' : 'down'} ${Math.abs(weekly.accuracyDelta)} points this week (${weekly.cur.accuracy}%).`);
    const stale = decks.filter((d) => d.kind !== 'quiz').map((d) => ({ d, a: deckAgg.get(d.id) })).filter((x) => x.a && x.a.total >= 5 && x.a.lastStudied && (now - x.a.lastStudied) / 864e5 >= DECK_STALE_DAYS);
    if (stale.length) flash('warn', `${stale.length} deck${stale.length === 1 ? '' : 's'} you studied before ${stale.length === 1 ? 'has' : 'have'} not been reviewed in ${DECK_STALE_DAYS}+ days.`, { type: 'filter', value: 'stale', label: 'Show' });
    const weak = decks.filter((d) => d.kind !== 'quiz').map((d) => ({ d, a: deckAgg.get(d.id) })).filter((x) => x.a && x.a.know + x.a.forgot >= 15 && x.a.accuracy < 60).sort((a, b) => a.a.accuracy - b.a.accuracy)[0];
    if (weak) flash('warn', `"${weak.d.name}" is your toughest deck: ${weak.a.accuracy}% accuracy over ${weak.a.know + weak.a.forgot} answers.`, { type: 'study-deck', value: weak.d.id, label: 'Study' });
    const hour = patterns.hours.map((h, i) => ({ ...h, i })).filter((h) => h.know + h.forgot >= 8).sort((a, b) => b.accuracy - a.accuracy)[0];
    if (hour) flash('info', `You answer most accurately around ${hour.i % 12 || 12}${hour.i < 12 ? ' AM' : ' PM'} (${hour.accuracy}%).`);
    const types = Object.entries(quiz.byType).filter(([, v]) => v.total >= 8).sort((a, b) => a[1].accuracy - b[1].accuracy)[0];
    const labels = { mcq: 'multiple choice', tf: 'true/false', fitb: 'fill-in-the-blank' };
    if (types && types[1].accuracy < 70) flash('info', `Quiz weak spot: ${labels[types[0]]} questions (${types[1].accuracy}% correct).`);
    const toMilestone = summary.reviews < 1000 ? 1000 - summary.reviews : null;
    if (toMilestone && toMilestone <= 150) flash('good', `${toMilestone} more answers to the Thousand club.`);
    return out.slice(0, 5);
};
