from __future__ import annotations

import html

from ...markdown_fence import split_fence_frontmatter


def render_cryptograph_block(code: str) -> str:
    config, ciphertext = split_fence_frontmatter(html.unescape(code))
    ciphertext = ciphertext.strip()
    if not ciphertext:
        return (
            '<div class="vyasa-callout vyasa-callout-warning my-6 rounded-xl border px-5 py-4" data-callout="warning">'
            '<div class="vyasa-callout-head vyasa-callout-head-with-body flex items-center gap-2">'
            '<span class="vyasa-callout-label text-sm font-semibold tracking-[0.02em]">Warning</span>'
            '</div><div class="vyasa-callout-body"><p>Cryptograph blocks need ciphertext in the block body.</p></div></div>'
        )
    attrs = {
        "data-cryptograph-widget": "true",
        "data-cryptograph-title": str(config.get("title") or "Cryptograph"),
        "data-cryptograph-hint": str(config.get("hint") or ""),
        "data-cryptograph-answer": str(config.get("answer") or ""),
    }
    attr_text = " ".join(f'{key}="{html.escape(value)}"' for key, value in attrs.items())
    return (
        f'<div class="cryptograph-container my-6 rounded-xl border border-slate-200 dark:border-slate-800 p-4" {attr_text}>'
        f'<pre class="cryptograph-ciphertext whitespace-pre-wrap">{html.escape(ciphertext)}</pre>'
        f'</div>'
    )
