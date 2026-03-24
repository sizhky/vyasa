import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
import { D2 } from 'https://esm.sh/@terrastruct/d2@0.1.33?bundle';

const mermaidStates = {};
const d2States = {};
let excalidrawLibPromise = null;

async function getExcalidrawLib() {
    if (!excalidrawLibPromise) {
        excalidrawLibPromise = Promise.all([
            import('https://esm.sh/react@18'),
            import('https://esm.sh/react-dom@18/client'),
            import('https://esm.sh/@excalidraw/excalidraw@0.17.6?bundle'),
        ]);
    }
    return excalidrawLibPromise;
}

async function saveExcalidrawScene(host, status) {
    const saveUrl = host?.getAttribute('data-excalidraw-save-url');
    const scene = host?.__excalidrawState;
    if (!host || !saveUrl || !scene) {
        return;
    }
    try {
        const appState = { ...(scene.appState || {}) };
        if (typeof appState.collaborators?.forEach !== 'function') appState.collaborators = [];
        const payload = {
            type: 'excalidraw',
            version: 2,
            source: 'vyasa',
            elements: scene.elements || [],
            appState,
            files: scene.files || {},
        };
        const res = await fetch(saveUrl, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (error) {
        console.error('[vyasa][excalidraw] save failed', error);
    }
}

function applyExcalidrawEditMode(host, button) {
    const editable = !!host?.__excalidrawEditable;
    if (host?.__excalidrawApi?.updateScene && host?.__excalidrawState?.appState) {
        host.__excalidrawApi.updateScene({
            appState: { ...host.__excalidrawState.appState, viewModeEnabled: !editable },
        });
    }
    if (button) button.textContent = editable ? 'Disable editing' : 'Enable editing';
    updateExcalidrawIdentityLabel(host);
}

function randomExcalidrawName() {
    const a = ['Swift', 'Quiet', 'Bold', 'Curious', 'Bright', 'Calm', 'Brave', 'Clever', 'Witty', 'Sly', 'Nimble', 'Mighty', 'Gentle', 'Fierce', 'Loyal', 'Wise', 'Happy', 'Grumpy', 'Sleepy', 'Dopey', 'Zany', 'Jolly', 'Lucky', 'Silly', 'Charming', 'Daring', 'Elegant', 'Fancy', 'Gleaming', 'Heroic', 'Inventive', 'Jovial', 'Kindly', 'Lively', 'Merry', 'Noble', 'Playful', 'Quick', 'Radiant', 'Shy', 'Tough', 'Upbeat', 'Vibrant', 'Wandering', 'Xenial', 'Youthful', 'Zealous', 'Adventurous', 'Bright-eyed', 'Cheerful', 'Dazzling', 'Energetic', 'Fearless', 'Gallant', 'Humble', 'Imaginative', 'Joyful', 'Keen', 'Luminous', 'Majestic', 'Nimble-fingered', 'Optimistic', 'Passionate', 'Quick-witted', 'Resilient', 'Spirited', 'Tenacious', 'Unstoppable', 'Valiant', 'Whimsical', 'Xtraordinary', 'Youthful-at-heart', 'Zesty'];
    const b = ['Otter', 'Falcon', 'Fox', 'Panda', 'Lynx', 'Hawk', 'Wolf', 'Tiger', 'Eagle', 'Bear', 'Shark', 'Dolphin', 'Raven', 'Leopard', 'Panther', 'Cheetah', 'Gorilla', 'Koala', 'Squirrel', 'Rabbit', 'Deer', 'Moose', 'Buffalo', 'Alligator', 'Crocodile', 'Turtle', 'Frog', 'Snake', 'Horse', 'Donkey', 'Zebra', 'Giraffe', 'Elephant', 'Rhino', 'Hippo', 'Armadillo', 'Badger', 'Beaver', 'Camel', 'Chameleon', 'Chipmunk', 'Cougar', 'Crab', 'Crow', 'Ferret', 'Gazelle', 'Gerbil', 'Goat', 'Gopher', 'Guinea Pig', 'Hamster', 'Hedgehog', 'Ibex', 'Jackal', 'Jerboa', 'Kangaroo', 'Koala', 'Lemur', 'Meerkat', 'Mongoose', 'Mule', 'Ocelot', 'Octopus', 'Orangutan', 'Owl', 'Porcupine', 'Prairie Dog', 'Quokka', 'Raccoon', 'Rat', 'Reindeer', 'Salamander', 'Sea Lion', 'Skunk', 'Sloth', 'Swan', 'Tapir', 'Vole', 'Wombat'];
    return `${a[Math.floor(Math.random() * a.length)]} ${b[Math.floor(Math.random() * b.length)]}`;
}

function updateExcalidrawIdentityLabel(host) {
    if (!host) return;
    const button = document.querySelector(`[data-excalidraw-name="${host.id}"]`);
    if (!button) return;
    const name = host.__excalidrawUserName || 'Guest';
    button.textContent = `${host.__excalidrawEditable ? 'Editing' : 'Viewing'} as ${name}`;
}

function initExcalidrawName(rootElement = document) {
    const buttons = Array.from(rootElement.querySelectorAll('[data-excalidraw-name]'));
    buttons.forEach((button) => {
        if (button.dataset.excalidrawNameBound === 'true') return;
        button.dataset.excalidrawNameBound = 'true';
        const hostId = button.getAttribute('data-excalidraw-name');
        const host = hostId ? document.getElementById(hostId) : null;
        if (!host) return;
        const locked = button.getAttribute('data-excalidraw-name-locked') === '1';
        const room = host.getAttribute('data-excalidraw-path') || hostId;
        const defaultName = button.getAttribute('data-excalidraw-name-default') || '';
        const key = `vyasa.excalidraw.name.${room}`;
        let name = defaultName || localStorage.getItem(key) || '';
        if (!name && !locked) name = randomExcalidrawName();
        if (!locked && name) localStorage.setItem(key, name);
        host.__excalidrawUserName = name || 'Guest';
        updateExcalidrawIdentityLabel(host);
        if (locked) return;
        button.addEventListener('click', () => {
            const current = host.__excalidrawUserName || '';
            const next = window.prompt('Your display name', current);
            if (!next) return;
            const cleaned = next.trim();
            if (!cleaned) return;
            host.__excalidrawUserName = cleaned;
            localStorage.setItem(key, cleaned);
            updateExcalidrawIdentityLabel(host);
        });
    });
}

function connectExcalidrawCollab(host) {
    const room = host?.getAttribute('data-excalidraw-path');
    if (!room || host.__excalidrawWs) return;
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${window.location.host}/ws/excalidraw/${room}`);
    const localId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    host.__excalidrawWs = ws;
    host.__excalidrawWsId = localId;
    host.__excalidrawPeers = new Map();
    if (!host.__excalidrawPeerGcTimer) {
        host.__excalidrawPeerGcTimer = setInterval(() => {
            const now = Date.now();
            for (const [id, peer] of host.__excalidrawPeers.entries()) {
                if (now - (peer.lastSeen || 0) > 4000) host.__excalidrawPeers.delete(id);
            }
            host.__excalidrawApi?.updateScene({ collaborators: new Map(host.__excalidrawPeers) });
        }, 2000);
    }
    ws.onmessage = (evt) => {
        try {
            const msg = JSON.parse(evt.data || '{}');
            if (msg.type === 'presence_remove' && msg.id) {
                host.__excalidrawPeers.delete(msg.id);
                host.__excalidrawApi?.updateScene({ collaborators: new Map(host.__excalidrawPeers) });
                return;
            }
            if (msg.type === 'presence' && msg.presence?.id && host.__excalidrawApi) {
                if (msg.presence.id === localId) return;
                const remotePointer = msg.presence.pointer || null;
                const isLaser = remotePointer?.tool === 'laser';
                host.__excalidrawPeers.set(msg.presence.id, {
                    username: msg.presence.username || 'Guest',
                    pointer: remotePointer,
                    button: msg.presence.button || 'up',
                    selectedElementIds: {},
                    renderCursor: !isLaser,
                    lastSeen: Date.now(),
                });
                host.__excalidrawApi.updateScene({ collaborators: new Map(host.__excalidrawPeers) });
                return;
            }
            if (msg.type !== 'scene' || !msg.scene || !host.__excalidrawApi) return;
            if (msg.from && msg.from === localId) return;
            host.__excalidrawApplyingRemote = true;
            host.__excalidrawSkipUntil = Date.now() + 180;
            host.__excalidrawState = {
                ...host.__excalidrawState,
                elements: msg.scene.elements || [],
                files: msg.scene.files || {},
            };
            host.__excalidrawApi.updateScene({
                elements: msg.scene.elements || [],
                files: msg.scene.files || {},
            });
            setTimeout(() => { host.__excalidrawApplyingRemote = false; }, 200);
        } catch (e) {
            console.error('[vyasa][collab] bad message', e);
        }
    };
}

async function initExcalidrawHosts(rootElement = document) {
    const hosts = Array.from(rootElement.querySelectorAll('.excalidraw-host'));
    for (const host of hosts) {
        if (host.dataset.excalidrawMounted === 'true') continue;
        host.dataset.excalidrawMounted = 'true';
        const src = host.getAttribute('data-excalidraw-src');
        const status = document.getElementById(`${host.id}-status`);
        try {
            const [ReactNS, ReactDOMNS, ExcalidrawNS] = await getExcalidrawLib();
            const React = ReactNS.default || ReactNS;
            const ReactDOMClient = ReactDOMNS.default || ReactDOMNS;
            const ExcalidrawComp =
                ExcalidrawNS.Excalidraw ||
                ExcalidrawNS.default?.Excalidraw ||
                ExcalidrawNS.default;
            if (!ExcalidrawComp || typeof ReactDOMClient.createRoot !== 'function') {
                throw new Error('Excalidraw module shape is unsupported');
            }
            const scene = src ? await fetch(src).then((r) => r.json()) : { elements: [], appState: {}, files: {} };
            const appState = scene.appState || {};
            if (typeof appState.collaborators?.forEach !== 'function') {
                appState.collaborators = [];
            }
            const sceneState = {
                type: 'excalidraw',
                version: 2,
                source: 'vyasa',
                elements: scene.elements || [],
                appState: { ...appState, viewModeEnabled: true },
                files: scene.files || {},
            };
            host.__excalidrawState = sceneState;
            host.__excalidrawEditable = false;
            host.__excalidrawAutosaveTimer = null;
            connectExcalidrawCollab(host);
            const root = ReactDOMClient.createRoot(host);
            const element = React.createElement(ExcalidrawComp, {
                initialData: sceneState,
                theme: getCurrentTheme() === 'dark' ? 'dark' : 'light',
                excalidrawAPI: (api) => {
                    host.__excalidrawApi = api;
                    applyExcalidrawEditMode(host, document.querySelector(`[data-excalidraw-toggle="${host.id}"]`));
                },
                onChange: (elements, appState, files) => {
                    host.__excalidrawState = { ...sceneState, elements, appState, files };
                    if (!host.__excalidrawEditable) return;
                    if (host.__excalidrawApplyingRemote || Date.now() < (host.__excalidrawSkipUntil || 0)) return;
                    if (host.__excalidrawWs?.readyState === WebSocket.OPEN) {
                        host.__excalidrawWs.send(JSON.stringify({
                            type: 'scene',
                            from: host.__excalidrawWsId,
                            scene: { elements: host.__excalidrawState.elements || [], files: host.__excalidrawState.files || {} },
                        }));
                    }
                    if (host.__excalidrawAutosaveTimer) clearTimeout(host.__excalidrawAutosaveTimer);
                    host.__excalidrawAutosaveTimer = setTimeout(() => {
                        saveExcalidrawScene(host, status);
                    }, 700);
                },
                onPointerUpdate: ({ pointer, button }) => {
                    if (!host.__excalidrawWs || host.__excalidrawWs.readyState !== WebSocket.OPEN) return;
                    const now = Date.now();
                    if (now - (host.__excalidrawPresenceTs || 0) < 50) return;
                    host.__excalidrawPresenceTs = now;
                    host.__excalidrawWs.send(JSON.stringify({
                        type: 'presence',
                        presence: {
                            id: host.__excalidrawWsId,
                            username: host.__excalidrawUserName || 'Guest',
                            pointer: pointer ? { x: pointer.x, y: pointer.y, tool: pointer.tool || 'pointer' } : null,
                            button: button || 'up',
                        },
                    }));
                },
            });
            root.render(element);
            if (status) status.textContent = 'Loaded';
        } catch (error) {
            if (status) status.textContent = 'Failed to load';
            console.error('[vyasa][excalidraw] mount failed', error);
        }
    }
}

function initExcalidrawSave(rootElement = document) {
    const buttons = Array.from(rootElement.querySelectorAll('[data-excalidraw-toggle]'));
    buttons.forEach((button) => {
        if (button.dataset.excalidrawSaveBound === 'true') return;
        button.dataset.excalidrawSaveBound = 'true';
        button.addEventListener('click', async () => {
            const hostId = button.getAttribute('data-excalidraw-toggle');
            const host = hostId ? document.getElementById(hostId) : null;
            if (!host) return;
            if (!host.__excalidrawEditable && host.getAttribute('data-excalidraw-protected') === '1') {
                const unlockUrl = host.getAttribute('data-excalidraw-unlock-url');
                if (unlockUrl) {
                    const password = prompt('Enter drawing password to enable editing:');
                    if (password === null) return;
                    try {
                        const resp = await fetch(unlockUrl, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ password }),
                        });
                        if (!resp.ok) {
                            alert('Invalid drawing password.');
                            return;
                        }
                    } catch (err) {
                        console.error('[vyasa][excalidraw] unlock failed', err);
                        alert('Could not verify drawing password.');
                        return;
                    }
                }
            }
            host.__excalidrawEditable = !host.__excalidrawEditable;
            applyExcalidrawEditMode(host, button);
        });
    });
}

function initExcalidrawOpenExternal(rootElement = document) {
    const buttons = Array.from(rootElement.querySelectorAll('[data-excalidraw-open-external]'));
    buttons.forEach((button) => {
        if (button.dataset.excalidrawOpenBound === 'true') return;
        button.dataset.excalidrawOpenBound = 'true';
        button.addEventListener('click', () => {
            const downloadUrl = button.getAttribute('data-excalidraw-download-url');
            const downloadName = button.getAttribute('data-excalidraw-download-name') || 'drawing.excalidraw';
            window.open('https://excalidraw.com', '_blank', 'noopener');
            if (!downloadUrl) return;
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = downloadName;
            document.body.appendChild(a);
            a.click();
            a.remove();
        });
    });
}

function initExcalidrawExternalOpen(rootElement = document) {
    const buttons = Array.from(rootElement.querySelectorAll('[data-excalidraw-open-external]'));
    buttons.forEach((button) => {
        if (button.dataset.excalidrawOpenBound === 'true') return;
        button.dataset.excalidrawOpenBound = 'true';
        button.addEventListener('click', () => {
            const downloadUrl = button.getAttribute('data-excalidraw-download-url');
            const downloadName = button.getAttribute('data-excalidraw-download-name') || 'drawing.excalidraw';
            if (downloadUrl) {
                const a = document.createElement('a');
                a.href = downloadUrl;
                a.download = downloadName;
                document.body.appendChild(a);
                a.click();
                a.remove();
            }
            window.open('https://excalidraw.com', '_blank', 'noopener');
        });
    });
}
const mermaidDebugEnabled = () => (
    window.VYASA_DEBUG_MERMAID === true ||
    localStorage.getItem('vyasaDebugMermaid') === '1'
);
const d2DebugEnabled = () => (
    window.VYASA_DEBUG_D2 === true ||
    localStorage.getItem('vyasaDebugD2') === '1'
);
const d2DebugLog = (...args) => {
    if (d2DebugEnabled()) {
        console.log('[vyasa][d2]', ...args);
    }
};
const mermaidDebugLog = (...args) => {
    if (mermaidDebugEnabled()) {
        console.log('[vyasa][mermaid]', ...args);
    }
};
const mermaidDebugSnapshot = (label) => {
    if (!mermaidDebugEnabled()) {
        return;
    }
    const wrappers = Array.from(document.querySelectorAll('.mermaid-wrapper'));
    const withSvg = wrappers.filter(w => w.querySelector('svg'));
    const interactive = wrappers.filter(w => w.dataset.mermaidInteractive === 'true');
    const last = wrappers[wrappers.length - 1];
    let lastRect = null;
    if (last) {
        const rect = last.getBoundingClientRect();
        lastRect = {
            id: last.id,
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            hasSvg: !!last.querySelector('svg'),
            interactive: last.dataset.mermaidInteractive === 'true'
        };
    }
    mermaidDebugLog(label, {
        total: wrappers.length,
        withSvg: withSvg.length,
        interactive: interactive.length,
        last: lastRect
    });
};
const GANTT_WIDTH = 1200;
let d2InstancePromise = null;

function getD2Instance() {
    if (!d2InstancePromise) {
        d2InstancePromise = Promise.resolve(new D2());
    }
    return d2InstancePromise;
}

function decodeHtmlEntities(value) {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = value;
    return textarea.value;
}

function normalizeD2SvgForBrowser(svg) {
    // Work around D2 animation script collisions that can emit duplicate
    // declarations like `const htmlElement` and break execution in-page.
    return svg.replace(/\b(?:const|let)\s+htmlElement\b/g, 'var htmlElement');
}

function coerceD2RenderToSvgMarkup(renderResult) {
    if (typeof renderResult === 'string') {
        return renderResult;
    }
    if (renderResult instanceof Uint8Array) {
        return new TextDecoder().decode(renderResult);
    }
    if (Array.isArray(renderResult)) {
        for (const item of renderResult) {
            try {
                const svg = coerceD2RenderToSvgMarkup(item);
                if (svg && svg.includes('<svg')) {
                    return svg;
                }
            } catch {
                // Keep trying other entries.
            }
        }
    }
    if (renderResult && typeof renderResult === 'object') {
        if (typeof renderResult.svg === 'string') {
            return renderResult.svg;
        }
        if (renderResult.data && typeof renderResult.data === 'string') {
            return renderResult.data;
        }
        if (typeof renderResult.markup === 'string') {
            return renderResult.markup;
        }
        for (const value of Object.values(renderResult)) {
            if (typeof value === 'string' && value.includes('<svg')) {
                return value;
            }
            if (value && typeof value === 'object') {
                try {
                    const nested = coerceD2RenderToSvgMarkup(value);
                    if (nested && nested.includes('<svg')) {
                        return nested;
                    }
                } catch {
                    // Continue checking other keys.
                }
            }
        }
    }
    throw new TypeError(`Unsupported D2 render result type: ${typeof renderResult}`);
}

function rehydrateScripts(container) {
    const scripts = Array.from(container.querySelectorAll('script'));
    scripts.forEach((oldScript) => {
        const newScript = document.createElement('script');
        Array.from(oldScript.attributes).forEach((attr) => {
            newScript.setAttribute(attr.name, attr.value);
        });
        newScript.textContent = oldScript.textContent || '';
        oldScript.replaceWith(newScript);
    });
}

function activateSvgAnimations(container) {
    const svg = container.querySelector('svg');
    if (!svg) {
        return;
    }
    try {
        if (typeof svg.unpauseAnimations === 'function') {
            svg.unpauseAnimations();
        }
        if (typeof svg.setCurrentTime === 'function') {
            svg.setCurrentTime(0);
        }
    } catch (error) {
        d2DebugLog('activateSvgAnimations error', error);
    }
}

function setD2ControlsEnabled(wrapper, enabled) {
    const container = wrapper.closest('.d2-container');
    if (!container) {
        return;
    }
    const controls = container.querySelector('.d2-controls');
    if (!controls) {
        return;
    }
    controls.querySelectorAll('button').forEach((button) => {
        button.disabled = !enabled;
        button.style.opacity = enabled ? '1' : '0.5';
        button.style.cursor = enabled ? 'pointer' : 'not-allowed';
    });
}

function ensureD2PanzoomStage(wrapper) {
    let stage = wrapper.querySelector('.d2-panzoom-stage');
    if (stage) {
        return stage;
    }
    const svg = wrapper.querySelector('svg');
    if (!svg) {
        return null;
    }
    stage = document.createElement('div');
    stage.className = 'd2-panzoom-stage w-full h-full flex items-center justify-center';
    stage.style.transformOrigin = 'center center';
    svg.replaceWith(stage);
    stage.appendChild(svg);
    return stage;
}

function isDarkModeActive() {
    return document.documentElement.classList.contains('dark');
}

function parseOptionalNumber(value) {
    if (value === null || value === undefined || value === '') {
        return undefined;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
}

function parseOptionalBoolean(value) {
    if (value === null || value === undefined || value === '') {
        return undefined;
    }
    const normalized = String(value).trim().toLowerCase();
    if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
        return true;
    }
    if (normalized === 'false' || normalized === '0' || normalized === 'no') {
        return false;
    }
    return undefined;
}

function normalizeD2Target(value) {
    if (value === null || value === undefined) {
        return undefined;
    }
    const trimmed = String(value).trim();
    if (trimmed === '""' || trimmed === "''" || trimmed === '') {
        // D2 multi-board target uses wildcard patterns (e.g. layers.x.*).
        // Treat empty target as wildcard-all for composition animation.
        return '*';
    }
    return trimmed;
}

function hasD2SubstitutionBraceError(error) {
    return String(error).includes('substitutions must begin on {');
}

function escapeBareD2SubstitutionDollars(source) {
    // D2 treats `$` as the start of a substitution. Escape bare dollars so
    // values like "$100" or shell snippets don't fail parsing.
    let escaped = '';
    for (let i = 0; i < source.length; i += 1) {
        const char = source[i];
        if (char !== '$') {
            escaped += char;
            continue;
        }
        const previous = source[i - 1];
        const next = source[i + 1];
        if (previous === '\\' || next === '{') {
            escaped += '$';
            continue;
        }
        escaped += '\\$';
    }
    return escaped;
}

function replaceBareD2SubstitutionDollarsWithFullwidth(source) {
    let replaced = '';
    for (let i = 0; i < source.length; i += 1) {
        const char = source[i];
        if (char !== '$') {
            replaced += char;
            continue;
        }
        const next = source[i + 1];
        if (next === '{') {
            replaced += '$';
            continue;
        }
        replaced += '＄';
    }
    return replaced;
}

async function renderD2Diagrams(rootElement = document) {
    const wrappers = Array.from(rootElement.querySelectorAll('.d2-wrapper'));
    if (!wrappers.length) {
        return;
    }
    const totalStart = performance.now();
    let d2;
    try {
        const loadStart = performance.now();
        d2 = await getD2Instance();
        d2DebugLog('library ready', { wrappers: wrappers.length, ms: performance.now() - loadStart });
    } catch (error) {
        console.error('Failed to initialize D2 renderer', error);
        return;
    }
    for (const wrapper of wrappers) {
        const source = wrapper.getAttribute('data-d2-code');
        if (!source) {
            continue;
        }
        const decodedSource = decodeHtmlEntities(source);
        if (wrapper.id) {
            delete d2States[wrapper.id];
            delete wrapper.dataset.d2Interactive;
        }
        try {
            const layout = wrapper.getAttribute('data-d2-layout') || 'elk';
            const themeId = parseOptionalNumber(wrapper.getAttribute('data-d2-theme-id'));
            const darkThemeId = parseOptionalNumber(wrapper.getAttribute('data-d2-dark-theme-id'));
            const sketch = parseOptionalBoolean(wrapper.getAttribute('data-d2-sketch'));
            const pad = parseOptionalNumber(wrapper.getAttribute('data-d2-pad'));
            const scale = parseOptionalNumber(wrapper.getAttribute('data-d2-scale'));
            const target = wrapper.getAttribute('data-d2-target');
            const animateInterval = parseOptionalNumber(wrapper.getAttribute('data-d2-animate-interval'));
            const animate = parseOptionalBoolean(wrapper.getAttribute('data-d2-animate'));

            const compileOptions = {};
            compileOptions.layout = layout;
            if (sketch !== undefined) {
                compileOptions.sketch = sketch;
            }
            // For compositions, target selection must happen at compile-time.
            const normalizedTarget = normalizeD2Target(target);
            if (normalizedTarget !== undefined) {
                compileOptions.target = normalizedTarget;
            }

            let result;
            try {
                const compileStart = performance.now();
                result = await d2.compile(decodedSource, compileOptions);
                d2DebugLog('compile complete', { id: wrapper.id, ms: performance.now() - compileStart });
            } catch (compileError) {
                if (!hasD2SubstitutionBraceError(compileError)) {
                    throw compileError;
                }
                const escapedSource = escapeBareD2SubstitutionDollars(decodedSource);
                const fullwidthSource = replaceBareD2SubstitutionDollarsWithFullwidth(decodedSource);
                if (escapedSource === decodedSource && fullwidthSource === decodedSource) {
                    throw compileError;
                }
                d2DebugLog('retrying compile after normalizing bare $ substitutions', {
                    id: wrapper.id,
                    sourcePreview: decodedSource.slice(0, 120)
                });
                try {
                    result = await d2.compile(escapedSource, compileOptions);
                } catch (secondCompileError) {
                    if (!hasD2SubstitutionBraceError(secondCompileError)) {
                        throw secondCompileError;
                    }
                    result = await d2.compile(fullwidthSource, compileOptions);
                    result.__vyasaFullwidthDollarFallback = true;
                }
            }
            const renderOptions = { ...(result.renderOptions || result.options || {}) };
            if (themeId !== undefined) {
                renderOptions.themeID = themeId;
            }
            if (darkThemeId !== undefined) {
                renderOptions.darkThemeID = darkThemeId;
            }
            if (themeId !== undefined || darkThemeId !== undefined) {
                const activeThemeId = isDarkModeActive()
                    ? (darkThemeId !== undefined ? darkThemeId : themeId)
                    : (themeId !== undefined ? themeId : darkThemeId);
                if (activeThemeId !== undefined) {
                    renderOptions.themeID = activeThemeId;
                }
            }
            if (pad !== undefined) {
                renderOptions.pad = pad;
            }
            if (scale !== undefined) {
                renderOptions.scale = scale;
            }
            if (normalizedTarget !== undefined) {
                renderOptions.target = normalizedTarget;
            }
            if (animateInterval !== undefined) {
                renderOptions.animateInterval = animateInterval;
            } else if (animate === true) {
                renderOptions.animateInterval = 1200;
            }
            // D2 compositions need target="" + animateInterval>0 to emit animated multi-board SVG.
            // If user requests animation but omits target, default to all boards.
            if (
                renderOptions.animateInterval > 0 &&
                (renderOptions.target === undefined || renderOptions.target === null)
            ) {
                renderOptions.target = '*';
            }
            if (
                renderOptions.animateInterval > 0 &&
                (compileOptions.target === undefined || compileOptions.target === null)
            ) {
                compileOptions.target = '*';
            }
            const isAnimated = Number(renderOptions.animateInterval || 0) > 0;
            wrapper.dataset.d2Animated = isAnimated ? 'true' : 'false';
            setD2ControlsEnabled(wrapper, true);
            d2DebugLog('render options', {
                id: wrapper.id,
                layout: compileOptions.layout,
                sketch: compileOptions.sketch,
                compileTarget: compileOptions.target,
                themeID: renderOptions.themeID,
                darkThemeID: renderOptions.darkThemeID,
                target: renderOptions.target,
                animateInterval: renderOptions.animateInterval
            });
            const renderStart = performance.now();
            const rawRenderResult = await d2.render(result.diagram, renderOptions);
            d2DebugLog('render complete', { id: wrapper.id, ms: performance.now() - renderStart });
            const svgMarkup = coerceD2RenderToSvgMarkup(rawRenderResult);
            let normalizedSvg = normalizeD2SvgForBrowser(svgMarkup);
            if (result.__vyasaFullwidthDollarFallback) {
                normalizedSvg = normalizedSvg.replaceAll('＄', '$');
            }
            const hydrateStart = performance.now();
            wrapper.innerHTML = normalizedSvg;
            rehydrateScripts(wrapper);
            activateSvgAnimations(wrapper);
            ensureD2PanzoomStage(wrapper);
            wrapper.dataset.d2Rendered = 'true';
            d2DebugLog('svg hydrated', { id: wrapper.id, ms: performance.now() - hydrateStart });
            const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            d2DebugLog('rendered', {
                id: wrapper.id,
                animated: normalizedSvg.includes('animation') || normalizedSvg.includes('@keyframes'),
                hasHtmlElementScript: normalizedSvg.includes('htmlElement'),
                hasScriptTag: normalizedSvg.includes('<script'),
                hasSmilAnimateTag: normalizedSvg.includes('<animate'),
                prefersReducedMotion
            });
        } catch (error) {
            console.error('Failed to render D2 diagram', error);
            if (d2DebugEnabled()) {
                d2DebugLog('render failure details', {
                    id: wrapper.id,
                    error: String(error),
                    sourcePreview: decodedSource.slice(0, 120)
                });
            }
        }
    }
    d2DebugLog('renderD2Diagrams complete', { wrappers: wrappers.length, ms: performance.now() - totalStart });
    initD2Interaction(rootElement);
}

function initD2Interaction(rootElement = document) {
    const wrappers = Array.from(rootElement.querySelectorAll('.d2-wrapper'));
    wrappers.forEach((wrapper) => {
        const svg = wrapper.querySelector('svg');
        const stage = ensureD2PanzoomStage(wrapper);
        const inReveal = !!wrapper.closest('.reveal');
        if (!svg || !stage || wrapper.dataset.d2Interactive === 'true') {
            return;
        }
        if (inReveal) {
            stage.style.transform = 'none';
            stage.style.transformOrigin = 'center center';
            stage.style.display = 'flex';
            stage.style.justifyContent = 'center';
            stage.style.alignItems = 'center';
            svg.style.display = 'block';
            svg.style.margin = '0 auto';
        }

        const wrapperRect = wrapper.getBoundingClientRect();
        const svgRect = svg.getBoundingClientRect();
        if (!svgRect.width || !svgRect.height) {
            return;
        }
        const scaleX = (wrapperRect.width - 32) / svgRect.width;
        const scaleY = (wrapperRect.height - 32) / svgRect.height;
        const aspectRatio = svgRect.width / svgRect.height;
        const maxUpscale = 1;
        let initialScale = aspectRatio > 3
            ? Math.min(scaleX, maxUpscale)
            : Math.min(scaleX, scaleY, maxUpscale);
        if (inReveal) {
            try {
                const vb = (svg.getAttribute('viewBox') || '').trim().split(/\s+/).map(Number);
                const box = svg.getBBox ? svg.getBBox() : null;
                if (vb.length === 4 && box && box.width > 1 && box.height > 1) {
                    const vbW = vb[2];
                    const vbH = vb[3];
                    if (Number.isFinite(vbW) && Number.isFinite(vbH) && vbW > 1 && vbH > 1) {
                        const fitFromBounds = Math.min(vbW / box.width, vbH / box.height);
                        if (Number.isFinite(fitFromBounds) && fitFromBounds > 1) {
                            initialScale = Math.min(fitFromBounds * 0.92, 6);
                        } else {
                            initialScale = 1;
                        }
                    } else {
                        initialScale = 1;
                    }
                } else {
                    initialScale = 1;
                }
            } catch (_) {
                initialScale = 1;
            }
        }

        const state = {
            scale: initialScale,
            translateX: 0,
            translateY: 0,
            isPanning: false,
            startX: 0,
            startY: 0
        };
        d2States[wrapper.id] = state;
        wrapper.dataset.d2Interactive = 'true';

        const getSvg = () => wrapper.querySelector('svg');
        const getStage = () => wrapper.querySelector('.d2-panzoom-stage');
        const applyState = () => {
            const currentStage = getStage();
            if (!currentStage) {
                return;
            }
            const currentSvg = getSvg();
            if (currentSvg) {
                currentSvg.style.pointerEvents = 'none';
            }
            currentStage.style.transform = `translate(${state.translateX}px, ${state.translateY}px) scale(${state.scale})`;
            currentStage.style.transformOrigin = 'center center';
        };
        applyState();

        wrapper.style.cursor = 'grab';
        wrapper.style.touchAction = 'none';

        wrapper.addEventListener('wheel', (e) => {
            e.preventDefault();
            const currentStage = getStage();
            if (!currentStage) {
                return;
            }
            const rect = currentStage.getBoundingClientRect();
            const mouseX = e.clientX - rect.left - rect.width / 2;
            const mouseY = e.clientY - rect.top - rect.height / 2;
            const zoomIntensity = 0.01;
            const delta = e.deltaY > 0 ? 1 - zoomIntensity : 1 + zoomIntensity;
            const newScale = Math.min(Math.max(0.1, state.scale * delta), 55);
            const scaleFactor = newScale / state.scale - 1;
            state.translateX -= mouseX * scaleFactor;
            state.translateY -= mouseY * scaleFactor;
            state.scale = newScale;
            applyState();
        }, { passive: false });

        wrapper.addEventListener('pointerdown', (e) => {
            if (e.pointerType === 'mouse' && e.button !== 0) {
                return;
            }
            state.isPanning = true;
            state.startX = e.clientX - state.translateX;
            state.startY = e.clientY - state.translateY;
            wrapper.setPointerCapture(e.pointerId);
            wrapper.style.cursor = 'grabbing';
            e.preventDefault();
        });

        wrapper.addEventListener('pointermove', (e) => {
            if (!state.isPanning) {
                return;
            }
            state.translateX = e.clientX - state.startX;
            state.translateY = e.clientY - state.startY;
            applyState();
        });

        const stopPanning = (e) => {
            if (!state.isPanning) {
                return;
            }
            state.isPanning = false;
            try {
                wrapper.releasePointerCapture(e.pointerId);
            } catch {
                // Ignore if pointer capture is not active.
            }
            wrapper.style.cursor = 'grab';
        };

        wrapper.addEventListener('pointerup', stopPanning);
        wrapper.addEventListener('pointercancel', stopPanning);
    });
}

window.resetD2Zoom = function(id) {
    const state = d2States[id];
    const wrapper = document.getElementById(id);
    if (!state || !wrapper) {
        return;
    }
    state.scale = 1;
    state.translateX = 0;
    state.translateY = 0;
    const stage = wrapper.querySelector('.d2-panzoom-stage');
    if (stage) {
        stage.style.transform = 'translate(0px, 0px) scale(1)';
    }
};

window.zoomD2In = function(id) {
    const state = d2States[id];
    const wrapper = document.getElementById(id);
    if (!state || !wrapper) {
        return;
    }
    state.scale = Math.min(state.scale * 1.1, 10);
    const stage = wrapper.querySelector('.d2-panzoom-stage');
    if (stage) {
        stage.style.transform = `translate(${state.translateX}px, ${state.translateY}px) scale(${state.scale})`;
    }
};

window.zoomD2Out = function(id) {
    const state = d2States[id];
    const wrapper = document.getElementById(id);
    if (!state || !wrapper) {
        return;
    }
    state.scale = Math.max(state.scale * 0.9, 0.1);
    const stage = wrapper.querySelector('.d2-panzoom-stage');
    if (stage) {
        stage.style.transform = `translate(${state.translateX}px, ${state.translateY}px) scale(${state.scale})`;
    }
};

window.openD2Fullscreen = async function(id) {
    const wrapper = document.getElementById(id);
    if (!wrapper) return;

    const originalCode = wrapper.getAttribute('data-d2-code');
    if (!originalCode) return;
    const fullscreenTitle = wrapper.getAttribute('data-d2-fullscreen-title') || 'D2 Diagram';

    const existing = document.getElementById('d2-fullscreen-modal');
    if (existing) {
        existing.remove();
    }

    const modal = document.createElement('div');
    modal.id = 'd2-fullscreen-modal';
    modal.className = 'fixed inset-0 z-[10000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4';
    modal.style.animation = 'fadeIn 0.2s ease-in';

    const modalContent = document.createElement('div');
    modalContent.className = 'relative bg-white dark:bg-slate-900 rounded-lg shadow-2xl w-full h-full max-w-[95vw] max-h-[95vh] flex flex-col';

    const header = document.createElement('div');
    header.className = 'flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700';

    const title = document.createElement('h3');
    title.className = 'text-lg font-semibold text-slate-800 dark:text-slate-200';
    title.textContent = fullscreenTitle;

    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '✕';
    closeBtn.className = 'px-3 py-1 text-xl text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors';
    closeBtn.title = 'Close (Esc)';
    closeBtn.onclick = () => document.body.removeChild(modal);

    header.appendChild(title);
    header.appendChild(closeBtn);

    const diagramContainer = document.createElement('div');
    diagramContainer.className = 'flex-1 overflow-auto p-4 flex items-center justify-center';

    const fullscreenWrapper = document.createElement('div');
    fullscreenWrapper.className = 'd2-wrapper w-full h-full overflow-hidden flex items-center justify-center';
    fullscreenWrapper.id = `${id}-fullscreen`;
    fullscreenWrapper.setAttribute('data-d2-code', originalCode);
    Array.from(wrapper.attributes).forEach((attr) => {
        if (attr.name.startsWith('data-d2-') && attr.name !== 'data-d2-code') {
            fullscreenWrapper.setAttribute(attr.name, attr.value);
        }
    });
    fullscreenWrapper.style.minHeight = '80vh';
    fullscreenWrapper.style.height = '80vh';

    const pre = document.createElement('pre');
    pre.className = 'd2';
    pre.style.width = '100%';
    pre.style.height = '100%';
    pre.style.display = 'flex';
    pre.style.alignItems = 'center';
    pre.style.justifyContent = 'center';
    pre.textContent = decodeHtmlEntities(originalCode);
    fullscreenWrapper.appendChild(pre);

    diagramContainer.appendChild(fullscreenWrapper);
    modalContent.appendChild(header);
    modalContent.appendChild(diagramContainer);
    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    });

    const escHandler = (e) => {
        if (e.key === 'Escape' && document.getElementById('d2-fullscreen-modal')) {
            document.body.removeChild(modal);
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);

    await renderD2Diagrams(modal);
};

function handleCodeCopyClick(event) {
    const button = event.target.closest('.code-copy-button, .hljs-copy-button');
    if (!button) {
        return;
    }
    event.preventDefault();
    event.stopPropagation();
    const container = button.closest('.code-block') || button.closest('pre') || button.parentElement;
    const textarea = container ? container.querySelector('textarea[id$="-clipboard"]') : null;
    let text = '';
    if (textarea && textarea.value) {
        text = textarea.value;
    } else {
        const codeEl = (container && container.querySelector('pre > code')) ||
            (container && container.querySelector('code')) ||
            button.closest('pre');
        if (!codeEl) {
            return;
        }
        text = codeEl.innerText || codeEl.textContent || '';
    }
    const showToast = () => {
        let toast = document.getElementById('code-copy-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'code-copy-toast';
            toast.className = 'fixed top-6 right-6 z-[10000] text-xs bg-slate-900 text-white px-3 py-2 rounded shadow-lg opacity-0 transition-opacity duration-300';
            toast.textContent = 'Copied';
            document.body.appendChild(toast);
        }
        toast.classList.remove('opacity-0');
        toast.classList.add('opacity-100');
        setTimeout(() => {
            toast.classList.remove('opacity-100');
            toast.classList.add('opacity-0');
        }, 1400);
    };
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(showToast).catch(() => {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.setAttribute('readonly', '');
            textarea.style.position = 'absolute';
            textarea.style.left = '-9999px';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            showToast();
        });
    } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'absolute';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showToast();
    }
}

document.addEventListener('click', handleCodeCopyClick, true);

function switchTab(tabsId, index) {
    const container = document.querySelector(`.tabs-container[data-tabs-id="${tabsId}"]`);
    if (!container) return;
    const buttons = container.querySelectorAll('.tab-button');
    buttons.forEach((btn, i) => btn.classList.toggle('active', i === index));
    const panels = container.querySelectorAll('.tab-panel');
    panels.forEach((panel, i) => {
        const active = i === index;
        panel.classList.toggle('active', active);
        panel.style.position = active ? 'relative' : 'absolute';
        panel.style.visibility = active ? 'visible' : 'hidden';
        panel.style.opacity = active ? '1' : '0';
        panel.style.pointerEvents = active ? 'auto' : 'none';
    });
    const activePanel = container.querySelector(`.tab-panel[data-tab-index="${index}"]`);
    if (activePanel) {
        const mermaidNodes = Array.from(activePanel.querySelectorAll('pre.mermaid'));
        if (mermaidNodes.length > 0) {
            mermaid.run({ nodes: mermaidNodes }).then(() => scheduleMermaidInteraction()).catch(() => {});
        } else {
            scheduleMermaidInteraction();
        }
        renderD2Diagrams(activePanel);
    }
    if (window.refreshVyasaTableScrollShadows) {
        requestAnimationFrame(() => window.refreshVyasaTableScrollShadows(container));
    }
}
window.switchTab = switchTab;

function initTabPanelHeights(rootElement = document) {
    const containers = rootElement.querySelectorAll('.tabs-container');
    containers.forEach((container) => {
        const panels = container.querySelectorAll('.tab-panel');
        let maxHeight = 0;
        panels.forEach((panel) => {
            const wasActive = panel.classList.contains('active');
            panel.style.position = 'relative';
            panel.style.visibility = 'visible';
            panel.style.opacity = '1';
            panel.style.pointerEvents = 'auto';
            maxHeight = Math.max(maxHeight, panel.offsetHeight);
            if (!wasActive) {
                panel.style.position = 'absolute';
                panel.style.visibility = 'hidden';
                panel.style.opacity = '0';
                panel.style.pointerEvents = 'none';
            }
        });
        const tabsContent = container.querySelector('.tabs-content');
        if (tabsContent && maxHeight > 0) tabsContent.style.minHeight = `${maxHeight}px`;
    });
}

function refreshVyasaTableScrollShadows(root = document) {
    const scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll('.vyasa-table-scroll').forEach((el) => {
        const table = el.querySelector('table');
        const parentWidth = el.parentElement ? el.parentElement.clientWidth : el.clientWidth;
        const tableWidth = table ? table.scrollWidth : el.scrollWidth;
        const needsBreakout = tableWidth > (parentWidth + 1);
        const viewportCap = Math.floor(window.innerWidth * 0.8);
        el.classList.toggle('vyasa-table-breakout', needsBreakout);
        if (needsBreakout) el.style.setProperty('--vyasa-breakout-width', `${Math.min(tableWidth, viewportCap)}px`);
        else el.style.removeProperty('--vyasa-breakout-width');
        const maxScrollLeft = Math.max(0, el.scrollWidth - el.clientWidth);
        el.classList.toggle('has-left-overflow', maxScrollLeft > 1 && el.scrollLeft > 1);
        el.classList.toggle('has-right-overflow', maxScrollLeft > 1 && el.scrollLeft < (maxScrollLeft - 1));
        if (el.dataset.shadowBound === '1') return;
        el.dataset.shadowBound = '1';
        el.addEventListener('scroll', () => refreshVyasaTableScrollShadows(el.parentElement || document), { passive: true });
    });
}

window.refreshVyasaTableScrollShadows = refreshVyasaTableScrollShadows;

function initMermaidInteraction() {
    const wrappers = Array.from(document.querySelectorAll('.mermaid-wrapper'));
    if (mermaidDebugEnabled()) {
        const pending = wrappers.filter(w => !w.querySelector('svg'));
        const last = wrappers[wrappers.length - 1];
        mermaidDebugLog('initMermaidInteraction: total', wrappers.length, 'pending', pending.length);
        if (last) {
            mermaidDebugLog('initMermaidInteraction: last wrapper', last.id, 'hasSvg', !!last.querySelector('svg'));
        }
    }
    wrappers.forEach((wrapper, idx) => {
        const wrapperRect = wrapper.getBoundingClientRect();
        if (wrapperRect.width < 8 || wrapperRect.height < 8) return;
        const svg = wrapper.querySelector('svg');
        const inReveal = !!wrapper.closest('.reveal');
        const alreadyInteractive = wrapper.dataset.mermaidInteractive === 'true';
        if (mermaidDebugEnabled()) {
            mermaidDebugLog(
                'initMermaidInteraction: wrapper',
                idx,
                wrapper.id,
                'hasSvg',
                !!svg,
                'interactive',
                alreadyInteractive
            );
        }
        const getSvg = () => wrapper.querySelector('svg');
        const applySvgState = (currentSvg) => {
            if (!currentSvg) {
                return;
            }
            currentSvg.style.pointerEvents = 'none';
            currentSvg.style.transform = `translate(${state.translateX}px, ${state.translateY}px) scale(${state.scale})`;
            currentSvg.style.transformOrigin = 'center center';
        };
        if (svg) {
            svg.style.pointerEvents = 'none';
        }
        if (!svg || alreadyInteractive) return;
        if (inReveal) {
            svg.style.display = 'block';
            svg.style.margin = '0 auto';
            svg.style.transformOrigin = 'center center';
        }
        
        // Scale SVG to fit container (maintain aspect ratio, fit to width or height whichever is smaller)
        const svgRect = svg.getBoundingClientRect();
        const viewBox = (svg.getAttribute('viewBox') || '').trim().split(/\s+/).map(Number);
        let bbox = null;
        try {
            bbox = svg.getBBox ? svg.getBBox() : null;
        } catch {
            bbox = null;
        }
        const hasStableViewBox = viewBox.length === 4 && viewBox[2] > 1 && viewBox[3] > 1;
        const hasStableBBox = !!bbox && bbox.width > 1 && bbox.height > 1;
        const isLayoutUnstable = (
            wrapperRect.height < 120 ||
            svgRect.height < 30 ||
            (!hasStableViewBox && !hasStableBBox) ||
            (svgRect.width < 30 && !hasStableViewBox && !hasStableBBox)
        );
        if (isLayoutUnstable) {
            if (mermaidDebugEnabled()) {
                mermaidDebugLog('skip initMermaidInteraction: reveal layout not stable', {
                    id: wrapper.id,
                    wrapperWidth: wrapperRect.width,
                    wrapperHeight: wrapperRect.height,
                    svgWidth: svgRect.width,
                    svgHeight: svgRect.height,
                    viewBox,
                    bbox
                });
            }
            return;
        }
        const innerWidth = Math.max(wrapperRect.width - 32, 1);   // 32 for p-4 padding
        const innerHeight = Math.max(wrapperRect.height - 32, 1);
        const scaleX = innerWidth / Math.max(svgRect.width, 1);
        const scaleY = innerHeight / Math.max(svgRect.height, 1);
        
        // For very wide diagrams (like Gantt charts), prefer width scaling even if it exceeds height
        const aspectRatio = svgRect.width / svgRect.height;
        const maxUpscale = 1;
        let initialScale;
        if (aspectRatio > 3) {
            // Wide diagram: scale to fit width, but do not upscale by default
            initialScale = Math.min(scaleX, maxUpscale);
        } else {
            // Normal diagram: fit to smaller dimension, but do not upscale by default
            initialScale = Math.min(scaleX, scaleY, maxUpscale);
        }
        if (!Number.isFinite(initialScale) || initialScale <= 0) {
            // Hidden/unstable layout (e.g., Reveal transition state) can yield tiny or negative sizes.
            // Skip now and let a later ready/slidechanged pass initialize interaction.
            if (mermaidDebugEnabled()) {
                mermaidDebugLog('skip initMermaidInteraction: unstable scale', {
                    id: wrapper.id, wrapperRect, svgRect, scaleX, scaleY, initialScale
                });
            }
            return;
        }

        if (mermaidDebugEnabled()) {
            mermaidDebugLog('initMermaidInteraction: sizing', {
                id: wrapper.id,
                wrapperWidth: wrapperRect.width,
                wrapperHeight: wrapperRect.height,
                svgWidth: svgRect.width,
                svgHeight: svgRect.height,
                initialScale
            });
        }
        
        const state = {
            scale: initialScale,
            translateX: 0,
            translateY: 0,
            isPanning: false,
            startX: 0,
            startY: 0
        };
        mermaidStates[wrapper.id] = state;
        wrapper.dataset.mermaidInteractive = 'true';
        if (mermaidDebugEnabled() && !wrapper.dataset.mermaidDebugBound) {
            wrapper.dataset.mermaidDebugBound = 'true';
            const logEvent = (name, event) => {
                const target = event.target && event.target.tagName ? event.target.tagName : 'unknown';
                mermaidDebugLog(`${name} on ${wrapper.id}`, { type: event.type, target });
            };
            wrapper.addEventListener('pointerdown', (e) => logEvent('pointerdown', e));
            wrapper.addEventListener('pointermove', (e) => logEvent('pointermove', e));
            wrapper.addEventListener('pointerup', (e) => logEvent('pointerup', e));
            wrapper.addEventListener('wheel', (e) => logEvent('wheel', e));
        }
        
        function updateTransform() {
            applySvgState(getSvg());
        }
        
        // Apply initial scale
        updateTransform();

        if (!wrapper.dataset.mermaidObserver) {
            const observer = new MutationObserver(() => {
                applySvgState(getSvg());
            });
            observer.observe(wrapper, { childList: true, subtree: true });
            wrapper.dataset.mermaidObserver = 'true';
        }
        
        // Mouse wheel zoom (zooms towards cursor position)
        wrapper.addEventListener('wheel', (e) => {
            e.preventDefault();
            
            const currentSvg = getSvg();
            if (!currentSvg) {
                return;
            }
            const rect = currentSvg.getBoundingClientRect();
            
            // Mouse position relative to SVG's current position
            const mouseX = e.clientX - rect.left - rect.width / 2;
            const mouseY = e.clientY - rect.top - rect.height / 2;
            
            const zoomIntensity = 0.01;
            const delta = e.deltaY > 0 ? 1 - zoomIntensity : 1 + zoomIntensity; // Zoom out or in speed
            const newScale = Math.min(Math.max(0.1, state.scale * delta), 55);
            
            // Calculate how much to adjust translation to keep point under cursor fixed
            // With center origin, we need to account for the scale change around center
            const scaleFactor = newScale / state.scale - 1;
            state.translateX -= mouseX * scaleFactor;
            state.translateY -= mouseY * scaleFactor;
            state.scale = newScale;
            
            updateTransform();
        }, { passive: false });
        
        // Pan with pointer drag (mouse + touch)
        wrapper.style.cursor = 'grab';
        wrapper.style.touchAction = 'none';
        wrapper.addEventListener('pointerdown', (e) => {
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            state.isPanning = true;
            state.startX = e.clientX - state.translateX;
            state.startY = e.clientY - state.translateY;
            wrapper.setPointerCapture(e.pointerId);
            wrapper.style.cursor = 'grabbing';
            e.preventDefault();
        });
        
        wrapper.addEventListener('pointermove', (e) => {
            if (!state.isPanning) return;
            state.translateX = e.clientX - state.startX;
            state.translateY = e.clientY - state.startY;
            updateTransform();
            if (mermaidDebugEnabled()) {
                mermaidDebugLog('pan update', wrapper.id, {
                    translateX: state.translateX,
                    translateY: state.translateY,
                    scale: state.scale,
                    svgTransform: (getSvg() && getSvg().style.transform) || ''
                });
            }
        });
        
        const stopPanning = (e) => {
            if (!state.isPanning) return;
            state.isPanning = false;
            try {
                wrapper.releasePointerCapture(e.pointerId);
            } catch {
                // Ignore if pointer capture is not active
            }
            wrapper.style.cursor = 'grab';
        };
        
        wrapper.addEventListener('pointerup', stopPanning);
        wrapper.addEventListener('pointercancel', stopPanning);
    });
}

function scheduleMermaidInteraction({ maxAttempts = 12, delayMs = 80, onReady } = {}) {
    let attempt = 0;
    const check = () => {
        const wrappers = Array.from(document.querySelectorAll('.mermaid-wrapper'));
        const pending = wrappers.filter(wrapper => !wrapper.querySelector('svg'));
        if (mermaidDebugEnabled()) {
            const last = wrappers[wrappers.length - 1];
            mermaidDebugLog('scheduleMermaidInteraction attempt', attempt, 'pending', pending.length);
            if (last) {
                mermaidDebugLog('scheduleMermaidInteraction last wrapper', last.id, 'hasSvg', !!last.querySelector('svg'));
            }
        }
        if (pending.length === 0 || attempt >= maxAttempts) {
            initMermaidInteraction();
            if (typeof onReady === 'function') {
                onReady();
            }
            return;
        }
        attempt += 1;
        setTimeout(check, delayMs);
    };
    check();
}

window.resetMermaidZoom = function(id) {
    const state = mermaidStates[id];
    if (state) {
        state.scale = 1;
        state.translateX = 0;
        state.translateY = 0;
        const svg = document.getElementById(id).querySelector('svg');
        svg.style.transform = 'translate(0px, 0px) scale(1)';
    }
};

window.zoomMermaidIn = function(id) {
    const state = mermaidStates[id];
    if (state) {
        state.scale = Math.min(state.scale * 1.1, 10);
        const svg = document.getElementById(id).querySelector('svg');
        svg.style.transform = `translate(${state.translateX}px, ${state.translateY}px) scale(${state.scale})`;
    }
};

window.zoomMermaidOut = function(id) {
    const state = mermaidStates[id];
    if (state) {
        state.scale = Math.max(state.scale * 0.9, 0.1);
        const svg = document.getElementById(id).querySelector('svg');
        svg.style.transform = `translate(${state.translateX}px, ${state.translateY}px) scale(${state.scale})`;
    }
};

window.openMermaidFullscreen = function(id) {
    const wrapper = document.getElementById(id);
    if (!wrapper) return;
    
    const originalCode = wrapper.getAttribute('data-mermaid-code');
    if (!originalCode) return;
    const mermaidTitle = wrapper.getAttribute('data-mermaid-title') || 'Diagram';
    
    // Decode HTML entities
    const textarea = document.createElement('textarea');
    textarea.innerHTML = originalCode;
    const code = textarea.value;
    
    // Create modal
    const modal = document.createElement('div');
    modal.id = 'mermaid-fullscreen-modal';
    modal.className = 'fixed inset-0 z-[10000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4';
    modal.style.animation = 'fadeIn 0.2s ease-in';
    
    // Create modal content container
    const modalContent = document.createElement('div');
    modalContent.className = 'relative bg-white dark:bg-slate-900 rounded-lg shadow-2xl w-full h-full max-w-[95vw] max-h-[95vh] flex flex-col';
    
    // Create header with close button
    const header = document.createElement('div');
    header.className = 'flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700';
    
    const title = document.createElement('h3');
    title.className = 'text-lg font-semibold text-slate-800 dark:text-slate-200';
    title.textContent = mermaidTitle;
    
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '✕';
    closeBtn.className = 'px-3 py-1 text-xl text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors';
    closeBtn.title = 'Close (Esc)';
    closeBtn.onclick = () => document.body.removeChild(modal);
    
    header.appendChild(title);
    header.appendChild(closeBtn);
    
    // Create diagram container
    const diagramContainer = document.createElement('div');
    diagramContainer.className = 'flex-1 overflow-auto p-4 flex items-center justify-center';
    
    const fullscreenId = `${id}-fullscreen`;
    const fullscreenWrapper = document.createElement('div');
    fullscreenWrapper.id = fullscreenId;
    fullscreenWrapper.className = 'mermaid-wrapper w-full h-full flex items-center justify-center';
    fullscreenWrapper.setAttribute('data-mermaid-code', originalCode);
    
    const pre = document.createElement('pre');
    pre.className = 'mermaid';
    pre.textContent = code;
    fullscreenWrapper.appendChild(pre);
    
    diagramContainer.appendChild(fullscreenWrapper);
    
    // Assemble modal
    modalContent.appendChild(header);
    modalContent.appendChild(diagramContainer);
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
    
    // Close on Esc key
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            document.body.removeChild(modal);
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);
    
    // Close on background click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
            document.removeEventListener('keydown', escHandler);
        }
    });
    
    // Render mermaid in the fullscreen view
    mermaid.run({ nodes: [pre] }).then(() => {
        setTimeout(() => initMermaidInteraction(), 100);
    });
};

function getCurrentTheme() {
    return document.documentElement.classList.contains('dark') ? 'dark' : 'default';
}

function getDynamicGanttWidth() {
    // Check if any mermaid wrapper has custom gantt width
    const wrappers = document.querySelectorAll('.mermaid-wrapper[data-gantt-width]');
    if (wrappers.length > 0) {
        // Use the first custom width found, or max width if multiple
        const widths = Array.from(wrappers).map(w => parseInt(w.getAttribute('data-gantt-width')) || GANTT_WIDTH);
        return Math.max(...widths);
    }
    return GANTT_WIDTH;
}

function reinitializeMermaid() {
    // Skip if this is the initial load (let it render naturally first)
    if (isInitialLoad) {
        return;
    }
    
    const dynamicWidth = getDynamicGanttWidth();
    
    mermaid.initialize({ 
        startOnLoad: false,
        theme: getCurrentTheme(),
        fontSize: 16,
        flowchart: {
            htmlLabels: false
        },
        gantt: {
            useWidth: dynamicWidth,
            useMaxWidth: false
        }
    });
    
    // Find all mermaid wrappers and re-render them
    const shouldLockHeight = (wrapper) => {
        const height = (wrapper.style.height || '').trim();
        return height && height !== 'auto' && height !== 'initial' && height !== 'unset';
    };

    document.querySelectorAll('.mermaid-wrapper').forEach(wrapper => {
        const originalCode = wrapper.getAttribute('data-mermaid-code');
        if (originalCode) {
            // Preserve the current computed height before clearing (height should already be set explicitly)
            if (shouldLockHeight(wrapper)) {
                const currentHeight = wrapper.getBoundingClientRect().height;
                wrapper.style.height = currentHeight + 'px';
            }
            
            // Delete the old state so it can be recreated
            delete mermaidStates[wrapper.id];
            delete wrapper.dataset.mermaidInteractive;
            
            // Decode HTML entities
            const textarea = document.createElement('textarea');
            textarea.innerHTML = originalCode;
            const code = textarea.value;
            
            // Clear the wrapper
            wrapper.innerHTML = '';
            
            // Re-add the pre element with mermaid code
            const newPre = document.createElement('pre');
            newPre.className = 'mermaid';
            newPre.textContent = code;
            wrapper.appendChild(newPre);
        }
    });
    
    // Re-run mermaid
    mermaid.run().then(() => {
        scheduleMermaidInteraction({
            onReady: () => {}
        });
    });
}

const initialGanttWidth = getDynamicGanttWidth();

mermaid.initialize({ 
    startOnLoad: false,
    theme: getCurrentTheme(),
    fontSize: 16,
    flowchart: {
        htmlLabels: false
    },
    gantt: {
        useWidth: initialGanttWidth,
        useMaxWidth: false
    }
});

// Track if this is the initial load
let isInitialLoad = true;

// Initialize interaction after mermaid renders
document.addEventListener('DOMContentLoaded', () => {
    mermaidDebugSnapshot('before mermaid.run (DOMContentLoaded)');
    mermaid.run().then(() => {
        mermaidDebugSnapshot('after mermaid.run (DOMContentLoaded)');
        scheduleMermaidInteraction({
            onReady: () => {
                // After initial render, set explicit heights on all wrappers so theme switching works
                const shouldLockHeight = (wrapper) => {
                    const height = (wrapper.style.height || '').trim();
                    return height && height !== 'auto' && height !== 'initial' && height !== 'unset';
                };
                document.querySelectorAll('.mermaid-wrapper').forEach(wrapper => {
                    if (!shouldLockHeight(wrapper)) {
                        return;
                    }
                    const currentHeight = wrapper.getBoundingClientRect().height;
                    wrapper.style.height = currentHeight + 'px';
                });
                isInitialLoad = false;
            }
        });
    });
    renderD2Diagrams();
});

function initRevealDiagramRefresh() {
    if (!window.Reveal || typeof window.Reveal.on !== 'function') return;
    const normalizeMermaidViewBox = (scope) => {
        if (!scope) return;
        const svgs = scope.querySelectorAll('.mermaid-wrapper svg');
        svgs.forEach((svg) => {
            try {
                if (!svg.getBBox) return;
                const box = svg.getBBox();
                if (!Number.isFinite(box.width) || !Number.isFinite(box.height)) return;
                if (box.width < 1 || box.height < 1) return;
                const pad = 16;
                svg.setAttribute('viewBox', `${box.x - pad} ${box.y - pad} ${box.width + (pad * 2)} ${box.height + (pad * 2)}`);
                svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
                svg.style.display = 'block';
                svg.style.margin = '0 auto';
            } catch (_) {
                // Ignore unstable SVG state during transitions.
            }
        });
    };
    const centerRevealSlideDiagrams = (scope) => {
        if (!scope) return;
        const svgs = scope.querySelectorAll('.mermaid-wrapper svg, .d2-wrapper svg');
        svgs.forEach((svg) => {
            svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
            svg.style.display = 'block';
            svg.style.margin = '0 auto';
            svg.style.width = '100%';
            svg.style.height = '100%';
            svg.style.maxWidth = '100%';
            svg.style.maxHeight = '100%';
        });
    };
    const hydrateSlideDiagrams = (force = false) => {
        const current = window.Reveal.getCurrentSlide();
        if (!current) return;
        if (!force && current.dataset.diagramHydrated === 'true') return;
        current.dataset.diagramHydrated = 'true';
        const mermaidNodes = [];
        current.querySelectorAll('.mermaid-wrapper').forEach((wrapper) => {
            if (!wrapper.id) return;
            delete mermaidStates[wrapper.id];
            delete wrapper.dataset.mermaidInteractive;
            if (wrapper.querySelector('svg')) return;
            const encoded = wrapper.getAttribute('data-mermaid-code');
            if (!encoded) return;
            const textarea = document.createElement('textarea');
            textarea.innerHTML = encoded;
            const code = textarea.value;
            wrapper.innerHTML = '';
            const pre = document.createElement('pre');
            pre.className = 'mermaid';
            pre.textContent = code;
            wrapper.appendChild(pre);
            mermaidNodes.push(pre);
        });
        const didRenderMermaid = mermaidNodes.length > 0;
        const afterMermaid = () => {
            scheduleMermaidInteraction();
            if (didRenderMermaid && window.Reveal && typeof window.Reveal.layout === 'function') {
                requestAnimationFrame(() => {
                    window.Reveal.layout();
                });
                setTimeout(() => {
                    normalizeMermaidViewBox(current);
                }, 120);
            }
        };
        if (mermaidNodes.length > 0) {
            mermaid.run({ nodes: mermaidNodes }).then(() => {
                afterMermaid(true);
            }).catch(() => {});
        } else {
            afterMermaid(false);
        }
        renderD2Diagrams(current);
        initTabPanelHeights(current);
        requestAnimationFrame(() => centerRevealSlideDiagrams(current));
        setTimeout(() => centerRevealSlideDiagrams(current), 60);
    };
    window.Reveal.on('ready', () => setTimeout(() => hydrateSlideDiagrams(true), 0));
    window.Reveal.on('slidetransitionend', () => hydrateSlideDiagrams(false));
}
initRevealDiagramRefresh();

// Reveal current file in sidebar
function revealInSidebar(rootElement = document) {
    if (!window.location.pathname.startsWith('/posts/')) {
        return;
    }

    // Decode the URL path to handle special characters and spaces
    const currentPath = decodeURIComponent(window.location.pathname.replace(/^\/posts\//, ''));
    const activeLink = rootElement.querySelector(`.post-link[data-path="${currentPath}"]`);
    
    if (activeLink) {
        // Expand all parent details elements within this sidebar
        let parent = activeLink.closest('details');
        while (parent && rootElement.contains(parent)) {
            parent.open = true;
            if (parent === rootElement) {
                break;
            }
            parent = parent.parentElement.closest('details');
        }
        
        // Scroll to the active link
        const scrollContainer = rootElement.querySelector('#sidebar-scroll-container');
        if (scrollContainer) {
            const linkRect = activeLink.getBoundingClientRect();
            const containerRect = scrollContainer.getBoundingClientRect();
            const scrollTop = scrollContainer.scrollTop;
            const offset = linkRect.top - containerRect.top + scrollTop - (containerRect.height / 2) + (linkRect.height / 2);
            
            scrollContainer.scrollTo({
                top: offset,
                behavior: 'smooth'
            });
        }
        
        // Highlight the active link temporarily
        activeLink.classList.remove('fade-out');
        activeLink.classList.add('sidebar-highlight');
        requestAnimationFrame(() => {
            setTimeout(() => {
                activeLink.classList.add('fade-out');
                setTimeout(() => {
                    activeLink.classList.remove('sidebar-highlight', 'fade-out');
                }, 10000);
            }, 1000);
        });
    }
}

function initPostsSidebarAutoReveal() {
    const postSidebars = document.querySelectorAll('details[data-sidebar="posts"]');
    
    postSidebars.forEach((sidebar) => {
        if (sidebar.dataset.revealBound === 'true') {
            return;
        }
        sidebar.dataset.revealBound = 'true';
        
        // Reveal immediately if sidebar is already open
        if (sidebar.open) {
            revealInSidebar(sidebar);
        }
        
        sidebar.addEventListener('toggle', () => {
            if (!sidebar.open) {
                return;
            }
            revealInSidebar(sidebar);
        });
    });
}

function initFolderChevronState(rootElement = document) {
    rootElement.querySelectorAll('details[data-folder="true"]').forEach((details) => {
        details.classList.toggle('is-open', details.open);
    });
}

function initSearchPlaceholderCycle(rootElement = document) {
    const inputs = rootElement.querySelectorAll('input[data-placeholder-cycle]');
    inputs.forEach((input) => {
        if (input.dataset.placeholderCycleBound === 'true') {
            return;
        }
        input.dataset.placeholderCycleBound = 'true';
        const primary = input.dataset.placeholderPrimary || input.getAttribute('placeholder') || '';
        const alt = input.dataset.placeholderAlt || '';
        if (!alt) {
            return;
        }
        let showAlt = false;
        setInterval(() => {
            if (input.value) {
                return;
            }
            showAlt = !showAlt;
            input.setAttribute('placeholder', showAlt ? alt : primary);
        }, 10000);
    });
}

function initCodeBlockCopyButtons(rootElement = document) {
    const buttons = rootElement.querySelectorAll('.code-copy-button');
    buttons.forEach((button) => {
        if (button.dataset.copyBound === 'true') {
            return;
        }
        button.dataset.copyBound = 'true';
        button.addEventListener('click', () => {
            const container = button.closest('.code-block');
            const codeEl = container ? container.querySelector('pre > code') : null;
            if (!codeEl) {
                return;
            }
            const text = codeEl.innerText || codeEl.textContent || '';
            const done = () => {
                button.classList.add('is-copied');
                setTimeout(() => button.classList.remove('is-copied'), 1200);
            };
            if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(text).then(done).catch(() => {
                    const textarea = document.createElement('textarea');
                    textarea.value = text;
                    textarea.setAttribute('readonly', '');
                    textarea.style.position = 'absolute';
                    textarea.style.left = '-9999px';
                    document.body.appendChild(textarea);
                    textarea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textarea);
                    done();
                });
            } else {
                const textarea = document.createElement('textarea');
                textarea.value = text;
                textarea.setAttribute('readonly', '');
                textarea.style.position = 'absolute';
                textarea.style.left = '-9999px';
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
                done();
            }
        });
    });
}

function initPostsSearchPersistence(rootElement = document) {
    const input = rootElement.querySelector('.posts-search-block input[type="search"][name="q"]');
    const results = rootElement.querySelector('.posts-search-results');
    if (!input || !results) {
        return;
    }
    if (input.dataset.searchPersistenceBound === 'true') {
        return;
    }
    input.dataset.searchPersistenceBound = 'true';
    const termKey = 'vyasa:postsSearchTerm';
    const resultsKey = 'vyasa:postsSearchResults';
    const enhanceGatherLink = () => {
        const gatherLink = results.querySelector('a[href^="/search/gather"]');
        if (!gatherLink) {
            return;
        }
        const href = gatherLink.getAttribute('href');
        if (!href) {
            return;
        }
        gatherLink.setAttribute('hx_get', href);
        gatherLink.setAttribute('hx_target', '#main-content');
        gatherLink.setAttribute('hx_push_url', 'true');
        gatherLink.setAttribute('hx_swap', 'outerHTML show:window:top settle:0.1s');
    };
    let storedTerm = '';
    let storedResults = null;
    try {
        storedTerm = localStorage.getItem(termKey) || '';
        storedResults = localStorage.getItem(resultsKey);
    } catch (err) {
        storedTerm = '';
        storedResults = null;
    }
    if (storedTerm && !input.value) {
        input.value = storedTerm;
    }
    if (storedResults && input.value) {
        try {
            const payload = JSON.parse(storedResults);
            if (payload && payload.term === input.value && payload.html) {
                results.innerHTML = payload.html;
                enhanceGatherLink();
            }
        } catch (err) {
            // Ignore malformed cached payloads.
        }
    }
    const persistTerm = () => {
        try {
            if (input.value) {
                localStorage.setItem(termKey, input.value);
            } else {
                localStorage.removeItem(termKey);
                localStorage.removeItem(resultsKey);
            }
        } catch (err) {
            // Ignore storage failures.
        }
    };
    input.addEventListener('input', persistTerm);
    const fetchResults = (query) => {
        return fetch(`/_sidebar/posts/search?q=${query}`)
            .then((response) => response.text())
            .then((html) => {
                results.innerHTML = html;
                enhanceGatherLink();
                try {
                    localStorage.setItem(resultsKey, JSON.stringify({
                        term: input.value,
                        html: results.innerHTML
                    }));
                } catch (err) {
                    // Ignore storage failures.
                }
            })
            .catch(() => {});
    };
    document.body.addEventListener('htmx:afterSwap', (event) => {
        if (event.target !== results) {
            return;
        }
        enhanceGatherLink();
        try {
            localStorage.setItem(resultsKey, JSON.stringify({
                term: input.value,
                html: results.innerHTML
            }));
        } catch (err) {
            // Ignore storage failures.
        }
    });
    if (input.value) {
        const query = encodeURIComponent(input.value);
        if (window.htmx && typeof window.htmx.ajax === 'function') {
            window.htmx.ajax('GET', `/_sidebar/posts/search?q=${query}`, { target: results, swap: 'innerHTML' });
        } else {
            fetchResults(query);
        }
    }
}

function initSearchClearButtons(rootElement = document) {
    const blocks = rootElement.querySelectorAll('.posts-search-block');
    blocks.forEach((block) => {
        const input = block.querySelector('input[type="search"][name="q"]');
        const button = block.querySelector('.posts-search-clear-button');
        const results = block.querySelector('.posts-search-results');
        if (!input || !button) {
            return;
        }
        if (button.dataset.clearBound === 'true') {
            return;
        }
        button.dataset.clearBound = 'true';
        const updateVisibility = () => {
            button.style.opacity = input.value ? '1' : '0';
            button.style.pointerEvents = input.value ? 'auto' : 'none';
        };
        updateVisibility();
        input.addEventListener('input', updateVisibility);
        button.addEventListener('click', () => {
            input.value = '';
            input.dispatchEvent(new Event('input', { bubbles: true }));
            if (results) {
                results.innerHTML = '';
            }
            try {
                localStorage.removeItem('vyasa:postsSearchTerm');
                localStorage.removeItem('vyasa:postsSearchResults');
            } catch (err) {
                // Ignore storage failures.
            }
        });
    });
}

document.addEventListener('toggle', (event) => {
    const details = event.target;
    if (!(details instanceof HTMLDetailsElement)) {
        return;
    }
    if (!details.matches('details[data-folder="true"]')) {
        return;
    }
    details.classList.toggle('is-open', details.open);
}, true);

// Update active post link in sidebar
function updateActivePostLink() {
    const currentPath = window.location.pathname.replace(/^\/posts\//, '');
    document.querySelectorAll('.post-link').forEach(link => {
        const linkPath = link.getAttribute('data-path');
        if (linkPath === currentPath) {
            link.classList.add('bg-blue-50', 'dark:bg-blue-900/20', 'text-blue-600', 'dark:text-blue-400', 'font-medium');
            link.classList.remove('text-slate-700', 'dark:text-slate-300', 'hover:text-blue-600');
        } else {
            link.classList.remove('bg-blue-50', 'dark:bg-blue-900/20', 'text-blue-600', 'dark:text-blue-400', 'font-medium');
            link.classList.add('text-slate-700', 'dark:text-slate-300', 'hover:text-blue-600');
        }
    });
}

// Update active TOC link based on scroll position
let lastActiveTocAnchor = null;
function updateActiveTocLink() {
    const headings = document.querySelectorAll('h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]');
    const tocLinks = document.querySelectorAll('.toc-link');
    
    let activeHeading = null;
    let nearestBelow = null;
    let nearestBelowTop = Infinity;
    const offset = 140;
    headings.forEach(heading => {
        const rect = heading.getBoundingClientRect();
        if (rect.top <= offset) {
            activeHeading = heading;
        } else if (rect.top < nearestBelowTop) {
            nearestBelowTop = rect.top;
            nearestBelow = heading;
        }
    });
    if (!activeHeading && nearestBelow) {
        activeHeading = nearestBelow;
    }
    
    tocLinks.forEach(link => {
        const anchor = link.getAttribute('data-anchor');
        if (activeHeading && anchor === activeHeading.id) {
            link.classList.add('bg-blue-50', 'dark:bg-blue-900/20', 'text-blue-600', 'dark:text-blue-400', 'font-semibold');
        } else {
            link.classList.remove('bg-blue-50', 'dark:bg-blue-900/20', 'text-blue-600', 'dark:text-blue-400', 'font-semibold');
        }
    });

    const activeId = activeHeading ? activeHeading.id : null;
    if (activeId && activeId !== lastActiveTocAnchor) {
        document.querySelectorAll(`.toc-link[data-anchor="${activeId}"]`).forEach(link => {
            link.scrollIntoView({ block: 'nearest' });
        });
        lastActiveTocAnchor = activeId;
    }
}

// Listen for scroll events to update active TOC link
let ticking = false;
window.addEventListener('scroll', () => {
    if (!ticking) {
        window.requestAnimationFrame(() => {
            updateActiveTocLink();
            ticking = false;
        });
        ticking = true;
    }
});

// Sync TOC highlight on hash changes and TOC clicks
window.addEventListener('hashchange', () => {
    requestAnimationFrame(updateActiveTocLink);
});

document.addEventListener('click', (event) => {
    const link = event.target.closest('.toc-link');
    if (!link) {
        return;
    }
    const anchor = link.getAttribute('data-anchor');
    if (!anchor) {
        return;
    }
    requestAnimationFrame(() => {
        document.querySelectorAll('.toc-link').forEach(item => {
            item.classList.toggle(
                'bg-blue-50',
                item.getAttribute('data-anchor') === anchor
            );
            item.classList.toggle(
                'dark:bg-blue-900/20',
                item.getAttribute('data-anchor') === anchor
            );
            item.classList.toggle(
                'text-blue-600',
                item.getAttribute('data-anchor') === anchor
            );
            item.classList.toggle(
                'dark:text-blue-400',
                item.getAttribute('data-anchor') === anchor
            );
            item.classList.toggle(
                'font-semibold',
                item.getAttribute('data-anchor') === anchor
            );
        });
        lastActiveTocAnchor = anchor;
        updateActiveTocLink();
    });
});

// Re-run mermaid on HTMX content swaps
document.body.addEventListener('htmx:afterSwap', function(event) {
    mermaidDebugSnapshot('before mermaid.run (htmx:afterSwap)');
    document.querySelectorAll('.mermaid-wrapper').forEach(wrapper => {
        if (!wrapper.id) {
            return;
        }
        // HTMX swaps can trigger a mermaid re-run that replaces SVGs.
        // Clear interaction state so we always re-bind after mermaid.run().
        delete mermaidStates[wrapper.id];
        delete wrapper.dataset.mermaidInteractive;
    });
    mermaid.run().then(() => {
        mermaidDebugSnapshot('after mermaid.run (htmx:afterSwap)');
        scheduleMermaidInteraction();
    });
    renderD2Diagrams(event.target || document);
    updateActivePostLink();
    updateActiveTocLink();
    initMobileMenus(); // Reinitialize mobile menu handlers
    initPostsSidebarAutoReveal();
    initFolderChevronState();
    initSearchPlaceholderCycle(event.target || document);
    initCodeBlockCopyButtons(event.target || document);
});

// Watch for theme changes and re-render mermaid diagrams
const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
            reinitializeMermaid();
            renderD2Diagrams();
        }
    });
});

observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class']
});

// Mobile menu toggle functionality
function initMobileMenus() {
    const postsToggle = document.getElementById('mobile-posts-toggle');
    const tocToggle = document.getElementById('mobile-toc-toggle');
    const postsPanel = document.getElementById('mobile-posts-panel');
    const tocPanel = document.getElementById('mobile-toc-panel');
    const closePostsBtn = document.getElementById('close-mobile-posts');
    const closeTocBtn = document.getElementById('close-mobile-toc');

    // Open posts panel
    if (postsToggle) {
        postsToggle.addEventListener('click', () => {
            if (postsPanel) {
                postsPanel.classList.remove('-translate-x-full');
                postsPanel.classList.add('translate-x-0');
                postsPanel.querySelectorAll('details[data-sidebar="posts"]').forEach((sidebar) => {
                    revealInSidebar(sidebar);
                });
                // Close TOC panel if open
                if (tocPanel) {
                    tocPanel.classList.remove('translate-x-0');
                    tocPanel.classList.add('translate-x-full');
                }
            }
        });
    }
    
    // Open TOC panel
    if (tocToggle) {
        tocToggle.addEventListener('click', () => {
            if (tocPanel) {
                tocPanel.classList.remove('translate-x-full');
                tocPanel.classList.add('translate-x-0');
                // Close posts panel if open
                if (postsPanel) {
                    postsPanel.classList.remove('translate-x-0');
                    postsPanel.classList.add('-translate-x-full');
                }
            }
        });
    }
    
    // Close posts panel
    if (closePostsBtn) {
        closePostsBtn.addEventListener('click', () => {
            if (postsPanel) {
                postsPanel.classList.remove('translate-x-0');
                postsPanel.classList.add('-translate-x-full');
            }
        });
    }
    
    // Close TOC panel
    if (closeTocBtn) {
        closeTocBtn.addEventListener('click', () => {
            if (tocPanel) {
                tocPanel.classList.remove('translate-x-0');
                tocPanel.classList.add('translate-x-full');
            }
        });
    }
    
    // Close panels on link click (for better mobile UX)
    if (postsPanel) {
        postsPanel.addEventListener('click', (e) => {
            if (e.target.tagName === 'A' || e.target.closest('a')) {
                setTimeout(() => {
                    postsPanel.classList.remove('translate-x-0');
                    postsPanel.classList.add('-translate-x-full');
                }, 100);
            }
        });
    }
    
    if (tocPanel) {
        tocPanel.addEventListener('click', (e) => {
            if (e.target.tagName === 'A' || e.target.closest('a')) {
                setTimeout(() => {
                    tocPanel.classList.remove('translate-x-0');
                    tocPanel.classList.add('translate-x-full');
                }, 100);
            }
        });
    }
}

// Keyboard shortcuts for toggling sidebars
function initKeyboardShortcuts() {
    // Prewarm the selectors to avoid lazy compilation delays
    const postsSidebars = document.querySelectorAll('details[data-sidebar="posts"]');
    const tocSidebar = document.querySelector('#toc-sidebar details');
    
    document.addEventListener('keydown', (e) => {
        // Skip if user is typing in an input field
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
            return;
        }
        
        // Z: Toggle posts panel
        if (e.key === 'z' || e.key === 'Z') {
            e.preventDefault();
            const postsSidebars = document.querySelectorAll('details[data-sidebar="posts"]');
            postsSidebars.forEach(sidebar => {
                sidebar.open = !sidebar.open;
            });
        }
        
        // X: Toggle TOC panel
        if (e.key === 'x' || e.key === 'X') {
            e.preventDefault();
            const tocSidebar = document.querySelector('#toc-sidebar details');
            if (tocSidebar) {
                tocSidebar.open = !tocSidebar.open;
            }
        }
    });
}

function syncPdfFocusButtons(root = document) {
    const isFocused = document.body.classList.contains('pdf-focus');
    root.querySelectorAll('[data-pdf-focus-toggle]').forEach((button) => {
        const focusLabel = button.getAttribute('data-pdf-focus-label') || 'Focus PDF';
        const exitLabel = button.getAttribute('data-pdf-exit-label') || 'Exit focus';
        button.textContent = isFocused ? exitLabel : focusLabel;
        button.setAttribute('aria-pressed', isFocused ? 'true' : 'false');
    });
}

function ensurePdfFocusState() {
    const hasPdfViewer = document.querySelector('.pdf-viewer') || document.querySelector('[data-pdf-focus-toggle]');
    if (!hasPdfViewer) {
        document.body.classList.remove('pdf-focus');
    }
    syncPdfFocusButtons(document);
}

function initPdfFocusToggle() {
    document.addEventListener('click', (event) => {
        const button = event.target.closest('[data-pdf-focus-toggle]');
        if (!button) {
            return;
        }
        event.preventDefault();
        document.body.classList.toggle('pdf-focus');
        syncPdfFocusButtons(document);
    });

    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') {
            return;
        }
        if (!document.body.classList.contains('pdf-focus')) {
            return;
        }
        document.body.classList.remove('pdf-focus');
        syncPdfFocusButtons(document);
    });
}

function openIframeFullscreen(button) {
    const src = button.getAttribute('data-iframe-src');
    const title = button.getAttribute('data-iframe-title') || 'Embedded content';
    const allow = button.getAttribute('data-iframe-allow') || '';
    const allowfullscreen = button.getAttribute('data-iframe-allowfullscreen') === 'true';

    let overlay = document.querySelector('.iframe-fullscreen-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'iframe-fullscreen-overlay';
        overlay.innerHTML = `
            <div class="iframe-fullscreen-header">
                <div class="iframe-fullscreen-title"></div>
                <button type="button" class="iframe-fullscreen-close px-2 py-1 text-xs border rounded hover:bg-slate-700">
                    Close
                </button>
            </div>
            <div class="iframe-fullscreen-body">
                <iframe class="iframe-fullscreen-frame" frameborder="0"></iframe>
            </div>
        `;
        document.body.appendChild(overlay);

        overlay.addEventListener('click', (event) => {
            if (event.target.classList.contains('iframe-fullscreen-overlay')) {
                closeIframeFullscreen();
            }
        });

        overlay.querySelector('.iframe-fullscreen-close').addEventListener('click', () => {
            closeIframeFullscreen();
        });
    }

    overlay.querySelector('.iframe-fullscreen-title').textContent = title;
    const frame = overlay.querySelector('.iframe-fullscreen-frame');
    frame.setAttribute('src', src);
    frame.setAttribute('title', title);
    frame.setAttribute('allow', allow);
    if (allowfullscreen) {
        frame.setAttribute('allowfullscreen', '');
    } else {
        frame.removeAttribute('allowfullscreen');
    }

    document.body.classList.add('iframe-fullscreen-open');
    overlay.style.display = 'flex';
}

function closeIframeFullscreen() {
    const overlay = document.querySelector('.iframe-fullscreen-overlay');
    if (!overlay) {
        return;
    }
    const frame = overlay.querySelector('.iframe-fullscreen-frame');
    if (frame) {
        frame.setAttribute('src', 'about:blank');
    }
    overlay.style.display = 'none';
    document.body.classList.remove('iframe-fullscreen-open');
}

function initIframeFullscreenToggle() {
    document.addEventListener('click', (event) => {
        const button = event.target.closest('[data-iframe-fullscreen-toggle]');
        if (!button) {
            return;
        }
        event.preventDefault();
        openIframeFullscreen(button);
    });

    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') {
            return;
        }
        closeIframeFullscreen();
    });
}

function replaceEscapedDollarPlaceholders(root) {
    const placeholder = '@@VYASA_DOLLAR@@';
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let node;
    while ((node = walker.nextNode())) if (node.nodeValue && node.nodeValue.includes(placeholder)) nodes.push(node);
    nodes.forEach((textNode) => {
        textNode.nodeValue = textNode.nodeValue.split(placeholder).join('\\$');
    });
}

function renderMathSafely(root) {
    if (typeof renderMathInElement !== 'function') return;
    const marker = '@@VYASA_CURRENCY_DOLLAR@@';
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
        const parent = node.parentElement;
        if (!parent || ['CODE', 'PRE', 'SCRIPT', 'STYLE', 'TEXTAREA'].includes(parent.tagName) || parent.closest('.katex')) continue;
        if (node.nodeValue && node.nodeValue.includes('$')) node.nodeValue = node.nodeValue.replace(/\$(?=\d)/g, marker);
    }
    renderMathInElement(root, { delimiters: [{ left: '$$', right: '$$', display: true }, { left: '$', right: '$', display: false }], throwOnError: false });
    walker.currentNode = root;
    while ((node = walker.nextNode())) if (node.nodeValue && node.nodeValue.includes(marker)) node.nodeValue = node.nodeValue.split(marker).join('$');
}

function initHighlightedCodeIncludes(root) {
    (root || document).querySelectorAll('code[data-code-highlight-lines]').forEach((code) => {
        if (code.querySelector('.vyasa-code-line')) return;
        const start = Number(code.dataset.codeSourceStart || '1');
        const ranges = String(code.dataset.codeHighlightLines || '').split(',').map((part) => part.trim()).filter(Boolean);
        const highlighted = new Set();
        ranges.forEach((part) => {
            const [a, b] = part.split('-').map((value) => Number(value));
            for (let n = a; n <= (b || a); n += 1) highlighted.add(n);
        });
        const lines = code.innerHTML.split('\n');
        code.innerHTML = lines.map((line, index) => {
            const lineNo = start + index;
            const cls = highlighted.has(lineNo) ? 'vyasa-code-line vyasa-code-line-highlight' : 'vyasa-code-line';
            return `<span class="${cls}" data-source-line="${lineNo}">${line || '&nbsp;'}</span>`;
        }).join('\n');
        code.classList.add('vyasa-code-lines');
    });
}

function scheduleHighlightedCodeIncludes(root) {
    const target = root || document;
    initHighlightedCodeIncludes(target);
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => initHighlightedCodeIncludes(target));
    [40, 140, 320].forEach((delay) => setTimeout(() => initHighlightedCodeIncludes(target), delay));
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    replaceEscapedDollarPlaceholders(document.body);
    renderMathSafely(document.body);
    refreshVyasaTableScrollShadows(document);
    updateActivePostLink();
    updateActiveTocLink();
    initMobileMenus();
    initPostsSidebarAutoReveal();
    initFolderChevronState();
    initKeyboardShortcuts();
    initPdfFocusToggle();
    initIframeFullscreenToggle();
    initSearchPlaceholderCycle(document);
    initPostsSearchPersistence(document);
    initCodeBlockCopyButtons(document);
    scheduleHighlightedCodeIncludes(document);
    initSearchClearButtons(document);
    ensurePdfFocusState();
    initTabPanelHeights(document);
    initExcalidrawHosts(document);
    initExcalidrawName(document);
    initExcalidrawSave(document);
    initExcalidrawOpenExternal(document);
    initExcalidrawExternalOpen(document);
});

document.body.addEventListener('htmx:afterSwap', (event) => {
    if (!event.target) {
        return;
    }
    replaceEscapedDollarPlaceholders(event.target);
    renderMathSafely(event.target);
    refreshVyasaTableScrollShadows(event.target);
    initSearchPlaceholderCycle(event.target);
    initPostsSearchPersistence(event.target);
    initCodeBlockCopyButtons(event.target);
    scheduleHighlightedCodeIncludes(event.target);
    initExcalidrawHosts(event.target || document);
    initExcalidrawName(event.target || document);
    initExcalidrawSave(event.target || document);
    initExcalidrawOpenExternal(event.target || document);
    initExcalidrawExternalOpen(event.target || document);
    initSearchClearButtons(event.target);
    ensurePdfFocusState();
    initTabPanelHeights(event.target || document);
});

window.addEventListener('load', () => {
    scheduleHighlightedCodeIncludes(document);
});

window.addEventListener('resize', () => refreshVyasaTableScrollShadows(document));

document.body.addEventListener('htmx:beforeRequest', (event) => {
    if (document.body.dataset.forceFullNav !== '1') {
        return;
    }
    const path = event?.detail?.requestConfig?.path || '';
    if (!path || path.startsWith('/api/excalidraw/')) {
        return;
    }
    event.preventDefault();
    window.location.assign(path);
});
