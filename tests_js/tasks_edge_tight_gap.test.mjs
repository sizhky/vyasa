import test from 'node:test';
import assert from 'node:assert/strict';

const { TASKS_TIGHT_GAP, buildTaskEdgeAnchors } = await import('../vyasa/extensions_builtin/tasks/static/tasks_graph_core.js');

const node = (id, x, y, width = 160, height = 60) => ({ id, position: { x, y }, width, height });

// Resolve the side each end of an edge was given.
function sidesOf(nodes, edges) {
    const { edges: anchored, nodeHandles } = buildTaskEdgeAnchors(nodes, edges);
    const side = {};
    for (const handles of Object.values(nodeHandles)) {
        for (const role of ['source', 'target']) {
            for (const handle of handles[role]) side[handle.id] = handle.side;
        }
    }
    return anchored.map((edge) => [side[edge.sourceHandle], side[edge.targetHandle]]);
}

test('side by side with no room: left to right arcs over the top', () => {
    const nodes = [node('a', 0, 0), node('b', 186, 0)]; // 26px of clear space
    const [[source, target]] = sidesOf(nodes, [{ id: 'e', source: 'a', target: 'b' }]);
    assert.equal(source, 'top');
    assert.equal(target, 'top');
});

test('side by side with no room: right to left arcs under', () => {
    const nodes = [node('a', 0, 0), node('b', 186, 0)];
    const [[source, target]] = sidesOf(nodes, [{ id: 'e', source: 'b', target: 'a' }]);
    assert.equal(source, 'bottom');
    assert.equal(target, 'bottom');
});

test('a pair and its answer take opposite arcs, so they never overlap', () => {
    const nodes = [node('a', 0, 0), node('b', 186, 0)];
    const sides = sidesOf(nodes, [
        { id: 'ask', source: 'a', target: 'b' },
        { id: 'answer', source: 'b', target: 'a' },
    ]);
    assert.deepEqual(sides, [['top', 'top'], ['bottom', 'bottom']]);
});

test('stacked with no room: top to bottom arcs out to the right', () => {
    const nodes = [node('a', 0, 0), node('b', 0, 86)]; // 26px of clear space
    const [[source, target]] = sidesOf(nodes, [{ id: 'e', source: 'a', target: 'b' }]);
    assert.equal(source, 'right');
    assert.equal(target, 'right');
});

test('stacked with no room: bottom to top arcs out to the left', () => {
    const nodes = [node('a', 0, 0), node('b', 0, 86)];
    const [[source, target]] = sidesOf(nodes, [{ id: 'e', source: 'b', target: 'a' }]);
    assert.equal(source, 'left');
    assert.equal(target, 'left');
});

test('room to draw a straight line means no arc', () => {
    const nodes = [node('a', 0, 0), node('b', 160 + TASKS_TIGHT_GAP + 20, 0)];
    const [[source, target]] = sidesOf(nodes, [{ id: 'e', source: 'a', target: 'b' }]);
    assert.notEqual(source, target, 'a roomy pair keeps facing sides');
    assert.equal(source, 'right');
    assert.equal(target, 'left');
});

test('the threshold is the boundary, not a suggestion', () => {
    const justInside = [node('a', 0, 0), node('b', 160 + TASKS_TIGHT_GAP - 1, 0)];
    const justOutside = [node('a', 0, 0), node('b', 160 + TASKS_TIGHT_GAP, 0)];
    const edge = [{ id: 'e', source: 'a', target: 'b' }];
    assert.deepEqual(sidesOf(justInside, edge), [['top', 'top']]);
    assert.deepEqual(sidesOf(justOutside, edge), [['right', 'left']]);
});

test('diagonal neighbours are left alone, because they already have room', () => {
    // Clear space on both axes, so neither arc rule applies.
    const nodes = [node('a', 0, 0), node('b', 186, 86)];
    const [[source, target]] = sidesOf(nodes, [{ id: 'e', source: 'a', target: 'b' }]);
    assert.notEqual(source, target);
});

test('several tight edges out of one node stack rather than collide', () => {
    const nodes = [node('a', 0, 0), node('b', 186, 0), node('c', 372, 0)];
    const { nodeHandles } = buildTaskEdgeAnchors(nodes, [
        { id: 'e1', source: 'a', target: 'b' },
        { id: 'e2', source: 'b', target: 'c' },
    ]);
    const offsets = nodeHandles.b.target.concat(nodeHandles.b.source)
        .filter((handle) => handle.side === 'top')
        .map((handle) => handle.offsetPct);
    assert.equal(offsets.length, 2);
    assert.notEqual(offsets[0], offsets[1], 'two top handles must not sit at one point');
});
