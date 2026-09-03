"""Registry-driven markdown visuals.

Every entry in `registry.REGISTRY` becomes a fence of the same name. The fence
handler is shared: it loads rows (inline or from `src=`), calls the renderer,
and turns an author mistake into a visible card rather than a 500.
"""

from __future__ import annotations

from ...extensions import AssetBundle, ExtensionMeta, VyasaExtensionBase, request_asset_bundle
from .parse import VisualError, load_rows, parse_rows
from .registry import REGISTRY, Visual, capabilities
from .render import render_error

BUNDLE = "visuals.styles"


def render_visual(visual: Visual, code: str, context, attrs) -> str:
    request_asset_bundle(BUNDLE)
    try:
        rows = (
            load_rows(attrs, visual.cell_names, getattr(context, "current_path", None))
            if attrs.get("src")
            else parse_rows(code, visual.cell_names)
        )
        return visual.render(rows, attrs)
    except VisualError as error:
        return render_error(visual.name, str(error))
    except Exception as error:  # a bad data file must not take the page down
        return render_error(visual.name, f"{type(error).__name__}: {error}")


class VisualsExtension(VyasaExtensionBase):
    def register(self, app) -> None:
        app.assets.bundle(AssetBundle(BUNDLE, css=("/static/extensions/visuals/visuals.css",)))
        for visual in REGISTRY.values():
            app.markdown.fence(
                visual.name,
                lambda code, context, attrs, visual=visual: render_visual(visual, code, context, attrs),
            )


EXTENSION = VisualsExtension(
    ExtensionMeta(
        "visuals",
        "render",
        capabilities() + (f"bundle:{BUNDLE}",),
        requires=("cap:markdown_pipeline",),
        description="Register of markdown visuals: card, bar, stack.",
    )
)
META = EXTENSION.meta

__all__ = ["EXTENSION", "META", "REGISTRY"]
