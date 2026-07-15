const shortcutOwners = new Set();
let floatingActionSync = () => {};
let markdownHydrator = () => {};

export function setShortcutsSuspended(owner, suspended) {
    if (suspended) shortcutOwners.add(owner);
    else shortcutOwners.delete(owner);
}

export function shortcutsSuspended() {
    return shortcutOwners.size > 0;
}

export function isEditableShortcutEvent(event) {
    return event.composedPath().some((node) => (
        node instanceof Element
        && (node.matches('input, textarea, select') || node.isContentEditable)
    ));
}

export function ensureFloatingActions() {
    let rail = document.getElementById('vyasa-floating-actions');
    if (rail) return rail;
    rail = document.createElement('div');
    rail.id = 'vyasa-floating-actions';
    rail.className = 'vyasa-floating-actions';
    document.body.appendChild(rail);
    return rail;
}

export function registerFloatingActionSync(handler) {
    floatingActionSync = handler;
}

export function syncFloatingActions() {
    floatingActionSync();
}

export function registerMarkdownHydrator(handler) {
    markdownHydrator = handler;
}

export function hydrateMarkdown(root) {
    markdownHydrator(root);
}
