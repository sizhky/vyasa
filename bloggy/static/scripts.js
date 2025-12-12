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
            
            const delta = e.deltaY > 0 ? 0.95 : 1.05;
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

// Re-run mermaid on HTMX content swaps
document.body.addEventListener('htmx:afterSwap', function() {
    mermaid.run().then(() => {
        setTimeout(initMermaidInteraction, 100);
    });
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