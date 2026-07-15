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
