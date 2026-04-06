let _cytoscapeLib = null;
const _cytographInstances = {};
const _cytographSourceCache = new Map();

async function _loadCytoscape() {
    if (_cytoscapeLib) return _cytoscapeLib;
    const [{ default: cytoscape }, { default: dagre }, { default: cytoDagre }, { default: cola }, { default: cytoCola }] = await Promise.all([
        import('https://esm.sh/cytoscape@3.30.2'),
        import('https://esm.sh/dagre@0.8.5'),
        import('https://esm.sh/cytoscape-dagre@2.5.0'),
        import('https://esm.sh/webcola@3.4.0'),
        import('https://esm.sh/cytoscape-cola@2.5.1'),
    ]);
    cytoDagre(cytoscape, dagre);
    cytoCola(cytoscape, cola);
    _cytoscapeLib = cytoscape;
    return cytoscape;
}

function _parseCytographPayload(container) {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = container.dataset.cytograph;
    return JSON.parse(textarea.value);
}

function _slugifyCytographLabel(label) {
    return String(label || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'node';
}

function _parseCytree(text) {
    const nodes = [];
    const edges = [];
    const nodeStack = [];
    const baseStack = new Map();

    const resolveTarget = (target, blockBase, inheritedUrl) => {
        const inheritedBase = inheritedUrl ? inheritedUrl.split('#', 1)[0] : '';
        const activeBase = blockBase || inheritedBase;
        if (target === '=') {
            if (!activeBase) throw new Error("cytree '=' requires a base URL");
            return activeBase;
        }
        if (target.startsWith('#')) {
            if (!activeBase) throw new Error("cytree '#fragment' requires a base URL");
            return `${activeBase}${target}`;
        }
        return target;
    };

    for (const rawLine of String(text || '').split(/\r?\n/)) {
        if (!rawLine.trim() || rawLine.trim().startsWith('#')) continue;
        const indent = rawLine.length - rawLine.replace(/^\s+/, '').length;
        const depth = Math.floor(indent / 2);
        const line = rawLine.trim();

        if (line.startsWith('@base ')) {
            baseStack.set(depth, line.slice(6).trim());
            continue;
        }

        for (const key of Array.from(baseStack.keys())) {
            if (key > depth) baseStack.delete(key);
        }
        while (nodeStack.length && nodeStack.at(-1).depth >= depth) {
            nodeStack.pop();
        }

        let state = 'unexplored';
        let body = line;
        if (body.startsWith('! ')) {
            state = 'explored';
            body = body.slice(2);
        } else if (body.startsWith('* ')) {
            state = 'frontier';
            body = body.slice(2);
        }

        const [labelPart, targetPart] = body.split(/\s+->\s+/, 2);
        const label = (labelPart || '').trim();
        const parent = nodeStack.at(-1);
        const blockBase = baseStack.get(depth) || '';
        const inheritedUrl = parent?.url || '';
        const path = parent ? [...parent.path, _slugifyCytographLabel(label)] : [_slugifyCytographLabel(label)];
        const id = path.join('__');
        const url = targetPart ? resolveTarget(targetPart.trim(), blockBase, inheritedUrl) : '';

        const node = { id, label };
        if (state !== 'unexplored') node.state = state;
        if (url) node.url = url;
        nodes.push(node);
        if (parent) {
            edges.push({ source: parent.id, target: id });
        }
        nodeStack.push({ depth, id, url: url || inheritedUrl, path });
    }

    return { nodes, edges };
}

async function _loadCytographSource(sourceUrl) {
    if (!sourceUrl) return { nodes: [], edges: [] };
    if (_cytographSourceCache.has(sourceUrl)) {
        return _cytographSourceCache.get(sourceUrl);
    }
    const promise = fetch(sourceUrl).then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.text();
    }).then((text) => {
        try {
            return JSON.parse(text);
        } catch (error) {
            return _parseCytree(text);
        }
    });
    _cytographSourceCache.set(sourceUrl, promise);
    return promise;
}

function _cytographLayout(layoutName) {
    if (layoutName === 'cola') return 'cola';
    if (layoutName === 'vyasa') return 'vyasa';
    return 'dagre';
}

function _linkStyledCytographLabel(label) {
    return `${String(label || '')} ⤴`;
}

function _cytographEdgeKey(sourceId, targetId) {
    return `${sourceId}→${targetId}`;
}

function _buildGraphMaps(nodes, edges) {
    const childrenOf = {};
    const incomingCount = {};
    nodes.forEach((node) => {
        incomingCount[node.id] = 0;
    });
    edges.forEach((edge) => {
        incomingCount[edge.target] = (incomingCount[edge.target] || 0) + 1;
        if (!childrenOf[edge.source]) childrenOf[edge.source] = [];
        childrenOf[edge.source].push(edge.target);
    });

    const roots = nodes.filter((node) => !incomingCount[node.id]).map((node) => node.id);
    const normalizedNodes = nodes.map((node) => {
        const label = node.label || node.id;
        const hasChildren = !!(childrenOf[node.id] && childrenOf[node.id].length);
        return {
            ...node,
            label,
            renderLabel: node.url ? _linkStyledCytographLabel(label) : label,
            state: node.state || 'unexplored',
            classes: hasChildren ? 'has-children' : '',
        };
    });

    return {
        childrenOf,
        roots,
        nodesById: new Map(normalizedNodes.map((node) => [node.id, node])),
        edgesByKey: new Map(edges.map((edge) => [_cytographEdgeKey(edge.source, edge.target), edge])),
        initialNodeState: Object.fromEntries(normalizedNodes.map((node) => [node.id, node.state || 'unexplored'])),
    };
}

function _computeCytographVisibility(entry) {
    const visibleIds = new Set();
    const visibleEdges = new Set();
    const depthById = new Map();
    const queue = entry.roots.map((id) => ({ id, depth: 0 }));

    while (queue.length) {
        const { id, depth } = queue.shift();
        const previousDepth = depthById.get(id);
        if (previousDepth !== undefined && previousDepth <= depth) continue;
        if (!entry.nodesById.has(id)) continue;

        depthById.set(id, depth);
        visibleIds.add(id);

        const childIds = entry.childrenOf[id] || [];
        const canTraverse = (
            (depth < entry.initialDepth && !entry.collapsedIds.has(id))
            || entry.expandedIds.has(id)
        );
        if (!canTraverse) continue;

        childIds.forEach((childId) => {
            if (!entry.nodesById.has(childId)) return;
            visibleIds.add(childId);
            visibleEdges.add(_cytographEdgeKey(id, childId));
            queue.push({ id: childId, depth: depth + 1 });
        });
    }

    return { visibleIds, visibleEdges, depthById };
}

function _syncCytographElements(entry) {
    const { cy, visibility } = entry;
    const currentNodeIds = new Set(cy.nodes().map((node) => node.id()));
    const currentEdgeKeys = new Set(cy.edges().map((edge) => _cytographEdgeKey(edge.source().id(), edge.target().id())));

    cy.batch(() => {
        cy.edges().forEach((edge) => {
            const edgeKey = _cytographEdgeKey(edge.source().id(), edge.target().id());
            if (!visibility.visibleEdges.has(edgeKey)) {
                edge.remove();
            }
        });

        cy.nodes().forEach((node) => {
            if (!visibility.visibleIds.has(node.id())) {
                node.remove();
            }
        });

        const nodesToAdd = [];
        visibility.visibleIds.forEach((nodeId) => {
            if (!currentNodeIds.has(nodeId)) {
                const node = entry.nodesById.get(nodeId);
                if (node) nodesToAdd.push({ data: { ...node }, classes: node.classes || '' });
            }
        });
        if (nodesToAdd.length) {
            cy.add(nodesToAdd);
        }

        const edgesToAdd = [];
        visibility.visibleEdges.forEach((edgeKey) => {
            if (!currentEdgeKeys.has(edgeKey)) {
                const edge = entry.edgesByKey.get(edgeKey);
                if (edge) edgesToAdd.push({ data: { ...edge } });
            }
        });
        if (edgesToAdd.length) {
            cy.add(edgesToAdd);
        }

        cy.nodes().forEach((node) => {
            const nodeId = node.id();
            const childIds = entry.childrenOf[nodeId] || [];
            const depth = visibility.depthById.get(nodeId);
            const showsChildren = childIds.length > 0 && (
                ((depth ?? Infinity) < entry.initialDepth && !entry.collapsedIds.has(nodeId))
                || entry.expandedIds.has(nodeId)
            );
            node.toggleClass('cy-expanded', showsChildren);
            node.data('state', entry.nodeState[nodeId] || 'unexplored');
        });
    });
}

function _applyCytographVisibility(entry) {
    entry.visibility = _computeCytographVisibility(entry);
    _syncCytographElements(entry);
}

function _cytographLayoutOptions(engine, animated = true) {
    if (engine === 'cola') {
        return {
            name: 'cola',
            animate: animated,
            animationDuration: animated ? 320 : undefined,
            refresh: 1,
            maxSimulationTime: animated ? 1800 : 1000,
            fit: true,
            padding: animated ? 56 : 20,
            nodeDimensionsIncludeLabels: true,
            randomize: false,
            avoidOverlap: true,
            handleDisconnected: true,
            nodeSpacing: () => (animated ? 24 : 16),
            flow: { axis: 'y', minSeparation: animated ? 120 : 80 },
        };
    }
    if (engine === 'vyasa') {
        return {
            name: 'dagre',
            rankDir: 'LR',
            nodeSep: animated ? 44 : 36,
            rankSep: animated ? 132 : 100,
            edgeSep: animated ? 18 : 14,
            spacingFactor: animated ? 0.88 : 0.82,
            nodeDimensionsIncludeLabels: true,
            animate: animated,
            animationDuration: animated ? 320 : undefined,
            fit: true,
            padding: animated ? 56 : 20,
        };
    }
    return {
        name: 'dagre',
        rankDir: 'TB',
        nodeSep: animated ? 120 : 40,
        rankSep: animated ? 160 : 60,
        edgeSep: animated ? 60 : 20,
        spacingFactor: animated ? 1.35 : 1,
        nodeDimensionsIncludeLabels: true,
        animate: animated,
        animationDuration: animated ? 320 : undefined,
        fit: true,
        padding: animated ? 56 : 20,
    };
}

function _runCytographLayout(entry, animated = true) {
    if (entry.activeLayout?.stop) {
        entry.activeLayout.stop();
    }
    entry.activeLayout = entry.cy.layout(_cytographLayoutOptions(entry.engine, animated));
    entry.activeLayout.run();
}

function _cssColor(varName) {
    return getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || '#888888';
}

function _cytographStyle() {
    const primary = _cssColor('--vyasa-primary');
    const paperBg = _cssColor('--vyasa-paper');
    const paperLow = _cssColor('--vyasa-paper-low');
    const paperAccent = _cssColor('--vyasa-paper-accent');
    const ink = _cssColor('--vyasa-ink');
    const inkSoft = _cssColor('--vyasa-ink-soft');
    return [
        {
            selector: 'node',
            style: {
                'label': 'data(renderLabel)',
                'text-valign': 'center',
                'text-halign': 'center',
                'font-size': '12px',
                'font-family': 'Inter, sans-serif',
                'padding': '8px',
                'shape': 'roundrectangle',
                'width': 'label',
                'height': 'label',
                'border-color': paperAccent,
                'border-width': 1,
                'border-style': 'solid',
            },
        },
        {
            selector: 'node.has-children',
            style: {
                'border-color': primary,
                'border-width': 2,
            },
        },
        {
            selector: 'node.has-children:not(.cy-expanded)',
            style: { 'border-style': 'dashed' },
        },
        {
            selector: 'node.has-children.cy-expanded',
            style: { 'border-style': 'solid' },
        },
        {
            selector: 'node[state="explored"]',
            style: { 'background-color': primary, 'background-opacity': 0.15, 'color': ink, 'font-weight': 'bold' },
        },
        {
            selector: 'node[state="frontier"]',
            style: { 'background-color': paperBg, 'background-opacity': 1, 'color': ink },
        },
        {
            selector: 'node[state="unexplored"]',
            style: { 'background-color': paperLow, 'background-opacity': 1, 'color': inkSoft },
        },
        {
            selector: 'node[url]',
            style: { 'color': _cssColor('--vyasa-link'), 'font-weight': 600 },
        },
        {
            selector: 'edge',
            style: {
                'width': 1.5,
                'line-color': paperAccent,
                'target-arrow-color': paperAccent,
                'target-arrow-shape': 'triangle',
                'curve-style': 'bezier',
            },
        },
    ];
}

export async function initCytographs(root = document) {
    const containers = root.querySelectorAll('.cytograph-container[data-cytograph]');
    if (!containers.length) return;
    const cytoscape = await _loadCytoscape();

    for (const container of Array.from(containers)) {
        const id = container.id;
        const existing = _cytographInstances[id];
        if (existing) {
            existing.activeLayout?.stop?.();
            existing.cy.destroy();
            delete _cytographInstances[id];
        }

        let data;
        try {
            data = _parseCytographPayload(container);
        } catch (error) {
            container.textContent = 'cytograph: parse error';
            continue;
        }

        if (data.source) {
            try {
                const sourced = await _loadCytographSource(data.source);
                data = {
                    ...data,
                    nodes: Array.isArray(sourced.nodes) ? sourced.nodes : [],
                    edges: Array.isArray(sourced.edges) ? sourced.edges : [],
                };
            } catch (error) {
                container.textContent = 'cytograph: source load error';
                continue;
            }
        }

        const { nodes, edges, layout: layoutName, initial_depth: initialDepth } = data;
        const entry = {
            cy: cytoscape({
                container,
                elements: [],
                style: _cytographStyle(),
                layout: { name: 'preset', fit: true, padding: 20 },
                userZoomingEnabled: true,
                userPanningEnabled: true,
            }),
            engine: _cytographLayout(layoutName),
            activeLayout: null,
            source: data.source || '',
            initialDepth: initialDepth,
            expandedIds: new Set(),
            collapsedIds: new Set(),
            visibility: { visibleIds: new Set(), visibleEdges: new Set(), depthById: new Map() },
            ..._buildGraphMaps(nodes, edges),
        };
        entry.nodeState = { ...entry.initialNodeState };
        _cytographInstances[id] = entry;

        entry.cy.on('tap', 'node', function(evt) {
            const node = evt.target;
            const nodeId = node.id();
            const childIds = entry.childrenOf[nodeId] || [];
            if (!childIds.length) {
                const url = node.data('url');
                if (url) {
                    if (url.startsWith('http://') || url.startsWith('https://')) {
                        window.open(url, '_blank');
                    } else {
                        htmx.ajax('GET', url, {
                            target: '#main-content',
                            swap: 'outerHTML show:window:top settle:0.1s',
                            push: url,
                        });
                    }
                }
                return;
            }

            const directEdgesVisible = childIds.every((childId) => (
                entry.visibility.visibleEdges.has(_cytographEdgeKey(nodeId, childId))
            ));

            if (directEdgesVisible) {
                entry.expandedIds.delete(nodeId);
                entry.collapsedIds.add(nodeId);
            } else {
                entry.collapsedIds.delete(nodeId);
                entry.expandedIds.add(nodeId);
                if (entry.nodeState[nodeId] === 'unexplored') {
                    entry.nodeState[nodeId] = 'frontier';
                }
            }

            _applyCytographVisibility(entry);
            _runCytographLayout(entry, true);
        });

        _applyCytographVisibility(entry);
        _runCytographLayout(entry, false);
    }
}

window.resetCytograph = function(id) {
    const entry = _cytographInstances[id];
    if (entry?.cy) entry.cy.fit(undefined, 20);
};

window.resetCytographGraph = function(id) {
    const entry = _cytographInstances[id];
    if (!entry?.cy) return;
    entry.expandedIds.clear();
    entry.collapsedIds.clear();
    entry.nodeState = { ...entry.initialNodeState };
    _applyCytographVisibility(entry);
    _runCytographLayout(entry, true);
};

window.expandAllCytograph = function(id) {
    const entry = _cytographInstances[id];
    if (!entry?.cy) return;

    entry.collapsedIds.clear();
    entry.expandedIds = new Set(
        Array.from(entry.visibility.visibleIds).filter((nodeId) => (entry.childrenOf[nodeId] || []).length)
    );
    Array.from(entry.visibility.visibleIds).forEach((nodeId) => {
        if (entry.nodeState[nodeId] === 'unexplored' && (entry.childrenOf[nodeId] || []).length) {
            entry.nodeState[nodeId] = 'frontier';
        }
    });
    _applyCytographVisibility(entry);
    _runCytographLayout(entry, true);
};

window.toggleCytographLayout = function(id, button) {
    const entry = _cytographInstances[id];
    if (!entry?.cy) return;
    entry.engine = entry.engine === 'dagre'
        ? 'cola'
        : entry.engine === 'cola'
        ? 'vyasa'
        : 'dagre';
    if (button) {
        button.textContent = `Layout: ${entry.engine}`;
    }
    _runCytographLayout(entry, true);
};

window.zoomCytographIn = function(id) {
    const entry = _cytographInstances[id];
    const cy = entry?.cy;
    if (cy) cy.zoom({ level: cy.zoom() * 1.2, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } });
};

window.zoomCytographOut = function(id) {
    const entry = _cytographInstances[id];
    const cy = entry?.cy;
    if (cy) cy.zoom({ level: cy.zoom() * 0.8, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } });
};

export function refreshCytographStyles() {
    Object.values(_cytographInstances).forEach(({ cy }) => cy.style(_cytographStyle()));
}
