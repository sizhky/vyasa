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

function currentPostsSearchPath() {
    const currentPath = normalizeSidebarPath(window.location.pathname);
    const ref = new URLSearchParams(window.location.search).get('ref');
    if (!currentPath || !ref) return currentPath;
    const parts = currentPath.split('/').filter(Boolean);
    const alias = parts.shift();
    if (!alias) return currentPath;
    return `${alias}@${ref.replace(/\//g, ':')}${parts.length ? `/${parts.join('/')}` : ''}`;
}

function postsSearchUrl(query) {
    const params = new URLSearchParams();
    params.set('q', query || '');
    // current_path carries the active view's ref — the same single ref the
    // sidebar tree swaps in. Do NOT also send the localStorage ref union: it
    // pins other repos to stale refs and diverges search from the sidebar.
    params.set('current_path', currentPostsSearchPath());
    return `/_sidebar/posts/search?${params.toString()}`;
}

function installPostsSearchRequestState() {
    if (document.body?.dataset.postsSearchStateBound === 'true') return;
    if (!document.body) return;
    document.body.dataset.postsSearchStateBound = 'true';
    document.body.addEventListener('htmx:configRequest', (event) => {
        const path = event.detail?.path || event.detail?.requestConfig?.path || event.target?.getAttribute?.('hx-get') || '';
        if (!String(path).startsWith('/_sidebar/posts/search')) return;
        if (!event.detail?.parameters) return;
        event.detail.parameters.current_path = currentPostsSearchPath();
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

function escapeSearchHtml(text) {
    return text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function searchMatchIndices(text, query) {
    // Indices of `text` to bold, mirroring the server's matchers. Returns null
    // when nothing should be highlighted.
    if (query.length >= 2 && query.startsWith('/') && query.endsWith('/')) {
        try {
            const re = new RegExp(query.slice(1, -1), 'ig');
            const set = new Set();
            let m;
            while ((m = re.exec(text)) !== null) {
                if (m.index === re.lastIndex) re.lastIndex += 1; // never loop on zero-width
                for (let i = m.index; i < m.index + m[0].length; i += 1) set.add(i);
            }
            return set;
        } catch (err) {
            return null; // invalid regex -> server fell back to fuzzy; do the same
        }
    }
    // Normalize both sides 1:1 (length-preserving) so indices map back to `text`.
    const norm = (s) => s.toLowerCase().replace(/[-_\/]/g, ' ');
    const t = norm(text);
    const q = norm(query).trim();
    if (!q) return null;
    // Token-contiguous: every whitespace token as an in-order substring. This is
    // why "ws 011" bolds the literal `ws`/`011` runs instead of scattered letters.
    const set = new Set();
    let cursor = 0, ok = true;
    for (const tok of q.split(/\s+/).filter(Boolean)) {
        const idx = t.indexOf(tok, cursor);
        if (idx < 0) { ok = false; break; }
        for (let i = idx; i < idx + tok.length; i += 1) set.add(i);
        cursor = idx + tok.length;
    }
    if (ok && set.size) return set;
    // Subsequence fallback (separator-insensitive), matching the server.
    set.clear();
    const qchars = q.replace(/\s+/g, '');
    let qi = 0;
    for (let i = 0; i < t.length && qi < qchars.length; i += 1) {
        if (t[i] === qchars[qi]) { set.add(i); qi += 1; }
    }
    return set;
}

function highlightSearchMatches(container, rawQuery) {
    if (!container) return;
    const query = (rawQuery || '').trim();
    container.querySelectorAll('a[data-path] span[title]').forEach((span) => {
        const text = span.getAttribute('title') || span.textContent || '';
        const idx = query ? searchMatchIndices(text, query) : null;
        if (!idx || idx.size === 0) { span.textContent = text; return; } // idempotent reset
        let html = '', open = false;
        for (let i = 0; i < text.length; i += 1) {
            const hit = idx.has(i);
            if (hit && !open) { html += '<b class="search-match">'; open = true; }
            else if (!hit && open) { html += '</b>'; open = false; }
            html += escapeSearchHtml(text[i]);
        }
        span.innerHTML = open ? `${html}</b>` : html;
    });
}

function copyText(text, done) {
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopyText(text, done));
        return;
    }
    fallbackCopyText(text, done);
}

function fallbackCopyText(text, done) {
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

function initHeadingPermalinkCopy(root = document) {
    root.querySelectorAll('.vyasa-heading-permalink').forEach((link) => {
        if (link.dataset.copyBound === 'true') return;
        link.dataset.copyBound = 'true';
        link.addEventListener('click', (event) => {
            const url = new URL(link.getAttribute('href') || '', window.location.href).toString();
            event.preventDefault();
            history.replaceState(null, '', url);
            copyText(url, () => {
                link.classList.add('is-copied');
                clearTimeout(link._copiedTimer);
                link._copiedTimer = setTimeout(() => link.classList.remove('is-copied'), 1400);
            });
        });
    });
}

function assetAlreadyInstalled(tagName, url) {
    if (!url) return true;
    if (tagName === 'LINK') {
        return !!document.head.querySelector(`link[rel="stylesheet"][href="${url}"]`);
    }
    return !!document.head.querySelector(`script[src="${url}"]`)
        || !!Array.from(document.body.children || []).find((node) => (
            node.tagName === 'SCRIPT' && node.getAttribute('src') === url
        ));
}

async function ensureBundleAssets(root = document) {
    const assets = Array.from(root.querySelectorAll?.('[data-vyasa-bundle-asset="true"]') || []);
    for (const asset of assets) {
        const tagName = asset.tagName;
        const url = tagName === 'LINK' ? asset.getAttribute('href') : asset.getAttribute('src');
        if (assetAlreadyInstalled(tagName, url)) continue;
        await new Promise((resolve) => {
            const node = document.createElement(tagName.toLowerCase());
            for (const attr of Array.from(asset.attributes)) {
                if (attr.name === 'data-vyasa-bundle-asset') continue;
                node.setAttribute(attr.name, attr.value);
            }
            node.addEventListener('load', resolve, { once: true });
            node.addEventListener('error', resolve, { once: true });
            (tagName === 'LINK' ? document.head : document.body).appendChild(node);
        });
    }
}

function syncPostsSearchControls(block) {
    if (!block) return;
    const input = block.querySelector('.posts-search-block input[type="search"][name="q"]');
    const preview = block.querySelector('.posts-search-preview-button');
    const clear = block.querySelector('.posts-search-clear-button');
    if (!input) return;
    const hasValue = !!input.value.trim();
    const previewBase = preview?.dataset.searchPreviewBase || '/search/preview';
    const previewHref = hasValue ? `${previewBase}/s/${encodeSearchPreviewTerm(input.value.trim())}` : previewBase;
    if (preview) {
        preview.setAttribute('href', previewHref);
        preview.setAttribute('aria-hidden', hasValue ? 'false' : 'true');
        preview.setAttribute('tabindex', hasValue ? '0' : '-1');
        preview.style.opacity = hasValue ? '1' : '0';
        preview.style.pointerEvents = hasValue ? 'auto' : 'none';
    }
    if (clear) {
        clear.style.opacity = hasValue ? '1' : '0';
        clear.style.pointerEvents = hasValue ? 'auto' : 'none';
    }
}

function encodeSearchPreviewTerm(value) {
    const bytes = new TextEncoder().encode(value);
    let binary = '';
    bytes.forEach((byte) => {
        binary += String.fromCharCode(byte);
    });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeSearchPreviewTerm(token) {
    if (!token) return '';
    try {
        const normalized = token.replace(/-/g, '+').replace(/_/g, '/');
        const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
        const binary = atob(padded);
        const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
        return new TextDecoder().decode(bytes);
    } catch (err) {
        return '';
    }
}

function extractSearchResultsHtml(html) {
    const template = document.createElement('template');
    template.innerHTML = html || '';
    return template.content.querySelector('.posts-search-results-list')?.outerHTML || html || '';
}

function getPostsSearchTermFromLocation() {
    const path = window.location.pathname || '';
    const previewPrefix = '/search/preview/s/';
    if (!path.startsWith(previewPrefix)) {
        return '';
    }
    return decodeSearchPreviewTerm(path.slice(previewPrefix.length));
}

function openPostsSearchPreview(block) {
    if (!block) return;
    const input = block.querySelector('input[type="search"][name="q"]');
    const preview = block.querySelector('.posts-search-preview-button');
    const trimmed = input?.value.trim();
    if (!trimmed || !preview) {
        return;
    }
    const previewBase = preview.dataset.searchPreviewBase || '/search/preview';
    const previewHref = `${previewBase}/s/${encodeSearchPreviewTerm(trimmed)}`;
    preview.setAttribute('href', previewHref);
    if (window.htmx && typeof window.htmx.ajax === 'function') {
        window.htmx.ajax('GET', previewHref, {
            target: '#main-content',
            swap: 'outerHTML show:window:top settle:0.1s'
        }).then(() => {
            const currentUrl = `${window.location.pathname}${window.location.search}`;
            if (currentUrl !== previewHref) {
                window.history.pushState(null, '', previewHref);
            }
        });
        return;
    }
    window.location.href = previewHref;
}

function initPostsSearchPersistence(rootElement = document) {
    const input = rootElement.querySelector('.posts-search-block input[type="search"][name="q"]');
    const results = rootElement.querySelector('.posts-search-results');
    const block = input?.closest('.posts-search-block');
    if (!input || !results) {
        return;
    }
    if (input.dataset.searchPersistenceBound === 'true') {
        return;
    }
    input.dataset.searchPersistenceBound = 'true';
    const termKey = 'vyasa:postsSearchTerm';
    const resultsKey = 'vyasa:postsSearchResults';
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
    const urlTerm = getPostsSearchTermFromLocation();
    try {
        storedTerm = localStorage.getItem(termKey) || '';
        storedResults = localStorage.getItem(resultsKey);
    } catch (err) {
        storedTerm = '';
        storedResults = null;
    }
    if (urlTerm) {
        input.value = urlTerm;
    } else if (storedTerm && !input.value) {
        input.value = storedTerm;
    }
    if (storedResults && input.value) {
        try {
            const payload = JSON.parse(storedResults);
            if (payload && payload.term === input.value && payload.html) {
                results.innerHTML = payload.html;
                enhanceGatherLink();
            }
        } catch (err) {}
    }
    syncPostsSearchControls(block);
    const persistTerm = () => {
        try {
            if (input.value) {
                localStorage.setItem(termKey, input.value);
            } else {
                localStorage.removeItem(termKey);
                localStorage.removeItem(resultsKey);
            }
        } catch (err) {}
    };
    input.addEventListener('input', persistTerm);
    input.addEventListener('input', () => syncPostsSearchControls(block));
    input.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter') {
            return;
        }
        const trimmed = input.value.trim();
        if (!trimmed) {
            return;
        }
        const preview = block?.querySelector('.posts-search-preview-button');
        if (!preview) {
            return;
        }
        event.preventDefault();
        openPostsSearchPreview(block);
    });
    const fetchResults = (query) => {
        return fetch(postsSearchUrl(query), { headers: { 'HX-Request': 'true' } })
            .then((response) => response.text())
            .then((html) => {
                results.innerHTML = extractSearchResultsHtml(html);
                enhanceGatherLink();
                highlightSearchMatches(results, input.value);
                try {
                    localStorage.setItem(resultsKey, JSON.stringify({
                        term: input.value,
                        html: results.innerHTML
                    }));
                } catch (err) {}
            })
            .catch(() => {});
    };
    document.body.addEventListener('htmx:afterSwap', (event) => {
        if (event.target !== results) {
            return;
        }
        enhanceGatherLink();
        highlightSearchMatches(results, input.value);
        try {
            localStorage.setItem(resultsKey, JSON.stringify({
                term: input.value,
                html: results.innerHTML
            }));
        } catch (err) {}
    });
    if (input.value) {
        if (window.htmx && typeof window.htmx.ajax === 'function') {
            window.htmx.ajax('GET', postsSearchUrl(input.value), { target: results, swap: 'innerHTML' });
        } else {
            fetchResults(input.value);
        }
    }
}

function initSearchClearButtons(rootElement = document) {
    const blocks = rootElement.querySelectorAll('.posts-search-block');
    blocks.forEach((block) => {
        const input = block.querySelector('input[type="search"][name="q"]');
        const button = block.querySelector('.posts-search-clear-button');
        const preview = block.querySelector('.posts-search-preview-button');
        if (!input || !button) {
            return;
        }
        if (button.dataset.clearBound === 'true') {
            return;
        }
        button.dataset.clearBound = 'true';
        syncPostsSearchControls(block);
        input.addEventListener('input', () => syncPostsSearchControls(block));
        button.addEventListener('click', () => {
            input.value = '';
            input.dispatchEvent(new Event('input', { bubbles: true }));
            syncPostsSearchControls(block);
            const results = block.querySelector('.posts-search-results');
            if (results) {
                results.innerHTML = '';
            }
            try {
                localStorage.removeItem('vyasa:postsSearchTerm');
                localStorage.removeItem('vyasa:postsSearchResults');
            } catch (err) {}
        });
        if (preview) {
            preview.addEventListener('click', (event) => {
                if (!input.value.trim()) {
                    event.preventDefault();
                    return;
                }
                event.preventDefault();
                openPostsSearchPreview(block);
            });
        }
    });
}

function initCommandPalette() {
    if (document.getElementById('vyasa-command-palette')) return;
    const palette = document.createElement('div');
    palette.id = 'vyasa-command-palette';
    palette.className = 'fixed inset-0 z-[9999] hidden bg-slate-950/45 backdrop-blur-sm';
    palette.innerHTML = `
        <div class="mx-auto mt-[12vh] w-[min(42rem,calc(100vw-2rem))] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 shadow-2xl">
            <div class="border-b border-slate-200 dark:border-slate-800 p-3">
                <input type="search" name="q" autocomplete="off" placeholder="Search file names..." class="vyasa-command-palette-input w-full bg-transparent px-2 py-2 text-base text-slate-800 dark:text-slate-100 outline-none" />
            </div>
            <div class="vyasa-command-palette-results max-h-[55vh] overflow-y-auto p-3"></div>
        </div>`;
    document.body.appendChild(palette);
    const input = palette.querySelector('input');
    const results = palette.querySelector('.vyasa-command-palette-results');
    let timer = null;
    let activeIndex = -1;
    const resultLinks = () => Array.from(results.querySelectorAll('a.post-search-link'));
    const setActive = (index) => {
        const links = resultLinks();
        links.forEach((link) => link.classList.remove('is-active'));
        if (!links.length) {
            activeIndex = -1;
            return;
        }
        activeIndex = (index + links.length) % links.length;
        links[activeIndex].classList.add('is-active');
        links[activeIndex].scrollIntoView({ block: 'nearest' });
    };
    const close = () => palette.classList.add('hidden');
    const open = () => {
        palette.classList.remove('hidden');
        input.focus();
        input.select();
        if (!results.innerHTML.trim()) results.innerHTML = '<div class="text-xs text-slate-500">Type to search file names.</div>';
    };
    const runSearch = () => {
        fetch(postsSearchUrl(input.value.trim()), { headers: { 'HX-Request': 'true' } }).then((response) => response.text()).then((html) => {
            results.innerHTML = extractSearchResultsHtml(html);
            highlightSearchMatches(results, input.value);
            setActive(0);
            window.__vyasaInitBookmarksButtons?.(results);
        }).catch(() => {});
    };
    input.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(runSearch, 180);
    });
    const openLink = (link) => {
        const href = link?.getAttribute('href');
        if (!href) return;
        close();
        document.body.classList.remove('pdf-focus');
        if (window.htmx && typeof window.htmx.ajax === 'function') {
            window.htmx.ajax('GET', href, {
                target: '#main-content',
                swap: 'outerHTML show:window:top settle:0.1s',
                pushURL: true
            });
            if (window.location.pathname !== href) {
                window.history.pushState(null, '', href);
            }
            return;
        }
        window.location.assign(href);
    };
    input.addEventListener('keydown', (event) => {
        const links = resultLinks();
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActive(activeIndex + 1);
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActive(activeIndex - 1);
        } else if (event.key === 'Enter' && links[activeIndex]) {
            event.preventDefault();
            openLink(links[activeIndex]);
        }
    });
    palette.addEventListener('click', (event) => {
        const link = event.target.closest('a');
        if (link) {
            event.preventDefault();
            openLink(link);
            return;
        }
        if (event.target === palette) close();
    });
    document.addEventListener('keydown', (event) => {
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
            event.preventDefault();
            open();
        } else if (event.key === 'Escape' && !palette.classList.contains('hidden')) {
            close();
        }
    }, true);
    document.addEventListener('click', (event) => {
        const trigger = event.target.closest('[data-vyasa-command-trigger]');
        if (!trigger) return;
        event.preventDefault();
        open();
    });
}

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

function syncFoldAllButton(button, allOpen) {
    const label = allOpen ? 'Fold all' : 'Unfold all';
    button.classList.add('vyasa-page-action-tooltip');
    button.dataset.vyasaFoldAll = allOpen ? 'open' : 'closed';
    button.dataset.tooltip = `${label} sections (C)`;
    button.setAttribute('aria-label', `${label} sections (C)`);
    button.innerHTML = allOpen
        ? '<svg viewBox="0 0 24 24" aria-hidden="true" class="vyasa-fold-all-icon"><path d="M6 7h12"/><path d="M6 12h8"/><path d="M6 17h5"/><path d="m15 10 3 3 3-3"/></svg><span>Fold all</span>'
        : '<svg viewBox="0 0 24 24" aria-hidden="true" class="vyasa-fold-all-icon"><path d="M6 7h12"/><path d="M6 12h8"/><path d="M6 17h5"/><path d="m15 14 3-3 3 3"/></svg><span>Unfold all</span>';
}

window.vyasaRefreshRefTree = async function(button, storageKey, refName, sidebarPath) {
    const icon = button?.querySelector?.('svg');
    icon?.classList?.add('animate-spin');
    try {
        localStorage.setItem(storageKey, refName);
    } catch (error) {}
    try {
        await fetch(`/_vyasa/refresh-ref-tree/${encodeURIComponent(sidebarPath || '')}`, { method: 'GET', credentials: 'same-origin' });
        const url = `/_sidebar/posts?current_path=${encodeURIComponent(sidebarPath || '')}`;
        if (window.htmx?.ajax) {
            await window.htmx.ajax('GET', url, { target: '#posts-sidebar', swap: 'outerHTML' });
            return;
        }
        const response = await fetch(url, { credentials: 'same-origin' });
        if (!response.ok) return;
        const html = await response.text();
        const sidebar = document.getElementById('posts-sidebar');
        if (sidebar) {
            sidebar.outerHTML = html;
            initFolderChevronState();
            initFolderHoverExpand(document);
            syncPostsHoverToggleButtons(document);
        }
    } finally {
        icon?.classList?.remove('animate-spin');
    }
};

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
        syncFoldAllButton(toggle, shouldOpen);
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
            const row = link.closest('summary.vyasa-tree-row') || link.closest('.vyasa-tree-row');
            row?.classList.add('is-active');
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
    const existingControl = actions?.querySelector?.('[data-vyasa-fold-all]');
    if (createdFold && existingControl) {
        existingControl.hidden = false;
        syncFoldAllButton(existingControl, true);
    } else if (createdFold && actions && !main.querySelector('[data-vyasa-fold-all]')) {
        const control = document.createElement('button');
        control.type = 'button';
        control.className = 'vyasa-fold-all-button';
        syncFoldAllButton(control, true);
        const copyButton = Array.from(actions.querySelectorAll('button')).find((button) => button.textContent?.includes('Copy Markdown'));
        actions.insertBefore(control, copyButton);
    } else if (existingControl) {
        existingControl.hidden = true;
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

function initSidebarResizers(root = document) {
    const page = document.getElementById('page-container') || document.documentElement;
    const saved = JSON.parse(localStorage.getItem('vyasa:sidebarWidths') || '{}');
    const clamp = (v) => Math.max(224, Math.min(720, Math.round(v)));
    const bind = (selector, kind, sign) => {
        const sidebar = root.querySelector?.(selector) || document.querySelector(selector);
        if (!sidebar || !sidebar.classList.contains('vyasa-sidebar') || sidebar.dataset.resizerBound === 'true') return;
        if (saved[kind]) page.style.setProperty(`--vyasa-${kind}-sidebar-width`, `${clamp(saved[kind])}px`);
        const handle = document.createElement('button');
        handle.type = 'button'; handle.className = 'vyasa-sidebar-resizer'; handle.ariaLabel = `Resize ${kind} sidebar`;
        sidebar.appendChild(handle); sidebar.dataset.resizerBound = 'true';
        handle.addEventListener('pointerdown', (event) => {
            event.preventDefault(); handle.setPointerCapture(event.pointerId); sidebar.classList.add('vyasa-sidebar-resizing');
            const startX = event.clientX, startW = sidebar.getBoundingClientRect().width;
            const move = (e) => {
                const width = clamp(startW + sign * (e.clientX - startX));
                page.style.setProperty(`--vyasa-${kind}-sidebar-width`, `${width}px`);
                localStorage.setItem('vyasa:sidebarWidths', JSON.stringify({ ...JSON.parse(localStorage.getItem('vyasa:sidebarWidths') || '{}'), [kind]: width }));
            };
            const up = () => { sidebar.classList.remove('vyasa-sidebar-resizing'); window.removeEventListener('pointermove', move); };
            window.addEventListener('pointermove', move); window.addEventListener('pointerup', up, { once: true });
        });
    };
    bind('#posts-sidebar', 'posts', 1);
    bind('#toc-sidebar', 'toc', -1);
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

async function renderMermaidAfterSwap(scope) {
    if (!scope?.querySelector?.('.mermaid-wrapper')) {
        return;
    }
    if (typeof window.__vyasaRenderMermaidInScope !== 'function') {
        await import('/static/extensions/mermaid/mermaid.js');
    }
    window.__vyasaRenderMermaidInScope?.(scope);
}

document.body.addEventListener('htmx:afterSwap', async function(event) {
    if (isLightweightSearchSwap(event.target)) {
        window.__vyasaInitBookmarksButtons?.(event.target);
        return;
    }
    const swapScope = event.target || document;
    await ensureBundleAssets(swapScope);
    renderMermaidAfterSwap(swapScope).catch(() => {});
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
    window.__vyasaInitCodeTools?.(event.target || document);
});

// Sidebar/panel toggle functionality (docked sidebars on desktop, slide-in panels below xl)
function initMobileMenus() {
    const getPostsPanel = () => document.getElementById('mobile-posts-panel');
    const getTocPanel = () => document.getElementById('mobile-toc-panel');
    const postsPanel = getPostsPanel();
    const tocPanel = getTocPanel();
    const isDockedMode = () => window.matchMedia('(min-width: 1280px)').matches;
    const pulseNavbarToggle = (kind) => {
        document.querySelectorAll(`[data-vyasa-sidebar-toggle="${kind}"]`).forEach((button) => {
            button.classList.remove('vyasa-sidebar-toggle-pulse');
            void button.offsetWidth;
            button.classList.add('vyasa-sidebar-toggle-pulse');
            window.setTimeout(() => button.classList.remove('vyasa-sidebar-toggle-pulse'), 1600);
        });
    };

    const toggleDockedSidebar = (kind) => {
        const sidebar = document.getElementById(`${kind}-sidebar`);
        if (!sidebar) return false;
        const attr = `data-vyasa-hide-${kind}-sidebar`;
        const hidden = !document.documentElement.hasAttribute(attr);
        document.documentElement.toggleAttribute(attr, hidden);
        if (hidden) pulseNavbarToggle(kind);
        try {
            if (hidden) localStorage.setItem(`vyasa-${kind}-sidebar-hidden`, '1');
            else localStorage.setItem(`vyasa-${kind}-sidebar-hidden`, '0');
        } catch (_) {}
        return true;
    };

    const togglePostsPanel = () => {
        if (isDockedMode() && toggleDockedSidebar('posts')) return;
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
        if (isDockedMode() && toggleDockedSidebar('toc')) return;
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
                return;
            }
            const dockedSummary = event.target.closest('.vyasa-sidebar-docked > details[data-sidebar] > summary.vyasa-sidebar-toggle');
            if (dockedSummary) {
                event.preventDefault();
                const kind = dockedSummary.parentElement?.dataset.sidebar;
                if (kind) toggleDockedSidebar(kind);
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

// Keyboard shortcuts for toggling sidebars
function initKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Skip if user is typing in an input field
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
            return;
        }
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        
        // Z: Toggle posts panel
        if (e.key === 'z' || e.key === 'Z') {
            e.preventDefault();
            window.__vyasaTogglePostsPanel?.();
        }

        // X: Toggle TOC panel
        if (e.key === 'x' || e.key === 'X') {
            e.preventDefault();
            window.__vyasaToggleTocPanel?.();
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

function replaceEscapedDollarPlaceholders(root) {
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

const GOOGLE_FONT_QUERIES = {
    'Alegreya': 'family=Alegreya:wght@400;500;600;700',
    Arimo: 'family=Arimo:wght@400;500;600;700',
    Archivo: 'family=Archivo:wght@400;500;600;700',
    Asap: 'family=Asap:wght@400;500;600;700',
    Assistant: 'family=Assistant:wght@400;500;600;700;800',
    'Azeret Mono': 'family=Azeret+Mono:wght@400;500;600;700',
    'Be Vietnam Pro': 'family=Be+Vietnam+Pro:wght@400;500;600;700',
    Besley: 'family=Besley:wght@400;500;600;700',
    Bitter: 'family=Bitter:wght@400;500;600;700',
    'Bricolage Grotesque': 'family=Bricolage+Grotesque:wght@400;500;600;700',
    Cabin: 'family=Cabin:wght@400;500;600;700',
    Cardo: 'family=Cardo:wght@400;700',
    Chivo: 'family=Chivo:wght@400;500;600;700',
    'Crimson Pro': 'family=Crimson+Pro:wght@400;500;600;700',
    'Cutive Mono': 'family=Cutive+Mono',
    'DM Sans': 'family=DM+Sans:wght@400;500;700',
    Domine: 'family=Domine:wght@400;500;600;700',
    'EB Garamond': 'family=EB+Garamond:wght@400;500;600;700',
    'Fauna One': 'family=Fauna+One',
    Figtree: 'family=Figtree:wght@400;500;600;700;800',
    'Fira Code': 'family=Fira+Code:wght@400;500;600;700',
    'Hanken Grotesk': 'family=Hanken+Grotesk:wght@400;500;600;700;800',
    'Hepta Slab': 'family=Hepta+Slab:wght@400;500;600;700',
    'IBM Plex Mono': 'family=IBM+Plex+Mono:wght@400;500;600;700',
    Inconsolata: 'family=Inconsolata:wght@400;500;600;700',
    Inter: 'family=Inter:wght@400;500;600;700;800',
    'Instrument Serif': 'family=Instrument+Serif:ital@0;1',
    'JetBrains Mono': 'family=JetBrains+Mono:wght@400;500;600;700;800',
    Karla: 'family=Karla:wght@400;500;600;700;800',
    Lexend: 'family=Lexend:wght@400;500;600;700;800',
    'Libre Baskerville': 'family=Libre+Baskerville:wght@400;700',
    'Libre Franklin': 'family=Libre+Franklin:wght@400;500;600;700;800',
    Manrope: 'family=Manrope:wght@400;500;700;800',
    Merriweather: 'family=Merriweather:wght@400;700',
    'Merriweather Sans': 'family=Merriweather+Sans:wght@400;500;600;700;800',
    Montserrat: 'family=Montserrat:wght@400;500;600;700;800',
    Mulish: 'family=Mulish:wght@400;500;600;700;800',
    Newsreader: 'family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600',
    'Noto Serif': 'family=Noto+Serif:wght@400;500;600;700',
    'Nunito Sans': 'family=Nunito+Sans:wght@400;500;600;700;800',
    Onest: 'family=Onest:wght@400;500;600;700;800',
    'Plus Jakarta Sans': 'family=Plus+Jakarta+Sans:wght@400;500;600;700;800',
    'PT Serif': 'family=PT+Serif:wght@400;700',
    'Public Sans': 'family=Public+Sans:wght@400;500;600;700;800',
    Raleway: 'family=Raleway:wght@400;500;600;700;800',
    'Reddit Mono': 'family=Reddit+Mono:wght@400;500;600;700',
    'Red Hat Display': 'family=Red+Hat+Display:wght@400;500;600;700;800',
    'Red Hat Text': 'family=Red+Hat+Text:wght@400;500;600;700',
    Recursive: 'family=Recursive:wght@400;500;600;700',
    'Roboto Slab': 'family=Roboto+Slab:wght@400;500;600;700',
    'Schibsted Grotesk': 'family=Schibsted+Grotesk:wght@400;500;600;700;800',
    'Share Tech Mono': 'family=Share+Tech+Mono',
    'Source Sans 3': 'family=Source+Sans+3:wght@400;500;600;700;800',
    'Source Code Pro': 'family=Source+Code+Pro:wght@400;500;600;700',
    'Source Serif 4': 'family=Source+Serif+4:wght@400;500;600;700',
    'Space Mono': 'family=Space+Mono:wght@400;700',
    'Space Grotesk': 'family=Space+Grotesk:wght@400;500;700',
    'Sometype Mono': 'family=Sometype+Mono:wght@400;500;600;700',
    Spectral: 'family=Spectral:wght@400;500;600;700',
    Sora: 'family=Sora:wght@400;500;600;700;800',
    'Ubuntu Mono': 'family=Ubuntu+Mono:wght@400;700',
    Urbanist: 'family=Urbanist:wght@400;500;600;700;800',
    VT323: 'family=VT323',
    'Work Sans': 'family=Work+Sans:wght@400;500;600;700;800',
};

function ensureThemeFonts(theme) {
    const stacks = [theme.theme_body_font, theme.theme_heading_font, theme.theme_ui_font, theme.theme_mono_font].filter(Boolean);
    const queries = new Set();
    stacks.forEach((stack) => {
        stack.split(',').map((part) => part.trim().replace(/^['"]|['"]$/g, '')).forEach((name) => {
            if (GOOGLE_FONT_QUERIES[name]) queries.add(GOOGLE_FONT_QUERIES[name]);
        });
    });
    if (!queries.size) return;
    let link = document.getElementById('vyasa-runtime-fonts');
    if (!link) {
        link = document.createElement('link');
        link.id = 'vyasa-runtime-fonts';
        link.rel = 'stylesheet';
        document.head.appendChild(link);
    }
    link.href = `https://fonts.googleapis.com/css2?${Array.from(queries).join('&')}&display=swap`;
}

function applyThemePreset(theme) {
    if (!theme) return;
    const root = document.documentElement;
    const page = document.getElementById('page-container');
    const targets = [root, page].filter(Boolean);
    const runtimeThemeVars = new Set();
    Object.values(window.__VYASA_THEME_PRESETS__ || {}).forEach((preset) => {
        Object.keys(preset || {}).forEach((key) => {
            if (!key.startsWith('theme_') || key === 'theme_preset') return;
            const cssName = key === 'theme_body_font' ? '--vyasa-font-body'
                : key === 'theme_heading_font' ? '--vyasa-font-heading'
                : key === 'theme_ui_font' ? '--vyasa-font-ui'
                : key === 'theme_mono_font' ? '--vyasa-font-mono'
                : `--vyasa-${key.slice(6).replace(/_/g, '-')}`;
            runtimeThemeVars.add(cssName);
        });
    });
    targets.forEach((el) => {
        runtimeThemeVars.forEach((cssName) => el.style.removeProperty(cssName));
    });
    Object.entries(theme).forEach(([key, value]) => {
        if (!key.startsWith('theme_') || !value || key === 'theme_preset') return;
        const cssName = key === 'theme_body_font' ? '--vyasa-font-body'
            : key === 'theme_heading_font' ? '--vyasa-font-heading'
            : key === 'theme_ui_font' ? '--vyasa-font-ui'
            : key === 'theme_mono_font' ? '--vyasa-font-mono'
            : `--vyasa-${key.slice(6).replace(/_/g, '-')}`;
        targets.forEach((el) => el.style.setProperty(cssName, String(value)));
    });
    if (theme.theme_primary) targets.forEach((el) => el.style.setProperty('--vyasa-primary-dim', `color-mix(in srgb, ${theme.theme_primary} 82%, black)`));
    ensureThemeFonts(theme);
    window.__vyasaSyncCodeThemeLinks?.(theme);
}

function getVisibleThemeControl(id) {
    const nodes = Array.from(document.querySelectorAll(`#${id}`));
    return nodes.find((node) => {
        const rect = node.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    }) || nodes[nodes.length - 1] || null;
}

function getThemeSwitcher(source) {
    return source?.closest?.('[data-theme-switcher]') || document.querySelector('[data-theme-switcher]');
}

function closeNavbarSearchResults() {
    document.querySelectorAll('.vyasa-navbar-search-results').forEach((results) => {
        results.innerHTML = '';
    });
}

function closeThemePresetMenus() {
    document.querySelectorAll('#theme-preset-menu').forEach((menu) => {
        menu.style.display = 'none';
    });
}

function closeRefSwitchers() {
    document.querySelectorAll('details.vyasa-ref-switcher[open]').forEach((details) => {
        details.open = false;
    });
}

function initFloatingUiDismiss() {
    if (window.__vyasaFloatingUiDismissBound) return;
    window.__vyasaFloatingUiDismissBound = true;
    document.addEventListener('click', (event) => {
        if (!event.target.closest('.vyasa-navbar-search-block')) {
            closeNavbarSearchResults();
        }
        if (!event.target.closest('[data-theme-switcher]')) {
            closeThemePresetMenus();
        }
        if (!event.target.closest('.vyasa-ref-switcher')) {
            closeRefSwitchers();
        }
    });
    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        closeNavbarSearchResults();
        closeThemePresetMenus();
        closeRefSwitchers();
    });
}

function syncThemePresetSelect(next, source) {
    const scope = getThemeSwitcher(source);
    const label = scope?.querySelector('#theme-preset-active-label') || getVisibleThemeControl('theme-preset-active-label');
    if (label) label.textContent = next || 'Theme';
    const menu = scope?.querySelector('#theme-preset-menu') || getVisibleThemeControl('theme-preset-menu');
    (menu ? Array.from(menu.querySelectorAll('.theme-preset-option')) : []).forEach((option) => {
        const active = option.dataset.themeName === next;
        option.classList.toggle('is-active', active);
    });
}

window.vyasaToggleThemePresetMenu = function vyasaToggleThemePresetMenu(source) {
    const menu = getThemeSwitcher(source)?.querySelector('#theme-preset-menu') || getVisibleThemeControl('theme-preset-menu');
    if (!menu) return;
    menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
};

window.vyasaApplyThemePreset = function vyasaApplyThemePreset(next, source) {
    const presets = window.__VYASA_THEME_PRESETS__ || {};
    const meta = window.__VYASA_THEME_EXTENSION_META__ || {};
    const franken = JSON.parse(localStorage.getItem('__FRANKEN__') || '{"mode":"light"}');
    let resolved = next;
    if (next && meta[next] && meta[next].randomizable) {
        const choices = Array.isArray(meta[next].choices) ? meta[next].choices.filter((name) => presets[name]) : [];
        if (choices.length) {
            const currentResolved = franken.resolvedPreset || '';
            const pool = choices.length > 1 ? choices.filter((name) => name !== currentResolved) : choices;
            resolved = pool[Math.floor(Math.random() * pool.length)] || choices[0];
        }
    }
    if (next && presets[resolved]) {
        syncThemePresetSelect(next, source);
        applyThemePreset(presets[resolved]);
        franken.preset = next;
        franken.resolvedPreset = resolved;
    } else {
        delete franken.preset;
        delete franken.resolvedPreset;
        window.location.reload();
        return;
    }
    localStorage.setItem('__FRANKEN__', JSON.stringify(franken));
};

window.vyasaApplyRandomThemePreset = function vyasaApplyRandomThemePreset(source) {
    const presets = Object.keys(window.__VYASA_THEME_PRESETS__ || {});
    const meta = window.__VYASA_THEME_EXTENSION_META__ || {};
    if (!presets.length) return;
    const label = getThemeSwitcher(source)?.querySelector('#theme-preset-active-label') || getVisibleThemeControl('theme-preset-active-label');
    const current = label ? label.textContent.trim() : '';
    const selectable = presets.filter((name) => name !== (meta[name]?.resolvedOnly ? name : ''));
    const pool = selectable.length > 1 ? selectable.filter((name) => name !== current) : selectable;
    const next = pool[Math.floor(Math.random() * pool.length)];
    window.vyasaApplyThemePreset(next, source);
};

function syncThemePresetDebug(root = document) {
    const presets = window.__VYASA_THEME_PRESETS__ || {};
    const meta = window.__VYASA_THEME_EXTENSION_META__ || {};
    const stored = JSON.parse(localStorage.getItem('__FRANKEN__') || '{"mode":"light"}');
    const label = root.querySelector ? root.querySelector('#theme-preset-active-label') : document.querySelector('#theme-preset-active-label');
    const active = stored.preset || (label ? label.textContent.trim() : '') || '';
    const resolved = stored.resolvedPreset || active;
    if (active && presets[resolved]) {
        if (typeof syncThemePresetSelect === 'function') syncThemePresetSelect(active);
        if (typeof applyThemePreset === 'function') applyThemePreset(presets[resolved]);
    } else if (active && meta[active] && meta[active].randomizable && typeof window.vyasaApplyThemePreset === 'function') {
        window.vyasaApplyThemePreset(active);
    }
}

// Keep --vyasa-navbar-height in sync so docked sidebars sit flush under the navbar
function syncNavbarHeightVar() {
    const navbar = document.getElementById('site-navbar');
    if (!navbar) return;
    document.documentElement.style.setProperty('--vyasa-navbar-height', `${navbar.offsetHeight}px`);
}
window.addEventListener('resize', syncNavbarHeightVar);

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    installPostsSearchRequestState();
    syncNavbarHeightVar();
    ensureFragmentStylesheets(document);
    initHeadingFolds(document);
    syncHeadingActionStates(document);
    initScrollTopButton(document);
    initSidebarResizers(document);
    initMobileScrollProgress(document);
    syncThemePresetDebug(document);
    initFloatingUiDismiss();
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
    initHeadingPermalinkCopy(document);
    window.__vyasaInitCodeTools?.(document);
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
    initSidebarResizers(event.target || document);
    initMobileScrollProgress(document);
    syncThemePresetDebug(document);
    replaceEscapedDollarPlaceholders(event.target);
    renderMathSafely(event.target);
    refreshVyasaTableScrollShadows(event.target);
    window.__vyasaInitSearchPlaceholderCycle?.(event.target);
    window.__vyasaInitPostsSearchPersistence?.(event.target);
    initFolderHoverExpand(event.target || document);
    syncPostsHoverToggleButtons(event.target || document);
    initHeadingPermalinkCopy(event.target);
    window.__vyasaInitCodeTools?.(event.target);
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
    window.__vyasaInitCodeTools?.(document);
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
