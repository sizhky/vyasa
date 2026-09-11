import { logTasksDebugVerbose, traceTasksEdge } from './tasks_diagnostics.js';
import { isTasksEdgeLabelVisible, tasksEdgeLabelZForMode } from './tasks_graph_core.js';
import {
    TASKS_EDGE_LABEL_FOCUS_Z, TASKS_EDGE_LABEL_SELECTED_Z, TASKS_EDGE_LABEL_TEXT, TASKS_EDGE_LABEL_Z,
    TASKS_NODE_LABEL_FONT_SIZE, TASKS_PAIR_LABEL_LIFT, tasksCssFontSize, tasksOpenArrowHeadPath,
    tasksPairedEdgePath, tasksProminentEdgeLabelScale, tasksSideWeightedRibbonPath, tasksTaperedArrowHeadPath,
    tasksTaperedBezierPath, tasksTrimBezierEnd,
} from './tasks_paint.js';

export function createTasksEdgeRenderer(React, rf) {
    const TasksProminentEdgeLabel = ({ labelX, labelY, labelZIndex, labelBgPadding, labelBgBorderRadius, labelMaxWidth, labelStyle, labelBgStyle, fullLabel, displayLabel }) => {
                    const viewport = typeof rf.useViewport === 'function' ? rf.useViewport() : { zoom: 1 };
                    const labelScale = tasksProminentEdgeLabelScale(viewport?.zoom, labelStyle.fontSize, TASKS_NODE_LABEL_FONT_SIZE, labelStyle.counterScaleMode === 'fixed');
                    return React.createElement(rf.EdgeLabelRenderer, null,
                        React.createElement('div', {
                            style: {
                                position: 'absolute',
                                transform: `translate(${labelX}px, ${labelY}px)`,
                                pointerEvents: 'none',
                                zIndex: labelZIndex || TASKS_EDGE_LABEL_Z,
                            },
                            title: fullLabel,
                        },
                        React.createElement('div', {
                            style: {
                                transform: `translate(-50%, -50%) scale(${labelScale})`,
                                transformOrigin: 'center center',
                                padding: `${labelBgPadding?.[1] || 0}px ${labelBgPadding?.[0] || 0}px`,
                                borderRadius: `${labelBgBorderRadius || 0}px`,
                                position: 'relative',
                            },
                        },
                        React.createElement('div', {
                            style: {
                                position: 'absolute',
                                inset: 0,
                                borderRadius: 'inherit',
                                background: labelBgStyle.fill || 'transparent',
                                opacity: labelBgStyle.fillOpacity ?? 1,
                            },
                        }),
                        React.createElement('div', {
                            style: {
                                position: 'relative',
                                color: labelStyle.fill || TASKS_EDGE_LABEL_TEXT,
                                fontSize: tasksCssFontSize(labelStyle.fontSize),
                                fontWeight: labelStyle.fontWeight || 600,
                                whiteSpace: 'pre-line',
                                textAlign: 'center',
                                lineHeight: 1.35,
                                maxWidth: `${labelMaxWidth || 240}px`,
                                opacity: labelStyle.opacity ?? 1,
                            },
                        }, displayLabel)))
                    );
                };
    return React.memo((props) => {
                // A pair draws two lines a few pixels apart, one either side of the
                // path they share. Shifting the endpoints, not the finished path,
                // keeps the arrowhead and the label solver working on the line
                // that is actually drawn.
                const pairLift = Number(props.data?.__pair_lift__) || 0;
                const [path, rawLabelX, rawLabelY] = tasksPairedEdgePath(props, pairLift, props.data?.__pair_half__ || '');
                // A sequence row is a horizontal line, so a centred label sits right on
                // top of it. Lift it clear of the stroke.
                // A pair's two halves share one midpoint, so both labels land on the
                // same spot. Push each along its OWN chord normal: a reply's chord
                // runs the other way, so one signed value separates them at any
                // angle. This replaces the sequence view's y-only lift for a pair,
                // which was both too small and wrong for a diagonal row.
                const labelChordLen = Math.hypot(props.targetX - props.sourceX, props.targetY - props.sourceY) || 1;
                // The normal is oriented UPWARD first, then the HALF picks the side:
                // a call above the row, its reply below. Taking each half's own chord
                // normal instead tied the side to the direction of travel, so a call
                // that ran right to left put its own words below the line and its
                // reply's words above -- where they read as part of the row above.
                // UML draws a reply under its call whichever way the arrow points.
                const labelNormalX = -(props.targetY - props.sourceY) / labelChordLen;
                const labelNormalY = (props.targetX - props.sourceX) / labelChordLen;
                const labelUp = (labelNormalY > 0 || (labelNormalY === 0 && labelNormalX > 0)) ? -1 : 1;
                const labelLift = pairLift
                    ? (String(props.data?.__pair_half__ || '') === 'reply' ? -TASKS_PAIR_LABEL_LIFT : TASKS_PAIR_LABEL_LIFT)
                    : 0;
                const labelPairOffsetX = labelUp * labelNormalX * labelLift;
                const labelPairOffsetY = labelUp * labelNormalY * labelLift;
                const labelX = rawLabelX + labelPairOffsetX;
                // A reply drawn on a row of its own still reads with its call, so
                // the layout may move the TEXT back to the call's row. The line
                // does not move: the frame between them needs that height.
                const labelBaseY = rawLabelY + (Number(props.data?.__sequence_label_dy__) || 0);
                const labelY = pairLift
                    ? labelBaseY + labelPairOffsetY
                    : labelBaseY - (Number(props.data?.__sequence_label_lift__) || 0);
                React.useEffect(() => {
                    traceTasksEdge('render', props, {
                        sourceX: props.sourceX,
                        sourceY: props.sourceY,
                        sourcePosition: props.sourcePosition,
                        targetX: props.targetX,
                        targetY: props.targetY,
                        targetPosition: props.targetPosition,
                    });
                }, [
                    props.source, props.target, props.sourceX, props.sourceY, props.sourcePosition,
                    props.targetX, props.targetY, props.targetPosition,
                ]);
                const fullLabel = String(props.label || '').replace(/\\n/g, '\n');
                const labelLines = fullLabel.split(/\r?\n/);
                const highlightMode = props.data?.highlightMode || 'none';
                const strokeMode = props.data?.strokeMode || highlightMode;
                // A pair half keeps its even width -- swelling it would close the gap
                // between the two halves -- but it must still taper to nothing at the
                // tip, or the shaft arrives at full width beside its own barb.
                // A reply whose label moved back to its call draws no line: the
                // frame's bottom border already marks where it leaves.
                const lineOff = props.data?.__line_off__ === true;
                const strokeWidth = Number(props.style?.strokeWidth) || 1.25;
                const fullArrow = Math.max(10, strokeWidth * 3.0);
                const chord = Math.hypot(props.targetX - props.sourceX, props.targetY - props.sourceY);
                // Both ends on one side means the path arcs away and comes back,
                // so its chord says nothing about how long it is drawn.
                const isArcEdge = props.sourcePosition === props.targetPosition;
                const arrowSize = isArcEdge ? fullArrow : Math.max(6, Math.min(fullArrow, chord * 0.22));
                // A plain edge arrives with body: the ribbon stops at the head's base
                // and keeps a share of its departure width there, so the line reads
                // as one shape with the arrow instead of fading out before it.
                // The width stays under the head's base width, or the blunt end
                // would widen the silhouette where the head should be widest.
                const taperSourceWidth = (Number(props.style?.strokeWidth) || 4) * 2.65;
                const taperTargetWidth = Math.min(taperSourceWidth * 0.1, arrowSize * 1.18 * 0.5);
                const taperPath = props.data?.__pair_half__ ? tasksTaperedBezierPath(
                    path,
                    Number(props.style?.strokeWidth) || 1.9,
                    0
                ) : tasksTaperedBezierPath(
                    tasksTrimBezierEnd(path, arrowSize * 0.85),
                    taperSourceWidth,
                    taperTargetWidth
                );
                // A pair's two lanes sit 2x|lift| apart. A casing wider than one lane
                // crosses the centerline and clips the other half's line, which is why
                // a pair used to read as one fat cased blob. Fit the casing to the lane.
                const casingWidth = pairLift
                    ? Math.max(strokeWidth + 0.6, Math.abs(pairLift) * 2)
                    : strokeWidth + 4;
                const casingStroke = pairLift ? 2 : 4;
                // A pair cases only its outer flank; every other edge keeps the plain
                // stroked casing around its whole ribbon.
                const taperCasingPath = pairLift
                    ? tasksSideWeightedRibbonPath(path, Number(props.style?.strokeWidth) || 1.9, 0, casingStroke, Math.sign(pairLift))
                    : taperPath;
                const edgeArrowPath = tasksTaperedArrowHeadPath(
                    path,
                    arrowSize,
                    // The barb sits on the side the line was nudged toward, so a
                    // pair reads as one double harpoon rather than two arrows.
                    pairLift ? Math.sign(pairLift) : 0
                );
                // Both halves of a pair are drawn HERE, in the call's element. React
                // Flow paints every edge as its own group, so a mate drawn in its own
                // group laid its paper casing over this half's colour and ate its barb
                // -- and the authoring order decided which half won. One group means
                // one paint order for the whole exchange. The reply's element keeps
                // only its label.
                const pairHalf = String(props.data?.__pair_half__ || '');
                const pairCall = Boolean(pairLift) && pairHalf === 'call';
                const pairReply = Boolean(pairLift) && pairHalf === 'reply';
                // The mate is anchored on these same two points, so swapping them
                // yields exactly the props React Flow would have handed the mate.
                const matePath = pairCall ? tasksPairedEdgePath({
                    ...props,
                    sourceX: props.targetX, sourceY: props.targetY, sourcePosition: props.targetPosition,
                    targetX: props.sourceX, targetY: props.sourceY, targetPosition: props.sourcePosition,
                }, pairLift, 'reply')[0] : '';
                const pairRibbonWidth = Number(props.style?.strokeWidth) || 1.9;
                const mateTaperPath = matePath ? tasksTaperedBezierPath(matePath, pairRibbonWidth, 0) : '';
                const mateCasingPath = matePath
                    ? tasksSideWeightedRibbonPath(matePath, pairRibbonWidth, 0, casingStroke, Math.sign(pairLift))
                    : '';
                const mateArrowPath = matePath ? tasksTaperedArrowHeadPath(matePath, arrowSize, Math.sign(pairLift)) : '';
                // The mate's colour must follow whatever state this half is in. The
                // hover and selection passes rewrite style.stroke to a dim ink mix,
                // so a mate painted from its own static palette colour stayed lit
                // while its call went grey -- and the pair read as one grey band with
                // one coloured half. When style.stroke still equals this edge's own
                // resolved colour, nothing has dimmed it and each half takes its own.
                const edgeUndimmed = !props.data?.edgeColor || props.style?.stroke === props.data.edgeColor;
                const mateStroke = (edgeUndimmed && props.data?.__pair_mate_stroke__)
                    || props.style?.stroke
                    || 'currentColor';
                // UML message kinds. An asynchronous message takes the OPEN head
                // -- two strokes, no fill -- because nobody is waiting on it and
                // no value comes back. A synchronous call keeps the filled head,
                // which is what waiting looks like, and a reply keeps its barb so
                // an exchange still reads as one double harpoon. Only a view that
                // names `sequence_message` can mark a row async at all.
                const uml = Boolean(props.data?.__sequence_uml__);
                const openHead = uml && String(props.data?.__sequence_message__ || '') === 'async';
                const umlHeadPath = openHead ? tasksOpenArrowHeadPath(path, arrowSize, pairLift ? Math.sign(pairLift) : 0) : '';
                const umlLineWidth = Math.max(1.4, Number(props.style?.strokeWidth) || 1.9);
                // Shift+E turns the words off across the view, and only the edge the
                // reader asked for by name keeps its own. That is the W preview or a
                // clicked edge, both of which set edgeCardActive. Hovering a NODE
                // must not bring the words back: it lights a whole neighbourhood,
                // which is the state the toggle exists to quieten.
                const labelsOff = props.data?.__labels_off__ === true && !props.data?.edgeCardActive;
                const showFullLabel = !labelsOff && isTasksEdgeLabelVisible(highlightMode, props.data?.hoverDimsLabels === true);
                const prominentLabel = showFullLabel;
                // React Flow forwards only its own edge props, so a top-level
                // labelZIndex never reaches this component. Take the layout's value
                // from data, else derive it from the highlight mode.
                const labelZIndex = Number(props.data?.__label_z__)
                    || tasksEdgeLabelZForMode(highlightMode, TASKS_EDGE_LABEL_Z, TASKS_EDGE_LABEL_SELECTED_Z, TASKS_EDGE_LABEL_FOCUS_Z);
                const displayLabel = labelsOff
                    ? ''
                    : (showFullLabel ? fullLabel : (labelLines.length > 1 ? `${labelLines[0]}...` : fullLabel));
                const labelStyle = props.labelStyle || {};
                const labelBgStyle = props.labelBgStyle || {};
                const svgLabelLines = String(displayLabel || '').split(/\r?\n/);
                const svgFontSize = Number.parseFloat(tasksCssFontSize(labelStyle.fontSize));
                const svgLineHeight = (Number.isFinite(svgFontSize) ? svgFontSize : 11) * 1.35;
                const svgLabelHeight = Math.max(svgLineHeight, svgLabelLines.length * svgLineHeight);
                const svgLabelWidth = Math.min(
                    props.labelMaxWidth || 240,
                    Math.max(24, ...svgLabelLines.map((line) => line.length * (Number.isFinite(svgFontSize) ? svgFontSize : 11) * 0.62))
                );
                const svgLabelPaddingX = props.labelBgPadding?.[0] || 0;
                const svgLabelPaddingY = props.labelBgPadding?.[1] || 0;
                React.useEffect(() => {
                    if (!window.__vyasaTasksDebug.verbose || !displayLabel) return;
                    if (window.__vyasaTasksDebug.edgeLabelRenderCount >= 40) return;
                    window.__vyasaTasksDebug.edgeLabelRenderCount += 1;
                    const rootStyle = typeof getComputedStyle === 'function' ? getComputedStyle(document.documentElement) : null;
                    logTasksDebugVerbose('edgeLabelRender', {
                        label: fullLabel,
                        displayLabel,
                        highlightMode,
                        prominentLabel,
                        fill: labelStyle.fill || '',
                        bgFill: labelBgStyle.fill || '',
                        labelOpacity: labelStyle.opacity ?? null,
                        bgOpacity: labelBgStyle.fillOpacity ?? null,
                        fallbackInk: rootStyle?.getPropertyValue('--vyasa-ink')?.trim() || '',
                        paper: rootStyle?.getPropertyValue('--vyasa-paper')?.trim() || '',
                    });
                }, [displayLabel, fullLabel, highlightMode, prominentLabel, labelStyle.fill, labelStyle.opacity, labelBgStyle.fill, labelBgStyle.fillOpacity]);
                return React.createElement(React.Fragment, null,
                    !lineOff && React.createElement('path', {
                        d: path,
                        fill: 'none',
                        stroke: 'transparent',
                        // A wide hit area would swallow the other half of a pair,
                        // so a paired line claims only the side it is drawn on. The
                        // halves now touch, so this is as wide as it can be before
                        // hovering one half starts picking the other.
                        strokeWidth: pairLift ? 3 : 24,
                        vectorEffect: 'non-scaling-stroke',
                        pointerEvents: 'stroke',
                        className: 'react-flow__edge-interaction vyasa-tasks-edge-hit-path',
                    }),
                    !taperPath && !lineOff && React.createElement(rf.BaseEdge, {
                        ...props,
                        path,
                        markerEnd: undefined,
                        style: {
                            ...(props.style || {}),
                            strokeLinejoin: 'round',
                            stroke: 'var(--vyasa-paper)',
                            strokeWidth: casingWidth,
                        },
                    }),
                    // Every paper casing paints BEFORE every coloured shape, so the
                    // line, its taper and its head merge into one silhouette with one
                    // outer border. Casing a head after the line drew its own border
                    // between the two and split the arrow from its shaft.
                    !pairReply && !lineOff && taperCasingPath && React.createElement('path', {
                        d: taperCasingPath,
                        fill: 'var(--vyasa-paper)',
                        stroke: pairLift ? 'none' : 'var(--vyasa-paper)',
                        strokeWidth: casingStroke,
                        strokeLinejoin: 'round',
                        pointerEvents: 'none',
                    }),
                    !pairReply && !lineOff && (openHead ? umlHeadPath : edgeArrowPath) && React.createElement('path', {
                        d: openHead ? umlHeadPath : edgeArrowPath,
                        fill: openHead ? 'none' : 'var(--vyasa-paper)',
                        stroke: 'var(--vyasa-paper)',
                        strokeWidth: openHead ? casingStroke + 1.5 : casingStroke,
                        strokeLinejoin: 'round',
                        strokeLinecap: 'round',
                        pointerEvents: 'none',
                    }),
                    mateCasingPath && React.createElement('path', {
                        d: mateCasingPath,
                        fill: 'var(--vyasa-paper)',
                        stroke: 'none',
                        pointerEvents: 'none',
                    }),
                    mateArrowPath && React.createElement('path', {
                        d: mateArrowPath,
                        fill: 'var(--vyasa-paper)',
                        stroke: 'var(--vyasa-paper)',
                        strokeWidth: casingStroke,
                        strokeLinejoin: 'round',
                        pointerEvents: 'none',
                    }),
                    !lineOff && props.data?.edgeCardActive && React.createElement('path', {
                        d: path,
                        fill: 'none',
                        stroke: props.style?.stroke || 'currentColor',
                        strokeWidth: strokeWidth + 28,
                        strokeOpacity: 0.36,
                        strokeLinecap: 'round',
                        strokeLinejoin: 'round',
                        vectorEffect: 'non-scaling-stroke',
                        pointerEvents: 'none',
                        style: { filter: 'blur(14px)' },
                    }),
                    !lineOff && props.data?.pinBloomKey && React.createElement('g', { key: props.data.pinBloomKey, pointerEvents: 'none' },
                        React.createElement('path', {
                            className: 'vyasa-tasks-edge-pin-bloom', d: path, pathLength: 1, fill: 'none',
                            stroke: props.style?.stroke || 'currentColor', strokeLinecap: 'round', vectorEffect: 'non-scaling-stroke',
                        })
                    ),
                    !lineOff && React.createElement(rf.BaseEdge, {
                        ...props,
                        path,
                        markerEnd: undefined,
                        style: taperPath
                            ? { ...(props.style || {}), strokeWidth: 0.1 }
                            : props.style,
                    }),
                    !pairReply && !lineOff && taperPath && React.createElement('path', {
                        d: taperPath,
                        fill: props.style?.stroke || 'currentColor',
                        stroke: 'none',
                        // While a flare sweeps, the ribbon underneath stays faint so
                        // the swept part reads as an opacity rise, then settles full.
                        opacity: props.style?.opacity ?? 1,
                        pointerEvents: 'none',
                    }),
                    mateTaperPath && React.createElement('path', {
                        d: mateTaperPath,
                        fill: mateStroke,
                        stroke: 'none',
                        opacity: props.style?.opacity ?? 1,
                        pointerEvents: 'none',
                    }),
                    !pairReply && !lineOff && (openHead ? umlHeadPath : edgeArrowPath) && React.createElement('path', {
                        d: openHead ? umlHeadPath : edgeArrowPath,
                        fill: openHead ? 'none' : (props.style?.stroke || 'currentColor'),
                        stroke: openHead ? (props.style?.stroke || 'currentColor') : 'none',
                        strokeWidth: openHead ? umlLineWidth : undefined,
                        strokeLinecap: 'round',
                        strokeLinejoin: 'round',
                        opacity: props.style?.opacity ?? 1,
                        pointerEvents: 'none',
                    }),
                    mateArrowPath && React.createElement('path', {
                        d: mateArrowPath,
                        fill: mateStroke,
                        stroke: 'none',
                        opacity: props.style?.opacity ?? 1,
                        pointerEvents: 'none',
                    }),
                    displayLabel && !prominentLabel && React.createElement('g', {
                        transform: `translate(${labelX}, ${labelY})`,
                        pointerEvents: 'none',
                        className: showFullLabel ? 'vyasa-tasks-edge-label vyasa-tasks-edge-label--active' : 'vyasa-tasks-edge-label',
                    },
                    React.createElement('title', null, fullLabel),
                    (labelBgStyle.fillOpacity ?? 0) > 0 && React.createElement('rect', {
                        x: -(svgLabelWidth / 2) - svgLabelPaddingX,
                        y: -(svgLabelHeight / 2) - svgLabelPaddingY,
                        width: svgLabelWidth + (svgLabelPaddingX * 2),
                        height: svgLabelHeight + (svgLabelPaddingY * 2),
                        rx: props.labelBgBorderRadius || 0,
                        fill: labelBgStyle.fill || 'transparent',
                        opacity: labelBgStyle.fillOpacity ?? 1,
                    }),
                    React.createElement('text', {
                        fill: labelStyle.fill || TASKS_EDGE_LABEL_TEXT,
                        opacity: labelStyle.opacity ?? 1,
                        fontSize: tasksCssFontSize(labelStyle.fontSize),
                        fontWeight: labelStyle.fontWeight || 600,
                        textAnchor: 'middle',
                        dominantBaseline: 'middle',
                    }, svgLabelLines.map((line, index) => React.createElement('tspan', {
                        key: `${index}-${line}`,
                        x: 0,
                        dy: index === 0 ? -((svgLabelLines.length - 1) * svgLineHeight) / 2 : svgLineHeight,
                    }, line)))),
                    displayLabel && prominentLabel && React.createElement(TasksProminentEdgeLabel, {
                        labelX,
                        labelY,
                        labelZIndex,
                        labelBgPadding: props.labelBgPadding,
                        labelBgBorderRadius: props.labelBgBorderRadius,
                        labelMaxWidth: props.labelMaxWidth,
                        labelStyle,
                        labelBgStyle,
                        fullLabel,
                        displayLabel,
                    })
                );
            });
}
