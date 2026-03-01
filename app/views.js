const UriLibraryBrowser = ({ open, onClose, onSelect, mode = 'select' }) => {
  const [search, setSearch] = useState('');
  const [selectedLib, setSelectedLib] = useState('all');
  const [selectedCat, setSelectedCat] = useState('all');
  const [selectedEntry, setSelectedEntry] = useState(null);

  if (!open) return null;

  const results = searchUriLibraries(search, {
    libraryId: selectedLib !== 'all' ? selectedLib : undefined,
    category: selectedCat !== 'all' ? selectedCat : undefined,
    limit: 80
  });

  // Gather all categories from current results pool for filter chips
  const pool = selectedLib !== 'all'
    ? URI_LIBRARY_INDEX.filter(e => e.library_id === selectedLib)
    : URI_LIBRARY_INDEX;
  const categories = [...new Set(pool.map(e => e.category).filter(Boolean))].sort();

  const activeLib = selectedLib !== 'all' ? URI_LIBRARIES.find(l => l.id === selectedLib) : null;

  const typeColor = dt => {
    const m = { text: 'blue', select: 'teal', date: 'gold', number: 'orange', boolean: 'green',
      email: 'blue', phone: 'blue', address: 'gold', text_long: 'purple', document: 'orange',
      single_select: 'teal', multi_select: 'teal', duration: 'gold' };
    return m[dt] || 'blue';
  };

  const handleSelect = entry => {
    if (onSelect) {
      onSelect({
        uri: entry.uri,
        key: entry.label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, ''),
        label: entry.label,
        definition: entry.definition,
        data_type: entry.data_type || 'text',
        category: entry.category || 'general',
        tags: entry.tags || [],
        source_library: entry.library_name,
        source_library_id: entry.library_id
      });
    }
    onClose();
  };

  return ReactDOM.createPortal(React.createElement('div', {
    className: 'uri-browser-overlay',
    onClick: e => { if (e.target === e.currentTarget) onClose(); }
  },
    React.createElement('div', { className: 'uri-browser' },
      // Header
      React.createElement('div', { className: 'uri-browser-header' },
        React.createElement('div', { className: 'uri-browser-header-row' },
          React.createElement('div', { className: 'uri-browser-title' },
            React.createElement(I, { n: 'globe', s: 18, c: 'var(--teal)' }),
            mode === 'link' ? 'Link to Standard URI' : 'Browse URI Libraries'
          ),
          React.createElement('button', { className: 'uri-browser-close', onClick: onClose }, '\u2715')
        ),
        // Search
        React.createElement('div', { className: 'uri-browser-search' },
          React.createElement('span', { className: 'uri-browser-search-icon' },
            React.createElement(I, { n: 'search', s: 14, c: 'var(--tx-3)' })
          ),
          React.createElement('input', {
            value: search,
            onChange: e => setSearch(e.target.value),
            placeholder: 'Search by name, definition, URI, or keyword\u2026',
            autoFocus: true
          })
        ),
        // Library filter chips
        React.createElement('div', { className: 'uri-browser-filters' },
          React.createElement('button', {
            className: `uri-browser-lib-chip${selectedLib === 'all' ? ' active' : ''}`,
            onClick: () => { setSelectedLib('all'); setSelectedCat('all'); }
          }, 'All Libraries'),
          URI_LIBRARIES.map(lib => React.createElement('button', {
            key: lib.id,
            className: `uri-browser-lib-chip${selectedLib === lib.id ? ' active' : ''}`,
            onClick: () => { setSelectedLib(lib.id); setSelectedCat('all'); }
          },
            React.createElement('span', { className: 'uri-browser-lib-dot', style: { background: `var(--${lib.color})` } }),
            lib.name,
            React.createElement('span', { style: { fontSize: 9, opacity: .6, fontFamily: 'var(--mono)' } }, lib.entries.length)
          ))
        ),
        // Category chips (contextual to selected library)
        categories.length > 1 && React.createElement('div', { className: 'uri-browser-cat-chips', style: { marginBottom: 14 } },
          React.createElement('button', {
            className: `uri-browser-cat-chip${selectedCat === 'all' ? ' active' : ''}`,
            onClick: () => setSelectedCat('all')
          }, 'All'),
          categories.map(c => React.createElement('button', {
            key: c,
            className: `uri-browser-cat-chip${selectedCat === c ? ' active' : ''}`,
            onClick: () => setSelectedCat(c)
          }, c))
        )
      ),
      // Body
      React.createElement('div', { className: 'uri-browser-body' },
        // Active library info bar
        activeLib && React.createElement('div', { className: 'uri-browser-lib-info' },
          React.createElement('div', null,
            React.createElement('div', { className: 'uri-browser-lib-info-name' }, activeLib.name),
            React.createElement('div', null, activeLib.description),
            React.createElement('div', { style: { marginTop: 4, fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--teal)' } }, 'Prefix: ', activeLib.prefix)
          )
        ),
        // Results count
        React.createElement('div', { className: 'uri-browser-results-count' },
          React.createElement('span', null, results.length, ' ', results.length === 1 ? 'result' : 'results'),
          search && React.createElement('span', null, ' for "', search, '"')
        ),
        // Results grid
        results.length === 0
          ? React.createElement('div', { className: 'uri-browser-empty' },
              React.createElement('div', { className: 'uri-browser-empty-icon' }, React.createElement(I, { n: 'search', s: 28, c: 'var(--tx-3)' })),
              React.createElement('div', null, search ? `No URIs matching "${search}"` : 'No entries in this category.'),
              React.createElement('div', { style: { fontSize: 11, marginTop: 4 } }, 'Try a different search term or browse another library.')
            )
          : React.createElement('div', { className: 'uri-browser-grid' },
              results.map(entry => React.createElement('div', {
                key: entry.uri,
                className: `uri-browser-entry${selectedEntry === entry.uri ? ' selected' : ''}`,
                onClick: () => setSelectedEntry(selectedEntry === entry.uri ? null : entry.uri)
              },
                // Color dot / icon
                React.createElement('div', {
                  className: 'uri-browser-entry-icon',
                  style: { background: `var(--${entry.library_color}-dim)`, color: `var(--${entry.library_color})` }
                }, entry.label.charAt(0).toUpperCase()),
                // Body
                React.createElement('div', { className: 'uri-browser-entry-body' },
                  React.createElement('div', { className: 'uri-browser-entry-label' }, entry.label),
                  React.createElement('div', { className: 'uri-browser-entry-uri' }, entry.uri),
                  React.createElement('div', { className: 'uri-browser-entry-def' }, entry.definition),
                  React.createElement('div', { className: 'uri-browser-entry-tags' },
                    React.createElement('span', {
                      className: 'uri-browser-entry-lib',
                      style: { background: `var(--${entry.library_color}-dim)`, color: `var(--${entry.library_color})` }
                    }, entry.library_name),
                    React.createElement('span', { className: 'uri-browser-entry-tag' }, entry.category),
                    (entry.tags || []).slice(0, 3).map(t => React.createElement('span', { key: t, className: 'uri-browser-entry-tag' }, t))
                  )
                ),
                // Right side: type badge + select button
                React.createElement('div', { className: 'uri-browser-entry-right' },
                  React.createElement('span', {
                    className: 'uri-browser-entry-type',
                    style: { background: `var(--${typeColor(entry.data_type)}-dim)`, color: `var(--${typeColor(entry.data_type)})` }
                  }, (entry.data_type || 'text').replace('_', ' ')),
                  React.createElement('button', {
                    className: 'uri-browser-entry-select',
                    onClick: e => { e.stopPropagation(); handleSelect(entry); }
                  }, mode === 'link' ? 'Link' : 'Select')
                )
              ))
            )
      ),
      // Footer
      React.createElement('div', { className: 'uri-browser-footer' },
        React.createElement('div', { className: 'uri-browser-footer-info' },
          React.createElement(I, { n: 'globe', s: 11, c: 'var(--tx-3)' }),
          URI_LIBRARIES.length, ' libraries \u00B7 ', URI_LIBRARY_INDEX.length, ' total definitions'
        ),
        React.createElement('div', { className: 'uri-browser-footer-actions' },
          selectedEntry && React.createElement('button', {
            className: 'b-pri b-sm',
            onClick: () => {
              const entry = URI_LIBRARY_INDEX.find(e => e.uri === selectedEntry);
              if (entry) handleSelect(entry);
            }
          }, mode === 'link' ? 'Link Selected URI' : 'Use Selected URI'),
          React.createElement('button', { className: 'b-gho b-sm', onClick: onClose }, 'Cancel')
        )
      )
    )
  ), document.body);
};

/* ─── FieldPicker — select a field definition to insert into a form ─── */
const FieldPicker = ({ open, onClose, onSelect, fieldDefs, catLabels, catColors }) => {
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('all');
  const [uriBrowserOpen, setUriBrowserOpen] = useState(false);

  if (!open) return null;

  const defs = Object.values(fieldDefs || {});
  const filtered = defs.filter(d => {
    if (d.superseded_by || d.deprecated_at) return false;
    if (filterCat !== 'all' && d.category !== filterCat) return false;
    if (search && !d.label.toLowerCase().includes(search.toLowerCase()) && !d.key.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const cats = [...new Set(defs.map(d => d.category).filter(Boolean))];

  const handleUriSelect = entry => {
    onSelect({
      uri: entry.uri,
      key: entry.key,
      label: entry.label,
      definition: entry.definition,
      data_type: entry.data_type || 'text',
      category: entry.category || 'general',
      sensitive: false,
      source_library: entry.source_library
    });
    onClose();
  };

  return React.createElement('div', { className: 'fp-overlay', onClick: e => { if (e.target === e.currentTarget) onClose(); } },
    React.createElement('div', { className: 'fp-modal' },
      React.createElement('div', { className: 'fp-header' },
        React.createElement('span', { style: { fontSize: 14, fontWeight: 600 } }, 'Insert from Field Dictionary'),
        React.createElement('button', { className: 'b-gho b-xs', onClick: onClose, style: { fontSize: 14, lineHeight: 1, padding: '2px 8px' } }, '\u2715')
      ),
      // URI Library browser button
      React.createElement('div', {
        style: { padding: '8px 14px', borderBottom: '1px solid var(--border-0)', display: 'flex', alignItems: 'center', gap: 8 }
      },
        React.createElement('button', {
          className: 'b-gho b-sm',
          style: { display: 'flex', alignItems: 'center', gap: 6, color: 'var(--teal)', borderColor: 'var(--teal)', fontSize: 12 },
          onClick: () => setUriBrowserOpen(true)
        },
          React.createElement(I, { n: 'globe', s: 12, c: 'var(--teal)' }),
          'Browse URI Libraries'
        ),
        React.createElement('span', { style: { fontSize: 10, color: 'var(--tx-3)' } }, 'Schema.org \u00B7 Dublin Core \u00B7 FOAF \u00B7 vCard \u00B7 FHIR')
      ),
      React.createElement('div', { className: 'fp-search' },
        React.createElement('input', { value: search, onChange: e => setSearch(e.target.value), placeholder: 'Search fields...',  autoFocus: true }),
        React.createElement('div', { style: { display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' } },
          React.createElement('button', {
            className: `b-gho b-xs${filterCat === 'all' ? ' active' : ''}`,
            style: filterCat === 'all' ? { background: 'var(--teal-dim)', color: 'var(--teal)', borderColor: 'var(--teal)' } : {},
            onClick: () => setFilterCat('all')
          }, 'All'),
          cats.map(c => React.createElement('button', {
            key: c,
            className: `b-gho b-xs${filterCat === c ? ' active' : ''}`,
            style: filterCat === c ? { background: `var(--${(catColors || {})[c] || 'blue'}-dim)`, color: `var(--${(catColors || {})[c] || 'blue'})`, borderColor: `var(--${(catColors || {})[c] || 'blue'})` } : {},
            onClick: () => setFilterCat(c)
          }, (catLabels || {})[c] || c))
        )
      ),
      React.createElement('div', { className: 'fp-list' },
        filtered.length === 0
          ? React.createElement('div', { style: { padding: 20, textAlign: 'center', fontSize: 12, color: 'var(--tx-3)' } }, 'No matching fields')
          : filtered.map(d => React.createElement('div', {
              key: d.uri,
              className: 'fp-item',
              onClick: () => { onSelect(d); onClose(); }
            },
            React.createElement('div', { className: 'fp-item-info' },
              React.createElement('div', { className: 'fp-item-label' }, d.label),
              React.createElement('div', { className: 'fp-item-def' }, d.definition || 'No definition')
            ),
            React.createElement('div', { className: 'fp-item-meta' },
              React.createElement('span', { className: `tag tag-${(catColors || {})[d.category] || 'blue'}`, style: { fontSize: 8 } }, (catLabels || {})[d.category] || d.category),
              React.createElement('span', { className: 'tag tag-blue', style: { fontSize: 8 } }, (d.data_type || 'text').toUpperCase())
            )
          ))
      )
    ),
    // URI Library Browser modal (nested)
    uriBrowserOpen && React.createElement(UriLibraryBrowser, {
      open: true,
      onClose: () => setUriBrowserOpen(false),
      onSelect: handleUriSelect,
      mode: 'select'
    })
  );
};

/* ─── TeamDetailView — expanded team view with Overview / Schema / Activity tabs ─── */
const TeamDetailView = ({
  team,
  teams,
  svc,
  fieldDefs,
  fieldCrosswalks,
  showToast,
  teamMode,
  onSwitchTeam,
  onBack,
  onInvite,
  onUpdateTeam,
  onSaveFieldDef,
  onSaveCrosswalk
}) => {
  const [teamTab, setTeamTab] = useState('overview');
  const [addFieldModal, setAddFieldModal] = useState(false);
  const [editFieldUri, setEditFieldUri] = useState(null);
  // Add field form state
  const [fieldDraft, setFieldDraft] = useState({
    key: '',
    label: '',
    definition: '',
    scope: '',
    category: 'case',
    data_type: 'text',
    sensitive: false,
    authority: null
  });
  const [addExistingField, setAddExistingField] = useState(false);
  const [selectedExistingUri, setSelectedExistingUri] = useState('');
  const [uriBrowserOpen, setUriBrowserOpen] = useState(false);
  // Embedding-based similarity suggestions
  const [similarFields, setSimilarFields] = useState([]);
  const [searchingSimilar, setSearchingSimilar] = useState(false);
  const [dismissedSuggestions, setDismissedSuggestions] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('khora_dismissed_xw_suggestions') || '[]');
    } catch {
      return [];
    }
  });
  const similarTimerRef = React.useRef(null);
  const isLead = team.owner === svc?.userId;
  const schema = team.schema || {
    version: 1,
    fields: [],
    pending_changes: [],
    change_log: []
  };
  const schemaRule = team.schemaRule || {
    mode: 'lead_decides'
  };
  const consentMode = TEAM_CONSENT_MODES[schemaRule.mode] || TEAM_CONSENT_MODES.lead_decides;

  // Resolve field URIs to full definitions
  const resolvedFields = (schema.fields || []).map(sf => {
    const def = fieldDefs[sf.uri] || DOMAIN_CONFIG.vaultFields.find(v => v.uri === sf.uri);
    return {
      ...sf,
      def: def || {
        uri: sf.uri,
        key: sf.uri.split('/').pop(),
        label: sf.uri.split('/').pop(),
        definition: ''
      }
    };
  });

  // Get crosswalks for a field
  const getCrosswalksForUri = uri => (fieldCrosswalks || []).filter(xw => xw.from_uri === uri || xw.bidirectional && xw.to_uri === uri);
  const getSource = uri => {
    if (uri?.startsWith('khora:vault/')) return {
      label: 'Vault',
      color: 'gold'
    };
    if (uri?.startsWith('khora:team/')) return {
      label: 'Team',
      color: 'purple'
    };
    if (uri?.startsWith('khora:org/')) return {
      label: 'Org',
      color: 'blue'
    };
    return {
      label: 'External',
      color: 'teal'
    };
  };

  // Consent threshold helpers
  const getMemberCount = () => (team.members || []).length;
  const getThreshold = () => {
    if (schemaRule.mode === 'lead_decides') return 0;
    if (schemaRule.mode === 'majority') return Math.floor(getMemberCount() / 2) + 1;
    return getMemberCount(); // unanimous
  };
  const canModifySchema = () => {
    if (schemaRule.mode === 'lead_decides') return isLead;
    return true; // anyone can propose in majority/unanimous
  };

  // Apply a schema change
  const applySchemaChange = async change => {
    const currentSchema = {
      ...schema
    };
    if (schemaRule.mode === 'lead_decides' && isLead) {
      // Apply immediately
      if (change.action === 'add_field') {
        currentSchema.fields = [...(currentSchema.fields || []), {
          uri: change.uri,
          required: change.required || false,
          added_version: currentSchema.version + 1
        }];
      } else if (change.action === 'remove_field') {
        currentSchema.fields = (currentSchema.fields || []).filter(f => f.uri !== change.uri);
      }
      currentSchema.version = (currentSchema.version || 1) + 1;
      currentSchema.last_modified = Date.now();
      currentSchema.modified_by = svc.userId;
      currentSchema.change_log = [...(currentSchema.change_log || []), {
        version: currentSchema.version,
        summary: change.summary || change.action,
        by: svc.userId,
        ts: Date.now()
      }];
      try {
        await svc.setState(team.roomId, EVT.TEAM_SCHEMA, currentSchema);
        onUpdateTeam({
          ...team,
          schema: currentSchema
        });
        showToast(`Schema updated to v${currentSchema.version}`, 'success');
      } catch (e) {
        showToast('Schema update failed: ' + e.message, 'error');
      }
    } else {
      // Add as pending change
      const pending = {
        id: 'chg_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        ...change,
        proposed_by: svc.userId,
        proposed_at: Date.now(),
        approvals: schemaRule.mode === 'lead_decides' ? {} : {
          [svc.userId]: Date.now()
        },
        blocks: {}
      };
      currentSchema.pending_changes = [...(currentSchema.pending_changes || []), pending];
      try {
        await svc.setState(team.roomId, EVT.TEAM_SCHEMA, currentSchema);
        onUpdateTeam({
          ...team,
          schema: currentSchema
        });
        showToast('Schema change proposed — awaiting approval', 'info');
      } catch (e) {
        showToast('Failed: ' + e.message, 'error');
      }
    }
  };

  // Approve or block a pending change
  const respondToChange = async (changeId, position) => {
    const currentSchema = {
      ...schema
    };
    const pc = (currentSchema.pending_changes || []).find(c => c.id === changeId);
    if (!pc) return;
    if (position === 'approve') {
      pc.approvals = {
        ...(pc.approvals || {}),
        [svc.userId]: Date.now()
      };
    } else {
      pc.blocks = {
        ...(pc.blocks || {}),
        [svc.userId]: Date.now()
      };
    }

    // Check if threshold met
    const approvalCount = Object.keys(pc.approvals || {}).length;
    const blockCount = Object.keys(pc.blocks || {}).length;
    const threshold = getThreshold();
    if (schemaRule.mode === 'unanimous' && blockCount > 0) {
      // Blocked — remove pending change
      currentSchema.pending_changes = (currentSchema.pending_changes || []).filter(c => c.id !== changeId);
      showToast('Schema change blocked', 'warning');
    } else if (approvalCount >= threshold) {
      // Auto-apply
      if (pc.action === 'add_field') {
        currentSchema.fields = [...(currentSchema.fields || []), {
          uri: pc.uri,
          required: pc.required || false,
          added_version: currentSchema.version + 1
        }];
      } else if (pc.action === 'remove_field') {
        currentSchema.fields = (currentSchema.fields || []).filter(f => f.uri !== pc.uri);
      }
      currentSchema.version = (currentSchema.version || 1) + 1;
      currentSchema.last_modified = Date.now();
      currentSchema.modified_by = svc.userId;
      currentSchema.change_log = [...(currentSchema.change_log || []), {
        version: currentSchema.version,
        summary: pc.summary || pc.action,
        by: pc.proposed_by,
        ts: Date.now()
      }];
      currentSchema.pending_changes = (currentSchema.pending_changes || []).filter(c => c.id !== changeId);
      showToast(`Schema updated to v${currentSchema.version} — approved by ${approvalCount} members`, 'success');
    }
    try {
      await svc.setState(team.roomId, EVT.TEAM_SCHEMA, currentSchema);
      onUpdateTeam({
        ...team,
        schema: currentSchema
      });
    } catch (e) {
      showToast('Failed: ' + e.message, 'error');
    }
  };

  // Change consent mode
  const changeConsentMode = async newMode => {
    const newRule = {
      mode: newMode,
      modified_by: svc.userId,
      modified_at: Date.now()
    };
    try {
      await svc.setState(team.roomId, EVT.TEAM_SCHEMA_RULE, newRule);
      onUpdateTeam({
        ...team,
        schemaRule: newRule
      });
      showToast(`Consent mode changed to ${TEAM_CONSENT_MODES[newMode]?.label}`, 'success');
    } catch (e) {
      showToast('Failed: ' + e.message, 'error');
    }
  };

  // Add existing field from vault/other defs
  const handleAddExistingField = async () => {
    if (!selectedExistingUri) return;
    await applySchemaChange({
      action: 'add_field',
      uri: selectedExistingUri,
      required: false,
      summary: `Added ${fieldDefs[selectedExistingUri]?.label || selectedExistingUri}`
    });
    setAddExistingField(false);
    setSelectedExistingUri('');
  };

  // Save new custom field definition + add to schema
  const handleSaveNewField = async () => {
    if (!fieldDraft.label || !fieldDraft.definition) {
      showToast('Label and definition are required', 'warning');
      return;
    }
    const key = fieldDraft.key || fieldDraft.label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    const uri = `khora:team/${team.roomId}/${key}`;
    const def = {
      uri,
      key,
      label: fieldDraft.label,
      version: 1,
      definition: fieldDraft.definition,
      scope: fieldDraft.scope || '',
      category: fieldDraft.category || 'case',
      sensitive: fieldDraft.sensitive || false,
      data_type: fieldDraft.data_type || 'text',
      authority: fieldDraft.authority || null,
      created_by: svc.userId,
      created_at: Date.now(),
      supersedes: null
    };
    // Save the definition
    if (onSaveFieldDef) await onSaveFieldDef(def);
    // Add to team schema
    await applySchemaChange({
      action: 'add_field',
      uri,
      required: false,
      summary: `Added "${fieldDraft.label}"`
    });
    setAddFieldModal(false);
    setFieldDraft({
      key: '',
      label: '',
      definition: '',
      scope: '',
      category: 'case',
      data_type: 'text',
      sensitive: false,
      authority: null
    });
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "anim-up",
    style: {
      maxWidth: 960,
      margin: '0 auto'
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onBack,
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
  }), "All Teams"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", {
    style: {
      fontFamily: 'var(--serif)',
      fontSize: 22,
      fontWeight: 700
    }
  }, team.name || 'Unnamed Team'), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      marginTop: 4
    }
  }, isLead && /*#__PURE__*/React.createElement("span", {
    className: "tag tag-gold",
    style: {
      fontSize: 9
    }
  }, "LEAD"), team.org_name && /*#__PURE__*/React.createElement("span", {
    className: "tag tag-blue",
    style: {
      fontSize: 9
    }
  }, team.org_name), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      fontFamily: 'var(--mono)',
      color: 'var(--tx-3)'
    }
  }, team.members?.length || 0, " members"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      fontFamily: 'var(--mono)',
      color: 'var(--tx-3)'
    }
  }, schema.fields?.length || 0, " fields"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      fontFamily: 'var(--mono)',
      color: 'var(--tx-3)'
    }
  }, "v", schema.version || 1)), team.description && /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12,
      color: 'var(--tx-2)',
      marginTop: 6,
      lineHeight: 1.5
    }
  }, team.description)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6
    }
  }, isLead && /*#__PURE__*/React.createElement("button", {
    onClick: () => onInvite(team),
    className: "b-gho b-sm",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 4
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "userPlus",
    s: 12
  }), "Invite"))), /*#__PURE__*/React.createElement("div", {
    className: "db-tabs"
  }, [{
    id: 'overview',
    label: 'Overview',
    icon: 'users'
  }, {
    id: 'schema',
    label: 'Schema',
    icon: 'grid'
  }, {
    id: 'activity',
    label: 'Activity',
    icon: 'layers'
  }].map(tab => /*#__PURE__*/React.createElement("button", {
    key: tab.id,
    className: 'db-tab' + (teamTab === tab.id ? ' active' : ''),
    onClick: () => setTeamTab(tab.id)
  }, /*#__PURE__*/React.createElement(I, {
    n: tab.icon,
    s: 13
  }), tab.label))), teamTab === 'overview' && /*#__PURE__*/React.createElement("div", null, isLead && /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      padding: '16px 20px',
      marginBottom: 12,
      borderLeft: team.color_hue != null ? `3px solid hsl(${team.color_hue}, 65%, 55%)` : undefined
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "TEAM COLOR"), /*#__PURE__*/React.createElement("div", {
    style: { display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
      background: `hsl(${team.color_hue != null ? team.color_hue : 260}, 65%, 55%)`
    }
  }), /*#__PURE__*/React.createElement("input", {
    type: "range", min: 0, max: 360, value: team.color_hue != null ? team.color_hue : 260,
    "aria-label": `Team color: ${hueToColorName(team.color_hue != null ? team.color_hue : 260)}`,
    onChange: (e) => {
      const hue = parseInt(e.target.value);
      onUpdateTeam({ ...team, color_hue: hue });
      setLocalTeamColor(svc.userId, team.roomId, hue);
    },
    style: { flex: 1, accentColor: `hsl(${team.color_hue != null ? team.color_hue : 260}, 65%, 55%)` }
  }), /*#__PURE__*/React.createElement("span", {
    style: { fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--tx-3)', minWidth: 50 }
  }, hueToColorName(team.color_hue != null ? team.color_hue : 260), " ", team.color_hue != null ? team.color_hue : 260, "\u00B0"))), onSwitchTeam && /*#__PURE__*/React.createElement("button", {
    onClick: () => onSwitchTeam(teamMode?.roomId === team.roomId ? null : team.roomId),
    className: teamMode?.roomId === team.roomId ? "b-pri b-sm" : "b-gho b-sm",
    title: "When operating as this team, actions you take (notes, field changes, allocations) will be recorded under this team\u2019s context.",
    style: {
      marginBottom: 12,
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      width: '100%',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: teamMode?.roomId === team.roomId ? "check" : "users",
    s: 13
  }), teamMode?.roomId === team.roomId ? "Operating as This Team" : "Operate as This Team"), /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      padding: '16px 20px',
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "MEMBERS (", team.members?.length || 0, ")"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      marginTop: 8
    }
  }, (team.members || []).map((m, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '6px 10px',
      background: 'var(--bg-2)',
      borderRadius: 'var(--r)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 28,
      height: 28,
      borderRadius: '50%',
      background: m.role === 'lead' ? 'var(--gold-dim)' : 'var(--bg-3)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: m.role === 'lead' ? 'var(--gold)' : 'var(--tx-2)',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: m.role === 'lead' ? 'briefcase' : 'user',
    s: 12
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12.5,
      fontWeight: 500
    }
  }, m.display_name || m.userId), m.userId !== m.display_name && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      color: 'var(--tx-3)',
      fontFamily: 'var(--mono)',
      marginLeft: 6
    }
  }, m.userId)), /*#__PURE__*/React.createElement("span", {
    className: `tag ${m.role === 'lead' ? 'tag-gold' : 'tag-blue'}`,
    style: {
      fontSize: 8
    }
  }, m.role?.toUpperCase()))))), /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      padding: '16px 20px'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "DETAILS"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '100px 1fr',
      gap: '6px 12px',
      marginTop: 8,
      fontSize: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--tx-3)'
    }
  }, "Created"), /*#__PURE__*/React.createElement("span", null, team.created ? new Date(team.created).toLocaleDateString() : '—'), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--tx-3)'
    }
  }, "Room ID"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--mono)',
      fontSize: 10,
      wordBreak: 'break-all'
    }
  }, team.roomId), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--tx-3)'
    }
  }, "Schema"), /*#__PURE__*/React.createElement("span", null, "v", schema.version || 1, " \u2014 ", schema.fields?.length || 0, " fields"), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--tx-3)'
    }
  }, "Consent"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 4
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: consentMode.icon,
    s: 11,
    c: `var(--${consentMode.color})`
  }), consentMode.label)))), teamTab === 'schema' && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      color: 'var(--tx-2)'
    }
  }, "TEAM SCHEMA"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--mono)',
      fontSize: 10,
      color: 'var(--tx-3)'
    }
  }, "v", schema.version || 1, " \u2014 ", schema.fields?.length || 0, " fields")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, isLead && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 4
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      color: 'var(--tx-3)'
    }
  }, "Consent:"), /*#__PURE__*/React.createElement("select", {
    value: schemaRule.mode,
    onChange: e => changeConsentMode(e.target.value),
    className: "ipt",
    style: {
      fontSize: 10,
      padding: '3px 6px',
      minWidth: 0
    }
  }, Object.values(TEAM_CONSENT_MODES).map(m => /*#__PURE__*/React.createElement("option", {
    key: m.id,
    value: m.id
  }, m.label)))), canModifySchema() && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 4
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "b-gho b-xs",
    onClick: () => setAddExistingField(true),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 3
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "plus",
    s: 10
  }), "Add Existing"), /*#__PURE__*/React.createElement("button", {
    className: "b-pri b-xs",
    onClick: () => {
      setAddFieldModal(true);
      setFieldDraft({
        key: '',
        label: '',
        definition: '',
        scope: '',
        category: 'case',
        data_type: 'text',
        sensitive: false,
        authority: null
      });
    },
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 3
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "plus",
    s: 10
  }), "New Field")))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '8px 12px',
      background: `var(--${consentMode.color}-dim, var(--bg-2))`,
      border: `1px solid rgba(128,128,128,.1)`,
      borderRadius: 'var(--r)',
      marginBottom: 12,
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: consentMode.icon,
    s: 13,
    c: `var(--${consentMode.color})`
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: 'var(--tx-1)'
    }
  }, consentMode.desc)), (schema.pending_changes || []).length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 12
    }
  }, schema.pending_changes.map(pc => {
    const approvalCount = Object.keys(pc.approvals || {}).length;
    const threshold = getThreshold();
    const alreadyResponded = !!(pc.approvals?.[svc.userId] || pc.blocks?.[svc.userId]);
    return /*#__PURE__*/React.createElement("div", {
      key: pc.id,
      style: {
        padding: '10px 14px',
        background: 'var(--gold-dim)',
        border: '1px solid var(--gold-mid)',
        borderRadius: 'var(--r)',
        marginBottom: 6
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12,
        fontWeight: 600
      }
    }, "Pending: ", pc.summary || pc.action), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 10,
        color: 'var(--tx-2)',
        marginLeft: 8
      }
    }, "by ", (pc.proposed_by || '').split(':')[0]?.replace('@', ''))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 6
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 10,
        fontFamily: 'var(--mono)',
        color: 'var(--tx-2)'
      }
    }, approvalCount, "/", threshold, " approved"), !alreadyResponded && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("button", {
      className: "b-gho b-xs",
      style: {
        color: 'var(--green)'
      },
      onClick: () => respondToChange(pc.id, 'approve')
    }, "Approve"), /*#__PURE__*/React.createElement("button", {
      className: "b-gho b-xs",
      style: {
        color: 'var(--red)'
      },
      onClick: () => respondToChange(pc.id, 'block')
    }, "Block")), alreadyResponded && /*#__PURE__*/React.createElement("span", {
      className: "tag tag-green",
      style: {
        fontSize: 8
      }
    }, "Responded"))), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 6,
        height: 3,
        background: 'var(--border-1)',
        borderRadius: 2,
        overflow: 'hidden'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        height: '100%',
        background: 'var(--green)',
        width: `${Math.min(100, approvalCount / threshold * 100)}%`,
        borderRadius: 2,
        transition: 'width .3s'
      }
    })));
  })), resolvedFields.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      textAlign: 'center',
      padding: '40px 20px',
      borderStyle: 'dashed'
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "grid",
    s: 32
  }), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--tx-2)',
      marginTop: 10,
      fontSize: 13
    }
  }, "No fields in schema"), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--tx-3)',
      fontSize: 11.5,
      marginTop: 4
    }
  }, "Add fields to define what data this team tracks about individuals.")) : /*#__PURE__*/React.createElement("table", {
    className: "dt",
    style: {
      width: '100%'
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", {
    style: {
      textAlign: 'left',
      padding: '8px 12px',
      fontSize: 10,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      color: 'var(--tx-3)',
      borderBottom: '2px solid var(--border-1)'
    }
  }, "Field"), /*#__PURE__*/React.createElement("th", {
    style: {
      textAlign: 'left',
      padding: '8px 12px',
      fontSize: 10,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      color: 'var(--tx-3)',
      borderBottom: '2px solid var(--border-1)'
    }
  }, "Category"), /*#__PURE__*/React.createElement("th", {
    style: {
      textAlign: 'left',
      padding: '8px 12px',
      fontSize: 10,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      color: 'var(--tx-3)',
      borderBottom: '2px solid var(--border-1)',
      maxWidth: 300
    }
  }, "Definition"), /*#__PURE__*/React.createElement("th", {
    style: {
      textAlign: 'left',
      padding: '8px 12px',
      fontSize: 10,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      color: 'var(--tx-3)',
      borderBottom: '2px solid var(--border-1)'
    }
  }, "Source"), /*#__PURE__*/React.createElement("th", {
    style: {
      textAlign: 'left',
      padding: '8px 12px',
      fontSize: 10,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      color: 'var(--tx-3)',
      borderBottom: '2px solid var(--border-1)'
    }
  }, "Also Known As"), /*#__PURE__*/React.createElement("th", {
    style: {
      width: 60,
      textAlign: 'center',
      padding: '8px 12px',
      fontSize: 10,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      color: 'var(--tx-3)',
      borderBottom: '2px solid var(--border-1)'
    }
  }))), /*#__PURE__*/React.createElement("tbody", null, resolvedFields.map(sf => {
    const d = sf.def;
    const src = getSource(d.uri);
    const xws = getCrosswalksForUri(d.uri);
    return /*#__PURE__*/React.createElement("tr", {
      key: sf.uri,
      style: {
        borderBottom: '1px solid var(--border-0)'
      }
    }, /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '10px 12px'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontWeight: 600,
        fontSize: 12.5
      }
    }, d.label), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 9,
        fontFamily: 'var(--mono)',
        color: 'var(--tx-3)',
        marginTop: 1
      }
    }, d.key)), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '10px 12px'
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: `tag tag-${CAT_COLORS[d.category] || 'blue'}`,
      style: {
        fontSize: 8
      }
    }, CAT_LABELS[d.category] || d.category)), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '10px 12px',
        maxWidth: 300
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11.5,
        lineHeight: 1.5,
        color: 'var(--tx-1)'
      }
    }, (d.definition || '').length > 100 ? (d.definition || '').slice(0, 100) + '...' : d.definition || 'No definition')), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '10px 12px'
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: `tag tag-${src.color}`,
      style: {
        fontSize: 8
      }
    }, src.label)), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '10px 12px'
      }
    }, xws.length === 0 ? /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--tx-3)',
        fontSize: 10
      }
    }, "\u2014") : /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 3,
        flexWrap: 'wrap'
      }
    }, xws.slice(0, 2).map(xw => {
      const rel = CROSSWALK_TYPES[xw.relationship] || CROSSWALK_TYPES.related;
      const targetUri = xw.from_uri === d.uri ? xw.to_uri : xw.from_uri;
      const targetDef = fieldDefs[targetUri];
      return /*#__PURE__*/React.createElement("span", {
        key: xw.id,
        className: `tag tag-${rel.color}`,
        style: {
          fontSize: 8
        }
      }, rel.symbol, " ", targetDef?.label || targetUri.split('/').pop());
    }))), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '10px 12px',
        textAlign: 'center'
      }
    }, canModifySchema() && /*#__PURE__*/React.createElement("button", {
      className: "b-gho b-xs",
      style: {
        color: 'var(--red)',
        fontSize: 10
      },
      onClick: () => applySchemaChange({
        action: 'remove_field',
        uri: sf.uri,
        summary: `Removed "${d.label}"`
      }),
      title: "Remove field"
    }, /*#__PURE__*/React.createElement(I, {
      n: "close",
      s: 10
    }))));
  }))), (schema.change_log || []).length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 16
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "CHANGE LOG"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 3,
      marginTop: 6
    }
  }, [...(schema.change_log || [])].reverse().map((cl, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      fontSize: 11,
      color: 'var(--tx-2)',
      display: 'flex',
      gap: 8,
      padding: '4px 0'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--mono)',
      fontSize: 10,
      color: 'var(--tx-3)',
      minWidth: 24
    }
  }, "v", cl.version), /*#__PURE__*/React.createElement("span", null, cl.summary), /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 'auto',
      fontSize: 10,
      color: 'var(--tx-3)'
    }
  }, (cl.by || '').split(':')[0]?.replace('@', ''), " \u2014 ", cl.ts ? new Date(cl.ts).toLocaleDateString() : '')))))), teamTab === 'activity' && /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      padding: '20px',
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "layers",
    s: 28,
    c: "var(--tx-3)"
  }), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--tx-2)',
      marginTop: 10,
      fontSize: 12
    }
  }, "Action log for team operations will appear here."), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--tx-3)',
      fontSize: 11,
      marginTop: 4
    }
  }, "Schema changes, member joins, and other team events are logged as epistemic operations.")), addExistingField && /*#__PURE__*/React.createElement("div", {
    className: "fb-adopt-modal",
    onClick: () => setAddExistingField(false)
  }, /*#__PURE__*/React.createElement("div", {
    className: "fb-adopt-panel",
    onClick: e => e.stopPropagation(),
    style: {
      maxWidth: 700
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      fontWeight: 700
    }
  }, "Add Existing Field"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setAddExistingField(false),
    style: {
      background: 'none',
      border: 'none',
      color: 'var(--tx-2)',
      cursor: 'pointer',
      fontSize: 18
    }
  }, "\xD7")), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12,
      color: 'var(--tx-2)',
      marginBottom: 12
    }
  }, "Select a field from the global dictionary to add to this team's schema."), /*#__PURE__*/React.createElement("select", {
    value: selectedExistingUri,
    onChange: e => setSelectedExistingUri(e.target.value),
    className: "ipt",
    style: {
      width: '100%',
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "Choose a field..."), Object.values(fieldDefs).filter(d => !schema.fields?.some(f => f.uri === d.uri)).map(d => /*#__PURE__*/React.createElement("option", {
    key: d.uri,
    value: d.uri
  }, d.label, " \u2014 ", (d.definition || '').slice(0, 60), (d.definition || '').length > 60 ? '...' : ''))), selectedExistingUri && fieldDefs[selectedExistingUri] && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '10px 12px',
      background: 'var(--bg-2)',
      borderRadius: 'var(--r)',
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 600,
      fontSize: 12
    }
  }, fieldDefs[selectedExistingUri].label), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: 'var(--tx-2)',
      marginTop: 4
    }
  }, fieldDefs[selectedExistingUri].definition), fieldDefs[selectedExistingUri].authority && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      color: 'var(--teal)',
      marginTop: 4
    }
  }, fieldDefs[selectedExistingUri].authority.org, " \u2014 ", fieldDefs[selectedExistingUri].authority.provision)), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'right'
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "b-gho b-sm",
    onClick: () => setAddExistingField(false),
    style: {
      marginRight: 6
    }
  }, "Cancel"), /*#__PURE__*/React.createElement("button", {
    className: "b-pri b-sm",
    disabled: !selectedExistingUri,
    onClick: handleAddExistingField
  }, "Add to Schema")))), addFieldModal && /*#__PURE__*/React.createElement("div", {
    className: "fb-adopt-modal",
    onClick: () => setAddFieldModal(false)
  }, /*#__PURE__*/React.createElement("div", {
    className: "fb-adopt-panel",
    onClick: e => e.stopPropagation(),
    style: {
      maxWidth: 600
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      fontWeight: 700
    }
  }, "Define New Field"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setAddFieldModal(false),
    style: {
      background: 'none',
      border: 'none',
      color: 'var(--tx-2)',
      cursor: 'pointer',
      fontSize: 18
    }
  }, "\xD7")),
  // Import from URI Library button
  React.createElement('div', {
    style: { marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }
  },
    React.createElement('button', {
      className: 'b-gho b-sm',
      style: { display: 'flex', alignItems: 'center', gap: 6, color: 'var(--teal)', borderColor: 'var(--teal)', fontSize: 12 },
      onClick: () => setUriBrowserOpen(true)
    },
      React.createElement(I, { n: 'globe', s: 12, c: 'var(--teal)' }),
      'Import from URI Library'
    ),
    React.createElement('span', { style: { fontSize: 10, color: 'var(--tx-3)' } }, 'Pre-fill from Schema.org, FHIR, etc.')
  ),
  // URI Library Browser
  uriBrowserOpen && React.createElement(UriLibraryBrowser, {
    open: true,
    onClose: () => setUriBrowserOpen(false),
    onSelect: entry => {
      setFieldDraft(d => ({
        ...d,
        key: entry.key,
        label: entry.label,
        definition: entry.definition,
        data_type: entry.data_type || 'text',
        category: entry.category || d.category,
        standard_uri: entry.uri,
        source_library: entry.source_library
      }));
      setUriBrowserOpen(false);
    },
    mode: 'select'
  }),
  /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 10,
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    style: {
      fontSize: 10,
      color: 'var(--tx-2)',
      display: 'block',
      marginBottom: 3
    }
  }, "Label *"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    value: fieldDraft.label,
    onChange: e => {
      const label = e.target.value;
      setFieldDraft(d => ({
        ...d,
        label,
        key: label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
      }));
    },
    className: "ipt",
    placeholder: "e.g. Housing Status",
    style: {
      width: '100%'
    }
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    style: {
      fontSize: 10,
      color: 'var(--tx-2)',
      display: 'block',
      marginBottom: 3
    }
  }, "Key"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    value: fieldDraft.key,
    onChange: e => setFieldDraft(d => ({
      ...d,
      key: e.target.value
    })),
    className: "ipt",
    placeholder: "housing_status",
    style: {
      width: '100%',
      fontFamily: 'var(--mono)',
      fontSize: 11
    }
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      fontSize: 10,
      color: 'var(--tx-2)',
      display: 'block',
      marginBottom: 3
    }
  }, "Definition *"), /*#__PURE__*/React.createElement("textarea", {
    value: fieldDraft.definition,
    onChange: e => {
      const val = e.target.value;
      setFieldDraft(d => ({
        ...d,
        definition: val
      }));
      // Debounced similarity search
      if (similarTimerRef.current) clearTimeout(similarTimerRef.current);
      if (val.length > 20) {
        similarTimerRef.current = setTimeout(async () => {
          setSearchingSimilar(true);
          const results = await findSimilarFields(`${fieldDraft.label}. ${val}`, fieldDefs, schema.fields?.map(f => f.uri) || []);
          setSimilarFields(results.filter(r => !dismissedSuggestions.includes(r.uri)));
          setSearchingSimilar(false);
        }, 500);
      } else {
        setSimilarFields([]);
      }
    },
    className: "ipt",
    rows: 3,
    placeholder: "What this field captures and what it means...",
    style: {
      width: '100%',
      resize: 'vertical'
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      fontSize: 10,
      color: 'var(--tx-2)',
      display: 'block',
      marginBottom: 3
    }
  }, "Scope (optional)"), /*#__PURE__*/React.createElement("textarea", {
    value: fieldDraft.scope,
    onChange: e => setFieldDraft(d => ({
      ...d,
      scope: e.target.value
    })),
    className: "ipt",
    rows: 2,
    placeholder: "What this field includes and excludes...",
    style: {
      width: '100%',
      resize: 'vertical'
    }
  })), searchingSimilar && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '8px 12px',
      background: 'var(--bg-2)',
      borderRadius: 'var(--r)',
      marginBottom: 10,
      fontSize: 11,
      color: 'var(--tx-3)'
    }
  }, "Analyzing definitions..."), similarFields.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '10px 14px',
      background: 'var(--teal-dim)',
      border: '1px solid rgba(61,214,140,.15)',
      borderRadius: 'var(--r)',
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 600,
      color: 'var(--teal)',
      marginBottom: 8
    }
  }, "Similar fields found:"), similarFields.map(sf => /*#__PURE__*/React.createElement("div", {
    key: sf.uri,
    style: {
      padding: '8px 10px',
      background: 'var(--bg-2)',
      borderRadius: 'var(--r)',
      marginBottom: 4,
      display: 'flex',
      alignItems: 'flex-start',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
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
      fontWeight: 600
    }
  }, sf.def.label), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 9,
      fontFamily: 'var(--mono)',
      color: 'var(--teal)'
    }
  }, Math.round(sf.similarity * 100), "% match")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10.5,
      color: 'var(--tx-2)',
      marginTop: 2
    }
  }, (sf.def.definition || '').slice(0, 80), (sf.def.definition || '').length > 80 ? '...' : '')), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 3,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "b-gho b-xs",
    style: {
      color: 'var(--green)',
      fontSize: 9
    },
    onClick: async () => {
      if (onSaveCrosswalk) {
        const key = fieldDraft.key || fieldDraft.label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
        const newUri = `khora:team/${team.roomId}/${key}`;
        await onSaveCrosswalk({
          id: 'xw_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          from_uri: newUri,
          to_uri: sf.uri,
          relationship: 'equivalent',
          bidirectional: true,
          notes: 'Auto-suggested by similarity analysis',
          created_at: Date.now()
        });
      }
      setSimilarFields(prev => prev.filter(s => s.uri !== sf.uri));
    }
  }, "Link as equivalent"), /*#__PURE__*/React.createElement("button", {
    className: "b-gho b-xs",
    style: {
      color: 'var(--gold)',
      fontSize: 9
    },
    onClick: async () => {
      if (onSaveCrosswalk) {
        const key = fieldDraft.key || fieldDraft.label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
        const newUri = `khora:team/${team.roomId}/${key}`;
        await onSaveCrosswalk({
          id: 'xw_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          from_uri: newUri,
          to_uri: sf.uri,
          relationship: 'related',
          bidirectional: true,
          notes: 'Auto-suggested by similarity analysis',
          created_at: Date.now()
        });
      }
      setSimilarFields(prev => prev.filter(s => s.uri !== sf.uri));
    }
  }, "Link as related"), /*#__PURE__*/React.createElement("button", {
    className: "b-gho b-xs",
    style: {
      color: 'var(--tx-3)',
      fontSize: 9
    },
    onClick: () => {
      const updated = [...dismissedSuggestions, sf.uri];
      setDismissedSuggestions(updated);
      try {
        localStorage.setItem('khora_dismissed_xw_suggestions', JSON.stringify(updated));
      } catch {}
      setSimilarFields(prev => prev.filter(s => s.uri !== sf.uri));
    }
  }, "Ignore"))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr 80px',
      gap: 10,
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    style: {
      fontSize: 10,
      color: 'var(--tx-2)',
      display: 'block',
      marginBottom: 3
    }
  }, "Category"), /*#__PURE__*/React.createElement("select", {
    value: fieldDraft.category,
    onChange: e => setFieldDraft(d => ({
      ...d,
      category: e.target.value
    })),
    className: "ipt",
    style: {
      width: '100%'
    }
  }, FIELD_CATEGORIES.map(c => /*#__PURE__*/React.createElement("option", {
    key: c,
    value: c
  }, CAT_LABELS[c] || c)))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    style: {
      fontSize: 10,
      color: 'var(--tx-2)',
      display: 'block',
      marginBottom: 3
    }
  }, "Data Type"), /*#__PURE__*/React.createElement("select", {
    value: fieldDraft.data_type,
    onChange: e => setFieldDraft(d => ({
      ...d,
      data_type: e.target.value
    })),
    className: "ipt",
    style: {
      width: '100%'
    }
  }, ['text', 'text_long', 'date', 'number', 'email', 'phone', 'address', 'single_select', 'multi_select', 'document'].map(t => /*#__PURE__*/React.createElement("option", {
    key: t,
    value: t
  }, t.replace(/_/g, ' '))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-end'
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      fontSize: 10,
      color: 'var(--tx-2)',
      marginBottom: 5
    }
  }, "Sensitive"), /*#__PURE__*/React.createElement("div", {
    onClick: () => setFieldDraft(d => ({
      ...d,
      sensitive: !d.sensitive
    })),
    style: {
      width: 36,
      height: 20,
      borderRadius: 10,
      background: fieldDraft.sensitive ? 'var(--red)' : 'var(--border-2)',
      cursor: 'pointer',
      position: 'relative',
      transition: 'background .2s'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 16,
      height: 16,
      borderRadius: '50%',
      background: 'white',
      position: 'absolute',
      top: 2,
      left: fieldDraft.sensitive ? 18 : 2,
      transition: 'left .2s'
    }
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'right',
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "b-gho b-sm",
    onClick: () => setAddFieldModal(false),
    style: {
      marginRight: 6
    }
  }, "Cancel"), /*#__PURE__*/React.createElement("button", {
    className: "b-pri b-sm",
    disabled: !fieldDraft.label || !fieldDraft.definition,
    onClick: handleSaveNewField
  }, schemaRule.mode === 'lead_decides' && isLead ? 'Save & Add' : 'Propose Field')))));
};

/* ─── ProfileActivityFeed — simple action log for an individual ─── */
const ProfileActivityFeed = ({
  individual,
  svc
}) => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const roomId = individual.bridgeRoom || individual._case?.bridgeRoomId || individual.id;
        if (!roomId || !svc.client) {
          if (!cancelled) setLoading(false);
          return;
        }
        const room = svc.client.getRoom(roomId);
        if (!room) {
          if (!cancelled) setLoading(false);
          return;
        }
        // Paginate back to load recent historical events
        try {
          const canPag = room.getLiveTimeline().getPaginationToken('b');
          if (canPag) await svc.client.scrollback(room, 50);
        } catch (e) {/* pagination may fail */}
        const collected = [];
        const seenIds = new Set();
        const roomInfo = { type: 'bridge' };

        // Collect from ALL timeline sets (not just live)
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
          const type = ev.getType();
          if (!type.startsWith('io.khora.') && !type.startsWith('m.room.')) continue;
          const classified = classifyEvent(ev, roomInfo);
          if (classified) {
            collected.push({ id: ev.getId(), ...classified, sender: ev.getSender(), ts: ev.getTs() });
          }
        }
        // Also collect state events not in timeline
        for (const ev of room.currentState.getStateEvents()) {
          if (seenIds.has(ev.getId())) continue;
          seenIds.add(ev.getId());
          const type = ev.getType();
          if (!type.startsWith('io.khora.')) continue;
          const classified = classifyEvent(ev, roomInfo);
          if (classified) {
            collected.push({ id: ev.getId(), ...classified, sender: ev.getSender(), ts: ev.getTs() });
          }
        }
        collected.sort((a, b) => b.ts - a.ts);
        if (!cancelled) setEvents(collected.slice(0, 50));
      } catch (e) {
        console.warn('Profile activity load failed:', e.message);
      }
      if (!cancelled) setLoading(false);
    };
    load();
    let debounce = null;
    const handler = () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => load(), 300);
    };
    window.addEventListener('khora:eo', handler);
    window.addEventListener('khora:timeline', handler);
    window.addEventListener('khora:state', handler);
    return () => {
      cancelled = true;
      window.removeEventListener('khora:eo', handler);
      window.removeEventListener('khora:timeline', handler);
      window.removeEventListener('khora:state', handler);
      if (debounce) clearTimeout(debounce);
    };
  }, [individual.id, individual.bridgeRoom]);
  if (loading) return /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: { textAlign: 'center', padding: '30px 20px', color: 'var(--tx-3)' }
  }, "Loading activity...");
  if (events.length === 0) return /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: { textAlign: 'center', padding: '30px 20px', color: 'var(--tx-3)' }
  }, "No activity recorded yet for this individual.");
  return /*#__PURE__*/React.createElement("div", null, events.map(ev => {
    const opColor = OP_COLORS[ev.op] || 'blue';
    const verb = OP_DESCRIPTIONS[ev.op]?.verb || ev.op;
    const username = (ev.sender || '').split(':')[0]?.replace('@', '') || 'unknown';
    return /*#__PURE__*/React.createElement("div", {
      key: ev.id,
      style: { display: 'flex', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border-0)' }
    }, /*#__PURE__*/React.createElement("span", {
      className: "dt-eo",
      style: { background: `var(--${opColor}-dim)`, color: `var(--${opColor})`, flexShrink: 0 }
    }, ev.op), /*#__PURE__*/React.createElement("div", {
      style: { flex: 1, minWidth: 0 }
    }, /*#__PURE__*/React.createElement("div", {
      style: { fontSize: 13 }
    }, /*#__PURE__*/React.createElement("strong", null, verb), ev.label && /*#__PURE__*/React.createElement("span", {
      style: { color: 'var(--tx-1)' }
    }, " \u2014 ", ev.label)), ev.desc && /*#__PURE__*/React.createElement("div", {
      style: { fontSize: 11, color: 'var(--tx-2)', marginTop: 2 }
    }, ev.desc), /*#__PURE__*/React.createElement("div", {
      style: { fontSize: 10, color: 'var(--tx-3)', marginTop: 3 }
    }, username, " \xB7 ", new Date(ev.ts).toLocaleString())));
  }));
};

/* ─── IndividualProfilePage — full profile view for an individual ─── */
const IndividualProfilePage = ({
  individual,
  notes,
  allocations,
  onBack,
  onOpenCase,
  onAddNote,
  svc,
  T,
  showToast,
  resourceTypes,
  resourceRelations,
  resourceInventory,
  orgRoom,
  orgRole,
  canAllocateResource,
  onAllocate,
  fieldDefs,
  onFieldEdit
}) => {
  const [tab, setTab] = useState('fields');
  const [profileAllocModal, setProfileAllocModal] = useState(false);
  const [addFieldValue, setAddFieldValue] = useState(null);
  const [addFieldInput, setAddFieldInput] = useState('');
  const [addFieldPicker, setAddFieldPicker] = useState(false);
  const [profileAllocDraft, setProfileAllocDraft] = useState({
    resource_type_id: '',
    quantity: 1,
    notes: ''
  });
  const [provenanceTarget, setProvenanceTarget] = useState(null);
  if (!individual) return null;
  const indNotes = (notes || []).filter(n => n.attached_to === individual.id || n.indId === individual.id);
  const _provMeta = individual._case?.meta || {};
  const _provServer = extractHomeserver(individual.bridgeRoom || individual.id);
  const _provCreatedBy = _provMeta.created_by || _provMeta.provider || '';
  const _provCreatedAt = _provMeta.created;
  const indAllocs = (allocations || []).filter(a => a.indId === individual.id);
  return /*#__PURE__*/React.createElement("div", {
    className: "anim-up profile-page"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onBack,
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
  }), "Back to Database"), /*#__PURE__*/React.createElement("div", {
    className: "profile-header"
  }, /*#__PURE__*/React.createElement("div", {
    className: "profile-avatar",
    style: {
      background: individual.status === 'revoked' ? 'var(--border-1)' : 'var(--green)'
    }
  }, (individual.name || '?')[0].toUpperCase()), /*#__PURE__*/React.createElement("div", {
    className: "profile-info"
  }, /*#__PURE__*/React.createElement("div", {
    className: "profile-name"
  }, individual.name || 'Unknown'), /*#__PURE__*/React.createElement("div", {
    className: "profile-badges"
  }, /*#__PURE__*/React.createElement(DtStatusBadge, {
    status: individual.status
  }), individual.bridgeRoom && /*#__PURE__*/React.createElement(DtRoom, {
    room: individual.bridgeRoom
  }), individual.transferable ? /*#__PURE__*/React.createElement("span", {
    className: "tag tag-teal",
    style: {
      fontSize: 9
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "users",
    s: 8
  }), "Transferable") : /*#__PURE__*/React.createElement("span", {
    className: "tag tag-red",
    style: {
      fontSize: 9
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "lock",
    s: 8
  }), "Transfer Locked"), /*#__PURE__*/React.createElement(DtDiscBar, {
    level: individual.disclosureLevel || 0
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      marginTop: 10
    }
  }, individual._case && /*#__PURE__*/React.createElement("button", {
    onClick: () => onOpenCase(individual._case.bridgeRoomId),
    className: "b-pri b-sm",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 4
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "briefcase",
    s: 12
  }), "Open Case"), /*#__PURE__*/React.createElement("button", {
    onClick: () => onAddNote(individual.id),
    className: "b-gho b-sm",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 4
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "msg",
    s: 12
  }), "Add Note")))), /*#__PURE__*/React.createElement("div", {
    style: { display: 'flex', alignItems: 'center', gap: 12, padding: '8px 14px', marginBottom: 12, background: 'var(--bg-2)', borderRadius: 'var(--r)', border: '1px solid var(--border-0)', fontSize: 11, color: 'var(--tx-2)', fontFamily: 'var(--mono)', flexWrap: 'wrap' }
  }, /*#__PURE__*/React.createElement("span", { style: { display: 'flex', alignItems: 'center', gap: 4 } },
    /*#__PURE__*/React.createElement(I, { n: "server", s: 11, c: "var(--teal)" }), _provServer),
  _provCreatedAt && /*#__PURE__*/React.createElement("span", { style: { display: 'flex', alignItems: 'center', gap: 4 } },
    /*#__PURE__*/React.createElement(I, { n: "clock", s: 11, c: "var(--blue)" }),
    new Date(_provCreatedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })),
  _provCreatedBy && /*#__PURE__*/React.createElement("span", { style: { display: 'flex', alignItems: 'center', gap: 4 } },
    /*#__PURE__*/React.createElement(I, { n: "user", s: 11, c: "var(--gold)" }),
    (_provCreatedBy.startsWith('@') ? _provCreatedBy.split(':')[0].slice(1) : _provCreatedBy)),
  individual.bridgeRoom && /*#__PURE__*/React.createElement("span", { style: { display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto', fontSize: 9.5, color: 'var(--tx-3)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
    /*#__PURE__*/React.createElement(I, { n: "hash", s: 10, c: "var(--tx-3)" }), individual.bridgeRoom)
  ), /*#__PURE__*/React.createElement("div", {
    className: "profile-tabs"
  }, [{
    id: 'fields',
    label: 'Fields'
  }, {
    id: 'notes',
    label: `Notes (${indNotes.length})`
  }, {
    id: 'allocations',
    label: `Allocations (${indAllocs.length})`
  }, {
    id: 'activity',
    label: 'Activity'
  }, {
    id: 'provenance',
    label: 'Provenance'
  }].map(t => /*#__PURE__*/React.createElement("button", {
    key: t.id,
    className: 'profile-tab' + (tab === t.id ? ' active' : ''),
    onClick: () => setTab(t.id)
  }, t.label))), tab === 'fields' && /*#__PURE__*/React.createElement("div", {
    className: "profile-section"
  }, /*#__PURE__*/React.createElement("div", {
    style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }
  }, /*#__PURE__*/React.createElement("div", {
    className: "profile-section-title",
    style: { marginBottom: 0 }
  }, "Fields"), /*#__PURE__*/React.createElement("div", {
    className: "dt-dd-wrap",
    style: { position: 'relative' }
  }, /*#__PURE__*/React.createElement("button", {
    className: "b-pri b-sm",
    style: { display: 'flex', alignItems: 'center', gap: 4 },
    onClick: () => setAddFieldPicker(!addFieldPicker)
  }, /*#__PURE__*/React.createElement(I, { n: "plus", s: 11 }), "Add Field"), addFieldPicker && /*#__PURE__*/React.createElement("div", {
    className: "dt-dd",
    style: { minWidth: 240, maxHeight: 280, overflow: 'auto', right: 0, left: 'auto' }
  }, /*#__PURE__*/React.createElement("div", { className: "dt-dd-label" }, "Add a field value"), Object.values(fieldDefs || {}).filter(d => d.key !== 'full_name' && !(individual.fields || {})[d.key]).map(d => /*#__PURE__*/React.createElement("div", {
    key: d.uri || d.key,
    className: "dt-dd-item",
    onClick: () => { setAddFieldValue(d); setAddFieldInput(''); setAddFieldPicker(false); }
  }, /*#__PURE__*/React.createElement("div", { style: { fontWeight: 500, fontSize: 12.5 } }, d.label || d.key), /*#__PURE__*/React.createElement("div", { style: { fontSize: 10, color: 'var(--tx-3)', marginTop: 1 } }, [d.category, d.data_type].filter(Boolean).join(' \u00b7 ')))), Object.values(fieldDefs || {}).filter(d => d.key !== 'full_name' && !(individual.fields || {})[d.key]).length === 0 && /*#__PURE__*/React.createElement("div", {
    style: { padding: '12px 14px', fontSize: 11.5, color: 'var(--tx-3)' }
  }, "All fields already have values.")))), addFieldValue && /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: { padding: 14, marginBottom: 12, border: '1px solid var(--gold)', background: 'var(--bg-2)' }
  }, /*#__PURE__*/React.createElement("div", { style: { fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--gold)' } }, "Set value for: ", addFieldValue.label || addFieldValue.key), /*#__PURE__*/React.createElement("div", { style: { display: 'flex', gap: 6 } }, /*#__PURE__*/React.createElement("input", {
    className: "dt-search",
    style: { flex: 1, width: 'auto' },
    placeholder: `Enter ${addFieldValue.label || addFieldValue.key}...`,
    value: addFieldInput,
    onChange: e => setAddFieldInput(e.target.value),
    onKeyDown: e => {
      if (e.key === 'Enter' && addFieldInput.trim() && onFieldEdit) {
        onFieldEdit(individual, addFieldValue.key, addFieldInput.trim());
        setAddFieldValue(null);
        setAddFieldInput('');
      }
    },
    autoFocus: true
  }), /*#__PURE__*/React.createElement("button", {
    className: "b-pri b-sm",
    disabled: !addFieldInput.trim(),
    onClick: () => {
      if (addFieldInput.trim() && onFieldEdit) {
        onFieldEdit(individual, addFieldValue.key, addFieldInput.trim());
        setAddFieldValue(null);
        setAddFieldInput('');
      }
    }
  }, "Save"), /*#__PURE__*/React.createElement("button", {
    className: "b-gho b-sm",
    onClick: () => { setAddFieldValue(null); setAddFieldInput(''); }
  }, "Cancel"))), Object.keys(individual.fields || {}).length === 0 && !addFieldValue ? /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      textAlign: 'center',
      padding: '30px 20px',
      color: 'var(--tx-3)'
    }
  }, "No fields yet. Click ", /*#__PURE__*/React.createElement("strong", null, "Add Field"), " above to get started.") : /*#__PURE__*/React.createElement("div", {
    className: "profile-fields-grid"
  }, Object.entries(individual.fields || {}).map(([key, f]) => {
    const _fpOpen = provenanceTarget?.entityKey === key && provenanceTarget?.roomId === individual.bridgeRoom;
    return /*#__PURE__*/React.createElement("div", {
    key: key,
    className: "profile-field-card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "profile-field-label"
  }, (() => { const def = Object.values(fieldDefs || {}).find(d => d.key === key); return def?.label || key.replace(/_/g, ' '); })()), f.disclosed === false ? /*#__PURE__*/React.createElement("div", {
    className: "dt-locked"
  }, /*#__PURE__*/React.createElement(DtLock, null), " not disclosed") : /*#__PURE__*/React.createElement("div", {
    className: "profile-field-value"
  }, f.value || '\u2014'), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 4,
      marginTop: 6,
      alignItems: 'center'
    }
  }, f.eo_op && /*#__PURE__*/React.createElement(DtEo, {
    op: f.eo_op
  }), f.frame && /*#__PURE__*/React.createElement("span", {
    className: "dt-eo",
    style: {
      background: f.frame === 'GIVEN' ? 'var(--teal-dim)' : 'var(--gold-dim)',
      color: f.frame === 'GIVEN' ? 'var(--teal)' : 'var(--gold)'
    }
  }, f.frame), individual.bridgeRoom && /*#__PURE__*/React.createElement("span", {
    onClick: () => setProvenanceTarget(_fpOpen ? null : { entityKey: key, label: key.replace(/_/g, ' '), roomId: individual.bridgeRoom }),
    style: { cursor: 'pointer', color: _fpOpen ? 'var(--teal)' : 'var(--tx-3)', transition: 'color .15s', marginLeft: 'auto' },
    title: "View field history"
  }, /*#__PURE__*/React.createElement(I, { n: "git-commit", s: 11 }))),
  _fpOpen && /*#__PURE__*/React.createElement("div", {
    style: { marginTop: 6 }
  }, /*#__PURE__*/React.createElement(RecordProvenance, {
    roomId: individual.bridgeRoom,
    entityKey: key,
    label: key.replace(/_/g, ' '),
    session: null,
    onRestore: onFieldEdit ? value => onFieldEdit(individual, key, value) : null
  })));
  }))), tab === 'notes' && /*#__PURE__*/React.createElement("div", {
    className: "profile-section"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "profile-section-title",
    style: {
      marginBottom: 0
    }
  }, "Notes"), /*#__PURE__*/React.createElement("button", {
    onClick: () => onAddNote(individual.id),
    className: "b-gho b-xs",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 3
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "plus",
    s: 11
  }), "Add Note")), indNotes.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      textAlign: 'center',
      padding: '30px 20px',
      color: 'var(--tx-3)'
    }
  }, "No notes yet. Click \"Add Note\" to create one.") : indNotes.map(n => /*#__PURE__*/React.createElement("div", {
    key: n.id,
    className: 'note-card' + (n.tombstoned ? ' tombstoned' : n.attached_to ? ' attached' : ' standalone')
  }, n.tombstoned ? /*#__PURE__*/React.createElement("div", {
    className: "tombstone-notice"
  }, /*#__PURE__*/React.createElement(I, {
    n: "shield",
    s: 14
  }), "This note was deleted by the individual. The record has been tombstoned.") : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "note-header"
  }, /*#__PURE__*/React.createElement("div", {
    className: "note-title"
  }, n.title || '(untitled)'), /*#__PURE__*/React.createElement("div", {
    className: "note-meta"
  }, dtFmtDate(n.created), " \xB7 ", (n.author || '').split(':')[0]?.replace('@', ''))), /*#__PURE__*/React.createElement("div", {
    className: "note-body"
  }, n.content || n.text || ''), n.tags && n.tags.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "note-tags"
  }, n.tags.map(t => /*#__PURE__*/React.createElement("span", {
    key: t.userId,
    className: "note-tag-chip"
  }, t.displayName))))))), tab === 'allocations' && /*#__PURE__*/React.createElement("div", {
    className: "profile-section"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "profile-section-title",
    style: {
      marginBottom: 0
    }
  }, "Resource Allocations"), orgRoom && (resourceTypes || []).length > 0 && onAllocate && individual.bridgeRoom && /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setProfileAllocDraft({
        resource_type_id: '',
        quantity: 1,
        notes: ''
      });
      setProfileAllocModal(true);
    },
    className: "b-pri b-sm",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 4
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "plus",
    s: 11
  }), "Allocate")), indAllocs.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      textAlign: 'center',
      padding: '30px 20px',
      color: 'var(--tx-3)'
    }
  }, "No resource allocations.") : indAllocs.map(a => /*#__PURE__*/React.createElement("div", {
    key: a.id,
    className: "dt-alloc"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dt-alloc-header"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 600,
      fontSize: 13
    }
  }, a.resourceName || 'Resource'), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: 'var(--tx-2)'
    }
  }, a.quantity, " ", a.unit, " \xB7 ", dtFmtDate(a.at))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 4
    }
  }, /*#__PURE__*/React.createElement(DtEo, {
    op: a.eo_op || 'CON'
  }), /*#__PURE__*/React.createElement("span", {
    className: 'tag ' + (a.status === 'active' ? 'tag-green' : 'tag-purple'),
    style: {
      fontSize: 10
    }
  }, a.status)))))), tab === 'activity' && /*#__PURE__*/React.createElement("div", {
    className: "profile-section"
  }, /*#__PURE__*/React.createElement("div", {
    className: "profile-section-title"
  }, "Recent Activity"), /*#__PURE__*/React.createElement(ProfileActivityFeed, {
    individual: individual,
    svc: svc
  })), tab === 'provenance' && /*#__PURE__*/React.createElement("div", {
    className: "profile-section"
  }, /*#__PURE__*/React.createElement("div", {
    className: "profile-section-title"
  }, "Record Provenance"), /*#__PURE__*/React.createElement(StorageTransparencyBadge, {
    storageType: "matrix",
    roomId: individual.bridgeRoom,
    encrypted: true,
    encLabel: "Megolm E2EE",
    label: "Personal Record",
    members: [
      ...(individual._case?.meta?.client ? [{ userId: individual._case.meta.client, role: 'client (sovereign owner)' }] : []),
      ...(individual._case?.meta?.provider ? [{ userId: individual._case.meta.provider, role: 'provider' }] : []),
      ...((individual._case?.meta?.assigned_staff || []).filter(s => s !== individual._case?.meta?.provider).map(s => ({ userId: s, role: 'assigned ' + T.staff_term.toLowerCase() })))
    ],
    extra: [
      { label: 'Record type', value: 'Individual profile stored in a shared bridge room' },
      { label: 'Sovereignty', value: individual._case?.meta?.client ? 'Client-owned bridge — client has superadmin power level' : 'Provider-created record' }
    ]
  }), /*#__PURE__*/React.createElement("div", {
    style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, margin: '14px 0' }
  }, /*#__PURE__*/React.createElement("div", {
    style: { padding: '10px 12px', background: 'var(--bg-2)', borderRadius: 6 }
  }, /*#__PURE__*/React.createElement("div", {
    style: { fontSize: 9, textTransform: 'uppercase', color: 'var(--tx-3)', letterSpacing: '.04em', marginBottom: 2 }
  }, "Server"), /*#__PURE__*/React.createElement("div", {
    style: { fontSize: 11.5, fontFamily: 'var(--mono)', color: 'var(--tx-1)', wordBreak: 'break-all' }
  }, _provServer)), /*#__PURE__*/React.createElement("div", {
    style: { padding: '10px 12px', background: 'var(--bg-2)', borderRadius: 6 }
  }, /*#__PURE__*/React.createElement("div", {
    style: { fontSize: 9, textTransform: 'uppercase', color: 'var(--tx-3)', letterSpacing: '.04em', marginBottom: 2 }
  }, "Created by"), /*#__PURE__*/React.createElement("div", {
    style: { fontSize: 11.5, color: 'var(--tx-1)' }
  }, _provCreatedBy ? (_provCreatedBy.startsWith('@') ? _provCreatedBy.split(':')[0].slice(1) : _provCreatedBy) : 'Unknown'), _provCreatedBy && /*#__PURE__*/React.createElement("div", {
    style: { fontSize: 9.5, color: 'var(--tx-3)', fontFamily: 'var(--mono)' }
  }, extractHomeserver(_provCreatedBy))), /*#__PURE__*/React.createElement("div", {
    style: { padding: '10px 12px', background: 'var(--bg-2)', borderRadius: 6 }
  }, /*#__PURE__*/React.createElement("div", {
    style: { fontSize: 9, textTransform: 'uppercase', color: 'var(--tx-3)', letterSpacing: '.04em', marginBottom: 2 }
  }, "Created"), /*#__PURE__*/React.createElement("div", {
    style: { fontSize: 11.5, color: 'var(--tx-1)' }
  }, _provCreatedAt ? new Date(_provCreatedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) + ' ' + new Date(_provCreatedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '\u2014')), /*#__PURE__*/React.createElement("div", {
    style: { padding: '10px 12px', background: 'var(--bg-2)', borderRadius: 6 }
  }, /*#__PURE__*/React.createElement("div", {
    style: { fontSize: 9, textTransform: 'uppercase', color: 'var(--tx-3)', letterSpacing: '.04em', marginBottom: 2 }
  }, "Status"), /*#__PURE__*/React.createElement("div", {
    style: { display: 'flex', alignItems: 'center', gap: 4 }
  }, /*#__PURE__*/React.createElement("span", {
    style: { width: 6, height: 6, borderRadius: '50%', background: individual.status === 'active' ? 'var(--green)' : individual.status === 'revoked' ? 'var(--red)' : 'var(--gold)' }
  }), /*#__PURE__*/React.createElement("span", {
    style: { fontSize: 11.5, color: 'var(--tx-1)', textTransform: 'capitalize' }
  }, individual.status || 'unknown')))), /*#__PURE__*/React.createElement("div", {
    style: { marginTop: 4 }
  }, /*#__PURE__*/React.createElement("div", {
    style: { fontSize: 10.5, textTransform: 'uppercase', color: 'var(--tx-3)', letterSpacing: '.04em', marginBottom: 8, fontWeight: 600 }
  }, "Full EO Operation History"), /*#__PURE__*/React.createElement(RecordProvenance, {
    roomId: individual.bridgeRoom,
    entityKey: 'bridge',
    label: individual.name || 'Individual',
    session: null
  }))), /*#__PURE__*/React.createElement(Modal, {
    open: profileAllocModal,
    onClose: () => setProfileAllocModal(false),
    title: "Allocate Resource",
    w: 480
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12,
      color: 'var(--tx-1)',
      marginBottom: 14,
      lineHeight: 1.6
    }
  }, "Allocate a resource to ", /*#__PURE__*/React.createElement("strong", null, individual.name || 'this individual'), ". The allocation is recorded in the bridge room and updates org inventory."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "RESOURCE TYPE"), /*#__PURE__*/React.createElement("select", {
    value: profileAllocDraft.resource_type_id,
    onChange: e => setProfileAllocDraft({
      ...profileAllocDraft,
      resource_type_id: e.target.value
    })
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "Select a resource..."), (resourceTypes || []).filter(rt => canAllocateResource && canAllocateResource(rt, svc.userId, orgRole)).map(rt => {
    const relation = (resourceRelations || []).find(r => r.resource_type_id === rt.id);
    const inv = relation ? (resourceInventory || {})[relation.id] : null;
    return /*#__PURE__*/React.createElement("option", {
      key: rt.id,
      value: rt.id
    }, rt.name, " (", rt.unit, ")", inv ? ` — ${inv.available || 0} available` : '');
  }))), profileAllocDraft.resource_type_id && (() => {
    const rt = (resourceTypes || []).find(t => t.id === profileAllocDraft.resource_type_id);
    if (!rt) return null;
    return /*#__PURE__*/React.createElement("div", {
      style: {
        background: 'var(--bg-2)',
        border: '1px solid var(--border-0)',
        borderRadius: 'var(--r)',
        padding: '10px 14px',
        marginBottom: 14
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        marginBottom: 4
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: `tag tag-${RESOURCE_CATEGORY_COLORS[rt.category] || 'teal'}`,
      style: {
        fontSize: 8.5
      }
    }, RESOURCE_CATEGORY_LABELS[rt.category] || rt.category), rt.fungible && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 9,
        color: 'var(--tx-2)',
        fontFamily: 'var(--mono)'
      }
    }, "fungible"), rt.perishable && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 9,
        color: 'var(--orange)',
        fontFamily: 'var(--mono)'
      }
    }, "expires ", rt.ttl_days, "d")), rt.tags?.length > 0 && /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 3,
        flexWrap: 'wrap'
      }
    }, rt.tags.map(tag => /*#__PURE__*/React.createElement("span", {
      key: tag,
      style: {
        fontSize: 8,
        padding: '1px 5px',
        borderRadius: 99,
        background: 'var(--bg-3)',
        color: 'var(--tx-2)',
        fontFamily: 'var(--mono)'
      }
    }, tag))));
  })(), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "QUANTITY"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    min: "1",
    value: profileAllocDraft.quantity,
    onChange: e => setProfileAllocDraft({
      ...profileAllocDraft,
      quantity: e.target.value
    }),
    placeholder: "1"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "NOTES (OPTIONAL)"), /*#__PURE__*/React.createElement("input", {
    value: profileAllocDraft.notes,
    onChange: e => setProfileAllocDraft({
      ...profileAllocDraft,
      notes: e.target.value
    }),
    placeholder: "e.g. For medical appointments this week"
  })), /*#__PURE__*/React.createElement("button", {
    onClick: async () => {
      if (!profileAllocDraft.resource_type_id || !onAllocate) return;
      const success = await onAllocate(individual.bridgeRoom, profileAllocDraft);
      if (success) {
        setProfileAllocModal(false);
        setProfileAllocDraft({
          resource_type_id: '',
          quantity: 1,
          notes: ''
        });
      }
    },
    className: "b-pri",
    disabled: !profileAllocDraft.resource_type_id,
    style: {
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "plus",
    s: 13
  }), "Allocate Resource")));
};

/* ─── ResourceProfilePage — full profile view for a resource ─── */
const ResourceProfilePage = ({
  resource,
  allocations,
  onBack,
  T
}) => {
  const [tab, setTab] = useState('details');
  if (!resource) return null;
  const resAllocs = (allocations || []).filter(a => a.resourceId === resource.id);
  return /*#__PURE__*/React.createElement("div", {
    className: "anim-up profile-page"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onBack,
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
  }), "Back to Database"), /*#__PURE__*/React.createElement("div", {
    className: "profile-header"
  }, /*#__PURE__*/React.createElement("div", {
    className: "profile-avatar",
    style: {
      background: 'var(--teal)'
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "layers",
    s: 22
  })), /*#__PURE__*/React.createElement("div", {
    className: "profile-info"
  }, /*#__PURE__*/React.createElement("div", {
    className: "profile-name"
  }, resource.name), /*#__PURE__*/React.createElement("div", {
    className: "profile-badges"
  }, /*#__PURE__*/React.createElement("span", {
    className: 'tag tag-' + (RESOURCE_CATEGORY_COLORS[resource.category] || 'teal'),
    style: {
      fontSize: 10
    }
  }, RESOURCE_CATEGORY_LABELS[resource.category] || resource.category), resource.relation && /*#__PURE__*/React.createElement("span", {
    className: "tag tag-gold",
    style: {
      fontSize: 10
    }
  }, resource.relation), resource.opacityLevel && (() => {
    const o = DT_OP_CFG[resource.opacityLevel];
    return o ? /*#__PURE__*/React.createElement("span", {
      className: 'tag ' + o.cls,
      style: {
        fontSize: 10
      }
    }, o.l) : null;
  })(), /*#__PURE__*/React.createElement(DtRoom, {
    room: resource.orgRoom
  })))), /*#__PURE__*/React.createElement("div", {
    style: { display: 'flex', alignItems: 'center', gap: 12, padding: '8px 14px', marginBottom: 12, background: 'var(--bg-2)', borderRadius: 'var(--r)', border: '1px solid var(--border-0)', fontSize: 11, color: 'var(--tx-2)', fontFamily: 'var(--mono)', flexWrap: 'wrap' }
  }, /*#__PURE__*/React.createElement("span", { style: { display: 'flex', alignItems: 'center', gap: 4 } },
    /*#__PURE__*/React.createElement(I, { n: "server", s: 11, c: "var(--teal)" }), extractHomeserver(resource.orgRoom || resource.id || '')),
  resource.created && /*#__PURE__*/React.createElement("span", { style: { display: 'flex', alignItems: 'center', gap: 4 } },
    /*#__PURE__*/React.createElement(I, { n: "clock", s: 11, c: "var(--blue)" }),
    new Date(resource.created).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })),
  resource.orgRoom && /*#__PURE__*/React.createElement("span", { style: { display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto', fontSize: 9.5, color: 'var(--tx-3)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
    /*#__PURE__*/React.createElement(I, { n: "hash", s: 10, c: "var(--tx-3)" }), resource.orgRoom)
  ), /*#__PURE__*/React.createElement("div", {
    className: "profile-tabs"
  }, [{
    id: 'details',
    label: 'Details'
  }, {
    id: 'provisioning',
    label: 'Provisioning'
  }, {
    id: 'allocations',
    label: `Allocations (${resAllocs.length})`
  }, {
    id: 'provenance',
    label: 'Provenance'
  }].map(t => /*#__PURE__*/React.createElement("button", {
    key: t.id,
    className: 'profile-tab' + (tab === t.id ? ' active' : ''),
    onClick: () => setTab(t.id)
  }, t.label))), tab === 'details' && /*#__PURE__*/React.createElement("div", {
    className: "profile-section"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dt-cap"
  }, [{
    n: resource.available || 0,
    l: 'Available',
    c: 'var(--green)'
  }, {
    n: resource.allocated || 0,
    l: 'Allocated',
    c: 'var(--teal)'
  }, {
    n: resource.reserved || 0,
    l: 'Reserved',
    c: 'var(--gold)'
  }, {
    n: resource.totalCapacity || 0,
    l: 'Total',
    c: 'var(--tx-0)'
  }].map((s, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "dt-cap-box"
  }, /*#__PURE__*/React.createElement("div", {
    className: "num",
    style: {
      color: s.c
    }
  }, s.n), /*#__PURE__*/React.createElement("div", {
    className: "lbl"
  }, s.l)))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement(DtUtilBar, {
    pct: resource.utilizationPct || 0
  })), /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "Details"), /*#__PURE__*/React.createElement("div", {
    className: "dt-field-grid"
  }, [{
    k: 'Holder',
    v: (resource.holder || '—') + ' (' + (resource.holderType || 'org') + ')'
  }, {
    k: 'Relation',
    v: resource.relation || '—'
  }, {
    k: 'Network',
    v: resource.network || '—'
  }, {
    k: 'Governance',
    v: resource.governance || '—'
  }, {
    k: 'Updated',
    v: dtFmtDate(resource.lastUpdated)
  }, {
    k: 'Unit',
    v: resource.unit || '—'
  }].map(({
    k,
    v
  }) => /*#__PURE__*/React.createElement(React.Fragment, {
    key: k
  }, /*#__PURE__*/React.createElement("div", {
    className: "dt-field-key"
  }, k), /*#__PURE__*/React.createElement("div", null, v))))), tab === 'provisioning' && /*#__PURE__*/React.createElement("div", {
    className: "profile-section"
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "Provisioning Timeline"), (resource.provisioningEvents || []).length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      textAlign: 'center',
      padding: '30px 20px',
      color: 'var(--tx-3)'
    }
  }, "No provisioning events.") : (resource.provisioningEvents || []).map((evt, i) => {
    const color = DT_PROV_COLORS[evt.event] || 'var(--tx-2)';
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      className: "dt-prov"
    }, /*#__PURE__*/React.createElement("div", {
      className: "dt-prov-icon",
      style: {
        background: color + '18',
        color
      }
    }, evt.event === 'restocked' ? '↑' : '→'), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("strong", null, (evt.event || '').replace(/_/g, ' ')), " ", /*#__PURE__*/React.createElement(DtEo, {
      op: evt.eo_op || 'ALT'
    }), ' ', /*#__PURE__*/React.createElement("span", {
      style: {
        color,
        fontWeight: 600,
        fontFamily: 'var(--mono)',
        fontSize: 12
      }
    }, evt.delta)), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11,
        color: 'var(--tx-3)'
      }
    }, dtFmtDate(evt.at))));
  })), tab === 'allocations' && /*#__PURE__*/React.createElement("div", {
    className: "profile-section"
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "Allocations"), resAllocs.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      textAlign: 'center',
      padding: '30px 20px',
      color: 'var(--tx-3)'
    }
  }, "No allocations.") : resAllocs.map(a => /*#__PURE__*/React.createElement("div", {
    key: a.id,
    className: "dt-alloc"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dt-alloc-header"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 600,
      fontSize: 13
    }
  }, a.indName || '[bridge ref]'), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: 'var(--tx-2)'
    }
  }, a.quantity, " ", a.unit, " \xB7 ", dtFmtDate(a.at))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 4
    }
  }, /*#__PURE__*/React.createElement(DtEo, {
    op: a.eo_op || 'CON'
  }), /*#__PURE__*/React.createElement("span", {
    className: 'tag ' + (a.status === 'active' ? 'tag-green' : 'tag-purple'),
    style: {
      fontSize: 10
    }
  }, a.status)))))), tab === 'provenance' && /*#__PURE__*/React.createElement("div", {
    className: "profile-section"
  }, /*#__PURE__*/React.createElement("div", {
    className: "profile-section-title"
  }, "Record Provenance"), /*#__PURE__*/React.createElement(StorageTransparencyBadge, {
    storageType: "matrix",
    roomId: resource.orgRoom,
    encrypted: true,
    encLabel: "Megolm E2EE",
    label: "Resource Record",
    extra: [
      { label: 'Record type', value: 'Resource type stored in the organization room' },
      { label: 'Holder', value: resource.holder || 'Organization' }
    ]
  }), /*#__PURE__*/React.createElement("div", {
    style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, margin: '14px 0' }
  }, /*#__PURE__*/React.createElement("div", {
    style: { padding: '10px 12px', background: 'var(--bg-2)', borderRadius: 6 }
  }, /*#__PURE__*/React.createElement("div", {
    style: { fontSize: 9, textTransform: 'uppercase', color: 'var(--tx-3)', letterSpacing: '.04em', marginBottom: 2 }
  }, "Server"), /*#__PURE__*/React.createElement("div", {
    style: { fontSize: 11.5, fontFamily: 'var(--mono)', color: 'var(--tx-1)', wordBreak: 'break-all' }
  }, extractHomeserver(resource.orgRoom || resource.id || ''))), /*#__PURE__*/React.createElement("div", {
    style: { padding: '10px 12px', background: 'var(--bg-2)', borderRadius: 6 }
  }, /*#__PURE__*/React.createElement("div", {
    style: { fontSize: 9, textTransform: 'uppercase', color: 'var(--tx-3)', letterSpacing: '.04em', marginBottom: 2 }
  }, "Created"), /*#__PURE__*/React.createElement("div", {
    style: { fontSize: 11.5, color: 'var(--tx-1)' }
  }, resource.created ? new Date(resource.created).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) + ' ' + new Date(resource.created).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '\u2014')), /*#__PURE__*/React.createElement("div", {
    style: { padding: '10px 12px', background: 'var(--bg-2)', borderRadius: 6 }
  }, /*#__PURE__*/React.createElement("div", {
    style: { fontSize: 9, textTransform: 'uppercase', color: 'var(--tx-3)', letterSpacing: '.04em', marginBottom: 2 }
  }, "Unit"), /*#__PURE__*/React.createElement("div", {
    style: { fontSize: 11.5, color: 'var(--tx-1)' }
  }, resource.unit || '\u2014')), /*#__PURE__*/React.createElement("div", {
    style: { padding: '10px 12px', background: 'var(--bg-2)', borderRadius: 6 }
  }, /*#__PURE__*/React.createElement("div", {
    style: { fontSize: 9, textTransform: 'uppercase', color: 'var(--tx-3)', letterSpacing: '.04em', marginBottom: 2 }
  }, "Category"), /*#__PURE__*/React.createElement("div", {
    style: { fontSize: 11.5, color: 'var(--tx-1)', textTransform: 'capitalize' }
  }, RESOURCE_CATEGORY_LABELS[resource.category] || resource.category || '\u2014'))), /*#__PURE__*/React.createElement("div", {
    style: { marginTop: 4 }
  }, /*#__PURE__*/React.createElement("div", {
    style: { fontSize: 10.5, textTransform: 'uppercase', color: 'var(--tx-3)', letterSpacing: '.04em', marginBottom: 8, fontWeight: 600 }
  }, "Full EO Operation History"), resource.orgRoom ? /*#__PURE__*/React.createElement(RecordProvenance, {
    roomId: resource.orgRoom,
    entityKey: resource.id || 'resources',
    label: resource.name || 'Resource',
    session: null
  }) : /*#__PURE__*/React.createElement("div", {
    style: { fontSize: 11, color: 'var(--tx-3)', padding: 12 }
  }, "No room available for provenance lookup."))));
};

/* ─── DashboardOverview — lightweight home with stats and recent activity ─── */
const DashboardOverview = ({
  cases,
  clientRecords,
  staff,
  T,
  notes,
  resourceTypes,
  onGoToDatabase,
  onDiscover,
  onCreateClient
}) => {
  const recentNotes = (notes || []).slice(0, 5);
  return /*#__PURE__*/React.createElement("div", {
    className: "anim-up",
    style: {
      maxWidth: 1000,
      margin: '0 auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", {
    style: {
      fontFamily: 'var(--serif)',
      fontSize: 22,
      fontWeight: 700
    }
  }, "Dashboard"), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--tx-1)',
      fontSize: 12.5,
      marginTop: 2
    }
  }, "Quick overview of your workspace."), /*#__PURE__*/React.createElement(StorageTransparencyBadge, {
    storageType: "matrix",
    encrypted: true,
    encLabel: "Megolm E2EE",
    label: "Dashboard",
    compact: true
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onDiscover,
    className: "b-gho b-sm",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 4
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "search",
    s: 12
  }), "Find ", T?.client_term || 'Client'), /*#__PURE__*/React.createElement("button", {
    onClick: onCreateClient,
    className: "b-pri b-sm",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 4
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "plus",
    s: 12
  }), "New ", T?.client_term || 'Individual'))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))',
      gap: 10,
      marginBottom: 24
    }
  }, [{
    l: `Active ${T?.client_term_plural || 'Cases'}`,
    v: cases.length,
    c: 'gold',
    i: 'users'
  }, {
    l: `${T?.client_term || 'Client'} Records`,
    v: (clientRecords || []).length,
    c: 'teal',
    i: 'shield'
  }, {
    l: T.staff_term_plural,
    v: (staff || []).length,
    c: 'blue',
    i: 'briefcase'
  }, {
    l: 'Resources',
    v: (resourceTypes || []).length,
    c: 'green',
    i: 'layers'
  }, {
    l: 'Notes',
    v: (notes || []).length,
    c: 'purple',
    i: 'msg'
  }].map((s, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "card",
    style: {
      padding: 14,
      cursor: 'pointer'
    },
    onClick: onGoToDatabase
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, s.l.toUpperCase()), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 4
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 22,
      fontWeight: 700
    }
  }, s.v), /*#__PURE__*/React.createElement("span", {
    style: {
      color: `var(--${s.c})`,
      opacity: .5
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: s.i,
    s: 18
  })))))), /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "QUICK ACTIONS"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      marginTop: 8,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onGoToDatabase,
    className: "b-gho b-sm",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 4
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "grid",
    s: 12
  }), "Open Database"), /*#__PURE__*/React.createElement("button", {
    onClick: onDiscover,
    className: "b-gho b-sm",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 4
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "search",
    s: 12
  }), "Find ", T?.client_term || 'Client'), /*#__PURE__*/React.createElement("button", {
    onClick: onCreateClient,
    className: "b-gho b-sm",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 4
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "plus",
    s: 12
  }), "New ", T?.client_term || 'Individual'))), recentNotes.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "card"
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "RECENT NOTES"), recentNotes.map(n => /*#__PURE__*/React.createElement("div", {
    key: n.id,
    style: {
      padding: '8px 0',
      borderBottom: '1px solid var(--border-0)',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      fontWeight: 600
    }
  }, n.title || '(untitled)'), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: 'var(--tx-2)',
      marginLeft: 8
    }
  }, (n.author || '').split(':')[0]?.replace('@', ''))), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      color: 'var(--tx-3)',
      fontFamily: 'var(--mono)'
    }
  }, dtFmtDate(n.created))))));
};

/* ─── IndividualsView — replaces old dashboard card grid ─── */
const IndividualsView = ({
  cases,
  caseAssignments,
  openCase,
  T,
  svc,
  caseAllocations,
  providerProfile,
  orgRoom,
  orgMeta,
  staff,
  orgRole,
  showToast,
  bridgeNotes,
  rosterNotes,
  allAllocations,
  onCreateOrg,
  onEditProfile,
  onDiscover,
  myVerification,
  emailVerifyConfig,
  openEmailVerifyModal,
  orgChannels,
  ORG_TYPE_LABELS,
  ORG_ROLE_LABELS,
  onAllocate,
  resourceTypes,
  resourceRelations,
  resourceInventory,
  canAllocateResource
}) => {
  const [dtTab, setDtTab] = useState('individuals');
  const [selectedRow, setSelectedRow] = useState(null);
  const [panelTab, setPanelTab] = useState('fields');
  const [provenanceField, setProvenanceField] = useState(null);

  // Transform cases into individual rows
  const individuals = cases.map(c => {
    const assignment = caseAssignments[c.bridgeRoomId];
    const fields = {};
    Object.entries(c.sharedData || {}).forEach(([k, v]) => {
      if (k === 'full_name') return; // handled as name
      fields[k] = {
        value: v,
        disclosed: true,
        eo_op: 'INS',
        frame: 'GIVEN',
        room: 'bridge',
        editable: false,
        history: []
      };
    });
    return {
      id: c.bridgeRoomId,
      name: c.sharedData.full_name || c.clientUserId || 'Unknown',
      alias: null,
      status: c.meta?.status === 'tombstoned' ? 'revoked' : c.sharedData.full_name ? 'active' : 'imported',
      disclosureLevel: Object.keys(c.sharedData || {}).length > 0 ? Math.min(Object.keys(c.sharedData).length / 10, 1) : 0,
      lastContact: c.meta?.last_updated || c.meta?.created,
      assignedTo: (assignment?.primary || c.meta?.provider || '').split(':')[0]?.replace('@', '') || '—',
      activeCases: 1,
      needs: [],
      priority: assignment?.priority || 'none',
      nextAction: assignment?.next_action || null,
      nextActionDue: assignment?.next_action_due || null,
      bridgeRoom: c.bridgeRoomId,
      vaultRoom: null,
      rosterRef: null,
      fields,
      transferable: c.transferable,
      _case: c // preserve original for openCase
    };
  });
  const IND_COLS = [{
    key: 'name',
    label: 'Individual',
    fixed: true
  }, {
    key: 'status',
    label: 'Status'
  }, {
    key: 'priority',
    label: 'Priority'
  }, {
    key: 'assignedTo',
    label: 'Assigned'
  }, {
    key: 'fields_count',
    label: 'Fields'
  }, {
    key: 'transferable',
    label: 'Transfer'
  }];

  // Add dynamic field columns from shared data
  const fieldKeys = new Set();
  cases.forEach(c => Object.keys(c.sharedData || {}).forEach(k => {
    if (k !== 'full_name') fieldKeys.add(k);
  }));
  fieldKeys.forEach(k => {
    IND_COLS.push({
      key: k,
      label: k.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      isField: true
    });
  });
  const IND_GROUPS = [{
    k: 'none',
    l: 'No grouping'
  }, {
    k: 'status',
    l: 'Status'
  }, {
    k: 'assignedTo',
    l: 'Assigned To'
  }, {
    k: 'priority',
    l: 'Priority'
  }];
  const defaultVisCols = ['name', 'status', 'priority', 'assignedTo', 'fields_count', 'transferable', ...Array.from(fieldKeys).slice(0, 3)];
  const getIndVal = (row, key) => {
    if (key === 'fields_count') return Object.keys(row.fields || {}).length;
    if (key === 'transferable') return row.transferable ? 'Yes' : 'Locked';
    if (row.fields && row.fields[key]) return row.fields[key].value || '';
    return row[key] || '';
  };
  const renderIndCell = (row, col) => {
    const k = col.key;
    if (k === 'name') {
      const initial = (row.name || '?')[0].toUpperCase();
      return /*#__PURE__*/React.createElement("div", {
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
          background: row.status === 'revoked' ? 'var(--border-1)' : 'var(--green)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontSize: 11,
          fontWeight: 700,
          flexShrink: 0
        }
      }, initial), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
        style: {
          fontWeight: 600,
          fontSize: 13
        }
      }, row.name), row.alias && /*#__PURE__*/React.createElement("div", {
        style: {
          fontSize: 11,
          color: 'var(--tx-3)'
        }
      }, "\"", row.alias, "\"")));
    }
    if (k === 'status') return /*#__PURE__*/React.createElement(DtStatusBadge, {
      status: row.status
    });
    if (k === 'priority') {
      const cls = DT_PRI_CFG[row.priority] || 'tag-purple';
      return /*#__PURE__*/React.createElement("span", {
        className: 'tag ' + cls,
        style: {
          fontSize: 10
        }
      }, row.priority);
    }
    if (k === 'assignedTo') return /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13,
        color: 'var(--tx-1)'
      }
    }, row.assignedTo);
    if (k === 'fields_count') {
      const ct = Object.keys(row.fields || {}).length;
      return /*#__PURE__*/React.createElement("span", {
        style: {
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 22,
          height: 22,
          borderRadius: 5,
          background: ct > 0 ? 'var(--green-dim)' : 'var(--bg-3)',
          color: ct > 0 ? 'var(--green)' : 'var(--tx-3)',
          fontSize: 12,
          fontWeight: 700
        }
      }, ct);
    }
    if (k === 'transferable') {
      return row.transferable ? /*#__PURE__*/React.createElement("span", {
        className: "tag tag-teal",
        style: {
          fontSize: 9
        }
      }, "Transferable") : /*#__PURE__*/React.createElement("span", {
        className: "tag tag-red",
        style: {
          fontSize: 9
        }
      }, "Locked");
    }
    if (k === 'needs' && row.needs) {
      return row.needs.length > 0 ? row.needs.map(n => /*#__PURE__*/React.createElement("span", {
        key: n,
        className: 'tag ' + (DT_NEED_COLORS[n] || 'tag-purple'),
        style: {
          fontSize: 9,
          marginRight: 2
        }
      }, n)) : /*#__PURE__*/React.createElement("span", {
        style: {
          color: 'var(--tx-3)',
          fontSize: 12
        }
      }, "\u2014");
    }
    // Field columns
    if (col.isField && row.fields && row.fields[k]) {
      const f = row.fields[k];
      if (f.disclosed === false) return /*#__PURE__*/React.createElement("span", {
        className: "dt-locked"
      }, /*#__PURE__*/React.createElement(DtLock, null), " not disclosed");
      return /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 13
        }
      }, f.value || '—');
    }
    return /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--tx-3)',
        fontSize: 12
      }
    }, "\u2014");
  };
  const selectedInd = selectedRow ? individuals.find(r => r.id === selectedRow) : null;

  // Combine notes for selected individual
  const allNotes = [...(bridgeNotes[selectedRow] || []).map(n => ({
    ...n,
    type: 'shared'
  })), ...(rosterNotes || []).filter(n => n.indId === selectedRow).map(n => ({
    ...n,
    type: 'internal'
  }))];
  return /*#__PURE__*/React.createElement("div", {
    className: "anim-up"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 4
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", {
    style: {
      fontFamily: 'var(--serif)',
      fontSize: 22,
      fontWeight: 700
    }
  }, T.provider_term, " Dashboard"), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--tx-1)',
      fontSize: 12.5,
      marginTop: 2
    }
  }, "Each row is an encrypted bridge room. Click to view fields, notes, and allocations.")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onDiscover,
    className: "b-gho b-sm",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 4
    }
  }, "Find ", T?.client_term || 'Individual'))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))',
      gap: 10,
      marginBottom: 20
    }
  }, [{
    l: 'Active Cases',
    v: cases.length,
    c: 'gold'
  }, {
    l: T.staff_term_plural,
    v: staff.length,
    c: 'blue'
  }, {
    l: 'Access Model',
    v: `${T.client_term}-granted`,
    c: 'teal'
  }, {
    l: 'Fields Shared',
    v: cases.reduce((s, c) => s + Object.keys(c.sharedData || {}).length, 0),
    c: 'green'
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
      display: 'block',
      marginTop: 2
    }
  }, s.v)))), /*#__PURE__*/React.createElement(DataTable, {
    data: individuals,
    columns: IND_COLS,
    groupOptions: IND_GROUPS,
    defaultVisibleCols: defaultVisCols,
    onRowClick: row => {
      setSelectedRow(row.id);
      setPanelTab('fields');
      setProvenanceField(null);
    },
    renderCell: renderIndCell,
    getVal: getIndVal,
    selectedId: selectedRow,
    label: "individuals"
  }), selectedInd && /*#__PURE__*/React.createElement(IndividualPanel, {
    row: selectedInd,
    notes: allNotes,
    allocations: allAllocations || [],
    onClose: () => setSelectedRow(null),
    panelTab: panelTab,
    setPanelTab: setPanelTab,
    provenanceField: provenanceField,
    setProvenanceField: setProvenanceField,
    svc: svc,
    onRestoreField: null,
    onAllocate: onAllocate,
    resourceTypes: resourceTypes,
    resourceRelations: resourceRelations,
    resourceInventory: resourceInventory,
    orgRoom: orgRoom,
    orgRole: orgRole,
    canAllocateResource: canAllocateResource
  }));
};

/* ─── ResourcesTableView — replaces old card-based resource view ─── */
const ResourcesTableView = ({
  resourceTypes,
  resourceRelations,
  resourceInventory,
  T,
  svc,
  orgRole,
  orgRoom,
  rosterRoom,
  networkRoom,
  allAllocations,
  onCreateResource,
  onRefresh,
  onRestock,
  onEstablishRelation,
  canViewResource,
  canControlResource,
  canAllocateResource,
  individuals,
  onAllocate
}) => {
  const [selectedRow, setSelectedRow] = useState(null);
  const [panelTab, setPanelTab] = useState('details');

  // Build resource rows
  const resources = resourceTypes.filter(rt => canViewResource(rt, svc.userId, orgRole)).map(rt => {
    const relation = resourceRelations.find(rel => rel.resource_type_id === rt.id);
    const inv = relation ? resourceInventory[relation.id] : null;
    const total = inv ? inv.total_capacity || inv.capacity || 0 : 0;
    const allocated = inv ? inv.allocated || 0 : 0;
    const reserved = inv ? inv.reserved || 0 : 0;
    const available = total - allocated - reserved;
    const utilPct = total > 0 ? (allocated + reserved) / total : 0;
    return {
      id: rt.id,
      name: rt.name,
      type: rt.category,
      category: rt.category,
      holder: rt._sourceRoom ? 'Organization' : 'Personal',
      holderType: rt._source || 'org',
      relation: relation ? relation.relation_type || 'operates' : '—',
      network: rt._source === 'network' ? 'Network' : '—',
      totalCapacity: total,
      available: Math.max(0, available),
      allocated,
      reserved,
      utilizationPct: utilPct,
      lastUpdated: inv?.last_updated || rt.created,
      opacityLevel: relation?.opacity !== undefined ? ['sovereign', 'attested', 'contributed', 'published'][relation.opacity] || 'sovereign' : 'sovereign',
      governance: rt.constraints?.join(', ') || '—',
      constraints: rt.constraints || [],
      orgRoom: rt._sourceRoom || orgRoom,
      provisioningEvents: inv?.events || [],
      unit: rt.unit,
      infinite: rt.infinite || false,
      replenishes: rt.replenishes || false,
      replenish_cycle: rt.replenish_cycle || null,
      _rt: rt,
      _relation: relation,
      _inv: inv
    };
  });
  const RES_COLS = [{
    key: 'name',
    label: 'Resource',
    fixed: true
  }, {
    key: 'category',
    label: 'Category'
  }, {
    key: 'supply',
    label: 'Supply'
  }, {
    key: 'holder',
    label: 'Source'
  }, {
    key: 'relation',
    label: 'Relation'
  }, {
    key: 'capacity',
    label: 'Capacity'
  }, {
    key: 'utilization',
    label: 'Utilization'
  }, {
    key: 'opacityLevel',
    label: 'Opacity'
  }, {
    key: 'unit',
    label: 'Unit'
  }];
  const RES_GROUPS = [{
    k: 'none',
    l: 'No grouping'
  }, {
    k: 'category',
    l: 'Category'
  }, {
    k: 'holder',
    l: 'Source'
  }, {
    k: 'relation',
    l: 'Relation'
  }, {
    k: 'opacityLevel',
    l: 'Opacity'
  }];
  const defaultVisCols = ['name', 'category', 'supply', 'holder', 'capacity', 'utilization', 'opacityLevel'];
  const getResVal = (row, key) => {
    if (key === 'capacity') return row.infinite ? 999999 : row.available;
    if (key === 'utilization') return row.utilizationPct;
    if (key === 'supply') return row.infinite ? 'infinite' : row.replenishes ? 'replenishes' : 'finite';
    return row[key] || '';
  };
  const renderResCell = (row, col) => {
    const k = col.key;
    if (k === 'name') return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        fontWeight: 600,
        fontSize: 13
      }
    }, row.name), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11,
        color: 'var(--tx-2)'
      }
    }, (row.type || '').replace(/_/g, ' ')));
    if (k === 'category') return /*#__PURE__*/React.createElement("span", {
      className: 'tag tag-' + (RESOURCE_CATEGORY_COLORS[row.category] || 'teal'),
      style: {
        fontSize: 10
      }
    }, RESOURCE_CATEGORY_LABELS[row.category] || row.category);
    if (k === 'holder') return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        fontWeight: 500
      }
    }, row.holder), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11,
        color: 'var(--tx-2)'
      }
    }, row.holderType));
    if (k === 'relation') return /*#__PURE__*/React.createElement("span", {
      className: "tag tag-gold",
      style: {
        fontSize: 10
      }
    }, row.relation);
    if (k === 'network') return /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13,
        color: 'var(--tx-1)'
      }
    }, row.network);
    if (k === 'supply') {
      const badges = [];
      if (row.infinite) badges.push(/*#__PURE__*/React.createElement("span", { key: "inf", className: "tag tag-teal", style: { fontSize: 10 } }, "\u221E Infinite"));
      if (row.replenishes) badges.push(/*#__PURE__*/React.createElement("span", { key: "rep", className: "tag tag-blue", style: { fontSize: 10 } }, "\u21BB ", row.replenish_cycle || 'auto'));
      if (!row.infinite && !row.replenishes) badges.push(/*#__PURE__*/React.createElement("span", { key: "fin", style: { fontSize: 11, color: 'var(--tx-2)' } }, "Finite"));
      return /*#__PURE__*/React.createElement("div", { style: { display: 'flex', gap: 4, flexWrap: 'wrap' } }, badges);
    }
    if (k === 'capacity') return row.infinite ? /*#__PURE__*/React.createElement("span", {
      style: {
        fontWeight: 600,
        fontSize: 13,
        color: 'var(--teal)'
      }
    }, "Unlimited") : /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontWeight: 600,
        color: 'var(--green)'
      }
    }, row.available), /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--tx-2)'
      }
    }, " / ", row.totalCapacity), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11,
        color: 'var(--tx-3)',
        marginLeft: 4
      }
    }, "avail"));
    if (k === 'utilization') return /*#__PURE__*/React.createElement(DtUtilBar, {
      pct: row.utilizationPct
    });
    if (k === 'opacityLevel') {
      const o = DT_OP_CFG[row.opacityLevel];
      return o ? /*#__PURE__*/React.createElement("span", {
        className: 'tag ' + o.cls,
        style: {
          fontSize: 10
        }
      }, o.l) : /*#__PURE__*/React.createElement("span", {
        style: {
          color: 'var(--tx-3)'
        }
      }, "\u2014");
    }
    if (k === 'unit') return /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12,
        color: 'var(--tx-1)',
        fontFamily: 'var(--mono)'
      }
    }, row.unit);
    return /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--tx-3)',
        fontSize: 12
      }
    }, "\u2014");
  };
  const selectedRes = selectedRow ? resources.find(r => r.id === selectedRow) : null;
  return /*#__PURE__*/React.createElement("div", {
    className: "anim-up"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 4
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", {
    style: {
      fontFamily: 'var(--serif)',
      fontSize: 22,
      fontWeight: 700
    }
  }, "Resources"), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--tx-1)',
      fontSize: 12.5,
      marginTop: 2
    }
  }, "Resource types, inventory tracking, and allocation history. Click a row for details."), /*#__PURE__*/React.createElement(StorageTransparencyBadge, {
    storageType: "matrix",
    roomId: orgRoom || rosterRoom,
    encrypted: true,
    encLabel: "Megolm E2EE",
    label: "Resources",
    extra: [{ label: 'Storage', value: 'Resource type definitions are stored as state events in the org/roster/network room. Inventory and allocations are tracked in org room state. Per-client allocations are mirrored in bridge rooms.' }, orgRoom ? { label: 'Org room', value: orgRoom } : null, networkRoom ? { label: 'Network room', value: networkRoom } : null].filter(Boolean)
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onRefresh,
    className: "b-gho b-sm",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 4
    }
  }, "Refresh"), (orgRoom || networkRoom || rosterRoom) && /*#__PURE__*/React.createElement("button", {
    onClick: onCreateResource,
    className: "b-pri b-sm",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 4
    }
  }, "New Resource Type"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))',
      gap: 10,
      marginBottom: 20
    }
  }, [{
    l: 'Visible Types',
    v: resources.length,
    c: 'teal'
  }, {
    l: 'With Inventory',
    v: resources.filter(r => r.totalCapacity > 0 || r.infinite).length,
    c: 'green'
  }, {
    l: 'Relations',
    v: resourceRelations.length,
    c: 'blue'
  }, {
    l: 'Categories',
    v: [...new Set(resources.map(r => r.category))].length,
    c: 'gold'
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
      display: 'block',
      marginTop: 2
    }
  }, s.v)))), resources.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      textAlign: 'center',
      padding: '40px 20px'
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      fontSize: 16,
      fontWeight: 700,
      marginBottom: 8
    }
  }, "No Resource Types Yet"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12.5,
      color: 'var(--tx-1)',
      lineHeight: 1.6,
      marginBottom: 16
    }
  }, "Resource types define the services and goods you can track and allocate."), (orgRoom || networkRoom || rosterRoom) && /*#__PURE__*/React.createElement("button", {
    onClick: onCreateResource,
    className: "b-pri"
  }, "Create Resource Type")) : /*#__PURE__*/React.createElement(DataTable, {
    data: resources,
    columns: RES_COLS,
    groupOptions: RES_GROUPS,
    defaultVisibleCols: defaultVisCols,
    onRowClick: row => {
      setSelectedRow(row.id);
      setPanelTab('details');
    },
    renderCell: renderResCell,
    getVal: getResVal,
    selectedId: selectedRow,
    label: "resources"
  }), selectedRes && /*#__PURE__*/React.createElement(ResourcePanel, {
    row: selectedRes,
    allocations: allAllocations || [],
    onClose: () => setSelectedRow(null),
    panelTab: panelTab,
    setPanelTab: setPanelTab,
    onAllocate: onAllocate,
    individuals: individuals,
    resourceTypes: resourceTypes,
    resourceRelations: resourceRelations,
    resourceInventory: resourceInventory,
    orgRoom: orgRoom,
    orgRole: orgRole,
    canAllocateResource: canAllocateResource,
    svc: svc
  }));
};

/* ═══════════════════ PROVIDER APP ═══════════════════ */
