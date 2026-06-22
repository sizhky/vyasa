from pathlib import Path

from ...extensions import AssetBundle, ExtensionMeta, VyasaExtensionBase
from .api import register_feedback_routes
from .store import FeedbackStore, PresenceRegistry


class FeedbackExtension(VyasaExtensionBase):
    def register(self, app) -> None:
        app.storage.namespace("feedback")
        app.routes.add("/api/feedback", _register_feedback_routes)
        app.assets.page(_page_bundles)
        app.layout.main_attrs(_main_attrs)
        app.assets.bundle(
            AssetBundle(
                "feedback.runtime",
                css=("/static/extensions/feedback/feedback.css",),
                js=("/static/extensions/feedback/feedback.js",),
                static_dir=Path(__file__).parent / "static",
            )
        )


def _register_feedback_routes(rt, runtime) -> None:
    from ...config import get_config

    register_feedback_routes(
        rt,
        runtime,
        store=FeedbackStore(get_config().get_root_folder()),
        presence=PresenceRegistry(),
    )


def _page_bundles(context):
    if context.get("mode") == "runtime" and context.get("current_path"):
        return ("feedback.runtime",)
    return ()


_page_bundles.page_asset_priority = 35


def _main_attrs(context):
    path = str(context.get("current_path") or "").strip("/")
    return {
        "data-feedback-enabled": "1" if path else "0",
        "data-feedback-path": path,
    }


EXTENSION = FeedbackExtension(
    ExtensionMeta(
        "feedback",
        "route",
        ("cap:route:feedback", "bundle:feedback.runtime", "cap:layout:main_attrs"),
        route_prefixes=("/api/feedback",),
        storage_namespaces=("feedback",),
        scope_disable=True,
        description="Durable, context-rich human-to-agent feedback for every rendered document.",
    )
)
META = EXTENSION.meta

__all__ = ["EXTENSION", "META"]
