// Records the real Retention dashboard (served from the repo root) as scripted clips.
// Usage: python3 -m http.server 8765 (in repo root) && node record/record.mjs
import {chromium} from 'playwright-core';
import {mkdirSync, renameSync, rmSync} from 'node:fs';
import {execSync} from 'node:child_process';
import {seed} from './seed.mjs';

const URL = 'http://localhost:8765/dashboard.html';
const W = 1600, H = 900;
const PRO_THEMES = ['dark', 'library', 'fjord', 'matcha', 'blueprint', 'space'];
const ANSWERS = {Mitochondria: 1, Ribosome: 1, Osmosis: 1};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CURSOR = `
(() => {
  const c = document.createElement('div');
  c.style.cssText = 'position:fixed;z-index:2147483647;pointer-events:none;width:26px;height:26px;left:0;top:0;transform:translate(-100px,-100px);transition:none';
  c.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M4 2l16 9-7 2-3 7z" fill="#fff" stroke="#000" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  const r = document.createElement('div');
  r.style.cssText = 'position:fixed;z-index:2147483646;pointer-events:none;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;border:3px solid #2563eb;opacity:0;';
  addEventListener('DOMContentLoaded', () => { document.body.append(r, c); });
  addEventListener('mousemove', (e) => { c.style.transform = 'translate(' + e.clientX + 'px,' + e.clientY + 'px)'; r.style.left = e.clientX + 'px'; r.style.top = e.clientY + 'px'; }, true);
  addEventListener('mousedown', () => { r.animate([{opacity: .9, transform: 'scale(.4)'}, {opacity: 0, transform: 'scale(1.3)'}], {duration: 420}); }, true);
})();`;

const browser = await chromium.launch({channel: 'chrome'});
mkdirSync('record/raw', {recursive: true});
mkdirSync('public/clips', {recursive: true});

async function session(name, fn, {theme} = {}) {
  const dir = `record/raw/${name}`;
  rmSync(dir, {recursive: true, force: true});
  const ctx = await browser.newContext({viewport: {width: W, height: H}, recordVideo: {dir, size: {width: W, height: H}}});
  await ctx.addInitScript(CURSOR);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log(name, 'ERR', e.message));
  await page.goto(URL);
  await seed(page);
  await page.evaluate((themes) => { localStorage.setItem('theme_favorites', JSON.stringify(themes)); localStorage.setItem('retention_theme_favorites', JSON.stringify(themes)); }, PRO_THEMES);
  await page.reload();
  await sleep(900);
  const t0 = Date.now();
  await fn(page);
  await sleep(700);
  const video = page.video();
  await ctx.close();
  const raw = await video.path();
  renameSync(raw, `record/raw/${name}.webm`);
  // H.264 mp4 for Remotion, constant 30fps
  execSync(`ffmpeg -y -loglevel error -i record/raw/${name}.webm -r 30 -c:v libx264 -crf 14 -pix_fmt yuv420p -an public/clips/${name}.mp4`);
  console.log('recorded', name, ((Date.now() - t0) / 1000).toFixed(1) + 's');
}

const hover = async (page, sel, opts = {}) => {
  const loc = typeof sel === 'string' ? page.locator(sel).first() : sel;
  await loc.scrollIntoViewIfNeeded();
  const b = await loc.boundingBox();
  await page.mouse.move(b.x + b.width * (opts.fx ?? 0.5), b.y + b.height * (opts.fy ?? 0.5), {steps: 28});
  await sleep(opts.pause ?? 250);
  return loc;
};
const click = async (page, sel, opts) => { const l = await hover(page, sel, opts); await l.click(); await sleep(opts?.after ?? 500); };
const type = async (page, sel, text, delay = 85) => { await click(page, sel, {after: 150}); await page.keyboard.type(text, {delay}); };

// ── 1. Flashcards + fill-in-the-blank ──────────────────────────────
await session('study', async (page) => {
  await sleep(900);
  await click(page, page.locator('.db-card', {hasText: 'Cell Biology'}), {after: 900});
  for (let n = 0; n < 6; n++) {
    await sleep(500);
    const isCloze = await page.locator('#cloze-area').isVisible();
    if (isCloze) {
      const term = await page.locator('#fc-term').innerText();
      const answer = term.includes('genetic') ? 'nucleus' : 'chloroplast';
      await type(page, '#cloze-input', answer);
      await click(page, '#btn-cloze-check', {after: 1500});
      await click(page, '#btn-cloze-check', {after: 700}); // Continue
    } else {
      await sleep(900);
      await click(page, '#flashcard', {after: 1500});
      await click(page, n % 3 === 1 ? '#btn-forgot' : '#btn-know', {after: 700});
    }
  }
  await sleep(1200);
});

// ── 2. Practice quiz (MCQ, T/F, FITB) ─────────────────────────────
await session('quiz', async (page) => {
  await sleep(700);
  await click(page, page.locator('.db-card', {hasText: 'Networks Quiz'}), {after: 1200});
  await click(page, page.locator('.pt-question').nth(0).locator('.pt-choice').nth(1), {after: 1700}); // TCP correct
  await click(page, page.locator('.pt-question').nth(1).locator('.pt-choice').nth(1), {after: 1700}); // False correct
  const fitb = page.locator('.pt-question').nth(2);
  await fitb.scrollIntoViewIfNeeded(); await sleep(500);
  await type(page, fitb.locator('.pt-input'), 'IP');
  await click(page, fitb.locator('.pt-check'), {after: 1600});
  const q4 = page.locator('.pt-question').nth(3);
  await q4.scrollIntoViewIfNeeded(); await sleep(500);
  await click(page, q4.locator('.pt-choice').nth(2), {after: 2200});
  await page.locator('.pt-results').scrollIntoViewIfNeeded().catch(() => {});
  await page.evaluate(() => document.querySelector('.db-body')?.scrollTo({top: 0, behavior: 'smooth'}));
  await sleep(2200);
});

// ── 3. Themes: gallery then one-click switching through study ─────
await session('themes', async (page) => {
  await click(page, '#btn-sidebar-themes', {after: 1200});
  await page.evaluate(() => document.querySelector('.db-body')?.scrollTo({top: 560, behavior: 'smooth'}));
  await sleep(1300);
  await page.evaluate(() => document.querySelector('.db-body')?.scrollTo({top: 1250, behavior: 'smooth'}));
  await sleep(1400);
  await click(page, page.locator('[data-action="apply"][data-id="library"]').first(), {after: 1500});
  await click(page, '#btn-back', {after: 900});
  await click(page, page.locator('.db-card', {hasText: 'Cell Biology'}), {after: 900});
  await click(page, '#flashcard', {after: 900});
  for (const id of ['fjord', 'matcha', 'blueprint', 'space', 'dark']) {
    await click(page, '#btn-theme', {after: 500});
    await click(page, page.locator(`.theme-quick-menu [data-id="${id}"], .theme-quick-menu button:has-text("${id}")`).first(), {after: 1500});
  }
  await sleep(600);
});

// ── 4. Generating cards with AI (progress banner is the real component) ──
await session('ai', async (page) => {
  await click(page, '#btn-add-menu', {after: 700});
  await hover(page, '#btn-menu-add-pdf-drive', {pause: 900});
  await page.keyboard.press('Escape');
  await page.mouse.click(900, 600); await sleep(500);
  await page.evaluate(async () => {
    const banner = document.getElementById('bg-task-banner');
    banner.style.display = 'block';
    document.getElementById('bg-task-title').textContent = 'Analyzing "Chapter 3 Networks"';
    for (let p = 0; p <= 100; p += 2) {
      document.getElementById('bg-task-percent').textContent = p + '%';
      document.getElementById('bg-task-fill').style.width = p + '%';
      await new Promise((r) => setTimeout(r, 45));
    }
    document.getElementById('bg-task-title').textContent = 'Saving 24 flashcards';
  });
  await sleep(700);
  await page.evaluate(() => { document.getElementById('bg-task-banner').style.display = 'none'; });
  await click(page, page.locator('.db-card', {hasText: 'Cell Biology'}).first().locator('h3'), {after: 800}).catch(() => {});
  await sleep(1000);
});

await browser.close();
