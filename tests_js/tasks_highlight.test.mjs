import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const { tasksHighlightGraph } = await import('../vyasa/extensions_builtin/tasks/static/tasks_highlight.js');
const { runScenarios } = await import('./fixtures/kg_highlight_scenarios.mjs');
// Recorded from applyHighlight before its paint moved to the state table.
const baseline = JSON.parse(fs.readFileSync(new URL('./fixtures/kg_highlight_baseline.json', import.meta.url), 'utf8'));

test('every highlight pass paints nodes and edges as recorded', () => {
    const out = runScenarios(tasksHighlightGraph);
    for (const name of Object.keys(baseline)) {
        assert.deepEqual(out[name].nodes, baseline[name].nodes, `${name} nodes`);
        assert.deepEqual(out[name].edges, baseline[name].edges, `${name} edges`);
        assert.deepEqual(out[name].trace, baseline[name].trace, `${name} trace`);
    }
});
