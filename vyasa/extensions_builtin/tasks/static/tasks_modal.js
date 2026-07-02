export function createTasksModalController({
    renderTasksGraphs,
    tasksHeaderButtonHtml,
    tasksHeaderControlsHtml,
    syncTasksFullscreenButton,
    constants,
}) {
    const {
        TASKS_PROJECTION_GROUP_OPACITY_DEFAULT,
        TASKS_PROJECTION_UNSPECIFIED_GROUP_OPACITY_DEFAULT,
        TASKS_PROJECTION_UNSPECIFIED_CONTENT_OPACITY_DEFAULT,
        TASKS_ROOT_SPACING,
        TASKS_ROOT_COLLISION_GAP,
        TASKS_GROUP_PADDING,
    } = constants;

    async function openTasksGraphModal(wrapper, options = {}) {
        if (!wrapper) return;
        if (options.inline) {
            document.querySelectorAll('[data-tasks-inline-ego="true"]').forEach((el) => {
                if (el.__tasksEscHandler) document.removeEventListener('keydown', el.__tasksEscHandler, true);
                el.remove();
            });
        }
        const originalTitle = options.title || wrapper.getAttribute('data-tasks-title') || 'Tasks';
        const originalPayload = options.payload || wrapper.getAttribute('data-tasks-payload');
        const originalGraph = options.graph || wrapper.getAttribute('data-tasks-graph');
        if (!originalPayload || !originalGraph) return;
        const existing = document.getElementById('tasks-fullscreen-modal');
        const closeTasksGraphModal = (modal) => {
            if (!modal) return;
            if (modal.__tasksEscHandler) {
                document.removeEventListener('keydown', modal.__tasksEscHandler, true);
                modal.__tasksEscHandler = null;
            }
            if (modal.__tasksSuspendedMaximizeWrapper?.__tasksMaximizeEsc) {
                document.addEventListener('keydown', modal.__tasksSuspendedMaximizeWrapper.__tasksMaximizeEsc, true);
            }
            const suspended = modal.__tasksSuspendedModal;
            if (modal.isConnected) modal.remove();
            try { options.onClose?.(); } catch { /* noop */ }
            if (suspended) {
                suspended.style.display = '';
                suspended.removeAttribute('data-tasks-suspended');
                if (suspended.__tasksEscHandler) document.addEventListener('keydown', suspended.__tasksEscHandler, true);
            }
        };
        let suspendedModal = null;
        if (existing) {
            suspendedModal = existing;
            if (suspendedModal.__tasksEscHandler) document.removeEventListener('keydown', suspendedModal.__tasksEscHandler, true);
            suspendedModal.style.display = 'none';
            suspendedModal.setAttribute('data-tasks-suspended', 'true');
        }
        const suspendedMaximizeWrapper = wrapper.getAttribute('data-tasks-maximized') === 'true' && wrapper.__tasksMaximizeEsc
            ? wrapper
            : null;
        if (suspendedMaximizeWrapper) document.removeEventListener('keydown', suspendedMaximizeWrapper.__tasksMaximizeEsc, true);
        const id = wrapper.id || 'tasks';
        const modalWrapperId = options.wrapperId || `${id}-fullscreen`;
        const modal = document.createElement('div');
        modal.id = 'tasks-fullscreen-modal';
        modal.__tasksSuspendedModal = suspendedModal;
        modal.__tasksSuspendedMaximizeWrapper = suspendedMaximizeWrapper;
        const inline = Boolean(options.inline);
        const mountHost = inline ? (wrapper.querySelector('[data-tasks-canvas="true"]') || wrapper) : document.body;
        if (inline && getComputedStyle(mountHost).position === 'static') mountHost.style.position = 'relative';
        if (inline) { modal.setAttribute('data-tasks-inline-ego', 'true'); modal.style.zIndex = '9999'; }
        modal.className = inline ? 'absolute inset-0 overflow-hidden' : 'fixed inset-0 z-[10000] bg-black/88 backdrop-blur-sm';
        modal.style.animation = 'fadeIn 0.2s ease-in';

        const modalContent = document.createElement('div');
        modalContent.className = 'relative w-full h-full flex flex-col';
        modalContent.style.background = inline ? 'var(--vyasa-paper)' : 'color-mix(in srgb, var(--vyasa-paper) 96%, transparent)';
        modalContent.style.color = 'var(--vyasa-ink)';
        const body = document.createElement('div');
        body.className = 'flex-1 overflow-hidden';
        body.style.background = 'transparent';
        const fullscreenWrapper = document.createElement('div');
        fullscreenWrapper.id = modalWrapperId;
        fullscreenWrapper.className = 'tasks-container relative';
        fullscreenWrapper.style.display = 'flex';
        fullscreenWrapper.style.flexDirection = 'column';
        fullscreenWrapper.style.width = '100%';
        fullscreenWrapper.style.height = '100%';
        fullscreenWrapper.style.minHeight = '0';
        fullscreenWrapper.setAttribute('data-tasks-widget', 'true');
        fullscreenWrapper.setAttribute('data-tasks-fullscreen', 'true');
        if (options.ego) fullscreenWrapper.setAttribute('data-tasks-ego', 'true');
        fullscreenWrapper.setAttribute('data-tasks-title', originalTitle);
        fullscreenWrapper.setAttribute('data-tasks-default-open-depth', options.ego ? '-1' : (wrapper.getAttribute('data-tasks-default-open-depth') || '0'));
        fullscreenWrapper.setAttribute('data-tasks-gantt', options.ego ? 'false' : (wrapper.getAttribute('data-tasks-gantt') || 'false'));
        fullscreenWrapper.setAttribute('data-tasks-default-view', options.ego ? 'graph' : (wrapper.getAttribute('data-tasks-default-view') || 'graph'));
        fullscreenWrapper.setAttribute('data-tasks-open-filters-default', options.ego ? 'false' : (wrapper.getAttribute('data-tasks-open-filters-default') || 'false'));
        fullscreenWrapper.setAttribute('data-tasks-node-card-width', wrapper.getAttribute('data-tasks-node-card-width') || '480px');
        fullscreenWrapper.setAttribute('data-tasks-hover-font-size', wrapper.getAttribute('data-tasks-hover-font-size') || '12px');
        fullscreenWrapper.setAttribute('data-tasks-projection-group-opacity', wrapper.getAttribute('data-tasks-projection-group-opacity') || `${TASKS_PROJECTION_GROUP_OPACITY_DEFAULT}`);
        fullscreenWrapper.setAttribute('data-tasks-projection-unspecified-group-opacity', wrapper.getAttribute('data-tasks-projection-unspecified-group-opacity') || `${TASKS_PROJECTION_UNSPECIFIED_GROUP_OPACITY_DEFAULT}`);
        fullscreenWrapper.setAttribute('data-tasks-projection-unspecified-content-opacity', wrapper.getAttribute('data-tasks-projection-unspecified-content-opacity') || `${TASKS_PROJECTION_UNSPECIFIED_CONTENT_OPACITY_DEFAULT}`);
        fullscreenWrapper.setAttribute('data-tasks-jitter', wrapper.getAttribute('data-tasks-jitter') || '0');
        fullscreenWrapper.setAttribute('data-tasks-jitter-y', wrapper.getAttribute('data-tasks-jitter-y') || wrapper.getAttribute('data-tasks-jitter') || '0');
        fullscreenWrapper.setAttribute('data-tasks-spacing', wrapper.getAttribute('data-tasks-spacing') || 'normal');
        fullscreenWrapper.setAttribute('data-tasks-layout-direction', wrapper.getAttribute('data-tasks-layout-direction') || 'TD');
        fullscreenWrapper.setAttribute('data-tasks-node-spacing', wrapper.getAttribute('data-tasks-node-spacing') || `${TASKS_ROOT_SPACING.node}`);
        fullscreenWrapper.setAttribute('data-tasks-layer-spacing', wrapper.getAttribute('data-tasks-layer-spacing') || `${TASKS_ROOT_SPACING.layer}`);
        fullscreenWrapper.setAttribute('data-tasks-collision-gap', wrapper.getAttribute('data-tasks-collision-gap') || `${TASKS_ROOT_COLLISION_GAP}`);
        fullscreenWrapper.setAttribute('data-tasks-group-padding', wrapper.getAttribute('data-tasks-group-padding') || `${TASKS_GROUP_PADDING.left}`);
        fullscreenWrapper.setAttribute('data-tasks-edge-label-width', wrapper.getAttribute('data-tasks-edge-label-width') || '240');
        fullscreenWrapper.setAttribute('data-tasks-payload', originalPayload);
        fullscreenWrapper.setAttribute('data-tasks-graph', originalGraph);
        const fullscreenId = fullscreenWrapper.id;
        const headerBar = document.createElement('div');
        headerBar.className = 'px-3 py-2 pr-14 border-b border-slate-200 dark:border-slate-800 flex items-start gap-2 relative';
        headerBar.style.flex = '0 0 auto';
        const topRightControls = document.createElement('div');
        topRightControls.className = 'absolute top-2 right-2 z-10 flex items-center gap-1';
        topRightControls.innerHTML = options.ego
            ? `<div class="flex items-center gap-1 text-[11px] font-medium tracking-wide text-slate-500 dark:text-slate-400 whitespace-nowrap">${tasksHeaderButtonHtml(fullscreenId, 'toggleHelp', '?', 'Show graph shortcuts and gestures')}${tasksHeaderButtonHtml(fullscreenId, 'fit', 'F', 'Fit view')}${tasksHeaderButtonHtml(fullscreenId, 'toggleEdges', 'E', 'Toggle edges')}</div>`
            : tasksHeaderControlsHtml(fullscreenId, false);
        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.title = 'Close (Shift+Esc)';
        closeBtn.className = 'rounded border border-slate-300 dark:border-slate-600 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-1.5 py-0.5 font-mono text-[10px] leading-none text-slate-700 dark:text-slate-300';
        closeBtn.textContent = 'X';
        closeBtn.onclick = () => closeTasksGraphModal(modal);
        topRightControls.appendChild(closeBtn);
        const headerTitle = document.createElement('div');
        headerTitle.className = 'min-w-0 flex-1';
        const filterButton = document.createElement('button');
        filterButton.type = 'button';
        filterButton.title = 'Toggle filters';
        filterButton.setAttribute('aria-label', 'Toggle task filters');
        filterButton.setAttribute('onclick', `runTasksHeaderAction('${fullscreenId}', 'toggleFilters')`);
        filterButton.className = 'relative z-40 mt-0.5 rounded border border-slate-300 dark:border-slate-600 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-2 py-1 font-mono text-xs leading-none text-slate-700 dark:text-slate-300';
        filterButton.textContent = '☰';
        if (options.ego) filterButton.style.display = 'none';
        const headerName = document.createElement('span');
        headerName.className = 'text-xs font-semibold';
        headerName.textContent = originalTitle;
        const headerStats = document.createElement('div');
        headerStats.setAttribute('data-tasks-stats', '');
        headerStats.className = 'mt-1 text-xs font-medium text-slate-500 dark:text-slate-400';
        headerStats.textContent = wrapper.querySelector('[data-tasks-stats]')?.textContent || '';
        headerTitle.append(headerName, headerStats);
        headerBar.append(filterButton, headerTitle, topRightControls);

        const flow = document.createElement('div');
        flow.className = 'vyasa-tasks-flow';
        flow.style.flex = '1 1 auto';
        flow.style.minHeight = '0';
        flow.style.overflow = 'hidden';
        flow.style.cursor = 'grab';
        flow.style.display = 'flex';
        flow.style.flexDirection = 'column';
        flow.style.position = 'relative';

        const scene = document.createElement('div');
        scene.className = 'vyasa-tasks-scene';
        scene.style.position = 'relative';
        scene.style.width = '1200px';
        scene.style.height = '420px';
        scene.style.transformOrigin = 'center center';
        flow.appendChild(scene);
        fullscreenWrapper.appendChild(headerBar);
        fullscreenWrapper.appendChild(flow);

        body.appendChild(fullscreenWrapper);
        modalContent.appendChild(body);
        modal.appendChild(modalContent);
        mountHost.appendChild(modal);

        const escHandler = (event) => {
            if (event.key !== 'Escape' || !event.shiftKey) return;
            if (document.getElementById('tasks-fullscreen-modal') !== modal) return;
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation?.();
            closeTasksGraphModal(modal);
        };
        modal.__tasksEscHandler = escHandler;
        document.addEventListener('keydown', escHandler, true);
        modal.addEventListener('click', (event) => {
            if (event.target === modal) closeTasksGraphModal(modal);
        });
        await renderTasksGraphs(modal);
    }

    function setTasksMaximized(wrapper, on) {
        if (!wrapper) return;
        const isOn = wrapper.getAttribute('data-tasks-maximized') === 'true';
        if (on === isOn) return;
        if (on) {
            wrapper.setAttribute('data-tasks-maximized', 'true');
            wrapper.__tasksPrevBodyOverflow = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            const escHandler = (event) => {
                if (event.key !== 'Escape' || !event.shiftKey) return;
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation?.();
                setTasksMaximized(wrapper, false);
            };
            wrapper.__tasksMaximizeEsc = escHandler;
            document.addEventListener('keydown', escHandler, true);
        } else {
            wrapper.removeAttribute('data-tasks-maximized');
            document.body.style.overflow = wrapper.__tasksPrevBodyOverflow || '';
            if (wrapper.__tasksMaximizeEsc) {
                document.removeEventListener('keydown', wrapper.__tasksMaximizeEsc, true);
                wrapper.__tasksMaximizeEsc = null;
            }
        }
        syncTasksFullscreenButton(wrapper);
        window.requestAnimationFrame(() => {
            window.dispatchEvent(new Event('resize'));
            window.setTimeout(() => window.__vyasaTasksActions?.[wrapper.id]?.fit?.(), 80);
        });
    }

    function openTasksFullscreen(id) {
        const wrapper = document.getElementById(id);
        if (!wrapper) return;
        setTasksMaximized(wrapper, wrapper.getAttribute('data-tasks-maximized') !== 'true');
    }

    async function openTasksEgoModal(wrapper, options = {}) {
        await openTasksGraphModal(wrapper, {
            title: options.includeNeighbors ? `${options.title} + neighbors` : options.title,
            payload: JSON.stringify(options.model || {}),
            graph: JSON.stringify(options.graph || { nodes: [], edges: [] }),
            wrapperId: `${wrapper.id || 'tasks'}-ego-${options.includeNeighbors ? 'neighbors' : 'selected'}`,
            ego: true,
            inline: Boolean(options.inline),
            onClose: options.onClose,
        });
    }

    window.openTasksFullscreen = openTasksFullscreen;
    return { openTasksGraphModal, openTasksEgoModal, setTasksMaximized, openTasksFullscreen };
}
