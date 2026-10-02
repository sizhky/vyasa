// Highlight scenarios: one small graph driven through every applyHighlight
// branch. tasks_highlight.test.mjs compares the output with a recorded baseline.
const node = (id, kind, extra = {}) => ({
    id,
    position: { x: 0, y: 0 },
    zIndex: kind === 'group' ? 10 : 1000,
    data: { __kind__: kind, label: id, status: 'todo', ...extra },
    style: { zIndex: kind === 'group' ? 10 : 1000, background: 'slate', boxShadow: 'none', opacity: 1 },
});
const edge = (id, source, target, path = 'ribbon', extra = {}) => ({
    id, source, target,
    data: { edgeColor: '#36c', __edge_path__: path, ...extra },
    style: { stroke: '#36c', strokeWidth: 2.5, opacity: 0.9 },
    labelStyle: { fontSize: '12px' },
    labelBgStyle: {},
});

export const graph = {
    baseNodes: [
        node('a', 'task'),
        node('b', 'task', { __checked__: true, __card_state_color__: '#2a2' }),
        node('c', 'task', { __node_look__: 'outline', group_id: 'g' }),
        node('g', 'group'),
        node('g__title', 'groupTitle', { sourceGroupId: 'g' }),
    ],
    authoredGraphEdges: [
        edge('e1', 'a', 'b'),
        edge('e2', 'b', 'c', 'orthogonal'),
        edge('e3', 'a', 'c', 'ribbon', { __pair_half__: 'call', __pair_mate__: 'e4' }),
        edge('e4', 'c', 'a', 'ribbon', { __pair_half__: 'reply', __pair_mate__: 'e3' }),
    ],
    referenceEdges: [edge('r1', 'a', 'c', 'ribbon', { __reference__: true })],
};

const model = {
    tasks: [{ id: 'a', status: 'todo' }, { id: 'b', status: 'todo' }, { id: 'c', status: 'todo', group_id: 'g' }],
    groups: [{ id: 'g' }],
    task_children: { null: ['a', 'b'], g: ['c'] },
    group_tree: { null: ['g'] },
};

export const baseCtx = {
    model,
    activeColorBy: 'status',
    activeColorPalette: { todo: '#c33' },
    expanded: new Set(['g']),
    edgesVisible: true,
    edgeOpacity: 0.6,
    edgePinBloom: null,
    effectiveEdgeTypes: [],
    effectiveQueryFilters: { combinator: 'and', rules: [] },
    effectiveSwatchFilters: { combinator: 'and', rules: [] },
    searchMatches: { active: false, error: '', edgeIds: new Set() },
    filteredSelectionIds: () => new Set(['a', 'b']),
    colorMix: 0,
    hoverFontSize: '12px',
};

const filtered = { ...baseCtx, effectiveQueryFilters: { combinator: 'and', rules: [{ field: 'status', operator: '=', value: 'todo' }] } };

export const scenarios = {
    edgeCard: [{ edgeId: 'e3' }, baseCtx],
    multiSelect: [{ selectedIds: new Set(['a', 'g']), hoveredNodeId: 'b' }, baseCtx],
    hoverOnly: [{ hoveredNodeId: 'a' }, baseCtx],
    rest: [{}, baseCtx],
    filterHover: [{ hoveredNodeId: 'b' }, filtered],
    selected: [{ nodeId: 'a' }, baseCtx],
    selectedFocus: [{ nodeId: 'a', hoveredNodeId: 'a' }, baseCtx],
    selectedNeighbor: [{ nodeId: 'a', hoveredNodeId: 'b' }, baseCtx],
    selectedGroup: [{ nodeId: 'g', hoveredNodeId: 'c' }, baseCtx],
};

export function runScenarios(tasksHighlightGraph) {
    return Object.fromEntries(Object.entries(scenarios).map(([name, [selection, ctx]]) => {
        const out = tasksHighlightGraph({ ...graph, ...selection }, ctx);
        return [name, JSON.parse(JSON.stringify({ nodes: out.nodes, edges: out.edges, trace: out.trace || null }))];
    }));
}
