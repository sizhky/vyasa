import { renderTasksInlineLinks, renderTasksNodeLinkBadge, tasksIsIconifyImage, tasksNodeLinkKinds } from './tasks_cards.js';
import { logTasksDebug } from './tasks_diagnostics.js';
import { normalizeTasksNodeImageUrl, tasksGraphCornerPath, tasksReviewTarget } from './tasks_graph_core.js';
import { TASKS_DEFAULT_CARD_STATES, tasksLogicalNodeId, tasksNodeHasChildren } from './tasks_graph_model.js';
import { TASKS_DONE_ACCENT, TASKS_NODE_LABEL_FONT_SIZE, tasksColorOverlay } from './tasks_paint.js';

export function createTasksNodeRenderer(getState) {
    return ({ data, id }) => {
        const { Handle, NodeToolbar, Position, React, cardStates, clearSelection, edgeNodeLabels, egoMode, expanded, focusNodeReferenceFromEvent, model, selectedNodeIdRef, selectedNodeIdsRef, setExpanded, setHoveredNodeId, setSelectedNodeId, sourceModel, suppressNextGraphClickRef, toggleCheckedNode, widgetId } = getState();
        const tasksSequenceLaneCap = (accent, stage, label) => renderTasksSequenceLaneCap(React, accent, stage, label);
        const handlePosition = (side) => ({
                            top: Position?.Top || 'top',
                            right: Position?.Right || 'right',
                            bottom: Position?.Bottom || 'bottom',
                            left: Position?.Left || 'left',
                        }[side] || (Position?.Bottom || 'bottom'));
                        const handleStyle = (handle) => (
                            handle.side === 'left' || handle.side === 'right'
                                ? { top: `${handle.offsetPct}%`, opacity: 0, pointerEvents: 'none' }
                                : { left: `${handle.offsetPct}%`, opacity: 0, pointerEvents: 'none' }
                        );
                        const renderHandles = (role) => (data?.handleLayout?.[role] || []).map((handle) => (
                            Handle && React.createElement(Handle, {
                                key: `${role}-${handle.id}`,
                                id: handle.id,
                                type: role,
                                position: handlePosition(handle.side),
                                style: handleStyle(handle),
                            })
                        ));
                        const highlightMode = data?.highlightMode || 'none';
                        const isDimmed = highlightMode === 'dim';
                        const sourceNodeId = data?.__kind__ === 'groupTitle' ? data?.sourceGroupId : id;
                        const logicalNodeId = tasksLogicalNodeId(data, sourceNodeId);
                        const reviewAttrs = {
                            'data-vyasa-review-target': JSON.stringify(tasksReviewTarget(data, id, widgetId)),
                            'data-vyasa-highlight-active': !['none', 'dim'].includes(highlightMode) ? 'true' : undefined,
                            'data-vyasa-hover-outline': data?.__hover_outline__ === true ? 'true' : undefined,
                        };
                        const isChecked = data?.__checked__ === true;
                        const debugPosition = data?.__debug_position__;
                        const taskStateLabel = String(data?.__card_state__ || (isChecked ? TASKS_DEFAULT_CARD_STATES[1] : TASKS_DEFAULT_CARD_STATES[0]));
                        const taskStateColor = data?.__card_state_color__ || TASKS_DONE_ACCENT;
                        // Derive selection/hover state from data.highlightMode rather than
                        // closing over selectedNodeId/hoveredNodeId. Keeping nodeTypes stable
                        // (see useMemo below) stops React Flow from remounting every node on
                        // each hover, which was destroying the node DOM mid-click and
                        // swallowing clicks (deselect / neighbor-activate never fired).
                        const showCheckbox = highlightMode === 'selected' || highlightMode === 'selected-focus' || highlightMode === 'neighbor-focus' || data?.__hover_checkbox__ === true;
                        const isActiveNode = highlightMode === 'none' || highlightMode === 'selected' || highlightMode === 'selected-focus';
                        const linksInteractive = isActiveNode;
                        const linkKinds = Array.from(tasksNodeLinkKinds(data));
                        const nodeImage = normalizeTasksNodeImageUrl(data?.__node_image__);
                        const nodeImageClassName = [
                            'vyasa-tasks-node-image',
                            tasksIsIconifyImage(nodeImage) ? 'vyasa-tasks-node-image--icon' : '',
                            isDimmed ? 'vyasa-tasks-node-image--dimmed' : '',
                        ].filter(Boolean).join(' ');
                        const renderNodeImage = (size = 26, style = {}) => nodeImage ? React.createElement('img', {
                            src: nodeImage,
                            alt: '',
                            loading: 'lazy',
                            draggable: false,
                            className: nodeImageClassName,
                            style: {
                                width: `${size}px`,
                                height: `${size}px`,
                                objectFit: 'contain',
                                flex: '0 0 auto',
                                opacity: isDimmed ? 0.58 : 0.96,
                                ...style,
                            },
                        }) : null;
                        const handleInactiveLinkClick = (event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            setSelectedNodeId(sourceNodeId);
                            setHoveredNodeId(null);
                        };
                        const handleSelectedNodeToggleCapture = (event) => {
                            if (focusNodeReferenceFromEvent(event)) return;
                            if (event.defaultPrevented) return;
                            if (event.target?.closest?.('a, button, input, textarea, select, [data-vyasa-task-control="true"]')) return;
                            if (selectedNodeIdRef.current !== sourceNodeId || selectedNodeIdsRef.current.size !== 0) return;
                            event.preventDefault();
                            event.stopPropagation();
                            suppressNextGraphClickRef.current = true;
                            clearSelection('nodeBodyToggle');
                            window.setTimeout(() => {
                                suppressNextGraphClickRef.current = false;
                            }, 0);
                        };
                        if (data?.__kind__ === 'layoutError') {
                            return React.createElement('div', {
                                style: {
                                    width: '100%',
                                    height: '100%',
                                    boxSizing: 'border-box',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '7px',
                                    justifyContent: 'center',
                                    padding: '16px 18px',
                                    borderRadius: '12px',
                                    border: '1px solid color-mix(in srgb, #dc2626 55%, transparent)',
                                    background: 'color-mix(in srgb, var(--vyasa-paper) 92%, #dc2626 8%)',
                                    color: 'var(--vyasa-ink)',
                                    pointerEvents: 'auto',
                                },
                            },
                                React.createElement('div', {
                                    style: { fontSize: '12px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'color-mix(in srgb, #dc2626 78%, var(--vyasa-ink))' },
                                }, data.__layout_error_view__ ? `View "${data.__layout_error_view__}" cannot be drawn` : 'This view cannot be drawn'),
                                React.createElement('div', {
                                    style: { fontSize: '13px', lineHeight: 1.45, overflowWrap: 'anywhere' },
                                }, data.label || ''),
                                React.createElement('div', {
                                    style: { fontSize: '12px', opacity: 0.72, lineHeight: 1.4 },
                                }, 'Fix the view in the pack schema. Every other view still works.')
                            );
                        }
                        if (data?.__kind__ === 'layeredBand') {
                            const palette = model?.node_color_palettes?.[data.__layered_attr__ || ''] || {};
                            const tint = palette[data.__layered_value__] || 'currentColor';
                            const aside = Boolean(data.__layered_aside__);
                            return React.createElement('div', {
                                style: {
                                    width: '100%',
                                    height: '100%',
                                    boxSizing: 'border-box',
                                    background: `color-mix(in srgb, ${tint} ${aside ? 12 : 7}%, transparent)`,
                                    border: `1px ${aside ? 'dashed' : 'solid'} color-mix(in srgb, ${tint} 30%, transparent)`,
                                    borderRadius: '10px',
                                    color: `color-mix(in srgb, ${tint} 74%, var(--vyasa-ink))`,
                                    fontSize: '12px',
                                    fontWeight: 700,
                                    letterSpacing: '.08em',
                                    textTransform: 'uppercase',
                                    padding: '7px 0 0 12px',
                                },
                            }, data?.label || '');
                        }
                        // A matrix column reads a node attribute and a row reads an edge
                        // attribute, so each axis looks up its own palette. Falling back to
                        // the other map keeps a pack working when an attribute is coloured
                        // on the side the layout did not expect.
                        const matrixAxisColor = (attr, value) => (
                            model?.node_color_palettes?.[attr || '']?.[value]
                            || model?.edge_color_palettes?.[attr || '']?.[value]
                            || ''
                        );
                        const matrixWash = (color, strength) => `linear-gradient(color-mix(in srgb, ${color} ${strength}%, transparent), color-mix(in srgb, ${color} ${strength}%, transparent))`;
                        if (data?.__kind__ === 'matrixHeader') {
                            const axisColor = matrixAxisColor(data.__matrix_attr__, data.label) || 'currentColor';
                            const isRow = Boolean(data.__matrix_row_header__);
                            return React.createElement('div', {
                                style: {
                                    width: '100%',
                                    height: '100%',
                                    boxSizing: 'border-box',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: isRow ? 'flex-end' : 'center',
                                    textAlign: isRow ? 'right' : 'center',
                                    // The header carries its own wash at double strength, so a
                                    // reader can trace which colour each axis contributed.
                                    background: `color-mix(in srgb, ${axisColor} ${(Number(data.__matrix_tint__) || 14) * 2}%, transparent)`,
                                    [isRow ? 'borderRight' : 'borderBottom']: `2px solid color-mix(in srgb, ${axisColor} 62%, transparent)`,
                                    borderRadius: '6px',
                                    color: `color-mix(in srgb, ${axisColor} 74%, var(--vyasa-ink))`,
                                    fontSize: '12px',
                                    fontWeight: 700,
                                    letterSpacing: '.06em',
                                    textTransform: 'uppercase',
                                    padding: '0 8px',
                                    overflowWrap: 'anywhere',
                                },
                            }, data?.label || '');
                        }
                        if (data?.__kind__ === 'matrixCell') {
                            // Two translucent washes, column over row. Their composite is what
                            // names the intersection, so a cell's colour says where it sits
                            // without the reader tracing back to either header.
                            const strength = Number(data.__matrix_tint__) || 14;
                            const colColor = matrixAxisColor(data.__matrix_col_attr__, data.__matrix_col_value__);
                            const rowColor = matrixAxisColor(data.__matrix_row_attr__, data.__matrix_row_value__);
                            const washes = [
                                colColor ? matrixWash(colColor, strength) : '',
                                rowColor ? matrixWash(rowColor, strength) : '',
                            ].filter(Boolean).join(', ');
                            return React.createElement('div', {
                                style: {
                                    width: '100%',
                                    height: '100%',
                                    boxSizing: 'border-box',
                                    backgroundImage: washes || undefined,
                                    // An empty cell keeps the composite but states its emptiness
                                    // with a dashed edge. It is a finding, not a gap.
                                    border: data.__matrix_empty__
                                        ? '1px dashed color-mix(in srgb, var(--vyasa-ink) 22%, transparent)'
                                        : '1px solid color-mix(in srgb, var(--vyasa-ink) 12%, transparent)',
                                    opacity: data.__matrix_empty__ ? 0.55 : 1,
                                    borderRadius: '8px',
                                },
                            });
                        }
                        if (data?.__kind__ === 'sequenceFragment') {
                            // A frame belongs to the interaction, not to any one lane, so
                            // it takes plain ink rather than a lifeline colour. Colouring
                            // it would claim the lane it happens to start on.
                            const line = 'color-mix(in srgb, var(--vyasa-ink) 34%, transparent)';
                            const text = 'color-mix(in srgb, var(--vyasa-ink) 68%, var(--vyasa-paper))';
                            const operands = Array.isArray(data.__sequence_operands__) ? data.__sequence_operands__ : [];
                            const operator = String(data.__sequence_fragment_op__ || '').toUpperCase();
                            // Only the operator and the guards are drawn. The fragment's own
                            // name sits on every arrow inside as `fragment=`, so the hover
                            // and click cards already have somewhere to put it; printing it
                            // here as well left three lines of text stacked in one corner.
                            // The layout owns this size: it is also the box's hit rect, and a
                            // tag drawn wider than the rect would look clickable where it is not.
                            const tagWidth = Number(data.__hit_rect__?.width) || (22 + operator.length * 7);
                            const tagHeight = Number(data.__hit_rect__?.height) || 20;
                            return React.createElement('div', {
                                style: {
                                    position: 'relative',
                                    width: '100%',
                                    height: '100%',
                                    boxSizing: 'border-box',
                                    border: `1px solid ${line}`,
                                    borderRadius: '6px',
                                    // Transparent: the rows and the lifelines it covers are
                                    // the content, and a tint over them would dim the very
                                    // thing the frame is pointing at.
                                    background: 'transparent',
                                },
                            },
                                // UML's corner pentagon, on the header line the layout
                                // reserved for it. The clipped corner is what tells a reader
                                // this label names an operator and not a step.
                                React.createElement('svg', {
                                    width: tagWidth, height: tagHeight,
                                    style: { position: 'absolute', left: -1, top: -1, overflow: 'visible' },
                                },
                                    React.createElement('path', {
                                        d: tasksGraphCornerPath(tagWidth, tagHeight, 6),
                                        fill: 'color-mix(in srgb, var(--vyasa-ink) 12%, var(--vyasa-paper))',
                                        stroke: line, strokeWidth: 1,
                                        style: { pointerEvents: 'visiblePainted', cursor: 'pointer' },
                                    }, React.createElement('title', null, data.label || operator)),
                                    React.createElement('text', {
                                        x: 8, y: tagHeight / 2, dy: '.35em', fill: text,
                                        style: { fontSize: '10px', fontWeight: 800, letterSpacing: '.09em', pointerEvents: 'none' },
                                    }, operator),
                                ),
                                // One dashed rule per operand boundary, and the guard that
                                // operand runs under. The first operand shares the tag's own
                                // line, so its guard sits beside the pentagon.
                                ...operands.flatMap((operand, index) => [
                                    operand.rule >= 0 ? React.createElement('div', {
                                        key: `rule-${index}`,
                                        style: {
                                            position: 'absolute',
                                            left: 0,
                                            right: 0,
                                            top: `${operand.rule}px`,
                                            borderTop: `1px dashed ${line}`,
                                        },
                                    }) : null,
                                    operand.guard ? React.createElement('div', {
                                        key: `guard-${index}`,
                                        style: {
                                            position: 'absolute',
                                            left: `${index === 0 ? tagWidth + 6 : 10}px`,
                                            top: `${operand.top + 3}px`,
                                            lineHeight: '14px',
                                            fontSize: '10px',
                                            fontWeight: 700,
                                            color: text,
                                            whiteSpace: 'nowrap',
                                        },
                                    }, operand.guard) : null,
                                ]).filter(Boolean)
                            );
                        }
                        if (data?.__kind__ === 'sequenceActivation') {
                            // An activation bar: one call still running on this lane. It is
                            // stronger than the lifeline column it covers, in the same colour,
                            // so the bar reads as that lane doing work and an arrow meeting
                            // the lane meets the bar's own edge.
                            const accent = data.__sequence_color__ || 'currentColor';
                            return React.createElement('div', {
                                style: {
                                    width: '100%',
                                    height: '100%',
                                    boxSizing: 'border-box',
                                    background: `color-mix(in srgb, ${accent} 30%, var(--vyasa-paper))`,
                                    border: `1px solid color-mix(in srgb, ${accent} 62%, transparent)`,
                                    borderRadius: '4px',
                                    textAlign: 'center',
                                    pointerEvents: 'auto',
                                    cursor: 'pointer',
                                },
                            // The step the frame opens on, just inside the top edge:
                            // that edge is the opening call's own row, and everything
                            // below it happened while that step was still running.
                            }, data?.label ? React.createElement('div', {
                                style: {
                                    paddingTop: '4px',
                                    lineHeight: '18px',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    color: `color-mix(in srgb, ${accent} 70%, var(--vyasa-ink))`,
                                },
                            }, data.label) : null);
                        }
                        if (data?.__kind__ === 'sequencePhase') {
                            const phasePalette = model?.edge_color_palettes?.[data.__sequence_phase_attr__ || ''] || {};
                            const tint = phasePalette[data.label] || 'currentColor';
                            return React.createElement('div', {
                                style: {
                                    width: '100%',
                                    height: '100%',
                                    boxSizing: 'border-box',
                                    background: `color-mix(in srgb, ${tint} 10%, transparent)`,
                                    borderTop: `1px solid color-mix(in srgb, ${tint} 32%, transparent)`,
                                    borderRadius: '8px',
                                    color: `color-mix(in srgb, ${tint} 72%, var(--vyasa-ink))`,
                                    fontSize: '12px',
                                    fontWeight: 700,
                                    letterSpacing: '.07em',
                                    textTransform: 'uppercase',
                                    padding: '6px 0 0 12px',
                                },
                            }, data?.label || '');
                        }
                        if (data?.__sequence_lifeline__) {
                            const accent = data.__sequence_color__ || 'currentColor';
                            return React.createElement('div', {
                                ...reviewAttrs,
                                style: {
                                    position: 'relative',
                                    width: '100%',
                                    height: '100%',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'stretch',
                                    cursor: 'pointer',
                                },
                            },
                                ...renderHandles('target'),
                                ...renderHandles('source'),
                                tasksSequenceLaneCap(accent, data.__sequence_stage__, data?.label || ''),
                                // The lifeline body is a tinted column, not a hairline, so it
                                // still reads when the whole diagram is zoomed to fit.
                                React.createElement('div', {
                                    style: {
                                        flex: '1 1 auto',
                                        background: `color-mix(in srgb, ${accent} 11%, transparent)`,
                                        borderLeft: `1px solid color-mix(in srgb, ${accent} 30%, transparent)`,
                                        borderRight: `1px solid color-mix(in srgb, ${accent} 30%, transparent)`,
                                        borderBottom: `1px solid color-mix(in srgb, ${accent} 30%, transparent)`,
                                        borderRadius: '0 0 8px 8px',
                                    },
                                })
                            );
                        }
                        if (data?.__kind__ === 'ganttHeader') {
                            return React.createElement('div', {
                                style: {
                                    width: '100%',
                                    height: '100%',
                                    borderLeft: '1px solid color-mix(in srgb, var(--vyasa-ink) 14%, transparent)',
                                    boxSizing: 'border-box',
                                    color: 'color-mix(in srgb, var(--vyasa-ink) 62%, transparent)',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    paddingTop: '4px',
                                    textAlign: 'center',
                                },
                            }, data?.label || '');
                        }
                        if (data?.__kind__ === 'groupTitle') {
                            const handleCollapse = (e) => {
                                e.stopPropagation();
                                if (egoMode) return;
                                const next = new Set(expanded);
                                next.delete(data.sourceGroupId);
                                logTasksDebug('nodeCollapse', { nodeId: data.sourceGroupId, expanded: Array.from(next) });
                                setExpanded(next);
                            };
                            return React.createElement('div', {
                                ...reviewAttrs,
                                onClickCapture: handleSelectedNodeToggleCapture,
                                style: {
                                    width: '100%', height: '100%',
        	                            boxSizing: 'border-box',
        	                            display: 'flex',
        	                            alignItems: 'center',
        	                            justifyContent: 'space-between',
        	                            gap: '8px',
        	                            padding: '6px 10px',
                                    fontWeight: '600',
                                    fontSize: '16px',
                                    position: 'relative',
                                }
                            },
                                linkKinds.length ? renderTasksNodeLinkBadge(React, { right: '32px', kinds: linkKinds }) : null,
                                React.createElement('span', {
                                    style: {
        	                                minWidth: 0,
        	                                overflow: 'hidden',
        	                                display: 'flex',
        	                                alignItems: 'center',
        	                                gap: '7px',
                                        whiteSpace: 'pre-line',
                                        lineHeight: '1.28',
                                        overflowWrap: 'anywhere',
                                        wordBreak: 'break-word',
                                    }
                                }, renderNodeImage(20, { marginTop: '1px' }), React.createElement('span', { style: { minWidth: 0 } }, renderTasksInlineLinks(data?.label || data.sourceGroupId || id, { interactive: linksInteractive, onInactiveClick: handleInactiveLinkClick, currentPath: sourceModel?.document_path || '', nodeLabels: edgeNodeLabels }))),
                                egoMode ? null : React.createElement('button', {
                                    onClick: handleCollapse,
                                    style: { flex: '0 0 auto', border: 'none', background: 'none', cursor: 'pointer', fontSize: '18px', opacity: '0.55', padding: '0' }
                                }, '−')
                            );
                        }
                        const isGroup = data?.__kind__ === 'group';
                        const canExpand = tasksNodeHasChildren(id, model);
                        const isExpanded = expanded.has(id);
                        const labelContent = renderTasksInlineLinks(data?.label || id, { interactive: linksInteractive, onInactiveClick: handleInactiveLinkClick, currentPath: sourceModel?.document_path || '', nodeLabels: edgeNodeLabels });
                        if (data?.__gantt) {
                            return React.createElement('div', {
                                ...reviewAttrs,
                                className: 'vyasa-task-node-body',
                                onClickCapture: handleSelectedNodeToggleCapture,
                                style: {
                                    width: '100%',
                                    height: '100%',
                                    boxSizing: 'border-box',
                                    display: 'grid',
                                    gridTemplateColumns: '1fr auto',
                                    alignItems: 'center',
                                    gap: '10px',
                                    padding: '8px 12px',
                                    fontSize: '12px',
                                    fontWeight: 650,
                                    opacity: isDimmed ? 0.22 : 1,
                                    position: 'relative',
                                },
                            },
                                linkKinds.length ? renderTasksNodeLinkBadge(React, { kinds: linkKinds }) : null,
                                ...renderHandles('target'),
                                React.createElement('span', { style: { minWidth: 0, whiteSpace: 'normal', overflowWrap: 'anywhere', lineHeight: 1.25 } }, labelContent),
                                React.createElement('span', { style: { fontSize: '10px', opacity: 0.62, fontVariantNumeric: 'tabular-nums' } }, `${data.gantt_duration || 1}u`),
                                ...renderHandles('source')
                            );
                        }
                        const labelNode = React.createElement('span', {
                            onClick: linksInteractive ? undefined : handleInactiveLinkClick,
                            style: {
                                color: 'inherit',
                                textDecoration: isChecked ? 'line-through' : 'none',
                                textDecorationColor: isChecked ? taskStateColor : undefined,
                                textDecorationThickness: isChecked ? '1.8px' : undefined,
                            },
                        }, labelContent);
                        const checkboxControl = showCheckbox ? React.createElement('label', {
                            'data-vyasa-task-control': 'true',
                            onMouseDown: (event) => event.stopPropagation(),
                            onPointerDown: (event) => event.stopPropagation(),
                            onClick: (event) => event.stopPropagation(),
                            style: {
                                position: 'absolute',
                                left: '6px',
                                top: '6px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '16px',
                                height: '16px',
                                borderRadius: '5px',
                                border: `1px solid color-mix(in srgb, var(--vyasa-ink) 18%, ${taskStateColor} 24%)`,
                                background: isChecked
                                    ? `color-mix(in srgb, var(--vyasa-paper) 70%, ${taskStateColor} 30%)`
                                    : 'color-mix(in srgb, var(--vyasa-paper) 96%, transparent)',
                                boxShadow: isChecked ? `inset 0 0 0 1px color-mix(in srgb, ${taskStateColor} 20%, transparent)` : 'none',
                                cursor: 'pointer',
                                zIndex: 2,
                            },
                        }, cardStates.length <= 2 ? React.createElement('input', {
                            type: 'checkbox',
                            checked: isChecked,
                            onMouseDown: (event) => event.stopPropagation(),
                            onPointerDown: (event) => event.stopPropagation(),
                            onChange: () => toggleCheckedNode(logicalNodeId),
                            style: { margin: 0, width: '10px', height: '10px', accentColor: taskStateColor, cursor: 'pointer' },
                        }) : React.createElement('button', {
                            type: 'button',
                            title: `State: ${taskStateLabel}`,
                            onClick: () => toggleCheckedNode(logicalNodeId),
                            style: { border: 'none', background: 'transparent', padding: 0, width: '10px', height: '10px', cursor: 'pointer' },
                        })) : null;
                        const noteBadge = data?.__has_note__
                            ? renderTasksNodeLinkBadge(React, { kinds: ['note'], title: 'Has note', top: 'auto', bottom: '8px', right: canExpand ? '34px' : '8px' })
                            : null;
                        const handleExpand = (e) => {
                            e.stopPropagation();
                            if (egoMode) return;
                            const next = new Set(expanded);
                            if (isExpanded) next.delete(id); else next.add(id);
                            logTasksDebug(isExpanded ? 'nodeCollapse' : 'nodeExpand', { nodeId: id, expanded: Array.from(next) });
                            setExpanded(next);
                        };
                        if (isExpanded) {
                            return React.createElement('div', {
                                ...reviewAttrs,
                                onClickCapture: handleSelectedNodeToggleCapture,
                                style: {
                                    width: '100%', height: '100%',
                                    boxSizing: 'border-box', display: 'flex', flexDirection: 'column', padding: '8px',
                                    opacity: isDimmed ? 0.22 : 1,
                                }
                            },
                                checkboxControl,
                                noteBadge,
                                ...renderHandles('target'),
                                React.createElement('div', { style: { flex: 1, minHeight: '48px', position: 'relative' } }),
                                ...renderHandles('source')
                            );
                        }
                        return React.createElement('div', {
                            ...reviewAttrs,
                            className: 'vyasa-task-node-body',
                            onClickCapture: handleSelectedNodeToggleCapture,
                            style: {
                                width: '100%', height: '100%',
                                boxSizing: 'border-box',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: nodeImage ? '10px' : undefined,
                                fontSize: `${TASKS_NODE_LABEL_FONT_SIZE}px`,
                                fontWeight: '600',
                                fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                                textAlign: 'center',
                                padding: '10px 12px',
                                overflow: 'hidden',
                                opacity: isDimmed ? 0.22 : 1,
                                position: 'relative',
                                background: isChecked ? `linear-gradient(135deg, color-mix(in srgb, ${taskStateColor} 12%, transparent), transparent 55%)` : undefined,
                            }
                        },
                            tasksColorOverlay(React, data?.__color_levels__, data?.width, data?.height),
                            checkboxControl,
                            noteBadge,
                            linkKinds.length ? renderTasksNodeLinkBadge(React, { right: canExpand ? '32px' : '10px', kinds: linkKinds }) : null,
                            ...renderHandles('target'),
                            renderNodeImage(isGroup ? 30 : 28),
                            React.createElement('span', {
                                style: {
                                    boxSizing: 'border-box',
                                    position: 'relative',
                                    zIndex: 1,
                                    flex: '1 1 auto',
                                    minWidth: 0,
                                    width: nodeImage ? 'auto' : '100%',
                                    maxWidth: '100%',
                                    overflow: 'hidden',
                                    display: 'block',
                                    whiteSpace: 'pre-line',
                                    lineHeight: '1.28',
                                    overflowWrap: 'anywhere',
                                    wordBreak: 'break-word',
                                    textDecoration: isChecked ? 'line-through' : 'none',
                                    textDecorationColor: isChecked ? taskStateColor : undefined,
                                    textDecorationThickness: isChecked ? '2px' : undefined,
                                }
                            }, labelNode),
                            canExpand && React.createElement('button', {
                                onClick: handleExpand,
                                'data-vyasa-task-control': 'true',
                                style: { position: 'absolute', right: '8px', top: '8px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '18px', opacity: '0.55', padding: '0' }
                            }, isExpanded ? '−' : '+'),
                            NodeToolbar && debugPosition && React.createElement(NodeToolbar, {
                                isVisible: true,
                                position: Position.Bottom,
                                offset: 8,
                            }, React.createElement('code', {
                                style: { padding: '3px 6px', borderRadius: '5px', background: 'var(--vyasa-paper)', border: '1px solid color-mix(in srgb, var(--vyasa-ink) 24%, transparent)', fontSize: '11px', whiteSpace: 'nowrap' },
                            }, `x ${debugPosition.x}, y ${debugPosition.y}`)),
                            ...renderHandles('source')
                        );
    };
}

export const renderTasksSequenceLaneCap = (React, accent, stage, label) => React.createElement('div', {
                style: {
                    boxSizing: 'border-box',
                    padding: '6px 6px 7px',
                    borderRadius: '8px 8px 0 0',
                    background: `color-mix(in srgb, ${accent} 24%, transparent)`,
                    border: `1px solid color-mix(in srgb, ${accent} 55%, transparent)`,
                    textAlign: 'center',
                    lineHeight: 1.22,
                    overflowWrap: 'anywhere',
                },
            },
                stage ? React.createElement('div', {
                    style: {
                        fontSize: '9px',
                        fontWeight: 700,
                        letterSpacing: '.07em',
                        textTransform: 'uppercase',
                        opacity: 0.6,
                        marginBottom: '2px',
                    },
                }, stage) : null,
                React.createElement('div', { style: { fontSize: '11px', fontWeight: 700 } }, label)
            );
