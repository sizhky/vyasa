export function clampScale(value, maxScale = 55) {
    return Math.min(Math.max(0.1, value), maxScale);
}

export function nextWheelState(state, rect, point, deltaY, maxScale = 55) {
    const mouseX = point.x - rect.left - rect.width / 2;
    const mouseY = point.y - rect.top - rect.height / 2;
    const oversizeFactor = Math.max(rect.width / Math.max(window.innerWidth || 1, 1), rect.height / Math.max(window.innerHeight || 1, 1), 1);
    const zoomIntensity = Math.min(0.01 * oversizeFactor, 0.04);
    const delta = deltaY > 0 ? 1 - zoomIntensity : 1 + zoomIntensity;
    const scale = clampScale(state.scale * delta, maxScale);
    const scaleFactor = scale / state.scale - 1;
    return {
        ...state,
        scale,
        translateX: state.translateX - mouseX * scaleFactor,
        translateY: state.translateY - mouseY * scaleFactor,
    };
}

const TASK_NODE_FONT = '600 13px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const TASK_NODE_SPECS = {
    group: { width: 250, minHeight: 80, padX: 24, padY: 20, reserveX: 24 },
    task: { width: 220, minHeight: 60, padX: 24, padY: 20, reserveX: 0 },
};

function measureTextWidth(text, font = TASK_NODE_FONT) {
    const canvas = typeof OffscreenCanvas !== 'undefined'
        ? new OffscreenCanvas(1, 1)
        : (typeof document !== 'undefined' ? document.createElement('canvas') : null);
    const ctx = canvas?.getContext?.('2d');
    if (!ctx) return text.length * 7.1;
    ctx.font = font;
    return ctx.measureText(text).width;
}

export function sizeTaskNode(label, kind = 'task') {
    const spec = TASK_NODE_SPECS[kind] || TASK_NODE_SPECS.task;
    const maxTextWidth = Math.max(32, spec.width - spec.padX - spec.reserveX);
    const lines = String(label || '')
        .split(/\r?\n/)
        .reduce((count, part) => count + Math.max(1, Math.ceil(measureTextWidth(part) / maxTextWidth)), 0);
    const textHeight = Math.max(20, lines * 16.25);
    return {
        width: spec.width,
        height: Math.max(spec.minHeight, Math.ceil(textHeight + spec.padY + 4)),
    };
}
