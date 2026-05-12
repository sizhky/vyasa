import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = { innerWidth: 1000, innerHeight: 800 };

const { buildTaskEdgeAnchors, clampScale, isTasksGraphNodeSelectable, nextWheelState, sizeTaskNode, tasksGraphNodeHitArea } = await import('../vyasa/static/tasks_graph_core.js');

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

test('group panels use passive hit areas in items graph', () => {
    assert.equal(tasksGraphNodeHitArea('task'), 'selectable');
    assert.equal(tasksGraphNodeHitArea('group', false), 'selectable');
    assert.equal(tasksGraphNodeHitArea('group', true), 'background');
    assert.equal(tasksGraphNodeHitArea('groupTitle'), 'control');
});
