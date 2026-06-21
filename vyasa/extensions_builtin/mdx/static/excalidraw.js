// Excalidraw 0.17 injects its own styles via the JS bundle; there is no standalone CSS file.
const JS_URL = 'https://unpkg.com/@excalidraw/excalidraw@0.17.6/dist/excalidraw.production.min.js';

function loadAsset() {
  if (window.ExcalidrawLib) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const found = document.querySelector(`script[src="${JS_URL}"]`);
    if (found) return found.addEventListener('load', resolve, { once: true });
    const script = Object.assign(document.createElement('script'), { src: JS_URL, onload: resolve });
    script.onerror = () => reject(new Error(`Failed to load ${JS_URL}`));
    document.head.appendChild(script);
  });
}

function durableScene(elements = [], appState = {}, files = {}) {
  return {
    elements,
    appState: {
      viewBackgroundColor: appState.viewBackgroundColor,
      currentItemFontFamily: appState.currentItemFontFamily,
      currentItemFontSize: appState.currentItemFontSize,
      scrollX: appState.scrollX,
      scrollY: appState.scrollY,
      zoom: appState.zoom,
    },
    files,
  };
}

const DEFAULT_HEIGHT = '85vh';
const PREFS_KEY = 'vyasa-excalidraw-prefs';
const VALID_ID = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/;

function loadPrefs() {
  try { return JSON.parse(localStorage.getItem(PREFS_KEY)) || {}; } catch (_) { return {}; }
}

function savePrefs(appState = {}) {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify({ theme: appState.theme })); } catch (_) { /* private mode */ }
}

function sceneSignature(elements = [], files = {}) {
  const shape = elements.map(item => `${item.id}:${item.version}:${item.isDeleted ? 1 : 0}`).join(',');
  return `${shape}|${Object.keys(files).sort().join(',')}`;
}

function savedScene(data) {
  return data && Array.isArray(data.elements) ? data : {};
}

function Excalidraw({ id, height }) {
  const React = window.React;
  const canvasHeight = Number(height) || DEFAULT_HEIGHT;
  const [scene, setScene] = React.useState(null);
  const [status, setStatus] = React.useState('');
  const [readonly, setReadonly] = React.useState(false);
  const readonlyRef = React.useRef(false);
  const timer = React.useRef();
  const canvasApi = React.useRef();
  const revision = React.useRef();
  const suppressSave = React.useRef(true);
  const lastSig = React.useRef();
  const validId = VALID_ID.test(String(id || ''));
  const slug = location.pathname.replace(/^\/posts\//, '').replace(/\/$/, '');
  const stateFile = `./${id || ''}.state.json`;
  const fileUrl = `/api/mdx/files/${slug}?ref=${encodeURIComponent(stateFile)}`;
  const refreshUrl = `/api/mdx/excalidraw/${slug}/canvas/${encodeURIComponent(id || '')}/refresh?ref=${encodeURIComponent(stateFile)}`;
  const loadScene = React.useCallback(async () => {
    clearTimeout(timer.current);
    const response = await fetch(fileUrl);
    let data = {};
    if (response.ok) {
      data = await response.json();
    } else {
      const fallback = await fetch(stateFile);
      if (fallback.ok) data = await fallback.json();
      else if (response.status !== 404 || fallback.status !== 404) {
        throw new Error(`Failed to load Excalidraw scene: ${response.status}/${fallback.status}`);
      }
    }
    const saved = savedScene(data);
    const next = durableScene(saved.elements, saved.appState, saved.files);
    next.appState = { ...next.appState, ...loadPrefs() };
    lastSig.current = sceneSignature(next.elements, next.files);
    suppressSave.current = true;
    if (canvasApi.current) canvasApi.current.updateScene(next);
    else setScene(next);
    setTimeout(() => { suppressSave.current = false; }, 0);
    return next;
  }, [fileUrl, id, stateFile]);
  React.useEffect(() => {
    let active = true;
    if (!validId) {
      setStatus('Excalidraw requires a stable id matching [A-Za-z0-9][A-Za-z0-9_.-]{0,127}');
      return () => {};
    }
    loadAsset().then(loadScene)
      .catch(error => active && setStatus(String(error)));
    return () => { active = false; clearTimeout(timer.current); };
  }, [id, loadScene]);
  React.useEffect(() => {
    if (!validId) return () => {};
    let active = true;
    fetch(refreshUrl)
      .then(response => (response.ok ? response.json() : null))
      .then(body => {
        if (!active || !body) return;
        readonlyRef.current = Boolean(body.readonly);
        setReadonly(readonlyRef.current);
        if (revision.current === undefined) revision.current = body.revision;
      })
      .catch(() => { /* static builds have no refresh endpoint */ });
    const stop = window.VyasaMdx?.watchResource?.(slug, stateFile, async (current) => {
      if (!active || current === undefined) return;
      if (revision.current === undefined) { revision.current = current; return; }
      if (current !== revision.current) {
        revision.current = current;
        await loadScene();
        if (active) setStatus('Refreshed');
      }
    });
    return () => { active = false; if (stop) stop(); };
  }, [id, loadScene, refreshUrl, slug, stateFile]);
  const save = React.useCallback((elements, appState, files) => {
    if (readonlyRef.current || suppressSave.current) return;
    const signature = sceneSignature(elements, files);
    if (signature === lastSig.current) return;
    clearTimeout(timer.current);
    setStatus('Saving...');
    const excalidraw = durableScene(elements, appState, files);
    timer.current = setTimeout(async () => {
      try {
        const refreshResponse = await fetch(refreshUrl);
        if (refreshResponse.ok) {
          const latest = (await refreshResponse.json()).revision;
          if (revision.current !== undefined && latest !== revision.current) {
            revision.current = latest;
            await loadScene();
            setStatus('Refreshed');
            return;
          }
        }
        const saveUrl = `${fileUrl}&canvas=${encodeURIComponent(id)}&revision=${encodeURIComponent(revision.current ?? 0)}`;
        const response = await fetch(saveUrl, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(excalidraw, null, 2),
        });
        if (!response.ok) throw new Error(`Save failed: ${response.status}`);
        const result = await response.json().catch(() => ({}));
        if (result.revision !== undefined) revision.current = result.revision;
        lastSig.current = signature;
        setStatus('Saved');
      } catch (error) { setStatus(String(error)); }
    }, 450);
  }, [fileUrl, id, loadScene, refreshUrl]);
  const handleChange = React.useCallback((elements, appState, files) => {
    savePrefs(appState);
    save(elements, appState, files);
  }, [save]);
  const Canvas = window.ExcalidrawLib?.Excalidraw;
  if (!scene || !Canvas) return React.createElement('div', null, status || 'Loading Excalidraw...');
  const banner = readonly ? 'Read-only — editing disabled here\nsee vyasa documentation to learn how to make it editable' : (status || 'Saved');
  return React.createElement('div', { style: { paddingTop: 24 } },
    React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', marginBottom: 8 } },
      React.createElement('span', { style: { fontSize: 13, opacity: readonly ? 1 : 0.72, fontWeight: readonly ? 600 : 400, whiteSpace: 'pre-line' } }, banner),
      React.createElement('button', { onClick: loadScene }, 'Reload saved canvas')),
    React.createElement('div', { style: { height: canvasHeight, border: '1px solid var(--vyasa-border)', borderRadius: 8, overflow: 'hidden' } },
      React.createElement(Canvas, { initialData: scene, viewModeEnabled: readonly, excalidrawAPI: api => { canvasApi.current = api; }, onChange: handleChange })));
}

window.VyasaMdxComponents = { ...(window.VyasaMdxComponents || {}), Excalidraw };
