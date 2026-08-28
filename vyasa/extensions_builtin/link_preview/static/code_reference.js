// Browser runtime for code references.
//
// The server sends one continuous source range plus the changed blocks inside
// it. This file only presents them: scroll the real file, move between the
// blocks, and widen the view to the whole file on request. It must not repeat
// git lookup, symbol selection, or range calculation.

const BOUND = 'codeReferenceBound';

function copyText(text) {
    if (!text) return;
    if (window.__vyasaCopyCode) {
        window.__vyasaCopyCode(text);
        return;
    }
    navigator.clipboard?.writeText(text);
}

function textOf(element) {
    if (window.__vyasaCodeTextOf) return window.__vyasaCodeTextOf(element);
    return element?.textContent || '';
}

export function parseBlockRanges(spec) {
    const ranges = [];
    for (const part of String(spec || '').split(',')) {
        const item = part.trim();
        if (!item) continue;
        const [start, end] = item.split('-').map(Number);
        if (!Number.isFinite(start)) continue;
        ranges.push({ start, end: Number.isFinite(end) ? end : start });
    }
    return ranges;
}

// The block a reader is looking at, by distance from one line. Prev and Next
// work from where the reader actually is, so they stay correct after a manual
// scroll and after the view widens to the whole file.
export function nearestBlockIndex(ranges, line) {
    let best = 0;
    let bestDistance = Infinity;
    ranges.forEach((range, index) => {
        const distance = line < range.start
            ? range.start - line
            : line > range.end ? line - range.end : 0;
        if (distance < bestDistance) {
            bestDistance = distance;
            best = index;
        }
    });
    return best;
}

// The preview body is the scroll container. The reference must not scroll
// itself: the popup card sizes with `min-height`, so a percentage height
// inside it collapses and the scroller ends up with nothing to scroll.
function scroller(reference) {
    return reference.closest('.vyasa-link-preview-body') || reference.parentElement;
}

function lineElement(reference, line) {
    return reference.querySelector(`.vyasa-code-line[data-source-line="${line}"]`);
}

// Binary search the rendered lines for the one sitting `offset` below the top
// of the viewport. Lines run in document order, so their edges only increase.
// A plain scan would measure every line of a 3000-line file.
function lineAtOffset(reference, offset) {
    const body = scroller(reference);
    const lines = reference.querySelectorAll('.vyasa-code-line[data-source-line]');
    if (!body || !lines.length) return null;
    const bodyTop = body.getBoundingClientRect().top;
    const edge = bodyTop + offset;
    let low = 0;
    let high = lines.length - 1;
    let found = lines.length - 1;
    while (low <= high) {
        const mid = (low + high) >> 1;
        if (lines[mid].getBoundingClientRect().bottom > edge) {
            found = mid;
            high = mid - 1;
        } else {
            low = mid + 1;
        }
    }
    return {
        line: Number(lines[found].dataset.sourceLine),
        offset: lines[found].getBoundingClientRect().top - bodyTop,
    };
}

function centreLine(reference, line, smooth = true) {
    const body = scroller(reference);
    const target = lineElement(reference, line);
    if (!body || !target) return false;
    // Measure against the scroller itself: `offsetTop` resolves against the
    // nearest positioned ancestor, which is not always the scroller.
    const delta = target.getBoundingClientRect().top - body.getBoundingClientRect().top;
    const top = body.scrollTop + delta - body.clientHeight / 2 + target.offsetHeight / 2;
    body.scrollTo({ top: Math.max(top, 0), behavior: smooth ? 'smooth' : 'auto' });
    return true;
}

// Put the reader back on the line they were reading, at the same height on
// screen. Line numbers are absolute, so this survives the full-file swap.
function restoreAnchor(reference, anchor) {
    const body = scroller(reference);
    const target = anchor && lineElement(reference, anchor.line);
    if (!body || !target) return false;
    const delta = target.getBoundingClientRect().top - body.getBoundingClientRect().top;
    body.scrollTop += delta - anchor.offset;
    return true;
}

function markCurrent(reference, index, total) {
    const position = reference.querySelector('[data-code-reference-position]');
    if (position && total) position.textContent = `${index + 1} / ${total}`;
}

function currentBlock(reference, ranges) {
    if (!ranges.length) return 0;
    const middle = lineAtOffset(reference, (scroller(reference)?.clientHeight || 0) / 2);
    return middle ? nearestBlockIndex(ranges, middle.line) : 0;
}

function installNavigation(reference, ranges) {
    const step = (delta) => {
        // One block cycles onto itself, so the reader can always come back to
        // the change after scrolling away.
        if (!ranges.length) return;
        const index = (currentBlock(reference, ranges) + delta + ranges.length) % ranges.length;
        centreLine(reference, ranges[index].start, true);
        markCurrent(reference, index, ranges.length);
    };
    reference.querySelector('[data-code-reference-previous]')?.addEventListener('click', () => step(-1));
    reference.querySelector('[data-code-reference-next]')?.addEventListener('click', () => step(1));
    // Alt+Arrow leaves plain arrow keys free to scroll the source line by line.
    reference.addEventListener('keydown', (event) => {
        if (!event.altKey || event.ctrlKey || event.metaKey) return;
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
        step(event.key === 'ArrowDown' ? 1 : -1);
        event.preventDefault();
    });
}

function trackPosition(reference, ranges) {
    const body = scroller(reference);
    if (!body || ranges.length < 2) return;
    let queued = false;
    body.addEventListener('scroll', () => {
        if (queued) return;
        queued = true;
        requestAnimationFrame(() => {
            queued = false;
            markCurrent(reference, currentBlock(reference, ranges), ranges.length);
        });
    }, { passive: true });
}

// Swap the focused view for the whole file, or back, without moving the
// reader. The full view is fetched only when asked, so a hover preview of one
// symbol stays small.
async function toggleFullFile(reference, options) {
    const button = reference.querySelector('[data-code-reference-toggle-full]');
    if (!options.load || !button || button.disabled) return;
    const wantFull = reference.dataset.codeReferenceFull !== 'true';
    const anchor = lineAtOffset(reference, 0);
    button.disabled = true;
    try {
        const markup = await options.load(wantFull);
        const next = markup && new DOMParser()
            .parseFromString(markup, 'text/html')
            .querySelector('.vyasa-code-reference');
        if (!next) return;
        const parent = reference.parentElement;
        reference.replaceWith(next);
        options.onSwap?.(next);
        installCodeReferences(parent || next, { ...options, anchor });
    } finally {
        button.disabled = false;
    }
}

export function installCodeReferences(root = document, options = {}) {
    for (const reference of root.querySelectorAll('.vyasa-code-reference')) {
        if (reference.dataset[BOUND] === 'true') continue;
        reference.dataset[BOUND] = 'true';
        const ranges = parseBlockRanges(reference.dataset.codeReferenceBlocks);
        installNavigation(reference, ranges);
        trackPosition(reference, ranges);
        if (options.anchor) {
            // Restore once now and once after layout settles: the code runtime
            // may still be wrapping lines when the swap returns.
            restoreAnchor(reference, options.anchor);
            requestAnimationFrame(() => restoreAnchor(reference, options.anchor));
        }
        markCurrent(reference, currentBlock(reference, ranges), ranges.length);
        reference.querySelector('[data-code-reference-copy]')?.addEventListener('click', () => {
            copyText(textOf(reference.querySelector('.vyasa-code-reference-body code')));
        });
        reference.querySelector('[data-code-reference-toggle-full]')?.addEventListener('click', () => {
            toggleFullFile(reference, options);
        });
    }
}

// Open on the first changed block. The reader can then scroll the whole file
// from there in either direction.
export function scrollToFirstCodeReferenceFocus(root) {
    const reference = root.querySelector('.vyasa-code-reference');
    if (!reference) return false;
    const ranges = parseBlockRanges(reference.dataset.codeReferenceBlocks);
    if (!ranges.length) return true;
    if (!centreLine(reference, ranges[0].start, false)) return true;
    lineElement(reference, ranges[0].start)?.classList.add('vyasa-link-preview-target-line');
    return true;
}
