import { describe, it, expect, afterEach } from 'vitest';
import { InMemoryLog } from '../../../src/kernel/log.js';
import { createCRMSurface } from '../../../src/surfaces/tier2/crm.js';
import { setEnabled } from '../../../src/surfaces/tier2/flags.js';

const provenance = { agent: 'user:alice', mode_of_givenness: 'direct-report', context: 'crm-ui' };

// Simple fake Tier 1 controllers, structurally shaped like the real thing
// (homeTerrain/read/bindings/fallback) but recording calls so the CRM
// composition's wiring can be asserted without importing real Tier 1 code.
function makeStubController(bindingName) {
  const calls = [];
  return {
    calls,
    homeTerrain: 'Stub',
    async read() {
      return { rows: [] };
    },
    bindings: {
      [bindingName]: async (payload, callProvenance) => {
        calls.push({ payload, provenance: callProvenance });
        if (!callProvenance) {
          return { ok: false, reason: 'invalid', errors: ['stub: missing provenance'] };
        }
        return { ok: true, reason: 'appended', entry: { payload } };
      },
    },
    fallback() {
      return { rows: [], stale: true };
    },
  };
}

function makeControllers() {
  return {
    tableController: makeStubController('addRow'),
    boardController: makeStubController('moveCard'),
    graphController: makeStubController('addEdge'),
  };
}

describe('createCRMSurface', () => {
  afterEach(() => setEnabled('crm', false));

  it('refuses every write binding while the crm flag is off, without touching the delegates or the log', async () => {
    const log = new InMemoryLog();
    const { tableController, boardController, graphController } = makeControllers();
    const crm = createCRMSurface({ log, tableController, boardController, graphController });

    const results = await Promise.all([
      crm.bindings.createContact({ contactId: 'c1' }, provenance),
      crm.bindings.link({ from: 'c1', to: 'c2' }, provenance),
      crm.bindings.advanceStage({ cardId: 'c1', toColumn: 'won' }, provenance),
      crm.bindings.qualifyLead({ contactId: 'c1', qualified: true }, provenance),
      crm.bindings.resegment({ segmentationId: 's1', segments: ['a', 'b'] }, provenance),
    ]);

    for (const result of results) {
      expect(result).toEqual({ ok: false, reason: 'disabled', flag: 'crm' });
    }
    expect(tableController.calls).toHaveLength(0);
    expect(boardController.calls).toHaveLength(0);
    expect(graphController.calls).toHaveLength(0);
    expect((await log.slice()).length).toBe(0);
  });

  it('wires each composed binding through to its own underlying controller and no other, once enabled', async () => {
    const log = new InMemoryLog();
    const { tableController, boardController, graphController } = makeControllers();
    const crm = createCRMSurface({ log, tableController, boardController, graphController });
    setEnabled('crm', true);

    const createResult = await crm.bindings.createContact({ contactId: 'c1', name: 'Vendor A' }, provenance);
    expect(createResult.ok).toBe(true);
    expect(tableController.calls).toHaveLength(1);
    // Table's addRow binding wants { address, target, operand } directly.
    expect(tableController.calls[0].payload.target).toBe('c1');
    expect(tableController.calls[0].payload.operand).toEqual({ contactId: 'c1', name: 'Vendor A' });
    expect(boardController.calls).toHaveLength(0);
    expect(graphController.calls).toHaveLength(0);

    const linkResult = await crm.bindings.link({ from: 'c1', to: 'c2' }, provenance);
    expect(linkResult.ok).toBe(true);
    expect(graphController.calls).toHaveLength(1);
    expect(tableController.calls).toHaveLength(1); // unchanged
    expect(boardController.calls).toHaveLength(0);

    const advanceResult = await crm.bindings.advanceStage({ cardId: 'c1', toColumn: 'won' }, provenance);
    expect(advanceResult.ok).toBe(true);
    expect(boardController.calls).toHaveLength(1);
    expect(graphController.calls).toHaveLength(1); // unchanged
  });

  it('appends CRM-native EVA and REC entries directly, since Tier 1 has no delegate for them', async () => {
    const log = new InMemoryLog();
    const { tableController, boardController, graphController } = makeControllers();
    const crm = createCRMSurface({ log, tableController, boardController, graphController });
    setEnabled('crm', true);

    const qualifyResult = await crm.bindings.qualifyLead({ contactId: 'c1', qualified: true, basis: 'budget confirmed' }, provenance);
    const resegmentResult = await crm.bindings.resegment({ segmentationId: 's1', segments: ['warm', 'cold'] }, provenance);

    expect(qualifyResult.ok).toBe(true);
    expect(resegmentResult.ok).toBe(true);
    const entries = (await log.slice()).map(({ entry }) => entry);
    expect(entries.map((e) => e.emit.op)).toEqual(['EVA', 'REC']);
  });

  it('still refuses an invalid binding even with the flag on', async () => {
    const log = new InMemoryLog();
    const { tableController, boardController, graphController } = makeControllers();
    const crm = createCRMSurface({ log, tableController, boardController, graphController });
    setEnabled('crm', true);

    // Native write, missing provenance: caught by validateBinding before any append.
    const qualifyResult = await crm.bindings.qualifyLead({ contactId: 'c1' }, undefined);
    expect(qualifyResult.ok).toBe(false);
    expect(qualifyResult.reason).toBe('invalid');
    expect((await log.slice()).length).toBe(0);

    // Delegated write, missing provenance: the underlying controller rejects it,
    // and the CRM layer passes that refusal through unchanged.
    const createResult = await crm.bindings.createContact({ contactId: 'c1' }, undefined);
    expect(createResult.ok).toBe(false);
    expect(createResult.reason).toBe('invalid');
  });
});
