export function clampScale(value, maxScale = 55) {
    return Math.min(Math.max(0.1, value), maxScale);
}

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

export function nextWheelState(state, rect, point, deltaY, maxScale = 55) {
    const mouseX = point.x - rect.left - rect.width / 2;
    const mouseY = point.y - rect.top - rect.height / 2;
    const oversizeFactor = Math.max(rect.width / Math.max(window.innerWidth || 1, 1), rect.height / Math.max(window.innerHeight || 1, 1), 1);
    const zoomIntensity = Math.min(0.01 * oversizeFactor, 0.04);
    const delta = deltaY > 0 ? 1 - zoomIntensity : 1 + zoomIntensity;
    const scale = clampScale(state.scale * delta, maxScale);
    const scaleFactor = scale / state.scale - 1;
    return {
        ...state,
        scale,
        translateX: state.translateX - mouseX * scaleFactor,
        translateY: state.translateY - mouseY * scaleFactor,
    };
}

export function bindPanZoomGestures(wrapper, state, { getTarget, applyState, maxScale = 55 }) {
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

    wrapper.addEventListener('wheel', (event) => {
        event.preventDefault();
        const target = getTarget();
        if (!target) return;
        Object.assign(state, nextWheelState(state, target.getBoundingClientRect(), { x: event.clientX, y: event.clientY }, event.deltaY, maxScale));
        applyState();
    }, { passive: false });

    wrapper.addEventListener('pointerdown', (event) => {
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        pointers.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });
        try {
            wrapper.setPointerCapture(event.pointerId);
        } catch {}
        if (pointers.size >= 2) beginPinch();
        else beginPanFromPointer({ clientX: event.clientX, clientY: event.clientY });
        event.preventDefault();
    });

    wrapper.addEventListener('pointermove', (event) => {
        if (!pointers.has(event.pointerId)) return;
        pointers.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });
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
            const newScale = clampScale(state.scale * (distance / Math.max(state.pinchDistance, 1)), maxScale);
            const scaleFactor = newScale / state.scale - 1;
            state.translateX += center.x - state.pinchLastCenter.x;
            state.translateY += center.y - state.pinchLastCenter.y;
            state.translateX -= centerX * scaleFactor;
            state.translateY -= centerY * scaleFactor;
            state.scale = newScale;
            state.pinchDistance = distance;
            state.pinchLastCenter = center;
            applyState();
            event.preventDefault();
            return;
        }
        if (!state.isPanning) return;
        state.translateX = event.clientX - state.startX;
        state.translateY = event.clientY - state.startY;
        applyState();
        event.preventDefault();
    });

    const stopPointer = (event) => {
        pointers.delete(event.pointerId);
        try {
            wrapper.releasePointerCapture(event.pointerId);
        } catch {}
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
    wrapper.addEventListener('pointerleave', (event) => {
        if (state.isPanning || pointers.has(event.pointerId)) stopPointer(event);
    });
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

export function isTasksGraphNodeSelectable(kind, isExpanded = false) {
    if (kind === 'task') return true;
    if (kind === 'group') return true;
    if (kind === 'groupTitle') return true;
    return false;
}

export function tasksGraphNodeAllowsHover(node, allowDimmed = false) {
    return allowDimmed || node?.data?.highlightMode !== 'dim';
}

export function tasksGraphNodeHitArea(kind, isExpanded = false) {
    if (kind === 'task') return 'selectable';
    if (kind === 'groupTitle') return 'control';
    if (kind === 'group') return 'selectable';
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

function tasksGraphNodeAbsoluteRect(node, byId) {
    let x = Number(node?.position?.x) || 0;
    let y = Number(node?.position?.y) || 0;
    let parent = node?.parentId ? byId[node.parentId] : null;
    while (parent) {
        x += Number(parent?.position?.x) || 0;
        y += Number(parent?.position?.y) || 0;
        parent = parent?.parentId ? byId[parent.parentId] : null;
    }
    return { left: x, right: x + (Number(node?.style?.width ?? node?.width) || 0), top: y, bottom: y + (Number(node?.style?.height ?? node?.height) || 0) };
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

function absoluteNodeRects(nodes) {
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
        const handleId = edge[`${role}Handle`];
        const handle = (node.data?.handleLayout?.[role] || []).find((item) => item.id === handleId);
        const point = tasksHandlePoint(rect, handle);
        if (!point) continue;
        const distance = Math.hypot(Number(pointer?.x) - point.x, Number(pointer?.y) - point.y);
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
