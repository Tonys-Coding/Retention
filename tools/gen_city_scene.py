# Generates the "City Lights" theme art (SVG sources in tools/art/city-*.svg). Run from the repo root:
#   python3 tools/gen_city_scene.py && node tools/rasterize_scenes.mjs
# All layers share one 1600x900 canvas (anchored bottom-center, "cover") so they line up in the app.
import random, math, re
W, H = 1600, 900
GROUND = 760          # waterfront line; water below
R = random.Random(21)

def svg(body, defs=''):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMax slice"><defs>{defs}</defs>{body}</svg>'

WARM = ['#ffd98a', '#ffcf7a', '#ffb25a', '#fff0cf', '#ffe3a8', '#ffa94d']
COOL = ['#cfe3ff', '#a9d0ff', '#ffffff']

# ── Buildings ────────────────────────────────────────────────────────
# (x, width, height, windows lit probability, style)
BUILDINGS = [
    (0, 70, 190, .5, 'plain'), (62, 95, 150, .6, 'warm'), (150, 62, 232, .55, 'plain'),
    (205, 91, 430, 0, 'lattice'),
    (300, 62, 200, .55, 'plain'), (366, 78, 372, .72, 'bright'), (440, 58, 268, .7, 'bright'),
    (496, 54, 150, .5, 'plain'), (534, 108, 175, 0, 'xtower'), (640, 40, 200, 0, 'led'), (684, 50, 130, .6, 'dome'),
    (738, 62, 172, .62, 'plain'), (800, 74, 150, .7, 'bright'), (878, 92, 232, .78, 'bright'),
    (966, 62, 150, .55, 'plain'), (1024, 70, 246, .62, 'plain'), (1090, 84, 190, .5, 'plain'),
    (1178, 108, 674, 0, 'ifc'),
    (1292, 70, 178, .45, 'plain'), (1356, 74, 220, .5, 'plain'), (1378, 92, 280, .42, 'plain'),
    (1476, 84, 417, 0, 'pink'), (1552, 52, 260, .55, 'plain'),
]

def windows_for(b, lit_p, cell=(7, 9), pal=None, dim=1.0):
    x, w, h, = b[0], b[1], b[2]
    top = GROUND - h
    out = []
    for yy in range(int(top) + 8, GROUND - 6, cell[1] + 1):
        for xx in range(int(x) + 5, int(x + w) - 7, cell[0] + 2):
            if R.random() < lit_p:
                col = R.choice(pal or (WARM if R.random() < .88 else COOL))
                out.append((xx, yy, cell[0] - 1, cell[1] - 2, col, R.uniform(.55, 1) * dim))
    return out

def build_city():
    """Returns (svg group markup for the whole skyline, list of lit windows)."""
    parts, wins = [], []
    # hillside behind the city with road lights and tiny lit blocks
    hr = random.Random(5)
    ridge = [(0, 420)]
    y = 420
    for xx in range(60, W + 80, 60):
        y += hr.uniform(-26, 24); y = max(340, min(520, y)); ridge.append((xx, y))
    parts.append(f'<polygon points="{" ".join(f"{a},{b:.0f}" for a, b in ridge)} {W+80},{GROUND} 0,{GROUND}" fill="#0d0b0c"/>')
    for _ in range(900):
        x = hr.uniform(0, W); top = next((yy for xx, yy in ridge if xx >= x), 440)
        yy = hr.uniform(top + 6, GROUND - 60)
        s = hr.choice([1.2, 1.6, 2, 2.6])
        col = hr.choice(WARM + ['#ff8a3a', '#ffe9c0'])
        parts.append(f'<rect x="{x:.0f}" y="{yy:.0f}" width="{s*1.6:.1f}" height="{s:.1f}" fill="{col}" opacity="{hr.uniform(.25,.85):.2f}"/>')
    for k in range(10):  # winding road lights
        x0, y0 = hr.uniform(0, W), hr.uniform(430, 600)
        for t in range(26):
            parts.append(f'<circle cx="{x0 + t*hr.uniform(5,9) + math.sin(t/3)*8:.0f}" cy="{y0 + t*hr.uniform(1.5,4):.0f}" r="1.4" fill="#ffb25a" opacity=".7"/>')
    for b in BUILDINGS:
        x, w, h, p, style = b
        top = GROUND - h
        base = '#16110f' if style != 'ifc' else '#0f0d0e'
        parts.append(f'<rect x="{x}" y="{top}" width="{w}" height="{h}" fill="{base}"/>')
        parts.append(f'<rect x="{x}" y="{top}" width="{w}" height="{h}" fill="url(#bshade)" opacity=".7"/>')
        if style in ('plain', 'warm', 'bright', 'dome'):
            wl = windows_for(b, p, dim=1.0)
            wins += wl
            if style == 'dome':
                parts.append(f'<path d="M{x+w*.2:.0f} {top} q{w*.3:.0f} -{w*.5:.0f} {w*.6:.0f} 0z" fill="#ffb25a"/>')
        elif style == 'ifc':
            wl = []
            for col in range(0, int(w) - 10, 6):  # dense vertical window columns
                for yy in range(int(top) + 50, GROUND - 6, 11):
                    if R.random() < .74:
                        c = R.choice(WARM[:4]); wl.append((x + 5 + col, yy, 4, 7, c, R.uniform(.6, 1)))
            wins += wl
            parts.append(f'<ellipse cx="{x+w/2}" cy="{top+16}" rx="{w*.8:.0f}" ry="40" fill="#ffe9b0" opacity=".16" filter="url(#halo)"/>')
            parts.append(f'<path d="M{x} {top+46} Q{x} {top} {x+w/2} {top} Q{x+w} {top} {x+w} {top+46}Z" fill="#ffe9b8"/>')
            parts.append(f'<path d="M{x+7} {top+44} Q{x+7} {top+9} {x+w/2} {top+9} Q{x+w-7} {top+9} {x+w-7} {top+44}Z" fill="#fffdf2" opacity=".92"/>')
            for i in range(1, 6):
                parts.append(f'<line x1="{x+4}" y1="{top+55+i*16}" x2="{x+w-4}" y2="{top+55+i*16}" stroke="#fff3cf" stroke-width="2" opacity=".55"/>')
        elif style == 'lattice':
            n = 6
            for i in range(n):
                y0 = top + i * h / n; y1 = top + (i + 1) * h / n
                parts.append(f'<line x1="{x+4}" y1="{y0:.0f}" x2="{x+w-4}" y2="{y1:.0f}" stroke="#eaf6ff" stroke-width="3" opacity=".95"/>')
                parts.append(f'<line x1="{x+w-4}" y1="{y0:.0f}" x2="{x+4}" y2="{y1:.0f}" stroke="#eaf6ff" stroke-width="3" opacity=".95"/>')
                parts.append(f'<line x1="{x+4}" y1="{y1:.0f}" x2="{x+w-4}" y2="{y1:.0f}" stroke="#eaf6ff" stroke-width="2" opacity=".7"/>')
            parts.append(f'<line x1="{x+4}" y1="{top}" x2="{x+4}" y2="{GROUND}" stroke="#fff" stroke-width="3.5"/><line x1="{x+w-4}" y1="{top}" x2="{x+w-4}" y2="{GROUND}" stroke="#fff" stroke-width="3.5"/>')
            parts.append(f'<line x1="{x+22}" y1="{top}" x2="{x+22}" y2="{top-72}" stroke="#d7e6f2" stroke-width="2.4"/><line x1="{x+w-24}" y1="{top}" x2="{x+w-24}" y2="{top-64}" stroke="#d7e6f2" stroke-width="2.4"/>')
            parts.append(f'<rect x="{x+10}" y="{GROUND-70}" width="{w-20}" height="64" fill="#ffd98a" opacity=".8"/>')
        elif style == 'xtower':
            for i in range(5):
                yy = top + i * h / 5
                parts.append(f'<line x1="{x+6}" y1="{yy:.0f}" x2="{x+w-6}" y2="{yy+h/5:.0f}" stroke="#ff5a5a" stroke-width="3" opacity=".9"/><line x1="{x+w-6}" y1="{yy:.0f}" x2="{x+6}" y2="{yy+h/5:.0f}" stroke="#f4f4ff" stroke-width="3" opacity=".9"/>')
            parts.append(f'<rect x="{x+8}" y="{GROUND-62}" width="{w*.5:.0f}" height="56" fill="#b25cff" opacity=".9"/><rect x="{x+w*.55:.0f}" y="{GROUND-110}" width="{w*.4:.0f}" height="104" fill="#ffc86a" opacity=".55"/>')
        elif style == 'led':
            for i in range(0, int(w), 6):
                parts.append(f'<rect x="{x+i+2}" y="{top+8}" width="3.5" height="{h-16}" fill="{"#5ac8ff" if (i//6)%2 else "#e8f6ff"}" opacity=".95"/>')
        elif style == 'pink':
            for i in range(0, int(w) - 6, 8):
                col = '#ff8ac4' if (i // 8) % 2 else '#7a4ad8'
                parts.append(f'<rect x="{x+4+i}" y="{top+30}" width="5" height="{h-36}" fill="{col}" opacity=".95"/>')
            parts.append(f'<polygon points="{x+w/2-14},{top+30} {x+w/2},{top-26} {x+w/2+14},{top+30}" fill="#ffd0ee"/><rect x="{x+10}" y="{top+30}" width="{w-20}" height="10" fill="#fff0fa"/>')
            parts.append(f'<line x1="{x+w/2}" y1="{top-26}" x2="{x+w/2}" y2="{top-60}" stroke="#ffd0ee" stroke-width="2"/>')
            wins += [(x + 8 + i * 9, top + 60 + j * 22, 3, 8, '#fff0fa', .8) for i in range(8) for j in range(0, int(h / 22) - 2) if R.random() < .4]
    # promenade: low glowing buildings and the bright orange waterfront line
    for xx in range(0, W, 38):
        hh = R.randint(16, 40)
        parts.append(f'<rect x="{xx}" y="{GROUND-hh}" width="{R.randint(26,40)}" height="{hh}" fill="#1b130e"/>')
        parts.append(f'<rect x="{xx+3}" y="{GROUND-hh+4}" width="{R.randint(16,30)}" height="3" fill="{R.choice(WARM)}" opacity=".85"/>')
    parts.append(f'<rect x="0" y="{GROUND-5}" width="{W}" height="6" fill="#ff7a22"/><rect x="0" y="{GROUND-3}" width="{W}" height="2.4" fill="#ffd27a"/>')
    return ''.join(parts), wins

GRAD = '''<linearGradient id="bshade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".5"/><stop offset=".5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></linearGradient>'''

def win_rects(wins, scale_a=1.0):
    return ''.join(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{c}" opacity="{a*scale_a:.2f}"/>' for x, y, w, h, c, a in wins)

CITY, WINS = build_city()
# split lit windows into two groups that will "breathe" out of phase
GROUP_A = [w for i, w in enumerate(WINS) if i % 5 == 0]
GROUP_B = [w for i, w in enumerate(WINS) if i % 5 == 1]
HALO = '<filter id="halo" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="2.2"/></filter>'

def skyline_svg():
    glow = f'<linearGradient id="baseglow" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ff7a22" stop-opacity=".45"/><stop offset=".25" stop-color="#ff7a22" stop-opacity=".12"/><stop offset="1" stop-color="#ff7a22" stop-opacity="0"/></linearGradient>'
    body = f'<g id="city">{CITY}{win_rects(WINS, .78)}</g>'
    body += f'<rect x="0" y="{GROUND-260}" width="{W}" height="262" fill="url(#baseglow)"/>'
    # soft halos on the brightest facades
    body += f'<g filter="url(#halo)" opacity=".5">{win_rects([w for w in WINS if w[4] in WARM[:4]][::6], 1)}</g>'
    return svg(body, GRAD + glow + HALO)

def lights_svg(group):
    return svg(f'<g filter="url(#halo)">{win_rects(group, 1)}</g>{win_rects(group, .95)}', HALO)

def sky_svg():
    defs = f'''<linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#050507"/><stop offset=".5" stop-color="#101016"/><stop offset=".78" stop-color="#2a1a18"/><stop offset="1" stop-color="#43241a"/></linearGradient>
<filter id="cl" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".0034 .0085" numOctaves="5" seed="14"/><feColorMatrix type="matrix" values="0 0 0 0 .13  0 0 0 0 .13  0 0 0 0 .16  2.6 0 0 0 -1.02"/></filter>
<filter id="cl2" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".0028 .02" numOctaves="4" seed="3"/><feColorMatrix type="matrix" values="0 0 0 0 .36  0 0 0 0 .3  0 0 0 0 .3  2.2 0 0 0 -1.12"/></filter>
<linearGradient id="mtop" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".7" stop-color="#fff" stop-opacity=".8"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<mask id="mk"><rect width="{W}" height="{GROUND}" fill="url(#mtop)"/></mask>
<radialGradient id="cityglow" cx=".5" cy="1" r=".7"><stop offset="0" stop-color="#ff7a3a" stop-opacity=".42"/><stop offset=".6" stop-color="#a33a1a" stop-opacity=".12"/><stop offset="1" stop-color="#a33a1a" stop-opacity="0"/></radialGradient>'''
    body = f'<rect width="{W}" height="{H}" fill="url(#sg)"/><rect width="{W}" height="{GROUND}" filter="url(#cl)" mask="url(#mk)"/><rect width="{W}" height="{GROUND}" filter="url(#cl2)" mask="url(#mk)" opacity=".12"/><ellipse cx="800" cy="{GROUND}" rx="1000" ry="420" fill="url(#cityglow)"/>'
    return svg(body, defs)

def wisps_svg():
    defs = f'''<filter id="wf" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".0032 .011" numOctaves="4" seed="9" stitchTiles="stitch"/><feColorMatrix type="matrix" values="0 0 0 0 .36  0 0 0 0 .33  0 0 0 0 .34  2.2 0 0 0 -1.0"/></filter>
<linearGradient id="wm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".2" stop-color="#fff"/><stop offset=".55" stop-color="#fff" stop-opacity=".7"/><stop offset=".9" stop-color="#fff" stop-opacity="0"/></linearGradient>
<mask id="wmk"><rect width="{W}" height="{H}" fill="url(#wm)"/></mask>'''
    return svg(f'<rect width="{W}" height="{H}" filter="url(#wf)" mask="url(#wmk)"/>', defs)

def water_svg():
    defs = f'''<linearGradient id="wg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1a1410"/><stop offset=".15" stop-color="#0e1218"/><stop offset="1" stop-color="#040608"/></linearGradient>
<filter id="refl" x="-5%" y="-5%" width="110%" height="120%"><feTurbulence type="fractalNoise" baseFrequency=".004 .09" numOctaves="2" seed="6" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="26" xChannelSelector="R" yChannelSelector="G" result="d"/><feGaussianBlur in="d" stdDeviation="5 1.4"/></filter>
<linearGradient id="fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset=".7" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<mask id="rmk"><rect x="0" y="{GROUND}" width="{W}" height="{H-GROUND}" fill="url(#fade)"/></mask>
<linearGradient id="bshade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".5"/><stop offset=".5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></linearGradient>
<g id="cityw">{CITY}{win_rects(WINS, .9)}</g>'''
    k = 0.62
    body = f'<rect x="0" y="{GROUND}" width="{W}" height="{H-GROUND}" fill="url(#wg)"/>'
    body += f'<g mask="url(#rmk)" opacity=".62"><g filter="url(#refl)" transform="translate(0 {GROUND*(1+k):.1f}) scale(1 -{k})"><use href="#cityw"/></g></g>'
    body += f'<rect x="1190" y="{GROUND}" width="92" height="140" fill="#fff0c8" opacity=".10" filter="url(#refl)"/>'
    return svg(body, defs)

def shimmer_svg():
    r = random.Random(31)
    hubs = [(250, 1.0), (405, .8), (925, .8), (1232, 1.0), (1517, .9), (600, .6), (120, .5), (1100, .5)]
    s = ''
    for i in range(190):
        hx, wt = r.choice(hubs)
        x = hx + r.gauss(0, 70); y = r.uniform(GROUND + 6, H - 6)
        l = r.uniform(18, 120) * (1 + (y - GROUND) / 280); t = r.uniform(1.4, 3.2) * (1 + (y - GROUND) / 400)
        col = r.choice(['#ffd98a', '#ffb25a', '#fff3d6', '#ff9f6a', '#cfe3ff', '#ffc2e6'])
        s += f'<rect x="{x:.0f}" y="{y:.0f}" width="{l:.0f}" height="{t:.1f}" rx="{t/2:.1f}" fill="{col}" opacity="{r.uniform(.18,.5)*wt:.2f}"/>'
    return svg(f'<g filter="url(#sb)">{s}</g>', '<filter id="sb" x="-5%" y="-20%" width="110%" height="140%"><feGaussianBlur stdDeviation="1.6 0.6"/></filter>')

def still_svg():
    def ids(s, p): return re.sub(r'url\(#([^)]+)\)', lambda m: f'url(#{p}{m.group(1)})', re.sub(r'id="([^"]+)"', lambda m: f'id="{p}{m.group(1)}"', re.sub(r'href="#([^"]+)"', lambda m: f'href="#{p}{m.group(1)}"', s)))
    inner = lambda s: re.search(r'<svg[^>]*>(.*)</svg>', s, re.S).group(1)
    return svg(''.join(ids(inner(f()), p) for f, p in ((sky_svg, 'a'), (skyline_svg, 'b'), (water_svg, 'c'))))

files = {'city-sky.svg': sky_svg(), 'city-wisps.svg': wisps_svg(), 'city-skyline.svg': skyline_svg(),
         'city-lights-a.svg': lights_svg(GROUP_A), 'city-lights-b.svg': lights_svg(GROUP_B),
         'city-water.svg': water_svg(), 'city-shimmer.svg': shimmer_svg(), 'city-still.svg': still_svg()}
for name, content in files.items():
    open(f'tools/art/{name}', 'w').write(content)
    print(name, len(content))
