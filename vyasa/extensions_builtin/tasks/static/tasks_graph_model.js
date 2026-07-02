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

export function tasksNodeMetaEntries(node) {
    if (!node) return [];
    return Object.entries(node)
        .filter(([key, value]) => !tasksIsHiddenNodeMetaKey(key) && tasksAttrValues(value).length)
        .map(([key, value]) => ({
            key,
            label: key.replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase()),
            value: normalizeTasksAttrText(value),
            renderedValue: typeof node?.__rendered_attrs__?.[key] === 'string' ? node.__rendered_attrs__[key] : '',
        }));
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
        if (filters.muted) normalized.muted = true;
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
    if (normalized.muted) return false;
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
    if (normalized.muted) return 0;
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

function normalizeTasksEdgeAnimationMode(mode, enabledFallback = undefined) {
    if (enabledFallback === false) return "none";
    const raw = String(mode || "").trim().toLowerCase();
    if (["none", "smooth", "tick"].includes(raw)) return raw;
    return "smooth";
}

function clampTasksEdgeAnimationSteps(value) {
    const parsed = Number.parseInt(value, 10);
    return Math.max(1, Math.min(48, Number.isFinite(parsed) ? parsed : 6));
}

function clampTasksEdgeAnimationDuration(value) {
    const parsed = Number.parseFloat(value);
    return Math.max(0.2, Math.min(12, Number.isFinite(parsed) ? parsed : 1.2));
}

function tasksConfigListValue(values) {
    return (values || []).map((value) => String(value ?? '').trim()).filter(Boolean).join(',');
}

function tasksQuoteSchemaValue(value) {
    const text = String(value ?? '');
    return /[\s"=]/.test(text) ? `"${text.replace(/"/g, '\\"')}"` : text;
}

export function buildTasksProjectionConfigText(config) {
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
    add('search', cfg.searchQuery);
    if (typeof cfg.filtersCollapsed === 'boolean') lines.push(`\tfilters_collapsed=${cfg.filtersCollapsed ? 'true' : 'false'}`);
    if (typeof cfg.edgesVisible === 'boolean') lines.push(`\tedges_visible=${cfg.edgesVisible ? 'true' : 'false'}`);
    if (typeof cfg.edgeAnimationEnabled === 'boolean') lines.push(`\tedge_animation_enabled=${cfg.edgeAnimationEnabled ? 'true' : 'false'}`);
    if (cfg.edgeAnimationMode) lines.push(`\tedge_animation_mode=${normalizeTasksEdgeAnimationMode(cfg.edgeAnimationMode, cfg.edgeAnimationEnabled)}`);
    if (cfg.edgeAnimationTickSteps !== undefined) lines.push(`\tedge_animation_tick_steps=${clampTasksEdgeAnimationSteps(cfg.edgeAnimationTickSteps)}`);
    if (cfg.edgeAnimationTickDuration !== undefined) lines.push(`\tedge_animation_tick_duration=${clampTasksEdgeAnimationDuration(cfg.edgeAnimationTickDuration)}`);
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
    let out = `# Paste under your @views section in kg.schema:\n${lines.join('\n')}`;
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
        else if (key === 'search') cfg.searchQuery = value;
        else if (key === 'filters_collapsed') cfg.filtersCollapsed = value === 'true';
        else if (key === 'edges_visible') cfg.edgesVisible = value !== 'false';
        else if (key === 'edge_animation_enabled') cfg.edgeAnimationEnabled = value !== 'false';
        else if (key === 'edge_animation_mode') cfg.edgeAnimationMode = normalizeTasksEdgeAnimationMode(value, cfg.edgeAnimationEnabled);
        else if (key === 'edge_animation_tick_steps') cfg.edgeAnimationTickSteps = clampTasksEdgeAnimationSteps(value);
        else if (key === 'edge_animation_tick_duration') cfg.edgeAnimationTickDuration = clampTasksEdgeAnimationDuration(value);
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

