const IDENTIFIER_CHAR = /[\p{L}\p{N}_$]/u;

const PYTHON_DEFINITIONS = {
    function: ['def', 'async def'],
    method: ['def', 'async def'],
    property: ['def', 'async def'],
    class: ['class'],
    variable: [],
};

const JS_DEFINITIONS = {
    function: ['function', 'async function', 'const', 'let', 'var'],
    method: ['function', 'async function'],
    property: ['get', 'set'],
    class: ['class'],
    variable: ['const', 'let', 'var'],
};

// Suffix to definition keywords, so each language plugs in its own words.
const DEFINITIONS_BY_SUFFIX = {
    py: PYTHON_DEFINITIONS,
    pyi: PYTHON_DEFINITIONS,
    js: JS_DEFINITIONS,
    mjs: JS_DEFINITIONS,
    cjs: JS_DEFINITIONS,
    jsx: JS_DEFINITIONS,
    ts: JS_DEFINITIONS,
    tsx: JS_DEFINITIONS,
};

function definitionKeywords(path, kind) {
    const suffix = String(path || '').split('.').pop().toLowerCase();
    const table = DEFINITIONS_BY_SUFFIX[suffix];
    return (table && table[String(kind || '').toLocaleLowerCase()]) || [];
}

function symbolIndexes(text, symbol, caseSensitive) {
    const source = caseSensitive ? text : text.toLocaleLowerCase();
    const needle = caseSensitive ? symbol : symbol.toLocaleLowerCase();
    const found = [];
    let start = source.indexOf(needle);
    while (start >= 0) {
        const before = start > 0 ? source[start - 1] : '';
        const after = source[start + needle.length] || '';
        if ((!before || !IDENTIFIER_CHAR.test(before)) && (!after || !IDENTIFIER_CHAR.test(after))) {
            found.push(start);
        }
        start = source.indexOf(needle, start + 1);
    }
    return found;
}

function leadsDefinition(text, start, keywords) {
    const lineStart = text.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
    const before = text.slice(lineStart, start).trimEnd();
    return keywords.some((keyword) => before === keyword || before.endsWith(` ${keyword}`));
}

function isDefinition(text, hit, path, kind, keywords) {
    if (keywords.length && leadsDefinition(text, hit.start, keywords)) return true;
    const suffix = String(path || '').split('.').pop().toLowerCase();
    const pythonAssignmentKinds = ['variable', 'property'];
    if (!['py', 'pyi'].includes(suffix) || !pythonAssignmentKinds.includes(String(kind || '').toLowerCase())) return false;
    const nextBreak = text.indexOf('\n', hit.end);
    const after = text.slice(hit.end, nextBreak < 0 ? text.length : nextBreak).trimStart();
    return /^(?::[^=]+)?=/.test(after);
}

function withLineBounds(hit, text) {
    if (!hit) return hit;
    const lineStart = text.lastIndexOf('\n', Math.max(0, hit.start - 1)) + 1;
    const nextBreak = text.indexOf('\n', hit.end);
    return { ...hit, lineStart, lineEnd: nextBreak < 0 ? text.length : nextBreak };
}

function searchSymbol(list, symbol, path, keywords, kind) {
    let fallback = null;
    for (const caseSensitive of [true, false]) {
        for (let chunkIndex = 0; chunkIndex < list.length; chunkIndex += 1) {
            const text = String(list[chunkIndex] || '');
            for (const start of symbolIndexes(text, symbol, caseSensitive)) {
                const hit = withLineBounds(
                    { chunkIndex, start, end: start + symbol.length, symbol, kind },
                    text,
                );
                if (isDefinition(text, hit, path, kind, keywords)) {
                    return { definition: hit, fallback };
                }
                if (!fallback) fallback = hit;
            }
        }
    }
    return { definition: null, fallback };
}

export function linkPreviewHashMatch(href, ids) {
    const hash = new URL(href || '', 'http://vyasa.local').hash.slice(1);
    if (!hash) return null;
    let fragment = hash;
    try { fragment = decodeURIComponent(hash); } catch (_) {}
    const folded = fragment.toLocaleLowerCase();
    return (ids || []).find((id) => String(id).toLocaleLowerCase() === folded) || null;
}

export function linkPreviewLineNumber(href) {
    const url = new URL(href || '', 'http://vyasa.local');
    let path = url.pathname;
    try { path = decodeURIComponent(path); } catch (_) {}
    const suffix = path.match(/:(\d+)(?::\d+)?$/);
    const line = Number(suffix?.[1]);
    return Number.isSafeInteger(line) && line > 0 ? line : null;
}

export function linkPreviewCodeLineHref(relativePath, line) {
    const encodedPath = String(relativePath || '').split('/').map(encodeURIComponent).join('/');
    const sourceLine = Number(line);
    if (!encodedPath || !Number.isSafeInteger(sourceLine) || sourceLine < 1) return '';
    return `/posts/${encodedPath}%3A${sourceLine}`;
}

export function linkPreviewLineMatch(href, chunks) {
    const line = linkPreviewLineNumber(href);
    if (!line) return null;
    let remaining = line;
    for (let chunkIndex = 0; chunkIndex < (chunks || []).length; chunkIndex += 1) {
        const text = String(chunks[chunkIndex] || '');
        const lines = text.split('\n');
        if (remaining <= lines.length) {
            const lineStart = lines.slice(0, remaining - 1).reduce((total, value) => total + value.length + 1, 0);
            return { chunkIndex, lineStart, lineEnd: lineStart + lines[remaining - 1].length, line };
        }
        remaining -= lines.length;
    }
    return null;
}

export function linkPreviewSymbolMatch(href, chunks) {
    const url = new URL(href || '', 'http://vyasa.local');
    const symbol = (url.searchParams.get('symbol') || '').trim();
    const kind = (url.searchParams.get('kind') || '').trim();
    if (!symbol) return null;
    const keywords = definitionKeywords(url.pathname, kind);
    const list = chunks || [];
    // A dotted symbol such as NL2SQLDeps.rows is never written whole at the
    // definition, so fall back to its last segment.
    const names = symbol.includes('.') ? [symbol, symbol.split('.').pop()] : [symbol];
    let fallback = null;
    for (const name of names) {
        if (!name) continue;
        const found = searchSymbol(list, name, url.pathname, keywords, kind);
        if (found.definition) return found.definition;
        if (!fallback) fallback = found.fallback;
    }
    return fallback || { chunkIndex: -1, start: -1, end: -1, symbol, kind };
}
