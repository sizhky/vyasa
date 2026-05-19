const LINK_PREVIEW_SELECTOR = 'a[data-vyasa-link-preview="true"]';

let previewPopover = null;
let previewAbort = null;
let previewToken = 0;
let previewLink = null;
let hoveredLink = null;
let modifierDown = false;

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
    popover.innerHTML = `<div class="vyasa-link-preview-card"><div class="vyasa-link-preview-empty">${message}</div></div>`;
    popover.classList.add('is-open');
}

function setPreviewContent(content) {
    const popover = ensurePreviewPopover();
    popover.innerHTML = `<div class="vyasa-link-preview-card">${content}</div>`;
    popover.classList.add('is-open');
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
}

function positionLinkPreview(event) {
    const popover = ensurePreviewPopover();
    const width = Math.min(384, Math.max(240, window.innerWidth - 24));
    const height = Math.min(320, Math.max(160, window.innerHeight - 24));
    const x = Math.min(event.clientX + 18, window.innerWidth - width - 12);
    const y = Math.min(event.clientY + 18, window.innerHeight - height - 12);
    popover.style.width = `${width}px`;
    popover.style.maxHeight = `${height}px`;
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
    popover.innerHTML = '<div class="vyasa-link-preview-card"><div class="vyasa-link-preview-loading">Loading preview...</div></div>';
    popover.classList.add('is-open');
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
        positionLinkPreview(event);
    } catch {
        if (token === previewToken) hideLinkPreview();
    }
}

function maybeShowPreview(event) {
    const link = event.target?.closest?.(LINK_PREVIEW_SELECTOR);
    if (link) hoveredLink = link;
    if (!(modifierDown || event.metaKey || event.ctrlKey)) return;
    if (!link) return;
    if (previewLink === link) {
        positionLinkPreview(event);
        return;
    }
    previewLink = link;
    loadLinkPreview(link, event);
}

function trackModifier(event) {
    const wasDown = modifierDown;
    modifierDown = event.metaKey || event.ctrlKey;
    if (!modifierDown) hideLinkPreview();
    else if (!wasDown && hoveredLink) {
        const rect = hoveredLink.getBoundingClientRect();
        previewLink = hoveredLink;
        positionLinkPreview({
            clientX: rect.left,
            clientY: rect.bottom,
        });
        loadLinkPreview(hoveredLink, {
            clientX: rect.left,
            clientY: rect.bottom,
        });
    }
}

document.body.addEventListener('pointerover', maybeShowPreview, true);
document.body.addEventListener('pointermove', (event) => {
    if (previewLink && (modifierDown || event.metaKey || event.ctrlKey) && event.target?.closest?.(LINK_PREVIEW_SELECTOR) === previewLink) {
        positionLinkPreview(event);
    }
}, true);
document.body.addEventListener('pointerout', (event) => {
    const link = event.target?.closest?.(LINK_PREVIEW_SELECTOR);
    if (!link) return;
    if (!event.relatedTarget || !link.contains(event.relatedTarget)) {
        if (hoveredLink === link) hoveredLink = null;
    }
    if (link !== previewLink) return;
    if (event.relatedTarget && link.contains(event.relatedTarget)) return;
    hideLinkPreview();
}, true);
document.body.addEventListener('keydown', trackModifier, true);
document.body.addEventListener('keyup', trackModifier, true);
window.addEventListener('blur', hideLinkPreview);
document.body.addEventListener('htmx:beforeSwap', hideLinkPreview);
