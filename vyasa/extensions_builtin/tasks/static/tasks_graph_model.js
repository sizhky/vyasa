import { logTasksPerf, traceTasksEdge } from './tasks_diagnostics.js';
import {
    applyTasksFilterAttributePolicy, resolveTasksNodeImage, sizeTaskNode, tasksUngroupModelForGrouping,
    tasksViewMatchesContext,
} from './tasks_graph_core.js';

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
    'id', 'label', 'kind', 'group_id', 'parent_group_id',
    'handlelayout', 'highlightmode', 'sourcegroupid', 'source_group_id',
    'width', 'height', 'position', 'parentid',
    'parent_id', 'color', 'href', 'image', 'image_by', 'collapsed', 'child_group_ids',
    'child_task_ids', 'projection',
    'active_projection', 'graph_x', 'graph_y',
]);
const TASKS_DERIVED_METRIC_KEYS = new Set(['rank', 'connectivity']);
const TASKS_INTERNAL_EDGE_META_KEYS = new Set([
    'id', 'source', 'target', 'relation', 'label', 'type', 'kind', 'animated',
    'markerend', 'labelstyle', 'labelbgstyle', 'style', 'data', 'zindex',
    'labelbgpadding', 'labelbgborderradius', 'labelzindex', 'labelmaxwidth',
    'sourcehandle', 'targethandle',
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

// Anything the viewer writes onto a node or an edge for its own use is named
// __like_this__. A rule beats a list: each fixed layout adds several, and a
// forgotten entry shows up as machinery in the reader's card.
export function tasksIsInternalMetaKey(key) {
    return String(key || '').trim().startsWith('__');
}

export function tasksIsHiddenNodeMetaKey(key) {
    const normalized = String(key || '').trim().toLowerCase();
    return tasksIsInternalMetaKey(key)
        || TASKS_INTERNAL_NODE_META_KEYS.has(normalized)
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
        .filter(([key, value]) => !hidden.has(key) && !tasksIsInternalMetaKey(key) && !TASKS_INTERNAL_EDGE_META_KEYS.has(String(key).toLowerCase()) && tasksAttrValues(value).length)
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

export function tasksProjectionById(model, projectionId) {
    const id = String(projectionId || '').trim();
    if (!id) return null;
    const list = Array.isArray(model?.view_projections) ? model.view_projections : [];
    return list.find((entry) => entry && entry.id === id) || null;
}

export function tasksProjectionLayout(model, projectionId) {
    return String(tasksProjectionById(model, projectionId)?.layout || '').trim().toLowerCase();
}

export const TASKS_CARD_STATE_ATTR = 'card_state';

const TASKS_FILTER_TEXT_VALUE_LIMIT = 24;

const TASKS_FILTER_TEXT_VALUE_LENGTH = 48;

export const TASKS_DEFAULT_CARD_STATES = ['Not Done', 'Done'];

const TASKS_GANTT_UNIT_WIDTH = 340;

const TASKS_GANTT_ROW_GAP = 56;

const TASKS_GANTT_BAR_MIN_HEIGHT = 34;

const TASKS_GANTT_LEFT = 210;

const TASKS_GANTT_TOP = 86;

export const TASKS_GANTT_PROJECTION_ID = '__gantt__';

// A view that cannot be laid out still occupies the dropdown and still draws
// something: its own error, where the graph would have been.
export const TASKS_LAYOUT_ERROR_MODE = 'layout-error';

export function buildLayoutErrorGraph(message, viewId) {
    return {
        nodes: [{
            id: '__layout_error',
            label: String(message || 'This view cannot be drawn.'),
            __kind__: 'layoutError',
            __layout_error_view__: String(viewId || ''),
            __fixed_size__: true,
            __z__: 1,
            position: { x: 40, y: 40 },
            width: 620,
            height: 132,
        }],
        edges: [],
    };
}

export const TASKS_PROJECTION_UNSPECIFIED_LABEL = 'Unspecified';

export function tasksModelSetting(model, key, fallback = '') {
    const value = model && Object.prototype.hasOwnProperty.call(model, key) ? model[key] : undefined;
    if (value === null || value === undefined || String(value).trim?.() === '') return fallback;
    return value;
}

export function tasksModelBooleanSetting(model, key, fallback = false) {
    const value = tasksModelSetting(model, key, fallback ? 'true' : 'false');
    if (typeof value === 'boolean') return value;
    const normalized = String(value || '').trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
    return fallback;
}

export function clampTasksProjectionDisplayOpacity(value) {
    return Math.max(0.02, clampTasksProjectionContentOpacity(value));
}

export function tasksMatchedSlideNodes(slides, slideIndex, graphNodes) {
    const slide = slideIndex >= 0 ? slides[slideIndex] : null;
    if (!slide) return [];
    const ids = new Set((slide.nodes || []).map((id) => String(id || '').trim()).filter(Boolean));
    return (graphNodes || []).filter((node) => node?.id && ids.has(node.id));
}

export function tasksProjectionPrefsKey(projectionId, contextId = '') {
    const id = String(projectionId || '').trim();
    const context = String(contextId || '').trim();
    return context ? `${context}::${id || '__base__'}` : (id || '__base__');
}

function readTasksProjectionPrefs(prefs, projectionId) {
    return readTasksProjectionPrefsForModel(null, prefs, projectionId);
}

export function tasksProjectionSchemaPrefs(model, projectionId) {
    const id = String(projectionId || '').trim();
    const projection = id
        ? (Array.isArray(model?.view_projections) ? model.view_projections : [])
            .find((entry) => entry && entry.id === id)
        : null;
    if (id && !projection) return {};
    const schemaGroupByHierarchy = (id
        ? projection?.groups_from
        : model?.default_group_by
    )?.map?.((entry) => String(entry || '').trim()).filter(Boolean) || [];
    const prefs = {
        groupByEnabled: schemaGroupByHierarchy.length > 0,
        groupByHierarchy: schemaGroupByHierarchy,
        groupByDisabledKeys: [],
    };
    if (!projection) return prefs;
    if (projection.filter_query && typeof projection.filter_query === 'object') {
        prefs.filters = normalizeTasksFilterQuery(projection.filter_query);
    }
    if (typeof projection.query_builder_enabled === 'boolean') prefs.queryBuilderEnabled = projection.query_builder_enabled;
    if (typeof projection.search_enabled === 'boolean') prefs.searchEnabled = projection.search_enabled;
    if (typeof projection.search === 'string') prefs.searchQuery = projection.search;
    if (typeof projection.default_color_by === 'string') prefs.colorBy = projection.default_color_by;
    if (typeof projection.default_secondary_color_by === 'string') prefs.secondaryColorBy = projection.default_secondary_color_by;
    if (typeof projection.filters_collapsed === 'boolean') prefs.filtersCollapsed = projection.filters_collapsed;
    if (typeof projection.edges_visible === 'boolean') prefs.edgesVisible = projection.edges_visible;
    if (projection.edge_opacity !== undefined && projection.edge_opacity !== '') prefs.edgeOpacity = clampTasksEdgeOpacity(projection.edge_opacity);
    if (projection.projection_unspecified_content_opacity !== undefined && projection.projection_unspecified_content_opacity !== '') {
        prefs.unspecifiedContentOpacity = clampTasksProjectionDisplayOpacity(projection.projection_unspecified_content_opacity);
    }
    return prefs;
}

export function tasksGroupByPrefsDifferFromSchema(model, projectionId, enabled, hierarchy, disabledKeys = []) {
    const defaults = tasksProjectionSchemaPrefs(model, projectionId);
    const currentHierarchy = (hierarchy || []).map((entry) => String(entry || '').trim()).filter(Boolean);
    const defaultHierarchy = defaults.groupByHierarchy || [];
    return Boolean(enabled) !== Boolean(defaults.groupByEnabled)
        || currentHierarchy.length !== defaultHierarchy.length
        || currentHierarchy.some((entry, index) => entry !== defaultHierarchy[index])
        || normalizeTasksGroupByDisabledKeys(disabledKeys).length > 0;
}

export function normalizeTasksGroupByDisabledKeys(value) {
    if (!Array.isArray(value)) return [];
    return Array.from(new Set(value.map((entry) => String(entry || '').trim()).filter(Boolean)));
}

export function readTasksProjectionPrefsForModel(model, prefs, projectionId) {
    const schemaPrefs = tasksProjectionSchemaPrefs(model, projectionId);
    const key = tasksProjectionPrefsKey(projectionId, model?.kg_context?.id);
    const scoped = prefs?.projectionPrefs?.[key];
    if (scoped && typeof scoped === 'object') return { ...schemaPrefs, ...scoped };
    if (!String(projectionId || '').trim() && prefs && typeof prefs === 'object') return { ...schemaPrefs, ...prefs };
    if (prefs?.projectionPrefs && typeof prefs.projectionPrefs === 'object') return schemaPrefs;
    return prefs && typeof prefs === 'object' ? { ...schemaPrefs, ...prefs } : schemaPrefs;
}

export function normalizeTasksCheckedNodeIds(value) {
    if (!Array.isArray(value)) return [];
    return Array.from(new Set(value.map((entry) => String(entry || '').trim()).filter(Boolean)));
}

export function normalizeTasksCardStates(model) {
    const raw = Array.isArray(model?.card_states) ? model.card_states : String(model?.card_states || '').split(',');
    const states = raw.map((entry) => String(entry || '').trim()).filter(Boolean);
    return Array.from(new Set(states.length ? states : TASKS_DEFAULT_CARD_STATES));
}

export function normalizeTasksNodeStates(value, cardStates) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const valid = new Set(cardStates);
    const firstState = cardStates[0] || TASKS_DEFAULT_CARD_STATES[0];
    return Object.fromEntries(Object.entries(value)
        .map(([nodeId, state]) => [String(nodeId || '').trim(), String(state || '').trim()])
        .filter(([nodeId, state]) => nodeId && state && state !== firstState && valid.has(state)));
}

export function normalizeTasksNodeNotes(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value)
        .map(([nodeId, note]) => [String(nodeId || '').trim(), String(note || '')])
        .filter(([nodeId, note]) => nodeId && note.trim()));
}

export function updateTasksNote(setNotes, id, note) {
    const normalizedId = String(id || '').trim();
    if (!normalizedId) return;
    setNotes((current) => {
        const next = { ...(current || {}) };
        const text = String(note || '');
        if (text.trim()) next[normalizedId] = text;
        else delete next[normalizedId];
        return next;
    });
}

export function normalizeTasksSlideNotes(value) {
    return normalizeTasksNodeNotes(value);
}

export function tasksHasAnyNodeNote(nodeNotes) {
    return Object.values(nodeNotes || {}).some((note) => String(note || '').trim());
}

export function tasksNodeMetaLabel(key) {
    return key.replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase());
}

export function collectTasksGroupDescendants(nodeId, model) {
    if (!nodeId || !model) return { groups: [], tasks: [] };
    const groupsById = Object.fromEntries((model.groups || []).map((group) => [group.id, group]));
    const tasksById = Object.fromEntries((model.tasks || []).map((task) => [task.id, task]));
    const groups = [];
    const tasks = [];
    const walkGroup = (groupId) => {
        const group = groupsById[groupId];
        if (!group) return;
        groups.push(group);
        for (const taskId of (model.task_children?.[groupId] || [])) {
            if (tasksById[taskId]) tasks.push(tasksById[taskId]);
        }
        for (const childGroupId of (model.group_tree?.[groupId] || [])) walkGroup(childGroupId);
    };
    for (const childGroupId of (model.group_tree?.[nodeId] || [])) walkGroup(childGroupId);
    for (const taskId of (model.task_children?.[nodeId] || [])) {
        if (tasksById[taskId]) tasks.push(tasksById[taskId]);
    }
    return { groups, tasks };
}

export function collectTasksGroupDescendantIds(nodeId, model) {
    const descendants = collectTasksGroupDescendants(nodeId, model);
    return new Set([...descendants.groups, ...descendants.tasks].map((node) => node.id).filter(Boolean));
}

function tasksChildGroupIds(nodeId, model) {
    return model?.group_tree?.[nodeId] || [];
}

function tasksChildTaskIds(nodeId, model) {
    return model?.task_children?.[nodeId] || [];
}

export function tasksNodeHasChildren(nodeId, model) {
    return tasksChildGroupIds(nodeId, model).length > 0 || tasksChildTaskIds(nodeId, model).length > 0;
}

function tasksVisibleGraphStatsLabel(nodes, edges) {
    const nodeCount = Array.isArray(nodes) ? nodes.length : 0;
    const edgeCount = Array.isArray(edges) ? edges.length : 0;
    const nodeLabel = nodeCount === 1 ? 'Node' : 'Nodes';
    const edgeLabel = edgeCount === 1 ? 'Edge' : 'Edges';
    return `${nodeCount} ${nodeLabel} and ${edgeCount} ${edgeLabel}`;
}

export function tasksLogicalGraphStatsLabel(model) {
    const nodeCount = (Array.isArray(model?.groups) ? model.groups.length : 0)
        + (Array.isArray(model?.tasks) ? model.tasks.length : 0);
    const edgeCount = Array.isArray(model?.dependency_edges) ? model.dependency_edges.length : 0;
    const nodeLabel = nodeCount === 1 ? 'Node' : 'Nodes';
    if (edgeCount) {
        const edgeLabel = edgeCount === 1 ? 'Edge' : 'Edges';
        return `${nodeCount} ${nodeLabel} and ${edgeCount} ${edgeLabel}`;
    }
    const childCount = (items) => Array.isArray(items) ? items.length : 0;
    const hasRealParent = (parent) => Boolean(parent) && parent !== 'null' && parent !== 'undefined';
    let hierarchyLinks = 0;
    for (const [parent, items] of Object.entries(model?.group_tree || {})) {
        if (hasRealParent(parent)) hierarchyLinks += childCount(items);
    }
    for (const [parent, items] of Object.entries(model?.task_children || {})) {
        if (hasRealParent(parent)) hierarchyLinks += childCount(items);
    }
    if (hierarchyLinks) {
        const hierarchyLabel = hierarchyLinks === 1 ? 'Hierarchy Link' : 'Hierarchy Links';
        return `${nodeCount} ${nodeLabel} and ${hierarchyLinks} ${hierarchyLabel}`;
    }
    return `${nodeCount} ${nodeLabel} and 0 Edges`;
}

export function tasksExpandableNodeIds(model) {
    const ids = new Set();
    for (const group of (model?.groups || [])) {
        if (tasksNodeHasChildren(group.id, model)) ids.add(group.id);
    }
    for (const task of (model?.tasks || [])) {
        if (tasksNodeHasChildren(task.id, model)) ids.add(task.id);
    }
    return ids;
}

export function tasksFilterOptions(model) {
    if (!model) return [];
    const indexedKeys = new Set([
        ...(Array.isArray(model?.index_attributes) ? model.index_attributes : []),
        ...(Array.isArray(model?.filter_attributes) ? model.filter_attributes : []),
    ].map((key) => String(key || '').trim()).filter(Boolean));
    const continuousColorKeys = new Set(
        Object.entries(model?.node_color_palettes && typeof model.node_color_palettes === 'object' ? model.node_color_palettes : {})
            .filter(([, palette]) => isTasksGradientPalette(palette))
            .map(([key]) => String(key || '').trim())
            .filter(Boolean)
    );
    const buckets = new Map();
    const visit = (node) => {
        if (!node) return;
        for (const [key, value] of Object.entries(node)) {
            if (tasksIsHiddenNodeMetaKey(key) || value === null || value === undefined || value === '') continue;
            if (continuousColorKeys.has(String(key))) continue;
            const values = tasksAttrValues(value);
            if (!values.length) continue;
            if (!buckets.has(key)) buckets.set(key, { values: new Set(), kinds: new Set() });
            values.forEach((entry) => buckets.get(key).values.add(String(entry)));
            buckets.get(key).kinds.add(Array.isArray(value) ? 'string' : typeof value);
        }
    };
    (model.groups || []).forEach(visit);
    (model.tasks || []).forEach(visit);
    const visibleKeys = new Set(applyTasksFilterAttributePolicy(Array.from(buckets.keys()), model));
    return Array.from(buckets.entries())
        .filter(([key]) => visibleKeys.has(key))
        .map(([key, bucket]) => ({
            key,
            label: tasksNodeMetaLabel(key),
            values: Array.from(bucket.values).sort((a, b) => a.localeCompare(b)),
            isBoolean: bucket.kinds.size === 1 && bucket.kinds.has('boolean'),
            isText: !indexedKeys.has(key)
                || bucket.values.size > TASKS_FILTER_TEXT_VALUE_LIMIT
                || Array.from(bucket.values).some((value) => String(value).length > TASKS_FILTER_TEXT_VALUE_LENGTH),
        }))
        .sort((a, b) => a.label.localeCompare(b.label));
}

export function tasksGroupByOptions(model) {
    const keys = Array.isArray(model?.index_attributes) ? model.index_attributes : [];
    return Array.from(new Set(keys.map((key) => String(key || '').trim()).filter(Boolean)))
        .filter((key) => !TASKS_DERIVED_METRIC_KEYS.has(key.toLowerCase()))
        .map((key) => ({ key, label: tasksNodeMetaLabel(key) }))
        .sort((a, b) => a.label.localeCompare(b.label));
}

function tasksSlug(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'item';
}

export function buildTasksCollapsedGraph(model) {
    const groupTree = model.group_tree || {};
    const taskChildren = model.task_children || {};
    const groupsById = Object.fromEntries((model.groups || []).map((group) => [group.id, group]));
    const taskToGroup = Object.fromEntries((model.tasks || []).map((task) => [task.id, task.group_id || null]));
    const groupParent = Object.fromEntries((model.groups || []).map((group) => [group.id, group.parent_group_id || null]));
    const nodes = [];
    const queue = [...(groupTree.null || [])];
    const order = [];
    while (queue.length) {
        const groupId = queue.shift();
        order.push(groupId);
        queue.push(...(groupTree[groupId] || []));
    }
    for (const task of model.tasks || []) {
        if (task.group_id !== null && task.group_id !== undefined) continue;
        nodes.push({ id: task.id, label: task.label || task.id, href: task.href, kind: 'task', collapsed: true, x: 80, y: 80, width: 220, height: 60 });
    }
    order.forEach((groupId, index) => {
        const group = groupsById[groupId] || {};
        nodes.push({
            id: groupId,
            label: group.label || groupId,
            href: group.href,
            kind: 'group',
            collapsed: true,
            x: 80 + (index % 3) * 280,
            y: 80 + Math.floor(index / 3) * 140,
            width: 250,
            height: 80,
            child_group_ids: groupTree[groupId] || [],
            child_task_ids: taskChildren[groupId] || [],
        });
    });
    const collapsedOwner = (taskId) => {
        let cur = taskToGroup[taskId] || null;
        let owner = null;
        while (cur !== null && cur !== undefined) {
            owner = cur;
            cur = groupParent[cur] || null;
        }
        return owner || taskId;
    };
    const edges = [];
    const seen = new Set();
    for (const edge of model.dependency_edges || []) {
        const source = collapsedOwner(edge.source);
        const target = collapsedOwner(edge.target);
        const key = `${source}->${target}`;
        if (source === target || seen.has(key)) continue;
        seen.add(key);
        edges.push({ ...edge, source, target, kind: 'collapsed-proxy' });
    }
    return { nodes, edges };
}

export function buildTasksGroupedState(sourceModel, groupByHierarchy) {
    const attrs = (groupByHierarchy || []).map((attr) => String(attr || '').trim()).filter(Boolean);
    if (!attrs.length) return null;
    const groupingSource = buildTasksUngroupedState(sourceModel).model;
    const groups = [];
    const groupsByPath = new Map();
    const groupTree = { null: [] };
    const taskChildren = {};
    const tasks = [];
    // Levels where a task has no value are skipped instead of pooled into a
    // catch-all "Unspecified" group: the task attaches to its deepest valued
    // ancestor, or stays boxless at the top level when it matches no group.
    const valuePath = (task) => attrs
        .map((attr) => [attr, String(task?.[attr] ?? '').trim()])
        .filter(([, value]) => value);
    const pathKey = (pairs) => pairs.map(([attr, value]) => `${attr}=${value}`).join('\u001f');
    for (const task of groupingSource.tasks || []) {
        const path = valuePath(task);
        for (let depth = 1; depth <= path.length; depth += 1) {
            const prefix = path.slice(0, depth);
            const key = pathKey(prefix);
            if (groupsByPath.has(key)) continue;
            const parentKey = pathKey(prefix.slice(0, -1));
            const parentId = parentKey ? groupsByPath.get(parentKey)?.id : null;
            const [attr, value] = prefix[prefix.length - 1];
            const groupId = tasksSlug(['custom', ...prefix.map(([partAttr, part]) => `${partAttr}-${part}`)].join('__'));
            const group = {
                id: groupId,
                label: tasksNodeMetaLabel(attr) + ' ›› ' + value,
                parent_group_id: parentId,
                __projection_group__: true,
                projection: '__custom_group_by__',
                [attr]: value,
            };
            groups.push(group);
            groupsByPath.set(key, group);
            const parentTreeKey = parentId === null ? 'null' : parentId;
            if (!groupTree[parentTreeKey]) groupTree[parentTreeKey] = [];
            groupTree[parentTreeKey].push(groupId);
        }
        const leaf = groupsByPath.get(pathKey(path));
        const taskCopy = { ...task, group_id: leaf?.id || null };
        tasks.push(taskCopy);
        const childKey = taskCopy.group_id === null ? 'null' : taskCopy.group_id;
        if (!taskChildren[childKey]) taskChildren[childKey] = [];
        taskChildren[childKey].push(taskCopy.id);
    }
    const visibleTaskIds = new Set(tasks.map((task) => task.id));
    const model = {
        ...groupingSource,
        graph_id: `${groupingSource.graph_id || 'tasks'}-custom-group-by`,
        groups,
        tasks,
        dependency_edges: (groupingSource.dependency_edges || []).filter((edge) => visibleTaskIds.has(edge.source) && visibleTaskIds.has(edge.target)),
        group_tree: groupTree,
        task_children: taskChildren,
        document_order: [...groups.map((group) => group.id), ...tasks.map((task) => task.id)],
        active_projection: '__custom_group_by__',
        default_color_by: sourceModel.default_color_by || attrs[0] || '',
        default_open_depth: -1,
    };
    delete model.projection_models;
    delete model.view_projections;
    const graph = buildTasksCollapsedGraph(model);
    logTasksPerf('kg-projection', {
        kind: 'custom-group-by',
        sourceGraphId: sourceModel?.graph_id || '',
        attrs,
        sourceGroups: (sourceModel?.groups || []).length,
        sourceTasks: (sourceModel?.tasks || []).length,
        sourceEdges: (sourceModel?.dependency_edges || []).length,
        groups: groups.length,
        tasks: tasks.length,
        edges: (model.dependency_edges || []).length,
        collapsedNodes: (graph.nodes || []).length,
        collapsedEdges: (graph.edges || []).length,
        defaultOpenDepth: model.default_open_depth,
    });
    return { model, graph, projectionId: '__custom_group_by__' };
}

export function buildTasksUngroupedState(sourceModel) {
    const model = tasksUngroupModelForGrouping(sourceModel);
    delete model.projection_models;
    delete model.view_projections;
    return { model, graph: buildTasksCollapsedGraph(model) };
}

export function buildTasksEgoState(sourceModel, sourceGraph, selectedIds, includeNeighbors = false, colorBy = '') {
    const selected = new Set(Array.from(selectedIds || []).map((id) => String(id || '').trim()).filter(Boolean));
    if (!selected.size) return null;
    const groupsById = Object.fromEntries((sourceModel.groups || []).map((group) => [group.id, group]));
    const tasksById = Object.fromEntries((sourceModel.tasks || []).map((task) => [task.id, task]));
    const visible = new Set(selected);
    if (includeNeighbors) {
        const neighborEdges = [...(sourceModel.dependency_edges || []), ...tasksReferenceEdges(sourceModel)];
        for (const edge of neighborEdges) {
            if (selected.has(edge.source)) visible.add(edge.target);
            if (selected.has(edge.target)) visible.add(edge.source);
        }
    }
    const directSelected = new Set(selected);
    const addDescendants = (groupId) => {
        for (const childGroupId of sourceModel.group_tree?.[groupId] || []) {
            visible.add(childGroupId);
            addDescendants(childGroupId);
        }
        for (const taskId of sourceModel.task_children?.[groupId] || []) visible.add(taskId);
    };
    for (const id of Array.from(visible)) {
        if (groupsById[id]) addDescendants(id);
    }
    const addAncestors = (id) => {
        let parentId = tasksById[id]?.group_id ?? groupsById[id]?.parent_group_id ?? null;
        while (parentId) {
            if (visible.has(parentId)) break;
            visible.add(parentId);
            parentId = groupsById[parentId]?.parent_group_id ?? null;
        }
    };
    for (const id of Array.from(visible)) addAncestors(id);
    const groups = (sourceModel.groups || []).filter((group) => visible.has(group.id));
    const tasks = (sourceModel.tasks || []).filter((task) => visible.has(task.id));
    const visibleNodeIds = new Set([...groups.map((group) => group.id), ...tasks.map((task) => task.id)]);
    const groupTree = {};
    for (const group of groups) {
        const parentKey = group.parent_group_id && visibleNodeIds.has(group.parent_group_id) ? group.parent_group_id : 'null';
        if (!groupTree[parentKey]) groupTree[parentKey] = [];
        groupTree[parentKey].push(group.id);
    }
    if (!groupTree.null) groupTree.null = [];
    const taskChildren = {};
    for (const task of tasks) {
        const parentKey = task.group_id && visibleNodeIds.has(task.group_id) ? task.group_id : 'null';
        if (!taskChildren[parentKey]) taskChildren[parentKey] = [];
        taskChildren[parentKey].push(task.id);
    }
    const dependencyEdges = (sourceModel.dependency_edges || []).filter((edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target));
    const model = {
        ...sourceModel,
        graph_id: `${sourceModel.graph_id || 'tasks'}-ego`,
        groups,
        tasks,
        dependency_edges: dependencyEdges,
        group_tree: groupTree,
        task_children: taskChildren,
        document_order: (sourceModel.document_order || []).filter((id) => visibleNodeIds.has(id)),
        default_open_depth: -1,
        default_color_by: String(colorBy || '').trim() || sourceModel.default_color_by || '',
        ego_selected_ids: Array.from(directSelected).filter((id) => visibleNodeIds.has(id)),
        ego_include_neighbors: includeNeighbors,
    };
    delete model.projection_models;
    delete model.view_projections;
    delete model.slides;
    const graph = {
        nodes: (sourceGraph.nodes || []).filter((node) => visibleNodeIds.has(node.id)),
        edges: (sourceGraph.edges || []).filter((edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)),
    };
    return { model, graph };
}

export function isTasksGradientPalette(palette) {
    return Boolean(
        palette
        && typeof palette === 'object'
        && String(palette.type || '').trim() === 'continuous'
        && Array.isArray(palette.stops)
        && palette.stops.length >= 2
    );
}

export function parseTasksNumericValue(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const text = String(value ?? '').trim();
    if (!/^-?\d+(?:\.\d+)?$/.test(text)) return null;
    const parsed = Number(text);
    return Number.isFinite(parsed) ? parsed : null;
}

export function formatTasksMetricValue(value) {
    if (!Number.isFinite(value)) return '';
    if (Math.abs(value - Math.round(value)) < 0.001) return Math.round(value).toLocaleString('en-US');
    return value.toFixed(2).replace(/\.?0+$/, '');
}

export function tasksModelNodeLabels(model) {
    return {
        ...(model?.node_reference_labels || {}),
        ...Object.fromEntries([...(model?.groups || []), ...(model?.tasks || [])]
            .map((node) => [String(node.id || ''), String(node.label || node.id || '')])),
    };
}

export function buildVisibleTasksGraph(model, expanded) {
    const nodeLabels = tasksModelNodeLabels(model);
    const groupsById = Object.fromEntries((model.groups || []).map((g) => [g.id, g]));
    const tasksById = Object.fromEntries((model.tasks || []).map((t) => [t.id, t]));
    const visibleGroups = new Set(model.group_tree?.["null"] || []);
    const visibleTasks = new Set(model.task_children?.["null"] || []);
    for (const nodeId of expanded) {
        tasksChildGroupIds(nodeId, model).forEach((id) => visibleGroups.add(id));
        tasksChildTaskIds(nodeId, model).forEach((id) => visibleTasks.add(id));
    }
    const visibleNodes = [
        ...Array.from(visibleGroups).map((id) => {
            const source = groupsById[id] || {};
            const label = source.label || id;
            return { ...source, id, label, __kind__: 'group', ...sizeTaskNode(label, 'group', null, { hasImage: Boolean(resolveTasksNodeImage(source, model)), nodeLabels }) };
        }),
        ...Array.from(visibleTasks).map((id) => {
            const source = tasksById[id] || {};
            const label = source.label || id;
            return { ...source, id, label, __kind__: 'task', ...sizeTaskNode(label, 'task', null, { hasImage: Boolean(resolveTasksNodeImage(source, model)), nodeLabels }) };
        }),
    ];
    const parentOfGroup = Object.fromEntries((model.groups || []).map((g) => [g.id, g.parent_group_id || null]));
    const parentOfTask = Object.fromEntries((model.tasks || []).map((t) => [t.id, t.group_id || null]));
    const nextVisibleParent = (id) => {
        if (visibleGroups.has(id) || visibleTasks.has(id)) return id;
        if (parentOfTask[id] !== undefined) return parentOfTask[id] || null;
        return parentOfGroup[id] || null;
    };
    const nearestVisible = (id) => {
        if (visibleGroups.has(id) || visibleTasks.has(id)) return id;
        let cur = nextVisibleParent(id);
        while (cur) {
            if (visibleGroups.has(cur) || visibleTasks.has(cur)) return cur;
            cur = nextVisibleParent(cur);
        }
        return id;
    };
    const seen = new Set();
    const visibleEdges = [];
    for (const edge of (model.dependency_edges || [])) {
        const src = nearestVisible(edge.source);
        const dst = nearestVisible(edge.target);
        traceTasksEdge('visibleGraph', edge, {
            mapped: { source: src, target: dst },
            expanded: Array.from(expanded),
        });
        const key = `${src}->${dst}`;
        if (src !== dst && !seen.has(key)) {
            seen.add(key);
            visibleEdges.push({ ...edge, source: src, target: dst, label: edge.label || '' });
        }
    }
    return { nodes: visibleNodes, edges: visibleEdges };
}

export function effectiveExpandedGroups(model, expandedSet) {
    const groupParent = Object.fromEntries((model.groups || []).map((group) => [group.id, group.parent_group_id || null]));
    const expanded = expandedSet instanceof Set ? expandedSet : new Set(expandedSet || []);
    const effective = new Set();
    for (const groupId of expanded) {
        let parentId = groupParent[groupId];
        let blocked = false;
        while (parentId) {
            if (!expanded.has(parentId)) {
                blocked = true;
                break;
            }
            parentId = groupParent[parentId] || null;
        }
        if (!blocked) effective.add(groupId);
    }
    return effective;
}

export function appendProjectedEdge(edges, seen, source, target, label = '', attrs = {}) {
    if (!source || !target || source === target) return;
    const key = `${source}->${target}`;
    const existing = seen.get(key);
    if (existing) {
        if (label && !existing.labels.has(label)) {
            existing.labels.add(label);
            existing.edge.label = Array.from(existing.labels).join(', ');
            existing.edge.__edge_types__ = Array.from(existing.labels);
        }
        for (const [attrKey, attrValue] of Object.entries(attrs || {})) {
            if (existing.edge[attrKey] === undefined && attrValue !== undefined && attrValue !== '') {
                existing.edge[attrKey] = attrValue;
            }
        }
        return;
    }
    const edge = { ...attrs, source, target };
    if (label) edge.label = label;
    edge.__edge_types__ = tasksEdgeTypeValues(edge);
    edges.push(edge);
    seen.set(key, { edge, labels: new Set(label ? [label] : []) });
}

export function normalizeTasksGraphNodes(graph, model) {
    const nodeLabels = tasksModelNodeLabels(model);
    const groupsById = Object.fromEntries((model.groups || []).map((g) => [g.id, g]));
    const tasksById = Object.fromEntries((model.tasks || []).map((t) => [t.id, t]));
    return {
        ...graph,
        nodes: (graph.nodes || []).map((node) => {
            const source = groupsById[node.id] || tasksById[node.id] || {};
            const { kind: _legacyNodeKind, ...nodeRest } = node;
            const kind = node.__kind__ || _legacyNodeKind || (groupsById[node.id] ? 'group' : 'task');
            const label = node.label || source.label || node.id;
            // A fixed-layout node (a sequence lifeline, a phase band) states its own
            // box. Auto-sizing it to a card would throw that away.
            const size = node.__fixed_size__
                ? { width: node.width, height: node.height }
                : sizeTaskNode(label, kind, null, { hasImage: Boolean(resolveTasksNodeImage(source, model)), nodeLabels });
            return { ...source, ...nodeRest, __kind__: kind, label, ...size };
        }),
    };
}

function taskDurationUnits(task) {
    const raw = task?.duration ?? task?.estimate ?? task?.points ?? 1;
    const match = String(raw ?? '').match(/-?\d+(?:\.\d+)?/);
    const parsed = match ? Number.parseFloat(match[0]) : 1;
    return Math.max(1, Math.ceil(Number.isFinite(parsed) ? parsed : 1));
}

export function buildGanttTasksGraph(model) {
    const tasks = model.tasks || [];
    const nodeLabels = tasksModelNodeLabels(model);
    const byId = Object.fromEntries(tasks.map((task) => [task.id, task]));
    const outgoing = new Map();
    const incomingCount = new Map(tasks.map((task) => [task.id, 0]));
    for (const edge of model.dependency_edges || []) {
        if (!byId[edge.source] || !byId[edge.target]) continue;
        if (!outgoing.has(edge.source)) outgoing.set(edge.source, []);
        outgoing.get(edge.source).push(edge.target);
        incomingCount.set(edge.target, (incomingCount.get(edge.target) || 0) + 1);
    }
    const queue = tasks.filter((task) => (incomingCount.get(task.id) || 0) === 0).map((task) => task.id);
    const ordered = [];
    while (queue.length) {
        const id = queue.shift();
        ordered.push(id);
        for (const target of outgoing.get(id) || []) {
            incomingCount.set(target, (incomingCount.get(target) || 0) - 1);
            if ((incomingCount.get(target) || 0) === 0) queue.push(target);
        }
    }
    for (const task of tasks) if (!ordered.includes(task.id)) ordered.push(task.id);
    const timing = {};
    for (const id of ordered) {
        const duration = taskDurationUnits(byId[id]);
        const predecessors = (model.dependency_edges || []).filter((edge) => edge.target === id && byId[edge.source]);
        const start = predecessors.length
            ? Math.max(...predecessors.map((edge) => (timing[edge.source]?.finish ?? taskDurationUnits(byId[edge.source]))))
            : 0;
        timing[id] = { start, duration, finish: start + duration };
    }
    const lanesByStart = new Map();
    const rows = ordered.map((id) => {
        const start = timing[id]?.start || 0;
        const lane = lanesByStart.get(start) || 0;
        lanesByStart.set(start, lane + 1);
        return { id, row: lane };
    });
    const maxRow = Math.max(0, ...rows.map((item) => item.row));
    const rowHeights = new Map();
    const nodes = rows.map(({ id, row }) => {
        const task = byId[id];
        const time = timing[id] || { start: 0, duration: 1 };
        const width = Math.max(TASKS_GANTT_UNIT_WIDTH - 52, time.duration * TASKS_GANTT_UNIT_WIDTH - 68);
        const sized = sizeTaskNode(task.label || id, 'task', width, { hasImage: Boolean(resolveTasksNodeImage(task, model)), nodeLabels });
        const height = Math.max(TASKS_GANTT_BAR_MIN_HEIGHT, sized.height - 18);
        rowHeights.set(row, Math.max(rowHeights.get(row) || 0, height));
        return {
            ...task,
            id,
            label: task.label || id,
            __kind__: 'task',
            __gantt: true,
            gantt_start: time.start,
            gantt_duration: time.duration,
            position: { x: TASKS_GANTT_LEFT + time.start * TASKS_GANTT_UNIT_WIDTH, y: TASKS_GANTT_TOP },
            width,
            height,
            gantt_row: row,
        };
    });
    const rowOffsets = new Map();
    let cursorY = TASKS_GANTT_TOP;
    for (let row = 0; row <= maxRow; row += 1) {
        rowOffsets.set(row, cursorY);
        cursorY += (rowHeights.get(row) || TASKS_GANTT_BAR_MIN_HEIGHT) + TASKS_GANTT_ROW_GAP;
    }
    for (const node of nodes) {
        node.position = { ...node.position, y: rowOffsets.get(node.gantt_row) || TASKS_GANTT_TOP };
    }
    const maxFinish = Math.max(1, ...Object.values(timing).map((time) => time.finish));
    for (let unit = 0; unit <= maxFinish; unit += 1) {
        nodes.push({
            id: `__gantt_unit_${unit}`,
            label: unit === 0 ? '' : String(unit),
            __kind__: 'ganttHeader',
            position: { x: TASKS_GANTT_LEFT + unit * TASKS_GANTT_UNIT_WIDTH, y: 24 },
            width: TASKS_GANTT_UNIT_WIDTH,
            height: cursorY,
        });
    }
    const edges = (model.dependency_edges || [])
        .filter((edge) => byId[edge.source] && byId[edge.target])
        .map((edge, index) => ({ ...edge, id: `gantt-${edge.source}-${edge.target}-${index}`, label: edge.label || undefined }));
    return { nodes, edges };
}

export function collectExpandedGroupsByDepth(groupTree, defaultOpenDepth) {
    if (defaultOpenDepth === 0) return new Set();
    const expanded = new Set();
    const queue = (groupTree?.["null"] || []).map((id) => ({ id, depth: 1 }));
    while (queue.length > 0) {
        const { id, depth } = queue.shift();
        if (defaultOpenDepth !== -1 && depth > defaultOpenDepth) continue;
        expanded.add(id);
        for (const childId of (groupTree?.[id] || [])) queue.push({ id: childId, depth: depth + 1 });
    }
    return expanded;
}

export function expandOneGroupDepth(model, expandedSet) {
    const expanded = new Set(expandedSet || []);
    const roots = Array.from(tasksExpandableNodeIds(model)).filter((id) => {
        const parentId = (model?.tasks || []).find((task) => task.id === id)?.group_id
            ?? (model?.groups || []).find((group) => group.id === id)?.parent_group_id
            ?? null;
        return !parentId;
    });
    if (expanded.size === 0) {
        roots.forEach((id) => expanded.add(id));
        return expanded;
    }
    for (const nodeId of Array.from(expanded)) {
        for (const childId of [...tasksChildGroupIds(nodeId, model), ...tasksChildTaskIds(nodeId, model)]) {
            if (tasksNodeHasChildren(childId, model)) expanded.add(childId);
        }
    }
    return expanded;
}

export function collapseOneGroupDepth(model, expandedSet) {
    const expanded = new Set(expandedSet || []);
    for (const nodeId of Array.from(expanded)) {
        const childIds = [...tasksChildGroupIds(nodeId, model), ...tasksChildTaskIds(nodeId, model)];
        const hasExpandedChild = childIds.some((childId) => expanded.has(childId));
        if (!hasExpandedChild) expanded.delete(nodeId);
    }
    return expanded;
}

export function reduceTransitiveEdges(edges) {
    const nodes = new Set();
    const outgoing = new Map();
    for (const edge of edges) {
        nodes.add(edge.source);
        nodes.add(edge.target);
        if (!outgoing.has(edge.source)) outgoing.set(edge.source, []);
        outgoing.get(edge.source).push(edge.target);
    }
    const canReach = (start, target, blockedKey) => {
        const seen = new Set([start]);
        const queue = [start];
        while (queue.length > 0) {
            const cur = queue.shift();
            for (const next of outgoing.get(cur) || []) {
                if (`${cur}->${next}` === blockedKey) continue;
                if (next === target) return true;
                if (seen.has(next)) continue;
                seen.add(next);
                queue.push(next);
            }
        }
        return false;
    };
    return edges.filter((edge) => edge.label || !canReach(edge.source, edge.target, `${edge.source}->${edge.target}`));
}

export function tasksProjectionOptions(model, ganttEnabled = false, activeContextId = '') {
    const projections = Array.isArray(model?.view_projections) ? model.view_projections : [];
    const baseViewLabel = String(model?.base_view_label || '').trim() || 'Default';
    const options = [
        { id: '', label: baseViewLabel, caption: '' },
        ...projections
            .filter((projection) => (
                projection
                && projection.id
                && model?.projection_models?.[projection.id]
                && tasksViewMatchesContext(projection, activeContextId)
            ))
            .map((projection) => ({
                id: String(projection.id),
                label: String(projection.label || projection.id),
                caption: String(projection.caption || '').trim(),
                __rendered_attrs__: projection.__rendered_attrs__ || null,
            })),
    ];
    if (ganttEnabled) options.push({ id: TASKS_GANTT_PROJECTION_ID, label: 'Gantt', caption: '' });
    return options;
}

export function tasksAclViewerOptions(model) {
    const viewers = model?.viewer_models && typeof model.viewer_models === 'object' ? model.viewer_models : {};
    return Object.keys(viewers).sort().map((role) => ({ id: role, label: role }));
}

export function selectTasksAclViewerState(sourceModel, sourceGraph, viewer) {
    const id = String(viewer || '').trim();
    const entry = id ? sourceModel?.viewer_models?.[id] : null;
    if (!entry || !entry.model || !entry.graph) return { model: sourceModel, graph: sourceGraph, viewer: '' };
    return { model: entry.model, graph: entry.graph, viewer: id };
}

export function tasksProjectionDefaultColorBy(model) {
    return String(model?.default_color_by || '').trim();
}

export function tasksProjectionConfigHasSidebarState(cfg) {
    return Boolean(cfg && Object.keys(cfg).length);
}

export function selectTasksProjectionState(sourceModel, sourceGraph, projectionId) {
    const id = String(projectionId || '').trim();
    const entry = id ? sourceModel?.projection_models?.[id] : null;
    if (!entry || !entry.model || !entry.graph) {
        return { model: sourceModel, graph: sourceGraph, projectionId: '' };
    }
    return { model: entry.model, graph: entry.graph, projectionId: id };
}

export { TASKS_DERIVED_METRIC_KEYS, TASKS_EDGE_OPACITY_MAX, TASKS_EDGE_OPACITY_MIN, TASKS_HAS_NOTE_ATTR, TASKS_PROJECTION_UNSPECIFIED_CONTENT_OPACITY_DEFAULT, clampTasksEdgeOpacity };

export { TASKS_SPECIAL_NODE_ATTRS };
