const ROOM_COLORS = {
  vault: 'teal',
  bridge: 'blue',
  roster: 'gold',
  org: 'blue',
  schema: 'purple',
  metrics: 'orange',
  network: 'green',
  client_record: 'teal',
  team: 'purple',
  unknown: 'orange'
};

// Classify a room from pre-scanned state (no HTTP calls) or fallback to getState
const classifyRoom = async (roomId, scannedState) => {
  const state = scannedState || {};
  const id = state[EVT.IDENTITY] || (await svc.getState(roomId, EVT.IDENTITY));
  if (id) {
    if (id.account_type === 'client') return {
      type: 'vault',
      label: 'Personal Vault',
      color: 'teal'
    };
    if (id.account_type === 'client_record') return {
      type: 'client_record',
      label: 'Personal Record',
      color: 'teal'
    };
    if (id.account_type === 'provider') return {
      type: 'roster',
      label: 'Team Member Roster',
      color: 'gold'
    };
    if (id.account_type === 'organization') return {
      type: 'org',
      label: 'Organization',
      color: 'blue'
    };
    if (id.account_type === 'schema') return {
      type: 'schema',
      label: 'Schema Room',
      color: 'purple'
    };
    if (id.account_type === 'metrics') return {
      type: 'metrics',
      label: 'Metrics Room',
      color: 'orange'
    };
    if (id.account_type === 'network') return {
      type: 'network',
      label: 'Network Room',
      color: 'green'
    };
    if (id.account_type === 'team') return {
      type: 'team',
      label: 'Team Room',
      color: 'purple'
    };
  }
  const meta = state[EVT.BRIDGE_META] || (await svc.getState(roomId, EVT.BRIDGE_META));
  if (meta) return {
    type: 'bridge',
    label: 'Bridge Room',
    color: 'blue'
  };
  return {
    type: 'unknown',
    label: 'Unknown',
    color: 'orange'
  };
};

// Meta-DES: the EO decoder ring — maps every domain event type to its canonical operator.
// This function is the Rosetta Stone between Matrix events and the nine-operator vocabulary.
// Each case below designates which EO operator a given event type represents.
//
// ⚠️ REC mappings: SCHEMA_PROP, SCHEMA_TRANSFORM, GOV_RHYTHM, MATCH_RESOLVE, m.room.encryption
//    — these are frame-changing operations. Presence of REC = elevated review attention.
// SUP mapping: MATCH_HIT — multiple identities may refer to same person (superposition).
const classifyEvent = (ev, roomInfo) => {
  const type = ev.getType();
  const content = ev.getContent();
  // Native EO operations
  if (type === EVT.OP) return {
    op: content.op || 'INS',
    epistemic: content.frame?.epistemic || 'GIVEN',
    label: `${content.op} Operation`,
    desc: typeof content.target === 'string' ? content.target : ''
  };
  if (ev.isState && ev.isState()) {
    switch (type) {
      case EVT.IDENTITY:
        return {
          op: 'INS',
          epistemic: 'GIVEN',
          label: 'Identity Declaration',
          desc: `Type: ${content.account_type}`
        };
      case EVT.VAULT_SNAPSHOT:
        return {
          op: 'ALT',
          epistemic: 'GIVEN',
          label: 'Vault Snapshot',
          desc: `${Object.keys(content.fields || {}).length} fields`
        };
      case EVT.VAULT_PROVIDERS:
        return {
          op: 'SEG',
          epistemic: 'GIVEN',
          label: 'Provider Index',
          desc: `${(content.providers || []).length} providers`
        };
      case EVT.BRIDGE_META:
        {
          const rel = RELATIONSHIP_TYPES[content.relationship_type] || RELATIONSHIP_TYPES.client_provider;
          return {
            op: 'CON',
            epistemic: 'MEANT',
            label: 'Bridge Connection',
            desc: `${content.status} — ${rel.label} — ${content.client?.slice(0, 16)} ↔ ${content.provider?.slice(0, 16)}`
          };
        }
      case EVT.BRIDGE_REFS:
        return {
          op: 'SEG',
          epistemic: 'MEANT',
          label: 'Field Refs Update',
          desc: `${Object.keys(content.fields || {}).length} encrypted refs${content.revoked ? ' (REVOKED)' : ''}`
        };
      case EVT.ROSTER_INDEX:
        return {
          op: 'ALT',
          epistemic: 'MEANT',
          label: 'Roster Update',
          desc: `${(content.cases || []).length} cases`
        };
      case EVT.ROSTER_ASSIGN:
        return {
          op: 'SEG',
          epistemic: 'MEANT',
          label: 'Case Assignment',
          desc: `${Object.keys(content.assignments || content).length} case${Object.keys(content.assignments || content).length !== 1 ? 's' : ''} assigned`
        };
      case EVT.ORG_ROSTER:
        return {
          op: 'ALT',
          epistemic: 'MEANT',
          label: 'Org Roster',
          desc: `${(content.staff || []).length} staff`
        };
      case EVT.ORG_METADATA:
        return {
          op: 'DES',
          epistemic: 'MEANT',
          label: 'Org Metadata',
          desc: content.name || 'org'
        };
      case EVT.ORG_INVITE:
        return {
          op: 'CON',
          epistemic: 'MEANT',
          label: 'Org Invite',
          desc: content.userId
        };
      case EVT.SCHEMA_AUTHORITY:
        return {
          op: 'CON',
          epistemic: 'MEANT',
          label: 'Authority Binding',
          desc: content.name?.slice(0, 40)
        };
      case EVT.SCHEMA_PROP:
        return {
          op: 'REC',
          epistemic: 'MEANT',
          label: 'Schema Propagation',
          desc: `${content.level}: ${content.prompt_key}`
        };
      case EVT.SCHEMA_FORM:
        return {
          op: 'DES',
          epistemic: 'GIVEN',
          label: 'Form Definition',
          desc: content.name?.slice(0, 40)
        };
      case EVT.SCHEMA_ASSESSMENT:
        return {
          op: 'DES',
          epistemic: 'MEANT',
          label: 'Assessment Instrument',
          desc: content.question?.slice(0, 40)
        };
      case EVT.OBSERVATION:
        return {
          op: 'INS',
          epistemic: 'MEANT',
          label: 'Provider Observation',
          desc: `${content.prompt_id}: ${content.value}`
        };
      case EVT.INVITE_TOKEN:
        return {
          op: 'CON',
          epistemic: 'MEANT',
          label: 'Invite Token',
          desc: 'QR/link token'
        };
      case EVT.ENCOUNTER_PROV:
        return {
          op: 'INS',
          epistemic: 'MEANT',
          label: 'Provisional Encounter',
          desc: content.description?.slice(0, 40)
        };
      case EVT.MATCH_TOKEN:
        return {
          op: 'CON',
          epistemic: 'MEANT',
          label: 'Match Token',
          desc: 'Blind matching token'
        };
      case EVT.MATCH_HIT:
        return {
          op: 'SUP',
          epistemic: 'MEANT',
          label: 'Match Hit',
          desc: 'Potential duplicate'
        };
      case EVT.MATCH_RESOLVE:
        return {
          op: 'REC',
          epistemic: 'MEANT',
          label: 'Match Resolved',
          desc: content.resolution
        };
      case EVT.SCHEMA_PROMPT:
        return {
          op: 'DES',
          epistemic: 'GIVEN',
          label: 'Form Field',
          desc: content.question?.slice(0, 40)
        };
      case EVT.SCHEMA_DEF:
        return {
          op: 'DES',
          epistemic: 'MEANT',
          label: 'Classification Rule',
          desc: content.name?.slice(0, 40)
        };
      case EVT.SCHEMA_TRANSFORM:
        return {
          op: 'REC',
          epistemic: 'MEANT',
          label: 'Transform Rule',
          desc: `${Object.keys(content.transforms || {}).length} transforms`
        };
      case EVT.TEAM_META:
        return {
          op: 'DES',
          epistemic: 'MEANT',
          label: 'Team Metadata',
          desc: content.name || 'team'
        };
      case EVT.TEAM_MEMBERS:
        return {
          op: 'CON',
          epistemic: 'MEANT',
          label: 'Team Members',
          desc: `${(content.members || []).length} member${(content.members || []).length !== 1 ? 's' : ''}`
        };
      case EVT.TEAM_SCHEMA:
        return {
          op: 'DES',
          epistemic: 'MEANT',
          label: 'Team Schema',
          desc: `v${content.version || 1} — ${(content.fields || []).length} fields`
        };
      case EVT.TEAM_SCHEMA_RULE:
        return {
          op: 'REC',
          epistemic: 'MEANT',
          label: 'Consent Rule',
          desc: TEAM_CONSENT_MODES[content.mode]?.label || content.mode
        };
      case EVT.FIELD_DEF:
        return {
          op: 'DES',
          epistemic: 'MEANT',
          label: 'Field Definitions',
          desc: `${Object.keys(content.definitions || {}).length} definitions`
        };
      case EVT.FIELD_CROSSWALK:
        return {
          op: 'SYN',
          epistemic: 'MEANT',
          label: 'Field Crosswalks',
          desc: `${(content.crosswalks || []).length} crosswalks`
        };
      case EVT.NET_MEMBERS:
        return {
          op: 'CON',
          epistemic: 'MEANT',
          label: 'Network Members',
          desc: `${(content.organizations || []).length} orgs`
        };
      case EVT.GOV_PROPOSAL:
        return {
          op: 'INS',
          epistemic: 'MEANT',
          label: 'Governance Proposal',
          desc: content.summary?.slice(0, 50)
        };
      case EVT.GOV_RHYTHM:
        return {
          op: 'REC',
          epistemic: 'MEANT',
          label: 'Governance Rhythm',
          desc: content.name
        };
      case EVT.SCHEMA_FIELD:
        return {
          op: 'DES',
          epistemic: 'GIVEN',
          label: 'Form Field',
          desc: content.question_text?.slice(0, 40)
        };
      case EVT.SCHEMA_BINDING:
        return {
          op: 'DES',
          epistemic: 'MEANT',
          label: 'Framework Binding',
          desc: `${content.field_id} → ${content.framework?.name?.slice(0, 25)}`
        };
      // Resource tracking events
      case EVT.RESOURCE_TYPE:
        return {
          op: 'DES',
          epistemic: 'GIVEN',
          label: 'Resource Type',
          desc: `${content.name || content.id} (${content.category})`
        };
      case EVT.RESOURCE_RELATION:
        return {
          op: 'CON',
          epistemic: 'GIVEN',
          label: 'Resource Relation',
          desc: `${content.relation_type}: ${content.resource_type_id}`
        };
      case EVT.RESOURCE_INVENTORY:
        return {
          op: 'ALT',
          epistemic: 'GIVEN',
          label: 'Resource Inventory',
          desc: `${content.available}/${content.total_capacity} available`
        };
      case EVT.RESOURCE_ALLOC:
        return {
          op: 'INS',
          epistemic: 'GIVEN',
          label: 'Resource Allocation',
          desc: `${content.quantity} ${content.unit} → ${content.allocated_to?.slice(0, 16)}`
        };
      case EVT.RESOURCE_POLICY:
        return {
          op: 'SEG',
          epistemic: 'MEANT',
          label: 'Resource Policy',
          desc: ev.getStateKey()
        };
      case EVT.RESOURCE_OPACITY:
        return {
          op: 'SEG',
          epistemic: 'MEANT',
          label: 'Resource Opacity',
          desc: `${RESOURCE_OPACITY_LABELS[content.opacity] || content.opacity}`
        };
      case EVT.RESOURCE_VAULT:
        return {
          op: 'INS',
          epistemic: 'GIVEN',
          label: 'Vault Resource Record',
          desc: `${content.resource_name}: ${content.quantity} ${content.unit}`
        };
      case EVT.RESOURCE_PERM:
        return {
          op: 'ALT',
          epistemic: 'MEANT',
          label: 'Resource Permission',
          desc: `${content.resource_type_id}: updated by ${content.updated_by?.slice(0, 16)}`
        };
      case 'm.room.encryption':
        return {
          op: 'REC',
          epistemic: 'GIVEN',
          label: 'Encryption Policy',
          desc: content.algorithm
        };
      case 'm.room.tombstone':
        return {
          op: 'NUL',
          epistemic: 'MEANT',
          label: 'Room Tombstoned',
          desc: `→ ${content.replacement_room?.slice(0, 24)}…`
        };
      case 'm.room.create':
        return {
          op: 'INS',
          epistemic: 'GIVEN',
          label: 'Room Created',
          desc: 'New room initialized'
        };
      case 'm.room.member':
        {
          const ms = content.membership;
          if (ms === 'join') return {
            op: 'CON',
            epistemic: 'MEANT',
            label: 'Member Joined',
            desc: ev.getStateKey()
          };
          if (ms === 'invite') return {
            op: 'CON',
            epistemic: 'MEANT',
            label: 'Member Invited',
            desc: ev.getStateKey()
          };
          if (ms === 'leave') return {
            op: 'NUL',
            epistemic: 'MEANT',
            label: 'Member Left/Kicked',
            desc: ev.getStateKey()
          };
          return {
            op: 'ALT',
            epistemic: 'MEANT',
            label: `Membership: ${ms}`,
            desc: ev.getStateKey()
          };
        }
      default:
        return {
          op: 'INS',
          epistemic: 'GIVEN',
          label: type,
          desc: 'State event'
        };
    }
  }
  if (type === EVT.RESOURCE_EVENT) return {
    op: content.event === 'revoked' ? 'NUL' : 'ALT',
    epistemic: 'GIVEN',
    label: 'Resource Lifecycle',
    desc: `${content.event}: ${content.quantity} (${content.allocation_id?.slice(0, 12)})`
  };
  if (type === EVT.METRIC) return {
    op: 'INS',
    epistemic: 'MEANT',
    label: 'Metric Event',
    desc: `${content.observation?.category}: ${content.observation?.value}`
  };
  if (type === EVT.NOTE) return {
    op: 'INS',
    epistemic: 'MEANT',
    label: 'Note Created',
    desc: content.title?.slice(0, 50) || 'Untitled'
  };
  if (type === EVT.NOTE_EDIT) return {
    op: 'ALT',
    epistemic: 'MEANT',
    label: 'Note Edited',
    desc: (content.title?.slice(0, 50) || 'Untitled') + ' (edited by ' + ((content.edited_by || '').split(':')[0]?.replace('@', '') || 'unknown') + ')'
  };
  if (type === EVT.NOTE_REF) return {
    op: 'SEG',
    epistemic: 'MEANT',
    label: 'Note Reference',
    desc: content.title?.slice(0, 50) || content.note_id
  };
  if (type === 'm.room.message') {
    const cvType = content[`${NS}.type`];
    if (cvType === 'request') return {
      op: 'DES',
      epistemic: 'MEANT',
      label: 'Info Request',
      desc: content.body?.slice(0, 60)
    };
    if (cvType === 'note') return {
      op: 'INS',
      epistemic: roomInfo.type === 'vault' ? 'GIVEN' : 'MEANT',
      label: 'Bridge Note',
      desc: content.body?.slice(0, 60)
    };
    return {
      op: 'INS',
      epistemic: 'GIVEN',
      label: 'Message',
      desc: content.body?.slice(0, 60)
    };
  }
  // Encrypted events that haven't been decrypted yet — show as pending
  if (type === 'm.room.encrypted') return {
    op: 'INS',
    epistemic: 'GIVEN',
    label: 'Encrypted Event',
    desc: 'Awaiting decryption...'
  };
  return {
    op: 'INS',
    epistemic: 'GIVEN',
    label: type,
    desc: 'Timeline event'
  };
};

/* ─── EO constants (used by RecordProvenance and ActionLog) ─── */

const OPERATOR_TRIADS = {
  identity: {
    label: 'Identity',
    desc: 'What exists?',
    ops: ['NUL', 'DES', 'INS'],
    color: 'teal'
  },
  structure: {
    label: 'Structure',
    desc: 'How do things relate?',
    ops: ['SEG', 'CON', 'SYN'],
    color: 'blue'
  },
  time: {
    label: 'Time',
    desc: 'How do things change?',
    ops: ['ALT', 'SUP', 'REC'],
    color: 'purple'
  }
};
const OP_DESCRIPTIONS = {
  NUL: {
    verb: 'Destroy',
    desc: 'Destruction / Absence'
  },
  DES: {
    verb: 'Designate',
    desc: 'Designation / Naming'
  },
  INS: {
    verb: 'Instantiate',
    desc: 'Instantiation / First observation'
  },
  SEG: {
    verb: 'Segment',
    desc: 'Segmentation / Boundary'
  },
  CON: {
    verb: 'Connect',
    desc: 'Connection / Joining'
  },
  SYN: {
    verb: 'Synthesize',
    desc: 'Synthesis / Merging'
  },
  ALT: {
    verb: 'Alternate',
    desc: 'Alternation / Transition'
  },
  SUP: {
    verb: 'Superpose',
    desc: 'Superposition / Layering'
  },
  REC: {
    verb: 'Reconfigure',
    desc: 'Reconfiguration / Recursion'
  }
};

/* ═══════════════════ RECORD PROVENANCE PANEL ═══════════════════
 * Inline expandable panel showing provenance for any record/entity:
 * - Origin server (extracted from Matrix IDs)
 * - Who created / last modified the record
 * - When created
 * - Full EO operation history filtered to that specific entity
 * ═══════════════════════════════════════════════════════════════ */

const PROV_OP_COLORS = {
  NUL: 'red',
  DES: 'teal',
  INS: 'green',
  SEG: 'orange',
  CON: 'blue',
  SYN: 'purple',
  ALT: 'gold',
  SUP: 'pink',
  REC: 'teal'
};
const RecordProvenance = ({
  roomId,
  entityKey,
  label,
  session,
  onRestore
}) => {
  const [ops, setOps] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const loadProvenance = useCallback(async () => {
    if (ops !== null) return; // already loaded
    setLoading(true);
    setError(null);
    try {
      const allOps = [];
      if (svc.client) {
        const room = svc.client.getRoom(roomId);
        if (room) {
          // Paginate backwards to capture historical EO operations
          try {
            for (let i = 0; i < 5; i++) {
              const canPaginate = room.getLiveTimeline().getPaginationToken('b');
              if (!canPaginate) break;
              await svc.client.scrollback(room, 100);
            }
          } catch (e) {/* pagination may fail — continue with available events */}
          // Collect from all timelines (not just live)
          const seenIds = new Set();
          const timelineSets = room.getTimelineSets ? room.getTimelineSets() : [];
          const collectFromEvent = ev => {
            if (seenIds.has(ev.getId()) || ev.getType() !== EVT.OP) return;
            seenIds.add(ev.getId());
            const c = ev.getContent();
            if (c.target === entityKey || typeof c.target === 'string' && c.target.includes(entityKey)) {
              allOps.push({
                ...c,
                _sender: ev.getSender(),
                _eventTs: ev.getTs()
              });
            }
          };
          if (timelineSets.length > 0) {
            for (const ts of timelineSets) {
              for (const tl of ts.getTimelines()) {
                for (const ev of tl.getEvents()) collectFromEvent(ev);
              }
            }
          } else {
            for (const ev of room.getLiveTimeline().getEvents()) collectFromEvent(ev);
          }
          // Also collect from state events
          for (const ev of room.currentState.getStateEvents()) {
            if (ev.getType() === EVT.OP) {
              const c = ev.getContent();
              if (c.target === entityKey || typeof c.target === 'string' && c.target.includes(entityKey)) {
                if (!allOps.find(o => o.id === c.id)) {
                  allOps.push({
                    ...c,
                    _sender: ev.getSender(),
                    _eventTs: ev.getTs()
                  });
                }
              }
            }
          }
        }
      }
      allOps.sort((a, b) => (a.ts || a._eventTs || 0) - (b.ts || b._eventTs || 0));
      setOps(allOps);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }, [roomId, entityKey, ops]);
  useEffect(() => {
    loadProvenance();
  }, [loadProvenance]);

  // React to new EO events that affect this entity
  useEffect(() => {
    const handleEo = e => {
      const d = e.detail;
      if (d && d.roomId === roomId) {
        const t = d.event?.target;
        if (t && (t === entityKey || typeof t === 'string' && t.includes(entityKey))) {
          setOps(null); // force reload
        }
      }
    };
    window.addEventListener('khora:eo', handleEo);
    return () => window.removeEventListener('khora:eo', handleEo);
  }, [roomId, entityKey]);
  if (loading) return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '12px 16px',
      background: 'var(--bg-3)',
      borderRadius: 'var(--r)',
      marginTop: 4
    }
  }, /*#__PURE__*/React.createElement(Spin, {
    s: 14
  }), " ", /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: 'var(--tx-2)',
      marginLeft: 6
    }
  }, "Loading provenance..."));
  if (error) return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '12px 16px',
      background: 'var(--bg-3)',
      borderRadius: 'var(--r)',
      marginTop: 4,
      fontSize: 11,
      color: 'var(--red)'
    }
  }, "Error loading provenance: ", error);
  if (!ops || ops.length === 0) return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '12px 16px',
      background: 'var(--bg-3)',
      borderRadius: 'var(--r)',
      marginTop: 4
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "git-commit",
    s: 12,
    c: "var(--tx-2)"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      fontWeight: 600,
      color: 'var(--tx-1)'
    }
  }, "Provenance: ", label || entityKey)), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10.5,
      color: 'var(--tx-3)'
    }
  }, "No EO operations recorded for this entity yet."));
  const firstOp = ops[0];
  const lastOp = ops[ops.length - 1];
  const creator = firstOp.created_by || firstOp._sender || 'Unknown';
  const creatorServer = firstOp.origin_server || extractHomeserver(creator);
  const createdAt = firstOp.ts || firstOp._eventTs;
  const roomServer = extractHomeserver(roomId);
  const modifierCount = new Set(ops.map(o => o.created_by || o._sender).filter(Boolean)).size;
  const fmtDate = ts => {
    if (!ts) return '—';
    const d = new Date(ts);
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }) + ' ' + d.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  const fmtUserId = uid => {
    if (!uid) return 'Unknown';
    return uid.startsWith('@') ? uid.split(':')[0].slice(1) : uid;
  };
  const getTriad = opName => {
    for (const [k, v] of Object.entries(OPERATOR_TRIADS)) {
      if (v.ops.includes(opName)) return v;
    }
    return {
      color: 'blue'
    };
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '14px 16px',
      background: 'var(--bg-3)',
      borderRadius: 'var(--r)',
      marginTop: 4,
      border: '1px solid var(--border-0)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "git-commit",
    s: 13,
    c: "var(--teal)"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      fontWeight: 700,
      color: 'var(--tx-0)'
    }
  }, "Provenance"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10.5,
      color: 'var(--tx-2)',
      fontFamily: 'var(--mono)'
    }
  }, label || entityKey), /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 'auto',
      fontSize: 9.5,
      color: 'var(--tx-3)'
    }
  }, ops.length, " operation", ops.length !== 1 ? 's' : '')), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 8,
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '8px 10px',
      background: 'var(--bg-2)',
      borderRadius: 6
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 9,
      textTransform: 'uppercase',
      color: 'var(--tx-3)',
      letterSpacing: '.04em',
      marginBottom: 2
    }
  }, "Server"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      fontFamily: 'var(--mono)',
      color: 'var(--tx-1)',
      wordBreak: 'break-all'
    }
  }, roomServer)), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '8px 10px',
      background: 'var(--bg-2)',
      borderRadius: 6
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 9,
      textTransform: 'uppercase',
      color: 'var(--tx-3)',
      letterSpacing: '.04em',
      marginBottom: 2
    }
  }, "Created by"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: 'var(--tx-1)'
    },
    title: creator
  }, fmtUserId(creator)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 9.5,
      color: 'var(--tx-3)',
      fontFamily: 'var(--mono)'
    }
  }, creatorServer)), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '8px 10px',
      background: 'var(--bg-2)',
      borderRadius: 6
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 9,
      textTransform: 'uppercase',
      color: 'var(--tx-3)',
      letterSpacing: '.04em',
      marginBottom: 2
    }
  }, "Created"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: 'var(--tx-1)'
    }
  }, fmtDate(createdAt))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '8px 10px',
      background: 'var(--bg-2)',
      borderRadius: 6
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 9,
      textTransform: 'uppercase',
      color: 'var(--tx-3)',
      letterSpacing: '.04em',
      marginBottom: 2
    }
  }, "Last modified"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: 'var(--tx-1)'
    }
  }, fmtDate(lastOp.ts || lastOp._eventTs)), modifierCount > 1 && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 9.5,
      color: 'var(--tx-3)'
    }
  }, modifierCount, " contributors"))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 9.5,
      textTransform: 'uppercase',
      color: 'var(--tx-3)',
      letterSpacing: '.04em',
      marginBottom: 6,
      fontWeight: 600
    }
  }, "EO Log History"), /*#__PURE__*/React.createElement("div", {
    style: {
      maxHeight: 200,
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
      gap: 3
    }
  }, ops.map((o, i) => {
    const triad = getTriad(o.op);
    const opDesc = OP_DESCRIPTIONS[o.op] || {
      verb: o.op,
      desc: ''
    };
    const opColor = PROV_OP_COLORS[o.op] || 'blue';
    const sender = o.created_by || o._sender;
    return /*#__PURE__*/React.createElement("div", {
      key: o.id || i,
      style: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        padding: '6px 8px',
        background: 'var(--bg-2)',
        borderRadius: 5,
        fontSize: 11
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        minWidth: 16,
        paddingTop: 2
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: `var(--${opColor})`,
        flexShrink: 0
      }
    }), i < ops.length - 1 && /*#__PURE__*/React.createElement("div", {
      style: {
        width: 1,
        height: 16,
        background: 'var(--border-0)',
        marginTop: 2
      }
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        flexWrap: 'wrap'
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: `tag tag-${opColor}`,
      style: {
        fontSize: 8.5,
        fontFamily: 'var(--mono)',
        fontWeight: 700
      }
    }, o.op), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 10.5,
        fontWeight: 600,
        color: 'var(--tx-1)'
      }
    }, opDesc.verb), o.frame?.epistemic && /*#__PURE__*/React.createElement("span", {
      className: `tag tag-${o.frame.epistemic === 'GIVEN' ? 'teal' : 'gold'}`,
      style: {
        fontSize: 7.5
      }
    }, o.frame.epistemic)), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginTop: 2,
        fontSize: 10,
        color: 'var(--tx-3)'
      }
    }, /*#__PURE__*/React.createElement("span", null, fmtDate(o.ts || o._eventTs)), sender && /*#__PURE__*/React.createElement("span", {
      title: sender,
      style: {
        fontFamily: 'var(--mono)'
      }
    }, fmtUserId(sender)), o.origin_server && /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--mono)',
        color: 'var(--tx-3)'
      }
    }, o.origin_server)), o.operand && /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 4,
        fontSize: 10.5,
        color: 'var(--tx-1)',
        display: 'flex',
        flexDirection: 'column',
        gap: 2
      }
    }, o.op === 'INS' && o.operand.value != null && /*#__PURE__*/React.createElement("div", {
      style: { display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }
    }, /*#__PURE__*/React.createElement("span", {
      style: { color: 'var(--green)', fontSize: 9, fontWeight: 600 }
    }, "SET"), /*#__PURE__*/React.createElement("span", {
      style: { fontFamily: 'var(--mono)', fontSize: 10, background: 'var(--green-dim)', padding: '1px 6px', borderRadius: 3 }
    }, String(o.operand.value).slice(0, 60)),
    onRestore && /*#__PURE__*/React.createElement("button", {
      className: 'b-gho',
      style: { fontSize: 9.5, padding: '1px 6px', display: 'flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap' },
      title: 'Restore to: ' + String(o.operand.value).slice(0, 50),
      onClick: () => onRestore(o.operand.value)
    }, /*#__PURE__*/React.createElement(I, { n: 'check', s: 9 }), 'Restore')),
    o.op === 'ALT' && o.operand.from != null && o.operand.to != null && /*#__PURE__*/React.createElement("div", {
      style: { display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }
    }, /*#__PURE__*/React.createElement("span", {
      style: { fontFamily: 'var(--mono)', fontSize: 10, background: 'var(--red-dim)', padding: '1px 6px', borderRadius: 3, textDecoration: 'line-through', color: 'var(--tx-2)' }
    }, String(o.operand.from).slice(0, 40)), /*#__PURE__*/React.createElement("span", {
      style: { color: 'var(--tx-3)', fontSize: 10 }
    }, "\u2192"), /*#__PURE__*/React.createElement("span", {
      style: { fontFamily: 'var(--mono)', fontSize: 10, background: 'var(--green-dim)', padding: '1px 6px', borderRadius: 3 }
    }, String(o.operand.to).slice(0, 40)),
    onRestore && /*#__PURE__*/React.createElement("button", {
      className: 'b-gho',
      style: { fontSize: 9.5, padding: '1px 6px', display: 'flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap' },
      title: 'Restore to: ' + String(o.operand.to).slice(0, 50),
      onClick: () => onRestore(o.operand.to)
    }, /*#__PURE__*/React.createElement(I, { n: 'check', s: 9 }), 'Restore')),
    o.op === 'NUL' && /*#__PURE__*/React.createElement("div", {
      style: { display: 'flex', alignItems: 'center', gap: 4 }
    }, /*#__PURE__*/React.createElement("span", {
      style: { color: 'var(--red)', fontSize: 9, fontWeight: 600 }
    }, "CLEARED"), o.operand.reason && /*#__PURE__*/React.createElement("span", {
      style: { fontSize: 9.5, color: 'var(--tx-3)', fontStyle: 'italic' }
    }, o.operand.reason), o.operand.previous_value && /*#__PURE__*/React.createElement("span", {
      style: { fontFamily: 'var(--mono)', fontSize: 10, background: 'var(--red-dim)', padding: '1px 6px', borderRadius: 3, textDecoration: 'line-through', color: 'var(--tx-3)' }
    }, String(o.operand.previous_value).slice(0, 40))),
    o.op !== 'INS' && o.op !== 'ALT' && o.op !== 'NUL' && o.operand.value != null && /*#__PURE__*/React.createElement("span", {
      style: { fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--tx-2)' }
    }, String(o.operand.value).slice(0, 60)),
    o.operand.source && /*#__PURE__*/React.createElement("span", {
      style: { fontSize: 9, fontStyle: 'italic', color: 'var(--tx-3)' }
    }, "via ", o.operand.source)), o.provenance && o.provenance.length > 0 && /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 2,
        fontSize: 9,
        color: 'var(--tx-3)',
        fontFamily: 'var(--mono)'
      }
    }, "chain: ", o.provenance.map(p => p.slice(0, 12)).join(' → '))));
  })));
};

/* ═══════════════════ EO CANVAS — GRAPH VISUALIZATION ═══════════════════
 * Canvas-based graph view of EO events.
 * Nodes = events grouped by (room, operator). Edges = sequence / helix / cross-room.
 * Adapts the standalone EO Canvas reference into a React component.
 * ═══════════════════════════════════════════════════════════════ */
const EO_CANVAS_OPS = {
  NUL: { symbol:'\u2205', color:'#e05050', desc:'absence / destruction' },
  DES: { symbol:'\u22A1', color:'#c0a030', desc:'designation / naming' },
  INS: { symbol:'\u25B3', color:'#40a860', desc:'instantiation / creation' },
  SEG: { symbol:'|',      color:'#40a0a0', desc:'segmentation / boundary' },
  CON: { symbol:'\u22C8', color:'#5080c0', desc:'connection / joining' },
  SYN: { symbol:'\u2228', color:'#9060c0', desc:'synthesis / merging' },
  ALT: { symbol:'\u223F', color:'#5090d0', desc:'alternation / mutation' },
  SUP: { symbol:'\u2225', color:'#c0a030', desc:'superposition / layering' },
  REC: { symbol:'\u27F3', color:'#d08030', desc:'reconfiguration' },
};
const HELIX_ORDER = ['NUL','DES','INS','SEG','CON','SYN','ALT','SUP','REC'];

function _buildEOGraph(events) {
  const NODE_W = 180, NODE_H = 48, COL_GAP = 280, ROW_GAP = 72;
  // Group events by (roomId, op)
  const groupMap = {};
  const roomSet = {};
  events.forEach(ev => {
    if (!ev.op || !HELIX_ORDER.includes(ev.op)) return;
    const rKey = ev.roomId || 'unknown';
    const gKey = rKey + '::' + ev.op;
    if (!groupMap[gKey]) {
      groupMap[gKey] = { key:gKey, roomId:rKey, op:ev.op, events:[], labels:[], senders:new Set(), latestTs:0, earliestTs:Infinity };
    }
    const g = groupMap[gKey];
    g.events.push(ev);
    if (ev.label) g.labels.push(ev.label);
    if (ev.sender) g.senders.add(ev.sender);
    if (ev.ts > g.latestTs) g.latestTs = ev.ts;
    if (ev.ts < g.earliestTs) g.earliestTs = ev.ts;
    if (!roomSet[rKey]) roomSet[rKey] = { id:rKey, type:ev.roomInfo?.type||'unknown', label:ev.roomInfo?.label||rKey, color:ev.roomInfo?.color||'blue' };
  });
  const rooms = Object.values(roomSet);
  const roomIdx = {};
  rooms.forEach((r,i) => roomIdx[r.id] = i);
  // Build nodes
  const nodes = [];
  const cellCount = {};
  Object.values(groupMap).forEach(g => {
    const ri = roomIdx[g.roomId] || 0;
    const hi = HELIX_ORDER.indexOf(g.op);
    const cellKey = ri + '_' + hi;
    if (!cellCount[cellKey]) cellCount[cellKey] = 0;
    const stack = cellCount[cellKey]++;
    nodes.push({
      id: g.key, op: g.op, roomId: g.roomId, room: roomSet[g.roomId],
      count: g.events.length, labels: g.labels.slice(0,5), senders: [...g.senders],
      latestTs: g.latestTs, earliestTs: g.earliestTs, events: g.events,
      x: 120 + ri * COL_GAP + stack * (NODE_W + 16),
      y: 60 + hi * ROW_GAP,
      w: NODE_W, h: NODE_H,
    });
  });
  // Build edges
  const edges = [];
  const edgeSet = new Set();
  const addEdge = (a, b, type, color) => {
    const k = [a,b,type].sort().join('|');
    if (edgeSet.has(k)) return;
    edgeSet.add(k);
    edges.push({ a, b, type, color });
  };
  // 1. Sequence: consecutive ops in same room (by time)
  rooms.forEach(r => {
    const rNodes = nodes.filter(n => n.roomId === r.id).sort((a,b) => a.earliestTs - b.earliestTs);
    for (let i = 0; i < rNodes.length - 1; i++) {
      addEdge(rNodes[i].id, rNodes[i+1].id, 'sequence', '#3a3a6a');
    }
  });
  // 2. Helix: adjacent operators in same room
  rooms.forEach(r => {
    const rNodes = nodes.filter(n => n.roomId === r.id);
    rNodes.forEach(na => {
      const ai = HELIX_ORDER.indexOf(na.op);
      rNodes.forEach(nb => {
        if (na === nb) return;
        const bi = HELIX_ORDER.indexOf(nb.op);
        if (bi === ai + 1) addEdge(na.id, nb.id, 'helix', '#5a3030');
      });
    });
  });
  // 3. Cross-room: shared target prefix
  const targetMap = {};
  nodes.forEach(n => {
    n.events.forEach(ev => {
      const t = typeof ev.content?.target === 'string' ? ev.content.target : '';
      if (!t) return;
      const prefix = t.split('.').slice(0,2).join('.');
      if (!targetMap[prefix]) targetMap[prefix] = new Set();
      targetMap[prefix].add(n.id);
    });
  });
  Object.values(targetMap).forEach(ids => {
    const arr = [...ids];
    for (let i = 0; i < arr.length; i++) {
      for (let j = i+1; j < arr.length; j++) {
        const na = nodes.find(n=>n.id===arr[i]), nb = nodes.find(n=>n.id===arr[j]);
        if (na && nb && na.roomId !== nb.roomId) addEdge(na.id, nb.id, 'crossroom', '#2a5a4a');
      }
    }
  });
  // Overlap resolution
  const MIN_X = NODE_W + 24, MIN_Y = NODE_H + 12;
  for (let iter = 0; iter < 80; iter++) {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i+1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const ox = MIN_X - Math.abs(dx), oy = MIN_Y - Math.abs(dy);
        if (ox > 0 && oy > 0) {
          if (ox < oy) { const p = ox * 0.55 * (dx < 0 ? -1 : 1); a.x -= p*0.5; b.x += p*0.5; }
          else { const p = oy * 0.3 * (dy < 0 ? -1 : 1); a.y -= p*0.5; b.y += p*0.5; }
        }
      }
    }
    nodes.forEach(n => {
      const targetY = 60 + HELIX_ORDER.indexOf(n.op) * ROW_GAP;
      n.y += (targetY - n.y) * 0.25;
    });
  }
  return { nodes, edges, rooms };
}

const EOCanvas = ({ events }) => {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const camRef = useRef({ x:0, y:0, zoom:1 });
  const panRef = useRef({ active:false, sx:0, sy:0, cx:0, cy:0 });
  const graphRef = useRef({ nodes:[], edges:[], rooms:[] });
  const hoveredRef = useRef(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [edgeVis, setEdgeVis] = useState({ sequence:true, helix:false, crossroom:true });

  // Build graph when events change
  useEffect(() => {
    graphRef.current = _buildEOGraph(events);
    // Auto-fit
    const { nodes } = graphRef.current;
    if (nodes.length > 0) {
      const canvas = canvasRef.current;
      if (canvas) {
        let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
        nodes.forEach(n => { minX=Math.min(minX,n.x); minY=Math.min(minY,n.y); maxX=Math.max(maxX,n.x+n.w); maxY=Math.max(maxY,n.y+n.h); });
        const pw = canvas.width - 120, ph = canvas.height - 80;
        const gz = Math.min(pw/Math.max(maxX-minX,1), ph/Math.max(maxY-minY,1), 1.8) * 0.85;
        camRef.current = { x: -((minX+maxX)/2), y: -((minY+maxY)/2), zoom: gz };
      }
    }
    _drawCanvas();
  }, [events]);

  // Resize observer
  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const resize = () => { canvas.width = wrap.clientWidth; canvas.height = wrap.clientHeight; _drawCanvas(); };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  const _w2s = (wx, wy) => {
    const c = canvasRef.current;
    if (!c) return { x:0, y:0 };
    const cam = camRef.current;
    return { x: (wx + cam.x)*cam.zoom + c.width/2, y: (wy + cam.y)*cam.zoom + c.height/2 };
  };
  const _s2w = (sx, sy) => {
    const c = canvasRef.current;
    if (!c) return { x:0, y:0 };
    const cam = camRef.current;
    return { x: (sx - c.width/2)/cam.zoom - cam.x, y: (sy - c.height/2)/cam.zoom - cam.y };
  };
  const _hitTest = (sx, sy) => {
    const w = _s2w(sx, sy);
    return graphRef.current.nodes.find(n => w.x >= n.x && w.x <= n.x+n.w && w.y >= n.y && w.y <= n.y+n.h) || null;
  };

  const _roundRect = (ctx, x, y, w, h, r) => {
    ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.arcTo(x+w,y,x+w,y+r,r);
    ctx.lineTo(x+w,y+h-r); ctx.arcTo(x+w,y+h,x+w-r,y+h,r);
    ctx.lineTo(x+r,y+h); ctx.arcTo(x,y+h,x,y+h-r,r);
    ctx.lineTo(x,y+r); ctx.arcTo(x,y,x+r,y,r);
  };

  const _drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const cam = camRef.current;
    const W = canvas.width, H = canvas.height;
    const { nodes, edges, rooms } = graphRef.current;
    ctx.clearRect(0, 0, W, H);
    // Grid
    const step = 40 * cam.zoom;
    if (step > 4) {
      const ox = (cam.x * cam.zoom + W/2) % step;
      const oy = (cam.y * cam.zoom + H/2) % step;
      ctx.strokeStyle = '#1a1a2a';
      ctx.lineWidth = 1;
      for (let x = ox; x < W; x += step) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
      for (let y = oy; y < H; y += step) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
    }
    // Helix row labels
    if (nodes.length) {
      HELIX_ORDER.forEach((k, i) => {
        const wy = 60 + i * 72 + 24;
        const s = _w2s(-60, wy);
        if (s.y < 0 || s.y > H) return;
        ctx.save(); ctx.globalAlpha = 0.4;
        ctx.font = Math.max(9, 11*cam.zoom) + 'px monospace';
        ctx.fillStyle = EO_CANVAS_OPS[k].color;
        ctx.textAlign = 'right';
        ctx.fillText(EO_CANVAS_OPS[k].symbol + ' ' + k, s.x, s.y);
        ctx.restore();
      });
    }
    // Room column headers
    rooms.forEach((r, ri) => {
      const wx = 120 + ri * 280 + 90;
      const s = _w2s(wx, 20);
      if (s.x < 0 || s.x > W) return;
      ctx.save(); ctx.globalAlpha = 0.55;
      ctx.font = Math.max(8, 10*cam.zoom) + 'px monospace';
      ctx.fillStyle = '#606090';
      ctx.textAlign = 'center';
      ctx.fillText(r.label || r.type, s.x, s.y);
      ctx.restore();
    });
    // Edges
    edges.forEach(e => {
      if (e.type === 'sequence' && !edgeVis.sequence) return;
      if (e.type === 'helix' && !edgeVis.helix) return;
      if (e.type === 'crossroom' && !edgeVis.crossroom) return;
      const na = nodes.find(n=>n.id===e.a), nb = nodes.find(n=>n.id===e.b);
      if (!na || !nb) return;
      const ax = _w2s(na.x+na.w/2, na.y+na.h/2);
      const bx = _w2s(nb.x+nb.w/2, nb.y+nb.h/2);
      ctx.save();
      ctx.strokeStyle = e.color;
      ctx.lineWidth = e.type === 'crossroom' ? 1.5 : 1;
      if (e.type === 'crossroom') {
        ctx.setLineDash([4*cam.zoom, 4*cam.zoom]);
        ctx.shadowColor = '#2a6a5a'; ctx.shadowBlur = 6;
      } else if (e.type === 'helix') {
        ctx.setLineDash([2*cam.zoom, 3*cam.zoom]);
      } else { ctx.setLineDash([]); }
      const cpx = ax.x + (bx.x-ax.x)*0.5;
      ctx.beginPath();
      ctx.moveTo(ax.x, ax.y);
      ctx.bezierCurveTo(cpx, ax.y, cpx, bx.y, bx.x, bx.y);
      ctx.stroke();
      // Arrow for sequence
      if (e.type === 'sequence') {
        const dist = Math.sqrt((bx.x-ax.x)**2 + (bx.y-ax.y)**2);
        if (dist > 20) {
          ctx.setLineDash([]);
          const angle = Math.atan2(bx.y-bx.y, bx.x-cpx) || Math.atan2(bx.y-ax.y, bx.x-ax.x);
          const as = 5*cam.zoom;
          ctx.fillStyle = e.color;
          ctx.beginPath();
          ctx.moveTo(bx.x, bx.y);
          ctx.lineTo(bx.x - as*Math.cos(angle-0.4), bx.y - as*Math.sin(angle-0.4));
          ctx.lineTo(bx.x - as*Math.cos(angle+0.4), bx.y - as*Math.sin(angle+0.4));
          ctx.closePath(); ctx.fill();
        }
      }
      ctx.restore();
    });
    // Nodes
    nodes.forEach(n => {
      const op = EO_CANVAS_OPS[n.op];
      const s = _w2s(n.x, n.y);
      const sw = n.w * cam.zoom, sh = n.h * cam.zoom;
      if (s.x+sw < 0 || s.x > W || s.y+sh < 0 || s.y > H) return;
      const isSel = selectedNode?.id === n.id;
      const isHov = hoveredRef.current?.id === n.id;
      ctx.save();
      if (isSel || isHov) { ctx.shadowColor = op.color; ctx.shadowBlur = isSel ? 18 : 8; }
      // BG
      ctx.fillStyle = isSel ? '#1e1e3a' : '#12122a';
      ctx.beginPath(); _roundRect(ctx, s.x, s.y, sw, sh, 3*cam.zoom); ctx.fill();
      // Left accent
      ctx.fillStyle = op.color;
      ctx.fillRect(s.x, s.y+2*cam.zoom, 3*cam.zoom, sh-4*cam.zoom);
      // Border
      ctx.strokeStyle = isSel ? op.color : isHov ? op.color+'88' : '#2a2a4a';
      ctx.lineWidth = isSel ? 1.5 : 1;
      ctx.shadowBlur = 0;
      ctx.beginPath(); _roundRect(ctx, s.x, s.y, sw, sh, 3*cam.zoom); ctx.stroke();
      // Symbol
      ctx.fillStyle = op.color;
      ctx.font = Math.max(11, 15*cam.zoom) + 'px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(op.symbol, s.x + 8*cam.zoom, s.y + sh*0.52);
      if (cam.zoom > 0.4) {
        ctx.font = Math.max(6, 8*cam.zoom) + 'px monospace';
        ctx.fillStyle = op.color + 'aa';
        ctx.fillText(n.op, s.x + 8*cam.zoom, s.y + sh*0.82);
      }
      // Name + count
      if (cam.zoom > 0.25) {
        ctx.fillStyle = isSel ? '#e8e8f8' : '#b0b0d0';
        const ns = Math.max(8, 10*cam.zoom);
        ctx.font = ns + 'px monospace';
        ctx.textAlign = 'left';
        const maxW = sw - 50*cam.zoom;
        let name = (n.room?.type || 'room');
        while (name.length > 3 && ctx.measureText(name).width > maxW) name = name.slice(0,-1);
        ctx.fillText(name, s.x + 25*cam.zoom, s.y + sh*0.42);
        // Count badge
        ctx.fillStyle = op.color + '44';
        const badge = 'x' + n.count;
        const bw = ctx.measureText(badge).width + 6*cam.zoom;
        ctx.fillRect(s.x + sw - bw - 4*cam.zoom, s.y + 3*cam.zoom, bw, sh*0.45);
        ctx.fillStyle = op.color;
        ctx.font = Math.max(7, 9*cam.zoom) + 'px monospace';
        ctx.fillText(badge, s.x + sw - bw - 1*cam.zoom, s.y + sh*0.38);
      }
      ctx.restore();
    });
    // Status
    ctx.save();
    ctx.fillStyle = '#0a0a14cc';
    ctx.fillRect(0, H-22, W, 22);
    ctx.font = '10px monospace'; ctx.fillStyle = '#404060';
    ctx.textAlign = 'left';
    ctx.fillText('Nodes: ' + nodes.length + '   Edges: ' + edges.length + '   Rooms: ' + rooms.length +
      '   Gaps: ' + HELIX_ORDER.filter(k => !nodes.find(n=>n.op===k)).length +
      '   Zoom: ' + Math.round(cam.zoom*100) + '%', 10, H-7);
    ctx.restore();
  };

  // Mouse handlers
  const onMouseDown = useCallback(e => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const ox = e.clientX - rect.left, oy = e.clientY - rect.top;
    const hit = _hitTest(ox, oy);
    if (hit) { setSelectedNode(prev => prev?.id === hit.id ? null : hit); }
    else {
      panRef.current = { active:true, sx:e.clientX, sy:e.clientY, cx:camRef.current.x, cy:camRef.current.y };
      if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing';
    }
  }, []);
  const onMouseMove = useCallback(e => {
    const p = panRef.current;
    if (p.active) {
      camRef.current.x = p.cx + (e.clientX - p.sx) / camRef.current.zoom;
      camRef.current.y = p.cy + (e.clientY - p.sy) / camRef.current.zoom;
      _drawCanvas(); return;
    }
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const ox = e.clientX - rect.left, oy = e.clientY - rect.top;
    const hit = _hitTest(ox, oy);
    if (hit !== hoveredRef.current) {
      hoveredRef.current = hit;
      if (canvasRef.current) canvasRef.current.style.cursor = hit ? 'pointer' : 'default';
      _drawCanvas();
    }
  }, []);
  const onMouseUp = useCallback(() => { panRef.current.active = false; if (canvasRef.current) canvasRef.current.style.cursor = hoveredRef.current ? 'pointer' : 'default'; }, []);
  const onWheel = useCallback(e => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const ox = e.clientX - rect.left, oy = e.clientY - rect.top;
    const cam = camRef.current;
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    const wx = (ox - canvasRef.current.width/2)/cam.zoom - cam.x;
    const wy = (oy - canvasRef.current.height/2)/cam.zoom - cam.y;
    cam.zoom = Math.max(0.12, Math.min(4, cam.zoom * factor));
    cam.x = (ox - canvasRef.current.width/2)/cam.zoom - wx;
    cam.y = (oy - canvasRef.current.height/2)/cam.zoom - wy;
    _drawCanvas();
  }, []);

  // Redraw when selectedNode or edgeVis changes
  useEffect(() => { _drawCanvas(); }, [selectedNode, edgeVis]);

  // Touch support
  const touchRef = useRef(null);
  const onTouchStart = useCallback(e => { touchRef.current = { x:e.touches[0].clientX, y:e.touches[0].clientY, cx:camRef.current.x, cy:camRef.current.y }; }, []);
  const onTouchMove = useCallback(e => {
    e.preventDefault();
    const t = touchRef.current;
    if (!t) return;
    camRef.current.x = t.cx + (e.touches[0].clientX - t.x) / camRef.current.zoom;
    camRef.current.y = t.cy + (e.touches[0].clientY - t.y) / camRef.current.zoom;
    _drawCanvas();
  }, []);

  const opC = selectedNode ? EO_CANVAS_OPS[selectedNode.op] : null;

  return React.createElement('div', { style: { position:'relative', width:'100%', height:'min(70vh, 600px)', background:'#0c0c18', borderRadius:'var(--r)', border:'1px solid var(--border-0)', overflow:'hidden' } },
    // Canvas
    React.createElement('div', { ref: wrapRef, style: { width:'100%', height:'100%' } },
      React.createElement('canvas', {
        ref: canvasRef, style: { display:'block', width:'100%', height:'100%' },
        onMouseDown, onMouseMove, onMouseUp, onMouseLeave: onMouseUp,
        onWheel, onTouchStart, onTouchMove
      })
    ),
    // Edge toggles overlay
    React.createElement('div', { style: { position:'absolute', top:8, right: selectedNode ? 268 : 8, display:'flex', gap:4, zIndex:2 } },
      [['sequence','\u2014 seq','#3a3a6a'], ['helix','-- helix','#5a3030'], ['crossroom','\u2934 xroom','#2a5a4a']].map(([key, label, col]) =>
        React.createElement('button', {
          key, className: 'b-gho b-xs',
          style: { fontSize:10, fontFamily:'var(--mono)', opacity: edgeVis[key] ? 1 : 0.35, borderColor: edgeVis[key] ? col : undefined },
          onClick: () => setEdgeVis(prev => ({ ...prev, [key]: !prev[key] }))
        }, label)
      )
    ),
    // Legend overlay
    React.createElement('div', { style: { position:'absolute', top:8, left:8, zIndex:2, opacity:0.6, pointerEvents:'none' } },
      [['#3a3a6a','sequence (same room)'], ['#2a5a4a','cross-room'], ['#5a3030','helix dependency']].map(([c, l]) =>
        React.createElement('div', { key:l, style:{ display:'flex', alignItems:'center', gap:6, marginBottom:2 } },
          React.createElement('div', { style:{ width:18, height:2, background:c, borderRadius:1 } }),
          React.createElement('span', { style:{ fontSize:9, color:'#404060', fontFamily:'var(--mono)' } }, l)
        )
      )
    ),
    // Sidebar
    selectedNode && React.createElement('div', {
      style: {
        position:'absolute', right:0, top:0, bottom:0, width:260,
        background:'#0d0d1a', borderLeft:'1px solid #1e1e3a', overflowY:'auto',
        padding:0, zIndex:3, animation:'fadeIn .15s ease'
      }
    },
      React.createElement('div', { style: { padding:'10px 12px', borderBottom:'1px solid #1e1e3a', display:'flex', alignItems:'center', gap:8 } },
        React.createElement('span', { style: { fontSize:20, color: opC.color } }, opC.symbol),
        React.createElement('div', null,
          React.createElement('div', { style: { fontSize:12, color:'#e0e0f0', fontWeight:600 } }, selectedNode.op),
          React.createElement('div', { style: { fontSize:9, color: opC.color + 'aa' } }, opC.desc)
        ),
        React.createElement('button', {
          onClick: () => setSelectedNode(null),
          style: { marginLeft:'auto', background:'none', border:'none', color:'#404060', cursor:'pointer', fontSize:16 }
        }, '\u00D7')
      ),
      React.createElement('div', { style: { padding:'8px 12px', display:'flex', flexDirection:'column', gap:6 } },
        // Room
        React.createElement('div', { style: { background:'#10102a', border:'1px solid #1e1e3a', borderRadius:3, padding:'6px 8px' } },
          React.createElement('div', { style: { fontSize:8, letterSpacing:'0.15em', color:'#303058', textTransform:'uppercase', marginBottom:2 } }, 'Room'),
          React.createElement('span', { style: { fontSize:11, color:'#9090b8' } }, selectedNode.room?.label || selectedNode.room?.type || 'Unknown')
        ),
        // Count + Time
        React.createElement('div', { style: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 } },
          React.createElement('div', { style: { background:'#10102a', border:'1px solid #1e1e3a', borderRadius:3, padding:'6px 8px' } },
            React.createElement('div', { style: { fontSize:8, letterSpacing:'0.15em', color:'#303058', textTransform:'uppercase', marginBottom:2 } }, 'Events'),
            React.createElement('span', { style: { fontSize:11, color:'#9090b8' } }, selectedNode.count)
          ),
          React.createElement('div', { style: { background:'#10102a', border:'1px solid #1e1e3a', borderRadius:3, padding:'6px 8px' } },
            React.createElement('div', { style: { fontSize:8, letterSpacing:'0.15em', color:'#303058', textTransform:'uppercase', marginBottom:2 } }, 'Latest'),
            React.createElement('span', { style: { fontSize:10, color:'#9090b8', fontFamily:'var(--mono)' } },
              selectedNode.latestTs ? new Date(selectedNode.latestTs).toLocaleTimeString() : '\u2014')
          )
        ),
        // Senders
        selectedNode.senders.length > 0 && React.createElement('div', { style: { background:'#10102a', border:'1px solid #1e1e3a', borderRadius:3, padding:'6px 8px' } },
          React.createElement('div', { style: { fontSize:8, letterSpacing:'0.15em', color:'#303058', textTransform:'uppercase', marginBottom:2 } }, 'Senders'),
          React.createElement('div', { style: { display:'flex', flexWrap:'wrap', gap:3 } },
            selectedNode.senders.map(s => React.createElement('span', {
              key: s, style: { fontSize:9, color:'#606090', background:'#0c0c1c', padding:'2px 6px', borderRadius:2, fontFamily:'var(--mono)' }
            }, (s || '').split(':')[0]?.replace('@','') || s))
          )
        ),
        // Labels
        selectedNode.labels.length > 0 && React.createElement('div', { style: { background:'#10102a', border:'1px solid #1e1e3a', borderRadius:3, padding:'6px 8px' } },
          React.createElement('div', { style: { fontSize:8, letterSpacing:'0.15em', color:'#303058', textTransform:'uppercase', marginBottom:2 } }, 'Recent Actions'),
          selectedNode.labels.slice(0,6).map((l, i) => React.createElement('div', {
            key: i, style: { fontSize:10, color:'#7070a0', padding:'2px 0', borderBottom: i < selectedNode.labels.length-1 ? '1px solid #14142a' : 'none' }
          }, l))
        ),
        // Helix position
        React.createElement('div', { style: { background:'#10102a', border:'1px solid #1e1e3a', borderRadius:3, padding:'6px 8px' } },
          React.createElement('div', { style: { fontSize:8, letterSpacing:'0.15em', color:'#303058', textTransform:'uppercase', marginBottom:4 } }, 'Helix Position'),
          React.createElement('div', { style: { display:'flex', gap:3, flexWrap:'wrap' } },
            HELIX_ORDER.map(k => React.createElement('span', {
              key: k, style: {
                fontSize:9, padding:'2px 5px', borderRadius:2, fontFamily:'var(--mono)',
                background: k === selectedNode.op ? EO_CANVAS_OPS[k].color + '22' : '#0c0c1c',
                color: k === selectedNode.op ? EO_CANVAS_OPS[k].color : '#252540',
                border: k === selectedNode.op ? '1px solid ' + EO_CANVAS_OPS[k].color + '44' : '1px solid transparent'
              }
            }, EO_CANVAS_OPS[k].symbol))
          )
        )
      )
    )
  );
};

/* ═══════════════════ ACTION LOG ═══════════════════════════
 * Records state changes to any given room, or across all rooms.
 * Uses classifyEvent() for human-readable labels.
 * Accepts optional roomId prop for per-room scoping.
 * ═══════════════════════════════════════════════════════════════ */
const _isActionLogRelevant = (ev) => {
  const type = ev.getType();
  if (type.startsWith('io.khora.')) return true;
  if (type === 'm.room.create' || type === 'm.room.member' ||
      type === 'm.room.encryption' || type === 'm.room.tombstone') return true;
  return false;
};
const _collectRoomEvents = (room, roomInfo) => {
  const seenIds = new Set();
  const events = [];
  const timelineSets = room.getTimelineSets ? room.getTimelineSets() : [];
  const allTlEvents = [];
  if (timelineSets.length > 0) {
    for (const ts of timelineSets) {
      for (const tl of ts.getTimelines()) {
        for (const ev of tl.getEvents()) {
          if (!seenIds.has(ev.getId())) { seenIds.add(ev.getId()); allTlEvents.push(ev); }
        }
      }
    }
  } else {
    for (const ev of room.getLiveTimeline().getEvents()) {
      if (!seenIds.has(ev.getId())) { seenIds.add(ev.getId()); allTlEvents.push(ev); }
    }
  }
  for (const ev of allTlEvents) {
    if (!_isActionLogRelevant(ev)) continue;
    const cls = classifyEvent(ev, roomInfo);
    events.push({
      id: ev.getId(), roomId: room.roomId, roomInfo, sender: ev.getSender(),
      ts: ev.getTs(), type: ev.getType(), content: ev.getContent(),
      ...cls
    });
  }
  for (const ev of room.currentState.getStateEvents()) {
    if (seenIds.has(ev.getId())) continue;
    seenIds.add(ev.getId());
    if (!_isActionLogRelevant(ev)) continue;
    const cls = classifyEvent(ev, roomInfo);
    events.push({
      id: ev.getId(), roomId: room.roomId, roomInfo, sender: ev.getSender(),
      ts: ev.getTs(), type: ev.getType(), content: ev.getContent(),
      ...cls
    });
  }
  return events;
};
const ActionLog = ({
  session,
  roomId
}) => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [targetFilter, setTargetFilter] = useState('all');
  const [viewMode, setViewMode] = useState('list');
  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    const allEvents = [];
    try {
      if (roomId) {
        // ── Per-room mode: load events from a single room directly ──
        const roomInfo = await classifyRoom(roomId);
        if (svc.client) {
          const room = svc.client.getRoom(roomId);
          if (room) {
            try {
              const canPag = room.getLiveTimeline().getPaginationToken('b');
              if (canPag) await svc.client.scrollback(room, 50);
            } catch (e) {/* pagination may fail */}
            allEvents.push(..._collectRoomEvents(room, roomInfo));
          }
        } else {
          // HTTP-only fallback for single room
          try {
            const stateEvts = await svc._api('GET', `/rooms/${encodeURIComponent(roomId)}/state`);
            if (Array.isArray(stateEvts)) {
              for (const raw of stateEvts) {
                const type = raw.type || '';
                if (!type.startsWith('io.khora.') && type !== 'm.room.create' && type !== 'm.room.member' && type !== 'm.room.encryption' && type !== 'm.room.tombstone') continue;
                const fakeEv = {
                  getType: () => type, getContent: () => raw.content || {},
                  getId: () => raw.event_id || `state_${roomId}_${type}_${raw.state_key || ''}`,
                  getSender: () => raw.sender || '', getTs: () => raw.origin_server_ts || 0, isState: () => true,
                  getStateKey: () => raw.state_key || ''
                };
                const cls = classifyEvent(fakeEv, roomInfo);
                allEvents.push({ id: fakeEv.getId(), roomId, roomInfo, sender: fakeEv.getSender(),
                  ts: fakeEv.getTs(), type, content: fakeEv.getContent(), ...cls });
              }
            }
          } catch (apiErr) {
            console.warn('ActionLog: HTTP state fetch failed for room', roomId, apiErr.message);
          }
        }
      } else {
        // ── Global mode: scan all rooms ──
        const scanned = await svc.scanRooms();
        const roomIds = Object.keys(scanned);
        for (const rid of roomIds) {
          try {
            const roomInfo = await classifyRoom(rid, scanned[rid]);
            if (svc.client) {
              const room = svc.client.getRoom(rid);
              if (!room) continue;
              try {
                const canPag = room.getLiveTimeline().getPaginationToken('b');
                if (canPag) await svc.client.scrollback(room, 50);
              } catch (e) {/* pagination may fail */}
              allEvents.push(..._collectRoomEvents(room, roomInfo));
            } else {
              // HTTP-only fallback: fetch state events via REST API
              try {
                const stateEvts = await svc._api('GET', `/rooms/${encodeURIComponent(rid)}/state`);
                if (Array.isArray(stateEvts)) {
                  for (const raw of stateEvts) {
                    const type = raw.type || '';
                    if (!type.startsWith('io.khora.') && type !== 'm.room.create' && type !== 'm.room.member' && type !== 'm.room.encryption' && type !== 'm.room.tombstone') continue;
                    const fakeEv = {
                      getType: () => type, getContent: () => raw.content || {},
                      getId: () => raw.event_id || `state_${rid}_${type}_${raw.state_key || ''}`,
                      getSender: () => raw.sender || '', getTs: () => raw.origin_server_ts || 0, isState: () => true,
                      getStateKey: () => raw.state_key || ''
                    };
                    const cls = classifyEvent(fakeEv, roomInfo);
                    allEvents.push({ id: fakeEv.getId(), roomId: rid, roomInfo, sender: fakeEv.getSender(),
                      ts: fakeEv.getTs(), type, content: fakeEv.getContent(), ...cls });
                  }
                }
              } catch (apiErr) {
                console.warn('ActionLog: HTTP state fetch failed for room', rid, apiErr.message);
              }
            }
          } catch (roomErr) {
            console.warn('ActionLog: skipping room', rid, roomErr.message);
          }
        }
      }
      allEvents.sort((a, b) => b.ts - a.ts);
      setEvents(allEvents);
    } catch (e) {
      console.error('ActionLog error:', e);
      setError(e.message || 'Failed to load events');
      setEvents(allEvents);
    }
    setLoading(false);
  }, [roomId]);
  useEffect(() => { loadEvents(); }, [loadEvents]);
  useEffect(() => {
    let debounce = null;
    const debouncedLoad = (e) => {
      if (roomId && e?.detail?.roomId && e.detail.roomId !== roomId) return;
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => { loadEvents(); }, 400);
    };
    window.addEventListener('khora:eo', debouncedLoad);
    window.addEventListener('khora:timeline', debouncedLoad);
    window.addEventListener('khora:state', debouncedLoad);
    return () => {
      window.removeEventListener('khora:eo', debouncedLoad);
      window.removeEventListener('khora:timeline', debouncedLoad);
      window.removeEventListener('khora:state', debouncedLoad);
      if (debounce) clearTimeout(debounce);
    };
  }, [loadEvents, roomId]);
  const roomTypes = [...new Set(events.map(ev => ev.roomInfo.type))].sort();
  const targetEntries = [...new Set(
    events
      .filter(ev => ev.type === EVT.OP && ev.content?.target && typeof ev.content.target === 'string')
      .map(ev => {
        const parts = ev.content.target.split('.');
        return parts.length >= 2 ? `${parts[0]}.${parts[1]}` : parts[0];
      })
      .filter(Boolean)
  )].sort();
  let filtered = events;
  if (filter !== 'all') filtered = filtered.filter(ev => ev.roomInfo.type === filter);
  if (targetFilter !== 'all') filtered = filtered.filter(ev => {
    const t = typeof ev.content?.target === 'string' ? ev.content.target : '';
    const parts = t.split('.');
    const key = parts.length >= 2 ? `${parts[0]}.${parts[1]}` : parts[0];
    return key === targetFilter;
  });
  if (loading && events.length === 0) return /*#__PURE__*/React.createElement("div", {
    style: { height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }
  }, /*#__PURE__*/React.createElement(Spin, { s: 28 }));
  return /*#__PURE__*/React.createElement("div", {
    className: "anim-up",
    style: { maxWidth: 900, margin: '0 auto' }
  }, /*#__PURE__*/React.createElement("div", {
    style: { marginBottom: 20 }
  }, /*#__PURE__*/React.createElement("div", {
    style: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }
  }, /*#__PURE__*/React.createElement(I, { n: "list", s: 20, c: "var(--purple)" }),
  /*#__PURE__*/React.createElement("h2", {
    style: { fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em' }
  }, roomId ? "Room Log" : "Action Log"),
  /*#__PURE__*/React.createElement("span", {
    style: { fontSize: 11, color: 'var(--tx-3)', fontFamily: 'var(--mono)', marginLeft: 'auto' }
  }, filtered.length, " action", filtered.length !== 1 ? 's' : '')),
  /*#__PURE__*/React.createElement("p", {
    style: { color: 'var(--tx-1)', fontSize: 13, lineHeight: 1.6 }
  }, roomId ? "State changes for this room." : "Chronological log of state changes across your rooms.")),
  error && /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: { marginBottom: 14, padding: '10px 14px', border: '1px solid var(--red)', background: 'var(--bg-2)' }
  }, /*#__PURE__*/React.createElement("div", {
    style: { display: 'flex', alignItems: 'center', gap: 8 }
  }, /*#__PURE__*/React.createElement(I, { n: "alert-triangle", s: 14, c: "var(--red)" }),
  /*#__PURE__*/React.createElement("span", { style: { fontSize: 12, color: 'var(--red)' } }, error),
  /*#__PURE__*/React.createElement("button", {
    onClick: loadEvents, className: "b-gho b-xs", style: { marginLeft: 'auto' }
  }, "Retry"))),
  /*#__PURE__*/React.createElement("div", {
    style: { display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }
  }, !roomId && /*#__PURE__*/React.createElement("select", {
    value: filter,
    onChange: e => setFilter(e.target.value),
    style: { width: 'auto', padding: '5px 8px', fontSize: 11 }
  }, /*#__PURE__*/React.createElement("option", { value: "all" }, "All Types"),
  roomTypes.map(t => /*#__PURE__*/React.createElement("option", { key: t, value: t }, t))),
  !roomId && targetEntries.length > 0 && /*#__PURE__*/React.createElement("select", {
    value: targetFilter,
    onChange: e => setTargetFilter(e.target.value),
    style: { width: 'auto', padding: '5px 8px', fontSize: 11 }
  }, /*#__PURE__*/React.createElement("option", { value: "all" }, "All Targets"),
  targetEntries.map(t => /*#__PURE__*/React.createElement("option", { key: t, value: t }, t))),
  /*#__PURE__*/React.createElement("button", {
    onClick: loadEvents, className: "b-gho b-xs",
    style: { display: 'flex', alignItems: 'center', gap: 4 }
  }, /*#__PURE__*/React.createElement(I, { n: "refresh-cw", s: 10 }), "Refresh"),
  /*#__PURE__*/React.createElement("div", {
    style: { marginLeft: 'auto', display: 'flex', gap: 2, background: 'var(--bg-1)', borderRadius: 'var(--r)', padding: 2, border: '1px solid var(--border-0)' }
  },
    /*#__PURE__*/React.createElement("button", {
      className: viewMode === 'list' ? 'b-pri b-xs' : 'b-gho b-xs',
      onClick: () => setViewMode('list'),
      style: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }
    }, /*#__PURE__*/React.createElement(I, { n: "list", s: 10 }), "List"),
    /*#__PURE__*/React.createElement("button", {
      className: viewMode === 'graph' ? 'b-pri b-xs' : 'b-gho b-xs',
      onClick: () => setViewMode('graph'),
      style: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }
    }, /*#__PURE__*/React.createElement(I, { n: "git-branch", s: 10 }), "Graph")
  )),
  viewMode === 'graph' ? /*#__PURE__*/React.createElement(EOCanvas, { events: filtered }) :
  filtered.length === 0 && !error ? /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: { textAlign: 'center', padding: '40px 20px', borderStyle: 'dashed' }
  }, /*#__PURE__*/React.createElement(I, { n: "list", s: 24, c: "var(--tx-3)" }),
  /*#__PURE__*/React.createElement("p", {
    style: { color: 'var(--tx-3)', marginTop: 8, fontSize: 12 }
  }, "No state changes recorded yet.")) :
  /*#__PURE__*/React.createElement("div", {
    style: { display: 'flex', flexDirection: 'column', gap: 2 }
  }, filtered.slice(0, 500).map((ev, idx) => {
    const opC = OP_COLORS[ev.op] || 'blue';
    const rmC = ROOM_COLORS[ev.roomInfo.type] || 'orange';
    const username = (ev.sender || '').split(':')[0]?.replace('@', '') || '';
    return /*#__PURE__*/React.createElement("div", {
      key: ev.id || idx,
      style: {
        display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
        background: 'var(--bg-2)', border: '1px solid var(--border-0)',
        borderRadius: 'var(--r)', fontSize: 12
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: { fontSize: 10, color: 'var(--tx-3)', fontFamily: 'var(--mono)', minWidth: 62, flexShrink: 0 }
    }, ev.ts ? new Date(ev.ts).toLocaleTimeString() : ''),
    !roomId && /*#__PURE__*/React.createElement("span", {
      className: `tag tag-${rmC}`, style: { fontSize: 8.5, flexShrink: 0 }
    }, ev.roomInfo.type),
    /*#__PURE__*/React.createElement("span", {
      className: `tag tag-${opC}`, title: OP_DESCRIPTIONS[ev.op] ? `${OP_DESCRIPTIONS[ev.op].verb}: ${OP_DESCRIPTIONS[ev.op].desc}` : ev.op, style: { fontSize: 9, fontFamily: 'var(--mono)', minWidth: 28, textAlign: 'center', flexShrink: 0, cursor: 'help' }
    }, ev.op),
    ev.label && /*#__PURE__*/React.createElement("span", {
      style: { color: 'var(--tx-1)' }
    }, "\u2014 ", ev.label),
    ev.desc && /*#__PURE__*/React.createElement("span", {
      style: { color: 'var(--tx-2)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
    }, ev.desc),
    /*#__PURE__*/React.createElement("span", {
      style: { fontSize: 10, color: 'var(--tx-3)', fontFamily: 'var(--mono)', marginLeft: 'auto', flexShrink: 0 }
    }, username));
  })));
};

// Legacy alias
const ActivityStream = ActionLog;

/* ═══════════════════ WELCOME / INVITATION SCREEN ═══════════════════ */
