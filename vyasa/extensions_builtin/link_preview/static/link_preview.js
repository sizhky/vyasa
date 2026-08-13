import { LinkPreviewStack } from './link_preview_stack.js';
import {
    installLinkPreviewPanTracking,
    linkPreviewPreferredWidth,
    linkPreviewPointerGeometry,
    rememberLinkPreviewWidth,
    resizeLinkPreviewRect,
} from './link_preview_geometry.js';
import { linkPreviewHashMatch, linkPreviewLineMatch, linkPreviewLineNumber, linkPreviewSymbolMatch } from './link_preview_target.js';

const LINK_SELECTOR = 'a[data-vyasa-link-preview="true"]';
let hoveredLink = null;
let modifierDown = false;
// Above the tasks graph's maximized layer (z-index 10000, used by EG/EG+) and the
// 10000-band toasts and modals, below the 99999 confirm overlay.
let previewZ = 10500;
let pointerFrame = null;
let previewPage = `${window.location.pathname}${window.location.search}`;
const previewViews = new Set();

function schedulePointerRefresh() {
    if (pointerFrame !== null) return;
    pointerFrame = window.requestAnimationFrame(() => {
        pointerFrame = null;
        previewViews.forEach((view) => view.updatePointer());
    });
}

function inferCurrentPath() {
    const path = window.location.pathname || '';
    if (!path.startsWith('/posts/')) return '';
    return decodeURIComponent(path.slice('/posts/'.length));
}

function positionPopover(popover, point) {
    const height = Math.min(420, Math.max(220, window.innerHeight - 24));
    popover.style.height = `${height}px`;
    const width = popover.getBoundingClientRect().width;
    const left = Math.min(point.clientX + 18, window.innerWidth - width - 12);
    const top = Math.min(point.clientY + 18, window.innerHeight - height - 12);
    Object.assign(popover.style, {
        left: `${Math.max(12, left)}px`,
        top: `${Math.max(12, top)}px`,
    });
}

function installResizeHandles(popover, raise) {
    for (const edge of [
        'top', 'right', 'bottom', 'left',
        'top-left', 'top-right', 'bottom-right', 'bottom-left',
    ]) {
        const handle = document.createElement('div');
        handle.className = `vyasa-link-preview-resize-handle is-${edge}`;
        handle.dataset.resizeEdge = edge;
        let start = null;
        handle.addEventListener('pointerdown', (event) => {
            if (event.button !== 0) return;
            const rect = popover.getBoundingClientRect();
            start = {
                id: event.pointerId,
                x: event.clientX,
                y: event.clientY,
                rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
            };
            handle.setPointerCapture(event.pointerId);
            raise();
            event.preventDefault();
            event.stopPropagation();
        });
        handle.addEventListener('pointermove', (event) => {
            if (!start || start.id !== event.pointerId) return;
            const rect = resizeLinkPreviewRect(
                start.rect,
                edge,
                event.clientX - start.x,
                event.clientY - start.y,
                { width: window.innerWidth, height: window.innerHeight },
            );
            Object.assign(popover.style, {
                left: `${rect.left}px`,
                top: `${rect.top}px`,
                width: `${rect.width}px`,
                height: `${rect.height}px`,
            });
            if (edge.includes('left') || edge.includes('right')) rememberLinkPreviewWidth(rect.width);
            schedulePointerRefresh();
        });
        const finish = (event) => {
            if (!start || start.id !== event.pointerId) return;
            start = null;
            if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
        };
        handle.addEventListener('pointerup', finish);
        handle.addEventListener('pointercancel', finish);
        popover.appendChild(handle);
    }
}

function createPreviewView({ point, link, onClose }) {
    const popover = document.createElement('aside');
    const pointer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const pointerShape = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    const pointerOutline = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    popover.className = 'vyasa-link-preview-popover is-open';
    popover.setAttribute('role', 'dialog');
    popover.setAttribute('aria-label', 'Link preview');
    popover.innerHTML = [
        '<div class="vyasa-link-preview-card">',
        '<div class="vyasa-link-preview-bar">',
        '<a data-vyasa-link-preview-origin></a>',
        '<span class="vyasa-link-preview-actions">',
        '<button type="button" data-vyasa-link-preview-copy aria-label="Copy relative path; Shift-click copies absolute path"><uk-icon icon="copy" aria-hidden="true"></uk-icon></button>',
        '<button type="button" data-vyasa-link-preview-font-decrease aria-label="Decrease preview font size">−</button>',
        '<button type="button" data-vyasa-link-preview-font-increase aria-label="Increase preview font size">+</button>',
        '<button type="button" class="vyasa-link-preview-close" aria-label="Close preview">×</button>',
        '</span>',
        '</div>',
        '<div data-vyasa-link-preview-content class="vyasa-link-preview-content vyasa-link-preview-loading">Loading preview...</div>',
        '</div>',
    ].join('');
    pointer.classList.add('vyasa-link-preview-pointer');
    pointer.setAttribute('aria-hidden', 'true');
    pointer.appendChild(pointerShape);
    pointer.appendChild(pointerOutline);
    const content = popover.querySelector('[data-vyasa-link-preview-content]');
    const bar = popover.querySelector('.vyasa-link-preview-bar');
    const sourceLabel = popover.querySelector('[data-vyasa-link-preview-origin]');
    sourceLabel.textContent = link.textContent.trim() || link.getAttribute('href') || 'Link';
    const normalFontPx = parseFloat(getComputedStyle(document.querySelector('#main-content') || document.body).fontSize);
    let fontSizePt = Math.max(6, (normalFontPx || 18) * 0.75 - 2);
    const applyFontSize = () => {
        popover.style.setProperty('--vyasa-link-preview-font-size', `${fontSizePt}pt`);
    };
    popover.querySelector('[data-vyasa-link-preview-font-decrease]').addEventListener('click', () => {
        fontSizePt = Math.max(6, fontSizePt - 1);
        applyFontSize();
    });
    popover.querySelector('[data-vyasa-link-preview-font-increase]').addEventListener('click', () => {
        fontSizePt += 1;
        applyFontSize();
    });
    popover.querySelector('[data-vyasa-link-preview-copy]').addEventListener('click', (event) => {
        const shell = content.querySelector('.vyasa-link-preview-shell');
        const path = event.shiftKey ? shell?.dataset.absolutePath : shell?.dataset.relativePath;
        if (path) navigator.clipboard.writeText(path);
    });
    applyFontSize();
    const raise = () => {
        const z = previewZ += 2;
        pointer.style.zIndex = String(z + 1);
        popover.style.zIndex = String(z);
    };
    const updatePointer = () => {
        if (!link.isConnected) {
            pointer.hidden = true;
            return;
        }
        const sourceRect = link.getBoundingClientRect();
        const popupRect = popover.getBoundingClientRect();
        const geometry = linkPreviewPointerGeometry(sourceRect, popupRect);
        pointer.hidden = false;
        pointerShape.setAttribute('points', geometry.fill.map(([x, y]) => `${x},${y}`).join(' '));
        pointerOutline.setAttribute('d', `M ${geometry.outline[0]} L ${geometry.outline[1]} M ${geometry.outline[0]} L ${geometry.outline[2]}`);
    };
    let drag = null;
    bar.addEventListener('pointerdown', (event) => {
        if (event.button !== 0 || event.target.closest('button,a')) return;
        const rect = popover.getBoundingClientRect();
        drag = { id: event.pointerId, x: event.clientX, y: event.clientY, left: rect.left, top: rect.top };
        bar.setPointerCapture(event.pointerId);
        raise();
        event.preventDefault();
    });
    bar.addEventListener('pointermove', (event) => {
        if (!drag || drag.id !== event.pointerId) return;
        const rect = popover.getBoundingClientRect();
        const left = Math.min(window.innerWidth - rect.width - 8, drag.left + event.clientX - drag.x);
        const top = Math.min(window.innerHeight - rect.height - 8, drag.top + event.clientY - drag.y);
        popover.style.left = `${Math.max(8, left)}px`;
        popover.style.top = `${Math.max(8, top)}px`;
        schedulePointerRefresh();
    });
    const finishDrag = (event) => {
        if (!drag || drag.id !== event.pointerId) return;
        drag = null;
        if (bar.hasPointerCapture(event.pointerId)) bar.releasePointerCapture(event.pointerId);
    };
    bar.addEventListener('pointerup', finishDrag);
    bar.addEventListener('pointercancel', finishDrag);
    popover.querySelector('.vyasa-link-preview-close').addEventListener('click', onClose);
    popover.addEventListener('pointerdown', raise);
    installResizeHandles(popover, raise);
    document.body.appendChild(pointer);
    document.body.appendChild(popover);
    const initialWidth = popover.getBoundingClientRect().width;
    popover.style.width = `${linkPreviewPreferredWidth(initialWidth, window.innerWidth)}px`;
    positionPopover(popover, point);
    raise();
    const resizeObserver = new ResizeObserver(schedulePointerRefresh);
    resizeObserver.observe(popover);
    const view = {
        raise,
        updatePointer,
        remove: () => {
            resizeObserver.disconnect();
            previewViews.delete(view);
            pointer.remove();
            popover.remove();
        },
        setMessage: (message) => {
            content.className = 'vyasa-link-preview-content vyasa-link-preview-empty';
            content.textContent = message;
        },
        setContent: (html) => {
            content.className = 'vyasa-link-preview-content';
            content.innerHTML = html;
            window.__vyasaInitCodeTools?.(content);
            const relativePath = content.querySelector('.vyasa-link-preview-shell')?.dataset.relativePath;
            if (relativePath) {
                sourceLabel.textContent = relativePath;
                sourceLabel.title = relativePath;
                sourceLabel.href = link.getAttribute('href')
                    || `/posts/${relativePath.split('/').map(encodeURIComponent).join('/')}`;
            }
            requestAnimationFrame(() => scrollLinkPreviewToTarget(content, link.getAttribute('href') || ''));
            schedulePointerRefresh();
        },
    };
    previewViews.add(view);
    updatePointer();
    return view;
}

function scrollLinkPreviewToTarget(content, href) {
    const body = content.querySelector('.vyasa-link-preview-body');
    if (!body) return;
    const elementsWithIds = [...body.querySelectorAll('[id]')];
    const matchedId = linkPreviewHashMatch(href, elementsWithIds.map((element) => element.id));
    if (matchedId) {
        const target = elementsWithIds.find((element) => element.id === matchedId);
        target.classList.add('vyasa-link-preview-target-line');
        target.scrollIntoView({ block: 'center' });
        return;
    }
    const sourceLine = linkPreviewLineNumber(href);
    const renderedLine = sourceLine && body.querySelector(`[data-source-line="${sourceLine}"]`);
    if (renderedLine) {
        renderedLine.classList.add('vyasa-link-preview-target-line');
        renderedLine.scrollIntoView({ block: 'center' });
        return;
    }
    const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    while (walker.nextNode()) {
        if (walker.currentNode.textContent) textNodes.push(walker.currentNode);
    }
    const codeLines = [...body.querySelectorAll('.vyasa-code-line')];
    const chunks = (codeLines.length ? codeLines : textNodes).map((node) => node.textContent);
    const match = linkPreviewLineMatch(href, chunks) || linkPreviewSymbolMatch(href, chunks);
    if (!match) return;
    if (match.chunkIndex < 0) {
        if (match.kind.toLocaleLowerCase() === 'file') body.scrollTop = 0;
        return;
    }
    if (codeLines.length) {
        codeLines[match.chunkIndex].classList.add('vyasa-link-preview-target-line');
        codeLines[match.chunkIndex].scrollIntoView({ block: 'center' });
        return;
    }
    const node = textNodes[match.chunkIndex];
    const range = document.createRange();
    range.setStart(node, match.lineStart);
    range.setEnd(node, match.lineEnd);
    const target = document.createElement('span');
    target.className = 'vyasa-link-preview-target-line';
    range.surroundContents(target);
    target.scrollIntoView({ block: 'center' });
}

async function fetchPreview({ href, currentPath, signal }) {
    const url = new URL('/preview/link', window.location.origin);
    url.searchParams.set('href', href);
    const resolvedPath = currentPath || inferCurrentPath();
    if (resolvedPath) url.searchParams.set('current_path', resolvedPath);
    const response = await fetch(url.toString(), { signal, credentials: 'same-origin' });
    return response.ok ? response.text() : null;
}

const previews = new LinkPreviewStack({
    createView: createPreviewView,
    fetchPreview,
});

function linkFromEvent(event) {
    return event.target?.closest?.(LINK_SELECTOR) || null;
}

function openFromEvent(event) {
    const link = linkFromEvent(event);
    if (link) hoveredLink = link;
    if (!link || !(modifierDown || event.metaKey || event.ctrlKey)) return;
    previews.open(link, event);
}

function trackModifier(event) {
    const wasDown = modifierDown;
    modifierDown = event.metaKey || event.ctrlKey;
    if (!modifierDown || wasDown || !hoveredLink) return;
    const rect = hoveredLink.getBoundingClientRect();
    previews.open(hoveredLink, { clientX: rect.left, clientY: rect.bottom });
}

function handleKeydown(event) {
    if (event.key === 'Escape' && previews.closeLatest()) {
        event.preventDefault();
        event.stopPropagation();
        return;
    }
    trackModifier(event);
}

function closePreviewsForPage(path) {
    const url = new URL(path || window.location.href, window.location.origin);
    const nextPage = `${url.pathname}${url.search}`;
    if (nextPage === previewPage) return;
    previewPage = nextPage;
    previews.closeAll();
}

installLinkPreviewPanTracking(window, schedulePointerRefresh);
document.body.addEventListener('pointerover', openFromEvent, true);
document.body.addEventListener('pointermove', openFromEvent, true);
document.body.addEventListener('pointerout', (event) => {
    const link = linkFromEvent(event);
    if (link && (!event.relatedTarget || !link.contains(event.relatedTarget))) {
        if (hoveredLink === link) hoveredLink = null;
    }
}, true);
document.body.addEventListener('wheel', (event) => {
    const popover = event.target?.closest?.('.vyasa-link-preview-popover');
    if (!popover) return;
    const body = event.target?.closest?.('.vyasa-link-preview-body')
        || popover.querySelector('.vyasa-link-preview-body');
    if (!body) return;
    body.scrollTop += event.deltaY;
    body.scrollLeft += event.deltaX;
    event.preventDefault();
    event.stopPropagation();
}, { capture: true, passive: false });
window.addEventListener('keydown', handleKeydown, true);
window.addEventListener('keyup', trackModifier, true);
window.addEventListener('blur', () => { modifierDown = false; });
window.addEventListener('resize', schedulePointerRefresh);
window.addEventListener('scroll', schedulePointerRefresh, true);
window.addEventListener('popstate', () => closePreviewsForPage(window.location.href));
document.body.addEventListener('htmx:afterSwap', (event) => {
    hoveredLink = null;
    if (event.target?.id !== 'main-content') return;
    closePreviewsForPage(
        event.detail?.xhr?.responseURL
        || event.detail?.requestConfig?.path
        || window.location.href,
    );
}, true);
