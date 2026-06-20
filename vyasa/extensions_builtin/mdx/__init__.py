from pathlib import Path

from ...extensions import AssetBundle, ExtensionMeta, VyasaExtensionBase
from .catalog import register_mdx_catalog_routes
from .excalidraw_routes import register_excalidraw_routes
from .file_routes import register_mdx_file_routes
from .render import is_mdx_path, render_mdx_document, render_static_mdx_document


class MdxExtension(VyasaExtensionBase):
    def register(self, app) -> None:
        app.documents.kind_resolver("mdx", "file-code", is_mdx_path)
        app.documents.renderer("mdx", render_mdx_document)
        app.documents.static_renderer("mdx", render_static_mdx_document)
        app.routes.add("/api/mdx/files", register_mdx_file_routes, methods=("GET", "POST"))
        app.routes.add("/api/mdx/catalog", register_mdx_catalog_routes)
        app.routes.add(
            "/api/mdx/excalidraw",
            register_excalidraw_routes,
            methods=("GET", "POST", "PATCH"),
        )
        app.assets.bundle(
            AssetBundle(
                "mdx.runtime",
                js=("/static/extensions/mdx/excalidraw.js", "/static/extensions/mdx/mdx.js"),
                static_dir=Path(__file__).parent / "static",
            )
        )


EXTENSION = MdxExtension(
    ExtensionMeta(
        "mdx",
        "render",
        ("cap:document_type:mdx", "bundle:mdx.runtime"),
        requires=("slot:layout", "cap:markdown_pipeline"),
        route_prefixes=("/api/mdx/files", "/api/mdx/catalog", "/api/mdx/excalidraw"),
        scope_disable=True,
    )
)
META = EXTENSION.meta

__all__ = ["EXTENSION", "META"]
