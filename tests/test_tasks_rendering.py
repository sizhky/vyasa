from fasthtml.common import to_xml
import html
import json
from pathlib import Path
import re
import subprocess
from textwrap import dedent

from vyasa.extensions_builtin.markdown.renderer import from_md
from vyasa.extensions_builtin.tasks.api import _compile_schema_payload


def test_tasks_block_renders_widget_payload_without_summary():
    md = """```tasks
title: Hybrid Task Rendering
foundation :: Foundation:
  - t1 :: Define graph payload
```"""

    html = to_xml(from_md(md))

    assert 'class="tasks-container' in html
    assert 'data-tasks-widget="true"' in html
    assert 'data-tasks-standalone="false"' in html
    assert 'contain: layout paint;' in html
    assert 'overscroll-behavior:contain' in html
    assert 'touch-action:none' in html
    assert 'display:flex;flex-direction:column;position:relative' in html
    assert '"graph_id": "hybrid-task-rendering-' in html
    assert '"label": "Foundation"' in html
    assert "1 groups, 1 items, 0 edges" not in html


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
    color_source = source.split("function tasksColorOptions", 1)[1].split("function tasksGroupByOptions", 1)[0]

    assert "tasksIsHiddenNodeMetaKey(key)" in filter_source
    assert "TASKS_DERIVED_METRIC_KEYS.has(normalized)" in source
    assert "TASKS_DERIVED_METRIC_KEYS" not in color_source


def test_tasks_filter_policy_empty_attributes_do_not_hide_all_keys():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks_graph_core.js").read_text()

    assert "Array.isArray(whitelistSource) && whitelistSource.length" in source


def test_tasks_groups_remain_selectable_when_expanded():
    core_source = Path("vyasa/extensions_builtin/tasks/static/tasks_graph_core.js").read_text()
    graph_source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()

    assert "if (kind === 'task') return true;" in core_source
    assert "if (kind === 'group') return true;" in core_source
    assert "if (kind === 'groupTitle') return true;" in core_source
    assert "if (kind === 'group') return 'selectable';" in core_source
    assert "const descendantIds = collectTasksGroupDescendantIds(nodeId, model);" in graph_source
    assert "const directEndpointIds = new Set([nodeId, ...descendantIds]);" in graph_source
    assert "for (const endpointId of Array.from(directEndpointIds))" in graph_source
    assert "const titleOpacity = isInUnspecifiedProjectionBranch(n) ? projectionUnspecifiedContentOpacity : 1;" in graph_source
    assert "addGroupWithDescendants(edge.target)" not in graph_source


def test_tasks_expanded_group_title_bar_selects_source_group():
    core_source = Path("vyasa/extensions_builtin/tasks/static/tasks_graph_core.js").read_text()
    graph_source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()

    assert "kind === 'groupTitle'" in core_source
    assert "if (kind === 'groupTitle') return 'control';" in core_source
    assert "selectable: isTasksGraphNodeSelectable('groupTitle')" in graph_source
    assert "const sourceNodeId = node.data?.__kind__ === 'groupTitle' ? node.data?.sourceGroupId : node.id;" in graph_source
    assert "const mode = directEndpointIds.has(sourceNodeId)" in graph_source


def test_tasks_group_group_edges_prefer_side_anchors_when_side_by_side():
    core_source = Path("vyasa/extensions_builtin/tasks/static/tasks_graph_core.js").read_text()

    assert "sourceKind === 'group' && targetKind === 'group'" in core_source
    assert "edgeAnchorSides(sourceRect, targetRect, nodesById[edge.source], nodesById[edge.target])" in core_source


def test_tasks_edge_anchors_use_standard_sides_until_both_are_congested():
    script = """
        import { buildTaskEdgeAnchors } from './vyasa/extensions_builtin/tasks/static/tasks_graph_core.js';
        const cases = [
            ['far vertical overlap', { x: 209, y: -1163 }, { x: 12, y: 168 }, 'bottom', 'top'],
            ['far vertical gap', { x: 262, y: -1163 }, { x: 12, y: 168 }, 'bottom', 'top'],
            ['far horizontal', { x: 926, y: 45 }, { x: 12, y: 168 }, 'left', 'right'],
            ['far diagonal', { x: 1371, y: 2311 }, { x: -941, y: 210 }, 'left', 'right'],
            ['near vertical', { x: 145, y: -8 }, { x: 19, y: 164 }, 'bottom', 'top'],
            ['close diagonal', { x: 219, y: 11 }, { x: 12, y: 168 }, 'left', 'top'],
        ];
        for (const [name, source, target, sourceSide, targetSide] of cases) {
            const nodes = [
                { id: 'source', position: source, width: 220, height: 60 },
                { id: 'target', position: target, width: 220, height: 60 },
            ];
            const edge = buildTaskEdgeAnchors(nodes, [{ id: 'edge', source: 'source', target: 'target' }]).edges[0];
            if (!edge.sourceHandle.startsWith(`source-${sourceSide}-`)) throw new Error(`${name} source: ${edge.sourceHandle}`);
            if (!edge.targetHandle.startsWith(`target-${targetSide}-`)) throw new Error(`${name} target: ${edge.targetHandle}`);
        }
    """
    subprocess.run(["node", "--input-type=module", "-e", script], check=True)


def test_tasks_filter_panel_has_group_by_hierarchy_controls():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()

    assert "function tasksGroupByOptions" in source
    assert "TASKS_DERIVED_METRIC_KEYS" in source
    assert "['rank', 'connectivity']" in source
    assert "groupByHierarchy" in source
    assert "const groupByLevels = displayedGroupByHierarchy.filter(Boolean);" in source
    assert "if (customGroupingActive) groupByLevels.push('');" in source
    assert "model.active_projection === '__custom_group_by__'" in source
    assert "default_open_depth: -1" in source
    assert "Group by" in source
    assert "buildTasksGroupedState" in source


def test_tasks_filter_panel_uses_projection_dropdown_instead_of_tab_grid():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()

    assert "React.createElement('span', { style: { fontWeight: 700, opacity: 0.7 } }, 'View')" in source
    assert "value: viewMode === 'gantt' ? TASKS_GANTT_PROJECTION_ID : activeProjectionId" in source
    assert "projectionOptions.map((projection) => React.createElement('option'" in source
    assert "TASKS_ADD_VIEW_OPTION_ID" in source
    assert "onPaste: handleDefaultViewPaste" in source
    assert "target.addEventListener('paste', handleDefaultViewPaste, true)" in source
    assert "saveTasksTempView" in source
    assert "const ProjectionToggle = () =>" not in source


def test_tasks_node_detail_rows_always_stack_values_below_labels():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()
    css = Path("vyasa/extensions_builtin/tasks/static/tasks.css").read_text()

    assert "`${entry.label}:`" in source
    assert "fontSize: options.fontSize || '14px'" in source
    # The label is its own block, so the value stacks under it. That is the
    # contract; the margin that happens to sit beside it today is not.
    label_row = source.split("`${entry.label}:`", 1)[0][-300:]
    assert "display: 'block'" in label_row
    assert "return Math.max(keyWidth, valueWidth * weight);" in source
    assert "overflowWrap: 'anywhere'" in source
    assert "whiteSpace: 'pre-line'" in source
    assert "tasksIsLongFormEntry" not in source
    assert ".vyasa-task-node-card-value > p:first-child { display: inline; }" not in css
    assert ".vyasa-task-node-card-value { display: block; min-width: 0; max-width: 100%; white-space: normal; }" in css
    assert ".vyasa-task-node-card-value :where(p, h1, h2, h3, h4, h5, h6, ul, ol, li, blockquote) { font-size: inherit !important; line-height: inherit !important; color: inherit !important; }" in css
    assert ".vyasa-task-node-card-value > * + * { margin-top: 0.45em !important; }" in css
    assert "#main-content .vyasa-task-node-card-value .uk-list > li + li { margin-top: 0.15em !important; }" in css
    assert ".vyasa-task-node-card-value li > p { margin: 0 !important; }" in css
    assert ".vyasa-task-node-card-value pre { display: block; max-width: 100%; overflow-x: auto; white-space: pre; }" in css


def test_tasks_node_metadata_hides_internal_keys():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()

    assert "const TASKS_INTERNAL_NODE_META_KEYS" in source
    assert "'__projection_group__', 'projection', '__kg_sources'" in source
    assert "'__projection_branch_opacity__'" in source
    assert "'child_group_ids'" in source
    assert "function tasksIsHiddenNodeMetaKey" in source
    assert ".filter(([key, value]) => !tasksIsHiddenNodeMetaKey(key)" in source


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


def test_tasks_block_reads_filter_panel_width_option():
    md = """```tasks
---
title: Filter Panel Width
filter-panel-width: 22%
---
foundation :: Foundation:
```"""

    html = to_xml(from_md(md))

    assert 'data-tasks-filter-panel-width="22%"' in html


def test_tasks_side_panels_default_to_the_same_share_of_the_width():
    """Both panels default to the same share, and both stay overridable."""
    md = """```tasks
---
title: Defaults
---
foundation :: Foundation:
```"""

    html = to_xml(from_md(md))

    assert 'data-tasks-node-card-width="20%"' in html
    assert 'data-tasks-filter-panel-width="20%"' in html


def test_tasks_block_reads_node_card_content_scale_option():
    md = """```tasks
---
title: Card Content Scale
node-card-content-scale: 3.5
---
foundation :: Foundation:
```"""

    html = to_xml(from_md(md))

    assert 'data-tasks-node-card-content-scale="3.5"' in html


def test_card_body_is_drawn_wider_than_the_card_and_pans_sideways():
    """A narrow card holds wide content by scrolling across it.

    The body is drawn at contentScale card widths, and the wheel hijack pans
    it whenever the gesture leans horizontal. A scale of 1 drops the extra
    width, but the body still scrolls when a child cannot wrap.
    """
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()

    assert "const TASKS_NODE_CARD_CONTENT_SCALE = 1;" in source
    assert "overflowX: 'auto'," in source
    assert "width: `${(options.contentScale || 1) * 100}%`" in source
    assert "Math.abs(event.deltaX) > Math.abs(event.deltaY)" in source
    assert "scrollCard.scrollLeft = Math.max(0, Math.min(maxScrollLeft," in source


def test_tasks_block_defaults_to_95vw_width():
    html = to_xml(from_md("""```tasks
foundation :: Foundation:
```"""))

    assert 'style="width: 95vw; position: relative;' in html


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


def test_tasks_fullscreen_keeps_the_existing_widget_configuration():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()
    modal_source = Path("vyasa/extensions_builtin/tasks/static/tasks_fullscreen.js").read_text()

    assert "wrapper.dataset.tasksOpenFiltersDefault" in source
    assert "wrapper.dataset.tasksProjectionGroupOpacity" in source
    assert "wrapper.dataset.tasksHoverFontSize" in source
    assert "wrapper.setAttribute('data-tasks-maximized', 'true');" in modal_source
    assert "document.createElement('div')" not in modal_source


def test_tasks_source_lazy_loads_react_flow_only_when_widgets_exist():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()

    assert "const wrappers = Array.from(rootElement.querySelectorAll('.tasks-container[data-tasks-widget=\"true\"]'));" in source
    assert "if (!wrappers.length) return;" in source
    assert "const rf = await ensureTasksReactFlow();" in source
    assert "function ensureTasksQueryBuilder()" in source
    react_flow_loader = source[source.index("function ensureTasksReactFlow()"):source.index("function ensureTasksQueryBuilder()")]
    assert "react-querybuilder" not in react_flow_loader


def test_tasks_perf_logging_traces_root_and_interaction_costs():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()
    api_source = Path("vyasa/extensions_builtin/tasks/api.py").read_text()

    assert "new URLSearchParams(window.location.search).has('tasks_perf')" in source
    assert "[vyasa][tasks-perf]" in source
    assert "fetch('/api/tasks/perf-log'" in source
    assert "label !== 'frame-probe' && label !== 'longtask' && label !== 'render-context'" in source
    assert "reset: !window.__vyasaTasksPerf.fileLogReset.has(key)" in source
    assert "logTasksPerf('frame-probe'" in source
    assert "logTasksPerf('longtask'" in source
    assert "logTasksPerf('render-context'" in source
    assert "document.getAnimations" in source
    assert "fixedSticky" in source
    assert "const flowWrapperStyle = {" in source
    assert "contain: 'layout paint'" in source
    assert "touchAction: 'none'" in source
    assert "markTasksFrameProbe(widgetId, wrapper, model, graphBase, 'pointermove')" in source
    assert '"/api/tasks/perf-log"' in api_source
    assert "vyasa-tasks-perf-" in api_source
    assert 'Path("/tmp")' in api_source
    assert '.tasks-container[data-tasks-widget="true"] .react-flow__viewport' in source
    assert "will-change: transform" in source


def test_tasks_query_builder_assets_stay_extension_local_and_lazy():
    init_source = Path("vyasa/extensions_builtin/tasks/__init__.py").read_text()
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()
    package_source = Path("tasks-ui/package.json").read_text()

    assert 'css=("/static/extensions/tasks/tasks.css",)' in init_source
    assert "react-querybuilder" not in package_source
    assert "/static/extensions/tasks/vendor/react-querybuilder.css" in source
    assert "/static/extensions/tasks/vendor/react-querybuilder.global.js" in source
    assert "ensureTasksQueryBuilder()" in source
    assert Path("vyasa/extensions_builtin/tasks/static/vendor/react-querybuilder.LICENSE.md").exists()


def test_tasks_query_builder_can_be_disabled_per_projection():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()

    assert "queryBuilderEnabled" in source
    assert "const effectiveFilters = React.useMemo" in source
    assert "queryBuilderEnabled ? activeFilters : tasksEmptyFilterQuery()" in source
    assert "if (egoMode || filtersCollapsed || !queryBuilderEnabled) return;" in source
    assert "filterQuery: isActiveLive ? activeFilters : (def?.filter_query || {})" in source
    assert "React.createElement('span', { style: { fontWeight: 700, opacity: 0.76 } }, 'Query builder')" in source


def test_tasks_search_can_be_disabled_per_projection():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()

    assert "searchEnabled" in source
    assert "searchEnabled ? searchQuery : ''" in source
    # The control is labelled inside the filter panel. Its font weight is not a
    # contract; its presence there is.
    panel_source = source.split("const FilterPanel = () => {", 1)[1].split("const SlideShow = () => {", 1)[0]
    assert "'Search')" in panel_source


def test_tasks_query_builder_controls_use_filter_panel_css():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()
    css = Path("vyasa/extensions_builtin/tasks/static/tasks.css").read_text()

    assert "const TASKS_FILTER_PANEL_WIDTH = '20%';" in source
    assert "muteGroupAction: null" in source
    assert "React.createElement('span', null, 'Active')" in source
    assert ".vyasa-tasks-filter-card .betweenRules" in css
    assert ".vyasa-tasks-filter-card .ruleGroup-notToggle" in css
    assert ".vyasa-tasks-filter-card .ruleGroup-mute" in css
    assert ".vyasa-tasks-filter-card .rule-mute" in css
    assert ".vyasa-tasks-filter-card .ruleGroup .ruleGroup" in css
    assert "border-left: 3px solid color-mix(in srgb, var(--vyasa-primary) 50%, currentColor 12%)" in css
    assert "margin-left: 14px" in css
    assert ".vyasa-tasks-filter-card input[type=\"checkbox\"]" in css
    assert "appearance: none;" in css


def test_tasks_source_retries_mount_after_swap_when_widget_size_is_zero():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()

    assert "let needsRetry = false;" in source
    assert "needsRetry = true;" in source
    assert "window.requestAnimationFrame(() => { renderTasksGraphs(rootElement); });" in source


def test_tasks_source_uses_projection_scoped_prefs():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()

    assert "function readTasksProjectionPrefs" in source
    assert "projectionPrefs" in source
    assert "if (saved && validColorKeys.has(saved)) return saved;" in source
    assert "buildTasksViewState" in source


def test_tasks_source_persists_checked_nodes_per_graph():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()

    assert "function normalizeTasksCheckedNodeIds" in source
    assert "function tasksCheckedStateKey" in source
    assert "document_path" in source
    assert "title || graphId" in source
    assert "writeTasksCheckedNodeIds(sourceModel, checkedNodeIdsFromStates(nodeStates));" in source
    assert "checkedNodeIds" in source
    assert "nodeStates" in source
    assert "toggleCheckedNode(logicalNodeId)" in source
    assert "const lastGraphRevisionCauseRef = React.useRef('layout');" in source
    assert "const revisionCause = lastLayoutRevisionKeyRef.current === revisionKey ? 'visual' : 'layout';" in source
    assert "if (lastGraphRevisionCauseRef.current === 'visual') return;" in source


def test_tasks_source_renders_hover_checkbox_and_done_badge():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()

    assert "type: 'checkbox'" in source
    # showCheckbox is derived from data.highlightMode (selected/selected-focus/
    # neighbor-focus) plus a __hover_checkbox__ flag for the no-single-selection
    # hover case. This keeps nodeTypes stable so React Flow does not remount nodes
    # on every hover (which was swallowing clicks).
    assert "const showCheckbox = highlightMode === 'selected'" in source
    assert "data?.__hover_checkbox__ === true" in source
    assert "const hoverCheckboxId = !nodeId && hoveredNodeId ? hoveredNodeId : null;" in source
    assert "if (!selectedNodeId) {" in source
    assert "setHoveredNodeId((current) => current === sourceNodeId ? current : sourceNodeId);" in source
    assert "const doneBadge = isChecked ?" in source
    assert "taskStateLabel" in source


def test_tasks_source_keeps_hover_highlight_while_panning():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()

    assert "clearGraphHoverState('pointer-dragging')" not in source


def test_tasks_graph_highlights_use_separate_border_layer():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()
    css_source = Path("vyasa/extensions_builtin/tasks/static/tasks.css").read_text()

    assert "'data-vyasa-highlight-active': !['none', 'dim'].includes(highlightMode)" in source
    assert "'data-vyasa-hover-outline': data?.__hover_outline__ === true ? 'true' : undefined" in source
    assert "const TasksNodeHighlightBorders = () =>" in source
    assert "React.createElement(rf.ViewportPortal" in source
    assert "'data-vyasa-node-highlight-border': 'true'" in source
    assert "zIndex: TASKS_EDGE_FOCUS_Z - 1" in source
    assert "outline: `${hoverOutline ? 12 : 4}px solid ${activeBorderColor}`" in source
    assert (
        '.vyasa-tasks-active-pulse .react-flow__node:not(.vyasa-tasks-pulse):has([data-vyasa-highlight-active="true"]) {\n'
        "    box-shadow: none !important;\n"
        "}"
    ) in css_source
    assert "outline: 4px solid var(--vyasa-tasks-active-border" not in css_source
    assert "outline: 12px solid var(--vyasa-tasks-active-border" not in css_source
    assert "if (hoveredNodeId) hoverOutlineIds.add(nodeId);" in source
    assert "'--vyasa-tasks-active-border'" in source


def test_tasks_source_supports_configurable_card_states():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()

    assert "TASKS_DEFAULT_CARD_STATES = ['Not Done', 'Done']" in source
    assert "function normalizeTasksCardStates" in source
    assert "nodeStates" in source
    assert "TASKS_CARD_STATE_ATTR" in source
    assert "String(model?.card_states || '').split(',')" in source
    assert "TASKS_SPECIAL_NODE_ATTRS" in source


def test_tasks_block_reads_comma_card_states_from_render_frontmatter():
    md = """```items
---
card_states: not-done,done,deferred,cancelled
---
Foundation:
  - t1 :: Define graph payload
```"""

    rendered = to_xml(from_md(md))
    match = re.search(r"""data-tasks-payload=(["'])(.*?)\1""", rendered)

    assert match is not None
    payload = json.loads(html.unescape(match.group(2)))
    assert payload["card_states"] == ["not-done", "done", "deferred", "cancelled"]


def test_tasks_source_supports_local_card_notes():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()

    assert "function normalizeTasksNodeNotes" in source
    assert "function tasksNoteEditorMetrics" in source
    assert "nodeNotes" in source
    assert "const noteTextareaRef = React.useRef(null);" in source
    assert "setNoteInputValue(event.target.value)" in source
    assert "event.currentTarget.blur();" in source
    assert "textarea.style.height = 'auto';" in source
    assert "textarea.scrollHeight > maxHeight ? 'auto' : 'hidden'" in source
    assert "updateNodeNote(selectedLogicalNodeId, noteInputValue)" in source
    assert "placeholder: 'Notes'" in source
    assert "SelectedNodePanel()" in source
    assert "__has_note__" in source
    assert "title: 'Has note'" in source
    assert "kinds: ['note']" in source
    assert "TASKS_HAS_NOTE_PALETTE = { yes: '#22c55e', no: 'rgba(220, 38, 38, 0.28)' }" in source
    assert "tasksHasAnyNodeNote(nodeNotes)" in source


def test_tasks_node_and_edge_cards_share_note_access_and_rendering():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()

    assert "function updateTasksNote(setNotes, id, note)" in source
    assert "function renderTasksCardNoteEditor(React, options = {})" in source
    assert "function renderTasksCardDetailsAndNotes(React, options = {})" in source
    assert "const [edgeNotes, setEdgeNotes] = React.useState" in source
    assert "updateTasksNote(setNodeNotes, nodeId, note)" in source
    assert "updateTasksNote(setEdgeNotes, edgeId, note)" in source
    assert source.count("renderTasksCardNoteEditor(React") == 3
    assert source.count("renderTasksCardDetailsAndNotes(React") == 3
    assert "GroupHoverTooltipCard" not in source
    assert "stickyGroupHoverTooltips" not in source
    assert source.count("options.scrollMode ? 'vyasa-tasks-pulse'") == 1
    assert "value: edgeNotes[selectedEdgeRecord.id] || ''" in source
    assert "edgeNotes," in source


def test_tasks_node_and_edge_cards_share_node_icon_rendering():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()
    edge_panel = source.split("const SelectedEdgePanel = () =>", 1)[1].split("const FilterPanel = () =>", 1)[0]

    assert "function renderTasksCardNodeIcon(React, node, model, options = {})" in source
    assert source.count("renderTasksCardNodeIcon(React") == 4
    assert "node?.__kind__ === 'group' || node?.__kind__ === 'groupTitle' ? 'folder' : 'file-text'" in source
    assert "color: edgeCardColor" in edge_panel
    assert "fontStyle: 'italic'" not in edge_panel
    assert "↓" not in edge_panel


def test_tasks_node_cards_share_the_configured_default_width():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()
    panel_source = source.split("const SelectedNodePanel = (", 1)[1].split("const SelectedEdgePanel = () =>", 1)[0]

    assert "const nodeNotesEditor = renderTasksCardNoteEditor(React" in panel_source
    # One setting sizes every card: the absolute wrapper carries nodeCardWidth
    # and the cards inside fill it. Re-applying the width inside would compound
    # once the value became a percentage.
    assert "width: nodeCardWidth" in source
    assert "min(${nodeCardWidth}" not in source
    assert "width: '100%'" in panel_source
    assert "tasksDetailPanelWidth" not in panel_source


def test_tasks_hover_card_reuses_selected_node_panel_on_right_side():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()

    assert "const TASKS_HOVER_CARD_MODES = ['off', 'rightRail']" in source
    assert "const SelectedNodePanel = (panelGraphNodeId = selectedNodeId, readOnly = false, hoverCard = null)" in source
    assert "SelectedNodePanel(groupHoverTooltip.nodeId, true, groupHoverTooltip)" in source
    assert "scrollRef: hoverCard ? hoverCardScrollRef : detailCardScrollRef" in source
    assert "tasksActiveHoverAttrs" not in source
    assert "tasksHoverAttrRows" not in source
    assert "tasksGroupHoverAttrRows" not in source
    assert "hoverAttrs:" in source
    assert source.count("GroupHoverTooltip(),") == 2
    assert "row('C', 'hover cards: off / right side')" in source


def test_tasks_node_and_edge_cards_keep_notes_below_scrolling_details():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()
    layout = source.split("function renderTasksCardDetailsAndNotes", 1)[1].split("function renderTasksDetailEntries", 1)[0]
    node_panel = source.split("const SelectedNodePanel = (", 1)[1].split("const SelectedEdgePanel = () =>", 1)[0]
    edge_panel = source.split("const SelectedEdgePanel = () =>", 1)[1].split("const FilterPanel = () =>", 1)[0]

    assert layout.index("ref: options.scrollRef") < layout.index("data-vyasa-card-notes")
    # The details region scrolls; the notes footer does not. Assert that pair,
    # not one spelling of the style object it is written in.
    assert "flex: '1 1 auto'" in layout
    assert "overflowY: 'auto'" in layout
    assert "flex: '0 0 auto'" in layout, "the notes footer must not scroll with the details"
    assert "data-vyasa-card-notes" in layout
    assert "font = '500 14px ui-sans-serif" in source
    assert "renderTasksCardDetailsAndNotes(React" in node_panel
    assert "renderTasksCardDetailsAndNotes(React" in edge_panel


def test_enter_selects_hovered_node_and_focuses_the_pinned_card():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()

    assert "key !== 'enter' || !current" in source
    assert "selectNodeCard(current.nodeId, current.nodeId, current.group ? 'group' : 'task', true)" in source
    assert "if (focusCard) focusDetailCard();" in source
    assert "window.requestAnimationFrame(() => detailCardRef.current?.focus())" in source
    assert "className: readOnly ? undefined : 'vyasa-tasks-pinned-card'" in source
    assert "row('Enter', 'pin hovered node / open selected edge')" in source
    assert "row('Enter on card', 'focus Notes')" in source
    shortcut = source.split("const clearGroupHoverTooltip", 1)[1].split("const hoverTraceKeyRef", 1)[0]
    assert "event.key === 'Control'" not in shortcut


def test_escape_in_card_notes_returns_focus_to_the_pinned_card():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()
    hotkeys = source.split("const FitViewHotkey = () =>", 1)[1].split("const SelectedNodePanel = (", 1)[0]

    notes_escape = "event.key === 'Escape' && target?.closest?.('[data-vyasa-card-notes]')"
    assert notes_escape in hotkeys
    assert hotkeys.index(notes_escape) < hotkeys.index("event.key === 'Escape' && !event.shiftKey && widgetFocused")
    escape_branch = hotkeys.split(notes_escape, 1)[1].split("return;", 1)[0]
    assert "event.stopImmediatePropagation();" in escape_branch
    assert "focusDetailCard();" in escape_branch
    assert "target.blur" not in escape_branch
    assert "releaseCardPin" not in escape_branch


def test_pinned_card_enter_focuses_notes_and_shift_enter_navigates():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()
    textarea = source.split("function renderTasksNoteTextarea", 1)[1].split("function renderTasksCardNoteEditor", 1)[0]

    assert "options.onShiftEnter" not in textarea
    assert "const handlePinnedCardKeyDown" in source
    assert "event.target !== event.currentTarget || event.key !== 'Enter'" in source
    assert "if (event.shiftKey) navigate(); else notesRef.current?.focus();" in source
    assert "handlePinnedCardKeyDown(event, noteTextareaRef, () => focusGraphNode(panelGraphNodeId))" in source
    assert "handlePinnedCardKeyDown(event, edgeNoteTextareaRef, () => fitSelectedEdgeConnection(reactFlowApiRef.current))" in source
    assert "if (target?.matches?.('.vyasa-tasks-pinned-card')) return;" in source
    assert "row('Shift + Enter', 'center pinned node or fit pinned edge')" in source


def test_tasks_node_card_attr_values_can_be_copied_from_hover_button():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()
    css_source = Path("vyasa/extensions_builtin/tasks/static/tasks.css").read_text()

    assert "function renderTasksDetailEntries(React, entries, options = {})" in source
    assert "const canCopy = options.copyValues && String(entry?.value ?? '').trim();" in source
    assert "await copyTasksText(entry.value);" in source
    assert "className: 'vyasa-task-node-card-copy'" in source
    assert "renderTasksDetailEntries(React, entries, { copyValues: true, currentPath: sourceModel?.document_path || '' })" in source
    assert ".vyasa-task-node-card-row:hover .vyasa-task-node-card-copy" in css_source
    assert "pointer-events: none;" in css_source


def test_tasks_selected_panel_renders_title_and_href_links():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()

    assert "const panelLinkKinds = Array.from(tasksNodeLinkKinds(selectedNode));" in source
    assert "const panelHref = String(selectedNode?.href || '').trim();" in source
    assert "renderTasksNodeLinkBadge(React, { kinds: panelLinkKinds, right: '0', top: '0' })" in source
    assert "onClick: (event) => openTasksNodeHref(panelHref, event)" in source
    assert "renderTasksInlineLinks(selectedNode.label || selectedNode.id" in source
    assert "tasksInlineLinkPlainText(title)" in source
    assert "React.createElement('a', {" not in source.split("const labelContent = renderTasksInlineLinks(data?.label || id", 1)[1].split("const checkboxControl =", 1)[0]
    assert "cursor: hasHref ? 'pointer' : undefined" not in source
    assert "function tasksHrefDetailEntry(href)" not in source


def test_tasks_selected_panel_shows_open_decision_for_open_items():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()

    assert "function tasksOpenDecisionEntry(node)" in source
    assert "node?.__checked__ === true" in source
    assert "const raw = node?.open_decision ?? node?.decision ?? '';" in source
    assert "if (!value) return null;" in source
    assert "const entries = openDecisionEntry ? [openDecisionEntry, ...baseEntries] : baseEntries;" in source


def test_tasks_source_logs_node_href_navigation_flow():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()

    assert "function escapeTasksHtml(value)" in source
    assert "logTasksDebug('nodeHrefOpen:start'" in source
    assert "logTasksDebug('nodeHrefOpen:htmxRequest'" in source
    assert "logTasksDebug('nodeHrefOpen:htmxSwap'" in source
    assert "logTasksDebug('htmx:beforeRequest'" in source
    assert "logTasksDebug('htmx:responseError'" in source
    assert "logTasksDebug('shortcutKeydown'" in source
    assert "logTasksDebug('selectionClear'" in source
    assert "logTasksDebug('selectionStateCommit'" in source
    assert "logTasksDebug('selectionSetNode'" in source
    assert "logTasksDebug('openEgoAction'" in source


def test_tasks_source_uses_base_view_label_for_default_projection_tab():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()

    assert "const baseViewLabel = String(model?.base_view_label || '').trim() || 'Default';" in source
    assert "{ id: '', label: baseViewLabel, caption: '' }" in source


def test_tasks_source_uses_reset_button_label():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()

    assert "function tasksProjectionSchemaPrefs(model, projectionId)" in source
    assert "prefs.colorBy = projection.default_color_by" in source
    assert "prefs.secondaryColorBy = projection.default_secondary_color_by" in source
    assert "const resetProjectionControls = React.useCallback(() => {" in source
    assert "setActiveFilters(normalizeTasksFilterQuery(defaults.filters))" in source
    assert "setQueryBuilderEnabled(typeof defaults.queryBuilderEnabled === 'boolean'" in source
    assert "setSearchInputValue(defaultSearch)" in source
    assert "setActiveColorHierarchy(resolveTasksPreferredColorHierarchy(model, activeProjectionId, defaults, nodeNotes))" in source
    assert "setEdgesVisible(typeof defaults.edgesVisible === 'boolean'" in source
    assert "onClick: resetProjectionControls" in source


def test_tasks_hover_card_toggle_matches_edge_toggle_contract():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()
    shortcut = source.split("if (key === 'c') {", 1)[1].split("}", 1)[0]
    actions = source.split("toggleFilters: () => setFiltersCollapsedGuarded", 1)[1].split("toggleHelp:", 1)[0]

    assert "setHoverCardModeGlobal(nextTasksHoverCardMode);" in shortcut
    assert "setHoverCardModeGlobal((current) => (" in actions
    assert "if (!hoverCardsEnabled) return null;" in source
    assert "refreshHoverCardRef" not in source
    assert "&& key !== 'c'" not in source


def test_w_edge_q_temporarily_shows_other_node_card():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()

    assert "optionEdgeOtherNodeIdRef.current = edge.source === nodeId ? edge.target : edge.source;" in source
    assert "event.code === 'KeyW'" in source
    assert "const currentGraphEdges = React.useCallback" in source
    assert "event.code === 'KeyQ'" in source
    assert "setOptionEdgeNodeCardId(optionEdgeOtherNodeIdRef.current);" in source
    assert "event.key === 'Enter' && optionEdgePreviewHeldRef.current" in source
    assert "optionEdgeNodeCardHeldRef.current ? optionEdgeOtherNodeIdRef.current : ''" in source
    assert "selectNodeCard(oppositeNodeId, oppositeNodeId, 'task', true)" in source
    assert "reason: 'w-q-enter'" in source
    assert "SelectedNodePanel(optionEdgeNodeCardId, true)" in source


def test_w_enter_pin_blooms_from_the_edge():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()
    css = Path("vyasa/extensions_builtin/tasks/static/tasks.css").read_text()

    assert "setEdgePinBloom({ edgeId: selectedEdgeIdRef.current, key: bloomKey });" in source
    assert "focusDetailCard();" in source
    assert "ref: detailCardRef" in source
    assert "ref: edgeNoteTextareaRef" in source
    assert "row('W + Enter', 'pin edge details')" in source
    assert "if (event.shiftKey) pinPreview();" not in source
    assert "edgePinBloom?.edgeId === tasksEdgeRecordId(edge)" in source
    assert "vyasa-tasks-edge-pin-bloom--late" not in source
    assert "@keyframes vyasa-tasks-edge-pin-bloom" in css
    assert "1720ms" in css


def test_kg_pane_drag_pans_with_a_locked_cursor():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()

    # A pane drag takes the cursor, then moves the viewport by raw pointer movement.
    assert "if (!event.target?.closest?.('.react-flow__pane')) return;" in source
    # The lock waits for real movement, so a plain click never hides the cursor.
    assert "if (pan.distance < 3) return;" in source
    assert "const request = el.requestPointerLock();" in source
    # A lock that lands after the drag ended gives the cursor straight back.
    assert "document.addEventListener('pointerlockchange', onPointerLockChange)" in source
    assert "else document.exitPointerLock?.();" in source
    assert "reactFlow.setViewport({ x: viewport.x + dx, y: viewport.y + dy, zoom: viewport.zoom }, { duration: 0 })" in source

    # Box select and lasso keep the plain drag.
    assert "if (event.shiftKey || event.metaKey || event.altKey) return;" in source

    # React Flow's own pan is the fallback when a browser refuses the lock,
    # so panOnDrag stays at its default.
    assert "panOnDrag" not in source

    # A locked pointer reports a frozen clientX, so hover work on it is skipped.
    assert "if (document.pointerLockElement) return;" in source

    # A locked pan must not clear the selection. A press that never locked keeps
    # its own native pane click.
    assert "if (!engaged) return;" in source
    assert "suppressNextGraphClickRef.current = true;" in source


def test_v_toggles_right_side_hover_card_scroll_mode():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()
    css = Path("vyasa/extensions_builtin/tasks/static/tasks.css").read_text()
    render_source = Path("vyasa/extensions_builtin/tasks/render.py").read_text()

    assert "'h', 'j', 'k', 'l', 'v'" in source
    assert "TASKS_HOVER_CARD_SCROLL_KEY = 'vyasa:tasks:hover-card-scroll'" in source
    assert "readTasksGlobalToggle(TASKS_HOVER_CARD_SCROLL_KEY) === 'true'" in source
    assert "writeTasksGlobalToggle(TASKS_HOVER_CARD_SCROLL_KEY, next)" in source
    assert "const scrollCard = hoverCardScrollRef.current || detailCardScrollRef.current;" in source
    assert "if (hoverCardScrollMode && scrollCard && maxScrollTop > 0)" in source
    assert "scrollCard.scrollTop = nextScrollTop" in source
    assert "function applyTasksCardOverscroll(card, unusedDelta)" in source
    assert "current.frame = window.requestAnimationFrame(step)" in source
    assert "body.style.transform = `scaleY(${stretch})`" in source
    assert "className: 'vyasa-tasks-card-scroll-body'" in source
    assert "scrollRef: hoverCard ? hoverCardScrollRef : detailCardScrollRef" in source
    assert "row('V', 'toggle hover card scroll mode')" in source
    assert "syncTasksCardScrollToggleButtons(widgetId, hoverCardScrollMode)" in source
    assert "toggleCardScroll: () => setHoverCardScrollModeGlobal" in source
    assert "button.setAttribute(attribute, 'true')" in source
    assert "button.toggleAttribute(attribute, emphasized)" not in source
    assert 'data-vyasa-card-scroll-on="true"' in css
    assert 'data-vyasa-tasks-action="toggleCardScroll"' in render_source
    assert "0%, 100%" in css
    assert "50%" in css
    assert "0 0 18px 8px color-mix(in srgb, var(--vyasa-primary) 68%, transparent)" in css
    assert ".vyasa-tasks-pulse" in css
    assert "vyasa-tasks-hover-card-scroll-pulse 4s cubic-bezier(0.37, 0, 0.63, 1)" in css
    assert "drop-shadow(" not in css.split("@keyframes vyasa-tasks-hover-card-scroll-pulse", 1)[1].split("}", 4)[0]
    assert "hoverCardRightRail" not in source


def test_tasks_kg_links_use_link_preview_contract():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()

    assert "'data-vyasa-link-preview': tasksHrefSupportsPreview(href) ? 'true' : undefined" in source
    assert "'data-vyasa-link-preview-current-path': currentPath || undefined" in source
    assert "renderTasksInlineLinks(selectedNode.label || selectedNode.id" in source
    assert "renderTasksDetailEntries(React, entries, { copyValues: true, currentPath: sourceModel?.document_path || '' })" in source


def test_tasks_filter_reset_button_stays_in_filter_card_header():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()
    panel_source = source.split("const FilterPanel = () => {", 1)[1].split("const SlideShow = () => {", 1)[0]

    assert "onClick: resetProjectionControls" in panel_source
    reset_index = panel_source.index("onClick: resetProjectionControls")
    assert panel_source.index("activeCount ? `Filters (${activeCount})` : 'Filters'") < reset_index
    assert reset_index < panel_source.index("'×'", reset_index)
    assert reset_index < panel_source.index("'Intensity'")


def test_tasks_projection_switch_preserves_filter_drawer_when_view_has_no_saved_state():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()

    assert "setFiltersCollapsed((current) => (" in source
    assert "typeof nextPrefs?.filtersCollapsed === 'boolean'\n                        ? nextPrefs.filtersCollapsed\n                        : current" in source


def test_named_views_keep_grouping_overrides_in_projection_preferences():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()
    group_panel = source.split("React.createElement('span', { style: filterKeyStyle }, 'Group by')", 1)[1].split("React.createElement('span', { style: filterKeyStyle }, 'Notes')", 1)[0]
    reset = source.split("const resetProjectionControls = React.useCallback(() => {", 1)[1].split("React.useEffect(() => {", 1)[0]
    prefs_key = source.split("function tasksPrefsKey(model) {", 1)[1].split("function tasksCheckedStateKey", 1)[0]

    assert "groupByHierarchy: schemaGroupByHierarchy," in source
    assert "...(groupingOverridden ? { groupByEnabled, groupByHierarchy, groupByDisabledKeys } : {})" in source
    assert "groupByEnabled," in source
    assert "groupByDisabledKeys," in source
    assert "buildTasksViewState(viewerState.model, viewerState.graph, activeProjectionId, viewMode, groupByEnabled, activeGroupByHierarchy, initialEgoMode)" in source
    # Custom grouping is off wherever the view places its own nodes: Gantt, and
    # every fixed layout. Assert that contract, not one spelling of the line.
    assert "const customGroupingAvailable = !tasksIsFixedMode(viewMode);" in source
    assert "Custom grouping applies to Default view." not in source
    assert "setActiveProjectionId('');" not in group_panel
    assert "setGroupByEnabled(defaults.groupByEnabled === true);" in reset
    assert "setGroupByHierarchy(Array.isArray(defaults.groupByHierarchy) ? defaults.groupByHierarchy : []);" in reset
    assert "kg_context" not in prefs_key


def test_tasks_without_next_group_are_laid_out_before_child_groups():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()
    collapsed = source.split("function buildTasksCollapsedGraph", 1)[1].split("function buildTasksGroupedState", 1)[0]
    nested = source.split("async function layoutGroupInternal", 1)[1].split("async function layoutExpandedGroups", 1)[0]

    assert collapsed.index("for (const task of model.tasks") < collapsed.index("order.forEach((groupId")
    assert nested.index("...(model.task_children?.[groupId]") < nested.index("...(model.group_tree?.[groupId]")
    assert "packTaskChildRects(positions" in nested
    assert "logTasksDebugVerbose('groupPacking'" in nested


def test_tasks_child_rect_packing_preserves_order_and_removes_empty_space():
    script = """
        import { packTaskChildRects } from './vyasa/extensions_builtin/tasks/static/tasks_graph_core.js';
        const result = packTaskChildRects({
            a: { x: 20, y: 30, width: 100, height: 50 },
            b: { x: 520, y: 30, width: 100, height: 50 },
            c: { x: 20, y: 330, width: 100, height: 50 },
            d: { x: 520, y: 330, width: 100, height: 50 },
        }, { gap: 20, padX: 10, padTop: 30, padBottom: 10 });
        const expected = {
            a: { x: 10, y: 30 }, b: { x: 130, y: 30 },
            c: { x: 10, y: 100 }, d: { x: 130, y: 100 },
        };
        for (const [id, position] of Object.entries(expected)) {
            if (result.positions[id].x !== position.x || result.positions[id].y !== position.y) {
                throw new Error(`${id} moved to ${JSON.stringify(result.positions[id])}`);
            }
        }
        if (result.bbox.width !== 240 || result.bbox.height !== 160) {
            throw new Error(`wrong bbox: ${JSON.stringify(result.bbox)}`);
        }
    """
    subprocess.run(["node", "--input-type=module", "-e", script], check=True)


def test_tasks_child_rect_packing_keeps_siblings_separate():
    script = """
        import { packTaskChildRects } from './vyasa/extensions_builtin/tasks/static/tasks_graph_core.js';
        const result = packTaskChildRects({
            large: { x: 800, y: 600, width: 900, height: 700 },
            small: { x: 40, y: 30, width: 220, height: 60 },
            tall: { x: 1800, y: 100, width: 250, height: 500 },
        }, { gap: 24, padX: 40, padTop: 80, padBottom: 40 });
        const rects = Object.values(result.positions);
        for (let index = 0; index < rects.length; index += 1) {
            for (const other of rects.slice(index + 1)) {
                const overlapX = Math.min(rects[index].x + rects[index].width, other.x + other.width)
                    - Math.max(rects[index].x, other.x);
                const overlapY = Math.min(rects[index].y + rects[index].height, other.y + other.height)
                    - Math.max(rects[index].y, other.y);
                if (overlapX > -24 && overlapY > -24) throw new Error('siblings overlap');
            }
        }
        if (result.bbox.width * result.bbox.height >= 2000000) {
            throw new Error(`empty space remained: ${JSON.stringify(result.bbox)}`);
        }
    """
    subprocess.run(["node", "--input-type=module", "-e", script], check=True)


def test_tasks_child_rect_packing_reflows_horizontal_rows_toward_square():
    script = """
        import { packTaskChildRects } from './vyasa/extensions_builtin/tasks/static/tasks_graph_core.js';
        const positions = Object.fromEntries(Array.from({ length: 7 }, (_, index) => [
            `n${index}`, { x: index * 500, y: 20, width: 220, height: 60 },
        ]));
        const result = packTaskChildRects(
            positions,
            { gap: 20, padX: 20, padTop: 40, padBottom: 20, targetAspectRatio: 1.05 }
        );
        const aspect = result.bbox.width / result.bbox.height;
        if (result.rows.length < 2 || result.rows.length > 4) {
            throw new Error(`horizontal row survived: ${JSON.stringify(result.rows)}`);
        }
        if (aspect < 0.7 || aspect > 1.5) {
            throw new Error(`packing is not square enough: ${aspect}`);
        }
        const rowLengths = result.rows.map((row) => row.length);
        if (Math.max(...rowLengths) - Math.min(...rowLengths) > 1) {
            throw new Error(`last row is not balanced: ${rowLengths}`);
        }
        const lastRowId = result.rows[result.rows.length - 1][0];
        if (result.positions[lastRowId].x <= 20) {
            throw new Error('short final row was not centered');
        }
    """
    subprocess.run(["node", "--input-type=module", "-e", script], check=True)


def test_view_regrouping_collapses_projected_copies_to_source_nodes():
    script = """
        import { tasksUngroupModelForGrouping } from './vyasa/extensions_builtin/tasks/static/tasks_graph_core.js';
        const model = tasksUngroupModelForGrouping({
            tasks: [
                { id: 'a__one', __source_node_id: 'a', group_id: 'g1' },
                { id: 'a__two', __source_node_id: 'a', group_id: 'g2' },
                { id: 'b', __source_node_id: 'b', group_id: 'g1' },
            ],
            dependency_edges: [
                { id: 'e__one', __source_edge_id: 'e', source: 'a__one', target: 'b' },
                { id: 'e__two', __source_edge_id: 'e', source: 'a__two', target: 'b' },
            ],
        });
        if (model.tasks.map((task) => task.id).join(',') !== 'a,b') throw new Error('projected node copies survived');
        if (model.tasks.some((task) => task.group_id !== null)) throw new Error('schema groups survived');
        if (model.dependency_edges.length !== 1) throw new Error('projected edge copies survived');
        if (model.dependency_edges[0].source !== 'a' || model.dependency_edges[0].target !== 'b') throw new Error('edge endpoints were not restored');
    """
    subprocess.run(["node", "--input-type=module", "-e", script], check=True)


def test_tasks_color_swatch_filter_is_independent_and_ands_with_query_filter():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()
    callback = source.split("const toggleFilterValue = React.useCallback", 1)[1].split("}, []);", 1)[0]

    assert "setActiveSwatchFilters((current) => toggleTasksFilterQueryValue(current, key, value, enabled))" in callback
    assert "setQueryBuilderEnabled(true)" not in callback
    assert "function tasksNodeMatchesAllFilters(node, queryFilters, swatchFilters)" in source
    assert "tasksNodeMatchesFilters(node, queryFilters) && tasksNodeMatchesFilters(node, swatchFilters)" in source
    assert "tasksFilterQuerySelectedValues(activeSwatchFilters, colorBy)" in source
    assert "swatchFilters: activeSwatchFilters" in source
    assert "setActiveSwatchFilters(tasksEmptyFilterQuery())" in source
    assert "query: normalizeTasksFilterQuery(activeFilters)" in source
    assert "onQueryChange: (query) => setActiveFilters(normalizeTasksFilterQuery(query))" in source
    assert "const activeSwatchKeys = new Set(activeColorHierarchy.filter(Boolean))" in source
    assert "tasksPruneFilterQueryFields(current, activeSwatchKeys)" in source


def test_tasks_color_picker_uses_cascading_level_dropdowns():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()

    # Color levels mirror group-by: one <select> per level, each picked value adds the next slot.
    assert "const renderColorLevel = (colorBy, index) => {" in source
    assert "onChange: (event) => setActiveColorLevel(index, event.target.value)" in source
    assert "index === 0 ? 'Color by' : `Color ${index + 1}`" in source
    assert "if (activeColorHierarchy.length && remainingColorOptions.length) colorLevelSlots.push('')" in source
    assert "...colorLevelSlots.map((colorBy, index) => renderColorLevel(colorBy, index))" in source


def test_tasks_hierarchy_controls_are_drag_reorderable():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()

    assert "const reorderTasksHierarchyLevel = React.useCallback((items, fromIndex, toIndex) => {" in source
    assert "const reorderActiveColorLevel = React.useCallback((fromIndex, toIndex) => {" in source
    assert "const reorderGroupByLevel = React.useCallback((fromIndex, toIndex) => {" in source
    assert "event.dataTransfer.setData('text/x-vyasa-color-level', String(index));" in source
    assert "reorderActiveColorLevel(from, index);" in source
    assert "event.dataTransfer.setData('text/x-vyasa-group-level', String(level));" in source
    assert "reorderGroupByLevel(from, level);" in source
    assert "'aria-label': 'Drag to reorder color level'" in source
    assert "'aria-label': 'Drag to reorder group level'" in source


def test_tasks_color_picker_groups_special_modes_at_bottom():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()

    assert "const TASKS_SPECIAL_COLOR_MODE_KEYS = new Set(['connectivity', 'rank']);" in source
    assert "function tasksIsSpecialColorMode(key)" in source
    assert "if (a.special !== b.special) return a.special ? 1 : -1;" in source
    assert "const normalColorOptions = selectableColorOptions.filter((option) => !option.special);" in source
    assert "const specialColorOptions = selectableColorOptions.filter((option) => option.special);" in source
    # A disabled separator divides the normal modes from the special ones.
    separator = source.split("value: '__special_color_modes__'", 1)[1][:200]
    assert "disabled: true" in separator
    assert "'---'" in separator
    assert "...specialColorOptions.map(renderColorOption))" in source
    assert "React.createElement('optgroup'" not in source


def test_tasks_query_builder_supports_inline_text_attrs_and_exists_operator():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()
    core = Path("vyasa/extensions_builtin/tasks/static/tasks_graph_core.js").read_text()

    assert "const TASKS_FILTER_TEXT_VALUE_LIMIT" in source
    assert "isText: !indexedKeys.has(key)" in source
    assert "{ name: 'notnull', label: 'attribute exists' }" in source
    assert "{ name: 'matchesRegex', label: 'regex matches' }" in source
    assert "props.operator === 'matchesRegex'" in source
    assert "function tasksNodeFilterAttributeExists(node, key)" in source
    assert "if (rule.operator === 'notnull') return tasksNodeFilterAttributeExists(node, rule.field)" in source
    assert "if (rule.operator === 'matchesRegex')" in source
    assert ": null;" in core


def test_tasks_filter_query_ignores_root_mute_but_keeps_rule_mute():
    script = """
        import { tasksCountFilterRules, tasksFilterQueryHasRules } from './vyasa/extensions_builtin/tasks/static/tasks_graph_model.js';
        const query = { combinator: 'and', muted: true, rules: [
            { field: 'measure', operator: 'notnull', value: '', muted: false },
            { field: 'status', operator: '=', value: 'todo', muted: true },
        ] };
        if (!tasksFilterQueryHasRules(query)) throw new Error('root mute disabled active rule');
        if (tasksCountFilterRules(query) !== 1) throw new Error(`expected one active rule`);
    """
    subprocess.run(["node", "--input-type=module", "-e", script], check=True)


def test_tasks_edge_type_filter_uses_or_and_returns_endpoints():
    script = """
        import { tasksEdgeFilterNodeIds, tasksEdgesMatchingTypes, tasksFilterHoverFocus } from './vyasa/extensions_builtin/tasks/static/tasks_graph_model.js';
        const edges = [
            { id: 'owns', source: 'a', target: 'b', label: 'owns' },
            { id: 'blocks', source: 'b', target: 'c', label: 'blocks' },
            { id: 'ignores', source: 'a', target: 'c', label: 'ignores' },
        ];
        const nodeIds = tasksEdgeFilterNodeIds(edges, ['owns', 'blocks']);
        if ([...nodeIds].sort().join(',') !== 'a,b,c') throw new Error('edge types did not use OR');
        const visibleEdges = tasksEdgesMatchingTypes(edges, ['owns', 'blocks']);
        if (visibleEdges.length !== 2 || visibleEdges.some((edge) => edge.label === 'ignores')) throw new Error('unmatched edges remained visible');
        const focus = tasksFilterHoverFocus(new Set(['a', 'b', 'c']), edges, 'b');
        if ([...focus.nodeIds].sort().join(',') !== 'a,b,c') throw new Error('filtered hover missed one-hop nodes');
        if ([...focus.edgeIds].sort().join(',') !== 'blocks,owns') throw new Error('filtered hover missed one-hop edges');
        if (tasksFilterHoverFocus(new Set(['a', 'b']), edges, 'c').nodeIds.size) throw new Error('unmatched hover escaped the filter subset');
        const aggregate = tasksEdgeFilterNodeIds([
            { source: 'a', target: 'c', label: 'owns, blocks', __edge_types__: ['owns', 'blocks'] },
        ], ['blocks']);
        if (![...aggregate].includes('c')) throw new Error('aggregated edge lost its original types');
    """
    subprocess.run(["node", "--input-type=module", "-e", script], check=True)


def test_tasks_edge_cards_keep_field_order_lists_and_stable_cycle_order():
    script = """
        import { tasksEdgeMetaEntries, tasksOrderedEdges } from './vyasa/extensions_builtin/tasks/static/tasks_graph_model.js';
        const edge = {
            id: 'm4-uses-li3', source: 'm4', target: 'li3', relation: 'uses',
            failure: 'Returns an error string.', summary: 'Calls the data agent.',
            evidence: ['query', 'ask'], introduced_stage: '30-Module-Interfaces', definition: 'edge-proxies/m4-uses-li3.md',
            __rendered_attrs__: { evidence: ['<a>query</a>', '<a>ask</a>'] },
        };
        const entries = tasksEdgeMetaEntries(edge);
        if (entries.map((entry) => entry.key).join(',') !== 'summary,failure,evidence,introduced_stage,definition') throw new Error('field order changed');
        if (!Array.isArray(entries[2].renderedValue) || entries[2].renderedValue.length !== 2) throw new Error('rendered evidence list was joined');
        const ordered = tasksOrderedEdges([
            { id: 'z', source: 'm4', target: 'li3', relation: 'uses' },
            { id: 'a', source: 'm1', target: 'm4', relation: 'calls' },
        ]);
        if (ordered.map((item) => item.id).join(',') !== 'a,z') throw new Error('edge cycle order is unstable');
        if (tasksOrderedEdges(ordered, 'li3').map((item) => item.id).join(',') !== 'z') throw new Error('incident edge cycle is wrong');
    """
    subprocess.run(["node", "--input-type=module", "-e", script], check=True)


def test_tasks_card_attr_config_orders_and_hides_attrs():
    script = """
        import { tasksEdgeMetaEntries, tasksNodeMetaEntries } from './vyasa/extensions_builtin/tasks/static/tasks_graph_model.js';
        const record = { id: 'n1', summary: 'Summary', status: 'Done', owner: 'Yesh' };
        if (tasksNodeMetaEntries(record, ['status', 'summary'], ['owner']).map(({key}) => key).join(',') !== 'status,summary') throw new Error('node card config ignored');
        if (tasksEdgeMetaEntries(record, ['owner', 'summary'], ['status']).map(({key}) => key).join(',') !== 'owner,summary') throw new Error('edge card config ignored');
    """
    subprocess.run(["node", "--input-type=module", "-e", script], check=True)
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()
    assert "tasksNodeMetaEntries(selectedNode, model.node_attr_order, model.node_hidden_attrs)" in source
    assert "tasksEdgeMetaEntries(selectedEdgeRecord, model.edge_attr_order, model.edge_hidden_attrs)" in source


def test_tasks_edge_cards_share_pointer_keyboard_and_deep_link_selection():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()

    assert "onEdgeClick: selectGraphEdge" in source
    # An ordinary edge keeps a generous hit target. A paired sequence row draws
    # two lines a few pixels apart, so each half claims only its own side.
    assert re.search(r"strokeWidth: pairLift \? \d+(?:\.\d+)? : 24", source)
    assert "vectorEffect: 'non-scaling-stroke'" in source
    assert "tasksOrderedEdges(visibleEdgesRef.current" in source
    assert "key === '[' || key === ']'" in source
    assert "key === 'enter' && selectedEdgeIdRef.current" in source
    assert "'aria-live': 'polite'" in source
    assert "hash.startsWith('#kg/')" in source
    assert "data-vyasa-edge-field" in source
    assert "Fit connection" not in source


def test_tasks_edge_type_filter_is_searchable_persisted_and_applied():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()

    assert "placeholder: 'Search edge types'" in source
    assert "'aria-label': 'Available edge types'" in source
    assert "}, 'Edge Types')" in source
    assert "checked: edgeTypeFilterEnabled" in source
    assert "const effectiveEdgeTypes = React.useMemo" in source
    assert "edgeTypeFilterEnabled," in source
    assert "const edgeTypeColors = React.useMemo" in source
    assert "background: edgeColor" in source
    assert "border: `1px solid ${edgeTypeColors[type] || 'currentColor'}`" in source
    assert "edgeTypes: activeEdgeTypes" in source
    assert "tasksEdgeFilterNodeIds(graphBaseRef.current.edges || [], effectiveEdgeTypes)" in source
    assert "tasksEdgesMatchingTypes(graphBaseRef.current.edges || [], effectiveEdgeTypes)" in source
    assert "const filterHoverFocus = tasksFilterHoverFocus(matchingIds, baseEdges, hoveredNodeId);" in source
    assert "'neighbor-focus'" in source
    assert "tasksHoverFocusNodeStyle(node, nodeColor, displayColor, activeBorderColor, checkedShadow, colorMix, true)" in source
    assert "const matchingIds = filteredSelectionIds();" in source
    assert "graphBaseRef.current = { nodes: anchoredNodes, edges: baseEdges }" in source
    assert "tasksFilterGraphByEdgeTypes" not in source
    assert "setActiveEdgeTypes(egoMode || !Array.isArray(nextPrefs?.edgeTypes)" in source


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
    assert "? (projectionGroupTone || nodeColor)" in source
    assert ": (collapsedGroupColor || projectionGroupTone || nodeColor);" in source


def test_tasks_edges_use_pronounced_bezier_coordinates_and_uniform_arrowheads():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()

    assert "const stub = Math.max(56, distance * 0.45);" in source
    assert "const [path, labelX, labelY] = tasksEdgePath(props);" in source
    assert "Math.max(10, strokeWidth * 3.0)" in source
    assert "translate(${labelX}px, ${labelY}px)" in source


def test_tasks_selected_panel_uses_measured_adaptive_width():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()

    assert "function tasksSelectedPanelWidth" in source
    assert "measureTextWidth(node?.label || node?.id || ''" in source
    assert "Math.min(720, Math.max(280" in source
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


def test_tasks_group_hover_uses_the_selected_panel_entries():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()

    assert "selectedNode?.__kind__ === 'group'" in source
    assert "tasksGroupDetailEntries(sourceNodeId, model)" in source
    assert "SelectedNodePanel(groupHoverTooltip.nodeId, true, groupHoverTooltip)" in source


def test_highlighted_edges_and_arrowheads_render_below_node_cards():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()

    assert "const TASKS_EDGE_FOCUS_Z = TASKS_TASK_Z - 2;" in source
    assert "zIndex: hit ? TASKS_EDGE_FOCUS_Z : TASKS_EDGE_Z" in source
    assert "zIndex: highlighted ? TASKS_EDGE_FOCUS_Z : TASKS_EDGE_Z" in source


def test_hovered_edges_render_above_node_highlights_with_four_pixel_border():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()
    css = Path("vyasa/extensions_builtin/tasks/static/tasks.css").read_text()
    hover_edge = source.split("function tasksHoverFocusEdge", 1)[1].split(
        "// Build an inset SVG overlay", 1
    )[0]

    assert "const TASKS_EDGE_HOVER_Z" not in source
    assert "zIndex: TASKS_EDGE_FOCUS_Z" in hover_edge
    assert (
        ".vyasa-tasks-hovering-edge-labels .react-flow__edgelabel-renderer {\n"
        "    z-index: 1600 !important;\n"
        "}"
    ) in css
    assert "strokeWidth: strokeWidth + 8" in source
    assert "strokeWidth: 8" in source


def test_edges_have_four_pixel_canvas_colored_border():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()

    assert "stroke: 'var(--vyasa-paper)'" in source
    assert "strokeWidth: strokeWidth + 8" in source
    assert "strokeWidth: 8" in source
    assert "paintOrder: 'stroke fill'" in source
    assert "markerEnd: undefined" in source


def test_tasks_ego_views_keep_drag_selection_enabled():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()
    start_drag_selection = source.split("const startDragSelection = React.useCallback((event) => {", 1)[1].split("const updateDragSelection", 1)[0]

    assert "const mode = append || event.metaKey ? 'lasso' : (event.shiftKey ? 'rect' : '');" in start_drag_selection
    assert "if (egoMode) return;" not in start_drag_selection


def test_tasks_ego_views_preserve_the_supplied_grouping_hierarchy():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()

    assert "if (preserveGrouping) return projectionState;" in source
    assert "buildTasksViewState(viewerState.model, viewerState.graph, activeProjectionId, viewMode, groupByEnabled, activeGroupByHierarchy, initialEgoMode)" in source


def test_alt_shift_drag_appends_to_existing_selection():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()

    assert "const append = event.altKey && event.shiftKey;" in source
    assert "if (selectedNodeIdRef.current) initialSelectedIds.add(selectedNodeIdRef.current);" in source
    assert "new Set([...dragSelection.initialSelectedIds, ...selected])" in source
    assert "row('Alt + Shift + drag', 'append lasso selection')" in source


def test_option_vertical_arrows_zoom_the_canvas():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()

    assert "const optionZoom = event.altKey && !event.shiftKey && (key === 'arrowup' || key === 'arrowdown');" in source
    assert "if (key === 'arrowup') reactFlow.zoomIn({ duration: 120 });" in source
    assert "else reactFlow.zoomOut({ duration: 120 });" in source
    assert "row('Option + ↑ / ↓', 'zoom in / out')" in source


def test_tasks_g_shortcuts_open_ego_views():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()

    assert "if (key === 'g' && !egoMode)" in source
    assert "openEgo?.(event.shiftKey)" in source
    assert "const selectedNodeIdRef = React.useRef(null);" in source
    assert "selectedNodeIdRef.current = sourceNodeId;" in source
    assert "selectedNodeIdsRef.current = new Set();" in source
    assert "setSelectedNodeId(sourceNodeId);" in source
    assert "window.__vyasaTasksActiveWidgetId = widgetId;" in source
    assert "window.__vyasaTasksActiveWidgetId === widgetId" in source
    assert "markWidgetActive();" in source
    assert "row('G', 'open EG')" in source
    assert "row('Shift + G', 'open EG+')" in source
    assert "const [egoState, setEgoState] = React.useState(null);" in source
    assert "const projectionState = egoState || baseProjectionState;" in source
    assert "setEgoState(nextEgoState);" in source
    assert "openTasksEgoModal" not in source
    assert "if (event.key === 'Escape' && !event.shiftKey && egoMode && widgetFocused)" in source
    assert "if (event.key === 'Escape' && !event.shiftKey && widgetFocused)" in source
    assert "clearSelection('escape');" in source


def test_slide_ego_reuses_the_existing_react_flow():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()
    modal_source = Path("vyasa/extensions_builtin/tasks/static/tasks_fullscreen.js").read_text()

    assert "openEgo?.(" in source
    assert "slideFocusMode === 'egplus', slide.nodes, true" in source
    assert "window.__vyasaTasksActions?.[widgetId]?.closeEgo?.();" in source
    assert "data-tasks-inline-ego" not in source
    assert "openTasksEgoModal" not in modal_source


def test_slides_hide_filters_without_changing_the_saved_filter_state():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()
    filter_panel = source.split("const FilterPanel = () => {", 1)[1].split("const options = tasksFilterOptions", 1)[0]
    guarded_toggle = source.split("const setFiltersCollapsedGuarded = React.useCallback", 1)[1].split("const activeColorLevelSpecs", 1)[0]

    assert "if (egoMode || slideIndex >= 0) return null;" in filter_panel
    assert "if (slideIndex >= 0) return;" in guarded_toggle
    assert "setFiltersCollapsed(true)" not in source.split("const SlideLauncher = () =>", 1)[1].split("const SlideShow = () =>", 1)[0]


def test_ego_restores_the_existing_graph_state_and_viewport():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()

    assert "expanded: new Set(expanded)" in source
    assert "viewport: reactFlow.getViewport()" in source
    assert "setExpanded(new Set(previous.expanded));" in source
    assert "reactFlow.setViewport(pending.viewport, { duration: 0 });" in source
    assert "setSelectedNodeIds(new Set(pending.selectedNodeIds));" in source
    assert "if (egoState) return;" in source
    assert "tasksFilterOptions(baseModel)" in source


def test_tasks_wheel_measurements_are_gated_before_dom_reads():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()
    handler = source.split("onWheelCapture: (event) => {", 1)[1].split("onPointerMoveCapture", 1)[0]

    assert handler.index("if (!window.__vyasaTasksPerf.enabled) return;") < handler.index("tasksPerfSurfaceSnapshot")
    assert handler.index("if (!window.__vyasaTasksPerf.enabled) return;") < handler.index("tasksPerfScrollSnapshot")


def test_tasks_clicking_selected_node_toggles_selection_off():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()

    assert "selectedNodeIdRef.current === sourceNodeId && selectedNodeIdsRef.current.size === 0" in source
    assert "clearSelection('nodeClickToggle');" in source
    assert "suppressNextGraphClickRef.current = true;" in source
    assert "clearSelection('nodeBodyToggle');" in source
    gantt_body = source.split("if (data?.__gantt) {", 1)[1].split("const labelNode", 1)[0]
    assert "onClickCapture: handleSelectedNodeToggleCapture" in gantt_body


def test_tasks_fullscreen_reuses_canvas_background_contract():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()
    modal_source = Path("vyasa/extensions_builtin/tasks/static/tasks_fullscreen.js").read_text()
    css_source = Path("vyasa/extensions_builtin/tasks/static/tasks.css").read_text()

    assert "function tasksBackgroundProps(widgetId)" in source
    assert "id: `${key}-bg`" in source
    assert "window.React.createElement(rf.Background, backgroundProps)" in source
    assert "data-vyasa-tasks-fullscreen-toggle" in source
    assert "vyasa-tasks-fullscreen-toggle" in source
    assert "stroke-width: 1.5 !important" in css_source
    assert "function syncTasksFullscreenButton(wrapper)" in source
    assert "function tasksFullscreenIconHtml(on = false)" in source
    assert "'shrink' : 'expand'" in source
    assert "button.innerHTML = tasksFullscreenIconHtml(on);" in source
    assert "syncTasksFullscreenButton(wrapper);" in source
    assert "wrapper.setAttribute('data-tasks-maximized', 'true');" in modal_source
    assert "wrapper.getAttribute('data-tasks-ego-active') === 'true'" in modal_source
    assert "closeEgo?.();" in modal_source
    assert "event.stopImmediatePropagation?.();" in modal_source
    assert "if (event.key !== 'Escape' || !event.shiftKey) return;" in modal_source


def test_tasks_filter_sidebar_search_reuses_filter_highlight_path():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()

    assert "function tasksSearchNormalizeText(value)" in source
    assert "function tasksSearchSpec(query)" in source
    assert "function tasksCollectSearchMatches(nodes, edges, query, nodeNotes = {})" in source
    assert "nodeNotes[String(node?.id || '')]" in source
    assert "tasksCollectSearchMatches(graphBaseRef.current.nodes || [], graphBaseRef.current.edges || [], searchQuery, nodeNotes)" in source
    assert "const [searchInputValue, setSearchInputValue] = React.useState" in source
    assert "window.setTimeout(() => {" in source
    assert "}, 140);" in source
    assert "placeholder: 'text or /regex/i'" in source
    assert "setSearchQuery('')" in source
    assert "const hasSearch = searchMatches.active && !searchMatches.error;" in source
    assert "const filterPanelElement = FilterPanel();" in source


def test_tasks_notes_support_graph_scoped_text_download_and_upload():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()

    assert "collectTasksStoredNotes(storage, storageKey, nodeTitles, slideTitles)" in source
    assert "prefs.slideNotes = normalizeTasksNodeNotes(slideNotes);" in source
    assert "slideNotes: normalizeTasksNodeNotes(prefs.slideNotes)" in source
    assert "String(node.label || node.title || node.id)" in source
    assert "importTasksStoredNotes(storage, storageKey, backup)" in source
    assert "prefs.nodeStates = normalizeTasksNodeStates(nodeStates, normalizeTasksCardStates(model));" in source
    assert "filename: `vyasa-kg-notes-${graphName}.txt`" in source
    assert "showTasksToast(`Downloaded ${filename}`)" in source
    assert "buildTasksNodeNotesBackup(sourceModel, latestNodeNotes(), nodeStates, latestSlideNotes()).text" in source
    assert "showTasksToast('Copied notes')" in source
    assert "toast.id = 'vyasa-tasks-toast'" in source
    assert "input.accept = '.txt,text/plain,application/json'" in source
    assert "nodeStates: normalizeTasksNodeStates(prefs.nodeStates, cardStates)" in source
    assert "setSlideNotes(imported.slideNotes);" in source
    assert "Object.keys(nodeNotes).length + Object.keys(slideNotes).length" in source
    assert "setNodeStates(imported.nodeStates);" in source
    assert "onClick: handleExportNodeNotes" in source
    assert "onClick: handleImportNodeNotes" in source
    assert "{ 'uk-icon': 'download', 'aria-hidden': 'true' }" in source
    assert "{ 'uk-icon': 'copy', 'aria-hidden': 'true' }" in source
    assert "{ 'uk-icon': 'upload', 'aria-hidden': 'true' }" in source


def test_tasks_slide_notes_anchor_to_slide_card_bottom():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()

    assert "overflowY: 'auto', display: 'flex', flexDirection: 'column'" in source
    assert "gridTemplateRows: 'auto minmax(0, 1fr)', gap: '6px', marginTop: 'auto', paddingTop: '12px', minHeight: '50%'" in source
    assert "} }, 'Notes')" in source
    assert "placeholder: 'Capture presenter cues, follow-ups, or context for this slide.'" in source
    assert "height: '100%', minHeight: '0', resize: 'vertical'" in source
    assert "marginTop: '8px', paddingTop: '8px'" in source


def test_tasks_search_normalizes_whitespace_and_wrapping_quotes():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()

    assert "replace(/\\s+/g, ' ').trim()" in source
    assert "raw.slice(1, -1).trim()" in source
    assert "text.toLowerCase().includes(spec.matcher)" in source
    assert "const values = [data.label];" in source


def test_tasks_base_view_supports_task_parent_expansion():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()

    assert "function tasksNodeHasChildren(nodeId, model)" in source
    assert "function tasksVisibleGraphStatsLabel(nodes, edges)" in source
    assert "if (!String(projectionId || '').trim() && prefs && typeof prefs === 'object') return { ...schemaPrefs, ...prefs };" in source
    assert "setExpanded(tasksExpandableNodeIds(model));" in source
    assert "const canExpand = tasksNodeHasChildren(id, model);" in source
    assert "tasksChildTaskIds(nodeId, model).forEach((id) => visibleTasks.add(id));" in source
    assert "graphBaseRef.current.nodes || []" in source
    assert "setEdges(edgesVisible ? baseEdges : []);" in source


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


def test_tasks_block_renders_node_references_inside_attributes():
    md = dedent("""\
    ```items
    Foundation:
      - source :: Source | summary: "Use [[target]] and [[target|custom text]]."
      - target :: Target node
    ```
    """)

    rendered = to_xml(from_md(md))
    match = re.search(r"""data-tasks-payload=(["'])(.*?)\1""", rendered)

    assert match is not None
    payload = json.loads(html.unescape(match.group(2)))
    summary_html = payload["tasks"][0]["__rendered_attrs__"]["summary"]
    assert summary_html.count('data-vyasa-node-reference="target"') == 2
    assert ">Target node</span>" in summary_html
    assert ">custom text</span>" in summary_html
    assert "href=" not in summary_html


def test_tasks_node_reference_navigation_preserves_zoom():
    script = """
        import { tasksCenteredViewport } from './vyasa/extensions_builtin/tasks/static/tasks_graph_core.js';
        const next = tasksCenteredViewport({ x: 10, y: 20, zoom: 0.45 },
            { left: 100, top: 50, width: 800, height: 600 }, { left: 200, top: 150, width: 120, height: 80 });
        if (next.x !== 250 || next.y !== 180 || next.zoom !== 0.45) throw new Error(JSON.stringify(next));
    """
    subprocess.run(["node", "--input-type=module", "-e", script], check=True)
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()
    css = Path("vyasa/extensions_builtin/tasks/static/tasks.css").read_text()
    assert "if (!reference || !nodeReferenceKeyHeldRef.current) return false;" in source
    assert "const focusGraphNode = React.useCallback((targetId)" in source
    assert "logTasksDebug('graphNodeFocus'" in source
    assert "focusGraphNode(String(reference.dataset.vyasaNodeReference || '').trim());" in source
    assert "nodeEl.classList.add('vyasa-tasks-pulse');" in source
    assert "}, 8000)," in source
    assert ".react-flow__node:not(.vyasa-tasks-pulse):has(" in css
    assert "title: 'Center node', onClick: focusPanelNode" in source
    assert "window.addEventListener('keydown', syncNodeReferenceModifier, true);" in source
    assert "String(event.key || '').toLowerCase() !== 'd'" in source
    assert "row('D + click [[node]]', 'go to referenced node')" in source
    assert "renderTasksInlineLinks(data?.label || id" in source
    drag_selection = source.split("const startDragSelection", 1)[1].split("const updateDragSelection", 1)[0]
    assert "[data-vyasa-node-reference]" in drag_selection
    assert ".vyasa-tasks-node-reference-modifier .vyasa-tasks-node-reference:not(" in css
    assert "cursor: pointer;" in css
    assert "text-decoration: underline;" in css


def test_node_title_reference_click_routes_before_node_selection():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()
    node_capture = source.split("const handleSelectedNodeToggleCapture", 1)[1].split("if (data?.__kind__ === 'ganttHeader')", 1)[0]
    flow_capture = source.split("const flowPointerHandlers", 1)[1].split("const flowWrapperStyle", 1)[0]

    assert "if (focusNodeReferenceFromEvent(event)) return;" in node_capture
    assert "onClickCapture: focusNodeReferenceFromEvent" in flow_capture


def test_context_attributes_resolve_references_to_hidden_pack_nodes(tmp_path):
    (tmp_path / "kg.schema").write_text(
        "@graph id=refs\npool=kg.nodes\nattrs=kg.attrs\ncontexts=*.context\n",
        encoding="utf-8",
    )
    (tmp_path / "kg.nodes").write_text(
        "source: Source\nvisible: Visible\nhidden: Hidden target\n",
        encoding="utf-8",
    )
    (tmp_path / "kg.attrs").write_text(
        '@node_attrs\nsummary:\n  "See [[hidden]]": source\n',
        encoding="utf-8",
    )
    (tmp_path / "one.context").write_text(
        "@context id=one seq=1\n@edges\n  source -> visible relates\n",
        encoding="utf-8",
    )

    model, _ = _compile_schema_payload(tmp_path / "kg.schema", context_id="one")

    assert {task["id"] for task in model["tasks"]} == {"source", "visible", "hidden"}
    source = next(task for task in model["tasks"] if task["id"] == "source")
    assert ">Hidden target</span>" in source["__rendered_attrs__"]["summary"]
    assert "vyasa-tasks-node-reference--broken" not in source["__rendered_attrs__"]["summary"]
    script = f"""
        import {{ tasksReferenceEdges }} from './vyasa/extensions_builtin/tasks/static/tasks_graph_model.js';
        const edges = tasksReferenceEdges({json.dumps(model)});
        if (!edges.some((edge) => edge.source === 'hidden' && edge.target === 'source')) {{
            throw new Error(JSON.stringify(edges));
        }}
    """
    subprocess.run(["node", "--input-type=module", "-e", script], check=True)


def test_tasks_block_renders_markdown_lists_without_trailing_breaks():
    md = dedent("""\
    ```items
    Foundation:
      - t1 :: Define graph payload | summary: "- First point"
    ```
    """)

    rendered = to_xml(from_md(md, current_path="docs/feed/personalization"))
    match = re.search(r"""data-tasks-payload=(["'])(.*?)\1""", rendered)

    assert match is not None
    payload = json.loads(html.unescape(match.group(2)))
    summary_html = payload["tasks"][0]["__rendered_attrs__"]["summary"]
    css_source = Path("vyasa/extensions_builtin/tasks/static/tasks.css").read_text()

    assert '<ul class="uk-list uk-list-bullet' in summary_html
    assert summary_html.count('class="text-base leading-relaxed"') == 1
    assert ".vyasa-task-node-card-value ul { list-style:" not in css_source
    assert ".vyasa-task-node-card-value ol { list-style:" not in css_source
    assert ".vyasa-task-slide-description ul { list-style:" not in css_source
    assert ".vyasa-task-slide-description ol { list-style:" not in css_source


def test_tasks_block_serializes_rendered_attr_html_for_projection_models(tmp_path):
    (tmp_path / "kg.schema").write_text(
        """@graph id=prep initial_view=arc
@sources
nodes=kg.nodes
attrs=kg.attrs
base:
    edges=kg.edges
@views
arc:
    source=base
    group_by=owner
    caption="Arc"
""",
        encoding="utf-8",
    )
    (tmp_path / "kg.nodes").write_text(
        """t1: Adversarial evasion
\tdesc=|
\t\tAttackers actively mutate behavior to slip past static models. Examples:
\t\t- **Polymorphic malware** rewrites its own bytes each infection so no two copies hash alike.
\t\t- **DGA domains** generate thousands of random C2 hostnames; blocklists can't keep up.
""",
        encoding="utf-8",
    )
    (tmp_path / "kg.edges").write_text("", encoding="utf-8")
    (tmp_path / "kg.attrs").write_text("@node_attrs\nowner:\n  blue: t1\n", encoding="utf-8")

    md = f"""```items
---
items_schema: {tmp_path / "kg.schema"}
---
```"""

    rendered = to_xml(from_md(md, current_path=tmp_path / "graph.md"))
    match = re.search(r"""data-tasks-payload=(["'])(.*?)\1""", rendered)

    assert match is not None
    payload = json.loads(html.unescape(match.group(2)))
    desc_html = payload["projection_models"]["arc"]["model"]["tasks"][0]["__rendered_attrs__"]["desc"]
    assert "<ul>" in desc_html
    assert "<strong>Polymorphic malware</strong>" in desc_html
    assert "<strong>DGA domains</strong>" in desc_html


def test_node_multiline_markdown_handles_mixed_block_indent(tmp_path):
    (tmp_path / "kg.schema").write_text(
        "@graph id=deck\n@sources\nnodes=kg.nodes\n",
        encoding="utf-8",
    )
    (tmp_path / "kg.nodes").write_text(
        """t1: Operations
\tsources=|
\t \tCRoUD Activities
\t\t\t- [Create](create.md)
\t\t\t- [Delete](delete.md)
\t\t[Ordered mutations](ordered.md)
\t\t[Service tests](tests.md)
""",
        encoding="utf-8",
    )

    model, _graph = _compile_schema_payload(tmp_path / "kg.schema", str(tmp_path / "graph.md"))
    sources_html = model["tasks"][0]["__rendered_attrs__"]["sources"]

    assert "<p" in sources_html and ">CRoUD Activities</p>" in sources_html
    assert sources_html.count("<li") == 2
    assert sources_html.index("</ul>") < sources_html.index(">Ordered mutations</a>")


def test_tasks_block_serializes_rendered_slide_description_markdown(tmp_path):
    (tmp_path / "kg.schema").write_text(
        """@graph id=deck
@sources
nodes=kg.nodes
@slides
intro: Intro
\tnodes=t1
\tdesc=|
\t\t**Presenter frame**

\t\t- First point
""",
        encoding="utf-8",
    )
    (tmp_path / "kg.nodes").write_text("t1: Start\n", encoding="utf-8")

    md = f"""```items
---
items_schema: {tmp_path / "kg.schema"}
---
```"""

    rendered = to_xml(from_md(md, current_path=tmp_path / "graph.md"))
    match = re.search(r"""data-tasks-payload=(["'])(.*?)\1""", rendered)

    assert match is not None
    payload = json.loads(html.unescape(match.group(2)))
    desc_html = payload["slides"][0]["__rendered_attrs__"]["desc"]
    assert "<strong>Presenter frame</strong>" in desc_html
    assert "<li>First point</li>" in desc_html


def test_tasks_api_payload_serializes_rendered_slide_description_markdown(tmp_path):
    (tmp_path / "kg.schema").write_text(
        """@graph id=deck
@sources
nodes=kg.nodes
@slides
intro: Intro
\tnodes=t1
\tdesc=|
\t\t- First point
\t\t- Second point
""",
        encoding="utf-8",
    )
    (tmp_path / "kg.nodes").write_text("t1: Start\n", encoding="utf-8")

    model, _graph = _compile_schema_payload(tmp_path / "kg.schema", str(tmp_path / "graph.md"))

    desc_html = model["slides"][0]["__rendered_attrs__"]["desc"]
    assert "<li>First point</li>" in desc_html
    assert "<li>Second point</li>" in desc_html


def test_view_slide_description_markdown_is_rendered_in_projection_model(tmp_path):
    (tmp_path / "kg.schema").write_text(
        """@graph id=deck
@sources
nodes=kg.nodes
@views
story:
    slides:
        intro: Intro
            nodes=t1
            desc=|
                **Presenter frame**

                - First point
""",
        encoding="utf-8",
    )
    (tmp_path / "kg.nodes").write_text("t1: Start\n", encoding="utf-8")

    model, _graph = _compile_schema_payload(tmp_path / "kg.schema", str(tmp_path / "graph.md"))

    desc_html = model["projection_models"]["story"]["model"]["slides"][0]["__rendered_attrs__"]["desc"]
    assert "<strong>Presenter frame</strong>" in desc_html
    assert "First point</li>" in desc_html


def test_slide_description_markdown_has_list_styling_contract():
    graph_source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()
    css_source = Path("vyasa/extensions_builtin/tasks/static/tasks.css").read_text()

    assert "className: 'vyasa-task-slide-description'" in graph_source
    assert ".vyasa-task-slide-description ul { list-style: disc;" in css_source
    assert ".vyasa-task-slide-description ol { list-style: decimal;" in css_source


def test_slide_notes_panel_uses_stable_render_helper():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()
    render_source = source.split("return rf.ReactFlowProvider ?", 1)[1].split("const existing = document.getElementById", 1)[0]

    assert "SlideShow()," in render_source
    assert "window.React.createElement(SlideShow)" not in render_source


def test_client_stats_label_counts_hierarchy_links_without_edges():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()

    assert "Hierarchy Link" in source
    assert "parent !== 'null'" in source
    assert "for (const [parent, items] of Object.entries(model?.task_children || {}))" in source


def test_kg_palette_colors_are_contrast_adjusted_in_dark_mode():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()

    assert "TASKS_DARK_PALETTE_CONTRAST = 3.2" in source
    assert "function tasksDisplayPaletteColor(color)" in source
    assert "document.documentElement?.classList?.contains('dark')" in source
    assert "tasksChromaCappedOklab(tasksRgbToOklab(rgb))" in source
    assert "tasksContrastRatio(candidate, paper) >= TASKS_DARK_PALETTE_CONTRAST" in source
    assert "const displayColor = tasksDisplayPaletteColor(color);" in source
    assert "return tasksDisplayPaletteColor(averageTasksHexColors(colors) || colors[0]?.trim() || '')" in source


def test_react_flow_component_fills_flow_wrapper():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()
    render_source = source.split("return rf.ReactFlowProvider ?", 1)[1].split("const existing = document.getElementById", 1)[0]

    assert "function applyTasksStandaloneHeight(wrapper)" in source
    assert "wrapper.closest('.vyasa-main-shell')" in source
    assert "applyTasksStandaloneHeight(wrapper);" in source
    assert "width: '100%'" in render_source
    assert "height: '100%'" in render_source
    assert "flex: '1 1 auto'" in render_source
    assert "minHeight: 0" in render_source
    assert "alignSelf: 'stretch'" in source
    assert "display: 'flex'" in source


def test_filter_and_slide_panels_touch_the_graph_canvas():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()
    render_source = source.split("return rf.ReactFlowProvider ?", 1)[1].split("const existing = document.getElementById", 1)[0]
    filter_source = source.split("const FilterPanel = () => {", 1)[1].split("const SlideShow = () => {", 1)[0]
    slide_source = source.split("const SlideShow = () => {", 1)[1].split("const DragSelectionOverlay = () => {", 1)[0]

    # No gap between the panels and the canvas, and no negative margin faking
    # one shut.
    assert "gap: '12px'" not in render_source
    assert "maxWidth: '100%'" in filter_source
    assert "marginLeft: '-12px'" not in slide_source


def test_tasks_slide_show_nav_stays_above_title_and_supports_jump_select():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()
    slide_source = source.split("const SlideShow = () => {", 1)[1].split("const DragSelectionOverlay = () => {", 1)[0]
    ready_fit_source = source.split("const FitOnNodesReady = () => {", 1)[1].split("const flowWrapperClassName", 1)[0]

    assert "className: 'vyasa-task-slide-nav'" in slide_source
    assert "'aria-label': 'Jump to slide'" in slide_source
    assert "'aria-label': 'Previous slide'" in slide_source
    assert "'aria-label': 'Next slide'" in slide_source
    assert "onChange: (event) => setSlideIndex(Number(event.target.value))" in slide_source
    assert slide_source.index("className: 'vyasa-task-slide-nav'") < slide_source.index("slide.title || `Slide ${slideIndex + 1}`")
    assert "`${index + 1} / ${slides.length}`" in slide_source
    assert "tasksMatchedSlideNodes(slides, slideIndex, graphBaseRef.current.nodes)" in ready_fit_source
    assert "nodes: matched" in ready_fit_source


def test_selected_node_panel_stacks_the_title_above_the_id():
    """The title owns the full card width; the id sits under it and truncates.

    Side by side, each got half a narrow card, and `overflowWrap: anywhere`
    drove the column's min-content width to one glyph, so a title broke one
    character per line.
    """
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()

    assert "gridTemplateColumns: 'minmax(0, 1fr)'" in source
    assert "panelNodeId ? 'minmax(0, 1fr) minmax(0, 1fr)'" not in source
    assert "whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, panelNodeId)" in source


def test_slide_selection_is_not_reapplied_when_graph_layout_changes():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()
    selection_start = source.index("const ids = new Set((slide.nodes || [])", source.index("const [slideIndex"))
    refit_start = source.index("const timer = window.setTimeout", selection_start)

    selection_effect = source[selection_start:refit_start]
    assert "}, [slideIndex, slides]);" in selection_effect


def test_context_graphs_have_day_switch_contract():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()
    css = Path("vyasa/extensions_builtin/tasks/static/tasks.css").read_text()
    api = Path("vyasa/extensions_builtin/tasks/api.py").read_text()

    assert "async function loadTasksContext" in source
    assert "fetch('/api/tasks/context'" in source
    assert "async function loadTasksContextDiff" in source
    assert "fetch('/api/tasks/context-diff'" in source
    assert '@rt("/api/tasks/context-diff"' in api
    # The panel shares named style constants instead of piling one-off inline
    # styles. Their existence is the contract; their contents are not.
    assert "const filterSectionStyle = {" in source
    assert "const filterInlineControlStyle = {" in source
    assert "const filterChoiceListStyle = {" in source
    assert "const contextOptions = React.useMemo" in source
    assert "style: filterKeyStyle }, 'Context')" in source
    assert "'aria-label': 'Select changes from previous context'" in source
    assert "tasksContextDiffSelectionIds(model, graphBaseRef.current.nodes, changedIds)" in source
    assert "setSelectedNodeIds(new Set(nextIds));" in source
    assert "const diffOwnsSelection = contextDiffEnabled" in source
    assert "reason: 'contextDiffPaneClick'" in source
    assert "__context_diff__" not in source
    assert 'data-vyasa-context-diff' not in css
    assert "outline-offset: 3px" in css
    assert source.index("'Context'") < source.index("'View'")
    assert "onChange: (event) => handleSwitchContext(event.target.value)" in source
    assert "`${context.seq}. ${context.label || context.caption || context.id}`" in source
    assert "const renderColorLevel = (colorBy, index) => {" in source
    assert "sourceModel?.kg_context?.caption ? React.createElement('div', {" in source
    assert "React.createElement('span', { style: filterKeyStyle }, 'Intensity')" in source
    assert "React.createElement('span', { style: { opacity: 0.82 } }, 'Edge Intensity')" in source
    assert "React.createElement('span', { style: { opacity: 0.82 } }, 'Null Intensity')" in source
    assert "if (options?.resetSlideIndex) setSlideIndex((index) => index >= 0 ? 0 : -1);" in source
    assert "applyLoadedSource(payload, projectionId, { resetSlideIndex: true });" in source
    assert "}, [slideIndex, slides, graphRevision]);" in source


def test_view_menu_only_shows_views_resolved_to_the_active_context():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()

    assert "const list = Array.isArray(baseProjectionState.model?.slides) ? baseProjectionState.model.slides : [];" in source
    assert "tasksProjectionOptions(viewerState.model, ganttEnabled, activeContextId)" in source
    assert "tasksProjectionOptions(nextModel, ganttEnabled, nextContextId)" in source
    assert "handleSwitchContext(targetContext, activeProjectionId);" not in source
    assert "setSlideIndex((index) => index < 0 ? -1 : (slides.length ? 0 : -1));" in source

    script = """
        import { tasksViewMatchesContext } from './vyasa/extensions_builtin/tasks/static/tasks_graph_core.js';
        if (!tasksViewMatchesContext({ resolved_context: 'context-016' }, 'context-016')) throw new Error('matching view hidden');
        if (tasksViewMatchesContext({ resolved_context: 'context-015' }, 'context-016')) throw new Error('foreign view shown');
        if (!tasksViewMatchesContext({ resolved_context: 'context-015' }, '')) throw new Error('non-context graph filtered');
    """
    subprocess.run(["node", "--input-type=module", "-e", script], check=True)


def test_tasks_block_serializes_document_path_and_stable_storage_id():
    md = """```items
Foundation:
  - t1 :: Define graph payload
```"""

    html = to_xml(from_md(md, current_path="docs/feed/personalization"))

    assert '"document_path": "docs/feed/personalization"' in html
    assert '"storage_id": "tasks-block-' in html
    assert '"persistence_id":' in html


def _write_kg_pack(root: Path) -> Path:
    pack = root / "docs" / "blueprint.kg"
    pack.mkdir(parents=True)
    (root / "src").mkdir()
    (root / "src" / "feed.ts").write_text("export const feed = 1;\n", encoding="utf-8")
    (pack / "kg.schema").write_text(
        "@graph id=bp title=Blueprint\n\n@sources\nnodes=kg.nodes\nbase:\n\tedges=kg.edges\n",
        encoding="utf-8",
    )
    (pack / "kg.nodes").write_text(
        "n1: Queue\n\tsources=[Feed](../../src/feed.ts)\n", encoding="utf-8"
    )
    (pack / "kg.edges").write_text("", encoding="utf-8")
    return pack


def test_kg_pack_links_resolve_from_pack_folder_on_every_referring_page(tmp_path, monkeypatch):
    from vyasa.extensions_builtin.tasks.render import render_tasks_block

    root = tmp_path / "root"
    pack = _write_kg_pack(root)
    monkeypatch.setenv("VYASA_CLI_ROOT", str(root))

    from_pack_page = render_tasks_block(
        f"---\nitems_schema: {pack / 'kg.schema'}\n---\n", "docs/blueprint.kg", "items"
    )
    from_document = render_tasks_block(
        "---\nitems_schema: blueprint.kg/kg.schema\n---\n", "docs/blueprint", "items"
    )

    assert "/posts/src/feed.ts" in html.unescape(from_pack_page)
    assert "/posts/src/feed.ts" in html.unescape(from_document)
