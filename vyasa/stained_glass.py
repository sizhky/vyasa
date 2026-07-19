#!/usr/bin/env python3
"""Seeded stained-glass pattern generator.

The pane construction is inspired by igr/gart's BSD-licensed Vitrall artwork:
https://github.com/igr/gart/tree/main/arts/lines/src/lines/vitrali
"""

from __future__ import annotations

import argparse
import hashlib
import math
import random
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from shapely.geometry import GeometryCollection, LineString, MultiPolygon, Polygon, box
from shapely.ops import split

Color = tuple[int, int, int]


@dataclass(frozen=True)
class Config:
    width: int = 800
    height: int = 1000
    seed: int = 4
    panes: int = 68
    lead: float = 5.0
    arc_chance: float = 0.50
    slice_chance: float = 0.20
    warp: float = 1.35
    bias: float = 0.50
    supersample: int = 2
    palette: str = "random"
    grain: float = 0.015
    vignette: float = 0.12
    corner_radius: int | None = None
    outer_border: bool = True

    def validate(self) -> None:
        if self.width < 64 or self.height < 64:
            raise ValueError("width and height must be at least 64")
        if not 8 <= self.panes <= 500:
            raise ValueError("panes must be between 8 and 500")
        if not 1 <= self.supersample <= 4:
            raise ValueError("supersample must be between 1 and 4")
        if self.lead <= 0:
            raise ValueError("lead must be positive")
        if self.corner_radius is not None and not (
            0 <= self.corner_radius <= min(self.width, self.height) // 2
        ):
            raise ValueError("corner_radius must fit within half the shortest side")
        if self.palette not in ("random", *PALETTES):
            choices = ", ".join(("random", *PALETTES))
            raise ValueError(f"palette must be one of: {choices}")
        for name, value in (
            ("arc_chance", self.arc_chance),
            ("slice_chance", self.slice_chance),
            ("grain", self.grain),
            ("vignette", self.vignette),
        ):
            if not 0 <= value <= 1:
                raise ValueError(f"{name} must be between 0 and 1")


@dataclass(frozen=True)
class Pane:
    polygon: Polygon
    color_position: float
    light_shift: float = 0.0


# (position, lightness, chroma, hue)
PALETTES: dict[str, tuple[tuple[float, float, float, float], ...]] = {
    "nou": (
        (0.00, 0.30, 0.10, 268),
        (0.15, 0.46, 0.17, 262),
        (0.26, 0.58, 0.12, 232),
        (0.35, 0.62, 0.11, 198),
        (0.45, 0.61, 0.13, 152),
        (0.52, 0.73, 0.14, 118),
        (0.58, 0.86, 0.16, 97),
        (0.66, 0.72, 0.17, 62),
        (0.77, 0.59, 0.20, 36),
        (0.89, 0.46, 0.19, 27),
        (1.00, 0.33, 0.12, 18),
    ),
    "passion": (
        (0.00, 0.93, 0.09, 100),
        (0.16, 0.84, 0.16, 88),
        (0.34, 0.70, 0.18, 60),
        (0.52, 0.58, 0.21, 34),
        (0.68, 0.46, 0.20, 20),
        (0.84, 0.38, 0.15, 355),
        (1.00, 0.27, 0.09, 335),
    ),
    "nativity": (
        (0.00, 0.93, 0.08, 105),
        (0.15, 0.80, 0.14, 120),
        (0.33, 0.63, 0.13, 150),
        (0.50, 0.60, 0.11, 195),
        (0.66, 0.50, 0.15, 245),
        (0.84, 0.40, 0.16, 265),
        (1.00, 0.27, 0.09, 275),
    ),
}


def _polygon_parts(geometry) -> list[Polygon]:
    if geometry.is_empty:
        return []
    if isinstance(geometry, Polygon):
        return [geometry]
    if isinstance(geometry, (MultiPolygon, GeometryCollection)):
        parts: list[Polygon] = []
        for item in geometry.geoms:
            parts.extend(_polygon_parts(item))
        return parts
    return []


def _straight_split(
    polygon: Polygon, point: tuple[float, float], angle: float, extent: float
) -> tuple[Polygon, Polygon] | None:
    dx, dy = math.cos(angle), math.sin(angle)
    line = LineString(
        [
            (point[0] - dx * extent, point[1] - dy * extent),
            (point[0] + dx * extent, point[1] + dy * extent),
        ]
    )
    parts = sorted(
        _polygon_parts(split(polygon, line)), key=lambda p: p.area, reverse=True
    )
    return (parts[0], parts[1]) if len(parts) == 2 else None


def _arc_split(
    polygon: Polygon,
    point: tuple[float, float],
    angle: float,
    pane_extent: float,
    rng: random.Random,
) -> tuple[Polygon, Polygon] | None:
    side = rng.choice((-1.0, 1.0))
    radius = pane_extent * rng.uniform(0.55, 1.45)
    cx = point[0] + math.cos(angle + math.pi / 2) * radius * side
    cy = point[1] + math.sin(angle + math.pi / 2) * radius * side
    circle = Polygon(
        [
            (
                cx + math.cos(i * math.tau / 192) * radius,
                cy + math.sin(i * math.tau / 192) * radius,
            )
            for i in range(192)
        ]
    )
    inside = _polygon_parts(polygon.intersection(circle))
    outside = _polygon_parts(polygon.difference(circle))
    if len(inside) != 1 or len(outside) != 1:
        return None
    return inside[0], outside[0]


def _noise_hash(ix: int, iy: int, seed: int) -> float:
    n = ix * 374761393 + iy * 668265263 + seed * 1442695041
    n = (n ^ (n >> 13)) * 1274126177
    return ((n ^ (n >> 16)) & 0xFFFFFFFF) / 0xFFFFFFFF * 2.0 - 1.0


def _value_noise(x: float, y: float, seed: int) -> float:
    ix, iy = math.floor(x), math.floor(y)
    fx, fy = x - ix, y - iy
    sx = fx * fx * (3.0 - 2.0 * fx)
    sy = fy * fy * (3.0 - 2.0 * fy)
    a = _noise_hash(ix, iy, seed)
    b = _noise_hash(ix + 1, iy, seed)
    c = _noise_hash(ix, iy + 1, seed)
    d = _noise_hash(ix + 1, iy + 1, seed)
    top = a + (b - a) * sx
    bottom = c + (d - c) * sx
    return top + (bottom - top) * sy


def _fbm(x: float, y: float, seed: int) -> float:
    value, amplitude, frequency = 0.0, 0.55, 0.0021
    for octave in range(3):
        value += amplitude * _value_noise(
            x * frequency, y * frequency, seed + octave * 101
        )
        amplitude *= 0.5
        frequency *= 2.2
    return value


def _color_direction(config: Config) -> tuple[float, float]:
    rng = random.Random(config.seed ^ 0xC0105)
    angle = rng.uniform(0, math.tau)
    return math.cos(angle), math.sin(angle)


def _color_position(
    x: float,
    y: float,
    config: Config,
    direction: tuple[float, float],
) -> float:
    dx, dy = direction
    normalized_x = x / config.width - 0.5
    normalized_y = y / config.height - 0.5
    half_span = 0.5 * (abs(dx) + abs(dy))
    along_gradient = 0.5 + (normalized_x * dx + normalized_y * dy) / (2 * half_span)
    value = (
        config.bias
        - 0.5
        + along_gradient
        + config.warp * _fbm(x, y, config.seed) * 0.28
    )
    if value < 0:
        value = -value * 0.7
    if value > 1:
        value = 1 - (value - 1) * 0.7
    return min(1.0, max(0.0, value))


def build_panes(config: Config) -> list[Pane]:
    rng = random.Random(config.seed)
    color_direction = _color_direction(config)
    target_area = config.width * config.height / config.panes
    diagonal = rng.uniform(0.45, 1.1) * rng.choice((-1, 1))
    secondary = diagonal + math.pi / 2
    line_extent = math.hypot(config.width, config.height) * 2

    def cut_angle() -> float:
        roll = rng.random()
        if roll < 0.36:
            base = diagonal
        elif roll < 0.56:
            base = secondary
        elif roll < 0.74:
            base = math.pi / 2
        elif roll < 0.88:
            base = 0.0
        else:
            base = rng.uniform(0, math.pi)
        return base + rng.uniform(-0.09, 0.09)

    stack: list[tuple[Polygon, float, int]] = [
        (box(0, 0, config.width, config.height), 1.0, 0)
    ]
    settled: list[Polygon] = []
    while stack:
        polygon, area_factor, depth = stack.pop()
        if polygon.area < target_area * area_factor:
            settled.append(polygon)
            continue
        minx, miny, maxx, maxy = polygon.bounds
        pane_extent = math.hypot(maxx - minx, maxy - miny)
        cx, cy = polygon.centroid.coords[0]
        result = None
        for _ in range(7):
            angle = cut_angle()
            point = (
                cx + rng.uniform(-0.26, 0.26) * (maxx - minx),
                cy + rng.uniform(-0.26, 0.26) * (maxy - miny),
            )
            if rng.random() < min(1.0, config.arc_chance * (1.6 if depth <= 1 else 1)):
                result = _arc_split(polygon, point, angle, pane_extent, rng)
            else:
                result = _straight_split(polygon, point, angle, line_extent)
            if result and min(result[0].area, result[1].area) > target_area * 0.13:
                break
            result = None
        if result is None:
            settled.append(polygon)
            continue
        for part in result:
            factor = math.exp(rng.uniform(math.log(0.45), math.log(3.0)))
            stack.append((part, factor, depth + 1))

    panes: list[Pane] = []
    for polygon in settled:
        cx, cy = polygon.centroid.coords[0]
        color_position = _color_position(cx, cy, config, color_direction) + rng.uniform(
            -0.045, 0.045
        )
        if rng.random() < 0.07:
            color_position = (color_position + rng.uniform(0.3, 0.7)) % 1.0
        if rng.random() >= config.slice_chance or polygon.area <= target_area * 1.2:
            panes.append(Pane(polygon, min(1, max(0, color_position))))
            continue
        strips = min(
            rng.randint(2, 4), max(1, int(polygon.area / (target_area * 0.14)))
        )
        angle = rng.choice((0.0, math.pi / 2)) + rng.uniform(-0.07, 0.07)
        nx, ny = math.cos(angle + math.pi / 2), math.sin(angle + math.pi / 2)
        projections = [x * nx + y * ny for x, y in polygon.exterior.coords[:-1]]
        low, high = min(projections), max(projections)
        remaining = polygon
        sliced: list[Polygon] = []
        for index in range(1, strips):
            at = low + (high - low) * (index / strips + rng.uniform(-0.05, 0.05))
            result = _straight_split(remaining, (nx * at, ny * at), angle, line_extent)
            if result is None:
                continue
            sliced.append(result[0])
            remaining = result[1]
        sliced.append(remaining)
        for part in sliced:
            panes.append(
                Pane(
                    part,
                    min(1, max(0, color_position + rng.uniform(-0.02, 0.02))),
                    rng.uniform(-0.05, 0.05),
                )
            )
    return panes


def _oklch_to_srgb(lightness: float, chroma: float, hue: float) -> Color:
    radians = math.radians(hue)
    a = chroma * math.cos(radians)
    b = chroma * math.sin(radians)
    l_ = lightness + 0.3963377774 * a + 0.2158037573 * b
    m_ = lightness - 0.1055613458 * a - 0.0638541728 * b
    s_ = lightness - 0.0894841775 * a - 1.2914855480 * b
    light, medium, short = l_**3, m_**3, s_**3
    linear = (
        4.0767416621 * light - 3.3077115913 * medium + 0.2309699292 * short,
        -1.2684380046 * light + 2.6097574011 * medium - 0.3413193965 * short,
        -0.0041960863 * light - 0.7034186147 * medium + 1.7076147010 * short,
    )

    def gamma(value: float) -> int:
        value = max(0.0, min(1.0, value))
        encoded = (
            12.92 * value if value <= 0.0031308 else 1.055 * value ** (1 / 2.4) - 0.055
        )
        return round(max(0.0, min(1.0, encoded)) * 255)

    return tuple(gamma(channel) for channel in linear)  # type: ignore[return-value]


def _random_palette(seed: int) -> tuple[tuple[float, float, float, float], ...]:
    rng = random.Random(seed ^ 0xFACEFEED)
    start_hue = rng.uniform(0, 360)
    hue_distance = rng.choice((-1, 1)) * rng.uniform(70, 220)
    return (
        (0.0, rng.uniform(0.38, 0.78), rng.uniform(0.10, 0.22), start_hue),
        (
            1.0,
            rng.uniform(0.38, 0.82),
            rng.uniform(0.10, 0.23),
            start_hue + hue_distance,
        ),
    )


def _palette_color(
    position: float,
    palette: str,
    seed: int,
    light_shift: float = 0.0,
) -> Color:
    stops = _random_palette(seed) if palette == "random" else PALETTES[palette]
    position = min(1.0, max(0.0, position))
    for left, right in zip(stops, stops[1:]):
        if position <= right[0]:
            fraction = (position - left[0]) / (right[0] - left[0])
            values = [
                left[index] + (right[index] - left[index]) * fraction
                for index in range(1, 4)
            ]
            values[0] = min(0.97, max(0.04, values[0] + light_shift))
            return _oklch_to_srgb(*values)
    return _oklch_to_srgb(*stops[-1][1:])


def _scaled_points(polygon: Polygon, scale: int) -> list[tuple[int, int]]:
    return [(round(x * scale), round(y * scale)) for x, y in polygon.exterior.coords]


def _draw_gradient_pane(
    image: Image.Image, polygon: Polygon, base: Color, rng: random.Random
) -> None:
    points = [(round(x), round(y)) for x, y in polygon.exterior.coords]
    minx, miny, maxx, maxy = (round(v) for v in polygon.bounds)
    width, height = maxx - minx + 1, maxy - miny + 1
    if width <= 1 or height <= 1:
        return
    angle = rng.uniform(0, math.tau)
    yy, xx = np.mgrid[0:height, 0:width]
    projection = xx * math.cos(angle) + yy * math.sin(angle)
    span = float(np.ptp(projection)) or 1.0
    light = 0.78 + 0.34 * (projection - float(projection.min())) / span
    array = np.empty((height, width, 4), dtype=np.uint8)
    array[..., :3] = np.clip(np.asarray(base) * light[..., None], 0, 255).astype(
        np.uint8
    )
    array[..., 3] = 255
    patch = Image.fromarray(array, "RGBA")
    mask = Image.new("L", (width, height))
    local = [(x - minx, y - miny) for x, y in points]
    ImageDraw.Draw(mask).polygon(local, fill=255)
    image.paste(patch, (minx, miny), mask)


def _alpha_composite_masked(
    background: Image.Image,
    foreground: Image.Image,
    offset: tuple[int, int],
    mask: Image.Image,
) -> None:
    background.paste(foreground, offset, mask)


def apply_corner_radius(image: Image.Image, radius: int | None) -> Image.Image:
    image = image.convert("RGBA")
    if radius is None:
        return image
    mask = Image.new("L", image.size)
    ImageDraw.Draw(mask).rounded_rectangle(
        (0, 0, image.width - 1, image.height - 1), radius=radius, fill=255
    )
    image.putalpha(mask)
    return image


def render(config: Config) -> Image.Image:
    config.validate()
    panes = build_panes(config)
    scale = config.supersample
    size = (config.width * scale, config.height * scale)
    image = Image.new("RGBA", size, (15, 12, 9, 255))
    rng = random.Random(config.seed * 31 + 5)

    for pane in panes:
        scaled = Polygon(
            [(x * scale, y * scale) for x, y in pane.polygon.exterior.coords]
        )
        jitter = rng.uniform(-0.02, 0.02)
        base = _palette_color(
            pane.color_position,
            config.palette,
            config.seed,
            pane.light_shift + jitter,
        )
        _draw_gradient_pane(image, scaled, base, rng)

    lead_width = max(1, round(config.lead * scale))
    lead_mask = Image.new("L", size)
    lead_draw = ImageDraw.Draw(lead_mask)
    for pane in panes:
        lead_draw.line(
            _scaled_points(pane.polygon, scale),
            fill=255,
            width=lead_width,
            joint="curve",
        )
    if config.outer_border:
        lead_draw.rectangle(
            (0, 0, size[0] - 1, size[1] - 1),
            outline=255,
            width=max(1, round(lead_width * 2.2)),
        )
    else:
        edge = lead_width
        lead_draw.rectangle((0, 0, size[0] - 1, edge - 1), fill=0)
        lead_draw.rectangle((0, size[1] - edge, size[0] - 1, size[1] - 1), fill=0)
        lead_draw.rectangle((0, 0, edge - 1, size[1] - 1), fill=0)
        lead_draw.rectangle((size[0] - edge, 0, size[0] - 1, size[1] - 1), fill=0)

    shadow = lead_mask.filter(ImageFilter.GaussianBlur(lead_width * 0.9))
    shadow_array = np.asarray(shadow, dtype=np.float32) / 255.0
    pixels = np.asarray(image, dtype=np.float32).copy()
    pixels[..., :3] *= 1.0 - shadow_array[..., None] * 0.42
    image = Image.fromarray(np.clip(pixels, 0, 255).astype(np.uint8), "RGBA")
    lead_layer = Image.new("RGBA", size, (20, 16, 12, 255))
    _alpha_composite_masked(image, lead_layer, (0, 0), lead_mask)

    if config.vignette:
        yy, xx = np.mgrid[-1 : 1 : complex(size[1]), -1 : 1 : complex(size[0])]
        distance = np.sqrt(xx * xx + yy * yy) / math.sqrt(2)
        factor = 1.0 - config.vignette * np.clip(distance, 0, 1) ** 1.8
        pixels = np.asarray(image, dtype=np.float32).copy()
        pixels[..., :3] *= factor[..., None]
        image = Image.fromarray(np.clip(pixels, 0, 255).astype(np.uint8), "RGBA")

    if config.grain:
        grain_rng = np.random.default_rng(config.seed)
        noise = grain_rng.normal(0, config.grain * 255, (size[1], size[0], 1))
        pixels = np.asarray(image, dtype=np.float32).copy()
        pixels[..., :3] += noise
        image = Image.fromarray(np.clip(pixels, 0, 255).astype(np.uint8), "RGBA")

    if scale > 1:
        image = image.resize((config.width, config.height), Image.Resampling.LANCZOS)
    return apply_corner_radius(image, config.corner_radius)


def image_digest(image: Image.Image) -> str:
    return hashlib.sha256(image.tobytes()).hexdigest()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--seed", type=int, default=4)
    parser.add_argument("--width", type=int, default=800)
    parser.add_argument("--height", type=int, default=1000)
    parser.add_argument("--panes", type=int, default=68)
    parser.add_argument("--lead", type=float, default=5.0)
    parser.add_argument("--arc", type=float, default=0.50, dest="arc_chance")
    parser.add_argument("--slice", type=float, default=0.20, dest="slice_chance")
    parser.add_argument("--warp", type=float, default=1.35)
    parser.add_argument("--bias", type=float, default=0.50)
    parser.add_argument("--supersample", type=int, default=2)
    parser.add_argument(
        "--palette",
        choices=sorted(("random", *PALETTES)),
        default="random",
    )
    parser.add_argument("--grain", type=float, default=0.015)
    parser.add_argument("--vignette", type=float, default=0.12)
    parser.add_argument("--corner-radius", type=int)
    parser.add_argument("--no-border", action="store_false", dest="outer_border")
    parser.add_argument("-o", "--output", type=Path, default=Path("stained-glass.png"))
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    output = args.output.expanduser()
    config_values = vars(args).copy()
    config_values.pop("output")
    config = Config(**config_values)
    image = render(config)
    output.parent.mkdir(parents=True, exist_ok=True)
    image.save(output, optimize=True)
    print(f"saved {output} ({image.width}x{image.height}, seed={config.seed})")
    print(f"sha256-pixels {image_digest(image)}")


if __name__ == "__main__":
    main()
