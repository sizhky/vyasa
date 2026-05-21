from ...extensions import AssetBundle, ExtensionMeta, VyasaExtensionBase
from ...runtime_services import get_runtime_services
from .api import CallableAnnotationStore, register_annotations_routes
from .store import delete_annotation, list_annotations, upsert_annotation


class AnnotationsExtension(VyasaExtensionBase):
    def register(self, app) -> None:
        app.storage.namespace("annotations")
        app.routes.add("/api/annotations", _register_annotations_routes)
        app.assets.page(_page_bundles)
        app.layout.main_attrs(_main_attrs)
        app.assets.bundle(
            AssetBundle(
                "annotations.runtime",
                js=("/static/extensions/annotations/annotations.js",),
            )
        )


def _register_annotations_routes(rt, runtime):
    from ...config import get_config

    cache = {"db": None, "tbl": None}

    def _db_list(path: str):
        return list_annotations(get_config().get_root_folder(), cache, path)

    def _db_upsert(row):
        upsert_annotation(get_config().get_root_folder(), cache, row)

    def _db_delete(annotation_id: str):
        return delete_annotation(get_config().get_root_folder(), cache, annotation_id)

    register_annotations_routes(
        rt,
        runtime,
        CallableAnnotationStore(_db_list, _db_upsert, _db_delete),
    )


def _page_bundles(context):
    if context.get("annotations_enabled") and context.get("current_path") and not context.get("slide_mode"):
        return ("annotations.runtime",)
    return ()


_page_bundles.page_asset_priority = 30


def _main_attrs(context):
    if context.get("slide_mode"):
        return {
            "data-annotations-enabled": "0",
            "data-slide-mode": "1",
        }
    services = get_runtime_services()
    auth = context.get("auth")
    if auth:
        author = auth.get("name") or auth.get("email") or auth.get("username") or "anonymous"
    else:
        author = "anonymous"
    return {
        "data-annotations-enabled": "1" if services.get_config().get_annotations_enabled() else "0",
        "data-annotation-path": context.get("current_path") or "__index__",
        "data-annotation-author": author,
        "data-slide-mode": "0",
    }


EXTENSION = AnnotationsExtension(
    ExtensionMeta(
        "annotations",
        "route",
        ("cap:route:annotations", "bundle:annotations.runtime", "cap:layout:main_attrs"),
        route_prefixes=("/api/annotations",),
        storage_namespaces=("annotations",),
        scope_disable=True,
    )
)
META = EXTENSION.meta

__all__ = ["EXTENSION", "META"]
