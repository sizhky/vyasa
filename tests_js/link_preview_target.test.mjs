import test from 'node:test';
import assert from 'node:assert/strict';

const { markLinkPreviewTarget } = await import('../vyasa/extensions_builtin/link_preview/static/link_preview_target.js');

function element(classes, matches) {
    const list = new Set(classes);
    return {
        classList: { add: (...names) => names.forEach((name) => list.add(name)), contains: (name) => list.has(name) },
        matches: (selector) => matches(selector, list),
        list,
    };
}

const codeLine = (selector, list) => selector.startsWith('.code-block .vyasa-code-line')
    && !(selector.includes(':not(.vyasa-code-line-highlight)') && list.has('vyasa-code-line-highlight'));

test('a target code line takes the shared code line highlight', () => {
    const line = element(['vyasa-code-line'], codeLine);
    markLinkPreviewTarget(line);
    assert.deepEqual([...line.list].sort(), [
        'vyasa-code-line',
        'vyasa-code-line-highlight',
        'vyasa-code-line-highlight-end',
        'vyasa-code-line-highlight-start',
        'vyasa-link-preview-target-line',
    ]);
});

test('a line inside a focus range keeps its range edges', () => {
    const line = element(['vyasa-code-line', 'vyasa-code-line-highlight', 'vyasa-code-line-highlight-start'], codeLine);
    markLinkPreviewTarget(line);
    assert.equal(line.list.has('vyasa-code-line-highlight-end'), false);
    assert.equal(line.list.has('vyasa-link-preview-target-line'), true);
});

test('a heading target keeps only the outline class', () => {
    const heading = element([], () => false);
    markLinkPreviewTarget(heading);
    assert.deepEqual([...heading.list], ['vyasa-link-preview-target-line']);
});
