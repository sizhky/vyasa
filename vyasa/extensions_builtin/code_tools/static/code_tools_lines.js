export function highlightedLineFragments(nodes, createFragment, createText) {
    const lines = [createFragment()];
    const append = (text, ancestors) => {
        let parent = lines.at(-1);
        ancestors.forEach((ancestor) => {
            const clone = ancestor.cloneNode(false);
            parent.append(clone);
            parent = clone;
        });
        if (text) parent.append(createText(text));
    };
    const visit = (node, ancestors = []) => {
        if (node.nodeType === 3) {
            node.textContent.split('\n').forEach((part, index) => {
                if (index) lines.push(createFragment());
                append(part, ancestors);
            });
            return;
        }
        [...node.childNodes].forEach((child) => visit(child, [...ancestors, node]));
    };
    nodes.forEach((node) => visit(node));
    return lines;
}

// A line-state or line-number spec is "3-5:added,9:deleted" or "1:12,2:13".
// Both map a rendered line number to one value.
export function codeLineSpecMap(spec) {
    const map = new Map();
    for (const part of String(spec || '').split(',')) {
        const item = part.trim();
        if (!item) continue;
        const separator = item.lastIndexOf(':');
        if (separator < 1) continue;
        const [first, last] = item.slice(0, separator).split('-').map(Number);
        const value = item.slice(separator + 1);
        if (!Number.isFinite(first)) continue;
        const end = Number.isFinite(last) ? last : first;
        for (let line = first; line <= end; line += 1) map.set(line, value);
    }
    return map;
}

export const CODE_LINE_STATE_LABELS = {
    added: 'added line',
    deleted: 'deleted line',
    context: 'context line',
};
