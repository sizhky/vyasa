from functools import partial

from ...assets import asset_url
from ...document_pages import DocumentActionItem, edit_document_button
from ...extensions import AssetBundle, ExtensionMeta, VyasaExtensionBase

from .api import (
    edits_enabled,
    register_document_block_routes,
    register_document_proposal_routes,
    register_document_preview_routes,
    register_document_source_routes,
)


class DocumentEditExtension(VyasaExtensionBase):
    def register(self, app) -> None:
        app.routes.add("/api/documents/source", register_document_source_routes, methods=("GET", "POST"))
        app.routes.add("/api/documents/preview", register_document_preview_routes, methods=("POST",))
        app.routes.add("/api/documents/blocks", register_document_block_routes, methods=("POST",))
        proposals = partial(register_document_proposal_routes, storage=app.storage.namespace("document_edit"))
        app.routes.add("/api/documents/proposals", proposals, methods=("GET", "POST"))
        app.routes.add("/api/document-proposals", proposals, methods=("POST",))
        app.documents.action(_edit_action)
        app.assets.bundle(
            AssetBundle(
                "document_edit.runtime",
                css=("/static/extensions/document_edit/document_edit.css",),
                js=("/static/extensions/document_edit/document_edit.js",),
            )
        )
        app.assets.page(_page_bundles)


def _edit_action(context):
    """Offer the toggle only for documents backed by a file we can write.

    Git-ref pages leave ``file_path`` unset, so they stay read-only for free.
    """
    if not context.file_path or not edits_enabled():
        return None
    return DocumentActionItem(
        id="documents.edit",
        # Versioned like every other asset, so a changed editor is never served from cache.
        node=edit_document_button(
            context.current_path,
            asset_url("/static/extensions/document_edit/live_editor.js"),
            asset_url("/static/extensions/document_edit/prosemirror.bundle.js"),
        ),
        order=20,
    )


def _page_bundles(context):
    if context.get("slide_mode") or not edits_enabled():
        return ()
    return ("document_edit.runtime",)


_page_bundles.page_asset_priority = 30


EXTENSION = DocumentEditExtension(
    ExtensionMeta(
        "document_edit",
        "route",
        (
            "cap:route:document_edit",
            "cap:documents:action:edit",
            "bundle:document_edit.runtime",
        ),
        requires=("slot:layout", "cap:markdown_pipeline"),
        route_prefixes=(
            "/api/documents/source",
            "/api/documents/preview",
            "/api/documents/blocks",
            "/api/documents/proposals",
            "/api/document-proposals",
        ),
        storage_namespaces=("document_edit",),
        scope_disable=True,
    )
)
META = EXTENSION.meta

__all__ = ["EXTENSION", "META"]
