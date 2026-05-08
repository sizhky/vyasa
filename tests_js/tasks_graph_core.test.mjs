import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = { innerWidth: 1000, innerHeight: 800 };

const { buildTaskEdgeAnchors, clampScale, isTasksGraphNodeSelectable, nextWheelState, sizeTaskNode } = await import('../vyasa/static/tasks_graph_core.js');

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
        { id: 'left', position: { x: -300, y: 220 }, width: 220, height: 60 },
        { id: 'mid', position: { x: 0, y: 220 }, width: 220, height: 60 },
        { id: 'right', position: { x: 300, y: 220 }, width: 220, height: 60 },
    ];
    const { nodeHandles } = buildTaskEdgeAnchors(nodes, [
        { id: 'a', source: 'src', target: 'left' },
        { id: 'b', source: 'src', target: 'mid' },
        { id: 'c', source: 'src', target: 'right' },
    ]);
    assert.deepEqual(
        nodeHandles.src.source.map((handle) => Math.round(handle.leftPct)),
        [25, 50, 75],
    );
});

test('only task nodes are selectable in items graph', () => {
    assert.equal(isTasksGraphNodeSelectable('task'), true);
    assert.equal(isTasksGraphNodeSelectable('group'), false);
    assert.equal(isTasksGraphNodeSelectable('groupTitle'), false);
});
