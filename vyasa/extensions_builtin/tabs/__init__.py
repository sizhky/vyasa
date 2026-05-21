from ...extensions import ExtensionMeta, VyasaExtensionBase
from .render import postprocess_tabs, preprocess_tabs


class TabsExtension(VyasaExtensionBase):
    def register(self, app) -> None:
        def _tabs_preprocessor(markdown, context, state):
            processed, tab_store = preprocess_tabs(markdown)
            state["tabs"] = tab_store
            return processed

        app.markdown.preprocessor(_tabs_preprocessor)
        app.markdown.postprocessor(
            lambda html_fragment, context, state, render_tab_content: postprocess_tabs(
                html_fragment,
                state.get("tabs", {}),
                render_tab_content,
            )
        )


EXTENSION = TabsExtension(
    ExtensionMeta(
        "tabs",
        "render",
        ("cap:markdown:fence:tabs",),
        requires=("cap:markdown_pipeline",),
    )
)
META = EXTENSION.meta

__all__ = ["EXTENSION", "META"]
