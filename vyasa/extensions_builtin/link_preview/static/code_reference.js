// Browser runtime for code references.
//
// The server sends one continuous source range plus the focus ranges inside it.
// This file only presents them: scroll the real file, mark where the changes
// are, and move between them. It must not repeat git lookup, symbol selection,
// or range calculation.

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

// The preview body is the scroll container. The reference must not scroll
// itself: the popup card sizes with `min-height`, so a percentage height
// inside it collapses and the scroller ends up with nothing to scroll.
function scroller(reference) {
    return reference.closest('.vyasa-link-preview-body') || reference.parentElement;
}

function lineElement(reference, line) {
    return reference.querySelector(`.vyasa-code-line[data-source-line="${line}"]`);
}

function centreLine(reference, line, smooth = true) {
    const body = scroller(reference);
    const target = lineElement(reference, line);
    if (!body || !target) return false;
    // Measure against the scroller itself: `offsetTop` resolves against the
    // positioned reference, which includes the header and the controls.
    const bodyRect = body.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const offset = body.scrollTop + (targetRect.top - bodyRect.top)
        - body.clientHeight / 2 + targetRect.height / 2;
    body.scrollTo({ top: Math.max(offset, 0), behavior: smooth ? 'smooth' : 'auto' });
    return true;
}

function markCurrent(reference, index, total) {
    const position = reference.querySelector('[data-code-reference-position]');
    if (position && total) position.textContent = `${index + 1} / ${total}`;
}

function installNavigation(reference, ranges, start = 0) {
    let current = start;
    const step = (delta) => {
        if (!ranges.length) return;
        current = (current + delta + ranges.length) % ranges.length;
        centreLine(reference, ranges[current].start);
        markCurrent(reference, current, ranges.length);
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
    return {
        step,
        index: () => current,
        show: (index) => {
            current = index;
            markCurrent(reference, current, ranges.length);
        },
    };
}

// Swap the focused view for the whole file, or back. The reader keeps the
// block they were reading, so the toggle widens the view instead of losing
// their place.
async function toggleFullFile(reference, options, index) {
    const button = reference.querySelector('[data-code-reference-toggle-full]');
    const wantFull = reference.dataset.codeReferenceFull !== 'true';
    if (!options.load || button?.disabled) return;
    button.disabled = true;
    try {
        const markup = await options.load(wantFull);
        const next = markup
            && new DOMParser().parseFromString(markup, 'text/html')
                .querySelector('.vyasa-code-reference');
        if (!next) return;
        reference.replaceWith(next);
        options.onSwap?.(next);
        installCodeReferences(next.parentElement || next, { ...options, startIndex: index });
    } finally {
        button.disabled = false;
    }
}

export function installCodeReferences(root = document, options = {}) {
    for (const reference of root.querySelectorAll('.vyasa-code-reference')) {
        if (reference.dataset[BOUND] === 'true') continue;
        reference.dataset[BOUND] = 'true';
        const ranges = parseBlockRanges(reference.dataset.codeReferenceBlocks);
        const start = Math.min(Math.max(options.startIndex || 0, 0), Math.max(ranges.length - 1, 0));
        const navigation = installNavigation(reference, ranges, start);
        navigation.show(start);
        if (options.startIndex && ranges[start]) centreLine(reference, ranges[start].start, false);
        reference.querySelector('[data-code-reference-copy]')?.addEventListener('click', () => {
            copyText(textOf(reference.querySelector('.vyasa-code-reference-body code')));
        });
        reference.querySelector('[data-code-reference-toggle-full]')?.addEventListener('click', () => {
            toggleFullFile(reference, options, navigation.index());
        });
    }
}

// Put the first changed block on screen. The reader can then scroll the whole
// file from there in either direction.
export function scrollToFirstCodeReferenceFocus(root) {
    const reference = root.querySelector('.vyasa-code-reference');
    if (!reference) return false;
    const ranges = parseBlockRanges(reference.dataset.codeReferenceBlocks);
    if (!ranges.length) return true;
    if (!centreLine(reference, ranges[0].start, false)) return true;
    lineElement(reference, ranges[0].start)?.classList.add('vyasa-link-preview-target-line');
    return true;
}
