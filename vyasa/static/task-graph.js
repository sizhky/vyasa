let flowLibPromise = null;

function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function ensureFlowCss() {
    if (document.querySelector('link[data-vyasa-react-flow]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/@xyflow/react@12.8.4/dist/style.css';
    link.setAttribute('data-vyasa-react-flow', 'true');
    document.head.appendChild(link);
}

async function getFlowLib() {
    if (!flowLibPromise) {
        flowLibPromise = Promise.all([
            import('https://esm.sh/react@18.3.1'),
            import('https://esm.sh/react-dom@18.3.1/client'),
            import('https://esm.sh/@xyflow/react@12.8.4?deps=react@18.3.1,react-dom@18.3.1'),
        ]);
    }
    return flowLibPromise;
}

function parseDependencyIds(value) {
    return String(value || '').trim().replace(/^\[/, '').replace(/\]$/, '').split(',').map((part) => part.trim()).filter(Boolean);
}

function initTaskRegion(region) {
    if (!region || region.dataset.bound === 'true') return;
    region.dataset.bound = 'true';
    const previewModal = region.querySelector('#vyasa-task-preview-modal');
    const previewBody = region.querySelector('#vyasa-task-preview-body');
    const previewStore = region.querySelector('#vyasa-task-preview-store');
    const previewStatus = region.querySelector('#vyasa-task-preview-status');
    const flowHost = region.querySelector('#vyasa-task-flow-host');
    const taskApiUrl = region.dataset.taskApiUrl || '';
    const taskGraph = JSON.parse(region.dataset.taskGraph || '{"nodes":[],"edges":[]}');
    const taskDirection = (region.dataset.taskDirection || 'lr').toLowerCase();
    let activeTaskId = '';

    const closePreview = () => {
        activeTaskId = '';
        previewModal?.classList.add('hidden');
        previewModal?.classList.remove('flex');
        if (previewBody) previewBody.innerHTML = '';
        if (previewStatus) previewStatus.textContent = '';
    };
    const renderEditor = (card) => {
        const attrs = JSON.parse(card.dataset.taskAttrs || '{}');
        const dependencies = JSON.parse(card.dataset.taskDependencies || '[]');
        const dependants = JSON.parse(card.dataset.taskDependants || '[]');
        const attrFields = ['priority', 'points', 'estimate', 'depends_on', 'phase', 'owner'];
        const hiddenAttrs = new Set(['graph_x', 'graph_y']);
        const extraAttrs = Object.entries(attrs).filter(([key]) => !attrFields.includes(key) && !hiddenAttrs.has(key)).map(([key, value]) => `${key}: ${value}`).join('\n');
        return `
      <article class="rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
        <label class="block text-sm"><span class="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Task ID</span><input name="id" value="${esc(card.dataset.taskId || '')}" class="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"></label>
        <label class="mt-4 block text-sm"><span class="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Title</span><input name="title" value="${esc(card.dataset.taskTitle || '')}" class="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"></label>
        <div class="mt-4 grid gap-4 md:grid-cols-2">
          ${attrFields.map((key) => `<label class="block text-sm"><span class="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">${esc(key.replace('_', ' '))}</span><input name="attr:${esc(key)}" value="${esc(attrs[key] || '')}" class="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"></label>`).join('')}
        </div>
        <label class="mt-4 block text-sm"><span class="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Extra fields</span><textarea name="extra_attrs" rows="5" class="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" placeholder="key: value&#10;another_key: value">${esc(extraAttrs)}</textarea></label>
        <div class="mt-5 text-sm text-slate-600 dark:text-slate-300"><b class="mb-2 block uppercase tracking-wide text-slate-500">Dependencies</b><div class="flex flex-wrap gap-2">${dependencies.length ? dependencies.map((dep) => `<button type="button" data-task-preview-trigger="${esc(dep)}" class="rounded border border-slate-200 px-2 py-0.5 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">${esc(dep)}</button>`).join('') : '<span class="text-slate-400">None</span>'}</div><b class="mb-2 mt-4 block uppercase tracking-wide text-slate-500">Dependants</b><div class="flex flex-wrap gap-2">${dependants.length ? dependants.map((dep) => `<button type="button" data-task-preview-trigger="${esc(dep)}" class="rounded border border-slate-200 px-2 py-0.5 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">${esc(dep)}</button>`).join('') : '<span class="text-slate-400">None</span>'}</div></div>
      </article>`;
    };
    const openPreview = (taskId) => {
        const card = previewStore?.querySelector(`[data-task-preview="${CSS.escape(taskId)}"]`);
        if (!card || !previewBody) return;
        activeTaskId = taskId;
        previewBody.innerHTML = renderEditor(card);
        previewModal?.classList.remove('hidden');
        previewModal?.classList.add('flex');
    };
    const parseExtraAttrs = (text) => Object.fromEntries(String(text || '').split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
        const idx = line.indexOf(':');
        return idx >= 0 ? [line.slice(0, idx).trim(), line.slice(idx + 1).trim()] : [line.trim(), ''];
    }).filter(([key]) => key));
    const replaceRefs = (value, fromId, toId) => parseDependencyIds(value).map((dep) => dep === fromId ? toId : dep);
    const persistGraphEdges = async (payload, nextEdges) => {
        const depsByTask = new Map();
        for (const edge of nextEdges || []) {
            if (!edge?.source || !edge?.target || edge.source === edge.target) continue;
            if (!depsByTask.has(edge.target)) depsByTask.set(edge.target, []);
            const deps = depsByTask.get(edge.target);
            if (!deps.includes(edge.source)) deps.push(edge.source);
        }
        payload.chains = {};
        payload.tasks = (payload.tasks || []).map((task) => {
            const attrs = { ...(task.attrs || {}) };
            const deps = depsByTask.get(task.id) || [];
            if (deps.length) attrs.depends_on = `[${deps.join(', ')}]`;
            else delete attrs.depends_on;
            return { ...task, attrs };
        });
    };
    const saveGraphMutation = async (mutate) => {
        if (!taskApiUrl) return false;
        const response = await fetch(taskApiUrl);
        const payload = await response.json();
        mutate(payload);
        const save = await fetch(taskApiUrl, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
        return save.ok;
    };
    const saveTask = async () => {
        if (!taskApiUrl || !activeTaskId || !previewBody) return;
        const form = region.querySelector('#vyasa-task-preview-form');
        const data = new FormData(form);
        const nextId = String(data.get('id') || '').trim();
        if (!nextId) {
            if (previewStatus) previewStatus.textContent = 'Task ID required';
            return;
        }
        const attrs = parseExtraAttrs(data.get('extra_attrs'));
        ['priority', 'points', 'estimate', 'depends_on', 'phase', 'owner'].forEach((key) => {
            const value = String(data.get(`attr:${key}`) || '').trim();
            if (value) attrs[key] = value;
        });
        if (attrs.depends_on && !attrs.depends_on.startsWith('[')) attrs.depends_on = `[${parseDependencyIds(attrs.depends_on).join(', ')}]`;
        if (previewStatus) previewStatus.textContent = 'Saving...';
        const response = await fetch(taskApiUrl);
        const payload = await response.json();
        payload.tasks = (payload.tasks || []).map((task) => {
            if (task.id !== activeTaskId) {
                if (task.attrs?.depends_on && nextId !== activeTaskId) task.attrs.depends_on = `[${replaceRefs(task.attrs.depends_on, activeTaskId, nextId).join(', ')}]`;
                return task;
            }
            return { id: nextId, title: String(data.get('title') || '').trim() || nextId, attrs };
        });
        if (nextId !== activeTaskId) {
            Object.keys(payload.chains || {}).forEach((name) => {
                payload.chains[name] = (payload.chains[name] || []).map((id) => id === activeTaskId ? nextId : id);
            });
        }
        const save = await fetch(taskApiUrl, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
        if (!save.ok) {
            if (previewStatus) previewStatus.textContent = 'Save failed';
            return;
        }
        if (previewStatus) previewStatus.textContent = 'Saved. Reloading...';
        window.location.reload();
    };

    (async () => {
        if (!flowHost) return;
        ensureFlowCss();
        const [ReactNS, ReactDOMNS, FlowNS] = await getFlowLib();
        const React = ReactNS.default || ReactNS;
        const ReactDOMClient = ReactDOMNS.default || ReactDOMNS;
        const { ReactFlow, Background, Controls, Handle, Position, MarkerType, addEdge, applyNodeChanges, applyEdgeChanges } = FlowNS;
        const grid = [24, 24];
        const edgeDefaults = { type: 'bezier', markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 } };
        const isTD = taskDirection === 'td';
        const handleTarget = isTD ? Position.Top : Position.Left;
        const handleSource = isTD ? Position.Bottom : Position.Right;
        const TaskNode = ({ id, data }) => {
            const missing = Array.isArray(data?.missing) ? data.missing : [];
            const warning = missing.length ? React.createElement('span', { className: 'absolute right-3 top-3 text-xs text-amber-500', title: `Missing: ${missing.join(', ')}` }, '⚠︎') : null;
            return React.createElement('button', { type: 'button', onClick: () => openPreview(id), className: 'relative h-[92px] w-[320px] rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left shadow-lg dark:border-slate-700 dark:bg-slate-900' }, React.createElement(Handle, { type: 'target', position: handleTarget, className: '!h-3 !w-3 !border-slate-400 !bg-white dark:!bg-slate-900' }), warning, React.createElement('span', { className: 'block text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500' }, id), React.createElement('span', { className: 'mt-2 block break-words pr-6 text-sm font-semibold text-slate-900 dark:text-slate-100', style: { display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden' } }, data.title || id), React.createElement(Handle, { type: 'source', position: handleSource, className: '!h-3 !w-3 !border-slate-400 !bg-white dark:!bg-slate-900' }));
        };
        const PortalNode = ({ data }) => {
            const open = (event) => {
                event.preventDefault();
                event.stopPropagation();
                if (data?.onOpenPath) data.onOpenPath(data.target_path || []);
            };
            const stop = (event) => event.stopPropagation();
            return React.createElement('button', { type: 'button', onPointerDownCapture: stop, onMouseDownCapture: stop, onPointerUpCapture: open, onMouseUpCapture: open, onClickCapture: open, className: 'nodrag nopan relative w-[220px] rounded-xl border border-dashed border-slate-300 bg-white/90 px-3 py-2 text-left text-xs font-semibold text-slate-500 shadow-sm hover:border-slate-400 hover:bg-white dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-400 dark:hover:bg-slate-900' }, data?.side === 'in' ? React.createElement(Handle, { type: 'source', position: handleSource, isConnectable: false, className: '!h-2.5 !w-2.5 !border-slate-400 !bg-white dark:!bg-slate-900' }) : null, React.createElement('span', { className: 'block truncate', title: data?.title || '' }, data?.title || ''), React.createElement('span', { className: 'mt-1 block text-[10px] uppercase tracking-[0.16em] text-slate-400' }, data?.side === 'in' ? 'Incoming' : 'Outgoing'), data?.side === 'out' ? React.createElement(Handle, { type: 'target', position: handleTarget, isConnectable: false, className: '!h-2.5 !w-2.5 !border-slate-400 !bg-white dark:!bg-slate-900' }) : null);
        };
        const GroupNode = ({ id, data }) => {
            const collapsed = !!data?.collapsed;
            const openGroup = React.useCallback((e) => {
                e.stopPropagation();
                if (data?.onOpen) data.onOpen(id);
            }, [id, data]);
            const count = Array.isArray(data?.descendant_task_ids) ? data.descendant_task_ids.length : (Array.isArray(data?.task_ids) ? data.task_ids.length : 0);
            if (collapsed) {
                return React.createElement('div', { className: 'relative h-full w-full rounded-2xl border border-slate-300 bg-white/25 dark:border-slate-700 dark:bg-slate-900/25' }, React.createElement(Handle, { type: 'target', position: handleTarget, isConnectable: false, className: '!h-3 !w-3 !border-slate-400 !bg-white dark:!bg-slate-800' }), React.createElement('button', {
                    type: 'button', onClick: openGroup,
                    className: 'absolute left-4 top-1/2 flex min-h-[56px] w-[min(22rem,calc(100%-2rem))] -translate-y-1/2 items-center gap-3 rounded-[28px] border border-slate-300 bg-white px-5 py-3 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700',
                }, React.createElement('span', { className: 'min-w-0 flex-1 whitespace-normal break-words text-left text-sm font-semibold leading-tight text-slate-700 dark:text-slate-200', title: data?.title || id }, data?.title || id), React.createElement('span', { className: 'shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500 dark:bg-slate-700 dark:text-slate-400' }, count)), React.createElement(Handle, { type: 'source', position: handleSource, isConnectable: false, className: '!h-3 !w-3 !border-slate-400 !bg-white dark:!bg-slate-800' }));
            }
            return React.createElement('div', { className: 'relative h-full w-full' }, React.createElement('div', {
                className: 'absolute flex items-center gap-2',
                style: { top: -32, left: 0 },
            }, React.createElement('span', { className: 'text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400' }, data?.title || id), React.createElement('button', {
                type: 'button',
                onClick: openGroup,
                className: 'rounded border border-slate-300 px-1.5 py-0 text-[11px] text-slate-400 hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800',
            }, '↗')), React.createElement('div', { className: 'h-full w-full rounded-2xl border-2 border-dashed border-slate-300 bg-white/40 dark:border-slate-700 dark:bg-slate-900/40' }));
        };
        const nodeTypes = { task: TaskNode, group: GroupNode, portal: PortalNode };
        const makeFlowElement = (initialNodes, initialEdges, hostForSnapshot) => {
            const App = () => {
                const rawNodes = initialNodes.map((node) => node.type === 'group' ? node : { ...node, type: 'task' });
                const rawEdges = initialEdges.map((edge) => ({ ...edge, ...edgeDefaults }));
                const baseEdgesRef = React.useRef(rawEdges);
                const projectEdgesForNodes = React.useCallback((baseEdges, nextNodes) => {
                    const taskToGroup = new Map();
                    const groupParent = new Map();
                    const collapsedGroups = new Set();
                    const visibleGroups = new Set();
                    nextNodes.forEach((node) => {
                        if (node.type !== 'group') return;
                        if (!node.hidden) visibleGroups.add(node.id);
                        if (node.data?.parent_group_id) groupParent.set(node.id, node.data.parent_group_id);
                        const taskIds = Array.isArray(node.data?.task_ids) ? node.data.task_ids : [];
                        taskIds.forEach((taskId) => taskToGroup.set(taskId, node.id));
                        if (node.data?.collapsed) collapsedGroups.add(node.id);
                    });
                    const endpointForTask = (taskId) => {
                        let groupId = taskToGroup.get(taskId);
                        while (groupId) {
                            if (collapsedGroups.has(groupId) && visibleGroups.has(groupId)) return groupId;
                            groupId = groupParent.get(groupId);
                        }
                        return taskId;
                    };
                    return baseEdges.map((edge) => {
                        const nextSource = endpointForTask(edge.source);
                        const nextTarget = endpointForTask(edge.target);
                        if (nextSource === nextTarget && (nextSource !== edge.source || nextTarget !== edge.target)) return { ...edge, source: nextSource, target: nextTarget, hidden: true };
                        return { ...edge, source: nextSource, target: nextTarget, hidden: false };
                    });
                }, []);
                const { startNodes, startEdges } = React.useMemo(() => {
                    let ns = rawNodes;
                    for (const gn of rawNodes.filter((n) => n.type === 'group' && n.data?.collapsed)) {
                        const taskIds = new Set(Array.isArray(gn.data?.descendant_task_ids) ? gn.data.descendant_task_ids : (gn.data?.task_ids || []));
                        const groupIds = new Set(Array.isArray(gn.data?.child_group_ids) ? gn.data.child_group_ids : []);
                        ns = ns.map((n) => (taskIds.has(n.id) || groupIds.has(n.id)) ? { ...n, hidden: true } : n);
                    }
                    return { startNodes: ns, startEdges: projectEdgesForNodes(rawEdges, ns) };
                }, []);
                const origGroupStyles = React.useRef(Object.fromEntries(initialNodes.filter((n) => n.type === 'group').map((n) => [n.id, n.data?.expanded_w ? { width: n.data.expanded_w, height: n.data.expanded_h } : n.style])));
                const origGroupPositions = React.useRef(Object.fromEntries(initialNodes.filter((n) => n.type === 'group').map((n) => [n.id, n.data?.expanded_x != null ? { x: n.data.expanded_x, y: n.data.expanded_y } : n.position])));
                const [nodes, setNodes] = React.useState(startNodes);
                const nodesRef = React.useRef(startNodes);
                React.useEffect(() => { nodesRef.current = nodes; }, [nodes]);
                const [edges, setEdges] = React.useState(startEdges);
                const [semanticZoom, setSemanticZoom] = React.useState(0.6);
                const [drillPath, setDrillPath] = React.useState([]);
                const drillGroupId = drillPath[drillPath.length - 1] || null;
                const openDrillGroup = React.useCallback((groupId) => {
                    setDrillPath((path) => path.includes(groupId) ? path.slice(0, path.indexOf(groupId) + 1) : [...path, groupId]);
                }, []);
                const openDrillPath = React.useCallback((path) => {
                    const cleanPath = Array.isArray(path) ? path.filter(Boolean) : [];
                    if (cleanPath.length) setDrillPath(cleanPath);
                }, []);
                const closeDrillGroup = React.useCallback(() => setDrillPath((path) => path.slice(0, -1)), []);
                const toggleGroup = React.useCallback(async (groupId) => {
                    let nextCollapsed;
                    let nextNodesSnapshot = null;
                    setNodes((prev) => {
                        const groupNode = prev.find((n) => n.id === groupId);
                        if (!groupNode) return prev;
                        nextCollapsed = !groupNode.data?.collapsed;
                        const childIds = new Set(Array.isArray(groupNode.data?.task_ids) ? groupNode.data.task_ids : []);
                        nextNodesSnapshot = prev.map((n) => {
                            if (n.id === groupId) {
                                const collapsedStyle = { width: n.data?.collapsed_w || 360, height: n.data?.collapsed_h || 88 };
                                const nextStyle = nextCollapsed ? collapsedStyle : (origGroupStyles.current[groupId] || n.style);
                                const nextPos = nextCollapsed ? n.position : (origGroupPositions.current[groupId] || n.position);
                                return { ...n, data: { ...n.data, collapsed: nextCollapsed }, style: nextStyle, position: nextPos };
                            }
                            if (childIds.has(n.id)) return { ...n, hidden: nextCollapsed };
                            return n;
                        });
                        return nextNodesSnapshot;
                    });
                    if (nextNodesSnapshot) setEdges(projectEdgesForNodes(baseEdgesRef.current, nextNodesSnapshot));
                    await saveGraphMutation((payload) => {
                        const group = (payload.groups || []).find((g) => g.id === groupId);
                        if (!group) return;
                        group.attrs = { ...(group.attrs || {}), collapsed: nextCollapsed ? '1' : '0' };
                    });
                }, [projectEdgesForNodes]);
                const setAllGroupsCollapsed = React.useCallback(async (collapsed) => {
                    const groupIds = new Set();
                    let nextNodesSnapshot = null;
                    setNodes((prev) => nextNodesSnapshot = prev.map((n) => {
                        if (n.type !== 'group') return n;
                        groupIds.add(n.id);
                        const collapsedStyle = { width: n.data?.collapsed_w || 360, height: n.data?.collapsed_h || 88 };
                        const nextStyle = collapsed ? collapsedStyle : (origGroupStyles.current[n.id] || n.style);
                        const nextPos = collapsed ? n.position : (origGroupPositions.current[n.id] || n.position);
                        return { ...n, data: { ...n.data, collapsed }, style: nextStyle, position: nextPos };
                    }).map((n) => n.parentId && groupIds.has(n.parentId) ? { ...n, hidden: collapsed } : n));
                    if (nextNodesSnapshot) setEdges(projectEdgesForNodes(baseEdgesRef.current, nextNodesSnapshot));
                    await saveGraphMutation((payload) => {
                        (payload.groups || []).forEach((group) => {
                            if (!groupIds.has(group.id)) return;
                            group.attrs = { ...(group.attrs || {}), collapsed: collapsed ? '1' : '0' };
                        });
                    });
                }, [projectEdgesForNodes]);
                const applySemanticZoom = React.useCallback((items, zoom) => {
                    const groupDepth = new Map();
                    const groups = items.filter((n) => n.type === 'group');
                    const depthOf = (g) => {
                        if (groupDepth.has(g.id)) return groupDepth.get(g.id);
                        const parent = groups.find((n) => n.id === g.data?.parent_group_id);
                        const depth = parent ? depthOf(parent) + 1 : 0;
                        groupDepth.set(g.id, depth);
                        return depth;
                    };
                    groups.forEach(depthOf);
                    const groupDetailVisible = (id) => {
                        const depth = groupDepth.get(id) || 0;
                        return zoom >= 0.85 + depth * 0.45;
                    };
                    return items.map((n) => {
                        if (n.type === 'group') {
                            const parentVisible = !n.data?.parent_group_id || groupDetailVisible(n.data.parent_group_id);
                            const open = groupDetailVisible(n.id);
                            const regionStyle = origGroupStyles.current[n.id] || n.style;
                            return { ...n, hidden: !parentVisible, data: { ...n.data, collapsed: !open, onOpen: openDrillGroup }, style: regionStyle, position: open ? (origGroupPositions.current[n.id] || n.position) : n.position };
                        }
                        const parentId = n.parentId;
                        return { ...n, hidden: parentId ? !groupDetailVisible(parentId) : false };
                    });
                }, [openDrillGroup]);
                const semanticNodes = React.useMemo(() => applySemanticZoom(nodes, semanticZoom), [nodes, semanticZoom, applySemanticZoom]);
                const semanticEdges = React.useMemo(() => projectEdgesForNodes(baseEdgesRef.current, semanticNodes), [semanticNodes, projectEdgesForNodes]);
                const buildDrillGraph = React.useCallback((groupId) => {
                    const group = nodes.find((n) => n.id === groupId && n.type === 'group');
                    if (!group) return null;
                    const childIds = new Set(Array.isArray(group.data?.task_ids) ? group.data.task_ids : []);
                    const childGroupIds = new Set(Array.isArray(group.data?.child_group_ids) ? group.data.child_group_ids : []);
                    const scopeTaskIds = new Set(Array.isArray(group.data?.descendant_task_ids) ? group.data.descendant_task_ids : group.data?.task_ids || []);
                    const taskToGroup = new Map();
                    const childGroupByTask = new Map();
                    const groupParent = new Map();
                    nodes.filter((n) => n.type === 'group').forEach((g) => {
                        if (g.data?.parent_group_id) groupParent.set(g.id, g.data.parent_group_id);
                        (g.data?.task_ids || []).forEach((taskId) => taskToGroup.set(taskId, g.id));
                        if (childGroupIds.has(g.id)) (g.data?.descendant_task_ids || g.data?.task_ids || []).forEach((taskId) => childGroupByTask.set(taskId, g.id));
                    });
                    const pathForGroup = (targetGroupId) => {
                        const path = [];
                        let current = targetGroupId;
                        const seen = new Set();
                        while (current && !seen.has(current)) {
                            seen.add(current);
                            path.unshift(current);
                            current = groupParent.get(current);
                        }
                        return path;
                    };
                    const pathForTask = (taskId) => pathForGroup(taskToGroup.get(taskId));
                    const endpointForScopedTask = (taskId) => {
                        if (childIds.has(taskId)) return taskId;
                        return childGroupByTask.get(taskId) || null;
                    };
                    const titleFor = (id) => {
                        const ownerGroupId = taskToGroup.get(id);
                        if (ownerGroupId && ownerGroupId !== groupId) return nodes.find((n) => n.id === ownerGroupId)?.data?.title || ownerGroupId;
                        return nodes.find((n) => n.id === id)?.data?.title || id;
                    };
                    const childNodes = nodes.filter((n) => childIds.has(n.id) || childGroupIds.has(n.id));
                    const minX = childNodes.length ? Math.min(...childNodes.map((n) => n.position?.x || 0)) : 0;
                    const minY = childNodes.length ? Math.min(...childNodes.map((n) => n.position?.y || 0)) : 0;
                    const maxX = childNodes.length ? Math.max(...childNodes.map((n) => n.position?.x || 0)) : 0;
                    const maxY = childNodes.length ? Math.max(...childNodes.map((n) => n.position?.y || 0)) : 0;
                    const spreadX = maxX - minX;
                    const spreadY = maxY - minY;
                    const hasSavedLayout = childNodes.some((n) => !!n.data?.has_saved_position);
                    const useCompactLayout = !hasSavedLayout && (isTD ? (spreadY > 1600 || childNodes.length <= 4) : (spreadX > 1600 || childNodes.length <= 4));
                    const xOffset = 320 - minX;
                    const yOffset = 96 - minY;
                    const compactPos = (index) => isTD ? { x: 320 + Math.floor(index / 3) * 432, y: 96 + (index % 3) * 136 } : { x: 320 + (index % 3) * 432, y: 96 + Math.floor(index / 3) * 136 };
                    const drillNodes = childNodes.map((n, index) => ({
                        ...n,
                        type: n.type === 'group' ? 'group' : 'task',
                        parentId: undefined,
                        hidden: false,
                        selected: false,
                        position: useCompactLayout ? compactPos(index) : { x: (n.position?.x || 0) + xOffset, y: (n.position?.y || 0) + yOffset },
                        data: { ...(n.data || {}), onOpen: openDrillGroup, drill_x_offset: useCompactLayout ? null : xOffset, drill_y_offset: useCompactLayout ? null : yOffset, drill_origin_x: n.position?.x || 0, drill_origin_y: n.position?.y || 0, drill_start_x: useCompactLayout ? compactPos(index).x : (n.position?.x || 0) + xOffset, drill_start_y: useCompactLayout ? compactPos(index).y : (n.position?.y || 0) + yOffset },
                    }));
                    const portalNodes = [];
                    const drillEdges = [];
                    const portalEdgeSpecs = [];
                    const outX = useCompactLayout ? 320 + Math.min(childNodes.length, 3) * 432 + 120 : Math.max(760, maxX - minX + 680);
                    const outY = useCompactLayout ? 96 + Math.ceil(childNodes.length / 3) * 136 + 120 : Math.max(560, maxY - minY + 480);
                    baseEdgesRef.current.forEach((edge) => {
                        const sourceEndpoint = endpointForScopedTask(edge.source);
                        const targetEndpoint = endpointForScopedTask(edge.target);
                        const sourceInside = scopeTaskIds.has(edge.source);
                        const targetInside = scopeTaskIds.has(edge.target);
                        if (sourceEndpoint && targetEndpoint) {
                            if (sourceEndpoint !== targetEndpoint) drillEdges.push({ ...edge, source: sourceEndpoint, target: targetEndpoint, ...edgeDefaults });
                        } else if (!sourceInside && targetEndpoint) {
                            const targetPath = pathForTask(edge.source);
                            const portalKey = targetPath.length ? targetPath.join(':') : edge.source;
                            const portalId = `portal-in-${portalKey}`;
                            const initPos = isTD ? { x: 96, y: Math.min(...drillNodes.map((n) => n.position?.y || 0)) - 160 } : { x: 40, y: 96 };
                            if (!portalNodes.some((n) => n.id === portalId)) portalNodes.push({ id: portalId, type: 'portal', position: initPos, draggable: false, selectable: false, zIndex: 20, style: { pointerEvents: 'all', zIndex: 20 }, data: { title: titleFor(edge.source), side: 'in', target_path: targetPath, onOpenPath: openDrillPath } });
                            if (!portalEdgeSpecs.some((e) => e.source === portalId && e.target === targetEndpoint)) portalEdgeSpecs.push({ ...edge, id: `${portalId}->${targetEndpoint}`, source: portalId, target: targetEndpoint, ...edgeDefaults });
                        } else if (sourceEndpoint && !targetInside) {
                            const targetPath = pathForTask(edge.target);
                            const portalKey = targetPath.length ? targetPath.join(':') : edge.target;
                            const portalId = `portal-out-${portalKey}`;
                            const outPos = isTD ? { x: 96, y: Math.max(...drillNodes.map((n) => n.position?.y || 0)) + 160 } : { x: outX, y: 96 };
                            if (!portalNodes.some((n) => n.id === portalId)) portalNodes.push({ id: portalId, type: 'portal', position: outPos, draggable: false, selectable: false, zIndex: 20, style: { pointerEvents: 'all', zIndex: 20 }, data: { title: titleFor(edge.target), side: 'out', target_path: targetPath, onOpenPath: openDrillPath } });
                            if (!portalEdgeSpecs.some((e) => e.source === sourceEndpoint && e.target === portalId)) portalEdgeSpecs.push({ ...edge, id: `${sourceEndpoint}->${portalId}`, source: sourceEndpoint, target: portalId, ...edgeDefaults });
                        }
                    });
                    const centerPortals = (side) => {
                        const sideNodes = portalNodes.filter((n) => n.data?.side === side);
                        if (isTD) {
                            const visibleX = drillNodes.map((n) => n.position?.x || 0);
                            const centerX = visibleX.length ? (Math.min(...visibleX) + Math.max(...visibleX)) / 2 : 96;
                            const startX = centerX - ((sideNodes.length - 1) * 280) / 2;
                            sideNodes.forEach((node, index) => { node.position.x = Math.max(40, startX + index * 280); });
                        } else {
                            const visibleY = drillNodes.map((n) => n.position?.y || 0);
                            const centerY = visibleY.length ? (Math.min(...visibleY) + Math.max(...visibleY)) / 2 : 96;
                            const startY = centerY - ((sideNodes.length - 1) * 112) / 2;
                            sideNodes.forEach((node, index) => { node.position.y = Math.max(40, startY + index * 112); });
                        }
                    };
                    centerPortals('in');
                    centerPortals('out');
                    return { group, nodes: [...drillNodes, ...portalNodes], edges: [...drillEdges, ...portalEdgeSpecs] };
                }, [nodes, openDrillGroup, openDrillPath]);
                const DrillOverlay = ({ groupId, path }) => {
                    const drill = React.useMemo(() => buildDrillGraph(groupId), [groupId, buildDrillGraph]);
                    const [drillNodes, setDrillNodes] = React.useState(drill?.nodes || []);
                    const [drillEdges, setDrillEdges] = React.useState(drill?.edges || []);
                    React.useEffect(() => {
                        setDrillNodes(drill?.nodes || []);
                        setDrillEdges(drill?.edges || []);
                    }, [drill]);
                    if (!drill) return null;
                    const calcDrillRealPosition = (node) => ({
                        x: node.data?.drill_x_offset == null ? (node.data?.drill_origin_x || 0) + node.position.x - (node.data?.drill_start_x || 0) : node.position.x - node.data.drill_x_offset,
                        y: node.data?.drill_y_offset == null ? (node.data?.drill_origin_y || 0) + node.position.y - (node.data?.drill_start_y || 0) : node.position.y - node.data.drill_y_offset,
                    });
                    const saveDrillPosition = async (_event, node) => {
                        if (node.type !== 'task' && node.type !== 'group') return;
                        const realPosition = calcDrillRealPosition(node);
                        setNodes((prev) => prev.map((n) => n.id === node.id ? { ...n, position: realPosition, data: { ...n.data, has_saved_position: true } } : n));
                        await saveGraphMutation((payload) => {
                            if (node.type === 'group') {
                                const group = (payload.groups || []).find((item) => item.id === node.id);
                                if (!group) return;
                                group.attrs = { ...(group.attrs || {}), pill_x: String(Math.round(realPosition.x)), pill_y: String(Math.round(realPosition.y)) };
                                return;
                            }
                            const task = (payload.tasks || []).find((item) => item.id === node.id);
                            if (task) task.attrs = { ...(task.attrs || {}), graph_x: String(Math.round(realPosition.x)), graph_y: String(Math.round(realPosition.y)) };
                        });
                    };
                    const saveDrillPositions = async (_event, movedNodes) => {
                        const eligible = (movedNodes || []).filter((n) => n.type === 'task' || n.type === 'group');
                        if (!eligible.length) return;
                        const realPositions = Object.fromEntries(eligible.map((n) => [n.id, calcDrillRealPosition(n)]));
                        setNodes((prev) => prev.map((n) => realPositions[n.id] ? { ...n, position: realPositions[n.id], data: { ...n.data, has_saved_position: true } } : n));
                        await saveGraphMutation((payload) => {
                            eligible.forEach((node) => {
                                const rp = realPositions[node.id];
                                if (node.type === 'group') {
                                    const group = (payload.groups || []).find((item) => item.id === node.id);
                                    if (group) group.attrs = { ...(group.attrs || {}), pill_x: String(Math.round(rp.x)), pill_y: String(Math.round(rp.y)) };
                                } else {
                                    const task = (payload.tasks || []).find((item) => item.id === node.id);
                                    if (task) task.attrs = { ...(task.attrs || {}), graph_x: String(Math.round(rp.x)), graph_y: String(Math.round(rp.y)) };
                                }
                            });
                        });
                    };
                    const breadcrumbNodes = (path || []).flatMap((id, index) => {
                        const node = nodes.find((n) => n.id === id);
                        return [
                            React.createElement('span', { className: 'text-slate-300', key: `${id}-sep` }, '/'),
                            React.createElement('button', { type: 'button', key: id, onClick: () => setDrillPath((items) => items.slice(0, index + 1)), className: 'max-w-[18rem] truncate rounded px-1 hover:bg-slate-100 dark:hover:bg-slate-800' }, node?.data?.title || id),
                        ];
                    });
                    return React.createElement(
                        'div',
                        { className: 'absolute inset-4 z-20 flex flex-col overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-950' },
                        React.createElement(
                            'div',
                            { className: 'flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800' },
                            React.createElement(
                                'div',
                                { className: 'min-w-0' },
                                React.createElement('div', { className: 'text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400' }, 'Tasks / Group'),
                                React.createElement(
                                    'div',
                                    { className: 'flex min-w-0 flex-wrap items-center gap-1 text-sm font-semibold text-slate-800 dark:text-slate-100' },
                                    React.createElement('button', { type: 'button', onClick: () => setDrillPath([]), className: 'rounded px-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800' }, 'Overview'),
                                    ...breadcrumbNodes,
                                ),
                            ),
                            React.createElement('button', { type: 'button', onClick: closeDrillGroup, className: 'rounded border border-slate-300 px-3 py-1 text-sm text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800' }, 'Back'),
                        ),
                        React.createElement(
                            'div',
                            { className: 'min-h-0 flex-1' },
                            React.createElement(
                                ReactFlow,
                                { key: groupId, nodes: drillNodes, edges: drillEdges, onNodesChange: (changes) => setDrillNodes((items) => applyNodeChanges(changes, items)), onNodeDragStop: saveDrillPosition, onSelectionDragStop: saveDrillPositions, onInit: (instance) => setTimeout(() => instance.fitView({ padding: 0.28, duration: 120 }), 50), nodeTypes, fitView: true, fitViewOptions: { padding: 0.28 }, minZoom: 0.15, snapToGrid: true, snapGrid: grid, colorMode: document.documentElement.classList.contains('dark') ? 'dark' : 'light', className: 'h-full w-full bg-transparent' },
                                React.createElement(Background, { gap: grid[0], size: 1 }),
                                React.createElement(Controls),
                            ),
                        ),
                    );
                };
                React.useEffect(() => {
                    if (hostForSnapshot) hostForSnapshot.__vyasaTaskSnapshot = { nodes, edges };
                }, [nodes, edges]);
                React.useEffect(() => {
                    const onKeyDown = async (event) => {
                        const host = hostForSnapshot;
                        const modal = document.getElementById('vyasa-task-fullscreen-modal');
                        const hostInModal = !!host?.closest?.('#vyasa-task-fullscreen-modal');
                        if ((modal && !hostInModal) || (!modal && hostInModal)) return;
                        const target = event.target;
                        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) return;
                        const key = String(event.key || '').toLowerCase();
                        if (key === 'escape' && drillGroupId) {
                            const preview = document.getElementById('vyasa-task-preview-modal');
                            if (preview && !preview.classList.contains('hidden')) return;
                            event.preventDefault();
                            closeDrillGroup();
                            return;
                        }
                        if (key === 'r' && !event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey) {
                            event.preventDefault();
                            const currentNodes = nodesRef.current;
                            const scopeIds = new Set();
                            if (drillGroupId) {
                                const group = currentNodes.find((n) => n.id === drillGroupId && n.type === 'group');
                                (group?.data?.task_ids || []).forEach((id) => scopeIds.add(id));
                                (group?.data?.child_group_ids || []).forEach((id) => scopeIds.add(id));
                            } else {
                                currentNodes.forEach((n) => scopeIds.add(n.id));
                            }
                            await saveGraphMutation((payload) => {
                                (payload.tasks || []).forEach((t) => {
                                    if (!scopeIds.has(t.id)) return;
                                    if (t.attrs) { delete t.attrs.graph_x; delete t.attrs.graph_y; delete t.attrs.pill_x; delete t.attrs.pill_y; }
                                });
                                (payload.groups || []).forEach((g) => {
                                    if (!scopeIds.has(g.id)) return;
                                    if (g.attrs) { delete g.attrs.graph_x; delete g.attrs.graph_y; delete g.attrs.pill_x; delete g.attrs.pill_y; }
                                });
                            });
                            if (drillGroupId) {
                                const savedPath = drillPath.slice();
                                setNodes((prev) => prev.map((n) => scopeIds.has(n.id) ? { ...n, data: { ...(n.data || {}), has_saved_position: false } } : n));
                                setDrillPath([]);
                                setTimeout(() => setDrillPath(savedPath), 0);
                            } else if (typeof htmx !== 'undefined' && document.getElementById('main-content')) {
                                const scrollY = window.scrollY;
                                htmx.ajax('GET', window.location.href, { target: '#main-content', swap: 'outerHTML' });
                                document.addEventListener('htmx:afterSwap', () => window.scrollTo(0, scrollY), { once: true });
                            } else {
                                window.location.reload();
                            }
                            return;
                        }
                        if (!event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) return;
                        if (key === 'f') {
                            event.preventDefault();
                            setAllGroupsCollapsed(true);
                        }
                    };
                    document.addEventListener('keydown', onKeyDown);
                    return () => document.removeEventListener('keydown', onKeyDown);
                }, [drillGroupId, drillPath, closeDrillGroup, setAllGroupsCollapsed, saveGraphMutation]);
                const onNodesChange = React.useCallback((changes) => setNodes((items) => applyNodeChanges(changes, items)), []);
                const onEdgesChange = React.useCallback((changes) => setEdges((items) => applyEdgeChanges(changes, items)), []);
                const onConnect = async (params) => {
                    if (!params.source || !params.target || params.source === params.target) return;
                    const groupIds = new Set(nodes.filter((node) => node.type === 'group').map((node) => node.id));
                    if (groupIds.has(params.source) || groupIds.has(params.target)) return;
                    const nextBaseEdges = addEdge({ ...params, ...edgeDefaults }, baseEdgesRef.current);
                    baseEdgesRef.current = nextBaseEdges;
                    const nextEdges = projectEdgesForNodes(nextBaseEdges, nodes);
                    setEdges(nextEdges);
                    await saveGraphMutation((payload) => persistGraphEdges(payload, nextBaseEdges));
                };
                const NODE_W = 320, NODE_H = 92, GROUP_PAD = 24;
                const pendingGroupState = React.useRef(null);
                const recomputeGroupBounds = (draggedNode, prev) => {
                    if (!draggedNode.parentId) return prev;
                    const groupId = draggedNode.parentId;
                    const children = prev.filter((n) => n.parentId === groupId && !n.hidden);
                    if (!children.length) return prev;
                    const childPositions = children.map((n) => n.id === draggedNode.id ? { id: n.id, pos: draggedNode.position } : { id: n.id, pos: n.position });
                    const minX = Math.min(...childPositions.map((c) => c.pos.x));
                    const minY = Math.min(...childPositions.map((c) => c.pos.y));
                    const maxX = Math.max(...childPositions.map((c) => c.pos.x));
                    const maxY = Math.max(...childPositions.map((c) => c.pos.y));
                    const shiftX = minX - GROUP_PAD;
                    const shiftY = minY - GROUP_PAD;
                    const nextW = maxX - shiftX + NODE_W + GROUP_PAD;
                    const nextH = maxY - shiftY + NODE_H + GROUP_PAD;
                    origGroupStyles.current[groupId] = { width: nextW, height: nextH };
                    const groupNode = prev.find((n) => n.id === groupId);
                    const newGroupPos = { x: (groupNode?.position.x || 0) + shiftX, y: (groupNode?.position.y || 0) + shiftY };
                    const newChildPositions = Object.fromEntries(childPositions.map((c) => [c.id, c.id === draggedNode.id ? draggedNode.position : { x: c.pos.x - shiftX, y: c.pos.y - shiftY }]));
                    pendingGroupState.current = { groupId, groupPos: newGroupPos, childPositions: newChildPositions };
                    return prev.map((n) => {
                        if (n.id === groupId) return { ...n, position: newGroupPos, style: { width: nextW, height: nextH } };
                        if (n.parentId === groupId && n.id !== draggedNode.id) return { ...n, position: newChildPositions[n.id] };
                        return n;
                    });
                };
                const onNodeDrag = React.useCallback((_event, node) => {
                    if (node.parentId) setNodes((prev) => recomputeGroupBounds(node, prev));
                }, []);
                const onNodeDragStop = async (_event, node) => {
                    if (node.type === 'group') {
                        await saveGraphMutation((payload) => {
                            const group = (payload.groups || []).find((g) => g.id === node.id);
                            if (!group) return;
                            const isCollapsed = group.attrs?.collapsed === '1';
                            if (isCollapsed) {
                                group.attrs = { ...(group.attrs || {}), pill_x: String(Math.round(node.position.x)), pill_y: String(Math.round(node.position.y)), graph_x: String(Math.round(node.position.x)), graph_y: String(Math.round(node.position.y)) };
                                origGroupPositions.current[node.id] = { x: node.position.x, y: node.position.y };
                            } else {
                                group.attrs = { ...(group.attrs || {}), graph_x: String(Math.round(node.position.x)), graph_y: String(Math.round(node.position.y)) };
                                origGroupPositions.current[node.id] = { x: node.position.x, y: node.position.y };
                            }
                        });
                        return;
                    }
                    await saveGraphMutation((payload) => {
                        const state = pendingGroupState.current;
                        if (state) {
                            const group = (payload.groups || []).find((g) => g.id === state.groupId);
                            if (group) group.attrs = { ...(group.attrs || {}), graph_x: String(Math.round(state.groupPos.x)), graph_y: String(Math.round(state.groupPos.y)) };
                            (payload.tasks || []).forEach((t) => {
                                if (state.childPositions[t.id]) {
                                    t.attrs = { ...(t.attrs || {}), graph_x: String(Math.round(state.childPositions[t.id].x)), graph_y: String(Math.round(state.childPositions[t.id].y)) };
                                }
                            });
                            pendingGroupState.current = null;
                        } else {
                            const task = (payload.tasks || []).find((item) => item.id === node.id);
                            if (!task) return;
                            task.attrs = { ...(task.attrs || {}), graph_x: String(Math.round(node.position.x)), graph_y: String(Math.round(node.position.y)) };
                        }
                    });
                };
                const onEdgesDelete = async (deleted) => {
                    const groupIds = new Set(nodes.filter((node) => node.type === 'group').map((node) => node.id));
                    const deletedIds = new Set((deleted || []).filter((edge) => !groupIds.has(edge.source) && !groupIds.has(edge.target)).map((edge) => edge.id));
                    if (!deletedIds.size) return;
                    const nextBaseEdges = baseEdgesRef.current.filter((edge) => !deletedIds.has(edge.id));
                    baseEdgesRef.current = nextBaseEdges;
                    const nextEdges = projectEdgesForNodes(nextBaseEdges, nodes);
                    setEdges(nextEdges);
                    await saveGraphMutation((payload) => persistGraphEdges(payload, nextBaseEdges));
                };
                return React.createElement('div', { className: 'relative h-full w-full' }, React.createElement(ReactFlow, { nodes: semanticNodes, edges: semanticEdges, onMove: (_e, viewport) => setSemanticZoom(viewport.zoom || 0.6), onNodesChange, onEdgesChange, onEdgesDelete, onConnect, onNodeDrag, onNodeDragStop, nodeTypes, fitView: true, minZoom: 0.05, snapToGrid: true, snapGrid: grid, colorMode: document.documentElement.classList.contains('dark') ? 'dark' : 'light', className: 'bg-transparent' }, React.createElement(Background, { gap: grid[0], size: 1 }), React.createElement(Controls)), drillGroupId ? React.createElement(DrillOverlay, { groupId: drillGroupId, path: drillPath }) : null);
            };
            return React.createElement(App);
        };
        flowHost.__vyasaTaskMount = { makeFlowElement, ReactDOMClient };
        const root = ReactDOMClient.createRoot(flowHost);
        root.render(makeFlowElement(taskGraph.nodes, taskGraph.edges, flowHost));
    })().catch((error) => {
        if (previewStatus) previewStatus.textContent = 'Graph failed to load';
        console.error('[vyasa][tasks] react flow mount failed', error);
    });

    region.querySelector('#vyasa-task-popout')?.addEventListener('click', async () => {
        const existing = document.getElementById('vyasa-task-fullscreen-modal');
        if (existing) existing.remove();
        const modal = document.createElement('div');
        modal.id = 'vyasa-task-fullscreen-modal';
        modal.className = 'fixed inset-0 z-[10000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4';
        modal.innerHTML = '<div class="relative bg-white dark:bg-slate-900 rounded-lg shadow-2xl w-full h-full max-w-[95vw] max-h-[95vh] flex flex-col"><div class="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700"><h3 class="text-lg font-semibold text-slate-800 dark:text-slate-200">' + esc(region.querySelector('h2')?.textContent || 'Tasks') + '</h3><button type="button" class="vyasa-task-fullscreen-close px-3 py-1 text-xl text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors">✕</button></div><div class="flex-1 overflow-auto p-4"><div class="vyasa-task-fullscreen-host w-full h-full rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/50"></div></div></div>';
        document.body.appendChild(modal);
        const close = () => modal.remove();
        modal.addEventListener('click', (event) => { if (event.target === modal) close(); });
        modal.querySelector('.vyasa-task-fullscreen-close')?.addEventListener('click', close);
        const escHandler = (event) => {
            if (event.key === 'Escape' && document.getElementById('vyasa-task-fullscreen-modal')) {
                close();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
        try {
            const mountApi = flowHost?.__vyasaTaskMount;
            if (!mountApi) return;
            const host = modal.querySelector('.vyasa-task-fullscreen-host');
            const snapshot = flowHost?.__vyasaTaskSnapshot || { nodes: taskGraph.nodes, edges: taskGraph.edges };
            const fullscreenRoot = mountApi.ReactDOMClient.createRoot(host);
            fullscreenRoot.render(mountApi.makeFlowElement(snapshot.nodes, snapshot.edges, host));
        } catch (error) {
            console.error('[vyasa][tasks] popout failed', error);
        }
    });
    region.querySelector('#vyasa-task-preview-save')?.addEventListener('click', saveTask);
    region.querySelector('#vyasa-task-preview-close')?.addEventListener('click', closePreview);
    previewModal?.addEventListener('click', (event) => { if (event.target === previewModal) closePreview(); });
    document.addEventListener('click', (event) => {
        const trigger = event.target.closest('[data-task-preview-trigger]');
        if (trigger) openPreview(trigger.dataset.taskPreviewTrigger || '');
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && previewModal && !previewModal.classList.contains('hidden')) {
            event.stopImmediatePropagation();
            closePreview();
        }
    }, true);
}

export function initTaskRegions(rootElement = document) {
    rootElement.querySelectorAll('#vyasa-task-region').forEach((region) => initTaskRegion(region));
}
