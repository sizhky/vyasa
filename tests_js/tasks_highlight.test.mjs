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
