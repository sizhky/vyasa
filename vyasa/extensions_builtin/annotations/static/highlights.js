// Reader highlights: one list per page path, kept only in this browser's localStorage.
export const HIGHLIGHT_KEY_PREFIX = 'vyasa.highlights.v1:';
// Order is the toolbar order; the first colour is the default for entries saved before colours existed.
export const HIGHLIGHT_COLORS = ['yellow', 'green', 'blue', 'pink'];

/**
 * Overlap of a selection anchor with stored highlights.
 *   overlapping([{id:'a', quote:'x', anchor:{start:0,end:5}}], {start:4,end:9}, 'y') -> ['a']
 *   overlapping([{id:'a', quote:'x', anchor:null}], null, 'x') -> ['a']
 */
export function overlapping(items, anchor, quote) {
    return items.filter((item) => {
        if (anchor && item.anchor) return item.anchor.start < anchor.end && anchor.start < item.anchor.end;
        return item.quote === quote;
    }).map((item) => item.id);
}

/**
 * Store bound to one path; storage errors (private mode, quota) read as an empty list.
 *   store.add({quote, anchor, color}) -> item; store.list() -> [item]; store.remove([id]); store.recolor([id], 'blue')
 */
export function createHighlightStore(path, storage) {
    const key = `${HIGHLIGHT_KEY_PREFIX}${path}`;
    const list = () => {
        try {
            const items = JSON.parse(storage?.getItem(key) || '[]');
            if (!Array.isArray(items)) return [];
            return items
                .filter((item) => typeof item?.id === 'string' && typeof item.quote === 'string')
                .map((item) => ({ ...item, color: HIGHLIGHT_COLORS.includes(item.color) ? item.color : HIGHLIGHT_COLORS[0] }));
        } catch (_) { return []; }
    };
    const write = (items) => {
        if (!storage) return false;
        try {
            if (items.length) storage.setItem(key, JSON.stringify(items));
            else storage.removeItem(key);
            return true;
        } catch (_) { return false; }
    };
    const add = ({ quote, anchor = null, color = HIGHLIGHT_COLORS[0] }) => {
        const item = { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, quote, anchor, color };
        return write([...list(), item]) ? item : null;
    };
    const remove = (ids) => write(list().filter((item) => !ids.includes(item.id)));
    const recolor = (ids, color) => write(list().map((item) => ids.includes(item.id) ? { ...item, color } : item));
    return { list, add, remove, recolor };
}
