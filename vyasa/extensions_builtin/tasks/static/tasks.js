import ELK from 'https://esm.sh/elkjs@0.10.0';
import { applyTasksFilterAttributePolicy, bindPanZoomGestures, buildTaskEdgeAnchors, collectTasksStoredNotes, importTasksStoredNotes, isTasksEdgeInternalToSelection, isTasksEdgeLabelHoverDimmingActive, isTasksEdgeLabelVisible, isTasksGraphNodeSelectable, isTasksUnspecifiedProjectionGroup, layoutDisconnectedTaskNodes, measureTextWidth, nearestTasksIncidentEdge, normalizeTasksNodeImageUrl, packTaskChildRects, resolveTasksNodeImage, selectTasksGraphNodeIdsInPolygon, selectTasksGraphNodeIdsInRect, sizeTaskNode, tasksEdgeLabelZForMode, tasksExpandedRootRect, tasksGraphDynamicMinZoom, tasksGraphNodeAllowsHover, tasksGraphNodeHitArea, tasksIconFilterGroups, tasksProjectionGroupByHierarchy, tasksReuseGraphElements, tasksReviewTarget, tasksUngroupModelForGrouping, tasksViewMatchesContext } from '/static/extensions/tasks/tasks_graph_core.js';
import { logTasksDebug, logTasksDebugVerbose, logTasksPerf, logTasksPerfGraphDomOnce, logTasksPerfPaintState, logTasksPerfScrollOnce, logTasksPerfShellOnce, logTasksPerfSurfaceOnce, markTasksFrameProbe, renderTasksDebugOverlay, startTasksLongTaskObserver, tasksPerfContext, tasksPerfNow, tasksPerfScrollSnapshot, tasksPerfSurfaceSnapshot, tasksPerfWheelPayload, traceTasksInteractionFrame } from '/static/extensions/tasks/tasks_diagnostics.js';
import { buildTasksProjectionConfigText, normalizeTasksAttrText, normalizeTasksFilterQuery, parseTasksProjectionConfigText, tasksAttrValues, tasksCollectSearchMatches, tasksContextDiffSelectionIds, tasksCountFilterRules, tasksEdgeFilterNodeIds, tasksEdgeMetaEntries, tasksEdgesMatchingTypes, tasksEdgeTypeValues, tasksEmptyFilterQuery, tasksFilterHoverFocus, tasksFilterQueryHasAnyRules, tasksFilterQueryHasRules, tasksFilterQuerySelectedValues, tasksFilterValueEditorType, tasksFilterValueList, tasksGroupHoverAttrRows, tasksIsHiddenNodeMetaKey, tasksLogicalNodeId, tasksNodeMatchesAllFilters, tasksNodeMetaEntries, tasksOrderedEdges, tasksPruneFilterQueryFields, tasksSelectionClickKey, toggleTasksFilterQueryValue } from '/static/extensions/tasks/tasks_graph_model.js';
import { createTasksFullscreenController } from '/static/extensions/tasks/tasks_fullscreen.js';
import { ensureTasksQueryBuilder, ensureTasksReactFlow } from '/static/extensions/tasks/tasks_runtime.js';
import { createMomentumRunner, shortcutsSuspended } from '/static/page_shell.js';

window.__vyasaTasksPhaseLog?.('tasks-js:module-start');

const tasksElk = new ELK();
const TASKS_GROUP_PADDING = { top: 68, right: 40, bottom: 40, left: 40 };
const TASKS_ROOT_SPACING = { node: 44, layer: 96 };
const TASKS_ROOT_COLLISION_GAP = 96;
const TASKS_GROUP_BG_Z = 10;
const TASKS_EDGE_Z = 5;
const TASKS_EDGE_LABEL_Z = 6;
function tasksSetEdgeLabelsVisible(visible) {
    document.documentElement.classList.toggle('vyasa-tasks-edge-labels-on', visible === true);
    return visible === true;
}
window.tasksSetEdgeLabelsVisible = tasksSetEdgeLabelsVisible;
const TASKS_EDGE_LABEL_FOCUS_Z = 1400;
const TASKS_GROUP_Z = 180;
const TASKS_TASK_Z = 1000;
const TASKS_EDGE_LABEL_SELECTED_Z = TASKS_TASK_Z - 1;
const TASKS_EDGE_FOCUS_Z = TASKS_TASK_Z - 2;
const TASKS_TITLE_Z = 300;
const TASKS_NEIGHBOR_Z_BOOST = 260;
const TASKS_SELECTED_Z_BOOST = 520;
const TASKS_NODE_BG = 'color-mix(in srgb, var(--vyasa-paper) 86%, var(--vyasa-primary) 14%)';
const TASKS_GROUP_BG = 'color-mix(in srgb, var(--vyasa-paper) 88%, var(--vyasa-primary) 12%)';
const TASKS_GROUP_EXPANDED_BG = 'transparent';
const TASKS_NODE_BORDER = '1px solid color-mix(in srgb, var(--vyasa-paper) 42%, var(--vyasa-primary) 58%)';
const TASKS_GROUP_TITLE_BG = 'color-mix(in srgb, var(--vyasa-paper) 76%, var(--vyasa-primary) 24%)';
const TASKS_EDGE_LABEL_BG = 'color-mix(in srgb, var(--vyasa-paper) 94%, var(--vyasa-primary) 6%)';
const TASKS_EDGE_LABEL_TEXT = 'var(--vyasa-ink)';
const TASKS_NODE_BG_ACTIVE = 'color-mix(in srgb, var(--vyasa-paper) 74%, var(--vyasa-primary) 26%)';
const TASKS_GROUP_BG_ACTIVE = 'color-mix(in srgb, var(--vyasa-primary) 10%, transparent)';
const TASKS_EDGE_FOCUS_OUT_COLOR = 'color-mix(in srgb, var(--vyasa-primary) 42%, #ef4444 58%)';
const TASKS_EDGE_FOCUS_IN_COLOR = 'color-mix(in srgb, var(--vyasa-primary) 40%, #22c55e 60%)';
const TASKS_NODE_LABEL_FONT_SIZE = 16;
const TASKS_EDGE_LABEL_NODE_SIZE_RATIO = 1.35;
const TASKS_EDGE_LABEL_FOCUS_FONT_SIZE = 16;
const TASKS_AUTO_FIT_ON_EXPAND_DEFAULT = false;
const TASKS_AUTO_FIT_ON_FILTER_DEFAULT = true;
const TASKS_FILTER_PANEL_WIDTH = 440;
const TASKS_PROJECTION_GROUP_OPACITY_DEFAULT = 12;
const TASKS_PROJECTION_UNSPECIFIED_GROUP_OPACITY_DEFAULT = 7;
const TASKS_PROJECTION_UNSPECIFIED_CONTENT_OPACITY_DEFAULT = 0.82;
const TASKS_EDGE_OPACITY_MIN = 0.05;
const TASKS_EDGE_OPACITY_MAX = 1;
const TASKS_GRAPH_MIN_ZOOM = 0.05;
// The graph sets no maxZoom, so this is React Flow's own default ceiling. Held-key
// zoom writes the viewport itself, so it has to stop at the same place the wheel does.
const TASKS_GRAPH_MAX_ZOOM = 2;
const TASKS_NODE_CONNECTION_HANDLES = {
    source: ['top', 'right', 'bottom', 'left'].flatMap((side) => [0, 1, 2].map((index) => ({ id: `source-${side}-${index}`, side, offsetPct: 50 }))),
    target: ['top', 'right', 'bottom', 'left'].flatMap((side) => [0, 1, 2].map((index) => ({ id: `target-${side}-${index}`, side, offsetPct: 50 }))),
};
// Do NOT reach for React Flow's onlyRenderVisibleElements here: group children
// carry parentId-relative positions, so its visibility test culls them at the
// wrong absolute coords and nodes vanish when zoomed out.
const TASKS_DONE_ACCENT = '#22c55e';
const TASKS_CARD_STATE_ATTR = 'card_state';
const TASKS_HAS_NOTE_ATTR = 'has_note';
const TASKS_FILTER_TEXT_VALUE_LIMIT = 24;
const TASKS_FILTER_TEXT_VALUE_LENGTH = 48;
const TASKS_HAS_NOTE_PALETTE = { yes: '#22c55e', no: 'rgba(220, 38, 38, 0.28)' };
const TASKS_DARK_PALETTE_CONTRAST = 3.2;
const TASKS_DARK_PALETTE_MIN_L = 0.68;
const TASKS_DARK_PALETTE_MAX_L = 0.9;
const TASKS_DARK_PALETTE_MAX_CHROMA = 0.19;
const TASKS_DEFAULT_CARD_STATES = ['Not Done', 'Done'];
const TASKS_STORAGE_WRITE_DELAY_MS = 180;
const tasksStorageWriteCache = new Map();
const tasksStorageWriteTimers = new Map();
const tasksDisplayPaletteColorCache = new Map();
const TASKS_SPECIAL_NODE_ATTRS = new Set([
    TASKS_CARD_STATE_ATTR,
    TASKS_HAS_NOTE_ATTR,
    '__checked__',
    '__card_state__',
    '__card_state_color__',
    '__has_note__',
    '__node_image__',
    '__color_levels__',
]);
const TASKS_INTERNAL_NODE_META_KEYS = new Set([
    'id', 'label', 'kind', '__kind__', 'group_id', 'parent_group_id',
    'handlelayout', 'highlightmode', 'sourcegroupid', 'source_group_id',
    '__rendered_attrs__', 'width', 'height', 'position', 'parentid',
    'parent_id', 'color', 'href', 'image', 'image_by', 'collapsed', 'child_group_ids',
    'child_task_ids', '__projection_group__', 'projection', '__kg_sources',
    '__source_node_id', '__source_edge_id',
    'active_projection', 'graph_x', 'graph_y', '__gantt', '__projection_branch_opacity__',
]);
const TASKS_GANTT_UNIT_WIDTH = 340;
const TASKS_GANTT_ROW_GAP = 56;
const TASKS_GANTT_BAR_MIN_HEIGHT = 34;
const TASKS_GANTT_LEFT = 210;
const TASKS_GANTT_TOP = 86;
const TASKS_GANTT_PROJECTION_ID = '__gantt__';
const TASKS_PROJECTION_UNSPECIFIED_LABEL = 'Unspecified';
const TASKS_DERIVED_METRIC_KEYS = new Set(['rank', 'connectivity']);
const TASKS_SPECIAL_COLOR_MODE_KEYS = new Set(['connectivity', 'rank']);
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

function readTasksDirection(value) {
    const raw = String(value || 'TD').trim().toUpperCase();
    if (raw === 'LR' || raw === 'RIGHT') return 'RIGHT';
    return 'DOWN';
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

function tasksModelSetting(model, key, fallback = '') {
    const value = model && Object.prototype.hasOwnProperty.call(model, key) ? model[key] : undefined;
    if (value === null || value === undefined || String(value).trim?.() === '') return fallback;
    return value;
}

// C cycles the hover card through these, in this order. 'cursor' and 'rightRail'
// are the placements the card already knew; 'off' is the old hidden state.
const TASKS_HOVER_CARD_MODES = ['off', 'cursor', 'rightRail'];
// Every key the graph shortcut handler consumes. It stops these from reaching the
// document shortcuts while a graph is focused; anything absent here stays the
// document's key.
const TASKS_SHORTCUT_KEYS = new Set([
    'f', 'g', 's', 'e', 'c', 't', 'i', 'o', 'u', 'p',
    'h', 'j', 'k', 'l',
    '[', ']', 'enter',
    'arrowup', 'arrowdown', 'arrowleft', 'arrowright',
]);
// Momentum speed is in pixels per millisecond, so zoom turns that distance into a
// factor: at the ceiling speed the graph doubles in about three quarters of a second.
const TASKS_ZOOM_MOMENTUM_RATE = 0.0007;
// No document path in the keys: E and C are one setting for every graph on this
// server, and localStorage is already scoped to the origin.
const TASKS_EDGES_VISIBLE_KEY = 'vyasa:tasks:edges-visible';
const TASKS_HOVER_CARD_MODE_KEY = 'vyasa:tasks:hover-card-mode';

function nextTasksHoverCardMode(mode) {
    const index = TASKS_HOVER_CARD_MODES.indexOf(mode);
    if (index < 0) return 'cursor';
    return TASKS_HOVER_CARD_MODES[(index + 1) % TASKS_HOVER_CARD_MODES.length];
}

function clampTasksHoverCardMode(mode, fallback = 'cursor') {
    return TASKS_HOVER_CARD_MODES.includes(mode) ? mode : fallback;
}

function tasksModelBooleanSetting(model, key, fallback = false) {
    const value = tasksModelSetting(model, key, fallback ? 'true' : 'false');
    if (typeof value === 'boolean') return value;
    const normalized = String(value || '').trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
    return fallback;
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

function tasksCssFontSize(value, fallback = '11px') {
    if (typeof value === 'number' && Number.isFinite(value)) return `${value}px`;
    if (typeof value === 'string' && value.trim()) return value.trim();
    return fallback;
}

function tasksProminentEdgeLabelScale(zoom, edgeFontSize, nodeFontSize = TASKS_NODE_LABEL_FONT_SIZE, fixed = false) {
    const z = Number(zoom);
    if (!Number.isFinite(z) || z <= 0) return 1;
    if (fixed) return 1 / z;
    const edgePx = Number.parseFloat(tasksCssFontSize(edgeFontSize, '12px'));
    const nodePx = Number(nodeFontSize);
    const maxCounterScale = Number.isFinite(edgePx) && edgePx > 0 && Number.isFinite(nodePx) && nodePx > 0
        ? (nodePx * TASKS_EDGE_LABEL_NODE_SIZE_RATIO) / edgePx
        : 1;
    return Math.min(1 / z, maxCounterScale);
}

async function copyTasksText(text) {
    const value = String(text || '');
    if (!value) return false;
    if (navigator.clipboard?.writeText) {
        try {
            await navigator.clipboard.writeText(value);
            return true;
        } catch (_) {}
    }
    if (typeof document === 'undefined') return false;
    const input = document.createElement('textarea');
    input.value = value;
    input.setAttribute('readonly', 'readonly');
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.appendChild(input);
    input.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(input);
    return copied;
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

function clampTasksEdgeOpacity(value) {
    const parsed = Number.parseFloat(String(value ?? ''));
    if (!Number.isFinite(parsed)) return TASKS_EDGE_OPACITY_MAX;
    return Math.max(TASKS_EDGE_OPACITY_MIN, Math.min(TASKS_EDGE_OPACITY_MAX, parsed));
}

function clampTasksProjectionContentOpacity(value) {
    const parsed = Number.parseFloat(String(value ?? ''));
    if (!Number.isFinite(parsed)) return TASKS_PROJECTION_UNSPECIFIED_CONTENT_OPACITY_DEFAULT;
    return Math.max(0.02, Math.min(1, parsed));
}

function tasksOpacityPctLabel(value) {
    return `${Math.round(clampTasksProjectionContentOpacity(value) * 100)}%`;
}

function tasksDefaultEdgeOpacity(edgeCount) {
    const count = Math.max(1, Number.parseFloat(String(edgeCount ?? '')) || 1);
    return clampTasksEdgeOpacity(5 / Math.sqrt(count));
}

function tasksApplyEdgeOpacity(alpha, opacity) {
    const base = Number(alpha);
    const normalized = Number.isFinite(base) ? Math.max(0, Math.min(1, base)) : 1;
    return Number((normalized * clampTasksEdgeOpacity(opacity)).toFixed(4));
}

function tasksProminentEdgeOpacity() {
    return 1;
}

function tasksEdgeOpacityLabel(opacity) {
    const value = clampTasksEdgeOpacity(opacity);
    if (value <= 0.2) return 'Faint';
    if (value >= 0.85) return 'Bold';
    return 'Clear';
}

function tasksEdgeStrokeWidthForMode(mode) {
    if (mode === 'focused-in' || mode === 'focused-out' || mode === 'selected-in' || mode === 'selected-out' || mode === 'selected') return 3.5;
    return 1.25;
}

function tasksTaperedBezierPath(bezierPath, sourceWidth, targetWidth) {
    const nums = String(bezierPath || '').match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi)?.map(Number) || [];
    if (nums.length < 8) return '';
    const [x0, y0, x1, y1, x2, y2, x3, y3] = nums;
    const normal = (ax, ay, bx, by) => {
        const dx = bx - ax;
        const dy = by - ay;
        const len = Math.hypot(dx, dy) || 1;
        return { x: -dy / len, y: dx / len };
    };
    const n0 = normal(x0, y0, x1, y1);
    const n3 = normal(x2, y2, x3, y3);
    const w0 = Math.max(0.5, Number(sourceWidth) || 1) / 2;
    const w3 = Math.max(0.5, Number(targetWidth) || 1) / 2;
    return [
        `M ${x0 + n0.x * w0} ${y0 + n0.y * w0}`,
        `C ${x1 + n0.x * w0} ${y1 + n0.y * w0} ${x2 + n3.x * w3} ${y2 + n3.y * w3} ${x3 + n3.x * w3} ${y3 + n3.y * w3}`,
        `L ${x3 - n3.x * w3} ${y3 - n3.y * w3}`,
        `C ${x2 - n3.x * w3} ${y2 - n3.y * w3} ${x1 - n0.x * w0} ${y1 - n0.y * w0} ${x0 - n0.x * w0} ${y0 - n0.y * w0}`,
        'Z',
    ].join(' ');
}

// A highlighted edge sweeps a bright band along the curve, always from source
// to target so the flare reads as the edge's own direction. strokeMode only
// says whether this edge is highlighted at all.
function isTasksEdgeFlareActive(strokeMode) {
    return ['selected', 'selected-in', 'selected-out', 'focused-in', 'focused-out'].includes(strokeMode);
}

// Mask region in flow coordinates. objectBoundingBox units collapse on
// axis-aligned edges, whose fill bbox is a flat line, so state the box.
function tasksEdgeFlareBox(bezierPath, pad) {
    const nums = String(bezierPath || '').match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi)?.map(Number) || [];
    if (nums.length < 8) return null;
    const xs = nums.filter((_, index) => index % 2 === 0);
    const ys = nums.filter((_, index) => index % 2 === 1);
    const margin = Math.max(1, Number(pad) || 1);
    return {
        x: Math.min(...xs) - margin,
        y: Math.min(...ys) - margin,
        width: (Math.max(...xs) - Math.min(...xs)) + (margin * 2),
        height: (Math.max(...ys) - Math.min(...ys)) + (margin * 2),
    };
}

function tasksTaperedArrowHeadPath(bezierPath, size) {
    const nums = String(bezierPath || '').match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi)?.map(Number) || [];
    if (nums.length < 8) return '';
    const [, , , , x2, y2, x3, y3] = nums;
    const dx = x3 - x2;
    const dy = y3 - y2;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const nx = -uy;
    const ny = ux;
    const arrowLength = Math.max(6, Number(size) || 10);
    const arrowWidth = arrowLength * 1.18;
    const baseX = x3 - ux * arrowLength;
    const baseY = y3 - uy * arrowLength;
    return [
        `M ${x3} ${y3}`,
        `L ${baseX + nx * arrowWidth / 2} ${baseY + ny * arrowWidth / 2}`,
        `L ${baseX - nx * arrowWidth / 2} ${baseY - ny * arrowWidth / 2}`,
        'Z',
    ].join(' ');
}

function tasksEdgePath(props) {
    const distance = Math.hypot(props.targetX - props.sourceX, props.targetY - props.sourceY);
    const stub = Math.max(56, distance * 0.45);
    const shift = (x, y, position) => ({
        x: x + (position === 'left' ? -stub : position === 'right' ? stub : 0),
        y: y + (position === 'top' ? -stub : position === 'bottom' ? stub : 0),
    });
    const sourceStub = shift(props.sourceX, props.sourceY, props.sourcePosition);
    const targetStub = shift(props.targetX, props.targetY, props.targetPosition);
    return [
        `M ${props.sourceX} ${props.sourceY} C ${sourceStub.x} ${sourceStub.y} ${targetStub.x} ${targetStub.y} ${props.targetX} ${props.targetY}`,
        (props.sourceX + 3 * sourceStub.x + 3 * targetStub.x + props.targetX) / 8,
        (props.sourceY + 3 * sourceStub.y + 3 * targetStub.y + props.targetY) / 8,
    ];
}

function tasksIsIconifyImage(url) {
    return /^https:\/\/api\.iconify\.design\/.+\.svg(?:\?.*)?$/i.test(String(url || '').trim());
}

window.__vyasaTasksActions = window.__vyasaTasksActions || {};
window.__vyasaTasksConfig = window.__vyasaTasksConfig || {};

function tasksSelectionDebugPayload(selectedNodeId, selectedNodeIds, hoveredNodeId = '') {
    return {
        selectedNodeId: String(selectedNodeId || ''),
        selectedNodeIds: Array.from(selectedNodeIds || []).map((id) => String(id || '')).filter(Boolean),
        hoveredNodeId: String(hoveredNodeId || ''),
    };
}

function logTasksColorDebug(model, nodes, activeColorBy, activeColorPalette, colorMix) {
    if (!window.__vyasaTasksDebug.enabled) return;
    const candidates = (nodes || [])
        .filter((node) => node && node.__kind__ !== 'groupTitle' && node.__kind__ !== 'ganttHeader')
        .map((node) => ({
            id: node.id,
            kind: node.__kind__,
            entity_type: node.entity_type || '',
            colorByValue: activeColorBy ? (node[activeColorBy] ?? '') : '',
            resolvedColor: resolveTasksNodeColor(node, model, activeColorBy, activeColorPalette) || '',
        }));
    const hits = candidates.filter((node) => node.resolvedColor).slice(0, 4);
    const misses = candidates.filter((node) => !node.resolvedColor).slice(0, 4);
    const availableColorModes = tasksColorOptions(model).map((option) => option.key);
    const resolvedCount = candidates.filter((node) => node.resolvedColor).length;
    logTasksDebug('color-state', {
        graphId: model?.graph_id || '',
        activeProjection: model?.active_projection || '',
        activeColorBy,
        defaultColorBy: tasksResolvedProjectionDefaultColorBy(model),
        availableColorModes,
        colorMix,
        resolvedCount,
        nodeCount: candidates.length,
        hits,
        misses,
    });
}

const TASKS_PREFS_INDEX_KEY = 'vyasa:tasks:prefs:__index__';
const TASKS_PREFS_MAX_ENTRIES = 200;
const TASKS_ADD_VIEW_OPTION_ID = '__vyasa_add_view__';

function tasksPrefsKey(model) {
    const persistenceId = String(model?.persistence_id || '').trim();
    const documentPath = String(model?.document_path || '').trim();
    if (persistenceId) return `vyasa:tasks:prefs:${documentPath}::${persistenceId}`;
    const graphId = String(model?.graph_id || '').trim();
    return graphId ? `vyasa:tasks:prefs:${graphId}` : '';
}

function tasksCheckedStateKey(model) {
    const documentPath = String(model?.document_path || '').trim();
    const persistenceId = String(model?.persistence_id || '').trim();
    const graphId = String(model?.graph_id || '').trim();
    const title = String(model?.title || '').trim();
    const stableId = persistenceId || title || graphId;
    if (!stableId) return '';
    return `vyasa:tasks:checked:${documentPath}::${stableId}`;
}

function tasksGetStorage() {
    if (typeof window === 'undefined') return null;
    try {
        return window.localStorage || null;
    } catch {
        return null;
    }
}

function scheduleTasksStorageWrite(key, writeNow, payload = '') {
    if (!key || typeof writeNow !== 'function') return;
    const previous = tasksStorageWriteCache.get(key);
    if (payload && previous === payload) return;
    if (payload) tasksStorageWriteCache.set(key, payload);
    const pending = tasksStorageWriteTimers.get(key);
    if (pending) window.clearTimeout(pending);
    const run = () => {
        tasksStorageWriteTimers.delete(key);
        try {
            writeNow();
        } catch (error) {
            logTasksPerf('storage-error', {
                key,
                name: error?.name || '',
                message: error?.message || String(error || ''),
            });
        }
    };
    const timer = window.setTimeout(run, TASKS_STORAGE_WRITE_DELAY_MS);
    tasksStorageWriteTimers.set(key, timer);
}

function readTasksGlobalToggle(key) {
    const storage = tasksGetStorage();
    if (!storage) return null;
    try {
        return storage.getItem(key);
    } catch {
        return null;
    }
}

function writeTasksGlobalToggle(key, value) {
    const storage = tasksGetStorage();
    if (!storage) return;
    const payload = String(value);
    scheduleTasksStorageWrite(key, () => storage.setItem(key, payload), payload);
}

// Reset to schema defaults has to drop the server-wide value as well, or the
// next projection switch reads it back and the reset looks ignored.
function clearTasksGlobalToggle(key) {
    const pending = tasksStorageWriteTimers.get(key);
    if (pending) window.clearTimeout(pending);
    tasksStorageWriteTimers.delete(key);
    tasksStorageWriteCache.delete(key);
    const storage = tasksGetStorage();
    if (!storage) return;
    try {
        storage.removeItem(key);
    } catch {
        // A blocked or full storage keeps the old value; the next toggle rewrites it.
    }
}

// Null means the toggle was never pressed on this server, so the graph keeps
// whatever its own schema and projection prefs asked for.
function readTasksEdgesVisible() {
    const raw = readTasksGlobalToggle(TASKS_EDGES_VISIBLE_KEY);
    if (raw === 'true') return true;
    return raw === 'false' ? false : null;
}

function readTasksHoverCardMode() {
    const raw = readTasksGlobalToggle(TASKS_HOVER_CARD_MODE_KEY);
    return TASKS_HOVER_CARD_MODES.includes(raw) ? raw : null;
}

function showTasksToast(message) {
    let toast = document.getElementById('vyasa-tasks-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'vyasa-tasks-toast';
        toast.className = 'fixed top-6 right-6 z-[10000] text-xs bg-slate-900 text-white px-3 py-2 rounded shadow-lg opacity-0 transition-opacity duration-300';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.remove('opacity-0');
    toast.classList.add('opacity-100');
    window.clearTimeout(showTasksToast.timeoutId);
    showTasksToast.timeoutId = window.setTimeout(() => {
        toast.classList.remove('opacity-100');
        toast.classList.add('opacity-0');
    }, 1800);
}

function tasksMatchedSlideNodes(slides, slideIndex, graphNodes) {
    const slide = slideIndex >= 0 ? slides[slideIndex] : null;
    if (!slide) return [];
    const ids = new Set((slide.nodes || []).map((id) => String(id || '').trim()).filter(Boolean));
    return (graphNodes || []).filter((node) => node?.id && ids.has(node.id));
}

function buildTasksNodeNotesBackup(model, nodeNotes, nodeStates, slideNotes = {}) {
    const storage = tasksGetStorage();
    const storageKey = tasksPrefsKey(model);
    if (!storage || !storageKey) throw new Error('Browser storage is unavailable for this Knowledge Graph.');
    const prefs = JSON.parse(storage.getItem(storageKey) || '{}');
    prefs.nodeNotes = normalizeTasksNodeNotes(nodeNotes);
    prefs.slideNotes = normalizeTasksNodeNotes(slideNotes);
    prefs.nodeStates = normalizeTasksNodeStates(nodeStates, normalizeTasksCardStates(model));
    storage.setItem(storageKey, JSON.stringify(prefs));
    const nodeTitles = Object.fromEntries(
        [...(model?.groups || []), ...(model?.tasks || [])]
            .filter((node) => node?.id)
            .map((node) => [String(node.id), String(node.label || node.title || node.id)])
    );
    const slideTitles = Object.fromEntries(
        (Array.isArray(model?.slides) ? model.slides : [])
            .filter((slide) => slide?.id)
            .map((slide) => [String(slide.id), String(slide.title || slide.caption || slide.id)])
    );
    const backup = collectTasksStoredNotes(storage, storageKey, nodeTitles, slideTitles);
    const graphName = String(model?.persistence_id || model?.graph_id || 'graph')
        .trim().replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '') || 'graph';
    return {
        filename: `vyasa-kg-notes-${graphName}.txt`,
        text: backup,
    };
}

function downloadTasksNodeNotes(model, nodeNotes, nodeStates, slideNotes = {}) {
    const { filename, text } = buildTasksNodeNotesBackup(model, nodeNotes, nodeStates, slideNotes);
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(href);
    return filename;
}

function uploadTasksNodeNotes(model, cardStates) {
    return new Promise((resolve, reject) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.txt,text/plain,application/json';
        input.addEventListener('change', async () => {
            const file = input.files?.[0];
            if (!file) return resolve(null);
            try {
                const storage = tasksGetStorage();
                const storageKey = tasksPrefsKey(model);
                if (!storage || !storageKey) throw new Error('Browser storage is unavailable for this Knowledge Graph.');
                const backup = await file.text();
                importTasksStoredNotes(storage, storageKey, backup);
                touchTasksPrefsIndex(storage, storageKey);
                const prefs = readTasksPrefs(model);
                resolve({
                    nodeNotes: normalizeTasksNodeNotes(prefs.nodeNotes),
                    slideNotes: normalizeTasksNodeNotes(prefs.slideNotes),
                    nodeStates: normalizeTasksNodeStates(prefs.nodeStates, cardStates),
                });
            } catch (error) {
                reject(error);
            }
        }, { once: true });
        input.click();
    });
}

function readTasksPrefsIndex(storage) {
    try {
        const raw = storage.getItem(TASKS_PREFS_INDEX_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
        return {};
    }
}

function writeTasksPrefsIndex(storage, index) {
    try {
        storage.setItem(TASKS_PREFS_INDEX_KEY, JSON.stringify(index));
    } catch {
        // If even the index can't write, the next eviction round will handle it.
    }
}

function touchTasksPrefsIndex(storage, key) {
    if (!storage || !key) return;
    const index = readTasksPrefsIndex(storage);
    index[key] = Date.now();
    writeTasksPrefsIndex(storage, index);
}

function evictTasksPrefsLRU(storage, keepKey = '', maxEntries = TASKS_PREFS_MAX_ENTRIES) {
    if (!storage) return;
    const index = readTasksPrefsIndex(storage);
    const entries = Object.entries(index).sort((a, b) => a[1] - b[1]);
    let removed = 0;
    while (entries.length > maxEntries) {
        const [key] = entries.shift();
        if (key === keepKey) continue;
        try { storage.removeItem(key); } catch { /* ignore */ }
        delete index[key];
        removed += 1;
    }
    if (removed) writeTasksPrefsIndex(storage, index);
}

function readTasksPrefs(model) {
    const key = tasksPrefsKey(model);
    const storage = tasksGetStorage();
    if (!key || !storage) return {};
    try {
        const parsed = JSON.parse(storage.getItem(key) || '{}');
        if (parsed && typeof parsed === 'object') {
            touchTasksPrefsIndex(storage, key);
            return parsed;
        }
        return {};
    } catch {
        return {};
    }
}

function tasksProjectionPrefsKey(projectionId) {
    const id = String(projectionId || '').trim();
    return id || '__base__';
}

function readTasksProjectionPrefs(prefs, projectionId) {
    return readTasksProjectionPrefsForModel(null, prefs, projectionId);
}

function tasksProjectionSchemaPrefs(model, projectionId) {
    const id = String(projectionId || '').trim();
    const projection = id
        ? (Array.isArray(model?.view_projections) ? model.view_projections : [])
            .find((entry) => entry && entry.id === id)
        : null;
    if (id && !projection) return {};
    const schemaGroupByHierarchy = (id
        ? projection?.groups_from
        : model?.default_group_by
    )?.map?.((entry) => String(entry || '').trim()).filter(Boolean) || [];
    const prefs = {
        groupByEnabled: schemaGroupByHierarchy.length > 0,
        groupByHierarchy: schemaGroupByHierarchy,
        groupByDisabledKeys: [],
    };
    if (!projection) return prefs;
    if (projection.filter_query && typeof projection.filter_query === 'object') {
        prefs.filters = normalizeTasksFilterQuery(projection.filter_query);
    }
    if (typeof projection.query_builder_enabled === 'boolean') prefs.queryBuilderEnabled = projection.query_builder_enabled;
    if (typeof projection.search_enabled === 'boolean') prefs.searchEnabled = projection.search_enabled;
    if (typeof projection.search === 'string') prefs.searchQuery = projection.search;
    if (typeof projection.default_color_by === 'string') prefs.colorBy = projection.default_color_by;
    if (typeof projection.default_secondary_color_by === 'string') prefs.secondaryColorBy = projection.default_secondary_color_by;
    if (typeof projection.filters_collapsed === 'boolean') prefs.filtersCollapsed = projection.filters_collapsed;
    if (typeof projection.edges_visible === 'boolean') prefs.edgesVisible = projection.edges_visible;
    if (projection.edge_opacity !== undefined && projection.edge_opacity !== '') prefs.edgeOpacity = clampTasksEdgeOpacity(projection.edge_opacity);
    if (projection.projection_unspecified_content_opacity !== undefined && projection.projection_unspecified_content_opacity !== '') {
        prefs.unspecifiedContentOpacity = clampTasksProjectionContentOpacity(projection.projection_unspecified_content_opacity);
    }
    return prefs;
}

function tasksGroupByPrefsDifferFromSchema(model, projectionId, enabled, hierarchy, disabledKeys = []) {
    const defaults = tasksProjectionSchemaPrefs(model, projectionId);
    const currentHierarchy = (hierarchy || []).map((entry) => String(entry || '').trim()).filter(Boolean);
    const defaultHierarchy = defaults.groupByHierarchy || [];
    return Boolean(enabled) !== Boolean(defaults.groupByEnabled)
        || currentHierarchy.length !== defaultHierarchy.length
        || currentHierarchy.some((entry, index) => entry !== defaultHierarchy[index])
        || normalizeTasksGroupByDisabledKeys(disabledKeys).length > 0;
}

function normalizeTasksColorHierarchy(value, model, nodeNotes = null) {
    const validColorKeys = new Set(tasksColorOptions(model, nodeNotes).map((option) => option.key));
    const raw = Array.isArray(value) ? value : [];
    const out = [];
    raw.forEach((entry) => {
        const key = String(entry || '').trim();
        if (key && validColorKeys.has(key) && !out.includes(key)) out.push(key);
    });
    return out;
}

function normalizeTasksGroupByDisabledKeys(value) {
    if (!Array.isArray(value)) return [];
    return Array.from(new Set(value.map((entry) => String(entry || '').trim()).filter(Boolean)));
}

function readTasksProjectionPrefsForModel(model, prefs, projectionId) {
    const schemaPrefs = tasksProjectionSchemaPrefs(model, projectionId);
    const key = tasksProjectionPrefsKey(projectionId);
    const scoped = prefs?.projectionPrefs?.[key];
    if (scoped && typeof scoped === 'object') return { ...schemaPrefs, ...scoped };
    if (!String(projectionId || '').trim() && prefs && typeof prefs === 'object') return { ...schemaPrefs, ...prefs };
    if (prefs?.projectionPrefs && typeof prefs.projectionPrefs === 'object') return schemaPrefs;
    return prefs && typeof prefs === 'object' ? { ...schemaPrefs, ...prefs } : schemaPrefs;
}

function normalizeTasksCheckedNodeIds(value) {
    if (!Array.isArray(value)) return [];
    return Array.from(new Set(value.map((entry) => String(entry || '').trim()).filter(Boolean)));
}

function normalizeTasksCardStates(model) {
    const raw = Array.isArray(model?.card_states) ? model.card_states : String(model?.card_states || '').split(',');
    const states = raw.map((entry) => String(entry || '').trim()).filter(Boolean);
    return Array.from(new Set(states.length ? states : TASKS_DEFAULT_CARD_STATES));
}

function normalizeTasksNodeStates(value, cardStates) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const valid = new Set(cardStates);
    const firstState = cardStates[0] || TASKS_DEFAULT_CARD_STATES[0];
    return Object.fromEntries(Object.entries(value)
        .map(([nodeId, state]) => [String(nodeId || '').trim(), String(state || '').trim()])
        .filter(([nodeId, state]) => nodeId && state && state !== firstState && valid.has(state)));
}

function normalizeTasksNodeNotes(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value)
        .map(([nodeId, note]) => [String(nodeId || '').trim(), String(note || '')])
        .filter(([nodeId, note]) => nodeId && note.trim()));
}

function normalizeTasksSlideNotes(value) {
    return normalizeTasksNodeNotes(value);
}

function tasksHasAnyNodeNote(nodeNotes) {
    return Object.values(nodeNotes || {}).some((note) => String(note || '').trim());
}

function tasksCardStateColor(model, state) {
    const palette = model?.node_color_palettes?.[TASKS_CARD_STATE_ATTR];
    if (palette && typeof palette === 'object' && state in palette) return tasksDisplayPaletteColor(palette[state]);
    return state === TASKS_DEFAULT_CARD_STATES[1] ? tasksDisplayPaletteColor(TASKS_DONE_ACCENT) : '';
}

function tasksCardStateForNode(model, nodeStates, nodeId, cardStates) {
    const firstState = cardStates[0] || TASKS_DEFAULT_CARD_STATES[0];
    const state = nodeStates?.[String(nodeId || '')] || firstState;
    const index = Math.max(0, cardStates.indexOf(state));
    return { label: state, done: index > 0, color: tasksCardStateColor(model, state) };
}

function checkedNodeIdsFromStates(nodeStates) {
    return Object.keys(nodeStates || {}).filter(Boolean);
}

function readTasksCheckedNodeIds(model) {
    const key = tasksCheckedStateKey(model);
    const storage = tasksGetStorage();
    if (!key || !storage) return [];
    try {
        return normalizeTasksCheckedNodeIds(JSON.parse(storage.getItem(key) || '[]'));
    } catch {
        return [];
    }
}

function writeTasksCheckedNodeIds(model, checkedNodeIds) {
    const key = tasksCheckedStateKey(model);
    const storage = tasksGetStorage();
    if (!key || !storage) return;
    const payload = JSON.stringify(normalizeTasksCheckedNodeIds(checkedNodeIds));
    scheduleTasksStorageWrite(key, () => storage.setItem(key, payload), payload);
}

function writeTasksPrefs(model, prefs) {
    const key = tasksPrefsKey(model);
    const storage = tasksGetStorage();
    if (!key || !storage) return;
    const projectionId = String(prefs?.projectionId || '').trim();
    const projectionPrefs = prefs?.projectionPrefs && typeof prefs.projectionPrefs === 'object'
        ? prefs.projectionPrefs
        : {};
    const groupByHierarchy = Array.isArray(prefs?.groupByHierarchy)
        ? prefs.groupByHierarchy.map((entry) => String(entry || '').trim()).filter(Boolean)
        : [];
    const groupByEnabled = typeof prefs?.groupByEnabled === 'boolean' ? prefs.groupByEnabled : groupByHierarchy.length > 0;
    const groupByDisabledKeys = normalizeTasksGroupByDisabledKeys(prefs?.groupByDisabledKeys)
        .filter((key) => groupByHierarchy.includes(key));
    const edgeOpacity = prefs?.edgeOpacity;
    const unspecifiedContentOpacity = prefs?.unspecifiedContentOpacity;
    const nodeStates = prefs?.nodeStates && typeof prefs.nodeStates === 'object' && !Array.isArray(prefs.nodeStates)
        ? prefs.nodeStates
        : {};
    const existing = readTasksPrefs(model);
    const nodeNotes = Object.prototype.hasOwnProperty.call(prefs || {}, 'nodeNotes')
        ? normalizeTasksNodeNotes(prefs?.nodeNotes)
        : normalizeTasksNodeNotes(existing.nodeNotes);
    const slideNotes = Object.prototype.hasOwnProperty.call(prefs || {}, 'slideNotes')
        ? normalizeTasksSlideNotes(prefs?.slideNotes)
        : normalizeTasksSlideNotes(existing.slideNotes);
    const payload = JSON.stringify({
        version: 1,
        projectionId,
        edgeOpacity,
        unspecifiedContentOpacity,
        groupByEnabled,
        groupByHierarchy,
        groupByDisabledKeys,
        projectionPrefs,
        nodeStates,
        nodeNotes,
        slideNotes,
    });
    const attempt = () => {
        storage.setItem(key, payload);
        touchTasksPrefsIndex(storage, key);
    };
    scheduleTasksStorageWrite(key, () => {
        try {
            attempt();
            evictTasksPrefsLRU(storage, key);
        } catch {
            // Most likely QuotaExceededError. Evict aggressively (keep half the budget) and retry once.
            evictTasksPrefsLRU(storage, key, Math.floor(TASKS_PREFS_MAX_ENTRIES / 2));
            attempt();
        }
    }, payload);
}

function shouldTraceTasksEdge(edge) {
    if (!window.__vyasaTasksDebug.enabled) return false;
    const watch = Array.isArray(window.__vyasaTasksDebug.watch) ? window.__vyasaTasksDebug.watch : [];
    if (!watch.length) return false;
    return watch.some((item) => item && item.source === edge.source && item.target === edge.target);
}

function traceTasksEdge(stage, edge, payload = {}) {
    if (!shouldTraceTasksEdge(edge)) return null;
    return logTasksDebug(`edgeTrace:${stage}`, {
        raw: { source: edge.source, target: edge.target, label: edge.label || '' },
        ...payload,
    });
}

function rectSummary(rect) {
    if (!rect) return null;
    return {
        x: Math.round(rect.x || 0),
        y: Math.round(rect.y || 0),
        width: Math.round(rect.width || 0),
        height: Math.round(rect.height || 0),
    };
}

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

function escapeTasksHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function tasksOpenDecisionEntry(node) {
    if (!node || node?.__kind__ === 'group' || node?.__kind__ === 'groupTitle') return null;
    if (node?.__checked__ === true) return null;
    const raw = node?.open_decision ?? node?.decision ?? '';
    const value = String(raw).trim();
    if (!value) return null;
    return { key: '__open_decision__', label: 'Open decision', value };
}

function tasksNodeMetaLabel(key) {
    return key.replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function tasksColorModeLabel(key) {
    return key === 'rank' ? 'Flow position' : tasksNodeMetaLabel(key);
}

function tasksIsSpecialColorMode(key) {
    return TASKS_SPECIAL_COLOR_MODE_KEYS.has(String(key || '').toLowerCase());
}

function collectTasksGroupDescendants(nodeId, model) {
    if (!nodeId || !model) return { groups: [], tasks: [] };
    const groupsById = Object.fromEntries((model.groups || []).map((group) => [group.id, group]));
    const tasksById = Object.fromEntries((model.tasks || []).map((task) => [task.id, task]));
    const groups = [];
    const tasks = [];
    const walkGroup = (groupId) => {
        const group = groupsById[groupId];
        if (!group) return;
        groups.push(group);
        for (const taskId of (model.task_children?.[groupId] || [])) {
            if (tasksById[taskId]) tasks.push(tasksById[taskId]);
        }
        for (const childGroupId of (model.group_tree?.[groupId] || [])) walkGroup(childGroupId);
    };
    for (const childGroupId of (model.group_tree?.[nodeId] || [])) walkGroup(childGroupId);
    for (const taskId of (model.task_children?.[nodeId] || [])) {
        if (tasksById[taskId]) tasks.push(tasksById[taskId]);
    }
    return { groups, tasks };
}

function collectTasksGroupDescendantIds(nodeId, model) {
    const descendants = collectTasksGroupDescendants(nodeId, model);
    return new Set([...descendants.groups, ...descendants.tasks].map((node) => node.id).filter(Boolean));
}

function tasksChildGroupIds(nodeId, model) {
    return model?.group_tree?.[nodeId] || [];
}

function tasksChildTaskIds(nodeId, model) {
    return model?.task_children?.[nodeId] || [];
}

function tasksNodeHasChildren(nodeId, model) {
    return tasksChildGroupIds(nodeId, model).length > 0 || tasksChildTaskIds(nodeId, model).length > 0;
}

function tasksVisibleGraphStatsLabel(nodes, edges) {
    const nodeCount = Array.isArray(nodes) ? nodes.length : 0;
    const edgeCount = Array.isArray(edges) ? edges.length : 0;
    const nodeLabel = nodeCount === 1 ? 'Node' : 'Nodes';
    const edgeLabel = edgeCount === 1 ? 'Edge' : 'Edges';
    return `${nodeCount} ${nodeLabel} and ${edgeCount} ${edgeLabel}`;
}

function tasksLogicalGraphStatsLabel(model) {
    const nodeCount = (Array.isArray(model?.groups) ? model.groups.length : 0)
        + (Array.isArray(model?.tasks) ? model.tasks.length : 0);
    const edgeCount = Array.isArray(model?.dependency_edges) ? model.dependency_edges.length : 0;
    const nodeLabel = nodeCount === 1 ? 'Node' : 'Nodes';
    if (edgeCount) {
        const edgeLabel = edgeCount === 1 ? 'Edge' : 'Edges';
        return `${nodeCount} ${nodeLabel} and ${edgeCount} ${edgeLabel}`;
    }
    const childCount = (items) => Array.isArray(items) ? items.length : 0;
    const hasRealParent = (parent) => Boolean(parent) && parent !== 'null' && parent !== 'undefined';
    let hierarchyLinks = 0;
    for (const [parent, items] of Object.entries(model?.group_tree || {})) {
        if (hasRealParent(parent)) hierarchyLinks += childCount(items);
    }
    for (const [parent, items] of Object.entries(model?.task_children || {})) {
        if (hasRealParent(parent)) hierarchyLinks += childCount(items);
    }
    if (hierarchyLinks) {
        const hierarchyLabel = hierarchyLinks === 1 ? 'Hierarchy Link' : 'Hierarchy Links';
        return `${nodeCount} ${nodeLabel} and ${hierarchyLinks} ${hierarchyLabel}`;
    }
    return `${nodeCount} ${nodeLabel} and 0 Edges`;
}

function tasksExpandableNodeIds(model) {
    const ids = new Set();
    for (const group of (model?.groups || [])) {
        if (tasksNodeHasChildren(group.id, model)) ids.add(group.id);
    }
    for (const task of (model?.tasks || [])) {
        if (tasksNodeHasChildren(task.id, model)) ids.add(task.id);
    }
    return ids;
}

function tasksGroupDetailEntries(nodeId, model) {
    if (!nodeId || !model) return [];
    const group = (model.groups || []).find((entry) => entry.id === nodeId);
    if (!group) return [];
    const excludedDerivedKeys = TASKS_DERIVED_METRIC_KEYS;
    const descendants = collectTasksGroupDescendants(nodeId, model);
    const sampleNodes = descendants.tasks.length ? descendants.tasks : descendants.groups;
    const metrics = new Map();
    const discreteColorCounts = new Map();
    const colorPalettes = model?.node_color_palettes && typeof model.node_color_palettes === 'object'
        ? model.node_color_palettes
        : {};
    for (const item of sampleNodes) {
        for (const [key, value] of Object.entries(item || {})) {
            if (tasksIsHiddenNodeMetaKey(key)) continue;
            const numeric = parseTasksNumericValue(value);
            if (numeric === null) continue;
            const stat = metrics.get(key) || { count: 0, sum: 0, min: numeric, max: numeric };
            stat.count += 1;
            stat.sum += numeric;
            stat.min = Math.min(stat.min, numeric);
            stat.max = Math.max(stat.max, numeric);
            metrics.set(key, stat);
        }
        for (const [key, palette] of Object.entries(colorPalettes)) {
            if (excludedDerivedKeys.has(String(key || '').toLowerCase()) || TASKS_SPECIAL_NODE_ATTRS.has(String(key))) continue;
            if (!key || !palette || typeof palette !== 'object' || isTasksGradientPalette(palette)) continue;
            const rawValue = item?.[key];
            if (rawValue === null || rawValue === undefined || String(rawValue).trim() === '') continue;
            const value = String(rawValue);
            if (!(value in palette)) continue;
            if (!discreteColorCounts.has(key)) discreteColorCounts.set(key, new Map());
            const counts = discreteColorCounts.get(key);
            counts.set(value, (counts.get(value) || 0) + 1);
        }
    }
    const detailEntries = [...tasksNodeMetaEntries(group)]
        .filter((entry) => !excludedDerivedKeys.has(String(entry?.key || '').toLowerCase()));
    if (sampleNodes.length) {
        detailEntries.push({
            key: '__child_count__',
            label: descendants.tasks.length ? 'Child items' : 'Child groups',
            value: String(sampleNodes.length),
        });
    }
    const declaredOrder = new Map(tasksActiveHoverAttrs(model, '').map((key, index) => [key, index]));
    const byDeclaredOrder = ([left], [right]) => {
        const leftOrder = declaredOrder.has(left) ? declaredOrder.get(left) : Number.MAX_SAFE_INTEGER;
        const rightOrder = declaredOrder.has(right) ? declaredOrder.get(right) : Number.MAX_SAFE_INTEGER;
        return (leftOrder - rightOrder) || left.localeCompare(right);
    };
    for (const [key, stat] of Array.from(metrics.entries()).sort(byDeclaredOrder)) {
        if (excludedDerivedKeys.has(String(key || '').toLowerCase())) continue;
        const label = tasksNodeMetaLabel(key);
        detailEntries.push({
            key: `range:${key}`,
            label,
            value: `${formatTasksMetricValue(stat.min)} ≤ ${label} (μ ${formatTasksMetricValue(stat.sum / Math.max(stat.count, 1))}) ≤ ${formatTasksMetricValue(stat.max)}`,
        });
    }
    for (const [key, counts] of Array.from(discreteColorCounts.entries()).sort(byDeclaredOrder)) {
        const summary = Array.from(counts.entries())
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([value, count]) => `${value}: ${count}`)
            .join(', ');
        detailEntries.push({ key: `counts:${key}`, label: `${tasksNodeMetaLabel(key)} Counts`, value: summary });
    }
    return detailEntries;
}

function tasksFilterOptions(model) {
    if (!model) return [];
    const indexedKeys = new Set([
        ...(Array.isArray(model?.index_attributes) ? model.index_attributes : []),
        ...(Array.isArray(model?.filter_attributes) ? model.filter_attributes : []),
    ].map((key) => String(key || '').trim()).filter(Boolean));
    const continuousColorKeys = new Set(
        Object.entries(model?.node_color_palettes && typeof model.node_color_palettes === 'object' ? model.node_color_palettes : {})
            .filter(([, palette]) => isTasksGradientPalette(palette))
            .map(([key]) => String(key || '').trim())
            .filter(Boolean)
    );
    const buckets = new Map();
    const visit = (node) => {
        if (!node) return;
        for (const [key, value] of Object.entries(node)) {
            if (tasksIsHiddenNodeMetaKey(key) || value === null || value === undefined || value === '') continue;
            if (continuousColorKeys.has(String(key))) continue;
            const values = tasksAttrValues(value);
            if (!values.length) continue;
            if (!buckets.has(key)) buckets.set(key, { values: new Set(), kinds: new Set() });
            values.forEach((entry) => buckets.get(key).values.add(String(entry)));
            buckets.get(key).kinds.add(Array.isArray(value) ? 'string' : typeof value);
        }
    };
    (model.groups || []).forEach(visit);
    (model.tasks || []).forEach(visit);
    const visibleKeys = new Set(applyTasksFilterAttributePolicy(Array.from(buckets.keys()), model));
    return Array.from(buckets.entries())
        .filter(([key]) => visibleKeys.has(key))
        .map(([key, bucket]) => ({
            key,
            label: tasksNodeMetaLabel(key),
            values: Array.from(bucket.values).sort((a, b) => a.localeCompare(b)),
            isBoolean: bucket.kinds.size === 1 && bucket.kinds.has('boolean'),
            isText: !indexedKeys.has(key)
                || bucket.values.size > TASKS_FILTER_TEXT_VALUE_LIMIT
                || Array.from(bucket.values).some((value) => String(value).length > TASKS_FILTER_TEXT_VALUE_LENGTH),
        }))
        .sort((a, b) => a.label.localeCompare(b.label));
}

function tasksColorOptions(model, nodeNotes = null) {
    const palettes = model?.node_color_palettes && typeof model.node_color_palettes === 'object'
        ? model.node_color_palettes
        : {};
    const declaredKeys = Object.keys(palettes).filter((key) => key && !TASKS_SPECIAL_NODE_ATTRS.has(String(key)) && typeof palettes[key] === 'object' && Object.keys(palettes[key] || {}).length > 0);
    const nodes = [...(model?.groups || []), ...(model?.tasks || [])];
    const keys = declaredKeys
        .filter((key) => nodes.some((node) => {
            return tasksAttrValues(node?.[key]).some((value) => String(value).trim() !== '');
        }));
    if (tasksHasAnyNodeNote(nodeNotes) && !keys.includes(TASKS_HAS_NOTE_ATTR)) keys.push(TASKS_HAS_NOTE_ATTR);
    return keys
        .map((key) => ({
            key,
            label: tasksColorModeLabel(key),
            special: tasksIsSpecialColorMode(key),
        }))
        .sort((a, b) => {
            if (a.special !== b.special) return a.special ? 1 : -1;
            return a.label.localeCompare(b.label);
        });
}

function tasksGroupByOptions(model) {
    const keys = Array.isArray(model?.index_attributes) ? model.index_attributes : [];
    return Array.from(new Set(keys.map((key) => String(key || '').trim()).filter(Boolean)))
        .filter((key) => !TASKS_DERIVED_METRIC_KEYS.has(key.toLowerCase()))
        .map((key) => ({ key, label: tasksNodeMetaLabel(key) }))
        .sort((a, b) => a.label.localeCompare(b.label));
}

function tasksSlug(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'item';
}

function buildTasksCollapsedGraph(model) {
    const groupTree = model.group_tree || {};
    const taskChildren = model.task_children || {};
    const groupsById = Object.fromEntries((model.groups || []).map((group) => [group.id, group]));
    const taskToGroup = Object.fromEntries((model.tasks || []).map((task) => [task.id, task.group_id || null]));
    const groupParent = Object.fromEntries((model.groups || []).map((group) => [group.id, group.parent_group_id || null]));
    const nodes = [];
    const queue = [...(groupTree.null || [])];
    const order = [];
    while (queue.length) {
        const groupId = queue.shift();
        order.push(groupId);
        queue.push(...(groupTree[groupId] || []));
    }
    for (const task of model.tasks || []) {
        if (task.group_id !== null && task.group_id !== undefined) continue;
        nodes.push({ id: task.id, label: task.label || task.id, href: task.href, kind: 'task', collapsed: true, x: 80, y: 80, width: 220, height: 60 });
    }
    order.forEach((groupId, index) => {
        const group = groupsById[groupId] || {};
        nodes.push({
            id: groupId,
            label: group.label || groupId,
            href: group.href,
            kind: 'group',
            collapsed: true,
            x: 80 + (index % 3) * 280,
            y: 80 + Math.floor(index / 3) * 140,
            width: 250,
            height: 80,
            child_group_ids: groupTree[groupId] || [],
            child_task_ids: taskChildren[groupId] || [],
        });
    });
    const collapsedOwner = (taskId) => {
        let cur = taskToGroup[taskId] || null;
        let owner = null;
        while (cur !== null && cur !== undefined) {
            owner = cur;
            cur = groupParent[cur] || null;
        }
        return owner || taskId;
    };
    const edges = [];
    const seen = new Set();
    for (const edge of model.dependency_edges || []) {
        const source = collapsedOwner(edge.source);
        const target = collapsedOwner(edge.target);
        const key = `${source}->${target}`;
        if (source === target || seen.has(key)) continue;
        seen.add(key);
        edges.push({ ...edge, source, target, kind: 'collapsed-proxy' });
    }
    return { nodes, edges };
}

function buildTasksGroupedState(sourceModel, groupByHierarchy) {
    const attrs = (groupByHierarchy || []).map((attr) => String(attr || '').trim()).filter(Boolean);
    if (!attrs.length) return null;
    const groupingSource = buildTasksUngroupedState(sourceModel).model;
    const groups = [];
    const groupsByPath = new Map();
    const groupTree = { null: [] };
    const taskChildren = {};
    const tasks = [];
    // Levels where a task has no value are skipped instead of pooled into a
    // catch-all "Unspecified" group: the task attaches to its deepest valued
    // ancestor, or stays boxless at the top level when it matches no group.
    const valuePath = (task) => attrs
        .map((attr) => [attr, String(task?.[attr] ?? '').trim()])
        .filter(([, value]) => value);
    const pathKey = (pairs) => pairs.map(([attr, value]) => `${attr}=${value}`).join('\u001f');
    for (const task of groupingSource.tasks || []) {
        const path = valuePath(task);
        for (let depth = 1; depth <= path.length; depth += 1) {
            const prefix = path.slice(0, depth);
            const key = pathKey(prefix);
            if (groupsByPath.has(key)) continue;
            const parentKey = pathKey(prefix.slice(0, -1));
            const parentId = parentKey ? groupsByPath.get(parentKey)?.id : null;
            const [attr, value] = prefix[prefix.length - 1];
            const groupId = tasksSlug(['custom', ...prefix.map(([partAttr, part]) => `${partAttr}-${part}`)].join('__'));
            const group = {
                id: groupId,
                label: tasksNodeMetaLabel(attr) + ' ›› ' + value,
                parent_group_id: parentId,
                __projection_group__: true,
                projection: '__custom_group_by__',
                [attr]: value,
            };
            groups.push(group);
            groupsByPath.set(key, group);
            const parentTreeKey = parentId === null ? 'null' : parentId;
            if (!groupTree[parentTreeKey]) groupTree[parentTreeKey] = [];
            groupTree[parentTreeKey].push(groupId);
        }
        const leaf = groupsByPath.get(pathKey(path));
        const taskCopy = { ...task, group_id: leaf?.id || null };
        tasks.push(taskCopy);
        const childKey = taskCopy.group_id === null ? 'null' : taskCopy.group_id;
        if (!taskChildren[childKey]) taskChildren[childKey] = [];
        taskChildren[childKey].push(taskCopy.id);
    }
    const visibleTaskIds = new Set(tasks.map((task) => task.id));
    const model = {
        ...groupingSource,
        graph_id: `${groupingSource.graph_id || 'tasks'}-custom-group-by`,
        groups,
        tasks,
        dependency_edges: (groupingSource.dependency_edges || []).filter((edge) => visibleTaskIds.has(edge.source) && visibleTaskIds.has(edge.target)),
        group_tree: groupTree,
        task_children: taskChildren,
        document_order: [...groups.map((group) => group.id), ...tasks.map((task) => task.id)],
        active_projection: '__custom_group_by__',
        default_color_by: sourceModel.default_color_by || attrs[0] || '',
        default_open_depth: -1,
    };
    delete model.projection_models;
    delete model.view_projections;
    const graph = buildTasksCollapsedGraph(model);
    logTasksPerf('kg-projection', {
        kind: 'custom-group-by',
        sourceGraphId: sourceModel?.graph_id || '',
        attrs,
        sourceGroups: (sourceModel?.groups || []).length,
        sourceTasks: (sourceModel?.tasks || []).length,
        sourceEdges: (sourceModel?.dependency_edges || []).length,
        groups: groups.length,
        tasks: tasks.length,
        edges: (model.dependency_edges || []).length,
        collapsedNodes: (graph.nodes || []).length,
        collapsedEdges: (graph.edges || []).length,
        defaultOpenDepth: model.default_open_depth,
    });
    return { model, graph, projectionId: '__custom_group_by__' };
}

function buildTasksUngroupedState(sourceModel) {
    const model = tasksUngroupModelForGrouping(sourceModel);
    delete model.projection_models;
    delete model.view_projections;
    return { model, graph: buildTasksCollapsedGraph(model) };
}

function buildTasksEgoState(sourceModel, sourceGraph, selectedIds, includeNeighbors = false, colorBy = '') {
    const selected = new Set(Array.from(selectedIds || []).map((id) => String(id || '').trim()).filter(Boolean));
    if (!selected.size) return null;
    const groupsById = Object.fromEntries((sourceModel.groups || []).map((group) => [group.id, group]));
    const tasksById = Object.fromEntries((sourceModel.tasks || []).map((task) => [task.id, task]));
    const visible = new Set(selected);
    if (includeNeighbors) {
        for (const edge of sourceModel.dependency_edges || []) {
            if (selected.has(edge.source)) visible.add(edge.target);
            if (selected.has(edge.target)) visible.add(edge.source);
        }
    }
    const directSelected = new Set(selected);
    const addDescendants = (groupId) => {
        for (const childGroupId of sourceModel.group_tree?.[groupId] || []) {
            visible.add(childGroupId);
            addDescendants(childGroupId);
        }
        for (const taskId of sourceModel.task_children?.[groupId] || []) visible.add(taskId);
    };
    for (const id of Array.from(visible)) {
        if (groupsById[id]) addDescendants(id);
    }
    const addAncestors = (id) => {
        let parentId = tasksById[id]?.group_id ?? groupsById[id]?.parent_group_id ?? null;
        while (parentId) {
            if (visible.has(parentId)) break;
            visible.add(parentId);
            parentId = groupsById[parentId]?.parent_group_id ?? null;
        }
    };
    for (const id of Array.from(visible)) addAncestors(id);
    const groups = (sourceModel.groups || []).filter((group) => visible.has(group.id));
    const tasks = (sourceModel.tasks || []).filter((task) => visible.has(task.id));
    const visibleNodeIds = new Set([...groups.map((group) => group.id), ...tasks.map((task) => task.id)]);
    const groupTree = {};
    for (const group of groups) {
        const parentKey = group.parent_group_id && visibleNodeIds.has(group.parent_group_id) ? group.parent_group_id : 'null';
        if (!groupTree[parentKey]) groupTree[parentKey] = [];
        groupTree[parentKey].push(group.id);
    }
    if (!groupTree.null) groupTree.null = [];
    const taskChildren = {};
    for (const task of tasks) {
        const parentKey = task.group_id && visibleNodeIds.has(task.group_id) ? task.group_id : 'null';
        if (!taskChildren[parentKey]) taskChildren[parentKey] = [];
        taskChildren[parentKey].push(task.id);
    }
    const dependencyEdges = (sourceModel.dependency_edges || []).filter((edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target));
    const model = {
        ...sourceModel,
        graph_id: `${sourceModel.graph_id || 'tasks'}-ego`,
        groups,
        tasks,
        dependency_edges: dependencyEdges,
        group_tree: groupTree,
        task_children: taskChildren,
        document_order: (sourceModel.document_order || []).filter((id) => visibleNodeIds.has(id)),
        default_open_depth: -1,
        default_color_by: String(colorBy || '').trim() || sourceModel.default_color_by || '',
        ego_selected_ids: Array.from(directSelected).filter((id) => visibleNodeIds.has(id)),
        ego_include_neighbors: includeNeighbors,
    };
    delete model.projection_models;
    delete model.view_projections;
    delete model.slides;
    const graph = {
        nodes: (sourceGraph.nodes || []).filter((node) => visibleNodeIds.has(node.id)),
        edges: (sourceGraph.edges || []).filter((edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)),
    };
    return { model, graph };
}

function isTasksGradientPalette(palette) {
    return Boolean(
        palette
        && typeof palette === 'object'
        && String(palette.type || '').trim() === 'continuous'
        && Array.isArray(palette.stops)
        && palette.stops.length >= 2
    );
}

function normalizeTasksGradientStops(palette) {
    if (!isTasksGradientPalette(palette)) return [];
    return palette.stops
        .map((stop) => ({
            at: Number(stop?.at),
            color: typeof stop?.color === 'string' ? stop.color.trim() : '',
            label: typeof stop?.label === 'string' ? stop.label.trim() : '',
        }))
        .filter((stop) => Number.isFinite(stop.at) && stop.color)
        .sort((a, b) => a.at - b.at);
}

function tasksGradientDomain(palette, stops) {
    const rawDomain = Array.isArray(palette?.domain) ? palette.domain : [];
    const start = Number(rawDomain[0]);
    const end = Number(rawDomain[1]);
    if (Number.isFinite(start) && Number.isFinite(end) && end !== start) return { start, end };
    if (stops.length >= 2) return { start: stops[0].at, end: stops[stops.length - 1].at };
    return null;
}

function normalizeTasksGradientValue(value, domain, wrap) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue) || !domain) return null;
    const span = domain.end - domain.start;
    if (!Number.isFinite(span) || span === 0) return null;
    if (!wrap) return Math.min(domain.end, Math.max(domain.start, numericValue));
    const offset = ((numericValue - domain.start) % span + span) % span;
    return domain.start + offset;
}

function parseTasksHexColor(color) {
    let value = String(color || '').trim().replace(/^#/, '');
    if (/^[0-9a-f]{3}$/i.test(value)) value = value.split('').map((part) => part + part).join('');
    if (!/^[0-9a-f]{6}$/i.test(value)) return null;
    return {
        r: Number.parseInt(value.slice(0, 2), 16),
        g: Number.parseInt(value.slice(2, 4), 16),
        b: Number.parseInt(value.slice(4, 6), 16),
    };
}

function parseTasksRgbColor(color) {
    const match = String(color || '').trim().match(/^rgba?\(\s*([\d.]+)(?:\s*,\s*|\s+)([\d.]+)(?:\s*,\s*|\s+)([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/i);
    if (!match) return null;
    const alphaText = match[4] || '';
    const alpha = alphaText.endsWith('%') ? Number.parseFloat(alphaText) / 100 : Number.parseFloat(alphaText || '1');
    if (Number.isFinite(alpha) && alpha < 1) return null;
    return {
        r: Math.max(0, Math.min(255, Math.round(Number.parseFloat(match[1])))),
        g: Math.max(0, Math.min(255, Math.round(Number.parseFloat(match[2])))),
        b: Math.max(0, Math.min(255, Math.round(Number.parseFloat(match[3])))),
    };
}

function parseTasksDisplayColor(color) {
    return parseTasksHexColor(color) || parseTasksRgbColor(color);
}

function tasksRgbToHex({ r, g, b }) {
    return `#${[r, g, b].map((part) => Math.max(0, Math.min(255, Math.round(part))).toString(16).padStart(2, '0')).join('')}`;
}

function tasksSrgbToLinear(part) {
    const value = Math.max(0, Math.min(1, part / 255));
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function tasksLinearToSrgb(part) {
    const value = Math.max(0, Math.min(1, part));
    return Math.round(255 * (value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055));
}

function tasksRgbToOklab({ r, g, b }) {
    const lr = tasksSrgbToLinear(r);
    const lg = tasksSrgbToLinear(g);
    const lb = tasksSrgbToLinear(b);
    const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
    const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
    const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
    return {
        L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
        a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
        b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
    };
}

function tasksOklabToRgb({ L, a, b }) {
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
    return {
        r: tasksLinearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
        g: tasksLinearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
        b: tasksLinearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
    };
}

function tasksRelativeLuminance(rgb) {
    return 0.2126 * tasksSrgbToLinear(rgb.r) + 0.7152 * tasksSrgbToLinear(rgb.g) + 0.0722 * tasksSrgbToLinear(rgb.b);
}

function tasksContrastRatio(a, b) {
    const l1 = tasksRelativeLuminance(a);
    const l2 = tasksRelativeLuminance(b);
    const light = Math.max(l1, l2);
    const dark = Math.min(l1, l2);
    return (light + 0.05) / (dark + 0.05);
}

function interpolateTasksHexColor(startColor, endColor, ratio) {
    const start = parseTasksHexColor(startColor);
    const end = parseTasksHexColor(endColor);
    if (!start || !end) return '';
    const mix = (from, to) => Math.round(from + (to - from) * ratio);
    return `#${[mix(start.r, end.r), mix(start.g, end.g), mix(start.b, end.b)]
        .map((part) => part.toString(16).padStart(2, '0'))
        .join('')}`;
}

function averageTasksHexColors(colors) {
    const parsed = (colors || []).map(parseTasksHexColor).filter(Boolean);
    if (!parsed.length) return '';
    const linear = (part) => {
        const value = part / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    };
    const labs = parsed.map(({ r, g, b }) => {
        const [lr, lg, lb] = [linear(r), linear(g), linear(b)];
        const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
        const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
        const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
        return {
            L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
            a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
            b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
        };
    });
    const average = (key) => labs.reduce((sum, color) => sum + color[key], 0) / labs.length;
    const L = average('L');
    const a = average('a');
    const b = average('b');
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
    const encode = (value) => {
        const bounded = Math.max(0, Math.min(1, value));
        const encoded = bounded <= 0.0031308 ? 12.92 * bounded : 1.055 * bounded ** (1 / 2.4) - 0.055;
        return Math.round(encoded * 255);
    };
    const rgb = [
        encode(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
        encode(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
        encode(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
    ];
    return `#${rgb.map((part) => part.toString(16).padStart(2, '0')).join('')}`;
}

function parseTasksNumericValue(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const text = String(value ?? '').trim();
    if (!/^-?\d+(?:\.\d+)?$/.test(text)) return null;
    const parsed = Number(text);
    return Number.isFinite(parsed) ? parsed : null;
}

function isTasksCssColor(value) {
    const text = String(value || '').trim();
    if (!text) return false;
    if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(text)) return true;
    if (/^(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color|color-mix)\(/i.test(text)) return true;
    if (/^(?:transparent|currentColor|inherit)$/i.test(text)) return true;
    if (/^var\(--[\w-]+\)$/i.test(text)) return true;
    return typeof CSS !== 'undefined' && typeof CSS.supports === 'function' ? CSS.supports('color', text) : false;
}

function formatTasksMetricValue(value) {
    if (!Number.isFinite(value)) return '';
    if (Math.abs(value - Math.round(value)) < 0.001) return Math.round(value).toLocaleString('en-US');
    return value.toFixed(2).replace(/\.?0+$/, '');
}

function resolveTasksGradientColor(palette, value) {
    const stops = normalizeTasksGradientStops(palette);
    if (stops.length < 2) return '';
    const domain = tasksGradientDomain(palette, stops);
    const normalized = normalizeTasksGradientValue(value, domain, Boolean(palette?.wrap));
    if (normalized === null) return '';
    if (normalized <= stops[0].at) return tasksDisplayPaletteColor(stops[0].color);
    for (let index = 1; index < stops.length; index += 1) {
        const prev = stops[index - 1];
        const current = stops[index];
        if (normalized > current.at) continue;
        const span = current.at - prev.at;
        if (!Number.isFinite(span) || span <= 0) return tasksDisplayPaletteColor(current.color);
        return tasksDisplayPaletteColor(interpolateTasksHexColor(prev.color, current.color, (normalized - prev.at) / span) || current.color);
    }
    return tasksDisplayPaletteColor(stops[stops.length - 1].color);
}

function tasksColorPaletteFor(model, colorBy) {
    const key = String(colorBy || '').trim();
    if (!key) return {};
    if (key === TASKS_HAS_NOTE_ATTR) return TASKS_HAS_NOTE_PALETTE;
    const palettes = model?.node_color_palettes && typeof model.node_color_palettes === 'object'
        ? model.node_color_palettes
        : {};
    const configuredPalette = palettes[key];
    if (configuredPalette && Object.keys(configuredPalette).length > 0) return configuredPalette;
    const legacyKey = String(model?.color_by || '').trim();
    const legacyPalette = model?.color_palette && typeof model.color_palette === 'object' ? model.color_palette : {};
    if (key === legacyKey && Object.keys(legacyPalette).length > 0) return legacyPalette;
    return {};
}

function tasksColorPaletteEntries(model, colorBy, nodeNotes = null) {
    const key = String(colorBy || '').trim();
    if (!key) return [];
    const palette = tasksColorPaletteFor(model, colorBy);
    if (isTasksGradientPalette(palette)) return [];
    if (key === TASKS_HAS_NOTE_ATTR) return tasksHasAnyNodeNote(nodeNotes) ? Object.entries(palette) : [];
    const presentValues = new Set(
        [...(model?.groups || []), ...(model?.tasks || [])]
            .flatMap((node) => tasksAttrValues(node?.[key]))
    );
    return Object.entries(palette)
        .filter(([value]) => presentValues.has(String(value)))
        .filter(([, color]) => typeof color === 'string' && color.trim())
        .sort(([a], [b]) => String(a).localeCompare(String(b)));
}

function tasksEdgeColorPaletteFor(model, colorBy) {
    const key = String(colorBy || '').trim();
    if (!key) return {};
    const palettes = model?.edge_color_palettes && typeof model.edge_color_palettes === 'object' ? model.edge_color_palettes : {};
    const configuredPalette = palettes[key];
    if (configuredPalette && Object.keys(configuredPalette).length > 0) return configuredPalette;
    const legacyKey = String(model?.edge_color_by || '').trim();
    const legacyPalette = model?.edge_color_palette && typeof model.edge_color_palette === 'object' ? model.edge_color_palette : {};
    if (key === legacyKey && Object.keys(legacyPalette).length > 0) return legacyPalette;
    return {};
}

function resolveTasksEdgeLabel(edge, model, activeProjection = null) {
    if (!edge) return '';
    // 1. Inline pipe label (also serves as kind name) wins.
    const rawLabel = typeof edge.label === 'string' ? edge.label.trim() : '';
    if (rawLabel) return rawLabel;
    // 2. Projection-requested attr.
    const projectionAttr = activeProjection && typeof activeProjection.edge_label_from === 'string'
        ? activeProjection.edge_label_from.trim() : '';
    // 3. Top-level default attr.
    const defaultAttr = typeof model?.edge_label_from === 'string' ? model.edge_label_from.trim() : '';
    const requestedAttr = projectionAttr || defaultAttr;
    if (requestedAttr) {
        const values = tasksAttrValues(edge[requestedAttr]);
        if (values.length) return values.join(', ');
    }
    // 4. Empty — user said this is fine.
    return '';
}

function resolveTasksEdgeColor(edge, model, colorByOverride = null, paletteOverride = null) {
    if (!edge) return '';
    if (typeof edge.color === 'string' && edge.color.trim()) {
        const inlineColor = edge.color.trim();
        if (isTasksCssColor(inlineColor)) return inlineColor;
        logTasksDebugVerbose('edgeColorIgnored', {
            label: String(edge.label || ''),
            inlineColor,
            reason: 'not-css-color',
        });
    }
    const colorBy = colorByOverride !== null
        ? String(colorByOverride || '').trim()
        : (typeof model?.edge_color_by === 'string' ? model.edge_color_by.trim() : '');
    if (!colorBy) return '';
    const palette = paletteOverride && typeof paletteOverride === 'object'
        ? paletteOverride
        : tasksEdgeColorPaletteFor(model, colorBy);
    const values = tasksAttrValues(edge[colorBy]);
    const paletteKeys = values.length ? values : tasksAttrValues(edge.label);
    const colors = paletteKeys.map((value) => palette[value]).filter((color) => typeof color === 'string' && color.trim());
    return tasksDisplayPaletteColor(averageTasksHexColors(colors) || colors[0]?.trim() || '');
}

function tasksGroupIdsContainingSelection(model, selectedIds) {
    const selected = selectedIds instanceof Set ? selectedIds : new Set(selectedIds || []);
    if (!selected.size) return new Set();
    const containers = new Set();
    for (const group of (model?.groups || [])) {
        const descendantIds = collectTasksGroupDescendantIds(group.id, model);
        for (const selectedId of selected) {
            if (selectedId === group.id || descendantIds.has(selectedId)) {
                containers.add(group.id);
                break;
            }
        }
    }
    return containers;
}

function resolveTasksProjectionGroupOwnColor(node, model, colorByOverride = null, paletteOverride = null) {
    if (!node || !node.__projection_group__) return '';
    const colorBy = colorByOverride !== null
        ? String(colorByOverride || '').trim()
        : (typeof model?.color_by === 'string' ? model.color_by.trim() : '');
    if (!colorBy) return '';
    const palette = paletteOverride && typeof paletteOverride === 'object'
        ? paletteOverride
        : tasksColorPaletteFor(model, colorBy);
    const value = node[colorBy];
    if (value === null || value === undefined || String(value).trim() === '') return '';
    if (isTasksGradientPalette(palette)) return resolveTasksGradientColor(palette, value);
    const color = palette[String(value)];
    return typeof color === 'string' && color.trim() ? tasksDisplayPaletteColor(color.trim()) : '';
}

function resolveTasksProjectionGroupDimensionColor(node, model) {
    if (!node || !node.__projection_group__) return '';
    const palettes = model?.node_color_palettes;
    if (!palettes || typeof palettes !== 'object') return '';
    const reserved = new Set(['id', 'label', 'parent_group_id', 'projection', '__projection_group__', 'href', 'color']);
    for (const [key, value] of Object.entries(node)) {
        if (reserved.has(key)) continue;
        if (value === null || value === undefined || String(value).trim() === '') continue;
        const palette = tasksColorPaletteFor(model, key);
        if (!palette || typeof palette !== 'object') continue;
        if (isTasksGradientPalette(palette)) {
            const color = resolveTasksGradientColor(palette, value);
            if (color) return color;
            continue;
        }
        const color = palette[String(value)];
        if (typeof color === 'string' && color.trim()) return tasksDisplayPaletteColor(color.trim());
    }
    return '';
}

function resolveTasksNodeOwnColor(node, model, colorByOverride = null, paletteOverride = null) {
    if (!node) return '';
    const projectionColor = resolveTasksProjectionGroupOwnColor(node, model, colorByOverride, paletteOverride);
    if (projectionColor) return projectionColor;
    const colorBy = colorByOverride !== null
        ? String(colorByOverride || '').trim()
        : (typeof model?.color_by === 'string' ? model.color_by.trim() : '');
    const palette = paletteOverride && typeof paletteOverride === 'object'
        ? paletteOverride
        : tasksColorPaletteFor(model, colorBy);
    if (colorBy) {
        if (colorBy === TASKS_HAS_NOTE_ATTR) {
            const value = node?.__has_note__ ? 'yes' : 'no';
            return tasksDisplayPaletteColor(TASKS_HAS_NOTE_PALETTE[value] || '');
        }
        const values = tasksAttrValues(node[colorBy]);
        if (values.length) {
            if (isTasksGradientPalette(palette)) {
                const numeric = values.map(parseTasksNumericValue).filter((value) => value !== null);
                return numeric.length ? resolveTasksGradientColor(palette, numeric.reduce((sum, value) => sum + value, 0) / numeric.length) : '';
            }
            const colors = values.map((value) => palette[value]).filter((color) => typeof color === 'string' && color.trim());
            return tasksDisplayPaletteColor(averageTasksHexColors(colors) || colors[0]?.trim() || '');
        }
        return '';
    }
    if (typeof node.color === 'string' && node.color.trim()) return tasksDisplayPaletteColor(node.color.trim());
    return '';
}

function resolveTasksNodeColor(node, model, colorByOverride = null, paletteOverride = null) {
    const ownColor = resolveTasksNodeOwnColor(node, model, colorByOverride, paletteOverride);
    if (ownColor) return ownColor;
    if (!node || !model) return '';
    const groupsById = Object.fromEntries((model.groups || []).map((group) => [group.id, group]));
    let parentId = node.parent_group_id || node.group_id || null;
    while (parentId) {
        const parent = groupsById[parentId];
        if (!parent) return '';
        const parentColor = resolveTasksNodeOwnColor(parent, model, colorByOverride, paletteOverride);
        if (parentColor) return parentColor;
        parentId = parent.parent_group_id || null;
    }
    return '';
}

function resolveTasksCollapsedGroupColor(node, model, colorByOverride = null, paletteOverride = null) {
    if (!node || node.__kind__ !== 'group') return '';
    const colorBy = colorByOverride !== null
        ? String(colorByOverride || '').trim()
        : (typeof model?.color_by === 'string' ? model.color_by.trim() : '');
    if (!colorBy) return '';
    const palette = paletteOverride && typeof paletteOverride === 'object'
        ? paletteOverride
        : tasksColorPaletteFor(model, colorBy);
    const descendants = collectTasksGroupDescendants(node.id, model);
    const colorSources = descendants.tasks.length ? descendants.tasks : descendants.groups;
    if (!colorSources.length) return '';
    if (isTasksGradientPalette(palette)) {
        const values = colorSources.map((entry) => parseTasksNumericValue(entry?.[colorBy])).filter((value) => value !== null);
        if (values.length) {
            const average = values.reduce((sum, value) => sum + value, 0) / values.length;
            return resolveTasksGradientColor(palette, average);
        }
    }
    return averageTasksHexColors(
        colorSources
            .map((entry) => resolveTasksNodeOwnColor(entry, model, colorBy, palette))
            .filter(Boolean)
    );
}

function tasksResolvedThemeColor(varName, fallback) {
    if (typeof window === 'undefined' || typeof window.getComputedStyle !== 'function') return fallback;
    const value = window.getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    return value || fallback;
}

function tasksIsDarkMode() {
    return typeof document !== 'undefined' && document.documentElement?.classList?.contains('dark');
}

function tasksChromaCappedOklab(lab) {
    const chroma = Math.hypot(lab.a, lab.b);
    if (!chroma || chroma <= TASKS_DARK_PALETTE_MAX_CHROMA) return lab;
    const scale = TASKS_DARK_PALETTE_MAX_CHROMA / chroma;
    return { ...lab, a: lab.a * scale, b: lab.b * scale };
}

function tasksDisplayPaletteColor(color) {
    const raw = String(color || '').trim();
    if (!raw || !tasksIsDarkMode()) return raw;
    const paperColor = tasksResolvedThemeColor('--vyasa-paper', '#0f172a');
    const cacheKey = `${paperColor}|${raw}`;
    if (tasksDisplayPaletteColorCache.has(cacheKey)) return tasksDisplayPaletteColorCache.get(cacheKey);
    const rgb = parseTasksDisplayColor(raw);
    const paper = parseTasksDisplayColor(paperColor) || parseTasksHexColor('#0f172a');
    if (!rgb || !paper) {
        tasksDisplayPaletteColorCache.set(cacheKey, raw);
        return raw;
    }
    const lab = tasksChromaCappedOklab(tasksRgbToOklab(rgb));
    if (lab.L >= TASKS_DARK_PALETTE_MIN_L && tasksContrastRatio(rgb, paper) >= TASKS_DARK_PALETTE_CONTRAST) {
        tasksDisplayPaletteColorCache.set(cacheKey, raw);
        return raw;
    }
    let best = tasksOklabToRgb({ ...lab, L: Math.max(lab.L, TASKS_DARK_PALETTE_MIN_L) });
    for (let L = Math.max(lab.L, TASKS_DARK_PALETTE_MIN_L); L <= TASKS_DARK_PALETTE_MAX_L; L += 0.015) {
        const candidate = tasksOklabToRgb({ ...lab, L });
        best = candidate;
        if (tasksContrastRatio(candidate, paper) >= TASKS_DARK_PALETTE_CONTRAST) break;
    }
    const adjusted = tasksRgbToHex(best);
    tasksDisplayPaletteColorCache.set(cacheKey, adjusted);
    return adjusted;
}

function tasksMixedFill(color, colorMix) {
    if (!color) return '';
    const displayColor = tasksDisplayPaletteColor(color);
    return colorMix && colorMix.enabled
        ? `color-mix(in srgb, var(--vyasa-paper) ${colorMix.paper}%, ${displayColor} ${colorMix.intensity}%)`
        : displayColor;
}

function tasksCompositeSweep(node, colorBy, palette, primaryColor = '', options = {}, colorMix = {}) {
    const values = tasksAttrValues(node?.[colorBy]);
    const colors = Array.from(new Set(values
        .map((value) => palette?.[value])
        .filter((color) => typeof color === 'string' && color.trim())
        .map((color) => tasksMixedFill(color.trim(), colorMix))));
    if (colors.length <= 1) return colors[0] || tasksMixedFill(primaryColor, colorMix) || '';
    const stops = colors.map((color, index) => `${color} ${Math.round((index / colors.length) * 100)}%`);
    stops.push(`${colors[0]} 100%`);
    return `linear-gradient(90deg, ${stops.join(', ')})`;
}

function tasksNodeBackground(primaryColor, secondaryColor, colorMix, fallback, composite = false) {
    const primary = tasksMixedFill(primaryColor, colorMix);
    const secondary = tasksMixedFill(secondaryColor, colorMix);
    let fill = primary || fallback;
    if (primary && secondary && primaryColor !== secondaryColor) {
        fill = `linear-gradient(135deg, ${primary} 0 50%, ${secondary} 50% 100%)`;
    }
    return fill;
}

function tasksGroupBackground(primaryColor, secondaryColor, fallback, options = {}) {
    const mode = options?.mode === 'transparent' ? 'transparent' : 'paper';
    const rawIntensity = Number.parseFloat(options?.intensity);
    const intensity = Math.max(0, Math.min(100, Number.isFinite(rawIntensity) ? rawIntensity : (mode === 'transparent' ? 10 : 12)));
    const mix = (color) => {
        if (!color) return '';
        return mode === 'transparent'
            ? `color-mix(in srgb, ${color} ${intensity}%, transparent)`
            : `color-mix(in srgb, var(--vyasa-paper) ${100 - intensity}%, ${color} ${intensity}%)`;
    };
    const primary = mix(primaryColor);
    const secondary = mix(secondaryColor);
    if (primary && secondary && primaryColor !== secondaryColor) {
        return `linear-gradient(135deg, ${primary} 0 50%, ${secondary} 50% 100%)`;
    }
    return primary || fallback;
}

// Clip a convex polygon to the half-plane { (x,y): a*x + b*y <= c } (Sutherland-Hodgman).
function tasksClipPolygon(poly, a, b, c) {
    const out = [];
    const n = poly.length;
    for (let i = 0; i < n; i++) {
        const cur = poly[i];
        const prev = poly[(i + n - 1) % n];
        const dCur = a * cur[0] + b * cur[1] - c;
        const dPrev = a * prev[0] + b * prev[1] - c;
        const curIn = dCur <= 1e-9;
        const prevIn = dPrev <= 1e-9;
        if (curIn !== prevIn) {
            const t = dPrev / (dPrev - dCur);
            out.push([prev[0] + t * (cur[0] - prev[0]), prev[1] + t * (cur[1] - prev[1])]);
        }
        if (curIn) out.push(cur);
    }
    return out;
}

// levels: array (one per color level) of arrays of color strings.
// Returns polygons: each level is a 45deg diagonal band, split into horizontal strips per value.
function tasksColorLevelPolygons(levels, width = 100, height = 100) {
    const active = (levels || []).filter((colors) => Array.isArray(colors) && colors.some(Boolean));
    const n = active.length;
    if (!n) return [];
    const w = Math.max(1, Number(width) || 100);
    const h = Math.max(1, Number(height) || 100);
    const rect = [[0, 0], [w, 0], [w, h], [0, h]];
    const out = [];
    active.forEach((colorsRaw, i) => {
        const colors = colorsRaw.filter(Boolean);
        let band = tasksClipPolygon(rect, 1, 1, ((w + h) * (i + 1)) / n);
        band = tasksClipPolygon(band, -1, -1, -((w + h) * i) / n);
        if (band.length < 3) return;
        const m = colors.length;
        colors.forEach((color, j) => {
            let strip = tasksClipPolygon(band, 0, 1, (h * (j + 1)) / m);
            strip = tasksClipPolygon(strip, 0, -1, -(h * j) / m);
            if (strip.length >= 3) out.push({ color, points: strip });
        });
    });
    return out;
}

function tasksColorLevelFromNode(node, model, spec, colorMix) {
    if (!spec || !spec.colorBy) return [];
    const values = tasksAttrValues(node?.[spec.colorBy]);
    const colors = values
        .map((value) => spec.palette?.[value])
        .filter((color) => typeof color === 'string' && color.trim());
    if (!colors.length) {
        const resolved = resolveTasksNodeColor(node, model, spec.colorBy, spec.palette);
        if (resolved) colors.push(resolved);
    }
    return Array.from(new Set(colors.map((color) => tasksMixedFill(color, colorMix))));
}

function tasksColorLevelFromCollapsedGroup(node, model, spec, colorMix, colorSources) {
    if (!spec || !spec.colorBy || !node || node.__kind__ !== 'group') return [];
    if (isTasksGradientPalette(spec.palette)) {
        const resolved = resolveTasksCollapsedGroupColor(node, model, spec.colorBy, spec.palette);
        return resolved ? [tasksMixedFill(resolved, colorMix)] : [];
    }
    const colors = (colorSources || [])
        .flatMap((entry) => tasksAttrValues(entry?.[spec.colorBy]).map((value) => spec.palette?.[value]))
        .filter((color) => typeof color === 'string' && color.trim());
    return Array.from(new Set(colors.map((color) => tasksMixedFill(color, colorMix))));
}

function tasksNodeColorLevels(node, model, levelSpecs, colorMix, options = {}) {
    if (options.collapsedGroup) {
        // Walk the group's descendant tree once, then map every color level over the cached set.
        const descendants = (node && node.__kind__ === 'group')
            ? collectTasksGroupDescendants(node.id, model)
            : { tasks: [], groups: [] };
        const colorSources = descendants.tasks.length ? descendants.tasks : descendants.groups;
        return (levelSpecs || []).map((spec) => tasksColorLevelFromCollapsedGroup(node, model, spec, colorMix, colorSources));
    }
    return (levelSpecs || []).map((spec) => tasksColorLevelFromNode(node, model, spec, colorMix));
}

function tasksUseColorOverlay(levels) {
    return (levels || []).reduce((sum, level) => sum + (Array.isArray(level) ? level.length : 0), 0) >= 2;
}

// Single seam for "is this built node drawn with the SVG color overlay?".
function tasksNodeIsOverlaid(node) {
    const levels = node?.data?.__color_levels__;
    return Boolean(levels && levels.length);
}

function tasksHoverFocusNodeStyle(node, nodeColor, displayColor, activeBorderColor, checkedShadow, colorMix, primary) {
    const baseZIndex = Number.isFinite(Number(node.zIndex)) ? Number(node.zIndex) : Number(node.style?.zIndex || 0);
    const zIndex = baseZIndex + (primary ? TASKS_SELECTED_Z_BOOST : TASKS_NEIGHBOR_Z_BOOST);
    return {
        zIndex,
        opacity: 1,
        '--vyasa-tasks-active-border': activeBorderColor,
        background: tasksNodeIsOverlaid(node)
            ? node.style.background
            : (node.data?.__kind__ === 'group'
                ? tasksGroupBackground(displayColor, '', TASKS_GROUP_BG_ACTIVE, { mode: 'transparent', intensity: primary ? 12 : 8 })
                : tasksNodeBackground(nodeColor, '', colorMix, TASKS_NODE_BG_ACTIVE, false)),
        boxShadow: `${checkedShadow !== 'none' ? `${checkedShadow}, ` : ''}0 0 0 ${primary ? 3 : 2}px color-mix(in srgb, ${displayColor} ${primary ? 76 : 68}%, transparent), 0 0 ${primary ? 24 : 32}px ${primary ? 6 : 8}px color-mix(in srgb, ${displayColor} ${primary ? 48 : 46}%, transparent)`,
    };
}

function tasksHoverFocusEdge(edge, hoveredNodeId) {
    const edgeColor = edge.data?.edgeColor || edge.style?.stroke || 'currentColor';
    const branchOpacity = edge.data?.__projection_branch_opacity__ ?? 1;
    const strokeMode = edge.source === hoveredNodeId ? 'selected-out' : 'selected-in';
    return {
        ...edge,
        zIndex: TASKS_EDGE_FOCUS_Z,
        data: { ...edge.data, highlightMode: 'selected', strokeMode, flareKey: `hover:${hoveredNodeId || ''}` },
        labelStyle: { ...(edge.labelStyle || {}), fill: edgeColor, opacity: tasksProminentEdgeOpacity() * branchOpacity, fontWeight: 800 },
        labelBgStyle: { ...(edge.labelBgStyle || {}), fill: TASKS_EDGE_LABEL_BG, fillOpacity: 0.9 },
        style: { ...edge.style, stroke: edgeColor, opacity: tasksProminentEdgeOpacity() * branchOpacity, strokeWidth: Math.max(4.75, tasksEdgeStrokeWidthForMode(strokeMode)), strokeLinecap: 'round' },
    };
}

function tasksEdgeRecordId(edge) {
    return String(edge?.__source_edge_id || edge?.id || '').trim();
}

// Build an inset SVG overlay element drawing the diagonal-band / horizontal-strip fill.
function tasksColorOverlay(React, levels, width, height) {
    const w = Math.max(1, Number(width) || 100);
    const h = Math.max(1, Number(height) || 100);
    const polys = tasksColorLevelPolygons(levels, w, h);
    if (!polys.length) return null;
    return React.createElement('svg', {
        viewBox: `0 0 ${w} ${h}`,
        preserveAspectRatio: 'none',
        style: { position: 'absolute', inset: 0, width: '100%', height: '100%', borderRadius: 'inherit', pointerEvents: 'none', zIndex: 0 },
    }, ...polys.map((p, idx) => React.createElement('polygon', {
        key: idx,
        points: p.points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' '),
        fill: p.color,
    })));
}

window.runTasksHeaderAction = function(widgetId, action) {
    const actions = window.__vyasaTasksActions?.[widgetId];
    if (!actions || typeof actions[action] !== 'function') return;
    actions[action]();
};

function syncTasksEdgeToggleButtons(widgetId, edgesVisible) {
    const id = String(widgetId || '');
    document.querySelectorAll('button[data-vyasa-tasks-action="toggleEdges"], button[onclick*="toggleEdges"]').forEach((button) => {
        const buttonWidgetId = button.getAttribute('data-vyasa-tasks-widget-id') || '';
        const onclick = button.getAttribute('onclick') || '';
        if (buttonWidgetId && buttonWidgetId !== id) return;
        if (!buttonWidgetId && !onclick.includes(`'${id}'`)) return;
        button.setAttribute('data-vyasa-tasks-widget-id', id);
        button.setAttribute('data-vyasa-tasks-action', 'toggleEdges');
        if (edgesVisible) {
            button.removeAttribute('data-vyasa-edges-off');
            button.title = 'Toggle edges';
        } else {
            button.setAttribute('data-vyasa-edges-off', 'true');
            button.title = 'Edges are hidden (E)';
        }
    });
}

function syncTasksHoverCardToggleButtons(widgetId, hoverCardsEnabled) {
    const id = String(widgetId || '');
    document.querySelectorAll('button[data-vyasa-tasks-action="toggleHoverCards"], button[onclick*="toggleHoverCards"]').forEach((button) => {
        const buttonWidgetId = button.getAttribute('data-vyasa-tasks-widget-id') || '';
        const onclick = button.getAttribute('onclick') || '';
        if (buttonWidgetId && buttonWidgetId !== id) return;
        if (!buttonWidgetId && !onclick.includes(`'${id}'`)) return;
        button.setAttribute('data-vyasa-tasks-widget-id', id);
        button.setAttribute('data-vyasa-tasks-action', 'toggleHoverCards');
        if (hoverCardsEnabled) {
            button.removeAttribute('data-vyasa-hover-cards-off');
            button.title = 'Toggle hover cards';
        } else {
            button.setAttribute('data-vyasa-hover-cards-off', 'true');
            button.title = 'Hover cards are hidden (H)';
        }
    });
}

function buildVisibleTasksGraph(model, expanded) {
    const groupsById = Object.fromEntries((model.groups || []).map((g) => [g.id, g]));
    const tasksById = Object.fromEntries((model.tasks || []).map((t) => [t.id, t]));
    const visibleGroups = new Set(model.group_tree?.["null"] || []);
    const visibleTasks = new Set(model.task_children?.["null"] || []);
    for (const nodeId of expanded) {
        tasksChildGroupIds(nodeId, model).forEach((id) => visibleGroups.add(id));
        tasksChildTaskIds(nodeId, model).forEach((id) => visibleTasks.add(id));
    }
    const visibleNodes = [
        ...Array.from(visibleGroups).map((id) => {
            const source = groupsById[id] || {};
            const label = source.label || id;
            return { ...source, id, label, __kind__: 'group', ...sizeTaskNode(label, 'group', null, { hasImage: Boolean(resolveTasksNodeImage(source, model)) }) };
        }),
        ...Array.from(visibleTasks).map((id) => {
            const source = tasksById[id] || {};
            const label = source.label || id;
            return { ...source, id, label, __kind__: 'task', ...sizeTaskNode(label, 'task', null, { hasImage: Boolean(resolveTasksNodeImage(source, model)) }) };
        }),
    ];
    const parentOfGroup = Object.fromEntries((model.groups || []).map((g) => [g.id, g.parent_group_id || null]));
    const parentOfTask = Object.fromEntries((model.tasks || []).map((t) => [t.id, t.group_id || null]));
    const nextVisibleParent = (id) => {
        if (visibleGroups.has(id) || visibleTasks.has(id)) return id;
        if (parentOfTask[id] !== undefined) return parentOfTask[id] || null;
        return parentOfGroup[id] || null;
    };
    const nearestVisible = (id) => {
        if (visibleGroups.has(id) || visibleTasks.has(id)) return id;
        let cur = nextVisibleParent(id);
        while (cur) {
            if (visibleGroups.has(cur) || visibleTasks.has(cur)) return cur;
            cur = nextVisibleParent(cur);
        }
        return id;
    };
    const seen = new Set();
    const visibleEdges = [];
    for (const edge of (model.dependency_edges || [])) {
        const src = nearestVisible(edge.source);
        const dst = nearestVisible(edge.target);
        traceTasksEdge('visibleGraph', edge, {
            mapped: { source: src, target: dst },
            expanded: Array.from(expanded),
        });
        const key = `${src}->${dst}`;
        if (src !== dst && !seen.has(key)) {
            seen.add(key);
            visibleEdges.push({ ...edge, source: src, target: dst, label: edge.label || '' });
        }
    }
    return { nodes: visibleNodes, edges: visibleEdges };
}

function effectiveExpandedGroups(model, expandedSet) {
    const groupParent = Object.fromEntries((model.groups || []).map((group) => [group.id, group.parent_group_id || null]));
    const expanded = expandedSet instanceof Set ? expandedSet : new Set(expandedSet || []);
    const effective = new Set();
    for (const groupId of expanded) {
        let parentId = groupParent[groupId];
        let blocked = false;
        while (parentId) {
            if (!expanded.has(parentId)) {
                blocked = true;
                break;
            }
            parentId = groupParent[parentId] || null;
        }
        if (!blocked) effective.add(groupId);
    }
    return effective;
}

function appendProjectedEdge(edges, seen, source, target, label = '', attrs = {}) {
    if (!source || !target || source === target) return;
    const key = `${source}->${target}`;
    const existing = seen.get(key);
    if (existing) {
        if (label && !existing.labels.has(label)) {
            existing.labels.add(label);
            existing.edge.label = Array.from(existing.labels).join(', ');
            existing.edge.__edge_types__ = Array.from(existing.labels);
        }
        for (const [attrKey, attrValue] of Object.entries(attrs || {})) {
            if (existing.edge[attrKey] === undefined && attrValue !== undefined && attrValue !== '') {
                existing.edge[attrKey] = attrValue;
            }
        }
        return;
    }
    const edge = { ...attrs, source, target };
    if (label) edge.label = label;
    edge.__edge_types__ = tasksEdgeTypeValues(edge);
    edges.push(edge);
    seen.set(key, { edge, labels: new Set(label ? [label] : []) });
}

function normalizeTasksGraphNodes(graph, model) {
    const groupsById = Object.fromEntries((model.groups || []).map((g) => [g.id, g]));
    const tasksById = Object.fromEntries((model.tasks || []).map((t) => [t.id, t]));
    return {
        ...graph,
        nodes: (graph.nodes || []).map((node) => {
            const source = groupsById[node.id] || tasksById[node.id] || {};
            const { kind: _legacyNodeKind, ...nodeRest } = node;
            const kind = node.__kind__ || _legacyNodeKind || (groupsById[node.id] ? 'group' : 'task');
            const label = node.label || source.label || node.id;
            return { ...source, ...nodeRest, __kind__: kind, label, ...sizeTaskNode(label, kind, null, { hasImage: Boolean(resolveTasksNodeImage(source, model)) }) };
        }),
    };
}

function taskDurationUnits(task) {
    const raw = task?.duration ?? task?.estimate ?? task?.points ?? 1;
    const match = String(raw ?? '').match(/-?\d+(?:\.\d+)?/);
    const parsed = match ? Number.parseFloat(match[0]) : 1;
    return Math.max(1, Math.ceil(Number.isFinite(parsed) ? parsed : 1));
}

function buildGanttTasksGraph(model) {
    const tasks = model.tasks || [];
    const byId = Object.fromEntries(tasks.map((task) => [task.id, task]));
    const outgoing = new Map();
    const incomingCount = new Map(tasks.map((task) => [task.id, 0]));
    for (const edge of model.dependency_edges || []) {
        if (!byId[edge.source] || !byId[edge.target]) continue;
        if (!outgoing.has(edge.source)) outgoing.set(edge.source, []);
        outgoing.get(edge.source).push(edge.target);
        incomingCount.set(edge.target, (incomingCount.get(edge.target) || 0) + 1);
    }
    const queue = tasks.filter((task) => (incomingCount.get(task.id) || 0) === 0).map((task) => task.id);
    const ordered = [];
    while (queue.length) {
        const id = queue.shift();
        ordered.push(id);
        for (const target of outgoing.get(id) || []) {
            incomingCount.set(target, (incomingCount.get(target) || 0) - 1);
            if ((incomingCount.get(target) || 0) === 0) queue.push(target);
        }
    }
    for (const task of tasks) if (!ordered.includes(task.id)) ordered.push(task.id);
    const timing = {};
    for (const id of ordered) {
        const duration = taskDurationUnits(byId[id]);
        const predecessors = (model.dependency_edges || []).filter((edge) => edge.target === id && byId[edge.source]);
        const start = predecessors.length
            ? Math.max(...predecessors.map((edge) => (timing[edge.source]?.finish ?? taskDurationUnits(byId[edge.source]))))
            : 0;
        timing[id] = { start, duration, finish: start + duration };
    }
    const lanesByStart = new Map();
    const rows = ordered.map((id) => {
        const start = timing[id]?.start || 0;
        const lane = lanesByStart.get(start) || 0;
        lanesByStart.set(start, lane + 1);
        return { id, row: lane };
    });
    const maxRow = Math.max(0, ...rows.map((item) => item.row));
    const rowHeights = new Map();
    const nodes = rows.map(({ id, row }) => {
        const task = byId[id];
        const time = timing[id] || { start: 0, duration: 1 };
        const width = Math.max(TASKS_GANTT_UNIT_WIDTH - 52, time.duration * TASKS_GANTT_UNIT_WIDTH - 68);
        const sized = sizeTaskNode(task.label || id, 'task', width, { hasImage: Boolean(resolveTasksNodeImage(task, model)) });
        const height = Math.max(TASKS_GANTT_BAR_MIN_HEIGHT, sized.height - 18);
        rowHeights.set(row, Math.max(rowHeights.get(row) || 0, height));
        return {
            ...task,
            id,
            label: task.label || id,
            __kind__: 'task',
            __gantt: true,
            gantt_start: time.start,
            gantt_duration: time.duration,
            position: { x: TASKS_GANTT_LEFT + time.start * TASKS_GANTT_UNIT_WIDTH, y: TASKS_GANTT_TOP },
            width,
            height,
            gantt_row: row,
        };
    });
    const rowOffsets = new Map();
    let cursorY = TASKS_GANTT_TOP;
    for (let row = 0; row <= maxRow; row += 1) {
        rowOffsets.set(row, cursorY);
        cursorY += (rowHeights.get(row) || TASKS_GANTT_BAR_MIN_HEIGHT) + TASKS_GANTT_ROW_GAP;
    }
    for (const node of nodes) {
        node.position = { ...node.position, y: rowOffsets.get(node.gantt_row) || TASKS_GANTT_TOP };
    }
    const maxFinish = Math.max(1, ...Object.values(timing).map((time) => time.finish));
    for (let unit = 0; unit <= maxFinish; unit += 1) {
        nodes.push({
            id: `__gantt_unit_${unit}`,
            label: unit === 0 ? '' : String(unit),
            __kind__: 'ganttHeader',
            position: { x: TASKS_GANTT_LEFT + unit * TASKS_GANTT_UNIT_WIDTH, y: 24 },
            width: TASKS_GANTT_UNIT_WIDTH,
            height: cursorY,
        });
    }
    const edges = (model.dependency_edges || [])
        .filter((edge) => byId[edge.source] && byId[edge.target])
        .map((edge, index) => ({ ...edge, id: `gantt-${edge.source}-${edge.target}-${index}`, label: edge.label || undefined }));
    return { nodes, edges };
}

function collectExpandedGroupsByDepth(groupTree, defaultOpenDepth) {
    if (defaultOpenDepth === 0) return new Set();
    const expanded = new Set();
    const queue = (groupTree?.["null"] || []).map((id) => ({ id, depth: 1 }));
    while (queue.length > 0) {
        const { id, depth } = queue.shift();
        if (defaultOpenDepth !== -1 && depth > defaultOpenDepth) continue;
        expanded.add(id);
        for (const childId of (groupTree?.[id] || [])) queue.push({ id: childId, depth: depth + 1 });
    }
    return expanded;
}

function expandOneGroupDepth(model, expandedSet) {
    const expanded = new Set(expandedSet || []);
    const roots = Array.from(tasksExpandableNodeIds(model)).filter((id) => {
        const parentId = (model?.tasks || []).find((task) => task.id === id)?.group_id
            ?? (model?.groups || []).find((group) => group.id === id)?.parent_group_id
            ?? null;
        return !parentId;
    });
    if (expanded.size === 0) {
        roots.forEach((id) => expanded.add(id));
        return expanded;
    }
    for (const nodeId of Array.from(expanded)) {
        for (const childId of [...tasksChildGroupIds(nodeId, model), ...tasksChildTaskIds(nodeId, model)]) {
            if (tasksNodeHasChildren(childId, model)) expanded.add(childId);
        }
    }
    return expanded;
}

function collapseOneGroupDepth(model, expandedSet) {
    const expanded = new Set(expandedSet || []);
    for (const nodeId of Array.from(expanded)) {
        const childIds = [...tasksChildGroupIds(nodeId, model), ...tasksChildTaskIds(nodeId, model)];
        const hasExpandedChild = childIds.some((childId) => expanded.has(childId));
        if (!hasExpandedChild) expanded.delete(nodeId);
    }
    return expanded;
}

function reduceTransitiveEdges(edges) {
    const nodes = new Set();
    const outgoing = new Map();
    for (const edge of edges) {
        nodes.add(edge.source);
        nodes.add(edge.target);
        if (!outgoing.has(edge.source)) outgoing.set(edge.source, []);
        outgoing.get(edge.source).push(edge.target);
    }
    const canReach = (start, target, blockedKey) => {
        const seen = new Set([start]);
        const queue = [start];
        while (queue.length > 0) {
            const cur = queue.shift();
            for (const next of outgoing.get(cur) || []) {
                if (`${cur}->${next}` === blockedKey) continue;
                if (next === target) return true;
                if (seen.has(next)) continue;
                seen.add(next);
                queue.push(next);
            }
        }
        return false;
    };
    return edges.filter((edge) => edge.label || !canReach(edge.source, edge.target, `${edge.source}->${edge.target}`));
}

function stableTaskJitter(id, amplitudeX = 16, amplitudeY = 8) {
    const text = String(id || '');
    let hashA = 0;
    let hashB = 0;
    for (let i = 0; i < text.length; i += 1) {
        const code = text.charCodeAt(i);
        hashA = (hashA * 33 + code) % 1000003;
        hashB = (hashB * 97 + code) % 1000033;
    }
    return {
        x: ((hashA % 1000) / 999 - 0.5) * amplitudeX,
        y: ((hashB % 1000) / 999 - 0.5) * amplitudeY,
    };
}

async function layoutTasksGraph(graph, model, expanded, jitterConfig = {}, layoutConfig = {}) {
    const nodeMap = Object.fromEntries(graph.nodes.map((n) => [n.id, n]));
    const layoutEdges = reduceTransitiveEdges(graph.edges || []);
    const parentOf = {};
    const expandedGroupSizes = {};
    const groupPadding = layoutConfig.groupPadding || 40;
    const groupTopPadding = (groupNode, widthOverride = null) => {
        const width = Math.max(80, Number(widthOverride || groupNode?.width || 250) - 16);
        const titleHeight = sizeTaskNode(groupNode?.label || groupNode?.id || '', 'groupTitle', width, {
            hasImage: Boolean(resolveTasksNodeImage(groupNode, model)),
        }).height;
        return groupPadding + titleHeight;
    };

    for (const n of graph.nodes) {
        if (n.__kind__ === 'group' && expanded.has(n.id)) {
            const childGroups = (model.group_tree?.[n.id] || []).filter((cg) => graph.nodes.some((gn) => gn.id === cg));
            const childTasks = (model.task_children?.[n.id] || []).filter((ct) => graph.nodes.some((tn) => tn.id === ct));
            [...childGroups, ...childTasks].forEach((cid) => { parentOf[cid] = n.id; });
        }
    }

    const buildElkNode = (nid) => {
        const n = nodeMap[nid];
        const node = { id: nid, width: n?.width || 250, height: n?.height || 80 };
        const children = graph.nodes.filter((cn) => parentOf[cn.id] === nid);
        if (children.length > 0) {
            node.children = children.map((c) => buildElkNode(c.id));
            node.layoutOptions = {
                'elk.algorithm': 'layered',
                'elk.direction': layoutConfig.elkDirection || 'DOWN',
                'elk.spacing.nodeNode': `${layoutConfig.nodeSpacing || 72}`,
                'elk.layered.spacing.nodeNodeBetweenLayers': `${layoutConfig.layerSpacing || 112}`,
                'elk.padding': `[top=${groupTopPadding(n)},left=${groupPadding},bottom=${groupPadding},right=${groupPadding}]`
            };
        }
        return node;
    };

    for (const gid of expanded) {
        if (!graph.nodes.some((n) => n.id === gid && n.__kind__ === 'group')) continue;
        const childGroups = (model.group_tree?.[gid] || []).filter((cg) => graph.nodes.some((gn) => gn.id === cg));
        const childTasks = (model.task_children?.[gid] || []).filter((ct) => graph.nodes.some((tn) => tn.id === ct));
        const allChildren = [...childGroups, ...childTasks];
        if (allChildren.length === 0) continue;
        const childGraph = {
            id: `sub-${gid}`,
            layoutOptions: {
                'elk.algorithm': 'layered',
                'elk.direction': layoutConfig.elkDirection || 'DOWN',
                'elk.spacing.nodeNode': `${layoutConfig.nodeSpacing || 72}`,
                'elk.layered.spacing.nodeNodeBetweenLayers': `${layoutConfig.layerSpacing || 112}`,
                'elk.padding': `[top=${groupTopPadding(nodeMap[gid])},left=${groupPadding},bottom=${groupPadding},right=${groupPadding}]`
            },
            children: allChildren.map((cid) => {
                const cn = nodeMap[cid];
                return { id: cid, width: cn?.width || 250, height: cn?.height || 80 };
            }),
            edges: reduceTransitiveEdges((graph.edges || [])
                .filter((e) => allChildren.includes(e.source) && allChildren.includes(e.target))
            ).map((e, i) => ({ id: `e${i}`, sources: [e.source], targets: [e.target] })),
        };
        const subLayout = await tasksElk.layout(childGraph);
        if (subLayout.children && subLayout.children.length > 0) {
            expandedGroupSizes[gid] = {
                width: Math.max(subLayout.width || 0, 250),
                height: Math.max(subLayout.height || 0, 80),
            };
        }
    }

    const adjustedNodes = graph.nodes.map((n) => {
        if (expandedGroupSizes[n.id]) {
            return { ...n, width: expandedGroupSizes[n.id].width, height: expandedGroupSizes[n.id].height };
        }
        return n;
    });
    const adjustedNodeMap = Object.fromEntries(adjustedNodes.map((n) => [n.id, n]));

    const buildElkNodeAdjusted = (nid) => {
        const n = adjustedNodeMap[nid];
        const node = { id: nid, width: n?.width || 250, height: n?.height || 80 };
        const children = adjustedNodes.filter((cn) => parentOf[cn.id] === nid);
        if (children.length > 0) {
            node.children = children.map((c) => buildElkNodeAdjusted(c.id));
            node.layoutOptions = {
                'elk.algorithm': 'layered',
                'elk.direction': layoutConfig.elkDirection || 'DOWN',
                'elk.spacing.nodeNode': `${layoutConfig.nodeSpacing || 72}`,
                'elk.layered.spacing.nodeNodeBetweenLayers': `${layoutConfig.layerSpacing || 112}`,
                'elk.padding': `[top=${groupTopPadding(n, n?.width)},left=${groupPadding},bottom=${groupPadding},right=${groupPadding}]`
            };
        }
        return node;
    };

    const topLevel = adjustedNodes.filter((n) => !parentOf[n.id]);
    const rootLayoutOptions = {
        'elk.algorithm': 'layered',
        'elk.direction': layoutConfig.elkDirection || 'DOWN',
        'elk.spacing.nodeNode': `${layoutConfig.nodeSpacing || TASKS_ROOT_SPACING.node}`,
        'elk.layered.spacing.nodeNodeBetweenLayers': `${layoutConfig.layerSpacing || TASKS_ROOT_SPACING.layer}`,
    };
    const laidOut = await tasksElk.layout({
        id: 'root',
        layoutOptions: rootLayoutOptions,
        children: topLevel.map((n) => buildElkNodeAdjusted(n.id)),
        edges: layoutEdges.map((e, i) => ({ id: `e${i}`, sources: [e.source], targets: [e.target] })),
    });
    const absPosMap = {};
    const relPosMap = {};
    const collectPos = (node, offsetX = 0, offsetY = 0) => {
        const jitter = stableTaskJitter(node.id, jitterConfig.x ?? 18, jitterConfig.y ?? 10);
        const localX = (node.x || 0) + jitter.x;
        const localY = (node.y || 0) + jitter.y;
        relPosMap[node.id] = { x: localX, y: localY };
        absPosMap[node.id] = { x: localX + offsetX, y: localY + offsetY };
        if (node.children) {
            node.children.forEach((c) => collectPos(c, absPosMap[node.id].x, absPosMap[node.id].y));
        }
    };
    laidOut.children?.forEach((c) => collectPos(c));
    laidOut.absoluteChildPositions = absPosMap;
    laidOut.relativeChildPositions = relPosMap;
    laidOut.parentOf = parentOf;
    laidOut.expandedGroupSizes = expandedGroupSizes;
    return laidOut;
}

async function layoutBaseTasksGraph(graph, model, jitterConfig = {}, layoutConfig = {}) {
    const rootGroupIds = new Set(model.group_tree?.["null"] || []);
    const rootTaskIds = new Set(model.task_children?.["null"] || []);
    const rootNodeIds = new Set([...rootGroupIds, ...rootTaskIds]);
    const taskToGroup = Object.fromEntries((model.tasks || []).map((t) => [t.id, t.group_id || null]));
    const groupParent = Object.fromEntries((model.groups || []).map((g) => [g.id, g.parent_group_id || null]));

    const getRoot = (id) => {
        let cur = id;
        while (groupParent[cur]) {
            cur = groupParent[cur];
        }
        return cur;
    };

    const rootEdges = [];
    const seenRootEdges = new Map();
    for (const edge of (model.dependency_edges || [])) {
        const srcGroup = taskToGroup[edge.source] || edge.source;
        const dstGroup = taskToGroup[edge.target] || edge.target;
        const srcRoot = getRoot(srcGroup);
        const dstRoot = getRoot(dstGroup);
        if (srcRoot !== dstRoot && rootNodeIds.has(srcRoot) && rootNodeIds.has(dstRoot)) {
            appendProjectedEdge(rootEdges, seenRootEdges, srcRoot, dstRoot, edge.label || '', edge);
        }
    }

    const rootGraph = {
        nodes: graph.nodes.filter((n) => rootNodeIds.has(n.id)),
        edges: rootEdges,
    };
    logTasksDebugVerbose('rootGraph', {
        nodes: rootGraph.nodes.map(n => n.id),
        edges: rootGraph.edges,
        edgeCount: rootGraph.edges.length,
    });
    const laidOut = await layoutTasksGraph(rootGraph, model, new Set(), jitterConfig, layoutConfig);
    logTasksDebugVerbose('baseLayout', {
        width: Math.round(laidOut.width || 0),
        height: Math.round(laidOut.height || 0),
        positions: Object.fromEntries(Object.entries(laidOut.absoluteChildPositions || {}).map(([id, rect]) => [id, rectSummary(rect)])),
    });
    const positions = {};
    for (const node of rootGraph.nodes) {
        const pos = laidOut.absoluteChildPositions?.[node.id] || { x: 0, y: 0 };
        positions[node.id] = {
            x: pos.x,
            y: pos.y,
            width: node.width || 250,
            height: node.height || 80,
        };
    }
    return { positions, width: laidOut.width || 0, height: laidOut.height || 0 };
}

function buildProjectedRootTasksGraph(rawGraph, model) {
    const rootGroupIds = new Set(model.group_tree?.["null"] || []);
    const rootTaskIds = new Set(model.task_children?.["null"] || []);
    const rootNodeIds = new Set([...rootGroupIds, ...rootTaskIds]);
    const taskToGroup = Object.fromEntries((model.tasks || []).map((task) => [task.id, task.group_id || null]));
    const groupParent = Object.fromEntries((model.groups || []).map((group) => [group.id, group.parent_group_id || null]));
    const getRoot = (id) => {
        let cur = taskToGroup[id] || id;
        while (groupParent[cur]) cur = groupParent[cur];
        return cur;
    };
    const edges = [];
    const seen = new Map();
    for (const edge of (model.dependency_edges || [])) {
        const source = getRoot(edge.source);
        const target = getRoot(edge.target);
        if (source !== target && rootNodeIds.has(source) && rootNodeIds.has(target)) {
            appendProjectedEdge(edges, seen, source, target, edge.label || '', edge);
        }
    }
    return {
        nodes: rawGraph.nodes.filter((node) => rootNodeIds.has(node.id)),
        edges,
    };
}

function hasExplicitGroupDirection(model) {
    return (model.groups || []).some((group) => group && (group.direction || group.layout_direction));
}

// Read the layering ELK already worked out, rather than re-deriving ranks from
// the edges. ELK breaks cycles as part of laying out; a longest-path rank of our
// own cuts a cycle wherever its walk happens to enter it, which can drop a group
// far from the one edge that placed it. A band is a set of children that overlap
// vertically, which is exactly what one ELK layer looks like.
function tasksWaterfallBands(ids, edges, direction, positions = {}) {
    if (direction !== 'DOWN' || !edges.length) return null;
    const placed = ids.filter((id) => positions[id]);
    if (!placed.length) return null;
    const bands = [];
    let bandBottom = -Infinity;
    for (const id of placed.sort((left, right) => positions[left].y - positions[right].y)) {
        const rect = positions[id];
        if (!bands.length || rect.y >= bandBottom) {
            bands.push([]);
            bandBottom = -Infinity;
        }
        bands[bands.length - 1].push(id);
        bandBottom = Math.max(bandBottom, rect.y + (rect.height || 0));
    }
    for (const band of bands) band.sort((left, right) => positions[left].x - positions[right].x);
    return bands;
}

async function layoutGroupInternal(groupId, model, childSizes = {}, jitterConfig = {}, layoutConfig = {}, useElkForGroups = true) {
    const groupsById = Object.fromEntries((model.groups || []).map((group) => [group.id, group]));
    const tasksById = Object.fromEntries((model.tasks || []).map((task) => [task.id, task]));
    const groupDirection = readTasksDirection(groupsById[groupId]?.layout_direction || groupsById[groupId]?.direction || layoutConfig.elkDirection);
    const groupPadding = layoutConfig.groupPadding || 40;
    const groupTitleWidth = Math.max(80, (childSizes[groupId]?.width || groupsById[groupId]?.width || 250) - 16);
    const groupTitleHeight = sizeTaskNode(groupsById[groupId]?.label || groupId, 'groupTitle', groupTitleWidth, {
        hasImage: Boolean(resolveTasksNodeImage(groupsById[groupId], model)),
    }).height;
    const groupPadTop = groupPadding + groupTitleHeight;
    const groupChildren = [
        ...(model.task_children?.[groupId] || []).map((id) => {
            const source = tasksById[id] || {};
            const label = source.label || id;
            return { id, __kind__: 'task', label, ...sizeTaskNode(label, 'task', null, { hasImage: Boolean(resolveTasksNodeImage(source, model)) }) };
        }),
        ...(model.group_tree?.[groupId] || []).map((id) => {
            const source = groupsById[id] || {};
            const label = source.label || id;
            return { id, __kind__: 'group', label, ...sizeTaskNode(label, 'group', null, { hasImage: Boolean(resolveTasksNodeImage(source, model)) }) };
        }),
    ].map((child) => childSizes[child.id] ? { ...child, ...childSizes[child.id] } : child);
    if (groupChildren.length === 0) {
        return {
            positions: {},
            bbox: { width: 250, height: 80 },
        };
    }
    const compactGroupChildren = (positions, beforeBbox) => {
        const order = [...groupChildren]
            .sort((left, right) => (
                ((positions[left.id]?.y || 0) - (positions[right.id]?.y || 0))
                || ((positions[left.id]?.x || 0) - (positions[right.id]?.x || 0))
                || (left.__kind__ === right.__kind__ ? 0 : (left.__kind__ === 'task' ? -1 : 1))
            ))
            .map((child) => child.id);
        const bands = tasksWaterfallBands(order, childEdges, groupDirection, positions);
        const compacted = packTaskChildRects(positions, {
            gap: Math.max(12, Math.min(layoutConfig.nodeSpacing || 72, 36)),
            padX: groupPadding,
            padTop: groupPadTop,
            padBottom: groupPadding,
            minWidth: 250,
            minHeight: 80,
            targetAspectRatio: 1.05,
            order,
            bands: bands || undefined,
        });
        logTasksDebugVerbose('groupPacking', {
            groupId,
            before: rectSummary(beforeBbox),
            after: rectSummary(compacted.bbox),
            rows: compacted.rows,
            positions: Object.fromEntries(Object.entries(compacted.positions).map(([id, rect]) => [id, rectSummary(rect)])),
        });
        return compacted;
    };
    const childIds = new Set(groupChildren.map((child) => child.id));
    const parentOf = Object.fromEntries([
        ...(model.tasks || []).map((task) => [task.id, task.group_id || null]),
        ...(model.groups || []).map((group) => [group.id, group.parent_group_id || null]),
    ]);
    const liftToChild = (id) => {
        let current = id;
        while (current && !childIds.has(current)) current = parentOf[current] ?? null;
        return current;
    };
    const liftedEdges = new Map();
    for (const edge of (model.dependency_edges || [])) {
        const source = liftToChild(edge.source);
        const target = liftToChild(edge.target);
        if (!source || !target || source === target) continue;
        const key = `${source}->${target}`;
        if (!liftedEdges.has(key)) liftedEdges.set(key, { ...edge, source, target });
    }
    const childEdges = reduceTransitiveEdges([...liftedEdges.values()]);
    if (useElkForGroups && childEdges.length > 0) {
        const elkLayout = await tasksElk.layout({
            id: `group-${groupId}`,
            layoutOptions: {
                'elk.algorithm': 'layered',
                'elk.direction': groupDirection,
                'elk.spacing.nodeNode': `${layoutConfig.nodeSpacing || 72}`,
                'elk.layered.spacing.nodeNodeBetweenLayers': `${layoutConfig.layerSpacing || 112}`,
                'elk.padding': `[top=${groupPadTop},left=${groupPadding},bottom=${groupPadding},right=${groupPadding}]`,
            },
            children: groupChildren.map((child) => ({
                id: child.id,
                width: child.width || 250,
                height: child.height || 80,
            })),
            edges: childEdges.map((edge, index) => ({ id: `e${index}`, sources: [edge.source], targets: [edge.target] })),
        });
        const positions = {};
        for (const child of elkLayout.children || []) {
            const jitter = stableTaskJitter(child.id, jitterConfig.x ?? 14, jitterConfig.y ?? 8);
            positions[child.id] = {
                x: (child.x || 0) + jitter.x,
                y: (child.y || 0) + jitter.y,
                width: child.width || 0,
                height: child.height || 0,
            };
        }
        return compactGroupChildren(positions, {
            width: Math.max(elkLayout.width || 0, 250),
            height: Math.max(elkLayout.height || 0, 80),
        });
    }
    const packedLayout = layoutDisconnectedTaskNodes(groupChildren, groupDirection, {
        gap: Math.max(layoutConfig.nodeSpacing || 72, layoutConfig.layerSpacing || 112),
        padX: groupPadding,
        padTop: groupPadTop,
        padBottom: groupPadding,
    });
    const positions = {};
    for (const child of groupChildren) {
        const base = packedLayout.positions[child.id];
        const jitter = stableTaskJitter(child.id, jitterConfig.x ?? 14, jitterConfig.y ?? 8);
        positions[child.id] = {
            x: (base?.x || 0) + jitter.x,
            y: (base?.y || 0) + jitter.y,
            width: child.width || 0,
            height: child.height || 0,
        };
    }
    return compactGroupChildren(positions, {
        width: Math.max(packedLayout.bbox.width || 0, 250),
        height: Math.max(packedLayout.bbox.height || 0, 80),
    });
}

async function layoutExpandedGroups(model, expandedSet, jitterConfig = {}, layoutConfig = {}, useElkForGroups = true) {
    const expandedIds = Array.from(expandedSet);
    const groupParent = Object.fromEntries((model.groups || []).map((g) => [g.id, g.parent_group_id || null]));
    const depthOf = (id) => {
        let depth = 0;
        let cur = groupParent[id];
        while (cur) {
            depth += 1;
            cur = groupParent[cur];
        }
        return depth;
    };
    const layouts = {};
    for (const groupId of expandedIds.sort((a, b) => depthOf(b) - depthOf(a))) {
        const childSizes = {};
        for (const childId of (model.group_tree?.[groupId] || [])) {
            if (layouts[childId]) childSizes[childId] = layouts[childId].bbox;
        }
        layouts[groupId] = await layoutGroupInternal(groupId, model, childSizes, jitterConfig, layoutConfig, useElkForGroups);
    }
    return layouts;
}

async function deriveSquishedExpandedLayout(baseGraph, model, expandedSet, baseLayout, groupLayouts, layoutConfig = {}) {
    const visible = buildVisibleTasksGraph(model, expandedSet);
    logTasksDebugVerbose('visibleGraph', {
        expanded: Array.from(expandedSet),
        nodes: visible.nodes.map(n => n.id),
        edges: visible.edges,
    });
    const visibleNodeMap = Object.fromEntries(visible.nodes.map((node) => [node.id, node]));
    const parentOf = {};
    for (const groupId of expandedSet) {
        (model.group_tree?.[groupId] || []).forEach((id) => { parentOf[id] = groupId; });
        (model.task_children?.[groupId] || []).forEach((id) => { parentOf[id] = groupId; });
    }

    const topLevelIds = baseGraph.nodes.map((node) => node.id);
    const expandedTopLevelIds = topLevelIds.filter((id) => expandedSet.has(id));
    const topLevelRects = {};
    for (const id of topLevelIds) {
        const baseRect = baseLayout.positions[id];
        if (!baseRect) continue;
        const groupLayout = expandedSet.has(id) ? groupLayouts[id] : null;
        topLevelRects[id] = groupLayout ? tasksExpandedRootRect(baseRect, groupLayout.bbox) : {
            x: baseRect.x,
            y: baseRect.y,
            width: baseRect.width,
            height: baseRect.height,
            baseWidth: baseRect.width,
            baseHeight: baseRect.height,
        };
    }
    const layoutTrace = {
        expandedTopLevelIds,
        visibleNodeIds: visible.nodes.map((node) => node.id),
        baseRects: Object.fromEntries(topLevelIds.map((id) => [id, rectSummary(baseLayout.positions[id])]).filter(([, rect]) => rect)),
        expandedRects: Object.fromEntries(Object.entries(topLevelRects).map(([id, rect]) => [id, rectSummary(rect)])),
        collisionPasses: [],
        finalRects: {},
    };

    const nodes = [];
    let rootPositions = null;
    if (expandedTopLevelIds.length > 0) {
        const rootLayout = await tasksElk.layout({
            id: 'expanded-root',
            layoutOptions: {
                'elk.algorithm': 'layered',
                'elk.direction': layoutConfig.elkDirection || 'DOWN',
                'elk.spacing.nodeNode': `${layoutConfig.nodeSpacing || TASKS_ROOT_SPACING.node}`,
                'elk.layered.spacing.nodeNodeBetweenLayers': `${layoutConfig.layerSpacing || TASKS_ROOT_SPACING.layer}`,
            },
            children: topLevelIds
                .filter((id) => topLevelRects[id])
                .map((id) => ({
                    id,
                    width: topLevelRects[id].width,
                    height: topLevelRects[id].height,
                })),
            edges: (baseGraph.edges || []).map((edge, index) => ({ id: `root-${index}`, sources: [edge.source], targets: [edge.target] })),
        });
        rootPositions = Object.fromEntries((rootLayout.children || []).map((node) => [node.id, { x: node.x || 0, y: node.y || 0 }]));
        layoutTrace.rootElk = {
            width: Math.round(rootLayout.width || 0),
            height: Math.round(rootLayout.height || 0),
            positions: Object.fromEntries(Object.entries(rootPositions).map(([id, position]) => [id, rectSummary({ ...position, width: topLevelRects[id]?.width, height: topLevelRects[id]?.height })])),
        };
    }
    for (const id of topLevelIds) {
        const visibleNode = visibleNodeMap[id];
        if (!visibleNode) continue;
        const rect = topLevelRects[id];
        const rootPosition = rootPositions?.[id] || rect;
        nodes.push({
            ...visibleNode,
            position: { x: rootPosition.x, y: rootPosition.y },
            width: rect.width,
            height: rect.height,
            parentId: null,
        });
    }

    const addExpandedChildren = (groupId) => {
        const groupLayout = groupLayouts[groupId];
        if (!groupLayout) return;
        const groupChildren = [...(model.group_tree?.[groupId] || []), ...(model.task_children?.[groupId] || [])];
        for (const childId of groupChildren) {
            const childVisible = visibleNodeMap[childId];
            const childRect = groupLayout.positions[childId];
            if (!childVisible || !childRect) continue;
            const nestedLayout = expandedSet.has(childId) ? groupLayouts[childId] : null;
            nodes.push({
                ...childVisible,
                position: { x: childRect.x, y: childRect.y },
                width: nestedLayout?.bbox.width || childRect.width,
                height: nestedLayout?.bbox.height || childRect.height,
                parentId: groupId,
            });
            if (nestedLayout) addExpandedChildren(childId);
        }
    };
    for (const groupId of expandedTopLevelIds) addExpandedChildren(groupId);

    if (expandedTopLevelIds.length > 0 && !rootPositions) {
        const topLevelState = {};
        for (const id of topLevelIds) {
            const baseRect = baseLayout.positions[id];
            const rect = topLevelRects[id];
            if (!baseRect || !rect) continue;
            topLevelState[id] = {
                x: rect.x || 0,
                y: rect.y || 0,
                width: rect.baseWidth,
                height: rect.baseHeight,
                expandedWidth: rect.width,
                expandedHeight: rect.height,
            };
        }

        for (const expandedId of expandedTopLevelIds) {
            const expandedState = topLevelState[expandedId];
            if (!expandedState) continue;
            expandedState.width = expandedState.expandedWidth;
            expandedState.height = expandedState.expandedHeight;
        }

        const topLevelStateList = topLevelIds
            .map((id) => topLevelState[id])
            .filter(Boolean)
            .sort((a, b) => (a.y - b.y) || (a.x - b.x));
        logTasksDebugVerbose('unwarpBeforeCollisions', {
            expandedTopLevelIds,
            topLevelState: Object.fromEntries(Object.entries(topLevelState).map(([id, rect]) => [id, rectSummary(rect)])),
        });
        for (let pass = 0; pass < 4; pass += 1) {
            const collisionMoves = [];
            for (let i = 0; i < topLevelStateList.length; i += 1) {
                const a = topLevelStateList[i];
                for (let j = i + 1; j < topLevelStateList.length; j += 1) {
                    const b = topLevelStateList[j];
                    const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
                    const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
                    if (overlapX <= -(layoutConfig.collisionGap || TASKS_ROOT_COLLISION_GAP) || overlapY <= -(layoutConfig.collisionGap || TASKS_ROOT_COLLISION_GAP)) continue;
                    if (Math.abs((a.x + a.width / 2) - (b.x + b.width / 2)) < Math.abs((a.y + a.height / 2) - (b.y + b.height / 2))) {
                        const nextY = a.y + a.height + (layoutConfig.collisionGap || TASKS_ROOT_COLLISION_GAP);
                        if (nextY !== b.y) collisionMoves.push({ pass, axis: 'y', fromY: Math.round(b.y), toY: Math.round(nextY) });
                        b.y = nextY;
                    } else {
                        const nextX = a.x + a.width + (layoutConfig.collisionGap || TASKS_ROOT_COLLISION_GAP);
                        if (nextX !== b.x) collisionMoves.push({ pass, axis: 'x', fromX: Math.round(b.x), toX: Math.round(nextX) });
                        b.x = nextX;
                    }
                }
            }
            logTasksDebugVerbose('unwarpPass', {
                pass,
                collisionMoves,
                topLevelState: Object.fromEntries(Object.entries(topLevelState).map(([id, rect]) => [id, rectSummary(rect)])),
            });
            layoutTrace.collisionPasses.push({
                pass,
                collisionMoves,
                state: Object.fromEntries(Object.entries(topLevelState).map(([id, rect]) => [id, rectSummary(rect)])),
            });
        }

        if (baseGraph.enforceRootRank) {
            const rankGap = Math.min(layoutConfig.collisionGap || TASKS_ROOT_COLLISION_GAP, 40);
            const rankAxis = (layoutConfig.elkDirection || 'DOWN') === 'RIGHT' ? 'x' : 'y';
            for (let pass = 0; pass < topLevelIds.length; pass += 1) {
                let moved = false;
                for (const edge of baseGraph.edges || []) {
                    const source = topLevelState[edge.source];
                    const target = topLevelState[edge.target];
                    if (!source || !target) continue;
                    const minTarget = rankAxis === 'x'
                        ? source.x + source.width + rankGap
                        : source.y + source.height + rankGap;
                    if (rankAxis === 'x' && target.x < minTarget) {
                        target.x = minTarget;
                        moved = true;
                    } else if (rankAxis === 'y' && target.y < minTarget) {
                        target.y = minTarget;
                        moved = true;
                    }
                }
                if (!moved) break;
            }
            const orderedTopLevelIds = topLevelIds
                .filter((id) => topLevelState[id])
                .sort((a, b) => {
                    const left = topLevelState[a];
                    const right = topLevelState[b];
                    return rankAxis === 'x' ? ((left.x - right.x) || (left.y - right.y)) : ((left.y - right.y) || (left.x - right.x));
                });
            for (const id of orderedTopLevelIds) {
                const incoming = (baseGraph.edges || [])
                    .filter((edge) => edge.target === id)
                    .map((edge) => topLevelState[edge.source])
                    .filter(Boolean);
                if (!incoming.length) continue;
                const minPosition = Math.max(...incoming.map((source) => (
                    rankAxis === 'x'
                        ? source.x + source.width + rankGap
                        : source.y + source.height + rankGap
                )));
                if (rankAxis === 'x' && topLevelState[id].x > minPosition) topLevelState[id].x = minPosition;
                if (rankAxis === 'y' && topLevelState[id].y > minPosition) topLevelState[id].y = minPosition;
            }
        }

        for (const node of nodes.filter((n) => !n.parentId)) {
            const state = topLevelState[node.id];
            if (!state) continue;
            node.position = { x: state.x, y: state.y };
        }
        logTasksDebugVerbose('unwarpFinal', {
            topLevelNodes: nodes.filter(n => !n.parentId).map(n => ({
                id: n.id,
                x: Math.round(n.position.x),
                y: Math.round(n.position.y),
                width: Math.round(n.width || 0),
                height: Math.round(n.height || 0),
            })),
        });
    }
    layoutTrace.finalRects = Object.fromEntries(nodes.filter((node) => !node.parentId).map((node) => [
        node.id,
        rectSummary({ ...node.position, width: node.width, height: node.height }),
    ]));
    window.__vyasaTasksDebug.latestLayout = layoutTrace;
    logTasksDebug('layoutTrace', layoutTrace);

    const finalEdges = visible.edges.map((e, i) => ({
        ...e,
        id: `${e.source}-${e.target}-${i}`,
        source: e.source,
        target: e.target,
        label: e.label || undefined,
    }));
    logTasksDebugVerbose('deriveResult', { visibleEdges: visible.edges, finalEdges });
    return {
        nodes,
        edges: finalEdges,
    };
}

function paintTasksScene(scene, mount, graph, laidOut) {
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
        return `<div class="vyasa-task-card" data-node-id="${n.id}" data-node-kind="${n.__kind__}" style="position:absolute;left:${p.x}px;top:${p.y}px;width:${n.width}px;height:${n.height}px;border:1px solid color-mix(in srgb, currentColor 35%, transparent);border-radius:14px;background:${bg};display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:600;text-align:center;padding:8px;cursor:${n.__kind__ === 'group' ? 'pointer' : 'default'}"><span>${n.label}</span>${linkIcon}${exp}</div>`;
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

function tasksGraphNodeAbsoluteRect(node, byId) {
    let x = node.position?.x || 0;
    let y = node.position?.y || 0;
    let parent = node.parentId ? byId[node.parentId] : null;
    while (parent) {
        x += parent.position?.x || 0;
        y += parent.position?.y || 0;
        parent = parent.parentId ? byId[parent.parentId] : null;
    }
    return { x, y, width: node.style?.width || node.width || 0, height: node.style?.height || node.height || 0 };
}

function tasksGraphNodeAtFlowPoint(nodes, point) {
    const byId = Object.fromEntries((nodes || []).map((node) => [node.id, node]));
    return (nodes || [])
        .filter((node) => node.data?.__kind__ !== 'ganttHeader')
        .map((node) => ({ node, rect: tasksGraphNodeAbsoluteRect(node, byId), z: Number(node.zIndex || node.style?.zIndex || 0) }))
        .filter(({ rect }) => point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height)
        .sort((a, b) => b.z - a.z)[0] || null;
}

function openTasksNodeHref(href, event = null) {
    if (!href) return;
    logTasksDebug('nodeHrefOpen:start', {
        href,
        tagName: event?.target?.tagName || '',
        pathname: window.location.pathname,
        hasMainContent: Boolean(document.getElementById('main-content')),
    });
    event?.preventDefault();
    event?.stopPropagation();
    if (href.startsWith('#')) {
        logTasksDebug('nodeHrefOpen:fragment', { href });
        document.getElementById(href.slice(1))?.scrollIntoView({ block: 'start', behavior: 'smooth' });
        window.history.pushState(null, '', href);
        return;
    }
    const [pathOnly, hash = ''] = String(href).split('#', 2);
    const isInternal = href.startsWith('/posts/') || (href.startsWith('/') && !href.startsWith('/slides/') && !href.split('/').pop().includes('.'));
    if (isInternal && window.htmx?.ajax) {
        logTasksDebug('nodeHrefOpen:htmxRequest', { href, pathOnly, hash, targetId: 'main-content' });
        const onSwap = (swapEvent) => {
            if (swapEvent.target?.id !== 'main-content') return;
            document.body.removeEventListener('htmx:afterSwap', onSwap);
            logTasksDebug('nodeHrefOpen:htmxSwap', {
                href,
                pathOnly,
                hash,
                swappedId: swapEvent.target?.id || '',
                childCount: swapEvent.target?.childElementCount ?? -1,
            });
            if (hash) {
                const fragment = `#${hash}`;
                document.getElementById(hash)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
                if (`${window.location.pathname}${window.location.search}${window.location.hash}` !== `${pathOnly}${fragment}`) {
                    window.history.pushState(null, '', `${pathOnly}${fragment}`);
                }
                return;
            }
            if (window.location.pathname !== pathOnly) {
                window.history.pushState(null, '', pathOnly);
            }
        };
        document.body.addEventListener('htmx:afterSwap', onSwap);
        window.htmx.ajax('GET', pathOnly, { target: '#main-content', swap: 'outerHTML show:window:top settle:0.1s' });
        return;
    }
    logTasksDebug('nodeHrefOpen:nativeAssign', { href, isInternal, hasHtmx: Boolean(window.htmx?.ajax) });
    window.location.assign(href);
}

function tasksHrefSupportsPreview(href) {
    const text = String(href || '').trim();
    if (!text || /^(https?:|mailto:|tel:|vscode:|\/\/)/.test(text)) return false;
    if (text.startsWith('#') || text.startsWith('/posts/')) return true;
    if (text.startsWith('/')) return !text.split('/').pop().includes('.');
    return true;
}

function renderTasksInlineLinks(value, options = {}) {
    const text = String(value || '');
    const interactive = options.interactive !== false;
    const onInactiveClick = typeof options.onInactiveClick === 'function' ? options.onInactiveClick : null;
    const currentPath = String(options.currentPath || '').trim();
    const parts = [];
    const linkPart = (label, href, key) => interactive
        ? window.React.createElement('a', {
            key,
            href,
            'data-vyasa-link-preview': tasksHrefSupportsPreview(href) ? 'true' : undefined,
            'data-vyasa-link-preview-current-path': currentPath || undefined,
            onClick: (event) => openTasksNodeHref(href, event),
            style: { textDecoration: 'underline', textUnderlineOffset: '2px', color: 'inherit' },
        }, label)
        : window.React.createElement('span', {
            key,
            onClick: onInactiveClick || undefined,
            style: { textDecoration: 'none', color: 'inherit' },
        }, label);
    const appendText = (plain, offset) => {
        const pattern = /(^|\s)(https?:\/\/[^\s)]+|mailto:[^\s)]+|\/posts\/[^\s)]+|\/[^\s)]+\.[^\s)]+|(?:\.\.?\/)[^\s)]+|#[A-Za-z0-9._:-]+)/g;
        let cursor = 0;
        let raw;
        while ((raw = pattern.exec(plain)) !== null) {
            if (raw.index > cursor) parts.push(plain.slice(cursor, raw.index));
            if (raw[1]) parts.push(raw[1]);
            parts.push(linkPart(raw[2], raw[2], `raw-${offset + raw.index}`));
            cursor = pattern.lastIndex;
        }
        if (cursor < plain.length) parts.push(plain.slice(cursor));
    };
    const pattern = /\[([^\]]+)\]\(([^)\s]+(?:\s[^)]*)?)\)/g;
    let lastIndex = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) {
        if (match.index > lastIndex) appendText(text.slice(lastIndex, match.index), lastIndex);
        const [, label, href] = match;
        parts.push(linkPart(label, href, `${href}-${match.index}`));
        lastIndex = pattern.lastIndex;
    }
    if (lastIndex < text.length) appendText(text.slice(lastIndex), lastIndex);
    return parts.length ? parts : text;
}

function tasksInlineLinkPlainText(value) {
    return String(value || '').replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1');
}

function tasksValueContainsUrl(value) {
    if (value === null || value === undefined) return false;
    const text = String(value).trim();
    if (!text) return false;
    if (/\[[^\]]+\]\(([^)\s]+(?:\s[^)]*)?)\)/.test(text)) return true;
    return /(^|\s)(https?:\/\/[^\s)]+|mailto:[^\s)]+|\/posts\/[^\s)]+|\/[^\s)]+\.[^\s)]+|(?:\.\.?\/)[^\s)]+|#[A-Za-z0-9._:-]+)/.test(text);
}

function tasksExtractUrls(value) {
    if (value === null || value === undefined) return [];
    const text = String(value).trim();
    if (!text) return [];
    const urls = [];
    const markdownPattern = /\[([^\]]+)\]\(([^)\s]+(?:\s[^)]*)?)\)/g;
    let match;
    while ((match = markdownPattern.exec(text)) !== null) {
        const href = String(match[2] || '').trim();
        if (href) urls.push(href);
    }
    const rawPattern = /(^|\s)(https?:\/\/[^\s)]+|mailto:[^\s)]+|\/posts\/[^\s)]+|\/[^\s)]+\.[^\s)]+|(?:\.\.?\/)[^\s)]+|#[A-Za-z0-9._:-]+)/g;
    while ((match = rawPattern.exec(text)) !== null) {
        const href = String(match[2] || '').trim();
        if (href) urls.push(href);
    }
    return urls;
}

function tasksHrefKind(href) {
    const text = String(href || '').trim();
    if (!text) return '';
    if (/^(https?:)?\/\//.test(text) || text.startsWith('mailto:')) return 'external';
    return 'internal';
}

function tasksNodeLinkKinds(node) {
    const kinds = new Set();
    if (!node || typeof node !== 'object') return kinds;
    for (const href of tasksExtractUrls(node.href)) {
        const kind = tasksHrefKind(href);
        if (kind) kinds.add(kind);
    }
    for (const [key, value] of Object.entries(node)) {
        if (tasksIsHiddenNodeMetaKey(key)) continue;
        if (!(typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')) continue;
        for (const href of tasksExtractUrls(value)) {
            const kind = tasksHrefKind(href);
            if (kind) kinds.add(kind);
        }
    }
    return kinds;
}

function renderTasksNodeLinkBadge(React, options = {}) {
    const kinds = Array.isArray(options.kinds) ? options.kinds : [];
    if (!kinds.length) return null;
    return React.createElement('span', {
        className: 'vyasa-task-link-badge',
        'aria-hidden': 'true',
        title: options.title || undefined,
        style: {
            position: 'absolute',
            top: options.top || '8px',
            right: options.right || '10px',
            bottom: options.bottom || undefined,
        },
    }, ...kinds.map((kind) => React.createElement('span', {
        key: kind,
        'uk-icon': kind === 'external' ? 'link-external' : (kind === 'note' ? 'file-text' : 'link'),
    })));
}

function tasksActiveHoverAttrs(sourceModel, activeProjectionId) {
    const projections = Array.isArray(sourceModel?.view_projections) ? sourceModel.view_projections : [];
    const normalize = (value) => (Array.isArray(value) ? value : String(value || '').split(','))
        .map((attr) => String(attr || '').trim())
        .filter(Boolean);
    const id = String(activeProjectionId || '').trim();
    if (id) {
        const projection = projections.find((p) => p && p.id === id);
        if (projection?.hover_attrs) {
            return normalize(projection.hover_attrs);
        }
    }
    if (sourceModel?.hover_attrs) return normalize(sourceModel.hover_attrs);
    return [];
}

function tasksFormatHoverValue(attr, value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'number') {
        if (Number.isInteger(value) && Math.abs(value) >= 1000) {
            return value.toLocaleString('en-US');
        }
        return String(value);
    }
    const str = normalizeTasksAttrText(value);
    if (!str) return '';
    // Try numeric formatting for stringy numbers (the fence parser stores everything as strings).
    if (/^-?\d+(\.\d+)?$/.test(str)) {
        const num = Number(str);
        if (Number.isFinite(num) && Math.abs(num) >= 1000) return num.toLocaleString('en-US');
    }
    return str;
}

function tasksDetailPanelWidth(options = {}) {
    const title = options.title || '';
    const nodeId = options.nodeId || '';
    const entries = Array.isArray(options.entries) ? options.entries : [];
    const titleFont = options.titleFont || '700 14px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    const bodyFont = options.bodyFont || '500 12px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    const keyFont = options.keyFont || '700 12px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    const titleWidth = measureTextWidth(tasksInlineLinkPlainText(title), titleFont);
    const idWidth = nodeId ? measureTextWidth(nodeId, bodyFont) + 20 : 0;
    const rowWidths = entries.map((entry) => {
        const keyWidth = measureTextWidth(entry?.label || '', keyFont);
        const rawValue = String(entry?.value || '');
        const lines = rawValue.split(/\r?\n/).filter(Boolean);
        const firstLine = lines[0] || '';
        const widestLine = lines.reduce((widest, line) => measureTextWidth(line, bodyFont) > measureTextWidth(widest, bodyFont) ? line : widest, firstLine);
        const contentLine = rawValue.length > 120 ? widestLine : firstLine;
        const valueWidth = Math.min(measureTextWidth(contentLine, bodyFont), 520);
        const weight = rawValue.length > 180 ? 0.82 : rawValue.length > 72 ? 0.6 : rawValue.length > 36 ? 0.72 : 0.9;
        return Math.max(keyWidth, valueWidth * weight);
    }).sort((left, right) => left - right);
    const weightedWidth = rowWidths.length ? rowWidths[Math.max(0, Math.floor(rowWidths.length * 0.72) - 1)] : 0;
    const imageReserve = options.hasImage ? 34 : 0;
    const headerWidth = options.stackHeader
        ? Math.max(titleWidth + imageReserve, idWidth) + 44
        : titleWidth + idWidth + imageReserve + 44;
    return Math.round(Math.min(options.maxWidth || 720, Math.max(options.minWidth || 280, headerWidth, weightedWidth + 136)));
}

function tasksNoteEditorMetrics(note, font = '500 12px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif') {
    const text = String(note || '').replace(/\r\n/g, '\n');
    const lines = text.split('\n');
    const widestLine = lines.reduce((widest, line) => (
        measureTextWidth(line, font) > measureTextWidth(widest, font) ? line : widest
    ), '');
    return {
        width: Math.round(Math.min(640, Math.max(360, measureTextWidth(widestLine || 'Notes', font) + 92))),
        lines: Math.max(4, lines.length),
    };
}

function renderTasksNoteTextarea(React, options = {}) {
    const value = String(options.value || '');
    return React.createElement('textarea', {
        ref: options.ref,
        'data-vyasa-task-control': 'true',
        'aria-label': options.ariaLabel || 'Notes',
        value,
        placeholder: 'Notes',
        readOnly: options.readOnly === true,
        rows: Math.min(15, tasksNoteEditorMetrics(value).lines),
        onChange: options.onChange,
        onKeyDown: (event) => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            event.stopPropagation();
            event.currentTarget.blur();
        },
        onPointerDown: (event) => event.stopPropagation(),
        style: {
            width: '100%',
            minHeight: '76px',
            maxHeight: 'calc(1.35em * 15 + 16px)',
            resize: options.readOnly ? 'none' : 'vertical',
            overflowY: 'auto',
            border: '1px solid color-mix(in srgb, var(--vyasa-ink) 18%, transparent)',
            borderRadius: '8px',
            background: 'color-mix(in srgb, var(--vyasa-paper) 94%, transparent)',
            color: 'var(--vyasa-ink)',
            fontSize: '12px',
            lineHeight: 1.35,
            padding: '8px',
            boxSizing: 'border-box',
        },
    });
}

function renderTasksDetailEntries(React, entries, options = {}) {
    return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', fontSize: options.fontSize || '12px', lineHeight: options.lineHeight || 1.35 } },
        ...(entries || []).map((entry, index) => {
            const canCopy = options.copyValues && String(entry?.value ?? '').trim();
            const urls = tasksExtractUrls(entry?.value);
            const urlOnly = urls.length === 1 && String(entry?.value || '').trim() === urls[0];
            const renderedValues = Array.isArray(entry?.renderedValue)
                ? entry.renderedValue.filter((value) => typeof value === 'string' && value)
                : (typeof entry?.renderedValue === 'string' && entry.renderedValue ? [entry.renderedValue] : []);
            const copyValue = async (event) => {
                event.preventDefault();
                event.stopPropagation();
                await copyTasksText(entry.value);
            };
            return React.createElement('div', {
                key: entry.key || entry.attr || `${index}`,
                'data-vyasa-edge-field': options.edgeFields ? (entry.key || entry.attr || '') : undefined,
                className: 'vyasa-task-node-card-row',
                style: { position: 'relative', paddingTop: index === 0 ? '0' : '8px', paddingRight: canCopy ? '26px' : 0, marginTop: index === 0 ? '0' : '8px', borderTop: index === 0 ? 'none' : '1px dashed color-mix(in srgb, currentColor 18%, transparent)', overflowWrap: 'anywhere', wordBreak: 'break-word', whiteSpace: 'pre-line' },
            },
            React.createElement('span', { style: { fontWeight: 700, opacity: 0.72, display: 'block', marginBottom: '4px' } }, `${entry.label}:`),
            urlOnly
                ? React.createElement('span', { className: 'vyasa-task-node-card-value' }, renderTasksInlineLinks(entry.value, { currentPath: options.currentPath }))
                : renderedValues.length
                ? React.createElement('span', { className: 'vyasa-task-node-card-value', style: { display: 'grid', gap: '4px' } },
                    ...renderedValues.map((renderedValue, renderedIndex) => React.createElement('span', {
                        key: `${renderedIndex}`,
                        dangerouslySetInnerHTML: { __html: renderedValue },
                    })))
                : React.createElement('span', { className: 'vyasa-task-node-card-value' }, entry.value),
            canCopy ? React.createElement('button', {
                type: 'button',
                title: 'Copy value',
                'aria-label': `Copy ${entry.label} value`,
                'data-vyasa-task-control': 'true',
                onClick: copyValue,
                className: 'vyasa-task-node-card-copy',
            }, '⧉') : null);
        }));
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

function tasksHoverAttrRows(node, hoverAttrs) {
    if (!node || !Array.isArray(hoverAttrs) || !hoverAttrs.length) return [];
    const rows = [];
    for (const attr of hoverAttrs) {
        const value = node[attr];
        if (value === null || value === undefined || String(value).trim() === '') continue;
        rows.push({
            attr,
            label: tasksNodeMetaLabel(attr),
            value: tasksFormatHoverValue(attr, value),
            renderedValue: typeof node?.__rendered_attrs__?.[attr] === 'string' ? node.__rendered_attrs__[attr] : '',
        });
    }
    return rows;
}

function tasksProjectionOptions(model, ganttEnabled = false, activeContextId = '') {
    const projections = Array.isArray(model?.view_projections) ? model.view_projections : [];
    const baseViewLabel = String(model?.base_view_label || '').trim() || 'Default';
    const options = [
        { id: '', label: baseViewLabel, caption: '' },
        ...projections
            .filter((projection) => (
                projection
                && projection.id
                && model?.projection_models?.[projection.id]
                && tasksViewMatchesContext(projection, activeContextId)
            ))
            .map((projection) => ({
                id: String(projection.id),
                label: String(projection.label || projection.id),
                caption: String(projection.caption || '').trim(),
            })),
    ];
    if (ganttEnabled) options.push({ id: TASKS_GANTT_PROJECTION_ID, label: 'Gantt', caption: '' });
    return options;
}

function tasksAclViewerOptions(model) {
    const viewers = model?.viewer_models && typeof model.viewer_models === 'object' ? model.viewer_models : {};
    return Object.keys(viewers).sort().map((role) => ({ id: role, label: role }));
}

function selectTasksAclViewerState(sourceModel, sourceGraph, viewer) {
    const id = String(viewer || '').trim();
    const entry = id ? sourceModel?.viewer_models?.[id] : null;
    if (!entry || !entry.model || !entry.graph) return { model: sourceModel, graph: sourceGraph, viewer: '' };
    return { model: entry.model, graph: entry.graph, viewer: id };
}

function tasksProjectionDefaultColorBy(model) {
    return String(model?.default_color_by || '').trim();
}

function tasksResolvedProjectionDefaultColorBy(model, nodeNotes = null) {
    const defaultColorBy = tasksProjectionDefaultColorBy(model);
    return tasksColorOptions(model, nodeNotes).some((option) => option.key === defaultColorBy) ? defaultColorBy : '';
}

function resolveTasksPreferredColorBy(model, projectionId, prefs, nodeNotes = null) {
    const saved = typeof prefs?.colorBy === 'string' ? prefs.colorBy.trim() : '';
    const validColorKeys = new Set(tasksColorOptions(model, nodeNotes).map((option) => option.key));
    const defaultColorBy = tasksResolvedProjectionDefaultColorBy(model, nodeNotes);
    if (saved && validColorKeys.has(saved)) return saved;
    if (!String(projectionId || '').trim() && defaultColorBy && validColorKeys.has(defaultColorBy)) {
        return defaultColorBy;
    }
    return validColorKeys.has(defaultColorBy) ? defaultColorBy : '';
}

function resolveTasksPreferredSecondaryColorBy(model, prefs, nodeNotes = null) {
    const validColorKeys = new Set(tasksColorOptions(model, nodeNotes).map((option) => option.key));
    const saved = typeof prefs?.secondaryColorBy === 'string' ? prefs.secondaryColorBy.trim() : '';
    if (saved) return validColorKeys.has(saved) ? saved : '';
    const fallback = String(model?.default_secondary_color_by || '').trim();
    return validColorKeys.has(fallback) ? fallback : '';
}

function resolveTasksPreferredColorHierarchy(model, projectionId, prefs, nodeNotes = null) {
    const explicit = normalizeTasksColorHierarchy(prefs?.colorHierarchy, model, nodeNotes);
    if (explicit.length) return explicit;
    const primary = resolveTasksPreferredColorBy(model, projectionId, prefs, nodeNotes);
    const secondary = resolveTasksPreferredSecondaryColorBy(model, prefs, nodeNotes);
    return normalizeTasksColorHierarchy([primary, secondary], model, nodeNotes);
}

function tasksProjectionConfigHasSidebarState(cfg) {
    return Boolean(cfg && Object.keys(cfg).length);
}

function selectTasksProjectionState(sourceModel, sourceGraph, projectionId) {
    const id = String(projectionId || '').trim();
    const entry = id ? sourceModel?.projection_models?.[id] : null;
    if (!entry || !entry.model || !entry.graph) {
        return { model: sourceModel, graph: sourceGraph, projectionId: '' };
    }
    return { model: entry.model, graph: entry.graph, projectionId: id };
}

function buildTasksViewState(sourceModel, sourceGraph, projectionId, viewMode, groupByEnabled = false, groupByHierarchy = [], preserveGrouping = false) {
    const projectionState = selectTasksProjectionState(sourceModel, sourceGraph, projectionId);
    if (preserveGrouping) return projectionState;
    if (viewMode !== 'gantt') {
        if (!tasksGroupByPrefsDifferFromSchema(sourceModel, projectionId, groupByEnabled, groupByHierarchy)) return projectionState;
        const overrideState = (
            groupByEnabled ? buildTasksGroupedState(projectionState.model, groupByHierarchy) : null
        ) || buildTasksUngroupedState(projectionState.model);
        return { ...overrideState, projectionId: projectionState.projectionId };
    }
    return {
        ...projectionState,
        graph: buildGanttTasksGraph(projectionState.model),
        viewMode: 'gantt',
    };
}

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
                const saved = String(sourcePrefsRef.current?.projectionId || '').trim();
                if (projectionOptions.some((option) => option.id === saved)) return saved;
                return '';
            }, [projectionOptions]);
            const initialGraphProjectionId = initialProjectionId === TASKS_GANTT_PROJECTION_ID ? '' : initialProjectionId;
            const [activeProjectionId, setActiveProjectionId] = React.useState(initialGraphProjectionId);
            const [viewMode, setViewMode] = React.useState(defaultViewMode);
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
            const nodeCardWidth = String(tasksModelSetting(model, 'node-card-width', wrapper.dataset.tasksNodeCardWidth || '480px')).trim() || '480px';
            const hoverCardRightRailSetting = tasksModelBooleanSetting(model, 'hover-card-right-rail', false);
            const hoverFontSize = String(tasksModelSetting(model, 'hover-font-size', wrapper.dataset.tasksHoverFontSize || '12px')).trim() || '12px';
            const colorMix = readTasksColorMixConfigForModel(wrapper, model);
            const projectionGroupOpacity = Math.max(0, Math.min(100, Number.parseFloat(tasksModelSetting(model, 'projection-group-opacity', wrapper.dataset.tasksProjectionGroupOpacity || `${TASKS_PROJECTION_GROUP_OPACITY_DEFAULT}`)) || TASKS_PROJECTION_GROUP_OPACITY_DEFAULT));
            const projectionUnspecifiedGroupOpacity = Math.max(0, Math.min(100, Number.parseFloat(tasksModelSetting(model, 'projection-unspecified-group-opacity', wrapper.dataset.tasksProjectionUnspecifiedGroupOpacity || `${TASKS_PROJECTION_UNSPECIFIED_GROUP_OPACITY_DEFAULT}`)) || TASKS_PROJECTION_UNSPECIFIED_GROUP_OPACITY_DEFAULT));
            const defaultProjectionUnspecifiedContentOpacity = clampTasksProjectionContentOpacity(tasksModelSetting(model, 'projection-unspecified-content-opacity', wrapper.dataset.tasksProjectionUnspecifiedContentOpacity || `${TASKS_PROJECTION_UNSPECIFIED_CONTENT_OPACITY_DEFAULT}`));
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
            const flowWrapperRef = React.useRef(null);
            const filterPanelRef = React.useRef(null);
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
            const optionEdgePinnedRef = React.useRef(false);
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
            const [stickyGroupHoverTooltips, setStickyGroupHoverTooltips] = React.useState([]);
            const stickyGroupHoverTooltipsRef = React.useRef([]);
            stickyGroupHoverTooltipsRef.current = stickyGroupHoverTooltips;
            const stickyGroupHoverTooltipIdRef = React.useRef(0);
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
                setSelectedNodeId(null);
                setSelectedNodeIds(new Set(ids));
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
            const [hoverInactiveNodes, setHoverInactiveNodes] = React.useState(() => (
                typeof projectionPrefs?.hoverInactiveNodes === 'boolean' ? projectionPrefs.hoverInactiveNodes : true
            ));
            // One mode replaces the old enabled flag and the authored right-rail
            // setting; both are derived below, so every read site stays as it was.
            const [hoverCardMode, setHoverCardMode] = React.useState(() => {
                const stored = readTasksHoverCardMode();
                if (stored) return stored;
                if (TASKS_HOVER_CARD_MODES.includes(projectionPrefs?.hoverCardMode)) return projectionPrefs.hoverCardMode;
                if (projectionPrefs?.hoverCardsEnabled === false) return 'off';
                return hoverCardRightRailSetting ? 'rightRail' : 'cursor';
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
            const hoverCardRightRail = hoverCardMode === 'rightRail';
            // The toolbar button is still show/hide, so it needs to know which
            // placement to come back to.
            const lastHoverCardPlacementRef = React.useRef('cursor');
            if (hoverCardsEnabled) lastHoverCardPlacementRef.current = hoverCardMode;
            React.useEffect(() => {
                syncTasksEdgeToggleButtons(widgetId, edgesVisible);
            }, [widgetId, edgesVisible]);
            React.useEffect(() => {
                syncTasksHoverCardToggleButtons(widgetId, hoverCardsEnabled);
                logTasksDebug('hoverCardsState', { widgetId, egoMode, enabled: hoverCardsEnabled, mode: hoverCardMode });
            }, [widgetId, egoMode, hoverCardsEnabled, hoverCardMode]);
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
                    : clampTasksProjectionContentOpacity(sourcePrefsRef.current.unspecifiedContentOpacity)
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
            const edgeNodeLabels = React.useMemo(() => Object.fromEntries(
                [...(model?.groups || []), ...(model?.tasks || [])].map((node) => [String(node.id || ''), String(node.label || node.id || '')])
            ), [model]);
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
                const ordered = tasksOrderedEdges(visibleEdgesRef.current.length ? visibleEdgesRef.current : model?.dependency_edges || []);
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
            }, [activeContextId, edgeNodeLabels, model, resolveEdgeRecord, widgetId]);
            const edgeForOptionPointer = React.useCallback((event) => {
                const reactFlow = reactFlowApiRef.current;
                if (!reactFlow) return null;
                const point = reactFlow.screenToFlowPosition({ x: event.clientX, y: event.clientY });
                const graph = graphBaseRef.current || { nodes: [], edges: [] };
                let nodeId = selectedNodeIdRef.current || optionEdgeNodeIdRef.current;
                if (!nodeId) {
                    const hit = tasksGraphNodeAtFlowPoint(graph.nodes || [], point);
                    if (hit) nodeId = hit.node.data?.__kind__ === 'groupTitle'
                        ? (hit.node.data?.sourceGroupId || hit.node.id)
                        : hit.node.id;
                }
                if (!nodeId) return null;
                const edge = nearestTasksIncidentEdge(point, nodeId, graph.nodes || [], graph.edges || []);
                return edge ? { edge, nodeId } : null;
            }, []);
            const previewOptionEdge = React.useCallback((edge, nodeId) => {
                if (optionEdgePinnedRef.current) return;
                const edgeId = tasksEdgeRecordId(edge);
                if (!edgeId) return;
                optionEdgeNodeIdRef.current = nodeId;
                edgeCycleNodeIdRef.current = nodeId;
                selectedEdgeIdRef.current = edgeId;
                setSelectedEdgeId(edgeId);
                setSelectedEdgeRecord(resolveEdgeRecord(edge));
                setEdgeCardOpen(true);
                setEdgeCardField('');
                setEdgeCardError('');
                groupHoverTooltipRef.current = null;
                setGroupHoverTooltip(null);
                setEdgeStatus(`${edgeId}. Release Option to return to the node.`);
            }, [resolveEdgeRecord]);
            const clearOptionEdgePreview = React.useCallback(() => {
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
                const pinPreview = (event) => {
                    if (event.key !== 'Shift' || !event.altKey || event.repeat) return;
                    if (!optionEdgeNodeIdRef.current || !selectedEdgeIdRef.current) return;
                    optionEdgePinnedRef.current = true;
                    setEdgeStatus(`${selectedEdgeIdRef.current}. Edge details pinned.`);
                };
                const releasePreview = (event) => {
                    if (event.key === 'Alt') clearOptionEdgePreview();
                };
                window.addEventListener('keydown', pinPreview, true);
                window.addEventListener('keyup', releasePreview, true);
                window.addEventListener('blur', clearOptionEdgePreview);
                return () => {
                    window.removeEventListener('keydown', pinPreview, true);
                    window.removeEventListener('keyup', releasePreview, true);
                    window.removeEventListener('blur', clearOptionEdgePreview);
                };
            }, [clearOptionEdgePreview]);
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
            const lastPersistedProjectionIdRef = React.useRef(activeProjectionId);
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
                (model?.dependency_edges || [])
                    .map((edge) => resolveTasksEdgeLabel(edge, model, activeProjection))
                    .filter(Boolean)
            )).sort((a, b) => a.localeCompare(b)), [model, activeProjection]);
            const edgeTypeColors = React.useMemo(() => {
                const palette = tasksEdgeColorPaletteFor(model, model?.edge_color_by);
                const colors = {};
                for (const edge of model?.dependency_edges || []) {
                    const type = resolveTasksEdgeLabel(edge, model, activeProjection);
                    if (!type || colors[type]) continue;
                    colors[type] = resolveTasksEdgeColor(edge, model, model?.edge_color_by, palette) || 'currentColor';
                }
                return colors;
            }, [model, activeProjection]);
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
                        : (nextPrefs?.hoverCardsEnabled === false ? 'off' : (hoverCardRightRailSetting ? 'rightRail' : 'cursor'))));
                setEdgeOpacity(nextPrefs?.edgeOpacity !== undefined ? nextPrefs.edgeOpacity : (
                    sourcePrefsRef.current?.edgeOpacity === undefined ? defaultEdgeOpacity : clampTasksEdgeOpacity(sourcePrefsRef.current.edgeOpacity)
                ));
                setProjectionUnspecifiedContentOpacity(nextPrefs?.unspecifiedContentOpacity !== undefined ? nextPrefs.unspecifiedContentOpacity : (
                    sourcePrefsRef.current?.unspecifiedContentOpacity === undefined ? defaultProjectionUnspecifiedContentOpacity : clampTasksProjectionContentOpacity(sourcePrefsRef.current.unspecifiedContentOpacity)
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
                () => tasksCollectSearchMatches(graphBaseRef.current.nodes || [], graphBaseRef.current.edges || [], !egoMode && searchEnabled ? searchQuery : '', nodeNotes),
                [graphRevision, egoMode, searchEnabled, searchQuery, nodeNotes]
            );
            const filteredSelectionIds = React.useCallback(() => {
                const hasFilters = tasksFilterQueryHasRules(effectiveQueryFilters) || tasksFilterQueryHasRules(effectiveSwatchFilters);
                const hasEdgeFilters = effectiveEdgeTypes.length > 0;
                const hasSearch = searchMatches.active && !searchMatches.error;
                if (!hasFilters && !hasEdgeFilters && !hasSearch) return new Set();
                const edgeNodeIds = hasEdgeFilters
                    ? tasksEdgeFilterNodeIds(graphBaseRef.current.edges || [], effectiveEdgeTypes)
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
            }, [effectiveQueryFilters, effectiveSwatchFilters, effectiveEdgeTypes, searchMatches]);
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
            const currentHighlightedFitNodes = React.useCallback(() => {
                const selectedIds = currentSelectionIds();
                if (!selectedIds.size) return [];
                // Equal-z hit paths use paint order. Stable edge order makes the
                // overlap winner deterministic; keyboard cycling still reaches all edges.
                const baseEdges = tasksOrderedEdges(tasksEdgesMatchingTypes(graphBaseRef.current.edges || [], effectiveEdgeTypes));
                const fitIds = new Set(selectedIds);
                for (const selectedId of selectedIds) {
                    for (const descendantId of collectTasksGroupDescendantIds(selectedId, model)) fitIds.add(descendantId);
                }
                if (selectedNodeIdRef.current && selectedIds.has(selectedNodeIdRef.current)) {
                    const selectedScopeIds = new Set([selectedNodeIdRef.current, ...collectTasksGroupDescendantIds(selectedNodeIdRef.current, model)]);
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
            }, [currentSelectionIds, model, effectiveEdgeTypes]);
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
                reactFlow.fitView(matched.length
                    ? { nodes: matched, duration, padding: options.highlightPadding ?? 0.25, includeHiddenNodes: true }
                    : { duration, padding: options.padding ?? 0.2, includeHiddenNodes: true });
                return matched.length;
            }, [currentHighlightedFitNodes, tasksFitDebugPayload]);
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
                if (lastPersistedProjectionIdRef.current !== activeProjectionId) {
                    lastPersistedProjectionIdRef.current = activeProjectionId;
                    return;
                }
                const projectionKey = tasksProjectionPrefsKey(activeProjectionId);
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
                    slideNotes,
                });
                writeTasksCheckedNodeIds(sourceModel, checkedNodeIdsFromStates(nodeStates));
            }, [egoState, sourceModel, activeFilters, activeSwatchFilters, activeEdgeTypes, edgeTypeFilterEnabled, queryBuilderEnabled, searchEnabled, searchQuery, activeColorHierarchy, activeColorBy, activeProjectionId, filtersCollapsed, edgesVisible, hoverInactiveNodes, hoverCardsEnabled, hoverCardMode, edgeOpacity, projectionUnspecifiedContentOpacity, groupByEnabled, groupByHierarchy, groupByDisabledKeys, expanded, nodeStates, nodeNotes, slideNotes]);
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
                    setProjectionUnspecifiedContentOpacity(clampTasksProjectionContentOpacity(cfg.projectionUnspecifiedContentOpacity));
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
                if (viewMode === 'gantt' || String(activeProjectionId || '').trim()) return;
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
                setActiveProjectionId(available ? wanted : '');
                setViewMode('graph');
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
                const normalizedId = String(nodeId || '').trim();
                if (!normalizedId) return;
                setNodeNotes((current) => {
                    const next = { ...(current || {}) };
                    const text = String(note || '');
                    if (text.trim()) next[normalizedId] = text;
                    else delete next[normalizedId];
                    return next;
                });
            }, []);
            const updateSlideNote = React.useCallback((slideId, note) => {
                const normalizedId = String(slideId || '').trim();
                if (!normalizedId) return;
                setSlideNotes((current) => {
                    const next = { ...(current || {}) };
                    const text = String(note || '');
                    if (text.trim()) next[normalizedId] = text;
                    else delete next[normalizedId];
                    return next;
                });
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
                    showTasksToast(`Downloaded ${filename}`);
                } catch (error) {
                    window.alert(error instanceof Error ? error.message : String(error));
                }
            }, [sourceModel, latestNodeNotes, nodeStates, latestSlideNotes]);
            const handleCopyNodeNotes = React.useCallback(async () => {
                try {
                    const copied = await copyTasksText(buildTasksNodeNotesBackup(sourceModel, latestNodeNotes(), nodeStates, latestSlideNotes()).text);
                    if (!copied) throw new Error('Could not copy Knowledge Graph notes.');
                    showTasksToast('Copied notes');
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
                clearTasksGlobalToggle(TASKS_HOVER_CARD_MODE_KEY);
                setEdgesVisible(typeof defaults.edgesVisible === 'boolean' ? defaults.edgesVisible : true);
                setActivePulseEnabled(true);
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
            const ensureBaseLayout = React.useCallback(async () => {
                if (!baseLayoutRef.current) baseLayoutRef.current = await layoutBaseTasksGraph(rawGraph, model, jitterConfig, layoutConfig);
                return baseLayoutRef.current;
            }, [rawGraph, model, jitterConfig, layoutConfig]);
            const rebuildLayout = React.useCallback(async (expandedSet, mode = viewMode) => {
                const layoutStart = tasksPerfNow();
                const revisionKey = `${mode}|${String(model?.graph_id || '')}|${Array.from(expandedSet || []).sort().join(',')}`;
                const revisionCause = lastLayoutRevisionKeyRef.current === revisionKey ? 'visual' : 'layout';
                lastLayoutRevisionKeyRef.current = revisionKey;
                lastGraphRevisionCauseRef.current = revisionCause;
                logTasksColorDebug(model, rawGraph.nodes, activeColorBy, activeColorPalette, colorMix);
                if (mode === 'gantt') {
                    const edgeColorPalette = tasksEdgeColorPaletteFor(model, model?.edge_color_by);
                    const nodesWithStyle = rawGraph.nodes.map((node) => {
                        if (node.__kind__ === 'ganttHeader') {
                            return {
                                id: node.id,
                                type: 'vyasaTask',
                                position: node.position,
                                data: node,
                                style: { width: node.width, height: node.height, zIndex: 1, background: 'transparent', border: 'none', pointerEvents: 'none' },
                                zIndex: 1,
                                className: 'vyasa-tasks-node--passive',
                                draggable: false,
                                selectable: false,
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
                    const anchored = buildTaskEdgeAnchors(nodesWithStyle, rawGraph.edges);
                    const baseEdges = anchored.edges.map((edge) => {
                        const edgeColor = resolveTasksEdgeColor(edge, model, model?.edge_color_by, edgeColorPalette);
                        const resolvedLabel = resolveTasksEdgeLabel(edge, model, activeProjection);
                        return {
                            ...edge,
                            label: resolvedLabel,
                            type: 'vyasaEdge',
                            data: { ...(edge.data || {}), edgeColor },
                            markerEnd: { type: rf.MarkerType.ArrowClosed, width: 8, height: 8, color: edgeColor || 'currentColor' },
                            zIndex: TASKS_EDGE_Z,
                            labelStyle: { fontSize: hoverFontSize, fontWeight: 600, fill: edgeColor || TASKS_EDGE_LABEL_TEXT, opacity: edgeOpacity },
                            labelBgStyle: { fill: TASKS_EDGE_LABEL_BG, fillOpacity: 0.82 },
                            style: { strokeWidth: 2.5, opacity: edgeOpacity, stroke: edgeColor || 'currentColor' },
                        };
                    });
                    const anchoredNodes = nodesWithStyle.map((node) => ({ ...node, data: { ...node.data, handleLayout: anchored.nodeHandles[node.id] || { source: [], target: [] } } }));
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
                groupLayoutsRef.current = await layoutExpandedGroups(model, effectiveExpandedSet, jitterConfig, layoutConfig, true);
                const groupsDone = tasksPerfNow();
                const rootGroupIds = new Set(model.group_tree?.["null"] || []);
                const rootTaskIds = new Set(model.task_children?.["null"] || []);
                const rootNodeIds = new Set([...rootGroupIds, ...rootTaskIds]);
                const rootGraph = hasExplicitGroupDirection(model)
                    ? { ...buildProjectedRootTasksGraph(rawGraph, model), enforceRootRank: true }
                    : {
                        nodes: rawGraph.nodes.filter((node) => rootNodeIds.has(node.id)),
                        edges: (rawGraph.edges || []).filter((edge) => rootNodeIds.has(edge.source) && rootNodeIds.has(edge.target)),
                        enforceRootRank: false,
                    };
                const derived = await deriveSquishedExpandedLayout(rootGraph, model, effectiveExpandedSet, baseLayout, groupLayoutsRef.current, layoutConfig);
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
                    const titleHeight = sizeTaskNode(n.label || n.id, 'groupTitle', titleWidth, { hasImage: Boolean(titleImage) }).height;
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
                const anchored = buildTaskEdgeAnchors(baseNodes, derived.edges);
                const edgeColorPalette = tasksEdgeColorPaletteFor(model, model?.edge_color_by);
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
                        data: { ...(edge.data || {}), edgeColor, __projection_branch_opacity__: branchOpacity },
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
                            : (anchored.nodeHandles[node.id] || { source: [], target: [] }),
                        __debug_position__: showDebugPositions
                            ? { x: Math.round(absolutePosition(node).x), y: Math.round(absolutePosition(node).y) }
                            : undefined,
                    },
                }));
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
            }, [ensureBaseLayout, model, sourceModel, activeColorBy, activeColorPalette, activeColorLevelSpecs, activeProjection, viewMode, edgesVisible, edgeOpacity, projectionUnspecifiedContentOpacity, checkedNodeIdSet, nodeStates, nodeNotes, cardStates, defaultNodeColor]);
            const defaultEdgeOptions = React.useMemo(() => ({
                zIndex: TASKS_EDGE_Z,
                style: { strokeWidth: 2.5, opacity: edgeOpacity, stroke: 'currentColor' },
            }), [edgeOpacity]);
            // Highlight passes rebuild every node/edge object; route them through
            // tasksReuseGraphElements so unchanged elements keep their identity
            // (memoized components skip) and a no-op pass skips the update.
            const setNodesReusing = React.useCallback((nextNodes) => {
                setNodes((prev) => tasksReuseGraphElements(prev, nextNodes));
            }, []);
            const setEdgesReusing = React.useCallback((nextEdges) => {
                setEdges((prev) => tasksReuseGraphElements(prev, nextEdges));
            }, []);
            const applyHighlight = React.useCallback((nodeId, hoveredNodeId = null, selectedIds = new Set(), edgeId = '') => {
                const baseNodes = graphBaseRef.current.nodes || [];
                const baseEdges = tasksEdgesMatchingTypes(graphBaseRef.current.edges || [], effectiveEdgeTypes);
                const selectedEdge = edgeId ? baseEdges.find((edge) => tasksEdgeRecordId(edge) === edgeId) : null;
                if (selectedEdge) {
                    const endpointIds = new Set([selectedEdge.source, selectedEdge.target]);
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
                    setEdgesReusing(edgesVisible ? baseEdges.map((edge) => {
                        const hit = edge === selectedEdge;
                        const edgeColor = edge.data?.edgeColor || edge.style?.stroke || 'currentColor';
                        return {
                            ...edge,
                            zIndex: hit ? TASKS_EDGE_FOCUS_Z : TASKS_EDGE_Z,
                            data: { ...edge.data, highlightMode: hit ? 'selected' : 'dim', strokeMode: hit ? 'selected' : 'dim', edgeCardActive: hit },
                            labelStyle: { ...(edge.labelStyle || {}), fill: hit ? edgeColor : 'color-mix(in srgb, var(--vyasa-ink) 26%, transparent)', opacity: hit ? 1 : 0.12 },
                            labelBgStyle: { ...(edge.labelBgStyle || {}), fill: TASKS_EDGE_LABEL_BG, fillOpacity: hit ? 0.86 : 0.04 },
                            style: { ...edge.style, stroke: hit ? edgeColor : 'color-mix(in srgb, var(--vyasa-ink) 38%, transparent)', opacity: hit ? 1 : 0.08, strokeWidth: hit ? 4.5 : 2.5 },
                        };
                    }) : []);
                    return;
                }
                // When no single node is selected, hovering a node should still reveal
                // its checkbox. Carry it as a data flag (not the closure) so the
                // memoized node updates without forcing the per-hover remount.
                const hoverCheckboxId = !nodeId && hoveredNodeId ? hoveredNodeId : null;
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
                            if (edge.source === hoveredNodeId || edge.target === hoveredNodeId) {
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
                    setEdgesReusing(edgesVisible ? baseEdges.map((edge) => {
                        const touchesHover = Boolean(hoveredNodeId) && (edge.source === hoveredNodeId || edge.target === hoveredNodeId);
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
                                strokeMode: hit && touchesHover ? (edge.source === hoveredNodeId ? 'selected-out' : 'selected-in') : (hit ? 'selected' : 'dim'),
                                flareKey: `hover:${hoveredNodeId || ''}`,
                            },
                            labelStyle: { ...(edge.labelStyle || {}), fill: hit ? edgeColor : 'color-mix(in srgb, var(--vyasa-ink) 26%, transparent)', opacity: (hit ? tasksProminentEdgeOpacity() : tasksApplyEdgeOpacity(0.12, edgeOpacity)) * branchOpacity },
                            labelBgStyle: { ...(edge.labelBgStyle || {}), fill: TASKS_EDGE_LABEL_BG, fillOpacity: hit ? 0.82 : 0.06 },
                            style: { ...edge.style, stroke: hit ? edgeColor : 'color-mix(in srgb, var(--vyasa-ink) 38%, transparent)', opacity: tasksApplyEdgeOpacity(hit ? 0.98 : 0.08, edgeOpacity) * branchOpacity, strokeWidth: hit ? 4.5 : 2.5, strokeLinecap: hit ? 'round' : undefined, '--vyasa-edge-flow-duration': hit ? '0.7s' : '0.6s' },
                        };
                    }) : []);
                    return;
                }
                if (!hasNodeSelection) {
                    const hasFilters = tasksFilterQueryHasRules(effectiveQueryFilters) || tasksFilterQueryHasRules(effectiveSwatchFilters) || effectiveEdgeTypes.length > 0;
                    const hasSearch = searchMatches.active && !searchMatches.error;
                    if (!hasFilters && !hasSearch) {
                        const hoverEndpointIds = new Set(hoveredNodeId ? [hoveredNodeId] : []);
                        if (hoveredNodeId) {
                            for (const edge of baseEdges) {
                                if (edge.source === hoveredNodeId || edge.target === hoveredNodeId) {
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
                        setEdgesReusing(edgesVisible ? (hoveredNodeId
                            ? baseEdges.map((edge) => {
                                if (edge.source !== hoveredNodeId && edge.target !== hoveredNodeId) return edge;
                                return tasksHoverFocusEdge(edge, hoveredNodeId);
                            })
                            : baseEdges) : []);
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
                    setEdgesReusing(edgesVisible ? baseEdges.map((edge) => {
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
                    }) : []);
                    return;
                }
                const highlightedEdgeIds = new Set();
                const descendantIds = collectTasksGroupDescendantIds(nodeId, model);
                const selectedScopeIds = new Set([nodeId, ...descendantIds]);
                const directEndpointIds = new Set([nodeId, ...descendantIds]);
                const isFocusedPrimary = hoveredNodeId === nodeId;
                const isFocusedNeighbor = hoveredNodeId && hoveredNodeId !== nodeId;
                for (const edge of baseEdges) {
                    if (edge.source === nodeId || edge.target === nodeId) {
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
                        if (highlightedEdgeIds.has(edge.id) && (edge.source === nodeId || edge.target === nodeId)) {
                            focusedEdgeModes.set(edge.id, edge.source === nodeId ? 'focused-out' : 'focused-in');
                        }
                    }
                } else if (isFocusedNeighbor && directEndpointIds.has(hoveredNodeId)) {
                    for (const edge of baseEdges) {
                        const linksSelectedAndHovered =
                            (edge.source === nodeId && edge.target === hoveredNodeId) ||
                            (edge.source === hoveredNodeId && edge.target === nodeId);
                        if (linksSelectedAndHovered) focusedEdgeModes.set(edge.id, edge.source === nodeId ? 'focused-out' : 'focused-in');
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
                const nextEdges = baseEdges.map((edge) => {
                    const mode = focusedEdgeModes.get(edge.id)
                        ? focusedEdgeModes.get(edge.id)
                        : (highlightedEdgeIds.has(edge.id) ? 'selected' : 'dim');
                    const highlighted = mode !== 'dim';
                    const focused = mode === 'focused-in' || mode === 'focused-out';
                    const fixedFocusedLabel = Boolean(isFocusedNeighbor && focused);
                    const focusColor = mode === 'focused-in' ? TASKS_EDGE_FOCUS_IN_COLOR : TASKS_EDGE_FOCUS_OUT_COLOR;
                    const edgeColor = edge.data?.edgeColor || edge.style?.stroke || 'currentColor';
                    const branchOpacity = edge.data?.__projection_branch_opacity__ ?? 1;
                    const activeOpacity = highlighted ? 1 : branchOpacity;
                    const hoverDimsLabels = isTasksEdgeLabelHoverDimmingActive(nodeId, hoveredNodeId);
                    const strokeMode = mode === 'selected'
                        ? (edge.source === nodeId ? 'selected-out' : (edge.target === nodeId ? 'selected-in' : mode))
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
                setEdgesReusing(edgesVisible ? nextEdges : []);
            }, [effectiveQueryFilters, effectiveSwatchFilters, effectiveEdgeTypes, searchMatches, model, activeColorBy, activeColorPalette, activeColorLevelSpecs, expanded, edgesVisible, edgeOpacity, filteredSelectionIds]);
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
                if (!shouldAutoFitTasksOnExpand() && fitAction !== 'shortcut') return;
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
            const TasksProminentEdgeLabel = ({ labelX, labelY, labelZIndex, labelBgPadding, labelBgBorderRadius, labelMaxWidth, labelStyle, labelBgStyle, fullLabel, displayLabel }) => {
                const viewport = typeof rf.useViewport === 'function' ? rf.useViewport() : { zoom: 1 };
                const labelScale = tasksProminentEdgeLabelScale(viewport?.zoom, labelStyle.fontSize, TASKS_NODE_LABEL_FONT_SIZE, labelStyle.counterScaleMode === 'fixed');
                return React.createElement(rf.EdgeLabelRenderer, null,
                    React.createElement('div', {
                        style: {
                            position: 'absolute',
                            transform: `translate(${labelX}px, ${labelY}px)`,
                            pointerEvents: 'none',
                            zIndex: labelZIndex || TASKS_EDGE_LABEL_Z,
                        },
                        title: fullLabel,
                    },
                    React.createElement('div', {
                        style: {
                            transform: `translate(-50%, -50%) scale(${labelScale})`,
                            transformOrigin: 'center center',
                            padding: `${labelBgPadding?.[1] || 0}px ${labelBgPadding?.[0] || 0}px`,
                            borderRadius: `${labelBgBorderRadius || 0}px`,
                            position: 'relative',
                        },
                    },
                    React.createElement('div', {
                        style: {
                            position: 'absolute',
                            inset: 0,
                            borderRadius: 'inherit',
                            background: labelBgStyle.fill || 'transparent',
                            opacity: labelBgStyle.fillOpacity ?? 1,
                        },
                    }),
                    React.createElement('div', {
                        style: {
                            position: 'relative',
                            color: labelStyle.fill || TASKS_EDGE_LABEL_TEXT,
                            fontSize: tasksCssFontSize(labelStyle.fontSize),
                            fontWeight: labelStyle.fontWeight || 600,
                            whiteSpace: 'pre-line',
                            textAlign: 'center',
                            lineHeight: 1.35,
                            maxWidth: `${labelMaxWidth || 240}px`,
                            opacity: labelStyle.opacity ?? 1,
                        },
                    }, displayLabel)))
                );
            };
            const CustomEdge = React.memo((props) => {
                const [path, labelX, labelY] = tasksEdgePath(props);
                React.useEffect(() => {
                    traceTasksEdge('render', props, {
                        sourceX: props.sourceX,
                        sourceY: props.sourceY,
                        sourcePosition: props.sourcePosition,
                        targetX: props.targetX,
                        targetY: props.targetY,
                        targetPosition: props.targetPosition,
                    });
                }, [
                    props.source, props.target, props.sourceX, props.sourceY, props.sourcePosition,
                    props.targetX, props.targetY, props.targetPosition,
                ]);
                const fullLabel = String(props.label || '').replace(/\\n/g, '\n');
                const labelLines = fullLabel.split(/\r?\n/);
                const highlightMode = props.data?.highlightMode || 'none';
                const strokeMode = props.data?.strokeMode || highlightMode;
                const taperPath = tasksTaperedBezierPath(
                    path,
                    (Number(props.style?.strokeWidth) || 4) * 2.65,
                    Math.max(1.4, (Number(props.style?.strokeWidth) || 4) * 0.42)
                );
                const strokeWidth = Number(props.style?.strokeWidth) || 1.25;
                const flareActive = taperPath ? isTasksEdgeFlareActive(strokeMode) : false;
                const flareBox = flareActive ? tasksEdgeFlareBox(path, strokeWidth * 4) : null;
                const flareMaskId = `vyasa-tasks-edge-flare-${String(props.id || '').replace(/[^\w-]/g, '_')}`;
                const flareKey = `${props.data?.flareKey || ''}|${flareActive}`;
                const edgeArrowPath = tasksTaperedArrowHeadPath(
                    path,
                    Math.max(10, strokeWidth * 3.0)
                );
                const showFullLabel = isTasksEdgeLabelVisible(highlightMode, props.data?.hoverDimsLabels === true);
                const prominentLabel = showFullLabel;
                const displayLabel = showFullLabel
                    ? fullLabel
                    : (labelLines.length > 1 ? `${labelLines[0]}...` : fullLabel);
                const labelStyle = props.labelStyle || {};
                const labelBgStyle = props.labelBgStyle || {};
                const svgLabelLines = String(displayLabel || '').split(/\r?\n/);
                const svgFontSize = Number.parseFloat(tasksCssFontSize(labelStyle.fontSize));
                const svgLineHeight = (Number.isFinite(svgFontSize) ? svgFontSize : 11) * 1.35;
                const svgLabelHeight = Math.max(svgLineHeight, svgLabelLines.length * svgLineHeight);
                const svgLabelWidth = Math.min(
                    props.labelMaxWidth || 240,
                    Math.max(24, ...svgLabelLines.map((line) => line.length * (Number.isFinite(svgFontSize) ? svgFontSize : 11) * 0.62))
                );
                const svgLabelPaddingX = props.labelBgPadding?.[0] || 0;
                const svgLabelPaddingY = props.labelBgPadding?.[1] || 0;
                React.useEffect(() => {
                    if (!window.__vyasaTasksDebug.verbose || !displayLabel) return;
                    if (window.__vyasaTasksDebug.edgeLabelRenderCount >= 40) return;
                    window.__vyasaTasksDebug.edgeLabelRenderCount += 1;
                    const rootStyle = typeof getComputedStyle === 'function' ? getComputedStyle(document.documentElement) : null;
                    logTasksDebugVerbose('edgeLabelRender', {
                        label: fullLabel,
                        displayLabel,
                        highlightMode,
                        prominentLabel,
                        fill: labelStyle.fill || '',
                        bgFill: labelBgStyle.fill || '',
                        labelOpacity: labelStyle.opacity ?? null,
                        bgOpacity: labelBgStyle.fillOpacity ?? null,
                        fallbackInk: rootStyle?.getPropertyValue('--vyasa-ink')?.trim() || '',
                        paper: rootStyle?.getPropertyValue('--vyasa-paper')?.trim() || '',
                    });
                }, [displayLabel, fullLabel, highlightMode, prominentLabel, labelStyle.fill, labelStyle.opacity, labelBgStyle.fill, labelBgStyle.fillOpacity]);
                return React.createElement(React.Fragment, null,
                    React.createElement('path', {
                        d: path,
                        fill: 'none',
                        stroke: 'transparent',
                        strokeWidth: 24,
                        vectorEffect: 'non-scaling-stroke',
                        pointerEvents: 'stroke',
                        className: 'react-flow__edge-interaction vyasa-tasks-edge-hit-path',
                    }),
                    !taperPath && React.createElement(rf.BaseEdge, {
                        ...props,
                        path,
                        markerEnd: undefined,
                        style: {
                            ...(props.style || {}),
                            strokeLinejoin: 'round',
                            stroke: 'var(--vyasa-paper)',
                            strokeWidth: strokeWidth + 8,
                        },
                    }),
                    taperPath && React.createElement('path', {
                        d: taperPath,
                        fill: props.style?.stroke || 'currentColor',
                        stroke: 'var(--vyasa-paper)',
                        strokeWidth: 8,
                        paintOrder: 'stroke fill',
                        strokeLinejoin: 'round',
                        // While a flare sweeps, the ribbon underneath stays faint so
                        // the swept part reads as an opacity rise, then settles full.
                        opacity: (props.style?.opacity ?? 1) * (flareBox ? 0.3 : 1),
                        pointerEvents: 'none',
                    }),
                    props.data?.edgeCardActive && React.createElement('path', {
                        d: path,
                        fill: 'none',
                        stroke: props.style?.stroke || 'currentColor',
                        strokeWidth: strokeWidth + 6,
                        strokeOpacity: 0.22,
                        strokeLinecap: 'round',
                        strokeLinejoin: 'round',
                        vectorEffect: 'non-scaling-stroke',
                        pointerEvents: 'none',
                    }),
                    flareBox && React.createElement('g', { key: flareKey, pointerEvents: 'none' },
                        React.createElement('mask', {
                            id: flareMaskId,
                            maskUnits: 'userSpaceOnUse',
                            x: flareBox.x,
                            y: flareBox.y,
                            width: flareBox.width,
                            height: flareBox.height,
                        },
                        React.createElement('path', {
                            className: 'vyasa-tasks-edge-flare',
                            d: path,
                            pathLength: 1,
                            fill: 'none',
                            stroke: '#fff',
                            strokeWidth: Math.max(20, strokeWidth * 8),
                            strokeDasharray: '1 1',
                            style: { filter: 'blur(3px)' },
                        })),
                        React.createElement('path', {
                            d: taperPath,
                            mask: `url(#${flareMaskId})`,
                            fill: props.style?.stroke || 'currentColor',
                            opacity: props.style?.opacity ?? 1,
                        })),
                    React.createElement(rf.BaseEdge, {
                        ...props,
                        path,
                        markerEnd: undefined,
                        style: taperPath
                            ? { ...(props.style || {}), strokeWidth: 0.1 }
                            : props.style,
                    }),
                    edgeArrowPath && React.createElement('path', {
                        d: edgeArrowPath,
                        fill: props.style?.stroke || 'currentColor',
                        stroke: 'var(--vyasa-paper)',
                        strokeWidth: 8,
                        paintOrder: 'stroke fill',
                        strokeLinejoin: 'round',
                        opacity: props.style?.opacity ?? 1,
                        pointerEvents: 'none',
                    }),
                    displayLabel && !prominentLabel && React.createElement('g', {
                        transform: `translate(${labelX}, ${labelY})`,
                        pointerEvents: 'none',
                        className: showFullLabel ? 'vyasa-tasks-edge-label vyasa-tasks-edge-label--active' : 'vyasa-tasks-edge-label',
                    },
                    React.createElement('title', null, fullLabel),
                    (labelBgStyle.fillOpacity ?? 0) > 0 && React.createElement('rect', {
                        x: -(svgLabelWidth / 2) - svgLabelPaddingX,
                        y: -(svgLabelHeight / 2) - svgLabelPaddingY,
                        width: svgLabelWidth + (svgLabelPaddingX * 2),
                        height: svgLabelHeight + (svgLabelPaddingY * 2),
                        rx: props.labelBgBorderRadius || 0,
                        fill: labelBgStyle.fill || 'transparent',
                        opacity: labelBgStyle.fillOpacity ?? 1,
                    }),
                    React.createElement('text', {
                        fill: labelStyle.fill || TASKS_EDGE_LABEL_TEXT,
                        opacity: labelStyle.opacity ?? 1,
                        fontSize: tasksCssFontSize(labelStyle.fontSize),
                        fontWeight: labelStyle.fontWeight || 600,
                        textAnchor: 'middle',
                        dominantBaseline: 'middle',
                    }, svgLabelLines.map((line, index) => React.createElement('tspan', {
                        key: `${index}-${line}`,
                        x: 0,
                        dy: index === 0 ? -((svgLabelLines.length - 1) * svgLineHeight) / 2 : svgLineHeight,
                    }, line)))),
                    displayLabel && prominentLabel && React.createElement(TasksProminentEdgeLabel, {
                        labelX,
                        labelY,
                        labelZIndex: props.labelZIndex,
                        labelBgPadding: props.labelBgPadding,
                        labelBgBorderRadius: props.labelBgBorderRadius,
                        labelMaxWidth: props.labelMaxWidth,
                        labelStyle,
                        labelBgStyle,
                        fullLabel,
                        displayLabel,
                    })
                );
            });
            // renderTasksCustomNode closes over per-render state (expanded,
            // cardStates, model). It is re-created every render and published
            // through renderTasksCustomNodeRef so the registered CustomNode
            // component below can stay ONE identity forever - React Flow
            // remounts every node whenever a nodeTypes entry changes identity,
            // while a re-rendered node still reads current closures here.
            const renderTasksCustomNode = ({ data, id }) => {
                const handlePosition = (side) => ({
                    top: Position?.Top || 'top',
                    right: Position?.Right || 'right',
                    bottom: Position?.Bottom || 'bottom',
                    left: Position?.Left || 'left',
                }[side] || (Position?.Bottom || 'bottom'));
                const handleStyle = (handle) => (
                    handle.side === 'left' || handle.side === 'right'
                        ? { top: `${handle.offsetPct}%`, opacity: 0, pointerEvents: 'none' }
                        : { left: `${handle.offsetPct}%`, opacity: 0, pointerEvents: 'none' }
                );
                const renderHandles = (role) => (data?.handleLayout?.[role] || []).map((handle) => (
                    Handle && React.createElement(Handle, {
                        key: `${role}-${handle.id}`,
                        id: handle.id,
                        type: role,
                        position: handlePosition(handle.side),
                        style: handleStyle(handle),
                    })
                ));
                const highlightMode = data?.highlightMode || 'none';
                const isDimmed = highlightMode === 'dim';
                const sourceNodeId = data?.__kind__ === 'groupTitle' ? data?.sourceGroupId : id;
                const logicalNodeId = tasksLogicalNodeId(data, sourceNodeId);
                const reviewAttrs = {
                    'data-vyasa-review-target': JSON.stringify(tasksReviewTarget(data, id, widgetId)),
                    'data-vyasa-highlight-active': !['none', 'dim'].includes(highlightMode) ? 'true' : undefined,
                    'data-vyasa-hover-outline': data?.__hover_outline__ === true ? 'true' : undefined,
                };
                const isChecked = data?.__checked__ === true;
                const debugPosition = data?.__debug_position__;
                const taskStateLabel = String(data?.__card_state__ || (isChecked ? TASKS_DEFAULT_CARD_STATES[1] : TASKS_DEFAULT_CARD_STATES[0]));
                const taskStateColor = data?.__card_state_color__ || TASKS_DONE_ACCENT;
                // Derive selection/hover state from data.highlightMode rather than
                // closing over selectedNodeId/hoveredNodeId. Keeping nodeTypes stable
                // (see useMemo below) stops React Flow from remounting every node on
                // each hover, which was destroying the node DOM mid-click and
                // swallowing clicks (deselect / neighbor-activate never fired).
                const showCheckbox = highlightMode === 'selected' || highlightMode === 'selected-focus' || highlightMode === 'neighbor-focus' || data?.__hover_checkbox__ === true;
                const isActiveNode = highlightMode === 'none' || highlightMode === 'selected' || highlightMode === 'selected-focus';
                const linksInteractive = isActiveNode;
                const linkKinds = Array.from(tasksNodeLinkKinds(data));
                const nodeImage = normalizeTasksNodeImageUrl(data?.__node_image__);
                const nodeImageClassName = [
                    'vyasa-tasks-node-image',
                    tasksIsIconifyImage(nodeImage) ? 'vyasa-tasks-node-image--icon' : '',
                    isDimmed ? 'vyasa-tasks-node-image--dimmed' : '',
                ].filter(Boolean).join(' ');
                const renderNodeImage = (size = 26, style = {}) => nodeImage ? React.createElement('img', {
                    src: nodeImage,
                    alt: '',
                    loading: 'lazy',
                    draggable: false,
                    className: nodeImageClassName,
                    style: {
                        width: `${size}px`,
                        height: `${size}px`,
                        objectFit: 'contain',
                        flex: '0 0 auto',
                        opacity: isDimmed ? 0.58 : 0.96,
                        ...style,
                    },
                }) : null;
                const handleInactiveLinkClick = (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setSelectedNodeId(sourceNodeId);
                    setHoveredNodeId(null);
                };
                const handleSelectedNodeToggleCapture = (event) => {
                    if (event.defaultPrevented) return;
                    if (event.target?.closest?.('a, button, input, textarea, select, [data-vyasa-task-control="true"]')) return;
                    if (selectedNodeIdRef.current !== sourceNodeId || selectedNodeIdsRef.current.size !== 0) return;
                    event.preventDefault();
                    event.stopPropagation();
                    suppressNextGraphClickRef.current = true;
                    clearSelection('nodeBodyToggle');
                    window.setTimeout(() => {
                        suppressNextGraphClickRef.current = false;
                    }, 0);
                };
                if (data?.__kind__ === 'ganttHeader') {
                    return React.createElement('div', {
                        style: {
                            width: '100%',
                            height: '100%',
                            borderLeft: '1px solid color-mix(in srgb, var(--vyasa-ink) 14%, transparent)',
                            boxSizing: 'border-box',
                            color: 'color-mix(in srgb, var(--vyasa-ink) 62%, transparent)',
                            fontSize: '11px',
                            fontWeight: 700,
                            paddingTop: '4px',
                            textAlign: 'center',
                        },
                    }, data?.label || '');
                }
                if (data?.__kind__ === 'groupTitle') {
                    const handleCollapse = (e) => {
                        e.stopPropagation();
                        if (egoMode) return;
                        const next = new Set(expanded);
                        next.delete(data.sourceGroupId);
                        logTasksDebug('nodeCollapse', { nodeId: data.sourceGroupId, expanded: Array.from(next) });
                        setExpanded(next);
                    };
                    return React.createElement('div', {
                        ...reviewAttrs,
                        onClickCapture: handleSelectedNodeToggleCapture,
                        style: {
                            width: '100%', height: '100%',
	                            boxSizing: 'border-box',
	                            display: 'flex',
	                            alignItems: 'center',
	                            justifyContent: 'space-between',
	                            gap: '8px',
	                            padding: '6px 10px',
                            fontWeight: '600',
                            fontSize: '16px',
                            position: 'relative',
                        }
                    },
                        linkKinds.length ? renderTasksNodeLinkBadge(React, { right: '32px', kinds: linkKinds }) : null,
                        React.createElement('span', {
                            style: {
	                                minWidth: 0,
	                                overflow: 'hidden',
	                                display: 'flex',
	                                alignItems: 'center',
	                                gap: '7px',
                                whiteSpace: 'pre-line',
                                lineHeight: '1.28',
                                overflowWrap: 'anywhere',
                                wordBreak: 'break-word',
                            }
                        }, renderNodeImage(20, { marginTop: '1px' }), React.createElement('span', { style: { minWidth: 0 } }, renderTasksInlineLinks(data?.label || data.sourceGroupId || id, { interactive: linksInteractive, onInactiveClick: handleInactiveLinkClick, currentPath: sourceModel?.document_path || '' }))),
                        egoMode ? null : React.createElement('button', {
                            onClick: handleCollapse,
                            style: { flex: '0 0 auto', border: 'none', background: 'none', cursor: 'pointer', fontSize: '18px', opacity: '0.55', padding: '0' }
                        }, '−')
                    );
                }
                const isGroup = data?.__kind__ === 'group';
                const canExpand = tasksNodeHasChildren(id, model);
                const isExpanded = expanded.has(id);
                const labelContent = renderTasksInlineLinks(data?.label || id, { interactive: linksInteractive, onInactiveClick: handleInactiveLinkClick, currentPath: sourceModel?.document_path || '' });
                if (data?.__gantt) {
                    return React.createElement('div', {
                        ...reviewAttrs,
                        className: 'vyasa-task-node-body',
                        onClickCapture: handleSelectedNodeToggleCapture,
                        style: {
                            width: '100%',
                            height: '100%',
                            boxSizing: 'border-box',
                            display: 'grid',
                            gridTemplateColumns: '1fr auto',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '8px 12px',
                            fontSize: '12px',
                            fontWeight: 650,
                            opacity: isDimmed ? 0.22 : 1,
                            position: 'relative',
                        },
                    },
                        linkKinds.length ? renderTasksNodeLinkBadge(React, { kinds: linkKinds }) : null,
                        ...renderHandles('target'),
                        React.createElement('span', { style: { minWidth: 0, whiteSpace: 'normal', overflowWrap: 'anywhere', lineHeight: 1.25 } }, labelContent),
                        React.createElement('span', { style: { fontSize: '10px', opacity: 0.62, fontVariantNumeric: 'tabular-nums' } }, `${data.gantt_duration || 1}u`),
                        ...renderHandles('source')
                    );
                }
                const labelNode = React.createElement('span', {
                    onClick: linksInteractive ? undefined : handleInactiveLinkClick,
                    style: {
                        color: 'inherit',
                        textDecoration: isChecked ? 'line-through' : 'none',
                        textDecorationColor: isChecked ? taskStateColor : undefined,
                        textDecorationThickness: isChecked ? '1.8px' : undefined,
                    },
                }, labelContent);
                const checkboxControl = showCheckbox ? React.createElement('label', {
                    'data-vyasa-task-control': 'true',
                    onMouseDown: (event) => event.stopPropagation(),
                    onPointerDown: (event) => event.stopPropagation(),
                    onClick: (event) => event.stopPropagation(),
                    style: {
                        position: 'absolute',
                        left: '6px',
                        top: '6px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '16px',
                        height: '16px',
                        borderRadius: '5px',
                        border: `1px solid color-mix(in srgb, var(--vyasa-ink) 18%, ${taskStateColor} 24%)`,
                        background: isChecked
                            ? `color-mix(in srgb, var(--vyasa-paper) 70%, ${taskStateColor} 30%)`
                            : 'color-mix(in srgb, var(--vyasa-paper) 96%, transparent)',
                        boxShadow: isChecked ? `inset 0 0 0 1px color-mix(in srgb, ${taskStateColor} 20%, transparent)` : 'none',
                        cursor: 'pointer',
                        zIndex: 2,
                    },
                }, cardStates.length <= 2 ? React.createElement('input', {
                    type: 'checkbox',
                    checked: isChecked,
                    onMouseDown: (event) => event.stopPropagation(),
                    onPointerDown: (event) => event.stopPropagation(),
                    onChange: () => toggleCheckedNode(logicalNodeId),
                    style: { margin: 0, width: '10px', height: '10px', accentColor: taskStateColor, cursor: 'pointer' },
                }) : React.createElement('button', {
                    type: 'button',
                    title: `State: ${taskStateLabel}`,
                    onClick: () => toggleCheckedNode(logicalNodeId),
                    style: { border: 'none', background: 'transparent', padding: 0, width: '10px', height: '10px', cursor: 'pointer' },
                })) : null;
                const noteBadge = data?.__has_note__
                    ? renderTasksNodeLinkBadge(React, { kinds: ['note'], title: 'Has note', top: 'auto', bottom: '8px', right: canExpand ? '34px' : '8px' })
                    : null;
                const handleExpand = (e) => {
                    e.stopPropagation();
                    if (egoMode) return;
                    const next = new Set(expanded);
                    if (isExpanded) next.delete(id); else next.add(id);
                    logTasksDebug(isExpanded ? 'nodeCollapse' : 'nodeExpand', { nodeId: id, expanded: Array.from(next) });
                    setExpanded(next);
                };
                if (isExpanded) {
                    return React.createElement('div', {
                        ...reviewAttrs,
                        onClickCapture: handleSelectedNodeToggleCapture,
                        style: {
                            width: '100%', height: '100%',
                            boxSizing: 'border-box', display: 'flex', flexDirection: 'column', padding: '8px',
                            opacity: isDimmed ? 0.22 : 1,
                        }
                    },
                        checkboxControl,
                        noteBadge,
                        ...renderHandles('target'),
                        React.createElement('div', { style: { flex: 1, minHeight: '48px', position: 'relative' } }),
                        ...renderHandles('source')
                    );
                }
                return React.createElement('div', {
                    ...reviewAttrs,
                    className: 'vyasa-task-node-body',
                    onClickCapture: handleSelectedNodeToggleCapture,
                    style: {
                        width: '100%', height: '100%',
                        boxSizing: 'border-box',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: nodeImage ? '10px' : undefined,
                        fontSize: `${TASKS_NODE_LABEL_FONT_SIZE}px`,
                        fontWeight: '600',
                        fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                        textAlign: 'center',
                        padding: '10px 12px',
                        overflow: 'hidden',
                        opacity: isDimmed ? 0.22 : 1,
                        position: 'relative',
                        background: isChecked ? `linear-gradient(135deg, color-mix(in srgb, ${taskStateColor} 12%, transparent), transparent 55%)` : undefined,
                    }
                },
                    tasksColorOverlay(React, data?.__color_levels__, data?.width, data?.height),
                    checkboxControl,
                    noteBadge,
                    linkKinds.length ? renderTasksNodeLinkBadge(React, { right: canExpand ? '32px' : '10px', kinds: linkKinds }) : null,
                    ...renderHandles('target'),
                    renderNodeImage(isGroup ? 30 : 28),
                    React.createElement('span', {
                        style: {
                            boxSizing: 'border-box',
                            position: 'relative',
                            zIndex: 1,
                            flex: '1 1 auto',
                            minWidth: 0,
                            width: nodeImage ? 'auto' : '100%',
                            maxWidth: '100%',
                            overflow: 'hidden',
                            display: 'block',
                            whiteSpace: 'pre-line',
                            lineHeight: '1.28',
                            overflowWrap: 'anywhere',
                            wordBreak: 'break-word',
                            textDecoration: isChecked ? 'line-through' : 'none',
                            textDecorationColor: isChecked ? taskStateColor : undefined,
                            textDecorationThickness: isChecked ? '2px' : undefined,
                        }
                    }, labelNode),
                    canExpand && React.createElement('button', {
                        onClick: handleExpand,
                        'data-vyasa-task-control': 'true',
                        style: { position: 'absolute', right: '8px', top: '8px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '18px', opacity: '0.55', padding: '0' }
                    }, isExpanded ? '−' : '+'),
                    NodeToolbar && debugPosition && React.createElement(NodeToolbar, {
                        isVisible: true,
                        position: Position.Bottom,
                        offset: 8,
                    }, React.createElement('code', {
                        style: { padding: '3px 6px', borderRadius: '5px', background: 'var(--vyasa-paper)', border: '1px solid color-mix(in srgb, var(--vyasa-ink) 24%, transparent)', fontSize: '11px', whiteSpace: 'nowrap' },
                    }, `x ${debugPosition.x}, y ${debugPosition.y}`)),
                    ...renderHandles('source')
                );
            };
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
                        if (event.metaKey || event.ctrlKey || (event.altKey && !optionZoom)) return;
                        // A held key still has to reach the claim below, or the document
                        // shortcuts scroll the page under the graph on every repeat.
                        if (event.repeat && !TASKS_SHORTCUT_KEYS.has(key)) return;
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
                        if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(target.tagName))) return;
                        // Hovering never marks the widget active, so the shortcuts that
                        // act on what the cursor is over need their own way past this gate.
                        if (!widgetFocused
                            && !(key === 't' && groupToggleHoverIdRef.current)
                            && !(key === 'g' && hoveredNodeIdRef.current)) return;
                        // The document shortcuts in scripts.js bind J/K to scroll, C to
                        // fold and P to slides, and they preventDefault before this
                        // handler ever sees the key. So this handler listens in the
                        // capture phase and claims its own keys while the graph is
                        // focused, leaving every other key to the document.
                        if (TASKS_SHORTCUT_KEYS.has(key)) event.stopPropagation();
                        if (event.repeat) return;
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
                            const record = (model?.dependency_edges || []).find((edge) => tasksEdgeRecordId(edge) === selectedEdgeIdRef.current);
                            if (record) selectEdgeRecord(record, true, edgeCardField);
                            return;
                        }
                        if (key === 'f' && event.shiftKey) {
                            event.preventDefault();
                            window.openTasksFullscreen?.(widgetId);
                            return;
                        }
                        if (key === 'f') {
                            event.preventDefault();
                            fitCurrentHighlight(reactFlow, { reason: 'shortcut-f' });
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
                            // Plain G opens EG+, the everyday view; Shift+G drops the
                            // neighbours for plain EG.
                            const includeNeighbors = !event.shiftKey;
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
                        if (key === 'e') {
                            event.preventDefault();
                            setEdgesVisibleGlobal((current) => !current);
                            return;
                        }
                        if (key === 'c') {
                            event.preventDefault();
                            setHoverCardModeGlobal(nextTasksHoverCardMode);
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
                }, [reactFlow, currentSelectionIds, model, rawGraph, sourceModel, egoMode, helpOpen, edgeCardOpen, edgeCardField, selectEdgeRecord, setFiltersCollapsedGuarded, fitCurrentHighlight, panViewport, graphMinZoom]);
                return null;
            };
            const PanControls = () => {
                const reactFlow = rf.useReactFlow();
                const btn = { width: '32px', height: '32px', borderRadius: '8px', border: '1px solid color-mix(in srgb, currentColor 35%, transparent)', background: 'var(--vyasa-paper, #fff)', color: 'currentColor', fontSize: '16px', lineHeight: 1, cursor: 'pointer' };
                return React.createElement('div', { style: { position: 'absolute', right: '12px', bottom: '12px', display: 'grid', gridTemplateColumns: '32px 32px 32px', gap: '4px', zIndex: 20 } },
                    React.createElement('span'),
                    React.createElement('button', { type: 'button', onClick: () => panViewport(reactFlow, 0, 180), style: btn }, '↑'),
                    React.createElement('span'),
                    React.createElement('button', { type: 'button', onClick: () => panViewport(reactFlow, 180, 0), style: btn }, '←'),
                    React.createElement('button', { type: 'button', onClick: () => fitCurrentHighlight(reactFlow, { reason: 'pan-home' }), style: btn }, '⌂'),
                    React.createElement('button', { type: 'button', onClick: () => panViewport(reactFlow, -180, 0), style: btn }, '→'),
                    React.createElement('span'),
                    React.createElement('button', { type: 'button', onClick: () => panViewport(reactFlow, 0, -180), style: btn }, '↓'),
                    React.createElement('span')
                );
            };
            const SelectedNodePanel = () => {
                const selectedNode = (graphBaseRef.current.nodes || []).find((node) => node.id === selectedNodeId)?.data || null;
                const sourceNodeId = selectedNode?.__kind__ === 'groupTitle'
                    ? selectedNode.sourceGroupId
                    : tasksLogicalNodeId(selectedNode, selectedNode?.id);
                const baseEntries = selectedNode?.__kind__ === 'group'
                    ? tasksGroupDetailEntries(sourceNodeId, model)
                    : tasksNodeMetaEntries(selectedNode);
                if (!selectedNode) return null;
                const panelNodeId = sourceNodeId || selectedNode.id || '';
                const openDecisionEntry = tasksOpenDecisionEntry(selectedNode);
                const entries = openDecisionEntry ? [openDecisionEntry, ...baseEntries] : baseEntries;
                const panelWidth = tasksDetailPanelWidth({ title: selectedNode.label || selectedNode.id, nodeId: panelNodeId, entries });
                const panelLinkKinds = Array.from(tasksNodeLinkKinds(selectedNode));
                const panelHref = String(selectedNode?.href || '').trim();
                const copyPanelTitle = async (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    await copyTasksText(selectedNode.label || selectedNode.id);
                };
                return React.createElement('div', {
                    style: { width: `min(${panelWidth}px, 100%)`, maxWidth: '100%', minWidth: 'min(220px, 100%)', marginLeft: 'auto', boxSizing: 'border-box', borderRadius: '12px', border: '1px solid color-mix(in srgb, var(--vyasa-primary) 28%, transparent)', background: 'color-mix(in srgb, var(--vyasa-paper) 92%, transparent)', boxShadow: '0 10px 30px rgba(0,0,0,0.12)', backdropFilter: 'blur(8px)', padding: '12px', pointerEvents: 'auto', minHeight: 0, flex: '0 1 auto', overflowY: 'auto', overscrollBehavior: 'contain' },
                },
                    React.createElement('div', { style: { position: 'relative', paddingRight: panelLinkKinds.length ? '56px' : '28px', marginBottom: '10px' } },
                        panelLinkKinds.length ? renderTasksNodeLinkBadge(React, { kinds: panelLinkKinds, right: '0', top: '0' }) : null,
                        React.createElement('button', {
                            type: 'button',
                            title: 'Copy title',
                            'aria-label': 'Copy title',
                            'data-vyasa-task-control': 'true',
                            onClick: copyPanelTitle,
                            style: {
                                position: 'absolute',
                                top: '0',
                                right: panelLinkKinds.length ? '28px' : '0',
                                border: 'none',
                                background: 'none',
                                cursor: 'pointer',
                                fontSize: '12px',
                                lineHeight: 1,
                                opacity: 0.58,
                                padding: '0',
                            },
                        }, '⧉'),
                        React.createElement('div', { style: { display: 'grid', gridTemplateColumns: panelNodeId ? 'minmax(0, 1fr) minmax(0, 1fr)' : 'minmax(0, 1fr)', columnGap: '12px', alignItems: 'start' } },
                            React.createElement('div', { style: { fontSize: '14px', fontWeight: 700, lineHeight: 1.3, minWidth: 0, overflowWrap: 'anywhere', wordBreak: 'break-word' } },
                                renderTasksInlineLinks(selectedNode.label || selectedNode.id, { currentPath: sourceModel?.document_path || '' })
                            ),
                            panelNodeId ? React.createElement('div', { style: { fontSize: '12px', lineHeight: 1.3, fontWeight: 600, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace', opacity: 0.7, minWidth: 0, overflowWrap: 'anywhere', wordBreak: 'break-word', textAlign: 'right' } }, panelNodeId) : null,
                        ),
                        panelHref ? React.createElement('a', {
                            href: panelHref,
                            'data-vyasa-link-preview': tasksHrefSupportsPreview(panelHref) ? 'true' : undefined,
                            'data-vyasa-link-preview-current-path': sourceModel?.document_path || undefined,
                            onClick: (event) => openTasksNodeHref(panelHref, event),
                            style: { display: 'inline-block', marginTop: '6px', fontSize: '12px', lineHeight: 1.3, textDecoration: 'underline', textUnderlineOffset: '2px', color: 'inherit', overflowWrap: 'anywhere', wordBreak: 'break-word' },
                        }, panelHref) : null,
                    ),
                    renderTasksDetailEntries(React, entries, { copyValues: true, currentPath: sourceModel?.document_path || '' }),
                    React.createElement('div', { style: { display: 'flex', flexDirection: 'column', fontSize: '12px', lineHeight: 1.35 } },
                        React.createElement('label', {
                            style: {
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '6px',
                                paddingTop: entries.length ? '10px' : '0',
                                marginTop: entries.length ? '10px' : '0',
                                borderTop: entries.length ? '1px dashed color-mix(in srgb, currentColor 18%, transparent)' : 'none',
                            },
                        },
                            React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '6px' } },
                                React.createElement('span', { style: { fontWeight: 700, opacity: 0.7, flex: '1 1 auto' } }, 'Notes'),
                                clearedNote ? React.createElement('button', {
                                    type: 'button',
                                    'data-vyasa-task-control': 'true',
                                    onClick: (e) => { e.preventDefault(); setNoteInputValue(clearedNote); updateNodeNote(panelNodeId, clearedNote); setClearedNote(null); window.clearTimeout(clearedNoteTimerRef.current); },
                                    style: { border: 'none', background: 'none', cursor: 'pointer', fontSize: '11px', color: 'var(--vyasa-primary)', fontWeight: 600, padding: '0', lineHeight: 1, opacity: 0.85 },
                                }, 'Undo') : null,
                                noteInputValue.trim() ? React.createElement('button', {
                                    type: 'button',
                                    title: 'Clear note',
                                    'aria-label': 'Clear note',
                                    'data-vyasa-task-control': 'true',
                                    onClick: (e) => { e.preventDefault(); const prev = noteInputValue; setNoteInputValue(''); updateNodeNote(panelNodeId, ''); setClearedNote(prev); },
                                    style: { border: 'none', background: 'none', cursor: 'pointer', fontSize: '13px', color: 'inherit', padding: '0', lineHeight: 1, opacity: 0.45, display: 'flex', alignItems: 'center' },
                                }, '×') : null,
                            ),
                            renderTasksNoteTextarea(React, {
                                ref: noteTextareaRef,
                                value: noteInputValue,
                                onChange: (event) => setNoteInputValue(event.target.value),
                            })
                        )
                    )
                );
            };
            const SelectedEdgePanel = () => {
                if (!edgeCardOpen) return null;
                if (edgeCardError) return React.createElement('div', {
                    role: 'alert',
                    style: { width: `min(${nodeCardWidth}, 100%)`, marginLeft: 'auto', boxSizing: 'border-box', borderRadius: '12px', border: '1px solid color-mix(in srgb, #dc2626 45%, transparent)', background: 'color-mix(in srgb, var(--vyasa-paper) 92%, #dc2626 8%)', padding: '12px', pointerEvents: 'auto', fontSize: '12px', lineHeight: 1.45 },
                }, edgeCardError);
                if (!selectedEdgeRecord) return null;
                const sourceLabel = edgeNodeLabels[selectedEdgeRecord.source] || selectedEdgeRecord.source || '';
                const targetLabel = edgeNodeLabels[selectedEdgeRecord.target] || selectedEdgeRecord.target || '';
                const relation = selectedEdgeRecord.relation || selectedEdgeRecord.label || '';
                const entries = tasksEdgeMetaEntries(selectedEdgeRecord);
                const fitConnection = () => {
                    const reactFlow = reactFlowApiRef.current;
                    if (!reactFlow) return;
                    const endpointIds = new Set([selectedEdgeRecord.source, selectedEdgeRecord.target]);
                    const matched = (graphBaseRef.current.nodes || []).filter((node) => endpointIds.has(node.id));
                    if (matched.length) reactFlow.fitView({ nodes: matched, duration: 300, padding: 0.32, includeHiddenNodes: true });
                };
                return React.createElement('div', {
                    'data-vyasa-edge-card': selectedEdgeRecord.id,
                    style: { width: `min(${nodeCardWidth}, 100%)`, maxWidth: '100%', minWidth: 'min(260px, 100%)', marginLeft: 'auto', boxSizing: 'border-box', borderRadius: '12px', border: '2px solid color-mix(in srgb, var(--vyasa-primary) 76%, transparent)', background: 'color-mix(in srgb, var(--vyasa-paper) 94%, transparent)', boxShadow: '0 10px 30px rgba(0,0,0,0.12), 0 0 18px color-mix(in srgb, var(--vyasa-primary) 24%, transparent)', backdropFilter: 'blur(8px)', padding: '12px', pointerEvents: 'auto', minHeight: 0, maxHeight: '100%', overflowY: 'auto', overscrollBehavior: 'contain' },
                },
                    React.createElement('div', { style: { display: 'flex', alignItems: 'start', gap: '10px', marginBottom: '10px' } },
                        React.createElement('div', { style: { flex: '1 1 auto', minWidth: 0 } },
                            React.createElement('div', { style: { fontSize: '14px', fontWeight: 750, lineHeight: 1.4, overflowWrap: 'anywhere' } }, `${sourceLabel} —${relation}→ ${targetLabel}`),
                            React.createElement('div', { style: { marginTop: '4px', fontSize: '11px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace', opacity: 0.68, overflowWrap: 'anywhere' } }, selectedEdgeRecord.id),
                            sourceModel?.kg_context?.label ? React.createElement('div', { style: { marginTop: '3px', fontSize: '11px', opacity: 0.62 } }, sourceModel.kg_context.label) : null
                        ),
                        React.createElement('button', {
                            type: 'button', title: 'Close edge details', 'aria-label': 'Close edge details',
                            onClick: () => {
                                selectedEdgeIdRef.current = null;
                                optionEdgeNodeIdRef.current = '';
                                setSelectedEdgeId(null);
                                setSelectedEdgeRecord(null);
                                setEdgeCardOpen(false);
                                setEdgeCardField('');
                                setEdgeStatus('Edge details closed.');
                            },
                            style: { border: 0, background: 'transparent', color: 'inherit', cursor: 'pointer', fontSize: '18px', lineHeight: 1, padding: 0, opacity: 0.62 },
                        }, '×')
                    ),
                    renderTasksDetailEntries(React, entries, { copyValues: true, edgeFields: true, currentPath: sourceModel?.document_path || '' }),
                    React.createElement('button', {
                        type: 'button', onClick: fitConnection,
                        style: { marginTop: entries.length ? '12px' : 0, border: '1px solid color-mix(in srgb, currentColor 24%, transparent)', borderRadius: '8px', background: 'color-mix(in srgb, var(--vyasa-paper) 92%, transparent)', color: 'inherit', cursor: 'pointer', padding: '6px 9px', fontSize: '11px', fontWeight: 700 },
                    }, 'Fit connection')
                );
            };
            const FilterPanel = () => {
                if (egoMode || slideIndex >= 0) return null;
                const options = tasksFilterOptions(model);
                const colorOptions = tasksColorOptions(model, nodeNotes);
                const iconFilterGroups = tasksIconFilterGroups(model);
                const groupByOptions = tasksGroupByOptions(sourceModel);
                const activeProjectionOption = projectionOptions.find((projection) => (
                    viewMode === 'gantt'
                        ? projection.id === TASKS_GANTT_PROJECTION_ID
                        : projection.id === activeProjectionId
                )) || null;
                const customGroupingAvailable = viewMode !== 'gantt';
                const groupByControlsEnabled = customGroupingAvailable && groupByEnabled;
                const displayedGroupByHierarchy = customGroupingAvailable ? groupByHierarchy : [];
                const activeGroupByCount = groupByControlsEnabled ? activeGroupByHierarchy.length : 0;
                const groupByLevels = displayedGroupByHierarchy.filter(Boolean);
                if (customGroupingAvailable && groupByEnabled) groupByLevels.push('');
                if (!groupByLevels.length && viewMode !== 'gantt') groupByLevels.push('');
                const activeCount = (queryBuilderEnabled ? tasksCountFilterRules(activeFilters) : 0) + tasksCountFilterRules(activeSwatchFilters) + effectiveEdgeTypes.length + activeColorHierarchy.length + (searchMatches.active ? 1 : 0) + activeGroupByCount;
                const normalizedEdgeTypeQuery = edgeTypeQuery.trim().toLowerCase();
                const visibleEdgeTypeOptions = edgeTypeOptions.filter((type) => (
                    !normalizedEdgeTypeQuery || type.toLowerCase().includes(normalizedEdgeTypeQuery)
                ));
                const QueryBuilder = queryBuilderEnabled && queryBuilderReady ? window.VyasaTasksQueryBuilder?.QueryBuilder : null;
                const filterSectionStyle = { display: 'grid', gap: '8px', fontSize: '12px' };
                const filterInlineControlStyle = { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '12px', alignItems: 'start', minWidth: 0 };
                const filterKeyStyle = { fontWeight: 700, opacity: 0.7, lineHeight: 1.35 };
                const filterValueStackStyle = { display: 'grid', gap: '6px', minWidth: 0 };
                const filterChoiceListStyle = { display: 'grid', gap: '8px', minWidth: 0 };
                const filterChoiceStyle = { display: 'grid', gridTemplateColumns: '16px minmax(0, 1fr)', alignItems: 'center', columnGap: '10px', minWidth: 0 };
                const textQueryBuilderOperators = [
                    { name: 'notnull', label: 'attribute exists' },
                    { name: 'contains', label: 'has string' },
                    { name: 'doesNotContain', label: 'does not have string' },
                    { name: 'matchesRegex', label: 'regex matches' },
                    { name: '=', label: 'is exactly' },
                    { name: '!=', label: 'is not exactly' },
                ];
                const enumQueryBuilderOperators = [
                    { name: 'notnull', label: 'attribute exists' },
                    { name: '=', label: 'is' },
                    { name: '!=', label: 'is not' },
                    { name: 'in', label: 'is any of' },
                    { name: 'notIn', label: 'is none of' },
                    { name: 'contains', label: 'has string' },
                    { name: 'doesNotContain', label: 'does not have string' },
                    { name: 'matchesRegex', label: 'regex matches' },
                ];
                const queryBuilderFields = options.map((option) => ({
                    name: option.key,
                    label: option.label,
                    valueEditorType: tasksFilterValueEditorType,
                    values: (option.isBoolean ? ['true', 'false'] : option.values).map((value) => ({ name: value, label: value })),
                    operators: option.isText ? textQueryBuilderOperators : enumQueryBuilderOperators,
                }));
                const queryBuilderOperators = enumQueryBuilderOperators;
                const colorLevelSlots = activeColorHierarchy.length ? [...activeColorHierarchy] : [''];
                const remainingColorOptions = colorOptions.filter((option) => !activeColorHierarchy.includes(option.key));
                if (activeColorHierarchy.length && remainingColorOptions.length) colorLevelSlots.push('');
                const renderColorPalette = (colorBy) => {
                    if (!colorBy || colorBy === 'rank') return null;
                    const palette = tasksColorPaletteFor(model, colorBy);
                    const gradientStops = normalizeTasksGradientStops(palette);
                    const gradientDomain = tasksGradientDomain(palette, gradientStops);
                    const selectedValues = new Set(tasksFilterQuerySelectedValues(activeSwatchFilters, colorBy));
                    if (isTasksGradientPalette(palette)) {
                        return React.createElement('div', { style: { flexBasis: '100%', marginTop: '4px', padding: '8px', borderRadius: '8px', background: 'color-mix(in srgb, currentColor 4%, transparent)' } },
                            React.createElement('div', { style: { display: 'grid', gap: '6px', fontSize: '11px', lineHeight: 1.3, opacity: 0.85 } },
                                React.createElement('div', { style: {
                                    height: '12px',
                                    borderRadius: '999px',
                                    border: '1px solid color-mix(in srgb, currentColor 12%, transparent)',
                                    background: `linear-gradient(90deg, ${gradientStops.map((stop) => {
                                        const start = gradientDomain?.start ?? gradientStops[0]?.at ?? 0;
                                        const end = gradientDomain?.end ?? gradientStops[gradientStops.length - 1]?.at ?? 1;
                                        const span = Math.max(end - start, 1);
                                        return `${tasksDisplayPaletteColor(stop.color)} ${((stop.at - start) / span) * 100}%`;
                                    }).join(', ')})`,
                                } }),
                                React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' } },
                                    ...gradientStops.map((stop, index) => React.createElement('span', { key: `${colorBy}-stop-${index}` }, stop.label || (Number.isInteger(stop.at) ? `${stop.at}` : `${stop.at}`)))
                                )
                            )
                        );
                    }
                    const entries = tasksColorPaletteEntries(model, colorBy, nodeNotes);
                    if (!entries.length) return null;
                    return React.createElement('div', { style: { flexBasis: '100%', marginTop: '4px', padding: '8px', borderRadius: '8px', background: 'color-mix(in srgb, currentColor 4%, transparent)' } },
                        React.createElement('div', { style: { display: 'grid', gap: '4px', fontSize: '11px', lineHeight: 1.3, opacity: 0.8 } },
                            ...entries.map(([value, color]) => {
                                const displayColor = tasksDisplayPaletteColor(color);
                                const selected = selectedValues.has(value);
                                return React.createElement('button', {
                                    key: `${colorBy}-${value}-label`,
                                    type: 'button',
                                    'aria-pressed': selected,
                                    onClick: () => toggleFilterValue(colorBy, value, !selected),
                                    style: {
                                        display: 'grid',
                                        gridTemplateColumns: '12px 1fr',
                                        alignItems: 'center',
                                        gap: '6px',
                                        width: '100%',
                                        padding: '4px 6px',
                                        borderRadius: '6px',
                                        border: selected ? `1px solid ${displayColor}` : '1px solid transparent',
                                        background: selected ? `color-mix(in srgb, ${displayColor} 16%, transparent)` : 'transparent',
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                        color: 'inherit',
                                    },
                                },
                                React.createElement('span', { style: { width: '12px', height: '12px', borderRadius: '999px', background: displayColor, border: '1px solid color-mix(in srgb, currentColor 20%, transparent)' } }),
                                React.createElement('span', null, value));
                            })
                        )
                    );
                };
                const renderColorLevel = (colorBy, index) => {
                    const usedBefore = new Set(activeColorHierarchy.slice(0, index));
                    const selectableColorOptions = colorOptions
                        .filter((option) => option.key === colorBy || !usedBefore.has(option.key))
                        .map((option) => ({ key: option.key, label: option.label, special: option.special }));
                    const normalColorOptions = selectableColorOptions.filter((option) => !option.special);
                    const specialColorOptions = selectableColorOptions.filter((option) => option.special);
                    const renderColorOption = (option) => React.createElement('option', { key: option.key || '__none__', value: option.key }, option.label);
                    const draggable = Boolean(colorBy);
                    return React.createElement('div', { key: `color-level-${index}`, style: { ...filterSectionStyle, marginBottom: '12px', paddingBottom: '10px', borderBottom: '1px solid color-mix(in srgb, currentColor 12%, transparent)' } },
                        React.createElement('span', { style: filterKeyStyle }, index === 0 ? 'Color by' : `Color ${index + 1}`),
                        React.createElement('div', { style: filterValueStackStyle },
                            React.createElement('div', {
                                onDragOver: (event) => {
                                    if (!draggable || !Array.from(event.dataTransfer.types || []).includes('text/x-vyasa-color-level')) return;
                                    event.preventDefault();
                                    event.dataTransfer.dropEffect = 'move';
                                },
                                onDrop: (event) => {
                                    const from = Number.parseInt(event.dataTransfer.getData('text/x-vyasa-color-level'), 10);
                                    if (Number.isInteger(from)) {
                                        event.preventDefault();
                                        reorderActiveColorLevel(from, index);
                                    }
                                },
                                style: { display: 'flex', gap: '6px', alignItems: 'center' },
                            },
                                React.createElement('span', {
                                    draggable,
                                    title: 'Drag to reorder',
                                    'aria-label': 'Drag to reorder color level',
                                    onDragStart: (event) => {
                                        if (!draggable) return;
                                        event.dataTransfer.setData('text/x-vyasa-color-level', String(index));
                                        event.dataTransfer.effectAllowed = 'move';
                                    },
                                    style: { flex: '0 0 auto', cursor: draggable ? 'grab' : 'default', opacity: draggable ? 0.7 : 0.25, fontWeight: 700, letterSpacing: '0.04em', userSelect: 'none' },
                                }, '::'),
                                React.createElement('select', {
                                    value: colorBy || '',
                                    onChange: (event) => setActiveColorLevel(index, event.target.value),
                                    style: {
                                        flex: '1 1 auto',
                                        minWidth: 0,
                                        border: '1px solid color-mix(in srgb, currentColor 16%, transparent)',
                                        borderRadius: '8px',
                                        padding: '6px 8px',
                                        background: 'color-mix(in srgb, var(--vyasa-paper) 96%, transparent)',
                                        color: 'inherit',
                                    },
                                },
                                renderColorOption({ key: '', label: 'None' }),
                                ...normalColorOptions.map(renderColorOption),
                                specialColorOptions.length
                                    ? React.createElement('option', { key: '__special_color_modes__', value: '__special_color_modes__', disabled: true }, '---')
                                    : null,
                                ...specialColorOptions.map(renderColorOption)),
                                colorBy ? React.createElement('button', {
                                    type: 'button',
                                    title: 'Remove this color level',
                                    'aria-label': 'Remove this color level',
                                    onClick: () => setActiveColorLevel(index, ''),
                                    style: {
                                        flex: '0 0 auto',
                                        border: '1px solid color-mix(in srgb, currentColor 16%, transparent)',
                                        borderRadius: '8px',
                                        padding: '6px 9px',
                                        background: 'color-mix(in srgb, var(--vyasa-paper) 96%, transparent)',
                                        color: 'inherit',
                                        cursor: 'pointer',
                                        lineHeight: 1,
                                    },
                                }, '×') : null
                            ),
                            renderColorPalette(colorBy)
                        )
                    );
                };
                const renderIconFilterGroup = (group) => {
                    const selectedValues = new Set(tasksFilterQuerySelectedValues(activeSwatchFilters, group.key));
                    return React.createElement('details', {
                        key: `icon-filter-${group.key}`,
                        className: 'vyasa-tasks-icon-filter-group',
                    },
                        React.createElement('summary', null,
                            React.createElement('span', null, `${tasksNodeMetaLabel(group.key)} icons`),
                            selectedValues.size ? React.createElement('span', { className: 'vyasa-tasks-icon-filter-count' }, String(selectedValues.size)) : null
                        ),
                        React.createElement('div', {
                            style: {
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(34px, 1fr))',
                                gap: '8px',
                                alignItems: 'center',
                            },
                        },
                            ...group.entries.map(([value, image]) => {
                                const selected = selectedValues.has(value);
                                return React.createElement('button', {
                                    key: `${group.key}-${value}`,
                                    type: 'button',
                                    className: 'vyasa-tasks-icon-filter-button',
                                    'aria-label': `${tasksNodeMetaLabel(group.key)}: ${value}`,
                                    'aria-pressed': selected,
                                    onClick: () => toggleFilterValue(group.key, value, !selected),
                                    style: {
                                        width: '34px',
                                        height: '34px',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        borderRadius: '8px',
                                        border: selected ? '1px solid var(--vyasa-primary)' : '1px solid color-mix(in srgb, currentColor 14%, transparent)',
                                        background: selected ? 'color-mix(in srgb, var(--vyasa-primary) 14%, transparent)' : 'color-mix(in srgb, var(--vyasa-paper) 96%, transparent)',
                                        color: 'inherit',
                                        cursor: 'pointer',
                                        padding: '6px',
                                    },
                                },
                                React.createElement('span', { className: 'vyasa-tasks-icon-filter-glyph', 'aria-hidden': 'true', style: { '--vyasa-tasks-icon-url': `url("${image}")` } }),
                                React.createElement('span', { className: 'vyasa-tasks-icon-filter-tooltip', role: 'tooltip' }, value));
                            })
                        )
                    );
                };
                const renderIconFilters = () => {
                    if (!iconFilterGroups.length) return null;
                    const selectedIconCount = iconFilterGroups.reduce((count, group) => count + tasksFilterQuerySelectedValues(activeSwatchFilters, group.key).length, 0);
                    return React.createElement('details', {
                        className: 'vyasa-tasks-icon-filter-section',
                        style: { ...filterSectionStyle, marginBottom: '12px', paddingBottom: '10px', borderBottom: '1px solid color-mix(in srgb, currentColor 12%, transparent)' },
                    },
                        React.createElement('summary', null,
                            React.createElement('span', null, 'Icons'),
                            selectedIconCount ? React.createElement('span', { className: 'vyasa-tasks-icon-filter-count' }, String(selectedIconCount)) : null
                        ),
                        React.createElement('div', { className: 'vyasa-tasks-icon-filter-groups' },
                            ...iconFilterGroups.map(renderIconFilterGroup)
                        )
                    );
                };
                const QueryValueEditor = (props) => {
                    const values = Array.isArray(props.values) ? props.values : [];
                    const optionValue = (option) => String(option.value ?? option.name ?? '');
                    const optionLabel = (option) => String(option.label ?? option.name ?? option.value ?? '');
                    if (props.operator === 'notnull' || props.operator === 'null') return null;
                    if (props.operator === 'contains' || props.operator === 'doesNotContain' || props.operator === 'matchesRegex') {
                        return React.createElement('input', {
                            type: 'text',
                            value: Array.isArray(props.value) ? props.value.join(', ') : String(props.value ?? ''),
                            onChange: (event) => props.handleOnChange(event.target.value),
                            placeholder: props.operator === 'matchesRegex' ? 'Regex' : 'Text to match',
                            className: props.className,
                        });
                    }
                    if (props.operator === 'in' || props.operator === 'notIn') {
                        const selected = new Set(tasksFilterValueList(props.value));
                        return React.createElement('div', { className: `${props.className || ''} vyasa-tasks-query-values` },
                            values.map((option) => {
                                const value = optionValue(option);
                                return React.createElement('label', { key: value, className: 'vyasa-tasks-query-value-option' },
                                    React.createElement('input', {
                                        type: 'checkbox',
                                        checked: selected.has(value),
                                        onChange: (event) => {
                                            const next = new Set(selected);
                                            if (event.target.checked) next.add(value); else next.delete(value);
                                            props.handleOnChange(Array.from(next));
                                        },
                                    }),
                                    React.createElement('span', null, optionLabel(option))
                                );
                            })
                        );
                    }
                    return React.createElement('select', {
                        value: Array.isArray(props.value) ? String(props.value[0] ?? '') : String(props.value ?? ''),
                        onChange: (event) => props.handleOnChange(event.target.value),
                        className: props.className,
                    },
                        React.createElement('option', { value: '' }, 'Choose value'),
                        values.map((option) => React.createElement('option', { key: optionValue(option), value: optionValue(option) }, optionLabel(option)))
                    );
                };
                const QueryMuteToggle = (props) => React.createElement('label', {
                    className: props.className,
                    title: props.title,
                    style: { display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', opacity: props.disabled ? 0.5 : 0.82, cursor: props.disabled ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' },
                },
                React.createElement('input', {
                    type: 'checkbox',
                    checked: !props.ruleOrGroup?.muted,
                    disabled: props.disabled,
                    onChange: (event) => props.handleOnClick?.(event),
                }),
                React.createElement('span', null, 'Active'));
                const isOpen = !filtersCollapsed;
                const filterPanelWidth = `min(${TASKS_FILTER_PANEL_WIDTH}px, calc(100% - 24px))`;
                return React.createElement('aside', {
                    'aria-hidden': !isOpen,
                    style: {
                        flex: isOpen ? `0 0 ${filterPanelWidth}` : '0 0 0px',
                        width: isOpen ? filterPanelWidth : '0px',
                        minWidth: 0,
                        maxWidth: isOpen ? 'calc(100% - 24px)' : '0px',
                        height: '100%',
                        overflow: 'hidden',
                        pointerEvents: isOpen ? 'auto' : 'none',
                        transition: 'flex-basis 180ms ease, width 180ms ease',
                    },
                },
                    React.createElement('div', {
                        ref: filterPanelRef,
                        className: 'vyasa-tasks-filter-card',
                        style: {
                            width: '100%',
                            maxWidth: '100%',
                            maxHeight: filterPanelMaxHeight,
                            overflowX: 'hidden',
                            overflowY: 'auto',
                            borderRadius: '0 8px 8px 8px',
                            background: 'color-mix(in srgb, var(--vyasa-paper) 92%, transparent)',
                            backdropFilter: 'blur(8px)',
                            padding: '12px',
                            boxSizing: 'border-box',
                            opacity: isOpen ? 1 : 0,
                            visibility: isOpen ? 'visible' : 'hidden',
                            transition: 'opacity 120ms ease',
                        },
                    },
                    React.createElement('div', {
                        style: {
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '8px',
                            position: 'sticky',
                            top: '-12px',
                            margin: '-12px -12px 0',
                            padding: '12px',
                            background: 'color-mix(in srgb, var(--vyasa-paper) 92%, transparent)',
                            backdropFilter: 'blur(8px)',
                            zIndex: 1,
                        },
                    },
                        React.createElement('div', { style: { fontSize: '12px', fontWeight: 700, opacity: 0.65, textTransform: 'uppercase', letterSpacing: '0.04em' } }, activeCount ? `Filters (${activeCount})` : 'Filters'),
                        React.createElement('div', { style: { display: 'inline-flex', alignItems: 'center', gap: '8px' } },
                            React.createElement('button', { type: 'button', onClick: resetProjectionControls, style: { border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: '12px', textDecoration: 'underline', whiteSpace: 'nowrap', color: 'inherit' } }, 'Reset'),
                            React.createElement('button', { type: 'button', onClick: () => setFiltersCollapsedGuarded(true, 'close-filter-panel'), style: { border: 'none', background: 'none', cursor: 'pointer', padding: '2px 4px', fontSize: '14px', lineHeight: 1, color: 'inherit', opacity: 0.7 } }, '×')
                        )
                    ),
                    React.createElement('div', {
                        style: {
                            marginTop: '12px',
                            paddingRight: '2px',
                            paddingBottom: '2px',
                        },
                    },
                        contextOptions.length > 1 ? React.createElement('div', { style: { ...filterSectionStyle, marginBottom: '12px', paddingBottom: '10px', borderBottom: '1px solid color-mix(in srgb, currentColor 12%, transparent)' } },
                            React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' } },
                                React.createElement('span', { style: filterKeyStyle }, 'Context'),
                                React.createElement('label', {
                                    className: 'vyasa-tasks-toggle-label',
                                    title: activeContextIndex <= 0 ? 'The first context has no previous context' : 'Glow changes from previous context',
                                    style: { fontSize: '11px', fontWeight: 650 },
                                },
                                    React.createElement('input', {
                                        type: 'checkbox',
                                        className: 'vyasa-tasks-switch-input',
                                        'aria-label': 'Select changes from previous context',
                                        checked: contextDiffEnabled && activeContextIndex > 0,
                                        disabled: contextLoading || contextDiffLoading || activeContextIndex <= 0,
                                        onChange: (event) => setContextDiffEnabled(event.target.checked),
                                    }),
                                    React.createElement('span', { className: 'vyasa-tasks-switch-track', 'aria-hidden': 'true' }),
                                    React.createElement('span', null, contextDiffLoading ? 'Loading' : 'Diff')
                                )
                            ),
                            (() => {
                                const ctxIndex = activeContextIndex;
                                const ctxNavBtn = (disabled) => ({ flex: '0 0 34px', width: '34px', height: '34px', border: '1px solid color-mix(in srgb, var(--vyasa-primary) 24%, transparent)', background: 'color-mix(in srgb, var(--vyasa-paper) 88%, transparent)', color: 'inherit', borderRadius: '8px', padding: 0, fontSize: '18px', lineHeight: 1, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.4 : 1 });
                                const goContext = (delta) => {
                                    const target = contextOptions[ctxIndex + delta];
                                    if (target) handleSwitchContext(target.id);
                                };
                                const prevDisabled = contextLoading || ctxIndex <= 0;
                                const nextDisabled = contextLoading || ctxIndex < 0 || ctxIndex >= contextOptions.length - 1;
                                return React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 } },
                                    React.createElement('button', { type: 'button', 'aria-label': 'Previous context', onClick: () => goContext(-1), disabled: prevDisabled, style: ctxNavBtn(prevDisabled) }, '‹'),
                                    React.createElement('select', {
                                            value: activeContextId,
                                            disabled: contextLoading,
                                            onChange: (event) => handleSwitchContext(event.target.value),
                                            style: {
                                                flex: '1 1 auto',
                                                width: '100%',
                                                minWidth: 0,
                                                border: '1px solid color-mix(in srgb, currentColor 16%, transparent)',
                                                borderRadius: '8px',
                                                padding: '6px 8px',
                                                background: 'color-mix(in srgb, var(--vyasa-paper) 96%, transparent)',
                                                color: 'inherit',
                                            },
                                        },
                                            ...contextOptions.map((context) => React.createElement(
                                                'option',
                                                { key: context.id, value: context.id },
                                                `${context.seq}. ${context.label || context.caption || context.id}`
                                            ))
                                        ),
                                    React.createElement('button', { type: 'button', 'aria-label': 'Next context', onClick: () => goContext(1), disabled: nextDisabled, style: ctxNavBtn(nextDisabled) }, '›')
                                );
                            })(),
                            sourceModel?.kg_context?.caption ? React.createElement('div', {
                                style: {
                                    padding: '9px 10px',
                                    borderRadius: '8px',
                                    border: '1px solid color-mix(in srgb, currentColor 10%, transparent)',
                                    background: 'color-mix(in srgb, var(--vyasa-paper) 97%, transparent)',
                                    fontSize: '11px',
                                    lineHeight: 1.45,
                                    opacity: 0.82,
                                },
                            }, sourceModel.kg_context.caption) : null
                        ) : null,
                        aclViewerOptions.length ? React.createElement('div', { style: { ...filterSectionStyle, marginBottom: '12px', paddingBottom: '10px', borderBottom: '1px solid color-mix(in srgb, currentColor 12%, transparent)' } },
                            React.createElement('span', { style: filterKeyStyle }, 'Viewer'),
                            React.createElement('select', {
                                value: activeAclViewer,
                                onChange: (event) => {
                                    setActiveAclViewer(event.target.value);
                                    setSelectedNodeId(null);
                                    setSelectedNodeIds(new Set());
                                    setDragSelection(null);
                                    setHoveredNodeId(null);
                                    pendingFitActionRef.current = 'mode';
                                },
                                style: {
                                    width: '100%',
                                    minWidth: 0,
                                    border: '1px solid color-mix(in srgb, currentColor 16%, transparent)',
                                    borderRadius: '8px',
                                    padding: '6px 8px',
                                    background: 'color-mix(in srgb, var(--vyasa-paper) 96%, transparent)',
                                    color: 'inherit',
                                },
                            },
                                React.createElement('option', { value: '' }, 'All'),
                                ...aclViewerOptions.map((viewer) => React.createElement('option', { key: viewer.id, value: viewer.id }, viewer.label))
                            )
                        ) : null,
                        projectionOptions.length >= 1 ? React.createElement('div', { style: { ...filterSectionStyle, marginBottom: '12px', paddingBottom: '10px', borderBottom: '1px solid color-mix(in srgb, currentColor 12%, transparent)' } },
                            React.createElement('span', { style: filterKeyStyle }, 'View'),
                            React.createElement('div', { style: filterInlineControlStyle },
                                React.createElement('select', {
                                    value: viewMode === 'gantt' ? TASKS_GANTT_PROJECTION_ID : activeProjectionId,
                                    onPaste: handleDefaultViewPaste,
                                    onChange: async (event) => {
                                        const nextProjectionId = event.target.value;
                                        if (nextProjectionId === TASKS_ADD_VIEW_OPTION_ID) {
                                            await handleAddView();
                                            return;
                                        }
                                        setSelectedNodeId(null);
                                        setSelectedNodeIds(new Set());
                                        setDragSelection(null);
                                        setHoveredNodeId(null);
                                        if (nextProjectionId === TASKS_GANTT_PROJECTION_ID) setViewMode('gantt');
                                        else {
                                            setActiveProjectionId(nextProjectionId);
                                            setViewMode('graph');
                                        }
                                        pendingFitActionRef.current = 'mode';
                                    },
                                    style: {
                                        width: '100%',
                                        minWidth: 0,
                                        border: '1px solid color-mix(in srgb, currentColor 16%, transparent)',
                                        borderRadius: '8px',
                                        padding: '6px 8px',
                                        background: 'color-mix(in srgb, var(--vyasa-paper) 96%, transparent)',
                                        color: 'inherit',
                                    },
                                },
                                    ...projectionOptions.map((projection) => React.createElement('option', { key: projection.id || '__default__', value: projection.id }, projection.label)),
                                    React.createElement('option', { key: TASKS_ADD_VIEW_OPTION_ID, value: TASKS_ADD_VIEW_OPTION_ID }, '+ Add view...')
                                ),
                                activeProjectionOption && activeProjectionOption.id !== TASKS_GANTT_PROJECTION_ID
                                    ? React.createElement('button', {
                                        type: 'button',
                                        title: sourceModel?.kg_context?.id
                                            ? 'Copy this view as an @views entry for this context'
                                            : 'Copy this view as a kg.schema @views entry',
                                        onClick: async (event) => {
                                            const button = event.currentTarget;
                                            const ok = await copyTasksText(buildProjectionConfigText(activeProjectionOption));
                                            const prev = button.textContent;
                                            button.textContent = ok ? '✓' : '✕';
                                            window.setTimeout(() => { button.textContent = prev; }, 1200);
                                        },
                                        style: {
                                            border: '1px solid color-mix(in srgb, currentColor 16%, transparent)',
                                            borderRadius: '8px',
                                            padding: '6px 8px',
                                            background: 'color-mix(in srgb, var(--vyasa-paper) 96%, transparent)',
                                            color: 'inherit',
                                            cursor: 'pointer',
                                            fontSize: '12px',
                                            lineHeight: 1,
                                        },
                                    }, '⧉')
                                    : React.createElement('span', { style: { width: '30px', height: '1px' } })
                            ),
                            activeProjectionOption && activeProjectionOption.caption
                                ? React.createElement('div', {
                                    style: {
                                        padding: '9px 10px',
                                        borderRadius: '8px',
                                        border: '1px solid color-mix(in srgb, currentColor 10%, transparent)',
                                        background: 'color-mix(in srgb, var(--vyasa-paper) 97%, transparent)',
                                        fontSize: '11px',
                                        lineHeight: 1.45,
                                        opacity: 0.82,
                                        boxSizing: 'border-box',
                                    },
                                }, activeProjectionOption.caption)
                                : null
                        ) : null,
                        React.createElement('div', { style: { ...filterSectionStyle, marginBottom: '12px', paddingBottom: '10px', borderBottom: '1px solid color-mix(in srgb, currentColor 12%, transparent)' } },
                            React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' } },
                                React.createElement('span', { style: filterKeyStyle }, 'Group by'),
                                React.createElement('label', { className: 'vyasa-tasks-toggle-label', title: 'Enable custom grouping' },
                                    React.createElement('input', {
                                        type: 'checkbox',
                                        className: 'vyasa-tasks-switch-input',
                                        checked: groupByEnabled,
                                        disabled: !customGroupingAvailable,
                                        onChange: (event) => {
                                            setGroupByEnabled(event.target.checked);
                                            setViewMode('graph');
                                            pendingFitActionRef.current = 'mode';
                                        },
                                    }),
                                    React.createElement('span', { className: 'vyasa-tasks-switch-track', 'aria-hidden': 'true' }),
                                    React.createElement('span', { style: { fontWeight: 700, opacity: 0.76 } }, groupByEnabled ? 'On' : 'Off')
                                )
                            ),
                            React.createElement('div', { style: filterValueStackStyle },
                                    groupByLevels.map((selectedKey, level) => {
                                        const draggable = groupByControlsEnabled && Boolean(selectedKey);
                                        const levelEnabled = Boolean(selectedKey) && !groupByDisabledSet.has(selectedKey);
                                        return React.createElement('div', {
                                            key: `group-by-${level}`,
                                            onDragOver: (event) => {
                                                if (!draggable || !Array.from(event.dataTransfer.types || []).includes('text/x-vyasa-group-level')) return;
                                                event.preventDefault();
                                                event.dataTransfer.dropEffect = 'move';
                                            },
                                            onDrop: (event) => {
                                                const from = Number.parseInt(event.dataTransfer.getData('text/x-vyasa-group-level'), 10);
                                                if (Number.isInteger(from)) {
                                                    event.preventDefault();
                                                    reorderGroupByLevel(from, level);
                                                }
                                            },
                                            style: { display: 'flex', gap: '6px', alignItems: 'center' },
                                        },
                                            React.createElement('span', {
                                                draggable,
                                                title: 'Drag to reorder',
                                                'aria-label': 'Drag to reorder group level',
                                                onDragStart: (event) => {
                                                    if (!draggable) return;
                                                    event.dataTransfer.setData('text/x-vyasa-group-level', String(level));
                                                    event.dataTransfer.effectAllowed = 'move';
                                                },
                                                style: { flex: '0 0 auto', cursor: draggable ? 'grab' : 'default', opacity: draggable ? 0.7 : 0.25, fontWeight: 700, letterSpacing: '0.04em', userSelect: 'none' },
                                            }, '::'),
                                            React.createElement('input', {
                                                type: 'checkbox',
                                                checked: levelEnabled,
                                                disabled: !groupByControlsEnabled || !selectedKey,
                                                title: levelEnabled ? 'Disable this group level' : 'Enable this group level',
                                                'aria-label': `${levelEnabled ? 'Disable' : 'Enable'} group level ${level + 1}`,
                                                onChange: (event) => {
                                                    const key = String(selectedKey || '').trim();
                                                    if (!key) return;
                                                    setGroupByDisabledKeys((current) => {
                                                        const disabled = new Set(normalizeTasksGroupByDisabledKeys(current));
                                                        if (event.target.checked) disabled.delete(key); else disabled.add(key);
                                                        return Array.from(disabled);
                                                    });
                                                    setViewMode('graph');
                                                    pendingFitActionRef.current = 'mode';
                                                },
                                                style: { flex: '0 0 auto', width: '14px', height: '14px', margin: 0 },
                                            }),
                                            React.createElement('select', {
                                                value: selectedKey,
                                                disabled: !groupByControlsEnabled,
                                                onChange: (event) => {
                                                    const nextKey = event.target.value;
                                                    const next = groupByHierarchy.slice();
                                                    next[level] = nextKey;
                                                    setGroupByHierarchy(next.slice(0, level + 1).filter(Boolean));
                                                    setGroupByDisabledKeys((current) => normalizeTasksGroupByDisabledKeys(current).filter((key) => key !== selectedKey && key !== nextKey));
                                                    setViewMode('graph');
                                                    pendingFitActionRef.current = 'mode';
                                                },
                                                style: {
                                                    flex: '1 1 auto',
                                                    minWidth: 0,
                                                    border: '1px solid color-mix(in srgb, currentColor 16%, transparent)',
                                                    borderRadius: '8px',
                                                    padding: '6px 8px',
                                                    background: 'color-mix(in srgb, var(--vyasa-paper) 96%, transparent)',
                                                    color: 'inherit',
                                                },
                                            },
                                                React.createElement('option', { value: '' }, level === 0 ? 'No custom grouping' : `Level ${level + 1}: none`),
                                                ...groupByOptions
                                                    .filter((option) => option.key === displayedGroupByHierarchy[level] || !displayedGroupByHierarchy.includes(option.key))
                                                    .map((option) => React.createElement('option', { key: option.key, value: option.key }, option.label))
                                            ),
                                            React.createElement('button', {
                                                type: 'button',
                                                className: 'vyasa-tasks-group-by-clear',
                                                title: 'Clear group level',
                                                'aria-label': `Clear group level ${level + 1}`,
                                                disabled: !groupByControlsEnabled || !selectedKey,
                                                onClick: () => {
                                                    const next = groupByHierarchy.slice();
                                                    next[level] = '';
                                                    setGroupByHierarchy(next.slice(0, level + 1).filter(Boolean));
                                                    setGroupByDisabledKeys((current) => normalizeTasksGroupByDisabledKeys(current).filter((key) => key !== selectedKey));
                                                    setViewMode('graph');
                                                    pendingFitActionRef.current = 'mode';
                                                },
                                            }, '×')
                                        );
                                    }),
                                    viewMode === 'gantt'
                                        ? React.createElement('div', { style: { fontSize: '11px', opacity: 0.7, lineHeight: 1.3 } }, 'Grouping is unavailable in Gantt.')
                                        : null
                            )
                        ),
                        React.createElement('div', { style: { ...filterSectionStyle, marginBottom: '12px', paddingBottom: '10px', borderBottom: '1px solid color-mix(in srgb, currentColor 12%, transparent)' } },
                            React.createElement('span', { style: filterKeyStyle }, 'Notes'),
                            React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' } },
                                    React.createElement('button', {
                                        type: 'button',
                                        title: 'Export notes',
                                        'aria-label': 'Export notes',
                                        onClick: handleExportNodeNotes,
                                        style: { display: 'inline-flex', border: 'none', background: 'none', color: 'inherit', padding: '2px', cursor: 'pointer' },
                                    }, React.createElement('span', { 'uk-icon': 'download', 'aria-hidden': 'true' })),
                                    React.createElement('button', {
                                        type: 'button',
                                        title: 'Copy notes',
                                        'aria-label': 'Copy notes',
                                        onClick: handleCopyNodeNotes,
                                        style: { display: 'inline-flex', border: 'none', background: 'none', color: 'inherit', padding: '2px', cursor: 'pointer' },
                                    }, React.createElement('span', { 'uk-icon': 'copy', 'aria-hidden': 'true' })),
                                    React.createElement('button', {
                                        type: 'button',
                                        title: 'Import notes',
                                        'aria-label': 'Import notes',
                                        onClick: handleImportNodeNotes,
                                        style: { display: 'inline-flex', border: 'none', background: 'none', color: 'inherit', padding: '2px', cursor: 'pointer' },
                                    }, React.createElement('span', { 'uk-icon': 'upload', 'aria-hidden': 'true' })),
                                    allClearedNotes ? React.createElement('button', {
                                        type: 'button',
                                        onClick: handleUndoClearAllNotes,
                                        style: { border: 'none', background: 'none', cursor: 'pointer', fontSize: '11px', color: 'var(--vyasa-primary)', fontWeight: 600, padding: '2px', lineHeight: 1 },
                                    }, 'Undo') : null,
                                    (Object.keys(nodeNotes).length || Object.keys(slideNotes).length) ? React.createElement('button', {
                                        type: 'button',
                                        title: 'Clear all notes',
                                        'aria-label': 'Clear all notes',
                                        onClick: handleClearAllNotes,
                                        style: { display: 'inline-flex', border: 'none', background: 'none', color: 'inherit', padding: '2px', cursor: 'pointer', fontSize: '13px', opacity: 0.45, lineHeight: 1 },
                                    }, '×') : null,
                                    React.createElement('span', { style: { marginLeft: 'auto', opacity: 0.65, fontSize: '11px' } }, `${Object.keys(nodeNotes).length + Object.keys(slideNotes).length} saved`)
                            )
                        ),
                        React.createElement('div', { style: { ...filterSectionStyle, marginBottom: '12px', paddingBottom: '10px', borderBottom: '1px solid color-mix(in srgb, currentColor 12%, transparent)' } },
                            React.createElement('label', { className: 'vyasa-tasks-toggle-label', style: filterKeyStyle },
                                React.createElement('input', {
                                    type: 'checkbox',
                                    className: 'vyasa-tasks-switch-input',
                                    checked: searchEnabled,
                                    onChange: (event) => setSearchEnabled(event.target.checked),
                                }),
                                React.createElement('span', { className: 'vyasa-tasks-switch-track', 'aria-hidden': 'true' }),
                                React.createElement('span', { style: { fontWeight: 700, opacity: 0.76 } }, 'Search')
                            ),
                            React.createElement('div', { style: filterValueStackStyle },
                                    React.createElement('div', { style: { position: 'relative' } },
                                        React.createElement('input', {
                                            ref: searchInputRef,
                                            type: 'text',
                                            value: searchInputValue,
                                            disabled: !searchEnabled,
                                            placeholder: 'text or /regex/i',
                                            onChange: (e) => setSearchInputValue(e.target.value),
                                            style: {
                                                width: '100%',
                                                minWidth: 0,
                                                border: '1px solid color-mix(in srgb, currentColor 16%, transparent)',
                                                borderRadius: '8px',
                                                padding: '7px 28px 7px 9px',
                                                background: 'color-mix(in srgb, var(--vyasa-paper) 96%, transparent)',
                                                color: 'inherit',
                                                boxSizing: 'border-box',
                                            },
                                        }),
                                        searchInputValue
                                            ? React.createElement('button', {
                                                type: 'button',
                                                'aria-label': 'Clear search',
                                                onClick: () => {
                                                    setSearchInputValue('');
                                                    setSearchQuery('');
                                                    if (searchInputRef.current) searchInputRef.current.focus();
                                                },
                                                style: {
                                                    position: 'absolute',
                                                    top: '50%',
                                                    right: '8px',
                                                    transform: 'translateY(-50%)',
                                                    border: 'none',
                                                    background: 'none',
                                                    padding: 0,
                                                    cursor: 'pointer',
                                                    fontSize: '12px',
                                                    lineHeight: 1,
                                                    color: 'inherit',
                                                    opacity: 0.55,
                                                },
                                            }, '×')
                                            : null
                                    ),
                                    !searchEnabled
                                        ? React.createElement('div', { style: { fontSize: '11px', opacity: 0.7, lineHeight: 1.35 } }, 'Search disabled.')
                                        : searchMatches.error
                                        ? React.createElement('div', { style: { fontSize: '11px', color: '#fca5a5', lineHeight: 1.3 } }, `Regex error: ${searchMatches.error}`)
                                        : React.createElement('div', { style: { fontSize: '11px', opacity: 0.72, lineHeight: 1.3 } }, searchMatches.active ? `${searchMatches.nodeIds.size} nodes matched` : 'Matches node id, label, text attrs, and matching edge text.')
                            )
                        ),
                        edgeTypeOptions.length ? React.createElement('div', {
                            style: { ...filterSectionStyle, marginBottom: '12px', paddingBottom: '10px', borderBottom: '1px solid color-mix(in srgb, currentColor 12%, transparent)' },
                        },
                            React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' } },
                                React.createElement('label', { className: 'vyasa-tasks-toggle-label', style: filterKeyStyle },
                                    React.createElement('input', {
                                        type: 'checkbox',
                                        className: 'vyasa-tasks-switch-input',
                                        checked: edgeTypeFilterEnabled,
                                        onChange: (event) => {
                                            setEdgeTypeFilterEnabled(event.target.checked);
                                            setEdgeTypeMenuOpen(false);
                                        },
                                    }),
                                    React.createElement('span', { className: 'vyasa-tasks-switch-track', 'aria-hidden': 'true' }),
                                    React.createElement('span', { style: { fontWeight: 700, opacity: 0.76 } }, 'Edge Types')
                                ),
                                !edgeTypeFilterEnabled && activeEdgeTypes.length
                                    ? React.createElement('span', { style: { opacity: 0.58, fontSize: '11px' } }, `${activeEdgeTypes.length} saved`)
                                    : null
                            ),
                            React.createElement('div', { style: { position: 'relative' } },
                                React.createElement('input', {
                                    type: 'text',
                                    value: edgeTypeQuery,
                                    disabled: !edgeTypeFilterEnabled,
                                    placeholder: 'Search edge types',
                                    'aria-label': 'Search edge types',
                                    'aria-expanded': edgeTypeFilterEnabled && edgeTypeMenuOpen,
                                    'aria-controls': `${widgetId}-edge-type-options`,
                                    onFocus: () => {
                                        if (edgeTypeFilterEnabled) setEdgeTypeMenuOpen(true);
                                    },
                                    onBlur: () => window.setTimeout(() => setEdgeTypeMenuOpen(false), 120),
                                    onChange: (event) => {
                                        setEdgeTypeQuery(event.target.value);
                                        setEdgeTypeMenuOpen(true);
                                    },
                                    style: {
                                        width: '100%',
                                        minWidth: 0,
                                        border: '1px solid color-mix(in srgb, currentColor 16%, transparent)',
                                        borderRadius: '8px',
                                        padding: '7px 9px',
                                        background: 'color-mix(in srgb, var(--vyasa-paper) 96%, transparent)',
                                        color: 'inherit',
                                        boxSizing: 'border-box',
                                    },
                                }),
                                edgeTypeFilterEnabled && edgeTypeMenuOpen ? React.createElement('div', {
                                    id: `${widgetId}-edge-type-options`,
                                    role: 'listbox',
                                    'aria-label': 'Available edge types',
                                    onMouseDown: (event) => event.preventDefault(),
                                    style: {
                                        position: 'absolute',
                                        zIndex: 3,
                                        top: 'calc(100% + 4px)',
                                        left: 0,
                                        right: 0,
                                        maxHeight: '180px',
                                        overflowY: 'auto',
                                        display: 'grid',
                                        gap: '4px',
                                        padding: '6px',
                                        border: '1px solid color-mix(in srgb, currentColor 16%, transparent)',
                                        borderRadius: '8px',
                                        background: 'var(--vyasa-paper)',
                                        boxShadow: '0 8px 24px color-mix(in srgb, black 18%, transparent)',
                                    },
                                },
                                    visibleEdgeTypeOptions.length
                                        ? visibleEdgeTypeOptions.map((type) => {
                                            const edgeColor = edgeTypeColors[type] || 'currentColor';
                                            return React.createElement('label', {
                                                key: type,
                                                role: 'option',
                                                'aria-selected': activeEdgeTypes.includes(type),
                                                className: 'vyasa-tasks-query-value-option',
                                            },
                                                React.createElement('input', {
                                                    type: 'checkbox',
                                                    checked: activeEdgeTypes.includes(type),
                                                    onChange: (event) => {
                                                        const enabled = event.target.checked;
                                                        setActiveEdgeTypes((current) => enabled
                                                            ? Array.from(new Set([...current, type]))
                                                            : current.filter((entry) => entry !== type));
                                                        logTasksDebug('edgeTypeFilterChange', { widgetId, type, enabled });
                                                    },
                                                }),
                                                React.createElement('span', {
                                                    'aria-hidden': 'true',
                                                    style: { width: '18px', height: '3px', flex: '0 0 18px', borderRadius: '999px', background: edgeColor },
                                                }),
                                                React.createElement('span', null, type)
                                            );
                                        })
                                        : React.createElement('div', { style: { padding: '5px 7px', fontSize: '11px', opacity: 0.68 } }, 'No matching edge types')
                                ) : null
                            ),
                            activeEdgeTypes.length ? React.createElement('div', {
                                style: { display: 'flex', flexWrap: 'wrap', gap: '6px' },
                            },
                                ...activeEdgeTypes.map((type) => React.createElement('button', {
                                    key: type,
                                    type: 'button',
                                    title: `Remove ${type}`,
                                    disabled: !edgeTypeFilterEnabled,
                                    onClick: () => setActiveEdgeTypes((current) => current.filter((entry) => entry !== type)),
                                    style: {
                                        border: `1px solid ${edgeTypeColors[type] || 'currentColor'}`,
                                        borderRadius: '999px',
                                        padding: '3px 7px',
                                        background: `color-mix(in srgb, ${edgeTypeColors[type] || 'currentColor'} 14%, transparent)`,
                                        color: 'inherit',
                                        cursor: edgeTypeFilterEnabled ? 'pointer' : 'default',
                                        fontSize: '11px',
                                        opacity: edgeTypeFilterEnabled ? 1 : 0.58,
                                    },
                                }, `${type} ×`))
                            ) : React.createElement('div', { style: { fontSize: '11px', opacity: 0.7 } }, 'Select one or more; matches any selected type.'),
                        ) : null,
                        ...colorLevelSlots.map((colorBy, index) => renderColorLevel(colorBy, index)),
                        renderIconFilters(),
                        React.createElement('div', { style: { marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' } },
                            React.createElement('label', { className: 'vyasa-tasks-toggle-label', title: 'Show hover highlight on dimmed (inactive) nodes too' },
                                React.createElement('input', {
                                    type: 'checkbox',
                                    className: 'vyasa-tasks-switch-input',
                                    checked: hoverInactiveNodes,
                                    onChange: (event) => setHoverInactiveNodes(event.target.checked),
                                }),
                                React.createElement('span', { className: 'vyasa-tasks-switch-track', 'aria-hidden': 'true' }),
                                React.createElement('span', { style: { fontWeight: 700, opacity: 0.76 } }, 'Hover inactive nodes')
                            )
                        ),
                        React.createElement('div', { style: { marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', fontSize: '12px' } },
                            React.createElement('label', { className: 'vyasa-tasks-toggle-label' },
                                React.createElement('input', {
                                    type: 'checkbox',
                                    className: 'vyasa-tasks-switch-input',
                                    checked: queryBuilderEnabled,
                                    onChange: (event) => setQueryBuilderEnabled(event.target.checked),
                                }),
                                React.createElement('span', { className: 'vyasa-tasks-switch-track', 'aria-hidden': 'true' }),
                                React.createElement('span', { style: { fontWeight: 700, opacity: 0.76 } }, 'Query builder')
                            ),
                            !queryBuilderEnabled && tasksFilterQueryHasRules(activeFilters)
                                ? React.createElement('span', { style: { opacity: 0.58 } }, `${tasksCountFilterRules(activeFilters)} saved`)
                                : null
                        ),
                        React.createElement('div', { style: { marginTop: '4px' } },
                            queryBuilderFields.length
                                ? !queryBuilderEnabled
                                    ? React.createElement('div', { style: { fontSize: '11px', opacity: 0.7, lineHeight: 1.35 } }, 'Query builder disabled.')
                                    : QueryBuilder
                                    ? React.createElement(QueryBuilder, {
                                    query: normalizeTasksFilterQuery(activeFilters),
                                    fields: queryBuilderFields,
                                    operators: queryBuilderOperators,
                                    onQueryChange: (query) => {
                                        const normalized = normalizeTasksFilterQuery(query);
                                        logTasksDebug('queryBuilderChange', { widgetId, rules: tasksCountFilterRules(normalized), query: normalized });
                                        setActiveFilters(normalized);
                                    },
                                    showNotToggle: true,
                                    showCloneButtons: false,
                                    showMuteButtons: true,
                                    showCombinatorsBetweenRules: true,
                                    resetOnFieldChange: true,
                                    resetOnOperatorChange: true,
                                    listsAsArrays: true,
                                    controlElements: { valueEditor: QueryValueEditor, muteRuleAction: QueryMuteToggle, muteGroupAction: null },
                                    controlClassnames: { queryBuilder: 'vyasa-tasks-query-builder' },
                                })
                                    : React.createElement('div', { style: { fontSize: '11px', opacity: 0.7, lineHeight: 1.35 } }, 'Loading advanced filters...')
                                : React.createElement('div', { style: { fontSize: '11px', opacity: 0.7, lineHeight: 1.35 } }, 'No filterable fields in this graph.')
                        ),
                        React.createElement('div', { style: { ...filterSectionStyle, marginTop: '12px', paddingTop: '10px', borderTop: '1px solid color-mix(in srgb, currentColor 12%, transparent)' } },
                            React.createElement('span', { style: filterKeyStyle }, 'Intensity'),
                            React.createElement('label', { style: { display: 'grid', gap: '6px', minWidth: 0, fontSize: '12px' } },
                                React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' } },
                                    React.createElement('span', { style: { opacity: 0.82 } }, 'Edge Intensity'),
                                    React.createElement('span', { style: { opacity: 0.8, minWidth: '3.5em', textAlign: 'right' } }, tasksEdgeOpacityLabel(edgeOpacity))
                                ),
                                React.createElement('input', {
                                    type: 'range',
                                    min: TASKS_EDGE_OPACITY_MIN,
                                    max: TASKS_EDGE_OPACITY_MAX,
                                    step: 'any',
                                    value: edgeOpacity,
                                    onChange: (e) => setEdgeOpacity(clampTasksEdgeOpacity(e.target.value)),
                                    style: { width: '100%', minWidth: 0, margin: 0 },
                                })
                            ),
                            React.createElement('label', { style: { display: 'grid', gap: '6px', minWidth: 0, fontSize: '12px' } },
                                React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' } },
                                    React.createElement('span', { style: { opacity: 0.82 } }, 'Null Intensity'),
                                    React.createElement('span', { style: { opacity: 0.8, minWidth: '3.5em', textAlign: 'right' } }, tasksOpacityPctLabel(projectionUnspecifiedContentOpacity))
                                ),
                                React.createElement('input', {
                                    type: 'range',
                                    min: 0.02,
                                    max: 1,
                                    step: 0.01,
                                    value: projectionUnspecifiedContentOpacity,
                                    onChange: (e) => setProjectionUnspecifiedContentOpacity(clampTasksProjectionContentOpacity(e.target.value)),
                                    style: { width: '100%', minWidth: 0, margin: 0 },
                                })
                            )
                        )
                    )
                )
                );
            };
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
            const dismissStickyHoverCard = React.useCallback((stickyId, reason) => {
                setStickyGroupHoverTooltips((cards) => {
                    const dismissed = cards.find((card) => card.stickyId === stickyId);
                    if (!dismissed) return cards;
                    logTasksDebug('hoverCardStickyClear', { widgetId, nodeId: dismissed.nodeId || '', reason });
                    const next = cards.filter((card) => card.stickyId !== stickyId);
                    stickyGroupHoverTooltipsRef.current = next;
                    return next;
                });
            }, [widgetId]);
            const dismissLatestStickyHoverCard = React.useCallback((reason) => {
                const cards = stickyGroupHoverTooltipsRef.current;
                const latest = cards[cards.length - 1];
                if (latest) dismissStickyHoverCard(latest.stickyId, reason);
            }, [dismissStickyHoverCard]);
            const dismissAllStickyHoverCards = React.useCallback((reason) => {
                const cards = stickyGroupHoverTooltipsRef.current;
                if (!cards.length) return;
                stickyGroupHoverTooltipsRef.current = [];
                setStickyGroupHoverTooltips([]);
                logTasksDebug('hoverCardStickyClearAll', { widgetId, count: cards.length, reason });
            }, [widgetId]);
            React.useEffect(() => {
                let armed = '';
                const keyFor = (card) => card ? `${card.nodeId || ''}\u0000${card.label || ''}` : '';
                const onKeyDown = (event) => {
                    const target = event.target instanceof Element ? event.target : null;
                    const wrapper = flowWrapperRef.current;
                    const key = event.key.toLowerCase();
                    const widgetFocused = wrapper?.contains(document.activeElement) || wrapper?.contains(target) || window.__vyasaTasksActiveWidgetId === widgetId;
                    const editable = target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(target.tagName));
                    if (key === 'x' && stickyGroupHoverTooltipsRef.current.length && widgetFocused && !editable && !event.repeat && !event.metaKey && !event.ctrlKey && !event.altKey) {
                        event.preventDefault();
                        event.stopImmediatePropagation();
                        if (event.shiftKey) dismissAllStickyHoverCards('shortcut-shift-x');
                        else dismissLatestStickyHoverCard('shortcut-x');
                        return;
                    }
                    if (event.key === 'Control' && !event.repeat && !event.metaKey && !event.altKey && !event.shiftKey) {
                        const current = groupHoverTooltipRef.current;
                        armed = keyFor(current);
                    } else if (event.key !== 'Control') armed = '';
                };
                const onKeyUp = (event) => {
                    if (event.key !== 'Control' || !armed) return;
                    const current = groupHoverTooltipRef.current;
                    if (!current || keyFor(current) !== armed) return;
                    const sticky = {
                        ...current,
                        sticky: true,
                        stickyId: ++stickyGroupHoverTooltipIdRef.current,
                        placement: 'canvas',
                    };
                    armed = '';
                    setStickyGroupHoverTooltips((cards) => {
                        const next = [...cards, sticky];
                        stickyGroupHoverTooltipsRef.current = next;
                        return next;
                    });
                    clearGroupHoverTooltip();
                    logTasksDebug('hoverCardStickySet', { widgetId, nodeId: sticky.nodeId || '' });
                };
                const disarm = () => { armed = ''; };
                document.addEventListener('keydown', onKeyDown, true);
                document.addEventListener('keyup', onKeyUp);
                window.addEventListener('blur', disarm);
                return () => {
                    document.removeEventListener('keydown', onKeyDown, true);
                    document.removeEventListener('keyup', onKeyUp);
                    window.removeEventListener('blur', disarm);
                };
            }, [clearGroupHoverTooltip, dismissAllStickyHoverCards, dismissLatestStickyHoverCard, widgetId]);
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
            const activeHoverAttrs = React.useMemo(
                () => tasksActiveHoverAttrs(viewerState.model, activeProjectionId),
                [viewerState.model, activeProjectionId]
            );
            const updateGroupHoverTooltip = React.useCallback((event) => {
                const reactFlow = reactFlowApiRef.current;
                const wrapper = flowWrapperRef.current;
                const graphBase = graphBaseRef.current || {};
                const target = event.target instanceof Element ? event.target : null;
                const domNode = target?.closest?.('.react-flow__node') || null;
                if (event.altKey) {
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
                if (target?.closest?.('[data-vyasa-hover-card-sticky="true"]')) {
                    clearGroupHoverTooltip();
                    traceHoverHit('sticky-card');
                    return;
                }
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
                const directRows = tasksHoverAttrRows(nodeData, activeHoverAttrs);
                const rows = hoverGroupId
                    ? tasksGroupHoverAttrRows(directRows, tasksGroupDetailEntries(hoverGroupId, model), activeHoverAttrs)
                    : directRows;
                const label = nodeData.label || hit.node.id;
                const nodeId = nodeData.__kind__ === 'groupTitle' ? (nodeData.sourceGroupId || hit.node.id) : hit.node.id;
                const image = normalizeTasksNodeImageUrl(nodeData.__node_image__);
                if (!label && !rows.length) {
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
                        const baseEdges = graphBase.edges || [];
                        const isNeighbor = baseEdges.some((edge) =>
                            (edge.source === selectedNodeId && edge.target === sourceNodeId) ||
                            (edge.source === sourceNodeId && edge.target === selectedNodeId)
                        );
                        if (hoverInactiveNodes || isNeighbor || sourceNodeId === selectedNodeId) {
                            setHoveredNodeId((current) => current === sourceNodeId ? current : sourceNodeId);
                        }
                    }
                }
                if (stickyGroupHoverTooltipsRef.current.some((card) => card.nodeId === nodeId)) {
                    clearGroupHoverTooltip();
                    traceHoverHit('sticky', { hitId: hit.node.id, kind: nodeData.__kind__ || '', edgePx });
                    return;
                }
                const hoverAnchor = reactFlow.screenToFlowPosition({ x: event.clientX + 12, y: event.clientY + 18 });
                const hoverCard = {
                    label,
                    nodeId,
                    image,
                    rows,
                    flowX: hoverAnchor.x,
                    flowY: hoverAnchor.y,
                    x: event.clientX - bounds.left + 12,
                    y: event.clientY - bounds.top + 18,
                };
                const nextHoverCard = hoverCardRightRail
                    ? { ...hoverCard, placement: 'rightRail' }
                    : { ...hoverCard, placement: 'cursor' };
                groupHoverTooltipRef.current = nextHoverCard;
                setGroupHoverTooltip(nextHoverCard);
                traceHoverHit('hit', { hitId: hit.node.id, kind: nodeData.__kind__ || '', edgePx, groupHoverChanged });
            }, [expanded, clearGroupHoverTooltip, clearGraphHoverState, clearOptionEdgePreview, edgeForOptionPointer, previewOptionEdge, activeHoverAttrs, nodes, widgetId, model, egoMode, hoverInactiveNodes, hoverCardRightRail, hoveredNodeId, logHoverCycle, selectedNodeId]);
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
                logTasksDebug('selectionSetNode', {
                    widgetId,
                    sourceNodeId,
                    nodeId: node.id,
                    kind: node.data?.__kind__ || '',
                    ...tasksSelectionDebugPayload(selectedNodeIdRef.current, selectedNodeIdsRef.current, hoveredNodeId),
                });
                markWidgetActive();
                selectedEdgeIdRef.current = null;
                optionEdgeNodeIdRef.current = '';
                setSelectedEdgeId(null);
                setSelectedEdgeRecord(null);
                setEdgeCardOpen(false);
                selectedNodeIdRef.current = sourceNodeId;
                selectedNodeIdsRef.current = new Set();
                setSelectedNodeId(sourceNodeId);
                setSelectedNodeIds(new Set());
                setHoveredNodeId(null);
            }, [expanded, selectGroupDescendants]);
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
                if (event.target?.closest?.('button, input, textarea, select, a, .react-flow__controls, .vyasa-tasks-filter-card')) return;
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
                        toggleHelp: () => setHelpOpen((current) => !current),
                    };
                    return () => {
                        delete window.__vyasaTasksActions[widgetId];
                    };
                }, [reactFlow, currentSelectionIds, baseProjectionState.model, baseRawGraph, expanded, egoMode, egoState, activeColorBy, closeEgo, fitCurrentHighlight]);
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
            const flowWrapperClassName = [
                hoveredNodeId ? 'vyasa-tasks-hovering-edge-labels' : '',
                'vyasa-tasks-active-pulse',
            ].filter(Boolean).join(' ');
            const buildProjectionConfigText = (projection) => {
                const pid = String(projection?.id || '');
                const def = (Array.isArray(viewerState.model?.view_projections) ? viewerState.model.view_projections : []).find((p) => p && p.id === pid) || null;
                const isActiveLive = viewMode !== 'gantt' && pid === String(activeProjectionId || '');
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
            const RightRail = () => {
                if (!selectedNodeId && !(edgeCardOpen && (selectedEdgeRecord || edgeCardError))) return null;
                if (hoverCardsEnabled && hoverCardRightRail && groupHoverTooltip?.placement === 'rightRail') return null;
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
                    edgeCardOpen && (selectedEdgeRecord || edgeCardError) ? SelectedEdgePanel() : SelectedNodePanel()
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
            const GroupHoverTooltipCard = React.useMemo(() => function GroupHoverTooltipCard({
                card,
                noteValue = '',
                onNoteChange,
                stickyIndex = -1,
                inViewportPortal = false,
            }) {
                const tooltipRef = window.React.useRef(null);
                const [measuredSize, setMeasuredSize] = window.React.useState({ width: 0, height: 0 });
                const viewport = typeof rf.useViewport === 'function' ? rf.useViewport() : { zoom: 1 };
                const viewportZoom = Math.max(0.01, Number(viewport?.zoom) || 1);
                window.React.useLayoutEffect(() => {
                    const rect = tooltipRef.current?.getBoundingClientRect?.();
                    if (!rect) return;
                    const width = Math.ceil(rect.width);
                    const height = Math.ceil(rect.height);
                    if (width !== measuredSize.width || height !== measuredSize.height) setMeasuredSize({ width, height });
                }, [card, measuredSize.width, measuredSize.height]);
                const rows = Array.isArray(card.rows) ? card.rows : [];
                const image = normalizeTasksNodeImageUrl(card.image);
                const panelWidth = tasksDetailPanelWidth({
                    title: card.label || '',
                    nodeId: card.nodeId || '',
                    entries: rows,
                    titleFont: `700 calc(${hoverFontSize} * 1.12) ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`,
                    bodyFont: `500 ${hoverFontSize} ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`,
                    keyFont: `700 ${hoverFontSize} ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`,
                    hasImage: Boolean(image),
                    stackHeader: true,
                });
                const wrapperWidth = Math.max(240, Math.floor(flowWrapperRef.current?.getBoundingClientRect?.().width || 0));
                const wrapperHeight = Math.max(160, Math.floor(flowWrapperRef.current?.getBoundingClientRect?.().height || 0));
                const maxWidth = Math.max(220, Math.min(panelWidth, wrapperWidth - 24));
                const maxHeight = Math.max(80, wrapperHeight - 24);
                const tooltipWidth = Math.min(maxWidth, measuredSize.width || maxWidth);
                const tooltipHeight = Math.min(maxHeight, measuredSize.height || maxHeight);
                const rightRailPlacement = card.placement === 'rightRail';
                const clampedLeft = inViewportPortal
                    ? card.flowX
                    : rightRailPlacement
                    ? 'auto'
                    : Math.max(12, Math.min(card.x, wrapperWidth - tooltipWidth - 12));
                const clampedTop = inViewportPortal
                    ? card.flowY
                    : rightRailPlacement
                    ? 'auto'
                    : Math.max(12, Math.min(card.y, wrapperHeight - tooltipHeight - 12));
                const children = [
                    window.React.createElement('div', {
                        key: '__label__',
                        style: { display: 'flex', alignItems: 'flex-start', gap: '7px', fontWeight: 700, fontSize: `calc(${hoverFontSize} * 1.12)`, lineHeight: 1.25, whiteSpace: 'normal', minWidth: 0 },
                    },
                        image ? window.React.createElement('img', {
                            src: image,
                            alt: '',
                            loading: 'lazy',
                            draggable: false,
                            className: tasksIsIconifyImage(image) ? 'vyasa-tasks-node-image vyasa-tasks-node-image--icon' : 'vyasa-tasks-node-image',
                            style: { width: '22px', height: '22px', objectFit: 'contain', flex: '0 0 auto' },
                        }) : null,
                        window.React.createElement('span', {
                            style: { flex: '1 1 auto', minWidth: 0, overflowWrap: 'anywhere', wordBreak: 'break-word' },
                        }, renderTasksInlineLinks(card.label, { currentPath: sourceModel?.document_path || '' })),
                        card.sticky ? window.React.createElement('button', {
                            type: 'button',
                            title: 'Close sticky hover card',
                            'aria-label': 'Close sticky hover card',
                            onPointerDown: (event) => event.stopPropagation(),
                            onClick: () => dismissStickyHoverCard(card.stickyId, 'close-button'),
                            style: { flex: '0 0 auto', border: 0, background: 'transparent', color: 'inherit', cursor: 'pointer', fontSize: '18px', lineHeight: 1, padding: '0 0 0 4px' },
                        }, '×') : null
                    ),
                ];
                if (card.nodeId) children.push(window.React.createElement('div', {
                    key: '__node_id__',
                    style: { marginTop: '5px', marginBottom: rows.length ? '5px' : 0, fontSize: hoverFontSize, fontWeight: 600, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace', opacity: 0.7, overflowWrap: 'anywhere', wordBreak: 'break-word' },
                }, card.nodeId));
                if (rows.length) children.push(renderTasksDetailEntries(window.React, rows, { fontSize: hoverFontSize, lineHeight: 1.35, currentPath: sourceModel?.document_path || '' }));
                children.push(window.React.createElement('label', {
                    key: '__notes__',
                    style: {
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        marginTop: '10px',
                        paddingTop: '10px',
                        borderTop: '1px dashed color-mix(in srgb, currentColor 18%, transparent)',
                    },
                },
                    window.React.createElement('span', { style: { fontSize: '12px', fontWeight: 700, opacity: 0.7 } }, 'Notes'),
                    renderTasksNoteTextarea(window.React, {
                        value: noteValue,
                        readOnly: !card.sticky,
                        ariaLabel: `Notes for ${card.label || card.nodeId}`,
                        onChange: card.sticky ? (event) => onNoteChange?.(event.target.value) : undefined,
                    })
                ));
                return window.React.createElement('div', {
                    ref: tooltipRef,
                    'data-vyasa-hover-card-sticky': card.sticky ? 'true' : undefined,
                    style: {
                        position: rightRailPlacement ? 'relative' : 'absolute',
                        left: clampedLeft,
                        top: clampedTop,
                        zIndex: rightRailPlacement ? 'auto' : 2400 + Math.max(0, stickyIndex),
                        flex: rightRailPlacement ? '0 0 auto' : undefined,
                        transform: inViewportPortal ? `scale(${1 / viewportZoom})` : undefined,
                        transformOrigin: inViewportPortal ? 'top left' : undefined,
                        pointerEvents: card.sticky ? 'auto' : 'none',
                        width: `${maxWidth}px`,
                        maxHeight: `${maxHeight}px`,
                        overflowY: 'auto',
                        maxWidth: '100%',
                        minWidth: 'min(220px, 100%)',
                        boxSizing: 'border-box',
                        borderRadius: '12px',
                        border: '1px solid color-mix(in srgb, var(--vyasa-primary) 28%, transparent)',
                        background: 'color-mix(in srgb, var(--vyasa-paper) 92%, transparent)',
                        boxShadow: rightRailPlacement
                            ? '-18px 20px 50px rgba(0,0,0,0.24), 0 4px 16px rgba(0,0,0,0.16)'
                            : '0 10px 30px rgba(0,0,0,0.12)',
                        backdropFilter: 'blur(8px)',
                        padding: '12px',
                    },
                }, ...children);
            }, [dismissStickyHoverCard, hoverFontSize, rf, sourceModel]);
            const GroupHoverTooltip = () => {
                if (!hoverCardsEnabled) return null;
                const stickyCards = stickyGroupHoverTooltips.map((card, index) => window.React.createElement(GroupHoverTooltipCard, {
                    key: card.stickyId,
                    card,
                    noteValue: nodeNotes[card.nodeId] || '',
                    onNoteChange: (value) => updateNodeNote(card.nodeId, value),
                    stickyIndex: index,
                    inViewportPortal: Boolean(rf.ViewportPortal),
                }));
                const stickyLayer = rf.ViewportPortal
                    ? window.React.createElement(rf.ViewportPortal, null, ...stickyCards)
                    : window.React.createElement(window.React.Fragment, null, ...stickyCards);
                const transientCard = groupHoverTooltip ? window.React.createElement(GroupHoverTooltipCard, {
                    key: '__transient__',
                    card: groupHoverTooltip,
                    noteValue: nodeNotes[groupHoverTooltip.nodeId] || '',
                }) : null;
                const transientLayer = hoverCardRightRail ? window.React.createElement('div', {
                    style: {
                        position: 'absolute',
                        inset: '12px 12px 12px auto',
                        zIndex: 2400,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-end',
                        gap: '10px',
                        maxWidth: 'calc(100% - 24px)',
                        overflowY: 'auto',
                        pointerEvents: 'none',
                    },
                }, transientCard) : transientCard;
                return window.React.createElement(window.React.Fragment, null, stickyLayer, transientLayer);
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
                    row('Shift + drag', 'box select'),
                    row('Cmd + drag', 'lasso select'),
                    row('Alt + Shift + drag', 'append lasso selection'),
                    row('Wheel / pinch', 'zoom'),
                    row('Drag canvas', 'pan'),
                    sep(),
                    heading('Keys'),
                    row('?', 'toggle this help'),
                    row('[ / ]', 'select previous / next visible edge'),
                    row('Enter', 'open selected edge details'),
                    row('F', 'fit view'),
                    row('Shift + F', 'toggle fullscreen'),
                    row('G', 'open EG+ for hovered or selected node'),
                    row('Shift + G', 'open EG for hovered or selected node'),
                    row('S', 'toggle filters'),
                    row('E', 'toggle edges'),
                    row('C', 'hover cards: off, at cursor, right rail'),
                    row('T', 'toggle hovered group'),
                    row('I / O', 'expand / collapse one depth'),
                    row('U / P', 'unfold / collapse all'),
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
                const panelWidth = `min(${TASKS_FILTER_PANEL_WIDTH}px, calc(100% - 24px))`;
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
                        slide.caption ? window.React.createElement('div', { style: { fontSize: '13px', fontWeight: 600, opacity: 0.85, marginBottom: '10px' } }, slide.caption) : null,
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
            const flowPointerHandlers = {
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
                },
                onPointerDownCapture: startDragSelection,
                onPointerMove: updateGroupHoverTooltip,
                onWheelCapture: (event) => {
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
                    window.React.createElement(rf.Controls),
                    window.React.createElement(PanControls),
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
                        window.React.createElement(rf.Controls),
                        window.React.createElement(PanControls),
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
