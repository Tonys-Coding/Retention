/**
 * progress-data.js — Loads everything the Progress features need from the
 * database and settings, and keeps the daily goal and unlocked achievements.
 * Shared by the dashboard and the extension popup.
 */

import { storage } from './env.js';
import { getReviews, getStats, getAllCards, getDecks, getFolders, getQuizResults } from './db.js';
import { DEFAULT_DAILY_GOAL, newAchievements, achievementContext, dateString } from './stats.js';

const GOAL_KEY = 'daily_goal';
const ACHIEVEMENTS_KEY = 'achievements';

export const getGoal = async () => {
    const n = Number((await storage.get([GOAL_KEY]))[GOAL_KEY]);
    return n > 0 ? Math.round(n) : DEFAULT_DAILY_GOAL;
};
export const setGoal = (n) => storage.set({ [GOAL_KEY]: Math.max(1, Math.round(n)) });
export const getUnlocked = async () => (await storage.get([ACHIEVEMENTS_KEY]))[ACHIEVEMENTS_KEY] || {};

export const loadProgressData = async () => {
    const [reviews, legacyStats, cards, decks, folders, quizResults, goal, achievements] = await Promise.all([
        getReviews(), getStats(), getAllCards(), getDecks(), getFolders(), getQuizResults(), getGoal(), getUnlocked()
    ]);
    return { reviews, legacyStats, cards, decks, folders, quizResults, goal, achievements };
};

/** Unlocks any newly earned achievements, saves them and returns their definitions. */
export const checkAchievements = async (data) => {
    const d = data || await loadProgressData();
    const ctx = achievementContext(d);
    const fresh = newAchievements(ctx, d.achievements);
    if (!fresh.length) return [];
    const today = dateString();
    const merged = { ...d.achievements };
    fresh.forEach((a) => { merged[a.id] = today; });
    await storage.set({ [ACHIEVEMENTS_KEY]: merged });
    return fresh;
};

// ─── Drive backup (preferences section) ──────────────────────────────
export const getSyncedProgressPrefs = async () => {
    const res = await storage.get([GOAL_KEY, ACHIEVEMENTS_KEY]);
    const out = {};
    if (res[GOAL_KEY]) out.dailyGoal = res[GOAL_KEY];
    if (res[ACHIEVEMENTS_KEY] && Object.keys(res[ACHIEVEMENTS_KEY]).length) out.achievements = res[ACHIEVEMENTS_KEY];
    return out;
};

export const restoreProgressPrefs = async (prefs = {}) => {
    if (prefs.dailyGoal > 0) await storage.set({ [GOAL_KEY]: prefs.dailyGoal });
    if (prefs.achievements && typeof prefs.achievements === 'object') {
        // Union: never lose an achievement earned on this device
        const local = await getUnlocked();
        const merged = { ...prefs.achievements, ...local };
        await storage.set({ [ACHIEVEMENTS_KEY]: merged });
    }
};
