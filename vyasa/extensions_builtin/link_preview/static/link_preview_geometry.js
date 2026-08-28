const WIDTH_STORAGE_KEY = 'vyasa-link-preview-width';
const HEIGHT_STORAGE_KEY = 'vyasa-link-preview-height';
const POSITION_STORAGE_KEY = 'vyasa-link-preview-position';

// Width and height keep the same memory: the last resized value, held in local
// storage and clamped to the viewport when a new popup opens.
function createDimensionMemory(storageKey) {
    let stored = null;
    try {
        const value = Number(globalThis.localStorage?.getItem(storageKey));
        if (Number.isFinite(value) && value > 0) stored = value;
    } catch (_) {}
    return {
        remember(value) {
            if (!Number.isFinite(value) || value <= 0) return;
            stored = value;
            try { globalThis.localStorage?.setItem(storageKey, String(value)); } catch (_) {}
        },
        preferred(fallback, viewportSize, margin) {
            return Math.min(stored ?? fallback, viewportSize - margin * 2);
        },
    };
}

const widthMemory = createDimensionMemory(WIDTH_STORAGE_KEY);
const heightMemory = createDimensionMemory(HEIGHT_STORAGE_KEY);

export function rememberLinkPreviewWidth(width) {
    widthMemory.remember(width);
}

export function linkPreviewPreferredWidth(fallback, viewportWidth, margin = 12) {
    return widthMemory.preferred(fallback, viewportWidth, margin);
}

export function rememberLinkPreviewHeight(height) {
    heightMemory.remember(height);
}

export function linkPreviewPreferredHeight(fallback, viewportHeight, margin = 12) {
    return heightMemory.preferred(fallback, viewportHeight, margin);
}

function storedPreferredPosition() {
    try {
        const stored = JSON.parse(globalThis.localStorage?.getItem(POSITION_STORAGE_KEY) || 'null');
        const { left, top } = stored || {};
        return Number.isFinite(left) && Number.isFinite(top) ? { left, top } : null;
    } catch (_) {
        return null;
    }
}

let preferredPosition = storedPreferredPosition();

export function rememberLinkPreviewPosition(left, top) {
    if (!Number.isFinite(left) || !Number.isFinite(top)) return;
    preferredPosition = { left, top };
    try {
        globalThis.localStorage?.setItem(POSITION_STORAGE_KEY, JSON.stringify(preferredPosition));
    } catch (_) {}
}

export function linkPreviewStoredPosition() {
    return preferredPosition;
}

// A dragged popup decides where the next one opens. While that popup stays open,
// the next one steps to its bottom right. After it closes, its last place stays
// the default. Without a drag, the popup opens at the pointer as before.
export function linkPreviewPreferredPosition(fallback, size, viewport, anchor = null, margin = 12, step = 26) {
    const base = anchor
        ? { left: anchor.left + step, top: anchor.top + step }
        : preferredPosition ?? fallback;
    const clamp = (value, low, high) => Math.min(Math.max(value, low), Math.max(low, high));
    return {
        left: clamp(base.left, margin, viewport.width - size.width - margin),
        top: clamp(base.top, margin, viewport.height - size.height - margin),
    };
}

export function installLinkPreviewPanTracking(target, refresh) {
    target.addEventListener('pointermove', refresh, true);
    target.addEventListener('wheel', refresh, true);
}

export function linkPreviewPointerGeometry(sourceRect, popupRect, baseWidth = 28, overlap = 2) {
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
    const right = rect.left + rect.width;
    const bottom = rect.top + rect.height;
    const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
    let { left, top, width, height } = rect;
    if (edge.includes('left')) {
        width = clamp(rect.width - dx, 288, right - margin);
        left = right - width;
    } else if (edge.includes('right')) {
        width = clamp(rect.width + dx, 288, viewport.width - rect.left - margin);
    }
    if (edge.includes('top')) {
        height = clamp(rect.height - dy, 192, bottom - margin);
        top = bottom - height;
    } else if (edge.includes('bottom')) {
        height = clamp(rect.height + dy, 192, viewport.height - rect.top - margin);
    }
    return { left, top, width, height };
}
