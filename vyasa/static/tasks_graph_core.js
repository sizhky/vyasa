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
    group: { width: 250, minHeight: 80, padX: 24, padY: 20, reserveX: 24 },
    task: { width: 220, minHeight: 60, padX: 24, padY: 20, reserveX: 0 },
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

export function sizeTaskNode(label, kind = 'task') {
    const spec = TASK_NODE_SPECS[kind] || TASK_NODE_SPECS.task;
    const maxTextWidth = Math.max(32, spec.width - spec.padX - spec.reserveX);
    const lines = String(label || '')
        .split(/\r?\n/)
        .reduce((count, part) => count + Math.max(1, Math.ceil(measureTextWidth(part) / maxTextWidth)), 0);
    const textHeight = Math.max(20, lines * 16.25);
    return {
        width: spec.width,
        height: Math.max(spec.minHeight, Math.ceil(textHeight + spec.padY + 4)),
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

function edgeHandlePct(index, count) {
    if (count <= 1) return 50;
    return Math.max(18, Math.min(82, ((index + 1) / (count + 1)) * 100));
}

function edgeAnchorSides(sourceRect, targetRect) {
    const sourceCenterX = sourceRect.x + sourceRect.width / 2;
    const sourceCenterY = sourceRect.y + sourceRect.height / 2;
    const targetCenterX = targetRect.x + targetRect.width / 2;
    const targetCenterY = targetRect.y + targetRect.height / 2;
    const dx = targetCenterX - sourceCenterX;
    const dy = targetCenterY - sourceCenterY;
    if (Math.abs(dx) > 1 && Math.abs(dy / dx) < 1) {
        return dx >= 0
            ? { sourceSide: 'right', targetSide: 'left', sortAxis: 'y' }
            : { sourceSide: 'left', targetSide: 'right', sortAxis: 'y' };
    }
    const sourceSide = dy >= 0 ? 'bottom' : 'top';
    const targetSide = sourceSide === 'bottom' ? 'top' : 'bottom';
    return { sourceSide, targetSide, sortAxis: 'x' };
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
            entries.sort((a, b) => (a.sortValue - b.sortValue) || (a.edge._anchorIndex - b.edge._anchorIndex));
            const handles = entries.map(({ edge }, index) => {
                const handleId = `${role}-${side}-${index}`;
                if (role === 'source') edge.sourceHandle = handleId;
                else edge.targetHandle = handleId;
                return { id: handleId, side, offsetPct: edgeHandlePct(index, entries.length) };
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
