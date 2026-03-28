from pathlib import Path

from fasthtml.common import Beforeware
from starlette.staticfiles import StaticFiles

AUTH_SKIP_ROUTES = [
    r"^/login$",
    r"^/login/google$",
    r"^/auth/google/callback$",
    r"^/_sidebar/.*",
    r"^/static/.*",
    r".*\.css",
    r".*\.js",
]


class DevStaticFiles(StaticFiles):
    def file_response(self, full_path, stat_result, scope, status_code=200):
        response = super().file_response(full_path, stat_result, scope, status_code)
        # Normal refresh should revalidate local dev assets instead of requiring hard refresh.
        response.headers["Cache-Control"] = "no-cache, max-age=0, must-revalidate"
        return response


def build_beforeware(handler, enabled: bool):
    if not enabled:
        return None
    return Beforeware(handler, skip=AUTH_SKIP_ROUTES)


def build_app(app_factory, hdrs, beforeware):
    return app_factory(hdrs=hdrs, before=beforeware, exts="ws") if beforeware else app_factory(hdrs=hdrs, exts="ws")


def mount_package_static(app_instance, package_dir: Path):
    static_dir = package_dir / "static"
    if static_dir.exists():
        app_instance.mount("/static", DevStaticFiles(directory=str(static_dir)), name="static")
