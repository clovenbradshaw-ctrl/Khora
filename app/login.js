const WelcomeScreen = ({
  onContinue
}) => /*#__PURE__*/React.createElement("div", {
  className: "grid-bg",
  style: {
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative'
  }
}, /*#__PURE__*/React.createElement("div", {
  style: {
    position: 'absolute',
    top: 16,
    right: 16
  }
}, /*#__PURE__*/React.createElement(ThemeToggle, null)), /*#__PURE__*/React.createElement("div", {
  className: "anim-up",
  style: {
    width: '100%',
    maxWidth: 600,
    padding: 20
  }
}, /*#__PURE__*/React.createElement("div", {
  style: {
    background: 'var(--bg-1)',
    border: '1px solid var(--border-0)',
    borderRadius: 'var(--r-lg)',
    padding: '48px 44px',
    position: 'relative',
    overflow: 'hidden'
  }
}, /*#__PURE__*/React.createElement("div", {
  style: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    background: 'linear-gradient(90deg, var(--gold), var(--teal), var(--blue))'
  }
}), /*#__PURE__*/React.createElement("div", {
  style: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    marginBottom: 6
  }
}, /*#__PURE__*/React.createElement("div", {
  style: {
    width: 48,
    height: 48,
    borderRadius: 'var(--r-lg)',
    background: 'var(--gold-dim)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--gold)'
  }
}, /*#__PURE__*/React.createElement(I, {
  n: "shield",
  s: 26
})), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h1", {
  style: {
    fontSize: 28,
    fontWeight: 800,
    fontFamily: 'var(--serif)',
    letterSpacing: '-0.02em'
  }
}, "Khora"), /*#__PURE__*/React.createElement("span", {
  style: {
    fontFamily: 'var(--mono)',
    fontSize: 10,
    color: 'var(--tx-2)',
    letterSpacing: '.08em'
  }
}, "SOVEREIGN CASE MANAGEMENT"))), /*#__PURE__*/React.createElement("p", {
  style: {
    color: 'var(--tx-0)',
    fontSize: 15,
    marginTop: 24,
    lineHeight: 1.7,
    fontWeight: 500
  }
}, "You've been invited to access Khora \u2014 a system where ", /*#__PURE__*/React.createElement("em", null, "you"), " own your data."), /*#__PURE__*/React.createElement("p", {
  style: {
    color: 'var(--tx-1)',
    fontSize: 13.5,
    marginTop: 12,
    lineHeight: 1.7
  }
}, "Khora works like email \u2014 you create a free account on a provider you trust, and you can connect with anyone on the network. Your data is never locked inside a single company. To get started, you'll create a free account (it takes less than a minute)."), /*#__PURE__*/React.createElement("div", {
  style: {
    background: 'var(--bg-2)',
    border: '1px solid var(--border-1)',
    borderRadius: 'var(--r-lg)',
    padding: '20px 22px',
    marginTop: 24
  }
}, /*#__PURE__*/React.createElement("span", {
  style: {
    fontFamily: 'var(--mono)',
    fontSize: 10.5,
    color: 'var(--gold)',
    letterSpacing: '.06em',
    fontWeight: 600,
    display: 'block',
    marginBottom: 12
  }
}, "GETTING STARTED"), /*#__PURE__*/React.createElement("div", {
  style: {
    display: 'flex',
    gap: 14,
    marginBottom: 16
  }
}, /*#__PURE__*/React.createElement("div", {
  style: {
    width: 24,
    height: 24,
    borderRadius: '50%',
    background: 'var(--teal-dim)',
    color: 'var(--teal)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    fontWeight: 800,
    fontFamily: 'var(--mono)',
    flexShrink: 0,
    marginTop: 1
  }
}, "1"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
  style: {
    fontSize: 13.5,
    fontWeight: 600,
    color: 'var(--tx-0)',
    marginBottom: 4
  }
}, "Create a free account on Element"), /*#__PURE__*/React.createElement("div", {
  style: {
    fontSize: 12.5,
    color: 'var(--tx-1)',
    lineHeight: 1.6
  }
}, "Click \"Get Started\" below, then use the ", /*#__PURE__*/React.createElement("strong", {
  style: {
    color: 'var(--tx-0)'
  }
}, "\"Create Account\""), " tab. You'll be directed to ", /*#__PURE__*/React.createElement("strong", {
  style: {
    color: 'var(--tx-0)'
  }
}, "Element"), " to create a free account \u2014 it only takes a minute. Remember your username and password."), /*#__PURE__*/React.createElement("div", {
  style: {
    fontSize: 11.5,
    color: 'var(--tx-2)',
    lineHeight: 1.5,
    marginTop: 6
  }
}, "Element is also great for direct messaging if you want to chat with people securely."))), /*#__PURE__*/React.createElement("div", {
  style: {
    display: 'flex',
    gap: 14,
    marginBottom: 16
  }
}, /*#__PURE__*/React.createElement("div", {
  style: {
    width: 24,
    height: 24,
    borderRadius: '50%',
    background: 'var(--teal-dim)',
    color: 'var(--teal)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    fontWeight: 800,
    fontFamily: 'var(--mono)',
    flexShrink: 0,
    marginTop: 1
  }
}, "2"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
  style: {
    fontSize: 13.5,
    fontWeight: 600,
    color: 'var(--tx-0)',
    marginBottom: 4
  }
}, "Come back to Khora and sign in"), /*#__PURE__*/React.createElement("div", {
  style: {
    fontSize: 12.5,
    color: 'var(--tx-1)',
    lineHeight: 1.6
  }
}, "Once you've created your Element account, come back here and use the ", /*#__PURE__*/React.createElement("strong", {
  style: {
    color: 'var(--tx-0)'
  }
}, "\"Sign In\""), " tab with the same username and password. Khora is where you do your case management work."), /*#__PURE__*/React.createElement("div", {
  style: {
    fontSize: 11.5,
    color: 'var(--tx-2)',
    lineHeight: 1.5,
    marginTop: 6
  }
}, "Same account, different tools \u2014 Element for direct messaging, Khora for case management."))), /*#__PURE__*/React.createElement("div", {
  style: {
    display: 'flex',
    gap: 14
  }
}, /*#__PURE__*/React.createElement("div", {
  style: {
    width: 24,
    height: 24,
    borderRadius: '50%',
    background: 'var(--teal-dim)',
    color: 'var(--teal)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    fontWeight: 800,
    fontFamily: 'var(--mono)',
    flexShrink: 0,
    marginTop: 1
  }
}, "3"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
  style: {
    fontSize: 13.5,
    fontWeight: 600,
    color: 'var(--tx-0)',
    marginBottom: 4
  }
}, "Your role appears automatically"), /*#__PURE__*/React.createElement("div", {
  style: {
    fontSize: 12.5,
    color: 'var(--tx-1)',
    lineHeight: 1.6
  }
}, "Khora figures out whether you're a ", /*#__PURE__*/React.createElement("strong", {
  style: {
    color: 'var(--teal)'
  }
}, "Client"), ", ", /*#__PURE__*/React.createElement("strong", {
  style: {
    color: 'var(--gold)'
  }
}, "Provider"), ", Org Admin, or Network member based on the groups you belong to. If you have more than one role, you can switch between them without signing out.")))), /*#__PURE__*/React.createElement("div", {
  style: {
    background: 'var(--teal-dim)',
    border: '1px solid rgba(62,201,176,.15)',
    borderRadius: 'var(--r)',
    padding: '12px 16px',
    marginTop: 20,
    fontSize: 12,
    color: 'var(--tx-1)',
    lineHeight: 1.6,
    display: 'flex',
    gap: 10,
    alignItems: 'flex-start'
  }
}, /*#__PURE__*/React.createElement("div", {
  style: {
    flexShrink: 0,
    marginTop: 1
  }
}, /*#__PURE__*/React.createElement(I, {
  n: "lock",
  s: 15
})), /*#__PURE__*/React.createElement("span", null, "Your data is encrypted per-field on your device before it ever leaves. Providers see only the specific fields you share. You can revoke access at any time.")), /*#__PURE__*/React.createElement("button", {
  onClick: onContinue,
  className: "b-pri",
  style: {
    width: '100%',
    padding: 14,
    fontSize: 15,
    marginTop: 28,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10
  }
}, "Get Started ", /*#__PURE__*/React.createElement(I, {
  n: "chevR",
  s: 18
})), /*#__PURE__*/React.createElement("p", {
  style: {
    textAlign: 'center',
    marginTop: 16,
    fontSize: 11.5,
    color: 'var(--tx-3)',
    fontFamily: 'var(--mono)',
    letterSpacing: '.03em'
  }
}, "Already have an account? Click \"Get Started\" to sign in."))));

/* ═══════════════════ LOGIN ═══════════════════ */
const LoginScreen = ({
  onLogin
}) => {
  const [mode, setMode] = useState('login'); // login | register
  const [hs, setHs] = useState('matrix.org');
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [copied, setCopied] = useState(false);

  // Extract host server from username if present (e.g. @user:matrix.org -> matrix.org)
  const userHost = user.includes(':') ? user.split(':').slice(1).join(':') : '';
  const effectiveHs = userHost || hs;
  const hideHs = !!userHost;

  const go = async e => {
    e.preventDefault();
    setLoading(true);
    setErr('');
    try {
      const s = await KhoraAuth.login(effectiveHs, user.replace(/^@/, '').split(':')[0], pass);
      onLogin(s);
    } catch (loginErr) {
      setErr(loginErr.message);
    }
    setLoading(false);
  };
  const infoSectionStyle = { maxWidth: 720, margin: '0 auto', padding: '0 20px' };
  const infoCardStyle = { background: 'var(--bg-1)', border: '1px solid var(--border-0)', borderRadius: 'var(--r-lg)', padding: '24px 24px' };
  const sectionLabelStyle = { fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--gold)', letterSpacing: '.1em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 12 };
  const sectionTitleStyle = { fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 700, color: 'var(--tx-0)', marginBottom: 10, letterSpacing: '-0.01em' };
  const bodyTextStyle = { fontSize: 14.5, color: 'var(--tx-1)', lineHeight: 1.7 };
  const featureIconBox = (bg, fg) => ({ width: 40, height: 40, borderRadius: 'var(--r-lg)', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: fg, flexShrink: 0 });

  return /*#__PURE__*/React.createElement("div", {
    className: "grid-bg",
    style: {
      height: '100%',
      overflowY: 'auto',
      position: 'relative'
    }
  },

  /* ── Top navbar ── */
  /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 100,
      background: 'var(--bg-0)',
      borderBottom: '1px solid var(--border-0)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      height: 56
    }
  },
  /*#__PURE__*/React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 10 } },
    /*#__PURE__*/React.createElement("div", {
      style: { width: 32, height: 32, borderRadius: 'var(--r)', background: 'var(--gold-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gold)' }
    }, /*#__PURE__*/React.createElement(I, { n: "shield", s: 18 })),
    /*#__PURE__*/React.createElement("span", {
      style: { fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em' }
    }, "Khora")
  ),
  /*#__PURE__*/React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 12 } },
    /*#__PURE__*/React.createElement(ThemeToggle, null),
    /*#__PURE__*/React.createElement("button", {
      className: "b-gho",
      onClick: () => { setMode('login'); window.scrollTo({ top: 0, behavior: 'smooth' }); },
      style: { padding: '8px 16px', fontSize: 13, fontWeight: 600 }
    }, "Login")
  )),

  /* ── Hero section: dodecahedron + login card ── */
  /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '96px 20px 20px'
    }
  },

  /* Spinning dodecahedron hero */
  /*#__PURE__*/React.createElement("div", {
    style: { marginBottom: 20 }
  }, /*#__PURE__*/React.createElement(SpinningDodeca, { size: 120 })),

  /* ── Compact Given/Meant explainer above login ── */
  /*#__PURE__*/React.createElement("div", {
    className: "anim-up",
    style: { width: '100%', maxWidth: 540, marginBottom: 20 }
  },
  /*#__PURE__*/React.createElement("div", {
    style: { background: 'var(--bg-1)', border: '1px solid var(--border-0)', borderRadius: 'var(--r-lg)', padding: '24px 28px', position: 'relative', overflow: 'hidden' }
  },
  /*#__PURE__*/React.createElement("div", {
    style: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, var(--teal), var(--gold))' }
  }),
  /*#__PURE__*/React.createElement("div", {
    style: { fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--teal)', letterSpacing: '.1em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 10, textAlign: 'center' }
  }, "SHARED STANDARDS"),
  /*#__PURE__*/React.createElement("h2", {
    style: { fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 700, color: 'var(--tx-0)', marginBottom: 8, letterSpacing: '-0.01em', textAlign: 'center' }
  }, "Agree on what you call things"),
  /*#__PURE__*/React.createElement("p", {
    style: { fontSize: 14, color: 'var(--tx-1)', lineHeight: 1.65, textAlign: 'center', marginBottom: 16 }
  }, "When organizations work together, they need a common language. Khora makes a critical distinction visible:"),

  /* Compact GIVEN / MEANT side-by-side */
  /*#__PURE__*/React.createElement("div", {
    style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }
  },
  /*#__PURE__*/React.createElement("div", {
    style: { background: 'var(--bg-2)', borderRadius: 'var(--r)', padding: '14px 16px', borderLeft: '3px solid var(--teal)' }
  },
  /*#__PURE__*/React.createElement("div", {
    style: { fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--teal)', letterSpacing: '.1em', fontWeight: 700, marginBottom: 6 }
  }, "GIVEN"),
  /*#__PURE__*/React.createElement("div", {
    style: { fontFamily: 'var(--serif)', fontSize: 14.5, color: 'var(--tx-0)', fontWeight: 600, marginBottom: 4 }
  }, "What actually happened"),
  /*#__PURE__*/React.createElement("p", {
    style: { fontSize: 13, color: 'var(--tx-2)', lineHeight: 1.55 }
  }, "Raw information, as observed. \u201CI slept in my car last night.\u201D Uninterpreted, owned by the person who said it.")),

  /*#__PURE__*/React.createElement("div", {
    style: { background: 'var(--bg-2)', borderRadius: 'var(--r)', padding: '14px 16px', borderLeft: '3px solid var(--gold)' }
  },
  /*#__PURE__*/React.createElement("div", {
    style: { fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--gold)', letterSpacing: '.1em', fontWeight: 700, marginBottom: 6 }
  }, "MEANT"),
  /*#__PURE__*/React.createElement("div", {
    style: { fontFamily: 'var(--serif)', fontSize: 14.5, color: 'var(--tx-0)', fontWeight: 600, marginBottom: 4 }
  }, "What an institution classifies it as"),
  /*#__PURE__*/React.createElement("p", {
    style: { fontSize: 13, color: 'var(--tx-2)', lineHeight: 1.55 }
  }, "One agency calls it \u201CLiterally Homeless.\u201D Another says \u201CPriority 1.\u201D Same fact, different meanings."))
  ), /* end GIVEN/MEANT grid */

  /*#__PURE__*/React.createElement("p", {
    style: { fontSize: 12.5, color: 'var(--tx-3)', lineHeight: 1.55, marginTop: 12, textAlign: 'center' }
  }, "Khora keeps both \u2014 the raw observation and every institutional interpretation \u2014 so nothing gets lost in translation.")

  )), /* end explainer card */

  /* Login card */
  /*#__PURE__*/React.createElement("div", {
    className: "anim-up",
    style: {
      width: '100%',
      maxWidth: 440
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--bg-1)',
      border: '1px solid var(--border-0)',
      borderRadius: 'var(--r-lg)',
      padding: '44px 40px',
      position: 'relative',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 3,
      background: 'linear-gradient(90deg, var(--gold), var(--teal), var(--blue))'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      fontSize: 28,
      fontWeight: 800,
      fontFamily: 'var(--serif)',
      letterSpacing: '-0.02em'
    }
  }, "Khora"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--mono)',
      fontSize: 11,
      color: 'var(--tx-2)',
      letterSpacing: '.08em'
    }
  }, "SOVEREIGN CASE MANAGEMENT")), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--tx-1)',
      fontSize: 14,
      marginTop: 18,
      marginBottom: 24,
      lineHeight: 1.65,
      textAlign: 'center'
    }
  }, "Your data, your control. Every piece of information is encrypted separately \u2014 providers see only what you choose to share."), /*#__PURE__*/React.createElement("div", {
    className: "tabs",
    style: {
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: `tab ${mode === 'login' ? 'active' : ''}`,
    onClick: () => {
      setMode('login');
      setErr('');
    }
  }, "Sign In"), /*#__PURE__*/React.createElement("div", {
    className: `tab ${mode === 'register' ? 'active' : ''}`,
    onClick: () => {
      setMode('register');
      setErr('');
    }
  }, "Create Account")), mode === 'register' && /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--teal-dim)',
      border: '1px solid rgba(62,201,176,.15)',
      borderRadius: 'var(--r)',
      padding: 20,
      marginBottom: 16
    }
  },
  /* STEP 1 */
  /*#__PURE__*/React.createElement("div", {
    style: { fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--tx-2)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 6 }
  }, "\u25CF STEP 1"),
  /*#__PURE__*/React.createElement("div", {
    style: { fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 700, color: 'var(--tx-0)', marginBottom: 8 }
  }, "Create a free account on Element"),
  /*#__PURE__*/React.createElement("div", {
    style: { fontSize: 12.5, color: 'var(--tx-1)', lineHeight: 1.6, marginBottom: 10 }
  }, "Khora is built on the Matrix network \u2014 the same encrypted platform that powers Element. Think of Element as Signal meets Slack: a secure messaging app you can also use for team chat."),
  /*#__PURE__*/React.createElement("div", {
    style: { fontSize: 12.5, color: 'var(--tx-1)', lineHeight: 1.6, marginBottom: 16 }
  }, "Creating an account on Element is free and only takes a minute. Remember your username and password \u2014 you'll use the same credentials here on Khora."),
  /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "b-pri",
    onClick: () => window.open('https://app.element.io/#/register', '_blank'),
    style: { width: '100%', padding: 10, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }
  }, "Create account on Element ", /*#__PURE__*/React.createElement(I, { n: "external-link", s: 14 })),

  /* Divider */
  /*#__PURE__*/React.createElement("div", { style: { borderTop: '1px solid var(--border-0)', margin: '20px 0' } }),

  /* STEP 2 */
  /*#__PURE__*/React.createElement("div", {
    style: { fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--tx-2)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 6 }
  }, "\u25CF STEP 2"),
  /*#__PURE__*/React.createElement("div", {
    style: { fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 700, color: 'var(--tx-0)', marginBottom: 8 }
  }, "Come back to Khora and sign in"),
  /*#__PURE__*/React.createElement("div", {
    style: { fontSize: 12.5, color: 'var(--tx-1)', lineHeight: 1.6, marginBottom: 10 }
  }, "Once you've created your Element account, come back here to ", /*#__PURE__*/React.createElement("strong", { style: { color: 'var(--tx-0)' } }, "Khora"), " and sign in with the exact same username and password."),
  /*#__PURE__*/React.createElement("div", {
    style: { fontSize: 12.5, color: 'var(--tx-1)', lineHeight: 1.6, marginBottom: 16 }
  }, "Element is great for direct messaging if you want to chat with people securely. Khora is where you do your case management work \u2014 same account, different tools."),
  /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "b-pri",
    onClick: () => { setMode('login'); setErr(''); },
    style: { width: '100%', padding: 10, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }
  }, "I've created my account \u2014 sign in ", /*#__PURE__*/React.createElement(I, { n: "arrow-right", s: 14 }))),

mode === 'login' && /*#__PURE__*/React.createElement("form", {
    onSubmit: go
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "USERNAME"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("input", {
    style: {
      flex: 1
    },
    value: user,
    onChange: e => setUser(e.target.value),
    placeholder: mode === 'register' ? 'choose a username' : 'your username',
    autoComplete: "username"
  }), mode === 'register' && /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => {
      if (window.generateUsername) setUser(window.generateUsername());
    },
    className: "b-gho",
    style: {
      padding: '8px 10px',
      flexShrink: 0
    },
    title: "Generate random username"
  }, /*#__PURE__*/React.createElement(I, {
    n: "dice",
    s: 16
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "PASSWORD"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "password",
    style: {
      flex: 1
    },
    value: pass,
    onChange: e => setPass(e.target.value),
    placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022",
    autoComplete: mode === 'register' ? 'new-password' : 'current-password'
  }), mode === 'register' && /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => {
      const c = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*';
      const a = crypto.getRandomValues(new Uint8Array(20));
      setPass(Array.from(a, v => c[v % c.length]).join(''));
    },
    className: "b-gho",
    style: {
      padding: '8px 10px',
      flexShrink: 0
    },
    title: "Generate strong password"
  }, /*#__PURE__*/React.createElement(I, {
    n: "key",
    s: 16
  })))), mode === 'register' && user && pass && /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14,
      textAlign: 'right'
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "b-gho b-xs",
    onClick: () => {
      const txt = `Khora Account Credentials\n========================\nServer: ${effectiveHs}\nUsername: ${user}\nPassword: ${pass}\n\nSECURITY WARNING: This file contains your password in plain text.\nStore it in a secure location (e.g. password manager) and delete\nthis file after saving your credentials elsewhere.\n`;
      const b = new Blob([txt], {
        type: 'text/plain'
      });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(b);
      a.download = 'khora-credentials.txt';
      a.click();
      URL.revokeObjectURL(a.href);
    },
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "download",
    s: 12
  }), " Save credentials")), mode === 'login' && /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14,
      textAlign: 'right'
    }
  }, /*#__PURE__*/React.createElement("a", {
    href: "https://app.element.io/#/forgot_password",
    target: "_blank",
    rel: "noopener",
    style: { fontSize: 12, color: 'var(--teal)', textDecoration: 'none', fontFamily: 'var(--mono)' }
  }, "Forgot password?")), !hideHs && /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setShowAdvanced(!showAdvanced),
    className: "b-gho b-xs",
    style: { display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--tx-3)', fontSize: 11, fontFamily: 'var(--mono)', letterSpacing: '.04em', marginBottom: showAdvanced ? 8 : 0 }
  }, /*#__PURE__*/React.createElement(I, {
    n: showAdvanced ? "chevronDown" : "chevronRight",
    s: 12
  }), " Advanced"), showAdvanced && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "SERVER"), /*#__PURE__*/React.createElement("input", {
    value: hs,
    onChange: e => setHs(e.target.value),
    placeholder: "e.g. matrix.org"
  }))), err && /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--red-dim)',
      border: '1px solid rgba(232,93,93,.2)',
      borderRadius: 'var(--r)',
      padding: '9px 14px',
      fontSize: 12.5,
      color: 'var(--red)',
      marginBottom: 16
    }
  }, err), /*#__PURE__*/React.createElement("button", {
    type: "submit",
    className: "b-pri",
    disabled: loading,
    style: {
      width: '100%',
      padding: 12,
      fontSize: 14,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8
    }
  }, loading ? /*#__PURE__*/React.createElement(Spin, {
    s: 16
  }) : /*#__PURE__*/React.createElement(I, {
    n: "lock",
    s: 16
  }), " ", loading ? 'Connecting...' : mode === 'register' ? 'Create Account & Connect' : 'Connect')), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 16,
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 6,
      height: 6,
      borderRadius: '50%',
      background: typeof matrixcs !== 'undefined' ? 'var(--green)' : 'var(--gold)'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--mono)',
      fontSize: 11.5,
      color: 'var(--tx-3)'
    }
  }, typeof matrixcs !== 'undefined' ? 'Secure connection ready' : 'Connecting\u2026'))),

  /* Scroll hint arrow */
  /*#__PURE__*/React.createElement("div", {
    style: { textAlign: 'center', marginTop: 16 }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => { const el = document.getElementById('khora-info'); if (el) el.scrollIntoView({ behavior: 'smooth' }); },
    className: "b-gho b-xs",
    style: { display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--tx-3)', fontSize: 12, fontFamily: 'var(--mono)', letterSpacing: '.04em' }
  }, "Learn more ", /*#__PURE__*/React.createElement(I, { n: "chevronDown", s: 14 })))

  ), /* end anim-up */
  ), /* end hero section */

  /* ══════════════════════════════════════════════════════════════ */
  /* ═══════════════════ INFO SECTIONS BELOW FOLD ═══════════════ */
  /* ══════════════════════════════════════════════════════════════ */

  /*#__PURE__*/React.createElement("div", {
    id: "khora-info",
    style: { paddingBottom: 80 }
  },

  /* ── Section 1: What is Khora? ── */
  /*#__PURE__*/React.createElement("div", {
    style: { ...infoSectionStyle, paddingTop: 64, paddingBottom: 48 }
  }, /*#__PURE__*/React.createElement("div", {
    style: { textAlign: 'center', marginBottom: 40 }
  }, /*#__PURE__*/React.createElement("div", {
    style: sectionLabelStyle
  }, "WHAT IS KHORA?"), /*#__PURE__*/React.createElement("h2", {
    style: { ...sectionTitleStyle, fontSize: 28 }
  }, "Your information, under your control"), /*#__PURE__*/React.createElement("p", {
    style: { ...bodyTextStyle, maxWidth: 560, margin: '0 auto' }
  }, "Khora is a case management system where the person being served owns their data. You decide exactly which pieces of your information to share with each provider, and you can take it back at any time. No vendor lock-in, no corporate database you can't see inside.")),

  /* Three feature cards */
  /*#__PURE__*/React.createElement("div", {
    style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }
  },

  /* Card: You own it */
  /*#__PURE__*/React.createElement("div", {
    style: infoCardStyle
  }, /*#__PURE__*/React.createElement("div", {
    style: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }
  }, /*#__PURE__*/React.createElement("div", {
    style: featureIconBox('var(--gold-dim)', 'var(--gold)')
  }, /*#__PURE__*/React.createElement(I, { n: "shield", s: 20 })), /*#__PURE__*/React.createElement("div", {
    style: { fontWeight: 700, fontSize: 14, color: 'var(--tx-0)' }
  }, "You own it")), /*#__PURE__*/React.createElement("p", {
    style: bodyTextStyle
  }, "Your information lives in a personal vault that belongs to you. Not to an organization, not to a database administrator \u2014 to you. You carry it between providers.")),

  /* Card: Field-by-field sharing */
  /*#__PURE__*/React.createElement("div", {
    style: infoCardStyle
  }, /*#__PURE__*/React.createElement("div", {
    style: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }
  }, /*#__PURE__*/React.createElement("div", {
    style: featureIconBox('var(--teal-dim)', 'var(--teal)')
  }, /*#__PURE__*/React.createElement(I, { n: "eye", s: 20 })), /*#__PURE__*/React.createElement("div", {
    style: { fontWeight: 700, fontSize: 14, color: 'var(--tx-0)' }
  }, "Field-by-field sharing")), /*#__PURE__*/React.createElement("p", {
    style: bodyTextStyle
  }, "Share your name with one provider, your case notes with another, your contact info with a third. Each provider sees only the specific fields you choose \u2014 nothing more.")),

  /* Card: Revoke anytime */
  /*#__PURE__*/React.createElement("div", {
    style: infoCardStyle
  }, /*#__PURE__*/React.createElement("div", {
    style: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }
  }, /*#__PURE__*/React.createElement("div", {
    style: featureIconBox('var(--red-dim)', 'var(--red)')
  }, /*#__PURE__*/React.createElement(I, { n: "x", s: 20 })), /*#__PURE__*/React.createElement("div", {
    style: { fontWeight: 700, fontSize: 14, color: 'var(--tx-0)' }
  }, "Revoke anytime")), /*#__PURE__*/React.createElement("p", {
    style: bodyTextStyle
  }, "Changed your mind? Pull back access to specific fields, or cut a provider off entirely. When you revoke, the encryption keys are destroyed \u2014 it's not a policy, it's math.")))),

  /* ── Section 2: Who is Khora for? ── */
  /*#__PURE__*/React.createElement("div", {
    style: { ...infoSectionStyle, paddingTop: 48, paddingBottom: 48 }
  }, /*#__PURE__*/React.createElement("div", {
    style: { textAlign: 'center', marginBottom: 40 }
  }, /*#__PURE__*/React.createElement("div", {
    style: sectionLabelStyle
  }, "WHO IS IT FOR?"), /*#__PURE__*/React.createElement("h2", {
    style: sectionTitleStyle
  }, "Teams, organizations, and networks of any kind"), /*#__PURE__*/React.createElement("p", {
    style: { ...bodyTextStyle, maxWidth: 560, margin: '0 auto' }
  }, "Khora works for anyone where a team provides something for other people. It's ideal when there are teams within teams, organizations within networks, networks within networks. Nonprofits, clinics, outreach teams, businesses \u2014 if you have staff serving clients, Khora fits.")),

  /* Role cards - 2x2 grid */
  /*#__PURE__*/React.createElement("div", {
    style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }
  },

  /* Client */
  /*#__PURE__*/React.createElement("div", {
    style: { ...infoCardStyle, display: 'flex', gap: 14, alignItems: 'flex-start' }
  }, /*#__PURE__*/React.createElement("div", {
    style: featureIconBox('var(--teal-dim)', 'var(--teal)')
  }, /*#__PURE__*/React.createElement(I, { n: "user", s: 20 })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: { fontWeight: 700, fontSize: 14, color: 'var(--tx-0)', marginBottom: 4 }
  }, "Client"), /*#__PURE__*/React.createElement("p", {
    style: { ...bodyTextStyle, fontSize: 13.5 }
  }, "The person being served. Owns a personal vault with all their data. Decides exactly who sees what, field by field."))),

  /* Provider */
  /*#__PURE__*/React.createElement("div", {
    style: { ...infoCardStyle, display: 'flex', gap: 14, alignItems: 'flex-start' }
  }, /*#__PURE__*/React.createElement("div", {
    style: featureIconBox('var(--gold-dim)', 'var(--gold)')
  }, /*#__PURE__*/React.createElement(I, { n: "briefcase", s: 20 })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: { fontWeight: 700, fontSize: 14, color: 'var(--tx-0)', marginBottom: 4 }
  }, "Provider"), /*#__PURE__*/React.createElement("p", {
    style: { ...bodyTextStyle, fontSize: 13.5 }
  }, "A case worker or service professional. Connects to clients, records assessments, and manages cases \u2014 seeing only what each client has authorized."))),

  /* Organization */
  /*#__PURE__*/React.createElement("div", {
    style: { ...infoCardStyle, display: 'flex', gap: 14, alignItems: 'flex-start' }
  }, /*#__PURE__*/React.createElement("div", {
    style: featureIconBox('var(--blue-dim)', 'var(--blue)')
  }, /*#__PURE__*/React.createElement(I, { n: "users", s: 20 })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: { fontWeight: 700, fontSize: 14, color: 'var(--tx-0)', marginBottom: 4 }
  }, "Organization"), /*#__PURE__*/React.createElement("p", {
    style: { ...bodyTextStyle, fontSize: 13.5 }
  }, "A team or agency. Manages staff roles, policies, and settings. Organizations can join networks to share standards with peer organizations."))),

  /* Network */
  /*#__PURE__*/React.createElement("div", {
    style: { ...infoCardStyle, display: 'flex', gap: 14, alignItems: 'flex-start' }
  }, /*#__PURE__*/React.createElement("div", {
    style: featureIconBox('var(--purple-dim)', 'var(--purple)')
  }, /*#__PURE__*/React.createElement(I, { n: "globe", s: 20 })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: { fontWeight: 700, fontSize: 14, color: 'var(--tx-0)', marginBottom: 4 }
  }, "Network"), /*#__PURE__*/React.createElement("p", {
    style: { ...bodyTextStyle, fontSize: 13.5 }
  }, "The federation layer. Coordinates shared standards across member organizations \u2014 what you call things, how you measure them, and how decisions get made.")))

  ), /* end role grid */

  /*#__PURE__*/React.createElement("p", {
    style: { ...bodyTextStyle, textAlign: 'center', marginTop: 20, fontSize: 13.5, color: 'var(--tx-2)' }
  }, "You don't pick a role at signup. Khora detects it automatically based on the groups you belong to. One account can hold multiple roles at once.")),

  /* ── Section 3: How Security Works ── */
  /*#__PURE__*/React.createElement("div", {
    style: { ...infoSectionStyle, paddingTop: 48, paddingBottom: 48 }
  }, /*#__PURE__*/React.createElement("div", {
    style: { textAlign: 'center', marginBottom: 40 }
  }, /*#__PURE__*/React.createElement("div", {
    style: sectionLabelStyle
  }, "SECURITY"), /*#__PURE__*/React.createElement("h2", {
    style: sectionTitleStyle
  }, "Three layers of encryption, zero trust required"), /*#__PURE__*/React.createElement("p", {
    style: { ...bodyTextStyle, maxWidth: 560, margin: '0 auto' }
  }, "You don't have to trust anyone \u2014 not the server operator, not the network, not us. Khora encrypts your data at every level, and the keys never leave your hands.")),

  /*#__PURE__*/React.createElement("div", {
    style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }
  },

  /* Layer 1: In transit */
  /*#__PURE__*/React.createElement("div", {
    style: infoCardStyle
  }, /*#__PURE__*/React.createElement("div", {
    style: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }
  }, /*#__PURE__*/React.createElement("div", {
    style: featureIconBox('var(--teal-dim)', 'var(--teal)')
  }, /*#__PURE__*/React.createElement(I, { n: "lock", s: 20 })), /*#__PURE__*/React.createElement("div", {
    style: { fontWeight: 700, fontSize: 14, color: 'var(--tx-0)' }
  }, "Encrypted in transit")), /*#__PURE__*/React.createElement("p", {
    style: bodyTextStyle
  }, "Everything you send is end-to-end encrypted before it leaves your device. The server that relays your messages cannot read them \u2014 it only knows that a message was sent, not what it says.")),

  /* Layer 2: Per-field */
  /*#__PURE__*/React.createElement("div", {
    style: infoCardStyle
  }, /*#__PURE__*/React.createElement("div", {
    style: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }
  }, /*#__PURE__*/React.createElement("div", {
    style: featureIconBox('var(--gold-dim)', 'var(--gold)')
  }, /*#__PURE__*/React.createElement(I, { n: "key", s: 20 })), /*#__PURE__*/React.createElement("div", {
    style: { fontWeight: 700, fontSize: 14, color: 'var(--tx-0)' }
  }, "Encrypted per field")), /*#__PURE__*/React.createElement("p", {
    style: bodyTextStyle
  }, "Each provider you connect with gets a unique encryption key for each piece of data you share. Two providers working on the same case literally cannot see each other's fields \u2014 it's not access control, it's separate encryption.")),

  /* Layer 3: At rest */
  /*#__PURE__*/React.createElement("div", {
    style: infoCardStyle
  }, /*#__PURE__*/React.createElement("div", {
    style: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }
  }, /*#__PURE__*/React.createElement("div", {
    style: featureIconBox('var(--purple-dim)', 'var(--purple)')
  }, /*#__PURE__*/React.createElement(I, { n: "shieldCheck", s: 20 })), /*#__PURE__*/React.createElement("div", {
    style: { fontWeight: 700, fontSize: 14, color: 'var(--tx-0)' }
  }, "Encrypted on your device")), /*#__PURE__*/React.createElement("p", {
    style: bodyTextStyle
  }, "Data stored on your device is encrypted at rest with a key derived from your session. When you log out, the key is destroyed. If someone gets your device while you're logged out, they get nothing."))

  )), /* end security grid + section */

  /* ── Section 5: What is a Matrix account? ── */
  /*#__PURE__*/React.createElement("div", {
    style: { ...infoSectionStyle, paddingTop: 48, paddingBottom: 48 }
  }, /*#__PURE__*/React.createElement("div", {
    style: { textAlign: 'center', marginBottom: 32 }
  }, /*#__PURE__*/React.createElement("div", {
    style: sectionLabelStyle
  }, "YOUR ACCOUNT"), /*#__PURE__*/React.createElement("h2", {
    style: sectionTitleStyle
  }, "What is a Matrix account?"), /*#__PURE__*/React.createElement("p", {
    style: { ...bodyTextStyle, maxWidth: 560, margin: '0 auto' }
  }, "Khora runs on Matrix \u2014 an open, federated network. Think of it like email: you pick a server to host your account, and you can connect with anyone on the network regardless of which server they chose.")),

  /*#__PURE__*/React.createElement("div", {
    style: { ...infoCardStyle, maxWidth: 560, margin: '0 auto' }
  },

  /*#__PURE__*/React.createElement("div", {
    style: { display: 'flex', gap: 14, marginBottom: 18, alignItems: 'flex-start' }
  }, /*#__PURE__*/React.createElement("div", {
    style: featureIconBox('var(--teal-dim)', 'var(--teal)')
  }, /*#__PURE__*/React.createElement(I, { n: "globe", s: 20 })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: { fontWeight: 700, fontSize: 14, color: 'var(--tx-0)', marginBottom: 4 }
  }, "No single company controls it"), /*#__PURE__*/React.createElement("p", {
    style: { ...bodyTextStyle, fontSize: 12.5 }
  }, "Matrix is an open standard, not a product. Hundreds of independent servers run it. Your account isn't trapped inside one company's platform."))),

  /*#__PURE__*/React.createElement("div", {
    style: { display: 'flex', gap: 14, marginBottom: 18, alignItems: 'flex-start' }
  }, /*#__PURE__*/React.createElement("div", {
    style: featureIconBox('var(--gold-dim)', 'var(--gold)')
  }, /*#__PURE__*/React.createElement(I, { n: "share", s: 20 })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: { fontWeight: 700, fontSize: 14, color: 'var(--tx-0)', marginBottom: 4 }
  }, "Connect across servers"), /*#__PURE__*/React.createElement("p", {
    style: { ...bodyTextStyle, fontSize: 12.5 }
  }, "Just like you can email someone on Gmail from Yahoo, you can connect with anyone on any Matrix server. Your choice of server doesn't limit who you work with."))),

  /*#__PURE__*/React.createElement("div", {
    style: { display: 'flex', gap: 14, alignItems: 'flex-start' }
  }, /*#__PURE__*/React.createElement("div", {
    style: featureIconBox('var(--purple-dim)', 'var(--purple)')
  }, /*#__PURE__*/React.createElement(I, { n: "eyeOff", s: 20 })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: { fontWeight: 700, fontSize: 14, color: 'var(--tx-0)', marginBottom: 4 }
  }, "Your server can see metadata, not content"), /*#__PURE__*/React.createElement("p", {
    style: { ...bodyTextStyle, fontSize: 12.5 }
  }, "The server that hosts your account can see who you connect with and when you're online, but never your actual data \u2014 it's encrypted before it leaves your device. For extra privacy, use a random username.")))

  ), /* end matrix card */

  /*#__PURE__*/React.createElement("p", {
    style: { ...bodyTextStyle, textAlign: 'center', marginTop: 20, fontSize: 12, color: 'var(--tx-3)' }
  }, "Create a free account at ", /*#__PURE__*/React.createElement("a", {
    href: "https://app.element.io/#/register",
    target: "_blank",
    rel: "noopener",
    style: { color: 'var(--teal)' }
  }, "app.element.io"), " to get started.")),

  /* ── Footer ── */
  /*#__PURE__*/React.createElement("div", {
    style: { ...infoSectionStyle, paddingTop: 40, paddingBottom: 40, textAlign: 'center', borderTop: '1px solid var(--border-0)' }
  }, /*#__PURE__*/React.createElement("div", {
    style: { marginBottom: 12 }
  }, /*#__PURE__*/React.createElement(SpinningDodeca, { size: 28 })), /*#__PURE__*/React.createElement("p", {
    style: { fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--tx-3)', letterSpacing: '.06em', lineHeight: 1.8 }
  }, "Built on the ", /*#__PURE__*/React.createElement("a", {
    href: "https://matrix.org",
    target: "_blank",
    rel: "noopener",
    style: { color: 'var(--tx-2)' }
  }, "Matrix"), " protocol. Open standard. No vendor lock-in."))

  ) /* end khora-info */
  ); /* end outer grid-bg */
};


/* ═══════════════════ PERSONAL DASHBOARD ═══════════════════ */
