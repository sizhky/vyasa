const vyasaBookmarks = { mode: null, items: [], loadPromise: null };
const vyasaBookmarkDebugEnabled = () => {
    try {
        return localStorage.getItem('vyasa:debug:bookmarks') === '1';
    } catch (err) {
        return false;
    }
};
function vyasaBookmarkDebug(event, payload = {}) {
    if (!vyasaBookmarkDebugEnabled()) return;
    console.info('[vyasa bookmarks]', event, payload);
}

function normalizeBookmarkItems(items = []) {
    const seen = new Set();
    return items.filter((item) => {
        const path = String(item && item.path || '').replace(/^\/+|\/+$/g, '');
        if (!path || seen.has(path)) return false;
        seen.add(path);
        item.path = path;
        item.href = item.href || `/posts/${path}`;
        item.title = item.title || path;
        return true;
    });
}

function readLocalBookmarks() {
    try {
        return normalizeBookmarkItems(JSON.parse(localStorage.getItem('vyasa:bookmarks') || '[]'));
    } catch (err) {
        return [];
    }
}

function writeLocalBookmarks(items) {
    try {
        localStorage.setItem('vyasa:bookmarks', JSON.stringify(normalizeBookmarkItems(items)));
    } catch (err) {
        // Ignore storage failures.
    }
}

function bookmarkItemFromButton(button) {
    const path = String(button?.dataset?.bookmarkPath || '').replace(/^\/+|\/+$/g, '');
    const title = button?.dataset?.bookmarkTitle || path;
    const href = button?.closest('.vyasa-bookmark-row')?.querySelector('a[href]')?.getAttribute('href') || `/posts/${path}`;
    return path ? { path, title, href } : null;
}

function ensureBookmarksLoaded(force = false) {
    if (vyasaBookmarks.mode && !force) return Promise.resolve(vyasaBookmarks.items);
    if (vyasaBookmarks.loadPromise && !force) return vyasaBookmarks.loadPromise;
    vyasaBookmarks.loadPromise = fetch('/api/bookmarks', { cache: 'no-store', credentials: 'same-origin' })
        .then((response) => {
            vyasaBookmarkDebug('load-response', { force, status: response.status, ok: response.ok });
            return response.ok ? response.json() : { mode: 'local', items: readLocalBookmarks() };
        })
        .catch((error) => {
            vyasaBookmarkDebug('load-error', { force, error: String(error) });
            return { mode: 'local', items: readLocalBookmarks() };
        })
        .then((payload) => {
            vyasaBookmarks.mode = payload.mode === 'server' ? 'server' : 'local';
            vyasaBookmarks.items = normalizeBookmarkItems(vyasaBookmarks.mode === 'server' ? (payload.items || []) : readLocalBookmarks());
            vyasaBookmarkDebug('load-applied', { force, mode: vyasaBookmarks.mode, paths: vyasaBookmarks.items.map((item) => item.path) });
            return vyasaBookmarks.items;
        })
        .finally(() => { vyasaBookmarks.loadPromise = null; });
    return vyasaBookmarks.loadPromise;
}

function renderBookmarksBlock(rootElement = document) {
    const paths = new Set(vyasaBookmarks.items.map((item) => item.path));
    vyasaBookmarkDebug('render', { mode: vyasaBookmarks.mode, count: vyasaBookmarks.items.length, targetTag: rootElement?.tagName || 'document' });
    rootElement.querySelectorAll('[data-bookmark-toggle="true"]').forEach((button) => {
        const bookmarked = paths.has(button.dataset.bookmarkPath);
        button.dataset.bookmarked = bookmarked ? 'true' : 'false';
        const glyph = button.querySelector('.vyasa-bookmark-glyph');
        if (glyph) glyph.textContent = bookmarked ? '★' : '☆';
    });
    rootElement.querySelectorAll('.vyasa-bookmarks-block').forEach((block) => {
        const list = block.querySelector('.vyasa-bookmarks-list');
        if (!list) return;
        list.innerHTML = vyasaBookmarks.items.map((item) => `
            <div class="vyasa-bookmark-row vyasa-action-row inline-flex items-center gap-1 w-max">
                <a href="${item.href}" hx-get="${item.href}" hx-target="#main-content" hx-push-url="true" hx-swap="outerHTML show:window:top settle:0.1s" class="vyasa-tree-link vyasa-tree-row vyasa-tree-row-shell post-link vyasa-bookmark-link whitespace-nowrap" data-path="${item.path}" data-bookmark-link="true">
                    <span class="whitespace-nowrap" title="${item.path}">${item.path}</span>
                </a>
                <button type="button" class="vyasa-sidebar-tree-action vyasa-row-action vyasa-bookmark-delete" data-bookmark-delete="true" data-bookmark-path="${item.path}" data-bookmark-title="${item.title}" aria-label="Remove bookmark for ${item.title}" title="Remove bookmark for ${item.title}">
                    <span class="flex items-center justify-center" aria-hidden="true"><svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M6 6l1 14h10l1-14"/><path d="M10 10v6"/><path d="M14 10v6"/></svg></span>
                </button>
            </div>`).join('');
        block.classList.toggle('has-items', vyasaBookmarks.items.length > 0);
    });
}

function bindBookmarkButtons(rootElement = document) {
    rootElement.querySelectorAll('[data-bookmark-toggle="true"]').forEach((button) => {
        if (button.dataset.bookmarkBound === 'true') return;
        button.dataset.bookmarkBound = 'true';
        button.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            toggleBookmarkItem(button);
        }, true);
    });
    rootElement.querySelectorAll('[data-bookmark-delete="true"]').forEach((button) => {
        if (button.dataset.bookmarkDeleteBound === 'true') return;
        button.dataset.bookmarkDeleteBound = 'true';
        button.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            deleteBookmarkItem(button);
        }, true);
    });
}

async function refreshPostsTreeForPath(path) {
    const response = await fetch(`/_sidebar/posts?current_path=${encodeURIComponent(path)}`);
    if (!response.ok) return;
    const html = await response.text();
    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;
    const nextList = wrapper.querySelector('#vyasa-posts-section-list');
    const postsContainer = document.querySelector('#posts-sidebar') || document;
    const currentList = postsContainer.querySelector('#vyasa-posts-section-list');
    if (!nextList || !currentList) return;
    currentList.replaceWith(nextList);
    window.__vyasaInitFolderChevronState?.(document);
    updateActivePostLink(path);
    bindBookmarkButtons(document);
    const postsSidebar = postsContainer.querySelector('details[data-sidebar="posts"]');
    if (postsSidebar?.open) {
        window.__vyasaRevealInSidebar?.(postsSidebar, path);
    }
}

function bindBookmarkLinks(rootElement = document) {
    rootElement.querySelectorAll('[data-bookmark-link="true"]').forEach((link) => {
        if (link.dataset.bookmarkLinkBound === 'true') return;
        link.dataset.bookmarkLinkBound = 'true';
        link.addEventListener('click', (event) => {
            event.preventDefault();
            const href = link.getAttribute('href');
            const path = link.getAttribute('data-path') || '';
            if (!href) return;
            if (window.htmx && typeof window.htmx.ajax === 'function') {
                window.__vyasaPendingRevealPath = path;
                window.htmx.ajax('GET', href, { target: '#main-content', swap: 'outerHTML show:window:top settle:0.1s', pushURL: true });
                refreshPostsTreeForPath(path);
                return;
            }
            window.location.assign(href);
        });
    });
}

async function toggleBookmarkItem(button) {
    const item = bookmarkItemFromButton(button);
    if (!item) return;
    await ensureBookmarksLoaded();
    const exists = vyasaBookmarks.items.some((entry) => entry.path === item.path);
    vyasaBookmarkDebug('toggle-start', { path: item.path, exists, mode: vyasaBookmarks.mode });
    if (vyasaBookmarks.mode === 'server') {
        const routePath = item.path.split('/').map(encodeURIComponent).join('/');
        const response = await fetch(`/api/bookmarks/${routePath}`, {
            method: exists ? 'DELETE' : 'PUT',
            cache: 'no-store',
            credentials: 'same-origin',
        });
        vyasaBookmarkDebug('toggle-response', { path: item.path, method: exists ? 'DELETE' : 'PUT', status: response.status, ok: response.ok });
        if (!response.ok) return;
        await ensureBookmarksLoaded(true);
    } else {
        vyasaBookmarks.items = exists
            ? vyasaBookmarks.items.filter((entry) => entry.path !== item.path)
            : normalizeBookmarkItems([item, ...vyasaBookmarks.items]);
        writeLocalBookmarks(vyasaBookmarks.items);
    }
    vyasaBookmarkDebug('toggle-finished', { path: item.path, mode: vyasaBookmarks.mode, paths: vyasaBookmarks.items.map((entry) => entry.path) });
    renderBookmarksBlock(document);
    bindBookmarkButtons(document);
    bindBookmarkLinks(document);
}

async function deleteBookmarkItem(button) {
    const item = bookmarkItemFromButton(button);
    if (!item) return;
    await ensureBookmarksLoaded();
    if (vyasaBookmarks.mode === 'server') {
        const routePath = item.path.split('/').map(encodeURIComponent).join('/');
        const response = await fetch(`/api/bookmarks/${routePath}`, {
            method: 'DELETE',
            cache: 'no-store',
            credentials: 'same-origin',
        });
        if (!response.ok) return;
        await ensureBookmarksLoaded(true);
    } else {
        vyasaBookmarks.items = vyasaBookmarks.items.filter((entry) => entry.path !== item.path);
        writeLocalBookmarks(vyasaBookmarks.items);
    }
    renderBookmarksBlock(document);
    bindBookmarkButtons(document);
    bindBookmarkLinks(document);
}

function initBookmarks(rootElement = document) {
    ensureBookmarksLoaded().then(() => {
        renderBookmarksBlock(rootElement);
        bindBookmarkButtons(rootElement);
        bindBookmarkLinks(rootElement);
    });
}

window.__vyasaInitBookmarksButtons = bindBookmarkButtons;


document.addEventListener('DOMContentLoaded', () => {
    initBookmarks(document);
});

document.body.addEventListener('htmx:afterSwap', (event) => {
    initBookmarks(event.target || document);
});
