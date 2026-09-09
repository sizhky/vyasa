import {
    copyTasksText, openTasksNodeHref, renderTasksCardDetailsAndNotes, renderTasksCardNodeIcon,
    renderTasksCardNoteEditor, renderTasksDetailEntries, renderTasksInlineLinks, renderTasksNodeLinkBadge,
    tasksGroupDetailEntries, tasksHrefSupportsPreview, tasksNodeLinkKinds, tasksOpenDecisionEntry,
} from './tasks_cards.js';
import { logTasksDebug } from './tasks_diagnostics.js';
import { tasksIconFilterGroups } from './tasks_graph_core.js';
import {
    TASKS_EDGE_OPACITY_MAX, TASKS_EDGE_OPACITY_MIN, TASKS_GANTT_PROJECTION_ID, clampTasksEdgeOpacity,
    clampTasksProjectionDisplayOpacity, isTasksGradientPalette, normalizeTasksFilterQuery, normalizeTasksGroupByDisabledKeys,
    tasksCountFilterRules, tasksEdgeMetaEntries, tasksFilterOptions, tasksFilterQueryHasRules,
    tasksFilterQuerySelectedValues, tasksFilterValueEditorType, tasksFilterValueList, tasksGroupByOptions,
    tasksLogicalNodeId, tasksNodeMetaEntries, tasksNodeMetaLabel, tasksProjectionLayout,
} from './tasks_graph_model.js';
import { tasksIsFixedMode, tasksLayoutById } from './tasks_layouts.js';
import {
    normalizeTasksGradientStops, resolveTasksEdgeColor, tasksColorOptions, tasksColorPaletteEntries,
    tasksColorPaletteFor, tasksDisplayPaletteColor, tasksEdgeColorPaletteFor, tasksEdgeOpacityLabel,
    tasksGradientDomain, tasksOpacityPctLabel,
} from './tasks_paint.js';

// Panels read current state when called, after the app has built its actions.
export function createTasksPanels(getState) {
    const SelectedNodePanel = (panelGraphNodeId, readOnly = false, hoverCard = null) => {
        const { React, clearedNote, detailCardRef, detailCardScrollRef, edgeNodeLabels, focusGraphNode, graphBaseRef, handlePinnedCardKeyDown, hoverCardScrollMode, hoverCardScrollRef, model, nodeCardContentScale, nodeNotes, noteInputValue, noteTextareaRef, selectedNodeId, setClearedNote, setNoteInputValue, sourceModel, updateNodeNote } = getState();
        if (panelGraphNodeId === undefined) panelGraphNodeId = selectedNodeId;

        const selectedNode = (graphBaseRef.current.nodes || []).find((node) => node.id === panelGraphNodeId)?.data || null;
        const sourceNodeId = selectedNode?.__kind__ === 'groupTitle'
            ? selectedNode.sourceGroupId
            : tasksLogicalNodeId(selectedNode, selectedNode?.id);
        const baseEntries = selectedNode?.__kind__ === 'group'
            ? tasksGroupDetailEntries(sourceNodeId, model)
            : tasksNodeMetaEntries(selectedNode, model.node_attr_order, model.node_hidden_attrs);
        if (!selectedNode) return null;
        const panelNodeId = sourceNodeId || selectedNode.id || '';
        const openDecisionEntry = tasksOpenDecisionEntry(selectedNode);
        const entries = openDecisionEntry ? [openDecisionEntry, ...baseEntries] : baseEntries;
        const panelLinkKinds = Array.from(tasksNodeLinkKinds(selectedNode));
        const panelHref = String(selectedNode?.href || '').trim();
        const copyPanelTitle = async (event) => {
            event.preventDefault();
            event.stopPropagation();
            await copyTasksText(selectedNode.label || selectedNode.id);
        };
        const focusPanelNode = (event) => {
            if (event.type === 'keydown' && !['Enter', ' '].includes(event.key)) return;
            event.preventDefault();
            event.stopPropagation();
            focusGraphNode(panelGraphNodeId);
        };
        const nodeNotesEditor = renderTasksCardNoteEditor(React, {
            ref: readOnly ? undefined : noteTextareaRef,
            value: readOnly ? nodeNotes[panelNodeId] : noteInputValue,
            readOnly,
            onChange: readOnly ? undefined : (event) => setNoteInputValue(event.target.value),
            clearedValue: readOnly ? '' : clearedNote,
            onUndo: readOnly ? undefined : (event) => { event.preventDefault(); setNoteInputValue(clearedNote); updateNodeNote(panelNodeId, clearedNote); setClearedNote(null); },
            onClear: readOnly ? undefined : (event) => { event.preventDefault(); const prev = noteInputValue; setNoteInputValue(''); updateNodeNote(panelNodeId, ''); setClearedNote(prev); },
        });
        return renderTasksCardDetailsAndNotes(React, {
            props: {
                ref: readOnly ? undefined : detailCardRef,
                tabIndex: readOnly ? undefined : -1,
                className: readOnly ? undefined : 'vyasa-tasks-pinned-card',
                onKeyDown: readOnly ? undefined : (event) => handlePinnedCardKeyDown(event, noteTextareaRef, () => focusGraphNode(panelGraphNodeId)),
                'data-vyasa-node-card': 'true',
                style: { width: '100%', maxWidth: '100%', marginLeft: 'auto', boxSizing: 'border-box', borderRadius: '12px', border: '1px solid color-mix(in srgb, var(--vyasa-primary) 28%, transparent)', background: 'color-mix(in srgb, var(--vyasa-paper) 92%, transparent)', boxShadow: '0 10px 30px rgba(0,0,0,0.12)', backdropFilter: 'blur(8px)', flex: '0 1 auto' },
            },
            scrollRef: hoverCard ? hoverCardScrollRef : detailCardScrollRef,
            scrollMode: hoverCardScrollMode,
            contentScale: nodeCardContentScale,
            details: React.createElement(React.Fragment, null,
            React.createElement('div', { style: { position: 'relative', paddingRight: panelLinkKinds.length ? '56px' : '28px', marginBottom: '10px' } },
                panelLinkKinds.length ? renderTasksNodeLinkBadge(React, { kinds: panelLinkKinds, right: '0', top: '0' }) : null,
                React.createElement('button', {
                    type: 'button',
                    title: 'Copy title',
                    'aria-label': 'Copy title',
                    'data-vyasa-task-control': 'true',
                    onClick: copyPanelTitle,
                    style: {
                        position: 'absolute',
                        top: '0',
                        right: panelLinkKinds.length ? '28px' : '0',
                        border: 'none',
                        background: 'none',
                        cursor: 'pointer',
                        fontSize: '12px',
                        lineHeight: 1,
                        opacity: 0.58,
                        padding: '0',
                    },
                }, '⧉'),
                React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', rowGap: '3px', alignItems: 'start' } },
                    React.createElement('div', { style: { display: 'flex', alignItems: 'flex-start', gap: '7px', fontSize: '14px', fontWeight: 700, lineHeight: 1.3, minWidth: 0, overflowWrap: 'break-word' } },
                        renderTasksCardNodeIcon(React, selectedNode, model),
                        React.createElement('span', { role: 'button', tabIndex: 0, title: 'Center node', onClick: focusPanelNode, onKeyDown: focusPanelNode, style: { minWidth: 0, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: '2px' } },
                            renderTasksInlineLinks(selectedNode.label || selectedNode.id, { currentPath: sourceModel?.document_path || '', nodeLabels: edgeNodeLabels }))
                    ),
                    panelNodeId ? React.createElement('div', { title: panelNodeId, style: { fontSize: '12px', lineHeight: 1.3, fontWeight: 600, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace', opacity: 0.7, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, panelNodeId) : null,
                ),
                panelHref ? React.createElement('a', {
                    href: panelHref,
                    'data-vyasa-link-preview': tasksHrefSupportsPreview(panelHref) ? 'true' : undefined,
                    'data-vyasa-link-preview-current-path': sourceModel?.document_path || undefined,
                    onClick: (event) => openTasksNodeHref(panelHref, event),
                    style: { display: 'inline-block', marginTop: '6px', fontSize: '12px', lineHeight: 1.3, textDecoration: 'underline', textUnderlineOffset: '2px', color: 'inherit', overflowWrap: 'anywhere', wordBreak: 'break-word' },
                }, panelHref) : null,
            ),
            renderTasksDetailEntries(React, entries, { copyValues: true, currentPath: sourceModel?.document_path || '' })
            ),
            notes: nodeNotesEditor,
        });
    };

    const SelectedEdgePanel = () => {
        const { React, detailCardRef, detailCardScrollRef, edgeCardError, edgeCardOpen, edgeNodeLabels, edgeNodesById, edgeNoteTextareaRef, edgeNotes, edgeTypeColors, fitSelectedEdgeConnection, handlePinnedCardKeyDown, hoverCardScrollMode, model, nodeCardContentScale, optionEdgeNodeIdRef, reactFlowApiRef, selectedEdgeIdRef, selectedEdgeRecord, setEdgeCardField, setEdgeCardOpen, setEdgeStatus, setSelectedEdgeId, setSelectedEdgeRecord, sourceModel, updateEdgeNote } = getState();
        if (!edgeCardOpen) return null;
        if (edgeCardError) return React.createElement('div', {
            role: 'alert',
            'data-vyasa-edge-card': 'error',
            style: { width: '100%', marginLeft: 'auto', boxSizing: 'border-box', borderRadius: '12px', border: '1px solid color-mix(in srgb, #dc2626 45%, transparent)', background: 'color-mix(in srgb, var(--vyasa-paper) 92%, #dc2626 8%)', padding: '12px', pointerEvents: 'auto', fontSize: '12px', lineHeight: 1.45 },
        }, edgeCardError);
        if (!selectedEdgeRecord) return null;
        const sourceLabel = edgeNodeLabels[selectedEdgeRecord.source] || selectedEdgeRecord.source || '';
        const targetLabel = edgeNodeLabels[selectedEdgeRecord.target] || selectedEdgeRecord.target || '';
        const relation = selectedEdgeRecord.relation || selectedEdgeRecord.label || '';
        const sourceNode = edgeNodesById.get(String(selectedEdgeRecord.source || '')) || { id: selectedEdgeRecord.source, __kind__: 'task' };
        const targetNode = edgeNodesById.get(String(selectedEdgeRecord.target || '')) || { id: selectedEdgeRecord.target, __kind__: 'task' };
        const edgeCardColor = selectedEdgeRecord.__reference__
            ? 'var(--vyasa-primary)'
            : (resolveTasksEdgeColor(selectedEdgeRecord, model, model?.edge_color_by, tasksEdgeColorPaletteFor(model, model?.edge_color_by)) || edgeTypeColors[relation] || 'currentColor');
        const entries = tasksEdgeMetaEntries(selectedEdgeRecord, model.edge_attr_order, model.edge_hidden_attrs);
        const edgeNotesEditor = renderTasksCardNoteEditor(React, {
            ref: edgeNoteTextareaRef,
            value: edgeNotes[selectedEdgeRecord.id] || '',
            ariaLabel: `Notes for edge ${selectedEdgeRecord.id}`,
            onChange: (event) => updateEdgeNote(selectedEdgeRecord.id, event.target.value),
        });
        return renderTasksCardDetailsAndNotes(React, {
            props: {
                ref: detailCardRef,
                tabIndex: -1,
                className: 'vyasa-tasks-pinned-card',
                onKeyDown: (event) => handlePinnedCardKeyDown(event, edgeNoteTextareaRef, () => fitSelectedEdgeConnection(reactFlowApiRef.current)),
                'data-vyasa-edge-card': selectedEdgeRecord.id,
                style: { width: '100%', maxWidth: '100%', marginLeft: 'auto', boxSizing: 'border-box', borderRadius: '12px', border: '2px solid color-mix(in srgb, var(--vyasa-primary) 76%, transparent)', background: 'color-mix(in srgb, var(--vyasa-paper) 94%, transparent)', boxShadow: '0 10px 30px rgba(0,0,0,0.12), 0 0 18px color-mix(in srgb, var(--vyasa-primary) 24%, transparent)', backdropFilter: 'blur(8px)' },
            },
            scrollRef: detailCardScrollRef,
            scrollMode: hoverCardScrollMode,
            contentScale: nodeCardContentScale,
            details: React.createElement(React.Fragment, null,
            React.createElement('div', { style: { display: 'flex', alignItems: 'start', gap: '10px', marginBottom: '10px' } },
                React.createElement('div', { style: { flex: '1 1 auto', minWidth: 0 } },
                    React.createElement('div', { style: { display: 'grid', gap: '4px', fontSize: '14px', fontWeight: 700, lineHeight: 1.3, overflowWrap: 'anywhere' } },
                        React.createElement('div', { style: { display: 'flex', alignItems: 'flex-start', gap: '7px' } }, renderTasksCardNodeIcon(React, sourceNode, model), React.createElement('span', { style: { minWidth: 0 } }, renderTasksInlineLinks(sourceLabel, { currentPath: sourceModel?.document_path || '', nodeLabels: edgeNodeLabels }))),
                        relation ? React.createElement('div', { style: { paddingLeft: '29px', fontSize: '12px', fontWeight: 600, color: edgeCardColor, opacity: 0.82 } }, relation) : null,
                        React.createElement('div', { style: { display: 'flex', alignItems: 'flex-start', gap: '7px' } }, renderTasksCardNodeIcon(React, targetNode, model), React.createElement('span', { style: { minWidth: 0 } }, renderTasksInlineLinks(targetLabel, { currentPath: sourceModel?.document_path || '', nodeLabels: edgeNodeLabels })))
                    ),
                    React.createElement('div', { style: { marginTop: '4px', fontSize: '12px', lineHeight: 1.3, fontWeight: 600, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace', opacity: 0.7, overflowWrap: 'anywhere' } }, selectedEdgeRecord.id),
                    sourceModel?.kg_context?.label ? React.createElement('div', { style: { marginTop: '3px', fontSize: '12px', lineHeight: 1.3, opacity: 0.62 } }, sourceModel.kg_context.label) : null
                ),
                React.createElement('button', {
                    type: 'button', title: 'Close edge details', 'aria-label': 'Close edge details',
                    onClick: () => {
                        selectedEdgeIdRef.current = null;
                        optionEdgeNodeIdRef.current = '';
                        setSelectedEdgeId(null);
                        setSelectedEdgeRecord(null);
                        setEdgeCardOpen(false);
                        setEdgeCardField('');
                        setEdgeStatus('Edge details closed.');
                    },
                    style: { border: 0, background: 'transparent', color: 'inherit', cursor: 'pointer', fontSize: '18px', lineHeight: 1, padding: 0, opacity: 0.62 },
                }, '×')
            ),
            renderTasksDetailEntries(React, entries, { copyValues: true, edgeFields: true, currentPath: sourceModel?.document_path || '' })
            ),
            notes: edgeNotesEditor,
        });
    };

    const FilterPanel = () => {
        const { React, TASKS_ADD_VIEW_OPTION_ID, aclViewerOptions, activeAclViewer, activeColorHierarchy, activeContextId, activeContextIndex, activeEdgeTypes, activeFilters, activeGroupByHierarchy, activeProjectionId, activeSwatchFilters, allClearedNotes, buildProjectionConfigText, contextDiffEnabled, contextDiffLoading, contextLoading, contextOptions, edgeOpacity, edgeTypeColors, edgeTypeFilterEnabled, edgeTypeMenuOpen, edgeTypeOptions, edgeTypeQuery, effectiveEdgeTypes, egoMode, filterPanelMaxHeight, filterPanelRef, filterPanelWidthSetting, filtersCollapsed, groupByDisabledSet, groupByEnabled, groupByHierarchy, handleAddView, handleClearAllNotes, handleCopyNodeNotes, handleDefaultViewPaste, handleExportNodeNotes, handleImportNodeNotes, handleSwitchContext, handleUndoClearAllNotes, hoverInactiveNodes, model, nodeNotes, pendingFitActionRef, projectionOptions, projectionUnspecifiedContentOpacity, queryBuilderEnabled, queryBuilderReady, reorderActiveColorLevel, reorderGroupByLevel, resetProjectionControls, searchEnabled, searchInputRef, searchInputValue, searchMatches, setActiveAclViewer, setActiveColorLevel, setActiveEdgeTypes, setActiveFilters, setActiveProjectionId, setContextDiffEnabled, setDragSelection, setEdgeOpacity, setEdgeTypeFilterEnabled, setEdgeTypeMenuOpen, setEdgeTypeQuery, setFiltersCollapsedGuarded, setGroupByDisabledKeys, setGroupByEnabled, setGroupByHierarchy, setHoverInactiveNodes, setHoveredNodeId, setProjectionUnspecifiedContentOpacity, setQueryBuilderEnabled, setSearchEnabled, setSearchInputValue, setSearchQuery, setSelectedNodeId, setSelectedNodeIds, setViewMode, slideIndex, slideNotes, sourceModel, tasksCaptionElement, toggleFilterValue, viewMode, widgetId } = getState();
        if (egoMode || slideIndex >= 0) return null;
        const options = tasksFilterOptions(model);
        const colorOptions = tasksColorOptions(model, nodeNotes);
        const iconFilterGroups = tasksIconFilterGroups(model);
        const groupByOptions = tasksGroupByOptions(sourceModel);
        const activeProjectionOption = projectionOptions.find((projection) => (
            viewMode === 'gantt'
                ? projection.id === TASKS_GANTT_PROJECTION_ID
                : projection.id === activeProjectionId
        )) || null;
        const customGroupingAvailable = !tasksIsFixedMode(viewMode);
        const groupByControlsEnabled = customGroupingAvailable && groupByEnabled;
        const displayedGroupByHierarchy = customGroupingAvailable ? groupByHierarchy : [];
        const activeGroupByCount = groupByControlsEnabled ? activeGroupByHierarchy.length : 0;
        const groupByLevels = displayedGroupByHierarchy.filter(Boolean);
        if (customGroupingAvailable && groupByEnabled) groupByLevels.push('');
        if (!groupByLevels.length && !tasksIsFixedMode(viewMode)) groupByLevels.push('');
        const activeCount = (queryBuilderEnabled ? tasksCountFilterRules(activeFilters) : 0) + tasksCountFilterRules(activeSwatchFilters) + effectiveEdgeTypes.length + activeColorHierarchy.length + (searchMatches.active ? 1 : 0) + activeGroupByCount;
        const normalizedEdgeTypeQuery = edgeTypeQuery.trim().toLowerCase();
        const visibleEdgeTypeOptions = edgeTypeOptions.filter((type) => (
            !normalizedEdgeTypeQuery || type.toLowerCase().includes(normalizedEdgeTypeQuery)
        ));
        const QueryBuilder = queryBuilderEnabled && queryBuilderReady ? window.VyasaTasksQueryBuilder?.QueryBuilder : null;
        const filterSectionStyle = { display: 'grid', gap: '8px', fontSize: '12px' };
        const filterInlineControlStyle = { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '12px', alignItems: 'start', minWidth: 0 };
        const filterKeyStyle = { fontWeight: 700, opacity: 0.7, lineHeight: 1.35 };
        const filterValueStackStyle = { display: 'grid', gap: '6px', minWidth: 0 };
        const filterChoiceListStyle = { display: 'grid', gap: '8px', minWidth: 0 };
        const filterChoiceStyle = { display: 'grid', gridTemplateColumns: '16px minmax(0, 1fr)', alignItems: 'center', columnGap: '10px', minWidth: 0 };
        const textQueryBuilderOperators = [
            { name: 'notnull', label: 'attribute exists' },
            { name: 'contains', label: 'has string' },
            { name: 'doesNotContain', label: 'does not have string' },
            { name: 'matchesRegex', label: 'regex matches' },
            { name: '=', label: 'is exactly' },
            { name: '!=', label: 'is not exactly' },
        ];
        const enumQueryBuilderOperators = [
            { name: 'notnull', label: 'attribute exists' },
            { name: '=', label: 'is' },
            { name: '!=', label: 'is not' },
            { name: 'in', label: 'is any of' },
            { name: 'notIn', label: 'is none of' },
            { name: 'contains', label: 'has string' },
            { name: 'doesNotContain', label: 'does not have string' },
            { name: 'matchesRegex', label: 'regex matches' },
        ];
        const queryBuilderFields = options.map((option) => ({
            name: option.key,
            label: option.label,
            valueEditorType: tasksFilterValueEditorType,
            values: (option.isBoolean ? ['true', 'false'] : option.values).map((value) => ({ name: value, label: value })),
            operators: option.isText ? textQueryBuilderOperators : enumQueryBuilderOperators,
        }));
        const queryBuilderOperators = enumQueryBuilderOperators;
        const colorLevelSlots = activeColorHierarchy.length ? [...activeColorHierarchy] : [''];
        const remainingColorOptions = colorOptions.filter((option) => !activeColorHierarchy.includes(option.key));
        if (activeColorHierarchy.length && remainingColorOptions.length) colorLevelSlots.push('');
        const renderColorPalette = (colorBy) => {
            if (!colorBy || colorBy === 'rank') return null;
            const palette = tasksColorPaletteFor(model, colorBy);
            const gradientStops = normalizeTasksGradientStops(palette);
            const gradientDomain = tasksGradientDomain(palette, gradientStops);
            const selectedValues = new Set(tasksFilterQuerySelectedValues(activeSwatchFilters, colorBy));
            if (isTasksGradientPalette(palette)) {
                return React.createElement('div', { style: { flexBasis: '100%', marginTop: '4px', padding: '8px', borderRadius: '8px', background: 'color-mix(in srgb, currentColor 4%, transparent)' } },
                    React.createElement('div', { style: { display: 'grid', gap: '6px', fontSize: '11px', lineHeight: 1.3, opacity: 0.85 } },
                        React.createElement('div', { style: {
                            height: '12px',
                            borderRadius: '999px',
                            border: '1px solid color-mix(in srgb, currentColor 12%, transparent)',
                            background: `linear-gradient(90deg, ${gradientStops.map((stop) => {
                                const start = gradientDomain?.start ?? gradientStops[0]?.at ?? 0;
                                const end = gradientDomain?.end ?? gradientStops[gradientStops.length - 1]?.at ?? 1;
                                const span = Math.max(end - start, 1);
                                return `${tasksDisplayPaletteColor(stop.color)} ${((stop.at - start) / span) * 100}%`;
                            }).join(', ')})`,
                        } }),
                        React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' } },
                            ...gradientStops.map((stop, index) => React.createElement('span', { key: `${colorBy}-stop-${index}` }, stop.label || (Number.isInteger(stop.at) ? `${stop.at}` : `${stop.at}`)))
                        )
                    )
                );
            }
            const entries = tasksColorPaletteEntries(model, colorBy, nodeNotes);
            if (!entries.length) return null;
            return React.createElement('div', { style: { flexBasis: '100%', marginTop: '4px', padding: '8px', borderRadius: '8px', background: 'color-mix(in srgb, currentColor 4%, transparent)' } },
                React.createElement('div', { style: { display: 'grid', gap: '4px', fontSize: '11px', lineHeight: 1.3, opacity: 0.8 } },
                    ...entries.map(([value, color]) => {
                        const displayColor = tasksDisplayPaletteColor(color);
                        const selected = selectedValues.has(value);
                        return React.createElement('button', {
                            key: `${colorBy}-${value}-label`,
                            type: 'button',
                            'aria-pressed': selected,
                            onClick: () => toggleFilterValue(colorBy, value, !selected),
                            style: {
                                display: 'grid',
                                gridTemplateColumns: '12px 1fr',
                                alignItems: 'center',
                                gap: '6px',
                                width: '100%',
                                padding: '4px 6px',
                                borderRadius: '6px',
                                border: selected ? `1px solid ${displayColor}` : '1px solid transparent',
                                background: selected ? `color-mix(in srgb, ${displayColor} 16%, transparent)` : 'transparent',
                                cursor: 'pointer',
                                textAlign: 'left',
                                color: 'inherit',
                            },
                        },
                        React.createElement('span', { style: { width: '12px', height: '12px', borderRadius: '999px', background: displayColor, border: '1px solid color-mix(in srgb, currentColor 20%, transparent)' } }),
                        React.createElement('span', null, value));
                    })
                )
            );
        };
        const renderColorLevel = (colorBy, index) => {
            const usedBefore = new Set(activeColorHierarchy.slice(0, index));
            const selectableColorOptions = colorOptions
                .filter((option) => option.key === colorBy || !usedBefore.has(option.key))
                .map((option) => ({ key: option.key, label: option.label, special: option.special }));
            const normalColorOptions = selectableColorOptions.filter((option) => !option.special);
            const specialColorOptions = selectableColorOptions.filter((option) => option.special);
            const renderColorOption = (option) => React.createElement('option', { key: option.key || '__none__', value: option.key }, option.label);
            const draggable = Boolean(colorBy);
            return React.createElement('div', { key: `color-level-${index}`, style: { ...filterSectionStyle, marginBottom: '12px', paddingBottom: '10px', borderBottom: '1px solid color-mix(in srgb, currentColor 12%, transparent)' } },
                React.createElement('span', { style: filterKeyStyle }, index === 0 ? 'Color by' : `Color ${index + 1}`),
                React.createElement('div', { style: filterValueStackStyle },
                    React.createElement('div', {
                        onDragOver: (event) => {
                            if (!draggable || !Array.from(event.dataTransfer.types || []).includes('text/x-vyasa-color-level')) return;
                            event.preventDefault();
                            event.dataTransfer.dropEffect = 'move';
                        },
                        onDrop: (event) => {
                            const from = Number.parseInt(event.dataTransfer.getData('text/x-vyasa-color-level'), 10);
                            if (Number.isInteger(from)) {
                                event.preventDefault();
                                reorderActiveColorLevel(from, index);
                            }
                        },
                        style: { display: 'flex', gap: '6px', alignItems: 'center' },
                    },
                        React.createElement('span', {
                            draggable,
                            title: 'Drag to reorder',
                            'aria-label': 'Drag to reorder color level',
                            onDragStart: (event) => {
                                if (!draggable) return;
                                event.dataTransfer.setData('text/x-vyasa-color-level', String(index));
                                event.dataTransfer.effectAllowed = 'move';
                            },
                            style: { flex: '0 0 auto', cursor: draggable ? 'grab' : 'default', opacity: draggable ? 0.7 : 0.25, fontWeight: 700, letterSpacing: '0.04em', userSelect: 'none' },
                        }, '::'),
                        React.createElement('select', {
                            value: colorBy || '',
                            onChange: (event) => setActiveColorLevel(index, event.target.value),
                            style: {
                                flex: '1 1 auto',
                                minWidth: 0,
                                border: '1px solid color-mix(in srgb, currentColor 16%, transparent)',
                                borderRadius: '8px',
                                padding: '6px 8px',
                                background: 'color-mix(in srgb, var(--vyasa-paper) 96%, transparent)',
                                color: 'inherit',
                            },
                        },
                        renderColorOption({ key: '', label: 'None' }),
                        ...normalColorOptions.map(renderColorOption),
                        specialColorOptions.length
                            ? React.createElement('option', { key: '__special_color_modes__', value: '__special_color_modes__', disabled: true }, '---')
                            : null,
                        ...specialColorOptions.map(renderColorOption)),
                        colorBy ? React.createElement('button', {
                            type: 'button',
                            title: 'Remove this color level',
                            'aria-label': 'Remove this color level',
                            onClick: () => setActiveColorLevel(index, ''),
                            style: {
                                flex: '0 0 auto',
                                border: '1px solid color-mix(in srgb, currentColor 16%, transparent)',
                                borderRadius: '8px',
                                padding: '6px 9px',
                                background: 'color-mix(in srgb, var(--vyasa-paper) 96%, transparent)',
                                color: 'inherit',
                                cursor: 'pointer',
                                lineHeight: 1,
                            },
                        }, '×') : null
                    ),
                    renderColorPalette(colorBy)
                )
            );
        };
        const renderIconFilterGroup = (group) => {
            const selectedValues = new Set(tasksFilterQuerySelectedValues(activeSwatchFilters, group.key));
            return React.createElement('details', {
                key: `icon-filter-${group.key}`,
                className: 'vyasa-tasks-icon-filter-group',
            },
                React.createElement('summary', null,
                    React.createElement('span', null, `${tasksNodeMetaLabel(group.key)} icons`),
                    selectedValues.size ? React.createElement('span', { className: 'vyasa-tasks-icon-filter-count' }, String(selectedValues.size)) : null
                ),
                React.createElement('div', {
                    style: {
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(34px, 1fr))',
                        gap: '8px',
                        alignItems: 'center',
                    },
                },
                    ...group.entries.map(([value, image]) => {
                        const selected = selectedValues.has(value);
                        return React.createElement('button', {
                            key: `${group.key}-${value}`,
                            type: 'button',
                            className: 'vyasa-tasks-icon-filter-button',
                            'aria-label': `${tasksNodeMetaLabel(group.key)}: ${value}`,
                            'aria-pressed': selected,
                            onClick: () => toggleFilterValue(group.key, value, !selected),
                            style: {
                                width: '34px',
                                height: '34px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: '8px',
                                border: selected ? '1px solid var(--vyasa-primary)' : '1px solid color-mix(in srgb, currentColor 14%, transparent)',
                                background: selected ? 'color-mix(in srgb, var(--vyasa-primary) 14%, transparent)' : 'color-mix(in srgb, var(--vyasa-paper) 96%, transparent)',
                                color: 'inherit',
                                cursor: 'pointer',
                                padding: '6px',
                            },
                        },
                        React.createElement('span', { className: 'vyasa-tasks-icon-filter-glyph', 'aria-hidden': 'true', style: { '--vyasa-tasks-icon-url': `url("${image}")` } }),
                        React.createElement('span', { className: 'vyasa-tasks-icon-filter-tooltip', role: 'tooltip' }, value));
                    })
                )
            );
        };
        const renderIconFilters = () => {
            if (!iconFilterGroups.length) return null;
            const selectedIconCount = iconFilterGroups.reduce((count, group) => count + tasksFilterQuerySelectedValues(activeSwatchFilters, group.key).length, 0);
            return React.createElement('details', {
                className: 'vyasa-tasks-icon-filter-section',
                style: { ...filterSectionStyle, marginBottom: '12px', paddingBottom: '10px', borderBottom: '1px solid color-mix(in srgb, currentColor 12%, transparent)' },
            },
                React.createElement('summary', null,
                    React.createElement('span', null, 'Icons'),
                    selectedIconCount ? React.createElement('span', { className: 'vyasa-tasks-icon-filter-count' }, String(selectedIconCount)) : null
                ),
                React.createElement('div', { className: 'vyasa-tasks-icon-filter-groups' },
                    ...iconFilterGroups.map(renderIconFilterGroup)
                )
            );
        };
        const QueryValueEditor = (props) => {
            const values = Array.isArray(props.values) ? props.values : [];
            const optionValue = (option) => String(option.value ?? option.name ?? '');
            const optionLabel = (option) => String(option.label ?? option.name ?? option.value ?? '');
            if (props.operator === 'notnull' || props.operator === 'null') return null;
            if (props.operator === 'contains' || props.operator === 'doesNotContain' || props.operator === 'matchesRegex') {
                return React.createElement('input', {
                    type: 'text',
                    value: Array.isArray(props.value) ? props.value.join(', ') : String(props.value ?? ''),
                    onChange: (event) => props.handleOnChange(event.target.value),
                    placeholder: props.operator === 'matchesRegex' ? 'Regex' : 'Text to match',
                    className: props.className,
                });
            }
            if (props.operator === 'in' || props.operator === 'notIn') {
                const selected = new Set(tasksFilterValueList(props.value));
                return React.createElement('div', { className: `${props.className || ''} vyasa-tasks-query-values` },
                    values.map((option) => {
                        const value = optionValue(option);
                        return React.createElement('label', { key: value, className: 'vyasa-tasks-query-value-option' },
                            React.createElement('input', {
                                type: 'checkbox',
                                checked: selected.has(value),
                                onChange: (event) => {
                                    const next = new Set(selected);
                                    if (event.target.checked) next.add(value); else next.delete(value);
                                    props.handleOnChange(Array.from(next));
                                },
                            }),
                            React.createElement('span', null, optionLabel(option))
                        );
                    })
                );
            }
            return React.createElement('select', {
                value: Array.isArray(props.value) ? String(props.value[0] ?? '') : String(props.value ?? ''),
                onChange: (event) => props.handleOnChange(event.target.value),
                className: props.className,
            },
                React.createElement('option', { value: '' }, 'Choose value'),
                values.map((option) => React.createElement('option', { key: optionValue(option), value: optionValue(option) }, optionLabel(option)))
            );
        };
        const QueryMuteToggle = (props) => React.createElement('label', {
            className: props.className,
            title: props.title,
            style: { display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', opacity: props.disabled ? 0.5 : 0.82, cursor: props.disabled ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' },
        },
        React.createElement('input', {
            type: 'checkbox',
            checked: !props.ruleOrGroup?.muted,
            disabled: props.disabled,
            onChange: (event) => props.handleOnClick?.(event),
        }),
        React.createElement('span', null, 'Active'));
        const isOpen = !filtersCollapsed;
        const filterPanelWidth = `min(${filterPanelWidthSetting}, calc(100% - 24px))`;
        return React.createElement('aside', {
            'aria-hidden': !isOpen,
            style: {
                flex: isOpen ? `0 0 ${filterPanelWidth}` : '0 0 0px',
                width: isOpen ? filterPanelWidth : '0px',
                minWidth: 0,
                maxWidth: isOpen ? 'calc(100% - 24px)' : '0px',
                height: '100%',
                overflow: 'hidden',
                pointerEvents: isOpen ? 'auto' : 'none',
                transition: 'flex-basis 180ms ease, width 180ms ease',
            },
        },
            React.createElement('div', {
                ref: filterPanelRef,
                className: 'vyasa-tasks-filter-card',
                style: {
                    width: '100%',
                    maxWidth: '100%',
                    maxHeight: filterPanelMaxHeight,
                    overflowX: 'hidden',
                    overflowY: 'auto',
                    borderRadius: '0 8px 8px 8px',
                    background: 'color-mix(in srgb, var(--vyasa-paper) 92%, transparent)',
                    backdropFilter: 'blur(8px)',
                    padding: '12px',
                    boxSizing: 'border-box',
                    opacity: isOpen ? 1 : 0,
                    visibility: isOpen ? 'visible' : 'hidden',
                    transition: 'opacity 120ms ease',
                },
            },
            React.createElement('div', {
                style: {
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    position: 'sticky',
                    top: '-12px',
                    margin: '-12px -12px 0',
                    padding: '12px',
                    background: 'color-mix(in srgb, var(--vyasa-paper) 92%, transparent)',
                    backdropFilter: 'blur(8px)',
                    zIndex: 1,
                },
            },
                React.createElement('div', { style: { fontSize: '12px', fontWeight: 700, opacity: 0.65, textTransform: 'uppercase', letterSpacing: '0.04em' } }, activeCount ? `Filters (${activeCount})` : 'Filters'),
                React.createElement('div', { style: { display: 'inline-flex', alignItems: 'center', gap: '8px' } },
                    React.createElement('button', { type: 'button', onClick: resetProjectionControls, style: { border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: '12px', textDecoration: 'underline', whiteSpace: 'nowrap', color: 'inherit' } }, 'Reset'),
                    React.createElement('button', { type: 'button', onClick: () => setFiltersCollapsedGuarded(true, 'close-filter-panel'), style: { border: 'none', background: 'none', cursor: 'pointer', padding: '2px 4px', fontSize: '14px', lineHeight: 1, color: 'inherit', opacity: 0.7 } }, '×')
                )
            ),
            React.createElement('div', {
                style: {
                    marginTop: '12px',
                    paddingRight: '2px',
                    paddingBottom: '2px',
                },
            },
                contextOptions.length > 1 ? React.createElement('div', { style: { ...filterSectionStyle, marginBottom: '12px', paddingBottom: '10px', borderBottom: '1px solid color-mix(in srgb, currentColor 12%, transparent)' } },
                    React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' } },
                        React.createElement('span', { style: filterKeyStyle }, 'Context'),
                        React.createElement('label', {
                            className: 'vyasa-tasks-toggle-label',
                            title: activeContextIndex <= 0 ? 'The first context has no previous context' : 'Glow changes from previous context',
                            style: { fontSize: '11px', fontWeight: 650 },
                        },
                            React.createElement('input', {
                                type: 'checkbox',
                                className: 'vyasa-tasks-switch-input',
                                'aria-label': 'Select changes from previous context',
                                checked: contextDiffEnabled && activeContextIndex > 0,
                                disabled: contextLoading || contextDiffLoading || activeContextIndex <= 0,
                                onChange: (event) => setContextDiffEnabled(event.target.checked),
                            }),
                            React.createElement('span', { className: 'vyasa-tasks-switch-track', 'aria-hidden': 'true' }),
                            React.createElement('span', null, contextDiffLoading ? 'Loading' : 'Diff')
                        )
                    ),
                    (() => {
                        const ctxIndex = activeContextIndex;
                        const ctxNavBtn = (disabled) => ({ flex: '0 0 34px', width: '34px', height: '34px', border: '1px solid color-mix(in srgb, var(--vyasa-primary) 24%, transparent)', background: 'color-mix(in srgb, var(--vyasa-paper) 88%, transparent)', color: 'inherit', borderRadius: '8px', padding: 0, fontSize: '18px', lineHeight: 1, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.4 : 1 });
                        const goContext = (delta) => {
                            const target = contextOptions[ctxIndex + delta];
                            if (target) handleSwitchContext(target.id);
                        };
                        const prevDisabled = contextLoading || ctxIndex <= 0;
                        const nextDisabled = contextLoading || ctxIndex < 0 || ctxIndex >= contextOptions.length - 1;
                        return React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 } },
                            React.createElement('button', { type: 'button', 'aria-label': 'Previous context', onClick: () => goContext(-1), disabled: prevDisabled, style: ctxNavBtn(prevDisabled) }, '‹'),
                            React.createElement('select', {
                                    value: activeContextId,
                                    disabled: contextLoading,
                                    onChange: (event) => handleSwitchContext(event.target.value),
                                    style: {
                                        flex: '1 1 auto',
                                        width: '100%',
                                        minWidth: 0,
                                        border: '1px solid color-mix(in srgb, currentColor 16%, transparent)',
                                        borderRadius: '8px',
                                        padding: '6px 8px',
                                        background: 'color-mix(in srgb, var(--vyasa-paper) 96%, transparent)',
                                        color: 'inherit',
                                    },
                                },
                                    ...contextOptions.map((context) => React.createElement(
                                        'option',
                                        { key: context.id, value: context.id },
                                        `${context.seq}. ${context.label || context.caption || context.id}`
                                    ))
                                ),
                            React.createElement('button', { type: 'button', 'aria-label': 'Next context', onClick: () => goContext(1), disabled: nextDisabled, style: ctxNavBtn(nextDisabled) }, '›')
                        );
                    })(),
                    tasksCaptionElement(sourceModel?.kg_context, {
                        padding: '9px 10px',
                        borderRadius: '8px',
                        border: '1px solid color-mix(in srgb, currentColor 10%, transparent)',
                        background: 'color-mix(in srgb, var(--vyasa-paper) 97%, transparent)',
                        fontSize: '11px',
                        lineHeight: 1.45,
                        opacity: 0.82,
                    })
                ) : null,
                aclViewerOptions.length ? React.createElement('div', { style: { ...filterSectionStyle, marginBottom: '12px', paddingBottom: '10px', borderBottom: '1px solid color-mix(in srgb, currentColor 12%, transparent)' } },
                    React.createElement('span', { style: filterKeyStyle }, 'Viewer'),
                    React.createElement('select', {
                        value: activeAclViewer,
                        onChange: (event) => {
                            setActiveAclViewer(event.target.value);
                            setSelectedNodeId(null);
                            setSelectedNodeIds(new Set());
                            setDragSelection(null);
                            setHoveredNodeId(null);
                            pendingFitActionRef.current = 'mode';
                        },
                        style: {
                            width: '100%',
                            minWidth: 0,
                            border: '1px solid color-mix(in srgb, currentColor 16%, transparent)',
                            borderRadius: '8px',
                            padding: '6px 8px',
                            background: 'color-mix(in srgb, var(--vyasa-paper) 96%, transparent)',
                            color: 'inherit',
                        },
                    },
                        React.createElement('option', { value: '' }, 'All'),
                        ...aclViewerOptions.map((viewer) => React.createElement('option', { key: viewer.id, value: viewer.id }, viewer.label))
                    )
                ) : null,
                projectionOptions.length >= 1 ? React.createElement('div', { style: { ...filterSectionStyle, marginBottom: '12px', paddingBottom: '10px', borderBottom: '1px solid color-mix(in srgb, currentColor 12%, transparent)' } },
                    React.createElement('span', { style: filterKeyStyle }, 'View'),
                    React.createElement('div', { style: filterInlineControlStyle },
                        React.createElement('select', {
                            value: viewMode === 'gantt' ? TASKS_GANTT_PROJECTION_ID : activeProjectionId,
                            onPaste: handleDefaultViewPaste,
                            onChange: async (event) => {
                                const nextProjectionId = event.target.value;
                                if (nextProjectionId === TASKS_ADD_VIEW_OPTION_ID) {
                                    await handleAddView();
                                    return;
                                }
                                setSelectedNodeId(null);
                                setSelectedNodeIds(new Set());
                                setDragSelection(null);
                                setHoveredNodeId(null);
                                if (nextProjectionId === TASKS_GANTT_PROJECTION_ID) setViewMode('gantt');
                                else {
                                    setActiveProjectionId(nextProjectionId);
                                    setViewMode(tasksLayoutById(tasksProjectionLayout(sourceModel, nextProjectionId))?.id || 'graph');
                                }
                                pendingFitActionRef.current = 'mode';
                            },
                            style: {
                                width: '100%',
                                minWidth: 0,
                                border: '1px solid color-mix(in srgb, currentColor 16%, transparent)',
                                borderRadius: '8px',
                                padding: '6px 8px',
                                background: 'color-mix(in srgb, var(--vyasa-paper) 96%, transparent)',
                                color: 'inherit',
                            },
                        },
                            ...projectionOptions.map((projection) => React.createElement('option', { key: projection.id || '__default__', value: projection.id }, projection.label)),
                            React.createElement('option', { key: TASKS_ADD_VIEW_OPTION_ID, value: TASKS_ADD_VIEW_OPTION_ID }, '+ Add view...')
                        ),
                        activeProjectionOption && activeProjectionOption.id !== TASKS_GANTT_PROJECTION_ID
                            ? React.createElement('button', {
                                type: 'button',
                                title: sourceModel?.kg_context?.id
                                    ? 'Copy this view as an @views entry for this context'
                                    : 'Copy this view as a kg.schema @views entry',
                                onClick: async (event) => {
                                    const button = event.currentTarget;
                                    const ok = await copyTasksText(buildProjectionConfigText(activeProjectionOption));
                                    const prev = button.textContent;
                                    button.textContent = ok ? '✓' : '✕';
                                    window.setTimeout(() => { button.textContent = prev; }, 1200);
                                },
                                style: {
                                    border: '1px solid color-mix(in srgb, currentColor 16%, transparent)',
                                    borderRadius: '8px',
                                    padding: '6px 8px',
                                    background: 'color-mix(in srgb, var(--vyasa-paper) 96%, transparent)',
                                    color: 'inherit',
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                    lineHeight: 1,
                                },
                            }, '⧉')
                            : React.createElement('span', { style: { width: '30px', height: '1px' } })
                    ),
                    tasksCaptionElement(activeProjectionOption, {
                        padding: '9px 10px',
                        borderRadius: '8px',
                        border: '1px solid color-mix(in srgb, currentColor 10%, transparent)',
                        background: 'color-mix(in srgb, var(--vyasa-paper) 97%, transparent)',
                        fontSize: '11px',
                        lineHeight: 1.45,
                        opacity: 0.82,
                        boxSizing: 'border-box',
                    })
                ) : null,
                React.createElement('div', { style: { ...filterSectionStyle, marginBottom: '12px', paddingBottom: '10px', borderBottom: '1px solid color-mix(in srgb, currentColor 12%, transparent)' } },
                    React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' } },
                        React.createElement('span', { style: filterKeyStyle }, 'Group by'),
                        React.createElement('label', { className: 'vyasa-tasks-toggle-label', title: 'Enable custom grouping' },
                            React.createElement('input', {
                                type: 'checkbox',
                                className: 'vyasa-tasks-switch-input',
                                checked: groupByEnabled,
                                disabled: !customGroupingAvailable,
                                onChange: (event) => {
                                    setGroupByEnabled(event.target.checked);
                                    setViewMode('graph');
                                    pendingFitActionRef.current = 'mode';
                                },
                            }),
                            React.createElement('span', { className: 'vyasa-tasks-switch-track', 'aria-hidden': 'true' }),
                            React.createElement('span', { style: { fontWeight: 700, opacity: 0.76 } }, groupByEnabled ? 'On' : 'Off')
                        )
                    ),
                    React.createElement('div', { style: filterValueStackStyle },
                            groupByLevels.map((selectedKey, level) => {
                                const draggable = groupByControlsEnabled && Boolean(selectedKey);
                                const levelEnabled = Boolean(selectedKey) && !groupByDisabledSet.has(selectedKey);
                                return React.createElement('div', {
                                    key: `group-by-${level}`,
                                    onDragOver: (event) => {
                                        if (!draggable || !Array.from(event.dataTransfer.types || []).includes('text/x-vyasa-group-level')) return;
                                        event.preventDefault();
                                        event.dataTransfer.dropEffect = 'move';
                                    },
                                    onDrop: (event) => {
                                        const from = Number.parseInt(event.dataTransfer.getData('text/x-vyasa-group-level'), 10);
                                        if (Number.isInteger(from)) {
                                            event.preventDefault();
                                            reorderGroupByLevel(from, level);
                                        }
                                    },
                                    style: { display: 'flex', gap: '6px', alignItems: 'center' },
                                },
                                    React.createElement('span', {
                                        draggable,
                                        title: 'Drag to reorder',
                                        'aria-label': 'Drag to reorder group level',
                                        onDragStart: (event) => {
                                            if (!draggable) return;
                                            event.dataTransfer.setData('text/x-vyasa-group-level', String(level));
                                            event.dataTransfer.effectAllowed = 'move';
                                        },
                                        style: { flex: '0 0 auto', cursor: draggable ? 'grab' : 'default', opacity: draggable ? 0.7 : 0.25, fontWeight: 700, letterSpacing: '0.04em', userSelect: 'none' },
                                    }, '::'),
                                    React.createElement('input', {
                                        type: 'checkbox',
                                        checked: levelEnabled,
                                        disabled: !groupByControlsEnabled || !selectedKey,
                                        title: levelEnabled ? 'Disable this group level' : 'Enable this group level',
                                        'aria-label': `${levelEnabled ? 'Disable' : 'Enable'} group level ${level + 1}`,
                                        onChange: (event) => {
                                            const key = String(selectedKey || '').trim();
                                            if (!key) return;
                                            setGroupByDisabledKeys((current) => {
                                                const disabled = new Set(normalizeTasksGroupByDisabledKeys(current));
                                                if (event.target.checked) disabled.delete(key); else disabled.add(key);
                                                return Array.from(disabled);
                                            });
                                            setViewMode('graph');
                                            pendingFitActionRef.current = 'mode';
                                        },
                                        style: { flex: '0 0 auto', width: '14px', height: '14px', margin: 0 },
                                    }),
                                    React.createElement('select', {
                                        value: selectedKey,
                                        disabled: !groupByControlsEnabled,
                                        onChange: (event) => {
                                            const nextKey = event.target.value;
                                            const next = groupByHierarchy.slice();
                                            next[level] = nextKey;
                                            setGroupByHierarchy(next.slice(0, level + 1).filter(Boolean));
                                            setGroupByDisabledKeys((current) => normalizeTasksGroupByDisabledKeys(current).filter((key) => key !== selectedKey && key !== nextKey));
                                            setViewMode('graph');
                                            pendingFitActionRef.current = 'mode';
                                        },
                                        style: {
                                            flex: '1 1 auto',
                                            minWidth: 0,
                                            border: '1px solid color-mix(in srgb, currentColor 16%, transparent)',
                                            borderRadius: '8px',
                                            padding: '6px 8px',
                                            background: 'color-mix(in srgb, var(--vyasa-paper) 96%, transparent)',
                                            color: 'inherit',
                                        },
                                    },
                                        React.createElement('option', { value: '' }, level === 0 ? 'No custom grouping' : `Level ${level + 1}: none`),
                                        ...groupByOptions
                                            .filter((option) => option.key === displayedGroupByHierarchy[level] || !displayedGroupByHierarchy.includes(option.key))
                                            .map((option) => React.createElement('option', { key: option.key, value: option.key }, option.label))
                                    ),
                                    React.createElement('button', {
                                        type: 'button',
                                        className: 'vyasa-tasks-group-by-clear',
                                        title: 'Clear group level',
                                        'aria-label': `Clear group level ${level + 1}`,
                                        disabled: !groupByControlsEnabled || !selectedKey,
                                        onClick: () => {
                                            const next = groupByHierarchy.slice();
                                            next[level] = '';
                                            setGroupByHierarchy(next.slice(0, level + 1).filter(Boolean));
                                            setGroupByDisabledKeys((current) => normalizeTasksGroupByDisabledKeys(current).filter((key) => key !== selectedKey));
                                            setViewMode('graph');
                                            pendingFitActionRef.current = 'mode';
                                        },
                                    }, '×')
                                );
                            }),
                            viewMode === 'gantt'
                                ? React.createElement('div', { style: { fontSize: '11px', opacity: 0.7, lineHeight: 1.3 } }, 'Grouping is unavailable in Gantt.')
                                : null
                    )
                ),
                React.createElement('div', { style: { ...filterSectionStyle, marginBottom: '12px', paddingBottom: '10px', borderBottom: '1px solid color-mix(in srgb, currentColor 12%, transparent)' } },
                    React.createElement('span', { style: filterKeyStyle }, 'Notes'),
                    React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' } },
                            React.createElement('button', {
                                type: 'button',
                                title: 'Export notes',
                                'aria-label': 'Export notes',
                                onClick: handleExportNodeNotes,
                                style: { display: 'inline-flex', border: 'none', background: 'none', color: 'inherit', padding: '2px', cursor: 'pointer' },
                            }, React.createElement('span', { 'uk-icon': 'download', 'aria-hidden': 'true' })),
                            React.createElement('button', {
                                type: 'button',
                                title: 'Copy notes',
                                'aria-label': 'Copy notes',
                                onClick: handleCopyNodeNotes,
                                style: { display: 'inline-flex', border: 'none', background: 'none', color: 'inherit', padding: '2px', cursor: 'pointer' },
                            }, React.createElement('span', { 'uk-icon': 'copy', 'aria-hidden': 'true' })),
                            React.createElement('button', {
                                type: 'button',
                                title: 'Import notes',
                                'aria-label': 'Import notes',
                                onClick: handleImportNodeNotes,
                                style: { display: 'inline-flex', border: 'none', background: 'none', color: 'inherit', padding: '2px', cursor: 'pointer' },
                            }, React.createElement('span', { 'uk-icon': 'upload', 'aria-hidden': 'true' })),
                            allClearedNotes ? React.createElement('button', {
                                type: 'button',
                                onClick: handleUndoClearAllNotes,
                                style: { border: 'none', background: 'none', cursor: 'pointer', fontSize: '11px', color: 'var(--vyasa-primary)', fontWeight: 600, padding: '2px', lineHeight: 1 },
                            }, 'Undo') : null,
                            (Object.keys(nodeNotes).length || Object.keys(slideNotes).length) ? React.createElement('button', {
                                type: 'button',
                                title: 'Clear all notes',
                                'aria-label': 'Clear all notes',
                                onClick: handleClearAllNotes,
                                style: { display: 'inline-flex', border: 'none', background: 'none', color: 'inherit', padding: '2px', cursor: 'pointer', fontSize: '13px', opacity: 0.45, lineHeight: 1 },
                            }, '×') : null,
                            React.createElement('span', { style: { marginLeft: 'auto', opacity: 0.65, fontSize: '11px' } }, `${Object.keys(nodeNotes).length + Object.keys(slideNotes).length} saved`)
                    )
                ),
                React.createElement('div', { style: { ...filterSectionStyle, marginBottom: '12px', paddingBottom: '10px', borderBottom: '1px solid color-mix(in srgb, currentColor 12%, transparent)' } },
                    React.createElement('label', { className: 'vyasa-tasks-toggle-label', style: filterKeyStyle },
                        React.createElement('input', {
                            type: 'checkbox',
                            className: 'vyasa-tasks-switch-input',
                            checked: searchEnabled,
                            onChange: (event) => setSearchEnabled(event.target.checked),
                        }),
                        React.createElement('span', { className: 'vyasa-tasks-switch-track', 'aria-hidden': 'true' }),
                        React.createElement('span', { style: { fontWeight: 700, opacity: 0.76 } }, 'Search')
                    ),
                    React.createElement('div', { style: filterValueStackStyle },
                            React.createElement('div', { style: { position: 'relative' } },
                                React.createElement('input', {
                                    ref: searchInputRef,
                                    type: 'text',
                                    value: searchInputValue,
                                    disabled: !searchEnabled,
                                    placeholder: 'text or /regex/i',
                                    onChange: (e) => setSearchInputValue(e.target.value),
                                    style: {
                                        width: '100%',
                                        minWidth: 0,
                                        border: '1px solid color-mix(in srgb, currentColor 16%, transparent)',
                                        borderRadius: '8px',
                                        padding: '7px 28px 7px 9px',
                                        background: 'color-mix(in srgb, var(--vyasa-paper) 96%, transparent)',
                                        color: 'inherit',
                                        boxSizing: 'border-box',
                                    },
                                }),
                                searchInputValue
                                    ? React.createElement('button', {
                                        type: 'button',
                                        'aria-label': 'Clear search',
                                        onClick: () => {
                                            setSearchInputValue('');
                                            setSearchQuery('');
                                            if (searchInputRef.current) searchInputRef.current.focus();
                                        },
                                        style: {
                                            position: 'absolute',
                                            top: '50%',
                                            right: '8px',
                                            transform: 'translateY(-50%)',
                                            border: 'none',
                                            background: 'none',
                                            padding: 0,
                                            cursor: 'pointer',
                                            fontSize: '12px',
                                            lineHeight: 1,
                                            color: 'inherit',
                                            opacity: 0.55,
                                        },
                                    }, '×')
                                    : null
                            ),
                            !searchEnabled
                                ? React.createElement('div', { style: { fontSize: '11px', opacity: 0.7, lineHeight: 1.35 } }, 'Search disabled.')
                                : searchMatches.error
                                ? React.createElement('div', { style: { fontSize: '11px', color: '#fca5a5', lineHeight: 1.3 } }, `Regex error: ${searchMatches.error}`)
                                : React.createElement('div', { style: { fontSize: '11px', opacity: 0.72, lineHeight: 1.3 } }, searchMatches.active ? `${searchMatches.nodeIds.size} nodes matched` : 'Matches node id, label, text attrs, and matching edge text.')
                    )
                ),
                edgeTypeOptions.length ? React.createElement('div', {
                    style: { ...filterSectionStyle, marginBottom: '12px', paddingBottom: '10px', borderBottom: '1px solid color-mix(in srgb, currentColor 12%, transparent)' },
                },
                    React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' } },
                        React.createElement('label', { className: 'vyasa-tasks-toggle-label', style: filterKeyStyle },
                            React.createElement('input', {
                                type: 'checkbox',
                                className: 'vyasa-tasks-switch-input',
                                checked: edgeTypeFilterEnabled,
                                onChange: (event) => {
                                    setEdgeTypeFilterEnabled(event.target.checked);
                                    setEdgeTypeMenuOpen(false);
                                },
                            }),
                            React.createElement('span', { className: 'vyasa-tasks-switch-track', 'aria-hidden': 'true' }),
                            React.createElement('span', { style: { fontWeight: 700, opacity: 0.76 } }, 'Edge Types')
                        ),
                        !edgeTypeFilterEnabled && activeEdgeTypes.length
                            ? React.createElement('span', { style: { opacity: 0.58, fontSize: '11px' } }, `${activeEdgeTypes.length} saved`)
                            : null
                    ),
                    React.createElement('div', { style: { position: 'relative' } },
                        React.createElement('input', {
                            type: 'text',
                            value: edgeTypeQuery,
                            disabled: !edgeTypeFilterEnabled,
                            placeholder: 'Search edge types',
                            'aria-label': 'Search edge types',
                            'aria-expanded': edgeTypeFilterEnabled && edgeTypeMenuOpen,
                            'aria-controls': `${widgetId}-edge-type-options`,
                            onFocus: () => {
                                if (edgeTypeFilterEnabled) setEdgeTypeMenuOpen(true);
                            },
                            onBlur: () => window.setTimeout(() => setEdgeTypeMenuOpen(false), 120),
                            onChange: (event) => {
                                setEdgeTypeQuery(event.target.value);
                                setEdgeTypeMenuOpen(true);
                            },
                            style: {
                                width: '100%',
                                minWidth: 0,
                                border: '1px solid color-mix(in srgb, currentColor 16%, transparent)',
                                borderRadius: '8px',
                                padding: '7px 9px',
                                background: 'color-mix(in srgb, var(--vyasa-paper) 96%, transparent)',
                                color: 'inherit',
                                boxSizing: 'border-box',
                            },
                        }),
                        edgeTypeFilterEnabled && edgeTypeMenuOpen ? React.createElement('div', {
                            id: `${widgetId}-edge-type-options`,
                            role: 'listbox',
                            'aria-label': 'Available edge types',
                            onMouseDown: (event) => event.preventDefault(),
                            style: {
                                position: 'absolute',
                                zIndex: 3,
                                top: 'calc(100% + 4px)',
                                left: 0,
                                right: 0,
                                maxHeight: '180px',
                                overflowY: 'auto',
                                display: 'grid',
                                gap: '4px',
                                padding: '6px',
                                border: '1px solid color-mix(in srgb, currentColor 16%, transparent)',
                                borderRadius: '8px',
                                background: 'var(--vyasa-paper)',
                                boxShadow: '0 8px 24px color-mix(in srgb, black 18%, transparent)',
                            },
                        },
                            visibleEdgeTypeOptions.length
                                ? visibleEdgeTypeOptions.map((type) => {
                                    const edgeColor = edgeTypeColors[type] || 'currentColor';
                                    return React.createElement('label', {
                                        key: type,
                                        role: 'option',
                                        'aria-selected': activeEdgeTypes.includes(type),
                                        className: 'vyasa-tasks-query-value-option',
                                    },
                                        React.createElement('input', {
                                            type: 'checkbox',
                                            checked: activeEdgeTypes.includes(type),
                                            onChange: (event) => {
                                                const enabled = event.target.checked;
                                                setActiveEdgeTypes((current) => enabled
                                                    ? Array.from(new Set([...current, type]))
                                                    : current.filter((entry) => entry !== type));
                                                logTasksDebug('edgeTypeFilterChange', { widgetId, type, enabled });
                                            },
                                        }),
                                        React.createElement('span', {
                                            'aria-hidden': 'true',
                                            style: { width: '18px', height: '3px', flex: '0 0 18px', borderRadius: '999px', background: edgeColor },
                                        }),
                                        React.createElement('span', null, type)
                                    );
                                })
                                : React.createElement('div', { style: { padding: '5px 7px', fontSize: '11px', opacity: 0.68 } }, 'No matching edge types')
                        ) : null
                    ),
                    activeEdgeTypes.length ? React.createElement('div', {
                        style: { display: 'flex', flexWrap: 'wrap', gap: '6px' },
                    },
                        ...activeEdgeTypes.map((type) => React.createElement('button', {
                            key: type,
                            type: 'button',
                            title: `Remove ${type}`,
                            disabled: !edgeTypeFilterEnabled,
                            onClick: () => setActiveEdgeTypes((current) => current.filter((entry) => entry !== type)),
                            style: {
                                border: `1px solid ${edgeTypeColors[type] || 'currentColor'}`,
                                borderRadius: '999px',
                                padding: '3px 7px',
                                background: `color-mix(in srgb, ${edgeTypeColors[type] || 'currentColor'} 14%, transparent)`,
                                color: 'inherit',
                                cursor: edgeTypeFilterEnabled ? 'pointer' : 'default',
                                fontSize: '11px',
                                opacity: edgeTypeFilterEnabled ? 1 : 0.58,
                            },
                        }, `${type} ×`))
                    ) : React.createElement('div', { style: { fontSize: '11px', opacity: 0.7 } }, 'Select one or more; matches any selected type.'),
                ) : null,
                ...colorLevelSlots.map((colorBy, index) => renderColorLevel(colorBy, index)),
                renderIconFilters(),
                React.createElement('div', { style: { marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' } },
                    React.createElement('label', { className: 'vyasa-tasks-toggle-label', title: 'Show hover highlight on dimmed (inactive) nodes too' },
                        React.createElement('input', {
                            type: 'checkbox',
                            className: 'vyasa-tasks-switch-input',
                            checked: hoverInactiveNodes,
                            onChange: (event) => setHoverInactiveNodes(event.target.checked),
                        }),
                        React.createElement('span', { className: 'vyasa-tasks-switch-track', 'aria-hidden': 'true' }),
                        React.createElement('span', { style: { fontWeight: 700, opacity: 0.76 } }, 'Hover inactive nodes')
                    )
                ),
                React.createElement('div', { style: { marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', fontSize: '12px' } },
                    React.createElement('label', { className: 'vyasa-tasks-toggle-label' },
                        React.createElement('input', {
                            type: 'checkbox',
                            className: 'vyasa-tasks-switch-input',
                            checked: queryBuilderEnabled,
                            onChange: (event) => setQueryBuilderEnabled(event.target.checked),
                        }),
                        React.createElement('span', { className: 'vyasa-tasks-switch-track', 'aria-hidden': 'true' }),
                        React.createElement('span', { style: { fontWeight: 700, opacity: 0.76 } }, 'Query builder')
                    ),
                    !queryBuilderEnabled && tasksFilterQueryHasRules(activeFilters)
                        ? React.createElement('span', { style: { opacity: 0.58 } }, `${tasksCountFilterRules(activeFilters)} saved`)
                        : null
                ),
                React.createElement('div', { style: { marginTop: '4px' } },
                    queryBuilderFields.length
                        ? !queryBuilderEnabled
                            ? React.createElement('div', { style: { fontSize: '11px', opacity: 0.7, lineHeight: 1.35 } }, 'Query builder disabled.')
                            : QueryBuilder
                            ? React.createElement(QueryBuilder, {
                            query: normalizeTasksFilterQuery(activeFilters),
                            fields: queryBuilderFields,
                            operators: queryBuilderOperators,
                            onQueryChange: (query) => {
                                const normalized = normalizeTasksFilterQuery(query);
                                logTasksDebug('queryBuilderChange', { widgetId, rules: tasksCountFilterRules(normalized), query: normalized });
                                setActiveFilters(normalized);
                            },
                            showNotToggle: true,
                            showCloneButtons: false,
                            showMuteButtons: true,
                            showCombinatorsBetweenRules: true,
                            resetOnFieldChange: true,
                            resetOnOperatorChange: true,
                            listsAsArrays: true,
                            controlElements: { valueEditor: QueryValueEditor, muteRuleAction: QueryMuteToggle, muteGroupAction: null },
                            controlClassnames: { queryBuilder: 'vyasa-tasks-query-builder' },
                        })
                            : React.createElement('div', { style: { fontSize: '11px', opacity: 0.7, lineHeight: 1.35 } }, 'Loading advanced filters...')
                        : React.createElement('div', { style: { fontSize: '11px', opacity: 0.7, lineHeight: 1.35 } }, 'No filterable fields in this graph.')
                ),
                React.createElement('div', { style: { ...filterSectionStyle, marginTop: '12px', paddingTop: '10px', borderTop: '1px solid color-mix(in srgb, currentColor 12%, transparent)' } },
                    React.createElement('span', { style: filterKeyStyle }, 'Intensity'),
                    React.createElement('label', { style: { display: 'grid', gap: '6px', minWidth: 0, fontSize: '12px' } },
                        React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' } },
                            React.createElement('span', { style: { opacity: 0.82 } }, 'Edge Intensity'),
                            React.createElement('span', { style: { opacity: 0.8, minWidth: '3.5em', textAlign: 'right' } }, tasksEdgeOpacityLabel(edgeOpacity))
                        ),
                        React.createElement('input', {
                            type: 'range',
                            min: TASKS_EDGE_OPACITY_MIN,
                            max: TASKS_EDGE_OPACITY_MAX,
                            step: 'any',
                            value: edgeOpacity,
                            onChange: (e) => setEdgeOpacity(clampTasksEdgeOpacity(e.target.value)),
                            style: { width: '100%', minWidth: 0, margin: 0 },
                        })
                    ),
                    React.createElement('label', { style: { display: 'grid', gap: '6px', minWidth: 0, fontSize: '12px' } },
                        React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' } },
                            React.createElement('span', { style: { opacity: 0.82 } }, 'Null Intensity'),
                            React.createElement('span', { style: { opacity: 0.8, minWidth: '3.5em', textAlign: 'right' } }, tasksOpacityPctLabel(projectionUnspecifiedContentOpacity))
                        ),
                        React.createElement('input', {
                            type: 'range',
                            min: 0.02,
                            max: 1,
                            step: 0.01,
                            value: projectionUnspecifiedContentOpacity,
                            onChange: (e) => setProjectionUnspecifiedContentOpacity(clampTasksProjectionDisplayOpacity(e.target.value)),
                            style: { width: '100%', minWidth: 0, margin: 0 },
                        })
                    )
                )
            )
        )
        );
    };

    return { SelectedNodePanel, SelectedEdgePanel, FilterPanel };
}
