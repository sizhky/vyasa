import test from 'node:test';
import assert from 'node:assert/strict';

const {
    TASKS_LAYOUTS,
    buildLayeredTasksGraph,
    buildMatrixTasksGraph,
    buildSequenceTasksGraph,
    tasksLayoutById,
    tasksLayoutChromeKinds,
} = await import('../vyasa/extensions_builtin/tasks/static/tasks_layouts.js');

// Two rungs, one aside value, and one edge that runs back up the ladder.
function fixture() {
    return {
        tasks: [
            { id: 'route', label: 'Route', layer: 'surface' },
            { id: 'shell', label: 'Shell', layer: 'surface' },
            { id: 'render', label: 'Render', layer: 'pipeline' },
            { id: 'rules', label: 'Rules', layer: 'configuration' },
        ],
        dependency_edges: [
            { id: 'e1', source: 'route', target: 'render', flow: 'page' },
            { id: 'e2', source: 'render', target: 'shell', flow: 'page' },
            { id: 'e3', source: 'rules', target: 'render', flow: 'shared' },
        ],
    };
}

const LAYERED_VIEW = {
    layout: 'layered',
    layered_tier: 'layer',
    layered_order: 'surface,pipeline',
    layered_aside: 'configuration',
};

const MATRIX_VIEW = { layout: 'matrix', matrix_col: 'layer', matrix_row: 'flow' };

const chromeOf = (layoutId) => new Set(tasksLayoutById(layoutId).chromeKinds);
const placementsOf = (graph, layoutId) => graph.nodes.filter((node) => !chromeOf(layoutId).has(node.__kind__));

test('registry: every layout declares the same contract', () => {
    for (const [id, layout] of Object.entries(TASKS_LAYOUTS)) {
        assert.equal(layout.id, id);
        assert.equal(typeof layout.build, 'function');
        assert.ok(Array.isArray(layout.keys) && layout.keys.length);
        assert.ok(Array.isArray(layout.chromeKinds) && layout.chromeKinds.length);
        assert.equal(typeof layout.authoredHandles, 'boolean');
        assert.equal(typeof layout.edgesOverNodes, 'boolean');
    }
});

test('registry: only sequence draws its arrows over the nodes', () => {
    // A lifeline stands between the two ends of most sequence rows, so an arrow
    // behind the nodes would be invisible. Everywhere else the cards are the
    // picture and an arrow in front of them is noise.
    const lifted = Object.values(TASKS_LAYOUTS).filter((layout) => layout.edgesOverNodes);
    assert.deepEqual(lifted.map((layout) => layout.id), ['sequence']);
});

test('registry: chrome kinds are derived, never hand-listed', () => {
    const kinds = tasksLayoutChromeKinds();
    for (const layout of Object.values(TASKS_LAYOUTS)) {
        for (const kind of layout.chromeKinds) assert.ok(kinds.has(kind), `${kind} missing`);
    }
    assert.equal(kinds.size, Object.values(TASKS_LAYOUTS).flatMap((l) => l.chromeKinds).length);
});

test('registry: an unknown layout id resolves to nothing', () => {
    assert.equal(tasksLayoutById('gantt'), null);
    assert.equal(tasksLayoutById(''), null);
    assert.equal(tasksLayoutById('SEQUENCE').id, 'sequence');
});

test('layered: a node is placed exactly once', () => {
    const graph = buildLayeredTasksGraph(fixture(), LAYERED_VIEW);
    const placements = placementsOf(graph, 'layered');
    assert.equal(placements.length, 4);
    assert.equal(new Set(placements.map((node) => node.id)).size, 4);
});

test('layered: y comes from the tier and nothing else', () => {
    const graph = buildLayeredTasksGraph(fixture(), LAYERED_VIEW);
    const y = Object.fromEntries(placementsOf(graph, 'layered').map((node) => [node.id, node.position.y]));
    assert.equal(y.route, y.shell, 'same rung must share one y');
    assert.ok(y.render > y.route, 'pipeline sits below surface');
});

test('layered: an edge running back up the ladder points up', () => {
    const graph = buildLayeredTasksGraph(fixture(), LAYERED_VIEW);
    const y = Object.fromEntries(placementsOf(graph, 'layered').map((node) => [node.id, node.position.y]));
    // e2 render -> shell is the answer coming back, so its target sits higher.
    assert.ok(y.shell < y.render);
    assert.equal(graph.edges.length, 3, 'every edge survives the layout');
});

test('layered: an aside value leaves the ladder', () => {
    const graph = buildLayeredTasksGraph(fixture(), LAYERED_VIEW);
    const placed = Object.fromEntries(placementsOf(graph, 'layered').map((node) => [node.id, node.position.x]));
    assert.ok(placed.rules > placed.route, 'the aside band sits beside the rungs');
    assert.ok(graph.nodes.some((node) => node.__layered_aside__), 'the aside band draws its own chrome');
});

test('layered: a tier value with no band is named, not dropped', () => {
    const model = fixture();
    model.tasks.push({ id: 'stray', label: 'Stray', layer: 'nowhere' });
    assert.throws(() => buildLayeredTasksGraph(model, LAYERED_VIEW), /no band for layer=nowhere/);
});

test('layered: a missing key is named', () => {
    assert.throws(() => buildLayeredTasksGraph(fixture(), { layout: 'layered' }), /needs layered_tier/);
});

test('matrix: a node touched by two flows is drawn twice', () => {
    const graph = buildMatrixTasksGraph(fixture(), MATRIX_VIEW);
    const placements = placementsOf(graph, 'matrix');
    const logical = new Set(placements.map((node) => node.__source_node_id));
    // `render` sits in both the page row and the shared row.
    assert.ok(placements.length > logical.size);
    assert.equal(placements.filter((node) => node.__source_node_id === 'render').length, 2);
});

test('matrix: every placement names its logical node', () => {
    const graph = buildMatrixTasksGraph(fixture(), MATRIX_VIEW);
    for (const node of placementsOf(graph, 'matrix')) {
        assert.ok(node.__source_node_id, `${node.id} has no __source_node_id`);
        assert.notEqual(node.id, node.__source_node_id, 'a placement id must not collide with the node id');
    }
});

test('matrix: no arrows, because the cell is the adjacency', () => {
    assert.deepEqual(buildMatrixTasksGraph(fixture(), MATRIX_VIEW).edges, []);
});

test('matrix: an empty cell is drawn and flagged', () => {
    const graph = buildMatrixTasksGraph(fixture(), MATRIX_VIEW);
    const cells = graph.nodes.filter((node) => node.__kind__ === 'matrixCell');
    // 3 layers x 2 flows, every cell present whether or not it holds anything.
    assert.equal(cells.length, 6);
    assert.ok(cells.some((cell) => cell.__matrix_empty__), 'an empty cell must still render');
});

test('matrix: nothing overlaps, and a full cell grows its row', () => {
    const model = fixture();
    for (let i = 0; i < 6; i += 1) {
        model.tasks.push({ id: `n${i}`, label: `N${i}`, layer: 'surface' });
        model.dependency_edges.push({ id: `x${i}`, source: `n${i}`, target: 'render', flow: 'page' });
    }
    const graph = buildMatrixTasksGraph(model, MATRIX_VIEW);
    const placements = placementsOf(graph, 'matrix');
    for (let i = 0; i < placements.length; i += 1) {
        for (let j = i + 1; j < placements.length; j += 1) {
            const a = placements[i];
            const b = placements[j];
            const hit = a.position.x < b.position.x + b.width && b.position.x < a.position.x + a.width
                && a.position.y < b.position.y + b.height && b.position.y < a.position.y + a.height;
            assert.ok(!hit, `${a.id} overlaps ${b.id}`);
        }
    }
    const surfacePage = placements.filter((node) => node.id.endsWith('_0'));
    const cell = graph.nodes.find((node) => node.id === '__matrix_cell_0_0');
    const tallest = Math.max(...surfacePage.map((node) => node.position.y + node.height));
    assert.ok(tallest <= cell.position.y + cell.height, 'the row must grow to hold its fullest cell');
});

test('matrix: a missing key is named', () => {
    assert.throws(() => buildMatrixTasksGraph(fixture(), { layout: 'matrix', matrix_col: 'layer' }), /needs matrix_row/);
});

const LONG_LABEL = 'Knowledge graph pack and then a good deal more words than fit on one line';

test('layered: a node is as tall as its label needs', () => {
    const short = buildLayeredTasksGraph(fixture(), LAYERED_VIEW);
    const model = fixture();
    model.tasks.find((task) => task.id === 'render').label = LONG_LABEL;
    const long = buildLayeredTasksGraph(model, LAYERED_VIEW);
    const heightOf = (graph) => placementsOf(graph, 'layered').find((node) => node.id === 'render').height;
    assert.ok(heightOf(long) > heightOf(short), 'a long label must not be clipped');
});

test('layered: a long label pushes the rungs below it down', () => {
    const model = fixture();
    model.tasks.find((task) => task.id === 'route').label = LONG_LABEL;
    const graph = buildLayeredTasksGraph(model, LAYERED_VIEW);
    const placements = placementsOf(graph, 'layered');
    const route = placements.find((node) => node.id === 'route');
    const render = placements.find((node) => node.id === 'render');
    assert.ok(render.position.y >= route.position.y + route.height, 'the next rung must clear the tall one');
});

test('layered: every node stays inside its own band', () => {
    const model = fixture();
    model.tasks.find((task) => task.id === 'route').label = LONG_LABEL;
    const graph = buildLayeredTasksGraph(model, LAYERED_VIEW);
    const bands = graph.nodes.filter((node) => node.__kind__ === 'layeredBand' && !node.__layered_aside__);
    for (const node of placementsOf(graph, 'layered')) {
        if (node.layer === 'configuration') continue; // the aside band is its own column
        const band = bands.find((b) => node.position.y >= b.position.y
            && node.position.y + node.height <= b.position.y + b.height);
        assert.ok(band, `${node.id} escapes every band`);
    }
});

test('matrix: a chip is as tall as its label, and its cell grows to hold it', () => {
    const model = fixture();
    model.tasks.find((task) => task.id === 'render').label = LONG_LABEL;
    const graph = buildMatrixTasksGraph(model, MATRIX_VIEW);
    const chips = placementsOf(graph, 'matrix').filter((node) => node.__source_node_id === 'render');
    assert.ok(chips.length);
    for (const chip of chips) {
        assert.ok(chip.height > 26, 'a wrapped label needs more than one line');
        // Cells in one column share an x range, so the y range has to pin the row.
        const cell = graph.nodes.find((node) => node.__kind__ === 'matrixCell'
            && chip.position.x >= node.position.x
            && chip.position.x + chip.width <= node.position.x + node.width
            && chip.position.y >= node.position.y
            && chip.position.y < node.position.y + node.height);
        assert.ok(cell, `${chip.id} sits in no cell`);
        assert.ok(chip.position.y + chip.height <= cell.position.y + cell.height, 'a chip must not spill out of its cell');
    }
});

test('sequence: the first row clears the deepest lifeline cap', () => {
    const model = {
        tasks: [
            { id: 'a', label: LONG_LABEL, layer: 'surface' },
            { id: 'b', label: 'B', layer: 'surface' },
        ],
        dependency_edges: [{ id: 'e1', source: 'a', target: 'b', role: 'message' }],
    };
    const view = { layout: 'sequence', sequence_role: 'role' };
    const graph = buildSequenceTasksGraph(model, view);
    const lifeline = graph.nodes.find((node) => node.__sequence_lifeline__);
    const firstOffset = Math.min(...lifeline.handleLayout.source.concat(lifeline.handleLayout.target)
        .map((handle) => handle.offsetPct));
    const capShare = (72 / lifeline.height) * 100; // a three-line cap, roughly
    assert.ok(firstOffset > capShare, 'row one must start below the cap, not behind it');
});
