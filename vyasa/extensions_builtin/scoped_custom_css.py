from __future__ import annotations

from pathlib import Path

from fasthtml.common import Style

from ..extensions import ExtensionMeta, VyasaExtensionBase
from ..helpers import content_root_and_relative
from ..sidebar_helpers import _scope_css


class ScopedCustomCssExtension(VyasaExtensionBase):
    def register(self, app) -> None:
        app.layout.scoped_css(_scoped_css_nodes)


def _scoped_css_nodes(context):
    mode = context.get("mode") or "runtime"
    root = Path(context["root_folder"])
    current_path = context.get("current_path")
    section_class = context.get("section_class")
    if mode != "static":
        default_provider = context.get("default_provider")
        return default_provider(root, current_path, section_class) if default_provider else ()
    active_root, relative_path = content_root_and_relative(current_path) if current_path else (None, None)
    root = active_root or root
    css_nodes = []
    for filename in ("global.css", "custom.css", "style.css"):
        css_file = root / filename
        if css_file.exists():
            css_nodes.append(Style(css_file.read_text(encoding="utf-8")))
            if filename != "global.css":
                break
    if not current_path or not section_class:
        return tuple(css_nodes)
    post_dir = relative_path.parent if relative_path and relative_path.parts else Path(".")
    ancestors = [] if str(post_dir) == "." else [Path(*post_dir.parts[:idx]) for idx in range(1, len(post_dir.parts) + 1)]
    for ancestor in ancestors:
        global_css = root / ancestor / "global.css"
        if global_css.exists():
            css_nodes.append(Style(global_css.read_text(encoding="utf-8")))
    for ancestor in ancestors:
        for filename in ("custom.css", "style.css"):
            css_file = root / ancestor / filename
            if css_file.exists():
                css_nodes.append(Style(_scope_css(css_file.read_text(encoding="utf-8"), f"#main-content.{section_class}")))
                break
    return tuple(css_nodes)


EXTENSION = ScopedCustomCssExtension(
    ExtensionMeta(
        "scoped_custom_css",
        "render",
        ("cap:layout:scoped_css",),
        requires=("slot:layout",),
        scope_disable=True,
    )
)
META = EXTENSION.meta

__all__ = ["EXTENSION", "META"]
