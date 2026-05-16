function handleCodeCopyClick(event) {
    const button = event.target.closest('.code-copy-button, .hljs-copy-button');
    if (!button) {
        return;
    }
    event.preventDefault();
    event.stopPropagation();
    const container = button.closest('.code-block') || button.closest('pre') || button.parentElement;
    const codeEl = (container && container.querySelector('pre > code')) ||
        (container && container.querySelector('code')) ||
        button.closest('pre');
    if (!codeEl) {
        return;
    }
    const text = codeEl.innerText || codeEl.textContent || '';
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

function switchTab(tabsId, index) {
    const container = document.querySelector(`.tabs-container[data-tabs-id="${tabsId}"]`);
    if (!container) return;
    const buttons = container.querySelectorAll('.tab-button');
    buttons.forEach((btn, i) => btn.classList.toggle('active', i === index));
    const panels = container.querySelectorAll('.tab-panel');
    panels.forEach((panel, i) => {
        const active = i === index;
        panel.classList.toggle('active', active);
        panel.style.position = active ? 'relative' : 'absolute';
        panel.style.visibility = active ? 'visible' : 'hidden';
        panel.style.opacity = active ? '1' : '0';
        panel.style.pointerEvents = active ? 'auto' : 'none';
    });
    const activePanel = container.querySelector(`.tab-panel[data-tab-index="${index}"]`);
    if (activePanel) {
        window.__vyasaRenderMermaidInScope?.(activePanel);
        window.__vyasaRenderD2?.(activePanel);
    }
    if (window.refreshVyasaTableScrollShadows) {
        requestAnimationFrame(() => window.refreshVyasaTableScrollShadows(container));
    }
}
window.switchTab = switchTab;

function initTabPanelHeights(rootElement = document) {
    const containers = rootElement.querySelectorAll('.tabs-container');
    containers.forEach((container) => {
        const panels = container.querySelectorAll('.tab-panel');
        let maxHeight = 0;
        panels.forEach((panel) => {
            const wasActive = panel.classList.contains('active');
            panel.style.position = 'relative';
            panel.style.visibility = 'visible';
            panel.style.opacity = '1';
            panel.style.pointerEvents = 'auto';
            maxHeight = Math.max(maxHeight, panel.offsetHeight);
            if (!wasActive) {
                panel.style.position = 'absolute';
                panel.style.visibility = 'hidden';
                panel.style.opacity = '0';
                panel.style.pointerEvents = 'none';
            }
        });
        const tabsContent = container.querySelector('.tabs-content');
        if (tabsContent && maxHeight > 0) tabsContent.style.minHeight = `${maxHeight}px`;
    });
}

function refreshVyasaTableScrollShadows(root = document) {
    const scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll('.vyasa-table-scroll').forEach((el) => {
        const table = el.querySelector('table');
        const parentWidth = el.parentElement ? el.parentElement.clientWidth : el.clientWidth;
        const tableWidth = table ? table.scrollWidth : el.scrollWidth;
        const needsBreakout = tableWidth > (parentWidth + 1);
        const viewportCap = Math.floor(window.innerWidth * 0.8);
        el.classList.toggle('vyasa-table-breakout', needsBreakout);
        if (needsBreakout) el.style.setProperty('--vyasa-breakout-width', `${Math.min(tableWidth, viewportCap)}px`);
        else el.style.removeProperty('--vyasa-breakout-width');
        const maxScrollLeft = Math.max(0, el.scrollWidth - el.clientWidth);
        el.classList.toggle('has-left-overflow', maxScrollLeft > 1 && el.scrollLeft > 1);
        el.classList.toggle('has-right-overflow', maxScrollLeft > 1 && el.scrollLeft < (maxScrollLeft - 1));
        if (el.dataset.shadowBound === '1') return;
        el.dataset.shadowBound = '1';
        el.addEventListener('scroll', () => refreshVyasaTableScrollShadows(el.parentElement || document), { passive: true });
    });
}

window.refreshVyasaTableScrollShadows = refreshVyasaTableScrollShadows;


function normalizeSidebarPath(pathname) {
    const decoded = decodeURIComponent(pathname || '');
    const trimmed = decoded
        .replace(/^\/posts\//, '')
        .replace(/(?:\.pdf)$/, '');
    return trimmed.replace(/\/+$/, '');
}

// Reveal current file in sidebar
function revealInSidebar(rootElement = document, explicitPath = null) {
    if (!explicitPath && !window.location.pathname.startsWith('/posts/')) {
        return;
    }

    const currentPath = explicitPath || normalizeSidebarPath(window.location.pathname);
    const activeLink = rootElement.querySelector(`.post-link[data-path="${currentPath}"]`);
    
    if (activeLink) {
        const postsSection = activeLink.closest('details[data-section="posts-tree"]');
        const postsSectionOpen = !postsSection || postsSection.open;

        // Expand folder parents, but do not force sidebar subsections open.
        let parent = activeLink.closest('details');
        while (parent && rootElement.contains(parent)) {
            if (!parent.matches('details[data-section]')) {
                parent.open = true;
            }
            if (parent === rootElement) {
                break;
            }
            parent = parent.parentElement.closest('details');
        }
        
        // Scroll only when the posts section is visible.
        const scrollContainer = postsSectionOpen ? rootElement.querySelector('#sidebar-scroll-container') : null;
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
    }
}
window.__vyasaRevealInSidebar = revealInSidebar;

function focusCurrentPostInSidebar(source = document) {
    const sidebar = source?.closest?.('details[data-sidebar="posts"]') || document.querySelector('details[data-sidebar="posts"]');
    if (!sidebar) {
        return;
    }
    sidebar.open = true;
    sidebar.querySelectorAll('details[data-section="posts-tree"]').forEach((section) => {
        section.open = true;
    });
    revealInSidebar(sidebar);
}
window.focusCurrentPostInSidebar = focusCurrentPostInSidebar;

function postsHoverExpandAvailable() {
    return true;
}

function postsHoverExpandEnabled() {
    if (!postsHoverExpandAvailable()) return false;
    try {
        return localStorage.getItem('vyasa:postsHoverExpand') === '1';
    } catch (err) {
        return false;
    }
}

function syncPostsHoverToggleButtons(root = document) {
    const enabled = postsHoverExpandEnabled();
    root.querySelectorAll?.('[data-sidebar-hover-toggle="true"]').forEach((button) => {
        button.dataset.hoverExpandEnabled = enabled ? 'true' : 'false';
        button.setAttribute('aria-pressed', enabled ? 'true' : 'false');
        const tooltip = enabled ? 'Disable folder hover expand' : 'Enable folder hover expand';
        button.dataset.tooltip = tooltip;
        button.setAttribute('aria-label', tooltip);
    });
}

function togglePostsHoverExpand(root = document) {
    if (!postsHoverExpandAvailable()) return;
    const next = !postsHoverExpandEnabled();
    try {
        localStorage.setItem('vyasa:postsHoverExpand', next ? '1' : '0');
    } catch (err) {}
    syncPostsHoverToggleButtons(root || document);
}
window.togglePostsHoverExpand = togglePostsHoverExpand;

function initPostsSidebarAutoReveal() {
    const postSidebars = document.querySelectorAll('details[data-sidebar="posts"]');
    let persistedSidebarState = {};
    try {
        persistedSidebarState = JSON.parse(localStorage.getItem('vyasa:postsSidebarState') || '{}');
    } catch (err) {
        persistedSidebarState = {};
    }
    const pendingSidebarState = window.__vyasaPendingPostsSidebarState || null;
    
    postSidebars.forEach((sidebar) => {
        const libraryShouldBeOpen = pendingSidebarState
            ? !!pendingSidebarState.library
            : (window.__vyasaPostsSidebarWasOpen || persistedSidebarState.library === true);
        if (libraryShouldBeOpen && !sidebar.open) {
            sidebar.open = true;
        }
        const sectionState = pendingSidebarState
            ? { ...(pendingSidebarState.sections || {}) }
            : { ...persistedSidebarState.sections, ...(window.__vyasaPostsSidebarSectionState || {}) };
        sidebar.querySelectorAll('details[data-section]').forEach((section) => {
            const key = section.getAttribute('data-section');
            if (Object.prototype.hasOwnProperty.call(sectionState, key)) {
                section.open = !!sectionState[key];
            }
        });
        if (sidebar.open) {
            const pendingRevealPath = window.__vyasaPendingRevealPath || null;
            if (pendingRevealPath) window.__vyasaPendingRevealPath = null;
            revealInSidebar(sidebar, pendingRevealPath);
        }
        if (sidebar.dataset.revealBound === 'true') {
            return;
        }
        sidebar.dataset.revealBound = 'true';
        
        sidebar.addEventListener('toggle', () => {
            try {
                const saved = JSON.parse(localStorage.getItem('vyasa:postsSidebarState') || '{}');
                localStorage.setItem('vyasa:postsSidebarState', JSON.stringify({ ...saved, library: sidebar.open }));
            } catch (err) {}
            if (!sidebar.open) {
                return;
            }
            revealInSidebar(sidebar);
        });
        sidebar.querySelectorAll('details[data-section]').forEach((section) => {
            section.addEventListener('toggle', () => {
                const key = section.getAttribute('data-section');
                const nextState = { ...(window.__vyasaPostsSidebarSectionState || {}), [key]: section.open };
                window.__vyasaPostsSidebarSectionState = nextState;
                try {
                    const saved = JSON.parse(localStorage.getItem('vyasa:postsSidebarState') || '{}');
                    localStorage.setItem('vyasa:postsSidebarState', JSON.stringify({ ...saved, sections: { ...(saved.sections || {}), [key]: section.open } }));
                } catch (err) {}
            });
        });
    });
}

function initFolderChevronState(rootElement = document) {
    rootElement.querySelectorAll('details[data-folder="true"]').forEach((details) => {
        details.classList.toggle('is-open', details.open);
    });
}
window.__vyasaInitFolderChevronState = initFolderChevronState;


function loadSidebarFolderBranch(details) {
    const summary = details?.querySelector(':scope > summary[hx-get]');
    const branch = details?.querySelector(':scope > ul');
    const branchHref = summary?.getAttribute('hx-get');
    if (!summary || !branch || !branchHref || details.dataset.hoverBranchLoaded === 'true' || details.dataset.hoverBranchLoading === 'true') {
        return;
    }
    const hasContent = Array.from(branch.children).some((child) => child.textContent.trim());
    if (hasContent) {
        details.dataset.hoverBranchLoaded = 'true';
        return;
    }
    details.dataset.hoverBranchLoading = 'true';
    const onDone = () => {
        details.dataset.hoverBranchLoading = 'false';
        details.dataset.hoverBranchLoaded = 'true';
        initFolderHoverExpand(branch);
        initFolderChevronState();
    };
    if (window.htmx?.ajax) {
        const request = window.htmx.ajax('GET', branchHref, { target: branch, swap: 'innerHTML' });
        if (request && typeof request.then === 'function') {
            request.then(onDone).catch(() => {
                details.dataset.hoverBranchLoading = 'false';
            });
        } else {
            const onSwap = (event) => {
                if (event.target !== branch) return;
                document.body.removeEventListener('htmx:afterSwap', onSwap);
                onDone();
            };
            document.body.addEventListener('htmx:afterSwap', onSwap);
        }
        return;
    }
    fetch(branchHref, { credentials: 'same-origin' })
        .then((response) => response.ok ? response.text() : Promise.reject(new Error('branch load failed')))
        .then((html) => {
            branch.innerHTML = html;
            onDone();
        })
        .catch(() => {
            details.dataset.hoverBranchLoading = 'false';
        });
}

function bindFolderHoverExpand(details) {
    if (!(details instanceof HTMLDetailsElement) || details.dataset.hoverExpandBound === 'true') {
        return;
    }
    details.dataset.hoverExpandBound = 'true';
    let leaveTimer = null;
    details.addEventListener('mouseenter', () => {
        if (!postsHoverExpandEnabled()) return;
        if (leaveTimer) {
            window.clearTimeout(leaveTimer);
            leaveTimer = null;
        }
        details.dataset.hoverOpened = 'true';
        details.open = true;
        loadSidebarFolderBranch(details);
    });
    details.addEventListener('mouseleave', () => {
        if (!postsHoverExpandEnabled()) return;
        leaveTimer = window.setTimeout(() => {
            if (details.matches(':hover')) return;
            if (details.dataset.hoverOpened === 'true') {
                details.open = false;
            }
        }, 120);
    });
}

function initFolderHoverExpand(root = document) {
    const postsSidebar = root?.id === 'posts-sidebar' ? root : root?.querySelector?.('#posts-sidebar') || document.getElementById('posts-sidebar');
    if (!postsSidebar || !postsHoverExpandEnabled()) return;
    postsSidebar.querySelectorAll('details[data-folder="true"]').forEach(bindFolderHoverExpand);
}

document.addEventListener('toggle', (event) => {
    const details = event.target;
    if (!(details instanceof HTMLDetailsElement)) {
        return;
    }
    if (details.matches('.vyasa-heading-fold')) {
        details.classList.toggle('is-open', details.open);
        return;
    }
    if (!details.matches('details[data-folder="true"], details[data-section]')) {
        return;
    }
    details.classList.toggle('is-open', details.open);
}, true);

document.addEventListener('click', (event) => {
    const sidebarLocate = event.target.closest('[data-sidebar-locate-current="true"]');
    if (sidebarLocate) {
        event.preventDefault();
        event.stopPropagation();
        focusCurrentPostInSidebar(sidebarLocate);
        return;
    }
    const hoverToggle = event.target.closest('[data-sidebar-hover-toggle="true"]');
    if (hoverToggle) {
        event.preventDefault();
        event.stopPropagation();
        togglePostsHoverExpand(document);
        return;
    }
    const toggle = event.target.closest('[data-vyasa-fold-all]');
    if (toggle) {
        const main = document.getElementById('main-content');
        const folds = Array.from(main?.querySelectorAll('.vyasa-heading-fold') || []);
        const shouldOpen = toggle.dataset.vyasaFoldAll !== 'open';
        folds.forEach((fold) => { fold.open = shouldOpen; });
        toggle.dataset.vyasaFoldAll = shouldOpen ? 'open' : 'closed';
        toggle.innerHTML = shouldOpen
            ? '<svg viewBox="0 0 24 24" aria-hidden="true" class="vyasa-fold-all-icon"><path d="M6 7h12"/><path d="M6 12h8"/><path d="M6 17h5"/><path d="m15 10 3 3 3-3"/></svg><span>Fold all</span>'
            : '<svg viewBox="0 0 24 24" aria-hidden="true" class="vyasa-fold-all-icon"><path d="M6 7h12"/><path d="M6 12h8"/><path d="M6 17h5"/><path d="m15 14 3-3 3 3"/></svg><span>Unfold all</span>';
        syncHeadingActionStates(document);
        return;
    }
    const headingAction = event.target.closest('[data-heading-action]');
    if (headingAction) {
        event.preventDefault();
        event.stopPropagation();
        const details = headingAction.closest('.vyasa-heading-fold');
        if (!(details instanceof HTMLDetailsElement)) return;
        const descendants = Array.from(details.querySelectorAll(':scope > .vyasa-heading-fold-body .vyasa-heading-fold'));
        const shouldOpen = !details.open || descendants.some((fold) => !fold.open);
        if (shouldOpen) {
            details.open = true;
            descendants.forEach((fold) => { fold.open = true; });
            syncHeadingActionStates(document);
            return;
        }
        descendants.forEach((fold) => { fold.open = false; });
        syncHeadingActionStates(document);
        return;
    }
    const summary = event.target.closest('.vyasa-heading-fold-summary');
    if (!summary || event.target.closest('.vyasa-heading-permalink, .vyasa-heading-launch')) {
        return;
    }
    event.preventDefault();
    const details = summary.parentElement;
    if (details instanceof HTMLDetailsElement) {
        details.open = !details.open;
        syncHeadingActionStates(document);
    }
});

function syncHeadingActionStates(root = document) {
    (root.querySelectorAll?.('.vyasa-heading-action-children') || []).forEach((button) => {
        const details = button.closest('.vyasa-heading-fold');
        if (!(details instanceof HTMLDetailsElement)) return;
        const descendants = Array.from(details.querySelectorAll(':scope > .vyasa-heading-fold-body .vyasa-heading-fold'));
        button.hidden = descendants.length === 0;
        const allOpen = details.open && descendants.every((fold) => fold.open);
        button.dataset.subtreeState = allOpen ? 'collapse' : 'expand';
        button.setAttribute('aria-label', allOpen ? 'Collapse child sections' : 'Expand child sections');
    });
}

// Update active post link in sidebar
function updateActivePostLink(explicitPath = null) {
    const currentPath = explicitPath || normalizeSidebarPath(window.location.pathname);
    document.querySelectorAll('.vyasa-tree-row').forEach(row => {
        row.classList.remove('is-active');
    });
    document.querySelectorAll('.post-link').forEach(link => {
        const linkPath = normalizeSidebarPath(link.getAttribute('data-path') || '');
        if (linkPath === currentPath) {
            link.closest('.vyasa-tree-row')?.classList.add('is-active');
        }
    });
}

// Update active TOC link based on scroll position
let lastActiveTocAnchor = null;
function alignToCurrentHash() {
    const hash = window.location.hash;
    if (!hash || hash === '#') {
        return;
    }
    const id = decodeURIComponent(hash.slice(1));
    const target = document.getElementById(id);
    if (!target) {
        return;
    }
    for (let parent = target.parentElement; parent; parent = parent.parentElement) {
        if (parent.matches?.('.vyasa-heading-fold')) parent.open = true;
    }
    target.scrollIntoView({ block: 'start' });
    requestAnimationFrame(() => target.scrollIntoView({ block: 'start' }));
}

function scheduleHashAlignment() {
    alignToCurrentHash();
    [80, 220, 500, 1200].forEach((delay) => setTimeout(alignToCurrentHash, delay));
}

function initHeadingFolds(root = document) {
    const main = root.id === 'main-content' ? root : root.querySelector?.('#main-content');
    if (!main || main.dataset.headingFoldsInit === '1') return;
    if (main.querySelector('.vyasa-zen-content')) return;
    let createdFold = false;
    const containers = [main, ...main.querySelectorAll('div, section, article')].filter((el) =>
        !el.closest('.vyasa-heading-fold-body') &&
        Array.from(el.children).some((child) => /^H[1-6]$/.test(child.tagName))
    );
    containers.forEach((container) => {
        if (container.dataset.headingFoldsInit === '1') return;
        const nodes = Array.from(container.childNodes);
        const stack = [{ level: 0, body: container }];
        nodes.forEach((node) => {
            const match = node instanceof HTMLElement ? node.tagName.match(/^H([1-6])$/) : null;
            if (node instanceof HTMLElement && node.matches('.vyasa-page-title')) {
                stack.at(-1).body.appendChild(node);
                return;
            }
            if (!match || node.closest('.vyasa-heading-fold')) return void stack.at(-1).body.appendChild(node);
            const level = Number(match[1]);
            while (stack.length > 1 && stack.at(-1).level >= level) stack.pop();
            const fold = document.createElement('details');
            const summary = document.createElement('summary');
            const body = document.createElement('div');
            const chevron = document.createElement('span');
            fold.className = 'vyasa-heading-fold';
            fold.dataset.level = `h${level}`;
            fold.open = true;
            fold.classList.add('is-open');
            createdFold = true;
            summary.className = 'vyasa-heading-fold-summary';
            body.className = 'vyasa-heading-fold-body';
            chevron.className = 'vyasa-heading-fold-chevron';
            chevron.setAttribute('aria-hidden', 'true');
            summary.append(node, chevron);
            fold.append(summary, body);
            stack.at(-1).body.appendChild(fold);
            stack.push({ level, body });
        });
        container.dataset.headingFoldsInit = '1';
    });
    const actions = main.querySelector('[data-vyasa-page-actions]');
    if (createdFold && actions && !main.querySelector('[data-vyasa-fold-all]')) {
        const control = document.createElement('button');
        control.type = 'button';
        control.className = 'vyasa-fold-all-button';
        control.dataset.vyasaFoldAll = 'open';
        control.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" class="vyasa-fold-all-icon"><path d="M6 7h12"/><path d="M6 12h8"/><path d="M6 17h5"/><path d="m15 10 3 3 3-3"/></svg><span>Fold all</span>';
        const copyButton = Array.from(actions.querySelectorAll('button')).find((button) => button.textContent?.includes('Copy Markdown'));
        actions.insertBefore(control, copyButton);
    }
    main.dataset.headingFoldsInit = '1';
}

function initScrollTopButton(root = document) {
    const page = root.getElementById?.('page-container') || document.getElementById('page-container');
    if (!page || document.getElementById('vyasa-scroll-top')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'vyasa-scroll-top';
    button.className = 'vyasa-scroll-top-button';
    button.setAttribute('aria-label', 'Go to top');
    button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" class="vyasa-scroll-top-icon"><path d="M12 19V7"/><path d="m6.75 12.25 5.25-5.25 5.25 5.25"/></svg>';
    button.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    document.body.appendChild(button);
    const sync = () => {
        const main = document.getElementById('main-content');
        const rect = main?.getBoundingClientRect();
        if (rect) {
            const left = Math.max(16, rect.right - button.offsetWidth);
            button.style.left = `${left}px`;
        }
        button.classList.toggle('is-visible', window.scrollY > 0);
    };
    window.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync, { passive: true });
    sync();
}

function initMobileScrollProgress(root = document) {
    const page = root.getElementById?.('page-container') || document.getElementById('page-container');
    if (!page) return;
    let bar = document.getElementById('vyasa-mobile-scroll-progress');
    if (!bar) {
        bar = document.createElement('div');
        bar.id = 'vyasa-mobile-scroll-progress';
        bar.className = 'vyasa-mobile-scroll-progress';
        bar.setAttribute('aria-hidden', 'true');
        page.appendChild(bar);
    }
    const sync = () => {
        const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        const progress = Math.min(1, Math.max(0, window.scrollY / max));
        bar.style.height = `${Math.round(progress * window.innerHeight)}px`;
    };
    window.__vyasaSyncMobileScrollProgress = sync;
    if (!window.__vyasaMobileScrollProgressBound) {
        window.addEventListener('scroll', () => window.__vyasaSyncMobileScrollProgress?.(), { passive: true });
        window.addEventListener('resize', () => window.__vyasaSyncMobileScrollProgress?.(), { passive: true });
        window.__vyasaMobileScrollProgressBound = true;
    }
    sync();
}

function normalizeCriticalTextColors(root = document) {
    const ink = getComputedStyle(document.documentElement).getPropertyValue('--vyasa-ink').trim() || '#2d3434';
    root.querySelectorAll('#main-content h1, #main-content h2, #main-content h3, #main-content h4, #main-content h5, #main-content h6').forEach((el) => {
        el.style.color = ink;
        el.style.opacity = '1';
    });
    root.querySelectorAll('.vyasa-sidebar-toggle, .vyasa-sidebar-toggle *, .vyasa-sidebar-body, .vyasa-sidebar-body a, .vyasa-sidebar-body span, .vyasa-sidebar-body div, .vyasa-sidebar-body li, .toc-link').forEach((el) => {
        el.style.color = ink;
        el.style.opacity = '1';
    });
}

function recordStyleProbe(label) {
    const html = document.documentElement;
    const page = document.getElementById('page-container');
    const heading = document.querySelector('#main-content h1, #main-content h2, #main-content h3');
    const toc = document.querySelector('.toc-link');
    const rootStyles = getComputedStyle(html);
    const pageStyles = page ? getComputedStyle(page) : null;
    function matchedVariableRules(el) {
        if (!el) return [];
        const hits = [];
        for (const sheet of Array.from(document.styleSheets || [])) {
            let rules;
            try { rules = sheet.cssRules; } catch (e) { continue; }
            for (const rule of Array.from(rules || [])) {
                if (!rule.selectorText) continue;
                try {
                    if (el.matches(rule.selectorText) && (
                        rule.style.getPropertyValue('--vyasa-ink') ||
                        rule.style.getPropertyValue('--vyasa-paper') ||
                        rule.style.getPropertyValue('--vyasa-paper-low')
                    )) {
                        hits.push({
                            selector: rule.selectorText,
                            ink: rule.style.getPropertyValue('--vyasa-ink') || '',
                            paper: rule.style.getPropertyValue('--vyasa-paper') || '',
                            paperLow: rule.style.getPropertyValue('--vyasa-paper-low') || '',
                            href: sheet.href || 'inline',
                        });
                    }
                } catch (e) {}
            }
        }
        return hits.slice(-20);
    }
    const pick = (el) => el ? {
        text: (el.textContent || '').trim().slice(0, 80),
        color: getComputedStyle(el).color,
        opacity: getComputedStyle(el).opacity,
        classes: el.className,
    } : null;
    const samples = JSON.parse(localStorage.getItem('vyasa:lastStyleProbe') || '[]');
    samples.push({
        label,
        t: Date.now(),
        htmlClass: html.className,
        vars: {
            rootInk: rootStyles.getPropertyValue('--vyasa-ink').trim(),
            rootPaper: rootStyles.getPropertyValue('--vyasa-paper').trim(),
            rootPaperLow: rootStyles.getPropertyValue('--vyasa-paper-low').trim(),
            pageInk: pageStyles ? pageStyles.getPropertyValue('--vyasa-ink').trim() : '',
            pagePaper: pageStyles ? pageStyles.getPropertyValue('--vyasa-paper').trim() : '',
            pagePaperLow: pageStyles ? pageStyles.getPropertyValue('--vyasa-paper-low').trim() : '',
            pageColor: pageStyles ? pageStyles.color : '',
        },
        matches: {
            html: matchedVariableRules(html),
            page: matchedVariableRules(page),
        },
        heading: pick(heading),
        toc: pick(toc),
    });
    localStorage.setItem('vyasa:lastStyleProbe', JSON.stringify(samples.slice(-12)));
}

function isLightweightSearchSwap(target) {
    return !!target?.closest?.('.posts-search-results, .vyasa-command-palette-results');
}

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
            link.classList.add('is-active', 'font-semibold');
        } else {
            link.classList.remove('is-active', 'font-semibold');
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
    alignToCurrentHash();
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
            const active = item.getAttribute('data-anchor') === anchor;
            item.classList.toggle('is-active', active);
            item.classList.toggle('font-semibold', active);
        });
        lastActiveTocAnchor = anchor;
        updateActiveTocLink();
    });
});

document.body.addEventListener('htmx:afterSwap', function(event) {
    if (isLightweightSearchSwap(event.target)) {
        window.__vyasaInitBookmarksButtons?.(event.target);
        return;
    }
    const swapScope = event.target || document;
    window.__vyasaRenderMermaidInScope?.(swapScope);
    window.__vyasaRenderD2?.(swapScope);
    window.__vyasaRenderTasksGraphs?.(swapScope);
    initHeadingFolds(swapScope);
    normalizeCriticalTextColors(swapScope);
    scheduleHashAlignment();
    updateActivePostLink();
    updateActiveTocLink();
    initMobileMenus(); // Reinitialize mobile menu handlers
    // Only reveal/scroll sidebar when main content changes, not on sidebar tree folder expansions
    const isMainContentSwap = event.target?.id === 'main-content';
    if (isMainContentSwap) {
        initPostsSidebarAutoReveal();
    }
    if (event.target?.id === 'posts-sidebar') {
        window.__vyasaPostsSidebarWasOpen = false;
    }
    initFolderChevronState();
    initFolderHoverExpand(event.target || document);
    syncPostsHoverToggleButtons(event.target || document);
    window.__vyasaInitSearchPlaceholderCycle?.(event.target || document);
    initCodeBlockCopyButtons(event.target || document);
});

// Mobile menu toggle functionality
function initMobileMenus() {
    const getPostsPanel = () => document.getElementById('mobile-posts-panel');
    const getTocPanel = () => document.getElementById('mobile-toc-panel');
    const postsPanel = getPostsPanel();
    const tocPanel = getTocPanel();

    const togglePostsPanel = () => {
        const postsPanel = getPostsPanel();
        const tocPanel = getTocPanel();
        if (!postsPanel) return;
        const isOpen = postsPanel.classList.contains('translate-x-0');
        if (isOpen) {
            postsPanel.classList.remove('translate-x-0');
            postsPanel.classList.add('-translate-x-full');
            return;
        }
        postsPanel.classList.remove('-translate-x-full');
        postsPanel.classList.add('translate-x-0');
        postsPanel.querySelectorAll('details[data-sidebar="posts"]').forEach((sidebar) => {
            sidebar.open = true;
            revealInSidebar(sidebar);
        });
        if (tocPanel) {
            tocPanel.classList.remove('translate-x-0');
            tocPanel.classList.add('translate-x-full');
        }
    };

    const toggleTocPanel = () => {
        const tocPanel = getTocPanel();
        const postsPanel = getPostsPanel();
        if (!tocPanel) return;
        const isOpen = tocPanel.classList.contains('translate-x-0');
        if (isOpen) {
            tocPanel.classList.remove('translate-x-0');
            tocPanel.classList.add('translate-x-full');
            return;
        }
        tocPanel.classList.remove('translate-x-full');
        tocPanel.classList.add('translate-x-0');
        tocPanel.querySelectorAll('details').forEach((sidebar) => {
            sidebar.open = true;
        });
        if (postsPanel) {
            postsPanel.classList.remove('translate-x-0');
            postsPanel.classList.add('-translate-x-full');
        }
    };

    window.__vyasaTogglePostsPanel = togglePostsPanel;
    window.__vyasaToggleTocPanel = toggleTocPanel;

    if (!window.__vyasaMobileMenusBound) {
        document.addEventListener('click', (event) => {
            if (event.target.closest('#close-mobile-posts')) {
                event.preventDefault();
                const postsPanel = document.getElementById('mobile-posts-panel');
                postsPanel?.classList.remove('translate-x-0');
                postsPanel?.classList.add('-translate-x-full');
                return;
            }
            if (event.target.closest('#close-mobile-toc')) {
                event.preventDefault();
                const tocPanel = document.getElementById('mobile-toc-panel');
                tocPanel?.classList.remove('translate-x-0');
                tocPanel?.classList.add('translate-x-full');
            }
        });
        window.__vyasaMobileMenusBound = true;
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

        }
    }, true);
}

// Keyboard shortcuts for toggling sidebars
function initKeyboardShortcuts() {
    // Prewarm the selectors to avoid lazy compilation delays
    const postsSidebars = document.querySelectorAll('details[data-sidebar="posts"]');
    const tocSidebar = document.querySelector('#toc-sidebar details');
    const isMobileSidebarMode = () => window.matchMedia('(max-width: 1279px)').matches;
    
    document.addEventListener('keydown', (e) => {
        // Skip if user is typing in an input field
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
            return;
        }
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        
        // Z: Toggle posts panel
        if (e.key === 'z' || e.key === 'Z') {
            e.preventDefault();
            if (isMobileSidebarMode()) {
                window.__vyasaTogglePostsPanel?.();
                return;
            }
            const postsSidebars = document.querySelectorAll('details[data-sidebar="posts"]');
            postsSidebars.forEach(sidebar => {
                sidebar.open = !sidebar.open;
            });
        }
        
        // X: Toggle TOC panel
        if (e.key === 'x' || e.key === 'X') {
            e.preventDefault();
            if (isMobileSidebarMode()) {
                window.__vyasaToggleTocPanel?.();
                return;
            }
            const tocSidebar = document.querySelector('#toc-sidebar details');
            if (tocSidebar) {
                tocSidebar.open = !tocSidebar.open;
            }
        }

        if (e.key === 'c' || e.key === 'C') {
            const foldToggle = document.querySelector('#main-content [data-vyasa-fold-all]');
            if (!foldToggle) return;
            e.preventDefault();
            foldToggle.click();
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

function openIframeFullscreen(button) {
    const src = button.getAttribute('data-iframe-src');
    const title = button.getAttribute('data-iframe-title') || 'Embedded content';
    const allow = button.getAttribute('data-iframe-allow') || '';
    const allowfullscreen = button.getAttribute('data-iframe-allowfullscreen') === 'true';

    let overlay = document.querySelector('.iframe-fullscreen-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'iframe-fullscreen-overlay';
        overlay.innerHTML = `
            <div class="iframe-fullscreen-header">
                <div class="iframe-fullscreen-title"></div>
                <button type="button" class="iframe-fullscreen-close px-2 py-1 text-xs border rounded hover:bg-slate-700">
                    Close
                </button>
            </div>
            <div class="iframe-fullscreen-body">
                <iframe class="iframe-fullscreen-frame" frameborder="0"></iframe>
            </div>
        `;
        document.body.appendChild(overlay);

        overlay.addEventListener('click', (event) => {
            if (event.target.classList.contains('iframe-fullscreen-overlay')) {
                closeIframeFullscreen();
            }
        });

        overlay.querySelector('.iframe-fullscreen-close').addEventListener('click', () => {
            closeIframeFullscreen();
        });
    }

    overlay.querySelector('.iframe-fullscreen-title').textContent = title;
    const frame = overlay.querySelector('.iframe-fullscreen-frame');
    frame.setAttribute('src', src);
    frame.setAttribute('title', title);
    frame.setAttribute('allow', allow);
    if (allowfullscreen) {
        frame.setAttribute('allowfullscreen', '');
    } else {
        frame.removeAttribute('allowfullscreen');
    }

    document.body.classList.add('iframe-fullscreen-open');
    overlay.style.display = 'flex';
}

function closeIframeFullscreen() {
    const overlay = document.querySelector('.iframe-fullscreen-overlay');
    if (!overlay) {
        return;
    }
    const frame = overlay.querySelector('.iframe-fullscreen-frame');
    if (frame) {
        frame.setAttribute('src', 'about:blank');
    }
    overlay.style.display = 'none';
    document.body.classList.remove('iframe-fullscreen-open');
}

function initIframeFullscreenToggle() {
    document.addEventListener('click', (event) => {
        const button = event.target.closest('[data-iframe-fullscreen-toggle]');
        if (!button) {
            return;
        }
        event.preventDefault();
        openIframeFullscreen(button);
    });

    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') {
            return;
        }
        closeIframeFullscreen();
    });
}

function initJsonFocusToggle() {
    const close = () => document.getElementById('json-focus-modal')?.remove();
    document.addEventListener('click', (event) => {
        const button = event.target.closest('[data-json-focus-target]');
        if (!button) return;
        const textarea = document.getElementById(button.getAttribute('data-json-focus-target'));
        if (!textarea) return;
        const title = button.getAttribute('data-json-focus-title') || 'JSON';
        close();
        const modal = document.createElement('div');
        modal.id = 'json-focus-modal';
        modal.className = 'fixed inset-0 z-[10000] bg-black/80 backdrop-blur-sm p-4 flex items-center justify-center';
        modal.innerHTML = `<div class="w-full max-w-6xl h-[92vh] bg-white dark:bg-slate-950 rounded-xl shadow-2xl flex flex-col"><div class="flex items-center justify-between gap-3 p-4 border-b border-slate-200 dark:border-slate-800"><div class="text-sm font-semibold text-slate-900 dark:text-slate-100">${title}</div><div class="flex items-center gap-2"><button type="button" class="json-focus-save px-3 py-2 text-sm rounded-md bg-blue-600 text-white">Save</button><button type="button" class="json-focus-close px-3 py-2 text-sm rounded-md border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200">Close</button></div></div><div class="p-4 flex-1"><textarea class="w-full h-full vyasa-admin-json px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/85 dark:bg-slate-900/70"></textarea></div></div>`;
        const editor = modal.querySelector('textarea');
        editor.value = textarea.value;
        modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
        modal.querySelector('.json-focus-close').addEventListener('click', close);
        modal.querySelector('.json-focus-save').addEventListener('click', () => { textarea.value = editor.value; close(); });
        document.body.appendChild(modal);
        editor.focus();
    });
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape') close(); });
}

    const placeholder = '@@VYASA_DOLLAR@@';
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let node;
    while ((node = walker.nextNode())) if (node.nodeValue && node.nodeValue.includes(placeholder)) nodes.push(node);
    nodes.forEach((textNode) => {
        textNode.nodeValue = textNode.nodeValue.split(placeholder).join('\\$');
    });
}

function renderMathSafely(root) {
    if (typeof renderMathInElement !== 'function') return;
    const marker = '@@VYASA_CURRENCY_DOLLAR@@';
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
        const parent = node.parentElement;
        if (!parent || ['CODE', 'PRE', 'SCRIPT', 'STYLE', 'TEXTAREA'].includes(parent.tagName) || parent.closest('.katex')) continue;
        if (node.nodeValue && node.nodeValue.includes('$')) node.nodeValue = node.nodeValue.replace(/\$(?=\d)/g, marker);
    }
    renderMathInElement(root, { delimiters: [{ left: '$$', right: '$$', display: true }, { left: '$', right: '$', display: false }], throwOnError: false });
    walker.currentNode = root;
    while ((node = walker.nextNode())) if (node.nodeValue && node.nodeValue.includes(marker)) node.nodeValue = node.nodeValue.split(marker).join('$');
}

function initHighlightedCodeIncludes(root) {
    (root || document).querySelectorAll('code[data-code-highlight-lines], code[data-code-line-numbers="true"]').forEach((code) => {
        if (code.querySelector('.vyasa-code-line')) return;
        const start = Number(code.dataset.codeSourceStart || '1');
        const languageClass = Array.from(code.classList).find((cls) => cls.startsWith('language-'));
        const language = languageClass ? languageClass.replace(/^language-/, '') : '';
        const ranges = String(code.dataset.codeHighlightLines || '').split(',').map((part) => part.trim()).filter(Boolean);
        const highlighted = new Set();
        ranges.forEach((part) => {
            const [a, b] = part.split('-').map((value) => Number(value));
            for (let n = a; n <= (b || a); n += 1) highlighted.add(n);
        });
        const lines = code.textContent.split('\n');
        if (lines.length > 1 && lines[lines.length - 1] === '') {
            lines.pop();
        }
        code.innerHTML = lines.map((line, index) => {
            const lineNo = start + index;
            const isHighlighted = highlighted.has(lineNo);
            const isStart = isHighlighted && !highlighted.has(lineNo - 1);
            const isEnd = isHighlighted && !highlighted.has(lineNo + 1);
            const cls = [
                'vyasa-code-line',
                isHighlighted ? 'vyasa-code-line-highlight' : '',
                isStart ? 'vyasa-code-line-highlight-start' : '',
                isEnd ? 'vyasa-code-line-highlight-end' : '',
            ].filter(Boolean).join(' ');
            let htmlLine = line ? line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : '&nbsp;';
            if (line && window.hljs) {
                try {
                    htmlLine = language && window.hljs.getLanguage(language)
                        ? window.hljs.highlight(line, { language, ignoreIllegals: true }).value
                        : window.hljs.highlightAuto(line).value;
                } catch (_) {}
            }
            return `<span class="${cls}" data-source-line="${lineNo}">${htmlLine}</span>`;
        }).join('\n');
        code.classList.add('vyasa-code-lines');
        code.dataset.hljsBound = 'true';
    });
}

function scheduleHighlightedCodeIncludes(root) {
    const target = root || document;
    initCodeHighlighting(target);
    initHighlightedCodeIncludes(target);
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => { initCodeHighlighting(target); initHighlightedCodeIncludes(target); });
    [40, 140, 320].forEach((delay) => setTimeout(() => { initCodeHighlighting(target); initHighlightedCodeIncludes(target); }, delay));
}

function ensureFragmentStylesheets(root = document) {
    const scope = root instanceof Element || root instanceof Document ? root : document;
    scope.querySelectorAll('link[rel="stylesheet"][href]').forEach((link) => {
        const href = link.getAttribute('href');
        if (!href) return;
        if (!document.head.querySelector(`link[rel="stylesheet"][href="${CSS.escape(href)}"]`)) {
            document.head.appendChild(link.cloneNode(true));
        }
    });
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    ensureFragmentStylesheets(document);
    initHeadingFolds(document);
    syncHeadingActionStates(document);
    initScrollTopButton(document);
    initMobileScrollProgress(document);
    syncThemePresetDebug(document);
    replaceEscapedDollarPlaceholders(document.body);
    renderMathSafely(document.body);
    refreshVyasaTableScrollShadows(document);
    updateActivePostLink();
    updateActiveTocLink();
    initMobileMenus();
    initPostsSidebarAutoReveal();
    initFolderChevronState();
    window.__vyasaInitCommandPalette?.();
    initKeyboardShortcuts();
    initPdfFocusToggle();
    initIframeFullscreenToggle();
    initJsonFocusToggle();
    window.__vyasaInitSearchPlaceholderCycle?.(document);
    window.__vyasaInitPostsSearchPersistence?.(document);
    initCodeBlockCopyButtons(document);
    initHeadingPermalinkCopy(document);
    scheduleHighlightedCodeIncludes(document);
    window.__vyasaInitSearchClearButtons?.(document);
    ensurePdfFocusState();
    initTabPanelHeights(document);
    normalizeCriticalTextColors(document);
    recordStyleProbe('domcontentloaded');
    [100, 500, 1500].forEach((ms) => setTimeout(() => recordStyleProbe(`t+${ms}`), ms));
    scheduleHashAlignment();
});

document.body.addEventListener('htmx:afterSwap', (event) => {
    if (!event.target) {
        return;
    }
    ensureFragmentStylesheets(event.target);
    if (isLightweightSearchSwap(event.target)) {
        if (window.__vyasaInitBookmarksButtons) {
            window.__vyasaInitBookmarksButtons(event.target);
        }
        return;
    }
    initHeadingFolds(event.target);
    syncHeadingActionStates(document);
    initScrollTopButton(document);
    initMobileScrollProgress(document);
    syncThemePresetDebug(document);
    replaceEscapedDollarPlaceholders(event.target);
    renderMathSafely(event.target);
    refreshVyasaTableScrollShadows(event.target);
    window.__vyasaInitSearchPlaceholderCycle?.(event.target);
    window.__vyasaInitPostsSearchPersistence?.(event.target);
    initFolderHoverExpand(event.target || document);
    syncPostsHoverToggleButtons(event.target || document);
    initCodeBlockCopyButtons(event.target);
    initHeadingPermalinkCopy(event.target);
    scheduleHighlightedCodeIncludes(event.target);
    window.__vyasaInitSearchClearButtons?.(event.target);
    ensurePdfFocusState();
    initTabPanelHeights(event.target || document);
    if (event.target.id === 'posts-sidebar') {
        window.__vyasaPendingPostsSidebarState = null;
    }
});

window.addEventListener('load', () => {
    syncThemePresetDebug(document);
    normalizeCriticalTextColors(document);
    recordStyleProbe('load');
    scheduleHashAlignment();
    initFolderHoverExpand(document);
    syncPostsHoverToggleButtons(document);
    scheduleHighlightedCodeIncludes(document);
});

window.addEventListener('pageshow', () => {
    scheduleHashAlignment();
});

window.addEventListener('resize', () => refreshVyasaTableScrollShadows(document));

document.body.addEventListener('htmx:beforeRequest', (event) => {
    if (document.body.dataset.forceFullNav !== '1') {
        return;
    }
    const path = event?.detail?.requestConfig?.path || '';
    if (!path) {
        return;
    }
    event.preventDefault();
    window.location.assign(path);
});
