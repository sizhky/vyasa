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

function searchSymbol(list, symbol, keywords, kind) {
    let fallback = null;
    for (const caseSensitive of [true, false]) {
        for (let chunkIndex = 0; chunkIndex < list.length; chunkIndex += 1) {
            const text = String(list[chunkIndex] || '');
            for (const start of symbolIndexes(text, symbol, caseSensitive)) {
                const hit = { chunkIndex, start, end: start + symbol.length, symbol, kind };
                if (keywords.length && leadsDefinition(text, start, keywords)) {
                    return { definition: hit, fallback };
                }
                if (!fallback) fallback = hit;
            }
        }
    }
    return { definition: null, fallback };
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
        const found = searchSymbol(list, name, keywords, kind);
        if (found.definition) return found.definition;
        if (!fallback) fallback = found.fallback;
    }
    return fallback || { chunkIndex: -1, start: -1, end: -1, symbol, kind };
}
