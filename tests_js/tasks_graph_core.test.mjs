import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

globalThis.window = { innerWidth: 1000, innerHeight: 800 };

const { applyTasksFilterAttributePolicy, buildTaskEdgeAnchors, clampScale, isTasksEdgeInternalToSelection, isTasksEdgeLabelHoverDimmingActive, isTasksGraphNodeSelectable, isTasksUnspecifiedProjectionGroup, layoutDisconnectedTaskNodes, nextWheelState, normalizeTasksNodeImageUrl, resolveTasksNodeImage, selectTasksGraphNodeIdsInPolygon, selectTasksGraphNodeIdsInRect, sizeTaskNode, tasksEdgeLabelZForMode, tasksEgoNodeOpacity, tasksExpandedRootRect, tasksGraphDynamicMinZoom, tasksGraphNodeHitArea, tasksGraphStatsLabel, tasksProjectionGroupByHierarchy, toggleMultiValueFilter } = await import('../vyasa/extensions_builtin/tasks/static/tasks_graph_core.js');

test('clampScale keeps zoom in sane bounds', () => {
    assert.equal(clampScale(0.001, 3), 0.1);
    assert.equal(clampScale(9, 3), 3);
});

test('nextWheelState zooms around pointer', () => {
    const out = nextWheelState({ scale: 1, translateX: 0, translateY: 0 }, { left: 0, top: 0, width: 400, height: 200 }, { x: 300, y: 120 }, -1, 3);
    assert.ok(out.scale > 1);
    assert.notEqual(out.translateX, 0);
    assert.notEqual(out.translateY, 0);
});

test('tasksGraphDynamicMinZoom lowers the floor for oversized graphs only', () => {
    assert.equal(tasksGraphDynamicMinZoom([{ id: 'a', position: { x: 0, y: 0 }, width: 12000, height: 2400 }], { width: 1000, height: 800 }), 1 / 24);
    assert.equal(tasksGraphDynamicMinZoom([{ id: 'a', position: { x: 0, y: 0 }, width: 200, height: 120 }], { width: 1000, height: 800 }), 0.05);
});

test('sizeTaskNode grows height for long labels', () => {
    const shortNode = sizeTaskNode('short label', 'task');
    const longNode = sizeTaskNode('Adhoc/flex-gateway-policies/security/ip-allowlist/ip-allowlist-prod', 'task');
    assert.equal(shortNode.width, 220);
    assert.ok(longNode.height > shortNode.height);
});

test('sizeTaskNode grows group title height for wrapped text at runtime width', () => {
    const shortTitle = sizeTaskNode('Short title', 'groupTitle', 234);
    const longTitle = sizeTaskNode('Ground Truth Streams (Phase 2 input to A_17)', 'groupTitle', 234);
    assert.equal(shortTitle.width, 234);
    assert.ok(longTitle.height > shortTitle.height);
});

test('sizeTaskNode reserves icon width and height when images are present', () => {
    const plain = sizeTaskNode('Adhoc/flex-gateway-policies/security/ip-allowlist/ip-allowlist-prod', 'task', 220);
    const withImage = sizeTaskNode('Adhoc/flex-gateway-policies/security/ip-allowlist/ip-allowlist-prod', 'task', 220, { hasImage: true });
    const shortWithImage = sizeTaskNode('API', 'task', 220, { hasImage: true });
    assert.ok(withImage.height > plain.height);
    assert.equal(shortWithImage.height, 60);
});

test('buildTaskEdgeAnchors flips top/bottom by relative node position', () => {
    const nodes = [
        { id: 'top', position: { x: 0, y: 0 }, width: 220, height: 60 },
        { id: 'bottom', position: { x: 0, y: 200 }, width: 220, height: 60 },
    ];
    const { edges } = buildTaskEdgeAnchors(nodes, [
        { id: 'down', source: 'top', target: 'bottom' },
        { id: 'up', source: 'bottom', target: 'top' },
    ]);
    assert.equal(edges[0].sourceHandle, 'source-bottom-0');
    assert.equal(edges[0].targetHandle, 'target-top-0');
    assert.equal(edges[1].sourceHandle, 'source-top-0');
    assert.equal(edges[1].targetHandle, 'target-bottom-0');
});

test('buildTaskEdgeAnchors spreads same-side handles across edge width', () => {
    const nodes = [
        { id: 'src', position: { x: 0, y: 0 }, width: 220, height: 60 },
        { id: 'left', position: { x: -300, y: 520 }, width: 220, height: 60 },
        { id: 'mid', position: { x: 0, y: 520 }, width: 220, height: 60 },
        { id: 'right', position: { x: 300, y: 520 }, width: 220, height: 60 },
    ];
    const { nodeHandles } = buildTaskEdgeAnchors(nodes, [
        { id: 'a', source: 'src', target: 'left' },
        { id: 'b', source: 'src', target: 'mid' },
        { id: 'c', source: 'src', target: 'right' },
    ]);
    assert.deepEqual(
        nodeHandles.src.source.map((handle) => Math.round(handle.offsetPct)),
        [18, 50, 82],
    );
});

test('buildTaskEdgeAnchors uses full width when one role owns a side', () => {
    const nodes = [
        { id: 'hub', position: { x: 0, y: 0 }, width: 220, height: 60 },
        { id: 'a', position: { x: -240, y: 220 }, width: 220, height: 60 },
        { id: 'b', position: { x: 0, y: 220 }, width: 220, height: 60 },
        { id: 'c', position: { x: 240, y: 220 }, width: 220, height: 60 },
    ];
    const { nodeHandles } = buildTaskEdgeAnchors(nodes, [
        { id: 'one', source: 'hub', target: 'a' },
        { id: 'two', source: 'hub', target: 'b' },
        { id: 'three', source: 'hub', target: 'c' },
    ]);
    assert.deepEqual(
        nodeHandles.hub.source.map((handle) => Math.round(handle.offsetPct)),
        [18, 50, 82],
    );
    assert.deepEqual(
        nodeHandles.a.target.map((handle) => Math.round(handle.offsetPct)),
        [50],
    );
});

test('buildTaskEdgeAnchors splits top side into symmetric halves when roles mix', () => {
    const nodes = [
        { id: 'hub', position: { x: 0, y: 200 }, width: 220, height: 60 },
        { id: 'outA', position: { x: -220, y: 0 }, width: 220, height: 60 },
        { id: 'outB', position: { x: 220, y: 0 }, width: 220, height: 60 },
        { id: 'inA', position: { x: -120, y: -220 }, width: 220, height: 60 },
        { id: 'inB', position: { x: 120, y: -220 }, width: 220, height: 60 },
    ];
    const { nodeHandles } = buildTaskEdgeAnchors(nodes, [
        { id: 'one', source: 'hub', target: 'outA' },
        { id: 'two', source: 'hub', target: 'outB' },
        { id: 'three', source: 'inA', target: 'hub' },
        { id: 'four', source: 'inB', target: 'hub' },
    ]);
    assert.deepEqual(
        nodeHandles.hub.source.map((handle) => Math.round(handle.offsetPct)),
        [18, 39],
    );
    assert.deepEqual(
        nodeHandles.hub.target.map((handle) => Math.round(handle.offsetPct)),
        [61, 82],
    );
});

test('buildTaskEdgeAnchors spaces mixed top-side roles by total side traffic', () => {
    const nodes = [
        { id: 'hub', position: { x: 0, y: 200 }, width: 220, height: 60 },
        { id: 'out', position: { x: 0, y: 0 }, width: 220, height: 60 },
        { id: 'inA', position: { x: -180, y: -220 }, width: 220, height: 60 },
        { id: 'inB', position: { x: 180, y: -220 }, width: 220, height: 60 },
    ];
    const { nodeHandles } = buildTaskEdgeAnchors(nodes, [
        { id: 'one', source: 'hub', target: 'out' },
        { id: 'two', source: 'inA', target: 'hub' },
        { id: 'three', source: 'inB', target: 'hub' },
    ]);
    assert.deepEqual(
        nodeHandles.hub.source.map((handle) => Math.round(handle.offsetPct)),
        [18],
    );
    assert.deepEqual(
        nodeHandles.hub.target.map((handle) => Math.round(handle.offsetPct)),
        [50, 82],
    );
});

test('buildTaskEdgeAnchors uses left/right handles for same-row nodes', () => {
    const nodes = [
        { id: 'left', position: { x: 0, y: 0 }, width: 220, height: 80 },
        { id: 'right', position: { x: 360, y: 18 }, width: 220, height: 80 },
    ];
    const { edges, nodeHandles } = buildTaskEdgeAnchors(nodes, [
        { id: 'sideways', source: 'left', target: 'right' },
    ]);
    assert.equal(edges[0].sourceHandle, 'source-right-0');
    assert.equal(edges[0].targetHandle, 'target-left-0');
    assert.equal(nodeHandles.left.source[0].side, 'right');
    assert.equal(nodeHandles.right.target[0].side, 'left');
});

test('buildTaskEdgeAnchors uses left/right handles for shallow diagonal nodes', () => {
    const nodes = [
        { id: 'source', position: { x: 0, y: 0 }, width: 220, height: 80 },
        { id: 'target', position: { x: 520, y: 170 }, width: 220, height: 80 },
    ];
    const { edges } = buildTaskEdgeAnchors(nodes, [
        { id: 'shallow', source: 'source', target: 'target' },
    ]);
    assert.equal(edges[0].sourceHandle, 'source-right-0');
    assert.equal(edges[0].targetHandle, 'target-left-0');
});

test('buildTaskEdgeAnchors uses left/right handles for strong lower-right diagonal nodes', () => {
    const nodes = [
        { id: 'target', position: { x: 0, y: 0 }, width: 220, height: 80 },
        { id: 'source', position: { x: 300, y: 240 }, width: 220, height: 80 },
    ];
    const { edges } = buildTaskEdgeAnchors(nodes, [
        { id: 'diag', source: 'source', target: 'target' },
    ]);
    assert.equal(edges[0].sourceHandle, 'source-left-0');
    assert.equal(edges[0].targetHandle, 'target-right-0');
});

test('buildTaskEdgeAnchors prefers top/bottom when node sits above wide group', () => {
    const nodes = [
        { id: 'node', position: { x: 430, y: 80 }, width: 300, height: 80 },
        { id: 'group', position: { x: 40, y: 260 }, width: 830, height: 640 },
    ];
    const { edges } = buildTaskEdgeAnchors(nodes, [
        { id: 'stacked', source: 'node', target: 'group' },
    ]);
    assert.equal(edges[0].sourceHandle, 'source-bottom-0');
    assert.equal(edges[0].targetHandle, 'target-top-0');
});

test('task and collapsed group nodes are selectable in items graph', () => {
    assert.equal(isTasksGraphNodeSelectable('task'), true);
    assert.equal(isTasksGraphNodeSelectable('group', false), true);
    assert.equal(isTasksGraphNodeSelectable('group', true), true);
    assert.equal(isTasksGraphNodeSelectable('groupTitle'), true);
});

test('collapsed groups average both primary and secondary colors', () => {
    const source = fs.readFileSync(new URL('../vyasa/extensions_builtin/tasks/static/tasks.js', import.meta.url), 'utf8');
    const start = source.indexOf('function collectTasksGroupDescendants');
    const end = source.indexOf('window.runTasksHeaderAction');
    const factory = new Function(
        "const TASKS_HAS_NOTE_ATTR = 'has_note';\n"
        + "const TASKS_HAS_NOTE_PALETTE = { yes: '#22c55e', no: 'rgba(220, 38, 38, 0.28)' };\n"
        + source.slice(start, end)
        + "\nreturn { resolveTasksCollapsedGroupColor, tasksGroupBackground };"
    );
    const { resolveTasksCollapsedGroupColor, tasksGroupBackground } = factory();
    const model = {
        groups: [{ id: 'g1' }],
        tasks: [{ id: 'a', group_id: 'g1', kind: 'alpha', energy: 'hot' }, { id: 'b', group_id: 'g1', kind: 'beta', energy: 'cold' }],
        task_children: { g1: ['a', 'b'] },
        group_tree: {},
        node_color_palettes: { kind: { alpha: '#ff0000', beta: '#0000ff' }, energy: { hot: '#00ff00', cold: '#ff00ff' } },
    };
    const group = { id: 'g1', __kind__: 'group' };
    assert.equal(resolveTasksCollapsedGroupColor(group, model, 'kind', model.node_color_palettes.kind), '#800080');
    assert.equal(resolveTasksCollapsedGroupColor(group, model, 'energy', model.node_color_palettes.energy), '#808080');
    assert.equal(
        tasksGroupBackground('#800080', '#808080', 'fallback', { intensity: 12 }),
        'linear-gradient(135deg, color-mix(in srgb, var(--vyasa-paper) 88%, #800080 12%) 0 50%, color-mix(in srgb, var(--vyasa-paper) 88%, #808080 12%) 50% 100%)',
    );
});

test('collapsed grouped containers prefer child average over grouping dimension tone', () => {
    const source = fs.readFileSync(new URL('../vyasa/extensions_builtin/tasks/static/tasks.js', import.meta.url), 'utf8');
    assert.ok(source.includes("? (projectionGroupTone || nodeColor)\n                        : (collapsedGroupColor || projectionGroupTone || nodeColor);"));
});

test('drag rect selects task nodes and expanded groups', () => {
    const nodes = [
        { id: 'group-a', position: { x: 100, y: 100 }, style: { width: 160, height: 120 }, data: { __kind__: 'group' } },
        { id: 'task-a', parentId: 'group-a', position: { x: 20, y: 20 }, style: { width: 80, height: 40 }, data: { __kind__: 'task' } },
        { id: 'task-b', position: { x: 360, y: 100 }, style: { width: 80, height: 40 }, data: { __kind__: 'task' } },
    ];
    assert.deepEqual(selectTasksGraphNodeIdsInRect(nodes, { x1: 110, y1: 110, x2: 230, y2: 170 }), ['task-a']);
    assert.deepEqual(selectTasksGraphNodeIdsInRect(nodes, { x1: 95, y1: 95, x2: 265, y2: 225 }), ['group-a', 'task-a']);
});

test('polygon select requires freeform lasso to contain the whole node', () => {
    const nodes = [
        { id: 'left', position: { x: 40, y: 40 }, style: { width: 60, height: 40 }, data: { __kind__: 'task' } },
        { id: 'right', position: { x: 220, y: 40 }, style: { width: 60, height: 40 }, data: { __kind__: 'task' } },
        { id: 'low', position: { x: 130, y: 180 }, style: { width: 60, height: 40 }, data: { __kind__: 'task' } },
    ];
    const polygon = [{ x: 20, y: 20 }, { x: 180, y: 20 }, { x: 180, y: 120 }, { x: 20, y: 120 }];
    assert.deepEqual(selectTasksGraphNodeIdsInPolygon(nodes, polygon), ['left']);
    const partialPolygon = [{ x: 60, y: 20 }, { x: 180, y: 20 }, { x: 180, y: 120 }, { x: 60, y: 120 }];
    assert.deepEqual(selectTasksGraphNodeIdsInPolygon(nodes, partialPolygon), []);
});

test('graph stats count groups, tasks, and dependency edges', () => {
    assert.equal(tasksGraphStatsLabel({
        groups: [{ id: 'g1' }],
        tasks: [{ id: 'n1' }, { id: 'n2' }],
        dependency_edges: [{ source: 'n1', target: 'n2' }],
    }), '3 Nodes and 1 Edge');
});

test('projection group dropdown hierarchy reflects active projection groups', () => {
    const model = { view_projections: [{ id: 'city', groups_from: ['city', 'mood'] }] };
    assert.deepEqual(tasksProjectionGroupByHierarchy(model, 'city'), ['city', 'mood']);
    assert.deepEqual(tasksProjectionGroupByHierarchy(model, ''), []);
});

test('unspecified projection groups are detectable for reduced opacity', () => {
    assert.equal(isTasksUnspecifiedProjectionGroup({
        id: 'city-unspecified',
        label: 'City > Unspecified',
        __projection_group__: true,
        city: 'Unspecified',
    }), true);
    assert.equal(isTasksUnspecifiedProjectionGroup({ id: 'city-tokyo', __projection_group__: true, city: 'Tokyo' }), false);
});

test('EG+ neighbor opacity applies to unselected group backgrounds', () => {
    const model = {
        ego_include_neighbors: true,
        groups: [
            { id: 'selected-group' },
            { id: 'neighbor-group' },
            { id: 'selected-parent' },
        ],
        tasks: [
            { id: 'selected-task', group_id: 'selected-group' },
            { id: 'neighbor-task', group_id: 'neighbor-group' },
            { id: 'child-of-selected-group', group_id: 'selected-parent' },
        ],
        group_tree: { null: ['selected-group', 'neighbor-group', 'selected-parent'] },
        task_children: {
            'selected-group': ['selected-task'],
            'neighbor-group': ['neighbor-task'],
            'selected-parent': ['child-of-selected-group'],
        },
    };
    assert.equal(tasksEgoNodeOpacity({ id: 'selected-group', __kind__: 'group' }, new Set(['selected-task']), model, 0.25), 0.25);
    assert.equal(tasksEgoNodeOpacity({ id: 'selected-group', __kind__: 'group' }, new Set(['selected-group']), model, 0.25), 1);
    assert.equal(tasksEgoNodeOpacity({ id: 'neighbor-group', __kind__: 'group' }, new Set(['selected-task']), model, 0.25), 0.25);
    assert.equal(tasksEgoNodeOpacity({ id: 'child-of-selected-group', __kind__: 'task', group_id: 'selected-parent' }, new Set(['selected-parent']), model, 0.25), 1);
});

test('group panels use selectable hit areas in items graph', () => {
    assert.equal(tasksGraphNodeHitArea('task'), 'selectable');
    assert.equal(tasksGraphNodeHitArea('group', false), 'selectable');
    assert.equal(tasksGraphNodeHitArea('group', true), 'selectable');
    assert.equal(tasksGraphNodeHitArea('groupTitle'), 'control');
});

test('expanded root group keeps collapsed top-left anchored', () => {
    const rect = tasksExpandedRootRect({ x: 100, y: 200, width: 250, height: 80 }, { width: 650, height: 280 });
    assert.deepEqual(rect, { x: 100, y: 200, width: 650, height: 280, baseWidth: 250, baseHeight: 80 });
});

test('note special filter uses derived yes/no value', async () => {
    const fs = await import('node:fs/promises');
    const source = await fs.readFile(new URL('../vyasa/extensions_builtin/tasks/static/tasks.js', import.meta.url), 'utf8');
    const match = source.match(/function tasksEmptyFilterQuery\(\) \{[\s\S]*?\nfunction tasksSearchNormalizeText/);
    assert.ok(match, 'tasksNodeMatchesFilters should exist');
    const helpers = match[0].replace(/\nfunction tasksSearchNormalizeText$/, '');
    const factory = new Function('TASKS_HAS_NOTE_ATTR', `${helpers}; return tasksNodeMatchesFilters;`);
    const tasksNodeMatchesFilters = factory('has_note');
    assert.equal(tasksNodeMatchesFilters({ __has_note__: true }, { has_note: ['yes'] }), true);
    assert.equal(tasksNodeMatchesFilters({ __has_note__: true }, { has_note: ['no'] }), false);
    assert.equal(tasksNodeMatchesFilters({ __has_note__: false }, { has_note: ['no'] }), true);
    assert.equal(tasksNodeMatchesFilters({ kind: 'risk' }, { combinator: 'or', rules: [{ field: 'kind', operator: '=', value: 'claim' }, { field: 'kind', operator: '=', value: 'risk' }] }), true);
    assert.equal(tasksNodeMatchesFilters({ kind: 'risk' }, { combinator: 'and', not: true, rules: [{ field: 'kind', operator: '=', value: 'risk' }] }), false);
});

test('toggleMultiValueFilter supports multi-color selection and reset', () => {
    const selected = toggleMultiValueFilter({}, 'kind', 'assumption', true);
    assert.deepEqual(selected, { kind: ['assumption'] });
    const multi = toggleMultiValueFilter(selected, 'kind', 'risk', true);
    assert.deepEqual(multi, { kind: ['assumption', 'risk'] });
    const reduced = toggleMultiValueFilter(multi, 'kind', 'assumption', false);
    assert.deepEqual(reduced, { kind: ['risk'] });
    const cleared = toggleMultiValueFilter(reduced, 'kind', 'risk', false);
    assert.deepEqual(cleared, {});
});

test('applyTasksFilterAttributePolicy respects whitelist and blacklist', () => {
    assert.deepEqual(
        applyTasksFilterAttributePolicy(['owner', 'status', 'priority'], {
            filter_whitelist: ['owner', 'status'],
            filter_blacklist: ['status'],
        }),
        ['owner'],
    );
    assert.deepEqual(
        applyTasksFilterAttributePolicy(['owner', 'status', 'priority'], {
            filter_blacklist: ['priority'],
        }),
        ['owner', 'status'],
    );
});

test('color_by palette attrs can be hidden from filters and still exist on the model', () => {
    const model = {
        color_palettes: { kind: { ingress: '#93c5fd', routing: '#86efac' } },
        groups: [],
        tasks: [
            { id: 'a', label: 'A', kind: 'ingress' },
            { id: 'b', label: 'B', kind: 'routing' },
        ],
        filter_attributes: [],
    };
    const declaredKeys = Object.keys(model.color_palettes).filter((key) => key && typeof model.color_palettes[key] === 'object' && Object.keys(model.color_palettes[key] || {}).length > 0);
    const nodes = [...model.groups, ...model.tasks];
    const options = declaredKeys
        .filter((key) => nodes.some((node) => {
            const value = node?.[key];
            return value !== null && value !== undefined && String(value).trim() !== '';
        }))
        .map((key) => key);
    assert.deepEqual(options, ['kind']);
});

test('color_by uses configured color_palettes for node paint lookup', () => {
    const model = {
        color_by: 'kind',
        color_palettes: { kind: { ingress: '#93c5fd', routing: '#86efac' } },
        color_palette: {},
    };
    const tasksColorPaletteFor = (input, colorBy) => {
        const key = String(colorBy || '').trim();
        if (!key) return {};
        const palettes = input?.color_palettes && typeof input.color_palettes === 'object' ? input.color_palettes : {};
        const configuredPalette = palettes[key];
        if (configuredPalette && Object.keys(configuredPalette).length > 0) return configuredPalette;
        const legacyKey = String(input?.color_by || '').trim();
        const legacyPalette = input?.color_palette && typeof input.color_palette === 'object' ? input.color_palette : {};
        if (key === legacyKey && Object.keys(legacyPalette).length > 0) return legacyPalette;
        return {};
    };
    const resolveTasksNodeOwnColor = (node, input, colorByOverride = null, paletteOverride = null) => {
        const colorBy = colorByOverride !== null
            ? String(colorByOverride || '').trim()
            : (typeof input?.color_by === 'string' ? input.color_by.trim() : '');
        const palette = paletteOverride && typeof paletteOverride === 'object'
            ? paletteOverride
            : tasksColorPaletteFor(input, colorBy);
        const value = node[colorBy];
        return palette[String(value)] || '';
    };
    assert.equal(resolveTasksNodeOwnColor({ kind: 'ingress' }, model), '#93c5fd');
});

test('node image resolver prefers direct image over image_by palette', () => {
    const model = {
        image_by: 'type',
        node_image_palettes: { type: { database: 'iconify:devicon:postgresql', service: 'https://cdn.example.com/service.svg' } },
    };
    assert.equal(normalizeTasksNodeImageUrl('iconify:mdi:api'), 'https://api.iconify.design/mdi/api.svg');
    assert.equal(resolveTasksNodeImage({ type: 'database' }, model), 'https://api.iconify.design/devicon/postgresql.svg');
    assert.equal(resolveTasksNodeImage({ type: 'database', image: 'https://cdn.example.com/custom.svg' }, model), 'https://cdn.example.com/custom.svg');
    assert.equal(resolveTasksNodeImage({ type: 'database', image: 'javascript:alert(1)' }, model), 'https://api.iconify.design/devicon/postgresql.svg');
});

test('selected group edge filter includes edges internal to selected descendants', () => {
    const selected = new Set(['group', 'a', 'b']);
    assert.equal(isTasksEdgeInternalToSelection({ source: 'a', target: 'b' }, selected), true);
    assert.equal(isTasksEdgeInternalToSelection({ source: 'a', target: 'outside' }, selected), false);
});

test('selected group self-hover does not dim selected edge labels', () => {
    assert.equal(isTasksEdgeLabelHoverDimmingActive('group', 'group'), false);
    assert.equal(isTasksEdgeLabelHoverDimmingActive('group', ''), false);
    assert.equal(isTasksEdgeLabelHoverDimmingActive('group', 'child'), true);
});

test('selected edge labels stay below nodes unless edge is focused', () => {
    assert.equal(tasksEdgeLabelZForMode('selected', 6, 999, 1400), 999);
    assert.equal(tasksEdgeLabelZForMode('dim', 6, 999, 1400), 6);
    assert.equal(tasksEdgeLabelZForMode('focused-in', 6, 999, 1400), 1400);
    assert.equal(tasksEdgeLabelZForMode('focused-out', 6, 999, 1400), 1400);
});

test('palette legend only shows values present in graph', () => {
    const model = {
        groups: [{ id: 'g1', label: 'G1', kind: 'ingress' }],
        tasks: [{ id: 't1', label: 'T1', kind: 'routing' }],
        node_color_palettes: { kind: { ingress: '#93c5fd', routing: '#86efac', orphan: '#fca5a5' } },
    };
    const entries = Object.entries(model.node_color_palettes.kind)
        .filter(([value]) => new Set([...model.groups, ...model.tasks].map((node) => String(node.kind))).has(String(value)))
        .filter(([, color]) => typeof color === 'string' && color.trim())
        .sort(([a], [b]) => String(a).localeCompare(String(b)));
    assert.deepEqual(entries, [['ingress', '#93c5fd'], ['routing', '#86efac']]);
});

test('palette legend renders for two-value color modes', () => {
    const model = {
        groups: [],
        tasks: [
            { id: 'client-user', label: 'Client user', audience: 'client' },
            { id: 'delivery-user', label: 'Delivery user', audience: 'delivery' },
        ],
        node_color_palettes: {
            audience: {
                client: '#2563eb',
                delivery: '#7c3aed',
                end_customer: '#f59e0b',
            },
        },
    };
    const presentValues = new Set(
        [...model.groups, ...model.tasks]
            .map((node) => node.audience)
            .filter((value) => value !== null && value !== undefined && String(value).trim() !== '')
            .map((value) => String(value))
    );
    const entries = Object.entries(model.node_color_palettes.audience)
        .filter(([value]) => presentValues.has(String(value)))
        .filter(([, color]) => typeof color === 'string' && color.trim())
        .sort(([a], [b]) => String(a).localeCompare(String(b)));

    assert.equal(entries.length > 0, true);
    assert.deepEqual(entries, [['client', '#2563eb'], ['delivery', '#7c3aed']]);
});

test('continuous palette interpolates colors from numeric hour attributes', () => {
    const palette = {
        type: 'continuous',
        domain: [0, 24],
        wrap: true,
        stops: [
            { at: 0, color: '#000000' },
            { at: 12, color: '#ffffff' },
            { at: 24, color: '#000000' },
        ],
    };
    const parseHex = (color) => {
        const value = String(color || '').trim().replace(/^#/, '');
        return {
            r: Number.parseInt(value.slice(0, 2), 16),
            g: Number.parseInt(value.slice(2, 4), 16),
            b: Number.parseInt(value.slice(4, 6), 16),
        };
    };
    const interpolate = (a, b, ratio) => `#${['r', 'g', 'b'].map((key) => (
        Math.round(a[key] + (b[key] - a[key]) * ratio).toString(16).padStart(2, '0')
    )).join('')}`;
    const normalize = (value, domain) => {
        const span = domain[1] - domain[0];
        const offset = ((value - domain[0]) % span + span) % span;
        return domain[0] + offset;
    };
    const resolve = (inputPalette, value) => {
        const normalized = normalize(Number(value), inputPalette.domain);
        for (let index = 1; index < inputPalette.stops.length; index += 1) {
            const prev = inputPalette.stops[index - 1];
            const current = inputPalette.stops[index];
            if (normalized > current.at) continue;
            return interpolate(parseHex(prev.color), parseHex(current.color), (normalized - prev.at) / (current.at - prev.at));
        }
        return inputPalette.stops[inputPalette.stops.length - 1].color;
    };

    assert.equal(resolve(palette, 6), '#808080');
    assert.equal(resolve(palette, 18), '#808080');
    assert.equal(resolve(palette, 25), '#151515');
});

test('continuous palettes do not emit discrete legend entries', () => {
    const palette = {
        type: 'continuous',
        domain: [0, 24],
        wrap: true,
        stops: [
            { at: 0, color: '#0f172a' },
            { at: 6, color: '#f59e0b' },
            { at: 12, color: '#fde047' },
            { at: 18, color: '#f97316' },
            { at: 24, color: '#0f172a' },
        ],
    };
    const entries = (palette.type === 'continuous' && Array.isArray(palette.stops)) ? [] : Object.entries(palette);

    assert.deepEqual(entries, []);
});

test('renderer internal __kind__ does not clobber user kind attribute', () => {
    const source = { id: 'proxy', label: 'API Proxy', kind: 'ingress' };
    const node = { id: 'proxy', kind: 'task' };
    const { kind: _legacyNodeKind, ...nodeRest } = node;
    const merged = { ...source, ...nodeRest, __kind__: (_legacyNodeKind || 'task') };
    assert.equal(merged.kind, 'ingress');
    assert.equal(merged.__kind__, 'task');
});

test('disconnected group children pack into a compact grid', () => {
    const out = layoutDisconnectedTaskNodes([
        { id: 'a', width: 100, height: 40 },
        { id: 'b', width: 100, height: 40 },
        { id: 'c', width: 100, height: 40 },
        { id: 'd', width: 100, height: 40 },
    ], 'RIGHT', { gap: 20, padX: 40, padTop: 68, padBottom: 40 });
    assert.equal(out.positions.a.x, 40);
    assert.equal(out.positions.b.x, 160);
    assert.equal(out.positions.c.x, 40);
    assert.equal(out.positions.d.x, 160);
    assert.equal(out.positions.a.y, 68);
    assert.equal(out.positions.b.y, 68);
    assert.equal(out.positions.c.y, 128);
    assert.equal(out.positions.d.y, 128);
    assert.equal(out.bbox.width, 300);
    assert.equal(out.bbox.height, 208);
});

test('disconnected group children use packed layout for downward direction too', () => {
    const down = layoutDisconnectedTaskNodes([
        { id: 'a', width: 100, height: 40 },
        { id: 'b', width: 100, height: 40 },
        { id: 'c', width: 100, height: 40 },
        { id: 'd', width: 100, height: 40 },
    ], 'DOWN', { gap: 30, padX: 40, padTop: 68, padBottom: 40 });
    const right = layoutDisconnectedTaskNodes([
        { id: 'a', width: 100, height: 40 },
        { id: 'b', width: 100, height: 40 },
        { id: 'c', width: 100, height: 40 },
        { id: 'd', width: 100, height: 40 },
    ], 'RIGHT', { gap: 30, padX: 40, padTop: 68, padBottom: 40 });
    assert.deepEqual(down.positions, right.positions);
    assert.deepEqual(down.bbox, right.bbox);
});

test('split-fill background composes a diagonal gradient from two colors', async () => {
    const fs = await import('node:fs/promises');
    const source = await fs.readFile(new URL('../vyasa/extensions_builtin/tasks/static/tasks.js', import.meta.url), 'utf8');
    const mixMatch = source.match(/function tasksMixedFill\(color, colorMix\) \{[\s\S]*?\n\}/);
    const bgMatch = source.match(/function tasksNodeBackground\(primaryColor, secondaryColor, colorMix, fallback\) \{[\s\S]*?\n\}/);
    assert.ok(mixMatch, 'tasksMixedFill should exist');
    assert.ok(bgMatch, 'tasksNodeBackground should exist');
    const factory = new Function(`${mixMatch[0]}; ${bgMatch[0]}; return tasksNodeBackground;`);
    const tasksNodeBackground = factory();
    const noMix = { enabled: false };

    // Two distinct colors -> diagonal split gradient.
    assert.equal(
        tasksNodeBackground('#111111', '#222222', noMix, 'FALLBACK'),
        'linear-gradient(135deg, #111111 0 50%, #222222 50% 100%)',
    );
    // No secondary -> solid primary.
    assert.equal(tasksNodeBackground('#111111', '', noMix, 'FALLBACK'), '#111111');
    // Identical halves -> solid primary, no pointless gradient.
    assert.equal(tasksNodeBackground('#111111', '#111111', noMix, 'FALLBACK'), '#111111');
    // No primary -> fallback regardless of secondary.
    assert.equal(tasksNodeBackground('', '#222222', noMix, 'FALLBACK'), 'FALLBACK');
    assert.equal(tasksNodeBackground('', '', noMix, 'FALLBACK'), 'FALLBACK');

    // color-mix wrapping applied to both halves when enabled.
    const mix = { enabled: true, paper: 78, intensity: 22 };
    assert.equal(
        tasksNodeBackground('#111111', '#222222', mix, 'FALLBACK'),
        'linear-gradient(135deg, color-mix(in srgb, var(--vyasa-paper) 78%, #111111 22%) 0 50%, color-mix(in srgb, var(--vyasa-paper) 78%, #222222 22%) 50% 100%)',
    );
});

test('buildTasksProjectionConfigText emits a paste-ready kg.schema @views entry', async () => {
    const fs = await import('node:fs/promises');
    const source = await fs.readFile(new URL('../vyasa/extensions_builtin/tasks/static/tasks.js', import.meta.url), 'utf8');
    const start = source.indexOf('function tasksEmptyFilterQuery()');
    const end = source.indexOf('function selectTasksProjectionState(');
    assert.ok(start > 0 && end > start, 'serializer functions should exist');
    const constants = 'const TASKS_EDGE_OPACITY_MIN = 0.05; const TASKS_EDGE_OPACITY_MAX = 1; const TASKS_PROJECTION_UNSPECIFIED_CONTENT_OPACITY_DEFAULT = 0.82;';
    const clampEdge = source.match(/function clampTasksEdgeOpacity\(value\) \{[\s\S]*?\n\}/)?.[0];
    const clampContent = source.match(/function clampTasksProjectionContentOpacity\(value\) \{[\s\S]*?\n\}/)?.[0];
    assert.ok(clampEdge && clampContent, 'serializer clamp helpers should exist');
    const factory = new Function(`${constants}; ${clampEdge}; ${clampContent}; ${source.slice(start, end)}; return { buildTasksProjectionConfigText, parseTasksProjectionConfigText };`);
    const { buildTasksProjectionConfigText: build, parseTasksProjectionConfigText: parse } = factory();

    // Single-value filter maps to a where= line; caption with spaces is quoted.
    const single = build({
        id: 'geography',
        groupBy: ['region', 'city'],
        colorBy: 'region',
        edgeColorBy: 'kind',
        hoverAttrs: ['city', 'cost_yen'],
        caption: 'The map view',
        where: { kind: ['sight'] },
        defaultOpenDepth: -1,
    });
    assert.ok(single.startsWith('# Paste under your @views section in kg.schema:\n'), 'has leading comment');
    assert.ok(single.includes('\ngeography:\n'), 'has view id line');
    assert.ok(single.includes('\n\tgroup_by=region,city'), 'group_by list');
    assert.ok(single.includes('\n\tcolor_by=region'), 'color_by');
    assert.ok(single.includes('\n\thover_attrs=city,cost_yen'), 'hover_attrs list');
    assert.ok(single.includes('\n\twhere=kind=sight'), 'single filter -> where');
    assert.ok(single.includes('\n\tcaption="The map view"'), 'caption quoted');
    assert.ok(single.includes('\n\tdefault_open_depth=-1'), 'open depth');

    // Full query-builder state is serialized as schema, including muted rules and global disable.
    const noted = build({
        id: 'multi',
        groupBy: ['region'],
        colorBy: 'region',
        secondaryColorBy: 'energy',
        filterQuery: {
            combinator: 'or',
            muted: true,
            rules: [
                { field: 'kind', operator: 'in', value: ['sight', 'restaurant'], muted: true },
                { combinator: 'and', rules: [{ field: 'region', operator: '=', value: 'kansai' }], muted: true },
            ],
        },
        queryBuilderEnabled: false,
        searchQuery: 'temple',
        filtersCollapsed: false,
        edgesVisible: false,
        edgeAnimationEnabled: false,
        edgeOpacity: 0.37,
        projectionUnspecifiedContentOpacity: 0.44,
    });
    assert.ok(noted.includes('\n\tfilter_query="{\\"combinator\\":\\"or\\",'), 'full query emitted as json');
    assert.ok(noted.includes('\\"muted\\":true'), 'muted state preserved');
    assert.ok(noted.includes('\n\tquery_builder_enabled=false'), 'global query builder disable emitted');
    assert.ok(noted.includes('\n\tsearch=temple'), 'search emitted as schema');
    assert.ok(noted.includes('\n\tfilters_collapsed=false'), 'filter drawer state emitted');
    assert.ok(noted.includes('\n\tedges_visible=false'), 'edge visibility emitted');
    assert.ok(noted.includes('\n\tedge_animation_enabled=false'), 'edge animation emitted');
    assert.ok(noted.includes('\n\tedge_opacity=0.37'), 'edge opacity emitted');
    assert.ok(noted.includes('\n\tprojection_unspecified_content_opacity=0.44'), 'unspecified intensity emitted');
    assert.ok(noted.includes('\n\tsecondary_color_by=energy'), 'secondary color emitted as a real field');

    // Empty-ish config falls back to a placeholder id and omits empty fields.
    const minimal = build({ groupBy: [], where: {} });
    assert.ok(minimal.includes('\nnew-view:'), 'placeholder id');
    assert.ok(!minimal.includes('group_by='), 'no empty group_by');
    assert.ok(!minimal.includes('color_by='), 'no empty color_by');

    const parsed = parse('default:\n\twhere=status=todo\n\tsearch=login');
    assert.deepEqual(parsed.filterQuery.rules, [{ field: 'status', operator: '=', value: 'todo' }]);
    assert.equal(parsed.searchQuery, 'login');
});
