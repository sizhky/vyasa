// Fixed layouts. A layout places every node itself and skips ELK entirely.
//
// Each layout owns its own keys and validates them. There is deliberately no
// shared channel grammar: `layered_tier` and `matrix_row` both name a node
// attribute, but they mean different things, and a common `row=` would hide
// that. A layout that needs a new input adds it to its own `keys` list.
//
// A layout may emit more than one node per source node. It tags each one with
// `__source_node_id`, the same contract `build_projection_model` uses for a
// multi-valued group_by, so selection, colour, notes and slides all keep
// working on the logical node. The matrix layout relies on this.

// Relative, so the same specifier resolves in the browser and under node --test.
import { sizeTaskNode } from './tasks_graph_core.js';

// A fixed layout still has to make room for the words. Rather than guess, ask
// the same sizer the ordinary graph uses, pinning the width the layout owns and
// letting it report the height the label needs.
//
// `task` is the full card. `groupTitle` is the compact labelled box, which is
// what a matrix chip and a lifeline cap both are.
const labelHeight = (label, width, kind = 'task') => sizeTaskNode(String(label || ''), kind, width).height;

const TASKS_SEQUENCE_LANE_WIDTH = 196;
const TASKS_SEQUENCE_LANE_GAP = 102;
const TASKS_SEQUENCE_LEFT = 148;
const TASKS_SEQUENCE_LIFELINE_TOP = 40;
const TASKS_SEQUENCE_FIRST_ROW = 136;
const TASKS_SEQUENCE_ROW_HEIGHT = 46;

const TASKS_LAYERED_BAND_PAD = 148;
const TASKS_LAYERED_NODE_WIDTH = 168;
const TASKS_LAYERED_NODE_MIN_HEIGHT = 62;
const TASKS_LAYERED_GAP = 48;
const TASKS_LAYERED_LEFT = 168;
const TASKS_LAYERED_TOP = 40;
const TASKS_MATRIX_COL_WIDTH = 232;
const TASKS_MATRIX_ROW_HEIGHT = 172;
const TASKS_MATRIX_LEFT = 176;
const TASKS_MATRIX_TOP = 68;
const TASKS_MATRIX_CELL_PAD = 12;
const TASKS_MATRIX_CHIP_HEIGHT = 26;

// A call and its reply are one exchange drawn as one double harpoon. They pair
// when they carry the same `pair_by` value and run opposite ways; the one
// written first is the call. This is a view rule, not a layout rule, so every
// layout uses it and an unmatched value stays an ordinary edge.
//
// Both halves get the SAME lift. Each is offset along its own chord normal, and
// a reply's chord runs the other way, so one signed value puts them on opposite
// sides whatever direction the edge takes.
//
// The magnitude is HALF the pair stroke width (1.9), so each ribbon spans from
// the shared centreline out to its own full width and the two halves touch with
// no gap. A wider lift left a channel between them, and an exchange drawn with
// a channel down its middle reads as two lines rather than one double harpoon.
export const TASKS_PAIR_LIFT = -0.95;

export function tasksEdgePairs(edges, pairAttr) {
    const halves = new Map();
    if (!String(pairAttr || '').trim()) return halves;
    const calls = new Map();
    for (const edge of edges || []) {
        const key = String(edge?.[pairAttr] ?? '').trim();
        if (!key) continue;
        const call = calls.get(key);
        if (call && call.source === edge.target && call.target === edge.source) {
            halves.set(edge.id, { half: 'reply', mate: call.id });
            halves.set(call.id, { half: 'call', mate: edge.id });
            continue;
        }
        if (!call) calls.set(key, edge);
    }
    return halves;
}

// Both halves must be drawn between the same two points, or they bow apart and
// stop reading as one exchange. The anchor solver gives each edge its own
// handles, so a reply is re-anchored onto its call's two points.
export function tasksApplyEdgePairs(anchors, pairAttr, shareHandles = true) {
    const halves = tasksEdgePairs(anchors.edges, pairAttr);
    if (!halves.size) return anchors;
    const byId = new Map(anchors.edges.map((edge) => [edge.id, edge]));
    const nodeHandles = { ...(anchors.nodeHandles || {}) };
    const handleAt = (nodeId, role, id) => (nodeHandles[nodeId]?.[role] || []).find((handle) => handle.id === id);
    const addHandle = (nodeId, role, handle) => {
        const current = nodeHandles[nodeId] || { source: [], target: [] };
        if (current[role].some((item) => item.id === handle.id)) return;
        nodeHandles[nodeId] = { ...current, [role]: [...current[role], handle] };
    };
    const edges = anchors.edges.map((edge) => {
        const half = halves.get(edge.id);
        if (!half) return edge;
        const paired = {
            ...edge,
            __pair_half__: half.half,
            __pair_mate__: half.mate,
            __pair_lift__: TASKS_PAIR_LIFT,
        };
        const call = half.half === 'reply' ? byId.get(half.mate) : null;
        if (!shareHandles || !call) return paired;
        // A reply leaves where its call arrived and arrives where its call left.
        // It cannot reuse the call's handle ids: React Flow resolves a source id
        // among source handles only, so a borrowed target id finds nothing and
        // the edge never draws. Mint handles of the right role at the same two
        // points instead.
        const from = handleAt(call.target, 'target', call.targetHandle);
        const to = handleAt(call.source, 'source', call.sourceHandle);
        if (from) addHandle(call.target, 'source', { ...from, id: `${call.id}-pair-source` });
        if (to) addHandle(call.source, 'target', { ...to, id: `${call.id}-pair-target` });
        return {
            ...paired,
            ...(from ? { sourceHandle: `${call.id}-pair-source` } : {}),
            ...(to ? { targetHandle: `${call.id}-pair-target` } : {}),
        };
    });
    return { ...anchors, edges, nodeHandles };
}

function layoutAttrList(value) {
    return String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
}

function layoutAttrOf(node, attr) {
    return String(node?.[attr] ?? '').trim();
}

// A layout states what it needs. An authored key outside this list, or a
// declared attribute value the pack never uses, is a mistake worth naming
// rather than a silently empty diagram.
function requireLayoutAttr(layoutId, view, key) {
    const attr = String(view?.[key] || '').trim();
    if (!attr) throw new Error(`layout=${layoutId} needs ${key}=<attr>`);
    return attr;
}

// Sequence layout. A lifeline is just a very tall node: every participant is
// drawn exactly once, spanning the whole diagram, and each edge meets it at a
// handle whose offsetPct is that edge's row. Both ends of a row share one
// offset, so every arrow is horizontal. Row order is the order the edges are
// written in the view's edge source -- the pack states no step number, so
// declaration order is the only ordering the author gives.
export function buildSequenceTasksGraph(model, projection = {}) {
    const tasks = model.tasks || [];
    const byId = Object.fromEntries(tasks.map((task) => [task.id, task]));
    const taskOrder = Object.fromEntries(tasks.map((task, index) => [task.id, index]));
    const groups = model.groups || [];
    const groupParent = Object.fromEntries(groups.map((group) => [group.id, group.parent_group_id || null]));
    const groupOrder = Object.fromEntries(groups.map((group, index) => [group.id, index]));
    const groupLabel = Object.fromEntries(groups.map((group) => [group.id, group.label || group.id]));
    const roleAttr = String(projection.sequence_role || '').trim();
    const phaseAttr = String(projection.sequence_phase || '').trim();
    const pairAttr = String(projection.pair_by || model.pair_by || '').trim();

    const stageOf = (nodeId) => {
        let group = byId[nodeId]?.group_id || null;
        while (group && groupParent[group]) group = groupParent[group];
        return group;
    };

    const rows = (model.dependency_edges || []).filter((edge) => byId[edge.source] && byId[edge.target]);
    // One lane per participant, in authored order: stage first, then the order
    // the nodes are written inside that stage.
    const lanes = Array.from(new Set(rows.flatMap((edge) => [edge.source, edge.target]))).sort((left, right) => {
        const leftStage = groupOrder[stageOf(left)] ?? Number.MAX_SAFE_INTEGER;
        const rightStage = groupOrder[stageOf(right)] ?? Number.MAX_SAFE_INTEGER;
        return (leftStage - rightStage) || ((taskOrder[left] || 0) - (taskOrder[right] || 0));
    });
    const laneIndex = Object.fromEntries(lanes.map((id, index) => [id, index]));

    // A pair is one exchange, so it takes one row and one step number: the reply
    // is the value coming back, not a further step.
    const halves = tasksEdgePairs(rows, pairAttr);
    const rowOf = [];
    const isReply = [];
    const rowOfEdgeId = new Map();
    let rowCount = 0;
    rows.forEach((edge, index) => {
        const half = halves.get(edge.id);
        const callRow = half?.half === 'reply' ? rowOfEdgeId.get(half.mate) : undefined;
        if (callRow !== undefined) {
            rowOf[index] = callRow;
            isReply[index] = true;
            return;
        }
        rowOf[index] = rowCount;
        isReply[index] = false;
        rowOfEdgeId.set(edge.id, rowCount);
        rowCount += 1;
    });

    const bodyTop = TASKS_SEQUENCE_LIFELINE_TOP;
    const capWidth = TASKS_SEQUENCE_LANE_WIDTH - TASKS_SEQUENCE_LANE_GAP;
    // The first row starts below the deepest cap, so a three-line participant
    // name never sits on top of step one.
    const capHeight = Math.max(0, ...lanes.map((id) => labelHeight(byId[id].label || id, capWidth, 'groupTitle')));
    const firstRow = Math.max(TASKS_SEQUENCE_FIRST_ROW, bodyTop + capHeight + 34);
    const bodyHeight = (firstRow - bodyTop) + (rowCount + 1) * TASKS_SEQUENCE_ROW_HEIGHT;
    const rowY = (index) => firstRow + index * TASKS_SEQUENCE_ROW_HEIGHT;
    const offsetPct = (index) => ((rowY(index) - bodyTop) / bodyHeight) * 100;

    const handles = {};
    const addHandle = (nodeId, role, handle) => {
        handles[nodeId] = handles[nodeId] || { source: [], target: [] };
        handles[nodeId][role].push(handle);
    };

    const bands = [];
    let step = 0;
    const edges = rows.map((edge, index) => {
        const role = roleAttr ? String(edge[roleAttr] || '').trim().toLowerCase() : '';
        // A standing edge is a rule that already holds. It never takes a turn,
        // so it carries no step number.
        const standing = role === 'standing';
        const reply = isReply[index];
        const row = rowOf[index];
        if (!standing && !reply) step += 1;
        const rightward = (laneIndex[edge.target] ?? 0) > (laneIndex[edge.source] ?? 0);
        const sourceSide = rightward ? 'right' : 'left';
        const targetSide = rightward ? 'left' : 'right';
        const sourceHandle = `seq-source-${sourceSide}-${index}`;
        const targetHandle = `seq-target-${targetSide}-${index}`;
        addHandle(edge.source, 'source', { id: sourceHandle, side: sourceSide, offsetPct: offsetPct(row) });
        addHandle(edge.target, 'target', { id: targetHandle, side: targetSide, offsetPct: offsetPct(row) });
        // A reply sits on a row its call already opened, so it never starts a band.
        if (!reply) {
            const phase = phaseAttr ? String(edge[phaseAttr] || '').trim() : '';
            const open = bands[bands.length - 1];
            if (open && open.phase === phase) open.bottom = rowY(row);
            else bands.push({ phase, top: rowY(row), bottom: rowY(row) });
        }
        const half = halves.get(edge.id)?.half || '';
        return {
            ...edge,
            id: `seq-${index}`,
            sourceHandle,
            targetHandle,
            __sequence_step__: standing || reply ? '' : String(step),
            __sequence_standing__: standing,
            __pair_half__: half,
            __pair_lift__: half ? TASKS_PAIR_LIFT : 0,
        };
    });

    const nodes = lanes.map((id) => ({
        ...byId[id],
        id,
        __kind__: 'task',
        __sequence_lifeline__: true,
        __fixed_size__: true,
        __sequence_stage__: groupLabel[stageOf(id)] || '',
        label: byId[id].label || id,
        position: { x: TASKS_SEQUENCE_LEFT + laneIndex[id] * TASKS_SEQUENCE_LANE_WIDTH, y: bodyTop },
        width: TASKS_SEQUENCE_LANE_WIDTH - TASKS_SEQUENCE_LANE_GAP,
        height: bodyHeight,
        handleLayout: handles[id] || { source: [], target: [] },
    }));

    const bodyWidth = TASKS_SEQUENCE_LEFT + lanes.length * TASKS_SEQUENCE_LANE_WIDTH;
    bands.forEach((band, index) => {
        nodes.unshift({
            id: `__seq_phase_${index}`,
            label: band.phase,
            __kind__: 'sequencePhase',
            __sequence_band_odd__: index % 2 === 1,
            __sequence_phase_attr__: phaseAttr,
            __fixed_size__: true,
            __z__: 0,
            position: { x: 8, y: band.top - TASKS_SEQUENCE_ROW_HEIGHT / 2 },
            width: Math.max(240, bodyWidth - 8),
            height: (band.bottom - band.top) + TASKS_SEQUENCE_ROW_HEIGHT,
        });
    });
    return { nodes, edges };
}

// Layered layout. A node's y is its tier and nothing else, so an edge's
// direction carries meaning on its own: down is the request going in, up is
// the answer coming back. Values named by `layered_aside` leave the ladder for
// a band down the right, because a cross-cutting concern on a rung makes the
// rung lie.
export function buildLayeredTasksGraph(model, projection = {}) {
    const tierAttr = requireLayoutAttr('layered', projection, 'layered_tier');
    const order = layoutAttrList(projection.layered_order);
    const aside = new Set(layoutAttrList(projection.layered_aside));
    const tasks = model.tasks || [];
    const known = new Set([...order, ...aside]);
    const missing = Array.from(new Set(tasks.map((task) => layoutAttrOf(task, tierAttr))))
        .filter((value) => value && !known.has(value));
    if (order.length && missing.length) {
        throw new Error(`layout=layered has no band for ${tierAttr}=${missing.join(', ')}`);
    }
    const rungs = order.length ? order : Array.from(new Set(tasks.map((task) => layoutAttrOf(task, tierAttr)))).filter((value) => !aside.has(value));
    const rungIndex = Object.fromEntries(rungs.map((value, index) => [value, index]));
    const rows = rungs.map(() => []);
    const asideRow = [];
    for (const task of tasks) {
        const value = layoutAttrOf(task, tierAttr);
        if (aside.has(value)) asideRow.push(task);
        else if (value in rungIndex) rows[rungIndex[value]].push(task);
    }
    const heightOf = (task) => Math.max(
        TASKS_LAYERED_NODE_MIN_HEIGHT,
        labelHeight(task.label || task.id, TASKS_LAYERED_NODE_WIDTH),
    );
    // A band is as tall as the longest label on its rung, so nothing clips and
    // the rungs below simply start lower.
    const rungHeight = rows.map((row) => Math.max(TASKS_LAYERED_NODE_MIN_HEIGHT, ...row.map(heightOf)));
    const bandHeight = rungHeight.map((height) => height + TASKS_LAYERED_BAND_PAD);
    const bandTop = bandHeight.map((_, index) => TASKS_LAYERED_TOP + bandHeight.slice(0, index).reduce((sum, value) => sum + value, 0));
    const asideHeights = asideRow.map(heightOf);
    const widest = Math.max(1, ...rows.map((row) => row.length));
    const bodyWidth = TASKS_LAYERED_LEFT + widest * (TASKS_LAYERED_NODE_WIDTH + TASKS_LAYERED_GAP) + TASKS_LAYERED_GAP;
    const asideLeft = bodyWidth + TASKS_LAYERED_GAP;
    const bodyHeight = bandHeight.reduce((sum, value) => sum + value, 0);

    const nodes = [];
    rungs.forEach((value, index) => {
        nodes.push({
            id: `__tier_${index}`,
            label: value,
            __kind__: 'layeredBand',
            __layered_value__: value,
            __layered_attr__: tierAttr,
            __fixed_size__: true,
            __z__: 0,
            position: { x: 8, y: bandTop[index] - 20 },
            width: asideLeft + TASKS_LAYERED_NODE_WIDTH + TASKS_LAYERED_GAP,
            height: bandHeight[index] - 12,
        });
    });
    if (asideRow.length) {
        nodes.push({
            id: '__tier_aside',
            label: Array.from(aside).join(', '),
            __kind__: 'layeredBand',
            __layered_value__: Array.from(aside)[0] || '',
            __layered_attr__: tierAttr,
            __layered_aside__: true,
            __fixed_size__: true,
            __z__: 0,
            position: { x: asideLeft - TASKS_LAYERED_GAP, y: TASKS_LAYERED_TOP - 34 },
            width: TASKS_LAYERED_NODE_WIDTH + TASKS_LAYERED_GAP * 2,
            height: Math.max(
                bodyHeight,
                asideHeights.reduce((sum, value) => sum + value + TASKS_LAYERED_GAP, 0),
            ) + 24,
        });
    }
    rows.forEach((row, tier) => {
        row.forEach((task, column) => {
            nodes.push({
                ...task,
                __kind__: 'task',
                __fixed_size__: true,
                position: {
                    x: TASKS_LAYERED_LEFT + column * (TASKS_LAYERED_NODE_WIDTH + TASKS_LAYERED_GAP),
                    y: bandTop[tier] + 34,
                },
                width: TASKS_LAYERED_NODE_WIDTH,
                height: heightOf(task),
            });
        });
    });
    asideRow.forEach((task, index) => {
        nodes.push({
            ...task,
            __kind__: 'task',
            __fixed_size__: true,
            position: {
                x: asideLeft,
                y: TASKS_LAYERED_TOP + asideHeights.slice(0, index).reduce((sum, value) => sum + value + TASKS_LAYERED_GAP, 0) + 6,
            },
            width: TASKS_LAYERED_NODE_WIDTH,
            height: asideHeights[index],
        });
    });
    const placed = new Set(nodes.filter((node) => node.__kind__ === 'task').map((node) => node.id));
    const edges = (model.dependency_edges || [])
        .filter((edge) => placed.has(edge.source) && placed.has(edge.target))
        .map((edge, index) => ({ ...edge, id: edge.id || `layered-${index}` }));
    return { nodes, edges };
}

// Matrix layout. Columns come from a node attribute, rows from an edge
// attribute, and a node lands in a cell when one of its edges carries that row
// value. The two keys deliberately do not share a name: they read different
// records, and calling both of them row/col of one grammar would hide that.
//
// A node touched by three flows is drawn three times. That duplication is the
// message here, not a defect: it is the answer to "what does this flow touch".
// Each copy carries __source_node_id, so selecting one selects the node.
//
// Edges are drawn between placements in the same row. The reader can hide them
// with the ordinary edge toggle when the cells alone are enough.
export function buildMatrixTasksGraph(model, projection = {}) {
    const colAttr = requireLayoutAttr('matrix', projection, 'matrix_col');
    const rowAttr = requireLayoutAttr('matrix', projection, 'matrix_row');
    const byId = Object.fromEntries((model.tasks || []).map((task) => [task.id, task]));
    const declaredCols = layoutAttrList(projection.matrix_col_order);
    const colValues = declaredCols.length
        ? declaredCols
        : Array.from(new Set((model.tasks || []).map((task) => layoutAttrOf(task, colAttr)).filter(Boolean)));
    // How strongly each axis washes a cell, as a percentage. Two washes at this
    // strength compose into a third colour at every intersection.
    const tint = Math.max(0, Math.min(50, Number(projection.matrix_tint) || 14));
    const rowValues = [];
    const cells = new Map();
    for (const edge of model.dependency_edges || []) {
        const row = layoutAttrOf(edge, rowAttr);
        if (!row) continue;
        if (!rowValues.includes(row)) rowValues.push(row);
        for (const nodeId of [edge.source, edge.target]) {
            const task = byId[nodeId];
            if (!task) continue;
            const col = layoutAttrOf(task, colAttr);
            if (!col || !colValues.includes(col)) continue;
            const key = `${col} ${row}`;
            if (!cells.has(key)) cells.set(key, []);
            const bucket = cells.get(key);
            if (!bucket.some((entry) => entry.id === nodeId)) bucket.push(task);
        }
    }
    const chipWidth = TASKS_MATRIX_COL_WIDTH - 8 - TASKS_MATRIX_CELL_PAD * 2;
    const chipHeight = (task) => Math.max(
        TASKS_MATRIX_CHIP_HEIGHT,
        labelHeight(task.label || task.id, chipWidth, 'groupTitle'),
    );
    // A cell is as tall as its members stacked, and a row as tall as its fullest
    // cell, so a long label pushes the row down instead of spilling out of it.
    const cellHeight = (col, row) => {
        const members = cells.get(`${col} ${row}`) || [];
        return members.reduce((sum, task) => sum + chipHeight(task) + 6, 0) - (members.length ? 6 : 0);
    };
    const rowHeights = rowValues.map((row) => Math.max(
        TASKS_MATRIX_ROW_HEIGHT,
        Math.max(0, ...colValues.map((col) => cellHeight(col, row))) + TASKS_MATRIX_CELL_PAD * 2 + 8,
    ));
    const rowTop = rowHeights.map((_, index) => TASKS_MATRIX_TOP + rowHeights.slice(0, index).reduce((sum, value) => sum + value, 0));

    const nodes = [];
    colValues.forEach((col, index) => {
        nodes.push({
            id: `__matrix_col_${index}`,
            label: col,
            __kind__: 'matrixHeader',
            __matrix_attr__: colAttr,
            __matrix_axis__: 'col',
            __matrix_tint__: tint,
            __fixed_size__: true,
            __z__: 0,
            position: { x: TASKS_MATRIX_LEFT + index * TASKS_MATRIX_COL_WIDTH, y: 16 },
            width: TASKS_MATRIX_COL_WIDTH - 8,
            height: 40,
        });
    });
    rowValues.forEach((row, index) => {
        nodes.push({
            id: `__matrix_row_${index}`,
            label: row,
            __kind__: 'matrixHeader',
            __matrix_attr__: rowAttr,
            __matrix_axis__: 'row',
            __matrix_tint__: tint,
            __matrix_row_header__: true,
            __fixed_size__: true,
            __z__: 0,
            position: { x: 8, y: rowTop[index] + 8 },
            width: TASKS_MATRIX_LEFT - 20,
            height: 40,
        });
    });
    colValues.forEach((col, colIndex) => {
        rowValues.forEach((row, rowIndex) => {
            const members = cells.get(`${col} ${row}`) || [];
            const x = TASKS_MATRIX_LEFT + colIndex * TASKS_MATRIX_COL_WIDTH;
            nodes.push({
                id: `__matrix_cell_${colIndex}_${rowIndex}`,
                label: '',
                __kind__: 'matrixCell',
                __matrix_empty__: members.length === 0,
                __matrix_col_attr__: colAttr,
                __matrix_col_value__: col,
                __matrix_row_attr__: rowAttr,
                __matrix_row_value__: row,
                __matrix_tint__: tint,
                __fixed_size__: true,
                __z__: 0,
                position: { x, y: rowTop[rowIndex] },
                width: TASKS_MATRIX_COL_WIDTH - 8,
                height: rowHeights[rowIndex] - 8,
            });
            let stackY = rowTop[rowIndex] + TASKS_MATRIX_CELL_PAD;
            members.forEach((task) => {
                const height = chipHeight(task);
                nodes.push({
                    ...task,
                    // One placement per cell. The logical node is __source_node_id.
                    id: `${task.id}__${colIndex}_${rowIndex}`,
                    __source_node_id: task.id,
                    __kind__: 'task',
                    __fixed_size__: true,
                    position: { x: x + TASKS_MATRIX_CELL_PAD, y: stackY },
                    width: chipWidth,
                    height,
                });
                stackY += height + 6;
            });
        });
    });
    // An edge carries exactly one row value, so it joins its two endpoints
    // inside that row and nowhere else. Arrows therefore stay in their band and
    // run column to column, which is the reading the matrix is for.
    const placementId = (nodeId, rowIndex) => {
        const colIndex = colValues.indexOf(layoutAttrOf(byId[nodeId], colAttr));
        return colIndex < 0 ? '' : `${nodeId}__${colIndex}_${rowIndex}`;
    };
    const edges = (model.dependency_edges || []).map((edge) => {
        if (!byId[edge.source] || !byId[edge.target]) return null;
        const rowIndex = rowValues.indexOf(layoutAttrOf(edge, rowAttr));
        if (rowIndex < 0) return null;
        const source = placementId(edge.source, rowIndex);
        const target = placementId(edge.target, rowIndex);
        return source && target ? { ...edge, source, target } : null;
    }).filter(Boolean);
    return { nodes, edges };
}

export const TASKS_LAYOUTS = {
    sequence: {
        id: 'sequence',
        label: 'Sequence',
        keys: ['sequence_role', 'sequence_phase'],
        chromeKinds: ['sequencePhase'],
        authoredHandles: true,
        edgesOverNodes: true,
        build: buildSequenceTasksGraph,
    },
    layered: {
        id: 'layered',
        label: 'Layered',
        keys: ['layered_tier', 'layered_order', 'layered_aside'],
        chromeKinds: ['layeredBand'],
        authoredHandles: false,
        // Bands and cards are the picture here, so an arrow stays behind them.
        edgesOverNodes: false,
        build: buildLayeredTasksGraph,
    },
    matrix: {
        id: 'matrix',
        label: 'Matrix',
        keys: ['matrix_col', 'matrix_row', 'matrix_col_order', 'matrix_tint'],
        chromeKinds: ['matrixHeader', 'matrixCell'],
        authoredHandles: false,
        edgesOverNodes: false,
        build: buildMatrixTasksGraph,
    },
};

export function tasksLayoutById(layoutId) {
    return TASKS_LAYOUTS[String(layoutId || '').trim().toLowerCase()] || null;
}

export function tasksLayoutChromeKinds() {
    return new Set(Object.values(TASKS_LAYOUTS).flatMap((layout) => layout.chromeKinds));
}
