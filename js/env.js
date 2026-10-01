/**
 * env.js — Environment Detection & Storage Abstraction Layer
 * 
 * Provides a unified API for storage and messaging that works:
 *   1. Inside the Chrome Extension (uses chrome.storage.local + chrome.runtime)
 *   2. On the open web / mobile PWA (uses localStorage + custom events)
 * 
 * Usage:
 *   import { isExtension, storage, runtime } from './env.js';
 */

// ─── Environment Detection ──────────────────────────────────────────
export const isExtension = !!(
    typeof chrome !== 'undefined' &&
    chrome.runtime &&
    chrome.runtime.id
);

// ─── Event Bus (used by web fallback for storage.onChange & runtime messages) ──
const _listeners = {};

const eventBus = {
    on(event, fn) {
        if (!_listeners[event]) _listeners[event] = [];
        _listeners[event].push(fn);
    },
    emit(event, ...args) {
        (_listeners[event] || []).forEach(fn => fn(...args));
    },
    off(event, fn) {
        if (!_listeners[event]) return;
        _listeners[event] = _listeners[event].filter(f => f !== fn);
    }
};

// ─── Storage Abstraction ─────────────────────────────────────────────
// Mirrors chrome.storage.local but falls back to localStorage on web.

const chromeStorage = {
    async get(keys) {
        return new Promise(resolve => {
            chrome.storage.local.get(keys, resolve);
        });
    },
    async set(obj) {
        return new Promise(resolve => {
            chrome.storage.local.set(obj, resolve);
        });
    },
    async remove(key) {
        return new Promise(resolve => {
            chrome.storage.local.remove(key, resolve);
        });
    },
    onChange(callback) {
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area === 'local') callback(changes);
        });
    }
};

const webStorage = {
    async get(keys) {
        const result = {};
        const keyArr = Array.isArray(keys) ? keys : [keys];
        keyArr.forEach(k => {
            const raw = localStorage.getItem(`retention_${k}`);
            if (raw !== null) {
                try { result[k] = JSON.parse(raw); }
                catch { result[k] = raw; }
            }
        });
        return result;
    },
    async set(obj) {
        const changes = {};
        Object.entries(obj).forEach(([k, v]) => {
            const oldRaw = localStorage.getItem(`retention_${k}`);
            let oldValue;
            try { oldValue = oldRaw !== null ? JSON.parse(oldRaw) : undefined; }
            catch { oldValue = oldRaw; }

            localStorage.setItem(`retention_${k}`, JSON.stringify(v));
            changes[k] = { oldValue, newValue: v };
        });
        // Fire change listeners (mirrors chrome.storage.onChanged)
        eventBus.emit('storageChanged', changes);
    },
    async remove(key) {
        const keys = Array.isArray(key) ? key : [key];
        const changes = {};
        keys.forEach(k => {
            const oldRaw = localStorage.getItem(`retention_${k}`);
            let oldValue;
            try { oldValue = oldRaw !== null ? JSON.parse(oldRaw) : undefined; }
            catch { oldValue = oldRaw; }

            localStorage.removeItem(`retention_${k}`);
            changes[k] = { oldValue, newValue: undefined };
        });
        eventBus.emit('storageChanged', changes);
    },
    onChange(callback) {
        eventBus.on('storageChanged', callback);
    }
};

export const storage = isExtension ? chromeStorage : webStorage;

// ─── Runtime Messaging Abstraction ───────────────────────────────────
// In the extension: sends messages to the background service worker.
// On web: emits/listens on the local event bus (processed in-page).

const chromeRuntime = {
    sendMessage(msg) {
        // Rejects with "Receiving end does not exist" when no page is open to listen
        chrome.runtime.sendMessage(msg)?.catch?.(() => {});
    },
    onMessage(callback) {
        chrome.runtime.onMessage.addListener(callback);
    }
};

const webRuntime = {
    sendMessage(msg) {
        eventBus.emit('runtimeMessage', msg);
    },
    onMessage(callback) {
        eventBus.on('runtimeMessage', callback);
    }
};

export const runtime = isExtension ? chromeRuntime : webRuntime;

// ─── Expose event bus for ai-processor to fire storage changes ───────
export { eventBus };
