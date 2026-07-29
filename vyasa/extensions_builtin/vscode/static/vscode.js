function configuredCodeSuffixes() {
    const value = document.querySelector('#main-content')?.dataset.vscodeCodeSuffixes || '';
    return new Set(value.split(',').filter(Boolean));
}

export function codeReferenceFromHref(href, baseHref, codeSuffixes) {
    try {
        const url = new URL(href, baseHref);
        if (url.origin !== new URL(baseHref).origin) return null;
        const routePath = url.pathname.startsWith('/posts/')
            ? url.pathname.slice('/posts/'.length)
            : url.pathname.replace(/^\/+/, '');
        const path = decodeURIComponent(routePath);
        const suffix = path.includes('.') ? `.${path.split('.').pop().toLowerCase()}` : '';
        if (!codeSuffixes.has(suffix) || url.searchParams.has('ref')) return null;
        return {
            path,
            symbol: url.searchParams.get('symbol') || '',
            kind: url.searchParams.get('kind') || '',
        };
    } catch (_) {
        return null;
    }
}

export function codePathFromHref(href, baseHref, codeSuffixes) {
    return codeReferenceFromHref(href, baseHref, codeSuffixes)?.path || null;
}

async function openCodeReference(reference) {
    const response = await fetch('/api/vscode/open', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(reference),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || `VS Code failed (${response.status})`);
    if (payload.uri) window.location.href = payload.uri;
    window.__vyasaToast?.(`Opened ${reference.path.split('/').pop()} in VS Code`, 'success');
}

if (typeof document !== 'undefined' && !window.__vyasaVSCodeBound) {
    window.__vyasaVSCodeBound = true;
    document.addEventListener('click', (event) => {
        if (event.button !== 0) return;
        const anchor = event.target.closest?.('a[href]');
        const reference = anchor && !anchor.hasAttribute('download')
            ? codeReferenceFromHref(anchor.getAttribute('href'), window.location.href, configuredCodeSuffixes())
            : null;
        if (!reference) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        openCodeReference(reference).catch((error) => window.__vyasaToast?.(error.message, 'error'));
    }, true);
}
