// Semantic Tailwind colours backed by Vyasa theme tokens. Markup uses
// text-vyasa-muted, bg-vyasa-surface, border-vyasa-border, ... instead of
// fixed palettes (slate, gray, blue), so utility classes follow the active
// preset and switch with light/dark on their own (no dark: twins needed).
(() => {
    const t = (name) => `var(--vyasa-${name})`;
    const vyasa = {
        bg: t('bg'), subtle: t('bg-subtle'), surface: t('surface'),
        hover: t('hover'), active: t('active'),
        border: t('border'), strong: t('border-strong'),
        text: t('ink'), muted: t('text-muted'), faint: t('text-faint'), solid: t('gray-9'),
        inverse: t('gray-12'), 'on-inverse': t('gray-1'),
        accent: t('primary'), 'accent-hover': t('primary-dim'), 'accent-subtle': t('accent-3'),
        'on-accent': t('accent-contrast'), link: t('link'),
    };
    const config = window.tailwind?.config || {};
    config.theme = config.theme || {};
    config.theme.extend = config.theme.extend || {};
    config.theme.extend.colors = { ...(config.theme.extend.colors || {}), vyasa };
    if (window.tailwind) window.tailwind.config = config;
})();
