const logPrefix = '[vyasa][git-refs]';

function toast(message, tone = 'info') {
    window.__vyasaToast?.(message, tone);
}

function currentPath() {
    return window.__vyasaCurrentPostsSearchPath?.() || '';
}

function setBusy(control, busy) {
    if (!control) return;
    if ('disabled' in control) control.disabled = busy;
    control.setAttribute('aria-busy', busy ? 'true' : 'false');
    control.setAttribute('aria-disabled', busy ? 'true' : 'false');
    control.style.pointerEvents = busy ? 'none' : '';
    control.querySelector?.('svg')?.classList.toggle('animate-spin', busy);
    const check = control.querySelector?.('[data-ref-check]');
    const spinner = control.querySelector?.('[data-ref-spinner]');
    if (check) check.style.display = busy ? 'none' : 'inline-flex';
    if (spinner) spinner.style.display = busy ? 'inline-flex' : 'none';
}

export async function requestRefAction(url, fetchImpl = fetch) {
    const response = await fetchImpl(url, {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
    });
    let payload = {};
    try {
        payload = await response.json();
    } catch (error) {
        payload = {};
    }
    if (!response.ok || payload.ok === false) {
        throw new Error(payload.message || `Ref action failed (${response.status}).`);
    }
    return payload;
}

export function refResultMessage(payload, refName = '') {
    if (refName) {
        return payload.ref_outcome === 'updated' ? `Updated ${refName}` : `${refName} already current`;
    }
    const count = (payload.changed_refs?.length || 0) + (payload.added_refs?.length || 0) + (payload.removed_refs?.length || 0);
    return payload.outcome === 'updated' ? `Updated ${count} ref${count === 1 ? '' : 's'}` : 'Refs already current';
}

async function refreshSwitcher() {
    const response = await fetch(`/_vyasa/ref-switcher?current_path=${encodeURIComponent(currentPath())}`, {
        credentials: 'same-origin',
        cache: 'no-store',
    });
    const current = document.querySelector('.vyasa-ref-switcher');
    if (response.status === 204) {
        current?.remove();
        return;
    }
    if (!response.ok) throw new Error(`Branches menu refresh failed (${response.status}).`);
    const wrapper = document.createElement('div');
    wrapper.innerHTML = await response.text();
    const next = wrapper.querySelector('.vyasa-ref-switcher');
    if (current && next) current.replaceWith(next);
}

async function loadLazySwitcher(details) {
    if (!details || details.dataset.vyasaRefSwitcherLoaded === 'loading') return;
    details.dataset.vyasaRefSwitcherLoaded = 'loading';
    try {
        const response = await fetch(details.dataset.vyasaRefSwitcherUrl || `/_vyasa/ref-switcher?current_path=${encodeURIComponent(currentPath())}`, {
            credentials: 'same-origin',
            cache: 'no-store',
        });
        if (!response.ok) throw new Error(`Branches menu load failed (${response.status}).`);
        const wrapper = document.createElement('div');
        wrapper.innerHTML = (await response.text()).trim();
        const next = wrapper.querySelector('.vyasa-ref-switcher');
        if (!next) throw new Error('Branches menu response was empty.');
        next.open = true;
        details.replaceWith(next);
    } catch (error) {
        console.error(`${logPrefix} action:failed`, { operation: 'load', error });
        toast(error.message, 'error');
        details.dataset.vyasaRefSwitcherLoaded = '';
    }
}

async function refreshVisibleRefContent(payload) {
    const work = [refreshSwitcher(), window.__vyasaSoftRefreshPostsSidebar?.({ reason: 'git-ref-refresh' })];
    if (payload.outcome === 'updated') {
        work.push(window.__vyasaSoftRefreshActiveContent?.({ activePaths: [currentPath()] }));
    }
    await Promise.all(work);
}

async function runRefresh(control, url, refName = '') {
    setBusy(control, true);
    console.info(`${logPrefix} action:start`, { operation: refName ? 'refresh-ref' : 'refresh-root', ref: refName, url });
    try {
        const payload = await requestRefAction(url);
        await refreshVisibleRefContent(payload);
        console.info(`${logPrefix} action:complete`, payload);
        toast(refResultMessage(payload, refName), 'success');
    } catch (error) {
        console.error(`${logPrefix} action:failed`, { operation: refName ? 'refresh-ref' : 'refresh-root', ref: refName, error });
        toast(error.message, 'error');
    } finally {
        setBusy(control, false);
    }
}

function navigationControl(event) {
    return event.detail?.elt?.closest?.('[data-vyasa-ref-select="true"]')
        || event.target?.closest?.('[data-vyasa-ref-select="true"]');
}

function navigationSucceeded(event) {
    if (typeof event.detail?.successful === 'boolean') return event.detail.successful;
    const status = event.detail?.xhr?.status || 0;
    return status >= 200 && status < 400;
}

if (typeof document !== 'undefined') {
    document.addEventListener('click', (event) => {
        const lazySummary = event.target.closest?.('details[data-vyasa-ref-switcher-lazy="true"] > summary');
        if (lazySummary) {
            event.preventDefault();
            loadLazySwitcher(lazySummary.parentElement);
            return;
        }
        const refRefresh = event.target.closest?.('[data-vyasa-ref-tree-refresh="true"]');
        if (refRefresh) {
            event.preventDefault();
            event.stopPropagation();
            runRefresh(
                refRefresh,
                `/_vyasa/refresh-ref-tree/${encodeURIComponent(refRefresh.dataset.sidebarPath || '')}`,
                refRefresh.dataset.refName || '',
            );
            return;
        }
        const rootRefresh = event.target.closest?.('[data-vyasa-ref-root-refresh="true"]');
        if (rootRefresh) {
            event.preventDefault();
            event.stopPropagation();
            const root = rootRefresh.dataset.root || '';
            runRefresh(rootRefresh, root ? `/_vyasa/refresh-refs/root/${encodeURIComponent(root)}` : '/_vyasa/refresh-refs');
        }
    });

    document.body.addEventListener('htmx:beforeRequest', (event) => {
        const control = navigationControl(event);
        if (!control) return;
        setBusy(control, true);
        console.info(`${logPrefix} action:start`, { operation: 'select', ref: control.dataset.refName || '', href: control.getAttribute('href') || '' });
    });

    document.body.addEventListener('htmx:afterRequest', async (event) => {
        const control = navigationControl(event);
        if (!control) return;
        setBusy(control, false);
        const refName = control.dataset.refName || 'ref';
        if (!navigationSucceeded(event)) {
            const status = event.detail?.xhr?.status || 0;
            console.error(`${logPrefix} action:failed`, { operation: 'select', ref: refName, status });
            toast(`Could not open ${refName}${status ? ` (${status})` : ''}`, 'error');
            return;
        }
        try {
            await Promise.all([refreshSwitcher(), window.__vyasaSoftRefreshPostsSidebar?.({ reason: 'git-ref-change' })]);
            console.info(`${logPrefix} action:complete`, { operation: 'select', ref: refName });
            toast(`Viewing ${refName}`, 'success');
        } catch (error) {
            console.error(`${logPrefix} action:failed`, { operation: 'select-refresh', ref: refName, error });
            toast(error.message, 'error');
        }
    });
}
