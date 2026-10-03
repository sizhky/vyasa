// Internals: docs/implementation/KG_INTERNALS/design.md. A node whose
// `internals` attr names another KG pack opens that pack inside this widget.
// Hold the internals key to peek, key+Enter to pin, key+Enter again to dive,
// Esc to close. Each
// panel holds a full KG widget, so internals nest inside internals.
import { tasksHeldKeyApplies } from './tasks_cards.js';

// The held key that opens internals. `label` names it in titles and status text.
const TASKS_INTERNALS_KEY = { code: 'Digit1', label: '1' };
const TASKS_INTERNALS_PEEK = { width: 640, height: 480, margin: 16, gap: 8 };
const TASKS_INTERNALS_DIVE_MS = 220;
// Open panels across every widget, innermost last. Esc closes only the innermost.
const openPanels = [];
// Rendered widget HTML per parent schema and ref; a second peek costs no request.
const htmlCache = new Map();

/**
 * Where a peek panel sits in its host: centred under the node when there is
 * room below, else above it, and always inside the host's margin.
 *
 * >>> tasksInternalsPeekRect({ x: 100, y: 50, width: 120, height: 40 }, { width: 900, height: 700 })
 * { left: 16, top: 98, width: 640, height: 480 }
 * >>> tasksInternalsPeekRect({ x: 400, y: 600, width: 120, height: 40 }, { width: 900, height: 700 }).top
 * 112
 */
export function tasksInternalsPeekRect(node, host, size = TASKS_INTERNALS_PEEK) {
    const width = Math.min(size.width, host.width - size.margin * 2);
    const height = Math.min(size.height, host.height - size.margin * 2);
    const roomBelow = host.height - (node.y + node.height) - size.gap - size.margin;
    const top = roomBelow >= height ? node.y + node.height + size.gap : node.y - height - size.gap;
    const clamp = (value, max) => Math.max(size.margin, Math.min(value, max));
    return {
        left: clamp(node.x + node.width / 2 - width / 2, host.width - width - size.margin),
        top: clamp(top, host.height - height - size.margin),
        width,
        height,
    };
}

/**
 * The breadcrumb and the open schemas of a panel: those of the panel that
 * holds the host, or the host's own title and schema, then this node.
 *
 * >>> tasksInternalsTrail(null, 'Transformer', '/t/kg.schema', 'Multi-Head Attention')
 * { labels: ['Transformer', 'Multi-Head Attention'], schemas: ['/t/kg.schema'] }
 */
export function tasksInternalsTrail(outer, hostTitle, hostSchema, label) {
    const labels = outer ? JSON.parse(outer.dataset.trail || '[]') : [hostTitle || 'Graph'];
    const schemas = outer ? JSON.parse(outer.dataset.schemas || '[]') : [hostSchema].filter(Boolean);
    return { labels: [...labels, label], schemas };
}

/**
 * The world outside a node: the parent's edges that cross into it and out of
 * it, one chip per neighbour, for the panel's edges. Edge labels on one
 * neighbour join with a dot.
 *
 * >>> const edges = [{ source: 'f', target: 'm', shape: 'Q' }, { source: 'f', target: 'm', shape: 'K' }, { source: 'm', target: 'a', shape: '' }];
 * >>> tasksInternalsWorld('m', edges, (id) => ({ f: 'qkv', a: 'ADD & NORM' })[id], (edge) => edge.shape)
 * { incoming: ['Q · K ← qkv'], outgoing: ['→ ADD & NORM'] }
 */
export function tasksInternalsWorld(nodeId, edges, labelOf, edgeLabelOf) {
    const sides = { incoming: new Map(), outgoing: new Map() };
    for (const edge of edges || []) {
        const side = edge.target === nodeId ? 'incoming' : (edge.source === nodeId ? 'outgoing' : '');
        if (!side) continue;
        const neighbour = String(labelOf(side === 'incoming' ? edge.source : edge.target) || (side === 'incoming' ? edge.source : edge.target));
        if (!sides[side].has(neighbour)) sides[side].set(neighbour, []);
        const label = String(edgeLabelOf(edge) || '').trim();
        if (label && !sides[side].get(neighbour).includes(label)) sides[side].get(neighbour).push(label);
    }
    const chip = (labels, arrow, neighbour) => [labels.join(' · '), arrow, neighbour].filter(Boolean).join(' ');
    return {
        incoming: Array.from(sides.incoming, ([neighbour, labels]) => chip(labels, '←', neighbour)),
        outgoing: Array.from(sides.outgoing, ([neighbour, labels]) => chip(labels, '→', neighbour)),
    };
}

async function tasksLoadInternals(schemaPath, ref) {
    const key = `${schemaPath}\n${ref}`;
    if (!htmlCache.has(key)) {
        htmlCache.set(key, fetch('/api/tasks/internals', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ schema_path: schemaPath, ref }),
        }).then(async (response) => {
            if (!response.ok) throw new Error(await response.text() || `Internals failed with ${response.status}`);
            return response.json();
        }).catch((error) => {
            htmlCache.delete(key);
            throw error;
        }));
    }
    return htmlCache.get(key);
}

// Unmount every widget inside a panel, deepest first, so each one removes its
// window listeners and closes its own panels before the DOM goes.
function tasksUnmountWidgets(element) {
    for (const mount of Array.from(element.querySelectorAll('.vyasa-tasks-flow')).reverse()) {
        mount.__vyasaTasksRoot?.unmount?.();
        delete mount.__vyasaTasksRoot;
    }
}

// One row of world chips on a panel edge, or nothing when no edge crosses it.
function tasksWorldRow(side, chips, title) {
    if (!chips.length) return '';
    return `<div class="vyasa-kg-internals-world" data-side="${side}" title="${title}"></div>`;
}

function tasksPanelElement(trail, world) {
    const element = document.createElement('div');
    element.className = 'vyasa-kg-internals';
    element.dataset.state = 'peek';
    element.dataset.trail = JSON.stringify(trail.labels);
    element.innerHTML = '<div class="vyasa-kg-internals-bar">'
        + '<span class="vyasa-kg-internals-trail"></span>'
        + `<button type="button" data-internals-action="dive" title="Dive (${TASKS_INTERNALS_KEY.label}+Enter)" aria-label="Dive into internals">⤢</button>`
        + '<button type="button" data-internals-action="close" title="Close (Esc)" aria-label="Close internals">×</button>'
        + '</div>'
        + tasksWorldRow('out', world.outgoing, 'Where this node sends its output, outside')
        + '<div class="vyasa-kg-internals-body"><div class="vyasa-kg-internals-note">Loading internals…</div></div>'
        + tasksWorldRow('in', world.incoming, 'What feeds this node, from outside');
    element.querySelector('.vyasa-kg-internals-trail').textContent = trail.labels.join(' › ');
    // Chip text is author content, so it goes in as text, never as markup.
    for (const [side, chips] of [['out', world.outgoing], ['in', world.incoming]]) {
        const row = element.querySelector(`.vyasa-kg-internals-world[data-side="${side}"]`);
        for (const text of chips) {
            const chipElement = document.createElement('span');
            chipElement.className = 'vyasa-kg-internals-chip';
            chipElement.textContent = text;
            row?.appendChild(chipElement);
        }
    }
    return element;
}

/**
 * Attach internals to one widget. Every option is read when a key arrives, so
 * the controller lives as long as the widget and never sees stale React state.
 * Returns a function that closes the open panel and removes the listeners.
 */
export function createTasksInternals({ host, flowWrapper, schemaPath, hoveredRecord, nodeElement, worldOf, mount, setStatus, log }) {
    let panel = null;
    let held = false;
    const close = () => {
        if (!panel) return;
        const { element, scrim } = panel;
        panel = null;
        for (let index = openPanels.length - 1; index >= 0; index -= 1) {
            if (element.contains(openPanels[index].element) || openPanels[index].element === element) openPanels.splice(index, 1);
        }
        tasksUnmountWidgets(element);
        element.remove();
        scrim?.remove();
        log('internalsClose', {});
    };
    const placePeek = (element, nodeId) => {
        const hostBox = host.getBoundingClientRect();
        const nodeBox = nodeElement(nodeId)?.getBoundingClientRect();
        const node = nodeBox
            ? { x: nodeBox.left - hostBox.left, y: nodeBox.top - hostBox.top, width: nodeBox.width, height: nodeBox.height }
            : { x: hostBox.width / 2, y: TASKS_INTERNALS_PEEK.margin, width: 0, height: 0 };
        const rect = tasksInternalsPeekRect(node, { width: hostBox.width, height: hostBox.height });
        Object.assign(element.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
    };
    // The panel changes size between peek and dive. Resize first so the inner
    // widget lays out at its final size, then play the move as one transform.
    const setState = (state) => {
        if (!panel || panel.state === state) return;
        const { element } = panel;
        const first = element.getBoundingClientRect();
        panel.state = state;
        element.dataset.state = state;
        if (state === 'dive') {
            panel.peekStyle = element.getAttribute('style') || '';
            element.removeAttribute('style');
            panel.scrim = document.createElement('div');
            panel.scrim.className = 'vyasa-kg-internals-scrim';
            host.insertBefore(panel.scrim, element);
        } else if (panel.peekStyle !== undefined) {
            element.setAttribute('style', panel.peekStyle);
            panel.scrim?.remove();
            panel.scrim = null;
        }
        window.dispatchEvent(new Event('resize'));
        const last = element.getBoundingClientRect();
        if (last.width && last.height) {
            element.animate([
                { transformOrigin: 'top left', transform: `translate(${first.left - last.left}px, ${first.top - last.top}px) scale(${first.width / last.width}, ${first.height / last.height})` },
                { transformOrigin: 'top left', transform: 'none' },
            ], { duration: TASKS_INTERNALS_DIVE_MS, easing: 'cubic-bezier(0.2, 0, 0, 1)' });
        }
        const innerId = element.querySelector('.tasks-container[data-tasks-widget="true"]')?.id;
        if (innerId) window.setTimeout(() => window.runTasksHeaderAction?.(innerId, 'fit'), TASKS_INTERNALS_DIVE_MS);
        setStatus(state === 'dive' ? 'Inside internals. Esc steps out.' : `Internals pinned. ${TASKS_INTERNALS_KEY.label}+Enter dives in, Esc closes.`);
        log('internalsState', { state });
    };
    const open = async (record) => {
        const ref = String(record?.internals ?? '').trim();
        if (!ref) {
            if (record) setStatus('No internals here. Point at a node with the internals badge.');
            return;
        }
        const nodeId = String(record.id || '');
        if (panel?.nodeId === nodeId) return;
        close();
        const outer = host.closest('.vyasa-kg-internals');
        const trail = tasksInternalsTrail(outer, host.dataset.tasksTitle, schemaPath(), String(record.label || nodeId));
        const element = tasksPanelElement(trail, worldOf(nodeId));
        placePeek(element, nodeId);
        host.appendChild(element);
        element.addEventListener('click', (event) => {
            const action = event.target?.closest?.('[data-internals-action]')?.dataset.internalsAction;
            if (action === 'close') close();
            if (action === 'dive') setState(panel?.state === 'dive' ? 'pinned' : 'dive');
        });
        const opened = { element, nodeId, state: 'peek', scrim: null };
        opened.advance = () => setState(opened.state === 'peek' ? 'pinned' : 'dive');
        panel = opened;
        openPanels.push(opened);
        log('internalsOpen', { nodeId, ref });
        const body = element.querySelector('.vyasa-kg-internals-body');
        try {
            const payload = await tasksLoadInternals(schemaPath(), ref);
            if (panel !== opened) return;
            // A pack already open above would open itself forever.
            if (trail.schemas.includes(payload.schema_path)) {
                body.firstElementChild.textContent = 'This pack is already open above this one.';
                return;
            }
            element.dataset.schemas = JSON.stringify([...trail.schemas, payload.schema_path]);
            body.innerHTML = payload.html;
            mount(body);
            setStatus(`Internals open. Release ${TASKS_INTERNALS_KEY.label} to close, ${TASKS_INTERNALS_KEY.label}+Enter to pin.`);
        } catch (error) {
            if (panel === opened) body.firstElementChild.textContent = error instanceof Error ? error.message : String(error);
        }
    };
    const editableTarget = (event) => event.target instanceof Element
        && Boolean(event.target.closest('input, textarea, select, [contenteditable="true"]'));
    const onKeyDown = (event) => {
        if (event.key === 'Escape' && panel && openPanels[openPanels.length - 1] === panel && !editableTarget(event)) {
            event.preventDefault();
            event.stopImmediatePropagation();
            close();
            return;
        }
        if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
        if (event.code === TASKS_INTERNALS_KEY.code) {
            if (!tasksHeldKeyApplies(event, flowWrapper(), held)) return;
            event.preventDefault();
            event.stopPropagation();
            if (event.repeat) return;
            held = true;
            open(hoveredRecord());
            return;
        }
        // Key+Enter advances this widget's panel, or, from inside a pinned panel
        // with nothing of its own open, the panel that holds this widget.
        if (event.key === 'Enter' && held) {
            const outer = host.closest('.vyasa-kg-internals');
            const target = panel || openPanels.find((entry) => entry.element === outer);
            if (!target) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            target.advance();
        }
    };
    const onKeyUp = (event) => {
        if (event.code !== TASKS_INTERNALS_KEY.code || !held) return;
        held = false;
        if (panel?.state === 'peek') close();
    };
    const onBlur = () => {
        held = false;
        if (panel?.state === 'peek') close();
    };
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    window.addEventListener('blur', onBlur);
    return () => {
        close();
        window.removeEventListener('keydown', onKeyDown, true);
        window.removeEventListener('keyup', onKeyUp, true);
        window.removeEventListener('blur', onBlur);
    };
}
