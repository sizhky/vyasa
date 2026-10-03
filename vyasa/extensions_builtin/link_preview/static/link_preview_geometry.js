import { createPanelMemory, resizePanelRect } from '../../../static/floating_panel.js';

// Width, height and the dragged place live in the shared panel memory under the
// keys link previews always used: vyasa-link-preview-width, -height, -position.
const memory = createPanelMemory('vyasa-link-preview');

export function rememberLinkPreviewWidth(width) {
    memory.rememberWidth(width);
}

export function linkPreviewPreferredWidth(fallback, viewportWidth, margin = 12) {
    return memory.preferredWidth(fallback, viewportWidth, margin);
}

export function rememberLinkPreviewHeight(height) {
    memory.rememberHeight(height);
}

export function linkPreviewPreferredHeight(fallback, viewportHeight, margin = 12) {
    return memory.preferredHeight(fallback, viewportHeight, margin);
}

export function rememberLinkPreviewPosition(left, top) {
    memory.rememberPosition(left, top);
}

export function linkPreviewStoredPosition() {
    return memory.storedPosition();
}

// A dragged popup decides where the next one opens. While that popup stays open,
// the next one steps to its bottom right. After it closes, its last place stays
// the default. Without a drag, the popup opens at the pointer as before.
export function linkPreviewPreferredPosition(fallback, size, viewport, anchor = null, margin = 12, step = 26) {
    return memory.preferredPosition(fallback, size, viewport, anchor, margin, step);
}

export function installLinkPreviewPanTracking(target, refresh) {
    target.addEventListener('pointermove', refresh, true);
    target.addEventListener('wheel', refresh, true);
}

// User-selected membrane profile (2026-09-21): z(r) = k ln(R/r).
export function linkPreviewDimpleDisplacement(nx, ny) {
    const distance = Math.hypot(nx, ny);
    if (distance === 0 || distance >= 1) return [0.5, 0.5];
    const tension = Math.min(0.48, 0.55 * Math.log(1 / Math.max(distance, 0.001)));
    return [
        0.5 + (nx / distance) * tension,
        0.5 + (ny / distance) * tension,
    ];
}

export function linkPreviewDimplePath({ side, x, y, halfWidth, depth }) {
    if (side === 'inside') return '';
    const shoulder = halfWidth * 0.72;
    const commands = side === 'top'
        ? [`M ${x - halfWidth} ${y}`, `C ${x - shoulder} ${y}, ${x - shoulder} ${y + depth}, ${x} ${y + depth}`, `C ${x + shoulder} ${y + depth}, ${x + shoulder} ${y}, ${x + halfWidth} ${y}`, 'Z']
        : side === 'bottom'
            ? [`M ${x - halfWidth} ${y}`, `C ${x - shoulder} ${y}, ${x - shoulder} ${y - depth}, ${x} ${y - depth}`, `C ${x + shoulder} ${y - depth}, ${x + shoulder} ${y}, ${x + halfWidth} ${y}`, 'Z']
            : side === 'left'
                ? [`M ${x} ${y - halfWidth}`, `C ${x} ${y - shoulder}, ${x + depth} ${y - shoulder}, ${x + depth} ${y}`, `C ${x + depth} ${y + shoulder}, ${x} ${y + shoulder}, ${x} ${y + halfWidth}`, 'Z']
                : [`M ${x} ${y - halfWidth}`, `C ${x} ${y - shoulder}, ${x - depth} ${y - shoulder}, ${x - depth} ${y}`, `C ${x - depth} ${y + shoulder}, ${x} ${y + shoulder}, ${x} ${y + halfWidth}`, 'Z'];
    return commands.join(' ');
}

export function linkPreviewPointerGeometry(sourceRect, popupRect, baseWidth = 28, overlap = 2, options = {}) {
    const tip = {
        x: sourceRect.left + sourceRect.width / 2,
        y: sourceRect.top + sourceRect.height / 2,
    };
    const center = {
        x: popupRect.left + popupRect.width / 2,
        y: popupRect.top + popupRect.height / 2,
    };
    const dx = tip.x - center.x;
    const dy = tip.y - center.y;
    const halfWidth = Math.max(1, popupRect.width / 2);
    const halfHeight = Math.max(1, popupRect.height / 2);
    const sourceInside = tip.x >= popupRect.left && tip.x <= popupRect.left + popupRect.width
        && tip.y >= popupRect.top && tip.y <= popupRect.top + popupRect.height;
    if (sourceInside || options.preferDimple) {
        if (sourceInside) {
            return {
                kind: 'dimple-inside',
                dimple: { side: 'inside', x: tip.x, y: tip.y, radius: 24 },
                fill: [],
                outline: [],
            };
        }
        const side = Math.abs(dx) / halfWidth >= Math.abs(dy) / halfHeight
            ? dx < 0 ? 'left' : 'right'
            : dy < 0 ? 'top' : 'bottom';
        const halfDimple = Math.max(20, baseWidth);
        const horizontal = side === 'top' || side === 'bottom';
        const coordinate = horizontal
            ? Math.min(popupRect.left + popupRect.width - halfDimple - 12, Math.max(popupRect.left + halfDimple + 12, tip.x))
            : Math.min(popupRect.top + popupRect.height - halfDimple - 12, Math.max(popupRect.top + halfDimple + 12, tip.y));
        return {
            kind: 'dimple',
            dimple: {
                side,
                x: horizontal ? coordinate : side === 'left' ? popupRect.left : popupRect.left + popupRect.width,
                y: horizontal ? side === 'top' ? popupRect.top : popupRect.top + popupRect.height : coordinate,
                halfWidth: halfDimple,
                depth: 11,
            },
            fill: [],
            outline: [],
        };
    }
    const horizontalSide = Math.abs(dx) / halfWidth >= Math.abs(dy) / halfHeight;
    const halfBase = baseWidth / 2;
    const cornerGap = halfBase + 12;
    const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
    let base;
    let inward;
    if (horizontalSide) {
        const x = dx < 0 ? popupRect.left : popupRect.left + popupRect.width;
        const y = clamp(center.y + dy * Math.abs((x - center.x) / (dx || 1)),
            popupRect.top + cornerGap, popupRect.top + popupRect.height - cornerGap);
        base = { x, y };
        inward = { x: dx < 0 ? overlap : -overlap, y: 0 };
    } else {
        const y = dy < 0 ? popupRect.top : popupRect.top + popupRect.height;
        const x = clamp(center.x + dx * Math.abs((y - center.y) / (dy || 1)),
            popupRect.left + cornerGap, popupRect.left + popupRect.width - cornerGap);
        base = { x, y };
        inward = { x: 0, y: dy < 0 ? overlap : -overlap };
    }
    const offset = horizontalSide
        ? { x: 0, y: halfBase }
        : { x: halfBase, y: 0 };
    const outline = [
        [tip.x, tip.y],
        [base.x + offset.x, base.y + offset.y],
        [base.x - offset.x, base.y - offset.y],
    ];
    const fill = [outline[0], ...outline.slice(1).map(([x, y]) => [x + inward.x, y + inward.y])];
    return { fill, outline };
}

export function linkPreviewPointerPoints(sourceRect, popupRect, baseWidth = 28) {
    return linkPreviewPointerGeometry(sourceRect, popupRect, baseWidth).outline;
}

export function resizeLinkPreviewRect(rect, edge, dx, dy, viewport, margin = 8) {
    return resizePanelRect(rect, edge, dx, dy, viewport, margin);
}
