from ...extensions import ExtensionMeta, VyasaExtensionBase
from .rewrite import rewrite_wikilinks


class WikilinksExtension(VyasaExtensionBase):
    def register(self, app) -> None:
        app.markdown.preprocessor(
            lambda markdown, context, state: rewrite_wikilinks(
                markdown,
                current_path=context.current_path if context else None,
            )
        )


EXTENSION = WikilinksExtension(
    ExtensionMeta(
        "wikilinks",
        "render",
        ("cap:markdown:fence:wikilinks",),
        requires=("cap:markdown_pipeline",),
    )
)
META = EXTENSION.meta

__all__ = ["EXTENSION", "META"]
