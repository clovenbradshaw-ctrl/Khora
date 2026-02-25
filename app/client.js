const PersonalDashboard = ({
  session,
  providers,
  observations,
  myResources,
  vaultData,
  allFields,
  vaultRoom,
  myTeams,
  onNavigate
}) => {
  const [loading, setLoading] = useState(true);
  const [bridgeEvents, setBridgeEvents] = useState([]);
  const [providerNotes, setProviderNotes] = useState([]);
  const [eventFilter, setEventFilter] = useState('all'); // all | notes | resources | fields | messages
  const [eventLimit, setEventLimit] = useState(25);

  // Time formatting for the dashboard
  const pdTimeAgo = ts => {
    if (!ts) return '';
    const diff = Date.now() - ts;
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    return new Date(ts).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  // Load all events from bridge rooms relevant to this individual
  const loadBridgeActivity = useCallback(async () => {
    setLoading(true);
    try {
      const allEvents = [];
      const allNotes = [];
      for (const prov of providers) {
        const bid = prov.bridgeRoomId;
        if (!bid || !svc.client) continue;
        const room = svc.client.getRoom(bid);
        if (!room) continue;

        // Paginate to get history
        try {
          for (let i = 0; i < 3; i++) {
            const canPaginate = room.getLiveTimeline().getPaginationToken('b');
            if (!canPaginate) break;
            await svc.client.scrollback(room, 80);
          }
        } catch (e) {/* continue with available events */}
        const seenIds = new Set();
        const roomEvents = [];
        const timelineSets = room.getTimelineSets ? room.getTimelineSets() : [];
        const collectEvents = ev => {
          if (seenIds.has(ev.getId())) return;
          seenIds.add(ev.getId());
          roomEvents.push(ev);
        };
        if (timelineSets.length > 0) {
          for (const ts of timelineSets) {
            for (const tl of ts.getTimelines()) {
              for (const ev of tl.getEvents()) collectEvents(ev);
            }
          }
        } else {
          for (const ev of room.getLiveTimeline().getEvents()) collectEvents(ev);
        }
        // Also include current state events
        for (const ev of room.currentState.getStateEvents()) collectEvents(ev);
        const provName = prov.providerName || prov.providerUserId || 'Provider';
        const orgName = prov.providerProfile?.org_membership?.org_name;
        for (const ev of roomEvents) {
          const type = ev.getType();
          const content = ev.getContent();
          const sender = ev.getSender();
          const ts = ev.getTs();
          const isOwnEvent = sender === svc.userId;

          // Categorize events
          if (type === EVT.NOTE) {
            allNotes.push({
              id: ev.getId(),
              title: content.title || 'Untitled',
              content: content.content || content.text || '',
              author: sender,
              provName,
              orgName,
              ts,
              tags: content.tags || [],
              tombstoned: content.tombstoned || false,
              bridgeRoomId: bid
            });
            allEvents.push({
              id: ev.getId(),
              category: 'notes',
              ts,
              provName,
              orgName,
              sender,
              icon: 'msg',
              iconBg: 'var(--purple-dim)',
              iconColor: 'var(--purple)',
              title: isOwnEvent ? 'You added a note' : `${provName} added a note`,
              desc: content.title || content.content?.slice(0, 80) || 'Note added',
              tags: [{
                label: 'NOTE',
                cls: 'tag-purple'
              }]
            });
          } else if (type === EVT.NOTE_EDIT) {
            allEvents.push({
              id: ev.getId(),
              category: 'notes',
              ts,
              provName,
              orgName,
              sender,
              icon: 'edit',
              iconBg: 'var(--gold-dim)',
              iconColor: 'var(--gold)',
              title: isOwnEvent ? 'You edited a note' : `${provName} edited a note`,
              desc: content.title || 'Note updated',
              tags: [{
                label: 'EDIT',
                cls: 'tag-gold'
              }]
            });
          } else if (type === EVT.RESOURCE_ALLOC) {
            allEvents.push({
              id: ev.getId(),
              category: 'resources',
              ts,
              provName,
              orgName,
              sender,
              icon: 'layers',
              iconBg: 'var(--green-dim)',
              iconColor: 'var(--green)',
              title: `${provName} allocated a resource`,
              desc: `${content.quantity || 1} ${content.unit || 'unit'} of ${content.resource_name || content.resource_type_id || 'resource'}`,
              tags: [{
                label: 'RESOURCE',
                cls: 'tag-green'
              }]
            });
          } else if (type === EVT.RESOURCE_VAULT) {
            allEvents.push({
              id: ev.getId(),
              category: 'resources',
              ts,
              provName,
              orgName,
              sender,
              icon: 'layers',
              iconBg: 'var(--green-dim)',
              iconColor: 'var(--green)',
              title: 'Resource recorded to vault',
              desc: `${content.resource_name}: ${content.quantity} ${content.unit || ''}`,
              tags: [{
                label: 'VAULT RECORD',
                cls: 'tag-teal'
              }]
            });
          } else if (type === EVT.RESOURCE_EVENT) {
            const evtType = content.event || 'update';
            allEvents.push({
              id: ev.getId(),
              category: 'resources',
              ts,
              provName,
              orgName,
              sender,
              icon: 'layers',
              iconBg: evtType === 'revoked' ? 'var(--red-dim)' : 'var(--teal-dim)',
              iconColor: evtType === 'revoked' ? 'var(--red)' : 'var(--teal)',
              title: `Resource ${evtType}`,
              desc: `${content.quantity || ''} ${content.unit || ''} — ${content.allocation_id?.slice(0, 16) || ''}`.trim(),
              tags: [{
                label: evtType.toUpperCase(),
                cls: evtType === 'revoked' ? 'tag-red' : 'tag-teal'
              }]
            });
          } else if (type === EVT.BRIDGE_REFS && !isOwnEvent) {
            const fieldCount = Object.keys(content.fields || {}).length;
            allEvents.push({
              id: ev.getId(),
              category: 'fields',
              ts,
              provName,
              orgName,
              sender,
              icon: 'key',
              iconBg: 'var(--blue-dim)',
              iconColor: 'var(--blue)',
              title: content.revoked ? 'Field access revoked' : 'Shared fields updated',
              desc: `${fieldCount} encrypted field ref${fieldCount !== 1 ? 's' : ''}`,
              tags: [{
                label: content.revoked ? 'REVOKED' : 'FIELDS',
                cls: content.revoked ? 'tag-red' : 'tag-blue'
              }]
            });
          } else if (type === EVT.OBSERVATION) {
            allEvents.push({
              id: ev.getId(),
              category: 'observations',
              ts,
              provName,
              orgName,
              sender,
              icon: 'clipboard',
              iconBg: 'var(--orange-dim)',
              iconColor: 'var(--orange)',
              title: isOwnEvent ? 'You recorded an observation' : `${provName} recorded an observation`,
              desc: `${content.prompt_id || 'observation'}: ${content.value || ''}`,
              tags: [{
                label: 'OBSERVATION',
                cls: 'tag-orange'
              }, {
                label: isOwnEvent ? 'GIVEN' : 'MEANT',
                cls: isOwnEvent ? 'tag-teal' : 'tag-gold'
              }]
            });
          } else if (type === EVT.BRIDGE_META) {
            allEvents.push({
              id: ev.getId(),
              category: 'bridge',
              ts,
              provName,
              orgName,
              sender,
              icon: 'share',
              iconBg: 'var(--gold-dim)',
              iconColor: 'var(--gold)',
              title: content.status === 'tombstoned' ? 'Bridge revoked' : 'Bridge updated',
              desc: `Status: ${content.status || 'active'}`,
              tags: [{
                label: 'BRIDGE',
                cls: 'tag-gold'
              }]
            });
          } else if (type === 'm.room.message' && !isOwnEvent) {
            const cvType = content[`${NS}.type`];
            if (cvType === 'request') {
              allEvents.push({
                id: ev.getId(),
                category: 'messages',
                ts,
                provName,
                orgName,
                sender,
                icon: 'msg',
                iconBg: 'var(--gold-dim)',
                iconColor: 'var(--gold)',
                title: `${provName} sent an info request`,
                desc: content.body?.slice(0, 100) || '',
                tags: [{
                  label: 'REQUEST',
                  cls: 'tag-gold'
                }]
              });
            } else {
              allEvents.push({
                id: ev.getId(),
                category: 'messages',
                ts,
                provName,
                orgName,
                sender,
                icon: 'msg',
                iconBg: 'var(--blue-dim)',
                iconColor: 'var(--blue)',
                title: `${provName} sent a message`,
                desc: content.body?.slice(0, 100) || '',
                tags: [{
                  label: 'MESSAGE',
                  cls: 'tag-blue'
                }]
              });
            }
          } else if (type === EVT.ROSTER_ASSIGN && !isOwnEvent) {
            allEvents.push({
              id: ev.getId(),
              category: 'fields',
              ts,
              provName,
              orgName,
              sender,
              icon: 'users',
              iconBg: 'var(--teal-dim)',
              iconColor: 'var(--teal)',
              title: 'Case assignment updated',
              desc: `Assignment changed by ${provName}`,
              tags: [{
                label: 'ASSIGNMENT',
                cls: 'tag-teal'
              }]
            });
          } else if (type === EVT.OP && !isOwnEvent) {
            allEvents.push({
              id: ev.getId(),
              category: 'fields',
              ts,
              provName,
              orgName,
              sender,
              icon: 'git-commit',
              iconBg: 'var(--teal-dim)',
              iconColor: 'var(--teal)',
              title: `${content.op || 'EO'} operation by ${provName}`,
              desc: `${content.target || 'entity'} — ${content.frame?.epistemic || 'MEANT'}`,
              tags: [{
                label: content.op || 'OP',
                cls: 'tag-teal'
              }, {
                label: content.frame?.epistemic || 'MEANT',
                cls: content.frame?.epistemic === 'GIVEN' ? 'tag-teal' : 'tag-gold'
              }]
            });
          }
        }
      }
      allEvents.sort((a, b) => b.ts - a.ts);
      allNotes.sort((a, b) => b.ts - a.ts);
      setBridgeEvents(allEvents);
      setProviderNotes(allNotes.filter(n => !n.tombstoned));
    } catch (e) {
      console.error('PersonalDashboard load error:', e);
    }
    setLoading(false);
  }, [providers]);
  useEffect(() => {
    loadBridgeActivity();
  }, [loadBridgeActivity]);

  // Listen for real-time updates
  useEffect(() => {
    let debounce = null;
    const handler = () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(loadBridgeActivity, 500);
    };
    window.addEventListener('khora:eo', handler);
    window.addEventListener('khora:timeline', handler);
    window.addEventListener('khora:state', handler);
    return () => {
      window.removeEventListener('khora:eo', handler);
      window.removeEventListener('khora:timeline', handler);
      window.removeEventListener('khora:state', handler);
    };
  }, [loadBridgeActivity]);

  // Filtered events
  const filteredEvents = useMemo(() => {
    if (eventFilter === 'all') return bridgeEvents;
    return bridgeEvents.filter(e => e.category === eventFilter);
  }, [bridgeEvents, eventFilter]);

  // Recent messages derived from bridge events
  const recentMessages = useMemo(() =>
    bridgeEvents.filter(e => e.category === 'messages').slice(0, 5),
    [bridgeEvents]
  );

  // Vault snapshot key fields
  const vaultKeyFields = [
    { key: 'full_name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'dob', label: 'Date of Birth' },
    { key: 'address', label: 'Address' },
  ];

  // Stats
  const activeResources = myResources.filter(r => r.status === 'active').length;
  const totalNotes = providerNotes.length;
  const totalObs = observations.length;
  const filledFields = allFields.filter(f => vaultData[f.key]).length;
  const vaultCompletionPct = allFields.length > 0 ? Math.round(filledFields / allFields.length * 100) : 0;
  const providerEventCount = bridgeEvents.filter(e => e.sender !== svc.userId).length;
  if (loading) return /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Spin, {
    s: 28
  }));
  return /*#__PURE__*/React.createElement("div", {
    className: "anim-up",
    style: {
      maxWidth: 900,
      margin: '0 auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 24
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      fontFamily: 'var(--serif)',
      fontSize: 22,
      fontWeight: 700
    }
  }, vaultData.full_name ? `Welcome, ${vaultData.full_name.split(' ')[0]}` : "My Dashboard"), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--tx-1)',
      fontSize: 12.5,
      marginTop: 4
    }
  }, "Your vault, teams, messages, and activity \u2014 all in one place.")), /*#__PURE__*/React.createElement("div", {
    className: "pd-grid"
  }, [{
    l: 'Providers',
    v: providers.length,
    c: 'gold',
    i: 'briefcase',
    nav: 'providers'
  }, {
    l: 'Notes About Me',
    v: totalNotes,
    c: 'purple',
    i: 'msg'
  }, {
    l: 'Observations',
    v: totalObs,
    c: 'blue',
    i: 'clipboard',
    nav: 'observations'
  }, {
    l: 'Active Resources',
    v: activeResources,
    c: 'green',
    i: 'layers',
    nav: 'resources'
  }, {
    l: 'Vault Fields',
    v: `${filledFields}/${allFields.length}`,
    c: 'teal',
    i: 'folder',
    nav: 'vault'
  }, {
    l: 'Teams',
    v: (myTeams || []).length,
    c: 'purple',
    i: 'users',
    nav: 'providers'
  }, {
    l: 'Messages',
    v: recentMessages.length,
    c: 'blue',
    i: 'msg',
    nav: 'inbox'
  }].map((s, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "card pd-stat",
    style: {
      cursor: s.nav ? 'pointer' : 'default'
    },
    onClick: () => s.nav && onNavigate(s.nav)
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label",
    style: {
      marginBottom: 0
    }
  }, s.l.toUpperCase()), /*#__PURE__*/React.createElement("span", {
    style: {
      color: `var(--${s.c})`,
      opacity: .5
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: s.i,
    s: 16
  }))), /*#__PURE__*/React.createElement("div", {
    className: "num",
    style: {
      color: `var(--${s.c})`
    }
  }, s.v)))),
  /* ── Vault Snapshot + My Teams (two-column) ── */
  /*#__PURE__*/React.createElement("div", { className: "pd-two-col" },
    /* Vault Snapshot */
    /*#__PURE__*/React.createElement("div", { className: "pd-section", style: { marginBottom: 0 } },
      /*#__PURE__*/React.createElement("div", { className: "pd-section-hdr" },
        /*#__PURE__*/React.createElement("h3", null, /*#__PURE__*/React.createElement(I, { n: "folder", s: 16, c: "var(--teal)" }), " My Vault"),
        /*#__PURE__*/React.createElement("button", { onClick: () => onNavigate('vault'), className: "b-gho b-xs" }, "Edit Vault")
      ),
      /*#__PURE__*/React.createElement("div", { className: "pd-vault-snap" },
        /*#__PURE__*/React.createElement("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 } },
          /*#__PURE__*/React.createElement("span", { style: { fontSize: 11, color: 'var(--tx-2)', fontFamily: 'var(--mono)' } }, filledFields, "/", allFields.length, " fields filled"),
          /*#__PURE__*/React.createElement("span", { style: { fontSize: 11, fontWeight: 600, color: 'var(--teal)' } }, vaultCompletionPct, "% complete")
        ),
        /*#__PURE__*/React.createElement("div", { className: "vault-progress-bar" },
          /*#__PURE__*/React.createElement("div", { className: "vault-progress-fill", style: { width: vaultCompletionPct + '%' } })
        ),
        vaultKeyFields.map(f => /*#__PURE__*/React.createElement("div", { key: f.key, className: "pd-vault-field-row" },
          /*#__PURE__*/React.createElement("span", { className: "pd-vault-field-key" }, f.label),
          vaultData[f.key]
            ? /*#__PURE__*/React.createElement("span", { className: "pd-vault-field-val" }, vaultData[f.key])
            : /*#__PURE__*/React.createElement("span", { className: "pd-vault-field-empty" }, "Not set")
        ))
      )
    ),
    /* My Teams */
    /*#__PURE__*/React.createElement("div", { className: "pd-section", style: { marginBottom: 0 } },
      /*#__PURE__*/React.createElement("div", { className: "pd-section-hdr" },
        /*#__PURE__*/React.createElement("h3", null, /*#__PURE__*/React.createElement(I, { n: "users", s: 16, c: "var(--purple)" }), " My Teams"),
        (myTeams || []).length > 0 && /*#__PURE__*/React.createElement("button", { onClick: () => onNavigate('providers'), className: "b-gho b-xs" }, "View All")
      ),
      (myTeams || []).length === 0
        ? /*#__PURE__*/React.createElement("div", { className: "pd-empty" },
            /*#__PURE__*/React.createElement(I, { n: "users", s: 28, c: "var(--tx-3)" }),
            /*#__PURE__*/React.createElement("p", { style: { marginTop: 8, fontSize: 12 } }, "No teams yet."),
            /*#__PURE__*/React.createElement("p", { style: { fontSize: 11, marginTop: 4 } }, "Teams you join will appear here.")
          )
        : (myTeams || []).slice(0, 5).map(team =>
            /*#__PURE__*/React.createElement("div", {
              key: team.roomId,
              className: "pd-team-card",
              onClick: () => onNavigate('providers')
            },
              /*#__PURE__*/React.createElement("div", { className: "pd-team-dot", style: { background: `hsl(${team.color_hue || 260},60%,55%)` } }),
              /*#__PURE__*/React.createElement("div", { style: { flex: 1, minWidth: 0 } },
                /*#__PURE__*/React.createElement("div", { className: "pd-team-name" }, team.name || 'Unnamed Team'),
                team.members && /*#__PURE__*/React.createElement("div", { className: "pd-team-meta" },
                  team.members.length, " member", team.members.length !== 1 ? 's' : ''
                )
              ),
              /*#__PURE__*/React.createElement("span", { style: { color: `hsl(${team.color_hue || 260},60%,55%)`, opacity: 0.6 } },
                /*#__PURE__*/React.createElement(I, { n: "users", s: 12 })
              )
            )
          )
    )
  ),
  /* ── Recent Messages ── */
  /*#__PURE__*/React.createElement("div", { className: "pd-section" },
    /*#__PURE__*/React.createElement("div", { className: "pd-section-hdr" },
      /*#__PURE__*/React.createElement("h3", null, /*#__PURE__*/React.createElement(I, { n: "msg", s: 16, c: "var(--blue)" }), " Recent Messages"),
      /*#__PURE__*/React.createElement("button", { onClick: () => onNavigate('inbox'), className: "b-gho b-xs" }, "Open Messages")
    ),
    recentMessages.length === 0
      ? /*#__PURE__*/React.createElement("div", { className: "pd-empty" },
          /*#__PURE__*/React.createElement(I, { n: "msg", s: 28, c: "var(--tx-3)" }),
          /*#__PURE__*/React.createElement("p", { style: { marginTop: 8, fontSize: 12 } }, "No messages yet."),
          /*#__PURE__*/React.createElement("p", { style: { fontSize: 11, marginTop: 4 } }, "Messages from your providers will appear here.")
        )
      : /*#__PURE__*/React.createElement("div", { style: { display: 'flex', flexDirection: 'column', gap: 6 } },
          recentMessages.map(evt =>
            /*#__PURE__*/React.createElement("div", {
              key: evt.id,
              className: "pd-msg-row",
              onClick: () => onNavigate('inbox')
            },
              /*#__PURE__*/React.createElement("div", { className: "pd-event-icon", style: { background: evt.iconBg, color: evt.iconColor } },
                /*#__PURE__*/React.createElement(I, { n: "msg", s: 14 })
              ),
              /*#__PURE__*/React.createElement("div", { style: { flex: 1, minWidth: 0 } },
                /*#__PURE__*/React.createElement("div", { className: "pd-msg-sender" }, evt.provName || 'Provider'),
                /*#__PURE__*/React.createElement("div", { className: "pd-msg-preview" }, evt.desc),
                /*#__PURE__*/React.createElement("div", { className: "pd-msg-time" }, pdTimeAgo(evt.ts))
              ),
              evt.tags && evt.tags.map((t, ti) =>
                /*#__PURE__*/React.createElement("span", { key: ti, className: `tag ${t.cls}`, style: { fontSize: 8, alignSelf: 'center' } }, t.label)
              )
            )
          )
        )
  ),
  /*#__PURE__*/React.createElement("div", {
    className: "pd-section"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pd-section-hdr"
  }, /*#__PURE__*/React.createElement("h3", null, /*#__PURE__*/React.createElement(I, {
    n: "msg",
    s: 16,
    c: "var(--purple)"
  }), " Content About Me"), totalNotes > 3 && /*#__PURE__*/React.createElement("button", {
    onClick: () => onNavigate('inbox'),
    className: "b-gho b-xs"
  }, "View All")), providerNotes.length === 0 && observations.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "pd-empty"
  }, /*#__PURE__*/React.createElement(I, {
    n: "clipboard",
    s: 28,
    c: "var(--tx-3)"
  }), /*#__PURE__*/React.createElement("p", {
    style: {
      marginTop: 8,
      fontSize: 12
    }
  }, "No content about you yet."), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 11,
      marginTop: 4
    }
  }, "When providers add notes, observations, or assessments, they will appear here.")) : /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, providerNotes.slice(0, 5).map(note => /*#__PURE__*/React.createElement("div", {
    key: note.id,
    className: "pd-content-card"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 28,
      height: 28,
      borderRadius: '50%',
      background: 'var(--purple-dim)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--purple)',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "msg",
    s: 13
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      fontWeight: 600
    }
  }, note.title), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      marginTop: 1
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      color: 'var(--tx-2)',
      fontFamily: 'var(--mono)'
    }
  }, note.provName), note.orgName && /*#__PURE__*/React.createElement("span", {
    className: "tag tag-blue",
    style: {
      fontSize: 7.5,
      padding: '1px 5px'
    }
  }, note.orgName)))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 4
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "tag tag-purple",
    style: {
      fontSize: 8
    }
  }, "NOTE"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 9,
      color: 'var(--tx-3)',
      fontFamily: 'var(--mono)'
    }
  }, pdTimeAgo(note.ts)))), note.content && /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12,
      color: 'var(--tx-1)',
      lineHeight: 1.5,
      overflow: 'hidden',
      display: '-webkit-box',
      WebkitLineClamp: 2,
      WebkitBoxOrient: 'vertical'
    }
  }, note.content), note.tags && note.tags.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 3,
      marginTop: 6,
      flexWrap: 'wrap'
    }
  }, note.tags.map((t, ti) => /*#__PURE__*/React.createElement("span", {
    key: ti,
    className: "note-tag-chip"
  }, t.displayName || t))))), observations.slice(-3).reverse().map((obs, i) => {
    const prompt = DEFAULT_PROMPTS.find(p => p.key === obs.category);
    const optLabel = prompt?.options.find(o => o.v === obs.value)?.l || obs.value;
    return /*#__PURE__*/React.createElement("div", {
      key: obs.id || `obs-${i}`,
      className: "pd-content-card"
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 28,
        height: 28,
        borderRadius: '50%',
        background: 'var(--blue-dim)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--blue)',
        flexShrink: 0
      }
    }, /*#__PURE__*/React.createElement(I, {
      n: "clipboard",
      s: 13
    })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12.5,
        fontWeight: 600
      }
    }, prompt?.question || obs.category), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12,
        color: 'var(--tx-1)',
        display: 'block',
        marginTop: 1
      }
    }, optLabel))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 4
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "tag tag-teal",
      style: {
        fontSize: 8
      }
    }, "GIVEN"), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 9,
        color: 'var(--tx-3)',
        fontFamily: 'var(--mono)'
      }
    }, obs.date || ''))));
  }))), /*#__PURE__*/React.createElement("div", {
    className: "pd-section"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pd-section-hdr"
  }, /*#__PURE__*/React.createElement("h3", null, /*#__PURE__*/React.createElement(I, {
    n: "layers",
    s: 16,
    c: "var(--green)"
  }), " Resources Shared With Me"), myResources.length > 0 && /*#__PURE__*/React.createElement("button", {
    onClick: () => onNavigate('resources'),
    className: "b-gho b-xs"
  }, "View All (", myResources.length, ")")), myResources.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "pd-empty"
  }, /*#__PURE__*/React.createElement(I, {
    n: "layers",
    s: 28,
    c: "var(--tx-3)"
  }), /*#__PURE__*/React.createElement("p", {
    style: {
      marginTop: 8,
      fontSize: 12
    }
  }, "No resources allocated yet."), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 11,
      marginTop: 4
    }
  }, "When providers allocate vouchers, services, or other resources, they will appear here.")) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))',
      gap: 8,
      marginBottom: 12
    }
  }, [{
    l: 'Active',
    v: myResources.filter(r => r.status === 'active').length,
    c: 'green'
  }, {
    l: 'Used',
    v: myResources.filter(r => r.status === 'consumed').length,
    c: 'blue'
  }, {
    l: 'Expired',
    v: myResources.filter(r => r.status === 'expired').length,
    c: 'orange'
  }].map((s, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "card",
    style: {
      padding: '10px 12px'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label",
    style: {
      marginBottom: 0
    }
  }, s.l.toUpperCase()), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 16,
      fontWeight: 700,
      color: `var(--${s.c})`,
      display: 'block',
      marginTop: 2
    }
  }, s.v)))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6
    }
  }, myResources.slice(0, 5).map((alloc, i) => {
    const statusColors = {
      active: 'teal',
      consumed: 'blue',
      expired: 'orange',
      revoked: 'red'
    };
    return /*#__PURE__*/React.createElement("div", {
      key: alloc.allocation_id || i,
      className: "pd-res-card"
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 10
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 28,
        height: 28,
        borderRadius: '50%',
        background: 'var(--green-dim)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--green)',
        flexShrink: 0
      }
    }, /*#__PURE__*/React.createElement(I, {
      n: "layers",
      s: 13
    })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12.5,
        fontWeight: 600
      }
    }, alloc.resource_name || alloc.resource_type_id), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        marginTop: 2
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 10.5,
        color: 'var(--tx-2)',
        fontFamily: 'var(--mono)'
      }
    }, "x", alloc.quantity, " ", alloc.unit || ''), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 9,
        color: 'var(--tx-3)',
        fontFamily: 'var(--mono)'
      }
    }, alloc.org_display_name || alloc.provider_display_name || '')))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 4
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: `tag tag-${statusColors[alloc.status] || 'teal'}`,
      style: {
        fontSize: 8.5
      }
    }, (alloc.status || 'active').toUpperCase()), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 9,
        color: 'var(--tx-3)',
        fontFamily: 'var(--mono)'
      }
    }, alloc.allocated_at ? pdTimeAgo(alloc.allocated_at) : '')));
  })))), /*#__PURE__*/React.createElement("div", {
    className: "pd-section"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pd-section-hdr"
  }, /*#__PURE__*/React.createElement("h3", null, /*#__PURE__*/React.createElement(I, {
    n: "bell",
    s: 16,
    c: "var(--orange)"
  }), " Activity Feed"), /*#__PURE__*/React.createElement("button", {
    onClick: loadBridgeActivity,
    className: "b-gho b-xs",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 4
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "refresh-cw",
    s: 11
  }), "Refresh")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 4,
      marginBottom: 14,
      flexWrap: 'wrap'
    }
  }, [{
    id: 'all',
    label: 'All'
  }, {
    id: 'notes',
    label: 'Notes'
  }, {
    id: 'resources',
    label: 'Resources'
  }, {
    id: 'messages',
    label: 'Messages'
  }, {
    id: 'fields',
    label: 'Field Updates'
  }, {
    id: 'observations',
    label: 'Observations'
  }].map(f => /*#__PURE__*/React.createElement("button", {
    key: f.id,
    onClick: () => setEventFilter(f.id),
    style: {
      padding: '5px 12px',
      borderRadius: 14,
      fontSize: 11,
      fontWeight: 600,
      cursor: 'pointer',
      border: '1px solid',
      transition: 'all .15s',
      fontFamily: 'var(--sans)',
      background: eventFilter === f.id ? 'var(--gold-dim)' : 'transparent',
      color: eventFilter === f.id ? 'var(--gold)' : 'var(--tx-2)',
      borderColor: eventFilter === f.id ? 'var(--gold)' : 'var(--border-1)'
    }
  }, f.label, eventFilter === f.id && filteredEvents.length > 0 ? ` (${filteredEvents.length})` : ''))), filteredEvents.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "pd-empty"
  }, /*#__PURE__*/React.createElement(I, {
    n: "bell",
    s: 28,
    c: "var(--tx-3)"
  }), /*#__PURE__*/React.createElement("p", {
    style: {
      marginTop: 8,
      fontSize: 12
    }
  }, "No activity yet", eventFilter !== 'all' ? ' in this category' : '', "."), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 11,
      marginTop: 4
    }
  }, "Updates from your providers will stream here in real time.")) : /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6
    }
  }, filteredEvents.slice(0, eventLimit).map(evt => /*#__PURE__*/React.createElement("div", {
    key: evt.id,
    className: "pd-event"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pd-event-icon",
    style: {
      background: evt.iconBg,
      color: evt.iconColor
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: evt.icon,
    s: 14
  })), /*#__PURE__*/React.createElement("div", {
    className: "pd-event-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pd-event-title"
  }, evt.title), /*#__PURE__*/React.createElement("div", {
    className: "pd-event-desc"
  }, evt.desc), /*#__PURE__*/React.createElement("div", {
    className: "pd-event-meta"
  }, evt.tags?.map((t, ti) => /*#__PURE__*/React.createElement("span", {
    key: ti,
    className: `tag ${t.cls}`,
    style: {
      fontSize: 8,
      padding: '1px 6px'
    }
  }, t.label)), evt.orgName && /*#__PURE__*/React.createElement("span", {
    className: "tag tag-blue",
    style: {
      fontSize: 7.5,
      padding: '1px 5px'
    }
  }, evt.orgName), /*#__PURE__*/React.createElement("span", {
    className: "pd-event-time"
  }, pdTimeAgo(evt.ts)))))), filteredEvents.length > eventLimit && /*#__PURE__*/React.createElement("button", {
    onClick: () => setEventLimit(l => l + 25),
    className: "b-gho b-sm",
    style: {
      alignSelf: 'center',
      marginTop: 8
    }
  }, "Load more (", filteredEvents.length - eventLimit, " remaining)"))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--teal-dim)',
      border: '1px solid rgba(62,201,176,.15)',
      borderRadius: 'var(--r)',
      padding: '14px 18px',
      display: 'flex',
      gap: 10,
      alignItems: 'flex-start',
      marginTop: 8
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "shield",
    s: 16,
    c: "var(--teal)"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: 'var(--tx-1)',
      lineHeight: 1.6
    }
  }, /*#__PURE__*/React.createElement("strong", {
    style: {
      color: 'var(--teal)'
    }
  }, "Your data, your control."), " All content shown here is encrypted in your vault and bridge rooms. You control which providers see what, and can revoke access at any time.")));
};

/* ═══════════════════ CLIENT APP ═══════════════════ */
const ClientApp = ({
  session,
  onLogout,
  showToast,
  availableContexts,
  activeContext,
  onSwitchContext
}) => {
  const [vaultRoom, setVaultRoom] = useState(null);
  const [schemaRoom, setSchemaRoom] = useState(null);
  const [vaultData, setVaultData] = useState({});
  const [observations, setObservations] = useState([]);
  const [metricsConsent, setMetricsConsent] = useState({
    enabled: false,
    categories: []
  });
  const [providers, setProviders] = useState([]);
  const [view, setView] = useState('dashboard');
  const [activeBridge, setActiveBridge] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editModal, setEditModal] = useState(false);
  const [editData, setEditData] = useState({});
  const [addProviderModal, setAddProviderModal] = useState(false);
  const [newProviderId, setNewProviderId] = useState('');
  const [bridgeMessages, setBridgeMessages] = useState([]);
  const [msgText, setMsgText] = useState('');
  // Inbox chat state
  const [inboxConvo, setInboxConvo] = useState(null); // provider index for active inbox conversation
  const [inboxMessages, setInboxMessages] = useState([]);
  const [inboxMsgText, setInboxMsgText] = useState('');
  const [inboxTab, setInboxTab] = useState('providers'); // 'providers' | 'team'
  // ─── Team member DM state (client-side) ───
  const [clientTeamDMs, setClientTeamDMs] = useState([]); // [{roomId, peerId, peerName, teamName, peerType}]
  const [newTeamDMModal, setNewTeamDMModal] = useState(false);
  const [newDMTarget, setNewDMTarget] = useState(null);
  const [hardRevokeTarget, setHardRevokeTarget] = useState(null);
  const [obsModal, setObsModal] = useState(null); // prompt object or null
  const [obsValue, setObsValue] = useState('');
  const [obsDate, setObsDate] = useState(new Date().toISOString().slice(0, 10));
  const [obsFreeText, setObsFreeText] = useState('');
  const [provenanceTarget, setProvenanceTarget] = useState(null); // {entityKey, label, roomId} or null — toggles inline provenance panel
  const [initError, setInitError] = useState(null);
  const [claimedRooms, setClaimedRooms] = useState([]);
  const [pendingClaims, setPendingClaims] = useState([]);
  const [customFieldDefs, setCustomFieldDefs] = useState([]); // [{key,label,category,sensitive}]
  const [addFieldModal, setAddFieldModal] = useState(false);
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldCategory, setNewFieldCategory] = useState('details');
  const [newFieldSensitive, setNewFieldSensitive] = useState(false);
  const [newFieldDefinition, setNewFieldDefinition] = useState('');
  const [enabledFrameworks, setEnabledFrameworks] = useState([]); // framework ids toggled on
  const [frameworkModal, setFrameworkModal] = useState(false);
  const [myTeams, setMyTeams] = useState([]);
  const [clientSharingConsentModal, setClientSharingConsentModal] = useState(null); // {team} — prompts client team member to choose sharing preference
  const [myResources, setMyResources] = useState([]); // resource vault records from bridges
  const isMobile = useIsMobile();
  // Contact sharing state
  const [shareContactModal, setShareContactModal] = useState(false);
  const [copiedField, setCopiedField] = useState(null);

  useEffect(() => {
    initVault();
  }, []);

  // Framework-derived fields from enabled standards
  const frameworkFields = useMemo(() => getFrameworkFields(enabledFrameworks), [enabledFrameworks]);

  // Merge built-in fields + custom fields + framework fields
  const allFields = useMemo(() => [...VAULT_FIELDS, ...customFieldDefs, ...frameworkFields], [customFieldDefs, frameworkFields]);
  const allCategories = useMemo(() => {
    const cats = [...FIELD_CATEGORIES];
    for (const f of [...customFieldDefs, ...frameworkFields]) {
      if (!cats.includes(f.category)) cats.push(f.category);
    }
    return cats;
  }, [customFieldDefs, frameworkFields]);

  // ─── Contact sharing helpers ───
  const getContactText = () => {
    const lines = [];
    if (vaultData.full_name) lines.push(vaultData.full_name);
    if (vaultData.email) lines.push(vaultData.email);
    if (vaultData.phone) lines.push(vaultData.phone);
    lines.push('');
    lines.push('Khora ID: ' + svc.userId);
    return lines.join('\n');
  };
  const copyContact = async () => {
    try {
      await navigator.clipboard.writeText(getContactText());
      setCopiedField('contact');
      setTimeout(() => setCopiedField(null), 2000);
    } catch { showToast('Copy failed — please select and copy manually', 'warn'); }
  };
  const shareContactViaEmail = () => {
    const subject = encodeURIComponent('My contact details');
    const body = encodeURIComponent(getContactText());
    window.open('mailto:?subject=' + subject + '&body=' + body, '_self');
  };
  const shareContactViaSMS = () => {
    const body = encodeURIComponent(getContactText());
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    window.open('sms:' + (isIOS ? '&' : '?') + 'body=' + body, '_self');
  };

  // INS(vault.custom_field_def, {user_defined}) — schema_extension — client creates custom vault field
  const handleAddCustomField = async () => {
    const label = newFieldLabel.trim();
    const definition = newFieldDefinition.trim();
    if (!label) return;
    if (definition.length < 20) {
      showToast('Definition must be at least 20 characters', 'error');
      return;
    }
    const key = 'custom_' + label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    if (allFields.some(f => f.key === key)) {
      showToast('A field with that name already exists', 'error');
      return;
    }
    const def = {
      key,
      label,
      category: newFieldCategory,
      sensitive: newFieldSensitive,
      custom: true,
      definition
    };
    const updated = [...customFieldDefs, def];
    await emitOp(vaultRoom, 'INS', dot('vault', 'custom_field_def', key), {
      label,
      category: newFieldCategory,
      sensitive: newFieldSensitive,
      definition
    }, vaultFrame());
    await saveSnapshot(undefined, undefined, undefined, updated);
    setAddFieldModal(false);
    setNewFieldLabel('');
    setNewFieldCategory('details');
    setNewFieldSensitive(false);
    setNewFieldDefinition('');
    showToast(`Custom field "${label}" created`, 'success');
  };

  // NUL(vault.custom_field, {reason: client_deleted}) — schema_retraction — removes field definition and data
  const handleDeleteCustomField = async fieldKey => {
    const updated = customFieldDefs.filter(f => f.key !== fieldKey);
    const updatedData = {
      ...vaultData
    };
    delete updatedData[fieldKey];
    await emitOp(vaultRoom, 'NUL', dot('vault', 'custom_field_def', fieldKey), {
      reason: 'client_deleted'
    }, vaultFrame());
    await saveSnapshot(updatedData, undefined, undefined, updated);
    showToast('Custom field removed', 'warn');
  };
  const vaultFrame = room => ({
    type: 'vault',
    room: room || vaultRoom,
    role: 'client',
    epistemic: 'GIVEN'
  });
  const bridgeFrame = room => ({
    type: 'bridge',
    room,
    role: 'client',
    epistemic: 'MEANT'
  });

  // INS(vault.room, {identity, snapshot, schema}) — sovereign_creation — creates the client's entire data sovereignty container
  // Operator Manifest for initVault:
  //   INS(vault.room, {identity, snapshot}) — sovereign_creation — if no vault exists
  //   DES(vault.schema_catalog, {forms, definitions}) — canonical_vocabulary — seeds personal schema
  //   CON(vault.auto_join, {invited_rooms}) — client_record_claim — joins pending invites
  //   No REC — vault frame is client-sovereign and stable.
  const initVault = async () => {
    setLoading(true);
    setInitError(null);
    try {
      // Phase 1: Auto-join any invited client_record rooms so they appear in scanRooms.
      // Safety: only join rooms that were explicitly created for this user (client_matrix_id match)
      // AND have a valid owner set. Rooms are shown as "pending" until the client manually claims them.
      try {
        const invited = await svc.scanInvitedRooms([EVT.IDENTITY]);
        for (const [rid, state] of Object.entries(invited)) {
          const id = state[EVT.IDENTITY];
          if (id?.account_type === 'client_record' && id.client_matrix_id === svc.userId && id.owner) {
            try {
              await svc.joinRoom(rid);
            } catch (e) {
              console.warn('Auto-join failed for', rid, e.message);
            }
          }
        }
      } catch (e) {
        console.warn('Invited room scan failed:', e.message);
      }

      // Phase 2: Scan joined rooms (now includes any rooms we just auto-joined)
      const scanned = await svc.scanRooms([EVT.PROVIDER_PROFILE, EVT.TEAM_META, EVT.TEAM_MEMBERS, EVT.FIELD_DEF, EVT.DM_META]);
      let vault = null,
        schema = null;
      const detectedPending = [],
        detectedClaimed = [];
      const bridgeProfiles = {}; // bridgeRoomId → provider profile
      const detectedTeams = [];
      for (const [rid, state] of Object.entries(scanned)) {
        const id = state[EVT.IDENTITY];
        if (id?.account_type === 'client' && id.owner === svc.userId) vault = rid;
        if (id?.account_type === 'schema' && id.owner === svc.userId) schema = rid;
        // Detect client_record rooms where this client was invited or has claimed
        if (id?.account_type === 'client_record' && id.client_matrix_id === svc.userId) {
          if (id.status === 'claimed' && id.owner === svc.userId) {
            detectedClaimed.push({
              roomId: rid,
              ...id
            });
          } else {
            detectedPending.push({
              roomId: rid,
              ...id
            });
          }
        }
        // Detect team rooms the individual belongs to
        if (id?.account_type === 'team') {
          const teamMeta = state[EVT.TEAM_META] || {};
          const teamMembers = state[EVT.TEAM_MEMBERS] || {
            members: []
          };
          detectedTeams.push({
            roomId: rid,
            ...teamMeta,
            members: teamMembers.members || []
          });
        }
        // Collect provider profiles and bridge metadata from bridge rooms
        const bridgeMeta = state[EVT.BRIDGE_META];
        const provProfile = state[EVT.PROVIDER_PROFILE];
        if (bridgeMeta && bridgeMeta.client === svc.userId) {
          if (provProfile) bridgeProfiles[rid] = provProfile;
          // Track transferable and org_id from bridge meta
          bridgeProfiles[rid] = {
            ...(bridgeProfiles[rid] || {}),
            _bridgeMeta: bridgeMeta
          };
        }
      }
      if (!vault) {
        vault = await svc.createRoom('[Khora Vault]', 'Personal data vault', [{
          type: EVT.IDENTITY,
          state_key: '',
          content: {
            account_type: 'client',
            owner: svc.userId,
            created: Date.now(),
            created_by: svc.userId,
            origin_server: extractHomeserver(svc.userId)
          }
        }, {
          type: EVT.VAULT_SNAPSHOT,
          state_key: '',
          content: {
            fields: {},
            observations: [],
            metrics_consent: {
              enabled: false,
              categories: []
            },
            matching_consent: {
              enabled: false,
              layers: [],
              network_id: null,
              last_token_ts: null
            },
            custom_field_defs: [],
            enabled_frameworks: [],
            created_by: svc.userId,
            origin_server: extractHomeserver(svc.userId),
            last_modified_by: svc.userId,
            last_modified_at: Date.now()
          }
        }, {
          type: EVT.VAULT_PROVIDERS,
          state_key: '',
          content: {
            providers: []
          }
        }]);
        showToast('Vault created — encrypted room ready', 'success');
      }
      if (!schema) {
        schema = await svc.createRoom('[Khora Schema]', 'Schema definitions', [{
          type: EVT.IDENTITY,
          state_key: '',
          content: {
            account_type: 'schema',
            owner: svc.userId,
            created: Date.now()
          }
        }]);
        const allSeeds = [
        // Forms — GIVEN data collection instruments
        ...DEFAULT_FORMS.map(f => () => svc.setState(schema, EVT.SCHEMA_FORM, f, f.id)), ...DEFAULT_PROMPTS.map(p => () => svc.setState(schema, EVT.SCHEMA_PROMPT, p, p.key)),
        // Interpretations — MEANT frameworks
        ...DEFAULT_DEFINITIONS.map(d => () => svc.setState(schema, EVT.SCHEMA_DEF, d, d.key)), ...DEFAULT_AUTHORITIES.map(a => () => svc.setState(schema, EVT.SCHEMA_AUTHORITY, a, a.id)), [() => svc.setState(schema, EVT.SCHEMA_TRANSFORM, {
          id: 'transform_default',
          transforms: DEFAULT_TRANSFORMS
        }, 'default')]].flat();
        for (let i = 0; i < allSeeds.length; i++) {
          await allSeeds[i]();
          if (i % 3 === 2) await new Promise(r => setTimeout(r, 200));
        }
      }
      setVaultRoom(vault);
      setSchemaRoom(schema);
      await loadVault(vault, bridgeProfiles);
      setPendingClaims(detectedPending);
      setClaimedRooms(detectedClaimed);
      if (detectedTeams.length > 0) setMyTeams(detectedTeams.map((t, i) => ({
        ...t,
        color_hue: getLocalTeamColor(svc.userId, t.roomId, t.color_hue != null ? t.color_hue : distinctTeamHue(i))
      })));
      // Detect existing DM rooms (client side)
      const detectedClientDMs = [];
      for (const [rid, state] of Object.entries(scanned)) {
        const dmMeta = state[EVT.DM_META];
        if (dmMeta && (dmMeta.initiator === svc.userId || dmMeta.target === svc.userId)) {
          const peerId = dmMeta.initiator === svc.userId ? dmMeta.target : dmMeta.initiator;
          detectedClientDMs.push({
            roomId: rid,
            peerId,
            peerName: dmMeta.peer_names?.[peerId] || peerId,
            teamName: dmMeta.team_name || null,
            teamRoomId: dmMeta.team_room_id || null,
            peerType: dmMeta.peer_type || 'provider'
          });
        }
      }
      if (detectedClientDMs.length > 0) setClientTeamDMs(detectedClientDMs);
    } catch (e) {
      console.error('Vault init failed:', e);
      setInitError(e.message || 'Failed to initialize vault.');
    }
    setLoading(false);
  };
  const loadVault = async (rid, bridgeProfiles) => {
    const snap = await svc.getState(rid, EVT.VAULT_SNAPSHOT);
    setVaultData(snap?.fields || {});
    setObservations(snap?.observations || []);
    setMetricsConsent(snap?.metrics_consent || {
      enabled: false,
      categories: []
    });
    setCustomFieldDefs(snap?.custom_field_defs || []);
    setEnabledFrameworks(snap?.enabled_frameworks || []);
    const idx = await svc.getState(rid, EVT.VAULT_PROVIDERS);
    // Enrich providers with profile data and bridge meta from bridge rooms
    const enrichedProviders = (idx?.providers || []).map(p => {
      const profile = bridgeProfiles?.[p.bridgeRoomId];
      if (!profile) return p;
      const bm = profile._bridgeMeta;
      const clean = {
        ...profile
      };
      delete clean._bridgeMeta;
      return {
        ...p,
        providerProfile: clean.display_name ? clean : p.providerProfile,
        providerName: clean.display_name || p.providerName,
        transferable: bm?.transferable !== false ? true : false,
        org_id: bm?.org_id || p.org_id || null,
        assigned_staff: bm?.assigned_staff || [p.providerUserId]
      };
    });
    setProviders(enrichedProviders);
    // Load resource records from vault and bridge rooms
    const resources = [];
    if (svc.client) {
      // Load from vault shadow records
      const vRoom = svc.client.getRoom(rid);
      if (vRoom) {
        const vaultResEvents = vRoom.currentState.getStateEvents(EVT.RESOURCE_VAULT);
        if (vaultResEvents) {
          const evArr = Array.isArray(vaultResEvents) ? vaultResEvents : [vaultResEvents];
          for (const ev of evArr) {
            const c = ev.getContent ? ev.getContent() : ev;
            if (c && c.allocation_id) resources.push(c);
          }
        }
      }
      // Also load from bridge rooms directly (bridge is source of truth)
      for (const p of enrichedProviders) {
        const bRoom = svc.client.getRoom(p.bridgeRoomId);
        if (!bRoom) continue;
        const allocEvents = bRoom.currentState.getStateEvents(EVT.RESOURCE_ALLOC);
        if (!allocEvents) continue;
        const evArr = Array.isArray(allocEvents) ? allocEvents : [allocEvents];
        for (const ev of evArr) {
          const c = ev.getContent ? ev.getContent() : ev;
          if (c && c.id && !resources.find(r => r.allocation_id === c.id)) {
            resources.push({
              allocation_id: c.id,
              resource_type_id: c.resource_type_id,
              resource_name: c.resource_type_id,
              // will be overridden by vault shadow if available
              quantity: c.quantity,
              unit: c.unit,
              provider_display_name: c.allocated_by,
              org_display_name: c.org_id || '',
              allocated_at: c.allocated_at,
              status: c.status,
              notes: c.notes,
              bridge_room_id: p.bridgeRoomId,
              _provider_name: p.providerName || p.providerUserId
            });
          }
        }
      }
    }
    setMyResources(resources);
  };

  // ALT(vault.snapshot, {updated_fields}) — atomic_persistence — single state write for all vault data
  const saveSnapshot = async (fields, obs, mc, cfd, ef) => {
    const snapshot = {
      fields: fields ?? vaultData,
      observations: obs ?? observations,
      metrics_consent: mc ?? metricsConsent,
      custom_field_defs: cfd ?? customFieldDefs,
      enabled_frameworks: ef ?? enabledFrameworks,
      last_modified_by: svc.userId,
      last_modified_at: Date.now(),
      origin_server: extractHomeserver(svc.userId)
    };
    await svc.setState(vaultRoom, EVT.VAULT_SNAPSHOT, snapshot);
    setVaultData(snapshot.fields);
    setObservations(snapshot.observations);
    setMetricsConsent(snapshot.metrics_consent);
    setCustomFieldDefs(snapshot.custom_field_defs);
    setEnabledFrameworks(snapshot.enabled_frameworks);
  };
  const saveProviderIndex = async provs => {
    await svc.setState(vaultRoom, EVT.VAULT_PROVIDERS, {
      providers: provs
    });
    setProviders(provs);
  };

  // Edit identity fields — emits INS, ALT, or NUL per field depending on change type
  // INS(vault.field.value, {source: client_input}) — vault_population — new field
  // ALT(vault.field.value, {from: old, to: new}) — vault_update — changed field
  // NUL(vault.field.value, {reason: client_cleared}) — vault_clearance — cleared field
  const handleEditSave = async () => {
    const updated = {
      ...vaultData,
      ...editData
    };
    for (const [key, val] of Object.entries(editData)) {
      if (val && !vaultData[key]) {
        // INS — field first populated
        await emitOp(vaultRoom, 'INS', dot('vault', 'fields', key), {
          value: val,
          source: 'client_input'
        }, vaultFrame());
      } else if (val && vaultData[key] && val !== vaultData[key]) {
        // ALT — value change within stable frame
        await emitOp(vaultRoom, 'ALT', dot('vault', 'client_profile', key), {
          from: vaultData[key],
          to: val,
          source: 'client_input'
        }, vaultFrame());
      } else if (!val && vaultData[key]) {
        // NUL — existence removal
        await emitOp(vaultRoom, 'NUL', dot('vault', 'client_profile', key), {
          reason: 'client_cleared',
          previous_value: vaultData[key]
        }, vaultFrame());
      }
    }
    await saveSnapshot(updated);
    setEditModal(false);
    showToast('Vault updated', 'success');
    // Propagate to bridges (§8.3)
    for (const prov of providers) {
      const changedShared = Object.keys(editData).filter(k => prov.sharedFields?.[k]);
      if (changedShared.length > 0) await syncFieldsToBridge(prov.bridgeRoomId, prov.sharedFields, updated);
    }
  };

  // INS(vault.observation, {source: client_report}) — GIVEN_attestation — this is the GIVEN entry point
  // If metrics consent enabled: → SYN(metrics.observation+anon_demographics, {via: cohort_hash}) — metric_emission
  const handleRecordObservation = async () => {
    if (!obsValue || !obsModal) return;
    const obs = {
      id: genOpId(),
      category: obsModal.key,
      value: obsValue,
      date: obsDate,
      prompt_id: obsModal.id,
      schema_version: obsModal.version || 1,
      free_text: obsFreeText || undefined,
      ts: Date.now(),
      created_by: svc.userId,
      origin_server: extractHomeserver(svc.userId)
    };
    await emitOp(vaultRoom, 'INS', dot('vault', 'observations', obsModal.key), {
      value: obsValue,
      date: obsDate,
      reported_by: 'client',
      method: 'self_report',
      prompt: obsModal.question,
      free_text: obsFreeText || undefined
    }, vaultFrame());
    const newObs = [...observations, obs];
    await saveSnapshot(undefined, newObs);
    setObsModal(null);
    setObsValue('');
    setObsFreeText('');
    showToast(`Observation recorded: ${obsModal.question}`, 'success');
    // Emit to metrics if consent
    if (metricsConsent.enabled && obsModal.metrics && metricsConsent.categories?.includes(obsModal.category)) {
      for (const prov of providers) {
        if (prov.metricsRoom) {
          await emitMetric(prov.metricsRoom, svc.userId, {
            category: obsModal.key,
            value: obsValue,
            date_bucket: `${obsDate.slice(0, 7)}`
          }, vaultData);
        }
      }
    }
  };

  // CON(vault.providers.{id}, {bridge_room, initiated_by: client}) — relationship_establishment + INS(bridge.room, {e2ee, meta, refs}) — secure_channel
  const handleAddProvider = async () => {
    if (!newProviderId.trim()) return;
    if (!isValidMatrixId(newProviderId)) {
      showToast('Invalid Matrix ID — use format @user:server', 'error');
      return;
    }
    if (providers.find(p => p.providerUserId === newProviderId.trim())) {
      showToast('Already connected to this provider', 'info');
      return;
    }
    try {
      const bridgeId = await svc.createRoom(`[Khora Bridge] ${svc.userId} ↔ ${newProviderId}`, 'Khora bridge — shared data room', [{
        type: EVT.BRIDGE_META,
        state_key: '',
        content: {
          client: svc.userId,
          provider: newProviderId,
          relationship_type: RELATIONSHIP_TYPES.client_provider.id,
          created: Date.now(),
          status: 'active',
          transferable: true,
          org_id: null,
          assigned_staff: [newProviderId],
          created_by: svc.userId,
          origin_server: extractHomeserver(svc.userId)
        }
      }, {
        type: EVT.BRIDGE_REFS,
        state_key: '',
        content: {
          fields: {}
        }
      }]);
      await svc.invite(bridgeId, newProviderId);
      await emitOp(vaultRoom, 'CON', dot('vault', 'providers', newProviderId), {
        relationship: RELATIONSHIP_TYPES.client_provider.id,
        bridge_room: bridgeId,
        initiated_by: 'client'
      }, vaultFrame());
      const newProv = {
        bridgeRoomId: bridgeId,
        providerUserId: newProviderId,
        sharedFields: {},
        providerName: newProviderId,
        transferable: true
      };
      await saveProviderIndex([...providers, newProv]);
      setAddProviderModal(false);
      setNewProviderId('');
      showToast(`Bridge created — invite sent to ${newProviderId}`, 'success');
    } catch (e) {
      showToast('Failed: ' + e.message, 'error');
    }
  };

  // ALT(bridge.refs, {re_encrypted_fields}) — selective_sync — encrypts shared fields with fresh keys
  const syncFieldsToBridge = async (bridgeRoomId, sharedFields, data) => {
    const refs = {};
    for (const [fk, shared] of Object.entries(sharedFields)) {
      if (shared && data[fk]) {
        const keyB64 = await FieldCrypto.generateKey();
        const enc = await FieldCrypto.encrypt(data[fk], keyB64);
        refs[fk] = {
          ...enc,
          key: keyB64
        };
      }
    }
    await svc.setState(bridgeRoomId, EVT.BRIDGE_REFS, {
      fields: refs,
      updated: Date.now()
    });
  };

  // SEG(bridge.field_visibility, {state: shared|revoked}) — access_partitioning — key rotation on each toggle
  const handleToggleField = async (pi, fk) => {
    const prov = providers[pi];
    const newShared = {
      ...prov.sharedFields,
      [fk]: !prov.sharedFields[fk]
    };
    const ups = [...providers];
    ups[pi] = {
      ...prov,
      sharedFields: newShared
    };
    await saveProviderIndex(ups);
    await emitOp(prov.bridgeRoomId, 'SEG', dot('bridge', 'fields', fk), {
      visibility: newShared[fk] ? 'shared' : 'revoked',
      provider: prov.providerUserId
    }, bridgeFrame(prov.bridgeRoomId), newShared[fk] ? [] : [`prev_seg_${fk}`]);
    await syncFieldsToBridge(prov.bridgeRoomId, newShared, vaultData);
    const label = allFields.find(f => f.key === fk)?.label || fk;
    showToast(newShared[fk] ? `Shared ${label} — new key issued` : `Revoked ${label} — key destroyed`, newShared[fk] ? 'success' : 'warn');
  };

  // ALT(bridge.transferable, {boolean_flip}) — transferability_policy
  // Toggle whether this client allows their case to be transferred between providers within the org
  const handleToggleTransferable = async pi => {
    const prov = providers[pi];
    const newVal = !prov.transferable;
    try {
      // Update bridge meta (client has PL 100 — full control)
      const currentMeta = await svc.getState(prov.bridgeRoomId, EVT.BRIDGE_META);
      await svc.setState(prov.bridgeRoomId, EVT.BRIDGE_META, {
        ...currentMeta,
        transferable: newVal
      });
      await emitOp(prov.bridgeRoomId, 'ALT', dot('bridge', 'transferable'), {
        value: newVal,
        reason: newVal ? 'client_enabled_transfer' : 'client_disabled_transfer'
      }, bridgeFrame(prov.bridgeRoomId));
      // Update local provider index
      const ups = [...providers];
      ups[pi] = {
        ...prov,
        transferable: newVal
      };
      await saveProviderIndex(ups);
      showToast(newVal ? 'Provider transfer allowed — org can reassign your case' : 'Provider transfer blocked — only this provider can access your bridge', newVal ? 'success' : 'warn');
    } catch (e) {
      showToast('Failed to update transfer setting: ' + e.message, 'error');
    }
  };

  // ⚠️ HIGHEST-RISK VAULT OPERATION: NUL(bridge.old, {}) → INS(bridge.new, {}) → CON(bridge.connection, {})
  // NUL(bridge.old, {reason: hard_revoke}) — relationship_destruction — tombstone old room
  // INS(bridge.new, {fresh_keys}) — clean_room — create replacement
  // CON(bridge.connection, {new_bridge, initiated_by: client}) — relationship_re_establishment — re-link
  // All old keys destroyed. All shared data re-encrypted with new keys.
  const handleHardRevoke = async pi => {
    const prov = providers[pi];
    try {
      // Step 1: Seal old bridge — emit NUL, tombstone, and kick provider BEFORE creating new bridge
      await emitOp(prov.bridgeRoomId, 'NUL', dot('bridge', 'relationship'), {
        reason: 'hard_revoke'
      }, bridgeFrame(prov.bridgeRoomId));
      // Step 2: Create new bridge with fresh keys
      const newBridgeId = await svc.createRoom(`[Khora Bridge] ${svc.userId} ↔ ${prov.providerUserId}`, 'Khora bridge — replaced', [{
        type: EVT.BRIDGE_META,
        state_key: '',
        content: {
          client: svc.userId,
          provider: prov.providerUserId,
          relationship_type: RELATIONSHIP_TYPES.client_provider.id,
          created: Date.now(),
          status: 'active',
          previous: prov.bridgeRoomId,
          transferable: prov.transferable !== false,
          org_id: null,
          assigned_staff: [prov.providerUserId],
          created_by: svc.userId,
          origin_server: extractHomeserver(svc.userId)
        }
      }, {
        type: EVT.BRIDGE_REFS,
        state_key: '',
        content: {
          fields: {}
        }
      }]);
      // Step 3: Tombstone old bridge (points to new) and kick provider from old
      await svc.tombstone(prov.bridgeRoomId, newBridgeId);
      try {
        await svc.kick(prov.bridgeRoomId, prov.providerUserId, 'Bridge rotated — data revoked');
      } catch {}
      // Step 4: Sync shared fields to new bridge and invite provider
      const stillShared = Object.fromEntries(Object.entries(prov.sharedFields).filter(([, v]) => v));
      if (Object.keys(stillShared).length > 0) await syncFieldsToBridge(newBridgeId, stillShared, vaultData);
      await svc.invite(newBridgeId, prov.providerUserId);
      await emitOp(newBridgeId, 'CON', dot('bridge', 'connection', prov.providerUserId), {
        relationship: RELATIONSHIP_TYPES.client_provider.id,
        bridge_room: newBridgeId,
        initiated_by: 'client',
        reason: 'hard_revoke_replacement'
      }, bridgeFrame(newBridgeId));
      const ups = [...providers];
      ups[pi] = {
        ...prov,
        bridgeRoomId: newBridgeId
      };
      await saveProviderIndex(ups);
      setHardRevokeTarget(null);
      showToast('Hard revoke complete — old room tombstoned, all keys rotated', 'success');
    } catch (e) {
      showToast('Hard revoke failed: ' + e.message, 'error');
    }
  };

  // NUL(vault.relationship, {reason: full_severance}) — permanent_disconnection — kicks provider, clears all refs
  const handleRemoveProvider = async pi => {
    const prov = providers[pi];
    try {
      try {
        await svc.kick(prov.bridgeRoomId, prov.providerUserId);
      } catch {}
      await svc.setState(prov.bridgeRoomId, EVT.BRIDGE_REFS, {
        fields: {},
        revoked: true,
        updated: Date.now()
      });
      await emitOp(vaultRoom, 'NUL', dot('vault', 'relationships', prov.providerUserId), {
        reason: 'full_severance',
        bridge: prov.bridgeRoomId
      }, vaultFrame());
      await saveProviderIndex(providers.filter((_, i) => i !== pi));
      showToast(`${ROLES.provider.label} removed, all keys destroyed`, 'warn');
    } catch (e) {
      showToast('Error: ' + e.message, 'error');
    }
  };

  // ─── Room claiming: client takes ownership of a provider-created client_record room ───
  const claimFrame = room => ({
    type: 'client_record',
    room,
    role: 'client',
    epistemic: 'GIVEN'
  });

  // ALT(room.ownership, {client_claim}) — sovereignty_transfer — client takes PL 100, previous owner drops to PL 50
  const handleClaimRoom = async record => {
    try {
      // 0. Ensure we've joined the room (required before writing state)
      try {
        await svc.joinRoom(record.roomId);
      } catch {}
      const prevIdentity = await svc.getState(record.roomId, EVT.IDENTITY);
      const previousOwner = prevIdentity?.owner || record.owner;
      // 1. Ensure client has PL 100 and provider drops to PL 50
      await svc.setPowerLevel(record.roomId, svc.userId, 100);
      if (previousOwner && previousOwner !== svc.userId) {
        await svc.setPowerLevel(record.roomId, previousOwner, 50);
      }
      // 2. Transfer ownership in identity state
      await svc.setState(record.roomId, EVT.IDENTITY, {
        ...prevIdentity,
        owner: svc.userId,
        status: 'claimed',
        claimed_at: Date.now(),
        claimed_by: svc.userId,
        previous_owner: previousOwner
      });
      // 3. Emit ALT operation recording the ownership transfer
      await emitOp(record.roomId, 'ALT', dot('room', 'ownership', 'owner'), {
        from: previousOwner,
        to: svc.userId,
        reason: 'client_claim'
      }, claimFrame(record.roomId));
      // 4. Move from pending to claimed
      setPendingClaims(prev => prev.filter(r => r.roomId !== record.roomId));
      setClaimedRooms(prev => [...prev, {
        ...record,
        owner: svc.userId,
        status: 'claimed',
        claimed_at: Date.now(),
        previous_owner: previousOwner
      }]);
      showToast(`Room claimed — you now have full control of "${record.client_name || 'this record'}"`, 'success');
    } catch (e) {
      showToast('Claim failed: ' + e.message, 'error');
    }
  };

  // NUL(room.member, {reason: owner_revocation}) — access_removal — kicks user from claimed room
  const handleRevokeFromClaimed = async (record, targetUserId) => {
    try {
      await svc.kick(record.roomId, targetUserId, 'Removed by room owner');
      await emitOp(record.roomId, 'NUL', dot('room', 'members', targetUserId), {
        reason: 'owner_revocation',
        removed_by: svc.userId
      }, claimFrame(record.roomId));
      showToast(`Removed ${targetUserId} from room`, 'warn');
    } catch (e) {
      showToast('Remove failed: ' + e.message, 'error');
    }
  };

  // NUL(room.client_record, {reason: owner_closed}) — permanent_decommission — tombstones room permanently
  const handleDeleteClaimedRoom = async record => {
    try {
      // Tombstone the room — marks it as permanently closed
      await svc.setState(record.roomId, 'm.room.tombstone', {
        body: 'This room has been closed by the owner'
      });
      await emitOp(record.roomId, 'NUL', dot('room', 'client_record', 'room'), {
        reason: 'owner_closed',
        closed_by: svc.userId
      }, claimFrame(record.roomId));
      setClaimedRooms(prev => prev.filter(r => r.roomId !== record.roomId));
      showToast('Room closed permanently', 'warn');
    } catch (e) {
      showToast('Close failed: ' + e.message, 'error');
    }
  };

  // ⚠️ REC(vault.metrics_consent, {state: enabled|disabled}) — data_flow_reinterpretation
  // INTERPRETATION SHIFT: changes what downstream systems receive. When enabled,
  // anonymized demographics flow to metrics rooms. When disabled, flow stops entirely.
  const handleMetricsToggle = async () => {
    const newConsent = {
      ...metricsConsent,
      enabled: !metricsConsent.enabled,
      categories: !metricsConsent.enabled ? DEFAULT_PROMPTS.filter(p => p.metrics).map(p => p.category) : []
    };
    await emitOp(vaultRoom, 'REC', dot('vault', 'consent', 'metrics'), {
      consent_level: newConsent.enabled ? 'anonymized_demographics' : 'none',
      categories: newConsent.categories
    }, vaultFrame());
    await saveSnapshot(undefined, undefined, newConsent);
    showToast(newConsent.enabled ? 'Metrics consent enabled — anonymized data will flow' : 'Metrics consent revoked', newConsent.enabled ? 'success' : 'warn');
  };

  // ⚠️ REC(vault.sharing_consent, {state: shared|withheld}) — visibility_reinterpretation
  // INTERPRETATION SHIFT: reinterprets what team members can see about individuals.
  // Handle sharing consent response — client-side team member proactively chooses whether to withhold content
  const handleClientSharingConsent = async (team, withhold) => {
    try {
      const consentValue = withhold ? 'withheld' : 'shared';
      const updatedMembers = (team.members || []).map(m => m.userId === svc.userId ? {
        ...m,
        sharing_consent: consentValue
      } : m);
      await svc.setState(team.roomId, EVT.TEAM_MEMBERS, {
        members: updatedMembers
      });
      await emitOp(team.roomId, 'REC', dot('org', 'consent', 'sharing', svc.userId), {
        consent: consentValue,
        decided_by: svc.userId
      }, vaultFrame());
      setMyTeams(prev => prev.map(t => t.roomId === team.roomId ? {
        ...t,
        members: updatedMembers
      } : t));
      setClientSharingConsentModal(null);
      if (withhold) {
        showToast('Content about individuals will not be shared with you in this team', 'warn');
      } else {
        showToast('Content about individuals may be shared with you in this team', 'success');
      }
    } catch (e) {
      showToast('Failed to save sharing preference: ' + e.message, 'error');
    }
  };
  const loadBridgeMessages = async bid => {
    setBridgeMessages(await svc.getMessages(bid));
  };
  const handleSendBridgeMsg = async () => {
    if (!msgText.trim() || !activeBridge) return;
    await svc.sendMessage(activeBridge, msgText, {
      [`${NS}.type`]: 'note'
    });
    await emitOp(activeBridge, 'INS', dot('bridge', 'messages', 'client_note'), {
      body: msgText
    }, bridgeFrame(activeBridge));
    setMsgText('');
    setTimeout(() => loadBridgeMessages(activeBridge), 500);
  };
  const openBridge = bid => {
    setActiveBridge(bid);
    setView('bridge');
    loadBridgeMessages(bid);
  };

  // ─── Inbox chat functions ───
  const loadInboxMessages = async bid => {
    setInboxMessages(await svc.getMessages(bid));
  };
  const openInboxConvo = providerIdxOrRoomId => {
    setInboxConvo(providerIdxOrRoomId);
    if (typeof providerIdxOrRoomId === 'number') {
      const prov = providers[providerIdxOrRoomId];
      if (prov) loadInboxMessages(prov.bridgeRoomId);
    } else if (typeof providerIdxOrRoomId === 'string') {
      loadInboxMessages(providerIdxOrRoomId);
    }
  };
  const handleSendInboxMsg = async () => {
    if (!inboxMsgText.trim() || inboxConvo === null) return;
    // Team DM (room ID string)
    if (typeof inboxConvo === 'string') {
      await svc.sendMessage(inboxConvo, inboxMsgText, {
        [`${NS}.type`]: 'team_dm'
      });
      setInboxMsgText('');
      setTimeout(() => loadInboxMessages(inboxConvo), 500);
      return;
    }
    // Provider bridge message (index number)
    const prov = providers[inboxConvo];
    if (!prov) return;
    await svc.sendMessage(prov.bridgeRoomId, inboxMsgText, {
      [`${NS}.type`]: 'note'
    });
    await emitOp(prov.bridgeRoomId, 'INS', dot('bridge', 'messages', 'client_note'), {
      body: inboxMsgText
    }, bridgeFrame(prov.bridgeRoomId));
    setInboxMsgText('');
    setTimeout(() => loadInboxMessages(prov.bridgeRoomId), 500);
  };
  // ─── Client-side team DM functions ───
  const startClientTeamDM = async (peerId, peerName, teamName, teamRoomId) => {
    const existing = clientTeamDMs.find(d => d.peerId === peerId);
    if (existing) {
      setInboxTab('team');
      openInboxConvo(existing.roomId);
      return;
    }
    try {
      const roomId = await svc.createRoom(`[Khora DM] ${svc.userId} ↔ ${peerId}`, 'Direct message between connected users', [{
        type: EVT.DM_META,
        state_key: '',
        content: {
          initiator: svc.userId,
          target: peerId,
          team_name: teamName || null,
          team_room_id: teamRoomId || null,
          peer_names: {
            [svc.userId]: vaultData.full_name || svc.userId,
            [peerId]: peerName || peerId
          },
          peer_type: 'provider',
          created: Date.now()
        }
      }]);
      await svc.invite(roomId, peerId);
      const newDM = { roomId, peerId, peerName: peerName || peerId, teamName: teamName || null, teamRoomId: teamRoomId || null, peerType: 'provider' };
      setClientTeamDMs(prev => [...prev, newDM]);
      setNewTeamDMModal(false);
      setNewDMTarget(null);
      setInboxTab('team');
      openInboxConvo(roomId);
      showToast(`DM created — invite sent to ${peerName || peerId}`, 'success');
    } catch (e) {
      showToast('Failed to create DM: ' + e.message, 'error');
    }
  };
  const clientTeamMemberContacts = useMemo(() => {
    const contacts = [];
    const seen = new Set();
    for (const team of myTeams) {
      for (const m of (team.members || [])) {
        if (m.userId === svc.userId || seen.has(m.userId)) continue;
        seen.add(m.userId);
        contacts.push({
          userId: m.userId,
          displayName: m.display_name || m.userId,
          teamName: team.name,
          teamRoomId: team.roomId,
          role: m.role,
          hasDM: clientTeamDMs.some(d => d.peerId === m.userId)
        });
      }
    }
    return contacts;
  }, [myTeams, clientTeamDMs]);
  const activeProviderIdx = providers.findIndex(p => p.bridgeRoomId === activeBridge);
  const activeProvider = activeProviderIdx >= 0 ? providers[activeProviderIdx] : null;
  const filledFields = allFields.filter(f => vaultData[f.key]);
  const sharedCount = providers.reduce((s, p) => s + Object.values(p.sharedFields || {}).filter(Boolean).length, 0);
  if (loading) return /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Spin, {
    s: 28
  }));
  if (initError) return /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      maxWidth: 400,
      padding: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 48,
      height: 48,
      borderRadius: 'var(--r-lg)',
      background: 'var(--red-dim)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--red)',
      margin: '0 auto 16px'
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "alert-triangle",
    s: 24
  })), /*#__PURE__*/React.createElement("h3", {
    style: {
      fontSize: 16,
      fontWeight: 700,
      marginBottom: 8
    }
  }, "Vault Setup Failed"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12.5,
      color: 'var(--tx-1)',
      lineHeight: 1.6,
      marginBottom: 16
    }
  }, initError), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: initVault,
    className: "b-pri"
  }, /*#__PURE__*/React.createElement(I, {
    n: "refresh-cw",
    s: 13
  }), "Retry"), /*#__PURE__*/React.createElement("button", {
    onClick: onLogout,
    className: "b-gho"
  }, "Sign Out"))));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      height: '100%'
    }
  },
  /* ─── Mobile Bottom Nav (client) ─── */
  isMobile && /*#__PURE__*/React.createElement(MobileBottomNav, {
    tabs: [
      { id: 'dashboard', icon: 'briefcase', label: 'Home' },
      { id: 'vault', icon: 'folder', label: 'Vault' },
      { id: 'inbox', icon: 'msg', label: 'Messages', badge: providers.length, badgeClass: 'nav-badge-teal' },
      { id: 'providers', icon: 'users', label: 'People' }
    ],
    activeView: activeBridge ? 'bridge' : view,
    onNavigate: id => { setView(id); setActiveBridge(null); },
    moreItems: [
      { id: 'observations', icon: 'clipboard', label: 'Observations' },
      { id: 'resources', icon: 'layers', label: 'My Resources' },
      { id: 'records', icon: 'shield', label: 'My Records', badge: pendingClaims.length, badgeClass: 'nav-badge-gold' },
      { id: 'activity', icon: 'layers', label: 'Activity Stream' },
      { id: 'transparency', icon: 'eye', label: 'Transparency' }
    ],
    onMoreNavigate: id => { setView(id); setActiveBridge(null); }
  },
    availableContexts && availableContexts.length > 1 && /*#__PURE__*/React.createElement("div", { style: { padding: '8px 0', borderTop: '1px solid var(--border-0)', marginTop: 8, display: 'flex', gap: 4 } },
      [{id:'provider',label:ROLES.provider.label,icon:'briefcase'},{id:'client',label:ROLES.client.label,icon:'shield'}].filter(opt => availableContexts.includes(opt.id)).map(opt => /*#__PURE__*/React.createElement("button", {
        key: opt.id, onClick: () => onSwitchContext(opt.id),
        className: activeContext === opt.id ? 'b-pri b-xs' : 'b-gho b-xs',
        style: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: 'var(--r)', fontSize: 11 }
      }, /*#__PURE__*/React.createElement(I, { n: opt.icon, s: 11 }), opt.label))
    ),
    /*#__PURE__*/React.createElement("div", { style: { padding: '8px 0', borderTop: '1px solid var(--border-0)', marginTop: 8, display: 'flex', gap: 8 } },
      /*#__PURE__*/React.createElement(ThemeToggle, { style: { flex: 1 } }),
      /*#__PURE__*/React.createElement("button", { onClick: onLogout, className: "b-gho b-sm", style: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 } },
        /*#__PURE__*/React.createElement(I, { n: "logout", s: 12 }), "Logout")
    )
  ),
  /*#__PURE__*/React.createElement("div", {
    className: "app-sidebar",
    style: {
      width: 250,
      minWidth: 250,
      height: '100%',
      background: 'var(--bg-1)',
      borderRight: '1px solid var(--border-0)',
      display: 'flex',
      flexDirection: 'column'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '18px 14px 14px',
      borderBottom: '1px solid var(--border-0)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      marginBottom: 4
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 28,
      height: 28,
      borderRadius: 'var(--r)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(SpinningDodeca, { size: 28 })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--serif)',
      fontWeight: 700,
      fontSize: 15
    }
  }, "Khora")), /*#__PURE__*/React.createElement("div", {
    onClick: () => setShareContactModal(true),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      marginTop: 8,
      padding: '6px 8px',
      marginLeft: -8,
      marginRight: -8,
      borderRadius: 'var(--r)',
      cursor: 'pointer',
      transition: 'background .2s'
    },
    onMouseEnter: e => e.currentTarget.style.background = 'var(--bg-2)',
    onMouseLeave: e => e.currentTarget.style.background = 'transparent'
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--mono)',
      fontSize: 9.5,
      color: 'var(--tx-3)',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      flex: 1
    }
  }, svc.userId), /*#__PURE__*/React.createElement(I, { n: "share", s: 12, c: "var(--tx-3)" }), /*#__PURE__*/React.createElement("span", {
    className: "tag tag-teal"
  }, ROLES.client.label.toUpperCase()))),
  /* ─── Mode Toggle (sidebar) ─── */
  availableContexts && availableContexts.length > 1 && /*#__PURE__*/React.createElement("div", {
    className: "sidebar-mode-toggle"
  }, [{id:'provider',label:ROLES.provider.label,icon:'briefcase'},{id:'client',label:ROLES.client.label,icon:'shield'}].filter(opt => availableContexts.includes(opt.id)).map(opt => /*#__PURE__*/React.createElement("button", {
    key: opt.id,
    onClick: () => onSwitchContext(opt.id),
    className: activeContext === opt.id ? 'b-pri b-xs' : 'b-gho b-xs',
    style: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: 'var(--r)', fontSize: 11 }
  }, /*#__PURE__*/React.createElement(I, { n: opt.icon, s: 11 }), opt.label))),
  /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflow: 'auto',
      padding: '6px 6px'
    }
  }, [{
    id: 'dashboard',
    icon: 'briefcase',
    label: 'My Dashboard'
  }, {
    id: 'vault',
    icon: 'folder',
    label: 'My Vault'
  }, {
    id: 'inbox',
    icon: 'msg',
    label: 'Messages'
  }, {
    id: 'observations',
    icon: 'clipboard',
    label: 'Observations'
  }, {
    id: 'resources',
    icon: 'layers',
    label: `My Resources${myResources.length ? ` (${myResources.length})` : ''}`
  }, {
    id: 'providers',
    icon: 'users',
    label: 'People & Teams'
  }, {
    id: 'records',
    icon: 'shield',
    label: 'My Records'
  }, {
    id: 'activity',
    icon: 'list',
    label: 'Action Log'
  }, {
    id: 'transparency',
    icon: 'eye',
    label: 'Transparency'
  }].map(item => /*#__PURE__*/React.createElement("div", {
    key: item.id,
    onClick: () => {
      setView(item.id);
      setActiveBridge(null);
      if (item.id !== 'inbox') setInboxConvo(null);
    },
    style: {
      padding: '9px 10px',
      borderRadius: 'var(--r)',
      cursor: 'pointer',
      marginBottom: 1,
      background: view === item.id && !activeBridge ? 'var(--bg-4)' : 'transparent',
      borderLeft: view === item.id && !activeBridge ? '2px solid var(--teal)' : '2px solid transparent',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      transition: 'all .15s',
      color: view === item.id && !activeBridge ? 'var(--tx-0)' : 'var(--tx-1)'
    },
    onMouseEnter: e => {
      if (!(view === item.id && !activeBridge)) e.currentTarget.style.background = 'var(--bg-3)';
    },
    onMouseLeave: e => {
      if (!(view === item.id && !activeBridge)) e.currentTarget.style.background = 'transparent';
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: item.icon,
    s: 14
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12.5,
      fontWeight: view === item.id ? 600 : 400
    }
  }, item.label), item.id === 'inbox' && providers.length > 0 && /*#__PURE__*/React.createElement("span", {
    className: "nav-badge nav-badge-teal"
  }, providers.length), item.id === 'records' && pendingClaims.length > 0 && /*#__PURE__*/React.createElement("span", {
    className: "nav-badge nav-badge-gold"
  }, pendingClaims.length))), providers.length > 0 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '14px 10px 4px'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "BRIDGES")), providers.map((p, i) => /*#__PURE__*/React.createElement("div", {
    key: p.bridgeRoomId,
    onClick: () => openBridge(p.bridgeRoomId),
    style: {
      padding: '8px 10px',
      borderRadius: 'var(--r)',
      cursor: 'pointer',
      marginBottom: 1,
      background: activeBridge === p.bridgeRoomId ? 'var(--bg-4)' : 'transparent',
      borderLeft: activeBridge === p.bridgeRoomId ? '2px solid var(--gold)' : '2px solid transparent',
      transition: 'all .15s'
    },
    onMouseEnter: e => {
      if (activeBridge !== p.bridgeRoomId) e.currentTarget.style.background = 'var(--bg-3)';
    },
    onMouseLeave: e => {
      if (activeBridge !== p.bridgeRoomId) e.currentTarget.style.background = 'transparent';
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      fontWeight: activeBridge === p.bridgeRoomId ? 600 : 400,
      display: 'block',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, p.providerName || p.providerUserId), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 4
    }
  }, p.providerProfile?.org_membership?.verified && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(I, {
    n: "shieldCheck",
    s: 9,
    c: "var(--blue)"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 8.5,
      color: 'var(--blue)',
      fontWeight: 600,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      maxWidth: 100
    }
  }, p.providerProfile.org_membership.org_name)), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 9.5,
      color: 'var(--tx-3)',
      fontFamily: 'var(--mono)'
    }
  }, Object.values(p.sharedFields || {}).filter(Boolean).length, " fields")))))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '8px 10px',
      borderTop: '1px solid var(--border-0)',
      display: 'flex',
      flexDirection: 'column',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(StorageTransparencyBadge, {
    storageType: "matrix",
    server: svc._baseUrl ? (() => { try { return new URL(svc._baseUrl).hostname; } catch(e) { return 'unknown'; } })() : 'unknown',
    encrypted: true,
    encLabel: "Megolm E2EE",
    label: "Session",
    compact: true
  }), /*#__PURE__*/React.createElement(ThemeToggle, {
    style: {
      width: '100%',
      justifyContent: 'center'
    }
  }), /*#__PURE__*/React.createElement("button", {
    onClick: onLogout,
    className: "b-gho b-sm",
    style: {
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "logout",
    s: 12
  }), "Logout"))), /*#__PURE__*/React.createElement("div", {
    className: "app-main",
    style: {
      flex: 1,
      overflow: 'auto',
      padding: 24,
      minWidth: 0
    }
  }, view === 'dashboard' && !activeBridge && /*#__PURE__*/React.createElement(PersonalDashboard, {
    session: session,
    providers: providers,
    observations: observations,
    myResources: myResources,
    vaultData: vaultData,
    allFields: allFields,
    vaultRoom: vaultRoom,
    myTeams: myTeams,
    onNavigate: v => {
      setView(v);
      setActiveBridge(null);
    }
  }), view === 'vault' && !activeBridge && /*#__PURE__*/React.createElement("div", {
    className: "anim-up",
    style: {
      maxWidth: 820,
      margin: '0 auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 24
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", {
    style: {
      fontFamily: 'var(--serif)',
      fontSize: 22,
      fontWeight: 700
    }
  }, "Your Vault"), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--tx-1)',
      fontSize: 12.5,
      marginTop: 4
    }
  }, "All data encrypted in your private Matrix room. Only you can read this."), /*#__PURE__*/React.createElement(StorageTransparencyBadge, {
    storageType: "matrix",
    roomId: vaultRoom,
    encrypted: true,
    encLabel: "Megolm E2EE + AES-256-GCM at rest",
    label: "Vault Data",
    members: [{ userId: svc.userId, role: 'owner (sole access)' }],
    extra: [{ label: 'Sovereignty', value: 'You are the only person who can read or decrypt this data. Providers can only see fields you explicitly share.' }]
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setFrameworkModal(true),
    className: "b-gho",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "grid",
    s: 14
  }), enabledFrameworks.length > 0 && /*#__PURE__*/React.createElement("span", {
    className: "tag tag-green",
    style: {
      fontSize: 8,
      padding: '1px 5px'
    }
  }, enabledFrameworks.length), "Frameworks"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setAddFieldModal(true),
    className: "b-gho",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "plus",
    s: 14
  }), "Add Field"), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setEditData({
        ...vaultData
      });
      setEditModal(true);
    },
    className: "b-pri",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "key",
    s: 14
  }), "Edit Vault"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))',
      gap: 10,
      marginBottom: 24
    }
  }, [{
    l: 'Fields',
    v: `${filledFields.length}/${allFields.length}`,
    c: 'teal',
    i: 'folder'
  }, {
    l: ROLES.provider.label + 's',
    v: providers.length,
    c: 'gold',
    i: 'users'
  }, {
    l: 'Observations',
    v: observations.length,
    c: 'blue',
    i: 'clipboard'
  }, {
    l: 'Shared Fields',
    v: sharedCount,
    c: 'orange',
    i: 'share'
  }].map((s, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "card",
    style: {
      padding: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, s.l.toUpperCase()), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 2
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 18,
      fontWeight: 700
    }
  }, s.v), /*#__PURE__*/React.createElement("span", {
    style: {
      color: `var(--${s.c})`,
      opacity: .5
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: s.i,
    s: 15
  })))))), allCategories.map(cat => {
    const fields = allFields.filter(f => f.category === cat);
    const color = CAT_COLORS[cat] || 'gold';
    if (!fields.length) return null;
    return /*#__PURE__*/React.createElement("div", {
      key: cat,
      style: {
        marginBottom: 16
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        marginBottom: 8
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        color: `var(--${color})`
      }
    }, /*#__PURE__*/React.createElement(I, {
      n: CAT_ICONS[cat] || 'file',
      s: 13
    })), /*#__PURE__*/React.createElement("span", {
      className: "section-label",
      style: {
        marginBottom: 0
      }
    }, (CAT_LABELS[cat] || cat.charAt(0).toUpperCase() + cat.slice(1)).toUpperCase())), /*#__PURE__*/React.createElement("div", {
      className: "card",
      style: {
        padding: 0,
        overflow: 'hidden'
      }
    }, fields.map((f, fi) => /*#__PURE__*/React.createElement(React.Fragment, {
      key: f.key
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        padding: '10px 16px',
        borderBottom: fi < fields.length - 1 && !(provenanceTarget?.entityKey === f.key && provenanceTarget?.roomId === vaultRoom) ? '1px solid var(--border-0)' : 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12.5,
        fontWeight: 500
      }
    }, f.label), f.sensitive && /*#__PURE__*/React.createElement("span", {
      className: "tag tag-red",
      style: {
        fontSize: 8.5
      }
    }, "SENSITIVE"), f.custom && /*#__PURE__*/React.createElement("span", {
      className: "tag tag-purple",
      style: {
        fontSize: 8.5
      }
    }, "CUSTOM"), f.framework && /*#__PURE__*/React.createElement("a", {
      href: f.uri || f.frameworkUri,
      target: "_blank",
      rel: "noopener",
      className: `tag tag-${FRAMEWORK_BY_ID[f.framework]?.accent || 'blue'}`,
      style: {
        fontSize: 8.5,
        textDecoration: 'none',
        cursor: 'pointer'
      },
      title: `${f.frameworkName} — ${f.property}`
    }, f.frameworkName)), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--mono)',
        fontSize: 11.5,
        color: vaultData[f.key] ? 'var(--tx-1)' : 'var(--tx-3)',
        maxWidth: 200,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
      }
    }, vaultData[f.key] ? f.sensitive ? '••••••••' : vaultData[f.key] : '—'), /*#__PURE__*/React.createElement("span", {
      onClick: () => setProvenanceTarget(pt => pt?.entityKey === f.key && pt?.roomId === vaultRoom ? null : {
        entityKey: f.key,
        label: f.label,
        roomId: vaultRoom
      }),
      style: {
        cursor: 'pointer',
        color: provenanceTarget?.entityKey === f.key && provenanceTarget?.roomId === vaultRoom ? 'var(--teal)' : 'var(--tx-3)',
        transition: 'color .15s'
      },
      title: "View provenance"
    }, /*#__PURE__*/React.createElement(I, {
      n: "git-commit",
      s: 12
    })), f.custom && /*#__PURE__*/React.createElement("span", {
      onClick: () => handleDeleteCustomField(f.key),
      style: {
        cursor: 'pointer',
        color: 'var(--tx-3)',
        transition: 'color .15s'
      },
      onMouseEnter: e => e.currentTarget.style.color = 'var(--red)',
      onMouseLeave: e => e.currentTarget.style.color = 'var(--tx-3)'
    }, /*#__PURE__*/React.createElement(I, {
      n: "trash",
      s: 12
    })))), provenanceTarget?.entityKey === f.key && provenanceTarget?.roomId === vaultRoom && /*#__PURE__*/React.createElement("div", {
      style: {
        padding: '4px 16px 12px',
        borderBottom: fi < fields.length - 1 ? '1px solid var(--border-0)' : 'none'
      }
    }, /*#__PURE__*/React.createElement(RecordProvenance, {
      roomId: vaultRoom,
      entityKey: f.key,
      label: f.label,
      session: session
    }))))));
  })), view === 'observations' && !activeBridge && /*#__PURE__*/React.createElement("div", {
    className: "anim-up",
    style: {
      maxWidth: 820,
      margin: '0 auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 24
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", {
    style: {
      fontFamily: 'var(--serif)',
      fontSize: 22,
      fontWeight: 700
    }
  }, "Observations"), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--tx-1)',
      fontSize: 12.5,
      marginTop: 4
    }
  }, "Record what\u2019s happening in your own words. These are your self-reports \u2014 simple check-ins that help your providers stay in the loop."), /*#__PURE__*/React.createElement(StorageTransparencyBadge, {
    storageType: "matrix",
    roomId: vaultRoom,
    encrypted: true,
    encLabel: "Megolm E2EE",
    label: "Observations",
    members: [{ userId: svc.userId, role: 'owner' }],
    extra: [{ label: 'Data type', value: 'Immutable GIVEN events stored as timeline events in your personal vault room' }]
  }))), /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "RECORD NEW OBSERVATION"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12,
      color: 'var(--tx-2)',
      marginBottom: 12
    }
  }, "Pick a question below to record something that happened. Your answers are stored privately in your encrypted vault \u2014 only you decide who sees them."), DEFAULT_FORMS.map(f => /*#__PURE__*/React.createElement("div", {
    key: f.id,
    style: {
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11.5,
      fontWeight: 600,
      color: 'var(--tx-0)'
    }
  }, f.name), /*#__PURE__*/React.createElement(MaturityBadge, {
    maturity: f.maturity
  }), f.source && /*#__PURE__*/React.createElement(SourceBadge, {
    source: f.source
  })), f.description && /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 11,
      color: 'var(--tx-2)',
      lineHeight: 1.5,
      marginBottom: 2,
      marginTop: 2
    }
  }, f.description), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 10,
      color: 'var(--tx-3)',
      fontStyle: 'italic',
      marginBottom: 6
    }
  }, f.source?.level === 'network' ? "This form was set up by your care network and shared to all member organizations." : "This form was created locally by your organization."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))',
      gap: 8
    }
  }, f.fields.map(p => /*#__PURE__*/React.createElement("div", {
    key: p.id,
    className: "card-h",
    onClick: () => {
      setObsModal(p);
      setObsValue('');
      setObsFreeText('');
      setObsDate(new Date().toISOString().slice(0, 10));
    },
    style: {
      padding: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      marginBottom: 6,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: `tag tag-${OBS_CAT_COLORS[p.category] || 'blue'}`
  }, p.category), p.sensitive && /*#__PURE__*/React.createElement("span", {
    className: "tag tag-red",
    style: {
      fontSize: 8
    }
  }, "SENSITIVE"), p.maturity && /*#__PURE__*/React.createElement(MaturityBadge, {
    maturity: p.maturity
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      fontWeight: 600,
      display: 'block'
    }
  }, p.question), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      marginTop: 4
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10.5,
      color: 'var(--tx-3)'
    }
  }, p.options.length, " response options")))))))), /*#__PURE__*/React.createElement("div", {
    className: "card"
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "OBSERVATION HISTORY (", observations.length, ")"), observations.length === 0 ? /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--tx-3)',
      fontSize: 12.5,
      padding: '16px 0',
      textAlign: 'center'
    }
  }, "No observations recorded yet") : /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      marginTop: 8
    }
  }, [...observations].reverse().map((obs, i) => {
    const prompt = DEFAULT_PROMPTS.find(p => p.key === obs.category);
    const optLabel = prompt?.options.find(o => o.v === obs.value)?.l || obs.value;
    const obsEntityKey = obs.category;
    const obsProvOpen = provenanceTarget?.entityKey === obsEntityKey && provenanceTarget?.roomId === vaultRoom && provenanceTarget?._obsId === obs.id;
    return /*#__PURE__*/React.createElement(React.Fragment, {
      key: obs.id || i
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        padding: '10px 14px',
        background: 'var(--bg-3)',
        borderRadius: 'var(--r)',
        display: 'flex',
        alignItems: 'center',
        gap: 10
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: `tag tag-${OBS_CAT_COLORS[obs.category] || 'blue'}`,
      style: {
        fontSize: 9
      }
    }, obs.category), /*#__PURE__*/React.createElement("span", {
      className: "tag tag-teal",
      style: {
        fontSize: 8.5
      }
    }, "GIVEN"), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12,
        flex: 1
      }
    }, optLabel), obs.created_by && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 9,
        color: 'var(--tx-3)',
        fontFamily: 'var(--mono)'
      },
      title: obs.created_by
    }, obs.created_by.split(':')[0]?.slice(1)), obs.origin_server && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 8.5,
        color: 'var(--tx-3)',
        fontFamily: 'var(--mono)'
      }
    }, obs.origin_server), obs.free_text && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 10.5,
        color: 'var(--tx-2)',
        fontStyle: 'italic'
      }
    }, obs.free_text), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 10,
        color: 'var(--tx-3)',
        fontFamily: 'var(--mono)'
      }
    }, obs.date), /*#__PURE__*/React.createElement("span", {
      onClick: () => setProvenanceTarget(obsProvOpen ? null : {
        entityKey: obsEntityKey,
        label: `Observation: ${obs.category}`,
        roomId: vaultRoom,
        _obsId: obs.id
      }),
      style: {
        cursor: 'pointer',
        color: obsProvOpen ? 'var(--teal)' : 'var(--tx-3)',
        transition: 'color .15s',
        flexShrink: 0
      },
      title: "View provenance"
    }, /*#__PURE__*/React.createElement(I, {
      n: "git-commit",
      s: 11
    }))), obsProvOpen && /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 2,
        marginBottom: 4
      }
    }, /*#__PURE__*/React.createElement(RecordProvenance, {
      roomId: vaultRoom,
      entityKey: obsEntityKey,
      label: `Observation: ${obs.category}`,
      session: session
    })));
  }))), observations.filter(obs => FRAMEWORK_BINDINGS[obs.category]?.bindings?.[obs.value]).length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 24,
      height: 24,
      borderRadius: '50%',
      background: 'linear-gradient(135deg,var(--teal),var(--gold))',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--bg-0)',
      fontSize: 11,
      fontWeight: 800
    }
  }, "\u2192"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--serif)',
      fontSize: 15,
      fontWeight: 700
    }
  }, "What Your Observations Mean"), /*#__PURE__*/React.createElement("span", {
    className: "gm-sup-badge"
  }, "GIVEN \u2192 MEANT")), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 11,
      color: 'var(--tx-2)',
      marginBottom: 10
    }
  }, "Your observations are facts. Below you can see how different institutional frameworks interpret those same facts differently."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, observations.filter(obs => FRAMEWORK_BINDINGS[obs.category]?.bindings?.[obs.value]).slice(-3).reverse().map((obs, i) => /*#__PURE__*/React.createElement(RecordGivenMeant, {
    key: obs.id || i,
    promptKey: obs.category,
    value: obs.value,
    reporter: `${ROLES.client.label} self-report`,
    timestamp: obs.ts
  }))))), view === 'resources' && !activeBridge && /*#__PURE__*/React.createElement("div", {
    className: "anim-up",
    style: {
      maxWidth: 820,
      margin: '0 auto'
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      fontFamily: 'var(--serif)',
      fontSize: 22,
      fontWeight: 700
    }
  }, "My Resources"), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--tx-1)',
      fontSize: 12.5,
      marginTop: 4,
      marginBottom: 20
    }
  }, "Resources allocated to you by providers across all your bridges. This is your record \u2014 encrypted in your vault."), /*#__PURE__*/React.createElement(StorageTransparencyBadge, {
    storageType: "matrix",
    roomId: vaultRoom,
    encrypted: true,
    encLabel: "Megolm E2EE",
    label: "My Resources",
    members: [{ userId: svc.userId, role: 'owner' }],
    extra: [{ label: 'Storage', value: 'Resource vault records are stored in your personal vault and mirrored in each bridge room. Only you and the allocating provider can see allocations.' }]
  }), myResources.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      textAlign: 'center',
      padding: '30px 20px',
      borderStyle: 'dashed'
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "layers",
    s: 28,
    c: "var(--tx-3)"
  }), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--tx-2)',
      marginTop: 8,
      fontSize: 12
    }
  }, "No resources have been allocated to you yet."), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--tx-3)',
      fontSize: 11,
      marginTop: 4
    }
  }, "When a provider allocates resources (vouchers, funds, services), they'll appear here.")) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))',
      gap: 10,
      marginBottom: 20
    }
  }, [{
    l: 'Total',
    v: myResources.length,
    c: 'teal'
  }, {
    l: 'Active',
    v: myResources.filter(r => r.status === 'active').length,
    c: 'green'
  }, {
    l: 'Used',
    v: myResources.filter(r => r.status === 'consumed').length,
    c: 'blue'
  }, {
    l: 'Expired',
    v: myResources.filter(r => r.status === 'expired').length,
    c: 'orange'
  }].map((s, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "card",
    style: {
      padding: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, s.l.toUpperCase()), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 18,
      fontWeight: 700,
      color: `var(--${s.c})`
    }
  }, s.v)))), (() => {
    const byProvider = {};
    myResources.forEach(r => {
      const key = r.org_display_name || r.provider_display_name || r.bridge_room_id || 'Unknown';
      if (!byProvider[key]) byProvider[key] = [];
      byProvider[key].push(r);
    });
    return Object.entries(byProvider).map(([provName, allocs]) => /*#__PURE__*/React.createElement("div", {
      key: provName,
      style: {
        marginBottom: 16
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        marginBottom: 8
      }
    }, /*#__PURE__*/React.createElement(I, {
      n: "briefcase",
      s: 14,
      c: "var(--gold)"
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13,
        fontWeight: 600
      }
    }, provName), /*#__PURE__*/React.createElement("span", {
      className: "tag tag-gold",
      style: {
        fontSize: 8
      }
    }, allocs.length)), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 6
      }
    }, allocs.sort((a, b) => (b.allocated_at || 0) - (a.allocated_at || 0)).map((alloc, i) => {
      const statusColors = {
        active: 'teal',
        consumed: 'blue',
        expired: 'orange',
        revoked: 'red'
      };
      const clientAllocProvOpen = provenanceTarget?.entityKey === alloc.allocation_id && provenanceTarget?.roomId === alloc.bridge_room_id;
      return /*#__PURE__*/React.createElement(React.Fragment, {
        key: alloc.allocation_id || i
      }, /*#__PURE__*/React.createElement("div", {
        className: "card",
        style: {
          padding: '10px 14px'
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 2
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 13,
          fontWeight: 600
        }
      }, alloc.resource_name || alloc.resource_type_id), /*#__PURE__*/React.createElement("div", {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: 6
        }
      }, /*#__PURE__*/React.createElement("span", {
        className: `tag tag-${statusColors[alloc.status] || 'teal'}`,
        style: {
          fontSize: 8.5
        }
      }, (alloc.status || 'active').toUpperCase()), /*#__PURE__*/React.createElement("span", {
        onClick: () => setProvenanceTarget(clientAllocProvOpen ? null : {
          entityKey: alloc.allocation_id,
          label: `Resource: ${alloc.resource_name || alloc.resource_type_id}`,
          roomId: alloc.bridge_room_id
        }),
        style: {
          cursor: 'pointer',
          color: clientAllocProvOpen ? 'var(--teal)' : 'var(--tx-3)',
          transition: 'color .15s'
        },
        title: "View provenance"
      }, /*#__PURE__*/React.createElement(I, {
        n: "git-commit",
        s: 11
      })))), /*#__PURE__*/React.createElement("div", {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 11,
          color: 'var(--tx-2)',
          fontFamily: 'var(--mono)'
        }
      }, "x", alloc.quantity, " ", alloc.unit || ''), /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 9.5,
          color: 'var(--tx-3)',
          fontFamily: 'var(--mono)'
        }
      }, alloc.allocated_at ? new Date(alloc.allocated_at).toLocaleDateString() : '')), alloc.notes && /*#__PURE__*/React.createElement("p", {
        style: {
          fontSize: 11,
          color: 'var(--tx-2)',
          marginTop: 4,
          fontStyle: 'italic'
        }
      }, alloc.notes)), clientAllocProvOpen && /*#__PURE__*/React.createElement("div", {
        style: {
          marginTop: 2,
          marginBottom: 4
        }
      }, /*#__PURE__*/React.createElement(RecordProvenance, {
        roomId: alloc.bridge_room_id,
        entityKey: alloc.allocation_id,
        label: `Resource: ${alloc.resource_name || alloc.resource_type_id}`,
        session: session
      })));
    }))));
  })())), view === 'providers' && !activeBridge && /*#__PURE__*/React.createElement("div", {
    className: "anim-up",
    style: {
      maxWidth: 820,
      margin: '0 auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 24
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", {
    style: {
      fontFamily: 'var(--serif)',
      fontSize: 22,
      fontWeight: 700
    }
  }, "People & Teams"), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--tx-1)',
      fontSize: 12.5,
      marginTop: 4
    }
  }, "Your ", ROLES.provider.label.toLowerCase(), "s, teams you belong to, and contacts \u2014 all in one place."), /*#__PURE__*/React.createElement(StorageTransparencyBadge, {
    storageType: "matrix",
    encrypted: true,
    encLabel: "Megolm E2EE",
    label: "People & Teams",
    extra: [{ label: 'Providers', value: providers.length + ' provider(s), each with a separate encrypted bridge room' }, { label: 'Teams', value: myTeams.length + ' team(s), each a separate encrypted Matrix room' }, { label: 'Privacy', value: 'Provider relationships are stored as bridge rooms. Team memberships are stored in team rooms. No central directory has access to all your connections.' }]
  })), /*#__PURE__*/React.createElement("button", {
    onClick: () => setAddProviderModal(true),
    className: "b-pri",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "plus",
    s: 14
  }), "Add ", ROLES.provider.label)), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 24
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "briefcase",
    s: 16,
    c: "var(--gold)"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      fontWeight: 700
    }
  }, ROLES.provider.label, "s"), /*#__PURE__*/React.createElement("span", {
    className: "tag tag-gold",
    style: {
      fontSize: 9
    }
  }, providers.length)), providers.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      textAlign: 'center',
      padding: '24px 20px',
      borderStyle: 'dashed'
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "briefcase",
    s: 24,
    c: "var(--tx-3)"
  }), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--tx-2)',
      marginTop: 8,
      fontSize: 12
    }
  }, "No ", ROLES.provider.label.toLowerCase(), "s yet. Add one to create an encrypted bridge.")) : /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, providers.map((prov, pi) => {
    const shCount = Object.values(prov.sharedFields || {}).filter(Boolean).length;
    const pp = prov.providerProfile;
    const orgInfo = pp?.org_membership;
    return /*#__PURE__*/React.createElement("div", {
      key: prov.bridgeRoomId,
      className: "card",
      style: {
        padding: 0,
        overflow: 'hidden'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        padding: '14px 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid var(--border-0)'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 14,
        fontWeight: 600
      }
    }, prov.providerName || prov.providerUserId), pp?.title && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11,
        color: 'var(--tx-2)'
      }
    }, pp.title), /*#__PURE__*/React.createElement("span", {
      className: "tag tag-green"
    }, /*#__PURE__*/React.createElement(I, {
      n: "lock",
      s: 9
    }), "E2EE")), orgInfo?.verified ? /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        marginTop: 4
      }
    }, /*#__PURE__*/React.createElement(I, {
      n: "shieldCheck",
      s: 12,
      c: "var(--blue)"
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11,
        fontWeight: 600,
        color: 'var(--blue)'
      }
    }, orgInfo.org_name), orgInfo.email_verified ? /*#__PURE__*/React.createElement("span", {
      className: "tag tag-green",
      style: {
        fontSize: 7.5,
        padding: '1px 5px'
      }
    }, "EMAIL VERIFIED") : /*#__PURE__*/React.createElement("span", {
      className: "tag tag-green",
      style: {
        fontSize: 7.5,
        padding: '1px 5px'
      }
    }, "VERIFIED"), orgInfo.role && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 9,
        color: 'var(--tx-2)',
        fontFamily: 'var(--mono)'
      }
    }, orgInfo.role)) : /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--mono)',
        fontSize: 10,
        color: 'var(--tx-3)'
      }
    }, "Independent ", ROLES.provider.label.toLowerCase()), pp?.credentials && /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 2
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 9.5,
        color: 'var(--tx-2)',
        fontFamily: 'var(--mono)'
      }
    }, pp.credentials)), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--mono)',
        fontSize: 10,
        color: 'var(--tx-3)',
        display: 'block',
        marginTop: 2
      }
    }, "Bridge: ", prov.bridgeRoomId.slice(0, 20), "\u2026")), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 4
      }
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => { setView('inbox'); openInboxConvo(pi); },
      className: "b-pri b-sm",
      style: { display: 'flex', alignItems: 'center', gap: 4 }
    }, /*#__PURE__*/React.createElement(I, { n: "msg", s: 11 }), "Message"), /*#__PURE__*/React.createElement("button", {
      onClick: () => openBridge(prov.bridgeRoomId),
      className: "b-gho b-sm"
    }, "Open Bridge"), /*#__PURE__*/React.createElement("button", {
      onClick: () => setHardRevokeTarget(pi),
      className: "b-red b-sm"
    }, /*#__PURE__*/React.createElement(I, {
      n: "zap",
      s: 11
    })), /*#__PURE__*/React.createElement("button", {
      onClick: () => handleRemoveProvider(pi),
      className: "b-gho b-sm",
      style: {
        color: 'var(--red)'
      }
    }, /*#__PURE__*/React.createElement(I, {
      n: "trash",
      s: 12
    })))), /*#__PURE__*/React.createElement("div", {
      style: {
        padding: '10px 18px',
        borderBottom: '1px solid var(--border-0)',
        background: prov.transferable === false ? 'var(--red-dim)' : 'var(--green-dim)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flex: 1
      }
    }, /*#__PURE__*/React.createElement(I, {
      n: prov.transferable === false ? 'lock' : 'users',
      s: 14,
      c: prov.transferable === false ? 'var(--red)' : 'var(--green)'
    }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12,
        fontWeight: 600,
        color: prov.transferable === false ? 'var(--red)' : 'var(--green)',
        display: 'block'
      }
    }, prov.transferable === false ? 'Transfer Locked' : 'Transferable'), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 10,
        color: 'var(--tx-2)'
      }
    }, prov.transferable === false ? 'Only this provider can access your bridge. Org cannot reassign.' : 'Org can reassign your case to a different provider if needed.'))), /*#__PURE__*/React.createElement(Toggle, {
      on: prov.transferable !== false,
      onChange: () => handleToggleTransferable(pi)
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        padding: '12px 18px'
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "section-label"
    }, "FIELD-LEVEL SHARING"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '0'
      }
    }, allFields.map(f => {
      const isShared = prov.sharedFields?.[f.key] || false;
      const hasData = !!vaultData[f.key];
      return /*#__PURE__*/React.createElement("div", {
        key: f.key,
        style: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 0',
          borderBottom: '1px solid var(--border-0)',
          marginRight: 16
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 12,
          color: hasData ? 'var(--tx-0)' : 'var(--tx-3)'
        }
      }, f.label, f.custom ? ' ✦' : ''), /*#__PURE__*/React.createElement(Toggle, {
        on: isShared,
        onChange: () => handleToggleField(pi, f.key),
        disabled: !hasData
      }));
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 10,
        display: 'flex',
        alignItems: 'center',
        gap: 6
      }
    }, /*#__PURE__*/React.createElement(I, {
      n: "key",
      s: 12,
      c: "var(--tx-3)"
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 10.5,
        color: 'var(--tx-3)',
        fontFamily: 'var(--mono)'
      }
    }, shCount, "/", allFields.length, " fields \u2014 unique AES-256-GCM keys"))));
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 24
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "users",
    s: 16,
    c: "var(--purple,var(--blue))"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      fontWeight: 700
    }
  }, "My Teams"), /*#__PURE__*/React.createElement("span", {
    className: "tag tag-blue",
    style: {
      fontSize: 9
    }
  }, myTeams.length)), myTeams.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      textAlign: 'center',
      padding: '24px 20px',
      borderStyle: 'dashed'
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "users",
    s: 24,
    c: "var(--tx-3)"
  }), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--tx-2)',
      marginTop: 8,
      fontSize: 12
    }
  }, "Not part of any teams yet. Teams are created by ", ROLES.provider.label.toLowerCase(), "s to collaborate.")) : /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))',
      gap: 10
    }
  }, myTeams.map(team => {
    const myMembership = (team.members || []).find(m => m.userId === svc.userId);
    return /*#__PURE__*/React.createElement("div", {
      key: team.roomId,
      className: "card",
      style: {
        padding: 0,
        overflow: 'hidden'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        padding: '14px 18px'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 6
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 14,
        fontWeight: 600
      }
    }, team.name || 'Unnamed Team'), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 4
      }
    }, team.org_name && /*#__PURE__*/React.createElement("span", {
      className: "tag tag-blue",
      style: {
        fontSize: 8
      }
    }, team.org_name), myMembership?.sharing_consent === 'shared' && /*#__PURE__*/React.createElement("span", {
      className: "tag tag-green",
      style: {
        fontSize: 7
      }
    }, "SHARING"), myMembership?.sharing_consent === 'withheld' && /*#__PURE__*/React.createElement("span", {
      className: "tag tag-red",
      style: {
        fontSize: 7
      }
    }, "WITHHELD"))), team.description && /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 11,
        color: 'var(--tx-2)',
        lineHeight: 1.5,
        marginBottom: 8
      }
    }, team.description), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 6
      }
    }, /*#__PURE__*/React.createElement(I, {
      n: "user",
      s: 11,
      c: "var(--tx-3)"
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 10.5,
        color: 'var(--tx-2)'
      }
    }, team.members?.length || 0, " member", (team.members?.length || 0) !== 1 ? 's' : '')), team.members && team.members.length > 0 && /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 3,
        flexWrap: 'wrap',
        marginTop: 6
      }
    }, team.members.slice(0, 4).map((m, mi) => /*#__PURE__*/React.createElement("span", {
      key: mi,
      style: {
        fontSize: 9,
        padding: '2px 6px',
        background: 'var(--bg-3)',
        borderRadius: 'var(--r)',
        color: 'var(--tx-1)'
      }
    }, m.display_name || m.userId?.split(':')[0]?.replace('@', ''), m.userId !== svc.userId && /*#__PURE__*/React.createElement("button", {
      onClick: e => { e.stopPropagation(); startClientTeamDM(m.userId, m.display_name || m.userId, team.name, team.roomId); },
      style: { background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 0 3px', color: 'var(--purple)', display: 'inline-flex' },
      title: `Message ${m.display_name || m.userId}`
    }, /*#__PURE__*/React.createElement(I, { n: "msg", s: 8 })))), team.members.length > 4 && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 9,
        color: 'var(--tx-3)'
      }
    }, "+", team.members.length - 4))), myMembership && myMembership.sharing_consent === 'pending' && /*#__PURE__*/React.createElement("div", {
      style: {
        padding: '10px 18px',
        background: 'var(--gold-dim)',
        borderTop: '1px solid rgba(218,165,32,.15)'
      }
    }, /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 11,
        color: 'var(--tx-1)',
        lineHeight: 1.6,
        marginBottom: 8
      }
    }, /*#__PURE__*/React.createElement("strong", null, "Content sharing decision required."), " Content about individuals served by this team will be shared with you by default. Would you like to withhold it?"), /*#__PURE__*/React.createElement("button", {
      onClick: () => setClientSharingConsentModal({
        team
      }),
      className: "b-pri b-xs",
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 3
      }
    }, /*#__PURE__*/React.createElement(I, {
      n: "shield",
      s: 10
    }), "Make My Choice")), myMembership && (myMembership.sharing_consent === 'shared' || myMembership.sharing_consent === 'withheld') && /*#__PURE__*/React.createElement("div", {
      style: {
        padding: '8px 18px',
        borderTop: '1px solid var(--border-0)',
        display: 'flex',
        justifyContent: 'flex-end'
      }
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => setClientSharingConsentModal({
        team
      }),
      className: "b-gho b-xs",
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 3
      }
    }, /*#__PURE__*/React.createElement(I, {
      n: "shield",
      s: 10
    }), "Change Sharing")));
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 24
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "msg",
    s: 16,
    c: "var(--teal)"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      fontWeight: 700
    }
  }, "Contacts")), (() => {
    // Derive contacts: people who appear across bridges + teams (deduplicated)
    const contactMap = {};
    for (const prov of providers) {
      const uid = prov.providerUserId;
      if (uid && uid !== svc.userId && !contactMap[uid]) {
        contactMap[uid] = {
          userId: uid,
          name: prov.providerName || uid,
          source: 'bridge',
          org: prov.providerProfile?.org_membership?.org_name
        };
      }
    }
    for (const team of myTeams) {
      for (const m of team.members || []) {
        if (m.userId && m.userId !== svc.userId && !contactMap[m.userId]) {
          contactMap[m.userId] = {
            userId: m.userId,
            name: m.display_name || m.userId,
            source: 'team',
            team: team.name
          };
        }
      }
    }
    const contacts = Object.values(contactMap);
    return contacts.length === 0 ? /*#__PURE__*/React.createElement("div", {
      className: "card",
      style: {
        textAlign: 'center',
        padding: '24px 20px',
        borderStyle: 'dashed'
      }
    }, /*#__PURE__*/React.createElement(I, {
      n: "msg",
      s: 24,
      c: "var(--tx-3)"
    }), /*#__PURE__*/React.createElement("p", {
      style: {
        color: 'var(--tx-2)',
        marginTop: 8,
        fontSize: 12
      }
    }, "No contacts yet. Connect with ", ROLES.provider.label.toLowerCase(), "s or join teams to build your network.")) : /*#__PURE__*/React.createElement("div", {
      className: "card",
      style: {
        padding: 0,
        overflow: 'hidden'
      }
    }, contacts.map((c, ci) => /*#__PURE__*/React.createElement("div", {
      key: c.userId,
      style: {
        padding: '10px 16px',
        borderBottom: ci < contacts.length - 1 ? '1px solid var(--border-0)' : 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 24,
        height: 24,
        borderRadius: '50%',
        background: c.source === 'bridge' ? 'var(--gold-dim)' : 'var(--blue-dim)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: c.source === 'bridge' ? 'var(--gold)' : 'var(--blue)',
        flexShrink: 0
      }
    }, /*#__PURE__*/React.createElement(I, {
      n: c.source === 'bridge' ? 'briefcase' : 'users',
      s: 11
    })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12.5,
        fontWeight: 500,
        display: 'block'
      }
    }, c.name), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 9.5,
        color: 'var(--tx-3)',
        fontFamily: 'var(--mono)'
      }
    }, c.userId))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 4
      }
    }, c.org && /*#__PURE__*/React.createElement("span", {
      className: "tag tag-blue",
      style: {
        fontSize: 8
      }
    }, c.org), c.team && /*#__PURE__*/React.createElement("span", {
      className: "tag tag-purple",
      style: {
        fontSize: 8
      }
    }, c.team), /*#__PURE__*/React.createElement("span", {
      className: `tag ${c.source === 'bridge' ? 'tag-gold' : 'tag-blue'}`,
      style: {
        fontSize: 8
      }
    }, c.source === 'bridge' ? ROLES.provider.label : 'Team')))));
  })())), view === 'records' && !activeBridge && /*#__PURE__*/React.createElement("div", {
    className: "anim-up",
    style: {
      maxWidth: 820,
      margin: '0 auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 24
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", {
    style: {
      fontFamily: 'var(--serif)',
      fontSize: 22,
      fontWeight: 700
    }
  }, "My Records"), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--tx-1)',
      fontSize: 12.5,
      marginTop: 4
    }
  }, "Rooms created by providers on your behalf. Claim them to take full ownership and control."), /*#__PURE__*/React.createElement(StorageTransparencyBadge, {
    storageType: "matrix",
    encrypted: true,
    encLabel: "Megolm E2EE",
    label: "My Records",
    extra: [{ label: 'Ownership', value: 'Each record is a separate Matrix room. Pending records were created by a provider. Once claimed, ownership (power level 100) transfers to you and only you can control access.' }, { label: 'Rooms', value: (pendingClaims.length + claimedRooms.length) + ' record rooms (' + pendingClaims.length + ' pending, ' + claimedRooms.length + ' claimed)' }]
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))',
      gap: 10,
      marginBottom: 20
    }
  }, [{
    l: 'Pending',
    v: pendingClaims.length,
    c: 'gold',
    i: 'clock'
  }, {
    l: 'Claimed',
    v: claimedRooms.length,
    c: 'teal',
    i: 'shield'
  }].map((s, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "card",
    style: {
      padding: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, s.l.toUpperCase()), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 2
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 18,
      fontWeight: 700
    }
  }, s.v), /*#__PURE__*/React.createElement("span", {
    style: {
      color: `var(--${s.c})`,
      opacity: .5
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: s.i,
    s: 15
  })))))), pendingClaims.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "PENDING \u2014 AWAITING YOUR CLAIM"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      marginTop: 8
    }
  }, pendingClaims.map(rec => /*#__PURE__*/React.createElement("div", {
    key: rec.roomId,
    className: "card",
    style: {
      padding: '14px 18px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      fontWeight: 600
    }
  }, rec.client_name || 'Unnamed Record'), /*#__PURE__*/React.createElement("span", {
    className: "tag tag-gold"
  }, "Pending")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      marginTop: 4
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10.5,
      color: 'var(--tx-2)'
    }
  }, "Created by: ", /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--mono)'
    }
  }, rec.owner)), rec.created && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      color: 'var(--tx-3)',
      fontFamily: 'var(--mono)'
    }
  }, new Date(rec.created).toLocaleDateString())), rec.notes && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: 'var(--tx-2)',
      marginTop: 4,
      display: 'block',
      fontStyle: 'italic'
    }
  }, rec.notes)), /*#__PURE__*/React.createElement("button", {
    onClick: () => handleClaimRoom(rec),
    className: "b-pri",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      whiteSpace: 'nowrap'
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "shield",
    s: 13
  }), "Claim Room"))))), claimedRooms.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "CLAIMED \u2014 YOU OWN THESE ROOMS"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      marginTop: 8
    }
  }, claimedRooms.map(rec => /*#__PURE__*/React.createElement("div", {
    key: rec.roomId,
    className: "card",
    style: {
      padding: 0,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '14px 18px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottom: '1px solid var(--border-0)'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      fontWeight: 600
    }
  }, rec.client_name || 'Record'), /*#__PURE__*/React.createElement("span", {
    className: "tag tag-teal"
  }, "Claimed"), /*#__PURE__*/React.createElement("span", {
    className: "tag tag-green"
  }, /*#__PURE__*/React.createElement(I, {
    n: "lock",
    s: 9
  }), "PL 100")), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--mono)',
      fontSize: 10,
      color: 'var(--tx-3)'
    }
  }, "Room: ", rec.roomId.slice(0, 25), "\u2026")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 4
    }
  }, rec.previous_owner && /*#__PURE__*/React.createElement("button", {
    onClick: () => handleRevokeFromClaimed(rec, rec.previous_owner),
    className: "b-gho b-sm",
    style: {
      color: 'var(--red)',
      display: 'flex',
      alignItems: 'center',
      gap: 3
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "userMinus",
    s: 11
  }), "Remove Provider"), /*#__PURE__*/React.createElement("button", {
    onClick: () => handleDeleteClaimedRoom(rec),
    className: "b-gho b-sm",
    style: {
      color: 'var(--red)',
      display: 'flex',
      alignItems: 'center',
      gap: 3
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "trash",
    s: 11
  }), "Close Room"))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '12px 18px',
      fontSize: 12,
      color: 'var(--tx-1)',
      lineHeight: 1.6
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 16,
      flexWrap: 'wrap'
    }
  }, rec.previous_owner && /*#__PURE__*/React.createElement("span", null, "Previous owner: ", /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--mono)',
      fontSize: 10.5
    }
  }, rec.previous_owner)), rec.claimed_at && /*#__PURE__*/React.createElement("span", null, "Claimed: ", /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--mono)',
      fontSize: 10.5
    }
  }, new Date(rec.claimed_at).toLocaleString())))))))), pendingClaims.length === 0 && claimedRooms.length === 0 && /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      textAlign: 'center',
      padding: '40px 20px',
      borderStyle: 'dashed'
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "shield",
    s: 32
  }), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--tx-2)',
      marginTop: 10,
      fontSize: 13
    }
  }, "No records to claim"), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--tx-3)',
      fontSize: 11.5,
      marginTop: 4
    }
  }, "When a provider creates a room for you and sends an invite, it will appear here for you to claim.")), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--teal-dim)',
      border: '1px solid rgba(62,201,176,.15)',
      borderRadius: 'var(--r)',
      padding: '14px 18px',
      marginTop: 20,
      display: 'flex',
      gap: 10,
      alignItems: 'flex-start'
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "shield",
    s: 16,
    c: "var(--teal)"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: 'var(--tx-1)',
      lineHeight: 1.6
    }
  }, /*#__PURE__*/React.createElement("strong", {
    style: {
      color: 'var(--teal)'
    }
  }, "Full control after claiming:"), " When you claim a room, ownership transfers to you (power level 100). You can remove the provider, close the room, or manage who has access. The provider cannot undo your claim."))), view === 'inbox' && !activeBridge && /*#__PURE__*/React.createElement("div", {
    className: "anim-up inbox-wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "inbox-header"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", {
    style: {
      fontFamily: 'var(--serif)',
      fontSize: 22,
      fontWeight: 700
    }
  }, "Messages"), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--tx-1)',
      fontSize: 12.5,
      marginTop: 4
    }
  }, "Encrypted conversations with your connections. Messages are end-to-end encrypted."), /*#__PURE__*/React.createElement(StorageTransparencyBadge, {
    storageType: "matrix",
    roomId: typeof inboxConvo === 'number' ? (providers[inboxConvo] || {}).bridgeRoomId : inboxConvo || (providers[0] || {}).bridgeRoomId,
    encrypted: true,
    encLabel: "Megolm E2EE",
    label: "Messages",
    members: typeof inboxConvo === 'number' && inboxConvo !== null ? providers.filter(p => p.bridgeRoomId === providers[inboxConvo]?.bridgeRoomId).map(p => ({ userId: p.providerUserId, role: 'provider' })).concat([{ userId: svc.userId, role: 'client (you)' }]) : undefined,
    extra: [{ label: 'Privacy', value: 'Each conversation is a separate encrypted Matrix room. Only you and your connection can read messages.' }]
  })), /*#__PURE__*/React.createElement("div", {
    style: { display: 'flex', gap: 6, flexShrink: 0 }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setAddProviderModal(true),
    className: "b-pri",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "plus",
    s: 14
  }), "New Conversation"), clientTeamMemberContacts.length > 0 && /*#__PURE__*/React.createElement("button", {
    onClick: () => setNewTeamDMModal(true),
    className: "b-gho b-sm",
    style: { display: 'flex', alignItems: 'center', gap: 6 }
  }, /*#__PURE__*/React.createElement(I, { n: "msg", s: 14 }), "New DM"))), /*#__PURE__*/React.createElement("div", {
    className: "inbox-panel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "inbox-list"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '8px 14px 8px',
      borderBottom: '1px solid var(--border-0)',
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label",
    style: {
      marginBottom: 0,
      flex: 1
    }
  }, `CONVERSATIONS (${providers.length + clientTeamDMs.length})`)), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflow: 'auto'
    }
  }, (() => {
    const total = providers.length + clientTeamDMs.length;
    if (total === 0) return /*#__PURE__*/React.createElement("div", { style: { padding: '40px 16px', textAlign: 'center' } }, /*#__PURE__*/React.createElement(I, { n: "msg", s: 28, c: "var(--tx-3)" }), /*#__PURE__*/React.createElement("p", { style: { color: 'var(--tx-3)', fontSize: 11.5, marginTop: 10 } }, "No conversations yet"), /*#__PURE__*/React.createElement("p", { style: { color: 'var(--tx-3)', fontSize: 10.5, marginTop: 4 } }, "Start a new conversation to get started."));
    const renderSectionHdr = (label, count, iconName, color) => /*#__PURE__*/React.createElement("div", {
      style: { padding: '6px 14px 4px', display: 'flex', alignItems: 'center', gap: 6, position: 'sticky', top: 0, background: 'var(--bg-1)', zIndex: 1, borderBottom: '1px solid var(--border-0)' }
    }, iconName && /*#__PURE__*/React.createElement(I, { n: iconName, s: 11, c: color }), /*#__PURE__*/React.createElement("span", { style: { fontSize: 9.5, fontWeight: 700, color: color || 'var(--tx-2)', textTransform: 'uppercase', letterSpacing: '.5px' } }, label, " (", count, ")"));
    const teamNames = [...new Set(clientTeamDMs.map(d => d.teamName).filter(Boolean))];
    const ungroupedDMs = clientTeamDMs.filter(d => !d.teamName);
    return /*#__PURE__*/React.createElement(React.Fragment, null,
      providers.length > 0 && /*#__PURE__*/React.createElement(React.Fragment, null,
        (clientTeamDMs.length > 0) && renderSectionHdr("Providers", providers.length, "user", "var(--teal)"),
        ...providers.map((p, i) => {
          const isActive = inboxConvo === i;
          const name = p.providerName || p.providerProfile?.display_name || p.providerUserId || 'Provider';
          return /*#__PURE__*/React.createElement("div", {
            key: p.bridgeRoomId || i,
            onClick: () => openInboxConvo(i),
            style: { padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border-0)', background: isActive ? 'var(--bg-4)' : 'transparent', borderLeft: isActive ? '3px solid var(--teal)' : '3px solid transparent', transition: 'all .15s' },
            onMouseEnter: e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-3)'; },
            onMouseLeave: e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }
          }, /*#__PURE__*/React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 8 } },
            /*#__PURE__*/React.createElement("div", { style: { width: 32, height: 32, borderRadius: '50%', background: 'var(--teal-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--teal)', border: '2px solid var(--teal)', flexShrink: 0 } }, /*#__PURE__*/React.createElement(I, { n: "user", s: 14 })),
            /*#__PURE__*/React.createElement("div", { style: { flex: 1, minWidth: 0 } },
              /*#__PURE__*/React.createElement("span", { style: { fontSize: 12.5, fontWeight: isActive ? 700 : 500, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, name),
              /*#__PURE__*/React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 3, marginTop: 2, flexWrap: 'wrap' } },
                /*#__PURE__*/React.createElement("span", { style: { fontSize: 8, padding: '1px 5px', borderRadius: 10, background: 'var(--teal-dim)', color: 'var(--teal)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px' } }, "Provider"),
                /*#__PURE__*/React.createElement("span", { className: "tag tag-green", style: { fontSize: 7 } }, /*#__PURE__*/React.createElement(I, { n: "lock", s: 6 }), "E2EE")
              )
            )
          ));
        })
      ),
      clientTeamDMs.length > 0 && /*#__PURE__*/React.createElement(React.Fragment, null,
        ...teamNames.map(teamName => {
          const tDMs = clientTeamDMs.filter(d => d.teamName === teamName);
          return /*#__PURE__*/React.createElement(React.Fragment, { key: teamName },
            renderSectionHdr(teamName, tDMs.length, "users", "var(--purple)"),
            ...tDMs.map(dm => {
              const isActive = inboxConvo === dm.roomId;
              return /*#__PURE__*/React.createElement("div", {
                key: dm.roomId,
                onClick: () => openInboxConvo(dm.roomId),
                style: { padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border-0)', background: isActive ? 'var(--bg-4)' : 'transparent', borderLeft: isActive ? '3px solid var(--purple)' : '3px solid transparent', transition: 'all .15s' },
                onMouseEnter: e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-3)'; },
                onMouseLeave: e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }
              }, /*#__PURE__*/React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 8 } },
                /*#__PURE__*/React.createElement("div", { style: { width: 32, height: 32, borderRadius: '50%', background: 'var(--purple-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--purple)', border: '2px solid var(--purple)', flexShrink: 0 } }, /*#__PURE__*/React.createElement(I, { n: "user", s: 14 })),
                /*#__PURE__*/React.createElement("div", { style: { flex: 1, minWidth: 0 } },
                  /*#__PURE__*/React.createElement("span", { style: { fontSize: 12.5, fontWeight: isActive ? 700 : 500, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, dm.peerName || dm.peerId),
                  /*#__PURE__*/React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 3, marginTop: 2 } },
                    /*#__PURE__*/React.createElement("span", { style: { fontSize: 8, padding: '1px 5px', borderRadius: 10, background: 'var(--purple-dim)', color: 'var(--purple)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px' } }, "DM"),
                    /*#__PURE__*/React.createElement(ConnectionBadges, { userType: dm.peerType || 'provider', teamName: dm.teamName, teamColors: teamColorsList, size: "xs" })
                  )
                )
              ));
            })
          );
        }),
        ungroupedDMs.length > 0 && /*#__PURE__*/React.createElement(React.Fragment, null,
          teamNames.length > 0 && renderSectionHdr("Other DMs", ungroupedDMs.length, "users", "var(--purple)"),
          ...ungroupedDMs.map(dm => {
            const isActive = inboxConvo === dm.roomId;
            return /*#__PURE__*/React.createElement("div", {
              key: dm.roomId,
              onClick: () => openInboxConvo(dm.roomId),
              style: { padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border-0)', background: isActive ? 'var(--bg-4)' : 'transparent', borderLeft: isActive ? '3px solid var(--purple)' : '3px solid transparent', transition: 'all .15s' },
              onMouseEnter: e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-3)'; },
              onMouseLeave: e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }
            }, /*#__PURE__*/React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 8 } },
              /*#__PURE__*/React.createElement("div", { style: { width: 32, height: 32, borderRadius: '50%', background: 'var(--purple-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--purple)', border: '2px solid var(--purple)', flexShrink: 0 } }, /*#__PURE__*/React.createElement(I, { n: "user", s: 14 })),
              /*#__PURE__*/React.createElement("div", { style: { flex: 1, minWidth: 0 } },
                /*#__PURE__*/React.createElement("span", { style: { fontSize: 12.5, fontWeight: isActive ? 700 : 500, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, dm.peerName || dm.peerId),
                /*#__PURE__*/React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 3, marginTop: 2 } },
                  /*#__PURE__*/React.createElement("span", { style: { fontSize: 8, padding: '1px 5px', borderRadius: 10, background: 'var(--purple-dim)', color: 'var(--purple)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px' } }, "DM")
                )
              )
            ));
          })
        )
      )
    );
  })())), /*#__PURE__*/React.createElement("div", {
    className: "inbox-chat"
  }, inboxConvo !== null && (typeof inboxConvo === 'string' || providers[inboxConvo]) ? (() => {
    const isTeamDM = typeof inboxConvo === 'string';
    const p = isTeamDM ? null : providers[inboxConvo];
    const dm = isTeamDM ? clientTeamDMs.find(d => d.roomId === inboxConvo) : null;
    const chatName = isTeamDM ? (dm?.peerName || dm?.peerId || 'Team Member') : (p?.providerName || p?.providerUserId || 'Unknown');
    const avatarClr = isTeamDM ? 'purple' : 'gold';
    return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
      className: "inbox-chat-hdr"
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 32,
        height: 32,
        borderRadius: '50%',
        background: `var(--${avatarClr}-dim)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: `var(--${avatarClr})`,
        border: `2px solid var(--${avatarClr})`
      }
    }, !isTeamDM && p?.providerProfile?.org_membership?.verified ? /*#__PURE__*/React.createElement(I, {
      n: "shieldCheck",
      s: 14
    }) : /*#__PURE__*/React.createElement(I, {
      n: "user",
      s: 14
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 14,
        fontWeight: 700,
        display: 'block'
      }
    }, chatName), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        flexWrap: 'wrap'
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "tag tag-green",
      style: {
        fontSize: 8
      }
    }, /*#__PURE__*/React.createElement(I, {
      n: "lock",
      s: 8
    }), "E2EE"), isTeamDM ? /*#__PURE__*/React.createElement(ConnectionBadges, {
      userType: dm?.peerType || 'provider',
      teamName: dm?.teamName,
      size: "xs"
    }) : /*#__PURE__*/React.createElement(ConnectionBadges, {
      userType: "provider",
      orgName: p?.providerProfile?.org_membership?.verified ? p.providerProfile.org_membership.org_name : null,
      orgType: p?.providerProfile?.org_membership?.org_type,
      teamName: (() => { const t = myTeams.find(t => (t.members || []).some(m => m.userId === p?.providerUserId)); return t?.name || null; })(),
      verified: p?.providerProfile?.org_membership?.verified,
      role: p?.providerProfile?.org_membership?.role,
      size: "xs"
    }), !isTeamDM && p?.providerProfile?.title && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 10,
        color: 'var(--tx-2)'
      }
    }, p.providerProfile.title))), !isTeamDM && p && /*#__PURE__*/React.createElement("button", {
      onClick: () => openBridge(p.bridgeRoomId),
      className: "b-gho b-xs",
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 4
      }
    }, /*#__PURE__*/React.createElement(I, {
      n: "share",
      s: 11
    }), "Bridge"), /*#__PURE__*/React.createElement("button", {
      onClick: () => loadInboxMessages(isTeamDM ? inboxConvo : p.bridgeRoomId),
      className: "b-gho b-xs",
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 4
      }
    }, /*#__PURE__*/React.createElement(I, {
      n: "refresh-cw",
      s: 11
    }))), /*#__PURE__*/React.createElement("div", {
      className: "inbox-msgs"
    }, inboxMessages.length === 0 ? /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column'
      }
    }, /*#__PURE__*/React.createElement(I, {
      n: "msg",
      s: 32,
      c: "var(--tx-3)"
    }), /*#__PURE__*/React.createElement("p", {
      style: {
        color: 'var(--tx-3)',
        fontSize: 12,
        marginTop: 10
      }
    }, "No messages yet"), /*#__PURE__*/React.createElement("p", {
      style: {
        color: 'var(--tx-3)',
        fontSize: 11,
        marginTop: 4
      }
    }, "Start the conversation below")) : [...inboxMessages].reverse().map((msg, i) => {
      const isOwn = msg.sender === svc.userId;
      return /*#__PURE__*/React.createElement("div", {
        key: msg.id || i,
        style: {
          display: 'flex',
          flexDirection: 'column',
          alignItems: isOwn ? 'flex-end' : 'flex-start',
          marginBottom: 4
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          maxWidth: '75%',
          padding: '10px 14px',
          borderRadius: isOwn ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
          background: isOwn ? 'var(--teal-dim)' : 'var(--bg-3)',
          border: `1px solid ${isOwn ? 'rgba(62,201,176,.2)' : 'var(--border-0)'}`,
          transition: 'transform .1s'
        }
      }, /*#__PURE__*/React.createElement("p", {
        style: {
          fontSize: 12.5,
          color: 'var(--tx-0)',
          lineHeight: 1.5,
          wordBreak: 'break-word'
        }
      }, msg.content?.body)), /*#__PURE__*/React.createElement("div", {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          marginTop: 3,
          padding: '0 6px'
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          fontFamily: 'var(--mono)',
          fontSize: 9,
          color: isOwn ? 'var(--teal)' : 'var(--gold)'
        }
      }, isOwn ? 'You' : p.providerName || msg.sender), /*#__PURE__*/React.createElement("span", {
        style: {
          fontFamily: 'var(--mono)',
          fontSize: 8,
          color: 'var(--tx-3)'
        }
      }, msg.ts ? new Date(msg.ts).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      }) : '')));
    })), /*#__PURE__*/React.createElement("div", {
      className: "inbox-compose"
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("input", {
      value: inboxMsgText,
      onChange: e => setInboxMsgText(e.target.value),
      placeholder: "Type a message (E2EE)...",
      onKeyDown: e => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          handleSendInboxMsg();
        }
      },
      style: {
        flex: 1,
        borderRadius: 20,
        padding: '10px 18px'
      }
    }), /*#__PURE__*/React.createElement("button", {
      onClick: handleSendInboxMsg,
      className: "b-pri",
      disabled: !inboxMsgText.trim(),
      style: {
        borderRadius: 20,
        width: 42,
        height: 42,
        padding: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }
    }, /*#__PURE__*/React.createElement(I, {
      n: "send",
      s: 16
    })))));
  })() : /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 64,
      height: 64,
      borderRadius: '50%',
      background: 'var(--teal-dim)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--teal)',
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "inbox",
    s: 28
  })), /*#__PURE__*/React.createElement("h3", {
    style: {
      fontSize: 16,
      fontWeight: 700,
      marginBottom: 6
    }
  }, "Your Inbox"), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--tx-2)',
      fontSize: 12,
      maxWidth: 280,
      textAlign: 'center',
      lineHeight: 1.6
    }
  }, providers.length > 0 ? 'Select a conversation from the left to start chatting with your providers.' : 'Add a provider to begin your first encrypted conversation.'), providers.length === 0 && /*#__PURE__*/React.createElement("button", {
    onClick: () => setAddProviderModal(true),
    className: "b-pri",
    style: {
      marginTop: 14,
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "plus",
    s: 14
  }), "Add Provider"))))), view === 'bridge' && activeBridge && activeProvider && /*#__PURE__*/React.createElement("div", {
    className: "anim-up",
    style: {
      maxWidth: 820,
      margin: '0 auto'
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setView('providers');
      setActiveBridge(null);
    },
    className: "b-gho b-sm",
    style: {
      marginBottom: 14,
      display: 'flex',
      alignItems: 'center',
      gap: 4
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "back",
    s: 13
  }), "Back"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", {
    style: {
      fontFamily: 'var(--serif)',
      fontSize: 20,
      fontWeight: 700
    }
  }, "Bridge: ", activeProvider.providerName || activeProvider.providerUserId), activeProvider.providerProfile?.title && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: 'var(--tx-2)',
      display: 'block',
      marginTop: 2
    }
  }, activeProvider.providerProfile.title), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      marginTop: 4,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "tag tag-green"
  }, /*#__PURE__*/React.createElement(I, {
    n: "lock",
    s: 9
  }), "Megolm + AES-GCM"), activeProvider.providerProfile?.org_membership?.verified && /*#__PURE__*/React.createElement("span", {
    className: "tag tag-blue"
  }, /*#__PURE__*/React.createElement(I, {
    n: "shieldCheck",
    s: 9
  }), activeProvider.providerProfile.org_membership.org_name), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--mono)',
      fontSize: 9.5,
      color: 'var(--tx-3)'
    }
  }, activeBridge))), /*#__PURE__*/React.createElement("button", {
    onClick: () => setHardRevokeTarget(activeProviderIdx),
    className: "b-red b-sm"
  }, /*#__PURE__*/React.createElement(I, {
    n: "zap",
    s: 12
  }), "Hard Revoke")), /*#__PURE__*/React.createElement(StorageTransparencyBadge, {
    storageType: "matrix",
    roomId: activeBridge,
    encrypted: true,
    encLabel: "Megolm E2EE",
    label: "Bridge Room",
    members: [{ userId: svc.userId, role: 'client' }, { userId: activeProvider.providerUserId, role: 'provider' }],
    extra: [{ label: 'Bridge type', value: 'Shared room between you and this provider. Data you share here is visible to both parties.' }, { label: 'Your power level', value: activeProvider._bridgeMeta?.client === svc.userId ? '100 (admin)' : '50' }]
  }), activeProvider.providerProfile?.org_membership?.verified && /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--blue-dim)',
      border: '1px solid rgba(91,156,245,.15)',
      borderRadius: 'var(--r)',
      padding: '10px 14px',
      marginBottom: 16,
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 28,
      height: 28,
      borderRadius: '50%',
      background: 'var(--bg-3)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--blue)',
      border: '2px solid var(--blue)'
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "shieldCheck",
    s: 14
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      fontWeight: 700,
      color: 'var(--blue)'
    }
  }, activeProvider.providerProfile.org_membership.org_name), activeProvider.providerProfile.org_membership.email_verified ? /*#__PURE__*/React.createElement("span", {
    className: "tag tag-green",
    style: {
      fontSize: 7.5,
      padding: '1px 5px'
    }
  }, "EMAIL VERIFIED") : /*#__PURE__*/React.createElement("span", {
    className: "tag tag-green",
    style: {
      fontSize: 7.5,
      padding: '1px 5px'
    }
  }, "VERIFIED")), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      color: 'var(--tx-2)',
      fontFamily: 'var(--mono)'
    }
  }, activeProvider.providerProfile.org_membership.org_type ? (ORG_TYPE_LABELS[activeProvider.providerProfile.org_membership.org_type] || activeProvider.providerProfile.org_membership.org_type) + ' · ' : '', activeProvider.providerProfile.org_membership.role), activeProvider.providerProfile.org_membership.verified_domain && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 9,
      color: 'var(--green)',
      fontFamily: 'var(--mono)',
      display: 'block',
      marginTop: 2
    }
  }, "@", activeProvider.providerProfile.org_membership.verified_domain)), activeProvider.providerProfile.credentials && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 9.5,
      color: 'var(--tx-2)',
      fontFamily: 'var(--mono)'
    }
  }, activeProvider.providerProfile.credentials)), /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "CURRENTLY SHARED"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 6,
      marginTop: 4
    }
  }, allFields.filter(f => activeProvider.sharedFields?.[f.key]).map(f => /*#__PURE__*/React.createElement("span", {
    key: f.key,
    className: "tag tag-blue"
  }, f.label)), Object.values(activeProvider.sharedFields || {}).filter(Boolean).length === 0 && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: 'var(--tx-3)'
    }
  }, "No fields shared"))), /*#__PURE__*/React.createElement("div", {
    className: "card"
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "MESSAGES"), /*#__PURE__*/React.createElement("div", {
    style: {
      maxHeight: 280,
      overflow: 'auto',
      marginBottom: 12
    }
  }, bridgeMessages.length === 0 ? /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--tx-3)',
      fontSize: 12,
      padding: '14px 0',
      textAlign: 'center'
    }
  }, "No messages yet") : bridgeMessages.map((msg, i) => /*#__PURE__*/React.createElement("div", {
    key: msg.id || i,
    style: {
      padding: '8px 0',
      borderBottom: '1px solid var(--border-0)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      marginBottom: 3
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--mono)',
      fontSize: 10,
      color: msg.sender === svc.userId ? 'var(--teal)' : 'var(--gold)'
    }
  }, msg.sender === svc.userId ? 'You' : msg.sender), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--mono)',
      fontSize: 9,
      color: 'var(--tx-3)'
    }
  }, msg.ts ? new Date(msg.ts).toLocaleString() : '')), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12.5,
      color: 'var(--tx-1)'
    }
  }, msg.content?.body)))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("input", {
    value: msgText,
    onChange: e => setMsgText(e.target.value),
    placeholder: "Message (E2EE)...",
    onKeyDown: e => {
      if (e.key === 'Enter' && !e.shiftKey) handleSendBridgeMsg();
    },
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("button", {
    onClick: handleSendBridgeMsg,
    className: "b-pri"
  }, /*#__PURE__*/React.createElement(I, {
    n: "send",
    s: 13
  }))))), view === 'activity' && !activeBridge && /*#__PURE__*/React.createElement(ActivityStream, {
    session: session
  }), view === 'transparency' && !activeBridge && /*#__PURE__*/React.createElement(TransparencyPage, {
    onBack: () => setView('dashboard')
  })), /*#__PURE__*/React.createElement(Modal, {
    open: shareContactModal,
    onClose: () => setShareContactModal(false),
    title: "Share My Details",
    w: 400
  }, /*#__PURE__*/React.createElement("div", {
    style: { background: 'var(--bg-1)', border: '1px solid var(--border-1)', borderRadius: 'var(--r-lg)', padding: '14px 16px', marginBottom: 16 }
  }, /*#__PURE__*/React.createElement("div", {
    style: { fontSize: 15, fontWeight: 700, color: 'var(--tx-0)', marginBottom: 4 }
  }, vaultData.full_name || svc.userId?.split(':')[0]?.replace('@', '') || 'Anonymous'),
  vaultData.email && /*#__PURE__*/React.createElement("div", {
    style: { fontSize: 12, color: 'var(--tx-1)', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 6 }
  }, /*#__PURE__*/React.createElement(I, { n: "mail", s: 12, c: "var(--tx-2)" }), vaultData.email),
  vaultData.phone && /*#__PURE__*/React.createElement("div", {
    style: { fontSize: 12, color: 'var(--tx-1)', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 6 }
  }, /*#__PURE__*/React.createElement(I, { n: "phone", s: 12, c: "var(--tx-2)" }), vaultData.phone),
  /*#__PURE__*/React.createElement("div", {
    style: { fontSize: 10, color: 'var(--tx-3)', fontFamily: 'var(--mono)', marginTop: 6 }
  }, svc.userId)),
  !vaultData.full_name && !vaultData.email && !vaultData.phone && /*#__PURE__*/React.createElement("p", {
    style: { fontSize: 11, color: 'var(--tx-2)', fontStyle: 'italic', marginBottom: 12 }
  }, "Add your name, email, or phone in My Vault to include them when sharing."),
  /*#__PURE__*/React.createElement("div", {
    style: { display: 'flex', gap: 8 }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: copyContact,
    style: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 0', background: 'var(--bg-3)', border: '1px solid var(--border-1)', borderRadius: 'var(--r)', cursor: 'pointer', color: copiedField === 'contact' ? 'var(--green)' : 'var(--tx-1)', fontSize: 12, fontWeight: 600, transition: 'all .2s' }
  }, /*#__PURE__*/React.createElement(I, { n: copiedField === 'contact' ? "check" : "copy", s: 14 }), copiedField === 'contact' ? 'Copied!' : 'Copy'),
  /*#__PURE__*/React.createElement("button", {
    onClick: shareContactViaSMS,
    style: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 0', background: 'var(--bg-3)', border: '1px solid var(--border-1)', borderRadius: 'var(--r)', cursor: 'pointer', color: 'var(--tx-1)', fontSize: 12, fontWeight: 600, transition: 'all .2s' }
  }, /*#__PURE__*/React.createElement(I, { n: "msg", s: 14 }), "Text"),
  /*#__PURE__*/React.createElement("button", {
    onClick: shareContactViaEmail,
    style: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 0', background: 'var(--bg-3)', border: '1px solid var(--border-1)', borderRadius: 'var(--r)', cursor: 'pointer', color: 'var(--tx-1)', fontSize: 12, fontWeight: 600, transition: 'all .2s' }
  }, /*#__PURE__*/React.createElement(I, { n: "mail", s: 14 }), "Email"))),

  /*#__PURE__*/React.createElement(Modal, {
    open: editModal,
    onClose: () => setEditModal(false),
    title: "Edit Vault Data",
    w: 540
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12,
      color: 'var(--tx-1)',
      marginBottom: 16,
      lineHeight: 1.6
    }
  }, "Changes to shared fields are re-encrypted with new keys per provider. Each edit emits EO operations (INS/ALT/NUL) to the vault timeline."), allCategories.map(cat => {
    const fields = allFields.filter(f => f.category === cat);
    if (!fields.length) return null;
    return /*#__PURE__*/React.createElement("div", {
      key: cat,
      style: {
        marginBottom: 14
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "section-label"
    }, (CAT_LABELS[cat] || cat.charAt(0).toUpperCase() + cat.slice(1)).toUpperCase()), fields.map(f => /*#__PURE__*/React.createElement("div", {
      key: f.key,
      style: {
        marginBottom: 8
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        marginBottom: 3
      }
    }, /*#__PURE__*/React.createElement("label", {
      style: {
        fontSize: 11.5,
        color: 'var(--tx-1)'
      }
    }, f.label), f.sensitive && /*#__PURE__*/React.createElement("span", {
      className: "tag tag-red",
      style: {
        fontSize: 8
      }
    }, "SENSITIVE"), f.custom && /*#__PURE__*/React.createElement("span", {
      className: "tag tag-purple",
      style: {
        fontSize: 8
      }
    }, "CUSTOM"), f.framework && /*#__PURE__*/React.createElement("span", {
      className: `tag tag-${FRAMEWORK_BY_ID[f.framework]?.accent || 'blue'}`,
      style: {
        fontSize: 8
      }
    }, f.frameworkName)), ['case_notes', 'history', 'medical', 'documents'].includes(f.key) || f.custom && f.category === 'case' ? /*#__PURE__*/React.createElement("textarea", {
      value: editData[f.key] || '',
      onChange: e => setEditData({
        ...editData,
        [f.key]: e.target.value
      }),
      placeholder: `Enter ${f.label.toLowerCase()}...`,
      style: {
        minHeight: 50
      }
    }) : /*#__PURE__*/React.createElement("input", {
      value: editData[f.key] || '',
      onChange: e => setEditData({
        ...editData,
        [f.key]: e.target.value
      }),
      placeholder: `Enter ${f.label.toLowerCase()}...`
    }))));
  }), /*#__PURE__*/React.createElement("button", {
    onClick: handleEditSave,
    className: "b-pri",
    style: {
      width: '100%'
    }
  }, "Save & Re-encrypt Shared Fields")), /*#__PURE__*/React.createElement(Modal, {
    open: addProviderModal,
    onClose: () => setAddProviderModal(false),
    title: "Add Provider"
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12,
      color: 'var(--tx-1)',
      marginBottom: 14,
      lineHeight: 1.6
    }
  }, "Creates a new encrypted bridge room and invites the provider. No data shared until you toggle fields on."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "PROVIDER MATRIX ID"), /*#__PURE__*/React.createElement("input", {
    value: newProviderId,
    onChange: e => setNewProviderId(e.target.value),
    placeholder: "@provider:matrix.org"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--teal-dim)',
      border: '1px solid rgba(62,201,176,.15)',
      borderRadius: 'var(--r)',
      padding: '10px 14px',
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11.5,
      color: 'var(--tx-1)',
      lineHeight: 1.5
    }
  }, "Bridge uses Megolm + per-field AES-256-GCM. Keys destroyed on revocation.")), /*#__PURE__*/React.createElement("button", {
    onClick: handleAddProvider,
    className: "b-pri",
    style: {
      width: '100%'
    }
  }, "Create Bridge Room")), /*#__PURE__*/React.createElement(Modal, {
    open: newTeamDMModal,
    onClose: () => { setNewTeamDMModal(false); setNewDMTarget(null); },
    title: "New Team Member DM",
    w: 480
  }, /*#__PURE__*/React.createElement("p", {
    style: { fontSize: 12, color: 'var(--tx-1)', marginBottom: 14, lineHeight: 1.6 }
  }, "Start an encrypted direct conversation with a team member."),
  clientTeamMemberContacts.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: { textAlign: 'center', padding: '20px 0', color: 'var(--tx-3)', fontSize: 12 }
  }, "No team members found. Join a team first.") : /*#__PURE__*/React.createElement("div", {
    style: { display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflow: 'auto', marginBottom: 16 }
  }, clientTeamMemberContacts.map(c => /*#__PURE__*/React.createElement("div", {
    key: c.userId,
    onClick: () => setNewDMTarget(c),
    style: {
      padding: '10px 14px', borderRadius: 'var(--r)', border: `1px solid ${newDMTarget?.userId === c.userId ? 'var(--purple)' : 'var(--border-0)'}`,
      background: newDMTarget?.userId === c.userId ? 'var(--purple-dim)' : 'var(--bg-2)', cursor: 'pointer', transition: 'all .15s'
    }
  }, /*#__PURE__*/React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' } },
    /*#__PURE__*/React.createElement("div", { style: { flex: 1, minWidth: 0 } },
      /*#__PURE__*/React.createElement("span", { style: { fontSize: 13, fontWeight: 600, display: 'block' } }, c.displayName),
      /*#__PURE__*/React.createElement("div", { style: { marginTop: 3 } },
        /*#__PURE__*/React.createElement(ConnectionBadges, { userType: "provider", teamName: c.teamName, role: c.role, size: "xs" }))),
    c.hasDM && /*#__PURE__*/React.createElement("span", { className: "tag tag-green", style: { fontSize: 8 } }, "DM exists"))))),
  newDMTarget && /*#__PURE__*/React.createElement("button", {
    onClick: () => startClientTeamDM(newDMTarget.userId, newDMTarget.displayName, newDMTarget.teamName, newDMTarget.teamRoomId),
    className: "b-pri",
    style: { width: '100%', padding: 12, fontSize: 14 }
  }, /*#__PURE__*/React.createElement(I, { n: "msg", s: 16 }), " Start Conversation with ", newDMTarget.displayName)), /*#__PURE__*/React.createElement(Modal, {
    open: !!obsModal,
    onClose: () => setObsModal(null),
    title: obsModal?.question || 'Record Observation',
    w: 500
  }, obsModal && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "DATE"), /*#__PURE__*/React.createElement("input", {
    type: "date",
    value: obsDate,
    onChange: e => setObsDate(e.target.value)
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "RESPONSE"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 4
    }
  }, obsModal.options.map(o => /*#__PURE__*/React.createElement("div", {
    key: o.v,
    onClick: () => setObsValue(o.v),
    style: {
      padding: '10px 14px',
      borderRadius: 'var(--r)',
      cursor: 'pointer',
      border: `1px solid ${obsValue === o.v ? 'var(--teal)' : 'var(--border-1)'}`,
      background: obsValue === o.v ? 'var(--teal-dim)' : 'var(--bg-3)',
      transition: 'all .15s'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12.5,
      color: obsValue === o.v ? 'var(--teal)' : 'var(--tx-1)'
    }
  }, o.l))))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "ADDITIONAL NOTES (OPTIONAL)"), /*#__PURE__*/React.createElement("textarea", {
    value: obsFreeText,
    onChange: e => setObsFreeText(e.target.value),
    placeholder: "Any additional context...",
    style: {
      minHeight: 50
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--teal-dim)',
      borderRadius: 'var(--r)',
      padding: '8px 12px',
      marginBottom: 14,
      fontSize: 11,
      color: 'var(--teal)'
    }
  }, "This observation will be recorded as a GIVEN event in your vault \u2014 immutable, append-only."), /*#__PURE__*/React.createElement("button", {
    onClick: handleRecordObservation,
    className: "b-pri",
    disabled: !obsValue,
    style: {
      width: '100%'
    }
  }, "Record Observation"))), /*#__PURE__*/React.createElement(Modal, {
    open: hardRevokeTarget !== null,
    onClose: () => setHardRevokeTarget(null),
    title: "Hard Revoke",
    w: 440
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--red-dim)',
      border: '1px solid rgba(232,93,93,.15)',
      borderRadius: 'var(--r)',
      padding: '12px 16px',
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12.5,
      color: 'var(--red)',
      fontWeight: 600,
      marginBottom: 4
    }
  }, "Destructive operation"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 11.5,
      color: 'var(--tx-1)',
      lineHeight: 1.6
    }
  }, "Current bridge will be ", /*#__PURE__*/React.createElement("strong", null, "tombstoned"), ", provider ", /*#__PURE__*/React.createElement("strong", null, "kicked"), ". A new bridge with ", /*#__PURE__*/React.createElement("strong", null, "fresh encryption keys"), " is created for any still-shared fields.")), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 11.5,
      color: 'var(--tx-2)',
      marginBottom: 14,
      lineHeight: 1.6
    }
  }, /*#__PURE__*/React.createElement("strong", null, "Caveat:"), " If the provider previously decrypted and cached data, we cannot delete it from their device. This prevents future access, not retroactive erasure."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setHardRevokeTarget(null),
    className: "b-gho",
    style: {
      flex: 1
    }
  }, "Cancel"), /*#__PURE__*/React.createElement("button", {
    onClick: () => handleHardRevoke(hardRevokeTarget),
    className: "b-red",
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "zap",
    s: 13
  }), "Execute"))), /*#__PURE__*/React.createElement(Modal, {
    open: !!clientSharingConsentModal,
    onClose: () => setClientSharingConsentModal(null),
    title: "Content Sharing Preference",
    w: 480
  }, clientSharingConsentModal && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--gold-dim)',
      border: '1px solid rgba(218,165,32,.15)',
      borderRadius: 'var(--r)',
      padding: '14px 18px',
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      alignItems: 'flex-start'
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "shield",
    s: 16,
    c: "var(--gold)"
  }), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12,
      color: 'var(--tx-1)',
      lineHeight: 1.7,
      margin: 0
    }
  }, "As a member of ", /*#__PURE__*/React.createElement("strong", null, clientSharingConsentModal.team?.name || 'this team'), ", content created about the individuals this team serves may be shared with you."))), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 13,
      fontWeight: 600,
      color: 'var(--tx-0)',
      marginBottom: 6
    }
  }, "Would you like to withhold content about individuals from being shared with you?"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 11.5,
      color: 'var(--tx-2)',
      lineHeight: 1.6,
      marginBottom: 18
    }
  }, "By default, relevant content is shared with all team members to support coordination. If you choose to withhold, you will not receive content created about individuals served by this team."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => handleClientSharingConsent(clientSharingConsentModal.team, false),
    className: "b-pri",
    style: {
      width: '100%',
      padding: '12px 16px',
      fontSize: 13,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "check",
    s: 14
  }), " No, share content with me"), /*#__PURE__*/React.createElement("button", {
    onClick: () => handleClientSharingConsent(clientSharingConsentModal.team, true),
    className: "b-gho",
    style: {
      width: '100%',
      padding: '12px 16px',
      fontSize: 13,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      color: 'var(--red)'
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "lock",
    s: 14
  }), " Yes, withhold content from me")), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--bg-3)',
      borderRadius: 'var(--r)',
      padding: '10px 14px',
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 10.5,
      color: 'var(--tx-3)',
      lineHeight: 1.6,
      margin: 0
    }
  }, "You can change this preference at any time from your teams view. This choice is recorded as an epistemic operation for full auditability.")))), /*#__PURE__*/React.createElement(Modal, {
    open: addFieldModal,
    onClose: () => {
      setAddFieldModal(false);
      setNewFieldLabel('');
      setNewFieldCategory('details');
      setNewFieldSensitive(false);
      setNewFieldDefinition('');
    },
    title: "Add Custom Field",
    w: 440
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12,
      color: 'var(--tx-1)',
      marginBottom: 16,
      lineHeight: 1.6
    }
  }, "Create a new field to store any data you want in your vault. Custom fields work just like built-in fields \u2014 encrypted, shareable, and fully under your control."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "FIELD NAME"), /*#__PURE__*/React.createElement("input", {
    value: newFieldLabel,
    onChange: e => setNewFieldLabel(e.target.value),
    placeholder: "e.g. Emergency Contact, Preferred Language...",
    autoFocus: true,
    onKeyDown: e => {
      if (e.key === 'Enter' && newFieldLabel.trim()) handleAddCustomField();
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "CATEGORY"), /*#__PURE__*/React.createElement("select", {
    value: newFieldCategory,
    onChange: e => setNewFieldCategory(e.target.value),
    style: {
      width: '100%'
    }
  }, FIELD_CATEGORIES.map(c => /*#__PURE__*/React.createElement("option", {
    key: c,
    value: c
  }, CAT_LABELS[c])))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      fontWeight: 500
    }
  }, "Sensitive field"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 10.5,
      color: 'var(--tx-2)',
      marginTop: 2
    }
  }, "Sensitive fields are masked in the vault view")), /*#__PURE__*/React.createElement(Toggle, {
    on: newFieldSensitive,
    onChange: () => setNewFieldSensitive(!newFieldSensitive)
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "DEFINITION *"), /*#__PURE__*/React.createElement("textarea", {
    value: newFieldDefinition,
    onChange: e => setNewFieldDefinition(e.target.value),
    placeholder: "Describe what this field means and how it should be interpreted (min 20 characters)...",
    rows: 3,
    style: {
      width: '100%',
      resize: 'vertical'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      color: newFieldDefinition.trim().length >= 20 ? 'var(--green)' : 'var(--tx-3)',
      marginTop: 3,
      textAlign: 'right'
    }
  }, newFieldDefinition.trim().length, "/20 characters min")), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--purple-dim)',
      border: '1px solid rgba(167,139,250,.15)',
      borderRadius: 'var(--r)',
      padding: '10px 14px',
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11.5,
      color: 'var(--tx-1)',
      lineHeight: 1.5
    }
  }, "Custom fields are encrypted with AES-256-GCM, stored in your vault, and can be selectively shared with providers \u2014 identical to built-in fields.")), /*#__PURE__*/React.createElement("button", {
    onClick: handleAddCustomField,
    className: "b-pri",
    disabled: !newFieldLabel.trim() || newFieldDefinition.trim().length < 20,
    style: {
      width: '100%'
    }
  }, "Create Field")), /*#__PURE__*/React.createElement(Modal, {
    open: frameworkModal,
    onClose: () => setFrameworkModal(false),
    title: "Data Field Frameworks",
    w: 640
  }, /*#__PURE__*/React.createElement(FrameworkTogglePanel, {
    enabledFrameworks: enabledFrameworks,
    onToggle: async next => {
      setEnabledFrameworks(next);
      await saveSnapshot(undefined, undefined, undefined, undefined, next);
      const delta = next.length - enabledFrameworks.length;
      if (delta > 0) showToast(`Framework enabled — ${getFrameworkFields(next).length} total fields`, 'success');else if (delta < 0) showToast('Framework disabled', 'warn');
    }
  })));
};
