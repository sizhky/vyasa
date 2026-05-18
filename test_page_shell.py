from fasthtml.common import Li
from fasthtml.common import to_xml

from vyasa.build import static_layout
from vyasa.nav_views import NavigationRow, navigation_row_view


def test_static_layout_uses_shared_shell_hooks():
    html = static_layout(
        "<h1>Page</h1>",
        "BLOG",
        "Page - BLOG",
        [Li("Entry")],
        "/static/icon.svg",
        current_path="page",
    )

    assert "vyasa-navbar-shell" in html
    assert "vyasa-content-grid" in html
    assert "vyasa-main-shell" in html
    assert "vyasa-posts-sidebar" in html
    assert "Powered by Vyasa" in html


def test_static_layout_hides_updated_label_in_navbar():
    html = static_layout(
        "<h1>Page</h1>",
        "BLOG",
        "Page - BLOG",
        [Li("Entry")],
        "/static/icon.svg",
        current_path="page",
        updated_label="Updated 5 min ago",
    )

    assert "Updated 5 min ago" not in html


def test_navigation_row_view_renders_from_row_model():
    row = NavigationRow(slug="guide/page", title="Guide", label="Guide", href="/posts/guide/page", icon="file-text")

    html = to_xml(navigation_row_view(row, cls="post-link"))

    assert 'data-path="guide/page"' in html
    assert 'href="/posts/guide/page"' in html
    assert "Guide" in html
