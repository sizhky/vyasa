from ..extensions import ExtensionMeta, VyasaExtensionBase
from .default_search_routes import register_default_search_routes


class DefaultSearchExtension(VyasaExtensionBase):
    def register(self, app) -> None:
        app.routes.add("/search/gather", register_default_search_routes)
        app.routes.add("/search/preview", register_default_search_routes)
        app.routes.add("/search/preview/s", register_default_search_routes)
        app.routes.add("/_sidebar/posts/search", register_default_search_routes)


EXTENSION = DefaultSearchExtension(
    ExtensionMeta(
        "default_search",
        "search",
        ("slot:search_provider",),
        requires=("slot:layout",),
        route_prefixes=("/search/gather", "/search/preview", "/search/preview/s", "/_sidebar/posts/search"),
    )
)
META = EXTENSION.meta

__all__ = ["EXTENSION", "META"]
