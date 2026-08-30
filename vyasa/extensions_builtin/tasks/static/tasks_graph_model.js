const TASKS_HAS_NOTE_ATTR = 'has_note';
const TASKS_SPECIAL_NODE_ATTRS = new Set([
    TASKS_HAS_NOTE_ATTR,
    '__checked__',
    '__card_state__',
    '__card_state_color__',
    '__has_note__',
    '__node_image__',
    '__color_levels__',
]);
const TASKS_INTERNAL_NODE_META_KEYS = new Set([
    'id', 'label', 'kind', '__kind__', 'group_id', 'parent_group_id',
    'handlelayout', 'highlightmode', 'sourcegroupid', 'source_group_id',
    '__rendered_attrs__', 'width', 'height', 'position', 'parentid',
    'parent_id', 'color', 'href', 'image', 'image_by', 'collapsed', 'child_group_ids',
    'child_task_ids', '__projection_group__', 'projection', '__kg_sources',
    '__source_node_id', '__source_edge_id',
    'active_projection', 'graph_x', 'graph_y', '__gantt', '__projection_branch_opacity__',
]);
const TASKS_DERIVED_METRIC_KEYS = new Set(['rank', 'connectivity']);
const TASKS_INTERNAL_EDGE_META_KEYS = new Set([
    'id', 'source', 'target', 'relation', 'label', 'type', 'kind', 'animated',
    'markerend', 'labelstyle', 'labelbgstyle', 'style', 'data', 'zindex',
    'labelbgpadding', 'labelbgborderradius', 'labelzindex', 'labelmaxwidth',
    'sourcehandle', 'targethandle', '__kg_sources', '__rendered_attrs__', '__edge_types__', '__reference__',
]);

export function normalizeTasksAttrText(value) {
    if (Array.isArray(value)) return value.map(normalizeTasksAttrText).filter(Boolean).join(', ');
    const text = String(value ?? '').trim();
    if (!text) return '';
    if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
        return text.slice(1, -1);
    }
    return text;
}

export function tasksAttrValues(value) {
    const values = Array.isArray(value) ? value : [value];
    return Array.from(new Set(values
        .filter((entry) => typeof entry === 'string' || typeof entry === 'number' || typeof entry === 'boolean')
        .map((entry) => normalizeTasksAttrText(entry))
        .filter(Boolean)));
}

export function tasksLogicalNodeId(node, fallback = '') {
    return String(node?.__source_node_id || fallback || node?.id || '').trim();
}

export function tasksNodeReferences(value) {
    const values = Array.isArray(value) ? value : [value];
    const references = [];
    const pattern = /\[\[([^\]|\n]+)(?:\|([^\]\n]+))?\]\]/g;
    for (const entry of values) {
        let match;
        while ((match = pattern.exec(String(entry ?? ''))) !== null) {
            references.push({ target: match[1].trim(), display: String(match[2] || '').trim() });
        }
    }
    return references.filter((reference) => reference.target);
}

export function tasksReferenceEdges(model, authoredEdges = model?.dependency_edges || []) {
    const nodes = [...(model?.groups || []), ...(model?.tasks || [])];
    const nodesByLogicalId = new Map();
    for (const node of nodes) {
        const logicalId = tasksLogicalNodeId(node);
        nodesByLogicalId.set(logicalId, [...(nodesByLogicalId.get(logicalId) || []), node]);
    }
    const nodeIds = new Set([
        ...nodesByLogicalId.keys(),
        ...Object.keys(model?.node_reference_labels || {}),
    ]);
    const authored = new Set((authoredEdges || []).map((edge) => `${edge.source}\0${edge.target}`));
    const seen = new Set();
    return nodes.flatMap((node) => {
        const source = String(node.id || '');
        const logicalSource = tasksLogicalNodeId(node);
        const values = [node.label, ...Object.entries(node).filter(([key]) => !tasksIsHiddenNodeMetaKey(key)).map(([, value]) => value)];
        return values.flatMap(tasksNodeReferences).flatMap(({ target }) => {
            if (!source || logicalSource === target || !nodeIds.has(target) || authored.has(`${target}\0${logicalSource}`)) return [];
            const targets = nodesByLogicalId.get(target)?.map((targetNode) => String(targetNode.id || '')) || [target];
            return targets.flatMap((targetId) => {
                const key = `${source}\0${targetId}`;
                if (!targetId || seen.has(key)) return [];
                seen.add(key);
                return [{
                    id: `is-referred-by:${targetId}:${source}`,
                    source: targetId,
                    target: source,
                    relation: 'is referred by',
                    label: 'is referred by',
                    __reference__: true,
                }];
            });
        });
    });
}

export function tasksVisibleReferenceEdges(referenceEdges, graphNodes, model) {
    const visible = new Set((graphNodes || []).map((node) => String(node.id || '')));
    const byId = new Map([...(model?.groups || []), ...(model?.tasks || [])].map((node) => [String(node.id || ''), node]));
    const resolve = (nodeId) => {
        let current = String(nodeId || '');
        const seen = new Set();
        while (current && !seen.has(current)) {
            if (visible.has(current)) return current;
            seen.add(current);
            const node = byId.get(current);
            current = String(node?.group_id || node?.parent_group_id || '');
        }
        return '';
    };
    const seen = new Set();
    return (referenceEdges || []).flatMap((edge) => {
        const source = resolve(edge.source);
        const target = resolve(edge.target);
        const key = `${source}\0${target}`;
        if (!source || !target || source === target || seen.has(key)) return [];
        seen.add(key);
        return [{ ...edge, id: `is-referred-by:${source}:${target}`, source, target }];
    });
}

// The whole graph is already in memory, so one hop is one pass over the edge list.
// An adjacency index would only pay off past tens of thousands of edges, and the
// graphs here are in the hundreds, so the scan stays and the code stays simple.
export function tasksNeighborHopIds(edges, seedIds, isNodeSelectable) {
    const seeds = seedIds instanceof Set ? seedIds : new Set(seedIds || []);
    const grown = new Set(seeds);
    if (!seeds.size) return grown;
    const allowed = typeof isNodeSelectable === 'function' ? isNodeSelectable : () => true;
    for (const edge of edges || []) {
        const source = String(edge?.source || '');
        const target = String(edge?.target || '');
        if (!source || !target) continue;
        if (seeds.has(source) && !grown.has(target) && allowed(target)) grown.add(target);
        if (seeds.has(target) && !grown.has(source) && allowed(source)) grown.add(source);
    }
    return grown;
}

// Hover picks the chain the way G picks its EG target, but only while no chain is
// running. Every hop refits the view, which slides a different node under a still
// mouse, so a running chain that listened to the pointer would restart itself on the
// next press. Escape or a click ends the chain and hands the pointer back.
export function tasksHopSeedIds(selectionIds, hoveredNodeId, isNodeSelectable, chainActive = false) {
    const selection = selectionIds instanceof Set ? selectionIds : new Set(selectionIds || []);
    const hovered = String(hoveredNodeId || '');
    const allowed = typeof isNodeSelectable === 'function' ? isNodeSelectable : () => true;
    if (!chainActive && hovered && !selection.has(hovered) && allowed(hovered)) {
        return { seeds: new Set([hovered]), fromHover: true };
    }
    return { seeds: selection, fromHover: false };
}

export function tasksSameIdSet(left, right) {
    if (!(left instanceof Set) || !(right instanceof Set)) return false;
    if (left.size !== right.size) return false;
    for (const id of left) {
        if (!right.has(id)) return false;
    }
    return true;
}

export function tasksContextDiffSelectionIds(model, graphNodes, diffNodeIds) {
    const changed = diffNodeIds instanceof Set ? diffNodeIds : new Set(diffNodeIds || []);
    const modelNodes = [...(model?.groups || []), ...(model?.tasks || [])];
    const modelById = Object.fromEntries(modelNodes.map((node) => [String(node.id || ''), node]));
    const visibleIds = new Set((graphNodes || []).map((node) => String(
        node?.data?.__kind__ === 'groupTitle' ? node.data.sourceGroupId : node?.id
    )).filter(Boolean));
    const selected = new Set();
    for (const node of modelNodes) {
        if (!changed.has(tasksLogicalNodeId(node, node.id))) continue;
        let current = node;
        while (current) {
            const currentId = String(current.id || '');
            if (visibleIds.has(currentId)) {
                selected.add(currentId);
                break;
            }
            const parentId = String(current.group_id || current.parent_group_id || '');
            current = parentId ? modelById[parentId] : null;
        }
    }
    return selected;
}

export function tasksSelectionClickKey(node) {
    if (!node) return '';
    return String(node?.data?.__kind__ === 'groupTitle'
        ? (node.data?.sourceGroupId || node.id || '')
        : (node.id || '')).trim();
}

export function tasksIsHiddenNodeMetaKey(key) {
    const normalized = String(key || '').trim().toLowerCase();
    return TASKS_INTERNAL_NODE_META_KEYS.has(normalized)
        || TASKS_SPECIAL_NODE_ATTRS.has(String(key))
        || TASKS_DERIVED_METRIC_KEYS.has(normalized);
}

function tasksOrderMetaEntries(entries, attrOrder) {
    const preferred = new Map();
    for (const key of (attrOrder || [])) {
        const normalized = String(key || '').trim();
        if (normalized && !preferred.has(normalized)) preferred.set(normalized, preferred.size);
    }
    if (!preferred.size) return entries;
    return entries.map((entry, index) => ({ entry, index }))
        .sort((a, b) => (preferred.get(a.entry.key) ?? preferred.size + a.index)
            - (preferred.get(b.entry.key) ?? preferred.size + b.index))
        .map(({ entry }) => entry);
}

export function tasksNodeMetaEntries(node, attrOrder = [], hiddenAttrs = []) {
    if (!node) return [];
    const hidden = new Set(hiddenAttrs || []);
    return tasksOrderMetaEntries(Object.entries(node)
        .filter(([key, value]) => !hidden.has(key) && !tasksIsHiddenNodeMetaKey(key) && tasksAttrValues(value).length)
        .map(([key, value]) => ({
            key,
            label: key.replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase()),
            value: normalizeTasksAttrText(value),
            renderedValue: typeof node?.__rendered_attrs__?.[key] === 'string' ? node.__rendered_attrs__[key] : '',
        })), attrOrder);
}

export function tasksEdgeMetaEntries(edge, attrOrder = [], hiddenAttrs = []) {
    if (!edge) return [];
    const hidden = new Set(hiddenAttrs || []);
    const tailOrder = new Map([
        ['evidence', 100], ['introduced_context', 101], ['introduced_stage', 102], ['definition', 103],
    ]);
    const entries = Object.entries(edge)
        .filter(([key, value]) => !hidden.has(key) && !TASKS_INTERNAL_EDGE_META_KEYS.has(String(key).toLowerCase()) && tasksAttrValues(value).length)
        .map(([key, value], index) => ({
            key,
            label: key.replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase()),
            value: normalizeTasksAttrText(value),
            renderedValue: edge?.__rendered_attrs__?.[key] || '',
            order: key === 'summary' ? -1 : (tailOrder.get(key) ?? index),
        }))
        .sort((a, b) => a.order - b.order)
        .map(({ order: _order, ...entry }) => entry);
    return tasksOrderMetaEntries(entries, attrOrder);
}

export function tasksOrderedEdges(edges, incidentNodeId = '') {
    const nodeId = String(incidentNodeId || '').trim();
    return (edges || [])
        .filter((edge) => !nodeId || edge?.source === nodeId || edge?.target === nodeId)
        .slice()
        .sort((a, b) => [a?.source, a?.relation || a?.label, a?.target, a?.id]
            .map((value) => String(value || ''))
            .join('\u0000')
            .localeCompare([b?.source, b?.relation || b?.label, b?.target, b?.id]
                .map((value) => String(value || ''))
                .join('\u0000')));
}

export function tasksGroupHoverAttrRows(directRows, detailEntries, hoverAttrs) {
    const directByAttr = new Map((directRows || []).map((row) => [String(row?.attr || ''), row]));
    const statsByAttr = new Map((detailEntries || [])
        .filter((entry) => String(entry?.key || '').startsWith('range:'))
        .map((entry) => [String(entry.key).slice('range:'.length), entry]));
    return (hoverAttrs || []).map((attr) => {
        const key = String(attr || '').trim();
        const stat = statsByAttr.get(key);
        if (stat) return { attr: key, label: stat.label, value: stat.value, renderedValue: stat.renderedValue || '' };
        return directByAttr.get(key);
    }).filter(Boolean);
}

export function tasksEmptyFilterQuery() {
    return { combinator: 'and', rules: [] };
}

export function tasksFilterQueryFromLegacy(filters) {
    const rules = Object.entries(filters || {})
        .filter(([, value]) => Array.isArray(value) ? value.length > 0 : Boolean(value))
        .map(([field, value]) => ({
            field,
            operator: Array.isArray(value) ? 'in' : '=',
            value,
        }));
    return { combinator: 'and', rules };
}

export function normalizeTasksFilterQuery(filters) {
    if (!filters || typeof filters !== 'object') return tasksEmptyFilterQuery();
    if (Array.isArray(filters.rules)) {
        const normalized = {
            combinator: filters.combinator === 'or' ? 'or' : 'and',
            not: Boolean(filters.not),
            rules: filters.rules,
        };
        return normalized;
    }
    return tasksFilterQueryFromLegacy(filters);
}

export function tasksFilterRuleIsActive(rule) {
    if (!rule?.field || !rule?.operator) return false;
    if (rule.operator === 'notnull' || rule.operator === 'null') return true;
    if (rule.operator === 'in' || rule.operator === 'notIn') return tasksFilterValueList(rule.value).length > 0;
    return String(rule.value ?? '').trim() !== '';
}

export function tasksFilterQueryHasRules(query) {
    const normalized = normalizeTasksFilterQuery(query);
    return normalized.rules.some((rule) => {
        if (rule?.muted) return false;
        if (rule && Array.isArray(rule.rules)) return tasksFilterQueryHasRules(rule);
        return tasksFilterRuleIsActive(rule);
    });
}

export function tasksFilterQueryHasAnyRules(query) {
    const normalized = normalizeTasksFilterQuery(query);
    return normalized.rules.some((rule) => {
        if (rule && Array.isArray(rule.rules)) return true;
        return Boolean(rule && typeof rule === 'object');
    });
}

export function tasksCountFilterRules(query) {
    const normalized = normalizeTasksFilterQuery(query);
    return normalized.rules.reduce((count, rule) => {
        if (rule?.muted) return count;
        if (rule && Array.isArray(rule.rules)) return count + tasksCountFilterRules(rule);
        return count + (tasksFilterRuleIsActive(rule) ? 1 : 0);
    }, 0);
}

export function tasksPruneFilterQueryFields(query, validKeys) {
    const normalized = normalizeTasksFilterQuery(query);
    return {
        ...normalized,
        rules: normalized.rules.flatMap((rule) => {
            if (rule && Array.isArray(rule.rules)) {
                const pruned = tasksPruneFilterQueryFields(rule, validKeys);
                return pruned.rules.length ? [pruned] : [];
            }
            return rule?.field && validKeys.has(rule.field) ? [rule] : [];
        }),
    };
}

export function toggleTasksFilterQueryValue(query, field, value, enabled) {
    const normalized = normalizeTasksFilterQuery(query);
    const root = normalized.combinator === 'and' || !tasksFilterQueryHasRules(normalized)
        ? normalized
        : { combinator: 'and', rules: [normalized] };
    const rules = root.rules.slice();
    const index = rules.findIndex((rule) => rule && !Array.isArray(rule.rules) && rule.field === field && rule.operator === 'in');
    const currentValues = index >= 0 ? tasksFilterValueList(rules[index].value) : [];
    const nextValues = enabled
        ? Array.from(new Set([...currentValues, String(value)]))
        : currentValues.filter((entry) => entry !== String(value));
    if (!nextValues.length) {
        if (index >= 0) rules.splice(index, 1);
    } else if (index >= 0) {
        rules[index] = { ...rules[index], value: nextValues };
    } else {
        rules.push({ field, operator: 'in', value: nextValues });
    }
    return { ...root, rules };
}

export function tasksFilterQuerySelectedValues(query, field) {
    const normalized = normalizeTasksFilterQuery(query);
    const rule = normalized.rules.find((entry) => (
        entry && !Array.isArray(entry.rules) && entry.field === field && entry.operator === 'in'
    ));
    return rule ? tasksFilterValueList(rule.value) : [];
}

export function tasksFilterValueEditorType(operator) {
    if (operator === 'notnull' || operator === 'null') return 'none';
    if (operator === 'contains' || operator === 'doesNotContain' || operator === 'matchesRegex') return 'text';
    if (operator === 'in' || operator === 'notIn') return 'multiselect';
    return 'select';
}

export function tasksFilterValueList(value) {
    if (Array.isArray(value)) return value.map((entry) => String(entry ?? '')).filter(Boolean);
    return String(value ?? '').split(',').map((entry) => entry.trim()).filter(Boolean);
}

function tasksNodeFilterValue(node, key) {
    if (key === TASKS_HAS_NOTE_ATTR) return [node?.__has_note__ ? 'yes' : 'no'];
    return tasksAttrValues(node?.[key]);
}

function tasksNodeFilterAttributeExists(node, key) {
    if (!node || !key || !(key in node)) return false;
    return tasksAttrValues(node[key]).length > 0;
}

function tasksNodeMatchesFilterRule(node, rule) {
    if (!rule?.field || !rule?.operator) return true;
    const nodeValues = tasksNodeFilterValue(node, rule.field);
    const values = tasksFilterValueList(rule.value);
    if (rule.operator === 'notnull') return tasksNodeFilterAttributeExists(node, rule.field);
    if (rule.operator === 'null') return !tasksNodeFilterAttributeExists(node, rule.field);
    if (rule.operator === 'in') return values.length ? values.some((value) => nodeValues.includes(value)) : true;
    if (rule.operator === 'notIn') return values.length ? values.every((value) => !nodeValues.includes(value)) : true;
    const target = String(rule.value ?? '');
    if (rule.operator === '!=') return !nodeValues.includes(target);
    if (rule.operator === 'contains') return nodeValues.some((value) => value.toLowerCase().includes(target.toLowerCase()));
    if (rule.operator === 'doesNotContain') return nodeValues.every((value) => !value.toLowerCase().includes(target.toLowerCase()));
    if (rule.operator === 'matchesRegex') {
        try {
            const regex = new RegExp(target);
            return nodeValues.some((value) => regex.test(value));
        } catch {
            return false;
        }
    }
    return nodeValues.includes(target);
}

export function tasksNodeMatchesFilters(node, filters) {
    const query = normalizeTasksFilterQuery(filters);
    if (!tasksFilterQueryHasRules(query)) return true;
    const activeRules = query.rules.filter((rule) => (
        !rule?.muted && (rule && Array.isArray(rule.rules) ? tasksFilterQueryHasRules(rule) : tasksFilterRuleIsActive(rule))
    ));
    if (!activeRules.length) return true;
    const results = activeRules.map((rule) => (
        Array.isArray(rule.rules) ? tasksNodeMatchesFilters(node, rule) : tasksNodeMatchesFilterRule(node, rule)
    ));
    const matched = query.combinator === 'or' ? results.some(Boolean) : results.every(Boolean);
    return query.not ? !matched : matched;
}

export function tasksNodeMatchesAllFilters(node, queryFilters, swatchFilters) {
    return tasksNodeMatchesFilters(node, queryFilters) && tasksNodeMatchesFilters(node, swatchFilters);
}

export function tasksEdgeTypeValues(edge) {
    const explicit = Array.isArray(edge?.__edge_types__) ? edge.__edge_types__ : [];
    return Array.from(new Set([
        ...explicit,
        edge?.relation,
        edge?.label,
    ].map((value) => String(value || '').trim()).filter(Boolean)));
}

export function tasksEdgesMatchingTypes(edges, edgeTypes) {
    const selected = new Set((edgeTypes || []).map(String).filter(Boolean));
    if (!selected.size) return edges || [];
    return (edges || []).filter((edge) => tasksEdgeTypeValues(edge).some((type) => selected.has(type)));
}

export function tasksEdgeFilterNodeIds(edges, edgeTypes) {
    const selected = new Set((edgeTypes || []).map(String).filter(Boolean));
    const nodeIds = new Set();
    if (!selected.size) return nodeIds;
    for (const edge of tasksEdgesMatchingTypes(edges, edgeTypes)) {
        nodeIds.add(edge.source);
        nodeIds.add(edge.target);
    }
    return nodeIds;
}

export function tasksFilterHoverFocus(matchingNodeIds, edges, hoveredNodeId) {
    const matching = matchingNodeIds instanceof Set ? matchingNodeIds : new Set(matchingNodeIds || []);
    const nodeIds = new Set();
    const edgeIds = new Set();
    if (!hoveredNodeId || !matching.has(hoveredNodeId)) return { nodeIds, edgeIds };
    nodeIds.add(hoveredNodeId);
    for (const edge of edges || []) {
        if (!matching.has(edge.source) || !matching.has(edge.target)) continue;
        if (edge.source !== hoveredNodeId && edge.target !== hoveredNodeId) continue;
        nodeIds.add(edge.source);
        nodeIds.add(edge.target);
        if (edge.id) edgeIds.add(edge.id);
    }
    return { nodeIds, edgeIds };
}

function tasksSearchNormalizeText(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function tasksSearchSpec(query) {
    const raw = tasksSearchNormalizeText(query);
    if (!raw) return { active: false, raw: '', error: '', matcher: null };
    if (raw.startsWith('/') && raw.lastIndexOf('/') > 0) {
        const end = raw.lastIndexOf('/');
        try {
            return { active: true, raw, error: '', matcher: new RegExp(raw.slice(1, end), raw.slice(end + 1).replace(/g/g, '')) };
        } catch (error) {
            return { active: true, raw, error: error instanceof Error ? error.message : 'Invalid regex', matcher: null };
        }
    }
    const normalized = ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'")))
        ? raw.slice(1, -1).trim()
        : raw;
    return { active: true, raw, error: '', matcher: normalized.toLowerCase() };
}

function tasksSearchMatchesText(value, spec) {
    if (!spec?.active || !spec.matcher) return false;
    const text = tasksSearchNormalizeText(value);
    if (!text) return false;
    return spec.matcher instanceof RegExp ? spec.matcher.test(text) : text.toLowerCase().includes(spec.matcher);
}

export function tasksCollectSearchMatches(nodes, edges, query, nodeNotes = {}) {
    const spec = tasksSearchSpec(query);
    const nodeIds = new Set();
    const edgeIds = new Set();
    if (!spec.active || spec.error || !spec.matcher) return { ...spec, nodeIds, edgeIds };
    const hiddenEdgeKeys = new Set(['id', 'source', 'target', 'type', 'animated', 'markerend', 'labelstyle', 'labelbgstyle', 'style', 'data', 'zindex', 'sourcehandle', 'targethandle']);
    for (const node of (nodes || [])) {
        const data = node?.data || {};
        if (data.__kind__ === 'groupTitle') continue;
        const logicalNodeId = tasksLogicalNodeId(data, node?.id);
        const values = [node?.id, data.id, data.label, nodeNotes[logicalNodeId]];
        for (const [key, value] of Object.entries(data)) {
            if (tasksIsHiddenNodeMetaKey(key)) continue;
            if (value === null || value === undefined || typeof value === 'function') continue;
            values.push(...tasksAttrValues(value));
        }
        if (values.some((value) => tasksSearchMatchesText(value, spec))) nodeIds.add(node.id);
    }
    for (const edge of (edges || [])) {
        const values = [];
        for (const [key, value] of Object.entries(edge || {})) {
            if (hiddenEdgeKeys.has(String(key).toLowerCase())) continue;
            if (value === null || value === undefined || typeof value === 'function') continue;
            values.push(...tasksAttrValues(value));
        }
        if (!values.some((value) => tasksSearchMatchesText(value, spec))) continue;
        edgeIds.add(edge.id);
        if (edge.source) nodeIds.add(edge.source);
        if (edge.target) nodeIds.add(edge.target);
    }
    return { ...spec, nodeIds, edgeIds };
}

const TASKS_EDGE_OPACITY_MIN = 0.05;
const TASKS_EDGE_OPACITY_MAX = 1;
const TASKS_PROJECTION_UNSPECIFIED_CONTENT_OPACITY_DEFAULT = 0.82;

function clampTasksEdgeOpacity(value) {
    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed)) return 1;
    return Math.max(TASKS_EDGE_OPACITY_MIN, Math.min(TASKS_EDGE_OPACITY_MAX, parsed));
}

function clampTasksProjectionContentOpacity(value) {
    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed)) return TASKS_PROJECTION_UNSPECIFIED_CONTENT_OPACITY_DEFAULT;
    return Math.max(0, Math.min(1, parsed));
}

function tasksConfigListValue(values) {
    return (values || []).map((value) => String(value ?? '').trim()).filter(Boolean).join(',');
}

function tasksQuoteSchemaValue(value) {
    const text = String(value ?? '');
    return /[\s"=]/.test(text) ? `"${text.replace(/"/g, '\\"')}"` : text;
}

export function buildTasksProjectionConfigText(config, contextId = '') {
    const cfg = config || {};
    const lines = [];
    const notes = [];
    const id = String(cfg.id || '').trim() || 'new-view';
    lines.push(`${id}:`);
    const add = (key, value) => {
        const text = String(value ?? '').trim();
        if (text) lines.push(`\t${key}=${tasksQuoteSchemaValue(text)}`);
    };
    if (cfg.source && cfg.source !== 'base') add('source', cfg.source);
    const groupBy = tasksConfigListValue(cfg.groupBy);
    if (groupBy) lines.push(`\tgroup_by=${groupBy}`);
    add('color_by', cfg.colorBy);
    add('secondary_color_by', cfg.secondaryColorBy);
    add('edge_color_by', cfg.edgeColorBy);
    add('edge_label_from', cfg.edgeLabelFrom);
    const hover = tasksConfigListValue(cfg.hoverAttrs);
    if (hover) lines.push(`\thover_attrs=${hover}`);
    if (cfg.aggregateEdges && typeof cfg.aggregateEdges === 'object') {
        const parts = [];
        if (cfg.aggregateEdges.when_collapsed) parts.push('when_collapsed=true');
        if (cfg.aggregateEdges.by) parts.push(`by=${cfg.aggregateEdges.by}`);
        if (parts.length) lines.push(`\taggregate_edges="${parts.join(' ')}"`);
    }
    const filterQuery = normalizeTasksFilterQuery(cfg.filterQuery);
    if (tasksFilterQueryHasAnyRules(filterQuery)) {
        lines.push(`\tfilter_query=${tasksQuoteSchemaValue(JSON.stringify(filterQuery))}`);
    }
    if (typeof cfg.queryBuilderEnabled === 'boolean') {
        lines.push(`\tquery_builder_enabled=${cfg.queryBuilderEnabled ? 'true' : 'false'}`);
    }
    if (typeof cfg.searchEnabled === 'boolean') {
        lines.push(`\tsearch_enabled=${cfg.searchEnabled ? 'true' : 'false'}`);
    }
    add('search', cfg.searchQuery);
    if (typeof cfg.filtersCollapsed === 'boolean') lines.push(`\tfilters_collapsed=${cfg.filtersCollapsed ? 'true' : 'false'}`);
    if (typeof cfg.edgesVisible === 'boolean') lines.push(`\tedges_visible=${cfg.edgesVisible ? 'true' : 'false'}`);
    if (cfg.edgeOpacity !== undefined && cfg.edgeOpacity !== null && cfg.edgeOpacity !== '' && !Number.isNaN(Number(cfg.edgeOpacity))) {
        lines.push(`\tedge_opacity=${clampTasksEdgeOpacity(cfg.edgeOpacity)}`);
    }
    if (cfg.projectionUnspecifiedContentOpacity !== undefined && cfg.projectionUnspecifiedContentOpacity !== null && cfg.projectionUnspecifiedContentOpacity !== '' && !Number.isNaN(Number(cfg.projectionUnspecifiedContentOpacity))) {
        lines.push(`\tprojection_unspecified_content_opacity=${clampTasksProjectionContentOpacity(cfg.projectionUnspecifiedContentOpacity)}`);
    }
    const filterEntries = Object.entries(cfg.where || {})
        .map(([attr, value]) => {
            if (value === 'true') return [attr, ['true']];
            if (Array.isArray(value)) return [attr, value.map((entry) => String(entry).trim()).filter(Boolean)];
            return [attr, value ? [String(value).trim()] : []];
        })
        .filter(([, values]) => values.length);
    if (filterEntries.length === 1 && filterEntries[0][1].length === 1) {
        lines.push(`\twhere=${filterEntries[0][0]}=${tasksQuoteSchemaValue(filterEntries[0][1][0])}`);
    } else if (filterEntries.length) {
        notes.push("active filters (kg.schema 'where' takes one attr=value — split into separate views, or use markdown frontmatter 'where:' for multiple):");
        filterEntries.forEach(([attr, values]) => notes.push(`  ${attr} = ${values.join(' | ')}`));
    }
    add('caption', cfg.caption);
    if (cfg.defaultOpenDepth !== undefined && cfg.defaultOpenDepth !== null && cfg.defaultOpenDepth !== '' && !Number.isNaN(Number(cfg.defaultOpenDepth))) {
        lines.push(`\tdefault_open_depth=${cfg.defaultOpenDepth}`);
    }
    const target = String(contextId || '').trim()
        ? 'the active .context file'
        : 'kg.schema';
    let out = `# Paste under your @views section in ${target}:\n${lines.join('\n')}`;
    if (notes.length) out += `\n${notes.map((note) => `# ${note}`).join('\n')}`;
    return out;
}

function tasksUnquoteSchemaValue(value) {
    const text = String(value ?? '').trim();
    if (text.length >= 2 && ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'")))) {
        try {
            return JSON.parse(text.startsWith('"') ? text : `"${text.slice(1, -1).replace(/"/g, '\\"')}"`);
        } catch {
            return text.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
        }
    }
    return text;
}

export function parseTasksProjectionConfigText(text) {
    const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'));
    const start = lines.findIndex((line) => line.endsWith(':') && !line.includes('='));
    const body = start >= 0 ? lines.slice(start + 1) : lines;
    const cfg = {};
    for (const line of body) {
        const eq = line.indexOf('=');
        if (eq <= 0) continue;
        const key = line.slice(0, eq).trim();
        const value = tasksUnquoteSchemaValue(line.slice(eq + 1));
        if (key === 'filter_query') {
            try { cfg.filterQuery = normalizeTasksFilterQuery(JSON.parse(value)); } catch { /* ignore bad paste */ }
        } else if (key === 'query_builder_enabled') cfg.queryBuilderEnabled = value === 'true';
        else if (key === 'search_enabled') cfg.searchEnabled = value === 'true';
        else if (key === 'search') cfg.searchQuery = value;
        else if (key === 'filters_collapsed') cfg.filtersCollapsed = value === 'true';
        else if (key === 'edges_visible') cfg.edgesVisible = value !== 'false';
        else if (key === 'edge_opacity') cfg.edgeOpacity = value;
        else if (key === 'projection_unspecified_content_opacity') cfg.projectionUnspecifiedContentOpacity = value;
        else if (key === 'color_by') cfg.colorBy = value;
        else if (key === 'secondary_color_by') cfg.secondaryColorBy = value;
        else if (key === 'group_by') cfg.groupBy = value.split(',').map((item) => item.trim()).filter(Boolean);
        else if (key === 'where' && !cfg.filterQuery) {
            const splitAt = value.indexOf('=');
            if (splitAt > 0) {
                cfg.filterQuery = normalizeTasksFilterQuery({
                    combinator: 'and',
                    rules: [{ field: value.slice(0, splitAt).trim(), operator: '=', value: value.slice(splitAt + 1).trim() }],
                });
            }
        }
    }
    return cfg;
}

const TASKS_SEQUENCE_LANE_WIDTH = 196;
const TASKS_SEQUENCE_LANE_GAP = 102;
const TASKS_SEQUENCE_LEFT = 148;
const TASKS_SEQUENCE_LIFELINE_TOP = 40;
const TASKS_SEQUENCE_FIRST_ROW = 136;
const TASKS_SEQUENCE_ROW_HEIGHT = 46;

export function tasksProjectionById(model, projectionId) {
    const id = String(projectionId || '').trim();
    if (!id) return null;
    const list = Array.isArray(model?.view_projections) ? model.view_projections : [];
    return list.find((entry) => entry && entry.id === id) || null;
}

export function tasksProjectionLayout(model, projectionId) {
    return String(tasksProjectionById(model, projectionId)?.layout || '').trim().toLowerCase();
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
