const CSS_URL = 'https://unpkg.com/@excalidraw/excalidraw@0.17.6/dist/excalidraw.min.css';
const JS_URL = 'https://unpkg.com/@excalidraw/excalidraw@0.17.6/dist/excalidraw.production.min.js';

function loadAsset() {
  if (!document.querySelector(`link[href="${CSS_URL}"]`)) {
    const link = Object.assign(document.createElement('link'), { rel: 'stylesheet', href: CSS_URL });
    document.head.appendChild(link);
  }
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

function savedScene(data, canvasId) {
  return data.excalidrawCanvases?.[canvasId] || data.excalidraw || data || {};
}

function withSavedScene(data, canvasId, scene) {
  if (data.excalidrawCanvases) {
    return { ...data, excalidrawCanvases: { ...data.excalidrawCanvases, [canvasId]: scene } };
  }
  return { ...data, excalidraw: scene };
}

function Excalidraw({ id, stateFile }) {
  const React = window.React;
  const [scene, setScene] = React.useState(null);
  const [status, setStatus] = React.useState('');
  const timer = React.useRef();
  const canvasApi = React.useRef();
  const revision = React.useRef();
  const suppressSave = React.useRef(true);
  const slug = location.pathname.replace(/^\/posts\//, '').replace(/\/$/, '');
  const fileUrl = `/api/mdx/files/${slug}?ref=${encodeURIComponent(stateFile)}`;
  const refreshUrl = `/api/mdx/excalidraw/${slug}/canvas/${encodeURIComponent(id || '')}/refresh?ref=${encodeURIComponent(stateFile)}`;
  const loadScene = React.useCallback(async () => {
    clearTimeout(timer.current);
    const response = await fetch(fileUrl);
    const data = response.ok ? await response.json() : await fetch(stateFile).then(item => item.json());
    const saved = savedScene(data, id);
    const next = durableScene(saved.elements, saved.appState, saved.files);
    suppressSave.current = true;
    if (canvasApi.current) canvasApi.current.updateScene(next);
    else setScene(next);
    setTimeout(() => { suppressSave.current = false; }, 0);
    return next;
  }, [fileUrl, id, stateFile]);
  React.useEffect(() => {
    let active = true;
    if (!id) {
      setStatus('Excalidraw requires a stable id');
      return () => {};
    }
    loadAsset().then(loadScene)
      .catch(error => active && setStatus(String(error)));
    return () => { active = false; clearTimeout(timer.current); };
  }, [id, loadScene]);
  React.useEffect(() => {
    if (!id) return () => {};
    let active = true;
    const poll = async () => {
      try {
        const response = await fetch(refreshUrl);
        if (!response.ok) return;
        const current = (await response.json()).revision;
        if (revision.current === undefined) revision.current = current;
        else if (current !== revision.current) {
          revision.current = current;
          await loadScene();
          if (active) setStatus('Refreshed');
        }
      } catch (_) { /* The file fallback still works in static builds. */ }
    };
    poll();
    const interval = setInterval(poll, 1000);
    return () => { active = false; clearInterval(interval); };
  }, [id, loadScene, refreshUrl]);
  const save = React.useCallback((elements, appState, files) => {
    if (suppressSave.current) return;
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
        const dataResponse = await fetch(fileUrl);
        const data = dataResponse.ok ? await dataResponse.json() : {};
        const saveUrl = `${fileUrl}&canvas=${encodeURIComponent(id)}&revision=${encodeURIComponent(revision.current ?? 0)}`;
        const response = await fetch(saveUrl, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(withSavedScene(data, id, excalidraw), null, 2),
        });
        if (!response.ok) throw new Error(`Save failed: ${response.status}`);
        setStatus('Saved');
      } catch (error) { setStatus(String(error)); }
    }, 450);
  }, [fileUrl, id, loadScene, refreshUrl]);
  const Canvas = window.ExcalidrawLib?.Excalidraw;
  if (!scene || !Canvas) return React.createElement('div', null, status || 'Loading Excalidraw...');
  return React.createElement('div', null,
    React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', marginBottom: 8 } },
      React.createElement('span', { style: { fontSize: 13, opacity: 0.72 } }, status || 'Edits save to sibling JSON'),
      React.createElement('button', { onClick: loadScene }, 'Reload saved canvas')),
    React.createElement('div', { style: { height: 960, border: '1px solid var(--vyasa-border)', borderRadius: 8, overflow: 'hidden' } },
      React.createElement(Canvas, { initialData: scene, excalidrawAPI: api => { canvasApi.current = api; }, onChange: save })));
}

window.VyasaMdxComponents = { ...(window.VyasaMdxComponents || {}), Excalidraw };
