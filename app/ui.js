const Spin = ({
  s = 18
}) => /*#__PURE__*/React.createElement("div", {
  style: {
    width: s,
    height: s,
    border: '2px solid var(--border-1)',
    borderTopColor: 'var(--gold)',
    borderRadius: '50%',
    animation: 'spin .6s linear infinite'
  }
});
/* ─── useIsMobile — responsive hook for mobile breakpoint ─── */
const useIsMobile = () => {
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width:700px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(max-width:700px)');
    const h = e => setM(e.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);
  return m;
};

/* ─── MobileMoreDrawer — slide-up drawer for overflow nav items ─── */
const MobileMoreDrawer = ({ open, onClose, items, onNavigate, children }) => {
  if (!open) return null;
  return /*#__PURE__*/React.createElement(React.Fragment, null,
    /*#__PURE__*/React.createElement("div", {
      className: "mobile-more-overlay",
      onClick: onClose
    }),
    /*#__PURE__*/React.createElement("div", {
      className: "mobile-more-drawer"
    },
      /*#__PURE__*/React.createElement("div", { className: "mobile-more-handle" }),
      (items || []).map(item => /*#__PURE__*/React.createElement("div", {
        key: item.id,
        className: "mobile-more-item",
        onClick: () => { onNavigate(item.id); onClose(); }
      },
        /*#__PURE__*/React.createElement(I, { n: item.icon, s: 18 }),
        /*#__PURE__*/React.createElement("span", null, item.label),
        item.badge > 0 && /*#__PURE__*/React.createElement("span", {
          className: `nav-badge ${item.badgeClass || 'nav-badge-gold'}`,
          style: { marginLeft: 'auto' }
        }, item.badge)
      )),
      children
    )
  );
};

/* ─── MobileBottomNav — bottom tab bar for mobile ─── */
const MobileBottomNav = ({ tabs, activeView, onNavigate, moreItems, onMoreNavigate, children }) => {
  const [moreOpen, setMoreOpen] = useState(false);
  return /*#__PURE__*/React.createElement(React.Fragment, null,
    /*#__PURE__*/React.createElement("nav", { className: "mobile-bottom-nav" },
      /*#__PURE__*/React.createElement("div", { className: "mobile-bottom-nav-items" },
        tabs.map(tab => /*#__PURE__*/React.createElement("button", {
          key: tab.id,
          className: 'mobile-bottom-nav-item' + (activeView === tab.id ? ' active' : ''),
          onClick: () => onNavigate(tab.id)
        },
          /*#__PURE__*/React.createElement("div", { style: { position: 'relative' } },
            /*#__PURE__*/React.createElement(I, { n: tab.icon, s: 20 }),
            tab.badge > 0 && /*#__PURE__*/React.createElement("span", {
              className: `nav-badge ${tab.badgeClass || 'nav-badge-gold'}`,
              style: { position: 'absolute', top: -4, right: -8, fontSize: 8, minWidth: 14, height: 14, padding: '0 3px' }
            }, tab.badge)
          ),
          /*#__PURE__*/React.createElement("span", null, tab.label)
        )),
        /*#__PURE__*/React.createElement("button", {
          className: 'mobile-bottom-nav-item' + (moreOpen ? ' active' : ''),
          onClick: () => setMoreOpen(!moreOpen)
        },
          /*#__PURE__*/React.createElement(I, { n: "grid", s: 20 }),
          /*#__PURE__*/React.createElement("span", null, "More")
        )
      )
    ),
    /*#__PURE__*/React.createElement(MobileMoreDrawer, {
      open: moreOpen,
      onClose: () => setMoreOpen(false),
      items: moreItems,
      onNavigate: id => { onMoreNavigate(id); setMoreOpen(false); }
    }, children)
  );
};

const Modal = ({
  open,
  onClose,
  title,
  w = 480,
  children
}) => {
  if (!open) return null;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'fixed',
      inset: 0,
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0,0,0,.75)',
      backdropFilter: 'blur(6px)'
    },
    onClick: onClose
  }, /*#__PURE__*/React.createElement("div", {
    className: "anim-up",
    onClick: e => e.stopPropagation(),
    style: {
      background: 'var(--bg-2)',
      border: '1px solid var(--border-1)',
      borderRadius: 'var(--r-lg)',
      width: '92%',
      maxWidth: w,
      maxHeight: '88vh',
      overflow: 'auto',
      padding: 28
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      fontSize: 16,
      fontWeight: 700
    }
  }, title), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    "aria-label": "Close",
    style: {
      background: 'transparent',
      color: 'var(--tx-2)',
      padding: 8,
      minWidth: 32,
      minHeight: 32,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 'var(--r)',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "x",
    s: 17
  }))), children));
};
const Toggle = ({
  on,
  onChange,
  disabled
}) => /*#__PURE__*/React.createElement("div", {
  className: `toggle-track ${on ? 'on' : 'off'}`,
  onClick: disabled ? undefined : onChange,
  style: disabled ? {
    opacity: .4,
    cursor: 'default'
  } : {}
}, /*#__PURE__*/React.createElement("div", {
  className: "toggle-knob"
}));
const Toast = ({
  msg,
  type = 'info',
  onClose
}) => {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, []);
  const c = {
    info: 'var(--blue)',
    success: 'var(--green)',
    error: 'var(--red)',
    warn: 'var(--gold)'
  }[type];
  return /*#__PURE__*/React.createElement("div", {
    className: "anim-up",
    style: {
      position: 'fixed',
      bottom: 20,
      right: 20,
      zIndex: 9999,
      background: 'var(--bg-2)',
      border: `1px solid ${c}30`,
      borderLeft: `3px solid ${c}`,
      borderRadius: 'var(--r)',
      padding: '11px 18px',
      fontSize: 12.5,
      boxShadow: '0 8px 32px rgba(0,0,0,.5)',
      maxWidth: 400
    }
  }, msg);
};
/* ═══════════════════ CONNECTION BADGES ═══════════════════
 * Shows user type, org affiliation, and team membership badges.
 * Used in messaging views to clarify who you're talking to.
 * ═══════════════════════════════════════════════════════════ */
const ConnectionBadges = ({ userType, orgName, orgType, teamName, teamNames, teamColors, role, verified, size = 'sm' }) => {
  const badges = [];
  const sz = size === 'xs' ? 8 : 9;
  const iconSz = size === 'xs' ? 7 : 9;
  // User type badge
  if (userType) {
    const typeMap = {
      client: { cls: 'conn-badge-client', icon: 'shield', label: ROLES.client.label },
      provider: { cls: 'conn-badge-provider', icon: 'briefcase', label: ROLES.provider.label },
      org_admin: { cls: 'conn-badge-admin', icon: 'users', label: 'Org Admin' },
      network: { cls: 'conn-badge-network', icon: 'globe', label: 'Network Coordinator' }
    };
    const t = typeMap[userType] || typeMap.provider;
    badges.push(React.createElement("span", { key: "type", className: `conn-badge ${t.cls}`, style: { fontSize: sz } },
      React.createElement(I, { n: t.icon, s: iconSz }), t.label));
  }
  // Org badge
  if (orgName) {
    badges.push(React.createElement("span", { key: "org", className: `conn-badge conn-badge-org`, style: { fontSize: sz } },
      verified ? React.createElement(I, { n: "shieldCheck", s: iconSz }) : React.createElement(I, { n: "users", s: iconSz }),
      orgName, orgType ? ` \u00B7 ${ORG_TYPE_LABELS[orgType] || orgType}` : ''));
  }
  // Team badge(s) — use dynamic team color if available
  const allTeams = teamNames || (teamName ? [teamName] : []);
  allTeams.forEach((tn, i) => {
    const tc = teamColors?.find(c => c.name === tn);
    const dynamicStyle = tc?.color_hue != null ? {
      background: `hsla(${tc.color_hue}, 65%, 55%, 0.10)`,
      color: `hsl(${tc.color_hue}, 65%, 55%)`
    } : {};
    badges.push(React.createElement("span", {
      key: `team-${i}`,
      className: `conn-badge ${tc?.color_hue != null ? '' : 'conn-badge-team'}`,
      style: { fontSize: sz, ...dynamicStyle }
    }, React.createElement(I, { n: "users", s: iconSz }), tn));
  });
  // Role badge (if within an org)
  if (role && orgName) {
    badges.push(React.createElement("span", { key: "role", className: `conn-badge conn-badge-provider`, style: { fontSize: sz } }, role));
  }
  if (badges.length === 0) return null;
  return React.createElement("span", { className: "conn-badges" }, ...badges);
};

/* ═══════════════════ STORAGE TRANSPARENCY BADGE ═══════════════════
 * Shows users exactly where their data is stored, encryption status,
 * which Matrix server hosts it, and who has access.
 *
 * Props:
 *   storageType  — 'matrix' | 'local' | 'indexeddb' | 'webhook'
 *   roomId       — Matrix room ID (for matrix type)
 *   server       — homeserver domain (auto-extracted from roomId if omitted)
 *   encrypted    — boolean, whether data is encrypted
 *   encLabel     — custom encryption label (e.g. 'AES-256-GCM' or 'Megolm E2EE')
 *   members      — array of {userId, name?, role?} with access
 *   label        — short description (e.g. 'Vault Data', 'Case Messages')
 *   extra        — array of {label, value} for additional info rows
 *   compact      — show inline compact badge (no expandable panel)
 * ═══════════════════════════════════════════════════════════════════ */
const StorageTransparencyBadge = ({
  storageType = 'matrix',
  roomId,
  server,
  encrypted,
  encLabel,
  members,
  label,
  extra,
  compact
}) => {
  const [open, setOpen] = useState(false);
  const resolvedServer = server || (roomId ? extractHomeserver(roomId) : null) || (svc._baseUrl ? new URL(svc._baseUrl).hostname : null) || 'unknown';
  const storageLabels = {
    matrix: 'Matrix Room',
    local: 'Browser localStorage',
    indexeddb: 'Browser IndexedDB',
    webhook: 'External Webhook'
  };
  const storageIcons = {
    matrix: 'server',
    local: 'lock',
    indexeddb: 'lock',
    webhook: 'globe'
  };
  if (compact) {
    return React.createElement("div", {
      style: { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 10,
        background: 'var(--bg-2)', border: '1px solid var(--border-0)', fontSize: 10, fontFamily: 'var(--mono)',
        color: 'var(--tx-2)', cursor: 'help' },
      title: `Stored in: ${storageLabels[storageType] || storageType}${roomId ? '\nRoom: ' + roomId : ''}\nServer: ${resolvedServer}${encrypted ? '\nEncrypted: ' + (encLabel || 'Yes') : ''}`
    }, React.createElement(I, { n: storageIcons[storageType] || 'server', s: 10, c: 'var(--teal)' }),
      resolvedServer,
      encrypted && React.createElement("span", { style: { color: 'var(--green)', marginLeft: 2 } }, '\u2022 encrypted'));
  }
  return React.createElement("div", { className: "stb-wrap" },
    React.createElement("div", {
      className: `stb-toggle${open ? ' open' : ''}`,
      onClick: () => setOpen(o => !o)
    },
      React.createElement(I, { n: 'database', s: 11, c: open ? 'var(--teal)' : 'var(--tx-2)' }),
      label ? `${label} — storage info` : 'Where is this stored?',
      React.createElement(I, { n: open ? 'chevron-up' : 'chevron-down', s: 10 })
    ),
    open && React.createElement("div", { className: "stb-panel" },
      // Storage type
      React.createElement("div", { className: "stb-row" },
        React.createElement("div", { className: "stb-icon", style: { background: 'var(--teal-dim)', color: 'var(--teal)' } },
          React.createElement(I, { n: storageIcons[storageType] || 'server', s: 12 })),
        React.createElement("div", null,
          React.createElement("div", { className: "stb-label" }, "Storage type"),
          React.createElement("div", { className: "stb-value" }, storageLabels[storageType] || storageType))
      ),
      // Server
      resolvedServer && React.createElement("div", { className: "stb-row" },
        React.createElement("div", { className: "stb-icon", style: { background: 'var(--blue-dim)', color: 'var(--blue)' } },
          React.createElement(I, { n: 'globe', s: 12 })),
        React.createElement("div", null,
          React.createElement("div", { className: "stb-label" }, "Server"),
          React.createElement("div", { className: "stb-value-mono" }, resolvedServer))
      ),
      // Room ID
      roomId && React.createElement("div", { className: "stb-row" },
        React.createElement("div", { className: "stb-icon", style: { background: 'var(--purple-dim)', color: 'var(--purple)' } },
          React.createElement(I, { n: 'hash', s: 12 })),
        React.createElement("div", null,
          React.createElement("div", { className: "stb-label" }, "Room ID"),
          React.createElement("div", { className: "stb-value-mono" }, roomId))
      ),
      // Encryption
      React.createElement("div", { className: "stb-row" },
        React.createElement("div", { className: "stb-icon", style: { background: encrypted ? 'var(--green-dim)' : 'var(--red-dim)', color: encrypted ? 'var(--green)' : 'var(--red)' } },
          React.createElement(I, { n: encrypted ? 'lock' : 'unlock', s: 12 })),
        React.createElement("div", null,
          React.createElement("div", { className: "stb-label" }, "Encryption"),
          React.createElement("span", { className: `stb-enc ${encrypted ? 'stb-enc-on' : 'stb-enc-off'}` },
            encrypted ? (encLabel || 'Encrypted') : 'Not encrypted'))
      ),
      // Access / Members
      members && members.length > 0 && React.createElement(React.Fragment, null,
        React.createElement("div", { className: "stb-divider" }),
        React.createElement("div", { className: "stb-row" },
          React.createElement("div", { className: "stb-icon", style: { background: 'var(--gold-dim)', color: 'var(--gold)' } },
            React.createElement(I, { n: 'users', s: 12 })),
          React.createElement("div", null,
            React.createElement("div", { className: "stb-label" }, "Who has access (" + members.length + ")"),
            React.createElement("div", { style: { display: 'flex', flexWrap: 'wrap', gap: 2, marginTop: 4 } },
              members.map((m, i) => React.createElement("span", { key: i, className: "stb-member" },
                m.name || m.userId,
                m.role && React.createElement("span", { style: { color: 'var(--tx-3)', marginLeft: 2 } }, '\u00b7 ' + m.role)
              ))
            )
          )
        )
      ),
      // Extra info
      extra && extra.length > 0 && React.createElement(React.Fragment, null,
        React.createElement("div", { className: "stb-divider" }),
        extra.map((row, i) => React.createElement("div", { key: i, className: "stb-row" },
          React.createElement("div", { className: "stb-icon", style: { background: 'var(--bg-3)', color: 'var(--tx-2)' } },
            React.createElement(I, { n: 'info', s: 12 })),
          React.createElement("div", null,
            React.createElement("div", { className: "stb-label" }, row.label),
            React.createElement("div", { className: "stb-value" }, row.value))
        ))
      )
    )
  );
};

const OP_COLORS = {
  INS: 'green',
  ALT: 'blue',
  DES: 'gold',
  SEG: 'teal',
  NUL: 'red',
  REC: 'orange',
  CON: 'blue',
  SYN: 'purple',
  SUP: 'gold'
};

/* ═══════════════════ MVP BADGE COMPONENTS (§Screen 4) ═══════════════════ */

// Maturity badge: Draft / Trial / Normative / De facto / Deprecated
const MaturityBadge = ({
  maturity,
  size = 'sm'
}) => {
  const level = MATURITY_LEVELS[maturity];
  if (!level) return null;
  const pad = size === 'lg' ? '3px 10px' : '2px 7px';
  const fs = size === 'lg' ? 11 : 9.5;
  return /*#__PURE__*/React.createElement("span", {
    className: `tag tag-${level.color}`,
    style: {
      fontSize: fs,
      padding: pad
    },
    title: level.desc
  }, level.label);
};

// Source badge: Network (with propagation level) or Local
const SourceBadge = ({
  source
}) => {
  if (!source) return /*#__PURE__*/React.createElement("span", {
    className: "tag tag-purple",
    style: {
      fontSize: 9
    }
  }, "Local");
  if (source.level === 'local') return /*#__PURE__*/React.createElement("span", {
    className: "tag tag-purple",
    style: {
      fontSize: 9
    }
  }, "Local");
  const prop = PROPAGATION_LEVELS[source.propagation];
  return /*#__PURE__*/React.createElement("span", {
    className: `tag tag-${prop?.color || 'blue'}`,
    style: {
      fontSize: 9
    },
    title: `${source.propagation}: ${prop?.desc || ''}`
  }, "Shared \xB7 ", prop?.label || source.propagation);
};

// Consent gradient — not a vote count, a distribution of positions
const ConsentGradient = ({
  positions = {},
  totalOrgs = 0
}) => {
  const counts = {};
  let responded = 0;
  for (const [orgId, pos] of Object.entries(positions)) {
    if (pos) {
      const p = pos.position || 'pending';
      counts[p] = (counts[p] || 0) + 1;
      responded++;
    }
  }
  const pending = totalOrgs - responded;
  const segments = [{
    key: 'adopt_as_is',
    count: counts.adopt_as_is || 0,
    ...CONSENT_POSITIONS.adopt_as_is
  }, {
    key: 'adopt_with_extension',
    count: counts.adopt_with_extension || 0,
    ...CONSENT_POSITIONS.adopt_with_extension
  }, {
    key: 'needs_modification',
    count: counts.needs_modification || 0,
    ...CONSENT_POSITIONS.needs_modification
  }, {
    key: 'cannot_adopt',
    count: counts.cannot_adopt || 0,
    ...CONSENT_POSITIONS.cannot_adopt
  }];
  const hasBlock = (counts.cannot_adopt || 0) > 0;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      height: 8,
      borderRadius: 4,
      overflow: 'hidden',
      background: 'var(--bg-3)',
      gap: 1
    }
  }, segments.map(seg => seg.count > 0 ? /*#__PURE__*/React.createElement("div", {
    key: seg.key,
    style: {
      flex: seg.count,
      background: `var(--${seg.color})`,
      transition: 'flex .3s'
    },
    title: `${seg.label}: ${seg.count}`
  }) : null), pending > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      flex: pending,
      background: 'var(--border-1)'
    },
    title: `Pending: ${pending}`
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      marginTop: 6,
      flexWrap: 'wrap'
    }
  }, segments.filter(s => s.count > 0).map(s => /*#__PURE__*/React.createElement("div", {
    key: s.key,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 4
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 8,
      height: 8,
      borderRadius: 2,
      background: `var(--${s.color})`
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      color: 'var(--tx-1)'
    }
  }, s.icon, " ", s.label, " (", s.count, ")"))), pending > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 4
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 8,
      height: 8,
      borderRadius: 2,
      background: 'var(--border-1)'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      color: 'var(--tx-3)'
    }
  }, "Pending (", pending, ")"))), hasBlock && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 6,
      padding: '6px 10px',
      background: 'var(--red-dim)',
      border: '1px solid rgba(232,93,93,.2)',
      borderRadius: 'var(--r)',
      fontSize: 11,
      color: 'var(--red)'
    }
  }, "Block registered \u2014 structured objection required before proceeding"));
};

// De facto field detection alert
const DeFactoAlert = ({
  fieldName,
  orgCount,
  totalOrgs,
  onFormalize,
  onDismiss
}) => /*#__PURE__*/React.createElement("div", {
  className: "card anim-up",
  style: {
    padding: '14px 18px',
    borderColor: 'var(--gold)',
    borderLeft: '3px solid var(--gold)'
  }
}, /*#__PURE__*/React.createElement("div", {
  style: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10
  }
}, /*#__PURE__*/React.createElement("div", {
  style: {
    width: 32,
    height: 32,
    borderRadius: 'var(--r)',
    background: 'var(--gold-dim)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--gold)',
    flexShrink: 0
  }
}, /*#__PURE__*/React.createElement(I, {
  n: "zap",
  s: 16
})), /*#__PURE__*/React.createElement("div", {
  style: {
    flex: 1
  }
}, /*#__PURE__*/React.createElement("div", {
  style: {
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 2
  }
}, "De facto standard detected"), /*#__PURE__*/React.createElement("div", {
  style: {
    fontSize: 12,
    color: 'var(--tx-1)',
    lineHeight: 1.5
  }
}, orgCount, " of ", totalOrgs, " orgs have a \"", fieldName, "\" field. Formalize as network standard?"), /*#__PURE__*/React.createElement("div", {
  style: {
    display: 'flex',
    gap: 8,
    marginTop: 10
  }
}, /*#__PURE__*/React.createElement("button", {
  onClick: onFormalize,
  className: "b-pri b-sm"
}, "Propose Formalization"), /*#__PURE__*/React.createElement("button", {
  onClick: onDismiss,
  className: "b-gho b-sm"
}, "Dismiss")))));

// Adoption metrics bar (ambient monitoring)
const AdoptionMetrics = ({
  adopted,
  total,
  extensions,
  divergences
}) => /*#__PURE__*/React.createElement("div", {
  className: "card",
  style: {
    padding: 14
  }
}, /*#__PURE__*/React.createElement("span", {
  className: "section-label"
}, "SCHEMA ADOPTION"), /*#__PURE__*/React.createElement("div", {
  style: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 6,
    marginTop: 4
  }
}, /*#__PURE__*/React.createElement("span", {
  style: {
    fontSize: 22,
    fontWeight: 700,
    color: 'var(--green)'
  }
}, adopted), /*#__PURE__*/React.createElement("span", {
  style: {
    fontSize: 13,
    color: 'var(--tx-2)'
  }
}, "of ", total, " network fields adopted")), /*#__PURE__*/React.createElement("div", {
  style: {
    display: 'flex',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    background: 'var(--bg-3)',
    marginTop: 8,
    gap: 1
  }
}, adopted > 0 && /*#__PURE__*/React.createElement("div", {
  style: {
    flex: adopted,
    background: 'var(--green)'
  }
}), extensions > 0 && /*#__PURE__*/React.createElement("div", {
  style: {
    flex: extensions,
    background: 'var(--blue)'
  }
}), divergences > 0 && /*#__PURE__*/React.createElement("div", {
  style: {
    flex: divergences,
    background: 'var(--gold)'
  }
}), total - adopted - (extensions || 0) - (divergences || 0) > 0 && /*#__PURE__*/React.createElement("div", {
  style: {
    flex: total - adopted - (extensions || 0) - (divergences || 0),
    background: 'var(--border-1)'
  }
})), /*#__PURE__*/React.createElement("div", {
  style: {
    display: 'flex',
    gap: 12,
    marginTop: 6,
    fontSize: 10,
    color: 'var(--tx-2)'
  }
}, extensions > 0 && /*#__PURE__*/React.createElement("span", {
  style: {
    color: 'var(--blue)'
  }
}, extensions, " with extensions"), divergences > 0 && /*#__PURE__*/React.createElement("span", {
  style: {
    color: 'var(--gold)'
  }
}, divergences, " diverged")));

// Governance proposal card (MVP §Screen 5)
const ProposalCard = ({
  proposal,
  onRespond
}) => {
  const status = PROPOSAL_STATUSES[proposal.status] || PROPOSAL_STATUSES.submitted;
  const targetProp = PROPAGATION_LEVELS[proposal.target_propagation];
  const targetMat = MATURITY_LEVELS[proposal.target_maturity];
  const positionEntries = Object.entries(proposal.positions || {});
  const totalOrgs = positionEntries.length;
  return /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      padding: 0,
      overflow: 'hidden',
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '14px 18px',
      borderBottom: '1px solid var(--border-0)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 6,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: `tag tag-${status.color}`
  }, status.label), targetProp && /*#__PURE__*/React.createElement(SourceBadge, {
    source: {
      level: 'network',
      propagation: proposal.target_propagation
    }
  }), targetMat && /*#__PURE__*/React.createElement(MaturityBadge, {
    maturity: proposal.target_maturity
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 600,
      marginBottom: 4
    }
  }, proposal.summary), proposal.detail && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: 'var(--tx-1)',
      lineHeight: 1.5
    }
  }, proposal.detail), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 12,
      marginTop: 8,
      fontSize: 10,
      color: 'var(--tx-2)',
      fontFamily: 'var(--mono)'
    }
  }, /*#__PURE__*/React.createElement("span", null, "By: ", proposal.proposed_by), proposal.governance_rhythm && /*#__PURE__*/React.createElement("span", null, proposal.governance_rhythm), proposal.deadline && /*#__PURE__*/React.createElement("span", null, "Due: ", new Date(proposal.deadline).toLocaleDateString()))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '10px 18px'
    }
  }, /*#__PURE__*/React.createElement(ConsentGradient, {
    positions: proposal.positions,
    totalOrgs: totalOrgs
  }), onRespond && proposal.status === 'consent_round' && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onRespond,
    className: "b-pri b-sm"
  }, "Review & Respond"))));
};

// Governance calendar display
const GovernanceCalendar = ({
  rhythms = Object.values(GOV_RHYTHMS)
}) => /*#__PURE__*/React.createElement("div", {
  className: "card",
  style: {
    padding: 16
  }
}, /*#__PURE__*/React.createElement("span", {
  className: "section-label"
}, "GOVERNANCE CALENDAR"), /*#__PURE__*/React.createElement("div", {
  style: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    marginTop: 8
  }
}, rhythms.map(r => /*#__PURE__*/React.createElement("div", {
  key: r.id,
  style: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '8px 12px',
    background: 'var(--bg-3)',
    borderRadius: 'var(--r)'
  }
}, /*#__PURE__*/React.createElement("div", {
  style: {
    width: 36,
    height: 36,
    borderRadius: 'var(--r)',
    background: 'var(--gold-dim)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--gold)',
    flexShrink: 0
  }
}, /*#__PURE__*/React.createElement(I, {
  n: "clock",
  s: 16
})), /*#__PURE__*/React.createElement("div", {
  style: {
    flex: 1
  }
}, /*#__PURE__*/React.createElement("div", {
  style: {
    fontSize: 13,
    fontWeight: 600
  }
}, r.name), /*#__PURE__*/React.createElement("div", {
  style: {
    fontSize: 10.5,
    color: 'var(--tx-2)',
    marginTop: 2
  }
}, r.frequency, " \xB7 ", r.duration_days, " day window \xB7 ", r.participants))))));

/* ═══════════════════ GIVEN/MEANT DIVIDE VISUALIZATION ═══════════════════ */

// Core visualization: observation on the left, crossing in the middle, frameworks on the right
const GivenMeantDivide = ({
  observation,
  compact = false
}) => {
  // observation: {prompt, value, valueLabel, reporter, timestamp, eoTrace, frameworks}
  const [expandedChains, setExpandedChains] = useState(new Set());
  const toggleChain = id => setExpandedChains(p => {
    const n = new Set(p);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });
  if (!observation) return null;
  const {
    prompt,
    value,
    valueLabel,
    reporter,
    timestamp,
    eoTrace,
    frameworks
  } = observation;

  // Detect divergence: do frameworks classify differently?
  const classifications = frameworks?.map(f => f.classification) || [];
  const uniqueClassifications = [...new Set(classifications)];
  const hasDivergence = uniqueClassifications.length > 1;

  // Collect all unique EO ops used in the crossing
  const crossingOps = new Set();
  (frameworks || []).forEach(f => (f.eo_chain || []).forEach(s => crossingOps.add(s.op)));
  return /*#__PURE__*/React.createElement("div", {
    className: "gm-container anim-up",
    style: compact ? {
      minHeight: 'auto'
    } : {}
  }, /*#__PURE__*/React.createElement("div", {
    className: "gm-given",
    style: compact ? {
      flex: '0 0 280px',
      padding: 14
    } : {}
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "tag tag-teal",
    style: {
      fontSize: 9
    }
  }, "GIVEN"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      fontFamily: 'var(--mono)',
      color: 'var(--tx-3)'
    }
  }, "OBSERVATION")), prompt && /*#__PURE__*/React.createElement("div", {
    className: "gm-obs-field"
  }, prompt), /*#__PURE__*/React.createElement("div", {
    className: "gm-obs-value"
  }, valueLabel || value), /*#__PURE__*/React.createElement("div", {
    className: "gm-meta-row"
  }, reporter && /*#__PURE__*/React.createElement("span", null, reporter), timestamp && /*#__PURE__*/React.createElement("span", null, new Date(timestamp).toLocaleDateString())), eoTrace && /*#__PURE__*/React.createElement("div", {
    className: "gm-eo-trace"
  }, eoTrace), !compact && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 12,
      padding: '8px 10px',
      background: 'var(--bg-3)',
      borderRadius: 'var(--r)',
      fontSize: 10.5,
      color: 'var(--tx-2)',
      lineHeight: 1.5
    }
  }, "This is ground truth. The observation just ", /*#__PURE__*/React.createElement("em", null, "is"), ". Everything to the right is what it ", /*#__PURE__*/React.createElement("em", null, "means"), ", according to whom.")), /*#__PURE__*/React.createElement("div", {
    className: "gm-crossing"
  }, /*#__PURE__*/React.createElement("div", {
    className: "gm-crossing-arrow",
    title: "Epistemic crossing: observation becomes interpretation"
  }, "\u2192"), /*#__PURE__*/React.createElement("div", {
    className: "gm-crossing-label"
  }, "GIVEN \u2192 MEANT"), [...crossingOps].map(op => /*#__PURE__*/React.createElement("div", {
    key: op,
    className: "gm-crossing-op",
    style: {
      background: `var(--${OP_COLORS[op] || 'blue'}-dim)`,
      color: `var(--${OP_COLORS[op] || 'blue'})`,
      borderColor: `var(--${OP_COLORS[op] || 'blue'})20`
    }
  }, op))), /*#__PURE__*/React.createElement("div", {
    className: "gm-meant",
    style: compact ? {
      padding: 14
    } : {}
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      marginBottom: 4
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "tag tag-gold",
    style: {
      fontSize: 9
    }
  }, "MEANT"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      fontFamily: 'var(--mono)',
      color: 'var(--tx-3)'
    }
  }, "FRAMEWORK INTERPRETATIONS (", frameworks?.length || 0, ")")), hasDivergence && /*#__PURE__*/React.createElement("div", {
    className: "gm-divergence"
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--gold)',
      fontWeight: 700,
      fontSize: 13,
      lineHeight: 1
    }
  }, "\u25C6"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("strong", {
    style: {
      color: 'var(--gold)',
      fontSize: 11
    }
  }, "Frameworks diverge"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      fontSize: 10,
      color: 'var(--tx-2)',
      marginTop: 2
    }
  }, uniqueClassifications.length, " distinct classifications from the same observation. This is SUP made visible \u2014 the value exists in superposition across frameworks."))), (frameworks || []).map((fw, i) => {
    const fwColor = FRAMEWORK_COLORS[fw.authority_id] || {
      accent: 'purple',
      label: '?'
    };
    const isExpanded = expandedChains.has(fw.id);
    return /*#__PURE__*/React.createElement("div", {
      key: fw.id || i,
      className: "gm-fw-card",
      "data-accent": fwColor.accent
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 8
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
        gap: 6,
        marginBottom: 4,
        flexWrap: 'wrap'
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: `tag tag-${fwColor.accent}`,
      style: {
        fontSize: 8.5
      }
    }, fw.authority_org), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12,
        fontWeight: 600
      }
    }, fw.authority_name)), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 14,
        fontWeight: 700,
        color: 'var(--gold)',
        marginBottom: 4
      }
    }, fw.classification), fw.provision && /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 10,
        fontFamily: 'var(--mono)',
        color: 'var(--tx-2)',
        marginBottom: 4
      }
    }, fw.provision), fw.authority_uri && /*#__PURE__*/React.createElement("a", {
      href: fw.authority_uri,
      target: "_blank",
      rel: "noopener",
      style: {
        fontSize: 9.5,
        fontFamily: 'var(--mono)',
        color: 'var(--blue)',
        display: 'block',
        marginBottom: 4,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        textDecoration: 'none',
        maxWidth: '100%'
      }
    }, fw.authority_uri), fw.implication && /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11,
        color: 'var(--tx-1)',
        padding: '4px 8px',
        background: 'var(--bg-3)',
        borderRadius: 'var(--r)',
        display: 'inline-block',
        marginTop: 2
      }
    }, fw.implication))), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 8,
        borderTop: '1px solid var(--border-0)',
        paddingTop: 8
      }
    }, /*#__PURE__*/React.createElement("div", {
      onClick: () => toggleChain(fw.id),
      style: {
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 4
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 9,
        fontFamily: 'var(--mono)',
        color: 'var(--tx-3)'
      }
    }, "EO CHAIN"), /*#__PURE__*/React.createElement(I, {
      n: isExpanded ? 'x' : 'chevR',
      s: 9,
      c: "var(--tx-3)"
    })), !isExpanded && fw.eo_compact && /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 9,
        fontFamily: 'var(--mono)',
        color: 'var(--purple)',
        marginTop: 3
      }
    }, fw.eo_compact), isExpanded && /*#__PURE__*/React.createElement("div", {
      className: "gm-chain"
    }, (fw.eo_chain || []).map((step, si) => /*#__PURE__*/React.createElement(React.Fragment, {
      key: si
    }, si > 0 && /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--tx-3)',
        fontSize: 10
      }
    }, "\u2192"), /*#__PURE__*/React.createElement("span", {
      className: "gm-chain-step",
      style: {
        background: `var(--${OP_COLORS[step.op] || 'blue'}-dim)`,
        color: `var(--${OP_COLORS[step.op] || 'blue'})`
      }
    }, step.op, "(", step.desc, ")"))))));
  }), (!frameworks || frameworks.length === 0) && /*#__PURE__*/React.createElement("div", {
    className: "gm-wb-empty"
  }, /*#__PURE__*/React.createElement(I, {
    n: "grid",
    s: 24
  }), /*#__PURE__*/React.createElement("p", {
    style: {
      marginTop: 8,
      fontSize: 12
    }
  }, "No frameworks bound"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 10.5,
      color: 'var(--tx-3)',
      marginTop: 4
    }
  }, "This observation is recorded but not yet interpreted."))));
};

// Record-level GIVEN/MEANT display for a specific client observation
const RecordGivenMeant = ({
  promptKey,
  value,
  reporter,
  timestamp
}) => {
  const prompt = DEFAULT_PROMPTS.find(p => p.key === promptKey);
  if (!prompt) return null;
  const option = prompt.options?.find(o => o.v === value);
  const binding = FRAMEWORK_BINDINGS[promptKey]?.bindings?.[value];
  const observation = {
    prompt: prompt.question,
    value: value,
    valueLabel: option?.l || value,
    reporter: reporter || `${ROLES.client.label} self-report`,
    timestamp: timestamp,
    eoTrace: prompt.eo?.trace,
    frameworks: binding?.frameworks || []
  };
  return /*#__PURE__*/React.createElement(GivenMeantDivide, {
    observation: observation,
    compact: true
  });
};

/* ═══════════════════ FRAMEWORK TOGGLE PANEL ═══════════════════
 * Lets users toggle data-field frameworks on/off. Each framework
 * injects a set of vault fields tagged to authoritative URIs,
 * giving local field values an objective semantic anchor.
 * ═══════════════════════════════════════════════════════════════ */
const FrameworkTogglePanel = ({
  enabledFrameworks,
  onToggle
}) => {
  const [expandedFw, setExpandedFw] = useState(null);
  const handleToggle = fwId => {
    const next = enabledFrameworks.includes(fwId) ? enabledFrameworks.filter(id => id !== fwId) : [...enabledFrameworks, fwId];
    onToggle(next);
  };
  const domainGroups = useMemo(() => {
    const groups = {};
    FRAMEWORK_FIELD_STANDARDS.forEach(fw => {
      if (!groups[fw.domain]) groups[fw.domain] = [];
      groups[fw.domain].push(fw);
    });
    return groups;
  }, []);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--teal-dim)',
      border: '1px solid rgba(62,201,176,.15)',
      borderRadius: 'var(--r)',
      padding: '10px 14px',
      fontSize: 11.5,
      color: 'var(--tx-1)',
      lineHeight: 1.6
    }
  }, "Toggle frameworks to add their standardized fields to your vault. Each field is tagged to an authoritative URI \u2014 turning local data into semantically anchored, interoperable records."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      flexWrap: 'wrap',
      marginBottom: 4
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: 'var(--tx-2)',
      alignSelf: 'center'
    }
  }, "Active:"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      color: 'var(--green)'
    }
  }, enabledFrameworks.length), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: 'var(--tx-3)'
    }
  }, "of ", FRAMEWORK_FIELD_STANDARDS.length, " frameworks"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: 'var(--tx-3)',
      marginLeft: 4
    }
  }, "\xB7"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: 'var(--tx-2)'
    }
  }, getFrameworkFields(enabledFrameworks).length, " fields added")), Object.entries(domainGroups).map(([domain, frameworks]) => /*#__PURE__*/React.createElement("div", {
    key: domain
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label",
    style: {
      fontSize: 10,
      marginBottom: 6,
      display: 'block'
    }
  }, domain.toUpperCase()), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6
    }
  }, frameworks.map(fw => {
    const isEnabled = enabledFrameworks.includes(fw.id);
    const isExpanded = expandedFw === fw.id;
    return /*#__PURE__*/React.createElement("div", {
      key: fw.id,
      className: "card",
      style: {
        padding: 0,
        overflow: 'hidden',
        borderColor: isEnabled ? `var(--${fw.accent})` : 'var(--border-0)',
        transition: 'border-color .2s'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12
      }
    }, /*#__PURE__*/React.createElement(Toggle, {
      on: isEnabled,
      onChange: () => handleToggle(fw.id)
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        flexWrap: 'wrap'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13.5,
        fontWeight: 600
      }
    }, fw.name), /*#__PURE__*/React.createElement("span", {
      className: `tag tag-${fw.accent}`,
      style: {
        fontSize: 8.5
      }
    }, fw.spec), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 10.5,
        color: 'var(--tx-2)'
      }
    }, fw.fields.length, " fields")), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11,
        color: 'var(--tx-2)',
        marginTop: 2
      }
    }, fw.description)), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("a", {
      href: fw.uri,
      target: "_blank",
      rel: "noopener",
      style: {
        fontSize: 9,
        fontFamily: 'var(--mono)',
        color: `var(--${fw.accent})`,
        textDecoration: 'none'
      },
      title: fw.uri
    }, "spec"), /*#__PURE__*/React.createElement("span", {
      onClick: () => setExpandedFw(isExpanded ? null : fw.id),
      style: {
        cursor: 'pointer',
        color: 'var(--tx-3)',
        transition: 'color .15s'
      },
      onMouseEnter: e => e.currentTarget.style.color = 'var(--tx-0)',
      onMouseLeave: e => e.currentTarget.style.color = 'var(--tx-3)'
    }, /*#__PURE__*/React.createElement(I, {
      n: isExpanded ? 'x' : 'chevR',
      s: 12
    })))), isExpanded && /*#__PURE__*/React.createElement("div", {
      style: {
        borderTop: '1px solid var(--border-0)',
        padding: '10px 16px',
        background: 'var(--bg-1)'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))',
        gap: 6
      }
    }, fw.fields.map(f => /*#__PURE__*/React.createElement("div", {
      key: f.key,
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 8px',
        borderRadius: 'var(--r)',
        background: 'var(--bg-2)',
        border: '1px solid var(--border-0)',
        fontSize: 11.5
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        flex: 1,
        fontWeight: 500
      }
    }, f.label), f.sensitive && /*#__PURE__*/React.createElement("span", {
      className: "tag tag-red",
      style: {
        fontSize: 7.5,
        padding: '1px 5px'
      }
    }, "SENSITIVE"), /*#__PURE__*/React.createElement("a", {
      href: f.uri,
      target: "_blank",
      rel: "noopener",
      style: {
        color: `var(--${fw.accent})`,
        textDecoration: 'none',
        fontSize: 9,
        fontFamily: 'var(--mono)'
      }
    }, f.property)))), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 8,
        fontSize: 10,
        fontFamily: 'var(--mono)',
        color: 'var(--tx-3)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
      }
    }, fw.uri)));
  })))));
};

/* ═══════════════════ SCHEMA WORKBENCH ═══════════════════ */
const SWC_DARK = {
  bg: "#07090d",
  surface: "#0e1218",
  raised: "#151b23",
  hover: "#1b2330",
  border: "#1d2735",
  borderLit: "#2c3d52",
  text: "#c0c9d4",
  muted: "#7a8da0",
  dim: "#4a5d72",
  white: "#edf0f5",
  given: "#2dd4a0",
  givenBorder: "#18694e",
  meant: "#a78bfa",
  meantBorder: "#4a2d8a",
  fw: ["#60a5fa", "#f0abfc", "#fbbf24", "#34d399", "#fb7185"],
  fwBg: i => `${["#60a5fa", "#f0abfc", "#fbbf24", "#34d399", "#fb7185"][i % 5]}12`,
  fwBorder: i => `${["#60a5fa", "#f0abfc", "#fbbf24", "#34d399", "#fb7185"][i % 5]}40`,
  sup: "#fbbf24",
  supBg: "rgba(251,191,36,0.06)",
  red: "#f87171"
};
const SWC_LIGHT = {
  bg: "#f5f5f7",
  surface: "#ebedf0",
  raised: "#e0e2e7",
  hover: "#d4d7dd",
  border: "#b8bcc6",
  borderLit: "#a0a5b2",
  text: "#2e3340",
  muted: "#4a5168",
  dim: "#8890a0",
  white: "#111318",
  given: "#137a6a",
  givenBorder: "#0a5c4d",
  meant: "#6938c0",
  meantBorder: "#4a2d8a",
  fw: ["#2563b0", "#9333b0", "#8a6d1e", "#177a4a", "#c03050"],
  fwBg: i => `${["#2563b0", "#9333b0", "#8a6d1e", "#177a4a", "#c03050"][i % 5]}14`,
  fwBorder: i => `${["#2563b0", "#9333b0", "#8a6d1e", "#177a4a", "#c03050"][i % 5]}40`,
  sup: "#8a6d1e",
  supBg: "rgba(138,109,30,0.08)",
  red: "#c03030"
};
const useSWC = () => {
  const {
    theme
  } = useTheme();
  return theme === 'light' ? SWC_LIGHT : SWC_DARK;
};
/* Legacy alias — components that haven't migrated yet still read SWC */
let SWC = SWC_DARK;
const SwTag = ({
  color = SWC.muted,
  children,
  sm,
  mono,
  onClick,
  style: sx
}) => /*#__PURE__*/React.createElement("span", {
  onClick: onClick,
  style: {
    display: "inline-flex",
    alignItems: "center",
    padding: sm ? "1px 7px" : "2px 9px",
    fontSize: sm ? 11 : 12,
    fontWeight: 600,
    fontFamily: mono ? "var(--mono)" : "inherit",
    background: `${color}10`,
    border: `1px solid ${color}28`,
    borderRadius: 3,
    color,
    cursor: onClick ? "pointer" : "default",
    letterSpacing: "0.01em",
    lineHeight: "20px",
    whiteSpace: "nowrap",
    ...sx
  }
}, children);
const SwDot = ({
  color,
  size = 6
}) => /*#__PURE__*/React.createElement("span", {
  style: {
    width: size,
    height: size,
    borderRadius: "50%",
    background: color,
    display: "inline-block",
    flexShrink: 0
  }
});
const SwBtn = ({
  children,
  accent = SWC.given,
  ghost,
  disabled,
  onClick,
  style: sx
}) => /*#__PURE__*/React.createElement("button", {
  disabled: disabled,
  onClick: onClick,
  style: {
    padding: "8px 18px",
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 600,
    fontFamily: "inherit",
    cursor: disabled ? "default" : "pointer",
    transition: "all 0.15s",
    opacity: disabled ? 0.4 : 1,
    border: ghost ? `1px solid ${accent}40` : `1px solid ${accent}`,
    background: ghost ? "transparent" : accent,
    color: ghost ? accent : SWC.bg,
    ...sx
  }
}, children);
const SwInput = ({
  value,
  onChange,
  placeholder,
  autoFocus,
  onKeyDown,
  style: sx
}) => /*#__PURE__*/React.createElement("input", {
  autoFocus: autoFocus,
  value: value,
  onChange: e => onChange(e.target.value),
  onKeyDown: onKeyDown,
  placeholder: placeholder,
  style: {
    width: "100%",
    padding: "10px 14px",
    borderRadius: 6,
    border: `1px solid ${SWC.border}`,
    background: SWC.surface,
    color: SWC.white,
    fontSize: 14,
    fontFamily: "inherit",
    outline: "none",
    boxSizing: "border-box",
    ...sx
  },
  onFocus: e => e.target.style.borderColor = SWC.borderLit,
  onBlur: e => e.target.style.borderColor = SWC.border
});
function SwMRow({
  opt,
  frameworks,
  getBindingCode,
  setBind,
  clearBind,
  hasConflict,
  isLast
}) {
  const [openCell, setOpenCell] = useState(null);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      borderBottom: !isLast ? `1px solid ${SWC.border}` : "none"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: `minmax(140px,180px) repeat(${frameworks.length}, 1fr)`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "10px 14px",
      fontSize: 14,
      color: SWC.white,
      fontWeight: 500,
      display: "flex",
      alignItems: "center",
      gap: 5
    }
  }, opt.label, hasConflict(opt) && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11
    }
  }, "\u26A1")), frameworks.map((fw, fi) => {
    const code = getBindingCode(opt.id, fw.id);
    const isOpen = openCell === fw.id;
    const hasCodes = fw.codes.length > 0;
    return /*#__PURE__*/React.createElement("div", {
      key: fw.id,
      onClick: () => {
        if (hasCodes) setOpenCell(isOpen ? null : fw.id);
      },
      style: {
        padding: "9px 10px",
        textAlign: "center",
        borderLeft: `1px solid ${SWC.border}`,
        cursor: hasCodes ? "pointer" : "default",
        transition: "background 0.1s",
        background: isOpen ? SWC.fwBg(fi) : "transparent"
      },
      onMouseEnter: e => {
        if (hasCodes && !isOpen) e.currentTarget.style.background = SWC.hover;
      },
      onMouseLeave: e => {
        if (!isOpen) e.currentTarget.style.background = isOpen ? SWC.fwBg(fi) : "transparent";
      }
    }, code ? /*#__PURE__*/React.createElement(SwTag, {
      color: SWC.fw[fi % 5],
      mono: true,
      style: {
        fontSize: 13
      }
    }, code.code) : hasCodes ? /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12.5,
        color: SWC.dim
      }
    }, "\u2014") : /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11.5,
        color: SWC.dim
      }
    }, "no codes"));
  })), openCell && (() => {
    const fi = frameworks.findIndex(f => f.id === openCell);
    const fw = frameworks[fi];
    if (!fw) return null;
    const cur = getBindingCode(opt.id, fw.id);
    return /*#__PURE__*/React.createElement("div", {
      style: {
        padding: "8px 12px 10px",
        background: SWC.fwBg(fi),
        borderTop: `1px solid ${SWC.fwBorder(fi)}`
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12,
        color: SWC.muted,
        marginBottom: 8,
        fontWeight: 600
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        color: SWC.fw[fi % 5]
      }
    }, fw.name), " reading for \"", opt.label, "\":"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexWrap: "wrap",
        gap: 6
      }
    }, fw.codes.map(c => {
      const a = cur?.id === c.id;
      return /*#__PURE__*/React.createElement("div", {
        key: c.id,
        onClick: e => {
          e.stopPropagation();
          if (a) clearBind(opt.id, fw.id);else setBind(opt.id, c.id, fw.id);
          setOpenCell(null);
        },
        style: {
          padding: "6px 10px",
          borderRadius: 6,
          cursor: "pointer",
          transition: "all 0.12s",
          display: "flex",
          alignItems: "center",
          gap: 6,
          border: `1px solid ${a ? SWC.fw[fi % 5] : SWC.border}`,
          background: a ? `${SWC.fw[fi % 5]}18` : "transparent"
        },
        onMouseEnter: e => {
          e.currentTarget.style.borderColor = SWC.fw[fi % 5];
          if (!a) e.currentTarget.style.background = SWC.hover;
        },
        onMouseLeave: e => {
          e.currentTarget.style.borderColor = a ? SWC.fw[fi % 5] : SWC.border;
          e.currentTarget.style.background = a ? `${SWC.fw[fi % 5]}18` : "transparent";
        }
      }, /*#__PURE__*/React.createElement(SwTag, {
        color: SWC.fw[fi % 5],
        mono: true,
        sm: true
      }, c.code), /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 13,
          color: a ? SWC.white : SWC.text
        }
      }, c.label), a && /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 11.5,
          color: SWC.fw[fi % 5]
        }
      }, "\u2713"));
    })), cur && /*#__PURE__*/React.createElement("div", {
      onClick: e => {
        e.stopPropagation();
        clearBind(opt.id, fw.id);
        setOpenCell(null);
      },
      style: {
        fontSize: 12.5,
        color: SWC.dim,
        cursor: "pointer",
        marginTop: 8
      }
    }, "Clear"));
  })());
}

/* ═══════════════════ BACKUP SETTINGS VIEW ═══════════════════
 * Opt-in encrypted backup via Filen. Shows setup, confirmation, recovery,
 * and connected states. Pool Bridge for paid accounts.
 *
 * Depends on: KhoraBackup (app/backup.js), svc.userId, I (icons)
 * ═══════════════════════════════════════════════════════════════════ */
const BackupSettingsView = ({ showToast }) => {
  const [phase, setPhase] = useState(() => {
    if (KhoraBackup.isConnected) return 'connected';
    const creds = KhoraBackup.savedCreds;
    if (creds && creds.matrixId && creds.email) return 'auto';
    return 'setup';
  });
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [storage, setStorage] = useState(KhoraBackup.storage);
  const [bridgeSettings, setBridgeSettings] = useState(KhoraBackup.bridgeSettings);
  const [bridgeCap, setBridgeCap] = useState(5);
  const [files, setFiles] = useState(null);
  const [showFiles, setShowFiles] = useState(false);
  const [lastBackup, setLastBackup] = useState(() => {
    try { return localStorage.getItem('khora_backup_last'); } catch { return null; }
  });

  // Listen for backup events
  useEffect(() => {
    const handler = ev => {
      if (ev.event === 'connected') { setPhase('connected'); setStorage(KhoraBackup.storage); setBridgeSettings(KhoraBackup.bridgeSettings); }
      if (ev.event === 'disconnected') { setPhase('setup'); setFiles(null); }
      if (ev.event === 'backup_complete') { const ts = new Date().toISOString(); setLastBackup(ts); try { localStorage.setItem('khora_backup_last', ts); } catch {} }
      if (ev.event === 'bridge_enabled') setBridgeSettings(KhoraBackup.bridgeSettings);
      if (ev.event === 'bridge_disabled') setBridgeSettings(KhoraBackup.bridgeSettings);
    };
    KhoraBackup.addListener(handler);
    return () => KhoraBackup.removeListener(handler);
  }, []);

  // Auto-connect on mount if creds exist
  useEffect(() => {
    if (phase === 'auto') {
      setBusy(true);
      KhoraBackup.autoConnect().then(ok => {
        setBusy(false);
        if (ok) { setPhase('connected'); setStorage(KhoraBackup.storage); }
        else setPhase('setup');
      }).catch(() => { setBusy(false); setPhase('setup'); });
    }
  }, []);

  const handleSetup = async () => {
    const matrixId = svc.userId;
    const em = email.trim();
    if (!em || !em.includes('@')) { showToast('Enter a valid email address', 'error'); return; }
    setBusy(true);
    try {
      const result = await KhoraBackup.connect(matrixId, em);
      if (result === true) {
        if (!KhoraBackup.hasSeenRecovery) setPhase('recovery');
        else { setPhase('connected'); setStorage(KhoraBackup.storage); showToast('Backup connected', 'success'); }
      } else if (result === 'needs_confirmation') {
        setPhase('confirm');
        showToast('Check your email for a verification link', 'info');
      }
    } catch (e) { showToast('Backup setup failed: ' + e.message, 'error'); }
    setBusy(false);
  };

  const handleRetryConfirm = async () => {
    setBusy(true);
    try {
      const ok = await KhoraBackup.retryAfterConfirmation();
      if (ok) {
        if (!KhoraBackup.hasSeenRecovery) setPhase('recovery');
        else { setPhase('connected'); setStorage(KhoraBackup.storage); showToast('Backup connected', 'success'); }
      } else { showToast('Not ready yet — check your email for the confirmation link', 'warn'); }
    } catch (e) { showToast('Connection failed: ' + e.message, 'error'); }
    setBusy(false);
  };

  const handleResend = async () => {
    try { const ok = await KhoraBackup.resendConfirmation(); showToast(ok ? 'Verification email resent' : 'Could not resend', 'info'); }
    catch { showToast('Failed to resend', 'error'); }
  };

  const handleRecoveryDone = () => {
    KhoraBackup.markRecoverySeen();
    setPhase('connected');
    setStorage(KhoraBackup.storage);
    showToast('Backup connected', 'success');
  };

  const handleDisconnect = () => {
    KhoraBackup.disconnect();
    setPhase('setup');
    setFiles(null);
    showToast('Backup disconnected', 'info');
  };

  const loadFiles = async () => {
    try { const listing = await KhoraBackup.listFolder(); setFiles(listing); setShowFiles(true); }
    catch (e) { showToast('Could not load files: ' + e.message, 'error'); }
  };

  const handleBridgeEnable = () => {
    try { KhoraBackup.enableBridge(bridgeCap); showToast('Pool Bridge enabled — you\'re helping the network', 'success'); }
    catch (e) { showToast('Bridge error: ' + e.message, 'error'); }
  };

  const handleBridgeDisable = () => {
    KhoraBackup.disableBridge();
    showToast('Pool Bridge disabled', 'info');
  };

  const cardStyle = { background: 'var(--bg-2)', border: '1px solid var(--border-0)', borderRadius: 'var(--r-lg)', padding: '24px 22px' };
  const labelStyle = { fontSize: 10.5, fontWeight: 600, color: 'var(--tx-2)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6, display: 'block' };
  const inputStyle = { width: '100%', background: 'var(--bg-1)', border: '1px solid var(--border-0)', borderRadius: 'var(--r)', padding: '10px 14px', color: 'var(--tx-0)', fontFamily: 'var(--mono)', fontSize: 13, outline: 'none' };

  // ── Setup phase ──
  if (phase === 'setup') return /*#__PURE__*/React.createElement("div", { style: { padding: 20, maxWidth: 560 } },
    /*#__PURE__*/React.createElement("h2", { style: { fontSize: 18, fontWeight: 700, marginBottom: 4 } }, "Encrypted Backup"),
    /*#__PURE__*/React.createElement("p", { style: { fontSize: 13, color: 'var(--tx-2)', marginBottom: 20, lineHeight: 1.5 } },
      "Back up your data to an encrypted cloud vault. Your Matrix ID is your recovery key \u2014 if your server ever goes down, you can recover everything with just your Matrix ID and email."),
    /*#__PURE__*/React.createElement("div", { style: cardStyle },
      /*#__PURE__*/React.createElement("div", { style: { textAlign: 'center', marginBottom: 16 } },
        /*#__PURE__*/React.createElement("div", { style: { width: 48, height: 48, borderRadius: '50%', background: 'var(--teal-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', color: 'var(--teal)' } },
          /*#__PURE__*/React.createElement(I, { n: "shield", s: 22 })),
        /*#__PURE__*/React.createElement("div", { style: { fontSize: 15, fontWeight: 700, marginBottom: 4 } }, "Set Up Encrypted Backup"),
        /*#__PURE__*/React.createElement("div", { style: { fontSize: 12, color: 'var(--tx-2)' } }, "Your data \xB7 your keys \xB7 always recoverable")),
      /*#__PURE__*/React.createElement("label", { style: labelStyle }, "MATRIX ID"),
      /*#__PURE__*/React.createElement("input", { type: "text", value: svc.userId || '', disabled: true, style: { ...inputStyle, opacity: 0.6, marginBottom: 14 } }),
      /*#__PURE__*/React.createElement("label", { style: labelStyle }, "RECOVERY EMAIL"),
      /*#__PURE__*/React.createElement("input", { type: "email", placeholder: "you@example.com", value: email, onChange: e => setEmail(e.target.value), style: { ...inputStyle, marginBottom: 18 }, onKeyDown: e => { if (e.key === 'Enter') handleSetup(); } }),
      /*#__PURE__*/React.createElement("button", { className: "b-pri", onClick: handleSetup, disabled: busy, style: { width: '100%', justifyContent: 'center' } },
        busy ? /*#__PURE__*/React.createElement(Spin, { s: 14 }) : /*#__PURE__*/React.createElement(I, { n: "shield", s: 14 }),
        busy ? ' Setting up\u2026' : ' Enable Backup')));

  // ── Email confirmation phase ──
  if (phase === 'confirm') return /*#__PURE__*/React.createElement("div", { style: { padding: 20, maxWidth: 560 } },
    /*#__PURE__*/React.createElement("h2", { style: { fontSize: 18, fontWeight: 700, marginBottom: 4 } }, "Encrypted Backup"),
    /*#__PURE__*/React.createElement("div", { style: cardStyle },
      /*#__PURE__*/React.createElement("div", { style: { textAlign: 'center' } },
        /*#__PURE__*/React.createElement("div", { style: { width: 48, height: 48, borderRadius: '50%', background: 'var(--gold-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', color: 'var(--gold)' } },
          /*#__PURE__*/React.createElement(I, { n: "msg", s: 22 })),
        /*#__PURE__*/React.createElement("div", { style: { fontSize: 15, fontWeight: 700, marginBottom: 8 } }, "Confirm Your Email"),
        /*#__PURE__*/React.createElement("p", { style: { fontSize: 13, color: 'var(--tx-2)', lineHeight: 1.5, marginBottom: 4 } },
          "We sent a verification link to:"),
        /*#__PURE__*/React.createElement("div", { style: { fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 600, color: 'var(--teal)', marginBottom: 16 } }, KhoraBackup.email || email),
        /*#__PURE__*/React.createElement("p", { style: { fontSize: 12, color: 'var(--tx-2)', marginBottom: 18 } },
          "Click the link in the email, then come back here."),
        /*#__PURE__*/React.createElement("button", { className: "b-pri", onClick: handleRetryConfirm, disabled: busy, style: { width: '100%', justifyContent: 'center', marginBottom: 10 } },
          busy ? /*#__PURE__*/React.createElement(Spin, { s: 14 }) : null,
          busy ? ' Connecting\u2026' : "I've confirmed \u2014 activate backup"),
        /*#__PURE__*/React.createElement("div", { style: { display: 'flex', gap: 8, justifyContent: 'center' } },
          /*#__PURE__*/React.createElement("button", { className: "b-gho b-sm", onClick: handleResend }, "Resend email"),
          /*#__PURE__*/React.createElement("button", { className: "b-gho b-sm", onClick: () => setPhase('setup') }, "\u2190 Back")))));

  // ── Recovery info phase ──
  if (phase === 'recovery') return /*#__PURE__*/React.createElement("div", { style: { padding: 20, maxWidth: 560 } },
    /*#__PURE__*/React.createElement("h2", { style: { fontSize: 18, fontWeight: 700, marginBottom: 4 } }, "Encrypted Backup"),
    /*#__PURE__*/React.createElement("div", { style: cardStyle },
      /*#__PURE__*/React.createElement("div", { style: { textAlign: 'center' } },
        /*#__PURE__*/React.createElement("div", { style: { width: 48, height: 48, borderRadius: '50%', background: 'var(--teal-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', color: 'var(--teal)' } },
          /*#__PURE__*/React.createElement(I, { n: "shieldCheck", s: 22 })),
        /*#__PURE__*/React.createElement("div", { style: { fontSize: 15, fontWeight: 700, marginBottom: 8 } }, "Your Recovery Info"),
        /*#__PURE__*/React.createElement("p", { style: { fontSize: 13, color: 'var(--tx-2)', lineHeight: 1.5, marginBottom: 16 } },
          "Save this somewhere safe. If your server ever goes down, this is all you need to recover every file.")),
      /*#__PURE__*/React.createElement("div", { style: { background: 'var(--bg-1)', border: '2px dashed var(--border-0)', borderRadius: 'var(--r)', padding: 16, textAlign: 'center', marginBottom: 10 } },
        /*#__PURE__*/React.createElement("div", { style: { fontSize: 10, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 } }, "RECOVERY IDENTITY"),
        /*#__PURE__*/React.createElement("div", { style: { fontFamily: 'var(--mono)', fontSize: 14, color: 'var(--teal)', fontWeight: 600, wordBreak: 'break-all', userSelect: 'all' } }, KhoraBackup.identity)),
      /*#__PURE__*/React.createElement("div", { style: { background: 'var(--bg-1)', border: '2px dashed var(--border-0)', borderRadius: 'var(--r)', padding: 16, textAlign: 'center', marginBottom: 16 } },
        /*#__PURE__*/React.createElement("div", { style: { fontSize: 10, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 } }, "RECOVERY EMAIL"),
        /*#__PURE__*/React.createElement("div", { style: { fontFamily: 'var(--mono)', fontSize: 14, color: 'var(--tx-0)', fontWeight: 600, userSelect: 'all' } }, KhoraBackup.email)),
      /*#__PURE__*/React.createElement("p", { style: { fontSize: 11, color: 'var(--tx-3)', textAlign: 'center', lineHeight: 1.6, marginBottom: 14 } },
        "That\u2019s it \u2014 those two things. No passwords to remember. Your encryption key is derived automatically from your Matrix ID."),
      /*#__PURE__*/React.createElement("button", { className: "b-pri", onClick: handleRecoveryDone, style: { width: '100%', justifyContent: 'center' } },
        /*#__PURE__*/React.createElement(I, { n: "shieldCheck", s: 14 }), " Got it \u2014 open my backup")));

  // ── Auto-reconnecting ──
  if (phase === 'auto') return /*#__PURE__*/React.createElement("div", { style: { padding: 20, maxWidth: 560 } },
    /*#__PURE__*/React.createElement("h2", { style: { fontSize: 18, fontWeight: 700, marginBottom: 16 } }, "Encrypted Backup"),
    /*#__PURE__*/React.createElement("div", { style: { ...cardStyle, display: 'flex', alignItems: 'center', gap: 12 } },
      /*#__PURE__*/React.createElement(Spin, { s: 18 }),
      /*#__PURE__*/React.createElement("span", { style: { fontSize: 13, color: 'var(--tx-2)' } }, "Reconnecting to backup\u2026")));

  // ── Connected phase ──
  const pct = storage.max > 0 ? Math.min(100, (storage.used / storage.max) * 100) : 0;
  const isBridgeActive = bridgeSettings && bridgeSettings.enabled;
  return /*#__PURE__*/React.createElement("div", { style: { padding: 20, maxWidth: 600 } },
    /*#__PURE__*/React.createElement("h2", { style: { fontSize: 18, fontWeight: 700, marginBottom: 16 } }, "Encrypted Backup"),

    // ── Status card ──
    /*#__PURE__*/React.createElement("div", { style: { ...cardStyle, marginBottom: 14 } },
      /*#__PURE__*/React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 } },
        /*#__PURE__*/React.createElement("div", { style: { width: 36, height: 36, borderRadius: 9, background: 'linear-gradient(135deg, var(--teal), var(--blue))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 14 } },
          (KhoraBackup.identity || '?')[0] === '@' ? (KhoraBackup.identity || '?')[1].toUpperCase() : (KhoraBackup.identity || '?')[0].toUpperCase()),
        /*#__PURE__*/React.createElement("div", { style: { flex: 1 } },
          /*#__PURE__*/React.createElement("div", { style: { fontSize: 13, fontWeight: 600 } }, KhoraBackup.identity),
          /*#__PURE__*/React.createElement("div", { style: { fontSize: 11, color: 'var(--tx-2)', fontFamily: 'var(--mono)' } }, KhoraBackup.fmtSize(storage.used), " / ", KhoraBackup.fmtSize(storage.max))),
        /*#__PURE__*/React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 6 } },
          /*#__PURE__*/React.createElement("div", { style: { width: 8, height: 8, borderRadius: '50%', background: 'var(--green)', boxShadow: '0 0 6px rgba(0,200,140,0.5)' } }),
          /*#__PURE__*/React.createElement("span", { style: { fontSize: 11, color: 'var(--green)', fontWeight: 600 } }, "Connected"))),
      // Storage bar
      /*#__PURE__*/React.createElement("div", { style: { height: 4, background: 'var(--bg-4)', borderRadius: 2, overflow: 'hidden', marginBottom: 10 } },
        /*#__PURE__*/React.createElement("div", { style: { height: '100%', width: pct + '%', background: 'linear-gradient(90deg, var(--teal), var(--blue))', borderRadius: 2, transition: 'width .3s' } })),
      // Last backup
      lastBackup && /*#__PURE__*/React.createElement("div", { style: { fontSize: 11, color: 'var(--tx-2)', marginBottom: 10 } },
        /*#__PURE__*/React.createElement(I, { n: "check", s: 11 }), " Last backup: ", new Date(lastBackup).toLocaleString()),
      // Actions row
      /*#__PURE__*/React.createElement("div", { style: { display: 'flex', gap: 8, flexWrap: 'wrap' } },
        /*#__PURE__*/React.createElement("button", { className: "b-gho b-sm", onClick: () => { if (showFiles) { setShowFiles(false); } else loadFiles(); } },
          /*#__PURE__*/React.createElement(I, { n: showFiles ? "chevronLeft" : "grid", s: 12 }), showFiles ? ' Hide Files' : ' Browse Files'),
        /*#__PURE__*/React.createElement("button", { className: "b-gho b-sm", style: { color: 'var(--red)', borderColor: 'rgba(240,96,96,.3)' }, onClick: handleDisconnect },
          /*#__PURE__*/React.createElement(I, { n: "logout", s: 12 }), " Disconnect"))),

    // ── File browser ──
    showFiles && /*#__PURE__*/React.createElement("div", { style: { ...cardStyle, marginBottom: 14 } },
      /*#__PURE__*/React.createElement("div", { style: { fontSize: 12, fontWeight: 600, marginBottom: 10 } }, "Backup Files"),
      !files ? /*#__PURE__*/React.createElement("div", { style: { textAlign: 'center', padding: 20 } }, /*#__PURE__*/React.createElement(Spin, { s: 18 }))
      : (files.folders.length + files.files.length === 0)
        ? /*#__PURE__*/React.createElement("div", { style: { textAlign: 'center', padding: 20, color: 'var(--tx-2)', fontSize: 12 } }, "No files yet \u2014 backups will appear here automatically")
        : /*#__PURE__*/React.createElement("div", { style: { maxHeight: 300, overflowY: 'auto' } },
          files.folders.map(f => /*#__PURE__*/React.createElement("div", { key: f.uuid, style: { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 'var(--r)', fontSize: 12.5 } },
            /*#__PURE__*/React.createElement(I, { n: "grid", s: 14, c: "var(--gold)" }), /*#__PURE__*/React.createElement("span", { style: { flex: 1 } }, f.name),
            /*#__PURE__*/React.createElement("span", { style: { fontSize: 10, color: 'var(--tx-3)', fontFamily: 'var(--mono)' } }, "folder"))),
          files.files.map(f => /*#__PURE__*/React.createElement("div", { key: f.uuid, style: { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 'var(--r)', fontSize: 12.5 } },
            /*#__PURE__*/React.createElement(I, { n: "file", s: 14 }), /*#__PURE__*/React.createElement("span", { style: { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, f.name),
            /*#__PURE__*/React.createElement("span", { style: { fontSize: 10, color: 'var(--tx-3)', fontFamily: 'var(--mono)', whiteSpace: 'nowrap' } }, KhoraBackup.fmtSize(f.size)))))),

    // ── Pool Bridge ──
    KhoraBackup.canBridge && !isBridgeActive && /*#__PURE__*/React.createElement("div", { style: { background: 'var(--teal-dim)', border: '1px solid rgba(0,200,140,0.2)', borderRadius: 'var(--r-lg)', padding: 20, marginBottom: 14 } },
      /*#__PURE__*/React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 } },
        /*#__PURE__*/React.createElement("div", { style: { width: 36, height: 36, borderRadius: '50%', background: 'var(--teal-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--teal)' } },
          /*#__PURE__*/React.createElement(I, { n: "globe", s: 20 })),
        /*#__PURE__*/React.createElement("div", null,
          /*#__PURE__*/React.createElement("div", { style: { fontSize: 14, fontWeight: 700 } }, "Help the Network"),
          /*#__PURE__*/React.createElement("div", { style: { fontSize: 11, color: 'var(--tx-2)' } }, "Mirror encrypted files so others can fetch when uploaders are offline"))),
      /*#__PURE__*/React.createElement("p", { style: { fontSize: 12, color: 'var(--tx-2)', lineHeight: 1.6, marginBottom: 14 } },
        "Your account supports public links. Enable bridge mode to automatically store and serve encrypted blobs for the Khora network. You\u2019ll never see the contents \u2014 everything arrives pre-encrypted."),
      /*#__PURE__*/React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 } },
        /*#__PURE__*/React.createElement("span", { style: { ...labelStyle, margin: 0 } }, "CAPACITY"),
        /*#__PURE__*/React.createElement("input", { type: "number", value: bridgeCap, min: 1, max: 100, onChange: e => setBridgeCap(parseInt(e.target.value) || 5), style: { width: 70, background: 'var(--bg-1)', border: '1px solid var(--border-0)', borderRadius: 'var(--r)', padding: '6px 10px', color: 'var(--tx-0)', fontFamily: 'var(--mono)', fontSize: 12 } }),
        /*#__PURE__*/React.createElement("span", { style: { fontSize: 11, color: 'var(--tx-3)' } }, "GB of ", KhoraBackup.fmtSize(storage.available), " available")),
      /*#__PURE__*/React.createElement("div", { style: { display: 'flex', gap: 8 } },
        /*#__PURE__*/React.createElement("button", { className: "b-pri b-sm", onClick: handleBridgeEnable },
          /*#__PURE__*/React.createElement(I, { n: "globe", s: 12 }), " Enable Bridge"),
        /*#__PURE__*/React.createElement("button", { className: "b-gho b-sm", onClick: () => {} }, "Not Now"))),

    // ── Bridge active status ──
    isBridgeActive && /*#__PURE__*/React.createElement("div", { style: { background: 'var(--bg-2)', border: '1px solid var(--border-0)', borderRadius: 'var(--r-lg)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 } },
      /*#__PURE__*/React.createElement("div", { style: { width: 8, height: 8, borderRadius: '50%', background: 'var(--green)', animation: 'pulse 1.5s infinite', flexShrink: 0 } }),
      /*#__PURE__*/React.createElement("div", { style: { flex: 1, fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--tx-2)' } },
        /*#__PURE__*/React.createElement("strong", { style: { color: 'var(--tx-0)' } }, "Pool Bridge active"),
        " \xB7 ", bridgeSettings.capacity_gb, " GB allocated"),
      /*#__PURE__*/React.createElement("button", { className: "b-gho b-sm", onClick: handleBridgeDisable }, "Disable")));
};

/* ═══════════════════ FORM BUILDER — Schema Builder UX ═══════════════════
 * The FormBuilder implements the ideated Schema Builder UX with two modes:
 *
 *   Compose mode — Google-Forms-like drag-and-drop question building.
 *     Questions are GIVEN (observations). Answer options describe observable things.
 *     The GIVEN test nudge guides users toward observation-quality questions.
 *
 *   Wire mode — Connect answer options to framework codes (GIVEN → MEANT).
 *     A wiring panel shows framework bindings with full provenance.
 *     Provenance dots (●/○/⚡) encode binding status at a glance.
 *
 * The five primitives: QUESTION → VALUE → CODE → FRAMEWORK → BINDING + CROSSWALK
 * ═══════════════════════════════════════════════════════════════════════════════ */

// GIVEN test: words that suggest interpretation rather than observation
