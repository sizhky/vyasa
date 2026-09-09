import { logTasksDebug, logTasksDebugVerbose, rectSummary } from './tasks_diagnostics.js';
import {
    layoutDisconnectedTaskNodes, packTaskChildRects, resolveTasksNodeImage, sizeTaskNode,
    tasksExpandedRootRect,
} from './tasks_graph_core.js';
import {
    TASKS_LAYOUT_ERROR_MODE, appendProjectedEdge, buildGanttTasksGraph, buildLayoutErrorGraph,
    buildTasksGroupedState, buildTasksUngroupedState, buildVisibleTasksGraph, reduceTransitiveEdges,
    selectTasksProjectionState, tasksGroupByPrefsDifferFromSchema, tasksModelNodeLabels, tasksProjectionById,
    tasksProjectionLayout, tasksReferenceEdges,
} from './tasks_graph_model.js';

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
// The bar is as wide as the lane, so an arrow leaving or arriving at that lane
// lands on the bar's own edge. A hairline bar down the middle touched no arrow
// and read as an artifact rather than as an open frame.
// An activation bar opened while another is still open on the same lane insets
// by this much per side, which is the only way to nest without leaving the lane.
const TASKS_SEQUENCE_ACTIVATION_INSET = 7;
// An activation bar is UML's ExecutionSpecification: the stretch of a lifeline
// during which one call is still running. It clears its opening arrow by this
// many pixels, so that arrow reads as a row inside the bar rather than as its
// border. Flush on the row, the arrow and the border were one line.
const TASKS_SEQUENCE_ACTIVATION_PAD = 9;
// The reply that closes a bar keeps a row of its own so the bar has height, but
// it draws no line: its label sits back beside its call and the bar's own bottom
// border is where the reply leaves.
//
// So this gap IS the bar's bottom padding, measured from the last arrow the
// reader can actually see. It has to equal the top pad, or the bar looks
// bottom-heavy against an edge that is not drawn.
const TASKS_SEQUENCE_REPLY_GAP = TASKS_SEQUENCE_ACTIVATION_PAD;
// An activation bar sits above the lifeline column and below the arrows: the
// sequence layout draws edges over nodes, so nothing is hidden.
const TASKS_SEQUENCE_ACTIVATION_Z = 1001;

// A combined fragment is UML's box for anything that is not one straight run of
// rows: `alt` a branch, `opt` a single guarded branch, `loop`, `par`, `break`,
// and `ref` a pointer at another interaction drawn elsewhere.
//
// The operator is the text before the colon, so `fragment=alt:cache` reads as
// the alt named cache, and two alts written back to back stay two boxes instead
// of merging. A box covers a CONTIGUOUS run of rows, which is the same rule the
// phase bands already use, so no row ever has to name where a box ends.
//
// Nesting is a `/` path written outer first, `alt:auth/loop:retry`. Depth insets
// the box on all four sides, the same trick the activation bars use, so an inner
// frame is visibly inside its parent rather than merely overlapping it.
const TASKS_SEQUENCE_FRAGMENT_PAD = 22;
const TASKS_SEQUENCE_FRAGMENT_INSET = 9;
// Every box gets a header line of its own above its first arrow, and a row that
// opens three boxes gets three of them. Sharing the half-row above an arrow was
// what made a stack of one-row fragments read as a pile of chips: the tag, the
// guard and the arrow were all fighting for the same 23 pixels.
const TASKS_SEQUENCE_FRAGMENT_HEADER = 22;
// Over the activation bars. The box is transparent, so only its border and its
// corner tag land on a bar, and that tag is the one thing that must stay
// readable: a bar drawn over it hid which operator the box was.
const TASKS_SEQUENCE_FRAGMENT_Z = 1002;

// Where the boxes go, worked out BEFORE the rows are placed, because a box needs
// vertical room that the rows themselves have to make.
//
// A box covers a contiguous run of rows. It opens when its path appears and
// closes when that run ends, so no row states where a box stops. Nesting is a
// `/` path written outer first, and a header line is claimed per level, ordered
// outermost first, so a parent's tag always sits above its child's.
// What each operator promises. A fragment has no node in the pack to hang a
// description on, so the card states the rule the operator carries in UML rather
// than leaving the reader to recognise a three-letter tag.
const TASKS_SEQUENCE_FRAGMENT_MEANING = {
    alt: 'Exactly one operand runs. The guards decide which, and an unguarded operand is the else.',
    opt: 'One operand that runs only when its guard holds. Nothing runs otherwise.',
    loop: 'The rows inside repeat while the guard holds.',
    par: 'The operands run concurrently. Order between them is not stated.',
    break: 'The rows inside run instead of the rest of the enclosing interaction, which is abandoned.',
    ref: 'A pointer at an interaction told in full somewhere else.',
    critical: 'The rows inside run without interleaving.',
    neg: 'The rows inside describe a trace that must not happen.',
    assert: 'The rows inside are the only valid continuation.',
};

// The corner tag is the only part of a fragment the pointer can hit. Its width
// has to be known here as well as in the renderer, because the hit rect is
// geometry and the layout owns geometry.
const TASKS_SEQUENCE_FRAGMENT_TAG_HEIGHT = 20;
function sequenceFragmentTagWidth(operator) {
    return 22 + String(operator || '').length * 7;
}

function planSequenceFragments(rowCount, rowFragment, rowOperand, rowLanes, rowOperandNote = []) {
    const boxes = [];
    const headerRows = Array.from({ length: rowCount }, () => []);
    let open = [];
    for (let row = 0; row < rowCount; row += 1) {
        const path = tasksSequenceFragmentPath(rowFragment[row]);
        let shared = 0;
        while (shared < open.length && shared < path.length && open[shared].key === path[shared].key) shared += 1;
        open = open.slice(0, shared);
        for (let depth = shared; depth < path.length; depth += 1) {
            const box = { ...path[depth], depth, top: row, bottom: row, lanes: [], operands: [], header: null };
            box.header = { box, row, guard: '' };
            boxes.push(box);
            open.push(box);
            headerRows[row].push(box.header);
        }
        // A guard that changes inside one box starts the next operand. An `alt`
        // with no guards is still one operand, so the box draws no separator
        // rather than a line per row.
        //
        // The guard belongs to the OUTERMOST box that carries it. A nested box
        // sits inside ONE operand of its parent, so repeating the text there
        // printed the same `[else]` once per level.
        const guard = rowOperand[row];
        let claimed = false;
        for (const box of open) {
            box.bottom = row;
            box.lanes.push(...rowLanes[row]);
            const owns = Boolean(guard) && !claimed;
            const last = box.operands[box.operands.length - 1];
            if (last && last.guard === (owns ? guard : '')) {
                // An operand runs over several rows and the note may be written
                // on any of them, so the first one that carries it wins.
                if (owns && !last.note) last.note = rowOperandNote[row] || '';
                claimed = claimed || owns;
                continue;
            }
            const operand = { guard: owns ? guard : '', note: owns ? (rowOperandNote[row] || '') : '', row, header: null };
            box.operands.push(operand);
            claimed = claimed || owns;
            if (!owns) continue;
            if (box.top === row) {
                // The first operand shares the line the box opened on.
                box.header.guard = guard;
                operand.header = box.header;
            } else {
                operand.header = { box, row, guard };
                headerRows[row].push(operand.header);
            }
        }
    }
    // Outermost first, so a parent header never lands under its own child's.
    headerRows.forEach((list) => {
        list.sort((left, right) => left.box.depth - right.box.depth);
        list.forEach((header, index) => { header.slot = index; });
    });
    return { boxes, headerCounts: headerRows.map((list) => list.length) };
}

export function tasksSequenceFragmentPath(value) {
    return String(value || '')
        .split('/')
        .map((segment) => segment.trim())
        .filter(Boolean)
        .map((segment) => {
            const at = segment.indexOf(':');
            const operator = (at < 0 ? segment : segment.slice(0, at)).trim().toLowerCase();
            const name = at < 0 ? '' : segment.slice(at + 1).trim();
            return { key: `${operator}:${name}`, operator, name };
        });
}

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
    // Lane order is otherwise the order nodes are written in the pack, which is
    // one global fact that two stories can need differently: a node introduced
    // by an earlier story lands far left in a later one, and every arrow to it
    // then runs backwards. A view states its own order instead.
    const authoredLanes = layoutAttrList(projection.sequence_lanes);
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
    // UML message kinds. Declaring the attribute is the opt-in: a view that names
    // one asks for UML arrowheads, where a reply is dashed with an open head and
    // `async` gets an open head on a solid line. A view that names none keeps the
    // double harpoon every existing pack was authored against.
    const messageAttr = String(projection.sequence_message || '').trim();
    const fragmentAttr = String(projection.sequence_fragment || '').trim();
    const operandAttr = String(projection.sequence_operand || '').trim();
    // A guard is short by design -- it has to fit beside the corner tag. The
    // sentence saying what this branch actually does in the system has nowhere
    // to go on the box, so it is authored separately and read on the card.
    const operandNoteAttr = String(projection.sequence_operand_note || '').trim();
    // UML carries call nesting in the activation bar, not in the step number.
    // Opt-in, because a bar needs the reply placed below whatever the call
    // opened, and a pair drawn on one row is the compact reading every existing
    // view was authored for.
    const activation = ['1', 'true', 'yes', 'on'].includes(String(projection.sequence_activation || '').trim().toLowerCase());

    const stageOf = (nodeId) => {
        let group = byId[nodeId]?.group_id || null;
        while (group && groupParent[group]) group = groupParent[group];
        return group;
    };

    const rows = (model.dependency_edges || []).filter((edge) => byId[edge.source] && byId[edge.target]);
    // One lane per participant, in authored order: stage first, then the order
    // the nodes are written inside that stage.
    const participants = Array.from(new Set(rows.flatMap((edge) => [edge.source, edge.target])));
    const strayLanes = authoredLanes.filter((id) => !participants.includes(id));
    if (strayLanes.length) {
        throw new Error(`layout=sequence has no lane for sequence_lanes=${strayLanes.join(', ')}`);
    }
    // An authored lane keeps its stated position; anything unnamed follows in
    // the order it was already in, so naming one lane does not reorder the rest.
    const authoredAt = new Map(authoredLanes.map((id, index) => [id, index]));
    const lanes = participants.sort((left, right) => {
        const leftAt = authoredAt.get(left);
        const rightAt = authoredAt.get(right);
        if (leftAt !== undefined || rightAt !== undefined) {
            return (leftAt ?? Number.MAX_SAFE_INTEGER) - (rightAt ?? Number.MAX_SAFE_INTEGER);
        }
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
    const replyRowOfCallId = new Map();
    // Both halves of a pair whose reply left the call's row. They stop hugging,
    // because a lift only reads as one exchange when the two lines are adjacent.
    const detached = new Set();
    let rowCount = 0;
    rows.forEach((edge, index) => {
        const half = halves.get(edge.id);
        const callRow = half?.half === 'reply' ? rowOfEdgeId.get(half.mate) : undefined;
        if (callRow !== undefined) {
            isReply[index] = true;
            // A reply that closes over nested rows has to sit below them, or the
            // bar for the still-open call would have no height to occupy.
            const nested = activation && rowCount - 1 > callRow;
            rowOf[index] = nested ? rowCount : callRow;
            if (nested) {
                rowCount += 1;
                detached.add(edge.id);
                detached.add(half.mate);
            }
            replyRowOfCallId.set(half.mate, rowOf[index]);
            return;
        }
        rowOf[index] = rowCount;
        isReply[index] = false;
        rowOfEdgeId.set(edge.id, rowCount);
        rowCount += 1;
    });

    // A fragment is a property of the ROW, not of one arrow: everything drawn on
    // that row is inside the same branch or loop. Collect the row's value from
    // whichever half wrote one, so an author can put `fragment=` on the call and
    // leave the reply bare.
    const rowFragment = Array.from({ length: rowCount }, () => '');
    const rowOperand = Array.from({ length: rowCount }, () => '');
    const rowOperandNote = Array.from({ length: rowCount }, () => '');
    const rowLanes = Array.from({ length: rowCount }, () => []);
    rows.forEach((edge, index) => {
        const row = rowOf[index];
        if (fragmentAttr && !rowFragment[row]) rowFragment[row] = String(edge[fragmentAttr] ?? '').trim();
        if (operandAttr && !rowOperand[row]) rowOperand[row] = String(edge[operandAttr] ?? '').trim();
        if (operandNoteAttr && !rowOperandNote[row]) rowOperandNote[row] = String(edge[operandNoteAttr] ?? '').trim();
        rowLanes[row].push(laneIndex[edge.source] ?? 0, laneIndex[edge.target] ?? 0);
    });
    const plan = fragmentAttr ? planSequenceFragments(rowCount, rowFragment, rowOperand, rowLanes, rowOperandNote) : null;
    const headerCounts = plan ? plan.headerCounts : Array.from({ length: rowCount }, () => 0);

    const bodyTop = TASKS_SEQUENCE_LIFELINE_TOP;
    const capWidth = TASKS_SEQUENCE_LANE_WIDTH - TASKS_SEQUENCE_LANE_GAP;
    // The first row starts below the deepest cap, so a three-line participant
    // name never sits on top of step one.
    const capHeight = Math.max(0, ...lanes.map((id) => labelHeight(byId[id].label || id, capWidth, 'groupTitle')));
    const firstRow = Math.max(TASKS_SEQUENCE_FIRST_ROW, bodyTop + capHeight + 34);
    // Rows are no longer evenly spaced: one that opens a fragment carries that
    // box's header band on top of its own height. Everything downstream reads a
    // row's y through rowY, so the table is the only thing that had to change.
    // A row carrying only detached replies holds no text of its own, so it takes
    // a gap rather than a row.
    const rowBare = Array.from({ length: rowCount }, () => true);
    rows.forEach((edge, index) => {
        if (!(isReply[index] && detached.has(edge.id))) rowBare[rowOf[index]] = false;
    });
    const bandTops = [];
    const arrowYs = [];
    let cursor = firstRow - TASKS_SEQUENCE_ROW_HEIGHT / 2;
    for (let row = 0; row < rowCount; row += 1) {
        const header = headerCounts[row] * TASKS_SEQUENCE_FRAGMENT_HEADER;
        if (rowBare[row] && row > 0 && !header) {
            arrowYs.push(arrowYs[row - 1] + TASKS_SEQUENCE_REPLY_GAP);
            bandTops.push(arrowYs[row] - TASKS_SEQUENCE_REPLY_GAP / 2);
        } else {
            bandTops.push(cursor);
            arrowYs.push(cursor + header + TASKS_SEQUENCE_ROW_HEIGHT / 2);
        }
        cursor = arrowYs[row] + TASKS_SEQUENCE_ROW_HEIGHT / 2;
    }
    const rowY = (index) => arrowYs[index] ?? firstRow;
    const bandTop = (index) => bandTops[index] ?? (firstRow - TASKS_SEQUENCE_ROW_HEIGHT / 2);
    const slotY = (header) => bandTop(header.row) + header.slot * TASKS_SEQUENCE_FRAGMENT_HEADER;
    const bodyHeight = rowCount
        ? (rowY(rowCount - 1) + 2 * TASKS_SEQUENCE_ROW_HEIGHT) - bodyTop
        : (firstRow - bodyTop) + TASKS_SEQUENCE_ROW_HEIGHT;
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
            __pair_lift__: half && !detached.has(edge.id) ? TASKS_PAIR_LIFT : 0,
            // A detached reply keeps its LINE below the rows its frame contains,
            // because the frame needs that height. Its TEXT belongs beside the
            // call it answers: left on its own line, the label sat between two
            // rows and read as belonging to neither of them.
            // The frame's own bottom border is where the reply leaves, which is
            // what UML draws. A second line under it stated the same fact twice,
            // and carried no words of its own to justify the row.
            __sequence_line_off__: half === 'reply' && detached.has(edge.id),
            __sequence_label_dy__: half === 'reply' && detached.has(edge.id)
                ? rowY(rowOfEdgeId.get(halves.get(edge.id).mate) ?? row) - rowY(row)
                : 0,
            __sequence_uml__: Boolean(messageAttr),
            // A reply is already known from the pair, so the attribute only has
            // to separate a blocking call from a fire-and-forget one.
            __sequence_message__: messageAttr ? String(edge[messageAttr] ?? '').trim().toLowerCase() : '',
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
    // The steps a run of rows covers. A fragment card names the steps inside its
    // box and a bar card names the steps its frame stays open for: one fact, two
    // readers, so it is derived once here rather than twice below.
    const stepsByRow = Array.from({ length: rowCount }, () => []);
    rows.forEach((edge, index) => {
        const step = edges[index].__sequence_step__;
        if (step) stepsByRow[rowOf[index]].push(step);
    });
    const stepSpan = (fromRow, toRow) => {
        const covered = stepsByRow.slice(fromRow, toRow + 1).flat();
        if (!covered.length) return '';
        const first = covered[0];
        const last = covered[covered.length - 1];
        return first === last ? first : `${first} to ${last}`;
    };
    // A card names a participant the way the reader sees it on the lane cap, not
    // by the id the pack happens to use.
    const laneLabel = (id) => byId[id]?.label || id;
    // What an arrow says on the page. `edge_label_from` is the pack's own choice
    // of which attribute is the label, so a card must not hard-code `note`.
    const labelAttr = String(projection.edge_label_from || model.edge_label_from || '').trim();
    const edgeById = new Map(rows.map((edge) => [edge.id, edge]));
    const edgeNote = (edgeId) => {
        const edge = edgeById.get(edgeId);
        return (labelAttr && edge ? String(edge[labelAttr] ?? '').trim() : '') || edgeId;
    };
    // Chrome is never an edge endpoint, so a bar and a box cannot be found by the
    // usual source/target test. Each names the drawn edges it stands for, and the
    // hover pass and the edge-preview key read that list instead.
    const drawnIdOf = new Map(rows.map((edge, index) => [edge.id, edges[index].id]));
    const drawnIdsInRows = (fromRow, toRow, laneId = '') => rows
        .filter((edge, index) => rowOf[index] >= fromRow && rowOf[index] <= toRow
            && (!laneId || edge.source === laneId || edge.target === laneId))
        .map((edge) => drawnIdOf.get(edge.id))
        .filter(Boolean);
    if (plan) {
        plan.boxes.forEach((box, index) => {
            // The box covers the lanes its own rows touch. Spanning every lane
            // would claim participants the branch never speaks to.
            const minLane = Math.min(...box.lanes);
            const maxLane = Math.max(...box.lanes);
            const pad = Math.max(6, TASKS_SEQUENCE_FRAGMENT_PAD - box.depth * TASKS_SEQUENCE_FRAGMENT_INSET);
            const left = TASKS_SEQUENCE_LEFT + minLane * TASKS_SEQUENCE_LANE_WIDTH - pad;
            const right = TASKS_SEQUENCE_LEFT + maxLane * TASKS_SEQUENCE_LANE_WIDTH + capWidth + pad;
            // The top is the box's own header line. The bottom clears its last
            // arrow, tightening by depth so a child that ends on the same row as
            // its parent still closes inside it.
            const top = slotY(box.header);
            const bottom = rowY(box.bottom) + Math.max(10, (TASKS_SEQUENCE_ROW_HEIGHT / 2) - box.depth * 5);
            // One card row per operand, because the card collapses newlines and a
            // joined string would run two branches into one paragraph. The guard
            // leads, then the sentence saying what that branch does here.
            const guarded = box.operands.filter((operand) => operand.guard);
            const operandRows = Object.fromEntries(guarded.map((operand, position) => [
                `operand_${position + 1}`,
                operand.note ? `${operand.guard} — ${operand.note}` : operand.guard,
            ]));
            const steps = stepSpan(box.top, box.bottom);
            // The participants the box claims. The border alone says which lanes
            // it spans; the card says which ones it is actually about.
            const covers = lanes.slice(minLane, maxLane + 1).map(laneLabel).join(', ');
            nodes.push({
                id: `__seq_fragment_${index}`,
                // The name after the colon, which is what `ref` and a named loop
                // carry. It is not drawn on the box: `fragment=` sits on every
                // arrow inside, so the hover and click cards already show it.
                label: box.name ? `${box.operator} · ${box.name}` : box.operator,
                __kind__: 'sequenceFragment',
                __sequence_fragment_op__: box.operator,
                __sequence_fragment_depth__: box.depth,
                // Plain keys, so the same card that shows a node's attributes
                // shows a fragment's without knowing what a fragment is.
                operator: box.operator,
                ...(box.name ? { name: box.name } : {}),
                ...operandRows,
                ...(steps ? { steps } : {}),
                ...(covers ? { covers } : {}),
                description: TASKS_SEQUENCE_FRAGMENT_MEANING[box.operator]
                    || 'A combined fragment: the rows inside it are read as one unit.',
                // Only the corner tag answers the pointer. The box covers whole
                // rows, so a full-area hit rect would shadow every lifeline and
                // arrow it is drawn around.
                __hit_rect__: {
                    dx: 0,
                    dy: 0,
                    width: sequenceFragmentTagWidth(box.operator),
                    height: TASKS_SEQUENCE_FRAGMENT_TAG_HEIGHT,
                },
                // Offsets from the box's own top, so the renderer places a rule
                // and a guard without knowing which row either came from.
                __edge_ids__: drawnIdsInRows(box.top, box.bottom),
                __sequence_operands__: box.operands.map((operand, position) => ({
                    guard: operand.guard,
                    // The first operand needs no rule: the box's top edge is
                    // already its boundary.
                    rule: position === 0 ? -1 : bandTop(operand.row) - top,
                    // An operand with no header of its own carries no guard to
                    // draw, but never let it resolve above the box it belongs to.
                    top: Math.max(0, (operand.header ? slotY(operand.header) : bandTop(operand.row)) - top),
                })),
                __fixed_size__: true,
                __z__: TASKS_SEQUENCE_FRAGMENT_Z + box.depth,
                position: { x: left, y: top },
                width: right - left,
                height: bottom - top,
            });
        });
    }
    // An activation bar is one call's lifetime on the lane that is executing: it
    // opens on the row the call arrives and closes on the row its reply leaves.
    // Depth shifts a bar that opens while another is still open on the same lane,
    // so recursion stays two bars rather than one.
    if (activation) {
        const openByLane = {};
        rows.forEach((edge, index) => {
            if (isReply[index] || halves.get(edge.id)?.half !== 'call') return;
            const replyRow = replyRowOfCallId.get(edge.id);
            if (replyRow === undefined || replyRow <= rowOf[index]) return;
            const open = openByLane[edge.target] || [];
            const depth = open.filter((bar) => bar.bottom >= rowOf[index]).length;
            const bar = { top: rowOf[index], bottom: replyRow, depth };
            openByLane[edge.target] = [...open, bar];
            const laneWidth = TASKS_SEQUENCE_LANE_WIDTH - TASKS_SEQUENCE_LANE_GAP;
            const laneX = TASKS_SEQUENCE_LEFT + (laneIndex[edge.target] ?? 0) * TASKS_SEQUENCE_LANE_WIDTH;
            const inset = Math.min(bar.depth * TASKS_SEQUENCE_ACTIVATION_INSET, (laneWidth - 12) / 2);
            const width = laneWidth - inset * 2;
            // The top clears the opening call, so that arrow reads as a row inside
            // the frame rather than as its border. The bottom is FLUSH with the
            // closing reply, which is where UML draws a return leaving an
            // execution. That line carries no label of its own, so nothing is lost
            // to the border, and the frame stops at the last thing it contains.
            const top = rowY(bar.top) - TASKS_SEQUENCE_ACTIVATION_PAD;
            const height = rowY(bar.bottom) - top;
            nodes.push({
                id: `__seq_activation_${index}`,
                // The step the frame opens on. Its closing reply carries no
                // number of its own, so without this the bottom edge reads as
                // nothing and the height says only "somewhere below".
                label: edges[index].__sequence_step__ || '',
                __kind__: 'sequenceActivation',
                // The renderer takes the executing lane's own colour from here,
                // so the frame reads as belonging to that lifeline.
                __sequence_lane__: edge.target,
                // What the two edges SAY, not what they are called. An id names
                // nothing to a reader, and the pack already states which attribute
                // is an arrow's label.
                // Every edge this lane touches while the frame is open: the call
                // that opened it and the reply that closes it, on one side, and
                // every call the lane makes in between, on the other. Naming only
                // the bounding pair lit one side of the bar and dimmed the work
                // the frame exists to contain.
                __edge_ids__: drawnIdsInRows(bar.top, bar.bottom, edge.target),
                lane: laneLabel(edge.target),
                call: edgeNote(edge.id),
                reply: edgeNote(halves.get(edge.id).mate),
                ...(stepSpan(rowOf[index], replyRow) ? { steps: stepSpan(rowOf[index], replyRow) } : {}),
                description: 'An activation bar: one call still running on this lane. It opens when the call arrives and closes when the reply leaves, so every row drawn between them ran while that call was active.',
                // The bar draws its own box, so the whole box answers the pointer.
                // Nothing smaller would be findable: it carries no text but a step.
                __hit_rect__: { dx: 0, dy: 0, width, height },
                __fixed_size__: true,
                __z__: TASKS_SEQUENCE_ACTIVATION_Z,
                position: { x: laneX + inset, y: top },
                width,
                height,
            });
        });
    }
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
        keys: [
            'sequence_role', 'sequence_phase', 'sequence_activation', 'sequence_lanes',
            'sequence_message', 'sequence_fragment', 'sequence_operand', 'sequence_operand_note',
        ],
        chromeKinds: ['sequencePhase', 'sequenceActivation', 'sequenceFragment'],
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

let tasksElk;
async function layoutWithElk(graph) {
    tasksElk ||= import('https://esm.sh/elkjs@0.10.0').then(({ default: ELK }) => new ELK());
    return (await tasksElk).layout(graph);
}

const TASKS_GROUP_PADDING = { top: 68, right: 40, bottom: 40, left: 40 };

const TASKS_ROOT_SPACING = { node: 44, layer: 96 };

const TASKS_ROOT_COLLISION_GAP = 96;

// A fixed layout places every node itself, so ELK never runs for it.
export const tasksFixedLayout = (mode) => tasksLayoutById(mode);

export const tasksIsFixedMode = (mode) => mode === 'gantt' || mode === TASKS_LAYOUT_ERROR_MODE || Boolean(tasksLayoutById(mode));

export function readTasksDirection(value) {
    const raw = String(value || 'TD').trim().toUpperCase();
    if (raw === 'LR' || raw === 'RIGHT') return 'RIGHT';
    return 'DOWN';
}

export function tasksMergeHandleLayouts(primary = {}, secondary = {}) {
    return {
        source: [...(primary.source || []), ...(secondary.source || [])],
        target: [...(primary.target || []), ...(secondary.target || [])],
    };
}

function stableTaskJitter(id, amplitudeX = 16, amplitudeY = 8) {
    const text = String(id || '');
    let hashA = 0;
    let hashB = 0;
    for (let i = 0; i < text.length; i += 1) {
        const code = text.charCodeAt(i);
        hashA = (hashA * 33 + code) % 1000003;
        hashB = (hashB * 97 + code) % 1000033;
    }
    return {
        x: ((hashA % 1000) / 999 - 0.5) * amplitudeX,
        y: ((hashB % 1000) / 999 - 0.5) * amplitudeY,
    };
}

async function layoutTasksGraph(graph, model, expanded, jitterConfig = {}, layoutConfig = {}) {
    const nodeLabels = tasksModelNodeLabels(model);
    const nodeMap = Object.fromEntries(graph.nodes.map((n) => [n.id, n]));
    const layoutEdges = reduceTransitiveEdges(graph.edges || []);
    const parentOf = {};
    const expandedGroupSizes = {};
    const groupPadding = layoutConfig.groupPadding || 40;
    const groupTopPadding = (groupNode, widthOverride = null) => {
        const width = Math.max(80, Number(widthOverride || groupNode?.width || 250) - 16);
        const titleHeight = sizeTaskNode(groupNode?.label || groupNode?.id || '', 'groupTitle', width, {
            hasImage: Boolean(resolveTasksNodeImage(groupNode, model)),
            nodeLabels,
        }).height;
        return groupPadding + titleHeight;
    };

    for (const n of graph.nodes) {
        if (n.__kind__ === 'group' && expanded.has(n.id)) {
            const childGroups = (model.group_tree?.[n.id] || []).filter((cg) => graph.nodes.some((gn) => gn.id === cg));
            const childTasks = (model.task_children?.[n.id] || []).filter((ct) => graph.nodes.some((tn) => tn.id === ct));
            [...childGroups, ...childTasks].forEach((cid) => { parentOf[cid] = n.id; });
        }
    }

    const buildElkNode = (nid) => {
        const n = nodeMap[nid];
        const node = { id: nid, width: n?.width || 250, height: n?.height || 80 };
        const children = graph.nodes.filter((cn) => parentOf[cn.id] === nid);
        if (children.length > 0) {
            node.children = children.map((c) => buildElkNode(c.id));
            node.layoutOptions = {
                'elk.algorithm': 'layered',
                'elk.direction': layoutConfig.elkDirection || 'DOWN',
                'elk.spacing.nodeNode': `${layoutConfig.nodeSpacing || 72}`,
                'elk.layered.spacing.nodeNodeBetweenLayers': `${layoutConfig.layerSpacing || 112}`,
                'elk.padding': `[top=${groupTopPadding(n)},left=${groupPadding},bottom=${groupPadding},right=${groupPadding}]`
            };
        }
        return node;
    };

    for (const gid of expanded) {
        if (!graph.nodes.some((n) => n.id === gid && n.__kind__ === 'group')) continue;
        const childGroups = (model.group_tree?.[gid] || []).filter((cg) => graph.nodes.some((gn) => gn.id === cg));
        const childTasks = (model.task_children?.[gid] || []).filter((ct) => graph.nodes.some((tn) => tn.id === ct));
        const allChildren = [...childGroups, ...childTasks];
        if (allChildren.length === 0) continue;
        const childGraph = {
            id: `sub-${gid}`,
            layoutOptions: {
                'elk.algorithm': 'layered',
                'elk.direction': layoutConfig.elkDirection || 'DOWN',
                'elk.spacing.nodeNode': `${layoutConfig.nodeSpacing || 72}`,
                'elk.layered.spacing.nodeNodeBetweenLayers': `${layoutConfig.layerSpacing || 112}`,
                'elk.padding': `[top=${groupTopPadding(nodeMap[gid])},left=${groupPadding},bottom=${groupPadding},right=${groupPadding}]`
            },
            children: allChildren.map((cid) => {
                const cn = nodeMap[cid];
                return { id: cid, width: cn?.width || 250, height: cn?.height || 80 };
            }),
            edges: reduceTransitiveEdges((graph.edges || [])
                .filter((e) => allChildren.includes(e.source) && allChildren.includes(e.target))
            ).map((e, i) => ({ id: `e${i}`, sources: [e.source], targets: [e.target] })),
        };
        const subLayout = await layoutWithElk(childGraph);
        if (subLayout.children && subLayout.children.length > 0) {
            expandedGroupSizes[gid] = {
                width: Math.max(subLayout.width || 0, 250),
                height: Math.max(subLayout.height || 0, 80),
            };
        }
    }

    const adjustedNodes = graph.nodes.map((n) => {
        if (expandedGroupSizes[n.id]) {
            return { ...n, width: expandedGroupSizes[n.id].width, height: expandedGroupSizes[n.id].height };
        }
        return n;
    });
    const adjustedNodeMap = Object.fromEntries(adjustedNodes.map((n) => [n.id, n]));

    const buildElkNodeAdjusted = (nid) => {
        const n = adjustedNodeMap[nid];
        const node = { id: nid, width: n?.width || 250, height: n?.height || 80 };
        const children = adjustedNodes.filter((cn) => parentOf[cn.id] === nid);
        if (children.length > 0) {
            node.children = children.map((c) => buildElkNodeAdjusted(c.id));
            node.layoutOptions = {
                'elk.algorithm': 'layered',
                'elk.direction': layoutConfig.elkDirection || 'DOWN',
                'elk.spacing.nodeNode': `${layoutConfig.nodeSpacing || 72}`,
                'elk.layered.spacing.nodeNodeBetweenLayers': `${layoutConfig.layerSpacing || 112}`,
                'elk.padding': `[top=${groupTopPadding(n, n?.width)},left=${groupPadding},bottom=${groupPadding},right=${groupPadding}]`
            };
        }
        return node;
    };

    const topLevel = adjustedNodes.filter((n) => !parentOf[n.id]);
    const rootLayoutOptions = {
        'elk.algorithm': 'layered',
        'elk.direction': layoutConfig.elkDirection || 'DOWN',
        'elk.spacing.nodeNode': `${layoutConfig.nodeSpacing || TASKS_ROOT_SPACING.node}`,
        'elk.layered.spacing.nodeNodeBetweenLayers': `${layoutConfig.layerSpacing || TASKS_ROOT_SPACING.layer}`,
    };
    const laidOut = await layoutWithElk({
        id: 'root',
        layoutOptions: rootLayoutOptions,
        children: topLevel.map((n) => buildElkNodeAdjusted(n.id)),
        edges: layoutEdges.map((e, i) => ({ id: `e${i}`, sources: [e.source], targets: [e.target] })),
    });
    const absPosMap = {};
    const relPosMap = {};
    const collectPos = (node, offsetX = 0, offsetY = 0) => {
        const jitter = stableTaskJitter(node.id, jitterConfig.x ?? 18, jitterConfig.y ?? 10);
        const localX = (node.x || 0) + jitter.x;
        const localY = (node.y || 0) + jitter.y;
        relPosMap[node.id] = { x: localX, y: localY };
        absPosMap[node.id] = { x: localX + offsetX, y: localY + offsetY };
        if (node.children) {
            node.children.forEach((c) => collectPos(c, absPosMap[node.id].x, absPosMap[node.id].y));
        }
    };
    laidOut.children?.forEach((c) => collectPos(c));
    laidOut.absoluteChildPositions = absPosMap;
    laidOut.relativeChildPositions = relPosMap;
    laidOut.parentOf = parentOf;
    laidOut.expandedGroupSizes = expandedGroupSizes;
    return laidOut;
}

export async function layoutBaseTasksGraph(graph, model, jitterConfig = {}, layoutConfig = {}) {
    const rootGroupIds = new Set(model.group_tree?.["null"] || []);
    const rootTaskIds = new Set(model.task_children?.["null"] || []);
    const rootNodeIds = new Set([...rootGroupIds, ...rootTaskIds]);
    const taskToGroup = Object.fromEntries((model.tasks || []).map((t) => [t.id, t.group_id || null]));
    const groupParent = Object.fromEntries((model.groups || []).map((g) => [g.id, g.parent_group_id || null]));

    const getRoot = (id) => {
        let cur = id;
        while (groupParent[cur]) {
            cur = groupParent[cur];
        }
        return cur;
    };

    const rootEdges = [];
    const seenRootEdges = new Map();
    for (const edge of (model.dependency_edges || [])) {
        const srcGroup = taskToGroup[edge.source] || edge.source;
        const dstGroup = taskToGroup[edge.target] || edge.target;
        const srcRoot = getRoot(srcGroup);
        const dstRoot = getRoot(dstGroup);
        if (srcRoot !== dstRoot && rootNodeIds.has(srcRoot) && rootNodeIds.has(dstRoot)) {
            appendProjectedEdge(rootEdges, seenRootEdges, srcRoot, dstRoot, edge.label || '', edge);
        }
    }

    const rootGraph = {
        nodes: graph.nodes.filter((n) => rootNodeIds.has(n.id)),
        edges: rootEdges,
    };
    logTasksDebugVerbose('rootGraph', {
        nodes: rootGraph.nodes.map(n => n.id),
        edges: rootGraph.edges,
        edgeCount: rootGraph.edges.length,
    });
    const laidOut = await layoutTasksGraph(rootGraph, model, new Set(), jitterConfig, layoutConfig);
    logTasksDebugVerbose('baseLayout', {
        width: Math.round(laidOut.width || 0),
        height: Math.round(laidOut.height || 0),
        positions: Object.fromEntries(Object.entries(laidOut.absoluteChildPositions || {}).map(([id, rect]) => [id, rectSummary(rect)])),
    });
    const positions = {};
    for (const node of rootGraph.nodes) {
        const pos = laidOut.absoluteChildPositions?.[node.id] || { x: 0, y: 0 };
        positions[node.id] = {
            x: pos.x,
            y: pos.y,
            width: node.width || 250,
            height: node.height || 80,
        };
    }
    return { positions, width: laidOut.width || 0, height: laidOut.height || 0 };
}

export function buildProjectedRootTasksGraph(rawGraph, model) {
    const rootGroupIds = new Set(model.group_tree?.["null"] || []);
    const rootTaskIds = new Set(model.task_children?.["null"] || []);
    const rootNodeIds = new Set([...rootGroupIds, ...rootTaskIds]);
    const taskToGroup = Object.fromEntries((model.tasks || []).map((task) => [task.id, task.group_id || null]));
    const groupParent = Object.fromEntries((model.groups || []).map((group) => [group.id, group.parent_group_id || null]));
    const getRoot = (id) => {
        let cur = taskToGroup[id] || id;
        while (groupParent[cur]) cur = groupParent[cur];
        return cur;
    };
    const edges = [];
    const seen = new Map();
    for (const edge of (model.dependency_edges || [])) {
        const source = getRoot(edge.source);
        const target = getRoot(edge.target);
        if (source !== target && rootNodeIds.has(source) && rootNodeIds.has(target)) {
            appendProjectedEdge(edges, seen, source, target, edge.label || '', edge);
        }
    }
    return {
        nodes: rawGraph.nodes.filter((node) => rootNodeIds.has(node.id)),
        edges,
    };
}

// Read the layering ELK already worked out, rather than re-deriving ranks from
// the edges. ELK breaks cycles as part of laying out; a longest-path rank of our
// own cuts a cycle wherever its walk happens to enter it, which can drop a group
// far from the one edge that placed it. A band is a set of children that overlap
// vertically, which is exactly what one ELK layer looks like.
function tasksWaterfallBands(ids, edges, direction, positions = {}) {
    if (direction !== 'DOWN' || !edges.length) return null;
    const placed = ids.filter((id) => positions[id]);
    if (!placed.length) return null;
    const bands = [];
    let bandBottom = -Infinity;
    for (const id of placed.sort((left, right) => positions[left].y - positions[right].y)) {
        const rect = positions[id];
        if (!bands.length || rect.y >= bandBottom) {
            bands.push([]);
            bandBottom = -Infinity;
        }
        bands[bands.length - 1].push(id);
        bandBottom = Math.max(bandBottom, rect.y + (rect.height || 0));
    }
    for (const band of bands) band.sort((left, right) => positions[left].x - positions[right].x);
    return bands;
}

async function layoutGroupInternal(groupId, model, childSizes = {}, jitterConfig = {}, layoutConfig = {}, useElkForGroups = true) {
    const nodeLabels = tasksModelNodeLabels(model);
    const groupsById = Object.fromEntries((model.groups || []).map((group) => [group.id, group]));
    const tasksById = Object.fromEntries((model.tasks || []).map((task) => [task.id, task]));
    const groupDirection = readTasksDirection(groupsById[groupId]?.layout_direction || groupsById[groupId]?.direction || layoutConfig.elkDirection);
    const groupPadding = layoutConfig.groupPadding || 40;
    const groupTitleWidth = Math.max(80, (childSizes[groupId]?.width || groupsById[groupId]?.width || 250) - 16);
    const groupTitleHeight = sizeTaskNode(groupsById[groupId]?.label || groupId, 'groupTitle', groupTitleWidth, {
        hasImage: Boolean(resolveTasksNodeImage(groupsById[groupId], model)),
        nodeLabels,
    }).height;
    const groupPadTop = groupPadding + groupTitleHeight;
    const groupChildren = [
        ...(model.task_children?.[groupId] || []).map((id) => {
            const source = tasksById[id] || {};
            const label = source.label || id;
            return { id, __kind__: 'task', label, ...sizeTaskNode(label, 'task', null, { hasImage: Boolean(resolveTasksNodeImage(source, model)), nodeLabels }) };
        }),
        ...(model.group_tree?.[groupId] || []).map((id) => {
            const source = groupsById[id] || {};
            const label = source.label || id;
            return { id, __kind__: 'group', label, ...sizeTaskNode(label, 'group', null, { hasImage: Boolean(resolveTasksNodeImage(source, model)), nodeLabels }) };
        }),
    ].map((child) => childSizes[child.id] ? { ...child, ...childSizes[child.id] } : child);
    if (groupChildren.length === 0) {
        return {
            positions: {},
            bbox: { width: 250, height: 80 },
        };
    }
    const compactGroupChildren = (positions, beforeBbox) => {
        const order = [...groupChildren]
            .sort((left, right) => (
                ((positions[left.id]?.y || 0) - (positions[right.id]?.y || 0))
                || ((positions[left.id]?.x || 0) - (positions[right.id]?.x || 0))
                || (left.__kind__ === right.__kind__ ? 0 : (left.__kind__ === 'task' ? -1 : 1))
            ))
            .map((child) => child.id);
        const bands = tasksWaterfallBands(order, childEdges, groupDirection, positions);
        const compacted = packTaskChildRects(positions, {
            gap: Math.max(12, Math.min(layoutConfig.nodeSpacing || 72, 36)),
            padX: groupPadding,
            padTop: groupPadTop,
            padBottom: groupPadding,
            minWidth: 250,
            minHeight: 80,
            targetAspectRatio: 1.05,
            order,
            bands: bands || undefined,
        });
        logTasksDebugVerbose('groupPacking', {
            groupId,
            before: rectSummary(beforeBbox),
            after: rectSummary(compacted.bbox),
            rows: compacted.rows,
            positions: Object.fromEntries(Object.entries(compacted.positions).map(([id, rect]) => [id, rectSummary(rect)])),
        });
        return compacted;
    };
    const childIds = new Set(groupChildren.map((child) => child.id));
    const parentOf = Object.fromEntries([
        ...(model.tasks || []).map((task) => [task.id, task.group_id || null]),
        ...(model.groups || []).map((group) => [group.id, group.parent_group_id || null]),
    ]);
    const liftToChild = (id) => {
        let current = id;
        while (current && !childIds.has(current)) current = parentOf[current] ?? null;
        return current;
    };
    const liftedEdges = new Map();
    for (const edge of (model.dependency_edges || [])) {
        const source = liftToChild(edge.source);
        const target = liftToChild(edge.target);
        if (!source || !target || source === target) continue;
        const key = `${source}->${target}`;
        if (!liftedEdges.has(key)) liftedEdges.set(key, { ...edge, source, target });
    }
    const childEdges = reduceTransitiveEdges([...liftedEdges.values()]);
    if (useElkForGroups && childEdges.length > 0) {
        const elkLayout = await layoutWithElk({
            id: `group-${groupId}`,
            layoutOptions: {
                'elk.algorithm': 'layered',
                'elk.direction': groupDirection,
                'elk.spacing.nodeNode': `${layoutConfig.nodeSpacing || 72}`,
                'elk.layered.spacing.nodeNodeBetweenLayers': `${layoutConfig.layerSpacing || 112}`,
                'elk.padding': `[top=${groupPadTop},left=${groupPadding},bottom=${groupPadding},right=${groupPadding}]`,
            },
            children: groupChildren.map((child) => ({
                id: child.id,
                width: child.width || 250,
                height: child.height || 80,
            })),
            edges: childEdges.map((edge, index) => ({ id: `e${index}`, sources: [edge.source], targets: [edge.target] })),
        });
        const positions = {};
        for (const child of elkLayout.children || []) {
            const jitter = stableTaskJitter(child.id, jitterConfig.x ?? 14, jitterConfig.y ?? 8);
            positions[child.id] = {
                x: (child.x || 0) + jitter.x,
                y: (child.y || 0) + jitter.y,
                width: child.width || 0,
                height: child.height || 0,
            };
        }
        return compactGroupChildren(positions, {
            width: Math.max(elkLayout.width || 0, 250),
            height: Math.max(elkLayout.height || 0, 80),
        });
    }
    const packedLayout = layoutDisconnectedTaskNodes(groupChildren, groupDirection, {
        gap: Math.max(layoutConfig.nodeSpacing || 72, layoutConfig.layerSpacing || 112),
        padX: groupPadding,
        padTop: groupPadTop,
        padBottom: groupPadding,
    });
    const positions = {};
    for (const child of groupChildren) {
        const base = packedLayout.positions[child.id];
        const jitter = stableTaskJitter(child.id, jitterConfig.x ?? 14, jitterConfig.y ?? 8);
        positions[child.id] = {
            x: (base?.x || 0) + jitter.x,
            y: (base?.y || 0) + jitter.y,
            width: child.width || 0,
            height: child.height || 0,
        };
    }
    return compactGroupChildren(positions, {
        width: Math.max(packedLayout.bbox.width || 0, 250),
        height: Math.max(packedLayout.bbox.height || 0, 80),
    });
}

export async function layoutExpandedGroups(model, expandedSet, jitterConfig = {}, layoutConfig = {}, useElkForGroups = true) {
    const expandedIds = Array.from(expandedSet);
    const groupParent = Object.fromEntries((model.groups || []).map((g) => [g.id, g.parent_group_id || null]));
    const depthOf = (id) => {
        let depth = 0;
        let cur = groupParent[id];
        while (cur) {
            depth += 1;
            cur = groupParent[cur];
        }
        return depth;
    };
    const layouts = {};
    for (const groupId of expandedIds.sort((a, b) => depthOf(b) - depthOf(a))) {
        const childSizes = {};
        for (const childId of (model.group_tree?.[groupId] || [])) {
            if (layouts[childId]) childSizes[childId] = layouts[childId].bbox;
        }
        layouts[groupId] = await layoutGroupInternal(groupId, model, childSizes, jitterConfig, layoutConfig, useElkForGroups);
    }
    return layouts;
}

export async function deriveSquishedExpandedLayout(baseGraph, model, expandedSet, baseLayout, groupLayouts, layoutConfig = {}) {
    const visible = buildVisibleTasksGraph(model, expandedSet);
    logTasksDebugVerbose('visibleGraph', {
        expanded: Array.from(expandedSet),
        nodes: visible.nodes.map(n => n.id),
        edges: visible.edges,
    });
    const visibleNodeMap = Object.fromEntries(visible.nodes.map((node) => [node.id, node]));
    const parentOf = {};
    for (const groupId of expandedSet) {
        (model.group_tree?.[groupId] || []).forEach((id) => { parentOf[id] = groupId; });
        (model.task_children?.[groupId] || []).forEach((id) => { parentOf[id] = groupId; });
    }

    const topLevelIds = baseGraph.nodes.map((node) => node.id);
    const expandedTopLevelIds = topLevelIds.filter((id) => expandedSet.has(id));
    const topLevelRects = {};
    for (const id of topLevelIds) {
        const baseRect = baseLayout.positions[id];
        if (!baseRect) continue;
        const groupLayout = expandedSet.has(id) ? groupLayouts[id] : null;
        topLevelRects[id] = groupLayout ? tasksExpandedRootRect(baseRect, groupLayout.bbox) : {
            x: baseRect.x,
            y: baseRect.y,
            width: baseRect.width,
            height: baseRect.height,
            baseWidth: baseRect.width,
            baseHeight: baseRect.height,
        };
    }
    const layoutTrace = {
        expandedTopLevelIds,
        visibleNodeIds: visible.nodes.map((node) => node.id),
        baseRects: Object.fromEntries(topLevelIds.map((id) => [id, rectSummary(baseLayout.positions[id])]).filter(([, rect]) => rect)),
        expandedRects: Object.fromEntries(Object.entries(topLevelRects).map(([id, rect]) => [id, rectSummary(rect)])),
        collisionPasses: [],
        finalRects: {},
    };

    const nodes = [];
    let rootPositions = null;
    if (expandedTopLevelIds.length > 0) {
        const rootLayout = await layoutWithElk({
            id: 'expanded-root',
            layoutOptions: {
                'elk.algorithm': 'layered',
                'elk.direction': layoutConfig.elkDirection || 'DOWN',
                'elk.spacing.nodeNode': `${layoutConfig.nodeSpacing || TASKS_ROOT_SPACING.node}`,
                'elk.layered.spacing.nodeNodeBetweenLayers': `${layoutConfig.layerSpacing || TASKS_ROOT_SPACING.layer}`,
            },
            children: topLevelIds
                .filter((id) => topLevelRects[id])
                .map((id) => ({
                    id,
                    width: topLevelRects[id].width,
                    height: topLevelRects[id].height,
                })),
            edges: (baseGraph.edges || []).map((edge, index) => ({ id: `root-${index}`, sources: [edge.source], targets: [edge.target] })),
        });
        rootPositions = Object.fromEntries((rootLayout.children || []).map((node) => [node.id, { x: node.x || 0, y: node.y || 0 }]));
        logTasksDebugVerbose('expandedRootLayout', {
            edges: (baseGraph.edges || []).map((edge) => ({ source: edge.source, target: edge.target, reference: edge.__reference__ === true })),
            positions: Object.fromEntries((rootLayout.children || []).map((node) => [node.id, {
                x: Math.round(node.x || 0), y: Math.round(node.y || 0),
                width: Math.round(node.width || 0), height: Math.round(node.height || 0),
            }])),
        });
        layoutTrace.rootElk = {
            width: Math.round(rootLayout.width || 0),
            height: Math.round(rootLayout.height || 0),
            positions: Object.fromEntries(Object.entries(rootPositions).map(([id, position]) => [id, rectSummary({ ...position, width: topLevelRects[id]?.width, height: topLevelRects[id]?.height })])),
        };
    }
    for (const id of topLevelIds) {
        const visibleNode = visibleNodeMap[id];
        if (!visibleNode) continue;
        const rect = topLevelRects[id];
        const rootPosition = rootPositions?.[id] || rect;
        nodes.push({
            ...visibleNode,
            position: { x: rootPosition.x, y: rootPosition.y },
            width: rect.width,
            height: rect.height,
            parentId: null,
        });
    }

    const addExpandedChildren = (groupId) => {
        const groupLayout = groupLayouts[groupId];
        if (!groupLayout) return;
        const groupChildren = [...(model.group_tree?.[groupId] || []), ...(model.task_children?.[groupId] || [])];
        for (const childId of groupChildren) {
            const childVisible = visibleNodeMap[childId];
            const childRect = groupLayout.positions[childId];
            if (!childVisible || !childRect) continue;
            const nestedLayout = expandedSet.has(childId) ? groupLayouts[childId] : null;
            nodes.push({
                ...childVisible,
                position: { x: childRect.x, y: childRect.y },
                width: nestedLayout?.bbox.width || childRect.width,
                height: nestedLayout?.bbox.height || childRect.height,
                parentId: groupId,
            });
            if (nestedLayout) addExpandedChildren(childId);
        }
    };
    for (const groupId of expandedTopLevelIds) addExpandedChildren(groupId);

    if (expandedTopLevelIds.length > 0 && !rootPositions) {
        const topLevelState = {};
        for (const id of topLevelIds) {
            const baseRect = baseLayout.positions[id];
            const rect = topLevelRects[id];
            if (!baseRect || !rect) continue;
            topLevelState[id] = {
                x: rect.x || 0,
                y: rect.y || 0,
                width: rect.baseWidth,
                height: rect.baseHeight,
                expandedWidth: rect.width,
                expandedHeight: rect.height,
            };
        }

        for (const expandedId of expandedTopLevelIds) {
            const expandedState = topLevelState[expandedId];
            if (!expandedState) continue;
            expandedState.width = expandedState.expandedWidth;
            expandedState.height = expandedState.expandedHeight;
        }

        const topLevelStateList = topLevelIds
            .map((id) => topLevelState[id])
            .filter(Boolean)
            .sort((a, b) => (a.y - b.y) || (a.x - b.x));
        logTasksDebugVerbose('unwarpBeforeCollisions', {
            expandedTopLevelIds,
            topLevelState: Object.fromEntries(Object.entries(topLevelState).map(([id, rect]) => [id, rectSummary(rect)])),
        });
        for (let pass = 0; pass < 4; pass += 1) {
            const collisionMoves = [];
            for (let i = 0; i < topLevelStateList.length; i += 1) {
                const a = topLevelStateList[i];
                for (let j = i + 1; j < topLevelStateList.length; j += 1) {
                    const b = topLevelStateList[j];
                    const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
                    const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
                    if (overlapX <= -(layoutConfig.collisionGap || TASKS_ROOT_COLLISION_GAP) || overlapY <= -(layoutConfig.collisionGap || TASKS_ROOT_COLLISION_GAP)) continue;
                    if (Math.abs((a.x + a.width / 2) - (b.x + b.width / 2)) < Math.abs((a.y + a.height / 2) - (b.y + b.height / 2))) {
                        const nextY = a.y + a.height + (layoutConfig.collisionGap || TASKS_ROOT_COLLISION_GAP);
                        if (nextY !== b.y) collisionMoves.push({ pass, axis: 'y', fromY: Math.round(b.y), toY: Math.round(nextY) });
                        b.y = nextY;
                    } else {
                        const nextX = a.x + a.width + (layoutConfig.collisionGap || TASKS_ROOT_COLLISION_GAP);
                        if (nextX !== b.x) collisionMoves.push({ pass, axis: 'x', fromX: Math.round(b.x), toX: Math.round(nextX) });
                        b.x = nextX;
                    }
                }
            }
            logTasksDebugVerbose('unwarpPass', {
                pass,
                collisionMoves,
                topLevelState: Object.fromEntries(Object.entries(topLevelState).map(([id, rect]) => [id, rectSummary(rect)])),
            });
            layoutTrace.collisionPasses.push({
                pass,
                collisionMoves,
                state: Object.fromEntries(Object.entries(topLevelState).map(([id, rect]) => [id, rectSummary(rect)])),
            });
        }

        if (baseGraph.enforceRootRank) {
            const rankGap = Math.min(layoutConfig.collisionGap || TASKS_ROOT_COLLISION_GAP, 40);
            const rankAxis = (layoutConfig.elkDirection || 'DOWN') === 'RIGHT' ? 'x' : 'y';
            for (let pass = 0; pass < topLevelIds.length; pass += 1) {
                let moved = false;
                for (const edge of baseGraph.edges || []) {
                    const source = topLevelState[edge.source];
                    const target = topLevelState[edge.target];
                    if (!source || !target) continue;
                    const minTarget = rankAxis === 'x'
                        ? source.x + source.width + rankGap
                        : source.y + source.height + rankGap;
                    if (rankAxis === 'x' && target.x < minTarget) {
                        target.x = minTarget;
                        moved = true;
                    } else if (rankAxis === 'y' && target.y < minTarget) {
                        target.y = minTarget;
                        moved = true;
                    }
                }
                if (!moved) break;
            }
            const orderedTopLevelIds = topLevelIds
                .filter((id) => topLevelState[id])
                .sort((a, b) => {
                    const left = topLevelState[a];
                    const right = topLevelState[b];
                    return rankAxis === 'x' ? ((left.x - right.x) || (left.y - right.y)) : ((left.y - right.y) || (left.x - right.x));
                });
            for (const id of orderedTopLevelIds) {
                const incoming = (baseGraph.edges || [])
                    .filter((edge) => edge.target === id)
                    .map((edge) => topLevelState[edge.source])
                    .filter(Boolean);
                if (!incoming.length) continue;
                const minPosition = Math.max(...incoming.map((source) => (
                    rankAxis === 'x'
                        ? source.x + source.width + rankGap
                        : source.y + source.height + rankGap
                )));
                if (rankAxis === 'x' && topLevelState[id].x > minPosition) topLevelState[id].x = minPosition;
                if (rankAxis === 'y' && topLevelState[id].y > minPosition) topLevelState[id].y = minPosition;
            }
        }

        for (const node of nodes.filter((n) => !n.parentId)) {
            const state = topLevelState[node.id];
            if (!state) continue;
            node.position = { x: state.x, y: state.y };
        }
        logTasksDebugVerbose('unwarpFinal', {
            topLevelNodes: nodes.filter(n => !n.parentId).map(n => ({
                id: n.id,
                x: Math.round(n.position.x),
                y: Math.round(n.position.y),
                width: Math.round(n.width || 0),
                height: Math.round(n.height || 0),
            })),
        });
    }
    layoutTrace.finalRects = Object.fromEntries(nodes.filter((node) => !node.parentId).map((node) => [
        node.id,
        rectSummary({ ...node.position, width: node.width, height: node.height }),
    ]));
    window.__vyasaTasksDebug.latestLayout = layoutTrace;
    logTasksDebug('layoutTrace', layoutTrace);

    const finalEdges = visible.edges.map((e, i) => ({
        ...e,
        id: `${e.source}-${e.target}-${i}`,
        source: e.source,
        target: e.target,
        label: e.label || undefined,
    }));
    logTasksDebugVerbose('deriveResult', { visibleEdges: visible.edges, finalEdges });
    return {
        nodes,
        edges: finalEdges,
    };
}

export function buildTasksViewState(sourceModel, sourceGraph, projectionId, viewMode, groupByEnabled = false, groupByHierarchy = [], preserveGrouping = false) {
    const projectionState = selectTasksProjectionState(sourceModel, sourceGraph, projectionId);
    const projection = tasksProjectionById(sourceModel, projectionId) || {};
    const fixedLayout = tasksLayoutById(tasksProjectionLayout(sourceModel, projectionId));
    // Two ways a view can be unusable: a key the schema reader rejected, or a
    // build that throws on the pack's own data. Both end up on screen.
    const declaredError = String(projection.layout_error || '');
    if (declaredError) {
        return { ...projectionState, graph: buildLayoutErrorGraph(declaredError, projectionId), viewMode: TASKS_LAYOUT_ERROR_MODE };
    }
    if (fixedLayout) {
        try {
            return {
                ...projectionState,
                graph: fixedLayout.build(projectionState.model, projection),
                viewMode: fixedLayout.id,
            };
        } catch (error) {
            logTasksDebug('layoutError', { projectionId, layout: fixedLayout.id, message: String(error?.message || error) });
            return {
                ...projectionState,
                graph: buildLayoutErrorGraph(String(error?.message || error), projectionId),
                viewMode: TASKS_LAYOUT_ERROR_MODE,
            };
        }
    }
    if (preserveGrouping) return projectionState;
    if (viewMode !== 'gantt') {
        if (!tasksGroupByPrefsDifferFromSchema(sourceModel, projectionId, groupByEnabled, groupByHierarchy)) return projectionState;
        const overrideState = (
            groupByEnabled ? buildTasksGroupedState(projectionState.model, groupByHierarchy) : null
        ) || buildTasksUngroupedState(projectionState.model);
        return { ...overrideState, projectionId: projectionState.projectionId };
    }
    return {
        ...projectionState,
        graph: buildGanttTasksGraph({
            ...projectionState.model,
            dependency_edges: [
                ...(projectionState.model.dependency_edges || []),
                ...tasksReferenceEdges(projectionState.model),
            ],
        }),
        viewMode: 'gantt',
    };
}
