from pathlib import Path
from .core import *

if __name__ == "__main__":
    import uvicorn
    import sys
    ROOT_FOLDER = Path(sys.argv[1]) if len(sys.argv) > 1 else Path.cwd() / 'posts'
    uvicorn.run("bloggy.main:app", reload=True)