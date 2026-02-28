/* ═══════════════════ DATA TABLE COMPONENTS ═══════════════════ */

// Config objects for data table display
const DT_STATUS_CFG = {
  imported: {
    l: 'Imported',
    bg: 'var(--gold-dim)',
    c: 'var(--gold)'
  },
  invited: {
    l: 'Invited',
    bg: 'var(--teal-dim)',
    c: 'var(--teal)'
  },
  joined: {
    l: 'Joined',
    bg: 'var(--green-dim)',
    c: 'var(--green)'
  },
  claimed: {
    l: 'Claimed',
    bg: 'var(--green-dim)',
    c: 'var(--green)'
  },
  active: {
    l: 'Active',
    bg: 'var(--green-dim)',
    c: 'var(--green)'
  },
  revoked: {
    l: 'Revoked',
    bg: 'var(--red-dim)',
    c: 'var(--red)'
  }
};
const DT_PRI_CFG = {
  critical: 'tag-red',
  high: 'tag-gold',
  medium: 'tag-teal',
  low: 'tag-purple',
  none: 'tag-purple'
};
const DT_NEED_COLORS = {
  housing: 'tag-blue',
  medical: 'tag-purple',
  legal: 'tag-gold',
  employment: 'tag-teal',
  substance: 'tag-orange',
  outreach: 'tag-purple',
  childcare: 'tag-green'
};
const DT_OP_CFG = {
  sovereign: {
    l: 'Sovereign',
    cls: 'tag-purple'
  },
  attested: {
    l: 'Attested',
    cls: 'tag-teal'
  },
  contributed: {
    l: 'Contributed',
    cls: 'tag-blue'
  },
  published: {
    l: 'Published',
    cls: 'tag-green'
  }
};
const DT_PROV_COLORS = {
  restocked: 'var(--green)',
  allocated: 'var(--teal)',
  returned: 'var(--blue)',
  expired: 'var(--gold)',
  capacity_reduced: 'var(--red)',
  capacity_restored: 'var(--green)',
  completed: 'var(--green)'
};

// Small helper components
const DtEo = ({
  op
}) => /*#__PURE__*/React.createElement("span", {
  className: "dt-eo"
}, op);
const DtRoom = ({
  room
}) => {
  if (!room) return /*#__PURE__*/React.createElement("span", {
    className: "dt-room"
  }, "no room");
  const short = room.replace(/!|:[\w.-]+/g, '').substring(0, 22);
  return /*#__PURE__*/React.createElement("span", {
    className: "dt-room"
  }, '⬡ ' + short);
};
const DtDiscBar = ({
  level = 0
}) => {
  const segs = [];
  for (let i = 0; i < 5; i++) segs.push(/*#__PURE__*/React.createElement("span", {
    key: i,
    className: 'seg' + (i < Math.round(level * 5) ? ' on' : '')
  }));
  return /*#__PURE__*/React.createElement("div", {
    className: "dt-disc"
  }, segs, /*#__PURE__*/React.createElement("span", {
    className: "pct"
  }, Math.round(level * 100), "%"));
};
const DtUtilBar = ({
  pct = 0
}) => {
  const c = pct > .9 ? 'var(--red)' : pct > .7 ? 'var(--gold)' : 'var(--green)';
  return /*#__PURE__*/React.createElement("div", {
    className: "dt-util"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dt-util-track"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dt-util-fill",
    style: {
      width: pct * 100 + '%',
      background: c
    }
  })), /*#__PURE__*/React.createElement("span", {
    className: "dt-util-label",
    style: {
      color: c
    }
  }, Math.round(pct * 100), "%"));
};
const DtLock = () => /*#__PURE__*/React.createElement("svg", {
  width: "10",
  height: "10",
  viewBox: "0 0 16 16"
}, /*#__PURE__*/React.createElement("rect", {
  x: "2",
  y: "7",
  width: "12",
  height: "8",
  rx: "2",
  fill: "currentColor"
}), /*#__PURE__*/React.createElement("path", {
  d: "M5 7V5a3 3 0 016 0v2",
  stroke: "currentColor",
  strokeWidth: "1.5",
  fill: "none"
}));
const DtStatusBadge = ({
  status
}) => {
  const c = DT_STATUS_CFG[status] || DT_STATUS_CFG.imported;
  return /*#__PURE__*/React.createElement("span", {
    className: "tag",
    style: {
      background: c.bg,
      color: c.c,
      fontSize: 11
    }
  }, c.l);
};
const dtFmtDate = iso => {
  if (!iso) return '—';
  const d = new Date(iso),
    now = new Date(),
    diff = now - d;
  if (diff < 864e5) return 'Today';
  if (diff < 1728e5) return 'Yesterday';
  if (diff < 6048e5) return Math.floor(diff / 864e5) + 'd ago';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });
};

/* ─── EditableCell — click-to-edit cell with blur save ─── */
const EditableCell = ({
  value,
  onSave,
  placeholder,
  type
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || '');
  const inputRef = useRef(null);
  useEffect(() => {
    setDraft(value || '');
  }, [value]);
  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus();
  }, [editing]);
  const commit = () => {
    setEditing(false);
    if (draft !== (value || '')) onSave && onSave(draft);
  };
  if (editing) return /*#__PURE__*/React.createElement("input", {
    ref: inputRef,
    className: "dt-ecell-input",
    value: draft,
    onChange: e => setDraft(e.target.value),
    onBlur: commit,
    onKeyDown: e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commit();
      }
      if (e.key === 'Escape') {
        setDraft(value || '');
        setEditing(false);
      }
    },
    onClick: e => e.stopPropagation()
  });
  return /*#__PURE__*/React.createElement("div", {
    className: "dt-ecell",
    title: "Double-click to edit",
    onDoubleClick: e => {
      e.stopPropagation();
      setEditing(true);
    }
  }, draft || /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--tx-3)',
      fontStyle: 'italic'
    }
  }, placeholder || '—'));
};

/* ─── Generic DataTable component (enhanced) ─── */
const DataTable = ({
  data,
  columns,
  groupOptions,
  defaultVisibleCols,
  onRowClick,
  renderCell,
  getVal,
  selectedId,
  label,
  selectable,
  onBulkAction,
  bulkActions,
  draggable,
  onReorder,
  onAddRow,
  addRowLabel,
  editable,
  onCellEdit
}) => {
  const [search, setSearch] = useState('');
  const [groupBy, setGroupBy] = useState('none');
  const [sortField, setSortField] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [visibleCols, setVisibleCols] = useState(defaultVisibleCols || columns.map(c => c.key));
  const [colDd, setColDd] = useState(false);
  const [grpDd, setGrpDd] = useState(false);
  // Multi-select
  const [selected, setSelected] = useState(new Set());
  // Drag reorder
  const [dragId, setDragId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const visCols = columns.filter(c => c.fixed || visibleCols.includes(c.key));
  const extraColCount = (selectable ? 1 : 0) + (draggable ? 1 : 0);

  // Filter
  const filtered = data.filter(row => {
    if (!search) return true;
    const s = search.toLowerCase();
    return visCols.some(c => {
      const v = getVal(row, c.key);
      return v && String(v).toLowerCase().includes(s);
    });
  });

  // Sort
  const sorted = [...filtered];
  if (sortField) {
    sorted.sort((a, b) => {
      const va = getVal(a, sortField),
        vb = getVal(b, sortField);
      const cmp = String(va || '').localeCompare(String(vb || ''), undefined, {
        numeric: true
      });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }

  // Group
  let grouped;
  if (groupBy !== 'none') {
    grouped = {};
    sorted.forEach(row => {
      const gk = getVal(row, groupBy) || 'Other';
      if (!grouped[gk]) grouped[gk] = [];
      grouped[gk].push(row);
    });
  } else {
    grouped = {
      '__all': sorted
    };
  }
  const handleSort = key => {
    if (sortField === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');else {
      setSortField(key);
      setSortDir('asc');
    }
  };
  const toggleCol = key => {
    setVisibleCols(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  // Multi-select helpers
  const toggleSelect = (id, e) => {
    e && e.stopPropagation();
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());else setSelected(new Set(filtered.map(r => r.id)));
  };
  const isAllSelected = filtered.length > 0 && selected.size === filtered.length;
  const isSomeSelected = selected.size > 0 && selected.size < filtered.length;

  // Drag handlers
  const handleDragStart = (e, id) => {
    setDragId(id);
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleDragOver = (e, id) => {
    e.preventDefault();
    setDragOverId(id);
  };
  const handleDragEnd = () => {
    if (dragId && dragOverId && dragId !== dragOverId && onReorder) {
      const fromIdx = data.findIndex(r => r.id === dragId);
      const toIdx = data.findIndex(r => r.id === dragOverId);
      if (fromIdx >= 0 && toIdx >= 0) onReorder(fromIdx, toIdx);
    }
    setDragId(null);
    setDragOverId(null);
  };
  return /*#__PURE__*/React.createElement(React.Fragment, null, selectable && selected.size > 0 && /*#__PURE__*/React.createElement("div", {
    className: "dt-bulk-bar"
  }, /*#__PURE__*/React.createElement("span", {
    className: "dt-bulk-count"
  }, selected.size, " selected"), /*#__PURE__*/React.createElement("button", {
    className: "b-gho b-xs",
    onClick: () => setSelected(new Set())
  }, "Clear"), /*#__PURE__*/React.createElement("div", {
    className: "dt-bulk-actions"
  }, (bulkActions || []).map(a => /*#__PURE__*/React.createElement("button", {
    key: a.id,
    className: a.cls || 'b-gho b-xs',
    onClick: () => {
      onBulkAction && onBulkAction(a.id, [...selected]);
      setSelected(new Set());
    }
  }, a.icon && /*#__PURE__*/React.createElement(I, {
    n: a.icon,
    s: 11
  }), a.label)))), /*#__PURE__*/React.createElement("div", {
    className: "dt-toolbar"
  }, /*#__PURE__*/React.createElement("input", {
    className: "dt-search",
    placeholder: `Search ${label || ''}...`,
    value: search,
    onChange: e => setSearch(e.target.value)
  }), groupOptions && /*#__PURE__*/React.createElement("div", {
    className: "dt-dd-wrap"
  }, /*#__PURE__*/React.createElement("button", {
    className: groupBy !== 'none' ? 'b-gho b-sm' : 'b-gho b-sm',
    style: groupBy !== 'none' ? {
      background: 'var(--green-dim)',
      color: 'var(--green)',
      borderColor: 'rgba(61,214,140,.2)'
    } : {},
    onClick: () => {
      setGrpDd(!grpDd);
      setColDd(false);
    }
  }, '≡ ' + (groupBy === 'none' ? 'Group' : (groupOptions.find(g => g.k === groupBy) || {}).l || groupBy)), grpDd && /*#__PURE__*/React.createElement("div", {
    className: "dt-dd"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dt-dd-label"
  }, "Group By"), groupOptions.map(g => /*#__PURE__*/React.createElement("div", {
    key: g.k,
    className: 'dt-dd-item' + (groupBy === g.k ? ' sel' : ''),
    onClick: () => {
      setGroupBy(g.k);
      setGrpDd(false);
    }
  }, g.l)))), /*#__PURE__*/React.createElement("div", {
    className: "dt-dd-wrap"
  }, /*#__PURE__*/React.createElement("button", {
    className: "b-gho b-sm",
    onClick: () => {
      setColDd(!colDd);
      setGrpDd(false);
    }
  }, '⊞ Columns (' + visCols.length + ')'), colDd && /*#__PURE__*/React.createElement("div", {
    className: "dt-dd"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dt-dd-label"
  }, "Toggle Columns"), columns.map(c => {
    const on = c.fixed || visibleCols.includes(c.key);
    return /*#__PURE__*/React.createElement("div", {
      key: c.key,
      className: "dt-dd-item",
      style: c.fixed ? {
        opacity: .5
      } : {},
      onClick: () => !c.fixed && toggleCol(c.key)
    }, /*#__PURE__*/React.createElement("span", {
      className: 'dt-check' + (on ? ' on' : '')
    }, on ? '✓' : ''), c.label, c.fixed ? ' (always)' : '');
  }))), /*#__PURE__*/React.createElement("span", {
    className: "dt-toolbar-right"
  }, filtered.length, " ", label || 'rows')), /*#__PURE__*/React.createElement("div", {
    className: "dt-wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dt-scroll"
  }, /*#__PURE__*/React.createElement("table", {
    className: "dt"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, draggable && /*#__PURE__*/React.createElement("th", {
    style: {
      width: 24,
      padding: '6px 4px'
    }
  }), selectable && /*#__PURE__*/React.createElement("th", {
    className: "dt-sel-col"
  }, /*#__PURE__*/React.createElement("div", {
    className: 'dt-cb' + (isAllSelected ? ' checked' : isSomeSelected ? ' partial' : ''),
    onClick: toggleSelectAll
  }, isAllSelected ? '✓' : isSomeSelected ? '—' : '')), visCols.map(c => /*#__PURE__*/React.createElement("th", {
    key: c.key,
    onClick: () => handleSort(c.key)
  }, c.label, sortField === c.key ? sortDir === 'asc' ? ' ↑' : ' ↓' : '')))), /*#__PURE__*/React.createElement("tbody", null, Object.entries(grouped).map(([gName, rows]) => /*#__PURE__*/React.createElement(React.Fragment, {
    key: gName
  }, gName !== '__all' && /*#__PURE__*/React.createElement("tr", {
    className: "dt-grp"
  }, /*#__PURE__*/React.createElement("td", {
    colSpan: visCols.length + extraColCount
  }, '▾ ' + gName + ' (' + rows.length + ')')), rows.map(row => /*#__PURE__*/React.createElement("tr", {
    key: row.id,
    className: 'dt-row' + (selectedId === row.id ? ' selected' : '') + (row.status === 'revoked' ? ' revoked' : '') + (dragId === row.id ? ' dragging' : '') + (dragOverId === row.id ? ' drag-over' : ''),
    onClick: () => onRowClick && onRowClick(row),
    draggable: draggable ? true : undefined,
    onDragStart: draggable ? e => handleDragStart(e, row.id) : undefined,
    onDragOver: draggable ? e => handleDragOver(e, row.id) : undefined,
    onDragEnd: draggable ? handleDragEnd : undefined
  }, draggable && /*#__PURE__*/React.createElement("td", {
    className: "dt-drag-handle"
  }, "\u283F"), selectable && /*#__PURE__*/React.createElement("td", {
    className: "dt-sel-col"
  }, /*#__PURE__*/React.createElement("div", {
    className: 'dt-cb' + (selected.has(row.id) ? ' checked' : ''),
    onClick: e => toggleSelect(row.id, e)
  }, selected.has(row.id) ? '✓' : '')), visCols.map(col => /*#__PURE__*/React.createElement("td", {
    key: col.key
  }, editable && col.editable ? /*#__PURE__*/React.createElement(EditableCell, {
    value: getVal(row, col.key),
    placeholder: col.placeholder,
    onSave: v => onCellEdit && onCellEdit(row, col.key, v)
  }) : renderCell(row, col))))))))), onAddRow && /*#__PURE__*/React.createElement("div", {
    className: "dt-add-row",
    onClick: onAddRow
  }, "+ ", addRowLabel || 'Add row'))));
};

/* ─── Individual Side Panel ─── */
const IndividualPanel = ({
  row,
  notes,
  allocations,
  onClose,
  panelTab,
  setPanelTab,
  provenanceField,
  setProvenanceField,
  svc,
  onRestoreField
}) => {
  if (!row) return null;
  const indNotes = (notes || []).filter(n => n.indId === row.id);
  const indAllocs = (allocations || []).filter(a => a.indId === row.id);

  // ─── Load field EO change history from bridge room timeline ───
  const [fieldHistories, setFieldHistories] = React.useState({});
  React.useEffect(() => {
    if (!svc || !row.bridgeRoom) { setFieldHistories({}); return; }
    let cancelled = false;
    const load = async () => {
      try {
        const room = svc.client && svc.client.getRoom(row.bridgeRoom);
        if (!room) return;
        // Paginate backwards to capture history
        for (let i = 0; i < 3; i++) {
          const token = room.getLiveTimeline().getPaginationToken('b');
          if (!token) break;
          try { await svc.client.scrollback(room, 100); } catch (e) { break; }
        }
        const events = [];
        const timelineSets = room.getTimelineSets ? room.getTimelineSets() : [];
        if (timelineSets.length > 0) {
          const seen = new Set();
          for (const ts of timelineSets) {
            for (const tl of ts.getTimelines()) {
              for (const ev of tl.getEvents()) {
                if (!seen.has(ev.getId())) { seen.add(ev.getId()); events.push(ev); }
              }
            }
          }
        } else {
          for (const ev of room.getLiveTimeline().getEvents()) events.push(ev);
        }
        const hist = {};
        events.forEach(ev => {
          if (ev.getType && ev.getType() === EVT.OP) {
            const c = ev.getContent();
            if (c.target && c.target.startsWith('org.individuals.') && (c.op === 'ALT' || c.op === 'INS')) {
              const parts = c.target.split('.');
              const fieldKey = parts[2];
              if (fieldKey && fieldKey !== row.id) { // skip individual-level ops (roomId as fieldKey)
                if (!hist[fieldKey]) hist[fieldKey] = [];
                hist[fieldKey].push({ eo_op: c.op, from: c.operand?.from, to: c.operand?.to, at: c.ts || ev.getTs(), by: (c.created_by || ev.getSender() || '').split(':')[0]?.replace('@','') || '?' });
              }
            }
          }
        });
        // Sort each field history newest-first
        Object.keys(hist).forEach(k => hist[k].sort((a, b) => (b.at || 0) - (a.at || 0)));
        if (!cancelled) setFieldHistories(hist);
      } catch (e) { /* history load failed silently */ }
    };
    load();
    // Also refresh on new EO events
    const handler = e => { if (e.detail?.roomId === row.bridgeRoom) load(); };
    window.addEventListener('khora:eo', handler);
    return () => { cancelled = true; window.removeEventListener('khora:eo', handler); };
  }, [row.bridgeRoom, svc]);
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "dt-panel-overlay",
    onClick: onClose
  }), /*#__PURE__*/React.createElement("div", {
    className: "dt-panel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dt-panel-head"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", null, row.name || row.alias || 'Unknown'), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      alignItems: 'center',
      marginTop: 6,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement(DtStatusBadge, {
    status: row.status
  }), /*#__PURE__*/React.createElement(DtDiscBar, {
    level: row.disclosureLevel || 0
  }), /*#__PURE__*/React.createElement(DtRoom, {
    room: row.bridgeRoom
  }))), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      fontSize: 20,
      color: 'var(--tx-2)'
    }
  }, "\u2715")), /*#__PURE__*/React.createElement("div", {
    className: "dt-panel-tabs"
  }, ['fields', 'notes', 'allocations'].map(t => /*#__PURE__*/React.createElement("button", {
    key: t,
    className: 'dt-panel-tab' + (panelTab === t ? ' active' : ''),
    onClick: () => setPanelTab(t)
  }, t === 'fields' ? 'Fields' : t === 'notes' ? `Notes (${indNotes.length})` : `Allocations (${indAllocs.length})`))), /*#__PURE__*/React.createElement("div", {
    className: "dt-panel-body"
  }, panelTab === 'fields' && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "Schema Fields \u2014 click for provenance"), Object.entries(row.fields || {}).map(([key, f]) => /*#__PURE__*/React.createElement(React.Fragment, {
    key: key
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '10px 12px',
      borderRadius: 'var(--r)',
      border: '1px solid var(--border-0)',
      marginBottom: 6,
      cursor: 'pointer',
      background: provenanceField === key ? 'var(--green-dim)' : 'var(--bg-2)',
      transition: 'all .15s'
    },
    onClick: () => setProvenanceField(provenanceField === key ? null : key)
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '.05em',
      color: 'var(--tx-2)'
    }
  }, key.replace(/_/g, ' ')), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 4
    }
  }, f.eo_op && /*#__PURE__*/React.createElement(DtEo, {
    op: f.eo_op
  }), f.frame && /*#__PURE__*/React.createElement("span", {
    className: "dt-eo",
    style: {
      background: f.frame === 'GIVEN' ? 'var(--teal-dim)' : 'var(--gold-dim)',
      color: f.frame === 'GIVEN' ? 'var(--teal)' : 'var(--gold)'
    }
  }, f.frame), f.room && /*#__PURE__*/React.createElement("span", {
    className: "dt-eo"
  }, f.room))), f.disclosed === false ? /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 4
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "dt-locked"
  }, /*#__PURE__*/React.createElement(DtLock, null), " not disclosed")) : /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 4,
      fontSize: 14,
      fontWeight: 500
    }
  }, f.value || '—')), provenanceField === key && f.disclosed !== false && /*#__PURE__*/React.createElement("div", {
    className: "dt-gm"
  }, f.given && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "g"
  }, "GIVEN: "), f.given), f.meant && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 3
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "m"
  }, "MEANT: "), f.meant), f.source && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 6,
      fontSize: 11
    }
  }, /*#__PURE__*/React.createElement("strong", null, "Source: "), f.source, " \xB7 ", /*#__PURE__*/React.createElement("strong", null, "Confidence: "), f.confidence), (() => {
  const hist = [...(f.history || []), ...(fieldHistories[key] || [])].sort((a, b) => (b.at || 0) - (a.at || 0));
  if (hist.length === 0) return null;
  return React.createElement(React.Fragment, null,
    React.createElement("div", { style: { marginTop: 10, marginBottom: 6 } },
      React.createElement("span", { className: "section-label" }, "CHANGE HISTORY")),
    hist.map((evt, i) => React.createElement("div", {
      key: i,
      style: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--tx-1)', padding: '5px 0', borderBottom: '1px solid var(--border-0)', flexWrap: 'wrap' }
    },
      React.createElement(DtEo, { op: evt.eo_op || 'ALT' }),
      React.createElement("span", { style: { fontWeight: 500, minWidth: 55, flexShrink: 0 } }, dtFmtDate(evt.at)),
      React.createElement("span", { style: { color: 'var(--tx-2)', fontSize: 11, flexShrink: 0 } }, evt.by || evt.type || ''),
      (evt.from !== undefined || evt.to !== undefined) && React.createElement("span", {
        style: { fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--tx-3)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
      }, evt.from != null ? String(evt.from).slice(0, 24) : '\u2205', ' \u2192 ', evt.to != null ? String(evt.to).slice(0, 24) : '\u2205'),
      onRestoreField && evt.to != null && React.createElement("button", {
        className: 'b-gho',
        style: { fontSize: 10, padding: '2px 7px', marginLeft: 'auto', whiteSpace: 'nowrap', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 3 },
        title: 'Restore to: ' + String(evt.to).slice(0, 50),
        onClick: e => { e.stopPropagation(); onRestoreField(key, evt.to); }
      }, React.createElement(I, { n: 'check', s: 9 }), 'Restore')
    ))
  );
})())))))), panelTab === 'notes' && /*#__PURE__*/React.createElement(React.Fragment, null, (() => {
    const shared = indNotes.filter(n => n.type === 'shared');
    const internal = indNotes.filter(n => n.type === 'internal');
    return /*#__PURE__*/React.createElement(React.Fragment, null, shared.length > 0 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
      className: "section-label"
    }, "Shared Notes (bridge room \u2014 individual can see)"), shared.map(n => /*#__PURE__*/React.createElement("div", {
      key: n.id,
      className: "dt-note shared"
    }, /*#__PURE__*/React.createElement("div", {
      className: "dt-note-meta"
    }, /*#__PURE__*/React.createElement("strong", null, n.author), /*#__PURE__*/React.createElement("span", null, dtFmtDate(n.at)), /*#__PURE__*/React.createElement(DtEo, {
      op: n.eo_op || 'INS'
    }), /*#__PURE__*/React.createElement("span", {
      className: "dt-eo",
      style: {
        background: 'var(--green-dim)',
        color: 'var(--green)'
      }
    }, n.frame || 'GIVEN'), n.category && /*#__PURE__*/React.createElement("span", {
      className: "tag tag-purple",
      style: {
        fontSize: 9
      }
    }, n.category)), /*#__PURE__*/React.createElement("div", {
      className: "dt-note-text"
    }, n.text), n.tags && n.tags.length > 0 && /*#__PURE__*/React.createElement("div", {
      className: "dt-note-tags"
    }, n.tags.map(t => /*#__PURE__*/React.createElement("span", {
      key: t,
      className: "dt-note-tag"
    }, t)))))), internal.length > 0 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
      className: "section-label",
      style: {
        marginTop: 16
      }
    }, "Internal Notes (roster room \u2014 org-only, individual CANNOT see)"), internal.map(n => /*#__PURE__*/React.createElement("div", {
      key: n.id,
      className: "dt-note internal"
    }, /*#__PURE__*/React.createElement("div", {
      className: "dt-note-meta"
    }, /*#__PURE__*/React.createElement("strong", null, n.author), /*#__PURE__*/React.createElement("span", null, dtFmtDate(n.at)), /*#__PURE__*/React.createElement(DtEo, {
      op: n.eo_op || 'INS'
    }), /*#__PURE__*/React.createElement("span", {
      className: "dt-eo",
      style: {
        background: 'var(--gold-dim)',
        color: 'var(--gold)'
      }
    }, n.frame || 'MEANT'), n.category && /*#__PURE__*/React.createElement("span", {
      className: "tag tag-purple",
      style: {
        fontSize: 9
      }
    }, n.category), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 10,
        color: 'var(--gold)'
      }
    }, " internal")), /*#__PURE__*/React.createElement("div", {
      className: "dt-note-text"
    }, n.text), n.tags && n.tags.length > 0 && /*#__PURE__*/React.createElement("div", {
      className: "dt-note-tags"
    }, n.tags.map(t => /*#__PURE__*/React.createElement("span", {
      key: t,
      className: "dt-note-tag"
    }, t)))))), indNotes.length === 0 && /*#__PURE__*/React.createElement("div", {
      style: {
        padding: '40px 0',
        textAlign: 'center',
        color: 'var(--tx-3)'
      }
    }, "No notes recorded."), /*#__PURE__*/React.createElement("div", {
      className: "dt-hint"
    }, /*#__PURE__*/React.createElement("strong", null, "Privacy logic: "), "Shared notes emit ", /*#__PURE__*/React.createElement(DtEo, {
      op: "INS"
    }), " in the ", /*#__PURE__*/React.createElement("strong", null, "bridge room"), " \u2192 encrypted via Megolm + per-field AES-256-GCM \u2192 client + provider can read. Internal notes emit ", /*#__PURE__*/React.createElement(DtEo, {
      op: "INS"
    }), " in the ", /*#__PURE__*/React.createElement("strong", null, "roster room"), " \u2192 only org team members can read."));
  })()), panelTab === 'allocations' && /*#__PURE__*/React.createElement(React.Fragment, null, indAllocs.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '40px 0',
      textAlign: 'center',
      color: 'var(--tx-3)'
    }
  }, "No allocations recorded.") : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "Resources Received (dual-write: bridge + vault shadow)"), indAllocs.map(a => {
    const stCls = a.status === 'active' ? 'tag-green' : a.status === 'consumed' ? 'tag-purple' : 'tag-gold';
    return /*#__PURE__*/React.createElement("div", {
      key: a.id,
      className: "dt-alloc"
    }, /*#__PURE__*/React.createElement("div", {
      className: "dt-alloc-header"
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      className: "dt-alloc-title"
    }, a.resourceName), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11,
        color: 'var(--tx-2)',
        marginTop: 2
      }
    }, a.quantity, " ", a.unit, " \xB7 ", a.org)), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 4,
        alignItems: 'center'
      }
    }, /*#__PURE__*/React.createElement(DtEo, {
      op: a.eo_op || 'CON'
    }), /*#__PURE__*/React.createElement("span", {
      className: 'tag ' + stCls,
      style: {
        fontSize: 10
      }
    }, a.status))), /*#__PURE__*/React.createElement("div", {
      className: "dt-alloc-detail"
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("strong", null, "By: "), a.allocatedBy), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("strong", null, "Date: "), dtFmtDate(a.at)), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("strong", null, "Bridge: "), /*#__PURE__*/React.createElement(DtRoom, {
      room: a.bridgeRoom
    })), a.expiresAt && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("strong", null, "Expires: "), a.expiresAt)), a.constraintsChecked && a.constraintsChecked.length > 0 && /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 8,
        fontSize: 11,
        color: 'var(--tx-1)'
      }
    }, /*#__PURE__*/React.createElement("strong", null, "Constraints verified: "), a.constraintsChecked.map(c => /*#__PURE__*/React.createElement("span", {
      key: c,
      style: {
        display: 'inline-block',
        padding: '1px 6px',
        borderRadius: 5,
        background: 'var(--green-dim)',
        color: 'var(--green)',
        fontSize: 10,
        marginRight: 3,
        marginBottom: 2
      }
    }, c))), a.vaultShadow && /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 8,
        padding: '8px 10px',
        borderRadius: 'var(--r)',
        background: 'var(--bg-3)',
        border: '1px solid var(--border-0)',
        fontSize: 11,
        color: 'var(--tx-2)'
      }
    }, /*#__PURE__*/React.createElement("strong", null, "Vault shadow: "), "\"", a.vaultShadow.resource_name, "\" from ", a.vaultShadow.org, " \u2014 denormalized, survives bridge severance"), a.events && a.events.length > 0 && /*#__PURE__*/React.createElement("div", {
      className: "dt-alloc-events"
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 10,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '.06em',
        color: 'var(--tx-2)',
        marginBottom: 4
      }
    }, "Lifecycle Events"), a.events.map((evt, i) => /*#__PURE__*/React.createElement("div", {
      key: i,
      className: "dt-alloc-event"
    }, /*#__PURE__*/React.createElement("span", {
      className: "dot",
      style: {
        background: evt.event === 'allocated' ? 'var(--green)' : evt.event === 'consumed' ? 'var(--tx-3)' : 'var(--gold)'
      }
    }), /*#__PURE__*/React.createElement(DtEo, {
      op: evt.eo_op || 'ALT'
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontWeight: 500
      }
    }, evt.event), /*#__PURE__*/React.createElement("span", null, dtFmtDate(evt.at)), /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--tx-3)',
        fontSize: 11,
        marginLeft: 'auto'
      }
    }, evt.note)))));
  }), /*#__PURE__*/React.createElement("div", {
    className: "dt-hint"
  }, /*#__PURE__*/React.createElement("strong", null, "Allocation logic: "), "Every allocation emits ", /*#__PURE__*/React.createElement(DtEo, {
    op: "CON"
  }), " (\u22C8 connecting individual to resource). Status changes emit ", /*#__PURE__*/React.createElement(DtEo, {
    op: "ALT"
  }), " (\u223F). Revocations emit ", /*#__PURE__*/React.createElement(DtEo, {
    op: "NUL"
  }), " (\u2205). The bridge room gets the live record; the vault gets a denormalized shadow copy."))));
};

/* ─── Resource Side Panel ─── */
const ResourcePanel = ({
  row,
  allocations,
  onClose,
  panelTab,
  setPanelTab
}) => {
  if (!row) return null;
  const resAllocs = (allocations || []).filter(a => a.resourceId === row.id);
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "dt-panel-overlay",
    onClick: onClose
  }), /*#__PURE__*/React.createElement("div", {
    className: "dt-panel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dt-panel-head"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", null, row.name), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      alignItems: 'center',
      marginTop: 6,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: 'tag tag-' + (RESOURCE_CATEGORY_COLORS[row.category] || 'teal'),
    style: {
      fontSize: 10
    }
  }, RESOURCE_CATEGORY_LABELS[row.category] || row.category), row.relation && /*#__PURE__*/React.createElement("span", {
    className: "tag tag-gold",
    style: {
      fontSize: 10
    }
  }, row.relation), row.opacityLevel && (() => {
    const o = DT_OP_CFG[row.opacityLevel];
    return o ? /*#__PURE__*/React.createElement("span", {
      className: 'tag ' + o.cls,
      style: {
        fontSize: 10
      }
    }, o.l) : null;
  })(), /*#__PURE__*/React.createElement(DtRoom, {
    room: row.orgRoom
  }))), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      fontSize: 20,
      color: 'var(--tx-2)'
    }
  }, "\u2715")), /*#__PURE__*/React.createElement("div", {
    className: "dt-panel-tabs"
  }, ['details', 'provisioning', 'allocations'].map(t => /*#__PURE__*/React.createElement("button", {
    key: t,
    className: 'dt-panel-tab' + (panelTab === t ? ' active' : ''),
    onClick: () => setPanelTab(t)
  }, t === 'details' ? 'Details' : t === 'provisioning' ? 'Provisioning' : `Allocations (${resAllocs.length})`))), /*#__PURE__*/React.createElement("div", {
    className: "dt-panel-body"
  }, panelTab === 'details' && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "dt-cap"
  }, [{
    n: row.available || 0,
    l: 'Available',
    c: 'var(--green)'
  }, {
    n: row.allocated || 0,
    l: 'Allocated',
    c: 'var(--teal)'
  }, {
    n: row.reserved || 0,
    l: 'Reserved',
    c: 'var(--gold)'
  }, {
    n: row.totalCapacity || 0,
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
    pct: row.utilizationPct || 0
  })), /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "Details"), /*#__PURE__*/React.createElement("div", {
    className: "dt-field-grid"
  }, [{
    k: 'Holder',
    v: (row.holder || '—') + ' (' + (row.holderType || 'org') + ')'
  }, {
    k: 'Relation',
    v: row.relation || '—'
  }, {
    k: 'Network',
    v: row.network || '—'
  }, {
    k: 'Governance',
    v: row.governance || '—'
  }, {
    k: 'Updated',
    v: dtFmtDate(row.lastUpdated)
  }].map(({
    k,
    v
  }) => /*#__PURE__*/React.createElement(React.Fragment, {
    key: k
  }, /*#__PURE__*/React.createElement("div", {
    className: "dt-field-key"
  }, k), /*#__PURE__*/React.createElement("div", null, v)))), row.constraints && row.constraints.length > 0 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
    className: "section-label",
    style: {
      marginTop: 12
    }
  }, "Constraints (with governance provenance)"), row.constraints.map((c, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      padding: '6px 10px',
      borderRadius: 'var(--r)',
      border: '1px solid var(--border-0)',
      marginBottom: 4,
      fontSize: 12,
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--green)'
    }
  }, "\u2713"), c, /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 'auto',
      fontSize: 10,
      color: 'var(--tx-3)',
      fontStyle: 'italic'
    }
  }, row.governance))))), panelTab === 'provisioning' && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "Provisioning Timeline (org room events)"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 12,
      padding: '8px 10px',
      borderRadius: 'var(--r)',
      background: 'var(--bg-3)',
      fontSize: 11,
      color: 'var(--tx-2)'
    }
  }, "These events live in ", /*#__PURE__*/React.createElement(DtRoom, {
    room: row.orgRoom
  }), ". Individual identities are NOT in these events \u2014 only bridge room references. Inventory = total - allocated - reserved."), (row.provisioningEvents || []).map((evt, i) => {
    const color = DT_PROV_COLORS[evt.event] || 'var(--tx-2)';
    const icon = evt.event === 'restocked' ? '↑' : evt.event === 'allocated' ? '→' : evt.event === 'returned' ? '←' : evt.event === 'expired' ? '⏱' : evt.event.includes('capacity') ? '⚡' : '✓';
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      className: "dt-prov"
    }, /*#__PURE__*/React.createElement("div", {
      className: "dt-prov-icon",
      style: {
        background: color + '18',
        color
      }
    }, icon), /*#__PURE__*/React.createElement("div", {
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
        marginTop: 2,
        fontSize: 12,
        color: 'var(--tx-1)'
      }
    }, evt.detail), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11,
        color: 'var(--tx-3)'
      }
    }, dtFmtDate(evt.at), " \xB7 ", evt.by)));
  }), (!row.provisioningEvents || row.provisioningEvents.length === 0) && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '40px 0',
      textAlign: 'center',
      color: 'var(--tx-3)'
    }
  }, "No provisioning events recorded."), /*#__PURE__*/React.createElement("div", {
    className: "dt-hint"
  }, /*#__PURE__*/React.createElement("strong", null, "Provisioning logic: "), "Capacity changes emit ", /*#__PURE__*/React.createElement(DtEo, {
    op: "ALT"
  }), " (\u223F) or ", /*#__PURE__*/React.createElement(DtEo, {
    op: "NUL"
  }), " (\u2205). New funding emits ", /*#__PURE__*/React.createElement(DtEo, {
    op: "INS"
  }), " (\u25B3). Allocations emit ", /*#__PURE__*/React.createElement(DtEo, {
    op: "CON"
  }), " (\u22C8). All events carry full provenance.")), panelTab === 'allocations' && /*#__PURE__*/React.createElement(React.Fragment, null, resAllocs.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '40px 0',
      textAlign: 'center',
      color: 'var(--tx-3)'
    }
  }, "No allocations from this resource.") : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "Allocations from this resource (anonymized in org view)"), resAllocs.map(a => /*#__PURE__*/React.createElement("div", {
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
  }, a.status))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: 'var(--tx-2)',
      marginTop: 4
    }
  }, "Bridge: ", /*#__PURE__*/React.createElement(DtRoom, {
    room: a.bridgeRoom
  }), " \xB7 By: ", a.allocatedBy))), /*#__PURE__*/React.createElement("div", {
    className: "dt-hint"
  }, /*#__PURE__*/React.createElement("strong", null, "Privacy note: "), "In production, this panel shows bridge room references, not individual names, unless the viewer has access to each bridge. Names resolve only for bridges you're a member of."))))));
};

/* ─── NoteCreateModal — create a note (attached or unattached) ─── */
/* On mobile (<=700px) renders as full-screen sheet for fast field entry */
const NoteCreateModal = ({
  open,
  onClose,
  individuals,
  staff,
  svc,
  rosterRoom,
  onSave,
  showToast,
  T,
  initialAttachTo,
  teamContext
}) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [attachTo, setAttachTo] = useState(''); // bridgeRoomId or ''
  const [tags, setTags] = useState([]); // [{userId, displayName}]
  const [tagSearch, setTagSearch] = useState('');
  const [tagDd, setTagDd] = useState(false);
  const [moreOptions, setMoreOptions] = useState(false);
  const isMobile = useIsMobile();
  const titleRef = useRef(null);

  useEffect(() => {
    if (open) {
      setAttachTo(initialAttachTo || '');
      setMoreOptions(!!initialAttachTo); // auto-expand if pre-attached
      // Auto-focus title on mobile after animation
      if (isMobile) setTimeout(() => titleRef.current?.focus(), 300);
    }
  }, [open, initialAttachTo]);

  const authorName = (() => {
    const me = (staff||[]).find(s => s.userId === svc.userId);
    if (me) return me.display_name || svc.userId?.split(':')[0]?.replace('@','') || 'Unknown';
    return svc.userId?.split(':')[0]?.replace('@','') || 'Unknown';
  })();

  if (!open) return null;
  const allPeople = [...(staff || []).map(s => ({
    userId: s.userId,
    displayName: s.display_name || s.userId?.split(':')[0]?.replace('@', '') || T.staff_term
  })), ...(individuals || []).map(ind => ({
    userId: ind._case?.clientUserId || ind.id,
    displayName: ind.name || 'Unknown'
  }))].filter((p, i, arr) => arr.findIndex(x => x.userId === p.userId) === i);
  const filteredPeople = allPeople.filter(p => !tags.find(t => t.userId === p.userId) && (p.displayName || '').toLowerCase().includes(tagSearch.toLowerCase()));
  const handleSave = async () => {
    if (!title.trim() && !content.trim()) return;
    const noteData = {
      id: 'note_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      title: title.trim(),
      content: content.trim(),
      attached_to: attachTo || null,
      tags: tags,
      author: svc.userId,
      created: Date.now(),
      updated: Date.now(),
      tombstoned: false,
      ...(teamContext ? { team_id: teamContext.roomId, team_name: teamContext.name } : {})
    };
    try {
      const targetRoom = attachTo || rosterRoom;
      if (targetRoom) {
        await svc.sendEvent(targetRoom, EVT.NOTE, noteData);
        if (attachTo && rosterRoom) {
          await svc.sendEvent(rosterRoom, EVT.NOTE_REF, {
            note_id: noteData.id,
            subject_room: attachTo,
            title: noteData.title,
            attached_to: attachTo,
            author: svc.userId,
            created: noteData.created
          });
        }
      }
      // Emit EO operation to track note creation in the action log
      try {
        await emitOp(targetRoom, 'INS', dot(attachTo ? 'bridge' : 'roster', 'notes', noteData.id), {
          note_id: noteData.id,
          attached_to: attachTo || undefined,
          author: svc.userId
        }, {
          type: attachTo ? 'bridge' : 'roster',
          room: targetRoom,
          role: 'provider',
          epistemic: 'MEANT'
        });
      } catch (oe) {
        console.warn('Note EO event failed:', oe.message);
      }
      onSave && onSave(noteData);
      showToast && showToast('Note created', 'success');
      setTitle('');
      setContent('');
      setAttachTo('');
      setTags([]);
      setTagSearch('');
      setMoreOptions(false);
      onClose();
    } catch (e) {
      showToast && showToast('Failed to create note: ' + e.message, 'error');
    }
  };

  /* ── Shared form fields: attach-to, created-by, tag people ── */
  const renderAttachTo = () => /*#__PURE__*/React.createElement("div", {
    style: { marginBottom: 14 }
  }, initialAttachTo ? /*#__PURE__*/React.createElement(React.Fragment, null,
    /*#__PURE__*/React.createElement("span", { className: "section-label" },
      "ATTACHED TO ", T?.client_term?.toUpperCase() || 'INDIVIDUAL'),
    /*#__PURE__*/React.createElement("div", {
      style: { fontSize: 14, fontWeight: 600, color: 'var(--tx-0)', padding: '8px 12px',
        background: 'var(--bg-2)', borderRadius: 'var(--r)', border: '1px solid var(--border-0)', marginTop: 4 }
    }, (individuals || []).find(i => i.id === initialAttachTo)?.name || initialAttachTo),
    /*#__PURE__*/React.createElement("div", {
      style: { fontSize: 10, color: 'var(--tx-2)', marginTop: 4 }
    }, "Stored in the individual\u2019s bridge room \u2014 they can see and control this note.")
  ) : /*#__PURE__*/React.createElement(React.Fragment, null,
    /*#__PURE__*/React.createElement("span", { className: "section-label" },
      "ATTACH TO ", T?.client_term?.toUpperCase() || 'INDIVIDUAL', " (OPTIONAL)"),
    /*#__PURE__*/React.createElement("select", {
      value: attachTo, onChange: e => setAttachTo(e.target.value), style: { width: '100%' }
    }, /*#__PURE__*/React.createElement("option", { value: "" }, "Standalone (not attached)"),
      (individuals || []).map(ind => /*#__PURE__*/React.createElement("option", {
        key: ind.id, value: ind.id
      }, ind.name || ind.id))),
    /*#__PURE__*/React.createElement("div", {
      style: { fontSize: 10, color: 'var(--tx-2)', marginTop: 4 }
    }, attachTo ? 'Stored in the individual\'s bridge room \u2014 they can see and control this note.' : 'Stored in your roster room \u2014 internal to your organization.')
  ));

  const renderCreatedBy = () => /*#__PURE__*/React.createElement("div", {
    style: { marginBottom: 14 }
  }, /*#__PURE__*/React.createElement("span", { className: "section-label" }, "CREATED BY"),
    /*#__PURE__*/React.createElement("div", {
      style: { fontSize: 13, color: 'var(--tx-1)', padding: '8px 12px',
        background: 'var(--bg-2)', borderRadius: 'var(--r)', border: '1px solid var(--border-0)', marginTop: 4,
        display: 'flex', alignItems: 'center', gap: 8 }
    }, /*#__PURE__*/React.createElement("span", {
      style: { width: 20, height: 20, borderRadius: '50%', background: 'var(--purple-dim)', color: 'var(--purple)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, flexShrink: 0 }
    }, authorName[0].toUpperCase()), authorName));

  const renderTags = () => /*#__PURE__*/React.createElement("div", {
    style: { marginBottom: 18 }
  }, /*#__PURE__*/React.createElement("span", { className: "section-label" }, "TAG PEOPLE"),
    /*#__PURE__*/React.createElement("div", { style: { position: 'relative' } },
      /*#__PURE__*/React.createElement("input", {
        value: tagSearch,
        onChange: e => { setTagSearch(e.target.value); setTagDd(true); },
        onFocus: () => setTagDd(true),
        placeholder: "Search people to tag...",
        style: { marginBottom: tags.length ? 6 : 0 }
      }),
      tagDd && tagSearch && filteredPeople.length > 0 && /*#__PURE__*/React.createElement("div", {
        className: "dt-dd",
        style: { position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200 }
      }, filteredPeople.slice(0, 8).map(p => /*#__PURE__*/React.createElement("div", {
        key: p.userId, className: "dt-dd-item",
        onClick: () => { setTags(prev => [...prev, p]); setTagSearch(''); setTagDd(false); }
      }, /*#__PURE__*/React.createElement("span", {
        style: { width: 20, height: 20, borderRadius: '50%', background: 'var(--purple-dim)', color: 'var(--purple)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, flexShrink: 0 }
      }, (p.displayName || '?')[0].toUpperCase()), p.displayName,
        /*#__PURE__*/React.createElement("span", {
          style: { fontSize: 9, color: 'var(--tx-3)', fontFamily: 'var(--mono)', marginLeft: 'auto' }
        }, p.userId?.split(':')[0]?.replace('@', '')))))),
    tags.length > 0 && /*#__PURE__*/React.createElement("div", { className: "note-tags" },
      tags.map(t => /*#__PURE__*/React.createElement("span", {
        key: t.userId, className: "note-tag-chip",
        onClick: () => setTags(prev => prev.filter(x => x.userId !== t.userId)),
        style: { cursor: 'pointer' }
      }, t.displayName, " \u2715"))));

  /* ── Mobile full-screen sheet ── */
  if (isMobile) {
    return /*#__PURE__*/React.createElement("div", { className: "note-sheet-mobile" },
      /* Header with close + save */
      /*#__PURE__*/React.createElement("div", { className: "note-sheet-header" },
        /*#__PURE__*/React.createElement("button", {
          onClick: onClose, className: "b-gho b-sm",
          style: { display: 'flex', alignItems: 'center', gap: 4 }
        }, /*#__PURE__*/React.createElement(I, { n: "x", s: 16 }), "Close"),
        /*#__PURE__*/React.createElement("button", {
          onClick: handleSave, className: "b-pri b-sm",
          disabled: !title.trim() && !content.trim(),
          style: { display: 'flex', alignItems: 'center', gap: 4 }
        }, /*#__PURE__*/React.createElement(I, { n: "check", s: 14 }), "Save")
      ),
      /* Body */
      /*#__PURE__*/React.createElement("div", { className: "note-sheet-body" },
        /*#__PURE__*/React.createElement("input", {
          ref: titleRef,
          className: "note-sheet-title",
          value: title,
          onChange: e => setTitle(e.target.value),
          placeholder: "Note title...",
          type: "text",
          enterKeyHint: "next"
        }),
        /*#__PURE__*/React.createElement("textarea", {
          value: content,
          onChange: e => setContent(e.target.value),
          placeholder: "Write your note...",
          enterKeyHint: "done"
        }),
        /* Expandable more options */
        /*#__PURE__*/React.createElement("button", {
          className: "note-sheet-expand-toggle",
          onClick: () => setMoreOptions(!moreOptions)
        }, /*#__PURE__*/React.createElement("span", { style: { display: 'inline-flex', transition: 'transform .2s', transform: moreOptions ? 'rotate(180deg)' : 'rotate(0)' } },
            /*#__PURE__*/React.createElement(I, { n: "chevronDown", s: 14 })),
          moreOptions ? "Hide options" : "More options",
          (attachTo || tags.length > 0) && /*#__PURE__*/React.createElement("span", {
            style: { fontSize: 10, color: 'var(--gold)', marginLeft: 4 }
          }, attachTo ? '\u2022 Attached' : '', tags.length ? ` \u2022 ${tags.length} tagged` : '')
        ),
        moreOptions && /*#__PURE__*/React.createElement("div", { className: "note-sheet-expand" },
          renderAttachTo(),
          renderCreatedBy(),
          renderTags()
        )
      )
    );
  }

  /* ── Desktop modal ── */
  return /*#__PURE__*/React.createElement(Modal, {
    open: open, onClose: onClose, title: "New Note", w: 560
  },
    /*#__PURE__*/React.createElement("div", { style: { marginBottom: 14 } },
      /*#__PURE__*/React.createElement("span", { className: "section-label" }, "TITLE"),
      /*#__PURE__*/React.createElement("input", {
        value: title, onChange: e => setTitle(e.target.value), placeholder: "Note title..."
      })),
    /*#__PURE__*/React.createElement("div", { style: { marginBottom: 14 } },
      /*#__PURE__*/React.createElement("span", { className: "section-label" }, "CONTENT"),
      /*#__PURE__*/React.createElement("textarea", {
        value: content, onChange: e => setContent(e.target.value),
        placeholder: "Write your note...", style: { minHeight: 100 }
      })),
    renderAttachTo(),
    renderCreatedBy(),
    renderTags(),
    /*#__PURE__*/React.createElement("button", {
      onClick: handleSave, className: "b-pri",
      disabled: !title.trim() && !content.trim(),
      style: { width: '100%', padding: 12, fontSize: 14 }
    }, "Save Note"));
};

/* ─── NoteDetailModal — view/edit a note with auditable edit history ─── */
/* Edits require an explicit "Save" click (no character-level spam).
   Each save emits a NOTE_EDIT timeline event and an ALT EO operation,
   recording who, when, and what changed. Edit history renders inline
   diffs with crossed-through old text and highlighted new text. */
const NoteDetailModal = ({ note, open, onClose, onSave, svc, staff, rosterRoom, showToast, T }) => {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (open && note) {
      setEditing(false);
      setEditTitle(note.title || '');
      setEditContent(note.content || note.text || '');
    }
  }, [open, note?.id]);

  if (!open || !note) return null;

  const authorName = (() => {
    const uid = note.author || '';
    const s = (staff || []).find(st => st.userId === uid);
    if (s) return s.display_name || uid.split(':')[0]?.replace('@', '') || 'Unknown';
    return uid.split(':')[0]?.replace('@', '') || 'Unknown';
  })();

  const getDisplayName = uid => {
    const s = (staff || []).find(st => st.userId === uid);
    if (s) return s.display_name || uid.split(':')[0]?.replace('@', '') || 'Unknown';
    return (uid || '').split(':')[0]?.replace('@', '') || 'Unknown';
  };

  const titleChanged = editTitle.trim() !== (note.title || '').trim();
  const contentChanged = editContent.trim() !== (note.content || note.text || '').trim();
  const hasChanges = titleChanged || contentChanged;

  const handleSave = async () => {
    if (!hasChanges || saving) return;
    setSaving(true);
    try {
      const editData = {
        note_id: note.id,
        title: editTitle.trim(),
        content: editContent.trim(),
        prev_title: note.title || '',
        prev_content: note.content || note.text || '',
        edited_by: svc.userId,
        edited_at: Date.now()
      };
      const targetRoom = note._sourceRoom || note.attached_to || rosterRoom;
      if (targetRoom) {
        await svc.sendEvent(targetRoom, EVT.NOTE_EDIT, editData);
        // Emit ALT EO operation for audit trail
        try {
          const changes = {};
          if (titleChanged) changes.title = { from: editData.prev_title, to: editData.title };
          if (contentChanged) changes.content = { from: editData.prev_content, to: editData.content };
          await emitOp(targetRoom, 'ALT', dot(note.attached_to ? 'bridge' : 'roster', 'notes', note.id), {
            note_id: note.id,
            changes: changes,
            edited_by: svc.userId
          }, {
            type: note.attached_to ? 'bridge' : 'roster',
            room: targetRoom,
            role: 'provider',
            epistemic: 'MEANT'
          });
        } catch (oe) {
          console.warn('Note edit EO event failed:', oe.message);
        }
      }
      onSave && onSave(editData);
      showToast && showToast('Note updated', 'success');
      setEditing(false);
    } catch (e) {
      showToast && showToast('Failed to save edit: ' + e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  /* ── Inline word-level diff renderer ── */
  const renderDiff = (oldText, newText) => {
    if (!oldText && !newText) return null;
    if (oldText === newText) return null;
    const oldWords = (oldText || '').split(/(\s+)/);
    const newWords = (newText || '').split(/(\s+)/);
    // Simple LCS-based word diff
    const m = oldWords.length, n = newWords.length;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] = oldWords[i - 1] === newWords[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
    const parts = [];
    let i = m, j = n;
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && oldWords[i - 1] === newWords[j - 1]) {
        parts.unshift({ type: 'same', text: oldWords[i - 1] });
        i--; j--;
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        parts.unshift({ type: 'ins', text: newWords[j - 1] });
        j--;
      } else {
        parts.unshift({ type: 'del', text: oldWords[i - 1] });
        i--;
      }
    }
    return /*#__PURE__*/React.createElement("div", { className: "note-diff" },
      parts.map((p, idx) =>
        p.type === 'del' ? /*#__PURE__*/React.createElement("span", { key: idx, className: "note-diff-del" }, p.text) :
        p.type === 'ins' ? /*#__PURE__*/React.createElement("span", { key: idx, className: "note-diff-ins" }, p.text) :
        p.text
      )
    );
  };

  /* ── Edit history section ── */
  const editHistory = note.edit_history || [];
  const renderEditHistory = () => {
    if (editHistory.length === 0) return null;
    return /*#__PURE__*/React.createElement("div", { className: "note-edit-history" },
      /*#__PURE__*/React.createElement("span", { className: "section-label" }, "EDIT HISTORY"),
      editHistory.slice().reverse().map((entry, idx) =>
        /*#__PURE__*/React.createElement("div", { key: idx, className: "note-edit-entry" },
          /*#__PURE__*/React.createElement("div", { className: "note-edit-entry-meta" },
            /*#__PURE__*/React.createElement("span", {
              style: { width: 18, height: 18, borderRadius: '50%', background: 'var(--purple-dim)', color: 'var(--purple)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700, flexShrink: 0 }
            }, (getDisplayName(entry.edited_by))[0].toUpperCase()),
            /*#__PURE__*/React.createElement("strong", null, getDisplayName(entry.edited_by)),
            " edited \u00b7 ",
            dtFmtDate(entry.edited_at)
          ),
          entry.prev_title !== undefined && entry.title !== undefined && entry.prev_title !== entry.title && /*#__PURE__*/React.createElement("div", null,
            /*#__PURE__*/React.createElement("div", { className: "note-edit-entry-field" }, "Title"),
            renderDiff(entry.prev_title, entry.title)
          ),
          entry.prev_content !== undefined && entry.content !== undefined && entry.prev_content !== entry.content && /*#__PURE__*/React.createElement("div", null,
            /*#__PURE__*/React.createElement("div", { className: "note-edit-entry-field" }, "Content"),
            renderDiff(entry.prev_content, entry.content)
          )
        )
      )
    );
  };

  /* ── Render ── */
  const isOwnNote = note.author === svc.userId;

  return /*#__PURE__*/React.createElement(Modal, {
    open: open, onClose: () => { setEditing(false); onClose(); },
    title: editing ? 'Edit Note' : (note.title || 'Note'),
    w: 600
  },
    /* ── Content section ── */
    /*#__PURE__*/React.createElement("div", { style: { marginBottom: 14 } },
      /*#__PURE__*/React.createElement("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 } },
        /*#__PURE__*/React.createElement("span", { className: "section-label" }, editing ? "TITLE" : "CONTENT"),
        !editing && !note.tombstoned && /*#__PURE__*/React.createElement("button", {
          onClick: () => setEditing(true),
          className: "b-gho b-xs",
          style: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }
        }, /*#__PURE__*/React.createElement(I, { n: "edit", s: 11 }), "Edit")
      ),
      editing ? /*#__PURE__*/React.createElement(React.Fragment, null,
        /*#__PURE__*/React.createElement("input", {
          value: editTitle,
          onChange: e => setEditTitle(e.target.value),
          placeholder: "Note title...",
          style: { marginBottom: 10, fontWeight: 600 }
        }),
        /*#__PURE__*/React.createElement("span", { className: "section-label" }, "CONTENT"),
        /*#__PURE__*/React.createElement("textarea", {
          value: editContent,
          onChange: e => setEditContent(e.target.value),
          placeholder: "Note content...",
          style: { minHeight: 120, marginTop: 4 }
        }),
        /* ── Live preview of changes ── */
        hasChanges && /*#__PURE__*/React.createElement("div", { style: { marginTop: 10 } },
          /*#__PURE__*/React.createElement("span", { className: "section-label", style: { color: 'var(--gold)' } }, "CHANGES PREVIEW"),
          titleChanged && /*#__PURE__*/React.createElement("div", null,
            /*#__PURE__*/React.createElement("div", { className: "note-edit-entry-field" }, "Title"),
            renderDiff(note.title || '', editTitle.trim())
          ),
          contentChanged && /*#__PURE__*/React.createElement("div", null,
            /*#__PURE__*/React.createElement("div", { className: "note-edit-entry-field" }, "Content"),
            renderDiff(note.content || note.text || '', editContent.trim())
          )
        ),
        /* ── Save / Cancel buttons ── */
        /*#__PURE__*/React.createElement("div", { style: { display: 'flex', gap: 8, marginTop: 14 } },
          /*#__PURE__*/React.createElement("button", {
            onClick: handleSave,
            className: "b-pri",
            disabled: !hasChanges || saving,
            style: { flex: 1, padding: 10, fontSize: 13 }
          }, saving ? "Saving..." : "Save Changes"),
          /*#__PURE__*/React.createElement("button", {
            onClick: () => {
              setEditing(false);
              setEditTitle(note.title || '');
              setEditContent(note.content || note.text || '');
            },
            className: "b-gho",
            style: { padding: 10, fontSize: 13 }
          }, "Cancel")
        )
      ) : /*#__PURE__*/React.createElement("div", {
        style: { fontSize: 13, color: 'var(--tx-0)', lineHeight: 1.7, whiteSpace: 'pre-wrap',
          background: 'var(--bg-2)', padding: 14, borderRadius: 'var(--r)',
          border: '1px solid var(--border-0)', marginTop: 6 }
      }, note.content || note.text || '(empty)')
    ),
    /* ── Attached To ── */
    note.attached_to && /*#__PURE__*/React.createElement("div", { style: { marginBottom: 14 } },
      /*#__PURE__*/React.createElement("span", { className: "section-label" }, "ATTACHED TO"),
      /*#__PURE__*/React.createElement("div", { style: { fontSize: 12, color: 'var(--tx-1)', marginTop: 4 } },
        note.attached_to_name || note.attached_to)
    ),
    /* ── Tags ── */
    note.tags?.length > 0 && /*#__PURE__*/React.createElement("div", { style: { marginBottom: 14 } },
      /*#__PURE__*/React.createElement("span", { className: "section-label" }, "TAGGED"),
      /*#__PURE__*/React.createElement("div", { className: "note-tags", style: { marginTop: 4 } },
        note.tags.map(t => /*#__PURE__*/React.createElement("span", { key: t.userId, className: "note-tag-chip" }, t.displayName))
      )
    ),
    /* ── Footer: created / last edited ── */
    /*#__PURE__*/React.createElement("div", {
      style: { fontSize: 11, color: 'var(--tx-3)', borderTop: '1px solid var(--border-0)', paddingTop: 10 }
    },
      "Created ", dtFmtDate(note.created), " by ", authorName,
      note.updated && note.updated !== note.created && /*#__PURE__*/React.createElement("span", null,
        " \u00b7 Last edited ", dtFmtDate(note.updated),
        note.last_edited_by ? (" by " + getDisplayName(note.last_edited_by)) : ''
      )
    ),
    /* ── Edit History ── */
    renderEditHistory()
  );
};

/* ─── NotesTable — table of all notes ─── */
/* On mobile, renders as card list instead of DataTable */
const NotesTable = ({
  notes,
  individuals,
  onNoteClick,
  onNewNote,
  T
}) => {
  const isMobile = useIsMobile();
  const NOTE_COLS = [{
    key: 'title',
    label: 'Title',
    fixed: true
  }, {
    key: 'content',
    label: 'Content'
  }, {
    key: 'attached_to_name',
    label: 'Attached To'
  }, {
    key: 'tags_display',
    label: 'Tags'
  }, {
    key: 'author_name',
    label: 'Author'
  }, {
    key: 'created',
    label: 'Created'
  }];
  const NOTE_GROUPS = [{
    k: 'none',
    l: 'No grouping'
  }, {
    k: 'attached_to_name',
    l: 'Attached To'
  }, {
    k: 'author_name',
    l: 'Author'
  }];
  const noteRows = (notes || []).map(n => {
    const ind = (individuals || []).find(i => i.id === n.attached_to);
    return {
      ...n,
      attached_to_name: ind ? ind.name : n.attached_to ? '[bridge]' : 'Standalone',
      tags_display: (n.tags || []).map(t => t.displayName).join(', ') || '—',
      author_name: (n.author || '').split(':')[0]?.replace('@', '') || 'Unknown'
    };
  });
  const getNoteVal = (row, key) => {
    if (key === 'created') return row.created || 0;
    return row[key] || '';
  };
  const renderNoteCell = (row, col) => {
    if (row.tombstoned) {
      if (col.key === 'title') return /*#__PURE__*/React.createElement("span", {
        style: {
          color: 'var(--red)',
          fontStyle: 'italic'
        }
      }, "Deleted by individual");
      if (col.key === 'content') return /*#__PURE__*/React.createElement("span", {
        style: {
          color: 'var(--tx-3)'
        }
      }, "\u2014");
    }
    if (col.key === 'title') return /*#__PURE__*/React.createElement("div", {
      style: {
        fontWeight: 600,
        fontSize: 13
      }
    }, row.title || '(untitled)');
    if (col.key === 'content') return /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12,
        color: 'var(--tx-1)',
        maxWidth: 300,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
      }
    }, row.content?.slice(0, 80) || '—');
    if (col.key === 'attached_to_name') {
      if (row.attached_to) return /*#__PURE__*/React.createElement("span", {
        className: "note-attached-to"
      }, row.attached_to_name);
      return /*#__PURE__*/React.createElement("span", {
        style: {
          color: 'var(--tx-3)',
          fontSize: 12
        }
      }, "Standalone");
    }
    if (col.key === 'tags_display') {
      if (!row.tags || row.tags.length === 0) return /*#__PURE__*/React.createElement("span", {
        style: {
          color: 'var(--tx-3)',
          fontSize: 12
        }
      }, "\u2014");
      return /*#__PURE__*/React.createElement("div", {
        className: "note-tags"
      }, row.tags.map(t => /*#__PURE__*/React.createElement("span", {
        key: t.userId,
        className: "note-tag-chip"
      }, t.displayName)));
    }
    if (col.key === 'author_name') return /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12,
        color: 'var(--tx-1)'
      }
    }, row.author_name);
    if (col.key === 'created') return /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12,
        color: 'var(--tx-2)'
      }
    }, dtFmtDate(row.created));
    return /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--tx-3)',
        fontSize: 12
      }
    }, "\u2014");
  };
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 4
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--tx-1)',
      fontSize: 12.5
    }
  }, "All notes across cases and standalone. Click a note for details.")), /*#__PURE__*/React.createElement("button", {
    onClick: onNewNote,
    className: "b-pri b-sm",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 4
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "plus",
    s: 12
  }), "New Note")), noteRows.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      textAlign: 'center',
      padding: '40px 20px',
      borderStyle: 'dashed'
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "msg",
    s: 28,
    c: "var(--tx-3)"
  }), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--tx-2)',
      marginTop: 10,
      fontSize: 13
    }
  }, "No notes yet"), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--tx-3)',
      fontSize: 11.5,
      marginTop: 4
    }
  }, "Click \"New Note\" to create one. Notes can be attached to individuals or standalone."), /*#__PURE__*/React.createElement("button", {
    onClick: onNewNote,
    className: "b-pri b-sm",
    style: {
      marginTop: 12
    }
  }, "Create First Note")) : isMobile ?
    /* ── Mobile card list ── */
    /*#__PURE__*/React.createElement("div", { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
      noteRows.map(row => /*#__PURE__*/React.createElement("div", {
        key: row.id,
        className: 'note-card' + (row.tombstoned ? ' tombstoned' : row.attached_to ? ' attached' : ' standalone'),
        onClick: () => onNoteClick(row)
      },
        row.tombstoned ? /*#__PURE__*/React.createElement("div", {
          style: { color: 'var(--red)', fontSize: 12, fontStyle: 'italic' }
        }, "Deleted by individual") : /*#__PURE__*/React.createElement(React.Fragment, null,
          /*#__PURE__*/React.createElement("div", { className: "note-header" },
            /*#__PURE__*/React.createElement("div", { className: "note-title" }, row.title || '(untitled)'),
            /*#__PURE__*/React.createElement("div", { className: "note-meta" }, dtFmtDate(row.created))
          ),
          /*#__PURE__*/React.createElement("div", { className: "note-body" }, row.content?.slice(0, 120) || ''),
          /*#__PURE__*/React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' } },
            row.attached_to && /*#__PURE__*/React.createElement("span", { className: "note-attached-to" }, row.attached_to_name),
            /*#__PURE__*/React.createElement("span", { style: { fontSize: 10, color: 'var(--tx-2)' } }, row.author_name),
            row.tags && row.tags.length > 0 && /*#__PURE__*/React.createElement("div", { className: "note-tags", style: { marginTop: 0 } },
              row.tags.map(t => /*#__PURE__*/React.createElement("span", { key: t.userId, className: "note-tag-chip" }, t.displayName)))
          )
        )
      ))
    ) :
    /* ── Desktop DataTable ── */
    /*#__PURE__*/React.createElement(DataTable, {
      data: noteRows,
      columns: NOTE_COLS,
      groupOptions: NOTE_GROUPS,
      defaultVisibleCols: ['title', 'content', 'attached_to_name', 'tags_display', 'author_name', 'created'],
      onRowClick: onNoteClick,
      renderCell: renderNoteCell,
      getVal: getNoteVal,
      label: "notes",
      selectable: true,
      bulkActions: [{
        id: 'delete',
        label: 'Delete',
        cls: 'b-red b-xs',
        icon: 'trash'
      }]
    }));
};

/* ─── Linked Record Types — configurable record types for Airtable-style linking ─── */
const LINKED_RECORD_TYPES = [
  { id: 'individual', label: 'Personal', icon: 'user', color: 'var(--green)', colorDim: 'var(--green-dim)' },
  { id: 'note', label: 'Note', icon: 'msg', color: 'var(--blue)', colorDim: 'var(--blue-dim)' },
  { id: 'resource', label: 'Resource', icon: 'layers', color: 'var(--teal)', colorDim: 'var(--teal-dim)' },
  { id: 'case', label: 'Case', icon: 'briefcase', color: 'var(--gold)', colorDim: 'var(--gold-dim)' },
  { id: 'task', label: 'Task', icon: 'check', color: 'var(--orange)', colorDim: 'var(--orange-dim)' },
  { id: 'document', label: 'Document', icon: 'file', color: 'var(--purple)', colorDim: 'var(--purple-dim)' }
];

/* ─── CreateLinkedRecordModal — link sub-records with governance ─── */
const CreateLinkedRecordModal = ({
  open,
  onClose,
  parentRecord,
  individuals,
  notes,
  resourceTypes,
  cases: allCases,
  svc,
  orgRole,
  orgRoom,
  teamMode,
  activeTeamObj,
  showToast,
  onLinkCreated,
  linkedRecords
}) => {
  const [selectedType, setSelectedType] = useState('individual');
  const [search, setSearch] = useState('');
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [newRecordMode, setNewRecordMode] = useState(false);
  const [newRecordName, setNewRecordName] = useState('');
  const [newRecordNotes, setNewRecordNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [governanceNote, setGovernanceNote] = useState('');

  if (!open || !parentRecord) return null;

  const typeConfig = LINKED_RECORD_TYPES.find(t => t.id === selectedType) || LINKED_RECORD_TYPES[0];
  const existingLinks = linkedRecords?.[parentRecord.id] || [];
  const existingLinkedIds = new Set(existingLinks.map(l => l.linked_record_id));

  // Build candidate records based on selected type
  let candidates = [];
  if (selectedType === 'individual') {
    candidates = (individuals || []).filter(i => i.id !== parentRecord.id && !existingLinkedIds.has(i.id)).map(i => ({
      id: i.id, name: i.name || 'Unknown', meta: i.status || '', icon: 'user', color: 'var(--green)'
    }));
  } else if (selectedType === 'note') {
    candidates = (notes || []).filter(n => !existingLinkedIds.has(n.id)).map(n => ({
      id: n.id, name: n.title || 'Untitled Note', meta: n.type || 'note', icon: 'msg', color: 'var(--blue)'
    }));
  } else if (selectedType === 'resource') {
    candidates = (resourceTypes || []).filter(r => !existingLinkedIds.has(r.id)).map(r => ({
      id: r.id, name: r.name || 'Unknown Resource', meta: r.category || 'general', icon: 'layers', color: 'var(--teal)'
    }));
  } else if (selectedType === 'case') {
    candidates = (allCases || []).filter(c => c.bridgeRoomId !== parentRecord.id && !existingLinkedIds.has(c.bridgeRoomId)).map(c => ({
      id: c.bridgeRoomId, name: c.sharedData?.full_name || c.clientUserId || 'Unknown', meta: 'case', icon: 'briefcase', color: 'var(--gold)'
    }));
  } else {
    // task, document — allow creating new sub-records
    candidates = [];
  }

  const filtered = search ? candidates.filter(c => c.name.toLowerCase().includes(search.toLowerCase())) : candidates;

  // Governance requirement check
  const governanceRequired = teamMode && activeTeamObj;
  const consentMode = activeTeamObj?.schemaRule?.mode || 'lead_decides';
  const isTeamLead = activeTeamObj?.lead === svc?.userId;

  const handleLink = async (target) => {
    if (!target) return;
    setSaving(true);
    try {
      const linkId = 'lr_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
      const linkRecord = {
        id: linkId,
        linked_record_id: target.id,
        record_type: selectedType,
        record_type_label: typeConfig.label,
        label: target.name,
        created_by: svc?.userId || 'unknown',
        created_at: new Date().toISOString(),
        governance: governanceRequired ? {
          team_id: activeTeamObj.roomId,
          team_name: activeTeamObj.name,
          consent_mode: consentMode,
          approved_by: isTeamLead ? svc?.userId : null,
          governance_note: governanceNote || null,
          status: (consentMode === 'lead_decides' && isTeamLead) || consentMode === 'advisory' ? 'approved' : 'pending_approval'
        } : null
      };

      if (onLinkCreated) onLinkCreated(parentRecord.id, linkRecord);
      if (showToast) {
        const govStatus = linkRecord.governance?.status;
        if (govStatus === 'pending_approval') {
          showToast(`Link created (pending team approval under ${consentMode} governance)`, 'warning');
        } else {
          showToast(`Linked ${typeConfig.label} "${target.name}" to ${parentRecord.name}`, 'success');
        }
      }
      onClose();
    } catch (e) {
      if (showToast) showToast('Failed to create link: ' + e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateNew = async () => {
    if (!newRecordName.trim()) return;
    setSaving(true);
    try {
      const linkId = 'lr_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
      const subRecordId = 'sub_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
      const linkRecord = {
        id: linkId,
        linked_record_id: subRecordId,
        record_type: selectedType,
        record_type_label: typeConfig.label,
        label: newRecordName.trim(),
        notes: newRecordNotes.trim() || null,
        is_sub_record: true,
        created_by: svc?.userId || 'unknown',
        created_at: new Date().toISOString(),
        governance: governanceRequired ? {
          team_id: activeTeamObj.roomId,
          team_name: activeTeamObj.name,
          consent_mode: consentMode,
          approved_by: isTeamLead ? svc?.userId : null,
          governance_note: governanceNote || null,
          status: (consentMode === 'lead_decides' && isTeamLead) || consentMode === 'advisory' ? 'approved' : 'pending_approval'
        } : null
      };

      if (onLinkCreated) onLinkCreated(parentRecord.id, linkRecord);
      if (showToast) showToast(`Created & linked new ${typeConfig.label} "${newRecordName.trim()}"`, 'success');
      onClose();
    } catch (e) {
      if (showToast) showToast('Failed to create sub-record: ' + e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return /*#__PURE__*/React.createElement(Modal, {
    open: open,
    onClose: onClose,
    title: `Link Record to ${parentRecord.name || 'Record'}`,
    w: 560
  },
  // Record type selector
  /*#__PURE__*/React.createElement("div", {
    style: { marginBottom: 14 }
  }, /*#__PURE__*/React.createElement("label", {
    className: "section-label",
    style: { fontSize: 10, marginBottom: 6 }
  }, "RECORD TYPE"),
  /*#__PURE__*/React.createElement("div", {
    style: { display: 'flex', gap: 4, flexWrap: 'wrap' }
  }, LINKED_RECORD_TYPES.map(rt => /*#__PURE__*/React.createElement("button", {
    key: rt.id,
    className: selectedType === rt.id ? 'b-pri b-xs' : 'b-gho b-xs',
    style: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 },
    onClick: () => { setSelectedType(rt.id); setSelectedTarget(null); setSearch(''); setNewRecordMode(false); }
  }, /*#__PURE__*/React.createElement(I, { n: rt.icon, s: 11 }), rt.label)))),

  // Governance indicator
  governanceRequired && /*#__PURE__*/React.createElement("div", {
    style: { padding: '8px 12px', background: 'var(--purple-dim)', border: '1px solid rgba(139,92,246,.15)', borderRadius: 'var(--r)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }
  }, /*#__PURE__*/React.createElement(I, { n: "shieldCheck", s: 14, c: "var(--purple)" }),
  /*#__PURE__*/React.createElement("div", { style: { flex: 1 } },
    /*#__PURE__*/React.createElement("div", { style: { fontSize: 11.5, fontWeight: 600, color: 'var(--purple)' } },
      "Team governance active"),
    /*#__PURE__*/React.createElement("div", { style: { fontSize: 10, color: 'var(--tx-2)' } },
      "Consent mode: ", consentMode.replace(/_/g, ' '),
      !isTeamLead && consentMode !== 'advisory' ? ' — link will require team lead approval' : '')),
  /*#__PURE__*/React.createElement("input", {
    type: "text",
    placeholder: "Governance note (optional)",
    value: governanceNote,
    onChange: e => setGovernanceNote(e.target.value),
    style: { width: 160, padding: '4px 8px', fontSize: 10, borderRadius: 'var(--r)' }
  })),

  // Toggle: Link existing or create new
  /*#__PURE__*/React.createElement("div", {
    style: { display: 'flex', gap: 4, marginBottom: 12 }
  }, /*#__PURE__*/React.createElement("button", {
    className: !newRecordMode ? 'b-pri b-xs' : 'b-gho b-xs',
    onClick: () => setNewRecordMode(false)
  }, "Link Existing"), /*#__PURE__*/React.createElement("button", {
    className: newRecordMode ? 'b-pri b-xs' : 'b-gho b-xs',
    onClick: () => setNewRecordMode(true)
  }, /*#__PURE__*/React.createElement(I, { n: "plus", s: 10 }), "Create New Sub-Record")),

  !newRecordMode ? /*#__PURE__*/React.createElement(React.Fragment, null,
    // Search
    /*#__PURE__*/React.createElement("input", {
      type: "text",
      placeholder: `Search ${typeConfig.label.toLowerCase()}s...`,
      value: search,
      onChange: e => setSearch(e.target.value),
      style: { marginBottom: 10, padding: '8px 12px', fontSize: 12.5 }
    }),

    // Candidate list
    /*#__PURE__*/React.createElement("div", {
      style: { maxHeight: 280, overflow: 'auto', marginBottom: 12 }
    }, filtered.length === 0 ? /*#__PURE__*/React.createElement("div", {
      style: { padding: 20, textAlign: 'center', color: 'var(--tx-2)', fontSize: 12 }
    }, candidates.length === 0 ? `No ${typeConfig.label.toLowerCase()} records available. Try creating a new sub-record.` : 'No matches found')
    : filtered.map(c => /*#__PURE__*/React.createElement("div", {
      key: c.id,
      className: "lr-record-card",
      style: { borderColor: selectedTarget?.id === c.id ? 'var(--purple)' : undefined, background: selectedTarget?.id === c.id ? 'var(--purple-dim)' : undefined },
      onClick: () => setSelectedTarget(c)
    }, /*#__PURE__*/React.createElement("div", {
      className: "lr-avatar",
      style: { background: c.color || 'var(--purple)' }
    }, (c.name || '?')[0].toUpperCase()),
    /*#__PURE__*/React.createElement("div", { className: "lr-info" },
      /*#__PURE__*/React.createElement("div", { className: "lr-name" }, c.name),
      /*#__PURE__*/React.createElement("div", { className: "lr-meta" }, c.meta)),
    /*#__PURE__*/React.createElement("span", {
      className: "lr-type-badge",
      style: { background: typeConfig.colorDim, color: typeConfig.color }
    }, typeConfig.label),
    selectedTarget?.id === c.id && /*#__PURE__*/React.createElement(I, { n: "check", s: 16, c: "var(--purple)" })))),

    // Link button
    /*#__PURE__*/React.createElement("button", {
      className: "b-pri",
      style: { width: '100%' },
      disabled: !selectedTarget || saving,
      onClick: () => handleLink(selectedTarget)
    }, saving ? 'Linking...' : `Link ${typeConfig.label}`)
  )

  : /*#__PURE__*/React.createElement(React.Fragment, null,
    // Create new sub-record form
    /*#__PURE__*/React.createElement("div", { style: { marginBottom: 10 } },
      /*#__PURE__*/React.createElement("label", {
        className: "section-label",
        style: { fontSize: 10, marginBottom: 4 }
      }, `NEW ${typeConfig.label.toUpperCase()} NAME`),
      /*#__PURE__*/React.createElement("input", {
        type: "text",
        placeholder: `Enter ${typeConfig.label.toLowerCase()} name...`,
        value: newRecordName,
        onChange: e => setNewRecordName(e.target.value),
        style: { padding: '10px 14px', fontSize: 13 }
      })),

    /*#__PURE__*/React.createElement("div", { style: { marginBottom: 14 } },
      /*#__PURE__*/React.createElement("label", {
        className: "section-label",
        style: { fontSize: 10, marginBottom: 4 }
      }, "NOTES (OPTIONAL)"),
      /*#__PURE__*/React.createElement("textarea", {
        placeholder: "Add details about this sub-record...",
        value: newRecordNotes,
        onChange: e => setNewRecordNotes(e.target.value),
        style: { padding: '10px 14px', fontSize: 12.5, minHeight: 60 }
      })),

    // Sovereignty notice
    /*#__PURE__*/React.createElement("div", {
      style: { padding: '8px 12px', background: 'var(--gold-dim)', border: '1px solid var(--gold-mid)', borderRadius: 'var(--r)', marginBottom: 12, fontSize: 11, color: 'var(--tx-1)', lineHeight: 1.5 }
    }, /*#__PURE__*/React.createElement(I, { n: "eye", s: 11, c: "var(--gold)" }),
    " This creates a sub-record linked to ", /*#__PURE__*/React.createElement("strong", null, parentRecord.name), ". The link is stored as an EO operation and can be audited."),

    /*#__PURE__*/React.createElement("button", {
      className: "b-pri",
      style: { width: '100%' },
      disabled: !newRecordName.trim() || saving,
      onClick: handleCreateNew
    }, saving ? 'Creating...' : `Create & Link ${typeConfig.label}`)),

  // Existing links section
  existingLinks.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: { borderTop: '1px solid var(--border-0)', paddingTop: 12, marginTop: 12 }
  }, /*#__PURE__*/React.createElement("label", {
    className: "section-label",
    style: { fontSize: 10, marginBottom: 6 }
  }, `EXISTING LINKS (${existingLinks.length})`),
  existingLinks.map(link => {
    const lrt = LINKED_RECORD_TYPES.find(t => t.id === link.record_type);
    return /*#__PURE__*/React.createElement("div", {
      key: link.id,
      style: { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 'var(--r)', marginBottom: 4, background: 'var(--bg-2)', border: '1px solid var(--border-0)' }
    }, /*#__PURE__*/React.createElement("span", {
      className: "lr-type-badge",
      style: { background: lrt?.colorDim || 'var(--purple-dim)', color: lrt?.color || 'var(--purple)' }
    }, link.record_type_label || link.record_type),
    /*#__PURE__*/React.createElement("span", { style: { flex: 1, fontSize: 12, fontWeight: 500 } }, link.label),
    link.governance && /*#__PURE__*/React.createElement("span", {
      className: "tag",
      style: { fontSize: 8, padding: '1px 6px', background: link.governance.status === 'approved' ? 'var(--green-dim)' : 'var(--orange-dim)', color: link.governance.status === 'approved' ? 'var(--green)' : 'var(--orange)' }
    }, link.governance.status === 'approved' ? 'Approved' : 'Pending'),
    /*#__PURE__*/React.createElement("span", { style: { fontSize: 9, color: 'var(--tx-3)' } },
      new Date(link.created_at).toLocaleDateString()));
  })));
};

/* ─── DatabaseView — unified tabbed view for Individuals, Notes, Resources ─── */
const DatabaseView = ({
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
  notes,
  onNewNote,
  onNoteClick,
  onOpenIndividual,
  onOpenResource,
  resourceTypes,
  resourceRelations,
  resourceInventory,
  rosterRoom,
  networkRoom,
  onCreateResource,
  onRefresh,
  onRestock,
  onEstablishRelation,
  canViewResource,
  canControlResource,
  canAllocateResource,
  clientRecords,
  onCreateClient,
  onCellEdit,
  onBulkAction,
  onReorder,
  onAddRow,
  fieldDefs,
  fieldCrosswalks,
  teams,
  onSaveFieldDef,
  onSaveCrosswalk,
  fieldGovernanceConfig,
  onPropose,
  teamMode,
  activeTeamObj,
  sidebarCollapsed,
  linkedRecords,
  onCreateLinkedRecord,
  onRemoveLinkedRecord,
  onCreateTable,
  onOpenTable,
  trashedIndividuals,
  onRestoreIndividual,
  onRestoreField
}) => {
  const [dbTab, setDbTab] = useState('individuals');
  const [enabledFieldCols, setEnabledFieldCols] = useState([]);
  const [addFieldDd, setAddFieldDd] = useState(false);
  const [addColumnModal, setAddColumnModal] = useState(false);

  // Transform cases into individual rows (same as IndividualsView)
  const individuals = cases.map(c => {
    const assignment = caseAssignments[c.bridgeRoomId];
    const fields = {};
    Object.entries(c.sharedData || {}).forEach(([k, v]) => {
      if (k === 'full_name') return;
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
      priority: assignment?.priority || 'none',
      nextAction: assignment?.next_action || null,
      bridgeRoom: c.bridgeRoomId,
      fields,
      transferable: c.transferable,
      _case: c
    };
  });

  // Also include client records that aren't yet in cases (provider-created)
  const caseRoomIds = new Set(cases.map(c => c.bridgeRoomId));
  const extraClients = (clientRecords || []).filter(r => !caseRoomIds.has(r.roomId)).map(r => ({
    id: r.roomId,
    name: r.client_name || 'Unknown',
    alias: null,
    status: r.status || 'created',
    disclosureLevel: 0,
    lastContact: r.created,
    assignedTo: (r.owner || '').split(':')[0]?.replace('@', '') || '—',
    activeCases: 0,
    priority: 'none',
    bridgeRoom: r.roomId,
    fields: {},
    transferable: false,
    _clientRecord: r
  }));
  const allIndividuals = [...individuals, ...extraClients].filter(row => !(trashedIndividuals || {})[row.id]);
  const IND_COLS = [{
    key: 'name',
    label: 'Individual',
    fixed: true,
    editable: true,
    placeholder: 'Enter name...'
  }, {
    key: 'status',
    label: 'Status'
  }, {
    key: 'priority',
    label: 'Priority',
    editable: true
  }, {
    key: 'assignedTo',
    label: 'Assigned'
  }, {
    key: 'fields_count',
    label: 'Fields'
  }, {
    key: 'transferable',
    label: 'Transfer'
  }, {
    key: 'linked_records',
    label: 'Linked Records'
  }];
  // Add dynamic field columns
  const fieldKeys = new Set();
  cases.forEach(c => Object.keys(c.sharedData || {}).forEach(k => {
    if (k !== 'full_name') fieldKeys.add(k);
  }));
  fieldKeys.forEach(k => {
    IND_COLS.push({
      key: k,
      label: k.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      isField: true,
      editable: true
    });
  });
  // Also add provider-enabled field columns from fieldDefs
  enabledFieldCols.forEach(key => {
    if (!fieldKeys.has(key)) {
      const def = Object.values(fieldDefs || {}).find(d => d.key === key);
      IND_COLS.push({
        key,
        label: def?.label || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        isField: true,
        editable: true
      });
    }
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
  const enabledExtras = enabledFieldCols.filter(k => !fieldKeys.has(k));
  const defaultVisCols = ['name', 'status', 'priority', 'assignedTo', 'fields_count', 'linked_records', 'transferable', ...Array.from(fieldKeys).slice(0, 3), ...enabledExtras];
  const getIndVal = (row, key) => {
    if (key === 'fields_count') return Object.keys(row.fields || {}).length;
    if (key === 'transferable') return row.transferable ? 'Yes' : 'Locked';
    if (key === 'linked_records') return (linkedRecords?.[row.id] || []).length;
    if (row.fields && row.fields[key]) return row.fields[key].value || '';
    return row[key] || '';
  };
  const renderIndCell = (row, col) => {
    const k = col.key;
    if (k === 'linked_records') {
      const links = linkedRecords?.[row.id] || [];
      return /*#__PURE__*/React.createElement("div", {
        style: { display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }
      }, links.slice(0, 3).map(link => /*#__PURE__*/React.createElement("span", {
        key: link.id,
        className: "linked-rec-chip",
        title: `${link.record_type}: ${link.label}`,
        onClick: e => { e.stopPropagation(); }
      }, /*#__PURE__*/React.createElement("span", { className: "lr-type" }, link.record_type_label || link.record_type), link.label)),
      links.length > 3 && /*#__PURE__*/React.createElement("span", {
        style: { fontSize: 10, color: 'var(--tx-2)', fontFamily: 'var(--mono)' }
      }, "+", links.length - 3),
      /*#__PURE__*/React.createElement("button", {
        className: "linked-rec-add",
        onClick: e => { e.stopPropagation(); onCreateLinkedRecord && onCreateLinkedRecord(row); },
        title: "Link a record"
      }, /*#__PURE__*/React.createElement(I, { n: "plus", s: 9 }), "Link"));
    }
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

  // Stat cards
  const totalLinks = Object.values(linkedRecords || {}).reduce((s, arr) => s + arr.length, 0);
  const indStats = [{
    l: 'Total',
    v: allIndividuals.length,
    c: 'gold'
  }, {
    l: 'Active',
    v: allIndividuals.filter(i => i.status === 'active').length,
    c: 'green'
  }, {
    l: 'Linked Records',
    v: totalLinks,
    c: 'purple'
  }, {
    l: T.staff_term_plural,
    v: (staff || []).length,
    c: 'blue'
  }, {
    l: 'Fields Active',
    v: cases.reduce((s, c) => s + Object.keys(c.sharedData || {}).length, 0) + enabledFieldCols.length,
    c: 'teal'
  }];
  // ── Team-specific database: require team selection when teams exist ──
  const hasTeams = (teams || []).length > 0;
  const isTeamScoped = !!activeTeamObj;
  // Detect holonic data (child-team rollups or cross-team linked records)
  const childTeams = activeTeamObj?.hierarchy?.child_teams || [];
  const childTeamObjs = childTeams.map(c => (teams || []).find(t => t.roomId === c.roomId)).filter(Boolean);
  const rollupTables = childTeamObjs.flatMap(ct =>
    (ct.customTables || []).filter(t => t.status === 'active' && t.rollup_to_parent).map(t => ({ ...t, _fromTeam: ct }))
  );
  const hasHolonicData = rollupTables.length > 0 || childTeamObjs.length > 0;
  // Cross-team linked records
  const crossTeamLinks = Object.values(linkedRecords || {}).flat().filter(lr => {
    if (!activeTeamObj) return false;
    return lr.source_team && lr.source_team !== activeTeamObj.roomId;
  });
  const hasCrossTeamLinks = crossTeamLinks.length > 0;

  // If teams exist but none is selected, show team selection prompt
  if (hasTeams && !isTeamScoped) {
    return React.createElement("div", {
      className: `anim-up db-view${sidebarCollapsed ? ' db-full-width' : ''}`,
      style: { textAlign: 'center', padding: '60px 20px' }
    },
      React.createElement(I, { n: "database", s: 48, c: "var(--border-1)" }),
      React.createElement("h2", {
        style: { fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 700, marginTop: 16, marginBottom: 8 }
      }, "Select a Team"),
      React.createElement("p", {
        style: { color: 'var(--tx-2)', fontSize: 13, maxWidth: 440, margin: '0 auto 24px', lineHeight: 1.5 }
      }, "The database is team-specific. Select a team to view and manage its individuals, notes, resources, and tables. Data from linked teams will be clearly marked."),
      React.createElement("div", {
        style: { display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 360, margin: '0 auto' }
      },
        (teams || []).map(t => {
          const tColor = `hsl(${t.color_hue || 260}, 60%, 55%)`;
          return React.createElement("button", {
            key: t.roomId,
            className: "card",
            style: { display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', cursor: 'pointer', border: `1px solid ${tColor}33`, transition: 'all .15s', textAlign: 'left' },
            onClick: () => {
              // Trigger team context switch via the parent switchTeamContext
              if (typeof window.__khoraSwitchTeam === 'function') window.__khoraSwitchTeam(t.roomId);
            },
            onMouseEnter: e => { e.currentTarget.style.borderColor = tColor; e.currentTarget.style.background = `${tColor}11`; },
            onMouseLeave: e => { e.currentTarget.style.borderColor = `${tColor}33`; e.currentTarget.style.background = ''; }
          },
            React.createElement("span", { style: { width: 12, height: 12, borderRadius: '50%', background: tColor, flexShrink: 0 } }),
            React.createElement("div", { style: { flex: 1 } },
              React.createElement("div", { style: { fontWeight: 700, fontSize: 13.5 } }, t.name || 'Unnamed Team'),
              React.createElement("div", { style: { fontSize: 11, color: 'var(--tx-2)', marginTop: 2 } },
                (t.members || []).length, ' members',
                t.hierarchy?.parent_team_name ? ` · nested under ${t.hierarchy.parent_team_name}` : '',
                (t.customTables || []).filter(tb => tb.status === 'active').length > 0
                  ? ` · ${(t.customTables || []).filter(tb => tb.status === 'active').length} tables`
                  : ''
              )
            ),
            React.createElement(I, { n: "chevronRight", s: 14, c: "var(--tx-3)" })
          );
        })
      )
    );
  }

  return /*#__PURE__*/React.createElement("div", {
    className: `anim-up db-view${sidebarCollapsed ? ' db-full-width' : ''}`
  },
  // ── Team scope header ──
  isTeamScoped && React.createElement("div", {
    style: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', marginBottom: 14, background: `hsla(${activeTeamObj.color_hue || 260}, 60%, 55%, 0.08)`, border: `1px solid hsla(${activeTeamObj.color_hue || 260}, 60%, 55%, 0.2)`, borderRadius: 'var(--r-lg)' }
  },
    React.createElement("span", { style: { width: 10, height: 10, borderRadius: '50%', background: `hsl(${activeTeamObj.color_hue || 260}, 60%, 55%)`, flexShrink: 0 } }),
    React.createElement(I, { n: "database", s: 14, c: `hsl(${activeTeamObj.color_hue || 260}, 60%, 55%)` }),
    React.createElement("span", { style: { fontSize: 12.5, fontWeight: 700 } }, activeTeamObj.name, " Database"),
    React.createElement("span", { style: { fontSize: 11, color: 'var(--tx-3)' } }, "\u00B7 ", (activeTeamObj.members || []).length, " members"),
    // Holonic merge indicator
    hasHolonicData && React.createElement("span", {
      className: "tag tag-teal",
      style: { fontSize: 8, display: 'inline-flex', alignItems: 'center', gap: 3 },
      title: `Includes rolled-up data from ${childTeamObjs.length} sub-team(s): ${childTeamObjs.map(c => c.name).join(', ')}`
    }, React.createElement(I, { n: "layers", s: 8, c: "var(--teal)" }), "\u21A5 HOLONIC MERGE \u00B7 ", childTeamObjs.length, " sub-team", childTeamObjs.length !== 1 ? "s" : ""),
    hasCrossTeamLinks && React.createElement("span", {
      className: "tag tag-purple",
      style: { fontSize: 8, display: 'inline-flex', alignItems: 'center', gap: 3 },
      title: `${crossTeamLinks.length} linked record(s) from other teams`
    }, React.createElement(I, { n: "link", s: 8, c: "var(--purple)" }), "CROSS-TEAM LINKS \u00B7 ", crossTeamLinks.length)
  ),
  // ── Holonic data detail banner ──
  isTeamScoped && hasHolonicData && React.createElement("div", {
    style: { background: 'var(--teal-dim)', border: '1px solid rgba(62,201,176,.15)', borderRadius: 'var(--r)', padding: '8px 14px', marginBottom: 12, fontSize: 11, color: 'var(--tx-1)', lineHeight: 1.5 }
  },
    React.createElement("strong", { style: { color: 'var(--teal)' } }, "Holonic data merge: "),
    "This team includes rolled-up data from ", childTeamObjs.length, " sub-team", childTeamObjs.length !== 1 ? "s" : "", " (",
    childTeamObjs.map((ct, i) => React.createElement(React.Fragment, { key: ct.roomId },
      i > 0 && ", ",
      React.createElement("strong", null, ct.name)
    )),
    "). Sub-team data is aggregated per table rollup policies. Rows originating from sub-teams are tagged with their source."
  ),
  /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", {
    style: {
      fontFamily: 'var(--serif)',
      fontSize: 22,
      fontWeight: 700
    }
  }, isTeamScoped ? activeTeamObj.name + " Database" : "Database"), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--tx-1)',
      fontSize: 12.5,
      marginTop: 2
    }
  }, isTeamScoped ? `Team-specific data for ${activeTeamObj.name}. ${hasHolonicData ? 'Includes holonic data from sub-teams.' : ''}` : "Manage individuals, notes, and resources in one place."), /*#__PURE__*/React.createElement(StorageTransparencyBadge, {
    storageType: "matrix",
    roomId: rosterRoom,
    encrypted: true,
    encLabel: "Megolm E2EE",
    label: "Database",
    extra: [{ label: 'Storage model', value: 'Individuals are stored across bridge rooms (one per client-provider relationship). Notes are stored in bridge or roster rooms. Resources are stored in org room state events.' }, { label: 'Roster room', value: rosterRoom || 'Not initialized' }, orgRoom ? { label: 'Org room', value: orgRoom } : null, networkRoom ? { label: 'Network room', value: networkRoom } : null].filter(Boolean)
  }))), /*#__PURE__*/React.createElement("div", {
    className: "db-tabs"
  }, [{
    id: 'individuals',
    label: 'Individuals',
    count: allIndividuals.length,
    icon: 'users'
  }, {
    id: 'notes',
    label: 'Notes',
    count: (notes || []).length,
    icon: 'msg'
  }, {
    id: 'resources',
    label: 'Resources',
    count: (resourceTypes || []).length,
    icon: 'layers'
  }, {
    id: 'definitions',
    label: 'Definitions',
    count: Object.keys(fieldDefs || {}).length,
    icon: 'grid'
  }, {
    id: 'tables',
    label: 'Tables',
    count: (activeTeamObj?.customTables || []).filter(t => t.status === 'active').length,
    icon: 'database'
  }, {
    id: 'trash',
    label: 'Trash',
    count: Object.keys(trashedIndividuals || {}).length,
    icon: 'trash'
  }].map(tab => /*#__PURE__*/React.createElement("button", {
    key: tab.id,
    className: 'db-tab' + (dbTab === tab.id ? ' active' : ''),
    onClick: () => setDbTab(tab.id)
  }, /*#__PURE__*/React.createElement(I, {
    n: tab.icon,
    s: 13
  }), tab.label, /*#__PURE__*/React.createElement("span", {
    className: "db-tab-count"
  }, tab.count)))), dbTab === 'individuals' && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))',
      gap: 10,
      marginBottom: 16
    }
  }, indStats.map((s, i) => /*#__PURE__*/React.createElement("div", {
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
  }, s.v)))), /*#__PURE__*/React.createElement("div", {
    style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }
  },
  // Add Column button (primary action)
  /*#__PURE__*/React.createElement("button", {
    className: "b-pri b-sm",
    style: { display: 'flex', alignItems: 'center', gap: 4 },
    onClick: () => { setAddFieldDd(false); setAddColumnModal(true); }
  }, /*#__PURE__*/React.createElement(I, { n: "plus", s: 11 }), "Add Column"),
  // Quick-add from existing definitions dropdown
  /*#__PURE__*/React.createElement("div", {
    className: "dt-dd-wrap",
    style: { position: 'relative' }
  }, /*#__PURE__*/React.createElement("button", {
    className: "b-gho b-sm",
    style: { display: 'flex', alignItems: 'center', gap: 4 },
    onClick: () => setAddFieldDd(!addFieldDd)
  }, /*#__PURE__*/React.createElement(I, { n: "grid", s: 11 }), "Columns (", (IND_COLS.length - 6 + enabledFieldCols.filter(k => !fieldKeys.has(k)).length), ")"), addFieldDd && /*#__PURE__*/React.createElement("div", {
    className: "dt-dd",
    style: { minWidth: 280, maxHeight: 360, overflow: 'auto' }
  }, /*#__PURE__*/React.createElement("div", {
    className: "dt-dd-label"
  }, "Toggle column visibility"), Object.values(fieldDefs || {}).filter(d => d.key !== 'full_name').map(d => {
    const isEnabled = fieldKeys.has(d.key) || enabledFieldCols.includes(d.key);
    return /*#__PURE__*/React.createElement("div", {
      key: d.uri || d.key,
      className: "dt-dd-item",
      style: { display: 'flex', alignItems: 'center', gap: 8 },
      onClick: () => {
        if (isEnabled && !fieldKeys.has(d.key)) {
          setEnabledFieldCols(prev => prev.filter(x => x !== d.key));
        } else if (!isEnabled) {
          // Require definition for any column
          if (!d.definition || d.definition.length < 10) {
            if (showToast) showToast('This field needs a definition before it can be added as a column. Use "Add Column" to create one with a definition.', 'warning');
            setAddFieldDd(false);
            return;
          }
          setEnabledFieldCols(prev => [...prev, d.key]);
        }
        setAddFieldDd(false);
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: { width: 14, height: 14, borderRadius: 3, border: '1.5px solid ' + (isEnabled ? 'var(--teal)' : 'var(--border-1)'), background: isEnabled ? 'var(--teal)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }
    }, isEnabled && /*#__PURE__*/React.createElement("span", { style: { color: '#fff', fontSize: 9, fontWeight: 700 } }, "\u2713")),
    /*#__PURE__*/React.createElement("div", { style: { flex: 1, minWidth: 0 } },
      /*#__PURE__*/React.createElement("div", { style: { fontWeight: 500, fontSize: 12 } }, d.label || d.key),
      /*#__PURE__*/React.createElement("div", { style: { fontSize: 9.5, color: 'var(--tx-3)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
        d.definition ? d.definition.slice(0, 50) + (d.definition.length > 50 ? '...' : '') : '\u26A0 No definition')),
    fieldKeys.has(d.key) && /*#__PURE__*/React.createElement("span", { className: "tag tag-green", style: { fontSize: 7, flexShrink: 0 } }, "DATA"));
  }),
  /*#__PURE__*/React.createElement("div", {
    className: "dt-dd-item",
    style: { borderTop: '1px solid var(--border-0)', color: 'var(--purple)', fontWeight: 600, fontSize: 11.5, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 },
    onClick: () => { setAddFieldDd(false); setAddColumnModal(true); }
  }, /*#__PURE__*/React.createElement(I, { n: "plus", s: 10, c: "var(--purple)" }), "Create New Column..."))),
  // Team governance indicator
  teamMode && /*#__PURE__*/React.createElement("span", {
    className: "tag tag-purple",
    style: { fontSize: 9, display: 'inline-flex', alignItems: 'center', gap: 3 }
  }, /*#__PURE__*/React.createElement(I, { n: "shieldCheck", s: 9, c: "var(--purple)" }),
    (() => {
      const at = activeTeamObj || (teamMode ? (teams || []).find(t => t.roomId === teamMode.roomId) : null);
      const mode = at?.schemaRule?.mode || 'lead_decides';
      return (TEAM_CONSENT_MODES[mode] || TEAM_CONSENT_MODES.lead_decides).label;
    })(), " governance"),
  // Active column chips
  enabledFieldCols.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: { display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }
  }, enabledFieldCols.map(k => {
    const def = Object.values(fieldDefs || {}).find(d => d.key === k);
    return /*#__PURE__*/React.createElement("span", {
      key: k,
      className: "tag tag-teal",
      style: { fontSize: 10, display: 'inline-flex', alignItems: 'center', gap: 3, cursor: 'pointer' },
      title: def?.definition ? def.definition.slice(0, 100) : 'Click to remove column',
      onClick: () => setEnabledFieldCols(prev => prev.filter(x => x !== k))
    }, def?.label || k, " \u00d7");
  }))),
  // Add Column Modal
  /*#__PURE__*/React.createElement(AddColumnModal, {
    open: addColumnModal,
    onClose: (addedKey) => { setAddColumnModal(false); if (addedKey) setEnabledFieldCols(prev => prev.includes(addedKey) ? prev : [...prev, addedKey]); },
    onSave: async (def) => {
      // Save field definition
      const schemaRoom = svc.client ? svc.client.getRooms().find(r => {
        const id = r.currentState.getStateEvents(EVT.IDENTITY, '');
        return id?.getContent()?.account_type === 'schema' && id.getContent().owner === svc.userId;
      })?.roomId : null;
      if (schemaRoom) {
        const updated = { ...fieldDefs, [def.uri]: def };
        await svc.setState(schemaRoom, EVT.FIELD_DEF, { definitions: updated });
      }
      // Add as enabled column
      setEnabledFieldCols(prev => prev.includes(def.key) ? prev : [...prev, def.key]);
    },
    onPropose: onPropose,
    fieldDefs: fieldDefs,
    teams: teams,
    teamMode: teamMode,
    activeTeamObj: activeTeamObj,
    svc: svc,
    orgRoom: orgRoom,
    networkRoom: networkRoom,
    showToast: showToast,
    fieldGovernanceConfig: fieldGovernanceConfig
  }),
  /*#__PURE__*/React.createElement(DataTable, {
    data: allIndividuals,
    columns: IND_COLS,
    groupOptions: IND_GROUPS,
    defaultVisibleCols: defaultVisCols,
    onRowClick: row => onOpenIndividual ? onOpenIndividual(row) : row._case ? openCase(row._case.bridgeRoomId) : null,
    renderCell: renderIndCell,
    getVal: getIndVal,
    label: "individuals",
    selectable: true,
    bulkActions: [{
      id: 'assign',
      label: 'Assign',
      cls: 'b-gho b-xs',
      icon: 'briefcase'
    }, {
      id: 'tag',
      label: 'Tag',
      cls: 'b-gho b-xs',
      icon: 'users'
    }, {
      id: 'delete',
      label: 'Delete',
      cls: 'b-red b-xs',
      icon: 'trash'
    }],
    onBulkAction: onBulkAction,
    draggable: true,
    onReorder: onReorder,
    editable: true,
    onCellEdit: onCellEdit,
    onAddRow: onAddRow || onCreateClient,
    addRowLabel: `Add ${T?.client_term || 'Individual'}`
  })), dbTab === 'notes' && /*#__PURE__*/React.createElement(NotesTable, {
    notes: notes,
    individuals: allIndividuals,
    onNoteClick: onNoteClick,
    onNewNote: onNewNote,
    T: T
  }), dbTab === 'resources' && /*#__PURE__*/React.createElement(ResourcesTableView, {
    resourceTypes: resourceTypes,
    resourceRelations: resourceRelations,
    resourceInventory: resourceInventory,
    T: T,
    svc: svc,
    orgRole: orgRole,
    orgRoom: orgRoom,
    rosterRoom: rosterRoom,
    networkRoom: networkRoom,
    allAllocations: allAllocations,
    onCreateResource: onCreateResource,
    onRefresh: onRefresh,
    onRestock: onRestock,
    onEstablishRelation: onEstablishRelation,
    canViewResource: canViewResource,
    canControlResource: canControlResource,
    canAllocateResource: canAllocateResource,
    individuals: cases
  }), dbTab === 'definitions' && /*#__PURE__*/React.createElement(FieldDictionaryView, {
    fieldDefs: fieldDefs || {},
    fieldCrosswalks: fieldCrosswalks || [],
    teams: teams || [],
    onSaveFieldDef: onSaveFieldDef,
    onSaveCrosswalk: onSaveCrosswalk,
    svc: svc,
    orgRoom: orgRoom,
    networkRoom: networkRoom,
    showToast: showToast,
    fieldGovernanceConfig: fieldGovernanceConfig,
    onPropose: onPropose
  }),
  dbTab === 'tables' && React.createElement('div', { className: 'anim-up' },
    !activeTeamObj
      ? React.createElement('div', { style: { textAlign: 'center', padding: '40px 20px', color: 'var(--tx-3)' } },
          React.createElement(I, { n: 'database', s: 32, c: 'var(--border-1)' }),
          React.createElement('p', { style: { marginTop: 10, fontSize: 13 } }, 'Custom tables are team-specific.'),
          React.createElement('p', { style: { fontSize: 12, marginTop: 4 } }, 'Select a team context from the sidebar to view and create tables.'))
      : React.createElement(React.Fragment, null,
          // Team context header + create button
          React.createElement('div', { style: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 } },
            React.createElement('div', null,
              React.createElement('div', { style: { fontWeight: 700, fontSize: 14 } }, activeTeamObj.name, ' Tables'),
              React.createElement('div', { style: { fontSize: 11, color: 'var(--tx-2)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 } },
                (() => {
                  const mode = activeTeamObj.schemaRule?.mode || 'lead_decides';
                  const cm = TEAM_CONSENT_MODES[mode] || TEAM_CONSENT_MODES.lead_decides;
                  const govColor = cm.color === 'gold' ? 'var(--gold)' : cm.color === 'green' ? 'var(--green)' : 'var(--blue)';
                  return React.createElement(React.Fragment, null,
                    React.createElement(I, { n: 'shieldCheck', s: 10, c: govColor }),
                    React.createElement('span', { style: { color: govColor } }, cm.label, ' governance'),
                    React.createElement('span', { style: { color: 'var(--tx-3)' } }, '\u00B7'),
                    cm.id !== 'lead_decides'
                      ? React.createElement('span', null, 'Table creation requires approval from team members')
                      : React.createElement('span', null, 'Team lead can create tables immediately')
                  );
                })(),
                // Parent team rollup notice
                activeTeamObj.hierarchy?.parent_team_name && React.createElement('span', { style: { marginLeft: 6 } },
                  React.createElement('span', { style: { color: 'var(--teal)' } },
                    '\u21A5 nested under ', activeTeamObj.hierarchy.parent_team_name))
              )
            ),
            React.createElement('button', {
              className: 'b-pri b-sm',
              style: { display: 'flex', alignItems: 'center', gap: 4 },
              onClick: () => onCreateTable && onCreateTable(activeTeamObj)
            }, React.createElement(I, { n: 'plus', s: 11 }), 'New Table')
          ),

          // Pending proposals notice
          (() => {
            const pending = (activeTeamObj.schema?.pending_changes || []).filter(c => c.action === 'create_table');
            if (pending.length === 0) return null;
            return React.createElement('div', { style: { background: 'var(--gold-dim)', border: '1px solid rgba(201,163,82,.2)', borderRadius: 'var(--r)', padding: '10px 14px', marginBottom: 12 } },
              React.createElement('div', { style: { fontWeight: 600, fontSize: 11.5, color: 'var(--gold)', display: 'flex', alignItems: 'center', gap: 6 } },
                React.createElement(I, { n: 'shieldCheck', s: 12, c: 'var(--gold)' }),
                pending.length, ' table', pending.length > 1 ? 's' : '', ' pending governance approval'),
              pending.map(p => React.createElement('div', { key: p.id, style: { fontSize: 11, color: 'var(--tx-1)', marginTop: 4, display: 'flex', align: 'center', gap: 6 } },
                React.createElement('span', { className: 'tag tag-gold', style: { fontSize: 8 } }, 'PENDING'),
                React.createElement('strong', null, p.table_definition?.name),
                ' — proposed by ', p.proposed_by?.split(':')[0]?.replace('@', '') || 'unknown',
                ' on ', new Date(p.proposed_at).toLocaleDateString()
              ))
            );
          })(),

          // Child teams with rollup tables
          (() => {
            const children = activeTeamObj.hierarchy?.child_teams || [];
            const childTeamObjs = children.map(c => (teams || []).find(t => t.roomId === c.roomId)).filter(Boolean);
            const rollupTables = childTeamObjs.flatMap(ct =>
              (ct.customTables || []).filter(t => t.status === 'active' && t.rollup_to_parent).map(t => ({ ...t, _fromTeam: ct }))
            );
            if (rollupTables.length === 0) return null;
            return React.createElement('div', { style: { marginBottom: 16 } },
              React.createElement('div', { className: 'section-label', style: { marginBottom: 8 } }, 'ROLLED UP FROM SUB-TEAMS'),
              rollupTables.map(t =>
                React.createElement('div', { key: t.id, style: { background: 'var(--teal-dim)', border: '1px solid rgba(62,201,176,.15)', borderRadius: 'var(--r)', padding: '10px 14px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' },
                  onClick: () => onOpenTable && onOpenTable(t, t._fromTeam)
                },
                  React.createElement(I, { n: 'database', s: 14, c: 'var(--teal)' }),
                  React.createElement('div', { style: { flex: 1 } },
                    React.createElement('div', { style: { fontWeight: 600, fontSize: 12.5 } }, t.name),
                    React.createElement('div', { style: { fontSize: 10.5, color: 'var(--tx-2)', marginTop: 1 } }, 'From: ', t._fromTeam.name, ' \u00B7 ', (t.columns || []).length, ' columns'),
                    t.description && React.createElement('div', { style: { fontSize: 10, color: 'var(--tx-3)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, t.description)
                  ),
                  React.createElement('span', { className: 'tag tag-teal', style: { fontSize: 8 } }, '\u21A5 ROLLUP')
                )
              )
            );
          })(),

          // Own tables grid
          (() => {
            const ownTables = (activeTeamObj.customTables || []).filter(t => t.status === 'active');
            if (ownTables.length === 0) {
              return React.createElement('div', { style: { textAlign: 'center', padding: '40px 20px', color: 'var(--tx-3)' } },
                React.createElement(I, { n: 'database', s: 28, c: 'var(--border-1)' }),
                React.createElement('p', { style: { marginTop: 8, fontSize: 13 } }, 'No tables yet.'),
                React.createElement('p', { style: { fontSize: 11, marginTop: 4 } }, 'Tables are team-specific and subject to governance rules before activation.'));
            }
            return React.createElement('div', null,
              React.createElement('div', { className: 'section-label', style: { marginBottom: 8 } }, 'TEAM TABLES'),
              React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 } },
                ownTables.map(t =>
                  React.createElement('div', {
                    key: t.id,
                    className: 'card',
                    style: { padding: '12px 14px', cursor: 'pointer', transition: 'border-color .15s' },
                    onClick: () => onOpenTable && onOpenTable(t, activeTeamObj)
                  },
                    React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 } },
                      React.createElement(I, { n: 'database', s: 14, c: 'var(--purple)' }),
                      React.createElement('div', { style: { fontWeight: 700, fontSize: 13, flex: 1 } }, t.name),
                      t.rollup_to_parent && React.createElement('span', { className: 'tag tag-teal', style: { fontSize: 7 } }, '\u21A5 ROLLUP')
                    ),
                    React.createElement('p', { style: { fontSize: 10.5, color: 'var(--tx-2)', lineHeight: 1.4, marginBottom: 6 } },
                      (t.description || '').slice(0, 80), (t.description || '').length > 80 ? '...' : ''),
                    React.createElement('div', { style: { display: 'flex', gap: 6, flexWrap: 'wrap' } },
                      React.createElement('span', { className: 'tag tag-blue', style: { fontSize: 8 } }, (t.columns || []).length, ' col', (t.columns || []).length !== 1 ? 's' : ''),
                      React.createElement('span', { className: 'tag tag-purple', style: { fontSize: 8 } }, 'v', t.version || 1)
                    )
                  )
                )
              )
            );
          })()
        )
  ),
  dbTab === 'trash' && React.createElement('div', { className: 'anim-up' },
    Object.keys(trashedIndividuals || {}).length === 0
      ? React.createElement('div', { style: { textAlign: 'center', padding: '60px 20px', color: 'var(--tx-3)' } },
          React.createElement(I, { n: 'trash', s: 32, c: 'var(--border-1)' }),
          React.createElement('p', { style: { marginTop: 12, fontSize: 13, fontWeight: 500 } }, 'Trash is empty'),
          React.createElement('p', { style: { fontSize: 11, marginTop: 4, color: 'var(--tx-3)' } }, 'Deleted individuals will appear here and can be restored.'))
      : React.createElement('div', null,
          React.createElement('span', { className: 'section-label', style: { display: 'block', marginBottom: 10 } }, 'DELETED INDIVIDUALS — click Restore to recover'),
          Object.entries(trashedIndividuals || {}).map(([roomId, info]) =>
            React.createElement('div', {
              key: roomId,
              style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 'var(--r)', border: '1px solid var(--border-0)', background: 'var(--bg-2)', marginBottom: 6, gap: 12 }
            },
              React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 10 } },
                React.createElement('div', {
                  style: { width: 28, height: 28, borderRadius: '50%', background: 'var(--border-1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--tx-2)', fontSize: 12, fontWeight: 700, flexShrink: 0 }
                }, (info.name || '?')[0].toUpperCase()),
                React.createElement('div', null,
                  React.createElement('div', { style: { fontWeight: 600, fontSize: 13 } }, info.name || 'Unknown'),
                  React.createElement('div', { style: { fontSize: 11, color: 'var(--tx-3)', marginTop: 2 } },
                    'Deleted by ', (info.deletedBy || '').split(':')[0]?.replace('@', '') || '?',
                    ' \u00B7 ', info.deletedAt ? new Date(info.deletedAt).toLocaleDateString() : 'Unknown date'),
                  React.createElement('div', { style: { fontSize: 10, color: 'var(--tx-3)', fontFamily: 'var(--mono)', marginTop: 2 } }, roomId)
                )
              ),
              React.createElement('button', {
                className: 'b-gho b-sm',
                style: { display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' },
                onClick: () => onRestoreIndividual && onRestoreIndividual(roomId)
              }, React.createElement(I, { n: 'check', s: 11 }), 'Restore')
            )
          )
        )
  )
  );
};

/* ─── Wikidata definition fetcher ─── */
const _wikidataCache = {};
