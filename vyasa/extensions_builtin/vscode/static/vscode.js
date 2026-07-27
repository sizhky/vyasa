function configuredCodeSuffixes() {
    const value = document.querySelector('#main-content')?.dataset.vscodeCodeSuffixes || '';
    return new Set(value.split(',').filter(Boolean));
}

export function codePathFromHref(href, baseHref, codeSuffixes) {
    try {
        const url = new URL(href, baseHref);
        if (url.origin !== new URL(baseHref).origin) return null;
        const routePath = url.pathname.startsWith('/posts/')
            ? url.pathname.slice('/posts/'.length)
            : url.pathname.replace(/^\/+/, '');
        const path = decodeURIComponent(routePath);
        const suffix = path.includes('.') ? `.${path.split('.').pop().toLowerCase()}` : '';
        return codeSuffixes.has(suffix) && !url.searchParams.has('ref') ? path : null;
    } catch (_) {
        return null;
    }
}

async function openCodePath(path) {
    const response = await fetch('/api/vscode/open', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ path }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || `VS Code failed (${response.status})`);
    window.__vyasaToast?.(`Opened ${path.split('/').pop()} in VS Code`, 'success');
}

if (typeof document !== 'undefined' && !window.__vyasaVSCodeBound) {
    window.__vyasaVSCodeBound = true;
    document.addEventListener('click', (event) => {
        if (event.button !== 0) return;
        const anchor = event.target.closest?.('a[href]');
        const path = anchor && !anchor.hasAttribute('download')
            ? codePathFromHref(anchor.getAttribute('href'), window.location.href, configuredCodeSuffixes())
            : null;
        if (!path) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        openCodePath(path).catch((error) => window.__vyasaToast?.(error.message, 'error'));
    }, true);
}
