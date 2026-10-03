// Internals: docs/implementation/KG_INTERNALS/design.md. A node whose
// `internals` attr names another KG pack opens that pack inside this widget.
// Hold the internals key to peek, key+Enter to pin, double-tap the key to dive,
// Esc to close the topmost panel. Each panel holds a full KG widget, so
// internals nest inside internals. Panels move, resize and remember their size
// through the shared floating panel module, as link previews do.
import { tasksHeldKeyApplies } from './tasks_cards.js';
import { createPanelMemory, installPanelDrag, installPanelResize, panelRect } from '../../../static/floating_panel.js';

// The held key that opens internals. `label` names it in titles and status text.
const TASKS_INTERNALS_KEY = { code: 'Digit1', label: '1' };
const TASKS_INTERNALS_PEEK = { width: 640, height: 480, margin: 16, gap: 8 };
const TASKS_INTERNALS_DIVE_MS = 220;
// Open and close motion. A peek opens and closes on every key press, so it is
// quicker than a pinned or dived panel.
const TASKS_INTERNALS_MOTION = { open: 200, close: 150, peekOpen: 140, peekClose: 110 };
// Two presses of the key closer than this are a double tap: dive.
const TASKS_INTERNALS_DOUBLE_TAP_MS = 320;
const TASKS_INTERNALS_Z = 60;
// Open panels across every widget, topmost last. Esc closes the topmost.
const openPanels = [];
// Rendered widget HTML per parent schema and ref; a second peek costs no request.
const htmlCache = new Map();
// One size and place memory for every internals panel on every page.
const panelMemory = createPanelMemory('vyasa-kg-internals');

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
 * The transform that lays a panel over another rect, for a FLIP motion from
 * or to its node. Both rects are client rects.
 *
 * >>> tasksInternalsFlipTransform({ left: 100, top: 50, width: 120, height: 40 }, { left: 20, top: 98, width: 640, height: 480 })
 * 'translate(80px, -48px) scale(0.1875, 0.08333333333333333)'
 */
export function tasksInternalsFlipTransform(from, to) {
    if (!from?.width || !from?.height || !to?.width || !to?.height) return 'scale(0.96)';
    return `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width}, ${from.height / to.height})`;
}

function tasksReducedMotion() {
    return Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
}

// Bring a panel to the top of every open panel, for Esc and for z-order.
function tasksRaisePanel(entry) {
    const index = openPanels.indexOf(entry);
    if (index >= 0) openPanels.splice(index, 1);
    openPanels.push(entry);
    openPanels.forEach((item, order) => {
        item.element.style.zIndex = String(TASKS_INTERNALS_Z + order * 2 + 1);
        if (item.scrim) item.scrim.style.zIndex = String(TASKS_INTERNALS_Z + order * 2);
    });
}

/**
 * Attach internals to one widget. Every option is read when a key arrives, so
 * the controller lives as long as the widget and never sees stale React state.
 * Returns a function that closes this widget's panels and removes the listeners.
 */
export function createTasksInternals({ host, flowWrapper, schemaPath, hoveredRecord, nodeElement, worldOf, mount, setStatus, log }) {
    // This widget's open panels, oldest first.
    const panels = [];
    // The panel the held key opened; releasing the key closes it unless pinned.
    let peek = null;
    let held = false;
    let lastTapAt = 0;
    const hostBox = () => host.getBoundingClientRect();
    // A panel leaves the open lists at once, so keys and Esc skip it, then
    // shrinks back into its node and goes. `instant` skips the motion, for a
    // widget that is unmounting with its panels.
    const close = (entry, { instant = false } = {}) => {
        const index = panels.indexOf(entry);
        if (index < 0) return;
        panels.splice(index, 1);
        if (peek === entry) peek = null;
        for (let item = openPanels.length - 1; item >= 0; item -= 1) {
            if (entry.element.contains(openPanels[item].element)) openPanels.splice(item, 1);
        }
        log('internalsClose', { nodeId: entry.nodeId });
        const remove = () => {
            tasksUnmountWidgets(entry.element);
            entry.element.remove();
            entry.scrim?.remove();
        };
        if (instant || tasksReducedMotion() || !entry.element.isConnected) {
            remove();
            return;
        }
        const { element, scrim } = entry;
        element.style.pointerEvents = 'none';
        element.getAnimations().forEach((animation) => animation.cancel());
        const duration = entry.state === 'peek' ? TASKS_INTERNALS_MOTION.peekClose : TASKS_INTERNALS_MOTION.close;
        const to = tasksInternalsFlipTransform(nodeElement(entry.nodeId)?.getBoundingClientRect(), element.getBoundingClientRect());
        scrim?.animate([{ opacity: 1 }, { opacity: 0 }], { duration, easing: 'ease-in', fill: 'forwards' });
        element.animate([
            { transformOrigin: 'top left', transform: 'none', opacity: 1 },
            { transformOrigin: 'top left', transform: to, opacity: 0 },
        ], { duration, easing: 'cubic-bezier(0.4, 0, 1, 1)', fill: 'forwards' }).finished.then(remove, remove);
    };
    // Grow a new panel out of its node.
    const playOpen = (entry, quick) => {
        if (tasksReducedMotion()) return;
        const { element } = entry;
        const from = tasksInternalsFlipTransform(nodeElement(entry.nodeId)?.getBoundingClientRect(), element.getBoundingClientRect());
        element.animate([
            { transformOrigin: 'top left', transform: from, opacity: 0 },
            { transformOrigin: 'top left', transform: 'none', opacity: 1 },
        ], { duration: quick ? TASKS_INTERNALS_MOTION.peekOpen : TASKS_INTERNALS_MOTION.open, easing: 'cubic-bezier(0.2, 0, 0, 1)' });
    };
    const closeAll = () => [...panels].reverse().forEach((entry) => close(entry, { instant: true }));
    // A new panel opens at the remembered size. It steps from this widget's
    // last floating panel, else takes the last dragged place, else sits by its node.
    const place = (element, nodeId) => {
        const box = hostBox();
        const size = {
            width: panelMemory.preferredWidth(TASKS_INTERNALS_PEEK.width, box.width, TASKS_INTERNALS_PEEK.margin),
            height: panelMemory.preferredHeight(TASKS_INTERNALS_PEEK.height, box.height, TASKS_INTERNALS_PEEK.margin),
        };
        const nodeBox = nodeElement(nodeId)?.getBoundingClientRect();
        const node = nodeBox
            ? { x: nodeBox.left - box.left, y: nodeBox.top - box.top, width: nodeBox.width, height: nodeBox.height }
            : { x: box.width / 2, y: TASKS_INTERNALS_PEEK.margin, width: 0, height: 0 };
        const byNode = tasksInternalsPeekRect(node, box, { ...TASKS_INTERNALS_PEEK, ...size });
        const anchorEntry = [...panels].reverse().find((entry) => entry.state !== 'dive');
        const anchor = anchorEntry ? panelRect(anchorEntry.element, box) : null;
        const at = panelMemory.preferredPosition(byNode, size, box, anchor, TASKS_INTERNALS_PEEK.margin);
        Object.assign(element.style, { left: `${at.left}px`, top: `${at.top}px`, width: `${size.width}px`, height: `${size.height}px` });
    };
    // The panel changes size between floating and dive. The inner widget follows
    // its panel body (applyTasksStandaloneHeight), then the move plays as one transform.
    const setState = (entry, state) => {
        if (!entry || entry.state === state) return;
        const { element } = entry;
        const first = element.getBoundingClientRect();
        const wasDive = entry.state === 'dive';
        entry.state = state;
        element.dataset.state = state;
        if (state === 'dive') {
            entry.floatStyle = { left: element.style.left, top: element.style.top, width: element.style.width, height: element.style.height };
            Object.assign(element.style, { left: '', top: '', width: '', height: '' });
            entry.scrim = document.createElement('div');
            entry.scrim.className = 'vyasa-kg-internals-scrim';
            host.insertBefore(entry.scrim, element);
            if (!tasksReducedMotion()) entry.scrim.animate([{ opacity: 0 }, { opacity: 1 }], { duration: TASKS_INTERNALS_DIVE_MS, easing: 'ease-out' });
        } else if (wasDive) {
            Object.assign(element.style, entry.floatStyle || {});
            const scrim = entry.scrim;
            entry.scrim = null;
            if (scrim && !tasksReducedMotion()) {
                scrim.animate([{ opacity: 1 }, { opacity: 0 }], { duration: TASKS_INTERNALS_DIVE_MS, easing: 'ease-in', fill: 'forwards' }).finished.then(() => scrim.remove(), () => scrim.remove());
            } else scrim?.remove();
        }
        if (peek === entry && state !== 'peek') peek = null;
        tasksRaisePanel(entry);
        const last = element.getBoundingClientRect();
        if (state === 'dive' || wasDive) {
            if (last.width && last.height && !tasksReducedMotion()) {
                element.animate([
                    { transformOrigin: 'top left', transform: tasksInternalsFlipTransform(first, last) },
                    { transformOrigin: 'top left', transform: 'none' },
                ], { duration: TASKS_INTERNALS_DIVE_MS, easing: 'cubic-bezier(0.2, 0, 0, 1)' });
            }
            const innerId = element.querySelector('.tasks-container[data-tasks-widget="true"]')?.id;
            if (innerId) window.setTimeout(() => window.runTasksHeaderAction?.(innerId, 'fit'), TASKS_INTERNALS_DIVE_MS);
        }
        const key = TASKS_INTERNALS_KEY.label;
        setStatus(state === 'dive'
            ? 'Inside internals. Double-click the bar to float it again, Esc closes it.'
            : `Internals pinned. Drag the bar to move, an edge to resize. Double-tap ${key} to dive.`);
        log('internalsState', { nodeId: entry.nodeId, state });
    };
    // Drag and resize work only while a panel floats; a dive fills the host.
    const installFloating = (entry) => {
        const { element } = entry;
        const raise = () => tasksRaisePanel(entry);
        element.addEventListener('pointerdown', raise);
        installPanelResize(element, {
            box: hostBox,
            raise,
            onResize: (rect, edge) => {
                if (entry.state === 'peek') setState(entry, 'pinned');
                if (edge.includes('left') || edge.includes('right')) panelMemory.rememberWidth(rect.width);
                if (edge.includes('top') || edge.includes('bottom')) panelMemory.rememberHeight(rect.height);
            },
        });
        installPanelDrag(element.querySelector('.vyasa-kg-internals-bar'), element, {
            box: hostBox,
            raise,
            onMove: () => { if (entry.state === 'peek') setState(entry, 'pinned'); },
            onDrop: (rect) => panelMemory.rememberPosition(rect.left, rect.top),
        });
        element.querySelector('.vyasa-kg-internals-bar').addEventListener('dblclick', (event) => {
            if (event.target.closest('button')) return;
            setState(entry, entry.state === 'dive' ? 'pinned' : 'dive');
        });
        element.addEventListener('click', (event) => {
            const action = event.target?.closest?.('[data-internals-action]')?.dataset.internalsAction;
            if (action === 'close') close(entry);
            if (action === 'dive') setState(entry, entry.state === 'dive' ? 'pinned' : 'dive');
        });
    };
    // Fill a new panel with its widget. The request may outlive the panel.
    const load = async (entry, ref, trail) => {
        const body = entry.element.querySelector('.vyasa-kg-internals-body');
        try {
            const payload = await tasksLoadInternals(schemaPath(), ref);
            if (!panels.includes(entry)) return;
            // A pack already open above would open itself forever.
            if (trail.schemas.includes(payload.schema_path)) {
                body.firstElementChild.textContent = 'This pack is already open above this one.';
                return;
            }
            entry.element.dataset.schemas = JSON.stringify([...trail.schemas, payload.schema_path]);
            body.innerHTML = payload.html;
            mount(body);
            const key = TASKS_INTERNALS_KEY.label;
            if (entry.state === 'peek') setStatus(`Internals open. Release ${key} to close, ${key}+Enter to pin, double-tap ${key} to dive.`);
        } catch (error) {
            if (panels.includes(entry)) body.firstElementChild.textContent = error instanceof Error ? error.message : String(error);
        }
    };
    // Open a node's internals, or raise its panel when one is open. The panel
    // exists when this returns, so a quick key release still finds it.
    const open = (record, state = 'peek') => {
        const ref = String(record?.internals ?? '').trim();
        if (!ref) {
            if (record) setStatus('No internals here. Point at a node with the internals stack.');
            return null;
        }
        const nodeId = String(record.id || '');
        const existing = panels.find((entry) => entry.nodeId === nodeId);
        if (existing) {
            tasksRaisePanel(existing);
            if (state === 'dive') setState(existing, 'dive');
            return existing;
        }
        const outer = host.closest('.vyasa-kg-internals');
        const trail = tasksInternalsTrail(outer, host.dataset.tasksTitle, schemaPath(), String(record.label || nodeId));
        const element = tasksPanelElement(trail, worldOf(nodeId));
        place(element, nodeId);
        host.appendChild(element);
        const entry = { element, nodeId, state: 'peek', scrim: null, floatStyle: null };
        // Another widget's controller dives this panel through openPanels.
        entry.dive = () => setState(entry, 'dive');
        panels.push(entry);
        tasksRaisePanel(entry);
        installFloating(entry);
        log('internalsOpen', { nodeId, ref, panels: panels.length });
        if (state !== 'peek') setState(entry, state);
        // One motion: from the node straight to where the panel lands.
        element.getAnimations().forEach((animation) => animation.cancel());
        playOpen(entry, state === 'peek');
        load(entry, ref, trail);
        return entry;
    };
    // A double tap dives the hovered node's internals. With nothing of its own
    // under the pointer, it dives the panel that holds this widget.
    const dive = () => {
        const record = hoveredRecord();
        if (String(record?.internals ?? '').trim()) {
            open(record, 'dive');
            return;
        }
        const outer = host.closest('.vyasa-kg-internals');
        const outerEntry = openPanels.find((entry) => entry.element === outer);
        outerEntry?.dive?.();
    };
    const editableTarget = (event) => event.target instanceof Element
        && Boolean(event.target.closest('input, textarea, select, [contenteditable="true"]'));
    const onKeyDown = (event) => {
        const top = openPanels[openPanels.length - 1];
        if (event.key === 'Escape' && top && panels.includes(top) && !editableTarget(event)) {
            event.preventDefault();
            event.stopImmediatePropagation();
            close(top);
            return;
        }
        if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
        if (event.code === TASKS_INTERNALS_KEY.code) {
            if (!tasksHeldKeyApplies(event, flowWrapper(), held)) return;
            event.preventDefault();
            event.stopPropagation();
            if (event.repeat) return;
            held = true;
            const now = Date.now();
            const doubleTap = now - lastTapAt < TASKS_INTERNALS_DOUBLE_TAP_MS;
            lastTapAt = doubleTap ? 0 : now;
            if (doubleTap) {
                dive();
                return;
            }
            const entry = open(hoveredRecord());
            if (entry?.state === 'peek') peek = entry;
            return;
        }
        // Enter over empty canvas inside a floating panel dives that panel. Over
        // a node, Enter keeps its meaning: select it and open its notes.
        if (event.key === 'Enter' && !held && !event.repeat && !hoveredRecord() && tasksHeldKeyApplies(event, flowWrapper(), false)) {
            const outer = host.closest('.vyasa-kg-internals');
            const outerEntry = openPanels.find((entry) => entry.element === outer);
            if (outerEntry && outerEntry.state !== 'dive') {
                event.preventDefault();
                event.stopImmediatePropagation();
                outerEntry.dive();
                return;
            }
        }
        // Key+Enter pins the panel the held key opened.
        if (event.key === 'Enter' && held && peek) {
            event.preventDefault();
            event.stopImmediatePropagation();
            setState(peek, 'pinned');
        }
    };
    const onKeyUp = (event) => {
        if (event.code !== TASKS_INTERNALS_KEY.code || !held) return;
        held = false;
        if (peek?.state === 'peek') close(peek);
        peek = null;
    };
    const onBlur = () => {
        held = false;
        if (peek?.state === 'peek') close(peek);
        peek = null;
    };
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    window.addEventListener('blur', onBlur);
    return () => {
        closeAll();
        window.removeEventListener('keydown', onKeyDown, true);
        window.removeEventListener('keyup', onKeyUp, true);
        window.removeEventListener('blur', onBlur);
    };
}
