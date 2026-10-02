import test from 'node:test';
import assert from 'node:assert/strict';

const { tasksActiveNodeFill, tasksCanvasStyle, tasksEdgeStrokeStyle, tasksHoverFocusEdge, tasksNodeLookStyle, tasksRouteHeadPath, tasksRoutePath, tasksTaperedArrowHeadPath } = await import('../vyasa/extensions_builtin/tasks/static/tasks_paint.js');
const { sizeTaskNode, tasksArcRoute, tasksGlyphNodeSize, tasksParsePort, tasksCanvasOf, tasksEdgeCornerOf, tasksEdgePathOf, tasksIsDashed, tasksNodeLook, tasksOctilinearRoute, tasksOrthogonalRoute, tasksRectExitPoint, tasksRouteEdges, tasksStraightRoute } = await import('../vyasa/extensions_builtin/tasks/static/tasks_graph_core.js');
const { TASKS_LAYOUTS, buildArcTasksGraph, buildGridTasksGraph, buildLayeredTasksGraph } = await import('../vyasa/extensions_builtin/tasks/static/tasks_layouts.js');

const nums = (path) => path.match(/-?\d*\.?\d+/g).map(Number);

test('a two-point route arrowhead points along its only run', () => {
    const route = [{ x: 0, y: 0 }, { x: 300, y: 90 }];
    const [, labelX, labelY] = tasksRoutePath(route);
    const [tipX, tipY, aX, aY, bX, bY] = nums(tasksTaperedArrowHeadPath(tasksRouteHeadPath(route), 10));
    const baseMid = [(aX + bX) / 2, (aY + bY) / 2];
    assert.deepEqual([tipX, tipY], [300, 90]);
    assert.ok(Math.abs((baseMid[0] - tipX) * 90 - (baseMid[1] - tipY) * 300) < 1e-6);
    assert.deepEqual([labelX, labelY], [150, 45]);
});

test('an orthogonal route arrowhead follows its final run', () => {
    const route = [{ x: 0, y: 0 }, { x: 0, y: 20 }, { x: 60, y: 20 }, { x: 60, y: 40 }];
    const [tipX, tipY, aX, aY, bX, bY] = nums(tasksTaperedArrowHeadPath(tasksRouteHeadPath(route), 10));
    assert.deepEqual([tipX, tipY], [60, 40]);
    assert.ok(aY < 40 && bY < 40 && aX !== bX);
});

test('only grid declares line edges', () => {
    const lines = Object.values(TASKS_LAYOUTS).filter((layout) => layout.edgePath === 'line').map((layout) => layout.id);
    assert.deepEqual(lines, ['grid']);
});

const view = { grid_col: 'column', grid_row: 'track', grid_col_order: 'a,gap,b', grid_row_order: 'top,space,bottom' };
const place = (tasks) => Object.fromEntries(buildGridTasksGraph({ tasks, subtitle_from: 'description' }, view).nodes.map((node) => [node.id, node]));

test('grid centres a single node against a stack in the same row', () => {
    const nodes = place([
        { id: 'hub', label: 'Hub', column: 'a', track: 'top' },
        { id: 'x', label: 'X', column: 'b', track: 'top' },
        { id: 'y', label: 'Y', column: 'b', track: 'top' },
        { id: 'z', label: 'Z', column: 'b', track: 'top' },
    ]);
    const mid = (node) => node.position.y + node.height / 2;
    assert.equal(mid(nodes.hub), mid(nodes.y));
    assert.ok(nodes.x.position.y < nodes.y.position.y && nodes.y.position.y < nodes.z.position.y);
});

test('grid rows are as tall as their content, and an empty track is a small spacer', () => {
    const nodes = place([
        { id: 'top', label: 'Top', column: 'a', track: 'top' },
        { id: 'bottom', label: 'Bottom', column: 'a', track: 'bottom' },
    ]);
    const gap = nodes.bottom.position.y - (nodes.top.position.y + nodes.top.height);
    assert.ok(gap < 140, `rows sit ${gap}px apart`);
});

test('grid skips an empty column down to a spacer width', () => {
    const nodes = place([
        { id: 'left', label: 'Left', column: 'a', track: 'top' },
        { id: 'right', label: 'Right', column: 'b', track: 'top' },
    ]);
    assert.ok(nodes.right.position.x - nodes.left.position.x < 2 * (nodes.left.width + 56));
});

test('grid grows a node for the subtitle its view names', () => {
    const nodes = place([
        { id: 'bare', label: 'Gate', column: 'a', track: 'top' },
        { id: 'told', label: 'Gate', description: 'anchored? judged? generic? duplicate?', column: 'b', track: 'top' },
    ]);
    assert.ok(nodes.told.height > nodes.bare.height);
});

test('the figure layouts, arc and grid, default to outline nodes', () => {
    const outlines = Object.values(TASKS_LAYOUTS).filter((layout) => layout.nodeLook === 'outline').map((layout) => layout.id);
    assert.deepEqual(outlines.sort(), ['arc', 'grid']);
});

test('hover thickens a ribbon edge more than a line edge', () => {
    const hover = (edgePath) => tasksHoverFocusEdge({ source: 'a', data: { __edge_path__: edgePath }, style: {} }, 'a').style.strokeWidth;
    assert.equal(hover('ribbon'), 4.75);
    assert.equal(hover('line'), 2.5);
});

test('a lit outline node keeps its role-tinted paper fill', () => {
    const fill = tasksActiveNodeFill({ data: { __node_look__: 'outline' } }, '#82aaff', 0);
    assert.equal(fill, 'color-mix(in srgb, #82aaff 12%, var(--vyasa-paper))');
});

const box = (x, y, width = 220, height = 44) => ({ x, y, width, height });

test('a straight edge between side-by-side boxes meets the facing sides at mid height', () => {
    // The old anchors put both ends on the top side here, so the line ran along the borders.
    const ends = tasksStraightRoute(box(0, 0), box(276, 0));
    assert.deepEqual(ends, [{ x: 220, y: 22 }, { x: 273, y: 22 }]);
});

test('three sources converge on one target at three different points', () => {
    const target = box(400, 100, 220, 60);
    const arrivals = [box(0, 0), box(0, 108), box(0, 216)].map((source) => tasksStraightRoute(source, target)[1].y);
    assert.equal(new Set(arrivals).size, 3);
    assert.ok(arrivals[0] < arrivals[1] && arrivals[1] < arrivals[2]);
});

test('a diagonal edge leaves through the corner-side the ray crosses', () => {
    const exit = tasksRectExitPoint(box(0, 0, 100, 40), { x: 250, y: 220 });
    assert.equal(exit.y, 40);
    assert.ok(exit.x > 50 && exit.x < 100);
});

// The judgement workflow, cut down: merge sits above synthesise, fetch is far left
// one row down, propose is two rows down and the library one row up.
const r = (x, y) => ({ x, y, width: 220, height: 50 });
const flow = { gate: r(80, 0), context: r(356, 0), select: r(632, 0), merge: r(908, 0), fetch: r(80, 86), interpret: r(356, 86), synthesise: r(908, 86), propose: r(908, 172), library: r(632, -86) };
const gutter = { x: 56, y: 36 };
const route = (from, to) => tasksOrthogonalRoute(flow[from], flow[to], Object.values(flow), gutter);
const crossings = (points) => Object.entries(flow).filter(([, rect]) => points.slice(1).some((point, index) => {
    const prev = points[index];
    return Math.min(prev.x, point.x) < rect.x + rect.width - 1 && Math.max(prev.x, point.x) > rect.x + 1
        && Math.min(prev.y, point.y) < rect.y + rect.height - 1 && Math.max(prev.y, point.y) > rect.y + 1;
})).map(([id]) => id);

test('orthogonal: neighbours in a row join with one straight run', () => {
    assert.deepEqual(route('gate', 'context'), [{ x: 300, y: 25 }, { x: 353, y: 25 }]);
});

test('orthogonal: a row change far to the left drops through the gutter below (Z)', () => {
    const points = route('merge', 'fetch');
    assert.equal(points.length, 4);
    assert.equal(points[1].y, 68); // the gutter between the two rows
    assert.deepEqual(crossings(points), []);
});

test('orthogonal: a back-edge loops around the boxes instead of through them', () => {
    const points = route('propose', 'library');
    assert.deepEqual(crossings(points), []);
    assert.ok(points.length >= 3);
});

test('cascade: an item attr beats the view, the view beats the layout default', () => {
    assert.equal(tasksEdgePathOf({}, {}, TASKS_LAYOUTS.grid.edgePath), 'line');
    assert.equal(tasksEdgePathOf({}, { edge_path: 'orthogonal' }, TASKS_LAYOUTS.grid.edgePath), 'orthogonal');
    assert.equal(tasksEdgePathOf({ edge_path: 'ribbon' }, { edge_path: 'orthogonal' }, 'line'), 'ribbon');
    assert.equal(tasksEdgePathOf({}, {}), 'ribbon');
    assert.equal(tasksNodeLook({}, {}, TASKS_LAYOUTS.grid.nodeLook), 'outline');
    assert.equal(tasksNodeLook({ node_look: 'card' }, { node_look: 'outline' }), 'card');
    // A value that is not a style falls through to the next level.
    assert.equal(tasksNodeLook({ node_look: 'fancy' }, { node_look: 'outline' }), 'outline');
});

test('an outline node is sized for its subtitle wherever it is laid out', () => {
    const bare = sizeTaskNode('Gate', 'task', 220, { look: 'outline' }).height;
    const told = sizeTaskNode('Gate', 'task', 220, { look: 'outline', subtitle: 'anchored? judged? generic? duplicate?' }).height;
    assert.ok(told > bare);
    // The view's model carries the view and graph defaults.
    const layered = buildLayeredTasksGraph({ node_look: 'outline', subtitle_from: 'description', tasks: [
        { id: 'a', label: 'Gate', tier: 'one', description: 'anchored? judged? generic? duplicate? and more words' },
        { id: 'b', label: 'Gate', tier: 'one', node_look: 'card' },
    ] }, { layered_tier: 'tier' }).nodes;
    const height = (id) => layered.find((node) => node.id === id).height;
    assert.ok(height('a') >= told);
});

test('node look style: outline replaces the card frame, dashed dashes either', () => {
    const card = { background: 'slate', border: '1px solid red' };
    assert.deepEqual(tasksNodeLookStyle(card, 'card', 'red', true), { background: 'slate', border: '1px dashed red' });
    assert.match(tasksNodeLookStyle(card, 'outline', '#82aaff', true).border, /^2px dashed /);
});

test('edge stroke: a routed edge is thin muted ink, a ribbon keeps its width', () => {
    assert.equal(tasksEdgeStrokeStyle('line', '').strokeWidth, 1.5);
    assert.match(tasksEdgeStrokeStyle('orthogonal', '').stroke, /var\(--vyasa-ink\)/);
    assert.deepEqual(tasksEdgeStrokeStyle('ribbon', '#f00', true), { stroke: '#f00', strokeWidth: 2.5, strokeDasharray: '6 5' });
});

test('routing solves only routed edges and skips open groups as obstacles', () => {
    const nodes = [
        { id: 'a', position: { x: 0, y: 0 }, width: 100, height: 40, data: { __kind__: 'task' } },
        { id: 'b', position: { x: 0, y: 200 }, width: 100, height: 40, data: { __kind__: 'task' } },
        { id: 'g', position: { x: -20, y: -20 }, width: 140, height: 280, data: { __kind__: 'group' }, className: 'vyasa-tasks-node--expanded-group' },
    ];
    const [ribbon, line] = tasksRouteEdges(nodes, [
        { id: 'r', source: 'a', target: 'b', data: { __edge_path__: 'ribbon' } },
        { id: 'l', source: 'a', target: 'b', data: { __edge_path__: 'orthogonal' } },
    ]);
    assert.equal(ribbon.data.__route__, undefined);
    assert.deepEqual(line.data.__route__, [{ x: 50, y: 40 }, { x: 50, y: 197 }]);
});

test('dashed accepts the usual truthy spellings', () => {
    assert.deepEqual(['true', 'yes', '1', 'false', ''].map((dashed) => tasksIsDashed({ dashed })), [true, true, true, false, false]);
});

const sq = (x, y) => ({ x, y, width: 20, height: 20 });

test('round corners bend each corner and keep the straight runs', () => {
    const [d] = tasksRoutePath([{ x: 0, y: 0 }, { x: 0, y: 40 }, { x: 60, y: 40 }], 12);
    assert.equal(d, 'M 0 0 L 0 28 Q 0 40 12 40 L 60 40');
    assert.equal(tasksEdgeCornerOf({ edge_corner: 'sharp' }, { edge_corner: 'round' }), 'sharp');
    assert.equal(tasksEdgeCornerOf({}, {}), 'sharp');
});

test('octilinear runs only at 0, 45 and 90 degrees', () => {
    const points = tasksOctilinearRoute(sq(0, 0), sq(200, 100));
    const angles = points.slice(1).map((p, i) => Math.round((Math.atan2(p.y - points[i].y, p.x - points[i].x) * 180) / Math.PI));
    assert.ok(angles.every((a) => a % 45 === 0), `angles ${angles}`);
});

test('an arc bulges left of travel: above going forward, below coming back', () => {
    const forward = tasksArcRoute(sq(0, 0), sq(200, 0));
    const back = tasksArcRoute(sq(200, 0), sq(0, 0));
    assert.ok(forward[12].y < 0 && back[12].y > 20);
});

test('a station routes to its dot, not its label box', () => {
    const nodes = [
        { id: 'a', position: { x: 0, y: 0 }, width: 120, height: 48, data: { __kind__: 'task', __node_look__: 'station' } },
        { id: 'b', position: { x: 300, y: 0 }, width: 120, height: 48, data: { __kind__: 'task', __node_look__: 'station' } },
    ];
    const [edge] = tasksRouteEdges(nodes, [{ id: 'e', source: 'a', target: 'b', data: { __edge_path__: 'line' } }]);
    assert.deepEqual(edge.data.__route__[0], { x: 68, y: 24 });
});

test('looks size their boxes: a tab adds its band, a station holds a label', () => {
    const outline = sizeTaskNode('Orders', 'task', 200, { look: 'outline' }).height;
    assert.equal(sizeTaskNode('Orders', 'task', 200, { look: 'tab' }).height, outline + 22);
    assert.equal(sizeTaskNode('Orders', 'task', 200, { look: 'station' }).height, 48);
    assert.equal(sizeTaskNode('Orders', 'task', 200, { look: 'sketch' }).height, outline);
});

test('every look restyles the wrapper; a frame look keeps the lit fill clear', () => {
    const card = { background: 'slate', border: '1px solid red' };
    assert.equal(tasksNodeLookStyle(card, 'sketch', 'red').border, 'none');
    assert.match(tasksNodeLookStyle(card, 'blueprint', 'red', true).border, /dashed/);
    assert.equal(tasksNodeLookStyle(card, 'tab', 'red').background, 'var(--vyasa-paper)');
    assert.equal(tasksActiveNodeFill({ data: { __node_look__: 'station' } }, 'red', 0), 'transparent');
    assert.equal(tasksEdgeStrokeStyle('octilinear', '').strokeWidth, 5);
});

test('a blueprint canvas restates the theme tokens for the pane', () => {
    assert.equal(tasksCanvasOf({ canvas: 'blueprint' }), 'blueprint');
    assert.equal(tasksCanvasOf({ canvas: 'neon' }), 'plain');
    assert.equal(tasksCanvasStyle('blueprint')['--vyasa-paper'], '#123a63');
    assert.deepEqual(tasksCanvasStyle('plain'), {});
});

test('arc layout: one baseline, ordered by arc_order with numeric sort', () => {
    const { nodes } = buildArcTasksGraph({ tasks: [
        { id: 'c', label: 'C', step: '10' },
        { id: 'a', label: 'A', step: '2' },
        { id: 'z', label: 'Z' },
        { id: 'b', label: 'B', step: '3' },
    ] }, { arc_order: 'step' });
    assert.deepEqual(nodes.map((n) => n.id), ['a', 'b', 'c', 'z']);
    const centres = new Set(nodes.map((n) => n.position.y + n.height / 2));
    assert.equal(centres.size, 1);
    assert.equal(TASKS_LAYOUTS.arc.edgePath, 'arc');
    // A site or graph edge_path must not replace the arcs; only the view or an edge may.
    assert.equal(TASKS_LAYOUTS.arc.ownsEdgePath, true);
});

test('an arc label sits on the apex; a run label stays on the longest run', () => {
    const arc = tasksArcRoute(sq(0, 0), sq(300, 0));
    const apex = arc.reduce((top, point) => (point.y < top.y ? point : top));
    const [, x, y] = tasksRoutePath(arc, 0, 'middle');
    assert.ok(Math.abs(x - apex.x) < 3 && Math.abs(y - apex.y) < 1, `label ${x},${y} apex ${apex.x},${apex.y}`);
    assert.deepEqual(tasksRoutePath([{ x: 0, y: 0 }, { x: 0, y: 10 }, { x: 100, y: 10 }]).slice(1), [50, 10]);
});

const rfNode = (id, rect, look = 'outline') => ({ id, position: { x: rect.x, y: rect.y }, width: rect.width, height: rect.height, data: { __kind__: 'task', __node_look__: look } });
const rfEdge = (id, source, target, attrs = {}) => ({ id, source, target, ...attrs, data: { __edge_path__: 'orthogonal' } });
const routeOf = (edges, id) => edges.find((edge) => edge.id === id).data.__route__;

test('a port names a side and a percent along it', () => {
    assert.deepEqual(tasksParsePort('bottom:25'), { side: 'bottom', offsetPct: 25 });
    assert.deepEqual(tasksParsePort('Left'), { side: 'left', offsetPct: 50 });
    assert.equal(tasksParsePort('centre'), null);
});

test('a residual edge enters its target through the left port, beside the block it skips', () => {
    const nodes = [
        rfNode('tap', { x: 106, y: 300, width: 8, height: 8 }, 'point'),
        rfNode('attention', { x: 0, y: 200, width: 220, height: 60 }),
        rfNode('norm', { x: 0, y: 140, width: 220, height: 44 }),
    ];
    const route = routeOf(tasksRouteEdges(nodes, [rfEdge('r', 'tap', 'norm', { target_port: 'left' })]), 'r');
    const end = route[route.length - 1];
    assert.deepEqual(end, { x: -3, y: 162 });
    assert.deepEqual(route[0], { x: 110, y: 304 }, 'starts at the point centre');
    assert.ok(route.every((point) => point.x <= 0 || point.y > 260), 'stays clear of the attention block');
});

test('edges out of one point share a trunk and end at their bottom ports', () => {
    const nodes = [rfNode('fork', { x: 106, y: 300, width: 8, height: 8 }, 'point'), rfNode('attention', { x: 0, y: 200, width: 220, height: 60 })];
    const edges = tasksRouteEdges(nodes, ['bottom:20', 'bottom:80'].map((port, index) => rfEdge(`q${index}`, 'fork', 'attention', { target_port: port })));
    const [left, right] = [routeOf(edges, 'q0'), routeOf(edges, 'q1')];
    assert.equal(left[1].y, right[1].y, 'both leave the fork on one horizontal run');
    assert.deepEqual([left.at(-1).x, right.at(-1).x], [44, 176]);
    assert.ok(left.at(-1).y > 260 && right.at(-1).y > 260);
});

test('an edge into a point meets its centre and draws no arrowhead', () => {
    const nodes = [rfNode('norm', { x: 0, y: 140, width: 220, height: 44 }), rfNode('tap', { x: 106, y: 40, width: 8, height: 8 }, 'point')];
    const [edge] = tasksRouteEdges(nodes, [rfEdge('in', 'norm', 'tap')]);
    assert.equal(edge.data.__head_off__, true);
    assert.deepEqual(edge.data.__route__.at(-1), { x: 110, y: 44 });
});

test('glyph looks size themselves; other looks take the layout width', () => {
    assert.deepEqual(tasksGlyphNodeSize('point', 'tap'), { width: 8, height: 8 });
    assert.deepEqual(tasksGlyphNodeSize('circle', '+'), { width: 36, height: 36 });
    assert.equal(tasksGlyphNodeSize('outline', 'Gate'), null);
    assert.equal(sizeTaskNode('+', 'task', 220, { look: 'circle' }).width, 36);
});

test('grid centres a glyph in its column, and a glyph-only column is narrow', () => {
    const nodes = place([
        { id: 'box', label: 'Attention', column: 'a', track: 'top' },
        { id: 'tap', label: 'tap', column: 'a', track: 'bottom', node_look: 'point' },
        { id: 'wave', label: '~', column: 'b', track: 'top', node_look: 'circle' },
    ]);
    assert.equal(nodes.tap.position.x + nodes.tap.width / 2, nodes.box.position.x + nodes.box.width / 2);
    assert.equal(nodes.wave.position.x - (nodes.box.position.x + nodes.box.width), 56 + 40 + 56);
});

test('grid draws a frame around each group, an outer frame around the inner one', () => {
    const { nodes } = buildGridTasksGraph({
        groups: [{ id: 'model', label: 'Model', dashed: 'true' }, { id: 'enc', label: 'Encoder', parent_group_id: 'model' }],
        tasks: [
            { id: 'in', label: 'Inputs', column: 'a', track: 'bottom', group_id: 'model' },
            { id: 'mha', label: 'Attention', column: 'a', track: 'top', group_id: 'enc' },
        ],
    }, view);
    const byId = Object.fromEntries(nodes.map((node) => [node.id, node]));
    const inner = byId.__frame_enc;
    const outer = byId.__frame_model;
    const contains = (frame, rect) => frame.position.x < rect.position.x && frame.position.y < rect.position.y
        && frame.position.x + frame.width > rect.position.x + rect.width && frame.position.y + frame.height > rect.position.y + rect.height;
    assert.equal(inner.__kind__, 'gridFrame');
    assert.ok(contains(inner, byId.mha) && !contains(inner, byId.in));
    assert.ok(contains(outer, inner) && contains(outer, byId.in));
    assert.ok(inner.__z__ > outer.__z__);
    assert.ok(TASKS_LAYOUTS.grid.chromeKinds.includes('gridFrame'));
});

// Two sibling stacks inside one outer frame, the shape of an encoder-decoder figure.
const stacks = {
    groups: [
        { id: 'model', label: 'Model', dashed: 'true' },
        { id: 'enc', label: 'Encoder', parent_group_id: 'model' },
        { id: 'dec', label: 'Decoder', parent_group_id: 'model' },
    ],
    tasks: [
        { id: 'in', label: 'Inputs', column: 'a', track: 'bottom', group_id: 'model' },
        { id: 'tap', label: 'tap', column: 'a', track: 'space', group_id: 'enc', node_look: 'point' },
        { id: 'norm', label: 'Add & Norm', column: 'a', track: 'top', group_id: 'enc' },
        { id: 'attn', label: 'Attention', column: 'b', track: 'top', group_id: 'dec' },
        { id: 'head', label: 'Linear', column: 'b', track: 'head', group_id: 'model' },
    ],
    dependency_edges: [{ id: 'r', source: 'tap', target: 'norm', target_port: 'left' }],
};
const stackView = { ...view, grid_row_order: 'head,top,space,bottom' };
const rectOf = (node) => ({ x: node.position.x, y: node.position.y, width: node.width, height: node.height });
const overlaps = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

test('no frame covers a node outside its group, whatever the title and ports need', () => {
    const { nodes } = buildGridTasksGraph(stacks, stackView);
    const frames = nodes.filter((node) => node.__kind__ === 'gridFrame');
    const members = (groupId) => {
        const groups = new Set([groupId]);
        stacks.groups.forEach(() => stacks.groups.forEach((group) => groups.has(group.parent_group_id) && groups.add(group.id)));
        return new Set(stacks.tasks.filter((task) => groups.has(task.group_id)).map((task) => task.id));
    };
    assert.equal(frames.length, 3);
    for (const frame of frames) {
        const own = members(frame.id.replace('__frame_', ''));
        for (const node of nodes.filter((item) => item.__kind__ === 'task' && !own.has(item.id))) {
            assert.ok(!overlaps(rectOf(frame), rectOf(node)), `${frame.id} covers ${node.id}`);
        }
    }
});

test('a residual route into a left port stays inside its frame', () => {
    const { nodes, edges } = buildGridTasksGraph(stacks, stackView);
    const rf = nodes.map((node) => ({ id: node.id, position: node.position, width: node.width, height: node.height, data: { __kind__: node.__kind__, __node_look__: node.node_look || 'outline' } }));
    const [edge] = tasksRouteEdges(rf, edges.map((item) => ({ ...item, data: { __edge_path__: 'orthogonal' } })));
    const frame = rectOf(nodes.find((node) => node.id === '__frame_enc'));
    assert.ok(edge.data.__route__.every((point) => point.x > frame.x && point.x < frame.x + frame.width));
});

test('a node inside a frame span but outside its group is reported, not covered', () => {
    const stray = { ...stacks, tasks: [...stacks.tasks, { id: 'nx', label: 'Nx', column: 'a', track: 'top', group_id: 'model' }] };
    assert.throws(() => buildGridTasksGraph(stray, stackView), /grid group enc spans node nx/);
});
