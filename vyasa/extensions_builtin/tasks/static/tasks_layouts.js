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

const TASKS_SEQUENCE_LANE_WIDTH = 196;
const TASKS_SEQUENCE_LANE_GAP = 102;
const TASKS_SEQUENCE_LEFT = 148;
const TASKS_SEQUENCE_LIFELINE_TOP = 40;
const TASKS_SEQUENCE_FIRST_ROW = 136;
const TASKS_SEQUENCE_ROW_HEIGHT = 46;
const TASKS_LAYERED_BAND_HEIGHT = 210;
const TASKS_LAYERED_NODE_WIDTH = 168;
const TASKS_LAYERED_NODE_HEIGHT = 62;
const TASKS_LAYERED_GAP = 48;
const TASKS_LAYERED_LEFT = 168;
const TASKS_LAYERED_TOP = 40;
const TASKS_MATRIX_COL_WIDTH = 232;
const TASKS_MATRIX_ROW_HEIGHT = 172;
const TASKS_MATRIX_LEFT = 176;
const TASKS_MATRIX_TOP = 68;
const TASKS_MATRIX_CELL_PAD = 12;
const TASKS_MATRIX_CHIP_HEIGHT = 26;

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

    const bodyTop = TASKS_SEQUENCE_LIFELINE_TOP;
    const bodyHeight = (TASKS_SEQUENCE_FIRST_ROW - bodyTop) + (rows.length + 1) * TASKS_SEQUENCE_ROW_HEIGHT;
    const rowY = (index) => TASKS_SEQUENCE_FIRST_ROW + index * TASKS_SEQUENCE_ROW_HEIGHT;
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
        if (!standing) step += 1;
        const rightward = (laneIndex[edge.target] ?? 0) > (laneIndex[edge.source] ?? 0);
        const sourceSide = rightward ? 'right' : 'left';
        const targetSide = rightward ? 'left' : 'right';
        const sourceHandle = `seq-source-${sourceSide}-${index}`;
        const targetHandle = `seq-target-${targetSide}-${index}`;
        addHandle(edge.source, 'source', { id: sourceHandle, side: sourceSide, offsetPct: offsetPct(index) });
        addHandle(edge.target, 'target', { id: targetHandle, side: targetSide, offsetPct: offsetPct(index) });
        const phase = phaseAttr ? String(edge[phaseAttr] || '').trim() : '';
        const open = bands[bands.length - 1];
        if (open && open.phase === phase) open.bottom = rowY(index);
        else bands.push({ phase, top: rowY(index), bottom: rowY(index) });
        return {
            ...edge,
            id: `seq-${index}`,
            sourceHandle,
            targetHandle,
            __sequence_step__: standing ? '' : String(step),
            __sequence_standing__: standing,
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
    const widest = Math.max(1, ...rows.map((row) => row.length));
    const bodyWidth = TASKS_LAYERED_LEFT + widest * (TASKS_LAYERED_NODE_WIDTH + TASKS_LAYERED_GAP) + TASKS_LAYERED_GAP;
    const asideLeft = bodyWidth + TASKS_LAYERED_GAP;
    const bodyHeight = rungs.length * TASKS_LAYERED_BAND_HEIGHT;

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
            position: { x: 8, y: TASKS_LAYERED_TOP + index * TASKS_LAYERED_BAND_HEIGHT - 20 },
            width: asideLeft + TASKS_LAYERED_NODE_WIDTH + TASKS_LAYERED_GAP,
            height: TASKS_LAYERED_BAND_HEIGHT - 12,
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
            height: Math.max(bodyHeight, asideRow.length * (TASKS_LAYERED_NODE_HEIGHT + TASKS_LAYERED_GAP)) + 24,
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
                    y: TASKS_LAYERED_TOP + tier * TASKS_LAYERED_BAND_HEIGHT + 34,
                },
                width: TASKS_LAYERED_NODE_WIDTH,
                height: TASKS_LAYERED_NODE_HEIGHT,
            });
        });
    });
    asideRow.forEach((task, index) => {
        nodes.push({
            ...task,
            __kind__: 'task',
            __fixed_size__: true,
            position: { x: asideLeft, y: TASKS_LAYERED_TOP + index * (TASKS_LAYERED_NODE_HEIGHT + TASKS_LAYERED_GAP) + 6 },
            width: TASKS_LAYERED_NODE_WIDTH,
            height: TASKS_LAYERED_NODE_HEIGHT,
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
export function buildMatrixTasksGraph(model, projection = {}) {
    const colAttr = requireLayoutAttr('matrix', projection, 'matrix_col');
    const rowAttr = requireLayoutAttr('matrix', projection, 'matrix_row');
    const byId = Object.fromEntries((model.tasks || []).map((task) => [task.id, task]));
    const declaredCols = layoutAttrList(projection.matrix_col_order);
    const colValues = declaredCols.length
        ? declaredCols
        : Array.from(new Set((model.tasks || []).map((task) => layoutAttrOf(task, colAttr)).filter(Boolean)));
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
    // A row is as tall as its fullest cell, so no cell ever clips its members.
    const rowHeights = rowValues.map((row) => {
        const deepest = Math.max(0, ...colValues.map((col) => (cells.get(`${col} ${row}`) || []).length));
        return Math.max(TASKS_MATRIX_ROW_HEIGHT, deepest * (TASKS_MATRIX_CHIP_HEIGHT + 6) + TASKS_MATRIX_CELL_PAD * 2 + 8);
    });
    const rowTop = rowHeights.map((_, index) => TASKS_MATRIX_TOP + rowHeights.slice(0, index).reduce((sum, value) => sum + value, 0));

    const nodes = [];
    colValues.forEach((col, index) => {
        nodes.push({
            id: `__matrix_col_${index}`,
            label: col,
            __kind__: 'matrixHeader',
            __matrix_attr__: colAttr,
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
                __fixed_size__: true,
                __z__: 0,
                position: { x, y: rowTop[rowIndex] },
                width: TASKS_MATRIX_COL_WIDTH - 8,
                height: rowHeights[rowIndex] - 8,
            });
            members.forEach((task, memberIndex) => {
                nodes.push({
                    ...task,
                    // One placement per cell. The logical node is __source_node_id.
                    id: `${task.id}__${colIndex}_${rowIndex}`,
                    __source_node_id: task.id,
                    __kind__: 'task',
                    __fixed_size__: true,
                    position: {
                        x: x + TASKS_MATRIX_CELL_PAD,
                        y: rowTop[rowIndex] + TASKS_MATRIX_CELL_PAD + memberIndex * (TASKS_MATRIX_CHIP_HEIGHT + 6),
                    },
                    width: TASKS_MATRIX_COL_WIDTH - 8 - TASKS_MATRIX_CELL_PAD * 2,
                    height: TASKS_MATRIX_CHIP_HEIGHT,
                });
            });
        });
    });
    // No arrows. A node's cell is the adjacency, so drawing edges would say the
    // same thing twice and cross every column doing it.
    return { nodes, edges: [] };
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
        keys: ['matrix_col', 'matrix_row', 'matrix_col_order'],
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
