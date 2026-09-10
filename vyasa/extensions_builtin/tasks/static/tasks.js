import {
    copyTasksText, tasksCodeAttributeLink, tasksHeldKeyApplies, tasksInlineReferenceHtml,
    tasksNodeLinkKinds,
} from './tasks_cards.js';
import {
    initializeTasksDiagnostics, logTasksDebug, logTasksDebugVerbose, logTasksPerf,
    logTasksPerfGraphDomOnce, logTasksPerfScrollOnce, logTasksPerfShellOnce, logTasksPerfSurfaceOnce,
    markTasksFrameProbe, rectSummary, tasksPerfContext, tasksPerfNow,
    tasksPerfScrollSnapshot, tasksPerfSurfaceSnapshot, tasksPerfWheelPayload, traceTasksInteractionFrame,
} from './tasks_diagnostics.js';
import { createTasksEdgeRenderer } from './tasks_edges.js';
import { createTasksFullscreenController } from './tasks_fullscreen.js';
import {
    buildTaskEdgeAnchors, isTasksEdgeInternalToSelection, isTasksEdgeLabelHoverDimmingActive, isTasksGraphNodeSelectable,
    isTasksUnspecifiedProjectionGroup, nearestTasksIncidentEdge, resolveTasksNodeImage, selectTasksGraphNodeIdsInPolygon,
    selectTasksGraphNodeIdsInRect, sizeTaskNode, tasksCenteredViewport, tasksEdgeLabelZForMode,
    tasksGraphDynamicMinZoom, tasksGraphNodeAbsoluteRect, tasksGraphNodeAllowsHover, tasksGraphNodeHitArea,
    tasksGraphNodeHitRect, tasksGraphPaint, tasksIconFilterGroups, tasksProjectionGroupByHierarchy,
    tasksReuseGraphElements,
} from './tasks_graph_core.js';
import {
    TASKS_DEFAULT_CARD_STATES, TASKS_GANTT_PROJECTION_ID, TASKS_PROJECTION_UNSPECIFIED_CONTENT_OPACITY_DEFAULT, TASKS_PROJECTION_UNSPECIFIED_LABEL,
    buildTasksCollapsedGraph, buildTasksEgoState, buildTasksProjectionConfigText, clampTasksEdgeOpacity,
    clampTasksProjectionDisplayOpacity, collapseOneGroupDepth, collectExpandedGroupsByDepth, collectTasksGroupDescendantIds,
    effectiveExpandedGroups, expandOneGroupDepth, normalizeTasksCardStates, normalizeTasksCheckedNodeIds,
    normalizeTasksFilterQuery, normalizeTasksGraphNodes, normalizeTasksGroupByDisabledKeys, normalizeTasksNodeNotes,
    normalizeTasksNodeStates, normalizeTasksSlideNotes, parseTasksProjectionConfigText, readTasksProjectionPrefsForModel,
    selectTasksAclViewerState, tasksAclViewerOptions, tasksCollectSearchMatches, tasksContextDiffSelectionIds,
    tasksCountFilterRules, tasksEdgeFilterNodeIds, tasksEdgesMatchingTypes, tasksEmptyFilterQuery,
    tasksExpandableNodeIds, tasksFilterHoverFocus, tasksFilterOptions, tasksFilterQueryHasRules,
    tasksGroupByPrefsDifferFromSchema, tasksHopSeedIds, tasksLogicalGraphStatsLabel, tasksLogicalNodeId,
    tasksMatchedSlideNodes, tasksModelNodeLabels, tasksModelSetting, tasksNeighborHopIds,
    tasksNodeMatchesAllFilters, tasksOrderedEdges, tasksProjectionConfigHasSidebarState, tasksProjectionLayout,
    tasksProjectionOptions, tasksProjectionPrefsKey, tasksProjectionSchemaPrefs, tasksPruneFilterQueryFields,
    tasksReferenceEdges, tasksSameIdSet, tasksSelectionClickKey, tasksVisibleReferenceEdges,
    toggleTasksFilterQueryValue, updateTasksNote,
} from './tasks_graph_model.js';
import {
    buildProjectedRootTasksGraph, buildTasksViewState, deriveSquishedExpandedLayout, layoutBaseTasksGraph,
    layoutExpandedGroups, readTasksDirection, tasksApplyEdgePairs, tasksFixedLayout,
    tasksIsFixedMode, tasksLayoutById, tasksLayoutChromeKinds, tasksMergeHandleLayouts,
} from './tasks_layouts.js';
import { createTasksNodeRenderer, renderTasksSequenceLaneCap } from './tasks_nodes.js';
import {
    TASKS_DONE_ACCENT, TASKS_EDGE_FOCUS_IN_COLOR, TASKS_EDGE_FOCUS_OUT_COLOR, TASKS_EDGE_FOCUS_Z,
    TASKS_EDGE_LABEL_BG, TASKS_EDGE_LABEL_FOCUS_Z, TASKS_EDGE_LABEL_SELECTED_Z, TASKS_EDGE_LABEL_TEXT,
    TASKS_EDGE_LABEL_Z, TASKS_EDGE_Z, TASKS_GROUP_BG, TASKS_GROUP_BG_ACTIVE,
    TASKS_GROUP_BG_Z, TASKS_GROUP_EXPANDED_BG, TASKS_GROUP_TITLE_BG, TASKS_GROUP_Z,
    TASKS_NEIGHBOR_Z_BOOST, TASKS_NODE_BG, TASKS_NODE_BG_ACTIVE, TASKS_NODE_BORDER,
    TASKS_SELECTED_Z_BOOST, TASKS_SEQUENCE_LABEL_LIFT, TASKS_TASK_Z, TASKS_TITLE_Z,
    logTasksColorDebug, normalizeTasksColorHierarchy, resolveTasksCollapsedGroupColor, resolveTasksEdgeColor,
    resolveTasksEdgeLabel, resolveTasksNodeColor, resolveTasksPreferredColorHierarchy, resolveTasksProjectionGroupDimensionColor,
    tasksApplyEdgeOpacity, tasksCardStateForNode, tasksColorOptions, tasksColorPaletteFor,
    tasksDefaultEdgeOpacity, tasksEdgeColorPaletteFor, tasksEdgeRecordId, tasksEdgeStrokeWidthForMode,
    tasksGroupBackground, tasksGroupIdsContainingSelection, tasksHoverFocusEdge, tasksHoverFocusNodeStyle,
    tasksNodeBackground, tasksNodeColorLevels, tasksNodeIsOverlaid, tasksProminentEdgeOpacity,
    tasksReferenceFlowEdge, tasksResolvedThemeColor, tasksUseColorOverlay,
} from './tasks_paint.js';
import { createTasksPanels } from './tasks_panels.js';
import {
    TASKS_EDGES_VISIBLE_KEY, TASKS_HOVER_CARD_MODES, TASKS_HOVER_CARD_MODE_KEY, buildTasksNodeNotesBackup,
    checkedNodeIdsFromStates, clearTasksGlobalToggle, downloadTasksNodeNotes, readTasksCheckedNodeIds,
    readTasksEdgesVisible, readTasksGlobalToggle, readTasksHoverCardMode, readTasksPrefs,
    readTasksStoredFlag, tasksNodeCardWidthKey, uploadTasksNodeNotes, writeTasksCheckedNodeIds,
    writeTasksGlobalToggle, writeTasksPrefs,
} from './tasks_preferences.js';
import { ensureTasksQueryBuilder, ensureTasksReactFlow } from './tasks_runtime.js';
import { createMomentumRunner, shortcutsSuspended, showVyasaToast } from '/static/page_shell.js';

initializeTasksDiagnostics();
window.__vyasaTasksPhaseLog?.('tasks-js:module-start');

function tasksSetEdgeLabelsVisible(visible) {
    document.documentElement.classList.toggle('vyasa-tasks-edge-labels-on', visible === true);
    return visible === true;
}
window.tasksSetEdgeLabelsVisible = tasksSetEdgeLabelsVisible;

const TASKS_EDGE_LABEL_FOCUS_FONT_SIZE = 16;
const TASKS_AUTO_FIT_ON_EXPAND_DEFAULT = false;
const TASKS_AUTO_FIT_ON_FILTER_DEFAULT = true;
// A share of the widget, not a pixel count, so the panel keeps its
// proportion on any screen. The 24px subtraction keeps the gutter.
const TASKS_FILTER_PANEL_WIDTH = '20%'; // default; `filter-panel-width` overrides it
const TASKS_NODE_CARD_CONTENT_SCALE = 1; // default; `node-card-content-scale` overrides it
const TASKS_PROJECTION_GROUP_OPACITY_DEFAULT = 12;
const TASKS_PROJECTION_UNSPECIFIED_GROUP_OPACITY_DEFAULT = 7;

const TASKS_GRAPH_MIN_ZOOM = 0.05;
// The graph sets no maxZoom, so this is React Flow's own default ceiling. Held-key
// zoom writes the viewport itself, so it has to stop at the same place the wheel does.
const TASKS_GRAPH_MAX_ZOOM = 2;
const TASKS_NODE_CONNECTION_HANDLES = {
    source: ['top', 'right', 'bottom', 'left'].flatMap((side) => [0, 1, 2].map((index) => ({ id: `source-${side}-${index}`, side, offsetPct: 50 }))),
    target: ['top', 'right', 'bottom', 'left'].flatMap((side) => [0, 1, 2].map((index) => ({ id: `target-${side}-${index}`, side, offsetPct: 50 }))),
};

// Chrome kinds are whatever the layouts declare. Adding a layout must not
// mean remembering to edit a set over here.
const TASKS_PASSIVE_NODE_KINDS = new Set(['ganttHeader', 'layoutError', ...tasksLayoutChromeKinds()]);
// A pack caption carries code references and [[node]] links, so the server
// renders it to HTML and parks that under `__rendered_attrs__`. A caption holder
// is anything that owns one: a slide, a view option, a context. An inline graph
// has no rendered copy, so the plain string stays the fallback.
const tasksCaptionElement = (holder, style, attr = 'caption') => {
    const rendered = holder?.__rendered_attrs__?.[attr] || '';
    const plain = String(holder?.[attr] || '');
    if (!rendered && !plain) return null;
    const props = { className: 'vyasa-task-slide-description', style };
    return rendered
        ? window.React.createElement('div', { ...props, dangerouslySetInnerHTML: { __html: rendered } })
        : window.React.createElement('div', props, plain);
};

const TASKS_SPACING_PRESETS = {
    compact: { nodeSpacing: 24, layerSpacing: 64, collisionGap: 56, groupPadding: 28, edgeLabelWidth: 220 },
    normal: { nodeSpacing: 44, layerSpacing: 96, collisionGap: 96, groupPadding: 40, edgeLabelWidth: 240 },
    airy: { nodeSpacing: 72, layerSpacing: 140, collisionGap: 132, groupPadding: 56, edgeLabelWidth: 280 },
    xl: { nodeSpacing: 96, layerSpacing: 180, collisionGap: 168, groupPadding: 72, edgeLabelWidth: 320 },
};

function readTasksNumber(value, fallback) {
    const parsed = Number.parseFloat(value || '');
    return Number.isFinite(parsed) ? parsed : fallback;
}

function readTasksLayoutConfig(wrapper) {
    const presetName = String(wrapper.dataset.tasksSpacing || 'normal').trim().toLowerCase();
    const preset = TASKS_SPACING_PRESETS[presetName] || TASKS_SPACING_PRESETS.normal;
    return {
        spacing: presetName,
        elkDirection: readTasksDirection(wrapper.dataset.tasksLayoutDirection),
        nodeSpacing: readTasksNumber(wrapper.dataset.tasksNodeSpacing, preset.nodeSpacing),
        layerSpacing: readTasksNumber(wrapper.dataset.tasksLayerSpacing, preset.layerSpacing),
        collisionGap: readTasksNumber(wrapper.dataset.tasksCollisionGap, preset.collisionGap),
        groupPadding: readTasksNumber(wrapper.dataset.tasksGroupPadding, preset.groupPadding),
        edgeLabelWidth: readTasksNumber(wrapper.dataset.tasksEdgeLabelWidth, preset.edgeLabelWidth),
    };
}

function readTasksColorMixConfig(wrapper) {
    const enabled = String(wrapper.dataset.tasksColorMix || 'true').trim().toLowerCase() !== 'false';
    const intensity = Math.max(0, Math.min(100, Number.parseFloat(wrapper.dataset.tasksColorMixIntensity || '22') || 22));
    return { enabled, intensity, paper: Math.max(0, 100 - intensity) };
}

// Every key the graph shortcut handler consumes. It stops these from reaching the
// document shortcuts while a graph is focused; anything absent here stays the
// document's key.
const TASKS_SHORTCUT_KEYS = new Set([
    'f', 'g', 's', 'e', 'c', 't', 'i', 'o', 'u', 'p',
    'h', 'j', 'k', 'l', 'v',
    '[', ']', 'enter',
    'arrowup', 'arrowdown', 'arrowleft', 'arrowright',
]);
// Growing and shrinking a selection by one hop, matched on the physical key rather
// than the character it produces. A text expander that fires on a typed sequence
// deletes the trigger and types its replacement, and those characters arrive as
// trusted key events carrying a placeholder code -- a '-' reaching the page as code
// 'Space'. Matching the code keeps injected text from driving the graph, and leaves
// Shift free: '+' is still code Equal and '_' is still code Minus.
const TASKS_HOP_GROW_CODES = new Set(['Equal', 'NumpadEqual', 'NumpadAdd']);
const TASKS_HOP_SHRINK_CODES = new Set(['Minus', 'NumpadSubtract']);
const isTasksHopCode = (code) => TASKS_HOP_GROW_CODES.has(code) || TASKS_HOP_SHRINK_CODES.has(code);
// Momentum speed is in pixels per millisecond, so zoom turns that distance into a
// factor: at the ceiling speed the graph doubles in about three quarters of a second.
const TASKS_ZOOM_MOMENTUM_RATE = 0.0007;

const TASKS_EDGE_LABELS_VISIBLE_KEY = 'vyasa:tasks:edge-labels-visible';

const TASKS_GROUP_HOVER_CARDS_KEY = 'vyasa:tasks:group-hover-cards';
const TASKS_HOVER_CARD_SCROLL_KEY = 'vyasa:tasks:hover-card-scroll';

const tasksCardOverscrollStates = new WeakMap();

function applyTasksCardOverscroll(card, unusedDelta) {
    const body = card.querySelector(':scope > .vyasa-tasks-card-scroll-body');
    if (!body || !unusedDelta) return;
    const current = tasksCardOverscrollStates.get(card) || { offset: 0, velocity: 0, frame: 0, edge: 1 };
    if (current.offset && Math.sign(current.offset) !== Math.sign(unusedDelta)) current.offset = 0;
    current.edge = Math.sign(unusedDelta);
    const resistance = 1 - Math.min(1, Math.abs(current.offset) / 56);
    current.offset = Math.max(-56, Math.min(56, current.offset + (unusedDelta * 0.28 * resistance)));
    current.velocity += unusedDelta * 0.015;
    const render = () => {
        const stretch = Math.max(0.96, 1 + ((current.offset * current.edge) / 420));
        body.style.transformOrigin = current.edge > 0 ? 'bottom center' : 'top center';
        body.style.transform = `scaleY(${stretch})`;
    };
    render();
    const step = () => {
        current.velocity += (-0.16 * current.offset) - (0.58 * current.velocity);
        current.offset += current.velocity;
        render();
        if (Math.abs(current.offset) < 0.08 && Math.abs(current.velocity) < 0.08) {
            body.style.removeProperty('transform');
            body.style.removeProperty('transform-origin');
            tasksCardOverscrollStates.delete(card);
            return;
        }
        current.frame = window.requestAnimationFrame(step);
    };
    if (!current.frame) current.frame = window.requestAnimationFrame(step);
    tasksCardOverscrollStates.set(card, current);
}

function nextTasksHoverCardMode(mode) {
    const index = TASKS_HOVER_CARD_MODES.indexOf(mode);
    if (index < 0) return 'rightRail';
    return TASKS_HOVER_CARD_MODES[(index + 1) % TASKS_HOVER_CARD_MODES.length];
}

function clampTasksHoverCardMode(mode, fallback = 'rightRail') {
    return TASKS_HOVER_CARD_MODES.includes(mode) ? mode : fallback;
}

function readTasksLayoutConfigForModel(wrapper, model) {
    const presetName = String(tasksModelSetting(model, 'spacing', wrapper.dataset.tasksSpacing || 'normal')).trim().toLowerCase();
    const preset = TASKS_SPACING_PRESETS[presetName] || TASKS_SPACING_PRESETS.normal;
    return {
        spacing: presetName,
        elkDirection: readTasksDirection(tasksModelSetting(model, 'layout_direction', wrapper.dataset.tasksLayoutDirection)),
        nodeSpacing: readTasksNumber(tasksModelSetting(model, 'node_spacing', wrapper.dataset.tasksNodeSpacing), preset.nodeSpacing),
        layerSpacing: readTasksNumber(tasksModelSetting(model, 'layer_spacing', wrapper.dataset.tasksLayerSpacing), preset.layerSpacing),
        collisionGap: readTasksNumber(tasksModelSetting(model, 'collision_gap', wrapper.dataset.tasksCollisionGap), preset.collisionGap),
        groupPadding: readTasksNumber(tasksModelSetting(model, 'group_padding', wrapper.dataset.tasksGroupPadding), preset.groupPadding),
        edgeLabelWidth: readTasksNumber(tasksModelSetting(model, 'edge_label_width', wrapper.dataset.tasksEdgeLabelWidth), preset.edgeLabelWidth),
    };
}

function readTasksColorMixConfigForModel(wrapper, model) {
    const enabled = String(tasksModelSetting(model, 'color_mix', wrapper.dataset.tasksColorMix || 'true')).trim().toLowerCase() !== 'false';
    const intensity = Math.max(0, Math.min(100, Number.parseFloat(tasksModelSetting(model, 'color_mix_intensity', wrapper.dataset.tasksColorMixIntensity || '22')) || 22));
    return { enabled, intensity, paper: Math.max(0, 100 - intensity) };
}

async function readTasksClipboardText() {
    try {
        return navigator.clipboard?.readText ? await navigator.clipboard.readText() : '';
    } catch {
        return '';
    }
}

function promptTasksViewInput(defaultContent = '') {
    if (typeof document === 'undefined') return Promise.resolve(null);
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(15,23,42,.38);display:grid;place-items:center;padding:18px;';
        overlay.innerHTML = `<form style="width:min(720px,100%);display:grid;gap:10px;padding:14px;border-radius:12px;background:var(--vyasa-paper,#fff);color:var(--vyasa-ink,#0f172a);box-shadow:0 18px 60px rgba(0,0,0,.28)">
            <strong style="font-size:13px">Add Knowledge Graph view</strong>
            <input name="title" required placeholder="View name" style="width:100%;box-sizing:border-box;padding:8px;border:1px solid currentColor;border-radius:8px;background:transparent;color:inherit">
            <textarea name="content" required placeholder="Paste copied kg.schema view here" style="width:100%;height:260px;box-sizing:border-box;padding:8px;border:1px solid currentColor;border-radius:8px;background:transparent;color:inherit;font:12px/1.4 ui-monospace,Menlo,monospace"></textarea>
            <div style="display:flex;justify-content:flex-end;gap:8px"><button type="button" data-cancel>Cancel</button><button type="submit">Add view</button></div>
        </form>`;
        document.body.appendChild(overlay);
        const form = overlay.querySelector('form');
        const title = form.elements.title;
        const content = form.elements.content;
        content.value = defaultContent || '';
        title.focus();
        const finish = (value) => {
            overlay.remove();
            resolve(value);
        };
        overlay.querySelector('[data-cancel]').addEventListener('click', () => finish(null));
        overlay.addEventListener('click', (event) => { if (event.target === overlay) finish(null); });
        form.addEventListener('submit', (event) => {
            event.preventDefault();
            finish({ title: title.value.trim(), content: content.value.trim() });
        });
    });
}

async function saveTasksTempView({ schemaPath, currentPath, title, content }) {
    const response = await fetch('/api/tasks/views', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schema_path: schemaPath, current_path: currentPath, title, content }),
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
}

async function loadTasksContext({ schemaPath, currentPath, contextId }) {
    const response = await fetch('/api/tasks/context', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schema_path: schemaPath, current_path: currentPath, context_id: contextId }),
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
}

async function loadTasksContextDiff({ schemaPath, contextId }) {
    const response = await fetch('/api/tasks/context-diff', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schema_path: schemaPath, context_id: contextId }),
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
}

function tasksFilterPanelMaxHeight(wrapper) {
    if (!wrapper) return '100%';
    const bounds = wrapper.getBoundingClientRect();
    const available = Math.max(220, Math.floor(bounds.height));
    return `${available}px`;
}

function tasksDefaultFiltersOpen(defaultFiltersOpen) {
    const wantsOpen = Boolean(defaultFiltersOpen);
    if (!wantsOpen || typeof window === 'undefined' || typeof window.matchMedia !== 'function') return wantsOpen;
    return !window.matchMedia('(max-width: 767px)').matches;
}

window.__vyasaTasksActions = window.__vyasaTasksActions || {};
window.__vyasaTasksConfig = window.__vyasaTasksConfig || {};

// Every message carries its hop number, the floor included, so undoing reads as a
// ladder: hop 3, hop 2, hop 1, hop 0. Without the zero the last step looks like a jump.
function tasksHopSelectionLabel(hopCount, size, restarted = false) {
    const nodes = `${size} node${size === 1 ? '' : 's'} selected`;
    if (!hopCount) return `Hop 0: back to the ${nodes}.`;
    return `Hop ${hopCount}${restarted ? ' of a new chain' : ''}: ${nodes}.`;
}

function tasksSelectionDebugPayload(selectedNodeId, selectedNodeIds, hoveredNodeId = '') {
    return {
        selectedNodeId: String(selectedNodeId || ''),
        selectedNodeIds: Array.from(selectedNodeIds || []).map((id) => String(id || '')).filter(Boolean),
        hoveredNodeId: String(hoveredNodeId || ''),
    };
}

const TASKS_ADD_VIEW_OPTION_ID = '__vyasa_add_view__';

function shouldAutoFitTasksOnExpand() {
    if (typeof window === 'undefined') return TASKS_AUTO_FIT_ON_EXPAND_DEFAULT;
    const override = window.__vyasaTasksConfig?.autoFitOnExpand;
    return typeof override === 'boolean' ? override : TASKS_AUTO_FIT_ON_EXPAND_DEFAULT;
}

function shouldAutoFitTasksOnFilter() {
    if (typeof window === 'undefined') return TASKS_AUTO_FIT_ON_FILTER_DEFAULT;
    const override = window.__vyasaTasksConfig?.autoFitOnFilter;
    return typeof override === 'boolean' ? override : TASKS_AUTO_FIT_ON_FILTER_DEFAULT;
}

window.runTasksHeaderAction = function(widgetId, action) {
    const actions = window.__vyasaTasksActions?.[widgetId];
    if (!actions || typeof actions[action] !== 'function') return;
    actions[action]();
};

function syncTasksToggleButtons(widgetId, action, emphasized, attribute, normalTitle, emphasizedTitle) {
    const id = String(widgetId || '');
    document.querySelectorAll(`button[data-vyasa-tasks-action="${action}"], button[onclick*="${action}"]`).forEach((button) => {
        const buttonWidgetId = button.getAttribute('data-vyasa-tasks-widget-id') || '';
        const onclick = button.getAttribute('onclick') || '';
        if (buttonWidgetId && buttonWidgetId !== id) return;
        if (!buttonWidgetId && !onclick.includes(`'${id}'`)) return;
        button.setAttribute('data-vyasa-tasks-widget-id', id);
        button.setAttribute('data-vyasa-tasks-action', action);
        if (emphasized) button.setAttribute(attribute, 'true');
        else button.removeAttribute(attribute);
        button.title = emphasized ? emphasizedTitle : normalTitle;
    });
}

function syncTasksEdgeToggleButtons(widgetId, edgesVisible) {
    syncTasksToggleButtons(widgetId, 'toggleEdges', !edgesVisible, 'data-vyasa-edges-off', 'Toggle edges', 'Edges are hidden (E)');
}

function syncTasksHoverCardToggleButtons(widgetId, hoverCardsEnabled) {
    syncTasksToggleButtons(widgetId, 'toggleHoverCards', !hoverCardsEnabled, 'data-vyasa-hover-cards-off', 'Toggle hover cards', 'Hover cards are hidden (H)');
}

function syncTasksCardScrollToggleButtons(widgetId, enabled) {
    syncTasksToggleButtons(widgetId, 'toggleCardScroll', enabled, 'data-vyasa-card-scroll-on', 'Toggle card scroll mode (V)', 'Card scroll mode is on (V)');
}

function paintTasksScene(scene, mount, graph, laidOut) {
    const nodeLabels = Object.fromEntries((graph.nodes || []).map((node) => [String(node.id || ''), String(node.label || node.id || '')]));
    const positions = Object.fromEntries((laidOut.children || []).map((n) => [n.id, n]));
    const lines = (laidOut.edges || []).map((e) => {
        const s = e.sections?.[0];
        if (!s) return '';
        const points = [s.startPoint, ...(s.bendPoints || []), s.endPoint];
        const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
        return `<path d="${d}" fill="none" stroke="currentColor" opacity="0.32" stroke-linejoin="round" stroke-linecap="round"/>`;
    }).join('');
    const cards = graph.nodes.map((n) => {
        const p = positions[n.id] || n;
        const bg = n.__kind__ === 'group' ? 'color-mix(in srgb, currentColor 6%, transparent)' : 'color-mix(in srgb, currentColor 10%, transparent)';
        const exp = n.__kind__ === 'group' ? '<div data-node-expander="true" style="position:absolute;right:10px;top:8px;font-size:18px;opacity:.55">+</div>' : '';
        const linkKinds = Array.from(tasksNodeLinkKinds(n));
        const linkIcon = linkKinds.length
            ? `<span class="vyasa-task-link-badge" aria-hidden="true" style="position:absolute;top:8px;right:${n.__kind__ === 'group' ? '32px' : '10px'}">${linkKinds.map((kind) => `<span uk-icon="${kind === 'external' ? 'link-external' : 'link'}"></span>`).join('')}</span>`
            : '';
        return `<div class="vyasa-task-card" data-node-id="${n.id}" data-node-kind="${n.__kind__}" style="position:absolute;left:${p.x}px;top:${p.y}px;width:${n.width}px;height:${n.height}px;border:1px solid color-mix(in srgb, currentColor 35%, transparent);border-radius:14px;background:${bg};display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:600;text-align:center;padding:8px;cursor:${n.__kind__ === 'group' ? 'pointer' : 'default'}"><span>${tasksInlineReferenceHtml(n.label, nodeLabels)}</span>${linkIcon}${exp}</div>`;
    }).join('');
    scene.style.width = `${Math.max(laidOut.width || 1200, mount.clientWidth)}px`;
    scene.style.height = `${Math.max(laidOut.height || 420, mount.clientHeight)}px`;
        scene.innerHTML = `<svg style="position:absolute;inset:0;width:${scene.style.width};height:${scene.style.height};overflow:visible;pointer-events:none">${lines}</svg>${cards}`;
}

function findTaskCardFromEvent(event) {
    const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
    for (const item of path) {
        if (item instanceof Element && item.dataset?.nodeId && item.dataset?.nodeKind === 'group') {
            return item;
        }
    }
    return null;
}

function setTasksGroupToggleHover(wrapper, groupId) {
    if (!wrapper) return;
    wrapper.querySelectorAll('[data-vyasa-group-toggle-hover="true"]').forEach((node) => {
        node.removeAttribute('data-vyasa-group-toggle-hover');
    });
    const id = String(groupId || '').trim();
    if (!id) return;
    const escape = window.CSS?.escape || ((value) => String(value).replace(/["\\]/g, '\\$&'));
    [`${id}`, `${id}__title`].forEach((nodeId) => {
        wrapper.querySelector(`.react-flow__node[data-id="${escape(nodeId)}"]`)?.setAttribute('data-vyasa-group-toggle-hover', 'true');
    });
}

function tasksGraphNodeAtFlowPoint(nodes, point) {
    const byId = Object.fromEntries((nodes || []).map((node) => [node.id, node]));
    return (nodes || [])
        // Chrome is passive: a band or a cell must never become the anchor for
        // an edge preview, because it has no incident edge and kills the hit.
        // A chrome kind that carries its own card is the exception, and it claims
        // a hit rect small enough not to shadow what it covers.
        .filter((node) => !TASKS_PASSIVE_NODE_KINDS.has(node.data?.__kind__)
            || isTasksGraphNodeSelectable(node.data?.__kind__))
        .map((node) => ({ node, rect: tasksGraphNodeHitRect(node, byId), z: Number(node.zIndex || node.style?.zIndex || 0) }))
        .filter(({ rect }) => point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height)
        .sort((a, b) => b.z - a.z)[0] || null;
}

function tasksBackgroundProps(widgetId) {
    const key = String(widgetId || 'tasks').trim() || 'tasks';
    return {
        id: `${key}-bg`,
        gap: 20,
        size: 1.2,
        color: 'color-mix(in srgb, var(--vyasa-primary) 18%, transparent)',
    };
}

function tasksFullscreenIconHtml(on = false) {
    return `<uk-icon icon="${on ? 'shrink' : 'expand'}" class="w-4 h-4"></uk-icon>`;
}

function syncTasksFullscreenButton(wrapper) {
    if (!wrapper?.id) return;
    const on = wrapper.getAttribute('data-tasks-maximized') === 'true';
    document.querySelectorAll(`[data-vyasa-tasks-fullscreen-toggle="${CSS.escape(wrapper.id)}"]`).forEach((button) => {
        button.innerHTML = tasksFullscreenIconHtml(on);
        button.title = on ? 'Exit fullscreen (Shift+F)' : 'Fullscreen (Shift+F)';
        button.setAttribute('aria-label', button.title);
    });
}

const { setTasksMaximized } = createTasksFullscreenController({
    syncTasksFullscreenButton,
});

function applyTasksStandaloneHeight(wrapper) {
    if (String(wrapper?.dataset?.tasksStandalone || '').toLowerCase() !== 'true') return;
    const box = wrapper.getBoundingClientRect();
    const boundary = wrapper.closest('.vyasa-main-shell') || wrapper.parentElement;
    const boundaryBox = boundary?.getBoundingClientRect?.();
    const viewportBottom = window.visualViewport?.height || window.innerHeight || 0;
    const bottom = boundaryBox?.height ? Math.min(boundaryBox.bottom, viewportBottom) : viewportBottom;
    const height = Math.max(420, Math.floor(bottom - box.top));
    wrapper.style.height = `${height}px`;
    if (!wrapper.__tasksStandaloneResize) {
        wrapper.__tasksStandaloneResize = () => applyTasksStandaloneHeight(wrapper);
        window.addEventListener('resize', wrapper.__tasksStandaloneResize);
    }
}

async function renderTasksGraphs(rootElement = document) {
    const wrappers = Array.from(rootElement.querySelectorAll('.tasks-container[data-tasks-widget="true"]'));
    if (!wrappers.length) return;
    const rf = await ensureTasksReactFlow();
    let needsRetry = false;
    for (const wrapper of wrappers) {
        if (wrapper.dataset.tasksMounted === 'true') continue;
        const mount = wrapper.querySelector('.vyasa-tasks-flow');
        if (!mount || !rf) continue;
        applyTasksStandaloneHeight(wrapper);
        syncTasksFullscreenButton(wrapper);
        if (wrapper.offsetParent === null || mount.clientWidth <= 0 || mount.clientHeight <= 0) {
            needsRetry = true;
            continue;
        }
        const initialSourceModel = JSON.parse(wrapper.dataset.tasksPayload || '{"groups":[],"tasks":[],"group_tree":{},"task_children":{},"dependency_edges":[]}');
        const initialSourceGraph = normalizeTasksGraphNodes(JSON.parse(wrapper.dataset.tasksGraph || '{"nodes":[],"edges":[]}'), initialSourceModel);
        const widgetId = wrapper.id;
        const defaultOpenDepth = Number.parseInt(wrapper.dataset.tasksDefaultOpenDepth || '0', 10);
        const ganttEnabled = String(wrapper.dataset.tasksGantt || '').trim().toLowerCase() === 'true';
        const defaultViewMode = ganttEnabled && String(wrapper.dataset.tasksDefaultView || '').trim().toLowerCase() === 'gantt' ? 'gantt' : 'graph';
        const defaultFiltersOpen = String(wrapper.dataset.tasksOpenFiltersDefault || '').trim().toLowerCase() === 'true';
        const initialEgoMode = String(wrapper.dataset.tasksEgo || '').trim().toLowerCase() === 'true';
        logTasksPerf('kg-widget', {
            widgetId,
            title: wrapper.dataset.tasksTitle || '',
            defaultOpenDepth,
            defaultViewMode,
            groups: (initialSourceModel.groups || []).length,
            tasks: (initialSourceModel.tasks || []).length,
            edges: (initialSourceModel.dependency_edges || []).length,
            graphNodes: (initialSourceGraph.nodes || []).length,
            graphEdges: (initialSourceGraph.edges || []).length,
            defaultProjection: initialSourceModel.default_projection || '',
            activeProjection: initialSourceModel.active_projection || '',
            defaultColorBy: initialSourceModel.default_color_by || '',
            projectionModels: Object.keys(initialSourceModel.projection_models || {}).length,
            viewProjections: Object.keys(initialSourceModel.view_projections || {}).length,
        });
        const TasksGraphApp = (props) => {
            const React = window.React;
            const Handle = rf.Handle;
            const NodeToolbar = rf.NodeToolbar;
            const Position = rf.Position;
            const markWidgetActive = React.useCallback(() => {
                window.__vyasaTasksActiveWidgetId = widgetId;
            }, []);
            const [sourceModel, setSourceModel] = React.useState(() => initialSourceModel);
            const [sourceGraph, setSourceGraph] = React.useState(() => initialSourceGraph);
            const nodeConnectionExperiment = sourceModel.graph_id === 'kg-node-connection-logic';
            const showDebugPositions = nodeConnectionExperiment || window.__vyasaTasksDebug.enabled;
            const [egoState, setEgoState] = React.useState(null);
            const egoMode = initialEgoMode || Boolean(egoState);
            const sourcePrefsRef = React.useRef(null);
            if (sourcePrefsRef.current === null) sourcePrefsRef.current = readTasksPrefs(sourceModel);
            const [activeAclViewer, setActiveAclViewer] = React.useState('');
            const aclViewerOptions = React.useMemo(() => egoMode ? [] : tasksAclViewerOptions(sourceModel), [egoMode, sourceModel]);
            const viewerState = React.useMemo(
                () => selectTasksAclViewerState(sourceModel, sourceGraph, activeAclViewer),
                [sourceModel, sourceGraph, activeAclViewer]
            );
            const contextOptions = React.useMemo(() => (
                Array.isArray(sourceModel?.kg_contexts) ? sourceModel.kg_contexts.filter((item) => item && item.id) : []
            ), [sourceModel]);
            const activeContextId = String(sourceModel?.kg_context?.id || '').trim();
            const activeContextIndex = contextOptions.findIndex((context) => context.id === activeContextId);
            const projectionOptions = React.useMemo(
                () => egoMode ? [] : tasksProjectionOptions(viewerState.model, ganttEnabled, activeContextId),
                [egoMode, viewerState.model, ganttEnabled, activeContextId]
            );
            const [contextLoading, setContextLoading] = React.useState(false);
            const [contextDiffEnabled, setContextDiffEnabled] = React.useState(false);
            const [contextDiffLoading, setContextDiffLoading] = React.useState(false);
            const [contextDiff, setContextDiff] = React.useState({ from: '', to: '', node_ids: [] });
            React.useEffect(() => {
                const schemaPath = String(sourceModel?.kg_schema || '').trim();
                if (!contextDiffEnabled || !schemaPath || !activeContextId || activeContextIndex <= 0) {
                    setContextDiff({ from: '', to: activeContextId, node_ids: [] });
                    return undefined;
                }
                let cancelled = false;
                setContextDiffLoading(true);
                loadTasksContextDiff({ schemaPath, contextId: activeContextId })
                    .then((payload) => {
                        if (cancelled) return;
                        setContextDiff(payload);
                        logTasksDebug('contextDiffLoaded', {
                            widgetId,
                            from: payload.from || '',
                            to: payload.to || activeContextId,
                            nodeIds: payload.node_ids || [],
                        });
                    })
                    .catch((error) => {
                        if (!cancelled) window.alert(error instanceof Error ? error.message : String(error));
                    })
                    .finally(() => {
                        if (!cancelled) setContextDiffLoading(false);
                    });
                return () => { cancelled = true; };
            }, [contextDiffEnabled, activeContextId, activeContextIndex, sourceModel?.kg_schema]);
            const storedProjectionPrefsRef = React.useRef(sourcePrefsRef.current?.projectionPrefs && typeof sourcePrefsRef.current.projectionPrefs === 'object'
                ? sourcePrefsRef.current.projectionPrefs
                : {});
            const defaultGroupByHierarchy = React.useMemo(() => (
                Array.isArray(sourceModel?.default_group_by)
                    ? sourceModel.default_group_by.map((key) => String(key || '').trim()).filter(Boolean)
                    : []
            ), [sourceModel]);
            const initialProjectionId = React.useMemo(() => {
                if (defaultViewMode === 'gantt') return TASKS_GANTT_PROJECTION_ID;
                // A reader who has chosen a view keeps it, so the pack's
                // `default_view` only decides the first visit. Presence, not
                // value, marks a stored choice: the base view's id is '', which
                // is also what no preference at all reads as, and the base
                // option is always in the list.
                const storedProjectionId = sourcePrefsRef.current?.projectionId;
                if (typeof storedProjectionId === 'string') {
                    const saved = storedProjectionId.trim();
                    if (projectionOptions.some((option) => option.id === saved)) return saved;
                }
                const declared = String(sourceModel?.default_projection || '').trim();
                if (projectionOptions.some((option) => option.id === declared)) return declared;
                return '';
            }, [projectionOptions, sourceModel]);
            const initialGraphProjectionId = initialProjectionId === TASKS_GANTT_PROJECTION_ID ? '' : initialProjectionId;
            const [activeProjectionId, setActiveProjectionId] = React.useState(initialGraphProjectionId);
            // `useState` keeps only the value from the first render, and on that
            // render the option list can still be empty -- the viewer model is
            // not resolved yet. Without this the widget locks onto the base view
            // and neither the saved preference nor `default_view` ever applies.
            const appliedInitialProjectionRef = React.useRef(false);
            React.useEffect(() => {
                if (appliedInitialProjectionRef.current) return;
                if (initialProjectionId === TASKS_GANTT_PROJECTION_ID) {
                    appliedInitialProjectionRef.current = true;
                    return;
                }
                if (!projectionOptions.some((option) => option.id === initialGraphProjectionId)) return;
                appliedInitialProjectionRef.current = true;
                if (initialGraphProjectionId === activeProjectionId) return;
                setActiveProjectionId(initialGraphProjectionId);
                setViewMode(tasksLayoutById(tasksProjectionLayout(sourceModel, initialGraphProjectionId))?.id || 'graph');
            }, [projectionOptions, initialProjectionId, initialGraphProjectionId, activeProjectionId, sourceModel]);
            const [viewMode, setViewMode] = React.useState(() => (
                (defaultViewMode === 'graph'
                    && tasksLayoutById(tasksProjectionLayout(sourceModel, initialGraphProjectionId))?.id)
                    || defaultViewMode
            ));
            const initialProjectionPrefs = React.useMemo(
                () => readTasksProjectionPrefsForModel(sourceModel, { ...sourcePrefsRef.current, projectionPrefs: storedProjectionPrefsRef.current }, initialGraphProjectionId),
                [sourceModel, initialGraphProjectionId]
            );
            const [groupByHierarchy, setGroupByHierarchy] = React.useState(() => (
                Array.isArray(initialProjectionPrefs?.groupByHierarchy) ? initialProjectionPrefs.groupByHierarchy : defaultGroupByHierarchy
            ));
            const [groupByEnabled, setGroupByEnabled] = React.useState(() => (
                typeof initialProjectionPrefs?.groupByEnabled === 'boolean'
                    ? initialProjectionPrefs.groupByEnabled
                    : defaultGroupByHierarchy.some(Boolean)
            ));
            const [groupByDisabledKeys, setGroupByDisabledKeys] = React.useState(() => normalizeTasksGroupByDisabledKeys(initialProjectionPrefs?.groupByDisabledKeys));
            const groupByDisabledSet = React.useMemo(() => new Set(groupByDisabledKeys), [groupByDisabledKeys]);
            const activeGroupByHierarchy = React.useMemo(
                () => groupByEnabled ? groupByHierarchy.filter((key) => key && !groupByDisabledSet.has(key)) : [],
                [groupByEnabled, groupByHierarchy, groupByDisabledSet]
            );
            const baseProjectionState = React.useMemo(
                () => buildTasksViewState(viewerState.model, viewerState.graph, activeProjectionId, viewMode, groupByEnabled, activeGroupByHierarchy, initialEgoMode),
                [viewerState, activeProjectionId, viewMode, groupByEnabled, activeGroupByHierarchy]
            );
            const projectionState = egoState || baseProjectionState;
            const model = projectionState.model;
            const effectiveDefaultOpenDepth = Number.parseInt(tasksModelSetting(model, 'default_open_depth', `${defaultOpenDepth}`), 10);
            const jitterConfig = React.useMemo(() => ({
                x: Number.parseFloat(tasksModelSetting(model, 'jitter', wrapper.dataset.tasksJitter || '0')),
                y: Number.parseFloat(tasksModelSetting(model, 'jitter_y', wrapper.dataset.tasksJitterY || wrapper.dataset.tasksJitter || '0')),
            }), [model]);
            const layoutConfig = React.useMemo(() => readTasksLayoutConfigForModel(wrapper, model), [model]);
            const configuredNodeCardWidth = String(tasksModelSetting(model, 'node-card-width', wrapper.dataset.tasksNodeCardWidth || '20%')).trim() || '20%';
            // A drag on the rail handle overrides the frontmatter width for this
            // graph only. Percent, not pixels, so a window resize stays sane.
            const nodeCardWidthKey = tasksNodeCardWidthKey(model);
            const [nodeCardWidthOverride, setNodeCardWidthOverride] = React.useState(null);
            React.useEffect(() => {
                const stored = nodeCardWidthKey ? readTasksGlobalToggle(nodeCardWidthKey) : null;
                setNodeCardWidthOverride(/^\d+(\.\d+)?%$/.test(String(stored || '')) ? stored : null);
            }, [nodeCardWidthKey]);
            const applyNodeCardWidth = (value) => {
                setNodeCardWidthOverride(value);
                if (!nodeCardWidthKey) return;
                if (value) writeTasksGlobalToggle(nodeCardWidthKey, value);
                else clearTasksGlobalToggle(nodeCardWidthKey);
            };
            const nodeCardWidth = nodeCardWidthOverride || configuredNodeCardWidth;
            const filterPanelWidthSetting = String(tasksModelSetting(model, 'filter-panel-width', wrapper.dataset.tasksFilterPanelWidth || TASKS_FILTER_PANEL_WIDTH)).trim() || TASKS_FILTER_PANEL_WIDTH;
            // How many card widths the details body is drawn at. Sideways scroll
            // pans across it, so a narrow card can still hold wide content.
            const nodeCardContentScale = Math.max(1, Number(
                tasksModelSetting(model, 'node-card-content-scale', wrapper.dataset.tasksNodeCardContentScale || TASKS_NODE_CARD_CONTENT_SCALE)
            ) || TASKS_NODE_CARD_CONTENT_SCALE);
            const hoverFontSize = String(tasksModelSetting(model, 'hover-font-size', wrapper.dataset.tasksHoverFontSize || '12px')).trim() || '12px';
            const colorMix = readTasksColorMixConfigForModel(wrapper, model);
            const projectionGroupOpacity = Math.max(0, Math.min(100, Number.parseFloat(tasksModelSetting(model, 'projection-group-opacity', wrapper.dataset.tasksProjectionGroupOpacity || `${TASKS_PROJECTION_GROUP_OPACITY_DEFAULT}`)) || TASKS_PROJECTION_GROUP_OPACITY_DEFAULT));
            const projectionUnspecifiedGroupOpacity = Math.max(0, Math.min(100, Number.parseFloat(tasksModelSetting(model, 'projection-unspecified-group-opacity', wrapper.dataset.tasksProjectionUnspecifiedGroupOpacity || `${TASKS_PROJECTION_UNSPECIFIED_GROUP_OPACITY_DEFAULT}`)) || TASKS_PROJECTION_UNSPECIFIED_GROUP_OPACITY_DEFAULT));
            const defaultProjectionUnspecifiedContentOpacity = clampTasksProjectionDisplayOpacity(tasksModelSetting(model, 'projection-unspecified-content-opacity', wrapper.dataset.tasksProjectionUnspecifiedContentOpacity || `${TASKS_PROJECTION_UNSPECIFIED_CONTENT_OPACITY_DEFAULT}`));
            const projectionGroupExpandedOpacity = 0;
            const projectionUnspecifiedGroupExpandedOpacity = 0;
            const baseRawGraph = React.useMemo(
                () => normalizeTasksGraphNodes(baseProjectionState.graph || { nodes: [], edges: [] }, baseProjectionState.model),
                [baseProjectionState]
            );
            const rawGraph = React.useMemo(
                () => egoState
                    ? normalizeTasksGraphNodes(egoState.graph || { nodes: [], edges: [] }, egoState.model)
                    : baseRawGraph,
                [egoState, baseRawGraph]
            );
            const initialExpandedSet = React.useMemo(
                () => collectExpandedGroupsByDepth(model.group_tree, Number.isNaN(effectiveDefaultOpenDepth) ? 0 : effectiveDefaultOpenDepth),
                [model, effectiveDefaultOpenDepth]
            );
            React.useEffect(() => {
                logTasksDebug('kg-default-view-state', {
                    widgetId,
                    sourceDefaultGroupBy: Array.isArray(sourceModel?.default_group_by) ? sourceModel.default_group_by : [],
                    defaultGroupByHierarchy,
                    sourceDefaultColorBy: sourceModel?.default_color_by || '',
                    storedProjectionId: sourcePrefsRef.current?.projectionId || '',
                    storedGroupByEnabled: sourcePrefsRef.current?.groupByEnabled,
                    storedGroupByHierarchy: Array.isArray(sourcePrefsRef.current?.groupByHierarchy) ? sourcePrefsRef.current.groupByHierarchy : null,
                    activeProjectionId,
                    viewMode,
                    groupByEnabled,
                    groupByHierarchy,
                    groupByDisabledKeys,
                    activeGroupByHierarchy,
                    projectionStateId: projectionState.projectionId || '',
                    modelActiveProjection: model?.active_projection || '',
                    modelGroups: (model.groups || []).length,
                    modelTasks: (model.tasks || []).length,
                    modelDefaultColorBy: model?.default_color_by || '',
                    graphNodes: (rawGraph.nodes || []).length,
                    graphEdges: (rawGraph.edges || []).length,
                });
                logTasksPerf('kg-expanded', {
                    widgetId,
                    graphId: model?.graph_id || '',
                    activeProjectionId,
                    viewMode,
                    groupByEnabled,
                    activeGroupByHierarchy,
                    groups: (model.groups || []).length,
                    tasks: (model.tasks || []).length,
                    edges: (model.dependency_edges || []).length,
                    defaultOpenDepth: effectiveDefaultOpenDepth,
                    initialExpandedCount: initialExpandedSet.size,
                    initialExpandedIds: Array.from(initialExpandedSet),
                });
            }, [model, activeProjectionId, viewMode, groupByEnabled, activeGroupByHierarchy, effectiveDefaultOpenDepth, initialExpandedSet]);
            const baseLayoutRef = React.useRef(null);
            const groupLayoutsRef = React.useRef({});
            const graphBaseRef = React.useRef({ nodes: [], edges: [] });
            const referenceEdgesRef = React.useRef([]);
            const flowWrapperRef = React.useRef(null);
            const filterPanelRef = React.useRef(null);
            const focusedNodePulseRef = React.useRef({ element: null, timer: 0 });
            React.useEffect(() => () => {
                window.clearTimeout(focusedNodePulseRef.current.timer);
                focusedNodePulseRef.current.element?.classList.remove('vyasa-tasks-pulse');
            }, []);
            const nodeReferenceKeyHeldRef = React.useRef(false);
            React.useEffect(() => {
                const syncNodeReferenceModifier = (event) => {
                    if (event.type !== 'blur' && String(event.key || '').toLowerCase() !== 'd') return;
                    const target = event.target instanceof Element ? event.target : null;
                    const editing = target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
                    const held = event.type === 'keydown' && !editing;
                    nodeReferenceKeyHeldRef.current = held;
                    flowWrapperRef.current?.classList.toggle(
                        'vyasa-tasks-node-reference-modifier',
                        held
                    );
                };
                window.addEventListener('keydown', syncNodeReferenceModifier, true);
                window.addEventListener('keyup', syncNodeReferenceModifier, true);
                window.addEventListener('blur', syncNodeReferenceModifier, true);
                return () => {
                    window.removeEventListener('keydown', syncNodeReferenceModifier, true);
                    window.removeEventListener('keyup', syncNodeReferenceModifier, true);
                    window.removeEventListener('blur', syncNodeReferenceModifier, true);
                    flowWrapperRef.current?.classList.remove('vyasa-tasks-node-reference-modifier');
                };
            }, []);
            const [graphRevision, setGraphRevision] = React.useState(0);
            const projectionPrefs = React.useMemo(
                () => readTasksProjectionPrefsForModel(sourceModel, { ...sourcePrefsRef.current, projectionPrefs: storedProjectionPrefsRef.current }, activeProjectionId),
                [sourceModel, activeProjectionId]
            );
            const hydrateExpandedSet = React.useCallback((prefs) => {
                const validIds = tasksExpandableNodeIds(model);
                if (model.active_projection === '__custom_group_by__') return new Set(initialExpandedSet);
                const saved = Array.isArray(prefs?.expandedGroupIds) ? prefs.expandedGroupIds : null;
                if (saved) return new Set(saved.filter((id) => validIds.has(id)));
                return new Set(initialExpandedSet);
            }, [model, initialExpandedSet]);
            const [expanded, setExpanded] = React.useState(() => egoMode ? tasksExpandableNodeIds(model) : hydrateExpandedSet(projectionPrefs));
            const [selectedNodeId, setSelectedNodeId] = React.useState(null);
            const [selectedNodeIds, setSelectedNodeIds] = React.useState(() => new Set());
            const selectedNodeIdRef = React.useRef(null);
            const selectedNodeIdsRef = React.useRef(new Set());
            const [selectedEdgeId, setSelectedEdgeId] = React.useState(null);
            const selectedEdgeIdRef = React.useRef(null);
            const [edgeCardOpen, setEdgeCardOpen] = React.useState(false);
            const [edgeCardField, setEdgeCardField] = React.useState('');
            const [edgeCardError, setEdgeCardError] = React.useState('');
            const [edgeStatus, setEdgeStatus] = React.useState('');
            const edgeCycleNodeIdRef = React.useRef('');
            const optionEdgeNodeIdRef = React.useRef('');
            const optionEdgePreviewHeldRef = React.useRef(false);
            const optionEdgeOtherNodeIdRef = React.useRef('');
            const optionEdgeNodeCardHeldRef = React.useRef(false);
            const [optionEdgeNodeCardId, setOptionEdgeNodeCardId] = React.useState(null);
            const optionEdgePinnedRef = React.useRef(false);
            // The live code-mode preview, owned by the A effect below. The W edge
            // mode reads it so that W + A + Enter pins the code preview instead of
            // the edge: A is the newer hold, so it claims Enter.
            const codeModeEntryRef = React.useRef(null);
            const edgePinBloomIdRef = React.useRef(0);
            const [edgePinBloom, setEdgePinBloom] = React.useState(null);
            const contextDiffSelectionRef = React.useRef({ key: '', ids: new Set() });
            const [dragSelection, setDragSelection] = React.useState(null);
            const [hoveredNodeId, setHoveredNodeId] = React.useState(null);
            // The keydown handler does not re-register on hover, so shortcuts read
            // the hovered node from this ref rather than the stale closure value.
            const hoveredNodeIdRef = React.useRef(null);
            hoveredNodeIdRef.current = hoveredNodeId;
            const [groupHoverTooltip, setGroupHoverTooltip] = React.useState(null);
            const groupHoverTooltipRef = React.useRef(null);
            groupHoverTooltipRef.current = groupHoverTooltip;
            const detailCardRef = React.useRef(null);
            const focusDetailCard = React.useCallback(() => {
                window.requestAnimationFrame(() => detailCardRef.current?.focus());
            }, []);
            const selectNodeCard = React.useCallback((sourceNodeId, nodeId, kind, focusCard = false) => {
                logTasksDebug('selectionSetNode', {
                    widgetId,
                    sourceNodeId,
                    nodeId,
                    kind,
                    ...tasksSelectionDebugPayload(selectedNodeIdRef.current, selectedNodeIdsRef.current, hoveredNodeIdRef.current),
                });
                markWidgetActive();
                selectedEdgeIdRef.current = null;
                optionEdgeNodeIdRef.current = '';
                setSelectedEdgeId(null);
                setSelectedEdgeRecord(null);
                setEdgeCardOpen(false);
                selectedNodeIdRef.current = sourceNodeId;
                selectedNodeIdsRef.current = new Set();
                if (focusCard) focusDetailCard();
                setSelectedNodeId(sourceNodeId);
                setSelectedNodeIds(new Set());
                setHoveredNodeId(null);
            }, [focusDetailCard, markWidgetActive, widgetId]);
            const [hoverCardScrollMode, setHoverCardScrollMode] = React.useState(
                () => readTasksGlobalToggle(TASKS_HOVER_CARD_SCROLL_KEY) === 'true'
            );
            const hoverCardScrollRef = React.useRef(null);
            const detailCardScrollRef = React.useRef(null);
            const setHoverCardScrollModeGlobal = React.useCallback((update) => {
                setHoverCardScrollMode((current) => {
                    const next = Boolean(typeof update === 'function' ? update(current) : update);
                    writeTasksGlobalToggle(TASKS_HOVER_CARD_SCROLL_KEY, next);
                    logTasksDebug('hoverCardScrollMode', { widgetId, enabled: next });
                    return next;
                });
            }, [widgetId]);
            const [helpOpen, setHelpOpen] = React.useState(false);
            const slides = React.useMemo(() => {
                const list = Array.isArray(baseProjectionState.model?.slides) ? baseProjectionState.model.slides : [];
                return list.filter((slide) => slide && Array.isArray(slide.nodes) && slide.nodes.length);
            }, [baseProjectionState.model]);
            const [slideIndex, setSlideIndex] = React.useState(-1);
            const [slideFocusMode, setSlideFocusMode] = React.useState('off'); // 'off' | 'eg' | 'egplus'
            React.useEffect(() => {
                setSlideIndex((index) => index < 0 ? -1 : (slides.length ? 0 : -1));
                if (!slides.length) setSlideFocusMode('off');
            }, [activeProjectionId, slides]);
            React.useEffect(() => {
                const slide = slideIndex >= 0 ? slides[slideIndex] : null;
                if (!slide) return;
                const ids = new Set((slide.nodes || []).map((id) => String(id || '').trim()).filter(Boolean));
                selectedNodeIdRef.current = null;
                selectedNodeIdsRef.current = new Set(ids);
                setSelectedNodeId(null);
                setSelectedNodeIds(new Set(ids));
            }, [slideIndex, slides]);
            React.useEffect(() => {
                const slide = slideIndex >= 0 ? slides[slideIndex] : null;
                if (!slide) return;
                const ids = new Set((slide.nodes || []).map((id) => String(id || '').trim()).filter(Boolean));
                const timer = window.setTimeout(() => {
                    const reactFlow = reactFlowApiRef.current;
                    const matched = tasksMatchedSlideNodes(slides, slideIndex, graphBaseRef.current.nodes);
                    logTasksDebug('slideFocusFit', {
                        widgetId,
                        slideIndex,
                        graphRevision,
                        requestedNodeCount: ids.size,
                        matchedNodeCount: matched.length,
                        graphReady: Boolean(reactFlow),
                    });
                    if (reactFlow && matched.length) reactFlow.fitView({ nodes: matched, duration: 400, padding: 0.3, includeHiddenNodes: true });
                }, 80);
                return () => window.clearTimeout(timer);
            }, [slideIndex, slides, graphRevision]);
            // Sticky EG/EG+ focus: rebuild the current graph whenever the slide or mode changes.
            React.useEffect(() => {
                if (initialEgoMode) return;
                if (slideFocusMode === 'off') {
                    window.__vyasaTasksActions?.[widgetId]?.closeEgo?.();
                    return;
                }
                const slide = slideIndex >= 0 ? slides[slideIndex] : null;
                if (!slide || !Array.isArray(slide.nodes) || !slide.nodes.length) return;
                const timer = window.setTimeout(() => {
                    window.__vyasaTasksActions?.[widgetId]?.openEgo?.(
                        slideFocusMode === 'egplus', slide.nodes, true, () => setSlideFocusMode('off')
                    );
                }, 70);
                return () => window.clearTimeout(timer);
            }, [slideFocusMode, slideIndex, slides]);
            const [activeFilters, setActiveFilters] = React.useState(() => egoMode ? {} : (
                projectionPrefs?.filters && typeof projectionPrefs.filters === 'object'
                    ? normalizeTasksFilterQuery(projectionPrefs.filters)
                    : tasksEmptyFilterQuery()
            ));
            const [activeSwatchFilters, setActiveSwatchFilters] = React.useState(() => egoMode ? {} : (
                projectionPrefs?.swatchFilters && typeof projectionPrefs.swatchFilters === 'object'
                    ? normalizeTasksFilterQuery(projectionPrefs.swatchFilters)
                    : tasksEmptyFilterQuery()
            ));
            const [activeEdgeTypes, setActiveEdgeTypes] = React.useState(() => egoMode ? [] : (
                Array.isArray(projectionPrefs?.edgeTypes)
                    ? projectionPrefs.edgeTypes.map(String).filter(Boolean)
                    : []
            ));
            const [edgeTypeFilterEnabled, setEdgeTypeFilterEnabled] = React.useState(() => (
                !egoMode && projectionPrefs?.edgeTypeFilterEnabled !== false
            ));
            const effectiveEdgeTypes = React.useMemo(
                () => egoMode || !edgeTypeFilterEnabled ? [] : activeEdgeTypes,
                [egoMode, edgeTypeFilterEnabled, activeEdgeTypes]
            );
            const effectiveSwatchFilters = React.useMemo(
                () => egoMode ? tasksEmptyFilterQuery() : activeSwatchFilters,
                [egoMode, activeSwatchFilters]
            );
            const [edgeTypeQuery, setEdgeTypeQuery] = React.useState('');
            const [edgeTypeMenuOpen, setEdgeTypeMenuOpen] = React.useState(false);
            React.useEffect(() => {
                selectedNodeIdRef.current = selectedNodeId;
            }, [selectedNodeId]);
            React.useEffect(() => {
                selectedNodeIdsRef.current = new Set(selectedNodeIds);
            }, [selectedNodeIds]);
            React.useEffect(() => {
                selectedEdgeIdRef.current = selectedEdgeId;
            }, [selectedEdgeId]);
            React.useEffect(() => {
                const owned = contextDiffSelectionRef.current;
                if (!contextDiffEnabled) {
                    const current = selectedNodeIdsRef.current;
                    const stillOwned = !selectedNodeIdRef.current
                        && current.size === owned.ids.size
                        && Array.from(current).every((id) => owned.ids.has(id));
                    if (stillOwned && owned.key) {
                        selectedNodeIdsRef.current = new Set();
                        setSelectedNodeIds(new Set());
                    }
                    contextDiffSelectionRef.current = { key: '', ids: new Set() };
                    return;
                }
                if (contextDiffLoading || contextDiff.to !== activeContextId) return;
                const changedIds = new Set((contextDiff.node_ids || []).map(String));
                const key = `${activeContextId}:${activeProjectionId}:${Array.from(changedIds).sort().join(',')}`;
                if (owned.key === key) return;
                const nextIds = tasksContextDiffSelectionIds(model, graphBaseRef.current.nodes, changedIds);
                if (changedIds.size && !nextIds.size && !graphBaseRef.current.nodes.length) return;
                contextDiffSelectionRef.current = { key, ids: nextIds };
                selectedNodeIdRef.current = null;
                selectedNodeIdsRef.current = nextIds;
                setSelectedNodeId(null);
                setSelectedNodeIds(new Set(nextIds));
                logTasksDebug('contextDiffSelected', { widgetId, changedIds: Array.from(changedIds), selectedIds: Array.from(nextIds) });
            }, [contextDiffEnabled, contextDiffLoading, contextDiff, activeContextId, activeProjectionId, model, graphRevision, widgetId]);
            React.useEffect(() => {
                logTasksPerfShellOnce(widgetId, wrapper, tasksPerfContext(widgetId, flowWrapperRef.current || wrapper, model, graphBaseRef.current));
                logTasksPerfSurfaceOnce(widgetId, flowWrapperRef.current || wrapper, tasksPerfContext(widgetId, flowWrapperRef.current || wrapper, model, graphBaseRef.current));
                logTasksPerfGraphDomOnce(widgetId, flowWrapperRef.current || wrapper, tasksPerfContext(widgetId, flowWrapperRef.current || wrapper, model, graphBaseRef.current));
                logTasksPerfScrollOnce(widgetId, flowWrapperRef.current || wrapper, tasksPerfContext(widgetId, flowWrapperRef.current || wrapper, model, graphBaseRef.current));
            }, [widgetId, model]);
            React.useEffect(() => {
                logTasksDebug('selectionStateCommit', {
                    widgetId,
                    activeWidgetId: String(window.__vyasaTasksActiveWidgetId || ''),
                    ...tasksSelectionDebugPayload(selectedNodeId, selectedNodeIds, hoveredNodeId),
                });
            }, [widgetId, selectedNodeId, selectedNodeIds, hoveredNodeId]);
            const [searchQuery, setSearchQuery] = React.useState(() => egoMode ? '' : (
                typeof projectionPrefs?.searchQuery === 'string' ? projectionPrefs.searchQuery : ''
            ));
            const [searchInputValue, setSearchInputValue] = React.useState(() => egoMode ? '' : (
                typeof projectionPrefs?.searchQuery === 'string' ? projectionPrefs.searchQuery : ''
            ));
            const [nodeNotes, setNodeNotes] = React.useState(() => normalizeTasksNodeNotes(sourcePrefsRef.current?.nodeNotes));
            const [edgeNotes, setEdgeNotes] = React.useState(() => normalizeTasksNodeNotes(sourcePrefsRef.current?.edgeNotes));
            const [slideNotes, setSlideNotes] = React.useState(() => normalizeTasksSlideNotes(sourcePrefsRef.current?.slideNotes));
            const [activeColorHierarchy, setActiveColorHierarchy] = React.useState(() => (
                resolveTasksPreferredColorHierarchy(model, activeProjectionId, projectionPrefs, nodeNotes)
            ));
            const [filtersCollapsed, setFiltersCollapsed] = React.useState(() => {
                if (typeof projectionPrefs?.filtersCollapsed === 'boolean') return projectionPrefs.filtersCollapsed;
                return !tasksDefaultFiltersOpen(defaultFiltersOpen);
            });
            const [queryBuilderEnabled, setQueryBuilderEnabled] = React.useState(() => (
                typeof projectionPrefs?.queryBuilderEnabled === 'boolean' ? projectionPrefs.queryBuilderEnabled : true
            ));
            const [searchEnabled, setSearchEnabled] = React.useState(() => (
                typeof projectionPrefs?.searchEnabled === 'boolean' ? projectionPrefs.searchEnabled : true
            ));
            const [edgesVisible, setEdgesVisible] = React.useState(() => {
                const stored = readTasksEdgesVisible();
                if (stored !== null) return stored;
                return typeof projectionPrefs?.edgesVisible === 'boolean' ? projectionPrefs.edgesVisible : true;
            });
            // Shift+E hides the words on every row and leaves the lines. A dense
            // view reads as shape once the text is off, and the reader can still
            // ask for one row's words by hovering it or holding W.
            const [edgeLabelsVisible, setEdgeLabelsVisible] = React.useState(() => {
                const stored = readTasksStoredFlag(TASKS_EDGE_LABELS_VISIBLE_KEY);
                return stored === null ? true : stored;
            });
            const setEdgeLabelsVisibleGlobal = React.useCallback((update) => {
                setEdgeLabelsVisible((current) => {
                    const next = Boolean(typeof update === 'function' ? update(current) : update);
                    writeTasksGlobalToggle(TASKS_EDGE_LABELS_VISIBLE_KEY, next);
                    return next;
                });
            }, []);
            const [hoverInactiveNodes, setHoverInactiveNodes] = React.useState(() => (
                typeof projectionPrefs?.hoverInactiveNodes === 'boolean' ? projectionPrefs.hoverInactiveNodes : true
            ));
            const [hoverCardMode, setHoverCardMode] = React.useState(() => {
                const stored = readTasksHoverCardMode();
                if (stored) return stored;
                if (TASKS_HOVER_CARD_MODES.includes(projectionPrefs?.hoverCardMode)) return projectionPrefs.hoverCardMode;
                if (projectionPrefs?.hoverCardsEnabled === false) return 'off';
                return 'rightRail';
            });
            // The E and H toggles write what they set, so the next graph on this
            // server opens the same way. Every other write path stays local.
            const setEdgesVisibleGlobal = React.useCallback((update) => {
                setEdgesVisible((current) => {
                    const next = Boolean(typeof update === 'function' ? update(current) : update);
                    writeTasksGlobalToggle(TASKS_EDGES_VISIBLE_KEY, next);
                    return next;
                });
            }, []);
            const setHoverCardModeGlobal = React.useCallback((update) => {
                setHoverCardMode((current) => {
                    const next = clampTasksHoverCardMode(typeof update === 'function' ? update(current) : update);
                    writeTasksGlobalToggle(TASKS_HOVER_CARD_MODE_KEY, next);
                    return next;
                });
            }, []);
            const hoverCardsEnabled = hoverCardMode !== 'off';
            const [groupHoverCardsEnabled, setGroupHoverCardsEnabled] = React.useState(
                () => readTasksGlobalToggle(TASKS_GROUP_HOVER_CARDS_KEY) !== 'false'
            );
            const setGroupHoverCardsEnabledGlobal = React.useCallback((update) => {
                setGroupHoverCardsEnabled((current) => {
                    const next = Boolean(typeof update === 'function' ? update(current) : update);
                    writeTasksGlobalToggle(TASKS_GROUP_HOVER_CARDS_KEY, next);
                    showVyasaToast(`Group hover cards ${next ? 'on' : 'off'}`);
                    return next;
                });
            }, []);
            // The toolbar button is still show/hide, so it needs to know which
            // placement to come back to.
            const lastHoverCardPlacementRef = React.useRef('rightRail');
            if (hoverCardsEnabled) lastHoverCardPlacementRef.current = hoverCardMode;
            React.useEffect(() => {
                syncTasksEdgeToggleButtons(widgetId, edgesVisible);
            }, [widgetId, edgesVisible]);
            React.useEffect(() => {
                syncTasksHoverCardToggleButtons(widgetId, hoverCardsEnabled);
                logTasksDebug('hoverCardsState', { widgetId, egoMode, enabled: hoverCardsEnabled, mode: hoverCardMode });
            }, [widgetId, egoMode, hoverCardsEnabled, hoverCardMode]);
            React.useEffect(() => {
                syncTasksCardScrollToggleButtons(widgetId, hoverCardScrollMode);
            }, [widgetId, hoverCardScrollMode]);
            const defaultEdgeOpacity = React.useMemo(
                () => tasksDefaultEdgeOpacity((sourceModel?.dependency_edges || []).length),
                [sourceModel]
            );
            const [edgeOpacity, setEdgeOpacity] = React.useState(() => (
                projectionPrefs?.edgeOpacity !== undefined ? projectionPrefs.edgeOpacity
                    : (sourcePrefsRef.current?.edgeOpacity === undefined ? defaultEdgeOpacity : clampTasksEdgeOpacity(sourcePrefsRef.current.edgeOpacity))
            ));
            const [projectionUnspecifiedContentOpacity, setProjectionUnspecifiedContentOpacity] = React.useState(() => (
                projectionPrefs?.unspecifiedContentOpacity !== undefined
                    ? projectionPrefs.unspecifiedContentOpacity
                    : sourcePrefsRef.current?.unspecifiedContentOpacity === undefined
                    ? defaultProjectionUnspecifiedContentOpacity
                    : clampTasksProjectionDisplayOpacity(sourcePrefsRef.current.unspecifiedContentOpacity)
            ));
            const cardStates = React.useMemo(() => normalizeTasksCardStates(sourceModel), [sourceModel]);
            const [nodeStates, setNodeStates] = React.useState(() => {
                const stableCheckedNodeIds = readTasksCheckedNodeIds(sourceModel);
                const storedStates = normalizeTasksNodeStates(sourcePrefsRef.current?.nodeStates, cardStates);
                if (Object.keys(storedStates).length) return storedStates;
                const checkedIds = stableCheckedNodeIds.length ? stableCheckedNodeIds : normalizeTasksCheckedNodeIds(sourcePrefsRef.current?.checkedNodeIds);
                return Object.fromEntries(checkedIds.map((nodeId) => [nodeId, cardStates[1] || TASKS_DEFAULT_CARD_STATES[1]]));
            });
            const [noteInputValue, setNoteInputValue] = React.useState('');
            const [slideNoteInputValue, setSlideNoteInputValue] = React.useState('');
            const [clearedNote, setClearedNote] = React.useState(null);
            const [allClearedNotes, setAllClearedNotes] = React.useState(null);
            const [filterPanelMaxHeight, setFilterPanelMaxHeight] = React.useState('100%');
            const [graphMinZoom, setGraphMinZoom] = React.useState(TASKS_GRAPH_MIN_ZOOM);
            const [queryBuilderReady, setQueryBuilderReady] = React.useState(() => Boolean(window.VyasaTasksQueryBuilder?.QueryBuilder));
            const [nodes, setNodes] = React.useState([]);
            const [edges, setEdges] = React.useState([]);
            const visibleEdgesRef = React.useRef([]);
            visibleEdgesRef.current = edges;
            const edgeNodeLabels = React.useMemo(() => tasksModelNodeLabels(model), [model]);
            const referenceEdgeRecords = React.useMemo(
                () => tasksReferenceEdges(model, sourceModel?.dependency_edges),
                [model, sourceModel]
            );
            const layoutModel = React.useMemo(() => ({
                ...model,
                dependency_edges: [...(model?.dependency_edges || []), ...referenceEdgeRecords],
            }), [model, referenceEdgeRecords]);
            const layoutRawGraph = React.useMemo(() => ({
                ...rawGraph,
                edges: [
                    ...(rawGraph?.edges || []),
                    ...tasksVisibleReferenceEdges(referenceEdgeRecords, rawGraph?.nodes || [], model),
                ],
            }), [rawGraph, referenceEdgeRecords, model]);
            const currentGraphEdges = React.useCallback(
                () => [...(graphBaseRef.current.edges || []), ...referenceEdgesRef.current],
                [],
            );
            const edgeNodesById = React.useMemo(() => new Map([...(model?.groups || []), ...(model?.tasks || [])].map((node) => [String(node.id || ''), node])), [model]);
            const [selectedEdgeRecord, setSelectedEdgeRecord] = React.useState(null);
            const resolveEdgeRecord = React.useCallback((edge) => {
                const edgeId = tasksEdgeRecordId(edge);
                if (!edgeId) return null;
                return (model?.dependency_edges || []).find((item) => tasksEdgeRecordId(item) === edgeId)
                    || (sourceModel?.dependency_edges || []).find((item) => tasksEdgeRecordId(item) === edgeId)
                    || edge;
            }, [model, sourceModel]);
            const selectEdgeRecord = React.useCallback((edge, openCard = true, field = '') => {
                const edgeId = tasksEdgeRecordId(edge);
                if (!edgeId) return;
                const record = resolveEdgeRecord(edge);
                const ordered = tasksOrderedEdges(visibleEdgesRef.current.length
                    ? visibleEdgesRef.current
                    : currentGraphEdges());
                const index = ordered.findIndex((item) => tasksEdgeRecordId(item) === edgeId);
                const sourceLabel = edgeNodeLabels[record.source] || record.source || '';
                const targetLabel = edgeNodeLabels[record.target] || record.target || '';
                const relation = record.relation || record.label || '';
                selectedNodeIdRef.current = null;
                selectedNodeIdsRef.current = new Set();
                selectedEdgeIdRef.current = edgeId;
                setSelectedNodeId(null);
                setSelectedNodeIds(new Set());
                setSelectedEdgeId(edgeId);
                setSelectedEdgeRecord(record);
                setEdgeCardOpen(openCard);
                setEdgeCardField(field);
                setEdgeCardError('');
                setHoveredNodeId(null);
                setEdgeStatus(`${edgeId}: ${sourceLabel} ${relation} ${targetLabel}, edge ${Math.max(1, index + 1)} of ${ordered.length} visible edges${openCard ? '. Edge details opened.' : ''}`);
                if (openCard && activeContextId && window.history?.replaceState) {
                    const fragment = ['kg', activeContextId, edgeId, field].filter(Boolean).map(encodeURIComponent).join('/');
                    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${fragment}`);
                }
                logTasksDebug('edgeSelectionSet', { widgetId, edgeId, source: record.source || '', target: record.target || '', openCard });
            }, [activeContextId, currentGraphEdges, edgeNodeLabels, resolveEdgeRecord, widgetId]);
            const edgeForOptionPointer = React.useCallback((event) => {
                const reactFlow = reactFlowApiRef.current;
                if (!reactFlow) return null;
                const point = reactFlow.screenToFlowPosition({ x: event.clientX, y: event.clientY });
                const graph = graphBaseRef.current || { nodes: [], edges: [] };
                let nodeId = selectedNodeIdRef.current || optionEdgeNodeIdRef.current;
                // Chrome carries no handles, so the nearest search runs on the lane
                // the chrome sits on and is limited to the edges it names.
                let onlyEdgeIds = null;
                if (!nodeId) {
                    const hit = tasksGraphNodeAtFlowPoint(graph.nodes || [], point);
                    const chromeEdgeIds = hit?.node.data?.__edge_ids__;
                    if (hit && chromeEdgeIds?.length && hit.node.data?.__sequence_lane__) {
                        nodeId = hit.node.data.__sequence_lane__;
                        onlyEdgeIds = new Set(chromeEdgeIds);
                    } else if (hit) {
                        nodeId = hit.node.data?.__kind__ === 'groupTitle'
                            ? (hit.node.data?.sourceGroupId || hit.node.id)
                            : hit.node.id;
                    }
                }
                if (!nodeId) return null;
                // A row that draws no line is never a useful preview target: there is
                // nothing under the pointer to light up.
                const previewable = currentGraphEdges().filter((item) => !item.data?.__line_off__
                    && (!onlyEdgeIds || onlyEdgeIds.has(item.id)));
                const edge = nearestTasksIncidentEdge(
                    point,
                    nodeId,
                    graph.nodes || [],
                    previewable,
                );
                return edge ? { edge, nodeId } : null;
            }, [currentGraphEdges]);
            const previewOptionEdge = React.useCallback((edge, nodeId) => {
                if (optionEdgePinnedRef.current) return;
                const edgeId = tasksEdgeRecordId(edge);
                if (!edgeId) return;
                optionEdgeNodeIdRef.current = nodeId;
                optionEdgeOtherNodeIdRef.current = edge.source === nodeId ? edge.target : edge.source;
                if (optionEdgeNodeCardHeldRef.current) setOptionEdgeNodeCardId(optionEdgeOtherNodeIdRef.current);
                edgeCycleNodeIdRef.current = nodeId;
                selectedEdgeIdRef.current = edgeId;
                setSelectedEdgeId(edgeId);
                setSelectedEdgeRecord(resolveEdgeRecord(edge));
                setEdgeCardOpen(true);
                setEdgeCardField('');
                setEdgeCardError('');
                groupHoverTooltipRef.current = null;
                setGroupHoverTooltip(null);
                setEdgeStatus(`${edgeId}. Release W to return to the node.`);
            }, [resolveEdgeRecord]);
            const clearOptionEdgePreview = React.useCallback(() => {
                optionEdgeOtherNodeIdRef.current = '';
                setOptionEdgeNodeCardId(null);
                if (optionEdgePinnedRef.current) {
                    optionEdgePinnedRef.current = false;
                    optionEdgeNodeIdRef.current = '';
                    setEdgeStatus('Edge details pinned.');
                    return;
                }
                if (!optionEdgeNodeIdRef.current) return;
                optionEdgeNodeIdRef.current = '';
                selectedEdgeIdRef.current = null;
                setSelectedEdgeId(null);
                setSelectedEdgeRecord(null);
                setEdgeCardOpen(false);
                setEdgeCardField('');
                setEdgeCardError('');
                setEdgeStatus('Edge preview closed.');
            }, []);
            React.useEffect(() => {
                const pinPreview = () => {
                    if (!optionEdgeNodeIdRef.current || !selectedEdgeIdRef.current) return false;
                    optionEdgePinnedRef.current = true;
                    const bloomKey = `${selectedEdgeIdRef.current}:${++edgePinBloomIdRef.current}`;
                    setEdgePinBloom({ edgeId: selectedEdgeIdRef.current, key: bloomKey });
                    window.setTimeout(() => setEdgePinBloom((current) => current?.key === bloomKey ? null : current), 1800);
                    logTasksDebug('optionEdgePinned', { widgetId, edgeId: selectedEdgeIdRef.current, bloomKey });
                    setEdgeStatus(`${selectedEdgeIdRef.current}. Edge details pinned.`);
                    focusDetailCard();
                    return true;
                };
                const edgeKeyApplies = (event) => tasksHeldKeyApplies(
                    event,
                    flowWrapperRef.current,
                    optionEdgeNodeIdRef.current,
                );
                const onKeyDown = (event) => {
                    if (event.repeat || !edgeKeyApplies(event)) return;
                    if (event.code === 'KeyW') {
                        optionEdgePreviewHeldRef.current = true;
                        event.preventDefault();
                        event.stopPropagation();
                    } else if (event.key === 'Enter' && optionEdgePreviewHeldRef.current && !codeModeEntryRef.current) {
                        const oppositeNodeId = optionEdgeNodeCardHeldRef.current ? optionEdgeOtherNodeIdRef.current : '';
                        if (oppositeNodeId) {
                            optionEdgePreviewHeldRef.current = false;
                            optionEdgeNodeCardHeldRef.current = false;
                            optionEdgeOtherNodeIdRef.current = '';
                            setOptionEdgeNodeCardId(null);
                            selectNodeCard(oppositeNodeId, oppositeNodeId, 'task', true);
                            logTasksDebug('optionEdgeNodeCardSelected', { widgetId, nodeId: oppositeNodeId, reason: 'w-q-enter' });
                            event.preventDefault();
                            event.stopImmediatePropagation();
                        } else if (pinPreview()) {
                            event.preventDefault();
                            event.stopImmediatePropagation();
                        }
                    } else if (event.code === 'KeyQ') {
                        optionEdgeNodeCardHeldRef.current = true;
                        event.preventDefault();
                        event.stopPropagation();
                        if (optionEdgeOtherNodeIdRef.current) {
                            setOptionEdgeNodeCardId(optionEdgeOtherNodeIdRef.current);
                            logTasksDebug('optionEdgeNodeCardSet', { widgetId, nodeId: optionEdgeOtherNodeIdRef.current });
                        }
                    }
                };
                const onKeyUp = (event) => {
                    if (event.code === 'KeyW') {
                        optionEdgePreviewHeldRef.current = false;
                        clearOptionEdgePreview();
                    } else if (event.code === 'KeyQ') {
                        optionEdgeNodeCardHeldRef.current = false;
                        setOptionEdgeNodeCardId(null);
                        logTasksDebug('optionEdgeNodeCardClear', { widgetId, reason: 'q-up' });
                    }
                };
                const clearKeys = () => {
                    optionEdgePreviewHeldRef.current = false;
                    optionEdgeNodeCardHeldRef.current = false;
                    clearOptionEdgePreview();
                };
                window.addEventListener('keydown', onKeyDown, true);
                window.addEventListener('keyup', onKeyUp, true);
                window.addEventListener('blur', clearKeys);
                return () => {
                    window.removeEventListener('keydown', onKeyDown, true);
                    window.removeEventListener('keyup', onKeyUp, true);
                    window.removeEventListener('blur', clearKeys);
                };
            }, [clearOptionEdgePreview, focusDetailCard, selectNodeCard, widgetId]);
            // Code mode. Holding A over a node or an edge shows the first link in
            // its `code` attribute as a link preview, and sends the wheel to that
            // preview instead of the graph. Releasing A closes it, so the preview
            // never outlives the key. Same shape as the W edge preview above.
            React.useEffect(() => {
                const CODE_BLOCK_STEP = { ArrowRight: 1, ArrowLeft: -1 };
                let pointerAt = null;
                const trackPointer = (event) => {
                    pointerAt = { clientX: event.clientX, clientY: event.clientY };
                };
                const edgeIdUnderPointer = () => {
                    if (!pointerAt) return '';
                    const group = document.elementFromPoint(pointerAt.clientX, pointerAt.clientY)
                        ?.closest?.('.react-flow__edge');
                    return String(group?.dataset?.id
                        || String(group?.dataset?.testid || '').replace(/^rf__edge-/, ''));
                };
                const edgeRecordById = (edgeId) => {
                    if (!edgeId) return null;
                    const edge = currentGraphEdges().find((item) => tasksEdgeRecordId(item) === edgeId
                        || String(item.id || '') === edgeId);
                    return edge ? resolveEdgeRecord(edge) : null;
                };
                // W holds an edge preview while the pointer still rests on a node,
                // so the hovered node is not what the reader is looking at. The held
                // edge wins. Without W, the pointer names one element and is the
                // newer gesture, so hover beats a lingering selection.
                const codeModeRecord = () => {
                    if (optionEdgePreviewHeldRef.current) {
                        return edgeRecordById(String(selectedEdgeIdRef.current || ''));
                    }
                    const hoveredId = String(hoveredNodeIdRef.current || '');
                    if (hoveredId) return edgeNodesById.get(hoveredId) || null;
                    const edgeId = edgeIdUnderPointer() || String(selectedEdgeIdRef.current || '');
                    if (edgeId) return edgeRecordById(edgeId);
                    const selectedId = String(selectedNodeIdRef.current || '');
                    return selectedId ? edgeNodesById.get(selectedId) || null : null;
                };
                // Open where a Cmd-hover on the card's Code link would have opened
                // it. That link lives on the right rail, so the popup lands clear
                // of the node under the pointer instead of covering it. A place the
                // reader dragged a popup to still wins over all of this: the link
                // preview reads that from storage before it reads this point.
                const codeModeOpenPoint = () => {
                    const wrapper = flowWrapperRef.current;
                    const card = wrapper?.querySelector('[data-vyasa-node-card], [data-vyasa-edge-card]');
                    if (card) {
                        const rect = card.getBoundingClientRect();
                        return { clientX: rect.left, clientY: rect.top };
                    }
                    // No card open, so aim at the rail the card would have used.
                    const rect = wrapper?.getBoundingClientRect();
                    if (rect) return { clientX: rect.right, clientY: rect.top + 12 };
                    return pointerAt || { clientX: 24, clientY: 24 };
                };
                const openCodePreview = () => {
                    if (codeModeEntryRef.current) return;
                    const link = tasksCodeAttributeLink(codeModeRecord());
                    if (!link) {
                        setEdgeStatus('No code link here. Point at a node or edge that has a Code attribute.');
                        return;
                    }
                    const entry = window.vyasaLinkPreview?.open?.(link, codeModeOpenPoint()) || null;
                    codeModeEntryRef.current = entry;
                    logTasksDebug('codeModeOpen', {
                        widgetId,
                        href: link.getAttribute('href') || '',
                        opened: Boolean(entry),
                    });
                    setEdgeStatus(entry
                        ? 'Code preview open. Hold A and scroll to read it, Enter to pin it.'
                        : 'Link preview is not available on this page.');
                };
                const closeCodePreview = () => {
                    if (!codeModeEntryRef.current) return;
                    window.vyasaLinkPreview?.close?.(codeModeEntryRef.current);
                    codeModeEntryRef.current = null;
                    setEdgeStatus('Code preview closed.');
                };
                // Pinning hands the popup over to the reader. Code mode stops owning
                // it, so releasing A leaves it up and the next A opens a fresh one
                // that steps clear of the pinned popup. Close a pinned one with
                // Escape or its × button, the same as any other preview.
                const pinCodePreview = () => {
                    if (!codeModeEntryRef.current) return false;
                    codeModeEntryRef.current = null;
                    logTasksDebug('codeModePinned', { widgetId });
                    setEdgeStatus('Code preview pinned.');
                    return true;
                };
                const onKeyDown = (event) => {
                    if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
                    if (!tasksHeldKeyApplies(event, flowWrapperRef.current, codeModeEntryRef.current)) return;
                    if (event.key === 'Enter' && pinCodePreview()) {
                        event.preventDefault();
                        event.stopImmediatePropagation();
                        return;
                    }
                    // Left and right walk the blocks the reference marks, so the
                    // reader steps through the code the author pointed at instead
                    // of panning the graph they cannot see.
                    const blockStep = CODE_BLOCK_STEP[event.key] || 0;
                    if (blockStep && codeModeEntryRef.current) {
                        if (!window.vyasaLinkPreview?.stepCodeBlock?.(codeModeEntryRef.current, blockStep)) {
                            setEdgeStatus('This preview marks no code blocks.');
                        }
                        event.preventDefault();
                        event.stopPropagation();
                        return;
                    }
                    if (event.code !== 'KeyA' || event.repeat) return;
                    event.preventDefault();
                    event.stopPropagation();
                    openCodePreview();
                };
                const onKeyUp = (event) => {
                    if (event.code === 'KeyA') closeCodePreview();
                };
                // Capture beats the graph's own wheel gesture, so the wheel scrolls
                // the code the reader is looking at instead of zooming underneath it.
                const onWheel = (event) => {
                    const entry = codeModeEntryRef.current;
                    if (!entry) return;
                    // Swallow the wheel even before the preview body arrives.
                    // Otherwise the first turns zoom the graph out from under a
                    // popover that is still loading.
                    window.vyasaLinkPreview?.scrollBy?.(entry, event.deltaX, event.deltaY);
                    event.preventDefault();
                    event.stopPropagation();
                };
                window.addEventListener('pointermove', trackPointer, true);
                window.addEventListener('keydown', onKeyDown, true);
                window.addEventListener('keyup', onKeyUp, true);
                window.addEventListener('wheel', onWheel, { capture: true, passive: false });
                window.addEventListener('blur', closeCodePreview);
                return () => {
                    closeCodePreview();
                    window.removeEventListener('pointermove', trackPointer, true);
                    window.removeEventListener('keydown', onKeyDown, true);
                    window.removeEventListener('keyup', onKeyUp, true);
                    window.removeEventListener('wheel', onWheel, { capture: true });
                    window.removeEventListener('blur', closeCodePreview);
                };
            }, [currentGraphEdges, edgeNodesById, resolveEdgeRecord, widgetId]);
            const selectGraphEdge = React.useCallback((event, edge) => {
                event?.preventDefault?.();
                event?.stopPropagation?.();
                markWidgetActive();
                edgeCycleNodeIdRef.current = '';
                selectEdgeRecord(edge, true);
            }, [markWidgetActive, selectEdgeRecord]);
            const moveExperimentNodes = React.useCallback((changes) => {
                if (!nodeConnectionExperiment) return;
                setNodes((currentNodes) => {
                    const movedNodes = rf.applyNodeChanges(changes, currentNodes);
                    const anchored = buildTaskEdgeAnchors(movedNodes, graphBaseRef.current.edges);
                    const anchoredNodes = movedNodes.map((node) => ({
                        ...node,
                        data: {
                            ...node.data,
                            handleLayout: TASKS_NODE_CONNECTION_HANDLES,
                            __debug_position__: {
                                x: Math.round(node.position.x),
                                y: Math.round(node.position.y),
                            },
                        },
                    }));
                    graphBaseRef.current = { nodes: anchoredNodes, edges: anchored.edges };
                    setEdges(anchored.edges);
                    return anchoredNodes;
                });
            }, [nodeConnectionExperiment]);
            const reviewTargets = React.useMemo(() => [
                ...nodes
                    .filter((node) => node.data?.highlightMode && !['dim', 'none'].includes(node.data.highlightMode))
                    .slice(0, 40)
                    .map((node) => ({
                        kind: 'node',
                        id: node.data?.__kind__ === 'groupTitle' ? (node.data?.sourceGroupId || node.id) : node.id,
                        label: String(node.data?.label || node.id).slice(0, 240),
                        node_kind: node.data?.__kind__ || '',
                        widget_id: widgetId,
                    })),
                ...edges
                    .filter((edge) => edge.data?.highlightMode && !['dim', 'none'].includes(edge.data.highlightMode))
                    .slice(0, 20)
                    .map((edge) => ({
                        kind: 'edge',
                        id: edge.id,
                        label: String(edge.label || edge.id).slice(0, 240),
                        source: edge.source,
                        target: edge.target,
                        widget_id: widgetId,
                    })),
            ], [nodes, edges]);
            React.useEffect(() => {
                const carrier = flowWrapperRef.current;
                if (!carrier) return;
                if (reviewTargets.length) carrier.dataset.vyasaReviewTargets = JSON.stringify(reviewTargets);
                else delete carrier.dataset.vyasaReviewTargets;
            }, [reviewTargets]);
            const noteTextareaRef = React.useRef(null);
            const edgeNoteTextareaRef = React.useRef(null);
            const extendLassoPoints = React.useCallback((points, nextPoint) => {
                const current = Array.isArray(points) ? points : [];
                const last = current[current.length - 1];
                if (last && Math.hypot(last.x - nextPoint.x, last.y - nextPoint.y) < 6) return current;
                return [...current, nextPoint];
            }, []);
            const graphStatsLabel = React.useMemo(
                () => tasksLogicalGraphStatsLabel(model),
                [model]
            );
            React.useEffect(() => {
                const statsEl = wrapper.querySelector('[data-tasks-stats]');
                if (statsEl) statsEl.textContent = graphStatsLabel;
            }, [graphStatsLabel]);
            const backgroundProps = React.useMemo(() => tasksBackgroundProps(widgetId), []);
            const lastPersistedPrefsScopeRef = React.useRef(tasksProjectionPrefsKey(activeProjectionId, activeContextId));
            const pendingFitActionRef = React.useRef(null);
            const lastLayoutRevisionKeyRef = React.useRef('');
            const lastGraphRevisionCauseRef = React.useRef('layout');
            const reactFlowApiRef = React.useRef(null);
            const searchInputRef = React.useRef(null);
            const prevExpandedCountRef = React.useRef(0);
            const groupToggleHoverIdRef = React.useRef('');
            const transientGraphHoverActiveRef = React.useRef(false);
            const suppressNextGraphClickRef = React.useRef(false);
            const lastNodeClickRef = React.useRef(null);
            const pendingNodeClickToggleTimerRef = React.useRef(null);
            const egoReturnRef = React.useRef(null);
            const pendingEgoViewportRestoreRef = React.useRef(null);
            const activeProjection = React.useMemo(() => {
                const projections = Array.isArray(viewerState.model?.view_projections) ? viewerState.model.view_projections : [];
                const id = String(activeProjectionId || '').trim();
                return id ? (projections.find((p) => p && p.id === id) || null) : null;
            }, [viewerState.model, activeProjectionId]);
            const edgeTypeOptions = React.useMemo(() => Array.from(new Set(
                (layoutModel?.dependency_edges || [])
                    .map((edge) => resolveTasksEdgeLabel(edge, model, activeProjection))
                    .filter(Boolean)
            )).sort((a, b) => a.localeCompare(b)), [layoutModel, model, activeProjection]);
            const edgeTypeColors = React.useMemo(() => {
                const palette = tasksEdgeColorPaletteFor(model, model?.edge_color_by);
                const colors = {};
                for (const edge of layoutModel?.dependency_edges || []) {
                    const type = resolveTasksEdgeLabel(edge, model, activeProjection);
                    if (!type || colors[type]) continue;
                    colors[type] = edge.__reference__
                        ? 'var(--vyasa-primary)'
                        : (resolveTasksEdgeColor(edge, model, model?.edge_color_by, palette) || 'currentColor');
                }
                return colors;
            }, [layoutModel, model, activeProjection]);
            React.useEffect(() => {
                const valid = new Set(edgeTypeOptions);
                setActiveEdgeTypes((current) => current.filter((type) => valid.has(type)));
            }, [edgeTypeOptions]);
            const activeColorBy = activeColorHierarchy[0] || '';
            const reorderTasksHierarchyLevel = React.useCallback((items, fromIndex, toIndex) => {
                const next = (Array.isArray(items) ? items : []).map((entry) => String(entry || '').trim()).filter(Boolean);
                if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= next.length || toIndex >= next.length) return next;
                const [moved] = next.splice(fromIndex, 1);
                next.splice(toIndex, 0, moved);
                return next;
            }, []);
            const reorderActiveColorLevel = React.useCallback((fromIndex, toIndex) => {
                setActiveColorHierarchy((current) => {
                    const next = reorderTasksHierarchyLevel(current, fromIndex, toIndex);
                    const normalized = normalizeTasksColorHierarchy(next, model, nodeNotes);
                    const unchanged = normalized.length === current.length && normalized.every((entry, i) => entry === current[i]);
                    return unchanged ? current : normalized;
                });
            }, [model, nodeNotes, reorderTasksHierarchyLevel]);
            const reorderGroupByLevel = React.useCallback((fromIndex, toIndex) => {
                setGroupByHierarchy((current) => reorderTasksHierarchyLevel(current, fromIndex, toIndex));
                setViewMode('graph');
                pendingFitActionRef.current = 'mode';
            }, [reorderTasksHierarchyLevel]);
            const setActiveColorLevel = React.useCallback((index, value) => {
                setActiveColorHierarchy((current) => {
                    const next = Array.isArray(current) ? current.slice() : [];
                    const key = String(value || '').trim();
                    if (key) next[index] = key;
                    else next.splice(index, 1);
                    const normalized = normalizeTasksColorHierarchy(next, model, nodeNotes);
                    const unchanged = normalized.length === current.length && normalized.every((entry, i) => entry === current[i]);
                    logTasksPerf('state-transition', {
                        widgetId,
                        action: 'set-color-level',
                        index,
                        value: key,
                        before: current,
                        after: normalized,
                        unchanged,
                    });
                    return unchanged ? current : normalized;
                });
            }, [model, nodeNotes, widgetId]);
            const setFiltersCollapsedGuarded = React.useCallback((nextValue, action = 'filters-collapsed') => {
                if (slideIndex >= 0) return;
                setFiltersCollapsed((current) => {
                    const next = typeof nextValue === 'function' ? Boolean(nextValue(current)) : Boolean(nextValue);
                    logTasksPerf('state-transition', {
                        widgetId,
                        action,
                        before: current,
                        after: next,
                        unchanged: current === next,
                    });
                    return current === next ? current : next;
                });
            }, [widgetId, slideIndex]);
            const activeColorLevelSpecs = React.useMemo(() => activeColorHierarchy.map((colorBy) => ({
                colorBy,
                palette: tasksColorPaletteFor(model, colorBy),
            })), [model, activeColorHierarchy]);
            const activeColorPalette = React.useMemo(() => activeColorLevelSpecs[0]?.palette || {}, [activeColorLevelSpecs]);
            const defaultNodeColor = React.useMemo(
                () => activeColorBy ? '' : tasksResolvedThemeColor('--vyasa-primary', '#64748b'),
                [activeColorBy]
            );
            const currentPerfViewState = React.useCallback(() => {
                const currentNodes = graphBaseRef.current?.nodes || [];
                return {
                    viewMode,
                    activeProjectionId,
                    activeColorBy,
                    activeColorHierarchy,
                    coloredNodes: currentNodes.filter((node) => resolveTasksNodeColor(node.data, model, activeColorBy, activeColorPalette)).length,
                    defaultColoredNodes: currentNodes.filter((node) => !resolveTasksNodeColor(node.data, model, activeColorBy, activeColorPalette) && node.data?.__default_color__).length,
                    colorOverlayNodes: currentNodes.filter((node) => Array.isArray(node.data?.__color_levels__) && node.data.__color_levels__.length).length,
                    edgesVisible,
                    edgeOpacity,
                    projectionUnspecifiedContentOpacity,
                };
            }, [viewMode, activeProjectionId, activeColorBy, activeColorHierarchy, model, activeColorPalette, edgesVisible, edgeOpacity, projectionUnspecifiedContentOpacity]);
            React.useEffect(() => {
                baseLayoutRef.current = null;
                groupLayoutsRef.current = {};
                graphBaseRef.current = { nodes: [], edges: [] };
                referenceEdgesRef.current = [];
                const restoringEgo = !egoState && Boolean(pendingEgoViewportRestoreRef.current);
                if (restoringEgo) {
                    setDragSelection(null);
                    setHoveredNodeId(null);
                    groupToggleHoverIdRef.current = '';
                    transientGraphHoverActiveRef.current = false;
                    setTasksGroupToggleHover(flowWrapperRef.current, '');
                    pendingFitActionRef.current = null;
                    return;
                }
                const nextPrefs = readTasksProjectionPrefsForModel(sourceModel, { ...sourcePrefsRef.current, projectionPrefs: storedProjectionPrefsRef.current }, activeProjectionId);
                setExpanded(egoMode ? tasksExpandableNodeIds(model) : hydrateExpandedSet(nextPrefs));
                setSelectedNodeId(null);
                setSelectedNodeIds(new Set());
                selectedEdgeIdRef.current = null;
                edgeCycleNodeIdRef.current = '';
                optionEdgeNodeIdRef.current = '';
                setSelectedEdgeId(null);
                setSelectedEdgeRecord(null);
                setEdgeCardOpen(false);
                setEdgeCardField('');
                setEdgeCardError('');
                setDragSelection(null);
                setHoveredNodeId(null);
                groupToggleHoverIdRef.current = '';
                transientGraphHoverActiveRef.current = false;
                setTasksGroupToggleHover(flowWrapperRef.current, '');
                pendingFitActionRef.current = 'mode';
            }, [sourceModel, activeProjectionId, hydrateExpandedSet, egoState]);
            React.useEffect(() => {
                const nextPrefs = readTasksProjectionPrefsForModel(sourceModel, { ...sourcePrefsRef.current, projectionPrefs: storedProjectionPrefsRef.current }, activeProjectionId);
                setGroupByEnabled(!initialEgoMode && nextPrefs?.groupByEnabled === true);
                setGroupByHierarchy(initialEgoMode || !Array.isArray(nextPrefs?.groupByHierarchy) ? [] : nextPrefs.groupByHierarchy);
                setGroupByDisabledKeys(initialEgoMode ? [] : normalizeTasksGroupByDisabledKeys(nextPrefs?.groupByDisabledKeys));
            }, [sourceModel, activeProjectionId]);
            React.useEffect(() => {
                const nextPrefs = readTasksProjectionPrefsForModel(sourceModel, { ...sourcePrefsRef.current, projectionPrefs: storedProjectionPrefsRef.current }, activeProjectionId);
                setActiveFilters(initialEgoMode ? tasksEmptyFilterQuery() : normalizeTasksFilterQuery(nextPrefs?.filters));
                setActiveSwatchFilters(initialEgoMode ? tasksEmptyFilterQuery() : normalizeTasksFilterQuery(nextPrefs?.swatchFilters));
                setActiveEdgeTypes(initialEgoMode || !Array.isArray(nextPrefs?.edgeTypes) ? [] : nextPrefs.edgeTypes.map(String).filter(Boolean));
                setEdgeTypeFilterEnabled(!initialEgoMode && nextPrefs?.edgeTypeFilterEnabled !== false);
                setEdgeTypeQuery('');
                setSearchQuery(initialEgoMode ? '' : (typeof nextPrefs?.searchQuery === 'string' ? nextPrefs.searchQuery : ''));
                setSearchInputValue(initialEgoMode ? '' : (typeof nextPrefs?.searchQuery === 'string' ? nextPrefs.searchQuery : ''));
                setActiveColorHierarchy(resolveTasksPreferredColorHierarchy(baseProjectionState.model, activeProjectionId, nextPrefs, nodeNotes));
                setFiltersCollapsed((current) => (
                    typeof nextPrefs?.filtersCollapsed === 'boolean'
                        ? nextPrefs.filtersCollapsed
                        : current
                ));
                setQueryBuilderEnabled(typeof nextPrefs?.queryBuilderEnabled === 'boolean' ? nextPrefs.queryBuilderEnabled : true);
                setSearchEnabled(typeof nextPrefs?.searchEnabled === 'boolean' ? nextPrefs.searchEnabled : true);
                // A pressed E or H outranks the projection here too, so switching
                // views does not undo what the reader set for the whole server.
                const storedEdgesVisible = readTasksEdgesVisible();
                setEdgesVisible(storedEdgesVisible !== null
                    ? storedEdgesVisible
                    : (typeof nextPrefs?.edgesVisible === 'boolean' ? nextPrefs.edgesVisible : true));
                setHoverInactiveNodes(typeof nextPrefs?.hoverInactiveNodes === 'boolean' ? nextPrefs.hoverInactiveNodes : true);
                setHoverCardMode(readTasksHoverCardMode()
                    || (TASKS_HOVER_CARD_MODES.includes(nextPrefs?.hoverCardMode)
                        ? nextPrefs.hoverCardMode
                        : (nextPrefs?.hoverCardsEnabled === false ? 'off' : 'rightRail')));
                setEdgeOpacity(nextPrefs?.edgeOpacity !== undefined ? nextPrefs.edgeOpacity : (
                    sourcePrefsRef.current?.edgeOpacity === undefined ? defaultEdgeOpacity : clampTasksEdgeOpacity(sourcePrefsRef.current.edgeOpacity)
                ));
                setProjectionUnspecifiedContentOpacity(nextPrefs?.unspecifiedContentOpacity !== undefined ? nextPrefs.unspecifiedContentOpacity : (
                    sourcePrefsRef.current?.unspecifiedContentOpacity === undefined ? defaultProjectionUnspecifiedContentOpacity : clampTasksProjectionDisplayOpacity(sourcePrefsRef.current.unspecifiedContentOpacity)
                ));
            }, [sourceModel, activeProjectionId, baseProjectionState.model, nodeNotes, defaultFiltersOpen, defaultEdgeOpacity, defaultProjectionUnspecifiedContentOpacity]);
            React.useEffect(() => {
                const timeoutId = window.setTimeout(() => {
                    setSearchQuery(searchInputValue);
                }, 140);
                return () => window.clearTimeout(timeoutId);
            }, [searchInputValue]);
            React.useEffect(() => {
                if (egoMode || filtersCollapsed || !queryBuilderEnabled) {
                    logTasksDebug('queryBuilderLoadSkipped', { widgetId, egoMode, filtersCollapsed, queryBuilderEnabled });
                    return;
                }
                if (window.VyasaTasksQueryBuilder?.QueryBuilder) {
                    logTasksDebug('queryBuilderLoadReady', { widgetId, source: 'window' });
                    setQueryBuilderReady(true);
                    return;
                }
                let active = true;
                logTasksDebug('queryBuilderLoadStart', { widgetId });
                ensureTasksQueryBuilder()
                    .then((bundle) => {
                        logTasksDebug('queryBuilderLoadFinish', { widgetId, active, ready: Boolean(bundle?.QueryBuilder) });
                        if (active && bundle?.QueryBuilder) setQueryBuilderReady(true);
                    })
                    .catch((error) => {
                        logTasksDebug('queryBuilderLoadError', { widgetId, message: String(error?.message || error || '') });
                        console.error('[tasks] query builder load failed', error);
                    });
                return () => { active = false; };
            }, [egoMode, filtersCollapsed, queryBuilderEnabled]);
            const effectiveQueryFilters = React.useMemo(
                () => (egoMode || !queryBuilderEnabled ? tasksEmptyFilterQuery() : activeFilters),
                [egoMode, queryBuilderEnabled, activeFilters]
            );
            const searchMatches = React.useMemo(
                () => tasksCollectSearchMatches(graphBaseRef.current.nodes || [], currentGraphEdges(), !egoMode && searchEnabled ? searchQuery : '', nodeNotes),
                [graphRevision, egoMode, searchEnabled, searchQuery, nodeNotes]
            );
            const filteredSelectionIds = React.useCallback(() => {
                const hasFilters = tasksFilterQueryHasRules(effectiveQueryFilters) || tasksFilterQueryHasRules(effectiveSwatchFilters);
                const hasEdgeFilters = effectiveEdgeTypes.length > 0;
                const hasSearch = searchMatches.active && !searchMatches.error;
                if (!hasFilters && !hasEdgeFilters && !hasSearch) return new Set();
                const edgeNodeIds = hasEdgeFilters
                    ? tasksEdgeFilterNodeIds(currentGraphEdges(), effectiveEdgeTypes)
                    : null;
                return new Set((graphBaseRef.current.nodes || [])
                    .filter((node) => node?.id && node.data?.__kind__ !== 'groupTitle')
                    .filter((node) => {
                        const filterHit = hasFilters ? tasksNodeMatchesAllFilters(node.data, effectiveQueryFilters, effectiveSwatchFilters) : true;
                        const edgeHit = edgeNodeIds ? edgeNodeIds.has(node.id) : true;
                        const searchHit = hasSearch ? searchMatches.nodeIds.has(node.id) : true;
                        return filterHit && edgeHit && searchHit;
                    })
                    .map((node) => node.id));
            }, [currentGraphEdges, effectiveQueryFilters, effectiveSwatchFilters, effectiveEdgeTypes, searchMatches]);
            const currentSelectionIds = React.useCallback(() => {
                if (selectedNodeIdRef.current) return new Set([selectedNodeIdRef.current]);
                if (selectedNodeIdsRef.current.size) {
                    const baseById = Object.fromEntries((graphBaseRef.current.nodes || []).map((node) => [node.id, node]));
                    return new Set(Array.from(selectedNodeIdsRef.current).filter((nodeId) => {
                        const node = baseById[nodeId];
                        if (!node || node.data?.__kind__ === 'groupTitle') return false;
                        return isTasksGraphNodeSelectable(node.data?.__kind__, expanded.has(node.id));
                    }));
                }
                return filteredSelectionIds();
            }, [expanded, filteredSelectionIds]);
            // `=` grows the selection by one hop, `-` takes that hop back. A hop is one
            // pass over the edges already in memory, so neither key touches the server.
            // Shrinking cannot be derived from the grown set, so each grow pushes the set
            // it started from. The stack is dropped as soon as the selection moves by any
            // other route, which the applied-set comparison detects without every click
            // path having to know about hops.
            const selectionHopsRef = React.useRef({ stack: [], applied: null });
            const applyHopSelection = React.useCallback((ids, stack) => {
                selectionHopsRef.current = { stack, applied: new Set(ids) };
                markWidgetActive();
                selectedNodeIdRef.current = null;
                selectedNodeIdsRef.current = new Set(ids);
                setSelectedNodeId(null);
                setHoveredNodeId(null);
                setSelectedNodeIds(new Set(ids));
            }, [markWidgetActive]);
            const announceHopSelection = React.useCallback((message, detail = {}) => {
                logTasksDebug('selectionHopMessage', {
                    widgetId,
                    message,
                    stackDepth: selectionHopsRef.current.stack.length,
                    appliedCount: (selectionHopsRef.current.applied || new Set()).size,
                    ...detail,
                });
                showVyasaToast(message);
                setEdgeStatus(message);
            }, [widgetId]);
            const growSelectionOneHop = React.useCallback((hoveredNodeId = '') => {
                logTasksDebug('selectionHopAction', {
                    widgetId,
                    action: 'grow',
                    stackDepth: selectionHopsRef.current.stack.length,
                    appliedCount: (selectionHopsRef.current.applied || new Set()).size,
                    liveCount: selectedNodeIdsRef.current.size,
                    pinnedNodeId: String(selectedNodeIdRef.current || ''),
                    hoveredNodeId: String(hoveredNodeId || ''),
                });
                const baseById = new Map((graphBaseRef.current.nodes || []).map((node) => [node.id, node]));
                const isSelectable = (nodeId) => {
                    const node = baseById.get(nodeId);
                    if (!node || node.data?.__kind__ === 'groupTitle') return false;
                    return isTasksGraphNodeSelectable(node.data?.__kind__, expanded.has(node.id));
                };
                const selectionSeeds = currentSelectionIds();
                const hops = selectionHopsRef.current;
                const continues = hops.stack.length > 0 && tasksSameIdSet(hops.applied, selectionSeeds);
                const { seeds, fromHover } = tasksHopSeedIds(selectionSeeds, hoveredNodeId, isSelectable, continues);
                if (!seeds.size) {
                    announceHopSelection('Hover or select a node first, then press = to add its neighbours.');
                    return;
                }
                const restarted = !continues && hops.stack.length > 0;
                if (restarted) {
                    logTasksDebug('selectionHopChainRestart', {
                        widgetId,
                        reason: fromHover ? 'hover-seed' : 'selection-drift',
                        droppedHops: hops.stack.length,
                        applied: Array.from(hops.applied || []),
                        seeds: Array.from(seeds),
                    });
                }
                const grown = tasksNeighborHopIds(
                    tasksEdgesMatchingTypes(currentGraphEdges(), effectiveEdgeTypes),
                    seeds,
                    isSelectable,
                );
                if (grown.size === seeds.size) {
                    announceHopSelection(`No further neighbours, ${seeds.size} node${seeds.size === 1 ? '' : 's'} selected.`);
                    return;
                }
                const nextStack = [...(continues ? hops.stack : []), new Set(seeds)];
                logTasksDebug('selectionGrowHop', {
                    widgetId,
                    hop: nextStack.length,
                    fromHover,
                    seedCount: seeds.size,
                    selectedIds: Array.from(grown),
                });
                applyHopSelection(grown, nextStack);
                announceHopSelection(tasksHopSelectionLabel(nextStack.length, grown.size, restarted));
            }, [announceHopSelection, applyHopSelection, currentGraphEdges, currentSelectionIds, effectiveEdgeTypes, expanded, widgetId]);
            const shrinkSelectionOneHop = React.useCallback(() => {
                logTasksDebug('selectionHopAction', {
                    widgetId,
                    action: 'shrink',
                    stackDepth: selectionHopsRef.current.stack.length,
                    appliedCount: (selectionHopsRef.current.applied || new Set()).size,
                    liveCount: selectedNodeIdsRef.current.size,
                    pinnedNodeId: String(selectedNodeIdRef.current || ''),
                });
                const hops = selectionHopsRef.current;
                if (!hops.stack.length || !tasksSameIdSet(hops.applied, currentSelectionIds())) {
                    announceHopSelection('No expansion to undo.');
                    return;
                }
                const previous = hops.stack[hops.stack.length - 1];
                const stack = hops.stack.slice(0, -1);
                logTasksDebug('selectionShrinkHop', {
                    widgetId,
                    hop: stack.length,
                    selectedIds: Array.from(previous),
                });
                applyHopSelection(previous, stack);
                announceHopSelection(tasksHopSelectionLabel(stack.length, previous.size));
            }, [announceHopSelection, applyHopSelection, currentSelectionIds, widgetId]);
            const currentHighlightedFitNodes = React.useCallback(() => {
                const selectedIds = currentSelectionIds();
                // An open hover card names a focus node too, so F frames the hovered
                // node and its edge neighbours the way a selection does. Selection
                // wins when both are live.
                const hoverTooltip = groupHoverTooltipRef.current;
                const hoverCardOpen = hoverCardsEnabled
                    && Boolean(hoverTooltip?.nodeId)
                    && (groupHoverCardsEnabled || !hoverTooltip.group);
                // The card is one way to name the hovered node, not the only one. It
                // opens after a dwell and stays shut in some hover-card modes, so fall
                // back to the plain hovered id. Otherwise F frames nothing on hover
                // until a card happens to be open.
                const hoverAnchorId = selectedIds.size
                    ? ''
                    : String((hoverCardOpen ? hoverTooltip.nodeId : '') || hoveredNodeIdRef.current || '');
                if (!selectedIds.size && !hoverAnchorId) return [];
                const seedIds = hoverAnchorId ? new Set([hoverAnchorId]) : selectedIds;
                const anchorId = hoverAnchorId
                    || (selectedNodeIdRef.current && selectedIds.has(selectedNodeIdRef.current) ? selectedNodeIdRef.current : '');
                // Equal-z hit paths use paint order. Stable edge order makes the
                // overlap winner deterministic; keyboard cycling still reaches all edges.
                const baseEdges = tasksOrderedEdges(tasksEdgesMatchingTypes(
                    currentGraphEdges(),
                    effectiveEdgeTypes,
                ));
                const fitIds = new Set(seedIds);
                for (const seedId of seedIds) {
                    for (const descendantId of collectTasksGroupDescendantIds(seedId, model)) fitIds.add(descendantId);
                }
                if (anchorId) {
                    const selectedScopeIds = new Set([anchorId, ...collectTasksGroupDescendantIds(anchorId, model)]);
                    const fitEdgeEndpointIds = new Set(selectedScopeIds);
                    for (const edge of baseEdges) {
                        if (selectedScopeIds.has(edge.source) || selectedScopeIds.has(edge.target)) {
                            fitEdgeEndpointIds.add(edge.source);
                            fitEdgeEndpointIds.add(edge.target);
                        }
                    }
                    for (const endpointId of Array.from(fitEdgeEndpointIds)) {
                        fitIds.add(endpointId);
                        for (const descendantId of collectTasksGroupDescendantIds(endpointId, model)) fitIds.add(descendantId);
                    }
                }
                return (graphBaseRef.current.nodes || []).filter((node) => (
                    node?.id
                    && node.data?.__kind__ !== 'groupTitle'
                    && fitIds.has(node.id)
                ));
            }, [currentGraphEdges, currentSelectionIds, model, effectiveEdgeTypes, hoverCardsEnabled, groupHoverCardsEnabled]);
            const tasksFitDebugPayload = React.useCallback((reason, matchedNodes = []) => {
                const selectedIds = currentSelectionIds();
                const hasQueryFilters = tasksFilterQueryHasRules(effectiveQueryFilters);
                const hasSwatchFilters = tasksFilterQueryHasRules(effectiveSwatchFilters);
                const hasEdgeFilters = effectiveEdgeTypes.length > 0;
                const hasSearch = searchMatches.active && !searchMatches.error;
                return {
                    widgetId,
                    reason,
                    selectedNodeId: selectedNodeIdRef.current || '',
                    selectedNodeIds: Array.from(selectedNodeIdsRef.current || []),
                    currentSelectionIds: Array.from(selectedIds),
                    hasQueryFilters,
                    hasSwatchFilters,
                    hasEdgeFilters,
                    edgeTypes: effectiveEdgeTypes,
                    hasSearch,
                    searchError: searchMatches.error || '',
                    queryRuleCount: tasksCountFilterRules(effectiveQueryFilters),
                    swatchRuleCount: tasksCountFilterRules(effectiveSwatchFilters),
                    baseNodeCount: (graphBaseRef.current.nodes || []).length,
                    matchedNodeCount: matchedNodes.length,
                    matchedNodeIds: matchedNodes.map((node) => node.id).slice(0, 80),
                };
            }, [widgetId, currentSelectionIds, effectiveQueryFilters, effectiveSwatchFilters, effectiveEdgeTypes, searchMatches]);
            // Width the open detail cards take from the right edge, gutter included.
            const cardCoveredRight = React.useCallback(() => {
                const canvas = flowWrapperRef.current;
                if (!canvas) return 0;
                const canvasRect = canvas.getBoundingClientRect();
                const cards = Array.from(canvas.querySelectorAll('[data-vyasa-node-card], [data-vyasa-edge-card]'));
                const cardLeft = Math.min(...cards.map((card) => card.getBoundingClientRect().left));
                if (!Number.isFinite(cardLeft)) return 0;
                const covered = Math.max(0, canvasRect.right - Math.max(canvasRect.left, cardLeft));
                return covered ? Math.ceil(covered + 12) : 0;
            }, []);
            // xyflow treats fitView padding as a minimum gap and still centres the
            // content in the whole canvas, so a narrow graph parks under the card.
            // Size and centre against the uncovered strip ourselves instead.
            // Returns false when no card is open, so the plain fitView still runs.
            const fitNodesBesideCards = React.useCallback((reactFlow, nodes, duration) => {
                const canvas = flowWrapperRef.current;
                const coveredRight = cardCoveredRight();
                if (!reactFlow || !canvas || !coveredRight) return false;
                const bounds = reactFlow.getNodesBounds(nodes?.length ? nodes : reactFlow.getNodes());
                if (!(bounds?.width > 0) || !(bounds?.height > 0)) return false;
                const canvasRect = canvas.getBoundingClientRect();
                const pad = 24;
                const width = canvasRect.width - coveredRight - pad * 2;
                const height = canvasRect.height - pad * 2;
                if (width <= 0 || height <= 0) return false;
                const zoom = Math.min(
                    TASKS_GRAPH_MAX_ZOOM,
                    Math.max(graphMinZoom, Math.min(width / bounds.width, height / bounds.height))
                );
                reactFlow.setViewport({
                    x: pad + width / 2 - (bounds.x + bounds.width / 2) * zoom,
                    y: pad + height / 2 - (bounds.y + bounds.height / 2) * zoom,
                    zoom,
                }, { duration });
                return true;
            }, [cardCoveredRight, graphMinZoom]);
            const fitCurrentHighlight = React.useCallback((reactFlow, options = {}) => {
                const reason = String(options.reason || 'manual-fit');
                if (!reactFlow) return 0;
                const matched = currentHighlightedFitNodes();
                const duration = Number.isFinite(Number(options.duration)) ? Number(options.duration) : 200;
                logTasksDebug('fitCurrentHighlight', {
                    ...tasksFitDebugPayload(reason, matched),
                    hasReactFlow: Boolean(reactFlow),
                    duration,
                });
                if (!fitNodesBesideCards(reactFlow, matched, duration)) {
                    reactFlow.fitView(matched.length
                        ? { nodes: matched, duration, padding: options.highlightPadding ?? 0.25, includeHiddenNodes: true }
                        : { duration, padding: options.padding ?? 0.2, includeHiddenNodes: true });
                }
                return matched.length;
            }, [currentHighlightedFitNodes, fitNodesBesideCards, tasksFitDebugPayload]);
            const fitSelectedEdgeConnection = React.useCallback((reactFlow, duration = 300) => {
                if (!reactFlow || !selectedEdgeIdRef.current) return 0;
                const visibleEdge = currentGraphEdges().find(
                    (edge) => tasksEdgeRecordId(edge) === selectedEdgeIdRef.current
                );
                const edge = visibleEdge || selectedEdgeRecord;
                if (!edge) return 0;
                const endpointIds = new Set([edge.source, edge.target]);
                const matched = (graphBaseRef.current.nodes || []).filter((node) => endpointIds.has(node.id));
                if (!matched.length) return 0;
                if (!fitNodesBesideCards(reactFlow, matched, duration)) {
                    reactFlow.fitView({ nodes: matched, duration, padding: 0.32, includeHiddenNodes: true });
                }
                return matched.length;
            }, [currentGraphEdges, fitNodesBesideCards, selectedEdgeRecord]);
            React.useEffect(() => {
                const baseModel = baseProjectionState.model;
                const validFilterKeys = new Set(tasksFilterOptions(baseModel).map((option) => option.key));
                setActiveFilters((current) => tasksPruneFilterQueryFields(current, validFilterKeys));
                setActiveSwatchFilters((current) => tasksPruneFilterQueryFields(current, validFilterKeys));
                setActiveColorHierarchy((current) => {
                    const normalized = normalizeTasksColorHierarchy(current, baseModel, nodeNotes);
                    const unchanged = normalized.length === current.length && normalized.every((entry, i) => entry === current[i]);
                    return unchanged ? current : normalized;
                });
            }, [baseProjectionState.model, nodeNotes]);
            React.useEffect(() => {
                const activeSwatchKeys = new Set([
                    ...activeColorHierarchy.filter(Boolean),
                    ...tasksIconFilterGroups(baseProjectionState.model).map((group) => group.key),
                ]);
                setActiveSwatchFilters((current) => tasksPruneFilterQueryFields(current, activeSwatchKeys));
            }, [activeColorHierarchy, baseProjectionState.model]);
            React.useEffect(() => {
                if (egoState) return;
                const prefsScope = tasksProjectionPrefsKey(activeProjectionId, activeContextId);
                if (lastPersistedPrefsScopeRef.current !== prefsScope) {
                    lastPersistedPrefsScopeRef.current = prefsScope;
                    return;
                }
                const projectionKey = prefsScope;
                const groupingOverridden = tasksGroupByPrefsDifferFromSchema(
                    sourceModel,
                    activeProjectionId,
                    groupByEnabled,
                    groupByHierarchy,
                    groupByDisabledKeys
                );
                const scopedProjectionPrefs = {
                    filters: activeFilters,
                    swatchFilters: activeSwatchFilters,
                    edgeTypes: activeEdgeTypes,
                    edgeTypeFilterEnabled,
                    queryBuilderEnabled,
                    searchEnabled,
                    searchQuery,
                    colorBy: activeColorBy,
                    secondaryColorBy: activeColorHierarchy[1] || '',
                    colorHierarchy: activeColorHierarchy,
                    filtersCollapsed,
                    edgesVisible,
                    hoverInactiveNodes,
                    hoverCardsEnabled,
                    hoverCardMode,
                    edgeOpacity,
                    unspecifiedContentOpacity: projectionUnspecifiedContentOpacity,
                    expandedGroupIds: Array.from(expanded),
                    ...(groupingOverridden ? { groupByEnabled, groupByHierarchy, groupByDisabledKeys } : {}),
                };
                const nextProjectionPrefs = {
                    ...storedProjectionPrefsRef.current,
                    [projectionKey]: scopedProjectionPrefs,
                };
                sourcePrefsRef.current = {
                    ...(sourcePrefsRef.current || {}),
                    projectionId: activeProjectionId,
                    edgeOpacity,
                    unspecifiedContentOpacity: projectionUnspecifiedContentOpacity,
                    groupByEnabled,
                    groupByHierarchy,
                    groupByDisabledKeys,
                    projectionPrefs: nextProjectionPrefs,
                    nodeStates,
                    nodeNotes,
                    edgeNotes,
                    slideNotes,
                };
                storedProjectionPrefsRef.current = nextProjectionPrefs;
                // Writes go through scheduleTasksStorageWrite (debounced + payload-deduped),
                // so persisting on every control change no longer thrashes localStorage.
                writeTasksPrefs(sourceModel, {
                    projectionId: activeProjectionId,
                    edgeOpacity,
                    unspecifiedContentOpacity: projectionUnspecifiedContentOpacity,
                    groupByEnabled,
                    groupByHierarchy,
                    groupByDisabledKeys,
                    projectionPrefs: nextProjectionPrefs,
                    nodeStates,
                    nodeNotes,
                    edgeNotes,
                    slideNotes,
                });
                writeTasksCheckedNodeIds(sourceModel, checkedNodeIdsFromStates(nodeStates));
            }, [egoState, sourceModel, activeFilters, activeSwatchFilters, activeEdgeTypes, edgeTypeFilterEnabled, queryBuilderEnabled, searchEnabled, searchQuery, activeColorHierarchy, activeColorBy, activeContextId, activeProjectionId, filtersCollapsed, edgesVisible, hoverInactiveNodes, hoverCardsEnabled, hoverCardMode, edgeOpacity, projectionUnspecifiedContentOpacity, groupByEnabled, groupByHierarchy, groupByDisabledKeys, expanded, nodeStates, nodeNotes, edgeNotes, slideNotes]);
            const applyProjectionConfigToSidebar = React.useCallback((cfg) => {
                if (!tasksProjectionConfigHasSidebarState(cfg)) return false;
                if (cfg.filterQuery) setActiveFilters(normalizeTasksFilterQuery(cfg.filterQuery));
                if (typeof cfg.queryBuilderEnabled === 'boolean') setQueryBuilderEnabled(cfg.queryBuilderEnabled);
                if (typeof cfg.searchEnabled === 'boolean') setSearchEnabled(cfg.searchEnabled);
                if (typeof cfg.searchQuery === 'string') {
                    setSearchQuery(cfg.searchQuery);
                    setSearchInputValue(cfg.searchQuery);
                }
                if (typeof cfg.filtersCollapsed === 'boolean') setFiltersCollapsed(cfg.filtersCollapsed);
                if (typeof cfg.edgesVisible === 'boolean') setEdgesVisible(cfg.edgesVisible);
                if (cfg.edgeOpacity !== undefined) setEdgeOpacity(clampTasksEdgeOpacity(cfg.edgeOpacity));
                if (cfg.projectionUnspecifiedContentOpacity !== undefined) {
                    setProjectionUnspecifiedContentOpacity(clampTasksProjectionDisplayOpacity(cfg.projectionUnspecifiedContentOpacity));
                }
                const validColorKeys = new Set(tasksColorOptions(model, nodeNotes).map((option) => option.key));
                if (Array.isArray(cfg.colorHierarchy)) setActiveColorHierarchy(normalizeTasksColorHierarchy(cfg.colorHierarchy, model, nodeNotes));
                else if (cfg.colorBy !== undefined || cfg.secondaryColorBy !== undefined) {
                    setActiveColorHierarchy(normalizeTasksColorHierarchy([cfg.colorBy, cfg.secondaryColorBy], model, nodeNotes));
                }
                if (!String(activeProjectionId || '').trim() && Array.isArray(cfg.groupBy)) {
                    setGroupByHierarchy(cfg.groupBy);
                    setGroupByEnabled(cfg.groupBy.some(Boolean));
                    pendingFitActionRef.current = 'mode';
                }
                return true;
            }, [model, nodeNotes, activeProjectionId]);
            const handleDefaultViewPaste = React.useCallback((event) => {
                if (tasksIsFixedMode(viewMode) || String(activeProjectionId || '').trim()) return;
                const text = event.clipboardData?.getData('text/plain') || '';
                const cfg = parseTasksProjectionConfigText(text);
                if (!tasksProjectionConfigHasSidebarState(cfg)) return;
                event.preventDefault();
                applyProjectionConfigToSidebar(cfg);
            }, [activeProjectionId, viewMode, applyProjectionConfigToSidebar]);
            React.useEffect(() => {
                const target = flowWrapperRef.current;
                if (!target) return;
                target.addEventListener('paste', handleDefaultViewPaste, true);
                return () => target.removeEventListener('paste', handleDefaultViewPaste, true);
            }, [handleDefaultViewPaste]);
            const applyLoadedSource = React.useCallback((payload, projectionId = null, options = null) => {
                const nextModel = {
                    ...(payload.model || {}),
                    document_path: sourceModel.document_path,
                    storage_id: sourceModel.storage_id,
                    persistence_id: sourceModel.persistence_id || payload.model?.persistence_id || '',
                };
                const nextGraph = normalizeTasksGraphNodes(payload.graph || buildTasksCollapsedGraph(nextModel), nextModel);
                setSourceModel(nextModel);
                setSourceGraph(nextGraph);
                const wanted = projectionId === null ? activeProjectionId : String(projectionId || '');
                const nextContextId = String(nextModel?.kg_context?.id || '').trim();
                const available = tasksProjectionOptions(nextModel, ganttEnabled, nextContextId).some((option) => option.id === wanted);
                const nextProjectionId = available ? wanted : '';
                setActiveProjectionId(nextProjectionId);
                // Read the mode off the view the way the first load and the view
                // picker both do. Forcing 'graph' sends a fixed layout, such as a
                // sequence, down the ELK path, where the graph-level group_by
                // builds container shapes the fixed layout never places, and ELK
                // throws on the dangling reference.
                setViewMode(tasksLayoutById(tasksProjectionLayout(nextModel, nextProjectionId))?.id || 'graph');
                setSelectedNodeId(null);
                setSelectedNodeIds(new Set());
                setDragSelection(null);
                setHoveredNodeId(null);
                if (options?.resetSlideIndex) setSlideIndex((index) => index >= 0 ? 0 : -1);
                pendingFitActionRef.current = 'mode';
            }, [sourceModel, activeProjectionId, ganttEnabled]);
            const handleSwitchContext = React.useCallback(async (contextId, projectionId = null) => {
                const schemaPath = String(sourceModel?.kg_schema || '').trim();
                if (!schemaPath || !contextId) return;
                if (contextId === activeContextId) {
                    if (projectionId !== null) setActiveProjectionId(String(projectionId || ''));
                    return;
                }
                setContextLoading(true);
                try {
                    const payload = await loadTasksContext({
                        schemaPath,
                        currentPath: sourceModel?.document_path || '',
                        contextId,
                    });
                    applyLoadedSource(payload, projectionId, { resetSlideIndex: true });
                } catch (error) {
                    window.alert(error instanceof Error ? error.message : String(error));
                } finally {
                    setContextLoading(false);
                }
            }, [sourceModel, activeContextId, applyLoadedSource]);
            const handledEdgeHashRef = React.useRef('');
            React.useEffect(() => {
                const hash = String(window.location.hash || '');
                if (!hash.startsWith('#kg/') || handledEdgeHashRef.current === hash) return;
                let parts;
                try {
                    parts = hash.slice(1).split('/').map(decodeURIComponent);
                } catch {
                    handledEdgeHashRef.current = hash;
                    setEdgeCardError('This graph link has invalid encoded text.');
                    setEdgeCardOpen(true);
                    setEdgeStatus('This graph link has invalid encoded text.');
                    return;
                }
                const [, contextId, edgeId, field = ''] = parts;
                if (!contextId || !edgeId || parts.length > 4) {
                    handledEdgeHashRef.current = hash;
                    setEdgeCardError('Use #kg/<context>/<edge-id>[/<field>] for an edge link.');
                    setEdgeCardOpen(true);
                    setEdgeStatus('The graph edge link is incomplete.');
                    return;
                }
                if (!contextOptions.some((context) => String(context.id || '') === contextId)) {
                    handledEdgeHashRef.current = hash;
                    setEdgeCardError(`The graph has no context named ${contextId}.`);
                    setEdgeCardOpen(true);
                    setEdgeStatus(`The graph has no context named ${contextId}.`);
                    return;
                }
                if (activeContextId !== contextId) {
                    handleSwitchContext(contextId);
                    return;
                }
                const record = (model?.dependency_edges || []).find((edge) => String(edge.id || '') === edgeId);
                if (!record) {
                    handledEdgeHashRef.current = hash;
                    setEdgeCardError(`Context ${contextId} has no edge named ${edgeId}.`);
                    setEdgeCardOpen(true);
                    setEdgeStatus(`Context ${contextId} has no edge named ${edgeId}.`);
                    return;
                }
                if (field && !(field in record)) {
                    handledEdgeHashRef.current = hash;
                    setEdgeCardError(`Edge ${edgeId} has no field named ${field}.`);
                    setEdgeCardOpen(true);
                    setEdgeStatus(`Edge ${edgeId} has no field named ${field}.`);
                    return;
                }
                handledEdgeHashRef.current = hash;
                selectEdgeRecord(record, true, field);
            }, [activeContextId, contextOptions, handleSwitchContext, model, selectEdgeRecord]);
            React.useEffect(() => {
                if (!edgeCardOpen || !edgeCardField || edgeCardError) return undefined;
                const timer = window.setTimeout(() => {
                    const selector = `[data-vyasa-edge-field="${CSS.escape(edgeCardField)}"]`;
                    flowWrapperRef.current?.querySelector(selector)?.scrollIntoView({ block: 'nearest' });
                }, 0);
                return () => window.clearTimeout(timer);
            }, [edgeCardOpen, edgeCardError, edgeCardField]);
            const handleAddView = React.useCallback(async () => {
                const schemaPath = String(sourceModel?.kg_schema || '').trim();
                if (!schemaPath) {
                    window.alert('This Knowledge Graph has no kg.schema path.');
                    return;
                }
                const input = await promptTasksViewInput(await readTasksClipboardText());
                if (!input?.title || !input?.content) return;
                try {
                    const payload = await saveTasksTempView({
                        schemaPath,
                        currentPath: sourceModel?.document_path || '',
                        title: input.title,
                        content: input.content,
                    });
                    applyLoadedSource(payload, payload.projection_id || '');
                } catch (error) {
                    window.alert(error instanceof Error ? error.message : String(error));
                }
            }, [sourceModel, applyLoadedSource]);
            const checkedNodeIdSet = React.useMemo(() => new Set(checkedNodeIdsFromStates(nodeStates)), [nodeStates]);
            const selectedLogicalNodeId = React.useMemo(() => {
                const selected = (graphBaseRef.current.nodes || []).find((node) => node.id === selectedNodeId)?.data;
                return tasksLogicalNodeId(selected, selectedNodeId);
            }, [selectedNodeId, graphRevision]);
            const activeSlideId = React.useMemo(() => {
                const slide = slideIndex >= 0 ? slides[slideIndex] : null;
                return String(slide?.id || '').trim();
            }, [slideIndex, slides]);
            const toggleCheckedNode = React.useCallback((nodeId) => {
                const normalizedId = String(nodeId || '').trim();
                if (!normalizedId) return;
                setNodeStates((current) => {
                    const firstState = cardStates[0] || TASKS_DEFAULT_CARD_STATES[0];
                    const currentState = current?.[normalizedId] || firstState;
                    const currentIndex = Math.max(0, cardStates.indexOf(currentState));
                    const nextState = cardStates[(currentIndex + 1) % cardStates.length] || firstState;
                    const next = { ...(current || {}) };
                    if (nextState === firstState) delete next[normalizedId];
                    else next[normalizedId] = nextState;
                    return next;
                });
            }, [cardStates]);
            const updateNodeNote = React.useCallback((nodeId, note) => {
                updateTasksNote(setNodeNotes, nodeId, note);
            }, []);
            const updateEdgeNote = React.useCallback((edgeId, note) => {
                updateTasksNote(setEdgeNotes, edgeId, note);
            }, []);
            const updateSlideNote = React.useCallback((slideId, note) => {
                updateTasksNote(setSlideNotes, slideId, note);
            }, []);
            const latestNodeNotes = React.useCallback(() => {
                const latest = { ...nodeNotes };
                const selectedId = selectedLogicalNodeId;
                if (selectedId) {
                    if (noteInputValue.trim()) latest[selectedId] = noteInputValue;
                    else delete latest[selectedId];
                }
                return latest;
            }, [nodeNotes, selectedLogicalNodeId, noteInputValue]);
            const latestSlideNotes = React.useCallback(() => {
                const latest = { ...slideNotes };
                if (activeSlideId) {
                    if (slideNoteInputValue.trim()) latest[activeSlideId] = slideNoteInputValue;
                    else delete latest[activeSlideId];
                }
                return latest;
            }, [slideNotes, activeSlideId, slideNoteInputValue]);
            const handleExportNodeNotes = React.useCallback(() => {
                try {
                    const filename = downloadTasksNodeNotes(sourceModel, latestNodeNotes(), nodeStates, latestSlideNotes());
                    showVyasaToast(`Downloaded ${filename}`);
                } catch (error) {
                    window.alert(error instanceof Error ? error.message : String(error));
                }
            }, [sourceModel, latestNodeNotes, nodeStates, latestSlideNotes]);
            const handleCopyNodeNotes = React.useCallback(async () => {
                try {
                    const copied = await copyTasksText(buildTasksNodeNotesBackup(sourceModel, latestNodeNotes(), nodeStates, latestSlideNotes()).text);
                    if (!copied) throw new Error('Could not copy Knowledge Graph notes.');
                    showVyasaToast('Copied notes');
                } catch (error) {
                    window.alert(error instanceof Error ? error.message : String(error));
                }
            }, [sourceModel, latestNodeNotes, nodeStates, latestSlideNotes]);
            const handleImportNodeNotes = React.useCallback(async () => {
                try {
                    const imported = await uploadTasksNodeNotes(sourceModel, cardStates);
                    if (imported) {
                        setNodeNotes(imported.nodeNotes);
                        setSlideNotes(imported.slideNotes);
                        setNodeStates(imported.nodeStates);
                    }
                } catch (error) {
                    window.alert(error instanceof Error ? error.message : String(error));
                }
            }, [sourceModel, cardStates]);
            const handleClearAllNotes = React.useCallback(() => {
                const nodeSnapshot = latestNodeNotes();
                const slideSnapshot = latestSlideNotes();
                if (!Object.keys(nodeSnapshot).length && !Object.keys(slideSnapshot).length) return;
                setAllClearedNotes({ nodeNotes: nodeSnapshot, slideNotes: slideSnapshot });
                setNodeNotes({});
                setSlideNotes({});
                setNoteInputValue('');
                setSlideNoteInputValue('');
                setClearedNote(null);
            }, [latestNodeNotes, latestSlideNotes]);
            const handleUndoClearAllNotes = React.useCallback(() => {
                if (!allClearedNotes) return;
                setNodeNotes(allClearedNotes.nodeNotes || {});
                setSlideNotes(allClearedNotes.slideNotes || {});
                if (selectedLogicalNodeId && allClearedNotes.nodeNotes?.[selectedLogicalNodeId]) setNoteInputValue(allClearedNotes.nodeNotes[selectedLogicalNodeId]);
                if (activeSlideId && allClearedNotes.slideNotes?.[activeSlideId]) setSlideNoteInputValue(allClearedNotes.slideNotes[activeSlideId]);
                setAllClearedNotes(null);
            }, [allClearedNotes, selectedLogicalNodeId, activeSlideId]);
            const resetProjectionControls = React.useCallback(() => {
                const defaults = tasksProjectionSchemaPrefs(viewerState.model, activeProjectionId);
                const defaultSearch = typeof defaults.searchQuery === 'string' ? defaults.searchQuery : '';
                setActiveFilters(normalizeTasksFilterQuery(defaults.filters));
                setActiveSwatchFilters(tasksEmptyFilterQuery());
                setActiveEdgeTypes([]);
                setEdgeTypeFilterEnabled(true);
                setEdgeTypeQuery('');
                setQueryBuilderEnabled(typeof defaults.queryBuilderEnabled === 'boolean' ? defaults.queryBuilderEnabled : true);
                setSearchEnabled(typeof defaults.searchEnabled === 'boolean' ? defaults.searchEnabled : true);
                setSearchInputValue(defaultSearch);
                setSearchQuery(defaultSearch);
                setActiveColorHierarchy(resolveTasksPreferredColorHierarchy(model, activeProjectionId, defaults, nodeNotes));
                setGroupByEnabled(defaults.groupByEnabled === true);
                setGroupByHierarchy(Array.isArray(defaults.groupByHierarchy) ? defaults.groupByHierarchy : []);
                setGroupByDisabledKeys(normalizeTasksGroupByDisabledKeys(defaults.groupByDisabledKeys));
                setExpanded(hydrateExpandedSet(defaults));
                setFiltersCollapsed(
                    typeof defaults.filtersCollapsed === 'boolean'
                        ? defaults.filtersCollapsed
                        : !tasksDefaultFiltersOpen(defaultFiltersOpen)
                );
                clearTasksGlobalToggle(TASKS_EDGES_VISIBLE_KEY);
                clearTasksGlobalToggle(TASKS_EDGE_LABELS_VISIBLE_KEY);
                clearTasksGlobalToggle(TASKS_HOVER_CARD_MODE_KEY);
                clearTasksGlobalToggle(TASKS_GROUP_HOVER_CARDS_KEY);
                setEdgesVisible(typeof defaults.edgesVisible === 'boolean' ? defaults.edgesVisible : true);
                setEdgeLabelsVisible(true);
                setGroupHoverCardsEnabled(true);
                setContextDiffEnabled(false);
                setEdgeOpacity(defaults.edgeOpacity !== undefined ? defaults.edgeOpacity : defaultEdgeOpacity);
                setProjectionUnspecifiedContentOpacity(
                    defaults.unspecifiedContentOpacity !== undefined
                        ? defaults.unspecifiedContentOpacity
                        : defaultProjectionUnspecifiedContentOpacity
                );
            }, [viewerState.model, activeProjectionId, model, nodeNotes, hydrateExpandedSet, defaultFiltersOpen, defaultEdgeOpacity, defaultProjectionUnspecifiedContentOpacity]);
            React.useEffect(() => {
                setNoteInputValue(nodeNotes[selectedLogicalNodeId] || '');
                setClearedNote(null);
            }, [selectedLogicalNodeId, nodeNotes]);
            React.useEffect(() => {
                setSlideNoteInputValue(slideNotes[activeSlideId] || '');
            }, [activeSlideId, slideNotes]);
            React.useEffect(() => {
                if (!selectedLogicalNodeId) return undefined;
                const timeoutId = window.setTimeout(() => {
                    updateNodeNote(selectedLogicalNodeId, noteInputValue);
                }, 180);
                return () => window.clearTimeout(timeoutId);
            }, [selectedLogicalNodeId, noteInputValue, updateNodeNote]);
            React.useEffect(() => {
                if (!activeSlideId) return undefined;
                const timeoutId = window.setTimeout(() => {
                    updateSlideNote(activeSlideId, slideNoteInputValue);
                }, 180);
                return () => window.clearTimeout(timeoutId);
            }, [activeSlideId, slideNoteInputValue, updateSlideNote]);
            React.useLayoutEffect(() => {
                const textarea = noteTextareaRef.current;
                if (!textarea) return;
                textarea.style.height = 'auto';
                const computed = window.getComputedStyle(textarea);
                const lineHeight = Number.parseFloat(computed.lineHeight) || 16;
                const padding = Number.parseFloat(computed.paddingTop || '0') + Number.parseFloat(computed.paddingBottom || '0');
                const border = Number.parseFloat(computed.borderTopWidth || '0') + Number.parseFloat(computed.borderBottomWidth || '0');
                const maxHeight = Math.ceil(lineHeight * 15 + padding + border);
                textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
                textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
            }, [noteInputValue, selectedLogicalNodeId, selectedNodeId]);
            const panViewport = React.useCallback((reactFlow, dx, dy, duration = 120) => {
                const viewport = reactFlow.getViewport();
                return reactFlow.setViewport(
                    { x: viewport.x + dx, y: viewport.y + dy, zoom: viewport.zoom },
                    { duration, interpolate: 'linear' }
                );
            }, []);
            const focusGraphNode = React.useCallback((targetId) => {
                const id = String(targetId || '').trim();
                const graphNodes = graphBaseRef.current.nodes || [];
                const targetNode = graphNodes.find((node) => node.id === id)
                    || graphNodes.find((node) => tasksLogicalNodeId(node.data, node.id) === id);
                const reactFlow = reactFlowApiRef.current;
                const wrapperEl = flowWrapperRef.current;
                const escape = window.CSS?.escape || ((value) => String(value).replace(/["\\]/g, '\\$&'));
                const nodeEl = targetNode && wrapperEl
                    ? wrapperEl.querySelector(`.react-flow__node[data-id="${escape(targetNode.id)}"]`)
                    : null;
                logTasksDebug('graphNodeFocus', { widgetId, targetId: id, nodeId: targetNode?.id || '', found: Boolean(targetNode && nodeEl && reactFlow) });
                if (!targetNode || !nodeEl || !reactFlow || !wrapperEl) return false;
                const sourceNodeId = targetNode.data?.__kind__ === 'groupTitle' ? targetNode.data?.sourceGroupId : targetNode.id;
                selectNodeCard(sourceNodeId, targetNode.id, targetNode.data?.__kind__ || '');
                reactFlow.setViewport(tasksCenteredViewport(
                    reactFlow.getViewport(), wrapperEl.getBoundingClientRect(), nodeEl.getBoundingClientRect()
                ), { duration: 240 });
                const previousPulse = focusedNodePulseRef.current;
                window.clearTimeout(previousPulse.timer);
                previousPulse.element?.classList.remove('vyasa-tasks-pulse');
                nodeEl.classList.remove('vyasa-tasks-pulse');
                void nodeEl.offsetWidth;
                nodeEl.classList.add('vyasa-tasks-pulse');
                focusedNodePulseRef.current = {
                    element: nodeEl,
                    timer: window.setTimeout(() => {
                        nodeEl.classList.remove('vyasa-tasks-pulse');
                        focusedNodePulseRef.current = { element: null, timer: 0 };
                    }, 8000),
                };
                return true;
            }, [selectNodeCard, widgetId]);
            const focusNodeReferenceFromEvent = React.useCallback((event) => {
                const reference = event.target instanceof Element
                    ? event.target.closest('[data-vyasa-node-reference]')
                    : null;
                if (!reference || !nodeReferenceKeyHeldRef.current) return false;
                event.preventDefault();
                event.stopPropagation();
                focusGraphNode(String(reference.dataset.vyasaNodeReference || '').trim());
                return true;
            }, [focusGraphNode]);
            const ensureBaseLayout = React.useCallback(async () => {
                if (!baseLayoutRef.current) baseLayoutRef.current = await layoutBaseTasksGraph(layoutRawGraph, layoutModel, jitterConfig, layoutConfig);
                return baseLayoutRef.current;
            }, [layoutRawGraph, layoutModel, jitterConfig, layoutConfig]);
            const rebuildLayout = React.useCallback(async (expandedSet, mode = viewMode) => {
                const layoutStart = tasksPerfNow();
                const revisionKey = `${mode}|${String(model?.graph_id || '')}|${Array.from(expandedSet || []).sort().join(',')}`;
                const revisionCause = lastLayoutRevisionKeyRef.current === revisionKey ? 'visual' : 'layout';
                lastLayoutRevisionKeyRef.current = revisionKey;
                lastGraphRevisionCauseRef.current = revisionCause;
                logTasksColorDebug(model, rawGraph.nodes, activeColorBy, activeColorPalette, colorMix);
                if (tasksIsFixedMode(mode)) {
                    const edgeColorPalette = tasksEdgeColorPaletteFor(model, model?.edge_color_by);
                    const nodesWithStyle = rawGraph.nodes.map((node) => {
                        if (TASKS_PASSIVE_NODE_KINDS.has(node.__kind__)) {
                            const passiveZ = Number.isFinite(node.__z__) ? node.__z__ : 1;
                            // An activation bar borrows the colour of the lane it
                            // sits on, so a frame reads as that lifeline executing
                            // rather than as a grey box laid over it.
                            const lane = node.__sequence_lane__
                                ? (model?.tasks || []).find((task) => task.id === node.__sequence_lane__)
                                : null;
                            const laneColor = lane
                                ? (resolveTasksNodeColor(lane, model, activeColorBy, activeColorPalette) || defaultNodeColor)
                                : '';
                            return {
                                id: node.id,
                                type: 'vyasaTask',
                                position: node.position,
                                data: laneColor ? { ...node, __sequence_color__: laneColor } : node,
                                // The wrapper stays transparent to the pointer even when
                                // the node is selectable: only the small part the
                                // renderer marks as interactive takes a click.
                                style: { width: node.width, height: node.height, zIndex: passiveZ, background: 'transparent', border: 'none', pointerEvents: 'none' },
                                zIndex: passiveZ,
                                className: 'vyasa-tasks-node--passive',
                                draggable: false,
                                selectable: isTasksGraphNodeSelectable(node.__kind__),
                            };
                        }
                        const logicalNodeId = tasksLogicalNodeId(node, node.id);
                        const isChecked = checkedNodeIdSet.has(logicalNodeId);
                        const hasNote = Boolean((nodeNotes[logicalNodeId] || '').trim());
                        const colorNode = { ...node, __has_note__: hasNote };
                        const ownNodeColor = resolveTasksNodeColor(colorNode, model, activeColorBy, activeColorPalette);
                        const nodeColor = ownNodeColor || defaultNodeColor;
                        const colorLevels = tasksNodeColorLevels(colorNode, model, activeColorLevelSpecs, colorMix);
                        const useOverlay = tasksUseColorOverlay(colorLevels);
                        const cardState = tasksCardStateForNode(sourceModel, nodeStates, logicalNodeId, cardStates);
                        const stateAccent = cardState.color || TASKS_DONE_ACCENT;
                        if (node.__sequence_lifeline__) {
                            return {
                                id: node.id,
                                type: 'vyasaTask',
                                position: node.position,
                                data: { ...node, __z__: TASKS_TASK_Z, __sequence_color__: nodeColor, __checked__: isChecked, __has_note__: hasNote, __card_state__: cardState.label, __card_state_color__: cardState.color },
                                style: { width: node.width, height: node.height, zIndex: TASKS_TASK_Z, background: 'transparent', border: 'none', overflow: 'visible' },
                                zIndex: TASKS_TASK_Z,
                                className: 'vyasa-tasks-node--selectable',
                                draggable: false,
                                selectable: true,
                            };
                        }
                        return {
                            id: node.id,
                            type: 'vyasaTask',
                            position: node.position,
                            data: { ...node, __checked__: isChecked, __card_state__: cardState.label, __card_state_color__: cardState.color, __has_note__: hasNote, __default_color__: ownNodeColor ? '' : defaultNodeColor, __color_levels__: useOverlay ? colorLevels : null },
                            style: {
                                width: node.width,
                                height: node.height,
                                zIndex: TASKS_TASK_Z,
                                background: useOverlay ? 'transparent' : tasksNodeBackground(nodeColor, '', colorMix, TASKS_NODE_BG, false),
                                border: isChecked
                                    ? `2px solid color-mix(in srgb, ${stateAccent} 78%, white 22%)`
                                    : (nodeColor ? `1px solid color-mix(in srgb, var(--vyasa-paper) 28%, ${nodeColor} 72%)` : TASKS_NODE_BORDER),
                                borderRadius: 6,
                                boxShadow: isChecked
                                    ? `inset 0 0 0 2px color-mix(in srgb, ${stateAccent} 24%, transparent), 0 0 0 2px color-mix(in srgb, ${stateAccent} 34%, transparent)`
                                    : 'none',
                                overflow: 'hidden',
                            },
                            zIndex: TASKS_TASK_Z,
                            className: 'vyasa-tasks-node--selectable',
                            draggable: false,
                            selectable: true,
                        };
                    });
                    const authoredRawEdges = (rawGraph.edges || []).filter((edge) => !edge.__reference__);
                    // A layout that declares authoredHandles has already pinned every
                    // handle itself -- a sequence row puts both ends at the row height --
                    // so the generic anchor solver must not spread them around the node.
                    const authoredHandles = Boolean(tasksFixedLayout(mode)?.authoredHandles);
                    const solved = authoredHandles
                        ? {
                            edges: authoredRawEdges,
                            nodeHandles: Object.fromEntries((rawGraph.nodes || [])
                                .filter((node) => node.handleLayout)
                                .map((node) => [node.id, node.handleLayout])),
                        }
                        : buildTaskEdgeAnchors(nodesWithStyle, authoredRawEdges);
                    // A layout that authors its own handles has already put both
                    // halves on the same two points, so only the solved case
                    // needs the reply to borrow its call's handles.
                    const anchored = tasksApplyEdgePairs(solved, activeProjection?.pair_by || model?.pair_by, !authoredHandles);
                    const visibleReferenceRecords = tasksVisibleReferenceEdges(referenceEdgeRecords, nodesWithStyle, model);
                    const referenceAnchored = buildTaskEdgeAnchors(nodesWithStyle, visibleReferenceRecords, 'reference-');
                    // A pair is drawn in one element, so the call needs its mate's colour
                    // as well as its own. Resolve every colour up front rather than
                    // reaching back into the map from inside it.
                    const pairMateColors = new Map(anchored.edges.map((item) => [item.id, resolveTasksEdgeColor(item, model, model?.edge_color_by, edgeColorPalette)]));
                    const baseEdges = anchored.edges.map((edge) => {
                        const edgeColor = resolveTasksEdgeColor(edge, model, model?.edge_color_by, edgeColorPalette);
                        const resolvedLabel = resolveTasksEdgeLabel(edge, model, activeProjection);
                        const rowLabel = edge.__sequence_step__
                            ? `${edge.__sequence_step__} \u00b7 ${resolvedLabel}`.trim()
                            : resolvedLabel;
                        // A lifeline is a full-height column, so a row that crosses one
                        // must draw over it, not behind it.
                        const rowZ = tasksFixedLayout(mode)?.edgesOverNodes ? TASKS_TASK_Z + 10 : TASKS_EDGE_Z;
                        return {
                            ...edge,
                            label: rowLabel,
                            type: 'vyasaEdge',
                            data: {
                                ...(edge.data || {}),
                                edgeColor,
                                // Both halves of a pair share a row, so their labels
                                // must not share a side of it.
                                __sequence_label_lift__: mode === 'sequence'
                                    ? (edge.__pair_half__ === 'reply' ? -TASKS_SEQUENCE_LABEL_LIFT : TASKS_SEQUENCE_LABEL_LIFT)
                                    : 0,
                                __pair_half__: edge.__pair_half__ || '',
                                __pair_mate__: edge.__pair_mate__ || '',
                                __pair_lift__: Number(edge.__pair_lift__) || 0,
                                __pair_mate_stroke__: pairMateColors.get(edge.__pair_mate__) || '',
                                __sequence_uml__: Boolean(edge.__sequence_uml__),
                                __sequence_message__: edge.__sequence_message__ || '',
                                __sequence_label_dy__: Number(edge.__sequence_label_dy__) || 0,
                                __labels_off__: !edgeLabelsVisible,
                                __line_off__: Boolean(edge.__sequence_line_off__),
                                // The prominent label is an HTML overlay, so it needs a z of
                                // its own to clear the ribbon this layout draws over the cards.
                                __label_z__: rowZ + 1,
                                ...(tasksFixedLayout(mode)?.edgesOverNodes ? { __z__: rowZ } : {}),
                            },
                            markerEnd: { type: rf.MarkerType.ArrowClosed, width: 8, height: 8, color: edgeColor || 'currentColor' },
                            zIndex: rowZ,
                            labelStyle: { fontSize: hoverFontSize, fontWeight: 600, fill: edgeColor || TASKS_EDGE_LABEL_TEXT, opacity: edgeOpacity },
                            labelBgStyle: { fill: TASKS_EDGE_LABEL_BG, fillOpacity: 0.82 },
                            style: {
                                strokeWidth: 2.5,
                                opacity: edgeOpacity,
                                stroke: edgeColor || 'currentColor',
                                ...(edge.__sequence_standing__ ? { strokeDasharray: '6 5', strokeWidth: 1.8 } : {}),
                                ...(edge.__pair_half__ ? { strokeWidth: 1.9 } : {}),
                            },
                        };
                    });
                    referenceEdgesRef.current = referenceAnchored.edges.map((edge) => tasksReferenceFlowEdge(edge, rf.MarkerType.ArrowClosed, hoverFontSize, layoutConfig.edgeLabelWidth));
                    const anchoredNodes = nodesWithStyle.map((node) => ({
                        ...node,
                        data: { ...node.data, handleLayout: tasksMergeHandleLayouts(anchored.nodeHandles[node.id], referenceAnchored.nodeHandles[node.id]) },
                    }));
                    graphBaseRef.current = { nodes: anchoredNodes, edges: baseEdges };
                    setNodes(anchoredNodes);
                    setEdges(edgesVisible ? baseEdges : []);
                    setGraphRevision((value) => value + 1);
                    logTasksPerf('kg-layout', {
                        widgetId,
                        mode,
                        graphId: model?.graph_id || '',
                        expandedCount: expandedSet?.size || 0,
                        rawNodes: (rawGraph.nodes || []).length,
                        rawEdges: (rawGraph.edges || []).length,
                        nodes: anchoredNodes.length,
                        edges: baseEdges.length,
                        totalMs: Math.round((tasksPerfNow() - layoutStart) * 10) / 10,
                    });
                    return;
                }
                const effectiveExpandedSet = effectiveExpandedGroups(model, expandedSet);
                const baseLayout = await ensureBaseLayout();
                const baseDone = tasksPerfNow();
                groupLayoutsRef.current = await layoutExpandedGroups(layoutModel, effectiveExpandedSet, jitterConfig, layoutConfig, true);
                const groupsDone = tasksPerfNow();
                const rootGraph = { ...buildProjectedRootTasksGraph(layoutRawGraph, layoutModel), enforceRootRank: true };
                const derived = await deriveSquishedExpandedLayout(rootGraph, layoutModel, effectiveExpandedSet, baseLayout, groupLayoutsRef.current, layoutConfig);
                const derivedDone = tasksPerfNow();
                const derivedById = Object.fromEntries((derived.nodes || []).map((node) => [node.id, node]));
                const unspecifiedProjectionGroupIds = new Set(
                    (derived.nodes || [])
                        .filter((node) => isTasksUnspecifiedProjectionGroup(node, TASKS_PROJECTION_UNSPECIFIED_LABEL))
                        .map((node) => node.id)
                );
                const depthOf = (node) => {
                    let depth = 0;
                    let parent = node.parentId ? derivedById[node.parentId] : null;
                    while (parent) {
                        depth += 1;
                        parent = parent.parentId ? derivedById[parent.parentId] : null;
                    }
                    return depth;
                };
                const absolutePosition = (node) => {
                    let x = node.position.x;
                    let y = node.position.y;
                    let parent = node.parentId ? derivedById[node.parentId] : null;
                    while (parent) {
                        x += parent.position.x;
                        y += parent.position.y;
                        parent = parent.parentId ? derivedById[parent.parentId] : null;
                    }
                    return { x, y };
                };
                const isInUnspecifiedProjectionBranch = (node) => {
                    if (unspecifiedProjectionGroupIds.has(node.id)) return true;
                    let parent = node.parentId ? derivedById[node.parentId] : null;
                    while (parent) {
                        if (unspecifiedProjectionGroupIds.has(parent.id)) return true;
                        parent = parent.parentId ? derivedById[parent.parentId] : null;
                    }
                    return false;
                };
                const unspecifiedProjectionBranchIds = new Set(
                    (derived.nodes || []).filter(isInUnspecifiedProjectionBranch).map((node) => node.id)
                );
                const baseNodes = derived.nodes.map((n) => {
                    const isExpanded = n.__kind__ === 'group' && effectiveExpandedSet.has(n.id);
                    const hitArea = tasksGraphNodeHitArea(n.__kind__, isExpanded);
                    const depth = depthOf(n);
                    const nodeZ = n.__kind__ !== 'group'
                        ? TASKS_TASK_Z + depth
                        : ((isExpanded ? TASKS_GROUP_BG_Z : TASKS_GROUP_Z) + depth);
                    const logicalNodeId = tasksLogicalNodeId(n, n.id);
                    const isChecked = checkedNodeIdSet.has(logicalNodeId);
                    const hasNote = Boolean((nodeNotes[logicalNodeId] || '').trim());
                    const colorNode = { ...n, __has_note__: hasNote };
                    const ownNodeColor = resolveTasksNodeColor(colorNode, model, activeColorBy, activeColorPalette);
                    const nodeColor = ownNodeColor || defaultNodeColor;
                    const nodeImage = resolveTasksNodeImage(n, model);
                    const collapsedGroupColor = !isExpanded ? resolveTasksCollapsedGroupColor(colorNode, model, activeColorBy, activeColorPalette) : '';
                    const isProjectionGroup = n.__kind__ === 'group' && n.__projection_group__;
                    const projectionGroupTone = isProjectionGroup ? resolveTasksProjectionGroupDimensionColor(n, model) : '';
                    const groupColor = isExpanded
                        ? (projectionGroupTone || nodeColor)
                        : (collapsedGroupColor || projectionGroupTone || nodeColor);
                    const colorLevels = tasksNodeColorLevels(colorNode, model, activeColorLevelSpecs, colorMix, { collapsedGroup: n.__kind__ === 'group' && !isExpanded });
                    const useOverlay = !isExpanded && tasksUseColorOverlay(colorLevels);
                    const isUnspecifiedProjectionGroup = isTasksUnspecifiedProjectionGroup(n, TASKS_PROJECTION_UNSPECIFIED_LABEL);
                    const groupFillExpanded = isProjectionGroup
                        ? (isUnspecifiedProjectionGroup ? projectionUnspecifiedGroupExpandedOpacity : projectionGroupExpandedOpacity)
                        : 0;
                    const groupFillCollapsed = isProjectionGroup
                        ? (isUnspecifiedProjectionGroup ? projectionUnspecifiedGroupOpacity : projectionGroupOpacity)
                        : 14;
                    const groupBorderMix = isProjectionGroup ? 28 : 70;
                    const cardState = tasksCardStateForNode(sourceModel, nodeStates, logicalNodeId, cardStates);
                    const stateAccent = cardState.color || TASKS_DONE_ACCENT;
                    const background = n.__kind__ === 'group'
                        ? (isExpanded
                            ? tasksGroupBackground(groupColor, '', TASKS_GROUP_EXPANDED_BG, { mode: 'transparent', intensity: groupFillExpanded })
                            : tasksGroupBackground(groupColor, '', TASKS_GROUP_BG, { intensity: groupFillCollapsed }))
                        : tasksNodeBackground(nodeColor, '', colorMix, TASKS_NODE_BG, false);
                    const border = groupColor
                        ? (n.__kind__ === 'group'
                            ? `1px solid color-mix(in srgb, var(--vyasa-paper) ${100 - groupBorderMix}%, ${groupColor} ${groupBorderMix}%)`
                            : `1px solid color-mix(in srgb, var(--vyasa-paper) 30%, ${nodeColor} 70%)`)
                        : TASKS_NODE_BORDER;
                    const branchOpacity = isInUnspecifiedProjectionBranch(n) ? projectionUnspecifiedContentOpacity : 1;
                    const rfNode = {
                        id: n.id,
                        type: 'vyasaTask',
                        position: n.position,
                        data: { ...n, __checked__: isChecked, __card_state__: cardState.label, __card_state_color__: cardState.color, __has_note__: hasNote, __node_image__: nodeImage, __default_color__: ownNodeColor ? '' : defaultNodeColor, __projection_branch_opacity__: branchOpacity, __color_levels__: useOverlay ? colorLevels : null },
                        style: {
                            width: n.width,
                            height: n.height,
                            zIndex: nodeZ,
                            background: useOverlay ? 'transparent' : background,
                            border: isChecked
                                ? `2px solid color-mix(in srgb, ${stateAccent} 78%, white 22%)`
                                : border,
                            borderRadius: isExpanded ? 12 : 6,
                            boxShadow: isChecked
                                ? `inset 0 0 0 2px color-mix(in srgb, ${stateAccent} 24%, transparent), 0 0 0 2px color-mix(in srgb, ${stateAccent} 34%, transparent)`
                                : 'none',
                            opacity: branchOpacity,
                            overflow: 'hidden',
                        },
                        zIndex: nodeZ,
                        className: [
                            `vyasa-tasks-node--${hitArea}`,
                            isExpanded ? 'vyasa-tasks-node--expanded-group' : '',
                        ].filter(Boolean).join(' '),
                        draggable: nodeConnectionExperiment,
                        selectable: isTasksGraphNodeSelectable(n.__kind__, isExpanded),
                    };
                    if (n.parentId) {
                        rfNode.parentId = n.parentId;
                        rfNode.extent = 'parent';
                    }
                    return rfNode;
                });
                for (const n of derived.nodes) {
                    if (n.__kind__ !== 'group' || !effectiveExpandedSet.has(n.id)) continue;
                    const position = absolutePosition(n);
                    const titleZ = TASKS_TITLE_Z + depthOf(n);
                    const titleWidth = Math.max(80, n.width - 16);
                    const titleImage = resolveTasksNodeImage(n, model);
                    const titleHeight = sizeTaskNode(n.label || n.id, 'groupTitle', titleWidth, { hasImage: Boolean(titleImage), nodeLabels: edgeNodeLabels }).height;
                    const titleOpacity = isInUnspecifiedProjectionBranch(n) ? projectionUnspecifiedContentOpacity : 1;
                    baseNodes.push({
                        id: `${n.id}__title`,
                        type: 'vyasaTask',
                        position: { x: position.x + 8, y: position.y + 8 },
                        data: { ...n, id: `${n.id}__title`, sourceGroupId: n.id, __kind__: 'groupTitle', __node_image__: titleImage, __projection_branch_opacity__: titleOpacity },
                        style: {
                            width: titleWidth,
                            height: titleHeight,
                            zIndex: titleZ,
                            background: TASKS_GROUP_TITLE_BG,
                            border: 'none',
                            borderRadius: 6,
                            boxShadow: 'none',
                            overflow: 'hidden',
                            opacity: titleOpacity,
                            pointerEvents: 'auto',
                        },
                        zIndex: titleZ,
                        className: `vyasa-tasks-node--${tasksGraphNodeHitArea('groupTitle')}`,
                        draggable: false,
                        selectable: isTasksGraphNodeSelectable('groupTitle'),
                    });
                }
                const authoredDerivedEdges = (derived.edges || []).filter((edge) => !edge.__reference__);
                const solvedAnchors = buildTaskEdgeAnchors(baseNodes, authoredDerivedEdges);
                const anchored = tasksApplyEdgePairs(solvedAnchors, activeProjection?.pair_by || model?.pair_by);
                const visibleReferenceRecords = tasksVisibleReferenceEdges(referenceEdgeRecords, baseNodes, model);
                const referenceAnchored = buildTaskEdgeAnchors(baseNodes, visibleReferenceRecords, 'reference-');
                const edgeColorPalette = tasksEdgeColorPaletteFor(model, model?.edge_color_by);
                // A pair is drawn in one element, so the call needs its mate's colour
                // as well as its own. Resolve every colour up front rather than
                // reaching back into the map from inside it.
                const pairMateColors = new Map(anchored.edges.map((item) => [item.id, resolveTasksEdgeColor(item, model, model?.edge_color_by, edgeColorPalette)]));
                const baseEdges = anchored.edges.map((edge) => {
                    const edgeColor = resolveTasksEdgeColor(edge, model, model?.edge_color_by, edgeColorPalette);
                    const resolvedLabel = resolveTasksEdgeLabel(edge, model, activeProjection);
                    const branchOpacity = (unspecifiedProjectionBranchIds.has(edge.source) || unspecifiedProjectionBranchIds.has(edge.target))
                        ? projectionUnspecifiedContentOpacity
                        : 1;
                    return {
                        ...edge,
                        label: resolvedLabel,
                        type: 'vyasaEdge',
                        data: {
                            ...(edge.data || {}),
                            edgeColor,
                            __projection_branch_opacity__: branchOpacity,
                            __pair_half__: edge.__pair_half__ || '',
                            __pair_mate__: edge.__pair_mate__ || '',
                            __pair_lift__: Number(edge.__pair_lift__) || 0,
                            __pair_mate_stroke__: pairMateColors.get(edge.__pair_mate__) || '',
                            __sequence_uml__: Boolean(edge.__sequence_uml__),
                            __sequence_message__: edge.__sequence_message__ || '',
                            __sequence_label_dy__: Number(edge.__sequence_label_dy__) || 0,
                            __labels_off__: !edgeLabelsVisible,
                            __line_off__: Boolean(edge.__sequence_line_off__),
                        },
                        markerEnd: {
                            type: rf.MarkerType.ArrowClosed,
                            width: 8,
                            height: 8,
                            color: edgeColor || 'currentColor',
                        },
                        zIndex: TASKS_EDGE_Z,
                        labelBgPadding: [6, 3],
                        labelBgBorderRadius: 3,
                        labelZIndex: TASKS_EDGE_LABEL_Z,
                        labelMaxWidth: layoutConfig.edgeLabelWidth,
                        labelStyle: { fontSize: hoverFontSize, fontWeight: 600, fill: edgeColor || TASKS_EDGE_LABEL_TEXT, opacity: edgeOpacity * branchOpacity },
                        labelBgStyle: { fill: TASKS_EDGE_LABEL_BG, fillOpacity: 0.82 },
                        style: { strokeWidth: 2.5, opacity: edgeOpacity * branchOpacity, stroke: edgeColor || 'currentColor' },
                    };
                });
                const anchoredNodes = baseNodes.map((node) => ({
                    ...node,
                    data: {
                        ...node.data,
                        handleLayout: nodeConnectionExperiment
                            ? TASKS_NODE_CONNECTION_HANDLES
                            : tasksMergeHandleLayouts(anchored.nodeHandles[node.id], referenceAnchored.nodeHandles[node.id]),
                        __debug_position__: showDebugPositions
                            ? { x: Math.round(absolutePosition(node).x), y: Math.round(absolutePosition(node).y) }
                            : undefined,
                    },
                }));
                referenceEdgesRef.current = referenceAnchored.edges.map((edge) => tasksReferenceFlowEdge(edge, rf.MarkerType.ArrowClosed, hoverFontSize, layoutConfig.edgeLabelWidth));
                graphBaseRef.current = { nodes: anchoredNodes, edges: baseEdges };
                window.__vyasaTasksDebug.latest = {
                    widgetId,
                    activeProjectionId,
                    activeProjectionLabel: activeProjection?.label || '',
                    viewMode,
                    expanded: Array.from(expandedSet),
                    effectiveExpanded: Array.from(effectiveExpandedSet),
                    rawGraphNodeCount: (rawGraph.nodes || []).length,
                    rawGraphEdgeCount: (rawGraph.edges || []).length,
                    renderedNodeCount: anchoredNodes.length,
                    renderedEdgeCount: baseEdges.length,
                    nodes: anchoredNodes.map((node) => ({
                        id: node.id,
                        label: node.data?.label,
                        kind: node.data?.__kind__,
                        parentId: node.parentId || null,
                        position: rectSummary({ ...node.position, width: node.style?.width, height: node.style?.height }),
                    })),
                    edges: baseEdges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target, label: edge.label || '' })),
                };
                logTasksDebugVerbose('reactFlowState', window.__vyasaTasksDebug.latest);
                setNodes(anchoredNodes);
                setEdges(edgesVisible ? baseEdges : []);
                setGraphRevision((value) => value + 1);
                logTasksPerf('kg-layout', {
                    widgetId,
                    mode,
                    graphId: model?.graph_id || '',
                    activeProjectionId,
                    groups: (model.groups || []).length,
                    tasks: (model.tasks || []).length,
                    rawNodes: (rawGraph.nodes || []).length,
                    rawEdges: (rawGraph.edges || []).length,
                    expandedCount: expandedSet?.size || 0,
                    effectiveExpandedCount: effectiveExpandedSet.size,
                    rootGraphNodes: (rootGraph.nodes || []).length,
                    rootGraphEdges: (rootGraph.edges || []).length,
                    derivedNodes: (derived.nodes || []).length,
                    derivedEdges: (derived.edges || []).length,
                    nodes: anchoredNodes.length,
                    edges: baseEdges.length,
                    baseLayoutMs: Math.round((baseDone - layoutStart) * 10) / 10,
                    groupLayoutsMs: Math.round((groupsDone - baseDone) * 10) / 10,
                    deriveMs: Math.round((derivedDone - groupsDone) * 10) / 10,
                    totalMs: Math.round((tasksPerfNow() - layoutStart) * 10) / 10,
                });
            }, [ensureBaseLayout, model, layoutModel, layoutRawGraph, sourceModel, activeColorBy, activeColorPalette, activeColorLevelSpecs, activeProjection, viewMode, edgesVisible, edgeLabelsVisible, edgeOpacity, projectionUnspecifiedContentOpacity, checkedNodeIdSet, nodeStates, nodeNotes, cardStates, defaultNodeColor, referenceEdgeRecords, edgeNodeLabels]);
            const defaultEdgeOptions = React.useMemo(() => ({
                zIndex: TASKS_EDGE_Z,
                style: { strokeWidth: 2.5, opacity: edgeOpacity, stroke: 'currentColor' },
            }), [edgeOpacity]);
            // Highlight passes rebuild every node/edge object; route them through
            // tasksReuseGraphElements so unchanged elements keep their identity
            // (memoized components skip) and a no-op pass skips the update.
            const setNodesReusing = React.useCallback((nextNodes) => {
                setNodes((prev) => tasksReuseGraphElements(prev, nextNodes.map(tasksGraphPaint)));
            }, []);
            const setEdgesReusing = React.useCallback((nextEdges) => {
                setEdges((prev) => tasksReuseGraphElements(prev, nextEdges.map(tasksGraphPaint)));
            }, []);
            const applyHighlight = React.useCallback((nodeId, hoveredNodeId = null, selectedIds = new Set(), edgeId = '') => {
                const baseNodes = graphBaseRef.current.nodes || [];
                const authoredEdges = tasksEdgesMatchingTypes(graphBaseRef.current.edges || [], effectiveEdgeTypes);
                const activeReferenceNodeIds = new Set([
                    nodeId,
                    hoveredNodeId,
                    ...(selectedIds instanceof Set ? selectedIds : new Set(selectedIds || [])),
                ].filter(Boolean));
                const activeReferenceEdges = tasksEdgesMatchingTypes(referenceEdgesRef.current, effectiveEdgeTypes)
                    .filter((edge) => (
                        tasksEdgeRecordId(edge) === edgeId
                        || activeReferenceNodeIds.has(edge.source)
                        || activeReferenceNodeIds.has(edge.target)
                    ));
                const baseEdges = [...authoredEdges, ...activeReferenceEdges];
                const displayedEdges = edgesVisible ? baseEdges : activeReferenceEdges;
                const selectedEdge = edgeId ? baseEdges.find((edge) => tasksEdgeRecordId(edge) === edgeId) : null;
                if (selectedEdge) {
                    const endpointIds = new Set([selectedEdge.source, selectedEdge.target]);
                    // A call and its reply are one exchange. Previewing half of a
                    // double harpoon and leaving the other half dim would cut the
                    // exchange in two, so the mate lights with it. Only the half
                    // under the cursor keeps the bloom, so the open card is still
                    // traceable to the line it came from.
                    const mateId = String(selectedEdge.data?.__pair_mate__ || '');
                    setNodesReusing(baseNodes.map((node) => {
                        const sourceNodeId = node.data?.__kind__ === 'groupTitle' ? node.data?.sourceGroupId : node.id;
                        const hit = endpointIds.has(sourceNodeId);
                        const nodeColor = resolveTasksNodeColor(node.data, model, activeColorBy, activeColorPalette) || 'var(--vyasa-primary)';
                        return {
                            ...node,
                            data: { ...node.data, highlightMode: hit ? 'selected' : 'dim', __hover_outline__: hit },
                            style: {
                                ...node.style,
                                opacity: hit ? 1 : (node.data?.__projection_branch_opacity__ ?? 1) * 0.18,
                                '--vyasa-tasks-active-border': hit ? nodeColor : undefined,
                                boxShadow: hit ? `0 0 0 2px color-mix(in srgb, ${nodeColor} 70%, transparent)` : node.style.boxShadow,
                            },
                        };
                    }));
                    setEdgesReusing(displayedEdges.map((edge) => {
                        const focused = edge === selectedEdge;
                        const hit = focused || (Boolean(mateId) && tasksEdgeRecordId(edge) === mateId);
                        const edgeColor = edge.data?.edgeColor || edge.style?.stroke || 'currentColor';
                        // A focus stroke of 4.5 would close the gap a pair is drawn
                        // with, turning the two harpoons back into one fat line.
                        const focusWidth = edge.data?.__pair_half__ ? 2.6 : 4.5;
                        return {
                            ...edge,
                            zIndex: hit ? TASKS_EDGE_FOCUS_Z : TASKS_EDGE_Z,
                            labelZIndex: hit ? TASKS_EDGE_LABEL_FOCUS_Z : TASKS_EDGE_LABEL_Z,
                            // A pair is ONE exchange, so its two halves answer together. `hit` already
                            // lights the mate's stroke, colour and z-order. edgeCardActive is what
                            // keeps an edge's words while Shift+E has the labels off, so leaving it
                            // on the clicked half alone showed a call with no reply -- and a paired
                            // half claims only a 3px hit path, so the reader cannot click the other.
                            data: { ...edge.data, highlightMode: hit ? 'selected' : 'dim', strokeMode: hit ? 'selected' : 'dim', edgeCardActive: hit, pinBloomKey: focused && edgePinBloom?.edgeId === tasksEdgeRecordId(edge) ? edgePinBloom.key : '' },
                            labelStyle: { ...(edge.labelStyle || {}), fill: hit ? edgeColor : 'color-mix(in srgb, var(--vyasa-ink) 26%, transparent)', opacity: hit ? 1 : 0.12 },
                            labelBgStyle: { ...(edge.labelBgStyle || {}), fill: TASKS_EDGE_LABEL_BG, fillOpacity: hit ? 0.86 : 0.04 },
                            style: { ...edge.style, stroke: hit ? edgeColor : 'color-mix(in srgb, var(--vyasa-ink) 38%, transparent)', opacity: hit ? 1 : 0.08, strokeWidth: hit ? focusWidth : (edge.data?.__pair_half__ ? 1.9 : 2.5) },
                        };
                    }));
                    return;
                }
                // When no single node is selected, hovering a node should still reveal
                // its checkbox. Carry it as a data flag (not the closure) so the
                // memoized node updates without forcing the per-hover remount.
                const hoverCheckboxId = !nodeId && hoveredNodeId ? hoveredNodeId : null;
                // A bar and a fragment box are not edge endpoints, so comparing ids
                // to them matches nothing and hovering one dimmed the whole view.
                // Chrome names the edges it stands for; everything else keeps the
                // endpoint test, so no ordinary node changes behaviour.
                const hoveredEdgeIds = new Set(
                    baseNodes.find((node) => node.id === hoveredNodeId)?.data?.__edge_ids__ || []
                );
                const touchesHovered = (edge) => (hoveredEdgeIds.size
                    ? hoveredEdgeIds.has(edge.id)
                    : (edge.source === hoveredNodeId || edge.target === hoveredNodeId));
                // Direction still has to be read from a real endpoint: a call
                // arrives at the lane the bar sits on and its reply leaves it, so
                // the bar borrows that lane to tell the two apart.
                const hoverDirectionId = baseNodes.find((node) => node.id === hoveredNodeId)
                    ?.data?.__sequence_lane__ || hoveredNodeId;
                const multiSelectedIds = selectedIds instanceof Set ? selectedIds : new Set(selectedIds || []);
                const multiSelectedHighlightIds = new Set(multiSelectedIds);
                for (const selectedId of multiSelectedIds) {
                    for (const descendantId of collectTasksGroupDescendantIds(selectedId, model)) {
                        multiSelectedHighlightIds.add(descendantId);
                    }
                }
                const hasNodeSelection = nodeId && baseNodes.some((node) => node.id === nodeId);
                if (!hasNodeSelection && multiSelectedIds.size > 0) {
                    const multiHoverEndpointIds = new Set(hoveredNodeId ? [hoveredNodeId] : []);
                    if (hoveredNodeId) {
                        for (const edge of baseEdges) {
                            if (touchesHovered(edge)) {
                                multiHoverEndpointIds.add(edge.source);
                                multiHoverEndpointIds.add(edge.target);
                            }
                        }
                    }
                    setNodesReusing(baseNodes.map((node) => {
                        const sourceGroupId = node.data?.__kind__ === 'groupTitle' ? node.data?.sourceGroupId : null;
                        const logicalId = sourceGroupId || node.id;
                        const hovered = Boolean(hoveredNodeId) && logicalId === hoveredNodeId;
                        const hoverNeighbor = !hovered && multiHoverEndpointIds.has(logicalId);
                        const inSelection = multiSelectedHighlightIds.has(node.id) || (sourceGroupId && multiSelectedHighlightIds.has(sourceGroupId));
                        const selected = inSelection || hovered || hoverNeighbor;
                        const nodeColor = resolveTasksNodeColor(node.data, model, activeColorBy, activeColorPalette);
                        const collapsedGroupColor = node.data?.__kind__ === 'group' && !expanded.has(node.id)
                            ? resolveTasksCollapsedGroupColor(node.data, model, activeColorBy, activeColorPalette)
                            : '';
                        const displayColor = collapsedGroupColor || nodeColor || 'var(--vyasa-primary)';
                        const activeBorderColor = node.data?.__checked__ ? (node.data?.__card_state_color__ || TASKS_DONE_ACCENT) : displayColor;
                        return {
                            ...node,
                            data: {
                                ...node.data,
                                highlightMode: hovered ? 'selected-focus' : (hoverNeighbor ? 'neighbor' : (selected ? 'selected' : 'dim')),
                                __hover_checkbox__: node.id === hoverCheckboxId,
                                __hover_outline__: hovered || hoverNeighbor,
                            },
                            style: {
                            ...node.style,
                                opacity: (node.data?.__projection_branch_opacity__ ?? 1) * (selected ? 1 : 0.18),
                                '--vyasa-tasks-active-border': selected ? activeBorderColor : undefined,
                                boxShadow: selected
                                    ? `0 0 0 2px color-mix(in srgb, ${displayColor} 70%, transparent), 0 0 18px 4px color-mix(in srgb, ${displayColor} 34%, transparent)`
                                    : node.style.boxShadow,
                            },
                        };
                    }));
                    setEdgesReusing(displayedEdges.map((edge) => {
                        const touchesHover = Boolean(hoveredNodeId) && touchesHovered(edge);
                        const hit = touchesHover
                            || (multiSelectedHighlightIds.has(edge.source) && multiSelectedHighlightIds.has(edge.target));
                        const edgeColor = edge.data?.edgeColor || edge.style?.stroke || 'currentColor';
                        const branchOpacity = edge.data?.__projection_branch_opacity__ ?? 1;
                        return {
                            ...edge,
                            zIndex: hit ? TASKS_EDGE_FOCUS_Z : TASKS_EDGE_Z,
                            data: {
                                ...edge.data,
                                highlightMode: hit ? 'selected' : 'dim',
                                strokeMode: hit && touchesHover ? (edge.source === hoverDirectionId ? 'selected-out' : 'selected-in') : (hit ? 'selected' : 'dim'),
                                flareKey: `hover:${hoveredNodeId || ''}`,
                            },
                            labelStyle: { ...(edge.labelStyle || {}), fill: hit ? edgeColor : 'color-mix(in srgb, var(--vyasa-ink) 26%, transparent)', opacity: (hit ? tasksProminentEdgeOpacity() : tasksApplyEdgeOpacity(0.12, edgeOpacity)) * branchOpacity },
                            labelBgStyle: { ...(edge.labelBgStyle || {}), fill: TASKS_EDGE_LABEL_BG, fillOpacity: hit ? 0.82 : 0.06 },
                            style: { ...edge.style, stroke: hit ? edgeColor : 'color-mix(in srgb, var(--vyasa-ink) 38%, transparent)', opacity: tasksApplyEdgeOpacity(hit ? 0.98 : 0.08, edgeOpacity) * branchOpacity, strokeWidth: edge.data?.__pair_half__ ? (hit ? 2.6 : 1.9) : (hit ? 4.5 : 2.5), strokeLinecap: hit ? 'round' : undefined, '--vyasa-edge-flow-duration': hit ? '0.7s' : '0.6s' },
                        };
                    }));
                    return;
                }
                if (!hasNodeSelection) {
                    const hasFilters = tasksFilterQueryHasRules(effectiveQueryFilters) || tasksFilterQueryHasRules(effectiveSwatchFilters) || effectiveEdgeTypes.length > 0;
                    const hasSearch = searchMatches.active && !searchMatches.error;
                    if (!hasFilters && !hasSearch) {
                        const hoverEndpointIds = new Set(hoveredNodeId ? [hoveredNodeId] : []);
                        if (hoveredNodeId) {
                            for (const edge of baseEdges) {
                                if (touchesHovered(edge)) {
                                    hoverEndpointIds.add(edge.source);
                                    hoverEndpointIds.add(edge.target);
                                }
                            }
                        }
                        setNodesReusing(hoveredNodeId
                            ? baseNodes.map((node) => {
                                const sourceNodeId = node.data?.__kind__ === 'groupTitle' ? node.data?.sourceGroupId : node.id;
                                const highlighted = hoverEndpointIds.has(sourceNodeId);
                                if (!highlighted && node.id !== hoverCheckboxId) return node;
                                const nodeColor = resolveTasksNodeColor(node.data, model, activeColorBy, activeColorPalette);
                                const collapsedGroupColor = node.data?.__kind__ === 'group' && !expanded.has(node.id)
                                    ? resolveTasksCollapsedGroupColor(node.data, model, activeColorBy, activeColorPalette)
                                    : '';
                                const displayColor = collapsedGroupColor || nodeColor || 'var(--vyasa-primary)';
                                const stateAccent = node.data?.__card_state_color__ || TASKS_DONE_ACCENT;
                                const activeBorderColor = node.data?.__checked__ ? stateAccent : displayColor;
                                const checkedShadow = node.data?.__checked__
                                    ? `inset 0 0 0 2px color-mix(in srgb, ${stateAccent} 24%, transparent), 0 0 0 2px color-mix(in srgb, ${stateAccent} 34%, transparent)`
                                    : 'none';
                                const isHoveredNode = sourceNodeId === hoveredNodeId;
                                const focusStyle = tasksHoverFocusNodeStyle(node, nodeColor, displayColor, activeBorderColor, checkedShadow, colorMix, isHoveredNode);
                                return {
                                    ...node,
                                    data: { ...node.data, highlightMode: isHoveredNode ? 'selected-focus' : 'neighbor', __hover_checkbox__: node.id === hoverCheckboxId, __hover_outline__: highlighted },
                                    style: { ...node.style, ...focusStyle },
                                    zIndex: focusStyle.zIndex,
                                };
                            })
                            : baseNodes);
                        setEdgesReusing(hoveredNodeId
                            ? displayedEdges.map((edge) => {
                                if (!touchesHovered(edge)) return edge;
                                return tasksHoverFocusEdge(edge, hoverDirectionId);
                            })
                            : displayedEdges);
                        return;
                    }
                    const matchingIds = filteredSelectionIds();
                    const containerGroupIds = tasksGroupIdsContainingSelection(model, matchingIds);
                    const visibleSelectionIds = new Set([...matchingIds, ...containerGroupIds]);
                    const filterHoverFocus = tasksFilterHoverFocus(matchingIds, baseEdges, hoveredNodeId);
                    setNodesReusing(baseNodes.map((node) => {
                        const sourceNodeId = node.data?.__kind__ === 'groupTitle' ? node.data?.sourceGroupId : node.id;
                        const selected = visibleSelectionIds.has(sourceNodeId);
                        const focused = filterHoverFocus.nodeIds.has(sourceNodeId);
                        const nodeColor = resolveTasksNodeColor(node.data, model, activeColorBy, activeColorPalette);
                        const collapsedGroupColor = node.data?.__kind__ === 'group' && !expanded.has(node.id)
                            ? resolveTasksCollapsedGroupColor(node.data, model, activeColorBy, activeColorPalette)
                            : '';
                        const displayColor = collapsedGroupColor || nodeColor || 'var(--vyasa-primary)';
                        const stateAccent = node.data?.__card_state_color__ || TASKS_DONE_ACCENT;
                        const activeBorderColor = node.data?.__checked__ ? stateAccent : displayColor;
                        const checkedShadow = node.data?.__checked__
                            ? `inset 0 0 0 2px color-mix(in srgb, ${stateAccent} 24%, transparent), 0 0 0 2px color-mix(in srgb, ${stateAccent} 34%, transparent)`
                            : 'none';
                        const focusStyle = focused
                            ? tasksHoverFocusNodeStyle(node, nodeColor, displayColor, activeBorderColor, checkedShadow, colorMix, true)
                            : {};
                        const highlightMode = focused
                            ? (sourceNodeId === hoveredNodeId ? 'selected-focus' : 'neighbor-focus')
                            : (selected ? 'selected' : 'dim');
                        return {
                            ...node,
                            data: { ...node.data, highlightMode, __hover_checkbox__: node.id === hoverCheckboxId, __hover_outline__: focused },
                            style: {
                                ...node.style,
                                opacity: (node.data?.__projection_branch_opacity__ ?? 1) * (selected ? 1 : 0.18),
                                '--vyasa-tasks-active-border': selected ? activeBorderColor : undefined,
                                ...focusStyle,
                            },
                            ...(focused ? { zIndex: focusStyle.zIndex } : {}),
                        };
                    }));
                    setEdgesReusing(displayedEdges.map((edge) => {
                        const hit = (visibleSelectionIds.has(edge.source) && visibleSelectionIds.has(edge.target)) || searchMatches.edgeIds.has(edge.id);
                        if (filterHoverFocus.edgeIds.has(edge.id)) {
                            return tasksHoverFocusEdge(edge, hoveredNodeId);
                        }
                        const edgeColor = edge.data?.edgeColor || edge.style?.stroke || 'currentColor';
                        const branchOpacity = edge.data?.__projection_branch_opacity__ ?? 1;
                        return {
                            ...edge,
                            zIndex: hit ? TASKS_EDGE_FOCUS_Z : TASKS_EDGE_Z,
                            data: { ...edge.data, highlightMode: hit ? 'selected' : 'dim' },
                            labelStyle: {
                                ...(edge.labelStyle || {}),
                                fill: hit ? edgeColor : 'color-mix(in srgb, var(--vyasa-ink) 26%, transparent)',
                                opacity: (hit ? tasksProminentEdgeOpacity() : tasksApplyEdgeOpacity(0.12, edgeOpacity)) * branchOpacity,
                            },
                            labelBgStyle: { ...(edge.labelBgStyle || {}), fill: TASKS_EDGE_LABEL_BG, fillOpacity: hit ? 0.82 : 0.06 },
                            style: {
                                ...edge.style,
                                stroke: hit ? edgeColor : 'color-mix(in srgb, var(--vyasa-ink) 38%, transparent)',
                                opacity: tasksApplyEdgeOpacity(hit ? 0.98 : 0.08, edgeOpacity) * branchOpacity,
                                strokeWidth: hit ? 4.5 : 2.5,
                                strokeLinecap: hit ? 'round' : undefined,
                                '--vyasa-edge-flow-duration': hit ? '0.7s' : '0.6s',
                            },
                        };
                    }));
                    return;
                }
                const highlightedEdgeIds = new Set();
                const descendantIds = collectTasksGroupDescendantIds(nodeId, model);
                const selectedScopeIds = new Set([nodeId, ...descendantIds]);
                const directEndpointIds = new Set([nodeId, ...descendantIds]);
                const isFocusedPrimary = hoveredNodeId === nodeId;
                const isFocusedNeighbor = hoveredNodeId && hoveredNodeId !== nodeId;
                const selectedNode = baseNodes.find((node) => node.id === nodeId);
                const selectedEdgeIds = new Set(selectedNode?.data?.__edge_ids__ || []);
                const touchesSelected = (edge) => (selectedEdgeIds.size
                    ? selectedEdgeIds.has(edge.id)
                    : (edge.source === nodeId || edge.target === nodeId));
                const selectDirectionId = selectedNode?.data?.__sequence_lane__ || nodeId;
                for (const edge of baseEdges) {
                    if (touchesSelected(edge)) {
                        highlightedEdgeIds.add(edge.id);
                        directEndpointIds.add(edge.source);
                        directEndpointIds.add(edge.target);
                    }
                    if (isTasksEdgeInternalToSelection(edge, selectedScopeIds)) {
                        highlightedEdgeIds.add(edge.id);
                    }
                }
                for (const endpointId of Array.from(directEndpointIds)) {
                    for (const descendantId of collectTasksGroupDescendantIds(endpointId, model)) {
                        directEndpointIds.add(descendantId);
                    }
                }
                const hoverOutlineIds = tasksFilterHoverFocus(directEndpointIds, baseEdges, hoveredNodeId).nodeIds;
                if (hoveredNodeId) hoverOutlineIds.add(nodeId);
                const focusedEdgeModes = new Map();
                if (isFocusedPrimary) {
                    for (const edge of baseEdges) {
                        if (highlightedEdgeIds.has(edge.id) && touchesSelected(edge)) {
                            focusedEdgeModes.set(edge.id, edge.source === selectDirectionId ? 'focused-out' : 'focused-in');
                        }
                    }
                } else if (isFocusedNeighbor && directEndpointIds.has(hoveredNodeId)) {
                    for (const edge of baseEdges) {
                        const linksSelectedAndHovered =
                            (edge.source === nodeId && edge.target === hoveredNodeId) ||
                            (edge.source === hoveredNodeId && edge.target === nodeId);
                        if (linksSelectedAndHovered) focusedEdgeModes.set(edge.id, edge.source === selectDirectionId ? 'focused-out' : 'focused-in');
                    }
                }
                const nextNodes = baseNodes.map((node) => {
                    const sourceNodeId = node.data?.__kind__ === 'groupTitle' ? node.data?.sourceGroupId : node.id;
                    const mode = directEndpointIds.has(sourceNodeId)
                        ? (sourceNodeId === nodeId
                            ? (isFocusedPrimary ? 'selected-focus' : 'selected')
                            : (sourceNodeId === hoveredNodeId ? 'neighbor-focus' : 'neighbor'))
                        : 'dim';
                    const nodeColor = resolveTasksNodeColor(node.data, model, activeColorBy, activeColorPalette);
                    const collapsedGroupColor = node.data?.__kind__ === 'group' && !expanded.has(node.id)
                        ? resolveTasksCollapsedGroupColor(node.data, model, activeColorBy, activeColorPalette)
                        : '';
                    const displayColor = collapsedGroupColor || nodeColor;
                    const stateAccent = node.data?.__card_state_color__ || TASKS_DONE_ACCENT;
                    const activeBorderColor = node.data?.__checked__ ? stateAccent : (displayColor || nodeColor || 'var(--vyasa-primary)');
                    const checkedShadow = node.data?.__checked__
                        ? `inset 0 0 0 2px color-mix(in srgb, ${stateAccent} 24%, transparent), 0 0 0 2px color-mix(in srgb, ${stateAccent} 34%, transparent)`
                        : 'none';
                    const baseZIndex = Number.isFinite(Number(node.zIndex))
                        ? Number(node.zIndex)
                        : Number(node.style?.zIndex || 0);
                    const branchOpacity = node.data?.__projection_branch_opacity__ ?? 1;
                    const zIndex = mode === 'selected' || mode === 'selected-focus' || mode === 'neighbor-focus'
                        ? baseZIndex + TASKS_SELECTED_Z_BOOST
                        : (mode === 'neighbor' ? baseZIndex + TASKS_NEIGHBOR_Z_BOOST : baseZIndex);
                    return {
                        ...node,
                        data: { ...node.data, highlightMode: mode, __hover_outline__: hoverOutlineIds.has(sourceNodeId) },
                        style: {
                            ...node.style,
                            zIndex,
                            '--vyasa-tasks-active-border': mode === 'dim' ? undefined : activeBorderColor,
                            background: mode === 'dim'
                                ? node.style.background
                                : (node.data?.__kind__ === 'group'
                                    ? (tasksNodeIsOverlaid(node) ? node.style.background : tasksGroupBackground(displayColor, '', TASKS_GROUP_BG_ACTIVE, { mode: 'transparent', intensity: 10 }))
                                    : (tasksNodeIsOverlaid(node) ? node.style.background : tasksNodeBackground(nodeColor, '', colorMix, TASKS_NODE_BG_ACTIVE, false))),
                            opacity: mode === 'dim' ? branchOpacity * 0.22 : 1,
                            boxShadow: (mode === 'selected' || mode === 'selected-focus')
                                ? `${checkedShadow !== 'none' ? `${checkedShadow}, ` : ''}0 0 0 2px color-mix(in srgb, ${displayColor || nodeColor || 'var(--vyasa-primary)'} 70%, transparent), 0 0 18px 4px color-mix(in srgb, ${displayColor || nodeColor || 'var(--vyasa-primary)'} 40%, transparent)`
                                : (mode === 'neighbor-focus'
                                    ? `${checkedShadow !== 'none' ? `${checkedShadow}, ` : ''}0 0 0 3px color-mix(in srgb, ${displayColor || nodeColor || 'var(--vyasa-primary)'} 72%, transparent), 0 0 30px 8px color-mix(in srgb, ${displayColor || nodeColor || 'var(--vyasa-primary)'} 46%, transparent)`
                                    : (mode === 'neighbor'
                                        ? `${checkedShadow !== 'none' ? `${checkedShadow}, ` : ''}0 0 0 2px color-mix(in srgb, ${displayColor || nodeColor || 'var(--vyasa-primary)'} 66%, transparent), 0 0 28px 7px color-mix(in srgb, ${displayColor || nodeColor || 'var(--vyasa-primary)'} 40%, transparent)`
                                        : checkedShadow)),
                        },
                        zIndex,
                    };
                });
                const nextEdges = displayedEdges.map((edge) => {
                    const requestedMode = focusedEdgeModes.get(edge.id)
                        ? focusedEdgeModes.get(edge.id)
                        : (highlightedEdgeIds.has(edge.id) ? 'selected' : 'dim');
                    const mode = edge.data?.__reference__ && requestedMode !== 'dim' ? 'selected' : requestedMode;
                    const highlighted = mode !== 'dim';
                    const focused = mode === 'focused-in' || mode === 'focused-out';
                    const fixedFocusedLabel = Boolean(isFocusedNeighbor && focused);
                    const focusColor = mode === 'focused-in' ? TASKS_EDGE_FOCUS_IN_COLOR : TASKS_EDGE_FOCUS_OUT_COLOR;
                    const edgeColor = edge.data?.edgeColor || edge.style?.stroke || 'currentColor';
                    const branchOpacity = edge.data?.__projection_branch_opacity__ ?? 1;
                    const activeOpacity = highlighted ? 1 : branchOpacity;
                    const hoverDimsLabels = isTasksEdgeLabelHoverDimmingActive(nodeId, hoveredNodeId);
                    const strokeMode = mode === 'selected'
                        ? (edge.source === selectDirectionId ? 'selected-out' : (edge.target === selectDirectionId ? 'selected-in' : mode))
                        : mode;
                    return {
                        ...edge,
                        data: { ...edge.data, highlightMode: mode, strokeMode, hoverDimsLabels, flareKey: `${nodeId}:${hoveredNodeId || ''}` },
                        zIndex: highlighted ? TASKS_EDGE_FOCUS_Z : TASKS_EDGE_Z,
                        labelZIndex: tasksEdgeLabelZForMode(mode, TASKS_EDGE_LABEL_Z, TASKS_EDGE_LABEL_SELECTED_Z, TASKS_EDGE_LABEL_FOCUS_Z),
                        labelStyle: {
                            ...(edge.labelStyle || {}),
                            fill: focused
                                ? focusColor
                                : (highlighted ? edgeColor : 'color-mix(in srgb, var(--vyasa-ink) 26%, transparent)'),
                            opacity: activeOpacity * (hoverDimsLabels
                                ? (focused ? tasksProminentEdgeOpacity() : tasksApplyEdgeOpacity(0.05, edgeOpacity))
                                : (focused ? tasksProminentEdgeOpacity() : (highlighted ? tasksProminentEdgeOpacity() : tasksApplyEdgeOpacity(0.18, edgeOpacity)))),
                            fontSize: fixedFocusedLabel ? `${TASKS_EDGE_LABEL_FOCUS_FONT_SIZE}px` : (edge.labelStyle?.fontSize || hoverFontSize),
                            counterScaleMode: fixedFocusedLabel ? 'fixed' : 'capped',
                            fontWeight: focused ? 850 : (highlighted ? 750 : 600),
                        },
                        labelBgStyle: {
                            ...(edge.labelBgStyle || {}),
                            fill: mode === 'focused-in'
                                ? 'color-mix(in srgb, var(--vyasa-paper) 78%, #22c55e 22%)'
                                : (mode === 'focused-out'
                                    ? 'color-mix(in srgb, var(--vyasa-paper) 80%, #ef4444 20%)'
                                    : TASKS_EDGE_LABEL_BG),
                        fillOpacity: (mode === 'focused-in' || mode === 'focused-out') ? 1 : (highlighted ? 0.86 : 0.04),
                        },
                        style: {
                            ...edge.style,
                            stroke: mode === 'focused-in' || mode === 'focused-out'
                                ? focusColor
                                : (highlighted ? edgeColor : 'color-mix(in srgb, var(--vyasa-ink) 38%, transparent)'),
                            opacity: activeOpacity * ((mode === 'focused-in' || mode === 'focused-out')
                                ? tasksProminentEdgeOpacity()
                                : (highlighted ? tasksProminentEdgeOpacity() : tasksApplyEdgeOpacity(0.08, edgeOpacity))),
                            strokeWidth: tasksEdgeStrokeWidthForMode(strokeMode),
                            '--vyasa-edge-flow-duration': (mode === 'focused-in' || mode === 'focused-out') ? '0.72s' : '0.64s',
                            strokeLinecap: highlighted ? 'round' : undefined,
                        },
                    };
                });
                if (window.__vyasaTasksDebug.enabled) {
                    const debugPayload = {
                        selectedNodeId: nodeId,
                        hoveredNodeId: hoveredNodeId || '',
                        isFocusedPrimary,
                        isFocusedNeighbor: Boolean(isFocusedNeighbor),
                        selectedScopeIds: Array.from(selectedScopeIds),
                        directEndpointIds: Array.from(directEndpointIds),
                        highlightedEdgeIds: Array.from(highlightedEdgeIds),
                        focusedEdgeModes: Object.fromEntries(focusedEdgeModes),
                        nodes: nextNodes.map((node) => ({
                            id: node.id,
                            sourceNodeId: node.data?.__kind__ === 'groupTitle' ? node.data?.sourceGroupId : node.id,
                            kind: node.data?.__kind__,
                            mode: node.data?.highlightMode || '',
                            zIndex: node.zIndex ?? null,
                            styleZ: node.style?.zIndex ?? null,
                            opacity: node.style?.opacity ?? null,
                            parentId: node.parentId || '',
                        })),
                        edges: nextEdges.map((edge) => ({
                            id: edge.id,
                            source: edge.source,
                            target: edge.target,
                            mode: edge.data?.highlightMode || '',
                            zIndex: edge.zIndex ?? null,
                            labelZIndex: edge.labelZIndex ?? null,
                            strokeWidth: edge.style?.strokeWidth ?? null,
                            stroke: edge.style?.stroke || '',
                            edgeOpacity: edge.style?.opacity ?? null,
                            labelOpacity: edge.labelStyle?.opacity ?? null,
                            labelBgFill: edge.labelBgStyle?.fill || '',
                            labelBgOpacity: edge.labelBgStyle?.fillOpacity ?? null,
                        })),
                    };
                    window.__vyasaTasksDebug.latestHighlight = debugPayload;
                    logTasksDebugVerbose('highlightState', debugPayload);
                }
                setNodesReusing(nextNodes);
                const edgePriority = { dim: 0, selected: 1, 'focused-in': 2, 'focused-out': 2 };
                nextEdges.sort((a, b) => (edgePriority[a.data?.highlightMode || 'dim'] - edgePriority[b.data?.highlightMode || 'dim']));
                setEdgesReusing(nextEdges);
            }, [effectiveQueryFilters, effectiveSwatchFilters, effectiveEdgeTypes, searchMatches, model, activeColorBy, activeColorPalette, activeColorLevelSpecs, expanded, edgesVisible, edgeOpacity, edgePinBloom, filteredSelectionIds]);
            React.useLayoutEffect(() => {
                const baseNodeIds = new Set((graphBaseRef.current.nodes || []).map((node) => node.id));
                if (selectedNodeId && !baseNodeIds.has(selectedNodeId)) {
                    logTasksDebug('selectionPrunedMissingNode', {
                        widgetId,
                        missingNodeId: selectedNodeId,
                        baseNodeIds: Array.from(baseNodeIds),
                        ...tasksSelectionDebugPayload(selectedNodeId, selectedNodeIds, hoveredNodeId),
                    });
                    setSelectedNodeId(null);
                    return;
                }
                if (selectedNodeIds.size) {
                    const validSelectedIds = Array.from(selectedNodeIds).filter((nodeId) => baseNodeIds.has(nodeId));
                    if (validSelectedIds.length !== selectedNodeIds.size) {
                        logTasksDebug('selectionPrunedMulti', {
                            widgetId,
                            before: Array.from(selectedNodeIds),
                            after: validSelectedIds,
                            baseNodeIds: Array.from(baseNodeIds),
                        });
                        setSelectedNodeIds(new Set(validSelectedIds));
                        return;
                    }
                }
                if (hoveredNodeId && !baseNodeIds.has(hoveredNodeId)) {
                    setHoveredNodeId(null);
                    return;
                }
                // Pass hoveredNodeId through even with no selection so applyHighlight
                // can flag the hovered node's checkbox (__hover_checkbox__). When a
                // node is selected, hover drives neighbor focus as before.
                applyHighlight(selectedNodeId, hoveredNodeId, selectedNodeIds, selectedEdgeId || '');
            }, [graphRevision, selectedNodeId, selectedNodeIds, selectedEdgeId, hoveredNodeId, applyHighlight]);
            React.useEffect(() => {
                if (!shouldAutoFitTasksOnExpand()) {
                    // Only clear expand-driven requests. Leave 'mode' (projection-swap)
                    // and 'collapse' (intentional collapse) alone.
                    if (pendingFitActionRef.current === 'expand') {
                        pendingFitActionRef.current = null;
                    }
                    prevExpandedCountRef.current = expanded.size;
                    return;
                }
                const nextCount = expanded.size;
                if (nextCount > prevExpandedCountRef.current) {
                    pendingFitActionRef.current = 'expand';
                }
                prevExpandedCountRef.current = nextCount;
            }, [expanded]);
            React.useEffect(() => {
                if (lastGraphRevisionCauseRef.current === 'visual') return;
                const fitAction = pendingFitActionRef.current;
                if (!fitAction) return;
                // `mode` says the layout was replaced: a projection swap, a context
                // swap, or a new group-by. The camera then points at geometry that is
                // gone, and the graph reads as blank until a reload. The expand
                // preference governs expanding a node, not replacing the layout.
                if (!shouldAutoFitTasksOnExpand() && fitAction !== 'shortcut' && fitAction !== 'mode') return;
                let rafId = null;
                let framesLeft = 25;
                const step = () => {
                    if (framesLeft <= 0) {
                        reactFlowApiRef.current?.fitView({ duration: 200, padding: 0.2, includeHiddenNodes: true });
                        pendingFitActionRef.current = null;
                        return;
                    }
                    framesLeft -= 1;
                    rafId = window.requestAnimationFrame(step);
                };
                rafId = window.requestAnimationFrame(step);
                return () => {
                    if (rafId !== null) window.cancelAnimationFrame(rafId);
                };
            }, [graphRevision, expanded]);
            React.useEffect(() => {
                if (!shouldAutoFitTasksOnFilter()) return;
                const hasFilters = tasksFilterQueryHasRules(effectiveQueryFilters) || tasksFilterQueryHasRules(effectiveSwatchFilters) || effectiveEdgeTypes.length > 0;
                const hasSearch = searchMatches.active && !searchMatches.error;
                if (!hasFilters && !hasSearch) return;
                const reactFlow = reactFlowApiRef.current;
                const matchedNodes = currentHighlightedFitNodes();
                logTasksDebug('fitFilterEffectCheck', {
                    ...tasksFitDebugPayload('filter-effect', matchedNodes),
                    hasReactFlow: Boolean(reactFlow),
                    autoFitOnFilter: shouldAutoFitTasksOnFilter(),
                });
                if (!reactFlow || matchedNodes.length === 0) return;
                let rafId = window.requestAnimationFrame(() => {
                    logTasksDebug('fitFilterEffectRun', tasksFitDebugPayload('filter-effect-run', matchedNodes));
                    reactFlow.fitView({ nodes: matchedNodes, duration: 220, padding: 0.28, includeHiddenNodes: true });
                });
                return () => {
                    if (rafId !== null) window.cancelAnimationFrame(rafId);
                };
            }, [graphRevision, effectiveQueryFilters, effectiveSwatchFilters, effectiveEdgeTypes, searchMatches, currentHighlightedFitNodes]);
            React.useEffect(() => {
                if (!shouldAutoFitTasksOnFilter()) return;
                if (selectedNodeId || !selectedNodeIds.size) return;
                const reactFlow = reactFlowApiRef.current;
                const matchedNodes = currentHighlightedFitNodes();
                logTasksDebug('fitMultiSelectionEffectCheck', {
                    ...tasksFitDebugPayload('multi-selection-effect', matchedNodes),
                    hasReactFlow: Boolean(reactFlow),
                    autoFitOnFilter: shouldAutoFitTasksOnFilter(),
                });
                if (!reactFlow || matchedNodes.length === 0) return;
                const rafId = window.requestAnimationFrame(() => {
                    logTasksDebug('fitMultiSelectionEffectRun', tasksFitDebugPayload('multi-selection-effect-run', matchedNodes));
                    reactFlow.fitView({ nodes: matchedNodes, duration: 220, padding: 0.28, includeHiddenNodes: true });
                });
                return () => window.cancelAnimationFrame(rafId);
            }, [graphRevision, selectedNodeId, selectedNodeIds, currentHighlightedFitNodes]);
            React.useEffect(() => {
                let timeoutId = null;
                const updateMinZoom = () => {
                    const wrapperEl = flowWrapperRef.current;
                    const reactFlow = reactFlowApiRef.current;
                    if (!wrapperEl || !reactFlow) return;
                    const nextMinZoom = tasksGraphDynamicMinZoom(graphBaseRef.current.nodes, wrapperEl.getBoundingClientRect(), { baseMinZoom: TASKS_GRAPH_MIN_ZOOM, targetViewportFraction: 0.5 });
                    setGraphMinZoom((prevMinZoom) => {
                        if (Math.abs(prevMinZoom - nextMinZoom) < 0.0005) return prevMinZoom;
                        const viewport = reactFlow.getViewport();
                        const shouldTrackFloor = Number.isFinite(viewport?.zoom) && viewport.zoom <= prevMinZoom + 0.005;
                        const nextZoom = shouldTrackFloor ? nextMinZoom : (viewport.zoom < nextMinZoom ? nextMinZoom : null);
                        if (nextZoom !== null) reactFlow.setViewport({ x: viewport.x, y: viewport.y, zoom: nextZoom }, { duration: 120 });
                        return nextMinZoom;
                    });
                };
                const scheduleUpdate = () => {
                    if (timeoutId !== null) window.clearTimeout(timeoutId);
                    timeoutId = window.setTimeout(updateMinZoom, 80);
                };
                updateMinZoom();
                window.addEventListener('resize', scheduleUpdate);
                window.visualViewport?.addEventListener?.('resize', scheduleUpdate);
                const observer = typeof ResizeObserver === 'undefined' || !flowWrapperRef.current ? null : new ResizeObserver(scheduleUpdate);
                if (observer) observer.observe(flowWrapperRef.current);
                return () => {
                    if (timeoutId !== null) window.clearTimeout(timeoutId);
                    window.removeEventListener('resize', scheduleUpdate);
                    window.visualViewport?.removeEventListener?.('resize', scheduleUpdate);
                    observer?.disconnect();
                };
            }, [graphRevision]);
            // Prominent (focused) edge labels counter-scale against zoom, which
            // needs rf.useViewport(). Subscribing to the viewport from inside
            // CustomEdge re-rendered EVERY edge on each pan/zoom frame, so the
            // subscription lives in this leaf that only focused edges mount.

            const CustomEdge = createTasksEdgeRenderer(React, rf);
            // renderTasksCustomNode closes over per-render state (expanded,
            // cardStates, model). It is re-created every render and published
            // through renderTasksCustomNodeRef so the registered CustomNode
            // component below can stay ONE identity forever - React Flow
            // remounts every node whenever a nodeTypes entry changes identity,
            // while a re-rendered node still reads current closures here.
            // A lane cap names the actor a lifeline column stands for. The pinned
            // copy on the top edge must be the same cap, not a lookalike, so both
            // the node and the pinned overlay draw it from here.
            const tasksSequenceLaneCap = (accent, stage, label) => renderTasksSequenceLaneCap(React, accent, stage, label);
            const renderTasksCustomNode = createTasksNodeRenderer(() => ({
                Handle, NodeToolbar, Position, React, cardStates, clearSelection, edgeNodeLabels, egoMode, expanded, focusNodeReferenceFromEvent, model, selectedNodeIdRef, selectedNodeIdsRef, setExpanded, setHoveredNodeId, setSelectedNodeId, sourceModel, suppressNextGraphClickRef, toggleCheckedNode, widgetId
            }));
            const renderTasksCustomNodeRef = React.useRef(renderTasksCustomNode);
            renderTasksCustomNodeRef.current = renderTasksCustomNode;
            const CustomNode = React.useMemo(() => React.memo((props) => renderTasksCustomNodeRef.current(props)), []);
            React.useEffect(() => {
                rebuildLayout(expanded);
            }, [expanded, viewMode, rebuildLayout]);
            // Fit-on-mode-change is driven from inside ReactFlowProvider via
            // FitOnNodesReady below — it waits for useNodesInitialized() so the
            // fit lands after React Flow has finished measuring node rects.
            const nodeTypes = React.useMemo(() => ({ vyasaTask: CustomNode }), [CustomNode]);
            const edgeTypes = React.useMemo(() => ({ vyasaEdge: CustomEdge }), []);
            const FitViewHotkey = () => {
                const reactFlow = rf.useReactFlow();
                React.useEffect(() => {
                    // H/J/K/L and Shift+J/K hold to accelerate and coast on release,
                    // on the same momentum model as J/K document scroll. Each run keeps
                    // its own offset instead of reading back the viewport it just wrote,
                    // and drops it once the motion stops so a mouse pan is never undone.
                    const panMomentum = (axis) => {
                        let offset = null;
                        return createMomentumRunner({
                            step: (distance) => {
                                const viewport = reactFlow.getViewport();
                                if (offset === null) offset = axis === 'x' ? viewport.x : viewport.y;
                                offset -= distance;
                                reactFlow.setViewport(axis === 'x'
                                    ? { ...viewport, x: offset }
                                    : { ...viewport, y: offset });
                            },
                            stepStatic: (direction) => (axis === 'x'
                                ? panViewport(reactFlow, -direction * 40, 0)
                                : panViewport(reactFlow, 0, -direction * 40)),
                            onStop: () => { offset = null; },
                        });
                    };
                    const panXMomentum = panMomentum('x');
                    const panYMomentum = panMomentum('y');
                    let zoomLevel = null;
                    const zoomMomentum = createMomentumRunner({
                        onStop: () => { zoomLevel = null; },
                        step: (distance) => {
                            const viewport = reactFlow.getViewport();
                            const base = zoomLevel === null ? viewport.zoom : zoomLevel;
                            const nextZoom = Math.min(TASKS_GRAPH_MAX_ZOOM, Math.max(graphMinZoom, base * Math.exp(TASKS_ZOOM_MOMENTUM_RATE * distance)));
                            if (nextZoom === base) return false;
                            zoomLevel = nextZoom;
                            // Hold the graph point under the middle of the pane still,
                            // the way the wheel and the zoom buttons do.
                            const width = flowWrapperRef.current?.clientWidth || 0;
                            const height = flowWrapperRef.current?.clientHeight || 0;
                            reactFlow.setViewport({
                                x: width / 2 - ((width / 2 - viewport.x) / viewport.zoom) * nextZoom,
                                y: height / 2 - ((height / 2 - viewport.y) / viewport.zoom) * nextZoom,
                                zoom: nextZoom,
                            });
                            return true;
                        },
                        stepStatic: (direction) => (direction > 0 ? reactFlow.zoomIn() : reactFlow.zoomOut()),
                    });
                    const stopMomentum = () => {
                        panXMomentum.stop();
                        panYMomentum.stop();
                        zoomMomentum.stop();
                    };
                    const onKeyUp = (event) => {
                        const key = event.key.toLowerCase();
                        if (key === 'j' || key === 'k') {
                            const direction = key === 'j' ? 1 : -1;
                            panYMomentum.release(direction);
                            zoomMomentum.release(direction);
                            return;
                        }
                        if (key === 'h' || key === 'l') panXMomentum.release(key === 'l' ? 1 : -1);
                    };
                    const onKeyDown = (event) => {
                        if (shortcutsSuspended()) return;
                        if (event.defaultPrevented) return;
                        const target = event.target instanceof Element ? event.target : null;
                        const key = event.key.toLowerCase();
                        const optionZoom = event.altKey && !event.shiftKey && (key === 'arrowup' || key === 'arrowdown');
                        const optionEdgeFit = event.altKey && !event.shiftKey && event.code === 'KeyF' && Boolean(selectedEdgeIdRef.current);
                        if (event.metaKey || event.ctrlKey || (event.altKey && !optionZoom && !optionEdgeFit)) return;
                        // A held key still has to reach the claim below, or the document
                        // shortcuts scroll the page under the graph on every repeat.
                        if (event.repeat && !TASKS_SHORTCUT_KEYS.has(key) && !isTasksHopCode(event.code)) return;
                        const flowWrapper = flowWrapperRef.current;
                        const widgetFocused = wrapper.contains(document.activeElement) || wrapper.contains(target) || window.__vyasaTasksActiveWidgetId === widgetId;
                        if ((event.key === 'Escape' || key === 'g') && window.__vyasaTasksDebug.enabled) {
                            logTasksDebug('shortcutKeydown', {
                                widgetId,
                                key: event.key,
                                shiftKey: event.shiftKey,
                                widgetFocused,
                                activeWidgetId: String(window.__vyasaTasksActiveWidgetId || ''),
                                activeElementTag: document.activeElement?.tagName || '',
                                targetTag: target?.tagName || '',
                                helpOpen,
                                ...tasksSelectionDebugPayload(selectedNodeIdRef.current, selectedNodeIdsRef.current, hoveredNodeId),
                            });
                        }
                        if (event.key === 'Escape' && target?.closest?.('[data-vyasa-card-notes]')) {
                            event.preventDefault();
                            event.stopImmediatePropagation();
                            focusDetailCard();
                            return;
                        }
                        if (event.key === 'Escape' && !event.shiftKey && egoMode && widgetFocused) {
                            event.preventDefault();
                            clearSelection('escape');
                            return;
                        }
                        if (event.key === 'Escape' && !event.shiftKey && widgetFocused) {
                            if (helpOpen) {
                                event.preventDefault();
                                logTasksDebug('shortcutEscapeHelpClose', {
                                    widgetId,
                                    ...tasksSelectionDebugPayload(selectedNodeIdRef.current, selectedNodeIdsRef.current, hoveredNodeId),
                                });
                                setHelpOpen(false);
                                return;
                            }
                            if (edgeCardOpen) {
                                event.preventDefault();
                                selectedEdgeIdRef.current = null;
                                optionEdgeNodeIdRef.current = '';
                                setSelectedEdgeId(null);
                                setSelectedEdgeRecord(null);
                                setEdgeCardOpen(false);
                                setEdgeCardField('');
                                setEdgeStatus('Edge details closed.');
                                return;
                            }
                            event.preventDefault();
                            clearSelection('escape');
                            return;
                        }
                        if (target?.matches?.('.vyasa-tasks-pinned-card')) return;
                        if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(target.tagName))) return;
                        // Hovering never marks the widget active, so the shortcuts that
                        // act on what the cursor is over need their own way past this gate.
                        if (!widgetFocused
                            && !optionEdgeFit
                            && !(key === 't' && groupToggleHoverIdRef.current)
                            && !(key === 'v' && (groupHoverTooltipRef.current || edgeCardOpen || selectedNodeIdRef.current))
                            && !(key === 'f' && !event.shiftKey && (groupHoverTooltipRef.current || hoveredNodeIdRef.current))
                            && !(key === 'g' && hoveredNodeIdRef.current)
                            && !(isTasksHopCode(event.code) && hoveredNodeIdRef.current)) return;
                        // The document shortcuts in scripts.js bind J/K to scroll, C to
                        // fold and P to slides, and they preventDefault before this
                        // handler ever sees the key. So this handler listens in the
                        // capture phase and claims its own keys while the graph is
                        // focused, leaving every other key to the document.
                        if (optionEdgeFit || TASKS_SHORTCUT_KEYS.has(key) || isTasksHopCode(event.code)) event.stopPropagation();
                        if (event.repeat) return;
                        if (TASKS_HOP_GROW_CODES.has(event.code)) {
                            event.preventDefault();
                            logTasksDebug('selectionHopKey', { widgetId, key, eventKey: event.key, code: event.code, trusted: event.isTrusted, repeat: event.repeat, shiftKey: event.shiftKey });
                            growSelectionOneHop(hoveredNodeIdRef.current || '');
                            return;
                        }
                        if (TASKS_HOP_SHRINK_CODES.has(event.code)) {
                            event.preventDefault();
                            logTasksDebug('selectionHopKey', { widgetId, key, eventKey: event.key, code: event.code, trusted: event.isTrusted, repeat: event.repeat, shiftKey: event.shiftKey });
                            shrinkSelectionOneHop();
                            return;
                        }
                        if (key === '[' || key === ']') {
                            event.preventDefault();
                            const incidentNodeId = selectedNodeIdRef.current || edgeCycleNodeIdRef.current;
                            if (selectedNodeIdRef.current) edgeCycleNodeIdRef.current = selectedNodeIdRef.current;
                            const ordered = tasksOrderedEdges(visibleEdgesRef.current, incidentNodeId);
                            if (!ordered.length) {
                                setEdgeStatus(incidentNodeId ? `No visible edges connect to ${incidentNodeId}.` : 'No visible edges.');
                                return;
                            }
                            const currentIndex = ordered.findIndex((edge) => tasksEdgeRecordId(edge) === String(selectedEdgeIdRef.current || ''));
                            const delta = key === ']' ? 1 : -1;
                            const nextIndex = currentIndex < 0 ? (delta > 0 ? 0 : ordered.length - 1) : (currentIndex + delta + ordered.length) % ordered.length;
                            selectEdgeRecord(ordered[nextIndex], edgeCardOpen, edgeCardField);
                            return;
                        }
                        if (key === 'enter' && selectedEdgeIdRef.current) {
                            event.preventDefault();
                            const record = currentGraphEdges()
                                .find((edge) => tasksEdgeRecordId(edge) === selectedEdgeIdRef.current);
                            if (record) {
                                selectEdgeRecord(record, true, edgeCardField);
                                focusDetailCard();
                            }
                            return;
                        }
                        if (key === 'f' && event.shiftKey && !event.metaKey) {
                            event.preventDefault();
                            window.openTasksFullscreen?.(widgetId);
                            return;
                        }
                        if (key === 'f' || optionEdgeFit) {
                            event.preventDefault();
                            if (optionEdgeFit) {
                                fitSelectedEdgeConnection(reactFlow);
                            } else if (!edgeCardOpen || !fitSelectedEdgeConnection(reactFlow)) {
                                fitCurrentHighlight(reactFlow, { reason: 'shortcut-f' });
                            }
                            return;
                        }
                        if (event.key === '?' || (event.key === '/' && event.shiftKey)) {
                            event.preventDefault();
                            setHelpOpen((current) => !current);
                            return;
                        }
                        if (key === 'g' && !egoMode) {
                            event.preventDefault();
                            // The node under the cursor is the EG target, so G works on
                            // hover alone. Selection carries it only when nothing is hovered.
                            const hoveredEgoId = hoveredNodeIdRef.current;
                            // Plain G opens EG, the node on its own; Shift+G adds the
                            // neighbours for EG+. Matches the EG and EG+ header buttons.
                            const includeNeighbors = event.shiftKey;
                            logTasksDebug('shortcutOpenEgo', {
                                widgetId,
                                includeNeighbors,
                                hoveredEgoId: hoveredEgoId || '',
                                ...tasksSelectionDebugPayload(selectedNodeIdRef.current, selectedNodeIdsRef.current, hoveredEgoId),
                            });
                            window.__vyasaTasksActions?.[widgetId]?.openEgo?.(
                                includeNeighbors,
                                hoveredEgoId ? [hoveredEgoId] : null
                            );
                            return;
                        }
                        if (key === 's') {
                            event.preventDefault();
                            setFiltersCollapsedGuarded((current) => !current, 'shortcut-toggle-filters');
                            return;
                        }
                        if (key === 'e' && event.shiftKey) {
                            event.preventDefault();
                            setEdgeLabelsVisibleGlobal((current) => !current);
                            return;
                        }
                        if (key === 'e') {
                            event.preventDefault();
                            setEdgesVisibleGlobal((current) => !current);
                            return;
                        }
                        if (key === 'c' && event.shiftKey) {
                            event.preventDefault();
                            setGroupHoverCardsEnabledGlobal((current) => !current);
                            return;
                        }
                        if (key === 'c') {
                            event.preventDefault();
                            setHoverCardModeGlobal(nextTasksHoverCardMode);
                            return;
                        }
                        if (key === 'v') {
                            event.preventDefault();
                            setHoverCardScrollModeGlobal((current) => !current);
                            return;
                        }
                        if (key === 't') {
                            const nodeId = groupToggleHoverIdRef.current;
                            if (!egoMode && nodeId && (model.groups || []).some((group) => group.id === nodeId)) {
                                event.preventDefault();
                                setExpanded((current) => {
                                    const next = new Set(current);
                                    if (next.has(nodeId)) next.delete(nodeId); else next.add(nodeId);
                                    logTasksDebug('shortcutToggleHoveredGroup', { nodeId, expanded: Array.from(next) });
                                    return next;
                                });
                            }
                            return;
                        }
                        if (key === 'i' || key === 'o') {
                            event.preventDefault();
                            pendingFitActionRef.current = 'shortcut';
                            setExpanded((current) => {
                                const next = key === 'o'
                                    ? collapseOneGroupDepth(model, current)
                                    : expandOneGroupDepth(model, current);
                                logTasksDebug('shortcutDepth', { direction: key === 'o' ? 'collapse' : 'expand', expanded: Array.from(next) });
                                return next;
                            });
                            return;
                        }
                        if (key === 'u') {
                            event.preventDefault();
                            const allGroupIds = (model.groups || []).map((group) => group.id);
                            pendingFitActionRef.current = 'shortcut';
                            setExpanded((current) => {
                                const next = new Set(allGroupIds);
                                const unchanged = current.size === next.size && allGroupIds.every((groupId) => current.has(groupId));
                                if (unchanged) {
                                    window.requestAnimationFrame(() => {
                                        reactFlow.fitView({ duration: 200, padding: 0.2, includeHiddenNodes: true });
                                    });
                                }
                                return next;
                            });
                            logTasksDebug('shortcutExpandAll', { groupCount: allGroupIds.length });
                            return;
                        }
                        if (key === 'p') {
                            event.preventDefault();
                            pendingFitActionRef.current = 'shortcut';
                            setExpanded(new Set());
                            logTasksDebug('shortcutCollapseAll');
                            return;
                        }
                        if (optionZoom) {
                            event.preventDefault();
                            if (key === 'arrowup') reactFlow.zoomIn({ duration: 120 });
                            else reactFlow.zoomOut({ duration: 120 });
                            return;
                        }
                        if (key === 'arrowup') {
                            event.preventDefault();
                            panViewport(reactFlow, 0, 120 * (event.shiftKey ? 2 : 1));
                            return;
                        }
                        if (key === 'arrowdown') {
                            event.preventDefault();
                            panViewport(reactFlow, 0, -120 * (event.shiftKey ? 2 : 1));
                            return;
                        }
                        if (key === 'arrowleft') {
                            event.preventDefault();
                            panViewport(reactFlow, 120 * (event.shiftKey ? 2 : 1), 0);
                            return;
                        }
                        if (key === 'arrowright') {
                            event.preventDefault();
                            panViewport(reactFlow, -120 * (event.shiftKey ? 2 : 1), 0);
                            return;
                        }
                        // Vim keys: H/J/K/L pan, and because J/K are the vertical pair,
                        // Shift turns them into zoom in / zoom out. Direction 1 is down
                        // like the document scroll, which makes Shift+J the zoom in.
                        if (key === 'j' || key === 'k') {
                            event.preventDefault();
                            const direction = key === 'j' ? 1 : -1;
                            if (event.shiftKey) zoomMomentum.start(direction);
                            else panYMomentum.start(direction);
                            return;
                        }
                        if (key === 'h' || key === 'l') {
                            event.preventDefault();
                            panXMomentum.start(key === 'l' ? 1 : -1);
                            return;
                        }
                    };
                    document.addEventListener('keydown', onKeyDown, true);
                    document.addEventListener('keyup', onKeyUp, true);
                    window.addEventListener('blur', stopMomentum);
                    return () => {
                        document.removeEventListener('keydown', onKeyDown, true);
                        document.removeEventListener('keyup', onKeyUp, true);
                        window.removeEventListener('blur', stopMomentum);
                        stopMomentum();
                    };
                }, [reactFlow, currentGraphEdges, currentSelectionIds, growSelectionOneHop, shrinkSelectionOneHop, model, rawGraph, sourceModel, egoMode, helpOpen, edgeCardOpen, edgeCardField, selectEdgeRecord, setFiltersCollapsedGuarded, setGroupHoverCardsEnabledGlobal, setHoverCardScrollModeGlobal, fitCurrentHighlight, fitSelectedEdgeConnection, focusDetailCard, panViewport, graphMinZoom]);
                return null;
            };
            const handlePinnedCardKeyDown = (event, notesRef, navigate) => {
                if (event.target !== event.currentTarget || event.key !== 'Enter') return;
                event.preventDefault();
                event.stopPropagation();
                if (event.shiftKey) navigate(); else notesRef.current?.focus();
            };
            const { SelectedNodePanel, SelectedEdgePanel, FilterPanel } = createTasksPanels(() => ({
                React, TASKS_ADD_VIEW_OPTION_ID, aclViewerOptions, activeAclViewer, activeColorHierarchy,
                activeContextId, activeContextIndex, activeEdgeTypes, activeFilters, activeGroupByHierarchy,
                activeProjectionId, activeSwatchFilters, allClearedNotes, buildProjectionConfigText, clearedNote,
                contextDiffEnabled, contextDiffLoading, contextLoading, contextOptions,
                detailCardRef, detailCardScrollRef, edgeCardError, edgeCardOpen, edgeNodeLabels,
                edgeNodesById, edgeNoteTextareaRef, edgeNotes, edgeOpacity, edgeTypeColors,
                edgeTypeFilterEnabled, edgeTypeMenuOpen, edgeTypeOptions, edgeTypeQuery, effectiveEdgeTypes,
                egoMode, filterPanelMaxHeight, filterPanelRef, filterPanelWidthSetting, filtersCollapsed,
                fitSelectedEdgeConnection, focusGraphNode, graphBaseRef, groupByDisabledSet, groupByEnabled,
                groupByHierarchy, handleAddView, handleClearAllNotes, handleCopyNodeNotes, handleDefaultViewPaste,
                handleExportNodeNotes, handleImportNodeNotes, handlePinnedCardKeyDown, handleSwitchContext, handleUndoClearAllNotes,
                hoverCardScrollMode, hoverCardScrollRef, hoverInactiveNodes, model, nodeCardContentScale,
                nodeNotes, noteInputValue, noteTextareaRef, optionEdgeNodeIdRef, pendingFitActionRef,
                projectionOptions, projectionUnspecifiedContentOpacity, queryBuilderEnabled, queryBuilderReady, reactFlowApiRef,
                reorderActiveColorLevel, reorderGroupByLevel, resetProjectionControls, searchEnabled, searchInputRef,
                searchInputValue, searchMatches, selectedEdgeIdRef, selectedEdgeRecord, selectedNodeId,
                setActiveAclViewer, setActiveColorLevel, setActiveEdgeTypes, setActiveFilters, setActiveProjectionId,
                setClearedNote, setContextDiffEnabled, setDragSelection, setEdgeCardField, setEdgeCardOpen,
                setEdgeOpacity, setEdgeStatus, setEdgeTypeFilterEnabled, setEdgeTypeMenuOpen, setEdgeTypeQuery,
                setFiltersCollapsedGuarded, setGroupByDisabledKeys, setGroupByEnabled, setGroupByHierarchy, setHoverInactiveNodes,
                setHoveredNodeId, setNoteInputValue, setProjectionUnspecifiedContentOpacity, setQueryBuilderEnabled, setSearchEnabled,
                setSearchInputValue, setSearchQuery, setSelectedEdgeId, setSelectedEdgeRecord, setSelectedNodeId,
                setSelectedNodeIds, setViewMode, slideIndex, slideNotes, sourceModel,
                tasksCaptionElement, toggleFilterValue, updateEdgeNote, updateNodeNote, viewMode,
                widgetId
            }));

            const clearSelection = (reason = 'manual') => {
                logTasksDebug('selectionClear', {
                    widgetId,
                    reason,
                    ...tasksSelectionDebugPayload(selectedNodeIdRef.current, selectedNodeIdsRef.current, hoveredNodeId),
                });
                selectedNodeIdRef.current = null;
                selectedNodeIdsRef.current = new Set();
                selectedEdgeIdRef.current = null;
                edgeCycleNodeIdRef.current = '';
                optionEdgeNodeIdRef.current = '';
                setSelectedNodeId(null);
                setSelectedNodeIds(new Set());
                setSelectedEdgeId(null);
                setSelectedEdgeRecord(null);
                setEdgeCardOpen(false);
                setEdgeCardField('');
                setEdgeCardError('');
                setDragSelection(null);
                setHoveredNodeId(null);
            };
            const toggleFilterValue = React.useCallback((key, value, enabled) => {
                setActiveSwatchFilters((current) => toggleTasksFilterQueryValue(current, key, value, enabled));
            }, []);
            const clearGroupHoverTooltip = React.useCallback(() => {
                groupHoverTooltipRef.current = null;
                setGroupHoverTooltip(null);
            }, []);
            React.useEffect(() => {
                const onKeyDown = (event) => {
                    const target = event.target instanceof Element ? event.target : null;
                    const wrapper = flowWrapperRef.current;
                    const key = event.key.toLowerCase();
                    const editable = target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(target.tagName));
                    const current = groupHoverTooltipRef.current;
                    if (key !== 'enter' || !current || editable || event.repeat || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    selectNodeCard(current.nodeId, current.nodeId, current.group ? 'group' : 'task', true);
                    clearGroupHoverTooltip();
                    logTasksDebug('hoverCardStickySet', { widgetId, nodeId: current.nodeId || '', reason: 'enter' });
                };
                document.addEventListener('keydown', onKeyDown, true);
                return () => {
                    document.removeEventListener('keydown', onKeyDown, true);
                };
            }, [clearGroupHoverTooltip, selectNodeCard, widgetId]);
            const hoverTraceKeyRef = React.useRef('');
            const logHoverCycle = React.useCallback((label, payload = {}) => {
                logTasksDebug(label, payload);
                logTasksPerf(label, payload);
            }, []);
            const clearGraphHoverState = React.useCallback((reason = 'unknown') => {
                if (!transientGraphHoverActiveRef.current && !groupToggleHoverIdRef.current) return;
                logHoverCycle('hover-cycle:clear-state', { reason });
                transientGraphHoverActiveRef.current = false;
                groupToggleHoverIdRef.current = '';
                setTasksGroupToggleHover(flowWrapperRef.current, '');
                clearGroupHoverTooltip();
                setHoveredNodeId(null);
            }, [clearGroupHoverTooltip, logHoverCycle]);
            const updateGroupHoverTooltip = React.useCallback((event) => {
                if (document.pointerLockElement) return;
                const reactFlow = reactFlowApiRef.current;
                const wrapper = flowWrapperRef.current;
                const graphBase = graphBaseRef.current || {};
                const target = event.target instanceof Element ? event.target : null;
                const domNode = target?.closest?.('.react-flow__node') || null;
                if (target?.closest?.('[data-vyasa-node-card], [data-vyasa-edge-card]')) {
                    delete wrapper?.dataset.vyasaReviewPointerTarget;
                    clearGraphHoverState('detail-card');
                    return;
                }
                if (optionEdgePreviewHeldRef.current) {
                    const match = edgeForOptionPointer(event);
                    if (match) previewOptionEdge(match.edge, match.nodeId);
                    return;
                }
                if (optionEdgeNodeIdRef.current) clearOptionEdgePreview();
                const traceHoverHit = (stage, extra = {}) => {
                    const key = [
                        stage,
                        extra.hitId || '',
                        extra.kind || '',
                        domNode?.getAttribute?.('data-id') || '',
                    ].join('|');
                    if (hoverTraceKeyRef.current === key) return;
                    hoverTraceKeyRef.current = key;
                    logHoverCycle('hover-cycle:pointer-hit', {
                        widgetId,
                        stage,
                        x: Math.round(event.clientX),
                        y: Math.round(event.clientY),
                        targetClass: String(target?.className || '').slice(0, 96),
                        domNodeId: domNode?.getAttribute?.('data-id') || '',
                        hoveredNodeId: hoveredNodeId || '',
                        ...extra,
                    });
                };
                if (!reactFlow || !wrapper) return;
                if (wrapper.querySelector('.react-flow__pane.dragging')) {
                    traceHoverHit('dragging');
                    return;
                }
                const point = reactFlow.screenToFlowPosition({ x: event.clientX, y: event.clientY });
                const baseNodes = graphBase.nodes || [];
                // Pick the deepest hit (highest z) under the cursor without touching React state.
                const hit = tasksGraphNodeAtFlowPoint(baseNodes, point);
                if (!hit) {
                    delete wrapper.dataset.vyasaReviewPointerTarget;
                    clearGraphHoverState('pointer-miss');
                    traceHoverHit('miss', { flowX: Math.round(point.x), flowY: Math.round(point.y) });
                    return;
                }
                const nodeData = hit.node.data || {};
                const edgePx = Math.round(Math.min(
                    point.x - hit.rect.x,
                    hit.rect.x + hit.rect.width - point.x,
                    point.y - hit.rect.y,
                    hit.rect.y + hit.rect.height - point.y
                ));
                wrapper.dataset.vyasaReviewPointerTarget = JSON.stringify({
                    kind: 'node',
                    id: nodeData.__kind__ === 'groupTitle' ? (nodeData.sourceGroupId || hit.node.id) : hit.node.id,
                    label: String(nodeData.label || hit.node.id).slice(0, 240),
                    node_kind: nodeData.__kind__ || '',
                    widget_id: widgetId,
                });
                const hoverGroupId = nodeData.__kind__ === 'group'
                    ? hit.node.id
                    : (nodeData.__kind__ === 'groupTitle' ? nodeData.sourceGroupId : '');
                const groupHoverChanged = groupToggleHoverIdRef.current !== hoverGroupId;
                if (groupToggleHoverIdRef.current !== hoverGroupId) {
                    groupToggleHoverIdRef.current = hoverGroupId || '';
                    if (hoverGroupId) transientGraphHoverActiveRef.current = true;
                    setTasksGroupToggleHover(wrapper, hoverGroupId);
                }
                const liveNode = nodes.find((node) => node.id === hit.node.id) || hit.node;
                if (!tasksGraphNodeAllowsHover(liveNode, hoverInactiveNodes)) {
                    clearGroupHoverTooltip();
                    traceHoverHit('blocked', { hitId: hit.node.id, kind: nodeData.__kind__ || '', edgePx });
                    return;
                }
                const label = nodeData.label || hit.node.id;
                const nodeId = nodeData.__kind__ === 'groupTitle' ? (nodeData.sourceGroupId || hit.node.id) : hit.node.id;
                if (!label) {
                    clearGroupHoverTooltip();
                    traceHoverHit('empty', { hitId: hit.node.id, kind: nodeData.__kind__ || '', edgePx });
                    return;
                }
                const bounds = wrapper.getBoundingClientRect();
                transientGraphHoverActiveRef.current = true;
                if (tasksGraphNodeAllowsHover(liveNode, hoverInactiveNodes) && isTasksGraphNodeSelectable(liveNode.data?.__kind__, expanded.has(liveNode.id))) {
                    const sourceNodeId = liveNode.data?.__kind__ === 'groupTitle' ? liveNode.data?.sourceGroupId : liveNode.id;
                    if (!selectedNodeId) {
                        setHoveredNodeId((current) => current === sourceNodeId ? current : sourceNodeId);
                    } else {
                        const baseEdges = currentGraphEdges();
                        const isNeighbor = baseEdges.some((edge) =>
                            (edge.source === selectedNodeId && edge.target === sourceNodeId) ||
                            (edge.source === sourceNodeId && edge.target === selectedNodeId)
                        );
                        if (hoverInactiveNodes || isNeighbor || sourceNodeId === selectedNodeId) {
                            setHoveredNodeId((current) => current === sourceNodeId ? current : sourceNodeId);
                        }
                    }
                }
                if (hoverGroupId && !groupHoverCardsEnabled) {
                    clearGroupHoverTooltip();
                    traceHoverHit('group-card-disabled', { hitId: hit.node.id, kind: nodeData.__kind__ || '', edgePx });
                    return;
                }
                const hoverCard = {
                    label,
                    nodeId,
                    group: Boolean(hoverGroupId),
                    x: event.clientX - bounds.left + 12,
                    y: event.clientY - bounds.top + 18,
                    placement: 'rightRail',
                };
                groupHoverTooltipRef.current = hoverCard;
                setGroupHoverTooltip(hoverCard);
                traceHoverHit('hit', { hitId: hit.node.id, kind: nodeData.__kind__ || '', edgePx, groupHoverChanged });
            }, [expanded, clearGroupHoverTooltip, clearGraphHoverState, clearOptionEdgePreview, currentGraphEdges, edgeForOptionPointer, previewOptionEdge, nodes, widgetId, model, egoMode, hoverInactiveNodes, groupHoverCardsEnabled, hoveredNodeId, logHoverCycle, selectedNodeId]);
            const selectGroupDescendants = React.useCallback((node) => {
                const kind = node?.data?.__kind__;
                if (kind !== 'group' && kind !== 'groupTitle') return false;
                const groupId = kind === 'groupTitle' ? node.data?.sourceGroupId : node.id;
                const baseNodes = graphBaseRef.current.nodes || [];
                const byId = Object.fromEntries(baseNodes.map((n) => [n.id, n]));
                const groupNode = byId[groupId];
                if (!groupId || !groupNode) return false;
                let x = Number(groupNode.position?.x) || 0;
                let y = Number(groupNode.position?.y) || 0;
                let parent = groupNode.parentId ? byId[groupNode.parentId] : null;
                while (parent) {
                    x += Number(parent.position?.x) || 0;
                    y += Number(parent.position?.y) || 0;
                    parent = parent.parentId ? byId[parent.parentId] : null;
                }
                const width = Number(groupNode.style?.width ?? groupNode.width) || 0;
                const height = Number(groupNode.style?.height ?? groupNode.height) || 0;
                const ids = new Set(selectTasksGraphNodeIdsInRect(baseNodes, { x1: x, y1: y, x2: x + width, y2: y + height }));
                logTasksDebug('selectionSetGroupDescendants', {
                    widgetId,
                    groupId,
                    selectedIds: Array.from(ids),
                });
                markWidgetActive();
                selectedNodeIdRef.current = null;
                selectedNodeIdsRef.current = ids;
                setSelectedNodeId(null);
                setHoveredNodeId(null);
                setSelectedNodeIds(ids);
                return true;
            }, [widgetId]);
            const selectGraphNode = React.useCallback((_, node) => {
                if (suppressNextGraphClickRef.current) {
                    suppressNextGraphClickRef.current = false;
                    return;
                }
                // Detect a double-click ourselves: React Flow re-renders the node on the
                // first click (selection -> setNodes), which replaces its DOM element and
                // prevents the browser's native dblclick from ever firing.
                const clickKey = tasksSelectionClickKey(node);
                const last = lastNodeClickRef.current;
                const now = window.performance ? window.performance.now() : 0;
                const isDoubleClick = last && last.id === clickKey && (now - last.time) <= 400;
                lastNodeClickRef.current = isDoubleClick ? null : { id: clickKey, time: now };
                if (isDoubleClick && selectGroupDescendants(node)) {
                    return;
                }
                if (!isTasksGraphNodeSelectable(node.data?.__kind__, expanded.has(node.id))) {
                    clearSelection('nodeClickNonSelectable');
                    return;
                }
                const sourceNodeId = node.data?.__kind__ === 'groupTitle' ? node.data?.sourceGroupId : node.id;
                if (selectedNodeIdRef.current === sourceNodeId && selectedNodeIdsRef.current.size === 0) {
                    if (pendingNodeClickToggleTimerRef.current) window.clearTimeout(pendingNodeClickToggleTimerRef.current);
                    pendingNodeClickToggleTimerRef.current = window.setTimeout(() => {
                        if (selectedNodeIdRef.current === sourceNodeId && selectedNodeIdsRef.current.size === 0) {
                            clearSelection('nodeClickToggle');
                        }
                        pendingNodeClickToggleTimerRef.current = null;
                    }, 220);
                    return;
                }
                selectNodeCard(sourceNodeId, node.id, node.data?.__kind__ || '');
            }, [expanded, selectGroupDescendants, selectNodeCard]);
            const doubleClickGraphNode = React.useCallback((event, node) => {
                if (!selectGroupDescendants(node)) return;
                if (pendingNodeClickToggleTimerRef.current) {
                    window.clearTimeout(pendingNodeClickToggleTimerRef.current);
                    pendingNodeClickToggleTimerRef.current = null;
                }
                lastNodeClickRef.current = null;
                event.preventDefault();
                event.stopPropagation();
            }, [selectGroupDescendants]);
            const startDragSelection = React.useCallback((event) => {
                const append = event.altKey && event.shiftKey;
                const mode = append || event.metaKey ? 'lasso' : (event.shiftKey ? 'rect' : '');
                if (!mode || (event.pointerType === 'mouse' && event.button !== 0)) return;
                if (event.target?.closest?.('button, input, textarea, select, a, [data-vyasa-node-reference], .react-flow__controls, .vyasa-tasks-filter-card')) return;
                const reactFlow = reactFlowApiRef.current;
                const el = flowWrapperRef.current;
                if (!reactFlow || !el) return;
                const startFlow = reactFlow.screenToFlowPosition({ x: event.clientX, y: event.clientY });
                const initialSelectedIds = append ? new Set(selectedNodeIdsRef.current) : new Set();
                if (selectedNodeIdRef.current) initialSelectedIds.add(selectedNodeIdRef.current);
                try {
                    el.setPointerCapture?.(event.pointerId);
                } catch {
                    // Ignore if this pointer cannot be captured.
                }
                el.focus?.({ preventScroll: true });
                if (!append) setSelectedNodeId(null);
                setHoveredNodeId(null);
                setDragSelection({ pointerId: event.pointerId, mode, append, initialSelectedIds: Array.from(initialSelectedIds), startClientX: event.clientX, startClientY: event.clientY, currentClientX: event.clientX, currentClientY: event.clientY, startFlow, currentFlow: startFlow, points: [startFlow], clientPoints: [{ x: event.clientX, y: event.clientY }] });
                event.preventDefault();
                event.stopPropagation();
            }, []);
            const updateDragSelection = React.useCallback((event) => {
                if (!dragSelection || dragSelection.pointerId !== event.pointerId) return;
                const reactFlow = reactFlowApiRef.current;
                if (!reactFlow) return;
                const currentFlow = reactFlow.screenToFlowPosition({ x: event.clientX, y: event.clientY });
                const currentClientPoint = { x: event.clientX, y: event.clientY };
                setDragSelection((current) => current && current.pointerId === event.pointerId
                    ? { ...current, currentClientX: event.clientX, currentClientY: event.clientY, currentFlow, points: current.mode === 'lasso' ? extendLassoPoints(current.points, currentFlow) : current.points, clientPoints: current.mode === 'lasso' ? extendLassoPoints(current.clientPoints, currentClientPoint) : current.clientPoints }
                    : current);
                event.preventDefault();
                event.stopPropagation();
            }, [dragSelection, extendLassoPoints]);
            const finishDragSelection = React.useCallback((event) => {
                if (!dragSelection || dragSelection.pointerId !== event.pointerId) return;
                try {
                    flowWrapperRef.current?.releasePointerCapture?.(event.pointerId);
                } catch {
                    // Ignore if pointer capture is not active.
                }
                const distance = Math.hypot(event.clientX - dragSelection.startClientX, event.clientY - dragSelection.startClientY);
                if (distance >= 3) {
                    const selected = dragSelection.mode === 'lasso'
                        ? selectTasksGraphNodeIdsInPolygon(graphBaseRef.current.nodes || [], extendLassoPoints(dragSelection.points, dragSelection.currentFlow))
                        : selectTasksGraphNodeIdsInRect(graphBaseRef.current.nodes || [], {
                            x1: dragSelection.startFlow.x,
                            y1: dragSelection.startFlow.y,
                            x2: dragSelection.currentFlow.x,
                            y2: dragSelection.currentFlow.y,
                        });
                    const nextSelected = dragSelection.append
                        ? new Set([...dragSelection.initialSelectedIds, ...selected])
                        : new Set(selected);
                    logTasksDebug('selectionSetDrag', {
                        widgetId,
                        mode: dragSelection.mode,
                        append: dragSelection.append,
                        selectedIds: Array.from(nextSelected),
                    });
                    markWidgetActive();
                    selectedNodeIdRef.current = null;
                    selectedNodeIdsRef.current = nextSelected;
                    setSelectedNodeId(null);
                    setSelectedNodeIds(nextSelected);
                    suppressNextGraphClickRef.current = true;
                    window.setTimeout(() => {
                        suppressNextGraphClickRef.current = false;
                    }, 0);
                }
                setDragSelection(null);
                event.preventDefault();
                event.stopPropagation();
            }, [dragSelection, expanded, extendLassoPoints]);
            React.useEffect(() => () => {
                if (pendingNodeClickToggleTimerRef.current) window.clearTimeout(pendingNodeClickToggleTimerRef.current);
            }, []);
            React.useEffect(() => {
                const el = filterPanelRef.current;
                if (!el) return;
                const update = () => {
                    setFilterPanelMaxHeight(tasksFilterPanelMaxHeight(flowWrapperRef.current));
                };
                update();
                if (typeof ResizeObserver === 'undefined') return;
                const observer = new ResizeObserver(update);
                observer.observe(el);
                if (flowWrapperRef.current) observer.observe(flowWrapperRef.current);
                return () => observer.disconnect();
            }, [activeFilters, activeColorBy, filtersCollapsed, model]);
            const closeEgo = React.useCallback(() => {
                const previous = egoReturnRef.current;
                if (!previous || !egoState) return;
                egoReturnRef.current = null;
                wrapper.removeAttribute('data-tasks-ego-active');
                setEgoState(null);
                setExpanded(new Set(previous.expanded));
                selectedNodeIdRef.current = null;
                selectedNodeIdsRef.current = new Set();
                setSelectedNodeId(null);
                setSelectedNodeIds(new Set());
                setHoveredNodeId(null);
                pendingFitActionRef.current = null;
                pendingEgoViewportRestoreRef.current = {
                    viewport: previous.viewport,
                    graphRevision,
                    selectedNodeId: previous.selectedNodeId,
                    selectedNodeIds: new Set(previous.selectedNodeIds),
                };
                if (!previous.inline && !previous.maximized) setTasksMaximized(wrapper, false, { fit: false });
                try { previous.onClose?.(); } catch { /* noop */ }
            }, [egoState, graphRevision]);
            const ActionBridge = () => {
                const reactFlow = rf.useReactFlow();
                reactFlowApiRef.current = reactFlow;
                React.useEffect(() => {
                    window.__vyasaTasksActions[widgetId] = {
                        fit: () => fitCurrentHighlight(reactFlow, { reason: 'header-fit-action' }),
                        dump: () => {
                            const payload = {
                                latest: window.__vyasaTasksDebug.latest || {},
                                latestHighlight: window.__vyasaTasksDebug.latestHighlight || {},
                                latestLayout: window.__vyasaTasksDebug.latestLayout || {},
                            };
                            logTasksDebug('manualDump', payload);
                            return payload;
                        },
                        watchEdge: (source, target) => {
                            window.__vyasaTasksDebug.watch = [{ source, target }];
                            logTasksDebug('manualWatchEdge', { source, target });
                        },
                        clearWatch: () => {
                            window.__vyasaTasksDebug.watch = [];
                            logTasksDebug('manualClearWatch');
                        },
                        toggle: (nodeId) => {
                            if (!(model.groups || []).some((group) => group.id === nodeId)) return;
                            setExpanded((current) => {
                                const next = new Set(current);
                                if (next.has(nodeId)) next.delete(nodeId); else next.add(nodeId);
                                logTasksDebug('manualToggle', { nodeId, expanded: Array.from(next) });
                                return next;
                            });
                        },
                        select: (nodeId) => {
                            markWidgetActive();
                            selectedNodeIdRef.current = nodeId;
                            selectedNodeIdsRef.current = new Set();
                            setSelectedNodeId(nodeId);
                            setSelectedNodeIds(new Set());
                            logTasksDebug('manualSelect', { nodeId });
                        },
                        openEgo: (includeNeighbors = false, explicitIds = null, inline = false, onClose = null) => {
                            const previous = egoReturnRef.current;
                            const egoSelection = Array.isArray(explicitIds) && explicitIds.length
                                ? new Set(explicitIds.map((id) => String(id || '').trim()).filter(Boolean))
                                : (previous ? new Set(previous.egoSelection) : currentSelectionIds());
                            logTasksDebug('openEgoAction', {
                                widgetId,
                                includeNeighbors,
                                selection: Array.from(egoSelection),
                                ...tasksSelectionDebugPayload(selectedNodeIdRef.current, selectedNodeIdsRef.current, hoveredNodeId),
                            });
                            const nextEgoState = buildTasksEgoState(
                                baseProjectionState.model,
                                baseRawGraph,
                                egoSelection,
                                includeNeighbors,
                                activeColorBy
                            );
                            if (!nextEgoState) return;
                            if (!previous) {
                                egoReturnRef.current = {
                                    viewport: reactFlow.getViewport(),
                                    expanded: new Set(expanded),
                                    selectedNodeId: selectedNodeIdRef.current,
                                    selectedNodeIds: new Set(selectedNodeIdsRef.current),
                                    egoSelection: new Set(egoSelection),
                                    inline,
                                    maximized: wrapper.getAttribute('data-tasks-maximized') === 'true',
                                    onClose,
                                };
                                wrapper.setAttribute('data-tasks-ego-active', 'true');
                                if (!inline) setTasksMaximized(wrapper, true);
                            }
                            setEgoState(nextEgoState);
                            setExpanded(tasksExpandableNodeIds(nextEgoState.model));
                            selectedNodeIdRef.current = null;
                            selectedNodeIdsRef.current = new Set();
                            setSelectedNodeId(null);
                            setSelectedNodeIds(new Set());
                            setHoveredNodeId(null);
                            pendingFitActionRef.current = 'mode';
                        },
                        closeEgo,
                        openEgoNeighbors: () => window.__vyasaTasksActions[widgetId]?.openEgo?.(true),
                        expand: () => {
                            if (egoMode) return;
                            pendingFitActionRef.current = 'shortcut';
                            setExpanded(tasksExpandableNodeIds(model));
                        },
                        collapse: () => {
                            if (egoMode) return;
                            pendingFitActionRef.current = 'shortcut';
                            setExpanded(new Set());
                        },
                        expandDepth: () => {
                            if (egoMode) return;
                            pendingFitActionRef.current = 'shortcut';
                            setExpanded((current) => {
                                const next = expandOneGroupDepth(model, current);
                                logTasksDebug('manualExpandDepth', { expanded: Array.from(next) });
                                return next;
                            });
                        },
                        collapseDepth: () => {
                            if (egoMode) return;
                            pendingFitActionRef.current = 'shortcut';
                            setExpanded((current) => {
                                const next = collapseOneGroupDepth(model, current);
                                logTasksDebug('manualCollapseDepth', { expanded: Array.from(next) });
                                return next;
                            });
                        },
                        toggleFilters: () => setFiltersCollapsedGuarded((current) => !current, 'action-toggle-filters'),
                        openFilters: () => setFiltersCollapsedGuarded(false, 'action-open-filters'),
                        closeFilters: () => setFiltersCollapsedGuarded(true, 'action-close-filters'),
                        toggleHoverCards: () => setHoverCardModeGlobal((current) => (
                            current === 'off' ? clampTasksHoverCardMode(lastHoverCardPlacementRef.current) : 'off'
                        )),
                        toggleEdges: () => setEdgesVisibleGlobal((current) => !current),
                        toggleCardScroll: () => setHoverCardScrollModeGlobal((current) => !current),
                        toggleHelp: () => setHelpOpen((current) => !current),
                    };
                    return () => {
                        delete window.__vyasaTasksActions[widgetId];
                    };
                }, [reactFlow, currentSelectionIds, baseProjectionState.model, baseRawGraph, expanded, egoMode, egoState, activeColorBy, closeEgo, fitCurrentHighlight, setHoverCardScrollModeGlobal]);
                return null;
            };
            const RestoreEgoViewport = () => {
                const reactFlow = rf.useReactFlow();
                React.useEffect(() => {
                    const pending = pendingEgoViewportRestoreRef.current;
                    if (egoMode || !pending || graphRevision <= pending.graphRevision) return;
                    pendingEgoViewportRestoreRef.current = null;
                    const frame = window.requestAnimationFrame(() => {
                        reactFlow.setViewport(pending.viewport, { duration: 0 });
                        selectedNodeIdRef.current = pending.selectedNodeId;
                        selectedNodeIdsRef.current = new Set(pending.selectedNodeIds);
                        setSelectedNodeId(pending.selectedNodeId);
                        setSelectedNodeIds(new Set(pending.selectedNodeIds));
                    });
                    return () => window.cancelAnimationFrame(frame);
                }, [reactFlow, graphRevision, egoMode]);
                return null;
            };
            const FitOnNodesReady = () => {
                const reactFlow = rf.useReactFlow();
                React.useEffect(() => {
                    if (pendingFitActionRef.current !== 'mode') return;
                    // Pragmatic: wait long enough for the layout to settle, then fit.
                    // Same call the F key triggers, just timed past any settle race.
                    const timeoutId = window.setTimeout(() => {
                        const matched = tasksMatchedSlideNodes(slides, slideIndex, graphBaseRef.current.nodes);
                        if (slideIndex >= 0) {
                            if (matched.length) reactFlow.fitView({ nodes: matched, duration: 400, padding: 0.3, includeHiddenNodes: true });
                        } else {
                            reactFlow.fitView({ duration: 200, padding: 0.16, includeHiddenNodes: true });
                        }
                        pendingFitActionRef.current = null;
                    }, 350);
                    return () => window.clearTimeout(timeoutId);
                }, [reactFlow, graphRevision, viewMode, slideIndex, slides]);
                return null;
            };
            const TasksNodeHighlightBorders = () => {
                if (!rf.ViewportPortal) return null;
                const byId = Object.fromEntries(nodes.map((node) => [node.id, node]));
                // In EG+ the nodes the view was opened on wear a dashed band. It is the
                // only thing marking them apart now that neighbours are not dimmed.
                const egoSeedIds = egoMode && model.ego_include_neighbors && Array.isArray(model.ego_selected_ids)
                    ? new Set(model.ego_selected_ids.map((id) => String(id || '').trim()).filter(Boolean))
                    : null;
                const isEgoSeed = (node) => egoSeedIds !== null && egoSeedIds.has(node.id);
                const activeNodes = nodes.filter((node) => (
                    !['none', 'dim'].includes(node.data?.highlightMode || 'none') || isEgoSeed(node)
                ));
                return React.createElement(rf.ViewportPortal, null, ...activeNodes.flatMap((node) => {
                    const rect = tasksGraphNodeAbsoluteRect(node, byId);
                    const hoverOutline = node.data?.__hover_outline__ === true;
                    const activeBorderColor = node.style?.['--vyasa-tasks-active-border'] || 'var(--vyasa-primary)';
                    const mode = node.data?.highlightMode || 'none';
                    // A neighbour splits its band into thirds — an inner band, a
                    // transparent gap, then an outer band — so it stops looking like
                    // the central node, which keeps the solid band. One div draws one
                    // outline, so the outer band rides a second div over the same rect.
                    const central = mode === 'selected' || mode === 'selected-focus';
                    // A hover reads through the usual bands, so the seed marker only
                    // shows while the node carries no highlight of its own.
                    const seedBand = ['none', 'dim'].includes(mode) && isEgoSeed(node);
                    const width = hoverOutline ? 12 : 4;
                    const bands = central || seedBand
                        ? [[width, 3]]
                        : [[width / 3, 3], [width / 3, 3 + ((width / 3) * 2)]];
                    return bands.map(([bandWidth, bandOffset], index) => React.createElement('div', {
                        key: index ? `${node.id}-outer` : node.id,
                        'data-vyasa-node-highlight-border': 'true',
                        style: {
                            position: 'absolute',
                            transform: `translate(${rect.x}px, ${rect.y}px)`,
                            width: rect.width,
                            height: rect.height,
                            borderRadius: node.style?.borderRadius || 6,
                            outline: `${bandWidth}px ${seedBand ? 'dashed' : 'solid'} ${activeBorderColor}`,
                            outlineOffset: `${bandOffset}px`,
                            pointerEvents: 'none',
                            zIndex: TASKS_EDGE_FOCUS_Z - 1,
                        },
                    }));
                }));
            };
            // Excel freezes its header row. A diagram with axis headers freezes
            // them the same way: once a header's own node pans off its edge, an
            // identical copy holds that edge, so a reader panned deep into the
            // body still knows which column or row they are reading. A header
            // SCALES with the viewport instead of counter-scaling, so it keeps
            // the exact width of the column it names.
            //
            // A full-height column node (a lifeline, a gantt unit) shows only
            // capHeight of itself when pinned, or it would repaint the whole pane.
            // A lifeline draws its cap through tasksSequenceLaneCap rather than
            // through the node renderer, because a lifeline node also carries
            // handles and review attributes that must not exist twice.
            const tasksPinnedHeaderSpecs = [
                {
                    axis: 'top',
                    match: (data) => Boolean(data.__sequence_lifeline__),
                    render: (node) => tasksSequenceLaneCap(
                        node.data?.__sequence_color__ || 'currentColor',
                        node.data?.__sequence_stage__,
                        node.data?.label || '',
                    ),
                },
                { axis: 'top', capHeight: 22, match: (data) => data.__kind__ === 'ganttHeader' },
                { axis: 'top', capHeight: 40, match: (data) => data.__kind__ === 'matrixHeader' && !data.__matrix_row_header__ },
                { axis: 'left', capHeight: 40, match: (data) => data.__kind__ === 'matrixHeader' && Boolean(data.__matrix_row_header__) },
            ];
            // Subscribing to the viewport here, not inside each node, keeps a pan
            // frame from re-rendering every header.
            const TasksPinnedHeaders = () => {
                const viewport = typeof rf.useViewport === 'function' ? rf.useViewport() : null;
                if (!viewport) return null;
                const pinned = [];
                for (const node of nodes) {
                    const spec = node.data ? tasksPinnedHeaderSpecs.find((item) => item.match(node.data)) : null;
                    if (!spec) continue;
                    const screen = spec.axis === 'left'
                        ? viewport.x + node.position.x * viewport.zoom
                        : viewport.y + node.position.y * viewport.zoom;
                    if (screen < 0) pinned.push({ node, spec });
                }
                if (!pinned.length) return null;
                // Headers outside the pane are clipped rather than measured: the
                // pane owns its own size, and this overlay covers exactly the pane.
                return React.createElement('div', {
                    style: { position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: TASKS_TASK_Z + 20 },
                }, pinned.map(({ node, spec }) => React.createElement('div', {
                    key: node.id,
                    style: {
                        position: 'absolute',
                        top: spec.axis === 'left' ? viewport.y + node.position.y * viewport.zoom : 0,
                        left: spec.axis === 'left' ? 0 : viewport.x + node.position.x * viewport.zoom,
                        width: node.style?.width,
                        height: spec.capHeight,
                        overflow: 'hidden',
                        transform: `scale(${viewport.zoom})`,
                        transformOrigin: 'top left',
                        // Every header wash is translucent, so it needs paper under
                        // it to stop the body it covers from reading through.
                        background: 'var(--vyasa-paper)',
                        borderRadius: '8px 8px 0 0',
                    },
                }, spec.render ? spec.render(node) : renderTasksCustomNode({ data: node.data, id: node.id }))));
            };
            const flowWrapperClassName = [
                hoveredNodeId || selectedEdgeId ? 'vyasa-tasks-hovering-edge-labels' : '',
                'vyasa-tasks-active-pulse',
            ].filter(Boolean).join(' ');
            const buildProjectionConfigText = (projection) => {
                const pid = String(projection?.id || '');
                const def = (Array.isArray(viewerState.model?.view_projections) ? viewerState.model.view_projections : []).find((p) => p && p.id === pid) || null;
                const isActiveLive = !tasksIsFixedMode(viewMode) && pid === String(activeProjectionId || '');
                const defGroups = def ? (Array.isArray(def.groups_from) ? def.groups_from : [def.groups_from]) : [];
                const fallbackGroups = defGroups.length ? defGroups : tasksProjectionGroupByHierarchy(viewerState.model, pid);
                const groupBy = (isActiveLive && !pid) ? activeGroupByHierarchy : fallbackGroups;
                return buildTasksProjectionConfigText({
                    id: pid || 'new-view',
                    source: def?.source || '',
                    groupBy,
                    colorBy: isActiveLive ? activeColorBy : (def?.default_color_by || ''),
                    secondaryColorBy: isActiveLive ? (activeColorHierarchy[1] || '') : (def?.default_secondary_color_by || ''),
                    edgeColorBy: def?.edge_color_by || sourceModel?.edge_color_by,
                    edgeLabelFrom: def?.edge_label_from || sourceModel?.edge_label_from,
                    hoverAttrs: (Array.isArray(def?.hover_attrs) && def.hover_attrs.length)
                        ? def.hover_attrs
                        : (Array.isArray(sourceModel?.hover_attrs) ? sourceModel.hover_attrs : []),
                    aggregateEdges: def?.aggregate_edges || sourceModel?.aggregate_edges,
                    caption: def?.caption,
                    where: def?.where || {},
                    filterQuery: isActiveLive ? activeFilters : (def?.filter_query || {}),
                    queryBuilderEnabled: isActiveLive ? queryBuilderEnabled : def?.query_builder_enabled,
                    searchEnabled: isActiveLive ? searchEnabled : def?.search_enabled,
                    searchQuery: isActiveLive ? searchQuery : (def?.search || ''),
                    filtersCollapsed: isActiveLive ? filtersCollapsed : def?.filters_collapsed,
                    edgesVisible: isActiveLive ? edgesVisible : def?.edges_visible,
                    edgeOpacity: isActiveLive ? edgeOpacity : def?.edge_opacity,
                    projectionUnspecifiedContentOpacity: isActiveLive ? projectionUnspecifiedContentOpacity : def?.projection_unspecified_content_opacity,
                    defaultOpenDepth: effectiveDefaultOpenDepth,
                }, sourceModel?.kg_context?.id);
            };
            // Drag the rail's left edge to resize; double-click restores the
            // frontmatter width. The hover card reads the same width.
            const NodeCardResizeHandle = () => window.React.createElement('div', {
                key: 'node-card-resize',
                role: 'separator',
                'aria-orientation': 'vertical',
                'aria-label': 'Resize node card',
                title: 'Drag to resize. Double-click to reset.',
                onPointerDown: (event) => {
                    const surface = flowWrapperRef.current;
                    if (!surface || event.button !== 0) return;
                    event.preventDefault();
                    const rect = surface.getBoundingClientRect();
                    const move = (moveEvent) => {
                        const percent = ((rect.right - 12 - moveEvent.clientX) / Math.max(1, rect.width)) * 100;
                        applyNodeCardWidth(`${Math.max(12, Math.min(80, percent)).toFixed(1)}%`);
                    };
                    const stop = () => {
                        window.removeEventListener('pointermove', move);
                        window.removeEventListener('pointerup', stop);
                        window.removeEventListener('pointercancel', stop);
                    };
                    window.addEventListener('pointermove', move);
                    window.addEventListener('pointerup', stop);
                    window.addEventListener('pointercancel', stop);
                },
                onDoubleClick: () => applyNodeCardWidth(null),
                style: {
                    position: 'absolute',
                    left: '-7px',
                    top: 0,
                    bottom: 0,
                    width: '14px',
                    cursor: 'ew-resize',
                    pointerEvents: 'auto',
                    touchAction: 'none',
                    zIndex: 1,
                },
            });
            const RightRail = () => {
                if (!selectedNodeId && !optionEdgeNodeCardId && !(edgeCardOpen && (selectedEdgeRecord || edgeCardError))) return null;
                if (hoverCardsEnabled && groupHoverTooltip && (groupHoverCardsEnabled || !groupHoverTooltip.group)) return null;
                return window.React.createElement('div', {
                    style: {
                        position: 'absolute',
                        right: '12px',
                        top: '12px',
                        bottom: '12px',
                        zIndex: 34,
                        width: nodeCardWidth,
                        maxWidth: 'calc(100% - 24px)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                        pointerEvents: 'none',
                        minHeight: 0,
                    },
                },
                    NodeCardResizeHandle(),
                    optionEdgeNodeCardId
                        ? SelectedNodePanel(optionEdgeNodeCardId, true)
                        : (edgeCardOpen && (selectedEdgeRecord || edgeCardError) ? SelectedEdgePanel() : SelectedNodePanel())
                );
            };
            const EdgeLiveStatus = () => window.React.createElement('div', {
                role: 'status',
                'aria-live': 'polite',
                'aria-atomic': 'true',
                style: { position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap', border: 0 },
            }, edgeStatus);
            const EgoCloseControl = () => {
                const previous = egoReturnRef.current;
                if (!egoMode || !previous || previous.inline) return null;
                return window.React.createElement('button', {
                    type: 'button',
                    title: 'Close EG (Shift+Esc)',
                    'aria-label': 'Close EG',
                    onClick: closeEgo,
                    style: {
                        position: 'absolute',
                        left: '12px',
                        top: '12px',
                        zIndex: 35,
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        border: '1px solid color-mix(in srgb, currentColor 35%, transparent)',
                        background: 'var(--vyasa-paper, #fff)',
                        color: 'currentColor',
                        fontSize: '16px',
                        lineHeight: 1,
                        cursor: 'pointer',
                    },
                }, '×');
            };
            const GroupHoverTooltip = () => {
                if (!hoverCardsEnabled) return null;
                const transientCard = groupHoverTooltip && (groupHoverCardsEnabled || !groupHoverTooltip.group)
                    ? SelectedNodePanel(groupHoverTooltip.nodeId, true, groupHoverTooltip)
                    : null;
                const transientLayer = transientCard ? window.React.createElement('div', {
                    style: { position: 'absolute', inset: '12px 12px 12px auto', zIndex: 2400, width: nodeCardWidth, maxWidth: 'calc(100% - 24px)', display: 'flex', flexDirection: 'column', pointerEvents: 'none', minHeight: 0 },
                }, transientCard) : null;
                return transientLayer;
            };
            const HelpPopup = () => {
                if (!helpOpen) return null;
                const R = window.React;
                const sep = () => R.createElement('div', { style: { height: '1px', background: 'color-mix(in srgb, var(--vyasa-primary) 22%, transparent)', margin: '16px 0' } });
                const heading = (text) => R.createElement('div', { style: { fontSize: '12px', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', opacity: 0.55, marginBottom: '10px' } }, text);
                const row = (k, v) => R.createElement('div', { style: { display: 'flex', gap: '16px', alignItems: 'baseline', padding: '5px 0', fontSize: '16px', lineHeight: 1.5 } },
                    R.createElement('span', { style: { flex: '0 0 118px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace', fontWeight: 700 } }, k),
                    R.createElement('span', { style: { flex: '1 1 auto', opacity: 0.9 } }, v)
                );
                return R.createElement('div', {
                    onClick: () => setHelpOpen(false),
                    style: { position: 'absolute', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'color-mix(in srgb, var(--vyasa-ink) 32%, transparent)', backdropFilter: 'blur(3px)', pointerEvents: 'auto' }
                }, R.createElement('div', {
                    onClick: (event) => event.stopPropagation(),
                    style: { width: 'min(480px, calc(100% - 32px))', maxHeight: 'calc(100% - 32px)', overflowY: 'auto', padding: '24px 28px', borderRadius: '16px', border: '1px solid color-mix(in srgb, var(--vyasa-primary) 26%, transparent)', background: 'color-mix(in srgb, var(--vyasa-paper) 98%, transparent)', boxShadow: '0 28px 70px rgba(0,0,0,0.32)', color: 'var(--vyasa-ink)' }
                },
                    R.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' } },
                        R.createElement('strong', { style: { fontSize: '20px' } }, 'Graph help'),
                        R.createElement('button', { type: 'button', onClick: () => setHelpOpen(false), style: { border: 'none', background: 'none', cursor: 'pointer', fontSize: '22px', lineHeight: 1, opacity: 0.6 } }, '×')
                    ),
                    sep(),
                    heading('Mouse'),
                    row('Click node', 'select card or group'),
                    row('Click edge', 'open edge details'),
                    row('Click canvas', 'clear selection'),
                    row('D + click [[node]]', 'go to referenced node'),
                    row('Drag canvas', 'pan, cursor stays put'),
                    row('Shift + drag', 'box select'),
                    row('Cmd + drag', 'lasso select'),
                    row('Alt + Shift + drag', 'append lasso selection'),
                    row('Wheel / pinch', 'zoom'),
                    row('Drag canvas', 'pan'),
                    sep(),
                    heading('Keys'),
                    row('?', 'toggle this help'),
                    row('[ / ]', 'select previous / next visible edge'),
                    row('Enter', 'pin hovered node / open selected edge'),
                    row('Enter on card', 'focus Notes'),
                    row('Shift + Enter', 'center pinned node or fit pinned edge'),
                    row('F', 'fit view or active edge'),
                    row('Option + F', 'fit highlighted edge'),
                    row('W / Q', 'hold edge preview / opposite node card'),
                    row('W + Enter', 'pin edge details'),
                    row('A', 'hold code preview of the Code attribute; wheel scrolls it'),
                    row('W + A', 'hold code preview of the held edge'),
                    row('A + Enter', 'pin the code preview'),
                    row('A + ← / →', 'previous / next marked code block'),
                    row('Shift + F', 'toggle fullscreen'),
                    row('G', 'open EG for hovered or selected node'),
                    row('Shift + G', 'open EG+ for hovered or selected node'),
                    row('S', 'toggle filters'),
                    row('E', 'toggle edges'),
                    row('Shift + E', 'toggle edge labels'),
                    row('C', 'hover cards: off / right side'),
                    row('V', 'toggle hover card scroll mode'),
                    row('Shift + C', 'toggle group hover cards'),
                    row('T', 'toggle hovered group'),
                    row('I / O', 'expand / collapse one depth'),
                    row('U / P', 'unfold / collapse all'),
                    row('=', 'grow hovered or selected node to its neighbours'),
                    row('-', 'undo one growth step'),
                    row('Option + ↑ / ↓', 'zoom in / out'),
                    row('Arrows', 'pan'),
                    row('Shift + arrows', 'pan faster'),
                    row('H / J / K / L', 'pan left / down / up / right'),
                    row('Shift + J / K', 'zoom in / out'),
                    row('Hold H J K L', 'keep moving, coast on release')
                ));
            };
            const SlideLauncher = () => {
                if (!slides.length || slideIndex >= 0) return null;
                return window.React.createElement('button', {
                    type: 'button', onClick: () => setSlideIndex(0),
                    style: { position: 'absolute', left: '12px', top: '12px', zIndex: 36, padding: '7px 13px', borderRadius: '9px', border: '1px solid color-mix(in srgb, var(--vyasa-primary) 28%, transparent)', background: 'color-mix(in srgb, var(--vyasa-paper) 94%, transparent)', boxShadow: '0 8px 20px rgba(0,0,0,0.12)', backdropFilter: 'blur(8px)', cursor: 'pointer', fontSize: '12px', fontWeight: 600 },
                }, '▶ Slides');
            };
            const SlideShow = () => {
                if (!slides.length || slideIndex < 0) return null;
                const navBtn = (disabled) => ({ flex: '0 0 34px', width: '34px', height: '34px', border: '1px solid color-mix(in srgb, var(--vyasa-primary) 24%, transparent)', background: 'color-mix(in srgb, var(--vyasa-paper) 88%, transparent)', borderRadius: '8px', padding: 0, fontSize: '18px', lineHeight: 1, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.4 : 1 });
                const jumpSelectStyle = { flex: '1 1 auto', minWidth: 0, height: '34px', border: '1px solid color-mix(in srgb, var(--vyasa-primary) 24%, transparent)', background: 'color-mix(in srgb, var(--vyasa-paper) 92%, transparent)', color: 'inherit', borderRadius: '8px', padding: '0 8px', fontSize: '12px', fontWeight: 700, textAlign: 'center' };
                const slide = slides[slideIndex] || {};
                const slideDescriptionHtml = slide.__rendered_attrs__?.desc || slide.__rendered_attrs__?.description || '';
                const slideDescriptionText = slide.desc || slide.description || '';
                const close = () => { setSlideFocusMode('off'); setSlideIndex(-1); setSelectedNodeId(null); setSelectedNodeIds(new Set()); };
                const go = (delta) => setSlideIndex((index) => Math.min(slides.length - 1, Math.max(0, index + delta)));
                const focusBtn = (active) => ({ flex: '1 1 0', height: '30px', border: `1px solid ${active ? 'var(--vyasa-primary)' : 'color-mix(in srgb, var(--vyasa-primary) 26%, transparent)'}`, background: active ? 'color-mix(in srgb, var(--vyasa-primary) 86%, transparent)' : 'color-mix(in srgb, var(--vyasa-paper) 90%, transparent)', color: active ? 'var(--vyasa-paper)' : 'inherit', borderRadius: '8px', padding: '0 10px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', boxShadow: active ? '0 0 0 3px color-mix(in srgb, var(--vyasa-primary) 22%, transparent)' : 'none' });
                const panelWidth = `min(${filterPanelWidthSetting}, calc(100% - 24px))`;
                return window.React.createElement('aside', {
                    style: { flex: `0 0 ${panelWidth}`, width: panelWidth, minWidth: 0, height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', padding: '16px', borderRadius: '14px', border: '1px solid color-mix(in srgb, var(--vyasa-primary) 26%, transparent)', background: 'color-mix(in srgb, var(--vyasa-paper) 95%, transparent)', boxShadow: '0 14px 36px rgba(0,0,0,0.16)', pointerEvents: 'auto' },
                },
                    window.React.createElement('div', { className: 'vyasa-task-slide-nav', style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', paddingBottom: '8px', borderBottom: '1px solid color-mix(in srgb, var(--vyasa-primary) 14%, transparent)' } },
                        window.React.createElement('button', { type: 'button', 'aria-label': 'Previous slide', onClick: () => go(-1), disabled: slideIndex <= 0, style: navBtn(slideIndex <= 0) }, '‹'),
                        window.React.createElement('select', {
                            'aria-label': 'Jump to slide',
                            value: String(slideIndex),
                            onChange: (event) => setSlideIndex(Number(event.target.value)),
                            style: jumpSelectStyle,
                        }, slides.map((entry, index) => window.React.createElement('option', { key: entry.id || index, value: String(index) }, `${index + 1} / ${slides.length}`))),
                        window.React.createElement('button', { type: 'button', 'aria-label': 'Next slide', onClick: () => go(1), disabled: slideIndex >= slides.length - 1, style: navBtn(slideIndex >= slides.length - 1) }, '›')
                    ),
                    window.React.createElement('div', { style: { display: 'flex', gap: '6px', marginBottom: '10px' } },
                        window.React.createElement('button', { type: 'button', title: "Focus this slide's nodes in a compact view (toggle)", onClick: () => setSlideFocusMode((m) => m === 'eg' ? 'off' : 'eg'), style: focusBtn(slideFocusMode === 'eg') }, 'EG'),
                        window.React.createElement('button', { type: 'button', title: "Focus this slide's nodes plus their direct neighbors, dimmed (toggle)", onClick: () => setSlideFocusMode((m) => m === 'egplus' ? 'off' : 'egplus'), style: focusBtn(slideFocusMode === 'egplus') }, 'EG+')
                    ),
                    window.React.createElement('div', { style: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' } },
                        window.React.createElement('strong', { style: { fontSize: '16px' } }, slide.title || `Slide ${slideIndex + 1}`),
                        window.React.createElement('button', { type: 'button', onClick: close, style: { border: 'none', background: 'none', cursor: 'pointer', fontSize: '18px', lineHeight: 1, opacity: 0.6 } }, '×')
                    ),
                    window.React.createElement('div', { style: { flex: '1 1 auto', minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' } },
                        tasksCaptionElement(slide, { fontSize: '13px', fontWeight: 600, opacity: 0.85, marginBottom: '10px' }),
                        slideDescriptionHtml
                            ? window.React.createElement('div', { className: 'vyasa-task-slide-description', style: { fontSize: '13.5px', lineHeight: 1.55, opacity: 0.92, marginBottom: '12px' }, dangerouslySetInnerHTML: { __html: slideDescriptionHtml } })
                            : (slideDescriptionText ? window.React.createElement('div', { className: 'vyasa-task-slide-description', style: { fontSize: '13.5px', lineHeight: 1.55, opacity: 0.92, marginBottom: '12px' } }, slideDescriptionText) : null),
                        window.React.createElement('label', { style: { display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr)', gap: '6px', marginTop: 'auto', paddingTop: '12px', minHeight: '50%' } },
                            window.React.createElement('span', { style: { fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', opacity: 0.62 } }, 'Notes'),
                            window.React.createElement('textarea', {
                                value: slideNoteInputValue,
                                onChange: (event) => setSlideNoteInputValue(event.target.value),
                                placeholder: 'Capture presenter cues, follow-ups, or context for this slide.',
                                style: { width: '100%', height: '100%', minHeight: '0', resize: 'vertical', boxSizing: 'border-box', borderRadius: '10px', border: '1px solid color-mix(in srgb, currentColor 14%, transparent)', background: 'color-mix(in srgb, var(--vyasa-paper) 97%, transparent)', color: 'inherit', padding: '10px 11px', fontSize: '12.5px', lineHeight: 1.5 },
                            })
                        )
                    )
                );
            };
            const DragSelectionOverlay = () => {
                if (!dragSelection) return null;
                const bounds = flowWrapperRef.current?.getBoundingClientRect?.();
                const offsetX = bounds?.left || 0;
                const offsetY = bounds?.top || 0;
                if (dragSelection.mode === 'lasso') {
                    const d = (dragSelection.clientPoints || []).map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x - offsetX} ${point.y - offsetY}`).join(' ');
                    return window.React.createElement('svg', {
                        style: { position: 'absolute', inset: 0, zIndex: 2500, pointerEvents: 'none', overflow: 'visible' },
                    },
                    window.React.createElement('path', {
                        d,
                        fill: 'none',
                        stroke: 'color-mix(in srgb, var(--vyasa-primary) 82%, transparent)',
                        strokeWidth: 2,
                        strokeLinejoin: 'round',
                        strokeLinecap: 'round',
                    }),
                    window.React.createElement('path', {
                        d: `${d} Z`,
                        fill: 'color-mix(in srgb, var(--vyasa-primary) 10%, transparent)',
                        stroke: 'none',
                    }));
                }
                const left = Math.min(dragSelection.startClientX, dragSelection.currentClientX) - offsetX;
                const top = Math.min(dragSelection.startClientY, dragSelection.currentClientY) - offsetY;
                const width = Math.abs(dragSelection.currentClientX - dragSelection.startClientX);
                const height = Math.abs(dragSelection.currentClientY - dragSelection.startClientY);
                return window.React.createElement('div', {
                    style: {
                        position: 'absolute',
                        left,
                        top,
                        width,
                        height,
                        zIndex: 2500,
                        pointerEvents: 'none',
                        border: '1px solid color-mix(in srgb, var(--vyasa-primary) 76%, transparent)',
                        background: 'color-mix(in srgb, var(--vyasa-primary) 12%, transparent)',
                        borderRadius: '6px',
                    },
                });
            };
            const filterPanelElement = FilterPanel();
            const paneClick = () => {
                if (suppressNextGraphClickRef.current) {
                    suppressNextGraphClickRef.current = false;
                    return;
                }
                const diffSelection = contextDiffSelectionRef.current;
                const diffOwnsSelection = contextDiffEnabled
                    && Boolean(diffSelection.key)
                    && diffSelection.ids.size > 0
                    && !selectedNodeIdRef.current
                    && selectedNodeIdsRef.current.size === diffSelection.ids.size
                    && Array.from(selectedNodeIdsRef.current).every((id) => diffSelection.ids.has(id));
                if (diffOwnsSelection) {
                    logTasksDebug('selectionClearBlocked', { widgetId, reason: 'contextDiffPaneClick' });
                    return;
                }
                if (slideIndex >= 0 && slides[slideIndex]) {
                    setSelectedNodeId(null);
                    setHoveredNodeId(null);
                    setSelectedNodeIds(new Set((slides[slideIndex].nodes || []).map((id) => String(id || '').trim()).filter(Boolean)));
                    return;
                }
                if (selectedNodeId && selectedNodeIds.size) {
                    setSelectedNodeId(null);
                    setHoveredNodeId(null);
                    return;
                }
                clearSelection('paneClick');
            };
            // A drag on the pane pans with the cursor locked in place. The browser
            // hides the cursor for the length of the drag and puts it back at the
            // press point, so a long pan never runs the pointer into a screen edge.
            //
            //   pointerdown on the pane  -> arm, but do not touch the cursor yet
            //   pointermove past 3px     -> take the lock, then pan by movementX/Y
            //   pointerup                -> give the cursor back, drop the click
            //
            // The lock waits for real movement so a plain click never hides the
            // cursor. A pointerdown grants transient activation for several seconds,
            // so the later request still counts as a user gesture.
            //
            // React Flow's own pan stays on as the fallback. The spec holds clientX
            // and clientY constant while the pointer is locked, so its d3 drag reads
            // no movement once the lock lands. A browser that refuses the lock pans
            // that way for the whole drag, with a visible cursor that travels.
            const lockedPanRef = React.useRef({ active: false, engaged: false, distance: 0 });
            React.useEffect(() => {
                const onPointerLockChange = () => {
                    if (document.pointerLockElement !== flowWrapperRef.current) return;
                    // The lock is asynchronous and can land after the drag ended.
                    // Hand the cursor straight back rather than stranding it.
                    if (lockedPanRef.current.active) lockedPanRef.current.engaged = true;
                    else document.exitPointerLock?.();
                };
                document.addEventListener('pointerlockchange', onPointerLockChange);
                return () => document.removeEventListener('pointerlockchange', onPointerLockChange);
            }, []);
            const startLockedPan = (event) => {
                if (event.pointerType === 'mouse' && event.button !== 0) return;
                if (event.shiftKey || event.metaKey || event.altKey) return;
                if (!event.target?.closest?.('.react-flow__pane')) return;
                if (!flowWrapperRef.current?.requestPointerLock) return;
                lockedPanRef.current = { active: true, engaged: false, distance: 0 };
            };
            const updateLockedPan = (event) => {
                const pan = lockedPanRef.current;
                if (!pan.active) return;
                const el = flowWrapperRef.current;
                const dx = event.movementX || 0;
                const dy = event.movementY || 0;
                if (!dx && !dy) return;
                if (document.pointerLockElement !== el) {
                    pan.distance += Math.hypot(dx, dy);
                    if (pan.distance < 3) return;
                    try {
                        const request = el.requestPointerLock();
                        if (request?.catch) request.catch(() => { pan.active = false; });
                    } catch {
                        pan.active = false;
                    }
                    return;
                }
                const reactFlow = reactFlowApiRef.current;
                if (!reactFlow) return;
                const viewport = reactFlow.getViewport();
                reactFlow.setViewport({ x: viewport.x + dx, y: viewport.y + dy, zoom: viewport.zoom }, { duration: 0 });
            };
            const stopLockedPan = () => {
                const pan = lockedPanRef.current;
                if (!pan.active) return;
                const engaged = pan.engaged;
                lockedPanRef.current = { active: false, engaged: false, distance: 0 };
                if (document.pointerLockElement === flowWrapperRef.current) document.exitPointerLock?.();
                // A locked pan retargets mouseup to the wrapper, so React Flow reads
                // no pane click. A pan that never locked keeps its own click, and a
                // plain click must still reach the pane and clear the selection.
                if (!engaged) return;
                suppressNextGraphClickRef.current = true;
                window.setTimeout(() => {
                    suppressNextGraphClickRef.current = false;
                }, 0);
            };
            const flowPointerHandlers = {
                onClickCapture: focusNodeReferenceFromEvent,
                onPointerDown: (event) => {
                    markWidgetActive();
                    flowWrapperRef.current?.focus({ preventScroll: true });
                    if (window.__vyasaTasksPerf.enabled) {
                        markTasksFrameProbe(widgetId, flowWrapperRef.current, model, graphBaseRef.current, 'pointerdown', currentPerfViewState());
                    }
                    // Skip hover-clear when pressing a node: clearing hover here runs
                    // applyHighlight synchronously mid-click, which rebuilds the node
                    // DOM under the cursor between mousedown and mouseup and drops the
                    // click through to the pane (clearing the selection). The node
                    // click handler manages hover itself.
                    if (!event.shiftKey && !event.metaKey && !event.target?.closest?.('button, input, textarea, select, a, .react-flow__controls, .vyasa-tasks-filter-card, .react-flow__node')) {
                        clearGraphHoverState('pointer-down');
                    }
                    startLockedPan(event);
                },
                onPointerDownCapture: startDragSelection,
                onPointerMove: (event) => {
                    updateLockedPan(event);
                    updateGroupHoverTooltip(event);
                },
                onPointerUp: stopLockedPan,
                onPointerCancel: stopLockedPan,
                onWheelCapture: (event) => {
                    const scrollCard = hoverCardScrollRef.current || detailCardScrollRef.current;
                    const maxScrollTop = scrollCard ? Math.max(0, scrollCard.scrollHeight - scrollCard.clientHeight) : 0;
                    const maxScrollLeft = scrollCard ? Math.max(0, scrollCard.scrollWidth - scrollCard.clientWidth) : 0;
                    if (hoverCardScrollMode && scrollCard && maxScrollLeft > 0 && Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
                        event.preventDefault();
                        event.stopPropagation();
                        scrollCard.scrollLeft = Math.max(0, Math.min(maxScrollLeft, scrollCard.scrollLeft + event.deltaX));
                        return;
                    }
                    if (hoverCardScrollMode && scrollCard && maxScrollTop > 0) {
                        event.preventDefault();
                        event.stopPropagation();
                        const nextScrollTop = Math.max(0, Math.min(maxScrollTop, scrollCard.scrollTop + event.deltaY));
                        const unusedDelta = event.deltaY - (nextScrollTop - scrollCard.scrollTop);
                        scrollCard.scrollTop = nextScrollTop;
                        applyTasksCardOverscroll(scrollCard, unusedDelta);
                        return;
                    }
                    if (!window.__vyasaTasksPerf.enabled) return;
                    markTasksFrameProbe(widgetId, flowWrapperRef.current, model, graphBaseRef.current, 'wheel', currentPerfViewState());
                    traceTasksInteractionFrame('wheel', {
                        ...tasksPerfContext(widgetId, flowWrapperRef.current, model, graphBaseRef.current),
                        ...tasksPerfWheelPayload(event),
                        surface: tasksPerfSurfaceSnapshot(flowWrapperRef.current, event),
                        scroll: tasksPerfScrollSnapshot(flowWrapperRef.current, event),
                    });
                },
                onPointerMoveCapture: updateDragSelection,
                onPointerUpCapture: finishDragSelection,
                onPointerCancelCapture: finishDragSelection,
                onPointerLeave: (event) => {
                    stopLockedPan();
                    finishDragSelection(event);
                    clearOptionEdgePreview();
                    if (flowWrapperRef.current) delete flowWrapperRef.current.dataset.vyasaReviewPointerTarget;
                    clearGraphHoverState('wrapper-pointer-leave');
                },
            };
            const flowWrapperStyle = {
                flex: '1 1 auto',
                minWidth: 0,
                minHeight: 0,
                alignSelf: 'stretch',
                display: 'flex',
                outline: 'none',
                position: 'relative',
                overflow: 'hidden',
                contain: 'layout paint',
                isolation: 'isolate',
                overscrollBehavior: 'contain',
                touchAction: 'none',
            };
            return rf.ReactFlowProvider ? window.React.createElement(rf.ReactFlowProvider, null,
                window.React.createElement('div', { onPointerDownCapture: markWidgetActive, onFocusCapture: markWidgetActive, style: { width: '100%', height: '100%', flex: '1 1 auto', minHeight: 0, display: 'flex', alignItems: 'stretch', position: 'relative' } },
                    filterPanelElement,
                    window.React.createElement(EdgeLiveStatus),
                    SlideShow(),
                    window.React.createElement('div', { ref: flowWrapperRef, 'data-tasks-canvas': 'true', 'data-vyasa-review-surface': 'knowledge-graph', className: flowWrapperClassName, tabIndex: 0, style: flowWrapperStyle, ...flowPointerHandlers },
                    window.React.createElement(rf.ReactFlow, { nodes, edges, nodeTypes, edgeTypes, defaultEdgeOptions, fitView: true, minZoom: graphMinZoom, nodesDraggable: nodeConnectionExperiment, onNodesChange: moveExperimentNodes, elementsSelectable: false, zoomOnDoubleClick: false, zIndexMode: 'manual', style: { width: '100%', height: '100%' }, onNodeClick: selectGraphNode, onEdgeClick: selectGraphEdge, onNodeDoubleClick: doubleClickGraphNode, onPaneClick: paneClick, onPaneContextMenu: clearSelection },
                    window.React.createElement(rf.Background, backgroundProps),
                    window.React.createElement(TasksNodeHighlightBorders),
                    window.React.createElement(TasksPinnedHeaders),
                    window.React.createElement(EgoCloseControl),
                    window.React.createElement(SlideLauncher),
                    window.React.createElement(FitViewHotkey),
                    window.React.createElement(ActionBridge),
                    window.React.createElement(RestoreEgoViewport),
                    window.React.createElement(FitOnNodesReady)
                    ),
                    RightRail(),
                    window.React.createElement(HelpPopup),
                    GroupHoverTooltip(),
                    window.React.createElement(DragSelectionOverlay)
                ))
            ) : window.React.createElement('div', { onPointerDownCapture: markWidgetActive, onFocusCapture: markWidgetActive, style: { width: '100%', height: '100%', flex: '1 1 auto', minHeight: 0, display: 'flex', alignItems: 'stretch', position: 'relative' } },
                filterPanelElement,
                window.React.createElement(EdgeLiveStatus),
                window.React.createElement('div', { ref: flowWrapperRef, 'data-tasks-canvas': 'true', 'data-vyasa-review-surface': 'knowledge-graph', className: flowWrapperClassName, tabIndex: 0, style: flowWrapperStyle, ...flowPointerHandlers },
                    window.React.createElement(rf.ReactFlow, { nodes, edges, nodeTypes, edgeTypes, defaultEdgeOptions, fitView: true, minZoom: graphMinZoom, nodesDraggable: nodeConnectionExperiment, onNodesChange: moveExperimentNodes, elementsSelectable: false, zoomOnDoubleClick: false, zIndexMode: 'manual', style: { width: '100%', height: '100%' }, onNodeClick: selectGraphNode, onEdgeClick: selectGraphEdge, onNodeDoubleClick: doubleClickGraphNode, onPaneClick: paneClick, onPaneContextMenu: clearSelection },
                    window.React.createElement(rf.Background, backgroundProps),
                        window.React.createElement(TasksNodeHighlightBorders),
                        window.React.createElement(TasksPinnedHeaders),
                    window.React.createElement(EgoCloseControl),
                    window.React.createElement(SlideLauncher),
                        window.React.createElement(FitViewHotkey),
                        window.React.createElement(ActionBridge),
                        window.React.createElement(RestoreEgoViewport),
                        window.React.createElement(FitOnNodesReady)
                    ),
                    RightRail(),
                    window.React.createElement(HelpPopup),
                    GroupHoverTooltip(),
                    window.React.createElement(DragSelectionOverlay)
                )
            );
        };
        if (window.ReactDOM.createRoot) window.ReactDOM.createRoot(mount).render(window.React.createElement(TasksGraphApp)); else window.ReactDOM.render(window.React.createElement(TasksGraphApp), mount);
        wrapper.dataset.tasksMounted = 'true';
    }
    if (needsRetry) window.requestAnimationFrame(() => { renderTasksGraphs(rootElement); });
}
window.__vyasaRenderTasksGraphs = renderTasksGraphs;
document.addEventListener('DOMContentLoaded', () => { renderTasksGraphs(document); });
document.body.addEventListener('htmx:afterSwap', (event) => { renderTasksGraphs(event.target || document); });
document.body.addEventListener('htmx:beforeRequest', (event) => {
    if (!window.__vyasaTasksDebug.enabled) return;
    logTasksDebug('htmx:beforeRequest', {
        path: event.detail?.pathInfo?.requestPath || '',
        targetId: event.detail?.target?.id || '',
    });
});
document.body.addEventListener('htmx:responseError', (event) => {
    if (!window.__vyasaTasksDebug.enabled) return;
    logTasksDebug('htmx:responseError', {
        path: event.detail?.pathInfo?.requestPath || '',
        targetId: event.detail?.target?.id || '',
        status: event.detail?.xhr?.status ?? -1,
    });
});
