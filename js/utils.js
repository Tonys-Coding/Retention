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
