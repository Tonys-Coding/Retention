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
    """A gabled log barn in oblique view: long wall + roof slope facing us, gable end on the right."""
    r = random.Random(17)
    EL, ER = (188, 606), (664, 602)        # front eave, left/right (with overhang)
    RL, RR = (277, 456), (749, 452)        # ridge, left/right
    BK = (832, 574)                        # back-top corner of the gable end
    out = [
        # contact shadows hugging both base lines so the barn sits in the ground
        '<polygon points="176,720 664,722 700,748 150,752" fill="url(#ao)"/>',
        '<polygon points="660,724 834,696 884,716 690,752" fill="url(#ao)"/>',
    ]
    # stone footings under the logs
    out.append('<polygon points="204,722 662,722 662,732 204,734" fill="#191109"/><polygon points="660,724 832,696 832,706 660,734" fill="#130c07"/>')
    # long front wall of stacked logs
    out.append('<polygon points="210,606 660,603 660,724 210,724" fill="url(#wallg)"/>')
    for i in range(1, 10):
        y = 606 + i * 13.2
        out.append(f'<line x1="210" y1="{y:.1f}" x2="660" y2="{y-0.3*i:.1f}" stroke="#150c07" stroke-width="2.2" opacity=".8"/>')
        out.append(f'<line x1="210" y1="{y+2.2:.1f}" x2="660" y2="{y+1.9-0.3*i:.1f}" stroke="#b07a40" stroke-width="1" opacity=".2"/>')
        out.append(f'<rect x="652" y="{y-8:.1f}" width="14" height="9" rx="4.5" fill="#3a2616" stroke="#150c07" stroke-width="1"/>')  # log ends at the corner
    out.append('<polygon points="420,646 494,646 494,724 420,724" fill="#120c08"/>')  # barn door with brace
    out.append('<line x1="457" y1="646" x2="457" y2="724" stroke="#050302" stroke-width="2"/><line x1="420" y1="646" x2="494" y2="724" stroke="#3a2818" stroke-width="3"/><line x1="494" y1="646" x2="420" y2="724" stroke="#3a2818" stroke-width="3"/>')
    out.append('<polygon points="262,640 300,639 300,664 262,665" fill="#0a0705"/><line x1="281" y1="639" x2="281" y2="665" stroke="#3a2818" stroke-width="2"/>')
    out.append('<polygon points="560,646 590,646 590,668 560,668" fill="#0a0705"/>')
    # gable end (in shade)
    out.append(f'<polygon points="660,724 660,603 {RR[0]},{RR[1]} {BK[0]},{BK[1]} 832,696" fill="#27190f"/>')
    for k in range(1, 9):
        y = 603 + k * 14.8
        out.append(f'<line x1="660" y1="{y:.1f}" x2="832" y2="{y-29:.1f}" stroke="#0b0603" stroke-width="2" opacity=".8"/>')
    for k in range(1, 7):  # vertical boards in the triangle
        t = k / 7; xx = 660 + 172 * t; ytop = 603 - 29 * t - (151 * (1 - abs(2 * t - 1)))
        out.append(f'<line x1="{xx:.1f}" y1="{ytop+6:.1f}" x2="{xx:.1f}" y2="{603 - 29 * t:.1f}" stroke="#0b0603" stroke-width="1.6" opacity=".6"/>')
    out.append('<polygon points="722,520 764,513 764,556 722,562" fill="#08060a"/><line x1="743" y1="517" x2="743" y2="559" stroke="#3a2818" stroke-width="2"/>')
    # roof slope: planks from eave to ridge with lit patches and a few missing boards
    n = 14
    cols = ['#6a4b2a', '#7c5a30', '#58401f', '#8b6a3a', '#664826']
    lerp2 = lambda A, B, t: (A[0] + (B[0]-A[0]) * t, A[1] + (B[1]-A[1]) * t)
    for i in range(n):
        s0, s1 = i / n, (i + 1) / n
        e0, e1, g1, g0 = lerp2(EL, ER, s0), lerp2(EL, ER, s1), lerp2(RL, RR, s1), lerp2(RL, RR, s0)
        poly = pts([e0, e1, g1, g0])
        out.append(f'<polygon points="{poly}" fill="{r.choice(cols)}"/><polygon points="{poly}" fill="url(#roofg)"/>')
        if r.random() < .55:
            t0, t1 = r.uniform(.08, .5), r.uniform(.55, .96)
            a_, b_, c_, d_ = lerp2(e0, g0, t0), lerp2(e1, g1, t0), lerp2(e1, g1, t1), lerp2(e0, g0, t1)
            out.append(f'<polygon points="{pts([a_, b_, c_, d_])}" fill="#b08a48" opacity="{r.uniform(.22,.42):.2f}"/>')
        out.append(f'<line x1="{e1[0]:.1f}" y1="{e1[1]:.1f}" x2="{g1[0]:.1f}" y2="{g1[1]:.1f}" stroke="#1c120a" stroke-width="2.4"/>')
    for i in (3, 7, 10):  # missing boards near the ridge
        s0, s1 = i / n, (i + 1) / n
        a_, b_ = lerp2(lerp2(EL, ER, s0), lerp2(RL, RR, s0), .62), lerp2(lerp2(EL, ER, s1), lerp2(RL, RR, s1), .62)
        c_, d_ = lerp2(lerp2(EL, ER, s1), lerp2(RL, RR, s1), .9), lerp2(lerp2(EL, ER, s0), lerp2(RL, RR, s0), .9)
        out.append(f'<polygon points="{pts([a_, b_, c_, d_])}" fill="#0f0905" opacity=".9"/>')
    for t in (0.34, 0.68):  # purlins
        a_, b_ = lerp2(EL, RL, t), lerp2(ER, RR, t)
        out.append(f'<line x1="{a_[0]:.1f}" y1="{a_[1]:.1f}" x2="{b_[0]:.1f}" y2="{b_[1]:.1f}" stroke="#1c120a" stroke-width="3" opacity=".75"/>')
    # fascia, ridge cap, bargeboards, broken rafters
    out.append(f'<polyline points="{pts([EL, ER])}" stroke="#1c120a" stroke-width="6" fill="none" stroke-linecap="round"/>')
    out.append(f'<polyline points="{pts([EL, RL, RR])}" stroke="#1c120a" stroke-width="6" fill="none" stroke-linejoin="round" stroke-linecap="round"/>')
    out.append(f'<polyline points="{pts([ER, RR, BK])}" stroke="#20150c" stroke-width="7" fill="none" stroke-linejoin="round" stroke-linecap="round"/>')
    out.append(f'<polyline points="{pts([ER, RR])}" stroke="#a97d46" stroke-width="1.6" fill="none" opacity=".45"/>')
    for x in (330, 410, 500, 590, 680):
        y = RL[1] + (RR[1] - RL[1]) * (x - RL[0]) / (RR[0] - RL[0])
        out.append(f'<line x1="{x}" y1="{y:.1f}" x2="{x + r.randint(-10, 10)}" y2="{y - r.randint(14, 30):.1f}" stroke="#1c120a" stroke-width="3" stroke-linecap="round"/>')
    return ''.join(out)

def land():
    r = random.Random(8)
    defs = f'''<defs>
<linearGradient id="field" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#26230f"/><stop offset=".18" stop-color="#3a3016"/><stop offset=".6" stop-color="#5a4219"/><stop offset="1" stop-color="#2a1c0d"/></linearGradient>
<linearGradient id="wallg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3e2a1a"/><stop offset=".6" stop-color="#6b4a2a"/><stop offset="1" stop-color="#4c331e"/></linearGradient>
<linearGradient id="roofg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".6"/><stop offset=".55" stop-color="#000" stop-opacity=".18"/><stop offset="1" stop-color="#e0a458" stop-opacity=".16"/></linearGradient>
<linearGradient id="ao" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".7"/><stop offset=".5" stop-color="#000" stop-opacity=".3"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient>
<radialGradient id="barnlight" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#e0a458" stop-opacity=".30"/><stop offset="1" stop-color="#e0a458" stop-opacity="0"/></radialGradient>
<linearGradient id="haze" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6f566a" stop-opacity="0"/><stop offset="1" stop-color="#6f566a" stop-opacity=".5"/></linearGradient>
<filter id="b12" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="12"/></filter>
</defs>'''
    b = ''
    # far hills, then several tree lines getting darker and larger toward us (field distance)
    def ridge_pts(base, amp, seed, step=40):
        rr = random.Random(seed); y = base; out = []
        for x in range(-40, W + 80, step):
            y += rr.uniform(-amp, amp); y = max(base - 3*amp, min(base + amp, y)); out.append((x, y))
        return out
    def smooth_hill(color, base, amp, seed, opacity=1):
        p = ridge_pts(base, amp, seed)
        return f'<polygon points="{pts(p + [(W+80, HORIZON+6), (-40, HORIZON+6)])}" fill="{color}" opacity="{opacity}"/>'
    def treeline(color, hmin, hmax, density, seed, opacity=1, x0=-10, x1=W+10, base=HORIZON+3, blob=.35, clump=0):
        rr = random.Random(seed); o = []; x = x0
        while x < x1:
            if clump and rr.random() < clump: x += rr.randint(40, 120); continue
            h = rr.uniform(hmin, hmax); w = h * rr.uniform(.26, .36)
            if rr.random() < blob:  # round deciduous crown on a short trunk
                rw = h * .34
                o.append(f'<ellipse cx="{x:.1f}" cy="{base - h*.62:.1f}" rx="{rw:.1f}" ry="{h*.4:.1f}" fill="{color}"/><rect x="{x-1.2:.1f}" y="{base - h*.3:.1f}" width="2.4" height="{h*.32:.1f}" fill="{color}"/>')
            else:
                o.append(f'<polygon points="{x:.1f},{base - h:.1f} {x - w:.1f},{base:.1f} {x + w:.1f},{base:.1f}" fill="{color}"/>')
            x += rr.uniform(density * .6, density * 1.4)
        return f'<g opacity="{opacity}">' + ''.join(o) + '</g>'
    b = smooth_hill('#463a52', HORIZON - 14, 5, 41, .75)
    b += smooth_hill('#3a3046', HORIZON - 7, 4, 52, .9)
    b += treeline('#2d2540', 6, 13, 5, 61, 1, base=HORIZON - 2)
    b += f'<rect x="0" y="{HORIZON-26}" width="{W}" height="40" fill="url(#haze)"/>'
    b += treeline('#2a2236', 9, 22, 8, 62, .95, clump=.12, base=HORIZON + 1)
    b += treeline('#1c1626', 14, 36, 14, 63, 1, x0=1050, base=HORIZON + 3, blob=.5)
    b += treeline('#1c1626', 14, 30, 16, 64, 1, x1=330, base=HORIZON + 3, blob=.5)
    b += treeline('#120d19', 24, 52, 30, 65, 1, x0=1180, base=HORIZON + 6, blob=.55)
    for lx in (1002, 1020, 1042, 1060):
        b += f'<rect x="{lx}" y="{HORIZON+3}" width="9" height="4" fill="#cdbfd0" opacity=".55"/>'
    b += f'<rect x="1574" y="{HORIZON-4}" width="3" height="3" fill="#ff6a3a"/><rect x="420" y="{HORIZON-1}" width="3" height="2" fill="#e8c38a" opacity=".7"/>'
    # golden field with long grass texture
    b += f'<rect x="0" y="{HORIZON}" width="{W}" height="{H-HORIZON}" fill="url(#field)"/>'
    b += f'<ellipse cx="560" cy="700" rx="520" ry="70" fill="url(#barnlight)" filter="url(#b12)"/>'
    for k in range(-14, 15):  # field rows converging on the horizon
        b += f'<line x1="{800 + k*14:.0f}" y1="{HORIZON}" x2="{800 + k*150:.0f}" y2="{H}" stroke="#120c06" stroke-width="{1 + abs(k)*.08:.1f}" opacity=".16"/>'
    b += f'<rect x="0" y="{HORIZON}" width="{W}" height="26" fill="#6f566a" opacity=".22"/>'
    for i in range(1700):
        y = r.uniform(HORIZON, H); depth = (y - HORIZON) / (H - HORIZON)
        x = r.uniform(0, W); l = 3 + depth * 26 + r.uniform(0, 6)
        lit = max(0, 1 - abs(x - 600) / 800)
        col = r.choice(['#8a6a2a', '#a07a30', '#6a5222', '#b58a3a', '#4a3a1c'])
        b += f'<line x1="{x:.1f}" y1="{y:.1f}" x2="{x + r.uniform(-3,3):.1f}" y2="{y - l:.1f}" stroke="{col}" stroke-width="{0.8 + depth*1.6:.1f}" stroke-linecap="round" opacity="{0.12 + 0.5*lit*r.random()*(0.4+depth):.2f}"/>'
    b += '<g>' + barn() + '</g>'
    # tall grass planted along both base lines, overlapping the footings
    for i in range(900):
        x = r.uniform(165, 880)
        yb = 726 if x <= 660 else 726 - (x - 660) * 28 / 172
        y = yb + r.uniform(-4, 26); l = r.uniform(16, 52) * (0.7 + (y - yb + 4) / 60)
        col = r.choice(["#1c130a", "#2b1f10", "#3d2b14", "#5a4220", "#7a5a26"])
        b += f'<path d="M{x:.1f} {y:.1f} q{r.uniform(-4,4):.1f} {-l*0.5:.1f} {r.uniform(-9,9):.1f} {-l:.1f}" stroke="{col}" stroke-width="{r.uniform(1.2,2.6):.1f}" stroke-linecap="round" fill="none" opacity=".9"/>'
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

RAIN_W, RAIN_H = 700, 400   # canvas units; the tile repeats vertically only (see .st-rain-box in style.css)

def rain():
    """Seamless-vertical tile of streaks with the horizontal fade baked in (so the page needs no CSS mask).
    Two populations (long/bold and short/faint) give the depth of two layers in one."""
    r = random.Random(2)
    s = ''
    for count, (lmin, lmax), (wmin, wmax), (omin, omax) in ((46, (34, 64), (1.1, 1.7), (.2, .4)), (50, (16, 34), (.7, 1.1), (.1, .26))):
        for i in range(count):
            x, y, l = r.uniform(8, RAIN_W - 8), r.uniform(0, RAIN_H), r.uniform(lmin, lmax)
            bell = math.sin(math.pi * x / RAIN_W) ** 1.4          # 0 at the sides, 1 in the middle
            op = r.uniform(omin, omax) * bell
            if op < .02: continue
            w = r.uniform(wmin, wmax)
            for dy in (-RAIN_H, 0, RAIN_H):
                s += f'<line x1="{x:.1f}" y1="{y+dy:.1f}" x2="{x-l*.14:.1f}" y2="{y+dy+l:.1f}" stroke="#d6c6ee" stroke-width="{w:.1f}" stroke-linecap="round" opacity="{op:.2f}"/>'
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {RAIN_W} {RAIN_H}">{s}</svg>'

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
    open(f'tools/art/{name}', 'w').write(content)
    print(name, len(content))
