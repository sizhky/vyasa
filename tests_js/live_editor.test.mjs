import assert from 'node:assert/strict';
import test from 'node:test';

globalThis.window = { addEventListener: () => {} };
globalThis.performance = { now: () => 0 };
globalThis.document = {
    documentElement: { style: {} },
    querySelector: () => null,
    addEventListener: () => {},
    createElement: () => ({ style: {}, dataset: {}, classList: { toggle: () => {} } }),
};

const { sourceBlocks } = await import('../vyasa/extensions_builtin/document_edit/static/document_edit.js');
const live = await import('../vyasa/extensions_builtin/document_edit/static/live_editor.js');
await live.useBundle(new URL('../vyasa/extensions_builtin/document_edit/static/prosemirror.bundle.js', import.meta.url).href);
const { isProseBlock, makeSchema, makeParser, makeSerializer, buildDoc, serializeDoc, parseProperties, formatProperties, markRange } = live;

const schema = makeSchema();
const parser = makeParser(schema);
const serializer = makeSerializer();
const build = (text) => buildDoc(text, schema, parser, sourceBlocks);

const SOURCE = [
    '---', 'title: Notes', '---', '# Notes', '', '',
    'Intro with __bold__ and _em_.', '',
    '* star item', '* second', '',
    '```mermaid', 'graph TD;', 'A-->B;', '```', '',
    '| a | b |', '|---|---|', '| 1 | 2 |', '',
    'Footnote here[^1].', '', '[^1]: the note', '',
].join('\n');

test('an untouched document saves byte for byte', () => {
    const built = build(SOURCE);
    assert.equal(serializeDoc(built.doc, built, serializer), SOURCE);
});

test('prose becomes rich nodes and everything Vyasa-specific stays an atom', () => {
    const built = build(SOURCE);
    const kinds = [];
    built.doc.forEach((node) => kinds.push(node.type.name === 'vyasa_block' ? `atom:${node.attrs.kind}` : node.type.name));
    assert.deepEqual(kinds, [
        'atom:frontmatter', 'heading', 'paragraph', 'bullet_list', 'atom:fence', 'table', 'atom:text', 'atom:text',
    ]);
});

test('editing one block rewrites only that block', () => {
    const built = build(SOURCE);
    // Replace the paragraph's node, as typing in it would.
    let index = -1;
    built.doc.forEach((node, _offset, i) => { if (node.type.name === 'paragraph') index = i; });
    const paragraph = schema.nodes.paragraph.create(null, schema.text('Intro, rewritten.'));
    const doc = built.doc.copy(built.doc.content.replaceChild(index, paragraph));
    const out = serializeDoc(doc, built, serializer);
    assert.equal(out, SOURCE.replace('Intro with __bold__ and _em_.', 'Intro, rewritten.'));
});

test('an edited list keeps its own bullet marker', () => {
    const built = build('- one\n- two\n');
    const list = built.doc.firstChild;
    const item = schema.nodes.list_item.create(null, schema.nodes.paragraph.create(null, schema.text('three')));
    const grown = list.copy(list.content.append(built.doc.content.constructor.from(item)));
    const doc = built.doc.copy(built.doc.content.replaceChild(0, grown));
    assert.equal(serializeDoc(doc, built, serializer), '- one\n- two\n- three\n');
});

test('a new block between two old ones gets one blank line on each side', () => {
    const built = build('one\n\n\n\ntwo\n');
    const middle = schema.nodes.paragraph.create(null, schema.text('mid'));
    const doc = built.doc.copy(built.doc.content.addToEnd(middle));
    assert.equal(serializeDoc(doc, built, serializer), 'one\n\n\n\ntwo\n\nmid\n');
});

test('prose screening sends Vyasa syntax to atoms', () => {
    assert.equal(isProseBlock('text', 'plain **bold** words'), true);
    assert.equal(isProseBlock('text', 'a ==highlight== here'), false);
    assert.equal(isProseBlock('text', 'see [term][?tip]'), false);
    assert.equal(isProseBlock('text', '> [!note] callout'), false);
    assert.equal(isProseBlock('text', 'costs $5'), false);
    assert.equal(isProseBlock('fence', '```\nx\n```'), false);
});

test('a pipe table becomes a grid and an edited one is written back as GFM', () => {
    const built = build('|a|b|\n|:-|-:|\n|1|2|\n');
    const table = built.doc.firstChild;
    assert.equal(table.type.name, 'table');
    assert.equal(table.childCount, 2);
    assert.equal(table.firstChild.firstChild.attrs.align, 'left');
    // Untouched, the author's spacing survives.
    assert.equal(serializeDoc(built.doc, built, serializer), '|a|b|\n|:-|-:|\n|1|2|\n');
    const row = table.child(1);
    const cell = row.child(1).type.create(row.child(1).attrs, schema.text('2 | two'));
    const grown = table.copy(table.content.replaceChild(1, row.copy(row.content.replaceChild(1, cell))));
    const doc = built.doc.copy(built.doc.content.replaceChild(0, grown));
    assert.equal(serializeDoc(doc, built, serializer), '| a | b |\n| :--- | ---: |\n| 1 | 2 \\| two |\n');
});

test('frontmatter of simple pairs edits as properties and keeps untouched lines', () => {
    const source = ['---', 'pinned: "## Now"', 'agent_sections: ["## Now", "## Log"]', 'draft:', '---'].join('\n');
    const parsed = parseProperties(source);
    assert.deepEqual(parsed.rows.map((r) => [r.key, r.value, r.quote]), [
        ['pinned', '## Now', '"'], ['agent_sections', '["## Now", "## Log"]', ''], ['draft', '', ''],
    ]);
    assert.equal(formatProperties(parsed), source);
    parsed.rows[0] = { key: 'pinned', value: '## Next', quote: '"' };
    parsed.rows.push({ key: 'note', value: 'a: b', quote: '' });
    assert.equal(formatProperties(parsed), ['---', 'pinned: "## Next"', 'agent_sections: ["## Now", "## Log"]', 'draft:', 'note: "a: b"', '---'].join('\n'));
    assert.equal(parseProperties('---\nnested:\n  a: 1\n---'), null);
});

test('the mark range around the caret spans neighbouring text with the same mark', () => {
    const doc = build('plain **bold *and em* text** end\n').doc;
    const paragraph = doc.firstChild;
    const strong = markRange(paragraph, 8, schema.marks.strong);
    assert.equal(paragraph.textBetween(strong.from, strong.to), 'bold and em text');
    assert.equal(markRange(paragraph, 2, schema.marks.strong), null);
});

test('a tight list says so in the DOM, so its items get no paragraph gap', () => {
    const list = build('- a\n- b\n').doc.firstChild;
    assert.equal(list.attrs.tight, true);
    assert.equal(schema.nodes.bullet_list.spec.toDOM(list)[1]['data-tight'], 'true');
});

test('Enter after a typed header row starts a table with an empty row', async () => {
    const { startTable } = live;
    const { EditorState, TextSelection } = await live.useBundle('');
    const doc = schema.nodes.doc.create(null, schema.nodes.paragraph.create(null, schema.text('| name | age |')));
    let state = EditorState.create({ doc });
    state = state.apply(state.tr.setSelection(TextSelection.atEnd(state.doc)));
    let next = null;
    assert.equal(startTable(state, (tr) => { next = state.apply(tr); }), true);
    const table = next.doc.firstChild;
    assert.equal(table.type.name, 'table');
    assert.deepEqual([table.child(0).child(0).textContent, table.child(0).child(1).textContent, table.childCount], ['name', 'age', 2]);
    assert.equal(next.selection.$from.parent.type.name, 'table_cell');
});

test('the title the page header shows stays in the file as a hidden block', () => {
    const text = '---\nx: 1\n---\n# Title\n\nBody.\n';
    const built = buildDoc(text, schema, parser, sourceBlocks, { title: 1 });
    const kinds = [];
    built.doc.forEach((node) => kinds.push(node.type.name === 'vyasa_block' ? `atom:${node.attrs.kind}:${node.attrs.index}` : node.type.name));
    assert.deepEqual(kinds, ['atom:frontmatter:0', 'atom:title:1', 'paragraph']);
    assert.equal(serializeDoc(built.doc, built, serializer), text);
});

test('table actions rebuild the grid and keep the header row on top', () => {
    const { transformTable } = live;
    const table = build('| n | v |\n| --- | --- |\n| b | 2 |\n| a | 10 |\n| c | 1 |\n').doc.firstChild;
    const texts = (t) => { const out = []; t.forEach((row) => { const cells = []; row.forEach((c) => cells.push(c.textContent)); out.push(cells.join(',')); }); return out; };
    assert.deepEqual(texts(transformTable(table, 'sortAsc', { row: 1, col: 1 }).table), ['n,v', 'c,1', 'b,2', 'a,10']);
    assert.deepEqual(texts(transformTable(table, 'sortDesc', { row: 2, col: 0 }).table), ['n,v', 'c,1', 'b,2', 'a,10']);
    const moved = transformTable(table, 'moveColRight', { row: 1, col: 0 });
    assert.deepEqual([texts(moved.table)[0], moved.col], ['v,n', 1]);
    assert.equal(transformTable(table, 'moveColRight', { row: 1, col: 1 }), null);
    const added = transformTable(table, 'addColBefore', { row: 0, col: 1 });
    assert.deepEqual([texts(added.table)[0], added.table.child(0).child(1).type.name], ['n,,v', 'table_header']);
    assert.equal(transformTable(table, 'addRowAbove', { row: 0, col: 0 }), null);
    const below = transformTable(table, 'addRowBelow', { row: 0, col: 0 });
    assert.deepEqual([texts(below.table)[1], below.row, below.table.child(1).child(0).type.name], [',', 1, 'table_cell']);
    const aligned = transformTable(table, 'alignCenter', { row: 2, col: 1 }).table;
    const doc = schema.nodes.doc.create(null, [aligned]);
    assert.equal(serializeDoc(doc, { origin: new WeakMap(), gaps: [], head: [], tail: [] }, serializer),
        '| n | v |\n| --- | :---: |\n| b | 2 |\n| a | 10 |\n| c | 1 |');
    assert.deepEqual(texts(transformTable(table, 'dupRow', { row: 1, col: 0 }).table), ['n,v', 'b,2', 'b,2', 'a,10', 'c,1']);
    assert.deepEqual(texts(transformTable(table, 'delCol', { row: 1, col: 0 }).table), ['v', '2', '10', '1']);
});

test('typed markdown in an edited block is saved as markdown, not escaped', () => {
    const built = build('one\n');
    const typed = schema.nodes.paragraph.create(null, schema.text('see [a](/b/c.json) and **x** and ==m=='));
    const doc = built.doc.copy(built.doc.content.replaceChild(0, typed));
    assert.equal(serializeDoc(doc, built, serializer), 'see [a](/b/c.json) and **x** and ==m==\n');
});
