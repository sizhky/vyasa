export class LinkPreviewStack {
    constructor({ createView, fetchPreview }) {
        this.createView = createView;
        this.fetchPreview = fetchPreview;
        this.entries = new Set();
        this.entriesByLink = new Map();
    }

    open(link, point) {
        const href = link.getAttribute('href') || '';
        if (!href) return null;
        const existing = this.entriesByLink.get(link);
        if (existing) return existing;

        let entry;
        const view = this.createView({
            point,
            link,
            onClose: () => this.close(entry),
        });
        entry = {
            link,
            view,
            abort: new AbortController(),
        };
        this.entries.add(entry);
        this.entriesByLink.set(link, entry);
        this.load(
            entry,
            href,
            link.dataset.vyasaLinkPreviewCurrentPath || '',
            link.dataset.vyasaCodeReference || '',
        );
        return entry;
    }

    close(entry) {
        if (!entry || !this.entries.delete(entry)) return;
        entry.abort.abort();
        this.entriesByLink.delete(entry.link);
        entry.view.remove();
    }

    replace(entry, link) {
        const href = link?.getAttribute('href') || '';
        if (!href || !this.entries.has(entry)) return false;
        entry.abort.abort();
        this.entriesByLink.delete(entry.link);
        entry.link = link;
        entry.abort = new AbortController();
        this.entriesByLink.set(link, entry);
        entry.view.setLink?.(link);
        this.load(entry, href, link.dataset.vyasaLinkPreviewCurrentPath || '', link.dataset.vyasaCodeReference || '');
        return true;
    }

    pin(entry) {
        if (!entry || !this.entries.has(entry)) return false;
        entry.view.pin?.();
        return true;
    }

    closeLatest() {
        const latest = Array.from(this.entries).at(-1);
        if (!latest) return false;
        this.close(latest);
        return true;
    }

    closeAll() {
        Array.from(this.entries).reverse().forEach((entry) => this.close(entry));
    }

    has(entry) {
        return this.entries.has(entry);
    }

    async load(entry, href, currentPath, codeReference) {
        const abort = entry.abort;
        try {
            const content = await this.fetchPreview({
                href,
                currentPath,
                codeReference,
                signal: abort.signal,
            });
            if (!this.entries.has(entry) || entry.abort !== abort) return;
            if (content === null) entry.view.setMessage('Preview unavailable.');
            else entry.view.setContent(content);
        } catch (error) {
            if (!abort.signal.aborted && this.entries.has(entry) && entry.abort === abort) {
                entry.view.setMessage('Preview unavailable.');
            }
        }
    }

    get size() {
        return this.entries.size;
    }
}
