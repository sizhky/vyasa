from pathlib import Path
import sys
import os
from .config import get_config, reload_config

# Import app at module level, but config will be initialized before it's used
from .core import app

def build_command():
    """CLI entry point for bloggy build command"""
    import argparse
    from .build import build_static_site
    
    parser = argparse.ArgumentParser(description='Build static site from markdown files')
    parser.add_argument('directory', nargs='?', help='Path to markdown files directory')
    parser.add_argument('-o', '--output', help='Output directory (default: ./dist)', default='dist')
    
    args = parser.parse_args(sys.argv[2:])  # Skip 'bloggy' and 'build'
    
    try:
        output_dir = build_static_site(input_dir=args.directory, output_dir=args.output)
        return 0
    except Exception as e:
        print(f"Error building static site: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        return 1

def cli():
    """CLI entry point for bloggy command
    
    Usage:
        bloggy [directory]                    # Run locally on 127.0.0.1:5001
        bloggy [directory] --host 0.0.0.0     # Run on all interfaces
        bloggy build [directory]              # Build static site
        bloggy build [directory] -o output    # Build to custom output directory
        
    Environment variables:
        BLOGGY_ROOT: Path to markdown files
        BLOGGY_HOST: Server host (default: 127.0.0.1)
        BLOGGY_PORT: Server port (default: 5001)
        
    Configuration file:
        Create a .bloggy file (TOML format) in your blog directory
    """
    import uvicorn
    import argparse
    
    # Check if first argument is 'build'
    if len(sys.argv) > 1 and sys.argv[1] == 'build':
        sys.exit(build_command())
    
    parser = argparse.ArgumentParser(description='Run Bloggy server')
    parser.add_argument('directory', nargs='?', help='Path to markdown files directory')
    parser.add_argument('--host', help='Server host (default: 127.0.0.1, use 0.0.0.0 for all interfaces)')
    parser.add_argument('--port', type=int, help='Server port (default: 5001)')
    parser.add_argument('--no-reload', action='store_true', help='Disable auto-reload')
    parser.add_argument('--user', help='Login username (overrides config/env)')
    parser.add_argument('--password', help='Login password (overrides config/env)')
    
    args = parser.parse_args()
    
    # Set root folder from arguments or environment
    if args.directory:
        root = Path(args.directory).resolve()
        if not root.exists():
            print(f"Error: Directory {root} does not exist")
            sys.exit(1)
        os.environ['BLOGGY_ROOT'] = str(root)
    
    # Initialize or reload config to pick up .bloggy file
    # This ensures .bloggy file is loaded and config is refreshed
    config = reload_config() if args.directory else get_config()
    
    # Get host and port from arguments, config, or use defaults
    host = args.host or config.get_host()
    port = args.port or config.get_port()
    reload = not args.no_reload

    # Set login credentials from CLI if provided
    if args.user:
        os.environ['BLOGGY_USER'] = args.user
    if args.password:
        os.environ['BLOGGY_PASSWORD'] = args.password

    print(f"Starting Bloggy server...")
    print(f"Blog root: {config.get_root_folder()}")
    print(f"Blog title: {config.get_blog_title()}")
    print(f"Serving at: http://{host}:{port}")
    if host == '0.0.0.0':
        print(f"Server accessible from network at: http://<your-ip>:{port}")
    
    # Configure reload to watch markdown files in the blog directory
    reload_kwargs = {}
    if reload:
        blog_root = config.get_root_folder()
        reload_kwargs = {
            "reload": True,
            "reload_dirs": [str(blog_root)],
            "reload_includes": ["*.md"]
        }
    else:
        reload_kwargs = {"reload": False}

    uvicorn.run("bloggy.main:app", host=host, port=port, **reload_kwargs)

if __name__ == "__main__":
    cli()