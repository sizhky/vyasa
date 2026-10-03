// Floating panels: docs/implementation/KG_INTERNALS/design.md (Floating panels).
// One owner for how a popup moves, resizes and remembers its size and place.
// Link previews float in the viewport; KG internals panels float in their host
// widget. A caller names a storage prefix and a box, the client rect of the
// space the panel floats in. Every panel rect here is relative to that box.

const PANEL_HANDLE_EDGES = ['top', 'right', 'bottom', 'left', 'top-left', 'top-right', 'bottom-right', 'bottom-left'];
const PANEL_MIN_SIZE = { width: 288, height: 192 };
const PANEL_HANDLE_CSS = `
.vyasa-panel-resize-handle { position: absolute; z-index: 4; touch-action: none; }
.vyasa-panel-resize-handle.is-top, .vyasa-panel-resize-handle.is-bottom { right: 0; left: 0; height: 8px; cursor: ns-resize; }
.vyasa-panel-resize-handle.is-top { top: 0; }
.vyasa-panel-resize-handle.is-bottom { bottom: 0; }
.vyasa-panel-resize-handle.is-left, .vyasa-panel-resize-handle.is-right { top: 8px; bottom: 8px; width: 8px; cursor: ew-resize; }
.vyasa-panel-resize-handle.is-left { left: 0; }
.vyasa-panel-resize-handle.is-right { right: 0; }
.vyasa-panel-resize-handle.is-top-left, .vyasa-panel-resize-handle.is-top-right,
.vyasa-panel-resize-handle.is-bottom-left, .vyasa-panel-resize-handle.is-bottom-right { width: 12px; height: 12px; }
.vyasa-panel-resize-handle.is-top-left { top: 0; left: 0; cursor: nwse-resize; }
.vyasa-panel-resize-handle.is-top-right { top: 0; right: 0; cursor: nesw-resize; }
.vyasa-panel-resize-handle.is-bottom-left { bottom: 0; left: 0; cursor: nesw-resize; }
.vyasa-panel-resize-handle.is-bottom-right { right: 0; bottom: 0; cursor: nwse-resize; }
`;

// The handles carry their own rules, so every caller gets the same handles
// without loading another stylesheet.
function ensurePanelStyles() {
    if (typeof document === 'undefined' || document.getElementById('vyasa-panel-styles')) return;
    const style = document.createElement('style');
    style.id = 'vyasa-panel-styles';
    style.textContent = PANEL_HANDLE_CSS;
    document.head.appendChild(style);
}

/**
 * Size and place memory under one localStorage prefix: `<prefix>-width`,
 * `<prefix>-height` and `<prefix>-position`. The last resized size and the
 * last dragged place are the defaults for the next panel, clamped to its box.
 *
 * >>> const memory = createPanelMemory('p', { getItem: (key) => (key === 'p-width' ? '500' : null), setItem() {} });
 * >>> memory.preferredWidth(640, 400)
 * 376
 */
export function createPanelMemory(prefix, storage = globalThis.localStorage) {
    const read = (key) => {
        try { return storage?.getItem(`${prefix}-${key}`) ?? null; } catch (_) { return null; }
    };
    const write = (key, value) => {
        try { storage?.setItem(`${prefix}-${key}`, value); } catch (_) {}
    };
    const positive = (text) => {
        const value = Number(text);
        return text !== null && Number.isFinite(value) && value > 0 ? value : null;
    };
    const storedPosition = () => {
        try {
            const { left, top } = JSON.parse(read('position') || 'null') || {};
            return Number.isFinite(left) && Number.isFinite(top) ? { left, top } : null;
        } catch (_) {
            return null;
        }
    };
    let width = positive(read('width'));
    let height = positive(read('height'));
    let position = storedPosition();
    return {
        rememberWidth(value) {
            if (!Number.isFinite(value) || value <= 0) return;
            width = value;
            write('width', String(value));
        },
        rememberHeight(value) {
            if (!Number.isFinite(value) || value <= 0) return;
            height = value;
            write('height', String(value));
        },
        preferredWidth(fallback, boxWidth, margin = 12) {
            return Math.min(width ?? fallback, boxWidth - margin * 2);
        },
        preferredHeight(fallback, boxHeight, margin = 12) {
            return Math.min(height ?? fallback, boxHeight - margin * 2);
        },
        rememberPosition(left, top) {
            if (!Number.isFinite(left) || !Number.isFinite(top)) return;
            position = { left, top };
            write('position', JSON.stringify(position));
        },
        storedPosition() {
            return position;
        },
        // While an anchor panel stays open, the next one steps to its bottom
        // right. Otherwise the last dragged place wins, then the fallback.
        preferredPosition(fallback, size, box, anchor = null, margin = 12, step = 26) {
            const base = anchor ? { left: anchor.left + step, top: anchor.top + step } : position ?? fallback;
            const clamp = (value, low, high) => Math.min(Math.max(value, low), Math.max(low, high));
            return {
                left: clamp(base.left, margin, box.width - size.width - margin),
                top: clamp(base.top, margin, box.height - size.height - margin),
            };
        },
    };
}

/**
 * The rect a panel takes when one edge or corner is dragged by (dx, dy),
 * kept inside its box and above the minimum size.
 *
 * >>> resizePanelRect({ left: 100, top: 100, width: 400, height: 300 }, 'left', 100, 0, { width: 1000, height: 800 })
 * { left: 200, top: 100, width: 300, height: 300 }
 */
export function resizePanelRect(rect, edge, dx, dy, box, margin = 8, min = PANEL_MIN_SIZE) {
    const right = rect.left + rect.width;
    const bottom = rect.top + rect.height;
    const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
    let { left, top, width, height } = rect;
    if (edge.includes('left')) {
        width = clamp(rect.width - dx, min.width, right - margin);
        left = right - width;
    } else if (edge.includes('right')) {
        width = clamp(rect.width + dx, min.width, box.width - rect.left - margin);
    }
    if (edge.includes('top')) {
        height = clamp(rect.height - dy, min.height, bottom - margin);
        top = bottom - height;
    } else if (edge.includes('bottom')) {
        height = clamp(rect.height + dy, min.height, box.height - rect.top - margin);
    }
    return { left, top, width, height };
}

// A panel's rect relative to its box.
export function panelRect(panel, box) {
    const rect = panel.getBoundingClientRect();
    return { left: rect.left - box.left, top: rect.top - box.top, width: rect.width, height: rect.height };
}

function applyPanelRect(panel, rect) {
    for (const key of ['left', 'top', 'width', 'height']) {
        if (Number.isFinite(rect[key])) panel.style[key] = `${rect[key]}px`;
    }
}

/**
 * Edge and corner handles that resize a panel inside its box.
 * `box()` returns the box's client rect; `onResize(rect, edge)` sees each step.
 */
export function installPanelResize(panel, { box, raise = () => {}, onResize = () => {} }) {
    ensurePanelStyles();
    for (const edge of PANEL_HANDLE_EDGES) {
        const handle = document.createElement('div');
        handle.className = `vyasa-panel-resize-handle is-${edge}`;
        handle.dataset.resizeEdge = edge;
        let start = null;
        handle.addEventListener('pointerdown', (event) => {
            if (event.button !== 0) return;
            start = { id: event.pointerId, x: event.clientX, y: event.clientY, rect: panelRect(panel, box()) };
            handle.setPointerCapture(event.pointerId);
            raise();
            event.preventDefault();
            event.stopPropagation();
        });
        handle.addEventListener('pointermove', (event) => {
            if (!start || start.id !== event.pointerId) return;
            const rect = resizePanelRect(start.rect, edge, event.clientX - start.x, event.clientY - start.y, box());
            applyPanelRect(panel, rect);
            onResize(rect, edge);
        });
        const finish = (event) => {
            if (!start || start.id !== event.pointerId) return;
            start = null;
            if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
        };
        handle.addEventListener('pointerup', finish);
        handle.addEventListener('pointercancel', finish);
        panel.appendChild(handle);
    }
}

/**
 * Drag a panel by its bar inside its box. Only a real drag calls
 * `onDrop(rect)`, so a plain click on the bar never moves later panels.
 */
export function installPanelDrag(bar, panel, { box, raise = () => {}, onMove = () => {}, onDrop = () => {}, ignore = 'button,a', margin = 8 }) {
    let drag = null;
    bar.addEventListener('pointerdown', (event) => {
        if (event.button !== 0 || event.target.closest(ignore)) return;
        drag = { id: event.pointerId, x: event.clientX, y: event.clientY, rect: panelRect(panel, box()) };
        bar.setPointerCapture(event.pointerId);
        raise();
        event.preventDefault();
    });
    bar.addEventListener('pointermove', (event) => {
        if (!drag || drag.id !== event.pointerId) return;
        const area = box();
        const left = Math.min(area.width - drag.rect.width - margin, drag.rect.left + event.clientX - drag.x);
        const top = Math.min(area.height - drag.rect.height - margin, drag.rect.top + event.clientY - drag.y);
        applyPanelRect(panel, { left: Math.max(margin, left), top: Math.max(margin, top) });
        drag.moved = true;
        onMove();
    });
    const finish = (event) => {
        if (!drag || drag.id !== event.pointerId) return;
        if (drag.moved) onDrop(panelRect(panel, box()));
        drag = null;
        if (bar.hasPointerCapture(event.pointerId)) bar.releasePointerCapture(event.pointerId);
    };
    bar.addEventListener('pointerup', finish);
    bar.addEventListener('pointercancel', finish);
}

// The viewport as a box, for panels that float over the page.
export function viewportPanelBox() {
    return { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
}
