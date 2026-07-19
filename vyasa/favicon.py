import base64
import hashlib
import io
from functools import lru_cache
from pathlib import Path

from .favicon_legacy import favicon_class as favicon_class
from .favicon_legacy import favicon_svg as legacy_favicon_svg
from .stained_glass import Config, render

__all__ = [
    "favicon_class",
    "favicon_href",
    "favicon_svg",
    "legacy_favicon_svg",
    "write_generated_favicon",
]


def favicon_href(root_folder):
    return (
        "/static/icon.png"
        if (Path(root_folder) / "static" / "icon.png").exists()
        else "/static/icon.svg"
    )


def favicon_svg(root_folder):
    return _favicon_svg(str(Path(root_folder).resolve()))


@lru_cache(maxsize=128)
def _favicon_svg(root_folder: str) -> str:
    digest = hashlib.sha256(root_folder.encode()).digest()
    seed = int.from_bytes(digest[:8], "big")
    image = render(
        Config(
            width=64,
            height=64,
            seed=seed,
            panes=18,
            lead=1.3,
            supersample=2,
            grain=0.01,
            corner_radius=32,
            outer_border=False,
        )
    )
    output = io.BytesIO()
    image.save(output, format="PNG", optimize=True)
    encoded = base64.b64encode(output.getvalue()).decode("ascii")
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">'
        f'<image width="64" height="64" href="data:image/png;base64,{encoded}"/></svg>'
    )


def write_generated_favicon(root_folder, destination):
    Path(destination).write_text(favicon_svg(root_folder), encoding="utf-8")
