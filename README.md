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

228 tests across the whole tree as of this writing. `vitest.config.js` picks up everything under
`tests/**/*.test.js`.

To load `docs/data/public-api-catalog.json` (~34 public data sources) into the substrate as real,
searchable Table rows — rather than leaving it as a reference file — run:

```
npm run load:catalog                 # dry run against an in-memory log, prints a summary
EO_HOMESERVER_URL=https://matrix.example.org \
EO_USERNAME=alice EO_PASSWORD=hunter2 \
EO_ROOM_ID='!catalog:example.org' \
  npm run load:catalog               # actually saves it into that Matrix room
```

Same homeserver-agnostic wiring as `smoke:matrix` below — it re-runs safely (already-loaded rows are
skipped by id, not duplicated).

To check the Matrix substrate against a **real, live homeserver of your choosing** (any Synapse or
other implementation you have an account on — nothing here is pinned to one), run:

```
EO_HOMESERVER_URL=https://matrix.example.org \
EO_USERNAME=alice EO_PASSWORD=hunter2 \
EO_ROOM_ID='!yourroom:example.org' \
  npm run smoke:matrix
```

This is separate from `npm test` on purpose — there's no live homeserver in this environment, so it
can't be part of the automated suite, but the script itself makes no assumption about which
homeserver you point it at.

## Layout

```
src/kernel/       Part 2 — the algebra. No framework dependency, importable by URL.
src/substrate/    Part 3 — the Matrix-backed log adapter, room templates, appservice
                  provisioning, and the Layer 3 publishability predicate. client.js and
                  real-client-adapter.js wire a real matrix-js-sdk client to any homeserver
                  URL; appservice-client.js does the same over the raw AS HTTP API.
src/projection/   Part 3 Layer 4 — the two materializations. consumer.js is the server-side
                  CDN projection (publishable entries only, for anonymous readers).
                  local-projection.js + opfs-store.js is the client-side, OPFS-backed
                  materialization logged-in editors read from (full room access, unfiltered).
src/generator/    Part 5 — AppSpec schema, validateAppSpec (the grounder's gate), generate().
src/surfaces/     Part 4 Tier 1 — Table, Chart, Map, Feed, Form.
src/surfaces/tier2/  Part 4 Tier 2 — Board, Social feed, CRM, Graph, News site, Calendar,
                     each gated by a feature flag (src/surfaces/tier2/flags.js).
src/export/       Part 6 — exportSingleFile and exportBundle.
src/data-sources/ Not part of the design doc's Parts. Turns docs/data/public-api-catalog.json
                  into real Table rows (ingest.js) and adds the "search your catalog"
                  matching logic (search.js) from docs/data/mini-site-builder-guide.md —
                  a separate reference guide for an unrelated "any-data mini-site builder"
                  feature, saved alongside its seed catalog under docs/data/.
src/builder/      A visual, human-driven stand-in for the talker (src/generator/talker.js,
                  which throws by design — Part 7 defers it). appspec-builder.js is pure,
                  framework-free state -> AppSpec assembly, gated by the same
                  validateAppSpec every other spec goes through. instantiate.js turns a
                  generate() result into real Tier 1 surface instances. preview.js is a
                  real (not stubbed) DOM mount for Table and Form, so the browser page at
                  the repo root (index.html) lets someone assemble an AppSpec by hand and
                  immediately drive a working add-row / form-submit loop against an
                  in-memory log.
```

## App Builder

`index.html` + `app.js`, at the repo root, is a plain-ES-module page (no bundler, no framework —
same "no build" approach as the rest of this repo) for assembling an AppSpec through a UI:
add a site, add surfaces, add bindings, then "Validate & build app" runs the exact
`validateAppSpec` / `generate()` gate every other AppSpec goes through. Table and Form
surfaces get a real, working live preview (add a row, submit the form) backed by an
in-memory log; other surface types show an explicit "no preview yet" notice rather than a
silent no-op.

Since ES module imports need http(s), not `file://`, serve the repo root first:

```
npm run builder
```

then open `http://localhost:8420/`.

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
- `src/substrate/client.js` (`createMatrixClient`, `loginWithPassword`, `startAndAwaitSync`) is a
  real `matrix-js-sdk` client factory — `homeserverUrl` is always a caller-supplied parameter, so it
  connects to any homeserver, not one this repo hardcodes. `real-client-adapter.js` bridges the real
  SDK's getter-based `MatrixEvent`/`Room` objects to the plain-field shape `MatrixLog` expects, and a
  full append/stream/slice/checkpoint cycle is driven through that bridge in
  `tests/substrate/real-client-adapter.test.js` using event objects shaped exactly like real
  matrix-js-sdk ones (verified against the installed SDK's actual `MatrixEvent`/`Room`/`EventTimeline`
  prototypes, not guessed). `appservice-client.js` implements `register`/`joinRoom`/`addCredentials`
  over the raw Application Service HTTP API via `fetch`, also homeserver-URL-parameterized.
- Collaboration is native, not added: `tests/substrate/matrix-log.test.js` runs two independent
  `MatrixLog` instances (different senders, no coordination between them) appending into one shared
  room state, and a third reads both back with each entry's own sender intact — the "merge" is
  nothing but the room's own event ordering, no CRDT needed for the entry-per-event model.
- The two Layer 4 materializations: `createProjectionConsumer` (the server-side CDN projection,
  publishable entries only) and `createLocalProjection` + `opfs-store.js` (the client-side
  materialization a logged-in editor reads from — unfiltered, since a room member already has full
  access, and stamped with a folded Meant-Graph on every sync). Both tested against real log adapters
  with real entries, including a test that an entry lacking `grounding` (which the CDN projection
  drops) still lands in the unfiltered local one.
- `src/data-sources/ingest.js` + `search.js`: the data-source catalog is loaded and searched against
  the real `docs/data/public-api-catalog.json` file in tests, not a fabricated fixture — every one of
  its ~34 entries lands as a Table row with a legal, non-desert, grounded address, re-running the
  loader skips already-present ids instead of duplicating, and `catalogFilter('weather')` is checked
  to actually narrow to the right two rows out of the full set.

**Projection sketch — coded against a documented contract, not against the real thing:**

- Everything above is real matrix-js-sdk / real AS HTTP calls, but **nothing in this repo has run
  against a live Synapse homeserver** — there isn't one in this environment, and no credentials to
  reach one. `scripts/smoke-test-matrix.mjs` is the gap-closer: point `EO_HOMESERVER_URL` (and either
  `EO_ACCESS_TOKEN`/`EO_USER_ID` or `EO_USERNAME`/`EO_PASSWORD`) at any homeserver you actually have an
  account and a room on, and it appends a probe entry, waits for a real `/sync` round-trip, and checks
  it reads back with the expected sender. Run it — this repo can't run it for you.
- **A real architectural subtlety this surfaced**: `MatrixClient#sendEvent` has no "sender" parameter
  — the persisted `event.sender` is always whoever the connection is authenticated as, never whatever
  `entry.agent` a kernel-level caller attached before calling `log.append()`. `generate()`'s bindings
  build `entry.agent` for `validateBinding`'s provenance check, but once `MatrixLog` is the backing
  adapter, the agent of record that actually lands in the room is fixed by which authenticated
  session (a per-user login, or an AS-impersonated ghost session) performs the append — not by that
  field. A real deployment has to keep those two in lockstep (e.g. one Matrix session per acting
  user) for the provenance envelope to mean what Part 3 says it means; this build surfaces the
  seam but doesn't build that session-per-user wiring.
- `createProjectionConsumer` (Layer 4) materializes a real read model from a real log adapter, but
  `publish()`'s CDN push is a callback stub — there is no CDN in this environment to push to.
- `createOPFSStore` is a real implementation over `navigator.storage.getDirectory()`, but OPFS is a
  browser-only API — there's no browser here to run it in, so it's exercised only for the one thing
  that's true in any environment: that it refuses to run rather than silently no-op-ing when
  `navigator.storage` doesn't exist. `createLocalProjection`'s actual sync/read logic is tested
  against `createInMemoryOPFSStore` instead, the same reference-implementation pattern as
  `InMemoryLog` for the kernel log adapter.
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
- Everything in `docs/data/mini-site-builder-guide.md` except the catalog-search piece: `classify()`,
  `normalize()`, the three-lane fetch model, SSRF-hardened fetching, and the intake wizard are all
  reference-only. Only the guide's "search your catalog" intake path got built (`src/data-sources/`),
  because it's what the catalog is actually for; the rest describes a different, unimplemented
  feature that happens to be documented in this repo.

## Build order followed

This implementation followed Part 7 in spirit: kernel with golden tests first, then the Matrix
substrate, then one Tier 1 pair (Table + Form) proven end to end through `generate()`, then the
export path, then Tier 2 behind flags, then the Layer 3/4 pieces that had been missed in the first
pass. Golden tests throughout: a negative result (a rejected desert binding, an unknown surface
type, a refused Tier-2 write while its flag is off) counts as a passing test, not a failure to work
around.
