import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const { tasksHighlightGraph } = await import('../vyasa/extensions_builtin/tasks/static/tasks_highlight.js');
const { runScenarios } = await import('./fixtures/kg_highlight_scenarios.mjs');
// Recorded from applyHighlight before its paint moved to the state table, then
// updated once: highlight passes keep a routed edge's path widths and a pair's gap.
const baseline = JSON.parse(fs.readFileSync(new URL('./fixtures/kg_highlight_baseline.json', import.meta.url), 'utf8'));

test('every highlight pass paints nodes and edges as recorded', () => {
    const out = runScenarios(tasksHighlightGraph);
    for (const name of Object.keys(baseline)) {
        assert.deepEqual(out[name].nodes, baseline[name].nodes, `${name} nodes`);
        assert.deepEqual(out[name].edges, baseline[name].edges, `${name} edges`);
        assert.deepEqual(out[name].trace, baseline[name].trace, `${name} trace`);
    }
});

test('a highlight pass keeps a routed edge thin and a pair half no wider than its gap allows', async () => {
    const { tasksEdgeStateWidth, tasksEdgeBaseWidth } = await import('../vyasa/extensions_builtin/tasks/static/tasks_theme.js');
    const routed = { data: { __edge_path__: 'orthogonal' } };
    assert.equal(tasksEdgeStateWidth(routed, true, 4.5), tasksEdgeBaseWidth('orthogonal', true));
    assert.equal(tasksEdgeStateWidth(routed, false, 2.5), tasksEdgeBaseWidth('orthogonal'));
    const half = { data: { __edge_path__: 'ribbon', __pair_half__: 'call' } };
    assert.equal(tasksEdgeStateWidth(half, true, 4.5), 2.6);
    assert.equal(tasksEdgeStateWidth(half, false, 1.25), 1.25, 'a dim half is never wider than a dim ribbon');
    assert.equal(tasksEdgeStateWidth({ data: { __edge_path__: 'ribbon' } }, true, 4.5), 4.5);
});

test('a junction walk keeps edge direction, skips sibling branches and stops on cycles', async () => {
    const { tasksJunctionReach } = await import('../vyasa/extensions_builtin/tasks/static/tasks_graph_model.js');
    const e = (id, source, target) => ({ id, source, target });
    // in -> r1 -> an (residual), r1 -> f1 -> mha -> an, an -> r2 -> ffn, r2 -> an2.
    const edges = [e('in', 'add', 'r1'), e('res', 'r1', 'an'), e('fork', 'r1', 'f1'), e('q', 'f1', 'mha'), e('sub', 'mha', 'an'), e('out', 'an', 'r2'), e('ffn', 'r2', 'ffn'), e('res2', 'r2', 'an2')];
    const junction = (id) => ['r1', 'r2', 'f1'].includes(id);
    const seeds = edges.filter((edge) => edge.source === 'an' || edge.target === 'an');
    const reach = tasksJunctionReach(seeds, edges, junction);
    assert.deepEqual([...reach.edgeIds].sort(), [['ffn', true], ['in', false], ['res2', true]]);
    assert.deepEqual([...reach.nodeIds].sort(), ['add', 'an2', 'ffn', 'r1', 'r2']);
    assert.equal(tasksJunctionReach(seeds, edges, () => false).edgeIds.size, 0);
    const loop = [e('a', 'x', 'j'), e('b', 'j', 'k'), e('c', 'k', 'j')];
    assert.deepEqual([...tasksJunctionReach([loop[0]], loop, (id) => id !== 'x').edgeIds.keys()].sort(), ['b', 'c']);
});

test('selecting a node lights the nodes beyond a junction, in edge direction', async () => {
    const { graph, baseCtx } = await import('./fixtures/kg_highlight_scenarios.mjs');
    const node = (id, look) => ({ ...graph.baseNodes[0], id, data: { ...graph.baseNodes[0].data, label: id, __node_look__: look } });
    const edge = (id, source, target) => ({ ...graph.authoredGraphEdges[0], id, source, target });
    const out = tasksHighlightGraph({
        baseNodes: [node('add', 'circle'), node('r1', 'point'), node('mha', 'outline'), node('an', 'outline'), node('r2', 'point'), node('ffn', 'outline')],
        authoredGraphEdges: [edge('in', 'add', 'r1'), edge('res', 'r1', 'an'), edge('sub', 'mha', 'an'), edge('out', 'an', 'r2'), edge('next', 'r2', 'ffn')],
        referenceEdges: [],
        nodeId: 'an',
    }, baseCtx);
    const modes = Object.fromEntries(out.nodes.map((n) => [n.id, n.data.highlightMode]));
    assert.deepEqual(modes, { add: 'neighbor', r1: 'neighbor', mha: 'neighbor', an: 'selected', r2: 'neighbor', ffn: 'neighbor' });
    const strokes = Object.fromEntries(out.edges.map((e) => [e.id, e.data.strokeMode]));
    assert.equal(strokes.in, 'selected-in');
    assert.equal(strokes.next, 'selected-out');
});

test('a filtered hover walks through junctions that the filter does not match', async () => {
    const { tasksFilterHoverFocus } = await import('../vyasa/extensions_builtin/tasks/static/tasks_graph_model.js');
    const e = (id, source, target) => ({ id, source, target });
    const edges = [e('in', 'add', 'r1'), e('res', 'r1', 'an'), e('fork', 'r1', 'f1'), e('out', 'an', 'r2'), e('next', 'r2', 'ffn'), e('hidden', 'r2', 'off')];
    const junction = (id) => ['r1', 'r2', 'f1'].includes(id);
    const focus = tasksFilterHoverFocus(new Set(['add', 'an', 'ffn']), edges, 'an', junction);
    assert.deepEqual([...focus.edgeIds].sort(), ['in', 'next', 'out', 'res']);
    assert.deepEqual([...focus.walked].sort(), [['in', false], ['next', true]]);
    assert.ok(!focus.nodeIds.has('off'), 'a node outside the filter stays out past a junction');
    assert.equal(tasksFilterHoverFocus(new Set(['add', 'an', 'ffn']), edges, 'an').edgeIds.size, 0, 'without pass-through the filter keeps today\'s subset');
});
