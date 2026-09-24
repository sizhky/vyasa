(() => {
    if (window === window.top) return;
    let hovered = null, sent = null;
    const preview = (event, modifiers = event) => {
        if (!event.isTrusted || !(modifiers.metaKey || modifiers.ctrlKey) || !hovered || hovered === sent) return;
        const url = new URL(hovered.href, location.href);
        if (!['http:', 'https:'].includes(url.protocol)) return;
        const rect = hovered.getBoundingClientRect();
        window.parent.postMessage({ type: 'vyasa:external-preview', href: url.href,
            label: hovered.textContent.trim(), x: rect.left, y: rect.bottom }, '*');
        sent = hovered;
    };
    document.addEventListener('pointerover', (event) => {
        if (!event.isTrusted) return;
        const link = event.target.closest?.('a[href]') || null;
        if (hovered !== link) sent = null;
        hovered = link;
        preview(event);
    }, true);
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            if (event.isTrusted && !event.repeat) window.parent.postMessage({ type: 'vyasa:external-preview-close' }, '*');
            return;
        }
        preview(event);
    }, true);
    document.addEventListener('keyup', (event) => { if (!event.metaKey && !event.ctrlKey) sent = null; }, true);
    window.addEventListener('message', (event) => {
        if (event.source !== window.parent || event.data?.type !== 'vyasa:preview-modifier') return;
        if (!event.data.metaKey && !event.data.ctrlKey) sent = null;
        else preview(event, event.data);
    });
    document.addEventListener('pointerout', (event) => {
        if (!event.isTrusted) return;
        if (hovered && !hovered.contains(event.relatedTarget)) hovered = sent = null;
    }, true);
    window.addEventListener('blur', () => { hovered = sent = null; });
})();
