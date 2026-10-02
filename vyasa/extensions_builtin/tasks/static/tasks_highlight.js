// Highlight states for one graph pass: design.md (States). This module decides
// which state each node and edge is in for a selection, a hover, a filter or an
// open edge card, and returns the painted elements. It reads no React state.
import { isTasksEdgeInternalToSelection, tasksEdgeLabelZForMode, isTasksEdgeLabelHoverDimmingActive } from './tasks_graph_core.js';
import { collectTasksGroupDescendantIds, tasksEdgesMatchingTypes, tasksFilterHoverFocus, tasksFilterQueryHasRules } from './tasks_graph_model.js';
import {
    TASKS_DONE_ACCENT, TASKS_EDGE_FOCUS_IN_COLOR, TASKS_EDGE_FOCUS_OUT_COLOR, TASKS_EDGE_FOCUS_Z, TASKS_EDGE_LABEL_BG,
    TASKS_EDGE_LABEL_FOCUS_Z, TASKS_EDGE_LABEL_SELECTED_Z, TASKS_EDGE_LABEL_Z, TASKS_EDGE_Z,
    TASKS_NEIGHBOR_Z_BOOST, TASKS_SELECTED_Z_BOOST, resolveTasksCollapsedGroupColor, resolveTasksNodeColor,
    tasksApplyEdgeOpacity, tasksEdgeRecordId, tasksEdgeStrokeWidthForMode,
    tasksGroupIdsContainingSelection, tasksHoverFocusEdge, tasksHoverFocusNodeStyle, tasksLitNodeFill, tasksProminentEdgeOpacity, tasksStateZIndex,
} from './tasks_paint.js';
import {
    TASKS_DIM_EDGE_INK, TASKS_DIM_LABEL_INK, TASKS_DIM_OPACITY, TASKS_SELECTION_DIM_OPACITY, tasksCheckedShadow, tasksStateShadow,
} from './tasks_theme.js';

export const TASKS_EDGE_LABEL_FOCUS_FONT_SIZE = 16;

/**
 * Paint every node and edge for one highlight pass.
 *
 * input: the graph (`baseNodes`, `authoredGraphEdges`, `referenceEdges`) and the
 * selection (`nodeId`, `hoveredNodeId`, `selectedIds`, `edgeId`).
 * ctx: the view settings the paint reads.
 * Returns `{ nodes, edges, trace }`; `trace` is set for a node selection.
 */
export function tasksHighlightGraph(input, ctx) {
    const { baseNodes, authoredGraphEdges, referenceEdges, nodeId, hoveredNodeId = null, selectedIds = new Set(), edgeId = '' } = input;
    const {
        model, activeColorBy, activeColorPalette, expanded, edgesVisible, edgeOpacity, edgePinBloom, effectiveEdgeTypes,
        effectiveQueryFilters, effectiveSwatchFilters, searchMatches, filteredSelectionIds, colorMix, hoverFontSize,
    } = ctx;
    const result = {};
    // One colour context per node: its colour, the colour its rings take, the
    // border a lit node shows, and the checked-state shadow.
    const colorsOf = (node) => {
        const nodeColor = resolveTasksNodeColor(node.data, model, activeColorBy, activeColorPalette);
        const collapsedGroupColor = node.data?.__kind__ === 'group' && !expanded.has(node.id)
            ? resolveTasksCollapsedGroupColor(node.data, model, activeColorBy, activeColorPalette)
            : '';
        const displayColor = collapsedGroupColor || nodeColor;
        const ringColor = displayColor || 'var(--vyasa-primary)';
        const stateAccent = node.data?.__card_state_color__ || TASKS_DONE_ACCENT;
        return {
            nodeColor,
            displayColor,
            ringColor,
            activeBorderColor: node.data?.__checked__ ? stateAccent : ringColor,
            checkedShadow: node.data?.__checked__ ? tasksCheckedShadow(stateAccent) : 'none',
        };
    };
    const authoredEdges = tasksEdgesMatchingTypes(authoredGraphEdges || [], effectiveEdgeTypes);
    const activeReferenceNodeIds = new Set([
        nodeId,
        hoveredNodeId,
        ...(selectedIds instanceof Set ? selectedIds : new Set(selectedIds || [])),
    ].filter(Boolean));
    const activeReferenceEdges = tasksEdgesMatchingTypes(referenceEdges || [], effectiveEdgeTypes)
        .filter((edge) => (
            tasksEdgeRecordId(edge) === edgeId
            || activeReferenceNodeIds.has(edge.source)
            || activeReferenceNodeIds.has(edge.target)
        ));
    const baseEdges = [...authoredEdges, ...activeReferenceEdges];
    const displayedEdges = edgesVisible ? baseEdges : activeReferenceEdges;
    const selectedEdge = edgeId ? baseEdges.find((edge) => tasksEdgeRecordId(edge) === edgeId) : null;
    if (selectedEdge) {
        const endpointIds = new Set([selectedEdge.source, selectedEdge.target]);
        // A call and its reply are one exchange. Previewing half of a
        // double harpoon and leaving the other half dim would cut the
        // exchange in two, so the mate lights with it. Only the half
        // under the cursor keeps the bloom, so the open card is still
        // traceable to the line it came from.
        const mateId = String(selectedEdge.data?.__pair_mate__ || '');
        result.nodes = (baseNodes.map((node) => {
            const sourceNodeId = node.data?.__kind__ === 'groupTitle' ? node.data?.sourceGroupId : node.id;
            const hit = endpointIds.has(sourceNodeId);
            // An edge card lights its ends in their own colour, not a collapsed group's.
            const nodeColor = colorsOf(node).nodeColor || 'var(--vyasa-primary)';
            return {
                ...node,
                data: { ...node.data, highlightMode: hit ? 'selected' : 'dim', __hover_outline__: hit },
                style: {
                    ...node.style,
                    opacity: hit ? 1 : (node.data?.__projection_branch_opacity__ ?? 1) * TASKS_DIM_OPACITY,
                    '--vyasa-tasks-active-border': hit ? nodeColor : undefined,
                    boxShadow: hit ? tasksStateShadow('endpoint', nodeColor) : node.style.boxShadow,
                },
            };
        }));
        result.edges = (displayedEdges.map((edge) => {
            const focused = edge === selectedEdge;
            const hit = focused || (Boolean(mateId) && tasksEdgeRecordId(edge) === mateId);
            const edgeColor = edge.data?.edgeColor || edge.style?.stroke || 'currentColor';
            // A focus stroke of 4.5 would close the gap a pair is drawn
            // with, turning the two harpoons back into one fat line.
            const focusWidth = edge.data?.__pair_half__ ? 2.6 : 4.5;
            return {
                ...edge,
                zIndex: hit ? TASKS_EDGE_FOCUS_Z : TASKS_EDGE_Z,
                labelZIndex: hit ? TASKS_EDGE_LABEL_FOCUS_Z : TASKS_EDGE_LABEL_Z,
                // A pair is ONE exchange, so its two halves answer together. `hit` already
                // lights the mate's stroke, colour and z-order. edgeCardActive is what
                // keeps an edge's words while Shift+E has the labels off, so leaving it
                // on the clicked half alone showed a call with no reply -- and a paired
                // half claims only a 3px hit path, so the reader cannot click the other.
                data: { ...edge.data, highlightMode: hit ? 'selected' : 'dim', strokeMode: hit ? 'selected' : 'dim', edgeCardActive: hit, pinBloomKey: focused && edgePinBloom?.edgeId === tasksEdgeRecordId(edge) ? edgePinBloom.key : '' },
                labelStyle: { ...(edge.labelStyle || {}), fill: hit ? edgeColor : TASKS_DIM_LABEL_INK, opacity: hit ? 1 : 0.12 },
                labelBgStyle: { ...(edge.labelBgStyle || {}), fill: TASKS_EDGE_LABEL_BG, fillOpacity: hit ? 0.86 : 0.04 },
                style: { ...edge.style, stroke: hit ? edgeColor : TASKS_DIM_EDGE_INK, opacity: hit ? 1 : 0.08, strokeWidth: hit ? focusWidth : (edge.data?.__pair_half__ ? 1.9 : 2.5) },
            };
        }));
        return result;
    }
    // When no single node is selected, hovering a node should still reveal
    // its checkbox. Carry it as a data flag (not the closure) so the
    // memoized node updates without forcing the per-hover remount.
    const hoverCheckboxId = !nodeId && hoveredNodeId ? hoveredNodeId : null;
    // A bar and a fragment box are not edge endpoints, so comparing ids
    // to them matches nothing and hovering one dimmed the whole view.
    // Chrome names the edges it stands for; everything else keeps the
    // endpoint test, so no ordinary node changes behaviour.
    const hoveredEdgeIds = new Set(
        baseNodes.find((node) => node.id === hoveredNodeId)?.data?.__edge_ids__ || []
    );
    const touchesHovered = (edge) => (hoveredEdgeIds.size
        ? hoveredEdgeIds.has(edge.id)
        : (edge.source === hoveredNodeId || edge.target === hoveredNodeId));
    // Direction still has to be read from a real endpoint: a call
    // arrives at the lane the bar sits on and its reply leaves it, so
    // the bar borrows that lane to tell the two apart.
    const hoverDirectionId = baseNodes.find((node) => node.id === hoveredNodeId)
        ?.data?.__sequence_lane__ || hoveredNodeId;
    const multiSelectedIds = selectedIds instanceof Set ? selectedIds : new Set(selectedIds || []);
    const multiSelectedHighlightIds = new Set(multiSelectedIds);
    for (const selectedId of multiSelectedIds) {
        for (const descendantId of collectTasksGroupDescendantIds(selectedId, model)) {
            multiSelectedHighlightIds.add(descendantId);
        }
    }
    const hasNodeSelection = nodeId && baseNodes.some((node) => node.id === nodeId);
    if (!hasNodeSelection && multiSelectedIds.size > 0) {
        const multiHoverEndpointIds = new Set(hoveredNodeId ? [hoveredNodeId] : []);
        if (hoveredNodeId) {
            for (const edge of baseEdges) {
                if (touchesHovered(edge)) {
                    multiHoverEndpointIds.add(edge.source);
                    multiHoverEndpointIds.add(edge.target);
                }
            }
        }
        result.nodes = (baseNodes.map((node) => {
            const sourceGroupId = node.data?.__kind__ === 'groupTitle' ? node.data?.sourceGroupId : null;
            const logicalId = sourceGroupId || node.id;
            const hovered = Boolean(hoveredNodeId) && logicalId === hoveredNodeId;
            const hoverNeighbor = !hovered && multiHoverEndpointIds.has(logicalId);
            const inSelection = multiSelectedHighlightIds.has(node.id) || (sourceGroupId && multiSelectedHighlightIds.has(sourceGroupId));
            const selected = inSelection || hovered || hoverNeighbor;
            const { ringColor, activeBorderColor } = colorsOf(node);
            return {
                ...node,
                data: {
                    ...node.data,
                    highlightMode: hovered ? 'selected-focus' : (hoverNeighbor ? 'neighbor' : (selected ? 'selected' : 'dim')),
                    __hover_checkbox__: node.id === hoverCheckboxId,
                    __hover_outline__: hovered || hoverNeighbor,
                },
                style: {
                ...node.style,
                    opacity: (node.data?.__projection_branch_opacity__ ?? 1) * (selected ? 1 : TASKS_DIM_OPACITY),
                    '--vyasa-tasks-active-border': selected ? activeBorderColor : undefined,
                    boxShadow: selected ? tasksStateShadow('picked', ringColor) : node.style.boxShadow,
                },
            };
        }));
        result.edges = (displayedEdges.map((edge) => {
            const touchesHover = Boolean(hoveredNodeId) && touchesHovered(edge);
            const hit = touchesHover
                || (multiSelectedHighlightIds.has(edge.source) && multiSelectedHighlightIds.has(edge.target));
            const edgeColor = edge.data?.edgeColor || edge.style?.stroke || 'currentColor';
            const branchOpacity = edge.data?.__projection_branch_opacity__ ?? 1;
            return {
                ...edge,
                zIndex: hit ? TASKS_EDGE_FOCUS_Z : TASKS_EDGE_Z,
                data: {
                    ...edge.data,
                    highlightMode: hit ? 'selected' : 'dim',
                    strokeMode: hit && touchesHover ? (edge.source === hoverDirectionId ? 'selected-out' : 'selected-in') : (hit ? 'selected' : 'dim'),
                    flareKey: `hover:${hoveredNodeId || ''}`,
                },
                labelStyle: { ...(edge.labelStyle || {}), fill: hit ? edgeColor : TASKS_DIM_LABEL_INK, opacity: (hit ? tasksProminentEdgeOpacity() : tasksApplyEdgeOpacity(0.12, edgeOpacity)) * branchOpacity },
                labelBgStyle: { ...(edge.labelBgStyle || {}), fill: TASKS_EDGE_LABEL_BG, fillOpacity: hit ? 0.82 : 0.06 },
                style: { ...edge.style, stroke: hit ? edgeColor : TASKS_DIM_EDGE_INK, opacity: tasksApplyEdgeOpacity(hit ? 0.98 : 0.08, edgeOpacity) * branchOpacity, strokeWidth: edge.data?.__pair_half__ ? (hit ? 2.6 : 1.9) : (hit ? 4.5 : 2.5), strokeLinecap: hit ? 'round' : undefined, '--vyasa-edge-flow-duration': hit ? '0.7s' : '0.6s' },
            };
        }));
        return result;
    }
    if (!hasNodeSelection) {
        const hasFilters = tasksFilterQueryHasRules(effectiveQueryFilters) || tasksFilterQueryHasRules(effectiveSwatchFilters) || effectiveEdgeTypes.length > 0;
        const hasSearch = searchMatches.active && !searchMatches.error;
        if (!hasFilters && !hasSearch) {
            const hoverEndpointIds = new Set(hoveredNodeId ? [hoveredNodeId] : []);
            if (hoveredNodeId) {
                for (const edge of baseEdges) {
                    if (touchesHovered(edge)) {
                        hoverEndpointIds.add(edge.source);
                        hoverEndpointIds.add(edge.target);
                    }
                }
            }
            result.nodes = (hoveredNodeId
                ? baseNodes.map((node) => {
                    const sourceNodeId = node.data?.__kind__ === 'groupTitle' ? node.data?.sourceGroupId : node.id;
                    const highlighted = hoverEndpointIds.has(sourceNodeId);
                    if (!highlighted && node.id !== hoverCheckboxId) return node;
                    const { nodeColor, ringColor, activeBorderColor, checkedShadow } = colorsOf(node);
                    const isHoveredNode = sourceNodeId === hoveredNodeId;
                    const focusStyle = tasksHoverFocusNodeStyle(node, nodeColor, ringColor, activeBorderColor, checkedShadow, colorMix, isHoveredNode);
                    return {
                        ...node,
                        data: { ...node.data, highlightMode: isHoveredNode ? 'selected-focus' : 'neighbor', __hover_checkbox__: node.id === hoverCheckboxId, __hover_outline__: highlighted },
                        style: { ...node.style, ...focusStyle },
                        zIndex: focusStyle.zIndex,
                    };
                })
                : baseNodes);
            result.edges = (hoveredNodeId
                ? displayedEdges.map((edge) => {
                    if (!touchesHovered(edge)) return edge;
                    return tasksHoverFocusEdge(edge, hoverDirectionId);
                })
                : displayedEdges);
            return result;
        }
        const matchingIds = filteredSelectionIds();
        const containerGroupIds = tasksGroupIdsContainingSelection(model, matchingIds);
        const visibleSelectionIds = new Set([...matchingIds, ...containerGroupIds]);
        const filterHoverFocus = tasksFilterHoverFocus(matchingIds, baseEdges, hoveredNodeId);
        result.nodes = (baseNodes.map((node) => {
            const sourceNodeId = node.data?.__kind__ === 'groupTitle' ? node.data?.sourceGroupId : node.id;
            const selected = visibleSelectionIds.has(sourceNodeId);
            const focused = filterHoverFocus.nodeIds.has(sourceNodeId);
            const { nodeColor, ringColor, activeBorderColor, checkedShadow } = colorsOf(node);
            const focusStyle = focused
                ? tasksHoverFocusNodeStyle(node, nodeColor, ringColor, activeBorderColor, checkedShadow, colorMix, true)
                : {};
            const highlightMode = focused
                ? (sourceNodeId === hoveredNodeId ? 'selected-focus' : 'neighbor-focus')
                : (selected ? 'selected' : 'dim');
            return {
                ...node,
                data: { ...node.data, highlightMode, __hover_checkbox__: node.id === hoverCheckboxId, __hover_outline__: focused },
                style: {
                    ...node.style,
                    opacity: (node.data?.__projection_branch_opacity__ ?? 1) * (selected ? 1 : TASKS_DIM_OPACITY),
                    '--vyasa-tasks-active-border': selected ? activeBorderColor : undefined,
                    ...focusStyle,
                },
                ...(focused ? { zIndex: focusStyle.zIndex } : {}),
            };
        }));
        result.edges = (displayedEdges.map((edge) => {
            const hit = (visibleSelectionIds.has(edge.source) && visibleSelectionIds.has(edge.target)) || searchMatches.edgeIds.has(edge.id);
            if (filterHoverFocus.edgeIds.has(edge.id)) {
                return tasksHoverFocusEdge(edge, hoveredNodeId);
            }
            const edgeColor = edge.data?.edgeColor || edge.style?.stroke || 'currentColor';
            const branchOpacity = edge.data?.__projection_branch_opacity__ ?? 1;
            return {
                ...edge,
                zIndex: hit ? TASKS_EDGE_FOCUS_Z : TASKS_EDGE_Z,
                data: { ...edge.data, highlightMode: hit ? 'selected' : 'dim' },
                labelStyle: {
                    ...(edge.labelStyle || {}),
                    fill: hit ? edgeColor : TASKS_DIM_LABEL_INK,
                    opacity: (hit ? tasksProminentEdgeOpacity() : tasksApplyEdgeOpacity(0.12, edgeOpacity)) * branchOpacity,
                },
                labelBgStyle: { ...(edge.labelBgStyle || {}), fill: TASKS_EDGE_LABEL_BG, fillOpacity: hit ? 0.82 : 0.06 },
                style: {
                    ...edge.style,
                    stroke: hit ? edgeColor : TASKS_DIM_EDGE_INK,
                    opacity: tasksApplyEdgeOpacity(hit ? 0.98 : 0.08, edgeOpacity) * branchOpacity,
                    strokeWidth: hit ? 4.5 : 2.5,
                    strokeLinecap: hit ? 'round' : undefined,
                    '--vyasa-edge-flow-duration': hit ? '0.7s' : '0.6s',
                },
            };
        }));
        return result;
    }
    const highlightedEdgeIds = new Set();
    const descendantIds = collectTasksGroupDescendantIds(nodeId, model);
    const selectedScopeIds = new Set([nodeId, ...descendantIds]);
    const directEndpointIds = new Set([nodeId, ...descendantIds]);
    const isFocusedPrimary = hoveredNodeId === nodeId;
    const isFocusedNeighbor = hoveredNodeId && hoveredNodeId !== nodeId;
    const selectedNode = baseNodes.find((node) => node.id === nodeId);
    const selectedEdgeIds = new Set(selectedNode?.data?.__edge_ids__ || []);
    const touchesSelected = (edge) => (selectedEdgeIds.size
        ? selectedEdgeIds.has(edge.id)
        : (edge.source === nodeId || edge.target === nodeId));
    const selectDirectionId = selectedNode?.data?.__sequence_lane__ || nodeId;
    for (const edge of baseEdges) {
        if (touchesSelected(edge)) {
            highlightedEdgeIds.add(edge.id);
            directEndpointIds.add(edge.source);
            directEndpointIds.add(edge.target);
        }
        if (isTasksEdgeInternalToSelection(edge, selectedScopeIds)) {
            highlightedEdgeIds.add(edge.id);
        }
    }
    for (const endpointId of Array.from(directEndpointIds)) {
        for (const descendantId of collectTasksGroupDescendantIds(endpointId, model)) {
            directEndpointIds.add(descendantId);
        }
    }
    const hoverOutlineIds = tasksFilterHoverFocus(directEndpointIds, baseEdges, hoveredNodeId).nodeIds;
    if (hoveredNodeId) hoverOutlineIds.add(nodeId);
    const focusedEdgeModes = new Map();
    if (isFocusedPrimary) {
        for (const edge of baseEdges) {
            if (highlightedEdgeIds.has(edge.id) && touchesSelected(edge)) {
                focusedEdgeModes.set(edge.id, edge.source === selectDirectionId ? 'focused-out' : 'focused-in');
            }
        }
    } else if (isFocusedNeighbor && directEndpointIds.has(hoveredNodeId)) {
        for (const edge of baseEdges) {
            const linksSelectedAndHovered =
                (edge.source === nodeId && edge.target === hoveredNodeId) ||
                (edge.source === hoveredNodeId && edge.target === nodeId);
            if (linksSelectedAndHovered) focusedEdgeModes.set(edge.id, edge.source === selectDirectionId ? 'focused-out' : 'focused-in');
        }
    }
    const nextNodes = baseNodes.map((node) => {
        const sourceNodeId = node.data?.__kind__ === 'groupTitle' ? node.data?.sourceGroupId : node.id;
        const mode = directEndpointIds.has(sourceNodeId)
            ? (sourceNodeId === nodeId
                ? (isFocusedPrimary ? 'selected-focus' : 'selected')
                : (sourceNodeId === hoveredNodeId ? 'neighbor-focus' : 'neighbor'))
            : 'dim';
        const { nodeColor, displayColor, ringColor, activeBorderColor, checkedShadow } = colorsOf(node);
        const branchOpacity = node.data?.__projection_branch_opacity__ ?? 1;
        // A node selection names its states by mode; each mode has a ring and a z boost.
        const ringState = { selected: 'selected', 'selected-focus': 'selected', 'neighbor-focus': 'neighborFocus', neighbor: 'neighbor' }[mode];
        const zIndex = tasksStateZIndex(node, mode === 'dim' ? 0 : (mode === 'neighbor' ? TASKS_NEIGHBOR_Z_BOOST : TASKS_SELECTED_Z_BOOST));
        return {
            ...node,
            data: { ...node.data, highlightMode: mode, __hover_outline__: hoverOutlineIds.has(sourceNodeId) },
            style: {
                ...node.style,
                zIndex,
                '--vyasa-tasks-active-border': mode === 'dim' ? undefined : activeBorderColor,
                background: mode === 'dim' ? node.style.background : tasksLitNodeFill(node, nodeColor, displayColor, colorMix, 10),
                opacity: mode === 'dim' ? branchOpacity * TASKS_SELECTION_DIM_OPACITY : 1,
                boxShadow: ringState ? tasksStateShadow(ringState, ringColor, checkedShadow) : checkedShadow,
            },
            zIndex,
        };
    });
    const nextEdges = displayedEdges.map((edge) => {
        const requestedMode = focusedEdgeModes.get(edge.id)
            ? focusedEdgeModes.get(edge.id)
            : (highlightedEdgeIds.has(edge.id) ? 'selected' : 'dim');
        const mode = edge.data?.__reference__ && requestedMode !== 'dim' ? 'selected' : requestedMode;
        const highlighted = mode !== 'dim';
        const focused = mode === 'focused-in' || mode === 'focused-out';
        const fixedFocusedLabel = Boolean(isFocusedNeighbor && focused);
        const focusColor = mode === 'focused-in' ? TASKS_EDGE_FOCUS_IN_COLOR : TASKS_EDGE_FOCUS_OUT_COLOR;
        const edgeColor = edge.data?.edgeColor || edge.style?.stroke || 'currentColor';
        const branchOpacity = edge.data?.__projection_branch_opacity__ ?? 1;
        const activeOpacity = highlighted ? 1 : branchOpacity;
        const hoverDimsLabels = isTasksEdgeLabelHoverDimmingActive(nodeId, hoveredNodeId);
        const strokeMode = mode === 'selected'
            ? (edge.source === selectDirectionId ? 'selected-out' : (edge.target === selectDirectionId ? 'selected-in' : mode))
            : mode;
        return {
            ...edge,
            data: { ...edge.data, highlightMode: mode, strokeMode, hoverDimsLabels, flareKey: `${nodeId}:${hoveredNodeId || ''}` },
            zIndex: highlighted ? TASKS_EDGE_FOCUS_Z : TASKS_EDGE_Z,
            labelZIndex: tasksEdgeLabelZForMode(mode, TASKS_EDGE_LABEL_Z, TASKS_EDGE_LABEL_SELECTED_Z, TASKS_EDGE_LABEL_FOCUS_Z),
            labelStyle: {
                ...(edge.labelStyle || {}),
                fill: focused
                    ? focusColor
                    : (highlighted ? edgeColor : TASKS_DIM_LABEL_INK),
                opacity: activeOpacity * (hoverDimsLabels
                    ? (focused ? tasksProminentEdgeOpacity() : tasksApplyEdgeOpacity(0.05, edgeOpacity))
                    : (focused ? tasksProminentEdgeOpacity() : (highlighted ? tasksProminentEdgeOpacity() : tasksApplyEdgeOpacity(0.18, edgeOpacity)))),
                fontSize: fixedFocusedLabel ? `${TASKS_EDGE_LABEL_FOCUS_FONT_SIZE}px` : (edge.labelStyle?.fontSize || hoverFontSize),
                counterScaleMode: fixedFocusedLabel ? 'fixed' : 'capped',
                fontWeight: focused ? 850 : (highlighted ? 750 : 600),
            },
            labelBgStyle: {
                ...(edge.labelBgStyle || {}),
                fill: mode === 'focused-in'
                    ? 'color-mix(in srgb, var(--vyasa-paper) 78%, #22c55e 22%)'
                    : (mode === 'focused-out'
                        ? 'color-mix(in srgb, var(--vyasa-paper) 80%, #ef4444 20%)'
                        : TASKS_EDGE_LABEL_BG),
            fillOpacity: (mode === 'focused-in' || mode === 'focused-out') ? 1 : (highlighted ? 0.86 : 0.04),
            },
            style: {
                ...edge.style,
                stroke: mode === 'focused-in' || mode === 'focused-out'
                    ? focusColor
                    : (highlighted ? edgeColor : TASKS_DIM_EDGE_INK),
                opacity: activeOpacity * ((mode === 'focused-in' || mode === 'focused-out')
                    ? tasksProminentEdgeOpacity()
                    : (highlighted ? tasksProminentEdgeOpacity() : tasksApplyEdgeOpacity(0.08, edgeOpacity))),
                strokeWidth: tasksEdgeStrokeWidthForMode(strokeMode),
                '--vyasa-edge-flow-duration': (mode === 'focused-in' || mode === 'focused-out') ? '0.72s' : '0.64s',
                strokeLinecap: highlighted ? 'round' : undefined,
            },
        };
    });
    result.trace = {
        selectedNodeId: nodeId,
        hoveredNodeId: hoveredNodeId || '',
        isFocusedPrimary,
        isFocusedNeighbor: Boolean(isFocusedNeighbor),
        selectedScopeIds: Array.from(selectedScopeIds),
        directEndpointIds: Array.from(directEndpointIds),
        highlightedEdgeIds: Array.from(highlightedEdgeIds),
        focusedEdgeModes: Object.fromEntries(focusedEdgeModes),
    };
    result.nodes = (nextNodes);
    const edgePriority = { dim: 0, selected: 1, 'focused-in': 2, 'focused-out': 2 };
    nextEdges.sort((a, b) => (edgePriority[a.data?.highlightMode || 'dim'] - edgePriority[b.data?.highlightMode || 'dim']));
    result.edges = (nextEdges);
    return result;
}
