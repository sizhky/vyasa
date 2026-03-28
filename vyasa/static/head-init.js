(function () {
    let franken = { mode: 'light' };
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
