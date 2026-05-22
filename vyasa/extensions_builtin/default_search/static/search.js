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
    const template = document.getElementById('vyasa-code-copy-tpl');
    if (!template) {
        return;
    }
    rootElement.querySelectorAll('.code-block').forEach((block) => {
        if (block.querySelector('.code-copy-button')) {
            return;
        }
        const button = template.content.firstElementChild.cloneNode(true);
        block.insertBefore(button, block.firstChild);
    });
}

function initCodeHighlighting(rootElement = document) {
    if (!window.hljs) {
        return;
    }
    rootElement.querySelectorAll('pre > code').forEach((code) => {
        if (code.dataset.hljsBound === 'true') {
            return;
        }
        if (code.closest('.mermaid-wrapper,.d2-wrapper')) {
            return;
        }
        window.hljs.highlightElement(code);
        code.dataset.hljsBound = 'true';
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
        } catch (err) {
            // Ignore malformed cached payloads.
        }
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
        } catch (err) {
            // Ignore storage failures.
        }
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
        return fetch(`/_sidebar/posts/search?q=${query}`, { headers: { 'HX-Request': 'true' } })
            .then((response) => response.text())
            .then((html) => {
                results.innerHTML = extractSearchResultsHtml(html);
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
            } catch (err) {
                // Ignore storage failures.
            }
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
        const query = encodeURIComponent(input.value.trim());
        fetch(`/_sidebar/posts/search?q=${query}`, { headers: { 'HX-Request': 'true' } }).then((response) => response.text()).then((html) => {
            results.innerHTML = extractSearchResultsHtml(html);
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

window.__vyasaInitSearchPlaceholderCycle = initSearchPlaceholderCycle;
window.__vyasaInitPostsSearchPersistence = initPostsSearchPersistence;
window.__vyasaInitSearchClearButtons = initSearchClearButtons;
window.__vyasaInitCommandPalette = initCommandPalette;

document.addEventListener('DOMContentLoaded', () => {
    initSearchPlaceholderCycle(document);
    initPostsSearchPersistence(document);
    initSearchClearButtons(document);
    initCommandPalette();
});

document.body.addEventListener('htmx:afterSwap', (event) => {
    const target = event.target || document;
    initSearchPlaceholderCycle(target);
    initPostsSearchPersistence(target);
    initSearchClearButtons(target);
});
