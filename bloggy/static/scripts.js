import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';

const mermaidStates = {};

function initMermaidInteraction() {
    document.querySelectorAll('.mermaid-wrapper').forEach(wrapper => {
        const svg = wrapper.querySelector('svg');
        if (!svg || mermaidStates[wrapper.id]) return;
        
        // Scale SVG to fit container (maintain aspect ratio, fit to width or height whichever is smaller)
        const wrapperRect = wrapper.getBoundingClientRect();
        const svgRect = svg.getBoundingClientRect();
        const scaleX = (wrapperRect.width - 32) / svgRect.width;  // 32 for p-4 padding (16px each side)
        const scaleY = (wrapperRect.height - 32) / svgRect.height;
        
        // For very wide diagrams (like Gantt charts), prefer width scaling even if it exceeds height
        const aspectRatio = svgRect.width / svgRect.height;
        let initialScale;
        if (aspectRatio > 3) {
            // Wide diagram: scale to fit width, allowing vertical scroll if needed
            initialScale = scaleX;
        } else {
            // Normal diagram: fit to smaller dimension, but allow upscaling up to 3x
            initialScale = Math.min(scaleX, scaleY, 3);
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
            const newScale = Math.min(Math.max(0.1, state.scale * delta), 10);
            
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

function getCurrentTheme() {
    return document.documentElement.classList.contains('dark') ? 'dark' : 'default';
}

function reinitializeMermaid() {
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
            // Delete the old state so it can be recreated
            delete mermaidStates[wrapper.id];
            
            // Decode HTML entities
            const textarea = document.createElement('textarea');
            textarea.innerHTML = originalCode;
            const code = textarea.value;
            
            // Clear the wrapper
            wrapper.innerHTML = '';
            
            // Re-add the pre element with mermaid code
            const newPre = document.createElement('pre');
            newPre.className = 'mermaid';
            newPre.textContent = code;
            wrapper.appendChild(newPre);
        }
    });
    
    // Re-run mermaid
    mermaid.run().then(() => {
        setTimeout(initMermaidInteraction, 100);
    });
}

mermaid.initialize({ 
    startOnLoad: true,
    theme: getCurrentTheme(),
    gantt: {
        useWidth: 1200,
        useMaxWidth: false
    }
});

// Initialize interaction after mermaid renders
mermaid.run().then(() => {
    setTimeout(initMermaidInteraction, 100);
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

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    updateActivePostLink();
    updateActiveTocLink();
    
    // Attach reveal button click handler
    const revealBtn = document.getElementById('reveal-in-sidebar-btn');
    if (revealBtn) {
        revealBtn.addEventListener('click', revealInSidebar);
    }
});