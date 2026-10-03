import test from 'node:test';
import assert from 'node:assert/strict';

const { createPanelMemory, resizePanelRect } = await import('../vyasa/static/floating_panel.js');

const memoryStore = (entries = {}) => {
    const values = new Map(Object.entries(entries));
    return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), values };
};

test('panel memory keeps size and place per prefix and clamps them to the box', () => {
    const store = memoryStore({ 'p-width': '500', 'p-position': JSON.stringify({ left: 900, top: 40 }) });
    const memory = createPanelMemory('p', store);
    assert.equal(memory.preferredWidth(640, 400), 376);
    assert.equal(memory.preferredHeight(480, 1000), 480);
    memory.rememberHeight(300);
    assert.equal(store.values.get('p-height'), '300');
    assert.deepEqual(memory.preferredPosition({ left: 0, top: 0 }, { width: 200, height: 100 }, { width: 800, height: 600 }), { left: 588, top: 40 });
    assert.deepEqual(memory.preferredPosition({ left: 0, top: 0 }, { width: 200, height: 100 }, { width: 800, height: 600 }, { left: 100, top: 100 }), { left: 126, top: 126 });
    assert.equal(createPanelMemory('q', store).storedPosition(), null, 'another prefix has its own memory');
});

test('a resized panel stays inside its box and above the minimum size', () => {
    const rect = { left: 100, top: 100, width: 400, height: 300 };
    const box = { width: 1000, height: 800 };
    assert.deepEqual(resizePanelRect(rect, 'left', 100, 0, box), { left: 200, top: 100, width: 300, height: 300 });
    assert.equal(resizePanelRect(rect, 'right', 900, 0, box).width, 892);
    assert.equal(resizePanelRect(rect, 'top-left', 0, 500, box).height, 192);
});
