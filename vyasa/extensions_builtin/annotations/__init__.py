from ...extensions import AssetBundle, ExtensionMeta, VyasaExtensionBase
from .api import CallableAnnotationStore, register_annotations_routes
from .store import delete_annotation, list_annotations, upsert_annotation


class AnnotationsExtension(VyasaExtensionBase):
    def register(self, app) -> None:
        app.storage.namespace("annotations")
        app.routes.add("/api/annotations", _register_annotations_routes)
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


EXTENSION = AnnotationsExtension(
    ExtensionMeta(
        "annotations",
        "route",
        ("cap:route:annotations", "bundle:annotations.runtime"),
        route_prefixes=("/api/annotations",),
        storage_namespaces=("annotations",),
        scope_disable=True,
    )
)
META = EXTENSION.meta

__all__ = ["EXTENSION", "META"]
