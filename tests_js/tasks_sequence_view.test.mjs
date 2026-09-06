import test from 'node:test';
import assert from 'node:assert/strict';

const { tasksProjectionLayout } = await import('../vyasa/extensions_builtin/tasks/static/tasks_graph_model.js');
const { buildSequenceTasksGraph, tasksSequenceFragmentPath } = await import('../vyasa/extensions_builtin/tasks/static/tasks_layouts.js');

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

// An outer call that stays open while an inner call runs and returns. This is
// the shape a flat step counter cannot express: the inner work is not a further
// step after the outer one, it happens inside it.
function nestedFixture() {
    return {
        tasks: [
            { id: 'route', label: 'Route' },
            { id: 'handler', label: 'Handler' },
            { id: 'store', label: 'Store' },
        ],
        dependency_edges: [
            { id: 'c1', source: 'route', target: 'handler', role: 'call', phase: 'serve', pair: 'outer' },
            { id: 'c2', source: 'handler', target: 'store', role: 'call', phase: 'serve', pair: 'inner' },
            { id: 'r2', source: 'store', target: 'handler', role: 'reply', phase: 'serve', pair: 'inner' },
            { id: 'r1', source: 'handler', target: 'route', role: 'reply', phase: 'serve', pair: 'outer' },
        ],
    };
}

const nestedProjection = { sequence_role: 'role', sequence_phase: 'phase', pair_by: 'pair', sequence_activation: 'true' };
const bars = (graph) => graph.nodes.filter((node) => node.__kind__ === 'sequenceActivation');
const rowOffsets = (graph) => graph.edges.map((edge) => handleFor(graph, edge.source, 'source', edge.sourceHandle).offsetPct);

test('activation is off unless the view asks for it, so every existing view is untouched', () => {
    const graph = buildSequenceTasksGraph(nestedFixture(), { sequence_role: 'role', sequence_phase: 'phase', pair_by: 'pair' });
    const [outerCall, , , outerReply] = rowOffsets(graph);
    assert.equal(bars(graph).length, 0);
    // Without activation the reply rides its call's row, nesting and all.
    assert.equal(outerCall, outerReply);
});

test('a reply that closes over nested rows drops below them, so the frame has height', () => {
    const graph = buildSequenceTasksGraph(nestedFixture(), nestedProjection);
    const [outerCall, innerCall, , outerReply] = rowOffsets(graph);
    assert.ok(outerReply > innerCall, 'the outer reply sits below the nested call');
    assert.ok(innerCall > outerCall);
});

test('a leaf pair still shares one row, because nothing ran inside it', () => {
    const graph = buildSequenceTasksGraph(nestedFixture(), nestedProjection);
    const innerCallOut = handleFor(graph, 'handler', 'source', graph.edges[1].sourceHandle);
    const innerReplyIn = handleFor(graph, 'handler', 'target', graph.edges[2].targetHandle);
    assert.equal(innerCallOut.offsetPct, innerReplyIn.offsetPct);
});

test('only the pair that split rows loses its lift, so a shared row still reads as one exchange', () => {
    const graph = buildSequenceTasksGraph(nestedFixture(), nestedProjection);
    const [outerCall, innerCall, innerReply, outerReply] = graph.edges;
    assert.equal(outerCall.__pair_lift__, 0);
    assert.equal(outerReply.__pair_lift__, 0);
    assert.ok(innerCall.__pair_lift__ !== 0);
    assert.equal(innerCall.__pair_lift__, innerReply.__pair_lift__);
});

test('one bar per nesting call, filling the lane that is executing', () => {
    const graph = buildSequenceTasksGraph(nestedFixture(), nestedProjection);
    const drawn = bars(graph);
    const handler = graph.nodes.find((node) => node.id === 'handler');
    assert.equal(drawn.length, 1);
    // The lane's full width, so an arrow meeting the lane meets the bar's edge.
    assert.equal(drawn[0].position.x, handler.position.x);
    assert.equal(drawn[0].width, handler.width);
    assert.equal(drawn[0].__sequence_lane__, 'handler');
    // The top clears the opening call, so that arrow reads as a row inside the
    // frame. The bottom is flush with the closing reply, which is where UML draws
    // a return leaving an execution and where the frame stops.
    const rowOf = (edge, side) => handleFor(graph, edge[side], side === 'source' ? 'source' : 'target',
        edge[side === 'source' ? 'sourceHandle' : 'targetHandle']).offsetPct;
    const rowY = (edge, side) => handler.position.y + (rowOf(edge, side) / 100) * handler.height;
    assert.ok(rowY(graph.edges[0], 'target') - drawn[0].position.y > 0, 'the bar opens above its call');
    const bottomGap = (drawn[0].position.y + drawn[0].height) - rowY(graph.edges[3], 'source');
    assert.ok(Math.abs(bottomGap) < 0.01, 'and closes flush on its reply');
});

test('a nested reply still takes no step number, so nesting never inflates the count', () => {
    const graph = buildSequenceTasksGraph(nestedFixture(), nestedProjection);
    assert.deepEqual(graph.edges.map((edge) => edge.__sequence_step__), ['1', '2', '', '']);
});

test('a recursive call gets its own bar, offset so the two stay legible', () => {
    const graph = buildSequenceTasksGraph({
        tasks: [{ id: 'route', label: 'Route' }, { id: 'walk', label: 'Walk' }, { id: 'leaf', label: 'Leaf' }],
        dependency_edges: [
            { id: 'c1', source: 'route', target: 'walk', role: 'call', pair: 'a' },
            { id: 'c2', source: 'route', target: 'walk', role: 'call', pair: 'b' },
            { id: 'c3', source: 'walk', target: 'leaf', role: 'call', pair: 'c' },
            { id: 'r3', source: 'leaf', target: 'walk', role: 'reply', pair: 'c' },
            { id: 'r2', source: 'walk', target: 'route', role: 'reply', pair: 'b' },
            { id: 'r1', source: 'walk', target: 'route', role: 'reply', pair: 'a' },
        ],
    }, nestedProjection);
    const drawn = bars(graph);
    const walk = graph.nodes.find((node) => node.id === 'walk');
    assert.equal(drawn.length, 2);
    // The inner frame insets rather than leaving the lane, so both stay visible.
    assert.equal(drawn[0].width, walk.width);
    assert.ok(drawn[1].position.x > drawn[0].position.x);
    assert.ok(drawn[1].width < drawn[0].width);
});

test('a frame carries the step it opens, because its closing reply has no number', () => {
    const graph = buildSequenceTasksGraph(nestedFixture(), nestedProjection);
    assert.deepEqual(bars(graph).map((bar) => bar.label), ['1']);
});

test('a view can state its own lane order, because node order is one global fact', () => {
    const stated = { ...nestedProjection, sequence_lanes: 'store,handler,route' };
    const lanes = (graph) => graph.nodes
        .filter((node) => node.__sequence_lifeline__)
        .sort((left, right) => left.position.x - right.position.x)
        .map((node) => node.id);
    assert.deepEqual(lanes(buildSequenceTasksGraph(nestedFixture(), nestedProjection)), ['route', 'handler', 'store']);
    assert.deepEqual(lanes(buildSequenceTasksGraph(nestedFixture(), stated)), ['store', 'handler', 'route']);
    // Naming one lane moves that lane only; the rest keep the order they had.
    assert.deepEqual(
        lanes(buildSequenceTasksGraph(nestedFixture(), { ...nestedProjection, sequence_lanes: 'store' })),
        ['store', 'route', 'handler'],
    );
});

test('a lane order naming a node the view never draws is reported, not ignored', () => {
    assert.throws(
        () => buildSequenceTasksGraph(nestedFixture(), { ...nestedProjection, sequence_lanes: 'route,cache' }),
        /no lane for sequence_lanes=cache/,
    );
});

// UML combined fragments and message kinds. A fragment is a box over a
// contiguous run of rows; the operator is the text before the colon and nesting
// is a `/` path written outer first.
function fragmentFixture() {
    return {
        groups: [{ id: 'stage', label: 'Stage' }],
        tasks: [
            { id: 'caller', label: 'Caller', group_id: 'stage' },
            { id: 'store', label: 'Store', group_id: 'stage' },
            { id: 'bus', label: 'Bus', group_id: 'stage' },
        ],
        dependency_edges: [
            { id: 'a1', source: 'caller', target: 'store' },
            { id: 'a2', source: 'caller', target: 'store', fragment: 'alt:shape', operand: '[hit]' },
            { id: 'a3', source: 'caller', target: 'store', fragment: 'alt:shape', operand: '[miss]' },
            { id: 'a4', source: 'caller', target: 'bus', fragment: 'alt:shape/loop:retry', operand: '[miss]' },
            { id: 'a5', source: 'caller', target: 'bus', message: 'async' },
        ],
    };
}

const umlProjection = {
    sequence_fragment: 'fragment',
    sequence_operand: 'operand',
    sequence_message: 'message',
};
const frames = (graph) => graph.nodes.filter((node) => node.__kind__ === 'sequenceFragment');
// A row's y in canvas units. Handles carry a percentage of the lifeline, and a
// lifeline spans the whole body, so one lane converts it back.
const edgeY = (graph, edge) => {
    const lane = graph.nodes.find((node) => node.id === edge.source);
    const handle = handleFor(graph, edge.source, 'source', edge.sourceHandle);
    return lane.position.y + (handle.offsetPct / 100) * lane.height;
};

test('a fragment is drawn only for the contiguous rows that name it', () => {
    const graph = buildSequenceTasksGraph(fragmentFixture(), umlProjection);
    const [alt, loop] = frames(graph);
    assert.equal(alt.__sequence_fragment_op__, 'alt');
    assert.equal(alt.name, 'shape');
    assert.equal(alt.label, 'alt · shape');
    assert.equal(loop.__sequence_fragment_op__, 'loop');
    // Rows a2..a4 are inside; a1 and a5 are not.
    const y = (index) => edgeY(graph, graph.edges[index]);
    const inside = (box, value) => value > box.position.y && value < box.position.y + box.height;
    assert.ok(!inside(alt, y(0)), 'the row before the fragment stays outside');
    assert.ok(inside(alt, y(1)) && inside(alt, y(2)) && inside(alt, y(3)));
    assert.ok(!inside(alt, y(4)), 'the row after it stays outside');
});

test('a nested fragment sits inside its parent on all four sides', () => {
    const [alt, loop] = frames(buildSequenceTasksGraph(fragmentFixture(), umlProjection));
    assert.ok(loop.position.x > alt.position.x);
    assert.ok(loop.position.x + loop.width < alt.position.x + alt.width);
    assert.ok(loop.position.y > alt.position.y);
    assert.ok(loop.position.y + loop.height < alt.position.y + alt.height);
    assert.ok(loop.__z__ > alt.__z__, 'the inner frame paints over its parent');
});

test('a guard that changes inside one fragment starts the next operand', () => {
    const graph = buildSequenceTasksGraph(fragmentFixture(), umlProjection);
    const [alt] = frames(graph);
    const [first, second] = alt.__sequence_operands__;
    assert.deepEqual([first.guard, second.guard], ['[hit]', '[miss]']);
    // The first operand needs no rule: the box's own top edge is its boundary.
    assert.equal(first.rule, -1);
    assert.equal(first.top, 0, 'its guard shares the line the box opened on');
    const y = (index) => edgeY(graph, graph.edges[index]) - alt.position.y;
    assert.ok(second.rule > y(1) && second.rule < y(2), 'the next rule falls between the operands');
    assert.ok(second.top >= second.rule, 'and its guard sits under that rule');
});

test('a row that opens fragments is taller, so every tag gets a line of its own', () => {
    const graph = buildSequenceTasksGraph(fragmentFixture(), umlProjection);
    const [alt, loop] = frames(graph);
    const gap = (from, to) => edgeY(graph, graph.edges[to]) - edgeY(graph, graph.edges[from]);
    // a1 -> a2 opens the alt; a3 -> a4 opens the loop; a4 -> a5 opens nothing.
    assert.ok(gap(0, 1) > gap(3, 4), 'a row that opens a box makes room for its header');
    assert.ok(gap(2, 3) > gap(3, 4));
    // The child's header sits below the parent's, never on it.
    assert.ok(loop.position.y > alt.position.y);
});

test('a nested fragment never repeats its parent operand guard', () => {
    const [alt, loop] = frames(buildSequenceTasksGraph(fragmentFixture(), umlProjection));
    // The loop sits inside the alt's `[miss]` operand. Printing that guard again
    // on the loop stacked the same text once per level.
    assert.deepEqual(alt.__sequence_operands__.map((operand) => operand.guard), ['[hit]', '[miss]']);
    assert.deepEqual(loop.__sequence_operands__.map((operand) => operand.guard), ['']);
});

test('a fragment carries its nesting depth, so its corner tag can clear its parent', () => {
    const [alt, loop] = frames(buildSequenceTasksGraph(fragmentFixture(), umlProjection));
    assert.equal(alt.__sequence_fragment_depth__, 0);
    assert.equal(loop.__sequence_fragment_depth__, 1);
});

test('a fragment covers only the lanes its own rows touch', () => {
    const [, loop] = frames(buildSequenceTasksGraph(fragmentFixture(), umlProjection));
    const lanes = lifelines(buildSequenceTasksGraph(fragmentFixture(), umlProjection));
    const bus = lanes.find((lane) => lane.id === 'bus');
    assert.ok(loop.position.x + loop.width > bus.position.x, 'it reaches the lane it talks to');
});

test('a view that names no fragment attribute draws no frames at all', () => {
    const graph = buildSequenceTasksGraph(fragmentFixture(), { sequence_message: 'message' });
    assert.equal(frames(graph).length, 0);
});

test('UML message rendering is opt-in, and it carries the declared kind', () => {
    const plain = buildSequenceTasksGraph(fragmentFixture(), {});
    assert.ok(plain.edges.every((edge) => edge.__sequence_uml__ === false));
    const uml = buildSequenceTasksGraph(fragmentFixture(), umlProjection);
    assert.ok(uml.edges.every((edge) => edge.__sequence_uml__ === true));
    assert.deepEqual(uml.edges.map((edge) => edge.__sequence_message__), ['', '', '', '', 'async']);
});

test('an operator with no name still parses, so a single loop needs no id', () => {
    assert.deepEqual(
        tasksSequenceFragmentPath('alt:auth/loop'),
        [
            { key: 'alt:auth', operator: 'alt', name: 'auth' },
            { key: 'loop:', operator: 'loop', name: '' },
        ],
    );
});

test('a fragment paints over the bars it covers, so its corner tag stays readable', () => {
    const model = {
        groups: [{ id: 'stage', label: 'Stage' }],
        tasks: [
            { id: 'caller', label: 'Caller', group_id: 'stage' },
            { id: 'store', label: 'Store', group_id: 'stage' },
            { id: 'bus', label: 'Bus', group_id: 'stage' },
        ],
        dependency_edges: [
            { id: 'b1', source: 'caller', target: 'store', pair: 'p1' },
            { id: 'b2', source: 'store', target: 'bus', pair: 'p2', fragment: 'loop:retry' },
            { id: 'b3', source: 'bus', target: 'store', pair: 'p2', fragment: 'loop:retry' },
            { id: 'b4', source: 'store', target: 'caller', pair: 'p1' },
        ],
    };
    const graph = buildSequenceTasksGraph(model, {
        ...umlProjection,
        pair_by: 'pair',
        sequence_activation: 'true',
    });
    const [frame] = frames(graph);
    const [bar] = graph.nodes.filter((node) => node.__kind__ === 'sequenceActivation');
    assert.ok(frame && bar, 'the fixture draws both');
    assert.ok(frame.__z__ > bar.__z__);
});

test('a fragment carries plain attributes, so the ordinary node card can show it', () => {
    const [alt] = frames(buildSequenceTasksGraph(fragmentFixture(), umlProjection));
    assert.equal(alt.operator, 'alt');
    assert.equal(alt.name, 'shape');
    assert.equal(alt.operand_1, '[hit]');
    assert.equal(alt.operand_2, '[miss]');
    assert.match(alt.description, /Exactly one operand runs/);
    // Every key the card reads is a plain one; the internals stay behind `__`.
    assert.ok(Object.keys(alt).some((key) => key === 'operator' && !key.startsWith('__')));
});

test('a fragment answers the pointer on its corner tag only', () => {
    const [alt] = frames(buildSequenceTasksGraph(fragmentFixture(), umlProjection));
    // A full-area hit rect would shadow every lifeline and arrow inside the box.
    assert.ok(alt.__hit_rect__.width < alt.width / 2);
    assert.ok(alt.__hit_rect__.height < alt.height);
    assert.deepEqual([alt.__hit_rect__.dx, alt.__hit_rect__.dy], [0, 0]);
});

test('a fragment names the steps it covers, so the card ties back to the numbers', () => {
    const [alt, loop] = frames(buildSequenceTasksGraph(fragmentFixture(), umlProjection));
    assert.equal(alt.steps, '2 to 4');
    assert.equal(loop.steps, '4');
});

const { tasksGraphNodeAbsoluteRect, tasksGraphNodeHitRect, tasksGraphPaint,
    tasksGraphCornerPath, isTasksGraphNodeSelectable, tasksGraphNodeHitArea,
} = await import('../vyasa/extensions_builtin/tasks/static/tasks_graph_core.js');

test('fragment hit bounds do not shrink its focus outline, including inside a parent', () => {
    const [frame] = frames(buildSequenceTasksGraph(fragmentFixture(), umlProjection));
    const node = { ...frame, data: frame, parentId: 'parent' };
    const byId = { parent: { position: { x: 50, y: 100 } } };
    const visual = tasksGraphNodeAbsoluteRect(node, byId);
    const hit = tasksGraphNodeHitRect(node, byId);
    assert.equal(visual.width, frame.width);
    assert.equal(visual.height, frame.height);
    assert.equal(hit.width, frame.__hit_rect__.width);
    assert.equal(hit.height, frame.__hit_rect__.height);
    assert.equal(hit.x, frame.position.x + 50);
    assert.equal(hit.y, frame.position.y + 100);
    assert.ok(hit.width < visual.width);
});

test('focus preserves authored layers and does not fill a frame wrapper', () => {
    const [frame] = frames(buildSequenceTasksGraph(fragmentFixture(), umlProjection));
    for (const boost of [260, 520]) {
        const lane = tasksGraphPaint({ data: { __z__: 1000 }, zIndex: 1000 + boost,
            style: { zIndex: 1000 + boost, background: 'blue', boxShadow: '0 0 12px blue' } });
        const focused = tasksGraphPaint({ data: frame, zIndex: frame.__z__ + boost, style: lane.style });
        assert.ok(lane.zIndex < focused.zIndex);
        assert.equal(focused.style.background, 'transparent');
        assert.equal(focused.style.boxShadow, 'none');
        assert.equal(focused.zIndex, frame.__z__);
    }
    const freeNode = { data: { __kind__: 'task' }, zIndex: 1520 };
    assert.equal(tasksGraphPaint(freeNode), freeNode);
});

test('activation cards own their call, reply, and full hit bounds', () => {
    const graph = buildSequenceTasksGraph(nestedFixture(), nestedProjection);
    const [bar] = bars(graph);
    assert.ok(isTasksGraphNodeSelectable(bar.__kind__));
    assert.equal(tasksGraphNodeHitArea(bar.__kind__), 'selectable');
    assert.equal(bar.call, nestedFixture().dependency_edges[0].id);
    assert.equal(bar.reply, nestedFixture().dependency_edges[3].id);
    const hit = tasksGraphNodeHitRect({ ...bar, data: bar }, {});
    assert.equal(hit.width, bar.width);
    assert.equal(hit.height, bar.height);
});

test('the operator border includes the diagonal in one closed path', () => {
    assert.equal(tasksGraphCornerPath(50, 20), 'M 6 0 H 50 V 10 L 40 20 H 0 V 6 Q 0 0 6 0 Z');
});


test('focused arrows keep their authored order above frames', () => {
    const edge = tasksGraphPaint({ source: 'caller', target: 'callee',
        data: { __z__: 1010 }, zIndex: 998, style: { stroke: 'blue', strokeWidth: 3 } });
    assert.equal(edge.zIndex, 1010);
    assert.equal(edge.style.stroke, 'blue');
    assert.equal(edge.style.strokeWidth, 3);
    assert.equal(edge.style.background, undefined);
});

test('a bar card names what its two arrows say, not the ids they carry', () => {
    const model = nestedFixture();
    model.dependency_edges.forEach((edge, index) => { edge.note = `note ${index}`; });
    const graph = buildSequenceTasksGraph(model, { ...nestedProjection, edge_label_from: 'note' });
    const [bar] = graph.nodes.filter((node) => node.__kind__ === 'sequenceActivation');
    assert.equal(bar.call, 'note 0');
    assert.equal(bar.reply, 'note 3');
    assert.equal(bar.lane, 'Handler', 'the lane reads as its cap, not its id');
});

test('a bar falls back to the edge id when the pack names no label attribute', () => {
    const graph = buildSequenceTasksGraph(nestedFixture(), nestedProjection);
    const [bar] = graph.nodes.filter((node) => node.__kind__ === 'sequenceActivation');
    assert.equal(bar.call, 'c1');
    assert.equal(bar.reply, 'r1');
});

test('a fragment card names the participants its box claims, by their lane caps', () => {
    const [alt] = frames(buildSequenceTasksGraph(fragmentFixture(), umlProjection));
    // Rows a2..a4 reach Caller, Store and Bus, and the card says so in the words
    // the lane caps use rather than in node ids.
    assert.equal(alt.covers, 'Caller, Store, Bus');
});

test('an operand carries the sentence saying what that branch does, beside its guard', () => {
    const model = fragmentFixture();
    model.dependency_edges[1].operand_note = 'the cached copy still matches';
    // The note may sit on any row of its operand, not only the first.
    model.dependency_edges[3].operand_note = 'the copy is stale, so it is fetched again';
    const [alt] = frames(buildSequenceTasksGraph(model, { ...umlProjection, sequence_operand_note: 'operand_note' }));
    assert.equal(alt.operand_1, '[hit] — the cached copy still matches');
    assert.equal(alt.operand_2, '[miss] — the copy is stale, so it is fetched again');
});

test('an operand with no note is still its guard, so the note stays optional', () => {
    const [alt] = frames(buildSequenceTasksGraph(fragmentFixture(), umlProjection));
    assert.equal(alt.operand_1, '[hit]');
    assert.equal(alt.operand_2, '[miss]');
});

test('a nested box repeats neither its parent guard nor its parent note', () => {
    const model = fragmentFixture();
    model.dependency_edges[3].operand_note = 'the copy is stale';
    const [, loop] = frames(buildSequenceTasksGraph(model, { ...umlProjection, sequence_operand_note: 'operand_note' }));
    assert.equal(loop.operand_1, undefined);
});

test('a detached reply keeps its line low, but its label returns to its call', () => {
    const graph = buildSequenceTasksGraph(nestedFixture(), nestedProjection);
    const [outerCall, innerCall, innerReply, outerReply] = graph.edges;
    const handler = graph.nodes.find((node) => node.id === 'handler');
    const y = (edge, side) => handler.position.y
        + (handleFor(graph, edge[side], side, edge[`${side}Handle`]).offsetPct / 100) * handler.height;
    // The line stays where the frame needs it, below every nested row.
    assert.ok(y(outerReply, 'source') > y(innerCall, 'target'));
    // The label shifts back by exactly the gap between the two rows, so the pair
    // reads as one exchange the way a reply sharing its call's row does.
    const anchored = y(outerReply, 'source') + outerReply.__sequence_label_dy__;
    assert.ok(Math.abs(anchored - y(outerCall, 'target')) < 0.01);
    // Nothing else is offset: a pair on one row already has its labels together.
    assert.equal(outerCall.__sequence_label_dy__, 0);
    assert.equal(innerCall.__sequence_label_dy__, 0);
    assert.equal(innerReply.__sequence_label_dy__, 0);
});

test('a bar names every edge its lane touches while the frame is open', () => {
    const graph = buildSequenceTasksGraph(nestedFixture(), nestedProjection);
    const [bar] = graph.nodes.filter((node) => node.__kind__ === 'sequenceActivation');
    const [outerCall, innerCall, innerReply, outerReply] = graph.edges;
    // Chrome is never an edge endpoint, so the hover pass reads this list instead
    // of comparing ids against the bar. The bounding pair alone lit one side of
    // the bar and dimmed the calls the frame exists to contain.
    assert.deepEqual(bar.__edge_ids__, [outerCall, innerCall, innerReply, outerReply].map((edge) => edge.id));
});

test('a bar claims no edge that misses its lane, so a nested frame stays its own', () => {
    const model = nestedFixture();
    model.tasks.push({ id: 'aside', label: 'Aside' });
    // A call between two other lanes, drawn while the outer frame is open.
    model.dependency_edges.splice(2, 0, { id: 'x1', source: 'store', target: 'aside', role: 'call', phase: 'serve' });
    const graph = buildSequenceTasksGraph(model, nestedProjection);
    const [bar] = graph.nodes.filter((node) => node.__kind__ === 'sequenceActivation');
    const aside = graph.edges.find((edge) => edge.target === 'aside');
    assert.ok(!bar.__edge_ids__.includes(aside.id));
});

test('a fragment names every edge drawn inside it', () => {
    const graph = buildSequenceTasksGraph(fragmentFixture(), umlProjection);
    const [alt, loop] = frames(graph);
    assert.deepEqual(alt.__edge_ids__, graph.edges.slice(1, 4).map((edge) => edge.id));
    assert.deepEqual(loop.__edge_ids__, [graph.edges[3].id]);
});

test('a closing reply takes a gap rather than a row, so its bar stops near the work', () => {
    const graph = buildSequenceTasksGraph(nestedFixture(), nestedProjection);
    const handler = graph.nodes.find((node) => node.id === 'handler');
    const y = (edge, side) => handler.position.y
        + (handleFor(graph, edge[side], side, edge[`${side}Handle`]).offsetPct / 100) * handler.height;
    const [, innerCall, , outerReply] = graph.edges;
    const [bar] = graph.nodes.filter((node) => node.__kind__ === 'sequenceActivation');
    const gap = y(outerReply, 'source') - y(innerCall, 'target');
    assert.ok(gap > 0 && gap < 46, 'the bare row sits closer than a full row');
    // The reply draws no line, so the bar's bottom border is measured against the
    // last arrow the reader can see. It has to clear that arrow by the same margin
    // the top clears the opening call, or the bar looks bottom-heavy.
    const topPad = y(graph.edges[0], 'target') - bar.position.y;
    const bottomPad = (bar.position.y + bar.height) - y(innerCall, 'target');
    assert.ok(topPad > 0);
    assert.ok(Math.abs(topPad - bottomPad) < 0.01, 'both margins clear a drawn arrow equally');
});

test('a reply whose label moved back to its call draws no line of its own', () => {
    const graph = buildSequenceTasksGraph(nestedFixture(), nestedProjection);
    const [outerCall, innerCall, innerReply, outerReply] = graph.edges;
    // The frame's own bottom border already marks where the reply leaves, which
    // is what UML draws, so a second line under it stated the same fact twice.
    assert.equal(outerReply.__sequence_line_off__, true);
    assert.ok(outerReply.__sequence_label_dy__ < 0, 'and its label sits back at the call');
    for (const edge of [outerCall, innerCall, innerReply]) {
        assert.equal(edge.__sequence_line_off__, false, 'every other row still draws');
    }
});
