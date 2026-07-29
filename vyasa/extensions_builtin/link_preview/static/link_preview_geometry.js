export function linkPreviewPointerPoints(sourceRect, popupRect, baseWidth = 28) {
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
    if (horizontalSide) {
        const x = dx < 0 ? popupRect.left + 1 : popupRect.left + popupRect.width - 1;
        const y = clamp(center.y + dy * Math.abs((x - center.x) / (dx || 1)),
            popupRect.top + cornerGap, popupRect.top + popupRect.height - cornerGap);
        base = { x, y };
    } else {
        const y = dy < 0 ? popupRect.top + 1 : popupRect.top + popupRect.height - 1;
        const x = clamp(center.x + dx * Math.abs((y - center.y) / (dy || 1)),
            popupRect.left + cornerGap, popupRect.left + popupRect.width - cornerGap);
        base = { x, y };
    }
    const length = Math.hypot(tip.x - base.x, tip.y - base.y) || 1;
    const offset = {
        x: -(tip.y - base.y) / length * halfBase,
        y: (tip.x - base.x) / length * halfBase,
    };
    return [
        [tip.x, tip.y],
        [base.x + offset.x, base.y + offset.y],
        [base.x - offset.x, base.y - offset.y],
    ];
}

export function resizeLinkPreviewRect(rect, edge, dx, dy, viewport, margin = 8) {
    const right = rect.left + rect.width;
    const bottom = rect.top + rect.height;
    const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
    let { left, top, width, height } = rect;
    if (edge === 'left') {
        width = clamp(rect.width - dx, 288, right - margin);
        left = right - width;
    } else if (edge === 'right') {
        width = clamp(rect.width + dx, 288, viewport.width - rect.left - margin);
    } else if (edge === 'top') {
        height = clamp(rect.height - dy, 192, bottom - margin);
        top = bottom - height;
    } else if (edge === 'bottom') {
        height = clamp(rect.height + dy, 192, viewport.height - rect.top - margin);
    }
    return { left, top, width, height };
}
