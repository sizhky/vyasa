import test from 'node:test';
import assert from 'node:assert/strict';

const { tasksProjectionLayout } = await import('../vyasa/extensions_builtin/tasks/static/tasks_graph_model.js');
const { buildSequenceTasksGraph } = await import('../vyasa/extensions_builtin/tasks/static/tasks_layouts.js');

// Two lanes that talk to each other, one lane that only holds a standing rule.
function fixture() {
    return {
        groups: [
            { id: 'client', label: 'Client' },
            { id: 'rules', label: 'Rules' },
            { id: 'server', label: 'Server' },
        ],
        tasks: [
            { id: 'form', label: 'Form', group_id: 'client' },
            { id: 'request', label: 'Request', group_id: 'client' },
            { id: 'token', label: 'Token', group_id: 'rules' },
            { id: 'handler', label: 'Handler', group_id: 'server' },
            { id: 'reply', label: 'Reply', group_id: 'server' },
        ],
        dependency_edges: [
            { id: 'e1', source: 'form', target: 'request', role: 'message', phase: 'ask' },
            { id: 'e2', source: 'token', target: 'request', role: 'standing', phase: 'ask' },
            { id: 'e3', source: 'request', target: 'handler', role: 'message', phase: 'serve' },
            { id: 'e4', source: 'handler', target: 'reply', role: 'message', phase: 'serve' },
        ],
    };
}

const projection = { sequence_role: 'role', sequence_phase: 'phase' };
const build = (model = fixture()) => buildSequenceTasksGraph(model, projection);
const lifelines = (graph) => graph.nodes
    .filter((node) => node.__sequence_lifeline__)
    .sort((left, right) => left.position.x - right.position.x);
const handleFor = (graph, nodeId, role, handleId) => graph.nodes
    .find((node) => node.id === nodeId)?.handleLayout?.[role]
    ?.find((handle) => handle.id === handleId);

test('every participant is drawn exactly once, as one lane', () => {
    const graph = build();
    const lanes = lifelines(graph);
    assert.deepEqual(lanes.map((lane) => lane.label), ['Form', 'Request', 'Token', 'Handler', 'Reply']);
    assert.equal(new Set(lanes.map((lane) => lane.id)).size, lanes.length);
});

test('lanes are ordered by stage, then by the order nodes are written in that stage', () => {
    const lanes = lifelines(build());
    assert.deepEqual(lanes.map((lane) => lane.__sequence_stage__), ['Client', 'Client', 'Rules', 'Server', 'Server']);
    for (let index = 1; index < lanes.length; index += 1) {
        assert.ok(lanes[index].position.x > lanes[index - 1].position.x);
    }
});

test('a lifeline is one tall node, and it grows with the number of rows', () => {
    const lanes = lifelines(build());
    assert.equal(new Set(lanes.map((lane) => lane.height)).size, 1);
    assert.equal(new Set(lanes.map((lane) => lane.position.y)).size, 1);
    assert.ok(lanes[0].height > lanes[0].width);

    const longer = fixture();
    longer.dependency_edges.push({ id: 'e5', source: 'reply', target: 'form', role: 'message', phase: 'serve' });
    const grown = lifelines(build(longer));
    assert.ok(grown[0].height > lanes[0].height);
    // the extra row must fit inside the taller lifeline
    const last = build(longer).edges.at(-1);
    assert.ok(handleFor(build(longer), last.source, 'source', last.sourceHandle).offsetPct < 100);
});

test('both ends of a row sit at the same height, so the arrow is horizontal', () => {
    const graph = build();
    for (const edge of graph.edges) {
        const source = handleFor(graph, edge.source, 'source', edge.sourceHandle);
        const target = handleFor(graph, edge.target, 'target', edge.targetHandle);
        assert.ok(source && target, `missing handle for ${edge.id}`);
        assert.equal(source.offsetPct, target.offsetPct);
        assert.ok(source.offsetPct >= 0 && source.offsetPct <= 100);
    }
});

test('rows run down the page in the order the edges are declared', () => {
    const graph = build();
    const offsets = graph.edges.map((edge) => handleFor(graph, edge.source, 'source', edge.sourceHandle).offsetPct);
    assert.deepEqual(offsets, [...offsets].sort((a, b) => a - b));
    assert.equal(new Set(offsets).size, offsets.length);
});

test('an arrow leaves the right side going right and the left side going back', () => {
    const graph = build();
    const [forward, backward] = [graph.edges[0], graph.edges[1]];
    assert.equal(handleFor(graph, forward.source, 'source', forward.sourceHandle).side, 'right');
    assert.equal(handleFor(graph, forward.target, 'target', forward.targetHandle).side, 'left');
    assert.equal(handleFor(graph, backward.source, 'source', backward.sourceHandle).side, 'left');
    assert.equal(handleFor(graph, backward.target, 'target', backward.targetHandle).side, 'right');
});

test('a standing edge takes no turn, so it carries no step number', () => {
    const graph = build();
    assert.deepEqual(graph.edges.map((edge) => edge.__sequence_step__), ['1', '', '2', '3']);
    assert.deepEqual(graph.edges.map((edge) => Boolean(edge.__sequence_standing__)), [false, true, false, false]);
});

test('one lifeline takes as many handles as it has rows, with unique ids', () => {
    const graph = build();
    const request = graph.nodes.find((node) => node.id === 'request');
    assert.equal(request.handleLayout.target.length, 2);
    assert.equal(request.handleLayout.source.length, 1);
    const ids = [...request.handleLayout.source, ...request.handleLayout.target].map((handle) => handle.id);
    assert.equal(new Set(ids).size, ids.length);
});

test('phase bands cover consecutive rows that share a phase', () => {
    const bands = build().nodes
        .filter((node) => node.__kind__ === 'sequencePhase')
        .sort((left, right) => left.position.y - right.position.y);
    assert.deepEqual(bands.map((band) => band.label), ['ask', 'serve']);
    assert.ok(bands[0].position.y < bands[1].position.y);
});

test('an ungrouped model still gives one lane per participant', () => {
    const model = fixture();
    for (const task of model.tasks) delete task.group_id;
    model.groups = [];
    const lanes = lifelines(build(model));
    assert.equal(lanes.length, 5);
    assert.deepEqual(lanes.map((lane) => lane.__sequence_stage__), ['', '', '', '', '']);
});

test('every sequence node claims its own box, so auto-sizing leaves it alone', () => {
    // normalizeTasksGraphNodes re-sizes any node that does not claim __fixed_size__.
    // Losing the flag collapses a lifeline to a card and stacks every row at the top.
    const graph = build();
    assert.ok(graph.nodes.length > 0);
    for (const node of graph.nodes) {
        assert.equal(node.__fixed_size__, true, `${node.id} would be auto-sized`);
        assert.ok(Number.isFinite(node.width) && node.width > 0);
        assert.ok(Number.isFinite(node.height) && node.height > 0);
    }
});

test('only a view that declares layout=sequence opens in the sequence layout', () => {
    const model = { view_projections: [{ id: 'phases' }, { id: 'sequence', layout: 'sequence' }] };
    assert.equal(tasksProjectionLayout(model, 'sequence'), 'sequence');
    assert.equal(tasksProjectionLayout(model, 'phases'), '');
    assert.equal(tasksProjectionLayout(model, ''), '');
});

// A call and its reply. `p1` pairs them; `p2` is written only once, so it
// stays an ordinary row and proves an unmatched key is not an error.
function pairFixture() {
    return {
        groups: [{ id: 'client', label: 'Client' }, { id: 'server', label: 'Server' }],
        tasks: [
            { id: 'request', label: 'Request', group_id: 'client' },
            { id: 'handler', label: 'Handler', group_id: 'server' },
        ],
        dependency_edges: [
            { id: 'e1', source: 'request', target: 'handler', role: 'message', phase: 'serve', pair: 'p1' },
            { id: 'e2', source: 'handler', target: 'request', role: 'message', phase: 'serve', pair: 'p1' },
            { id: 'e3', source: 'request', target: 'handler', role: 'message', phase: 'serve', pair: 'p2' },
        ],
    };
}

const pairProjection = { sequence_role: 'role', sequence_phase: 'phase', pair_by: 'pair' };
const buildPaired = (model = pairFixture()) => buildSequenceTasksGraph(model, pairProjection);

test('a call and its reply share one row, so both halves sit at the same height', () => {
    const graph = buildPaired();
    const [call, reply] = graph.edges;
    const callOut = handleFor(graph, 'request', 'source', call.sourceHandle);
    const replyIn = handleFor(graph, 'request', 'target', reply.targetHandle);
    assert.equal(callOut.offsetPct, replyIn.offsetPct);
});

test('a reply takes no step number of its own, because it is not a further step', () => {
    const graph = buildPaired();
    assert.deepEqual(graph.edges.map((edge) => edge.__sequence_step__), ['1', '', '2']);
});

test('both halves take the same lift, because each is offset along its own normal', () => {
    const graph = buildPaired();
    const [call, reply, single] = graph.edges;
    assert.equal(call.__pair_half__, 'call');
    assert.equal(reply.__pair_half__, 'reply');
    // A reply's chord runs the other way, so one signed value lands them on
    // opposite sides of the path they share.
    assert.equal(call.__pair_lift__, reply.__pair_lift__);
    assert.ok(call.__pair_lift__ !== 0);
    // An unmatched pair key draws like any other row.
    assert.equal(single.__pair_half__, '');
    assert.equal(single.__pair_lift__, 0);
});

test('a pair occupies one row, so the rows below it do not skip a slot', () => {
    const graph = buildPaired();
    const [call, , single] = graph.edges;
    const callOut = handleFor(graph, 'request', 'source', call.sourceHandle);
    const singleOut = handleFor(graph, 'request', 'source', single.sourceHandle);
    const rows = buildSequenceTasksGraph(
        { ...pairFixture(), dependency_edges: pairFixture().dependency_edges.slice(0, 1) },
        pairProjection,
    );
    // Two rows for three edges: the reply rides the call's row.
    assert.ok(singleOut.offsetPct > callOut.offsetPct);
    assert.ok(rows.edges.length === 1);
});

test('a reply never opens a phase band, because its call already opened one', () => {
    const bands = buildPaired().nodes.filter((node) => node.__kind__ === 'sequencePhase');
    assert.deepEqual(bands.map((band) => band.label), ['serve']);
});

test('without pair_by a pair attribute means nothing and both rows stand alone', () => {
    const graph = buildSequenceTasksGraph(pairFixture(), projection);
    assert.deepEqual(graph.edges.map((edge) => edge.__sequence_step__), ['1', '2', '3']);
    assert.deepEqual(graph.edges.map((edge) => edge.__pair_lift__), [0, 0, 0]);
});

test('pair_by set on the graph works too, so the base view pairs without a projection', () => {
    const graph = buildSequenceTasksGraph(
        { ...pairFixture(), pair_by: 'pair' },
        { sequence_role: 'role', sequence_phase: 'phase' },
    );
    assert.deepEqual(graph.edges.map((edge) => edge.__pair_half__), ['call', 'reply', '']);
});
