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
