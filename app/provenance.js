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
    desc: content.target || ''
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
                  getSender: () => raw.sender || '', getTs: () => raw.origin_server_ts || 0, isState: () => true
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
                      getSender: () => raw.sender || '', getTs: () => raw.origin_server_ts || 0, isState: () => true
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
      .filter(ev => ev.type === EVT.OP && ev.content?.target)
      .map(ev => {
        const parts = (ev.content.target || '').split('.');
        return parts.length >= 2 ? `${parts[0]}.${parts[1]}` : parts[0];
      })
      .filter(Boolean)
  )].sort();
  let filtered = events;
  if (filter !== 'all') filtered = filtered.filter(ev => ev.roomInfo.type === filter);
  if (targetFilter !== 'all') filtered = filtered.filter(ev => {
    const parts = (ev.content?.target || '').split('.');
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
  }, /*#__PURE__*/React.createElement(I, { n: "refresh-cw", s: 10 }), "Refresh")),
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
