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
const { headingLinesFromSource } = sync;

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

const { sectionRanges, replaceLines, reconcileBlocks, sourceOffsetForSnippet, caretOffset } = sync;

test('sections run from each heading to the next, with the preamble first', () => {
    const text = ['Intro', '', '## A', 'a', '', '### B', 'b'].join('\n');
    assert.deepEqual(sectionRanges(text, 2), [
        { start: 0, end: 2 },
        { start: 2, end: 5 },
        { start: 5, end: 7 },
    ]);
});

test('sections skip frontmatter and pair past the title the page drops', () => {
    const text = ['---', 'x: 1', '---', '# Title', '', '## A', 'a'].join('\n');
    assert.deepEqual(sectionRanges(text, 1), [
        { start: 3, end: 5 },
        { start: 5, end: 7 },
    ]);
});

test('sections refuse a pairing the counts cannot explain', () => {
    assert.equal(sectionRanges(['## A', '## B', '## C'].join('\n'), 1), null);
    // One extra heading that is not a leading title is a guess too.
    assert.equal(sectionRanges(['Intro', '## A', '## B'].join('\n'), 1), null);
});

test('replacing a line range splices the new lines in place', () => {
    const text = ['a', 'b', 'c', 'd'].join('\n');
    assert.equal(replaceLines(text, { start: 1, end: 3 }, 'x\ny\nz'), 'a\nx\ny\nz\nd');
});

test('reconcile keeps unchanged blocks at both ends', () => {
    assert.deepEqual(reconcileBlocks(['a', 'b', 'c'], ['a', 'B', 'B2', 'c']), { prefix: 1, suffix: 1 });
    // An unclosed fence that swallows the rest leaves no suffix to keep.
    assert.deepEqual(reconcileBlocks(['a', 'b', 'c'], ['a', 'bc']), { prefix: 1, suffix: 0 });
    // Prefix and suffix never overlap when a block is duplicated.
    assert.deepEqual(reconcileBlocks(['a', 'a'], ['a', 'a', 'a']), { prefix: 2, suffix: 0 });
});

test('a click snippet finds its caret past stripped markup', () => {
    const source = 'Some **bold** words here';
    assert.equal(sourceOffsetForSnippet(source, 'Some bold wor'), source.indexOf('words') + 3);
    assert.equal(sourceOffsetForSnippet(source, 'zz'), null);
});

test('a caret offset counts earlier lines and clamps the column', () => {
    assert.equal(caretOffset('ab\ncde', 1, 1), 4);
    assert.equal(caretOffset('ab\ncde', 1, 99), 6);
    assert.equal(caretOffset('ab', 5, 0), 0);
});

const { sourceBlocks } = sync;
const spans = (text) => sourceBlocks(text).map((b) => [b.start, b.end, b.kind]);

test('blocks split on blank lines and keep headings to one line', () => {
    const text = ['# T', 'para one', 'still one', '', '## H', '', 'para two'].join('\n');
    assert.deepEqual(spans(text), [[0, 1, 'heading'], [1, 3, 'text'], [4, 5, 'heading'], [6, 7, 'text']]);
});

test('a fence, a callout and a container each stay whole across blank lines', () => {
    const text = ['```mermaid', 'a', '', 'b', '```', '', '/// note', 'x', '', '///', '', ':::tabs', 'y', '', ':::'].join('\n');
    assert.deepEqual(spans(text), [[0, 5, 'fence'], [6, 10, 'callout'], [11, 15, 'container']]);
});

test('a loose list keeps going past blank lines between items', () => {
    const text = ['- a', '', '- b', '  more', '', 'after'].join('\n');
    assert.deepEqual(spans(text), [[0, 4, 'list'], [5, 6, 'text']]);
});

test('frontmatter is its own block and a table is one text block', () => {
    const text = ['---', 'x: 1', '---', '| a |', '|---|', '| 1 |'].join('\n');
    assert.deepEqual(spans(text), [[0, 3, 'frontmatter'], [3, 6, 'text']]);
});

test('an unclosed fence runs to the end, and one-line math closes itself', () => {
    assert.deepEqual(spans(['$$ x $$', '', '```', 'open'].join('\n')), [[0, 1, 'math'], [2, 4, 'fence']]);
});
