# Regenerates the Thunderstorm theme art in images/storm-*.svg. Run from the repo root:
#   python3 tools/gen_storm_scene.py
# Layers share one 1600x900 canvas (anchored bottom-center, "cover") so they line up.
import random, math
W, H = 1600, 900
HORIZON = 640

def svg(body, extra=''):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMax slice">{extra}{body}</svg>'

def lerp(a, b, t): return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)
def pts(p): return ' '.join(f'{x:.1f},{y:.1f}' for x, y in p)

# ── Sky: purple storm clouds, rain shaft haze, horizon glow ─────────────
def sky():
    defs = f'''<defs>
<linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#150f1f"/><stop offset=".4" stop-color="#2a2038"/><stop offset=".7" stop-color="#4a3a56"/><stop offset=".92" stop-color="#6f5668"/><stop offset="1" stop-color="#7d6068"/></linearGradient>
<filter id="cd" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".0028 .0068" numOctaves="5" seed="11"/><feColorMatrix type="matrix" values="0 0 0 0 .09  0 0 0 0 .06  0 0 0 0 .14  3.4 0 0 0 -1.12"/></filter>
<filter id="cm" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".0035 .016" numOctaves="5" seed="23"/><feColorMatrix type="matrix" values="0 0 0 0 .56  0 0 0 0 .44  0 0 0 0 .66  2.4 0 0 0 -.95"/></filter>
<filter id="cs" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".006 .05" numOctaves="3" seed="5"/><feColorMatrix type="matrix" values="0 0 0 0 .75  0 0 0 0 .66  0 0 0 0 .84  2.2 0 0 0 -1.05"/></filter>
<linearGradient id="mtop" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".55" stop-color="#fff" stop-opacity=".85"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<linearGradient id="mmid" x1="0" y1="0" x2="0" y2="1"><stop offset=".15" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff"/><stop offset=".95" stop-color="#fff" stop-opacity="0"/></linearGradient>
<mask id="mkTop"><rect width="{W}" height="{H}" fill="url(#mtop)"/></mask>
<mask id="mkMid"><rect width="{W}" height="{H}" fill="url(#mmid)"/></mask>
<linearGradient id="shaft" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b9a3cf" stop-opacity=".0"/><stop offset=".5" stop-color="#b9a3cf" stop-opacity=".22"/><stop offset="1" stop-color="#d1b6c4" stop-opacity=".34"/></linearGradient>
<radialGradient id="bright" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#f0e0f4" stop-opacity=".95"/><stop offset=".5" stop-color="#b79ad0" stop-opacity=".35"/><stop offset="1" stop-color="#a98fc4" stop-opacity="0"/></radialGradient>
<filter id="b30" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="30"/></filter>
<filter id="b8" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="8"/></filter>
</defs>'''
    r = random.Random(3)
    body = f'<rect width="{W}" height="{H}" fill="url(#sg)"/>'
    body += f'<rect width="{W}" height="{H}" filter="url(#cm)" mask="url(#mkMid)" opacity=".55"/>'
    body += f'<rect width="{W}" height="{H}" filter="url(#cd)" mask="url(#mkTop)"/>'
    body += f'<rect width="{W}" height="{H}" filter="url(#cs)" mask="url(#mkMid)" opacity=".22"/>'
    # glowing storm cell + rain curtain on the right
    body += '<ellipse cx="1210" cy="352" rx="300" ry="110" fill="url(#bright)" filter="url(#b8)"/><ellipse cx="1210" cy="352" rx="120" ry="45" fill="url(#bright)"/>'
    body += '<g filter="url(#b30)" opacity=".85">'
    for x0, w0, op in [(1000, 200, .55), (1130, 240, .7), (1280, 200, .5)]:
        body += f'<polygon points="{x0},330 {x0+w0},330 {x0+w0+90},{HORIZON+10} {x0-60},{HORIZON+10}" fill="url(#shaft)" opacity="{op}"/>'
    body += '</g>'
    # darker anvil edge under the cell and horizon glow
    body += f'<rect x="0" y="{HORIZON-70}" width="{W}" height="90" fill="#6f566a" opacity=".35" filter="url(#b30)"/>'
    return svg(body, defs)

# Drifting wisps: seamless horizontally (stitchTiles) so the layer can scroll forever
def wisps():
    defs = f'''<defs>
<filter id="wf" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".0030 .0105" numOctaves="4" seed="31" stitchTiles="stitch"/><feColorMatrix type="matrix" values="0 0 0 0 .72  0 0 0 0 .6  0 0 0 0 .82  2.1 0 0 0 -.98"/></filter>
<linearGradient id="wm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".25" stop-color="#fff"/><stop offset=".6" stop-color="#fff" stop-opacity=".7"/><stop offset=".85" stop-color="#fff" stop-opacity="0"/></linearGradient>
<mask id="wmk"><rect width="{W}" height="{H}" fill="url(#wm)"/></mask></defs>'''
    return svg(f'<rect width="{W}" height="{H}" filter="url(#wf)" mask="url(#wmk)"/>', defs)

# ── Landscape: hills, tree line, log barn, golden field ─────────────────
def barn():
    r = random.Random(17)
    A, B, C, D = (384, 420), (816, 358), (936, 590), (180, 608)  # roof quad: far ridge, near apex, near eave, far eave
    out = []
    # long log wall (under the roof eave) and gable end
    out.append('<polygon points="212,606 640,580 640,708 212,716" fill="url(#wallg)"/>')
    for i in range(1, 9):  # horizontal logs
        y0 = 606 + i * 13.5; y1 = 580 + i * 16
        out.append(f'<line x1="212" y1="{y0:.1f}" x2="640" y2="{y1:.1f}" stroke="#1b110b" stroke-width="2" opacity=".75"/>')
        out.append(f'<line x1="212" y1="{y0+2:.1f}" x2="640" y2="{y1+2:.1f}" stroke="#a9763f" stroke-width="1" opacity=".22"/>')
    out.append('<polygon points="640,582 812,428 904,606 904,708 640,708" fill="#2a1c14"/>')
    for i in range(1, 9):
        y = 582 + i * 14.4
        out.append(f'<line x1="640" y1="{y:.1f}" x2="904" y2="{y+ (606-582)/9*0 + 2:.1f}" stroke="#0e0805" stroke-width="2" opacity=".8"/>')
    for x in range(660, 904, 22):  # vertical boards in the gable
        out.append(f'<line x1="{x}" y1="{582 + max(0, (x-640)*-0.2)+ 6:.1f}" x2="{x}" y2="708" stroke="#0e0805" stroke-width="1.4" opacity=".5"/>')
    out.append('<polygon points="787,492 826,500 826,566 787,558" fill="#08060a"/><line x1="787" y1="525" x2="826" y2="534" stroke="#3a2a22" stroke-width="2"/><line x1="806" y1="496" x2="806" y2="563" stroke="#3a2a22" stroke-width="2"/>')
    out.append('<polygon points="800,606 838,606 838,668 800,668" fill="#16100c"/><line x1="819" y1="606" x2="819" y2="668" stroke="#050304" stroke-width="2"/>')
    out.append('<polygon points="262,632 306,630 306,650 262,652" fill="#0b0705"/>')
    # roof planks (ridge -> eave), alternating lit boards and patched metal sheets
    n = 11
    cols = ['#6a4b2a', '#7c5a30', '#58401f', '#8b6a3a', '#664826']
    for i in range(n):
        s0, s1 = i / n, (i + 1) / n
        p0, p1, q1, q0 = lerp(A, B, s0), lerp(A, B, s1), lerp(D, C, s1), lerp(D, C, s0)
        out.append(f'<polygon points="{pts([p0, p1, q1, q0])}" fill="{r.choice(cols)}"/>')
        out.append(f'<polygon points="{pts([p0, p1, q1, q0])}" fill="url(#roofg)"/>')
        if r.random() < .6:  # lit patch (tin / new boards)
            t0, t1 = r.uniform(.1, .5), r.uniform(.55, .95)
            a, b = lerp(p0, q0, t0), lerp(p1, q1, t0); c, d = lerp(p1, q1, t1), lerp(p0, q0, t1)
            out.append(f'<polygon points="{pts([a, b, c, d])}" fill="#b08a48" opacity="{r.uniform(.25,.45):.2f}"/>')
        out.append(f'<line x1="{p1[0]:.1f}" y1="{p1[1]:.1f}" x2="{q1[0]:.1f}" y2="{q1[1]:.1f}" stroke="#1c120a" stroke-width="3"/>')
    for t in (0.35, 0.7):  # horizontal purlins
        a, b = lerp(A, D, t), lerp(B, C, t)
        out.append(f'<line x1="{a[0]:.1f}" y1="{a[1]:.1f}" x2="{b[0]:.1f}" y2="{b[1]:.1f}" stroke="#1c120a" stroke-width="3.5" opacity=".8"/>')
    out.append(f'<polygon points="{pts([A, B, (B[0]+2, B[1]+10), (A[0], A[1]+12)])}" fill="#1c120a"/>')
    # broken rafters poking above the ridge and a gable-end ladder of boards
    for x in (420, 505, 570, 650, 730):
        y = A[1] + (B[1] - A[1]) * (x - A[0]) / (B[0] - A[0])
        out.append(f'<line x1="{x}" y1="{y:.1f}" x2="{x + r.randint(-14, 14)}" y2="{y - r.randint(14, 30):.1f}" stroke="#1c120a" stroke-width="3"/>')
    out.append(f'<polyline points="{pts([B, (884, 560), C])}" fill="none" stroke="#20150c" stroke-width="6" stroke-linejoin="round"/>')
    out.append(f'<polyline points="{pts([B, (870, 500), (930, 590)])}" fill="none" stroke="#7b5a32" stroke-width="2" opacity=".5"/>')
    return ''.join(out)

def land():
    r = random.Random(8)
    defs = f'''<defs>
<linearGradient id="field" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#26230f"/><stop offset=".18" stop-color="#3a3016"/><stop offset=".6" stop-color="#5a4219"/><stop offset="1" stop-color="#2a1c0d"/></linearGradient>
<linearGradient id="wallg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3e2a1a"/><stop offset=".6" stop-color="#6b4a2a"/><stop offset="1" stop-color="#4c331e"/></linearGradient>
<linearGradient id="roofg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".6"/><stop offset=".55" stop-color="#000" stop-opacity=".18"/><stop offset="1" stop-color="#e0a458" stop-opacity=".16"/></linearGradient>
<radialGradient id="barnlight" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#e0a458" stop-opacity=".30"/><stop offset="1" stop-color="#e0a458" stop-opacity="0"/></radialGradient>
<filter id="b12" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="12"/></filter>
</defs>'''
    b = ''
    # far hills (left) and tree line / farm lights (right)
    hills = [(0, 628), (90, 618), (190, 626), (270, 644), (300, 650), (0, 650)]
    b += f'<polygon points="{pts(hills)}" fill="#1a1520"/>'
    b += f'<rect x="1130" y="{HORIZON-12}" width="470" height="30" fill="#14111a"/>'
    x = 1130
    while x < 1600:
        h = r.randint(8, 22); w = r.randint(8, 16)
        b += f'<polygon points="{x},{HORIZON+2} {x+w/2},{HORIZON-h} {x+w},{HORIZON+2}" fill="#0f0c14"/>'; x += r.randint(7, 15)
    for lx in (1000, 1018, 1040, 1058):
        b += f'<rect x="{lx}" y="{HORIZON+3}" width="9" height="4" fill="#cdbfd0" opacity=".55"/>'
    b += f'<rect x="1560" y="{HORIZON-6}" width="3" height="3" fill="#ff6a3a"/>'
    # golden field with long grass texture
    b += f'<rect x="0" y="{HORIZON}" width="{W}" height="{H-HORIZON}" fill="url(#field)"/>'
    b += f'<ellipse cx="560" cy="700" rx="520" ry="70" fill="url(#barnlight)" filter="url(#b12)"/>'
    for i in range(1700):
        y = r.uniform(HORIZON, H); depth = (y - HORIZON) / (H - HORIZON)
        x = r.uniform(0, W); l = 3 + depth * 26 + r.uniform(0, 6)
        lit = max(0, 1 - abs(x - 600) / 800)
        col = r.choice(['#8a6a2a', '#a07a30', '#6a5222', '#b58a3a', '#4a3a1c'])
        b += f'<line x1="{x:.1f}" y1="{y:.1f}" x2="{x + r.uniform(-3,3):.1f}" y2="{y - l:.1f}" stroke="{col}" stroke-width="{0.8 + depth*1.6:.1f}" stroke-linecap="round" opacity="{0.12 + 0.5*lit*r.random()*(0.4+depth):.2f}"/>'
    b += '<g>' + barn() + '</g>'
    # tall grass shadowing the barn base
    for i in range(380):
        x = r.uniform(120, 960); y = r.uniform(690, 735); l = r.uniform(18, 46)
        b += f'<line x1="{x:.1f}" y1="{y:.1f}" x2="{x + r.uniform(-5,5):.1f}" y2="{y - l:.1f}" stroke="{r.choice(["#2b1f10","#3d2b14","#5a4220"])}" stroke-width="{r.uniform(1.2,2.4):.1f}" stroke-linecap="round" opacity=".85"/>'
    return svg(b, defs)

# Foreground swaying grass (separate layer so it can sway on the compositor)
def grass():
    r = random.Random(21)
    defs = '<defs><linearGradient id="gb" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#150d07"/><stop offset=".6" stop-color="#3a2a14"/><stop offset="1" stop-color="#9a7430"/></linearGradient></defs>'
    b = ''
    for i in range(240):
        x = r.uniform(-20, W + 20); h = r.uniform(70, 230); lean = r.uniform(-26, 26)
        w = r.uniform(2.5, 6)
        b += f'<path d="M{x-w:.1f} {H+4} Q{x+lean*.3:.1f} {H-h*.55:.1f} {x+lean:.1f} {H-h:.1f} Q{x+lean*.35+w:.1f} {H-h*.5:.1f} {x+w:.1f} {H+4}Z" fill="url(#gb)" opacity="{r.uniform(.7,1):.2f}"/>'
    for i in range(70):  # seed heads like the flowering weeds in the photo
        x = r.uniform(0, W); h = r.uniform(150, 260)
        b += f'<ellipse cx="{x:.1f}" cy="{H-h:.1f}" rx="5" ry="{r.uniform(8,16):.1f}" fill="#b0872f" opacity=".55" transform="rotate({r.uniform(-18,18):.0f} {x:.1f} {H-h:.1f})"/>'
    return svg(b, defs)

def rain():
    r = random.Random(2)
    s = ''
    for i in range(34):
        x, y, l = r.uniform(0, 400), r.uniform(0, 400), r.uniform(22, 60)
        for dx in (-400, 0, 400):
            for dy in (-400, 0, 400):
                s += f'<line x1="{x+dx:.1f}" y1="{y+dy:.1f}" x2="{x+dx-l*.14:.1f}" y2="{y+dy+l:.1f}" stroke="#d6c6ee" stroke-width="{r.uniform(.8,1.5):.1f}" stroke-linecap="round" opacity="{r.uniform(.12,.34):.2f}"/>'
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">{s}</svg>'

# ── Lightning bolt geometry (static; the overlay animates its opacity) ───
def bolt(x0, y0, x1, y1, seed, jag=22, depth=0):
    r = random.Random(seed)
    def disp(a, b, amp, lvl):
        if lvl == 0: return [a, b]
        m = ((a[0]+b[0])/2 + r.uniform(-amp, amp), (a[1]+b[1])/2 + r.uniform(-amp*.35, amp*.35))
        return disp(a, m, amp*.55, lvl-1)[:-1] + disp(m, b, amp*.55, lvl-1)
    main = disp((x0, y0), (x1, y1), jag, 6)
    paths = [main]
    for k in range(3):  # side branches
        i = r.randint(len(main)//5, len(main)*3//4); sx, sy = main[i]
        ex, ey = sx + r.uniform(-90, 30), sy + r.uniform(60, 150)
        paths.append(disp((sx, sy), (ex, ey), jag*.6, 4))
    return paths

def bolt_svg(paths, width=3.2):
    d = ''.join('M' + ' L'.join(f'{x:.1f} {y:.1f}' for x, y in p) for p in paths)
    glow = f'<path d="{d}" fill="none" stroke="#b9a0f0" stroke-width="{width*5}" stroke-linejoin="round" stroke-linecap="round" opacity=".55" filter="url(#bg)"/>'
    core = f'<path d="{d}" fill="none" stroke="#f4eeff" stroke-width="{width}" stroke-linejoin="round" stroke-linecap="round"/>'
    hot = f'<path d="{d}" fill="none" stroke="#fff" stroke-width="{width*.4}" stroke-linejoin="round" stroke-linecap="round"/>'
    defs = '<defs><filter id="bg" x="-40%" y="-10%" width="180%" height="120%"><feGaussianBlur stdDeviation="5"/></filter></defs>'
    return svg(defs + glow + core + hot)

files = {
    'storm-sky.svg': sky(), 'storm-wisps.svg': wisps(), 'storm-land.svg': land(), 'storm-grass.svg': grass(),
    'storm-rain.svg': rain(),
    'storm-bolt-a.svg': bolt_svg(bolt(1200, 352, 1084, HORIZON-4, 5)),
    'storm-bolt-b.svg': bolt_svg(bolt(560, 338, 700, 372, 9, 12), 1.8),
}
# One still frame (sky + land) for tiles, the library preview and the pre-JS fallback
import re
def inner(s): return re.search(r'<svg[^>]*>(.*)</svg>', s, re.S).group(1)
sk, ld = files['storm-sky.svg'], files['storm-land.svg']
dedup = lambda s, pfx: re.sub(r'id="([^"]+)"', lambda m: f'id="{pfx}{m.group(1)}"', s) and re.sub(r'url\(#([^)]+)\)', lambda m: f'url(#{pfx}{m.group(1)})', re.sub(r'id="([^"]+)"', lambda m: f'id="{pfx}{m.group(1)}"', s)).replace('mask="url', 'mask="url')
dedup_ids = lambda s, pfx: re.sub(r'url\(#([^)]+)\)', lambda m: f'url(#{pfx}{m.group(1)})', re.sub(r'id="([^"]+)"', lambda m: f'id="{pfx}{m.group(1)}"', s))
files['storm-still.svg'] = svg(inner(dedup_ids(sk, 'a')) + inner(dedup_ids(ld, 'b')))
for name, content in files.items():
    open(f'images/{name}', 'w').write(content)
    print(name, len(content))
