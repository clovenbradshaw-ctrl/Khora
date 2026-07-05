# EO Substrate

An implementation of the EO Substrate design in `docs/eo-substrate-complete-design.md` — a kernel
that never varies (the address algebra, the operator table, the desert prohibition, the log
discipline) plus a surface layer that always varies (what a given generated app does). Read that
doc first; this README only tracks what actually got built against it and, per the doc's own Part 9
discipline, what's tested versus merely sketched.

## Running it

```
npm install
npm test
```

180 tests across the whole tree as of this writing. `vitest.config.js` picks up everything under
`tests/**/*.test.js`.

## Layout

```
src/kernel/       Part 2 — the algebra. No framework dependency, importable by URL.
src/substrate/    Part 3 — the Matrix-backed log adapter, room templates, appservice
                  provisioning, and the Layer 3 publishability predicate.
src/projection/   Part 3 Layer 4 — the CQRS read-model consumer.
src/generator/    Part 5 — AppSpec schema, validateAppSpec (the grounder's gate), generate().
src/surfaces/     Part 4 Tier 1 — Table, Chart, Map, Feed, Form.
src/surfaces/tier2/  Part 4 Tier 2 — Board, Social feed, CRM, Graph, News site, Calendar,
                     each gated by a feature flag (src/surfaces/tier2/flags.js).
src/export/       Part 6 — exportSingleFile and exportBundle.
```

Every module follows the same shape: pure, framework-free logic that's fully testable under plain
Node, plus (for surfaces) a documented but unexercised browser-render stub, since this environment
has no DOM and the project's own "no build" philosophy means real rendering happens via import maps
and esm.sh at runtime, not through a bundler this repo owns.

## What's established versus what's a projection sketch

Carrying Part 9's distinction forward, applied to this specific codebase rather than the theory:

**Established — implemented and tested against real inputs/outputs:**

- The kernel (Part 2): the address algebra round-trips losslessly through every face, the desert
  cell is a hard rejection, the nine operators have a unique Act coordinate each, the Born-rule
  weights sum to one and are seeded/replayable, canonicalization is stable across key-order
  permutations. 43 tests, all exercising real inputs, not mocks.
- `validateAppSpec` / `generate()` (Part 5): a spec with a desert binding, an unknown surface type,
  a stale `rules_rev`, or a missing provenance template is rejected with its residue, not silently
  repaired. A hardcoded AppSpec drives real surfaces against a real (in-memory) log end to end.
- Tier 1 and Tier 2 surface *controllers*: every write binding runs through `validateBinding` before
  appending; Chart truly has no write path (an empty, frozen bindings object, not just an unused
  one); Tier 2 writes are refused while their flag is off, regardless of validity.
- `exportBundle`'s zip layout matches the doc's tree exactly, verified by actually unzipping the
  output and reading manifest/spec/kernel/surfaces files back out.

**Projection sketch — coded against a documented contract, not against the real thing:**

- `MatrixLog`, `appservice.js`, and the room templates (Part 3) are implemented against a
  hand-documented duck-typed client shape and tested with hand-written fake clients. **Nothing here
  has run against a live Synapse homeserver.** The event-mapping round-trip, the append/stream/slice
  contract, and the ghost-provisioning flow are only as correct as the fake client's fidelity to the
  real matrix-js-sdk surface.
- `createProjectionConsumer` (Layer 4) materializes a real read model from a real log adapter, but
  `publish()`'s CDN push is a callback stub — there is no CDN in this environment to push to.
- The talker (`src/generator/talker.js`) is an interface only. `proposeAppSpec` throws by design;
  wiring an actual in-browser LLM here is explicitly out of scope for this build (Part 7: "first
  with a hardcoded AppSpec, then wired to the talker" — this build stops at the first half).
- Surface `render()` functions are JSDoc-documented intentions (which esm.sh package, which prop
  flows from `read()`/into which binding), never executed — there's no browser in this environment.
- `exportSingleFile`'s inlining has a known, documented rough edge: the kernel is six files with
  relative imports between them, and naive concatenation doesn't produce runnable inlined script.
  Callers must pass already-flattened source; this build doesn't include a bundling step to produce
  that automatically.

**Deliberately not built:**

- The Document reader (Tier 3) — the design doc itself defers this ("it waits because the substrate
  has to be proven under lighter surfaces first"), and `validateAppSpec` rejects an AppSpec naming
  it as an unknown surface type, same as a typo. `NewsSite`'s "reader per piece" uses a minimal
  single-document stand-in instead, noted inline where it's built.

## Build order followed

This implementation followed Part 7 in spirit: kernel with golden tests first, then the Matrix
substrate, then one Tier 1 pair (Table + Form) proven end to end through `generate()`, then the
export path, then Tier 2 behind flags, then the Layer 3/4 pieces that had been missed in the first
pass. Golden tests throughout: a negative result (a rejected desert binding, an unknown surface
type, a refused Tier-2 write while its flag is off) counts as a passing test, not a failure to work
around.
