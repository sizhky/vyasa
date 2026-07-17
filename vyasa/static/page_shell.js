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

export function ensureShortcutHelp({ title, groups }) {
    const rail = ensureFloatingActions();
    let launcher = document.getElementById('vyasa-shortcuts-launcher');
    let panel = document.getElementById('vyasa-shortcuts');
    if (!launcher) {
        launcher = document.createElement('button');
        launcher.id = 'vyasa-shortcuts-launcher';
        launcher.type = 'button';
        launcher.className = 'vyasa-floating-bubble vyasa-shortcuts-launcher';
        launcher.textContent = '?';
        launcher.setAttribute('aria-keyshortcuts', '?');
        rail.prepend(launcher);
    }
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'vyasa-shortcuts';
        panel.className = 'vyasa-shortcuts hidden';
        document.body.appendChild(panel);
    }
    launcher.title = `${title} (?)`;
    launcher.setAttribute('aria-label', title);
    const card = document.createElement('div');
    card.className = 'vyasa-shortcuts-card';
    card.append(Object.assign(document.createElement('h2'), { textContent: title }));
    groups.forEach(([group, rows]) => {
        const section = document.createElement('section');
        section.append(Object.assign(document.createElement('small'), { textContent: group }));
        rows.forEach(([keys, label]) => {
            const row = document.createElement('div');
            row.append(Object.assign(document.createElement('kbd'), { textContent: keys }), Object.assign(document.createElement('span'), { textContent: label }));
            section.append(row);
        });
        card.append(section);
    });
    panel.replaceChildren(card);
    const close = () => panel.classList.add('hidden');
    const toggle = () => panel.classList.toggle('hidden');
    launcher._shortcutHelpClose = close;
    launcher._shortcutHelpToggle = toggle;
    launcher.onclick = toggle;
    panel.onclick = (event) => { if (event.target === panel) close(); };
    if (launcher.dataset.shortcutHelpBound !== 'true') {
        launcher.dataset.shortcutHelpBound = 'true';
        document.addEventListener('keydown', (event) => {
            if (event.defaultPrevented || isEditableShortcutEvent(event)) return;
            const control = document.getElementById('vyasa-shortcuts-launcher');
            if (event.key === '?') { event.preventDefault(); control?._shortcutHelpToggle?.(); }
            if (event.key === 'Escape') control?._shortcutHelpClose?.();
        });
    }
    return { close, toggle };
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
