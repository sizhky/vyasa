from __future__ import annotations

from starlette.responses import JSONResponse

from ...api_catalog import namespace_catalog, publish_api


def register_mdx_catalog_routes(rt, _runtime) -> None:
    @publish_api(
        rt,
        namespace="mdx",
        operation_id="mdx.catalog.read",
        path="/api/mdx/catalog",
    )
    def mdx_catalog():
        """Discover API contracts published by MDX components."""
        return JSONResponse(namespace_catalog("mdx"), headers={"Cache-Control": "no-store"})
