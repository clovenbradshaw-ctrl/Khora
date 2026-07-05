# EO Substrate: Complete Design

**Status:** consolidated master. RULES_REV `2026-07-05.a`.
**Canon pinned against:** experientialontology.org/eo-wiki.md, fetched 2026-07-05. Act face DB 59, Site face DB 61, Bivalent Compression DB 24, Saving the Appearances DB 49.
**Supersedes:** the separate build spec and surface catalog, which this folds together. The theory here is grounded in the live corpus exemplars, not paraphrase.

This is one document, in nine parts. Part 1 is the theory the whole thing stands on. Parts 2 through 6 are the build: the kernel, the Matrix architecture, the surfaces, the generator, the export. Parts 7 through 9 are the order of work, what we borrow rather than build, and what is established versus projected.

---

# Sources: where the canonical inputs live

Two repositories are authoritative, and a builder should read them before writing anything, because the substrate reuses this work rather than reinventing it.

**The wiki is the theory.** The most current canon lives at `https://experientialontology.org/eo-wiki.md`. The plain `.md` fetch returns articles alphabetically and truncates around the C section, so for articles past F use the Xano source directly at `https://xvkq-pq7i-idtl.n7d.xano.io/api:GGzWIVAW/get_eowikicurrent`, which paginates at 25 records per page and is the authoritative store of live record ids. Where the wiki contradicts itself, the live Act face article wins and the RULES_REV records which direction a log was built against. A March snapshot for offline grep sits at `/mnt/project/eo-wiki_mar_26.md`, but it is a snapshot and the live source supersedes it.

**eoreader4.1 is the existing build.** The primary build is `https://github.com/clovenbradshaw-ctrl/eoreader4.1`, and it is already the shape the export targets: a single-file app. `index.html` on the main branch is the whole application, roughly 892KB, and it carries the EO machinery inline, the Chorus, the surfer, the fold, the enact loop, and the canonicalization, confirmed by symbol inspection. It ships with a `vendor/` folder holding pinned React and a compiled `dc-runtime.js`, which is generated from `dc-runtime/src/*.ts` and built with bun, plus a `templates.html`. So the substrate does not write a new dreamer, a new surfer, a new Born read, or a new canonicalizer. It lifts them from this repo. A builder should read `index.html` to locate the exact symbols rather than trust a remembered path, since the older `src/rest/cycle.js` reference for the dreamer does not resolve on the current main branch. The kernel in Part 2 is the extraction and hardening of what already runs here, not a fresh implementation.

**Companion repositories.** `github.com/clovenbradshaw-ctrl/eoreader4` is the prior version. `github.com/clovenbradshaw-ctrl/eo-lexical-analysis-2.0` holds the empirical corpus and the cross-linguistic study that grounds Part 1. `github.com/clovenbradshaw-ctrl/npj` is the Nashville People's Journal, whose append-only JSONL chain on archive.org is the same provenance pattern the news-site surface makes native.

The rule for the whole build: pull the theory from the wiki, pull the running machinery from eoreader4.1, and treat both as the source of truth over anything remembered.

---

# Part 1: The theory

## The object

EO's core object is a 27-cell capacity ground formed by crossing three axes, each with three values. Mode: Differentiating, Relating, Generating. Domain: Existence, Structure, Significance. Object: Ground, Figure, Pattern. The third value on each axis is not a midpoint between the poles. It is √2, the hypotenuse, the emergence coordinate that sits at a right angle to the visible axis. What looks like a line with two endpoints is a triangle viewed edge-on. If the poles are −1 and +1, then √(−1² + +1²) = √2, and the third term needs a new dimension to live in. Each axis carries its own values {−1, +1, √2}, and the three axes are themselves a meta-triad, so the structure describes itself at its own top level. The 27 is the framework's stated greatest vulnerability, because no theorem predicts it from first principles. The kernel carries the 27 as a fixed fact and says so.

## The projective constraint

Nothing, including natural language, presents all three axes at once. Every representation is a 2D face of the 3D ground, and there are exactly three faces. Projection from the full ground down to a face is a controlled reduction: one axis is dropped, but the loss is tracked, the practitioner knows which axis is missing, and √2 survives on the two remaining axes. Compression from a face upward is a lossy reconstruction: the observer does not know what is missing, does not know how many axes are missing, and does not know √2 exists as a coordinate. This asymmetry is why every 2x2 framework in intellectual history keeps narrating emergence as a dialectical event, citing both poles at once, because it has no address for the √2. A map made by someone who has seen the territory reads back into the territory. A map drawn by someone who has never left the map does not.

## The three faces

Act face, Mode by Domain, gives the nine operators: what operation is occurring. Site face, Domain by Object, gives nine terrains, Void through Paradigm: where in reality the target sits. Resolution face, Mode by Object, gives nine stances, Clearing through Composing: at what grain the transformation engages. The canonical full notation is `operator(Site, Resolution)`. One live-wiki caveat: the article labeled Resolution Face currently holds Site face content, so the stance names are not settled, and the kernel keys stances by their Mode by Object coordinate rather than by name.

## The nine operators

Nine, in a dependency helix, each defined by the corpus exemplars rather than by theory. Existence triad: NUL recognizes absence, the non-presence of something expected. SIG registers a difference, something coming to notice. INS creates an instance, a new concrete thing entering existence. Structure triad: SEG draws a boundary, partitioning within a structure. CON connects across a boundary, holding things in relation. SYN merges parts into a whole that exceeds them. Significance triad: DEF establishes what holds, a corrective counter-assertion that revises a value inside a frame without changing the frame, "it is not race," "what he claims is far from true." EVA renders judgment, the reported-speech register where a speaker holds two incompatible positions at once under evaluation, conceding and maintaining together. REC changes the frame itself, re-categorizing rather than revising, "my impression has completely reversed," a different kind of thing entirely.

DEF is not holding multiplicity, and neither is any operator. Under the log-primary architecture the append-only log holds contradiction structurally, so two conflicting DEFs are two entries with different provenance and no operator stores the contradiction. That is the pre-log-primary SUP problem dissolving. REC presupposes the whole helix below it, there is no tenth operator, and a second pass changes register rather than inventory.

The kernel keys each operator by its code plus its Mode and Domain coordinate. Glyphs and Greek letters are display labels, since the wiki carries three glyph systems still in flux. This also handles the DEF and EVA direction split: older wiki articles carry the swapped Mode coordinate, the live Act face carries the corrected one, and the RULES_REV stamp records which direction a log was written against.

## The empirical ground

The record is the cross-linguistic corpus, about 19,764 consensus clauses across 41 languages in the Act and Site articles, plus the wider inventory of roughly 32,000 verbs across 27 languages. Three findings weigh most. The Significance triad is universally thin: EVA and REC together are near 2 percent of verb inventories across all languages, and no language exceeds 5 percent, which is the dimensional poverty claim. DEF vocabulary hides inside NUL in English, where verbs like hide, deny, suppress, and censor denote simultaneous presence and absence but get filed under negation because the nearest bin is NUL. And SYN by Ground returns zero verbs across the corpus, the desert cell, a verb meaning "synthesize a condition" that no tested language has. The kernel encodes the desert as a hard prohibition its validator refuses to fill. Two caveats travel with the data: SIG's exemplars come back 25 of 25 German from one service-review corpus, which the wiki flags as a likely artifact, and the empty cell may in principle be a verb-category artifact, though it is treated as structural.

## The epistemic spine

EO makes its claims in two tiers and refuses to weld them. The Ptolemaic claim comes first, borrowed from ancient astronomy's demand to save the appearances: the nine operators and the 27-cell ground can receive any described transformation in any domain without remainder and without distortion. This is expressive completeness, not causal correctness, and it is falsifiable by residue, which is any component of a description that gets no address. Two things that are not residue: underdetermination, where multiple valid addresses fit one description, and empty cells, where the grammar has an address no transformation occupies. The desert cell is an appearance to be saved, not a gap to be filled. The Newtonian claim, that the operators track the real causal structure of transformation, is deferred and may not be the right frame. Speculative domain mappings are projection sketches, named that way to carry the reminder that projections lose a dimension.

## The runtime consequences

This is where eoreader lives, and where the substrate begins. The Given-Log is primary. Every entry is a situated observation carrying its epistemic constitution: agent, mode of givenness, context envelope. The log records what was observed, never what it means. The mycelium is the worked case: a fungus with no nervous system observably performs seven of the nine operators, and the log records "these capacities are observably present, as observed by this agent, in this mode, within this frame," not "the fungus is conscious." Meaning lives in the Meant-Graph, which is revisable, and truth is a limit the graph approaches asymptotically as observations accumulate from multiple positions. Every finite interpretation is provisional by the structure of a calculus limit, formally addressed by 2^√2, transcendental by Gelfond-Schneider, which makes provisionality a theorem rather than manners. No-cloning and no-deleting follow from the append-only log. Measurement follows the Born rule, probability proportional to amplitude squared, treated as foundational with Gleason as the uniqueness argument. Selfhood is distributed across four loci: frame as standing origin, surfer as the deictic now, enact holon, and fold as the γ-decayed integral of the enacted log. The dreamer exists because the reader differentiates faster than it integrates, and it is geometrically firewalled, regenerating candidates from the DEF leg alone so dream figures are incomplete rather than false, and it cannot synthesize from pure Ground because the desert forbids it. The LLM in all of this is a phrasing surface. Every structural decision belongs to the mechanical grounder.

## Why this generates apps

Any application is a transformation system: state changes, addressed and logged. So a substrate needs two things that never mix. A kernel that never varies, the algebra and the validators and the log discipline, and a surface layer that always varies, what a given app does. The kernel injects verbatim into every generated app. The talker only ever writes the surface. That split is the whole design, and it falls straight out of the talker/grounder discipline.

---

# Part 2: The kernel

`src/kernel/`, one module, no framework dependency, importable by URL. The only EO-specific code in the system, and it is extracted and hardened from what already runs in eoreader4.1's `index.html`, not written fresh.

`src/kernel/address.js`. The `Address` type is three integers, one per axis, each in {0,1,2}. `makeAddress(mode, domain, object)` returns a frozen address or throws. `faceOf(address, face)` drops the third axis and returns the 2D face coordinate plus a note recording which axis was parked. `recover(faceCoord, thirdAxisValue)` reconstructs the full address, which is the projection direction and is lossless.

`src/kernel/operators.js`. The nine operators as a frozen table keyed by code, each carrying its Mode and Domain coordinate, helix position, live semantic string, and a display block with glyph and Greek label. `operatorAt(mode, domain)` resolves the Act cell to an operator. Nothing here reads a glyph to decide anything.

`src/kernel/validate.js`. `isLegalAddress(address)` checks the range. `isDesert(address)` is true exactly when the operation is SYN and the Object coordinate is Ground. `validateBinding(binding)` rejects any binding whose emitted operation is desert, any address out of range, and any entry missing a provenance envelope. `residue(description, addresses)` returns the part of a described transformation that received no address, which is the residue-test primitive.

`src/kernel/read.js`. `bornWeights(folds)` returns a distribution proportional to amplitude squared over a set of folds. `sample(folds, seed)` draws one fold under that distribution with a logged seed. Read-time only, every draw seeded and recorded.

`src/kernel/canonical.js`. The canonicalization of an entry to a stable byte string, so its hash is identical across serializations. This is not optional. The publishability predicate and the CON grounding checks in Part 3 rest on stable hashes, and a hash that shifts with serialization makes the references flaky.

`src/kernel/log.js`. The log adapter interface, not an implementation. `append(entry)`, `stream(sinceToken)`, `slice(filter)`, `checkpoint(meantGraph)`. The Matrix substrate implements it.

Golden tests before anything else. A legal address round-trips through `faceOf` and `recover` with no loss. A desert address is rejected. `bornWeights` sums to one. Two serializations of one entry canonicalize to the same bytes. The residue test returns empty for a fully addressed description and non-empty for one with a remainder. A measurement that comes back negative here is a success.

---

# Part 3: The Matrix architecture

Most of what the substrate needs, Matrix already is. A room is an append-only, signed, hash-linked event DAG with access control and federation, so the work is correspondence and provisioning, not building an event store. Five layers.

## Layer 1: Synapse as source of truth

Rooms are holons. Events are EO entries. Spaces, rooms holding `m.space.child` pointers, give holonic whole-and-part nesting natively: a publication is a space, an article is a room, both are holons. The room DAG is the append-only log, with parent-hashing, signing, and state resolution supplied. A Given-Log entry is a namespaced custom event whose content carries the operation and the provenance envelope.

```
type: "social.hyphae.eo.entry"
content: {
  rules_rev: "2026-07-05.a",
  op: "DEF",
  address: { act: [0,2], site: [2,1], resolution: [0,0] },
  target: "<entity id or address>",
  operand: <value or null>,
  given: {
    mode_of_givenness: "<how it was observed>",
    context: "<frame envelope>"
  },
  grounding: [ "<event_id of the archived-source entry this CON-links to>" ]
}
```

The agent is `event.sender`. The timestamp is `origin_server_ts`. The entry id and signature are the homeserver's. So agent, time, identity, and integrity are not our code. Immutability gives no-deleting, since redaction is itself an event. Distinct senders give no-cloning. The DAG plus state resolution is the version control, so reverting is sending a prior state and auditing is reading `sender` across the timeline.

## Layer 2: the appservice as provisioning and write gateway

An Application Service is the primitive for auto-creating an account tied to the API. It owns a namespace of ghost users, `@_site_*`, holds a registration token, and can mint ghost users, auto-join them to rooms, and intercept every event in its namespace. The site's API is the appservice. Room membership is read permission, power levels are write permission. Do not mint a ghost for every anonymous reader. Pure readers hit the projection in Layer 4 with no account. A real account is provisioned only on first interaction, a comment or a subscribe or a save. That account is claimable: `convertToUser(credentials)` attaches an email or password without changing the user id, so prior entries stay owned and the account becomes portable. A person who already runs Matrix brings their own account, and their private rooms on their own homeserver are their storage. `src/substrate/templates.js` holds the room templates, each fixing a visibility, a join rule, and a power-level map from event type to required level. That template set is the account and permission structure, and it is the one piece we author rather than inherit.

## Layer 3: publishability as a filter predicate

Moderation is content, not a workflow. A policy room holds glob rule events enforced by a Draupnir-style bot, which is the blacklist, versioned and revertible. The direction that matters more here is the allowlist: an EO entry is not publishable until it carries its `grounding` annotation, the CON-link to an archived source. Publishability is a predicate over event state. The projection renders an entry only when it is unredacted, matches no policy rule, and carries its grounding. The epistemic-status topology from the {plain text} work is this predicate, enforced at render rather than described in prose.

## Layer 4: the CQRS read projection

Never serve public reads from Synapse. It will fall over under load, and it cannot resolve EO notation to HTML. A consumer tails the rooms, through appservice transactions or `/sync`, and materializes a read model: an edge key-value store, a SQLite file, or straight static generation. It resolves the EO notation to rendered markup and pushes to a CDN. The DAG is the write model and source of truth. The projection is the fast read model, and it is where fast loading comes from. The projection is the Meant-Graph made servable, provisional by the theorem and stamped with the DAG head it was built from.

There are two materializations, one per audience. The server-side CDN projection above serves anonymous readers at scale, and it is non-negotiable. Logged-in editors read from a second materialization that lives on their own device in OPFS. The client tails the room and writes each EO entry and the folded Meant-Graph into an OPFS-backed store, then renders from OPFS, which gives instant local reads and offline capability. OPFS is the local data store, the same bare-metal path eoreader already uses, not merely the weights store. The talker's model weights also live in OPFS, alongside the log and the read model.

Matrix is the collaboration layer, and collaborative editing is native rather than added. A room is a multi-user append-only event stream with per-event provenance and state resolution, so two people editing at once are two streams of events the room merges by the rules it already has. Concurrent EO entries are concurrent events, and the log-primary reconciliation, two conflicting DEFs are two entries with different sender, is exactly how the room propagates them. No CRDT is needed for the entry model. A CRDT such as Yjs rides on top only if a surface wants character-level co-editing of a single text field, which the append-only entry model does not require. The public-private line lives here too: public reads come from the CDN projection with no account, private reads require room membership and a client that syncs the room into its own OPFS store. An app is not public or private as a whole. Each of its rooms is.

## Layer 5: content-addressed media

Drop the location-addressed MXC scheme and store blobs by content id, an IPFS-style Merkle DAG or object storage keyed by CID. Put the CID in the EO event. Content-addressing buys deduplication, integrity checks, and the fast-loading win: assets are immutable by identity, so cache them forever and never revalidate. This is the honest version of the blockchain intuition. A literal blockchain, with consensus and global ordering, is the opposite of fast loading and is not needed, because the integrity people reach for it to get is already supplied by Matrix's signed hash-linked DAG.

## Tradeoffs to hold

Three, and the first is not hypothetical given the beat. Append-only immutability collides with a right to erasure, and the camping-story and eviction-record data make that concrete. Matrix redaction handles the DAG side, but the content-addressed store needs an explicit tombstone and unpin discipline, because content-addressing resists deletion by design. Second, EO-in-events needs the canonicalization from Part 2 so hashes are stable, or the grounding checks get flaky. Third, resist letting logged-in interactive surfaces read live from Synapse for freshness. Keep even those going through the projection with a short window, or the scaling problem the projection was built to avoid comes back.

---

# Part 4: The surfaces

Each concrete surface is a projection of the substrate onto a familiar shape, and the shape comes from the Site face, which names which terrain of reality the surface renders. A chart lives in Kind, the terrain of rates and demographics, whose exemplars are "eleven people are born" not "a child was born." A map lives in Field, the ambient relational environment of a territory, whose exemplars are a commune's arable land and its town hall. Every surface reads by querying the log, writes by appending an operator entry the kernel validates, renders with an off-the-shelf React component imported by URL, and has a defined fallback so it cannot wedge the app.

## Tier 1, high confidence

**Table.** The database grid, the backbone. Home terrain Entity borrowing Kind. Adding a row is INS, editing a cell is DEF, grouping is a read-only SEG view, changing the schema is REC. Renderer TanStack Table, or a canvas grid for large data. Fallback is cached rows editable as pending drafts. Procurement records, expenditure lines, source inventory.

**Chart.** A read-only projection, never a write surface, which makes it the safest to ship. Home terrain Kind. Read is an aggregation over the log. A selection can drive a filter, a SEG view, but it appends nothing. Renderer Observable Plot or Recharts. Fallback is a cached snapshot with a staleness note. DFR demographic skew, expenditure over time, the cross-linguistic z-scores.

**Map.** Points and regions on geography. Home terrain Field borrowing Entity. Placing a marker is INS, drawing a boundary is SEG, connecting points is CON. Renderer MapLibre GL with OpenStreetMap tiles, no key, or Leaflet. Fallback is the last tile and marker cache. DFR flight footprint, Flock camera locations, dock siting.

**Feed.** The chronological stream, the log made public-facing. Read is the room timeline. Write is INS to post, CON to reply. Renderer a virtualized list. Fallback is the cached timeline.

**Form.** The intake surface. Home terrain is whatever it targets. Write is one operator, INS or DEF, bound at spec time. Renderer a schema-driven form from react-jsonschema-form or ui-schema. Fallback holds a failed submit as a pending draft. Tip submission, FOIA intake, source contact.

## Tier 2, confident, behind a flag

**Board.** The kanban pipeline. Home terrain Network. Moving a card is DEF, adding one is INS, redefining the columns is REC. Renderer a column layout with dnd-kit. Story pipeline, FOIA pipeline, editorial queue.

**Social feed.** The scrolling stream from people you follow, in the shape of X or Instagram or Bluesky. Home terrain Entity, borrowing Field for the stream and Network for the follow graph. Matrix.org built exactly this as Cerulean, so the model is proven: each person's posts live in their own timeline room, a post is an INS into your room, following is a CON subscription to a room, a like is a Matrix reaction which is SIG, a reply is a CON into a thread room, images ride the media repository. Posts in your own room is the same ownership pattern as Bluesky posts in your own repository, a structural parallel and not an interoperability claim. Renderer a virtualized card list over matrix-js-sdk, which supplies timeline, reactions, threads, media, guest peek, and, since Matrix v1.18, protocol-level moderation. Posting uses a room-scoped capability, so a feed client cannot reach a person's other rooms. Fallback is the last synced timeline and a pending-draft retry.

**CRM.** A composed tool. Home terrains Link and Network. It composes a table of contacts, an entity card per contact, a board for the pipeline, and a graph of relationships. Creating a contact is INS, linking is CON, advancing a stage is DEF, qualifying a lead is EVA, re-segmenting is REC. Source relationship management, the surveillance procurement network of vendors and council members and the NDP.

**Graph.** The node-link view, the Meant-Graph made public-facing. Home terrains Network and Link. Nodes are INS entities, edges are CON relations, a named cluster is SYN. Renderer Sigma.js over Graphology, or react-force-graph. The surveillance procurement network as an explorable map.

**News site.** A publication, composed. Home terrain Entity borrowing the Significance terrains Lens and Paradigm. It composes a public feed of pieces, a reader per piece, and a private editing room. Publishing is INS, a correction is DEF, editorial judgment is EVA, a retraction or reframe is REC. The append-only room is the provenance chain, the same shape as the archive.org JSONL chain, now native. Ground Truth Nashville, the Nashville People's Journal, EO Lab.

**Calendar.** Time-addressed entities. Home terrain Entity borrowing Field. A new event is INS, a reschedule is DEF. Renderer FullCalendar or a light custom view. Hearings, deadlines, publication dates.

## Tier 3, later

**Document reader.** The eoreader core, a document with its clauses addressed across the full operator pass. Home terrain the whole substrate. It is the existing eoreader build bound to a room instead of local storage, and it waits because the substrate has to be proven under lighter surfaces first.

## How surfaces compose

The single surfaces are primitives. The tools people ask for by name are compositions. A CRM is a table plus a board plus an entity card plus a graph over one room. A news site is a feed plus a reader plus an intake, split across a public room and a private room. A social network is a social feed plus a profile card plus a composer. A dashboard is charts plus a table over one log. The composition is a list of surfaces in the AppSpec, each bound to a room and a set of cells, not new code.

---

# Part 5: The generator

`src/generator/`. The talker emits an AppSpec, a JSON construal of an app. It never emits app logic.

```
{
  rules_rev: "2026-07-05.a",
  site: { space_or_room, visibility, power_template },
  surfaces: [ { type: "Table", class, room }, { type: "Map", coordinate_field, room } ],
  cells: [ { act, site, resolution } ],
  bindings: [ { on: "<ui event>", emit: { op, address, target } } ]
}
```

`validateAppSpec(spec)` checks that every address is legal, no binding is desert, every surface type is known, every emitted entry will carry a provenance envelope, and the RULES_REV is stamped. A spec that fails is returned with its residue, not silently repaired. The grounder is the mechanical half and holds all structural authority.

The flow. A person describes an app in plain language. The talker, the in-browser LLM, emits a candidate AppSpec. The grounder validates it against the kernel. The renderer instantiates the surfaces wired to their rooms. Every user action appends a `social.hyphae.eo.entry`. The LLM wrote a construal and nothing else. EO operators, cell names, and machinery vocabulary never enter the LLM prompt.

---

# Part 6: Export

`src/export/`. A generated app can leave the substrate as a standalone artifact. An export is a holon detached from its space, in two shapes, built in the browser with JSZip so export needs no server and stays consistent with the no-build rule. Every export carries its RULES_REV so an old bundle stays interpretable.

`exportSingleFile(appSpec, mode)` returns one `.html` file with the kernel, the selected surfaces, the AppSpec, and a bootstrap inlined, and the importmap resolved to inlined dependencies so nothing loads from a network at open time. Live mode inlines a Matrix client and connects to the homeserver through the projection endpoint. Snapshot mode bakes the projection's materialized read model into the file, read-only, no server and no client, the Meant-Graph frozen at an instant. A snapshot carries its provenance in a header: the room, the DAG head event id, the RULES_REV, and the projection time, so a frozen apprehension is still a situated observation.

`exportBundle(appSpec, mode)` returns a zip of a nested tree: `index.html`, `kernel/`, `surfaces/`, `spec/appspec.json`, `projection/` for the materialized read model in snapshot mode, `vendor/` for client dependencies, `media/` keyed by content id, and `manifest.json`. Unzip it and serve it on any static host, GitHub Pages included. This is the maintainable, editable, deployable form, and it is what lives on a GitHub site.

The single file is the holon sealed as one artifact, easy to hand to someone. The bundle is the same holon with its parts visible, easy to keep and change. Snapshot mode of either needs no homeserver, so a public read-only app hands off with its content baked in and its provenance attached, which is the export path for a published piece.

---

# Part 7: Build order

Approach from below. Cheap read-only checks before every build. A negative result is a success.

First the kernel with golden tests, including canonicalization, since the kernel is where an entry serializes and the grounding checks depend on stable hashes. Then the Matrix substrate implementing the log interface: event-to-entry mapping, provenance envelope, one room, append and read verified against a real homeserver. Then the appservice provisioning one ghost user into one room on first interaction. Then one Tier 1 surface end to end, Table plus Form against a room, with the desert stop proven live. Then a snapshot export of a single public room, so the whole pipe is visible before the projection consumer runs. Then the projection consumer and the CDN path. Then the generator, first with a hardcoded AppSpec, then wired to the talker. Then Tier 2 surfaces, each behind a flag with golden parity on the existing path.

---

# Part 8: What we do not hand-roll

| Layer | Off-the-shelf | Why it fits |
| --- | --- | --- |
| Hosting | GitHub Pages plus a homeserver | Static client, federated log |
| No build | importmap plus esm.sh | One committable file, no npm |
| Talker | Transformers.js, Llama-3.2-3B, weights from OPFS | Already in eoreader, wllama later for lower memory |
| Existing EO machinery | eoreader4.1 index.html, compiled dc-runtime | Chorus, surfer, fold, enact, canonicalization already built and running |
| Log, identity, permissions, version control, moderation | Matrix, matrix-js-sdk, Synapse, appservice, policy rooms | Signed append-only DAG with sender provenance, power levels, and protocol-level moderation |
| Social feed | Cerulean pattern over matrix-js-sdk | Timeline rooms, reactions, threads, media proven |
| Forms and surface shapes | react-jsonschema-form or ui-schema | Schema-driven UI, no hand-rolled forms |
| Table, map, chart, board, graph | TanStack Table, MapLibre, Observable Plot, dnd-kit, Sigma over Graphology | Each a maintained flagship with a defined fallback |
| Zip export | JSZip | Client-side archive, no build |
| Retrieval | Orama, hybrid vector and BM25 | Already in eoreader, fully client-side |

What is ours and cannot be borrowed: the kernel. The 27-cell address algebra, the operator table keyed by coordinate, the address validators, the desert prohibition, the provenance envelope, the canonicalization, the Born read, and the talker/grounder discipline that keeps the LLM writing construals and never structure.

Three whole-system precedents are worth reading before building, because each has already solved a layer we would otherwise hand-roll. LiveStore is an event-sourced local-first framework that uses an event log as source of truth with materialized SQLite views, which is the Given-Log and Meant-Graph pattern shipping as a library, and it confirms the choice not to retrofit event sourcing onto a plain reactive store. Datasette publishes a data store as a fast explorable read-only site and API, aimed at data journalists and local governments, and runs entirely in the browser through WebAssembly in its Lite form, which is the CQRS projection of Layer 4 as a working tool for the exact audience. Decap CMS drives a React admin UI entirely from a `config.yml` that describes collections and fields and commits each save to a Git repository, which is the AppSpec to surfaces to append to static site shape, coarser than ours because Git is whole-file with no per-claim provenance, which is the gap Matrix closes. TiddlyWiki is the standing precedent for the single-file export, Baserow and NocoDB are the precedent for many surfaces over one store, and ToolJet is the precedent for natural-language generation, though it emits code to refine while our talker emits a construal the grounder validates.

---

# Part 9: What is established and what is a projection sketch

Established. Matrix rooms are append-only signed event DAGs with sender provenance, power-level access, and protocol-level moderation, and matrix-js-sdk plus an appservice expose all of it. The CQRS projection is the correct read path, and public reads must not touch the DAG. Cerulean proves the social feed pattern. The kernel's address algebra and the desert prohibition follow from the pinned wiki canon. The Tier 1 surfaces are well-worn components with defined fallbacks.

Projection sketch. That a Matrix room is the right container for a Given-Log in the full EO sense. That the projection behaves as EO version control expects. That every concrete surface maps cleanly to a single home Site terrain, which is clean for chart to Kind and map to Field and a reasonable reading for the rest. And that the AppSpec is expressively complete enough to address any app a person describes, which is the Ptolemaic claim wearing the substrate's hat. The residue test is the falsifier for the last two: run an AppSpec against apps the substrate was not designed for, and a surface against a request with no clean home terrain, before making either completeness claim. Both tests are cheap once the first vertical slice is live.

## Open items carried from the wiki

The 27-cell count has no first-principles derivation and is the framework's stated greatest vulnerability. The stance-face names are unsettled because the Resolution-face article currently holds Site-face content. SIG's exemplars are single-corpus German and may be an artifact. The null-carving permutation test, the adjusted Rand index against surrogate partitions, remains the single most decisive unrun check on the cross-linguistic validity claim. None of these blocks the substrate, because the kernel keys on coordinates and treats the corpus findings as stamped metadata rather than silent truth.
