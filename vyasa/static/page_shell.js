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

export function headingMarkdownCopyValue(headings, targetIndex, includeParents = false, prefix = '') {
    const target = headings[targetIndex];
    if (!target) return '';
    const markdown = ({ level, text }) => `${'#'.repeat(level)} ${text.trim()}`;
    if (!includeParents) return [prefix.trim(), markdown(target)].filter(Boolean).join(' > ');
    const path = [];
    headings.slice(0, targetIndex + 1).forEach((heading) => {
        while (path.length && path.at(-1).level >= heading.level) path.pop();
        path.push(heading);
    });
    return [prefix.trim(), ...path.map(markdown)].filter(Boolean).join(' > ');
}

function decodeCopyPayload(encoded) {
    if (!encoded) return '';
    return new TextDecoder().decode(Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0)));
}

// Every DocumentPage stamps its on-disk path into #main-content. Zen slides render
// their own layout, so fall back to the Copy Path button there. Both are already in
// the page, so a caller needs no extra request and this works in a static build.
export function documentAbsolutePath() {
    const stamped = document.querySelector('#main-content [data-vyasa-file-path]')?.dataset.vyasaFilePath;
    if (stamped) return stamped;
    return decodeCopyPayload(document.querySelector('[data-copy-alternate-payload]')?.dataset.copyAlternatePayload);
}

// A markdown blockquote of the selected text, with the document path under it, so a
// paste into notes carries its source. Same prefix idea as headingMarkdownCopyValue.
export function quoteMarkdownCopyValue(text, prefix = '') {
    const quote = (text || '').trim().split('\n').map((line) => `> ${line.trim()}`.trimEnd()).join('\n');
    return [quote, prefix.trim()].filter(Boolean).join('\n\n');
}

// The held-key motion model behind J/K document scroll: hold to accelerate to a
// ceiling, release to coast out under friction. Shared so graph pan and zoom feel
// like the page scroll instead of growing a second set of numbers.
export const MOMENTUM_DEFAULTS = {
    initialSpeed: 0.24,
    maxSpeed: 1.4,
    acceleration: 0.0025,
    friction: 0.012,
    minSpeed: 0.02,
    restartFactor: 0.35,
};

// step(distance) moves the thing and returns false when it cannot move further,
// which ends the coast. stepStatic(direction) is the reduced-motion single hop.
export function createMomentumRunner({ step, stepStatic, onStop, ...overrides } = {}) {
    const config = { ...MOMENTUM_DEFAULTS, ...overrides };
    let frame = null;
    let direction = 0;
    let velocity = 0;
    let lastTime = null;

    function stop() {
        if (frame !== null) window.cancelAnimationFrame(frame);
        frame = null;
        direction = 0;
        velocity = 0;
        lastTime = null;
        onStop?.();
    }

    function animate(now) {
        const elapsed = lastTime === null ? 16 : Math.min(32, now - lastTime);
        lastTime = now;
        if (direction) {
            const speed = Math.min(config.maxSpeed, Math.max(config.initialSpeed, Math.abs(velocity) + config.acceleration * elapsed));
            velocity = direction * speed;
        } else {
            velocity *= Math.exp(-config.friction * elapsed);
            if (Math.abs(velocity) < config.minSpeed) return stop();
        }
        if (step(velocity * elapsed) === false) return stop();
        frame = window.requestAnimationFrame(animate);
    }

    return {
        start(nextDirection) {
            if (!nextDirection) return;
            if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                stepStatic?.(nextDirection);
                return;
            }
            if (direction !== nextDirection) velocity = nextDirection * Math.max(config.initialSpeed, Math.abs(velocity) * config.restartFactor);
            direction = nextDirection;
            if (frame === null) frame = window.requestAnimationFrame(animate);
        },
        // Drop the drive but keep the coast. Ignores a stale key release.
        release(forDirection) {
            if (forDirection === undefined || forDirection === direction) direction = 0;
        },
        stop,
    };
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
