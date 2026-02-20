# Khora Data Table Logic: Notes, Allocations, Provisioning

## EO Operator Reference

The nine universal operators, organized in triads:

| Triad | Op | Symbol | Meaning | Khora Usage |
|-------|----|--------|---------|-------------|
| Identity | **NUL** | ∅ | Absence, void, destruction | Revocation, access removed, capacity destroyed, expiration |
| Identity | **DES** | ≝ | Designate, name, identify | Naming an individual, labeling a resource type |
| Identity | **INS** | △ | Instantiate, create | Recording a new observation, creating an allocation, restocking capacity |
| Structure | **SEG** | ⊢ | Segment, bound, classify | Assessment scores, eligibility checks, schema field classification |
| Structure | **CON** | ⋈ | Connect, relate, link | Allocating a resource to an individual, referrals, bridge creation |
| Structure | **SYN** | ∨ | Synthesize, merge, fuse | Dedup resolution, merging duplicate resource reports |
| Interpretation | **ALT** | ∿ | Alternate, transition states | Status changes (active→consumed), field value updates, capacity changes |
| Interpretation | **SUP** | ⧦ | Superpose, hold competing views | Multiple frameworks interpreting same observation, unresolved dedup |
| Interpretation | **REC** | ↻ | Recurse, reconfigure, learn | Schema evolution, governance rule adaptation, self-referential updates |

Every event in Khora carries: `op` (which operator), `frame` (GIVEN or MEANT), `room` (which Matrix room), `author` (who).

---

## How the Table Even Exists

The first thing to understand is that the "Individuals" table isn't a database table. It's a **projection assembled from many Matrix rooms at read time**. Every row is a bridge room (or a vault shadow if the bridge was severed). When a team member opens the Individuals view, Khora's client is:

1. Enumerating all bridge rooms in the Provider Roster for this org
2. For each bridge, reading the latest state events to get field values
3. Assembling those values into a row
4. Merging in any roster-only metadata (internal notes, assigned team member, priority)

Two team members with different power levels might see different columns populated, because the individual may have disclosed field X to one provider but not another. The table honestly represents this — locked cells aren't missing data, they're sovereignty boundaries.

---

## Notes: Three Rooms, Three Audiences

Notes are observations, and like all observations in Khora, they have a GIVEN and a MEANT. But critically, notes also have a **placement** that determines who can see them. This maps directly to the Matrix room topology:

### 1. Shared Notes → Bridge Room

**Matrix event type:** `io.khora.observation.note`
**Room:** The bridge room between the individual and the provider
**Who sees it:** The individual (if they've joined their room) AND the org's staff
**EO operation:** INS (observation recorded)

When a case manager writes "Marcus came in today, mentioned he's been sleeping in his car for two weeks. Expressed interest in safe parking program" — that's a shared observation. It goes into the bridge room. If Marcus has claimed his room and has power level 100, he can read every shared note. He can also write his own notes into the bridge.

The vault shadow copies all shared notes denormalized (author name as plain text, not a Matrix user ID) so Marcus retains them even if the bridge is severed.

**This is the default for transparency.** Shared notes are the system saying: "everything we record about you, you can see."

### 2. Internal Notes → Provider Roster Room

**Matrix event type:** `io.khora.roster.note`
**Room:** The Provider Roster (org-internal, the individual is NOT a member)
**Who sees it:** Only staff within the org
**EO operation:** INS (but in MEANT frame, provider's interpretation)

When a case manager writes "I have concerns about Marcus's self-reported sobriety timeline — inconsistent with what the shelter intake coordinator observed. Will follow up with motivational interviewing approach next session" — that's a clinical observation that would be counterproductive for the client to read in real time. It goes into the roster.

Internal notes are **never** copied to the vault. The individual cannot see them. This is the org's own analytical space.

**The ethical tension is real.** Khora's sovereignty model says the individual controls their data. But clinical case management requires a space for professional judgment that the client doesn't have veto power over. The roster room is that space. The resolution: internal notes can *reference* bridge observations (by event ID) but cannot *modify* them. The client's record in the bridge is the authoritative shared truth; the roster is the org's private interpretation layer.

### 3. Personal Notes → Client Vault

**Matrix event type:** `io.khora.vault.note`
**Room:** The Client Vault (client-only room)
**Who sees it:** Only the individual
**EO operation:** INS (GIVEN frame — client's own record)

When Marcus writes "I told Sarah about sleeping in the car but I didn't mention that I lost the car last week. I'm sleeping under the bridge now but I don't want them to know yet" — that's his private record. No provider ever sees it.

The vault is the individual's sovereign space. Khora's UI should make it trivially easy to write personal notes and absolutely clear that they're private.

### Note Tagging

Notes can be tagged to multiple contexts:

- **Individual** (implicit — the note is in their bridge or roster)
- **Case** — references a case ID. Case notes show up in the case timeline.
- **Resource allocation** — references an allocation ID. "Marcus picked up his bus voucher today."
- **Category** — structured tag from the schema: `case_note`, `progress_note`, `incident`, `referral`, `assessment`, `follow_up`, `coordination`
- **Other individuals** — a note in Marcus's bridge can reference Tamika's case if they're connected (e.g., same household). But the reference is one-directional — Tamika's bridge doesn't automatically get a copy.

### What the Table Shows

In the Individuals table, the "Notes" column (or the notes section of the record panel) shows:

- **Count of shared notes + internal notes** for the current org
- **Most recent note** preview (truncated)
- Color-coding: shared notes in the standard palette, internal notes with a subtle visual distinction (e.g., a side stripe)

The individual's personal vault notes **never appear** in the org's table view. They don't exist from the org's perspective.

---

## Allocations: Individuals Receiving Resources

When a provider allocates a resource to an individual, four things happen simultaneously:

### The Write Pattern

```
1. BRIDGE ROOM → io.khora.resource.allocation (state event)
   - allocation_id, resource_type_id, resource_name (denormalized)
   - quantity, unit, status: 'active'
   - allocated_by (provider Matrix user ID)
   - notes (optional, encrypted per-field)

2. BRIDGE ROOM → io.khora.resource.event (timeline event)
   - allocation_id, event: 'allocated'
   - recorded_by, recorded_at

3. CLIENT VAULT → io.khora.resource.vault_record (state event)
   - Same data as #1, but FULLY DENORMALIZED
   - resource_name, provider_display_name, org_display_name as plain strings
   - Survives bridge severance

4. ORG ROOM → io.khora.resource.inventory (state event update)
   - available -= quantity
   - allocated += quantity
   - last_updated = now
```

### Why the Dual Write Matters

If Marcus receives a housing voucher and later revokes access to the org, his vault shadow still says "On Feb 20, 2026, Nashville Rescue Mission allocated 1 Rapid Rehousing Voucher, administered by Metro Homelessness Planning Council." The org name, the resource name, the date — all denormalized strings. His record doesn't break when the bridge breaks.

This is the sovereignty guarantee: your history of receiving services is *yours*, not the system's.

### What the Table Shows — Individual Side

In the Individual record panel, an "Allocations" tab shows:

- All resources this individual has received (from bridges the viewer has access to)
- Each allocation shows: resource name, quantity, status (active/consumed/expired/revoked), who allocated it, when, and any notes
- Status lifecycle: active → consumed (used up), expired (time ran out), revoked (provider took it back), returned (individual returned it)
- If the individual has multiple org relationships, they see ALL allocations across all bridges in their vault. The org only sees allocations from their own bridge.

### Constraint Checking

Before an allocation can be written, the client validates it against the resource's constraint policy:

- **Eligibility:** Does the individual meet the criteria? (e.g., "Veterans only" checked against the veteran field)
- **Capacity:** Is there available inventory?
- **Per-client caps:** Has this individual already received the maximum? (e.g., "Max 3 bus vouchers per month")
- **Approval requirements:** Does this allocation need supervisor sign-off?

If a constraint blocks the allocation, the error message includes governance provenance: "Blocked by constraint 'Veterans only (DD-214 verified)', adopted by CoC TN-504 Board on 2025-09-14." The constraint is contestable, not opaque.

---

## Resource Provisioning: The Supply Side

Resources have their own lifecycle independent of any individual. The Resources table tracks this.

### Inventory as Computed State

The inventory numbers (total capacity, available, allocated, reserved) aren't stored as a single source of truth. They're **computed from the event log**:

```
available = total_capacity - allocated - reserved
allocated = SUM(active allocations drawing from this relation)
reserved = SUM(pending-approval allocations)
```

But for performance, the computed state is cached as a Matrix state event (`io.khora.resource.inventory`) and updated whenever an allocation event changes it.

### Provisioning Events

The resource's event timeline (in the org room) shows:

- **Restocked:** "Capacity increased from 40 to 45 vouchers (new HUD grant TN0043 allocation)"
- **Allocated:** "1 voucher allocated to [bridge reference]" — note: the individual's identity is NOT in the org room event. The org room just sees a bridge room ID. The actual name is only in the bridge room itself.
- **Returned:** "1 bed returned to available pool"
- **Expired:** "3 vouchers expired (past 24-month maximum)"
- **Capacity reduced:** "Funding cut: capacity reduced from 45 to 30 vouchers"

Each event includes who recorded it and when, creating a complete audit trail.

### What the Table Shows — Resource Side

In the Resources record panel, a "Provisioning" tab shows:

- **Capacity timeline:** A visual history of how capacity has changed over time
- **Allocation log:** Every allocation event (anonymized in the resource view — shows bridge room reference, not individual names, unless the viewer also has access to that bridge)
- **Current state:** available / allocated / reserved / total
- **Utilization trend:** Is this resource getting more or less used over time?

### The Privacy Boundary

This is subtle but critical: **the resource's provisioning history in the org room does NOT contain individual names.** It contains bridge room IDs. If you're a staff member who has access to a bridge, Khora can resolve the bridge ID to a name for you. If you don't have access to that bridge (maybe it's another provider's client), you just see "Bridge #abc123 — 1 voucher allocated."

This means a network-level resource view can show aggregate utilization (14 of 120 beds available) without revealing which individuals occupy those beds to anyone who doesn't have direct bridge access to them.

---

## The Opacity Stack

Everything above operates within Khora's four-level opacity model:

| Level | Name | What it means |
|-------|------|---------------|
| 0 | Sovereign | Only the holder sees it. Default for everything. |
| 1 | Attested | The holder has verified it exists, but details aren't shared. Other orgs see "✓ verified, details withheld." |
| 2 | Contributed | Shared within the network, but not publicly. Cross-org coordination data. |
| 3 | Published | Visible to anyone in the network (or publicly, depending on network rules). |

Resources default to sovereign (0). An org explicitly discloses to higher levels. Notes inherit the opacity of their room — bridge notes are visible to both parties, roster notes are sovereign to the org.

Disclosure is always an explicit act, never a default. This is the Ostrom principle: boundary rules are clear, and crossing a boundary requires consent.

---

## Summary: What Happens When You Click a Row

### Individual Row Click:
1. **Fields tab:** All schema fields with inline editing and provenance
2. **Notes tab:** Shared notes (from bridge) + internal notes (from roster), clearly distinguished. Personal vault notes are invisible.
3. **Allocations tab:** All resources allocated to this individual through your org's bridge. Each with status, lifecycle events, and provenance.
4. **Activity stream:** Chronological feed of all events — field changes, notes, allocations, status transitions — assembled from both bridge and roster.

### Resource Row Click:
1. **Details tab:** All resource fields with inline editing
2. **Provisioning tab:** Capacity timeline, allocation log (anonymized by default, resolved to names for bridges you can access), restock/reduction events
3. **Constraints tab:** Active constraints with governance provenance (who adopted each rule, when, through what process)
4. **Relations tab:** Which orgs relate to this resource and how (operates, funds, refers_to). This is what makes dedup tractable — two orgs reporting on the same beds show up as two relations, not two resources.
