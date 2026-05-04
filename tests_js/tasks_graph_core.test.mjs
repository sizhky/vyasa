import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = { innerWidth: 1000, innerHeight: 800 };

const { clampScale, nextWheelState } = await import('../vyasa/static/tasks_graph_core.js');

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
