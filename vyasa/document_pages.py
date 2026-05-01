from __future__ import annotations

import html
from dataclasses import dataclass
from typing import Any

from fasthtml.common import A, Button, Div, H1, NotStr, P, Script, Span, Strong, Textarea
from monsterui.all import UkIcon

from .helpers import content_url_for_slug, estimate_read_time_minutes, format_last_modified_label

PAGE_TITLE_CLS = "vyasa-page-title text-4xl font-bold"
COPY_RAW_JS = (
    "(function(){const el=document.getElementById('%s');const toast=document.getElementById('%s');"
    "if(!el){return;}el.focus();el.select();const text=el.value;"
    "const done=()=>{if(!toast){return;}toast.classList.remove('opacity-0');toast.classList.add('opacity-100');"
    "setTimeout(()=>{toast.classList.remove('opacity-100');toast.classList.add('opacity-0');},1400);};"
    "if(navigator.clipboard&&window.isSecureContext){navigator.clipboard.writeText(text).then(done).catch(()=>{document.execCommand('copy');done();});}"
    "else{document.execCommand('copy');done();}})()"
)


@dataclass(frozen=True)
class DocumentPage:
    title: str
    current_path: str
    body: Any
    toc_source: str | None = None
    show_sidebar: bool = True
    show_toc: bool = True
    full_width: bool = False
    no_scroll: bool = False

    def render(self, layout, *, htmx, blog_title: str, auth):
        return layout(
            self.body,
            htmx=htmx,
            title=f"{self.title} - {blog_title}",
            show_sidebar=self.show_sidebar,
            toc_content=self.toc_source,
            current_path=self.current_path,
            show_toc=self.show_toc,
            auth=auth,
            full_width=self.full_width,
            no_scroll=self.no_scroll,
        )


def meta_line(source_text: str, file_path=None):
    items = [Span(f"{estimate_read_time_minutes(source_text)}-min read")]
    label = format_last_modified_label(file_path) if file_path else None
    if label:
        items.extend([Span("•", aria_hidden="true"), Span(label)])
    return P(*items, cls="vyasa-read-time text-sm text-slate-500 dark:text-slate-400 mt-2 flex flex-wrap items-center gap-2")


def copy_raw_button(label: str, target_id: str, toast_id: str):
    return Button(
        UkIcon("clipboard", cls="w-4 h-4"),
        Span(label, cls="text-sm font-medium"),
        type="button",
        title=f"Copy raw {label.removeprefix('Copy ').lower()}",
        onclick=COPY_RAW_JS % (target_id, toast_id),
        cls="vyasa-page-action-button inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm",
    )


def present_button(slug: str):
    return A(
        UkIcon("monitor", cls="w-4 h-4"),
        "Present",
        href=content_url_for_slug(slug, prefix="/slides", suffix="/slide-1"),
        hx_boost="false",
        cls="vyasa-page-action-button inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm",
    )


def action_row(*actions):
    return Div(*actions, cls="flex items-center gap-2 flex-wrap", data_vyasa_page_actions="true")


def document_header(title: str, source_text: str, *, actions=(), breadcrumbs=None, file_path=None):
    return Div(
        breadcrumbs,
        Div(H1(title, cls=PAGE_TITLE_CLS), action_row(*actions), cls="flex items-start justify-between gap-4 flex-wrap"),
        meta_line(source_text, file_path),
        cls="mb-8",
    )


def copy_raw_nodes(raw_content: str, *, kind: str = "md"):
    title = "Copied Raw Markdown!"
    target_id = f"raw-{kind}-clipboard"
    toast_id = f"raw-{kind}-toast"
    return (
        Div(title, id=toast_id, cls="fixed top-6 right-6 bg-slate-900 text-white text-sm px-4 py-2 rounded shadow-lg opacity-0 transition-opacity duration-300"),
        Textarea(raw_content, id=target_id, cls="absolute left-[-9999px] top-0 opacity-0 pointer-events-none"),
    )


def frontmatter_metadata_block(metadata: dict):
    items = [(k, v) for k, v in metadata.items() if k not in {"__frontmatter_error__", "title", "slides", "reveal"} and isinstance(v, str) and v.strip()]
    if not items:
        return None
    return NotStr(
        '<details class="vyasa-frontmatter-block mb-8 overflow-hidden rounded-2xl px-4 py-3">'
        '<summary class="vyasa-frontmatter-summary cursor-pointer text-xs font-medium uppercase tracking-[0.18em]">Front Matter</summary>'
        + "".join(
            f'<div class="space-y-1 pt-6 first:pt-4"><div class="border-t border-[rgba(126,154,144,0.16)] pb-6 first:border-t-0 first:pb-0"></div><div class="text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{html.escape(k.replace("_", " "))}</div><p class="m-0 text-sm leading-relaxed text-slate-700 dark:text-slate-200">{html.escape(v)}</p></div>'
            for k, v in items[:4]
        )
        + "</details>"
    )


def frontmatter_error_nodes(file_path, error):
    if not error:
        return None, None, None
    chip = Span("Bad Front Matter", cls="inline-flex items-center rounded-full border border-amber-200/80 bg-amber-50/70 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200")
    toast = Div(
        Strong("Invalid front matter", cls="block mb-1"),
        P(f"{file_path}", cls="m-0 text-xs opacity-80 break-all"),
        P(error["message"], cls="m-0 mt-1 font-mono text-xs break-all"),
        id="frontmatter-error-toast",
        cls="fixed top-6 right-6 z-[9999] max-w-md rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950 shadow-xl transition-all duration-500 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100",
    )
    script = Script("setTimeout(()=>{const el=document.getElementById('frontmatter-error-toast');if(!el)return;el.classList.add('opacity-0','translate-x-8');setTimeout(()=>el.remove(),500);},3200)")
    return chip, toast, script
