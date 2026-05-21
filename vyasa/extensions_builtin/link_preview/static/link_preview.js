const LINK_PREVIEW_SELECTOR = 'a[data-vyasa-link-preview="true"]';

let previewPopover = null;
let previewAbort = null;
let previewToken = 0;
let previewLink = null;
let hoveredLink = null;
let modifierDown = false;
let previewOpen = false;
let previewAnchor = null;
let previewResizing = false;

function ensurePreviewPopover() {
    if (previewPopover) return previewPopover;
    previewPopover = document.createElement('div');
    previewPopover.id = 'vyasa-link-preview-popover';
    previewPopover.className = 'vyasa-link-preview-popover';
    previewPopover.innerHTML = '<div class="vyasa-link-preview-card"><div class="vyasa-link-preview-loading">Loading preview...</div></div>';
    document.body.appendChild(previewPopover);
    return previewPopover;
}

function setPreviewMessage(message) {
    const popover = ensurePreviewPopover();
    popover.innerHTML = `<div class="vyasa-link-preview-card"><button type="button" class="vyasa-link-preview-close" aria-label="Close preview">x</button><div class="vyasa-link-preview-empty">${message}</div></div>`;
    popover.classList.add('is-open');
    previewOpen = true;
}

function setPreviewContent(content) {
    const popover = ensurePreviewPopover();
    popover.innerHTML = `<div class="vyasa-link-preview-card"><button type="button" class="vyasa-link-preview-close" aria-label="Close preview">x</button>${content}</div>`;
    popover.classList.add('is-open');
    previewOpen = true;
}

function inferCurrentPath() {
    const raw = window.location.pathname || '';
    if (!raw.startsWith('/posts/')) return '';
    return decodeURIComponent(raw.slice('/posts/'.length));
}

function hideLinkPreview() {
    previewToken += 1;
    previewLink = null;
    if (previewAbort) previewAbort.abort();
    previewAbort = null;
    if (previewPopover) {
        previewPopover.classList.remove('is-open');
        previewPopover.style.left = '-9999px';
        previewPopover.style.top = '-9999px';
    }
    previewOpen = false;
    previewAnchor = null;
    previewResizing = false;
}

function positionLinkPreview(point) {
    const popover = ensurePreviewPopover();
    const width = Math.min(384, Math.max(240, window.innerWidth - 24));
    const height = Math.min(420, Math.max(220, window.innerHeight - 24));
    const x = Math.min(point.clientX + 18, window.innerWidth - width - 12);
    const y = Math.min(point.clientY + 18, window.innerHeight - height - 12);
    popover.style.width = `${width}px`;
    popover.style.height = `${height}px`;
    popover.style.left = `${Math.max(12, x)}px`;
    popover.style.top = `${Math.max(12, y)}px`;
}

async function loadLinkPreview(link, event) {
    const href = link.getAttribute('href') || '';
    if (!href) return;
    const currentPath = link.dataset.vyasaLinkPreviewCurrentPath || inferCurrentPath();
    const token = ++previewToken;
    if (previewAbort) previewAbort.abort();
    previewAbort = new AbortController();
    const popover = ensurePreviewPopover();
    positionLinkPreview(event);
    previewAnchor = { clientX: event.clientX, clientY: event.clientY };
    popover.innerHTML = '<div class="vyasa-link-preview-card"><div class="vyasa-link-preview-loading">Loading preview...</div></div>';
    popover.classList.add('is-open');
    previewOpen = true;
    try {
        const url = new URL('/preview/link', window.location.origin);
        url.searchParams.set('href', href);
        if (currentPath) url.searchParams.set('current_path', currentPath);
        const response = await fetch(url.toString(), { signal: previewAbort.signal, credentials: 'same-origin' });
        if (token !== previewToken) return;
        if (!response.ok) {
            setPreviewMessage('Preview unavailable.');
            return;
        }
        setPreviewContent(await response.text());
        positionLinkPreview(previewAnchor || event);
    } catch {
        if (token === previewToken) hideLinkPreview();
    }
}

function maybeShowPreview(event) {
    const link = event.target?.closest?.(LINK_PREVIEW_SELECTOR);
    if (link) hoveredLink = link;
    if (!(modifierDown || event.metaKey || event.ctrlKey)) return;
    if (!link) return;
    if (previewOpen) return;
    previewLink = link;
    loadLinkPreview(link, event);
}

function maybeShowPreviewOnMove(event) {
    const link = event.target?.closest?.(LINK_PREVIEW_SELECTOR);
    if (link) hoveredLink = link;
    if (!(modifierDown || event.metaKey || event.ctrlKey)) return;
    if (!link || previewOpen || previewLink === link) return;
    previewLink = link;
    loadLinkPreview(link, event);
}

function trackModifier(event) {
    const wasDown = modifierDown;
    modifierDown = event.metaKey || event.ctrlKey;
    if (!modifierDown) return;
    else if (!wasDown && hoveredLink) {
        const rect = hoveredLink.getBoundingClientRect();
        previewLink = hoveredLink;
        loadLinkPreview(hoveredLink, { clientX: rect.left, clientY: rect.bottom });
    }
}

document.body.addEventListener('pointerover', maybeShowPreview, true);
document.body.addEventListener('pointermove', maybeShowPreviewOnMove, true);
document.body.addEventListener('pointerout', (event) => {
    if (previewOpen) return;
    const link = event.target?.closest?.(LINK_PREVIEW_SELECTOR);
    if (!link) return;
    if (!event.relatedTarget || !link.contains(event.relatedTarget)) {
        if (hoveredLink === link) hoveredLink = null;
    }
    if (link !== previewLink) return;
    if (event.relatedTarget && link.contains(event.relatedTarget)) return;
    hideLinkPreview();
}, true);
document.body.addEventListener('wheel', (event) => {
    if (!previewOpen) return;
    const popover = ensurePreviewPopover();
    if (!popover.contains(event.target)) return;
    const body = event.target?.closest?.('.vyasa-link-preview-body') || popover.querySelector('.vyasa-link-preview-body');
    if (!body) return;
    body.scrollTop += event.deltaY;
    body.scrollLeft += event.deltaX;
    event.preventDefault();
    event.stopPropagation();
}, { capture: true, passive: false });
document.body.addEventListener('click', (event) => {
    if (!previewOpen) return;
    if (previewResizing) {
        previewResizing = false;
        return;
    }
    const popover = ensurePreviewPopover();
    if (event.target?.closest?.('.vyasa-link-preview-close')) {
        hideLinkPreview();
        return;
    }
    if (!popover.contains(event.target)) hideLinkPreview();
}, true);
document.body.addEventListener('pointerdown', (event) => {
    if (!previewOpen) return;
    const popover = ensurePreviewPopover();
    if (!popover.contains(event.target)) return;
    const rect = popover.getBoundingClientRect();
    previewResizing = rect.right - event.clientX < 24 && rect.bottom - event.clientY < 24;
}, true);
window.addEventListener('pointerup', () => {
    window.setTimeout(() => {
        previewResizing = false;
    }, 0);
}, true);
document.body.addEventListener('htmx:afterSwap', () => {
    hoveredLink = null;
    previewLink = null;
    previewOpen = false;
    previewAnchor = null;
}, true);
document.body.addEventListener('keydown', trackModifier, true);
document.body.addEventListener('keyup', trackModifier, true);
window.addEventListener('blur', hideLinkPreview);
document.body.addEventListener('htmx:beforeSwap', hideLinkPreview);
