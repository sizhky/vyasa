export function createTasksFullscreenController({ syncTasksFullscreenButton }) {
    function setTasksMaximized(wrapper, on, options = {}) {
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
                if (wrapper.getAttribute('data-tasks-ego-active') === 'true') {
                    window.__vyasaTasksActions?.[wrapper.id]?.closeEgo?.();
                    return;
                }
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
            if (options.fit !== false) {
                window.setTimeout(() => window.__vyasaTasksActions?.[wrapper.id]?.fit?.(), 80);
            }
        });
    }

    function openTasksFullscreen(id) {
        const wrapper = document.getElementById(id);
        if (!wrapper) return;
        setTasksMaximized(wrapper, wrapper.getAttribute('data-tasks-maximized') !== 'true');
    }

    window.openTasksFullscreen = openTasksFullscreen;
    return { setTasksMaximized, openTasksFullscreen };
}
