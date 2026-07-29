export function linkPreviewPointerPoints(sourceRect, popupRect, baseWidth = 16) {
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
    if (horizontalSide) {
        const x = dx < 0 ? popupRect.left + 1 : popupRect.left + popupRect.width - 1;
        const y = clamp(center.y + dy * Math.abs((x - center.x) / (dx || 1)),
            popupRect.top + cornerGap, popupRect.top + popupRect.height - cornerGap);
        return [[tip.x, tip.y], [x, y - halfBase], [x, y + halfBase]];
    }
    const y = dy < 0 ? popupRect.top + 1 : popupRect.top + popupRect.height - 1;
    const x = clamp(center.x + dx * Math.abs((y - center.y) / (dy || 1)),
        popupRect.left + cornerGap, popupRect.left + popupRect.width - cornerGap);
    return [[tip.x, tip.y], [x - halfBase, y], [x + halfBase, y]];
}
