from __future__ import annotations

import base64
import html
from dataclasses import dataclass
from typing import Any

from fasthtml.common import A, Button, Div, H1, NotStr, P, Script, Span, Strong, Textarea

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
COPY_RAW_PAYLOAD_JS = (
    "(function(btn){const toast=document.getElementById('%s');"
    "const binary=atob(btn.dataset.copyPayload||'');"
    "const bytes=Uint8Array.from(binary,(char)=>char.charCodeAt(0));"
    "const text=new TextDecoder().decode(bytes);"
    "const done=()=>{if(!toast){return;}toast.classList.remove('opacity-0');toast.classList.add('opacity-100');"
    "setTimeout(()=>{toast.classList.remove('opacity-100');toast.classList.add('opacity-0');},1400);};"
    "const fallback=()=>{const el=document.createElement('textarea');el.value=text;el.setAttribute('readonly','');"
    "el.style.position='absolute';el.style.left='-9999px';document.body.appendChild(el);el.select();document.execCommand('copy');document.body.removeChild(el);done();};"
    "if(navigator.clipboard&&window.isSecureContext){navigator.clipboard.writeText(text).then(done).catch(()=>fallback());}"
    "else{fallback();}})(this)"
)
COPY_TEXT_PAYLOAD_JS = (
    "(function(btn,event){const toast=document.getElementById('%s');"
    "const encoded=event&&event.shiftKey?btn.dataset.copyAlternatePayload:btn.dataset.copyPayload;"
    "if(!encoded){return;}const binary=atob(encoded);"
    "const bytes=Uint8Array.from(binary,(char)=>char.charCodeAt(0));"
    "const text=new TextDecoder().decode(bytes);"
    "const done=()=>{if(!toast){return;}toast.classList.remove('opacity-0');toast.classList.add('opacity-100');"
    "setTimeout(()=>{toast.classList.remove('opacity-100');toast.classList.add('opacity-0');},1400);};"
    "const fallback=()=>{const el=document.createElement('textarea');el.value=text;el.setAttribute('readonly','');"
    "el.style.position='absolute';el.style.left='-9999px';document.body.appendChild(el);el.select();document.execCommand('copy');document.body.removeChild(el);done();};"
    "if(navigator.clipboard&&window.isSecureContext){navigator.clipboard.writeText(text).then(done).catch(()=>fallback());}"
    "else{fallback();}})(this,event)"
)
ACTION_ICONS = {
    "clipboard": '<svg viewBox="0 0 24 24" aria-hidden="true" class="vyasa-page-action-icon"><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M9 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-3"/></svg>',
    "file-edit": '<svg viewBox="0 0 24 24" aria-hidden="true" class="vyasa-page-action-icon"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="m12 18 5-5 2 2-5 5h-2z"/></svg>',
    "fold": '<svg viewBox="0 0 24 24" aria-hidden="true" class="vyasa-page-action-icon vyasa-fold-all-icon"><path d="M6 7h12"/><path d="M6 12h8"/><path d="M6 17h5"/><path d="m15 10 3 3 3-3"/></svg>',
    "monitor": '<svg viewBox="0 0 24 24" aria-hidden="true" class="vyasa-page-action-icon"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8"/><path d="M12 16v4"/></svg>',
}


def action_icon(name: str):
    return NotStr(ACTION_ICONS[name])


@dataclass(frozen=True)
class DocumentPage:
    title: str
    current_path: str
    body: Any
    file_path: str | None = None
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
            current_updated_label=format_last_modified_label(self.file_path) if self.file_path else None,
        )


@dataclass(frozen=True)
class DocumentActionContext:
    title: str
    current_path: str
    raw_content: str = ""
    file_path: str | None = None
    relative_file_path: str | None = None


@dataclass(frozen=True)
class DocumentActionItem:
    id: str
    node: Any
    aux_nodes: tuple[Any, ...] = ()
    order: int = 0


def resolve_document_actions(context: DocumentActionContext) -> tuple[tuple[Any, ...], tuple[Any, ...]]:
    from .extensions import get_extension_runtime

    runtime = get_extension_runtime()
    providers = runtime.document_action_providers if runtime else []
    items = [
        item
        for provider in providers
        if (item := provider(context))
    ]
    ordered = sorted(items, key=lambda item: (item.order, item.id))
    actions = tuple(item.node for item in ordered)
    aux_nodes = tuple(node for item in ordered for node in item.aux_nodes)
    return actions, aux_nodes


def meta_line(source_text: str, file_path=None):
    items = [Span(f"{estimate_read_time_minutes(source_text)}-min read")]
    label = format_last_modified_label(file_path) if file_path else None
    if label:
        items.extend([Span("•", aria_hidden="true"), Span(label)])
    return P(*items, cls="vyasa-read-time text-sm text-slate-500 dark:text-slate-400 mt-2 flex flex-wrap items-center gap-2")


def _copy_payload_attrs(text: str):
    return {"data_copy_payload": base64.b64encode(text.encode("utf-8")).decode("ascii")}


def copy_raw_button(label: str, raw_content: str, toast_id: str):
    tooltip = f"Copy raw {label.removeprefix('Copy ').lower()}"
    return Button(
        action_icon("clipboard"),
        Span(label, cls="text-sm font-medium"),
        type="button",
        onclick=COPY_RAW_PAYLOAD_JS % toast_id,
        cls="vyasa-page-action-button vyasa-page-action-tooltip inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm",
        data_tooltip=tooltip,
        aria_label=tooltip,
        **_copy_payload_attrs(raw_content),
    )


def copy_text_button(label: str, text: str, target_id: str, toast_id: str, *, alternate_text: str | None = None):
    payload_attrs = _copy_payload_attrs(text)
    if alternate_text is not None:
        payload_attrs["data_copy_alternate_payload"] = base64.b64encode(alternate_text.encode("utf-8")).decode("ascii")
        payload_attrs["data_tooltip"] = "Click: relative path. Shift-click: absolute path."
    return (
        Button(
            action_icon("file-edit"),
            Span(label, cls="text-sm font-medium"),
            Span(". Shift-click copies absolute path.", cls="sr-only") if alternate_text is not None else None,
            type="button",
            onclick=COPY_TEXT_PAYLOAD_JS % toast_id,
            cls="vyasa-page-action-button inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm"
            + (" vyasa-page-action-tooltip" if alternate_text is not None else ""),
            aria_label=f"{label}. Shift-click copies absolute path." if alternate_text is not None else None,
            **payload_attrs,
        ),
        Div(f"Copied {label.lower()}!", id=toast_id, cls="fixed top-6 right-6 bg-slate-900 text-white text-sm px-4 py-2 rounded shadow-lg opacity-0 transition-opacity duration-300"),
        Textarea(text, id=target_id, cls="absolute left-[-9999px] top-0 opacity-0 pointer-events-none"),
    )


def fold_all_button():
    return Button(
        action_icon("fold"),
        Span("Fold all", cls="text-sm font-medium"),
        type="button",
        hidden=True,
        data_vyasa_fold_all="open",
        data_tooltip="Fold all sections (C)",
        aria_label="Fold all sections (C)",
        cls="vyasa-fold-all-button vyasa-page-action-tooltip inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm",
    )


def present_button(slug: str):
    return A(
        action_icon("monitor"),
        "Present",
        href=content_url_for_slug(slug, prefix="/slides", suffix="/slide-1"),
        hx_boost="false",
        data_tooltip="Present document",
        aria_label="Present document",
        cls="vyasa-page-action-button vyasa-page-action-tooltip inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm",
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
    toast_id = f"raw-{kind}-toast"
    return (
        Div(title, id=toast_id, cls="fixed top-6 right-6 bg-slate-900 text-white text-sm px-4 py-2 rounded shadow-lg opacity-0 transition-opacity duration-300"),
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
