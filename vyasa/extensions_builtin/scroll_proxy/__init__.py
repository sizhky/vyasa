from __future__ import annotations

import os
from pathlib import Path
from urllib.parse import quote

from ...extensions import AssetBundle, ExtensionMeta, VyasaExtensionBase


def _module_query() -> str:
    params = []
    if os.environ.get("VYASA_SCROLL_PROXY_RANDOM", "").strip().lower() in {"1", "true", "yes", "on"}:
        params.append("random=1")
    sources = os.environ.get("VYASA_SCROLL_PROXY_THEMES", "").strip()
    if sources:
        params.append("themes=" + quote(sources, safe=",:/-._~"))
    return f"?{'&'.join(params)}" if params else ""


class ScrollProxyExtension(VyasaExtensionBase):
    def register(self, app) -> None:
        app.assets.bundle(
            AssetBundle(
                "scroll_proxy.runtime",
                css=("/static/extensions/scroll_proxy/scroll_proxy.css",),
                js=(f"/static/extensions/scroll_proxy/scroll_proxy.js{_module_query()}",),
                static_dir=Path(__file__).parent / "static",
            )
        )
        app.assets.page(_page_bundles)


def _page_bundles(context):
    return () if context.get("slide_mode") else ("scroll_proxy.runtime",)


EXTENSION = ScrollProxyExtension(
    ExtensionMeta(
        "scroll_proxy",
        "render",
        ("bundle:scroll_proxy.runtime",),
        asset_bundles=("scroll_proxy.runtime",),
        description="Seasonal, extensible document scroll proxy.",
    )
)
META = EXTENSION.meta

__all__ = ["EXTENSION", "META"]
