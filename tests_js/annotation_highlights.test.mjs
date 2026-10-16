import test from 'node:test';
import assert from 'node:assert/strict';

const { createHighlightStore, overlapping, HIGHLIGHT_COLORS, HIGHLIGHT_KEY_PREFIX } = await import('../vyasa/extensions_builtin/annotations/static/highlights.js');

const memoryStore = () => {
    const values = new Map();
    return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key), values };
};

test('highlights persist per path and removing the last one clears the key', () => {
    const storage = memoryStore();
    const store = createHighlightStore('docs/a', storage);
    const item = store.add({ quote: 'hello', anchor: { start: 3, end: 8 } });
    assert.deepEqual(createHighlightStore('docs/a', storage).list(), [item]);
    assert.deepEqual(createHighlightStore('docs/b', storage).list(), []);
    store.remove([item.id]);
    assert.equal(storage.values.has(`${HIGHLIGHT_KEY_PREFIX}docs/a`), false);
});

test('corrupt or unavailable storage reads as empty and add reports failure', () => {
    const storage = memoryStore();
    storage.setItem(`${HIGHLIGHT_KEY_PREFIX}p`, '{not json');
    assert.deepEqual(createHighlightStore('p', storage).list(), []);
    const throwing = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
    assert.equal(createHighlightStore('p', throwing).add({ quote: 'x' }), null);
    assert.equal(createHighlightStore('p', null).add({ quote: 'x' }), null);
});

test('overlap uses offsets when both anchors exist, else the exact quote', () => {
    const items = [{ id: 'a', quote: 'x', anchor: { start: 0, end: 5 } }, { id: 'b', quote: 'y', anchor: null }];
    assert.deepEqual(overlapping(items, { start: 4, end: 9 }, 'z'), ['a']);
    assert.deepEqual(overlapping(items, { start: 5, end: 9 }, 'y'), ['b']);
    assert.deepEqual(overlapping(items, null, 'q'), []);
});

test('colour defaults to the first colour, unknown colours fall back, and recolor rewrites only the given ids', () => {
    const storage = memoryStore();
    storage.setItem(`${HIGHLIGHT_KEY_PREFIX}p`, JSON.stringify([{ id: 'old', quote: 'a' }, { id: 'odd', quote: 'b', color: 'purple' }]));
    const store = createHighlightStore('p', storage);
    assert.deepEqual(store.list().map((item) => item.color), [HIGHLIGHT_COLORS[0], HIGHLIGHT_COLORS[0]]);
    const added = store.add({ quote: 'c', color: 'pink' });
    store.recolor(['old'], 'blue');
    assert.deepEqual(Object.fromEntries(store.list().map((item) => [item.id, item.color])), { old: 'blue', odd: 'yellow', [added.id]: 'pink' });
});
