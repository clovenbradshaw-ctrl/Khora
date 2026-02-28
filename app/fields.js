const WIKIDATA_SEARCH_LABELS = {
  'full_name': 'personal name',
  'dob': 'date of birth',
  'id_number': 'identity document',
  'email': 'email address',
  'phone': 'telephone number',
  'address': 'street address',
  'affiliation': 'organizational affiliation',
  'case_notes': 'case note',
  'documents': 'document',
  'history': 'case history',
  'restricted_notes': 'classified information'
};
async function fetchWikidataDefinition(fieldKey, label) {
  const searchTerm = WIKIDATA_SEARCH_LABELS[fieldKey] || label;
  if (_wikidataCache[searchTerm]) return _wikidataCache[searchTerm];
  try {
    const url = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(searchTerm)}&language=en&limit=1&format=json&origin=*`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('Wikidata search failed');
    const data = await resp.json();
    if (!data.search || data.search.length === 0) {
      _wikidataCache[searchTerm] = null;
      return null;
    }
    const entity = data.search[0];
    const entityId = entity.id;
    const detailUrl = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${entityId}&languages=en&props=descriptions|sitelinks&format=json&origin=*`;
    const detailResp = await fetch(detailUrl);
    if (!detailResp.ok) throw new Error('Wikidata entity fetch failed');
    const detailData = await detailResp.json();
    const ent = detailData.entities?.[entityId];
    const description = ent?.descriptions?.en?.value || entity.description || '';
    const wpTitle = ent?.sitelinks?.enwiki?.title || null;
    const result = {
      id: entityId,
      label: entity.label,
      description: description,
      wikidataUrl: `https://www.wikidata.org/wiki/${entityId}`,
      wikipediaUrl: wpTitle ? `https://en.wikipedia.org/wiki/${encodeURIComponent(wpTitle)}` : null
    };
    _wikidataCache[searchTerm] = result;
    return result;
  } catch (e) {
    console.debug('Wikidata fetch error:', e.message);
    _wikidataCache[searchTerm] = null;
    return null;
  }
}

/* ─── Fields that are self-explanatory — don't cite HUD authority ─── */
const SIMPLE_FIELD_KEYS = new Set(['full_name', 'email', 'phone', 'address', 'affiliation', 'case_notes', 'documents']);

/* ─── DefinitionPopup — slide-from-right panel for field definitions ─── */
const DefinitionPopup = ({ fieldDef, fieldDefs, fieldCrosswalks, onClose, onSaveCrosswalk, onSaveFieldDef, teams, svc, orgRoom, networkRoom, showToast, onEvolve, onMerge }) => {
  const [wikiData, setWikiData] = useState(null);
  const [wikiLoading, setWikiLoading] = useState(false);
  const [addCrosswalkFor, setAddCrosswalkFor] = useState(false);
  const [xwTargetUri, setXwTargetUri] = useState('');
  const [xwRelationship, setXwRelationship] = useState('equivalent');
  const [xwNotes, setXwNotes] = useState('');
  const [editingAuthority, setEditingAuthority] = useState(false);
  const [authDraft, setAuthDraft] = useState({ org: '', name: '', provision: '', uri: '' });
  const [authUriBrowserOpen, setAuthUriBrowserOpen] = useState(false);
  const d = fieldDef;
  if (!d) return null;

  // Reset authority draft when field changes
  React.useEffect(() => {
    setAuthDraft({
      org: d.authority?.org || '',
      name: d.authority?.name || '',
      provision: d.authority?.provision || '',
      uri: d.authority?.uri || ''
    });
    setEditingAuthority(false);
  }, [d.uri]);

  const saveAuthority = async () => {
    const hasValues = authDraft.org || authDraft.name;
    const newAuthority = hasValues ? { ...authDraft } : null;
    const updated = { ...d, authority: newAuthority };

    // Check if field is in use by any team schema
    const teamsUsing = (teams || []).filter(t => t.schema?.fields?.some(f => f.uri === d.uri));

    if (teamsUsing.length > 0 && (orgRoom || networkRoom)) {
      // Field is in use — create governance proposal
      const targetRoom = networkRoom || orgRoom;
      const proposal = {
        id: 'prop_auth_' + d.key + '_' + Date.now(),
        type: 'field_authority_change',
        summary: `Change authority on "${d.label}" field`,
        detail: newAuthority
          ? `Set authority to: ${newAuthority.org} — ${newAuthority.name}${newAuthority.provision ? ' (' + newAuthority.provision + ')' : ''}`
          : `Remove authority from "${d.label}"`,
        field_uri: d.uri,
        proposed_authority: newAuthority,
        previous_authority: d.authority || null,
        affected_teams: teamsUsing.map(t => ({ id: t.id, name: t.name })),
        proposed_by: svc?.userId,
        proposed_at: Date.now(),
        status: 'submitted',
        positions: {}
      };
      if (svc) await svc.setState(targetRoom, EVT.GOV_PROPOSAL, proposal, proposal.id);
      if (showToast) showToast(`Governance proposal created — ${teamsUsing.length} team(s) use this field`);
      setEditingAuthority(false);
    } else {
      // Field not in use — apply directly
      if (onSaveFieldDef) await onSaveFieldDef(updated);
      if (showToast) showToast('Authority updated');
      setEditingAuthority(false);
    }
  };

  const isSimple = SIMPLE_FIELD_KEYS.has(d.key);
  const getSource = uri => {
    if (uri?.startsWith('khora:vault/')) return { label: 'Vault', color: 'gold' };
    if (uri?.startsWith('khora:team/')) return { label: 'Team', color: 'purple' };
    if (uri?.startsWith('khora:org/')) return { label: 'Org', color: 'blue' };
    return { label: 'External', color: 'teal' };
  };
  const src = getSource(d.uri);
  const getCrosswalksForUri = uri => (fieldCrosswalks || []).filter(xw => xw.from_uri === uri || (xw.bidirectional && xw.to_uri === uri));
  const xws = getCrosswalksForUri(d.uri);

  // Fetch Wikidata definition on mount
  React.useEffect(() => {
    let cancelled = false;
    setWikiLoading(true);
    setWikiData(null);
    fetchWikidataDefinition(d.key, d.label).then(result => {
      if (!cancelled) {
        setWikiData(result);
        setWikiLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [d.uri, d.key]);

  return React.createElement(React.Fragment, null,
    React.createElement('div', { className: 'def-popup-overlay', onClick: onClose }),
    React.createElement('div', { className: 'def-popup' },
      /* Header */
      React.createElement('div', { className: 'def-popup-head' },
        React.createElement('div', null,
          React.createElement('h3', null, d.label),
          React.createElement('div', { style: { fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--tx-3)', marginTop: 3 } }, d.uri),
          React.createElement('div', { style: { display: 'flex', gap: 4, marginTop: 8 } },
            React.createElement('span', { className: `tag tag-${src.color}`, style: { fontSize: 9 } }, src.label),
            React.createElement('span', { className: 'tag tag-blue', style: { fontSize: 9 } }, (d.data_type || 'text').toUpperCase()),
            d.sensitive && React.createElement('span', { className: 'tag tag-red', style: { fontSize: 9 } },
              React.createElement(I, { n: 'lock', s: 8 }), 'Sensitive')
          )
        ),
        React.createElement('div', { style: { display: 'flex', gap: 4, marginLeft: 'auto', marginRight: 8 } },
          onEvolve && React.createElement('button', { className: 'b-gho b-xs', onClick: () => onEvolve(d), style: { display: 'flex', alignItems: 'center', gap: 3, fontSize: 10 } },
            React.createElement(I, { n: 'layers', s: 10 }), 'Evolve'),
          onMerge && React.createElement('button', { className: 'b-gho b-xs', onClick: () => onMerge(d), style: { display: 'flex', alignItems: 'center', gap: 3, fontSize: 10 } },
            React.createElement(I, { n: 'grid', s: 10 }), 'Merge with...')
        ),
        React.createElement('button', { className: 'def-popup-close', onClick: onClose }, '\u2715')
      ),
      // Version badge
      (d.version && d.version > 1) && React.createElement('div', { style: { padding: '6px 18px', borderBottom: '1px solid var(--border-0)', display: 'flex', gap: 6, alignItems: 'center' } },
        React.createElement('span', { className: 'cf-migrate-badge current' }, 'v', d.version),
        (d.version_history || []).length > 0 && React.createElement('span', { style: { fontSize: 10, color: 'var(--tx-3)' } }, d.version_history.length, ' previous version(s)'),
        d.superseded_by && React.createElement('span', { className: 'cf-migrate-badge outdated' }, 'Superseded')
      ),
      /* Body */
      React.createElement('div', { className: 'def-popup-body' },
        /* Wikidata section */
        React.createElement('div', { className: 'def-popup-section' },
          React.createElement('span', { className: 'def-popup-section-label' }, 'Wikidata'),
          wikiLoading
            ? React.createElement('div', { className: 'def-popup-loading' }, 'Looking up on Wikidata\u2026')
            : wikiData
              ? React.createElement('div', { className: 'def-popup-wiki' },
                  React.createElement('div', { className: 'def-popup-wiki-label' },
                    React.createElement('span', { style: { fontSize: 13 } }, '\u{1F310}'),
                    wikiData.label, ' (', wikiData.id, ')'
                  ),
                  React.createElement('div', { className: 'def-popup-wiki-desc' }, wikiData.description),
                  React.createElement('div', { style: { display: 'flex', gap: 10 } },
                    React.createElement('a', { className: 'def-popup-wiki-link', href: wikiData.wikidataUrl, target: '_blank', rel: 'noopener' }, 'Wikidata \u2197'),
                    wikiData.wikipediaUrl && React.createElement('a', { className: 'def-popup-wiki-link', href: wikiData.wikipediaUrl, target: '_blank', rel: 'noopener' }, 'Wikipedia \u2197')
                  )
                )
              : React.createElement('div', { style: { fontSize: 11.5, color: 'var(--tx-3)', padding: '8px 0' } }, 'No Wikidata entry found.')
        ),
        /* Definition */
        React.createElement('div', { className: 'def-popup-section' },
          React.createElement('span', { className: 'def-popup-section-label' }, 'Definition'),
          React.createElement('p', { style: { fontSize: 12.5, lineHeight: 1.6, color: 'var(--tx-1)' } },
            d.definition || 'No definition provided.')
        ),
        /* Scope */
        d.scope && React.createElement('div', { className: 'def-popup-section' },
          React.createElement('span', { className: 'def-popup-section-label' }, 'Scope'),
          React.createElement('p', { style: { fontSize: 12, lineHeight: 1.5, color: 'var(--tx-2)' } }, d.scope)
        ),
        /* Authority — editable */
        React.createElement('div', { className: 'def-popup-section' },
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
            React.createElement('span', { className: 'def-popup-section-label' }, 'Authority'),
            !editingAuthority && React.createElement('button', {
              className: 'b-gho b-xs',
              onClick: () => setEditingAuthority(true),
              style: { display: 'flex', alignItems: 'center', gap: 3 }
            }, React.createElement(I, { n: 'pencil', s: 10 }), d.authority ? 'Edit' : 'Add')
          ),
          !editingAuthority && d.authority && React.createElement('div',
            { style: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 } },
            React.createElement('span', { className: 'tag tag-teal', style: { fontSize: 9 } }, d.authority.org || 'External'),
            React.createElement('span', { style: { fontSize: 11.5, color: 'var(--tx-1)' } }, d.authority.name),
            d.authority.provision && React.createElement('span', { style: { fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--tx-2)' } }, d.authority.provision)
          ),
          !editingAuthority && !d.authority && React.createElement('div',
            { style: { fontSize: 11, color: 'var(--tx-3)', marginTop: 4 } }, 'No authority set'),
          editingAuthority && React.createElement('div', { style: { marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 } },
            React.createElement('input', { placeholder: 'Organization (e.g. HUD)', value: authDraft.org,
              onChange: e => setAuthDraft({...authDraft, org: e.target.value}),
              style: { fontSize: 12, padding: '4px 8px', border: '1px solid var(--border-0)', borderRadius: 'var(--r)', background: 'var(--bg-2)', color: 'var(--tx-0)' } }),
            React.createElement('input', { placeholder: 'Standard name (e.g. HMIS Data Standards)', value: authDraft.name,
              onChange: e => setAuthDraft({...authDraft, name: e.target.value}),
              style: { fontSize: 12, padding: '4px 8px', border: '1px solid var(--border-0)', borderRadius: 'var(--r)', background: 'var(--bg-2)', color: 'var(--tx-0)' } }),
            React.createElement('input', { placeholder: 'Provision (e.g. Element 3.01)', value: authDraft.provision,
              onChange: e => setAuthDraft({...authDraft, provision: e.target.value}),
              style: { fontSize: 12, padding: '4px 8px', border: '1px solid var(--border-0)', borderRadius: 'var(--r)', background: 'var(--bg-2)', color: 'var(--tx-0)' } }),
            React.createElement('div', { style: { display: 'flex', gap: 4, alignItems: 'center' } },
              React.createElement('input', { placeholder: 'Reference URI', value: authDraft.uri,
                onChange: e => setAuthDraft({...authDraft, uri: e.target.value}),
                style: { flex: 1, fontSize: 12, padding: '4px 8px', border: '1px solid var(--border-0)', borderRadius: 'var(--r)', background: 'var(--bg-2)', color: 'var(--tx-0)' } }),
              React.createElement('button', { className: 'b-gho b-xs', onClick: () => setAuthUriBrowserOpen(true),
                title: 'Search URI libraries',
                style: { display: 'flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap', flexShrink: 0 } },
                React.createElement(I, { n: 'search', s: 10 }), 'Search')
            ),
            React.createElement(UriLibraryBrowser, {
              open: authUriBrowserOpen,
              onClose: () => setAuthUriBrowserOpen(false),
              mode: 'select',
              onSelect: entry => {
                setAuthDraft(prev => ({
                  ...prev,
                  uri: entry.uri || prev.uri,
                  org: prev.org || entry.source_library || '',
                  name: prev.name || entry.label || ''
                }));
                setAuthUriBrowserOpen(false);
              }
            }),
            ((teams || []).filter(t => t.schema?.fields?.some(f => f.uri === d.uri)).length > 0) &&
              React.createElement('div', { style: { fontSize: 10, color: 'var(--orange)', padding: '6px 8px', background: 'var(--bg-1)', borderRadius: 'var(--r)', border: '1px solid var(--orange)', opacity: 0.9 } },
                '\u26A0 This field is used by ', (teams || []).filter(t => t.schema?.fields?.some(f => f.uri === d.uri)).length, ' team(s). Saving will create a governance proposal instead of applying directly.'
              ),
            React.createElement('div', { style: { display: 'flex', gap: 6, marginTop: 4 } },
              React.createElement('button', { className: 'b-pri b-xs', onClick: saveAuthority }, 'Save'),
              d.authority && React.createElement('button', { className: 'b-gho b-xs', onClick: () => { setAuthDraft({ org: '', name: '', provision: '', uri: '' }); } }, 'Clear'),
              React.createElement('button', { className: 'b-gho b-xs', onClick: () => setEditingAuthority(false) }, 'Cancel')
            )
          )
        ),
        /* Crosswalks */
        React.createElement('div', { className: 'def-popup-section' },
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
            React.createElement('span', { className: 'def-popup-section-label' }, 'Also Known As'),
            React.createElement('button', { className: 'b-gho b-xs', onClick: () => setAddCrosswalkFor(!addCrosswalkFor),
              style: { display: 'flex', alignItems: 'center', gap: 3 } },
              React.createElement(I, { n: 'plus', s: 10 }), 'Link')
          ),
          xws.length === 0 && !addCrosswalkFor
            ? React.createElement('p', { style: { fontSize: 11, color: 'var(--tx-3)', marginTop: 4 } },
                'No crosswalks. Link this field to equivalent definitions in other contexts.')
            : React.createElement('div', { style: { marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 } },
                xws.map(xw => {
                  const rel = CROSSWALK_TYPES[xw.relationship] || CROSSWALK_TYPES.related;
                  const targetUri = xw.from_uri === d.uri ? xw.to_uri : xw.from_uri;
                  const targetDef = fieldDefs[targetUri];
                  return React.createElement('div', { key: xw.id, style: { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--bg-2)', borderRadius: 'var(--r)', border: '1px solid var(--border-0)' } },
                    React.createElement('span', { style: { fontWeight: 700, color: `var(--${rel.color})`, fontSize: 14 }, title: rel.desc }, rel.symbol),
                    React.createElement('div', { style: { flex: 1 } },
                      React.createElement('span', { style: { fontSize: 12, fontWeight: 600 } }, targetDef?.label || targetUri),
                      targetDef?.definition && React.createElement('div', { style: { fontSize: 10.5, color: 'var(--tx-2)', marginTop: 1 } },
                        targetDef.definition.slice(0, 80), targetDef.definition.length > 80 ? '...' : '')
                    ),
                    React.createElement('span', { className: `tag tag-${rel.color}`, style: { fontSize: 8 } }, rel.label)
                  );
                })
              ),
          /* Add crosswalk form */
          addCrosswalkFor && React.createElement('div', { style: { marginTop: 8, padding: '10px 12px', background: 'var(--bg-2)', border: '1px solid var(--border-1)', borderRadius: 'var(--r)' } },
            React.createElement('div', { style: { fontSize: 11, fontWeight: 600, marginBottom: 6 } }, 'Link to field:'),
            React.createElement('div', { style: { display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'flex-end' } },
              React.createElement('select', { value: xwTargetUri, onChange: e => setXwTargetUri(e.target.value), style: { flex: 1, minWidth: 140, fontSize: 11, padding: '5px 8px' } },
                React.createElement('option', { value: '' }, '-- select --'),
                Object.values(fieldDefs).filter(fd => fd.uri !== d.uri).map(fd =>
                  React.createElement('option', { key: fd.uri, value: fd.uri }, fd.label, ' (', fd.uri, ')')
                )
              ),
              React.createElement('select', { value: xwRelationship, onChange: e => setXwRelationship(e.target.value), style: { fontSize: 11, padding: '5px 8px', minWidth: 100 } },
                Object.values(CROSSWALK_TYPES).map(ct =>
                  React.createElement('option', { key: ct.id, value: ct.id }, ct.symbol, ' ', ct.label)
                )
              ),
              React.createElement('input', { type: 'text', value: xwNotes, onChange: e => setXwNotes(e.target.value), placeholder: 'Notes...', style: { fontSize: 11, padding: '5px 8px', minWidth: 100, flex: 1 } }),
              React.createElement('button', { className: 'b-pri b-xs', disabled: !xwTargetUri, onClick: () => {
                if (onSaveCrosswalk && xwTargetUri) {
                  onSaveCrosswalk({ id: 'xw_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), from_uri: d.uri, to_uri: xwTargetUri, relationship: xwRelationship, bidirectional: xwRelationship === 'equivalent' || xwRelationship === 'related', notes: xwNotes || '', created_at: Date.now() });
                  setXwTargetUri(''); setXwNotes(''); setAddCrosswalkFor(false);
                }
              }}, 'Save'),
              React.createElement('button', { className: 'b-gho b-xs', onClick: () => { setAddCrosswalkFor(false); setXwTargetUri(''); setXwNotes(''); }}, 'Cancel')
            )
          )
        )
      )
    )
  );
};

/* ─── FieldDictionaryView — global data dictionary for all field definitions ─── */
const FieldDictionaryView = ({
  fieldDefs,
  fieldCrosswalks,
  teams,
  onSaveFieldDef,
  onSaveCrosswalk,
  svc,
  orgRoom,
  networkRoom,
  showToast,
  fieldGovernanceConfig,
  onPropose
}) => {
  const [expandedUri, setExpandedUri] = useState(null);
  const [crosswalkPopover, setCrosswalkPopover] = useState(null);
  const [potentialCrosswalks, setPotentialCrosswalks] = useState([]);
  const [scanningCrosswalks, setScanningCrosswalks] = useState(false);
  const [createFieldOpen, setCreateFieldOpen] = useState(false);
  const [mergeFieldsOpen, setMergeFieldsOpen] = useState(false);
  const [mergeSelection, setMergeSelection] = useState([]);
  const [evolveFieldOpen, setEvolveFieldOpen] = useState(false);
  const [evolveTarget, setEvolveTarget] = useState(null);
  const scanDone = React.useRef(false);

  // Background scan for potential crosswalks (runs once when tab opens)
  React.useEffect(() => {
    if (scanDone.current || Object.keys(fieldDefs || {}).length < 2) return;
    scanDone.current = true;
    (async () => {
      try {
        setScanningCrosswalks(true);
        const existingPairs = new Set((fieldCrosswalks || []).map(xw => `${xw.from_uri}|${xw.to_uri}`));
        const defs = Object.values(fieldDefs || {});
        const potentials = [];
        for (let i = 0; i < defs.length && potentials.length < 5; i++) {
          const di = defs[i];
          const textI = `${di.label}. ${di.definition || ''}`;
          const embI = await getFieldEmbedding(textI);
          if (!embI) {
            setScanningCrosswalks(false);
            return;
          }
          for (let j = i + 1; j < defs.length; j++) {
            const dj = defs[j];
            if (existingPairs.has(`${di.uri}|${dj.uri}`) || existingPairs.has(`${dj.uri}|${di.uri}`)) continue;
            const textJ = `${dj.label}. ${dj.definition || ''}`;
            const embJ = await getFieldEmbedding(textJ);
            if (!embJ) continue;
            const sim = cosineSim(embI, embJ);
            if (sim > 0.85) potentials.push({
              from: di,
              to: dj,
              similarity: sim
            });
          }
        }
        setPotentialCrosswalks(potentials);
        setScanningCrosswalks(false);
      } catch {
        setScanningCrosswalks(false);
      }
    })();
  }, [fieldDefs, fieldCrosswalks]);
  const getCrosswalksForUri = uri => (fieldCrosswalks || []).filter(xw => xw.from_uri === uri || xw.bidirectional && xw.to_uri === uri);
  const getTeamsUsing = uri => (teams || []).filter(t => t.schema?.fields?.some(f => f.uri === uri));
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
  const defs = Object.values(fieldDefs || {});
  const DEF_COLS = [{
    key: 'label',
    label: 'Field',
    fixed: true
  }, {
    key: 'key',
    label: 'Key'
  }, {
    key: 'category',
    label: 'Category'
  }, {
    key: 'definition',
    label: 'Definition'
  }, {
    key: 'data_type',
    label: 'Type'
  }, {
    key: 'source',
    label: 'Source'
  }, {
    key: 'authority_name',
    label: 'Authority'
  }, {
    key: 'crosswalks',
    label: 'Also Known As'
  }, {
    key: 'version',
    label: 'v'
  }, {
    key: 'sensitive',
    label: ''
  }];
  const defRows = defs.map(d => ({
    ...d,
    source: getSource(d.uri)?.label || 'Unknown',
    authority_name: d.authority?.name || '',
    crosswalks: getCrosswalksForUri(d.uri).length
  }));
  const getDefVal = (row, key) => {
    if (key === 'sensitive') return row.sensitive ? 'Yes' : 'No';
    return row[key] || '';
  };
  const renderDefCell = (row, col) => {
    if (col.key === 'label') return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
      style: {
        fontWeight: 600
      }
    }, row.label), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 9,
        fontFamily: 'var(--mono)',
        color: 'var(--tx-3)',
        marginTop: 2
      }
    }, row.uri));
    if (col.key === 'key') return /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--mono)',
        fontSize: 11
      }
    }, row.key);
    if (col.key === 'category') {
      const cl = CAT_LABELS[row.category] || row.category;
      const cc = CAT_COLORS[row.category] || 'blue';
      return /*#__PURE__*/React.createElement("span", {
        className: `tag tag-${cc}`,
        style: {
          fontSize: 9
        }
      }, cl);
    }
    if (col.key === 'definition') return /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11.5,
        lineHeight: 1.5,
        color: 'var(--tx-1)',
        maxWidth: 300
      }
    }, (row.definition || '').length > 120 ? (row.definition || '').slice(0, 120) + '...' : row.definition || '');
    if (col.key === 'data_type') return /*#__PURE__*/React.createElement("span", {
      className: "tag tag-blue",
      style: {
        fontSize: 8
      }
    }, (row.data_type || 'text').toUpperCase());
    if (col.key === 'source') {
      const src = getSource(row.uri);
      return /*#__PURE__*/React.createElement("span", {
        className: `tag tag-${src.color}`,
        style: {
          fontSize: 8
        }
      }, src.label);
    }
    if (col.key === 'authority_name') return row.authority && !SIMPLE_FIELD_KEYS.has(row.key) ? /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 10.5,
        color: 'var(--teal)'
      },
      title: row.authority.uri
    }, row.authority.org ? /*#__PURE__*/React.createElement("strong", null, row.authority.org) : '', " ", row.authority.provision || '') : /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--tx-3)',
        fontSize: 10
      }
    }, SIMPLE_FIELD_KEYS.has(row.key) ? 'Wikidata' : '\u2014');
    if (col.key === 'crosswalks') {
      const xws = getCrosswalksForUri(row.uri);
      if (xws.length === 0) return /*#__PURE__*/React.createElement("span", {
        style: {
          color: 'var(--tx-3)',
          fontSize: 10
        }
      }, "\u2014");
      return /*#__PURE__*/React.createElement("div", {
        style: {
          display: 'flex',
          gap: 3,
          flexWrap: 'wrap'
        }
      }, xws.slice(0, 3).map(xw => {
        const rel = CROSSWALK_TYPES[xw.relationship] || CROSSWALK_TYPES.related;
        const targetUri = xw.from_uri === row.uri ? xw.to_uri : xw.from_uri;
        const targetDef = fieldDefs[targetUri];
        return /*#__PURE__*/React.createElement("span", {
          key: xw.id,
          className: `tag tag-${rel.color}`,
          style: {
            fontSize: 8,
            cursor: 'pointer'
          },
          onClick: e => {
            e.stopPropagation();
            setCrosswalkPopover({
              uri: row.uri,
              xws
            });
          }
        }, rel.symbol, " ", targetDef?.label || targetUri.split('/').pop());
      }), xws.length > 3 && /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 9,
          color: 'var(--tx-3)'
        }
      }, "+", xws.length - 3));
    }
    if (col.key === 'version') return /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--mono)',
        fontSize: 10,
        color: 'var(--tx-2)'
      }
    }, "v", row.version || 1);
    if (col.key === 'sensitive') return row.sensitive ? /*#__PURE__*/React.createElement(I, {
      n: "lock",
      s: 11,
      c: "var(--red)"
    }) : null;
    if (col.key === 'definition') {
      if (!row.definition) return React.createElement('span', { className: 'tag tag-orange', style: { fontSize: 9 } }, '\u26A0 Missing definition');
    }
    return row[col.key] || '';
  };

  const govRequired = !!(fieldGovernanceConfig?.governance_required);

  return /*#__PURE__*/React.createElement("div", null,
    // ── Toolbar: New Field + Merge ──
    React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 } },
      React.createElement('button', { className: 'b-pri b-xs', onClick: () => setCreateFieldOpen(true), style: { display: 'flex', alignItems: 'center', gap: 4 } },
        React.createElement(I, { n: 'plus', s: 11 }), 'New Field'),
      mergeSelection.length >= 2 && React.createElement('button', { className: 'b-gho b-xs', onClick: () => {
        setMergeFieldsOpen(true);
      }, style: { display: 'flex', alignItems: 'center', gap: 4, color: 'var(--teal)' } },
        React.createElement(I, { n: 'grid', s: 11 }), 'Merge ', mergeSelection.length, ' Fields'),
      mergeSelection.length > 0 && React.createElement('button', { className: 'b-gho b-xs', onClick: () => setMergeSelection([]),
        style: { fontSize: 10, color: 'var(--tx-3)' } }, 'Clear selection'),
      React.createElement('div', { style: { flex: 1 } }),
      React.createElement('span', { style: { fontSize: 10, color: 'var(--tx-3)', fontFamily: 'var(--mono)' } }, defs.length, ' fields'),
      govRequired && React.createElement('span', { className: 'tag tag-orange', style: { fontSize: 8, marginLeft: 4 } },
        React.createElement(I, { n: 'shieldCheck', s: 8 }), ' Governance')
    ),
    // ── Potential crosswalks banner ──
    potentialCrosswalks.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '10px 14px',
      background: 'var(--teal-dim)',
      border: '1px solid rgba(61,214,140,.15)',
      borderRadius: 'var(--r)',
      marginBottom: 12,
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "grid",
    s: 14,
    c: "var(--teal)"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      fontWeight: 600,
      color: 'var(--teal)'
    }
  }, potentialCrosswalks.length, " potential crosswalk", potentialCrosswalks.length !== 1 ? 's' : '', " detected"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: 'var(--tx-2)',
      marginLeft: 8
    }
  }, "Fields that may refer to the same concept.")),
    React.createElement("button", {
    className: "b-gho b-xs", style: { color: 'var(--teal)' },
    onClick: () => {
      // Pre-select fields for merge
      const fields = potentialCrosswalks.slice(0, 3).flatMap(pc => [pc.from, pc.to]);
      const unique = [...new Map(fields.map(f => [f.uri, f])).values()];
      setMergeSelection(unique);
      setMergeFieldsOpen(true);
    }
  }, "Review & Merge")), /*#__PURE__*/React.createElement(DataTable, {
    data: defRows,
    columns: DEF_COLS,
    defaultVisibleCols: ['label', 'category', 'definition', 'source', 'authority_name', 'crosswalks', 'sensitive'],
    groupOptions: [{
      key: 'category',
      label: 'Category'
    }, {
      key: 'source',
      label: 'Source'
    }],
    getVal: getDefVal,
    renderCell: renderDefCell,
    label: "field definitions",
    selectable: true,
    onRowClick: row => setExpandedUri(expandedUri === row.uri ? null : row.uri),
    selectedId: expandedUri,
    bulkActions: [{ id: 'merge', label: 'Merge', cls: 'b-gho b-xs', icon: 'grid' }, { id: 'evolve', label: 'Evolve', cls: 'b-gho b-xs', icon: 'layers' }],
    onBulkAction: (action, selectedRows) => {
      if (action === 'merge' && selectedRows.length >= 2) {
        setMergeSelection(selectedRows.map(r => fieldDefs[r.uri]).filter(Boolean));
        setMergeFieldsOpen(true);
      } else if (action === 'evolve' && selectedRows.length === 1) {
        setEvolveTarget(fieldDefs[selectedRows[0].uri]);
        setEvolveFieldOpen(true);
      }
    }
  }), expandedUri && fieldDefs[expandedUri] && React.createElement(DefinitionPopup, {
    fieldDef: fieldDefs[expandedUri],
    fieldDefs: fieldDefs,
    fieldCrosswalks: fieldCrosswalks,
    onClose: () => setExpandedUri(null),
    onSaveCrosswalk: onSaveCrosswalk,
    onSaveFieldDef: onSaveFieldDef,
    teams: teams,
    svc: svc,
    orgRoom: orgRoom,
    networkRoom: networkRoom,
    showToast: showToast,
    onEvolve: fd => { setEvolveTarget(fd); setEvolveFieldOpen(true); setExpandedUri(null); },
    onMerge: fd => { setMergeSelection([fd]); setExpandedUri(null); }
  }),
    // ── Modals ──
    React.createElement(CreateFieldModal, {
      open: createFieldOpen,
      onClose: () => setCreateFieldOpen(false),
      onSave: onSaveFieldDef,
      onPropose: onPropose || (async (proposal, room) => { if (svc) await svc.setState(room, EVT.GOV_PROPOSAL, proposal, proposal.id); }),
      fieldDefs: fieldDefs,
      categories: FIELD_CATEGORIES,
      catLabels: CAT_LABELS,
      namespace: networkRoom ? 'network' : orgRoom ? 'org' : 'local',
      governanceRequired: govRequired,
      svc: svc,
      orgRoom: orgRoom,
      networkRoom: networkRoom,
      showToast: showToast
    }),
    React.createElement(MergeFieldsModal, {
      open: mergeFieldsOpen,
      onClose: () => { setMergeFieldsOpen(false); setMergeSelection([]); },
      fieldsToMerge: mergeSelection,
      fieldDefs: fieldDefs,
      onSaveFieldDef: onSaveFieldDef,
      onSaveCrosswalk: onSaveCrosswalk,
      governanceRequired: govRequired,
      svc: svc,
      orgRoom: orgRoom,
      networkRoom: networkRoom,
      showToast: showToast
    }),
    React.createElement(EvolveFieldModal, {
      open: evolveFieldOpen,
      onClose: () => { setEvolveFieldOpen(false); setEvolveTarget(null); },
      fieldDef: evolveTarget,
      onSaveFieldDef: onSaveFieldDef,
      governanceRequired: govRequired,
      svc: svc,
      orgRoom: orgRoom,
      networkRoom: networkRoom,
      showToast: showToast
    })
  );
};

/* ─── CreateFieldModal — create a new field definition with required definition ─── */
const FIELD_DATA_TYPES = [
  { v: 'text', l: 'Text' }, { v: 'text_long', l: 'Long Text' }, { v: 'date', l: 'Date' },
  { v: 'email', l: 'Email' }, { v: 'phone', l: 'Phone' }, { v: 'address', l: 'Address' },
  { v: 'number', l: 'Number' }, { v: 'single_select', l: 'Single Select' },
  { v: 'multi_select', l: 'Multi Select' }, { v: 'boolean', l: 'Yes / No' }, { v: 'document', l: 'Document' }
];
const fieldLabelToKey = label => label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 48) || 'unnamed_field';

const CreateFieldModal = ({ open, onClose, onSave, onPropose, fieldDefs, categories, catLabels, namespace, governanceRequired, svc, orgRoom, networkRoom, showToast }) => {
  const [label, setLabel] = useState('');
  const [key, setKey] = useState('');
  const [keyEdited, setKeyEdited] = useState(false);
  const [category, setCategory] = useState('details');
  const [dataType, setDataType] = useState('text');
  const [definition, setDefinition] = useState('');
  const [scope, setScope] = useState('');
  const [sensitive, setSensitive] = useState(false);
  const [authOrg, setAuthOrg] = useState('');
  const [authName, setAuthName] = useState('');
  const [authProvision, setAuthProvision] = useState('');
  const [authUri, setAuthUri] = useState('');
  const [showAuth, setShowAuth] = useState(false);
  const [authUriBrowserOpen, setAuthUriBrowserOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState(null);

  if (!open) return null;

  const ns = namespace || 'org';
  const uri = `khora:${ns}/${key || fieldLabelToKey(label)}`;
  const computedKey = key || fieldLabelToKey(label);
  const defLen = definition.length;
  const isValid = label.trim().length > 0 && computedKey.length > 0 && defLen >= 20 && dataType;

  // Check for duplicate URIs / keys
  React.useEffect(() => {
    if (!computedKey || !fieldDefs) { setDuplicateWarning(null); return; }
    const existing = Object.values(fieldDefs).find(d => d.key === computedKey || d.uri === uri);
    setDuplicateWarning(existing ? `A field with key "${computedKey}" already exists (${existing.label})` : null);
  }, [computedKey, uri, fieldDefs]);

  const handleSave = async () => {
    if (!isValid || duplicateWarning) return;
    setSaving(true);
    const authority = (authOrg || authName) ? { org: authOrg, name: authName, provision: authProvision, uri: authUri } : null;
    const def = {
      uri,
      key: computedKey,
      label: label.trim(),
      category,
      data_type: dataType,
      definition: definition.trim(),
      scope: scope.trim() || null,
      sensitive,
      authority,
      version: 1,
      version_history: [],
      migration_rules: [],
      supersedes: null,
      superseded_by: null,
      created_by: svc?.userId || 'unknown',
      created_at: Date.now()
    };
    try {
      if (governanceRequired && (orgRoom || networkRoom)) {
        // Create governance proposal instead of saving directly
        const targetRoom = networkRoom || orgRoom;
        const proposal = {
          id: 'prop_field_' + computedKey + '_' + Date.now(),
          type: 'new_field_definition',
          summary: `Create new field: "${label.trim()}"`,
          detail: `New ${dataType} field in ${(catLabels || {})[category] || category} category. Definition: ${definition.trim().slice(0, 100)}${defLen > 100 ? '...' : ''}`,
          field_definition: def,
          proposed_by: svc?.userId,
          proposed_at: Date.now(),
          status: 'submitted',
          positions: {}
        };
        if (onPropose) await onPropose(proposal, targetRoom);
        if (showToast) showToast('Governance proposal created for new field');
      } else {
        if (onSave) await onSave(def);
        if (showToast) showToast(`Field "${label.trim()}" created`);
      }
      onClose();
    } catch (e) {
      console.error('CreateField error:', e);
      if (showToast) showToast('Error creating field: ' + e.message);
    }
    setSaving(false);
  };

  return React.createElement('div', { className: 'cf-overlay', onClick: e => { if (e.target === e.currentTarget) onClose(); } },
    React.createElement('div', { className: 'cf-modal' },
      React.createElement('div', { className: 'cf-header' },
        React.createElement('h3', null, 'Create Field Definition'),
        React.createElement('button', { className: 'b-gho b-xs', onClick: onClose, style: { fontSize: 16, lineHeight: 1, padding: '2px 8px' } }, '\u2715')
      ),
      React.createElement('div', { className: 'cf-body' },
        // Label & Key
        React.createElement('div', { className: 'cf-row-pair' },
          React.createElement('div', { className: 'cf-row' },
            React.createElement('label', { className: 'cf-label' }, 'Field Label', React.createElement('span', { className: 'required' }, '*')),
            React.createElement('input', { value: label, onChange: e => { setLabel(e.target.value); if (!keyEdited) setKey(fieldLabelToKey(e.target.value)); },
              placeholder: 'e.g. Housing Status', style: { fontSize: 13 } })
          ),
          React.createElement('div', { className: 'cf-row' },
            React.createElement('label', { className: 'cf-label' }, 'Key'),
            React.createElement('input', { value: key || fieldLabelToKey(label), onChange: e => { setKey(e.target.value); setKeyEdited(true); },
              style: { fontSize: 12, fontFamily: 'var(--mono)' } })
          )
        ),
        // Category & Type
        React.createElement('div', { className: 'cf-row-pair' },
          React.createElement('div', { className: 'cf-row' },
            React.createElement('label', { className: 'cf-label' }, 'Category', React.createElement('span', { className: 'required' }, '*')),
            React.createElement('select', { value: category, onChange: e => setCategory(e.target.value), style: { fontSize: 13 } },
              (categories || ['identity', 'contact', 'details', 'case', 'sensitive']).map(c =>
                React.createElement('option', { key: c, value: c }, (catLabels || {})[c] || c)
              )
            )
          ),
          React.createElement('div', { className: 'cf-row' },
            React.createElement('label', { className: 'cf-label' }, 'Data Type', React.createElement('span', { className: 'required' }, '*')),
            React.createElement('select', { value: dataType, onChange: e => setDataType(e.target.value), style: { fontSize: 13 } },
              FIELD_DATA_TYPES.map(t => React.createElement('option', { key: t.v, value: t.v }, t.l))
            )
          )
        ),
        // Definition (required)
        React.createElement('div', { className: 'cf-row' },
          React.createElement('label', { className: 'cf-label' }, 'Definition', React.createElement('span', { className: 'required' }, '*')),
          React.createElement('textarea', { value: definition, onChange: e => setDefinition(e.target.value),
            placeholder: 'Describe what this field means and how it should be interpreted (min 20 characters)...',
            style: { fontSize: 13, minHeight: 72 } }),
          React.createElement('div', { className: `cf-char-count ${defLen < 20 ? 'warn' : 'ok'}` }, defLen, '/20 min')
        ),
        // Scope
        React.createElement('div', { className: 'cf-row' },
          React.createElement('label', { className: 'cf-label' }, 'Scope', React.createElement('span', { style: { fontSize: 9, color: 'var(--tx-3)', marginLeft: 4 } }, 'recommended')),
          React.createElement('textarea', { value: scope, onChange: e => setScope(e.target.value),
            placeholder: "What's included vs excluded in this field...", style: { fontSize: 13, minHeight: 48 } })
        ),
        // Sensitive toggle
        React.createElement('div', { className: 'cf-row' },
          React.createElement('div', { className: 'cf-toggle', onClick: () => setSensitive(!sensitive) },
            React.createElement('div', { className: `cf-toggle-track${sensitive ? ' on' : ''}` },
              React.createElement('div', { className: 'cf-toggle-knob' })
            ),
            React.createElement('span', { style: { fontSize: 12, color: sensitive ? 'var(--red)' : 'var(--tx-2)' } },
              sensitive ? 'Sensitive — requires elevated access' : 'Not sensitive')
          )
        ),
        // Authority (collapsible)
        React.createElement('div', { className: 'cf-row' },
          React.createElement('button', { className: 'b-gho b-xs', onClick: () => setShowAuth(!showAuth),
            style: { display: 'flex', alignItems: 'center', gap: 4, alignSelf: 'flex-start' } },
            React.createElement(I, { n: showAuth ? 'chevronDown' : 'chevronRight', s: 10 }), 'Authority ', showAuth ? '(hide)' : '(optional)')
        ),
        showAuth && React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 6, padding: '0 0 0 8px', borderLeft: '2px solid var(--border-1)' } },
          React.createElement('input', { value: authOrg, onChange: e => setAuthOrg(e.target.value), placeholder: 'Organization (e.g. HUD)', style: { fontSize: 12, padding: '6px 10px' } }),
          React.createElement('input', { value: authName, onChange: e => setAuthName(e.target.value), placeholder: 'Standard name', style: { fontSize: 12, padding: '6px 10px' } }),
          React.createElement('input', { value: authProvision, onChange: e => setAuthProvision(e.target.value), placeholder: 'Provision (e.g. Element 3.01)', style: { fontSize: 12, padding: '6px 10px' } }),
          React.createElement('div', { style: { display: 'flex', gap: 4, alignItems: 'center' } },
            React.createElement('input', { value: authUri, onChange: e => setAuthUri(e.target.value), placeholder: 'Reference URI', style: { flex: 1, fontSize: 12, padding: '6px 10px' } }),
            React.createElement('button', { className: 'b-gho b-xs', onClick: () => setAuthUriBrowserOpen(true),
              title: 'Search URI libraries',
              style: { display: 'flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap', flexShrink: 0 } },
              React.createElement(I, { n: 'search', s: 10 }), 'Search')
          ),
          React.createElement(UriLibraryBrowser, {
            open: authUriBrowserOpen,
            onClose: () => setAuthUriBrowserOpen(false),
            mode: 'select',
            onSelect: entry => {
              setAuthUri(entry.uri || '');
              if (!authOrg) setAuthOrg(entry.source_library || '');
              if (!authName) setAuthName(entry.label || '');
              setAuthUriBrowserOpen(false);
            }
          })
        ),
        // Duplicate warning
        duplicateWarning && React.createElement('div', { style: { fontSize: 11, color: 'var(--orange)', padding: '6px 10px', background: 'var(--orange-dim)', borderRadius: 'var(--r)', border: '1px solid rgba(224,148,58,.2)' } },
          '\u26A0 ', duplicateWarning),
        // Governance notice
        governanceRequired && React.createElement('div', { className: 'cf-gov-notice' },
          React.createElement(I, { n: 'shieldCheck', s: 12 }), 'Governance is required — this will create a proposal for review'
        ),
        // Preview
        React.createElement('div', { className: 'cf-preview' },
          React.createElement('span', { style: { fontWeight: 600, fontSize: 12 } }, 'Preview'),
          React.createElement('div', { className: 'cf-preview-uri' }, uri),
          React.createElement('div', { style: { marginTop: 6, fontSize: 11, color: 'var(--tx-1)', lineHeight: 1.5 } },
            label.trim() || 'Field Name', ' — ', definition.trim().slice(0, 80) || 'definition...', definition.length > 80 ? '...' : '')
        )
      ),
      React.createElement('div', { className: 'cf-footer' },
        React.createElement('button', { className: 'b-gho', onClick: onClose }, 'Cancel'),
        React.createElement('button', { className: 'b-pri', disabled: !isValid || !!duplicateWarning || saving, onClick: handleSave },
          saving ? 'Saving...' : governanceRequired ? 'Submit Proposal' : 'Create Field')
      )
    )
  );
};

/* ─── Helper: map URI library categories to column categories ─── */
const mapUriCatToColumnCat = c => {
  const m = { identity: 'identity', demographics: 'identity', contact: 'contact', location: 'contact',
    health: 'case', safety: 'case', enrollment: 'case', service: 'case', sensitive: 'sensitive' };
  return m[c] || 'details';
};

/* ─── AddColumnModal — add a column to the Individuals table with required definition + team governance ─── */
const AddColumnModal = ({ open, onClose, onSave, onPropose, fieldDefs, teams, teamMode, activeTeamObj, svc, orgRoom, networkRoom, showToast, fieldGovernanceConfig }) => {
  const [label, setLabel] = useState('');
  const [key, setKey] = useState('');
  const [keyEdited, setKeyEdited] = useState(false);
  const [category, setCategory] = useState('details');
  const [dataType, setDataType] = useState('text');
  const [definition, setDefinition] = useState('');
  const [scope, setScope] = useState('');
  const [sensitive, setSensitive] = useState(false);
  const [saving, setSaving] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [mode, setMode] = useState('new'); // 'new' | 'existing'
  const [selectedExistingUri, setSelectedExistingUri] = useState('');
  const [existingSearch, setExistingSearch] = useState('');
  const [uriSource, setUriSource] = useState(null); // { uri, source_library, source_library_id }
  const [uriBrowserOpen, setUriBrowserOpen] = useState(false);

  const computedKey = key || fieldLabelToKey(label);
  const uri = `khora:${teamMode ? 'team/' + teamMode.roomId + '/' : 'org/'}${computedKey}`;

  // Check for duplicate URIs / keys — must be before any early return (Rules of Hooks)
  React.useEffect(() => {
    if (!open || !computedKey || !fieldDefs) { setDuplicateWarning(null); return; }
    const existing = Object.values(fieldDefs).find(d => d.key === computedKey || d.uri === uri);
    setDuplicateWarning(existing ? `A column with key "${computedKey}" already exists (${existing.label})` : null);
  }, [open, computedKey, uri, fieldDefs]);

  if (!open) return null;

  const defLen = definition.length;
  const defMinLen = uriSource ? 5 : 20;
  const isValidNew = label.trim().length > 0 && computedKey.length > 0 && defLen >= defMinLen && dataType;
  const isValidExisting = !!selectedExistingUri;

  // Resolve team governance context
  const activeTeam = activeTeamObj || (teamMode ? (teams || []).find(t => t.roomId === teamMode.roomId) : null);
  const teamSchemaRule = activeTeam?.schemaRule || { mode: 'lead_decides' };
  const consentMode = TEAM_CONSENT_MODES[teamSchemaRule.mode] || TEAM_CONSENT_MODES.lead_decides;
  const isTeamLead = activeTeam?.owner === svc?.userId;
  const isInTeamContext = !!activeTeam;
  const teamGovRequired = isInTeamContext && (teamSchemaRule.mode !== 'lead_decides' || !isTeamLead);
  const orgGovRequired = !!(fieldGovernanceConfig?.governance_required);
  const governanceRequired = teamGovRequired || orgGovRequired;

  // Cascading governance: team rules cascade from org/network
  const cascadeSource = activeTeam && orgRoom ? 'org' : activeTeam && networkRoom ? 'network' : null;

  const handleReset = () => {
    setLabel(''); setKey(''); setKeyEdited(false); setCategory('details');
    setDataType('text'); setDefinition(''); setScope(''); setSensitive(false);
    setSelectedExistingUri(''); setExistingSearch(''); setDuplicateWarning(null);
    setUriSource(null); setUriBrowserOpen(false);
  };

  const handleUriSelect = entry => {
    setDefinition(entry.definition || '');
    if (!label.trim()) { setLabel(entry.label || ''); if (!keyEdited) setKey(fieldLabelToKey(entry.label || '')); }
    if (entry.data_type) setDataType(entry.data_type);
    if (entry.category) setCategory(mapUriCatToColumnCat(entry.category));
    setUriSource({ uri: entry.uri, source_library: entry.source_library, source_library_id: entry.source_library_id });
    setUriBrowserOpen(false);
  };

  const handleSaveNew = async () => {
    if (!isValidNew || duplicateWarning) return;
    setSaving(true);
    const def = {
      uri,
      key: computedKey,
      label: label.trim(),
      category,
      data_type: dataType,
      definition: definition.trim(),
      scope: scope.trim() || null,
      sensitive,
      authority: uriSource ? { org: uriSource.source_library, name: uriSource.source_library, provision: null, uri: uriSource.uri } : null,
      version: 1,
      version_history: [],
      migration_rules: [],
      supersedes: null,
      superseded_by: null,
      created_by: svc?.userId || 'unknown',
      created_at: Date.now()
    };

    try {
      if (governanceRequired) {
        // Create governance proposal
        const targetRoom = activeTeam ? activeTeam.roomId : (networkRoom || orgRoom);
        const proposal = {
          id: 'prop_col_' + computedKey + '_' + Date.now(),
          type: 'add_column',
          summary: `Add column: "${label.trim()}"`,
          detail: `New ${dataType} column in ${category} category. Definition: ${definition.trim().slice(0, 120)}${defLen > 120 ? '...' : ''}`,
          field_definition: def,
          proposed_by: svc?.userId,
          proposed_at: Date.now(),
          status: 'submitted',
          positions: {},
          governance_context: {
            team: activeTeam ? { roomId: activeTeam.roomId, name: activeTeam.name, consent_mode: teamSchemaRule.mode } : null,
            org: orgRoom || null,
            network: networkRoom || null,
            cascading: !!cascadeSource,
            cascade_source: cascadeSource
          }
        };

        if (isInTeamContext) {
          // Route through team schema governance
          const currentSchema = { ...(activeTeam.schema || { version: 1, fields: [], pending_changes: [], change_log: [] }) };
          const change = {
            id: 'chg_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            action: 'add_field',
            uri: def.uri,
            required: false,
            summary: `Add column "${label.trim()}" — ${definition.trim().slice(0, 80)}`,
            proposed_by: svc.userId,
            proposed_at: Date.now(),
            field_definition: def,
            approvals: teamSchemaRule.mode === 'lead_decides' ? {} : { [svc.userId]: Date.now() },
            blocks: {}
          };

          if (teamSchemaRule.mode === 'lead_decides' && isTeamLead) {
            // Apply immediately
            if (onSave) await onSave(def);
            currentSchema.fields = [...(currentSchema.fields || []), { uri: def.uri, required: false, added_version: (currentSchema.version || 1) + 1 }];
            currentSchema.version = (currentSchema.version || 1) + 1;
            currentSchema.last_modified = Date.now();
            currentSchema.modified_by = svc.userId;
            currentSchema.change_log = [...(currentSchema.change_log || []), { version: currentSchema.version, summary: change.summary, by: svc.userId, ts: Date.now() }];
            await svc.setState(activeTeam.roomId, EVT.TEAM_SCHEMA, currentSchema);
            if (showToast) showToast(`Column "${label.trim()}" added to team schema (v${currentSchema.version})`, 'success');
          } else {
            // Save definition first, then add as pending change
            if (onSave) await onSave(def);
            currentSchema.pending_changes = [...(currentSchema.pending_changes || []), change];
            await svc.setState(activeTeam.roomId, EVT.TEAM_SCHEMA, currentSchema);
            const modeLabel = consentMode.label.toLowerCase();
            if (showToast) showToast(`Column proposal submitted — awaiting ${modeLabel} approval from team`, 'info');
          }
        } else {
          // Org/network level governance
          if (onPropose) await onPropose(proposal, targetRoom);
          if (showToast) showToast('Governance proposal created for new column');
        }
      } else {
        // No governance — save directly
        if (onSave) await onSave(def);
        if (showToast) showToast(`Column "${label.trim()}" created`);
      }
      handleReset();
      onClose();
    } catch (e) {
      console.error('AddColumn error:', e);
      if (showToast) showToast('Error adding column: ' + e.message, 'error');
    }
    setSaving(false);
  };

  const handleSelectExisting = async () => {
    if (!selectedExistingUri) return;
    setSaving(true);
    const existingDef = fieldDefs[selectedExistingUri];
    if (!existingDef) { setSaving(false); return; }

    // Existing field must have a definition
    if (!existingDef.definition || existingDef.definition.length < 10) {
      if (showToast) showToast('This field is missing a definition. Please add a definition in the Definitions tab first.', 'warning');
      setSaving(false);
      return;
    }

    try {
      if (isInTeamContext) {
        const currentSchema = { ...(activeTeam.schema || { version: 1, fields: [], pending_changes: [], change_log: [] }) };
        // Check if already in team schema
        if ((currentSchema.fields || []).some(f => f.uri === selectedExistingUri)) {
          if (showToast) showToast('This field is already in the team schema', 'warning');
          setSaving(false);
          return;
        }
        const change = {
          id: 'chg_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          action: 'add_field',
          uri: selectedExistingUri,
          required: false,
          summary: `Add column "${existingDef.label}" from definitions`,
          proposed_by: svc.userId,
          proposed_at: Date.now(),
          approvals: teamSchemaRule.mode === 'lead_decides' ? {} : { [svc.userId]: Date.now() },
          blocks: {}
        };

        if (teamSchemaRule.mode === 'lead_decides' && isTeamLead) {
          currentSchema.fields = [...(currentSchema.fields || []), { uri: selectedExistingUri, required: false, added_version: (currentSchema.version || 1) + 1 }];
          currentSchema.version = (currentSchema.version || 1) + 1;
          currentSchema.last_modified = Date.now();
          currentSchema.modified_by = svc.userId;
          currentSchema.change_log = [...(currentSchema.change_log || []), { version: currentSchema.version, summary: change.summary, by: svc.userId, ts: Date.now() }];
          await svc.setState(activeTeam.roomId, EVT.TEAM_SCHEMA, currentSchema);
          if (showToast) showToast(`Column "${existingDef.label}" added to team schema`, 'success');
        } else {
          currentSchema.pending_changes = [...(currentSchema.pending_changes || []), change];
          await svc.setState(activeTeam.roomId, EVT.TEAM_SCHEMA, currentSchema);
          const modeLabel = consentMode.label.toLowerCase();
          if (showToast) showToast(`Column proposal submitted — awaiting ${modeLabel} approval`, 'info');
        }
      }
      // Always add to enabledFieldCols locally
      onClose(existingDef.key);
      handleReset();
    } catch (e) {
      console.error('AddColumn existing error:', e);
      if (showToast) showToast('Error: ' + e.message, 'error');
    }
    setSaving(false);
  };

  const existingDefs = Object.values(fieldDefs || {}).filter(d =>
    d.key !== 'full_name' && d.definition && d.definition.length >= 10
  );
  const filteredExisting = existingSearch
    ? existingDefs.filter(d => d.label?.toLowerCase().includes(existingSearch.toLowerCase()) || d.key?.toLowerCase().includes(existingSearch.toLowerCase()))
    : existingDefs;

  return React.createElement('div', { className: 'cf-overlay', onClick: e => { if (e.target === e.currentTarget) { handleReset(); onClose(); } } },
    React.createElement('div', { className: 'cf-modal', style: { width: 560 } },
      React.createElement('div', { className: 'cf-header' },
        React.createElement('h3', null, 'Add Column'),
        React.createElement('button', { className: 'b-gho b-xs', onClick: () => { handleReset(); onClose(); }, style: { fontSize: 16, lineHeight: 1, padding: '2px 8px' } }, '\u2715')
      ),
      // Governance context banner
      isInTeamContext && React.createElement('div', { className: 'acm-gov-banner' },
        React.createElement(I, { n: 'shieldCheck', s: 13, c: consentMode.color === 'gold' ? 'var(--gold)' : consentMode.color === 'green' ? 'var(--green)' : 'var(--blue)' }),
        React.createElement('div', { style: { flex: 1 } },
          React.createElement('div', { style: { fontWeight: 600, fontSize: 12 } },
            'Team: ', activeTeam.name, ' \u2014 ', consentMode.label, ' governance'),
          React.createElement('div', { style: { fontSize: 10.5, color: 'var(--tx-2)', marginTop: 1 } },
            consentMode.desc),
          cascadeSource && React.createElement('div', { style: { fontSize: 9.5, color: 'var(--tx-3)', marginTop: 2, fontStyle: 'italic' } },
            'Rules cascade from ', cascadeSource, ' level')
        )
      ),
      // Mode tabs
      React.createElement('div', { className: 'acm-mode-tabs' },
        React.createElement('button', {
          className: 'acm-mode-tab' + (mode === 'existing' ? ' active' : ''),
          onClick: () => setMode('existing')
        }, React.createElement(I, { n: 'grid', s: 11 }), 'From Definitions'),
        React.createElement('button', {
          className: 'acm-mode-tab' + (mode === 'new' ? ' active' : ''),
          onClick: () => setMode('new')
        }, React.createElement(I, { n: 'plus', s: 11 }), 'Create New')
      ),
      React.createElement('div', { className: 'cf-body' },
        mode === 'existing' && React.createElement(React.Fragment, null,
          React.createElement('div', { className: 'cf-row' },
            React.createElement('input', {
              value: existingSearch, onChange: e => setExistingSearch(e.target.value),
              placeholder: 'Search defined fields...', style: { fontSize: 13 }
            })
          ),
          existingDefs.length === 0
            ? React.createElement('div', { style: { padding: '20px 0', textAlign: 'center', color: 'var(--tx-3)', fontSize: 12 } },
                'No field definitions with definitions yet. Create one using "Create New" tab.')
            : React.createElement('div', { className: 'acm-existing-list' },
                filteredExisting.map(d => React.createElement('div', {
                  key: d.uri,
                  className: 'acm-existing-item' + (selectedExistingUri === d.uri ? ' selected' : ''),
                  onClick: () => setSelectedExistingUri(d.uri === selectedExistingUri ? '' : d.uri)
                },
                  React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 6 } },
                    React.createElement('div', { className: 'acm-existing-radio' + (selectedExistingUri === d.uri ? ' checked' : '') }),
                    React.createElement('div', null,
                      React.createElement('div', { style: { fontWeight: 600, fontSize: 12.5 } }, d.label),
                      React.createElement('div', { style: { fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--tx-3)', marginTop: 1 } }, d.key)
                    )
                  ),
                  React.createElement('div', { style: { fontSize: 11, color: 'var(--tx-1)', marginTop: 4, lineHeight: 1.4 } },
                    (d.definition || '').slice(0, 100), (d.definition || '').length > 100 ? '...' : ''),
                  React.createElement('div', { style: { display: 'flex', gap: 4, marginTop: 4 } },
                    React.createElement('span', { className: 'tag tag-blue', style: { fontSize: 8 } }, (d.data_type || 'text').toUpperCase()),
                    React.createElement('span', { className: 'tag tag-' + (CAT_COLORS[d.category] || 'blue'), style: { fontSize: 8 } }, CAT_LABELS[d.category] || d.category)
                  )
                ))
              ),
          // Governance info for existing
          governanceRequired && selectedExistingUri && React.createElement('div', { className: 'cf-gov-notice' },
            React.createElement(I, { n: 'shieldCheck', s: 12 }),
            isInTeamContext
              ? `This will ${teamSchemaRule.mode === 'lead_decides' && isTeamLead ? 'be added to' : 'create a proposal for'} the team schema`
              : 'Governance is required \u2014 this will create a proposal for review'
          )
        ),
        mode === 'new' && React.createElement(React.Fragment, null,
          // Label & Key
          React.createElement('div', { className: 'cf-row-pair' },
            React.createElement('div', { className: 'cf-row' },
              React.createElement('label', { className: 'cf-label' }, 'Column Name', React.createElement('span', { className: 'required' }, '*')),
              React.createElement('input', { value: label, onChange: e => { setLabel(e.target.value); if (!keyEdited) setKey(fieldLabelToKey(e.target.value)); },
                placeholder: 'e.g. Housing Status', style: { fontSize: 13 } })
            ),
            React.createElement('div', { className: 'cf-row' },
              React.createElement('label', { className: 'cf-label' }, 'Key'),
              React.createElement('input', { value: key || fieldLabelToKey(label), onChange: e => { setKey(e.target.value); setKeyEdited(true); },
                style: { fontSize: 12, fontFamily: 'var(--mono)' } })
            )
          ),
          // Category & Type
          React.createElement('div', { className: 'cf-row-pair' },
            React.createElement('div', { className: 'cf-row' },
              React.createElement('label', { className: 'cf-label' }, 'Category', React.createElement('span', { className: 'required' }, '*')),
              React.createElement('select', { value: category, onChange: e => setCategory(e.target.value), style: { fontSize: 13 } },
                ['identity', 'contact', 'details', 'case', 'sensitive'].map(c =>
                  React.createElement('option', { key: c, value: c }, CAT_LABELS[c] || c)
                )
              )
            ),
            React.createElement('div', { className: 'cf-row' },
              React.createElement('label', { className: 'cf-label' }, 'Data Type', React.createElement('span', { className: 'required' }, '*')),
              React.createElement('select', { value: dataType, onChange: e => setDataType(e.target.value), style: { fontSize: 13 } },
                FIELD_DATA_TYPES.map(t => React.createElement('option', { key: t.v, value: t.v }, t.l))
              )
            )
          ),
          // Definition (required) — manual entry OR URI library
          React.createElement('div', { className: 'cf-row' },
            React.createElement('label', { className: 'cf-label' }, 'Definition', React.createElement('span', { className: 'required' }, '*'),
              React.createElement('span', { style: { fontSize: 9, color: 'var(--tx-3)', marginLeft: 6, fontWeight: 400 } }, 'Enter manually or browse standard definitions')),
            React.createElement('textarea', { value: definition, onChange: e => { setDefinition(e.target.value); if (uriSource) setUriSource(null); },
              placeholder: uriSource ? 'Definition from URI library (edit to override)...' : 'Describe what this column means, how it should be interpreted, and what values are expected...',
              style: { fontSize: 13, minHeight: 72 } }),
            React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 } },
              React.createElement('button', {
                className: 'b-gho b-xs', type: 'button',
                style: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 },
                onClick: () => setUriBrowserOpen(true)
              }, React.createElement(I, { n: 'globe', s: 11 }), 'Browse URI Libraries'),
              React.createElement('div', { className: `cf-char-count ${defLen < defMinLen ? 'warn' : 'ok'}` }, defLen, '/', defMinLen, ' min')
            ),
            uriSource && React.createElement('div', {
              style: { display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, padding: '4px 8px',
                background: 'var(--blue-dim)', borderRadius: 'var(--r)', border: '1px solid rgba(56,152,224,.15)', fontSize: 11 }
            },
              React.createElement(I, { n: 'link', s: 10, c: 'var(--blue)' }),
              React.createElement('span', { style: { color: 'var(--tx-2)' } }, 'Source: '),
              React.createElement('span', { style: { fontWeight: 600, color: 'var(--blue)' } }, uriSource.source_library),
              React.createElement('span', { style: { fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--tx-3)', marginLeft: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 } }, uriSource.uri),
              React.createElement('button', {
                className: 'b-gho', type: 'button',
                style: { marginLeft: 'auto', padding: '0 4px', fontSize: 12, lineHeight: 1 },
                onClick: () => setUriSource(null)
              }, '\u2715')
            )
          ),
          // Scope
          React.createElement('div', { className: 'cf-row' },
            React.createElement('label', { className: 'cf-label' }, 'Scope',
              React.createElement('span', { style: { fontSize: 9, color: 'var(--tx-3)', marginLeft: 4 } }, 'recommended')),
            React.createElement('textarea', { value: scope, onChange: e => setScope(e.target.value),
              placeholder: "What's included vs excluded...", style: { fontSize: 13, minHeight: 48 } })
          ),
          // Sensitive
          React.createElement('div', { className: 'cf-row' },
            React.createElement('div', { className: 'cf-toggle', onClick: () => setSensitive(!sensitive) },
              React.createElement('div', { className: `cf-toggle-track${sensitive ? ' on' : ''}` },
                React.createElement('div', { className: 'cf-toggle-knob' })
              ),
              React.createElement('span', { style: { fontSize: 12, color: sensitive ? 'var(--red)' : 'var(--tx-2)' } },
                sensitive ? 'Sensitive \u2014 requires elevated access' : 'Not sensitive')
            )
          ),
          // Duplicate warning
          duplicateWarning && React.createElement('div', { style: { fontSize: 11, color: 'var(--orange)', padding: '6px 10px', background: 'var(--orange-dim)', borderRadius: 'var(--r)', border: '1px solid rgba(224,148,56,.2)' } },
            '\u26A0 ', duplicateWarning),
          // Governance notice
          governanceRequired && React.createElement('div', { className: 'cf-gov-notice' },
            React.createElement(I, { n: 'shieldCheck', s: 12 }),
            isInTeamContext
              ? `Team governance (${consentMode.label.toLowerCase()}) \u2014 ${teamSchemaRule.mode === 'lead_decides' && isTeamLead ? 'will be applied directly' : 'this will create a proposal for team review'}`
              : 'Governance is required \u2014 this will create a proposal for review'
          ),
          // Preview
          React.createElement('div', { className: 'cf-preview' },
            React.createElement('span', { style: { fontWeight: 600, fontSize: 12 } }, 'Preview'),
            React.createElement('div', { className: 'cf-preview-uri' }, uri),
            React.createElement('div', { style: { marginTop: 6, fontSize: 11, color: 'var(--tx-1)', lineHeight: 1.5 } },
              label.trim() || 'Column Name', ' \u2014 ', definition.trim().slice(0, 80) || 'definition...', definition.length > 80 ? '...' : '')
          ),
          // URI Library Browser modal
          React.createElement(UriLibraryBrowser, {
            open: uriBrowserOpen,
            onClose: () => setUriBrowserOpen(false),
            mode: 'select',
            onSelect: handleUriSelect
          })
        )
      ),
      React.createElement('div', { className: 'cf-footer' },
        React.createElement('button', { className: 'b-gho', onClick: () => { handleReset(); onClose(); } }, 'Cancel'),
        mode === 'existing'
          ? React.createElement('button', { className: 'b-pri', disabled: !isValidExisting || saving, onClick: handleSelectExisting },
              saving ? 'Adding...' : governanceRequired && !(teamSchemaRule.mode === 'lead_decides' && isTeamLead) ? 'Submit Proposal' : 'Add Column')
          : React.createElement('button', { className: 'b-pri', disabled: !isValidNew || !!duplicateWarning || saving, onClick: handleSaveNew },
              saving ? 'Saving...' : governanceRequired && !(teamSchemaRule.mode === 'lead_decides' && isTeamLead) ? 'Submit Proposal' : 'Create Column')
      )
    )
  );
};

/* ─── CreateTableModal — create a new team-scoped custom table with governance ─── */
const TABLE_COLUMN_TYPES = [
  { id: 'text', label: 'Text' },
  { id: 'number', label: 'Number' },
  { id: 'date', label: 'Date' },
  { id: 'boolean', label: 'Yes / No' },
  { id: 'single_select', label: 'Single Select' },
  { id: 'multi_select', label: 'Multi-Select' },
  { id: 'url', label: 'URL / Link' }
];

const CreateTableModal = ({ open, onClose, team, svc, teams, showToast }) => {
  const [tableName, setTableName] = useState('');
  const [tableDesc, setTableDesc] = useState('');
  const [tablePurpose, setTablePurpose] = useState('');
  const [rollupToParent, setRollupToParent] = useState(false);
  const [columns, setColumns] = useState([
    { id: 'c1', key: '', label: '', data_type: 'text', description: '', required: false, sensitive: false, options: [] }
  ]);
  const [saving, setSaving] = useState(false);

  if (!open || !team) return null;

  const schemaRule = team.schemaRule || { mode: 'lead_decides' };
  const consentMode = TEAM_CONSENT_MODES[schemaRule.mode] || TEAM_CONSENT_MODES.lead_decides;
  const isLead = team.owner === svc?.userId;
  const needsProposal = schemaRule.mode !== 'lead_decides' || !isLead;
  const parentTeam = team.hierarchy?.parent_team_id
    ? teams.find(t => t.roomId === team.hierarchy.parent_team_id)
    : null;

  const fieldLabelToKey = lbl => lbl.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

  const addColumn = () => {
    setColumns(prev => [...prev, {
      id: 'c' + Date.now(), key: '', label: '', data_type: 'text',
      description: '', required: false, sensitive: false, options: []
    }]);
  };

  const updateColumn = (id, field, value) => {
    setColumns(prev => prev.map(c => {
      if (c.id !== id) return c;
      const updated = { ...c, [field]: value };
      if (field === 'label' && !c._keyEdited) updated.key = fieldLabelToKey(value);
      return updated;
    }));
  };

  const removeColumn = id => {
    if (columns.length <= 1) return;
    setColumns(prev => prev.filter(c => c.id !== id));
  };

  const isValid = () => {
    if (!tableName.trim() || tableName.trim().length < 2) return false;
    if (!tableDesc.trim() || tableDesc.trim().length < 15) return false;
    if (columns.length === 0) return false;
    // Every column needs a label, key, and a description (governance requirement)
    return columns.every(c => c.label.trim().length > 0 && c.key.length > 0 && c.description.trim().length >= 10);
  };

  const handleSave = async () => {
    if (!isValid()) return;
    setSaving(true);
    try {
      const tableId = 'tbl_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const tableDef = {
        id: tableId,
        name: tableName.trim(),
        description: tableDesc.trim(),
        purpose: tablePurpose.trim() || null,
        columns: columns.map(c => ({
          key: c.key,
          label: c.label.trim(),
          data_type: c.data_type,
          description: c.description.trim(),
          required: c.required,
          sensitive: c.sensitive,
          options: c.options || []
        })),
        team_id: team.roomId,
        created_by: svc.userId,
        created_at: Date.now(),
        governance_proposal_id: null,
        version: 1,
        change_log: [{ version: 1, summary: 'Table created', by: svc.userId, ts: Date.now() }],
        rollup_to_parent: rollupToParent && !!parentTeam,
        status: needsProposal ? 'pending_approval' : 'active'
      };

      if (needsProposal) {
        // Create a pending schema change proposal for the table
        const currentSchema = { ...(team.schema || { version: 1, fields: [], pending_changes: [], change_log: [] }) };
        const change = {
          id: 'chg_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          action: 'create_table',
          table_id: tableId,
          summary: `Create table "${tableName.trim()}"`,
          detail: tableDesc.trim().slice(0, 120),
          proposed_by: svc.userId,
          proposed_at: Date.now(),
          table_definition: tableDef,
          approvals: schemaRule.mode === 'lead_decides' ? {} : { [svc.userId]: Date.now() },
          blocks: {}
        };
        currentSchema.pending_changes = [...(currentSchema.pending_changes || []), change];
        await svc.setState(team.roomId, EVT.TEAM_SCHEMA, currentSchema);
        showToast(`Table proposal submitted — awaiting ${consentMode.label.toLowerCase()} approval`, 'info');
      } else {
        // Apply immediately — store as TEAM_TABLE_DEF state event (state_key = table id)
        await svc.setState(team.roomId, EVT.TEAM_TABLE_DEF, tableDef, tableId);
        showToast(`Table "${tableName.trim()}" created`, 'success');
      }
      // Reset and close
      setTableName(''); setTableDesc(''); setTablePurpose(''); setRollupToParent(false);
      setColumns([{ id: 'c1', key: '', label: '', data_type: 'text', description: '', required: false, sensitive: false, options: [] }]);
      onClose(needsProposal ? null : tableDef);
    } catch (e) {
      console.error('[CreateTable]', e);
      showToast('Failed to create table: ' + e.message, 'error');
    }
    setSaving(false);
  };

  const govColor = consentMode.color === 'gold' ? 'var(--gold)' : consentMode.color === 'green' ? 'var(--green)' : 'var(--blue)';

  return React.createElement('div', { className: 'cf-overlay', onClick: e => { if (e.target === e.currentTarget) onClose(null); } },
    React.createElement('div', { className: 'cf-modal', style: { width: 620, maxHeight: '90vh', display: 'flex', flexDirection: 'column' } },
      React.createElement('div', { className: 'cf-header' },
        React.createElement('div', null,
          React.createElement('h3', null, 'New Table'),
          React.createElement('span', { style: { fontSize: 10.5, color: 'var(--tx-2)' } }, 'in ', React.createElement('strong', null, team.name))
        ),
        React.createElement('button', { className: 'b-gho b-xs', onClick: () => onClose(null), style: { fontSize: 16, lineHeight: 1, padding: '2px 8px' } }, '\u2715')
      ),

      // Governance banner
      React.createElement('div', { style: { margin: '0 20px 0', padding: '10px 14px', borderRadius: 'var(--r)', background: 'var(--bg-3)', border: '1px solid var(--border-1)', display: 'flex', gap: 10, alignItems: 'flex-start' } },
        React.createElement(I, { n: 'shieldCheck', s: 14, c: govColor }),
        React.createElement('div', { style: { flex: 1 } },
          React.createElement('div', { style: { fontWeight: 700, fontSize: 12, color: govColor } }, consentMode.label, ' governance'),
          React.createElement('div', { style: { fontSize: 11, color: 'var(--tx-1)', marginTop: 2 } }, consentMode.desc),
          needsProposal
            ? React.createElement('div', { style: { marginTop: 4, fontSize: 10.5, color: 'var(--tx-2)', fontStyle: 'italic' } },
                'This table will be submitted as a proposal and must be approved before activation.')
            : React.createElement('div', { style: { marginTop: 4, fontSize: 10.5, color: 'var(--green)', fontStyle: 'italic' } },
                'As team lead, you can create this table immediately.')
        )
      ),

      React.createElement('div', { className: 'cf-body', style: { flex: 1, overflowY: 'auto' } },
        // Default Individuals template seed button
        (() => {
          const alreadyHasDefault = team.customTables?.some(t => t.is_default);
          if (alreadyHasDefault) return null;
          return React.createElement('div', {
            style: { margin: '12px 0 4px', padding: '10px 14px', borderRadius: 'var(--r)', background: 'var(--bg-3)', border: '1px dashed var(--border-1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }
          },
            React.createElement('div', null,
              React.createElement('div', { style: { fontWeight: 600, fontSize: 12 } }, 'Start from the default Individuals template'),
              React.createElement('div', { style: { fontSize: 11, color: 'var(--tx-2)', marginTop: 2 } },
                '22 CRM columns covering intake, demographics, housing, case tracking, and exit outcomes.'
              )
            ),
            React.createElement('button', {
              className: 'b-gho b-xs',
              style: { whiteSpace: 'nowrap', flexShrink: 0 },
              onClick: () => {
                setTableName(DEFAULT_INDIVIDUAL_TABLE_SCHEMA.name);
                setTableDesc(DEFAULT_INDIVIDUAL_TABLE_SCHEMA.description);
                setTablePurpose(DEFAULT_INDIVIDUAL_TABLE_SCHEMA.purpose);
                setColumns(DEFAULT_INDIVIDUAL_TABLE_SCHEMA.columns.map((col, idx) => ({
                  id: 'c_tmpl_' + idx,
                  _keyEdited: true,
                  ...col,
                  options: col.options || []
                })));
              }
            }, 'Use template')
          );
        })(),
        // Table name
        React.createElement('div', { className: 'cf-row' },
          React.createElement('span', { className: 'section-label' }, 'TABLE NAME *'),
          React.createElement('input', { value: tableName, onChange: e => setTableName(e.target.value), placeholder: 'e.g. Service Encounters, Housing Referrals...' })
        ),
        // Description (governance requirement)
        React.createElement('div', { className: 'cf-row' },
          React.createElement('span', { className: 'section-label' }, 'DESCRIPTION * \u2014 what data this table holds (min 15 chars)'),
          React.createElement('textarea', {
            value: tableDesc, onChange: e => setTableDesc(e.target.value),
            placeholder: 'Describe what this table captures and why it is needed...',
            style: { minHeight: 56 }
          }),
          tableDesc.length > 0 && tableDesc.length < 15 && React.createElement('span', { style: { fontSize: 10.5, color: 'var(--red)', marginTop: 3 } }, tableDesc.length, '/15 characters')
        ),
        // Purpose / rationale
        React.createElement('div', { className: 'cf-row' },
          React.createElement('span', { className: 'section-label' }, 'PURPOSE / RATIONALE (optional but recommended)'),
          React.createElement('textarea', {
            value: tablePurpose, onChange: e => setTablePurpose(e.target.value),
            placeholder: 'Why does this team need this table? What decisions will it inform?',
            style: { minHeight: 44 }
          })
        ),

        // Parent rollup
        parentTeam && React.createElement('div', { className: 'cf-row' },
          React.createElement('label', { style: { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' } },
            React.createElement('input', { type: 'checkbox', checked: rollupToParent, onChange: e => setRollupToParent(e.target.checked) }),
            React.createElement('div', null,
              React.createElement('div', { style: { fontWeight: 600, fontSize: 12 } }, 'Roll up data to parent team: ', React.createElement('strong', { style: { color: 'var(--teal)' } }, parentTeam.name)),
              React.createElement('div', { style: { fontSize: 10.5, color: 'var(--tx-2)', marginTop: 1 } },
                'When enabled, parent team leads can view aggregate (non-PII) data from this table.')
            )
          )
        ),

        // Columns section
        React.createElement('div', { style: { marginTop: 8 } },
          React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 } },
            React.createElement('span', { className: 'section-label' }, 'COLUMNS * \u2014 each requires a description (governance)'),
            React.createElement('button', { className: 'b-gho b-xs', onClick: addColumn, style: { display: 'flex', alignItems: 'center', gap: 4 } },
              React.createElement(I, { n: 'plus', s: 10 }), 'Add Column')
          ),
          columns.map((col, idx) =>
            React.createElement('div', { key: col.id, style: { background: 'var(--bg-3)', border: '1px solid var(--border-1)', borderRadius: 'var(--r)', padding: '12px 14px', marginBottom: 8 } },
              React.createElement('div', { style: { display: 'flex', gap: 8, marginBottom: 6 } },
                React.createElement('div', { style: { flex: 2 } },
                  React.createElement('span', { className: 'section-label', style: { fontSize: 9 } }, 'COLUMN NAME *'),
                  React.createElement('input', {
                    value: col.label, onChange: e => updateColumn(col.id, 'label', e.target.value),
                    placeholder: 'e.g. Encounter Date, Outcome...',
                    style: { fontSize: 12 }
                  })
                ),
                React.createElement('div', { style: { flex: 1 } },
                  React.createElement('span', { className: 'section-label', style: { fontSize: 9 } }, 'TYPE'),
                  React.createElement('select', {
                    value: col.data_type, onChange: e => updateColumn(col.id, 'data_type', e.target.value),
                    style: { fontSize: 12 }
                  }, TABLE_COLUMN_TYPES.map(t => React.createElement('option', { key: t.id, value: t.id }, t.label)))
                ),
                React.createElement('div', { style: { flex: 1 } },
                  React.createElement('span', { className: 'section-label', style: { fontSize: 9 } }, 'KEY (auto)'),
                  React.createElement('input', {
                    value: col.key, onChange: e => { updateColumn(col.id, '_keyEdited', true); updateColumn(col.id, 'key', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_')); },
                    placeholder: 'field_key',
                    style: { fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--tx-2)' }
                  })
                ),
                React.createElement('button', {
                  className: 'b-gho b-xs', onClick: () => removeColumn(col.id),
                  style: { alignSelf: 'flex-end', color: 'var(--red)', opacity: columns.length <= 1 ? 0.3 : 1 },
                  disabled: columns.length <= 1
                }, React.createElement(I, { n: 'x', s: 11 }))
              ),
              // Column description (governance requirement)
              React.createElement('div', null,
                React.createElement('span', { className: 'section-label', style: { fontSize: 9 } }, 'DESCRIPTION * (min 10 chars)'),
                React.createElement('input', {
                  value: col.description, onChange: e => updateColumn(col.id, 'description', e.target.value),
                  placeholder: 'What does this column capture? How should it be filled in?',
                  style: { fontSize: 11 }
                }),
                col.description.length > 0 && col.description.length < 10 && React.createElement('span', { style: { fontSize: 9.5, color: 'var(--red)' } }, col.description.length, '/10')
              ),
              // Options for select types
              (col.data_type === 'single_select' || col.data_type === 'multi_select') &&
                React.createElement('div', { style: { marginTop: 6 } },
                  React.createElement('span', { className: 'section-label', style: { fontSize: 9 } }, 'OPTIONS (comma-separated)'),
                  React.createElement('input', {
                    value: col.options.join(', '),
                    onChange: e => updateColumn(col.id, 'options', e.target.value.split(',').map(s => s.trim()).filter(Boolean)),
                    placeholder: 'Option A, Option B, Option C',
                    style: { fontSize: 11 }
                  })
                ),
              // Toggles
              React.createElement('div', { style: { display: 'flex', gap: 16, marginTop: 6 } },
                React.createElement('label', { style: { display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 11 } },
                  React.createElement('input', { type: 'checkbox', checked: col.required, onChange: e => updateColumn(col.id, 'required', e.target.checked) }),
                  'Required'),
                React.createElement('label', { style: { display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 11 } },
                  React.createElement('input', { type: 'checkbox', checked: col.sensitive, onChange: e => updateColumn(col.id, 'sensitive', e.target.checked) }),
                  'Sensitive / PII')
              )
            )
          )
        )
      ),

      React.createElement('div', { className: 'cf-footer' },
        React.createElement('button', { className: 'b-gho', onClick: () => onClose(null) }, 'Cancel'),
        React.createElement('button', {
          className: 'b-pri', disabled: !isValid() || saving, onClick: handleSave,
          style: { display: 'flex', alignItems: 'center', gap: 4 }
        },
          React.createElement(I, { n: needsProposal ? 'shieldCheck' : 'plus', s: 13 }),
          saving ? 'Saving...' : needsProposal ? 'Submit Proposal' : 'Create Table'
        )
      )
    )
  );
};

/* ─── CustomTableView — view + add records for a team custom table ─── */
const CustomTableView = ({ table, team, svc, showToast, onBack }) => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addingRow, setAddingRow] = useState(false);
  const [newRowData, setNewRowData] = useState({});
  const [saving, setSaving] = useState(false);

  // Load existing records from Matrix state
  React.useEffect(() => {
    if (!table || !team || !svc) { setLoading(false); return; }
    setLoading(true);
    try {
      const room = svc.client?.getRoom(team.roomId);
      const allState = room?.currentState?.events;
      const found = [];
      if (allState) {
        const recMap = allState.get(EVT.TEAM_TABLE_RECORD);
        if (recMap) {
          for (const [stateKey, evObj] of recMap.entries()) {
            if (stateKey.startsWith(table.id + ':')) {
              const content = evObj.getContent?.() || evObj.content || {};
              if (content.id && content.status !== 'archived') found.push(content);
            }
          }
        }
      }
      found.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
      setRecords(found);
    } catch (e) {
      console.warn('[CustomTableView] load error:', e.message);
    }
    setLoading(false);
  }, [table?.id, team?.roomId]);

  const handleAddRow = async () => {
    // Validate required columns
    const missing = (table.columns || []).filter(c => c.required && !newRowData[c.key]?.toString().trim());
    if (missing.length > 0) {
      showToast('Required fields: ' + missing.map(c => c.label).join(', '), 'warning');
      return;
    }
    setSaving(true);
    try {
      const recId = 'rec_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
      const record = {
        id: recId,
        table_id: table.id,
        data: { ...newRowData },
        created_by: svc.userId,
        created_at: Date.now(),
        modified_by: svc.userId,
        modified_at: Date.now(),
        status: 'active'
      };
      await svc.setState(team.roomId, EVT.TEAM_TABLE_RECORD, record, table.id + ':' + recId);
      setRecords(prev => [record, ...prev]);
      setNewRowData({});
      setAddingRow(false);
      showToast('Record added', 'success');
    } catch (e) {
      showToast('Failed to add record: ' + e.message, 'error');
    }
    setSaving(false);
  };

  const schemaRule = team.schemaRule || { mode: 'lead_decides' };
  const consentMode = TEAM_CONSENT_MODES[schemaRule.mode] || TEAM_CONSENT_MODES.lead_decides;
  const govColor = consentMode.color === 'gold' ? 'var(--gold)' : consentMode.color === 'green' ? 'var(--green)' : 'var(--blue)';

  return React.createElement('div', { className: 'anim-up', style: { padding: '0 0 24px' } },
    // Header
    React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 } },
      React.createElement('button', { className: 'b-gho b-sm', onClick: onBack, style: { display: 'flex', alignItems: 'center', gap: 4 } },
        React.createElement(I, { n: 'arr-l', s: 12 }), 'Back'),
      React.createElement('div', { style: { flex: 1 } },
        React.createElement('h3', { style: { fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 700 } }, table.name),
        React.createElement('div', { style: { fontSize: 11, color: 'var(--tx-2)', marginTop: 1 } },
          React.createElement('strong', { style: { color: govColor } }, consentMode.label, ' governance'), ' \u00B7 ', team.name,
          table.rollup_to_parent && React.createElement('span', { style: { marginLeft: 6, color: 'var(--teal)', fontSize: 10, fontWeight: 600 } }, '\u21A5 rolls up'))
      ),
      React.createElement('button', {
        className: 'b-pri b-sm', onClick: () => setAddingRow(true),
        style: { display: 'flex', alignItems: 'center', gap: 4 }
      }, React.createElement(I, { n: 'plus', s: 11 }), 'Add Row')
    ),
    // Description
    React.createElement('p', { style: { fontSize: 12, color: 'var(--tx-1)', marginBottom: 12, lineHeight: 1.5 } }, table.description),

    // Add row inline form
    addingRow && React.createElement('div', { style: { background: 'var(--bg-3)', border: '1px solid var(--border-1)', borderRadius: 'var(--r)', padding: '14px 16px', marginBottom: 16 } },
      React.createElement('div', { style: { fontWeight: 700, fontSize: 12, marginBottom: 10 } }, 'New Row'),
      React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8, marginBottom: 10 } },
        (table.columns || []).map(col =>
          React.createElement('div', { key: col.key },
            React.createElement('span', { className: 'section-label', style: { fontSize: 9 } },
              col.label.toUpperCase(), col.required ? ' *' : ''),
            col.data_type === 'boolean'
              ? React.createElement('select', {
                  value: newRowData[col.key] || '',
                  onChange: e => setNewRowData(d => ({ ...d, [col.key]: e.target.value })),
                  style: { fontSize: 12 }
                }, React.createElement('option', { value: '' }, '—'), React.createElement('option', { value: 'yes' }, 'Yes'), React.createElement('option', { value: 'no' }, 'No'))
              : col.data_type === 'single_select'
              ? React.createElement('select', {
                  value: newRowData[col.key] || '',
                  onChange: e => setNewRowData(d => ({ ...d, [col.key]: e.target.value })),
                  style: { fontSize: 12 }
                }, React.createElement('option', { value: '' }, '— select —'), ...(col.options || []).map(o => React.createElement('option', { key: o, value: o }, o)))
              : React.createElement('input', {
                  type: col.data_type === 'number' ? 'number' : col.data_type === 'date' ? 'date' : 'text',
                  value: newRowData[col.key] || '',
                  onChange: e => setNewRowData(d => ({ ...d, [col.key]: e.target.value })),
                  placeholder: col.description.slice(0, 40),
                  style: { fontSize: 12 }
                })
          )
        )
      ),
      React.createElement('div', { style: { display: 'flex', gap: 8 } },
        React.createElement('button', { className: 'b-gho b-sm', onClick: () => { setAddingRow(false); setNewRowData({}); } }, 'Cancel'),
        React.createElement('button', { className: 'b-pri b-sm', disabled: saving, onClick: handleAddRow },
          saving ? 'Saving...' : 'Add Row')
      )
    ),

    // Records table
    loading
      ? React.createElement('div', { style: { textAlign: 'center', padding: 32, color: 'var(--tx-3)' } }, 'Loading records...')
      : records.length === 0 && !addingRow
        ? React.createElement('div', { style: { textAlign: 'center', padding: 32, color: 'var(--tx-3)', fontSize: 12 } },
            React.createElement(I, { n: 'layers', s: 24, c: 'var(--border-1)' }),
            React.createElement('p', { style: { marginTop: 8 } }, 'No records yet. Add the first row.'))
        : React.createElement('div', { style: { overflowX: 'auto' } },
            React.createElement('table', { className: 'dt', style: { width: '100%' } },
              React.createElement('thead', null,
                React.createElement('tr', null,
                  React.createElement('th', { style: { width: 32, fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--tx-3)' } }, '#'),
                  (table.columns || []).map(col =>
                    React.createElement('th', { key: col.key },
                      col.label,
                      col.required && React.createElement('span', { style: { color: 'var(--red)', marginLeft: 2 } }, '*'),
                      col.sensitive && React.createElement('span', { title: 'Sensitive / PII', style: { marginLeft: 4, color: 'var(--orange)' } }, '\uD83D\uDD12')
                    )
                  ),
                  React.createElement('th', { style: { width: 90, fontSize: 9 } }, 'ADDED')
                )
              ),
              React.createElement('tbody', null,
                records.map((rec, idx) =>
                  React.createElement('tr', { key: rec.id },
                    React.createElement('td', { style: { fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--tx-3)', textAlign: 'center' } }, idx + 1),
                    (table.columns || []).map(col =>
                      React.createElement('td', { key: col.key, style: { maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
                        rec.data?.[col.key] ?? React.createElement('span', { style: { color: 'var(--tx-3)', fontStyle: 'italic' } }, '—'))
                    ),
                    React.createElement('td', { style: { fontSize: 10, color: 'var(--tx-3)' } },
                      rec.created_at ? new Date(rec.created_at).toLocaleDateString() : '—')
                  )
                )
              )
            )
          )
  );
};

/* ─── MergeFieldsModal — merge duplicate field definitions into a canonical one ─── */
const MergeFieldsModal = ({ open, onClose, fieldsToMerge, fieldDefs, onSaveFieldDef, onSaveCrosswalk, governanceRequired, svc, orgRoom, networkRoom, showToast }) => {
  const [canonicalUri, setCanonicalUri] = useState(null);
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (fieldsToMerge && fieldsToMerge.length > 0) setCanonicalUri(fieldsToMerge[0].uri);
  }, [fieldsToMerge]);

  if (!open || !fieldsToMerge || fieldsToMerge.length < 2) return null;

  const canonical = fieldsToMerge.find(f => f.uri === canonicalUri) || fieldsToMerge[0];
  const deprecated = fieldsToMerge.filter(f => f.uri !== canonicalUri);

  const handleMerge = async () => {
    setSaving(true);
    try {
      // Mark deprecated fields
      for (const dep of deprecated) {
        const updated = {
          ...dep,
          superseded_by: canonical.uri,
          deprecated_at: Date.now(),
          deprecated_reason: 'merged'
        };
        if (onSaveFieldDef) await onSaveFieldDef(updated);
        // Create crosswalk
        if (onSaveCrosswalk) {
          await onSaveCrosswalk({
            id: 'xw_merge_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            from_uri: dep.uri,
            to_uri: canonical.uri,
            relationship: 'equivalent',
            bidirectional: true,
            notes: `Merged: "${dep.label}" → "${canonical.label}"`,
            created_at: Date.now(),
            merge_operation: true
          });
        }
      }
      if (showToast) showToast(`Merged ${deprecated.length} field(s) into "${canonical.label}"`);
      onClose();
    } catch (e) {
      console.error('Merge error:', e);
      if (showToast) showToast('Error merging: ' + e.message);
    }
    setSaving(false);
  };

  return React.createElement('div', { className: 'cf-overlay', onClick: e => { if (e.target === e.currentTarget) onClose(); } },
    React.createElement('div', { className: 'cf-modal' },
      React.createElement('div', { className: 'cf-header' },
        React.createElement('h3', null, 'Merge Field Definitions'),
        React.createElement('button', { className: 'b-gho b-xs', onClick: onClose, style: { fontSize: 16, lineHeight: 1, padding: '2px 8px' } }, '\u2715')
      ),
      React.createElement('div', { className: 'cf-body' },
        React.createElement('div', { style: { fontSize: 12, color: 'var(--tx-2)', lineHeight: 1.6, marginBottom: 8 } },
          'Select the canonical (primary) field. Other fields will be deprecated and linked as equivalents.'),
        React.createElement('div', { className: 'cf-merge-fields' },
          fieldsToMerge.map(f => React.createElement('div', {
            key: f.uri,
            className: `cf-merge-card${f.uri === canonicalUri ? ' canonical' : ''}`,
            onClick: () => setCanonicalUri(f.uri)
          },
            React.createElement('input', { type: 'radio', checked: f.uri === canonicalUri, readOnly: true, style: { accentColor: 'var(--teal)' } }),
            React.createElement('div', { style: { flex: 1 } },
              React.createElement('div', { style: { fontWeight: 600, fontSize: 13 } }, f.label),
              React.createElement('div', { style: { fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--tx-3)', marginTop: 2 } }, f.uri),
              f.definition && React.createElement('div', { style: { fontSize: 11, color: 'var(--tx-2)', marginTop: 4, lineHeight: 1.4 } }, f.definition.slice(0, 100))
            ),
            f.uri === canonicalUri
              ? React.createElement('span', { className: 'tag tag-teal', style: { fontSize: 9 } }, 'CANONICAL')
              : React.createElement('span', { className: 'tag tag-red', style: { fontSize: 9 } }, 'DEPRECATED')
          ))
        ),
        deprecated.length > 0 && React.createElement('div', { style: { padding: '10px 14px', background: 'var(--bg-2)', borderRadius: 'var(--r)', border: '1px solid var(--border-0)', fontSize: 11, color: 'var(--tx-2)', lineHeight: 1.5 } },
          React.createElement('strong', null, 'What happens:'), React.createElement('br', null),
          '\u2022 ', deprecated.map(d => `"${d.label}"`).join(', '), ' will be marked as superseded', React.createElement('br', null),
          '\u2022 Equivalent crosswalks will be created automatically', React.createElement('br', null),
          '\u2022 Existing data is preserved — only metadata changes')
      ),
      React.createElement('div', { className: 'cf-footer' },
        React.createElement('button', { className: 'b-gho', onClick: onClose }, 'Cancel'),
        React.createElement('button', { className: 'b-pri', disabled: saving, onClick: handleMerge },
          saving ? 'Merging...' : `Merge into "${canonical.label}"`)
      )
    )
  );
};

/* ─── EvolveFieldModal — evolve a field definition with migration rules ─── */
const EVOLVE_TYPES = [
  { v: 'rename', l: 'Rename', desc: 'Change the field key or label' },
  { v: 'type_change', l: 'Type Change', desc: 'Change the data type (e.g. text → select)' },
  { v: 'split', l: 'Split', desc: 'Split into multiple fields' },
  { v: 'deprecate', l: 'Deprecate', desc: 'Mark as deprecated (data preserved)' }
];

const EvolveFieldModal = ({ open, onClose, fieldDef, onSaveFieldDef, governanceRequired, svc, orgRoom, networkRoom, showToast }) => {
  const [evolveType, setEvolveType] = useState('rename');
  const [newLabel, setNewLabel] = useState('');
  const [newKey, setNewKey] = useState('');
  const [newDataType, setNewDataType] = useState('');
  const [transformNotes, setTransformNotes] = useState('');
  const [deprecateReason, setDeprecateReason] = useState('');
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (fieldDef) {
      setNewLabel(fieldDef.label || '');
      setNewKey(fieldDef.key || '');
      setNewDataType(fieldDef.data_type || 'text');
    }
  }, [fieldDef?.uri]);

  if (!open || !fieldDef) return null;

  const currentVersion = fieldDef.version || 1;
  const nextVersion = currentVersion + 1;

  const handleEvolve = async () => {
    setSaving(true);
    try {
      const historyEntry = {
        version: nextVersion,
        previous_version: currentVersion,
        change_type: evolveType,
        changes: {},
        transform_notes: transformNotes.trim(),
        created_at: Date.now(),
        created_by: svc?.userId
      };

      const migrationRule = {
        from_version: currentVersion,
        to_version: nextVersion,
        transform_type: evolveType,
        transform_config: {}
      };

      if (evolveType === 'rename') {
        historyEntry.changes = { old_label: fieldDef.label, new_label: newLabel.trim(), old_key: fieldDef.key, new_key: newKey || fieldDef.key };
        migrationRule.transform_config = { old_key: fieldDef.key, new_key: newKey || fieldDef.key };
      } else if (evolveType === 'type_change') {
        historyEntry.changes = { old_type: fieldDef.data_type, new_type: newDataType };
        migrationRule.transform_config = { old_type: fieldDef.data_type, new_type: newDataType, notes: transformNotes.trim() };
      } else if (evolveType === 'deprecate') {
        historyEntry.changes = { reason: deprecateReason.trim() };
        migrationRule.transform_config = { action: 'archive', reason: deprecateReason.trim() };
      } else if (evolveType === 'split') {
        historyEntry.changes = { notes: transformNotes.trim() };
        migrationRule.transform_config = { notes: transformNotes.trim() };
      }

      const updated = {
        ...fieldDef,
        version: nextVersion,
        label: evolveType === 'rename' ? newLabel.trim() : fieldDef.label,
        key: evolveType === 'rename' && newKey ? newKey : fieldDef.key,
        data_type: evolveType === 'type_change' ? newDataType : fieldDef.data_type,
        superseded_by: evolveType === 'deprecate' ? 'deprecated' : fieldDef.superseded_by,
        deprecated_at: evolveType === 'deprecate' ? Date.now() : fieldDef.deprecated_at,
        deprecated_reason: evolveType === 'deprecate' ? deprecateReason.trim() : fieldDef.deprecated_reason,
        version_history: [...(fieldDef.version_history || []), historyEntry],
        migration_rules: [...(fieldDef.migration_rules || []), migrationRule]
      };

      if (onSaveFieldDef) await onSaveFieldDef(updated);
      if (showToast) showToast(`Field "${fieldDef.label}" evolved to v${nextVersion}`);
      onClose();
    } catch (e) {
      console.error('Evolve error:', e);
      if (showToast) showToast('Error: ' + e.message);
    }
    setSaving(false);
  };

  return React.createElement('div', { className: 'cf-overlay', onClick: e => { if (e.target === e.currentTarget) onClose(); } },
    React.createElement('div', { className: 'cf-modal' },
      React.createElement('div', { className: 'cf-header' },
        React.createElement('h3', null, 'Evolve Field Definition'),
        React.createElement('button', { className: 'b-gho b-xs', onClick: onClose, style: { fontSize: 16, lineHeight: 1, padding: '2px 8px' } }, '\u2715')
      ),
      React.createElement('div', { className: 'cf-body' },
        // Current version info
        React.createElement('div', { className: 'cf-preview', style: { marginTop: 0 } },
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
            React.createElement('span', { style: { fontWeight: 600, fontSize: 13 } }, fieldDef.label),
            React.createElement('span', { className: 'cf-migrate-badge current' }, 'v', currentVersion)
          ),
          React.createElement('div', { className: 'cf-preview-uri' }, fieldDef.uri),
          React.createElement('div', { style: { fontSize: 11, color: 'var(--tx-2)', marginTop: 4 } }, fieldDef.definition?.slice(0, 100))
        ),
        React.createElement('div', { className: 'cf-merge-arrow' }, '\u2193 evolves to v', nextVersion),
        // Change type
        React.createElement('div', { className: 'cf-row' },
          React.createElement('label', { className: 'cf-label' }, 'Change Type'),
          React.createElement('div', { style: { display: 'flex', gap: 6, flexWrap: 'wrap' } },
            EVOLVE_TYPES.map(t => React.createElement('button', {
              key: t.v,
              className: `b-gho b-xs${evolveType === t.v ? ' active' : ''}`,
              style: evolveType === t.v ? { background: 'var(--teal-dim)', color: 'var(--teal)', borderColor: 'var(--teal)' } : {},
              onClick: () => setEvolveType(t.v)
            }, t.l))
          )
        ),
        // Type-specific fields
        evolveType === 'rename' && React.createElement(React.Fragment, null,
          React.createElement('div', { className: 'cf-row-pair' },
            React.createElement('div', { className: 'cf-row' },
              React.createElement('label', { className: 'cf-label' }, 'New Label'),
              React.createElement('input', { value: newLabel, onChange: e => setNewLabel(e.target.value), style: { fontSize: 13 } })
            ),
            React.createElement('div', { className: 'cf-row' },
              React.createElement('label', { className: 'cf-label' }, 'New Key'),
              React.createElement('input', { value: newKey, onChange: e => setNewKey(e.target.value), style: { fontSize: 12, fontFamily: 'var(--mono)' } })
            )
          )
        ),
        evolveType === 'type_change' && React.createElement(React.Fragment, null,
          React.createElement('div', { className: 'cf-row' },
            React.createElement('label', { className: 'cf-label' }, 'New Data Type'),
            React.createElement('select', { value: newDataType, onChange: e => setNewDataType(e.target.value), style: { fontSize: 13 } },
              FIELD_DATA_TYPES.map(t => React.createElement('option', { key: t.v, value: t.v }, t.l))
            )
          ),
          React.createElement('div', { className: 'cf-row' },
            React.createElement('label', { className: 'cf-label' }, 'Transform Notes'),
            React.createElement('textarea', { value: transformNotes, onChange: e => setTransformNotes(e.target.value),
              placeholder: 'Describe how to convert old values to new type (e.g. "text values map to select options as follows...")',
              style: { fontSize: 12, minHeight: 56 } })
          )
        ),
        evolveType === 'deprecate' && React.createElement('div', { className: 'cf-row' },
          React.createElement('label', { className: 'cf-label' }, 'Deprecation Reason'),
          React.createElement('textarea', { value: deprecateReason, onChange: e => setDeprecateReason(e.target.value),
            placeholder: 'Why is this field being deprecated?', style: { fontSize: 12, minHeight: 48 } })
        ),
        evolveType === 'split' && React.createElement('div', { className: 'cf-row' },
          React.createElement('label', { className: 'cf-label' }, 'Split Details'),
          React.createElement('textarea', { value: transformNotes, onChange: e => setTransformNotes(e.target.value),
            placeholder: 'Describe how this field will be split and which new fields will be created...',
            style: { fontSize: 12, minHeight: 56 } })
        ),
        // Version history
        (fieldDef.version_history || []).length > 0 && React.createElement('div', { className: 'cf-row' },
          React.createElement('label', { className: 'cf-label' }, 'Version History'),
          React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 4 } },
            (fieldDef.version_history || []).map((h, i) => React.createElement('div', {
              key: i, style: { fontSize: 10.5, padding: '4px 8px', background: 'var(--bg-2)', borderRadius: 'var(--r)', color: 'var(--tx-2)', fontFamily: 'var(--mono)' }
            }, `v${h.version}: ${h.change_type} — ${new Date(h.created_at).toLocaleDateString()}`))
          )
        )
      ),
      React.createElement('div', { className: 'cf-footer' },
        React.createElement('button', { className: 'b-gho', onClick: onClose }, 'Cancel'),
        React.createElement('button', { className: 'b-pri', disabled: saving, onClick: handleEvolve },
          saving ? 'Saving...' : `Evolve to v${nextVersion}`)
      )
    )
  );
};

/* ─── UriLibraryBrowser — searchable modal to browse standard URI vocabularies ─── */
