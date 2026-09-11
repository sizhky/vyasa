import { logTasksDebug, logTasksDebugVerbose } from './tasks_diagnostics.js';
import {
    TASKS_CARD_STATE_ATTR, TASKS_DEFAULT_CARD_STATES, TASKS_HAS_NOTE_ATTR, TASKS_SPECIAL_NODE_ATTRS,
    clampTasksEdgeOpacity, clampTasksProjectionDisplayOpacity, collectTasksGroupDescendantIds, collectTasksGroupDescendants,
    isTasksGradientPalette, parseTasksNumericValue, tasksAttrValues, tasksHasAnyNodeNote,
    tasksNodeMetaLabel, tasksProjectionDefaultColorBy,
} from './tasks_graph_model.js';

export const TASKS_GROUP_BG_Z = 10;

export const TASKS_EDGE_Z = 5;

export const TASKS_EDGE_LABEL_Z = 6;

export const TASKS_EDGE_LABEL_FOCUS_Z = 1400;

export const TASKS_GROUP_Z = 180;

export const TASKS_TASK_Z = 1000;

export const TASKS_EDGE_LABEL_SELECTED_Z = TASKS_TASK_Z - 1;

export const TASKS_EDGE_FOCUS_Z = TASKS_TASK_Z - 2;

export const TASKS_TITLE_Z = 300;

export const TASKS_NEIGHBOR_Z_BOOST = 260;

export const TASKS_SELECTED_Z_BOOST = 520;

export const TASKS_NODE_BG = 'color-mix(in srgb, var(--vyasa-paper) 86%, var(--vyasa-primary) 14%)';

export const TASKS_GROUP_BG = 'color-mix(in srgb, var(--vyasa-paper) 88%, var(--vyasa-primary) 12%)';

export const TASKS_GROUP_EXPANDED_BG = 'transparent';

export const TASKS_NODE_BORDER = '1px solid color-mix(in srgb, var(--vyasa-paper) 42%, var(--vyasa-primary) 58%)';

export const TASKS_GROUP_TITLE_BG = 'color-mix(in srgb, var(--vyasa-paper) 76%, var(--vyasa-primary) 24%)';

export const TASKS_EDGE_LABEL_BG = 'color-mix(in srgb, var(--vyasa-paper) 94%, var(--vyasa-primary) 6%)';

export const TASKS_EDGE_LABEL_TEXT = 'var(--vyasa-ink)';

export const TASKS_NODE_BG_ACTIVE = 'color-mix(in srgb, var(--vyasa-paper) 74%, var(--vyasa-primary) 26%)';

export const TASKS_GROUP_BG_ACTIVE = 'color-mix(in srgb, var(--vyasa-primary) 10%, transparent)';

export const TASKS_EDGE_FOCUS_OUT_COLOR = 'color-mix(in srgb, var(--vyasa-primary) 42%, #ef4444 58%)';

export const TASKS_EDGE_FOCUS_IN_COLOR = 'color-mix(in srgb, var(--vyasa-primary) 40%, #22c55e 60%)';

// Do NOT reach for React Flow's onlyRenderVisibleElements here: group children
// carry parentId-relative positions, so its visibility test culls them at the
// wrong absolute coords and nodes vanish when zoomed out.
export const TASKS_DONE_ACCENT = '#22c55e';

const TASKS_HAS_NOTE_PALETTE = { yes: '#22c55e', no: 'rgba(220, 38, 38, 0.28)' };

const TASKS_DARK_PALETTE_CONTRAST = 3.2;

const TASKS_DARK_PALETTE_MIN_L = 0.68;

const TASKS_DARK_PALETTE_MAX_L = 0.9;

const TASKS_DARK_PALETTE_MAX_CHROMA = 0.19;

const tasksDisplayPaletteColorCache = new Map();

export const TASKS_SEQUENCE_LABEL_LIFT = 12;

// Half the clearance between a pair's two labels. Both halves share one
// midpoint, so each label needs to move this far off it to stop overlapping.
// A one-line label box is about 21px tall, so this is the smallest value that
// keeps them apart.
export const TASKS_PAIR_LABEL_LIFT = 13;

const TASKS_SPECIAL_COLOR_MODE_KEYS = new Set(['connectivity', 'rank']);

export function tasksOpacityPctLabel(value) {
    return `${Math.round(clampTasksProjectionDisplayOpacity(value) * 100)}%`;
}

export function tasksDefaultEdgeOpacity(edgeCount) {
    const count = Math.max(1, Number.parseFloat(String(edgeCount ?? '')) || 1);
    return clampTasksEdgeOpacity(5 / Math.sqrt(count));
}

export function tasksApplyEdgeOpacity(alpha, opacity) {
    const base = Number(alpha);
    const normalized = Number.isFinite(base) ? Math.max(0, Math.min(1, base)) : 1;
    return Number((normalized * clampTasksEdgeOpacity(opacity)).toFixed(4));
}

export function tasksProminentEdgeOpacity() {
    return 1;
}

export function tasksEdgeOpacityLabel(opacity) {
    const value = clampTasksEdgeOpacity(opacity);
    if (value <= 0.2) return 'Faint';
    if (value >= 0.85) return 'Bold';
    return 'Clear';
}

export function tasksEdgeStrokeWidthForMode(mode) {
    if (mode === 'focused-in' || mode === 'focused-out' || mode === 'selected-in' || mode === 'selected-out' || mode === 'selected') return 3.5;
    return 1.25;
}

export function tasksTaperedBezierPath(bezierPath, sourceWidth, targetWidth) {
    const nums = String(bezierPath || '').match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi)?.map(Number) || [];
    if (nums.length < 8) return '';
    const [x0, y0, x1, y1, x2, y2, x3, y3] = nums;
    const normal = (ax, ay, bx, by) => {
        const dx = bx - ax;
        const dy = by - ay;
        const len = Math.hypot(dx, dy) || 1;
        return { x: -dy / len, y: dx / len };
    };
    const n0 = normal(x0, y0, x1, y1);
    const n3 = normal(x2, y2, x3, y3);
    // A width of 0 is a real request: it lets an end taper to a point instead of
    // arriving as a stub. Only a missing width falls back to 1.
    const w0 = Math.max(0, Number.isFinite(Number(sourceWidth)) ? Number(sourceWidth) : 1) / 2;
    const w3 = Math.max(0, Number.isFinite(Number(targetWidth)) ? Number(targetWidth) : 1) / 2;
    return [
        `M ${x0 + n0.x * w0} ${y0 + n0.y * w0}`,
        `C ${x1 + n0.x * w0} ${y1 + n0.y * w0} ${x2 + n3.x * w3} ${y2 + n3.y * w3} ${x3 + n3.x * w3} ${y3 + n3.y * w3}`,
        `L ${x3 - n3.x * w3} ${y3 - n3.y * w3}`,
        `C ${x2 - n3.x * w3} ${y2 - n3.y * w3} ${x1 - n0.x * w0} ${y1 - n0.y * w0} ${x0 - n0.x * w0} ${y0 - n0.y * w0}`,
        'Z',
    ].join(' ');
}

// A pair wants its casing on the OUTER side only. A symmetric casing lays paper
// into the gap between the two halves, where it reads as a seam down the middle
// of what should be one exchange. This is the same ribbon math as
// tasksTaperedBezierPath, but the inner boundary sits flush on the ribbon's own
// inner edge while the outer one is padded, so no paper ever crosses the shared
// centreline.
export function tasksSideWeightedRibbonPath(bezierPath, sourceWidth, targetWidth, outerPad, side) {
    const nums = String(bezierPath || '').match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi)?.map(Number) || [];
    if (nums.length < 8) return '';
    const [x0, y0, x1, y1, x2, y2, x3, y3] = nums;
    const normal = (ax, ay, bx, by) => {
        const dx = bx - ax;
        const dy = by - ay;
        const len = Math.hypot(dx, dy) || 1;
        return { x: -dy / len, y: dx / len };
    };
    const n0 = normal(x0, y0, x1, y1);
    const n3 = normal(x2, y2, x3, y3);
    const sign = side > 0 ? 1 : -1;
    const w0 = Math.max(0, Number(sourceWidth) || 0) / 2;
    const w3 = Math.max(0, Number(targetWidth) || 0) / 2;
    const pad = Math.max(0, Number(outerPad) || 0);
    const o0 = sign * (w0 + pad);
    const o3 = sign * (w3 + pad);
    const i0 = -sign * w0;
    const i3 = -sign * w3;
    return [
        `M ${x0 + n0.x * o0} ${y0 + n0.y * o0}`,
        `C ${x1 + n0.x * o0} ${y1 + n0.y * o0} ${x2 + n3.x * o3} ${y2 + n3.y * o3} ${x3 + n3.x * o3} ${y3 + n3.y * o3}`,
        `L ${x3 + n3.x * i3} ${y3 + n3.y * i3}`,
        `C ${x2 + n3.x * i3} ${y2 + n3.y * i3} ${x1 + n0.x * i0} ${y1 + n0.y * i0} ${x0 + n0.x * i0} ${y0 + n0.y * i0}`,
        'Z',
    ].join(' ');
}

// A tapered ribbon used to end in a point at the tip, because the arrowhead is
// zero-wide exactly there: any ribbon width at the tip shows as two shoulders
// beside the arrow. Trimming the ribbon back to the head's base lets the
// arrival end keep body instead, since the blunt end then lands inside the
// head silhouette where it cannot show.
export function tasksTrimBezierEnd(bezierPath, backOff) {
    const nums = String(bezierPath || '').match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi)?.map(Number) || [];
    if (nums.length < 8) return String(bezierPath || '');
    const [x0, y0, x1, y1, x2, y2, x3, y3] = nums;
    const plain = `M ${x0} ${y0} C ${x1} ${y1} ${x2} ${y2} ${x3} ${y3}`;
    const dx = x3 - x2;
    const dy = y3 - y2;
    const len = Math.hypot(dx, dy);
    // Pulling the endpoint past its own control point reverses the end tangent,
    // which turns the ribbon inside out. Keep the last leg pointing forward.
    const back = Math.min(Math.max(0, Number(backOff) || 0), len * 0.9);
    if (!len || !back) return plain;
    return `M ${x0} ${y0} C ${x1} ${y1} ${x2} ${y2} ${x3 - (dx / len) * back} ${y3 - (dy / len) * back}`;
}

export function tasksTaperedArrowHeadPath(bezierPath, size, side = 0) {
    const nums = String(bezierPath || '').match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi)?.map(Number) || [];
    if (nums.length < 8) return '';
    const [, , , , x2, y2, x3, y3] = nums;
    const dx = x3 - x2;
    const dy = y3 - y2;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const nx = -uy;
    const ny = ux;
    const arrowLength = Math.max(6, Number(size) || 10);
    const arrowWidth = arrowLength * 1.18;
    const baseX = x3 - ux * arrowLength;
    const baseY = y3 - uy * arrowLength;
    // A harpoon keeps one barb. Two of them, mirrored, are how a pair of edges
    // reads as one exchange rather than two arrows that happen to overlap.
    //
    // A barb is a slim flag swept back along its own line, not half of a wide
    // arrowhead: the full width is squat at this length and the trailing vertex
    // sits close behind the tip, so the shape hugs the line instead of reading
    // as a blunt wedge. The wing goes on the side the line was nudged toward,
    // which is away from the mate.
    if (side) {
        const sign = side > 0 ? 1 : -1;
        const wing = arrowLength * 0.55;
        return [
            `M ${x3} ${y3}`,
            `L ${baseX + sign * nx * wing} ${baseY + sign * ny * wing}`,
            `L ${baseX} ${baseY}`,
            'Z',
        ].join(' ');
    }
    return [
        `M ${x3} ${y3}`,
        `L ${baseX + nx * arrowWidth / 2} ${baseY + ny * arrowWidth / 2}`,
        `L ${baseX - nx * arrowWidth / 2} ${baseY - ny * arrowWidth / 2}`,
        'Z',
    ].join(' ');
}

// UML draws two arrowheads, and the difference is the whole point. A FILLED
// triangle is a synchronous call: the caller stops until the value comes back.
// An OPEN head -- two strokes, no fill -- is a reply or an asynchronous message,
// where nobody is waiting. Same geometry as the filled head, left unclosed so a
// stroke draws it as a V.
export function tasksOpenArrowHeadPath(bezierPath, size, side = 0) {
    const nums = String(bezierPath || '').match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi)?.map(Number) || [];
    if (nums.length < 8) return '';
    const [, , , , x2, y2, x3, y3] = nums;
    const dx = x3 - x2;
    const dy = y3 - y2;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const nx = -uy;
    const ny = ux;
    const arrowLength = Math.max(6, Number(size) || 10);
    const wing = arrowLength * 0.72;
    const baseX = x3 - ux * arrowLength;
    const baseY = y3 - uy * arrowLength;
    // A pair keeps one wing, on the side its own line was nudged toward, for the
    // same reason the filled head does: two full heads on one row read as two
    // arrows rather than as one exchange.
    if (side) {
        const sign = side > 0 ? 1 : -1;
        return `M ${baseX + sign * nx * wing} ${baseY + sign * ny * wing} L ${x3} ${y3}`;
    }
    return [
        `M ${baseX + nx * wing} ${baseY + ny * wing}`,
        `L ${x3} ${y3}`,
        `L ${baseX - nx * wing} ${baseY - ny * wing}`,
    ].join(' ');
}

// Slide the whole curve sideways, along the normal of its own chord. A reply
// runs the other way, so its normal points the other way, and one signed lift
// puts the two halves on opposite sides of the same path at any angle.
//
// The ENDS are the exception. A free normal offset has a component across the
// node border whenever the chord runs diagonally, which pushes one half into
// the node and pulls the other out, so a departing tail and an arriving head
// stop being level. Each end therefore slides ALONG its own border -- vertical
// for a left/right handle, horizontal for a top/bottom one -- keeping the full
// gap while staying on the border line.
function tasksPairShiftedProps(props, lift) {
    if (!lift) return props;
    const dx = props.targetX - props.sourceX;
    const dy = props.targetY - props.sourceY;
    const len = Math.hypot(dx, dy) || 1;
    const nx = (-dy / len) * lift;
    const ny = (dx / len) * lift;
    const borderTangent = (position) => {
        if (position === 'left' || position === 'right') return { x: 0, y: 1 };
        if (position === 'top' || position === 'bottom') return { x: 1, y: 0 };
        return null;
    };
    const slide = (position) => {
        const tangent = borderTangent(position);
        if (!tangent) return { x: nx, y: ny };
        // Take the side the normal pointed to; a chord square to the border
        // projects to nothing, so fall back to the lift's own sign.
        const dot = (nx * tangent.x) + (ny * tangent.y);
        const sign = dot !== 0 ? Math.sign(dot) : Math.sign(lift);
        return { x: tangent.x * Math.abs(lift) * sign, y: tangent.y * Math.abs(lift) * sign };
    };
    const source = slide(props.sourcePosition);
    const target = slide(props.targetPosition);
    return {
        ...props,
        sourceX: props.sourceX + source.x,
        sourceY: props.sourceY + source.y,
        targetX: props.targetX + target.x,
        targetY: props.targetY + target.y,
    };
}

function tasksEdgePath(props) {
    const distance = Math.hypot(props.targetX - props.sourceX, props.targetY - props.sourceY);
    const stub = Math.max(56, distance * 0.45);
    const shift = (x, y, position) => ({
        x: x + (position === 'left' ? -stub : position === 'right' ? stub : 0),
        y: y + (position === 'top' ? -stub : position === 'bottom' ? stub : 0),
    });
    const sourceStub = shift(props.sourceX, props.sourceY, props.sourcePosition);
    const targetStub = shift(props.targetX, props.targetY, props.targetPosition);
    return [
        `M ${props.sourceX} ${props.sourceY} C ${sourceStub.x} ${sourceStub.y} ${targetStub.x} ${targetStub.y} ${props.targetX} ${props.targetY}`,
        (props.sourceX + 3 * sourceStub.x + 3 * targetStub.x + props.targetX) / 8,
        (props.sourceY + 3 * sourceStub.y + 3 * targetStub.y + props.targetY) / 8,
    ];
}

// Both halves of a pair must be offsets of ONE curve. Solving the reply's own
// bezier re-derives the control points from its swapped source/target
// positions, so the two halves converge at the ends and bow apart in the
// belly. Solve the call's orientation for both, lift each half to its own
// side, then run the reply's path backwards so its barb still lands on its own
// target.
function tasksReverseCubicPath(path) {
    const nums = String(path || '').match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi)?.map(Number) || [];
    if (nums.length < 8) return path;
    const [x0, y0, c1x, c1y, c2x, c2y, x3, y3] = nums;
    return `M ${x3} ${y3} C ${c2x} ${c2y} ${c1x} ${c1y} ${x0} ${y0}`;
}

export function tasksPairedEdgePath(props, lift, half) {
    if (!lift) return tasksEdgePath(props);
    const reply = half === 'reply';
    const call = reply ? {
        ...props,
        sourceX: props.targetX, sourceY: props.targetY, sourcePosition: props.targetPosition,
        targetX: props.sourceX, targetY: props.sourceY, targetPosition: props.sourcePosition,
    } : props;
    // One shared chord means one shared normal, so the reply takes the other
    // sign of the same lift to land on the opposite side.
    const [path, labelX, labelY] = tasksEdgePath(tasksPairShiftedProps(call, reply ? -lift : lift));
    return [reply ? tasksReverseCubicPath(path) : path, labelX, labelY];
}

export function logTasksColorDebug(model, nodes, activeColorBy, activeColorPalette, colorMix) {
    if (!window.__vyasaTasksDebug.enabled) return;
    const candidates = (nodes || [])
        .filter((node) => node && node.__kind__ !== 'groupTitle' && node.__kind__ !== 'ganttHeader')
        .map((node) => ({
            id: node.id,
            kind: node.__kind__,
            entity_type: node.entity_type || '',
            colorByValue: activeColorBy ? (node[activeColorBy] ?? '') : '',
            resolvedColor: resolveTasksNodeColor(node, model, activeColorBy, activeColorPalette) || '',
        }));
    const hits = candidates.filter((node) => node.resolvedColor).slice(0, 4);
    const misses = candidates.filter((node) => !node.resolvedColor).slice(0, 4);
    const availableColorModes = tasksColorOptions(model).map((option) => option.key);
    const resolvedCount = candidates.filter((node) => node.resolvedColor).length;
    logTasksDebug('color-state', {
        graphId: model?.graph_id || '',
        activeProjection: model?.active_projection || '',
        activeColorBy,
        defaultColorBy: tasksResolvedProjectionDefaultColorBy(model),
        availableColorModes,
        colorMix,
        resolvedCount,
        nodeCount: candidates.length,
        hits,
        misses,
    });
}

export function normalizeTasksColorHierarchy(value, model, nodeNotes = null) {
    const validColorKeys = new Set(tasksColorOptions(model, nodeNotes).map((option) => option.key));
    const raw = Array.isArray(value) ? value : [];
    const out = [];
    raw.forEach((entry) => {
        const key = String(entry || '').trim();
        if (key && validColorKeys.has(key) && !out.includes(key)) out.push(key);
    });
    return out;
}

function tasksCardStateColor(model, state) {
    const palette = model?.node_color_palettes?.[TASKS_CARD_STATE_ATTR];
    if (palette && typeof palette === 'object' && state in palette) return tasksDisplayPaletteColor(palette[state]);
    return state === TASKS_DEFAULT_CARD_STATES[1] ? tasksDisplayPaletteColor(TASKS_DONE_ACCENT) : '';
}

export function tasksCardStateForNode(model, nodeStates, nodeId, cardStates) {
    const firstState = cardStates[0] || TASKS_DEFAULT_CARD_STATES[0];
    const state = nodeStates?.[String(nodeId || '')] || firstState;
    const index = Math.max(0, cardStates.indexOf(state));
    return { label: state, done: index > 0, color: tasksCardStateColor(model, state) };
}

function tasksColorModeLabel(key) {
    return key === 'rank' ? 'Flow position' : tasksNodeMetaLabel(key);
}

function tasksIsSpecialColorMode(key) {
    return TASKS_SPECIAL_COLOR_MODE_KEYS.has(String(key || '').toLowerCase());
}

export function tasksColorOptions(model, nodeNotes = null) {
    const palettes = model?.node_color_palettes && typeof model.node_color_palettes === 'object'
        ? model.node_color_palettes
        : {};
    const declaredKeys = Object.keys(palettes).filter((key) => key && !(String(key) === TASKS_CARD_STATE_ATTR || TASKS_SPECIAL_NODE_ATTRS.has(String(key))) && typeof palettes[key] === 'object' && Object.keys(palettes[key] || {}).length > 0);
    const nodes = [...(model?.groups || []), ...(model?.tasks || [])];
    const keys = declaredKeys
        .filter((key) => nodes.some((node) => {
            return tasksAttrValues(node?.[key]).some((value) => String(value).trim() !== '');
        }));
    if (tasksHasAnyNodeNote(nodeNotes) && !keys.includes(TASKS_HAS_NOTE_ATTR)) keys.push(TASKS_HAS_NOTE_ATTR);
    return keys
        .map((key) => ({
            key,
            label: tasksColorModeLabel(key),
            special: tasksIsSpecialColorMode(key),
        }))
        .sort((a, b) => {
            if (a.special !== b.special) return a.special ? 1 : -1;
            return a.label.localeCompare(b.label);
        });
}

export function normalizeTasksGradientStops(palette) {
    if (!isTasksGradientPalette(palette)) return [];
    return palette.stops
        .map((stop) => ({
            at: Number(stop?.at),
            color: typeof stop?.color === 'string' ? stop.color.trim() : '',
            label: typeof stop?.label === 'string' ? stop.label.trim() : '',
        }))
        .filter((stop) => Number.isFinite(stop.at) && stop.color)
        .sort((a, b) => a.at - b.at);
}

export function tasksGradientDomain(palette, stops) {
    const rawDomain = Array.isArray(palette?.domain) ? palette.domain : [];
    const start = Number(rawDomain[0]);
    const end = Number(rawDomain[1]);
    if (Number.isFinite(start) && Number.isFinite(end) && end !== start) return { start, end };
    if (stops.length >= 2) return { start: stops[0].at, end: stops[stops.length - 1].at };
    return null;
}

function normalizeTasksGradientValue(value, domain, wrap) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue) || !domain) return null;
    const span = domain.end - domain.start;
    if (!Number.isFinite(span) || span === 0) return null;
    if (!wrap) return Math.min(domain.end, Math.max(domain.start, numericValue));
    const offset = ((numericValue - domain.start) % span + span) % span;
    return domain.start + offset;
}

function parseTasksHexColor(color) {
    let value = String(color || '').trim().replace(/^#/, '');
    if (/^[0-9a-f]{3}$/i.test(value)) value = value.split('').map((part) => part + part).join('');
    if (!/^[0-9a-f]{6}$/i.test(value)) return null;
    return {
        r: Number.parseInt(value.slice(0, 2), 16),
        g: Number.parseInt(value.slice(2, 4), 16),
        b: Number.parseInt(value.slice(4, 6), 16),
    };
}

function parseTasksRgbColor(color) {
    const match = String(color || '').trim().match(/^rgba?\(\s*([\d.]+)(?:\s*,\s*|\s+)([\d.]+)(?:\s*,\s*|\s+)([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/i);
    if (!match) return null;
    const alphaText = match[4] || '';
    const alpha = alphaText.endsWith('%') ? Number.parseFloat(alphaText) / 100 : Number.parseFloat(alphaText || '1');
    if (Number.isFinite(alpha) && alpha < 1) return null;
    return {
        r: Math.max(0, Math.min(255, Math.round(Number.parseFloat(match[1])))),
        g: Math.max(0, Math.min(255, Math.round(Number.parseFloat(match[2])))),
        b: Math.max(0, Math.min(255, Math.round(Number.parseFloat(match[3])))),
    };
}

function parseTasksDisplayColor(color) {
    return parseTasksHexColor(color) || parseTasksRgbColor(color);
}

function tasksRgbToHex({ r, g, b }) {
    return `#${[r, g, b].map((part) => Math.max(0, Math.min(255, Math.round(part))).toString(16).padStart(2, '0')).join('')}`;
}

function tasksSrgbToLinear(part) {
    const value = Math.max(0, Math.min(1, part / 255));
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function tasksLinearToSrgb(part) {
    const value = Math.max(0, Math.min(1, part));
    return Math.round(255 * (value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055));
}

function tasksRgbToOklab({ r, g, b }) {
    const lr = tasksSrgbToLinear(r);
    const lg = tasksSrgbToLinear(g);
    const lb = tasksSrgbToLinear(b);
    const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
    const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
    const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
    return {
        L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
        a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
        b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
    };
}

function tasksOklabToRgb({ L, a, b }) {
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
    return {
        r: tasksLinearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
        g: tasksLinearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
        b: tasksLinearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
    };
}

function tasksRelativeLuminance(rgb) {
    return 0.2126 * tasksSrgbToLinear(rgb.r) + 0.7152 * tasksSrgbToLinear(rgb.g) + 0.0722 * tasksSrgbToLinear(rgb.b);
}

function tasksContrastRatio(a, b) {
    const l1 = tasksRelativeLuminance(a);
    const l2 = tasksRelativeLuminance(b);
    const light = Math.max(l1, l2);
    const dark = Math.min(l1, l2);
    return (light + 0.05) / (dark + 0.05);
}

function interpolateTasksHexColor(startColor, endColor, ratio) {
    const start = parseTasksHexColor(startColor);
    const end = parseTasksHexColor(endColor);
    if (!start || !end) return '';
    const mix = (from, to) => Math.round(from + (to - from) * ratio);
    return `#${[mix(start.r, end.r), mix(start.g, end.g), mix(start.b, end.b)]
        .map((part) => part.toString(16).padStart(2, '0'))
        .join('')}`;
}

export function averageTasksHexColors(colors) {
    const parsed = (colors || []).map(parseTasksHexColor).filter(Boolean);
    if (!parsed.length) return '';
    const linear = (part) => {
        const value = part / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    };
    const labs = parsed.map(({ r, g, b }) => {
        const [lr, lg, lb] = [linear(r), linear(g), linear(b)];
        const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
        const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
        const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
        return {
            L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
            a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
            b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
        };
    });
    const average = (key) => labs.reduce((sum, color) => sum + color[key], 0) / labs.length;
    const L = average('L');
    const a = average('a');
    const b = average('b');
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
    const encode = (value) => {
        const bounded = Math.max(0, Math.min(1, value));
        const encoded = bounded <= 0.0031308 ? 12.92 * bounded : 1.055 * bounded ** (1 / 2.4) - 0.055;
        return Math.round(encoded * 255);
    };
    const rgb = [
        encode(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
        encode(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
        encode(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
    ];
    return `#${rgb.map((part) => part.toString(16).padStart(2, '0')).join('')}`;
}

function isTasksCssColor(value) {
    const text = String(value || '').trim();
    if (!text) return false;
    if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(text)) return true;
    if (/^(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color|color-mix)\(/i.test(text)) return true;
    if (/^(?:transparent|currentColor|inherit)$/i.test(text)) return true;
    if (/^var\(--[\w-]+\)$/i.test(text)) return true;
    return typeof CSS !== 'undefined' && typeof CSS.supports === 'function' ? CSS.supports('color', text) : false;
}

function resolveTasksGradientColor(palette, value) {
    const stops = normalizeTasksGradientStops(palette);
    if (stops.length < 2) return '';
    const domain = tasksGradientDomain(palette, stops);
    const normalized = normalizeTasksGradientValue(value, domain, Boolean(palette?.wrap));
    if (normalized === null) return '';
    if (normalized <= stops[0].at) return tasksDisplayPaletteColor(stops[0].color);
    for (let index = 1; index < stops.length; index += 1) {
        const prev = stops[index - 1];
        const current = stops[index];
        if (normalized > current.at) continue;
        const span = current.at - prev.at;
        if (!Number.isFinite(span) || span <= 0) return tasksDisplayPaletteColor(current.color);
        return tasksDisplayPaletteColor(interpolateTasksHexColor(prev.color, current.color, (normalized - prev.at) / span) || current.color);
    }
    return tasksDisplayPaletteColor(stops[stops.length - 1].color);
}

export function tasksColorPaletteFor(model, colorBy) {
    const key = String(colorBy || '').trim();
    if (!key) return {};
    if (key === TASKS_HAS_NOTE_ATTR) return TASKS_HAS_NOTE_PALETTE;
    const palettes = model?.node_color_palettes && typeof model.node_color_palettes === 'object'
        ? model.node_color_palettes
        : {};
    const configuredPalette = palettes[key];
    if (configuredPalette && Object.keys(configuredPalette).length > 0) return configuredPalette;
    const legacyKey = String(model?.color_by || '').trim();
    const legacyPalette = model?.color_palette && typeof model.color_palette === 'object' ? model.color_palette : {};
    if (key === legacyKey && Object.keys(legacyPalette).length > 0) return legacyPalette;
    return {};
}

export function tasksColorPaletteEntries(model, colorBy, nodeNotes = null) {
    const key = String(colorBy || '').trim();
    if (!key) return [];
    const palette = tasksColorPaletteFor(model, colorBy);
    if (isTasksGradientPalette(palette)) return [];
    if (key === TASKS_HAS_NOTE_ATTR) return tasksHasAnyNodeNote(nodeNotes) ? Object.entries(palette) : [];
    const presentValues = new Set(
        [...(model?.groups || []), ...(model?.tasks || [])]
            .flatMap((node) => tasksAttrValues(node?.[key]))
    );
    return Object.entries(palette)
        .filter(([value]) => presentValues.has(String(value)))
        .filter(([, color]) => typeof color === 'string' && color.trim())
        .sort(([a], [b]) => String(a).localeCompare(String(b)));
}

export function tasksEdgeColorPaletteFor(model, colorBy) {
    const key = String(colorBy || '').trim();
    if (!key) return {};
    const palettes = model?.edge_color_palettes && typeof model.edge_color_palettes === 'object' ? model.edge_color_palettes : {};
    const configuredPalette = palettes[key];
    if (configuredPalette && Object.keys(configuredPalette).length > 0) return configuredPalette;
    const legacyKey = String(model?.edge_color_by || '').trim();
    const legacyPalette = model?.edge_color_palette && typeof model.edge_color_palette === 'object' ? model.edge_color_palette : {};
    if (key === legacyKey && Object.keys(legacyPalette).length > 0) return legacyPalette;
    return {};
}

export function resolveTasksEdgeLabel(edge, model, activeProjection = null) {
    if (!edge) return '';
    // 1. A hand-written inline pipe label wins. A relation verb does NOT: it
    //    names the KIND of edge, and the pack echoes it into label, so it used
    //    to shadow edge_label_from entirely and no note could ever show. An
    //    authored edge_label_from is the more specific instruction, so a label
    //    that is only the relation repeated yields to it, then falls back to
    //    the verb at step 4 when the attr has nothing to say.
    const rawLabel = typeof edge.label === 'string' ? edge.label.trim() : '';
    const relation = typeof edge.relation === 'string' ? edge.relation.trim() : '';
    if (rawLabel && rawLabel !== relation) return rawLabel;
    // 2. Projection-requested attr.
    const projectionAttr = activeProjection && typeof activeProjection.edge_label_from === 'string'
        ? activeProjection.edge_label_from.trim() : '';
    // 3. Top-level default attr.
    const defaultAttr = typeof model?.edge_label_from === 'string' ? model.edge_label_from.trim() : '';
    const requestedAttr = projectionAttr || defaultAttr;
    if (requestedAttr) {
        const values = tasksAttrValues(edge[requestedAttr]);
        if (values.length) return values.join(', ');
    }
    // 4. The relation verb, if that is all there is.
    if (rawLabel) return rawLabel;
    // 5. Empty — user said this is fine.
    return '';
}

export function resolveTasksEdgeColor(edge, model, colorByOverride = null, paletteOverride = null) {
    if (!edge) return '';
    if (typeof edge.color === 'string' && edge.color.trim()) {
        const inlineColor = edge.color.trim();
        if (isTasksCssColor(inlineColor)) return inlineColor;
        logTasksDebugVerbose('edgeColorIgnored', {
            label: String(edge.label || ''),
            inlineColor,
            reason: 'not-css-color',
        });
    }
    const colorBy = colorByOverride !== null
        ? String(colorByOverride || '').trim()
        : (typeof model?.edge_color_by === 'string' ? model.edge_color_by.trim() : '');
    if (!colorBy) return '';
    const palette = paletteOverride && typeof paletteOverride === 'object'
        ? paletteOverride
        : tasksEdgeColorPaletteFor(model, colorBy);
    const values = tasksAttrValues(edge[colorBy]);
    const paletteKeys = values.length ? values : tasksAttrValues(edge.label);
    const colors = paletteKeys.map((value) => palette[value]).filter((color) => typeof color === 'string' && color.trim());
    return tasksDisplayPaletteColor(averageTasksHexColors(colors) || colors[0]?.trim() || '');
}

export function tasksGroupIdsContainingSelection(model, selectedIds) {
    const selected = selectedIds instanceof Set ? selectedIds : new Set(selectedIds || []);
    if (!selected.size) return new Set();
    const containers = new Set();
    for (const group of (model?.groups || [])) {
        const descendantIds = collectTasksGroupDescendantIds(group.id, model);
        for (const selectedId of selected) {
            if (selectedId === group.id || descendantIds.has(selectedId)) {
                containers.add(group.id);
                break;
            }
        }
    }
    return containers;
}

function resolveTasksProjectionGroupOwnColor(node, model, colorByOverride = null, paletteOverride = null) {
    if (!node || !node.__projection_group__) return '';
    const colorBy = colorByOverride !== null
        ? String(colorByOverride || '').trim()
        : (typeof model?.color_by === 'string' ? model.color_by.trim() : '');
    if (!colorBy) return '';
    const palette = paletteOverride && typeof paletteOverride === 'object'
        ? paletteOverride
        : tasksColorPaletteFor(model, colorBy);
    const value = node[colorBy];
    if (value === null || value === undefined || String(value).trim() === '') return '';
    if (isTasksGradientPalette(palette)) return resolveTasksGradientColor(palette, value);
    const color = palette[String(value)];
    return typeof color === 'string' && color.trim() ? tasksDisplayPaletteColor(color.trim()) : '';
}

export function resolveTasksProjectionGroupDimensionColor(node, model) {
    if (!node || !node.__projection_group__) return '';
    const palettes = model?.node_color_palettes;
    if (!palettes || typeof palettes !== 'object') return '';
    const reserved = new Set(['id', 'label', 'parent_group_id', 'projection', '__projection_group__', 'href', 'color']);
    for (const [key, value] of Object.entries(node)) {
        if (reserved.has(key)) continue;
        if (value === null || value === undefined || String(value).trim() === '') continue;
        const palette = tasksColorPaletteFor(model, key);
        if (!palette || typeof palette !== 'object') continue;
        if (isTasksGradientPalette(palette)) {
            const color = resolveTasksGradientColor(palette, value);
            if (color) return color;
            continue;
        }
        const color = palette[String(value)];
        if (typeof color === 'string' && color.trim()) return tasksDisplayPaletteColor(color.trim());
    }
    return '';
}

function resolveTasksNodeOwnColor(node, model, colorByOverride = null, paletteOverride = null) {
    if (!node) return '';
    const projectionColor = resolveTasksProjectionGroupOwnColor(node, model, colorByOverride, paletteOverride);
    if (projectionColor) return projectionColor;
    const colorBy = colorByOverride !== null
        ? String(colorByOverride || '').trim()
        : (typeof model?.color_by === 'string' ? model.color_by.trim() : '');
    const palette = paletteOverride && typeof paletteOverride === 'object'
        ? paletteOverride
        : tasksColorPaletteFor(model, colorBy);
    if (colorBy) {
        if (colorBy === TASKS_HAS_NOTE_ATTR) {
            const value = node?.__has_note__ ? 'yes' : 'no';
            return tasksDisplayPaletteColor(TASKS_HAS_NOTE_PALETTE[value] || '');
        }
        const values = tasksAttrValues(node[colorBy]);
        if (values.length) {
            if (isTasksGradientPalette(palette)) {
                const numeric = values.map(parseTasksNumericValue).filter((value) => value !== null);
                return numeric.length ? resolveTasksGradientColor(palette, numeric.reduce((sum, value) => sum + value, 0) / numeric.length) : '';
            }
            const colors = values.map((value) => palette[value]).filter((color) => typeof color === 'string' && color.trim());
            return tasksDisplayPaletteColor(averageTasksHexColors(colors) || colors[0]?.trim() || '');
        }
        return '';
    }
    if (typeof node.color === 'string' && node.color.trim()) return tasksDisplayPaletteColor(node.color.trim());
    return '';
}

export function resolveTasksNodeColor(node, model, colorByOverride = null, paletteOverride = null) {
    const ownColor = resolveTasksNodeOwnColor(node, model, colorByOverride, paletteOverride);
    if (ownColor) return ownColor;
    if (!node || !model) return '';
    const groupsById = Object.fromEntries((model.groups || []).map((group) => [group.id, group]));
    let parentId = node.parent_group_id || node.group_id || null;
    while (parentId) {
        const parent = groupsById[parentId];
        if (!parent) return '';
        const parentColor = resolveTasksNodeOwnColor(parent, model, colorByOverride, paletteOverride);
        if (parentColor) return parentColor;
        parentId = parent.parent_group_id || null;
    }
    return '';
}

export function resolveTasksCollapsedGroupColor(node, model, colorByOverride = null, paletteOverride = null) {
    if (!node || node.__kind__ !== 'group') return '';
    const colorBy = colorByOverride !== null
        ? String(colorByOverride || '').trim()
        : (typeof model?.color_by === 'string' ? model.color_by.trim() : '');
    if (!colorBy) return '';
    const palette = paletteOverride && typeof paletteOverride === 'object'
        ? paletteOverride
        : tasksColorPaletteFor(model, colorBy);
    const descendants = collectTasksGroupDescendants(node.id, model);
    const colorSources = descendants.tasks.length ? descendants.tasks : descendants.groups;
    if (!colorSources.length) return '';
    if (isTasksGradientPalette(palette)) {
        const values = colorSources.map((entry) => parseTasksNumericValue(entry?.[colorBy])).filter((value) => value !== null);
        if (values.length) {
            const average = values.reduce((sum, value) => sum + value, 0) / values.length;
            return resolveTasksGradientColor(palette, average);
        }
    }
    return averageTasksHexColors(
        colorSources
            .map((entry) => resolveTasksNodeOwnColor(entry, model, colorBy, palette))
            .filter(Boolean)
    );
}

export function tasksResolvedThemeColor(varName, fallback) {
    if (typeof window === 'undefined' || typeof window.getComputedStyle !== 'function') return fallback;
    const value = window.getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    return value || fallback;
}

function tasksIsDarkMode() {
    return typeof document !== 'undefined' && document.documentElement?.classList?.contains('dark');
}

function tasksChromaCappedOklab(lab) {
    const chroma = Math.hypot(lab.a, lab.b);
    if (!chroma || chroma <= TASKS_DARK_PALETTE_MAX_CHROMA) return lab;
    const scale = TASKS_DARK_PALETTE_MAX_CHROMA / chroma;
    return { ...lab, a: lab.a * scale, b: lab.b * scale };
}

export function tasksDisplayPaletteColor(color) {
    const raw = String(color || '').trim();
    if (!raw || !tasksIsDarkMode()) return raw;
    const paperColor = tasksResolvedThemeColor('--vyasa-paper', '#0f172a');
    const cacheKey = `${paperColor}|${raw}`;
    if (tasksDisplayPaletteColorCache.has(cacheKey)) return tasksDisplayPaletteColorCache.get(cacheKey);
    const rgb = parseTasksDisplayColor(raw);
    const paper = parseTasksDisplayColor(paperColor) || parseTasksHexColor('#0f172a');
    if (!rgb || !paper) {
        tasksDisplayPaletteColorCache.set(cacheKey, raw);
        return raw;
    }
    const lab = tasksChromaCappedOklab(tasksRgbToOklab(rgb));
    if (lab.L >= TASKS_DARK_PALETTE_MIN_L && tasksContrastRatio(rgb, paper) >= TASKS_DARK_PALETTE_CONTRAST) {
        tasksDisplayPaletteColorCache.set(cacheKey, raw);
        return raw;
    }
    let best = tasksOklabToRgb({ ...lab, L: Math.max(lab.L, TASKS_DARK_PALETTE_MIN_L) });
    for (let L = Math.max(lab.L, TASKS_DARK_PALETTE_MIN_L); L <= TASKS_DARK_PALETTE_MAX_L; L += 0.015) {
        const candidate = tasksOklabToRgb({ ...lab, L });
        best = candidate;
        if (tasksContrastRatio(candidate, paper) >= TASKS_DARK_PALETTE_CONTRAST) break;
    }
    const adjusted = tasksRgbToHex(best);
    tasksDisplayPaletteColorCache.set(cacheKey, adjusted);
    return adjusted;
}

function tasksMixedFill(color, colorMix) {
    if (!color) return '';
    const displayColor = tasksDisplayPaletteColor(color);
    return colorMix && colorMix.enabled
        ? `color-mix(in srgb, var(--vyasa-paper) ${colorMix.paper}%, ${displayColor} ${colorMix.intensity}%)`
        : displayColor;
}

export function tasksCompositeSweep(node, colorBy, palette, primaryColor = '', options = {}, colorMix = {}) {
    const values = tasksAttrValues(node?.[colorBy]);
    const colors = Array.from(new Set(values
        .map((value) => palette?.[value])
        .filter((color) => typeof color === 'string' && color.trim())
        .map((color) => tasksMixedFill(color.trim(), colorMix))));
    if (colors.length <= 1) return colors[0] || tasksMixedFill(primaryColor, colorMix) || '';
    const stops = colors.map((color, index) => `${color} ${Math.round((index / colors.length) * 100)}%`);
    stops.push(`${colors[0]} 100%`);
    return `linear-gradient(90deg, ${stops.join(', ')})`;
}

export function tasksNodeBackground(primaryColor, secondaryColor, colorMix, fallback, composite = false) {
    const primary = tasksMixedFill(primaryColor, colorMix);
    const secondary = tasksMixedFill(secondaryColor, colorMix);
    let fill = primary || fallback;
    if (primary && secondary && primaryColor !== secondaryColor) {
        fill = `linear-gradient(135deg, ${primary} 0 50%, ${secondary} 50% 100%)`;
    }
    return fill;
}

export function tasksGroupBackground(primaryColor, secondaryColor, fallback, options = {}) {
    const mode = options?.mode === 'transparent' ? 'transparent' : 'paper';
    const rawIntensity = Number.parseFloat(options?.intensity);
    const intensity = Math.max(0, Math.min(100, Number.isFinite(rawIntensity) ? rawIntensity : (mode === 'transparent' ? 10 : 12)));
    const mix = (color) => {
        if (!color) return '';
        return mode === 'transparent'
            ? `color-mix(in srgb, ${color} ${intensity}%, transparent)`
            : `color-mix(in srgb, var(--vyasa-paper) ${100 - intensity}%, ${color} ${intensity}%)`;
    };
    const primary = mix(primaryColor);
    const secondary = mix(secondaryColor);
    if (primary && secondary && primaryColor !== secondaryColor) {
        return `linear-gradient(135deg, ${primary} 0 50%, ${secondary} 50% 100%)`;
    }
    return primary || fallback;
}

// Clip a convex polygon to the half-plane { (x,y): a*x + b*y <= c } (Sutherland-Hodgman).
function tasksClipPolygon(poly, a, b, c) {
    const out = [];
    const n = poly.length;
    for (let i = 0; i < n; i++) {
        const cur = poly[i];
        const prev = poly[(i + n - 1) % n];
        const dCur = a * cur[0] + b * cur[1] - c;
        const dPrev = a * prev[0] + b * prev[1] - c;
        const curIn = dCur <= 1e-9;
        const prevIn = dPrev <= 1e-9;
        if (curIn !== prevIn) {
            const t = dPrev / (dPrev - dCur);
            out.push([prev[0] + t * (cur[0] - prev[0]), prev[1] + t * (cur[1] - prev[1])]);
        }
        if (curIn) out.push(cur);
    }
    return out;
}

// levels: array (one per color level) of arrays of color strings.
// Returns polygons: each level is a 45deg diagonal band, split into horizontal strips per value.
function tasksColorLevelPolygons(levels, width = 100, height = 100) {
    const active = (levels || []).filter((colors) => Array.isArray(colors) && colors.some(Boolean));
    const n = active.length;
    if (!n) return [];
    const w = Math.max(1, Number(width) || 100);
    const h = Math.max(1, Number(height) || 100);
    const rect = [[0, 0], [w, 0], [w, h], [0, h]];
    const out = [];
    active.forEach((colorsRaw, i) => {
        const colors = colorsRaw.filter(Boolean);
        let band = tasksClipPolygon(rect, 1, 1, ((w + h) * (i + 1)) / n);
        band = tasksClipPolygon(band, -1, -1, -((w + h) * i) / n);
        if (band.length < 3) return;
        const m = colors.length;
        colors.forEach((color, j) => {
            let strip = tasksClipPolygon(band, 0, 1, (h * (j + 1)) / m);
            strip = tasksClipPolygon(strip, 0, -1, -(h * j) / m);
            if (strip.length >= 3) out.push({ color, points: strip });
        });
    });
    return out;
}

function tasksColorLevelFromNode(node, model, spec, colorMix) {
    if (!spec || !spec.colorBy) return [];
    const values = tasksAttrValues(node?.[spec.colorBy]);
    const colors = values
        .map((value) => spec.palette?.[value])
        .filter((color) => typeof color === 'string' && color.trim());
    if (!colors.length) {
        const resolved = resolveTasksNodeColor(node, model, spec.colorBy, spec.palette);
        if (resolved) colors.push(resolved);
    }
    return Array.from(new Set(colors.map((color) => tasksMixedFill(color, colorMix))));
}

function tasksColorLevelFromCollapsedGroup(node, model, spec, colorMix, colorSources) {
    if (!spec || !spec.colorBy || !node || node.__kind__ !== 'group') return [];
    if (isTasksGradientPalette(spec.palette)) {
        const resolved = resolveTasksCollapsedGroupColor(node, model, spec.colorBy, spec.palette);
        return resolved ? [tasksMixedFill(resolved, colorMix)] : [];
    }
    const colors = (colorSources || [])
        .flatMap((entry) => tasksAttrValues(entry?.[spec.colorBy]).map((value) => spec.palette?.[value]))
        .filter((color) => typeof color === 'string' && color.trim());
    return Array.from(new Set(colors.map((color) => tasksMixedFill(color, colorMix))));
}

export function tasksNodeColorLevels(node, model, levelSpecs, colorMix, options = {}) {
    if (options.collapsedGroup) {
        // Walk the group's descendant tree once, then map every color level over the cached set.
        const descendants = (node && node.__kind__ === 'group')
            ? collectTasksGroupDescendants(node.id, model)
            : { tasks: [], groups: [] };
        const colorSources = descendants.tasks.length ? descendants.tasks : descendants.groups;
        return (levelSpecs || []).map((spec) => tasksColorLevelFromCollapsedGroup(node, model, spec, colorMix, colorSources));
    }
    return (levelSpecs || []).map((spec) => tasksColorLevelFromNode(node, model, spec, colorMix));
}

export function tasksUseColorOverlay(levels) {
    return (levels || []).reduce((sum, level) => sum + (Array.isArray(level) ? level.length : 0), 0) >= 2;
}

// Single seam for "is this built node drawn with the SVG color overlay?".
export function tasksNodeIsOverlaid(node) {
    const levels = node?.data?.__color_levels__;
    return Boolean(levels && levels.length);
}

export function tasksHoverFocusNodeStyle(node, nodeColor, displayColor, activeBorderColor, checkedShadow, colorMix, primary) {
    const baseZIndex = Number.isFinite(Number(node.zIndex)) ? Number(node.zIndex) : Number(node.style?.zIndex || 0);
    const zIndex = baseZIndex + (primary ? TASKS_SELECTED_Z_BOOST : TASKS_NEIGHBOR_Z_BOOST);
    return {
        zIndex,
        opacity: 1,
        '--vyasa-tasks-active-border': activeBorderColor,
        background: tasksNodeIsOverlaid(node)
            ? node.style.background
            : (node.data?.__kind__ === 'group'
                ? tasksGroupBackground(displayColor, '', TASKS_GROUP_BG_ACTIVE, { mode: 'transparent', intensity: primary ? 12 : 8 })
                : tasksNodeBackground(nodeColor, '', colorMix, TASKS_NODE_BG_ACTIVE, false)),
        boxShadow: `${checkedShadow !== 'none' ? `${checkedShadow}, ` : ''}0 0 0 ${primary ? 3 : 2}px color-mix(in srgb, ${displayColor} ${primary ? 76 : 68}%, transparent), 0 0 ${primary ? 24 : 32}px ${primary ? 6 : 8}px color-mix(in srgb, ${displayColor} ${primary ? 48 : 46}%, transparent)`,
    };
}

export function tasksHoverFocusEdge(edge, hoveredNodeId) {
    const edgeColor = edge.data?.edgeColor || edge.style?.stroke || 'currentColor';
    const branchOpacity = edge.data?.__projection_branch_opacity__ ?? 1;
    const strokeMode = edge.source === hoveredNodeId ? 'selected-out' : 'selected-in';
    return {
        ...edge,
        zIndex: TASKS_EDGE_FOCUS_Z,
        data: { ...edge.data, highlightMode: 'selected', strokeMode, flareKey: `hover:${hoveredNodeId || ''}` },
        labelStyle: { ...(edge.labelStyle || {}), fill: edgeColor, opacity: tasksProminentEdgeOpacity() * branchOpacity, fontWeight: 800 },
        labelBgStyle: { ...(edge.labelBgStyle || {}), fill: TASKS_EDGE_LABEL_BG, fillOpacity: 0.9 },
        style: { ...edge.style, stroke: edgeColor, opacity: tasksProminentEdgeOpacity() * branchOpacity, strokeWidth: Math.max(4.75, tasksEdgeStrokeWidthForMode(strokeMode)), strokeLinecap: 'round' },
    };
}

export function tasksReferenceFlowEdge(edge, markerType, fontSize = '12px', labelMaxWidth = 240) {
    const color = 'var(--vyasa-primary)';
    return {
        ...edge,
        type: 'vyasaEdge',
        data: { ...(edge.data || {}), __reference__: true, edgeColor: color, highlightMode: 'selected', strokeMode: 'selected' },
        markerEnd: { type: markerType, width: 8, height: 8, color },
        zIndex: TASKS_EDGE_FOCUS_Z,
        labelZIndex: TASKS_EDGE_LABEL_FOCUS_Z,
        labelMaxWidth,
        labelBgPadding: [6, 3],
        labelBgBorderRadius: 3,
        labelStyle: { fontSize, fontWeight: 700, fill: color, opacity: 1 },
        labelBgStyle: { fill: TASKS_EDGE_LABEL_BG, fillOpacity: 0.86 },
        style: { stroke: color, strokeWidth: 2.5, strokeLinecap: 'round', opacity: 1 },
    };
}

export function tasksEdgeRecordId(edge) {
    return String(edge?.__source_edge_id || edge?.id || '').trim();
}

// Build an inset SVG overlay element drawing the diagonal-band / horizontal-strip fill.
export function tasksColorOverlay(React, levels, width, height) {
    const w = Math.max(1, Number(width) || 100);
    const h = Math.max(1, Number(height) || 100);
    const polys = tasksColorLevelPolygons(levels, w, h);
    if (!polys.length) return null;
    return React.createElement('svg', {
        viewBox: `0 0 ${w} ${h}`,
        preserveAspectRatio: 'none',
        style: { position: 'absolute', inset: 0, width: '100%', height: '100%', borderRadius: 'inherit', pointerEvents: 'none', zIndex: 0 },
    }, ...polys.map((p, idx) => React.createElement('polygon', {
        key: idx,
        points: p.points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' '),
        fill: p.color,
    })));
}

function tasksResolvedProjectionDefaultColorBy(model, nodeNotes = null) {
    const defaultColorBy = tasksProjectionDefaultColorBy(model);
    return tasksColorOptions(model, nodeNotes).some((option) => option.key === defaultColorBy) ? defaultColorBy : '';
}

function resolveTasksPreferredColorBy(model, projectionId, prefs, nodeNotes = null) {
    const saved = typeof prefs?.colorBy === 'string' ? prefs.colorBy.trim() : '';
    const validColorKeys = new Set(tasksColorOptions(model, nodeNotes).map((option) => option.key));
    const defaultColorBy = tasksResolvedProjectionDefaultColorBy(model, nodeNotes);
    if (saved && validColorKeys.has(saved)) return saved;
    if (!String(projectionId || '').trim() && defaultColorBy && validColorKeys.has(defaultColorBy)) {
        return defaultColorBy;
    }
    return validColorKeys.has(defaultColorBy) ? defaultColorBy : '';
}

function resolveTasksPreferredSecondaryColorBy(model, prefs, nodeNotes = null) {
    const validColorKeys = new Set(tasksColorOptions(model, nodeNotes).map((option) => option.key));
    const saved = typeof prefs?.secondaryColorBy === 'string' ? prefs.secondaryColorBy.trim() : '';
    if (saved) return validColorKeys.has(saved) ? saved : '';
    const fallback = String(model?.default_secondary_color_by || '').trim();
    return validColorKeys.has(fallback) ? fallback : '';
}

export function resolveTasksPreferredColorHierarchy(model, projectionId, prefs, nodeNotes = null) {
    const explicit = normalizeTasksColorHierarchy(prefs?.colorHierarchy, model, nodeNotes);
    if (explicit.length) return explicit;
    const primary = resolveTasksPreferredColorBy(model, projectionId, prefs, nodeNotes);
    const secondary = resolveTasksPreferredSecondaryColorBy(model, prefs, nodeNotes);
    return normalizeTasksColorHierarchy([primary, secondary], model, nodeNotes);
}

export function tasksCssFontSize(value, fallback = '11px') {
    if (typeof value === 'number' && Number.isFinite(value)) return `${value}px`;
    if (typeof value === 'string' && value.trim()) return value.trim();
    return fallback;
}

export function tasksProminentEdgeLabelScale(zoom, edgeFontSize, nodeFontSize = TASKS_NODE_LABEL_FONT_SIZE, fixed = false) {
    const z = Number(zoom);
    if (!Number.isFinite(z) || z <= 0) return 1;
    if (fixed) return 1 / z;
    const edgePx = Number.parseFloat(tasksCssFontSize(edgeFontSize, '12px'));
    const nodePx = Number(nodeFontSize);
    const maxCounterScale = Number.isFinite(edgePx) && edgePx > 0 && Number.isFinite(nodePx) && nodePx > 0
        ? (nodePx * TASKS_EDGE_LABEL_NODE_SIZE_RATIO) / edgePx
        : 1;
    return Math.min(1 / z, maxCounterScale);
}

export const TASKS_NODE_LABEL_FONT_SIZE = 16;

export const TASKS_EDGE_LABEL_NODE_SIZE_RATIO = 1.35;
