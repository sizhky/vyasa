import assert from 'node:assert/strict';
import test from 'node:test';

globalThis.Element = class Element {};
globalThis.window = {};
const appended = [];
globalThis.document = {
    body: { appendChild: (node) => appended.push(node) },
    createElement: () => ({}),
    getElementById: () => null,
};

const shell = await import('../vyasa/static/page_shell.js');
const targets = await import('../vyasa/extensions_builtin/feedback/static/review_targets.js');

test('Page Shell owns shortcut suspension for multiple callers', () => {
    shell.setShortcutsSuspended('feedback', true);
    shell.setShortcutsSuspended('tasks', true);
    shell.setShortcutsSuspended('feedback', false);
    assert.equal(shell.shortcutsSuspended(), true);
    shell.setShortcutsSuspended('tasks', false);
    assert.equal(shell.shortcutsSuspended(), false);
});

test('Page Shell owns one floating action rail', () => {
    const first = shell.ensureFloatingActions();
    document.getElementById = () => first;
    assert.equal(shell.ensureFloatingActions(), first);
    assert.equal(appended.length, 1);
});

test('Page Shell owns editable shortcuts and Markdown hydration', () => {
    const input = new Element();
    input.matches = (selector) => selector.includes('input');
    input.isContentEditable = false;
    assert.equal(shell.isEditableShortcutEvent({ composedPath: () => [input] }), true);
    let hydrated;
    shell.registerMarkdownHydrator((root) => { hydrated = root; });
    shell.hydrateMarkdown(input);
    assert.equal(hydrated, input);
});

test('review targets use only the published data interface', () => {
    const carrier = { dataset: { vyasaReviewTarget: '{"kind":"node","id":"n1"}' } };
    const element = { closest: (selector) => selector.includes('[data-vyasa-review-target]') ? carrier : null };
    assert.deepEqual(targets.reviewTargets(element), [{ kind: 'node', id: 'n1' }]);
    assert.equal(targets.reviewTargetElement(element), carrier);
});

test('Momentum runner accelerates while held and coasts to a stop on release', () => {
    let now = 0;
    const queue = [];
    Object.assign(window, {
        requestAnimationFrame: (fn) => queue.push(fn),
        cancelAnimationFrame: () => { queue.length = 0; },
        matchMedia: () => ({ matches: false }),
    });
    const steps = [];
    const runner = shell.createMomentumRunner({ step: (distance) => steps.push(distance) });
    const tick = (count) => {
        for (let i = 0; i < count && queue.length; i += 1) {
            now += 16;
            queue.shift()(now);
        }
    };

    runner.start(1);
    tick(30);
    const held = steps.length;
    assert.ok(steps[held - 1] > steps[0], 'held key accelerates');
    runner.release(-1);
    tick(5);
    assert.equal(steps.length, held + 5, 'a release of the other direction is ignored');
    runner.release(1);
    tick(400);
    assert.ok(steps.length > held + 5, 'release coasts on');
    assert.ok(steps.every((distance) => distance > 0), 'coasting never reverses');
    assert.equal(queue.length, 0, 'friction ends the coast');
});

test('Quote copy value blockquotes every line and appends the file path', () => {
    const value = shell.quoteMarkdownCopyValue('  first line\n  second line  ', '/vault/notes/deck.md');
    assert.equal(value, '> first line\n> second line\n\n/vault/notes/deck.md');
});

test('Quote copy value drops the trailing blank line when no path is given', () => {
    assert.equal(shell.quoteMarkdownCopyValue('lone line'), '> lone line');
});
