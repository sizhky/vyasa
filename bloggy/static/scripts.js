import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';

const mermaidStates = {};
const mermaidDebugEnabled = () => (
    window.BLOGGY_DEBUG_MERMAID === true ||
    localStorage.getItem('bloggyDebugMermaid') === '1'
);
const mermaidDebugLog = (...args) => {
    if (mermaidDebugEnabled()) {
        console.log('[bloggy][mermaid]', ...args);
    }
};
const mermaidDebugSnapshot = (label) => {
    if (!mermaidDebugEnabled()) {
        return;
    }
    const wrappers = Array.from(document.querySelectorAll('.mermaid-wrapper'));
    const withSvg = wrappers.filter(w => w.querySelector('svg'));
    const interactive = wrappers.filter(w => w.dataset.mermaidInteractive === 'true');
    const last = wrappers[wrappers.length - 1];
    let lastRect = null;
    if (last) {
        const rect = last.getBoundingClientRect();
        lastRect = {
            id: last.id,
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            hasSvg: !!last.querySelector('svg'),
            interactive: last.dataset.mermaidInteractive === 'true'
        };
    }
    mermaidDebugLog(label, {
        total: wrappers.length,
        withSvg: withSvg.length,
        interactive: interactive.length,
        last: lastRect
    });
};
const GANTT_WIDTH = 1200;

function handleCodeCopyClick(event) {
    const button = event.target.closest('.code-copy-button, .hljs-copy-button');
    if (!button) {
        return;
    }
    event.preventDefault();
    event.stopPropagation();
    const container = button.closest('.code-block') || button.closest('pre') || button.parentElement;
    const textarea = container ? container.querySelector('textarea[id$="-clipboard"]') : null;
    let text = '';
    if (textarea && textarea.value) {
        text = textarea.value;
    } else {
        const codeEl = (container && container.querySelector('pre > code')) ||
            (container && container.querySelector('code')) ||
            button.closest('pre');
        if (!codeEl) {
            return;
        }
        text = codeEl.innerText || codeEl.textContent || '';
    }
    const showToast = () => {
        let toast = document.getElementById('code-copy-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'code-copy-toast';
            toast.className = 'fixed top-6 right-6 z-[10000] text-xs bg-slate-900 text-white px-3 py-2 rounded shadow-lg opacity-0 transition-opacity duration-300';
            toast.textContent = 'Copied';
            document.body.appendChild(toast);
        }
        toast.classList.remove('opacity-0');
        toast.classList.add('opacity-100');
        setTimeout(() => {
            toast.classList.remove('opacity-100');
            toast.classList.add('opacity-0');
        }, 1400);
    };
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(showToast).catch(() => {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.setAttribute('readonly', '');
            textarea.style.position = 'absolute';
            textarea.style.left = '-9999px';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            showToast();
        });
    } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'absolute';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showToast();
    }
}

document.addEventListener('click', handleCodeCopyClick, true);

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
        const svg = wrapper.querySelector('svg');
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
        
        // DEBUG: Log initial state
        console.group(`🔍 initMermaidInteraction: ${wrapper.id}`);
        console.log('Theme:', getCurrentTheme());
        console.log('Wrapper computed style height:', window.getComputedStyle(wrapper).height);
        console.log('Wrapper inline style:', wrapper.getAttribute('style'));
        
        // Scale SVG to fit container (maintain aspect ratio, fit to width or height whichever is smaller)
        const wrapperRect = wrapper.getBoundingClientRect();
        const svgRect = svg.getBoundingClientRect();
        console.log('Wrapper rect:', { width: wrapperRect.width, height: wrapperRect.height });
        console.log('SVG rect:', { width: svgRect.width, height: svgRect.height });
        
        const scaleX = (wrapperRect.width - 32) / svgRect.width;  // 32 for p-4 padding (16px each side)
        const scaleY = (wrapperRect.height - 32) / svgRect.height;
        console.log('Scale factors:', { scaleX, scaleY });
        
        // For very wide diagrams (like Gantt charts), prefer width scaling even if it exceeds height
        const aspectRatio = svgRect.width / svgRect.height;
        const maxUpscale = 1;
        let initialScale;
        if (aspectRatio > 3) {
            // Wide diagram: scale to fit width, but do not upscale by default
            initialScale = Math.min(scaleX, maxUpscale);
            console.log('Wide diagram detected (aspect ratio > 3):', aspectRatio, 'Using scaleX:', initialScale);
        } else {
            // Normal diagram: fit to smaller dimension, but do not upscale by default
            initialScale = Math.min(scaleX, scaleY, maxUpscale);
            console.log('Normal diagram (aspect ratio <=3):', aspectRatio, 'Using min scale:', initialScale);
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
        console.log('Final state:', state);
        console.groupEnd();

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
        
        // Mouse wheel zoom (zooms towards cursor position)
        wrapper.addEventListener('wheel', (e) => {
            e.preventDefault();
            
            const currentSvg = getSvg();
            if (!currentSvg) {
                return;
            }
            const rect = currentSvg.getBoundingClientRect();
            
            // Mouse position relative to SVG's current position
            const mouseX = e.clientX - rect.left - rect.width / 2;
            const mouseY = e.clientY - rect.top - rect.height / 2;
            
            const zoomIntensity = 0.01;
            const delta = e.deltaY > 0 ? 1 - zoomIntensity : 1 + zoomIntensity; // Zoom out or in speed
            const newScale = Math.min(Math.max(0.1, state.scale * delta), 55);
            
            // Calculate how much to adjust translation to keep point under cursor fixed
            // With center origin, we need to account for the scale change around center
            const scaleFactor = newScale / state.scale - 1;
            state.translateX -= mouseX * scaleFactor;
            state.translateY -= mouseY * scaleFactor;
            state.scale = newScale;
            
            updateTransform();
        }, { passive: false });
        
        // Pan with pointer drag (mouse + touch)
        wrapper.style.cursor = 'grab';
        wrapper.style.touchAction = 'none';
        wrapper.addEventListener('pointerdown', (e) => {
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            state.isPanning = true;
            state.startX = e.clientX - state.translateX;
            state.startY = e.clientY - state.translateY;
            wrapper.setPointerCapture(e.pointerId);
            wrapper.style.cursor = 'grabbing';
            e.preventDefault();
        });
        
        wrapper.addEventListener('pointermove', (e) => {
            if (!state.isPanning) return;
            state.translateX = e.clientX - state.startX;
            state.translateY = e.clientY - state.startY;
            updateTransform();
            if (mermaidDebugEnabled()) {
                mermaidDebugLog('pan update', wrapper.id, {
                    translateX: state.translateX,
                    translateY: state.translateY,
                    scale: state.scale,
                    svgTransform: (getSvg() && getSvg().style.transform) || ''
                });
            }
        });
        
        const stopPanning = (e) => {
            if (!state.isPanning) return;
            state.isPanning = false;
            try {
                wrapper.releasePointerCapture(e.pointerId);
            } catch {
                // Ignore if pointer capture is not active
            }
            wrapper.style.cursor = 'grab';
        };
        
        wrapper.addEventListener('pointerup', stopPanning);
        wrapper.addEventListener('pointercancel', stopPanning);
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
    title.textContent = 'Diagram';
    
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
    console.group('🔄 reinitializeMermaid called');
    console.log('Switching to theme:', getCurrentTheme());
    console.log('Is initial load?', isInitialLoad);
    
    // Skip if this is the initial load (let it render naturally first)
    if (isInitialLoad) {
        console.log('Skipping reinitialize on initial load');
        console.groupEnd();
        return;
    }
    
    const dynamicWidth = getDynamicGanttWidth();
    console.log('Using dynamic Gantt width:', dynamicWidth);
    
    mermaid.initialize({ 
        startOnLoad: false,
        theme: getCurrentTheme(),
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
            console.log(`Processing wrapper: ${wrapper.id}`);
            console.log('BEFORE clear - wrapper height:', window.getComputedStyle(wrapper).height);
            console.log('BEFORE clear - wrapper rect:', wrapper.getBoundingClientRect());
            
            // Preserve the current computed height before clearing (height should already be set explicitly)
            if (shouldLockHeight(wrapper)) {
                const currentHeight = wrapper.getBoundingClientRect().height;
                console.log('Preserving height:', currentHeight);
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
            console.log('AFTER clear - wrapper height:', window.getComputedStyle(wrapper).height);
            console.log('AFTER clear - wrapper rect:', wrapper.getBoundingClientRect());
            
            // Re-add the pre element with mermaid code
            const newPre = document.createElement('pre');
            newPre.className = 'mermaid';
            newPre.textContent = code;
            wrapper.appendChild(newPre);
        }
    });
    
    // Re-run mermaid
    mermaid.run().then(() => {
        console.log('Mermaid re-render complete, scheduling initMermaidInteraction');
        scheduleMermaidInteraction({
            onReady: () => {
                console.groupEnd();
            }
        });
    });
}

console.log('🚀 Initial Mermaid setup - Theme:', getCurrentTheme());

const initialGanttWidth = getDynamicGanttWidth();
console.log('Using initial Gantt width:', initialGanttWidth);

mermaid.initialize({ 
    startOnLoad: false,
    theme: getCurrentTheme(),
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
    mermaid.run().then(() => {
        mermaidDebugSnapshot('after mermaid.run (DOMContentLoaded)');
        console.log('Initial mermaid render complete');
        scheduleMermaidInteraction({
            onReady: () => {
                console.log('Calling initial initMermaidInteraction');
                
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
                    console.log(`Setting initial height for ${wrapper.id}:`, currentHeight);
                    wrapper.style.height = currentHeight + 'px';
                });
                isInitialLoad = false;
            }
        });
    });
});

// Reveal current file in sidebar
function revealInSidebar(rootElement = document) {
    if (!window.location.pathname.startsWith('/posts/')) {
        return;
    }

    // Decode the URL path to handle special characters and spaces
    const currentPath = decodeURIComponent(window.location.pathname.replace(/^\/posts\//, ''));
    const activeLink = rootElement.querySelector(`.post-link[data-path="${currentPath}"]`);
    
    if (activeLink) {
        // Expand all parent details elements within this sidebar
        let parent = activeLink.closest('details');
        while (parent && rootElement.contains(parent)) {
            parent.open = true;
            if (parent === rootElement) {
                break;
            }
            parent = parent.parentElement.closest('details');
        }
        
        // Scroll to the active link
        const scrollContainer = rootElement.querySelector('#sidebar-scroll-container');
        if (scrollContainer) {
            const linkRect = activeLink.getBoundingClientRect();
            const containerRect = scrollContainer.getBoundingClientRect();
            const scrollTop = scrollContainer.scrollTop;
            const offset = linkRect.top - containerRect.top + scrollTop - (containerRect.height / 2) + (linkRect.height / 2);
            
            scrollContainer.scrollTo({
                top: offset,
                behavior: 'smooth'
            });
        }
        
        // Highlight the active link temporarily
        activeLink.classList.remove('fade-out');
        activeLink.classList.add('sidebar-highlight');
        requestAnimationFrame(() => {
            setTimeout(() => {
                activeLink.classList.add('fade-out');
                setTimeout(() => {
                    activeLink.classList.remove('sidebar-highlight', 'fade-out');
                }, 10000);
            }, 1000);
        });
    }
}

function initPostsSidebarAutoReveal() {
    const postSidebars = document.querySelectorAll('details[data-sidebar="posts"]');
    
    postSidebars.forEach((sidebar) => {
        if (sidebar.dataset.revealBound === 'true') {
            return;
        }
        sidebar.dataset.revealBound = 'true';
        
        // Reveal immediately if sidebar is already open
        if (sidebar.open) {
            revealInSidebar(sidebar);
        }
        
        sidebar.addEventListener('toggle', () => {
            if (!sidebar.open) {
                return;
            }
            revealInSidebar(sidebar);
        });
    });
}

function initFolderChevronState(rootElement = document) {
    rootElement.querySelectorAll('details[data-folder="true"]').forEach((details) => {
        details.classList.toggle('is-open', details.open);
    });
}

function initSearchPlaceholderCycle(rootElement = document) {
    const inputs = rootElement.querySelectorAll('input[data-placeholder-cycle]');
    inputs.forEach((input) => {
        if (input.dataset.placeholderCycleBound === 'true') {
            return;
        }
        input.dataset.placeholderCycleBound = 'true';
        const primary = input.dataset.placeholderPrimary || input.getAttribute('placeholder') || '';
        const alt = input.dataset.placeholderAlt || '';
        if (!alt) {
            return;
        }
        let showAlt = false;
        setInterval(() => {
            if (input.value) {
                return;
            }
            showAlt = !showAlt;
            input.setAttribute('placeholder', showAlt ? alt : primary);
        }, 10000);
    });
}

function initCodeBlockCopyButtons(rootElement = document) {
    const buttons = rootElement.querySelectorAll('.code-copy-button');
    buttons.forEach((button) => {
        if (button.dataset.copyBound === 'true') {
            return;
        }
        button.dataset.copyBound = 'true';
        button.addEventListener('click', () => {
            const container = button.closest('.code-block');
            const codeEl = container ? container.querySelector('pre > code') : null;
            if (!codeEl) {
                return;
            }
            const text = codeEl.innerText || codeEl.textContent || '';
            const done = () => {
                button.classList.add('is-copied');
                setTimeout(() => button.classList.remove('is-copied'), 1200);
            };
            if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(text).then(done).catch(() => {
                    const textarea = document.createElement('textarea');
                    textarea.value = text;
                    textarea.setAttribute('readonly', '');
                    textarea.style.position = 'absolute';
                    textarea.style.left = '-9999px';
                    document.body.appendChild(textarea);
                    textarea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textarea);
                    done();
                });
            } else {
                const textarea = document.createElement('textarea');
                textarea.value = text;
                textarea.setAttribute('readonly', '');
                textarea.style.position = 'absolute';
                textarea.style.left = '-9999px';
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
                done();
            }
        });
    });
}

function initPostsSearchPersistence(rootElement = document) {
    const input = rootElement.querySelector('.posts-search-block input[type="search"][name="q"]');
    const results = rootElement.querySelector('.posts-search-results');
    if (!input || !results) {
        return;
    }
    if (input.dataset.searchPersistenceBound === 'true') {
        return;
    }
    input.dataset.searchPersistenceBound = 'true';
    const termKey = 'bloggy:postsSearchTerm';
    const resultsKey = 'bloggy:postsSearchResults';
    const enhanceGatherLink = () => {
        const gatherLink = results.querySelector('a[href^="/search/gather"]');
        if (!gatherLink) {
            return;
        }
        const href = gatherLink.getAttribute('href');
        if (!href) {
            return;
        }
        gatherLink.setAttribute('hx_get', href);
        gatherLink.setAttribute('hx_target', '#main-content');
        gatherLink.setAttribute('hx_push_url', 'true');
        gatherLink.setAttribute('hx_swap', 'outerHTML show:window:top settle:0.1s');
    };
    let storedTerm = '';
    let storedResults = null;
    try {
        storedTerm = localStorage.getItem(termKey) || '';
        storedResults = localStorage.getItem(resultsKey);
    } catch (err) {
        storedTerm = '';
        storedResults = null;
    }
    if (storedTerm && !input.value) {
        input.value = storedTerm;
    }
    if (storedResults && input.value) {
        try {
            const payload = JSON.parse(storedResults);
            if (payload && payload.term === input.value && payload.html) {
                results.innerHTML = payload.html;
                enhanceGatherLink();
            }
        } catch (err) {
            // Ignore malformed cached payloads.
        }
    }
    const persistTerm = () => {
        try {
            if (input.value) {
                localStorage.setItem(termKey, input.value);
            } else {
                localStorage.removeItem(termKey);
                localStorage.removeItem(resultsKey);
            }
        } catch (err) {
            // Ignore storage failures.
        }
    };
    input.addEventListener('input', persistTerm);
    const fetchResults = (query) => {
        return fetch(`/_sidebar/posts/search?q=${query}`)
            .then((response) => response.text())
            .then((html) => {
                results.innerHTML = html;
                enhanceGatherLink();
                try {
                    localStorage.setItem(resultsKey, JSON.stringify({
                        term: input.value,
                        html: results.innerHTML
                    }));
                } catch (err) {
                    // Ignore storage failures.
                }
            })
            .catch(() => {});
    };
    document.body.addEventListener('htmx:afterSwap', (event) => {
        if (event.target !== results) {
            return;
        }
        enhanceGatherLink();
        try {
            localStorage.setItem(resultsKey, JSON.stringify({
                term: input.value,
                html: results.innerHTML
            }));
        } catch (err) {
            // Ignore storage failures.
        }
    });
    if (input.value) {
        const query = encodeURIComponent(input.value);
        if (window.htmx && typeof window.htmx.ajax === 'function') {
            window.htmx.ajax('GET', `/_sidebar/posts/search?q=${query}`, { target: results, swap: 'innerHTML' });
        } else {
            fetchResults(query);
        }
    }
}

function initSearchClearButtons(rootElement = document) {
    const blocks = rootElement.querySelectorAll('.posts-search-block');
    blocks.forEach((block) => {
        const input = block.querySelector('input[type="search"][name="q"]');
        const button = block.querySelector('.posts-search-clear-button');
        const results = block.querySelector('.posts-search-results');
        if (!input || !button) {
            return;
        }
        if (button.dataset.clearBound === 'true') {
            return;
        }
        button.dataset.clearBound = 'true';
        const updateVisibility = () => {
            button.style.opacity = input.value ? '1' : '0';
            button.style.pointerEvents = input.value ? 'auto' : 'none';
        };
        updateVisibility();
        input.addEventListener('input', updateVisibility);
        button.addEventListener('click', () => {
            input.value = '';
            input.dispatchEvent(new Event('input', { bubbles: true }));
            if (results) {
                results.innerHTML = '';
            }
            try {
                localStorage.removeItem('bloggy:postsSearchTerm');
                localStorage.removeItem('bloggy:postsSearchResults');
            } catch (err) {
                // Ignore storage failures.
            }
        });
    });
}

document.addEventListener('toggle', (event) => {
    const details = event.target;
    if (!(details instanceof HTMLDetailsElement)) {
        return;
    }
    if (!details.matches('details[data-folder="true"]')) {
        return;
    }
    details.classList.toggle('is-open', details.open);
}, true);

// Update active post link in sidebar
function updateActivePostLink() {
    const currentPath = window.location.pathname.replace(/^\/posts\//, '');
    document.querySelectorAll('.post-link').forEach(link => {
        const linkPath = link.getAttribute('data-path');
        if (linkPath === currentPath) {
            link.classList.add('bg-blue-50', 'dark:bg-blue-900/20', 'text-blue-600', 'dark:text-blue-400', 'font-medium');
            link.classList.remove('text-slate-700', 'dark:text-slate-300', 'hover:text-blue-600');
        } else {
            link.classList.remove('bg-blue-50', 'dark:bg-blue-900/20', 'text-blue-600', 'dark:text-blue-400', 'font-medium');
            link.classList.add('text-slate-700', 'dark:text-slate-300', 'hover:text-blue-600');
        }
    });
}

// Update active TOC link based on scroll position
let lastActiveTocAnchor = null;
function updateActiveTocLink() {
    const headings = document.querySelectorAll('h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]');
    const tocLinks = document.querySelectorAll('.toc-link');
    
    let activeHeading = null;
    let nearestBelow = null;
    let nearestBelowTop = Infinity;
    const offset = 140;
    headings.forEach(heading => {
        const rect = heading.getBoundingClientRect();
        if (rect.top <= offset) {
            activeHeading = heading;
        } else if (rect.top < nearestBelowTop) {
            nearestBelowTop = rect.top;
            nearestBelow = heading;
        }
    });
    if (!activeHeading && nearestBelow) {
        activeHeading = nearestBelow;
    }
    
    tocLinks.forEach(link => {
        const anchor = link.getAttribute('data-anchor');
        if (activeHeading && anchor === activeHeading.id) {
            link.classList.add('bg-blue-50', 'dark:bg-blue-900/20', 'text-blue-600', 'dark:text-blue-400', 'font-semibold');
        } else {
            link.classList.remove('bg-blue-50', 'dark:bg-blue-900/20', 'text-blue-600', 'dark:text-blue-400', 'font-semibold');
        }
    });

    const activeId = activeHeading ? activeHeading.id : null;
    if (activeId && activeId !== lastActiveTocAnchor) {
        document.querySelectorAll(`.toc-link[data-anchor="${activeId}"]`).forEach(link => {
            link.scrollIntoView({ block: 'nearest' });
        });
        lastActiveTocAnchor = activeId;
    }
}

// Listen for scroll events to update active TOC link
let ticking = false;
window.addEventListener('scroll', () => {
    if (!ticking) {
        window.requestAnimationFrame(() => {
            updateActiveTocLink();
            ticking = false;
        });
        ticking = true;
    }
});

// Sync TOC highlight on hash changes and TOC clicks
window.addEventListener('hashchange', () => {
    requestAnimationFrame(updateActiveTocLink);
});

document.addEventListener('click', (event) => {
    const link = event.target.closest('.toc-link');
    if (!link) {
        return;
    }
    const anchor = link.getAttribute('data-anchor');
    if (!anchor) {
        return;
    }
    requestAnimationFrame(() => {
        document.querySelectorAll('.toc-link').forEach(item => {
            item.classList.toggle(
                'bg-blue-50',
                item.getAttribute('data-anchor') === anchor
            );
            item.classList.toggle(
                'dark:bg-blue-900/20',
                item.getAttribute('data-anchor') === anchor
            );
            item.classList.toggle(
                'text-blue-600',
                item.getAttribute('data-anchor') === anchor
            );
            item.classList.toggle(
                'dark:text-blue-400',
                item.getAttribute('data-anchor') === anchor
            );
            item.classList.toggle(
                'font-semibold',
                item.getAttribute('data-anchor') === anchor
            );
        });
        lastActiveTocAnchor = anchor;
        updateActiveTocLink();
    });
});

// Re-run mermaid on HTMX content swaps
document.body.addEventListener('htmx:afterSwap', function(event) {
    mermaidDebugSnapshot('before mermaid.run (htmx:afterSwap)');
    document.querySelectorAll('.mermaid-wrapper').forEach(wrapper => {
        if (!wrapper.id) {
            return;
        }
        // HTMX swaps can trigger a mermaid re-run that replaces SVGs.
        // Clear interaction state so we always re-bind after mermaid.run().
        delete mermaidStates[wrapper.id];
        delete wrapper.dataset.mermaidInteractive;
    });
    mermaid.run().then(() => {
        mermaidDebugSnapshot('after mermaid.run (htmx:afterSwap)');
        scheduleMermaidInteraction();
    });
    updateActivePostLink();
    updateActiveTocLink();
    initMobileMenus(); // Reinitialize mobile menu handlers
    initPostsSidebarAutoReveal();
    initFolderChevronState();
    initSearchPlaceholderCycle(event.target || document);
    initCodeBlockCopyButtons(event.target || document);
});

// Watch for theme changes and re-render mermaid diagrams
const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
            reinitializeMermaid();
        }
    });
});

observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class']
});

// Mobile menu toggle functionality
function initMobileMenus() {
    const postsToggle = document.getElementById('mobile-posts-toggle');
    const tocToggle = document.getElementById('mobile-toc-toggle');
    const postsPanel = document.getElementById('mobile-posts-panel');
    const tocPanel = document.getElementById('mobile-toc-panel');
    const closePostsBtn = document.getElementById('close-mobile-posts');
    const closeTocBtn = document.getElementById('close-mobile-toc');
    
    // Open posts panel
    if (postsToggle) {
        postsToggle.addEventListener('click', () => {
            if (postsPanel) {
                postsPanel.classList.remove('-translate-x-full');
                postsPanel.classList.add('translate-x-0');
                // Close TOC panel if open
                if (tocPanel) {
                    tocPanel.classList.remove('translate-x-0');
                    tocPanel.classList.add('translate-x-full');
                }
            }
        });
    }
    
    // Open TOC panel
    if (tocToggle) {
        tocToggle.addEventListener('click', () => {
            if (tocPanel) {
                tocPanel.classList.remove('translate-x-full');
                tocPanel.classList.add('translate-x-0');
                // Close posts panel if open
                if (postsPanel) {
                    postsPanel.classList.remove('translate-x-0');
                    postsPanel.classList.add('-translate-x-full');
                }
            }
        });
    }
    
    // Close posts panel
    if (closePostsBtn) {
        closePostsBtn.addEventListener('click', () => {
            if (postsPanel) {
                postsPanel.classList.remove('translate-x-0');
                postsPanel.classList.add('-translate-x-full');
            }
        });
    }
    
    // Close TOC panel
    if (closeTocBtn) {
        closeTocBtn.addEventListener('click', () => {
            if (tocPanel) {
                tocPanel.classList.remove('translate-x-0');
                tocPanel.classList.add('translate-x-full');
            }
        });
    }
    
    // Close panels on link click (for better mobile UX)
    if (postsPanel) {
        postsPanel.addEventListener('click', (e) => {
            if (e.target.tagName === 'A' || e.target.closest('a')) {
                setTimeout(() => {
                    postsPanel.classList.remove('translate-x-0');
                    postsPanel.classList.add('-translate-x-full');
                }, 100);
            }
        });
    }
    
    if (tocPanel) {
        tocPanel.addEventListener('click', (e) => {
            if (e.target.tagName === 'A' || e.target.closest('a')) {
                setTimeout(() => {
                    tocPanel.classList.remove('translate-x-0');
                    tocPanel.classList.add('translate-x-full');
                }, 100);
            }
        });
    }
}

// Keyboard shortcuts for toggling sidebars
function initKeyboardShortcuts() {
    // Prewarm the selectors to avoid lazy compilation delays
    const postsSidebars = document.querySelectorAll('details[data-sidebar="posts"]');
    const tocSidebar = document.querySelector('#toc-sidebar details');
    
    document.addEventListener('keydown', (e) => {
        // Skip if user is typing in an input field
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
            return;
        }
        
        // Z: Toggle posts panel
        if (e.key === 'z' || e.key === 'Z') {
            e.preventDefault();
            const postsSidebars = document.querySelectorAll('details[data-sidebar="posts"]');
            postsSidebars.forEach(sidebar => {
                sidebar.open = !sidebar.open;
            });
        }
        
        // X: Toggle TOC panel
        if (e.key === 'x' || e.key === 'X') {
            e.preventDefault();
            const tocSidebar = document.querySelector('#toc-sidebar details');
            if (tocSidebar) {
                tocSidebar.open = !tocSidebar.open;
            }
        }
    });
}

function syncPdfFocusButtons(root = document) {
    const isFocused = document.body.classList.contains('pdf-focus');
    root.querySelectorAll('[data-pdf-focus-toggle]').forEach((button) => {
        const focusLabel = button.getAttribute('data-pdf-focus-label') || 'Focus PDF';
        const exitLabel = button.getAttribute('data-pdf-exit-label') || 'Exit focus';
        button.textContent = isFocused ? exitLabel : focusLabel;
        button.setAttribute('aria-pressed', isFocused ? 'true' : 'false');
    });
}

function ensurePdfFocusState() {
    const hasPdfViewer = document.querySelector('.pdf-viewer') || document.querySelector('[data-pdf-focus-toggle]');
    if (!hasPdfViewer) {
        document.body.classList.remove('pdf-focus');
    }
    syncPdfFocusButtons(document);
}

function initPdfFocusToggle() {
    document.addEventListener('click', (event) => {
        const button = event.target.closest('[data-pdf-focus-toggle]');
        if (!button) {
            return;
        }
        event.preventDefault();
        document.body.classList.toggle('pdf-focus');
        syncPdfFocusButtons(document);
    });

    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') {
            return;
        }
        if (!document.body.classList.contains('pdf-focus')) {
            return;
        }
        document.body.classList.remove('pdf-focus');
        syncPdfFocusButtons(document);
    });
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    updateActivePostLink();
    updateActiveTocLink();
    initMobileMenus();
    initPostsSidebarAutoReveal();
    initFolderChevronState();
    initKeyboardShortcuts();
    initPdfFocusToggle();
    initSearchPlaceholderCycle(document);
    initPostsSearchPersistence(document);
    initCodeBlockCopyButtons(document);
    initSearchClearButtons(document);
    ensurePdfFocusState();
});

document.body.addEventListener('htmx:afterSwap', (event) => {
    if (!event.target) {
        return;
    }
    initSearchPlaceholderCycle(event.target);
    initPostsSearchPersistence(event.target);
    initCodeBlockCopyButtons(event.target);
    initSearchClearButtons(event.target);
    ensurePdfFocusState();
});
