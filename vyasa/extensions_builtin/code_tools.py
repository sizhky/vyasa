from __future__ import annotations

from fasthtml.common import NotStr

from ..extensions import AssetBundle, ExtensionMeta, VyasaExtensionBase


class CodeToolsExtension(VyasaExtensionBase):
    def register(self, app) -> None:
        app.assets.bundle(
            AssetBundle(
                "code_tools.runtime",
                js=(
                    "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js",
                    "/static/extensions/code_tools/code_tools.js",
                ),
            )
        )
        app.layout.body_fragment(_copy_template)


def _copy_template(context):
    return NotStr('<template id="vyasa-code-copy-tpl"><button type="button" class="code-copy-button absolute top-2 right-2 inline-flex items-center justify-center rounded border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/70 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-500 transition-colors" aria-label="Copy code"><span class="w-4 h-4" aria-hidden="true">⧉</span><span class="sr-only">Copy code</span></button></template>')


EXTENSION = CodeToolsExtension(
    ExtensionMeta(
        "code_tools",
        "render",
        ("bundle:code_tools.runtime", "cap:layout:body_fragment"),
        requires=("cap:markdown_pipeline",),
        scope_disable=True,
    )
)
META = EXTENSION.meta

__all__ = ["EXTENSION", "META"]
