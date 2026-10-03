# Regenerates images/campfire-scene.svg. Run from the repo root: python3 tools/gen_campfire_scene.py
import random, math
R = random.Random(42)
W, H = 1600, 900

def ridge(base, amp, rough, seed, n=9, y_off=0):
    r = random.Random(seed)
    pts = {0: base + r.uniform(-amp, amp), 2**n: base + r.uniform(-amp, amp)}
    step, a = 2**n, amp
    while step > 1:
        half = step // 2
        for i in range(0, 2**n, step):
            mid = i + half
            pts[mid] = (pts[i] + pts[i + step]) / 2 + r.uniform(-a, a)
        a *= rough; step = half
    xs = sorted(pts)
    return [(x / 2**n * W, pts[x]) for x in xs[::2]]

def path_from(points, close_to=H):
    d = 'M' + ' L'.join(f'{x:.1f} {y:.1f}' for x, y in points)
    return d + f' L{W} {close_to} L0 {close_to}Z'

def y_at(points, x):
    for (x0, y0), (x1, y1) in zip(points, points[1:]):
        if x0 <= x <= x1:
            t = (x - x0) / max(1e-6, x1 - x0); return y0 + (y1 - y0) * t
    return points[-1][1]

def pine(x, base, h, w, r, jag=0.18):
    """Fuller conifer: stacked drooping branch tiers with ragged tips. Returns (polygon, left_edge, right_edge)."""
    n = max(5, int(h / (58 if h > 300 else 30)))
    top = base - h
    left, right = [(x, top)], [(x, top)]
    for i in range(n):
        t = (i + 1) / n
        y = top + h * t * 0.96
        wi = w * (0.14 + 0.86 * t) * r.uniform(1 - jag, 1 + jag)
        step = h / n
        for side, pts in ((-1, left), (1, right)):
            ww = wi * r.uniform(0.92, 1.08)
            pts.append((x + side * ww * 0.30, y - step * r.uniform(0.62, 0.78)))
            pts.append((x + side * ww * 0.62, y - step * r.uniform(0.28, 0.42)))
            pts.append((x + side * ww * 0.86, y - step * r.uniform(0.08, 0.22)))
            pts.append((x + side * ww, y + step * r.uniform(0.18, 0.4)))
            pts.append((x + side * ww * 0.7, y + step * r.uniform(0.0, 0.1)))
            pts.append((x + side * ww * 0.36, y - step * r.uniform(0.1, 0.22)))
    left.append((x - 4, base)); right.append((x + 4, base))
    return left + right[::-1], left, right

def poly_d(p): return 'M' + ' L'.join(f'{a:.1f} {b:.1f}' for a, b in p) + 'Z'

out = []
add = out.append
add(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMax slice">')
add('''<defs>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#03040a"/><stop offset=".45" stop-color="#090b17"/><stop offset=".72" stop-color="#14121c"/><stop offset=".88" stop-color="#2a1a18"/><stop offset="1" stop-color="#3b2216"/></linearGradient>
<radialGradient id="moonhalo"><stop offset="0" stop-color="#cfd8ff" stop-opacity=".30"/><stop offset=".4" stop-color="#8fa0d8" stop-opacity=".10"/><stop offset="1" stop-color="#8fa0d8" stop-opacity="0"/></radialGradient>
<radialGradient id="amb" cx=".5" cy="1" r=".85"><stop offset="0" stop-color="#c2601f" stop-opacity=".30"/><stop offset=".45" stop-color="#8a3a14" stop-opacity=".12"/><stop offset="1" stop-color="#8a3a14" stop-opacity="0"/></radialGradient>
<linearGradient id="haze" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b2f4d" stop-opacity="0"/><stop offset="1" stop-color="#4a3a3c" stop-opacity=".55"/></linearGradient>
<linearGradient id="ground" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1d1511"/><stop offset=".5" stop-color="#110c0a"/><stop offset="1" stop-color="#070506"/></linearGradient>
<radialGradient id="litground" cx=".5" cy=".0" r=".7"><stop offset="0" stop-color="#b9561b" stop-opacity=".2"/><stop offset=".5" stop-color="#7c3512" stop-opacity=".07"/><stop offset="1" stop-color="#7c3512" stop-opacity="0"/></radialGradient>
<radialGradient id="vig" cx=".5" cy=".62" r=".78"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".62"/></radialGradient>
<filter id="blur40" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="38"/></filter>
<filter id="blur6" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>
<filter id="blur1"><feGaussianBlur stdDeviation="1.1"/></filter>
<filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="4"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .55 -.2"/></filter>
<mask id="crescent"><rect width="1600" height="900" fill="#fff"/><circle cx="1262" cy="168" r="27" fill="#000"/></mask>
</defs>''')
add(f'<rect width="{W}" height="{H}" fill="url(#sky)"/>')

# Milky way haze
add('<g filter="url(#blur40)" opacity=".5" transform="rotate(-28 800 250)">')
for i in range(16):
    add(f'<ellipse cx="{R.randint(100,1500)}" cy="{R.randint(190,310)}" rx="{R.randint(120,260)}" ry="{R.randint(26,60)}" fill="{R.choice(["#3d4372","#4a3f68","#2e3f6a","#5a4a70"])}" opacity="{R.uniform(.14,.3):.2f}"/>')
add('</g>')

# Stars: many faint, some bright with glow, denser in the band
for i in range(260):
    x, y = R.randint(0, W), R.randint(0, 560)
    if R.random() < .45:  # cluster around the band
        t = R.uniform(0, 1); x = int(200 + t * 1200 + R.gauss(0, 60)); y = int(380 - t * 250 + R.gauss(0, 55))
    r = R.choice([.6, .7, .8, 1, 1, 1.3])
    col = R.choice(['#ffffff', '#ffe9cf', '#cfd9ff'])
    add(f'<circle cx="{x}" cy="{y}" r="{r}" fill="{col}" opacity="{R.uniform(.25,.85):.2f}"/>')
for i in range(9):
    x, y = R.randint(60, 1540), R.randint(30, 360)
    add(f'<circle cx="{x}" cy="{y}" r="5" fill="#dfe6ff" opacity=".18" filter="url(#blur6)"/><circle cx="{x}" cy="{y}" r="1.7" fill="#fff"/>')

# Moon
add('<circle cx="1250" cy="168" r="150" fill="url(#moonhalo)"/>')
add('<circle cx="1250" cy="168" r="26" fill="#e9e6da" mask="url(#crescent)"/>')

# Far mountains with atmospheric perspective
far = ridge(640, 70, .52, 3)
mid = ridge(700, 55, .5, 8)
add(f'<path d="{path_from(far)}" fill="#171a2c"/>')
add(f'<path d="{path_from(far)}" fill="url(#haze)"/>')
add(f'<path d="{path_from(mid)}" fill="#10121f"/>')
add(f'<path d="{path_from(mid)}" fill="url(#haze)" opacity=".7"/>')

# Distant forest on the mid ridge (many small pines)
fr = random.Random(5)
for i in range(70):
    x = fr.uniform(0, W); base = y_at(mid, x) + 6
    h = fr.uniform(34, 78); poly, _, _ = pine(x, base, h, h * .26, fr, .22)
    add(f'<path d="{poly_d(poly)}" fill="#0b0d17"/>')
low = ridge(770, 26, .5, 14)
add(f'<path d="{path_from(low)}" fill="#0a0b12"/>')
for i in range(52):
    x = fr.uniform(0, W); base = y_at(low, x) + 8
    h = fr.uniform(70, 150); poly, _, _ = pine(x, base, h, h * .27, fr, .2)
    add(f'<path d="{poly_d(poly)}" fill="#08090f"/>')

add('<rect x="0" y="740" width="1600" height="110" fill="#120d0d" opacity=".55" filter="url(#blur40)"/>')
# Ground
g = [(0, 830)] + [(x, 818 + 10 * math.sin(x / 210) + R.uniform(-2, 2)) for x in range(80, 1600, 80)] + [(W, 826)]
add(f'<path d="{path_from(g)}" fill="url(#ground)"/>')
add(f'<ellipse cx="800" cy="842" rx="560" ry="90" fill="url(#litground)"/>')
add(f'<g filter="url(#grain)" opacity=".55" style="mix-blend-mode:overlay"><rect x="0" y="808" width="{W}" height="92" fill="#fff"/></g>')

# Grass tufts along the ground line
for i in range(190):
    x = R.uniform(0, W); y = y_at(g, x) + R.uniform(-2, 40)
    s = R.uniform(7, 20) * (1 + (y - 818) / 120)
    blades = ''.join(f'M{x:.1f} {y:.1f} q{R.uniform(-6,6):.1f} {-s*0.5:.1f} {R.uniform(-9,9):.1f} {-s:.1f} ' for _ in range(R.randint(3, 6)))
    add(f'<path d="{blades}" stroke="#0a0907" stroke-width="1.4" fill="none" stroke-linecap="round" opacity="{R.uniform(.7,1):.2f}"/>')

# Foreground pines (large, detailed) with warm rim light on the fire-facing side
pr = random.Random(9)
for x, h, w, side in [(48, 780, 190, 1), (205, 600, 150, 1), (350, 470, 112, 1), (1555, 800, 195, -1), (1395, 620, 150, -1), (1250, 480, 112, -1)]:
    poly, left, right = pine(x, 890, h, w, pr)
    add(f'<path d="{poly_d(poly)}" fill="#07080d"/>')
    gid = f'rim{int(x)}'
    x0, x1 = (1, 0) if side == 1 else (0, 1)
    add(f'<linearGradient id="{gid}" x1="{x0}" y1="0" x2="{x1}" y2="0"><stop offset="0" stop-color="#d4702e" stop-opacity=".30"/><stop offset=".35" stop-color="#d4702e" stop-opacity=".07"/><stop offset=".7" stop-color="#d4702e" stop-opacity="0"/></linearGradient>')
    add(f'<path d="{poly_d(poly)}" fill="url(#{gid})"/>')

add(f'<ellipse cx="800" cy="900" rx="900" ry="520" fill="url(#amb)"/>')
add(f'<rect width="{W}" height="{H}" fill="url(#vig)"/>')
add('</svg>')
open('images/campfire-scene.svg', 'w').write('\n'.join(out))
print(len('\n'.join(out)))
