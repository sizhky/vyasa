from fasthtml.common import to_xml
import html
import json
from pathlib import Path
import re
from textwrap import dedent

from vyasa.extensions_builtin.markdown.renderer import from_md


def test_tasks_block_renders_widget_payload_without_summary():
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
    assert "const egoNodeOpacity = egoMode" in graph_source
    assert "tasksEgoNodeOpacity(n, egoSelectedIds, model, egoNeighborOpacity)" in graph_source
    assert "const titleOpacity = (isInUnspecifiedProjectionBranch(n) ? projectionUnspecifiedContentOpacity : 1)" in graph_source
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


def test_tasks_node_detail_rows_use_inline_label_flow():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()
    css = Path("vyasa/extensions_builtin/tasks/static/tasks.css").read_text()

    assert "`${entry.label}: `" in source
    assert "React.createElement('span', { style: { fontWeight: 700" in source
    assert "overflowWrap: 'anywhere'" in source
    assert "whiteSpace: 'pre-line'" in source
    assert "gridTemplateColumns: stacked ?" not in source
    assert ".vyasa-task-node-card-value > p:first-child { display: inline; }" in css


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
    assert "function ensureTasksQueryBuilder()" in source
    react_flow_loader = source[source.index("function ensureTasksReactFlow()"):source.index("function ensureTasksQueryBuilder()")]
    assert "react-querybuilder" not in react_flow_loader


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


def test_tasks_query_builder_controls_use_filter_panel_css():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()

    assert ".vyasa-tasks-filter-card .betweenRules" in source
    assert ".vyasa-tasks-filter-card .ruleGroup-notToggle" in source
    assert ".vyasa-tasks-filter-card select" in source
    assert ".vyasa-tasks-filter-card input[type=\"checkbox\"]" in source
    assert "appearance: none;" in source


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
    assert "toggleCheckedNode(sourceNodeId)" in source


def test_tasks_source_renders_hover_checkbox_and_done_badge():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()

    assert "type: 'checkbox'" in source
    assert "const doneBadge = isChecked ?" in source
    assert "taskStateLabel" in source


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
    assert "nodeNotes" in source
    assert "setNoteInputValue(event.target.value)" in source
    assert "updateNodeNote(selectedNodeId, noteInputValue)" in source
    assert "placeholder: 'Notes'" in source
    assert "SelectedNodePanel()" in source
    assert "__has_note__" in source
    assert "title: 'Has note'" in source
    assert "kinds: ['note']" in source
    assert "TASKS_HAS_NOTE_PALETTE = { yes: '#22c55e', no: 'rgba(220, 38, 38, 0.28)' }" in source
    assert "tasksHasAnyNodeNote(nodeNotes)" in source


def test_tasks_selected_panel_shows_href_as_detail_instead_of_title_link():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()

    assert "const panelLinkKinds = Array.from(tasksNodeLinkKinds(selectedNode));" in source
    assert "const panelHref = String(selectedNode?.href || '').trim();" in source
    assert "renderTasksNodeLinkBadge(React, { kinds: panelLinkKinds, right: '0', top: '0' })" in source
    assert "onClick: (event) => openTasksNodeHref(panelHref, event)" in source
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
    assert "setActiveColorBy(resolveTasksPreferredColorBy(model, activeProjectionId, defaults, nodeNotes))" in source
    assert "setActiveSecondaryColorBy(resolveTasksPreferredSecondaryColorBy(model, defaults, nodeNotes))" in source
    assert "setEdgesVisible(typeof defaults.edgesVisible === 'boolean'" in source
    assert "setEdgeAnimationEnabled(typeof defaults.edgeAnimationEnabled === 'boolean'" in source
    assert "onClick: resetProjectionControls" in source


def test_tasks_color_swatch_filter_is_independent_and_ands_with_query_filter():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()
    callback = source.split("const toggleFilterValue = React.useCallback", 1)[1].split("}, []);", 1)[0]

    assert "setActiveSwatchFilters((current) => toggleTasksFilterQueryValue(current, key, value, enabled))" in callback
    assert "setQueryBuilderEnabled(true)" not in callback
    assert "function tasksNodeMatchesAllFilters(node, queryFilters, swatchFilters)" in source
    assert "tasksNodeMatchesFilters(node, queryFilters) && tasksNodeMatchesFilters(node, swatchFilters)" in source
    assert "tasksFilterQuerySelectedValues(activeSwatchFilters, activeColorBy)" in source
    assert "tasksFilterQuerySelectedValues(activeSwatchFilters, activeSecondaryColorBy)" in source
    assert "swatchFilters: activeSwatchFilters" in source
    assert "setActiveSwatchFilters(tasksEmptyFilterQuery())" in source
    assert "query: normalizeTasksFilterQuery(activeFilters)" in source
    assert "onQueryChange: (query) => setActiveFilters(normalizeTasksFilterQuery(query))" in source
    assert "const activeSwatchKeys = new Set([activeColorBy, activeSecondaryColorBy].filter(Boolean))" in source
    assert "tasksPruneFilterQueryFields(current, activeSwatchKeys)" in source


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


def test_tasks_edge_labels_use_react_flow_bezier_coordinates():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()

    assert "const [path, labelX, labelY] = rf.getBezierPath(props);" in source
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


def test_tasks_ego_views_keep_drag_selection_enabled():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()
    start_drag_selection = source.split("const startDragSelection = React.useCallback((event) => {", 1)[1].split("const updateDragSelection", 1)[0]

    assert "event.metaKey ? 'lasso' : (event.shiftKey ? 'rect' : '')" in start_drag_selection
    assert "if (egoMode) return;" not in start_drag_selection


def test_tasks_g_shortcuts_open_ego_views():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()

    assert "if (key === 'g' && !egoMode)" in source
    assert "openEgo?.(event.shiftKey)" in source
    assert "G: open EG\\nShift + G: open EG+" in source


def test_tasks_fullscreen_reuses_canvas_background_contract():
    source = Path("vyasa/extensions_builtin/tasks/static/tasks.js").read_text()

    assert "function tasksBackgroundProps(widgetId)" in source
    assert "id: `${key}-bg`" in source
    assert "window.React.createElement(rf.Background, backgroundProps)" in source
    assert "fullscreenWrapper.className = 'tasks-container relative';" in source
    assert "tasksHeaderControlsHtml(fullscreenId, false)" in source
    assert "runTasksHeaderAction('${fullscreenId}', 'toggleFilters')" in source
    assert "modal.className = 'fixed inset-0 z-[10000] bg-black/88 backdrop-blur-sm';" in source
    assert "flow.style.flex = '1 1 auto';" in source
    assert "flow.style.minHeight = '0';" in source


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

    assert "collectTasksStoredNotes(storage, storageKey, nodeTitles)" in source
    assert "String(node.label || node.title || node.id)" in source
    assert "importTasksStoredNotes(storage, storageKey, backup)" in source
    assert "filename: `vyasa-kg-notes-${graphName}.txt`" in source
    assert "showTasksToast(`Downloaded ${filename}`)" in source
    assert "buildTasksNodeNotesBackup(sourceModel, latestNodeNotes()).text" in source
    assert "showTasksToast('Copied notes')" in source
    assert "toast.id = 'vyasa-tasks-toast'" in source
    assert "input.accept = '.txt,text/plain,application/json'" in source
    assert "onClick: handleExportNodeNotes" in source
    assert "onClick: handleImportNodeNotes" in source
    assert "{ 'uk-icon': 'download', 'aria-hidden': 'true' }" in source
    assert "{ 'uk-icon': 'copy', 'aria-hidden': 'true' }" in source
    assert "{ 'uk-icon': 'upload', 'aria-hidden': 'true' }" in source


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


def test_tasks_block_serializes_document_path_and_stable_storage_id():
    md = """```items
Foundation:
  - t1 :: Define graph payload
```"""

    html = to_xml(from_md(md, current_path="docs/feed/personalization"))

    assert '"document_path": "docs/feed/personalization"' in html
    assert '"storage_id": "tasks-block-' in html
    assert '"persistence_id":' in html
