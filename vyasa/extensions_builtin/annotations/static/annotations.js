function initAnnotations(root = document) {
    const main = root.getElementById?.('main-content') || document.getElementById('main-content');
    if (!main || main.dataset.annotationsEnabled !== '1' || main.dataset.annotationsBound === '1') return;
    main.dataset.annotationsBound = '1';
    window.__vyasaAnnotationsLifecycle?.abort();
    const lifecycle = new AbortController();
    window.__vyasaAnnotationsLifecycle = lifecycle;
    document.querySelectorAll('[data-vyasa-comment-popup]').forEach((popup) => popup.remove());
    const path = main.dataset.annotationPath || '__index__';
    const currentAuthor = main.dataset.annotationAuthor || 'anonymous';
    let pending = null;
    const sourceAnchors = new Map();
    let activeGlows = [];
    let commentsSection = null;
    let commentsList = null;
    let annotationRoots = [];
    const commentPopups = new Map();
    const popupStateKey = 'vyasa.annotations.popups.v1';
    let persistedPopups = [];
    let hoveredPopup = null;
    let popupZ = 1500;
    lifecycle.signal.addEventListener('abort', () => {
        commentPopups.forEach((state) => { clearTimeout(state.hideTimer); clearTimeout(state.glowTimer); });
        clearActiveGlows();
    }, { once: true });
    try {
        const stored = JSON.parse(localStorage.getItem(popupStateKey) || '[]');
        if (Array.isArray(stored)) persistedPopups = stored
            .filter((entry) => entry?.pinned === true && typeof entry.path === 'string' && typeof entry.id === 'string')
            .map((entry) => ({ path: entry.path, id: entry.id, pinned: true }));
        localStorage.setItem(popupStateKey, JSON.stringify(persistedPopups));
    } catch (_) {}
    try { localStorage.removeItem('vyasa.annotations.popupPosition.v2'); } catch (_) {}
    if (!persistedPopups.length) {
        try {
            const target = JSON.parse(localStorage.getItem('vyasa.annotations.popupTarget') || 'null');
            if (localStorage.getItem('vyasa.annotations.popupPinned') === 'true' && target?.path && target?.id) {
                persistedPopups.push({ path: target.path, id: target.id, pinned: true });
                localStorage.setItem(popupStateKey, JSON.stringify(persistedPopups));
            }
        } catch (_) {}
    }
    const clearActiveGlows = () => {
        activeGlows.forEach((glow) => glow.remove());
        activeGlows = [];
    };
    const annotationHiddenText = (node) => {
        const parent = node.parentElement;
        if (!parent) return true;
        if (parent.closest('textarea, input, button, select, option, script, style, template, [hidden], [aria-hidden="true"]')) return true;
        const style = window.getComputedStyle(parent);
        return style.display === 'none' || style.visibility === 'hidden';
    };
    const annotationIgnored = (node) => {
        const parent = node.parentElement;
        return !parent
            || annotationHiddenText(node)
            || parent.closest('.vyasa-comments, .vyasa-comment-anchor, #vyasa-annotation-composer, #vyasa-annotation-trigger');
    };
    const normalizeQuote = (value) => String(value || '').replace(/\s+/g, ' ').trim();
    const rangeToAnchor = (range) => {
        const { nodes } = buildTextIndex();
        const startNode = nodes.find((entry) => entry.node === range.startContainer);
        const endNode = nodes.find((entry) => entry.node === range.endContainer);
        if (!startNode || !endNode) return null;
        return {
            start: startNode.start + range.startOffset,
            end: endNode.start + range.endOffset,
        };
    };
    const anchorToRange = (anchor) => {
        if (!anchor || typeof anchor.start !== 'number' || typeof anchor.end !== 'number') return null;
        const { nodes } = buildTextIndex();
        const locateNode = (offset, preferNextAtBoundary = false) => {
            const index = nodes.findIndex((entry) => offset >= entry.start && offset <= entry.end);
            if (index === -1) return null;
            const entry = nodes[index];
            if (preferNextAtBoundary && offset === entry.end && nodes[index + 1]?.start === offset) return nodes[index + 1];
            return entry;
        };
        const a = locateNode(anchor.start, true);
        const endOffset = Math.max(anchor.start, anchor.end - 1);
        const b = locateNode(endOffset, false);
        if (!a || !b) return null;
        const range = document.createRange();
        range.setStart(a.node, Math.max(0, anchor.start - a.start));
        range.setEnd(b.node, Math.max(0, anchor.end - b.start));
        return range;
    };
    const buildTextIndex = () => {
        const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
        const nodes = [];
        let raw = '', node;
        while ((node = walker.nextNode())) {
            const value = node.nodeValue || '';
            if (!value || annotationIgnored(node)) continue;
            nodes.push({ node, start: raw.length, end: raw.length + value.length });
            raw += value;
        }
        const map = [];
        let normalized = '', gap = false;
        for (let i = 0; i < raw.length; i += 1) {
            const ch = raw[i];
            if (/\s/.test(ch)) {
                if (!gap) { normalized += ' '; map.push(i); gap = true; }
            } else {
                normalized += ch; map.push(i); gap = false;
            }
        }
        return { nodes, raw, normalized, map };
    };
    const findQuoteRange = (quote) => {
        const { nodes, normalized, map } = buildTextIndex();
        const needle = normalizeQuote(quote);
        const startNorm = normalized.indexOf(needle);
        const endNorm = startNorm + needle.length - 1;
        if (startNorm === -1 || endNorm < startNorm) return null;
        const start = map[startNorm], end = map[endNorm] + 1;
        if (start === -1) return null;
        const a = nodes.find((entry) => start >= entry.start && start <= entry.end);
        const b = nodes.find((entry) => end >= entry.start && end <= entry.end);
        if (!a || !b) return null;
        const range = document.createRange();
        range.setStart(a.node, Math.max(0, start - a.start));
        range.setEnd(b.node, Math.max(0, end - b.start));
        return range;
    };
    const highlightRects = (quote, anchor = null) => {
        const { nodes, normalized, map } = buildTextIndex();
        let start = null, end = null;
        if (anchor && typeof anchor.start === 'number' && typeof anchor.end === 'number') {
            start = anchor.start;
            end = anchor.end;
        } else {
            const needle = normalizeQuote(quote);
            const startNorm = normalized.indexOf(needle);
            const endNorm = startNorm + needle.length - 1;
            if (startNorm !== -1 && endNorm >= startNorm) {
                start = map[startNorm];
                end = map[endNorm] + 1;
            }
        }
        if (start == null || end == null) return [];
        const rects = [];
        nodes.forEach((entry) => {
            const from = Math.max(start, entry.start);
            const to = Math.min(end, entry.end);
            if (from >= to) return;
            const slice = document.createRange();
            slice.setStart(entry.node, from - entry.start);
            slice.setEnd(entry.node, to - entry.start);
            rects.push(...Array.from(slice.getClientRects()));
        });
        const filtered = rects
            .map((rect) => ({
                left: rect.left,
                top: rect.top,
                width: rect.width,
                height: rect.height,
                right: rect.right,
                bottom: rect.bottom,
            }))
            .filter((rect) => rect.width >= 6 && rect.height >= 8);
        filtered.sort((a, b) => (Math.abs(a.top - b.top) < 3 ? a.left - b.left : a.top - b.top));
        const merged = [];
        filtered.forEach((rect) => {
            const prev = merged[merged.length - 1];
            const sameLine = prev && Math.abs(prev.top - rect.top) < 3 && Math.abs(prev.height - rect.height) < 4;
            const touching = sameLine && rect.left <= prev.right + 10;
            if (touching) {
                prev.right = Math.max(prev.right, rect.right);
                prev.bottom = Math.max(prev.bottom, rect.bottom);
                prev.width = prev.right - prev.left;
                prev.height = prev.bottom - prev.top;
                return;
            }
            merged.push({ ...rect });
        });
        return merged;
    };
    const renderQuoteGlow = (quote, anchor = null, options = {}) => {
        const rects = highlightRects(quote, anchor);
        if (!rects.length) return [];
        return rects.map((rect) => {
            const glow = document.createElement('div');
            glow.className = 'fixed pointer-events-none z-[1600] rounded';
            glow.style.top = `${rect.top - 2}px`;
            glow.style.left = `${rect.left - 10}px`;
            glow.style.width = `${Math.max(18, rect.width + 20)}px`;
            glow.style.height = `${rect.height + 4}px`;
            glow.style.background = 'rgb(var(--vyasa-comment-glow-rgb) / 0.34)';
            glow.style.boxShadow = '0 0 28px rgb(var(--vyasa-comment-glow-rgb) / 0.24)';
            glow.style.opacity = '1';
            glow.style.transform = 'scale(0.98)';
            glow.style.filter = 'blur(6px)';
            glow.style.borderRadius = '14px';
            glow.style.transition = 'opacity 1100ms ease, transform 1100ms ease, filter 1100ms ease';
            document.body.appendChild(glow);
            if (options.persistent) return glow;
            setTimeout(() => {
                glow.style.opacity = '0';
                glow.style.transform = 'scale(1.06)';
                glow.style.filter = 'blur(12px)';
            }, 180);
            setTimeout(() => glow.remove(), 1400);
            return glow;
        });
    };
    const flashQuote = (quote, anchor = null) => renderQuoteGlow(quote, anchor);
    const formatCommentField = (label, value, depth = 1) => {
        const indent = '  '.repeat(depth);
        const lines = String(value || '').replace(/\r\n?/g, '\n').trim().split('\n');
        return `${indent}${label}: ${lines.shift() || ''}${lines.map((line) => `\n${indent}  ${line}`).join('')}`;
    };
    const formatCommentThread = (item, number) => {
        const lines = [`@ thread ${number}`, formatCommentField('text', item.quote)];
        const append = (node, depth) => {
            lines.push(formatCommentField(node.author || 'anonymous', node.comment, depth));
            (node.replies || []).forEach((reply) => append(reply, depth + 1));
        };
        append(item, 1);
        return lines.join('\n');
    };
    const formatComments = (items) => `!vyasa-comments 1\n${items.length ? `\n${items.map((item, index) => formatCommentThread(item, index + 1)).join('\n\n')}\n` : ''}`;
    const copyAnnotationText = async (text) => {
        if (navigator.clipboard?.writeText) {
            try { await navigator.clipboard.writeText(text); return true; } catch (_) {}
        }
        const input = document.createElement('textarea');
        input.value = text;
        input.setAttribute('readonly', 'readonly');
        input.style.cssText = 'position:fixed;opacity:0';
        document.body.appendChild(input);
        input.select();
        const copied = document.execCommand('copy');
        input.remove();
        return copied;
    };
    const countComments = (items) => items.reduce(
        (count, item) => count + 1 + countComments(item.replies || []), 0,
    );
    const showCommentCopyStatus = (count) => {
        let status = document.getElementById('vyasa-comment-copy-status');
        if (!status) {
            status = document.createElement('div');
            status.id = 'vyasa-comment-copy-status';
            status.className = 'vyasa-comment-copy-status';
            status.setAttribute('role', 'status');
            status.setAttribute('aria-live', 'polite');
            document.body.appendChild(status);
        }
        status.textContent = `${count} comment${count === 1 ? '' : 's'} copied`;
        status.classList.add('is-visible');
        clearTimeout(showCommentCopyStatus.timer);
        showCommentCopyStatus.timer = setTimeout(() => status.classList.remove('is-visible'), 1800);
    };
    const makeCommentCopyButton = (items, label) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'vyasa-comment-copy';
        button.innerHTML = '<uk-icon icon="copy" aria-hidden="true"></uk-icon>';
        button.setAttribute('aria-label', label);
        button.setAttribute('title', label);
        button.addEventListener('click', async (event) => {
            event.stopPropagation();
            const selected = items();
            if (await copyAnnotationText(formatComments(selected))) showCommentCopyStatus(countComments(selected));
        });
        return button;
    };
    const persistPopupState = (state) => {
        const entry = { path, id: state.item.id, pinned: true };
        persistedPopups = persistedPopups.filter((saved) => saved.path !== path || saved.id !== state.item.id);
        if (state.pinned) persistedPopups.push(entry);
        try { localStorage.setItem(popupStateKey, JSON.stringify(persistedPopups)); } catch (_) {}
    };
    const forgetPopupState = (annotationId) => {
        persistedPopups = persistedPopups.filter((saved) => saved.path !== path || saved.id !== annotationId);
        try { localStorage.setItem(popupStateKey, JSON.stringify(persistedPopups)); } catch (_) {}
    };
    const destroyCommentPopup = (annotationId) => {
        const state = commentPopups.get(annotationId);
        if (state) {
            clearTimeout(state.hideTimer); clearTimeout(state.glowTimer);
            if (hoveredPopup === state) { hoveredPopup = null; clearActiveGlows(); }
            state.element.remove();
            commentPopups.delete(annotationId);
        }
        forgetPopupState(annotationId);
    };
    const refreshPopupGlow = () => {
        clearActiveGlows();
        if (hoveredPopup) activeGlows = renderQuoteGlow(hoveredPopup.item.quote || '', hoveredPopup.item.anchor || null, { persistent: true });
    };
    window.addEventListener('scroll', refreshPopupGlow, { passive: true, signal: lifecycle.signal });
    window.addEventListener('resize', refreshPopupGlow, { signal: lifecycle.signal });
    const cancelPopupGlowTimers = () => commentPopups.forEach((state) => clearTimeout(state.glowTimer));
    const hideCommentPopup = (state) => {
        clearTimeout(state.hideTimer);
        state.hovered = false;
        if (hoveredPopup === state) { hoveredPopup = null; clearActiveGlows(); }
        state.element.hidden = true;
        state.element.classList.remove('is-hiding');
        state.anchor?.setAttribute('aria-expanded', 'false');
    };
    const schedulePopupHide = (state) => {
        clearTimeout(state.hideTimer);
        if (state.pinned || state.drag || state.hovered || state.anchorHovered) return;
        state.hideTimer = setTimeout(() => {
            state.element.classList.add('is-hiding');
            state.hideTimer = setTimeout(() => hideCommentPopup(state), 180);
        }, 5000);
    };
    const storePopupPosition = (state) => {
        const rect = state.element.getBoundingClientRect();
        state.position = { left: rect.left, top: rect.top };
    };
    const syncPopupPin = (state) => {
        const action = state.pinned ? 'Unpin' : 'Pin';
        state.pin.innerHTML = `<uk-icon icon="${state.pinned ? 'pin-off' : 'pin'}" aria-hidden="true"></uk-icon>`;
        state.pin.setAttribute('aria-label', action);
        state.pin.setAttribute('title', action);
        state.pin.setAttribute('aria-pressed', String(state.pinned));
    };
    const setPopupPinned = (state, next) => {
        const rect = state.element.getBoundingClientRect();
        state.pinned = next;
        state.element.classList.toggle('is-pinned', next);
        state.element.style.left = `${rect.left + (next ? window.scrollX : 0)}px`;
        state.element.style.top = `${rect.top + (next ? window.scrollY : 0)}px`;
        storePopupPosition(state);
        persistPopupState(state);
        syncPopupPin(state);
        if (!next) schedulePopupHide(state);
    };
    const createCommentPopup = (anchor, note, item) => {
        const saved = persistedPopups.find((entry) => entry.path === path && entry.id === item.id) || {};
        const state = { anchor, note, item, pinned: saved.pinned === true, position: null, hovered: false, anchorHovered: false, hideTimer: null, glowTimer: null, drag: null };
        const popup = document.createElement('aside');
        popup.dataset.vyasaCommentPopup = item.id;
        popup.className = 'vyasa-comment-popup';
        popup.hidden = true;
        popup.setAttribute('role', 'dialog');
        popup.setAttribute('aria-label', 'Comment preview');
        popup.innerHTML = '<div class="vyasa-comment-popup-bar"><button type="button" data-popup-pin></button><button type="button" data-popup-close aria-label="Close comment preview">×</button></div><div data-popup-body></div>';
        state.element = popup;
        state.pin = popup.querySelector('[data-popup-pin]');
        const bar = popup.querySelector('.vyasa-comment-popup-bar');
        state.pin.addEventListener('click', () => setPopupPinned(state, !state.pinned));
        bar.addEventListener('pointerdown', (event) => {
            if (event.target.closest('button')) return;
            popup.style.zIndex = String(++popupZ);
            const rect = popup.getBoundingClientRect();
            state.drag = { x: event.clientX, y: event.clientY, left: rect.left + (state.pinned ? window.scrollX : 0), top: rect.top + (state.pinned ? window.scrollY : 0) };
            bar.setPointerCapture(event.pointerId);
        });
        bar.addEventListener('pointermove', (event) => {
            if (!state.drag) return;
            popup.style.left = `${state.drag.left + event.clientX - state.drag.x}px`;
            popup.style.top = `${state.drag.top + event.clientY - state.drag.y}px`;
        });
        const finishDrag = () => { state.drag = null; storePopupPosition(state); };
        bar.addEventListener('pointerup', finishDrag);
        bar.addEventListener('pointercancel', finishDrag);
        popup.querySelector('[data-popup-close]').addEventListener('click', () => hideCommentPopup(state));
        popup.addEventListener('mouseenter', () => {
            state.hovered = true; hoveredPopup = state; popup.style.zIndex = String(++popupZ); clearTimeout(state.hideTimer); cancelPopupGlowTimers();
            popup.classList.remove('is-hiding'); refreshPopupGlow();
        });
        popup.addEventListener('mouseleave', () => { state.hovered = false; if (hoveredPopup === state) hoveredPopup = null; clearActiveGlows(); schedulePopupHide(state); });
        document.body.appendChild(popup);
        popup.classList.toggle('is-pinned', state.pinned);
        syncPopupPin(state);
        commentPopups.set(item.id, state);
        return state;
    };
    const showCommentPopup = (anchor, note, item) => {
        const state = commentPopups.get(item.id) || createCommentPopup(anchor, note, item);
        state.anchor = anchor; state.note = note; state.item = item;
        if (state.pinned && !state.element.hidden) return state;
        state.element.querySelector('[data-popup-body]').replaceChildren(makeNote(item).note);
        clearTimeout(state.hideTimer);
        anchor.setAttribute('aria-expanded', 'true');
        state.element.hidden = false;
        state.element.style.zIndex = String(++popupZ);
        state.element.classList.remove('is-hiding');
        const rect = anchor.getBoundingClientRect(), offsetX = state.pinned ? window.scrollX : 0, offsetY = state.pinned ? window.scrollY : 0;
        const viewport = state.position || { left: rect.left, top: rect.bottom + 8 };
        const bounds = state.pinned ? document.documentElement : { scrollWidth: window.innerWidth, scrollHeight: window.innerHeight };
        state.element.style.left = `${Math.min(bounds.scrollWidth - state.element.offsetWidth - 12, Math.max(12, viewport.left + offsetX))}px`;
        state.element.style.top = `${Math.min(bounds.scrollHeight - state.element.offsetHeight - 12, Math.max(12, viewport.top + offsetY))}px`;
        return state;
    };
    const ensureComments = () => {
        if (commentsSection) return commentsList;
        commentsSection = document.createElement('section');
        commentsSection.id = 'vyasa-comments';
        commentsSection.className = 'vyasa-comments';
        commentsSection.hidden = true;
        commentsSection.setAttribute('aria-label', 'Comments');
        commentsSection.innerHTML = '<div class="vyasa-comments-header"><h2>Comments</h2></div><ol class="vyasa-comments-list"></ol>';
        commentsSection.querySelector('.vyasa-comments-header').appendChild(
            makeCommentCopyButton(() => annotationRoots, 'Copy all comments'),
        );
        commentsList = commentsSection.querySelector('.vyasa-comments-list');
        main.appendChild(commentsSection);
        return commentsList;
    };
    const scrollToQuote = (item) => {
        const range = anchorToRange(item.anchor) || findQuoteRange(item.quote);
        const target = range?.startContainer?.parentElement;
        if (!target) return;
        target.scrollIntoView({ block: 'center' });
        requestAnimationFrame(() => flashQuote(item.quote || '', item.anchor || null));
    };
    const persistAnnotation = (item, comment) => fetch(`/api/annotations/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            id: item.id,
            parent_id: item.parent_id || '',
            quote: item.quote || '',
            prefix: '',
            suffix: '',
            anchor: item.anchor || {},
            comment,
        }),
    }).then((r) => r.ok ? r.json() : Promise.reject());
    const removeAnnotation = (annotationId) => fetch(`/api/annotations/${path}/${annotationId}`, {
        method: 'DELETE',
    }).then((r) => r.ok ? r.json() : Promise.reject());
    const makeNote = (item) => {
        const note = document.createElement('li');
        note.dataset.annotationId = item.id;
        note.className = `vyasa-comment ${item.parent_id ? 'vyasa-comment-reply' : ''}`.trim();
        const row = document.createElement('div');
        row.className = 'vyasa-comment-row';
        const authorLine = document.createElement('div');
        authorLine.className = 'vyasa-comment-author';
        const authorName = document.createElement('span');
        authorName.dataset.annotationAuthor = item.id;
        authorName.textContent = item.author || 'anonymous';
        authorLine.appendChild(authorName);
        if (!item.parent_id) authorLine.appendChild(
            makeCommentCopyButton(() => [item], 'Copy comment thread'),
        );
        const body = document.createElement('div');
        body.className = 'vyasa-comment-body';
        body.dataset.annotationBody = item.id;
        body.textContent = item.comment;
        row.appendChild(authorLine);
        row.appendChild(body);
        note.appendChild(row);
        const replies = document.createElement('ol');
        replies.className = 'vyasa-comment-replies';
        replies.dataset.annotationReplies = item.id;
        note.appendChild(replies);
        const openEditor = () => {
            const current = body.textContent;
            const next = window.prompt('Edit annotation', current);
            if (next == null) return;
            const comment = next.trim();
            if (!comment) return;
            persistAnnotation(item, comment).then((saved) => {
                item.comment = comment;
                item.author = saved.author || item.author;
                document.querySelectorAll('[data-annotation-author]').forEach((node) => { if (node.dataset.annotationAuthor === item.id) node.textContent = item.author || 'anonymous'; });
                document.querySelectorAll('[data-annotation-body]').forEach((node) => { if (node.dataset.annotationBody === item.id) node.textContent = comment; });
            }).catch(() => {});
        };
        const canManage = (item.author || 'anonymous') === currentAuthor;
        const replyBtn = document.createElement('button');
        replyBtn.type = 'button';
        replyBtn.className = 'ml-2 inline-flex h-5 items-center justify-center rounded px-1.5 text-xs font-semibold text-slate-400 opacity-0 transition-opacity hover:text-slate-700';
        replyBtn.textContent = 'Reply';
        replyBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            const next = window.prompt('Reply');
            const comment = next?.trim();
            if (!comment) return;
            const reply = { id: Date.now().toString(36), parent_id: item.id, quote: item.quote, anchor: item.anchor || {}, comment, author: currentAuthor, replies: [] };
            persistAnnotation(reply, comment).then((saved) => {
                reply.author = saved.author || reply.author;
                item.replies.push(reply);
                document.querySelectorAll('[data-annotation-replies]').forEach((node) => {
                    if (node.dataset.annotationReplies === item.id) node.appendChild(makeNote(reply).note);
                });
            }).catch(() => {});
        });
        row.appendChild(replyBtn);
        if (canManage) {
            const edit = document.createElement('button');
            edit.type = 'button';
            edit.className = 'ml-2 inline-flex h-5 w-5 items-center justify-center rounded text-xs font-semibold text-slate-400 opacity-0 transition-opacity hover:text-slate-700';
            edit.setAttribute('aria-label', 'Edit annotation');
            edit.textContent = '✎';
            edit.addEventListener('click', (event) => { event.stopPropagation(); openEditor(); });
            row.appendChild(edit);
            const del = document.createElement('button');
            del.type = 'button';
            del.className = 'ml-2 inline-flex h-5 w-5 items-center justify-center rounded text-sm font-semibold text-red-500 opacity-0 transition-opacity hover:text-red-600';
            del.setAttribute('aria-label', 'Delete annotation');
            del.textContent = '×';
            del.addEventListener('click', (event) => {
                event.stopPropagation();
                removeAnnotation(item.id)
                    .then((payload) => {
                        if (!payload.ok) return;
                        removeAnnotationFromTree(annotationRoots, item.id);
                        document.querySelectorAll('[data-annotation-id]').forEach((node) => { if (node.dataset.annotationId === item.id) node.remove(); });
                        sourceAnchors.get(item.id)?.remove();
                        sourceAnchors.delete(item.id);
                        destroyCommentPopup(item.id);
                        if (commentsList && !commentsList.children.length) commentsSection.hidden = true;
                    })
                    .catch(() => {});
            });
            row.appendChild(del);
            note.addEventListener('mouseenter', () => { edit.style.opacity = '1'; del.style.opacity = '1'; replyBtn.style.opacity = '1'; });
            note.addEventListener('mouseleave', () => { edit.style.opacity = '0'; del.style.opacity = '0'; replyBtn.style.opacity = '0'; });
        } else {
            note.addEventListener('mouseenter', () => { replyBtn.style.opacity = '1'; });
            note.addEventListener('mouseleave', () => { replyBtn.style.opacity = '0'; });
        }
        row.addEventListener('click', () => scrollToQuote(item));
        (item.replies || []).forEach((reply) => replies.appendChild(makeNote(reply).note));
        return { note };
    };
    const insertionRangeForNode = (node, offset) => {
        const heading = node.parentElement?.closest?.('h1, h2, h3, h4, h5, h6');
        const range = document.createRange();
        if (heading) {
            range.selectNodeContents(heading);
            range.collapse(false);
            return range;
        }
        range.setStart(node, offset);
        range.collapse(true);
        return range;
    };
    const normalizeAnnotation = (item) => {
        const anchor = item.anchor && typeof item.anchor === 'string' ? JSON.parse(item.anchor) : item.anchor;
        return { ...item, anchor, parent_id: item.parent_id || '', replies: [] };
    };
    const buildAnnotationTree = (items) => {
        const byId = new Map();
        const roots = [];
        items.map(normalizeAnnotation).forEach((item) => byId.set(item.id, item));
        byId.forEach((item) => {
            const parent = item.parent_id ? byId.get(item.parent_id) : null;
            if (parent) parent.replies.push(item);
            else roots.push(item);
        });
        const sortReplies = (nodes) => nodes.sort((a, b) => `${a.created_at}:${a.id}`.localeCompare(`${b.created_at}:${b.id}`)).forEach((node) => sortReplies(node.replies));
        sortReplies(roots);
        return roots;
    };
    const removeAnnotationFromTree = (nodes, annotationId) => {
        const index = nodes.findIndex((node) => node.id === annotationId);
        if (index >= 0) { nodes.splice(index, 1); return true; }
        return nodes.some((node) => removeAnnotationFromTree(node.replies || [], annotationId));
    };
    const addSourceAnchor = (item, note, number) => {
        const exact = anchorToRange(item.anchor) || findQuoteRange(item.quote);
        if (!exact) return false;
        const anchor = document.createElement('button');
        anchor.type = 'button';
        anchor.className = 'vyasa-comment-anchor';
        anchor.textContent = String(number);
        anchor.setAttribute('aria-label', `View comment ${number}`);
        anchor.setAttribute('aria-haspopup', 'dialog');
        anchor.setAttribute('aria-expanded', 'false');
        anchor.addEventListener('mouseenter', () => {
            const state = showCommentPopup(anchor, note, item);
            state.anchorHovered = true;
            clearTimeout(state.hideTimer);
            cancelPopupGlowTimers();
            clearActiveGlows();
            activeGlows = renderQuoteGlow(item.quote || '', item.anchor || null, { persistent: true });
            state.element.classList.add('vyasa-comment-popup-target');
            clearTimeout(state.glowTimer);
        });
        anchor.addEventListener('mouseleave', () => {
            const state = commentPopups.get(item.id);
            if (!state) return;
            state.anchorHovered = false;
            state.element.classList.remove('vyasa-comment-popup-target');
            state.glowTimer = setTimeout(clearActiveGlows, 140);
            schedulePopupHide(state);
        });
        anchor.addEventListener('focus', () => showCommentPopup(anchor, note, item));
        anchor.addEventListener('blur', () => { const state = commentPopups.get(item.id); if (state) schedulePopupHide(state); });
        anchor.addEventListener('click', () => {
            clearActiveGlows();
            note.scrollIntoView({ behavior: 'smooth', block: 'center' });
            note.classList.add('vyasa-comment-target');
            setTimeout(() => note.classList.remove('vyasa-comment-target'), 1200);
        });
        insertionRangeForNode(exact.endContainer, exact.endOffset).insertNode(anchor);
        sourceAnchors.set(item.id, anchor);
        return true;
    };
    const injectAnnotation = (item, number) => {
        const { note } = makeNote(item);
        note.id = `ann-${item.id}`;
        if (item.quote) {
            const quote = document.createElement('blockquote');
            quote.className = 'vyasa-comment-quote';
            quote.textContent = item.quote;
            note.prepend(quote);
        }
        const backlink = document.createElement('button');
        backlink.type = 'button';
        backlink.className = 'vyasa-comment-backlink';
        backlink.textContent = `↑${number}`;
        backlink.setAttribute('aria-label', `Return to commented text ${number}`);
        backlink.addEventListener('click', (event) => {
            event.stopPropagation();
            scrollToQuote(item);
        });
        note.querySelector('.vyasa-comment-author')?.prepend(backlink);
        ensureComments().appendChild(note);
        commentsSection.hidden = false;
        addSourceAnchor(item, note, number);
        return true;
    };
    fetch(`/api/annotations/${path}`).then((r) => r.ok ? r.json() : []).then((items) => {
        if (!Array.isArray(items)) return;
        annotationRoots = buildAnnotationTree(items);
        annotationRoots.forEach((item, index) => injectAnnotation(item, index + 1));
        persistedPopups.filter((entry) => entry.path === path && entry.pinned).forEach((entry) => {
            const item = annotationRoots.find((candidate) => candidate.id === entry.id);
            const anchor = item && sourceAnchors.get(item.id);
            const note = item && document.getElementById(`ann-${item.id}`);
            if (item && anchor && note) showCommentPopup(anchor, note, item);
            else forgetPopupState(entry.id);
        });
    }).catch(() => {});
    const clearUi = () => {
        document.getElementById('vyasa-annotation-trigger')?.remove();
        document.getElementById('vyasa-annotation-composer')?.remove();
    };
    main.addEventListener('mouseup', () => {
        const sel = window.getSelection();
        clearUi();
        if (!sel || sel.isCollapsed || !main.contains(sel.anchorNode) || !main.contains(sel.focusNode)) return;
        const text = sel.toString().trim();
        if (!text) return;
        const rect = sel.getRangeAt(0).getBoundingClientRect();
        pending = { quote: text, range: sel.getRangeAt(0).cloneRange(), rect, anchor: rangeToAnchor(sel.getRangeAt(0)) };
        const trigger = document.createElement('button');
        trigger.id = 'vyasa-annotation-trigger';
        trigger.type = 'button';
        trigger.className = 'fixed z-[1400] flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white/96 text-slate-700 shadow-lg backdrop-blur dark:border-slate-700 dark:bg-slate-950/96 dark:text-slate-200';
        trigger.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" class="h-4 w-4"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4Z" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"/></svg>';
        trigger.style.top = `${Math.max(12, pending.rect.top - 6)}px`;
        trigger.style.left = `${Math.min(window.innerWidth - 56, pending.rect.right + 10)}px`;
        document.body.appendChild(trigger);
        trigger.addEventListener('click', () => {
            if (!pending) return;
            document.getElementById('vyasa-annotation-composer')?.remove();
            const box = document.createElement('div');
            box.id = 'vyasa-annotation-composer';
            box.className = 'fixed z-[1400] w-[20rem] rounded-xl border border-slate-200 bg-[var(--vyasa-paper,#fff)] p-3 shadow-2xl dark:border-slate-700';
            box.style.top = `${Math.min(window.innerHeight - 160, Math.max(12, pending.rect.top + 28))}px`;
            box.style.left = `${Math.min(window.innerWidth - 340, pending.rect.right + 10)}px`;
            box.innerHTML = `<textarea class="h-24 w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm text-[var(--vyasa-ink,#2d3434)] dark:border-slate-700" placeholder="Write a comment"></textarea><div class="mt-2 flex justify-end gap-2"><button type="button" data-ann-cancel class="rounded-md px-3 py-1.5 text-sm text-slate-500">Cancel</button><button type="button" data-ann-save class="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white dark:bg-slate-100 dark:text-slate-900">Save</button></div>`;
            document.body.appendChild(box);
            box.querySelector('[data-ann-cancel]').addEventListener('click', clearUi);
            box.querySelector('textarea').focus();
            box.querySelector('[data-ann-save]').addEventListener('click', () => {
                const body = box.querySelector('textarea').value.trim();
                if (!body || !pending?.range) return;
                const item = {
                    id: Date.now().toString(36),
                    quote: pending.quote,
                    anchor: pending.anchor,
                };
                persistAnnotation(item, body).then((saved) => {
                    const savedItem = { ...item, comment: body, author: saved.author || currentAuthor, replies: [] };
                    annotationRoots.push(savedItem);
                    injectAnnotation(
                        savedItem,
                        ensureComments().children.length + 1,
                    );
                    window.getSelection()?.removeAllRanges();
                    pending = null;
                    clearUi();
                }).catch(() => {});
            });
        });
    });
    document.addEventListener('mousedown', (event) => {
        if (!event.target.closest?.('#vyasa-annotation-trigger, #vyasa-annotation-composer')) clearUi();
    }, { signal: lifecycle.signal });
}


document.addEventListener('DOMContentLoaded', () => {
    initAnnotations(document);
});

document.body.addEventListener('htmx:afterSwap', (event) => {
    initAnnotations(event.target || document);
});
