from __future__ import annotations

from ..document_pages import (
    DocumentActionItem,
    copy_raw_button,
    copy_raw_nodes,
    copy_text_button,
    fold_all_button,
)
from ..extensions import ExtensionMeta, VyasaExtensionBase


class DocumentActionsExtension(VyasaExtensionBase):
    def register(self, app) -> None:
        app.documents.action(_fold_all_action)
        app.documents.action(_copy_raw_action)
        app.documents.action(_copy_relative_path_action)


def _fold_all_action(context):
    return DocumentActionItem(
        id="documents.fold_all",
        node=fold_all_button(),
        order=10,
    )


def _copy_raw_action(context):
    if not context.raw_content:
        return None
    toast_id = "raw-md-toast"
    return DocumentActionItem(
        id="documents.copy_raw",
        node=copy_raw_button("Copy Markdown", context.raw_content, toast_id),
        aux_nodes=copy_raw_nodes(context.raw_content),
        order=30,
    )


def _copy_relative_path_action(context):
    if not context.relative_file_path:
        return None
    button, toast, target = copy_text_button(
        "Copy Relative Path",
        context.relative_file_path,
        "relative-path-clipboard",
        "relative-path-toast",
        alternate_text=context.file_path,
    )
    return DocumentActionItem(
        id="documents.copy_relative_path",
        node=button,
        aux_nodes=(toast, target),
        order=40,
    )


EXTENSION = DocumentActionsExtension(
    ExtensionMeta(
        "document_actions",
        "render",
        (
            "cap:documents:action:fold_all",
            "cap:documents:action:copy_raw",
            "cap:documents:action:copy_relative_path",
        ),
        requires=("slot:layout",),
        scope_disable=True,
    )
)
META = EXTENSION.meta

__all__ = ["EXTENSION", "META"]
