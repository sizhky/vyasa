import assert from 'node:assert/strict';
import test from 'node:test';

globalThis.window = { addEventListener: () => {} };
globalThis.performance = { now: () => 0 };
globalThis.document = {
    querySelector: () => null,
    addEventListener: () => {},
    createElement: () => ({ style: {}, dataset: {}, classList: { toggle: () => {} } }),
};

const sync = await import('../vyasa/extensions_builtin/document_edit/static/document_edit.js');
const { headingLinesFromSource, mappedOffset } = sync;

test('heading scan reports the source line of every heading', () => {
    const text = ['# One', '', 'text', '', '## Two', '', '### Three'].join('\n');
    assert.deepEqual(headingLinesFromSource(text), [0, 4, 6]);
});

test('heading scan ignores hashes inside a fenced block', () => {
    const text = ['# Real', '', '```sh', '# not a heading', '```', '', '## Also real'].join('\n');
    assert.deepEqual(headingLinesFromSource(text), [0, 6]);
});

test('heading scan ignores a tilde fence and a hash with no space', () => {
    const text = ['~~~', '# hidden', '~~~', '#nospace', '# Real'].join('\n');
    assert.deepEqual(headingLinesFromSource(text), [4]);
});

test('heading scan skips frontmatter so its keys never count', () => {
    const text = ['---', 'title: Notes', 'tags: [a]', '---', '', '# Real'].join('\n');
    assert.deepEqual(headingLinesFromSource(text), [5]);
});

test('mapping falls back to percentage when there are too few anchors', () => {
    assert.equal(mappedOffset(50, [], [], 100, 400), 200);
    assert.equal(mappedOffset(25, [10], [80], 100, 400), 100);
});

test('mapping puts a leader sitting on an anchor exactly on its pair', () => {
    const from = [100, 300, 700];
    const to = [50, 900, 1200];
    assert.equal(mappedOffset(100, from, to, 1000, 2000), 50);
    assert.equal(mappedOffset(300, from, to, 1000, 2000), 900);
    assert.equal(mappedOffset(700, from, to, 1000, 2000), 1200);
});

test('mapping interpolates between two anchors that differ wildly in height', () => {
    // The first section is short in the source and tall in the preview, which is
    // exactly the case plain percentage gets wrong.
    const half = mappedOffset(200, [100, 300], [50, 900], 1000, 2000);
    assert.equal(half, 475);
});

test('mapping runs the last segment out to the end of the document', () => {
    assert.equal(Math.round(mappedOffset(500, [100, 300], [50, 900], 900, 1900)), 1233);
    assert.equal(mappedOffset(900, [100, 300], [50, 900], 900, 1900), 1900);
});

test('mapping runs the first segment back to the top of the document', () => {
    assert.equal(mappedOffset(0, [100, 300], [50, 900], 900, 1900), 0);
    assert.equal(Math.round(mappedOffset(50, [100, 300], [50, 900], 900, 1900)), 25);
});

test('mapping never divides by a zero-height segment', () => {
    assert.equal(mappedOffset(100, [100, 100, 300], [50, 50, 900], 900, 1900), 50);
    assert.equal(mappedOffset(10, [0, 0], [0, 0], 0, 0), 0);
});
