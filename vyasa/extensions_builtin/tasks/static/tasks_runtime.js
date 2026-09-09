import { ensureReact, loadScript } from '../../../static/page_shell.js';

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
        await ensureReact();
        if (!window.jsxRuntime) {
            window.jsxRuntime = {
                Fragment: window.React.Fragment,
                jsx: (type, props, key) => window.React.createElement(type, { ...props, key }),
                jsxs: (type, props, key) => window.React.createElement(type, { ...props, key }),
            };
        }
        await loadScript('https://unpkg.com/@xyflow/react@12.8.4/dist/umd/index.js', () => Boolean(window.ReactFlow));
        return window.React && window.ReactDOM && window.ReactFlow
            ? window.ReactFlow
            : null;
    })().catch((error) => {
        tasksReactFlowReady = null;
        throw error;
    });
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
        await loadScript(src, () => Boolean(window.VyasaTasksQueryBuilder?.QueryBuilder));
        return window.VyasaTasksQueryBuilder || null;
    })().catch((error) => {
        tasksQueryBuilderReady = null;
        throw error;
    });
    return tasksQueryBuilderReady;
}
