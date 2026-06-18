(function () {
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
})();
