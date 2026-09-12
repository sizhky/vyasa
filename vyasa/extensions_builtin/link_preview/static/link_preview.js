import { LinkPreviewStack } from './link_preview_stack.js';
import {
    installLinkPreviewPanTracking,
    linkPreviewPreferredHeight,
    linkPreviewPreferredPosition,
    linkPreviewPreferredWidth,
    linkPreviewPointerGeometry,
    linkPreviewStoredPosition,
    rememberLinkPreviewHeight,
    rememberLinkPreviewPosition,
    rememberLinkPreviewWidth,
    resizeLinkPreviewRect,
} from './link_preview_geometry.js';
import { linkPreviewCodeLineHref, linkPreviewHashMatch, linkPreviewLineMatch, linkPreviewLineNumber, linkPreviewSymbolMatch } from './link_preview_target.js';
import { installCodeReferences, scrollToFirstCodeReferenceFocus } from './code_reference.js';

const LINK_SELECTOR = 'a[data-vyasa-link-preview="true"]';
const WORD_WRAP_KEY = 'vyasa:link_preview:word_wrap';
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

// Placed popups form a stack, newest last. The newest one anchors the next, so
// each new popup steps to its bottom right. A closed popup leaves the stack and
// gives its place back. When the stack empties, the last dragged place is the
// default again.
const positionStack = [];

function positionAnchorRect() {
    const anchor = positionStack.at(-1);
    if (!anchor?.isConnected) return null;
    const rect = anchor.getBoundingClientRect();
    return { left: rect.left, top: rect.top };
}

function forgetPositionAnchor(popover) {
    const index = positionStack.indexOf(popover);
    if (index >= 0) positionStack.splice(index, 1);
}

function trackPositionAnchor(popover) {
    forgetPositionAnchor(popover);
    positionStack.push(popover);
}

function positionPopover(popover, point) {
    const height = linkPreviewPreferredHeight(
        Math.min(420, Math.max(220, window.innerHeight - 24)),
        window.innerHeight,
    );
    popover.style.height = `${height}px`;
    const width = popover.getBoundingClientRect().width;
    const anchor = positionAnchorRect();
    const place = linkPreviewPreferredPosition(
        { left: point.clientX + 18, top: point.clientY + 18 },
        { width, height },
        { width: window.innerWidth, height: window.innerHeight },
        anchor,
    );
    Object.assign(popover.style, {
        left: `${place.left}px`,
        top: `${place.top}px`,
    });
    if (anchor || linkPreviewStoredPosition()) trackPositionAnchor(popover);
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
            if (edge.includes('top') || edge.includes('bottom')) rememberLinkPreviewHeight(rect.height);
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

// One owner decides which element inside a popover scrolls. The wheel handler
// below and the graph's code mode both ask here, so a change to the preview
// markup moves one line, not two.
function scrollPreviewBody(popover, deltaX, deltaY) {
    const body = popover?.querySelector?.('.vyasa-link-preview-body');
    if (!body) return false;
    body.scrollTop += deltaY;
    body.scrollLeft += deltaX;
    return true;
}

function createPreviewView({ point, link, onClose }) {
    let activeLink = link;
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
        '<span class="vyasa-link-preview-source" data-vyasa-link-preview-source hidden></span>',
        '<a data-vyasa-link-preview-origin></a>',
        '<span class="vyasa-link-preview-actions">',
        '<button type="button" data-vyasa-link-preview-wrap aria-label="Toggle word wrap" aria-pressed="false">↵</button>',
        '<button type="button" data-vyasa-link-preview-copy aria-label="Copy relative path; Shift-click copies absolute path"><uk-icon icon="copy" aria-hidden="true"></uk-icon></button>',
        '<button type="button" data-vyasa-link-preview-font-decrease aria-label="Decrease preview font size">−</button>',
        '<button type="button" data-vyasa-link-preview-font-increase aria-label="Increase preview font size">+</button>',
        '<button type="button" class="vyasa-link-preview-close" aria-label="Close preview">×</button>',
        '</span>',
        '</div>',
        '<div class="vyasa-link-preview-tabs" role="tablist" aria-label="Code URLs" hidden></div>',
        '<div data-vyasa-link-preview-content class="vyasa-link-preview-content vyasa-link-preview-loading">Loading preview...</div>',
        '</div>',
    ].join('');
    pointer.classList.add('vyasa-link-preview-pointer');
    pointer.setAttribute('aria-hidden', 'true');
    pointer.appendChild(pointerShape);
    pointer.appendChild(pointerOutline);
    const content = popover.querySelector('[data-vyasa-link-preview-content]');
    const bar = popover.querySelector('.vyasa-link-preview-bar');
    const tabs = popover.querySelector('.vyasa-link-preview-tabs');
    let tabSignature = '';
    let selectTab = () => {};
    const sourceLabel = popover.querySelector('[data-vyasa-link-preview-origin]');
    const sourceOrigin = popover.querySelector('[data-vyasa-link-preview-source]');
    const wrapButton = popover.querySelector('[data-vyasa-link-preview-wrap]');
    let wordWrap = false;
    try { wordWrap = localStorage.getItem(WORD_WRAP_KEY) === '1'; } catch (_) {}
    const applyWordWrap = () => {
        content.querySelectorAll('pre').forEach((pre) => pre.classList.toggle('vyasa-code-wrap', wordWrap));
        wrapButton.setAttribute('aria-pressed', String(wordWrap));
    };
    wrapButton.addEventListener('click', () => {
        wordWrap = !wordWrap;
        try { localStorage.setItem(WORD_WRAP_KEY, wordWrap ? '1' : '0'); } catch (_) {}
        applyWordWrap();
    });
    applyWordWrap();
    sourceLabel.textContent = activeLink.textContent.trim() || activeLink.getAttribute('href') || 'Link';
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
        if (!activeLink.isConnected) {
            pointer.hidden = true;
            return;
        }
        const sourceRect = activeLink.getBoundingClientRect();
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
        drag.moved = true;
        schedulePointerRefresh();
    });
    const finishDrag = (event) => {
        if (!drag || drag.id !== event.pointerId) return;
        // Only a real drag sets the place for the next popup. A plain click on
        // the bar must not move later popups away from the pointer.
        if (drag.moved) {
            const rect = popover.getBoundingClientRect();
            rememberLinkPreviewPosition(rect.left, rect.top);
            trackPositionAnchor(popover);
        }
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
    let pinBloomTimer = 0;
    const view = {
        raise,
        updatePointer,
        pin: () => {
            window.clearTimeout(pinBloomTimer);
            popover.classList.remove('vyasa-link-preview-pin-bloom');
            void popover.offsetWidth;
            popover.classList.add('vyasa-link-preview-pin-bloom');
            pinBloomTimer = window.setTimeout(
                () => popover.classList.remove('vyasa-link-preview-pin-bloom'),
                3520,
            );
            raise();
        },
        setTabs: (links, activeIndex, onSelect) => {
            selectTab = onSelect;
            const nextSignature = links.map((item) => item.getAttribute('href') || '').join('\n');
            if (nextSignature !== tabSignature) {
                tabs.replaceChildren();
                links.forEach((item, index) => {
                    const button = document.createElement('button');
                    const href = item.getAttribute('href') || '';
                    button.type = 'button';
                    button.setAttribute('role', 'tab');
                    button.textContent = decodeURIComponent(href.split(/[?#]/)[0].split('/').pop() || href);
                    button.title = href;
                    button.addEventListener('click', () => selectTab(index));
                    button.addEventListener('keydown', (event) => {
                        const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
                        if (!delta) return;
                        const target = (index + delta + links.length) % links.length;
                        selectTab(target);
                        tabs.children[target]?.focus();
                        event.preventDefault();
                        event.stopPropagation();
                    });
                    tabs.appendChild(button);
                });
                tabSignature = nextSignature;
            }
            Array.from(tabs.children).forEach((button, index) => {
                button.setAttribute('aria-selected', String(index === activeIndex));
                button.tabIndex = index === activeIndex ? 0 : -1;
            });
            tabs.hidden = links.length < 2;
        },
        setLink: (nextLink) => {
            activeLink = nextLink;
            sourceLabel.textContent = activeLink.textContent.trim() || activeLink.getAttribute('href') || 'Link';
            content.className = 'vyasa-link-preview-content vyasa-link-preview-loading';
            content.textContent = 'Loading preview...';
        },
        scrollBy: (deltaX, deltaY) => scrollPreviewBody(popover, deltaX, deltaY),
        // Walk the reference's marked blocks. The Prev and Next buttons already
        // own that walk, so drive them instead of repeating the block maths.
        // A preview with no marked blocks carries no buttons and reports false.
        stepCodeBlock: (delta) => {
            const button = popover.querySelector(delta > 0
                ? '[data-code-reference-next]'
                : '[data-code-reference-previous]');
            if (!button) return false;
            button.click();
            return true;
        },
        remove: () => {
            window.clearTimeout(pinBloomTimer);
            resizeObserver.disconnect();
            forgetPositionAnchor(popover);
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
            applyWordWrap();
            window.__vyasaInitCodeTools?.(content);
            installCodeLineLinks(content);
            announceSwap(content);
            installCodeReferences(content, {
                // The full-file view is fetched only when the reader asks, so a
                // hover preview stays small.
                load: (full) => fetchPreview({
                    href: activeLink.getAttribute('href') || '',
                    currentPath: activeLink.dataset.vyasaLinkPreviewCurrentPath || '',
                    codeReference: activeLink.dataset.vyasaCodeReference || '',
                    full,
                }),
                onSwap: () => {
                    window.__vyasaInitCodeTools?.(content);
                    installCodeLineLinks(content);
                    announceSwap(content);
                },
            });
            const shellData = content.querySelector('.vyasa-link-preview-shell')?.dataset;
            const relativePath = shellData?.relativePath;
            if (relativePath) {
                // A cached source names its origin once, so the path stays
                // short. The href keeps the whole address either way.
                const origin = shellData?.sourceOrigin || '';
                sourceOrigin.textContent = origin;
                sourceOrigin.title = origin;
                sourceOrigin.hidden = !origin;
                const shown = shellData?.sourcePath || relativePath;
                sourceLabel.textContent = shown;
                sourceLabel.title = origin ? `${origin}/${shown}` : shown;
                sourceLabel.href = activeLink.getAttribute('href')
                    || `/posts/${relativePath.split('/').map(encodeURIComponent).join('/')}`;
            }
            requestAnimationFrame(() => scrollLinkPreviewToTarget(content, activeLink.getAttribute('href') || ''));
            schedulePointerRefresh();
        },
    };
    previewViews.add(view);
    updatePointer();
    return view;
}

function installCodeLineLinks(content) {
    const shell = content.querySelector('.vyasa-link-preview-shell');
    const relativePath = shell?.dataset.relativePath;
    if (!relativePath) return;
    for (const line of content.querySelectorAll('.vyasa-code-line[data-source-line]')) {
        const href = linkPreviewCodeLineHref(relativePath, line.dataset.sourceLine);
        if (!href || line.querySelector('[data-vyasa-link-preview-code-line]')) continue;
        const anchor = document.createElement('a');
        anchor.href = href;
        anchor.className = 'vyasa-link-preview-code-line';
        anchor.dataset.sourceLine = line.dataset.sourceLine;
        anchor.dataset.vyasaLinkPreviewCodeLine = 'true';
        anchor.setAttribute('aria-label', `Open ${relativePath} line ${line.dataset.sourceLine} in VS Code`);
        line.prepend(anchor);
    }
}

function scrollLinkPreviewToTarget(content, href) {
    const body = content.querySelector('.vyasa-link-preview-body');
    if (!body) return;
    // A code reference already carries server-resolved focus ranges, so the
    // legacy symbol and line heuristics must not run for it.
    if (scrollToFirstCodeReferenceFocus(body)) return;
    const elementsWithIds = [...body.querySelectorAll('[id]')];
    const matchedId = linkPreviewHashMatch(href, elementsWithIds.map((element) => element.id));
    if (matchedId) {
        const target = elementsWithIds.find((element) => element.id === matchedId);
        target.classList.add('vyasa-link-preview-target-line');
        target.scrollIntoView({ block: 'center' });
        return;
    }
    const sourceLine = Number(content.querySelector('.vyasa-link-preview-shell')?.dataset.targetLine)
        || linkPreviewLineNumber(href);
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

async function fetchPreview({ href, currentPath, codeReference, full, signal }) {
    const url = new URL('/preview/link', window.location.origin);
    url.searchParams.set('href', href);
    const resolvedPath = currentPath || inferCurrentPath();
    if (resolvedPath) url.searchParams.set('current_path', resolvedPath);
    if (codeReference) url.searchParams.set('code_ref', codeReference);
    if (full) url.searchParams.set('full', '1');
    const response = await fetch(url.toString(), { signal, credentials: 'same-origin' });
    return response.ok ? response.text() : null;
}

const previews = new LinkPreviewStack({
    createView: createPreviewView,
    fetchPreview,
});

// A preview normally follows a link the reader can point at. The tasks graph
// has no such link: its node attributes live in a model, not in the page. This
// door lets it open a preview from a detached anchor it builds itself, and
// scroll that preview while the pointer stays on the graph. `link` only has to
// carry `href`, and may carry `data-vyasa-code-reference` and
// `data-vyasa-link-preview-current-path`, the same as a link in the page.
window.vyasaLinkPreview = {
    open: (link, point) => previews.open(link, point),
    pin: (entry) => previews.pin(entry),
    close: (entry) => previews.close(entry),
    isOpen: (entry) => previews.has(entry),
    replace: (entry, link) => previews.replace(entry, link),
    setTabs: (entry, links, activeIndex, onSelect) => entry?.view?.setTabs?.(links, activeIndex, onSelect),
    scrollBy: (entry, deltaX, deltaY) => entry?.view?.scrollBy?.(deltaX, deltaY) === true,
    stepCodeBlock: (entry, delta) => entry?.view?.stepCodeBlock?.(delta) === true,
};

// `innerHTML` runs no `<script>` tag, so a preview built from a document with
// a Vega, Mermaid, or D2 block arrives as inert markup. The page-wide swap
// pipeline in `scripts.js` already loads the bundle assets a subtree asks for
// and mounts those blocks, and it hangs off `htmx:afterSwap` on `document.body`.
// Dispatch from the preview body, not from body itself: the event bubbles up
// carrying the new subtree as `event.target`, so nothing rescans the page.
function announceSwap(root) {
    root.dispatchEvent(new CustomEvent('htmx:afterSwap', { bubbles: true, detail: {} }));
}

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
    if (!popover || !scrollPreviewBody(popover, event.deltaX, event.deltaY)) return;
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
