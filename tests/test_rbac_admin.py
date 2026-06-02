from functools import lru_cache

from vyasa import core
from vyasa.runtime_context import traced
from vyasa.runtime_services import get_runtime_services


def test_traced_preserves_cache_controls():
    @traced("test")
    @lru_cache(maxsize=2)
    def cached_value(value):
        return value

    assert callable(cached_value.cache_clear)
    assert callable(cached_value.cache_info)


def test_rbac_admin_runtime_cache_services_can_be_cleared():
    services = get_runtime_services()

    assert services.cached_build_post_tree is core._cached_build_post_tree
    assert services.cached_posts_sidebar_html is core._cached_posts_sidebar_html
    assert callable(services.cached_build_post_tree.cache_clear)
    assert callable(services.cached_posts_sidebar_html.cache_clear)
