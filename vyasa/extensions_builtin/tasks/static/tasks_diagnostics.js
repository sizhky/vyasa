window.__vyasaTasksDebug = window.__vyasaTasksDebug || { events: [] };
window.__vyasaTasksDebug.enabled = window.__vyasaTasksDebug.enabled === true || new URLSearchParams(window.location.search).has('tasks_debug');
window.__vyasaTasksDebug.verbose = window.__vyasaTasksDebug.verbose === true || new URLSearchParams(window.location.search).has('tasks_debug_verbose');
window.__vyasaTasksDebug.edgeLabelRenderCount = Number(window.__vyasaTasksDebug.edgeLabelRenderCount || 0);
window.__vyasaTasksPerf = window.__vyasaTasksPerf || {};
window.__vyasaTasksPerf.enabled = window.__vyasaTasksPerf.enabled === true || new URLSearchParams(window.location.search).has('tasks_perf');
window.__vyasaTasksPerf.pendingFrames = window.__vyasaTasksPerf.pendingFrames || new Set();
window.__vyasaTasksPerf.frameProbes = window.__vyasaTasksPerf.frameProbes || new Map();
window.__vyasaTasksPerf.fileLogReset = window.__vyasaTasksPerf.fileLogReset || new Set();
window.__vyasaTasksPerf.loggedShell = window.__vyasaTasksPerf.loggedShell || new Set();
window.__vyasaTasksPerf.loggedSurface = window.__vyasaTasksPerf.loggedSurface || new Set();
window.__vyasaTasksPerf.loggedGraphDom = window.__vyasaTasksPerf.loggedGraphDom || new Set();
if (!Array.isArray(window.__vyasaTasksDebug.watch) || window.__vyasaTasksDebug.watch.length === 0) {
    const rawWatch = new URLSearchParams(window.location.search).getAll('tasks_watch');
    window.__vyasaTasksDebug.watch = rawWatch
        .flatMap((value) => String(value || '').split(','))
        .map((value) => value.trim())
        .filter(Boolean)
        .map((value) => {
            const [source, target] = value.split('->').map((part) => part.trim());
            return source && target ? { source, target } : null;
        })
        .filter(Boolean);
}

export function renderTasksDebugOverlay() {
    if (typeof document === 'undefined') return;
    document.getElementById('vyasa-tasks-debug-log')?.remove();
}

export function logTasksDebug(label, payload = {}) {
    if (!window.__vyasaTasksDebug.enabled) return null;
    const event = {
        label,
        at: new Date().toISOString(),
        payload,
    };
    window.__vyasaTasksDebug.events.push(event);
    if (window.__vyasaTasksDebug.events.length > 200) window.__vyasaTasksDebug.events.shift();
    console.log(`[vyasa][tasks-debug] ${label} ${JSON.stringify(payload)}`);
    tasksPostFileLog(label, event.at, payload);
    renderTasksDebugOverlay();
    return event;
}

export function logTasksDebugVerbose(label, payload = {}) {
    if (!window.__vyasaTasksDebug.verbose) return null;
    return logTasksDebug(label, payload);
}

export function tasksPerfNow() {
    return window.performance ? window.performance.now() : Date.now();
}

// Ship an event to the server NDJSON log so the user can reproduce a UI
// interaction and the agent can read what happened from the file instead of
// driving the browser. Same file/key as perf logging; first write per page
// truncates it.
function tasksPostFileLog(label, at, payload = {}) {
    const host = window.location.host;
    const path = window.location.pathname;
    const key = `${host}${path}`;
    const reset = !window.__vyasaTasksPerf.fileLogReset.has(key);
    window.__vyasaTasksPerf.fileLogReset.add(key);
    const body = JSON.stringify({ label, at, host, path, reset, payload: payload || {} });
    fetch('/api/tasks/perf-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: body.length < 60000,
    }).catch(() => {});
}

export function logTasksPerf(label, payload = {}) {
    if (!window.__vyasaTasksPerf.enabled) return null;
    if (
        label !== 'frame-probe'
        && label !== 'longtask'
        && label !== 'render-context'
        && label !== 'paint-state'
        && label !== 'interaction-frame'
        && label !== 'hover-pointer'
        && label !== 'storage-error'
        && label !== 'state-transition'
    ) return null;
    const event = { label, at: new Date().toISOString(), payload };
    tasksPostFileLog(label, event.at, payload);
    console.log(`[vyasa][tasks-perf] ${label} ${JSON.stringify(payload)}`);
    return event;
}

export function tasksPerfContext(widgetId, wrapper, model, graphBase, viewState = {}) {
    return {
        widgetId,
        host: window.location.host,
        path: window.location.pathname,
        title: wrapper?.dataset?.tasksTitle || '',
        groups: (model?.groups || []).length,
        tasks: (model?.tasks || []).length,
        baseNodes: (graphBase?.nodes || []).length,
        baseEdges: (graphBase?.edges || []).length,
        viewMode: viewState.viewMode || '',
        activeProjectionId: viewState.activeProjectionId || model?.active_projection || '',
        activeColorBy: viewState.activeColorBy || '',
        activeColorHierarchy: Array.isArray(viewState.activeColorHierarchy) ? viewState.activeColorHierarchy : [],
        coloredNodes: Number.isFinite(viewState.coloredNodes) ? viewState.coloredNodes : null,
        defaultColoredNodes: Number.isFinite(viewState.defaultColoredNodes) ? viewState.defaultColoredNodes : null,
        colorOverlayNodes: Number.isFinite(viewState.colorOverlayNodes) ? viewState.colorOverlayNodes : null,
        edgesVisible: viewState.edgesVisible ?? null,
        edgeAnimationMode: viewState.edgeAnimationMode || '',
        edgeOpacity: viewState.edgeOpacity ?? null,
        unspecifiedContentOpacity: viewState.projectionUnspecifiedContentOpacity ?? null,
    };
}

function tasksPerfRect(el) {
    const rect = el?.getBoundingClientRect?.();
    if (!rect) return null;
    return {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
    };
}

function tasksPerfShellSnapshot(wrapper) {
    const ancestors = [];
    let el = wrapper;
    while (el && ancestors.length < 8) {
        const style = window.getComputedStyle?.(el);
        ancestors.push({
            tag: el.tagName?.toLowerCase?.() || '',
            id: el.id || '',
            cls: String(el.className || '').split(/\s+/).filter(Boolean).slice(0, 5).join('.'),
            rect: tasksPerfRect(el),
            position: style?.position || '',
            transform: style?.transform || '',
            filter: style?.filter || '',
            backdropFilter: style?.backdropFilter || style?.webkitBackdropFilter || '',
            contain: style?.contain || '',
            willChange: style?.willChange || '',
            overflow: `${style?.overflowX || ''}/${style?.overflowY || ''}`,
        });
        el = el.parentElement;
    }
    const selectorCounts = {};
    [
        'body',
        '#page-container',
        '#mobile-posts-panel',
        '#posts-sidebar',
        '#toc-sidebar',
        '#main-content',
        '.vyasa-sidebar-body',
        '.vyasa-tree-row',
        '.post-link',
        '.react-flow',
    ].forEach((selector) => {
        selectorCounts[selector] = document.querySelector(selector)?.getElementsByTagName('*')?.length
            ?? document.querySelectorAll(selector).length;
    });
    const subtreeCounts = Array.from(document.body?.children || []).map((child) => ({
        tag: child.tagName?.toLowerCase?.() || '',
        id: child.id || '',
        cls: String(child.className || '').split(/\s+/).filter(Boolean).slice(0, 6).join('.'),
        count: child.getElementsByTagName('*').length,
    })).sort((a, b) => b.count - a.count).slice(0, 12);
    const pageContainer = document.getElementById('page-container');
    const pageChildCounts = Array.from(pageContainer?.children || []).map((child) => ({
        tag: child.tagName?.toLowerCase?.() || '',
        id: child.id || '',
        cls: String(child.className || '').split(/\s+/).filter(Boolean).slice(0, 6).join('.'),
        count: child.getElementsByTagName('*').length,
    })).sort((a, b) => b.count - a.count).slice(0, 12);
    return {
        viewport: { width: window.innerWidth, height: window.innerHeight, dpr: window.devicePixelRatio || 1 },
        bodyClass: document.body?.className || '',
        elementCount: document.getElementsByTagName('*').length,
        selectorCounts,
        subtreeCounts,
        pageChildCounts,
        reactFlowNodes: wrapper?.querySelectorAll?.('.react-flow__node')?.length || 0,
        reactFlowEdges: wrapper?.querySelectorAll?.('.react-flow__edge')?.length || 0,
        ancestors,
    };
}

export function logTasksPerfShellOnce(widgetId, wrapper, payload = {}) {
    if (!window.__vyasaTasksPerf.enabled || !wrapper) return;
    const key = `${widgetId}:${window.location.host}:${window.location.pathname}`;
    if (window.__vyasaTasksPerf.loggedShell.has(key)) return;
    window.__vyasaTasksPerf.loggedShell.add(key);
    window.setTimeout(() => logTasksPerf('shell-context', { ...payload, ...tasksPerfShellSnapshot(wrapper) }), 120);
}

function tasksPerfElementSnapshot(el) {
    if (!el) return null;
    const style = window.getComputedStyle?.(el);
    return {
        tag: el.tagName?.toLowerCase?.() || '',
        id: el.id || '',
        cls: String(el.className || '').split(/\s+/).filter(Boolean).slice(0, 6).join('.'),
        rect: tasksPerfRect(el),
        transform: style?.transform || '',
        transformOrigin: style?.transformOrigin || '',
        overflow: `${style?.overflowX || ''}/${style?.overflowY || ''}`,
        contain: style?.contain || '',
        willChange: style?.willChange || '',
        backfaceVisibility: style?.backfaceVisibility || '',
        isolation: style?.isolation || '',
    };
}

export function tasksPerfSurfaceSnapshot(wrapper, event = null) {
    const reactFlow = wrapper?.querySelector?.('.react-flow');
    const viewport = wrapper?.querySelector?.('.react-flow__viewport');
    const pane = wrapper?.querySelector?.('.react-flow__pane');
    const target = event?.target instanceof Element ? event.target : null;
    return {
        wrapper: tasksPerfElementSnapshot(wrapper),
        reactFlow: tasksPerfElementSnapshot(reactFlow),
        viewport: tasksPerfElementSnapshot(viewport),
        pane: tasksPerfElementSnapshot(pane),
        eventTarget: tasksPerfElementSnapshot(target),
    };
}

export function logTasksPerfSurfaceOnce(widgetId, wrapper, payload = {}) {
    if (!window.__vyasaTasksPerf.enabled || !wrapper) return;
    const key = `${widgetId}:${window.location.host}:${window.location.pathname}`;
    if (window.__vyasaTasksPerf.loggedSurface.has(key)) return;
    window.__vyasaTasksPerf.loggedSurface.add(key);
    window.setTimeout(() => logTasksPerf('render-surface', { ...payload, ...tasksPerfSurfaceSnapshot(wrapper) }), 250);
}

function tasksPerfGraphDomSnapshot(wrapper) {
    const reactFlow = wrapper?.querySelector?.('.react-flow');
    const selectors = [
        '.react-flow__node',
        '.react-flow__edge',
        '.react-flow__edge-path',
        '.react-flow__edge-text',
        '.react-flow__edge-textbg',
        '.react-flow__edge-label',
        '.react-flow__handle',
        'svg',
        'path',
        'foreignObject',
        'img',
        '[style*="filter"]',
        '[style*="box-shadow"]',
        '[style*="backdrop-filter"]',
        '[class*="animate"]',
        '[class*="animation"]',
        '.vyasa-edge-dashdraw',
        '.vyasa-edge-animation-tick',
    ];
    const counts = {};
    selectors.forEach((selector) => {
        counts[selector] = reactFlow?.querySelectorAll?.(selector)?.length || 0;
    });
    const classCounts = {};
    reactFlow?.querySelectorAll?.('[class]')?.forEach((el) => {
        String(el.className || '').split(/\s+/).filter(Boolean).forEach((cls) => {
            if (cls.includes('edge') || cls.includes('node') || cls.includes('image') || cls.includes('animation')) {
                classCounts[cls] = (classCounts[cls] || 0) + 1;
            }
        });
    });
    return {
        counts,
        topClasses: Object.entries(classCounts).sort((a, b) => b[1] - a[1]).slice(0, 20),
    };
}

function tasksPerfNodePaintSnapshot(wrapper) {
    const reactFlow = wrapper?.querySelector?.('.react-flow');
    const nodes = Array.from(reactFlow?.querySelectorAll?.('.react-flow__node') || []);
    const sample = (nodeEl) => {
        const body = nodeEl.querySelector('.vyasa-task-node-body') || nodeEl.firstElementChild;
        const span = body?.querySelector?.('span');
        const nodeStyle = window.getComputedStyle?.(nodeEl);
        const bodyStyle = window.getComputedStyle?.(body);
        const textStyle = window.getComputedStyle?.(span);
        return {
            cls: String(nodeEl.className || '').split(/\s+/).filter(Boolean).join('.'),
            rect: tasksPerfRect(nodeEl),
            nodeBg: nodeStyle?.background || '',
            nodeBorder: nodeStyle?.border || '',
            nodeTransform: nodeStyle?.transform || '',
            nodeWillChange: nodeStyle?.willChange || '',
            nodeContain: nodeStyle?.contain || '',
            bodyBg: bodyStyle?.background || '',
            bodyOpacity: bodyStyle?.opacity || '',
            textFont: textStyle?.font || '',
            textTransform: textStyle?.transform || '',
        };
    };
    return {
        totalNodes: nodes.length,
        defaultNodes: nodes.filter((node) => node.textContent && !node.querySelector('svg')).length,
        svgOverlayNodes: nodes.filter((node) => node.querySelector('svg')).length,
        colorMixNodes: nodes.filter((node) => /color-mix/i.test(node.getAttribute('style') || '')).length,
        gradientNodes: nodes.filter((node) => /gradient/i.test(node.getAttribute('style') || '')).length,
        shadowNodes: nodes.filter((node) => /box-shadow/i.test(node.getAttribute('style') || '')).length,
        samples: nodes.slice(0, 6).map(sample),
    };
}

export function logTasksPerfPaintState(widgetId, wrapper, payload = {}) {
    if (!window.__vyasaTasksPerf.enabled || !wrapper) return;
    window.setTimeout(() => logTasksPerf('paint-state', {
        ...payload,
        ...tasksPerfNodePaintSnapshot(wrapper),
    }), 120);
}

export function logTasksPerfGraphDomOnce(widgetId, wrapper, payload = {}) {
    if (!window.__vyasaTasksPerf.enabled || !wrapper) return;
    const key = `${widgetId}:${window.location.host}:${window.location.pathname}`;
    if (window.__vyasaTasksPerf.loggedGraphDom.has(key)) return;
    window.__vyasaTasksPerf.loggedGraphDom.add(key);
    window.setTimeout(() => logTasksPerf('graph-dom', { ...payload, ...tasksPerfGraphDomSnapshot(wrapper) }), 350);
}

export function logTasksPerfScrollOnce(widgetId, wrapper, payload = {}) {
    if (!window.__vyasaTasksPerf.enabled || !wrapper) return;
    const key = `${widgetId}:${window.location.host}:${window.location.pathname}`;
    if (window.__vyasaTasksPerf.loggedGraphDom.has(`${key}:scroll`)) return;
    window.__vyasaTasksPerf.loggedGraphDom.add(`${key}:scroll`);
    window.setTimeout(() => logTasksPerf('scroll-context', { ...payload, ...tasksPerfScrollSnapshot(wrapper) }), 450);
}

export function tasksPerfScrollSnapshot(wrapper, event = null) {
    const target = event?.target instanceof Element ? event.target : wrapper;
    const containers = [];
    let el = target;
    while (el && containers.length < 8) {
        const style = window.getComputedStyle?.(el);
        const scrollable = /(auto|scroll|hidden|clip)/.test(`${style?.overflowX || ''} ${style?.overflowY || ''}`);
        if (scrollable || el === wrapper || el === document.body || el === document.documentElement) {
            containers.push({
                tag: el.tagName?.toLowerCase?.() || '',
                id: el.id || '',
                cls: String(el.className || '').split(/\s+/).filter(Boolean).slice(0, 6).join('.'),
                rect: tasksPerfRect(el),
                overflow: `${style?.overflowX || ''}/${style?.overflowY || ''}`,
                scrollTop: Math.round(el.scrollTop || 0),
                scrollHeight: Math.round(el.scrollHeight || 0),
                clientHeight: Math.round(el.clientHeight || 0),
                pointerEvents: style?.pointerEvents || '',
                position: style?.position || '',
            });
        }
        el = el.parentElement;
    }
    return {
        scrollX: Math.round(window.scrollX || 0),
        scrollY: Math.round(window.scrollY || 0),
        documentHeight: Math.round(document.documentElement?.scrollHeight || 0),
        viewportHeight: Math.round(window.innerHeight || 0),
        target: tasksPerfElementSnapshot(target),
        containers,
    };
}

export function tasksPerfWheelPayload(event) {
    return {
        deltaX: Math.round(Number(event?.deltaX || 0) * 10) / 10,
        deltaY: Math.round(Number(event?.deltaY || 0) * 10) / 10,
        deltaMode: event?.deltaMode ?? 0,
        ctrlKey: Boolean(event?.ctrlKey),
        metaKey: Boolean(event?.metaKey),
        shiftKey: Boolean(event?.shiftKey),
    };
}

export function traceTasksInteractionFrame(label, payload = {}) {
    if (!window.__vyasaTasksPerf.enabled || typeof window.requestAnimationFrame !== 'function') return;
    if (window.__vyasaTasksPerf.pendingFrames.has(label)) return;
    window.__vyasaTasksPerf.pendingFrames.add(label);
    const start = tasksPerfNow();
    window.requestAnimationFrame((frameAt) => {
        window.__vyasaTasksPerf.pendingFrames.delete(label);
        const frameDelayMs = Math.round((frameAt - start) * 10) / 10;
        if (frameDelayMs >= 24) logTasksPerf('interaction-frame', { label, frameDelayMs, ...payload });
    });
}

export function startTasksLongTaskObserver() {
    if (!window.__vyasaTasksPerf.enabled || window.__vyasaTasksPerf.longTaskObserverStarted) return;
    if (typeof PerformanceObserver === 'undefined') return;
    window.__vyasaTasksPerf.longTaskObserverStarted = true;
    try {
        const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                logTasksPerf('longtask', {
                    startTime: Math.round(entry.startTime * 10) / 10,
                    durationMs: Math.round(entry.duration * 10) / 10,
                    name: entry.name || '',
                    attribution: Array.from(entry.attribution || []).map((item) => ({
                        name: item.name || '',
                        type: item.entryType || '',
                        containerType: item.containerType || '',
                    })),
                });
            }
        });
        observer.observe({ entryTypes: ['longtask'] });
        window.__vyasaTasksPerf.longTaskObserver = observer;
    } catch {
        // Unsupported in this browser.
    }
}

function tasksFrameProbeStats(probe, now) {
    const deltas = probe.deltas.slice().sort((a, b) => a - b);
    const elapsedMs = Math.max(1, now - probe.startedAt);
    const pct = (p) => deltas.length ? deltas[Math.min(deltas.length - 1, Math.floor((deltas.length - 1) * p))] : 0;
    const over = (limit) => probe.deltas.filter((delta) => delta >= limit).length;
    return {
        elapsedMs: Math.round(elapsedMs),
        frames: probe.frames,
        fps: Math.round((probe.frames * 1000 / elapsedMs) * 10) / 10,
        maxFrameMs: Math.round((deltas[deltas.length - 1] || 0) * 10) / 10,
        p95FrameMs: Math.round(pct(0.95) * 10) / 10,
        longFrames24: over(24),
        longFrames33: over(33),
        longFrames50: over(50),
        inputs: { ...probe.inputs },
    };
}

function tasksPerfCompactStyle(el) {
    if (!el) return null;
    const style = window.getComputedStyle?.(el);
    return {
        tag: el.tagName?.toLowerCase?.() || '',
        id: el.id || '',
        cls: String(el.className || '').split(/\s+/).filter(Boolean).slice(0, 6).join('.'),
        rect: tasksPerfRect(el),
        position: style?.position || '',
        overflow: `${style?.overflowX || ''}/${style?.overflowY || ''}`,
        transform: style?.transform || '',
        contain: style?.contain || '',
        willChange: style?.willChange || '',
        isolation: style?.isolation || '',
        filter: style?.filter || '',
        backdropFilter: style?.backdropFilter || style?.webkitBackdropFilter || '',
    };
}

function tasksPerfRenderContext(wrapper, reason) {
    const animated = Array.from(document.getAnimations?.() || []);
    const fixedSticky = Array.from(document.querySelectorAll('*'))
        .filter((el) => {
            const position = window.getComputedStyle?.(el)?.position;
            return position === 'fixed' || position === 'sticky';
        })
        .slice(0, 20)
        .map(tasksPerfCompactStyle);
    return {
        reason,
        viewport: {
            width: window.innerWidth,
            height: window.innerHeight,
            dpr: window.devicePixelRatio || 1,
            visualWidth: Math.round(window.visualViewport?.width || 0),
            visualHeight: Math.round(window.visualViewport?.height || 0),
            visualScale: window.visualViewport?.scale || 1,
        },
        scroll: {
            x: Math.round(window.scrollX || 0),
            y: Math.round(window.scrollY || 0),
            documentHeight: Math.round(document.documentElement?.scrollHeight || 0),
            bodyHeight: Math.round(document.body?.scrollHeight || 0),
            htmlOverflow: `${getComputedStyle(document.documentElement).overflowX}/${getComputedStyle(document.documentElement).overflowY}`,
            bodyOverflow: `${getComputedStyle(document.body).overflowX}/${getComputedStyle(document.body).overflowY}`,
        },
        elementCount: document.getElementsByTagName('*').length,
        animationCount: animated.length,
        animations: animated.slice(0, 12).map((animation) => ({
            playState: animation.playState,
            currentTime: Math.round(Number(animation.currentTime || 0)),
            effectTarget: tasksPerfCompactStyle(animation.effect?.target),
        })),
        fixedSticky,
        wrapper: tasksPerfCompactStyle(wrapper),
        flow: tasksPerfCompactStyle(wrapper?.querySelector?.('.vyasa-tasks-flow')),
        reactFlow: tasksPerfCompactStyle(wrapper?.querySelector?.('.react-flow')),
        viewportEl: tasksPerfCompactStyle(wrapper?.querySelector?.('.react-flow__viewport')),
    };
}

export function markTasksFrameProbe(widgetId, wrapper, model, graphBase, reason, viewState = {}) {
    if (!window.__vyasaTasksPerf.enabled || typeof window.requestAnimationFrame !== 'function') return;
    startTasksLongTaskObserver();
    const key = String(widgetId || 'tasks');
    const now = tasksPerfNow();
    let probe = window.__vyasaTasksPerf.frameProbes.get(key);
    if (!probe) {
        probe = { startedAt: now, lastInputAt: now, lastFrameAt: 0, lastLogAt: now, frames: 0, deltas: [], inputs: {} };
        window.__vyasaTasksPerf.frameProbes.set(key, probe);
        const context = tasksPerfContext(widgetId, wrapper, model, graphBase, viewState);
        logTasksPerf('render-context', { ...context, ...tasksPerfRenderContext(wrapper, reason) });
        logTasksPerfPaintState(widgetId, wrapper, { ...context, reason });
        const tick = (frameAt) => {
            if (!window.__vyasaTasksPerf.frameProbes.has(key)) return;
            if (probe.lastFrameAt) probe.deltas.push(frameAt - probe.lastFrameAt);
            probe.lastFrameAt = frameAt;
            probe.frames += 1;
            if (frameAt - probe.lastLogAt >= 1000) {
                probe.lastLogAt = frameAt;
                logTasksPerf('frame-probe', { ...tasksPerfContext(widgetId, wrapper, model, graphBase, viewState), final: false, ...tasksFrameProbeStats(probe, frameAt) });
            }
            if (frameAt - probe.lastInputAt > 700) {
                logTasksPerf('frame-probe', { ...tasksPerfContext(widgetId, wrapper, model, graphBase, viewState), final: true, ...tasksFrameProbeStats(probe, frameAt) });
                window.__vyasaTasksPerf.frameProbes.delete(key);
                return;
            }
            window.requestAnimationFrame(tick);
        };
        window.requestAnimationFrame(tick);
    }
    probe.lastInputAt = now;
    probe.inputs[reason || 'input'] = (probe.inputs[reason || 'input'] || 0) + 1;
}
