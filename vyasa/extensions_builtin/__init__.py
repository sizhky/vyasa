def load_builtin_extensions():
    from . import annotations
    from . import auth_rbac
    from . import auth_routes
    from . import blog_home
    from . import bookmarks
    from . import cryptograph
    from . import cytograph
    from . import d2
    from . import debug_perf
    from . import default_favicon
    from . import default_errors
    from . import default_layout
    from . import default_search
    from . import default_theme
    from . import document_actions
    from . import filesystem
    from . import filesystem_routes
    from . import code_tools
    from . import mermaid
    from . import rbac_admin
    from . import scoped_custom_css
    from . import slides
    from . import sidebar_routes
    from . import table_of_contents
    from . import tabs
    from . import tasks
    from . import pdf_viewer
    from . import tree_table
    from . import wikilinks

    return (
        default_layout.EXTENSION,
        default_theme.EXTENSION,
        default_search.EXTENSION,
        blog_home.EXTENSION,
        default_errors.EXTENSION,
        wikilinks.EXTENSION,
        tabs.EXTENSION,
        mermaid.EXTENSION,
        d2.EXTENSION,
        debug_perf.EXTENSION,
        cytograph.EXTENSION,
        cryptograph.EXTENSION,
        tasks.EXTENSION,
        pdf_viewer.EXTENSION,
        tree_table.EXTENSION,
        document_actions.EXTENSION,
        table_of_contents.EXTENSION,
        scoped_custom_css.EXTENSION,
        code_tools.EXTENSION,
        default_favicon.EXTENSION,
        slides.EXTENSION,
        auth_rbac.EXTENSION,
        sidebar_routes.EXTENSION,
        annotations.EXTENSION,
        bookmarks.EXTENSION,
        rbac_admin.EXTENSION,
        auth_routes.EXTENSION,
        filesystem_routes.EXTENSION,
        filesystem.EXTENSION,
    )


__all__ = ["load_builtin_extensions"]
