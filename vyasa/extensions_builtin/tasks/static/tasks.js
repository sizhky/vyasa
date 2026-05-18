import ELK from 'https://esm.sh/elkjs@0.10.0';
import { buildTaskEdgeAnchors, clampScale, isTasksGraphNodeSelectable, nextWheelState, sizeTaskNode, tasksGraphNodeHitArea } from '/static/extensions/tasks/tasks_graph_core.js';

const tasksElk = new ELK();
let tasksReactFlowReady = null;
const TASKS_GROUP_PADDING = { top: 68, right: 40, bottom: 40, left: 40 };
const TASKS_ROOT_SPACING = { node: 44, layer: 96 };
const TASKS_EXPANSION_SHIFT_RATIO = 0.45;
const TASKS_ROOT_COLLISION_GAP = 96;
const TASKS_GROUP_BG_Z = 10;
const TASKS_EDGE_Z = 5;
const TASKS_EDGE_LABEL_Z = 6;
const TASKS_EDGE_LABEL_FOCUS_Z = 1400;
const TASKS_GROUP_Z = 180;
const TASKS_TASK_Z = 1000;
const TASKS_TITLE_Z = 300;
const TASKS_NEIGHBOR_Z_BOOST = 260;
const TASKS_EDGE_FOCUS_Z = 1450;
const TASKS_SELECTED_Z_BOOST = 520;
const TASKS_NODE_BG = 'color-mix(in srgb, var(--vyasa-paper) 86%, var(--vyasa-primary) 14%)';
const TASKS_GROUP_BG = 'color-mix(in srgb, var(--vyasa-paper) 88%, var(--vyasa-primary) 12%)';
const TASKS_GROUP_EXPANDED_BG = 'color-mix(in srgb, var(--vyasa-primary) 7%, transparent)';
const TASKS_NODE_BORDER = '1px solid color-mix(in srgb, var(--vyasa-paper) 42%, var(--vyasa-primary) 58%)';
const TASKS_GROUP_TITLE_BG = 'color-mix(in srgb, var(--vyasa-paper) 76%, var(--vyasa-primary) 24%)';
const TASKS_NODE_BG_ACTIVE = 'color-mix(in srgb, var(--vyasa-paper) 74%, var(--vyasa-primary) 26%)';
const TASKS_GROUP_BG_ACTIVE = 'color-mix(in srgb, var(--vyasa-primary) 10%, transparent)';
const TASKS_EDGE_FOCUS_OUT_COLOR = 'color-mix(in srgb, var(--vyasa-primary) 55%, #f59e0b 45%)';
const TASKS_EDGE_FOCUS_IN_COLOR = 'color-mix(in srgb, var(--vyasa-primary) 40%, #22c55e 60%)';
const TASKS_AUTO_FIT_ON_EXPAND_DEFAULT = false;
const TASKS_AUTO_FIT_ON_FILTER_DEFAULT = true;
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
window.__vyasaTasksActions = window.__vyasaTasksActions || {};
window.__vyasaTasksConfig = window.__vyasaTasksConfig || {};
window.__vyasaTasksDebug = window.__vyasaTasksDebug || { events: [] };
window.__vyasaTasksDebug.enabled = window.__vyasaTasksDebug.enabled === true || new URLSearchParams(window.location.search).has('tasks_debug');
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

function tasksPrefsKey(model) {
    const graphId = String(model?.graph_id || '').trim();
    return graphId ? `vyasa:tasks:prefs:${graphId}` : '';
}

function readTasksPrefs(model) {
    const key = tasksPrefsKey(model);
    if (!key || typeof window === 'undefined') return {};
    try {
        const storage = window.localStorage;
        if (!storage) return {};
        const parsed = JSON.parse(storage.getItem(key) || '{}');
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

function writeTasksPrefs(model, prefs) {
    const key = tasksPrefsKey(model);
    if (!key || typeof window === 'undefined') return;
    try {
        const storage = window.localStorage;
        if (!storage) return;
        storage.setItem(key, JSON.stringify({
            version: 1,
            filters: prefs?.filters && typeof prefs.filters === 'object' ? prefs.filters : {},
            colorBy: String(prefs?.colorBy || ''),
            filtersCollapsed: Boolean(prefs?.filtersCollapsed),
        }));
    } catch {
        // localStorage may be unavailable in private or restricted contexts.
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

function tasksNodeMetaEntries(node) {
    if (!node) return [];
    const hidden = new Set([
        'id', 'label', 'kind', '__kind__', 'group_id', 'parent_group_id',
        'handlelayout', 'highlightmode', 'sourcegroupid',
        'width', 'height', 'position', 'parentId', 'color', 'href',
    ]);
    return Object.entries(node)
        .filter(([key, value]) => !hidden.has(String(key).toLowerCase()) && value !== null && value !== undefined && value !== '' && (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'))
        .map(([key, value]) => ({
            key,
            label: key.replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase()),
            value: String(value),
        }));
}

function tasksNodeMetaLabel(key) {
    return key.replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function tasksNodeAggregateEntries(nodeId, model) {
    if (!nodeId || !model) return [];
    const groupsById = Object.fromEntries((model.groups || []).map((group) => [group.id, group]));
    const tasksById = Object.fromEntries((model.tasks || []).map((task) => [task.id, task]));
    const hidden = new Set([
        'id', 'label', 'kind', '__kind__', 'group_id', 'parent_group_id',
        'handleLayout', 'highlightMode', 'sourceGroupId',
        'width', 'height', 'position', 'parentId',
    ]);
    const totals = new Map();
    const visitNode = (item) => {
        if (!item) return;
        for (const [key, value] of Object.entries(item)) {
            if (hidden.has(key)) continue;
            const numeric = typeof value === 'number'
                ? value
                : (typeof value === 'string' && /^-?\d+$/.test(value.trim()) ? Number.parseInt(value.trim(), 10) : null);
            if (!Number.isInteger(numeric)) continue;
            totals.set(key, (totals.get(key) || 0) + numeric);
        }
    };
    const walkGroup = (groupId) => {
        const group = groupsById[groupId];
        visitNode(group);
        for (const taskId of (model.task_children?.[groupId] || [])) visitNode(tasksById[taskId]);
        for (const childGroupId of (model.group_tree?.[groupId] || [])) walkGroup(childGroupId);
    };
    walkGroup(nodeId);
    return Array.from(totals.entries()).map(([key, value]) => ({
        key,
        label: tasksNodeMetaLabel(key),
        value: String(value),
    }));
}

function tasksFilterOptions(model) {
    if (!model) return [];
    const allowedFilterAttributes = Array.isArray(model.filter_attributes)
        ? model.filter_attributes.map((key) => String(key || '').trim()).filter(Boolean)
        : [];
    const allowedKeys = allowedFilterAttributes.length ? new Set(allowedFilterAttributes) : null;
    const hidden = new Set([
        'id', 'label', 'kind', '__kind__', 'group_id', 'parent_group_id',
        'handlelayout', 'highlightmode', 'sourcegroupid',
        'width', 'height', 'position', 'parentId', 'color', 'href',
    ]);
    const buckets = new Map();
    const visit = (node) => {
        if (!node) return;
        for (const [key, value] of Object.entries(node)) {
            if (hidden.has(String(key).toLowerCase()) || value === null || value === undefined || value === '') continue;
            if (allowedKeys && !allowedKeys.has(String(key))) continue;
            if (!(typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')) continue;
            if (!buckets.has(key)) buckets.set(key, { values: new Set(), kinds: new Set() });
            buckets.get(key).values.add(String(value));
            buckets.get(key).kinds.add(typeof value);
        }
    };
    (model.groups || []).forEach(visit);
    (model.tasks || []).forEach(visit);
    return Array.from(buckets.entries())
        .map(([key, bucket]) => ({
            key,
            label: tasksNodeMetaLabel(key),
            values: Array.from(bucket.values).sort((a, b) => a.localeCompare(b)),
            isBoolean: bucket.kinds.size === 1 && bucket.kinds.has('boolean'),
        }))
        .sort((a, b) => a.label.localeCompare(b.label));
}

function tasksColorOptions(model) {
    const palettes = model?.color_palettes && typeof model.color_palettes === 'object' ? model.color_palettes : {};
    const declaredKeys = Object.keys(palettes).filter((key) => key && typeof palettes[key] === 'object' && Object.keys(palettes[key] || {}).length > 0);
    const nodes = [...(model?.groups || []), ...(model?.tasks || [])];
    return declaredKeys
        .filter((key) => nodes.some((node) => {
            const value = node?.[key];
            return value !== null && value !== undefined && String(value).trim() !== '';
        }))
        .map((key) => ({
            key,
            label: tasksNodeMetaLabel(key),
        }))
        .sort((a, b) => a.label.localeCompare(b.label));
}

function tasksColorPaletteFor(model, colorBy) {
    const key = String(colorBy || '').trim();
    if (!key) return {};
    const palettes = model?.color_palettes && typeof model.color_palettes === 'object' ? model.color_palettes : {};
    const configuredPalette = palettes[key];
    if (configuredPalette && Object.keys(configuredPalette).length > 0) return configuredPalette;
    const legacyKey = String(model?.color_by || '').trim();
    const legacyPalette = model?.color_palette && typeof model.color_palette === 'object' ? model.color_palette : {};
    if (key === legacyKey && Object.keys(legacyPalette).length > 0) return legacyPalette;
    return {};
}

function tasksColorPaletteEntries(model, colorBy) {
    return Object.entries(tasksColorPaletteFor(model, colorBy))
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

function resolveTasksEdgeColor(edge, model, colorByOverride = null, paletteOverride = null) {
    if (!edge) return '';
    if (typeof edge.color === 'string' && edge.color.trim()) return edge.color.trim();
    const colorBy = colorByOverride !== null
        ? String(colorByOverride || '').trim()
        : (typeof model?.edge_color_by === 'string' ? model.edge_color_by.trim() : '');
    if (!colorBy) return '';
    const palette = paletteOverride && typeof paletteOverride === 'object'
        ? paletteOverride
        : tasksEdgeColorPaletteFor(model, colorBy);
    const value = edge[colorBy];
    if (value === null || value === undefined || String(value).trim() === '') return '';
    const color = palette[String(value)];
    return typeof color === 'string' && color.trim() ? color.trim() : '';
}

function tasksNodeMatchesFilters(node, filters) {
    const entries = Object.entries(filters || {}).filter(([, value]) => value);
    if (!entries.length) return true;
    return entries.every(([key, value]) => {
        if (Array.isArray(value)) return !value.length || value.includes(String(node?.[key] || ''));
        return String(node?.[key] || '') === String(value);
    });
}

function resolveTasksNodeOwnColor(node, model, colorByOverride = null, paletteOverride = null) {
    if (!node) return '';
    const colorBy = colorByOverride !== null
        ? String(colorByOverride || '').trim()
        : (typeof model?.color_by === 'string' ? model.color_by.trim() : '');
    const palette = paletteOverride && typeof paletteOverride === 'object'
        ? paletteOverride
        : tasksColorPaletteFor(model, colorBy);
    if (colorBy) {
        const value = node[colorBy];
        if (value !== null && value !== undefined && String(value).trim()) {
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
                .vyasa-tasks-filter-card {
                    border: 1px solid color-mix(in srgb, var(--vyasa-primary) 32%, transparent) !important;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.12) !important;
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
    for (const groupId of expanded) {
        (model.group_tree?.[groupId] || []).forEach((id) => visibleGroups.add(id));
        (model.task_children?.[groupId] || []).forEach((id) => visibleTasks.add(id));
    }
    const visibleNodes = [
        ...Array.from(visibleGroups).map((id) => ({ ...(groupsById[id] || {}), id, label: groupsById[id]?.label || id, __kind__: 'group', ...sizeTaskNode(groupsById[id]?.label || id, 'group') })),
        ...Array.from(visibleTasks).map((id) => ({ ...(tasksById[id] || {}), id, label: tasksById[id]?.label || id, __kind__: 'task', ...sizeTaskNode(tasksById[id]?.label || id, 'task') })),
    ];
    const parentOfGroup = Object.fromEntries((model.groups || []).map((g) => [g.id, g.parent_group_id || null]));
    const parentOfTask = Object.fromEntries((model.tasks || []).map((t) => [t.id, t.group_id || null]));
    const nearestVisible = (id) => {
        if (visibleGroups.has(id) || visibleTasks.has(id)) return id;
        let cur = parentOfTask[id] ?? parentOfGroup[id] ?? null;
        while (cur) {
            if (visibleGroups.has(cur)) return cur;
            cur = parentOfGroup[cur] ?? null;
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
            return { ...source, ...nodeRest, __kind__: kind, label, ...sizeTaskNode(label, kind) };
        }),
    };
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

function expandOneGroupDepth(groupTree, expandedSet) {
    const expanded = new Set(expandedSet || []);
    const roots = groupTree?.["null"] || [];
    if (expanded.size === 0) {
        roots.forEach((id) => expanded.add(id));
        return expanded;
    }
    for (const groupId of Array.from(expanded)) {
        for (const childId of (groupTree?.[groupId] || [])) expanded.add(childId);
    }
    return expanded;
}

function collapseOneGroupDepth(groupTree, expandedSet) {
    const expanded = new Set(expandedSet || []);
    for (const groupId of Array.from(expanded)) {
        const hasExpandedChild = (groupTree?.[groupId] || []).some((childId) => expanded.has(childId));
        if (!hasExpandedChild) expanded.delete(groupId);
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
    logTasksDebug('rootGraph', {
        nodes: rootGraph.nodes.map(n => n.id),
        edges: rootGraph.edges,
        edgeCount: rootGraph.edges.length,
    });
    const laidOut = await layoutTasksGraph(rootGraph, model, new Set(), jitterConfig, layoutConfig);
    logTasksDebug('baseLayout', {
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

async function layoutGroupInternal(groupId, model, childSizes = {}, jitterConfig = {}, layoutConfig = {}) {
    const groupsById = Object.fromEntries((model.groups || []).map((group) => [group.id, group]));
    const tasksById = Object.fromEntries((model.tasks || []).map((task) => [task.id, task]));
    const groupDirection = readTasksDirection(groupsById[groupId]?.layout_direction || groupsById[groupId]?.direction || layoutConfig.elkDirection);
    const groupChildren = [
        ...(model.group_tree?.[groupId] || []).map((id) => ({ id, __kind__: 'group', label: groupsById[id]?.label || id, ...sizeTaskNode(groupsById[id]?.label || id, 'group') })),
        ...(model.task_children?.[groupId] || []).map((id) => ({ id, __kind__: 'task', label: tasksById[id]?.label || id, ...sizeTaskNode(tasksById[id]?.label || id, 'task') })),
    ].map((child) => childSizes[child.id] ? { ...child, ...childSizes[child.id] } : child);
    if (groupChildren.length === 0) {
        return {
            positions: {},
            bbox: { width: 250, height: 80 },
        };
    }
    const childIds = new Set(groupChildren.map((child) => child.id));
    const taskToGroup = Object.fromEntries((model.tasks || []).map((task) => [task.id, task.group_id || null]));
    const groupParent = Object.fromEntries((model.groups || []).map((group) => [group.id, group.parent_group_id || null]));
    const directChildFor = (id) => {
        if (childIds.has(id)) return id;
        let cur = taskToGroup[id] || id;
        while (cur) {
            if (childIds.has(cur)) return cur;
            cur = groupParent[cur] || null;
        }
        return null;
    };
    const seenProjectedEdges = new Map();
    const projectedEdges = [];
    for (const edge of (model.dependency_edges || [])) {
        const source = directChildFor(edge.source);
        const target = directChildFor(edge.target);
        traceTasksEdge(`group:${groupId}`, edge, {
            mapped: { source, target },
            childIds: Array.from(childIds),
        });
        if (!childIds.has(source) || !childIds.has(target) || source === target) continue;
        appendProjectedEdge(projectedEdges, seenProjectedEdges, source, target, edge.label || '', edge);
    }
    const reducedProjectedEdges = reduceTransitiveEdges(projectedEdges);
    const laidOut = await tasksElk.layout({
        id: `group-${groupId}`,
        layoutOptions: {
            'elk.algorithm': 'layered',
            'elk.direction': groupDirection,
            'elk.spacing.nodeNode': `${layoutConfig.nodeSpacing || 72}`,
            'elk.layered.spacing.nodeNodeBetweenLayers': `${layoutConfig.layerSpacing || 112}`,
            'elk.padding': `[top=${(layoutConfig.groupPadding || 40) + 28},left=${layoutConfig.groupPadding || 40},bottom=${layoutConfig.groupPadding || 40},right=${layoutConfig.groupPadding || 40}]`,
        },
        children: groupChildren.map((child) => ({ id: child.id, width: child.width, height: child.height })),
        edges: reducedProjectedEdges.map((edge, index) => ({ id: `e${index}`, sources: [edge.source], targets: [edge.target] })),
    });
    const positions = {};
    for (const child of (laidOut.children || [])) {
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
            width: Math.max(laidOut.width || 0, 250),
            height: Math.max(laidOut.height || 0, 80),
        },
    };
}

async function layoutExpandedGroups(model, expandedSet, jitterConfig = {}, layoutConfig = {}) {
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
        layouts[groupId] = await layoutGroupInternal(groupId, model, childSizes, jitterConfig, layoutConfig);
    }
    return layouts;
}

function deriveSquishedExpandedLayout(baseGraph, model, expandedSet, baseLayout, groupLayouts, layoutConfig = {}) {
    const visible = buildVisibleTasksGraph(model, expandedSet);
    logTasksDebug('visibleGraph', {
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
        topLevelRects[id] = groupLayout ? {
            x: baseRect.x,
            y: baseRect.y,
            width: groupLayout.bbox.width,
            height: groupLayout.bbox.height,
            baseWidth: baseRect.width,
            baseHeight: baseRect.height,
        } : {
            x: baseRect.x,
            y: baseRect.y,
            width: baseRect.width,
            height: baseRect.height,
            baseWidth: baseRect.width,
            baseHeight: baseRect.height,
        };
    }

    const nodes = [];
    for (const id of topLevelIds) {
        const visibleNode = visibleNodeMap[id];
        if (!visibleNode) continue;
        const rect = topLevelRects[id];
        const baseRect = baseLayout.positions[id];
        nodes.push({
            ...visibleNode,
            position: { x: baseRect.x, y: baseRect.y },
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

    const unwarpPoint = (point, sourceRect, targetRect) => {
        const sourceRight = sourceRect.x + sourceRect.width;
        const sourceBottom = sourceRect.y + sourceRect.height;
        const dx = Math.max(0, targetRect.width - sourceRect.width) * TASKS_EXPANSION_SHIFT_RATIO;
        const dy = Math.max(0, targetRect.height - sourceRect.height) * TASKS_EXPANSION_SHIFT_RATIO;
        let x = point.x;
        let y = point.y;

        if (point.x >= sourceRight) x += dx;
        else if (point.x > sourceRect.x) x = sourceRect.x + ((point.x - sourceRect.x) / Math.max(sourceRect.width, 1)) * targetRect.width;

        if (point.y >= sourceBottom) y += dy;
        else if (point.y > sourceRect.y) y = sourceRect.y + ((point.y - sourceRect.y) / Math.max(sourceRect.height, 1)) * targetRect.height;

        return { x, y };
    };

    if (expandedTopLevelIds.length > 0) {
        const topLevelState = {};
        for (const id of topLevelIds) {
            const baseRect = baseLayout.positions[id];
            const rect = topLevelRects[id];
            if (!baseRect || !rect) continue;
            topLevelState[id] = {
                x: baseRect.x || 0,
                y: baseRect.y || 0,
                width: rect.baseWidth,
                height: rect.baseHeight,
                expandedWidth: rect.width,
                expandedHeight: rect.height,
            };
        }

        for (const expandedId of expandedTopLevelIds) {
            const expandedState = topLevelState[expandedId];
            if (!expandedState) continue;
            const source = {
                x: expandedState.x,
                y: expandedState.y,
                width: expandedState.width,
                height: expandedState.height,
            };
            const target = {
                x: expandedState.x,
                y: expandedState.y,
                width: expandedState.expandedWidth,
                height: expandedState.expandedHeight,
            };

            for (const id of topLevelIds) {
                if (id === expandedId || !topLevelState[id]) continue;
                const state = topLevelState[id];
                const center = { x: state.x + state.width / 2, y: state.y + state.height / 2 };
                const nextCenter = unwarpPoint(center, source, target);
                state.x = nextCenter.x - state.width / 2;
                state.y = nextCenter.y - state.height / 2;
            }

            expandedState.width = expandedState.expandedWidth;
            expandedState.height = expandedState.expandedHeight;
        }

        const topLevelStateList = topLevelIds
            .map((id) => topLevelState[id])
            .filter(Boolean)
            .sort((a, b) => (a.y - b.y) || (a.x - b.x));
        logTasksDebug('unwarpBeforeCollisions', {
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
            logTasksDebug('unwarpPass', {
                pass,
                collisionMoves,
                topLevelState: Object.fromEntries(Object.entries(topLevelState).map(([id, rect]) => [id, rectSummary(rect)])),
            });
        }

        for (const node of nodes.filter((n) => !n.parentId)) {
            const state = topLevelState[node.id];
            if (!state) continue;
            node.position = { x: state.x, y: state.y };
        }

        logTasksDebug('unwarpFinal', {
            topLevelNodes: nodes.filter(n => !n.parentId).map(n => ({
                id: n.id,
                x: Math.round(n.position.x),
                y: Math.round(n.position.y),
                width: Math.round(n.width || 0),
                height: Math.round(n.height || 0),
            })),
        });
    }

    const finalEdges = visible.edges.map((e, i) => ({
        ...e,
        id: `${e.source}-${e.target}-${i}`,
        source: e.source,
        target: e.target,
        label: e.label || undefined,
    }));
    logTasksDebug('deriveResult', { visibleEdges: visible.edges, finalEdges });
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
        return `<div class="vyasa-task-card" data-node-id="${n.id}" data-node-kind="${n.__kind__}" style="position:absolute;left:${p.x}px;top:${p.y}px;width:${n.width}px;height:${n.height}px;border:1px solid color-mix(in srgb, currentColor 35%, transparent);border-radius:14px;background:${bg};display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:600;text-align:center;padding:8px;cursor:${n.__kind__ === 'group' ? 'pointer' : 'default'}"><span>${n.label}</span>${exp}</div>`;
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

function openTasksNodeHref(href, event = null) {
    if (!href) return;
    event?.preventDefault();
    event?.stopPropagation();
    if (href.startsWith('#')) {
        document.getElementById(href.slice(1))?.scrollIntoView({ block: 'start', behavior: 'smooth' });
        window.history.pushState(null, '', href);
        return;
    }
    const [pathOnly, hash = ''] = String(href).split('#', 2);
    const isInternal = href.startsWith('/posts/') || (href.startsWith('/') && !href.startsWith('/slides/') && !href.split('/').pop().includes('.'));
    if (isInternal && window.htmx?.ajax) {
        const onSwap = (swapEvent) => {
            if (swapEvent.target?.id !== 'main-content') return;
            document.body.removeEventListener('htmx:afterSwap', onSwap);
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

function stableEdgeHash(text) {
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

function edgeControlPoint(x, y, position, otherX, otherY) {
    const dx = otherX - x;
    const dy = otherY - y;
    const distance = Math.max(Math.abs(dx), Math.abs(dy), 40) * 0.5;
    if (position === 'left') return { x: x - distance, y };
    if (position === 'right') return { x: x + distance, y };
    if (position === 'top') return { x, y: y - distance };
    return { x, y: y + distance };
}

function cubicBezierPoint(p0, p1, p2, p3, t) {
    const mt = 1 - t;
    return (
        (mt ** 3) * p0 +
        3 * (mt ** 2) * t * p1 +
        3 * mt * (t ** 2) * p2 +
        (t ** 3) * p3
    );
}

function tasksEdgeLabelPoint(props) {
    const seed = `${props.source}->${props.target}|${props.label || ''}`;
    const t = 0.25 + ((stableEdgeHash(seed) % 51) / 100);
    const c1 = edgeControlPoint(props.sourceX, props.sourceY, props.sourcePosition, props.targetX, props.targetY);
    const c2 = edgeControlPoint(props.targetX, props.targetY, props.targetPosition, props.sourceX, props.sourceY);
    return {
        x: cubicBezierPoint(props.sourceX, c1.x, c2.x, props.targetX, t),
        y: cubicBezierPoint(props.sourceY, c1.y, c2.y, props.targetY, t),
    };
}

async function renderTasksGraphs(rootElement = document) {
    const rf = await ensureTasksReactFlow();
    for (const wrapper of rootElement.querySelectorAll('.tasks-container[data-tasks-widget="true"]')) {
        if (wrapper.dataset.tasksMounted === 'true') return;
        const mount = wrapper.querySelector('.vyasa-tasks-flow');
        if (!mount || !rf) return;
        const jitterConfig = {
            x: Number.parseFloat(wrapper.dataset.tasksJitter || '0'),
            y: Number.parseFloat(wrapper.dataset.tasksJitterY || wrapper.dataset.tasksJitter || '0'),
        };
        const layoutConfig = readTasksLayoutConfig(wrapper);
        const model = JSON.parse(wrapper.dataset.tasksPayload || '{"groups":[],"tasks":[],"group_tree":{},"task_children":{},"dependency_edges":[]}');
        const rawGraph = normalizeTasksGraphNodes(JSON.parse(wrapper.dataset.tasksGraph || '{"nodes":[],"edges":[]}'), model);
        const widgetId = wrapper.id;
        const defaultOpenDepth = Number.parseInt(wrapper.dataset.tasksDefaultOpenDepth || '0', 10);
        const initialExpandedSet = collectExpandedGroupsByDepth(model.group_tree, Number.isNaN(defaultOpenDepth) ? 0 : defaultOpenDepth);
        const TasksGraphApp = (props) => {
            const React = window.React;
            const Handle = rf.Handle;
            const Position = rf.Position;
            const initialPrefsRef = React.useRef(null);
            if (initialPrefsRef.current === null) initialPrefsRef.current = readTasksPrefs(model);
            const baseLayoutRef = React.useRef(null);
            const groupLayoutsRef = React.useRef({});
            const graphBaseRef = React.useRef({ nodes: [], edges: [] });
            const flowWrapperRef = React.useRef(null);
            const filterPanelRef = React.useRef(null);
            const [expanded, setExpanded] = React.useState(() => new Set(initialExpandedSet));
            const [selectedNodeId, setSelectedNodeId] = React.useState(null);
            const [hoveredNodeId, setHoveredNodeId] = React.useState(null);
            const [groupHoverTooltip, setGroupHoverTooltip] = React.useState(null);
            const [activeFilters, setActiveFilters] = React.useState(() => (
                initialPrefsRef.current?.filters && typeof initialPrefsRef.current.filters === 'object'
                    ? initialPrefsRef.current.filters
                    : {}
            ));
            const [activeColorBy, setActiveColorBy] = React.useState(() => (
                typeof initialPrefsRef.current?.colorBy === 'string'
                    ? initialPrefsRef.current.colorBy
                    : String(model?.default_color_by || '').trim()
            ));
            const [filtersCollapsed, setFiltersCollapsed] = React.useState(() => Boolean(initialPrefsRef.current?.filtersCollapsed));
            const [filterPanelHeight, setFilterPanelHeight] = React.useState(172);
            const [graphRevision, setGraphRevision] = React.useState(0);
            const [nodes, setNodes] = React.useState([]);
            const [edges, setEdges] = React.useState([]);
            const pendingFitActionRef = React.useRef(null);
            const reactFlowApiRef = React.useRef(null);
            const prevExpandedCountRef = React.useRef(0);
            const hoverClearTimerRef = React.useRef(null);
            const activeColorPalette = React.useMemo(() => tasksColorPaletteFor(model, activeColorBy), [model, activeColorBy]);
            React.useEffect(() => {
                const validFilterKeys = new Set(tasksFilterOptions(model).map((option) => option.key));
                const validColorKeys = new Set(tasksColorOptions(model).map((option) => option.key));
                setActiveFilters((current) => Object.fromEntries(
                    Object.entries(current || {}).filter(([key, value]) => {
                        if (!validFilterKeys.has(key)) return false;
                        if (Array.isArray(value)) return value.length > 0;
                        return Boolean(value);
                    })
                ));
                setActiveColorBy((current) => (current && !validColorKeys.has(current) ? '' : current));
            }, [model]);
            React.useEffect(() => {
                writeTasksPrefs(model, {
                    filters: activeFilters,
                    colorBy: activeColorBy,
                    filtersCollapsed,
                });
            }, [model, activeFilters, activeColorBy, filtersCollapsed]);
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
            }, [model]);
            const rebuildLayout = React.useCallback(async (expandedSet) => {
                const effectiveExpandedSet = effectiveExpandedGroups(model, expandedSet);
                const baseLayout = await ensureBaseLayout();
                groupLayoutsRef.current = await layoutExpandedGroups(model, effectiveExpandedSet, jitterConfig, layoutConfig);
                const rootGroupIds = new Set(model.group_tree?.["null"] || []);
                const rootTaskIds = new Set(model.task_children?.["null"] || []);
                const rootNodeIds = new Set([...rootGroupIds, ...rootTaskIds]);
                const rootGraph = {
                    nodes: rawGraph.nodes.filter((n) => rootNodeIds.has(n.id)),
                    edges: (rawGraph.edges || []).filter((e) => rootNodeIds.has(e.source) && rootNodeIds.has(e.target))
                };
                const derived = deriveSquishedExpandedLayout(rootGraph, model, effectiveExpandedSet, baseLayout, groupLayoutsRef.current, layoutConfig);
                const derivedById = Object.fromEntries((derived.nodes || []).map((node) => [node.id, node]));
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
                const baseNodes = derived.nodes.map((n) => {
                    const isExpanded = n.__kind__ === 'group' && effectiveExpandedSet.has(n.id);
                    const hitArea = tasksGraphNodeHitArea(n.__kind__, isExpanded);
                    const depth = depthOf(n);
                    const nodeZ = n.__kind__ !== 'group'
                        ? TASKS_TASK_Z + depth
                        : ((isExpanded ? TASKS_GROUP_BG_Z : TASKS_GROUP_Z) + depth);
                    const nodeColor = resolveTasksNodeColor(n, model, activeColorBy, activeColorPalette);
                    const background = n.__kind__ === 'group'
                        ? (nodeColor
                            ? (isExpanded
                                ? `color-mix(in srgb, ${nodeColor} 7%, transparent)`
                                : `color-mix(in srgb, var(--vyasa-paper) 86%, ${nodeColor} 14%)`)
                            : (isExpanded ? TASKS_GROUP_EXPANDED_BG : TASKS_GROUP_BG))
                        : (nodeColor ? `color-mix(in srgb, var(--vyasa-paper) 78%, ${nodeColor} 22%)` : TASKS_NODE_BG);
                    const border = nodeColor
                        ? `1px solid color-mix(in srgb, var(--vyasa-paper) 30%, ${nodeColor} 70%)`
                        : TASKS_NODE_BORDER;
                    const rfNode = {
                        id: n.id,
                        type: 'vyasaTask',
                        position: n.position,
                        data: n,
                        style: {
                            width: n.width,
                            height: n.height,
                            zIndex: nodeZ,
                            background,
                            border,
                            borderRadius: isExpanded ? 12 : 6,
                            boxShadow: 'none',
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
                    const titleHeight = sizeTaskNode(n.label || n.id, 'groupTitle', titleWidth).height;
                    baseNodes.push({
                        id: `${n.id}__title`,
                        type: 'vyasaTask',
                        position: { x: position.x + 8, y: position.y + 8 },
                        data: { ...n, id: `${n.id}__title`, sourceGroupId: n.id, __kind__: 'groupTitle' },
                        style: {
                            width: titleWidth,
                            height: titleHeight,
                            zIndex: titleZ,
                            background: TASKS_GROUP_TITLE_BG,
                            border: 'none',
                            borderRadius: 6,
                            boxShadow: 'none',
                            overflow: 'hidden',
                            pointerEvents: 'auto',
                        },
                        zIndex: titleZ,
                        className: `vyasa-tasks-node--${tasksGraphNodeHitArea('groupTitle')}`,
                        draggable: false,
                        selectable: false,
                    });
                }
                const anchored = buildTaskEdgeAnchors(baseNodes, derived.edges);
                const edgeColorPalette = tasksEdgeColorPaletteFor(model, model?.edge_color_by);
                const baseEdges = anchored.edges.map((edge) => {
                    const edgeColor = resolveTasksEdgeColor(edge, model, model?.edge_color_by, edgeColorPalette);
                    return {
                        ...edge,
                        type: 'vyasaEdge',
                        animated: false,
                        data: { ...(edge.data || {}), edgeColor },
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
                        labelStyle: { fontSize: 11, fontWeight: 600, fill: edgeColor || 'currentColor' },
                        labelBgStyle: { fill: 'var(--vyasa-paper)', fillOpacity: 0.88 },
                        style: { strokeWidth: 2.5, opacity: 1, stroke: edgeColor || 'currentColor' },
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
                    expanded: Array.from(expandedSet),
                    effectiveExpanded: Array.from(effectiveExpandedSet),
                    nodes: anchoredNodes.map((node) => ({
                        id: node.id,
                        label: node.data?.label,
                        kind: node.data?.__kind__,
                        parentId: node.parentId || null,
                        position: rectSummary({ ...node.position, width: node.style?.width, height: node.style?.height }),
                    })),
                    edges: baseEdges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target, label: edge.label || '' })),
                };
                logTasksDebug('reactFlowState', window.__vyasaTasksDebug.latest);
                setNodes(anchoredNodes);
                setEdges(baseEdges);
                setGraphRevision((value) => value + 1);
            }, [ensureBaseLayout, model, activeColorBy, activeColorPalette]);
            const defaultEdgeOptions = React.useMemo(() => ({
                zIndex: TASKS_EDGE_Z,
                style: { strokeWidth: 2.5, opacity: 1, stroke: 'currentColor' },
            }), []);
            const applyHighlight = React.useCallback((nodeId, hoveredNodeId = null) => {
                const baseNodes = graphBaseRef.current.nodes || [];
                const baseEdges = graphBaseRef.current.edges || [];
                if (!nodeId || !baseNodes.some((node) => node.id === nodeId)) {
                    const hasFilters = Object.values(activeFilters).some((value) => Array.isArray(value) ? value.length > 0 : Boolean(value));
                    if (!hasFilters) {
                        setNodes(baseNodes);
                        setEdges(baseEdges);
                        return;
                    }
                    const matchingIds = new Set(baseNodes.filter((node) => tasksNodeMatchesFilters(node.data, activeFilters)).map((node) => node.id));
                    setNodes(baseNodes.map((node) => ({
                        ...node,
                        data: { ...node.data, highlightMode: matchingIds.has(node.id) ? 'selected' : 'dim' },
                        style: { ...node.style, opacity: matchingIds.has(node.id) ? 1 : 0.18 },
                    })));
                    setEdges(baseEdges.map((edge) => {
                        const hit = matchingIds.has(edge.source) && matchingIds.has(edge.target);
                        const edgeColor = edge.data?.edgeColor || edge.style?.stroke || 'currentColor';
                        return {
                            ...edge,
                            data: { ...edge.data, highlightMode: hit ? 'selected' : 'dim' },
                            labelStyle: { ...(edge.labelStyle || {}), fill: hit ? edgeColor : 'color-mix(in srgb, var(--vyasa-ink) 26%, transparent)', opacity: hit ? 1 : 0.12 },
                            labelBgStyle: { ...(edge.labelBgStyle || {}), fillOpacity: hit ? 0.88 : 0.06 },
                            style: {
                                ...edge.style,
                                stroke: hit ? edgeColor : 'color-mix(in srgb, var(--vyasa-ink) 38%, transparent)',
                                opacity: hit ? 0.98 : 0.08,
                                strokeWidth: hit ? 4.5 : 2.5,
                                strokeLinecap: hit ? 'round' : undefined,
                                '--vyasa-edge-flow-duration': hit ? '0.7s' : '0.6s',
                            },
                            animated: hit,
                        };
                    }));
                    return;
                }
                const highlightedEdgeIds = new Set();
                const directEndpointIds = new Set([nodeId]);
                const isFocusedPrimary = hoveredNodeId === nodeId;
                const isFocusedNeighbor = hoveredNodeId && hoveredNodeId !== nodeId;
                for (const edge of baseEdges) {
                    if (edge.source === nodeId || edge.target === nodeId) {
                        highlightedEdgeIds.add(edge.id);
                        directEndpointIds.add(edge.source);
                        directEndpointIds.add(edge.target);
                    }
                }
                const focusedEdgeModes = new Map();
                if (isFocusedPrimary) {
                    for (const edge of baseEdges) {
                        if (highlightedEdgeIds.has(edge.id)) focusedEdgeModes.set(edge.id, edge.source === nodeId ? 'focused-out' : 'focused-in');
                    }
                } else if (isFocusedNeighbor && directEndpointIds.has(hoveredNodeId)) {
                    for (const edge of baseEdges) {
                        const linksSelectedAndHovered =
                            (edge.source === nodeId && edge.target === hoveredNodeId) ||
                            (edge.source === hoveredNodeId && edge.target === nodeId);
                        if (linksSelectedAndHovered) focusedEdgeModes.set(edge.id, edge.source === nodeId ? 'focused-out' : 'focused-in');
                    }
                }
                setNodes(baseNodes.map((node) => {
                    const mode = directEndpointIds.has(node.id)
                        ? (node.id === nodeId
                            ? (isFocusedPrimary ? 'selected-focus' : 'selected')
                            : (node.id === hoveredNodeId ? 'neighbor-focus' : 'neighbor'))
                        : 'dim';
                    const nodeColor = resolveTasksNodeColor(node.data, model, activeColorBy, activeColorPalette);
                    const baseZIndex = Number.isFinite(Number(node.zIndex))
                        ? Number(node.zIndex)
                        : Number(node.style?.zIndex || 0);
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
                                    ? (nodeColor
                                        ? `color-mix(in srgb, ${nodeColor} 10%, transparent)`
                                        : TASKS_GROUP_BG_ACTIVE)
                                    : (nodeColor ? `color-mix(in srgb, var(--vyasa-paper) 68%, ${nodeColor} 32%)` : TASKS_NODE_BG_ACTIVE)),
                            opacity: mode === 'dim' ? 0.22 : 1,
                            boxShadow: (mode === 'neighbor-focus' || mode === 'selected-focus')
                                ? '0 0 0 2px color-mix(in srgb, var(--vyasa-primary) 60%, transparent)'
                                : 'none',
                        },
                        zIndex,
                    };
                }));
                const nextEdges = baseEdges.map((edge) => {
                    const mode = focusedEdgeModes.get(edge.id)
                        ? focusedEdgeModes.get(edge.id)
                        : (highlightedEdgeIds.has(edge.id) ? 'selected' : 'dim');
                    const highlighted = mode !== 'dim';
                    const focusColor = mode === 'focused-in' ? TASKS_EDGE_FOCUS_IN_COLOR : TASKS_EDGE_FOCUS_OUT_COLOR;
                    const edgeColor = edge.data?.edgeColor || edge.style?.stroke || 'currentColor';
                    const dashArray = highlighted ? ((mode === 'focused-in' || mode === 'focused-out') ? '10 6' : '8 6') : undefined;
                    const dashCycle = dashArray
                        ? dashArray.split(/\s+/).map(Number).filter(Number.isFinite).slice(0, 2).reduce((sum, value) => sum + value, 0)
                        : undefined;
                    return {
                        ...edge,
                        data: { ...edge.data, highlightMode: mode },
                        zIndex: mode === 'focused-in' || mode === 'focused-out' ? TASKS_EDGE_FOCUS_Z : TASKS_EDGE_Z,
                        labelZIndex: mode === 'dim'
                            ? TASKS_EDGE_LABEL_Z
                            : TASKS_EDGE_LABEL_FOCUS_Z,
                        labelStyle: {
                            ...(edge.labelStyle || {}),
                            fill: mode === 'focused-in' || mode === 'focused-out'
                                ? focusColor
                                : (highlighted ? edgeColor : 'color-mix(in srgb, var(--vyasa-ink) 26%, transparent)'),
                            opacity: hoveredNodeId
                                ? ((mode === 'focused-in' || mode === 'focused-out') ? 1 : 0.05)
                                : ((mode === 'focused-in' || mode === 'focused-out') ? 1 : (highlighted ? 1 : 0.18)),
                            fontWeight: (mode === 'focused-in' || mode === 'focused-out') ? 800 : 600,
                        },
                        labelBgStyle: {
                            ...(edge.labelBgStyle || {}),
                            fill: mode === 'focused-in'
                                ? 'color-mix(in srgb, var(--vyasa-paper) 78%, #22c55e 22%)'
                                : (mode === 'focused-out'
                                    ? 'color-mix(in srgb, var(--vyasa-paper) 80%, #f59e0b 20%)'
                                    : 'var(--vyasa-paper)'),
                            fillOpacity: hoveredNodeId
                                ? ((mode === 'focused-in' || mode === 'focused-out') ? 0.96 : 0.02)
                                : ((mode === 'focused-in' || mode === 'focused-out') ? 0.96 : (highlighted ? 0.88 : 0.08)),
                        },
                        style: {
                            ...edge.style,
                            stroke: mode === 'focused-in' || mode === 'focused-out'
                                ? focusColor
                                : (highlighted ? edgeColor : 'color-mix(in srgb, var(--vyasa-ink) 38%, transparent)'),
                            opacity: (mode === 'focused-in' || mode === 'focused-out') ? 1 : (highlighted ? 0.95 : 0.08),
                            strokeWidth: (mode === 'focused-in' || mode === 'focused-out') ? 5 : (mode === 'selected' ? 3.5 : 2.5),
                            strokeDasharray: dashArray,
                            '--vyasa-edge-dash-cycle': dashCycle,
                            '--vyasa-edge-flow-duration': (mode === 'focused-in' || mode === 'focused-out') ? '0.72s' : '0.64s',
                            strokeLinecap: highlighted ? 'round' : undefined,
                        },
                        animated: highlighted,
                    };
                });
                const edgePriority = { dim: 0, selected: 1, 'focused-in': 2, 'focused-out': 2 };
                nextEdges.sort((a, b) => (edgePriority[a.data?.highlightMode || 'dim'] - edgePriority[b.data?.highlightMode || 'dim']));
                setEdges(nextEdges);
            }, [activeFilters, model, activeColorBy]);
            React.useEffect(() => {
                const baseNodeIds = new Set((graphBaseRef.current.nodes || []).map((node) => node.id));
                if (selectedNodeId && !baseNodeIds.has(selectedNodeId)) {
                    setSelectedNodeId(null);
                    return;
                }
                if (hoveredNodeId && !baseNodeIds.has(hoveredNodeId)) {
                    setHoveredNodeId(null);
                    return;
                }
                applyHighlight(selectedNodeId, hoveredNodeId);
            }, [graphRevision, selectedNodeId, hoveredNodeId, applyHighlight]);
            React.useEffect(() => {
                if (!shouldAutoFitTasksOnExpand()) {
                    pendingFitActionRef.current = null;
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
                if (!shouldAutoFitTasksOnExpand()) return;
                if (!pendingFitActionRef.current) return;
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
                if (!entries.length) return;
                const reactFlow = reactFlowApiRef.current;
                const matchedNodes = (graphBaseRef.current.nodes || []).filter((node) => {
                    if (!node?.id || node.data?.__kind__ === 'groupTitle') return false;
                    return tasksNodeMatchesFilters(node.data, activeFilters);
                });
                if (!reactFlow || matchedNodes.length === 0) return;
                let rafId = window.requestAnimationFrame(() => {
                    reactFlow.fitView({ nodes: matchedNodes, duration: 220, padding: 0.28, includeHiddenNodes: true });
                });
                return () => {
                    if (rafId !== null) window.cancelAnimationFrame(rafId);
                };
            }, [graphRevision, activeFilters]);
            const CustomEdge = React.memo((props) => {
                const [path, labelX, labelY] = rf.getBezierPath(props);
                const labelPoint = tasksEdgeLabelPoint(props);
                const fullLabel = String(props.label || '').replace(/\\n/g, '\n');
                const labelLines = fullLabel.split(/\r?\n/);
                const highlightMode = props.data?.highlightMode || 'none';
                const showFullLabel = highlightMode !== 'dim' && highlightMode !== 'none';
                const displayLabel = showFullLabel
                    ? fullLabel
                    : (labelLines.length > 1 ? `${labelLines[0]}...` : fullLabel);
                const labelStyle = props.labelStyle || {};
                const labelBgStyle = props.labelBgStyle || {};
                return React.createElement(React.Fragment, null,
                    React.createElement(rf.BaseEdge, { ...props, path }),
                    displayLabel && React.createElement(rf.EdgeLabelRenderer, null,
                        React.createElement('div', {
                            style: {
                                position: 'absolute',
                                transform: `translate(-50%, -50%) translate(${labelPoint.x || labelX}px, ${labelPoint.y || labelY}px)`,
                                pointerEvents: 'none',
                                zIndex: props.labelZIndex || TASKS_EDGE_LABEL_Z,
                                padding: `${props.labelBgPadding?.[1] || 0}px ${props.labelBgPadding?.[0] || 0}px`,
                                borderRadius: `${props.labelBgBorderRadius || 0}px`,
                                background: labelBgStyle.fill || 'transparent',
                                opacity: labelBgStyle.fillOpacity ?? labelStyle.opacity ?? 1,
                                color: labelStyle.fill || 'currentColor',
                                fontSize: `${labelStyle.fontSize || 11}px`,
                                fontWeight: labelStyle.fontWeight || 600,
                                whiteSpace: 'pre-line',
                                textAlign: 'center',
                                lineHeight: 1.35,
                                maxWidth: `${props.labelMaxWidth || 240}px`,
                            },
                            title: fullLabel,
                        }, displayLabel)
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
                const isActiveNode = !selectedNodeId || selectedNodeId === sourceNodeId;
                const linksInteractive = isActiveNode;
                const handleInactiveLinkClick = (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setSelectedNodeId(sourceNodeId);
                    setHoveredNodeId(null);
                };
                if (data?.__kind__ === 'groupTitle') {
                    const handleCollapse = (e) => {
                        e.stopPropagation();
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
                            fontSize: '13px',
                        }
                    },
                        React.createElement('span', {
                            style: {
                                minWidth: 0,
                                overflow: 'hidden',
                                display: 'block',
                                whiteSpace: 'pre-line',
                                lineHeight: '1.3',
                                overflowWrap: 'anywhere',
                                wordBreak: 'break-word',
                            }
                        }, renderTasksInlineLinks(data?.label || data.sourceGroupId || id, { interactive: linksInteractive, onInactiveClick: handleInactiveLinkClick })),
                        React.createElement('button', {
                            onClick: handleCollapse,
                            style: { flex: '0 0 auto', border: 'none', background: 'none', cursor: 'pointer', fontSize: '18px', opacity: '0.55', padding: '0' }
                        }, '−')
                    );
                }
                const isGroup = data?.__kind__ === 'group';
                const isExpanded = expanded.has(id);
                const hasHref = Boolean(linksInteractive && data?.href);
                const labelContent = renderTasksInlineLinks(data?.label || id, { interactive: linksInteractive, onInactiveClick: handleInactiveLinkClick });
                const labelNode = hasHref
                    ? React.createElement('a', {
                        href: data.href,
                        onClick: (e) => openTasksNodeHref(data.href, e),
                        style: { color: 'inherit', textDecoration: 'underline', textUnderlineOffset: '2px' },
                    }, labelContent)
                    : React.createElement('span', {
                        onClick: linksInteractive ? undefined : handleInactiveLinkClick,
                        style: { color: 'inherit', textDecoration: 'none' },
                    }, labelContent);
                const handleExpand = (e) => {
                    e.stopPropagation();
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
                        fontSize: '13px',
                        fontWeight: '600',
                        fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                        textAlign: 'center',
                        padding: '10px 12px',
                        overflow: 'hidden',
                        opacity: isDimmed ? 0.22 : 1,
                        cursor: hasHref ? 'pointer' : undefined,
                    }
                },
                    ...renderHandles('target'),
                    React.createElement('span', {
                        style: {
                            boxSizing: 'border-box',
                            width: '100%',
                            maxWidth: '100%',
                            maxHeight: '100%',
                            overflow: 'hidden',
                            display: 'block',
                            whiteSpace: 'pre-line',
                            lineHeight: '1.25',
                            overflowWrap: 'anywhere',
                            wordBreak: 'break-word',
                        }
                    }, labelNode),
                    isGroup && React.createElement('button', {
                        onClick: handleExpand,
                        'data-vyasa-task-control': 'true',
                        style: { position: 'absolute', right: '8px', top: '8px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '18px', opacity: '0.55', padding: '0' }
                    }, '+'),
                    ...renderHandles('source')
                );
            });
            React.useEffect(() => {
                rebuildLayout(expanded);
            }, [expanded, rebuildLayout]);
            const nodeTypes = React.useMemo(() => ({ vyasaTask: CustomNode }), [expanded, selectedNodeId, hoveredNodeId]);
            const edgeTypes = React.useMemo(() => ({ vyasaEdge: CustomEdge }), []);
            const FitViewHotkey = () => {
                const reactFlow = rf.useReactFlow();
                React.useEffect(() => {
                    const onKeyDown = (event) => {
                        if (event.defaultPrevented || event.repeat) return;
                        if (event.metaKey || event.ctrlKey || event.altKey) return;
                        const wrapper = flowWrapperRef.current;
                        if (!wrapper || (!wrapper.contains(document.activeElement) && !wrapper.contains(event.target))) return;
                        const target = event.target instanceof Element ? event.target : null;
                        if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(target.tagName))) return;
                        const key = event.key.toLowerCase();
                        if (key === 'f') {
                            event.preventDefault();
                            reactFlow.fitView({ duration: 200, padding: 0.2, includeHiddenNodes: true });
                            return;
                        }
                        if (key === 'i' || key === 'o') {
                            event.preventDefault();
                            if (key === 'o') pendingFitActionRef.current = 'collapse';
                            setExpanded((current) => {
                                const next = key === 'o'
                                    ? collapseOneGroupDepth(model.group_tree, current)
                                    : expandOneGroupDepth(model.group_tree, current);
                                logTasksDebug('shortcutDepth', { direction: key === 'o' ? 'collapse' : 'expand', expanded: Array.from(next) });
                                return next;
                            });
                            return;
                        }
                        if (key === 'u') {
                            event.preventDefault();
                            const allGroupIds = (model.groups || []).map((group) => group.id);
                            pendingFitActionRef.current = 'expand';
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
                            pendingFitActionRef.current = 'collapse';
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
                    };
                    document.addEventListener('keydown', onKeyDown);
                    return () => document.removeEventListener('keydown', onKeyDown);
                }, [reactFlow]);
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
                const entries = selectedNode?.__kind__ === 'group'
                    ? tasksNodeAggregateEntries(sourceNodeId, model)
                    : tasksNodeMetaEntries(selectedNode);
                if (!selectedNode || entries.length === 0) return null;
                return React.createElement('div', {
                    style: { position: 'absolute', right: '12px', bottom: '112px', zIndex: 29, width: '240px', maxWidth: 'calc(100% - 24px)', borderRadius: '12px', border: '1px solid color-mix(in srgb, var(--vyasa-primary) 28%, transparent)', background: 'color-mix(in srgb, var(--vyasa-paper) 92%, transparent)', boxShadow: '0 10px 30px rgba(0,0,0,0.12)', backdropFilter: 'blur(8px)', padding: '12px' },
                },
                    React.createElement('div', { style: { fontSize: '12px', fontWeight: 700, opacity: 0.65, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' } }, 'Node Details'),
                    React.createElement(selectedNode.href ? 'a' : 'div', selectedNode.href
                        ? { href: selectedNode.href, onClick: (e) => openTasksNodeHref(selectedNode.href, e), style: { fontSize: '14px', fontWeight: 700, lineHeight: 1.3, marginBottom: '10px', display: 'block', textDecoration: 'underline', textUnderlineOffset: '2px', color: 'inherit' } }
                        : { style: { fontSize: '14px', fontWeight: 700, lineHeight: 1.3, marginBottom: '10px' } }, selectedNode.label || selectedNode.id),
                    React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'minmax(72px, 88px) 1fr', gap: '6px 10px', fontSize: '12px', lineHeight: 1.35 } },
                        ...entries.map((entry) => React.createElement(React.Fragment, { key: entry.key },
                            React.createElement('div', { style: { fontWeight: 700, opacity: 0.7 } }, entry.label),
                            React.createElement('div', { style: { minWidth: 0, overflowWrap: 'anywhere' } }, renderTasksInlineLinks(entry.value)),
                        ))
                    )
                );
            };
            const FilterPanel = () => {
                const options = tasksFilterOptions(model);
                const colorOptions = tasksColorOptions(model);
                const activePaletteEntries = tasksColorPaletteEntries(model, activeColorBy);
                const activeCount = Object.values(activeFilters || {}).reduce((sum, value) => sum + (Array.isArray(value) ? value.length : (value ? 1 : 0)), 0) + (activeColorBy ? 1 : 0);
                return React.createElement('details', {
                    ref: filterPanelRef,
                    className: 'vyasa-tasks-filter-card',
                    open: !filtersCollapsed,
                    onToggle: (e) => setFiltersCollapsed(!e.currentTarget.open),
                    style: { position: 'absolute', top: '68px', right: '12px', zIndex: 30, width: '280px', maxWidth: 'calc(100% - 24px)', maxHeight: filtersCollapsed ? '44px' : 'min(70vh, calc(100% - 80px))', overflow: 'hidden', borderRadius: '12px', background: 'color-mix(in srgb, var(--vyasa-paper) 92%, transparent)', backdropFilter: 'blur(8px)', padding: '12px' },
                },
                    React.createElement('summary', {
                        style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', cursor: 'pointer', listStyle: 'none' },
                    },
                        React.createElement('div', { style: { fontSize: '12px', fontWeight: 700, opacity: 0.65, textTransform: 'uppercase', letterSpacing: '0.04em' } }, activeCount ? `Filters (${activeCount})` : 'Filters'),
                        React.createElement('span', { style: { fontSize: '14px', opacity: 0.7, lineHeight: 1 } }, filtersCollapsed ? '+' : '−')
                    ),
                    React.createElement('div', { style: { marginTop: '10px', marginBottom: '12px', display: 'flex', justifyContent: 'flex-end' } },
                        React.createElement('button', { type: 'button', onClick: () => { setActiveFilters({}); setActiveColorBy(''); }, style: { border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: '12px', textDecoration: 'underline' } }, 'Unselect all')
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
                                activePaletteEntries.length > 2
                                    ? React.createElement('div', { style: { flexBasis: '100%', marginTop: '4px', padding: '8px', borderRadius: '8px', background: 'color-mix(in srgb, currentColor 4%, transparent)' } },
                                        React.createElement('div', { style: { display: 'grid', gap: '4px', fontSize: '11px', lineHeight: 1.3, opacity: 0.8 } },
                                            ...activePaletteEntries.map(([value, color]) => React.createElement('div', { key: `${activeColorBy}-${value}-label`, style: { display: 'grid', gridTemplateColumns: '12px 1fr', alignItems: 'center', gap: '6px' } },
                                                React.createElement('span', { style: { width: '12px', height: '12px', borderRadius: '999px', background: color, border: '1px solid color-mix(in srgb, currentColor 20%, transparent)' } }),
                                                React.createElement('span', null, value)
                                            ))
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
                                                const nextValues = Array.isArray(current[option.key]) ? current[option.key].slice() : [];
                                                const next = e.target.checked
                                                    ? [...nextValues, value]
                                                    : nextValues.filter((entry) => entry !== value);
                                                return { ...current, [option.key]: next };
                                            }),
                                        }),
                                        React.createElement('span', { style: { opacity: 0.8 } }, value)
                                    );
                                })
                            )
                    ))
                );
            };
            const clearSelection = () => {
                setSelectedNodeId(null);
                setHoveredNodeId(null);
            };
            const clearGroupHoverTooltip = React.useCallback(() => {
                setGroupHoverTooltip(null);
            }, []);
            const updateGroupHoverTooltip = React.useCallback((event) => {
                const target = event.target instanceof Element ? event.target : null;
                const overNode = target?.closest?.('.react-flow__node');
                if (overNode && !overNode.classList.contains('vyasa-tasks-node--background')) {
                    clearGroupHoverTooltip();
                    return;
                }
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
                const hit = baseNodes
                    .filter((node) => node.data?.__kind__ === 'group' && expanded.has(node.id))
                    .map((node) => ({ node, rect: absoluteRect(node), z: Number(node.zIndex || node.style?.zIndex || 0) }))
                    .filter(({ rect }) => point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height)
                    .sort((a, b) => b.z - a.z)[0];
                if (!hit) {
                    clearGroupHoverTooltip();
                    return;
                }
                const bounds = wrapper.getBoundingClientRect();
                setGroupHoverTooltip({
                    label: hit.node.data?.label || hit.node.id,
                    x: event.clientX - bounds.left + 12,
                    y: event.clientY - bounds.top + 18,
                });
            }, [expanded, clearGroupHoverTooltip]);
            const selectGraphNode = React.useCallback((_, node) => {
                if (!isTasksGraphNodeSelectable(node.data?.__kind__, expanded.has(node.id))) {
                    clearSelection();
                    return;
                }
                const sourceNodeId = node.data?.__kind__ === 'groupTitle' ? node.data?.sourceGroupId : node.id;
                setSelectedNodeId((current) => current === sourceNodeId ? null : sourceNodeId);
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
            React.useEffect(() => () => {
                if (hoverClearTimerRef.current) window.clearTimeout(hoverClearTimerRef.current);
            }, []);
            React.useEffect(() => {
                const el = filterPanelRef.current;
                if (!el) return;
                const update = () => setFilterPanelHeight(el.getBoundingClientRect().height || 172);
                update();
                if (typeof ResizeObserver === 'undefined') return;
                const observer = new ResizeObserver(update);
                observer.observe(el);
                return () => observer.disconnect();
            }, [activeFilters, activeColorBy, filtersCollapsed, model]);
            const ActionBridge = () => {
                const reactFlow = rf.useReactFlow();
                reactFlowApiRef.current = reactFlow;
                React.useEffect(() => {
                    window.__vyasaTasksActions[widgetId] = {
                        fit: () => reactFlow.fitView({ duration: 200, padding: 0.2, includeHiddenNodes: true }),
                        dump: () => {
                            logTasksDebug('manualDump', window.__vyasaTasksDebug.latest || {});
                            return window.__vyasaTasksDebug.latest;
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
                            logTasksDebug('manualSelect', { nodeId });
                        },
                        expand: () => {
                            setExpanded(new Set((model.groups || []).map((group) => group.id)));
                        },
                        collapse: () => {
                            pendingFitActionRef.current = 'collapse';
                            setExpanded(new Set());
                        },
                        expandDepth: () => {
                            setExpanded((current) => {
                                const next = expandOneGroupDepth(model.group_tree, current);
                                logTasksDebug('manualExpandDepth', { expanded: Array.from(next) });
                                return next;
                            });
                        },
                        collapseDepth: () => {
                            pendingFitActionRef.current = 'collapse';
                            setExpanded((current) => {
                                const next = collapseOneGroupDepth(model.group_tree, current);
                                logTasksDebug('manualCollapseDepth', { expanded: Array.from(next) });
                                return next;
                            });
                        },
                    };
                    return () => {
                        delete window.__vyasaTasksActions[widgetId];
                    };
                }, [reactFlow]);
                return null;
            };
            const flowWrapperClassName = hoveredNodeId ? 'vyasa-tasks-hovering-edge-labels' : '';
            const GroupHoverTooltip = () => groupHoverTooltip && window.React.createElement('div', {
                style: {
                    position: 'absolute',
                    left: groupHoverTooltip.x,
                    top: groupHoverTooltip.y,
                    zIndex: 2400,
                    pointerEvents: 'none',
                    padding: '4px 7px',
                    borderRadius: '6px',
                    background: 'color-mix(in srgb, var(--vyasa-paper) 92%, var(--vyasa-primary) 8%)',
                    border: '1px solid color-mix(in srgb, var(--vyasa-primary) 24%, transparent)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.14)',
                    fontSize: '12px',
                    fontWeight: 650,
                    lineHeight: 1.2,
                    whiteSpace: 'nowrap',
                }
            }, groupHoverTooltip.label);
            return rf.ReactFlowProvider ? window.React.createElement(rf.ReactFlowProvider, null,
                window.React.createElement('div', { ref: flowWrapperRef, className: flowWrapperClassName, tabIndex: 0, style: { width: '100%', height: '100%', outline: 'none', position: 'relative' }, onPointerDown: () => flowWrapperRef.current?.focus({ preventScroll: true }), onPointerMove: updateGroupHoverTooltip, onPointerLeave: clearGroupHoverTooltip },
                    window.React.createElement(rf.ReactFlow, { nodes, edges, nodeTypes, edgeTypes, defaultEdgeOptions, fitView: true, minZoom: 0.05, nodesDraggable: false, elementsSelectable: false, zIndexMode: 'manual', onNodeClick: selectGraphNode, onNodeMouseEnter: focusNeighborEdge, onNodeMouseLeave: clearNeighborEdgeFocus, onPaneClick: clearSelection, onPaneContextMenu: clearSelection },
                    window.React.createElement(rf.Background),
                    window.React.createElement(rf.Controls),
                    window.React.createElement(PanControls),
                    window.React.createElement(FitViewHotkey),
                    window.React.createElement(ActionBridge)
                    ),
                    window.React.createElement(SelectedNodePanel),
                    window.React.createElement(FilterPanel),
                    window.React.createElement(GroupHoverTooltip)
                )
            ) : window.React.createElement('div', { ref: flowWrapperRef, className: flowWrapperClassName, tabIndex: 0, style: { width: '100%', height: '100%', outline: 'none', position: 'relative' }, onPointerDown: () => flowWrapperRef.current?.focus({ preventScroll: true }), onPointerMove: updateGroupHoverTooltip, onPointerLeave: clearGroupHoverTooltip },
                window.React.createElement(rf.ReactFlow, { nodes, edges, nodeTypes, edgeTypes, defaultEdgeOptions, fitView: true, minZoom: 0.05, nodesDraggable: false, elementsSelectable: false, zIndexMode: 'manual', onNodeClick: selectGraphNode, onNodeMouseEnter: focusNeighborEdge, onNodeMouseLeave: clearNeighborEdgeFocus, onPaneClick: clearSelection, onPaneContextMenu: clearSelection },
                    window.React.createElement(rf.Background),
                    window.React.createElement(rf.Controls),
                    window.React.createElement(PanControls),
                    window.React.createElement(FitViewHotkey),
                    window.React.createElement(ActionBridge)
                ),
                window.React.createElement(SelectedNodePanel),
                window.React.createElement(FilterPanel),
                window.React.createElement(GroupHoverTooltip)
            );
        };
        if (window.ReactDOM.createRoot) window.ReactDOM.createRoot(mount).render(window.React.createElement(TasksGraphApp)); else window.ReactDOM.render(window.React.createElement(TasksGraphApp), mount);
        wrapper.dataset.tasksMounted = 'true';
    }
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

window.openTasksFullscreen = async function(id) {
    const wrapper = document.getElementById(id);
    if (!wrapper) return;
    const originalTitle = wrapper.getAttribute('data-tasks-title') || 'Tasks';
    const originalPayload = wrapper.getAttribute('data-tasks-payload');
    const originalGraph = wrapper.getAttribute('data-tasks-graph');
    if (!originalPayload || !originalGraph) return;

    const existing = document.getElementById('tasks-fullscreen-modal');
    if (existing) {
        existing.remove();
    }

    const modal = document.createElement('div');
    modal.id = 'tasks-fullscreen-modal';
    modal.className = 'fixed inset-0 z-[10000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4';
    modal.style.animation = 'fadeIn 0.2s ease-in';

    const modalContent = document.createElement('div');
    modalContent.className = 'relative bg-white dark:bg-slate-900 rounded-lg shadow-2xl w-full h-full max-w-[95vw] max-h-[95vh] flex flex-col';

    const header = document.createElement('div');
    header.className = 'flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700';

    const title = document.createElement('h3');
    title.className = 'text-lg font-semibold text-slate-800 dark:text-slate-200';
    title.textContent = originalTitle;

    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '✕';
    closeBtn.className = 'px-3 py-1 text-xl text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors';
    closeBtn.title = 'Close (Esc)';
    closeBtn.onclick = () => document.body.removeChild(modal);

    header.appendChild(title);
    header.appendChild(closeBtn);

    const body = document.createElement('div');
    body.className = 'flex-1 overflow-hidden p-4';

    const fullscreenWrapper = document.createElement('div');
    fullscreenWrapper.id = `${id}-fullscreen`;
    fullscreenWrapper.className = 'tasks-container relative w-full h-full rounded-xl border-4 border-slate-200 dark:border-slate-800';
    fullscreenWrapper.setAttribute('data-tasks-widget', 'true');
    fullscreenWrapper.setAttribute('data-tasks-fullscreen', 'true');
    fullscreenWrapper.setAttribute('data-tasks-title', originalTitle);
    fullscreenWrapper.setAttribute('data-tasks-default-open-depth', wrapper.getAttribute('data-tasks-default-open-depth') || '0');
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
    const headerBar = document.createElement('div');
    headerBar.className = 'px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3';
    const headerTitle = document.createElement('div');
    headerTitle.className = 'text-sm font-semibold flex items-center gap-3 min-w-0';
    const headerName = document.createElement('span');
    headerName.className = 'truncate';
    headerName.textContent = originalTitle;
    const headerHints = document.createElement('div');
    headerHints.className = 'flex items-center gap-1 text-[11px] font-medium tracking-wide text-slate-500 dark:text-slate-400 whitespace-nowrap';
    const makeHint = (text) => {
        const kbd = document.createElement('kbd');
        kbd.textContent = text;
        kbd.className = 'rounded border border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] leading-none text-slate-700 dark:text-slate-300';
        return kbd;
    };
    const fitHint = makeHint('F');
    fitHint.title = 'Fit view';
    const expandHint = makeHint('I');
    expandHint.title = 'Expand next group depth';
    const collapseHint = makeHint('O');
    collapseHint.title = 'Collapse deepest group depth';
    const expandAllHint = makeHint('U');
    expandAllHint.title = 'Unfold all groups';
    const collapseAllHint = makeHint('P');
    collapseAllHint.title = 'Collapse all groups';
    headerHints.append(fitHint, expandHint, collapseHint, expandAllHint, collapseAllHint);
    headerTitle.append(headerName, headerHints);
    headerBar.appendChild(headerTitle);

    const flow = document.createElement('div');
    flow.className = 'vyasa-tasks-flow';
    flow.style.height = 'calc(100% - 57px)';
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
    modalContent.appendChild(header);
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
};

window.__vyasaRenderTasksGraphs = renderTasksGraphs;
document.addEventListener('DOMContentLoaded', () => { renderTasksGraphs(document); });
document.body.addEventListener('htmx:afterSwap', (event) => { renderTasksGraphs(event.target || document); });
