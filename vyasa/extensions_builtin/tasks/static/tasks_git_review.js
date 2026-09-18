const HISTORY_COLORS = ['#0ea5e9', '#8b5cf6', '#ec4899', '#22c55e', '#f59e0b', '#ef4444'];

export function tasksGitHistoryRows(payload) {
    const commits = Array.isArray(payload?.commits) ? payload.commits : [];
    const worktreePaths = Array.isArray(payload?.worktree?.changed_paths) ? payload.worktree.changed_paths : [];
    const records = worktreePaths.length ? [{
        sha: 'WORKTREE',
        parents: [payload?.worktree?.parent].filter(Boolean),
        message: 'Working tree changes',
        author: '',
        timestamp: Math.floor(Date.now() / 1000),
        refs: ['worktree'],
        changed_paths: worktreePaths,
        affects_scope: true,
        worktree: true,
    }, ...commits] : commits;
    const lanes = [];
    return records.map((record) => {
        const sha = String(record?.sha || '');
        let lane = lanes.indexOf(sha);
        if (lane < 0) {
            lane = lanes.length;
            lanes.push(sha);
        }
        const before = [...lanes];
        const parents = (record?.parents || []).map(String).filter(Boolean);
        if (parents.length) {
            const existingParentLane = lanes.indexOf(parents[0]);
            if (existingParentLane >= 0 && existingParentLane !== lane) lanes.splice(lane, 1);
            else lanes[lane] = parents[0];
            parents.slice(1).reverse().forEach((parent) => {
                if (!lanes.includes(parent)) lanes.splice(lane + 1, 0, parent);
            });
        } else {
            lanes.splice(lane, 1);
        }
        const after = [...lanes];
        const connections = before.map((id, from) => {
            if (id === sha) return parents.map((parent) => ({ from, to: Math.max(0, after.indexOf(parent)), parent }));
            const to = after.indexOf(id);
            return to >= 0 ? [{ from, to, parent: id }] : [];
        }).flat();
        return { ...record, lane, before, after, connections };
    });
}

export function tasksGitLaneColor(index) {
    return HISTORY_COLORS[Math.abs(Number(index) || 0) % HISTORY_COLORS.length];
}

export function tasksReviewCountsLabel(counts) {
    const value = counts || {};
    return `+${Number(value.added || 0)}  ~${Number(value.modified || 0)}  −${Number(value.removed || 0)}`;
}

export function tasksReviewFieldText(value) {
    if (value === null || value === undefined) return '∅';
    if (Array.isArray(value)) return value.join('\n');
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
}
