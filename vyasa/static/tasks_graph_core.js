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
    return kind === 'task' || (kind === 'group' && !isExpanded);
}

export function tasksGraphNodeHitArea(kind, isExpanded = false) {
    if (kind === 'task') return 'selectable';
    if (kind === 'groupTitle') return 'control';
    if (kind === 'group' && isExpanded) return 'background';
    if (kind === 'group') return 'selectable';
    return 'passive';
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

export function layoutDisconnectedTaskNodes(nodes, direction = 'DOWN', options = {}) {
    const orderedNodes = Array.isArray(nodes) ? nodes : [];
    const gap = Math.max(0, Number(options.gap) || 0);
    const padX = Math.max(0, Number(options.padX) || 0);
    const padTop = Math.max(0, Number(options.padTop) || 0);
    const padBottom = Math.max(0, Number(options.padBottom) || 0);
    const isRight = String(direction || 'DOWN').toUpperCase() === 'RIGHT';
    const positions = {};
    let cursorX = padX;
    let cursorY = padTop;
    let maxWidth = 0;
    let maxHeight = 0;

    for (const node of orderedNodes) {
        const width = Math.max(0, Number(node?.width) || 0);
        const height = Math.max(0, Number(node?.height) || 0);
        positions[node.id] = { x: cursorX, y: cursorY, width, height };
        if (isRight) {
            cursorX += width + gap;
            maxWidth = cursorX - gap;
            maxHeight = Math.max(maxHeight, padTop + height);
        } else {
            cursorY += height + gap;
            maxWidth = Math.max(maxWidth, padX + width);
            maxHeight = cursorY - gap;
        }
    }

    if (orderedNodes.length === 0) {
        maxWidth = padX;
        maxHeight = padTop;
    }

    return {
        positions,
        bbox: {
            width: maxWidth + padX,
            height: maxHeight + padBottom,
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

function edgeAnchorSides(sourceRect, targetRect) {
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
    const outgoingGroups = new Map();
    const incomingGroups = new Map();
    const anchoredEdges = (edges || []).map((edge, index) => {
        const sourceRect = rects[edge.source];
        const targetRect = rects[edge.target];
        if (!sourceRect || !targetRect) return { ...edge, _anchorIndex: index };
        const { sourceSide, targetSide, sortAxis } = edgeAnchorSides(sourceRect, targetRect);
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
            const slotOffset = role === 'source' ? 0 : peerEntries.length;
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
