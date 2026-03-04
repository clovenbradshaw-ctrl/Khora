const App = () => {
  const [welcomed, setWelcomed] = useState(() => {
    try {
      return localStorage.getItem('khora_welcomed') === '1';
    } catch {
      return false;
    }
  });
  const [session, setSession] = useState(null);
  const [availableContexts, setAvailableContexts] = useState([]);
  const [activeContext, setActiveContext] = useState(null);
  const [detectedRoles, setDetectedRoles] = useState(null); // roles from inferRolesFromRooms
  const [toast, setToast] = useState(null);

  const [restoring, setRestoring] = useState(true);
  const [restoreError, setRestoreError] = useState(null); // {type:'expired'|'network', message?:string}
  const [detectingRoles, setDetectingRoles] = useState(false);
  const showToast = (msg, type = 'info') => setToast({
    msg,
    type,
    k: Date.now()
  });

  // Apply scanned room data to derive contexts and roles
  const applyScannedData = React.useCallback((scanned) => {
    const roles = inferRolesFromRooms(scanned, svc.userId);
    setDetectedRoles(roles);
    let hasClient = false;
    let hasProvider = false;
    for (const state of Object.values(scanned || {})) {
      const accountType = state?.[EVT.IDENTITY]?.account_type;
      if (accountType === 'client' || accountType === 'client_record') hasClient = true;
      if (accountType === 'provider' || accountType === 'organization' || accountType === 'schema' || accountType === 'metrics' || accountType === 'network') hasProvider = true;
    }
    const contexts = [];
    if (hasProvider) contexts.push('provider');
    if (hasClient) contexts.push('client');
    if (contexts.length === 0) contexts.push('provider');
    setAvailableContexts(contexts);
    let preferred = null;
    try {
      preferred = localStorage.getItem('khora_active_context');
    } catch {}
    const next = preferred && contexts.includes(preferred) ? preferred : contexts[0];
    setActiveContext(next);
  }, []);

  // Context detection: scan rooms to infer roles (MVP §Screen 1)
  const detectContexts = React.useCallback(async () => {
    setDetectingRoles(true);
    try {
      const scanned = await svc.scanRooms([EVT.ORG_ROSTER]);
      applyScannedData(scanned);
    } catch (e) {
      console.warn('Context detection failed, defaulting to provider:', e.message);
      setAvailableContexts(['provider']);
      setActiveContext('provider');
    }
    setDetectingRoles(false);
  }, [applyScannedData]);
  const switchContext = context => {
    if (!availableContexts.includes(context)) return;
    setActiveContext(context);
    try {
      localStorage.setItem('khora_active_context', context);
    } catch {}
  };

  // Attempt to restore previous session from localStorage on mount
  const attemptRestore = React.useCallback(async () => {
    setRestoring(true);
    setRestoreError(null);
    try {
      const restored = await KhoraAuth.restoreSession();
      if (!restored) {
        setRestoring(false);
        return;
      }
      if (restored.expired) {
        setRestoreError({
          type: 'expired'
        });
        setRestoring(false);
        return;
      }
      if (restored.networkError) {
        setRestoreError({
          type: 'network',
          message: restored.message
        });
        setRestoring(false);
        return;
      }
      setSession(restored);
      // Ensure restored session bypasses welcome screen (even if khora_welcomed was cleared)
      setWelcomed(true);
      try { localStorage.setItem('khora_welcomed', '1'); } catch {}
      // Use cached room data for instant rendering while sync completes in background
      // Extended TTL: cache is always refreshed via background sync, so allow up to 2 hours
      let usedCache = false;
      try {
        const cached = await KhoraEncryptedCache.get('rooms', 'scan_result');
        if (cached?.data && (Date.now() - cached.ts) < 2 * 60 * 60 * 1000) {
          applyScannedData(cached.data);
          usedCache = true;
        }
      } catch {}
      if (usedCache) {
        // Sync completes in background — silently refresh with live data
        KhoraAuth.waitForSync().then(async () => {
          try {
            const scanned = await svc.scanRooms([EVT.ORG_ROSTER]);
            applyScannedData(scanned);
          } catch {}
        }).catch(() => {});
      } else {
        // No valid cache — wait for sync then detect contexts
        try {
          await KhoraAuth.waitForSync();
        } catch {}
        await detectContexts();
      }
      // Backup auto-connect disabled for now
      // KhoraBackup.autoConnect().catch(() => {});
    } catch (e) { console.warn('Session restore error:', e?.message); } finally {
      setRestoring(false);
    }
  }, [detectContexts, applyScannedData]);
  React.useEffect(() => {
    attemptRestore();
  }, [attemptRestore]);
  const handleLogin = async s => {
    setSession(s);
    // Detect contexts + roles from room membership (MVP §Screen 1)
    await detectContexts();
    // Backup auto-connect disabled for now
    // KhoraBackup.autoConnect().catch(() => {});
  };
  if (restoring || detectingRoles) return /*#__PURE__*/React.createElement("div", {
    className: "grid-bg",
    style: {
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement(Spin, {
    s: 32
  }), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--tx-2)',
      fontSize: 13,
      marginTop: 16
    }
  }, detectingRoles ? 'Setting up your workspace\u2026' : 'Restoring session\u2026')));

  // Network error during restore — offer retry without wiping the saved session
  if (restoreError?.type === 'network' && !session) return /*#__PURE__*/React.createElement("div", {
    className: "grid-bg",
    style: {
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "anim-up",
    style: {
      width: '100%',
      maxWidth: 400,
      padding: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--bg-1)',
      border: '1px solid var(--border-0)',
      borderRadius: 'var(--r-lg)',
      padding: '36px 32px',
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 48,
      height: 48,
      borderRadius: '50%',
      background: 'var(--gold-dim)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--gold)',
      margin: '0 auto 16px'
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "wifi-off",
    s: 22
  })), /*#__PURE__*/React.createElement("h2", {
    style: {
      fontSize: 18,
      fontWeight: 700,
      marginBottom: 8
    }
  }, "Connection issue"), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--tx-2)',
      fontSize: 13,
      lineHeight: 1.6,
      marginBottom: 20
    }
  }, "Could not reach the server to restore your session. Your login is saved and will reconnect automatically."), restoreError.message && /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: 'var(--mono)',
      fontSize: 11,
      color: 'var(--tx-3)',
      marginBottom: 16
    }
  }, restoreError.message), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "b-pri",
    onClick: () => attemptRestore(),
    style: {
      padding: '10px 24px',
      fontSize: 13
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "refresh-cw",
    s: 14
  }), " Retry"), /*#__PURE__*/React.createElement("button", {
    className: "b-gho",
    onClick: () => {
      setRestoreError(null);
    },
    style: {
      padding: '10px 24px',
      fontSize: 13
    }
  }, "Sign in manually")))));

  // Token expired — inform user and route to login
  if (restoreError?.type === 'expired' && !session) return /*#__PURE__*/React.createElement("div", {
    className: "grid-bg",
    style: {
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "anim-up",
    style: {
      width: '100%',
      maxWidth: 400,
      padding: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--bg-1)',
      border: '1px solid var(--border-0)',
      borderRadius: 'var(--r-lg)',
      padding: '36px 32px',
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 48,
      height: 48,
      borderRadius: '50%',
      background: 'var(--gold-dim)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--gold)',
      margin: '0 auto 16px'
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "clock",
    s: 22
  })), /*#__PURE__*/React.createElement("h2", {
    style: {
      fontSize: 18,
      fontWeight: 700,
      marginBottom: 8
    }
  }, "Session expired"), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--tx-2)',
      fontSize: 13,
      lineHeight: 1.6,
      marginBottom: 20
    }
  }, "Your previous session has expired. Please sign in again to continue."), /*#__PURE__*/React.createElement("button", {
    className: "b-pri",
    onClick: () => setRestoreError(null),
    style: {
      padding: '10px 28px',
      fontSize: 13
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "lock",
    s: 14
  }), " Sign in"))));
  if (!session) return /*#__PURE__*/React.createElement(LoginScreen, {
    onLogin: handleLogin
  });
  const handleLogout = async () => {
    try {
      sessionStorage.removeItem('khora_session');
      localStorage.removeItem('khora_session'); // clean up legacy
      localStorage.removeItem('khora_active_context');
      localStorage.removeItem('khora_active_org');
      localStorage.removeItem('khora_welcomed');
    } catch {}
    await KhoraAuth.logout();
    setSession(null);
    setAvailableContexts([]);
    setActiveContext(null);
    setDetectedRoles(null);
    setWelcomed(false);
  };
  if (!activeContext) return /*#__PURE__*/React.createElement("div", {
    className: "grid-bg",
    style: {
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement(Spin, {
    s: 28
  }), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--tx-2)',
      fontSize: 13,
      marginTop: 16
    }
  }, "Detecting role context\u2026")));
  return /*#__PURE__*/React.createElement(React.Fragment, null, activeContext === 'client' ? /*#__PURE__*/React.createElement(ClientApp, {
    session: session,
    onLogout: handleLogout,
    showToast: showToast,
    availableContexts: availableContexts,
    activeContext: activeContext,
    onSwitchContext: switchContext
  }) : /*#__PURE__*/React.createElement(ProviderApp, {
    session: session,
    onLogout: handleLogout,
    showToast: showToast,
    availableContexts: availableContexts,
    activeMode: activeContext,
    onSwitchContext: switchContext
  }), toast && /*#__PURE__*/React.createElement(Toast, {
    key: toast.k,
    msg: toast.msg,
    type: toast.type,
    onClose: () => setToast(null)
  }));
};
ReactDOM.createRoot(document.getElementById('root')).render(/*#__PURE__*/React.createElement(ThemeProvider, null, /*#__PURE__*/React.createElement(App, null)));
