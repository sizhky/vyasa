import test from 'node:test';
import assert from 'node:assert/strict';

const { tasksInternalsPeekRect, tasksInternalsTrail, tasksInternalsWorld } = await import('../vyasa/extensions_builtin/tasks/static/tasks_internals.js');
const { tasksNodeLinkKinds } = await import('../vyasa/extensions_builtin/tasks/static/tasks_cards.js');

test('a peek sits under its node when there is room, else above, and stays inside the host', () => {
    const host = { width: 900, height: 700 };
    assert.deepEqual(tasksInternalsPeekRect({ x: 100, y: 50, width: 120, height: 40 }, host), { left: 16, top: 98, width: 640, height: 480 });
    assert.equal(tasksInternalsPeekRect({ x: 400, y: 600, width: 120, height: 40 }, host).top, 112);
    const small = tasksInternalsPeekRect({ x: 10, y: 10, width: 40, height: 20 }, { width: 400, height: 300 });
    assert.deepEqual([small.width, small.height, small.left, small.top], [368, 268, 16, 16]);
});

test('a panel trail extends the trail and schemas of the panel around its host', () => {
    assert.deepEqual(tasksInternalsTrail(null, 'Transformer', '/t/kg.schema', 'MHA'), { labels: ['Transformer', 'MHA'], schemas: ['/t/kg.schema'] });
    const outer = { dataset: { trail: JSON.stringify(['Transformer', 'MHA']), schemas: JSON.stringify(['/t/kg.schema', '/m/kg.schema']) } };
    assert.deepEqual(tasksInternalsTrail(outer, 'ignored', '/m/kg.schema', 'SDPA'), { labels: ['Transformer', 'MHA', 'SDPA'], schemas: ['/t/kg.schema', '/m/kg.schema'] });
});

test('only a look with no stacked frame shows the internals badge', () => {
    assert.ok(!tasksNodeLinkKinds({ id: 'enc_mha', internals: '../mha.kg', __node_look__: 'outline' }).has('internals'));
    assert.ok(tasksNodeLinkKinds({ id: 'note', internals: '../mha.kg', __node_look__: 'text' }).has('internals'));
    assert.ok(!tasksNodeLinkKinds({ id: 'enc_an1', internals: ' ', __node_look__: 'text' }).has('internals'));
});

test('world chips group the edges that cross a node by neighbour and direction', () => {
    const edges = [
        { source: 'f1', target: 'mha', shape: 'Q' }, { source: 'f1', target: 'mha', shape: 'K' }, { source: 'f1', target: 'mha', shape: 'V' },
        { source: 'mem', target: 'mha', shape: 'K' }, { source: 'mha', target: 'an1', shape: '[B, T, 512]' }, { source: 'x', target: 'y' },
    ];
    const labels = { f1: 'qkv', an1: 'ADD & NORM' };
    assert.deepEqual(tasksInternalsWorld('mha', edges, (id) => labels[id], (edge) => edge.shape), {
        incoming: ['Q · K · V ← qkv', 'K ← mem'],
        outgoing: ['[B, T, 512] → ADD & NORM'],
    });
});
