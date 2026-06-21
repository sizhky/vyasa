from pathlib import Path

from fasthtml.common import Li
from fasthtml.common import to_xml

from vyasa.build import static_layout
from vyasa.document_pages import copy_raw_button, copy_raw_nodes, copy_text_button, fold_all_button, present_button
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
    assert "vyasa-navbar-search-input" in html


def test_navbar_sidebar_toggles_have_animation_targets():
    from vyasa.extensions_builtin.table_of_contents import _mobile_toc_toggle
    from vyasa.nav_views import navbar_view

    html = to_xml(navbar_view("BLOG", "", show_mobile_menus=True, mobile_extra_controls=[_mobile_toc_toggle({"show_toc": True})]))

    assert 'data-vyasa-sidebar-toggle="posts"' in html
    assert 'data-vyasa-sidebar-toggle="toc"' in html


def test_sidebar_title_click_hides_docked_sidebar_and_pulses_nav_icon():
    source = Path("vyasa/static/scripts.js").read_text(encoding="utf-8")
    css = Path("vyasa/static/header.css").read_text(encoding="utf-8")
    toc_source = Path("vyasa/extensions_builtin/table_of_contents.py").read_text(encoding="utf-8")

    assert ".vyasa-sidebar-docked > details[data-sidebar] > summary.vyasa-sidebar-toggle" in source
    assert "pulseNavbarToggle(kind)" in source
    assert "vyasa-sidebar-toggle-pulse" in css
    assert 'data_sidebar="toc"' in toc_source


def test_theme_toggle_icon_keeps_ink_color_on_focus():
    css = Path("vyasa/static/header.css").read_text(encoding="utf-8")

    assert "#theme-mode-toggle:focus" in css
    assert "--vyasa-emphasis-control-text: var(--vyasa-ink)" in css
    assert "#theme-mode-toggle [uk-icon]" in css
    assert "stroke: currentColor !important" in css


def test_toc_sidebar_defaults_closed_but_open_choice_persists():
    head_init = Path("vyasa/static/head-init.js").read_text(encoding="utf-8")
    scripts = Path("vyasa/static/scripts.js").read_text(encoding="utf-8")

    assert "kind === 'toc' && stored !== '0'" in head_init
    assert "localStorage.setItem(`vyasa-${kind}-sidebar-hidden`, '0')" in scripts


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


def test_no_scroll_layout_keeps_minor_side_padding():
    source = Path("vyasa/layout_page.py").read_text(encoding="utf-8")

    assert 'main_column_padding_cls = "px-2" if no_scroll else "px-4"' in source
    assert "{main_column_padding_cls} flex flex-1" in source


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
    html = (
        to_xml(fold_all_button())
        + to_xml(present_button("guide/page"))
        + to_xml(copy_raw_button("Copy Markdown", "# Heading", "raw-md-toast"))
    )

    assert "vyasa-page-action-icon" in html
    assert "<uk-icon" not in html
    assert html.count("vyasa-page-action-tooltip") == 3
    assert 'data-tooltip="Fold all sections (C)"' in html
    assert 'data-tooltip="Present document"' in html
    assert 'data-tooltip="Copy raw markdown"' in html


def test_fold_all_script_keeps_tooltip_in_sync_with_button_state():
    source = Path("vyasa/static/scripts.js").read_text()

    assert "function syncFoldAllButton(button, allOpen)" in source
    assert "button.dataset.tooltip = `${label} sections (C)`;" in source
    assert "syncFoldAllButton(toggle, shouldOpen);" in source


def test_copy_markdown_button_keeps_raw_content_out_of_searchable_dom():
    button_html = to_xml(copy_raw_button("Copy Markdown", "# Heading\nbody", "raw-md-toast"))
    aux_html = "".join(to_xml(node) for node in copy_raw_nodes("# Heading\nbody"))

    assert "data-copy-payload=" in button_html
    assert 'id="raw-md-clipboard"' not in aux_html


def test_copy_relative_path_button_carries_shift_copy_absolute_payload():
    button, _, target = copy_text_button(
        "Copy Relative Path",
        "notes/x.md",
        "relative-path-clipboard",
        "relative-path-toast",
        alternate_text="/tmp/notes/x.md",
    )

    button_html = to_xml(button)
    target_html = to_xml(target)

    assert "data-copy-payload=" in button_html
    assert "data-copy-alternate-payload=" in button_html
    assert 'data-tooltip="Click: relative path. Shift-click: absolute path."' in button_html
    assert "event.shiftKey" in button_html
    assert 'aria-label="Copy Relative Path. Shift-click copies absolute path."' in button_html
    assert "vyasa-page-action-tooltip" in button_html
    assert 'class="sr-only"' in button_html
    assert "/tmp/notes/x.md" not in target_html
