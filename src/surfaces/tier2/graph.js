// Graph: the node-link view, the Meant-Graph made public-facing (Part 4,
// Tier 2). Home terrains Network and Link. Nodes are INS entities, edges
// are CON relations, a named cluster is SYN — targeted at Pattern, since
// SYN targeted at Ground is the desert cell the kernel refuses outright.

import { makeAddress } from '../../kernel/address.js';
import { OPERATORS } from '../../kernel/operators.js';
import { gatedWrite, OBJECT_FIGURE, OBJECT_PATTERN } from './shared.js';

const FLAG = 'graph';

export function createGraphSurface({ log }) {
  let lastRead = { nodes: [], edges: [], clusters: [] };

  async function read(query = {}) {
    const graphId = query.graphId;
    const entries = await log.slice((entry) => !graphId || entry.operand?.graphId === graphId);
    const rows = entries.map(({ entry }) => entry);
    lastRead = {
      nodes: rows.filter((e) => e.emit.op === 'INS'),
      edges: rows.filter((e) => e.emit.op === 'CON'),
      clusters: rows.filter((e) => e.emit.op === 'SYN'),
    };
    return lastRead;
  }

  const bindings = {
    // INS: a node entering the graph.
    addNode: (payload, provenance) =>
      gatedWrite({
        log,
        flag: FLAG,
        op: 'INS',
        address: makeAddress(OPERATORS.INS.mode, OPERATORS.INS.domain, OBJECT_FIGURE),
        target: payload?.nodeId,
        operand: { graphId: payload?.graphId, label: payload?.label },
        provenance,
      }),

    // CON: an edge connecting two nodes across a boundary.
    addEdge: (payload, provenance) =>
      gatedWrite({
        log,
        flag: FLAG,
        op: 'CON',
        address: makeAddress(OPERATORS.CON.mode, OPERATORS.CON.domain, OBJECT_FIGURE),
        target: payload?.edgeId,
        operand: { graphId: payload?.graphId, from: payload?.from, to: payload?.to, relation: payload?.relation },
        provenance,
      }),

    // SYN: a named cluster is a whole exceeding its parts, so it must never
    // resolve to Ground — the caller supplies Pattern via OBJECT_PATTERN,
    // never Ground, keeping this call away from the desert cell.
    namedCluster: (payload, provenance) =>
      gatedWrite({
        log,
        flag: FLAG,
        op: 'SYN',
        address: makeAddress(OPERATORS.SYN.mode, OPERATORS.SYN.domain, OBJECT_PATTERN),
        target: payload?.clusterId,
        operand: { graphId: payload?.graphId, name: payload?.name, memberIds: payload?.memberIds },
        provenance,
      }),
  };

  function fallback() {
    return { ...lastRead, stale: true };
  }

  return { homeTerrain: 'Network and Link', read, bindings, fallback };
}
