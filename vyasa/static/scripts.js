import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
import { D2 } from 'https://esm.sh/@terrastruct/d2@0.1.33?bundle';
import ELK from 'https://esm.sh/elkjs@0.10.0';
import { clampScale, nextWheelState, sizeTaskNode } from './tasks_graph_core.js';
const mermaidStates = {};
const d2States = {};
const tasksElk = new ELK();
let tasksReactFlowReady = null;
const TASKS_GROUP_PADDING = { top: 56, right: 28, bottom: 28, left: 28 };
const TASKS_ROOT_SPACING = { node: 12, layer: 24 };
const TASKS_EXPANSION_SHIFT_RATIO = 0.45;
const TASKS_ROOT_COLLISION_GAP = 48;
const TASKS_GROUP_Z = 100;
const TASKS_EDGE_Z = 1000;
const TASKS_TASK_Z = 10000;
const TASKS_TITLE_Z = TASKS_EDGE_Z + 1;
const TASKS_NODE_BG = 'color-mix(in srgb, var(--vyasa-paper) 86%, var(--vyasa-primary) 14%)';
const TASKS_GROUP_EXPANDED_BG = 'var(--vyasa-paper)';
const TASKS_NODE_BORDER = '1px solid color-mix(in srgb, var(--vyasa-paper) 42%, var(--vyasa-primary) 58%)';
const TASKS_GROUP_TITLE_BG = 'color-mix(in srgb, var(--vyasa-paper) 76%, var(--vyasa-primary) 24%)';
const TASKS_NODE_BG_ACTIVE = 'color-mix(in srgb, var(--vyasa-paper) 74%, var(--vyasa-primary) 26%)';
window.__vyasaTasksActions = window.__vyasaTasksActions || {};

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
    const visibleTasks = new Set();
    for (const groupId of expanded) {
        (model.group_tree?.[groupId] || []).forEach((id) => visibleGroups.add(id));
        (model.task_children?.[groupId] || []).forEach((id) => visibleTasks.add(id));
    }
    const visibleNodes = [
        ...Array.from(visibleGroups).map((id) => ({ id, label: groupsById[id]?.label || id, kind: 'group', ...sizeTaskNode(groupsById[id]?.label || id, 'group') })),
        ...Array.from(visibleTasks).map((id) => ({ id, label: tasksById[id]?.label || id, kind: 'task', ...sizeTaskNode(tasksById[id]?.label || id, 'task') })),
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
        const key = `${src}->${dst}`;
        if (src !== dst && !seen.has(key)) {
            seen.add(key);
            visibleEdges.push({ source: src, target: dst });
        }
    }
    return { nodes: visibleNodes, edges: visibleEdges };
}

function normalizeTasksGraphNodes(graph, model) {
    const groupsById = Object.fromEntries((model.groups || []).map((g) => [g.id, g]));
    const tasksById = Object.fromEntries((model.tasks || []).map((t) => [t.id, t]));
    return {
        ...graph,
        nodes: (graph.nodes || []).map((node) => {
            const kind = node.kind || (groupsById[node.id] ? 'group' : 'task');
            const label = node.label || groupsById[node.id]?.label || tasksById[node.id]?.label || node.id;
            return { ...node, kind, label, ...sizeTaskNode(label, kind) };
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
    return edges.filter((edge) => !canReach(edge.source, edge.target, `${edge.source}->${edge.target}`));
}

async function layoutTasksGraph(graph, model, expanded) {
    const nodeMap = Object.fromEntries(graph.nodes.map((n) => [n.id, n]));
    const layoutEdges = reduceTransitiveEdges(graph.edges || []);
    const parentOf = {};
    const expandedGroupSizes = {};

    for (const n of graph.nodes) {
        if (n.kind === 'group' && expanded.has(n.id)) {
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
                'elk.direction': 'DOWN',
                'elk.spacing.nodeNode': '40',
                'elk.layered.spacing.nodeNodeBetweenLayers': '60',
                'elk.padding': `[top=${TASKS_GROUP_PADDING.top},left=${TASKS_GROUP_PADDING.left},bottom=${TASKS_GROUP_PADDING.bottom},right=${TASKS_GROUP_PADDING.right}]`
            };
        }
        return node;
    };

    for (const gid of expanded) {
        if (!graph.nodes.some((n) => n.id === gid && n.kind === 'group')) continue;
        const childGroups = (model.group_tree?.[gid] || []).filter((cg) => graph.nodes.some((gn) => gn.id === cg));
        const childTasks = (model.task_children?.[gid] || []).filter((ct) => graph.nodes.some((tn) => tn.id === ct));
        const allChildren = [...childGroups, ...childTasks];
        if (allChildren.length === 0) continue;
        const childGraph = {
            id: `sub-${gid}`,
            layoutOptions: {
                'elk.algorithm': 'layered',
                'elk.direction': 'DOWN',
                'elk.spacing.nodeNode': '40',
                'elk.layered.spacing.nodeNodeBetweenLayers': '60',
                'elk.padding': `[top=${TASKS_GROUP_PADDING.top},left=${TASKS_GROUP_PADDING.left},bottom=${TASKS_GROUP_PADDING.bottom},right=${TASKS_GROUP_PADDING.right}]`
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
                'elk.direction': 'DOWN',
                'elk.spacing.nodeNode': '40',
                'elk.layered.spacing.nodeNodeBetweenLayers': '60',
                'elk.padding': `[top=${TASKS_GROUP_PADDING.top},left=${TASKS_GROUP_PADDING.left},bottom=${TASKS_GROUP_PADDING.bottom},right=${TASKS_GROUP_PADDING.right}]`
            };
        }
        return node;
    };

    const topLevel = adjustedNodes.filter((n) => !parentOf[n.id]);
    const rootLayoutOptions = {
        'elk.algorithm': 'layered',
        'elk.direction': 'DOWN',
        'elk.spacing.nodeNode': `${TASKS_ROOT_SPACING.node}`,
        'elk.layered.spacing.nodeNodeBetweenLayers': `${TASKS_ROOT_SPACING.layer}`,
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
        relPosMap[node.id] = { x: node.x || 0, y: node.y || 0 };
        absPosMap[node.id] = { x: (node.x || 0) + offsetX, y: (node.y || 0) + offsetY };
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

async function layoutBaseTasksGraph(graph, model) {
    const rootGroupIds = new Set(model.group_tree?.["null"] || []);
    const taskToGroup = Object.fromEntries((model.tasks || []).map((t) => [t.id, t.group_id || null]));
    const groupParent = Object.fromEntries((model.groups || []).map((g) => [g.id, g.parent_group_id || null]));

    const getRoot = (id) => {
        let cur = id;
        while (groupParent[cur]) {
            cur = groupParent[cur];
        }
        return cur;
    };

    const rootEdges = new Set();
    for (const edge of (model.dependency_edges || [])) {
        const srcGroup = taskToGroup[edge.source] || edge.source;
        const dstGroup = taskToGroup[edge.target] || edge.target;
        const srcRoot = getRoot(srcGroup);
        const dstRoot = getRoot(dstGroup);
        if (srcRoot !== dstRoot && rootGroupIds.has(srcRoot) && rootGroupIds.has(dstRoot)) {
            rootEdges.add(JSON.stringify([srcRoot, dstRoot]));
        }
    }

    const rootGraph = {
        nodes: graph.nodes.filter(n => rootGroupIds.has(n.id)),
        edges: Array.from(rootEdges).map(e => {
            const [src, dst] = JSON.parse(e);
            return { source: src, target: dst };
        })
    };
    console.log('rootGraph:', { nodes: rootGraph.nodes.map(n => n.id), edges: rootGraph.edges });
    const laidOut = await layoutTasksGraph(rootGraph, model, new Set());
    console.log('laidOut:', { width: laidOut.width, height: laidOut.height, positions: laidOut.absoluteChildPositions });
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

async function layoutGroupInternal(groupId, model, childSizes = {}) {
    const groupsById = Object.fromEntries((model.groups || []).map((group) => [group.id, group]));
    const tasksById = Object.fromEntries((model.tasks || []).map((task) => [task.id, task]));
    const groupChildren = [
        ...(model.group_tree?.[groupId] || []).map((id) => ({ id, kind: 'group', label: groupsById[id]?.label || id, ...sizeTaskNode(groupsById[id]?.label || id, 'group') })),
        ...(model.task_children?.[groupId] || []).map((id) => ({ id, kind: 'task', label: tasksById[id]?.label || id, ...sizeTaskNode(tasksById[id]?.label || id, 'task') })),
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
            if (cur === groupId) return id;
            cur = groupParent[cur] || null;
        }
        return null;
    };
    const seenProjectedEdges = new Set();
    const projectedEdges = [];
    for (const edge of (model.dependency_edges || [])) {
        const source = directChildFor(edge.source);
        const target = directChildFor(edge.target);
        if (!childIds.has(source) || !childIds.has(target) || source === target) continue;
        const key = `${source}->${target}`;
        if (seenProjectedEdges.has(key)) continue;
        seenProjectedEdges.add(key);
        projectedEdges.push({ source, target });
    }
    const reducedProjectedEdges = reduceTransitiveEdges(projectedEdges);
    const laidOut = await tasksElk.layout({
        id: `group-${groupId}`,
        layoutOptions: {
            'elk.algorithm': 'layered',
            'elk.direction': 'DOWN',
            'elk.spacing.nodeNode': '40',
            'elk.layered.spacing.nodeNodeBetweenLayers': '60',
            'elk.padding': `[top=${TASKS_GROUP_PADDING.top},left=${TASKS_GROUP_PADDING.left},bottom=${TASKS_GROUP_PADDING.bottom},right=${TASKS_GROUP_PADDING.right}]`,
        },
        children: groupChildren.map((child) => ({ id: child.id, width: child.width, height: child.height })),
        edges: reducedProjectedEdges.map((edge, index) => ({ id: `e${index}`, sources: [edge.source], targets: [edge.target] })),
    });
    const positions = {};
    for (const child of (laidOut.children || [])) {
        positions[child.id] = { x: child.x || 0, y: child.y || 0, width: child.width || 0, height: child.height || 0 };
    }
    return {
        positions,
        bbox: {
            width: Math.max(laidOut.width || 0, 250),
            height: Math.max(laidOut.height || 0, 80),
        },
    };
}

async function layoutExpandedGroups(model, expandedSet) {
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
        layouts[groupId] = await layoutGroupInternal(groupId, model, childSizes);
    }
    return layouts;
}

function deriveSquishedExpandedLayout(baseGraph, model, expandedSet, baseLayout, groupLayouts) {
    const visible = buildVisibleTasksGraph(model, expandedSet);
    console.log('visible graph:', { nodes: visible.nodes.map(n => n.id), edges: visible.edges });
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
        const taskToGroup = Object.fromEntries((model.tasks || []).map((task) => [task.id, task.group_id || null]));
        const groupParent = Object.fromEntries((model.groups || []).map((group) => [group.id, group.parent_group_id || null]));
        const topLevelIdSet = new Set(topLevelIds);
        const rootFor = (id) => {
            let cur = taskToGroup[id] || id;
            while (cur && !topLevelIdSet.has(cur)) cur = groupParent[cur] || null;
            return cur;
        };
        const rootDependencyEdges = [];
        const seenRootDependencyEdges = new Set();
        for (const edge of (model.dependency_edges || [])) {
            const source = rootFor(edge.source);
            const target = rootFor(edge.target);
            const key = `${source}->${target}`;
            if (!source || !target || source === target || seenRootDependencyEdges.has(key)) continue;
            seenRootDependencyEdges.add(key);
            rootDependencyEdges.push({ source, target });
        }
        for (let pass = 0; pass < 4; pass += 1) {
            for (const edge of rootDependencyEdges) {
                const source = topLevelState[edge.source];
                const target = topLevelState[edge.target];
                if (!source || !target) continue;
                target.y = Math.max(target.y, source.y + source.height + TASKS_ROOT_COLLISION_GAP);
            }
            for (let i = 0; i < topLevelStateList.length; i += 1) {
                const a = topLevelStateList[i];
                for (let j = i + 1; j < topLevelStateList.length; j += 1) {
                    const b = topLevelStateList[j];
                    const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
                    const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
                    if (overlapX <= -TASKS_ROOT_COLLISION_GAP || overlapY <= -TASKS_ROOT_COLLISION_GAP) continue;
                    if (Math.abs((a.x + a.width / 2) - (b.x + b.width / 2)) < Math.abs((a.y + a.height / 2) - (b.y + b.height / 2))) {
                        b.y = a.y + a.height + TASKS_ROOT_COLLISION_GAP;
                    } else {
                        b.x = a.x + a.width + TASKS_ROOT_COLLISION_GAP;
                    }
                }
            }
        }

        for (const node of nodes.filter((n) => !n.parentId)) {
            const state = topLevelState[node.id];
            if (!state) continue;
            node.position = { x: state.x, y: state.y };
        }

        console.log('[unwarp] topLevelNodes:', nodes.filter(n => !n.parentId).map(n => ({
            id: n.id,
            x: Math.round(n.position.x),
            y: Math.round(n.position.y)
        })));
    }

    const finalEdges = visible.edges.map((e, i) => ({
        id: `${e.source}-${e.target}-${i}`,
        source: e.source,
        target: e.target,
        sourceHandle: 'bottom',
        targetHandle: 'top',
    }));
    console.log('deriveSquishedExpandedLayout:', { visibleEdges: visible.edges, finalEdges });
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
        const bg = n.kind === 'group' ? 'color-mix(in srgb, currentColor 6%, transparent)' : 'color-mix(in srgb, currentColor 10%, transparent)';
        const exp = n.kind === 'group' ? '<div data-node-expander="true" style="position:absolute;right:10px;top:8px;font-size:18px;opacity:.55">+</div>' : '';
        return `<div class="vyasa-task-card" data-node-id="${n.id}" data-node-kind="${n.kind}" style="position:absolute;left:${p.x}px;top:${p.y}px;width:${n.width}px;height:${n.height}px;border:1px solid color-mix(in srgb, currentColor 35%, transparent);border-radius:14px;background:${bg};display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:600;text-align:center;padding:8px;cursor:${n.kind === 'group' ? 'pointer' : 'default'}"><span>${n.label}</span>${exp}</div>`;
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

async function renderTasksGraphs(rootElement = document) {
    const rf = await ensureTasksReactFlow();
    for (const wrapper of rootElement.querySelectorAll('.tasks-container[data-tasks-widget="true"]')) {
        if (wrapper.dataset.tasksMounted === 'true') return;
        const mount = wrapper.querySelector('.vyasa-tasks-flow');
        if (!mount || !rf) return;
        const model = JSON.parse(wrapper.dataset.tasksPayload || '{"groups":[],"tasks":[],"group_tree":{},"task_children":{},"dependency_edges":[]}');
        const rawGraph = normalizeTasksGraphNodes(JSON.parse(wrapper.dataset.tasksGraph || '{"nodes":[],"edges":[]}'), model);
        const widgetId = wrapper.id;
        const defaultOpenDepth = Number.parseInt(wrapper.dataset.tasksDefaultOpenDepth || '0', 10);
        const initialExpandedSet = collectExpandedGroupsByDepth(model.group_tree, Number.isNaN(defaultOpenDepth) ? 0 : defaultOpenDepth);
        const TasksGraphApp = (props) => {
            const React = window.React;
            const Handle = rf.Handle;
            const Position = rf.Position;
            const baseLayoutRef = React.useRef(null);
            const groupLayoutsRef = React.useRef({});
            const graphBaseRef = React.useRef({ nodes: [], edges: [] });
            const flowWrapperRef = React.useRef(null);
            const [expanded, setExpanded] = React.useState(() => new Set(initialExpandedSet));
            const [selectedNodeId, setSelectedNodeId] = React.useState(null);
            const [graphRevision, setGraphRevision] = React.useState(0);
            const [nodes, setNodes] = React.useState([]);
            const [edges, setEdges] = React.useState([]);
            const pendingFitActionRef = React.useRef(null);
            const reactFlowApiRef = React.useRef(null);
            const prevExpandedCountRef = React.useRef(0);
            const panViewport = React.useCallback((reactFlow, dx, dy, duration = 120) => {
                const viewport = reactFlow.getViewport();
                return reactFlow.setViewport(
                    { x: viewport.x + dx, y: viewport.y + dy, zoom: viewport.zoom },
                    { duration, interpolate: 'linear' }
                );
            }, []);
            const ensureBaseLayout = React.useCallback(async () => {
                if (!baseLayoutRef.current) baseLayoutRef.current = await layoutBaseTasksGraph(rawGraph, model);
                return baseLayoutRef.current;
            }, [model]);
            const rebuildLayout = React.useCallback(async (expandedSet) => {
                const baseLayout = await ensureBaseLayout();
                groupLayoutsRef.current = await layoutExpandedGroups(model, expandedSet);
                const rootGroupIds = new Set(model.group_tree?.["null"] || []);
                const rootGraph = {
                    nodes: rawGraph.nodes.filter(n => rootGroupIds.has(n.id)),
                    edges: (rawGraph.edges || []).filter(e => rootGroupIds.has(e.source) && rootGroupIds.has(e.target))
                };
                const derived = deriveSquishedExpandedLayout(rootGraph, model, expandedSet, baseLayout, groupLayoutsRef.current);
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
                    const isExpanded = n.kind === 'group' && expandedSet.has(n.id);
                    const depth = depthOf(n);
                    const nodeZ = n.kind !== 'group'
                        ? TASKS_TASK_Z + depth
                        : TASKS_GROUP_Z + depth;
                    const background = isExpanded ? TASKS_GROUP_EXPANDED_BG : TASKS_NODE_BG;
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
                            border: TASKS_NODE_BORDER,
                            borderRadius: isExpanded ? 12 : 6,
                            boxShadow: 'none',
                            overflow: 'hidden',
                        },
                        zIndex: nodeZ,
                    };
                    if (n.parentId) {
                        rfNode.parentId = n.parentId;
                        rfNode.extent = 'parent';
                    }
                    return rfNode;
                });
                for (const n of derived.nodes) {
                    if (n.kind !== 'group' || !expandedSet.has(n.id)) continue;
                    const position = absolutePosition(n);
                    const titleZ = TASKS_TITLE_Z + depthOf(n);
                    baseNodes.push({
                        id: `${n.id}__title`,
                        type: 'vyasaTask',
                        position: { x: position.x + 8, y: position.y + 8 },
                        data: { ...n, id: `${n.id}__title`, sourceGroupId: n.id, kind: 'groupTitle' },
                        style: {
                            width: Math.max(80, n.width - 16),
                            height: 34,
                            zIndex: titleZ,
                            background: TASKS_GROUP_TITLE_BG,
                            border: 'none',
                            borderRadius: 6,
                            boxShadow: 'none',
                            overflow: 'hidden',
                            pointerEvents: 'auto',
                        },
                        zIndex: titleZ,
                        draggable: false,
                        selectable: false,
                    });
                }
                const baseEdges = derived.edges.map((edge) => ({
                    ...edge,
                    type: 'default',
                    zIndex: TASKS_EDGE_Z,
                }));
                graphBaseRef.current = { nodes: baseNodes, edges: baseEdges };
                setNodes(baseNodes);
                setEdges(baseEdges);
                setGraphRevision((value) => value + 1);
            }, [ensureBaseLayout, model]);
            const defaultEdgeOptions = React.useMemo(() => ({
                zIndex: TASKS_EDGE_Z,
                style: { strokeWidth: 2.5, opacity: 1, stroke: 'currentColor' },
            }), []);
            const applyHighlight = React.useCallback((nodeId) => {
                const baseNodes = graphBaseRef.current.nodes || [];
                const baseEdges = graphBaseRef.current.edges || [];
                if (!nodeId || !baseNodes.some((node) => node.id === nodeId)) {
                    setNodes(baseNodes);
                    setEdges(baseEdges);
                    return;
                }
                const highlightedNodeIds = new Set([nodeId]);
                const highlightedEdgeIds = new Set();
                for (const edge of baseEdges) {
                    if (edge.source === nodeId || edge.target === nodeId) {
                        highlightedEdgeIds.add(edge.id);
                        highlightedNodeIds.add(edge.source);
                        highlightedNodeIds.add(edge.target);
                    }
                }
                const directEndpointIds = new Set([nodeId]);
                for (const edge of baseEdges) {
                    if (edge.source === nodeId || edge.target === nodeId) {
                        directEndpointIds.add(edge.source);
                        directEndpointIds.add(edge.target);
                    }
                }
                setNodes(baseNodes.map((node) => {
                    const mode = directEndpointIds.has(node.id)
                        ? (node.id === nodeId ? 'selected' : 'neighbor')
                        : 'dim';
                    return {
                        ...node,
                        data: { ...node.data, highlightMode: mode },
                        style: {
                            ...node.style,
                            background: mode === 'dim'
                                ? node.style.background
                                : TASKS_NODE_BG_ACTIVE,
                            opacity: mode === 'dim' ? 0.22 : 1,
                        },
                    };
                }));
                setEdges(baseEdges.map((edge) => {
                    const mode = highlightedEdgeIds.has(edge.id) ? 'selected' : 'dim';
                    const highlighted = mode !== 'dim';
                    return {
                        ...edge,
                        data: { ...edge.data, highlightMode: mode },
                        style: {
                            ...edge.style,
                            stroke: highlighted ? 'var(--vyasa-primary)' : 'color-mix(in srgb, var(--vyasa-ink) 38%, transparent)',
                            opacity: highlighted ? 0.95 : 0.16,
                            strokeWidth: mode === 'selected' ? 3.5 : 2.5,
                        },
                    };
                }));
            }, []);
            React.useEffect(() => {
                const baseNodeIds = new Set((graphBaseRef.current.nodes || []).map((node) => node.id));
                if (selectedNodeId && !baseNodeIds.has(selectedNodeId)) {
                    setSelectedNodeId(null);
                    return;
                }
                applyHighlight(selectedNodeId);
            }, [graphRevision, selectedNodeId, applyHighlight]);
            React.useEffect(() => {
                const nextCount = expanded.size;
                if (nextCount > prevExpandedCountRef.current) {
                    pendingFitActionRef.current = 'expand';
                }
                prevExpandedCountRef.current = nextCount;
            }, [expanded]);
            React.useEffect(() => {
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
            const CustomNode = React.memo(({ data, id }) => {
                if (data?.kind === 'groupTitle') {
                    const handleCollapse = (e) => {
                        e.stopPropagation();
                        const next = new Set(expanded);
                        next.delete(data.sourceGroupId);
                        setExpanded(next);
                    };
                    return React.createElement('div', {
                        style: {
                            width: '100%', height: '100%',
                            boxSizing: 'border-box',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '8px',
                            padding: '4px 6px',
                            fontWeight: '600',
                            fontSize: '13px',
                        }
                    },
                        React.createElement('span', {
                            style: {
                                minWidth: 0,
                                overflow: 'hidden',
                                whiteSpace: 'nowrap',
                                textOverflow: 'ellipsis',
                            }
                        }, data?.label || data.sourceGroupId || id),
                        React.createElement('button', {
                            onClick: handleCollapse,
                            style: { flex: '0 0 auto', border: 'none', background: 'none', cursor: 'pointer', fontSize: '18px', opacity: '0.55', padding: '0' }
                        }, '−')
                    );
                }
                const isGroup = data?.kind === 'group';
                const isExpanded = expanded.has(id);
                const highlightMode = data?.highlightMode || 'none';
                const isHighlighted = highlightMode === 'selected' || highlightMode === 'neighbor';
                const isDimmed = highlightMode === 'dim';
                const selectable = !isGroup;
                const handleExpand = (e) => {
                    e.stopPropagation();
                    const next = new Set(expanded);
                    if (isExpanded) next.delete(id); else next.add(id);
                    setExpanded(next);
                };
                if (isExpanded) {
                    return React.createElement('div', {
                        onClick: () => { if (isGroup) setSelectedNodeId(null); },
                        style: {
                            width: '100%', height: '100%',
                            boxSizing: 'border-box', display: 'flex', flexDirection: 'column', padding: '8px',
                            opacity: isDimmed ? 0.22 : 1,
                        }
                    },
                        Handle && React.createElement(Handle, { id: 'top', type: 'target', position: Position?.Top || 'top', style: { opacity: 0, pointerEvents: 'none' } }),
                        React.createElement('div', { style: { flex: 1, minHeight: '48px', position: 'relative' } }),
                        Handle && React.createElement(Handle, { id: 'bottom', type: 'source', position: Position?.Bottom || 'bottom', style: { opacity: 0, pointerEvents: 'none' } })
                    );
                }
                return React.createElement('div', {
                    onClick: () => { if (isGroup) setSelectedNodeId(null); },
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
                        cursor: isGroup ? 'pointer' : 'default',
                        padding: '10px 12px',
                        overflow: 'hidden',
                        opacity: isDimmed ? 0.22 : 1,
                    }
                },
                    Handle && React.createElement(Handle, { id: 'top', type: 'target', position: Position?.Top || 'top', style: { opacity: 0, pointerEvents: 'none' } }),
                    React.createElement('span', {
                        style: {
                            boxSizing: 'border-box',
                            width: '100%',
                            maxWidth: '100%',
                            maxHeight: '100%',
                            overflow: 'hidden',
                            display: 'block',
                            whiteSpace: 'normal',
                            lineHeight: '1.25',
                            overflowWrap: 'anywhere',
                            wordBreak: 'break-word',
                        }
                    }, data?.label || id),
                    isGroup && React.createElement('button', {
                        onClick: handleExpand,
                        style: { position: 'absolute', right: '8px', top: '8px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '18px', opacity: '0.55', padding: '0' }
                    }, '+'),
                    Handle && React.createElement(Handle, { id: 'bottom', type: 'source', position: Position?.Bottom || 'bottom', style: { opacity: 0, pointerEvents: 'none' } })
                );
            });
            React.useEffect(() => {
                rebuildLayout(expanded);
            }, [expanded, rebuildLayout]);
            const nodeTypes = React.useMemo(() => ({ vyasaTask: CustomNode }), [expanded]);
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
                        if (key === 'u') {
                            event.preventDefault();
                            if (event.shiftKey) {
                                setExpanded(new Set());
                            } else {
                                setExpanded(new Set((model.groups || []).map((group) => group.id)));
                            }
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
            const clearSelection = () => setSelectedNodeId(null);
            const ActionBridge = () => {
                const reactFlow = rf.useReactFlow();
                reactFlowApiRef.current = reactFlow;
                React.useEffect(() => {
                    window.__vyasaTasksActions[widgetId] = {
                        fit: () => reactFlow.fitView({ duration: 200, padding: 0.2, includeHiddenNodes: true }),
                        expand: () => {
                            setExpanded(new Set((model.groups || []).map((group) => group.id)));
                        },
                        collapse: () => {
                            pendingFitActionRef.current = 'collapse';
                            setExpanded(new Set());
                        },
                    };
                    return () => {
                        delete window.__vyasaTasksActions[widgetId];
                    };
                }, [reactFlow]);
                return null;
            };
            return rf.ReactFlowProvider ? window.React.createElement(rf.ReactFlowProvider, null,
                window.React.createElement('div', { ref: flowWrapperRef, tabIndex: 0, style: { width: '100%', height: '100%', outline: 'none' }, onPointerDown: () => flowWrapperRef.current?.focus({ preventScroll: true }) },
                    window.React.createElement(rf.ReactFlow, { nodes, edges, nodeTypes, defaultEdgeOptions, fitView: true, minZoom: 0.05, nodesDraggable: false, elementsSelectable: false, zIndexMode: 'manual', onNodeClick: (_, node) => { if (node.data?.kind !== 'task') return; setSelectedNodeId((current) => current === node.id ? null : node.id); }, onPaneClick: clearSelection, onPaneContextMenu: clearSelection },
                    window.React.createElement(rf.Background),
                    window.React.createElement(rf.Controls),
                    window.React.createElement(PanControls),
                    window.React.createElement(FitViewHotkey),
                    window.React.createElement(ActionBridge)
                    )
                )
            ) : window.React.createElement('div', { ref: flowWrapperRef, tabIndex: 0, style: { width: '100%', height: '100%', outline: 'none' }, onPointerDown: () => flowWrapperRef.current?.focus({ preventScroll: true }) },
                window.React.createElement(rf.ReactFlow, { nodes, edges, nodeTypes, defaultEdgeOptions, fitView: true, minZoom: 0.05, nodesDraggable: false, elementsSelectable: false, zIndexMode: 'manual', onNodeClick: (_, node) => { if (node.data?.kind !== 'task') return; setSelectedNodeId((current) => current === node.id ? null : node.id); }, onPaneClick: clearSelection, onPaneContextMenu: clearSelection },
                    window.React.createElement(rf.Background),
                    window.React.createElement(rf.Controls),
                    window.React.createElement(PanControls),
                    window.React.createElement(FitViewHotkey),
                    window.React.createElement(ActionBridge)
                )
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

const mermaidDebugEnabled = () => (
    window.VYASA_DEBUG_MERMAID === true ||
    localStorage.getItem('vyasaDebugMermaid') === '1'
);
const d2DebugEnabled = () => (
    window.VYASA_DEBUG_D2 === true ||
    localStorage.getItem('vyasaDebugD2') === '1'
);
const d2DebugLog = (...args) => {
    if (d2DebugEnabled()) {
        console.log('[vyasa][d2]', ...args);
    }
};
const mermaidDebugLog = (...args) => {
    if (mermaidDebugEnabled()) {
        console.log('[vyasa][mermaid]', ...args);
    }
};
const mermaidDebugSnapshot = (label) => {
    if (!mermaidDebugEnabled()) {
        return;
    }
    const wrappers = Array.from(document.querySelectorAll('.mermaid-wrapper'));
    const withSvg = wrappers.filter(w => w.querySelector('svg'));
    const interactive = wrappers.filter(w => w.dataset.mermaidInteractive === 'true');
    const last = wrappers[wrappers.length - 1];
    let lastRect = null;
    if (last) {
        const rect = last.getBoundingClientRect();
        lastRect = {
            id: last.id,
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            hasSvg: !!last.querySelector('svg'),
            interactive: last.dataset.mermaidInteractive === 'true'
        };
    }
    mermaidDebugLog(label, {
        total: wrappers.length,
        withSvg: withSvg.length,
        interactive: interactive.length,
        last: lastRect
    });
};
const GANTT_WIDTH = 1200;
let d2InstancePromise = null;

function getD2Instance() {
    if (!d2InstancePromise) {
        d2InstancePromise = Promise.resolve(new D2());
    }
    return d2InstancePromise;
}

function decodeHtmlEntities(value) {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = value;
    return textarea.value;
}

function normalizeD2SvgForBrowser(svg) {
    // Work around D2 animation script collisions that can emit duplicate
    // declarations like `const htmlElement` and break execution in-page.
    return svg.replace(/\b(?:const|let)\s+htmlElement\b/g, 'var htmlElement');
}

function coerceD2RenderToSvgMarkup(renderResult) {
    if (typeof renderResult === 'string') {
        return renderResult;
    }
    if (renderResult instanceof Uint8Array) {
        return new TextDecoder().decode(renderResult);
    }
    if (Array.isArray(renderResult)) {
        for (const item of renderResult) {
            try {
                const svg = coerceD2RenderToSvgMarkup(item);
                if (svg && svg.includes('<svg')) {
                    return svg;
                }
            } catch {
                // Keep trying other entries.
            }
        }
    }
    if (renderResult && typeof renderResult === 'object') {
        if (typeof renderResult.svg === 'string') {
            return renderResult.svg;
        }
        if (renderResult.data && typeof renderResult.data === 'string') {
            return renderResult.data;
        }
        if (typeof renderResult.markup === 'string') {
            return renderResult.markup;
        }
        for (const value of Object.values(renderResult)) {
            if (typeof value === 'string' && value.includes('<svg')) {
                return value;
            }
            if (value && typeof value === 'object') {
                try {
                    const nested = coerceD2RenderToSvgMarkup(value);
                    if (nested && nested.includes('<svg')) {
                        return nested;
                    }
                } catch {
                    // Continue checking other keys.
                }
            }
        }
    }
    throw new TypeError(`Unsupported D2 render result type: ${typeof renderResult}`);
}

function rehydrateScripts(container) {
    const scripts = Array.from(container.querySelectorAll('script'));
    scripts.forEach((oldScript) => {
        const newScript = document.createElement('script');
        Array.from(oldScript.attributes).forEach((attr) => {
            newScript.setAttribute(attr.name, attr.value);
        });
        newScript.textContent = oldScript.textContent || '';
        oldScript.replaceWith(newScript);
    });
}

function activateSvgAnimations(container) {
    const svg = container.querySelector('svg');
    if (!svg) {
        return;
    }
    try {
        if (typeof svg.unpauseAnimations === 'function') {
            svg.unpauseAnimations();
        }
        if (typeof svg.setCurrentTime === 'function') {
            svg.setCurrentTime(0);
        }
    } catch (error) {
        d2DebugLog('activateSvgAnimations error', error);
    }
}

function setD2ControlsEnabled(wrapper, enabled) {
    const container = wrapper.closest('.d2-container');
    if (!container) {
        return;
    }
    const controls = container.querySelector('.d2-controls');
    if (!controls) {
        return;
    }
    controls.querySelectorAll('button').forEach((button) => {
        button.disabled = !enabled;
        button.style.opacity = enabled ? '1' : '0.5';
        button.style.cursor = enabled ? 'pointer' : 'not-allowed';
    });
}

function ensureD2PanzoomStage(wrapper) {
    let stage = wrapper.querySelector('.d2-panzoom-stage');
    if (stage) {
        return stage;
    }
    const svg = wrapper.querySelector('svg');
    if (!svg) {
        return null;
    }
    stage = document.createElement('div');
    stage.className = 'd2-panzoom-stage w-full h-full flex items-center justify-center';
    stage.style.transformOrigin = 'center center';
    svg.replaceWith(stage);
    stage.appendChild(svg);
    return stage;
}

function isDarkModeActive() {
    return document.documentElement.classList.contains('dark');
}

function parseOptionalNumber(value) {
    if (value === null || value === undefined || value === '') {
        return undefined;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
}

function parseOptionalBoolean(value) {
    if (value === null || value === undefined || value === '') {
        return undefined;
    }
    const normalized = String(value).trim().toLowerCase();
    if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
        return true;
    }
    if (normalized === 'false' || normalized === '0' || normalized === 'no') {
        return false;
    }
    return undefined;
}

function normalizeD2Target(value) {
    if (value === null || value === undefined) {
        return undefined;
    }
    const trimmed = String(value).trim();
    if (trimmed === '""' || trimmed === "''" || trimmed === '') {
        // D2 multi-board target uses wildcard patterns (e.g. layers.x.*).
        // Treat empty target as wildcard-all for composition animation.
        return '*';
    }
    return trimmed;
}

function hasD2SubstitutionBraceError(error) {
    return String(error).includes('substitutions must begin on {');
}

function escapeBareD2SubstitutionDollars(source) {
    // D2 treats `$` as the start of a substitution. Escape bare dollars so
    // values like "$100" or shell snippets don't fail parsing.
    let escaped = '';
    for (let i = 0; i < source.length; i += 1) {
        const char = source[i];
        if (char !== '$') {
            escaped += char;
            continue;
        }
        const previous = source[i - 1];
        const next = source[i + 1];
        if (previous === '\\' || next === '{') {
            escaped += '$';
            continue;
        }
        escaped += '\\$';
    }
    return escaped;
}

function replaceBareD2SubstitutionDollarsWithFullwidth(source) {
    let replaced = '';
    for (let i = 0; i < source.length; i += 1) {
        const char = source[i];
        if (char !== '$') {
            replaced += char;
            continue;
        }
        const next = source[i + 1];
        if (next === '{') {
            replaced += '$';
            continue;
        }
        replaced += '＄';
    }
    return replaced;
}

async function renderD2Diagrams(rootElement = document) {
    const wrappers = Array.from(rootElement.querySelectorAll('.d2-wrapper'));
    if (!wrappers.length) {
        return;
    }
    const totalStart = performance.now();
    let d2;
    try {
        const loadStart = performance.now();
        d2 = await getD2Instance();
        d2DebugLog('library ready', { wrappers: wrappers.length, ms: performance.now() - loadStart });
    } catch (error) {
        console.error('Failed to initialize D2 renderer', error);
        return;
    }
    for (const wrapper of wrappers) {
        const source = wrapper.getAttribute('data-d2-code');
        if (!source) {
            continue;
        }
        const decodedSource = decodeHtmlEntities(source);
        if (wrapper.id) {
            delete d2States[wrapper.id];
            delete wrapper.dataset.d2Interactive;
        }
        try {
            const layout = wrapper.getAttribute('data-d2-layout') || 'elk';
            const themeId = parseOptionalNumber(wrapper.getAttribute('data-d2-theme-id'));
            const darkThemeId = parseOptionalNumber(wrapper.getAttribute('data-d2-dark-theme-id'));
            const sketch = parseOptionalBoolean(wrapper.getAttribute('data-d2-sketch'));
            const pad = parseOptionalNumber(wrapper.getAttribute('data-d2-pad'));
            const scale = parseOptionalNumber(wrapper.getAttribute('data-d2-scale'));
            const target = wrapper.getAttribute('data-d2-target');
            const animateInterval = parseOptionalNumber(wrapper.getAttribute('data-d2-animate-interval'));
            const animate = parseOptionalBoolean(wrapper.getAttribute('data-d2-animate'));

            const compileOptions = {};
            compileOptions.layout = layout;
            if (sketch !== undefined) {
                compileOptions.sketch = sketch;
            }
            // For compositions, target selection must happen at compile-time.
            const normalizedTarget = normalizeD2Target(target);
            if (normalizedTarget !== undefined) {
                compileOptions.target = normalizedTarget;
            }

            let result;
            try {
                const compileStart = performance.now();
                result = await d2.compile(decodedSource, compileOptions);
                d2DebugLog('compile complete', { id: wrapper.id, ms: performance.now() - compileStart });
            } catch (compileError) {
                if (!hasD2SubstitutionBraceError(compileError)) {
                    throw compileError;
                }
                const escapedSource = escapeBareD2SubstitutionDollars(decodedSource);
                const fullwidthSource = replaceBareD2SubstitutionDollarsWithFullwidth(decodedSource);
                if (escapedSource === decodedSource && fullwidthSource === decodedSource) {
                    throw compileError;
                }
                d2DebugLog('retrying compile after normalizing bare $ substitutions', {
                    id: wrapper.id,
                    sourcePreview: decodedSource.slice(0, 120)
                });
                try {
                    result = await d2.compile(escapedSource, compileOptions);
                } catch (secondCompileError) {
                    if (!hasD2SubstitutionBraceError(secondCompileError)) {
                        throw secondCompileError;
                    }
                    result = await d2.compile(fullwidthSource, compileOptions);
                    result.__vyasaFullwidthDollarFallback = true;
                }
            }
            const renderOptions = { ...(result.renderOptions || result.options || {}) };
            if (themeId !== undefined) {
                renderOptions.themeID = themeId;
            }
            if (darkThemeId !== undefined) {
                renderOptions.darkThemeID = darkThemeId;
            }
            if (themeId !== undefined || darkThemeId !== undefined) {
                const activeThemeId = isDarkModeActive()
                    ? (darkThemeId !== undefined ? darkThemeId : themeId)
                    : (themeId !== undefined ? themeId : darkThemeId);
                if (activeThemeId !== undefined) {
                    renderOptions.themeID = activeThemeId;
                }
            }
            if (pad !== undefined) {
                renderOptions.pad = pad;
            }
            if (scale !== undefined) {
                renderOptions.scale = scale;
            }
            if (normalizedTarget !== undefined) {
                renderOptions.target = normalizedTarget;
            }
            if (animateInterval !== undefined) {
                renderOptions.animateInterval = animateInterval;
            } else if (animate === true) {
                renderOptions.animateInterval = 1200;
            }
            // D2 compositions need target="" + animateInterval>0 to emit animated multi-board SVG.
            // If user requests animation but omits target, default to all boards.
            if (
                renderOptions.animateInterval > 0 &&
                (renderOptions.target === undefined || renderOptions.target === null)
            ) {
                renderOptions.target = '*';
            }
            if (
                renderOptions.animateInterval > 0 &&
                (compileOptions.target === undefined || compileOptions.target === null)
            ) {
                compileOptions.target = '*';
            }
            const isAnimated = Number(renderOptions.animateInterval || 0) > 0;
            wrapper.dataset.d2Animated = isAnimated ? 'true' : 'false';
            setD2ControlsEnabled(wrapper, true);
            d2DebugLog('render options', {
                id: wrapper.id,
                layout: compileOptions.layout,
                sketch: compileOptions.sketch,
                compileTarget: compileOptions.target,
                themeID: renderOptions.themeID,
                darkThemeID: renderOptions.darkThemeID,
                target: renderOptions.target,
                animateInterval: renderOptions.animateInterval
            });
            const renderStart = performance.now();
            const rawRenderResult = await d2.render(result.diagram, renderOptions);
            d2DebugLog('render complete', { id: wrapper.id, ms: performance.now() - renderStart });
            const svgMarkup = coerceD2RenderToSvgMarkup(rawRenderResult);
            let normalizedSvg = normalizeD2SvgForBrowser(svgMarkup);
            if (result.__vyasaFullwidthDollarFallback) {
                normalizedSvg = normalizedSvg.replaceAll('＄', '$');
            }
            const hydrateStart = performance.now();
            wrapper.innerHTML = normalizedSvg;
            rehydrateScripts(wrapper);
            activateSvgAnimations(wrapper);
            ensureD2PanzoomStage(wrapper);
            wrapper.dataset.d2Rendered = 'true';
            d2DebugLog('svg hydrated', { id: wrapper.id, ms: performance.now() - hydrateStart });
            const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            d2DebugLog('rendered', {
                id: wrapper.id,
                animated: normalizedSvg.includes('animation') || normalizedSvg.includes('@keyframes'),
                hasHtmlElementScript: normalizedSvg.includes('htmlElement'),
                hasScriptTag: normalizedSvg.includes('<script'),
                hasSmilAnimateTag: normalizedSvg.includes('<animate'),
                prefersReducedMotion
            });
        } catch (error) {
            console.error('Failed to render D2 diagram', error);
            if (d2DebugEnabled()) {
                d2DebugLog('render failure details', {
                    id: wrapper.id,
                    error: String(error),
                    sourcePreview: decodedSource.slice(0, 120)
                });
            }
        }
    }
    d2DebugLog('renderD2Diagrams complete', { wrappers: wrappers.length, ms: performance.now() - totalStart });
    initD2Interaction(rootElement);
}

function initD2Interaction(rootElement = document) {
    const wrappers = Array.from(rootElement.querySelectorAll('.d2-wrapper'));
    wrappers.forEach((wrapper) => {
        const svg = wrapper.querySelector('svg');
        const stage = ensureD2PanzoomStage(wrapper);
        const inReveal = !!wrapper.closest('.reveal');
        if (!svg || !stage || wrapper.dataset.d2Interactive === 'true') {
            return;
        }
        if (inReveal) {
            stage.style.transform = 'none';
            stage.style.transformOrigin = 'center center';
            stage.style.display = 'flex';
            stage.style.justifyContent = 'center';
            stage.style.alignItems = 'center';
            svg.style.display = 'block';
            svg.style.margin = '0 auto';
        }

        const wrapperRect = wrapper.getBoundingClientRect();
        const svgRect = svg.getBoundingClientRect();
        if (!svgRect.width || !svgRect.height) {
            return;
        }
        const scaleX = (wrapperRect.width - 32) / svgRect.width;
        const scaleY = (wrapperRect.height - 32) / svgRect.height;
        const aspectRatio = svgRect.width / svgRect.height;
        const maxUpscale = 1;
        let initialScale = aspectRatio > 3
            ? Math.min(scaleX, maxUpscale)
            : Math.min(scaleX, scaleY, maxUpscale);
        if (inReveal) {
            try {
                const vb = (svg.getAttribute('viewBox') || '').trim().split(/\s+/).map(Number);
                const box = svg.getBBox ? svg.getBBox() : null;
                if (vb.length === 4 && box && box.width > 1 && box.height > 1) {
                    const vbW = vb[2];
                    const vbH = vb[3];
                    if (Number.isFinite(vbW) && Number.isFinite(vbH) && vbW > 1 && vbH > 1) {
                        const fitFromBounds = Math.min(vbW / box.width, vbH / box.height);
                        if (Number.isFinite(fitFromBounds) && fitFromBounds > 1) {
                            initialScale = Math.min(fitFromBounds * 0.92, 6);
                        } else {
                            initialScale = 1;
                        }
                    } else {
                        initialScale = 1;
                    }
                } else {
                    initialScale = 1;
                }
            } catch (_) {
                initialScale = 1;
            }
        }

        const state = {
            scale: initialScale,
            translateX: 0,
            translateY: 0,
            isPanning: false,
            startX: 0,
            startY: 0
        };
        d2States[wrapper.id] = state;
        wrapper.dataset.d2Interactive = 'true';

        const getSvg = () => wrapper.querySelector('svg');
        const getStage = () => wrapper.querySelector('.d2-panzoom-stage');
        const applyState = () => {
            const currentStage = getStage();
            if (!currentStage) {
                return;
            }
            const currentSvg = getSvg();
            if (currentSvg) {
                currentSvg.style.pointerEvents = 'none';
            }
            currentStage.style.transform = `translate(${state.translateX}px, ${state.translateY}px) scale(${state.scale})`;
            currentStage.style.transformOrigin = 'center center';
        };
        applyState();

        wrapper.style.cursor = 'grab';
        wrapper.style.touchAction = 'none';
        bindPanZoomGestures(wrapper, state, { getTarget: getStage, applyState });
    });
}

window.resetD2Zoom = function(id) {
    const state = d2States[id];
    const wrapper = document.getElementById(id);
    if (!state || !wrapper) {
        return;
    }
    state.scale = 1;
    state.translateX = 0;
    state.translateY = 0;
    const stage = wrapper.querySelector('.d2-panzoom-stage');
    if (stage) {
        stage.style.transform = 'translate(0px, 0px) scale(1)';
    }
};

window.zoomD2In = function(id) {
    const state = d2States[id];
    const wrapper = document.getElementById(id);
    if (!state || !wrapper) {
        return;
    }
    state.scale = Math.min(state.scale * 1.1, 10);
    const stage = wrapper.querySelector('.d2-panzoom-stage');
    if (stage) {
        stage.style.transform = `translate(${state.translateX}px, ${state.translateY}px) scale(${state.scale})`;
    }
};

window.zoomD2Out = function(id) {
    const state = d2States[id];
    const wrapper = document.getElementById(id);
    if (!state || !wrapper) {
        return;
    }
    state.scale = Math.max(state.scale * 0.9, 0.1);
    const stage = wrapper.querySelector('.d2-panzoom-stage');
    if (stage) {
        stage.style.transform = `translate(${state.translateX}px, ${state.translateY}px) scale(${state.scale})`;
    }
};

window.openD2Fullscreen = async function(id) {
    const wrapper = document.getElementById(id);
    if (!wrapper) return;

    const originalCode = wrapper.getAttribute('data-d2-code');
    if (!originalCode) return;
    const fullscreenTitle = wrapper.getAttribute('data-d2-fullscreen-title') || 'D2 Diagram';

    const existing = document.getElementById('d2-fullscreen-modal');
    if (existing) {
        existing.remove();
    }

    const modal = document.createElement('div');
    modal.id = 'd2-fullscreen-modal';
    modal.className = 'fixed inset-0 z-[10000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4';
    modal.style.animation = 'fadeIn 0.2s ease-in';

    const modalContent = document.createElement('div');
    modalContent.className = 'relative bg-white dark:bg-slate-900 rounded-lg shadow-2xl w-full h-full max-w-[95vw] max-h-[95vh] flex flex-col';

    const header = document.createElement('div');
    header.className = 'flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700';

    const title = document.createElement('h3');
    title.className = 'text-lg font-semibold text-slate-800 dark:text-slate-200';
    title.textContent = fullscreenTitle;

    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '✕';
    closeBtn.className = 'px-3 py-1 text-xl text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors';
    closeBtn.title = 'Close (Esc)';
    closeBtn.onclick = () => document.body.removeChild(modal);

    header.appendChild(title);
    header.appendChild(closeBtn);

    const diagramContainer = document.createElement('div');
    diagramContainer.className = 'flex-1 overflow-auto p-4 flex items-center justify-center';

    const fullscreenWrapper = document.createElement('div');
    fullscreenWrapper.className = 'd2-wrapper w-full h-full overflow-hidden flex items-center justify-center';
    fullscreenWrapper.id = `${id}-fullscreen`;
    fullscreenWrapper.setAttribute('data-d2-code', originalCode);
    Array.from(wrapper.attributes).forEach((attr) => {
        if (attr.name.startsWith('data-d2-') && attr.name !== 'data-d2-code') {
            fullscreenWrapper.setAttribute(attr.name, attr.value);
        }
    });
    fullscreenWrapper.style.minHeight = '80vh';
    fullscreenWrapper.style.height = '80vh';

    const pre = document.createElement('pre');
    pre.className = 'd2';
    pre.style.width = '100%';
    pre.style.height = '100%';
    pre.style.display = 'flex';
    pre.style.alignItems = 'center';
    pre.style.justifyContent = 'center';
    pre.textContent = decodeHtmlEntities(originalCode);
    fullscreenWrapper.appendChild(pre);

    diagramContainer.appendChild(fullscreenWrapper);
    modalContent.appendChild(header);
    modalContent.appendChild(diagramContainer);
    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    });

    const escHandler = (e) => {
        if (e.key === 'Escape' && document.getElementById('d2-fullscreen-modal')) {
            document.body.removeChild(modal);
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);

    await renderD2Diagrams(modal);
};

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
    fullscreenWrapper.className = 'tasks-container relative w-full h-full rounded-xl border border-slate-200 dark:border-slate-800';
    fullscreenWrapper.setAttribute('data-tasks-widget', 'true');
    fullscreenWrapper.setAttribute('data-tasks-fullscreen', 'true');
    fullscreenWrapper.setAttribute('data-tasks-title', originalTitle);
    fullscreenWrapper.setAttribute('data-tasks-default-open-depth', wrapper.getAttribute('data-tasks-default-open-depth') || '0');
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
    const expandHint = makeHint('U');
    expandHint.title = 'Expand all groups';
    const collapseHint = makeHint('⇧+U');
    collapseHint.title = 'Collapse all groups';
    headerHints.append(fitHint, expandHint, collapseHint);
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

function handleCodeCopyClick(event) {
    const button = event.target.closest('.code-copy-button, .hljs-copy-button');
    if (!button) {
        return;
    }
    event.preventDefault();
    event.stopPropagation();
    const container = button.closest('.code-block') || button.closest('pre') || button.parentElement;
    const codeEl = (container && container.querySelector('pre > code')) ||
        (container && container.querySelector('code')) ||
        button.closest('pre');
    if (!codeEl) {
        return;
    }
    const text = codeEl.innerText || codeEl.textContent || '';
    const showToast = () => {
        let toast = document.getElementById('code-copy-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'code-copy-toast';
            toast.className = 'fixed top-6 right-6 z-[10000] text-xs bg-slate-900 text-white px-3 py-2 rounded shadow-lg opacity-0 transition-opacity duration-300';
            toast.textContent = 'Copied';
            document.body.appendChild(toast);
        }
        toast.classList.remove('opacity-0');
        toast.classList.add('opacity-100');
        setTimeout(() => {
            toast.classList.remove('opacity-100');
            toast.classList.add('opacity-0');
        }, 1400);
    };
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(showToast).catch(() => {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.setAttribute('readonly', '');
            textarea.style.position = 'absolute';
            textarea.style.left = '-9999px';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            showToast();
        });
    } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'absolute';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showToast();
    }
}

document.addEventListener('click', handleCodeCopyClick, true);

function switchTab(tabsId, index) {
    const container = document.querySelector(`.tabs-container[data-tabs-id="${tabsId}"]`);
    if (!container) return;
    const buttons = container.querySelectorAll('.tab-button');
    buttons.forEach((btn, i) => btn.classList.toggle('active', i === index));
    const panels = container.querySelectorAll('.tab-panel');
    panels.forEach((panel, i) => {
        const active = i === index;
        panel.classList.toggle('active', active);
        panel.style.position = active ? 'relative' : 'absolute';
        panel.style.visibility = active ? 'visible' : 'hidden';
        panel.style.opacity = active ? '1' : '0';
        panel.style.pointerEvents = active ? 'auto' : 'none';
    });
    const activePanel = container.querySelector(`.tab-panel[data-tab-index="${index}"]`);
    if (activePanel) {
        const mermaidNodes = Array.from(activePanel.querySelectorAll('pre.mermaid'));
        if (mermaidNodes.length > 0) {
            mermaid.run({ nodes: mermaidNodes }).then(() => scheduleMermaidInteraction()).catch(() => {});
        } else {
            scheduleMermaidInteraction();
        }
        renderD2Diagrams(activePanel);
    }
    if (window.refreshVyasaTableScrollShadows) {
        requestAnimationFrame(() => window.refreshVyasaTableScrollShadows(container));
    }
}
window.switchTab = switchTab;

function initTabPanelHeights(rootElement = document) {
    const containers = rootElement.querySelectorAll('.tabs-container');
    containers.forEach((container) => {
        const panels = container.querySelectorAll('.tab-panel');
        let maxHeight = 0;
        panels.forEach((panel) => {
            const wasActive = panel.classList.contains('active');
            panel.style.position = 'relative';
            panel.style.visibility = 'visible';
            panel.style.opacity = '1';
            panel.style.pointerEvents = 'auto';
            maxHeight = Math.max(maxHeight, panel.offsetHeight);
            if (!wasActive) {
                panel.style.position = 'absolute';
                panel.style.visibility = 'hidden';
                panel.style.opacity = '0';
                panel.style.pointerEvents = 'none';
            }
        });
        const tabsContent = container.querySelector('.tabs-content');
        if (tabsContent && maxHeight > 0) tabsContent.style.minHeight = `${maxHeight}px`;
    });
}

function refreshVyasaTableScrollShadows(root = document) {
    const scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll('.vyasa-table-scroll').forEach((el) => {
        const table = el.querySelector('table');
        const parentWidth = el.parentElement ? el.parentElement.clientWidth : el.clientWidth;
        const tableWidth = table ? table.scrollWidth : el.scrollWidth;
        const needsBreakout = tableWidth > (parentWidth + 1);
        const viewportCap = Math.floor(window.innerWidth * 0.8);
        el.classList.toggle('vyasa-table-breakout', needsBreakout);
        if (needsBreakout) el.style.setProperty('--vyasa-breakout-width', `${Math.min(tableWidth, viewportCap)}px`);
        else el.style.removeProperty('--vyasa-breakout-width');
        const maxScrollLeft = Math.max(0, el.scrollWidth - el.clientWidth);
        el.classList.toggle('has-left-overflow', maxScrollLeft > 1 && el.scrollLeft > 1);
        el.classList.toggle('has-right-overflow', maxScrollLeft > 1 && el.scrollLeft < (maxScrollLeft - 1));
        if (el.dataset.shadowBound === '1') return;
        el.dataset.shadowBound = '1';
        el.addEventListener('scroll', () => refreshVyasaTableScrollShadows(el.parentElement || document), { passive: true });
    });
}

window.refreshVyasaTableScrollShadows = refreshVyasaTableScrollShadows;

function initMermaidInteraction() {
    const wrappers = Array.from(document.querySelectorAll('.mermaid-wrapper'));
    if (mermaidDebugEnabled()) {
        const pending = wrappers.filter(w => !w.querySelector('svg'));
        const last = wrappers[wrappers.length - 1];
        mermaidDebugLog('initMermaidInteraction: total', wrappers.length, 'pending', pending.length);
        if (last) {
            mermaidDebugLog('initMermaidInteraction: last wrapper', last.id, 'hasSvg', !!last.querySelector('svg'));
        }
    }
    wrappers.forEach((wrapper, idx) => {
        const wrapperRect = wrapper.getBoundingClientRect();
        if (wrapperRect.width < 8 || wrapperRect.height < 8) return;
        const svg = wrapper.querySelector('svg');
        const inReveal = !!wrapper.closest('.reveal');
        const alreadyInteractive = wrapper.dataset.mermaidInteractive === 'true';
        if (mermaidDebugEnabled()) {
            mermaidDebugLog(
                'initMermaidInteraction: wrapper',
                idx,
                wrapper.id,
                'hasSvg',
                !!svg,
                'interactive',
                alreadyInteractive
            );
        }
        const getSvg = () => wrapper.querySelector('svg');
        const applySvgState = (currentSvg) => {
            if (!currentSvg) {
                return;
            }
            currentSvg.style.pointerEvents = 'none';
            currentSvg.style.transform = `translate(${state.translateX}px, ${state.translateY}px) scale(${state.scale})`;
            currentSvg.style.transformOrigin = 'center center';
        };
        if (svg) {
            svg.style.pointerEvents = 'none';
        }
        if (!svg || alreadyInteractive) return;
        if (inReveal) {
            svg.style.display = 'block';
            svg.style.margin = '0 auto';
            svg.style.transformOrigin = 'center center';
        }
        
        // Scale SVG to fit container (maintain aspect ratio, fit to width or height whichever is smaller)
        const svgRect = svg.getBoundingClientRect();
        const viewBox = (svg.getAttribute('viewBox') || '').trim().split(/\s+/).map(Number);
        let bbox = null;
        try {
            bbox = svg.getBBox ? svg.getBBox() : null;
        } catch {
            bbox = null;
        }
        const hasStableViewBox = viewBox.length === 4 && viewBox[2] > 1 && viewBox[3] > 1;
        const hasStableBBox = !!bbox && bbox.width > 1 && bbox.height > 1;
        const isLayoutUnstable = (
            wrapperRect.height < 120 ||
            svgRect.height < 30 ||
            (!hasStableViewBox && !hasStableBBox) ||
            (svgRect.width < 30 && !hasStableViewBox && !hasStableBBox)
        );
        if (isLayoutUnstable) {
            if (mermaidDebugEnabled()) {
                mermaidDebugLog('skip initMermaidInteraction: reveal layout not stable', {
                    id: wrapper.id,
                    wrapperWidth: wrapperRect.width,
                    wrapperHeight: wrapperRect.height,
                    svgWidth: svgRect.width,
                    svgHeight: svgRect.height,
                    viewBox,
                    bbox
                });
            }
            return;
        }
        const innerWidth = Math.max(wrapperRect.width - 32, 1);   // 32 for p-4 padding
        const innerHeight = Math.max(wrapperRect.height - 32, 1);
        const scaleX = innerWidth / Math.max(svgRect.width, 1);
        const scaleY = innerHeight / Math.max(svgRect.height, 1);
        
        // For very wide diagrams (like Gantt charts), prefer width scaling even if it exceeds height
        const aspectRatio = svgRect.width / svgRect.height;
        const isFullscreenWrapper = wrapper.dataset.mermaidFullscreen === 'true';
        const maxUpscale = isFullscreenWrapper ? Number.POSITIVE_INFINITY : 1;
        let initialScale;
        if (aspectRatio > 3) {
            // Wide diagram: scale to fit width, but do not upscale by default
            initialScale = Math.min(scaleX, maxUpscale);
        } else {
            // Normal diagram: fit to smaller dimension, but do not upscale by default
            initialScale = Math.min(scaleX, scaleY, maxUpscale);
        }
        if (!Number.isFinite(initialScale) || initialScale <= 0) {
            // Hidden/unstable layout (e.g., Reveal transition state) can yield tiny or negative sizes.
            // Skip now and let a later ready/slidechanged pass initialize interaction.
            if (mermaidDebugEnabled()) {
                mermaidDebugLog('skip initMermaidInteraction: unstable scale', {
                    id: wrapper.id, wrapperRect, svgRect, scaleX, scaleY, initialScale
                });
            }
            return;
        }

        if (mermaidDebugEnabled()) {
            mermaidDebugLog('initMermaidInteraction: sizing', {
                id: wrapper.id,
                wrapperWidth: wrapperRect.width,
                wrapperHeight: wrapperRect.height,
                svgWidth: svgRect.width,
                svgHeight: svgRect.height,
                initialScale
            });
        }
        
        const state = {
            scale: initialScale,
            translateX: 0,
            translateY: 0,
            isPanning: false,
            startX: 0,
            startY: 0
        };
        mermaidStates[wrapper.id] = state;
        wrapper.dataset.mermaidInteractive = 'true';
        if (mermaidDebugEnabled() && !wrapper.dataset.mermaidDebugBound) {
            wrapper.dataset.mermaidDebugBound = 'true';
            const logEvent = (name, event) => {
                const target = event.target && event.target.tagName ? event.target.tagName : 'unknown';
                mermaidDebugLog(`${name} on ${wrapper.id}`, { type: event.type, target });
            };
            wrapper.addEventListener('pointerdown', (e) => logEvent('pointerdown', e));
            wrapper.addEventListener('pointermove', (e) => logEvent('pointermove', e));
            wrapper.addEventListener('pointerup', (e) => logEvent('pointerup', e));
            wrapper.addEventListener('wheel', (e) => logEvent('wheel', e));
        }
        
        function updateTransform() {
            applySvgState(getSvg());
        }
        
        // Apply initial scale
        updateTransform();

        if (!wrapper.dataset.mermaidObserver) {
            const observer = new MutationObserver(() => {
                applySvgState(getSvg());
            });
            observer.observe(wrapper, { childList: true, subtree: true });
            wrapper.dataset.mermaidObserver = 'true';
        }
        
        // Pan with pointer drag (mouse + touch)
        wrapper.style.cursor = 'grab';
        wrapper.style.touchAction = 'none';
        bindPanZoomGestures(wrapper, state, { getTarget: getSvg, applyState: updateTransform });
    });
}

function scheduleMermaidInteraction({ maxAttempts = 12, delayMs = 80, onReady } = {}) {
    let attempt = 0;
    const check = () => {
        const wrappers = Array.from(document.querySelectorAll('.mermaid-wrapper'));
        const pending = wrappers.filter(wrapper => !wrapper.querySelector('svg'));
        if (mermaidDebugEnabled()) {
            const last = wrappers[wrappers.length - 1];
            mermaidDebugLog('scheduleMermaidInteraction attempt', attempt, 'pending', pending.length);
            if (last) {
                mermaidDebugLog('scheduleMermaidInteraction last wrapper', last.id, 'hasSvg', !!last.querySelector('svg'));
            }
        }
        if (pending.length === 0 || attempt >= maxAttempts) {
            initMermaidInteraction();
            if (typeof onReady === 'function') {
                onReady();
            }
            return;
        }
        attempt += 1;
        setTimeout(check, delayMs);
    };
    check();
}

function renderMermaidInScope(scope = document) {
    const mermaidNodes = [];
    scope.querySelectorAll('.mermaid-wrapper').forEach((wrapper) => {
        if (!wrapper.id) {
            return;
        }
        delete mermaidStates[wrapper.id];
        delete wrapper.dataset.mermaidInteractive;
        if (wrapper.querySelector('svg')) {
            return;
        }
        let pre = wrapper.querySelector('pre.mermaid');
        if (!pre) {
            const encoded = wrapper.getAttribute('data-mermaid-code');
            if (!encoded) {
                return;
            }
            const textarea = document.createElement('textarea');
            textarea.innerHTML = encoded;
            const code = textarea.value;
            wrapper.innerHTML = '';
            pre = document.createElement('pre');
            pre.className = 'mermaid';
            pre.textContent = code;
            wrapper.appendChild(pre);
        }
        mermaidNodes.push(pre);
    });
    if (mermaidNodes.length > 0) {
        return mermaid.run({ nodes: mermaidNodes }).then(() => {
            scheduleMermaidInteraction();
        });
    }
    scheduleMermaidInteraction();
    return Promise.resolve();
}

function collectRenderableMermaidNodes(scope = document) {
    return Array.from(scope.querySelectorAll('pre.mermaid')).filter((node) => {
        return !node.closest('.vyasa-reveal-unit[data-reveal-state="hidden"]');
    });
}

window.vyasaRefreshDiagramInteractions = function(scope = document) {
    try {
        renderMermaidInScope(scope);
    } catch (_) {
        // Ignore if Mermaid is unavailable or still loading.
    }
    try {
        renderD2Diagrams(scope);
    } catch (_) {
        // Ignore if there are no D2 diagrams in scope.
    }
};

window.resetMermaidZoom = function(id) {
    const state = mermaidStates[id];
    if (state) {
        state.scale = 1;
        state.translateX = 0;
        state.translateY = 0;
        const svg = document.getElementById(id).querySelector('svg');
        svg.style.transform = 'translate(0px, 0px) scale(1)';
    }
};

window.zoomMermaidIn = function(id) {
    const state = mermaidStates[id];
    if (state) {
        state.scale = Math.min(state.scale * 1.1, 10);
        const svg = document.getElementById(id).querySelector('svg');
        svg.style.transform = `translate(${state.translateX}px, ${state.translateY}px) scale(${state.scale})`;
    }
};

window.zoomMermaidOut = function(id) {
    const state = mermaidStates[id];
    if (state) {
        state.scale = Math.max(state.scale * 0.9, 0.1);
        const svg = document.getElementById(id).querySelector('svg');
        svg.style.transform = `translate(${state.translateX}px, ${state.translateY}px) scale(${state.scale})`;
    }
};

window.openMermaidFullscreen = function(id) {
    const wrapper = document.getElementById(id);
    if (!wrapper) return;
    
    const originalCode = wrapper.getAttribute('data-mermaid-code');
    if (!originalCode) return;
    const mermaidTitle = wrapper.getAttribute('data-mermaid-title') || 'Diagram';
    
    // Decode HTML entities
    const textarea = document.createElement('textarea');
    textarea.innerHTML = originalCode;
    const code = textarea.value;
    
    // Create modal
    const modal = document.createElement('div');
    modal.id = 'mermaid-fullscreen-modal';
    modal.className = 'fixed inset-0 z-[10000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4';
    modal.style.animation = 'fadeIn 0.2s ease-in';
    
    // Create modal content container
    const modalContent = document.createElement('div');
    modalContent.className = 'relative bg-white dark:bg-slate-900 rounded-lg shadow-2xl w-full h-full max-w-[95vw] max-h-[95vh] flex flex-col';
    
    // Create header with close button
    const header = document.createElement('div');
    header.className = 'flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700';
    
    const title = document.createElement('h3');
    title.className = 'text-lg font-semibold text-slate-800 dark:text-slate-200';
    title.textContent = mermaidTitle;
    
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '✕';
    closeBtn.className = 'px-3 py-1 text-xl text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors';
    closeBtn.title = 'Close (Esc)';
    closeBtn.onclick = () => document.body.removeChild(modal);
    
    header.appendChild(title);
    header.appendChild(closeBtn);
    
    // Create diagram container
    const diagramContainer = document.createElement('div');
    diagramContainer.className = 'flex-1 overflow-auto p-4 flex items-center justify-center';
    
    const fullscreenId = `${id}-fullscreen`;
    const fullscreenWrapper = document.createElement('div');
    fullscreenWrapper.id = fullscreenId;
    fullscreenWrapper.className = 'mermaid-wrapper w-full h-full flex items-center justify-center';
    fullscreenWrapper.setAttribute('data-mermaid-code', originalCode);
    fullscreenWrapper.setAttribute('data-mermaid-fullscreen', 'true');
    
    const pre = document.createElement('pre');
    pre.className = 'mermaid';
    pre.textContent = code;
    fullscreenWrapper.appendChild(pre);
    
    diagramContainer.appendChild(fullscreenWrapper);
    
    // Assemble modal
    modalContent.appendChild(header);
    modalContent.appendChild(diagramContainer);
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
    
    // Close on Esc key
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            document.body.removeChild(modal);
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);
    
    // Close on background click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
            document.removeEventListener('keydown', escHandler);
        }
    });
    
    // Render mermaid in the fullscreen view
    mermaid.run({ nodes: [pre] }).then(() => {
        setTimeout(() => initMermaidInteraction(), 100);
    });
};

function getCurrentTheme() {
    return document.documentElement.classList.contains('dark') ? 'dark' : 'default';
}

const GOOGLE_FONT_QUERIES = {
    'Alegreya': 'family=Alegreya:wght@400;500;600;700',
    Arimo: 'family=Arimo:wght@400;500;600;700',
    Archivo: 'family=Archivo:wght@400;500;600;700',
    Asap: 'family=Asap:wght@400;500;600;700',
    Assistant: 'family=Assistant:wght@400;500;600;700;800',
    'Azeret Mono': 'family=Azeret+Mono:wght@400;500;600;700',
    'Be Vietnam Pro': 'family=Be+Vietnam+Pro:wght@400;500;600;700',
    Besley: 'family=Besley:wght@400;500;600;700',
    Bitter: 'family=Bitter:wght@400;500;600;700',
    'Bricolage Grotesque': 'family=Bricolage+Grotesque:wght@400;500;600;700',
    Cabin: 'family=Cabin:wght@400;500;600;700',
    Cardo: 'family=Cardo:wght@400;700',
    Chivo: 'family=Chivo:wght@400;500;600;700',
    'Crimson Pro': 'family=Crimson+Pro:wght@400;500;600;700',
    'Cutive Mono': 'family=Cutive+Mono',
    'DM Sans': 'family=DM+Sans:wght@400;500;700',
    Domine: 'family=Domine:wght@400;500;600;700',
    'EB Garamond': 'family=EB+Garamond:wght@400;500;600;700',
    'Fauna One': 'family=Fauna+One',
    Figtree: 'family=Figtree:wght@400;500;600;700;800',
    'Fira Code': 'family=Fira+Code:wght@400;500;600;700',
    'Hanken Grotesk': 'family=Hanken+Grotesk:wght@400;500;600;700;800',
    'Hepta Slab': 'family=Hepta+Slab:wght@400;500;600;700',
    'IBM Plex Mono': 'family=IBM+Plex+Mono:wght@400;500;600;700',
    Inconsolata: 'family=Inconsolata:wght@400;500;600;700',
    Inter: 'family=Inter:wght@400;500;600;700;800',
    'Instrument Serif': 'family=Instrument+Serif:ital@0;1',
    'JetBrains Mono': 'family=JetBrains+Mono:wght@400;500;600;700;800',
    Karla: 'family=Karla:wght@400;500;600;700;800',
    Lexend: 'family=Lexend:wght@400;500;600;700;800',
    'Libre Baskerville': 'family=Libre+Baskerville:wght@400;700',
    'Libre Franklin': 'family=Libre+Franklin:wght@400;500;600;700;800',
    Manrope: 'family=Manrope:wght@400;500;700;800',
    Merriweather: 'family=Merriweather:wght@400;700',
    'Merriweather Sans': 'family=Merriweather+Sans:wght@400;500;600;700;800',
    Montserrat: 'family=Montserrat:wght@400;500;600;700;800',
    Mulish: 'family=Mulish:wght@400;500;600;700;800',
    Newsreader: 'family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600',
    'Noto Serif': 'family=Noto+Serif:wght@400;500;600;700',
    'Nunito Sans': 'family=Nunito+Sans:wght@400;500;600;700;800',
    Onest: 'family=Onest:wght@400;500;600;700;800',
    'Plus Jakarta Sans': 'family=Plus+Jakarta+Sans:wght@400;500;600;700;800',
    'PT Serif': 'family=PT+Serif:wght@400;700',
    'Public Sans': 'family=Public+Sans:wght@400;500;600;700;800',
    Raleway: 'family=Raleway:wght@400;500;600;700;800',
    'Reddit Mono': 'family=Reddit+Mono:wght@400;500;600;700',
    'Red Hat Display': 'family=Red+Hat+Display:wght@400;500;600;700;800',
    'Red Hat Text': 'family=Red+Hat+Text:wght@400;500;600;700',
    Recursive: 'family=Recursive:wght@400;500;600;700',
    'Roboto Slab': 'family=Roboto+Slab:wght@400;500;600;700',
    'Schibsted Grotesk': 'family=Schibsted+Grotesk:wght@400;500;600;700;800',
    'Share Tech Mono': 'family=Share+Tech+Mono',
    'Source Sans 3': 'family=Source+Sans+3:wght@400;500;600;700;800',
    'Source Code Pro': 'family=Source+Code+Pro:wght@400;500;600;700',
    'Source Serif 4': 'family=Source+Serif+4:wght@400;500;600;700',
    'Space Mono': 'family=Space+Mono:wght@400;700',
    'Space Grotesk': 'family=Space+Grotesk:wght@400;500;700',
    'Sometype Mono': 'family=Sometype+Mono:wght@400;500;600;700',
    Spectral: 'family=Spectral:wght@400;500;600;700',
    Sora: 'family=Sora:wght@400;500;600;700;800',
    'Ubuntu Mono': 'family=Ubuntu+Mono:wght@400;700',
    Urbanist: 'family=Urbanist:wght@400;500;600;700;800',
    VT323: 'family=VT323',
    'Work Sans': 'family=Work+Sans:wght@400;500;600;700;800',
};

function ensureThemeFonts(theme) {
    const stacks = [theme.theme_body_font, theme.theme_heading_font, theme.theme_ui_font, theme.theme_mono_font].filter(Boolean);
    const queries = new Set();
    stacks.forEach((stack) => {
        stack.split(',').map((part) => part.trim().replace(/^['"]|['"]$/g, '')).forEach((name) => {
            if (GOOGLE_FONT_QUERIES[name]) queries.add(GOOGLE_FONT_QUERIES[name]);
        });
    });
    if (!queries.size) return;
    let link = document.getElementById('vyasa-runtime-fonts');
    if (!link) {
        link = document.createElement('link');
        link.id = 'vyasa-runtime-fonts';
        link.rel = 'stylesheet';
        document.head.appendChild(link);
    }
    link.href = `https://fonts.googleapis.com/css2?${Array.from(queries).join('&')}&display=swap`;
}

function getHljsThemeHref(themeName) {
    return `https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/${themeName}.min.css`;
}

function syncCodeThemeLinks(theme) {
    const lightLink = document.getElementById('hljs-light');
    const darkLink = document.getElementById('hljs-dark');
    if (!lightLink || !darkLink) return;
    const lightTheme = theme?.code_theme_light || lightLink.dataset.defaultTheme;
    const darkTheme = theme?.code_theme_dark || darkLink.dataset.defaultTheme;
    if (lightTheme) lightLink.href = getHljsThemeHref(lightTheme);
    if (darkTheme) darkLink.href = getHljsThemeHref(darkTheme);
    const dark = document.documentElement.classList.contains('dark');
    lightLink.disabled = dark;
    darkLink.disabled = !dark;
}

function applyThemePreset(theme) {
    if (!theme) return;
    const root = document.documentElement;
    const page = document.getElementById('page-container');
    const targets = [root, page].filter(Boolean);
    const runtimeThemeVars = new Set();
    Object.values(window.__VYASA_THEME_PRESETS__ || {}).forEach((preset) => {
        Object.keys(preset || {}).forEach((key) => {
            if (!key.startsWith('theme_') || key === 'theme_preset') return;
            const cssName = key === 'theme_body_font' ? '--vyasa-font-body'
                : key === 'theme_heading_font' ? '--vyasa-font-heading'
                : key === 'theme_ui_font' ? '--vyasa-font-ui'
                : key === 'theme_mono_font' ? '--vyasa-font-mono'
                : `--vyasa-${key.slice(6).replace(/_/g, '-')}`;
            runtimeThemeVars.add(cssName);
        });
    });
    targets.forEach((el) => {
        runtimeThemeVars.forEach((cssName) => el.style.removeProperty(cssName));
    });
    Object.entries(theme).forEach(([key, value]) => {
        if (!key.startsWith('theme_') || !value || key === 'theme_preset') return;
        const cssName = key === 'theme_body_font' ? '--vyasa-font-body'
            : key === 'theme_heading_font' ? '--vyasa-font-heading'
            : key === 'theme_ui_font' ? '--vyasa-font-ui'
            : key === 'theme_mono_font' ? '--vyasa-font-mono'
            : `--vyasa-${key.slice(6).replace(/_/g, '-')}`;
        targets.forEach((el) => el.style.setProperty(cssName, String(value)));
    });
    if (theme.theme_primary) targets.forEach((el) => el.style.setProperty('--vyasa-primary-dim', `color-mix(in srgb, ${theme.theme_primary} 82%, black)`));
    ensureThemeFonts(theme);
    syncCodeThemeLinks(theme);
}

function getVisibleThemeControl(id) {
    const nodes = Array.from(document.querySelectorAll(`#${id}`));
    return nodes.find((node) => {
        const rect = node.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    }) || nodes[nodes.length - 1] || null;
}

function getThemeSwitcher(source) {
    return source?.closest?.('[data-theme-switcher]') || document.querySelector('[data-theme-switcher]');
}

function syncThemePresetSelect(next, source) {
    const scope = getThemeSwitcher(source);
    const label = scope?.querySelector('#theme-preset-active-label') || getVisibleThemeControl('theme-preset-active-label');
    if (label) label.textContent = next || 'Theme';
    const menu = scope?.querySelector('#theme-preset-menu') || getVisibleThemeControl('theme-preset-menu');
    (menu ? Array.from(menu.querySelectorAll('.theme-preset-option')) : []).forEach((option) => {
        const active = option.dataset.themeName === next;
        option.classList.toggle('is-active', active);
    });
}

function syncThemePresetDebug(root = document) {
    const presets = window.__VYASA_THEME_PRESETS__ || {};
    const stored = JSON.parse(localStorage.getItem('__FRANKEN__') || '{"mode":"light"}');
    const label = root.querySelector ? root.querySelector('#theme-preset-active-label') : getVisibleThemeControl('theme-preset-active-label');
    const active = stored.preset || (label ? label.textContent.trim() : '') || '';
    if (active && presets[active]) {
        syncThemePresetSelect(active);
        applyThemePreset(presets[active]);
    }
}

window.vyasaToggleThemePresetMenu = function vyasaToggleThemePresetMenu(source) {
    const menu = getThemeSwitcher(source)?.querySelector('#theme-preset-menu') || getVisibleThemeControl('theme-preset-menu');
    if (!menu) return;
    menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
};

window.vyasaApplyThemePreset = function vyasaApplyThemePreset(next, source) {
    const presets = window.__VYASA_THEME_PRESETS__ || {};
    const franken = JSON.parse(localStorage.getItem('__FRANKEN__') || '{"mode":"light"}');
    if (next && presets[next]) {
        syncThemePresetSelect(next, source);
        applyThemePreset(presets[next]);
        franken.preset = next;
    } else {
        delete franken.preset;
        window.location.reload();
        return;
    }
    localStorage.setItem('__FRANKEN__', JSON.stringify(franken));
};

window.vyasaApplyRandomThemePreset = function vyasaApplyRandomThemePreset(source) {
    const presets = Object.keys(window.__VYASA_THEME_PRESETS__ || {});
    if (!presets.length) return;
    const label = getThemeSwitcher(source)?.querySelector('#theme-preset-active-label') || getVisibleThemeControl('theme-preset-active-label');
    const current = label ? label.textContent.trim() : '';
    const pool = presets.length > 1 ? presets.filter((name) => name !== current) : presets;
    const next = pool[Math.floor(Math.random() * pool.length)];
    window.vyasaApplyThemePreset(next, source);
};

function getDynamicGanttWidth() {
    // Check if any mermaid wrapper has custom gantt width
    const wrappers = document.querySelectorAll('.mermaid-wrapper[data-gantt-width]');
    if (wrappers.length > 0) {
        // Use the first custom width found, or max width if multiple
        const widths = Array.from(wrappers).map(w => parseInt(w.getAttribute('data-gantt-width')) || GANTT_WIDTH);
        return Math.max(...widths);
    }
    return GANTT_WIDTH;
}

function reinitializeMermaid() {
    // Skip if this is the initial load (let it render naturally first)
    if (isInitialLoad) {
        return;
    }
    
    const dynamicWidth = getDynamicGanttWidth();
    
    mermaid.initialize({ 
        startOnLoad: false,
        theme: getCurrentTheme(),
        fontSize: 16,
        flowchart: {
            htmlLabels: false
        },
        gantt: {
            useWidth: dynamicWidth,
            useMaxWidth: false
        }
    });
    
    // Find all mermaid wrappers and re-render them
    const shouldLockHeight = (wrapper) => {
        const height = (wrapper.style.height || '').trim();
        return height && height !== 'auto' && height !== 'initial' && height !== 'unset';
    };

    document.querySelectorAll('.mermaid-wrapper').forEach(wrapper => {
        const originalCode = wrapper.getAttribute('data-mermaid-code');
        if (originalCode) {
            // Preserve the current computed height before clearing (height should already be set explicitly)
            if (shouldLockHeight(wrapper)) {
                const currentHeight = wrapper.getBoundingClientRect().height;
                wrapper.style.height = currentHeight + 'px';
            }
            
            // Delete the old state so it can be recreated
            delete mermaidStates[wrapper.id];
            delete wrapper.dataset.mermaidInteractive;
            
            // Decode HTML entities
            const textarea = document.createElement('textarea');
            textarea.innerHTML = originalCode;
            const code = textarea.value;
            
            // Clear the wrapper
            wrapper.innerHTML = '';
            
            // Re-add the pre element with mermaid code
            const newPre = document.createElement('pre');
            newPre.className = 'mermaid';
            newPre.textContent = code;
            wrapper.appendChild(newPre);
        }
    });
    
    // Re-run mermaid
    mermaid.run().then(() => {
        scheduleMermaidInteraction({
            onReady: () => {}
        });
    });
}

const initialGanttWidth = getDynamicGanttWidth();

mermaid.initialize({ 
    startOnLoad: false,
    theme: getCurrentTheme(),
    fontSize: 16,
    flowchart: {
        htmlLabels: false
    },
    gantt: {
        useWidth: initialGanttWidth,
        useMaxWidth: false
    }
});

// Track if this is the initial load
let isInitialLoad = true;

// Initialize interaction after mermaid renders
document.addEventListener('DOMContentLoaded', () => {
    mermaidDebugSnapshot('before mermaid.run (DOMContentLoaded)');
    const mermaidNodes = collectRenderableMermaidNodes(document);
    const renderPromise = mermaidNodes.length > 0
        ? mermaid.run({ nodes: mermaidNodes })
        : Promise.resolve();
    renderPromise.then(() => {
        mermaidDebugSnapshot('after mermaid.run (DOMContentLoaded)');
        scheduleMermaidInteraction({
            onReady: () => {
                // After initial render, set explicit heights on all wrappers so theme switching works
                const shouldLockHeight = (wrapper) => {
                    const height = (wrapper.style.height || '').trim();
                    return height && height !== 'auto' && height !== 'initial' && height !== 'unset';
                };
                document.querySelectorAll('.mermaid-wrapper').forEach(wrapper => {
                    if (!shouldLockHeight(wrapper)) {
                        return;
                    }
                    const currentHeight = wrapper.getBoundingClientRect().height;
                    wrapper.style.height = currentHeight + 'px';
                });
                isInitialLoad = false;
            }
        });
    });
    renderD2Diagrams();
    renderTasksGraphs(document);
});

function initRevealDiagramRefresh() {
    if (!window.Reveal || typeof window.Reveal.on !== 'function') return;
    const normalizeMermaidViewBox = (scope) => {
        if (!scope) return;
        const svgs = scope.querySelectorAll('.mermaid-wrapper svg');
        svgs.forEach((svg) => {
            try {
                if (!svg.getBBox) return;
                const box = svg.getBBox();
                if (!Number.isFinite(box.width) || !Number.isFinite(box.height)) return;
                if (box.width < 1 || box.height < 1) return;
                const pad = 16;
                svg.setAttribute('viewBox', `${box.x - pad} ${box.y - pad} ${box.width + (pad * 2)} ${box.height + (pad * 2)}`);
                svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
                svg.style.display = 'block';
                svg.style.margin = '0 auto';
            } catch (_) {
                // Ignore unstable SVG state during transitions.
            }
        });
    };
    const centerRevealSlideDiagrams = (scope) => {
        if (!scope) return;
        const svgs = scope.querySelectorAll('.mermaid-wrapper svg, .d2-wrapper svg');
        svgs.forEach((svg) => {
            svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
            svg.style.display = 'block';
            svg.style.margin = '0 auto';
            svg.style.width = '100%';
            svg.style.height = '100%';
            svg.style.maxWidth = '100%';
            svg.style.maxHeight = '100%';
        });
    };
    const hydrateSlideDiagrams = (force = false) => {
        const current = window.Reveal.getCurrentSlide();
        if (!current) return;
        if (!force && current.dataset.diagramHydrated === 'true') return;
        current.dataset.diagramHydrated = 'true';
        const mermaidNodes = [];
        current.querySelectorAll('.mermaid-wrapper').forEach((wrapper) => {
            if (!wrapper.id) return;
            delete mermaidStates[wrapper.id];
            delete wrapper.dataset.mermaidInteractive;
            if (wrapper.querySelector('svg')) return;
            const encoded = wrapper.getAttribute('data-mermaid-code');
            if (!encoded) return;
            const textarea = document.createElement('textarea');
            textarea.innerHTML = encoded;
            const code = textarea.value;
            wrapper.innerHTML = '';
            const pre = document.createElement('pre');
            pre.className = 'mermaid';
            pre.textContent = code;
            wrapper.appendChild(pre);
            mermaidNodes.push(pre);
        });
        const didRenderMermaid = mermaidNodes.length > 0;
        const afterMermaid = () => {
            scheduleMermaidInteraction();
            if (didRenderMermaid && window.Reveal && typeof window.Reveal.layout === 'function') {
                requestAnimationFrame(() => {
                    window.Reveal.layout();
                });
                setTimeout(() => {
                    normalizeMermaidViewBox(current);
                }, 120);
            }
        };
        if (mermaidNodes.length > 0) {
            mermaid.run({ nodes: mermaidNodes }).then(() => {
                afterMermaid(true);
            }).catch(() => {});
        } else {
            afterMermaid(false);
        }
        renderD2Diagrams(current);
        initTabPanelHeights(current);
        requestAnimationFrame(() => centerRevealSlideDiagrams(current));
        setTimeout(() => centerRevealSlideDiagrams(current), 60);
    };
    window.Reveal.on('ready', () => setTimeout(() => hydrateSlideDiagrams(true), 0));
    window.Reveal.on('slidetransitionend', () => hydrateSlideDiagrams(false));
}
initRevealDiagramRefresh();

function normalizeSidebarPath(pathname) {
    const decoded = decodeURIComponent(pathname || '');
    const trimmed = decoded
        .replace(/^\/posts\//, '')
        .replace(/(?:\.pdf)$/, '');
    return trimmed.replace(/\/+$/, '');
}

// Reveal current file in sidebar
function revealInSidebar(rootElement = document, explicitPath = null) {
    if (!explicitPath && !window.location.pathname.startsWith('/posts/')) {
        return;
    }

    const currentPath = explicitPath || normalizeSidebarPath(window.location.pathname);
    const activeLink = rootElement.querySelector(`.post-link[data-path="${currentPath}"]`);
    
    if (activeLink) {
        const postsSection = activeLink.closest('details[data-section="posts-tree"]');
        const postsSectionOpen = !postsSection || postsSection.open;

        // Expand folder parents, but do not force sidebar subsections open.
        let parent = activeLink.closest('details');
        while (parent && rootElement.contains(parent)) {
            if (!parent.matches('details[data-section]')) {
                parent.open = true;
            }
            if (parent === rootElement) {
                break;
            }
            parent = parent.parentElement.closest('details');
        }
        
        // Scroll only when the posts section is visible.
        const scrollContainer = postsSectionOpen ? rootElement.querySelector('#sidebar-scroll-container') : null;
        if (scrollContainer) {
            const linkRect = activeLink.getBoundingClientRect();
            const containerRect = scrollContainer.getBoundingClientRect();
            const scrollTop = scrollContainer.scrollTop;
            const offset = linkRect.top - containerRect.top + scrollTop - (containerRect.height / 2) + (linkRect.height / 2);
            
            scrollContainer.scrollTo({
                top: offset,
                behavior: 'smooth'
            });
        }
    }
}

function focusCurrentPostInSidebar(source = document) {
    const sidebar = source?.closest?.('details[data-sidebar="posts"]') || document.querySelector('details[data-sidebar="posts"]');
    if (!sidebar) {
        return;
    }
    sidebar.open = true;
    sidebar.querySelectorAll('details[data-section="posts-tree"]').forEach((section) => {
        section.open = true;
    });
    revealInSidebar(sidebar);
}
window.focusCurrentPostInSidebar = focusCurrentPostInSidebar;

function postsHoverExpandAvailable() {
    return true;
}

function postsHoverExpandEnabled() {
    if (!postsHoverExpandAvailable()) return false;
    try {
        return localStorage.getItem('vyasa:postsHoverExpand') === '1';
    } catch (err) {
        return false;
    }
}

function syncPostsHoverToggleButtons(root = document) {
    const enabled = postsHoverExpandEnabled();
    root.querySelectorAll?.('[data-sidebar-hover-toggle="true"]').forEach((button) => {
        button.dataset.hoverExpandEnabled = enabled ? 'true' : 'false';
        button.setAttribute('aria-pressed', enabled ? 'true' : 'false');
        const tooltip = enabled ? 'Disable folder hover expand' : 'Enable folder hover expand';
        button.dataset.tooltip = tooltip;
        button.setAttribute('aria-label', tooltip);
    });
}

function togglePostsHoverExpand(root = document) {
    if (!postsHoverExpandAvailable()) return;
    const next = !postsHoverExpandEnabled();
    try {
        localStorage.setItem('vyasa:postsHoverExpand', next ? '1' : '0');
    } catch (err) {}
    syncPostsHoverToggleButtons(root || document);
}
window.togglePostsHoverExpand = togglePostsHoverExpand;

function initPostsSidebarAutoReveal() {
    const postSidebars = document.querySelectorAll('details[data-sidebar="posts"]');
    let persistedSidebarState = {};
    try {
        persistedSidebarState = JSON.parse(localStorage.getItem('vyasa:postsSidebarState') || '{}');
    } catch (err) {
        persistedSidebarState = {};
    }
    const pendingSidebarState = window.__vyasaPendingPostsSidebarState || null;
    
    postSidebars.forEach((sidebar) => {
        const libraryShouldBeOpen = pendingSidebarState
            ? !!pendingSidebarState.library
            : (window.__vyasaPostsSidebarWasOpen || persistedSidebarState.library === true);
        if (libraryShouldBeOpen && !sidebar.open) {
            sidebar.open = true;
        }
        const sectionState = pendingSidebarState
            ? { ...(pendingSidebarState.sections || {}) }
            : { ...persistedSidebarState.sections, ...(window.__vyasaPostsSidebarSectionState || {}) };
        sidebar.querySelectorAll('details[data-section]').forEach((section) => {
            const key = section.getAttribute('data-section');
            if (Object.prototype.hasOwnProperty.call(sectionState, key)) {
                section.open = !!sectionState[key];
            }
        });
        if (sidebar.open) {
            const pendingRevealPath = window.__vyasaPendingRevealPath || null;
            if (pendingRevealPath) window.__vyasaPendingRevealPath = null;
            revealInSidebar(sidebar, pendingRevealPath);
        }
        if (sidebar.dataset.revealBound === 'true') {
            return;
        }
        sidebar.dataset.revealBound = 'true';
        
        sidebar.addEventListener('toggle', () => {
            try {
                const saved = JSON.parse(localStorage.getItem('vyasa:postsSidebarState') || '{}');
                localStorage.setItem('vyasa:postsSidebarState', JSON.stringify({ ...saved, library: sidebar.open }));
            } catch (err) {}
            if (!sidebar.open) {
                return;
            }
            revealInSidebar(sidebar);
        });
        sidebar.querySelectorAll('details[data-section]').forEach((section) => {
            section.addEventListener('toggle', () => {
                const key = section.getAttribute('data-section');
                const nextState = { ...(window.__vyasaPostsSidebarSectionState || {}), [key]: section.open };
                window.__vyasaPostsSidebarSectionState = nextState;
                try {
                    const saved = JSON.parse(localStorage.getItem('vyasa:postsSidebarState') || '{}');
                    localStorage.setItem('vyasa:postsSidebarState', JSON.stringify({ ...saved, sections: { ...(saved.sections || {}), [key]: section.open } }));
                } catch (err) {}
            });
        });
    });
}

function initFolderChevronState(rootElement = document) {
    rootElement.querySelectorAll('details[data-folder="true"]').forEach((details) => {
        details.classList.toggle('is-open', details.open);
    });
}

function initSearchPlaceholderCycle(rootElement = document) {
    const inputs = rootElement.querySelectorAll('input[data-placeholder-cycle]');
    inputs.forEach((input) => {
        if (input.dataset.placeholderCycleBound === 'true') {
            return;
        }
        input.dataset.placeholderCycleBound = 'true';
        const primary = input.dataset.placeholderPrimary || input.getAttribute('placeholder') || '';
        const alt = input.dataset.placeholderAlt || '';
        if (!alt) {
            return;
        }
        let showAlt = false;
        setInterval(() => {
            if (input.value) {
                return;
            }
            showAlt = !showAlt;
            input.setAttribute('placeholder', showAlt ? alt : primary);
        }, 10000);
    });
}

function initCodeBlockCopyButtons(rootElement = document) {
    const template = document.getElementById('vyasa-code-copy-tpl');
    if (!template) {
        return;
    }
    rootElement.querySelectorAll('.code-block').forEach((block) => {
        if (block.querySelector('.code-copy-button')) {
            return;
        }
        const button = template.content.firstElementChild.cloneNode(true);
        block.insertBefore(button, block.firstChild);
    });
}

function initCodeHighlighting(rootElement = document) {
    if (!window.hljs) {
        return;
    }
    rootElement.querySelectorAll('pre > code').forEach((code) => {
        if (code.dataset.hljsBound === 'true') {
            return;
        }
        if (code.closest('.mermaid-wrapper,.d2-wrapper')) {
            return;
        }
        window.hljs.highlightElement(code);
        code.dataset.hljsBound = 'true';
    });
}

function copyText(text, done) {
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopyText(text, done));
        return;
    }
    fallbackCopyText(text, done);
}

function fallbackCopyText(text, done) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'absolute';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    done();
}

function initHeadingPermalinkCopy(root = document) {
    root.querySelectorAll('.vyasa-heading-permalink').forEach((link) => {
        if (link.dataset.copyBound === 'true') return;
        link.dataset.copyBound = 'true';
        link.addEventListener('click', (event) => {
            const url = new URL(link.getAttribute('href') || '', window.location.href).toString();
            event.preventDefault();
            history.replaceState(null, '', url);
            copyText(url, () => {
                link.classList.add('is-copied');
                clearTimeout(link._copiedTimer);
                link._copiedTimer = setTimeout(() => link.classList.remove('is-copied'), 1400);
            });
        });
    });
}

function syncPostsSearchControls(block) {
    if (!block) return;
    const input = block.querySelector('.posts-search-block input[type="search"][name="q"]');
    const preview = block.querySelector('.posts-search-preview-button');
    const clear = block.querySelector('.posts-search-clear-button');
    if (!input) return;
    const hasValue = !!input.value.trim();
    const previewBase = preview?.dataset.searchPreviewBase || '/search/preview';
    const previewHref = hasValue ? `${previewBase}/s/${encodeSearchPreviewTerm(input.value.trim())}` : previewBase;
    if (preview) {
        preview.setAttribute('href', previewHref);
        preview.setAttribute('aria-hidden', hasValue ? 'false' : 'true');
        preview.setAttribute('tabindex', hasValue ? '0' : '-1');
        preview.style.opacity = hasValue ? '1' : '0';
        preview.style.pointerEvents = hasValue ? 'auto' : 'none';
    }
    if (clear) {
        clear.style.opacity = hasValue ? '1' : '0';
        clear.style.pointerEvents = hasValue ? 'auto' : 'none';
    }
}

function encodeSearchPreviewTerm(value) {
    const bytes = new TextEncoder().encode(value);
    let binary = '';
    bytes.forEach((byte) => {
        binary += String.fromCharCode(byte);
    });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeSearchPreviewTerm(token) {
    if (!token) return '';
    try {
        const normalized = token.replace(/-/g, '+').replace(/_/g, '/');
        const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
        const binary = atob(padded);
        const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
        return new TextDecoder().decode(bytes);
    } catch (err) {
        return '';
    }
}

function extractSearchResultsHtml(html) {
    const template = document.createElement('template');
    template.innerHTML = html || '';
    return template.content.querySelector('.posts-search-results-list')?.outerHTML || html || '';
}

function getPostsSearchTermFromLocation() {
    const path = window.location.pathname || '';
    const previewPrefix = '/search/preview/s/';
    if (!path.startsWith(previewPrefix)) {
        return '';
    }
    return decodeSearchPreviewTerm(path.slice(previewPrefix.length));
}

function openPostsSearchPreview(block) {
    if (!block) return;
    const input = block.querySelector('input[type="search"][name="q"]');
    const preview = block.querySelector('.posts-search-preview-button');
    const trimmed = input?.value.trim();
    if (!trimmed || !preview) {
        return;
    }
    const previewBase = preview.dataset.searchPreviewBase || '/search/preview';
    const previewHref = `${previewBase}/s/${encodeSearchPreviewTerm(trimmed)}`;
    preview.setAttribute('href', previewHref);
    if (window.htmx && typeof window.htmx.ajax === 'function') {
        window.htmx.ajax('GET', previewHref, {
            target: '#main-content',
            swap: 'outerHTML show:window:top settle:0.1s'
        }).then(() => {
            const currentUrl = `${window.location.pathname}${window.location.search}`;
            if (currentUrl !== previewHref) {
                window.history.pushState(null, '', previewHref);
            }
        });
        return;
    }
    window.location.href = previewHref;
}

function initPostsSearchPersistence(rootElement = document) {
    const input = rootElement.querySelector('.posts-search-block input[type="search"][name="q"]');
    const results = rootElement.querySelector('.posts-search-results');
    const block = input?.closest('.posts-search-block');
    if (!input || !results) {
        return;
    }
    if (input.dataset.searchPersistenceBound === 'true') {
        return;
    }
    input.dataset.searchPersistenceBound = 'true';
    const termKey = 'vyasa:postsSearchTerm';
    const resultsKey = 'vyasa:postsSearchResults';
    const enhanceGatherLink = () => {
        const gatherLink = results.querySelector('a[href^="/search/gather"]');
        if (!gatherLink) {
            return;
        }
        const href = gatherLink.getAttribute('href');
        if (!href) {
            return;
        }
        gatherLink.setAttribute('hx_get', href);
        gatherLink.setAttribute('hx_target', '#main-content');
        gatherLink.setAttribute('hx_push_url', 'true');
        gatherLink.setAttribute('hx_swap', 'outerHTML show:window:top settle:0.1s');
    };
    let storedTerm = '';
    let storedResults = null;
    const urlTerm = getPostsSearchTermFromLocation();
    try {
        storedTerm = localStorage.getItem(termKey) || '';
        storedResults = localStorage.getItem(resultsKey);
    } catch (err) {
        storedTerm = '';
        storedResults = null;
    }
    if (urlTerm) {
        input.value = urlTerm;
    } else if (storedTerm && !input.value) {
        input.value = storedTerm;
    }
    if (storedResults && input.value) {
        try {
            const payload = JSON.parse(storedResults);
            if (payload && payload.term === input.value && payload.html) {
                results.innerHTML = payload.html;
                enhanceGatherLink();
            }
        } catch (err) {
            // Ignore malformed cached payloads.
        }
    }
    syncPostsSearchControls(block);
    const persistTerm = () => {
        try {
            if (input.value) {
                localStorage.setItem(termKey, input.value);
            } else {
                localStorage.removeItem(termKey);
                localStorage.removeItem(resultsKey);
            }
        } catch (err) {
            // Ignore storage failures.
        }
    };
    input.addEventListener('input', persistTerm);
    input.addEventListener('input', () => syncPostsSearchControls(block));
    input.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter') {
            return;
        }
        const trimmed = input.value.trim();
        if (!trimmed) {
            return;
        }
        const preview = block?.querySelector('.posts-search-preview-button');
        if (!preview) {
            return;
        }
        event.preventDefault();
        openPostsSearchPreview(block);
    });
    const fetchResults = (query) => {
        return fetch(`/_sidebar/posts/search?q=${query}`, { headers: { 'HX-Request': 'true' } })
            .then((response) => response.text())
            .then((html) => {
                results.innerHTML = extractSearchResultsHtml(html);
                enhanceGatherLink();
                try {
                    localStorage.setItem(resultsKey, JSON.stringify({
                        term: input.value,
                        html: results.innerHTML
                    }));
                } catch (err) {
                    // Ignore storage failures.
                }
            })
            .catch(() => {});
    };
    document.body.addEventListener('htmx:afterSwap', (event) => {
        if (event.target !== results) {
            return;
        }
        enhanceGatherLink();
        try {
            localStorage.setItem(resultsKey, JSON.stringify({
                term: input.value,
                html: results.innerHTML
            }));
        } catch (err) {
            // Ignore storage failures.
        }
    });
    if (input.value) {
        const query = encodeURIComponent(input.value);
        if (window.htmx && typeof window.htmx.ajax === 'function') {
            window.htmx.ajax('GET', `/_sidebar/posts/search?q=${query}`, { target: results, swap: 'innerHTML' });
        } else {
            fetchResults(query);
        }
    }
}

function initSearchClearButtons(rootElement = document) {
    const blocks = rootElement.querySelectorAll('.posts-search-block');
    blocks.forEach((block) => {
        const input = block.querySelector('input[type="search"][name="q"]');
        const button = block.querySelector('.posts-search-clear-button');
        const preview = block.querySelector('.posts-search-preview-button');
        if (!input || !button) {
            return;
        }
        if (button.dataset.clearBound === 'true') {
            return;
        }
        button.dataset.clearBound = 'true';
        syncPostsSearchControls(block);
        input.addEventListener('input', () => syncPostsSearchControls(block));
        button.addEventListener('click', () => {
            input.value = '';
            input.dispatchEvent(new Event('input', { bubbles: true }));
            syncPostsSearchControls(block);
            const results = block.querySelector('.posts-search-results');
            if (results) {
                results.innerHTML = '';
            }
            try {
                localStorage.removeItem('vyasa:postsSearchTerm');
                localStorage.removeItem('vyasa:postsSearchResults');
            } catch (err) {
                // Ignore storage failures.
            }
        });
        if (preview) {
            preview.addEventListener('click', (event) => {
                if (!input.value.trim()) {
                    event.preventDefault();
                    return;
                }
                event.preventDefault();
                openPostsSearchPreview(block);
            });
        }
    });
}

const vyasaBookmarks = { mode: null, items: [], loadPromise: null };
const vyasaBookmarkDebugEnabled = () => {
    try {
        return localStorage.getItem('vyasa:debug:bookmarks') === '1';
    } catch (err) {
        return false;
    }
};
function vyasaBookmarkDebug(event, payload = {}) {
    if (!vyasaBookmarkDebugEnabled()) return;
    console.info('[vyasa bookmarks]', event, payload);
}

function normalizeBookmarkItems(items = []) {
    const seen = new Set();
    return items.filter((item) => {
        const path = String(item && item.path || '').replace(/^\/+|\/+$/g, '');
        if (!path || seen.has(path)) return false;
        seen.add(path);
        item.path = path;
        item.href = item.href || `/posts/${path}`;
        item.title = item.title || path;
        return true;
    });
}

function readLocalBookmarks() {
    try {
        return normalizeBookmarkItems(JSON.parse(localStorage.getItem('vyasa:bookmarks') || '[]'));
    } catch (err) {
        return [];
    }
}

function writeLocalBookmarks(items) {
    try {
        localStorage.setItem('vyasa:bookmarks', JSON.stringify(normalizeBookmarkItems(items)));
    } catch (err) {
        // Ignore storage failures.
    }
}

function bookmarkItemFromButton(button) {
    const path = String(button?.dataset?.bookmarkPath || '').replace(/^\/+|\/+$/g, '');
    const title = button?.dataset?.bookmarkTitle || path;
    const href = button?.closest('.vyasa-bookmark-row')?.querySelector('a[href]')?.getAttribute('href') || `/posts/${path}`;
    return path ? { path, title, href } : null;
}

function ensureBookmarksLoaded(force = false) {
    if (vyasaBookmarks.mode && !force) return Promise.resolve(vyasaBookmarks.items);
    if (vyasaBookmarks.loadPromise && !force) return vyasaBookmarks.loadPromise;
    vyasaBookmarks.loadPromise = fetch('/api/bookmarks', { cache: 'no-store', credentials: 'same-origin' })
        .then((response) => {
            vyasaBookmarkDebug('load-response', { force, status: response.status, ok: response.ok });
            return response.ok ? response.json() : { mode: 'local', items: readLocalBookmarks() };
        })
        .catch((error) => {
            vyasaBookmarkDebug('load-error', { force, error: String(error) });
            return { mode: 'local', items: readLocalBookmarks() };
        })
        .then((payload) => {
            vyasaBookmarks.mode = payload.mode === 'server' ? 'server' : 'local';
            vyasaBookmarks.items = normalizeBookmarkItems(vyasaBookmarks.mode === 'server' ? (payload.items || []) : readLocalBookmarks());
            vyasaBookmarkDebug('load-applied', { force, mode: vyasaBookmarks.mode, paths: vyasaBookmarks.items.map((item) => item.path) });
            return vyasaBookmarks.items;
        })
        .finally(() => { vyasaBookmarks.loadPromise = null; });
    return vyasaBookmarks.loadPromise;
}

function renderBookmarksBlock(rootElement = document) {
    const paths = new Set(vyasaBookmarks.items.map((item) => item.path));
    vyasaBookmarkDebug('render', { mode: vyasaBookmarks.mode, count: vyasaBookmarks.items.length, targetTag: rootElement?.tagName || 'document' });
    rootElement.querySelectorAll('[data-bookmark-toggle="true"]').forEach((button) => {
        const bookmarked = paths.has(button.dataset.bookmarkPath);
        button.dataset.bookmarked = bookmarked ? 'true' : 'false';
        const glyph = button.querySelector('.vyasa-bookmark-glyph');
        if (glyph) glyph.textContent = bookmarked ? '★' : '☆';
    });
    rootElement.querySelectorAll('.vyasa-bookmarks-block').forEach((block) => {
        const list = block.querySelector('.vyasa-bookmarks-list');
        if (!list) return;
        list.innerHTML = vyasaBookmarks.items.map((item) => `
            <div class="vyasa-bookmark-row inline-flex items-center gap-1 w-max">
                <a href="${item.href}" hx-get="${item.href}" hx-target="#main-content" hx-push-url="true" hx-swap="outerHTML show:window:top settle:0.1s" class="vyasa-tree-row vyasa-bookmark-link inline-flex items-center py-1 px-2 rounded transition-colors whitespace-nowrap" data-path="${item.path}" data-bookmark-link="true">
                    <span class="whitespace-nowrap" title="${item.path}">${item.path}</span>
                </a>
                <button type="button" class="vyasa-bookmark-delete shrink-0 rounded p-1.5 text-slate-400 hover:text-rose-500 transition-colors leading-none" data-bookmark-delete="true" data-bookmark-path="${item.path}" data-bookmark-title="${item.title}" aria-label="Remove bookmark for ${item.title}" title="Remove bookmark for ${item.title}">
                    <span class="flex items-center justify-center" aria-hidden="true"><svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M6 6l1 14h10l1-14"/><path d="M10 10v6"/><path d="M14 10v6"/></svg></span>
                </button>
            </div>`).join('');
        block.classList.toggle('has-items', vyasaBookmarks.items.length > 0);
    });
}

function bindBookmarkButtons(rootElement = document) {
    rootElement.querySelectorAll('[data-bookmark-toggle="true"]').forEach((button) => {
        if (button.dataset.bookmarkBound === 'true') return;
        button.dataset.bookmarkBound = 'true';
        button.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            toggleBookmarkItem(button);
        }, true);
    });
    rootElement.querySelectorAll('[data-bookmark-delete="true"]').forEach((button) => {
        if (button.dataset.bookmarkDeleteBound === 'true') return;
        button.dataset.bookmarkDeleteBound = 'true';
        button.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            deleteBookmarkItem(button);
        }, true);
    });
}

async function refreshPostsTreeForPath(path) {
    const response = await fetch(`/_sidebar/posts?current_path=${encodeURIComponent(path)}`);
    if (!response.ok) return;
    const html = await response.text();
    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;
    const nextList = wrapper.querySelector('#vyasa-posts-section-list');
    const postsContainer = document.querySelector('#posts-sidebar') || document;
    const currentList = postsContainer.querySelector('#vyasa-posts-section-list');
    if (!nextList || !currentList) return;
    currentList.replaceWith(nextList);
    initFolderChevronState(document);
    updateActivePostLink(path);
    bindBookmarkButtons(document);
    const postsSidebar = postsContainer.querySelector('details[data-sidebar="posts"]');
    if (postsSidebar?.open) {
        revealInSidebar(postsSidebar, path);
    }
}

function bindBookmarkLinks(rootElement = document) {
    rootElement.querySelectorAll('[data-bookmark-link="true"]').forEach((link) => {
        if (link.dataset.bookmarkLinkBound === 'true') return;
        link.dataset.bookmarkLinkBound = 'true';
        link.addEventListener('click', (event) => {
            event.preventDefault();
            const href = link.getAttribute('href');
            const path = link.getAttribute('data-path') || '';
            if (!href) return;
            if (window.htmx && typeof window.htmx.ajax === 'function') {
                window.__vyasaPendingRevealPath = path;
                window.htmx.ajax('GET', href, { target: '#main-content', swap: 'outerHTML show:window:top settle:0.1s', pushURL: true });
                refreshPostsTreeForPath(path);
                return;
            }
            window.location.assign(href);
        });
    });
}

async function toggleBookmarkItem(button) {
    const item = bookmarkItemFromButton(button);
    if (!item) return;
    await ensureBookmarksLoaded();
    const exists = vyasaBookmarks.items.some((entry) => entry.path === item.path);
    vyasaBookmarkDebug('toggle-start', { path: item.path, exists, mode: vyasaBookmarks.mode });
    if (vyasaBookmarks.mode === 'server') {
        const routePath = item.path.split('/').map(encodeURIComponent).join('/');
        const response = await fetch(`/api/bookmarks/${routePath}`, {
            method: exists ? 'DELETE' : 'PUT',
            cache: 'no-store',
            credentials: 'same-origin',
        });
        vyasaBookmarkDebug('toggle-response', { path: item.path, method: exists ? 'DELETE' : 'PUT', status: response.status, ok: response.ok });
        if (!response.ok) return;
        await ensureBookmarksLoaded(true);
    } else {
        vyasaBookmarks.items = exists
            ? vyasaBookmarks.items.filter((entry) => entry.path !== item.path)
            : normalizeBookmarkItems([item, ...vyasaBookmarks.items]);
        writeLocalBookmarks(vyasaBookmarks.items);
    }
    vyasaBookmarkDebug('toggle-finished', { path: item.path, mode: vyasaBookmarks.mode, paths: vyasaBookmarks.items.map((entry) => entry.path) });
    renderBookmarksBlock(document);
    bindBookmarkButtons(document);
    bindBookmarkLinks(document);
}

async function deleteBookmarkItem(button) {
    const item = bookmarkItemFromButton(button);
    if (!item) return;
    await ensureBookmarksLoaded();
    if (vyasaBookmarks.mode === 'server') {
        const routePath = item.path.split('/').map(encodeURIComponent).join('/');
        const response = await fetch(`/api/bookmarks/${routePath}`, {
            method: 'DELETE',
            cache: 'no-store',
            credentials: 'same-origin',
        });
        if (!response.ok) return;
        await ensureBookmarksLoaded(true);
    } else {
        vyasaBookmarks.items = vyasaBookmarks.items.filter((entry) => entry.path !== item.path);
        writeLocalBookmarks(vyasaBookmarks.items);
    }
    renderBookmarksBlock(document);
    bindBookmarkButtons(document);
    bindBookmarkLinks(document);
}

function initBookmarks(rootElement = document) {
    ensureBookmarksLoaded().then(() => {
        renderBookmarksBlock(rootElement);
        bindBookmarkButtons(rootElement);
        bindBookmarkLinks(rootElement);
    });
}

function loadSidebarFolderBranch(details) {
    const summary = details?.querySelector(':scope > summary[hx-get]');
    const branch = details?.querySelector(':scope > ul');
    const branchHref = summary?.getAttribute('hx-get');
    if (!summary || !branch || !branchHref || details.dataset.hoverBranchLoaded === 'true' || details.dataset.hoverBranchLoading === 'true') {
        return;
    }
    const hasContent = Array.from(branch.children).some((child) => child.textContent.trim());
    if (hasContent) {
        details.dataset.hoverBranchLoaded = 'true';
        return;
    }
    details.dataset.hoverBranchLoading = 'true';
    const onDone = () => {
        details.dataset.hoverBranchLoading = 'false';
        details.dataset.hoverBranchLoaded = 'true';
        initFolderHoverExpand(branch);
        initFolderChevronState();
    };
    if (window.htmx?.ajax) {
        const request = window.htmx.ajax('GET', branchHref, { target: branch, swap: 'innerHTML' });
        if (request && typeof request.then === 'function') {
            request.then(onDone).catch(() => {
                details.dataset.hoverBranchLoading = 'false';
            });
        } else {
            const onSwap = (event) => {
                if (event.target !== branch) return;
                document.body.removeEventListener('htmx:afterSwap', onSwap);
                onDone();
            };
            document.body.addEventListener('htmx:afterSwap', onSwap);
        }
        return;
    }
    fetch(branchHref, { credentials: 'same-origin' })
        .then((response) => response.ok ? response.text() : Promise.reject(new Error('branch load failed')))
        .then((html) => {
            branch.innerHTML = html;
            onDone();
        })
        .catch(() => {
            details.dataset.hoverBranchLoading = 'false';
        });
}

function bindFolderHoverExpand(details) {
    if (!(details instanceof HTMLDetailsElement) || details.dataset.hoverExpandBound === 'true') {
        return;
    }
    details.dataset.hoverExpandBound = 'true';
    let leaveTimer = null;
    details.addEventListener('mouseenter', () => {
        if (!postsHoverExpandEnabled()) return;
        if (leaveTimer) {
            window.clearTimeout(leaveTimer);
            leaveTimer = null;
        }
        details.dataset.hoverOpened = 'true';
        details.open = true;
        loadSidebarFolderBranch(details);
    });
    details.addEventListener('mouseleave', () => {
        if (!postsHoverExpandEnabled()) return;
        leaveTimer = window.setTimeout(() => {
            if (details.matches(':hover')) return;
            if (details.dataset.hoverOpened === 'true') {
                details.open = false;
            }
        }, 120);
    });
}

function initFolderHoverExpand(root = document) {
    const postsSidebar = root?.id === 'posts-sidebar' ? root : root?.querySelector?.('#posts-sidebar') || document.getElementById('posts-sidebar');
    if (!postsSidebar || !postsHoverExpandEnabled()) return;
    postsSidebar.querySelectorAll('details[data-folder="true"]').forEach(bindFolderHoverExpand);
}

document.addEventListener('toggle', (event) => {
    const details = event.target;
    if (!(details instanceof HTMLDetailsElement)) {
        return;
    }
    if (details.matches('.vyasa-heading-fold')) {
        details.classList.toggle('is-open', details.open);
        return;
    }
    if (!details.matches('details[data-folder="true"], details[data-section]')) {
        return;
    }
    details.classList.toggle('is-open', details.open);
}, true);

document.addEventListener('click', (event) => {
    const sidebarLocate = event.target.closest('[data-sidebar-locate-current="true"]');
    if (sidebarLocate) {
        event.preventDefault();
        event.stopPropagation();
        focusCurrentPostInSidebar(sidebarLocate);
        return;
    }
    const hoverToggle = event.target.closest('[data-sidebar-hover-toggle="true"]');
    if (hoverToggle) {
        event.preventDefault();
        event.stopPropagation();
        togglePostsHoverExpand(document);
        return;
    }
    const toggle = event.target.closest('[data-vyasa-fold-all]');
    if (toggle) {
        const main = document.getElementById('main-content');
        const folds = Array.from(main?.querySelectorAll('.vyasa-heading-fold') || []);
        const shouldOpen = toggle.dataset.vyasaFoldAll !== 'open';
        folds.forEach((fold) => { fold.open = shouldOpen; });
        toggle.dataset.vyasaFoldAll = shouldOpen ? 'open' : 'closed';
        toggle.innerHTML = shouldOpen
            ? '<svg viewBox="0 0 24 24" aria-hidden="true" class="vyasa-fold-all-icon"><path d="M6 7h12"/><path d="M6 12h8"/><path d="M6 17h5"/><path d="m15 10 3 3 3-3"/></svg><span>Fold all</span>'
            : '<svg viewBox="0 0 24 24" aria-hidden="true" class="vyasa-fold-all-icon"><path d="M6 7h12"/><path d="M6 12h8"/><path d="M6 17h5"/><path d="m15 14 3-3 3 3"/></svg><span>Unfold all</span>';
        return;
    }
    const headingAction = event.target.closest('[data-heading-action]');
    if (headingAction) {
        event.preventDefault();
        event.stopPropagation();
        const details = headingAction.closest('.vyasa-heading-fold');
        if (!(details instanceof HTMLDetailsElement)) return;
        const descendants = Array.from(details.querySelectorAll(':scope > .vyasa-heading-fold-body .vyasa-heading-fold'));
        const shouldOpen = !details.open || descendants.some((fold) => !fold.open);
        if (shouldOpen) {
            details.open = true;
            descendants.forEach((fold) => { fold.open = true; });
            syncHeadingActionStates(document);
            return;
        }
        descendants.forEach((fold) => { fold.open = false; });
        syncHeadingActionStates(document);
        return;
    }
    const summary = event.target.closest('.vyasa-heading-fold-summary');
    if (!summary || event.target.closest('.vyasa-heading-permalink, .vyasa-heading-launch')) {
        return;
    }
    event.preventDefault();
    const details = summary.parentElement;
    if (details instanceof HTMLDetailsElement) {
        details.open = !details.open;
        syncHeadingActionStates(document);
    }
});

function syncHeadingActionStates(root = document) {
    (root.querySelectorAll?.('.vyasa-heading-action-children') || []).forEach((button) => {
        const details = button.closest('.vyasa-heading-fold');
        if (!(details instanceof HTMLDetailsElement)) return;
        const descendants = Array.from(details.querySelectorAll(':scope > .vyasa-heading-fold-body .vyasa-heading-fold'));
        button.hidden = descendants.length === 0;
        const allOpen = details.open && descendants.every((fold) => fold.open);
        button.dataset.subtreeState = allOpen ? 'collapse' : 'expand';
        button.setAttribute('aria-label', allOpen ? 'Collapse child sections' : 'Expand child sections');
    });
}

// Update active post link in sidebar
function updateActivePostLink(explicitPath = null) {
    const currentPath = explicitPath || normalizeSidebarPath(window.location.pathname);
    document.querySelectorAll('.vyasa-tree-row').forEach(row => {
        row.classList.remove('is-active');
    });
    document.querySelectorAll('.post-link').forEach(link => {
        const linkPath = normalizeSidebarPath(link.getAttribute('data-path') || '');
        if (linkPath === currentPath) {
            link.closest('.vyasa-tree-row')?.classList.add('is-active');
        }
    });
}

// Update active TOC link based on scroll position
let lastActiveTocAnchor = null;
function alignToCurrentHash() {
    const hash = window.location.hash;
    if (!hash || hash === '#') {
        return;
    }
    const id = decodeURIComponent(hash.slice(1));
    const target = document.getElementById(id);
    if (!target) {
        return;
    }
    for (let parent = target.parentElement; parent; parent = parent.parentElement) {
        if (parent.matches?.('.vyasa-heading-fold')) parent.open = true;
    }
    target.scrollIntoView({ block: 'start' });
    requestAnimationFrame(() => target.scrollIntoView({ block: 'start' }));
}

function scheduleHashAlignment() {
    alignToCurrentHash();
    [80, 220, 500, 1200].forEach((delay) => setTimeout(alignToCurrentHash, delay));
}

function initHeadingFolds(root = document) {
    const main = root.id === 'main-content' ? root : root.querySelector?.('#main-content');
    if (!main || main.dataset.headingFoldsInit === '1') return;
    if (main.querySelector('.vyasa-zen-content')) return;
    let createdFold = false;
    const containers = [main, ...main.querySelectorAll('div, section, article')].filter((el) =>
        !el.closest('.vyasa-heading-fold-body') &&
        Array.from(el.children).some((child) => /^H[1-6]$/.test(child.tagName))
    );
    containers.forEach((container) => {
        if (container.dataset.headingFoldsInit === '1') return;
        const nodes = Array.from(container.childNodes);
        const stack = [{ level: 0, body: container }];
        nodes.forEach((node) => {
            const match = node instanceof HTMLElement ? node.tagName.match(/^H([1-6])$/) : null;
            if (node instanceof HTMLElement && node.matches('.vyasa-page-title')) {
                stack.at(-1).body.appendChild(node);
                return;
            }
            if (!match || node.closest('.vyasa-heading-fold')) return void stack.at(-1).body.appendChild(node);
            const level = Number(match[1]);
            while (stack.length > 1 && stack.at(-1).level >= level) stack.pop();
            const fold = document.createElement('details');
            const summary = document.createElement('summary');
            const body = document.createElement('div');
            const chevron = document.createElement('span');
            fold.className = 'vyasa-heading-fold';
            fold.dataset.level = `h${level}`;
            fold.open = true;
            fold.classList.add('is-open');
            createdFold = true;
            summary.className = 'vyasa-heading-fold-summary';
            body.className = 'vyasa-heading-fold-body';
            chevron.className = 'vyasa-heading-fold-chevron';
            chevron.setAttribute('aria-hidden', 'true');
            summary.append(node, chevron);
            fold.append(summary, body);
            stack.at(-1).body.appendChild(fold);
            stack.push({ level, body });
        });
        container.dataset.headingFoldsInit = '1';
    });
    const actions = main.querySelector('[data-vyasa-page-actions]');
    if (createdFold && actions && !main.querySelector('[data-vyasa-fold-all]')) {
        const control = document.createElement('button');
        control.type = 'button';
        control.className = 'vyasa-fold-all-button';
        control.dataset.vyasaFoldAll = 'open';
        control.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" class="vyasa-fold-all-icon"><path d="M6 7h12"/><path d="M6 12h8"/><path d="M6 17h5"/><path d="m15 10 3 3 3-3"/></svg><span>Fold all</span>';
        const copyButton = Array.from(actions.querySelectorAll('button')).find((button) => button.textContent?.includes('Copy Markdown'));
        actions.insertBefore(control, copyButton);
    }
    main.dataset.headingFoldsInit = '1';
}

function initScrollTopButton(root = document) {
    const page = root.getElementById?.('page-container') || document.getElementById('page-container');
    if (!page || document.getElementById('vyasa-scroll-top')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'vyasa-scroll-top';
    button.className = 'vyasa-scroll-top-button';
    button.setAttribute('aria-label', 'Go to top');
    button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" class="vyasa-scroll-top-icon"><path d="M12 19V7"/><path d="m6.75 12.25 5.25-5.25 5.25 5.25"/></svg>';
    button.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    document.body.appendChild(button);
    const sync = () => {
        const main = document.getElementById('main-content');
        const rect = main?.getBoundingClientRect();
        if (rect) {
            const left = Math.max(16, rect.right - button.offsetWidth);
            button.style.left = `${left}px`;
        }
        button.classList.toggle('is-visible', window.scrollY > 0);
    };
    window.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync, { passive: true });
    sync();
}

function initMobileScrollProgress(root = document) {
    const page = root.getElementById?.('page-container') || document.getElementById('page-container');
    if (!page) return;
    let bar = document.getElementById('vyasa-mobile-scroll-progress');
    if (!bar) {
        bar = document.createElement('div');
        bar.id = 'vyasa-mobile-scroll-progress';
        bar.className = 'vyasa-mobile-scroll-progress';
        bar.setAttribute('aria-hidden', 'true');
        page.appendChild(bar);
    }
    const sync = () => {
        const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        const progress = Math.min(1, Math.max(0, window.scrollY / max));
        bar.style.height = `${Math.round(progress * window.innerHeight)}px`;
    };
    window.__vyasaSyncMobileScrollProgress = sync;
    if (!window.__vyasaMobileScrollProgressBound) {
        window.addEventListener('scroll', () => window.__vyasaSyncMobileScrollProgress?.(), { passive: true });
        window.addEventListener('resize', () => window.__vyasaSyncMobileScrollProgress?.(), { passive: true });
        window.__vyasaMobileScrollProgressBound = true;
    }
    sync();
}

function normalizeCriticalTextColors(root = document) {
    const ink = getComputedStyle(document.documentElement).getPropertyValue('--vyasa-ink').trim() || '#2d3434';
    root.querySelectorAll('#main-content h1, #main-content h2, #main-content h3, #main-content h4, #main-content h5, #main-content h6').forEach((el) => {
        el.style.color = ink;
        el.style.opacity = '1';
    });
    root.querySelectorAll('.vyasa-sidebar-toggle, .vyasa-sidebar-toggle *, .vyasa-sidebar-body, .vyasa-sidebar-body a, .vyasa-sidebar-body span, .vyasa-sidebar-body div, .vyasa-sidebar-body li, .toc-link').forEach((el) => {
        el.style.color = ink;
        el.style.opacity = '1';
    });
}

function recordStyleProbe(label) {
    const html = document.documentElement;
    const page = document.getElementById('page-container');
    const heading = document.querySelector('#main-content h1, #main-content h2, #main-content h3');
    const toc = document.querySelector('.toc-link');
    const rootStyles = getComputedStyle(html);
    const pageStyles = page ? getComputedStyle(page) : null;
    function matchedVariableRules(el) {
        if (!el) return [];
        const hits = [];
        for (const sheet of Array.from(document.styleSheets || [])) {
            let rules;
            try { rules = sheet.cssRules; } catch (e) { continue; }
            for (const rule of Array.from(rules || [])) {
                if (!rule.selectorText) continue;
                try {
                    if (el.matches(rule.selectorText) && (
                        rule.style.getPropertyValue('--vyasa-ink') ||
                        rule.style.getPropertyValue('--vyasa-paper') ||
                        rule.style.getPropertyValue('--vyasa-paper-low')
                    )) {
                        hits.push({
                            selector: rule.selectorText,
                            ink: rule.style.getPropertyValue('--vyasa-ink') || '',
                            paper: rule.style.getPropertyValue('--vyasa-paper') || '',
                            paperLow: rule.style.getPropertyValue('--vyasa-paper-low') || '',
                            href: sheet.href || 'inline',
                        });
                    }
                } catch (e) {}
            }
        }
        return hits.slice(-20);
    }
    const pick = (el) => el ? {
        text: (el.textContent || '').trim().slice(0, 80),
        color: getComputedStyle(el).color,
        opacity: getComputedStyle(el).opacity,
        classes: el.className,
    } : null;
    const samples = JSON.parse(localStorage.getItem('vyasa:lastStyleProbe') || '[]');
    samples.push({
        label,
        t: Date.now(),
        htmlClass: html.className,
        vars: {
            rootInk: rootStyles.getPropertyValue('--vyasa-ink').trim(),
            rootPaper: rootStyles.getPropertyValue('--vyasa-paper').trim(),
            rootPaperLow: rootStyles.getPropertyValue('--vyasa-paper-low').trim(),
            pageInk: pageStyles ? pageStyles.getPropertyValue('--vyasa-ink').trim() : '',
            pagePaper: pageStyles ? pageStyles.getPropertyValue('--vyasa-paper').trim() : '',
            pagePaperLow: pageStyles ? pageStyles.getPropertyValue('--vyasa-paper-low').trim() : '',
            pageColor: pageStyles ? pageStyles.color : '',
        },
        matches: {
            html: matchedVariableRules(html),
            page: matchedVariableRules(page),
        },
        heading: pick(heading),
        toc: pick(toc),
    });
    localStorage.setItem('vyasa:lastStyleProbe', JSON.stringify(samples.slice(-12)));
}

function isLightweightSearchSwap(target) {
    return !!target?.closest?.('.posts-search-results, .vyasa-command-palette-results');
}

function updateActiveTocLink() {
    const headings = document.querySelectorAll('h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]');
    const tocLinks = document.querySelectorAll('.toc-link');
    
    let activeHeading = null;
    let nearestBelow = null;
    let nearestBelowTop = Infinity;
    const offset = 140;
    headings.forEach(heading => {
        const rect = heading.getBoundingClientRect();
        if (rect.top <= offset) {
            activeHeading = heading;
        } else if (rect.top < nearestBelowTop) {
            nearestBelowTop = rect.top;
            nearestBelow = heading;
        }
    });
    if (!activeHeading && nearestBelow) {
        activeHeading = nearestBelow;
    }
    
    tocLinks.forEach(link => {
        const anchor = link.getAttribute('data-anchor');
        if (activeHeading && anchor === activeHeading.id) {
            link.classList.add('is-active', 'font-semibold');
        } else {
            link.classList.remove('is-active', 'font-semibold');
        }
    });

    const activeId = activeHeading ? activeHeading.id : null;
    if (activeId && activeId !== lastActiveTocAnchor) {
        document.querySelectorAll(`.toc-link[data-anchor="${activeId}"]`).forEach(link => {
            link.scrollIntoView({ block: 'nearest' });
        });
        lastActiveTocAnchor = activeId;
    }
}

// Listen for scroll events to update active TOC link
let ticking = false;
window.addEventListener('scroll', () => {
    if (!ticking) {
        window.requestAnimationFrame(() => {
            updateActiveTocLink();
            ticking = false;
        });
        ticking = true;
    }
});

// Sync TOC highlight on hash changes and TOC clicks
window.addEventListener('hashchange', () => {
    alignToCurrentHash();
    requestAnimationFrame(updateActiveTocLink);
});

document.addEventListener('click', (event) => {
    const link = event.target.closest('.toc-link');
    if (!link) {
        return;
    }
    const anchor = link.getAttribute('data-anchor');
    if (!anchor) {
        return;
    }
    requestAnimationFrame(() => {
        document.querySelectorAll('.toc-link').forEach(item => {
            const active = item.getAttribute('data-anchor') === anchor;
            item.classList.toggle('is-active', active);
            item.classList.toggle('font-semibold', active);
        });
        lastActiveTocAnchor = anchor;
        updateActiveTocLink();
    });
});

// Re-run mermaid on HTMX content swaps
document.body.addEventListener('htmx:afterSwap', function(event) {
    if (isLightweightSearchSwap(event.target)) {
        bindBookmarkButtons(event.target);
        return;
    }
    mermaidDebugSnapshot('before mermaid.run (htmx:afterSwap)');
    document.querySelectorAll('.mermaid-wrapper').forEach(wrapper => {
        if (!wrapper.id) {
            return;
        }
        // HTMX swaps can trigger a mermaid re-run that replaces SVGs.
        // Clear interaction state so we always re-bind after mermaid.run().
        delete mermaidStates[wrapper.id];
        delete wrapper.dataset.mermaidInteractive;
    });
    const swapScope = event.target || document;
    const mermaidNodes = collectRenderableMermaidNodes(swapScope);
    const renderPromise = mermaidNodes.length > 0
        ? mermaid.run({ nodes: mermaidNodes })
        : Promise.resolve();
    renderPromise.then(() => {
        mermaidDebugSnapshot('after mermaid.run (htmx:afterSwap)');
        scheduleMermaidInteraction();
    });
    renderD2Diagrams(swapScope);
    renderTasksGraphs(swapScope);
    initHeadingFolds(swapScope);
    normalizeCriticalTextColors(swapScope);
    scheduleHashAlignment();
    updateActivePostLink();
    updateActiveTocLink();
    initMobileMenus(); // Reinitialize mobile menu handlers
    // Only reveal/scroll sidebar when main content changes, not on sidebar tree folder expansions
    const isMainContentSwap = event.target?.id === 'main-content';
    if (isMainContentSwap) {
        initPostsSidebarAutoReveal();
    }
    if (event.target?.id === 'posts-sidebar') {
        window.__vyasaPostsSidebarWasOpen = false;
    }
    initFolderChevronState();
    initFolderHoverExpand(event.target || document);
    syncPostsHoverToggleButtons(event.target || document);
    initSearchPlaceholderCycle(event.target || document);
    initCodeBlockCopyButtons(event.target || document);
});

// Watch for theme changes and re-render mermaid/D2
const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
            reinitializeMermaid();
            renderD2Diagrams();        } else if (mutation.attributeName === 'style') {        }
    });
});

observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class', 'style']
});

// Mobile menu toggle functionality
function initMobileMenus() {
    const getPostsPanel = () => document.getElementById('mobile-posts-panel');
    const getTocPanel = () => document.getElementById('mobile-toc-panel');
    const postsPanel = getPostsPanel();
    const tocPanel = getTocPanel();

    const togglePostsPanel = () => {
        const postsPanel = getPostsPanel();
        const tocPanel = getTocPanel();
        if (!postsPanel) return;
        const isOpen = postsPanel.classList.contains('translate-x-0');
        if (isOpen) {
            postsPanel.classList.remove('translate-x-0');
            postsPanel.classList.add('-translate-x-full');
            return;
        }
        postsPanel.classList.remove('-translate-x-full');
        postsPanel.classList.add('translate-x-0');
        postsPanel.querySelectorAll('details[data-sidebar="posts"]').forEach((sidebar) => {
            sidebar.open = true;
            revealInSidebar(sidebar);
        });
        if (tocPanel) {
            tocPanel.classList.remove('translate-x-0');
            tocPanel.classList.add('translate-x-full');
        }
    };

    const toggleTocPanel = () => {
        const tocPanel = getTocPanel();
        const postsPanel = getPostsPanel();
        if (!tocPanel) return;
        const isOpen = tocPanel.classList.contains('translate-x-0');
        if (isOpen) {
            tocPanel.classList.remove('translate-x-0');
            tocPanel.classList.add('translate-x-full');
            return;
        }
        tocPanel.classList.remove('translate-x-full');
        tocPanel.classList.add('translate-x-0');
        tocPanel.querySelectorAll('details').forEach((sidebar) => {
            sidebar.open = true;
        });
        if (postsPanel) {
            postsPanel.classList.remove('translate-x-0');
            postsPanel.classList.add('-translate-x-full');
        }
    };

    window.__vyasaTogglePostsPanel = togglePostsPanel;
    window.__vyasaToggleTocPanel = toggleTocPanel;

    if (!window.__vyasaMobileMenusBound) {
        document.addEventListener('click', (event) => {
            if (event.target.closest('#close-mobile-posts')) {
                event.preventDefault();
                const postsPanel = document.getElementById('mobile-posts-panel');
                postsPanel?.classList.remove('translate-x-0');
                postsPanel?.classList.add('-translate-x-full');
                return;
            }
            if (event.target.closest('#close-mobile-toc')) {
                event.preventDefault();
                const tocPanel = document.getElementById('mobile-toc-panel');
                tocPanel?.classList.remove('translate-x-0');
                tocPanel?.classList.add('translate-x-full');
            }
        });
        window.__vyasaMobileMenusBound = true;
    }
    
    // Close panels on link click (for better mobile UX)
    if (postsPanel) {
        postsPanel.addEventListener('click', (e) => {
            if (e.target.tagName === 'A' || e.target.closest('a')) {
                setTimeout(() => {
                    postsPanel.classList.remove('translate-x-0');
                    postsPanel.classList.add('-translate-x-full');
                }, 100);
            }
        });
    }
    
    if (tocPanel) {
        tocPanel.addEventListener('click', (e) => {
            if (e.target.tagName === 'A' || e.target.closest('a')) {
                setTimeout(() => {
                    tocPanel.classList.remove('translate-x-0');
                    tocPanel.classList.add('translate-x-full');
                }, 100);
            }
        });
    }
}

function initCommandPalette() {
    if (document.getElementById('vyasa-command-palette')) return;
    const palette = document.createElement('div');
    palette.id = 'vyasa-command-palette';
    palette.className = 'fixed inset-0 z-[9999] hidden bg-slate-950/45 backdrop-blur-sm';
    palette.innerHTML = `
        <div class="mx-auto mt-[12vh] w-[min(42rem,calc(100vw-2rem))] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 shadow-2xl">
            <div class="border-b border-slate-200 dark:border-slate-800 p-3">
                <input type="search" name="q" autocomplete="off" placeholder="Search file names..." class="vyasa-command-palette-input w-full bg-transparent px-2 py-2 text-base text-slate-800 dark:text-slate-100 outline-none" />
            </div>
            <div class="vyasa-command-palette-results max-h-[55vh] overflow-y-auto p-3"></div>
        </div>`;
    document.body.appendChild(palette);
    const input = palette.querySelector('input');
    const results = palette.querySelector('.vyasa-command-palette-results');
    let timer = null;
    let activeIndex = -1;
    const resultLinks = () => Array.from(results.querySelectorAll('a.post-search-link'));
    const setActive = (index) => {
        const links = resultLinks();
        links.forEach((link) => link.classList.remove('is-active'));
        if (!links.length) {
            activeIndex = -1;
            return;
        }
        activeIndex = (index + links.length) % links.length;
        links[activeIndex].classList.add('is-active');
        links[activeIndex].scrollIntoView({ block: 'nearest' });
    };
    const close = () => palette.classList.add('hidden');
    const open = () => {
        palette.classList.remove('hidden');
        input.focus();
        input.select();
        if (!results.innerHTML.trim()) results.innerHTML = '<div class="text-xs text-slate-500">Type to search file names.</div>';
    };
    const runSearch = () => {
        const query = encodeURIComponent(input.value.trim());
        fetch(`/_sidebar/posts/search?q=${query}`, { headers: { 'HX-Request': 'true' } }).then((response) => response.text()).then((html) => {
            results.innerHTML = extractSearchResultsHtml(html);
            setActive(0);
            bindBookmarkButtons(results);
        }).catch(() => {});
    };
    input.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(runSearch, 180);
    });
    const openLink = (link) => {
        const href = link?.getAttribute('href');
        if (!href) return;
        close();
        document.body.classList.remove('pdf-focus');
        if (window.htmx && typeof window.htmx.ajax === 'function') {
            window.htmx.ajax('GET', href, {
                target: '#main-content',
                swap: 'outerHTML show:window:top settle:0.1s',
                pushURL: true
            });
            if (window.location.pathname !== href) {
                window.history.pushState(null, '', href);
            }
            return;
        }
        window.location.assign(href);
    };
    input.addEventListener('keydown', (event) => {
        const links = resultLinks();
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActive(activeIndex + 1);
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActive(activeIndex - 1);
        } else if (event.key === 'Enter' && links[activeIndex]) {
            event.preventDefault();
            openLink(links[activeIndex]);
        }
    });
    palette.addEventListener('click', (event) => {
        const link = event.target.closest('a');
        if (link) {
            event.preventDefault();
            openLink(link);
            return;
        }
        if (event.target === palette) close();
    });
    document.addEventListener('keydown', (event) => {
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
            event.preventDefault();
            open();
        } else if (event.key === 'Escape' && !palette.classList.contains('hidden')) {
            close();
        }
    }, true);
}

// Keyboard shortcuts for toggling sidebars
function initKeyboardShortcuts() {
    // Prewarm the selectors to avoid lazy compilation delays
    const postsSidebars = document.querySelectorAll('details[data-sidebar="posts"]');
    const tocSidebar = document.querySelector('#toc-sidebar details');
    const isMobileSidebarMode = () => window.matchMedia('(max-width: 1279px)').matches;
    
    document.addEventListener('keydown', (e) => {
        // Skip if user is typing in an input field
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
            return;
        }
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        
        // Z: Toggle posts panel
        if (e.key === 'z' || e.key === 'Z') {
            e.preventDefault();
            if (isMobileSidebarMode()) {
                window.__vyasaTogglePostsPanel?.();
                return;
            }
            const postsSidebars = document.querySelectorAll('details[data-sidebar="posts"]');
            postsSidebars.forEach(sidebar => {
                sidebar.open = !sidebar.open;
            });
        }
        
        // X: Toggle TOC panel
        if (e.key === 'x' || e.key === 'X') {
            e.preventDefault();
            if (isMobileSidebarMode()) {
                window.__vyasaToggleTocPanel?.();
                return;
            }
            const tocSidebar = document.querySelector('#toc-sidebar details');
            if (tocSidebar) {
                tocSidebar.open = !tocSidebar.open;
            }
        }

        if (e.key === 'c' || e.key === 'C') {
            const foldToggle = document.querySelector('#main-content [data-vyasa-fold-all]');
            if (!foldToggle) return;
            e.preventDefault();
            foldToggle.click();
        }
    });
}

function syncPdfFocusButtons(root = document) {
    const isFocused = document.body.classList.contains('pdf-focus');
    root.querySelectorAll('[data-pdf-focus-toggle]').forEach((button) => {
        const focusLabel = button.getAttribute('data-pdf-focus-label') || 'Focus PDF';
        const exitLabel = button.getAttribute('data-pdf-exit-label') || 'Exit focus';
        button.textContent = isFocused ? exitLabel : focusLabel;
        button.setAttribute('aria-pressed', isFocused ? 'true' : 'false');
    });
}

function ensurePdfFocusState() {
    const hasPdfViewer = document.querySelector('.pdf-viewer') || document.querySelector('[data-pdf-focus-toggle]');
    if (!hasPdfViewer) {
        document.body.classList.remove('pdf-focus');
    }
    syncPdfFocusButtons(document);
}

function initPdfFocusToggle() {
    document.addEventListener('click', (event) => {
        const button = event.target.closest('[data-pdf-focus-toggle]');
        if (!button) {
            return;
        }
        event.preventDefault();
        document.body.classList.toggle('pdf-focus');
        syncPdfFocusButtons(document);
    });

    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') {
            return;
        }
        if (!document.body.classList.contains('pdf-focus')) {
            return;
        }
        document.body.classList.remove('pdf-focus');
        syncPdfFocusButtons(document);
    });
}

function openIframeFullscreen(button) {
    const src = button.getAttribute('data-iframe-src');
    const title = button.getAttribute('data-iframe-title') || 'Embedded content';
    const allow = button.getAttribute('data-iframe-allow') || '';
    const allowfullscreen = button.getAttribute('data-iframe-allowfullscreen') === 'true';

    let overlay = document.querySelector('.iframe-fullscreen-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'iframe-fullscreen-overlay';
        overlay.innerHTML = `
            <div class="iframe-fullscreen-header">
                <div class="iframe-fullscreen-title"></div>
                <button type="button" class="iframe-fullscreen-close px-2 py-1 text-xs border rounded hover:bg-slate-700">
                    Close
                </button>
            </div>
            <div class="iframe-fullscreen-body">
                <iframe class="iframe-fullscreen-frame" frameborder="0"></iframe>
            </div>
        `;
        document.body.appendChild(overlay);

        overlay.addEventListener('click', (event) => {
            if (event.target.classList.contains('iframe-fullscreen-overlay')) {
                closeIframeFullscreen();
            }
        });

        overlay.querySelector('.iframe-fullscreen-close').addEventListener('click', () => {
            closeIframeFullscreen();
        });
    }

    overlay.querySelector('.iframe-fullscreen-title').textContent = title;
    const frame = overlay.querySelector('.iframe-fullscreen-frame');
    frame.setAttribute('src', src);
    frame.setAttribute('title', title);
    frame.setAttribute('allow', allow);
    if (allowfullscreen) {
        frame.setAttribute('allowfullscreen', '');
    } else {
        frame.removeAttribute('allowfullscreen');
    }

    document.body.classList.add('iframe-fullscreen-open');
    overlay.style.display = 'flex';
}

function closeIframeFullscreen() {
    const overlay = document.querySelector('.iframe-fullscreen-overlay');
    if (!overlay) {
        return;
    }
    const frame = overlay.querySelector('.iframe-fullscreen-frame');
    if (frame) {
        frame.setAttribute('src', 'about:blank');
    }
    overlay.style.display = 'none';
    document.body.classList.remove('iframe-fullscreen-open');
}

function initIframeFullscreenToggle() {
    document.addEventListener('click', (event) => {
        const button = event.target.closest('[data-iframe-fullscreen-toggle]');
        if (!button) {
            return;
        }
        event.preventDefault();
        openIframeFullscreen(button);
    });

    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') {
            return;
        }
        closeIframeFullscreen();
    });
}

function initJsonFocusToggle() {
    const close = () => document.getElementById('json-focus-modal')?.remove();
    document.addEventListener('click', (event) => {
        const button = event.target.closest('[data-json-focus-target]');
        if (!button) return;
        const textarea = document.getElementById(button.getAttribute('data-json-focus-target'));
        if (!textarea) return;
        const title = button.getAttribute('data-json-focus-title') || 'JSON';
        close();
        const modal = document.createElement('div');
        modal.id = 'json-focus-modal';
        modal.className = 'fixed inset-0 z-[10000] bg-black/80 backdrop-blur-sm p-4 flex items-center justify-center';
        modal.innerHTML = `<div class="w-full max-w-6xl h-[92vh] bg-white dark:bg-slate-950 rounded-xl shadow-2xl flex flex-col"><div class="flex items-center justify-between gap-3 p-4 border-b border-slate-200 dark:border-slate-800"><div class="text-sm font-semibold text-slate-900 dark:text-slate-100">${title}</div><div class="flex items-center gap-2"><button type="button" class="json-focus-save px-3 py-2 text-sm rounded-md bg-blue-600 text-white">Save</button><button type="button" class="json-focus-close px-3 py-2 text-sm rounded-md border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200">Close</button></div></div><div class="p-4 flex-1"><textarea class="w-full h-full vyasa-admin-json px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/85 dark:bg-slate-900/70"></textarea></div></div>`;
        const editor = modal.querySelector('textarea');
        editor.value = textarea.value;
        modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
        modal.querySelector('.json-focus-close').addEventListener('click', close);
        modal.querySelector('.json-focus-save').addEventListener('click', () => { textarea.value = editor.value; close(); });
        document.body.appendChild(modal);
        editor.focus();
    });
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape') close(); });
}

function initAnnotations(root = document) {
    const main = root.getElementById?.('main-content') || document.getElementById('main-content');
    if (!main || main.dataset.annotationsEnabled !== '1' || main.dataset.annotationsBound === '1') return;
    main.dataset.annotationsBound = '1';
    const path = main.dataset.annotationPath || '__index__';
    const currentAuthor = main.dataset.annotationAuthor || 'anonymous';
    let pending = null;
    const annotationHiddenText = (node) => {
        const parent = node.parentElement;
        if (!parent) return true;
        if (parent.closest('textarea, input, button, select, option, script, style, template, [hidden], [aria-hidden="true"]')) return true;
        const style = window.getComputedStyle(parent);
        return style.display === 'none' || style.visibility === 'hidden';
    };
    const annotationIgnored = (node) => {
        const parent = node.parentElement;
        return !parent
            || annotationHiddenText(node)
            || parent.closest('.sidenote, .sidenote-ref, #vyasa-annotation-composer, #vyasa-annotation-trigger');
    };
    const normalizeQuote = (value) => String(value || '').replace(/\s+/g, ' ').trim();
    const rangeToAnchor = (range) => {
        const { nodes } = buildTextIndex();
        const startNode = nodes.find((entry) => entry.node === range.startContainer);
        const endNode = nodes.find((entry) => entry.node === range.endContainer);
        if (!startNode || !endNode) return null;
        return {
            start: startNode.start + range.startOffset,
            end: endNode.start + range.endOffset,
        };
    };
    const anchorToRange = (anchor) => {
        if (!anchor || typeof anchor.start !== 'number' || typeof anchor.end !== 'number') return null;
        const { nodes } = buildTextIndex();
        const locateNode = (offset, preferNextAtBoundary = false) => {
            const index = nodes.findIndex((entry) => offset >= entry.start && offset <= entry.end);
            if (index === -1) return null;
            const entry = nodes[index];
            if (preferNextAtBoundary && offset === entry.end && nodes[index + 1]?.start === offset) return nodes[index + 1];
            return entry;
        };
        const a = locateNode(anchor.start, true);
        const endOffset = Math.max(anchor.start, anchor.end - 1);
        const b = locateNode(endOffset, false);
        if (!a || !b) return null;
        const range = document.createRange();
        range.setStart(a.node, Math.max(0, anchor.start - a.start));
        range.setEnd(b.node, Math.max(0, anchor.end - b.start));
        return range;
    };
    const buildTextIndex = () => {
        const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
        const nodes = [];
        let raw = '', node;
        while ((node = walker.nextNode())) {
            const value = node.nodeValue || '';
            if (!value || annotationIgnored(node)) continue;
            nodes.push({ node, start: raw.length, end: raw.length + value.length });
            raw += value;
        }
        const map = [];
        let normalized = '', gap = false;
        for (let i = 0; i < raw.length; i += 1) {
            const ch = raw[i];
            if (/\s/.test(ch)) {
                if (!gap) { normalized += ' '; map.push(i); gap = true; }
            } else {
                normalized += ch; map.push(i); gap = false;
            }
        }
        return { nodes, raw, normalized, map };
    };
    const findQuoteRange = (quote) => {
        const { nodes, normalized, map } = buildTextIndex();
        const needle = normalizeQuote(quote);
        const startNorm = normalized.indexOf(needle);
        const endNorm = startNorm + needle.length - 1;
        if (startNorm === -1 || endNorm < startNorm) return null;
        const start = map[startNorm], end = map[endNorm] + 1;
        if (start === -1) return null;
        const a = nodes.find((entry) => start >= entry.start && start <= entry.end);
        const b = nodes.find((entry) => end >= entry.start && end <= entry.end);
        if (!a || !b) return null;
        const range = document.createRange();
        range.setStart(a.node, Math.max(0, start - a.start));
        range.setEnd(b.node, Math.max(0, end - b.start));
        return range;
    };
    const highlightRects = (quote, anchor = null) => {
        const { nodes, normalized, map } = buildTextIndex();
        let start = null, end = null;
        if (anchor && typeof anchor.start === 'number' && typeof anchor.end === 'number') {
            start = anchor.start;
            end = anchor.end;
        } else {
            const needle = normalizeQuote(quote);
            const startNorm = normalized.indexOf(needle);
            const endNorm = startNorm + needle.length - 1;
            if (startNorm !== -1 && endNorm >= startNorm) {
                start = map[startNorm];
                end = map[endNorm] + 1;
            }
        }
        if (start == null || end == null) return [];
        const rects = [];
        nodes.forEach((entry) => {
            const from = Math.max(start, entry.start);
            const to = Math.min(end, entry.end);
            if (from >= to) return;
            const slice = document.createRange();
            slice.setStart(entry.node, from - entry.start);
            slice.setEnd(entry.node, to - entry.start);
            rects.push(...Array.from(slice.getClientRects()));
        });
        const filtered = rects
            .map((rect) => ({
                left: rect.left,
                top: rect.top,
                width: rect.width,
                height: rect.height,
                right: rect.right,
                bottom: rect.bottom,
            }))
            .filter((rect) => rect.width >= 6 && rect.height >= 8);
        filtered.sort((a, b) => (Math.abs(a.top - b.top) < 3 ? a.left - b.left : a.top - b.top));
        const merged = [];
        filtered.forEach((rect) => {
            const prev = merged[merged.length - 1];
            const sameLine = prev && Math.abs(prev.top - rect.top) < 3 && Math.abs(prev.height - rect.height) < 4;
            const touching = sameLine && rect.left <= prev.right + 10;
            if (touching) {
                prev.right = Math.max(prev.right, rect.right);
                prev.bottom = Math.max(prev.bottom, rect.bottom);
                prev.width = prev.right - prev.left;
                prev.height = prev.bottom - prev.top;
                return;
            }
            merged.push({ ...rect });
        });
        return merged;
    };
    const renderQuoteGlow = (quote, anchor = null, options = {}) => {
        const rects = highlightRects(quote, anchor);
        if (!rects.length) return [];
        return rects.map((rect) => {
            const glow = document.createElement('div');
            glow.className = 'fixed pointer-events-none z-[1600] rounded';
            glow.style.top = `${rect.top - 2}px`;
            glow.style.left = `${rect.left - 10}px`;
            glow.style.width = `${Math.max(18, rect.width + 20)}px`;
            glow.style.height = `${rect.height + 4}px`;
            glow.style.background = 'rgba(245, 158, 11, 0.34)';
            glow.style.boxShadow = '0 0 28px rgba(245, 158, 11, 0.24)';
            glow.style.opacity = '1';
            glow.style.transform = 'scale(0.98)';
            glow.style.filter = 'blur(6px)';
            glow.style.borderRadius = '14px';
            glow.style.transition = 'opacity 1100ms ease, transform 1100ms ease, filter 1100ms ease';
            document.body.appendChild(glow);
            if (options.persistent) return glow;
            setTimeout(() => {
                glow.style.opacity = '0';
                glow.style.transform = 'scale(1.06)';
                glow.style.filter = 'blur(12px)';
            }, 180);
            setTimeout(() => glow.remove(), 1400);
            return glow;
        });
    };
    const flashQuote = (quote, anchor = null) => renderQuoteGlow(quote, anchor);
    const persistAnnotation = (item, comment) => fetch(`/api/annotations/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            id: item.id,
            parent_id: item.parent_id || '',
            quote: item.quote || '',
            prefix: '',
            suffix: '',
            anchor: item.anchor || {},
            comment,
        }),
    }).then((r) => r.ok ? r.json() : Promise.reject());
    const removeAnnotation = (annotationId) => fetch(`/api/annotations/${path}/${annotationId}`, {
        method: 'DELETE',
    }).then((r) => r.ok ? r.json() : Promise.reject());
    const makeNote = (item) => {
        const note = document.createElement('div');
        note.id = `ann-${item.id}`;
        note.className = `sidenote ${item.parent_id ? 'annotation-reply' : ''} cursor-pointer select-none text-sm leading-relaxed border-l-2 border-amber-400 dark:border-blue-400 pl-3 text-neutral-500 dark:text-neutral-400 transition-all duration-500 w-full my-2 xl:my-0`.trim();
        const row = document.createElement('div');
        row.className = 'block';
        const authorLine = document.createElement('div');
        authorLine.className = 'font-semibold';
        authorLine.textContent = item.author || 'anonymous';
        const body = document.createElement('div');
        body.className = 'mt-1';
        body.textContent = item.comment;
        row.appendChild(authorLine);
        row.appendChild(body);
        note.appendChild(row);
        const replies = document.createElement('div');
        replies.className = 'mt-2 space-y-2';
        note.appendChild(replies);
        const openEditor = () => {
            const current = body.textContent;
            const next = window.prompt('Edit annotation', current);
            if (next == null) return;
            const comment = next.trim();
            if (!comment) return;
            persistAnnotation(item, comment).then((saved) => {
                authorLine.textContent = saved.author || item.author || 'anonymous';
                body.textContent = comment;
                item.comment = comment;
                item.author = saved.author || item.author;
            }).catch(() => {});
        };
        const canManage = (item.author || 'anonymous') === currentAuthor;
        const replyBtn = document.createElement('button');
        replyBtn.type = 'button';
        replyBtn.className = 'ml-2 inline-flex h-5 items-center justify-center rounded px-1.5 text-xs font-semibold text-slate-400 opacity-0 transition-opacity hover:text-slate-700';
        replyBtn.textContent = 'Reply';
        replyBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            const next = window.prompt('Reply');
            const comment = next?.trim();
            if (!comment) return;
            const reply = { id: Date.now().toString(36), parent_id: item.id, quote: item.quote, anchor: item.anchor || {}, comment, author: currentAuthor, replies: [] };
            persistAnnotation(reply, comment).then((saved) => {
                reply.author = saved.author || reply.author;
                const { note: replyNode } = makeNote(reply);
                replies.appendChild(replyNode);
                item.replies.push(reply);
            }).catch(() => {});
        });
        row.appendChild(replyBtn);
        if (canManage) {
            const edit = document.createElement('button');
            edit.type = 'button';
            edit.className = 'ml-2 inline-flex h-5 w-5 items-center justify-center rounded text-xs font-semibold text-slate-400 opacity-0 transition-opacity hover:text-slate-700';
            edit.setAttribute('aria-label', 'Edit annotation');
            edit.textContent = '✎';
            edit.addEventListener('click', (event) => { event.stopPropagation(); openEditor(); });
            row.appendChild(edit);
            const del = document.createElement('button');
            del.type = 'button';
            del.className = 'ml-2 inline-flex h-5 w-5 items-center justify-center rounded text-sm font-semibold text-red-500 opacity-0 transition-opacity hover:text-red-600';
            del.setAttribute('aria-label', 'Delete annotation');
            del.textContent = '×';
            del.addEventListener('click', (event) => {
                event.stopPropagation();
                removeAnnotation(item.id)
                    .then((payload) => {
                        if (!payload.ok) return;
                        note.remove();
                    })
                    .catch(() => {});
            });
            row.appendChild(del);
            note.addEventListener('mouseenter', () => { edit.style.opacity = '1'; del.style.opacity = '1'; replyBtn.style.opacity = '1'; });
            note.addEventListener('mouseleave', () => { edit.style.opacity = '0'; del.style.opacity = '0'; replyBtn.style.opacity = '0'; });
        } else {
            note.addEventListener('mouseenter', () => { replyBtn.style.opacity = '1'; });
            note.addEventListener('mouseleave', () => { replyBtn.style.opacity = '0'; });
        }
        const activate = () => {
            flashQuote(item.quote || '', item.anchor || null);
            if (window.innerWidth >= 1280) {
                note.classList.add('hl');
                setTimeout(() => note.classList.remove('hl'), 1000);
            } else {
                note.classList.toggle('show');
            }
        };
        row.addEventListener('click', activate);
        let hoverBloomAt = 0;
        let hoverGlows = [];
        const clearHoverGlows = () => {
            hoverGlows.forEach((glow) => glow.remove());
            hoverGlows = [];
        };
        row.addEventListener('mouseenter', () => {
            const now = Date.now();
            if (now - hoverBloomAt < 900) return;
            hoverBloomAt = now;
            clearHoverGlows();
            hoverGlows = renderQuoteGlow(item.quote || '', item.anchor || null, { persistent: true });
        });
        row.addEventListener('mouseleave', clearHoverGlows);
        window.addEventListener('scroll', clearHoverGlows, { passive: true });
        window.addEventListener('resize', clearHoverGlows);
        (item.replies || []).forEach((reply) => replies.appendChild(makeNote(reply).note));
        return { note };
    };
    const insertionRangeForNode = (node, offset) => {
        const heading = node.parentElement?.closest?.('h1, h2, h3, h4, h5, h6');
        const range = document.createRange();
        if (heading) {
            range.selectNodeContents(heading);
            range.collapse(false);
            return range;
        }
        range.setStart(node, offset);
        range.collapse(true);
        return range;
    };
    const normalizeAnnotation = (item) => {
        const anchor = item.anchor && typeof item.anchor === 'string' ? JSON.parse(item.anchor) : item.anchor;
        return { ...item, anchor, parent_id: item.parent_id || '', replies: [] };
    };
    const buildAnnotationTree = (items) => {
        const byId = new Map();
        const roots = [];
        items.map(normalizeAnnotation).forEach((item) => byId.set(item.id, item));
        byId.forEach((item) => {
            const parent = item.parent_id ? byId.get(item.parent_id) : null;
            if (parent) parent.replies.push(item);
            else roots.push(item);
        });
        const sortReplies = (nodes) => nodes.sort((a, b) => `${a.created_at}:${a.id}`.localeCompare(`${b.created_at}:${b.id}`)).forEach((node) => sortReplies(node.replies));
        sortReplies(roots);
        return roots;
    };
    const injectAnnotation = (item) => {
        const exact = anchorToRange(item.anchor);
        const host = exact?.startContainer?.parentElement?.closest?.('p, li, blockquote, h1, h2, h3, h4, h5, h6') || (() => {
            const needle = normalizeQuote(item.quote);
            if (!needle) return null;
            const candidates = Array.from(main.querySelectorAll('p, li, h1, h2, h3, h4, h5, h6, blockquote'));
            return candidates.find((el) => !el.closest('.sidenote') && normalizeQuote(el.textContent).includes(needle)) || null;
        })();
        if (!host) return false;
        const { note } = makeNote(item);
        host.insertAdjacentElement('afterbegin', note);
        return true;
    };
    fetch(`/api/annotations/${path}`).then((r) => r.ok ? r.json() : []).then((items) => {
        if (!Array.isArray(items)) return;
        buildAnnotationTree(items).forEach(injectAnnotation);
    }).catch(() => {});
    const clearUi = () => {
        document.getElementById('vyasa-annotation-trigger')?.remove();
        document.getElementById('vyasa-annotation-composer')?.remove();
    };
    main.addEventListener('mouseup', () => {
        const sel = window.getSelection();
        clearUi();
        if (!sel || sel.isCollapsed || !main.contains(sel.anchorNode) || !main.contains(sel.focusNode)) return;
        const text = sel.toString().trim();
        if (!text) return;
        const rect = sel.getRangeAt(0).getBoundingClientRect();
        pending = { quote: text, range: sel.getRangeAt(0).cloneRange(), rect, anchor: rangeToAnchor(sel.getRangeAt(0)) };
        const trigger = document.createElement('button');
        trigger.id = 'vyasa-annotation-trigger';
        trigger.type = 'button';
        trigger.className = 'fixed z-[1400] flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white/96 text-slate-700 shadow-lg backdrop-blur dark:border-slate-700 dark:bg-slate-950/96 dark:text-slate-200';
        trigger.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" class="h-4 w-4"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4Z" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"/></svg>';
        trigger.style.top = `${Math.max(12, pending.rect.top - 6)}px`;
        trigger.style.left = `${Math.min(window.innerWidth - 56, pending.rect.right + 10)}px`;
        document.body.appendChild(trigger);
        trigger.addEventListener('click', () => {
            if (!pending) return;
            document.getElementById('vyasa-annotation-composer')?.remove();
            const box = document.createElement('div');
            box.id = 'vyasa-annotation-composer';
            box.className = 'fixed z-[1400] w-[20rem] rounded-xl border border-slate-200 bg-[var(--vyasa-paper,#fff)] p-3 shadow-2xl dark:border-slate-700';
            box.style.top = `${Math.min(window.innerHeight - 160, Math.max(12, pending.rect.top + 28))}px`;
            box.style.left = `${Math.min(window.innerWidth - 340, pending.rect.right + 10)}px`;
            box.innerHTML = `<textarea class="h-24 w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm text-[var(--vyasa-ink,#2d3434)] dark:border-slate-700" placeholder="Write a comment"></textarea><div class="mt-2 flex justify-end gap-2"><button type="button" data-ann-cancel class="rounded-md px-3 py-1.5 text-sm text-slate-500">Cancel</button><button type="button" data-ann-save class="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white dark:bg-slate-100 dark:text-slate-900">Save</button></div>`;
            document.body.appendChild(box);
            box.querySelector('[data-ann-cancel]').addEventListener('click', clearUi);
            box.querySelector('textarea').focus();
            box.querySelector('[data-ann-save]').addEventListener('click', () => {
                const body = box.querySelector('textarea').value.trim();
                if (!body || !pending?.range) return;
                const item = {
                    id: Date.now().toString(36),
                    quote: pending.quote,
                    anchor: pending.anchor,
                };
                const range = insertionRangeForNode(pending.range.endContainer, pending.range.endOffset);
                persistAnnotation(item, body).then((saved) => {
                    const { note } = makeNote({ ...item, comment: body, author: saved.author || currentAuthor });
                    range.insertNode(note);
                    window.getSelection()?.removeAllRanges();
                    pending = null;
                    clearUi();
                }).catch(() => {});
            });
        });
    });
    document.addEventListener('mousedown', (event) => {
        if (!event.target.closest?.('#vyasa-annotation-trigger, #vyasa-annotation-composer')) clearUi();
    });
}

function replaceEscapedDollarPlaceholders(root) {
    const placeholder = '@@VYASA_DOLLAR@@';
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let node;
    while ((node = walker.nextNode())) if (node.nodeValue && node.nodeValue.includes(placeholder)) nodes.push(node);
    nodes.forEach((textNode) => {
        textNode.nodeValue = textNode.nodeValue.split(placeholder).join('\\$');
    });
}

function renderMathSafely(root) {
    if (typeof renderMathInElement !== 'function') return;
    const marker = '@@VYASA_CURRENCY_DOLLAR@@';
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
        const parent = node.parentElement;
        if (!parent || ['CODE', 'PRE', 'SCRIPT', 'STYLE', 'TEXTAREA'].includes(parent.tagName) || parent.closest('.katex')) continue;
        if (node.nodeValue && node.nodeValue.includes('$')) node.nodeValue = node.nodeValue.replace(/\$(?=\d)/g, marker);
    }
    renderMathInElement(root, { delimiters: [{ left: '$$', right: '$$', display: true }, { left: '$', right: '$', display: false }], throwOnError: false });
    walker.currentNode = root;
    while ((node = walker.nextNode())) if (node.nodeValue && node.nodeValue.includes(marker)) node.nodeValue = node.nodeValue.split(marker).join('$');
}

function initHighlightedCodeIncludes(root) {
    (root || document).querySelectorAll('code[data-code-highlight-lines], code[data-code-line-numbers="true"]').forEach((code) => {
        if (code.querySelector('.vyasa-code-line')) return;
        const start = Number(code.dataset.codeSourceStart || '1');
        const languageClass = Array.from(code.classList).find((cls) => cls.startsWith('language-'));
        const language = languageClass ? languageClass.replace(/^language-/, '') : '';
        const ranges = String(code.dataset.codeHighlightLines || '').split(',').map((part) => part.trim()).filter(Boolean);
        const highlighted = new Set();
        ranges.forEach((part) => {
            const [a, b] = part.split('-').map((value) => Number(value));
            for (let n = a; n <= (b || a); n += 1) highlighted.add(n);
        });
        const lines = code.textContent.split('\n');
        if (lines.length > 1 && lines[lines.length - 1] === '') {
            lines.pop();
        }
        code.innerHTML = lines.map((line, index) => {
            const lineNo = start + index;
            const isHighlighted = highlighted.has(lineNo);
            const isStart = isHighlighted && !highlighted.has(lineNo - 1);
            const isEnd = isHighlighted && !highlighted.has(lineNo + 1);
            const cls = [
                'vyasa-code-line',
                isHighlighted ? 'vyasa-code-line-highlight' : '',
                isStart ? 'vyasa-code-line-highlight-start' : '',
                isEnd ? 'vyasa-code-line-highlight-end' : '',
            ].filter(Boolean).join(' ');
            let htmlLine = line ? line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : '&nbsp;';
            if (line && window.hljs) {
                try {
                    htmlLine = language && window.hljs.getLanguage(language)
                        ? window.hljs.highlight(line, { language, ignoreIllegals: true }).value
                        : window.hljs.highlightAuto(line).value;
                } catch (_) {}
            }
            return `<span class="${cls}" data-source-line="${lineNo}">${htmlLine}</span>`;
        }).join('\n');
        code.classList.add('vyasa-code-lines');
        code.dataset.hljsBound = 'true';
    });
}

function scheduleHighlightedCodeIncludes(root) {
    const target = root || document;
    initCodeHighlighting(target);
    initHighlightedCodeIncludes(target);
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => { initCodeHighlighting(target); initHighlightedCodeIncludes(target); });
    [40, 140, 320].forEach((delay) => setTimeout(() => { initCodeHighlighting(target); initHighlightedCodeIncludes(target); }, delay));
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initHeadingFolds(document);
    syncHeadingActionStates(document);
    initScrollTopButton(document);
    initMobileScrollProgress(document);
    syncThemePresetDebug(document);
    replaceEscapedDollarPlaceholders(document.body);
    renderMathSafely(document.body);
    refreshVyasaTableScrollShadows(document);
    updateActivePostLink();
    updateActiveTocLink();
    initMobileMenus();
    initPostsSidebarAutoReveal();
    initFolderChevronState();
    initCommandPalette();
    initKeyboardShortcuts();
    initPdfFocusToggle();
    initIframeFullscreenToggle();
    initJsonFocusToggle();
    initAnnotations(document);
    initSearchPlaceholderCycle(document);
    initPostsSearchPersistence(document);
    initBookmarks(document);
    initCodeBlockCopyButtons(document);
    initHeadingPermalinkCopy(document);
    scheduleHighlightedCodeIncludes(document);
    initSearchClearButtons(document);
    ensurePdfFocusState();
    initTabPanelHeights(document);
    normalizeCriticalTextColors(document);
    recordStyleProbe('domcontentloaded');
    [100, 500, 1500].forEach((ms) => setTimeout(() => recordStyleProbe(`t+${ms}`), ms));
    scheduleHashAlignment();
});

document.body.addEventListener('htmx:afterSwap', (event) => {
    if (!event.target) {
        return;
    }
    if (isLightweightSearchSwap(event.target)) {
        bindBookmarkButtons(event.target);
        return;
    }
    initHeadingFolds(event.target);
    syncHeadingActionStates(document);
    initScrollTopButton(document);
    initMobileScrollProgress(document);
    syncThemePresetDebug(document);
    replaceEscapedDollarPlaceholders(event.target);
    renderMathSafely(event.target);
    refreshVyasaTableScrollShadows(event.target);
    initSearchPlaceholderCycle(event.target);
    initPostsSearchPersistence(event.target);
    initBookmarks(event.target);
    initFolderHoverExpand(event.target || document);
    syncPostsHoverToggleButtons(event.target || document);
    initCodeBlockCopyButtons(event.target);
    initHeadingPermalinkCopy(event.target);
    scheduleHighlightedCodeIncludes(event.target);
    initSearchClearButtons(event.target);
    initAnnotations(event.target || document);
    ensurePdfFocusState();
    initTabPanelHeights(event.target || document);
    if (event.target.id === 'posts-sidebar') {
        window.__vyasaPendingPostsSidebarState = null;
    }
});

window.addEventListener('load', () => {
    syncThemePresetDebug(document);
    normalizeCriticalTextColors(document);
    recordStyleProbe('load');
    scheduleHashAlignment();
    initFolderHoverExpand(document);
    syncPostsHoverToggleButtons(document);
    scheduleHighlightedCodeIncludes(document);
});

window.addEventListener('pageshow', () => {
    scheduleHashAlignment();
});

window.addEventListener('resize', () => refreshVyasaTableScrollShadows(document));

document.body.addEventListener('htmx:beforeRequest', (event) => {
    if (document.body.dataset.forceFullNav !== '1') {
        return;
    }
    const path = event?.detail?.requestConfig?.path || '';
    if (!path) {
        return;
    }
    event.preventDefault();
    window.location.assign(path);
});
