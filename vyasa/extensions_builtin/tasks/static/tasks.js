import ELK from 'https://esm.sh/elkjs@0.10.0';
import { applyTasksFilterAttributePolicy, buildTaskEdgeAnchors, clampScale, isTasksEdgeInternalToSelection, isTasksEdgeLabelHoverDimmingActive, isTasksGraphNodeSelectable, isTasksUnspecifiedProjectionGroup, layoutDisconnectedTaskNodes, measureTextWidth, nextWheelState, normalizeTasksNodeImageUrl, resolveTasksNodeImage, selectTasksGraphNodeIdsInPolygon, selectTasksGraphNodeIdsInRect, sizeTaskNode, tasksEdgeLabelZForMode, tasksExpandedRootRect, tasksGraphNodeHitArea, tasksProjectionGroupByHierarchy, toggleMultiValueFilter } from '/static/extensions/tasks/tasks_graph_core.js';

const tasksElk = new ELK();
let tasksReactFlowReady = null;
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
const TASKS_DONE_ACCENT = '#22c55e';
const TASKS_CARD_STATE_ATTR = 'card_state';
const TASKS_HAS_NOTE_ATTR = 'has_note';
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
]);
const TASKS_INTERNAL_NODE_META_KEYS = new Set([
    'id', 'label', 'kind', '__kind__', 'group_id', 'parent_group_id',
    'handlelayout', 'highlightmode', 'sourcegroupid', 'source_group_id',
    '__rendered_attrs__', 'width', 'height', 'position', 'parentid',
    'parent_id', 'color', 'href', 'image', 'image_by', 'collapsed', 'child_group_ids',
    'child_task_ids', '__projection_group__', 'projection', '__kg_sources',
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

function tasksFilterPanelMaxHeight(wrapper) {
    if (!wrapper) return '100%';
    const bounds = wrapper.getBoundingClientRect();
    const available = Math.max(220, Math.floor(bounds.height));
    return `${available}px`;
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

function tasksProminentEdgeOpacity() {
    return 1;
}

function tasksEdgeOpacityLabel(opacity) {
    const value = clampTasksEdgeOpacity(opacity);
    if (value <= 0.2) return 'Faint';
    if (value >= 0.85) return 'Bold';
    return 'Clear';
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
    const key = tasksProjectionPrefsKey(projectionId);
    const scoped = prefs?.projectionPrefs?.[key];
    if (scoped && typeof scoped === 'object') return scoped;
    if (prefs?.projectionPrefs && typeof prefs.projectionPrefs === 'object') return {};
    return prefs && typeof prefs === 'object' ? prefs : {};
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
    const payload = JSON.stringify({
        version: 1,
        projectionId,
        edgeOpacity,
        unspecifiedContentOpacity,
        groupByHierarchy,
        projectionPrefs,
        nodeStates,
        nodeNotes,
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

function tasksNodeMetaEntries(node) {
    if (!node) return [];
    return Object.entries(node)
        .filter(([key, value]) => !tasksIsHiddenNodeMetaKey(key) && value !== null && value !== undefined && value !== '' && (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'))
        .map(([key, value]) => ({
            key,
            label: key.replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase()),
            value: String(value),
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
    const edgeLabel = edgeCount === 1 ? 'Edge' : 'Edges';
    return `${nodeCount} ${nodeLabel} and ${edgeCount} ${edgeLabel}`;
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
            if (!(typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')) continue;
            if (!buckets.has(key)) buckets.set(key, { values: new Set(), kinds: new Set() });
            buckets.get(key).values.add(String(value));
            buckets.get(key).kinds.add(typeof value);
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
            const value = node?.[key];
            return value !== null && value !== undefined && String(value).trim() !== '';
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
                label: tasksNodeMetaLabel(attr) + ' > ' + value,
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
    const value = String(color || '').trim().replace(/^#/, '');
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
    const average = (key) => Math.round(parsed.reduce((sum, color) => sum + color[key], 0) / parsed.length);
    return `#${['r', 'g', 'b'].map((key) => average(key).toString(16).padStart(2, '0')).join('')}`;
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
            .map((node) => node?.[key])
            .filter((value) => value !== null && value !== undefined && String(value).trim() !== '')
            .map((value) => String(value))
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
        const value = edge[requestedAttr];
        if (value !== null && value !== undefined && String(value).trim()) {
            return String(value).trim();
        }
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
    const value = edge[colorBy];
    const paletteKey = value === null || value === undefined || String(value).trim() === ''
        ? (typeof edge.label === 'string' ? edge.label.trim() : '')
        : String(value);
    if (!paletteKey) return '';
    const color = palette[paletteKey];
    return typeof color === 'string' && color.trim() ? color.trim() : '';
}

function tasksNodeMatchesFilters(node, filters) {
    const entries = Object.entries(filters || {}).filter(([, value]) => value);
    if (!entries.length) return true;
    return entries.every(([key, value]) => {
        const nodeValue = key === TASKS_HAS_NOTE_ATTR
            ? (node?.__has_note__ ? 'yes' : 'no')
            : node?.[key];
        if (Array.isArray(value)) return !value.length || value.includes(String(nodeValue || ''));
        return String(nodeValue || '') === String(value);
    });
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

function tasksCollectSearchMatches(nodes, edges, query) {
    const spec = tasksSearchSpec(query);
    const nodeIds = new Set();
    const edgeIds = new Set();
    if (!spec.active || spec.error || !spec.matcher) return { ...spec, nodeIds, edgeIds };
    const hiddenEdgeKeys = new Set(['id', 'source', 'target', 'type', 'animated', 'markerend', 'labelstyle', 'labelbgstyle', 'style', 'data', 'zindex', 'sourcehandle', 'targethandle']);
    for (const node of (nodes || [])) {
        const data = node?.data || {};
        if (data.__kind__ === 'groupTitle') continue;
        const values = [data.label];
        for (const [key, value] of Object.entries(data)) {
            if (tasksIsHiddenNodeMetaKey(key)) continue;
            if (value === null || value === undefined || typeof value === 'object' || typeof value === 'function') continue;
            values.push(value);
        }
        if (values.some((value) => tasksSearchMatchesText(value, spec))) nodeIds.add(node.id);
    }
    for (const edge of (edges || [])) {
        const values = [];
        for (const [key, value] of Object.entries(edge || {})) {
            if (hiddenEdgeKeys.has(String(key).toLowerCase())) continue;
            if (value === null || value === undefined || typeof value === 'object' || typeof value === 'function') continue;
            values.push(value);
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
        const value = node[colorBy];
        if (value !== null && value !== undefined && String(value).trim()) {
            if (isTasksGradientPalette(palette)) return resolveTasksGradientColor(palette, value);
            const color = palette[String(value)];
            if (typeof color === 'string' && color.trim()) return color.trim();
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

window.runTasksHeaderAction = function(widgetId, action) {
    const actions = window.__vyasaTasksActions?.[widgetId];
    if (!actions || typeof actions[action] !== 'function') return;
    actions[action]();
};

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
                .react-flow__edge-textwrapper,
                .react-flow__edge-text,
                .react-flow__edge-textbg {
                    pointer-events: none;
                }
                .react-flow__edgelabel-renderer {
                    pointer-events: none;
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
                .react-flow__edge.animated path {
                    animation: vyasa-edge-dashdraw var(--vyasa-edge-flow-duration, 0.6s) linear infinite;
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
        return window.React && window.ReactDOM && window.ReactFlow;
    })();
    return tasksReactFlowReady;
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
    const str = String(value).trim();
    if (!str) return '';
    // Try numeric formatting for stringy numbers (the fence parser stores everything as strings).
    if (/^-?\d+(\.\d+)?$/.test(str)) {
        const num = Number(str);
        if (Number.isFinite(num) && Math.abs(num) >= 1000) return num.toLocaleString('en-US');
    }
    return str;
}

function tasksSelectedPanelWidth(node, entries) {
    const titleWidth = measureTextWidth(node?.label || node?.id || '', '700 14px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif');
    const rowWidths = (entries || []).map((entry) => {
        const keyWidth = measureTextWidth(entry?.label || '', '700 12px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif');
        const rawValue = entry?.value || '';
        const firstLine = String(rawValue).split(/\r?\n/, 1)[0];
        const valueWidth = Math.min(measureTextWidth(firstLine, '500 12px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'), 360);
        const weight = rawValue.length > 72 ? 0.48 : rawValue.length > 36 ? 0.68 : 0.9;
        return keyWidth + valueWidth * weight;
    }).sort((left, right) => left - right);
    const weightedWidth = rowWidths.length ? rowWidths[Math.max(0, Math.floor(rowWidths.length * 0.62) - 1)] : 0;
    return Math.round(Math.min(560, Math.max(250, titleWidth + 32, weightedWidth + 110)));
}

function tasksHoverTooltipWidth(label, rows, hoverFontSize, hasImage = false) {
    const titleFont = `700 calc(${hoverFontSize} * 1.12) ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    const bodyFont = `500 ${hoverFontSize} ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    const keyFont = `700 ${hoverFontSize} ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    const titleWidth = measureTextWidth(label || '', titleFont);
    const rowWidths = (rows || []).map((row) => {
        const keyWidth = measureTextWidth(row?.label || '', keyFont);
        const rawValue = String(row?.value || '');
        const firstLine = rawValue.split(/\r?\n/, 1)[0];
        const valueWidth = Math.min(measureTextWidth(firstLine, bodyFont), 420);
        const weight = rawValue.length > 96 ? 0.46 : rawValue.length > 48 ? 0.66 : 0.88;
        return keyWidth + valueWidth * weight;
    }).sort((left, right) => left - right);
    const weightedWidth = rowWidths.length ? rowWidths[Math.max(0, Math.floor(rowWidths.length * 0.62) - 1)] : 0;
    const imageReserve = hasImage ? 34 : 0;
    return Math.round(Math.min(560, Math.max(220, titleWidth + imageReserve + 34, weightedWidth + 116)));
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
    return `<button type="button" title="${title}" onclick="runTasksHeaderAction('${widgetId}', '${action}')" class="rounded border border-slate-300 dark:border-slate-600 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-1.5 py-0.5 font-mono text-[10px] leading-none text-slate-700 dark:text-slate-300">${label}</button>`;
}

function tasksHeaderControlsHtml(widgetId, includeFullscreen = false) {
    const fullscreen = includeFullscreen
        ? `<button onclick="openTasksFullscreen('${widgetId}')" class="px-2 py-1 text-xs border rounded hover:bg-slate-100 dark:hover:bg-slate-700" title="Fullscreen">⛶</button>`
        : '';
    return `${fullscreen}<div class="flex items-center gap-1 text-[11px] font-medium tracking-wide text-slate-500 dark:text-slate-400 whitespace-nowrap">${tasksHeaderButtonHtml(widgetId, 'toggleHelp', '?', 'Show graph shortcuts and gestures')}${tasksHeaderButtonHtml(widgetId, 'openEgo', 'EG', 'Open selected ego graph')}${tasksHeaderButtonHtml(widgetId, 'openEgoNeighbors', 'EG+', 'Open selected ego graph with neighbors')}${tasksHeaderButtonHtml(widgetId, 'fit', 'F', 'Fit view')}${tasksHeaderButtonHtml(widgetId, 'expandDepth', 'I', 'Expand next group depth')}${tasksHeaderButtonHtml(widgetId, 'collapseDepth', 'O', 'Collapse deepest group depth')}${tasksHeaderButtonHtml(widgetId, 'expand', 'U', 'Unfold all groups')}${tasksHeaderButtonHtml(widgetId, 'collapse', 'P', 'Collapse all groups')}${tasksHeaderButtonHtml(widgetId, 'toggleEdges', 'E', 'Toggle edges')}</div>`;
}

function tasksHoverAttrRows(node, hoverAttrs) {
    if (!node || !Array.isArray(hoverAttrs) || !hoverAttrs.length) return [];
    const rows = [];
    for (const attr of hoverAttrs) {
        const value = node[attr];
        if (value === null || value === undefined || String(value).trim() === '') continue;
        rows.push({ attr, label: tasksNodeMetaLabel(attr), value: tasksFormatHoverValue(attr, value) });
    }
    return rows;
}

function tasksProjectionOptions(model, ganttEnabled = false) {
    const projections = Array.isArray(model?.view_projections) ? model.view_projections : [];
    const baseViewLabel = String(model?.base_view_label || '').trim() || 'Default';
    if (!projections.length && !ganttEnabled) return [];
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
    if (!String(projectionId || '').trim() && defaultColorBy && validColorKeys.has(defaultColorBy)) {
        return defaultColorBy;
    }
    if (saved && validColorKeys.has(saved)) return saved;
    return validColorKeys.has(defaultColorBy) ? defaultColorBy : '';
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

async function renderTasksGraphs(rootElement = document) {
    const wrappers = Array.from(rootElement.querySelectorAll('.tasks-container[data-tasks-widget="true"]'));
    if (!wrappers.length) return;
    const rf = await ensureTasksReactFlow();
    let needsRetry = false;
    for (const wrapper of wrappers) {
        if (wrapper.dataset.tasksMounted === 'true') continue;
        const mount = wrapper.querySelector('.vyasa-tasks-flow');
        if (!mount || !rf) continue;
        if (wrapper.offsetParent === null || mount.clientWidth <= 0 || mount.clientHeight <= 0) {
            needsRetry = true;
            continue;
        }
        const sourceModel = JSON.parse(wrapper.dataset.tasksPayload || '{"groups":[],"tasks":[],"group_tree":{},"task_children":{},"dependency_edges":[]}');
        const sourceGraph = normalizeTasksGraphNodes(JSON.parse(wrapper.dataset.tasksGraph || '{"nodes":[],"edges":[]}'), sourceModel);
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
            const sourcePrefsRef = React.useRef(null);
            if (sourcePrefsRef.current === null) sourcePrefsRef.current = readTasksPrefs(sourceModel);
            const projectionOptions = React.useMemo(() => egoMode ? [] : tasksProjectionOptions(sourceModel, ganttEnabled), []);
            const storedProjectionPrefsRef = React.useRef(sourcePrefsRef.current?.projectionPrefs && typeof sourcePrefsRef.current.projectionPrefs === 'object'
                ? sourcePrefsRef.current.projectionPrefs
                : {});
            const initialProjectionId = React.useMemo(() => {
                if (defaultViewMode === 'gantt') return TASKS_GANTT_PROJECTION_ID;
                const saved = String(sourcePrefsRef.current?.projectionId || '').trim();
                if (projectionOptions.some((option) => option.id === saved)) return saved;
                const configured = String(sourceModel?.default_projection || '').trim();
                return projectionOptions.some((option) => option.id === configured) ? configured : '';
            }, [projectionOptions]);
            const initialGraphProjectionId = initialProjectionId === TASKS_GANTT_PROJECTION_ID ? '' : initialProjectionId;
            const [activeProjectionId, setActiveProjectionId] = React.useState(initialGraphProjectionId);
            const [viewMode, setViewMode] = React.useState(defaultViewMode);
            const [groupByHierarchy, setGroupByHierarchy] = React.useState(() => (
                Array.isArray(sourcePrefsRef.current?.groupByHierarchy) ? sourcePrefsRef.current.groupByHierarchy : []
            ));
            const projectionState = React.useMemo(
                () => buildTasksViewState(sourceModel, sourceGraph, activeProjectionId, viewMode, groupByHierarchy),
                [activeProjectionId, viewMode, groupByHierarchy]
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
                () => readTasksProjectionPrefs({ projectionPrefs: storedProjectionPrefsRef.current }, activeProjectionId),
                [activeProjectionId]
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
            const [dragSelection, setDragSelection] = React.useState(null);
            const [hoveredNodeId, setHoveredNodeId] = React.useState(null);
            const [groupHoverTooltip, setGroupHoverTooltip] = React.useState(null);
            const [helpOpen, setHelpOpen] = React.useState(false);
            const [activeFilters, setActiveFilters] = React.useState(() => egoMode ? {} : (
                projectionPrefs?.filters && typeof projectionPrefs.filters === 'object'
                    ? projectionPrefs.filters
                    : {}
            ));
            const [searchQuery, setSearchQuery] = React.useState(() => egoMode ? '' : (
                typeof projectionPrefs?.searchQuery === 'string' ? projectionPrefs.searchQuery : ''
            ));
            const [searchInputValue, setSearchInputValue] = React.useState(() => egoMode ? '' : (
                typeof projectionPrefs?.searchQuery === 'string' ? projectionPrefs.searchQuery : ''
            ));
            const [nodeNotes, setNodeNotes] = React.useState(() => normalizeTasksNodeNotes(sourcePrefsRef.current?.nodeNotes));
            const [activeColorBy, setActiveColorBy] = React.useState(() => (
                resolveTasksPreferredColorBy(model, activeProjectionId, projectionPrefs, nodeNotes)
            ));
            const [filtersCollapsed, setFiltersCollapsed] = React.useState(() => (
                typeof projectionPrefs?.filtersCollapsed === 'boolean'
                    ? projectionPrefs.filtersCollapsed
                    : !defaultFiltersOpen
            ));
            const [edgesVisible, setEdgesVisible] = React.useState(() => (
                typeof projectionPrefs?.edgesVisible === 'boolean' ? projectionPrefs.edgesVisible : true
            ));
            const defaultEdgeOpacity = React.useMemo(
                () => tasksDefaultEdgeOpacity((sourceModel?.dependency_edges || []).length),
                [sourceModel]
            );
            const [edgeOpacity, setEdgeOpacity] = React.useState(() => (
                sourcePrefsRef.current?.edgeOpacity === undefined ? defaultEdgeOpacity : clampTasksEdgeOpacity(sourcePrefsRef.current.edgeOpacity)
            ));
            const [projectionUnspecifiedContentOpacity, setProjectionUnspecifiedContentOpacity] = React.useState(() => (
                sourcePrefsRef.current?.unspecifiedContentOpacity === undefined
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
            const [filterPanelMaxHeight, setFilterPanelMaxHeight] = React.useState('100%');
            const [graphRevision, setGraphRevision] = React.useState(0);
            const [nodes, setNodes] = React.useState([]);
            const [edges, setEdges] = React.useState([]);
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
            const reactFlowApiRef = React.useRef(null);
            const prevExpandedCountRef = React.useRef(0);
            const hoverClearTimerRef = React.useRef(null);
            const groupToggleHoverIdRef = React.useRef('');
            const suppressNextGraphClickRef = React.useRef(false);
            const activeProjection = React.useMemo(() => {
                const projections = Array.isArray(sourceModel?.view_projections) ? sourceModel.view_projections : [];
                const id = String(activeProjectionId || '').trim();
                return id ? (projections.find((p) => p && p.id === id) || null) : null;
            }, [sourceModel, activeProjectionId]);
            const activeColorPalette = React.useMemo(() => tasksColorPaletteFor(model, activeColorBy), [model, activeColorBy]);
            const activeGradientStops = React.useMemo(() => normalizeTasksGradientStops(activeColorPalette), [activeColorPalette]);
            const activeGradientDomain = React.useMemo(() => tasksGradientDomain(activeColorPalette, activeGradientStops), [activeColorPalette, activeGradientStops]);
            React.useEffect(() => {
                baseLayoutRef.current = null;
                groupLayoutsRef.current = {};
                graphBaseRef.current = { nodes: [], edges: [] };
                const nextPrefs = readTasksProjectionPrefs({ projectionPrefs: storedProjectionPrefsRef.current }, activeProjectionId);
                setExpanded(egoMode ? tasksExpandableNodeIds(model) : hydrateExpandedSet(nextPrefs));
                setSelectedNodeId(null);
                setSelectedNodeIds(new Set());
                setDragSelection(null);
                setHoveredNodeId(null);
                groupToggleHoverIdRef.current = '';
                setTasksGroupToggleHover(flowWrapperRef.current, '');
                pendingFitActionRef.current = 'mode';
            }, [activeProjectionId, hydrateExpandedSet]);
            React.useEffect(() => {
                const nextPrefs = readTasksProjectionPrefs({ projectionPrefs: storedProjectionPrefsRef.current }, activeProjectionId);
                setActiveFilters(egoMode ? {} : (nextPrefs?.filters && typeof nextPrefs.filters === 'object' ? nextPrefs.filters : {}));
                setSearchQuery(egoMode ? '' : (typeof nextPrefs?.searchQuery === 'string' ? nextPrefs.searchQuery : ''));
                setSearchInputValue(egoMode ? '' : (typeof nextPrefs?.searchQuery === 'string' ? nextPrefs.searchQuery : ''));
                setActiveColorBy(resolveTasksPreferredColorBy(model, activeProjectionId, nextPrefs, nodeNotes));
                setFiltersCollapsed(typeof nextPrefs?.filtersCollapsed === 'boolean' ? nextPrefs.filtersCollapsed : !defaultFiltersOpen);
                setEdgesVisible(typeof nextPrefs?.edgesVisible === 'boolean' ? nextPrefs.edgesVisible : true);
                setEdgeOpacity(sourcePrefsRef.current?.edgeOpacity === undefined ? defaultEdgeOpacity : clampTasksEdgeOpacity(sourcePrefsRef.current.edgeOpacity));
                setProjectionUnspecifiedContentOpacity(sourcePrefsRef.current?.unspecifiedContentOpacity === undefined ? defaultProjectionUnspecifiedContentOpacity : clampTasksProjectionContentOpacity(sourcePrefsRef.current.unspecifiedContentOpacity));
            }, [activeProjectionId, model, nodeNotes, defaultFiltersOpen, defaultEdgeOpacity, defaultProjectionUnspecifiedContentOpacity]);
            React.useEffect(() => {
                const timeoutId = window.setTimeout(() => {
                    setSearchQuery(searchInputValue);
                }, 140);
                return () => window.clearTimeout(timeoutId);
            }, [searchInputValue]);
            const searchMatches = React.useMemo(
                () => tasksCollectSearchMatches(graphBaseRef.current.nodes || [], graphBaseRef.current.edges || [], searchQuery),
                [graphRevision, searchQuery]
            );
            const currentSelectionIds = React.useCallback(() => {
                if (selectedNodeId) return new Set([selectedNodeId]);
                if (selectedNodeIds.size) {
                    const baseById = Object.fromEntries((graphBaseRef.current.nodes || []).map((node) => [node.id, node]));
                    return new Set(Array.from(selectedNodeIds).filter((nodeId) => {
                        const node = baseById[nodeId];
                        if (!node || node.data?.__kind__ === 'groupTitle') return false;
                        return isTasksGraphNodeSelectable(node.data?.__kind__, expanded.has(node.id));
                    }));
                }
                const entries = Object.entries(activeFilters || {}).filter(([, value]) => Array.isArray(value) ? value.length > 0 : Boolean(value));
                const hasSearch = searchMatches.active && !searchMatches.error;
                if (!entries.length && !hasSearch) return new Set();
                return new Set((graphBaseRef.current.nodes || [])
                    .filter((node) => node?.id && node.data?.__kind__ !== 'groupTitle')
                    .filter((node) => {
                        const filterHit = entries.length ? tasksNodeMatchesFilters(node.data, activeFilters) : true;
                        const searchHit = hasSearch ? searchMatches.nodeIds.has(node.id) : true;
                        return filterHit && searchHit;
                    })
                    .map((node) => node.id));
            }, [selectedNodeId, selectedNodeIds, expanded, activeFilters, searchMatches]);
            React.useEffect(() => {
                const validFilterKeys = new Set(tasksFilterOptions(model).map((option) => option.key));
                const validColorKeys = new Set(tasksColorOptions(model, nodeNotes).map((option) => option.key));
                const defaultColorBy = tasksResolvedProjectionDefaultColorBy(model, nodeNotes);
                setActiveFilters((current) => Object.fromEntries(
                    Object.entries(current || {}).filter(([key, value]) => {
                        if (!validFilterKeys.has(key)) return false;
                        if (Array.isArray(value)) return value.length > 0;
                        return Boolean(value);
                    })
                ));
                setActiveColorBy((current) => {
                    if (current && validColorKeys.has(current)) return current;
                    return validColorKeys.has(defaultColorBy) ? defaultColorBy : '';
                });
            }, [model, nodeNotes]);
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
                        searchQuery,
                        colorBy: activeColorBy,
                        filtersCollapsed,
                        edgesVisible,
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
                });
                writeTasksCheckedNodeIds(sourceModel, checkedNodeIdsFromStates(nodeStates));
            }, [sourceModel, activeFilters, searchQuery, activeColorBy, activeProjectionId, filtersCollapsed, edgesVisible, edgeOpacity, projectionUnspecifiedContentOpacity, groupByHierarchy, expanded, nodeStates, nodeNotes]);
            const checkedNodeIdSet = React.useMemo(() => new Set(checkedNodeIdsFromStates(nodeStates)), [nodeStates]);
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
            React.useEffect(() => {
                setNoteInputValue(nodeNotes[String(selectedNodeId || '')] || '');
            }, [selectedNodeId]);
            React.useEffect(() => {
                if (!selectedNodeId) return undefined;
                const timeoutId = window.setTimeout(() => {
                    updateNodeNote(selectedNodeId, noteInputValue);
                }, 180);
                return () => window.clearTimeout(timeoutId);
            }, [selectedNodeId, noteInputValue, updateNodeNote]);
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
                        const isChecked = checkedNodeIdSet.has(String(node.id || ''));
                        const hasNote = Boolean((nodeNotes[String(node.id || '')] || '').trim());
                        const colorNode = { ...node, __has_note__: hasNote };
                        const nodeColor = resolveTasksNodeColor(colorNode, model, activeColorBy, activeColorPalette);
                        const cardState = tasksCardStateForNode(sourceModel, nodeStates, node.id, cardStates);
                        const stateAccent = cardState.color || TASKS_DONE_ACCENT;
                        return {
                            id: node.id,
                            type: 'vyasaTask',
                            position: node.position,
                            data: { ...node, __checked__: isChecked, __card_state__: cardState.label, __card_state_color__: cardState.color, __has_note__: hasNote },
                            style: {
                                width: node.width,
                                height: node.height,
                                zIndex: TASKS_TASK_Z,
                                background: nodeColor ? (colorMix.enabled ? `color-mix(in srgb, var(--vyasa-paper) ${colorMix.paper}%, ${nodeColor} ${colorMix.intensity}%)` : nodeColor) : TASKS_NODE_BG,
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
                const egoHighOpacityIds = new Set(egoSelectedIds);
                if (egoMode && model.ego_include_neighbors) {
                    const groupIds = new Set((model.groups || []).map((group) => group.id));
                    const addGroupWithDescendants = (groupId) => {
                        egoHighOpacityIds.add(groupId);
                        for (const descendantId of collectTasksGroupDescendantIds(groupId, model)) egoHighOpacityIds.add(descendantId);
                    };
                    for (const selectedId of egoSelectedIds) {
                        if (groupIds.has(selectedId)) addGroupWithDescendants(selectedId);
                    }
                }
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
                    const isChecked = checkedNodeIdSet.has(String(n.id || ''));
                    const hasNote = Boolean((nodeNotes[String(n.id || '')] || '').trim());
                    const colorNode = { ...n, __has_note__: hasNote };
                    const nodeColor = resolveTasksNodeColor(colorNode, model, activeColorBy, activeColorPalette);
                    const nodeImage = resolveTasksNodeImage(n, model);
                    const collapsedGroupColor = !isExpanded ? resolveTasksCollapsedGroupColor(colorNode, model, activeColorBy, activeColorPalette) : '';
                    const isProjectionGroup = n.__kind__ === 'group' && n.__projection_group__;
                    const projectionGroupTone = isProjectionGroup ? resolveTasksProjectionGroupDimensionColor(n, model) : '';
                    const groupColor = projectionGroupTone || collapsedGroupColor || nodeColor;
                    const isUnspecifiedProjectionGroup = isTasksUnspecifiedProjectionGroup(n, TASKS_PROJECTION_UNSPECIFIED_LABEL);
                    const groupFillExpanded = isProjectionGroup
                        ? (isUnspecifiedProjectionGroup ? projectionUnspecifiedGroupExpandedOpacity : projectionGroupExpandedOpacity)
                        : 7;
                    const groupFillCollapsed = isProjectionGroup
                        ? (isUnspecifiedProjectionGroup ? projectionUnspecifiedGroupOpacity : projectionGroupOpacity)
                        : 14;
                    const groupBorderMix = isProjectionGroup ? 28 : 70;
                    const cardState = tasksCardStateForNode(sourceModel, nodeStates, n.id, cardStates);
                    const stateAccent = cardState.color || TASKS_DONE_ACCENT;
                    const background = n.__kind__ === 'group'
                        ? (groupColor
                            ? (isExpanded
                                ? `color-mix(in srgb, ${groupColor} ${groupFillExpanded}%, transparent)`
                                : `color-mix(in srgb, var(--vyasa-paper) ${100 - groupFillCollapsed}%, ${groupColor} ${groupFillCollapsed}%)`)
                            : (isExpanded ? TASKS_GROUP_EXPANDED_BG : TASKS_GROUP_BG))
                        : (nodeColor ? (colorMix.enabled ? `color-mix(in srgb, var(--vyasa-paper) ${colorMix.paper}%, ${nodeColor} ${colorMix.intensity}%)` : nodeColor) : TASKS_NODE_BG);
                    const border = groupColor
                        ? (n.__kind__ === 'group'
                            ? `1px solid color-mix(in srgb, var(--vyasa-paper) ${100 - groupBorderMix}%, ${groupColor} ${groupBorderMix}%)`
                            : `1px solid color-mix(in srgb, var(--vyasa-paper) 30%, ${nodeColor} 70%)`)
                        : TASKS_NODE_BORDER;
                    const egoNodeOpacity = egoMode && model.ego_include_neighbors && n.__kind__ !== 'group' && !egoHighOpacityIds.has(n.id) ? egoNeighborOpacity : 1;
                    const branchOpacity = (isInUnspecifiedProjectionBranch(n) ? projectionUnspecifiedContentOpacity : 1) * egoNodeOpacity;
                    const rfNode = {
                        id: n.id,
                        type: 'vyasaTask',
                        position: n.position,
                        data: { ...n, __checked__: isChecked, __card_state__: cardState.label, __card_state_color__: cardState.color, __has_note__: hasNote, __node_image__: nodeImage, __projection_branch_opacity__: branchOpacity },
                        style: {
                            width: n.width,
                            height: n.height,
                            zIndex: nodeZ,
                            background,
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
                        * (egoMode && model.ego_include_neighbors && !egoHighOpacityIds.has(n.id) ? egoNeighborOpacity : 1);
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
            }, [ensureBaseLayout, model, sourceModel, activeColorBy, activeColorPalette, activeProjection, viewMode, edgesVisible, edgeOpacity, projectionUnspecifiedContentOpacity, egoNeighborOpacity, checkedNodeIdSet, nodeStates, nodeNotes, cardStates]);
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
                            animated: hit,
                        };
                    }) : []);
                    return;
                }
                if (!hasNodeSelection) {
                    const hasFilters = Object.values(activeFilters).some((value) => Array.isArray(value) ? value.length > 0 : Boolean(value));
                    const hasSearch = searchMatches.active && !searchMatches.error;
                    if (!hasFilters && !hasSearch) {
                        setNodes(baseNodes);
                        setEdges(edgesVisible ? baseEdges : []);
                        return;
                    }
                    const filterMatches = new Set(baseNodes.filter((node) => tasksNodeMatchesFilters(node.data, activeFilters)).map((node) => node.id));
                    const searchNodeIds = hasSearch ? searchMatches.nodeIds : null;
                    const matchingIds = new Set(baseNodes.filter((node) => {
                        const filterHit = hasFilters ? filterMatches.has(node.id) : true;
                        const searchHit = hasSearch ? searchNodeIds.has(node.id) : true;
                        return filterHit && searchHit;
                    }).map((node) => node.id));
                    setNodes(baseNodes.map((node) => ({
                        ...node,
                        data: { ...node.data, highlightMode: matchingIds.has(node.id) ? 'selected' : 'dim' },
                        style: {
                            ...node.style,
                            opacity: (node.data?.__projection_branch_opacity__ ?? 1) * (matchingIds.has(node.id) ? 1 : 0.18),
                        },
                    })));
                    setEdges(edgesVisible ? baseEdges.map((edge) => {
                        const hit = (matchingIds.has(edge.source) && matchingIds.has(edge.target)) || searchMatches.edgeIds.has(edge.id);
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
                            animated: hit,
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
                                    ? (displayColor
                                        ? `color-mix(in srgb, ${displayColor} 10%, transparent)`
                                        : TASKS_GROUP_BG_ACTIVE)
                                    : (nodeColor ? (colorMix.enabled ? `color-mix(in srgb, var(--vyasa-paper) ${colorMix.paper}%, ${nodeColor} ${colorMix.intensity}%)` : nodeColor) : TASKS_NODE_BG_ACTIVE)),
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
                    return {
                        ...edge,
                        data: { ...edge.data, highlightMode: mode },
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
                            strokeWidth: (mode === 'focused-in' || mode === 'focused-out') ? 5 : (mode === 'selected' ? 3.5 : 2.5),
                            strokeDasharray: dashArray,
                            '--vyasa-edge-dash-cycle': dashCycle,
                            '--vyasa-edge-flow-duration': (mode === 'focused-in' || mode === 'focused-out') ? '0.72s' : '0.64s',
                            strokeLinecap: highlighted ? 'round' : undefined,
                        },
                        animated: highlighted,
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
            }, [activeFilters, searchMatches, model, activeColorBy, activeColorPalette, expanded, edgesVisible, edgeOpacity]);
            React.useLayoutEffect(() => {
                const baseNodeIds = new Set((graphBaseRef.current.nodes || []).map((node) => node.id));
                if (selectedNodeId && !baseNodeIds.has(selectedNodeId)) {
                    setSelectedNodeId(null);
                    return;
                }
                if (selectedNodeIds.size) {
                    const validSelectedIds = Array.from(selectedNodeIds).filter((nodeId) => baseNodeIds.has(nodeId));
                    if (validSelectedIds.length !== selectedNodeIds.size) {
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
                const entries = Object.entries(activeFilters || {}).filter(([, value]) => Array.isArray(value) ? value.length > 0 : Boolean(value));
                const hasSearch = searchMatches.active && !searchMatches.error;
                if (!entries.length && !hasSearch) return;
                const reactFlow = reactFlowApiRef.current;
                const matchedNodes = (graphBaseRef.current.nodes || []).filter((node) => {
                    if (!node?.id || node.data?.__kind__ === 'groupTitle') return false;
                    const filterHit = entries.length ? tasksNodeMatchesFilters(node.data, activeFilters) : true;
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
            }, [graphRevision, activeFilters, searchMatches]);
            React.useEffect(() => {
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
            const CustomEdge = React.memo((props) => {
                const viewport = typeof rf.useViewport === 'function' ? rf.useViewport() : { zoom: 1 };
                const [path, labelX, labelY] = rf.getBezierPath(props);
                const fullLabel = String(props.label || '').replace(/\\n/g, '\n');
                const labelLines = fullLabel.split(/\r?\n/);
                const highlightMode = props.data?.highlightMode || 'none';
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
                    React.createElement(rf.BaseEdge, { ...props, path }),
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
                const isChecked = data?.__checked__ === true;
                const taskStateLabel = String(data?.__card_state__ || (isChecked ? TASKS_DEFAULT_CARD_STATES[1] : TASKS_DEFAULT_CARD_STATES[0]));
                const taskStateColor = data?.__card_state_color__ || TASKS_DONE_ACCENT;
                const showCheckbox = selectedNodeId === sourceNodeId;
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
                    onChange: () => toggleCheckedNode(sourceNodeId),
                    style: { margin: 0, width: '10px', height: '10px', accentColor: taskStateColor, cursor: 'pointer' },
                }) : React.createElement('button', {
                    type: 'button',
                    title: `State: ${taskStateLabel}`,
                    onClick: () => toggleCheckedNode(sourceNodeId),
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
                    checkboxControl,
                    doneBadge,
                    noteBadge,
                    linkKinds.length ? renderTasksNodeLinkBadge(React, { right: canExpand ? '32px' : '10px', kinds: linkKinds }) : null,
                    ...renderHandles('target'),
                    renderNodeImage(isGroup ? 30 : 28),
                    React.createElement('span', {
                        style: {
                            boxSizing: 'border-box',
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
                        const wrapper = flowWrapperRef.current;
                        const target = event.target instanceof Element ? event.target : null;
                        if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(target.tagName))) return;
                        const key = event.key.toLowerCase();
                        const graphFocused = wrapper && (wrapper.contains(document.activeElement) || wrapper.contains(event.target));
                        if (!graphFocused && !(key === 't' && groupToggleHoverIdRef.current)) return;
                        if (key === 'f') {
                            event.preventDefault();
                            reactFlow.fitView({ duration: 200, padding: 0.2, includeHiddenNodes: true });
                            return;
                        }
                        if (event.key === '?' || (event.key === '/' && event.shiftKey)) {
                            event.preventDefault();
                            setHelpOpen((current) => !current);
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
                        if (event.key === 'Escape' && helpOpen) {
                            event.preventDefault();
                            setHelpOpen(false);
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
                const sourceNodeId = selectedNode?.__kind__ === 'groupTitle' ? selectedNode.sourceGroupId : selectedNode?.id;
                const baseEntries = selectedNode?.__kind__ === 'group'
                    ? tasksGroupDetailEntries(sourceNodeId, model)
                    : tasksNodeMetaEntries(selectedNode);
                if (!selectedNode) return null;
                const openDecisionEntry = tasksOpenDecisionEntry(selectedNode);
                const entries = openDecisionEntry ? [openDecisionEntry, ...baseEntries] : baseEntries;
                const panelWidth = tasksSelectedPanelWidth(selectedNode, entries);
                const panelLinkKinds = Array.from(tasksNodeLinkKinds(selectedNode));
                const panelHref = String(selectedNode?.href || '').trim();
                return React.createElement('div', {
                    style: { width: `min(${panelWidth}px, 100%)`, maxWidth: '100%', minWidth: 'min(220px, 100%)', marginLeft: 'auto', boxSizing: 'border-box', borderRadius: '12px', border: '1px solid color-mix(in srgb, var(--vyasa-primary) 28%, transparent)', background: 'color-mix(in srgb, var(--vyasa-paper) 92%, transparent)', boxShadow: '0 10px 30px rgba(0,0,0,0.12)', backdropFilter: 'blur(8px)', padding: '12px', pointerEvents: 'auto', minHeight: 0, flex: '0 1 auto', overflowY: 'auto', overscrollBehavior: 'contain' },
                },
                    React.createElement('div', { style: { position: 'relative', paddingRight: panelLinkKinds.length ? '28px' : '0', marginBottom: '10px' } },
                        panelLinkKinds.length ? renderTasksNodeLinkBadge(React, { kinds: panelLinkKinds, right: '0', top: '0' }) : null,
                        React.createElement('div', { style: { fontSize: '14px', fontWeight: 700, lineHeight: 1.3 } }, selectedNode.label || selectedNode.id),
                        panelHref ? React.createElement('a', {
                            href: panelHref,
                            onClick: (event) => openTasksNodeHref(panelHref, event),
                            style: { display: 'inline-block', marginTop: '6px', fontSize: '12px', lineHeight: 1.3, textDecoration: 'underline', textUnderlineOffset: '2px', color: 'inherit', overflowWrap: 'anywhere', wordBreak: 'break-word' },
                        }, panelHref) : null,
                    ),
                    React.createElement('div', { style: { display: 'flex', flexDirection: 'column', fontSize: '12px', lineHeight: 1.35 } },
                        ...entries.map((entry, index) => {
                            return React.createElement('div', {
                                key: entry.key,
                                style: {
                                    paddingTop: index === 0 ? '0' : '8px',
                                    marginTop: index === 0 ? '0' : '8px',
                                    borderTop: index === 0 ? 'none' : '1px dashed color-mix(in srgb, currentColor 18%, transparent)',
                                    overflowWrap: 'anywhere',
                                    wordBreak: 'break-word',
                                    whiteSpace: 'pre-line',
                                },
                            },
                                React.createElement('span', { style: { fontWeight: 700, opacity: 0.72 } }, `${entry.label}: `),
                                entry.renderedValue
                                    ? React.createElement('span', {
                                        className: 'vyasa-task-node-card-value',
                                        dangerouslySetInnerHTML: { __html: entry.renderedValue },
                                    })
                                    : React.createElement('span', {
                                        className: 'vyasa-task-node-card-value',
                                    }, entry.value),
                            );
                        }),
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
                            React.createElement('span', { style: { fontWeight: 700, opacity: 0.7 } }, 'Notes'),
                            React.createElement('textarea', {
                                'data-vyasa-task-control': 'true',
                                value: noteInputValue,
                                placeholder: 'Notes',
                                rows: 4,
                                onChange: (event) => setNoteInputValue(event.target.value),
                                style: {
                                    width: '100%',
                                    minHeight: '76px',
                                    resize: 'vertical',
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
                const activePaletteEntries = activeColorBy === 'rank' ? [] : tasksColorPaletteEntries(model, activeColorBy, nodeNotes);
                const activeGradientPalette = isTasksGradientPalette(activeColorPalette);
                const customGroupingActive = !String(activeProjectionId || '').trim() && viewMode !== 'gantt';
                const projectionGroupByHierarchy = viewMode === 'gantt' ? [] : tasksProjectionGroupByHierarchy(sourceModel, activeProjectionId);
                const displayedGroupByHierarchy = customGroupingActive ? groupByHierarchy : projectionGroupByHierarchy;
                const activeGroupByCount = customGroupingActive ? groupByHierarchy.filter(Boolean).length : 0;
                const groupByLevels = displayedGroupByHierarchy.filter(Boolean);
                if (customGroupingActive) groupByLevels.push('');
                if (!groupByLevels.length && viewMode !== 'gantt') groupByLevels.push('');
                const activeCount = Object.values(activeFilters || {}).reduce((sum, value) => sum + (Array.isArray(value) ? value.length : (value ? 1 : 0)), 0) + (activeColorBy ? 1 : 0) + (searchMatches.active ? 1 : 0) + activeGroupByCount;
                const isOpen = !filtersCollapsed;
                return React.createElement('aside', {
                    ref: filterPanelRef,
                    className: 'vyasa-tasks-filter-card',
                    'aria-hidden': !isOpen,
                    style: {
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        left: 0,
                        zIndex: 30,
                        width: `min(${TASKS_FILTER_PANEL_WIDTH}px, calc(100% - 24px))`,
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
                        transition: 'transform 180ms ease',
                        pointerEvents: isOpen ? 'auto' : 'none',
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
                        React.createElement('button', { type: 'button', onClick: () => setFiltersCollapsed(true), style: { border: 'none', background: 'none', cursor: 'pointer', padding: '2px 4px', fontSize: '14px', lineHeight: 1, color: 'inherit', opacity: 0.7 } }, '×')
                    ),
                    React.createElement('div', {
                        style: {
                            marginTop: '12px',
                            paddingRight: '2px',
                            paddingBottom: '2px',
                        },
                    },
                        React.createElement('div', { style: { marginBottom: '12px', display: 'flex', alignItems: 'flex-start', gap: '10px' } },
                            React.createElement('div', { style: { display: 'grid', gap: '8px', flex: 1, minWidth: 0 } },
                                React.createElement('label', { style: { display: 'grid', gridTemplateColumns: 'max-content minmax(84px, 1fr) max-content', alignItems: 'center', gap: '8px', minWidth: 0, fontSize: '12px' } },
                                    React.createElement('span', { style: { fontWeight: 700, opacity: 0.7 } }, 'Edge Intensity'),
                                    React.createElement('input', {
                                        type: 'range',
                                        min: TASKS_EDGE_OPACITY_MIN,
                                        max: TASKS_EDGE_OPACITY_MAX,
                                        step: 'any',
                                        value: edgeOpacity,
                                        onChange: (e) => setEdgeOpacity(clampTasksEdgeOpacity(e.target.value)),
                                        style: { width: '100%', minWidth: 0, margin: 0 },
                                    }),
                                    React.createElement('span', { style: { opacity: 0.8, minWidth: '3.5em', textAlign: 'right' } }, tasksEdgeOpacityLabel(edgeOpacity))
                                ),
                                React.createElement('label', { style: { display: 'grid', gridTemplateColumns: 'max-content minmax(84px, 1fr) max-content', alignItems: 'center', gap: '8px', minWidth: 0, fontSize: '12px' } },
                                    React.createElement('span', { style: { fontWeight: 700, opacity: 0.7 } }, 'Ø Intensity'),
                                    React.createElement('input', {
                                        type: 'range',
                                        min: 0.02,
                                        max: 1,
                                        step: 0.01,
                                        value: projectionUnspecifiedContentOpacity,
                                        onChange: (e) => setProjectionUnspecifiedContentOpacity(clampTasksProjectionContentOpacity(e.target.value)),
                                        style: { width: '100%', minWidth: 0, margin: 0 },
                                    }),
                                    React.createElement('span', { style: { opacity: 0.8, minWidth: '3.5em', textAlign: 'right' } }, tasksOpacityPctLabel(projectionUnspecifiedContentOpacity))
                                )
                            ),
                            React.createElement('button', { type: 'button', onClick: () => { setActiveFilters({}); setSearchInputValue(''); setSearchQuery(''); setActiveColorBy(tasksResolvedProjectionDefaultColorBy(model, nodeNotes)); setGroupByHierarchy([]); setEdgeOpacity(defaultEdgeOpacity); setProjectionUnspecifiedContentOpacity(defaultProjectionUnspecifiedContentOpacity); }, style: { border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: '12px', textDecoration: 'underline', whiteSpace: 'nowrap' } }, 'Reset')
                        ),
                        React.createElement('div', { style: { marginBottom: '12px', paddingBottom: '10px', borderBottom: '1px solid color-mix(in srgb, currentColor 12%, transparent)' } },
                            React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '84px 1fr', gap: '8px', alignItems: 'start', fontSize: '12px' } },
                                React.createElement('span', { style: { fontWeight: 700, opacity: 0.7 } }, 'Group by'),
                                React.createElement('div', { style: { display: 'grid', gap: '6px', minWidth: 0 } },
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
                            )
                        ),
                        React.createElement('div', { style: { marginBottom: '12px', paddingBottom: '10px', borderBottom: '1px solid color-mix(in srgb, currentColor 12%, transparent)' } },
                            React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '84px 1fr', gap: '8px', alignItems: 'start', fontSize: '12px' } },
                                React.createElement('span', { style: { fontWeight: 700, opacity: 0.7 } }, 'Search'),
                                React.createElement('div', { style: { display: 'grid', gap: '6px', minWidth: 0 } },
                                    React.createElement('input', {
                                        type: 'text',
                                        value: searchInputValue,
                                        placeholder: 'text or /regex/i',
                                        onChange: (e) => setSearchInputValue(e.target.value),
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
                                    searchMatches.error
                                        ? React.createElement('div', { style: { fontSize: '11px', color: '#fca5a5', lineHeight: 1.3 } }, `Regex error: ${searchMatches.error}`)
                                        : React.createElement('div', { style: { fontSize: '11px', opacity: 0.72, lineHeight: 1.3 } }, searchMatches.active ? `${searchMatches.nodeIds.size} nodes matched` : 'Matches label, text attrs, and matching edge text.')
                                )
                            )
                        ),
                        React.createElement('div', { style: { marginBottom: '12px', paddingBottom: '10px', borderBottom: '1px solid color-mix(in srgb, currentColor 12%, transparent)' } },
                            React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '84px 1fr', gap: '8px', alignItems: 'start', fontSize: '12px' } },
                                React.createElement('span', { style: { fontWeight: 700, opacity: 0.7 } }, 'Color by'),
                                React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '8px 12px' } },
                                    [
                                        { key: '', label: 'None' },
                                        ...colorOptions.map((option) => ({ key: option.key, label: option.label })),
                                    ].map((option) => React.createElement('label', { key: option.key || '__none__', style: { display: 'inline-flex', alignItems: 'center', gap: '8px', minWidth: 0 } },
                                        React.createElement('input', {
                                            type: 'radio',
                                            name: `${widgetId}-color-by`,
                                            checked: activeColorBy === option.key,
                                            onChange: () => setActiveColorBy(option.key),
                                        }),
                                        React.createElement('span', { style: { opacity: 0.85 } }, option.label)
                                    )),
                                    activeGradientPalette
                                        ? React.createElement('div', { style: { flexBasis: '100%', marginTop: '4px', padding: '8px', borderRadius: '8px', background: 'color-mix(in srgb, currentColor 4%, transparent)' } },
                                            React.createElement('div', { style: { display: 'grid', gap: '6px', fontSize: '11px', lineHeight: 1.3, opacity: 0.85 } },
                                                React.createElement('div', {
                                                    style: {
                                                        height: '12px',
                                                        borderRadius: '999px',
                                                        border: '1px solid color-mix(in srgb, currentColor 12%, transparent)',
                                                        background: `linear-gradient(90deg, ${activeGradientStops.map((stop) => {
                                                            const start = activeGradientDomain?.start ?? activeGradientStops[0]?.at ?? 0;
                                                            const end = activeGradientDomain?.end ?? activeGradientStops[activeGradientStops.length - 1]?.at ?? 1;
                                                            const span = Math.max(end - start, 1);
                                                            const pct = ((stop.at - start) / span) * 100;
                                                            return `${stop.color} ${pct}%`;
                                                        }).join(', ')})`,
                                                    },
                                                }),
                                                React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' } },
                                                    ...activeGradientStops.map((stop, index) => React.createElement('span', { key: `${activeColorBy}-stop-${index}` }, stop.label || (Number.isInteger(stop.at) ? `${stop.at}` : `${stop.at}`)))
                                                )
                                            )
                                        )
                                        : activePaletteEntries.length > 0
                                        ? React.createElement('div', { style: { flexBasis: '100%', marginTop: '4px', padding: '8px', borderRadius: '8px', background: 'color-mix(in srgb, currentColor 4%, transparent)' } },
                                            React.createElement('div', { style: { display: 'grid', gap: '4px', fontSize: '11px', lineHeight: 1.3, opacity: 0.8 } },
                                                ...activePaletteEntries.map(([value, color]) => {
                                                    const selected = Array.isArray(activeFilters[activeColorBy]) && activeFilters[activeColorBy].includes(value);
                                                    return React.createElement('button', {
                                                        key: `${activeColorBy}-${value}-label`,
                                                        type: 'button',
                                                        'aria-pressed': selected,
                                                        onClick: () => toggleFilterValue(activeColorBy, value, !selected),
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
                                        )
                                        : null
                                )
                            )
                        ),
                        ...options.map((option) => React.createElement('label', { key: option.key, style: { display: 'grid', gridTemplateColumns: '84px 1fr', gap: '8px', alignItems: 'center', marginBottom: '8px', fontSize: '12px' } },
                            React.createElement('span', { style: { fontWeight: 700, opacity: 0.7 } }, option.label),
                            option.isBoolean
                                ? React.createElement('label', { style: { display: 'inline-flex', alignItems: 'center', gap: '8px', minWidth: 0 } },
                                    React.createElement('input', {
                                        type: 'checkbox',
                                        checked: activeFilters[option.key] === 'true',
                                        onChange: (e) => setActiveFilters((current) => ({ ...current, [option.key]: e.target.checked ? 'true' : '' })),
                                    }),
                                    React.createElement('span', { style: { opacity: 0.8 } }, 'Only true')
                                )
                                : React.createElement('div', { style: { display: 'grid', gap: '4px', maxHeight: '120px', overflowY: 'auto', padding: '6px 8px', border: '1px solid color-mix(in srgb, currentColor 12%, transparent)', borderRadius: '8px', background: 'color-mix(in srgb, var(--vyasa-paper) 96%, transparent)' } },
                                    ...option.values.map((value) => {
                                        const selected = Array.isArray(activeFilters[option.key]) && activeFilters[option.key].includes(value);
                                        return React.createElement('label', { key: value, style: { display: 'inline-flex', alignItems: 'center', gap: '8px', minWidth: 0 } },
                                            React.createElement('input', {
                                                type: 'checkbox',
                                                checked: selected,
                                                onChange: (e) => setActiveFilters((current) => {
                                                    return toggleMultiValueFilter(current, option.key, value, e.target.checked);
                                                }),
                                            }),
                                            React.createElement('span', { style: { opacity: 0.8 } }, value)
                                        );
                                    })
                                )
                        ))
                    )
                );
            };
            const clearSelection = () => {
                setSelectedNodeId(null);
                setSelectedNodeIds(new Set());
                setDragSelection(null);
                setHoveredNodeId(null);
            };
            const toggleFilterValue = React.useCallback((key, value, enabled) => {
                setActiveFilters((current) => toggleMultiValueFilter(current, key, value, enabled));
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
                const rows = tasksHoverAttrRows(nodeData, activeHoverAttrs);
                const label = nodeData.label || hit.node.id;
                const image = normalizeTasksNodeImageUrl(nodeData.__node_image__);
                if (!label && !rows.length) {
                    clearGroupHoverTooltip();
                    return;
                }
                const bounds = wrapper.getBoundingClientRect();
                setGroupHoverTooltip({
                    label,
                    image,
                    rows,
                    x: event.clientX - bounds.left + 12,
                    y: event.clientY - bounds.top + 18,
                });
            }, [expanded, clearGroupHoverTooltip, activeHoverAttrs]);
            const selectGraphNode = React.useCallback((_, node) => {
                if (suppressNextGraphClickRef.current) {
                    suppressNextGraphClickRef.current = false;
                    return;
                }
                if (!isTasksGraphNodeSelectable(node.data?.__kind__, expanded.has(node.id))) {
                    clearSelection();
                    return;
                }
                const sourceNodeId = node.data?.__kind__ === 'groupTitle' ? node.data?.sourceGroupId : node.id;
                setSelectedNodeId((current) => current === sourceNodeId ? null : sourceNodeId);
                setSelectedNodeIds(new Set());
                setHoveredNodeId(null);
            }, [expanded]);
            const focusNeighborEdge = React.useCallback((_, node) => {
                if (!selectedNodeId || !node?.id) return;
                if (!isTasksGraphNodeSelectable(node.data?.__kind__, expanded.has(node.id))) return;
                const baseEdges = graphBaseRef.current.edges || [];
                const sourceNodeId = node.data?.__kind__ === 'groupTitle' ? node.data?.sourceGroupId : node.id;
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
                            setSelectedNodeId((current) => current === nodeId ? null : nodeId);
                            setSelectedNodeIds(new Set());
                            logTasksDebug('manualSelect', { nodeId });
                        },
                        openEgo: (includeNeighbors = false) => {
                            const egoSelection = currentSelectionIds();
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
            const projectionGridCols = Math.max(1, Math.ceil(Math.sqrt(projectionOptions.length)));
            const ProjectionToggle = () => projectionOptions.length <= 1 ? null : window.React.createElement('div', {
                style: {
                    display: 'grid',
                    gridTemplateColumns: `repeat(${projectionGridCols}, minmax(0, 1fr))`,
                    width: '100%',
                    boxSizing: 'border-box',
                    gap: '2px',
                    padding: '3px',
                    borderRadius: '10px',
                    border: '1px solid color-mix(in srgb, var(--vyasa-primary) 28%, transparent)',
                    background: 'color-mix(in srgb, var(--vyasa-paper) 92%, transparent)',
                    boxShadow: '0 10px 24px rgba(0,0,0,0.10)',
                    pointerEvents: 'auto',
                },
            }, projectionOptions.map((projection) => window.React.createElement('button', {
                key: projection.id || '__default__',
                type: 'button',
                onClick: () => {
                    setSelectedNodeId(null);
                    setSelectedNodeIds(new Set());
                    setDragSelection(null);
                    setHoveredNodeId(null);
                    if (projection.id === TASKS_GANTT_PROJECTION_ID) setViewMode('gantt');
                    else {
                        setActiveProjectionId(projection.id);
                        setViewMode('graph');
                    }
                    pendingFitActionRef.current = 'mode';
                },
                style: {
                    border: 0,
                    borderRadius: '7px',
                    minWidth: '0',
                    padding: '6px 9px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: 'inherit',
                    background: ((projection.id === TASKS_GANTT_PROJECTION_ID && viewMode === 'gantt')
                        || (projection.id !== TASKS_GANTT_PROJECTION_ID && viewMode !== 'gantt' && activeProjectionId === projection.id))
                        ? 'color-mix(in srgb, var(--vyasa-primary) 18%, transparent)'
                        : 'transparent',
                },
            }, projection.label)));
            const ProjectionCaption = () => {
                const active = projectionOptions.find((p) => (
                    viewMode === 'gantt'
                        ? p.id === TASKS_GANTT_PROJECTION_ID
                        : p.id === activeProjectionId
                ));
                const caption = active && typeof active.caption === 'string' ? active.caption.trim() : '';
                if (!caption) return null;
                return window.React.createElement('div', {
                    style: {
                        padding: '6px 10px',
                        borderRadius: '8px',
                        border: '1px solid color-mix(in srgb, var(--vyasa-primary) 18%, transparent)',
                        background: 'color-mix(in srgb, var(--vyasa-paper) 94%, transparent)',
                        fontSize: '11px',
                        fontStyle: 'italic',
                        fontWeight: 500,
                        lineHeight: 1.35,
                        color: 'color-mix(in srgb, currentColor 75%, transparent)',
                        pointerEvents: 'auto',
                    },
                }, caption);
            };
            const RightRail = () => {
                const hasProjectionMenu = projectionOptions.length > 1;
                if (!hasProjectionMenu && !selectedNodeId) return null;
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
                    ProjectionToggle(),
                    ProjectionCaption(),
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
                const panelWidth = tasksHoverTooltipWidth(groupHoverTooltip.label || '', rows, hoverFontSize, Boolean(image));
                const wrapperWidth = Math.max(240, Math.floor(flowWrapperRef.current?.getBoundingClientRect?.().width || 0));
                const wrapperHeight = Math.max(160, Math.floor(flowWrapperRef.current?.getBoundingClientRect?.().height || 0));
                const maxWidth = Math.max(220, Math.min(panelWidth, wrapperWidth - 24));
                const clampedLeft = Math.max(12, Math.min(groupHoverTooltip.x, wrapperWidth - maxWidth - 12));
                const clampedTop = Math.max(12, Math.min(groupHoverTooltip.y, wrapperHeight - 24));
                const children = [
                    window.React.createElement('div', {
                        key: '__label__',
                        style: { display: 'flex', alignItems: 'center', gap: '7px', fontWeight: 700, fontSize: `calc(${hoverFontSize} * 1.12)`, lineHeight: 1.25, marginBottom: rows.length ? '4px' : 0, whiteSpace: 'normal', overflowWrap: 'anywhere', wordBreak: 'break-word', minWidth: 0 },
                    },
                        image ? window.React.createElement('img', {
                            src: image,
                            alt: '',
                            loading: 'lazy',
                            draggable: false,
                            className: tasksIsIconifyImage(image) ? 'vyasa-tasks-node-image vyasa-tasks-node-image--icon' : 'vyasa-tasks-node-image',
                            style: { width: '22px', height: '22px', objectFit: 'contain', flex: '0 0 auto' },
                        }) : null,
                        window.React.createElement('span', { style: { minWidth: 0 } }, groupHoverTooltip.label)
                    ),
                ];
                if (rows.length) {
                    children.push(window.React.createElement('div', {
                        key: '__rows__',
                        style: { display: 'grid', gridTemplateColumns: 'minmax(0, auto) minmax(0, 1fr)', columnGap: '10px', rowGap: '2px', fontSize: hoverFontSize, fontWeight: 500, lineHeight: 1.35, alignItems: 'start' },
                    }, rows.flatMap((row) => [
                        window.React.createElement('span', {
                            key: `k-${row.attr}`,
                            style: { color: 'color-mix(in srgb, currentColor 60%, transparent)', whiteSpace: 'nowrap', minWidth: 0 },
                        }, row.label),
                        window.React.createElement('span', {
                            key: `v-${row.attr}`,
                            style: { fontWeight: 650, whiteSpace: 'normal', overflowWrap: 'anywhere', wordBreak: 'break-word', minWidth: 0 },
                        }, row.value),
                    ])));
                }
                return window.React.createElement('div', {
                    style: {
                        position: 'absolute',
                        left: clampedLeft,
                        top: clampedTop,
                        zIndex: 2400,
                        pointerEvents: 'none',
                        padding: rows.length ? '6px 9px' : '4px 7px',
                        borderRadius: '6px',
                        background: 'color-mix(in srgb, var(--vyasa-paper) 94%, var(--vyasa-primary) 6%)',
                        border: '1px solid color-mix(in srgb, var(--vyasa-primary) 24%, transparent)',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.14)',
                        width: rows.length ? 'min(280px, max-content)' : 'max-content',
                        maxWidth: '280px',
                        maxInlineSize: `${maxWidth}px`,
                        minWidth: rows.length ? '220px' : 'auto',
                        boxSizing: 'border-box',
                    },
                }, ...children);
            };
            const HelpPopup = () => !helpOpen ? null : window.React.createElement('div', {
                style: { position: 'absolute', left: '12px', top: egoMode && model.ego_include_neighbors ? '58px' : '12px', zIndex: 35, width: 'min(320px, calc(100% - 24px))', padding: '10px 12px', borderRadius: '10px', border: '1px solid color-mix(in srgb, var(--vyasa-primary) 22%, transparent)', background: 'color-mix(in srgb, var(--vyasa-paper) 94%, transparent)', boxShadow: '0 10px 24px rgba(0,0,0,0.12)', backdropFilter: 'blur(8px)', pointerEvents: 'auto', fontSize: '12px', lineHeight: 1.45 }
            }, window.React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '6px' } },
                window.React.createElement('strong', null, 'Graph help'),
                window.React.createElement('button', { type: 'button', onClick: () => setHelpOpen(false), style: { border: 'none', background: 'none', cursor: 'pointer', fontSize: '14px', lineHeight: 1, opacity: 0.7 } }, '×')
            ), window.React.createElement('div', { style: { whiteSpace: 'pre-line' } }, 'Mouse\nClick node: select card or group\nClick canvas: clear selection\nShift + drag: box select\nCmd + drag: lasso select\nWheel / pinch: zoom\nDrag canvas: pan\n\nKeys\n?: toggle this help\nF: fit view\nE: toggle edges\nT: toggle hovered group\nI / O: expand or collapse one group depth\nU / P: unfold or collapse all groups\nArrow keys: pan\nShift + arrows: pan faster'));
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
                if (selectedNodeId && selectedNodeIds.size) {
                    setSelectedNodeId(null);
                    setHoveredNodeId(null);
                    return;
                }
                clearSelection();
            };
            const flowPointerHandlers = {
                onPointerDown: () => flowWrapperRef.current?.focus({ preventScroll: true }),
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
                window.React.createElement('div', { ref: flowWrapperRef, className: flowWrapperClassName, tabIndex: 0, style: { width: '100%', height: '100%', outline: 'none', position: 'relative' }, ...flowPointerHandlers },
                    window.React.createElement(rf.ReactFlow, { nodes, edges, nodeTypes, edgeTypes, defaultEdgeOptions, fitView: true, minZoom: 0.05, nodesDraggable: false, elementsSelectable: false, zIndexMode: 'manual', onNodeClick: selectGraphNode, onNodeMouseEnter: focusNeighborEdge, onNodeMouseLeave: clearNeighborEdgeFocus, onPaneClick: paneClick, onPaneContextMenu: clearSelection },
                    window.React.createElement(rf.Background, backgroundProps),
                    window.React.createElement(rf.Controls),
                    window.React.createElement(PanControls),
                    window.React.createElement(FitViewHotkey),
                    window.React.createElement(ActionBridge),
                    window.React.createElement(FitOnNodesReady)
                    ),
                    RightRail(),
                    window.React.createElement(EgoNeighborControl),
                    window.React.createElement(HelpPopup),
                    filterPanelElement,
                    window.React.createElement(GroupHoverTooltip),
                    window.React.createElement(DragSelectionOverlay)
                )
            ) : window.React.createElement('div', { ref: flowWrapperRef, className: flowWrapperClassName, tabIndex: 0, style: { width: '100%', height: '100%', outline: 'none', position: 'relative' }, ...flowPointerHandlers },
                window.React.createElement(rf.ReactFlow, { nodes, edges, nodeTypes, edgeTypes, defaultEdgeOptions, fitView: true, minZoom: 0.05, nodesDraggable: false, elementsSelectable: false, zIndexMode: 'manual', onNodeClick: selectGraphNode, onNodeMouseEnter: focusNeighborEdge, onNodeMouseLeave: clearNeighborEdgeFocus, onPaneClick: paneClick, onPaneContextMenu: clearSelection },
                window.React.createElement(rf.Background, backgroundProps),
                    window.React.createElement(rf.Controls),
                    window.React.createElement(PanControls),
                    window.React.createElement(FitViewHotkey),
                    window.React.createElement(ActionBridge),
                    window.React.createElement(FitOnNodesReady)
                ),
                RightRail(),
                window.React.createElement(EgoNeighborControl),
                window.React.createElement(HelpPopup),
                filterPanelElement,
                window.React.createElement(GroupHoverTooltip),
                window.React.createElement(DragSelectionOverlay)
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
    if (existing) existing.remove();
    const id = wrapper.id || 'tasks';
    const modalWrapperId = options.wrapperId || `${id}-fullscreen`;
    const modal = document.createElement('div');
    modal.id = 'tasks-fullscreen-modal';
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
    fullscreenWrapper.className = `${wrapper.className} w-full h-full`;
    fullscreenWrapper.style.cssText = wrapper.getAttribute('style') || '';
    fullscreenWrapper.style.width = '100%';
    fullscreenWrapper.style.height = '100%';
    fullscreenWrapper.style.minHeight = '0';
    fullscreenWrapper.style.left = '';
    fullscreenWrapper.style.transform = '';
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
    const topRightControls = document.createElement('div');
    topRightControls.className = 'absolute top-2 right-2 z-10 flex items-center gap-1';
    topRightControls.innerHTML = options.ego
        ? `<div class="flex items-center gap-1 text-[11px] font-medium tracking-wide text-slate-500 dark:text-slate-400 whitespace-nowrap">${tasksHeaderButtonHtml(fullscreenId, 'toggleHelp', '?', 'Show graph shortcuts and gestures')}${tasksHeaderButtonHtml(fullscreenId, 'fit', 'F', 'Fit view')}${tasksHeaderButtonHtml(fullscreenId, 'toggleEdges', 'E', 'Toggle edges')}</div>`
        : tasksHeaderControlsHtml(fullscreenId, false);
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.title = 'Close (Esc)';
    closeBtn.className = 'rounded border border-slate-300 dark:border-slate-600 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-1.5 py-0.5 font-mono text-[10px] leading-none text-slate-700 dark:text-slate-300';
    closeBtn.textContent = 'X';
    closeBtn.onclick = () => document.body.removeChild(modal);
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
    flow.style.height = 'calc(100% - 41px)';
    flow.style.overflow = 'hidden';
    flow.style.cursor = 'grab';

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
        if (e.key === 'Escape' && document.getElementById('tasks-fullscreen-modal')) {
            document.body.removeChild(modal);
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
            document.removeEventListener('keydown', escHandler);
        }
    });

    await renderTasksGraphs(modal);
}

window.openTasksFullscreen = async function(id) {
    await openTasksGraphModal(document.getElementById(id));
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
