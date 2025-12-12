from pathlib import Path
import sys
import os
from .core import app

def cli():
    """CLI entry point for bloggy command"""
    import uvicorn
    
    # Set root folder from arguments or environment
    if len(sys.argv) > 1:
        root = Path(sys.argv[1]).resolve()
        if not root.exists():
            print(f"Error: Directory {root} does not exist")
            sys.exit(1)
        os.environ['BLOGGY_ROOT'] = str(root)
    
    # Get host and port from environment or use defaults
    host = os.getenv('BLOGGY_HOST', '127.0.0.1')
    port = int(os.getenv('BLOGGY_PORT', '5001'))
    
    print(f"Starting Bloggy server...")
    print(f"Blog root: {os.getenv('BLOGGY_ROOT', Path.cwd())}")
    print(f"Serving at: http://{host}:{port}")
    
    uvicorn.run("bloggy.main:app", host=host, port=port, reload=True)

if __name__ == "__main__":
    cli()