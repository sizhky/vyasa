// Live editing: the page as one ProseMirror document. Prose blocks (paragraphs,
// headings, lists, quotes) are rich text drawn with the reading view's own
// classes, so a block looks the same while you type in it. Every other block --
// fences, diagrams, tables, callouts, containers, math, frontmatter, and prose
// that uses Vyasa's own inline syntax -- is an atom: it shows the server render
// and opens its exact source when clicked.
//
// Saving writes each untouched top-level block back byte for byte. ProseMirror
// keeps the object of every top-level node a transaction did not touch, so a
// node still found in `origin` is unchanged and its source text is reused;
// only edited blocks go through the markdown serializer.
// ProseMirror arrives as one bundle whose versioned URL the page passes in
// (useBundle), so a rebuilt bundle is never served from cache.
let PM = null;
export async function useBundle(url) {
  PM = PM || (await import(url));
  return PM;
}

// Prose that the markdown parser would read differently from Vyasa's renderer:
// footnotes, includes, highlights, sup/sub/strike, tooltips, inline attributes,
// raw HTML, images, math, and wiki links. Pipe tables parse as tables.
const VYASA_SYNTAX = /\[\^|\{\*|\{ |==\S|\^[^\s^]+\^|~[^~\s]+~|\]\[\?|`\{|<[A-Za-z/!]|!\[|\$|\[\[/m;

export function isProseBlock(kind, text) {
  if (!['heading', 'text', 'list'].includes(kind)) return false;
  if (/^\s*>\s*\[!/m.test(text)) return false; // a callout written as a quote
  if (/\n\s*(=+|-+)\s*$/m.test(text)) return false; // setext heading
  return !VYASA_SYNTAX.test(text);
}

function listIsTight(tokens, i) {
  while (++i < tokens.length) if (tokens[i].type !== 'list_item_open') return tokens[i].hidden;
  return false;
}

// GFM tables as prosemirror-tables nodes; a cell holds one line of inline text.
function tableSpecs(cls) {
  const specs = PM.tableNodes({
    tableGroup: 'block',
    cellContent: 'inline*',
    cellAttributes: {
      align: {
        default: null,
        getFromDOM: (dom) => dom.style.textAlign || null,
        setDOMAttr: (value, attrs) => {
          if (value) attrs.style = `${attrs.style || ''}text-align: ${value};`;
        },
      },
    },
  });
  const classed = (spec, tag) => ({
    ...spec,
    toDOM(node) {
      const [name, second, ...rest] = spec.toDOM(node);
      if (second && typeof second === 'object' && !Array.isArray(second)) return [name, { ...second, ...cls(tag) }, ...rest];
      return [name, cls(tag), ...(second === undefined ? [] : [second]), ...rest];
    },
  });
  return {
    table: classed(specs.table, 'table'),
    table_row: specs.table_row,
    table_cell: classed(specs.table_cell, 'td'),
    table_header: classed(specs.table_header, 'th'),
  };
}

export function makeSchema(classes = {}) {
  const base = PM.markdownSchema.spec;
  const cls = (tag) => (classes[tag] ? { class: classes[tag] } : {});
  let nodes = base.nodes
    .update('doc', { content: '(block | vyasa)+' })
    .update('paragraph', { ...base.nodes.get('paragraph'), toDOM: () => ['p', cls('p'), 0] })
    .update('heading', {
      ...base.nodes.get('heading'),
      toDOM: (node) => [`h${node.attrs.level}`, cls(`h${node.attrs.level}`), 0],
    })
    .update('blockquote', { ...base.nodes.get('blockquote'), toDOM: () => ['blockquote', cls('blockquote'), 0] })
    .update('horizontal_rule', { ...base.nodes.get('horizontal_rule'), toDOM: () => ['hr', cls('hr')] })
    .update('list_item', { ...base.nodes.get('list_item'), toDOM: () => ['li', cls('li'), 0] })
    .update('ordered_list', {
      ...base.nodes.get('ordered_list'),
      toDOM: (node) => [
        'ol',
        { ...cls('ol'), start: node.attrs.order === 1 ? null : node.attrs.order, 'data-tight': node.attrs.tight ? 'true' : null },
        0,
      ],
    })
    .update('bullet_list', {
      ...base.nodes.get('bullet_list'),
      attrs: { tight: { default: false }, bullet: { default: '-' } },
      toDOM: (node) => ['ul', { ...cls('ul'), 'data-tight': node.attrs.tight ? 'true' : null }, 0],
    })
    .append(tableSpecs(cls))
    .addToEnd('vyasa_block', {
      group: 'vyasa',
      atom: true,
      selectable: true,
      // `index` is the source block the atom came from; new atoms have none.
      attrs: { source: { default: '' }, kind: { default: 'text' }, index: { default: null } },
      toDOM: (node) => ['div', { class: 'vyasa-live-atom', 'data-kind': node.attrs.kind }],
    });
  const marks = base.marks
    .update('em', { ...base.marks.get('em'), toDOM: () => ['em', cls('em'), 0] })
    .update('strong', { ...base.marks.get('strong'), toDOM: () => ['strong', cls('strong'), 0] })
    .update('code', { ...base.marks.get('code'), toDOM: () => ['code', cls('code'), 0] })
    .update('link', {
      ...base.marks.get('link'),
      toDOM: (mark) => ['a', { ...cls('a'), href: mark.attrs.href, title: mark.attrs.title }, 0],
    });
  return new PM.Schema({ nodes, marks });
}

const cellAlign = (tok) => ({ align: (/text-align:\s*(\w+)/.exec(tok.attrGet('style') || '') || [])[1] || null });

export function makeParser(schema) {
  const tokens = {
    ...PM.defaultMarkdownParser.tokens,
    bullet_list: {
      block: 'bullet_list',
      getAttrs: (tok, all, i) => ({ tight: listIsTight(all, i), bullet: tok.markup || '-' }),
    },
    table: { block: 'table' },
    thead: { ignore: true },
    tbody: { ignore: true },
    tr: { block: 'table_row' },
    th: { block: 'table_header', getAttrs: cellAlign },
    td: { block: 'table_cell', getAttrs: cellAlign },
  };
  return new PM.MarkdownParser(schema, PM.MarkdownIt('commonmark', { html: false }).enable('table'), tokens);
}

const ALIGN_RULE = { left: ':---', center: ':---:', right: '---:' };

export function makeSerializer() {
  let serializer = null;
  // A cell is one line of inline markdown; a pipe inside it is escaped.
  const cellText = (cell) => {
    const { nodes } = cell.type.schema;
    const doc = nodes.doc.create(null, nodes.paragraph.create(null, cell.content));
    return serializer.serialize(doc).trim().replace(/\n+/g, ' ').replace(/\|/g, '\\|');
  };
  serializer = new PM.MarkdownSerializer(
    {
      ...PM.defaultMarkdownSerializer.nodes,
      // Text is written as typed, never escaped: the file is markdown, so typed
      // `[a](b)`, `**x**` or `==mark==` is meant as markdown, as in Obsidian.
      text(state, node) {
        state.text(node.text, false);
      },
      vyasa_block(state, node) {
        state.text(node.attrs.source, false);
        state.closeBlock(node);
      },
      table(state, node) {
        const rows = [];
        node.forEach((row) => {
          const cells = [];
          row.forEach((cell) => cells.push(cellText(cell)));
          rows.push(cells);
        });
        const rule = [];
        node.firstChild.forEach((cell) => rule.push(ALIGN_RULE[cell.attrs.align] || '---'));
        const line = (cells) => `| ${cells.join(' | ')} |`;
        [line(rows[0]), line(rule), ...rows.slice(1).map(line)].forEach((text, index) => {
          if (index) state.ensureNewLine();
          state.write(text);
        });
        state.closeBlock(node);
      },
    },
    PM.defaultMarkdownSerializer.marks
  );
  return serializer;
}

// --- frontmatter properties -------------------------------------------------
// Frontmatter of single-line `key: value` pairs is edited as properties, the
// way Obsidian shows it. Any other YAML (nesting, block lists, multi-line
// text) stays source, so nothing is rewritten that the rows cannot show.
const PROPERTY = /^([A-Za-z_][\w-]*):(?:[ \t]+(.*))?$/;

export function parseProperties(source) {
  const lines = source.split('\n');
  const close = lines[lines.length - 1];
  if (lines.length < 2 || lines[0] !== '---' || (close !== '---' && close !== '...')) return null;
  const rows = [];
  for (const line of lines.slice(1, -1)) {
    const match = line.match(PROPERTY);
    if (!match) return null;
    const raw = (match[2] || '').trim();
    const quoted = raw.match(/^(["'])(.*)\1$/);
    rows.push({ key: match[1], value: quoted ? quoted[2] : raw, quote: quoted ? quoted[1] : '', line });
  }
  return { rows, close };
}

// A row keeps its exact line until it is edited; an edited value is quoted
// only when YAML would read it as something else.
function propertyLine(row) {
  if (row.line != null) return row.line;
  const { key, value, quote } = row;
  if (quote) return `${key}: ${quote}${value}${quote}`;
  if (value === '' || /^\[.*\]$|^\{.*\}$/.test(value)) return value ? `${key}: ${value}` : `${key}:`;
  return /^[#&*!|>'"%@`\-?:,]|: | #/.test(value) ? `${key}: ${JSON.stringify(value)}` : `${key}: ${value}`;
}

export function formatProperties(parsed) {
  return ['---', ...parsed.rows.map(propertyLine), parsed.close].join('\n');
}

// Every top-level block of `source` becomes one node. `origin` maps each node
// to its text, its place, and the blank lines that followed it, which is all
// `serializeDoc` needs to put the file back together unchanged.
// `title` is the index of the `# Title` block the reading view drops into the
// page header; it stays in the document, hidden, so editing never shows it twice.
export function buildDoc(source, schema, parser, sourceBlocks, { title = -1 } = {}) {
  const lines = source.split('\n');
  const blocks = sourceBlocks(source);
  const origin = new WeakMap();
  const gaps = blocks.map((block, index) => (blocks[index + 1] ? lines.slice(block.end, blocks[index + 1].start) : []));
  const nodes = blocks.map((block, index) => {
    const text = lines.slice(block.start, block.end).join('\n');
    const gap = gaps[index];
    let node = null;
    if (index !== title && isProseBlock(block.kind, text)) {
      const parsed = parser.parse(text);
      // One source block must stay one node, or its text could not be reused.
      if (parsed && parsed.childCount === 1) node = parsed.firstChild;
    }
    node = node || schema.nodes.vyasa_block.create({ source: text, kind: index === title ? 'title' : block.kind, index });
    origin.set(node, { text, index, gap });
    return node;
  });
  if (!nodes.length) nodes.push(schema.nodes.paragraph.create());
  const first = blocks[0];
  const last = blocks[blocks.length - 1];
  return {
    doc: schema.nodes.doc.create(null, nodes),
    origin,
    gaps,
    head: first ? lines.slice(0, first.start) : [],
    tail: last ? lines.slice(last.end) : lines,
  };
}

// Blank lines between two nodes. Neighbours from the file keep the lines they
// had; an edited or new node takes the gap of the slot it sits in, so editing
// a block never moves the blank lines around it. At least one blank line
// separates a new node, or new prose would run into the list above it.
function gapBetween(known, nextKnown, gaps) {
  if (known && nextKnown) return nextKnown.index === known.index + 1 ? known.gap : [''];
  const slot = known ? known.gap : nextKnown && nextKnown.index > 0 ? gaps[nextKnown.index - 1] : [];
  return slot.length ? slot : [''];
}

export function serializeDoc(doc, built, serializer) {
  const children = [];
  doc.forEach((child) => children.push(child));
  const out = [...built.head];
  children.forEach((child, i) => {
    const known = built.origin.get(child);
    const text = known
      ? known.text
      : child.type.name === 'vyasa_block'
        ? child.attrs.source
        : serializer.serialize(child.type.schema.nodes.doc.create(null, [child])).replace(/\n+$/, '');
    out.push(...text.split('\n'));
    const next = children[i + 1];
    if (!next) return;
    out.push(...gapBetween(known, built.origin.get(next), built.gaps));
  });
  out.push(...built.tail);
  return out.join('\n');
}

// --- view -------------------------------------------------------------------

function markRule(pattern, type) {
  // Groups: text before the opening mark, the opening mark, the text, the
  // closing mark. The last character of the closing mark is the one being
  // typed, so it is not in the document yet.
  return new PM.InputRule(pattern, (state, match, start, end) => {
    const [, before, open, inner] = match;
    const from = start + before.length;
    const textStart = from + open.length;
    const textEnd = textStart + inner.length;
    const tr = state.tr.delete(textEnd, end).delete(from, textStart);
    tr.addMark(from, textEnd - open.length, type.create()).removeStoredMark(type);
    return tr;
  });
}

// --- live preview markup ------------------------------------------------------
// Obsidian shows the markdown of the spot you are editing: the heading's
// hashes, the delimiters of the bold, italic or code span under the caret, and
// a link's `[...](url)` with the URL editable in place. Everything else stays
// rendered. These are decorations: they are drawn, never part of the document.

function muted(text) {
  const span = document.createElement('span');
  span.className = 'vyasa-live-markup';
  span.contentEditable = 'false';
  span.textContent = text;
  return span;
}

// The run of inline nodes around `offset` in `parent` that carry the same mark.
export function markRange(parent, offset, type) {
  const runs = [];
  parent.forEach((child, pos) => {
    const mark = type.isInSet(child.marks);
    const last = runs[runs.length - 1];
    if (mark && last && last.mark.eq(mark) && last.to === pos) last.to = pos + child.nodeSize;
    else if (mark) runs.push({ mark, from: pos, to: pos + child.nodeSize });
  });
  return runs.find((run) => run.from <= offset && offset <= run.to) || null;
}

function linkTail(range, start) {
  return PM.Decoration.widget(
    start + range.to,
    (view) => {
      const span = muted('](');
      const input = document.createElement('input');
      input.className = 'vyasa-live-link-href';
      input.spellcheck = false;
      input.setAttribute('aria-label', 'Link address');
      input.value = range.mark.attrs.href;
      input.size = Math.max(4, input.value.length);
      const commit = () => {
        const href = input.value.trim();
        if (href === range.mark.attrs.href) return;
        const from = start + range.from;
        const to = start + range.to;
        const tr = view.state.tr.removeMark(from, to, range.mark.type);
        if (href) tr.addMark(from, to, range.mark.type.create({ ...range.mark.attrs, href }));
        view.dispatch(tr);
      };
      input.addEventListener('input', () => { input.size = Math.max(4, input.value.length); });
      input.addEventListener('change', commit);
      input.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== 'Escape') return;
        event.preventDefault();
        if (event.key === 'Escape') input.value = range.mark.attrs.href;
        commit();
        view.focus();
      });
      span.appendChild(input);
      span.appendChild(document.createTextNode(')'));
      return span;
    },
    { side: 1, key: `link-${range.from}-${range.mark.attrs.href}`, stopEvent: () => true, ignoreSelection: true }
  );
}

function markupPlugin(schema) {
  const { marks, nodes } = schema;
  const delimiters = [[marks.strong, '**'], [marks.em, '*'], [marks.code, '`']];
  return new PM.Plugin({
    props: {
      decorations(state) {
        const { $from } = state.selection;
        const parent = $from.parent;
        if (!parent.isTextblock) return null;
        const start = $from.start();
        const offset = $from.parentOffset;
        const found = [];
        if (parent.type === nodes.heading) {
          const hashes = `${'#'.repeat(parent.attrs.level)} `;
          // The hashes hang in the margin, so the heading's text does not move.
          const hang = () => Object.assign(muted(hashes), { className: 'vyasa-live-markup vyasa-live-markup-heading' });
          found.push(PM.Decoration.widget(start, hang, { side: -1, key: `h-${hashes}` }));
        }
        delimiters.forEach(([type, mark]) => {
          const range = markRange(parent, offset, type);
          if (!range) return;
          found.push(PM.Decoration.widget(start + range.from, () => muted(mark), { side: -1, key: `${type.name}-o-${range.from}` }));
          found.push(PM.Decoration.widget(start + range.to, () => muted(mark), { side: 1, key: `${type.name}-c-${range.to}` }));
        });
        const link = markRange(parent, offset, marks.link);
        if (link) {
          found.push(PM.Decoration.widget(start + link.from, () => muted('['), { side: -1, key: `link-o-${link.from}` }));
          found.push(linkTail(link, start));
        }
        return found.length ? PM.DecorationSet.create(state.doc, found) : null;
      },
      // Cmd/Ctrl+click follows a link; a plain click edits it.
      handleClick(view, pos, event) {
        if (!(event.metaKey || event.ctrlKey)) return false;
        const node = view.state.doc.nodeAt(pos);
        const link = node && marks.link.isInSet(node.marks);
        if (!link) return false;
        window.open(link.attrs.href, '_blank', 'noopener');
        return true;
      },
    },
  });
}

// --- tables ------------------------------------------------------------------

// Enter in a cell goes to the cell below, adding a row under the last one.
function cellBelow(state, dispatch, view) {
  if (!PM.isInTable(state)) return false;
  if (!dispatch || !view) return true;
  const target = () => {
    const $cell = PM.selectionCell(view.state);
    const table = $cell.node(-1);
    const tableStart = $cell.start(-1);
    const map = PM.TableMap.get(table);
    const rect = map.findCell($cell.pos - tableStart);
    return rect.bottom < map.height ? tableStart + map.map[rect.bottom * map.width + rect.left] : null;
  };
  let cell = target();
  if (cell == null) {
    PM.addRowAfter(view.state, view.dispatch);
    cell = target();
  }
  if (cell == null) return true;
  const inside = view.state.doc.resolve(cell + 1);
  view.dispatch(view.state.tr.setSelection(PM.TextSelection.create(view.state.doc, inside.end())).scrollIntoView());
  return true;
}

// Enter after a typed header row such as `| a | b |` starts a table: that row
// as its header and one empty row below, with the caret in its first cell.
export function startTable(state, dispatch) {
  const { $from, empty } = state.selection;
  const { nodes } = state.schema;
  if (!empty || $from.depth !== 1 || $from.parent.type !== nodes.paragraph) return false;
  const match = /^\s*\|(.+)\|\s*$/.exec($from.parent.textContent);
  if (!match || $from.parentOffset !== $from.parent.content.size) return false;
  const names = match[1].split('|').map((name) => name.trim());
  if (dispatch) {
    const header = nodes.table_row.create(null, names.map((name) => nodes.table_header.create(null, name ? state.schema.text(name) : null)));
    const body = nodes.table_row.create(null, names.map(() => nodes.table_cell.create()));
    const table = nodes.table.create(null, [header, body]);
    const from = $from.before();
    const tr = state.tr.replaceWith(from, $from.after(), table);
    // Inside the table, past the header row, into the first body cell.
    tr.setSelection(PM.TextSelection.create(tr.doc, from + 1 + header.nodeSize + 2));
    dispatch(tr.scrollIntoView());
  }
  return true;
}

// Tab past the last cell adds a row and moves into it.
function nextCellOrRow(state, dispatch, view) {
  if (!PM.isInTable(state)) return false;
  if (PM.goToNextCell(1)(state, dispatch)) return true;
  if (!dispatch || !view) return true;
  PM.addRowAfter(view.state, view.dispatch);
  return PM.goToNextCell(1)(view.state, view.dispatch);
}

// Every table action rebuilds the grid from rows of cells. GFM tables have no
// spans, so a row is a plain list of cells, and the first row is the header.
// Returns the new table and the cell the caret should land in.
export function transformTable(table, op, at) {
  const rows = [];
  table.forEach((row) => {
    const cells = [];
    row.forEach((cell) => cells.push(cell));
    rows.push(cells);
  });
  const width = rows[0].length;
  let { row, col } = at;
  const blank = (like) => like.type.schema.nodes.table_cell.create({ ...like.attrs });
  const swap = (list, a, b) => ([list[a], list[b]] = [list[b], list[a]]);
  const body = rows.slice(1);
  const sortKey = (cells) => cells[col].textContent.toLowerCase();
  switch (op) {
    case 'sortAsc':
    case 'sortDesc': {
      body.sort((a, b) => sortKey(a).localeCompare(sortKey(b), undefined, { numeric: true }) * (op === 'sortAsc' ? 1 : -1));
      rows.splice(1, body.length, ...body);
      break;
    }
    case 'addColBefore':
    case 'addColAfter':
      col += op === 'addColAfter' ? 1 : 0;
      rows.forEach((cells) => cells.splice(col, 0, blank(cells[Math.min(col, width - 1)])));
      break;
    case 'dupCol':
      rows.forEach((cells) => cells.splice(col + 1, 0, cells[col]));
      col += 1;
      break;
    case 'delCol':
      if (width === 1) return null;
      rows.forEach((cells) => cells.splice(col, 1));
      col = Math.min(col, width - 2);
      break;
    case 'moveColLeft':
    case 'moveColRight': {
      const to = col + (op === 'moveColRight' ? 1 : -1);
      if (to < 0 || to >= width) return null;
      rows.forEach((cells) => swap(cells, col, to));
      col = to;
      break;
    }
    case 'alignLeft':
    case 'alignCenter':
    case 'alignRight': {
      const align = op.slice(5).toLowerCase();
      rows.forEach((cells) => { cells[col] = cells[col].type.create({ ...cells[col].attrs, align }, cells[col].content); });
      break;
    }
    case 'addRowAbove':
    case 'addRowBelow': {
      const index = row + (op === 'addRowBelow' ? 1 : 0);
      if (index < 1) return null; // nothing goes above the header
      rows.splice(index, 0, rows[row].map(blank));
      row = index;
      break;
    }
    case 'dupRow':
      if (row < 1) return null;
      rows.splice(row + 1, 0, [...rows[row]]);
      row += 1;
      break;
    case 'delRow':
      if (row < 1 || rows.length < 3) return null;
      rows.splice(row, 1);
      row = Math.min(row, rows.length - 1);
      break;
    case 'moveRowUp':
    case 'moveRowDown': {
      const to = row + (op === 'moveRowDown' ? 1 : -1);
      if (row < 1 || to < 1 || to >= rows.length) return null;
      swap(rows, row, to);
      row = to;
      break;
    }
    default:
      return null;
  }
  const { nodes } = table.type.schema;
  const rebuilt = rows.map((cells, index) =>
    nodes.table_row.create(
      null,
      cells.map((cell) => (index === 0 ? nodes.table_header : nodes.table_cell).create(cell.attrs, cell.content))
    )
  );
  return { table: table.type.create(table.attrs, rebuilt), row, col };
}

// Where the caret is in a table: the table, its position, and the cell's row and column.
function tableAt(state) {
  if (!PM.isInTable(state)) return null;
  const $cell = PM.selectionCell(state);
  return { table: $cell.node(-1), pos: $cell.before(-1), row: $cell.index(-1), col: $cell.index() };
}

// Swap in a rebuilt table and put the caret inside the cell it names: past the
// rows above, past the cells before, then into the cell's text.
function replaceTable(view, at, result) {
  const tr = view.state.tr.replaceWith(at.pos, at.pos + at.table.nodeSize, result.table);
  let pos = at.pos + 1;
  for (let i = 0; i < result.row; i += 1) pos += result.table.child(i).nodeSize;
  pos += 1;
  for (let i = 0; i < result.col; i += 1) pos += result.table.child(result.row).child(i).nodeSize;
  tr.setSelection(PM.TextSelection.near(tr.doc.resolve(pos + 1)));
  view.dispatch(tr.scrollIntoView());
  view.focus();
}

function runTable(view, op) {
  const at = tableAt(view.state);
  if (!at) return;
  const result = transformTable(at.table, op, at);
  if (!result) return;
  replaceTable(view, at, result);
}

// --- menus and doodads ----------------------------------------------------------

let openMenuNode = null;

function closeMenu() {
  if (openMenuNode) openMenuNode.remove();
  openMenuNode = null;
}

// A small floating menu at (x, y) in viewport pixels. `items` holds
// { label, run, disabled } entries and '-' separators.
function openMenu(x, y, items) {
  closeMenu();
  const menu = document.createElement('div');
  menu.className = 'vyasa-live-menu';
  menu.setAttribute('role', 'menu');
  items.forEach((item) => {
    if (item === '-') {
      menu.appendChild(Object.assign(document.createElement('div'), { className: 'vyasa-live-menu-rule' }));
      return;
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('role', 'menuitem');
    button.textContent = item.label;
    button.disabled = Boolean(item.disabled);
    button.addEventListener('mousedown', (event) => event.preventDefault());
    button.addEventListener('click', () => {
      closeMenu();
      item.run();
    });
    menu.appendChild(button);
  });
  document.body.appendChild(menu);
  const box = menu.getBoundingClientRect();
  menu.style.left = `${Math.max(8, Math.min(x, window.innerWidth - box.width - 8))}px`;
  menu.style.top = `${Math.max(8, Math.min(y, window.innerHeight - box.height - 8))}px`;
  openMenuNode = menu;
  const away = (event) => {
    if (event.type === 'keydown' && event.key !== 'Escape') return;
    if (event.type === 'mousedown' && menu.contains(event.target)) return;
    closeMenu();
    ['mousedown', 'keydown', 'scroll'].forEach((name) => window.removeEventListener(name, away, true));
  };
  ['mousedown', 'keydown', 'scroll'].forEach((name) => window.addEventListener(name, away, true));
  menu.querySelector('button:not(:disabled)')?.focus();
}

function deleteTable(view) {
  const at = tableAt(view.state);
  if (!at) return;
  const tr = view.state.tr.delete(at.pos, at.pos + at.table.nodeSize);
  view.dispatch(tr.scrollIntoView());
  view.focus();
}

const deleteTableItem = (view) => ({ label: 'Delete table', run: () => deleteTable(view) });

function columnItems(view) {
  const at = tableAt(view.state);
  const width = at ? at.table.firstChild.childCount : 0;
  const run = (op) => () => runTable(view, op);
  return [
    { label: 'Sort by column (A to Z)', run: run('sortAsc') },
    { label: 'Sort by column (Z to A)', run: run('sortDesc') },
    '-',
    { label: 'Add column before', run: run('addColBefore') },
    { label: 'Add column after', run: run('addColAfter') },
    '-',
    { label: 'Move column left', run: run('moveColLeft'), disabled: !at || at.col === 0 },
    { label: 'Move column right', run: run('moveColRight'), disabled: !at || at.col === width - 1 },
    '-',
    { label: 'Align left', run: run('alignLeft') },
    { label: 'Align centre', run: run('alignCenter') },
    { label: 'Align right', run: run('alignRight') },
    '-',
    { label: 'Duplicate column', run: run('dupCol') },
    { label: 'Delete column', run: run('delCol'), disabled: width < 2 },
    '-',
    deleteTableItem(view),
  ];
}

function rowItems(view) {
  const at = tableAt(view.state);
  const header = !at || at.row === 0;
  const last = at ? at.table.childCount - 1 : 0;
  const run = (op) => () => runTable(view, op);
  return [
    { label: 'Add row above', run: run('addRowAbove'), disabled: header },
    { label: 'Add row below', run: run('addRowBelow') },
    '-',
    { label: 'Move row up', run: run('moveRowUp'), disabled: header || at.row === 1 },
    { label: 'Move row down', run: run('moveRowDown'), disabled: header || at.row === last },
    '-',
    { label: 'Duplicate row', run: run('dupRow'), disabled: header },
    { label: 'Delete row', run: run('delRow'), disabled: header || last < 2 },
    '-',
    deleteTableItem(view),
  ];
}

// Formatting for a right-click on prose, as Obsidian offers it.
function formatItems(view, schema) {
  const { marks, nodes } = schema;
  const apply = (command) => () => {
    command(view.state, view.dispatch, view);
    view.focus();
  };
  const link = () => {
    const href = window.prompt('Link address');
    if (!href) return;
    const { from, to, empty } = view.state.selection;
    if (empty) {
      const text = schema.text(href, [marks.link.create({ href })]);
      view.dispatch(view.state.tr.replaceSelectionWith(text, false));
    } else {
      view.dispatch(view.state.tr.addMark(from, to, marks.link.create({ href })));
    }
    view.focus();
  };
  const table = () => {
    const header = nodes.table_row.create(null, [nodes.table_header.create(), nodes.table_header.create()]);
    const body = nodes.table_row.create(null, [nodes.table_cell.create(), nodes.table_cell.create()]);
    const { $from } = view.state.selection;
    const at = $from.depth ? $from.after(1) : view.state.selection.from;
    const tr = view.state.tr.insert(at, nodes.table.create(null, [header, body]));
    tr.setSelection(PM.TextSelection.near(tr.doc.resolve(at + 3)));
    view.dispatch(tr.scrollIntoView());
    view.focus();
  };
  return [
    { label: 'Bold', run: apply(PM.toggleMark(marks.strong)) },
    { label: 'Italic', run: apply(PM.toggleMark(marks.em)) },
    { label: 'Code', run: apply(PM.toggleMark(marks.code)) },
    { label: 'Link...', run: link },
    '-',
    { label: 'Paragraph', run: apply(PM.setBlockType(nodes.paragraph)) },
    { label: 'Heading 1', run: apply(PM.setBlockType(nodes.heading, { level: 1 })) },
    { label: 'Heading 2', run: apply(PM.setBlockType(nodes.heading, { level: 2 })) },
    { label: 'Heading 3', run: apply(PM.setBlockType(nodes.heading, { level: 3 })) },
    '-',
    { label: 'Bullet list', run: apply(PM.wrapInList(nodes.bullet_list)) },
    { label: 'Numbered list', run: apply(PM.wrapInList(nodes.ordered_list)) },
    { label: 'Quote', run: apply(PM.wrapIn(nodes.blockquote)) },
    '-',
    { label: 'Insert table', run: table },
  ];
}

// Grips over the current column and row, and + buttons on the table's right and
// bottom edges, drawn in a layer over the editor while the caret is in a table.
function tableControls() {
  return new PM.Plugin({
    view(view) {
      const host = view.dom.parentNode;
      const layer = document.createElement('div');
      layer.className = 'vyasa-live-table-controls';
      layer.innerHTML =
        '<button type="button" class="vyasa-live-grip" data-grip="col" aria-label="Column actions">⋯</button>' +
        '<button type="button" class="vyasa-live-grip" data-grip="row" aria-label="Row actions">⋮</button>' +
        '<button type="button" class="vyasa-live-table-add" data-add="col" aria-label="Add column">+</button>' +
        '<button type="button" class="vyasa-live-table-add" data-add="row" aria-label="Add row">+</button>';
      host.appendChild(layer);
      layer.addEventListener('mousedown', (event) => event.preventDefault());
      layer.addEventListener('click', (event) => {
        const button = event.target.closest('button');
        if (!button) return;
        const box = button.getBoundingClientRect();
        if (button.dataset.grip === 'col') openMenu(box.left, box.bottom + 4, columnItems(view));
        else if (button.dataset.grip === 'row') openMenu(box.right + 4, box.top, rowItems(view));
        else addAtEdge(view, button.dataset.add);
      });
      const place = () => {
        const at = tableAt(view.state);
        const table = at && view.nodeDOM(at.pos);
        const cell = at && view.domAtPos(view.state.selection.from).node;
        const cellBox = cell && (cell.nodeType === 1 ? cell : cell.parentElement)?.closest('td, th');
        layer.hidden = !table || !cellBox;
        if (layer.hidden) return;
        const origin = host.getBoundingClientRect();
        const t = table.getBoundingClientRect();
        const c = cellBox.getBoundingClientRect();
        const put = (selector, left, top, width, height) => {
          const node = layer.querySelector(selector);
          Object.assign(node.style, {
            left: `${left - origin.left}px`,
            top: `${top - origin.top}px`,
            width: width == null ? '' : `${width}px`,
            height: height == null ? '' : `${height}px`,
          });
        };
        put('[data-grip="col"]', c.left + c.width / 2 - 12, t.top - 18);
        put('[data-grip="row"]', t.left - 20, c.top + c.height / 2 - 12);
        put('[data-add="col"]', t.right + 4, t.top, 18, t.height);
        put('[data-add="row"]', t.left, t.bottom + 4, t.width, 18);
      };
      place();
      return { update: place, destroy: () => layer.remove() };
    },
  });
}

// The + buttons: a column after the last one, or a row after the last one.
function addAtEdge(view, what) {
  const at = tableAt(view.state);
  if (!at) return;
  const end = what === 'col'
    ? { row: at.row, col: at.table.firstChild.childCount - 1 }
    : { row: at.table.childCount - 1, col: at.col };
  const result = transformTable(at.table, what === 'col' ? 'addColAfter' : 'addRowBelow', end);
  if (!result) return;
  replaceTable(view, at, result);
}

// A rendered block's menu: open its source, or delete it.
function atomItems(view, dom) {
  // Atoms are top-level, so the one drawn as `dom` is found among the doc's children.
  let pos = null;
  view.state.doc.forEach((child, offset) => {
    if (pos == null && view.nodeDOM(offset) === dom) pos = offset;
  });
  const node = pos == null ? null : view.state.doc.nodeAt(pos);
  const valid = node && node.type.name === 'vyasa_block';
  const kind = valid && node.attrs.kind === 'text' && /^\s*\|/.test(node.attrs.source) ? 'table' : 'block';
  return [
    { label: 'Edit source', run: () => dom.dispatchEvent(new CustomEvent('vyasa:open')), disabled: !valid },
    '-',
    {
      label: `Delete ${kind}`,
      disabled: !valid,
      run: () => {
        view.dispatch(view.state.tr.delete(pos, pos + node.nodeSize).scrollIntoView());
        view.focus();
      },
    },
  ];
}

function contextMenus(schema) {
  return new PM.Plugin({
    props: {
      handleDOMEvents: {
        contextmenu(view, event) {
          const hit = view.posAtCoords({ left: event.clientX, top: event.clientY });
          if (!hit) return false;
          event.preventDefault();
          if (event.target.closest && event.target.closest('.vyasa-live-atom')) {
            openMenu(event.clientX, event.clientY, atomItems(view, event.target.closest('.vyasa-live-atom')));
            return true;
          }
          const $pos = view.state.doc.resolve(hit.pos);
          const inside = view.state.selection.from <= hit.pos && hit.pos <= view.state.selection.to;
          if (!inside) view.dispatch(view.state.tr.setSelection(PM.TextSelection.near($pos)));
          // Row and column menus already end with Delete table.
          const items = PM.isInTable(view.state) ? [...rowItems(view), '-', ...columnItems(view)] : formatItems(view, schema);
          openMenu(event.clientX, event.clientY, items);
          return true;
        },
      },
    },
  });
}

function plugins(schema, deps) {
  const { nodes, marks } = schema;
  const atomSelected = (state) => state.selection instanceof PM.NodeSelection && state.selection.node.type === nodes.vyasa_block;
  const openAtom = (state, dispatch, view) => {
    if (!atomSelected(state)) return false;
    if (view) view.nodeDOM(state.selection.from)?.dispatchEvent(new CustomEvent('vyasa:open'));
    return true;
  };
  // At the start of a heading, `#` adds a level and Backspace removes one, as if
  // the shown hashes were text; Backspace on `#` makes a paragraph.
  const headingStep = (delta) => (state, dispatch) => {
    const { $from, empty } = state.selection;
    if (!empty || $from.parentOffset !== 0 || $from.parent.type !== nodes.heading) return false;
    const level = $from.parent.attrs.level + delta;
    if (level < 1) return PM.setBlockType(nodes.paragraph)(state, dispatch);
    return level > 6 ? true : PM.setBlockType(nodes.heading, { level })(state, dispatch);
  };
  const linkRule = new PM.InputRule(/\[([^\]]+)\]\(([^)\s]+)\)$/, (state, match, start, end) => {
    const tr = state.tr.replaceWith(start, end, schema.text(match[1], [marks.link.create({ href: match[2] })]));
    return tr.removeStoredMark(marks.link);
  });
  const hardBreak = (state, dispatch) => {
    if (dispatch) dispatch(state.tr.replaceSelectionWith(nodes.hard_break.create()).scrollIntoView());
    return true;
  };
  const fenceRule = new PM.InputRule(/^```$/, (state, match, start) => {
    const $start = state.doc.resolve(start);
    if ($start.depth !== 1) return null;
    const atom = nodes.vyasa_block.create({ source: '```\n\n```', kind: 'fence' });
    const tr = state.tr.replaceWith($start.before(), $start.after(), atom);
    tr.setSelection(PM.NodeSelection.create(tr.doc, $start.before()));
    window.setTimeout(() => deps.openSelected?.(), 0);
    return tr;
  });
  const rules = [
    PM.wrappingInputRule(/^\s*>\s$/, nodes.blockquote),
    PM.wrappingInputRule(/^(\d+)\.\s$/, nodes.ordered_list, (m) => ({ order: +m[1] }),
      (m, node) => node.childCount + node.attrs.order === +m[1]),
    PM.wrappingInputRule(/^\s*([-+*])\s$/, nodes.bullet_list, (m) => ({ bullet: m[1] })),
    PM.textblockTypeInputRule(/^(#{1,6})\s$/, nodes.heading, (m) => ({ level: m[1].length })),
    fenceRule,
    linkRule,
    markRule(/(^|[^*])(\*\*)([^*]+)\*\*$/, marks.strong),
    markRule(/(^|[^*])(\*)([^*]+)\*$/, marks.em),
    markRule(/(^|[^`])(`)([^`]+)`$/, marks.code),
  ];
  const keys = {
    'Mod-z': PM.undo,
    'Shift-Mod-z': PM.redo,
    'Mod-y': PM.redo,
    'Mod-b': PM.toggleMark(marks.strong),
    'Mod-i': PM.toggleMark(marks.em),
    'Mod-e': PM.toggleMark(marks.code),
    Enter: PM.chainCommands(openAtom, cellBelow, startTable, PM.splitListItem(nodes.list_item)),
    Tab: PM.chainCommands(nextCellOrRow, PM.sinkListItem(nodes.list_item)),
    'Shift-Tab': PM.chainCommands(PM.goToNextCell(-1), PM.liftListItem(nodes.list_item)),
    'Shift-Enter': hardBreak,
    Backspace: PM.chainCommands(PM.undoInputRule, headingStep(-1)),
    '#': headingStep(1),
    'Mod-Alt-0': PM.setBlockType(nodes.paragraph),
    ...Object.fromEntries([1, 2, 3, 4, 5, 6].map((level) => [`Mod-Alt-${level}`, PM.setBlockType(nodes.heading, { level })])),
    'Mod-Alt-ArrowDown': PM.addRowAfter,
    'Mod-Alt-ArrowUp': PM.addRowBefore,
    'Mod-Alt-ArrowRight': PM.addColumnAfter,
    'Mod-Alt-ArrowLeft': PM.addColumnBefore,
    'Mod-Alt-Backspace': PM.deleteRow,
    'Shift-Mod-Alt-Backspace': PM.deleteColumn,
    'Mod-s': () => {
      deps.onSave();
      return true;
    },
    Escape: () => {
      deps.onExit();
      return true;
    },
  };
  return [
    markupPlugin(schema),
    tableControls(),
    contextMenus(schema),
    PM.tableEditing(),
    PM.inputRules({ rules }),
    PM.keymap(keys),
    PM.keymap(PM.baseKeymap),
    PM.history(),
    PM.dropCursor(),
    PM.gapCursor(),
  ];
}

// An atom shows the server render; a click or Enter opens its source below the
// render, which follows the source as you type (deps.renderLive keeps the last
// good render while the source does not render).
const LIVE_RENDER_MS = 400;

class AtomView {
  constructor(node, view, getPos, deps) {
    Object.assign(this, { node, view, getPos, deps, input: null, rendered: node.attrs.source, timer: 0 });
    this.dom = document.createElement('div');
    this.dom.className = 'vyasa-live-atom';
    this.dom.dataset.kind = node.attrs.kind;
    this.preview = document.createElement('div');
    this.preview.className = 'vyasa-live-atom-view';
    this.dom.appendChild(this.preview);
    // The reading view already drew this block; take its element rather than
    // drawing it again, so its height is right from the first frame.
    const drawn = deps.adopt ? deps.adopt(node.attrs.index) : null;
    if (drawn) this.preview.appendChild(drawn);
    else deps.renderAtom(this.preview, node.attrs.source, node.attrs.kind);
    // A left press opens the source; a right-click is a menu (contextMenus), not an edit.
    this.dom.addEventListener('mousedown', (event) => {
      if (event.button !== 0 || this.input || event.target.closest('button, summary, input, select')) return;
      event.preventDefault();
      this.open();
    });
    this.dom.addEventListener('vyasa:open', () => this.open());
  }

  open() {
    if (this.input) return;
    const input = document.createElement('textarea');
    input.className = 'vyasa-live-atom-input';
    input.rows = 1;
    input.spellcheck = false;
    input.setAttribute('aria-label', `Markdown source of this ${this.node.attrs.kind} block`);
    input.value = this.node.attrs.source;
    // The render stays above; the source opens below it, so nothing above moves.
    this.dom.classList.add('vyasa-live-atom-editing');
    this.dom.appendChild(input);
    this.input = input;
    this.deps.grow(input);
    input.focus();
    input.addEventListener('input', () => {
      this.deps.grow(input);
      window.clearTimeout(this.timer);
      this.timer = window.setTimeout(() => this.renderSource(input.value), LIVE_RENDER_MS);
    });
    input.addEventListener('blur', () => this.close());
    input.addEventListener('keydown', (event) => {
      const mod = event.metaKey || event.ctrlKey;
      const before = input.value.slice(0, input.selectionStart);
      const after = input.value.slice(input.selectionEnd);
      if (event.key === 'Escape' || (mod && event.key === 'Enter')) {
        event.preventDefault();
        this.leave(1);
      } else if (mod && event.key.toLowerCase() === 's') {
        event.preventDefault();
        this.close();
        this.deps.onSave();
      } else if (event.key === 'ArrowUp' && !before.includes('\n')) {
        event.preventDefault();
        this.leave(-1);
      } else if (event.key === 'ArrowDown' && !after.includes('\n')) {
        event.preventDefault();
        this.leave(1);
      }
    });
  }

  // Render `text` into the visible render if it renders; remember what is shown.
  async renderSource(text) {
    if (!this.deps.renderLive || text === this.rendered) return;
    if (await this.deps.renderLive(this.preview, text, this.node.attrs.kind)) this.rendered = text;
  }

  // Close the source and put the caret next to the block, before or after.
  leave(side) {
    this.close();
    const pos = this.getPos();
    if (pos == null) return;
    const { state } = this.view;
    const node = state.doc.nodeAt(pos);
    const at = side < 0 ? pos : pos + (node ? node.nodeSize : 0);
    const selection = PM.Selection.near(state.doc.resolve(at), side);
    this.view.dispatch(state.tr.setSelection(selection).scrollIntoView());
    this.view.focus();
  }

  close() {
    const input = this.input;
    if (!input) return;
    this.input = null;
    window.clearTimeout(this.timer);
    input.remove();
    this.dom.classList.remove('vyasa-live-atom-editing');
    if (input.value === this.node.attrs.source) return;
    const pos = this.getPos();
    if (pos == null) return;
    const tr = this.view.state.tr;
    if (input.value.trim() === '') tr.delete(pos, pos + this.node.nodeSize);
    else tr.setNodeMarkup(pos, null, { ...this.node.attrs, source: input.value });
    this.view.dispatch(tr);
  }

  update(node) {
    if (node.type !== this.node.type) return false;
    if (node.attrs.kind === 'frontmatter' && parseProperties(node.attrs.source)) return false;
    const changed = node.attrs.source !== this.node.attrs.source;
    this.node = node;
    // A source the live preview already drew needs no second render.
    if (changed && !this.input && node.attrs.source !== this.rendered) {
      this.deps.renderAtom(this.preview, node.attrs.source, node.attrs.kind);
      this.rendered = node.attrs.source;
    }
    return true;
  }

  selectNode() {
    this.dom.classList.add('vyasa-live-atom-selected');
  }

  deselectNode() {
    this.dom.classList.remove('vyasa-live-atom-selected');
  }

  stopEvent(event) {
    return Boolean(this.input && this.dom.contains(event.target)) || event.type === 'mousedown';
  }

  ignoreMutation() {
    return true;
  }
}

// Frontmatter as properties: one row per key, edited in place, drawn with the
// reading view's front matter classes. Frontmatter the rows cannot show is an
// AtomView instead; each view hands over to the other when the YAML changes.
class PropertiesView {
  constructor(node, view, getPos, deps) {
    Object.assign(this, { node, view, getPos, deps });
    // Folded like the reading view's Front Matter block, with its classes.
    const look = deps.frontmatter || {};
    this.dom = document.createElement('details');
    this.dom.className = `${look.block || 'vyasa-frontmatter-block'} vyasa-live-properties`;
    this.look = look;
    this.render();
  }

  render() {
    const parsed = parseProperties(this.node.attrs.source);
    this.parsed = parsed;
    const summary = document.createElement('summary');
    summary.className = this.look.summary || 'vyasa-frontmatter-summary';
    summary.textContent = 'Front Matter';
    this.dom.replaceChildren(summary);
    this.dom.insertAdjacentHTML(
      'beforeend',
      '<div class="vyasa-live-properties-rows"></div>' +
        '<button type="button" class="vyasa-live-properties-add">+ Add property</button>'
    );
    const rows = this.dom.querySelector('.vyasa-live-properties-rows');
    parsed.rows.forEach((row, index) => rows.appendChild(this.rowNode(row, index)));
    this.dom.querySelector('.vyasa-live-properties-add').addEventListener('click', () => {
      this.commit([...this.parsed.rows, { key: 'property', value: '', quote: '' }], this.parsed.rows.length);
    });
  }

  rowNode(row, index) {
    const line = document.createElement('div');
    line.className = 'vyasa-live-property';
    const key = document.createElement('input');
    key.className = 'vyasa-live-property-key';
    key.value = row.key;
    key.setAttribute('aria-label', 'Property name');
    const value = document.createElement('input');
    value.className = 'vyasa-live-property-value';
    value.value = row.value;
    value.setAttribute('aria-label', `Value of ${row.key}`);
    const save = () => {
      if (key.value === row.key && value.value === row.value) return;
      const rows = [...this.parsed.rows];
      // An emptied name removes the row.
      if (!key.value.trim()) rows.splice(index, 1);
      else rows[index] = { key: key.value.trim(), value: value.value, quote: row.quote };
      this.commit(rows);
    };
    [key, value].forEach((input) => {
      input.spellcheck = false;
      input.addEventListener('change', save);
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          input.blur();
        } else if (event.key === 'Escape') {
          event.preventDefault();
          key.value = row.key;
          value.value = row.value;
          this.view.focus();
        }
      });
    });
    line.append(key, value);
    return line;
  }

  commit(rows, focusRow) {
    const pos = this.getPos();
    if (pos == null) return;
    this.focusRow = focusRow;
    const source = formatProperties({ ...this.parsed, rows });
    this.view.dispatch(this.view.state.tr.setNodeMarkup(pos, null, { ...this.node.attrs, source }));
  }

  update(node) {
    if (node.type !== this.node.type || !parseProperties(node.attrs.source)) return false;
    const changed = node.attrs.source !== this.node.attrs.source;
    this.node = node;
    if (changed) {
      this.render();
      if (this.focusRow != null) this.dom.querySelectorAll('.vyasa-live-property-key')[this.focusRow]?.select();
      this.focusRow = null;
    }
    return true;
  }

  stopEvent() {
    return true;
  }

  ignoreMutation() {
    return true;
  }
}

// Position of the character after `offset` characters of `node`'s text.
function textPosition(node, start, offset) {
  let found = null;
  let seen = 0;
  node.descendants((child, pos) => {
    if (found != null || !child.isText) return found == null;
    if (seen + child.text.length >= offset) found = start + 1 + pos + (offset - seen);
    seen += child.text.length;
    return false;
  });
  return found;
}

export function createLiveEditor(mount, source, deps) {
  const schema = makeSchema(deps.classes);
  const parser = makeParser(schema);
  const built = buildDoc(source, schema, parser, deps.sourceBlocks, { title: deps.title ?? -1 });
  const serializer = makeSerializer();
  const view = new PM.EditorView(mount, {
    state: PM.EditorState.create({ doc: built.doc, plugins: plugins(schema, deps) }),
    nodeViews: {
      vyasa_block: (node, editorView, getPos) =>
        node.attrs.kind === 'frontmatter' && parseProperties(node.attrs.source)
          ? new PropertiesView(node, editorView, getPos, deps)
          : new AtomView(node, editorView, getPos, deps),
    },
    attributes: { class: 'vyasa-live-editor', spellcheck: 'true' },
    // Pasted text is markdown: a pasted link, list or table arrives formatted.
    clipboardTextParser(text) {
      const doc = parser.parse(text);
      return new PM.Slice(doc.content, 1, 1);
    },
    dispatchTransaction(tr) {
      view.updateState(view.state.apply(tr));
      if (tr.docChanged) deps.onChange();
    },
  });
  deps.openSelected = () => {
    const { selection } = view.state;
    if (selection instanceof PM.NodeSelection) view.nodeDOM(selection.from)?.dispatchEvent(new CustomEvent('vyasa:open'));
  };
  const findBlock = (index) => {
    let target = null;
    view.state.doc.forEach((child, offset) => {
      if (!target && built.origin.get(child)?.index === index) target = { child, offset };
    });
    return target;
  };
  return {
    view,
    serialize: () => serializeDoc(view.state.doc, built, serializer),
    // The top-level element of source block `index`, to line it up before the caret lands.
    blockDom(index) {
      const target = findBlock(index);
      return target ? view.nodeDOM(target.offset) : null;
    },
    // Put the caret in the block that was source block `index`: at `point`
    // (screen coordinates) when it falls inside the block, else after
    // `snippet`. An atom opens its source instead.
    focusBlock(index, snippet, point) {
      const target = findBlock(index);
      if (!target) {
        view.focus();
        return null;
      }
      const { child, offset } = target;
      // Only a hit inside the block's text counts: a point in the gap beside it
      // resolves to a block boundary, which `near` would carry into a neighbour.
      const hit = point && child.type.name !== 'vyasa_block' ? view.posAtCoords(point) : null;
      const $hit = hit && hit.pos > offset && hit.pos < offset + child.nodeSize ? view.state.doc.resolve(hit.pos) : null;
      if ($hit && $hit.parent.isTextblock) {
        view.dispatch(view.state.tr.setSelection(PM.TextSelection.create(view.state.doc, hit.pos)));
        view.focus();
        return view.nodeDOM(offset);
      }
      if (child.type.name === 'vyasa_block') {
        view.dispatch(view.state.tr.setSelection(PM.NodeSelection.create(view.state.doc, offset)));
        deps.openSelected();
        return view.nodeDOM(offset);
      }
      const text = child.textContent;
      let at = text.length;
      for (let length = Math.min(snippet.length, 32); length >= 3; length -= 1) {
        const found = text.indexOf(snippet.slice(snippet.length - length));
        if (found >= 0) {
          at = found + length;
          break;
        }
      }
      const pos = textPosition(child, offset, at) ?? offset + 1;
      view.dispatch(view.state.tr.setSelection(PM.TextSelection.create(view.state.doc, pos)));
      view.focus();
      return view.nodeDOM(offset);
    },
    destroy: () => {
      closeMenu();
      view.destroy();
    },
  };
}
