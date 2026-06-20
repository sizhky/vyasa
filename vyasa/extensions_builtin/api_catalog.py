from starlette.responses import JSONResponse

from ..api_catalog import build_vyasa_api_catalog, publish_api
from ..extensions import ExtensionMeta, VyasaExtensionBase, get_extension_runtime


def register_api_catalog_routes(rt, _runtime) -> None:
    @publish_api(
        rt,
        namespace="vyasa",
        operation_id="vyasa.catalog.read",
        path="/api/catalog",
    )
    def api_catalog():
        """Discover API contracts published by enabled Vyasa extensions."""
        return JSONResponse(build_vyasa_api_catalog(get_extension_runtime()), headers={"Cache-Control": "no-store"})


class ApiCatalogExtension(VyasaExtensionBase):
    def register(self, app) -> None:
        app.routes.add("/api/catalog", register_api_catalog_routes)


EXTENSION = ApiCatalogExtension(
    ExtensionMeta(
        "api_catalog",
        "route",
        ("cap:route:api_catalog",),
        route_prefixes=("/api/catalog",),
        scope_disable=True,
        description="Aggregates decorated API contracts published by extensions.",
    )
)
META = EXTENSION.meta

__all__ = ["EXTENSION", "META"]
