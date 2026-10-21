// Block editing in the reading column: the page becomes separately rendered
// blocks, and only the active block shows its markdown. Every render comes back
// as HTML from the server, so the page never renders markdown itself.
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
// Source line ranges of the reading view's sections: entry 0 is the text above
// the first heading, then one range per heading up to the next heading of any
// level. The reading view drops a leading `# Title` line, so the source may
// hold exactly one heading more than the page; any other gap means the pairing
// is a guess, and null tells the caller to stop using it.
export function sectionRanges(text, renderedCount) {
  const lines = text.split('\n');
  let heads = headingLinesFromSource(text);
  let bodyStart = 0;
  if (lines[0] === '---') {
    const close = lines.findIndex((line, i) => i > 0 && (line === '---' || line === '...'));
    bodyStart = close < 0 ? lines.length : close + 1;
  }
  if (heads.length === renderedCount + 1) {
    const first = lines.findIndex((line, i) => i >= bodyStart && line.trim() !== '');
    if (heads[0] !== first || !/^#\s/.test(lines[first])) return null;
    heads = heads.slice(1);
  } else if (heads.length !== renderedCount) {
    return null;
  }
  const edges = [bodyStart, ...heads, lines.length];
  return edges.slice(0, -1).map((start, i) => ({ start, end: edges[i + 1] }));
}
// After an edit the source is split again. Blocks whose key (kind and text) is
// unchanged at the start and at the end keep their rendered node; only the
// middle is rendered again.
export function reconcileBlocks(oldKeys, newKeys) {
  const limit = Math.min(oldKeys.length, newKeys.length);
  let prefix = 0;
  while (prefix < limit && oldKeys[prefix] === newKeys[prefix]) prefix += 1;
  let suffix = 0;
  while (
    suffix < limit - prefix &&
    oldKeys[oldKeys.length - 1 - suffix] === newKeys[newKeys.length - 1 - suffix]
  ) suffix += 1;
  return { prefix, suffix };
}
// Block editing splits the source into top-level blocks, each rendered on its
// own, so the block under the cursor can show source while the rest stays
// rendered. A block is a line range [start, end); blank lines between blocks
// belong to none. Fences, `///` callouts, `:::` containers and `$$` math run to
// their closer; a heading is one line; anything else runs to a blank line, and a
// list keeps going past a blank line while the next line is indented or an item.
const LIST_ITEM = /^\s{0,3}([-*+]|\d+[.)])\s/;
const CLOSERS = [
  [/^\s{0,3}(`{3,}|~{3,})/, (m) => new RegExp(`^\\s{0,3}${m[1][0]}{${m[1].length},}\\s*$`), 'fence'],
  [/^\/\/\/\s*[A-Za-z]/, () => /^\/\/\/\s*$/, 'callout'],
  [/^(:{3,})/, (m) => new RegExp(`^${m[1]}\\s*$`), 'container'],
  [/^\$\$/, () => /\$\$\s*$/, 'math'],
];
export function sourceBlocks(text) {
  const lines = text.split('\n');
  const blocks = [];
  const blank = (i) => i >= lines.length || lines[i].trim() === '';
  let i = 0;
  if (lines[0] === '---') {
    const close = lines.findIndex((line, k) => k > 0 && (line === '---' || line === '...'));
    if (close > 0) {
      blocks.push({ start: 0, end: close + 1, kind: 'frontmatter' });
      i = close + 1;
    }
  }
  while (i < lines.length) {
    if (blank(i)) { i += 1; continue; }
    const start = i;
    const opener = CLOSERS.map(([open, close, kind]) => [lines[i].match(open), close, kind]).find(([m]) => m);
    if (opener) {
      const [match, close, kind] = opener;
      const closer = close(match);
      // `$$ x $$` on one line closes itself.
      if (!(kind === 'math' && lines[i].trim().length > 2 && closer.test(lines[i]))) {
        i += 1;
        while (i < lines.length && !closer.test(lines[i])) i += 1;
      }
      blocks.push({ start, end: Math.min(i + 1, lines.length), kind });
      i += 1;
      continue;
    }
    if (/^ {0,3}#{1,6}\s/.test(lines[i])) {
      blocks.push({ start, end: i + 1, kind: 'heading' });
      i += 1;
      continue;
    }
    const isList = LIST_ITEM.test(lines[i]);
    while (true) {
      while (!blank(i)) i += 1;
      let next = i;
      while (next < lines.length && blank(next)) next += 1;
      if (!isList || next >= lines.length || !(/^(\s{2,}|\t)/.test(lines[next]) || LIST_ITEM.test(lines[next]))) break;
      i = next;
    }
    blocks.push({ start, end: i, kind: isList ? 'list' : 'text' });
  }
  return blocks;
}
(function () {
  const SOURCE_URL = (slug) => `/api/documents/source/${slug}`;
  const PREVIEW_URL = (slug) => `/api/documents/preview/${slug}`;

  const state = { slug: '', revision: '', dirty: false };

  const button = () => document.querySelector('[data-vyasa-edit-document]');
  const bodyHost = () => document.querySelector('[data-vyasa-document-body]');

  function setStatus(text, kind) {
    const node = document.querySelector('[data-vyasa-editor-status]');
    if (!node) return;
    node.textContent = text || '';
    node.dataset.kind = kind || 'idle';
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

  function loadBundles(payload) {
    return Promise.all([
      ...(payload.css || []).map((url) => loadAsset(url, 'css')),
      ...(payload.js || []).map((url) => loadAsset(url, 'js')),
    ]);
  }

  // Dispatched from the target, not from body: it bubbles up to the listeners
  // on `document.body` carrying the new subtree as `event.target`, so nothing
  // rescans the whole page or re-runs the hidden reading view.
  const announce = (target) => target.dispatchEvent(new CustomEvent('htmx:afterSwap', { bubbles: true, detail: {} }));

  async function applyRender(target, payload) {
    target.innerHTML = payload.html || '';
    await loadBundles(payload);
    announce(target);
  }

  // The one write path for both editors: the whole file goes up with the
  // revision it was read at, and the reading view is replaced by the render.
  async function writeSource(text, { renderHost = true } = {}) {
    setStatus('Saving...', 'busy');
    const url = `${SOURCE_URL(state.slug)}?revision=${encodeURIComponent(state.revision)}`;
    let response;
    try {
      response = await fetch(url, { method: 'POST', body: text });
    } catch (error) {
      setStatus('Could not reach the server', 'error');
      return false;
    }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatus(payload.error || `Save failed (${response.status})`, 'error');
      return false;
    }
    state.revision = payload.revision || state.revision;
    state.dirty = false;
    const host = bodyHost();
    if (renderHost && host && payload.html) await applyRender(host, payload);
    setStatus('Saved', 'ok');
    return true;
  }

  async function readSource(slug) {
    try {
      const response = await fetch(SOURCE_URL(slug));
      if (!response.ok) return null;
      const payload = await response.json();
      return payload.editable ? payload : null;
    } catch (error) {
      return null;
    }
  }

  function markButton(open) {
    const node = button();
    if (!node) return;
    node.setAttribute('aria-pressed', open ? 'true' : 'false');
    node.classList.toggle('vyasa-page-action-button-active', open);
    // The label stays "Edit": a longer one would widen the button and could
    // reflow the action row, moving the article.
  }

  function toggle() {
    const node = button();
    if (!node) return;
    if (blockMode.root) exitBlocks();
    else if (!blockMode.busy) enterBlocks(null);
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

  // --- block editing -----------------------------------------------------
  // A double-click swaps the reading view for the same document as a list of
  // separately rendered blocks. Only the active block shows its source, in a
  // textarea where it stood; every other block keeps its server render.
  const BLOCKS_URL = (slug) => `/api/documents/blocks/${slug}`;
  const AUTOSAVE_MS = 800;
  const HEADING = 'h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]';
  // Elements that own their click: native controls, fold rows, the diagrams and
  // embeds that zoom or pan, proposals, and annotation comments.
  const OWN_CLICK = 'a, button, input, textarea, select, summary, label, svg, canvas, iframe, video, audio, [contenteditable], [data-vyasa-proposal], .vyasa-comment-anchor, .vyasa-comments';

  const blockMode = { original: '', root: null, live: null, saved: '', busy: false, saveTimer: 0, saving: null };

  // The element whose children are the article's blocks. A first render wraps
  // them in one or more `div.w-full` (the renderer and its caller each add one);
  // a saved render does not. Descend through wrappers that hold nothing else.
  const contentRoot = (host) => {
    let root = host;
    for (;;) {
      const kids = Array.from(root.children).filter((node) => !/^(LINK|SCRIPT|STYLE)$/.test(node.tagName));
      if (kids.length !== 1 || !kids[0].matches('div.w-full')) return root;
      root = kids[0];
    }
  };

  // The article's blocks in reading order. The page folds each heading's
  // section into `details.vyasa-heading-fold` (scripts.js, initHeadingFolds):
  // the heading sits in its summary and the section in its body, so a fold
  // stands for its heading followed by its body's blocks.
  function readingBlocks(root) {
    const blocks = [];
    const walk = (parent) => {
      Array.from(parent.children).forEach((node) => {
        if (/^(LINK|SCRIPT|STYLE)$/.test(node.tagName)) return;
        if (!node.matches('details.vyasa-heading-fold')) {
          blocks.push(node);
          return;
        }
        const heading = node.querySelector(':scope > summary > :is(h1, h2, h3, h4, h5, h6)');
        if (heading) blocks.push(heading);
        const body = node.querySelector(':scope > .vyasa-heading-fold-body');
        if (body) walk(body);
      });
    };
    walk(root);
    return blocks;
  }

  // Blocks per section. Group 0 holds what sits above the first heading.
  function sectionGroups(root) {
    const groups = [[]];
    readingBlocks(root).forEach((node) => {
      if (node.matches(HEADING)) groups.push([]);
      groups[groups.length - 1].push(node);
    });
    return groups;
  }

  // `height: auto` keeps the default two rows, so a one-line block would show an
  // empty second line. Collapse to zero, then take the content height plus any border.
  function growInput(input) {
    input.style.height = '0px';
    input.style.height = `${input.scrollHeight + input.offsetHeight - input.clientHeight}px`;
  }

  function snippetAtPoint(x, y) {
    let node = null;
    let offset = 0;
    if (document.caretRangeFromPoint) {
      const range = document.caretRangeFromPoint(x, y);
      if (range) [node, offset] = [range.startContainer, range.startOffset];
    } else if (document.caretPositionFromPoint) {
      const position = document.caretPositionFromPoint(x, y);
      if (position) [node, offset] = [position.offsetNode, position.offset];
    }
    if (!node || node.nodeType !== Node.TEXT_NODE) return '';
    return node.textContent.slice(Math.max(0, offset - 32), offset);
  }

  const currentSource = () => (blockMode.live ? blockMode.live.serialize() : blockMode.saved);

  function makeItem(block, lines) {
    const node = document.createElement('div');
    node.className = 'vyasa-block';
    node.dataset.kind = block.kind;
    const view = document.createElement('div');
    view.className = 'vyasa-block-view';
    node.appendChild(view);
    if (block.kind === 'frontmatter') view.innerHTML = '<div class="vyasa-block-frontmatter">Frontmatter</div>';
    return { ...block, text: lines.slice(block.start, block.end).join('\n'), node, view };
  }

  function showSource(view, text) {
    view.innerHTML = '';
    const pre = document.createElement('pre');
    pre.textContent = text;
    view.appendChild(pre);
  }

  // Server renders of several markdown blocks in one request; null when it fails.
  async function fetchBlocks(texts) {
    try {
      const response = await fetch(BLOCKS_URL(state.slug), { method: 'POST', body: JSON.stringify({ blocks: texts }) });
      return response.ok ? await response.json() : null;
    } catch (error) {
      return null;
    }
  }

  // One request for every block that needs a render; bundles load once, then
  // each new block is announced on its own so runtimes scan only that block.
  // A block that cannot render shows its source instead.
  async function renderBlocks(items) {
    const todo = items.filter((item) => item.kind !== 'frontmatter');
    if (!todo.length) return;
    const payload = await fetchBlocks(todo.map((item) => item.text));
    todo.forEach((item, index) => {
      const html = payload && payload.blocks ? payload.blocks[index] : null;
      if (html == null) showSource(item.view, item.text);
      else item.view.innerHTML = html;
    });
    if (payload) await loadBundles(payload);
    todo.forEach((item) => { if (item.node.isConnected) announce(item.view); });
  }

  // Re-split `text` into `list`, keep the nodes of unchanged blocks at both
  // ends, and render only the blocks in between. Shared by the block editor
  // and the proposal view, which both swap one block at a time.
  function patchBlocks(list, old, text) {
    const lines = text.split('\n');
    const fresh = sourceBlocks(text).map((block) => ({ ...block, text: lines.slice(block.start, block.end).join('\n') }));
    const key = (item) => `${item.kind}\u0000${item.text}`;
    const { prefix, suffix } = reconcileBlocks(old.map(key), fresh.map(key));
    const middle = [];
    const items = fresh.map((block, index) => {
      const fromEnd = fresh.length - 1 - index;
      if (index < prefix) return { ...old[index], ...block };
      if (fromEnd < suffix) return { ...old[old.length - 1 - fromEnd], ...block };
      const item = makeItem(block, lines);
      middle.push(item);
      return item;
    });
    old.slice(prefix, old.length - suffix).forEach((item) => item.node.remove());
    const before = suffix ? items[items.length - suffix].node : null;
    middle.forEach((item) => list.insertBefore(item.node, before));
    return { items, rendered: renderBlocks(middle) };
  }

  // --- live editing ------------------------------------------------------
  // The editor itself is live_editor.js, loaded on first use so the reading
  // view never pays for ProseMirror. This side gives it the server: atom
  // renders, the reading view's classes, and the revision-checked save.
  // Both URLs come versioned from the Edit button, so neither is served stale.
  async function loadLiveEditor() {
    const node = button();
    const local = (name) => new URL(`./${name}`, import.meta.url).href;
    try {
      const editor = await import(node?.dataset.vyasaLiveEditor || local('live_editor.js'));
      await editor.useBundle(node?.dataset.vyasaProsemirror || local('prosemirror.bundle.js'));
      return editor;
    } catch (error) {
      return null;
    }
  }
  const CLASS_PROBE = [
    '# a', '## a', '### a', '#### a', '##### a', '###### a', 'a `b` **c** *d* [e](#e)', '- a', '1. a', '> a', '---',
    '| a |\n| --- |\n| b |',
  ].join('\n\n');
  let readingClasses = null;

  // The classes the reading view gives each element, read off a server render,
  // so the editor never keeps a second copy of the class map.
  async function probeClasses() {
    if (readingClasses) return readingClasses;
    const payload = await fetchBlocks([CLASS_PROBE]);
    const box = document.createElement('div');
    box.innerHTML = (payload && payload.blocks && payload.blocks[0]) || '';
    const pick = (selector) => box.querySelector(selector)?.getAttribute('class') || '';
    const found = {
      p: pick('p'), ul: pick('ul'), ol: pick('ol'), li: pick('li'), blockquote: pick('blockquote'), hr: pick('hr'),
      code: pick('p code'), strong: pick('strong'), em: pick('em'), a: pick('p a'),
      table: pick('table'), th: pick('th'), td: pick('td'),
    };
    for (let level = 1; level <= 6; level += 1) found[`h${level}`] = pick(`h${level}`);
    // A failed probe is not cached, so the next edit asks again.
    if (payload) readingClasses = found;
    return found;
  }

  // Atoms ask for their render one at a time; collect them for one request.
  const atomQueue = [];
  function renderAtom(target, text, kind) {
    if (kind === 'title') return; // hidden: the page header shows it
    if (kind === 'frontmatter') {
      target.innerHTML = '<div class="vyasa-block-frontmatter">Frontmatter</div>';
      return;
    }
    atomQueue.push({ target, text });
    if (atomQueue.length === 1) queueMicrotask(flushAtoms);
  }

  // Live preview of an atom's source: render into a hidden copy beside `target`,
  // let the diagram runtimes draw it, and swap it in only when nothing in it
  // reports `data-vyasa-render-error`. True when the new render is shown;
  // false keeps the last good one. A later call supersedes an earlier one.
  let liveSequence = 0;
  async function renderLive(target, text, kind) {
    if (kind === 'title' || kind === 'frontmatter') return false;
    const sequence = (liveSequence += 1);
    const payload = await fetchBlocks([text]);
    const html = payload && payload.blocks ? payload.blocks[0] : null;
    if (html == null || sequence !== liveSequence || !target.isConnected) return false;
    const stage = document.createElement('div');
    stage.className = 'vyasa-live-atom-stage';
    stage.style.width = `${target.clientWidth}px`;
    stage.innerHTML = html;
    target.after(stage);
    await loadBundles(payload);
    announce(stage);
    await quiet(stage);
    const shown = sequence === liveSequence && stage.isConnected && !stage.querySelector('[data-vyasa-render-error]');
    if (shown) target.replaceChildren(...stage.childNodes);
    stage.remove();
    return shown;
  }

  // Resolves once `node` has had no DOM change for 250 ms (runtimes draw
  // asynchronously), or after 3 s.
  function quiet(node) {
    return new Promise((resolve) => {
      let timer = 0;
      const done = () => {
        observer.disconnect();
        window.clearTimeout(cap);
        resolve();
      };
      const observer = new MutationObserver(() => {
        window.clearTimeout(timer);
        timer = window.setTimeout(done, 250);
      });
      observer.observe(node, { subtree: true, childList: true, attributes: true, characterData: true });
      timer = window.setTimeout(done, 250);
      const cap = window.setTimeout(done, 3000);
    });
  }

  async function flushAtoms() {
    const batch = atomQueue.splice(0);
    const payload = await fetchBlocks(batch.map((item) => item.text));
    batch.forEach((item, index) => {
      const html = payload && payload.blocks ? payload.blocks[index] : null;
      if (html == null) showSource(item.target, item.text);
      else item.target.innerHTML = html;
    });
    if (payload) await loadBundles(payload);
    batch.forEach((item) => { if (item.target.isConnected) announce(item.target); });
  }

  function scheduleSave() {
    state.dirty = true;
    setStatus('Unsaved changes', 'dirty');
    window.clearTimeout(blockMode.saveTimer);
    blockMode.saveTimer = window.setTimeout(saveNow, AUTOSAVE_MS);
  }

  // Saves run one at a time, each from the revision the last one returned.
  async function saveNow() {
    window.clearTimeout(blockMode.saveTimer);
    // Snapshot before waiting: leaving the page clears the source meanwhile.
    const text = currentSource();
    while (blockMode.saving) await blockMode.saving;
    if (text === blockMode.saved) {
      state.dirty = false;
      return true;
    }
    blockMode.saving = writeSource(text, { renderHost: false });
    const saved = await blockMode.saving;
    blockMode.saving = null;
    if (saved) blockMode.saved = text;
    // Typing during the save leaves the page dirty again.
    if (saved && blockMode.root && currentSource() !== text) scheduleSave();
    return saved;
  }

  // `event` is the click; the Edit button passes null and places no caret.
  async function enterBlocks(event) {
    clearProposalViews();
    const host = bodyHost();
    const slug = button()?.dataset.vyasaEditDocument || '';
    if (!host || !slug) return;
    state.slug = slug;
    const root = contentRoot(host);
    // The reading block under the pointer. The event's target can be a wrapper:
    // when the DOM changes between the two clicks, the browser reports their
    // common ancestor, so the point decides. A fold's heading holds only the
    // heading, so a click in its section lands on the section's block.
    const under = event ? document.elementFromPoint(event.clientX, event.clientY) || event.target : null;
    const block = under ? readingBlocks(root).find((node) => node.contains(under)) || nearestBlock(root, event.clientY) : null;
    const anchor = block ? block.getBoundingClientRect().top : 0;
    const snippet = event ? snippetAtPoint(event.clientX, event.clientY) : '';
    const point = event ? { left: event.clientX, top: event.clientY } : null;
    const groups = sectionGroups(root);
    blockMode.busy = true;
    const [payload, editor, classes] = await Promise.all([
      readSource(slug),
      loadLiveEditor(),
      probeClasses(),
    ]);
    blockMode.busy = false;
    if (!payload || !editor || blockMode.root) return;
    const source = payload.source || '';
    state.revision = payload.revision || '';
    const wrap = document.createElement('div');
    wrap.className = 'w-full vyasa-block-editor';
    wrap.setAttribute('data-vyasa-block-editor', 'true');
    // Nothing is added above the article, so no line moves when editing starts.
    // Edit mode shows as a floating pill that also carries the save status and
    // takes you back to reading.
    wrap.innerHTML = '<div class="vyasa-live-mount"></div>';
    const pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'vyasa-edit-pill';
    pill.setAttribute('data-vyasa-block-done', 'true');
    pill.setAttribute('aria-label', 'Editing. Click to go back to reading.');
    pill.title = 'Back to reading (Esc)';
    pill.innerHTML = '<span class="vyasa-edit-pill-dot" aria-hidden="true"></span><span>Editing</span>' +
      '<span data-vyasa-editor-status data-kind="idle"></span><span class="vyasa-edit-pill-done">Done</span>';
    pill.addEventListener('mousedown', (event) => event.preventDefault());
    pill.addEventListener('click', () => exitBlocks());
    document.body.appendChild(pill);
    host.parentNode.insertBefore(wrap, host);
    host.hidden = true;
    document.documentElement.classList.add('vyasa-editing');
    // Reading-only tools (annotations' selection bar) close on this.
    document.dispatchEvent(new CustomEvent('vyasa:editing', { detail: { editing: true } }));
    markButton(true);
    Object.assign(blockMode, { root: wrap, pill, saved: source, original: source, moved: [] });
    const reading = readingElements(source, groups);
    const fold = document.querySelector('.vyasa-frontmatter-block:not(.vyasa-live-properties)');
    blockMode.live = editor.createLiveEditor(wrap.querySelector('.vyasa-live-mount'), source, {
      sourceBlocks,
      classes,
      title: reading.title,
      frontmatter: fold ? { block: fold.className, summary: fold.querySelector('summary')?.className } : null,
      adopt: (index) => adopt(reading.elements.get(index)),
      renderAtom,
      renderLive,
      grow: growInput,
      onChange: scheduleSave,
      onSave: () => saveNow(),
      onExit: () => exitBlocks(),
    });
    if (!block) {
      blockMode.live.view.focus();
      return;
    }
    const index = [...reading.elements].find(([, element]) => element === block)?.[0];
    if (index == null) {
      blockMode.live.view.focus();
      return;
    }
    // Line the block up with where it was read, then put the caret under the
    // pointer: the same point now covers the same character.
    const node = blockMode.live.blockDom(index);
    if (node && node.getBoundingClientRect) {
      window.scrollBy(0, node.getBoundingClientRect().top - anchor);
      holdPosition(node, anchor);
    }
    blockMode.live.focusBlock(index, snippet, point);
  }

  // A double-click in the gap between blocks edits the block nearest the pointer.
  function nearestBlock(root, y) {
    let best = null;
    let distance = Infinity;
    readingBlocks(root).forEach((node) => {
      const box = node.getBoundingClientRect();
      const gap = y < box.top ? box.top - y : y > box.bottom ? y - box.bottom : 0;
      if (gap < distance) [best, distance] = [node, gap];
    });
    return best;
  }

  // Keep `node` at `top` while late layout (fonts, images, a diagram drawing)
  // settles, until the reader scrolls or types.
  function holdPosition(node, top) {
    const align = () => {
      if (!node.isConnected || !blockMode.root) return stop();
      const drift = node.getBoundingClientRect().top - top;
      if (Math.abs(drift) >= 1) window.scrollBy(0, drift);
    };
    const observer = new ResizeObserver(align);
    const events = ['wheel', 'touchmove', 'keydown', 'mousedown'];
    const stop = () => {
      observer.disconnect();
      events.forEach((name) => window.removeEventListener(name, stop, true));
    };
    observer.observe(blockMode.root);
    events.forEach((name) => window.addEventListener(name, stop, { capture: true, passive: true }));
    window.setTimeout(stop, 2000);
  }

  // Move a reading-view element into the editor, remembering where it lived.
  function adopt(element) {
    if (!element || !element.isConnected) return null;
    blockMode.moved.push({ element, parent: element.parentNode, next: element.nextSibling });
    return element;
  }

  // The reading view's top-level element for each source block, and the index
  // of the `# Title` block it drops into the page header (-1 when none). The
  // sections pair headings with source lines; inside a section, elements and
  // blocks pair in order when their counts agree, and stay unpaired otherwise.
  function readingElements(source, groups) {
    const elements = new Map();
    const ranges = sectionRanges(source, groups.length - 1);
    if (!ranges) return { elements, title: -1 };
    const blocks = sourceBlocks(source);
    const lines = source.split('\n');
    let title = -1;
    ranges.forEach((range, section) => {
      const inside = blocks
        .map((block, index) => index)
        .filter((index) => blocks[index].kind !== 'frontmatter' && blocks[index].start >= range.start && blocks[index].start < range.end);
      const first = blocks[inside[0]];
      if (section === 0 && first && /^#\s/.test(lines[first.start]) && !(groups[0][0] && groups[0][0].matches(HEADING))) {
        title = inside.shift();
      }
      if (groups[section].length !== inside.length) return;
      inside.forEach((index, order) => elements.set(index, groups[section][order]));
    });
    return { elements, title };
  }

  function leaveBlocks() {
    const wrap = blockMode.root;
    window.clearTimeout(blockMode.saveTimer);
    if (blockMode.live) blockMode.live.destroy();
    // Put adopted reading-view elements back, last first, so each `next` is home.
    (blockMode.moved || []).reverse().forEach(({ element, parent, next }) => parent.insertBefore(element, next));
    Object.assign(blockMode, { root: null, live: null, saved: '', moved: [] });
    state.dirty = false;
    if (wrap) wrap.remove();
    if (blockMode.pill) blockMode.pill.remove();
    blockMode.pill = null;
    const host = bodyHost();
    if (host) host.hidden = false;
    document.documentElement.classList.remove('vyasa-editing');
    document.dispatchEvent(new CustomEvent('vyasa:editing', { detail: { editing: false } }));
    markButton(false);
    refreshProposals();
  }

  // Save what is left, then show the reading view rendered from the saved file.
  // The render runs after the view is visible, so diagrams measure real space.
  async function exitBlocks() {
    if (!blockMode.root) return true;
    if (!(await saveNow())) return false;
    const source = blockMode.saved;
    const changed = source !== blockMode.original;
    leaveBlocks();
    if (!changed) return true;
    const host = bodyHost();
    try {
      const response = await fetch(PREVIEW_URL(state.slug), { method: 'POST', body: source });
      if (response.ok && host) await applyRender(host, await response.json());
    } catch (error) {
      /* the file is saved; a reload shows it */
    }
    return true;
  }

  // --- proposals ---------------------------------------------------------
  // An agent's pending edit to one section, shown in place of that section as
  // an inline diff. The server sends the proposed section as markdown with each
  // change wrapped in <ins>/<del>; it is split and rendered block by block like
  // the block editor, so while the text streams in only the changed blocks
  // redraw. Nothing reaches the file until a hunk is accepted.
  const PROPOSALS_URL = (slug) => `/api/documents/proposals/${slug}`;
  const RESOLVE_URL = (id, action) => `/api/document-proposals/${id}/${action}`;
  // Our own accept writes the file, and the live-reload swap that follows
  // would scroll to the top; for this long after a write, skip it.
  const SELF_WRITE_MS = 3000;
  const review = { views: new Map(), fetching: false, again: false, heldUntil: 0, pop: null };

  const proposalSlug = () => button()?.dataset.vyasaEditDocument || '';

  function clearProposalViews() {
    review.views.forEach((view) => {
      view.wrap.remove();
      view.hidden.forEach((node) => { node.hidden = false; });
    });
    review.views.clear();
    hideHunkPop();
  }

  async function refreshProposals() {
    const slug = proposalSlug();
    if (!slug || blockMode.root || !bodyHost()) return;
    if (review.fetching) {
      review.again = true;
      return;
    }
    review.fetching = true;
    state.slug = slug;
    try {
      const response = await fetch(PROPOSALS_URL(slug));
      if (response.ok) await showProposals((await response.json()).proposals || []);
    } catch (error) {
      /* proposals are shown on the next event */
    }
    review.fetching = false;
    if (review.again) {
      review.again = false;
      refreshProposals();
    }
  }

  // The section a proposal replaces: the blocks after its heading up to the
  // next heading of any level, as `sutragana doc write` counts it.
  function sectionNodes(root, anchor) {
    const groups = sectionGroups(root);
    const group = anchor ? groups.find((nodes) => nodes[0] && nodes[0].id === anchor) : null;
    return group ? { heading: group[0], body: group.slice(1) } : null;
  }

  function buildProposalView(root, proposal) {
    const found = sectionNodes(root, proposal.anchor);
    const wrap = document.createElement('div');
    wrap.className = 'vyasa-proposal';
    wrap.setAttribute('data-vyasa-proposal', proposal.id);
    wrap.innerHTML =
      '<div class="vyasa-proposal-bar">' +
      '<span class="vyasa-proposal-origin"></span>' +
      '<span class="vyasa-proposal-status" data-vyasa-proposal-status></span>' +
      '<span class="vyasa-proposal-actions">' +
      '<button type="button" data-vyasa-proposal-action="accept">Accept all</button>' +
      '<button type="button" data-vyasa-proposal-action="reject">Reject all</button>' +
      '</span></div><div class="vyasa-block-list"></div>';
    wrap.addEventListener('click', onProposalClick);
    wrap.addEventListener('mouseover', onHunkHover);
    wrap.addEventListener('mouseout', onHunkHover);
    if (found) {
      // Never inside a fold's summary: before the section's first block, or at
      // the start of the fold's body when the section is empty.
      const fold = found.heading.closest('details.vyasa-heading-fold');
      const foldBody = fold && fold.querySelector(':scope > .vyasa-heading-fold-body');
      if (found.body[0]) found.body[0].before(wrap);
      else if (foldBody) foldBody.prepend(wrap);
      else found.heading.after(wrap);
      found.body.forEach((node) => { node.hidden = true; });
    } else {
      // A section that does not exist yet arrives at the end, heading and all.
      wrap.classList.add('vyasa-proposal-new');
      root.appendChild(wrap);
    }
    return { wrap, list: wrap.querySelector('.vyasa-block-list'), items: [], hidden: found ? found.body : [] };
  }

  async function showProposals(proposals) {
    const root = contentRoot(bodyHost());
    const live = new Set(proposals.map((proposal) => proposal.id));
    review.views.forEach((view, id) => {
      // A live-reload swap replaces the article, and the view with it.
      if (live.has(id) && view.wrap.isConnected) return;
      view.wrap.remove();
      view.hidden.forEach((node) => { node.hidden = false; });
      review.views.delete(id);
    });
    const renders = proposals.map((proposal) => {
      let view = review.views.get(proposal.id);
      if (!view) {
        view = buildProposalView(root, proposal);
        review.views.set(proposal.id, view);
      }
      const text = view.wrap.classList.contains('vyasa-proposal-new')
        ? `${proposal.heading}\n\n${proposal.marked}`
        : proposal.marked;
      const patched = patchBlocks(view.list, view.items, text);
      view.items = patched.items;
      describeProposal(view, proposal);
      return patched.rendered;
    });
    await Promise.all(renders);
  }

  function describeProposal(view, proposal) {
    const count = proposal.hunks.length;
    view.wrap.querySelector('.vyasa-proposal-origin').textContent = proposal.origin || 'Proposed edit';
    let status = `${count} change${count === 1 ? '' : 's'}`;
    if (proposal.partial) status = 'Writing...';
    if (proposal.stale_base) status += ' · section changed since';
    view.wrap.querySelector('[data-vyasa-proposal-status]').textContent = status;
    view.wrap.classList.toggle('vyasa-proposal-partial', proposal.partial);
    view.wrap.querySelectorAll('[data-vyasa-proposal-action]').forEach((node) => {
      node.disabled = proposal.partial;
    });
  }

  const hunkIds = (node) => {
    const many = node.getAttribute('data-vyasa-hunks');
    if (many) return many.split(' ').map(Number);
    return [Number(node.getAttribute('data-vyasa-hunk'))];
  };

  function onHunkHover(event) {
    const node = event.target.closest('[data-vyasa-hunk], [data-vyasa-hunks]');
    if (!node) return;
    const wrap = node.closest('[data-vyasa-proposal]');
    const on = event.type === 'mouseover';
    hunkIds(node).forEach((id) => {
      wrap.querySelectorAll(`[data-vyasa-hunk="${id}"]`).forEach((part) => part.classList.toggle('vyasa-hunk-hot', on));
    });
    node.classList.toggle('vyasa-hunk-hot', on);
  }

  function onProposalClick(event) {
    const wrap = event.currentTarget;
    const id = wrap.getAttribute('data-vyasa-proposal');
    const whole = event.target.closest('[data-vyasa-proposal-action]');
    if (whole) {
      resolveProposal(id, whole.getAttribute('data-vyasa-proposal-action'), null);
      return;
    }
    const node = event.target.closest('[data-vyasa-hunk], [data-vyasa-hunks]');
    if (!node || wrap.classList.contains('vyasa-proposal-partial')) return;
    event.preventDefault();
    showHunkPop(node, id, hunkIds(node));
  }

  function showHunkPop(node, id, hunks) {
    hideHunkPop();
    const pop = document.createElement('div');
    pop.className = 'vyasa-hunk-pop';
    pop.innerHTML =
      '<button type="button" data-hunk-action="accept" aria-label="Accept this change">Accept</button>' +
      '<button type="button" data-hunk-action="reject" aria-label="Reject this change">Reject</button>';
    const box = node.getBoundingClientRect();
    pop.style.left = `${window.scrollX + box.left}px`;
    pop.style.top = `${window.scrollY + box.bottom + 4}px`;
    pop.addEventListener('click', (event) => {
      const action = event.target.closest('[data-hunk-action]');
      if (!action) return;
      hideHunkPop();
      resolveProposal(id, action.getAttribute('data-hunk-action'), hunks);
    });
    document.body.appendChild(pop);
    review.pop = pop;
  }

  function hideHunkPop() {
    if (review.pop) review.pop.remove();
    review.pop = null;
  }

  async function resolveProposal(id, action, hunks) {
    review.heldUntil = performance.now() + SELF_WRITE_MS;
    let response;
    try {
      response = await fetch(RESOLVE_URL(id, action), {
        method: 'POST',
        body: JSON.stringify(hunks ? { hunks } : {}),
      });
    } catch (error) {
      return;
    }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const status = review.views.get(id)?.wrap.querySelector('[data-vyasa-proposal-status]');
      if (status) status.textContent = payload.error || `Failed (${response.status})`;
      return;
    }
    if (payload.html) {
      // The article is rendered again from the file; every view rebuilds on it.
      clearProposalViews();
      await applyRender(bodyHost(), payload);
    }
    refreshProposals();
  }

  // Live reload asks this before it swaps the article: not while the block
  // editor is open, and not right after our own write, which the page has
  // already rendered.
  window.__vyasaHoldSoftRefresh = () => Boolean(blockMode.root) || performance.now() < review.heldUntil;

  document.addEventListener('vyasa:proposal', (event) => {
    if ((event.detail || {}).slug === proposalSlug()) refreshProposals();
  });

  // A new article (navigation, live reload, an accept) brings its own nodes;
  // views on the old ones are gone, so build them again.
  document.addEventListener('htmx:afterSwap', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.matches('[data-vyasa-document-body]') || target.querySelector('[data-vyasa-document-body]')) {
      refreshProposals();
    }
  });

  document.addEventListener('mousedown', (event) => {
    if (review.pop && !review.pop.contains(event.target)) hideHunkPop();
  });

  // A click in the article edits it where you clicked, as in Word. A drag that
  // selects text (to copy), a modified click, and clicks on things that own
  // their click (OWN_CLICK) keep reading.
  document.addEventListener('click', (event) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (blockMode.root || blockMode.busy || event.defaultPrevented) return;
    const host = bodyHost();
    if (!host || !button() || !host.contains(event.target)) return;
    if (event.target.closest(OWN_CLICK)) return;
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) return;
    enterBlocks(event);
  });

  document.addEventListener('vyasa:page-change', () => {
    if (blockMode.root) {
      saveNow();
      leaveBlocks();
    }
  });

  refreshProposals();

  window.addEventListener('beforeunload', (event) => {
    if (!state.dirty) return;
    event.preventDefault();
    event.returnValue = '';
  });
})();
