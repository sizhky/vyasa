def load_builtin_extensions():
    from . import annotations
    from . import auth_routes
    from . import blog_home
    from . import bookmarks
    from . import cryptograph
    from . import cytograph
    from . import d2
    from . import debug_perf
    from . import default_errors
    from . import default_layout
    from . import default_search
    from . import default_theme
    from . import filesystem
    from . import filesystem_routes
    from . import mermaid
    from . import rbac_admin
    from . import slides
    from . import sidebar_routes
    from . import tabs
    from . import tasks
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
        slides.EXTENSION,
        auth_routes.EXTENSION,
        sidebar_routes.EXTENSION,
        annotations.EXTENSION,
        bookmarks.EXTENSION,
        rbac_admin.EXTENSION,
        filesystem_routes.EXTENSION,
        filesystem.EXTENSION,
    )


__all__ = ["load_builtin_extensions"]
