(function () {
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
