// Two-column document editing: the toggle puts a preview and an editor exactly
// where the rendered article was. Preview and save both come back as HTML from
// the server, so the page never renders markdown itself.
export function headingLinesFromSource(text) {
  const lines = text.split('\n');
  const found = [];
  let fence = '';
  let inFrontmatter = lines[0] === '---';
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (inFrontmatter) {
      if (i > 0 && (line === '---' || line === '...')) inFrontmatter = false;
      continue;
    }
    const fenceMatch = line.match(/^\s{0,3}(```+|~~~+)/);
    if (fenceMatch) {
      if (!fence) fence = fenceMatch[1][0];
      else if (fenceMatch[1][0] === fence) fence = '';
      continue;
    }
    if (fence) continue;
    if (/^ {0,3}#{1,6}\s/.test(line)) found.push(i);
  }
  return found;
}
export function mappedOffset(position, from, to, fromMax, toMax) {
  if (from.length < 2 || to.length < 2) {
    return fromMax > 0 ? (position / fromMax) * toMax : 0;
  }
  let index = -1;
  for (let i = 0; i < from.length; i += 1) {
    if (from[i] <= position) index = i;
    else break;
  }
  // Above the first heading, and below the last, the segment runs to the edge
  // of the document rather than to another anchor.
  const lowFrom = index < 0 ? 0 : from[index];
  const lowTo = index < 0 ? 0 : to[index];
  const highFrom = index + 1 < from.length ? from[index + 1] : fromMax;
  const highTo = index + 1 < to.length ? to[index + 1] : toMax;
  const span = highFrom - lowFrom;
  const fraction = span > 0 ? (position - lowFrom) / span : 0;
  return lowTo + fraction * (highTo - lowTo);
}
(function () {
  const SOURCE_URL = (slug) => `/api/documents/source/${slug}`;
  const PREVIEW_URL = (slug) => `/api/documents/preview/${slug}`;
  const PREVIEW_DELAY = 400;
  // How long the follower ignores its own scroll events after we move it. Without
  // this the two panes chase each other in a loop and neither settles.
  const LOCK_MS = 160;

  const state = { open: false, slug: '', revision: '', timer: 0, dirty: false };
  // Paired scroll offsets, one entry per heading. Empty means fall back to
  // percentage, which is also what happens when the two counts disagree.
  const sync = { source: [], preview: [], mirror: null, leader: null, lockUntil: 0 };

  const button = () => document.querySelector('[data-vyasa-edit-document]');
  const bodyHost = () => document.querySelector('[data-vyasa-document-body]');
  const shell = () => document.querySelector('[data-vyasa-document-editor]');
  const sourcePane = () => document.querySelector('.vyasa-document-editor-input');
  const previewPane = () => document.querySelector('[data-vyasa-editor-preview]');

  function setStatus(text, kind) {
    const node = document.querySelector('[data-vyasa-editor-status]');
    if (!node) return;
    node.textContent = text || '';
    node.dataset.kind = kind || 'idle';
  }

  // --- scroll sync -------------------------------------------------------
  // Headings are the anchors: the renderer already puts an id on every heading,
  // and the source side can be scanned for `#` lines, so both sides produce an
  // ordered list without the renderer telling us anything. Between two anchors
  // we interpolate by percentage, which is also the whole strategy when there
  // are no usable anchors at all.


  function mirrorFor(input) {
    if (!sync.mirror) {
      sync.mirror = document.createElement('div');
      sync.mirror.setAttribute('aria-hidden', 'true');
      sync.mirror.className = 'vyasa-document-editor-mirror';
      input.parentNode.appendChild(sync.mirror);
    }
    // A textarea gives no per-line geometry, and pre-wrap means one logical line
    // can occupy several visual ones. Copy the metrics that decide wrapping and
    // measure the same text in a div instead.
    const style = window.getComputedStyle(input);
    const mirror = sync.mirror;
    ['fontFamily', 'fontSize', 'lineHeight', 'letterSpacing', 'padding', 'tabSize'].forEach((name) => {
      mirror.style[name] = style[name];
    });
    mirror.style.width = `${input.clientWidth}px`;
    return mirror;
  }

  function measureSourceOffsets(input, lines) {
    if (!lines.length) return [];
    const mirror = mirrorFor(input);
    const text = input.value.split('\n');
    const marks = new Set(lines);
    mirror.innerHTML = '';
    const fragment = document.createDocumentFragment();
    text.forEach((line, index) => {
      if (marks.has(index)) {
        const mark = document.createElement('span');
        mark.dataset.line = String(index);
        mark.textContent = line || ' ';
        fragment.appendChild(mark);
      } else {
        fragment.appendChild(document.createTextNode(line));
      }
      fragment.appendChild(document.createTextNode('\n'));
    });
    mirror.appendChild(fragment);
    const top = mirror.getBoundingClientRect().top;
    return Array.from(mirror.querySelectorAll('span[data-line]')).map(
      (node) => node.getBoundingClientRect().top - top
    );
  }

  function measurePreviewOffsets(box) {
    const top = box.getBoundingClientRect().top;
    return Array.from(box.querySelectorAll('h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]')).map(
      (node) => node.getBoundingClientRect().top - top + box.scrollTop
    );
  }

  function refreshAnchors() {
    const input = sourcePane();
    const box = previewPane();
    sync.source = [];
    sync.preview = [];
    if (!input || !box) return;
    const lines = headingLinesFromSource(input.value);
    const preview = measurePreviewOffsets(box);
    // Unequal counts mean the pairing is a guess: a heading inside a callout or
    // a tab never becomes an `h2` with an id. Percentage is honest, so use it.
    if (!lines.length || lines.length !== preview.length) return;
    const source = measureSourceOffsets(input, lines);
    if (source.length !== preview.length) return;
    sync.source = source;
    sync.preview = preview;
  }

  const maxScroll = (el) => Math.max(0, el.scrollHeight - el.clientHeight);


  function syncScroll(leader) {
    // Only the echo is dropped. The pane under your fingers keeps leading, so a
    // slow drag stays smooth instead of updating once per lock window.
    if (sync.leader && sync.leader !== leader && performance.now() < sync.lockUntil) return;
    const input = sourcePane();
    const box = previewPane();
    if (!input || !box) return;
    sync.leader = leader;
    const fromSource = leader === input;
    const follower = fromSource ? box : input;
    const target = mappedOffset(
      leader.scrollTop,
      fromSource ? sync.source : sync.preview,
      fromSource ? sync.preview : sync.source,
      maxScroll(leader),
      maxScroll(follower)
    );
    sync.lockUntil = performance.now() + LOCK_MS;
    follower.scrollTop = Math.max(0, Math.min(maxScroll(follower), Math.round(target)));
  }

  function watchScroll(el) {
    let queued = false;
    el.addEventListener(
      'scroll',
      () => {
        if (queued) return;
        queued = true;
        window.requestAnimationFrame(() => {
          queued = false;
          syncScroll(el);
        });
      },
      { passive: true }
    );
  }

  function buildShell(source) {
    const host = bodyHost();
    if (!host) return null;
    host.hidden = true;
    const wrap = document.createElement('div');
    wrap.className = 'w-full vyasa-document-editor';
    wrap.setAttribute('data-vyasa-document-editor', 'true');
    wrap.innerHTML =
      '<div class="vyasa-document-editor-bar">' +
      '<span data-vyasa-editor-status data-kind="idle"></span>' +
      '<span class="vyasa-document-editor-hint">Cmd/Ctrl+S saves. Esc closes.</span>' +
      '</div>' +
      // Preview first in the markup as well as on screen, so tab order follows
      // what the eye sees.
      '<div class="vyasa-document-editor-panes">' +
      '<div class="vyasa-document-editor-preview" data-vyasa-editor-preview' +
      ' aria-live="polite" aria-label="Preview of this document"></div>' +
      '<textarea class="vyasa-document-editor-input" spellcheck="true"' +
      ' aria-label="Markdown source of this document"></textarea>' +
      '</div>';
    const input = wrap.querySelector('textarea');
    input.value = source;
    host.parentNode.insertBefore(wrap, host);
    input.focus();
    input.setSelectionRange(0, 0);
    input.addEventListener('input', onInput);
    input.addEventListener('keydown', onKeyDown);
    watchScroll(input);
    const box = wrap.querySelector('[data-vyasa-editor-preview]');
    if (box) watchScroll(box);
    return wrap;
  }

  function onInput(event) {
    state.dirty = true;
    setStatus('Unsaved changes', 'dirty');
    window.clearTimeout(state.timer);
    state.timer = window.setTimeout(() => renderPreview(event.target.value), PREVIEW_DELAY);
  }

  function onKeyDown(event) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      save();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    }
  }

  // Injected HTML is inert on its own: a `<script>` set through innerHTML never
  // runs, and the diagram runtimes only scan the DOM when told to. So fetch any
  // bundle this render newly needs, then raise the same event the rest of Vyasa
  // uses to announce fresh content -- mermaid, d2, tasks, mdx and the others all
  // listen for it on `document.body` and read `event.target` as their scope.
  function loadAsset(url, kind) {
    const selector = kind === 'css' ? `link[href="${url}"]` : `script[src="${url}"]`;
    if (document.head.querySelector(selector) || document.querySelector(selector)) return Promise.resolve();
    return new Promise((resolve) => {
      const node = document.createElement(kind === 'css' ? 'link' : 'script');
      if (kind === 'css') {
        node.rel = 'stylesheet';
        node.href = url;
      } else {
        node.type = 'module';
        node.src = url;
      }
      node.dataset.vyasaBundleAsset = 'true';
      node.dataset.vyasaBundleKind = kind;
      node.addEventListener('load', () => resolve());
      // A missing bundle must not stall the preview, so a failure resolves too.
      node.addEventListener('error', () => resolve());
      document.head.appendChild(node);
    });
  }

  async function applyRender(target, payload) {
    target.innerHTML = payload.html || '';
    await Promise.all([
      ...(payload.css || []).map((url) => loadAsset(url, 'css')),
      ...(payload.js || []).map((url) => loadAsset(url, 'js')),
    ]);
    // Dispatched from the target, not from body: it bubbles up to the listeners
    // on `document.body` carrying the new subtree as `event.target`, so nothing
    // rescans the whole page or re-runs the hidden reading view.
    target.dispatchEvent(new CustomEvent('htmx:afterSwap', { bubbles: true, detail: {} }));
  }

  async function renderPreview(text) {
    const box = document.querySelector('[data-vyasa-editor-preview]');
    if (!box) return;
    try {
      const response = await fetch(PREVIEW_URL(state.slug), { method: 'POST', body: text });
      if (!response.ok) return;
      const payload = await response.json();
      await applyRender(box, payload);
      refreshAnchors();
    } catch (error) {
      /* preview is a comfort, never a blocker */
    }
  }

  async function save() {
    const input = document.querySelector('.vyasa-document-editor-input');
    if (!input) return;
    setStatus('Saving...', 'busy');
    const url = `${SOURCE_URL(state.slug)}?revision=${encodeURIComponent(state.revision)}`;
    let response;
    try {
      response = await fetch(url, { method: 'POST', body: input.value });
    } catch (error) {
      setStatus('Could not reach the server', 'error');
      return;
    }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatus(payload.error || `Save failed (${response.status})`, 'error');
      return;
    }
    state.revision = payload.revision || state.revision;
    state.dirty = false;
    const host = bodyHost();
    if (host && payload.html) await applyRender(host, payload);
    setStatus('Saved', 'ok');
  }

  async function open(slug) {
    let payload;
    try {
      const response = await fetch(SOURCE_URL(slug));
      if (!response.ok) return;
      payload = await response.json();
    } catch (error) {
      return;
    }
    if (!payload.editable) return;
    state.slug = slug;
    state.revision = payload.revision || '';
    state.dirty = false;
    if (!buildShell(payload.source || '')) return;
    state.open = true;
    markButton(true);
    // Fill the right column straight away, so it never opens blank.
    renderPreview(payload.source || '');
  }

  function close() {
    if (state.dirty && !window.confirm('Close the editor and lose unsaved changes?')) return;
    sync.source = [];
    sync.preview = [];
    sync.mirror = null;
    sync.leader = null;
    const wrap = shell();
    if (wrap) wrap.remove();
    const host = bodyHost();
    if (host) host.hidden = false;
    state.open = false;
    state.dirty = false;
    markButton(false);
  }

  function markButton(open) {
    const node = button();
    if (!node) return;
    node.setAttribute('aria-pressed', open ? 'true' : 'false');
    node.classList.toggle('vyasa-page-action-button-active', open);
    const label = node.querySelector('span');
    if (label) label.textContent = open ? 'Close editor' : 'Edit';
  }

  function toggle() {
    const node = button();
    if (!node) return;
    if (state.open) close();
    else open(node.dataset.vyasaEditDocument || '');
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-vyasa-edit-document]')) {
      event.preventDefault();
      toggle();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'e' || event.metaKey || event.ctrlKey || event.altKey) return;
    const active = document.activeElement;
    if (active && (active.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName))) return;
    if (!button()) return;
    event.preventDefault();
    toggle();
  });

  document.addEventListener('vyasa:page-change', () => {
    if (state.open) close();
  });

  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    if (!state.open) return;
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(refreshAnchors, 150);
  });

  window.addEventListener('beforeunload', (event) => {
    if (!state.dirty) return;
    event.preventDefault();
    event.returnValue = '';
  });
})();
