import React from 'react';
import { createRoot } from 'react-dom/client';
import { ReactFlow, Background, Controls } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

export function mountTasksFlow(el, graph) {
  const nodes = graph.nodes.map((n) => ({
    id: n.id,
    position: { x: n.x || 0, y: n.y || 0 },
    data: { label: n.label },
    style: { width: n.width, height: n.height },
  }));
  const edges = graph.edges.map((e, i) => ({ id: `${e.source}-${e.target}-${i}`, source: e.source, target: e.target }));
  createRoot(el).render(
    React.createElement('div', { style: { width: '100%', height: '100%' } },
      React.createElement(ReactFlow, { nodes, edges, fitView: true },
        React.createElement(Background, null),
        React.createElement(Controls, null)))
  );
}
