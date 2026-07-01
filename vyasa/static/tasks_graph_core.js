export function clampScale(value, maxScale = 55) {
    return Math.min(Math.max(0.1, value), maxScale);
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

const TASK_NODE_FONT = '600 13px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const TASK_NODE_SPECS = {
    group: { width: 250, minHeight: 80, padX: 32, padY: 28, reserveX: 34 },
    groupTitle: { width: 250, minHeight: 34, padX: 20, padY: 12, reserveX: 28 },
    task: { width: 220, minHeight: 60, padX: 28, padY: 24, reserveX: 0 },
};

function measureTextWidth(text, font = TASK_NODE_FONT) {
    const canvas = typeof OffscreenCanvas !== 'undefined'
        ? new OffscreenCanvas(1, 1)
        : (typeof document !== 'undefined' ? document.createElement('canvas') : null);
    const ctx = canvas?.getContext?.('2d');
    if (!ctx) return text.length * 7.1;
    ctx.font = font;
    return ctx.measureText(text).width;
}

export function sizeTaskNode(label, kind = 'task', widthOverride = null) {
    const spec = TASK_NODE_SPECS[kind] || TASK_NODE_SPECS.task;
    const width = Math.max(32, Number(widthOverride || spec.width));
    const maxTextWidth = Math.max(32, width - spec.padX - spec.reserveX - 8);
    const lines = String(label || '')
        .split(/\r?\n/)
        .reduce((count, part) => count + Math.max(1, Math.ceil((measureTextWidth(part) * 1.08) / maxTextWidth)), 0);
    const textHeight = Math.max(20, lines * 18);
    return {
        width,
        height: Math.max(spec.minHeight, Math.ceil(textHeight + spec.padY + 8)),
    };
}

export function isTasksGraphNodeSelectable(kind, isExpanded = false) {
    return kind === 'task' || kind === 'group' || kind === 'groupTitle';
}

export function tasksGraphNodeHitArea(kind, isExpanded = false) {
    if (kind === 'task') return 'selectable';
    if (kind === 'groupTitle') return 'selectable';
    if (kind === 'group') return 'selectable';
    return 'passive';
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

export function applyTasksFilterAttributePolicy(keys, model) {
    const candidates = Array.isArray(keys)
        ? keys.map((key) => String(key || '').trim()).filter(Boolean)
        : [];
    const whitelistSource = Array.isArray(model?.filter_whitelist) && model.filter_whitelist.length
        ? model.filter_whitelist
        : model?.filter_attributes;
    const whitelist = Array.isArray(whitelistSource)
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
    const overlapY = Math.max(0, Math.min(sourceRect.y + sourceRect.height, targetRect.y + targetRect.height) - Math.max(sourceRect.y, targetRect.y));
    const overlapX = Math.max(0, Math.min(sourceRect.x + sourceRect.width, targetRect.x + targetRect.width) - Math.max(sourceRect.x, targetRect.x));
    const gapY = Math.max(0, Math.max(sourceRect.y, targetRect.y) - Math.min(sourceRect.y + sourceRect.height, targetRect.y + targetRect.height));
    const gapX = Math.max(0, Math.max(sourceRect.x, targetRect.x) - Math.min(sourceRect.x + sourceRect.width, targetRect.x + targetRect.width));
    const horizontalSide = dx >= 0
        ? { sourceSide: 'right', targetSide: 'left', sortAxis: 'y' }
        : { sourceSide: 'left', targetSide: 'right', sortAxis: 'y' };
    const sourceKind = sourceNode?.data?.__kind__ || sourceNode?.__kind__;
    const targetKind = targetNode?.data?.__kind__ || targetNode?.__kind__;
    if (sourceKind === 'group' && targetKind === 'group' && Math.abs(dx) >= Math.abs(dy) * 0.8) {
        return horizontalSide;
    }
    const significantRowOverlap = overlapY >= Math.min(sourceRect.height, targetRect.height) * 0.35;
    if (significantRowOverlap && Math.abs(dx) >= Math.abs(dy) * 1.1) {
        return horizontalSide;
    }
    const substantialHorizontalGap = gapX >= Math.min(sourceRect.width, targetRect.width) * 0.35;
    const strongHorizontalOffset = substantialHorizontalGap && Math.abs(dx) >= Math.abs(dy) * 0.7;
    if (strongHorizontalOffset) {
        return horizontalSide;
    }
    const candidates = [
        {
            sourceSide: 'right', targetSide: 'left', sortAxis: 'y',
            score: Math.abs(dx) + 1.4 * gapY + 0.35 * Math.abs(dy) + (dx < 0 ? 1e6 : 0) - 0.2 * overlapY,
        },
        {
            sourceSide: 'left', targetSide: 'right', sortAxis: 'y',
            score: Math.abs(dx) + 1.4 * gapY + 0.35 * Math.abs(dy) + (dx > 0 ? 1e6 : 0) - 0.2 * overlapY,
        },
        {
            sourceSide: 'bottom', targetSide: 'top', sortAxis: 'x',
            score: Math.abs(dy) + 1.4 * gapX + 0.35 * Math.abs(dx) + (dy < 0 ? 1e6 : 0) - 0.2 * overlapX,
        },
        {
            sourceSide: 'top', targetSide: 'bottom', sortAxis: 'x',
            score: Math.abs(dy) + 1.4 * gapX + 0.35 * Math.abs(dx) + (dy > 0 ? 1e6 : 0) - 0.2 * overlapX,
        },
    ];
    candidates.sort((a, b) => a.score - b.score);
    return {
        sourceSide: candidates[0].sourceSide,
        targetSide: candidates[0].targetSide,
        sortAxis: candidates[0].sortAxis,
    };
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

export function buildTaskEdgeAnchors(nodes, edges) {
    const rects = absoluteNodeRects(nodes);
    const nodesById = Object.fromEntries((nodes || []).map((node) => [node.id, node]));
    const outgoingGroups = new Map();
    const incomingGroups = new Map();
    const anchoredEdges = (edges || []).map((edge, index) => {
        const sourceRect = rects[edge.source];
        const targetRect = rects[edge.target];
        if (!sourceRect || !targetRect) return { ...edge, _anchorIndex: index };
        const { sourceSide, targetSide, sortAxis } = edgeAnchorSides(sourceRect, targetRect, nodesById[edge.source], nodesById[edge.target]);
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
        const targetSort = sortAxis === 'y' ? targetRect.y + targetRect.height / 2 : targetRect.x + targetRect.width / 2;
        const sourceSort = sortAxis === 'y' ? sourceRect.y + sourceRect.height / 2 : sourceRect.x + sourceRect.width / 2;
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
                const handleId = `${role}-${side}-${index}`;
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
