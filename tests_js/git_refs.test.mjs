import test from 'node:test';
import assert from 'node:assert/strict';

const { refResultMessage, replaceRefSwitcherInstances, requestRefAction } = await import('../vyasa/extensions_builtin/git_refs/static/git_refs.js');

function response(status, payload) {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => payload,
    };
}

test('ref action accepts truthful success payload', async () => {
    let request;
    const payload = await requestRefAction('/refresh', async (url, options) => {
        request = { url, options };
        return response(200, { ok: true, outcome: 'updated', changed_refs: ['main'] });
    });

    assert.equal(request.url, '/refresh');
    assert.equal(request.options.method, 'POST');
    assert.equal(request.options.cache, 'no-store');
    assert.equal(payload.outcome, 'updated');
});

test('ref action rejects server failure message', async () => {
    await assert.rejects(
        requestRefAction('/refresh', async () => response(502, { ok: false, message: 'Refresh failed.' })),
        /Refresh failed\./,
    );
});

test('ref result copy distinguishes updated and unchanged', () => {
    assert.equal(refResultMessage({ outcome: 'updated', changed_refs: ['main'] }), 'Updated 1 ref');
    assert.equal(refResultMessage({ outcome: 'unchanged' }), 'Refs already current');
    assert.equal(refResultMessage({ ref_outcome: 'updated' }, 'feature'), 'Updated feature');
    assert.equal(refResultMessage({ ref_outcome: 'unchanged' }, 'feature'), 'feature already current');
});

function fakeDetails(label, open = false) {
    return {
        open,
        querySelector: () => ({ textContent: label }),
    };
}

function fakeSwitcher(open, groups) {
    const switcher = {
        open,
        groups,
        replacement: null,
        querySelectorAll: (selector) => selector === 'details[open]' ? groups.filter((group) => group.open) : groups,
        cloneNode: () => fakeSwitcher(open, groups.map((group) => fakeDetails(group.querySelector().textContent, group.open))),
        replaceWith(replacement) { this.replacement = replacement; },
    };
    return switcher;
}

test('switcher refresh replaces every instance and preserves open groups', () => {
    const hidden = fakeSwitcher(false, [fakeDetails('origin', false), fakeDetails('explore/', false)]);
    const visible = fakeSwitcher(true, [fakeDetails('origin', true), fakeDetails('explore/', true)]);
    const next = fakeSwitcher(false, [fakeDetails('origin', false), fakeDetails('explore/', false)]);

    replaceRefSwitcherInstances([hidden, visible], next);

    assert.ok(hidden.replacement);
    assert.equal(visible.replacement, next);
    assert.equal(visible.replacement.open, true);
    assert.deepEqual(visible.replacement.groups.map((group) => group.open), [true, true]);
});
