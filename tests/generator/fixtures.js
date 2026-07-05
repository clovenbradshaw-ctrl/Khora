import { RULES_REV } from '../../src/generator/appspec.js';

// A hardcoded AppSpec (Part 7: "one Tier 1 surface end to end, Table plus
// Form against a room, with the desert stop proven live") — used across
// generator tests as the known-good baseline.
export function makeValidAppSpec() {
  return {
    rules_rev: RULES_REV,
    site: {
      space_or_room: 'space:procurement',
      visibility: 'private',
      power_template: 'contributor-write',
    },
    surfaces: [
      { type: 'Table', class: 'ProcurementRecord', room: 'room:procurement-records' },
      { type: 'Form', class: 'TipIntake', room: 'room:tip-intake' },
    ],
    cells: [
      { address: { mode: 2, domain: 0, object: 1 } }, // INS x Figure
      { address: { mode: 0, domain: 2, object: 1 } }, // DEF x Figure
    ],
    bindings: [
      {
        on: 'table:addRow',
        emit: {
          op: 'INS',
          address: { mode: 2, domain: 0, object: 1 },
          target: (payload) => `record:${payload.id}`,
        },
        provenance: { mode_of_givenness: 'direct-entry', context: 'procurement-table' },
      },
      {
        on: 'form:submit',
        emit: {
          op: 'INS',
          address: { mode: 2, domain: 0, object: 1 },
          target: (payload) => `tip:${payload.id}`,
        },
        provenance: { mode_of_givenness: 'direct-report', context: 'tip-intake-form' },
      },
    ],
  };
}
