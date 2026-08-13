const WIDTH_STORAGE_KEY = 'vyasa-link-preview-width';

function storedPreferredWidth() {
    try {
        const width = Number(globalThis.localStorage?.getItem(WIDTH_STORAGE_KEY));
        return Number.isFinite(width) && width > 0 ? width : null;
    } catch (_) {
        return null;
    }
}

let preferredWidth = storedPreferredWidth();

export function rememberLinkPreviewWidth(width) {
    if (!Number.isFinite(width) || width <= 0) return;
    preferredWidth = width;
    try { globalThis.localStorage?.setItem(WIDTH_STORAGE_KEY, String(width)); } catch (_) {}
}

export function linkPreviewPreferredWidth(fallback, viewportWidth, margin = 12) {
    return Math.min(preferredWidth ?? fallback, viewportWidth - margin * 2);
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
