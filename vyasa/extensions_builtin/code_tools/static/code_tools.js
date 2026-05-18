function getCodeThemeMeta(name) {
    return document.querySelector(`meta[name="${name}"]`)?.getAttribute('content') || '';
}

function getHljsThemeHref(themeName) {
    return `https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/${themeName}.min.css`;
}

function ensureCodeThemeLinks() {
    const lightTheme = getCodeThemeMeta('vyasa-code-theme-light');
    const darkTheme = getCodeThemeMeta('vyasa-code-theme-dark');
    if (!lightTheme || !darkTheme) return;
    let lightLink = document.getElementById('hljs-light');
    if (!lightLink) {
        lightLink = document.createElement('link');
        lightLink.id = 'hljs-light';
        lightLink.rel = 'stylesheet';
        lightLink.dataset.defaultTheme = lightTheme;
        document.head.appendChild(lightLink);
    }
    let darkLink = document.getElementById('hljs-dark');
    if (!darkLink) {
        darkLink = document.createElement('link');
        darkLink.id = 'hljs-dark';
        darkLink.rel = 'stylesheet';
        darkLink.dataset.defaultTheme = darkTheme;
        document.head.appendChild(darkLink);
    }
    lightLink.href = getHljsThemeHref(lightTheme);
    darkLink.href = getHljsThemeHref(darkTheme);
    const dark = document.documentElement.classList.contains('dark');
    lightLink.disabled = dark;
    darkLink.disabled = !dark;
}

function copyCodeText(text) {
    const done = () => {
        let toast = document.getElementById('code-copy-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'code-copy-toast';
            toast.className = 'fixed top-6 right-6 z-[10000] text-xs bg-slate-900 text-white px-3 py-2 rounded shadow-lg opacity-0 transition-opacity duration-300';
            toast.textContent = 'Copied';
            document.body.appendChild(toast);
        }
        toast.classList.remove('opacity-0');
        toast.classList.add('opacity-100');
        setTimeout(() => {
            toast.classList.remove('opacity-100');
            toast.classList.add('opacity-0');
        }, 1400);
    };
    const fallback = () => {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'absolute';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        done();
    };
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(done).catch(fallback);
        return;
    }
    fallback();
}

function handleCodeCopyClick(event) {
    const button = event.target.closest('.code-copy-button, .hljs-copy-button');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    const container = button.closest('.code-block') || button.closest('pre') || button.parentElement;
    const codeEl = (container && container.querySelector('pre > code')) ||
        (container && container.querySelector('code')) ||
        button.closest('pre');
    if (!codeEl) return;
    copyCodeText(codeEl.innerText || codeEl.textContent || '');
}

function initCodeBlockCopyButtons(rootElement = document) {
    const template = document.getElementById('vyasa-code-copy-tpl');
    if (!template) return;
    rootElement.querySelectorAll('.code-block').forEach((block) => {
        if (block.querySelector('.code-copy-button')) return;
        const button = template.content.firstElementChild.cloneNode(true);
        block.insertBefore(button, block.firstChild);
    });
}

function initCodeHighlighting(rootElement = document) {
    if (!window.hljs) return;
    rootElement.querySelectorAll('pre > code').forEach((code) => {
        if (code.dataset.hljsBound === 'true') return;
        if (code.closest('.mermaid-wrapper,.d2-wrapper')) return;
        window.hljs.highlightElement(code);
        code.dataset.hljsBound = 'true';
    });
}

function initHighlightedCodeIncludes(rootElement = document) {
    rootElement.querySelectorAll('code[data-code-highlight-lines], code[data-code-line-numbers="true"]').forEach((code) => {
        if (code.querySelector('.vyasa-code-line')) return;
        const start = Number(code.dataset.codeSourceStart || '1');
        const languageClass = Array.from(code.classList).find((cls) => cls.startsWith('language-'));
        const language = languageClass ? languageClass.replace(/^language-/, '') : '';
        const ranges = String(code.dataset.codeHighlightLines || '').split(',').map((part) => part.trim()).filter(Boolean);
        const highlighted = new Set();
        ranges.forEach((part) => {
            const [a, b] = part.split('-').map((value) => Number(value));
            for (let n = a; n <= (b || a); n += 1) highlighted.add(n);
        });
        const lines = code.textContent.split('\n');
        if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
        code.innerHTML = lines.map((line, index) => {
            const lineNo = start + index;
            const isHighlighted = highlighted.has(lineNo);
            const isStart = isHighlighted && !highlighted.has(lineNo - 1);
            const isEnd = isHighlighted && !highlighted.has(lineNo + 1);
            const cls = [
                'vyasa-code-line',
                isHighlighted ? 'vyasa-code-line-highlight' : '',
                isStart ? 'vyasa-code-line-highlight-start' : '',
                isEnd ? 'vyasa-code-line-highlight-end' : '',
            ].filter(Boolean).join(' ');
            let htmlLine = line ? line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : '&nbsp;';
            if (line && window.hljs) {
                try {
                    htmlLine = language && window.hljs.getLanguage(language)
                        ? window.hljs.highlight(line, { language, ignoreIllegals: true }).value
                        : window.hljs.highlightAuto(line).value;
                } catch (_) {}
            }
            return `<span class="${cls}" data-source-line="${lineNo}">${htmlLine}</span>`;
        }).join('\n');
        code.classList.add('vyasa-code-lines');
        code.dataset.hljsBound = 'true';
    });
}

function scheduleHighlightedCodeIncludes(rootElement = document) {
    const target = rootElement || document;
    initCodeHighlighting(target);
    initHighlightedCodeIncludes(target);
    if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => {
            initCodeHighlighting(target);
            initHighlightedCodeIncludes(target);
        });
    }
    [40, 140, 320].forEach((delay) => setTimeout(() => {
        initCodeHighlighting(target);
        initHighlightedCodeIncludes(target);
    }, delay));
}

function initCodeTools(rootElement = document) {
    ensureCodeThemeLinks();
    initCodeBlockCopyButtons(rootElement);
    scheduleHighlightedCodeIncludes(rootElement);
}

if (!window.__vyasaCodeToolsBound) {
    window.__vyasaCodeToolsBound = true;
    document.addEventListener('click', handleCodeCopyClick, true);
}

window.__vyasaInitCodeTools = initCodeTools;
window.__vyasaSyncCodeThemeLinks = ensureCodeThemeLinks;
