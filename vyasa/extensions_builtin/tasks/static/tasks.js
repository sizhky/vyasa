import ELK from 'https://esm.sh/elkjs@0.10.0';
import { applyTasksFilterAttributePolicy, buildTaskEdgeAnchors, clampScale, collectTasksStoredNotes, importTasksStoredNotes, isTasksEdgeInternalToSelection, isTasksEdgeLabelHoverDimmingActive, isTasksGraphNodeSelectable, isTasksUnspecifiedProjectionGroup, layoutDisconnectedTaskNodes, measureTextWidth, nextWheelState, normalizeTasksNodeImageUrl, resolveTasksNodeImage, selectTasksGraphNodeIdsInPolygon, selectTasksGraphNodeIdsInRect, sizeTaskNode, tasksEdgeLabelZForMode, tasksEgoNodeOpacity, tasksExpandedRootRect, tasksGraphDynamicMinZoom, tasksGraphNodeAllowsHover, tasksGraphNodeHitArea, tasksProjectionGroupByHierarchy } from '/static/extensions/tasks/tasks_graph_core.js';

const tasksElk = new ELK();
let tasksReactFlowReady = null;
let tasksQueryBuilderReady = null;
const TASKS_GROUP_PADDING = { top: 68, right: 40, bottom: 40, left: 40 };
const TASKS_ROOT_SPACING = { node: 44, layer: 96 };
const TASKS_ROOT_COLLISION_GAP = 96;
const TASKS_GROUP_BG_Z = 10;
const TASKS_EDGE_Z = 5;
const TASKS_EDGE_LABEL_Z = 6;
const TASKS_EDGE_LABEL_FOCUS_Z = 1400;
const TASKS_GROUP_Z = 180;
const TASKS_TASK_Z = 1000;
const TASKS_EDGE_LABEL_SELECTED_Z = TASKS_TASK_Z - 1;
const TASKS_TITLE_Z = 300;
const TASKS_NEIGHBOR_Z_BOOST = 260;
const TASKS_EDGE_FOCUS_Z = 1450;
const TASKS_SELECTED_Z_BOOST = 520;
const TASKS_NODE_BG = 'color-mix(in srgb, var(--vyasa-paper) 86%, var(--vyasa-primary) 14%)';
const TASKS_GROUP_BG = 'color-mix(in srgb, var(--vyasa-paper) 88%, var(--vyasa-primary) 12%)';
const TASKS_GROUP_EXPANDED_BG = 'color-mix(in srgb, var(--vyasa-primary) 7%, transparent)';
const TASKS_NODE_BORDER = '1px solid color-mix(in srgb, var(--vyasa-paper) 42%, var(--vyasa-primary) 58%)';
const TASKS_GROUP_TITLE_BG = 'color-mix(in srgb, var(--vyasa-paper) 76%, var(--vyasa-primary) 24%)';
const TASKS_EDGE_LABEL_BG = 'color-mix(in srgb, var(--vyasa-paper) 94%, var(--vyasa-primary) 6%)';
const TASKS_EDGE_LABEL_TEXT = 'var(--vyasa-ink)';
const TASKS_NODE_BG_ACTIVE = 'color-mix(in srgb, var(--vyasa-paper) 74%, var(--vyasa-primary) 26%)';
const TASKS_GROUP_BG_ACTIVE = 'color-mix(in srgb, var(--vyasa-primary) 10%, transparent)';
const TASKS_EDGE_FOCUS_OUT_COLOR = 'color-mix(in srgb, var(--vyasa-primary) 42%, #ef4444 58%)';
const TASKS_EDGE_FOCUS_IN_COLOR = 'color-mix(in srgb, var(--vyasa-primary) 40%, #22c55e 60%)';
const TASKS_AUTO_FIT_ON_EXPAND_DEFAULT = false;
const TASKS_AUTO_FIT_ON_FILTER_DEFAULT = true;
const TASKS_FILTER_PANEL_WIDTH = 320;
const TASKS_PROJECTION_GROUP_OPACITY_DEFAULT = 12;
const TASKS_PROJECTION_UNSPECIFIED_GROUP_OPACITY_DEFAULT = 7;
const TASKS_PROJECTION_UNSPECIFIED_CONTENT_OPACITY_DEFAULT = 0.82;
const TASKS_EDGE_OPACITY_MIN = 0.05;
const TASKS_EDGE_OPACITY_MAX = 1;
const TASKS_EGO_NEIGHBOR_OPACITY_DEFAULT = 0.25;
const TASKS_GRAPH_MIN_ZOOM = 0.05;
const TASKS_DONE_ACCENT = '#22c55e';
const TASKS_CARD_STATE_ATTR = 'card_state';
const TASKS_HAS_NOTE_ATTR = 'has_note';
const TASKS_FILTER_TEXT_VALUE_LIMIT = 24;
const TASKS_FILTER_TEXT_VALUE_LENGTH = 48;
const TASKS_HAS_NOTE_PALETTE = { yes: '#22c55e', no: 'rgba(220, 38, 38, 0.28)' };
const TASKS_DEFAULT_CARD_STATES = ['Not Done', 'Done'];
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

function clampTasksEgoNeighborOpacity(value) {
    const parsed = Number.parseFloat(String(value ?? ''));
    if (!Number.isFinite(parsed)) return TASKS_EGO_NEIGHBOR_OPACITY_DEFAULT;
    return Math.max(0.05, Math.min(1, parsed));
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

function normalizeTasksEdgeAnimationMode(mode, enabledFallback = undefined) {
    const text = String(mode || '').trim().toLowerCase();
    if (text === 'none' || text === 'tick' || text === 'smooth') return text;
    return enabledFallback === true ? 'smooth' : 'none';
}

function nextTasksEdgeAnimationMode(mode) {
    return ({ smooth: 'tick', tick: 'none', none: 'smooth' })[normalizeTasksEdgeAnimationMode(mode)] || 'smooth';
}

function clampTasksEdgeAnimationSteps(value) {
    return Math.max(2, Math.min(60, Math.round(Number(value) || 6)));
}

function clampTasksEdgeAnimationDuration(value) {
    return Math.max(0.2, Math.min(8, Number(value) || 1.2));
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

function tasksEdgeStrokeWidthForMode(mode, animated) {
    if (animated) return (mode === 'focused-in' || mode === 'focused-out') ? 5 : (mode === 'selected' ? 3.5 : 2.5);
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

function tasksIsIconifyImage(url) {
    return /^https:\/\/api\.iconify\.design\/.+\.svg(?:\?.*)?$/i.test(String(url || '').trim());
}

window.__vyasaTasksActions = window.__vyasaTasksActions || {};
window.__vyasaTasksConfig = window.__vyasaTasksConfig || {};
window.__vyasaTasksDebug = window.__vyasaTasksDebug || { events: [] };
window.__vyasaTasksDebug.enabled = window.__vyasaTasksDebug.enabled === true || new URLSearchParams(window.location.search).has('tasks_debug');
window.__vyasaTasksDebug.verbose = window.__vyasaTasksDebug.verbose === true || new URLSearchParams(window.location.search).has('tasks_debug_verbose');
window.__vyasaTasksDebug.edgeLabelRenderCount = Number(window.__vyasaTasksDebug.edgeLabelRenderCount || 0);
if (!Array.isArray(window.__vyasaTasksDebug.watch) || window.__vyasaTasksDebug.watch.length === 0) {
    const rawWatch = new URLSearchParams(window.location.search).getAll('tasks_watch');
    window.__vyasaTasksDebug.watch = rawWatch
        .flatMap((value) => String(value || '').split(','))
        .map((value) => value.trim())
        .filter(Boolean)
        .map((value) => {
            const [source, target] = value.split('->').map((part) => part.trim());
            return source && target ? { source, target } : null;
        })
        .filter(Boolean);
}

function renderTasksDebugOverlay() {
    if (!window.__vyasaTasksDebug.enabled || typeof document === 'undefined') return;
    let panel = document.getElementById('vyasa-tasks-debug-log');
    if (!panel) {
        panel = document.createElement('pre');
        panel.id = 'vyasa-tasks-debug-log';
        panel.style.cssText = 'position:fixed;left:16px;bottom:16px;z-index:4000;max-width:min(48rem,calc(100vw - 32px));max-height:40vh;overflow:auto;margin:0;padding:10px 12px;border-radius:10px;background:rgba(15,23,42,.94);color:#dbeafe;font:12px/1.45 ui-monospace,monospace;white-space:pre-wrap;box-shadow:0 12px 32px rgba(0,0,0,.35)';
        document.body.appendChild(panel);
    }
    const recent = (window.__vyasaTasksDebug.events || []).slice(-14).map((event) => {
        const payload = JSON.stringify(event.payload);
        return `${event.label} ${payload.length > 220 ? `${payload.slice(0, 220)}...` : payload}`;
    });
    const watches = (window.__vyasaTasksDebug.watch || []).map((item) => `${item.source}->${item.target}`);
    panel.textContent = `${watches.length ? `watch ${watches.join(', ')}\n` : ''}${recent.join('\n')}`;
}

function logTasksDebug(label, payload = {}) {
    if (!window.__vyasaTasksDebug.enabled) return null;
    const event = {
        label,
        at: new Date().toISOString(),
        payload,
    };
    window.__vyasaTasksDebug.events.push(event);
    if (window.__vyasaTasksDebug.events.length > 200) window.__vyasaTasksDebug.events.shift();
    console.log(`[vyasa][tasks-debug] ${label} ${JSON.stringify(payload)}`);
    renderTasksDebugOverlay();
    return event;
}

function logTasksDebugVerbose(label, payload = {}) {
    if (!window.__vyasaTasksDebug.verbose) return null;
    return logTasksDebug(label, payload);
}

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
    if (!id) return {};
    const projection = (Array.isArray(model?.view_projections) ? model.view_projections : [])
        .find((entry) => entry && entry.id === id);
    if (!projection) return {};
    const prefs = {};
    if (projection.filter_query && typeof projection.filter_query === 'object') {
        prefs.filters = normalizeTasksFilterQuery(projection.filter_query);
    }
    if (typeof projection.query_builder_enabled === 'boolean') prefs.queryBuilderEnabled = projection.query_builder_enabled;
    if (typeof projection.search === 'string') prefs.searchQuery = projection.search;
    if (typeof projection.default_color_by === 'string') prefs.colorBy = projection.default_color_by;
    if (typeof projection.default_secondary_color_by === 'string') prefs.secondaryColorBy = projection.default_secondary_color_by;
    if (typeof projection.filters_collapsed === 'boolean') prefs.filtersCollapsed = projection.filters_collapsed;
    if (typeof projection.edges_visible === 'boolean') prefs.edgesVisible = projection.edges_visible;
    if (typeof projection.edge_animation_enabled === 'boolean') prefs.edgeAnimationEnabled = projection.edge_animation_enabled;
    if (projection.edge_animation_mode) prefs.edgeAnimationMode = normalizeTasksEdgeAnimationMode(projection.edge_animation_mode, projection.edge_animation_enabled);
    if (projection.edge_animation_tick_steps !== undefined && projection.edge_animation_tick_steps !== '') prefs.edgeAnimationTickSteps = clampTasksEdgeAnimationSteps(projection.edge_animation_tick_steps);
    if (projection.edge_animation_tick_duration !== undefined && projection.edge_animation_tick_duration !== '') prefs.edgeAnimationTickDuration = clampTasksEdgeAnimationDuration(projection.edge_animation_tick_duration);
    if (projection.edge_opacity !== undefined && projection.edge_opacity !== '') prefs.edgeOpacity = clampTasksEdgeOpacity(projection.edge_opacity);
    if (projection.projection_unspecified_content_opacity !== undefined && projection.projection_unspecified_content_opacity !== '') {
        prefs.unspecifiedContentOpacity = clampTasksProjectionContentOpacity(projection.projection_unspecified_content_opacity);
    }
    return prefs;
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
    if (palette && typeof palette === 'object' && state in palette) return palette[state];
    return state === TASKS_DEFAULT_CARD_STATES[1] ? TASKS_DONE_ACCENT : '';
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
    try {
        storage.setItem(key, JSON.stringify(normalizeTasksCheckedNodeIds(checkedNodeIds)));
    } catch {
        // Best effort only.
    }
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
    const edgeOpacity = prefs?.edgeOpacity;
    const unspecifiedContentOpacity = prefs?.unspecifiedContentOpacity;
    const nodeStates = prefs?.nodeStates && typeof prefs.nodeStates === 'object' && !Array.isArray(prefs.nodeStates)
        ? prefs.nodeStates
        : {};
    const nodeNotes = normalizeTasksNodeNotes(prefs?.nodeNotes);
    const slideNotes = normalizeTasksSlideNotes(prefs?.slideNotes);
    const payload = JSON.stringify({
        version: 1,
        projectionId,
        edgeOpacity,
        unspecifiedContentOpacity,
        groupByHierarchy,
        projectionPrefs,
        nodeStates,
        nodeNotes,
        slideNotes,
    });
    const attempt = () => {
        storage.setItem(key, payload);
        touchTasksPrefsIndex(storage, key);
    };
    try {
        attempt();
        evictTasksPrefsLRU(storage, key);
    } catch {
        // Most likely QuotaExceededError. Evict aggressively (keep half the budget) and retry once.
        try {
            evictTasksPrefsLRU(storage, key, Math.floor(TASKS_PREFS_MAX_ENTRIES / 2));
            attempt();
        } catch {
            // localStorage may be unavailable, full, or restricted. Silent fail is fine — prefs are best-effort.
        }
    }
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

function normalizeTasksAttrText(value) {
    if (Array.isArray(value)) return value.map(normalizeTasksAttrText).filter(Boolean).join(', ');
    const text = String(value ?? '').trim();
    if (!text) return '';
    if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
        return text.slice(1, -1);
    }
    return text;
}

function tasksAttrValues(value) {
    const values = Array.isArray(value) ? value : [value];
    return Array.from(new Set(values
        .filter((entry) => typeof entry === 'string' || typeof entry === 'number' || typeof entry === 'boolean')
        .map((entry) => normalizeTasksAttrText(entry))
        .filter(Boolean)));
}

function tasksLogicalNodeId(node, fallback = '') {
    return String(node?.__source_node_id || fallback || node?.id || '').trim();
}

function tasksNodeMetaEntries(node) {
    if (!node) return [];
    return Object.entries(node)
        .filter(([key, value]) => !tasksIsHiddenNodeMetaKey(key) && tasksAttrValues(value).length)
        .map(([key, value]) => ({
            key,
            label: key.replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase()),
            value: normalizeTasksAttrText(value),
            renderedValue: typeof node?.__rendered_attrs__?.[key] === 'string' ? node.__rendered_attrs__[key] : '',
        }));
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

function tasksIsHiddenNodeMetaKey(key) {
    const normalized = String(key || '').toLowerCase();
    return TASKS_INTERNAL_NODE_META_KEYS.has(normalized)
        || TASKS_SPECIAL_NODE_ATTRS.has(String(key))
        || TASKS_DERIVED_METRIC_KEYS.has(normalized);
}

function tasksColorModeLabel(key) {
    return key === 'rank' ? 'Flow position' : tasksNodeMetaLabel(key);
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
    for (const [key, stat] of Array.from(metrics.entries()).sort(([left], [right]) => left.localeCompare(right))) {
        if (excludedDerivedKeys.has(String(key || '').toLowerCase())) continue;
        const label = tasksNodeMetaLabel(key);
        detailEntries.push({
            key: `range:${key}`,
            label,
            value: `${formatTasksMetricValue(stat.min)} ≤ ${label} (μ ${formatTasksMetricValue(stat.sum / Math.max(stat.count, 1))}) ≤ ${formatTasksMetricValue(stat.max)}`,
        });
    }
    for (const [key, counts] of Array.from(discreteColorCounts.entries()).sort(([left], [right]) => left.localeCompare(right))) {
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
        }))
        .sort((a, b) => a.label.localeCompare(b.label));
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
    for (const task of model.tasks || []) {
        if (task.group_id !== null && task.group_id !== undefined) continue;
        nodes.push({ id: task.id, label: task.label || task.id, href: task.href, kind: 'task', collapsed: true, x: 80, y: 80, width: 220, height: 60 });
    }
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
    const groups = [];
    const groupsByPath = new Map();
    const groupTree = { null: [] };
    const taskChildren = {};
    const tasks = [];
    const valuePath = (task) => attrs.map((attr) => String(task?.[attr] ?? '').trim() || TASKS_PROJECTION_UNSPECIFIED_LABEL);
    for (const task of sourceModel.tasks || []) {
        const path = valuePath(task);
        for (let depth = 1; depth <= path.length; depth += 1) {
            const prefix = path.slice(0, depth);
            const key = prefix.join('\u001f');
            if (groupsByPath.has(key)) continue;
            const parentKey = prefix.slice(0, -1).join('\u001f');
            const parentId = parentKey ? groupsByPath.get(parentKey)?.id : null;
            const attr = attrs[depth - 1];
            const value = prefix[prefix.length - 1];
            const groupId = tasksSlug(['custom', ...prefix.map((part, index) => `${attrs[index]}-${part}`)].join('__'));
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
        const leaf = groupsByPath.get(path.join('\u001f'));
        const taskCopy = { ...task, group_id: leaf?.id || null };
        tasks.push(taskCopy);
        const childKey = taskCopy.group_id === null ? 'null' : taskCopy.group_id;
        if (!taskChildren[childKey]) taskChildren[childKey] = [];
        taskChildren[childKey].push(taskCopy.id);
    }
    const visibleTaskIds = new Set(tasks.map((task) => task.id));
    const model = {
        ...sourceModel,
        graph_id: `${sourceModel.graph_id || 'tasks'}-custom-group-by`,
        groups,
        tasks,
        dependency_edges: (sourceModel.dependency_edges || []).filter((edge) => visibleTaskIds.has(edge.source) && visibleTaskIds.has(edge.target)),
        group_tree: groupTree,
        task_children: taskChildren,
        document_order: [...groups.map((group) => group.id), ...tasks.map((task) => task.id)],
        active_projection: '__custom_group_by__',
        default_color_by: attrs[0] || sourceModel.default_color_by || '',
        default_open_depth: -1,
    };
    delete model.projection_models;
    delete model.view_projections;
    return { model, graph: buildTasksCollapsedGraph(model), projectionId: '__custom_group_by__' };
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
    if (normalized <= stops[0].at) return stops[0].color;
    for (let index = 1; index < stops.length; index += 1) {
        const prev = stops[index - 1];
        const current = stops[index];
        if (normalized > current.at) continue;
        const span = current.at - prev.at;
        if (!Number.isFinite(span) || span <= 0) return current.color;
        return interpolateTasksHexColor(prev.color, current.color, (normalized - prev.at) / span) || current.color;
    }
    return stops[stops.length - 1].color;
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
    return averageTasksHexColors(colors) || colors[0]?.trim() || '';
}

function tasksEmptyFilterQuery() {
    return { combinator: 'and', rules: [] };
}

function tasksFilterQueryFromLegacy(filters) {
    const rules = Object.entries(filters || {})
        .filter(([, value]) => Array.isArray(value) ? value.length > 0 : Boolean(value))
        .map(([field, value]) => ({
            field,
            operator: Array.isArray(value) ? 'in' : '=',
            value,
        }));
    return { combinator: 'and', rules };
}

function normalizeTasksFilterQuery(filters) {
    if (!filters || typeof filters !== 'object') return tasksEmptyFilterQuery();
    if (Array.isArray(filters.rules)) {
        const normalized = {
            combinator: filters.combinator === 'or' ? 'or' : 'and',
            not: Boolean(filters.not),
            rules: filters.rules,
        };
        if (filters.muted) normalized.muted = true;
        return normalized;
    }
    return tasksFilterQueryFromLegacy(filters);
}

function tasksFilterQueryHasRules(query) {
    const normalized = normalizeTasksFilterQuery(query);
    if (normalized.muted) return false;
    return normalized.rules.some((rule) => {
        if (rule?.muted) return false;
        if (rule && Array.isArray(rule.rules)) return tasksFilterQueryHasRules(rule);
        return tasksFilterRuleIsActive(rule);
    });
}

function tasksFilterQueryHasAnyRules(query) {
    const normalized = normalizeTasksFilterQuery(query);
    return normalized.rules.some((rule) => {
        if (rule && Array.isArray(rule.rules)) return true;
        return Boolean(rule && typeof rule === 'object');
    });
}

function tasksCountFilterRules(query) {
    const normalized = normalizeTasksFilterQuery(query);
    if (normalized.muted) return 0;
    return normalized.rules.reduce((count, rule) => {
        if (rule?.muted) return count;
        if (rule && Array.isArray(rule.rules)) return count + tasksCountFilterRules(rule);
        return count + (tasksFilterRuleIsActive(rule) ? 1 : 0);
    }, 0);
}

function tasksPruneFilterQueryFields(query, validKeys) {
    const normalized = normalizeTasksFilterQuery(query);
    return {
        ...normalized,
        rules: normalized.rules.flatMap((rule) => {
            if (rule && Array.isArray(rule.rules)) {
                const pruned = tasksPruneFilterQueryFields(rule, validKeys);
                return pruned.rules.length ? [pruned] : [];
            }
            return rule?.field && validKeys.has(rule.field) ? [rule] : [];
        }),
    };
}

function toggleTasksFilterQueryValue(query, field, value, enabled) {
    const normalized = normalizeTasksFilterQuery(query);
    const root = normalized.combinator === 'and' || !tasksFilterQueryHasRules(normalized)
        ? normalized
        : { combinator: 'and', rules: [normalized] };
    const rules = root.rules.slice();
    const index = rules.findIndex((rule) => rule && !Array.isArray(rule.rules) && rule.field === field && rule.operator === 'in');
    const currentValues = index >= 0 ? tasksFilterValueList(rules[index].value) : [];
    const nextValues = enabled
        ? Array.from(new Set([...currentValues, String(value)]))
        : currentValues.filter((entry) => entry !== String(value));
    if (!nextValues.length) {
        if (index >= 0) rules.splice(index, 1);
    } else if (index >= 0) {
        rules[index] = { ...rules[index], value: nextValues };
    } else {
        rules.push({ field, operator: 'in', value: nextValues });
    }
    return { ...root, rules };
}

function tasksFilterQuerySelectedValues(query, field) {
    const normalized = normalizeTasksFilterQuery(query);
    const rule = normalized.rules.find((entry) => (
        entry && !Array.isArray(entry.rules) && entry.field === field && entry.operator === 'in'
    ));
    return rule ? tasksFilterValueList(rule.value) : [];
}

function tasksFilterValueEditorType(operator) {
    if (operator === 'notnull' || operator === 'null') return 'none';
    if (operator === 'contains' || operator === 'doesNotContain' || operator === 'matchesRegex') return 'text';
    if (operator === 'in' || operator === 'notIn') return 'multiselect';
    return 'select';
}

function tasksFilterRuleIsActive(rule) {
    if (!rule?.field || !rule?.operator) return false;
    if (rule.operator === 'notnull' || rule.operator === 'null') return true;
    if (rule.operator === 'in' || rule.operator === 'notIn') return tasksFilterValueList(rule.value).length > 0;
    return String(rule.value ?? '').trim() !== '';
}

function tasksFilterValueList(value) {
    if (Array.isArray(value)) return value.map((entry) => String(entry ?? '')).filter(Boolean);
    return String(value ?? '').split(',').map((entry) => entry.trim()).filter(Boolean);
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

function tasksNodeFilterValue(node, key) {
    if (key === TASKS_HAS_NOTE_ATTR) return [node?.__has_note__ ? 'yes' : 'no'];
    return tasksAttrValues(node?.[key]);
}

function tasksNodeFilterAttributeExists(node, key) {
    if (!node || !key || !(key in node)) return false;
    return tasksAttrValues(node[key]).length > 0;
}

function tasksNodeMatchesFilterRule(node, rule) {
    if (!rule?.field || !rule?.operator) return true;
    const nodeValues = tasksNodeFilterValue(node, rule.field);
    const values = tasksFilterValueList(rule.value);
    if (rule.operator === 'notnull') return tasksNodeFilterAttributeExists(node, rule.field);
    if (rule.operator === 'null') return !tasksNodeFilterAttributeExists(node, rule.field);
    if (rule.operator === 'in') return values.length ? values.some((value) => nodeValues.includes(value)) : true;
    if (rule.operator === 'notIn') return values.length ? values.every((value) => !nodeValues.includes(value)) : true;
    const target = String(rule.value ?? '');
    if (rule.operator === '!=') return !nodeValues.includes(target);
    if (rule.operator === 'contains') return nodeValues.some((value) => value.toLowerCase().includes(target.toLowerCase()));
    if (rule.operator === 'doesNotContain') return nodeValues.every((value) => !value.toLowerCase().includes(target.toLowerCase()));
    if (rule.operator === 'matchesRegex') {
        try {
            const regex = new RegExp(target);
            return nodeValues.some((value) => regex.test(value));
        } catch {
            return false;
        }
    }
    return nodeValues.includes(target);
}

function tasksNodeMatchesFilters(node, filters) {
    const query = normalizeTasksFilterQuery(filters);
    if (!tasksFilterQueryHasRules(query)) return true;
    const activeRules = query.rules.filter((rule) => (
        !rule?.muted && (rule && Array.isArray(rule.rules) ? tasksFilterQueryHasRules(rule) : tasksFilterRuleIsActive(rule))
    ));
    if (!activeRules.length) return true;
    const results = activeRules.map((rule) => (
        Array.isArray(rule.rules) ? tasksNodeMatchesFilters(node, rule) : tasksNodeMatchesFilterRule(node, rule)
    ));
    const matched = query.combinator === 'or' ? results.some(Boolean) : results.every(Boolean);
    return query.not ? !matched : matched;
}

function tasksNodeMatchesAllFilters(node, queryFilters, swatchFilters) {
    return tasksNodeMatchesFilters(node, queryFilters) && tasksNodeMatchesFilters(node, swatchFilters);
}

function tasksSearchNormalizeText(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function tasksSearchSpec(query) {
    const raw = tasksSearchNormalizeText(query);
    if (!raw) return { active: false, raw: '', error: '', matcher: null };
    if (raw.startsWith('/') && raw.lastIndexOf('/') > 0) {
        const end = raw.lastIndexOf('/');
        try {
            return { active: true, raw, error: '', matcher: new RegExp(raw.slice(1, end), raw.slice(end + 1).replace(/g/g, '')) };
        } catch (error) {
            return { active: true, raw, error: error instanceof Error ? error.message : 'Invalid regex', matcher: null };
        }
    }
    const normalized = ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'")))
        ? raw.slice(1, -1).trim()
        : raw;
    return { active: true, raw, error: '', matcher: normalized.toLowerCase() };
}

function tasksSearchMatchesText(value, spec) {
    if (!spec?.active || !spec.matcher) return false;
    const text = tasksSearchNormalizeText(value);
    if (!text) return false;
    return spec.matcher instanceof RegExp ? spec.matcher.test(text) : text.toLowerCase().includes(spec.matcher);
}

function tasksCollectSearchMatches(nodes, edges, query, nodeNotes = {}) {
    const spec = tasksSearchSpec(query);
    const nodeIds = new Set();
    const edgeIds = new Set();
    if (!spec.active || spec.error || !spec.matcher) return { ...spec, nodeIds, edgeIds };
    const hiddenEdgeKeys = new Set(['id', 'source', 'target', 'type', 'animated', 'markerend', 'labelstyle', 'labelbgstyle', 'style', 'data', 'zindex', 'sourcehandle', 'targethandle']);
    for (const node of (nodes || [])) {
        const data = node?.data || {};
        if (data.__kind__ === 'groupTitle') continue;
        const logicalNodeId = tasksLogicalNodeId(data, node?.id);
        const values = [node?.id, data.id, data.label, nodeNotes[logicalNodeId]];
        for (const [key, value] of Object.entries(data)) {
            if (tasksIsHiddenNodeMetaKey(key)) continue;
            if (value === null || value === undefined || typeof value === 'function') continue;
            values.push(...tasksAttrValues(value));
        }
        if (values.some((value) => tasksSearchMatchesText(value, spec))) nodeIds.add(node.id);
    }
    for (const edge of (edges || [])) {
        const values = [];
        for (const [key, value] of Object.entries(edge || {})) {
            if (hiddenEdgeKeys.has(String(key).toLowerCase())) continue;
            if (value === null || value === undefined || typeof value === 'function') continue;
            values.push(...tasksAttrValues(value));
        }
        if (!values.some((value) => tasksSearchMatchesText(value, spec))) continue;
        edgeIds.add(edge.id);
        if (edge.source) nodeIds.add(edge.source);
        if (edge.target) nodeIds.add(edge.target);
    }
    return { ...spec, nodeIds, edgeIds };
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
    return typeof color === 'string' && color.trim() ? color.trim() : '';
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
        if (typeof color === 'string' && color.trim()) return color.trim();
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
            return TASKS_HAS_NOTE_PALETTE[value] || '';
        }
        const values = tasksAttrValues(node[colorBy]);
        if (values.length) {
            if (isTasksGradientPalette(palette)) {
                const numeric = values.map(parseTasksNumericValue).filter((value) => value !== null);
                return numeric.length ? resolveTasksGradientColor(palette, numeric.reduce((sum, value) => sum + value, 0) / numeric.length) : '';
            }
            const colors = values.map((value) => palette[value]).filter((color) => typeof color === 'string' && color.trim());
            return averageTasksHexColors(colors) || colors[0]?.trim() || '';
        }
        return '';
    }
    if (typeof node.color === 'string' && node.color.trim()) return node.color.trim();
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

function tasksMixedFill(color, colorMix) {
    if (!color) return '';
    return colorMix && colorMix.enabled
        ? `color-mix(in srgb, var(--vyasa-paper) ${colorMix.paper}%, ${color} ${colorMix.intensity}%)`
        : color;
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

function ensureTasksReactFlow() {
    if (tasksReactFlowReady) return tasksReactFlowReady;
    tasksReactFlowReady = (async () => {
        const cssHref = 'https://unpkg.com/@xyflow/react@12.8.4/dist/style.css';
        if (!document.querySelector(`link[href="${cssHref}"]`)) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = cssHref;
            document.head.appendChild(link);
        }
        if (!document.getElementById('vyasa-tasks-reactflow-overrides')) {
            const style = document.createElement('style');
            style.id = 'vyasa-tasks-reactflow-overrides';
            style.textContent = `
                .tasks-container[data-tasks-maximized="true"] {
                    position: fixed !important;
                    inset: 0 !important;
                    left: 0 !important;
                    top: 0 !important;
                    width: 100vw !important;
                    height: 100dvh !important;
                    max-width: none !important;
                    margin: 0 !important;
                    transform: none !important;
                    border-radius: 0 !important;
                    border-width: 0 !important;
                    z-index: 10000;
                    display: flex;
                    flex-direction: column;
                    background: var(--vyasa-paper);
                }
                .tasks-container[data-tasks-maximized="true"] .vyasa-tasks-flow {
                    flex: 1 1 auto !important;
                    height: auto !important;
                    min-height: 0 !important;
                }
                .vyasa-tasks-fullscreen-toggle svg {
                    stroke-width: 1.5 !important;
                }
                .react-flow__edge-textwrapper,
                .react-flow__edge-text,
                .react-flow__edge-textbg {
                    pointer-events: none;
                }
                .react-flow__edgelabel-renderer {
                    pointer-events: none;
                }
                button[data-vyasa-tasks-action="toggleEdges"][data-vyasa-edges-off="true"] {
                    color: #fecaca !important;
                    border-color: #ef4444 !important;
                    background: #991b1b !important;
                    box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.45), 0 0 18px rgba(239, 68, 68, 0.72) !important;
                    transform: scale(1.18);
                    animation: vyasa-edges-off-pulse 0.65s ease-in-out infinite alternate !important;
                }
                @keyframes vyasa-edges-off-pulse {
                    from { transform: scale(1.08); background: #7f1d1d; box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.35), 0 0 10px rgba(239, 68, 68, 0.42); }
                    to { transform: scale(1.28); background: #dc2626; box-shadow: 0 0 0 5px rgba(239, 68, 68, 0.78), 0 0 34px rgba(239, 68, 68, 1); }
                }
                .vyasa-tasks-flow .react-flow__edge,
                .vyasa-tasks-flow .react-flow__edge path,
                .vyasa-tasks-flow .react-flow__edge-interaction {
                    pointer-events: none;
                }
                .vyasa-tasks-hovering-edge-labels .react-flow__edgelabel-renderer {
                    z-index: ${TASKS_EDGE_LABEL_FOCUS_Z + 200} !important;
                }
                .react-flow__node.vyasa-tasks-node--background,
                .react-flow__node.vyasa-tasks-node--passive {
                    pointer-events: none;
                }
                .react-flow__node[data-vyasa-group-toggle-hover="true"] {
                    box-shadow: 0 0 0 2px color-mix(in srgb, var(--vyasa-ink) 52%, transparent), 0 24px 64px color-mix(in srgb, var(--vyasa-primary) 10%, transparent) !important;
                }
                .react-flow__node.vyasa-tasks-node--passive [data-vyasa-task-control="true"] {
                    pointer-events: auto;
                }
                .vyasa-tasks-flow .react-flow__pane,
                .vyasa-tasks-flow .react-flow__node,
                .vyasa-tasks-flow .react-flow__node.selectable,
                .vyasa-tasks-flow .react-flow__node.draggable,
                .vyasa-tasks-flow .react-flow__node .vyasa-task-node-body {
                    cursor: grab !important;
                }
                .vyasa-tasks-flow .react-flow__node [data-vyasa-task-control="true"],
                .vyasa-tasks-flow .react-flow__controls button {
                    cursor: pointer !important;
                }
                .vyasa-tasks-flow .react-flow__controls {
                    box-shadow: 0 10px 30px rgba(0,0,0,0.12);
                    border-radius: 10px;
                    overflow: hidden;
                    border: 1px solid color-mix(in srgb, var(--vyasa-primary) 20%, transparent);
                    background: color-mix(in srgb, var(--vyasa-paper) 96%, transparent);
                }
                .vyasa-tasks-flow .react-flow__controls button {
                    width: 34px;
                    height: 34px;
                    border: 0;
                    border-bottom: 1px solid color-mix(in srgb, currentColor 14%, transparent);
                    background: color-mix(in srgb, var(--vyasa-paper) 96%, transparent);
                    color: var(--vyasa-ink);
                }
                .vyasa-tasks-flow .react-flow__controls button:last-child {
                    border-bottom: 0;
                }
                .vyasa-tasks-flow .react-flow__controls button:hover {
                    background: color-mix(in srgb, var(--vyasa-paper) 86%, var(--vyasa-primary) 14%);
                }
                .vyasa-tasks-flow .react-flow__controls button svg {
                    fill: none;
                    stroke: currentColor;
                }
                .dark .vyasa-tasks-flow .react-flow__controls,
                .dark .vyasa-tasks-flow .react-flow__controls button {
                    background: color-mix(in srgb, var(--vyasa-paper) 92%, #0f172a 8%);
                    color: color-mix(in srgb, white 88%, var(--vyasa-primary) 12%);
                }
                .dark .vyasa-tasks-flow .react-flow__controls button {
                    border-bottom-color: color-mix(in srgb, white 10%, transparent);
                }
                .dark .vyasa-tasks-flow .react-flow__controls button:hover {
                    background: color-mix(in srgb, var(--vyasa-paper) 72%, var(--vyasa-primary) 28%);
                }
                .dark .vyasa-tasks-node-image--icon {
                    filter: brightness(0) invert(1);
                }
                .dark .vyasa-tasks-node-image--icon.vyasa-tasks-node-image--dimmed {
                    filter: brightness(0) invert(1) grayscale(0.4);
                }
                .vyasa-tasks-filter-card {
                    border: 4px solid rgb(226 232 240) !important;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.12) !important;
                }
                .dark .vyasa-tasks-filter-card {
                    border-color: rgb(30 41 59) !important;
                }
                .vyasa-tasks-filter-card .queryBuilder {
                    display: grid;
                    gap: 8px;
                    font-size: 12px;
                    max-width: 100%;
                    overflow: hidden;
                }
                .vyasa-tasks-filter-card .ruleGroup {
                    border: 1px solid color-mix(in srgb, currentColor 12%, transparent);
                    border-radius: 10px;
                    background: color-mix(in srgb, var(--vyasa-paper) 96%, transparent);
                    padding: 8px;
                    min-width: 0;
                    max-width: 100%;
                    box-sizing: border-box;
                }
                .vyasa-tasks-filter-card .ruleGroup-header,
                .vyasa-tasks-filter-card .betweenRules {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                }
                .vyasa-tasks-filter-card .ruleGroup-notToggle {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    line-height: 1;
                }
                .vyasa-tasks-filter-card .rule,
                .vyasa-tasks-filter-card .ruleGroup-header {
                    gap: 6px;
                    align-items: center;
                    flex-wrap: wrap;
                    min-width: 0;
                }
                .vyasa-tasks-filter-card .rule {
                    display: grid !important;
                    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
                }
                .vyasa-tasks-filter-card .rule > * {
                    min-width: 0;
                }
                .vyasa-tasks-filter-card .rule .rule-value,
                .vyasa-tasks-filter-card .rule .rule-remove {
                    grid-column: 1 / -1;
                }
                .vyasa-tasks-filter-card .rule .rule-remove {
                    justify-self: start;
                }
                .vyasa-tasks-filter-card .vyasa-tasks-query-values {
                    display: grid;
                    gap: 4px;
                    max-height: 130px;
                    overflow: auto;
                    padding: 6px 8px;
                    border: 1px solid color-mix(in srgb, currentColor 12%, transparent);
                    border-radius: 8px;
                    background: color-mix(in srgb, var(--vyasa-paper) 96%, transparent);
                }
                .vyasa-tasks-filter-card .vyasa-tasks-query-value-option {
                    display: inline-flex;
                    align-items: center;
                    gap: 7px;
                    min-width: 0;
                }
                .vyasa-tasks-filter-card select,
                .vyasa-tasks-filter-card input[type="text"],
                .vyasa-tasks-filter-card .ruleGroup button {
                    border: 1px solid color-mix(in srgb, currentColor 16%, transparent);
                    border-radius: 8px;
                    background: color-mix(in srgb, var(--vyasa-paper) 96%, transparent);
                    color: inherit;
                    padding: 5px 7px;
                    max-width: 100%;
                    min-width: 0;
                    box-sizing: border-box;
                }
                .vyasa-tasks-filter-card input[type="checkbox"] {
                    appearance: none;
                    width: 16px;
                    height: 16px;
                    margin: 0;
                    border: 1px solid color-mix(in srgb, currentColor 28%, transparent);
                    border-radius: 4px;
                    background: color-mix(in srgb, var(--vyasa-paper) 96%, transparent);
                    display: inline-grid;
                    place-content: center;
                    flex: 0 0 auto;
                    vertical-align: middle;
                }
                .vyasa-tasks-filter-card input[type="checkbox"]:checked {
                    border-color: color-mix(in srgb, var(--vyasa-primary) 78%, currentColor 22%);
                    background: color-mix(in srgb, var(--vyasa-primary) 72%, white 28%);
                }
                .vyasa-tasks-filter-card input[type="checkbox"]:checked::before {
                    content: "";
                    width: 5px;
                    height: 9px;
                    border: solid var(--vyasa-paper);
                    border-width: 0 2px 2px 0;
                    transform: rotate(45deg) translateY(-1px);
                }
                .vyasa-tasks-filter-card .rule button,
                .vyasa-tasks-filter-card .ruleGroup button {
                    cursor: pointer;
                }
                .react-flow__edge.animated path {
                    animation: vyasa-edge-dashdraw var(--vyasa-edge-flow-duration, 0.6s) linear infinite;
                }
                .react-flow__edge.animated.vyasa-edge-animation-tick path {
                    animation: vyasa-edge-dashdraw var(--vyasa-edge-animation-duration, 1.2s) steps(var(--vyasa-edge-animation-steps, 6), jump-none) infinite;
                }
                .react-flow__edge.animated path.react-flow__edge-interaction {
                    animation: none;
                }
                @keyframes vyasa-edge-dashdraw {
                    from {
                        stroke-dashoffset: var(--vyasa-edge-dash-cycle, 10);
                    }
                    to {
                        stroke-dashoffset: 0;
                    }
                }
            `;
            document.head.appendChild(style);
        }
        for (const src of [
            'https://unpkg.com/react@18/umd/react.production.min.js',
            'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
            'https://unpkg.com/@xyflow/react@12.8.4/dist/umd/index.js',
        ]) {
            if (document.querySelector(`script[src="${src}"]`)) continue;
            await new Promise((resolve, reject) => {
                const s = document.createElement('script');
                s.src = src;
                s.onload = resolve;
                s.onerror = (event) => {
                    console.error('[tasks] script load failed', src, event);
                    reject(event);
                };
                document.head.appendChild(s);
            });
            if (src.includes('react-dom.production.min.js') && window.React && !window.jsxRuntime) {
                window.jsxRuntime = {
                    Fragment: window.React.Fragment,
                    jsx: (type, props, key) => window.React.createElement(type, { ...props, key }),
                    jsxs: (type, props, key) => window.React.createElement(type, { ...props, key }),
                };
            }
        }
        return window.React && window.ReactDOM && window.ReactFlow
            ? window.ReactFlow
            : null;
    })();
    return tasksReactFlowReady;
}

function ensureTasksQueryBuilder() {
    if (window.VyasaTasksQueryBuilder?.QueryBuilder) return Promise.resolve(window.VyasaTasksQueryBuilder);
    if (tasksQueryBuilderReady) return tasksQueryBuilderReady;
    tasksQueryBuilderReady = (async () => {
        const cssHref = '/static/extensions/tasks/vendor/react-querybuilder.css';
        if (!document.querySelector(`link[href="${cssHref}"]`)) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = cssHref;
            document.head.appendChild(link);
        }
        const src = '/static/extensions/tasks/vendor/react-querybuilder.global.js';
        if (!document.querySelector(`script[src="${src}"]`)) {
            await new Promise((resolve, reject) => {
                const s = document.createElement('script');
                s.src = src;
                s.onload = resolve;
                s.onerror = (event) => {
                    console.error('[tasks] script load failed', src, event);
                    reject(event);
                };
                document.head.appendChild(s);
            });
        }
        return window.VyasaTasksQueryBuilder || null;
    })();
    return tasksQueryBuilderReady;
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
                'elk.padding': `[top=${(layoutConfig.groupPadding || 40) + 28},left=${layoutConfig.groupPadding || 40},bottom=${layoutConfig.groupPadding || 40},right=${layoutConfig.groupPadding || 40}]`
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
                'elk.padding': `[top=${(layoutConfig.groupPadding || 40) + 28},left=${layoutConfig.groupPadding || 40},bottom=${layoutConfig.groupPadding || 40},right=${layoutConfig.groupPadding || 40}]`
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
                'elk.padding': `[top=${(layoutConfig.groupPadding || 40) + 28},left=${layoutConfig.groupPadding || 40},bottom=${layoutConfig.groupPadding || 40},right=${layoutConfig.groupPadding || 40}]`
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

async function layoutGroupInternal(groupId, model, childSizes = {}, jitterConfig = {}, layoutConfig = {}, useElkForGroups = true) {
    const groupsById = Object.fromEntries((model.groups || []).map((group) => [group.id, group]));
    const tasksById = Object.fromEntries((model.tasks || []).map((task) => [task.id, task]));
    const groupDirection = readTasksDirection(groupsById[groupId]?.layout_direction || groupsById[groupId]?.direction || layoutConfig.elkDirection);
    const groupChildren = [
        ...(model.group_tree?.[groupId] || []).map((id) => {
            const source = groupsById[id] || {};
            const label = source.label || id;
            return { id, __kind__: 'group', label, ...sizeTaskNode(label, 'group', null, { hasImage: Boolean(resolveTasksNodeImage(source, model)) }) };
        }),
        ...(model.task_children?.[groupId] || []).map((id) => {
            const source = tasksById[id] || {};
            const label = source.label || id;
            return { id, __kind__: 'task', label, ...sizeTaskNode(label, 'task', null, { hasImage: Boolean(resolveTasksNodeImage(source, model)) }) };
        }),
    ].map((child) => childSizes[child.id] ? { ...child, ...childSizes[child.id] } : child);
    if (groupChildren.length === 0) {
        return {
            positions: {},
            bbox: { width: 250, height: 80 },
        };
    }
    const childIds = new Set(groupChildren.map((child) => child.id));
    const childEdges = reduceTransitiveEdges((model.dependency_edges || [])
        .filter((edge) => childIds.has(edge.source) && childIds.has(edge.target)));
    if (useElkForGroups && childEdges.length > 0) {
        const elkLayout = await tasksElk.layout({
            id: `group-${groupId}`,
            layoutOptions: {
                'elk.algorithm': 'layered',
                'elk.direction': groupDirection,
                'elk.spacing.nodeNode': `${layoutConfig.nodeSpacing || 72}`,
                'elk.layered.spacing.nodeNodeBetweenLayers': `${layoutConfig.layerSpacing || 112}`,
                'elk.padding': `[top=${(layoutConfig.groupPadding || 40) + 28},left=${layoutConfig.groupPadding || 40},bottom=${layoutConfig.groupPadding || 40},right=${layoutConfig.groupPadding || 40}]`,
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
        return {
            positions,
            bbox: {
                width: Math.max(elkLayout.width || 0, 250),
                height: Math.max(elkLayout.height || 0, 80),
            },
        };
    }
    const packedLayout = layoutDisconnectedTaskNodes(groupChildren, groupDirection, {
        gap: Math.max(layoutConfig.nodeSpacing || 72, layoutConfig.layerSpacing || 112),
        padX: layoutConfig.groupPadding || 40,
        padTop: (layoutConfig.groupPadding || 40) + 28,
        padBottom: layoutConfig.groupPadding || 40,
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
    return {
        positions,
        bbox: {
            width: Math.max(packedLayout.bbox.width || 0, 250),
            height: Math.max(packedLayout.bbox.height || 0, 80),
        },
    };
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

function renderTasksInlineLinks(value, options = {}) {
    const text = String(value || '');
    const interactive = options.interactive !== false;
    const onInactiveClick = typeof options.onInactiveClick === 'function' ? options.onInactiveClick : null;
    const parts = [];
    const pattern = /\[([^\]]+)\]\(([^)\s]+(?:\s[^)]*)?)\)/g;
    let lastIndex = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) {
        if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
        const [, label, href] = match;
        parts.push(interactive
            ? window.React.createElement('a', {
                key: `${href}-${match.index}`,
                href,
                onClick: (event) => openTasksNodeHref(href, event),
                style: { textDecoration: 'underline', textUnderlineOffset: '2px', color: 'inherit' },
            }, label)
            : window.React.createElement('span', {
                key: `${href}-${match.index}`,
                onClick: onInactiveClick || undefined,
                style: { textDecoration: 'none', color: 'inherit' },
            }, label));
        lastIndex = pattern.lastIndex;
    }
    if (lastIndex < text.length) parts.push(text.slice(lastIndex));
    return parts.length ? parts : text;
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
    const id = String(activeProjectionId || '').trim();
    if (id) {
        const projection = projections.find((p) => p && p.id === id);
        if (projection && Array.isArray(projection.hover_attrs)) {
            return projection.hover_attrs.map((attr) => String(attr || '').trim()).filter(Boolean);
        }
    }
    if (Array.isArray(sourceModel?.hover_attrs)) {
        return sourceModel.hover_attrs.map((attr) => String(attr || '').trim()).filter(Boolean);
    }
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
    const titleWidth = measureTextWidth(title, titleFont);
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
    return Math.round(Math.min(options.maxWidth || 720, Math.max(options.minWidth || 280, titleWidth + idWidth + imageReserve + 44, weightedWidth + 136)));
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

function renderTasksDetailEntries(React, entries, options = {}) {
    return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', fontSize: options.fontSize || '12px', lineHeight: options.lineHeight || 1.35 } },
        ...(entries || []).map((entry, index) => {
            const canCopy = options.copyValues && String(entry?.value ?? '').trim();
            const copyValue = async (event) => {
                event.preventDefault();
                event.stopPropagation();
                await copyTasksText(entry.value);
            };
            return React.createElement('div', {
                key: entry.key || entry.attr || `${index}`,
                className: 'vyasa-task-node-card-row',
                style: { position: 'relative', paddingTop: index === 0 ? '0' : '8px', paddingRight: canCopy ? '26px' : 0, marginTop: index === 0 ? '0' : '8px', borderTop: index === 0 ? 'none' : '1px dashed color-mix(in srgb, currentColor 18%, transparent)', overflowWrap: 'anywhere', wordBreak: 'break-word', whiteSpace: 'pre-line' },
            },
            React.createElement('span', { style: { fontWeight: 700, opacity: 0.72, display: 'block', marginBottom: '4px' } }, `${entry.label}:`),
            entry.renderedValue
                ? React.createElement('span', { className: 'vyasa-task-node-card-value', dangerouslySetInnerHTML: { __html: entry.renderedValue } })
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

function tasksHeaderButtonHtml(widgetId, action, label, title) {
    return `<button type="button" title="${title}" data-vyasa-tasks-widget-id="${widgetId}" data-vyasa-tasks-action="${action}" onclick="runTasksHeaderAction('${widgetId}', '${action}')" class="rounded border border-slate-300 dark:border-slate-600 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-1.5 py-0.5 font-mono text-[10px] leading-none text-slate-700 dark:text-slate-300">${label}</button>`;
}

function tasksFullscreenIconHtml(on = false) {
    return `<uk-icon icon="${on ? 'shrink' : 'expand'}" class="w-4 h-4"></uk-icon>`;
}

function tasksHeaderControlsHtml(widgetId, includeFullscreen = false) {
    const fullscreen = includeFullscreen
        ? `<button onclick="openTasksFullscreen('${widgetId}')" data-vyasa-tasks-fullscreen-toggle="${widgetId}" class="vyasa-tasks-fullscreen-toggle px-1.5 py-1 text-xs border rounded inline-flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700" title="Fullscreen (Shift+F)" aria-label="Fullscreen (Shift+F)">${tasksFullscreenIconHtml(false)}</button>`
        : '';
    return `${fullscreen}<div class="flex items-center gap-1 text-[11px] font-medium tracking-wide text-slate-500 dark:text-slate-400 whitespace-nowrap">${tasksHeaderButtonHtml(widgetId, 'toggleHelp', '?', 'Show graph shortcuts and gestures')}${tasksHeaderButtonHtml(widgetId, 'openEgo', 'EG', 'Open selected ego graph (G)')}${tasksHeaderButtonHtml(widgetId, 'openEgoNeighbors', 'EG+', 'Open selected ego graph with neighbors (Shift+G)')}${tasksHeaderButtonHtml(widgetId, 'fit', 'F', 'Fit view')}${tasksHeaderButtonHtml(widgetId, 'toggleFilters', 'S', 'Toggle filters')}${tasksHeaderButtonHtml(widgetId, 'expandDepth', 'I', 'Expand next group depth')}${tasksHeaderButtonHtml(widgetId, 'collapseDepth', 'O', 'Collapse deepest group depth')}${tasksHeaderButtonHtml(widgetId, 'expand', 'U', 'Unfold all groups')}${tasksHeaderButtonHtml(widgetId, 'collapse', 'P', 'Collapse all groups')}${tasksHeaderButtonHtml(widgetId, 'toggleEdges', 'E', 'Toggle edges')}</div>`;
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

function tasksProjectionOptions(model, ganttEnabled = false) {
    const projections = Array.isArray(model?.view_projections) ? model.view_projections : [];
    const baseViewLabel = String(model?.base_view_label || '').trim() || 'Default';
    const options = [
        { id: '', label: baseViewLabel, caption: '' },
        ...projections
            .filter((projection) => projection && projection.id && model?.projection_models?.[projection.id])
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
    const acl = model?.acl && typeof model.acl === 'object' ? model.acl : {};
    const grants = acl.grants && typeof acl.grants === 'object' ? acl.grants : {};
    const people = acl.people && typeof acl.people === 'object' ? acl.people : {};
    const roles = Object.keys(grants).sort().map((role) => ({ id: role, label: `View as ${role}` }));
    const persons = Object.keys(people).sort().map((person) => ({ id: person, label: `View as ${person}` }));
    return [...roles, ...persons];
}

function tasksAclClassesForViewer(model, viewer) {
    const acl = model?.acl && typeof model.acl === 'object' ? model.acl : {};
    const classIds = new Set(Array.isArray(acl.classes) ? acl.classes.map(String) : []);
    const grants = acl.grants && typeof acl.grants === 'object' ? acl.grants : {};
    const people = acl.people && typeof acl.people === 'object' ? acl.people : {};
    const seeds = new Set([String(viewer || '').trim(), String(people[String(viewer || '').trim()] || '').trim()].filter(Boolean));
    const seen = new Set();
    const out = new Set();
    while (seeds.size) {
        const role = seeds.values().next().value;
        seeds.delete(role);
        if (seen.has(role)) continue;
        seen.add(role);
        for (const target of Array.isArray(grants[role]) ? grants[role] : []) {
            const id = String(target || '').trim();
            if (classIds.has(id)) out.add(id);
            else if (id) seeds.add(id);
        }
    }
    return out;
}

function maskTasksModelForAclViewer(sourceModel, sourceGraph, viewer) {
    const classes = tasksAclClassesForViewer(sourceModel, viewer);
    if (!classes.size) return { model: sourceModel, graph: sourceGraph };
    const allClasses = Array.isArray(sourceModel?.acl?.classes) ? sourceModel.acl.classes.map(String).filter(Boolean) : [];
    if (allClasses.length && allClasses.every((id) => classes.has(id))) return { model: sourceModel, graph: sourceGraph };
    const visible = (node) => {
        const values = Array.isArray(node?.cls) ? node.cls : [node?.cls];
        return values.some((value) => classes.has(String(value || '').trim()));
    };
    const groups = (sourceModel.groups || []).filter(visible);
    const tasks = (sourceModel.tasks || []).filter(visible);
    const visibleIds = new Set([...groups, ...tasks].map((node) => node.id));
    const dependency_edges = (sourceModel.dependency_edges || []).filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target));
    const group_tree = {};
    const task_children = {};
    for (const group of groups) {
        const parent = visibleIds.has(group.parent_group_id) ? group.parent_group_id : null;
        group_tree[parent] = [...(group_tree[parent] || []), group.id];
    }
    for (const task of tasks) {
        const parent = visibleIds.has(task.group_id) ? task.group_id : null;
        task_children[parent] = [...(task_children[parent] || []), task.id];
    }
    const graph = {
        nodes: (sourceGraph.nodes || []).filter((node) => visibleIds.has(node.id)),
        edges: (sourceGraph.edges || []).filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target)),
    };
    return { model: { ...sourceModel, groups, tasks, dependency_edges, group_tree, task_children, document_order: [...groups, ...tasks].map((node) => node.id) }, graph };
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

function tasksConfigListValue(values) {
    return (values || []).map((value) => String(value ?? '').trim()).filter(Boolean).join(',');
}

function tasksQuoteSchemaValue(value) {
    const text = String(value ?? '');
    return /[\s"=]/.test(text) ? `"${text.replace(/"/g, '\\"')}"` : text;
}

function buildTasksProjectionConfigText(config) {
    const cfg = config || {};
    const lines = [];
    const notes = [];
    const id = String(cfg.id || '').trim() || 'new-view';
    lines.push(`${id}:`);
    const add = (key, value) => {
        const text = String(value ?? '').trim();
        if (text) lines.push(`\t${key}=${tasksQuoteSchemaValue(text)}`);
    };
    if (cfg.source && cfg.source !== 'base') add('source', cfg.source);
    const groupBy = tasksConfigListValue(cfg.groupBy);
    if (groupBy) lines.push(`\tgroup_by=${groupBy}`);
    add('color_by', cfg.colorBy);
    add('secondary_color_by', cfg.secondaryColorBy);
    add('edge_color_by', cfg.edgeColorBy);
    add('edge_label_from', cfg.edgeLabelFrom);
    const hover = tasksConfigListValue(cfg.hoverAttrs);
    if (hover) lines.push(`\thover_attrs=${hover}`);
    if (cfg.aggregateEdges && typeof cfg.aggregateEdges === 'object') {
        const parts = [];
        if (cfg.aggregateEdges.when_collapsed) parts.push('when_collapsed=true');
        if (cfg.aggregateEdges.by) parts.push(`by=${cfg.aggregateEdges.by}`);
        if (parts.length) lines.push(`\taggregate_edges="${parts.join(' ')}"`);
    }
    const filterQuery = normalizeTasksFilterQuery(cfg.filterQuery);
    if (tasksFilterQueryHasAnyRules(filterQuery)) {
        lines.push(`\tfilter_query=${tasksQuoteSchemaValue(JSON.stringify(filterQuery))}`);
    }
    if (typeof cfg.queryBuilderEnabled === 'boolean') {
        lines.push(`\tquery_builder_enabled=${cfg.queryBuilderEnabled ? 'true' : 'false'}`);
    }
    add('search', cfg.searchQuery);
    if (typeof cfg.filtersCollapsed === 'boolean') lines.push(`\tfilters_collapsed=${cfg.filtersCollapsed ? 'true' : 'false'}`);
    if (typeof cfg.edgesVisible === 'boolean') lines.push(`\tedges_visible=${cfg.edgesVisible ? 'true' : 'false'}`);
    if (typeof cfg.edgeAnimationEnabled === 'boolean') lines.push(`\tedge_animation_enabled=${cfg.edgeAnimationEnabled ? 'true' : 'false'}`);
    if (cfg.edgeAnimationMode) lines.push(`\tedge_animation_mode=${normalizeTasksEdgeAnimationMode(cfg.edgeAnimationMode, cfg.edgeAnimationEnabled)}`);
    if (cfg.edgeAnimationTickSteps !== undefined) lines.push(`\tedge_animation_tick_steps=${clampTasksEdgeAnimationSteps(cfg.edgeAnimationTickSteps)}`);
    if (cfg.edgeAnimationTickDuration !== undefined) lines.push(`\tedge_animation_tick_duration=${clampTasksEdgeAnimationDuration(cfg.edgeAnimationTickDuration)}`);
    if (cfg.edgeOpacity !== undefined && cfg.edgeOpacity !== null && cfg.edgeOpacity !== '' && !Number.isNaN(Number(cfg.edgeOpacity))) {
        lines.push(`\tedge_opacity=${clampTasksEdgeOpacity(cfg.edgeOpacity)}`);
    }
    if (cfg.projectionUnspecifiedContentOpacity !== undefined && cfg.projectionUnspecifiedContentOpacity !== null && cfg.projectionUnspecifiedContentOpacity !== '' && !Number.isNaN(Number(cfg.projectionUnspecifiedContentOpacity))) {
        lines.push(`\tprojection_unspecified_content_opacity=${clampTasksProjectionContentOpacity(cfg.projectionUnspecifiedContentOpacity)}`);
    }
    const filterEntries = Object.entries(cfg.where || {})
        .map(([attr, value]) => {
            if (value === 'true') return [attr, ['true']];
            if (Array.isArray(value)) return [attr, value.map((entry) => String(entry).trim()).filter(Boolean)];
            return [attr, value ? [String(value).trim()] : []];
        })
        .filter(([, values]) => values.length);
    if (filterEntries.length === 1 && filterEntries[0][1].length === 1) {
        lines.push(`\twhere=${filterEntries[0][0]}=${tasksQuoteSchemaValue(filterEntries[0][1][0])}`);
    } else if (filterEntries.length) {
        notes.push("active filters (kg.schema 'where' takes one attr=value — split into separate views, or use markdown frontmatter 'where:' for multiple):");
        filterEntries.forEach(([attr, values]) => notes.push(`  ${attr} = ${values.join(' | ')}`));
    }
    add('caption', cfg.caption);
    if (cfg.defaultOpenDepth !== undefined && cfg.defaultOpenDepth !== null && cfg.defaultOpenDepth !== '' && !Number.isNaN(Number(cfg.defaultOpenDepth))) {
        lines.push(`\tdefault_open_depth=${cfg.defaultOpenDepth}`);
    }
    let out = `# Paste under your @views section in kg.schema:\n${lines.join('\n')}`;
    if (notes.length) out += `\n${notes.map((note) => `# ${note}`).join('\n')}`;
    return out;
}

function tasksUnquoteSchemaValue(value) {
    const text = String(value ?? '').trim();
    if (text.length >= 2 && ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'")))) {
        try {
            return JSON.parse(text.startsWith('"') ? text : `"${text.slice(1, -1).replace(/"/g, '\\"')}"`);
        } catch {
            return text.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
        }
    }
    return text;
}

function parseTasksProjectionConfigText(text) {
    const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'));
    const start = lines.findIndex((line) => line.endsWith(':') && !line.includes('='));
    const body = start >= 0 ? lines.slice(start + 1) : lines;
    const cfg = {};
    for (const line of body) {
        const eq = line.indexOf('=');
        if (eq <= 0) continue;
        const key = line.slice(0, eq).trim();
        const value = tasksUnquoteSchemaValue(line.slice(eq + 1));
        if (key === 'filter_query') {
            try { cfg.filterQuery = normalizeTasksFilterQuery(JSON.parse(value)); } catch { /* ignore bad paste */ }
        } else if (key === 'query_builder_enabled') cfg.queryBuilderEnabled = value === 'true';
        else if (key === 'search') cfg.searchQuery = value;
        else if (key === 'filters_collapsed') cfg.filtersCollapsed = value === 'true';
        else if (key === 'edges_visible') cfg.edgesVisible = value !== 'false';
        else if (key === 'edge_animation_enabled') cfg.edgeAnimationEnabled = value !== 'false';
        else if (key === 'edge_animation_mode') cfg.edgeAnimationMode = normalizeTasksEdgeAnimationMode(value, cfg.edgeAnimationEnabled);
        else if (key === 'edge_animation_tick_steps') cfg.edgeAnimationTickSteps = clampTasksEdgeAnimationSteps(value);
        else if (key === 'edge_animation_tick_duration') cfg.edgeAnimationTickDuration = clampTasksEdgeAnimationDuration(value);
        else if (key === 'edge_opacity') cfg.edgeOpacity = value;
        else if (key === 'projection_unspecified_content_opacity') cfg.projectionUnspecifiedContentOpacity = value;
        else if (key === 'color_by') cfg.colorBy = value;
        else if (key === 'secondary_color_by') cfg.secondaryColorBy = value;
        else if (key === 'group_by') cfg.groupBy = value.split(',').map((item) => item.trim()).filter(Boolean);
        else if (key === 'where' && !cfg.filterQuery) {
            const splitAt = value.indexOf('=');
            if (splitAt > 0) {
                cfg.filterQuery = normalizeTasksFilterQuery({
                    combinator: 'and',
                    rules: [{ field: value.slice(0, splitAt).trim(), operator: '=', value: value.slice(splitAt + 1).trim() }],
                });
            }
        }
    }
    return cfg;
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

function buildTasksViewState(sourceModel, sourceGraph, projectionId, viewMode, groupByHierarchy = []) {
    const customGroupedState = !String(projectionId || '').trim() ? buildTasksGroupedState(sourceModel, groupByHierarchy) : null;
    const projectionState = customGroupedState || selectTasksProjectionState(sourceModel, sourceGraph, projectionId);
    if (viewMode !== 'gantt') return projectionState;
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
        const egoMode = String(wrapper.dataset.tasksEgo || '').trim().toLowerCase() === 'true';
        const TasksGraphApp = (props) => {
            const React = window.React;
            const Handle = rf.Handle;
            const Position = rf.Position;
            const markWidgetActive = React.useCallback(() => {
                window.__vyasaTasksActiveWidgetId = widgetId;
            }, []);
            const [sourceModel, setSourceModel] = React.useState(() => initialSourceModel);
            const [sourceGraph, setSourceGraph] = React.useState(() => initialSourceGraph);
            const sourcePrefsRef = React.useRef(null);
            if (sourcePrefsRef.current === null) sourcePrefsRef.current = readTasksPrefs(sourceModel);
            const [activeAclViewer, setActiveAclViewer] = React.useState('');
            const aclViewerOptions = React.useMemo(() => egoMode ? [] : tasksAclViewerOptions(sourceModel), [egoMode, sourceModel]);
            const maskedSource = React.useMemo(
                () => maskTasksModelForAclViewer(sourceModel, sourceGraph, activeAclViewer),
                [sourceModel, sourceGraph, activeAclViewer]
            );
            const projectionOptions = React.useMemo(() => egoMode ? [] : tasksProjectionOptions(sourceModel, ganttEnabled), [egoMode, sourceModel, ganttEnabled]);
            const contextOptions = React.useMemo(() => (
                Array.isArray(sourceModel?.kg_contexts) ? sourceModel.kg_contexts.filter((item) => item && item.id) : []
            ), [sourceModel]);
            const activeContextId = String(sourceModel?.kg_context?.id || '').trim();
            const [contextLoading, setContextLoading] = React.useState(false);
            const storedProjectionPrefsRef = React.useRef(sourcePrefsRef.current?.projectionPrefs && typeof sourcePrefsRef.current.projectionPrefs === 'object'
                ? sourcePrefsRef.current.projectionPrefs
                : {});
            const initialProjectionId = React.useMemo(() => {
                if (defaultViewMode === 'gantt') return TASKS_GANTT_PROJECTION_ID;
                const saved = String(sourcePrefsRef.current?.projectionId || '').trim();
                if (projectionOptions.some((option) => option.id === saved)) return saved;
                const configured = String(sourceModel?.default_projection || '').trim();
                return projectionOptions.some((option) => option.id === configured) ? configured : '';
            }, [sourceModel, projectionOptions]);
            const initialGraphProjectionId = initialProjectionId === TASKS_GANTT_PROJECTION_ID ? '' : initialProjectionId;
            const [activeProjectionId, setActiveProjectionId] = React.useState(initialGraphProjectionId);
            const [viewMode, setViewMode] = React.useState(defaultViewMode);
            const [groupByHierarchy, setGroupByHierarchy] = React.useState(() => (
                Array.isArray(sourcePrefsRef.current?.groupByHierarchy) ? sourcePrefsRef.current.groupByHierarchy : []
            ));
            const projectionState = React.useMemo(
                () => buildTasksViewState(maskedSource.model, maskedSource.graph, activeProjectionId, viewMode, groupByHierarchy),
                [maskedSource, activeProjectionId, viewMode, groupByHierarchy]
            );
            const model = projectionState.model;
            const effectiveDefaultOpenDepth = Number.parseInt(tasksModelSetting(model, 'default_open_depth', `${defaultOpenDepth}`), 10);
            const jitterConfig = React.useMemo(() => ({
                x: Number.parseFloat(tasksModelSetting(model, 'jitter', wrapper.dataset.tasksJitter || '0')),
                y: Number.parseFloat(tasksModelSetting(model, 'jitter_y', wrapper.dataset.tasksJitterY || wrapper.dataset.tasksJitter || '0')),
            }), [model]);
            const layoutConfig = React.useMemo(() => readTasksLayoutConfigForModel(wrapper, model), [model]);
            const nodeCardWidth = String(tasksModelSetting(model, 'node-card-width', wrapper.dataset.tasksNodeCardWidth || '480px')).trim() || '480px';
            const hoverFontSize = String(tasksModelSetting(model, 'hover-font-size', wrapper.dataset.tasksHoverFontSize || '12px')).trim() || '12px';
            const colorMix = readTasksColorMixConfigForModel(wrapper, model);
            const projectionGroupOpacity = Math.max(0, Math.min(100, Number.parseFloat(tasksModelSetting(model, 'projection-group-opacity', wrapper.dataset.tasksProjectionGroupOpacity || `${TASKS_PROJECTION_GROUP_OPACITY_DEFAULT}`)) || TASKS_PROJECTION_GROUP_OPACITY_DEFAULT));
            const projectionUnspecifiedGroupOpacity = Math.max(0, Math.min(100, Number.parseFloat(tasksModelSetting(model, 'projection-unspecified-group-opacity', wrapper.dataset.tasksProjectionUnspecifiedGroupOpacity || `${TASKS_PROJECTION_UNSPECIFIED_GROUP_OPACITY_DEFAULT}`)) || TASKS_PROJECTION_UNSPECIFIED_GROUP_OPACITY_DEFAULT));
            const defaultProjectionUnspecifiedContentOpacity = clampTasksProjectionContentOpacity(tasksModelSetting(model, 'projection-unspecified-content-opacity', wrapper.dataset.tasksProjectionUnspecifiedContentOpacity || `${TASKS_PROJECTION_UNSPECIFIED_CONTENT_OPACITY_DEFAULT}`));
            const projectionGroupExpandedOpacity = Math.max(1, Math.min(projectionGroupOpacity, Math.round(projectionGroupOpacity * 0.5)));
            const projectionUnspecifiedGroupExpandedOpacity = Math.max(1, Math.min(projectionUnspecifiedGroupOpacity, Math.round(projectionUnspecifiedGroupOpacity * 0.5)));
            const rawGraph = React.useMemo(
                () => normalizeTasksGraphNodes(projectionState.graph || { nodes: [], edges: [] }, model),
                [projectionState, model]
            );
            const initialExpandedSet = React.useMemo(
                () => collectExpandedGroupsByDepth(model.group_tree, Number.isNaN(effectiveDefaultOpenDepth) ? 0 : effectiveDefaultOpenDepth),
                [model, effectiveDefaultOpenDepth]
            );
            const baseLayoutRef = React.useRef(null);
            const groupLayoutsRef = React.useRef({});
            const graphBaseRef = React.useRef({ nodes: [], edges: [] });
            const flowWrapperRef = React.useRef(null);
            const filterPanelRef = React.useRef(null);
            const projectionPrefs = React.useMemo(
                () => readTasksProjectionPrefsForModel(sourceModel, { projectionPrefs: storedProjectionPrefsRef.current }, activeProjectionId),
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
            const [dragSelection, setDragSelection] = React.useState(null);
            const [hoveredNodeId, setHoveredNodeId] = React.useState(null);
            const [groupHoverTooltip, setGroupHoverTooltip] = React.useState(null);
            const [helpOpen, setHelpOpen] = React.useState(false);
            const slides = React.useMemo(() => {
                const list = (Array.isArray(sourceModel?.slides) && sourceModel.slides.length) ? sourceModel.slides : (Array.isArray(model?.slides) ? model.slides : []);
                return list.filter((slide) => slide && Array.isArray(slide.nodes) && slide.nodes.length);
            }, [sourceModel, model]);
            const [slideIndex, setSlideIndex] = React.useState(-1);
            React.useEffect(() => {
                const slide = slideIndex >= 0 ? slides[slideIndex] : null;
                if (!slide) return;
                const ids = new Set((slide.nodes || []).map((id) => String(id || '').trim()).filter(Boolean));
                setSelectedNodeId(null);
                setSelectedNodeIds(new Set(ids));
                const timer = window.setTimeout(() => {
                    const reactFlow = reactFlowApiRef.current;
                    const matched = (graphBaseRef.current.nodes || []).filter((node) => node?.id && ids.has(node.id));
                    if (reactFlow && matched.length) reactFlow.fitView({ nodes: matched, duration: 400, padding: 0.3, includeHiddenNodes: true });
                }, 80);
                return () => window.clearTimeout(timer);
            }, [slideIndex, slides]);
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
            React.useEffect(() => {
                selectedNodeIdRef.current = selectedNodeId;
            }, [selectedNodeId]);
            React.useEffect(() => {
                selectedNodeIdsRef.current = new Set(selectedNodeIds);
            }, [selectedNodeIds]);
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
            const [edgesVisible, setEdgesVisible] = React.useState(() => (
                typeof projectionPrefs?.edgesVisible === 'boolean' ? projectionPrefs.edgesVisible : true
            ));
            const [edgeAnimationMode, setEdgeAnimationMode] = React.useState(() => (
                normalizeTasksEdgeAnimationMode(projectionPrefs?.edgeAnimationMode, projectionPrefs?.edgeAnimationEnabled)
            ));
            const [edgeAnimationTickSteps, setEdgeAnimationTickSteps] = React.useState(() => clampTasksEdgeAnimationSteps(projectionPrefs?.edgeAnimationTickSteps));
            const [edgeAnimationTickDuration, setEdgeAnimationTickDuration] = React.useState(() => clampTasksEdgeAnimationDuration(projectionPrefs?.edgeAnimationTickDuration));
            const edgeAnimationEnabled = edgeAnimationMode !== 'none';
            const edgeAnimationClassName = edgeAnimationMode === 'tick' ? 'vyasa-edge-animation-tick' : '';
            const edgeAnimationStyle = React.useMemo(() => ({
                '--vyasa-edge-animation-steps': String(edgeAnimationTickSteps),
                '--vyasa-edge-animation-duration': `${edgeAnimationTickDuration}s`,
            }), [edgeAnimationTickSteps, edgeAnimationTickDuration]);
            React.useEffect(() => {
                syncTasksEdgeToggleButtons(widgetId, edgesVisible);
            }, [widgetId, edgesVisible]);
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
            const [egoNeighborOpacity, setEgoNeighborOpacity] = React.useState(TASKS_EGO_NEIGHBOR_OPACITY_DEFAULT);
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
            const [graphRevision, setGraphRevision] = React.useState(0);
            const [graphMinZoom, setGraphMinZoom] = React.useState(TASKS_GRAPH_MIN_ZOOM);
            const [queryBuilderReady, setQueryBuilderReady] = React.useState(() => Boolean(window.VyasaTasksQueryBuilder?.QueryBuilder));
            const [nodes, setNodes] = React.useState([]);
            const [edges, setEdges] = React.useState([]);
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
            const hoverClearTimerRef = React.useRef(null);
            const groupToggleHoverIdRef = React.useRef('');
            const suppressNextGraphClickRef = React.useRef(false);
            const lastNodeClickRef = React.useRef(null);
            const activeProjection = React.useMemo(() => {
                const projections = Array.isArray(sourceModel?.view_projections) ? sourceModel.view_projections : [];
                const id = String(activeProjectionId || '').trim();
                return id ? (projections.find((p) => p && p.id === id) || null) : null;
            }, [sourceModel, activeProjectionId]);
            const activeColorBy = activeColorHierarchy[0] || '';
            const setActiveColorLevel = React.useCallback((index, value) => {
                setActiveColorHierarchy((current) => {
                    const next = Array.isArray(current) ? current.slice() : [];
                    const key = String(value || '').trim();
                    if (key) next[index] = key;
                    else next.splice(index);
                    return normalizeTasksColorHierarchy(next, model, nodeNotes);
                });
            }, [model, nodeNotes]);
            const activeColorLevelSpecs = React.useMemo(() => activeColorHierarchy.map((colorBy) => ({
                colorBy,
                palette: tasksColorPaletteFor(model, colorBy),
            })), [model, activeColorHierarchy]);
            const activeColorPalette = activeColorLevelSpecs[0]?.palette || {};
            React.useEffect(() => {
                baseLayoutRef.current = null;
                groupLayoutsRef.current = {};
                graphBaseRef.current = { nodes: [], edges: [] };
                const nextPrefs = readTasksProjectionPrefsForModel(sourceModel, { projectionPrefs: storedProjectionPrefsRef.current }, activeProjectionId);
                setExpanded(egoMode ? tasksExpandableNodeIds(model) : hydrateExpandedSet(nextPrefs));
                setSelectedNodeId(null);
                setSelectedNodeIds(new Set());
                setDragSelection(null);
                setHoveredNodeId(null);
                groupToggleHoverIdRef.current = '';
                setTasksGroupToggleHover(flowWrapperRef.current, '');
                pendingFitActionRef.current = 'mode';
            }, [sourceModel, activeProjectionId, hydrateExpandedSet]);
            React.useEffect(() => {
                const nextPrefs = readTasksProjectionPrefsForModel(sourceModel, { projectionPrefs: storedProjectionPrefsRef.current }, activeProjectionId);
                setActiveFilters(egoMode ? tasksEmptyFilterQuery() : normalizeTasksFilterQuery(nextPrefs?.filters));
                setActiveSwatchFilters(egoMode ? tasksEmptyFilterQuery() : normalizeTasksFilterQuery(nextPrefs?.swatchFilters));
                setSearchQuery(egoMode ? '' : (typeof nextPrefs?.searchQuery === 'string' ? nextPrefs.searchQuery : ''));
                setSearchInputValue(egoMode ? '' : (typeof nextPrefs?.searchQuery === 'string' ? nextPrefs.searchQuery : ''));
                setActiveColorHierarchy(resolveTasksPreferredColorHierarchy(model, activeProjectionId, nextPrefs, nodeNotes));
                setFiltersCollapsed(
                    typeof nextPrefs?.filtersCollapsed === 'boolean'
                        ? nextPrefs.filtersCollapsed
                        : !tasksDefaultFiltersOpen(defaultFiltersOpen)
                );
                setQueryBuilderEnabled(typeof nextPrefs?.queryBuilderEnabled === 'boolean' ? nextPrefs.queryBuilderEnabled : true);
                setEdgesVisible(typeof nextPrefs?.edgesVisible === 'boolean' ? nextPrefs.edgesVisible : true);
                setEdgeAnimationMode(normalizeTasksEdgeAnimationMode(nextPrefs?.edgeAnimationMode, nextPrefs?.edgeAnimationEnabled));
                setEdgeAnimationTickSteps(clampTasksEdgeAnimationSteps(nextPrefs?.edgeAnimationTickSteps));
                setEdgeAnimationTickDuration(clampTasksEdgeAnimationDuration(nextPrefs?.edgeAnimationTickDuration));
                setEdgeOpacity(nextPrefs?.edgeOpacity !== undefined ? nextPrefs.edgeOpacity : (
                    sourcePrefsRef.current?.edgeOpacity === undefined ? defaultEdgeOpacity : clampTasksEdgeOpacity(sourcePrefsRef.current.edgeOpacity)
                ));
                setProjectionUnspecifiedContentOpacity(nextPrefs?.unspecifiedContentOpacity !== undefined ? nextPrefs.unspecifiedContentOpacity : (
                    sourcePrefsRef.current?.unspecifiedContentOpacity === undefined ? defaultProjectionUnspecifiedContentOpacity : clampTasksProjectionContentOpacity(sourcePrefsRef.current.unspecifiedContentOpacity)
                ));
            }, [sourceModel, activeProjectionId, model, nodeNotes, defaultFiltersOpen, defaultEdgeOpacity, defaultProjectionUnspecifiedContentOpacity]);
            React.useEffect(() => {
                const timeoutId = window.setTimeout(() => {
                    setSearchQuery(searchInputValue);
                }, 140);
                return () => window.clearTimeout(timeoutId);
            }, [searchInputValue]);
            React.useEffect(() => {
                if (egoMode || filtersCollapsed || !queryBuilderEnabled) return;
                if (window.VyasaTasksQueryBuilder?.QueryBuilder) {
                    setQueryBuilderReady(true);
                    return;
                }
                let active = true;
                ensureTasksQueryBuilder()
                    .then((bundle) => {
                        if (active && bundle?.QueryBuilder) setQueryBuilderReady(true);
                    })
                    .catch((error) => console.error('[tasks] query builder load failed', error));
                return () => { active = false; };
            }, [egoMode, filtersCollapsed, queryBuilderEnabled]);
            const effectiveQueryFilters = React.useMemo(
                () => (queryBuilderEnabled ? activeFilters : tasksEmptyFilterQuery()),
                [queryBuilderEnabled, activeFilters]
            );
            const searchMatches = React.useMemo(
                () => tasksCollectSearchMatches(graphBaseRef.current.nodes || [], graphBaseRef.current.edges || [], searchQuery, nodeNotes),
                [graphRevision, searchQuery, nodeNotes]
            );
            const filteredSelectionIds = React.useCallback(() => {
                const hasFilters = tasksFilterQueryHasRules(effectiveQueryFilters) || tasksFilterQueryHasRules(activeSwatchFilters);
                const hasSearch = searchMatches.active && !searchMatches.error;
                if (!hasFilters && !hasSearch) return new Set();
                return new Set((graphBaseRef.current.nodes || [])
                    .filter((node) => node?.id && node.data?.__kind__ !== 'groupTitle')
                    .filter((node) => {
                        const filterHit = hasFilters ? tasksNodeMatchesAllFilters(node.data, effectiveQueryFilters, activeSwatchFilters) : true;
                        const searchHit = hasSearch ? searchMatches.nodeIds.has(node.id) : true;
                        return filterHit && searchHit;
                    })
                    .map((node) => node.id));
            }, [effectiveQueryFilters, activeSwatchFilters, searchMatches]);
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
            React.useEffect(() => {
                const validFilterKeys = new Set(tasksFilterOptions(model).map((option) => option.key));
                const validColorKeys = new Set(tasksColorOptions(model, nodeNotes).map((option) => option.key));
                const defaultColorBy = tasksResolvedProjectionDefaultColorBy(model, nodeNotes);
                setActiveFilters((current) => tasksPruneFilterQueryFields(current, validFilterKeys));
                setActiveSwatchFilters((current) => tasksPruneFilterQueryFields(current, validFilterKeys));
                setActiveColorHierarchy((current) => {
                    const normalized = normalizeTasksColorHierarchy(current, model, nodeNotes);
                    return normalized.length ? normalized : (validColorKeys.has(defaultColorBy) ? [defaultColorBy] : []);
                });
            }, [model, nodeNotes]);
            React.useEffect(() => {
                const activeSwatchKeys = new Set(activeColorHierarchy.filter(Boolean));
                setActiveSwatchFilters((current) => tasksPruneFilterQueryFields(current, activeSwatchKeys));
            }, [activeColorHierarchy]);
            React.useEffect(() => {
                if (lastPersistedProjectionIdRef.current !== activeProjectionId) {
                    lastPersistedProjectionIdRef.current = activeProjectionId;
                    return;
                }
                const projectionKey = tasksProjectionPrefsKey(activeProjectionId);
                const nextProjectionPrefs = {
                    ...storedProjectionPrefsRef.current,
                    [projectionKey]: {
                        filters: activeFilters,
                        swatchFilters: activeSwatchFilters,
                        queryBuilderEnabled,
                        searchQuery,
                        colorBy: activeColorBy,
                        secondaryColorBy: activeColorHierarchy[1] || '',
                        colorHierarchy: activeColorHierarchy,
                        filtersCollapsed,
                        edgesVisible,
                        edgeAnimationEnabled,
                        edgeAnimationMode,
                        edgeAnimationTickSteps,
                        edgeAnimationTickDuration,
                        edgeOpacity,
                        unspecifiedContentOpacity: projectionUnspecifiedContentOpacity,
                        expandedGroupIds: Array.from(expanded),
                    },
                };
                sourcePrefsRef.current = {
                    ...(sourcePrefsRef.current || {}),
                    projectionId: activeProjectionId,
                    edgeOpacity,
                    unspecifiedContentOpacity: projectionUnspecifiedContentOpacity,
                    groupByHierarchy,
                    projectionPrefs: nextProjectionPrefs,
                    nodeStates,
                    nodeNotes,
                    slideNotes,
                };
                storedProjectionPrefsRef.current = nextProjectionPrefs;
                writeTasksPrefs(sourceModel, {
                    projectionId: activeProjectionId,
                    edgeOpacity,
                    unspecifiedContentOpacity: projectionUnspecifiedContentOpacity,
                    groupByHierarchy,
                    projectionPrefs: nextProjectionPrefs,
                    nodeStates,
                    nodeNotes,
                    slideNotes,
                });
                writeTasksCheckedNodeIds(sourceModel, checkedNodeIdsFromStates(nodeStates));
            }, [sourceModel, activeFilters, activeSwatchFilters, queryBuilderEnabled, searchQuery, activeColorHierarchy, activeColorBy, activeProjectionId, filtersCollapsed, edgesVisible, edgeAnimationEnabled, edgeAnimationMode, edgeAnimationTickSteps, edgeAnimationTickDuration, edgeOpacity, projectionUnspecifiedContentOpacity, groupByHierarchy, expanded, nodeStates, nodeNotes, slideNotes]);
            const applyProjectionConfigToSidebar = React.useCallback((cfg) => {
                if (!tasksProjectionConfigHasSidebarState(cfg)) return false;
                if (cfg.filterQuery) setActiveFilters(normalizeTasksFilterQuery(cfg.filterQuery));
                if (typeof cfg.queryBuilderEnabled === 'boolean') setQueryBuilderEnabled(cfg.queryBuilderEnabled);
                if (typeof cfg.searchQuery === 'string') {
                    setSearchQuery(cfg.searchQuery);
                    setSearchInputValue(cfg.searchQuery);
                }
                if (typeof cfg.filtersCollapsed === 'boolean') setFiltersCollapsed(cfg.filtersCollapsed);
                if (typeof cfg.edgesVisible === 'boolean') setEdgesVisible(cfg.edgesVisible);
                if (cfg.edgeAnimationMode || typeof cfg.edgeAnimationEnabled === 'boolean') setEdgeAnimationMode(normalizeTasksEdgeAnimationMode(cfg.edgeAnimationMode, cfg.edgeAnimationEnabled));
                if (cfg.edgeAnimationTickSteps !== undefined) setEdgeAnimationTickSteps(clampTasksEdgeAnimationSteps(cfg.edgeAnimationTickSteps));
                if (cfg.edgeAnimationTickDuration !== undefined) setEdgeAnimationTickDuration(clampTasksEdgeAnimationDuration(cfg.edgeAnimationTickDuration));
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
                const available = tasksProjectionOptions(nextModel, ganttEnabled).some((option) => option.id === wanted);
                setActiveProjectionId(available ? wanted : String(nextModel?.default_projection || ''));
                setViewMode('graph');
                setSelectedNodeId(null);
                setSelectedNodeIds(new Set());
                setDragSelection(null);
                setHoveredNodeId(null);
                if (options?.resetSlideIndex) setSlideIndex((index) => index >= 0 ? 0 : -1);
                pendingFitActionRef.current = 'mode';
            }, [sourceModel, activeProjectionId, ganttEnabled]);
            const handleSwitchContext = React.useCallback(async (contextId) => {
                const schemaPath = String(sourceModel?.kg_schema || '').trim();
                if (!schemaPath || !contextId || contextId === activeContextId) return;
                setContextLoading(true);
                try {
                    const payload = await loadTasksContext({
                        schemaPath,
                        currentPath: sourceModel?.document_path || '',
                        contextId,
                    });
                    applyLoadedSource(payload, null, { resetSlideIndex: true });
                } catch (error) {
                    window.alert(error instanceof Error ? error.message : String(error));
                } finally {
                    setContextLoading(false);
                }
            }, [sourceModel, activeContextId, applyLoadedSource]);
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
                const defaults = tasksProjectionSchemaPrefs(sourceModel, activeProjectionId);
                const defaultSearch = typeof defaults.searchQuery === 'string' ? defaults.searchQuery : '';
                setActiveFilters(normalizeTasksFilterQuery(defaults.filters));
                setActiveSwatchFilters(tasksEmptyFilterQuery());
                setQueryBuilderEnabled(typeof defaults.queryBuilderEnabled === 'boolean' ? defaults.queryBuilderEnabled : true);
                setSearchInputValue(defaultSearch);
                setSearchQuery(defaultSearch);
                setActiveColorHierarchy(resolveTasksPreferredColorHierarchy(model, activeProjectionId, defaults, nodeNotes));
                setGroupByHierarchy([]);
                setExpanded(hydrateExpandedSet(defaults));
                setFiltersCollapsed(
                    typeof defaults.filtersCollapsed === 'boolean'
                        ? defaults.filtersCollapsed
                        : !tasksDefaultFiltersOpen(defaultFiltersOpen)
                );
                setEdgesVisible(typeof defaults.edgesVisible === 'boolean' ? defaults.edgesVisible : true);
                setEdgeAnimationMode(normalizeTasksEdgeAnimationMode(defaults.edgeAnimationMode, defaults.edgeAnimationEnabled));
                setEdgeAnimationTickSteps(clampTasksEdgeAnimationSteps(defaults.edgeAnimationTickSteps));
                setEdgeAnimationTickDuration(clampTasksEdgeAnimationDuration(defaults.edgeAnimationTickDuration));
                setEdgeOpacity(defaults.edgeOpacity !== undefined ? defaults.edgeOpacity : defaultEdgeOpacity);
                setProjectionUnspecifiedContentOpacity(
                    defaults.unspecifiedContentOpacity !== undefined
                        ? defaults.unspecifiedContentOpacity
                        : defaultProjectionUnspecifiedContentOpacity
                );
            }, [sourceModel, activeProjectionId, model, nodeNotes, hydrateExpandedSet, defaultFiltersOpen, defaultEdgeOpacity, defaultProjectionUnspecifiedContentOpacity]);
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
                        const nodeColor = resolveTasksNodeColor(colorNode, model, activeColorBy, activeColorPalette);
                        const colorLevels = tasksNodeColorLevels(colorNode, model, activeColorLevelSpecs, colorMix);
                        const useOverlay = tasksUseColorOverlay(colorLevels);
                        const cardState = tasksCardStateForNode(sourceModel, nodeStates, logicalNodeId, cardStates);
                        const stateAccent = cardState.color || TASKS_DONE_ACCENT;
                        return {
                            id: node.id,
                            type: 'vyasaTask',
                            position: node.position,
                            data: { ...node, __checked__: isChecked, __card_state__: cardState.label, __card_state_color__: cardState.color, __has_note__: hasNote, __color_levels__: useOverlay ? colorLevels : null },
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
                    return;
                }
                const effectiveExpandedSet = effectiveExpandedGroups(model, expandedSet);
                const baseLayout = await ensureBaseLayout();
                groupLayoutsRef.current = await layoutExpandedGroups(model, effectiveExpandedSet, jitterConfig, layoutConfig, true);
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
                const derivedById = Object.fromEntries((derived.nodes || []).map((node) => [node.id, node]));
                const egoSelectedIds = egoMode && Array.isArray(model.ego_selected_ids)
                    ? new Set(model.ego_selected_ids.map((id) => String(id || '').trim()).filter(Boolean))
                    : new Set();
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
                const egoGroupsById = egoMode && model.ego_include_neighbors
                    ? Object.fromEntries((model.groups || []).map((g) => [String(g.id || ''), g]))
                    : null;
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
                    const nodeColor = resolveTasksNodeColor(colorNode, model, activeColorBy, activeColorPalette);
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
                        : 7;
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
                    const egoNodeOpacity = egoMode
                        ? tasksEgoNodeOpacity(n, egoSelectedIds, model, egoNeighborOpacity, egoGroupsById)
                        : 1;
                    const branchOpacity = (isInUnspecifiedProjectionBranch(n) ? projectionUnspecifiedContentOpacity : 1) * egoNodeOpacity;
                    const rfNode = {
                        id: n.id,
                        type: 'vyasaTask',
                        position: n.position,
                        data: { ...n, __checked__: isChecked, __card_state__: cardState.label, __card_state_color__: cardState.color, __has_note__: hasNote, __node_image__: nodeImage, __projection_branch_opacity__: branchOpacity, __color_levels__: useOverlay ? colorLevels : null },
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
                        className: `vyasa-tasks-node--${hitArea}`,
                        draggable: false,
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
                    const titleOpacity = (isInUnspecifiedProjectionBranch(n) ? projectionUnspecifiedContentOpacity : 1)
                        * (egoMode ? tasksEgoNodeOpacity(n, egoSelectedIds, model, egoNeighborOpacity, egoGroupsById) : 1);
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
                    const egoEdgeOpacity = egoMode && model.ego_include_neighbors && (!egoSelectedIds.has(edge.source) || !egoSelectedIds.has(edge.target)) ? egoNeighborOpacity : 1;
                    return {
                        ...edge,
                        label: resolvedLabel,
                        type: 'vyasaEdge',
                        animated: false,
                        data: { ...(edge.data || {}), edgeColor, __projection_branch_opacity__: branchOpacity * egoEdgeOpacity },
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
                        labelStyle: { fontSize: hoverFontSize, fontWeight: 600, fill: edgeColor || TASKS_EDGE_LABEL_TEXT, opacity: edgeOpacity * branchOpacity * egoEdgeOpacity },
                        labelBgStyle: { fill: TASKS_EDGE_LABEL_BG, fillOpacity: 0.82 },
                        style: { strokeWidth: 2.5, opacity: edgeOpacity * branchOpacity * egoEdgeOpacity, stroke: edgeColor || 'currentColor' },
                    };
                });
                const anchoredNodes = baseNodes.map((node) => ({
                    ...node,
                    data: {
                        ...node.data,
                        handleLayout: anchored.nodeHandles[node.id] || { source: [], target: [] },
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
            }, [ensureBaseLayout, model, sourceModel, activeColorBy, activeColorPalette, activeColorLevelSpecs, activeProjection, viewMode, edgesVisible, edgeOpacity, projectionUnspecifiedContentOpacity, egoNeighborOpacity, checkedNodeIdSet, nodeStates, nodeNotes, cardStates]);
            const defaultEdgeOptions = React.useMemo(() => ({
                zIndex: TASKS_EDGE_Z,
                style: { strokeWidth: 2.5, opacity: edgeOpacity, stroke: 'currentColor' },
            }), [edgeOpacity]);
            const applyHighlight = React.useCallback((nodeId, hoveredNodeId = null, selectedIds = new Set()) => {
                const baseNodes = graphBaseRef.current.nodes || [];
                const baseEdges = graphBaseRef.current.edges || [];
                const multiSelectedIds = selectedIds instanceof Set ? selectedIds : new Set(selectedIds || []);
                const multiSelectedHighlightIds = new Set(multiSelectedIds);
                for (const selectedId of multiSelectedIds) {
                    for (const descendantId of collectTasksGroupDescendantIds(selectedId, model)) {
                        multiSelectedHighlightIds.add(descendantId);
                    }
                }
                const hasNodeSelection = nodeId && baseNodes.some((node) => node.id === nodeId);
                if (!hasNodeSelection && multiSelectedIds.size > 0) {
                    setNodes(baseNodes.map((node) => {
                        const sourceGroupId = node.data?.__kind__ === 'groupTitle' ? node.data?.sourceGroupId : null;
                        const selected = multiSelectedHighlightIds.has(node.id) || (sourceGroupId && multiSelectedHighlightIds.has(sourceGroupId));
                        const nodeColor = resolveTasksNodeColor(node.data, model, activeColorBy, activeColorPalette);
                        const collapsedGroupColor = node.data?.__kind__ === 'group' && !expanded.has(node.id)
                            ? resolveTasksCollapsedGroupColor(node.data, model, activeColorBy, activeColorPalette)
                            : '';
                        const displayColor = collapsedGroupColor || nodeColor || 'var(--vyasa-primary)';
                        return {
                            ...node,
                            data: { ...node.data, highlightMode: selected ? 'selected' : 'dim' },
                            style: {
                            ...node.style,
                                opacity: (node.data?.__projection_branch_opacity__ ?? 1) * (selected ? 1 : 0.18),
                                boxShadow: selected
                                    ? `0 0 0 2px color-mix(in srgb, ${displayColor} 70%, transparent), 0 0 18px 4px color-mix(in srgb, ${displayColor} 34%, transparent)`
                                    : node.style.boxShadow,
                            },
                        };
                    }));
                    setEdges(edgesVisible ? baseEdges.map((edge) => {
                        const hit = multiSelectedHighlightIds.has(edge.source) && multiSelectedHighlightIds.has(edge.target);
                        const edgeColor = edge.data?.edgeColor || edge.style?.stroke || 'currentColor';
                        const branchOpacity = edge.data?.__projection_branch_opacity__ ?? 1;
                        return {
                            ...edge,
                            data: { ...edge.data, highlightMode: hit ? 'selected' : 'dim' },
                            labelStyle: { ...(edge.labelStyle || {}), fill: hit ? edgeColor : 'color-mix(in srgb, var(--vyasa-ink) 26%, transparent)', opacity: (hit ? tasksProminentEdgeOpacity() : tasksApplyEdgeOpacity(0.12, edgeOpacity)) * branchOpacity },
                            labelBgStyle: { ...(edge.labelBgStyle || {}), fill: TASKS_EDGE_LABEL_BG, fillOpacity: hit ? 0.82 : 0.06 },
                            style: { ...edge.style, stroke: hit ? edgeColor : 'color-mix(in srgb, var(--vyasa-ink) 38%, transparent)', opacity: tasksApplyEdgeOpacity(hit ? 0.98 : 0.08, edgeOpacity) * branchOpacity, strokeWidth: hit ? 4.5 : 2.5, strokeLinecap: hit ? 'round' : undefined, '--vyasa-edge-flow-duration': hit ? '0.7s' : '0.6s' },
                            animated: edgeAnimationEnabled && hit,
                            className: edgeAnimationClassName,
                        };
                    }) : []);
                    return;
                }
                if (!hasNodeSelection) {
                    const hasFilters = tasksFilterQueryHasRules(effectiveQueryFilters) || tasksFilterQueryHasRules(activeSwatchFilters);
                    const hasSearch = searchMatches.active && !searchMatches.error;
                    if (!hasFilters && !hasSearch) {
                        setNodes(baseNodes);
                        setEdges(edgesVisible ? baseEdges : []);
                        return;
                    }
                    const matchingIds = filteredSelectionIds();
                    const containerGroupIds = tasksGroupIdsContainingSelection(model, matchingIds);
                    const visibleSelectionIds = new Set([...matchingIds, ...containerGroupIds]);
                    setNodes(baseNodes.map((node) => ({
                        ...node,
                        data: { ...node.data, highlightMode: visibleSelectionIds.has(node.id) ? 'selected' : 'dim' },
                        style: {
                            ...node.style,
                            opacity: (node.data?.__projection_branch_opacity__ ?? 1) * (visibleSelectionIds.has(node.id) ? 1 : 0.18),
                        },
                    })));
                    setEdges(edgesVisible ? baseEdges.map((edge) => {
                        const hit = (visibleSelectionIds.has(edge.source) && visibleSelectionIds.has(edge.target)) || searchMatches.edgeIds.has(edge.id);
                        const edgeColor = edge.data?.edgeColor || edge.style?.stroke || 'currentColor';
                        const branchOpacity = edge.data?.__projection_branch_opacity__ ?? 1;
                        return {
                            ...edge,
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
                            animated: edgeAnimationEnabled && hit,
                            className: edgeAnimationClassName,
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
                        data: { ...node.data, highlightMode: mode },
                        style: {
                            ...node.style,
                            zIndex,
                            background: mode === 'dim'
                                ? node.style.background
                                : (node.data?.__kind__ === 'group'
                                    ? (tasksNodeIsOverlaid(node) ? node.style.background : tasksGroupBackground(displayColor, '', TASKS_GROUP_BG_ACTIVE, { mode: 'transparent', intensity: 10 }))
                                    : (tasksNodeIsOverlaid(node) ? node.style.background : tasksNodeBackground(nodeColor, '', colorMix, TASKS_NODE_BG_ACTIVE, false))),
                            opacity: mode === 'dim' ? branchOpacity * 0.22 : 1,
                            boxShadow: (mode === 'selected' || mode === 'selected-focus')
                                ? `${checkedShadow !== 'none' ? `${checkedShadow}, ` : ''}0 0 0 2px color-mix(in srgb, ${displayColor || nodeColor || 'var(--vyasa-primary)'} 70%, transparent), 0 0 18px 4px color-mix(in srgb, ${displayColor || nodeColor || 'var(--vyasa-primary)'} 40%, transparent)`
                                : (mode === 'neighbor-focus'
                                    ? `${checkedShadow !== 'none' ? `${checkedShadow}, ` : ''}0 0 0 2px color-mix(in srgb, ${displayColor || nodeColor || 'var(--vyasa-primary)'} 60%, transparent)`
                                    : checkedShadow),
                        },
                        zIndex,
                    };
                });
                const nextEdges = baseEdges.map((edge) => {
                    const mode = focusedEdgeModes.get(edge.id)
                        ? focusedEdgeModes.get(edge.id)
                        : (highlightedEdgeIds.has(edge.id) ? 'selected' : 'dim');
                    const highlighted = mode !== 'dim';
                    const focusColor = mode === 'focused-in' ? TASKS_EDGE_FOCUS_IN_COLOR : TASKS_EDGE_FOCUS_OUT_COLOR;
                    const edgeColor = edge.data?.edgeColor || edge.style?.stroke || 'currentColor';
                    const branchOpacity = edge.data?.__projection_branch_opacity__ ?? 1;
                    const activeOpacity = highlighted ? 1 : branchOpacity;
                    const hoverDimsLabels = isTasksEdgeLabelHoverDimmingActive(nodeId, hoveredNodeId);
                    const dashArray = highlighted ? ((mode === 'focused-in' || mode === 'focused-out') ? '10 6' : '8 6') : undefined;
                    const dashCycle = dashArray
                        ? dashArray.split(/\s+/).map(Number).filter(Number.isFinite).slice(0, 2).reduce((sum, value) => sum + value, 0)
                        : undefined;
                    const strokeMode = !edgeAnimationEnabled && mode === 'selected'
                        ? (edge.source === nodeId ? 'selected-out' : (edge.target === nodeId ? 'selected-in' : mode))
                        : mode;
                    return {
                        ...edge,
                        data: { ...edge.data, highlightMode: mode, strokeMode },
                        zIndex: mode === 'focused-in' || mode === 'focused-out' ? TASKS_EDGE_FOCUS_Z : TASKS_EDGE_Z,
                        labelZIndex: tasksEdgeLabelZForMode(mode, TASKS_EDGE_LABEL_Z, TASKS_EDGE_LABEL_SELECTED_Z, TASKS_EDGE_LABEL_FOCUS_Z),
                        labelStyle: {
                            ...(edge.labelStyle || {}),
                            fill: mode === 'focused-in' || mode === 'focused-out'
                                ? focusColor
                                : (highlighted ? edgeColor : 'color-mix(in srgb, var(--vyasa-ink) 26%, transparent)'),
                            opacity: activeOpacity * (hoverDimsLabels
                                ? ((mode === 'focused-in' || mode === 'focused-out') ? tasksProminentEdgeOpacity() : tasksApplyEdgeOpacity(0.05, edgeOpacity))
                                : ((mode === 'focused-in' || mode === 'focused-out') ? tasksProminentEdgeOpacity() : (highlighted ? tasksProminentEdgeOpacity() : tasksApplyEdgeOpacity(0.18, edgeOpacity)))),
                            fontWeight: (mode === 'focused-in' || mode === 'focused-out') ? 800 : 600,
                        },
                        labelBgStyle: {
                            ...(edge.labelBgStyle || {}),
                            fill: mode === 'focused-in'
                                ? 'color-mix(in srgb, var(--vyasa-paper) 78%, #22c55e 22%)'
                                : (mode === 'focused-out'
                                    ? 'color-mix(in srgb, var(--vyasa-paper) 80%, #ef4444 20%)'
                                    : TASKS_EDGE_LABEL_BG),
                            fillOpacity: hoverDimsLabels
                                ? ((mode === 'focused-in' || mode === 'focused-out') ? 0.96 : (highlighted ? 0.72 : 0.04))
                                : ((mode === 'focused-in' || mode === 'focused-out') ? 0.96 : (highlighted ? 0.72 : 0.04)),
                        },
                        style: {
                            ...edge.style,
                            stroke: mode === 'focused-in' || mode === 'focused-out'
                                ? focusColor
                                : (highlighted ? edgeColor : 'color-mix(in srgb, var(--vyasa-ink) 38%, transparent)'),
                            opacity: activeOpacity * ((mode === 'focused-in' || mode === 'focused-out')
                                ? tasksProminentEdgeOpacity()
                                : (highlighted ? tasksProminentEdgeOpacity() : tasksApplyEdgeOpacity(0.08, edgeOpacity))),
                            strokeWidth: tasksEdgeStrokeWidthForMode(strokeMode, edgeAnimationEnabled),
                            strokeDasharray: dashArray,
                            '--vyasa-edge-dash-cycle': dashCycle,
                            '--vyasa-edge-flow-duration': (mode === 'focused-in' || mode === 'focused-out') ? '0.72s' : '0.64s',
                            strokeLinecap: highlighted ? 'round' : undefined,
                        },
                        animated: edgeAnimationEnabled && highlighted,
                        className: edgeAnimationClassName,
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
                            animated: Boolean(edge.animated),
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
                setNodes(nextNodes);
                const edgePriority = { dim: 0, selected: 1, 'focused-in': 2, 'focused-out': 2 };
                nextEdges.sort((a, b) => (edgePriority[a.data?.highlightMode || 'dim'] - edgePriority[b.data?.highlightMode || 'dim']));
                setEdges(edgesVisible ? nextEdges : []);
            }, [effectiveQueryFilters, activeSwatchFilters, searchMatches, model, activeColorBy, activeColorPalette, activeColorLevelSpecs, expanded, edgesVisible, edgeAnimationEnabled, edgeAnimationClassName, edgeOpacity, filteredSelectionIds]);
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
                applyHighlight(selectedNodeId, selectedNodeId ? hoveredNodeId : null, selectedNodeIds);
            }, [graphRevision, selectedNodeId, selectedNodeIds, hoveredNodeId, applyHighlight]);
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
                if (lastGraphRevisionCauseRef.current === 'visual') return;
                if (!shouldAutoFitTasksOnFilter()) return;
                const hasFilters = tasksFilterQueryHasRules(effectiveQueryFilters) || tasksFilterQueryHasRules(activeSwatchFilters);
                const hasSearch = searchMatches.active && !searchMatches.error;
                if (!hasFilters && !hasSearch) return;
                const reactFlow = reactFlowApiRef.current;
                const matchedNodes = (graphBaseRef.current.nodes || []).filter((node) => {
                    if (!node?.id || node.data?.__kind__ === 'groupTitle') return false;
                    const filterHit = hasFilters ? tasksNodeMatchesAllFilters(node.data, effectiveQueryFilters, activeSwatchFilters) : true;
                    const searchHit = hasSearch ? searchMatches.nodeIds.has(node.id) : true;
                    return filterHit && searchHit;
                });
                if (!reactFlow || matchedNodes.length === 0) return;
                let rafId = window.requestAnimationFrame(() => {
                    reactFlow.fitView({ nodes: matchedNodes, duration: 220, padding: 0.28, includeHiddenNodes: true });
                });
                return () => {
                    if (rafId !== null) window.cancelAnimationFrame(rafId);
                };
            }, [graphRevision, effectiveQueryFilters, activeSwatchFilters, searchMatches]);
            React.useEffect(() => {
                if (lastGraphRevisionCauseRef.current === 'visual') return;
                if (!shouldAutoFitTasksOnFilter()) return;
                if (selectedNodeId || !selectedNodeIds.size) return;
                const reactFlow = reactFlowApiRef.current;
                const matchedNodes = (graphBaseRef.current.nodes || []).filter((node) => (
                    node?.id
                    && node.data?.__kind__ !== 'groupTitle'
                    && selectedNodeIds.has(node.id)
                ));
                if (!reactFlow || matchedNodes.length === 0) return;
                const rafId = window.requestAnimationFrame(() => {
                    reactFlow.fitView({ nodes: matchedNodes, duration: 220, padding: 0.28, includeHiddenNodes: true });
                });
                return () => window.cancelAnimationFrame(rafId);
            }, [graphRevision, selectedNodeId, selectedNodeIds]);
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
            const CustomEdge = React.memo((props) => {
                const viewport = typeof rf.useViewport === 'function' ? rf.useViewport() : { zoom: 1 };
                const [path, labelX, labelY] = rf.getBezierPath(props);
                const fullLabel = String(props.label || '').replace(/\\n/g, '\n');
                const labelLines = fullLabel.split(/\r?\n/);
                const highlightMode = props.data?.highlightMode || 'none';
                const strokeMode = props.data?.strokeMode || highlightMode;
                const useTaper = !props.animated && ['focused-in', 'focused-out', 'selected', 'selected-in', 'selected-out'].includes(strokeMode);
                const taperPath = useTaper
                    ? tasksTaperedBezierPath(path, (Number(props.style?.strokeWidth) || 4) * 1.85, Math.max(1, (Number(props.style?.strokeWidth) || 4) * 0.26))
                    : '';
                const taperArrowPath = taperPath
                    ? tasksTaperedArrowHeadPath(path, Math.max(8, (Number(props.style?.strokeWidth) || 4) * 2.4))
                    : '';
                const showFullLabel = highlightMode !== 'dim' && highlightMode !== 'none';
                const prominentLabel = highlightMode === 'focused-in' || highlightMode === 'focused-out';
                const labelScale = prominentLabel && Number.isFinite(viewport?.zoom) && viewport.zoom > 0 ? 1 / viewport.zoom : 1;
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
                    taperPath && React.createElement('path', {
                        d: taperPath,
                        fill: props.style?.stroke || 'currentColor',
                        opacity: props.style?.opacity ?? 1,
                        pointerEvents: 'none',
                    }),
                    taperArrowPath && React.createElement('path', {
                        d: taperArrowPath,
                        fill: props.style?.stroke || 'currentColor',
                        opacity: props.style?.opacity ?? 1,
                        pointerEvents: 'none',
                    }),
                    React.createElement(rf.BaseEdge, {
                        ...props,
                        path,
                        markerEnd: taperPath ? undefined : props.markerEnd,
                        style: taperPath
                            ? { ...(props.style || {}), strokeWidth: 0.1 }
                            : props.style,
                    }),
                    displayLabel && !prominentLabel && React.createElement('g', {
                        transform: `translate(${labelX}, ${labelY})`,
                        pointerEvents: 'none',
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
                    displayLabel && prominentLabel && React.createElement(rf.EdgeLabelRenderer, null,
                        React.createElement('div', {
                            style: {
                                position: 'absolute',
                                transform: `translate(${labelX}px, ${labelY}px)`,
                                pointerEvents: 'none',
                                zIndex: props.labelZIndex || TASKS_EDGE_LABEL_Z,
                            },
                            title: fullLabel,
                        },
                        React.createElement('div', {
                            style: {
                                transform: `translate(-50%, -50%) scale(${labelScale})`,
                                transformOrigin: 'center center',
                                padding: `${props.labelBgPadding?.[1] || 0}px ${props.labelBgPadding?.[0] || 0}px`,
                                borderRadius: `${props.labelBgBorderRadius || 0}px`,
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
                                maxWidth: `${props.labelMaxWidth || 240}px`,
                                opacity: labelStyle.opacity ?? 1,
                            },
                        }, displayLabel)))
                    )
                );
            });
            const CustomNode = React.memo(({ data, id }) => {
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
                const isChecked = data?.__checked__ === true;
                const taskStateLabel = String(data?.__card_state__ || (isChecked ? TASKS_DEFAULT_CARD_STATES[1] : TASKS_DEFAULT_CARD_STATES[0]));
                const taskStateColor = data?.__card_state_color__ || TASKS_DONE_ACCENT;
                const showCheckbox = hoveredNodeId === sourceNodeId || selectedNodeId === sourceNodeId;
                const isActiveNode = !selectedNodeId || selectedNodeId === sourceNodeId;
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
                        style: {
                            width: '100%', height: '100%',
                            boxSizing: 'border-box',
                            display: 'flex',
                            alignItems: 'flex-start',
                            justifyContent: 'space-between',
                            gap: '8px',
                            padding: '8px 10px',
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
                                alignItems: 'flex-start',
                                gap: '7px',
                                whiteSpace: 'pre-line',
                                lineHeight: '1.28',
                                overflowWrap: 'anywhere',
                                wordBreak: 'break-word',
                            }
                        }, renderNodeImage(20, { marginTop: '1px' }), React.createElement('span', { style: { minWidth: 0 } }, renderTasksInlineLinks(data?.label || data.sourceGroupId || id, { interactive: linksInteractive, onInactiveClick: handleInactiveLinkClick }))),
                        egoMode ? null : React.createElement('button', {
                            onClick: handleCollapse,
                            style: { flex: '0 0 auto', border: 'none', background: 'none', cursor: 'pointer', fontSize: '18px', opacity: '0.55', padding: '0' }
                        }, '−')
                    );
                }
                const isGroup = data?.__kind__ === 'group';
                const canExpand = tasksNodeHasChildren(id, model);
                const isExpanded = expanded.has(id);
                const labelContent = renderTasksInlineLinks(data?.label || id, { interactive: linksInteractive, onInactiveClick: handleInactiveLinkClick });
                if (data?.__gantt) {
                    return React.createElement('div', {
                        className: 'vyasa-task-node-body',
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
                    ? renderTasksNodeLinkBadge(React, { kinds: ['note'], title: 'Has note', top: 'auto', bottom: isChecked ? '30px' : '8px', right: isChecked ? '8px' : (canExpand ? '34px' : '8px') })
                    : null;
                const doneBadge = isChecked ? React.createElement('div', {
                    style: {
                        position: 'absolute',
                        right: canExpand ? '34px' : '8px',
                        bottom: '8px',
                        padding: '2px 6px',
                        borderRadius: '999px',
                        background: `color-mix(in srgb, ${taskStateColor} 76%, white 24%)`,
                        color: '#052e16',
                        fontSize: '9px',
                        fontWeight: 800,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        boxShadow: `0 0 0 1px color-mix(in srgb, ${taskStateColor} 36%, transparent)`,
                        zIndex: 2,
                    },
                }, taskStateLabel) : null;
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
                        style: {
                            width: '100%', height: '100%',
                            boxSizing: 'border-box', display: 'flex', flexDirection: 'column', padding: '8px',
                            opacity: isDimmed ? 0.22 : 1,
                        }
                    },
                        checkboxControl,
                        doneBadge,
                        noteBadge,
                        ...renderHandles('target'),
                        React.createElement('div', { style: { flex: 1, minHeight: '48px', position: 'relative' } }),
                        ...renderHandles('source')
                    );
                }
                return React.createElement('div', {
                    className: 'vyasa-task-node-body',
                    style: {
                        width: '100%', height: '100%',
                        boxSizing: 'border-box',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: nodeImage ? '10px' : undefined,
                        fontSize: '16px',
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
                    doneBadge,
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
                    ...renderHandles('source')
                );
            });
            React.useEffect(() => {
                rebuildLayout(expanded);
            }, [expanded, viewMode, rebuildLayout]);
            // Fit-on-mode-change is driven from inside ReactFlowProvider via
            // FitOnNodesReady below — it waits for useNodesInitialized() so the
            // fit lands after React Flow has finished measuring node rects.
            const nodeTypes = React.useMemo(() => ({ vyasaTask: CustomNode }), [expanded, selectedNodeId, hoveredNodeId, cardStates]);
            const edgeTypes = React.useMemo(() => ({ vyasaEdge: CustomEdge }), []);
            const FitViewHotkey = () => {
                const reactFlow = rf.useReactFlow();
                React.useEffect(() => {
                    const onKeyDown = (event) => {
                        if (event.defaultPrevented || event.repeat) return;
                        if (event.metaKey || event.ctrlKey || event.altKey) return;
                        const flowWrapper = flowWrapperRef.current;
                        const target = event.target instanceof Element ? event.target : null;
                        const key = event.key.toLowerCase();
                        const widgetFocused = wrapper.contains(document.activeElement) || wrapper.contains(target) || window.__vyasaTasksActiveWidgetId === widgetId;
                        const egoModalOpen = Boolean(document.querySelector('#tasks-fullscreen-modal [data-tasks-ego="true"]'));
                        if ((event.key === 'Escape' || key === 'g') && window.__vyasaTasksDebug.enabled) {
                            logTasksDebug('shortcutKeydown', {
                                widgetId,
                                key: event.key,
                                shiftKey: event.shiftKey,
                                widgetFocused,
                                egoModalOpen,
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
                        if (event.key === 'Escape' && !event.shiftKey && egoModalOpen) {
                            event.preventDefault();
                            event.stopPropagation();
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
                            event.preventDefault();
                            clearSelection('escape');
                            return;
                        }
                        if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(target.tagName))) return;
                        if (!widgetFocused && !(key === 't' && groupToggleHoverIdRef.current)) return;
                        if (key === 'f' && event.shiftKey) {
                            event.preventDefault();
                            window.openTasksFullscreen?.(widgetId);
                            return;
                        }
                        if (key === 'f') {
                            event.preventDefault();
                            const selectedIds = new Set([selectedNodeIdRef.current, ...selectedNodeIdsRef.current].filter(Boolean));
                            const matched = selectedIds.size
                                ? (graphBaseRef.current.nodes || []).filter((node) => node?.id && node.data?.__kind__ !== 'groupTitle' && selectedIds.has(node.id))
                                : [];
                            reactFlow.fitView(matched.length
                                ? { nodes: matched, duration: 200, padding: 0.25, includeHiddenNodes: true }
                                : { duration: 200, padding: 0.2, includeHiddenNodes: true });
                            return;
                        }
                        if (event.key === '?' || (event.key === '/' && event.shiftKey)) {
                            event.preventDefault();
                            setHelpOpen((current) => !current);
                            return;
                        }
                        if (key === 'g' && !egoMode) {
                            event.preventDefault();
                            logTasksDebug('shortcutOpenEgo', {
                                widgetId,
                                includeNeighbors: event.shiftKey,
                                ...tasksSelectionDebugPayload(selectedNodeIdRef.current, selectedNodeIdsRef.current, hoveredNodeId),
                            });
                            window.__vyasaTasksActions?.[widgetId]?.openEgo?.(event.shiftKey);
                            return;
                        }
                        if (key === 's') {
                            event.preventDefault();
                            setFiltersCollapsed((current) => !current);
                            return;
                        }
                        if (key === 'e') {
                            event.preventDefault();
                            setEdgesVisible((current) => !current);
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
                        if (key === 'arrowup') {
                            event.preventDefault();
                            panViewport(reactFlow, 0, 120 * (event.shiftKey ? 2 : 1));
                            return;
                        }
                        if (key === '0') {
                            event.preventDefault();
                            setEdgeAnimationMode((current) => nextTasksEdgeAnimationMode(current));
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
                    };
                    document.addEventListener('keydown', onKeyDown);
                    return () => document.removeEventListener('keydown', onKeyDown);
                }, [reactFlow, currentSelectionIds, model, rawGraph, sourceModel, egoMode, helpOpen]);
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
                    React.createElement('button', { type: 'button', onClick: () => reactFlow.fitView({ duration: 200, padding: 0.2, includeHiddenNodes: true }), style: btn }, '⌂'),
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
                const noteMetrics = tasksNoteEditorMetrics(noteInputValue);
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
                        React.createElement('div', { style: { display: 'grid', gridTemplateColumns: panelNodeId ? 'minmax(0, 1fr) auto' : 'minmax(0, 1fr)', columnGap: '12px', alignItems: 'start' } },
                            React.createElement('div', { style: { fontSize: '14px', fontWeight: 700, lineHeight: 1.3, minWidth: 0, overflowWrap: 'anywhere', wordBreak: 'break-word' } }, selectedNode.label || selectedNode.id),
                            panelNodeId ? React.createElement('div', { style: { fontSize: '12px', lineHeight: 1.3, fontWeight: 600, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace', opacity: 0.7, textAlign: 'right' } }, panelNodeId) : null,
                        ),
                        panelHref ? React.createElement('a', {
                            href: panelHref,
                            onClick: (event) => openTasksNodeHref(panelHref, event),
                            style: { display: 'inline-block', marginTop: '6px', fontSize: '12px', lineHeight: 1.3, textDecoration: 'underline', textUnderlineOffset: '2px', color: 'inherit', overflowWrap: 'anywhere', wordBreak: 'break-word' },
                        }, panelHref) : null,
                    ),
                    renderTasksDetailEntries(React, entries, { copyValues: true }),
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
                            React.createElement('textarea', {
                                ref: noteTextareaRef,
                                'data-vyasa-task-control': 'true',
                                value: noteInputValue,
                                placeholder: 'Notes',
                                rows: Math.min(15, noteMetrics.lines),
                                onChange: (event) => setNoteInputValue(event.target.value),
                                style: {
                                    width: '100%',
                                    minHeight: '76px',
                                    maxHeight: 'calc(1.35em * 15 + 16px)',
                                    resize: 'none',
                                    overflowY: 'hidden',
                                    border: '1px solid color-mix(in srgb, var(--vyasa-ink) 18%, transparent)',
                                    borderRadius: '8px',
                                    background: 'color-mix(in srgb, var(--vyasa-paper) 94%, transparent)',
                                    color: 'var(--vyasa-ink)',
                                    fontSize: '12px',
                                    lineHeight: 1.35,
                                    padding: '8px',
                                    boxSizing: 'border-box',
                                },
                            })
                        )
                    )
                );
            };
            const FilterPanel = () => {
                if (egoMode) return null;
                const options = tasksFilterOptions(model);
                const colorOptions = tasksColorOptions(model, nodeNotes);
                const groupByOptions = tasksGroupByOptions(sourceModel);
                const activeProjectionOption = projectionOptions.find((projection) => (
                    viewMode === 'gantt'
                        ? projection.id === TASKS_GANTT_PROJECTION_ID
                        : projection.id === activeProjectionId
                )) || null;
                const customGroupingActive = !String(activeProjectionId || '').trim() && viewMode !== 'gantt';
                const projectionGroupByHierarchy = viewMode === 'gantt' ? [] : tasksProjectionGroupByHierarchy(sourceModel, activeProjectionId);
                const displayedGroupByHierarchy = customGroupingActive ? groupByHierarchy : projectionGroupByHierarchy;
                const activeGroupByCount = customGroupingActive ? groupByHierarchy.filter(Boolean).length : 0;
                const groupByLevels = displayedGroupByHierarchy.filter(Boolean);
                if (customGroupingActive) groupByLevels.push('');
                if (!groupByLevels.length && viewMode !== 'gantt') groupByLevels.push('');
                const activeCount = (queryBuilderEnabled ? tasksCountFilterRules(activeFilters) : 0) + tasksCountFilterRules(activeSwatchFilters) + activeColorHierarchy.length + (searchMatches.active ? 1 : 0) + activeGroupByCount;
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
                                        return `${stop.color} ${((stop.at - start) / span) * 100}%`;
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
                                        border: selected ? `1px solid ${color}` : '1px solid transparent',
                                        background: selected ? `color-mix(in srgb, ${color} 16%, transparent)` : 'transparent',
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                        color: 'inherit',
                                    },
                                },
                                React.createElement('span', { style: { width: '12px', height: '12px', borderRadius: '999px', background: color, border: '1px solid color-mix(in srgb, currentColor 20%, transparent)' } }),
                                React.createElement('span', null, value));
                            })
                        )
                    );
                };
                const renderColorLevel = (colorBy, index) => {
                    const usedBefore = new Set(activeColorHierarchy.slice(0, index));
                    const selectOptions = [{ key: '', label: 'None' }, ...colorOptions
                        .filter((option) => option.key === colorBy || !usedBefore.has(option.key))
                        .map((option) => ({ key: option.key, label: option.label }))];
                    return React.createElement('div', { key: `color-level-${index}`, style: { ...filterSectionStyle, marginBottom: '12px', paddingBottom: '10px', borderBottom: '1px solid color-mix(in srgb, currentColor 12%, transparent)' } },
                        React.createElement('span', { style: filterKeyStyle }, index === 0 ? 'Color by' : `Color ${index + 1}`),
                        React.createElement('div', { style: filterValueStackStyle },
                            React.createElement('select', {
                                value: colorBy || '',
                                onChange: (event) => setActiveColorLevel(index, event.target.value),
                                style: {
                                    width: '100%',
                                    minWidth: 0,
                                    border: '1px solid color-mix(in srgb, currentColor 16%, transparent)',
                                    borderRadius: '8px',
                                    padding: '6px 8px',
                                    background: 'color-mix(in srgb, var(--vyasa-paper) 96%, transparent)',
                                    color: 'inherit',
                                },
                            }, selectOptions.map((option) => React.createElement('option', { key: option.key || '__none__', value: option.key }, option.label))),
                            renderColorPalette(colorBy)
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
                    style: { display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', opacity: props.disabled ? 0.5 : 0.82, cursor: props.disabled ? 'not-allowed' : 'pointer' },
                },
                React.createElement('input', {
                    type: 'checkbox',
                    checked: !props.ruleOrGroup?.muted,
                    disabled: props.disabled,
                    onChange: (event) => props.handleOnClick?.(event),
                }),
                React.createElement('span', null, 'Enabled'));
                const isOpen = !filtersCollapsed;
                const filterPanelWidth = `min(${TASKS_FILTER_PANEL_WIDTH}px, calc(100% - 24px))`;
                return React.createElement('aside', {
                    'aria-hidden': !isOpen,
                    style: {
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        bottom: 0,
                        zIndex: 2200,
                        width: filterPanelWidth,
                        minWidth: 0,
                        maxWidth: 'calc(100% - 24px)',
                        overflow: 'hidden',
                        pointerEvents: isOpen ? 'auto' : 'none',
                    },
                },
                    React.createElement('div', {
                        ref: filterPanelRef,
                        className: 'vyasa-tasks-filter-card',
                        style: {
                            width: filterPanelWidth,
                            maxWidth: 'calc(100% - 24px)',
                            maxHeight: filterPanelMaxHeight,
                            overflowX: 'hidden',
                            overflowY: 'auto',
                            borderRadius: '0 8px 8px 8px',
                            background: 'color-mix(in srgb, var(--vyasa-paper) 92%, transparent)',
                            backdropFilter: 'blur(8px)',
                            padding: '12px',
                            boxSizing: 'border-box',
                            transform: isOpen ? 'translateX(0)' : 'translateX(calc(-100% - 16px))',
                            opacity: isOpen ? 1 : 0,
                            visibility: isOpen ? 'visible' : 'hidden',
                            transition: 'transform 180ms ease, opacity 120ms ease',
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
                            React.createElement('button', { type: 'button', onClick: () => setFiltersCollapsed(true), style: { border: 'none', background: 'none', cursor: 'pointer', padding: '2px 4px', fontSize: '14px', lineHeight: 1, color: 'inherit', opacity: 0.7 } }, '×')
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
                            React.createElement('span', { style: filterKeyStyle }, 'Context'),
                            (() => {
                                const ctxIndex = contextOptions.findIndex((context) => context.id === activeContextId);
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
                                            ...contextOptions.map((context) => React.createElement('option', { key: context.id, value: context.id }, context.label || context.caption || context.id))
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
                        projectionOptions.length >= 1 ? React.createElement('div', { style: { ...filterSectionStyle, marginBottom: '12px', paddingBottom: '10px', borderBottom: '1px solid color-mix(in srgb, currentColor 12%, transparent)' } },
                            React.createElement('span', { style: filterKeyStyle }, 'View'),
                            React.createElement('div', { style: filterInlineControlStyle },
                                React.createElement('select', {
                                    value: activeAclViewer ? `__acl__:${activeAclViewer}` : (viewMode === 'gantt' ? TASKS_GANTT_PROJECTION_ID : activeProjectionId),
                                    onPaste: handleDefaultViewPaste,
                                    onChange: async (event) => {
                                        const nextProjectionId = event.target.value;
                                        if (nextProjectionId.startsWith('__acl__:')) {
                                            setActiveAclViewer(nextProjectionId.slice('__acl__:'.length));
                                            setActiveProjectionId('');
                                            setViewMode('graph');
                                            setSelectedNodeId(null);
                                            setSelectedNodeIds(new Set());
                                            setDragSelection(null);
                                            setHoveredNodeId(null);
                                            pendingFitActionRef.current = 'mode';
                                            return;
                                        }
                                        if (nextProjectionId === TASKS_ADD_VIEW_OPTION_ID) {
                                            await handleAddView();
                                            return;
                                        }
                                        setActiveAclViewer('');
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
                                    ...aclViewerOptions.map((viewer) => React.createElement('option', { key: `acl-${viewer.id}`, value: `__acl__:${viewer.id}` }, viewer.label))
                                    , React.createElement('option', { key: TASKS_ADD_VIEW_OPTION_ID, value: TASKS_ADD_VIEW_OPTION_ID }, '+ Add view...')
                                ),
                                activeProjectionOption && activeProjectionOption.id !== TASKS_GANTT_PROJECTION_ID
                                    ? React.createElement('button', {
                                        type: 'button',
                                        title: 'Copy this view as a kg.schema @views entry',
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
                            React.createElement('span', { style: filterKeyStyle }, 'Group by'),
                            React.createElement('div', { style: filterValueStackStyle },
                                    groupByLevels.map((selectedKey, level) => React.createElement('select', {
                                        key: `group-by-${level}`,
                                        value: selectedKey,
                                        disabled: Boolean(activeProjectionId) || viewMode === 'gantt',
                                        onChange: (event) => {
                                            const next = groupByHierarchy.slice();
                                            next[level] = event.target.value;
                                            setGroupByHierarchy(next.slice(0, level + 1).filter(Boolean));
                                            setActiveProjectionId('');
                                            setViewMode('graph');
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
                                        React.createElement('option', { value: '' }, level === 0 ? 'No custom grouping' : `Level ${level + 1}: none`),
                                        ...groupByOptions
                                            .filter((option) => option.key === displayedGroupByHierarchy[level] || !displayedGroupByHierarchy.includes(option.key))
                                            .map((option) => React.createElement('option', { key: option.key, value: option.key }, option.label))
                                    )),
                                    activeProjectionId || viewMode === 'gantt'
                                        ? React.createElement('div', { style: { fontSize: '11px', opacity: 0.7, lineHeight: 1.3 } }, 'Custom grouping applies to Default view.')
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
                            React.createElement('span', { style: filterKeyStyle }, 'Search'),
                            React.createElement('div', { style: filterValueStackStyle },
                                    React.createElement('div', { style: { position: 'relative' } },
                                        React.createElement('input', {
                                            ref: searchInputRef,
                                            type: 'text',
                                            value: searchInputValue,
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
                                    searchMatches.error
                                        ? React.createElement('div', { style: { fontSize: '11px', color: '#fca5a5', lineHeight: 1.3 } }, `Regex error: ${searchMatches.error}`)
                                        : React.createElement('div', { style: { fontSize: '11px', opacity: 0.72, lineHeight: 1.3 } }, searchMatches.active ? `${searchMatches.nodeIds.size} nodes matched` : 'Matches node id, label, text attrs, and matching edge text.')
                            )
                        ),
                        ...colorLevelSlots.map((colorBy, index) => renderColorLevel(colorBy, index)),
                        React.createElement('div', { style: { marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', fontSize: '12px' } },
                            React.createElement('label', { style: { display: 'inline-flex', alignItems: 'center', gap: '7px', minWidth: 0 } },
                                React.createElement('input', {
                                    type: 'checkbox',
                                    checked: queryBuilderEnabled,
                                    onChange: (event) => setQueryBuilderEnabled(event.target.checked),
                                }),
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
                                    onQueryChange: (query) => setActiveFilters(normalizeTasksFilterQuery(query)),
                                    showNotToggle: true,
                                    showCloneButtons: false,
                                    showMuteButtons: true,
                                    showCombinatorsBetweenRules: true,
                                    resetOnFieldChange: true,
                                    resetOnOperatorChange: true,
                                    listsAsArrays: true,
                                    controlElements: { valueEditor: QueryValueEditor, muteRuleAction: QueryMuteToggle, muteGroupAction: QueryMuteToggle },
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
                setSelectedNodeId(null);
                setSelectedNodeIds(new Set());
                setDragSelection(null);
                setHoveredNodeId(null);
            };
            const toggleFilterValue = React.useCallback((key, value, enabled) => {
                setActiveSwatchFilters((current) => toggleTasksFilterQueryValue(current, key, value, enabled));
            }, []);
            const clearGroupHoverTooltip = React.useCallback(() => {
                setGroupHoverTooltip(null);
            }, []);
            const activeHoverAttrs = React.useMemo(
                () => tasksActiveHoverAttrs(sourceModel, activeProjectionId),
                [sourceModel, activeProjectionId]
            );
            const updateGroupHoverTooltip = React.useCallback((event) => {
                const reactFlow = reactFlowApiRef.current;
                const wrapper = flowWrapperRef.current;
                if (!reactFlow || !wrapper) return;
                const point = reactFlow.screenToFlowPosition({ x: event.clientX, y: event.clientY });
                const baseNodes = graphBaseRef.current.nodes || [];
                const byId = Object.fromEntries(baseNodes.map((node) => [node.id, node]));
                const absoluteRect = (node) => {
                    let x = node.position?.x || 0;
                    let y = node.position?.y || 0;
                    let parent = node.parentId ? byId[node.parentId] : null;
                    while (parent) {
                        x += parent.position?.x || 0;
                        y += parent.position?.y || 0;
                        parent = parent.parentId ? byId[parent.parentId] : null;
                    }
                    return { x, y, width: node.style?.width || node.width || 0, height: node.style?.height || node.height || 0 };
                };
                // Pick the deepest hit (highest z) under the cursor without touching React state.
                const hit = baseNodes
                    .filter((node) => node.data?.__kind__ !== 'ganttHeader')
                    .map((node) => ({ node, rect: absoluteRect(node), z: Number(node.zIndex || node.style?.zIndex || 0) }))
                    .filter(({ rect }) => point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height)
                    .sort((a, b) => b.z - a.z)[0];
                if (!hit) {
                    groupToggleHoverIdRef.current = '';
                    setTasksGroupToggleHover(wrapper, '');
                    clearGroupHoverTooltip();
                    return;
                }
                const nodeData = hit.node.data || {};
                const hoverGroupId = nodeData.__kind__ === 'group'
                    ? hit.node.id
                    : (nodeData.__kind__ === 'groupTitle' ? nodeData.sourceGroupId : '');
                if (groupToggleHoverIdRef.current !== hoverGroupId) {
                    groupToggleHoverIdRef.current = hoverGroupId || '';
                    setTasksGroupToggleHover(wrapper, hoverGroupId);
                }
                const liveNode = nodes.find((node) => node.id === hit.node.id) || hit.node;
                if (!tasksGraphNodeAllowsHover(liveNode)) {
                    clearGroupHoverTooltip();
                    return;
                }
                const rows = tasksHoverAttrRows(nodeData, activeHoverAttrs);
                const label = nodeData.label || hit.node.id;
                const nodeId = nodeData.__kind__ === 'groupTitle' ? (nodeData.sourceGroupId || hit.node.id) : hit.node.id;
                const image = normalizeTasksNodeImageUrl(nodeData.__node_image__);
                if (!label && !rows.length) {
                    clearGroupHoverTooltip();
                    return;
                }
                const bounds = wrapper.getBoundingClientRect();
                setGroupHoverTooltip({
                    label,
                    nodeId,
                    image,
                    rows,
                    x: event.clientX - bounds.left + 12,
                    y: event.clientY - bounds.top + 18,
                });
            }, [expanded, clearGroupHoverTooltip, activeHoverAttrs, nodes]);
            const selectGroupDescendants = React.useCallback((node) => {
                const kind = node?.data?.__kind__;
                if (kind !== 'group' && kind !== 'groupTitle') return false;
                const groupId = kind === 'groupTitle' ? node.data?.sourceGroupId : node.id;
                if (!groupId || !expanded.has(groupId)) return false;
                const baseIds = new Set((graphBaseRef.current.nodes || []).map((n) => n.id));
                if (!baseIds.has(groupId)) return false;
                const ids = new Set([groupId, ...collectTasksGroupDescendantIds(groupId, model)].filter((id) => baseIds.has(id)));
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
            }, [expanded, model]);
            const selectGraphNode = React.useCallback((_, node) => {
                if (suppressNextGraphClickRef.current) {
                    suppressNextGraphClickRef.current = false;
                    return;
                }
                // Detect a double-click ourselves: React Flow re-renders the node on the
                // first click (selection -> setNodes), which replaces its DOM element and
                // prevents the browser's native dblclick from ever firing.
                const last = lastNodeClickRef.current;
                const now = window.performance ? window.performance.now() : 0;
                const isDoubleClick = last && last.id === node?.id && (now - last.time) <= 400;
                lastNodeClickRef.current = isDoubleClick ? null : { id: node?.id, time: now };
                if (isDoubleClick && selectGroupDescendants(node)) {
                    return;
                }
                if (!isTasksGraphNodeSelectable(node.data?.__kind__, expanded.has(node.id))) {
                    clearSelection('nodeClickNonSelectable');
                    return;
                }
                const sourceNodeId = node.data?.__kind__ === 'groupTitle' ? node.data?.sourceGroupId : node.id;
                if (selectedNodeIdRef.current === sourceNodeId && selectedNodeIdsRef.current.size === 0) {
                    clearSelection('nodeClickToggle');
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
                selectedNodeIdRef.current = sourceNodeId;
                selectedNodeIdsRef.current = new Set();
                setSelectedNodeId(sourceNodeId);
                setSelectedNodeIds(new Set());
                setHoveredNodeId(null);
            }, [expanded, selectGroupDescendants]);
            const focusNeighborEdge = React.useCallback((_, node) => {
                if (!node?.id) return;
                if (!tasksGraphNodeAllowsHover(node)) return;
                if (!isTasksGraphNodeSelectable(node.data?.__kind__, expanded.has(node.id))) return;
                const sourceNodeId = node.data?.__kind__ === 'groupTitle' ? node.data?.sourceGroupId : node.id;
                if (!selectedNodeId) {
                    if (hoverClearTimerRef.current) {
                        window.clearTimeout(hoverClearTimerRef.current);
                        hoverClearTimerRef.current = null;
                    }
                    setHoveredNodeId((current) => current === sourceNodeId ? current : sourceNodeId);
                    return;
                }
                const baseEdges = graphBaseRef.current.edges || [];
                const isNeighbor = baseEdges.some((edge) =>
                    (edge.source === selectedNodeId && edge.target === sourceNodeId) ||
                    (edge.source === sourceNodeId && edge.target === selectedNodeId)
                );
                if (!isNeighbor && sourceNodeId !== selectedNodeId) return;
                if (hoverClearTimerRef.current) {
                    window.clearTimeout(hoverClearTimerRef.current);
                    hoverClearTimerRef.current = null;
                }
                setHoveredNodeId((current) => current === sourceNodeId ? current : sourceNodeId);
            }, [expanded, selectedNodeId]);
            const clearNeighborEdgeFocus = React.useCallback((_, node) => {
                if (!tasksGraphNodeAllowsHover(node)) return;
                if (!isTasksGraphNodeSelectable(node?.data?.__kind__, expanded.has(node?.id))) return;
                clearGroupHoverTooltip();
                if (hoverClearTimerRef.current) window.clearTimeout(hoverClearTimerRef.current);
                hoverClearTimerRef.current = window.setTimeout(() => {
                    setHoveredNodeId(null);
                    hoverClearTimerRef.current = null;
                }, 90);
            }, [expanded]);
            const startDragSelection = React.useCallback((event) => {
                const mode = event.metaKey ? 'lasso' : (event.shiftKey ? 'rect' : '');
                if (!mode || (event.pointerType === 'mouse' && event.button !== 0)) return;
                if (event.target?.closest?.('button, input, textarea, select, a, .react-flow__controls, .vyasa-tasks-filter-card')) return;
                const reactFlow = reactFlowApiRef.current;
                const el = flowWrapperRef.current;
                if (!reactFlow || !el) return;
                const startFlow = reactFlow.screenToFlowPosition({ x: event.clientX, y: event.clientY });
                try {
                    el.setPointerCapture?.(event.pointerId);
                } catch {
                    // Ignore if this pointer cannot be captured.
                }
                el.focus?.({ preventScroll: true });
                setSelectedNodeId(null);
                setHoveredNodeId(null);
                setDragSelection({ pointerId: event.pointerId, mode, startClientX: event.clientX, startClientY: event.clientY, currentClientX: event.clientX, currentClientY: event.clientY, startFlow, currentFlow: startFlow, points: [startFlow], clientPoints: [{ x: event.clientX, y: event.clientY }] });
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
                    logTasksDebug('selectionSetDrag', {
                        widgetId,
                        mode: dragSelection.mode,
                        selectedIds: selected,
                    });
                    markWidgetActive();
                    selectedNodeIdRef.current = null;
                    selectedNodeIdsRef.current = new Set(selected);
                    setSelectedNodeIds(new Set(selected));
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
                if (hoverClearTimerRef.current) window.clearTimeout(hoverClearTimerRef.current);
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
            const ActionBridge = () => {
                const reactFlow = rf.useReactFlow();
                reactFlowApiRef.current = reactFlow;
                React.useEffect(() => {
                    window.__vyasaTasksActions[widgetId] = {
                        fit: () => reactFlow.fitView({ duration: 200, padding: 0.2, includeHiddenNodes: true }),
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
                        openEgo: (includeNeighbors = false) => {
                            const egoSelection = currentSelectionIds();
                            logTasksDebug('openEgoAction', {
                                widgetId,
                                includeNeighbors,
                                selection: Array.from(egoSelection),
                                ...tasksSelectionDebugPayload(selectedNodeIdRef.current, selectedNodeIdsRef.current, hoveredNodeId),
                            });
                            const egoState = buildTasksEgoState(model, rawGraph, egoSelection, includeNeighbors, activeColorBy);
                            if (!egoState) return;
                            openTasksEgoModal(wrapper, {
                                title: `${sourceModel.title || sourceModel.graph_id || 'Knowledge Graph'} ego`,
                                model: egoState.model,
                                graph: egoState.graph,
                                selectedIds: Array.from(egoSelection),
                                includeNeighbors,
                            });
                        },
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
                        toggleFilters: () => setFiltersCollapsed((current) => !current),
                        openFilters: () => setFiltersCollapsed(false),
                        closeFilters: () => setFiltersCollapsed(true),
                        toggleEdges: () => setEdgesVisible((current) => !current),
                        toggleHelp: () => setHelpOpen((current) => !current),
                    };
                    return () => {
                        delete window.__vyasaTasksActions[widgetId];
                    };
                }, [reactFlow, currentSelectionIds, model, rawGraph, sourceModel, egoMode, activeColorBy]);
                return null;
            };
            const FitOnNodesReady = () => {
                const reactFlow = rf.useReactFlow();
                React.useEffect(() => {
                    if (pendingFitActionRef.current !== 'mode') return;
                    // Pragmatic: wait long enough for the layout to settle, then fit.
                    // Same call the F key triggers, just timed past any settle race.
                    const timeoutId = window.setTimeout(() => {
                        reactFlow.fitView({ duration: 200, padding: 0.16, includeHiddenNodes: true });
                        pendingFitActionRef.current = null;
                    }, 350);
                    return () => window.clearTimeout(timeoutId);
                }, [reactFlow, graphRevision, viewMode]);
                return null;
            };
            const flowWrapperClassName = hoveredNodeId ? 'vyasa-tasks-hovering-edge-labels' : '';
            const buildProjectionConfigText = (projection) => {
                const pid = String(projection?.id || '');
                const def = (Array.isArray(sourceModel?.view_projections) ? sourceModel.view_projections : []).find((p) => p && p.id === pid) || null;
                const isActiveLive = viewMode !== 'gantt' && pid === String(activeProjectionId || '');
                const defGroups = def ? (Array.isArray(def.groups_from) ? def.groups_from : [def.groups_from]) : [];
                const fallbackGroups = defGroups.length ? defGroups : tasksProjectionGroupByHierarchy(sourceModel, pid);
                const groupBy = (isActiveLive && !pid) ? groupByHierarchy : fallbackGroups;
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
                    searchQuery: isActiveLive ? searchQuery : (def?.search || ''),
                    filtersCollapsed: isActiveLive ? filtersCollapsed : def?.filters_collapsed,
                    edgesVisible: isActiveLive ? edgesVisible : def?.edges_visible,
                    edgeAnimationEnabled: isActiveLive ? edgeAnimationEnabled : def?.edge_animation_enabled,
                    edgeAnimationMode: isActiveLive ? edgeAnimationMode : def?.edge_animation_mode,
                    edgeOpacity: isActiveLive ? edgeOpacity : def?.edge_opacity,
                    projectionUnspecifiedContentOpacity: isActiveLive ? projectionUnspecifiedContentOpacity : def?.projection_unspecified_content_opacity,
                    defaultOpenDepth: effectiveDefaultOpenDepth,
                });
            };
            const RightRail = () => {
                if (!selectedNodeId) return null;
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
                    SelectedNodePanel()
                );
            };
            const EgoNeighborControl = () => {
                if (!egoMode || !model.ego_include_neighbors) return null;
                return window.React.createElement('div', {
                    style: {
                        position: 'absolute',
                        left: '12px',
                        top: '12px',
                        zIndex: 34,
                        pointerEvents: 'auto',
                        display: 'grid',
                        gridTemplateColumns: 'max-content minmax(92px, 150px) max-content',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '7px 9px',
                        borderRadius: '8px',
                        border: '1px solid color-mix(in srgb, var(--vyasa-primary) 22%, transparent)',
                        background: 'color-mix(in srgb, var(--vyasa-paper) 92%, transparent)',
                        boxShadow: '0 10px 24px rgba(0,0,0,0.10)',
                        backdropFilter: 'blur(8px)',
                        fontSize: '12px',
                    },
                },
                    window.React.createElement('span', { style: { fontWeight: 700, opacity: 0.72 } }, 'Neighbor Opacity'),
                    window.React.createElement('input', {
                        type: 'range',
                        min: 0.05,
                        max: 1,
                        step: 0.01,
                        value: egoNeighborOpacity,
                        onChange: (event) => setEgoNeighborOpacity(clampTasksEgoNeighborOpacity(event.target.value)),
                        style: { width: '100%', minWidth: 0, margin: 0 },
                    }),
                    window.React.createElement('span', { style: { opacity: 0.8, minWidth: '3em', textAlign: 'right', fontVariantNumeric: 'tabular-nums' } }, tasksOpacityPctLabel(egoNeighborOpacity))
                );
            };
            const GroupHoverTooltip = () => {
                if (!groupHoverTooltip) return null;
                const rows = Array.isArray(groupHoverTooltip.rows) ? groupHoverTooltip.rows : [];
                const image = normalizeTasksNodeImageUrl(groupHoverTooltip.image);
                const panelWidth = tasksDetailPanelWidth({
                    title: groupHoverTooltip.label || '',
                    nodeId: groupHoverTooltip.nodeId || '',
                    entries: rows,
                    titleFont: `700 calc(${hoverFontSize} * 1.12) ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`,
                    bodyFont: `500 ${hoverFontSize} ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`,
                    keyFont: `700 ${hoverFontSize} ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`,
                    hasImage: Boolean(image),
                });
                const wrapperWidth = Math.max(240, Math.floor(flowWrapperRef.current?.getBoundingClientRect?.().width || 0));
                const wrapperHeight = Math.max(160, Math.floor(flowWrapperRef.current?.getBoundingClientRect?.().height || 0));
                const maxWidth = Math.max(220, Math.min(panelWidth, wrapperWidth - 24));
                const clampedLeft = Math.max(12, Math.min(groupHoverTooltip.x, wrapperWidth - maxWidth - 12));
                const clampedTop = Math.max(12, Math.min(groupHoverTooltip.y, wrapperHeight - 24));
                const children = [
                    window.React.createElement('div', {
                        key: '__label__',
                        style: { display: 'flex', alignItems: 'center', gap: '7px', justifyContent: 'space-between', fontWeight: 700, fontSize: `calc(${hoverFontSize} * 1.12)`, lineHeight: 1.25, marginBottom: rows.length ? '4px' : 0, whiteSpace: 'normal', overflowWrap: 'anywhere', wordBreak: 'break-word', minWidth: 0 },
                    },
                        image ? window.React.createElement('img', {
                            src: image,
                            alt: '',
                            loading: 'lazy',
                            draggable: false,
                            className: tasksIsIconifyImage(image) ? 'vyasa-tasks-node-image vyasa-tasks-node-image--icon' : 'vyasa-tasks-node-image',
                            style: { width: '22px', height: '22px', objectFit: 'contain', flex: '0 0 auto' },
                        }) : null,
                        window.React.createElement('span', { style: { flex: '1 1 auto', minWidth: 0 } }, groupHoverTooltip.label),
                        groupHoverTooltip.nodeId ? window.React.createElement('span', {
                            style: { flex: '0 0 auto', marginLeft: '12px', fontSize: hoverFontSize, fontWeight: 600, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace', opacity: 0.7, textAlign: 'right' },
                        }, groupHoverTooltip.nodeId) : null
                    ),
                ];
                if (rows.length) children.push(renderTasksDetailEntries(window.React, rows, { fontSize: hoverFontSize, lineHeight: 1.35 }));
                return window.React.createElement('div', {
                    style: {
                        position: 'absolute',
                        left: clampedLeft,
                        top: clampedTop,
                        zIndex: 2400,
                        pointerEvents: 'none',
                        width: `${maxWidth}px`,
                        maxWidth: '100%',
                        minWidth: 'min(220px, 100%)',
                        boxSizing: 'border-box',
                        borderRadius: '12px',
                        border: '1px solid color-mix(in srgb, var(--vyasa-primary) 28%, transparent)',
                        background: 'color-mix(in srgb, var(--vyasa-paper) 92%, transparent)',
                        boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
                        backdropFilter: 'blur(8px)',
                        padding: '12px',
                    },
                }, ...children);
            };
            const HelpPopup = () => !helpOpen ? null : window.React.createElement('div', {
                style: { position: 'absolute', left: '12px', top: egoMode && model.ego_include_neighbors ? '58px' : '12px', zIndex: 35, width: 'min(320px, calc(100% - 24px))', padding: '10px 12px', borderRadius: '10px', border: '1px solid color-mix(in srgb, var(--vyasa-primary) 22%, transparent)', background: 'color-mix(in srgb, var(--vyasa-paper) 94%, transparent)', boxShadow: '0 10px 24px rgba(0,0,0,0.12)', backdropFilter: 'blur(8px)', pointerEvents: 'auto', fontSize: '12px', lineHeight: 1.45 }
            }, window.React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '6px' } },
                window.React.createElement('strong', null, 'Graph help'),
                window.React.createElement('button', { type: 'button', onClick: () => setHelpOpen(false), style: { border: 'none', background: 'none', cursor: 'pointer', fontSize: '14px', lineHeight: 1, opacity: 0.7 } }, '×')
            ), window.React.createElement('div', { style: { whiteSpace: 'pre-line' } }, 'Mouse\nClick node: select card or group\nClick canvas: clear selection\nShift + drag: box select\nCmd + drag: lasso select\nWheel / pinch: zoom\nDrag canvas: pan\n\nKeys\n?: toggle this help\nF: fit view\nShift + F: toggle fullscreen\nG: open EG\nShift + G: open EG+\nS: toggle filters\nE: toggle edges\n0: edge animation none / smooth / tick\nT: toggle hovered group\nI / O: expand or collapse one group depth\nU / P: unfold or collapse all groups\nArrow keys: pan\nShift + arrows: pan faster'));
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
                const close = () => { setSlideIndex(-1); setSelectedNodeId(null); setSelectedNodeIds(new Set()); };
                const go = (delta) => setSlideIndex((index) => Math.min(slides.length - 1, Math.max(0, index + delta)));
                const panelWidth = `min(${TASKS_FILTER_PANEL_WIDTH}px, calc(100% - 24px))`;
                return window.React.createElement('aside', {
                    style: { flex: `0 0 ${panelWidth}`, width: panelWidth, minWidth: 0, height: '100%', marginLeft: '-12px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', padding: '16px', borderRadius: '14px', border: '1px solid color-mix(in srgb, var(--vyasa-primary) 26%, transparent)', background: 'color-mix(in srgb, var(--vyasa-paper) 95%, transparent)', boxShadow: '0 14px 36px rgba(0,0,0,0.16)', pointerEvents: 'auto' },
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
                onPointerDown: () => {
                    markWidgetActive();
                    flowWrapperRef.current?.focus({ preventScroll: true });
                },
                onPointerDownCapture: startDragSelection,
                onPointerMove: updateGroupHoverTooltip,
                onPointerMoveCapture: updateDragSelection,
                onPointerUpCapture: finishDragSelection,
                onPointerCancelCapture: finishDragSelection,
                onPointerLeave: (event) => {
                    finishDragSelection(event);
                    groupToggleHoverIdRef.current = '';
                    setTasksGroupToggleHover(flowWrapperRef.current, '');
                    clearGroupHoverTooltip();
                },
            };
            return rf.ReactFlowProvider ? window.React.createElement(rf.ReactFlowProvider, null,
                window.React.createElement('div', { onPointerDownCapture: markWidgetActive, onFocusCapture: markWidgetActive, style: { width: '100%', height: '100%', flex: '1 1 auto', minHeight: 0, display: 'flex', alignItems: 'stretch', gap: '12px', position: 'relative' } },
                    filterPanelElement,
                    SlideShow(),
                    window.React.createElement('div', { ref: flowWrapperRef, className: flowWrapperClassName, tabIndex: 0, style: { flex: '1 1 auto', minWidth: 0, minHeight: 0, alignSelf: 'stretch', display: 'flex', outline: 'none', position: 'relative', ...edgeAnimationStyle }, ...flowPointerHandlers },
                    window.React.createElement(rf.ReactFlow, { nodes, edges, nodeTypes, edgeTypes, defaultEdgeOptions, fitView: true, minZoom: graphMinZoom, nodesDraggable: false, elementsSelectable: false, zIndexMode: 'manual', style: { width: '100%', height: '100%' }, onNodeClick: selectGraphNode, onNodeMouseEnter: focusNeighborEdge, onNodeMouseLeave: clearNeighborEdgeFocus, onPaneClick: paneClick, onPaneContextMenu: clearSelection },
                    window.React.createElement(rf.Background, backgroundProps),
                    window.React.createElement(rf.Controls),
                    window.React.createElement(PanControls),
                    window.React.createElement(SlideLauncher),
                    window.React.createElement(FitViewHotkey),
                    window.React.createElement(ActionBridge),
                    window.React.createElement(FitOnNodesReady)
                    ),
                    RightRail(),
                    window.React.createElement(EgoNeighborControl),
                    window.React.createElement(HelpPopup),
                    window.React.createElement(GroupHoverTooltip),
                    window.React.createElement(DragSelectionOverlay)
                ))
            ) : window.React.createElement('div', { onPointerDownCapture: markWidgetActive, onFocusCapture: markWidgetActive, style: { width: '100%', height: '100%', flex: '1 1 auto', minHeight: 0, display: 'flex', alignItems: 'stretch', gap: '12px', position: 'relative' } },
                filterPanelElement,
                window.React.createElement('div', { ref: flowWrapperRef, className: flowWrapperClassName, tabIndex: 0, style: { flex: '1 1 auto', minWidth: 0, minHeight: 0, alignSelf: 'stretch', display: 'flex', outline: 'none', position: 'relative', ...edgeAnimationStyle }, ...flowPointerHandlers },
                    window.React.createElement(rf.ReactFlow, { nodes, edges, nodeTypes, edgeTypes, defaultEdgeOptions, fitView: true, minZoom: graphMinZoom, nodesDraggable: false, elementsSelectable: false, zIndexMode: 'manual', style: { width: '100%', height: '100%' }, onNodeClick: selectGraphNode, onNodeMouseEnter: focusNeighborEdge, onNodeMouseLeave: clearNeighborEdgeFocus, onPaneClick: paneClick, onPaneContextMenu: clearSelection },
                    window.React.createElement(rf.Background, backgroundProps),
                        window.React.createElement(rf.Controls),
                        window.React.createElement(PanControls),
                    window.React.createElement(SlideLauncher),
                        window.React.createElement(FitViewHotkey),
                        window.React.createElement(ActionBridge),
                        window.React.createElement(FitOnNodesReady)
                    ),
                    RightRail(),
                    window.React.createElement(EgoNeighborControl),
                    window.React.createElement(HelpPopup),
                    window.React.createElement(GroupHoverTooltip),
                    window.React.createElement(DragSelectionOverlay)
                )
            );
        };
        if (window.ReactDOM.createRoot) window.ReactDOM.createRoot(mount).render(window.React.createElement(TasksGraphApp)); else window.ReactDOM.render(window.React.createElement(TasksGraphApp), mount);
        wrapper.dataset.tasksMounted = 'true';
    }
    if (needsRetry) window.requestAnimationFrame(() => { renderTasksGraphs(rootElement); });
}

function bindPanZoomGestures(wrapper, state, { getTarget, applyState, maxScale = 55 }) {
    const pointers = new Map();
    const pointerCenter = () => {
        const values = Array.from(pointers.values());
        return {
            x: values.reduce((sum, pointer) => sum + pointer.clientX, 0) / values.length,
            y: values.reduce((sum, pointer) => sum + pointer.clientY, 0) / values.length,
        };
    };
    const pointerDistance = () => {
        const values = Array.from(pointers.values());
        if (values.length < 2) return 0;
        return Math.hypot(values[0].clientX - values[1].clientX, values[0].clientY - values[1].clientY);
    };
    const resetPinch = () => {
        state.pinchDistance = 0;
        state.pinchLastCenter = null;
    };
    const beginPanFromPointer = (pointer) => {
        state.isPanning = true;
        state.startX = pointer.clientX - state.translateX;
        state.startY = pointer.clientY - state.translateY;
        resetPinch();
        wrapper.style.cursor = 'grabbing';
    };
    const beginPinch = () => {
        state.isPanning = false;
        state.pinchDistance = pointerDistance();
        state.pinchLastCenter = pointerCenter();
        wrapper.style.cursor = 'grabbing';
    };

    wrapper.addEventListener('wheel', (e) => {
        e.preventDefault();
        const target = getTarget();
        if (!target) return;
        Object.assign(state, nextWheelState(state, target.getBoundingClientRect(), { x: e.clientX, y: e.clientY }, e.deltaY, maxScale));
        applyState();
    }, { passive: false });

    wrapper.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        pointers.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
        try {
            wrapper.setPointerCapture(e.pointerId);
        } catch {
            // Ignore if this pointer cannot be captured.
        }
        if (pointers.size >= 2) {
            beginPinch();
        } else {
            beginPanFromPointer({ clientX: e.clientX, clientY: e.clientY });
        }
        e.preventDefault();
    });

    wrapper.addEventListener('pointermove', (e) => {
        if (!pointers.has(e.pointerId)) return;
        pointers.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
        if (pointers.size >= 2) {
            const target = getTarget();
            if (!target) return;
            const distance = pointerDistance();
            const center = pointerCenter();
            if (!state.pinchDistance || !state.pinchLastCenter) {
                beginPinch();
                return;
            }
            const rect = target.getBoundingClientRect();
            const centerX = center.x - rect.left - rect.width / 2;
            const centerY = center.y - rect.top - rect.height / 2;
            const newScale = clampScale(state.scale * (distance / Math.max(state.pinchDistance, 1)));
            const scaleFactor = newScale / state.scale - 1;
            state.translateX += center.x - state.pinchLastCenter.x;
            state.translateY += center.y - state.pinchLastCenter.y;
            state.translateX -= centerX * scaleFactor;
            state.translateY -= centerY * scaleFactor;
            state.scale = newScale;
            state.pinchDistance = distance;
            state.pinchLastCenter = center;
            applyState();
            e.preventDefault();
            return;
        }
        if (!state.isPanning) return;
        state.translateX = e.clientX - state.startX;
        state.translateY = e.clientY - state.startY;
        applyState();
        e.preventDefault();
    });

    const stopPointer = (e) => {
        pointers.delete(e.pointerId);
        try {
            wrapper.releasePointerCapture(e.pointerId);
        } catch {
            // Ignore if pointer capture is not active.
        }
        if (pointers.size >= 2) {
            beginPinch();
            return;
        }
        if (pointers.size === 1) {
            beginPanFromPointer(Array.from(pointers.values())[0]);
            return;
        }
        state.isPanning = false;
        resetPinch();
        wrapper.style.cursor = 'grab';
    };

    wrapper.addEventListener('pointerup', stopPointer);
    wrapper.addEventListener('pointercancel', stopPointer);
}

async function openTasksGraphModal(wrapper, options = {}) {
    if (!wrapper) return;
    const originalTitle = options.title || wrapper.getAttribute('data-tasks-title') || 'Tasks';
    const originalPayload = options.payload || wrapper.getAttribute('data-tasks-payload');
    const originalGraph = options.graph || wrapper.getAttribute('data-tasks-graph');
    if (!originalPayload || !originalGraph) return;
    const existing = document.getElementById('tasks-fullscreen-modal');
    const closeTasksGraphModal = (modal) => {
        if (!modal) return;
        if (modal.__tasksEscHandler) {
            document.removeEventListener('keydown', modal.__tasksEscHandler, true);
            modal.__tasksEscHandler = null;
        }
        if (modal.__tasksSuspendedMaximizeWrapper?.__tasksMaximizeEsc) {
            document.addEventListener('keydown', modal.__tasksSuspendedMaximizeWrapper.__tasksMaximizeEsc, true);
        }
        const suspended = modal.__tasksSuspendedModal;
        if (modal.isConnected) modal.remove();
        if (suspended) {
            suspended.style.display = '';
            suspended.removeAttribute('data-tasks-suspended');
            if (suspended.__tasksEscHandler) {
                document.addEventListener('keydown', suspended.__tasksEscHandler, true);
            }
        }
    };
    let suspendedModal = null;
    if (existing) {
        suspendedModal = existing;
        if (suspendedModal.__tasksEscHandler) {
            document.removeEventListener('keydown', suspendedModal.__tasksEscHandler, true);
        }
        suspendedModal.style.display = 'none';
        suspendedModal.setAttribute('data-tasks-suspended', 'true');
    }
    const suspendedMaximizeWrapper = wrapper.getAttribute('data-tasks-maximized') === 'true' && wrapper.__tasksMaximizeEsc
        ? wrapper
        : null;
    if (suspendedMaximizeWrapper) {
        document.removeEventListener('keydown', suspendedMaximizeWrapper.__tasksMaximizeEsc, true);
    }
    const id = wrapper.id || 'tasks';
    const modalWrapperId = options.wrapperId || `${id}-fullscreen`;
    const modal = document.createElement('div');
    modal.id = 'tasks-fullscreen-modal';
    modal.__tasksSuspendedModal = suspendedModal;
    modal.__tasksSuspendedMaximizeWrapper = suspendedMaximizeWrapper;
    modal.className = 'fixed inset-0 z-[10000] bg-black/88 backdrop-blur-sm';
    modal.style.animation = 'fadeIn 0.2s ease-in';

    const modalContent = document.createElement('div');
    modalContent.className = 'relative w-full h-full flex flex-col';
    modalContent.style.background = 'color-mix(in srgb, var(--vyasa-paper) 96%, transparent)';
    modalContent.style.color = 'var(--vyasa-ink)';

    const body = document.createElement('div');
    body.className = 'flex-1 overflow-hidden';
    body.style.background = 'transparent';

    const fullscreenWrapper = document.createElement('div');
    fullscreenWrapper.id = modalWrapperId;
    // Keep only the classes renderTasksGraphs needs to find/mount this widget; drop the
    // in-page card chrome (my-6 / border-4 / rounded-xl) and inherited inline styles that
    // would otherwise leak a top margin and a fixed height into the fullscreen layout.
    fullscreenWrapper.className = 'tasks-container relative';
    fullscreenWrapper.style.display = 'flex';
    fullscreenWrapper.style.flexDirection = 'column';
    fullscreenWrapper.style.width = '100%';
    fullscreenWrapper.style.height = '100%';
    fullscreenWrapper.style.minHeight = '0';
    fullscreenWrapper.setAttribute('data-tasks-widget', 'true');
    fullscreenWrapper.setAttribute('data-tasks-fullscreen', 'true');
    if (options.ego) fullscreenWrapper.setAttribute('data-tasks-ego', 'true');
    fullscreenWrapper.setAttribute('data-tasks-title', originalTitle);
    fullscreenWrapper.setAttribute('data-tasks-default-open-depth', options.ego ? '-1' : (wrapper.getAttribute('data-tasks-default-open-depth') || '0'));
    fullscreenWrapper.setAttribute('data-tasks-gantt', options.ego ? 'false' : (wrapper.getAttribute('data-tasks-gantt') || 'false'));
    fullscreenWrapper.setAttribute('data-tasks-default-view', options.ego ? 'graph' : (wrapper.getAttribute('data-tasks-default-view') || 'graph'));
    fullscreenWrapper.setAttribute('data-tasks-open-filters-default', options.ego ? 'false' : (wrapper.getAttribute('data-tasks-open-filters-default') || 'false'));
    fullscreenWrapper.setAttribute('data-tasks-node-card-width', wrapper.getAttribute('data-tasks-node-card-width') || '480px');
    fullscreenWrapper.setAttribute('data-tasks-hover-font-size', wrapper.getAttribute('data-tasks-hover-font-size') || '12px');
    fullscreenWrapper.setAttribute('data-tasks-projection-group-opacity', wrapper.getAttribute('data-tasks-projection-group-opacity') || `${TASKS_PROJECTION_GROUP_OPACITY_DEFAULT}`);
    fullscreenWrapper.setAttribute('data-tasks-projection-unspecified-group-opacity', wrapper.getAttribute('data-tasks-projection-unspecified-group-opacity') || `${TASKS_PROJECTION_UNSPECIFIED_GROUP_OPACITY_DEFAULT}`);
    fullscreenWrapper.setAttribute('data-tasks-projection-unspecified-content-opacity', wrapper.getAttribute('data-tasks-projection-unspecified-content-opacity') || `${TASKS_PROJECTION_UNSPECIFIED_CONTENT_OPACITY_DEFAULT}`);
    fullscreenWrapper.setAttribute('data-tasks-jitter', wrapper.getAttribute('data-tasks-jitter') || '0');
    fullscreenWrapper.setAttribute('data-tasks-jitter-y', wrapper.getAttribute('data-tasks-jitter-y') || wrapper.getAttribute('data-tasks-jitter') || '0');
    fullscreenWrapper.setAttribute('data-tasks-spacing', wrapper.getAttribute('data-tasks-spacing') || 'normal');
    fullscreenWrapper.setAttribute('data-tasks-layout-direction', wrapper.getAttribute('data-tasks-layout-direction') || 'TD');
    fullscreenWrapper.setAttribute('data-tasks-node-spacing', wrapper.getAttribute('data-tasks-node-spacing') || `${TASKS_ROOT_SPACING.node}`);
    fullscreenWrapper.setAttribute('data-tasks-layer-spacing', wrapper.getAttribute('data-tasks-layer-spacing') || `${TASKS_ROOT_SPACING.layer}`);
    fullscreenWrapper.setAttribute('data-tasks-collision-gap', wrapper.getAttribute('data-tasks-collision-gap') || `${TASKS_ROOT_COLLISION_GAP}`);
    fullscreenWrapper.setAttribute('data-tasks-group-padding', wrapper.getAttribute('data-tasks-group-padding') || `${TASKS_GROUP_PADDING.left}`);
    fullscreenWrapper.setAttribute('data-tasks-edge-label-width', wrapper.getAttribute('data-tasks-edge-label-width') || '240');
    fullscreenWrapper.setAttribute('data-tasks-payload', originalPayload);
    fullscreenWrapper.setAttribute('data-tasks-graph', originalGraph);
    const fullscreenId = fullscreenWrapper.id;
    const headerBar = document.createElement('div');
    headerBar.className = 'px-3 py-2 pr-14 border-b border-slate-200 dark:border-slate-800 flex items-start gap-2 relative';
    headerBar.style.flex = '0 0 auto';
    const topRightControls = document.createElement('div');
    topRightControls.className = 'absolute top-2 right-2 z-10 flex items-center gap-1';
    topRightControls.innerHTML = options.ego
        ? `<div class="flex items-center gap-1 text-[11px] font-medium tracking-wide text-slate-500 dark:text-slate-400 whitespace-nowrap">${tasksHeaderButtonHtml(fullscreenId, 'toggleHelp', '?', 'Show graph shortcuts and gestures')}${tasksHeaderButtonHtml(fullscreenId, 'fit', 'F', 'Fit view')}${tasksHeaderButtonHtml(fullscreenId, 'toggleEdges', 'E', 'Toggle edges')}</div>`
        : tasksHeaderControlsHtml(fullscreenId, false);
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.title = 'Close (Shift+Esc)';
    closeBtn.className = 'rounded border border-slate-300 dark:border-slate-600 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-1.5 py-0.5 font-mono text-[10px] leading-none text-slate-700 dark:text-slate-300';
    closeBtn.textContent = 'X';
    closeBtn.onclick = () => closeTasksGraphModal(modal);
    topRightControls.appendChild(closeBtn);
    const headerTitle = document.createElement('div');
    headerTitle.className = 'min-w-0 flex-1';
    const filterButton = document.createElement('button');
    filterButton.type = 'button';
    filterButton.title = 'Toggle filters';
    filterButton.setAttribute('aria-label', 'Toggle task filters');
    filterButton.setAttribute('onclick', `runTasksHeaderAction('${fullscreenId}', 'toggleFilters')`);
    filterButton.className = 'relative z-40 mt-0.5 rounded border border-slate-300 dark:border-slate-600 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-2 py-1 font-mono text-xs leading-none text-slate-700 dark:text-slate-300';
    filterButton.textContent = '☰';
    if (options.ego) filterButton.style.display = 'none';
    const headerName = document.createElement('span');
    headerName.className = 'text-xs font-semibold';
    headerName.textContent = originalTitle;
    const headerStats = document.createElement('div');
    headerStats.setAttribute('data-tasks-stats', '');
    headerStats.className = 'mt-1 text-xs font-medium text-slate-500 dark:text-slate-400';
    headerStats.textContent = wrapper.querySelector('[data-tasks-stats]')?.textContent || '';
    headerTitle.append(headerName, headerStats);
    headerBar.append(filterButton, headerTitle, topRightControls);

    const flow = document.createElement('div');
    flow.className = 'vyasa-tasks-flow';
    flow.style.flex = '1 1 auto';
    flow.style.minHeight = '0';
    flow.style.overflow = 'hidden';
    flow.style.cursor = 'grab';
    flow.style.display = 'flex';
    flow.style.flexDirection = 'column';
    flow.style.position = 'relative';

    const scene = document.createElement('div');
    scene.className = 'vyasa-tasks-scene';
    scene.style.position = 'relative';
    scene.style.width = '1200px';
    scene.style.height = '420px';
    scene.style.transformOrigin = 'center center';
    flow.appendChild(scene);
    fullscreenWrapper.appendChild(headerBar);
    fullscreenWrapper.appendChild(flow);

    body.appendChild(fullscreenWrapper);
    modalContent.appendChild(body);
    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    const escHandler = (e) => {
        if (e.key !== 'Escape' || !e.shiftKey) return;
        if (document.getElementById('tasks-fullscreen-modal') !== modal) return;
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation?.();
        closeTasksGraphModal(modal);
    };
    modal.__tasksEscHandler = escHandler;
    document.addEventListener('keydown', escHandler, true);

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeTasksGraphModal(modal);
        }
    });

    await renderTasksGraphs(modal);
}

function setTasksMaximized(wrapper, on) {
    if (!wrapper) return;
    const isOn = wrapper.getAttribute('data-tasks-maximized') === 'true';
    if (on === isOn) return;
    if (on) {
        wrapper.setAttribute('data-tasks-maximized', 'true');
        wrapper.__tasksPrevBodyOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const escHandler = (event) => {
            if (event.key !== 'Escape' || !event.shiftKey) return;
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation?.();
            setTasksMaximized(wrapper, false);
        };
        wrapper.__tasksMaximizeEsc = escHandler;
        document.addEventListener('keydown', escHandler, true);
    } else {
        wrapper.removeAttribute('data-tasks-maximized');
        document.body.style.overflow = wrapper.__tasksPrevBodyOverflow || '';
        if (wrapper.__tasksMaximizeEsc) {
            document.removeEventListener('keydown', wrapper.__tasksMaximizeEsc, true);
            wrapper.__tasksMaximizeEsc = null;
        }
    }
    syncTasksFullscreenButton(wrapper);
    // Same React instance, just a new size — let layout settle, then refit.
    window.requestAnimationFrame(() => {
        window.dispatchEvent(new Event('resize'));
        window.setTimeout(() => window.__vyasaTasksActions?.[wrapper.id]?.fit?.(), 80);
    });
}

window.openTasksFullscreen = function(id) {
    const wrapper = document.getElementById(id);
    if (!wrapper) return;
    setTasksMaximized(wrapper, wrapper.getAttribute('data-tasks-maximized') !== 'true');
};

async function openTasksEgoModal(wrapper, options = {}) {
    await openTasksGraphModal(wrapper, {
        title: options.includeNeighbors ? `${options.title} + neighbors` : options.title,
        payload: JSON.stringify(options.model || {}),
        graph: JSON.stringify(options.graph || { nodes: [], edges: [] }),
        wrapperId: `${wrapper.id || 'tasks'}-ego-${options.includeNeighbors ? 'neighbors' : 'selected'}`,
        ego: true,
    });
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
