from fasthtml.common import to_xml
import html
import json
from pathlib import Path
import re
from textwrap import dedent

from vyasa.extensions_builtin.markdown.renderer import from_md


def test_tasks_block_renders_widget_payload_and_summary():
    md = """```tasks
title: Hybrid Task Rendering
foundation :: Foundation:
  - t1 :: Define graph payload
```"""

    html = to_xml(from_md(md))

    assert 'class="tasks-container' in html
    assert 'data-tasks-widget="true"' in html
    assert '"graph_id": "hybrid-task-rendering-' in html
    assert '"label": "Foundation"' in html
    assert "1 groups, 1 items, 0 edges" in html


def test_tasks_block_renders_title_filter_toggle():
    html = to_xml(from_md("""```tasks
title: Filters
foundation :: Foundation:
```"""))

    assert 'aria-label="Toggle task filters"' in html
    assert "runTasksHeaderAction(" in html
    assert "toggleFilters" in html


def test_tasks_filter_source_hides_rank():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()
    filter_source = source.split("function tasksFilterOptions", 1)[1].split("function tasksColorOptions", 1)[0]

    assert "'rank'" in filter_source


def test_tasks_block_invalid_body_falls_back_to_empty_payload():
    md = """```tasks
id: broken
groups: [oops
```"""

    html = to_xml(from_md(md))

    assert 'class="tasks-container' in html
    assert '"groups": []' in html
    assert '"tasks": []' in html


def test_tasks_block_reads_frontmatter_options():
    md = """```tasks
---
title: Gateway Policies
default_open_depth: 2
width: 70vw
height: 60vh
---
foundation :: Foundation:
```"""

    html = to_xml(from_md(md))

    assert 'data-tasks-title="Gateway Policies"' in html
    assert 'data-tasks-default-open-depth="2"' in html
    assert 'style="width: 70vw; position: relative;' in html
    assert "min-height: 85vh" not in html
    assert 'height:60vh;min-height:420px' in html
    assert 'data-tasks-open-filters-default="false"' in html


def test_tasks_block_reads_node_card_width_option():
    md = """```tasks
---
title: Node Card Width
node-card-width: 36rem
---
foundation :: Foundation:
```"""

    html = to_xml(from_md(md))

    assert 'data-tasks-node-card-width="36rem"' in html


def test_tasks_block_reads_hover_font_size_option():
    md = """```tasks
---
title: Hover Font
hover-font-size: 14px
---
foundation :: Foundation:
```"""

    html = to_xml(from_md(md))

    assert 'data-tasks-hover-font-size="14px"' in html


def test_tasks_block_reads_projection_group_opacity_option():
    md = """```tasks
---
title: Projection Group Opacity
projection-group-opacity: 18
---
foundation :: Foundation:
```"""

    html = to_xml(from_md(md))

    assert 'data-tasks-projection-group-opacity="18"' in html


def test_tasks_block_opens_filters_by_default_for_width_over_90vw():
    md = """```tasks
---
title: Wide Filters
width: 90.1vw
---
foundation :: Foundation:
```"""

    html = to_xml(from_md(md))

    assert 'data-tasks-open-filters-default="true"' in html


def test_tasks_block_opens_filters_by_default_at_90vw():
    md = """```tasks
---
title: Boundary Filters
width: 90vw
---
foundation :: Foundation:
```"""

    html = to_xml(from_md(md))

    assert 'data-tasks-open-filters-default="true"' in html


def test_tasks_block_does_not_open_filters_by_default_below_90vw():
    md = """```tasks
---
title: Narrow Filters
width: 89.9vw
---
foundation :: Foundation:
```"""

    html = to_xml(from_md(md))

    assert 'data-tasks-open-filters-default="false"' in html


def test_tasks_block_breaks_out_for_full_width():
    md = """```tasks
---
title: Full Width Tasks
width: 100%
---
foundation :: Foundation:
```"""

    html = to_xml(from_md(md))

    assert 'style="width: 100%; position: relative; left: 50%; transform: translateX(-50%);"' in html


def test_tasks_fullscreen_copies_filter_default_flag():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()

    assert "data-tasks-open-filters-default" in source
    assert "data-tasks-projection-group-opacity" in source
    assert "data-tasks-hover-font-size" in source


def test_tasks_source_lazy_loads_react_flow_only_when_widgets_exist():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()

    assert "const wrappers = Array.from(rootElement.querySelectorAll('.tasks-container[data-tasks-widget=\"true\"]'));" in source
    assert "if (!wrappers.length) return;" in source
    assert "const rf = await ensureTasksReactFlow();" in source


def test_tasks_source_retries_mount_after_swap_when_widget_size_is_zero():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()

    assert "let needsRetry = false;" in source
    assert "needsRetry = true;" in source
    assert "window.requestAnimationFrame(() => { renderTasksGraphs(rootElement); });" in source


def test_tasks_source_uses_projection_scoped_prefs():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()

    assert "function readTasksProjectionPrefs" in source
    assert "projectionPrefs" in source
    assert "buildTasksViewState" in source


def test_tasks_source_uses_base_view_label_for_default_projection_tab():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()

    assert "const baseViewLabel = String(model?.base_view_label || '').trim() || 'Default';" in source
    assert "{ id: '', label: baseViewLabel, caption: '' }" in source


def test_tasks_source_uses_reset_button_label():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()

    assert "'Reset'" in source


def test_tasks_source_supports_continuous_gradient_palettes():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()

    assert "function isTasksGradientPalette" in source
    assert "function resolveTasksGradientColor" in source
    assert "linear-gradient(90deg" in source
    assert "stop.label ||" in source
    assert "continuousColorKeys.has" in source


def test_tasks_projection_group_colors_respect_active_color_by_only():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()
    projection_color_source = source.split("function resolveTasksProjectionGroupOwnColor", 1)[1].split("function resolveTasksProjectionGroupDimensionColor", 1)[0]

    assert "colorByOverride = null" in projection_color_source
    assert "const value = node[colorBy];" in projection_color_source
    assert "Object.entries(node)" not in projection_color_source


def test_tasks_projection_groups_use_their_own_dimension_tone():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()

    assert "function resolveTasksProjectionGroupDimensionColor" in source
    assert "const projectionGroupTone = isProjectionGroup ? resolveTasksProjectionGroupDimensionColor(n, model) : '';" in source
    assert "const groupColor = projectionGroupTone || nodeColor;" in source


def test_tasks_edge_labels_use_react_flow_bezier_coordinates():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()

    assert "const [path, labelX, labelY] = rf.getBezierPath(props);" in source
    assert "translate(${labelX}px, ${labelY}px)" in source


def test_tasks_selected_panel_uses_measured_adaptive_width():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()

    assert "function tasksSelectedPanelWidth" in source
    assert "measureTextWidth(node?.label || node?.id || ''" in source
    assert "Math.min(560, Math.max(250" in source
    assert "width: `min(${panelWidth}px, 100%)`" in source


def test_tasks_group_hover_tooltip_wraps_long_values_inside_max_width():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()

    assert "gridTemplateColumns: 'minmax(0, auto) minmax(0, 1fr)'" in source
    assert "whiteSpace: 'normal', overflowWrap: 'anywhere', wordBreak: 'break-word', minWidth: 0" in source
    assert "width: rows.length ? 'min(280px, max-content)' : 'max-content'" in source
    assert "maxWidth: '280px'" in source
    assert "boxSizing: 'border-box'" in source
    assert "fontSize: hoverFontSize" in source
    assert "fontSize: `calc(${hoverFontSize} * 1.12)`" in source


def test_tasks_fullscreen_reuses_canvas_background_contract():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()

    assert "function tasksBackgroundProps(widgetId)" in source
    assert "id: `${key}-bg`" in source
    assert "window.React.createElement(rf.Background, backgroundProps)" in source
    assert "fullscreenWrapper.className = `${wrapper.className} w-full h-full`" in source
    assert "tasksHeaderControlsHtml(fullscreenId, false)" in source
    assert "runTasksHeaderAction('${fullscreenId}', 'toggleFilters')" in source


def test_tasks_filter_sidebar_search_reuses_filter_highlight_path():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()

    assert "function tasksSearchSpec(query)" in source
    assert "function tasksCollectSearchMatches(nodes, edges, query)" in source
    assert "const [searchInputValue, setSearchInputValue] = React.useState" in source
    assert "window.setTimeout(() => {" in source
    assert "}, 140);" in source
    assert "placeholder: 'text or /regex/i'" in source
    assert "setSearchQuery('')" in source
    assert "const hasSearch = searchMatches.active && !searchMatches.error;" in source
    assert "const filterPanelElement = FilterPanel();" in source


def test_tasks_edge_zoom_agnostic_label_scale_only_on_hover_focus():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()

    assert "const prominentLabel = highlightMode === 'focused-in' || highlightMode === 'focused-out';" in source


def test_tasks_block_serializes_labeled_edges():
    md = dedent("""\
    ```items
    foundation :: Foundation:
      - t1 :: Parse graph
      - t2 :: Render graph
    t1 ->|feeds UI| t2
    ```
    """)

    html = to_xml(from_md(md))

    assert '"dependency_edges": [{"source": "t1", "target": "t2", "label": "feeds UI"}]' in html


def test_tasks_block_reads_frontmatter_id_and_color_palette():
    md = """```tasks
---
id: roadmap-demo
title: Roadmap
color_palette: phase
  Phase 1: "#2563eb"
  Phase 2: "#d97706"
---
foundation :: Foundation:
  - t1 :: Define graph payload | phase: Phase 1
```"""

    html = to_xml(from_md(md))

    assert '"graph_id": "roadmap-demo"' in html
    assert '"color_by": "phase"' in html
    assert '"color_palette": {"Phase 1": "#2563eb", "Phase 2": "#d97706"}' in html


def test_tasks_block_preserves_group_color_attributes():
    md = """```tasks
Foundation | color: "#8fa8d8":
  - t1 :: Define graph payload
```"""

    html = to_xml(from_md(md))

    assert '"id": "foundation"' in html
    assert '"color": "#8fa8d8"' in html


def test_tasks_block_reads_quoted_boolean_palette_keys():
    md = """```tasks
---
color_by:
  critical_path:
    "true": "#e53935"
    "false": "#9e9e9e"
---
Foundation:
  - t1 :: Define graph payload | critical_path: true
```"""

    html = to_xml(from_md(md))

    assert '"color_by": "critical_path"' in html
    assert '"critical_path": {"true": "#e53935", "false": "#9e9e9e"}' in html


def test_tasks_block_reads_default_color_by():
    md = """```tasks
---
default_color_by: sprint
color_by:
  sprint:
    One: "#2563eb"
---
Foundation:
  - t1 :: Define graph payload | sprint: One
```"""

    html = to_xml(from_md(md))

    assert '"default_color_by": "sprint"' in html


def test_tasks_block_reads_edge_color_palette_and_override():
    md = """```items
---
edge_color_palette: relation
  reads: "#2563eb"
  writes: "#dc2626"
---
System:
  - api :: API
  - db :: DB
api -> db | relation: reads
db -> api | relation: writes | color: "#7c3aed"
```"""

    html = to_xml(from_md(md))

    assert '"edge_color_by": "relation"' in html
    assert '"edge_color_palette": {"reads": "#2563eb", "writes": "#dc2626"}' in html
    assert '"relation": "reads"' in html
    assert '"color": "#7c3aed"' in html


def test_tasks_block_reads_filter_attributes():
    md = """```items
---
filter_attributes: [owner, status]
---
Foundation:
  - t1 :: Define graph payload | owner: Alice | status: Active | priority: High
```"""

    html = to_xml(from_md(md))

    assert '"filter_attributes": ["owner", "status"]' in html


def test_tasks_block_reads_filter_whitelist_and_blacklist():
    md = """```items
---
filter_whitelist: [owner, status]
filter_blacklist: [priority]
---
Foundation:
  - t1 :: Define graph payload | owner: Alice | status: Active | priority: High
```"""

    html = to_xml(from_md(md))

    assert '"filter_whitelist": ["owner", "status"]' in html
    assert '"filter_blacklist": ["priority"]' in html


def test_tasks_block_serializes_rendered_attr_html_for_node_card():
    md = dedent("""\
    ```items
    Foundation:
      - t1 :: Define graph payload | summary: "**Bold** line one\\n[Spec](guide#spec)"
    ```
    """)

    rendered = to_xml(from_md(md, current_path="docs/feed/personalization"))
    match = re.search(r"""data-tasks-payload=(["'])(.*?)\1""", rendered)

    assert match is not None
    payload = json.loads(html.unescape(match.group(2)))
    task = payload["tasks"][0]
    assert task["summary"] == "**Bold** line one\n[Spec](guide#spec)"
    assert "<strong>Bold</strong>" in task["__rendered_attrs__"]["summary"]
    assert "<br" in task["__rendered_attrs__"]["summary"]
    assert 'href="/posts/docs/feed/guide#spec"' in task["__rendered_attrs__"]["summary"]


def test_tasks_block_serializes_document_path_and_stable_storage_id():
    md = """```items
Foundation:
  - t1 :: Define graph payload
```"""

    html = to_xml(from_md(md, current_path="docs/feed/personalization"))

    assert '"document_path": "docs/feed/personalization"' in html
    assert '"storage_id": "tasks-block-' in html
