window.__vyasaTasksPhaseLog?.('tasks-probe:module-start', {
    scripts: Array.from(document.scripts || []).map((script) => ({
        src: script.src || '',
        type: script.type || '',
        async: Boolean(script.async),
        defer: Boolean(script.defer),
    })).slice(-30),
});
