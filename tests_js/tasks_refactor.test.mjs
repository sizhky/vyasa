import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ensureReact, loadScript } from '../vyasa/static/page_shell.js';
import { ensureTasksReactFlow } from '../vyasa/extensions_builtin/tasks/static/tasks_runtime.js';
import { buildTasksCollapsedGraph, clampTasksProjectionDisplayOpacity, parseTasksProjectionConfigText, readTasksProjectionPrefsForModel } from '../vyasa/extensions_builtin/tasks/static/tasks_graph_model.js';
import { clearTasksGlobalToggle, readTasksPrefs, writeTasksGlobalToggle, writeTasksPrefs } from '../vyasa/extensions_builtin/tasks/static/tasks_preferences.js';

const fixtures = JSON.parse(fs.readFileSync(new URL('../tests/fixtures/tasks_collapsed_graph.json', import.meta.url)));
const canonical = graph => ({
    nodes: graph.nodes.map(node => ({ ...node, href: node.href ?? null })).sort((a, b) => a.id.localeCompare(b.id)),
    edges: [...graph.edges].sort((a, b) => a.id.localeCompare(b.id)),
});
for (const fixture of fixtures) {
    test(`collapsed graph contract: ${fixture.name}`, () => {
        assert.deepEqual(canonical(buildTasksCollapsedGraph(fixture.model)), canonical(fixture.expected));
    });
}

test('zero stored opacity keeps the display minimum', () => {
    const config = parseTasksProjectionConfigText('@views\nfocus:\n    projection_unspecified_content_opacity=0\n');
    assert.equal(config.projectionUnspecifiedContentOpacity, '0');
    assert.equal(clampTasksProjectionDisplayOpacity(0), 0.02);
    assert.equal(clampTasksProjectionDisplayOpacity('bad'), 0.82);
});

test('saved notes remain scoped and view defaults survive reset', () => {
    const values = new Map();
    const timers = new Map();
    let nextTimer = 0;
    globalThis.window = {
        localStorage: {
            getItem: key => values.get(key) ?? null,
            setItem: (key, value) => values.set(key, value),
            removeItem: key => values.delete(key),
        },
        setTimeout: callback => { timers.set(++nextTimer, callback); return nextTimer; },
        clearTimeout: id => timers.delete(id),
    };
    const model = { document_path: 'guide', persistence_id: 'graph', view_projections: [{ id: 'focus', search: 'authored', groups_from: ['owner'] }] };
    writeTasksPrefs(model, { nodeNotes: { a: 'Keep this note' }, edgeNotes: { e: 'Keep this edge' }, slideNotes: { intro: 'Keep this slide' } });
    for (const callback of [...timers.values()]) callback();
    const saved = readTasksPrefs(model);
    assert.deepEqual(saved.nodeNotes, { a: 'Keep this note' });
    assert.deepEqual(saved.edgeNotes, { e: 'Keep this edge' });
    assert.deepEqual(saved.slideNotes, { intro: 'Keep this slide' });
    assert.deepEqual(readTasksPrefs({ ...model, persistence_id: 'other' }), {});
    assert.equal(readTasksProjectionPrefsForModel(model, { projectionPrefs: {} }, 'focus').searchQuery, 'authored');
    writeTasksGlobalToggle('reset-me', 'true');
    clearTasksGlobalToggle('reset-me');
    for (const callback of [...timers.values()]) callback();
    assert.equal(values.has('reset-me'), false);
});

function assetDocument() {
    const assets = [];
    class Asset extends EventTarget {
        dataset = {};
        remove() { const index = assets.indexOf(this); if (index >= 0) assets.splice(index, 1); }
    }
    return {
        assets,
        createElement: () => new Asset(),
        head: { appendChild: asset => { asset.remove(); assets.push(asset); } },
        querySelector: selector => {
            const url = selector.match(/(?:src|href)="([^"]+)"/)?.[1];
            return assets.find(asset => asset.src === url || asset.href === url) || null;
        },
    };
}
async function settle() { for (let i = 0; i < 8; i++) await Promise.resolve(); }

test('KG and MDX React requests share pending loads', async () => {
    globalThis.document = assetDocument();
    globalThis.window = {};
    const mdx = ensureReact();
    const kg = ensureTasksReactFlow();
    let finished = false;
    mdx.then(() => { finished = true; });
    await settle();
    const react = document.assets.filter(asset => asset.src?.includes('/react@'));
    assert.equal(react.length, 1);
    assert.equal(finished, false);
    window.React = { Fragment: Symbol(), createElement: () => null };
    react[0].dispatchEvent(new Event('load'));
    await settle();
    const dom = document.assets.filter(asset => asset.src?.includes('/react-dom@'));
    assert.equal(dom.length, 1);
    window.ReactDOM = {};
    dom[0].dispatchEvent(new Event('load'));
    await settle();
    const flow = document.assets.find(asset => asset.src?.includes('@xyflow'));
    assert.ok(flow);
    window.ReactFlow = {};
    flow.dispatchEvent(new Event('load'));
    await Promise.all([mdx, kg]);
    assert.equal(finished, true);
    assert.equal(typeof window.jsxRuntime.jsx, 'function');
});

test('failed scripts can retry and missing exports remain errors', async () => {
    globalThis.document = assetDocument();
    let ready = false;
    const first = loadScript('/retry.js', () => ready);
    document.assets[0].dispatchEvent(new Event('error'));
    await assert.rejects(first, /Failed to load/);
    assert.equal(document.assets.length, 0);
    const retry = loadScript('/retry.js', () => ready);
    document.assets[0].dispatchEvent(new Event('load'));
    await assert.rejects(retry, /Missing runtime/);
    const success = loadScript('/retry.js', () => ready);
    ready = true;
    document.assets[0].dispatchEvent(new Event('load'));
    await success;
});

test('an existing pending script is awaited', async () => {
    globalThis.document = assetDocument();
    const script = document.createElement('script');
    script.src = '/existing.js';
    document.head.appendChild(script);
    let ready = false;
    const pending = loadScript('/existing.js', () => ready);
    let finished = false;
    pending.then(() => { finished = true; });
    await settle();
    assert.equal(finished, false);
    assert.equal(document.assets.length, 1);
    ready = true;
    script.dispatchEvent(new Event('load'));
    await pending;
});
