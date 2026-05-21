from ..extensions import ExtensionMeta, VyasaExtensionBase


class TreeTableExtension(VyasaExtensionBase):
    pass


EXTENSION = TreeTableExtension(
    ExtensionMeta(
        "tree_table",
        "render",
        ("cap:document_type:tree",),
        requires=("slot:layout",),
        scope_disable=True,
    )
)
META = EXTENSION.meta

__all__ = ["EXTENSION", "META"]
