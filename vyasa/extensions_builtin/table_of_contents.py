from __future__ import annotations

from fasthtml.common import A, Aside, Button, Div, P, Span, Ul, to_xml
from monsterui.all import UkIcon

from ..extensions import ExtensionMeta, VyasaExtensionBase
from ..sidebar_helpers import docked_sidebar_classes


class TableOfContentsExtension(VyasaExtensionBase):
    def register(self, app) -> None:
        app.layout.toc(_toc_panels)
        app.layout.navbar_mobile_action(_mobile_toc_toggle)


def _toc_panels(context):
    toc_items = context.get("toc_items") or []
    mode = context.get("mode")
    if mode == "static":
        if not toc_items:
            return ""
        toc_list_html = to_xml(Ul(*toc_items, cls="mt-2 list-none"))
        return (
            '<aside id="toc-sidebar" class="vyasa-sidebar vyasa-toc-sidebar hidden md:block w-64 shrink-0 sticky top-24 self-start mt-4 max-h-[calc(100vh-10rem)] overflow-hidden z-[1000]">'
            '<details open class="vyasa-sidebar-card vyasa-sidebar-card-table-of-contents">'
            '<summary class="vyasa-sidebar-toggle vyasa-sidebar-toggle-table-of-contents flex items-center font-semibold cursor-pointer py-2 px-3 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg select-none list-none bg-white dark:bg-slate-950 z-10">'
            '<span uk-icon="list" class="w-5 h-5 mr-2"></span>'
            'Table of Contents'
            '</summary>'
            '<div class="vyasa-sidebar-body vyasa-sidebar-body-table-of-contents mt-2 p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-y-auto max-h-[calc(100vh-16rem)]">'
            f"{toc_list_html}"
            "</div></details></aside>"
        )
    build_collapsible_sidebar = context["build_collapsible_sidebar"]
    desktop_cls = docked_sidebar_classes("toc")
    desktop_attrs = {"id": "toc-sidebar"}
    if context.get("oob"):
        desktop_attrs["hx_swap_oob"] = "true"
    desktop = Aside(
        build_collapsible_sidebar("list", "Table of Contents", toc_items, is_open=True, data_sidebar="toc", shortcut_key="X"),
        cls=desktop_cls,
        **desktop_attrs,
    ) if toc_items else Div(**desktop_attrs)
    mobile_attrs = {
        "id": "mobile-toc-panel",
        "cls": "vyasa-mobile-panel fixed inset-y-0 right-0 w-full sm:w-96 sm:border-l border-slate-200 dark:border-slate-800 sm:shadow-2xl bg-white dark:bg-slate-950 z-[9999] xl:hidden transform translate-x-full transition-transform duration-300",
        "aria_hidden": "true",
    }
    if context.get("oob"):
        mobile_attrs["hx_swap_oob"] = "true"
    mobile = Div(
        Div(
            Button(UkIcon("x", cls="w-5 h-5"), id="close-mobile-toc", cls="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors ml-auto", type="button"),
            cls="vyasa-mobile-panel-header flex justify-end p-2 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800",
        ),
        Div(
            build_collapsible_sidebar("list", "Table of Contents", toc_items, is_open=True, data_sidebar="toc", shortcut_key="X") if toc_items else Div(P("No table of contents available.", cls="text-slate-500 dark:text-slate-400 text-sm p-4")),
            cls="vyasa-mobile-panel-body p-4 overflow-y-auto",
        ),
        **mobile_attrs,
    )
    return desktop, mobile


def _mobile_toc_toggle(context):
    if not context.get("show_toc", True):
        return None
    return Button(UkIcon("panel-right", cls="w-5 h-5"), title="Toggle table of contents", cls="p-2 hover:bg-slate-800 rounded transition-colors", type="button", onclick="window.__vyasaToggleTocPanel && window.__vyasaToggleTocPanel()", data_vyasa_sidebar_toggle="toc")


EXTENSION = TableOfContentsExtension(
    ExtensionMeta(
        "table_of_contents",
        "render",
        ("cap:layout:toc", "cap:layout:navbar_mobile_action"),
        requires=("slot:layout",),
        scope_disable=True,
    )
)
META = EXTENSION.meta

__all__ = ["EXTENSION", "META"]
