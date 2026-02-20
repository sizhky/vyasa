__version__ = "0.3.7"
__all__ = ['app', 'rt', 'get_root_folder', 'get_blog_title', '__version__']

def __getattr__(name):
    if name in {'app', 'rt', 'get_root_folder', 'get_blog_title'}:
        from .core import app, rt, get_root_folder, get_blog_title
        return {
            'app': app,
            'rt': rt,
            'get_root_folder': get_root_folder,
            'get_blog_title': get_blog_title,
        }[name]
    raise AttributeError(f"module 'vyasa' has no attribute '{name}'")
