from ..extensions import ExtensionMeta, VyasaExtensionBase


def _home_provider(htmx, request):
    from .. import core

    return core._default_render_blog_home(htmx, request)


def _feed_provider(offset=0, htmx=None, request=None):
    from .. import core

    roots = core.get_content_mounts()
    root = roots[0][1] if roots else core.get_root_folder()
    roles = core.get_roles_from_auth(request.scope.get("auth"), core._rbac_rules, core._rbac_cfg, core._google_oauth_cfg, core._config._coerce_list) if request else None
    entries = core._sort_blog_home_entries(core.iter_blog_home_files(roots, roles), root)
    return core.render_blog_home_feed(entries, root, max(0, offset), wrap=False)


class BlogHomeExtension(VyasaExtensionBase):
    def register(self, app) -> None:
        app.layout.slot("home", _home_provider)
        app.layout.slot("home_feed", _feed_provider)


EXTENSION = BlogHomeExtension(
    ExtensionMeta(
        "blog_home",
        "home",
        ("slot:home", "slot:home_feed"),
        requires=("slot:layout",),
        scope_disable=True,
    )
)
META = EXTENSION.meta

__all__ = ["EXTENSION", "META"]
