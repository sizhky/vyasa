function initAnnotations(root = document) {
    const main = root.getElementById?.('main-content') || document.getElementById('main-content');
    if (!main || main.dataset.annotationsEnabled !== '1' || main.dataset.annotationsBound === '1') return;
    main.dataset.annotationsBound = '1';
    const path = main.dataset.annotationPath || '__index__';
    const currentAuthor = main.dataset.annotationAuthor || 'anonymous';
    let pending = null;
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
            || parent.closest('.sidenote, .sidenote-ref, #vyasa-annotation-composer, #vyasa-annotation-trigger');
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
            glow.style.background = 'rgba(245, 158, 11, 0.34)';
            glow.style.boxShadow = '0 0 28px rgba(245, 158, 11, 0.24)';
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
        const note = document.createElement('div');
        note.id = `ann-${item.id}`;
        note.className = `sidenote ${item.parent_id ? 'annotation-reply' : ''} cursor-pointer select-none text-sm leading-relaxed border-l-2 border-amber-400 dark:border-blue-400 pl-3 text-neutral-500 dark:text-neutral-400 transition-all duration-500 w-full my-2 xl:my-0`.trim();
        const row = document.createElement('div');
        row.className = 'block';
        const authorLine = document.createElement('div');
        authorLine.className = 'font-semibold';
        authorLine.textContent = item.author || 'anonymous';
        const body = document.createElement('div');
        body.className = 'mt-1';
        body.textContent = item.comment;
        row.appendChild(authorLine);
        row.appendChild(body);
        note.appendChild(row);
        const replies = document.createElement('div');
        replies.className = 'mt-2 space-y-2';
        note.appendChild(replies);
        const openEditor = () => {
            const current = body.textContent;
            const next = window.prompt('Edit annotation', current);
            if (next == null) return;
            const comment = next.trim();
            if (!comment) return;
            persistAnnotation(item, comment).then((saved) => {
                authorLine.textContent = saved.author || item.author || 'anonymous';
                body.textContent = comment;
                item.comment = comment;
                item.author = saved.author || item.author;
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
                const { note: replyNode } = makeNote(reply);
                replies.appendChild(replyNode);
                item.replies.push(reply);
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
                        note.remove();
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
        const activate = () => {
            flashQuote(item.quote || '', item.anchor || null);
            if (window.innerWidth >= 1280) {
                note.classList.add('hl');
                setTimeout(() => note.classList.remove('hl'), 1000);
            } else {
                note.classList.toggle('show');
            }
        };
        row.addEventListener('click', activate);
        let hoverBloomAt = 0;
        let hoverGlows = [];
        const clearHoverGlows = () => {
            hoverGlows.forEach((glow) => glow.remove());
            hoverGlows = [];
        };
        row.addEventListener('mouseenter', () => {
            const now = Date.now();
            if (now - hoverBloomAt < 900) return;
            hoverBloomAt = now;
            clearHoverGlows();
            hoverGlows = renderQuoteGlow(item.quote || '', item.anchor || null, { persistent: true });
        });
        row.addEventListener('mouseleave', clearHoverGlows);
        window.addEventListener('scroll', clearHoverGlows, { passive: true });
        window.addEventListener('resize', clearHoverGlows);
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
    const injectAnnotation = (item) => {
        const exact = anchorToRange(item.anchor);
        const host = exact?.startContainer?.parentElement?.closest?.('p, li, blockquote, h1, h2, h3, h4, h5, h6') || (() => {
            const needle = normalizeQuote(item.quote);
            if (!needle) return null;
            const candidates = Array.from(main.querySelectorAll('p, li, h1, h2, h3, h4, h5, h6, blockquote'));
            return candidates.find((el) => !el.closest('.sidenote') && normalizeQuote(el.textContent).includes(needle)) || null;
        })();
        if (!host) return false;
        const { note } = makeNote(item);
        host.insertAdjacentElement('afterbegin', note);
        return true;
    };
    fetch(`/api/annotations/${path}`).then((r) => r.ok ? r.json() : []).then((items) => {
        if (!Array.isArray(items)) return;
        buildAnnotationTree(items).forEach(injectAnnotation);
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
                const range = insertionRangeForNode(pending.range.endContainer, pending.range.endOffset);
                persistAnnotation(item, body).then((saved) => {
                    const { note } = makeNote({ ...item, comment: body, author: saved.author || currentAuthor });
                    range.insertNode(note);
                    window.getSelection()?.removeAllRanges();
                    pending = null;
                    clearUi();
                }).catch(() => {});
            });
        });
    });
    document.addEventListener('mousedown', (event) => {
        if (!event.target.closest?.('#vyasa-annotation-trigger, #vyasa-annotation-composer')) clearUi();
    });
}


document.addEventListener('DOMContentLoaded', () => {
    initAnnotations(document);
});

document.body.addEventListener('htmx:afterSwap', (event) => {
    initAnnotations(event.target || document);
});
