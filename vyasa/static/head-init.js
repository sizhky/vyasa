(function () {
    function phaseLog(label, payload = {}) {
        const params = new URLSearchParams(window.location.search || '');
        if (!params.has('tasks_perf') && !params.has('tasks_debug')) return;
        window.__vyasaTasksPerf = window.__vyasaTasksPerf || {};
        window.__vyasaTasksPerf.fileLogReset = window.__vyasaTasksPerf.fileLogReset || new Set();
        const host = window.location.host;
        const path = window.location.pathname;
        const key = `${host}${path}`;
        const reset = !window.__vyasaTasksPerf.fileLogReset.has(key);
        window.__vyasaTasksPerf.fileLogReset.add(key);
        const body = JSON.stringify({
            label,
            at: new Date().toISOString(),
            host,
            path,
            reset,
            payload: { now: Math.round(performance.now()), readyState: document.readyState, ...payload },
        });
        fetch('/api/tasks/perf-log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
            keepalive: body.length < 60000,
        }).catch(() => {});
    }

    function resourceSnapshot() {
        const resources = performance.getEntriesByType?.('resource') || [];
        const origin = window.location.origin;
        return resources
            .filter((entry) => {
                const name = entry.name || '';
                if (/\/api\/tasks\/perf-log/.test(name)) return false;
                return name.startsWith(origin) || /cdn\.jsdelivr|unpkg|esm\.sh|cdnjs/.test(name);
            })
            .slice(-40)
            .map((entry) => ({
                name: String(entry.name || '').replace(origin, ''),
                initiatorType: entry.initiatorType || '',
                start: Math.round(entry.startTime || 0),
                fetchStart: Math.round(entry.fetchStart || 0),
                requestStart: Math.round(entry.requestStart || 0),
                responseStart: Math.round(entry.responseStart || 0),
                responseEnd: Math.round(entry.responseEnd || 0),
                duration: Math.round(entry.duration || 0),
                transferSize: entry.transferSize || 0,
            }));
    }

    window.__vyasaTasksPhaseLog = phaseLog;
    phaseLog('head-init:start');

    function applyStoredThemePreset(franken) {
        const presets = window.__VYASA_THEME_PRESETS__ || {};
        const meta = window.__VYASA_THEME_EXTENSION_META__ || {};
        const requested = typeof franken?.preset === 'string' ? franken.preset : '';
        let resolved = typeof franken?.resolvedPreset === 'string' ? franken.resolvedPreset : '';
        if (!requested) return franken;
        if (!resolved && meta[requested]?.randomizable && Array.isArray(meta[requested]?.choices)) {
            resolved = meta[requested].choices.find((name) => presets[name]) || '';
        }
        const theme = presets[resolved || requested];
        if (!theme) return franken;
        Object.entries(theme).forEach(([key, value]) => {
            if (!key.startsWith('theme_') || !value || key === 'theme_preset') return;
            const cssName = key === 'theme_body_font' ? '--vyasa-font-body'
                : key === 'theme_heading_font' ? '--vyasa-font-heading'
                : key === 'theme_ui_font' ? '--vyasa-font-ui'
                : key === 'theme_mono_font' ? '--vyasa-font-mono'
                : `--vyasa-${key.slice(6).replace(/_/g, '-')}`;
            document.documentElement.style.setProperty(cssName, String(value));
        });
        if (theme.theme_primary && !theme.theme_primary_dim) {
            document.documentElement.style.setProperty('--vyasa-primary-dim', `color-mix(in srgb, ${theme.theme_primary} 82%, black)`);
        }
        franken.resolvedPreset = resolved || requested;
        return franken;
    }

    try {
        ['posts', 'toc'].forEach((kind) => {
            const stored = localStorage.getItem(`vyasa-${kind}-sidebar-hidden`);
            if (stored === '1' || (kind === 'toc' && stored !== '0')) {
                document.documentElement.setAttribute(`data-vyasa-hide-${kind}-sidebar`, '');
            }
        });
    } catch (_) {}

    const prefersDark = !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    let franken = { mode: prefersDark ? 'dark' : 'light' };
    try {
        const stored = localStorage.getItem('__FRANKEN__');
        if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed && (parsed.mode === 'light' || parsed.mode === 'dark')) {
                franken = parsed;
            }
        }
    } catch (_) {}

    if (franken.mode === 'dark') {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }

    franken = applyStoredThemePreset(franken);

    function syncHighlightTheme() {
        const dark = document.documentElement.classList.contains('dark');
        const lightLink = document.getElementById('hljs-light');
        const darkLink = document.getElementById('hljs-dark');
        if (lightLink) lightLink.disabled = dark;
        if (darkLink) darkLink.disabled = !dark;
    }

    syncHighlightTheme();
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', syncHighlightTheme, { once: true });
    } else {
        syncHighlightTheme();
    }
    new MutationObserver(syncHighlightTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    function normalizeBodyThemeClasses() {
        if (!document.body) return;
        document.body.classList.remove('bg-background', 'text-foreground');
    }

    if (document.body) {
        normalizeBodyThemeClasses();
    } else {
        document.addEventListener('DOMContentLoaded', normalizeBodyThemeClasses, { once: true });
    }

    localStorage.setItem('__FRANKEN__', JSON.stringify(franken));
    phaseLog('head-init:end', { resources: resourceSnapshot() });
    document.addEventListener('readystatechange', () => {
        phaseLog(`document:${document.readyState}`, { resources: resourceSnapshot() });
    });
    window.addEventListener('load', () => {
        phaseLog('window:load', {
            navigation: performance.getEntriesByType?.('navigation')?.[0]?.toJSON?.() || null,
            resources: resourceSnapshot(),
        });
    }, { once: true });
})();
