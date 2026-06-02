import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = { innerWidth: 1000, innerHeight: 800 };

const { applyTasksFilterAttributePolicy, buildTaskEdgeAnchors, clampScale, isTasksGraphNodeSelectable, isTasksUnspecifiedProjectionGroup, layoutDisconnectedTaskNodes, nextWheelState, selectTasksGraphNodeIdsInRect, sizeTaskNode, tasksGraphNodeHitArea, tasksGraphStatsLabel, tasksProjectionGroupByHierarchy, toggleMultiValueFilter } = await import('../vyasa/extensions_builtin/tasks/static/tasks_graph_core.js');

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

test('task and collapsed group nodes are selectable in items graph', () => {
    assert.equal(isTasksGraphNodeSelectable('task'), true);
    assert.equal(isTasksGraphNodeSelectable('group', false), true);
    assert.equal(isTasksGraphNodeSelectable('group', true), false);
    assert.equal(isTasksGraphNodeSelectable('groupTitle'), false);
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

test('group panels use passive hit areas in items graph', () => {
    assert.equal(tasksGraphNodeHitArea('task'), 'selectable');
    assert.equal(tasksGraphNodeHitArea('group', false), 'selectable');
    assert.equal(tasksGraphNodeHitArea('group', true), 'background');
    assert.equal(tasksGraphNodeHitArea('groupTitle'), 'control');
});

test('note special filter uses derived yes/no value', async () => {
    const fs = await import('node:fs/promises');
    const source = await fs.readFile(new URL('../vyasa/extensions_builtin/tasks/static/tasks.js', import.meta.url), 'utf8');
    const match = source.match(/function tasksNodeMatchesFilters\(node, filters\) \{[\s\S]*?\n\}/);
    assert.ok(match, 'tasksNodeMatchesFilters should exist');
    const factory = new Function('TASKS_HAS_NOTE_ATTR', `${match[0]}; return tasksNodeMatchesFilters;`);
    const tasksNodeMatchesFilters = factory('has_note');
    assert.equal(tasksNodeMatchesFilters({ __has_note__: true }, { has_note: ['yes'] }), true);
    assert.equal(tasksNodeMatchesFilters({ __has_note__: true }, { has_note: ['no'] }), false);
    assert.equal(tasksNodeMatchesFilters({ __has_note__: false }, { has_note: ['no'] }), true);
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
