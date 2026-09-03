import embed from 'https://esm.sh/vega-embed@6.26.0?bundle';

// Theme comes from the page, not from the spec, so one spec renders correctly
// in both themes and re-renders when the reader flips the toggle.
const readTheme = () => {
    const styles = getComputedStyle(document.documentElement);
    const pick = (name, fallback) => (styles.getPropertyValue(name) || '').trim() || fallback;
    const ink = pick('--vyasa-ink', '#1a1f1d');
    const soft = pick('--vyasa-ink-soft', '#5a6060');
    return {
        background: 'transparent',
        font: pick('--vyasa-font-ui', 'inherit'),
        arc: { fill: '#6f9f7d' },
        area: { fill: '#6f9f7d' },
        line: { stroke: '#6f9f7d' },
        path: { stroke: '#6f9f7d' },
        rect: { fill: '#6f9f7d' },
        point: { fill: '#6f9f7d', filled: true },
        bar: { fill: '#6f9f7d' },
        title: { color: ink, subtitleColor: soft, fontWeight: 600 },
        axis: {
            domainColor: soft,
            tickColor: soft,
            labelColor: soft,
            titleColor: ink,
            gridColor: soft,
            gridOpacity: 0.18,
        },
        legend: { labelColor: soft, titleColor: ink },
        range: { category: ['#6f9f7d', '#d3a75c', '#8e968f', '#7f9bb0', '#b08f9b', '#c9743f'] },
        view: { stroke: 'transparent' },
    };
};

// `width: "container"` resolves against the mount's measured width. A mount
// that is still zero-wide -- CSS not applied yet, a hidden tab, a font still
// loading -- yields a chart with axes and no plot area. Wait for a real width
// rather than rendering an empty one.
function waitForWidth(node, timeout = 3000) {
    if (node.clientWidth > 0) return Promise.resolve(true);
    return new Promise((resolve) => {
        let settled = false;
        const finish = (ok) => {
            if (settled) return;
            settled = true;
            observer.disconnect();
            clearTimeout(timer);
            resolve(ok);
        };
        const observer = new ResizeObserver(() => {
            if (node.clientWidth > 0) finish(true);
        });
        observer.observe(node);
        const timer = setTimeout(() => finish(node.clientWidth > 0), timeout);
    });
}

async function renderOne(node) {
    const script = node.querySelector('.vyasa-vega__spec');
    const mount = node.querySelector('.vyasa-vega__mount');
    if (!script || !mount) return;
    let spec;
    try {
        spec = JSON.parse(script.textContent);
    } catch (error) {
        mount.innerHTML = '<div class="vyasa-vega__failed">spec is not valid JSON</div>';
        return;
    }
    try {
        // Container width belongs in the SPEC, not in the embed options.
        // vega-embed's `width` option overrides the spec with a NUMBER; handing
        // it the string 'container' yields width="NaN" and a chart that draws
        // its axes and no plot area.
        //
        // `width: "container"` is also only legal on a single or layered view;
        // Vega-Lite rejects it on facet/concat/repeat, so leave those alone.
        const composed = ['facet', 'concat', 'hconcat', 'vconcat', 'repeat']
            .some((key) => spec[key] !== undefined);
        if (!composed && spec.width === undefined) {
            const sized = await waitForWidth(mount);
            spec = sized
                ? { ...spec, width: 'container', autosize: spec.autosize ?? { type: 'fit', contains: 'padding' } }
                : { ...spec, width: 480 };  // rather than render a zero-wide chart
        }
        const result = await embed(mount, spec, {
            actions: node.dataset.actions === 'true',
            renderer: 'svg',
            config: readTheme(),
        });
        node._vyasaVegaView = result.view;
    } catch (error) {
        mount.innerHTML = `<div class="vyasa-vega__failed">${String(error && error.message || error)}</div>`;
    }
}

function renderAll(root = document) {
    root.querySelectorAll('[data-vyasa-vega]').forEach((node) => {
        if (node.dataset.vyasaVegaDone === '1') return;
        node.dataset.vyasaVegaDone = '1';
        renderOne(node);
    });
}

function rerenderAll() {
    document.querySelectorAll('[data-vyasa-vega]').forEach((node) => {
        node.dataset.vyasaVegaDone = '';
        const mount = node.querySelector('.vyasa-vega__mount');
        if (mount) mount.innerHTML = '';
    });
    renderAll();
}

document.addEventListener('DOMContentLoaded', () => renderAll());
document.body?.addEventListener?.('htmx:afterSwap', (event) => renderAll(event.target || document));
new MutationObserver((records) => {
    if (records.some((record) => record.attributeName === 'class')) rerenderAll();
}).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

renderAll();
