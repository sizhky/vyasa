import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const theme = await import('../vyasa/extensions_builtin/tasks/static/tasks_theme.js');
const { tasksActiveNodeFill } = await import('../vyasa/extensions_builtin/tasks/static/tasks_paint.js');
// Recorded before the theme refactor (docs/implementation/KG_THEMING/design.md, Tests).
const baseline = JSON.parse(fs.readFileSync(new URL('./fixtures/kg_theme_baseline.json', import.meta.url), 'utf8'));
const React = { createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat().filter((c) => c !== null && c !== undefined && c !== false) }) };
const card = { background: 'slate', border: '1px solid red' };
const plain = (value) => JSON.parse(JSON.stringify(value));

test('every look paints its wrapper as before the refactor', () => {
    assert.deepEqual(theme.TASKS_NODE_LOOKS, Object.keys(baseline.looks));
    for (const [look, entry] of Object.entries(baseline.looks)) {
        for (const [key, expected] of Object.entries(entry.style)) {
            const [color, dashed] = key.split('|');
            assert.deepEqual(theme.tasksNodeLookStyle(card, look, color === 'none' ? '' : color, dashed === 'true'), expected, `${look} ${key}`);
        }
    }
});

test('every look keeps its lit fill, size and body as before the refactor', () => {
    for (const [look, entry] of Object.entries(baseline.looks)) {
        for (const [color, expected] of Object.entries(entry.litFill)) {
            assert.equal(tasksActiveNodeFill({ data: { __node_look__: look } }, color === 'none' ? '' : color, 0), expected, `${look} lit ${color}`);
        }
        for (const [key, expected] of Object.entries(entry.size)) {
            const [, label, subtitle] = key.split('|');
            const size = theme.tasksLookSize(look, label, subtitle, 220);
            if (size) assert.deepEqual(size, expected, `${look} size ${key}`);
        }
        for (const [dashed, expected] of Object.entries(entry.body)) {
            const body = theme.tasksLookBody(React, look, { dashed: dashed === 'true', kind: 'svc' }, 'sub');
            assert.deepEqual(plain({ body: body.body, frame: body.frame || null, title: body.title('Title'), after: body.after }), expected, `${look} body ${dashed}`);
        }
    }
});

test('edge paths and canvases paint as before the refactor', () => {
    assert.deepEqual(theme.TASKS_EDGE_PATHS, Object.keys(baseline.edges));
    for (const [path, entry] of Object.entries(baseline.edges)) {
        assert.equal(theme.tasksEdgeBaseWidth(path), entry.base);
        assert.equal(theme.tasksEdgeBaseWidth(path, true), entry.focused);
        for (const [key, expected] of Object.entries(entry.stroke)) {
            const [color, dashed] = key.split('|');
            assert.deepEqual(theme.tasksEdgeStrokeStyle(path, color === 'none' ? '' : color, dashed === 'true'), expected, `${path} ${key}`);
        }
    }
    for (const [canvas, entry] of Object.entries(baseline.canvas)) {
        assert.deepEqual(theme.tasksCanvasStyle(canvas), entry.style);
        assert.deepEqual(theme.tasksCanvasBackgroundProps(canvas, { variant: 'dots', gap: 16 }), entry.background);
    }
});

test('no module outside the theme compares a look name', () => {
    const dir = new URL('../vyasa/extensions_builtin/tasks/static/', import.meta.url);
    const looks = theme.TASKS_NODE_LOOKS.join('|');
    const comparison = new RegExp(`(?:[!=]==\\s*'(?:${looks})'|'(?:${looks})'\\s*[!=]==|__node_look__\\s*[!=]==|TASKS_(?:FIGURE|GLYPH)_LOOKS)`);
    const offenders = fs.readdirSync(dir)
        .filter((file) => file.endsWith('.js') && file !== 'tasks_theme.js')
        .flatMap((file) => fs.readFileSync(new URL(file, dir), 'utf8').split('\n')
            .map((line, index) => (comparison.test(line) ? `${file}:${index + 1}: ${line.trim()}` : ''))
            .filter(Boolean));
    assert.deepEqual(offenders, []);
});

test('a figure group has a label title and no CSS ring; a card group keeps its bar', () => {
    assert.equal(theme.tasksGroupTitleMode('outline'), 'label');
    assert.equal(theme.tasksGroupTitleMode('card'), 'bar');
    // A station group frames as a card, so it keeps the card's bar.
    assert.equal(theme.tasksGroupTitleMode('station'), 'bar');
    assert.deepEqual(theme.tasksGroupRingTokens('outline'), { '--kg-group-ring': 'none' });
    assert.deepEqual(theme.tasksGroupRingTokens('card'), {});
    const label = theme.tasksGroupTitleLook('sketch', '#1f9e7a');
    assert.deepEqual(label.style, { background: 'transparent', border: 'none', boxShadow: 'none' });
    assert.match(label.body.fontFamily, /Comic/, 'a sketch group label keeps the hand font');
    assert.equal(theme.tasksGroupTitleLook('card', '#1f9e7a'), null);
});

test('a look sets a default role; a node_role attr overrides it; an authored role is content', async () => {
    const { tasksNodeRole, tasksRoleOf } = await import('../vyasa/extensions_builtin/tasks/static/tasks_roles.js');
    assert.deepEqual(['card', 'outline', 'point', 'circle', 'text'].map((look) => tasksNodeRole({}, look)), ['item', 'item', 'junction', 'mark', 'mark']);
    assert.equal(tasksNodeRole({ node_role: 'item' }, 'circle'), 'item');
    assert.equal(tasksNodeRole({ role: 'junction' }, 'card'), 'item', 'role is an authored attr, not the node role');
    const mark = tasksRoleOf({ __node_look__: 'text' });
    assert.deepEqual([mark.cardState, mark.notes, mark.interactive, mark.bands], [false, false, true, 'thin']);
    const junction = tasksRoleOf({ __node_look__: 'point' });
    assert.deepEqual([junction.interactive, junction.bands, junction.joinsRoutes], [false, 'none', true]);
    assert.equal(theme.tasksStateShadow('hover', '#f00', 'none', 'none'), 'none');
    assert.equal(theme.tasksStateShadow('hover', '#f00', 'none', 'thin'), '0 0 0 1px color-mix(in srgb, #f00 76%, transparent)');
});

// Split a box-shadow list on its top-level commas; colours nest parentheses.
const splitShadows = (value) => {
    const parts = [''];
    let depth = 0;
    for (const char of String(value)) {
        depth += char === '(' ? 1 : (char === ')' ? -1 : 0);
        if (char === ',' && depth === 0) parts.push('');
        else parts[parts.length - 1] += char;
    }
    return parts.map((part) => part.trim());
};

test('lit paint never blurs or filters, for every look, state and band strength', () => {
    const states = ['endpoint', 'picked', 'selected', 'neighbor', 'neighborFocus', 'hover', 'hoverNeighbor'];
    const allowed = new Set(['--vyasa-tasks-active-border', 'boxShadow', 'color', 'textDecoration']);
    for (const look of theme.TASKS_NODE_LOOKS) {
        for (const state of states) {
            for (const bands of ['full', 'thin', 'none']) {
                const style = theme.tasksLitStyle(look, state, '#f00', { bands, checkedShadow: theme.tasksCheckedShadow('#0f0'), stackShadow: theme.tasksStackShadow(look) });
                const where = `${look} ${state} ${bands}`;
                assert.deepEqual(Object.keys(style).filter((key) => !allowed.has(key)), [], where);
                // Every shadow is `[inset] <x> <y> <blur> <spread> <colour>`; the blur must be 0.
                for (const shadow of splitShadows(style.boxShadow)) {
                    if (shadow === 'none') continue;
                    assert.match(shadow, /^(inset )?-?[\d.]+(px)? -?[\d.]+(px)? 0 /, `${where}: ${shadow}`);
                }
            }
        }
    }
});

test('a look picks how its lit state draws: rings, bands only, or ink', () => {
    assert.deepEqual(['card', 'sketch', 'text', 'station', 'point'].map((look) => theme.tasksLookLitPaint(look)), [
        { ring: true, bands: true, ink: false },
        { ring: false, bands: true, ink: false },
        { ring: false, bands: false, ink: true },
        { ring: false, bands: false, ink: true },
        { ring: false, bands: false, ink: false },
    ]);
    assert.equal(theme.tasksLitStyle('sketch', 'hover', '#f00').boxShadow, 'none');
    assert.equal(theme.tasksLitStyle('text', 'hover', '#f00', { bands: 'thin' }).textDecoration, 'underline solid #f00');
    assert.equal(theme.tasksLitStyle('text', 'neighbor', '#f00', { bands: 'thin' }).textDecoration, 'underline dotted #f00');
    assert.equal(theme.tasksLitStyle('card', 'hover', '#f00').boxShadow, '0 0 0 3px color-mix(in srgb, #f00 76%, transparent)');
});

test('a node with internals keeps a stacked frame at rest and in every lit state, on looks that stack', async () => {
    const { tasksTaskWrapperStyle, tasksLitNodeStyle } = await import('../vyasa/extensions_builtin/tasks/static/tasks_paint.js');
    const rest = tasksTaskWrapperStyle({ nodeColor: '#1f9e7a', colorMix: 0, useOverlay: false, look: 'outline', dashed: false, isChecked: false, stateAccent: '', internals: true, width: 100, height: 40, zIndex: 1 });
    assert.equal(rest.boxShadow, theme.tasksStackShadow('outline'));
    assert.equal(rest['--vyasa-tasks-stack-rim'], 'color-mix(in srgb, #1f9e7a 60%, transparent)');
    const lit = tasksLitNodeStyle({ data: { __node_look__: 'outline', internals: '../mha.kg' } }, 'hover', '#f00');
    assert.ok(lit.boxShadow.startsWith('0 0 0 3px'), 'the ring sits above the stack');
    assert.ok(lit.boxShadow.endsWith(theme.tasksStackShadow('outline')));
    assert.equal(theme.tasksStackShadow('text'), '');
    const plain = tasksTaskWrapperStyle({ nodeColor: '', colorMix: 0, useOverlay: false, look: 'card', dashed: false, isChecked: false, stateAccent: '', width: 100, height: 40, zIndex: 1 });
    assert.equal(plain.boxShadow, 'none');
});
