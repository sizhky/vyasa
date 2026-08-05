from pathlib import Path

from fasthtml.common import Button, Li
from fasthtml.common import to_xml

from vyasa.build import static_layout
from vyasa.document_pages import copy_raw_button, copy_raw_nodes, copy_text_button, fold_all_button, present_button
from vyasa.core import _row_action_decorator
from vyasa.extensions import ActionRegistry, NavigationAction
from vyasa.nav_views import FILE_ROW_CLASSES, NavigationRow, TREE_ACTION_BUTTON_CLASSES, navigation_row_view
from vyasa.tree_rendering import _folder_summary


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


def test_navbar_control_sits_left_of_search():
    from vyasa.nav_views import navbar_view

    html = to_xml(navbar_view("BLOG", "", ref_switcher=Button("Annotations", cls="annotations-control")))

    assert html.index("annotations-control") < html.index("vyasa-navbar-search-input")


def test_compact_navbar_uses_panel_toggle_not_embedded_posts_tree():
    from vyasa.nav_views import navbar_view

    html = to_xml(navbar_view("BLOG", "", posts_menu_items=[Li("Huge tree")], compact_mode=True))
    layout_source = Path("vyasa/layout_page.py").read_text(encoding="utf-8")

    assert 'data-vyasa-sidebar-toggle="posts"' in html
    assert "Huge tree" not in html
    assert "nav_posts_items = get_posts" not in layout_source


def test_compact_posts_panel_is_available_on_desktop():
    source = Path("vyasa/layout_page.py").read_text(encoding="utf-8")

    assert 'posts_panel_visibility_cls = "" if nav_posts_menu else "xl:hidden"' in source


def test_sidebar_title_click_hides_docked_sidebar_and_pulses_nav_icon():
    source = Path("vyasa/static/scripts.js").read_text(encoding="utf-8")
    css = Path("vyasa/static/header.css").read_text(encoding="utf-8")
    toc_source = Path("vyasa/extensions_builtin/table_of_contents.py").read_text(encoding="utf-8")

    assert ".vyasa-sidebar-docked > details[data-sidebar] > summary.vyasa-sidebar-toggle" in source
    assert "pulseNavbarToggle(kind)" in source
    assert "vyasa-sidebar-toggle-pulse" in css
    assert 'data_sidebar="toc"' in toc_source


def test_mobile_sidebar_processes_copied_htmx_controls():
    source = Path("vyasa/static/scripts.js").read_text(encoding="utf-8")

    assert "window.htmx?.process(mobileBody)" in source


def test_mobile_panels_fill_dynamic_viewport_without_page_overflow():
    css = Path("vyasa/static/header.css").read_text(encoding="utf-8")

    assert "height: 100dvh" in css
    assert ".vyasa-mobile-panel-body {" in css
    assert "flex: 1 1 auto" in css
    assert "overscroll-behavior-y: contain" in css
    assert ".vyasa-mobile-panel-body > .vyasa-sidebar-card::details-content" in css
    assert ".vyasa-mobile-panel-body > .vyasa-sidebar-card .vyasa-sidebar-body" in css
    assert "max-height: none !important" in css


def test_floating_actions_park_on_screen_edge_and_reveal_together():
    source = Path("vyasa/static/header.css").read_text(encoding="utf-8")

    assert ".vyasa-floating-actions::before" in source
    assert "transform: translateX(60%)" in source
    assert "transform: translateX(-1.25rem)" in source
    assert ".vyasa-floating-actions:hover" in source
    assert ".vyasa-floating-actions:focus-within" in source
    assert "cubic-bezier(.34, 1.56, .64, 1)" in source
    assert "prefers-reduced-motion: reduce" in source


def test_posts_and_slides_share_shortcut_help():
    shell = Path("vyasa/static/page_shell.js").read_text(encoding="utf-8")
    scripts = Path("vyasa/static/scripts.js").read_text(encoding="utf-8")

    assert "export function ensureShortcutHelp" in shell
    assert "title: 'Document shortcuts'" in scripts


def test_theme_toggle_icon_keeps_ink_color_on_focus():
    css = Path("vyasa/static/header.css").read_text(encoding="utf-8")

    assert "#theme-mode-toggle:focus" in css
    assert "--vyasa-emphasis-control-text: var(--vyasa-ink)" in css
    assert "#theme-mode-toggle [uk-icon]" in css
    assert "stroke: currentColor !important" in css


def test_git_ref_select_resets_control_alignment():
    css = Path("vyasa/static/header.css").read_text(encoding="utf-8")

    assert ".vyasa-ref-select" in css
    assert "justify-content: flex-start" in css
    assert "appearance: none" in css
    assert "font: inherit" in css
    assert "--vyasa-emphasis-control-menu-text: var(--vyasa-ink)" in css
    assert "--vyasa-emphasis-control-menu-bg: color-mix(in srgb, var(--vyasa-paper-raised) 94%, var(--vyasa-primary) 6%)" in css
    assert "--vyasa-emphasis-control-text: var(--vyasa-emphasis-control-menu-text)" in css
    assert "--vyasa-emphasis-control-bg-hover: var(--vyasa-emphasis-control-menu-option-hover)" in css


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


def test_folder_rows_expose_hover_pin_control():
    html = to_xml(_folder_summary("Guides"))
    script = Path("vyasa/static/scripts.js").read_text(encoding="utf-8")
    css = Path("vyasa/static/header.css").read_text(encoding="utf-8")

    assert 'data-folder-pin="true"' in html
    assert 'aria-label="Pin folder open"' in html
    assert "details.dataset.folderPinned !== 'true'" in script
    assert "details.dataset.folderPinnedChild !== 'true'" in script
    assert "if (e.key === '1')" in script
    assert "e.shiftKey && e.code === 'Digit1'" in script
    assert "folder hover expand (Shift+1)" in script
    assert "localStorage.getItem('vyasa:pinnedFolders')" in script
    assert "data_folder_path=rel_folder" in Path("vyasa/tree_rendering.py").read_text(encoding="utf-8")
    assert '.vyasa-folder-pin > uk-icon { transform: rotate(-45deg)' in css
    assert 'details[data-folder-pinned-child="true"] > summary > .vyasa-folder-pin' in css
    assert "hoverTarget = details.querySelector(':scope > summary .vyasa-tree-link')" in script
    assert "hoverTarget.addEventListener('mouseenter'" in script


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
    assert 'data-vyasa-present-document="true"' in html
    assert 'data-tooltip="Copy raw markdown"' in html


def test_fold_all_script_keeps_tooltip_in_sync_with_button_state():
    source = Path("vyasa/static/scripts.js").read_text()

    assert "function syncFoldAllButton(button, allOpen)" in source
    assert "button.dataset.tooltip = `${label} sections (C)`;" in source
    assert "syncFoldAllButton(toggle, shouldOpen);" in source


def test_document_keyboard_shortcuts_scroll_with_j_and_k():
    source = Path("vyasa/static/scripts.js").read_text()
    shell = Path("vyasa/static/page_shell.js").read_text()

    assert "(e.key === 'j' || e.key === 'k')" in source
    assert "const documentScroll = createMomentumRunner({" in source
    assert "documentScroll.release(direction)" in source
    assert "['wheel', 'touchstart', 'pointerdown', 'htmx:beforeSwap']" in source
    assert "!mainContent?.classList.contains('vyasa-zen-present')" in source

    # The motion model itself now lives in the shell so the graph shares it.
    assert "acceleration: 0.0025" in shell
    assert "friction: 0.012" in shell
    assert "lastTime === null ? 16 : Math.min(32" in shell
    assert "prefers-reduced-motion: reduce" in shell


def test_sidebars_bound_main_content_width():
    source = Path("vyasa/static/scripts.js").read_text(encoding="utf-8")
    css = Path("vyasa/static/header.css").read_text(encoding="utf-8")

    assert ".vyasa-content-grid {\n    min-width: 0;" in css
    assert "overflow: clip;" in css
    assert "#content-with-sidebars .tasks-container:not([data-tasks-maximized=\"true\"])" in css
    assert "#content-with-sidebars .vyasa-main-shell img" in css
    assert "#content-with-sidebars .vyasa-main-shell svg" not in css
    assert "width: 100% !important;" in css
    assert "window.dispatchEvent(new Event('resize'));" in source


def test_document_heading_spacing_uses_shared_before_and_after_gaps():
    css = Path("vyasa/static/header.css").read_text(encoding="utf-8")

    assert "--vyasa-heading-before-gap: 1rem;" in css
    assert "--vyasa-heading-after-gap: 0.7rem;" in css
    assert "#main-content .vyasa-doc-heading {" in css
    assert "#main-content .vyasa-heading-fold {" in css
    assert "#main-content .vyasa-heading-fold-body > :last-child {" in css


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
