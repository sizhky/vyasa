const IDENTIFIER_CHAR = /[\p{L}\p{N}_$]/u;

function symbolIndex(text, symbol, caseSensitive) {
    const source = caseSensitive ? text : text.toLocaleLowerCase();
    const needle = caseSensitive ? symbol : symbol.toLocaleLowerCase();
    let start = source.indexOf(needle);
    while (start >= 0) {
        const before = start > 0 ? source[start - 1] : '';
        const after = source[start + needle.length] || '';
        if ((!before || !IDENTIFIER_CHAR.test(before)) && (!after || !IDENTIFIER_CHAR.test(after))) {
            return start;
        }
        start = source.indexOf(needle, start + 1);
    }
    return -1;
}

export function linkPreviewSymbolMatch(href, chunks) {
    const params = new URL(href || '', 'http://vyasa.local').searchParams;
    const symbol = (params.get('symbol') || '').trim();
    const kind = (params.get('kind') || '').trim();
    if (!symbol) return null;
    for (const caseSensitive of [true, false]) {
        for (let chunkIndex = 0; chunkIndex < (chunks || []).length; chunkIndex += 1) {
            const start = symbolIndex(String(chunks[chunkIndex] || ''), symbol, caseSensitive);
            if (start >= 0) return { chunkIndex, start, end: start + symbol.length, symbol, kind };
        }
    }
    return { chunkIndex: -1, start: -1, end: -1, symbol, kind };
}
