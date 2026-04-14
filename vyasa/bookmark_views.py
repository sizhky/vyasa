from fasthtml.common import Button, Div, Span


def bookmark_toggle_button(path, title):
    return Button(
        Span("☆", cls="vyasa-bookmark-glyph flex h-4 w-4 items-center justify-center text-sm", aria_hidden="true"),
        type="button",
        title=f"Bookmark {title}",
        aria_label=f"Bookmark {title}",
        data_bookmark_toggle="true",
        data_bookmark_path=str(path or "").strip("/"),
        data_bookmark_title=title,
        cls="vyasa-bookmark-toggle shrink-0 rounded p-1.5 text-slate-400 hover:text-amber-500 transition-colors",
    )


def bookmark_delete_button(path, title):
    return Button(
        Span(UkIcon("close", cls="w-3.5 h-3.5"), cls="flex items-center justify-center"),
        type="button",
        title=f"Remove bookmark for {title}",
        aria_label=f"Remove bookmark for {title}",
        data_bookmark_delete="true",
        data_bookmark_path=str(path or "").strip("/"),
        data_bookmark_title=title,
        cls="vyasa-bookmark-delete shrink-0 rounded p-1.5 text-slate-400 hover:text-rose-500 transition-colors",
    )


def bookmarks_block():
    return Div(
        Div("No bookmarks yet.", cls="vyasa-bookmarks-empty text-xs text-slate-500 dark:text-slate-400"),
        Div(cls="vyasa-bookmarks-list space-y-1 overflow-x-auto"),
        cls="vyasa-bookmarks-block mb-3",
    )
