// Turns a `generate()` result's surface declarations into real, live
// surface instances (createTableSurface, createFormSurface, ...) bound to
// the same log adapter generate() was given — the step between "the spec
// validated" and "there's something on screen a user can act on." generate()
// itself only records `{ type, room, spec }` per surface (src/generator/
// generate.js) because it stays framework-free; this module is where the
// App Builder actually reaches for the Tier 1 factories.

import { createTableSurface } from '../surfaces/table.js';
import { createChartSurface } from '../surfaces/chart.js';
import { createMapSurface } from '../surfaces/map.js';
import { createFeedSurface } from '../surfaces/feed.js';
import { createFormSurface } from '../surfaces/form.js';

const FACTORIES = Object.freeze({
  Table: ({ log }) => createTableSurface({ log }),
  Chart: ({ log }) => createChartSurface({ log }),
  Map: ({ log }) => createMapSurface({ log }),
  Feed: ({ log }) => createFeedSurface({ log }),
  Form: ({ log, spec }) => createFormSurface({ log, operator: spec.operator, homeTerrain: spec.homeTerrain }),
});

export function isInstantiable(surfaceType) {
  return Object.prototype.hasOwnProperty.call(FACTORIES, surfaceType);
}

// `generateResult` is the `{ surfaces, bindings, spec }` object generate()
// returns on success. Returns one entry per surface that has a Tier 1
// factory; Tier 2 surfaces (no factory here yet) are skipped rather than
// silently guessed at.
export function instantiateSurfaces(generateResult, log) {
  return generateResult.surfaces
    .filter(({ type }) => isInstantiable(type))
    .map(({ type, room, spec }) => ({
      type,
      room,
      spec,
      instance: FACTORIES[type]({ log, spec }),
    }));
}
