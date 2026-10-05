// Turns the generated SVG art in tools/art into the optimized WebP files the app ships in images/.
// SVG filters (feTurbulence, blurs) and thousands of shapes are slow to rasterize at runtime; pre-rendering
// them keeps theme switching, resizing and scrolling smooth.
// Usage (repo root):  python3 tools/gen_storm_scene.py && python3 tools/gen_campfire_scene.py && node tools/rasterize_scenes.mjs
// Needs Google Chrome, playwright-core (installed in promo-video/) and cwebp (brew install webp).
import { chromium } from '../promo-video/node_modules/playwright-core/index.mjs';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';

const S = 1.5;                 // output pixels per canvas unit (canvas is 1600x900)
const tmp = 'tools/art/.tmp';
mkdirSync(tmp, { recursive: true });

// name -> { svg, out, crop: [x0, y0, x1, y1] in canvas units, alpha, q, scale }
const jobs = [
    { svg: 'storm-sky.svg', out: 'storm-sky', crop: [0, 0, 1600, 900], q: 80 },
    { svg: 'storm-land.svg', out: 'storm-land', crop: [0, 0, 1600, 900], alpha: true, q: 82 },
    { svg: 'storm-wisps.svg', out: 'storm-wisps', crop: [0, 0, 1600, 770], alpha: true, q: 40, scale: 0.6 },
    { svg: 'storm-grass.svg', out: 'storm-grass', crop: [0, 560, 1600, 900], alpha: true, q: 80 },
    { svg: 'storm-bolt-a.svg', out: 'storm-bolt-a', crop: [930, 330, 1270, 690], alpha: true, q: 90 },
    { svg: 'storm-bolt-b.svg', out: 'storm-bolt-b', crop: [520, 300, 760, 420], alpha: true, q: 90 },
    { svg: 'storm-still.svg', out: 'storm-still', crop: [0, 0, 1600, 900], q: 72, scale: 0.55 },
    { svg: 'campfire-scene.svg', out: 'campfire-scene', crop: [0, 0, 1600, 900], q: 80 },
    { svg: 'campfire-scene.svg', out: 'campfire-still', crop: [0, 0, 1600, 900], q: 70, scale: 0.55 },
    // sky pixels with a baked top-to-bottom fade, laid over the top of the rain so it fades in from the cloud base
    { svg: 'storm-sky.svg', out: 'storm-cloudbase', crop: [860, 220, 1560, 340], alpha: true, q: 80, fadeY: true },
    { svg: 'storm-rain.svg', out: 'storm-rain', size: [700, 400], sizeScale: 2, alpha: true, q: 85 }
];

const browser = await chromium.launch({ channel: 'chrome' });
for (const job of jobs) {
    const svg = readFileSync(`tools/art/${job.svg}`, 'utf8');
    const scale = (job.scale || 1) * S;
    const [x0, y0, x1, y1] = job.crop || [0, 0, 400, 400];
    const w = job.size ? job.size[0] * job.sizeScale : Math.round((x1 - x0) * scale);
    const h = job.size ? job.size[1] * job.sizeScale : Math.round((y1 - y0) * scale);
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    const fade = job.fadeY ? 'mask-image:linear-gradient(to bottom,#000 0%,#000 12%,transparent 100%);-webkit-mask-image:linear-gradient(to bottom,#000 0%,#000 12%,transparent 100%);' : '';
    const body = job.size
        ? `<svg width="${w}" height="${h}" viewBox="0 0 ${job.size[0]} ${job.size[1]}">${svg.replace(/^<svg[^>]*>|<\/svg>$/g, '')}</svg>`
        : `<div style="width:${w}px;height:${h}px;overflow:hidden;${fade}"><div style="position:absolute;left:${-x0 * scale}px;top:${-y0 * scale}px;width:${1600 * scale}px;height:${900 * scale}px">${svg.replace('<svg ', '<svg width="100%" height="100%" ')}</div></div>`;
    await page.setContent(`<html><body style="margin:0;background:transparent;overflow:hidden">${body}</body></html>`);
    await page.waitForTimeout(600);
    const png = `${tmp}/${job.out}.png`;
    await page.screenshot({ path: png, omitBackground: !!job.alpha });
    execSync(`cwebp -quiet -q ${job.q} ${job.alpha ? '-alpha_q 90 -exact' : ''} ${png} -o images/${job.out}.webp`);
    await ctx.close();
    console.log(job.out, `${w}x${h}`);
}
await browser.close();
rmSync(tmp, { recursive: true, force: true });
