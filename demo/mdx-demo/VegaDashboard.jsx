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

function dashboardSpec() {
  return {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    description: 'Interactive movies dashboard with bound controls plus chart selection.',
    data: { url: 'https://vega.github.io/vega-datasets/data/movies.json' },
    params: [
      {
        name: 'genreFilter',
        value: 'Drama',
        bind: {
          input: 'select',
          options: ['Action', 'Comedy', 'Drama', 'Documentary', 'Horror', 'Romantic Comedy', 'Thriller/Suspense'],
          name: 'Genre '
        }
      },
      { name: 'minRating', value: 5, bind: { input: 'range', min: 1, max: 9, step: 0.5, name: 'Min IMDB ' } }
    ],
    transform: [
      { filter: 'datum["Major Genre"] == genreFilter || genreFilter == null' },
      { filter: 'isValid(datum["IMDB Rating"]) && datum["IMDB Rating"] >= minRating' },
      { filter: 'isValid(datum["Rotten Tomatoes Rating"])' }
    ],
    vconcat: [
      {
        title: 'Filtered movie rating landscape',
        width: 680,
        height: 360,
        layer: [
          {
            mark: 'rect',
            encoding: {
              x: { bin: { maxbins: 18 }, field: 'IMDB Rating', type: 'quantitative' },
              y: { bin: { maxbins: 18 }, field: 'Rotten Tomatoes Rating', type: 'quantitative' },
              color: {
                aggregate: 'count',
                type: 'quantitative',
                scale: { scheme: 'viridis' },
                legend: { title: 'Movies', direction: 'horizontal', gradientLength: 160 }
              },
              tooltip: [{ aggregate: 'count', type: 'quantitative', title: 'Movies' }]
            }
          },
          {
            transform: [{ filter: { param: 'genrePick' } }],
            mark: { type: 'circle', opacity: 0.9, stroke: 'white', strokeWidth: 1.4 },
            encoding: {
              x: { bin: { maxbins: 18 }, field: 'IMDB Rating', type: 'quantitative' },
              y: { bin: { maxbins: 18 }, field: 'Rotten Tomatoes Rating', type: 'quantitative' },
              size: { aggregate: 'count', type: 'quantitative', legend: { title: 'Selected genre' } },
              color: { value: '#f97316' }
            }
          }
        ]
      },
      {
        title: 'Click a bar to cross-highlight',
        width: 680,
        height: 180,
        params: [{ name: 'genrePick', select: { type: 'point', encodings: ['x'] } }],
        mark: 'bar',
        encoding: {
          x: { field: 'Major Genre', type: 'nominal', axis: { labelAngle: -35 }, sort: '-y' },
          y: { aggregate: 'count', type: 'quantitative' },
          color: { condition: { param: 'genrePick', value: '#38bdf8' }, value: '#64748b' },
          tooltip: [{ field: 'Major Genre', type: 'nominal' }, { aggregate: 'count', type: 'quantitative' }]
        }
      }
    ],
    resolve: { legend: { color: 'independent', size: 'independent' } },
    config: {
      background: 'transparent',
      title: { color: '#e2e8f0', fontSize: 18, anchor: 'start' },
      axis: { labelColor: '#94a3b8', titleColor: '#cbd5e1', gridColor: '#334155' },
      legend: { labelColor: '#cbd5e1', titleColor: '#cbd5e1' },
      view: { stroke: 'transparent' }
    }
  };
}

function VegaDashboard({ stateFile }) {
  const ref = React.useRef(null);
  const [error, setError] = React.useState('');
  React.useEffect(() => {
    let cancelled = false;
    let view;
    async function mount() {
      for (const src of VEGA_SCRIPTS) await loadVegaScript(src);
      if (cancelled) return;
      const result = await window.vegaEmbed(ref.current, dashboardSpec(), { actions: false, renderer: 'canvas' });
      view = result.view;
    }
    mount().catch(error => { if (!cancelled) setError(String(error)); });
    return () => {
      cancelled = true;
      if (view) view.finalize();
    };
  }, [stateFile]);
  if (error) return <pre>{error}</pre>;
  return <div ref={ref} style={{ overflowX: 'auto', border: '1px solid var(--vyasa-border)', borderRadius: 12, padding: 12 }} />;
}

export default VegaDashboard;
