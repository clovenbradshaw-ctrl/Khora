import { describe, it, expect, afterEach } from 'vitest';
import { InMemoryLog } from '../../../src/kernel/log.js';
import { makeAddress } from '../../../src/kernel/address.js';
import { OPERATORS } from '../../../src/kernel/operators.js';
import { createGraphSurface } from '../../../src/surfaces/tier2/graph.js';
import { gatedWrite } from '../../../src/surfaces/tier2/shared.js';
import { setEnabled } from '../../../src/surfaces/tier2/flags.js';

const provenance = { agent: 'user:alice', mode_of_givenness: 'direct-report', context: 'graph-ui' };

describe('createGraphSurface', () => {
  afterEach(() => setEnabled('graph', false));

  it('refuses every write binding while the flag is off, and appends nothing', async () => {
    const log = new InMemoryLog();
    const graph = createGraphSurface({ log });

    const results = await Promise.all([
      graph.bindings.addNode({ nodeId: 'n1', graphId: 'g1', label: 'Vendor A' }, provenance),
      graph.bindings.addEdge({ edgeId: 'e1', graphId: 'g1', from: 'n1', to: 'n2' }, provenance),
      graph.bindings.namedCluster({ clusterId: 'c1', graphId: 'g1', name: 'Procurement ring', memberIds: ['n1', 'n2'] }, provenance),
    ]);

    for (const result of results) {
      expect(result).toEqual({ ok: false, reason: 'disabled', flag: 'graph' });
    }
    expect((await log.slice()).length).toBe(0);
  });

  it('appends valid node, edge, and cluster bindings once enabled', async () => {
    const log = new InMemoryLog();
    const graph = createGraphSurface({ log });
    setEnabled('graph', true);

    await graph.bindings.addNode({ nodeId: 'n1', graphId: 'g1', label: 'Vendor A' }, provenance);
    await graph.bindings.addEdge({ edgeId: 'e1', graphId: 'g1', from: 'n1', to: 'n2' }, provenance);
    await graph.bindings.namedCluster({ clusterId: 'c1', graphId: 'g1', name: 'Procurement ring', memberIds: ['n1', 'n2'] }, provenance);

    const { nodes, edges, clusters } = await graph.read({ graphId: 'g1' });
    expect(nodes).toHaveLength(1);
    expect(edges).toHaveLength(1);
    expect(clusters).toHaveLength(1);
  });

  it('still refuses a binding missing its provenance envelope, even with the flag on', async () => {
    const log = new InMemoryLog();
    const graph = createGraphSurface({ log });
    setEnabled('graph', true);

    const result = await graph.bindings.addNode({ nodeId: 'n1' }, undefined);

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('invalid');
    expect((await log.slice()).length).toBe(0);
  });

  // The desert cell (SYN by Ground) is exactly what graph's namedCluster
  // binding must never reach. namedCluster itself always targets Pattern,
  // so exercise the kernel-level refusal directly through the shared
  // gate: even with the flag on, a SYN-by-Ground write is rejected.
  it('refuses a SYN-by-Ground (desert) write even with the flag on', async () => {
    const log = new InMemoryLog();
    setEnabled('graph', true);

    const result = await gatedWrite({
      log,
      flag: 'graph',
      op: 'SYN',
      address: makeAddress(OPERATORS.SYN.mode, OPERATORS.SYN.domain, 0),
      target: 'c1',
      operand: null,
      provenance,
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('invalid');
    expect(result.errors.some((e) => e.includes('desert'))).toBe(true);
    expect((await log.slice()).length).toBe(0);
  });
});
