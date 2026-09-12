import { logTasksDebug } from './tasks_diagnostics.js';
import { measureTextWidth, normalizeTasksNodeImageUrl, resolveTasksNodeImage, tasksInlineLinkPlainText } from './tasks_graph_core.js';
import {
    TASKS_CARD_STATE_ATTR, TASKS_DERIVED_METRIC_KEYS, TASKS_SPECIAL_NODE_ATTRS, collectTasksGroupDescendants,
    formatTasksMetricValue, isTasksGradientPalette, parseTasksNumericValue, tasksIsHiddenNodeMetaKey,
    tasksNodeMetaEntries, tasksNodeMetaLabel,
} from './tasks_graph_model.js';

export async function copyTasksText(text) {
    const value = String(text || '');
    if (!value) return false;
    if (navigator.clipboard?.writeText) {
        try {
            await navigator.clipboard.writeText(value);
            return true;
        } catch (_) {}
    }
    if (typeof document === 'undefined') return false;
    const input = document.createElement('textarea');
    input.value = value;
    input.setAttribute('readonly', 'readonly');
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.appendChild(input);
    input.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(input);
    return copied;
}

export function tasksIsIconifyImage(url) {
    return /^https:\/\/api\.iconify\.design\/.+\.svg(?:\?.*)?$/i.test(String(url || '').trim());
}

function escapeTasksHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function tasksInlineReferenceHtml(value, nodeLabels = {}) {
    const text = String(value || '');
    const pattern = /\[\[([^\]|\n]+)(?:\|([^\]\n]+))?\]\]/g;
    let html = '';
    let cursor = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) {
        html += escapeTasksHtml(text.slice(cursor, match.index));
        const target = match[1].trim();
        const label = String(match[2] || nodeLabels[target] || target).trim();
        const broken = nodeLabels[target] ? '' : ' vyasa-tasks-node-reference--broken';
        html += `<span class="vyasa-tasks-node-reference${broken}" data-vyasa-node-reference="${escapeTasksHtml(target)}">${escapeTasksHtml(label)}</span>`;
        cursor = pattern.lastIndex;
    }
    return html + escapeTasksHtml(text.slice(cursor));
}

export function tasksOpenDecisionEntry(node) {
    if (!node || node?.__kind__ === 'group' || node?.__kind__ === 'groupTitle') return null;
    if (node?.__checked__ === true) return null;
    const raw = node?.open_decision ?? node?.decision ?? '';
    const value = String(raw).trim();
    if (!value) return null;
    return { key: '__open_decision__', label: 'Open decision', value };
}

export function tasksGroupDetailEntries(nodeId, model) {
    if (!nodeId || !model) return [];
    const group = (model.groups || []).find((entry) => entry.id === nodeId);
    if (!group) return [];
    const excludedDerivedKeys = TASKS_DERIVED_METRIC_KEYS;
    const descendants = collectTasksGroupDescendants(nodeId, model);
    const sampleNodes = descendants.tasks.length ? descendants.tasks : descendants.groups;
    const metrics = new Map();
    const discreteColorCounts = new Map();
    const colorPalettes = model?.node_color_palettes && typeof model.node_color_palettes === 'object'
        ? model.node_color_palettes
        : {};
    for (const item of sampleNodes) {
        for (const [key, value] of Object.entries(item || {})) {
            if (tasksIsHiddenNodeMetaKey(key)) continue;
            const numeric = parseTasksNumericValue(value);
            if (numeric === null) continue;
            const stat = metrics.get(key) || { count: 0, sum: 0, min: numeric, max: numeric };
            stat.count += 1;
            stat.sum += numeric;
            stat.min = Math.min(stat.min, numeric);
            stat.max = Math.max(stat.max, numeric);
            metrics.set(key, stat);
        }
        for (const [key, palette] of Object.entries(colorPalettes)) {
            if (excludedDerivedKeys.has(String(key || '').toLowerCase()) || (String(key) === TASKS_CARD_STATE_ATTR || TASKS_SPECIAL_NODE_ATTRS.has(String(key)))) continue;
            if (!key || !palette || typeof palette !== 'object' || isTasksGradientPalette(palette)) continue;
            const rawValue = item?.[key];
            if (rawValue === null || rawValue === undefined || String(rawValue).trim() === '') continue;
            const value = String(rawValue);
            if (!(value in palette)) continue;
            if (!discreteColorCounts.has(key)) discreteColorCounts.set(key, new Map());
            const counts = discreteColorCounts.get(key);
            counts.set(value, (counts.get(value) || 0) + 1);
        }
    }
    const detailEntries = [...tasksNodeMetaEntries(group, model.node_attr_order, model.node_hidden_attrs)]
        .filter((entry) => !excludedDerivedKeys.has(String(entry?.key || '').toLowerCase()));
    if (sampleNodes.length) {
        detailEntries.push({
            key: '__child_count__',
            label: descendants.tasks.length ? 'Child items' : 'Child groups',
            value: String(sampleNodes.length),
        });
    }
    const byKey = ([left], [right]) => left.localeCompare(right);
    for (const [key, stat] of Array.from(metrics.entries()).sort(byKey)) {
        if (excludedDerivedKeys.has(String(key || '').toLowerCase())) continue;
        const label = tasksNodeMetaLabel(key);
        detailEntries.push({
            key: `range:${key}`,
            label,
            value: `${formatTasksMetricValue(stat.min)} ≤ ${label} (μ ${formatTasksMetricValue(stat.sum / Math.max(stat.count, 1))}) ≤ ${formatTasksMetricValue(stat.max)}`,
        });
    }
    for (const [key, counts] of Array.from(discreteColorCounts.entries()).sort(byKey)) {
        const summary = Array.from(counts.entries())
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([value, count]) => `${value}: ${count}`)
            .join(', ');
        detailEntries.push({ key: `counts:${key}`, label: `${tasksNodeMetaLabel(key)} Counts`, value: summary });
    }
    return detailEntries;
}

export function openTasksNodeHref(href, event = null) {
    if (!href) return;
    logTasksDebug('nodeHrefOpen:start', {
        href,
        tagName: event?.target?.tagName || '',
        pathname: window.location.pathname,
        hasMainContent: Boolean(document.getElementById('main-content')),
    });
    event?.preventDefault();
    event?.stopPropagation();
    if (href.startsWith('#')) {
        logTasksDebug('nodeHrefOpen:fragment', { href });
        document.getElementById(href.slice(1))?.scrollIntoView({ block: 'start', behavior: 'smooth' });
        window.history.pushState(null, '', href);
        return;
    }
    const [pathOnly, hash = ''] = String(href).split('#', 2);
    const isInternal = href.startsWith('/posts/') || (href.startsWith('/') && !href.startsWith('/slides/') && !href.split('/').pop().includes('.'));
    if (isInternal && window.htmx?.ajax) {
        logTasksDebug('nodeHrefOpen:htmxRequest', { href, pathOnly, hash, targetId: 'main-content' });
        const onSwap = (swapEvent) => {
            if (swapEvent.target?.id !== 'main-content') return;
            document.body.removeEventListener('htmx:afterSwap', onSwap);
            logTasksDebug('nodeHrefOpen:htmxSwap', {
                href,
                pathOnly,
                hash,
                swappedId: swapEvent.target?.id || '',
                childCount: swapEvent.target?.childElementCount ?? -1,
            });
            if (hash) {
                const fragment = `#${hash}`;
                document.getElementById(hash)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
                if (`${window.location.pathname}${window.location.search}${window.location.hash}` !== `${pathOnly}${fragment}`) {
                    window.history.pushState(null, '', `${pathOnly}${fragment}`);
                }
                return;
            }
            if (window.location.pathname !== pathOnly) {
                window.history.pushState(null, '', pathOnly);
            }
        };
        document.body.addEventListener('htmx:afterSwap', onSwap);
        window.htmx.ajax('GET', pathOnly, { target: '#main-content', swap: 'outerHTML show:window:top settle:0.1s' });
        return;
    }
    logTasksDebug('nodeHrefOpen:nativeAssign', { href, isInternal, hasHtmx: Boolean(window.htmx?.ajax) });
    window.location.assign(href);
}

export function tasksHrefSupportsPreview(href) {
    const text = String(href || '').trim();
    if (!text || /^(https?:|mailto:|tel:|vscode:|\/\/)/.test(text)) return false;
    if (text.startsWith('#') || text.startsWith('/posts/')) return true;
    if (text.startsWith('/')) return !text.split('/').pop().includes('.');
    return true;
}

export function renderTasksInlineLinks(value, options = {}) {
    const text = String(value || '');
    const interactive = options.interactive !== false;
    const onInactiveClick = typeof options.onInactiveClick === 'function' ? options.onInactiveClick : null;
    const currentPath = String(options.currentPath || '').trim();
    const nodeLabels = options.nodeLabels || {};
    const parts = [];
    const linkPart = (label, href, key) => interactive
        ? window.React.createElement('a', {
            key,
            href,
            'data-vyasa-link-preview': tasksHrefSupportsPreview(href) ? 'true' : undefined,
            'data-vyasa-link-preview-current-path': currentPath || undefined,
            onClick: (event) => openTasksNodeHref(href, event),
            style: { textDecoration: 'underline', textUnderlineOffset: '2px', color: 'inherit' },
        }, label)
        : window.React.createElement('span', {
            key,
            onClick: onInactiveClick || undefined,
            style: { textDecoration: 'none', color: 'inherit' },
        }, label);
    const appendText = (plain, offset) => {
        const pattern = /(^|\s)(https?:\/\/[^\s)]+|mailto:[^\s)]+|\/posts\/[^\s)]+|\/[^\s)]+\.[^\s)]+|(?:\.\.?\/)[^\s)]+|#[A-Za-z0-9._:-]+)/g;
        let cursor = 0;
        let raw;
        while ((raw = pattern.exec(plain)) !== null) {
            if (raw.index > cursor) parts.push(plain.slice(cursor, raw.index));
            if (raw[1]) parts.push(raw[1]);
            parts.push(linkPart(raw[2], raw[2], `raw-${offset + raw.index}`));
            cursor = pattern.lastIndex;
        }
        if (cursor < plain.length) parts.push(plain.slice(cursor));
    };
    const pattern = /\[([^\]]+)\]\(([^)\s]+(?:\s[^)]*)?)\)|\[\[([^\]|\n]+)(?:\|([^\]\n]+))?\]\]/g;
    let lastIndex = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) {
        if (match.index > lastIndex) appendText(text.slice(lastIndex, match.index), lastIndex);
        const [, label, href, targetText, displayText] = match;
        const target = String(targetText || '').trim();
        const referenceLabel = String(displayText || nodeLabels[target] || target).trim();
        parts.push(target
            ? window.React.createElement('span', {
                key: `reference-${match.index}`,
                className: `vyasa-tasks-node-reference${nodeLabels[target] ? '' : ' vyasa-tasks-node-reference--broken'}`,
                'data-vyasa-node-reference': target,
            }, referenceLabel)
            : linkPart(label, href, `${href}-${match.index}`));
        lastIndex = pattern.lastIndex;
    }
    if (lastIndex < text.length) appendText(text.slice(lastIndex), lastIndex);
    return parts.length ? parts : text;
}

function tasksValueContainsUrl(value) {
    if (value === null || value === undefined) return false;
    const text = String(value).trim();
    if (!text) return false;
    if (/\[[^\]]+\]\(([^)\s]+(?:\s[^)]*)?)\)/.test(text)) return true;
    return /(^|\s)(https?:\/\/[^\s)]+|mailto:[^\s)]+|\/posts\/[^\s)]+|\/[^\s)]+\.[^\s)]+|(?:\.\.?\/)[^\s)]+|#[A-Za-z0-9._:-]+)/.test(text);
}

function tasksExtractUrls(value) {
    if (value === null || value === undefined) return [];
    const text = String(value).trim();
    if (!text) return [];
    const urls = [];
    const markdownPattern = /\[([^\]]+)\]\(([^)\s]+(?:\s[^)]*)?)\)/g;
    let match;
    while ((match = markdownPattern.exec(text)) !== null) {
        const href = String(match[2] || '').trim();
        if (href) urls.push(href);
    }
    const rawPattern = /(^|\s)(https?:\/\/[^\s)]+|mailto:[^\s)]+|\/posts\/[^\s)]+|\/[^\s)]+\.[^\s)]+|(?:\.\.?\/)[^\s)]+|#[A-Za-z0-9._:-]+)/g;
    while ((match = rawPattern.exec(text)) !== null) {
        const href = String(match[2] || '').trim();
        if (href) urls.push(href);
    }
    return urls;
}

// A held-key graph mode claims its key only while the reader points at the
// graph and is not typing. `active` keeps the mode alive after the pointer
// leaves the graph, so releasing the key still reaches the mode that opened.
export function tasksHeldKeyApplies(event, flowWrapper, active) {
    const target = event.target instanceof Element ? event.target : null;
    const editable = target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(target.tagName));
    return !editable && Boolean(flowWrapper?.matches(':hover') || active);
}

// Code mode reads the `code` attribute of a node or an edge and hands the link
// preview an anchor for its first URL. The server already rendered that
// attribute to HTML under `__rendered_attrs__`, and only that anchor carries the
// `{show=symbol ...}` payload as `data-vyasa-code-reference`. Re-parsing the
// Markdown here would drop it and preview the whole file, so read the rendered
// anchor first and fall back to the raw text only when the render step is off.
export function tasksCodeAttributeLinks(record) {
    if (!record) return [];
    const key = Object.keys(record).find((name) => String(name).toLowerCase() === 'code');
    if (!key) return [];
    const rendered = record.__rendered_attrs__?.[key];
    const links = [];
    for (const html of (Array.isArray(rendered) ? rendered : [rendered])) {
        if (typeof html !== 'string' || !html.trim()) continue;
        const holder = document.createElement('div');
        holder.innerHTML = html;
        links.push(...holder.querySelectorAll('a[href]'));
    }
    if (links.length) return links;
    return (Array.isArray(record[key]) ? record[key] : [record[key]])
        .flatMap(tasksExtractUrls)
        .map((href) => {
            const anchor = document.createElement('a');
            anchor.setAttribute('href', href);
            return anchor;
        });
}

export function tasksCodeAttributeLink(record) {
    return tasksCodeAttributeLinks(record)[0] || null;
}

export function tasksGroupCodeLinks(links) {
    const groups = [];
    const byHref = new Map();
    links.forEach((link, index) => {
        const href = link.getAttribute('href') || '';
        if (byHref.has(href)) byHref.get(href).links.push(link);
        else {
            const group = { href, links: [link], index };
            groups.push(group);
            byHref.set(href, group);
        }
    });
    return groups;
}

function tasksHrefKind(href) {
    const text = String(href || '').trim();
    if (!text) return '';
    if (/^(https?:)?\/\//.test(text) || text.startsWith('mailto:')) return 'external';
    return 'internal';
}

export function tasksNodeLinkKinds(node) {
    const kinds = new Set();
    if (!node || typeof node !== 'object') return kinds;
    for (const href of tasksExtractUrls(node.href)) {
        const kind = tasksHrefKind(href);
        if (kind) kinds.add(kind);
    }
    for (const [key, value] of Object.entries(node)) {
        if (tasksIsHiddenNodeMetaKey(key)) continue;
        if (!(typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')) continue;
        for (const href of tasksExtractUrls(value)) {
            const kind = tasksHrefKind(href);
            if (kind) kinds.add(kind);
        }
    }
    return kinds;
}

export function renderTasksNodeLinkBadge(React, options = {}) {
    const kinds = Array.isArray(options.kinds) ? options.kinds : [];
    if (!kinds.length) return null;
    return React.createElement('span', {
        className: 'vyasa-task-link-badge',
        'aria-hidden': 'true',
        title: options.title || undefined,
        style: {
            position: 'absolute',
            top: options.top || '8px',
            right: options.right || '10px',
            bottom: options.bottom || undefined,
        },
    }, ...kinds.map((kind) => React.createElement('span', {
        key: kind,
        'uk-icon': kind === 'external' ? 'link-external' : (kind === 'note' ? 'file-text' : 'link'),
    })));
}

export function renderTasksCardNodeIcon(React, node, model, options = {}) {
    const size = Number(options.size) || 22;
    const image = normalizeTasksNodeImageUrl(node?.__node_image__ || resolveTasksNodeImage(node, model));
    const style = { width: `${size}px`, height: `${size}px`, flex: '0 0 auto', ...options.style };
    if (image) return React.createElement('img', {
        src: image,
        alt: '',
        loading: 'lazy',
        draggable: false,
        className: tasksIsIconifyImage(image) ? 'vyasa-tasks-node-image vyasa-tasks-node-image--icon' : 'vyasa-tasks-node-image',
        style: { ...style, objectFit: 'contain' },
    });
    return React.createElement('span', {
        'uk-icon': node?.__kind__ === 'group' || node?.__kind__ === 'groupTitle' ? 'folder' : 'file-text',
        'aria-hidden': 'true',
        style: { ...style, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', opacity: 0.68 },
    });
}

function tasksDetailPanelWidth(options = {}) {
    const title = options.title || '';
    const nodeId = options.nodeId || '';
    const entries = Array.isArray(options.entries) ? options.entries : [];
    const titleFont = options.titleFont || '700 14px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    const bodyFont = options.bodyFont || '500 12px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    const keyFont = options.keyFont || '700 12px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    const titleWidth = measureTextWidth(tasksInlineLinkPlainText(title), titleFont);
    const idWidth = nodeId ? measureTextWidth(nodeId, bodyFont) + 20 : 0;
    const rowWidths = entries.map((entry) => {
        const keyWidth = measureTextWidth(entry?.label || '', keyFont);
        const rawValue = String(entry?.value || '');
        const lines = rawValue.split(/\r?\n/).filter(Boolean);
        const firstLine = lines[0] || '';
        const widestLine = lines.reduce((widest, line) => measureTextWidth(line, bodyFont) > measureTextWidth(widest, bodyFont) ? line : widest, firstLine);
        const contentLine = rawValue.length > 120 ? widestLine : firstLine;
        const valueWidth = Math.min(measureTextWidth(contentLine, bodyFont), 520);
        const weight = rawValue.length > 180 ? 0.82 : rawValue.length > 72 ? 0.6 : rawValue.length > 36 ? 0.72 : 0.9;
        return Math.max(keyWidth, valueWidth * weight);
    }).sort((left, right) => left - right);
    const weightedWidth = rowWidths.length ? rowWidths[Math.max(0, Math.floor(rowWidths.length * 0.72) - 1)] : 0;
    const imageReserve = options.hasImage ? 34 : 0;
    const headerWidth = options.stackHeader
        ? Math.max(titleWidth + imageReserve, idWidth) + 44
        : titleWidth + idWidth + imageReserve + 44;
    return Math.round(Math.min(options.maxWidth || 720, Math.max(options.minWidth || 280, headerWidth, weightedWidth + 136)));
}

function tasksNoteEditorMetrics(note, font = '500 14px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif') {
    const text = String(note || '').replace(/\r\n/g, '\n');
    const lines = text.split('\n');
    const widestLine = lines.reduce((widest, line) => (
        measureTextWidth(line, font) > measureTextWidth(widest, font) ? line : widest
    ), '');
    return {
        width: Math.round(Math.min(640, Math.max(360, measureTextWidth(widestLine || 'Notes', font) + 92))),
        lines: Math.max(4, lines.length),
    };
}

function renderTasksNoteTextarea(React, options = {}) {
    const value = String(options.value || '');
    return React.createElement('textarea', {
        ref: options.ref,
        'data-vyasa-task-control': 'true',
        'aria-label': options.ariaLabel || 'Notes',
        autoFocus: options.autoFocus === true,
        value,
        placeholder: 'Notes',
        readOnly: options.readOnly === true,
        rows: Math.min(15, tasksNoteEditorMetrics(value).lines),
        onChange: options.onChange,
        onKeyDown: (event) => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            event.stopPropagation();
            event.currentTarget.blur();
        },
        onPointerDown: (event) => event.stopPropagation(),
        style: {
            width: '100%',
            minHeight: '76px',
            maxHeight: 'calc(1.35em * 15 + 16px)',
            resize: options.readOnly ? 'none' : 'vertical',
            overflowY: 'auto',
            border: '1px solid color-mix(in srgb, var(--vyasa-ink) 18%, transparent)',
            borderRadius: '8px',
            background: 'color-mix(in srgb, var(--vyasa-paper) 94%, transparent)',
            color: 'var(--vyasa-ink)',
            fontSize: '14px',
            lineHeight: 1.35,
            padding: '8px',
            boxSizing: 'border-box',
        },
    });
}

export function renderTasksCardNoteEditor(React, options = {}) {
    const value = String(options.value || '');
    return React.createElement('label', { style: {
        display: 'flex', flexDirection: 'column', gap: '6px',
        paddingTop: options.separated ? '10px' : 0,
        marginTop: options.separated ? '10px' : 0,
        borderTop: options.separated ? '1px dashed color-mix(in srgb, currentColor 18%, transparent)' : 'none',
    } },
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '6px' } },
            React.createElement('span', { style: { fontWeight: 700, opacity: 0.7, flex: '1 1 auto' } }, 'Notes'),
            options.onUndo && options.clearedValue ? React.createElement('button', {
                type: 'button', 'data-vyasa-task-control': 'true', onClick: options.onUndo,
                style: { border: 'none', background: 'none', cursor: 'pointer', fontSize: '11px', color: 'var(--vyasa-primary)', fontWeight: 600, padding: 0, lineHeight: 1, opacity: 0.85 },
            }, 'Undo') : null,
            options.onClear && value.trim() ? React.createElement('button', {
                type: 'button', title: 'Clear note', 'aria-label': 'Clear note',
                'data-vyasa-task-control': 'true', onClick: options.onClear,
                style: { border: 'none', background: 'none', cursor: 'pointer', fontSize: '13px', color: 'inherit', padding: 0, lineHeight: 1, opacity: 0.45, display: 'flex', alignItems: 'center' },
            }, '×') : null,
        ),
        renderTasksNoteTextarea(React, options)
    );
}

export function renderTasksCardDetailsAndNotes(React, options = {}) {
    const props = options.props || {};
    const className = [props.className, options.scrollMode ? 'vyasa-tasks-pulse' : ''].filter(Boolean).join(' ') || undefined;
    return React.createElement('div', {
        ...props,
        className,
        style: { pointerEvents: 'auto', minHeight: 0, maxHeight: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column', ...props.style },
    },
        React.createElement('div', {
            ref: options.scrollRef,
            style: {
                flex: '1 1 auto',
                minHeight: 0,
                overflowY: 'auto',
                // Always scrollable: at scale 1 the body keeps its natural width, so
                // this only bites when a child cannot wrap into a narrow card.
                overflowX: 'auto',
                overscrollBehavior: 'contain',
                padding: '12px',
            },
        }, React.createElement('div', {
            className: 'vyasa-tasks-card-scroll-body',
            style: (options.contentScale || 1) > 1 ? { width: `${(options.contentScale || 1) * 100}%` } : undefined,
        }, options.details)),
        React.createElement('div', {
            'data-vyasa-card-notes': 'true',
            style: { flex: '0 0 auto', padding: '12px', borderTop: '1px dashed color-mix(in srgb, currentColor 18%, transparent)', background: 'color-mix(in srgb, var(--vyasa-primary) 8%, var(--vyasa-paper) 92%)', fontSize: '14px', lineHeight: 1.35 },
        }, options.notes)
    );
}

export function renderTasksDetailEntries(React, entries, options = {}) {
    return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', fontSize: options.fontSize || '14px', lineHeight: options.lineHeight || 1.35 } },
        ...(entries || []).map((entry, index) => {
            const canCopy = options.copyValues && String(entry?.value ?? '').trim();
            const urls = tasksExtractUrls(entry?.value);
            const urlOnly = urls.length === 1 && String(entry?.value || '').trim() === urls[0];
            const renderedValues = Array.isArray(entry?.renderedValue)
                ? entry.renderedValue.filter((value) => typeof value === 'string' && value)
                : (typeof entry?.renderedValue === 'string' && entry.renderedValue ? [entry.renderedValue] : []);
            const copyValue = async (event) => {
                event.preventDefault();
                event.stopPropagation();
                await copyTasksText(entry.value);
            };
            return React.createElement('div', {
                key: entry.key || entry.attr || `${index}`,
                'data-vyasa-edge-field': options.edgeFields ? (entry.key || entry.attr || '') : undefined,
                className: 'vyasa-task-node-card-row',
                style: { position: 'relative', paddingTop: index === 0 ? '0' : '8px', paddingRight: canCopy ? '26px' : 0, marginTop: index === 0 ? '0' : '8px', borderTop: index === 0 ? 'none' : '1px dashed color-mix(in srgb, currentColor 18%, transparent)', overflowWrap: 'anywhere', wordBreak: 'break-word', whiteSpace: 'pre-line' },
            },
            React.createElement('span', { style: { fontWeight: 700, opacity: 0.72, display: 'block', marginBottom: '4px' } }, `${entry.label}:`),
            urlOnly
                ? React.createElement('span', { className: 'vyasa-task-node-card-value' }, renderTasksInlineLinks(entry.value, { currentPath: options.currentPath }))
                : renderedValues.length
                ? React.createElement('span', { className: 'vyasa-task-node-card-value', style: { display: 'grid', gap: '4px' } },
                    ...renderedValues.map((renderedValue, renderedIndex) => React.createElement('span', {
                        key: `${renderedIndex}`,
                        dangerouslySetInnerHTML: { __html: renderedValue },
                    })))
                : React.createElement('span', { className: 'vyasa-task-node-card-value' }, entry.value),
            canCopy ? React.createElement('button', {
                type: 'button',
                title: 'Copy value',
                'aria-label': `Copy ${entry.label} value`,
                'data-vyasa-task-control': 'true',
                onClick: copyValue,
                className: 'vyasa-task-node-card-copy',
            }, '⧉') : null);
        }));
}
