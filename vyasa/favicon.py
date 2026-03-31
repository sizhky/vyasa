import hashlib, math
from pathlib import Path


def favicon_href(root_folder):
    return "/static/icon.png" if (Path(root_folder) / "static" / "icon.png").exists() else "/static/icon.svg"


def favicon_class(root_folder):
    s = hashlib.sha256(str(Path(root_folder).resolve()).encode()).digest()
    return s[0] % 3, s[14] % 3


def favicon_svg(root_folder):
    s = hashlib.sha256(str(Path(root_folder).resolve()).encode()).digest(); h = [(s[i] * 360) // 256 for i in (1, 7, 13)]
    bg, c1, c2 = f"hsl({h[0]} 80% 97%)", f"hsl({h[1]} 72% 48%)", f"hsl({h[2]} 62% 34%)"
    def glyph(mode, scale=1.0):
        if mode == 0:
            pts = " ".join(f"{32 + scale * (7 if i % 2 == 0 else 3.5) * math.cos(-math.pi/2 + i * math.pi/4):.1f},{32 + scale * (7 if i % 2 == 0 else 3.5) * math.sin(-math.pi/2 + i * math.pi/4):.1f}" for i in range(8))
            return f'<polygon points="{pts}" fill="{c2}" opacity=".18" stroke="{c2}" stroke-width="1.8"/>'
        if mode == 1:
            pts = " ".join(f"{32 + scale * 6 * math.sin((2 + s[15] % 3) * (i/35) * 2 * math.pi + (s[16]/255) * math.pi):.1f},{32 + scale * 6 * math.sin((3 + s[17] % 3) * (i/35) * 2 * math.pi):.1f}" for i in range(36))
            return f'<polyline points="{pts}" fill="none" stroke="{c2}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>'
        pts = [(32 + scale * (5 + s[18 + i] % 4) * math.cos((i / 5) * 2 * math.pi), 32 + scale * (5 + s[18 + i] % 4) * math.sin((i / 5) * 2 * math.pi)) for i in range(5)]
        lines = "".join(f'<line x1="{pts[i][0]:.1f}" y1="{pts[i][1]:.1f}" x2="{pts[(i+2)%5][0]:.1f}" y2="{pts[(i+2)%5][1]:.1f}" stroke="{c2}" stroke-width="1.5" opacity=".8"/>' for i in range(3))
        dots = "".join(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="1.8" fill="{c2}"/>' for x, y in pts)
        return lines + dots
    def truchet_bg():
        tiles = []
        for y in range(0, 64, 16):
            for x in range(0, 64, 16):
                k = s[(x + y) // 16 % len(s)] % 2; stroke = c1 if (x + y) // 16 % 3 else c2
                if k == 0:
                    d = f"M{x},{y+8} A8 8 0 0 1 {x+8},{y} M{x+8},{y+16} A8 8 0 0 1 {x+16},{y+8}"
                else:
                    d = f"M{x+8},{y} A8 8 0 0 1 {x+16},{y+8} M{x},{y+8} A8 8 0 0 1 {x+8},{y+16}"
                tiles.append(f'<path d="{d}" fill="none" stroke="{stroke}" stroke-opacity=".18" stroke-width="3" stroke-linecap="round"/>')
        return "".join(tiles)
    def poly(n, r1, r2):
        pts = []
        for i in range(n * 2):
            a = -math.pi / 2 + i * math.pi / n; r = r2 if i % 2 == 0 else r1
            pts.append(f"{32 + r * math.cos(a):.1f},{32 + r * math.sin(a):.1f}")
        return " ".join(pts)
    def outer_constellation():
        pts = []
        for i in range(6):
            a = -math.pi / 2 + (i / 6) * 2 * math.pi + (s[5] / 255) * 0.7
            r = 16 + (s[6 + i] % 6)
            pts.append((32 + r * math.cos(a), 32 + r * math.sin(a)))
        order = sorted(range(len(pts)), key=lambda i: pts[i][0] + pts[i][1])
        lines = "".join(
            f'<line x1="{pts[a][0]:.1f}" y1="{pts[a][1]:.1f}" x2="{pts[b][0]:.1f}" y2="{pts[b][1]:.1f}" stroke="{c1}" stroke-width="2.2" opacity=".85"/>'
            for a, b in zip(order, order[1:])
        )
        dots = "".join(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="2.3" fill="{c2}"/>' for x, y in pts)
        return f'{lines}{dots}<circle cx="32" cy="32" r="21.5" fill="none" stroke="{c1}" stroke-opacity=".18" stroke-width="1.2"/>'
    outer_mode, inner_mode = s[0] % 3, s[14] % 3
    families = (
        lambda: f'<polygon points="{poly(5 + s[2] % 4, 10 + s[3] % 4, 22)}" fill="{c1}" opacity=".18" stroke="{c1}" stroke-width="2.4"/>{glyph(inner_mode, .75)}',
        lambda: "".join(f'<ellipse cx="32" cy="32" rx="{18 + s[i] % 4}" ry="{8 + s[i+1] % 3}" transform="rotate({(s[i+2] % 180)} 32 32)" fill="none" stroke="{c}" stroke-width="3"/>' for i, c in ((4, c1), (8, c2), (12, c1))) + glyph(inner_mode, .72),
        lambda: f'{outer_constellation()}{glyph(inner_mode, .78)}',
    )
    body = families[outer_mode]()
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="{bg}"/>{truchet_bg()}<circle cx="32" cy="32" r="25" fill="white" fill-opacity=".42" stroke="white" stroke-opacity=".5" stroke-width="1.2"/>{body}</svg>'


def write_generated_favicon(root_folder, destination):
    Path(destination).write_text(favicon_svg(root_folder), encoding="utf-8")
