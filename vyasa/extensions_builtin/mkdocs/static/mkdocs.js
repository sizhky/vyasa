// vyasa manual/mkdocs-compatibility.md#navigation — keep the active header tab and
// the sidebar's visible subtree in step with htmx navigation.
(() => {
    const currentSlug = () => {
        const path = decodeURIComponent(window.location.pathname).replace(/^\/+|\/+$/g, '');
        const slug = path.replace(/^posts\//, '');
        return slug || 'index';
    };

    const activeTabIndex = () => {
        const slug = currentSlug();
        for (const tab of document.querySelectorAll('#vyasa-mkdocs-tabs [data-mkdocs-tab]')) {
            let pages = [];
            try { pages = JSON.parse(tab.dataset.mkdocsPages || '[]'); } catch (_) {}
            if (pages.includes(slug)) return tab.dataset.mkdocsTab;
        }
        const row = document.querySelector(`#posts-sidebar a[data-path="${CSS.escape(slug)}"]`);
        return row?.closest('[data-mkdocs-tab]')?.dataset.mkdocsTab ?? null;
    };

    const sync = () => {
        const tabs = document.getElementById('vyasa-mkdocs-tabs');
        if (!tabs) return;
        document.documentElement.dataset.mkdocsTabs = '';
        const index = activeTabIndex() ?? document.querySelector('#vyasa-mkdocs-tabs .is-active')?.dataset.mkdocsTab ?? '0';
        tabs.querySelectorAll('[data-mkdocs-tab]').forEach((tab) => tab.classList.toggle('is-active', tab.dataset.mkdocsTab === index));
        document.querySelectorAll('#posts-sidebar li[data-mkdocs-tab]').forEach((li) => li.classList.toggle('is-active-tab', li.dataset.mkdocsTab === index));
    };

    document.addEventListener('DOMContentLoaded', sync);
    document.addEventListener('htmx:afterSettle', sync);
    window.addEventListener('popstate', () => setTimeout(sync, 0));
    sync();
})();
