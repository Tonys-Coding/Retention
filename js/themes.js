/**
 * themes.js — Theme catalog, favorites, and the quick theme menu.
 *
 * Shared by the extension popup (app.js) and the web/mobile dashboard
 * (dashboard.js, themes-library.js). The theme itself is applied by
 * css/style.css (`body.theme-<id>`); the colors and background artwork below
 * only drive previews and swatches, so keep them in sync with style.css.
 */

import { markDbDirty } from './db.js';
import { storage } from './env.js';

const THEME_KEY = 'theme';
export const FAVORITES_KEY = 'theme_favorites';

/** Collections shown in the Themes library, in display order. */
export const THEME_COLLECTIONS = [
    { id: 'monochrome', name: 'Monochrome' },
    { id: 'retro', name: 'Retro Tech' },
    { id: 'paper', name: 'Paper & Print' },
    { id: 'cozy', name: 'Cozy & Earthy' },
    { id: 'cafe', name: 'Café Treats' },
    { id: 'celestial', name: 'Celestial' },
    { id: 'landscapes', name: 'Landscapes' },
    { id: 'starwars', name: 'Star Wars' }
];

const CHECKER = (c) => `linear-gradient(45deg, ${c} 25%, transparent 25%, transparent 75%, ${c} 75%), linear-gradient(45deg, ${c} 25%, transparent 25%, transparent 75%, ${c} 75%)`;
const KYLO_CRACKS = 'linear-gradient(65deg, transparent calc(25% - 1px), rgba(234, 28, 28, 0.9) 25%, transparent calc(25% + 1px)), linear-gradient(25deg, transparent calc(38% - 1px), rgba(234, 28, 28, 0.9) 38%, transparent calc(38% + 1px)), linear-gradient(-55deg, transparent calc(65% - 1px), rgba(234, 28, 28, 0.9) 65%, transparent calc(65% + 1px)), linear-gradient(-35deg, transparent calc(72% - 1px), rgba(234, 28, 28, 0.9) 72%, transparent calc(72% + 1px)), linear-gradient(80deg, transparent calc(80% - 1px), rgba(234, 28, 28, 0.9) 80%, transparent calc(80% + 1px))';
// Layered artwork: [image, size, position, repeat] per layer. The R2-D2 and Boba Fett
// helmets are drawn from positioned shapes; previews use a half-size copy of the
// artwork in style.css, and the tiny swatches a simplified version.
const art = (layers) => ({
    img: layers.map((l) => l[0]).join(', '),
    size: layers.map((l) => l[1]).join(', '),
    pos: layers.map((l) => l[2]).join(', '),
    repeat: layers.map((l) => l[3]).join(', ')
});
const R2D2_ART = art([
    ['radial-gradient(circle at 36% 34%, rgba(255, 255, 255, 0.75) 0 7%, transparent 8%)', '48px 48px', '50% 25%', 'no-repeat'],
    ['radial-gradient(circle, #08080f 0 44%, #34343f 45% 49%, transparent 50%)', '48px 48px', '50% 25%', 'no-repeat'],
    ['linear-gradient(#23408e, #23408e)', '59px 59px', '50% 24%', 'no-repeat'],
    ['linear-gradient(#23408e 0 11px, transparent 11px 15px, #23408e 15px 26px)', '13px 26px', 'calc(50% - 49px) 26%', 'no-repeat'],
    ['radial-gradient(circle, #1b1b24 0 22%, #f2f2f2 23% 45%, #8e8e96 46% 58%, #e6e6ea 59% 72%, transparent 73%)', '29px 29px', 'calc(50% + 52px) 27%', 'no-repeat'],
    ['repeating-linear-gradient(90deg, #23408e 0 37px, transparent 37px 43px)', '100% 8px', '0 9%', 'repeat-x'],
    ['repeating-linear-gradient(90deg, #23408e 0 66px, transparent 66px 71px, #23408e 71px 88px, transparent 88px 93px, #23408e 93px 131px, transparent 131px 136px)', '100% 31px', '0 47%', 'repeat-x'],
    ['linear-gradient(rgba(255, 255, 255, 0.7), rgba(255, 255, 255, 0.7))', '100% 2px', '0 56%', 'repeat-x'],
    ['repeating-linear-gradient(90deg, transparent 0 23px, #23408e 23px 30px, transparent 30px 59px, #23408e 59px 84px, transparent 84px 100px)', '100% 20px', '0 84%', 'repeat-x'],
    ['linear-gradient(#ffffff, #ffffff)', '100% 38%', '0 100%', 'no-repeat'],
    ['radial-gradient(ellipse 120% 95% at 50% 0%, #f1f1f4 0%, #c9c9cd 45%, #a9a9b0 62%)', '100% 100%', '0 0', 'no-repeat']
]);
const R2D2_TILE = art([
    ['linear-gradient(#23408e, #23408e)', '100% 28%', '0 50%', 'no-repeat'],
    ['linear-gradient(#ffffff, #ffffff)', '100% 26%', '0 100%', 'no-repeat'],
    ['radial-gradient(ellipse 120% 95% at 50% 0%, #f1f1f4 0%, #c9c9cd 45%, #a9a9b0 62%)', '100% 100%', '0 0', 'no-repeat']
]);
const BOBA_ART = art([
    ['linear-gradient(100deg, transparent 0 30%, rgba(232, 220, 203, 0.18) 30% 34%, transparent 34%)', '64% 10%', '50% 33%', 'no-repeat'],
    ['linear-gradient(#141412, #141412)', '64% 10%', '50% 33%', 'no-repeat'],
    ['linear-gradient(#141412, #141412)', '9% 62%', '50% 100%', 'no-repeat'],
    ['linear-gradient(#5e3424, #5e3424)', '70% 18%', '50% 31%', 'no-repeat'],
    ['linear-gradient(#5e3424, #5e3424)', '15% 60%', '50% 100%', 'no-repeat'],
    ['repeating-linear-gradient(90deg, #b3895c 0 3px, transparent 3px 6px)', '21px 13px', '72% 17%', 'no-repeat'],
    ['linear-gradient(#e8dccb, #e8dccb)', '15px 35px', '9% 36%', 'no-repeat'],
    ['linear-gradient(#85786a, #85786a)', '4px 34%', 'calc(9% + 6px) 0', 'no-repeat'],
    ['linear-gradient(#b3895c, #b3895c)', '8px 23px', 'calc(9% + 4px) 4%', 'no-repeat'],
    ['radial-gradient(circle, rgba(20, 20, 18, 0.55) 0 2px, rgba(232, 220, 203, 0.35) 3px 4px, transparent 4px)', '9px 9px', '24% 14%', 'no-repeat'],
    ['radial-gradient(circle, rgba(20, 20, 18, 0.5) 0 1px, transparent 2px)', '5px 5px', '83% 58%', 'no-repeat'],
    ['radial-gradient(circle, rgba(20, 20, 18, 0.5) 0 1px, transparent 2px)', '5px 5px', '17% 74%', 'no-repeat'],
    ['linear-gradient(160deg, transparent 47%, rgba(232, 220, 203, 0.45) 48% 52%, transparent 53%)', '70px 18px', '20% 52%', 'no-repeat'],
    ['linear-gradient(20deg, transparent 47%, rgba(232, 220, 203, 0.4) 48% 52%, transparent 53%)', '55px 15px', '84% 80%', 'no-repeat'],
    ['linear-gradient(140deg, transparent 46%, rgba(94, 52, 36, 0.6) 47% 53%, transparent 54%)', '45px 20px', '62% 8%', 'no-repeat'],
    ['radial-gradient(ellipse 110% 90% at 38% 6%, #7b8c74 0%, #5d6e5a 45%, #45523f 100%)', '100% 100%', '0 0', 'no-repeat']
]);
const BOBA_TILE = art([
    ['linear-gradient(#141412, #141412)', '72% 16%', '50% 30%', 'no-repeat'],
    ['linear-gradient(#141412, #141412)', '18% 62%', '50% 100%', 'no-repeat'],
    ['radial-gradient(ellipse 110% 90% at 38% 6%, #7b8c74 0%, #5d6e5a 45%, #45523f 100%)', '100% 100%', '0 0', 'no-repeat']
]);
const FJORD_ART = art([
    ['repeating-linear-gradient(0deg, transparent 0 4px, rgba(255, 255, 255, 0.28) 4px 4px)', '100% 22px', '0 100%', 'no-repeat'],
    ['linear-gradient(180deg, #8ea3b0, #a7b9c4)', '100% 22px', '0 100%', 'no-repeat'],
    ['conic-gradient(from 129.6deg at 50% 0, #7d93a1 0 100.9deg, transparent 0)', '230px 95px', '20px calc(100% - 20px)', 'repeat-x'],
    ['linear-gradient(180deg, rgba(232, 238, 241, 0), rgba(232, 238, 241, 0.6) 65%, rgba(232, 238, 241, 0))', '100% 70px', '0 calc(100% - 20px - 60px)', 'no-repeat'],
    ['conic-gradient(from 149.0deg at 50% 0, #9db0bc 0 61.9deg, transparent 0)', '150px 125px', '85px calc(100% - 20px - 30px)', 'repeat-x'],
    ['linear-gradient(180deg, rgba(232, 238, 241, 0), rgba(232, 238, 241, 0.65) 65%, rgba(232, 238, 241, 0))', '100% 80px', '0 calc(100% - 20px - 100px)', 'no-repeat'],
    ['conic-gradient(from 142.6deg at 50% 0, #f3f6f8 0 74.8deg, transparent 0)', '260px 35px', '-60px calc(100% - 20px - 110px - 135px)', 'repeat-x'],
    ['conic-gradient(from 142.6deg at 50% 0, #bac8d1 0 74.8deg, transparent 0)', '260px 170px', '-60px calc(100% - 20px - 110px)', 'repeat-x'],
    ['radial-gradient(circle, rgba(255, 249, 232, 0.95) 0 17px, rgba(255, 249, 232, 0.35) 23px, transparent 55px)', '120px 120px', '80% 12%', 'no-repeat'],
    ['linear-gradient(180deg, #e9eff2 0%, #dfe6ea 55%, #d2dce2 100%)', '100% 100%', '0 0', 'no-repeat']
]);
const FJORD_TILE = art([
    ['linear-gradient(#8ea3b0, #8ea3b0)', '100% 18%', '0 100%', 'no-repeat'],
    ['conic-gradient(from 133.0deg at 50% 0, #7d93a1 0 93.9deg, transparent 0)', '30px 14px', '0 82%', 'no-repeat'],
    ['conic-gradient(from 143.1deg at 50% 0, #bac8d1 0 73.7deg, transparent 0)', '30px 20px', '9px 70%', 'repeat-x'],
    ['linear-gradient(180deg, #e9eff2, #d2dce2)', '100% 100%', '0 0', 'no-repeat']
]);
const LIBRARY_ART = art([
    ['radial-gradient(ellipse 60% 45% at 88% 0%, rgba(255, 190, 110, 0.22), transparent 70%)', '100% 100%', '0 0', 'no-repeat'],
    ['radial-gradient(ellipse at 50% 40%, transparent 55%, rgba(0, 0, 0, 0.35))', '100% 100%', '0 0', 'no-repeat'],
    ['linear-gradient(180deg, #1d2230 0 7px, transparent 7px 59px, #4a3426 59px 65px, #2c2019 65px 68px, #1d2230 68px 75px)', '100% 75px', '0 0', 'repeat'],
    ['linear-gradient(180deg, transparent 0 17px, rgba(224, 164, 88, 0.3) 17px 18px, transparent 18px 46px, rgba(224, 164, 88, 0.24) 46px 48px, transparent 48px)', '100% 75px', '0 0', 'repeat'],
    ['repeating-linear-gradient(90deg, #5a3b3b 1px 9px, #151922 9px 10px, #2f4a47 10px 16px, #151922 16px 18px, #6b5a3d 18px 30px, #151922 30px 30px, #3a3f5e 30px 38px, #151922 38px 39px, #4d2f40 39px 49px, #151922 49px 50px, #6a4a33 50px 56px, #151922 56px 56px, #34505c 56px 70px, #151922 70px 70px, #57513a 70px 78px, #151922 78px 78px, #3f2f2a 78px 88px, #151922 88px 89px, #4a5a3c 89px 100px, #151922 100px 101px, #5e4560 101px 107px, #151922 107px 108px, #2e3b52 108px 116px, #151922 116px 118px, transparent 118px 124px)', '100% 75px', '-48px 75px', 'repeat-x'],
    ['repeating-linear-gradient(90deg, #5a3b3b 1px 9px, #151922 9px 10px, #2f4a47 10px 16px, #151922 16px 18px, #6b5a3d 18px 30px, #151922 30px 30px, #3a3f5e 30px 38px, #151922 38px 39px, #4d2f40 39px 49px, #151922 49px 50px, #6a4a33 50px 56px, #151922 56px 56px, #34505c 56px 70px, #151922 70px 70px, #57513a 70px 78px, #151922 78px 78px, #3f2f2a 78px 88px, #151922 88px 89px, #4a5a3c 89px 100px, #151922 100px 101px, #5e4560 101px 107px, #151922 107px 108px, #2e3b52 108px 116px, #151922 116px 118px, transparent 118px 124px)', '100% 75px', '-90px 225px', 'repeat-x'],
    ['repeating-linear-gradient(90deg, #5a3b3b 1px 9px, #151922 9px 10px, #2f4a47 10px 16px, #151922 16px 18px, #6b5a3d 18px 30px, #151922 30px 30px, #3a3f5e 30px 38px, #151922 38px 39px, #4d2f40 39px 49px, #151922 49px 50px, #6a4a33 50px 56px, #151922 56px 56px, #34505c 56px 70px, #151922 70px 70px, #57513a 70px 78px, #151922 78px 78px, #3f2f2a 78px 88px, #151922 88px 89px, #4a5a3c 89px 100px, #151922 100px 101px, #5e4560 101px 107px, #151922 107px 108px, #2e3b52 108px 116px, #151922 116px 118px, transparent 118px 124px)', '100% 75px', '-26px 375px', 'repeat-x'],
    ['repeating-linear-gradient(90deg, #5a3b3b 1px 9px, #151922 9px 10px, #2f4a47 10px 16px, #151922 16px 18px, #6b5a3d 18px 30px, #151922 30px 30px, #3a3f5e 30px 38px, #151922 38px 39px, #4d2f40 39px 49px, #151922 49px 50px, #6a4a33 50px 56px, #151922 56px 56px, #34505c 56px 70px, #151922 70px 70px, #57513a 70px 78px, #151922 78px 78px, #3f2f2a 78px 88px, #151922 88px 89px, #4a5a3c 89px 100px, #151922 100px 101px, #5e4560 101px 107px, #151922 107px 108px, #2e3b52 108px 116px, #151922 116px 118px, transparent 118px 124px)', '100% 75px', '0 0', 'repeat']
]);
const LIBRARY_TILE = art([
    ['linear-gradient(180deg, #1d2230 0 3px, transparent 3px 12px, #4a3426 12px 15px)', '100% 15px', '0 0', 'repeat'],
    ['repeating-linear-gradient(90deg, #5a3b3b 0 4px, #2f4a47 4px 7px, #6b5a3d 7px 12px, #3a3f5e 12px 15px, #151922 15px 16px)', '100% 15px', '0 0', 'repeat']
]);
const KYLO_VISOR = 'radial-gradient(620px 330px at 50% -90px, transparent calc(45% - 1px), rgba(144, 144, 144, 0.2) 45%, rgba(200, 200, 200, 0.4) calc(45% + 6px), transparent calc(45% + 7px), transparent calc(48% - 1px), rgba(144, 144, 144, 0.2) 48%, rgba(200, 200, 200, 0.4) calc(48% + 6px), transparent calc(48% + 7px), transparent calc(51% - 1px), rgba(144, 144, 144, 0.2) 51%, rgba(200, 200, 200, 0.4) calc(51% + 6px), transparent calc(51% + 7px), transparent calc(54% - 1px), rgba(144, 144, 144, 0.2) 54%, rgba(200, 200, 200, 0.4) calc(54% + 6px), transparent calc(54% + 7px))';

/**
 * Every theme (grouped by `collection`): `bg`/`card`/`text`/`sub`/`border`/`shadow` mirror the theme's
 * --bg-primary/--bg-secondary/--text-primary/--text-secondary/--border-color/
 * --shadow-color; `btnBg`/`btnText` its primary button; `img`/`size`/`pos` its
 * body background artwork (`tileImg` is a simplified version for tiny swatches,
 * or `tile` a full { img, size, pos, repeat } set for artwork made of shapes).
 */
export const THEMES = [
    { id: 'light', name: 'Light', collection: 'monochrome', bg: '#ffffff', card: '#ffffff', text: '#000000', sub: '#666666', border: '#000000', shadow: '#000000', btnBg: '#000000', btnText: '#ffffff',
        pattern: 'Checker', img: CHECKER('rgba(0, 0, 0, 0.05)'), size: '20px 20px', pos: '0 0, 10px 10px' },
    { id: 'dark', name: 'Dark', collection: 'monochrome', bg: '#121212', card: '#1e1e1e', text: '#e5e5e5', sub: '#a0a0a0', border: '#404040', shadow: '#000000', btnBg: '#e5e5e5', btnText: '#121212',
        pattern: 'Checker', img: CHECKER('rgba(64, 64, 64, 0.08)'), size: '20px 20px', pos: '0 0, 10px 10px' },
    { id: 'autumn', name: 'Autumn', collection: 'cozy', bg: '#c25e29', card: '#f4ebd8', text: '#2d1b0f', sub: '#5c3924', border: '#2d1b0f', shadow: '#2d1b0f', btnBg: '#2d1b0f', btnText: '#f4ebd8',
        pattern: 'Plaid', img: 'repeating-linear-gradient(90deg, transparent, transparent 40px, rgba(45, 27, 15, 0.1) 40px, rgba(45, 27, 15, 0.1) 80px), repeating-linear-gradient(180deg, transparent, transparent 40px, rgba(45, 27, 15, 0.1) 40px, rgba(45, 27, 15, 0.1) 80px)' },
    { id: 'terminal', name: 'Terminal', collection: 'retro', bg: '#0a0a0a', card: '#111111', text: '#4ade80', sub: '#22c55e', border: '#22c55e', shadow: '#166534', btnBg: '#4ade80', btnText: '#0a0a0a',
        pattern: 'Checker', img: CHECKER('rgba(34, 197, 94, 0.06)'), size: '20px 20px', pos: '0 0, 10px 10px' },
    { id: 'vaporwave', name: 'Vaporwave', collection: 'retro', bg: '#ff71ce', card: '#01cdfe', text: '#000000', sub: '#ffffff', border: '#000000', shadow: '#b967ff', btnBg: '#b967ff', btnText: '#ffffff',
        pattern: 'Grid', img: 'linear-gradient(rgba(255, 255, 255, 0.4) 2px, transparent 2px), linear-gradient(90deg, rgba(255, 255, 255, 0.4) 2px, transparent 2px)', size: '30px 30px' },
    { id: 'blueprint', name: 'Blueprint', collection: 'paper', bg: '#0a3d91', card: '#ffffff', text: '#0a3d91', sub: '#062a66', border: '#000000', shadow: '#000000', btnBg: '#0a3d91', btnText: '#ffffff',
        pattern: 'Drafting grid', img: 'linear-gradient(rgba(255, 255, 255, 0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.3) 1px, transparent 1px), linear-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.1) 1px, transparent 1px)', size: '40px 40px, 40px 40px, 10px 10px, 10px 10px' },
    { id: 'neopop', name: 'Neo-Pop', collection: 'paper', bg: '#a7f3d0', card: '#fbcfe8', text: '#000000', sub: '#333333', border: '#000000', shadow: '#000000', btnBg: '#000000', btnText: '#a7f3d0',
        pattern: 'Halftone', img: 'radial-gradient(#000000 15%, transparent 15%)', size: '20px 20px' },
    { id: 'composition', name: 'Composition', collection: 'paper', bg: '#fdf6e3', card: '#ffffff', text: '#000000', sub: '#444444', border: '#000000', shadow: '#000000', btnBg: '#000000', btnText: '#ffffff',
        pattern: 'Notebook paper', img: 'linear-gradient(90deg, transparent 40px, #ff4d6d 40px, #ff4d6d 43px, transparent 43px), repeating-linear-gradient(0deg, transparent, transparent 27px, #3b82f6 27px, #3b82f6 29px)' },
    { id: 'dracula', name: 'Dracula', collection: 'retro', bg: '#15161e', card: '#282a36', text: '#f8f8f2', sub: '#bd93f9', border: '#ff5555', shadow: '#000000', btnBg: '#ff5555', btnText: '#ffffff',
        pattern: 'Solid', img: 'none' },
    { id: 'earthy', name: 'Earthy', collection: 'cozy', bg: '#3b5240', card: '#e0d5c1', text: '#1f140c', sub: '#4a3626', border: '#1f140c', shadow: '#1f140c', btnBg: '#1f140c', btnText: '#e0d5c1',
        pattern: 'Ripples', img: 'repeating-radial-gradient(circle at 0 0, transparent, transparent 40px, rgba(31, 20, 12, 0.1) 40px, rgba(31, 20, 12, 0.1) 42px)' },
    { id: 'space', name: 'Space', collection: 'celestial', bg: '#04050a', card: '#101423', text: '#e2e8f0', sub: '#8b99af', border: '#00f0ff', shadow: '#00f0ff', btnBg: '#00f0ff', btnText: '#04050a',
        pattern: 'Starfield', img: 'radial-gradient(white, rgba(255, 255, 255, 0.2) 2px, transparent 4px), radial-gradient(white, rgba(255, 255, 255, 0.15) 1px, transparent 3px), radial-gradient(white, rgba(255, 255, 255, 0.1) 2px, transparent 4px), radial-gradient(rgba(255, 255, 255, 0.4), rgba(255, 255, 255, 0.1) 2px, transparent 3px)', size: '50px 50px, 40px 40px, 30px 30px, 60px 60px', pos: '0 0, 20px 20px, 15px 5px, 35px 25px' },
    { id: 'moon', name: 'Moon', collection: 'celestial', bg: '#8a8d91', card: '#ffffff', text: '#000000', sub: '#333333', border: '#000000', shadow: '#000000', btnBg: '#000000', btnText: '#ffffff',
        pattern: 'Craters', img: 'radial-gradient(rgba(0, 0, 0, 0.15) 2px, transparent 2px)', size: '20px 20px' },
    { id: 'cabin', name: 'Cozy Cabin', collection: 'cozy', bg: '#382215', card: '#e6cda3', text: '#211204', sub: '#4a2c16', border: '#1a0f09', shadow: '#1a0f09', btnBg: '#8a2522', btnText: '#ffffff',
        pattern: 'Log walls', img: 'repeating-linear-gradient(180deg, #382215, #382215 38px, #1a0f09 38px, #1a0f09 42px)' },
    { id: 'matcha', name: 'Matcha', collection: 'cafe', bg: '#d1deb9', card: '#fcf9f2', text: '#2c3d25', sub: '#4c6b41', border: '#2c3d25', shadow: '#2c3d25', btnBg: '#2c3d25', btnText: '#ffffff',
        pattern: 'Diagonal stripes', img: 'repeating-linear-gradient(45deg, rgba(255, 255, 255, 0.5), rgba(255, 255, 255, 0.5) 2px, transparent 2px, transparent 12px)' },
    { id: 'tatooine', name: 'Tatooine', collection: 'starwars', bg: '#e6c280', card: '#f4dca6', text: '#3d2314', sub: '#6e3d22', border: '#3d2314', shadow: '#8c4a22', btnBg: '#8c4a22', btnText: '#f4dca6',
        pattern: 'Twin suns', img: 'radial-gradient(circle at 80% 20%, rgba(255, 165, 0, 0.4) 10px, transparent 40px), radial-gradient(circle at 65% 15%, rgba(255, 69, 0, 0.5) 15px, transparent 50px)' },
    { id: 'kylo', name: 'Kylo', collection: 'starwars', bg: '#000000', card: '#120202', text: '#909090', sub: '#ea1c1c', border: '#3f1b1b', shadow: '#120202', btnBg: '#3f1b1b', btnText: '#909090',
        pattern: 'Kintsugi + chrome', img: `${KYLO_CRACKS}, ${KYLO_VISOR}`, tileImg: KYLO_CRACKS },
    { id: 'r2d2', name: 'R2-D2', collection: 'starwars', bg: '#c0c0c0', card: '#ffffff', text: '#23408e', sub: '#4b4f63', border: '#23408e', shadow: '#0e1d4d', btnBg: '#23408e', btnText: '#ffffff',
        pattern: 'Astromech dome', ...R2D2_ART, tile: R2D2_TILE },
    { id: 'boba', name: 'Boba Fett', collection: 'starwars', bg: '#5d6e5a', card: '#e8dccb', text: '#5e3424', sub: '#6e6255', border: '#5e3424', shadow: '#2f1a12', btnBg: '#5e3424', btnText: '#e8dccb',
        pattern: 'Mandalorian helmet', ...BOBA_ART, tile: BOBA_TILE },
    { id: 'fjord', name: 'Fjord', collection: 'landscapes', bg: '#dfe6ea', card: '#f8fafb', text: '#2b3a44', sub: '#5b6d79', border: '#2b3a44', shadow: '#7d93a1', btnBg: '#2b3a44', btnText: '#f8fafb',
        pattern: 'Misty mountains', ...FJORD_ART, tile: FJORD_TILE },
    { id: 'storm', name: 'Storm', collection: 'landscapes', animated: true, scene: 'storm', bg: '#1a1424', card: '#241d2c', text: '#ece4f2', sub: '#b3a6c4', border: '#4a3d5a', shadow: '#0d0a12', btnBg: '#d99a3e', btnText: '#1a1020',
        pattern: 'Animated storm', img: 'url("images/storm-still.svg")', size: 'cover', pos: 'center bottom', repeat: 'no-repeat' },
    { id: 'library', name: 'Night Library', collection: 'cozy', bg: '#1d2230', card: '#272d3f', text: '#ece4d4', sub: '#b3a68d', border: '#4b5470', shadow: '#0f121b', btnBg: '#e0a458', btnText: '#1d2230',
        pattern: 'Bookshelves', ...LIBRARY_ART, tile: LIBRARY_TILE },
    { id: 'campfire', name: 'Campfire', collection: 'cozy', animated: true, scene: 'campfire', bg: '#080a10', card: '#1c1512', text: '#f3e3cf', sub: '#c79a76', border: '#5a3a24', shadow: '#050302', btnBg: '#ff8a2b', btnText: '#1a0d05',
        pattern: 'Animated campfire', img: 'url("images/campfire-scene.svg")', size: 'cover', pos: 'center bottom', repeat: 'no-repeat' },
    { id: 'strawberry', name: 'Strawberry', collection: 'cafe', bg: '#FA2A28', card: '#FEC0A9', text: '#B60D17', sub: '#336B26', border: '#B60D17', shadow: '#B60D17', btnBg: '#C9CF56', btnText: '#336B26',
        pattern: 'Seeds', img: 'radial-gradient(ellipse at center, #C9CF56 3px, transparent 4px), radial-gradient(ellipse at center, #C9CF56 3px, transparent 4px)', size: '60px 80px', pos: '0 0, 30px 40px' }
].map((t) => ({ size: 'auto', pos: '0 0', repeat: 'repeat', tileImg: t.img, ...t }));

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
    const artwork = tile && theme.tile ? theme.tile : { ...theme, img: tile ? theme.tileImg : theme.img };
    el.style.backgroundColor = theme.bg;
    el.style.backgroundImage = artwork.img;
    el.style.backgroundSize = artwork.size;
    el.style.backgroundPosition = artwork.pos;
    el.style.backgroundRepeat = artwork.repeat;
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


// ─── Animated scenes ─────────────────────────────────────────────────
// Animated themes overlay a small DOM scene on top of their static background art.
// Only transform/opacity are animated (see .scene in style.css), so the browser
// runs them on the compositor: steady frame rate, no work on the main thread.
const FLAMES = [
    // [class, path, gradient]  back to front: outer tongues, main flame, inner flame, core
    ['t-left', 'M30 170 C10 160 4 134 14 112 C20 98 31 92 30 72 C30 60 34 52 38 44 C43 64 53 76 53 98 C53 108 48 116 52 128 C56 146 46 166 30 170Z', 'out'],
    ['t-right', 'M70 170 C90 160 96 134 86 112 C80 98 69 92 70 72 C70 60 66 52 62 44 C57 64 47 76 47 98 C47 108 52 116 48 128 C44 146 54 166 70 170Z', 'out'],
    ['t-main', 'M50 170 C22 164 8 132 20 100 C27 80 40 68 38 40 C37 26 44 12 50 2 C54 22 66 34 68 54 C69 66 64 72 70 82 C80 98 90 130 78 152 C72 164 62 170 50 170Z', 'main'],
    ['t-inner', 'M50 170 C34 164 28 146 36 126 C40 114 48 108 47 90 C46 80 49 72 50 62 C55 78 64 88 66 104 C68 118 66 128 64 140 C62 156 60 166 50 170Z', 'mid'],
    ['t-core', 'M50 170 C40 166 37 154 42 142 C45 134 49 130 48 118 C48 112 50 108 50 102 C53 112 59 118 60 128 C61 138 60 148 58 156 C56 164 54 168 50 170Z', 'core']
];
const ROCK_SEEDS = [ // [x, y, rx, ry, back?] in the pit's 260x110 space
    [62, 66, 15, 8.5, 1], [88, 60, 13, 7.5, 1], [130, 57, 14, 8, 1], [172, 60, 13, 7.5, 1], [198, 66, 15, 8.5, 1],
    [46, 80, 14, 9, 0], [72, 91, 16, 10, 0], [104, 98, 14, 8.5, 0], [150, 98, 15, 9, 0], [186, 91, 16, 10, 0], [214, 80, 14, 9, 0]
];

let sceneCount = 0;
const createStormScene = () => {
    const scene = document.createElement('div');
    scene.className = 'scene scene-storm';
    scene.setAttribute('aria-hidden', 'true');
    scene.innerHTML = `
        <div class="st-sky"></div>
        <div class="st-drift"><div class="st-drift-inner"></div></div>
        <div class="st-sheet"></div>
        <div class="st-bolt st-bolt-a"></div>
        <div class="st-bolt st-bolt-b"></div>
        <div class="st-land"></div>
        <div class="st-wash"></div>
        <div class="st-rain-mask"><div class="st-rain st-rain-1"></div><div class="st-rain st-rain-2"></div></div>
        <div class="st-grass"></div>`;
    return scene;
};

export const createScene = (kind) => {
    if (kind === 'storm') return createStormScene();
    if (kind !== 'campfire') return null;
    const n = ++sceneCount; // unique ids: a scene can be on screen twice (page + library preview)
    const rock = ([x, y, rx, ry], i) => {
        const lit = x < 130 ? 0.9 : 0.1; // the side facing the fire catches its light
        return `<radialGradient id="rk${n}-${i}" cx="${lit}" cy="0.35" r="0.85"><stop offset="0" stop-color="#c4682c"/><stop offset=".28" stop-color="#4a3626"/><stop offset=".7" stop-color="#1e1814"/><stop offset="1" stop-color="#0d0a09"/></radialGradient>
            <ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="url(#rk${n}-${i})"/>
            <ellipse cx="${x}" cy="${y + ry * 0.55}" rx="${rx * 0.95}" ry="${ry * 0.4}" fill="#000" opacity=".25"/>`;
    };
    const rocks = (back) => ROCK_SEEDS.map((r, i) => (r[4] === back ? rock(r, i) : '')).join('');
    const logPaint = `<linearGradient id="lg${n}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5a3c26"/><stop offset=".45" stop-color="#2d1c12"/><stop offset="1" stop-color="#120a06"/></linearGradient>
        <linearGradient id="lc${n}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff9a2a" stop-opacity="0"/><stop offset="1" stop-color="#ff7a1a" stop-opacity=".75"/></linearGradient>`;
    const log = (cx, cy, len, thick, rot) => `<g transform="rotate(${rot} ${cx} ${cy})">
        <rect x="${cx - len / 2}" y="${cy - thick / 2}" width="${len}" height="${thick}" rx="${thick / 2}" fill="url(#lg${n})"/>
        <rect x="${cx - len / 2 + 4}" y="${cy + thick * 0.12}" width="${len - 8}" height="${thick * 0.36}" rx="${thick * 0.18}" fill="url(#lc${n})"/>
        <path d="M${cx - len / 2 + 8} ${cy - thick * 0.22} H${cx + len / 2 - 10} M${cx - len / 2 + 16} ${cy + thick * 0.02} H${cx + len / 2 - 6} M${cx - len / 2 + 6} ${cx ? cy - thick * 0.38 : 0} H${cx + len / 2 - 20}" stroke="#0c0604" stroke-width=".9" opacity=".55" fill="none"/>
        <ellipse cx="${cx + len / 2 - 2}" cy="${cy}" rx="${thick * 0.3}" ry="${thick * 0.48}" fill="#4a2f1c"/>
        <ellipse cx="${cx + len / 2 - 2}" cy="${cy}" rx="${thick * 0.14}" ry="${thick * 0.26}" fill="none" stroke="#2a180d" stroke-width=".8"/>
    </g>`;
    const flames = FLAMES.map(([cls, d, g]) =>
        `<svg class="flame ${cls}" viewBox="0 0 100 170" preserveAspectRatio="none" aria-hidden="true"><path d="${d}" fill="url(#fg-${g}-${n})" filter="url(#fb-${n})"/></svg>`).join('');
    const embers = Array.from({ length: 8 }, (_, i) =>
        `<i class="ember" style="--x:${[-14, 6, -4, 16, -9, 10, 0, -18][i]}cqmin;--dx:${[-5, 4, -2, 6, -6, 3, -3, 5][i]}cqmin;--d:${[6.5, 8, 7, 9, 7.5, 8.5, 6, 9.5][i]}s;--delay:-${[0, 2.2, 4.1, 5.5, 1.3, 3.4, 6.2, 7.7][i]}s"></i>`).join('');
    const scene = document.createElement('div');
    scene.className = 'scene scene-campfire';
    scene.setAttribute('aria-hidden', 'true');
    scene.innerHTML = `
        <svg width="0" height="0" style="position:absolute"><defs>
            <filter id="fb-${n}" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="1.3"/></filter>
            <linearGradient id="fg-out-${n}" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#e2561b" stop-opacity=".95"/><stop offset=".6" stop-color="#b8330f" stop-opacity=".7"/><stop offset="1" stop-color="#8a2208" stop-opacity="0"/></linearGradient>
            <linearGradient id="fg-main-${n}" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ff8a24" stop-opacity=".95"/><stop offset=".55" stop-color="#ef6a1c" stop-opacity=".85"/><stop offset="1" stop-color="#c8401a" stop-opacity="0"/></linearGradient>
            <linearGradient id="fg-mid-${n}" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ffd25a"/><stop offset=".5" stop-color="#ffa63a" stop-opacity=".9"/><stop offset="1" stop-color="#ff8a24" stop-opacity="0"/></linearGradient>
            <linearGradient id="fg-core-${n}" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#fff6d4"/><stop offset=".55" stop-color="#ffe49a" stop-opacity=".9"/><stop offset="1" stop-color="#ffd25a" stop-opacity="0"/></linearGradient>
        </defs></svg>
        <div class="fire">
            <div class="fire-glow"></div>
            <svg class="pit pit-back" viewBox="0 0 260 110" aria-hidden="true"><defs>${logPaint}</defs>
                <ellipse cx="130" cy="72" rx="62" ry="10" fill="#3a1408"/><ellipse cx="130" cy="72" rx="46" ry="6" fill="#ff6a1a" opacity=".5" filter="url(#fb-${n})"/>
                ${rocks(1)}${log(112, 66, 104, 15, -21)}${log(150, 66, 104, 15, 20)}
            </svg>
            <div class="flames">${flames}</div>
            <svg class="pit pit-front" viewBox="0 0 260 110" aria-hidden="true">
                ${log(128, 78, 118, 17, 6)}${rocks(0)}
            </svg>
            <div class="fire-core-glow"></div>
            <i class="smoke s1"></i><i class="smoke s2"></i><i class="smoke s3"></i>
            ${embers}
        </div>`;
    return scene;
};

const syncScene = (id) => {
    document.querySelectorAll('body > .scene').forEach((n) => n.remove());
    const scene = createScene(THEMES.find((t) => t.id === id)?.scene);
    if (scene) document.body.prepend(scene);
};

const setBodyThemeClass = (id) => {
    document.body.classList.remove('dark-mode', ...THEMES.map((t) => `theme-${t.id}`));
    if (id !== 'light') document.body.classList.add(`theme-${id}`);
    syncScene(id);
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
    reconcileFavoritesMirror().catch(console.error);
};

// ─── Favorites (ordered; the quick menu lists them in this order) ───
// Favorites live in localStorage for fast synchronous reads, mirrored into the
// env.js storage layer (chrome.storage in the extension) so the background
// worker can include them in the Google Drive backup.

const cleanFavorites = (ids) => (Array.isArray(ids) ? ids : [])
    .filter((id, i, all) => THEMES.some((t) => t.id === id) && all.indexOf(id) === i);

const readLocalFavorites = () => {
    try {
        const ids = JSON.parse(localStorage.getItem(FAVORITES_KEY));
        return Array.isArray(ids) ? ids : null;
    } catch {
        return null;
    }
};

/** Favorites as included in the Drive backup (undefined if never customized). */
export const getSyncedFavorites = async () => {
    const ids = (await storage.get([FAVORITES_KEY]))[FAVORITES_KEY];
    return Array.isArray(ids) ? cleanFavorites(ids) : undefined;
};

/** Applies favorites from a Drive backup without marking local data as changed. */
export const restoreFavorites = async (ids) => {
    const clean = cleanFavorites(ids);
    await storage.set({ [FAVORITES_KEY]: clean });
    if (typeof localStorage !== 'undefined') localStorage.setItem(FAVORITES_KEY, JSON.stringify(clean));
    globalThis.dispatchEvent?.(new Event('retention:favoriteschange'));
};

// Favorites saved before Drive sync existed live only in localStorage: copy them
// into shared storage once (or the reverse after a restore in another context)
const reconcileFavoritesMirror = async () => {
    const local = readLocalFavorites();
    const synced = (await storage.get([FAVORITES_KEY]))[FAVORITES_KEY];
    if (local && !Array.isArray(synced)) {
        await storage.set({ [FAVORITES_KEY]: cleanFavorites(local) });
    } else if (!local && Array.isArray(synced)) {
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(cleanFavorites(synced)));
        window.dispatchEvent(new Event('retention:favoriteschange'));
    }
};

export const getFavorites = () => {
    // First run: start with Light and Dark plus whatever theme is in use
    return cleanFavorites(readLocalFavorites() || ['light', 'dark', getActiveThemeId()]);
};

export const setFavorites = (ids) => {
    const clean = cleanFavorites(ids);
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(clean));
    storage.set({ [FAVORITES_KEY]: clean });
    markDbDirty(); // favorites sync through the Google Drive backup
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
