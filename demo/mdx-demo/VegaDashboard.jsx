const VEGA_SCRIPTS = [
  'https://cdn.jsdelivr.net/npm/vega@5',
  'https://cdn.jsdelivr.net/npm/vega-lite@5',
  'https://cdn.jsdelivr.net/npm/vega-embed@6'
];

const vegaScriptCache = new Map();

function loadVegaScript(src) {
  if (vegaScriptCache.has(src)) return vegaScriptCache.get(src);
  const promise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) return existing.addEventListener('load', resolve, { once: true }) || resolve();
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
  vegaScriptCache.set(src, promise);
  return promise;
}

async function loadSpec(specFile) {
  const slug = location.pathname.replace(/^\/posts\//, '').replace(/\/$/, '');
  const fileUrl = `/api/mdx/files/${slug}?ref=${encodeURIComponent(specFile)}`;
  const response = await fetch(fileUrl);
  if (response.ok) return response.json();
  return fetch(specFile).then(item => item.json());
}

function VegaDashboard({ specFile = './demo.vega.json' }) {
  const ref = React.useRef(null);
  const [error, setError] = React.useState('');
  React.useEffect(() => {
    let cancelled = false;
    let view;
    async function mount() {
      for (const src of VEGA_SCRIPTS) await loadVegaScript(src);
      const spec = await loadSpec(specFile);
      if (cancelled) return;
      const result = await window.vegaEmbed(ref.current, spec, { actions: false, renderer: 'canvas' });
      view = result.view;
    }
    mount().catch(error => { if (!cancelled) setError(String(error)); });
    return () => {
      cancelled = true;
      if (view) view.finalize();
    };
  }, [specFile]);
  if (error) return <pre>{error}</pre>;
  return <div ref={ref} style={{ overflowX: 'auto', border: '1px solid var(--vyasa-border)', borderRadius: 12, padding: 12 }} />;
}

export default VegaDashboard;
