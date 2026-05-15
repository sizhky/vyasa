from ...extensions import AssetBundle, ExtensionMeta, VyasaExtensionBase, request_asset_bundle
from .render import render_tasks_block


class TasksExtension(VyasaExtensionBase):
    def register(self, app) -> None:
        app.assets.bundle(AssetBundle("tasks.runtime", js=("/static/extensions/tasks/tasks.js",)))
        handler = lambda code, context, attrs: (
            request_asset_bundle("tasks.runtime"),
            render_tasks_block(code, context.current_path if context else None),
        )[1]
        app.markdown.fence("items", handler)
        app.markdown.fence("tasks", handler)


EXTENSION = TasksExtension(
    ExtensionMeta(
        "tasks",
        "render",
        ("cap:markdown:fence:items", "cap:markdown:fence:tasks", "bundle:tasks.runtime"),
        requires=("cap:markdown_pipeline",),
        scope_disable=True,
    )
)
META = EXTENSION.meta

__all__ = ["EXTENSION", "META"]
