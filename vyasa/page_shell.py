from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol

from fasthtml.common import Ul, to_xml


@dataclass(frozen=True)
class PageShellModel:
    title: str
    blog_title: str
    main_html: str
    nav_tree: list[Any]
    favicon_href: str
    toc_items: list[Any] | None = None
    current_path: str | None = None


class ShellRenderer(Protocol):
    def render(self, model: PageShellModel) -> str: ...


class StaticShellRenderer:
    def __init__(self, html_document_renderer):
        self.html_document_renderer = html_document_renderer

    def render(self, model: PageShellModel) -> str:
        body = self._body(model)
        return self.html_document_renderer(model.title, body, model.blog_title, model.favicon_href)

    def _body(self, model: PageShellModel) -> str:
        return f'''
    <div id="page-container" class="flex flex-col min-h-screen">
        <div class="vyasa-navbar-shell w-full sticky top-0 z-50">
            {self._navbar(model.blog_title)}
        </div>
        <div id="content-with-sidebars" class="vyasa-content-grid w-full max-w-7xl mx-auto px-4 flex gap-6 flex-1">
            {self._posts_sidebar(model.nav_tree)}
            <main id="main-content" class="vyasa-main-shell flex-1 min-w-0 px-6 py-8 space-y-8">
                {model.main_html}
            </main>
            {self._toc_sidebar(model.toc_items)}
        </div>
        {self._footer()}
    </div>
    '''

    @staticmethod
    def _theme_toggle() -> str:
        return '''
    <button onclick="toggleTheme()" class="p-1 hover:scale-110 shadow-none" type="button">
        <span uk-icon="moon" class="dark:hidden"></span>
        <span uk-icon="sun" class="hidden dark:block"></span>
    </button>
    '''

    def _navbar(self, blog_title: str) -> str:
        return f'''
    <div class="vyasa-navbar-card bg-slate-900 text-white px-4 py-3 dark:bg-slate-800">
        <div class="flex items-center justify-between md:hidden">
            <button id="mobile-posts-toggle" title="Toggle file tree" class="p-2 rounded transition-colors hover:bg-slate-800" type="button" onclick="window.__vyasaTogglePostsPanel && window.__vyasaTogglePostsPanel()">
                <span uk-icon="menu" class="w-5 h-5"></span>
            </button>
            <a href="/index.html" class="flex-1 px-4 text-center truncate">{blog_title}</a>
            <div class="flex items-center gap-1">
                <button id="mobile-toc-toggle" title="Toggle table of contents" class="p-2 rounded transition-colors hover:bg-slate-800" type="button" onclick="window.__vyasaToggleTocPanel && window.__vyasaToggleTocPanel()">
                    <span uk-icon="list" class="w-5 h-5"></span>
                </button>
                {self._theme_toggle()}
            </div>
        </div>
        <div class="hidden md:flex items-center justify-between">
            <a href="/index.html">{blog_title}</a>
            {self._theme_toggle()}
        </div>
    </div>
    '''

    @staticmethod
    def _posts_sidebar(nav_tree: list[Any]) -> str:
        nav_html = to_xml(Ul(*nav_tree, cls="mt-2 list-none"))
        return f'''
    <aside id="posts-sidebar" class="vyasa-sidebar vyasa-posts-sidebar hidden md:block w-64 shrink-0 sticky top-24 self-start mt-4 max-h-[calc(100vh-10rem)] overflow-hidden z-[1000]">
        <details open class="vyasa-sidebar-card vyasa-sidebar-card-posts">
            <summary class="vyasa-sidebar-toggle vyasa-sidebar-toggle-posts flex items-center font-semibold cursor-pointer py-2 px-3 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg select-none list-none bg-white dark:bg-slate-950 z-10">
                <span uk-icon="menu" class="w-5 h-5 mr-2"></span>
                Posts
            </summary>
            <div class="vyasa-sidebar-body vyasa-sidebar-body-posts mt-2 p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-y-auto max-h-[calc(100vh-16rem)]">
                {nav_html}
            </div>
        </details>
    </aside>
    '''

    @staticmethod
    def _toc_sidebar(toc_items: list[Any] | None) -> str:
        if not toc_items:
            return ""
        toc_list_html = to_xml(Ul(*toc_items, cls="mt-2 list-none"))
        return f'''
        <aside id="toc-sidebar" class="vyasa-sidebar vyasa-toc-sidebar hidden md:block w-64 shrink-0 sticky top-24 self-start mt-4 max-h-[calc(100vh-10rem)] overflow-hidden z-[1000]">
            <details open class="vyasa-sidebar-card vyasa-sidebar-card-table-of-contents">
                <summary class="vyasa-sidebar-toggle vyasa-sidebar-toggle-table-of-contents flex items-center font-semibold cursor-pointer py-2 px-3 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg select-none list-none bg-white dark:bg-slate-950 z-10">
                    <span uk-icon="list" class="w-5 h-5 mr-2"></span>
                    Table of Contents
                </summary>
                <div class="vyasa-sidebar-body vyasa-sidebar-body-table-of-contents mt-2 p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-y-auto max-h-[calc(100vh-16rem)]">
                    {toc_list_html}
                </div>
            </details>
        </aside>
        '''

    @staticmethod
    def _footer() -> str:
        return '''
    <footer class="vyasa-footer-shell w-full mt-auto">
        <div class="vyasa-footer-card bg-slate-900 text-white p-4 dark:bg-slate-800 text-right">
            Powered by Vyasa
        </div>
    </footer>
    '''
