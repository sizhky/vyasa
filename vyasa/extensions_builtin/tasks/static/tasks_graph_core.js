
// The shared viewport owns the gesture binder; KG re-exports only what it uses.
export { clampScale, nextWheelState } from '../../../static/viewport_core.js';

export function tasksReviewTarget(data, id, widgetId) {
    const sourceNodeId = data?.__kind__ === 'groupTitle' ? data?.sourceGroupId : id;
    return {
        kind: 'node',
        id: sourceNodeId,
        label: String(data?.label || sourceNodeId).slice(0, 240),
        node_kind: data?.__kind__ || '',
        widget_id: widgetId,
    };
}

export function tasksCenteredViewport(viewport, canvasRect, nodeRect) {
    return {
        x: viewport.x + canvasRect.left + canvasRect.width / 2 - nodeRect.left - nodeRect.width / 2,
        y: viewport.y + canvasRect.top + canvasRect.height / 2 - nodeRect.top - nodeRect.height / 2,
        zoom: viewport.zoom,
    };
}

export function tasksGraphDynamicMinZoom(nodes, viewportRect, options = {}) {
    const baseMinZoom = Math.max(0.001, Number(options.baseMinZoom) || 0.05);
    const targetViewportFraction = Math.max(0.05, Math.min(1, Number(options.targetViewportFraction) || 0.5));
    const viewportWidth = Math.max(1, Number(viewportRect?.width) || 0);
    const viewportHeight = Math.max(1, Number(viewportRect?.height) || 0);
    const graphNodes = Array.isArray(nodes) ? nodes.filter(Boolean) : [];
    if (!graphNodes.length) return baseMinZoom;
    const byId = Object.fromEntries(graphNodes.map((node) => [node.id, node]));
    const bounds = graphNodes.reduce((acc, node) => {
        const box = tasksGraphNodeAbsoluteRect(node, byId);
        return {
            left: Math.min(acc.left, box.left),
            right: Math.max(acc.right, box.right),
            top: Math.min(acc.top, box.top),
            bottom: Math.max(acc.bottom, box.bottom),
        };
    }, { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity });
    const graphWidth = Math.max(1, bounds.right - bounds.left);
    const graphHeight = Math.max(1, bounds.bottom - bounds.top);
    const fitZoom = Math.min((viewportWidth * targetViewportFraction) / graphWidth, (viewportHeight * targetViewportFraction) / graphHeight);
    return Math.min(baseMinZoom, Math.max(0.001, fitZoom));
}

const TASK_NODE_FONT = '600 16px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const TASK_NODE_SPECS = {
    group: { width: 250, minHeight: 80, padX: 32, padY: 28, reserveX: 34 },
    groupTitle: { width: 250, minHeight: 34, padX: 20, padY: 8, reserveX: 28 },
    task: { width: 220, minHeight: 60, padX: 28, padY: 24, reserveX: 0 },
};
const TASK_NODE_IMAGE_SPECS = {
    group: { size: 30, gap: 10 },
    groupTitle: { size: 20, gap: 7 },
    task: { size: 28, gap: 10 },
};

export function measureTextWidth(text, font = TASK_NODE_FONT) {
    const canvas = typeof OffscreenCanvas !== 'undefined'
        ? new OffscreenCanvas(1, 1)
        : (typeof document !== 'undefined' ? document.createElement('canvas') : null);
    const ctx = canvas?.getContext?.('2d');
    if (!ctx) return text.length * 7.1;
    ctx.font = font;
    return ctx.measureText(text).width;
}

export function tasksInlineLinkPlainText(value, nodeLabels = {}) {
    return String(value || '')
        .replace(/\[\[([^\]|\n]+)(?:\|([^\]\n]+))?\]\]/g, (_match, target, display) => display || nodeLabels[String(target).trim()] || String(target).trim())
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
        .replace(/`([^`\n]+)`/g, '$1');
}

export function sizeTaskNode(label, kind = 'task', widthOverride = null, options = {}) {
    const spec = TASK_NODE_SPECS[kind] || TASK_NODE_SPECS.task;
    const width = Math.max(32, Number(widthOverride || spec.width));
    // An outline task node draws a mono title and its subtitle, so it is sized
    // with the metrics it is drawn with.
    if (kind === 'task' && TASKS_FIGURE_LOOKS.includes(options?.look)) {
        const size = tasksOutlineNodeSize(label, options.subtitle, width);
        // A header tab adds its band and its [kind] line above the subtitle.
        return options.look === 'tab' ? { width, height: size.height + 22 } : size;
    }
    // A station is a dot with its label above it; the box only holds the label.
    if (kind === 'task' && options?.look === 'station') return { width, height: 48 };
    const imageSpec = options?.hasImage ? (TASK_NODE_IMAGE_SPECS[kind] || TASK_NODE_IMAGE_SPECS.task) : null;
    const imageReserve = imageSpec ? imageSpec.size + imageSpec.gap : 0;
    const maxTextWidth = Math.max(32, width - spec.padX - spec.reserveX - imageReserve - 8);
    const widthBias = options?.hasImage ? 1.18 : 1.12;
    const lines = tasksInlineLinkPlainText(label, options?.nodeLabels)
        .split(/\r?\n/)
        .reduce((count, part) => count + Math.max(1, Math.ceil((measureTextWidth(part) * widthBias) / maxTextWidth)), 0);
    const textHeight = Math.max(24, lines * 21);
    const contentHeight = Math.max(textHeight, imageSpec?.size || 0);
    return {
        width,
        height: Math.max(spec.minHeight, Math.ceil(contentHeight + spec.padY + 8)),
    };
}

// Outline node type metrics. The renderer draws with these and the layout sizes
// with them, so a box always fits its text.
export const TASKS_OUTLINE_FONT = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
export const TASKS_OUTLINE_TITLE_FONT_SIZE = 14;
export const TASKS_OUTLINE_SUBTITLE_FONT_SIZE = 11;
const TASKS_OUTLINE_CHAR_EM = 0.62;
const TASKS_OUTLINE_PAD = { x: 28, y: 22 };

/**
 * Height of an outline node: wrapped mono title plus wrapped subtitle.
 *
 * >>> tasksOutlineNodeSize('Gate', '', 220)
 * { width: 220, height: 44 }
 * >>> tasksOutlineNodeSize('1 · Gate', 'anchored? judged? generic? duplicate?', 220).height
 * 73
 */
export function tasksOutlineNodeSize(title, subtitle, width) {
    const textWidth = Math.max(40, width - TASKS_OUTLINE_PAD.x);
    const lines = (text, size) => String(text || '').split(/\r?\n/).filter(Boolean)
        .reduce((count, part) => count + Math.max(1, Math.ceil((part.length * size * TASKS_OUTLINE_CHAR_EM) / textWidth)), 0);
    const titleHeight = Math.max(1, lines(title, TASKS_OUTLINE_TITLE_FONT_SIZE)) * TASKS_OUTLINE_TITLE_FONT_SIZE * 1.3;
    const subtitleLines = lines(subtitle, TASKS_OUTLINE_SUBTITLE_FONT_SIZE);
    const subtitleHeight = subtitleLines ? 3 + subtitleLines * TASKS_OUTLINE_SUBTITLE_FONT_SIZE * 1.35 : 0;
    return { width, height: Math.max(44, Math.ceil(titleHeight + subtitleHeight + TASKS_OUTLINE_PAD.y)) };
}

export function isTasksGraphNodeSelectable(kind, isExpanded = false) {
    return tasksGraphNodeHitArea(kind, isExpanded) !== 'passive';
}

export function tasksGraphNodeAllowsHover(node, allowDimmed = false) {
    return allowDimmed || node?.data?.highlightMode !== 'dim';
}

export function tasksGraphNodeHitArea(kind, isExpanded = false) {
    if (kind === 'task') return 'selectable';
    if (kind === 'groupTitle') return 'control';
    if (kind === 'group') return 'selectable';
    if (kind === 'sequenceFragment' || kind === 'sequenceActivation') return 'selectable';
    return 'passive';
}

export function tasksExpandedRootRect(baseRect, expandedSize = {}) {
    const x = Number(baseRect?.x) || 0;
    const y = Number(baseRect?.y) || 0;
    const baseWidth = Math.max(1, Number(baseRect?.width) || 1);
    const baseHeight = Math.max(1, Number(baseRect?.height) || 1);
    const width = Math.max(baseWidth, Number(expandedSize?.width) || baseWidth);
    const height = Math.max(baseHeight, Number(expandedSize?.height) || baseHeight);
    return {
        x,
        y,
        width,
        height,
        baseWidth,
        baseHeight,
    };
}

export function tasksGraphNodeAbsoluteRect(node, byId) {
    let x = Number(node?.position?.x) || 0;
    let y = Number(node?.position?.y) || 0;
    let parent = node?.parentId ? byId[node.parentId] : null;
    while (parent) {
        x += Number(parent?.position?.x) || 0;
        y += Number(parent?.position?.y) || 0;
        parent = parent?.parentId ? byId[parent.parentId] : null;
    }
    const width = Number(node?.style?.width ?? node?.width) || 0;
    const height = Number(node?.style?.height ?? node?.height) || 0;
    return { x, y, width, height, left: x, right: x + width, top: y, bottom: y + height };
}

function tasksGraphSelectionNodeRect(node, byId) {
    if (node?.data?.__kind__ !== 'groupTitle') return tasksGraphNodeAbsoluteRect(node, byId);
    const sourceGroup = byId[String(node.data?.sourceGroupId || '')];
    return sourceGroup ? tasksGraphNodeAbsoluteRect(sourceGroup, byId) : tasksGraphNodeAbsoluteRect(node, byId);
}

function tasksGraphSelectionNodeId(node) {
    return node?.data?.__kind__ === 'groupTitle' ? node.data?.sourceGroupId : node?.id;
}

export function selectTasksGraphNodeIdsInRect(nodes, rect) {
    const bounds = {
        left: Math.min(Number(rect?.x1) || 0, Number(rect?.x2) || 0),
        right: Math.max(Number(rect?.x1) || 0, Number(rect?.x2) || 0),
        top: Math.min(Number(rect?.y1) || 0, Number(rect?.y2) || 0),
        bottom: Math.max(Number(rect?.y1) || 0, Number(rect?.y2) || 0),
    };
    const byId = Object.fromEntries((nodes || []).map((node) => [node.id, node]));
    const ids = (nodes || []).filter((node) => {
        if (node?.data?.__kind__ !== 'task' && node?.data?.__kind__ !== 'group' && node?.data?.__kind__ !== 'groupTitle') return false;
        const box = tasksGraphSelectionNodeRect(node, byId);
        return box.left >= bounds.left && box.right <= bounds.right && box.top >= bounds.top && box.bottom <= bounds.bottom;
    }).map(tasksGraphSelectionNodeId).filter(Boolean);
    return Array.from(new Set(ids));
}

function pointInPolygon(point, polygon) {
    let inside = false;
    for (let index = 0, prev = polygon.length - 1; index < polygon.length; prev = index, index += 1) {
        const xi = Number(polygon[index]?.x) || 0;
        const yi = Number(polygon[index]?.y) || 0;
        const xj = Number(polygon[prev]?.x) || 0;
        const yj = Number(polygon[prev]?.y) || 0;
        const intersects = ((yi > point.y) !== (yj > point.y))
            && (point.x < ((xj - xi) * (point.y - yi)) / ((yj - yi) || Number.EPSILON) + xi);
        if (intersects) inside = !inside;
    }
    return inside;
}

export function selectTasksGraphNodeIdsInPolygon(nodes, points) {
    const polygon = Array.isArray(points) ? points.filter((point) => Number.isFinite(point?.x) && Number.isFinite(point?.y)) : [];
    if (polygon.length < 3) return [];
    const byId = Object.fromEntries((nodes || []).map((node) => [node.id, node]));
    const ids = (nodes || []).filter((node) => {
        if (node?.data?.__kind__ !== 'task' && node?.data?.__kind__ !== 'group' && node?.data?.__kind__ !== 'groupTitle') return false;
        const box = tasksGraphSelectionNodeRect(node, byId);
        return [
            { x: box.left, y: box.top },
            { x: box.right, y: box.top },
            { x: box.right, y: box.bottom },
            { x: box.left, y: box.bottom },
        ].every((point) => pointInPolygon(point, polygon));
    }).map(tasksGraphSelectionNodeId).filter(Boolean);
    return Array.from(new Set(ids));
}

export function tasksGraphStatsLabel(model) {
    const nodeCount = (Array.isArray(model?.groups) ? model.groups.length : 0)
        + (Array.isArray(model?.tasks) ? model.tasks.length : 0);
    const edgeCount = Array.isArray(model?.dependency_edges) ? model.dependency_edges.length : 0;
    const nodeLabel = nodeCount === 1 ? 'Node' : 'Nodes';
    const edgeLabel = edgeCount === 1 ? 'Edge' : 'Edges';
    return `${nodeCount} ${nodeLabel} and ${edgeCount} ${edgeLabel}`;
}

export function tasksProjectionGroupByHierarchy(sourceModel, projectionId) {
    const id = String(projectionId || '').trim();
    const projections = Array.isArray(sourceModel?.view_projections) ? sourceModel.view_projections : [];
    const projection = projections.find((item) => String(item?.id || '').trim() === id);
    return Array.isArray(projection?.groups_from)
        ? projection.groups_from.map((key) => String(key || '').trim()).filter(Boolean)
        : [];
}

export function tasksViewMatchesContext(projection, activeContextId) {
    const active = String(activeContextId || '').trim();
    if (!active) return true;
    const resolved = String(projection?.resolved_context || '').trim();
    return !resolved || resolved === active;
}

export function tasksUngroupModelForGrouping(sourceModel) {
    const projectedToSource = new Map();
    const tasksBySource = new Map();
    for (const task of sourceModel?.tasks || []) {
        const sourceId = String(task?.__source_node_id || task?.id || '').trim();
        if (!sourceId) continue;
        projectedToSource.set(task.id, sourceId);
        if (!tasksBySource.has(sourceId)) tasksBySource.set(sourceId, { ...task, id: sourceId, group_id: null });
    }
    const dependencyEdges = [];
    const seenEdges = new Set();
    for (const edge of sourceModel?.dependency_edges || []) {
        const source = projectedToSource.get(edge.source) || edge.source;
        const target = projectedToSource.get(edge.target) || edge.target;
        if (!tasksBySource.has(source) || !tasksBySource.has(target)) continue;
        const id = String(edge.__source_edge_id || edge.id || `${source}-${target}`);
        const key = `${id}\u001f${source}\u001f${target}`;
        if (seenEdges.has(key)) continue;
        seenEdges.add(key);
        dependencyEdges.push({ ...edge, id, source, target });
    }
    const tasks = Array.from(tasksBySource.values());
    return {
        ...sourceModel,
        groups: [],
        tasks,
        dependency_edges: dependencyEdges,
        group_tree: { null: [] },
        task_children: { null: tasks.map((task) => task.id) },
        document_order: tasks.map((task) => task.id),
        default_open_depth: -1,
    };
}

export function isTasksUnspecifiedProjectionGroup(node, unspecifiedLabel = 'Unspecified') {
    if (!node || node.__projection_group__ !== true) return false;
    const label = String(unspecifiedLabel || 'Unspecified').trim() || 'Unspecified';
    if (String(node.label || '').trim().endsWith(`> ${label}`)) return true;
    return Object.entries(node).some(([key, value]) => (
        !String(key || '').startsWith('__')
        && !['id', 'label', 'parent_group_id', 'projection'].includes(String(key || ''))
        && String(value || '').trim() === label
    ));
}

export function toggleMultiValueFilter(filters, key, value, enabled) {
    const filterKey = String(key || '').trim();
    const filterValue = String(value || '').trim();
    if (!filterKey || !filterValue) return { ...(filters || {}) };
    const next = { ...(filters || {}) };
    const currentValues = Array.isArray(next[filterKey])
        ? next[filterKey].map((entry) => String(entry || '').trim()).filter(Boolean)
        : [];
    const valueSet = new Set(currentValues);
    if (enabled) valueSet.add(filterValue);
    else valueSet.delete(filterValue);
    const values = Array.from(valueSet);
    if (values.length > 0) next[filterKey] = values;
    else delete next[filterKey];
    return next;
}

export function tasksImagePaletteFor(model, imageBy) {
    const key = String(imageBy || '').trim();
    if (!key) return {};
    const palettes = model?.node_image_palettes && typeof model.node_image_palettes === 'object'
        ? model.node_image_palettes
        : {};
    const configuredPalette = palettes[key];
    return configuredPalette && typeof configuredPalette === 'object' ? configuredPalette : {};
}

export function normalizeTasksNodeImageUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (raw.startsWith('iconify:')) {
        const parts = raw.split(':').map((part) => part.trim()).filter(Boolean);
        if (parts.length < 3) return '';
        const prefix = encodeURIComponent(parts[1]);
        const name = encodeURIComponent(parts.slice(2).join('-'));
        return `https://api.iconify.design/${prefix}/${name}.svg`;
    }
    if (/^https?:\/\//i.test(raw)) return raw;
    if (raw.startsWith('/') || raw.startsWith('./') || raw.startsWith('../')) return raw;
    return '';
}

function tasksNodeImagePaletteValues(value) {
    const values = Array.isArray(value) ? value : [value];
    return Array.from(new Set(values
        .filter((entry) => typeof entry === 'string' || typeof entry === 'number' || typeof entry === 'boolean')
        .map((entry) => String(entry ?? '').trim())
        .filter(Boolean)));
}

function tasksIsMdiImage(value) {
    const raw = String(value || '').trim();
    const normalized = normalizeTasksNodeImageUrl(raw);
    return raw.startsWith('iconify:mdi:') || /^https:\/\/api\.iconify\.design\/mdi\/[^/]+\.svg(?:\?.*)?$/i.test(normalized);
}

export function tasksIconFilterGroups(model) {
    const palettes = model?.node_image_palettes && typeof model.node_image_palettes === 'object'
        ? model.node_image_palettes
        : {};
    const nodes = [...(model?.groups || []), ...(model?.tasks || [])];
    return Object.entries(palettes)
        .map(([key, palette]) => {
            const attr = String(key || '').trim();
            if (!attr || !palette || typeof palette !== 'object') return null;
            const presentValues = new Set(nodes.flatMap((node) => tasksNodeImagePaletteValues(node?.[attr])));
            const entries = Object.entries(palette)
                .map(([value, image]) => [String(value || '').trim(), String(image || '').trim()])
                .filter(([value, image]) => value && presentValues.has(value) && tasksIsMdiImage(image))
                .map(([value, image]) => [value, normalizeTasksNodeImageUrl(image)])
                .filter(([, image]) => image)
                .sort(([left], [right]) => left.localeCompare(right));
            return entries.length ? { key: attr, entries } : null;
        })
        .filter(Boolean)
        .sort((left, right) => left.key.localeCompare(right.key));
}

function normalizeStoredNodeNotes(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value)
        .map(([nodeId, note]) => [String(nodeId || '').trim(), String(note || '')])
        .filter(([nodeId, note]) => nodeId && note.trim()));
}

function normalizeStoredNodeStates(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value)
        .map(([nodeId, state]) => [String(nodeId || '').trim(), String(state || '').trim()])
        .filter(([nodeId, state]) => nodeId && state));
}

function normalizeStoredSlideNotes(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value)
        .map(([slideId, note]) => [String(slideId || '').trim(), String(note || '')])
        .filter(([slideId, note]) => slideId && note.trim()));
}

export function collectTasksStoredNotes(storage, storageKey, nodeTitles = {}, slideTitles = {}) {
    const prefs = JSON.parse(storage.getItem(storageKey) || '{}');
    const nodeNotes = normalizeStoredNodeNotes(prefs?.nodeNotes);
    const slideNotes = normalizeStoredSlideNotes(prefs?.slideNotes);
    const nodeStates = normalizeStoredNodeStates(prefs?.nodeStates);
    const nodeIds = Array.from(new Set([...Object.keys(nodeNotes), ...Object.keys(nodeStates)]));
    const slideIds = Object.keys(slideNotes);
    const nodeStanzas = nodeIds.map((nodeId) => {
        const state = nodeStates[nodeId] ? ` [${nodeStates[nodeId]}]` : '';
        const title = String(nodeTitles[nodeId] || '').trim();
        const header = `@ node ${nodeId}${state}${title && title !== nodeId ? ` ${title}` : ''}`;
        const note = nodeNotes[nodeId];
        return note ? `${header}\n${note.split('\n').map((line) => `  ${line}`).join('\n')}` : header;
    });
    const slideStanzas = slideIds.map((slideId) => {
        const title = String(slideTitles[slideId] || '').trim();
        const header = `@ slide ${slideId}${title && title !== slideId ? ` ${title}` : ''}`;
        return `${header}\n${slideNotes[slideId].split('\n').map((line) => `  ${line}`).join('\n')}`;
    });
    const stanzas = [...nodeStanzas, ...slideStanzas];
    return `vyasa-notes 4\n${stanzas.length ? `\n${stanzas.join('\n\n')}\n` : ''}`;
}

export function importTasksStoredNotes(storage, storageKey, backup) {
    const lines = String(backup || '').replace(/\r\n?/g, '\n').split('\n');
    if (lines.shift()?.trim() !== 'vyasa-notes 4') {
        throw new Error('Invalid Vyasa Knowledge Graph notes backup.');
    }
    const imported = {};
    const importedSlides = {};
    const importedStates = {};
    let current = null;
    let currentKind = 'node';
    for (const line of lines) {
        const header = line.match(/^@\s+(?:(node|slide)\s+)?(\S+)(?:\s+\[([^\]]+)\])?(?:\s+.*)?$/);
        if (header) {
            currentKind = header[1] === 'slide' ? 'slide' : 'node';
            current = header[2];
            if (currentKind === 'node' && header[3]?.trim()) importedStates[current] = header[3].trim();
        } else if (!line.trim() || line.startsWith('  ')) {
            if (current !== null) {
                const bucket = currentKind === 'slide' ? importedSlides : imported;
                bucket[current] = `${bucket[current] ? `${bucket[current]}\n` : ''}${line.slice(0, 2) === '  ' ? line.slice(2) : ''}`;
            }
        } else {
            throw new Error('Invalid Vyasa Knowledge Graph notes backup.');
        }
    }
    for (const nodeId of Object.keys(imported)) imported[nodeId] = imported[nodeId].replace(/\n+$/, '');
    for (const slideId of Object.keys(importedSlides)) importedSlides[slideId] = importedSlides[slideId].replace(/\n+$/, '');
    const currentPrefs = JSON.parse(storage.getItem(storageKey) || '{}');
    const nodeNotes = normalizeStoredNodeNotes(imported);
    const slideNotes = normalizeStoredSlideNotes(importedSlides);
    const nodeStates = normalizeStoredNodeStates(importedStates);
    currentPrefs.nodeNotes = { ...normalizeStoredNodeNotes(currentPrefs.nodeNotes), ...nodeNotes };
    currentPrefs.slideNotes = { ...normalizeStoredSlideNotes(currentPrefs.slideNotes), ...slideNotes };
    currentPrefs.nodeStates = { ...normalizeStoredNodeStates(currentPrefs.nodeStates), ...nodeStates };
    storage.setItem(storageKey, JSON.stringify(currentPrefs));
    return Object.keys(nodeNotes).length + Object.keys(slideNotes).length + Object.keys(nodeStates).length;
}

export function resolveTasksNodeImage(node, model, imageByOverride = null, paletteOverride = null) {
    if (!node) return '';
    const ownImage = normalizeTasksNodeImageUrl(node.image);
    if (ownImage) return ownImage;
    const imageBy = imageByOverride !== null
        ? String(imageByOverride || '').trim()
        : (typeof model?.image_by === 'string' ? model.image_by.trim() : '');
    if (!imageBy) return '';
    const palette = paletteOverride && typeof paletteOverride === 'object'
        ? paletteOverride
        : tasksImagePaletteFor(model, imageBy);
    const value = node[imageBy];
    if (value === null || value === undefined || String(value).trim() === '') return '';
    return normalizeTasksNodeImageUrl(palette[String(value)]);
}

export function isTasksEdgeInternalToSelection(edge, selectedNodeIds) {
    if (!edge || !(selectedNodeIds instanceof Set)) return false;
    return selectedNodeIds.has(edge.source) && selectedNodeIds.has(edge.target);
}

export function isTasksEdgeLabelHoverDimmingActive(selectedNodeId, hoveredNodeId) {
    const selected = String(selectedNodeId || '').trim();
    const hovered = String(hoveredNodeId || '').trim();
    return Boolean(selected && hovered && selected !== hovered);
}

export function isTasksEdgeLabelVisible(mode, hoverDimmingActive = false) {
    if (mode === 'dim' || mode === 'none') return false;
    if (!hoverDimmingActive) return true;
    return mode === 'focused-in' || mode === 'focused-out';
}

export function tasksEdgeLabelZForMode(mode, baseZ, selectedZ, focusZ) {
    if (mode === 'focused-in' || mode === 'focused-out') return focusZ;
    if (mode === 'selected') return selectedZ;
    return baseZ;
}

export function applyTasksFilterAttributePolicy(keys, model) {
    const candidates = Array.isArray(keys)
        ? keys.map((key) => String(key || '').trim()).filter(Boolean)
        : [];
    const whitelistSource = Array.isArray(model?.filter_whitelist) && model.filter_whitelist.length
        ? model.filter_whitelist
        : null;
    const whitelist = Array.isArray(whitelistSource) && whitelistSource.length
        ? new Set(whitelistSource.map((key) => String(key || '').trim()).filter(Boolean))
        : null;
    const blacklist = new Set(
        Array.isArray(model?.filter_blacklist)
            ? model.filter_blacklist.map((key) => String(key || '').trim()).filter(Boolean)
            : []
    );
    return candidates.filter((key) => {
        if (whitelist && !whitelist.has(key)) return false;
        return !blacklist.has(key);
    });
}

export function layoutDisconnectedTaskNodes(nodes, direction = 'DOWN', options = {}) {
    const orderedNodes = Array.isArray(nodes) ? nodes : [];
    const gap = Math.max(0, Number(options.gap) || 0);
    const padX = Math.max(0, Number(options.padX) || 0);
    const padTop = Math.max(0, Number(options.padTop) || 0);
    const padBottom = Math.max(0, Number(options.padBottom) || 0);
    const targetAspectRatio = Math.max(0.25, Number(options.targetAspectRatio) || 1.05);
    const positions = {};
    const sizedNodes = orderedNodes.map((node) => ({
        id: node?.id,
        width: Math.max(0, Number(node?.width) || 0),
        height: Math.max(0, Number(node?.height) || 0),
    })).filter((node) => node.id !== undefined && node.id !== null);

    if (sizedNodes.length === 0) {
        return {
            positions,
            bbox: {
                width: padX * 2,
                height: padTop + padBottom,
            },
        };
    }

    const measureGrid = (columnCount) => {
        const columns = Math.max(1, Math.min(sizedNodes.length, columnCount));
        const columnWidths = Array(columns).fill(0);
        const rowHeights = [];
        for (let index = 0; index < sizedNodes.length; index += 1) {
            const column = index % columns;
            const row = Math.floor(index / columns);
            columnWidths[column] = Math.max(columnWidths[column], sizedNodes[index].width);
            rowHeights[row] = Math.max(rowHeights[row] || 0, sizedNodes[index].height);
        }
        const contentWidth = columnWidths.reduce((sum, width) => sum + width, 0) + gap * Math.max(0, columns - 1);
        const contentHeight = rowHeights.reduce((sum, height) => sum + height, 0) + gap * Math.max(0, rowHeights.length - 1);
        const fullWidth = contentWidth + padX * 2;
        const fullHeight = contentHeight + padTop + padBottom;
        const aspect = fullWidth / Math.max(fullHeight, 1);
        return {
            columns,
            columnWidths,
            rowHeights,
            contentWidth,
            contentHeight,
            fullWidth,
            fullHeight,
            score: Math.abs(Math.log(aspect / targetAspectRatio)) + columns * 0.0001,
        };
    };

    let best = measureGrid(1);
    for (let columns = 2; columns <= sizedNodes.length; columns += 1) {
        const candidate = measureGrid(columns);
        if (candidate.score < best.score) best = candidate;
    }

    const columnOffsets = [];
    let cursorX = padX;
    for (const width of best.columnWidths) {
        columnOffsets.push(cursorX);
        cursorX += width + gap;
    }
    const rowOffsets = [];
    let cursorY = padTop;
    for (const height of best.rowHeights) {
        rowOffsets.push(cursorY);
        cursorY += height + gap;
    }
    for (let index = 0; index < sizedNodes.length; index += 1) {
        const node = sizedNodes[index];
        const column = index % best.columns;
        const row = Math.floor(index / best.columns);
        positions[node.id] = {
            x: columnOffsets[column],
            y: rowOffsets[row],
            width: node.width,
            height: node.height,
        };
    }
    return {
        positions,
        bbox: {
            width: best.fullWidth,
            height: best.fullHeight,
        },
    };
}

export function packTaskChildRects(inputPositions, options = {}) {
    const gap = Math.max(0, Number(options.gap) || 0);
    const padX = Math.max(0, Number(options.padX) || 0);
    const padTop = Math.max(0, Number(options.padTop) || 0);
    const padBottom = Math.max(0, Number(options.padBottom) || 0);
    const targetAspectRatio = Math.max(0.5, Number(options.targetAspectRatio) || 1.05);
    const sourceRects = Object.fromEntries(
        Object.entries(inputPositions || {}).map(([id, rect]) => [id, {
            width: Math.max(0, Number(rect?.width) || 0),
            height: Math.max(0, Number(rect?.height) || 0),
        }])
    );
    const requestedOrder = Array.isArray(options.order) ? options.order.map(String) : [];
    const seenIds = new Set();
    const orderedIds = [];
    for (const id of [...requestedOrder, ...Object.keys(sourceRects)]) {
        if (!sourceRects[id] || seenIds.has(id)) continue;
        seenIds.add(id);
        orderedIds.push(id);
    }
    if (!orderedIds.length) {
        return {
            positions: {},
            bbox: {
                width: Math.max(Number(options.minWidth) || 0, padX * 2),
                height: Math.max(Number(options.minHeight) || 0, padTop + padBottom),
            },
            rows: [],
        };
    }
    const rowWidth = (row) => row.reduce(
        (sum, id, index) => sum + sourceRects[id].width + (index ? gap : 0),
        0
    );
    const bandIndex = new Map();
    const requestedBands = Array.isArray(options.bands) ? options.bands : [];
    requestedBands.forEach((band, index) => {
        for (const id of (Array.isArray(band) ? band : [])) bandIndex.set(String(id), index);
    });
    const bandCount = Math.max(1, requestedBands.length);
    const bands = Array.from({ length: bandCount }, () => []);
    for (const id of orderedIds) bands[bandIndex.get(id) ?? 0].push(id);
    const filledBands = bands.filter((band) => band.length);
    const packAtWidth = (targetWidth) => {
        const rows = [];
        let currentWidth = 0;
        for (const band of filledBands) {
            // Bands hold the top-to-bottom order, but a band small enough to sit
            // beside the one before it shares that row instead of adding a new one.
            // Without this a long chain of one-child bands draws as a tall column.
            const previousRow = rows[rows.length - 1];
            let bandStart = rows.length - 1;
            if (!previousRow?.length || currentWidth + gap + rowWidth(band) > targetWidth) {
                bandStart = rows.length;
                rows.push([]);
                currentWidth = 0;
            }
            for (const id of band) {
                const row = rows[rows.length - 1];
                const nextWidth = currentWidth + (row.length ? gap : 0) + sourceRects[id].width;
                if (row.length && nextWidth > targetWidth) {
                    rows.push([id]);
                    currentWidth = sourceRects[id].width;
                } else {
                    row.push(id);
                    currentWidth = nextWidth;
                }
            }
            for (let pass = bandStart; pass < rows.length; pass += 1) {
                for (let index = rows.length - 1; index > bandStart; index -= 1) {
                    const previous = rows[index - 1];
                    const current = rows[index];
                    while (previous.length > current.length + 1) {
                        const moving = previous[previous.length - 1];
                        const nextCurrent = [moving, ...current];
                        const beforeWidth = Math.max(rowWidth(previous), rowWidth(current));
                        const afterWidth = Math.max(rowWidth(previous.slice(0, -1)), rowWidth(nextCurrent));
                        if (rowWidth(nextCurrent) > targetWidth || afterWidth > beforeWidth) break;
                        previous.pop();
                        current.unshift(moving);
                    }
                }
            }
        }
        const rowMetrics = rows.map((row) => ({
            width: rowWidth(row),
            height: Math.max(...row.map((id) => sourceRects[id].height)),
        }));
        const contentWidth = Math.max(...rowMetrics.map((row) => row.width));
        const positions = {};
        let y = padTop;
        for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
            const row = rows[rowIndex];
            const metrics = rowMetrics[rowIndex];
            let x = padX + (contentWidth - metrics.width) / 2;
            for (const id of row) {
                const rect = sourceRects[id];
                positions[id] = { x, y, width: rect.width, height: rect.height };
                x += rect.width + gap;
            }
            y += metrics.height + gap;
        }
        const contentHeight = y - gap - padTop;
        const width = Math.max(Number(options.minWidth) || 0, contentWidth + padX * 2);
        const height = Math.max(Number(options.minHeight) || 0, contentHeight + padTop + padBottom);
        const itemArea = orderedIds.reduce(
            (sum, id) => sum + sourceRects[id].width * sourceRects[id].height,
            0
        );
        const fill = itemArea / Math.max(width * height, 1);
        const aspectPenalty = Math.abs(Math.log((width / Math.max(height, 1)) / targetAspectRatio));
        return {
            positions,
            bbox: { width, height },
            rows: rows.map((row) => [...row]),
            score: aspectPenalty * 2 + (1 - fill) * 0.65,
        };
    };
    const maxWidth = Math.max(...orderedIds.map((id) => sourceRects[id].width));
    const averageOuterWidth = orderedIds.reduce(
        (sum, id) => sum + sourceRects[id].width + gap,
        0
    ) / orderedIds.length;
    const paddedArea = orderedIds.reduce(
        (sum, id) => sum + (sourceRects[id].width + gap) * (sourceRects[id].height + gap),
        0
    );
    const squareWidth = Math.sqrt(paddedArea * targetAspectRatio);
    const targetWidths = new Set([maxWidth]);
    const maxColumns = Math.min(
        orderedIds.length,
        Math.max(12, Math.ceil(Math.sqrt(orderedIds.length) * 3))
    );
    for (let columns = 1; columns <= maxColumns; columns += 1) {
        targetWidths.add(Math.max(maxWidth, averageOuterWidth * columns - gap));
    }
    for (let step = 0; step <= 12; step += 1) {
        targetWidths.add(Math.max(maxWidth, squareWidth * (0.55 + step * 0.125)));
    }
    return Array.from(targetWidths)
        .map(packAtWidth)
        .sort((left, right) => (
            (left.score - right.score)
            || (left.bbox.width * left.bbox.height - right.bbox.width * right.bbox.height)
        ))[0];
}

function edgeHandlePct(index, count) {
    if (count <= 1) return 50;
    return 18 + (index * 64) / (count - 1);
}

function deterministicHandlePct(index, count) {
    return edgeHandlePct(index, count);
}

// Below this much clear space between two facing sides, a straight edge is
// mostly arrowhead. Such an edge arcs out of a shared side instead.
export const TASKS_TIGHT_GAP = 60;

function edgeAnchorSides(sourceRect, targetRect, sourceNode = null, targetNode = null) {
    const sourceCenterX = sourceRect.x + sourceRect.width / 2;
    const sourceCenterY = sourceRect.y + sourceRect.height / 2;
    const targetCenterX = targetRect.x + targetRect.width / 2;
    const targetCenterY = targetRect.y + targetRect.height / 2;
    const dx = targetCenterX - sourceCenterX;
    const dy = targetCenterY - sourceCenterY;
    const gapY = Math.max(0, Math.max(sourceRect.y, targetRect.y) - Math.min(sourceRect.y + sourceRect.height, targetRect.y + targetRect.height));
    const gapX = Math.max(0, Math.max(sourceRect.x, targetRect.x) - Math.min(sourceRect.x + sourceRect.width, targetRect.x + targetRect.width));
    const horizontalSide = dx >= 0
        ? { sourceSide: 'right', targetSide: 'left', sortAxis: 'y' }
        : { sourceSide: 'left', targetSide: 'right', sortAxis: 'y' };
    const verticalSide = dy >= 0
        ? { sourceSide: 'bottom', targetSide: 'top', sortAxis: 'x' }
        : { sourceSide: 'top', targetSide: 'bottom', sortAxis: 'x' };
    // Two nodes almost touching leave no room for a line between them: the
    // arrowhead eats the gap and the edge vanishes. Route such an edge out of a
    // side both ends share, so its visible length is the arc height and no
    // longer depends on the gap at all.
    //
    // The side also carries the direction, so a request and its answer between
    // one pair draw as two arcs that never sit on top of each other.
    if (gapY === 0 && gapX > 0 && gapX < TASKS_TIGHT_GAP) {
        const side = dx >= 0 ? 'top' : 'bottom';
        return { sourceSide: side, targetSide: side, sortAxis: 'x' };
    }
    if (gapX === 0 && gapY > 0 && gapY < TASKS_TIGHT_GAP) {
        const side = dy >= 0 ? 'right' : 'left';
        return { sourceSide: side, targetSide: side, sortAxis: 'y' };
    }
    const sourceKind = sourceNode?.data?.__kind__ || sourceNode?.__kind__;
    const targetKind = targetNode?.data?.__kind__ || targetNode?.__kind__;
    if (sourceKind === 'group' && targetKind === 'group' && Math.abs(dx) >= Math.abs(dy) * 0.8) {
        return horizontalSide;
    }
    const horizontalCongestion = gapX > 0 ? Math.abs(dy) / gapX : Infinity;
    const verticalCongestion = gapY > 0 ? Math.abs(dx) / gapY : Infinity;
    const mixedModeAllowed = Math.hypot(gapX, gapY) <= Math.hypot(
        Math.min(sourceRect.width, targetRect.width),
        Math.min(sourceRect.height, targetRect.height),
    );
    if (horizontalCongestion <= 1.25 || verticalCongestion <= 1.25 || !mixedModeAllowed) {
        return horizontalCongestion <= verticalCongestion ? horizontalSide : verticalSide;
    }
    return Math.abs(dx) >= Math.abs(dy)
        ? { sourceSide: horizontalSide.sourceSide, targetSide: verticalSide.targetSide, sortAxis: 'x' }
        : { sourceSide: verticalSide.sourceSide, targetSide: horizontalSide.targetSide, sortAxis: 'y' };
}

// Style cascade. A node or edge attr wins, then the view, then the layout's own
// default. The same key names both levels, so an override reads like the default.
export const TASKS_NODE_LOOKS = ['card', 'outline', 'sketch', 'blueprint', 'tab', 'station'];
export const TASKS_EDGE_PATHS = ['ribbon', 'line', 'orthogonal', 'octilinear', 'arc'];
export const TASKS_EDGE_CORNERS = ['sharp', 'round'];
export const TASKS_CANVASES = ['plain', 'blueprint'];
// Looks drawn as a figure box: mono or hand type, sized for a subtitle.
export const TASKS_FIGURE_LOOKS = ['outline', 'sketch', 'blueprint', 'tab'];

const tasksCascade = (allowed, ...values) => values
    .map((value) => String(value ?? '').trim().toLowerCase())
    .find((value) => allowed.includes(value));

/**
 * >>> tasksNodeLook({ node_look: 'card' }, { node_look: 'outline' }, 'outline')
 * 'card'
 * >>> tasksNodeLook({}, { node_look: 'outline' })
 * 'outline'
 * >>> tasksNodeLook({}, {}, 'outline')
 * 'outline'
 */
export function tasksNodeLook(node, model, layoutDefault = 'card') {
    return tasksCascade(TASKS_NODE_LOOKS, node?.node_look, model?.node_look, layoutDefault) || 'card';
}

/**
 * >>> tasksEdgeCornerOf({}, { edge_corner: 'round' })
 * 'round'
 * >>> tasksEdgeCornerOf({}, {}, 'orthogonal')
 * 'round'
 * >>> tasksEdgeCornerOf({ edge_corner: 'sharp' }, {}, 'orthogonal')
 * 'sharp'
 */
export function tasksEdgeCornerOf(edge, model, edgePath = '') {
    return tasksCascade(TASKS_EDGE_CORNERS, edge?.edge_corner, model?.edge_corner)
        || (edgePath === 'orthogonal' ? 'round' : 'sharp');
}

// The canvas is view-wide: a view, then @graph, then the site default.
export function tasksCanvasOf(model) {
    return tasksCascade(TASKS_CANVASES, model?.canvas) || 'plain';
}

/**
 * The second line of an outline node: its own `subtitle`, else the attr the
 * view names in `subtitle_from`, else nothing.
 *
 * >>> tasksNodeSubtitle({ subtitle: 'Own', description: 'Long' }, { subtitle_from: 'description' })
 * 'Own'
 * >>> tasksNodeSubtitle({ description: 'Long' }, { subtitle_from: 'description' })
 * 'Long'
 * >>> tasksNodeSubtitle({ description: 'Long' }, {})
 * ''
 */
export function tasksNodeSubtitle(node, view) {
    const from = String(view?.subtitle_from || '').trim();
    return String(node?.subtitle || (from ? node?.[from] : '') || '').trim();
}

/**
 * >>> tasksEdgePathOf({ edge_path: 'line' }, { edge_path: 'orthogonal' })
 * 'line'
 * >>> tasksEdgePathOf({}, {}, 'line')
 * 'line'
 */
export function tasksEdgePathOf(edge, model, layoutDefault = 'ribbon') {
    return tasksCascade(TASKS_EDGE_PATHS, edge?.edge_path, model?.edge_path, layoutDefault) || 'ribbon';
}

/**
 * Where the ray from a rect's centre toward a point crosses the rect border,
 * pushed out by `gap`. A straight edge runs centre to centre and is cut here.
 *
 * >>> tasksRectExitPoint({ x: 0, y: 0, width: 100, height: 40 }, { x: 300, y: 20 })
 * { x: 100, y: 20 }
 * >>> tasksRectExitPoint({ x: 0, y: 0, width: 100, height: 40 }, { x: 50, y: -200 }, 4)
 * { x: 50, y: -4 }
 */
export function tasksRectExitPoint(rect, toward, gap = 0) {
    const cx = rect.x + rect.width / 2;
    const cy = rect.y + rect.height / 2;
    const dx = toward.x - cx;
    const dy = toward.y - cy;
    if (!dx && !dy) return { x: cx, y: cy };
    const scale = 1 / Math.max(Math.abs(dx) / (rect.width / 2 + gap), Math.abs(dy) / (rect.height / 2 + gap));
    const px = (value) => Math.round(value * 100) / 100;
    return { x: px(cx + dx * scale), y: px(cy + dy * scale) };
}

// A straight route between two node rects: centre to centre, cut at each
// border. The target end stops short so the arrow tip clears the box.
export function tasksStraightRoute(sourceRect, targetRect, targetGap = 3) {
    const centre = (rect) => ({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 });
    return [tasksRectExitPoint(sourceRect, centre(targetRect)), tasksRectExitPoint(targetRect, centre(sourceRect), targetGap)];
}

// A node or edge the author marked `dashed` is drawn with a dashed stroke.
export function tasksIsDashed(item) {
    return ['true', 'yes', '1'].includes(String(item?.dashed ?? '').trim().toLowerCase());
}

/**
 * Orthogonal route between two rects, as points. Candidates are the straight
 * run, both L shapes, and Z or U shapes whose middle run sits in the gutter
 * beside either end. The route crossing the fewest other rects wins, then the
 * one with fewest bends, then the shortest.
 *
 * >>> tasksOrthogonalRoute({ x: 0, y: 0, width: 100, height: 40 }, { x: 0, y: 100, width: 100, height: 40 }, [], 40)
 * [{ x: 50, y: 40 }, { x: 50, y: 97 }]
 */
export function tasksOrthogonalRoute(source, target, obstacles = [], gap = 40, targetGap = 3, reservedRoutes = []) {
    const gapX = Number(gap?.x ?? gap);
    const gapY = Number(gap?.y ?? gap);
    const cx = (r) => r.x + r.width / 2;
    const cy = (r) => r.y + r.height / 2;
    const right = (r) => r.x + r.width;
    const bottom = (r) => r.y + r.height;
    const corridor = {
        left: Math.min(source.x, target.x) - gapX * 2 - 48,
        right: Math.max(right(source), right(target)) + gapX * 2 + 48,
        top: Math.min(source.y, target.y) - gapY * 2 - 48,
        bottom: Math.max(bottom(source), bottom(target)) + gapY * 2 + 48,
    };
    const priorRoutes = reservedRoutes.map((route, index) => {
        const points = route.points || route;
        const bounds = points.reduce((rect, point) => ({
            left: Math.min(rect.left, point.x), right: Math.max(rect.right, point.x),
            top: Math.min(rect.top, point.y), bottom: Math.max(rect.bottom, point.y),
        }), { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity });
        const distanceX = Math.max(0, corridor.left - bounds.right, bounds.left - corridor.right);
        const distanceY = Math.max(0, corridor.top - bounds.bottom, bounds.top - corridor.bottom);
        return { points, index, distance: distanceX + distanceY };
    }).filter((route) => route.distance === 0)
        .sort((a, b) => a.index - b.index)
        .slice(-16);
    const candidates = [];
    const push = (points) => candidates.push(points);
    // Straight: the rects overlap on one axis, so one run joins facing sides.
    const overlapX = [Math.max(source.x, target.x), Math.min(right(source), right(target))];
    const overlapY = [Math.max(source.y, target.y), Math.min(bottom(source), bottom(target))];
    if (overlapX[1] - overlapX[0] > 8) {
        const x = (overlapX[0] + overlapX[1]) / 2;
        const down = cy(target) > cy(source);
        push([{ x, y: down ? bottom(source) : source.y }, { x, y: down ? target.y - targetGap : bottom(target) + targetGap }]);
    }
    if (overlapY[1] - overlapY[0] > 8) {
        const y = (overlapY[0] + overlapY[1]) / 2;
        const east = cx(target) > cx(source);
        push([{ x: east ? right(source) : source.x, y }, { x: east ? target.x - targetGap : right(target) + targetGap, y }]);
    }
    // Where a run at `x` leaves or enters a rect horizontally, and at `y` vertically.
    const sideX = (r, x, gapOut = 0) => (x < cx(r) ? r.x - gapOut : right(r) + gapOut);
    const sideY = (r, y, gapOut = 0) => (y < cy(r) ? r.y - gapOut : bottom(r) + gapOut);
    const outsideX = (r, x) => x < r.x || x > right(r);
    const outsideY = (r, y) => y < r.y || y > bottom(r);
    // L: leave one axis, enter on the other.
    if (outsideX(source, cx(target)) && outsideY(target, cy(source))) {
        push([{ x: sideX(source, cx(target)), y: cy(source) }, { x: cx(target), y: cy(source) }, { x: cx(target), y: sideY(target, cy(source), targetGap) }]);
    }
    if (outsideY(source, cy(target)) && outsideX(target, cx(source))) {
        push([{ x: cx(source), y: sideY(source, cy(target)) }, { x: cx(source), y: cy(target) }, { x: sideX(target, cx(source), targetGap), y: cy(target) }]);
    }
    // Z or U: the middle run sits in a gutter beside either end or a reserved lane.
    const verticalTracks = [source.x - gapX / 2, right(source) + gapX / 2, target.x - gapX / 2, right(target) + gapX / 2];
    const horizontalTracks = [source.y - gapY / 2, bottom(source) + gapY / 2, target.y - gapY / 2, bottom(target) + gapY / 2];
    const laneSpacing = 14;
    for (const reserved of priorRoutes) {
        const points = reserved.points;
        for (let index = 1; index < points.length; index++) {
            const prev = points[index - 1];
            const point = points[index];
            if (Math.abs(point.x - prev.x) < 1) {
                for (let lane = 1; lane <= 2; lane++) verticalTracks.push(point.x - lane * laneSpacing, point.x + lane * laneSpacing);
            } else if (Math.abs(point.y - prev.y) < 1) {
                for (let lane = 1; lane <= 2; lane++) horizontalTracks.push(point.y - lane * laneSpacing, point.y + lane * laneSpacing);
            }
        }
    }
    for (const x of new Set(verticalTracks)) {
        if (!outsideX(source, x) || !outsideX(target, x)) continue;
        push([{ x: sideX(source, x), y: cy(source) }, { x, y: cy(source) }, { x, y: cy(target) }, { x: sideX(target, x, targetGap), y: cy(target) }]);
    }
    for (const y of new Set(horizontalTracks)) {
        if (!outsideY(source, y) || !outsideY(target, y)) continue;
        push([{ x: cx(source), y: sideY(source, y) }, { x: cx(source), y }, { x: cx(target), y }, { x: cx(target), y: sideY(target, y, targetGap) }]);
    }
    const others = obstacles.filter((r) => r !== source && r !== target);
    const hits = (a, b) => others.filter((r) => Math.min(a.x, b.x) < right(r) - 1 && Math.max(a.x, b.x) > r.x + 1
        && Math.min(a.y, b.y) < bottom(r) - 1 && Math.max(a.y, b.y) > r.y + 1).length;
    const edgeConflicts = (a, b) => priorRoutes.reduce((total, reserved) => {
        const points = reserved.points;
        return total + points.slice(1).reduce((score, point, index) => {
            const prev = points[index];
            const candidateVertical = Math.abs(a.x - b.x) < 1;
            const candidateHorizontal = Math.abs(a.y - b.y) < 1;
            const reservedVertical = Math.abs(prev.x - point.x) < 1;
            const reservedHorizontal = Math.abs(prev.y - point.y) < 1;
            if (candidateVertical && reservedVertical && Math.abs(a.x - prev.x) < 1) {
                const overlap = Math.min(Math.max(a.y, b.y), Math.max(prev.y, point.y))
                    - Math.max(Math.min(a.y, b.y), Math.min(prev.y, point.y));
                return score + (overlap > 18 ? 10000 + overlap * 20 : 0);
            }
            if (candidateHorizontal && reservedHorizontal && Math.abs(a.y - prev.y) < 1) {
                const overlap = Math.min(Math.max(a.x, b.x), Math.max(prev.x, point.x))
                    - Math.max(Math.min(a.x, b.x), Math.min(prev.x, point.x));
                return score + (overlap > 18 ? 10000 + overlap * 20 : 0);
            }
            const crosses = (candidateVertical && reservedHorizontal) || (candidateHorizontal && reservedVertical);
            if (!crosses) return score;
            const verticalSegment = candidateVertical ? [a, b] : [prev, point];
            const horizontalSegment = candidateHorizontal ? [a, b] : [prev, point];
            const crossX = verticalSegment[0].x;
            const crossY = horizontalSegment[0].y;
            const interior = crossY > Math.min(verticalSegment[0].y, verticalSegment[1].y) + 6
                && crossY < Math.max(verticalSegment[0].y, verticalSegment[1].y) - 6
                && crossX > Math.min(horizontalSegment[0].x, horizontalSegment[1].x) + 6
                && crossX < Math.max(horizontalSegment[0].x, horizontalSegment[1].x) - 6;
            return score + (interior ? 180 : 0);
        }, 0);
    }, 0);
    const cost = (points) => points.slice(1).reduce((sum, point, index) => {
        const prev = points[index];
        return sum + hits(prev, point) * 1e5 + edgeConflicts(prev, point)
            + Math.abs(point.x - prev.x) + Math.abs(point.y - prev.y);
    }, (points.length - 2) * 60);
    return candidates.reduce((best, points) => (!best || cost(points) < cost(best) ? points : best), null)
        || [{ x: cx(source), y: cy(source) }, { x: cx(target), y: cy(target) }];
}

/**
 * Octilinear route between rect centres: one 45 degree run and one straight
 * run, the order that crosses fewer other rects. Ends are cut at each border.
 *
 * >>> tasksOctilinearRoute({ x: 0, y: 0, width: 20, height: 20 }, { x: 200, y: 100, width: 20, height: 20 }).length
 * 3
 */
export function tasksOctilinearRoute(source, target, obstacles = [], targetGap = 3) {
    const centre = (r) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
    const p = centre(source);
    const q = centre(target);
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    const d = Math.min(Math.abs(dx), Math.abs(dy));
    const diagonalFirst = { x: p.x + Math.sign(dx) * d, y: p.y + Math.sign(dy) * d };
    const straightFirst = { x: q.x - Math.sign(dx) * d, y: q.y - Math.sign(dy) * d };
    const others = obstacles.filter((r) => r !== source && r !== target);
    const hits = (a, b) => others.filter((r) => Math.min(a.x, b.x) < r.x + r.width - 1 && Math.max(a.x, b.x) > r.x + 1
        && Math.min(a.y, b.y) < r.y + r.height - 1 && Math.max(a.y, b.y) > r.y + 1).length;
    const cost = (bend) => hits(p, bend) + hits(bend, q);
    const bend = cost(diagonalFirst) <= cost(straightFirst) ? diagonalFirst : straightFirst;
    const points = Math.hypot(bend.x - p.x, bend.y - p.y) < 1 || Math.hypot(q.x - bend.x, q.y - bend.y) < 1 ? [p, q] : [p, bend, q];
    points[0] = tasksRectExitPoint(source, points[1]);
    points[points.length - 1] = tasksRectExitPoint(target, points[points.length - 2], targetGap);
    return points;
}

/**
 * Arc route: a curve that bulges to the left of the direction of travel, so on
 * one baseline a forward edge arcs above and a back edge arcs below.
 *
 * >>> const arc = tasksArcRoute({ x: 0, y: 0, width: 20, height: 20 }, { x: 200, y: 0, width: 20, height: 20 })
 * >>> arc.length > 8 && arc[4].y < 0
 * true
 */
export function tasksArcRoute(source, target, bulge = 0.35, targetGap = 3) {
    const centre = (r) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
    const p = centre(source);
    const q = centre(target);
    const chord = Math.hypot(q.x - p.x, q.y - p.y) || 1;
    // Left of travel: rotate the chord direction a quarter turn anticlockwise.
    const nx = (q.y - p.y) / chord;
    const ny = -(q.x - p.x) / chord;
    const control = { x: (p.x + q.x) / 2 + nx * chord * bulge * 2, y: (p.y + q.y) / 2 + ny * chord * bulge * 2 };
    const start = tasksRectExitPoint(source, control);
    const end = tasksRectExitPoint(target, control, targetGap);
    const at = (t) => ({
        x: (1 - t) ** 2 * start.x + 2 * (1 - t) * t * control.x + t * t * end.x,
        y: (1 - t) ** 2 * start.y + 2 * (1 - t) * t * control.y + t * t * end.y,
    });
    return Array.from({ length: 25 }, (_, index) => at(index / 24));
}

// The points a routed edge is drawn through, or null for a ribbon, which
// curves between the handles instead.
export function tasksEdgeRoute(edgePath, from, to, obstacles = [], gutter = 44) {
    if (!from || !to || edgePath === 'ribbon') return null;
    if (edgePath === 'orthogonal') return tasksOrthogonalRoute(from, to, obstacles, gutter);
    if (edgePath === 'octilinear') return tasksOctilinearRoute(from, to, obstacles);
    if (edgePath === 'arc') return tasksArcRoute(from, to);
    return tasksStraightRoute(from, to);
}

// A station's route target is its dot, not the label box around it.
const TASKS_STATION_DOT = 16;
function tasksRouteRect(node, rect) {
    if (!rect || (node.data?.__node_look__ || node.__node_look__) !== 'station') return rect;
    return { x: rect.x + rect.width / 2 - TASKS_STATION_DOT / 2, y: rect.y + rect.height / 2 - TASKS_STATION_DOT / 2, width: TASKS_STATION_DOT, height: TASKS_STATION_DOT };
}

// Solve every routed edge against the current node rects. A box a route must
// go around is a task or a collapsed group; an open group contains its routes.
export function tasksRouteEdges(nodes, edges, gutter = 44) {
    const boxes = absoluteNodeRects(nodes);
    const rects = Object.fromEntries((nodes || []).map((node) => [node.id, tasksRouteRect(node, boxes[node.id])]));
    const obstacles = (nodes || [])
        .filter((node) => {
            const kind = node.data?.__kind__ || node.__kind__;
            return kind === 'task' || (kind === 'group' && !String(node.className || '').includes('expanded-group'));
        })
        .map((node) => rects[node.id])
        .filter(Boolean);
    const sourceEdges = edges || [];
    const orthogonalRoutes = new Map();
    const routed = [];
    sourceEdges.map((edge, index) => ({ edge, index }))
        .filter(({ edge }) => edge.data?.__edge_path__ === 'orthogonal' && rects[edge.source] && rects[edge.target])
        .sort((a, b) => String(a.edge.id || '').localeCompare(String(b.edge.id || '')) || a.index - b.index)
        .forEach(({ edge, index }) => {
            const route = tasksOrthogonalRoute(rects[edge.source], rects[edge.target], obstacles, gutter, 3, routed);
            orthogonalRoutes.set(index, route);
            routed.push(route);
        });
    return sourceEdges.map((edge, index) => {
        const edgePath = edge.data?.__edge_path__;
        if (!edgePath || edgePath === 'ribbon') return edge;
        const route = edgePath === 'orthogonal' && orthogonalRoutes.has(index)
            ? orthogonalRoutes.get(index)
            : tasksEdgeRoute(edgePath, rects[edge.source], rects[edge.target], obstacles, gutter);
        return { ...edge, data: { ...edge.data, __route__: route } };
    });
}

export function absoluteNodeRects(nodes) {
    const byId = Object.fromEntries((nodes || []).map((node) => [node.id, node]));
    const cache = {};
    const resolve = (id) => {
        if (cache[id]) return cache[id];
        const node = byId[id];
        if (!node) return null;
        let x = Number(node.position?.x || 0);
        let y = Number(node.position?.y || 0);
        if (node.parentId) {
            const parent = resolve(node.parentId);
            if (parent) {
                x += parent.x;
                y += parent.y;
            }
        }
        cache[id] = {
            x,
            y,
            width: Number(node.width || node.style?.width || 0),
            height: Number(node.height || node.style?.height || 0),
        };
        return cache[id];
    };
    for (const node of (nodes || [])) resolve(node.id);
    return cache;
}

function tasksHandlePoint(rect, handle) {
    if (!rect || !handle) return null;
    const rawOffset = Number(handle.offsetPct);
    const offset = Math.max(0, Math.min(100, Number.isFinite(rawOffset) ? rawOffset : 50)) / 100;
    if (handle.side === 'left') return { x: rect.x, y: rect.y + rect.height * offset };
    if (handle.side === 'right') return { x: rect.x + rect.width, y: rect.y + rect.height * offset };
    if (handle.side === 'top') return { x: rect.x + rect.width * offset, y: rect.y };
    if (handle.side === 'bottom') return { x: rect.x + rect.width * offset, y: rect.y + rect.height };
    return null;
}

function tasksPointToSegmentDistance(point, start, end) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;
    const projection = lengthSquared
        ? Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared))
        : 0;
    return Math.hypot(point.x - (start.x + projection * dx), point.y - (start.y + projection * dy));
}

export function nearestTasksIncidentEdge(pointer, nodeId, nodes, edges) {
    const activeId = String(nodeId || '');
    const node = (nodes || []).find((item) => String(item.id || '') === activeId);
    const rect = absoluteNodeRects(nodes)[activeId];
    if (!node || !rect) return null;
    let nearest = null;
    let nearestDistance = Infinity;
    for (const edge of (edges || [])) {
        const role = String(edge.source || '') === activeId
            ? 'source'
            : (String(edge.target || '') === activeId ? 'target' : '');
        if (!role) continue;
        const route = edge.data?.__route__;
        let distance = Infinity;
        if (Array.isArray(route) && route.length > 1) {
            for (let index = 1; index < route.length; index++) {
                distance = Math.min(distance, tasksPointToSegmentDistance(pointer, route[index - 1], route[index]));
            }
        } else {
            const handleId = edge[`${role}Handle`];
            const handle = (node.data?.handleLayout?.[role] || []).find((item) => item.id === handleId);
            const point = tasksHandlePoint(rect, handle);
            if (!point) continue;
            distance = Math.hypot(Number(pointer?.x) - point.x, Number(pointer?.y) - point.y);
        }
        if (distance < nearestDistance) {
            nearest = edge;
            nearestDistance = distance;
        }
    }
    return nearest;
}

export function buildTaskEdgeAnchors(nodes, edges, handlePrefix = '') {
    const rects = absoluteNodeRects(nodes);
    const nodesById = Object.fromEntries((nodes || []).map((node) => [node.id, node]));
    const outgoingGroups = new Map();
    const incomingGroups = new Map();
    const anchoredEdges = (edges || []).map((edge, index) => {
        const sourceRect = rects[edge.source];
        const targetRect = rects[edge.target];
        if (!sourceRect || !targetRect) return { ...edge, _anchorIndex: index };
        const { sourceSide, targetSide } = edgeAnchorSides(sourceRect, targetRect, nodesById[edge.source], nodesById[edge.target]);
        const anchored = {
            ...edge,
            _anchorIndex: index,
            _sourceSide: sourceSide,
            _targetSide: targetSide,
        };
        const outgoingKey = `${edge.source}:source:${sourceSide}`;
        const incomingKey = `${edge.target}:target:${targetSide}`;
        if (!outgoingGroups.has(outgoingKey)) outgoingGroups.set(outgoingKey, []);
        if (!incomingGroups.has(incomingKey)) incomingGroups.set(incomingKey, []);
        const targetSort = ['left', 'right'].includes(sourceSide)
            ? targetRect.y + targetRect.height / 2
            : targetRect.x + targetRect.width / 2;
        const sourceSort = ['left', 'right'].includes(targetSide)
            ? sourceRect.y + sourceRect.height / 2
            : sourceRect.x + sourceRect.width / 2;
        outgoingGroups.get(outgoingKey).push({ edge: anchored, sortValue: targetSort });
        incomingGroups.get(incomingKey).push({ edge: anchored, sortValue: sourceSort });
        return anchored;
    });

    const nodeHandles = {};
    const assignGroup = (groups, role) => {
        for (const [key, entries] of groups.entries()) {
            const [nodeId, , side] = key.split(':');
            const peerGroups = role === 'source' ? incomingGroups : outgoingGroups;
            const peerRole = role === 'source' ? 'target' : 'source';
            const peerEntries = peerGroups.get(`${nodeId}:${peerRole}:${side}`) || [];
            const slotCount = entries.length + peerEntries.length;
            const slotOffset = role === 'source' ? peerEntries.length : 0;
            entries.sort((a, b) => (a.sortValue - b.sortValue) || (a.edge._anchorIndex - b.edge._anchorIndex));
            const handles = entries.map(({ edge }, index) => {
                const handleId = `${handlePrefix}${role}-${side}-${index}`;
                if (role === 'source') edge.sourceHandle = handleId;
                else edge.targetHandle = handleId;
                return { id: handleId, side, offsetPct: deterministicHandlePct(slotOffset + index, slotCount) };
            });
            nodeHandles[nodeId] = nodeHandles[nodeId] || { source: [], target: [] };
            nodeHandles[nodeId][role].push(...handles);
        }
    };

    assignGroup(outgoingGroups, 'source');
    assignGroup(incomingGroups, 'target');

    return {
        edges: anchoredEdges.map(({ _anchorIndex, _sourceSide, _targetSide, ...edge }) => edge),
        nodeHandles,
    };
}

function tasksShallowObjectEquals(a, b) {
    if (Object.is(a, b)) return true;
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
    if (Array.isArray(a) || Array.isArray(b)) return false;
    const aKeys = Object.keys(a);
    if (aKeys.length !== Object.keys(b).length) return false;
    return aKeys.every((key) => Object.is(a[key], b[key]));
}

function tasksGraphElementEquals(a, b) {
    if (Object.is(a, b)) return true;
    if (!a || !b) return false;
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
        if (Object.is(a[key], b[key])) continue;
        // Nested style/data/position objects are rebuilt by highlight passes
        // even when their values are unchanged; one level of value-compare is
        // enough because deeper structures keep their base-graph references.
        if (!tasksShallowObjectEquals(a[key], b[key])) return false;
    }
    return true;
}

// Reuse-or-replace pass for React Flow node/edge lists. Memoized node/edge
// components re-render whenever their element's object identity changes, so a
// highlight pass that clones every element forces a whole-graph re-render even
// when only the hovered node's styling actually changed. Swapping each clone
// back to its value-equal predecessor keeps identities stable, and returning
// `prev` itself when nothing changed lets React skip the state update.
export function tasksReuseGraphElements(prev, next) {
    if (!Array.isArray(prev) || !prev.length || !Array.isArray(next)) return next;
    const prevById = new Map(prev.map((element) => [element?.id, element]));
    let unchanged = next.length === prev.length;
    const merged = next.map((element, index) => {
        const before = prevById.get(element?.id);
        if (before && tasksGraphElementEquals(before, element)) {
            if (before !== prev[index]) unchanged = false;
            return before;
        }
        unchanged = false;
        return element;
    });
    return unchanged ? prev : merged;
}

// Hit bounds restrict interaction without changing paint or selection bounds.
export function tasksGraphNodeHitRect(node, byId) {
    const rect = tasksGraphNodeAbsoluteRect(node, byId);
    const hit = node.data?.__hit_rect__;
    return hit ? { x: rect.x + (hit.dx || 0), y: rect.y + (hit.dy || 0), width: hit.width, height: hit.height } : rect;
}

// Authored drawing order belongs to layout, including during focus and selection.
// The node renderer owns its fill; the shared overlay owns its focus outline.
export function tasksGraphPaint(node) {
    const zIndex = node.data?.__z__;
    if (!Number.isFinite(zIndex)) return node;
    return { ...node, zIndex, style: { ...node.style, zIndex,
        ...(!node.source && !node.target ? { background: 'transparent', boxShadow: 'none' } : {}),
    } };
}

// One closed path paints the corner, including its diagonal border.
export function tasksGraphCornerPath(width, height, radius = 6) {
    const cut = height / 2;
    return `M ${radius} 0 H ${width} V ${height - cut} L ${width - cut} ${height} H 0 V ${radius} Q 0 0 ${radius} 0 Z`;
}
