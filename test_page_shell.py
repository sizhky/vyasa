from pathlib import Path

from fasthtml.common import Li
from fasthtml.common import to_xml

from vyasa.build import static_layout
from vyasa.document_pages import fold_all_button, present_button
from vyasa.core import _row_action_decorator
from vyasa.extensions import ActionRegistry, NavigationAction
from vyasa.nav_views import FILE_ROW_CLASSES, NavigationRow, TREE_ACTION_BUTTON_CLASSES, navigation_row_view


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


def test_sidebar_row_actions_use_shared_button_class():
    registry = ActionRegistry([
        lambda **kwargs: NavigationAction(id="x", label="Do thing", icon_text="*", attrs={"data_test_action": "true"})
    ])
    row = NavigationRow(slug="guide/page", title="Guide", label="Guide", href="/posts/guide/page", icon="file-text")

    html = to_xml(_row_action_decorator(registry)(navigation_row_view(row, cls=FILE_ROW_CLASSES), slug="guide/page", title="Guide"))

    for class_name in TREE_ACTION_BUTTON_CLASSES.split():
        assert class_name in html


def test_bookmark_js_uses_tree_row_shell_contract():
    script = Path("vyasa/extensions_builtin/bookmarks/static/bookmarks.js").read_text(encoding="utf-8")

    assert "vyasa-tree-row-shell post-link vyasa-bookmark-link" in script
    assert "py-1 px-2" not in script


def test_document_action_buttons_render_inline_icons():
    html = to_xml(fold_all_button()) + to_xml(present_button("guide/page"))

    assert "vyasa-page-action-icon" in html
    assert "<uk-icon" not in html
