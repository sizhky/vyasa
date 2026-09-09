import { logTasksPerf } from './tasks_diagnostics.js';
import { collectTasksStoredNotes, importTasksStoredNotes } from './tasks_graph_core.js';
import {
    normalizeTasksCardStates, normalizeTasksCheckedNodeIds, normalizeTasksGroupByDisabledKeys, normalizeTasksNodeNotes,
    normalizeTasksNodeStates, normalizeTasksSlideNotes,
} from './tasks_graph_model.js';

const TASKS_STORAGE_WRITE_DELAY_MS = 180;

const tasksStorageWriteCache = new Map();

const tasksStorageWriteTimers = new Map();

export const TASKS_HOVER_CARD_MODES = ['off', 'rightRail'];

// No document path in the keys: E and C are one setting for every graph on this
// server, and localStorage is already scoped to the origin.
export const TASKS_EDGES_VISIBLE_KEY = 'vyasa:tasks:edges-visible';

export const TASKS_HOVER_CARD_MODE_KEY = 'vyasa:tasks:hover-card-mode';

const TASKS_PREFS_INDEX_KEY = 'vyasa:tasks:prefs:__index__';

const TASKS_PREFS_MAX_ENTRIES = 200;

function tasksPrefsKey(model) {
    const persistenceId = String(model?.persistence_id || '').trim();
    const documentPath = String(model?.document_path || '').trim();
    if (persistenceId) return `vyasa:tasks:prefs:${documentPath}::${persistenceId}`;
    const graphId = String(model?.graph_id || '').trim();
    return graphId ? `vyasa:tasks:prefs:${graphId}` : '';
}

// One key space per document+graph, so two KGs never share a stored value.
function tasksModelScopeKey(model, kind) {
    const documentPath = String(model?.document_path || '').trim();
    const persistenceId = String(model?.persistence_id || '').trim();
    const graphId = String(model?.graph_id || '').trim();
    const title = String(model?.title || '').trim();
    const stableId = persistenceId || title || graphId;
    if (!stableId) return '';
    return `vyasa:tasks:${kind}:${documentPath}::${stableId}`;
}

function tasksCheckedStateKey(model) {
    return tasksModelScopeKey(model, 'checked');
}

export function tasksNodeCardWidthKey(model) {
    return tasksModelScopeKey(model, 'node-card-width');
}

function tasksGetStorage() {
    if (typeof window === 'undefined') return null;
    try {
        return window.localStorage || null;
    } catch {
        return null;
    }
}

function scheduleTasksStorageWrite(key, writeNow, payload = '') {
    if (!key || typeof writeNow !== 'function') return;
    const previous = tasksStorageWriteCache.get(key);
    if (payload && previous === payload) return;
    if (payload) tasksStorageWriteCache.set(key, payload);
    const pending = tasksStorageWriteTimers.get(key);
    if (pending) window.clearTimeout(pending);
    const run = () => {
        tasksStorageWriteTimers.delete(key);
        try {
            writeNow();
        } catch (error) {
            logTasksPerf('storage-error', {
                key,
                name: error?.name || '',
                message: error?.message || String(error || ''),
            });
        }
    };
    const timer = window.setTimeout(run, TASKS_STORAGE_WRITE_DELAY_MS);
    tasksStorageWriteTimers.set(key, timer);
}

export function readTasksGlobalToggle(key) {
    const storage = tasksGetStorage();
    if (!storage) return null;
    try {
        return storage.getItem(key);
    } catch {
        return null;
    }
}

export function writeTasksGlobalToggle(key, value) {
    const storage = tasksGetStorage();
    if (!storage) return;
    const payload = String(value);
    scheduleTasksStorageWrite(key, () => storage.setItem(key, payload), payload);
}

// Reset to schema defaults has to drop the server-wide value as well, or the
// next projection switch reads it back and the reset looks ignored.
export function clearTasksGlobalToggle(key) {
    const pending = tasksStorageWriteTimers.get(key);
    if (pending) window.clearTimeout(pending);
    tasksStorageWriteTimers.delete(key);
    tasksStorageWriteCache.delete(key);
    const storage = tasksGetStorage();
    if (!storage) return;
    try {
        storage.removeItem(key);
    } catch {
        // A blocked or full storage keeps the old value; the next toggle rewrites it.
    }
}

// Null means the toggle was never pressed on this server, so the graph keeps
// whatever its own schema and projection prefs asked for.
export function readTasksStoredFlag(key) {
    const raw = readTasksGlobalToggle(key);
    if (raw === 'true') return true;
    return raw === 'false' ? false : null;
}

export function readTasksEdgesVisible() {
    return readTasksStoredFlag(TASKS_EDGES_VISIBLE_KEY);
}

export function readTasksHoverCardMode() {
    const raw = readTasksGlobalToggle(TASKS_HOVER_CARD_MODE_KEY);
    return TASKS_HOVER_CARD_MODES.includes(raw) ? raw : null;
}

export function buildTasksNodeNotesBackup(model, nodeNotes, nodeStates, slideNotes = {}) {
    const storage = tasksGetStorage();
    const storageKey = tasksPrefsKey(model);
    if (!storage || !storageKey) throw new Error('Browser storage is unavailable for this Knowledge Graph.');
    const prefs = JSON.parse(storage.getItem(storageKey) || '{}');
    prefs.nodeNotes = normalizeTasksNodeNotes(nodeNotes);
    prefs.slideNotes = normalizeTasksNodeNotes(slideNotes);
    prefs.nodeStates = normalizeTasksNodeStates(nodeStates, normalizeTasksCardStates(model));
    storage.setItem(storageKey, JSON.stringify(prefs));
    const nodeTitles = Object.fromEntries(
        [...(model?.groups || []), ...(model?.tasks || [])]
            .filter((node) => node?.id)
            .map((node) => [String(node.id), String(node.label || node.title || node.id)])
    );
    const slideTitles = Object.fromEntries(
        (Array.isArray(model?.slides) ? model.slides : [])
            .filter((slide) => slide?.id)
            .map((slide) => [String(slide.id), String(slide.title || slide.caption || slide.id)])
    );
    const backup = collectTasksStoredNotes(storage, storageKey, nodeTitles, slideTitles);
    const graphName = String(model?.persistence_id || model?.graph_id || 'graph')
        .trim().replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '') || 'graph';
    return {
        filename: `vyasa-kg-notes-${graphName}.txt`,
        text: backup,
    };
}

export function downloadTasksNodeNotes(model, nodeNotes, nodeStates, slideNotes = {}) {
    const { filename, text } = buildTasksNodeNotesBackup(model, nodeNotes, nodeStates, slideNotes);
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(href);
    return filename;
}

export function uploadTasksNodeNotes(model, cardStates) {
    return new Promise((resolve, reject) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.txt,text/plain,application/json';
        input.addEventListener('change', async () => {
            const file = input.files?.[0];
            if (!file) return resolve(null);
            try {
                const storage = tasksGetStorage();
                const storageKey = tasksPrefsKey(model);
                if (!storage || !storageKey) throw new Error('Browser storage is unavailable for this Knowledge Graph.');
                const backup = await file.text();
                importTasksStoredNotes(storage, storageKey, backup);
                touchTasksPrefsIndex(storage, storageKey);
                const prefs = readTasksPrefs(model);
                resolve({
                    nodeNotes: normalizeTasksNodeNotes(prefs.nodeNotes),
                    slideNotes: normalizeTasksNodeNotes(prefs.slideNotes),
                    nodeStates: normalizeTasksNodeStates(prefs.nodeStates, cardStates),
                });
            } catch (error) {
                reject(error);
            }
        }, { once: true });
        input.click();
    });
}

function readTasksPrefsIndex(storage) {
    try {
        const raw = storage.getItem(TASKS_PREFS_INDEX_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
        return {};
    }
}

function writeTasksPrefsIndex(storage, index) {
    try {
        storage.setItem(TASKS_PREFS_INDEX_KEY, JSON.stringify(index));
    } catch {
        // If even the index can't write, the next eviction round will handle it.
    }
}

function touchTasksPrefsIndex(storage, key) {
    if (!storage || !key) return;
    const index = readTasksPrefsIndex(storage);
    index[key] = Date.now();
    writeTasksPrefsIndex(storage, index);
}

function evictTasksPrefsLRU(storage, keepKey = '', maxEntries = TASKS_PREFS_MAX_ENTRIES) {
    if (!storage) return;
    const index = readTasksPrefsIndex(storage);
    const entries = Object.entries(index).sort((a, b) => a[1] - b[1]);
    let removed = 0;
    while (entries.length > maxEntries) {
        const [key] = entries.shift();
        if (key === keepKey) continue;
        try { storage.removeItem(key); } catch { /* ignore */ }
        delete index[key];
        removed += 1;
    }
    if (removed) writeTasksPrefsIndex(storage, index);
}

export function readTasksPrefs(model) {
    const key = tasksPrefsKey(model);
    const storage = tasksGetStorage();
    if (!key || !storage) return {};
    try {
        const parsed = JSON.parse(storage.getItem(key) || '{}');
        if (parsed && typeof parsed === 'object') {
            touchTasksPrefsIndex(storage, key);
            return parsed;
        }
        return {};
    } catch {
        return {};
    }
}

export function checkedNodeIdsFromStates(nodeStates) {
    return Object.keys(nodeStates || {}).filter(Boolean);
}

export function readTasksCheckedNodeIds(model) {
    const key = tasksCheckedStateKey(model);
    const storage = tasksGetStorage();
    if (!key || !storage) return [];
    try {
        return normalizeTasksCheckedNodeIds(JSON.parse(storage.getItem(key) || '[]'));
    } catch {
        return [];
    }
}

export function writeTasksCheckedNodeIds(model, checkedNodeIds) {
    const key = tasksCheckedStateKey(model);
    const storage = tasksGetStorage();
    if (!key || !storage) return;
    const payload = JSON.stringify(normalizeTasksCheckedNodeIds(checkedNodeIds));
    scheduleTasksStorageWrite(key, () => storage.setItem(key, payload), payload);
}

export function writeTasksPrefs(model, prefs) {
    const key = tasksPrefsKey(model);
    const storage = tasksGetStorage();
    if (!key || !storage) return;
    const projectionId = String(prefs?.projectionId || '').trim();
    const projectionPrefs = prefs?.projectionPrefs && typeof prefs.projectionPrefs === 'object'
        ? prefs.projectionPrefs
        : {};
    const groupByHierarchy = Array.isArray(prefs?.groupByHierarchy)
        ? prefs.groupByHierarchy.map((entry) => String(entry || '').trim()).filter(Boolean)
        : [];
    const groupByEnabled = typeof prefs?.groupByEnabled === 'boolean' ? prefs.groupByEnabled : groupByHierarchy.length > 0;
    const groupByDisabledKeys = normalizeTasksGroupByDisabledKeys(prefs?.groupByDisabledKeys)
        .filter((key) => groupByHierarchy.includes(key));
    const edgeOpacity = prefs?.edgeOpacity;
    const unspecifiedContentOpacity = prefs?.unspecifiedContentOpacity;
    const nodeStates = prefs?.nodeStates && typeof prefs.nodeStates === 'object' && !Array.isArray(prefs.nodeStates)
        ? prefs.nodeStates
        : {};
    const existing = readTasksPrefs(model);
    const nodeNotes = Object.prototype.hasOwnProperty.call(prefs || {}, 'nodeNotes')
        ? normalizeTasksNodeNotes(prefs?.nodeNotes)
        : normalizeTasksNodeNotes(existing.nodeNotes);
    const edgeNotes = Object.prototype.hasOwnProperty.call(prefs || {}, 'edgeNotes')
        ? normalizeTasksNodeNotes(prefs?.edgeNotes)
        : normalizeTasksNodeNotes(existing.edgeNotes);
    const slideNotes = Object.prototype.hasOwnProperty.call(prefs || {}, 'slideNotes')
        ? normalizeTasksSlideNotes(prefs?.slideNotes)
        : normalizeTasksSlideNotes(existing.slideNotes);
    const payload = JSON.stringify({
        version: 1,
        projectionId,
        edgeOpacity,
        unspecifiedContentOpacity,
        groupByEnabled,
        groupByHierarchy,
        groupByDisabledKeys,
        projectionPrefs,
        nodeStates,
        nodeNotes,
        edgeNotes,
        slideNotes,
    });
    const attempt = () => {
        storage.setItem(key, payload);
        touchTasksPrefsIndex(storage, key);
    };
    scheduleTasksStorageWrite(key, () => {
        try {
            attempt();
            evictTasksPrefsLRU(storage, key);
        } catch {
            // Most likely QuotaExceededError. Evict aggressively (keep half the budget) and retry once.
            evictTasksPrefsLRU(storage, key, Math.floor(TASKS_PREFS_MAX_ENTRIES / 2));
            attempt();
        }
    }, payload);
}
