// KG look registry: docs/implementation/KG_THEMING/design.md (look record).
// One record per node_look holds every part of that look. Code outside this
// module reads a look through the functions below and never compares its name.
// This module imports nothing, so every other KG module can import it.

// Mono figure type. The renderer draws with these metrics and layouts size with
// them, so a box always fits its text.
export const TASKS_OUTLINE_FONT = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
export const TASKS_OUTLINE_TITLE_FONT_SIZE = 14;
export const TASKS_OUTLINE_SUBTITLE_FONT_SIZE = 11;
const TASKS_OUTLINE_CHAR_EM = 0.62;
const TASKS_OUTLINE_PAD = { x: 28, y: 22 };
const TASKS_HAND_FONT = '"Comic Neue", "Chalkboard SE", "Marker Felt", "Comic Sans MS", cursive';
const TASKS_SKETCH_FILTER_ID = 'vyasa-kg-sketch';
export const TASKS_POINT_SIZE = 8;
const TASKS_TEXT_MAX_WIDTH = 220;
const TASKS_STATION_DOT = 16;
// A group title drawn as a plain label: small mono capitals on the frame.
const TASKS_LABEL_TITLE_FONT_SIZE = 12;

/**
 * Height of an outline node: wrapped mono title plus wrapped subtitle.
 *
 * >>> tasksOutlineNodeSize('Gate', '', 220)
 * { width: 220, height: 44 }
 * >>> tasksOutlineNodeSize('1 · Gate', 'anchored? judged? generic? duplicate?', 220).height
 * 73
 */
export function tasksOutlineNodeSize(title, subtitle, width) {
    const textWidth = Math.max(40, width - TASKS_OUTLINE_PAD.x);
    const lines = (text, size) => String(text || '').split(/\r?\n/).filter(Boolean)
        .reduce((count, part) => count + Math.max(1, Math.ceil((part.length * size * TASKS_OUTLINE_CHAR_EM) / textWidth)), 0);
    const titleHeight = Math.max(1, lines(title, TASKS_OUTLINE_TITLE_FONT_SIZE)) * TASKS_OUTLINE_TITLE_FONT_SIZE * 1.3;
    const subtitleLines = lines(subtitle, TASKS_OUTLINE_SUBTITLE_FONT_SIZE);
    const subtitleHeight = subtitleLines ? 3 + subtitleLines * TASKS_OUTLINE_SUBTITLE_FONT_SIZE * 1.35 : 0;
    return { width, height: Math.max(44, Math.ceil(titleHeight + subtitleHeight + TASKS_OUTLINE_PAD.y)) };
}

// An outline node carries its role colour in the border and the title, not in
// the fill, so a figure of many roles stays quiet.
export function tasksOutlineNodeStyle(color, active = false, dashed = false) {
    const tint = color || 'var(--vyasa-ink)';
    return {
        background: `color-mix(in srgb, ${tint} ${active ? 12 : 6}%, var(--vyasa-paper))`,
        border: `2px ${dashed ? 'dashed' : 'solid'} color-mix(in srgb, ${tint} 86%, transparent)`,
        color: `color-mix(in srgb, ${tint} 82%, var(--vyasa-ink))`,
    };
}

// One SVG filter per page gives every sketch frame the same hand wobble.
function ensureTasksSketchFilter() {
    if (typeof document === 'undefined' || document.getElementById(TASKS_SKETCH_FILTER_ID)) return;
    const holder = document.createElement('div');
    holder.setAttribute('aria-hidden', 'true');
    holder.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    holder.innerHTML = `<svg width="0" height="0"><filter id="${TASKS_SKETCH_FILTER_ID}"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="3"/><feDisplacementMap in="SourceGraphic" scale="3"/></filter></svg>`;
    document.body.appendChild(holder);
}

const glyphCharWidth = TASKS_OUTLINE_TITLE_FONT_SIZE * TASKS_OUTLINE_CHAR_EM;
const figureSize = (label, subtitle, width) => tasksOutlineNodeSize(label, subtitle, width);
const plainTitle = (title) => title;
const cardBody = () => ({ body: {}, title: plainTitle, after: [] });

// The parts every figure body shares: mono type and the muted subtitle line.
function figureParts(h, subtitle) {
    const mono = { fontFamily: TASKS_OUTLINE_FONT, fontSize: `${TASKS_OUTLINE_TITLE_FONT_SIZE}px`, fontWeight: '500' };
    const subtitleLine = (align = 'center', inset = '0') => (subtitle ? h('span', {
        key: 'subtitle',
        style: { display: 'block', marginTop: '3px', padding: `0 ${inset}`, fontSize: `${TASKS_OUTLINE_SUBTITLE_FONT_SIZE}px`, fontWeight: 400, lineHeight: 1.35, textAlign: align, color: 'color-mix(in srgb, var(--vyasa-ink) 64%, transparent)' },
    }, subtitle) : null);
    return { mono, subtitleLine };
}

const monoBody = (h, { subtitle }) => {
    const { mono, subtitleLine } = figureParts(h, subtitle);
    return { body: mono, title: plainTitle, after: [subtitleLine()] };
};

const symbolBody = (h, { subtitle }) => {
    const { mono } = figureParts(h, subtitle);
    return { body: { ...mono, padding: '0', justifyContent: 'center', textAlign: 'center', lineHeight: 1.3 }, title: plainTitle, after: [] };
};

/**
 * Look records. Fields:
 * - font: the type family the look draws its text in; '' keeps the page font.
 * - role: the role a node with this look plays unless its `node_role` names
 *   another (tasks_roles.js).
 * - frame: wrapper fill, border and type colour that replace the card's.
 * - stacks: a node with internals shows a stacked frame behind its own. A look
 *   with no frame of its own (text, station, point, sketch) keeps the badge.
 * - lit: how a lit node shows its state. `paint` names a TASKS_LIT_PAINTS
 *   entry; `fill` is the fill it keeps, or null for the card's lit fill.
 * - size: the box a layout gives the node; null uses the card's text sizing.
 * - body: the parts of the node body the look owns: type, a frame behind the
 *   label, how the title is wrapped, and what follows it.
 * - route: where routed edges meet the node: its box or its dot.
 * - groupLook: the look a group with this look takes for its frame.
 * - title: a group's title as a 'bar' over the frame or a plain 'label'.
 */
const TASKS_LOOKS = {
    card: {
        role: 'item',
        stacks: true,
        font: '',
        frame: () => ({}),
        lit: { paint: 'rings', fill: () => null },
        size: () => null,
        body: cardBody,
        route: 'box',
        groupLook: 'card',
        title: 'bar',
    },
    outline: {
        role: 'item',
        stacks: true,
        font: TASKS_OUTLINE_FONT,
        frame: ({ color, dashed }) => tasksOutlineNodeStyle(color, false, dashed),
        lit: { paint: 'rings', fill: (color) => tasksOutlineNodeStyle(color, true).background },
        size: figureSize,
        body: monoBody,
        route: 'box',
        groupLook: 'outline',
        title: 'label',
    },
    sketch: {
        role: 'item',
        stacks: false,
        font: TASKS_HAND_FONT,
        // The body draws the wobbling frame, so the text above it stays crisp.
        frame: ({ tint }) => ({ background: 'transparent', border: 'none', color: tint, overflow: 'visible' }),
        lit: { paint: 'bands', fill: () => 'transparent' },
        size: figureSize,
        body: (h, { subtitle, dashed }) => {
            const { subtitleLine } = figureParts(h, subtitle);
            ensureTasksSketchFilter();
            return {
                body: { fontFamily: TASKS_HAND_FONT, fontSize: '15px', fontWeight: '500' },
                // The frame wobbles; the title sits above it in plain ink.
                frame: h('div', {
                    'aria-hidden': 'true',
                    style: {
                        position: 'absolute', inset: '1px', borderRadius: '3px', pointerEvents: 'none',
                        border: `1.8px ${dashed ? 'dashed' : 'solid'} currentColor`,
                        background: 'repeating-linear-gradient(-41deg, color-mix(in srgb, currentColor 34%, transparent) 0 1.6px, transparent 1.6px 7px)',
                        filter: `url(#${TASKS_SKETCH_FILTER_ID})`,
                    },
                }),
                title: (title) => h('span', { style: { color: 'var(--vyasa-ink)' } }, title),
                after: [subtitleLine()],
            };
        },
        route: 'box',
        groupLook: 'sketch',
        title: 'label',
    },
    blueprint: {
        role: 'item',
        stacks: true,
        font: TASKS_OUTLINE_FONT,
        frame: ({ line }) => ({ background: 'transparent', border: `1.3px ${line} color-mix(in srgb, var(--vyasa-ink) 85%, transparent)`, color: 'var(--vyasa-ink)', borderRadius: 0 }),
        lit: { paint: 'rings', fill: () => 'transparent' },
        size: figureSize,
        body: monoBody,
        route: 'box',
        groupLook: 'blueprint',
        title: 'label',
    },
    tab: {
        role: 'item',
        stacks: true,
        font: TASKS_OUTLINE_FONT,
        frame: ({ tint, line }) => ({ background: 'var(--vyasa-paper)', border: `1px ${line} color-mix(in srgb, ${tint} 70%, transparent)`, color: tint, borderRadius: 4 }),
        lit: { paint: 'rings', fill: () => 'var(--vyasa-paper)' },
        // A header tab adds its band and its [kind] line above the subtitle.
        size: (label, subtitle, width) => ({ width, height: figureSize(label, subtitle, width).height + 22 }),
        body: (h, { subtitle, kind }) => {
            const { mono, subtitleLine } = figureParts(h, subtitle);
            return {
                // No side padding: the band spans the whole box, and each line
                // under it carries its own inset.
                body: { ...mono, fontSize: '12px', flexDirection: 'column', alignItems: 'stretch', justifyContent: 'flex-start', textAlign: 'left', padding: '0 0 8px' },
                // C4: the name on a band in the role colour, then [kind], then the subtitle.
                title: (title) => h('span', {
                    style: { display: 'block', marginBottom: '6px', padding: '4px 10px', background: 'currentColor', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
                }, h('span', { style: { color: 'var(--vyasa-paper)', fontWeight: 650 } }, title)),
                after: [
                    kind ? h('span', { key: 'kind', style: { display: 'block', padding: '0 10px', fontSize: '10.5px', fontWeight: 500 } }, `[${kind}]`) : null,
                    subtitleLine('left', '10px'),
                ],
            };
        },
        route: 'box',
        groupLook: 'tab',
        title: 'label',
    },
    station: {
        role: 'item',
        stacks: false,
        font: '',
        frame: () => ({ background: 'transparent', border: 'none', color: 'var(--vyasa-ink)', overflow: 'visible' }),
        lit: { paint: 'ink', fill: () => 'transparent' },
        // A station is a dot with its label above it; the box only holds the label.
        size: (label, subtitle, width) => ({ width, height: 48 }),
        body: (h, { dashed }) => ({
            body: { fontSize: '12px', fontWeight: '650', padding: '0', justifyContent: 'flex-start', flexDirection: 'column', alignItems: 'center', overflow: 'visible' },
            // The dot sits at the centre, where routes end; the name sits above it.
            frame: h('div', {
                'aria-hidden': 'true',
                style: {
                    position: 'absolute', left: '50%', top: '50%', width: `${TASKS_STATION_DOT}px`, height: `${TASKS_STATION_DOT}px`, transform: 'translate(-50%, -50%)',
                    boxSizing: 'border-box', borderRadius: '50%', background: 'var(--vyasa-paper)',
                    border: `3px ${dashed ? 'dashed' : 'solid'} currentColor`, pointerEvents: 'none', zIndex: 2,
                },
            }),
            title: (title) => h('span', { style: { display: 'block', lineHeight: '14px', whiteSpace: 'nowrap' } }, title),
            after: [],
        }),
        route: 'dot',
        groupLook: 'card',
        title: 'bar',
    },
    // A point is where routes join; the lines are the mark.
    point: {
        role: 'junction',
        stacks: false,
        font: TASKS_OUTLINE_FONT,
        frame: () => ({ background: 'transparent', border: 'none', borderRadius: '50%', overflow: 'visible' }),
        lit: { paint: 'none', fill: () => 'transparent' },
        size: () => ({ width: TASKS_POINT_SIZE, height: TASKS_POINT_SIZE }),
        body: () => ({ body: { padding: '0' }, title: () => null, after: [] }),
        route: 'box',
        groupLook: 'outline',
        title: 'label',
    },
    // A circle holds a symbol such as `+`.
    circle: {
        role: 'mark',
        stacks: true,
        font: TASKS_OUTLINE_FONT,
        frame: ({ color, dashed }) => {
            const ring = tasksOutlineNodeStyle(color, false, dashed);
            return { ...ring, border: ring.border.replace(/^2px/, '1.5px'), borderRadius: '50%' };
        },
        lit: { paint: 'rings', fill: () => null },
        size: (label) => {
            const diameter = Math.max(36, Math.ceil(String(label || '').length * glyphCharWidth) + 18);
            return { width: diameter, height: diameter };
        },
        body: symbolBody,
        route: 'box',
        groupLook: 'outline',
        title: 'label',
    },
    // Text is a bare mono label.
    text: {
        role: 'mark',
        stacks: false,
        font: TASKS_OUTLINE_FONT,
        frame: ({ tint }) => ({ background: 'transparent', border: 'none', color: `color-mix(in srgb, ${tint} 82%, var(--vyasa-ink))`, overflow: 'visible' }),
        lit: { paint: 'ink', fill: () => 'transparent' },
        size: (label) => {
            const length = String(label || '').length;
            const lines = Math.max(1, Math.ceil((length * glyphCharWidth) / (TASKS_TEXT_MAX_WIDTH - 12)));
            return {
                width: Math.min(TASKS_TEXT_MAX_WIDTH, Math.ceil(length * glyphCharWidth) + 12),
                height: Math.ceil(lines * TASKS_OUTLINE_TITLE_FONT_SIZE * 1.3 + 10),
            };
        },
        body: symbolBody,
        route: 'box',
        groupLook: 'outline',
        title: 'label',
    },
};

export const TASKS_NODE_LOOKS = Object.keys(TASKS_LOOKS);

const tasksLook = (look) => TASKS_LOOKS[look] || TASKS_LOOKS.card;

// The look-owned part of a node's wrapper style. A card keeps the fill and
// border it was given; another look replaces them. A dashed node dashes either border.
export function tasksNodeLookStyle(cardStyle, look, nodeColor, dashed = false) {
    const tint = nodeColor || 'var(--vyasa-ink)';
    const line = dashed ? 'dashed' : 'solid';
    const style = { ...cardStyle, ...tasksLook(look).frame({ tint, line, color: nodeColor, dashed }) };
    if (dashed && typeof style.border === 'string') style.border = style.border.replace(' solid ', ' dashed ');
    return style;
}

// The fill a lit node keeps, or null when the look keeps the card's lit fill.
export function tasksLookLitFill(look, nodeColor) {
    return tasksLook(look).lit.fill(nodeColor);
}

/**
 * The box a look gives a node, or null when the card's text sizing applies.
 *
 * >>> tasksLookSize('point', 'fork', '', 220)
 * { width: 8, height: 8 }
 * >>> tasksLookSize('circle', '+', '', 220)
 * { width: 36, height: 36 }
 * >>> tasksLookSize('text', 'Nx', '', 220)
 * { width: 30, height: 29 }
 * >>> tasksLookSize('card', 'Gate', '', 220)
 * null
 */
export function tasksLookSize(look, label, subtitle, width) {
    return tasksLook(look).size(label, subtitle, width);
}

// The body parts a look owns. `dashed` and `kind` come from the node.
export function tasksLookBody(React, look, { dashed = false, kind = '' } = {}, subtitle = '') {
    return tasksLook(look).body(React.createElement, { dashed, kind: String(kind || '').trim(), subtitle });
}

// The rect routed edges meet: the node box, or the station dot.
export function tasksLookRouteRect(look, rect) {
    if (!rect || tasksLook(look).route === 'box') return rect;
    const cx = rect.x + rect.width / 2;
    const cy = rect.y + rect.height / 2;
    return { x: cx - TASKS_STATION_DOT / 2, y: cy - TASKS_STATION_DOT / 2, width: TASKS_STATION_DOT, height: TASKS_STATION_DOT };
}

// The role a node with this look plays unless it names its own.
export function tasksLookDefaultRole(look) {
    return tasksLook(look).role;
}

// The look a group frame takes, and whether its title is a bar or a label.
export function tasksGroupLook(look) {
    return tasksLook(look).groupLook;
}

export function tasksGroupTitleMode(look) {
    return tasksLook(tasksGroupLook(look)).title;
}

/**
 * Size of a group title drawn as a label: wrapped small mono capitals.
 *
 * >>> tasksLabelTitleSize('Encoder', 200)
 * { width: 200, height: 24 }
 */
export function tasksLabelTitleSize(label, width) {
    const textWidth = Math.max(40, width - 8);
    const lines = Math.max(1, Math.ceil((String(label || '').length * TASKS_LABEL_TITLE_FONT_SIZE * TASKS_OUTLINE_CHAR_EM * 1.1) / textWidth));
    return { width, height: Math.ceil(lines * TASKS_LABEL_TITLE_FONT_SIZE * 1.3 + 8) };
}

// The paint of a group title. A bar has its own fill and border; a label is
// type on the group's frame, with no box of its own.
export function tasksGroupTitleLook(look, color) {
    if (tasksGroupTitleMode(look) === 'bar') return null;
    return {
        style: { background: 'transparent', border: 'none', boxShadow: 'none' },
        body: {
            fontFamily: tasksLook(tasksGroupLook(look)).font || TASKS_OUTLINE_FONT,
            fontSize: `${TASKS_LABEL_TITLE_FONT_SIZE}px`,
            fontWeight: '650',
            letterSpacing: '.06em',
            textTransform: 'uppercase',
            padding: '2px 4px',
            color: `color-mix(in srgb, ${color || 'var(--vyasa-ink)'} 78%, var(--vyasa-ink))`,
        },
    };
}

// The resting ring of an open group. The card's ring comes from tasks.css; a
// figure frame is its own outline, so it draws no ring.
export function tasksGroupRingTokens(look) {
    return tasksGroupTitleMode(look) === 'label' ? { '--kg-group-ring': 'none' } : {};
}

// A routed edge with no colour of its own is muted ink, so colour stays for emphasis.
export const TASKS_LINE_EDGE_INK = 'color-mix(in srgb, var(--vyasa-ink) 58%, transparent)';

// Edge path records: width at rest and focused, ink when the edge has no
// colour, and line caps. A ribbon swells its width into a taper, so it starts
// wider; a metro line is the picture, so it is drawn thick.
const TASKS_ROUTED_EDGE = { width: 1.5, focused: 2.5, ink: TASKS_LINE_EDGE_INK, dash: '6 5' };
const TASKS_EDGE_PATH_STYLES = {
    ribbon: { width: 2.5, focused: 4.75, ink: 'currentColor', dash: '6 5' },
    line: TASKS_ROUTED_EDGE,
    orthogonal: TASKS_ROUTED_EDGE,
    octilinear: { width: 5, focused: 7, ink: 'var(--vyasa-ink)', dash: '2 9', caps: { strokeLinecap: 'round', strokeLinejoin: 'round' } },
    arc: TASKS_ROUTED_EDGE,
};

export const TASKS_EDGE_PATHS = Object.keys(TASKS_EDGE_PATH_STYLES);

const tasksEdgePathStyle = (edgePath) => TASKS_EDGE_PATH_STYLES[edgePath] || (edgePath ? TASKS_ROUTED_EDGE : TASKS_EDGE_PATH_STYLES.ribbon);

// The width an edge is drawn at, by its path.
export function tasksEdgeBaseWidth(edgePath, focused = false) {
    const style = tasksEdgePathStyle(edgePath);
    return focused ? style.focused : style.width;
}

// The width of a lit or dimmed edge in a highlight pass. A ribbon takes the
// pass's width, and one half of a pair stays no wider than 2.6 lit or 1.9
// dimmed, so the pair keeps its gap.
// A routed or metro edge keeps its path's own widths.
export function tasksEdgeStateWidth(edge, lit, ribbonWidth) {
    const path = edge?.data?.__edge_path__;
    if (path && path !== 'ribbon') return tasksEdgeBaseWidth(path, lit);
    if (edge?.data?.__pair_half__) return Math.min(lit ? 2.6 : 1.9, ribbonWidth);
    return ribbonWidth;
}

// The stroke of an edge, by its path. An edge colour wins over the path's ink.
export function tasksEdgeStrokeStyle(edgePath, edgeColor, dashed = false) {
    const style = tasksEdgePathStyle(edgePath);
    return {
        stroke: edgeColor || style.ink,
        strokeWidth: style.width,
        ...(style.caps || {}),
        ...(dashed ? { strokeDasharray: style.dash } : {}),
    };
}

// Canvas records. A canvas restates the colour tokens for the graph pane, so
// every node and edge inside picks the canvas up without knowing about it.
const TASKS_CANVAS_STYLES = {
    plain: { style: {}, background: null },
    blueprint: {
        style: {
            '--vyasa-paper': '#123a63',
            '--vyasa-ink': '#e8f1ff',
            '--vyasa-primary': '#8fb3d9',
            background: '#123a63',
            color: '#e8f1ff',
        },
        background: { variant: 'lines', gap: 24, size: 1, color: 'rgba(143, 179, 217, 0.28)' },
    },
};

export const TASKS_CANVASES = Object.keys(TASKS_CANVAS_STYLES);

export function tasksCanvasStyle(canvas) {
    return { ...(TASKS_CANVAS_STYLES[canvas] || TASKS_CANVAS_STYLES.plain).style };
}

export function tasksCanvasBackgroundProps(canvas, props) {
    const background = (TASKS_CANVAS_STYLES[canvas] || TASKS_CANVAS_STYLES.plain).background;
    return background ? { ...props, ...background } : props;
}

// Highlight state paint: design.md (Lit paint). The state table sets how
// strongly each state rings; the look's lit paint sets what draws it. Ring:
// [width, colour %]. A lit node paints only rings with no blur, outlines, ink
// and opacity: a blurred shadow or a filter repaints every lit node on each hover.
const TASKS_STATE_RINGS = {
    // An endpoint of the edge whose card is open.
    endpoint: { ring: [2, 70], central: true },
    // A member of a multi-selection.
    picked: { ring: [2, 70], central: true },
    selected: { ring: [2, 70], central: true },
    neighbor: { ring: [2, 66], central: false },
    neighborFocus: { ring: [3, 72], central: false },
    hover: { ring: [3, 76], central: true },
    hoverNeighbor: { ring: [2, 68], central: false },
};

/**
 * Lit paints. Fields:
 * - ring: a box-shadow ring on the node wrapper.
 * - bands: outline bands around the node box (TasksNodeHighlightBorders).
 * - ink: the wrapper's text takes the ring colour and an underline, solid
 *   for a central state and dotted for a neighbour.
 */
const TASKS_LIT_PAINTS = {
    rings: { ring: true, bands: true, ink: false },
    bands: { ring: false, bands: true, ink: false },
    ink: { ring: false, bands: false, ink: true },
    none: { ring: false, bands: false, ink: false },
};

// The stacked frame behind a node with internals: design KG_INTERNALS
// (Indicator). A second frame 5px down and right, as zero-blur shadows: a paper
// fill, then a rim. The wrapper sets the rim colour once at rest, so lit states
// keep it. '' when the look draws no stack.
export function tasksStackShadow(look) {
    if (!tasksLookStacks(look)) return '';
    return '5px 5px 0 -1px var(--vyasa-paper), 5px 5px 0 0 var(--vyasa-tasks-stack-rim, color-mix(in srgb, var(--vyasa-ink) 60%, transparent))';
}

export function tasksLookStacks(look) {
    return tasksLook(look).stacks;
}

// The lit paint record of a look.
export function tasksLookLitPaint(look) {
    return TASKS_LIT_PAINTS[tasksLook(look).lit.paint];
}

/**
 * The box shadow of a lit node: its checked shadow first, then the state's
 * ring in the node's colour, at the strength its role's bands allow.
 *
 * >>> tasksStateShadow('endpoint', '#f00')
 * '0 0 0 2px color-mix(in srgb, #f00 70%, transparent)'
 * >>> tasksStateShadow('hover', '#f00', 'none', 'thin')
 * '0 0 0 1px color-mix(in srgb, #f00 76%, transparent)'
 */
export function tasksStateShadow(state, color, checkedShadow = 'none', bands = 'full') {
    // A role with thin bands keeps a 1px ring; one with none keeps only its checked shadow.
    if (bands === 'none') return checkedShadow;
    const [width, percent] = TASKS_STATE_RINGS[state].ring;
    return [
        checkedShadow !== 'none' ? checkedShadow : '',
        `0 0 0 ${bands === 'thin' ? 1 : width}px color-mix(in srgb, ${color} ${percent}%, transparent)`,
    ].filter(Boolean).join(', ');
}

/**
 * The style a lit node takes for a state, by its look's lit paint and its
 * role's bands. `border` is the colour of its outline bands. `stackShadow`
 * stays under the ring, so a node with internals keeps its stack when lit.
 *
 * >>> tasksLitStyle('text', 'hover', '#f00')
 * { '--vyasa-tasks-active-border': '#f00', boxShadow: 'none', color: '#f00', textDecoration: 'underline solid #f00' }
 * >>> tasksLitStyle('point', 'hover', '#f00', { bands: 'none' }).boxShadow
 * 'none'
 */
export function tasksLitStyle(look, state, color, { bands = 'full', checkedShadow = 'none', stackShadow = '', border = color } = {}) {
    const paint = tasksLookLitPaint(look);
    const shadow = paint.ring ? tasksStateShadow(state, color, checkedShadow, bands) : checkedShadow;
    const style = {
        '--vyasa-tasks-active-border': border,
        boxShadow: [shadow, stackShadow].filter((part) => part && part !== 'none').join(', ') || 'none',
    };
    if (!paint.ink || bands === 'none') return style;
    const line = TASKS_STATE_RINGS[state].central ? 'solid' : 'dotted';
    return { ...style, color, textDecoration: `underline ${line} ${color}` };
}

// The inset and outer ring a checked node shows in its card-state colour.
export function tasksCheckedShadow(accent) {
    return `inset 0 0 0 2px color-mix(in srgb, ${accent} 24%, transparent), 0 0 0 2px color-mix(in srgb, ${accent} 34%, transparent)`;
}

// Opacity of a dimmed node: under a node selection, and under every other pass.
export const TASKS_SELECTION_DIM_OPACITY = 0.22;
export const TASKS_DIM_OPACITY = 0.18;
// Ink of a dimmed edge and of its label.
export const TASKS_DIM_EDGE_INK = 'color-mix(in srgb, var(--vyasa-ink) 38%, transparent)';
export const TASKS_DIM_LABEL_INK = 'color-mix(in srgb, var(--vyasa-ink) 26%, transparent)';
