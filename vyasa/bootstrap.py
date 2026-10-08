from pathlib import Path
import os
import time

from fasthtml.common import Beforeware
from starlette.staticfiles import StaticFiles

AUTH_SKIP_ROUTES = [
    r"^/login$",
    r"^/unlock(/lock)?$",
    # Studio capability requests come from a sandboxed frame without cookies; Studio validates them.
    r"^/marimo/[^/]+/_marimo-studio/presentation/.*",
    r"^/login/[a-z]+$",
    r"^/auth/[a-z]+/callback$",
    r"^/_vyasa/.*",
    r"^/_sidebar/.*",
    r"^/static/.*",
    r".*\.css",
    r".*\.js",
]


class DevStaticFiles(StaticFiles):
    def file_response(self, full_path, stat_result, scope, status_code=200):
        start = time.perf_counter()
        response = super().file_response(full_path, stat_result, scope, status_code)
        # Normal refresh should revalidate local dev assets instead of requiring hard refresh.
        response.headers["Cache-Control"] = "no-cache, max-age=0, must-revalidate"
        try:
            path = scope.get("path", "")
            if path.endswith("viewport_core.js") or "/extensions/tasks/" in path:
                from loguru import logger

                logger.info(
                    "static asset path={} status={} bytes={} elapsed_ms={:.2f}",
                    path,
                    response.status_code,
                    response.headers.get("content-length", ""),
                    (time.perf_counter() - start) * 1000,
                )
        except Exception:
            pass
        return response


def build_beforeware(handler, enabled: bool):
    if not enabled:
        return None
    return Beforeware(handler, skip=AUTH_SKIP_ROUTES)


def build_app(app_factory, hdrs, beforeware):
    from .vendor import mount_vendor, vendor_hdrs

    secret_key = os.environ.get("VYASA_SESSION_SECRET") or None
    app = app_factory(hdrs=hdrs, before=beforeware, exts="ws", secret_key=secret_key) if beforeware else app_factory(hdrs=hdrs, exts="ws", secret_key=secret_key)
    mount_vendor(app)
    app.hdrs = vendor_hdrs(app.hdrs)
    return app


def mount_package_static(app_instance, package_dir: Path):
    static_dir = package_dir / "static"
    if static_dir.exists():
        app_instance.mount("/static", DevStaticFiles(directory=str(static_dir)), name="static")
