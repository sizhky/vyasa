import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
import { clampScale, nextWheelState } from '/static/extensions/tasks/tasks_graph_core.js';

const GANTT_WIDTH = 1200;
const mermaidStates = {};
const mermaidDebugEnabled = () => (
    window.VYASA_DEBUG_MERMAID === true ||
    localStorage.getItem('vyasaDebugMermaid') === '1'
);
const mermaidDebugLog = (...args) => {
    if (mermaidDebugEnabled()) {
        console.log('[vyasa][mermaid]', ...args);
    }
};
const mermaidDebugSnapshot = (label) => {
    if (!mermaidDebugEnabled()) {
        return;
    }
    const wrappers = Array.from(document.querySelectorAll('.mermaid-wrapper'));
    const pending = wrappers.filter(w => !w.querySelector('svg'));
    const interactive = wrappers.filter(w => w.dataset.mermaidInteractive === 'true');
    const last = wrappers[wrappers.length - 1];
    const lastSummary = last ? {
        id: last.id,
        hasSvg: !!last.querySelector('svg'),
        interactive: last.dataset.mermaidInteractive === 'true'
    } : null;
    mermaidDebugLog(label, { total: wrappers.length, pending: pending.length, interactive: interactive.length, last: lastSummary });
};

function bindPanZoomGestures(wrapper, state, { getTarget, applyState, maxScale = 55 }) {
    const pointers = new Map();
    const pointerCenter = () => {
        const values = Array.from(pointers.values());
        return {
            x: values.reduce((sum, pointer) => sum + pointer.clientX, 0) / values.length,
            y: values.reduce((sum, pointer) => sum + pointer.clientY, 0) / values.length,
        };
    };
    const pointerDistance = () => {
        const values = Array.from(pointers.values());
        if (values.length < 2) return 0;
        return Math.hypot(values[0].clientX - values[1].clientX, values[0].clientY - values[1].clientY);
    };
    const resetPinch = () => {
        state.pinchDistance = 0;
        state.pinchLastCenter = null;
    };
    const beginPanFromPointer = (pointer) => {
        state.isPanning = true;
        state.startX = pointer.clientX - state.translateX;
        state.startY = pointer.clientY - state.translateY;
        resetPinch();
        wrapper.style.cursor = 'grabbing';
    };
    const beginPinch = () => {
        state.isPanning = false;
        state.pinchDistance = pointerDistance();
        state.pinchLastCenter = pointerCenter();
        wrapper.style.cursor = 'grabbing';
    };

    wrapper.addEventListener('wheel', (e) => {
        e.preventDefault();
        const target = getTarget();
        if (!target) return;
        Object.assign(state, nextWheelState(state, target.getBoundingClientRect(), { x: e.clientX, y: e.clientY }, e.deltaY, maxScale));
        applyState();
    }, { passive: false });

    wrapper.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        pointers.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
        try {
            wrapper.setPointerCapture(e.pointerId);
        } catch {
            // Ignore if this pointer cannot be captured.
        }
        if (pointers.size >= 2) {
            beginPinch();
        } else {
            beginPanFromPointer({ clientX: e.clientX, clientY: e.clientY });
        }
        e.preventDefault();
    });

    wrapper.addEventListener('pointermove', (e) => {
        if (!pointers.has(e.pointerId)) return;
        pointers.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
        if (pointers.size >= 2) {
            const target = getTarget();
            if (!target) return;
            const distance = pointerDistance();
            const center = pointerCenter();
            if (!state.pinchDistance || !state.pinchLastCenter) {
                beginPinch();
                return;
            }
            const rect = target.getBoundingClientRect();
            const centerX = center.x - rect.left - rect.width / 2;
            const centerY = center.y - rect.top - rect.height / 2;
            const newScale = clampScale(state.scale * (distance / Math.max(state.pinchDistance, 1)));
            const scaleFactor = newScale / state.scale - 1;
            state.translateX += center.x - state.pinchLastCenter.x;
            state.translateY += center.y - state.pinchLastCenter.y;
            state.translateX -= centerX * scaleFactor;
            state.translateY -= centerY * scaleFactor;
            state.scale = newScale;
            state.pinchDistance = distance;
            state.pinchLastCenter = center;
            applyState();
            e.preventDefault();
            return;
        }
        if (!state.isPanning) return;
        state.translateX = e.clientX - state.startX;
        state.translateY = e.clientY - state.startY;
        applyState();
        e.preventDefault();
    });

    const stopPointer = (e) => {
        pointers.delete(e.pointerId);
        try {
            wrapper.releasePointerCapture(e.pointerId);
        } catch {
            // Ignore if pointer capture is not active.
        }
        if (pointers.size >= 2) {
            beginPinch();
            return;
        }
        if (pointers.size === 1) {
            beginPanFromPointer(Array.from(pointers.values())[0]);
            return;
        }
        state.isPanning = false;
        resetPinch();
        wrapper.style.cursor = 'grab';
    };

    wrapper.addEventListener('pointerup', stopPointer);
    wrapper.addEventListener('pointercancel', stopPointer);
    wrapper.addEventListener('pointerleave', (e) => {
        if (state.isPanning || pointers.has(e.pointerId)) {
            stopPointer(e);
        }
    });
}

function initMermaidInteraction() {
    const wrappers = Array.from(document.querySelectorAll('.mermaid-wrapper'));
    if (mermaidDebugEnabled()) {
        const pending = wrappers.filter(w => !w.querySelector('svg'));
        const last = wrappers[wrappers.length - 1];
        mermaidDebugLog('initMermaidInteraction: total', wrappers.length, 'pending', pending.length);
        if (last) {
            mermaidDebugLog('initMermaidInteraction: last wrapper', last.id, 'hasSvg', !!last.querySelector('svg'));
        }
    }
    wrappers.forEach((wrapper, idx) => {
        const wrapperRect = wrapper.getBoundingClientRect();
        if (wrapperRect.width < 8 || wrapperRect.height < 8) return;
        const svg = wrapper.querySelector('svg');
        const inReveal = !!wrapper.closest('.reveal');
        const alreadyInteractive = wrapper.dataset.mermaidInteractive === 'true';
        if (mermaidDebugEnabled()) {
            mermaidDebugLog(
                'initMermaidInteraction: wrapper',
                idx,
                wrapper.id,
                'hasSvg',
                !!svg,
                'interactive',
                alreadyInteractive
            );
        }
        const getSvg = () => wrapper.querySelector('svg');
        const applySvgState = (currentSvg) => {
            if (!currentSvg) {
                return;
            }
            currentSvg.style.pointerEvents = 'none';
            currentSvg.style.transform = `translate(${state.translateX}px, ${state.translateY}px) scale(${state.scale})`;
            currentSvg.style.transformOrigin = 'center center';
        };
        if (svg) {
            svg.style.pointerEvents = 'none';
        }
        if (!svg || alreadyInteractive) return;
        if (inReveal) {
            svg.style.display = 'block';
            svg.style.margin = '0 auto';
            svg.style.transformOrigin = 'center center';
        }
        
        // Scale SVG to fit container (maintain aspect ratio, fit to width or height whichever is smaller)
        const svgRect = svg.getBoundingClientRect();
        const viewBox = (svg.getAttribute('viewBox') || '').trim().split(/\s+/).map(Number);
        let bbox = null;
        try {
            bbox = svg.getBBox ? svg.getBBox() : null;
        } catch {
            bbox = null;
        }
        const hasStableViewBox = viewBox.length === 4 && viewBox[2] > 1 && viewBox[3] > 1;
        const hasStableBBox = !!bbox && bbox.width > 1 && bbox.height > 1;
        const isRevealWrapper = !!wrapper.closest('.reveal, .vyasa-reveal-unit');
        const isLayoutUnstable = (
            (isRevealWrapper && wrapperRect.height < 120) ||
            svgRect.height < 30 ||
            (!hasStableViewBox && !hasStableBBox) ||
            (svgRect.width < 30 && !hasStableViewBox && !hasStableBBox)
        );
        if (isLayoutUnstable) {
            if (mermaidDebugEnabled()) {
                mermaidDebugLog('skip initMermaidInteraction: layout not stable', {
                    id: wrapper.id,
                    isRevealWrapper,
                    wrapperWidth: wrapperRect.width,
                    wrapperHeight: wrapperRect.height,
                    svgWidth: svgRect.width,
                    svgHeight: svgRect.height,
                    viewBox,
                    bbox
                });
            }
            return;
        }
        const innerWidth = Math.max(wrapperRect.width - 32, 1);   // 32 for p-4 padding
        const innerHeight = Math.max(wrapperRect.height - 32, 1);
        const scaleX = innerWidth / Math.max(svgRect.width, 1);
        const scaleY = innerHeight / Math.max(svgRect.height, 1);
        
        // For very wide diagrams (like Gantt charts), prefer width scaling even if it exceeds height
        const aspectRatio = svgRect.width / svgRect.height;
        const isFullscreenWrapper = wrapper.dataset.mermaidFullscreen === 'true';
        const maxUpscale = isFullscreenWrapper ? Number.POSITIVE_INFINITY : 1;
        let initialScale;
        if (aspectRatio > 3) {
            // Wide diagram: scale to fit width, but do not upscale by default
            initialScale = Math.min(scaleX, maxUpscale);
        } else {
            // Normal diagram: fit to smaller dimension, but do not upscale by default
            initialScale = Math.min(scaleX, scaleY, maxUpscale);
        }
        if (!Number.isFinite(initialScale) || initialScale <= 0) {
            // Hidden/unstable layout (e.g., Reveal transition state) can yield tiny or negative sizes.
            // Skip now and let a later ready/slidechanged pass initialize interaction.
            if (mermaidDebugEnabled()) {
                mermaidDebugLog('skip initMermaidInteraction: unstable scale', {
                    id: wrapper.id, wrapperRect, svgRect, scaleX, scaleY, initialScale
                });
            }
            return;
        }

        if (mermaidDebugEnabled()) {
            mermaidDebugLog('initMermaidInteraction: sizing', {
                id: wrapper.id,
                wrapperWidth: wrapperRect.width,
                wrapperHeight: wrapperRect.height,
                svgWidth: svgRect.width,
                svgHeight: svgRect.height,
                initialScale
            });
        }
        
        const state = {
            scale: initialScale,
            translateX: 0,
            translateY: 0,
            isPanning: false,
            startX: 0,
            startY: 0
        };
        mermaidStates[wrapper.id] = state;
        wrapper.dataset.mermaidInteractive = 'true';
        if (mermaidDebugEnabled() && !wrapper.dataset.mermaidDebugBound) {
            wrapper.dataset.mermaidDebugBound = 'true';
            const logEvent = (name, event) => {
                const target = event.target && event.target.tagName ? event.target.tagName : 'unknown';
                mermaidDebugLog(`${name} on ${wrapper.id}`, { type: event.type, target });
            };
            wrapper.addEventListener('pointerdown', (e) => logEvent('pointerdown', e));
            wrapper.addEventListener('pointermove', (e) => logEvent('pointermove', e));
            wrapper.addEventListener('pointerup', (e) => logEvent('pointerup', e));
            wrapper.addEventListener('wheel', (e) => logEvent('wheel', e));
        }
        
        function updateTransform() {
            applySvgState(getSvg());
        }
        
        // Apply initial scale
        updateTransform();

        if (!wrapper.dataset.mermaidObserver) {
            const observer = new MutationObserver(() => {
                applySvgState(getSvg());
            });
            observer.observe(wrapper, { childList: true, subtree: true });
            wrapper.dataset.mermaidObserver = 'true';
        }
        
        // Pan with pointer drag (mouse + touch)
        wrapper.style.cursor = 'grab';
        wrapper.style.touchAction = 'none';
        bindPanZoomGestures(wrapper, state, { getTarget: getSvg, applyState: updateTransform });
    });
}

function scheduleMermaidInteraction({ maxAttempts = 12, delayMs = 80, onReady } = {}) {
    let attempt = 0;
    const check = () => {
        const wrappers = Array.from(document.querySelectorAll('.mermaid-wrapper'));
        const pending = wrappers.filter(wrapper => !wrapper.querySelector('svg'));
        if (mermaidDebugEnabled()) {
            const last = wrappers[wrappers.length - 1];
            mermaidDebugLog('scheduleMermaidInteraction attempt', attempt, 'pending', pending.length);
            if (last) {
                mermaidDebugLog('scheduleMermaidInteraction last wrapper', last.id, 'hasSvg', !!last.querySelector('svg'));
            }
        }
        if (pending.length === 0 || attempt >= maxAttempts) {
            initMermaidInteraction();
            if (typeof onReady === 'function') {
                onReady();
            }
            return;
        }
        attempt += 1;
        setTimeout(check, delayMs);
    };
    check();
}

function renderMermaidInScope(scope = document) {
    const mermaidNodes = [];
    scope.querySelectorAll('.mermaid-wrapper').forEach((wrapper) => {
        if (!wrapper.id) {
            return;
        }
        delete mermaidStates[wrapper.id];
        delete wrapper.dataset.mermaidInteractive;
        if (wrapper.querySelector('svg')) {
            return;
        }
        let pre = wrapper.querySelector('pre.mermaid');
        if (!pre) {
            const encoded = wrapper.getAttribute('data-mermaid-code');
            if (!encoded) {
                return;
            }
            const textarea = document.createElement('textarea');
            textarea.innerHTML = encoded;
            const code = textarea.value;
            wrapper.innerHTML = '';
            pre = document.createElement('pre');
            pre.className = 'mermaid';
            pre.textContent = code;
            wrapper.appendChild(pre);
        }
        mermaidNodes.push(pre);
    });
    if (mermaidNodes.length > 0) {
        return mermaid.run({ nodes: mermaidNodes }).then(() => {
            scheduleMermaidInteraction();
        });
    }
    scheduleMermaidInteraction();
    return Promise.resolve();
}

function collectRenderableMermaidNodes(scope = document) {
    return Array.from(scope.querySelectorAll('pre.mermaid')).filter((node) => {
        return !node.closest('.vyasa-reveal-unit[data-reveal-state="hidden"]');
    });
}

window.vyasaRefreshDiagramInteractions = function(scope = document) {
    try {
        renderMermaidInScope(scope);
    } catch (_) {
        // Ignore if Mermaid is unavailable or still loading.
    }
    try {
        window.__vyasaRenderD2?.(scope);
    } catch (_) {
        // Ignore if there are no D2 diagrams in scope.
    }
};

window.resetMermaidZoom = function(id) {
    const state = mermaidStates[id];
    if (state) {
        state.scale = 1;
        state.translateX = 0;
        state.translateY = 0;
        const svg = document.getElementById(id).querySelector('svg');
        svg.style.transform = 'translate(0px, 0px) scale(1)';
    }
};

window.zoomMermaidIn = function(id) {
    const state = mermaidStates[id];
    if (state) {
        state.scale = Math.min(state.scale * 1.1, 10);
        const svg = document.getElementById(id).querySelector('svg');
        svg.style.transform = `translate(${state.translateX}px, ${state.translateY}px) scale(${state.scale})`;
    }
};

window.zoomMermaidOut = function(id) {
    const state = mermaidStates[id];
    if (state) {
        state.scale = Math.max(state.scale * 0.9, 0.1);
        const svg = document.getElementById(id).querySelector('svg');
        svg.style.transform = `translate(${state.translateX}px, ${state.translateY}px) scale(${state.scale})`;
    }
};

window.openMermaidFullscreen = function(id) {
    const wrapper = document.getElementById(id);
    if (!wrapper) return;
    
    const originalCode = wrapper.getAttribute('data-mermaid-code');
    if (!originalCode) return;
    const mermaidTitle = wrapper.getAttribute('data-mermaid-title') || 'Diagram';
    
    // Decode HTML entities
    const textarea = document.createElement('textarea');
    textarea.innerHTML = originalCode;
    const code = textarea.value;
    
    // Create modal
    const modal = document.createElement('div');
    modal.id = 'mermaid-fullscreen-modal';
    modal.className = 'fixed inset-0 z-[10000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4';
    modal.style.animation = 'fadeIn 0.2s ease-in';
    
    // Create modal content container
    const modalContent = document.createElement('div');
    modalContent.className = 'relative bg-white dark:bg-slate-900 rounded-lg shadow-2xl w-full h-full max-w-[95vw] max-h-[95vh] flex flex-col';
    
    // Create header with close button
    const header = document.createElement('div');
    header.className = 'flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700';
    
    const title = document.createElement('h3');
    title.className = 'text-lg font-semibold text-slate-800 dark:text-slate-200';
    title.textContent = mermaidTitle;
    
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '✕';
    closeBtn.className = 'px-3 py-1 text-xl text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors';
    closeBtn.title = 'Close (Esc)';
    closeBtn.onclick = () => document.body.removeChild(modal);
    
    header.appendChild(title);
    header.appendChild(closeBtn);
    
    // Create diagram container
    const diagramContainer = document.createElement('div');
    diagramContainer.className = 'flex-1 overflow-auto p-4 flex items-center justify-center';
    
    const fullscreenId = `${id}-fullscreen`;
    const fullscreenWrapper = document.createElement('div');
    fullscreenWrapper.id = fullscreenId;
    fullscreenWrapper.className = 'mermaid-wrapper w-full h-full flex items-center justify-center';
    fullscreenWrapper.setAttribute('data-mermaid-code', originalCode);
    fullscreenWrapper.setAttribute('data-mermaid-fullscreen', 'true');
    
    const pre = document.createElement('pre');
    pre.className = 'mermaid';
    pre.textContent = code;
    fullscreenWrapper.appendChild(pre);
    
    diagramContainer.appendChild(fullscreenWrapper);
    
    // Assemble modal
    modalContent.appendChild(header);
    modalContent.appendChild(diagramContainer);
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
    
    // Close on Esc key
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            document.body.removeChild(modal);
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);
    
    // Close on background click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
            document.removeEventListener('keydown', escHandler);
        }
    });
    
    // Render mermaid in the fullscreen view
    mermaid.run({ nodes: [pre] }).then(() => {
        setTimeout(() => initMermaidInteraction(), 100);
    });
};

function getCurrentTheme() {
    return document.documentElement.classList.contains('dark') ? 'dark' : 'default';
}

function getDynamicGanttWidth() {
    // Check if any mermaid wrapper has custom gantt width
    const wrappers = document.querySelectorAll('.mermaid-wrapper[data-gantt-width]');
    if (wrappers.length > 0) {
        // Use the first custom width found, or max width if multiple
        const widths = Array.from(wrappers).map(w => parseInt(w.getAttribute('data-gantt-width')) || GANTT_WIDTH);
        return Math.max(...widths);
    }
    return GANTT_WIDTH;
}

function reinitializeMermaid() {
    // Skip if this is the initial load (let it render naturally first)
    if (isInitialLoad) {
        return;
    }
    
    const dynamicWidth = getDynamicGanttWidth();
    
    mermaid.initialize({ 
        startOnLoad: false,
        theme: getCurrentTheme(),
        fontSize: 16,
        flowchart: {
            htmlLabels: false
        },
        gantt: {
            useWidth: dynamicWidth,
            useMaxWidth: false
        }
    });
    
    // Find all mermaid wrappers and re-render them
    const shouldLockHeight = (wrapper) => {
        const height = (wrapper.style.height || '').trim();
        return height && height !== 'auto' && height !== 'initial' && height !== 'unset';
    };

    document.querySelectorAll('.mermaid-wrapper').forEach(wrapper => {
        const originalCode = wrapper.getAttribute('data-mermaid-code');
        if (originalCode) {
            // Preserve the current computed height before clearing (height should already be set explicitly)
            if (shouldLockHeight(wrapper)) {
                const currentHeight = wrapper.getBoundingClientRect().height;
                wrapper.style.height = currentHeight + 'px';
            }
            
            // Delete the old state so it can be recreated
            delete mermaidStates[wrapper.id];
            delete wrapper.dataset.mermaidInteractive;
            
            // Decode HTML entities
            const textarea = document.createElement('textarea');
            textarea.innerHTML = originalCode;
            const code = textarea.value;
            
            // Clear the wrapper
            wrapper.innerHTML = '';
            
            // Re-add the pre element with mermaid code
            const newPre = document.createElement('pre');
            newPre.className = 'mermaid';
            newPre.style.width = '100%';
            newPre.style.height = '100%';
            newPre.style.display = 'flex';
            newPre.style.alignItems = 'center';
            newPre.style.justifyContent = 'center';
            newPre.textContent = code;
            wrapper.appendChild(newPre);
        }
    });
    
    // Re-run mermaid
    mermaid.run().then(() => {
        scheduleMermaidInteraction({
            onReady: () => {}
        });
    });
}

const initialGanttWidth = getDynamicGanttWidth();

mermaid.initialize({ 
    startOnLoad: false,
    theme: getCurrentTheme(),
    fontSize: 16,
    flowchart: {
        htmlLabels: false
    },
    gantt: {
        useWidth: initialGanttWidth,
        useMaxWidth: false
    }
});

// Track if this is the initial load
let isInitialLoad = true;

// Initialize interaction after mermaid renders
document.addEventListener('DOMContentLoaded', () => {
    mermaidDebugSnapshot('before mermaid.run (DOMContentLoaded)');
    const mermaidNodes = collectRenderableMermaidNodes(document);
    const renderPromise = mermaidNodes.length > 0
        ? mermaid.run({ nodes: mermaidNodes })
        : Promise.resolve();
    renderPromise.then(() => {
        mermaidDebugSnapshot('after mermaid.run (DOMContentLoaded)');
        scheduleMermaidInteraction({
            onReady: () => {
                // After initial render, set explicit heights on all wrappers so theme switching works
                const shouldLockHeight = (wrapper) => {
                    const height = (wrapper.style.height || '').trim();
                    return height && height !== 'auto' && height !== 'initial' && height !== 'unset';
                };
                document.querySelectorAll('.mermaid-wrapper').forEach(wrapper => {
                    if (!shouldLockHeight(wrapper)) {
                        return;
                    }
                    const currentHeight = wrapper.getBoundingClientRect().height;
                    wrapper.style.height = currentHeight + 'px';
                });
                isInitialLoad = false;
            }
        });
    });
    window.__vyasaRenderD2?.();
});

function initRevealDiagramRefresh() {
    if (!window.Reveal || typeof window.Reveal.on !== 'function') return;
    const normalizeMermaidViewBox = (scope) => {
        if (!scope) return;
        const svgs = scope.querySelectorAll('.mermaid-wrapper svg');
        svgs.forEach((svg) => {
            try {
                if (!svg.getBBox) return;
                const box = svg.getBBox();
                if (!Number.isFinite(box.width) || !Number.isFinite(box.height)) return;
                if (box.width < 1 || box.height < 1) return;
                const pad = 16;
                svg.setAttribute('viewBox', `${box.x - pad} ${box.y - pad} ${box.width + (pad * 2)} ${box.height + (pad * 2)}`);
                svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
                svg.style.display = 'block';
                svg.style.margin = '0 auto';
            } catch (_) {
                // Ignore unstable SVG state during transitions.
            }
        });
    };
    const centerRevealSlideDiagrams = (scope) => {
        if (!scope) return;
        const svgs = scope.querySelectorAll('.mermaid-wrapper svg, .d2-wrapper svg');
        svgs.forEach((svg) => {
            svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
            svg.style.display = 'block';
            svg.style.margin = '0 auto';
            svg.style.width = '100%';
            svg.style.height = '100%';
            svg.style.maxWidth = '100%';
            svg.style.maxHeight = '100%';
        });
    };
    const hydrateSlideDiagrams = (force = false) => {
        const current = window.Reveal.getCurrentSlide();
        if (!current) return;
        if (!force && current.dataset.diagramHydrated === 'true') return;
        current.dataset.diagramHydrated = 'true';
        const mermaidNodes = [];
        current.querySelectorAll('.mermaid-wrapper').forEach((wrapper) => {
            if (!wrapper.id) return;
            delete mermaidStates[wrapper.id];
            delete wrapper.dataset.mermaidInteractive;
            if (wrapper.querySelector('svg')) return;
            const encoded = wrapper.getAttribute('data-mermaid-code');
            if (!encoded) return;
            const textarea = document.createElement('textarea');
            textarea.innerHTML = encoded;
            const code = textarea.value;
            wrapper.innerHTML = '';
            const pre = document.createElement('pre');
            pre.className = 'mermaid';
            pre.textContent = code;
            wrapper.appendChild(pre);
            mermaidNodes.push(pre);
        });
        const didRenderMermaid = mermaidNodes.length > 0;
        const afterMermaid = () => {
            scheduleMermaidInteraction();
            if (didRenderMermaid && window.Reveal && typeof window.Reveal.layout === 'function') {
                requestAnimationFrame(() => {
                    window.Reveal.layout();
                });
                setTimeout(() => {
                    normalizeMermaidViewBox(current);
                }, 120);
            }
        };
        if (mermaidNodes.length > 0) {
            mermaid.run({ nodes: mermaidNodes }).then(() => {
                afterMermaid(true);
            }).catch(() => {});
        } else {
            afterMermaid(false);
        }
        window.__vyasaRenderD2?.(current);
        initTabPanelHeights(current);
        requestAnimationFrame(() => centerRevealSlideDiagrams(current));
        setTimeout(() => centerRevealSlideDiagrams(current), 60);
    };
    window.Reveal.on('ready', () => setTimeout(() => hydrateSlideDiagrams(true), 0));
    window.Reveal.on('slidetransitionend', () => hydrateSlideDiagrams(false));
}
initRevealDiagramRefresh();

window.__vyasaRenderMermaidInScope = renderMermaidInScope;
document.addEventListener('DOMContentLoaded', () => {
    mermaidDebugSnapshot('before mermaid.run (DOMContentLoaded)');
    const mermaidNodes = collectRenderableMermaidNodes(document);
    const renderPromise = mermaidNodes.length > 0 ? mermaid.run({ nodes: mermaidNodes }) : Promise.resolve();
    renderPromise.then(() => {
        mermaidDebugSnapshot('after mermaid.run (DOMContentLoaded)');
        scheduleMermaidInteraction({ onReady: () => { document.querySelectorAll('.mermaid-wrapper').forEach(wrapper => wrapper.closest('.vyasa-reveal-unit')?.classList.add('vyasa-reveal-unit-ready')); } });
    }).catch(() => { scheduleMermaidInteraction(); });
});
document.body.addEventListener('htmx:afterSwap', (event) => {
    const swapScope = event.target || document;
    mermaidDebugSnapshot('before mermaid.run (htmx:afterSwap)');
    document.querySelectorAll('.mermaid-wrapper').forEach(wrapper => { delete mermaidStates[wrapper.id]; delete wrapper.dataset.mermaidInteractive; });
    const mermaidNodes = collectRenderableMermaidNodes(swapScope);
    const renderPromise = mermaidNodes.length > 0 ? mermaid.run({ nodes: mermaidNodes }) : Promise.resolve();
    renderPromise.then(() => { mermaidDebugSnapshot('after mermaid.run (htmx:afterSwap)'); scheduleMermaidInteraction(); }).catch(() => { scheduleMermaidInteraction(); });
});
const __vyasaMermaidThemeObserver = new MutationObserver((mutations) => { mutations.forEach((mutation) => { if (mutation.attributeName === 'class') { reinitializeMermaid(); window.__vyasaRenderD2?.(); } }); });
__vyasaMermaidThemeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style'] });
