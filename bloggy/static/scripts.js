import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';

const mermaidStates = {};

function initMermaidInteraction() {
    document.querySelectorAll('.mermaid-wrapper').forEach(wrapper => {
        const svg = wrapper.querySelector('svg');
        if (!svg || mermaidStates[wrapper.id]) return;
        
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
        let initialScale;
        if (aspectRatio > 3) {
            // Wide diagram: scale to fit width, allowing vertical scroll if needed
            initialScale = scaleX;
            console.log('Wide diagram detected (aspect ratio > 3):', aspectRatio, 'Using scaleX:', initialScale);
        } else {
            // Normal diagram: fit to smaller dimension, but allow upscaling up to 3x
            initialScale = Math.min(scaleX, scaleY, 3);
            console.log('Normal diagram (aspect ratio <=3):', aspectRatio, 'Using min scale:', initialScale);
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
        console.log('Final state:', state);
        console.groupEnd();
        
        function updateTransform() {
            svg.style.transform = `translate(${state.translateX}px, ${state.translateY}px) scale(${state.scale})`;
            svg.style.transformOrigin = 'center center';
        }
        
        // Apply initial scale
        updateTransform();
        
        // Mouse wheel zoom (zooms towards cursor position)
        wrapper.addEventListener('wheel', (e) => {
            e.preventDefault();
            
            const rect = svg.getBoundingClientRect();
            
            // Mouse position relative to SVG's current position
            const mouseX = e.clientX - rect.left - rect.width / 2;
            const mouseY = e.clientY - rect.top - rect.height / 2;
            
            const zoomIntensity = 0.01;
            const delta = e.deltaY > 0 ? 1 - zoomIntensity : 1 + zoomIntensity; // Zoom out or in speed
            const newScale = Math.min(Math.max(0.1, state.scale * delta), 15);
            
            // Calculate how much to adjust translation to keep point under cursor fixed
            // With center origin, we need to account for the scale change around center
            const scaleFactor = newScale / state.scale - 1;
            state.translateX -= mouseX * scaleFactor;
            state.translateY -= mouseY * scaleFactor;
            state.scale = newScale;
            
            updateTransform();
        }, { passive: false });
        
        // Pan with mouse drag
        wrapper.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            state.isPanning = true;
            state.startX = e.clientX - state.translateX;
            state.startY = e.clientY - state.translateY;
            wrapper.style.cursor = 'grabbing';
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!state.isPanning) return;
            state.translateX = e.clientX - state.startX;
            state.translateY = e.clientY - state.startY;
            updateTransform();
        });
        
        document.addEventListener('mouseup', () => {
            if (state.isPanning) {
                state.isPanning = false;
                wrapper.style.cursor = 'grab';
            }
        });
        
        wrapper.style.cursor = 'grab';
    });
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
    
    mermaid.initialize({ 
        startOnLoad: false,
        theme: getCurrentTheme(),
        gantt: {
            useWidth: 1200,
            useMaxWidth: false
        }
    });
    
    // Find all mermaid wrappers and re-render them
    document.querySelectorAll('.mermaid-wrapper').forEach(wrapper => {
        const originalCode = wrapper.getAttribute('data-mermaid-code');
        if (originalCode) {
            console.log(`Processing wrapper: ${wrapper.id}`);
            console.log('BEFORE clear - wrapper height:', window.getComputedStyle(wrapper).height);
            console.log('BEFORE clear - wrapper rect:', wrapper.getBoundingClientRect());
            
            // Preserve the current computed height before clearing (height should already be set explicitly)
            const currentHeight = wrapper.getBoundingClientRect().height;
            console.log('Preserving height:', currentHeight);
            wrapper.style.height = currentHeight + 'px';
            
            // Delete the old state so it can be recreated
            delete mermaidStates[wrapper.id];
            
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
        console.log('Mermaid re-render complete, calling initMermaidInteraction in 100ms');
        setTimeout(() => {
            initMermaidInteraction();
            console.groupEnd();
        }, 100);
    });
}

console.log('🚀 Initial Mermaid setup - Theme:', getCurrentTheme());
mermaid.initialize({ 
    startOnLoad: true,
    theme: getCurrentTheme(),
    gantt: {
        useWidth: 1200,
        useMaxWidth: false
    }
});

// Track if this is the initial load
let isInitialLoad = true;

// Initialize interaction after mermaid renders
mermaid.run().then(() => {
    console.log('Initial mermaid render complete');
    setTimeout(() => {
        console.log('Calling initial initMermaidInteraction');
        initMermaidInteraction();
        
        // After initial render, set explicit heights on all wrappers so theme switching works
        document.querySelectorAll('.mermaid-wrapper').forEach(wrapper => {
            const currentHeight = wrapper.getBoundingClientRect().height;
            console.log(`Setting initial height for ${wrapper.id}:`, currentHeight);
            wrapper.style.height = currentHeight + 'px';
        });
        isInitialLoad = false;
    }, 100);
});

// Reveal current file in sidebar
function revealInSidebar(event) {
    if (event) {
        event.stopPropagation(); // Prevent collapsing the sidebar
        event.preventDefault(); // Prevent default button behavior
    }
    
    const currentPath = window.location.pathname.replace(/^\/posts\//, '');
    const activeLink = document.querySelector(`.post-link[data-path="${currentPath}"]`);
    
    if (activeLink) {
        // Expand all parent details elements
        let parent = activeLink.closest('details');
        while (parent) {
            parent.open = true;
            parent = parent.parentElement.closest('details');
        }
        
        // Scroll to the active link
        const scrollContainer = document.getElementById('sidebar-scroll-container');
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
        activeLink.classList.add('ring-2', 'ring-blue-500', 'ring-offset-2');
        setTimeout(() => {
            activeLink.classList.remove('ring-2', 'ring-blue-500', 'ring-offset-2');
        }, 1500);
    }
}

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
function updateActiveTocLink() {
    const headings = document.querySelectorAll('h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]');
    const tocLinks = document.querySelectorAll('.toc-link');
    
    let activeHeading = null;
    headings.forEach(heading => {
        const rect = heading.getBoundingClientRect();
        if (rect.top <= 100) {
            activeHeading = heading;
        }
    });
    
    tocLinks.forEach(link => {
        const anchor = link.getAttribute('data-anchor');
        if (activeHeading && anchor === activeHeading.id) {
            link.classList.add('bg-blue-50', 'dark:bg-blue-900/20', 'text-blue-600', 'dark:text-blue-400', 'font-semibold');
        } else {
            link.classList.remove('bg-blue-50', 'dark:bg-blue-900/20', 'text-blue-600', 'dark:text-blue-400', 'font-semibold');
        }
    });
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

// Re-run mermaid on HTMX content swaps
document.body.addEventListener('htmx:afterSwap', function() {
    mermaid.run().then(() => {
        setTimeout(initMermaidInteraction, 100);
    });
    updateActivePostLink();
    updateActiveTocLink();
    initMobileMenus(); // Reinitialize mobile menu handlers
    
    // Reattach reveal button handler (in case sidebar was swapped)
    const revealBtn = document.getElementById('reveal-in-sidebar-btn');
    if (revealBtn) {
        revealBtn.removeEventListener('click', revealInSidebar); // Remove old listener
        revealBtn.addEventListener('click', revealInSidebar); // Add new listener
    }
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

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    updateActivePostLink();
    updateActiveTocLink();
    initMobileMenus();
    
    // Attach reveal button click handler
    const revealBtn = document.getElementById('reveal-in-sidebar-btn');
    if (revealBtn) {
        revealBtn.addEventListener('click', revealInSidebar);
    }
});