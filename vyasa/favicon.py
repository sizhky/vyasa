import hashlib
from functools import lru_cache
from pathlib import Path

from .favicon_legacy import favicon_class as favicon_class
from .favicon_legacy import favicon_svg as legacy_favicon_svg

__all__ = [
    "favicon_class",
    "favicon_href",
    "favicon_svg",
    "legacy_favicon_svg",
    "write_generated_favicon",
]


_BACKGROUNDS = (
    "#111827",
    "#172554",
    "#3B0764",
    "#4C0519",
    "#052E16",
    "#042F2E",
    "#3F1D0B",
    "#1E1B4B",
    "#0C4A6E",
    "#18181B",
)
_FOREGROUNDS = (
    "#FBBF24",
    "#67E8F9",
    "#F9A8D4",
    "#FDBA74",
    "#86EFAC",
    "#FDE047",
    "#FECDD3",
    "#C4B5FD",
    "#FDE68A",
    "#F4F4F5",
)
_CUT_COLOR = "#FAFAFA"
_COMPOSITIONS = ("cut-inlay", "inlay-cut", "cut-inlay-cut")
_SILHOUETTES = (
    '<circle cx="32" cy="32" r="29"/>',
    '<rect x="4" y="4" width="56" height="56" rx="13"/>',
    '<path d="M32 2 62 32 32 62 2 32Z"/>',
    '<path d="M32 2 58 17v30L32 62 6 47V17Z"/>',
    (
        '<circle cx="32" cy="17" r="15"/><circle cx="47" cy="32" r="15"/>'
        '<circle cx="32" cy="47" r="15"/><circle cx="17" cy="32" r="15"/>'
        '<rect x="17" y="17" width="30" height="30"/>'
    ),
    '<path d="M32 3 58 12v20c0 14-9 24-26 30C15 56 6 46 6 32V12Z"/>',
)
_MOTIFS = (
    '<rect x="27" y="8" width="10" height="48" rx="2"/>'
    '<rect x="8" y="27" width="48" height="10" rx="2"/>',
    (
        '<ellipse cx="32" cy="16" rx="7" ry="14"/>'
        '<ellipse cx="48" cy="32" rx="14" ry="7"/>'
        '<ellipse cx="32" cy="48" rx="7" ry="14"/>'
        '<ellipse cx="16" cy="32" rx="14" ry="7"/>'
    ),
    (
        '<path d="M32 32 22 8 42 8Z"/><path d="M32 32 56 22 56 42Z"/>'
        '<path d="M32 32 42 56 22 56Z"/><path d="M32 32 8 42 8 22Z"/>'
    ),
    (
        '<path d="M8 24 32 9 56 24 49 32 32 21 15 32Z"/>'
        '<path d="M8 40 32 25 56 40 49 48 32 37 15 48Z"/>'
    ),
    (
        '<circle cx="32" cy="14" r="8"/><circle cx="50" cy="32" r="8"/>'
        '<circle cx="32" cy="50" r="8"/><circle cx="14" cy="32" r="8"/>'
    ),
    '<path d="M32 6 41 23 58 32 41 41 32 58 23 41 6 32 23 23Z"/>',
)


def favicon_href(root_folder: str | Path) -> str:
    return (
        "/static/icon.png"
        if (Path(root_folder) / "static" / "icon.png").exists()
        else "/static/icon.svg"
    )


def favicon_svg(root_folder: str | Path) -> str:
    return _favicon_svg(str(Path(root_folder).resolve()))


@lru_cache(maxsize=128)
def _favicon_svg(root_folder: str) -> str:
    digest = hashlib.sha256(root_folder.encode()).digest()
    background = _BACKGROUNDS[digest[0] % len(_BACKGROUNDS)]
    foreground = _FOREGROUNDS[digest[3] % len(_FOREGROUNDS)]
    silhouette = _SILHOUETTES[digest[1] % len(_SILHOUETTES)]
    motif = _MOTIFS[digest[2] % len(_MOTIFS)]
    inner = _MOTIFS[digest[4] % len(_MOTIFS)]
    composition = _COMPOSITIONS[digest[6] % len(_COMPOSITIONS)]
    clip_id = f"favicon-{digest[:4].hex()}"
    layers = _compose(
        composition,
        motif,
        inner,
        background,
        foreground,
    )
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" '
        f'data-composition="{composition}">'
        f'<defs><clipPath id="{clip_id}">{silhouette}</clipPath></defs>'
        f"{_paint(silhouette, background)}"
        f'<g clip-path="url(#{clip_id})">{layers}</g></svg>'
    )


def _paint(shape: str, color: str, scale: float = 1) -> str:
    transform = (
        ""
        if scale == 1
        else f' transform="translate(32 32) scale({scale}) translate(-32 -32)"'
    )
    return f'<g fill="{color}"{transform}>{shape}</g>'


def _compose(
    composition: str,
    motif: str,
    inner: str,
    background: str,
    foreground: str,
) -> str:
    if composition == "cut-inlay":
        return _paint(motif, _CUT_COLOR) + _paint(motif, foreground, 0.58)
    if composition == "inlay-cut":
        return _paint(motif, foreground, 0.94) + _paint(inner, background, 0.42)
    return (
        _paint(motif, _CUT_COLOR)
        + _paint(motif, foreground, 0.72)
        + _paint(inner, background, 0.36)
        + _paint(inner, _CUT_COLOR, 0.15)
    )


def write_generated_favicon(root_folder: str | Path, destination: str | Path) -> None:
    Path(destination).write_text(favicon_svg(root_folder), encoding="utf-8")
