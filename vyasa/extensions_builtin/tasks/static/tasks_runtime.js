let tasksReactFlowReady = null;
let tasksQueryBuilderReady = null;

export function ensureTasksReactFlow() {
    if (tasksReactFlowReady) return tasksReactFlowReady;
    tasksReactFlowReady = (async () => {
        const cssHref = 'https://unpkg.com/@xyflow/react@12.8.4/dist/style.css';
        if (!document.querySelector(`link[href="${cssHref}"]`)) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = cssHref;
            document.head.appendChild(link);
        }
        const tasksCssHref = '/static/extensions/tasks/tasks.css';
        const tasksCssLink = document.querySelector(`link[href="${tasksCssHref}"]`);
        if (tasksCssLink) {
            document.head.appendChild(tasksCssLink);
        }
        for (const src of [
            'https://unpkg.com/react@18/umd/react.production.min.js',
            'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
            'https://unpkg.com/@xyflow/react@12.8.4/dist/umd/index.js',
        ]) {
            if (document.querySelector(`script[src="${src}"]`)) continue;
            await new Promise((resolve, reject) => {
                const s = document.createElement('script');
                s.src = src;
                s.onload = resolve;
                s.onerror = (event) => {
                    console.error('[tasks] script load failed', src, event);
                    reject(event);
                };
                document.head.appendChild(s);
            });
            if (src.includes('react-dom.production.min.js') && window.React && !window.jsxRuntime) {
                window.jsxRuntime = {
                    Fragment: window.React.Fragment,
                    jsx: (type, props, key) => window.React.createElement(type, { ...props, key }),
                    jsxs: (type, props, key) => window.React.createElement(type, { ...props, key }),
                };
            }
        }
        return window.React && window.ReactDOM && window.ReactFlow
            ? window.ReactFlow
            : null;
    })();
    return tasksReactFlowReady;
}

export function ensureTasksQueryBuilder() {
    if (window.VyasaTasksQueryBuilder?.QueryBuilder) return Promise.resolve(window.VyasaTasksQueryBuilder);
    if (tasksQueryBuilderReady) return tasksQueryBuilderReady;
    tasksQueryBuilderReady = (async () => {
        const cssHref = '/static/extensions/tasks/vendor/react-querybuilder.css';
        if (!document.querySelector(`link[href="${cssHref}"]`)) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = cssHref;
            document.head.appendChild(link);
        }
        const src = '/static/extensions/tasks/vendor/react-querybuilder.global.js';
        if (!document.querySelector(`script[src="${src}"]`)) {
            await new Promise((resolve, reject) => {
                const s = document.createElement('script');
                s.src = src;
                s.onload = resolve;
                s.onerror = (event) => {
                    console.error('[tasks] script load failed', src, event);
                    reject(event);
                };
                document.head.appendChild(s);
            });
        }
        return window.VyasaTasksQueryBuilder || null;
    })();
    return tasksQueryBuilderReady;
}
