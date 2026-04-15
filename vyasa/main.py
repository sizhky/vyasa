from pathlib import Path
import sys
import os
import threading
import webbrowser
from importlib.metadata import PackageNotFoundError, version as pkg_version
from .config import get_config, reload_config
from .logging import configure_logging

_core_app = None
_browser_url = None
_browser_opened = False
_logging_configured = False


def _ensure_logging_configured():
    global _logging_configured
    if not _logging_configured:
        configure_logging()
        _logging_configured = True

async def app(scope, receive, send):
    global _core_app, _browser_opened
    _ensure_logging_configured()
    if _core_app is None:
        from .core import app as core_app, ensure_app_initialized
        ensure_app_initialized()
        _core_app = core_app
    async def wrapped_send(message):
        global _browser_opened
        if (
            scope["type"] == "lifespan"
            and message.get("type") == "lifespan.startup.complete"
            and _browser_url
            and not _browser_opened
        ):
            _browser_opened = True
            threading.Timer(0.1, lambda: webbrowser.open(_browser_url)).start()
            print(f"Opening browser at: {_browser_url}")
        await send(message)
    await _core_app(scope, receive, wrapped_send)

def _get_vyasa_version():
    try:
        return pkg_version("vyasa")
    except PackageNotFoundError:
        init_file = Path(__file__).with_name("__init__.py")
        try:
            for line in init_file.read_text(encoding="utf-8").splitlines():
                if line.startswith("__version__"):
                    return line.split("=", 1)[1].strip().strip('"').strip("'")
        except OSError:
            pass
        return "unknown"

def build_command():
    """CLI entry point for vyasa build command"""
    import argparse
    from .build import build_static_site
    
    parser = argparse.ArgumentParser(description='Build static site from markdown files')
    parser.add_argument('directory', nargs='?', help='Path to markdown files directory')
    parser.add_argument('-o', '--output', help='Output directory (default: ./dist)', default='dist')
    parser.add_argument('--show-hidden', action='store_true', help='Include hidden files and folders in listings')
    
    args = parser.parse_args(sys.argv[2:])  # Skip 'vyasa' and 'build'
    if args.show_hidden:
        os.environ['VYASA_SHOW_HIDDEN'] = 'true'
    
    try:
        output_dir = build_static_site(input_dir=args.directory, output_dir=args.output)
        return 0
    except Exception as e:
        print(f"Error building static site: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        return 1

def cli():
    """CLI entry point for vyasa command
    
    Usage:
        vyasa [directory]                    # Run locally on 127.0.0.1:5001
        vyasa [directory] --host 0.0.0.0     # Run on all interfaces
        vyasa build [directory]              # Build static site
        vyasa build [directory] -o output    # Build to custom output directory
        
    Environment variables:
        VYASA_ROOT: Path to markdown files
        VYASA_HOST: Server host (default: 127.0.0.1)
        VYASA_PORT: Server port (default: 5001)
        
    Configuration file:
        Create a .vyasa file (TOML format) in your blog directory
    """
    import uvicorn
    import argparse

    if "--version" in sys.argv[1:] or "-V" in sys.argv[1:]:
        print(_get_vyasa_version())
        return
    
    # Check if first argument is 'build'
    if len(sys.argv) > 1 and sys.argv[1] == 'build':
        sys.exit(build_command())
    
    parser = argparse.ArgumentParser(description='Run Vyasa server')
    parser.add_argument('directory', nargs='?', help='Path to markdown files directory')
    parser.add_argument('--host', help='Server host (default: 127.0.0.1, use 0.0.0.0 for all interfaces)')
    parser.add_argument('--port', type=int, help='Server port (default: 5001)')
    parser.add_argument('--no-reload', action='store_true', help='Disable auto-reload')
    parser.add_argument('--no-browser', action='store_true', help='Do not open the site in a browser')
    parser.add_argument('--user', help='Login username (overrides config/env)')
    parser.add_argument('--password', help='Login password (overrides config/env)')
    parser.add_argument('--show-hidden', action='store_true', help='Include hidden files and folders in listings')
    parser.add_argument('--theme-debug', action='store_true', help='Show runtime theme preset switcher for debugging')
    parser.add_argument('--log-file', action='store_true', help='Write DEBUG logs to vyasa.log')
    
    args = parser.parse_args()
    
    # Set root folder from arguments or environment
    if args.directory:
        root = Path(args.directory).resolve()
        if not root.exists():
            print(f"Error: Directory {root} does not exist")
            sys.exit(1)
        os.environ['VYASA_ROOT'] = str(root)
    
    # Initialize config after CLI/env overrides are in place.
    config = reload_config()
    
    # Get host and port from arguments, config, or use defaults
    host = args.host or config.get_host()
    port = args.port or config.get_port()
    reload = not args.no_reload

    # Set login credentials from CLI if provided
    if args.user:
        os.environ['VYASA_USER'] = args.user
    if args.password:
        os.environ['VYASA_PASSWORD'] = args.password
    if args.show_hidden:
        os.environ['VYASA_SHOW_HIDDEN'] = 'true'
        config = reload_config()
    theme_debug_enabled = args.theme_debug or str(os.environ.get('VYASA_THEME_DEBUG', '')).strip().lower() in {'true', '1', 'yes', 'on'}
    if theme_debug_enabled:
        os.environ['VYASA_THEME_DEBUG'] = 'true'
        config = reload_config()
    if args.log_file:
        os.environ['VYASA_LOG_FILE'] = 'true'
        config = reload_config()

    print(f"Starting Vyasa server...")
    print(f"Blog root: {config.get_root_folder()}")
    print(f"Blog title: {config.get_blog_title()}")
    print(f"Serving at: http://{host}:{port}")
    if host == '0.0.0.0':
        print(f"Server accessible from network at: http://<your-ip>:{port}")

    global _browser_url, _browser_opened
    browser_host = '127.0.0.1' if host == '0.0.0.0' else host
    _browser_url = None if args.no_browser else f"http://{browser_host}:{port}"
    _browser_opened = False
    
    # Configure reload to watch markdown and PDF files in the blog directory
    reload_kwargs = {}
    if reload:
        blog_root = config.get_root_folder()
        source_dir = os.environ.get("VYASA_SOURCE_DIR", "").strip()
        reload_dirs = [] if config.get_ignore_cwd_as_root() else [str(blog_root)]
        reload_dirs.extend(str(path) for path in config.get_vyasa_roots())
        if source_dir:
            source_path = Path(source_dir).expanduser().resolve()
            if source_path.exists():
                reload_dirs.append(str(source_path))
            else:
                print(f"Warning: VYASA_SOURCE_DIR does not exist: {source_path}")
        reload_excludes = [f"*/{name}/*" for name in config.get_reload_excludes()]
        reload_excludes.append(".py[cod]")
        reload_excludes.append(".sw.*")
        reload_excludes.append("~*")
        reload_excludes.extend([
            "*.db",
            "*.db-journal",
            "*.db-wal",
            "*.db-shm",
            ".vyasa-*.db",
            ".vyasa-*.db-journal",
            ".vyasa-*.db-wal",
            ".vyasa-*.db-shm",
        ])
        reload_kwargs = {
            "reload": True,
            "reload_dirs": reload_dirs,
            "reload_includes": ["*.md", "*.pdf", "*.py", "*.vyasa", ".vyasa", ".*"],
            "reload_excludes": reload_excludes,
        }
    else:
        reload_kwargs = {"reload": False}
    print(f"Reload enabled: {reload} for directories: {reload_kwargs.get('reload_dirs', [])}")

    _ensure_logging_configured()
    uvicorn.run("vyasa.main:app", host=host, port=port, log_config=None, **reload_kwargs)

if __name__ == "__main__":
    cli()
