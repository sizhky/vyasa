// Node roles: docs/implementation/KG_THEMING/design.md. A role is what a node
// is, apart from how it is drawn. layouts.py NODE_ROLES lists the same names.
// This module imports only the theme, which gives each look a default role.
import { tasksLookDefaultRole } from './tasks_theme.js';

/**
 * Role records. Fields:
 * - cardState: the node shows the card-state checkbox and keeps a state.
 * - notes: the node offers a notes editor and shows a note badge.
 * - interactive: the node takes pointer events, selection and a hover card.
 * - bands: the strength of its highlight bands and rings: 'full', 'thin' or 'none'.
 * - joinsRoutes: edges meet at its centre, with no arrowhead and no gap.
 * - passThrough: a highlight that reaches it continues along the route to the
 *   nodes beyond, in edge direction (tasksJunctionReach).
 * - clearance: how far a route keeps off its box, in px. It covers the widest
 *   highlight band the role draws (3px offset plus a 12px band for full).
 */
const TASKS_ROLES = {
    // A thing the graph is about: a task, a service, a concept.
    item: { cardState: true, notes: true, interactive: true, bands: 'full', joinsRoutes: false, passThrough: false, clearance: 16 },
    // A figure part a reader can inspect but not track, such as an operator or a label.
    mark: { cardState: false, notes: false, interactive: true, bands: 'thin', joinsRoutes: false, passThrough: false, clearance: 8 },
    // A point where routes split or merge.
    junction: { cardState: false, notes: false, interactive: false, bands: 'none', joinsRoutes: true, passThrough: true, clearance: 0 },
};

export const TASKS_NODE_ROLES = Object.keys(TASKS_ROLES);

/**
 * The role of a node: its own `node_role` attr, else its look's default role.
 * The attr is `node_role`, not `role`, because packs already author `role` as
 * content (`role=context`, a sequence edge's `role=standing`).
 *
 * >>> tasksNodeRole({ node_role: 'item' }, 'circle')
 * 'item'
 * >>> tasksNodeRole({ role: 'context' }, 'point')
 * 'junction'
 * >>> tasksNodeRole({ node_role: 'boss' }, 'card')
 * 'item'
 */
export function tasksNodeRole(node, look) {
    const own = String(node?.node_role ?? '').trim().toLowerCase();
    return TASKS_ROLES[own] ? own : tasksLookDefaultRole(look);
}

// The behaviour record of a node's role. `data` is a node record or React Flow
// node data; its drawn look is `__node_look__`, or `look` when given.
export function tasksRoleOf(data, look = data?.__node_look__) {
    return TASKS_ROLES[tasksNodeRole(data, look)];
}
