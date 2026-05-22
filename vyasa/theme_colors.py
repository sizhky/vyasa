from __future__ import annotations

import math
import re

_HEX_RE = re.compile(r"^#(?P<hex>[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$")
_TARGET_L = 0.56
_MAX_C = 0.16
_DIM_L = 0.48
_DARK_TEXT = "#101718"
_LIGHT_TEXT = "#f2f4f3"


def _hex_to_rgb(color: str) -> tuple[float, float, float] | None:
    match = _HEX_RE.match(str(color).strip())
    if not match:
        return None
    value = match.group("hex")
    if len(value) == 3:
        value = "".join(ch * 2 for ch in value)
    return tuple(int(value[i:i + 2], 16) / 255 for i in (0, 2, 4))


def _srgb_to_linear(value: float) -> float:
    return value / 12.92 if value <= 0.04045 else ((value + 0.055) / 1.055) ** 2.4


def _linear_to_srgb(value: float) -> float:
    value = max(0.0, min(1.0, value))
    return 12.92 * value if value <= 0.0031308 else 1.055 * (value ** (1 / 2.4)) - 0.055


def _rgb_to_oklch(rgb: tuple[float, float, float]) -> tuple[float, float, float]:
    r, g, b = (_srgb_to_linear(channel) for channel in rgb)
    l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b
    m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
    s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b
    l_, m_, s_ = l ** (1 / 3), m ** (1 / 3), s ** (1 / 3)
    light = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_
    a = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_
    b2 = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_
    chroma = math.hypot(a, b2)
    hue = math.degrees(math.atan2(b2, a)) % 360
    return light, chroma, hue


def _oklch_to_rgb(light: float, chroma: float, hue: float) -> tuple[float, float, float]:
    angle = math.radians(hue)
    a = chroma * math.cos(angle)
    b = chroma * math.sin(angle)
    l_ = light + 0.3963377774 * a + 0.2158037573 * b
    m_ = light - 0.1055613458 * a - 0.0638541728 * b
    s_ = light - 0.0894841775 * a - 1.2914855480 * b
    l, m, s = l_ ** 3, m_ ** 3, s_ ** 3
    r = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
    g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
    b2 = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
    return tuple(_linear_to_srgb(channel) for channel in (r, g, b2))


def _relative_luminance(rgb: tuple[float, float, float]) -> float:
    r, g, b = (_srgb_to_linear(channel) for channel in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def _contrast_ratio(l1: float, l2: float) -> float:
    hi, lo = max(l1, l2), min(l1, l2)
    return (hi + 0.05) / (lo + 0.05)


def normalize_theme_primary(color: str) -> dict[str, str]:
    rgb = _hex_to_rgb(color)
    if rgb is None:
        return {}
    _, chroma, hue = _rgb_to_oklch(rgb)
    normalized_chroma = min(chroma, _MAX_C)
    primary = f"oklch({_TARGET_L:.3f} {normalized_chroma:.3f} {hue:.1f}deg)"
    primary_dim = f"oklch({_DIM_L:.3f} {min(normalized_chroma, _MAX_C * 0.92):.3f} {hue:.1f}deg)"
    primary_luminance = _relative_luminance(_oklch_to_rgb(_TARGET_L, normalized_chroma, hue))
    dark_luminance = _relative_luminance(_hex_to_rgb(_DARK_TEXT))
    light_luminance = _relative_luminance(_hex_to_rgb(_LIGHT_TEXT))
    primary_text = _DARK_TEXT if _contrast_ratio(primary_luminance, dark_luminance) >= _contrast_ratio(primary_luminance, light_luminance) else _LIGHT_TEXT
    return {
        "theme_primary": primary,
        "theme_primary_dim": primary_dim,
        "theme_primary_text": primary_text,
        "theme_dark_primary_text": primary_text,
    }
