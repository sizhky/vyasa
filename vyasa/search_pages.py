import html

from fasthtml.common import *
from monsterui.all import *
from .helpers import content_slug_for_path, content_url_for_slug


def gather_search_content(query, matches, regex_error, root):
    sections, copy_parts = [], [f"# Search Results: {query.strip() or 'All'}\n"]
    if regex_error:
        copy_parts.append(f"> {regex_error}\n")
    for idx, item in enumerate(matches):
        rel = content_slug_for_path(item, strip_suffix=False)
        if not rel:
            continue
        if item.suffix == ".pdf":
            slug = content_slug_for_path(item)
            pdf_href = content_url_for_slug(slug, suffix=".pdf")
            sections.extend([H2(rel, cls="text-xl font-semibold mb-2"), P("PDF file: ", A(rel, href=pdf_href, cls="text-blue-600 hover:underline"), cls="text-sm text-slate-600 dark:text-slate-300"), (Hr(cls="my-6 border-slate-200 dark:border-slate-800") if idx < len(matches) - 1 else None)])
            copy_parts.append(f"\n---\n\n## {rel}\n\n[PDF file]({pdf_href})\n")
            continue
        raw_md = item.read_text(encoding="utf-8") if item.exists() else ""
        sections.extend([H2(rel, cls="text-xl font-semibold mb-2"), Pre(html.escape(raw_md), cls="text-xs font-mono whitespace-pre-wrap text-slate-700 dark:text-slate-300"), (Hr(cls="my-6 border-slate-200 dark:border-slate-800") if idx < len(matches) - 1 else None)])
        copy_parts.append(f"\n---\n\n## {rel}\n\n{raw_md}\n")
    copy_text = "".join(copy_parts)
    return Div(H1(f"Search Results: {query.strip() or 'All'}", cls="text-3xl font-bold mb-6"), (P(regex_error, cls="text-amber-600 dark:text-amber-400 text-sm mb-4") if regex_error else None), Button(UkIcon("copy", cls="w-5 h-5"), Span("Copy all results", cls="text-sm font-semibold"), type="button", onclick="(function(){const el=document.getElementById('gather-clipboard');const toast=document.getElementById('gather-toast');if(!el){return;}el.focus();el.select();const text=el.value;const done=()=>{if(!toast){return;}toast.classList.remove('opacity-0');toast.classList.add('opacity-100');setTimeout(()=>{toast.classList.remove('opacity-100');toast.classList.add('opacity-0');},1400);};if(navigator.clipboard&&window.isSecureContext){navigator.clipboard.writeText(text).then(done).catch(()=>{document.execCommand('copy');done();});}else{document.execCommand('copy');done();}})()", cls="inline-flex items-center gap-2 px-3 py-2 mb-6 rounded-md border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-500 transition-colors"), Div("Copied!", id="gather-toast", cls="fixed top-6 right-6 bg-slate-900 text-white text-sm px-4 py-2 rounded shadow-lg opacity-0 transition-opacity duration-300"), Textarea(copy_text, id="gather-clipboard", cls="absolute left-[-9999px] top-0 opacity-0 pointer-events-none"), *sections)
