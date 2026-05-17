from ...extensions import AssetBundle, ExtensionMeta, VyasaExtensionBase


class SlidesExtension(VyasaExtensionBase):
    def register(self, app) -> None:
        app.assets.bundle(
            AssetBundle(
                "slides.runtime",
                css=("/static/extensions/slides/present.css",),
                js=("/static/extensions/slides/present.js",),
            )
        )
        app.routes.add("/slides", _register_slides_route)
        app.layout.mode("slide", _slide_renderer)


def _slide_renderer(path: str, htmx, request):
    from ... import content_routes, core

    return content_routes.render_slide_deck(
        path,
        htmx,
        request,
        get_root_folder=core.get_root_folder,
        not_found=core.not_found,
        get_roles_from_auth=core.get_roles_from_auth,
        rbac_rules=core._rbac_rules,
        rbac_cfg=core._rbac_cfg,
        google_oauth_cfg=core._google_oauth_cfg,
        coerce_list=core._config._coerce_list,
        is_allowed=core.is_allowed,
        parse_frontmatter=core.parse_frontmatter,
        resolve_markdown_title=core.resolve_markdown_title,
        slug_to_title=core.slug_to_title,
        effective_abbreviations=core._effective_abbreviations,
        from_md=core.from_md,
        layout=core.layout,
    )


def _register_slides_route(rt, runtime):
    @rt("/slides/{path:path}")
    def slide_deck(path: str, htmx, request):
        return _slide_renderer(path, htmx, request)


EXTENSION = SlidesExtension(
    ExtensionMeta(
        "slides",
        "route",
        ("cap:route:slides", "cap:layout:mode:slide", "bundle:slides.runtime"),
        requires=("slot:layout", "cap:markdown_pipeline",),
        route_prefixes=("/slides",),
        scope_disable=True,
    )
)
META = EXTENSION.meta

__all__ = ["EXTENSION", "META"]
