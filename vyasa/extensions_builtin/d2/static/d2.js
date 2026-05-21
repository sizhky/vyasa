import { D2 } from 'https://esm.sh/@terrastruct/d2@0.1.33?bundle';
import { clampScale, nextWheelState } from '/static/extensions/tasks/tasks_graph_core.js';

const d2States = {};
const d2DebugEnabled = () => (
    window.VYASA_DEBUG_D2 === true ||
    localStorage.getItem('vyasaDebugD2') === '1'
);
const d2DebugLog = (...args) => {
    if (d2DebugEnabled()) {
        console.log('[vyasa][d2]', ...args);
    }
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

let d2InstancePromise = null;

function getD2Instance() {
    if (!d2InstancePromise) {
        d2InstancePromise = Promise.resolve(new D2());
    }
    return d2InstancePromise;
}

function decodeHtmlEntities(value) {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = value;
    return textarea.value;
}

function normalizeD2SvgForBrowser(svg) {
    // Work around D2 animation script collisions that can emit duplicate
    // declarations like `const htmlElement` and break execution in-page.
    return svg.replace(/\b(?:const|let)\s+htmlElement\b/g, 'var htmlElement');
}

function coerceD2RenderToSvgMarkup(renderResult) {
    if (typeof renderResult === 'string') {
        return renderResult;
    }
    if (renderResult instanceof Uint8Array) {
        return new TextDecoder().decode(renderResult);
    }
    if (Array.isArray(renderResult)) {
        for (const item of renderResult) {
            try {
                const svg = coerceD2RenderToSvgMarkup(item);
                if (svg && svg.includes('<svg')) {
                    return svg;
                }
            } catch {
                // Keep trying other entries.
            }
        }
    }
    if (renderResult && typeof renderResult === 'object') {
        if (typeof renderResult.svg === 'string') {
            return renderResult.svg;
        }
        if (renderResult.data && typeof renderResult.data === 'string') {
            return renderResult.data;
        }
        if (typeof renderResult.markup === 'string') {
            return renderResult.markup;
        }
        for (const value of Object.values(renderResult)) {
            if (typeof value === 'string' && value.includes('<svg')) {
                return value;
            }
            if (value && typeof value === 'object') {
                try {
                    const nested = coerceD2RenderToSvgMarkup(value);
                    if (nested && nested.includes('<svg')) {
                        return nested;
                    }
                } catch {
                    // Continue checking other keys.
                }
            }
        }
    }
    throw new TypeError(`Unsupported D2 render result type: ${typeof renderResult}`);
}

function rehydrateScripts(container) {
    const scripts = Array.from(container.querySelectorAll('script'));
    scripts.forEach((oldScript) => {
        const newScript = document.createElement('script');
        Array.from(oldScript.attributes).forEach((attr) => {
            newScript.setAttribute(attr.name, attr.value);
        });
        newScript.textContent = oldScript.textContent || '';
        oldScript.replaceWith(newScript);
    });
}

function activateSvgAnimations(container) {
    const svg = container.querySelector('svg');
    if (!svg) {
        return;
    }
    try {
        if (typeof svg.unpauseAnimations === 'function') {
            svg.unpauseAnimations();
        }
        if (typeof svg.setCurrentTime === 'function') {
            svg.setCurrentTime(0);
        }
    } catch (error) {
        d2DebugLog('activateSvgAnimations error', error);
    }
}

function setD2ControlsEnabled(wrapper, enabled) {
    const container = wrapper.closest('.d2-container');
    if (!container) {
        return;
    }
    const controls = container.querySelector('.d2-controls');
    if (!controls) {
        return;
    }
    controls.querySelectorAll('button').forEach((button) => {
        button.disabled = !enabled;
        button.style.opacity = enabled ? '1' : '0.5';
        button.style.cursor = enabled ? 'pointer' : 'not-allowed';
    });
}

function ensureD2PanzoomStage(wrapper) {
    let stage = wrapper.querySelector('.d2-panzoom-stage');
    if (stage) {
        return stage;
    }
    const svg = wrapper.querySelector('svg');
    if (!svg) {
        return null;
    }
    stage = document.createElement('div');
    stage.className = 'd2-panzoom-stage w-full h-full flex items-center justify-center';
    stage.style.transformOrigin = 'center center';
    svg.replaceWith(stage);
    stage.appendChild(svg);
    return stage;
}

function isDarkModeActive() {
    return document.documentElement.classList.contains('dark');
}

function parseOptionalNumber(value) {
    if (value === null || value === undefined || value === '') {
        return undefined;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
}

function parseOptionalBoolean(value) {
    if (value === null || value === undefined || value === '') {
        return undefined;
    }
    const normalized = String(value).trim().toLowerCase();
    if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
        return true;
    }
    if (normalized === 'false' || normalized === '0' || normalized === 'no') {
        return false;
    }
    return undefined;
}

function normalizeD2Target(value) {
    if (value === null || value === undefined) {
        return undefined;
    }
    const trimmed = String(value).trim();
    if (trimmed === '""' || trimmed === "''" || trimmed === '') {
        // D2 multi-board target uses wildcard patterns (e.g. layers.x.*).
        // Treat empty target as wildcard-all for composition animation.
        return '*';
    }
    return trimmed;
}

function hasD2SubstitutionBraceError(error) {
    return String(error).includes('substitutions must begin on {');
}

function escapeBareD2SubstitutionDollars(source) {
    // D2 treats `$` as the start of a substitution. Escape bare dollars so
    // values like "$100" or shell snippets don't fail parsing.
    let escaped = '';
    for (let i = 0; i < source.length; i += 1) {
        const char = source[i];
        if (char !== '$') {
            escaped += char;
            continue;
        }
        const previous = source[i - 1];
        const next = source[i + 1];
        if (previous === '\\' || next === '{') {
            escaped += '$';
            continue;
        }
        escaped += '\\$';
    }
    return escaped;
}

function replaceBareD2SubstitutionDollarsWithFullwidth(source) {
    let replaced = '';
    for (let i = 0; i < source.length; i += 1) {
        const char = source[i];
        if (char !== '$') {
            replaced += char;
            continue;
        }
        const next = source[i + 1];
        if (next === '{') {
            replaced += '$';
            continue;
        }
        replaced += '＄';
    }
    return replaced;
}

async function renderD2Diagrams(rootElement = document) {
    const wrappers = Array.from(rootElement.querySelectorAll('.d2-wrapper'));
    if (!wrappers.length) {
        return;
    }
    const totalStart = performance.now();
    let d2;
    try {
        const loadStart = performance.now();
        d2 = await getD2Instance();
        d2DebugLog('library ready', { wrappers: wrappers.length, ms: performance.now() - loadStart });
    } catch (error) {
        console.error('Failed to initialize D2 renderer', error);
        return;
    }
    for (const wrapper of wrappers) {
        const source = wrapper.getAttribute('data-d2-code');
        if (!source) {
            continue;
        }
        const decodedSource = decodeHtmlEntities(source);
        if (wrapper.id) {
            delete d2States[wrapper.id];
            delete wrapper.dataset.d2Interactive;
        }
        try {
            const layout = wrapper.getAttribute('data-d2-layout') || 'elk';
            const themeId = parseOptionalNumber(wrapper.getAttribute('data-d2-theme-id'));
            const darkThemeId = parseOptionalNumber(wrapper.getAttribute('data-d2-dark-theme-id'));
            const sketch = parseOptionalBoolean(wrapper.getAttribute('data-d2-sketch'));
            const pad = parseOptionalNumber(wrapper.getAttribute('data-d2-pad'));
            const scale = parseOptionalNumber(wrapper.getAttribute('data-d2-scale'));
            const target = wrapper.getAttribute('data-d2-target');
            const animateInterval = parseOptionalNumber(wrapper.getAttribute('data-d2-animate-interval'));
            const animate = parseOptionalBoolean(wrapper.getAttribute('data-d2-animate'));

            const compileOptions = {};
            compileOptions.layout = layout;
            if (sketch !== undefined) {
                compileOptions.sketch = sketch;
            }
            // For compositions, target selection must happen at compile-time.
            const normalizedTarget = normalizeD2Target(target);
            if (normalizedTarget !== undefined) {
                compileOptions.target = normalizedTarget;
            }

            let result;
            try {
                const compileStart = performance.now();
                result = await d2.compile(decodedSource, compileOptions);
                d2DebugLog('compile complete', { id: wrapper.id, ms: performance.now() - compileStart });
            } catch (compileError) {
                if (!hasD2SubstitutionBraceError(compileError)) {
                    throw compileError;
                }
                const escapedSource = escapeBareD2SubstitutionDollars(decodedSource);
                const fullwidthSource = replaceBareD2SubstitutionDollarsWithFullwidth(decodedSource);
                if (escapedSource === decodedSource && fullwidthSource === decodedSource) {
                    throw compileError;
                }
                d2DebugLog('retrying compile after normalizing bare $ substitutions', {
                    id: wrapper.id,
                    sourcePreview: decodedSource.slice(0, 120)
                });
                try {
                    result = await d2.compile(escapedSource, compileOptions);
                } catch (secondCompileError) {
                    if (!hasD2SubstitutionBraceError(secondCompileError)) {
                        throw secondCompileError;
                    }
                    result = await d2.compile(fullwidthSource, compileOptions);
                    result.__vyasaFullwidthDollarFallback = true;
                }
            }
            const renderOptions = { ...(result.renderOptions || result.options || {}) };
            if (themeId !== undefined) {
                renderOptions.themeID = themeId;
            }
            if (darkThemeId !== undefined) {
                renderOptions.darkThemeID = darkThemeId;
            }
            if (themeId !== undefined || darkThemeId !== undefined) {
                const activeThemeId = isDarkModeActive()
                    ? (darkThemeId !== undefined ? darkThemeId : themeId)
                    : (themeId !== undefined ? themeId : darkThemeId);
                if (activeThemeId !== undefined) {
                    renderOptions.themeID = activeThemeId;
                }
            }
            if (pad !== undefined) {
                renderOptions.pad = pad;
            }
            if (scale !== undefined) {
                renderOptions.scale = scale;
            }
            if (normalizedTarget !== undefined) {
                renderOptions.target = normalizedTarget;
            }
            if (animateInterval !== undefined) {
                renderOptions.animateInterval = animateInterval;
            } else if (animate === true) {
                renderOptions.animateInterval = 1200;
            }
            // D2 compositions need target="" + animateInterval>0 to emit animated multi-board SVG.
            // If user requests animation but omits target, default to all boards.
            if (
                renderOptions.animateInterval > 0 &&
                (renderOptions.target === undefined || renderOptions.target === null)
            ) {
                renderOptions.target = '*';
            }
            if (
                renderOptions.animateInterval > 0 &&
                (compileOptions.target === undefined || compileOptions.target === null)
            ) {
                compileOptions.target = '*';
            }
            const isAnimated = Number(renderOptions.animateInterval || 0) > 0;
            wrapper.dataset.d2Animated = isAnimated ? 'true' : 'false';
            setD2ControlsEnabled(wrapper, true);
            d2DebugLog('render options', {
                id: wrapper.id,
                layout: compileOptions.layout,
                sketch: compileOptions.sketch,
                compileTarget: compileOptions.target,
                themeID: renderOptions.themeID,
                darkThemeID: renderOptions.darkThemeID,
                target: renderOptions.target,
                animateInterval: renderOptions.animateInterval
            });
            const renderStart = performance.now();
            const rawRenderResult = await d2.render(result.diagram, renderOptions);
            d2DebugLog('render complete', { id: wrapper.id, ms: performance.now() - renderStart });
            const svgMarkup = coerceD2RenderToSvgMarkup(rawRenderResult);
            let normalizedSvg = normalizeD2SvgForBrowser(svgMarkup);
            if (result.__vyasaFullwidthDollarFallback) {
                normalizedSvg = normalizedSvg.replaceAll('＄', '$');
            }
            const hydrateStart = performance.now();
            wrapper.innerHTML = normalizedSvg;
            rehydrateScripts(wrapper);
            activateSvgAnimations(wrapper);
            ensureD2PanzoomStage(wrapper);
            wrapper.dataset.d2Rendered = 'true';
            d2DebugLog('svg hydrated', { id: wrapper.id, ms: performance.now() - hydrateStart });
            const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            d2DebugLog('rendered', {
                id: wrapper.id,
                animated: normalizedSvg.includes('animation') || normalizedSvg.includes('@keyframes'),
                hasHtmlElementScript: normalizedSvg.includes('htmlElement'),
                hasScriptTag: normalizedSvg.includes('<script'),
                hasSmilAnimateTag: normalizedSvg.includes('<animate'),
                prefersReducedMotion
            });
        } catch (error) {
            console.error('Failed to render D2 diagram', error);
            if (d2DebugEnabled()) {
                d2DebugLog('render failure details', {
                    id: wrapper.id,
                    error: String(error),
                    sourcePreview: decodedSource.slice(0, 120)
                });
            }
        }
    }
    d2DebugLog('renderD2Diagrams complete', { wrappers: wrappers.length, ms: performance.now() - totalStart });
    initD2Interaction(rootElement);
}

function initD2Interaction(rootElement = document) {
    const wrappers = Array.from(rootElement.querySelectorAll('.d2-wrapper'));
    wrappers.forEach((wrapper) => {
        const svg = wrapper.querySelector('svg');
        const stage = ensureD2PanzoomStage(wrapper);
        const inReveal = !!wrapper.closest('.reveal');
        if (!svg || !stage || wrapper.dataset.d2Interactive === 'true') {
            return;
        }
        if (inReveal) {
            stage.style.transform = 'none';
            stage.style.transformOrigin = 'center center';
            stage.style.display = 'flex';
            stage.style.justifyContent = 'center';
            stage.style.alignItems = 'center';
            svg.style.display = 'block';
            svg.style.margin = '0 auto';
        }

        const wrapperRect = wrapper.getBoundingClientRect();
        const svgRect = svg.getBoundingClientRect();
        if (!svgRect.width || !svgRect.height) {
            return;
        }
        const scaleX = (wrapperRect.width - 32) / svgRect.width;
        const scaleY = (wrapperRect.height - 32) / svgRect.height;
        const aspectRatio = svgRect.width / svgRect.height;
        const maxUpscale = 1;
        let initialScale = aspectRatio > 3
            ? Math.min(scaleX, maxUpscale)
            : Math.min(scaleX, scaleY, maxUpscale);
        if (inReveal) {
            try {
                const vb = (svg.getAttribute('viewBox') || '').trim().split(/\s+/).map(Number);
                const box = svg.getBBox ? svg.getBBox() : null;
                if (vb.length === 4 && box && box.width > 1 && box.height > 1) {
                    const vbW = vb[2];
                    const vbH = vb[3];
                    if (Number.isFinite(vbW) && Number.isFinite(vbH) && vbW > 1 && vbH > 1) {
                        const fitFromBounds = Math.min(vbW / box.width, vbH / box.height);
                        if (Number.isFinite(fitFromBounds) && fitFromBounds > 1) {
                            initialScale = Math.min(fitFromBounds * 0.92, 6);
                        } else {
                            initialScale = 1;
                        }
                    } else {
                        initialScale = 1;
                    }
                } else {
                    initialScale = 1;
                }
            } catch (_) {
                initialScale = 1;
            }
        }

        const state = {
            scale: initialScale,
            translateX: 0,
            translateY: 0,
            isPanning: false,
            startX: 0,
            startY: 0
        };
        d2States[wrapper.id] = state;
        wrapper.dataset.d2Interactive = 'true';

        const getSvg = () => wrapper.querySelector('svg');
        const getStage = () => wrapper.querySelector('.d2-panzoom-stage');
        const applyState = () => {
            const currentStage = getStage();
            if (!currentStage) {
                return;
            }
            const currentSvg = getSvg();
            if (currentSvg) {
                currentSvg.style.pointerEvents = 'none';
            }
            currentStage.style.transform = `translate(${state.translateX}px, ${state.translateY}px) scale(${state.scale})`;
            currentStage.style.transformOrigin = 'center center';
        };
        applyState();

        wrapper.style.cursor = 'grab';
        wrapper.style.touchAction = 'none';
        bindPanZoomGestures(wrapper, state, { getTarget: getStage, applyState });
    });
}

window.resetD2Zoom = function(id) {
    const state = d2States[id];
    const wrapper = document.getElementById(id);
    if (!state || !wrapper) {
        return;
    }
    state.scale = 1;
    state.translateX = 0;
    state.translateY = 0;
    const stage = wrapper.querySelector('.d2-panzoom-stage');
    if (stage) {
        stage.style.transform = 'translate(0px, 0px) scale(1)';
    }
};

window.zoomD2In = function(id) {
    const state = d2States[id];
    const wrapper = document.getElementById(id);
    if (!state || !wrapper) {
        return;
    }
    state.scale = Math.min(state.scale * 1.1, 10);
    const stage = wrapper.querySelector('.d2-panzoom-stage');
    if (stage) {
        stage.style.transform = `translate(${state.translateX}px, ${state.translateY}px) scale(${state.scale})`;
    }
};

window.zoomD2Out = function(id) {
    const state = d2States[id];
    const wrapper = document.getElementById(id);
    if (!state || !wrapper) {
        return;
    }
    state.scale = Math.max(state.scale * 0.9, 0.1);
    const stage = wrapper.querySelector('.d2-panzoom-stage');
    if (stage) {
        stage.style.transform = `translate(${state.translateX}px, ${state.translateY}px) scale(${state.scale})`;
    }
};

window.openD2Fullscreen = async function(id) {
    const wrapper = document.getElementById(id);
    if (!wrapper) return;

    const originalCode = wrapper.getAttribute('data-d2-code');
    if (!originalCode) return;
    const fullscreenTitle = wrapper.getAttribute('data-d2-fullscreen-title') || 'D2 Diagram';

    const existing = document.getElementById('d2-fullscreen-modal');
    if (existing) {
        existing.remove();
    }

    const modal = document.createElement('div');
    modal.id = 'd2-fullscreen-modal';
    modal.className = 'fixed inset-0 z-[10000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4';
    modal.style.animation = 'fadeIn 0.2s ease-in';

    const modalContent = document.createElement('div');
    modalContent.className = 'relative bg-white dark:bg-slate-900 rounded-lg shadow-2xl w-full h-full max-w-[95vw] max-h-[95vh] flex flex-col';

    const header = document.createElement('div');
    header.className = 'flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700';

    const title = document.createElement('h3');
    title.className = 'text-lg font-semibold text-slate-800 dark:text-slate-200';
    title.textContent = fullscreenTitle;

    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '✕';
    closeBtn.className = 'px-3 py-1 text-xl text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors';
    closeBtn.title = 'Close (Esc)';
    closeBtn.onclick = () => document.body.removeChild(modal);

    header.appendChild(title);
    header.appendChild(closeBtn);

    const diagramContainer = document.createElement('div');
    diagramContainer.className = 'flex-1 overflow-auto p-4 flex items-center justify-center';

    const fullscreenWrapper = document.createElement('div');
    fullscreenWrapper.className = 'd2-wrapper w-full h-full overflow-hidden flex items-center justify-center';
    fullscreenWrapper.id = `${id}-fullscreen`;
    fullscreenWrapper.setAttribute('data-d2-code', originalCode);
    Array.from(wrapper.attributes).forEach((attr) => {
        if (attr.name.startsWith('data-d2-') && attr.name !== 'data-d2-code') {
            fullscreenWrapper.setAttribute(attr.name, attr.value);
        }
    });
    fullscreenWrapper.style.minHeight = '80vh';
    fullscreenWrapper.style.height = '80vh';

    const pre = document.createElement('pre');
    pre.className = 'd2';
    pre.style.width = '100%';
    pre.style.height = '100%';
    pre.style.display = 'flex';
    pre.style.alignItems = 'center';
    pre.style.justifyContent = 'center';
    pre.textContent = decodeHtmlEntities(originalCode);
    fullscreenWrapper.appendChild(pre);

    diagramContainer.appendChild(fullscreenWrapper);
    modalContent.appendChild(header);
    modalContent.appendChild(diagramContainer);
    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    });

    const escHandler = (e) => {
        if (e.key === 'Escape' && document.getElementById('d2-fullscreen-modal')) {
            document.body.removeChild(modal);
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);

    await renderD2Diagrams(modal);
};

window.__vyasaRenderD2 = renderD2Diagrams;
document.addEventListener('DOMContentLoaded', () => { renderD2Diagrams(); });
document.body.addEventListener('htmx:afterSwap', (event) => { renderD2Diagrams(event.target || document); });
