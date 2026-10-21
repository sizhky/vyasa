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
// In-place editing: a double-click opens one section, from its heading to the
// next heading of any level, as source. Entry 0 is the text above the first
// heading. The reading view drops a leading `# Title` line, so the source may
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
export function replaceLines(text, range, body) {
  const lines = text.split('\n');
  return [...lines.slice(0, range.start), ...body.split('\n'), ...lines.slice(range.end)].join('\n');
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
// A click lands in rendered text, which has lost its markup. The longest tail
// of the text before the click that still occurs in the source puts the caret
// after it; null when nothing matches.
export function sourceOffsetForSnippet(source, before) {
  for (let length = Math.min(before.length, 32); length >= 3; length -= 1) {
    const tail = before.slice(before.length - length);
    const index = source.indexOf(tail);
    if (index >= 0) return index + tail.length;
  }
  return null;
}
export function caretOffset(text, line, column) {
  const lines = text.split('\n');
  const row = Math.max(0, Math.min(line, lines.length - 1));
  let offset = 0;
  for (let i = 0; i < row; i += 1) offset += lines[i].length + 1;
  return offset + Math.max(0, Math.min(column, lines[row].length));
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
    const label = node.querySelector('span');
    if (label) label.textContent = open ? 'Done editing' : 'Edit';
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
  // Elements that own their double-click: native controls, and the diagrams and
  // embeds that zoom or select on it.
  const OWN_DBLCLICK = 'a, button, input, textarea, select, summary, label, svg, canvas, iframe, video, audio, [contenteditable]';
  // In block mode a click edits the block, except on controls. A diagram is
  // not a control here: clicking it opens its source, as in Obsidian.
  const OWN_CLICK = 'button, input, select, summary, label, iframe, video, audio';

  const blockMode = { original: '', root: null, list: null, items: [], active: -1, input: null, saved: '', busy: false, saveTimer: 0, saving: null };

  // The first render wraps the blocks in `div.w-full`; a saved render does not.
  const contentRoot = (host) => host.querySelector(':scope > div.w-full') || host;
  const plainText = (node) => (node.textContent || '').replace(/\s+/g, ' ').trim();

  // Top-level blocks per section. Group 0 holds what sits above the first heading.
  function sectionGroups(root) {
    const groups = [[]];
    Array.from(root.children).forEach((node) => {
      if (/^(LINK|SCRIPT|STYLE)$/.test(node.tagName)) return;
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

  const currentSource = () => {
    const item = blockMode.items[blockMode.active];
    return item && blockMode.input ? replaceLines(blockMode.source, item, blockMode.input.value) : blockMode.source;
  };

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

  // One request for every block that needs a render; bundles load once, then
  // each new block is announced on its own so runtimes scan only that block.
  async function renderBlocks(items) {
    const todo = items.filter((item) => item.kind !== 'frontmatter');
    if (!todo.length) return;
    let payload = null;
    try {
      const response = await fetch(BLOCKS_URL(state.slug), {
        method: 'POST',
        body: JSON.stringify({ blocks: todo.map((item) => item.text) }),
      });
      if (response.ok) payload = await response.json();
    } catch (error) {
      /* a block that cannot render shows its source instead */
    }
    todo.forEach((item, index) => {
      const html = payload && payload.blocks ? payload.blocks[index] : null;
      if (html == null) showSource(item.view, item.text);
      else item.view.innerHTML = html;
    });
    if (payload) await loadBundles(payload);
    todo.forEach((item) => { if (item.node.isConnected) announce(item.view); });
  }

  // Re-split after an edit, keep the nodes of unchanged blocks at both ends,
  // and render only the blocks in between.
  function applySource(next) {
    const lines = next.split('\n');
    const old = blockMode.items;
    const fresh = sourceBlocks(next).map((block) => ({ ...block, text: lines.slice(block.start, block.end).join('\n') }));
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
    middle.forEach((item) => blockMode.list.insertBefore(item.node, before));
    blockMode.items = items;
    blockMode.source = next;
    renderBlocks(middle);
  }

  function commitActive() {
    const index = blockMode.active;
    const input = blockMode.input;
    if (index < 0 || !input) return;
    const item = blockMode.items[index];
    // Clear first: removing a focused textarea can fire its blur, and blur commits.
    blockMode.active = -1;
    blockMode.input = null;
    input.remove();
    item.node.classList.remove('vyasa-block-active');
    item.view.hidden = false;
    if (input.value !== item.text) applySource(replaceLines(blockMode.source, item, input.value));
  }

  // The source takes the type of its own render, so a paragraph is edited in
  // the paragraph font and a heading at heading size; only the markup differs.
  // Fences and frontmatter are code, and keep the code style from the CSS.
  const TYPE_PROPS = ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'lineHeight', 'letterSpacing', 'color'];
  function matchTypography(input, item) {
    if (item.kind === 'fence' || item.kind === 'frontmatter') return;
    const block = item.view.firstElementChild;
    if (!block) return;
    const text = block.matches('h1, h2, h3, h4, h5, h6, p') ? block : block.querySelector('p, li, td, th') || block;
    const type = window.getComputedStyle(text);
    const box = window.getComputedStyle(block);
    TYPE_PROPS.forEach((name) => { input.style[name] = type[name]; });
    input.style.marginTop = box.marginTop;
    input.style.marginBottom = box.marginBottom;
    // Lists and quotes indent their text. Pull the source in by the same inset,
    // less the width of its marker, so `- ` sits in the bullet column and the
    // item text starts where the rendered text did.
    if (!block.matches('ul, ol, blockquote')) return;
    const inset = text.getBoundingClientRect().left - item.view.getBoundingClientRect().left;
    const marker = (item.text.match(/^\s*(?:[-*+]\s+(?:\[[ xX]\]\s+)?|\d+[.)]\s+|>\s?)/) || [''])[0];
    input.style.paddingLeft = `${Math.max(0, inset - textWidth(marker, type))}px`;
  }

  let measurer = null;
  function textWidth(text, type) {
    if (!text) return 0;
    measurer = measurer || document.createElement('canvas').getContext('2d');
    measurer.font = `${type.fontStyle} ${type.fontWeight} ${type.fontSize} ${type.fontFamily}`;
    return measurer.measureText(text).width;
  }

  // `caret` is 'start', 'end', a number, or { snippet } from a click.
  function activate(node, caret) {
    const current = blockMode.items[blockMode.active];
    if (current && current.node === node) return;
    commitActive();
    const index = blockMode.items.findIndex((item) => item.node === node);
    if (index < 0) return;
    const item = blockMode.items[index];
    const input = document.createElement('textarea');
    input.className = 'vyasa-block-input';
    input.rows = 1;
    input.spellcheck = true;
    input.setAttribute('aria-label', `Markdown source of this ${item.kind} block`);
    input.value = item.text;
    matchTypography(input, item);
    item.view.hidden = true;
    node.classList.add('vyasa-block-active');
    node.appendChild(input);
    blockMode.active = index;
    blockMode.input = input;
    growInput(input);
    input.focus({ preventScroll: true });
    let at = item.text.length;
    if (caret === 'start') at = 0;
    else if (typeof caret === 'number') at = caret;
    else if (caret && caret.snippet) at = sourceOffsetForSnippet(item.text, caret.snippet) ?? at;
    input.setSelectionRange(at, at);
    input.addEventListener('input', () => {
      growInput(input);
      scheduleSave();
    });
    input.addEventListener('keydown', onBlockKey);
    input.addEventListener('blur', (event) => {
      if (!blockMode.root || blockMode.root.contains(event.relatedTarget)) return;
      if (blockMode.input === input) commitActive();
    });
  }

  // Focus the block holding `line` of the current source, caret at `column`.
  function activateAtLine(line, column) {
    const item = blockMode.items.find((block) => line < block.end) || blockMode.items[blockMode.items.length - 1];
    if (!item) return;
    activate(item.node, caretOffset(item.text, line - item.start, line < item.start ? 0 : column));
  }

  // Backspace at the start of a block removes the blank lines that separate it
  // from the block above; with none left, it joins the two lines.
  function mergeWithPrevious() {
    const startLine = blockMode.items[blockMode.active].start;
    commitActive();
    const index = blockMode.items.findIndex((item) => item.start === startLine);
    const previous = blockMode.items[index - 1];
    if (index < 1 || !previous) return;
    const lines = blockMode.source.split('\n');
    if (startLine > previous.end) {
      lines.splice(previous.end, startLine - previous.end);
      applySource(lines.join('\n'));
      activateAtLine(previous.end, 0);
      return;
    }
    const column = lines[startLine - 1].length;
    lines.splice(startLine - 1, 2, lines[startLine - 1] + lines[startLine]);
    applySource(lines.join('\n'));
    activateAtLine(startLine - 1, column);
  }

  function onBlockKey(event) {
    const input = event.target;
    const collapsed = input.selectionStart === input.selectionEnd;
    const index = blockMode.active;
    const neighbour = (step) => blockMode.items[index + step]?.node;
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      commitActive();
      saveNow();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      exitBlocks();
    } else if (event.key === 'ArrowUp' && collapsed && neighbour(-1) && !input.value.slice(0, input.selectionStart).includes('\n')) {
      event.preventDefault();
      activate(neighbour(-1), 'end');
    } else if (event.key === 'ArrowDown' && collapsed && neighbour(1) && !input.value.slice(input.selectionEnd).includes('\n')) {
      event.preventDefault();
      activate(neighbour(1), 'start');
    } else if (event.key === 'Backspace' && collapsed && input.selectionStart === 0 && index > 0) {
      event.preventDefault();
      mergeWithPrevious();
    }
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

  // `event` is the double-click; the Edit button passes null and activates nothing.
  async function enterBlocks(event) {
    const host = bodyHost();
    const slug = button()?.dataset.vyasaEditDocument || '';
    if (!host || !slug) return;
    const root = contentRoot(host);
    let block = event ? event.target : null;
    while (block && block.parentElement !== root) block = block.parentElement;
    const anchor = block ? block.getBoundingClientRect().top : 0;
    const hint = block ? plainText(block) : '';
    const snippet = event ? snippetAtPoint(event.clientX, event.clientY) : '';
    const groups = sectionGroups(root);
    const section = groups.findIndex((group) => group.includes(block));
    blockMode.busy = true;
    const payload = await readSource(slug);
    blockMode.busy = false;
    if (!payload || blockMode.root) return;
    const source = payload.source || '';
    const ranges = sectionRanges(source, groups.length - 1);
    const line = ranges && section >= 0 ? ranges[section].start : 0;
    state.slug = slug;
    state.revision = payload.revision || '';
    const lines = source.split('\n');
    const wrap = document.createElement('div');
    wrap.className = 'w-full vyasa-block-editor';
    wrap.setAttribute('data-vyasa-block-editor', 'true');
    wrap.innerHTML =
      '<div class="vyasa-document-editor-bar vyasa-block-editor-bar">' +
      '<span data-vyasa-editor-status data-kind="idle"></span>' +
      '<span class="vyasa-document-editor-hint">Click a block to edit. Arrows move between blocks. Esc finishes.</span>' +
      '<button type="button" class="vyasa-block-editor-done" data-vyasa-block-done>Done</button>' +
      '</div><div class="vyasa-block-list"></div>';
    Object.assign(blockMode, { root: wrap, list: wrap.querySelector('.vyasa-block-list'), source, saved: source, original: source, active: -1, input: null });
    blockMode.items = sourceBlocks(source).map((item) => makeItem(item, lines));
    blockMode.items.forEach((item) => blockMode.list.appendChild(item.node));
    wrap.addEventListener('mousedown', onBlockPointer);
    wrap.addEventListener('click', onBlockClick);
    host.parentNode.insertBefore(wrap, host);
    host.hidden = true;
    document.documentElement.classList.add('vyasa-editing');
    markButton(true);
    await renderBlocks(blockMode.items);
    if (blockMode.root !== wrap || !block) return;
    // Prefer the block that renders to the same text as the one clicked, then
    // the first block of its section.
    const matches = blockMode.items.filter((item) => hint && plainText(item.view) === hint);
    const target = matches.find((item) => item.start >= line) || matches[0]
      || blockMode.items.find((item) => item.start >= line) || blockMode.items[0];
    if (!target) return;
    activate(target.node, { snippet });
    // Keep the edited block where the eye was.
    window.scrollBy(0, target.node.getBoundingClientRect().top - anchor);
  }

  function onBlockPointer(event) {
    const node = event.target.closest('.vyasa-block');
    if (!node || event.target === blockMode.input || event.target.closest(OWN_CLICK)) return;
    if (event.target.closest('a') && (event.metaKey || event.ctrlKey)) return;
    // Keeps focus in the textarea until the new block takes it, so no blur
    // commits in between and the clicked node stays put.
    event.preventDefault();
    activate(node, { snippet: snippetAtPoint(event.clientX, event.clientY) });
  }

  function onBlockClick(event) {
    if (event.target.closest('[data-vyasa-block-done]')) {
      exitBlocks();
      return;
    }
    // A plain click on a link edits it; Cmd/Ctrl+click follows it.
    if (event.target.closest('.vyasa-block a') && !(event.metaKey || event.ctrlKey)) event.preventDefault();
  }

  function leaveBlocks() {
    const wrap = blockMode.root;
    window.clearTimeout(blockMode.saveTimer);
    Object.assign(blockMode, { root: null, list: null, items: [], active: -1, input: null, source: '', saved: '' });
    state.dirty = false;
    if (wrap) wrap.remove();
    const host = bodyHost();
    if (host) host.hidden = false;
    document.documentElement.classList.remove('vyasa-editing');
    markButton(false);
  }

  // Save what is left, then show the reading view rendered from the saved file.
  // The render runs after the view is visible, so diagrams measure real space.
  async function exitBlocks() {
    if (!blockMode.root) return true;
    commitActive();
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

  document.addEventListener('dblclick', (event) => {
    if (blockMode.root || blockMode.busy || event.defaultPrevented) return;
    const host = bodyHost();
    if (!host || !button() || !host.contains(event.target)) return;
    if (event.target.closest(OWN_DBLCLICK)) return;
    event.preventDefault();
    window.getSelection()?.removeAllRanges();
    enterBlocks(event);
  });

  document.addEventListener('vyasa:page-change', () => {
    if (blockMode.root) {
      commitActive();
      saveNow();
      leaveBlocks();
    }
  });

  window.addEventListener('beforeunload', (event) => {
    if (!state.dirty) return;
    event.preventDefault();
    event.returnValue = '';
  });
})();
