"""Draw the low-poly Moon icon.

Points on concentric rings are lifted onto a hemisphere, joined into triangles,
and each triangle is flat-shaded from its own normal, so the facets read as polygons.
A few dark patches stand in for the maria.

Writes:
  assets/icon.svg              favicon and in-page logo
  assets/apple-touch-icon.png  180x180 home-screen icon (opaque background)
Requires Pillow and NumPy.
Usage: python3 scripts/make_icon.py
"""
import math
import random
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
RINGS = [(0.0, 1), (0.36, 7), (0.68, 13), (1.0, 19)]  # (radius, points)
LIGHT = np.array([-0.55, -0.6, 0.58])                 # from the upper left (screen y points down)
LIGHT = LIGHT / np.linalg.norm(LIGHT)
# Dark mare patches as (x, y, radius) in the unit disk. Loosely the near side: Imbrium, Serenitatis, Tranquillitatis, Procellarum.
MARIA = [(-0.25, -0.35, 0.3), (0.2, -0.35, 0.2), (0.3, -0.05, 0.24), (-0.5, 0.0, 0.28), (-0.1, 0.35, 0.16)]
BG = (7, 9, 13)


def ring_points():
    rnd = random.Random(7)
    rings = []
    for r, n in RINGS:
        offset = rnd.uniform(0, 2 * math.pi)
        pts = []
        for i in range(n):
            a = offset + 2 * math.pi * i / n + (rnd.uniform(-0.18, 0.18) if 0 < r < 1 else 0)
            rr = r if r in (0, 1) else r + rnd.uniform(-0.05, 0.05)
            pts.append((rr * math.cos(a), rr * math.sin(a), a % (2 * math.pi)))
        rings.append(sorted(pts, key=lambda p: p[2]))
    return rings


def triangulate(rings):
    tris = []
    center, first = rings[0][0], rings[1]
    for i in range(len(first)):
        tris.append((center, first[i], first[(i + 1) % len(first)]))
    tau = 2 * math.pi
    for inner, outer in zip(rings[1:], rings[2:]):
        # Measure every angle from inner[0], then walk both rings in angle order,
        # always advancing the ring whose next point comes first.
        ref = inner[0][2]
        rel = lambda p: (p[2] - ref) % tau
        outer = sorted(outer, key=rel)
        A = [rel(p) for p in inner] + [tau]
        B = [rel(p) for p in outer] + [rel(outer[0]) + tau]
        n, m, i, j = len(inner), len(outer), 0, 0
        while i < n or j < m:
            if j == m or (i < n and A[i + 1] < B[j + 1]):
                tris.append((inner[i], inner[(i + 1) % n], outer[j % m])); i += 1
            else:
                tris.append((inner[i % n], outer[j], outer[(j + 1) % m])); j += 1
    return tris


def lift(p):
    x, y = p[0], p[1]
    return np.array([x, y, math.sqrt(max(0.0, 1 - x * x - y * y))])


def shade(tri):
    a, b, c = (lift(p) for p in tri)
    n = np.cross(b - a, c - a)
    if n[2] < 0:
        n = -n
    n = n / np.linalg.norm(n)
    lambert = max(0.0, float(n @ LIGHT))
    cx, cy = sum(p[0] for p in tri) / 3, sum(p[1] for p in tri) / 3
    albedo = 1.0
    for mx, my, mr in MARIA:
        if math.hypot(cx - mx, cy - my) < mr:
            albedo = 0.5
    v = (0.16 + 0.84 * lambert) * albedo
    # Slight blue bias in the shadows, warm-neutral in the light.
    return (int(min(255, 40 + 196 * v)), int(min(255, 44 + 196 * v)), int(min(255, 54 + 192 * v)))


def main():
    tris = triangulate(ring_points())
    shaded = [(t, shade(t)) for t in tris]

    size, pad = 64, 3
    s = (size - 2 * pad) / 2
    to = lambda p: (round(size / 2 + p[0] * s, 2), round(size / 2 + p[1] * s, 2))
    polys = "".join(
        f'<polygon points="{" ".join(f"{x},{y}" for x, y in map(to, t))}" fill="#{r:02x}{g:02x}{b:02x}" stroke="#{r:02x}{g:02x}{b:02x}" stroke-width=".4" stroke-linejoin="round"/>'
        for t, (r, g, b) in shaded
    )
    (ROOT / "assets" / "icon.svg").write_text(
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}">{polys}</svg>\n', encoding="utf-8")

    big = 180 * 4
    img = Image.new("RGB", (big, big), BG)
    d = ImageDraw.Draw(img)
    s2, c2 = big * 0.4, big / 2
    for t, col in shaded:
        d.polygon([(c2 + p[0] * s2, c2 + p[1] * s2) for p in t], fill=col, outline=col)
    img.resize((180, 180), Image.LANCZOS).save(ROOT / "assets" / "apple-touch-icon.png", optimize=True)
    print(f"{len(tris)} triangles")


if __name__ == "__main__":
    main()
