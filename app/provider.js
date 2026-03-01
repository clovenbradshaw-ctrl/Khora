const ProviderApp = ({
  session,
  onLogout,
  showToast,
  availableContexts,
  activeMode,
  onSwitchContext
}) => {
  const { theme: appTheme } = useTheme();
  const isLightTheme = appTheme === 'light';
  const [rosterRoom, setRosterRoom] = useState(null);
  const [metricsRoom, setMetricsRoom] = useState(null);
  const [schemaRoom, setSchemaRoom] = useState(null);
  const [networkRoom, setNetworkRoom] = useState(null);
  const [cases, setCases] = useState([]);
  const [networkMembers, setNetworkMembers] = useState([]);
  const [activeCase, setActiveCase] = useState(null);
  const [view, setView] = useState('dashboard'); // dashboard|inbox|case|schema|resources|network|activity|staff|org-settings|org-inbox
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState([]);
  const [msgText, setMsgText] = useState('');
  const [caseReplyTo, setCaseReplyTo] = useState(null); // {id, sender, body} for case reply
  const [requestText, setRequestText] = useState('');
  const [discoverModal, setDiscoverModal] = useState(false);
  const [discoverUserId, setDiscoverUserId] = useState('');
  const [networkModal, setNetworkModal] = useState(false);
  const [networkName, setNetworkName] = useState('');
  const [joinNetworkModal, setJoinNetworkModal] = useState(false);
  const [joinNetworkId, setJoinNetworkId] = useState('');
  const [provObsModal, setProvObsModal] = useState(null);
  const [provObsValue, setProvObsValue] = useState('');
  const [provObsNotes, setProvObsNotes] = useState('');
  const [provObservations, setProvObservations] = useState([]);
  const [provenanceTarget, setProvenanceTarget] = useState(null); // {entityKey, label, roomId} or null
  const [initError, setInitError] = useState(null);
  // Organization context — orgs are a feature within the provider experience
  const [orgRoom, setOrgRoom] = useState(null);
  const [orgMeta, setOrgMeta] = useState({});
  const [staff, setStaff] = useState([]);
  const [orgRole, setOrgRole] = useState(null); // null = no org, 'admin', 'case_manager', etc.
  const [allOrgs, setAllOrgs] = useState([]); // multi-org: all orgs user belongs to [{roomId, role, meta, roster, ...}]
  const [createOrgModal, setCreateOrgModal] = useState(false);
  const [joinOrgModal, setJoinOrgModal] = useState(false);
  const [joinOrgId, setJoinOrgId] = useState('');
  const [setupData, setSetupData] = useState({
    name: '',
    type: 'direct_service',
    service_area: '',
    languages: 'en'
  });
  const [inviteModal, setInviteModal] = useState(false);
  const [inviteUserId, setInviteUserId] = useState('');
  const [inviteRole, setInviteRole] = useState('case_manager');
  // Case assignments — tracks which staff are assigned to which bridges within the org
  const [caseAssignments, setCaseAssignments] = useState({}); // { [bridgeRoomId]: { primary, staff:[], client_name, transferable } }
  // Trash bin — soft-deleted individuals: { [roomId]: { deletedBy, deletedAt, name } }
  const [trashedIndividuals, setTrashedIndividuals] = useState({});
  const [transferModal, setTransferModal] = useState(null); // case object to transfer
  const [transferTarget, setTransferTarget] = useState(''); // staff user ID to transfer to
  // Client records — provider-created rooms representing clients
  const [clientRecords, setClientRecords] = useState([]);
  const [createClientModal, setCreateClientModal] = useState(false);
  const openCreateClientModal = () => {
    if (!activeTeamContext) {
      if (showToast) showToast('Switch to a team context to create individual records. Select a team in the sidebar, or create one in the Teams view.', 'info');
      setView('teams');
      return;
    }
    setCreateClientModal(true);
    setNewClientName('');
    setNewClientMatrixId('');
    setNewClientNotes('');
  };
  const [clientInviteModal, setClientInviteModal] = useState(null); // client record object or null
  const [newClientName, setNewClientName] = useState('');
  const [newClientMatrixId, setNewClientMatrixId] = useState('');
  const [newClientNotes, setNewClientNotes] = useState('');
  const [clientInviteMatrixId, setClientInviteMatrixId] = useState('');
  const [copiedField, setCopiedField] = useState(null);
  const [verifyCodeModal, setVerifyCodeModal] = useState(null); // { record, code, expires } or null
  // Teams — flexible groups of people (not tied to a single org)
  const [teams, setTeams] = useState([]);
  const [createTeamModal, setCreateTeamModal] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDesc, setNewTeamDesc] = useState('');
  const [newTeamParentId, setNewTeamParentId] = useState('');     // parent team selection
  const [newTeamGovernance, setNewTeamGovernance] = useState('lead_decides');  // governance mode
  // Custom table creation modal
  const [createTableModal, setCreateTableModal] = useState(null); // null | { teamId, teamName }
  const [activeCustomTable, setActiveCustomTable] = useState(null); // null | { table, teamId }
  const [teamInviteModal, setTeamInviteModal] = useState(null); // team object or null
  const [teamInviteUserId, setTeamInviteUserId] = useState('');
  const [activeTeamDetail, setActiveTeamDetail] = useState(null); // expanded team detail view
  // ─── Active team context (workspace-level team scope) ───
  const [activeTeamContext, setActiveTeamContext] = useState(() => {
    try { return localStorage.getItem('khora_active_team') || null; } catch { return null; }
  });
  const activeTeamObj = useMemo(
    () => activeTeamContext ? teams.find(t => t.roomId === activeTeamContext) || null : null,
    [activeTeamContext, teams]
  );
  const activeTeamMemberIds = useMemo(
    () => activeTeamObj ? (activeTeamObj.members || []).map(m => m.userId) : [],
    [activeTeamObj]
  );
  // Filtered views when team context is active
  const teamFilteredCases = useMemo(
    () => activeTeamObj ? cases.filter(c => { const a = caseAssignments[c.bridgeRoomId]; return activeTeamMemberIds.includes(a?.primary || c.meta?.provider); }) : cases,
    [activeTeamObj, cases, caseAssignments, activeTeamMemberIds]
  );
  // Filter client records to those explicitly tagged with the active team.
  // Falls back to showing all records when no team context is active.
  // Records created before team_id was introduced (team_id === null) are visible
  // only in the no-team-context view to avoid silently hiding historical data.
  const teamFilteredClientRecords = useMemo(
    () => activeTeamObj ? clientRecords.filter(r => r.team_id === activeTeamContext) : clientRecords,
    [activeTeamObj, clientRecords, activeTeamContext]
  );
  const switchTeamContext = React.useCallback((teamRoomId) => {
    setActiveTeamContext(teamRoomId);
    try {
      if (teamRoomId) localStorage.setItem('khora_active_team', teamRoomId);
      else localStorage.removeItem('khora_active_team');
    } catch {}
    if (teamRoomId) {
      const t = teams.find(t => t.roomId === teamRoomId);
      if (t) {
        setTeamMode({ roomId: t.roomId, name: t.name, color_hue: t.color_hue });
        setActiveTeamDetail(t);
      }
    } else {
      setTeamMode(null);
      setActiveTeamDetail(null);
    }
  }, [teams]);
  // Expose switchTeamContext globally so DatabaseView team picker can call it
  React.useEffect(() => { window.__khoraSwitchTeam = switchTeamContext; return () => { delete window.__khoraSwitchTeam; }; }, [switchTeamContext]);
  const [teamMode, setTeamMode] = useState(null); // null = individual mode, { roomId, name, color_hue } = operating as team
  // ─── Sidebar collapse state ───
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem('khora_sidebar_collapsed') === 'true'; } catch { return false; }
  });
  const toggleSidebar = React.useCallback(() => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem('khora_sidebar_collapsed', String(next)); } catch {}
      return next;
    });
  }, []);
  // ─── Linked records state ───
  const [linkedRecords, setLinkedRecords] = useState({}); // { [parentRecordId]: [{id, linked_record_id, record_type, label, created_by, created_at, governance}] }
  const [createLinkedRecordModal, setCreateLinkedRecordModal] = useState(null); // {parentRecord} or null
  // Field definitions & crosswalks
  const [fieldDefs, setFieldDefs] = useState({}); // uri → definition object
  const [fieldCrosswalks, setFieldCrosswalks] = useState([]); // crosswalk records
  const [fieldGovernanceConfig, setFieldGovernanceConfig] = useState({}); // {governance_required: bool}
  const [sharingConsentModal, setSharingConsentModal] = useState(null); // {team, member} or null — prompts team member to choose sharing preference
  // Client data import
  const [importModal, setImportModal] = useState(false);
  // Database merge (auditable SYN)
  const [dbMergeModal, setDbMergeModal] = useState(false);
  const [dbMergeRecordA, setDbMergeRecordA] = useState(null);
  const [dbMergeRecordB, setDbMergeRecordB] = useState(null);
  // ─── Database / Notes / Profile state ───
  const [dbNotes, setDbNotes] = useState([]); // all notes across roster + bridges
  const [newNoteModal, setNewNoteModal] = useState(false);
  const [newNoteAttachTo, setNewNoteAttachTo] = useState(null); // pre-fill attach for profile page
  const [noteDetailModal, setNoteDetailModal] = useState(null); // note object for detail view
  const [activeIndividual, setActiveIndividual] = useState(null); // individual row for profile page
  const [activeResourceProfile, setActiveResourceProfile] = useState(null); // resource row for profile page
  const cellEditTimerRef = useRef({}); // debounce timers for cell edits
  const isMobile = useIsMobile();
  // Memoized team colors list for badge rendering
  const teamColorsList = useMemo(() => teams.map(t => ({ name: t.name, color_hue: t.color_hue })), [teams]);
  // Provider profile — self-reported identity info
  const [providerProfile, setProviderProfile] = useState({});
  const [profileModal, setProfileModal] = useState(false);
  const [profileDraft, setProfileDraft] = useState({
    display_name: '',
    title: '',
    credentials: '',
    bio: '',
    service_types: ''
  });
  // Contact sharing state
  const [shareContactModal, setShareContactModal] = useState(false);
  const [shareAsOrg, setShareAsOrg] = useState(false);
  // Email verification state
  const [emailVerifyConfig, setEmailVerifyConfig] = useState(EmailVerification.defaultConfig());
  const [emailVerifyModal, setEmailVerifyModal] = useState(false);
  const [verifyEmail, setVerifyEmail] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [verifyStep, setVerifyStep] = useState('email'); // 'email' | 'code' | 'done'
  const [verifyError, setVerifyError] = useState('');
  const [verifyPending, setVerifyPending] = useState(false);
  const [myVerification, setMyVerification] = useState(null); // current user's verification status
  const [emailConfigDraft, setEmailConfigDraft] = useState(EmailVerification.defaultConfig());
  const [emailConfigModal, setEmailConfigModal] = useState(false);
  // ─── Inter-org messaging & opacity ───
  const [orgOpacity, setOrgOpacity] = useState('translucent'); // transparent|translucent|opaque
  const [orgMsgAccess, setOrgMsgAccess] = useState({
    read: ['admin', 'case_manager'],
    respond: ['admin']
  });
  const [orgChannels, setOrgChannels] = useState([]); // [{roomId, peerOrg:{name,roomId}, lastMessage, unread}]
  const [activeChannel, setActiveChannel] = useState(null);
  const [channelMessages, setChannelMessages] = useState([]);
  const [orgMsgText, setOrgMsgText] = useState('');
  const [composeOrgModal, setComposeOrgModal] = useState(false);
  const [composePeerOrgId, setComposePeerOrgId] = useState('');
  const [composePeerOrgName, setComposePeerOrgName] = useState('');
  const [msgAccessModal, setMsgAccessModal] = useState(false);
  const [msgAccessDraft, setMsgAccessDraft] = useState({
    read: [],
    respond: []
  });
  // ─── Org terminology customization ───
  const [orgTerminology, setOrgTerminology] = useState({
    ...TERMINOLOGY_DEFAULTS
  });
  const [terminologyDraft, setTerminologyDraft] = useState({
    ...TERMINOLOGY_DEFAULTS
  });
  const [terminologyModal, setTerminologyModal] = useState(false);
  // Convenience accessors for the active terminology
  const T = orgTerminology; // T.client_term, T.client_term_plural, T.provider_term, T.provider_term_plural, T.staff_term, T.staff_term_plural
  // ─── Org custom roles ───
  const [orgRolesConfig, setOrgRolesConfig] = useState(DOMAIN_CONFIG.defaultOrgRoles);
  const [editingRole, setEditingRole] = useState(null); // {key, label, description} being edited
  const [addRoleModal, setAddRoleModal] = useState(false);
  const [newRoleDraft, setNewRoleDraft] = useState({ label: '', description: '' });
  // Derived role accessors — used in place of static ORG_ROLES / ORG_ROLE_LABELS
  const activeOrgRoles = orgRolesConfig.map(r => r.key);
  const activeOrgRoleLabels = Object.fromEntries(orgRolesConfig.map(r => [r.key, r.label]));
  const activeOrgRoleDescs = Object.fromEntries(orgRolesConfig.map(r => [r.key, r.description]));
  // ─── Inbox chat state ───
  const [inboxConvo, setInboxConvo] = useState(null); // room ID of active inbox conversation
  const [inboxMessages, setInboxMessages] = useState([]);
  const [inboxMsgText, setInboxMsgText] = useState('');
  const [inboxReplyTo, setInboxReplyTo] = useState(null); // {id, sender, body} for inbox reply
  const [inboxTab, setInboxTab] = useState('direct'); // kept for compat
  const [msgBuckets, setMsgBuckets] = useState(() => { try { return JSON.parse(localStorage.getItem('khora_msg_buckets') || '[]'); } catch { return []; } }); // [{id,label,roomIds:[]}]
  const [newBucketModal, setNewBucketModal] = useState(false);
  const [newBucketDraft, setNewBucketDraft] = useState('');
  const [assignBucketTarget, setAssignBucketTarget] = useState(null); // roomId being assigned to a group
  // ─── Team member DM state ───
  const [teamDMs, setTeamDMs] = useState([]); // [{roomId, peerId, peerName, teamName, teamRoomId}]
  const [teamDMMessages, setTeamDMMessages] = useState([]);
  const [teamDMMsgText, setTeamDMMsgText] = useState('');
  const [newTeamDMModal, setNewTeamDMModal] = useState(false);
  const [newDMTarget, setNewDMTarget] = useState(null); // {userId, displayName, teamName}
  const teamFilteredTeamDMs = useMemo(
    () => activeTeamObj ? teamDMs.filter(dm => activeTeamMemberIds.includes(dm.peerId)) : teamDMs,
    [activeTeamObj, teamDMs, activeTeamMemberIds]
  );
  // ─── Unified inbox grouping (by team, then custom buckets) ───
  const inboxGrouped = useMemo(() => {
    const bucketIds = new Set(msgBuckets.flatMap(b => b.roomIds));
    const allCases = activeTeamObj ? cases.filter(c => { const a = caseAssignments[c.bridgeRoomId]; return activeTeamMemberIds.includes(a?.primary || c.meta?.provider); }) : cases;
    const allDMs = activeTeamObj ? teamDMs.filter(dm => activeTeamMemberIds.includes(dm.peerId)) : teamDMs;
    const allCh = orgChannels;
    const toC = (type, id, data) => ({ type, id, data });
    const bucketSections = msgBuckets.map(b => ({ id: b.id, label: b.label, isCustom: true, convos: b.roomIds.map(rid => { const c = allCases.find(x => x.bridgeRoomId === rid); if (c) return toC('case', rid, c); const ch = allCh.find(x => x.roomId === rid); if (ch) return toC('channel', rid, ch); const dm = allDMs.find(x => x.roomId === rid); if (dm) return toC('team_dm', rid, dm); return null; }).filter(Boolean) })).filter(s => s.convos.length > 0);
    const teamSections = teams.map(team => { const mids = new Set((team.members || []).map(m => m.userId)); const convos = [...allCases.filter(c => { if (bucketIds.has(c.bridgeRoomId)) return false; const a = caseAssignments[c.bridgeRoomId]; return mids.has(a?.primary) || mids.has(c.meta?.provider); }).map(c => toC('case', c.bridgeRoomId, c)), ...allDMs.filter(dm => !bucketIds.has(dm.roomId) && dm.teamRoomId === team.roomId).map(dm => toC('team_dm', dm.roomId, dm))]; return { id: team.roomId, label: team.name, team, convos }; }).filter(s => s.convos.length > 0);
    const assignedIds = new Set([...bucketSections, ...teamSections].flatMap(s => s.convos.map(c => c.id)));
    const otherConvos = [...allCases.filter(c => !assignedIds.has(c.bridgeRoomId) && !bucketIds.has(c.bridgeRoomId)).map(c => toC('case', c.bridgeRoomId, c)), ...allCh.filter(ch => !assignedIds.has(ch.roomId) && !bucketIds.has(ch.roomId)).map(ch => toC('channel', ch.roomId, ch)), ...allDMs.filter(dm => !assignedIds.has(dm.roomId) && !bucketIds.has(dm.roomId)).map(dm => toC('team_dm', dm.roomId, dm))];
    return { bucketSections, teamSections, otherConvos };
  }, [cases, orgChannels, teamDMs, teams, caseAssignments, activeTeamObj, activeTeamMemberIds, msgBuckets]);
  // ─── Notifications state ───
  const [notifications, setNotifications] = useState([]);
  // ─── Resource tracking state ───
  const [resourceTypes, setResourceTypes] = useState([]); // catalog of resource types (from org/network room)
  const [resourceRelations, setResourceRelations] = useState([]); // org's relations to resource types
  const [resourceInventory, setResourceInventory] = useState({}); // { [relationId]: inventory object }
  const [createResourceModal, setCreateResourceModal] = useState(false);
  const [resourceDraft, setResourceDraft] = useState({
    name: '',
    category: 'general',
    unit: 'unit',
    fungible: true,
    perishable: false,
    ttl_days: '',
    tags: '',
    infinite: false,
    initial_quantity: '',
    replenishes: false,
    replenish_cycle: '',
    permissions: buildDefaultResourcePermissions()
  });
  // ─── Resource permission management state ───
  const [permModal, setPermModal] = useState(null); // resource type object or null
  const [permDraft, setPermDraft] = useState({
    controllers: [],
    allocators: [],
    viewers: []
  });
  const [permGrantType, setPermGrantType] = useState('role'); // 'role' or 'user'
  const [permGrantId, setPermGrantId] = useState('');
  const [permGrantAbility, setPermGrantAbility] = useState('controllers');
  // ─── Resource allocation state (case-level) ───
  const [allocModal, setAllocModal] = useState(false);
  const [allocDraft, setAllocDraft] = useState({
    resource_type_id: '',
    quantity: 1,
    notes: ''
  });
  const [caseAllocations, setCaseAllocations] = useState([]); // allocations for active case
  // ─── Inventory management state ───
  const [restockModal, setRestockModal] = useState(null); // relation object or null
  const [restockQty, setRestockQty] = useState('');
  const [restockNote, setRestockNote] = useState('');
  // ─── Data table state ───
  const [bridgeNotes, setBridgeNotes] = useState({}); // {bridgeRoomId: notes[]}
  const [rosterNotes, setRosterNotes] = useState([]); // internal notes from roster
  const [allAllocations, setAllAllocations] = useState([]); // all allocations across cases

  // ─── Multi-org switching ───
  const switchOrg = React.useCallback(async (targetRoomId) => {
    const target = allOrgs.find(o => o.roomId === targetRoomId);
    if (!target || target.roomId === orgRoom) return;
    setOrgRoom(target.roomId);
    setOrgRole(target.role);
    setOrgMeta(target.meta || {});
    setStaff(target.roster?.staff || []);
    try { localStorage.setItem('khora_active_org', target.roomId); } catch {}
    // Reload org-specific settings from cached scan data
    if (target.opacity) setOrgOpacity(target.opacity.level || 'translucent');
    if (target.msgAccess) setOrgMsgAccess(target.msgAccess);
    if (target.terminology) {
      const t = { ...TERMINOLOGY_DEFAULTS, ...target.terminology };
      setOrgTerminology(t);
      setTerminologyDraft(t);
    }
    // Reload email verification config from Matrix state
    try {
      const evConfig = await svc.getState(target.roomId, EVT.ORG_EMAIL_CONFIG).catch(() => null);
      if (evConfig) { setEmailVerifyConfig(evConfig); setEmailConfigDraft(evConfig); }
      const myStaff = target.roster?.staff?.find(s => s.userId === svc.userId);
      if (myStaff?.email_verification) setMyVerification(myStaff.email_verification);
    } catch {}
    // Reload case assignments
    try {
      const assignments = await svc.getState(target.roomId, EVT.ROSTER_ASSIGN);
      if (assignments?.assignments) setCaseAssignments(assignments.assignments);
      else setCaseAssignments({});
    } catch {}
    // Reload trash bin
    try {
      const trashState = await svc.getState(target.roomId, EVT.ORG_TRASH);
      setTrashedIndividuals(trashState || {});
    } catch { setTrashedIndividuals({}); }
    // Reload org channels for the new org
    try {
      const scanned = await svc.scanRooms([EVT.ORG_MSG_CHANNEL]);
      const newChannels = [];
      for (const [rid, state] of Object.entries(scanned)) {
        const chanMeta = state[EVT.ORG_MSG_CHANNEL];
        if (chanMeta && chanMeta.type === 'org_msg_channel') {
          newChannels.push({ roomId: rid, ...chanMeta });
        }
      }
      setOrgChannels(newChannels);
    } catch {}
    // Reset active channel when switching orgs
    setActiveChannel(null);
    setChannelMessages([]);
  }, [allOrgs, orgRoom]);

  // ─── Team mode switching ───
  const switchTeam = React.useCallback((targetRoomId) => {
    if (!targetRoomId) {
      setTeamMode(null);
      setActiveTeamContext(null);
      try { localStorage.removeItem('khora_active_team'); } catch {}
      return;
    }
    const target = teams.find(t => t.roomId === targetRoomId);
    if (!target) return;
    const mode = { roomId: target.roomId, name: target.name, color_hue: target.color_hue };
    setTeamMode(mode);
    setActiveTeamContext(target.roomId);
    try { localStorage.setItem('khora_active_team', target.roomId); } catch {}
  }, [teams]);

  // Helper: active context for tagging actions with team/org
  const activeContext = () => ({
    ...(teamMode ? { team_id: teamMode.roomId, team_name: teamMode.name } : {}),
    ...(orgRoom ? { org_id: orgRoom, org_name: orgMeta.name } : {})
  });

  // Notification helpers
  const addNotification = notif => {
    setNotifications(prev => [{
      ...notif,
      id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      read: false,
      timestamp: Date.now()
    }, ...prev].slice(0, 50));
  };
  const handleNotifClick = notif => {
    setNotifications(prev => prev.map(n => n.id === notif.id ? {
      ...n,
      read: true
    } : n));
    // Navigate based on notification type
    if (notif.type === 'schema_update' || notif.type === 'schema_new') {
      setView('schema');
      setActiveCase(null);
    } else if (notif.type === 'message' && notif.targetView) {
      setView(notif.targetView);
      setActiveCase(null);
    } else if (notif.type === 'org_event') {
      setView('org-settings');
      setActiveCase(null);
    }
  };
  const handleDismissAllNotifs = () => {
    setNotifications(prev => prev.map(n => ({
      ...n,
      read: true
    })));
  };
  useEffect(() => {
    initProvider();
  }, []);

  // ─── Real-time notification generation from Khora events ───
  useEffect(() => {
    const handleTimelineNotif = e => {
      const d = e.detail;
      if (!d || d.isOwn) return; // don't notify for own actions
      const type = d.type;
      if (type === EVT.OP) {
        const op = d.content?.op;
        const targetPath = d.content?.target || '';
        addNotification({
          type: 'data_change',
          title: `${op || 'EO'} operation: ${targetPath}`,
          description: `${d.sender?.split(':')[0]?.slice(1) || 'Someone'} performed ${op} on ${targetPath}`
        });
      } else if (type === EVT.OBSERVATION) {
        addNotification({
          type: 'data_change',
          title: 'New observation recorded',
          description: `${d.sender?.split(':')[0]?.slice(1) || 'Someone'} recorded: ${d.content?.prompt_key || 'observation'}`
        });
      } else if (type === EVT.NOTE) {
        addNotification({
          type: 'data_change',
          title: 'New note created',
          description: d.content?.title || 'Untitled note'
        });
      } else if (type === EVT.NOTE_EDIT) {
        addNotification({
          type: 'data_change',
          title: 'Note edited',
          description: (d.content?.title || 'Untitled') + ' edited by ' + (d.sender?.split(':')[0]?.slice(1) || 'someone')
        });
      }
    };
    const handleStateNotif = e => {
      const d = e.detail;
      if (!d || d.isOwn) return;
      const type = d.type;
      if (type === EVT.SCHEMA_FORM || type === EVT.SCHEMA_FIELD) {
        addNotification({
          type: 'schema_update',
          title: 'Schema updated',
          description: d.content?.name || d.content?.question_text || 'Form definition changed'
        });
      } else if (type === EVT.ORG_ROSTER) {
        addNotification({
          type: 'org_event',
          title: 'Organization roster updated',
          description: `${(d.content?.staff || []).length} staff members`
        });
      } else if (type === EVT.BRIDGE_META) {
        addNotification({
          type: 'data_change',
          title: 'Bridge updated',
          description: `Status: ${d.content?.status || 'unknown'}`
        });
      } else if (type === EVT.RESOURCE_TYPE || type === EVT.RESOURCE_RELATION || type === EVT.RESOURCE_INVENTORY) {
        loadResources(orgRoom, networkRoom, rosterRoom);
      }
    };
    window.addEventListener('khora:timeline', handleTimelineNotif);
    window.addEventListener('khora:state', handleStateNotif);
    return () => {
      window.removeEventListener('khora:timeline', handleTimelineNotif);
      window.removeEventListener('khora:state', handleStateNotif);
    };
  }, []);

  // Auto-refresh active inbox chat when new messages arrive in real time
  useEffect(() => {
    let debounce = null;
    const msgHandler = (e) => {
      const d = e.detail;
      if (d?.type !== 'm.room.message' || d?.isOwn) return;
      if (!inboxConvo || d?.roomId !== inboxConvo) return;
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => loadInboxMessages(inboxConvo), 300);
    };
    window.addEventListener('khora:timeline', msgHandler);
    return () => {
      window.removeEventListener('khora:timeline', msgHandler);
      if (debounce) clearTimeout(debounce);
    };
  }, [inboxConvo]);

  const rosterFrame = room => ({
    type: 'roster',
    room: room || rosterRoom,
    role: 'provider',
    epistemic: 'MEANT'
  });
  const bridgeFrame = room => ({
    type: 'bridge',
    room,
    role: 'provider',
    epistemic: 'MEANT'
  });
  const networkFrame = room => ({
    type: 'network',
    room: room || networkRoom,
    role: 'provider',
    epistemic: 'MEANT'
  });
  const orgFrame = room => ({
    type: 'org',
    room: room || orgRoom,
    role: orgRole || 'admin',
    epistemic: 'MEANT',
    ...(teamMode ? { team_id: teamMode.roomId, team_name: teamMode.name } : {})
  });
  const initProvider = async () => {
    setLoading(true);
    setInitError(null);
    try {
      // Single-pass scan: fetch all Khora state across rooms in one request
      const scanned = await svc.scanRooms([EVT.ORG_METADATA, EVT.ORG_ROSTER, EVT.PROVIDER_PROFILE, EVT.ORG_OPACITY, EVT.ORG_MSG_ACCESS, EVT.ORG_MSG_CHANNEL, EVT.ORG_TERMINOLOGY, EVT.ORG_ROLES, EVT.TEAM_META, EVT.TEAM_MEMBERS, EVT.TEAM_SCHEMA, EVT.TEAM_SCHEMA_RULE, EVT.TEAM_HIERARCHY, EVT.TEAM_TABLE_DEF, EVT.FIELD_DEF, EVT.FIELD_CROSSWALK, EVT.DM_META]);
      let roster = null,
        metricsR = null,
        schema = null,
        network = null;
      const detectedOrgs = []; // multi-org: collect all orgs user belongs to
      const bridgeData = [];
      const detectedClientRecords = [];
      const detectedOrgChannels = [];
      const detectedTeams = [];
      const detectedFieldDefs = {};
      const detectedCrosswalks = [];
      for (const [rid, state] of Object.entries(scanned)) {
        const id = state[EVT.IDENTITY];
        if (id?.account_type === 'provider' && id.owner === svc.userId) roster = rid;
        if (id?.account_type === 'metrics' && id.owner === svc.userId) metricsR = rid;
        if (id?.account_type === 'schema' && id.owner === svc.userId) schema = rid;
        if (id?.account_type === 'network') network = rid;
        // Detect client record rooms created by this provider (or claimed from this provider)
        if (id?.account_type === 'client_record' && (id.owner === svc.userId || id.previous_owner === svc.userId)) {
          detectedClientRecords.push({
            roomId: rid,
            ...id
          });
        }
        // Detect org rooms — owned or joined as staff (collect ALL orgs for multi-org support)
        if (id?.account_type === 'organization') {
          let myOrgRole = null;
          if (id.owner === svc.userId) {
            myOrgRole = 'admin';
          } else {
            const orgRoster = state[EVT.ORG_ROSTER];
            const entry = orgRoster?.staff?.find(s => s.userId === svc.userId);
            if (entry) myOrgRole = entry.role;
          }
          if (myOrgRole) {
            detectedOrgs.push({
              roomId: rid,
              role: myOrgRole,
              meta: state[EVT.ORG_METADATA] || {},
              roster: state[EVT.ORG_ROSTER],
              opacity: state[EVT.ORG_OPACITY],
              msgAccess: state[EVT.ORG_MSG_ACCESS],
              terminology: state[EVT.ORG_TERMINOLOGY],
              identity: id
            });
          }
        }
        // Detect inter-org messaging channels
        const chanMeta = state[EVT.ORG_MSG_CHANNEL];
        if (chanMeta && chanMeta.type === 'org_msg_channel') {
          detectedOrgChannels.push({
            roomId: rid,
            ...chanMeta
          });
        }
        // Detect team rooms (with schema + consent rule + hierarchy + custom tables)
        if (id?.account_type === 'team') {
          const teamMeta = state[EVT.TEAM_META] || {};
          const teamMembers = state[EVT.TEAM_MEMBERS] || {
            members: []
          };
          const teamSchema = state[EVT.TEAM_SCHEMA] || null;
          const teamSchemaRule = state[EVT.TEAM_SCHEMA_RULE] || null;
          const teamHierarchy = state[EVT.TEAM_HIERARCHY] || null;
          // Collect all TEAM_TABLE_DEF state events (keyed by stateKey = table.id)
          const teamTableDefs = [];
          const roomObj = svc.client?.getRoom(rid);
          if (roomObj) {
            const allState = roomObj.currentState?.events;
            if (allState) {
              const tableDefMap = allState.get(EVT.TEAM_TABLE_DEF);
              if (tableDefMap) {
                for (const [stateKey, evObj] of tableDefMap.entries()) {
                  const content = evObj.getContent?.() || evObj.content || {};
                  if (content.id) teamTableDefs.push(content);
                }
              }
            }
          }
          detectedTeams.push({
            roomId: rid,
            ...teamMeta,
            members: teamMembers.members || [],
            owner: id.owner,
            created: id.created,
            schema: teamSchema,
            schemaRule: teamSchemaRule,
            hierarchy: teamHierarchy,
            customTables: teamTableDefs
          });
        }
        // Collect field definitions and crosswalks from schema rooms
        if (id?.account_type === 'schema') {
          const defs = state[EVT.FIELD_DEF];
          if (defs?.definitions) Object.assign(detectedFieldDefs, defs.definitions);
          const xws = state[EVT.FIELD_CROSSWALK];
          if (xws?.crosswalks) detectedCrosswalks.push(...xws.crosswalks);
        }
        const meta = state[EVT.BRIDGE_META];
        const bridgeRefs = state[EVT.BRIDGE_REFS];
        if (meta && meta.status !== 'tombstoned') {
          // Include bridges where this user is the provider OR any org staff member is assigned
          if (meta.provider === svc.userId) {
            bridgeData.push({
              rid,
              meta,
              refs: bridgeRefs,
              mine: true
            });
          } else if (meta.assigned_staff?.includes(svc.userId)) {
            bridgeData.push({
              rid,
              meta,
              refs: bridgeRefs,
              mine: true
            });
          }
          // Detect soft-revoke (client removed provider without creating a new bridge)
          if (bridgeRefs?.revoked && meta.team_id) {
            try {
              const idx = await svc.getState(meta.team_id, EVT.TEAM_RECORD_INDEX) || { records: [] };
              const entry = idx.records.find(r => r.bridge_room_id === rid);
              if (entry && entry.vault_access !== 'severed') {
                entry.vault_access = 'severed';
                entry.vault_severed_at = Date.now();
                await svc.setState(meta.team_id, EVT.TEAM_RECORD_INDEX, { records: idx.records });
              }
            } catch (e) {
              console.warn('[Bridge] Failed to update team record index for severed bridge:', e.message);
            }
          }
        } else if (meta && meta.status === 'tombstoned' && meta.team_id) {
          // Client hard-revoked this bridge. Mark vault access as tombstoned in the team record index.
          // vault_tombstone_reason is intentionally NOT stored — client sovereignty.
          try {
            const idx = await svc.getState(meta.team_id, EVT.TEAM_RECORD_INDEX) || { records: [] };
            const entry = idx.records.find(r => r.bridge_room_id === rid);
            if (entry && entry.vault_access !== 'tombstoned') {
              entry.vault_access = 'tombstoned';
              entry.vault_tombstoned_at = Date.now();
              await svc.setState(meta.team_id, EVT.TEAM_RECORD_INDEX, { records: idx.records });
            }
          } catch (e) {
            console.warn('[Bridge] Failed to update team record index for tombstoned bridge:', e.message);
          }
        }
      }
      // Multi-org: select preferred org from localStorage, or fall back to first detected
      let preferredOrgId = null;
      try { preferredOrgId = localStorage.getItem('khora_active_org'); } catch {}
      const selectedOrg = detectedOrgs.find(o => o.roomId === preferredOrgId) || detectedOrgs[0] || null;
      const detectedOrg = selectedOrg?.roomId || null;
      const detectedOrgRole = selectedOrg?.role || null;
      if (!roster) {
        roster = await svc.createRoom('[Khora Roster]', 'Provider case index', [{
          type: EVT.IDENTITY,
          state_key: '',
          content: {
            account_type: 'provider',
            owner: svc.userId,
            created: Date.now()
          }
        }, {
          type: EVT.ROSTER_INDEX,
          state_key: '',
          content: {
            cases: []
          }
        }]);
      }
      if (!metricsR) {
        metricsR = await svc.createRoom('[Khora Metrics]', 'Anonymized metrics', [{
          type: EVT.IDENTITY,
          state_key: '',
          content: {
            account_type: 'metrics',
            owner: svc.userId,
            created: Date.now()
          }
        }]);
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
        // Interpretations — MEANT assessments (provider instruments)
        ...DEFAULT_PROVIDER_PROMPTS.map(pp => () => svc.setState(schema, EVT.SCHEMA_ASSESSMENT, pp, pp.key)),
        // Interpretations — classification rules and authorities
        ...DEFAULT_DEFINITIONS.map(d => () => svc.setState(schema, EVT.SCHEMA_DEF, d, d.key)), ...DEFAULT_AUTHORITIES.map(a => () => svc.setState(schema, EVT.SCHEMA_AUTHORITY, a, a.id)), [() => svc.setState(schema, EVT.SCHEMA_TRANSFORM, {
          id: 'transform_default',
          transforms: DEFAULT_TRANSFORMS
        }, 'default')]].flat();
        for (let i = 0; i < allSeeds.length; i++) {
          await allSeeds[i]();
          if (i % 3 === 2) await new Promise(r => setTimeout(r, 200));
        }
      }
      // Fallback: if metrics/schema not found by owner, check org metadata for linked room IDs
      if (detectedOrgs.length > 0) {
        const activeOrg = detectedOrgs[0];
        if (!metricsR && activeOrg.meta?.metrics_room) {
          metricsR = activeOrg.meta.metrics_room;
        }
        if (!schema && activeOrg.meta?.schema_room) {
          schema = activeOrg.meta.schema_room;
        }
      }
      setRosterRoom(roster);
      setMetricsRoom(metricsR);
      setSchemaRoom(schema);
      // Load provider profile from roster room
      const rosterState = scanned[roster];
      if (rosterState?.[EVT.PROVIDER_PROFILE]) setProviderProfile(rosterState[EVT.PROVIDER_PROFILE]);
      if (network) {
        setNetworkRoom(network);
        await loadNetworkMembers(network);
      }
      // Store all detected orgs for multi-org switching
      setAllOrgs(detectedOrgs);
      // Load org context if detected during scan
      if (detectedOrg) {
        setOrgRoom(detectedOrg);
        setOrgRole(detectedOrgRole);
        try { localStorage.setItem('khora_active_org', detectedOrg); } catch {}
        const orgState = scanned[detectedOrg];
        if (orgState?.[EVT.ORG_METADATA]) setOrgMeta(orgState[EVT.ORG_METADATA]);
        if (orgState?.[EVT.ORG_ROSTER]?.staff) setStaff(orgState[EVT.ORG_ROSTER].staff);
        // Load email verification config
        try {
          const evConfig = await svc.getState(detectedOrg, EVT.ORG_EMAIL_CONFIG).catch(() => null);
          if (evConfig) {
            setEmailVerifyConfig(evConfig);
            setEmailConfigDraft(evConfig);
          }
          // Load my verification status from roster
          const myStaff = orgState?.[EVT.ORG_ROSTER]?.staff?.find(s => s.userId === svc.userId);
          if (myStaff?.email_verification) setMyVerification(myStaff.email_verification);
        } catch (e) {
          console.warn('Email verify config load:', e.message);
        }
        // Load opacity & message access settings
        if (orgState?.[EVT.ORG_OPACITY]) setOrgOpacity(orgState[EVT.ORG_OPACITY].level || 'translucent');
        if (orgState?.[EVT.ORG_MSG_ACCESS]) setOrgMsgAccess(orgState[EVT.ORG_MSG_ACCESS]);
        // Load org terminology customization
        if (orgState?.[EVT.ORG_TERMINOLOGY]) {
          const t = {
            ...TERMINOLOGY_DEFAULTS,
            ...orgState[EVT.ORG_TERMINOLOGY]
          };
          setOrgTerminology(t);
          setTerminologyDraft(t);
        }
        // Load org custom roles
        if (orgState?.[EVT.ORG_ROLES]?.roles) {
          setOrgRolesConfig(orgState[EVT.ORG_ROLES].roles);
        }
        // Load detected org messaging channels
        if (detectedOrgChannels.length > 0) setOrgChannels(detectedOrgChannels);
        // Load case assignments from org room
        try {
          const assignments = await svc.getState(detectedOrg, EVT.ROSTER_ASSIGN);
          if (assignments?.assignments) setCaseAssignments(assignments.assignments);
        } catch (e) {
          console.warn('Assignment load:', e.message);
        }
        // Load trash bin state from org room
        try {
          const trashState = await svc.getState(detectedOrg, EVT.ORG_TRASH);
          if (trashState) setTrashedIndividuals(trashState);
        } catch (e) { /* trash may be empty */ }
      }
      // Load teams detected during scan — apply per-user local color overrides
      if (detectedTeams.length > 0) setTeams(detectedTeams.map((t, i) => ({
        ...t,
        color_hue: getLocalTeamColor(svc.userId, t.roomId, t.color_hue != null ? t.color_hue : distinctTeamHue(i))
      })));
      // Restore team mode from localStorage
      try {
        const savedTeamId = JSON.parse(localStorage.getItem('khora_active_team') || 'null')?.roomId;
        if (savedTeamId) {
          const savedTeam = detectedTeams.find(t => t.roomId === savedTeamId);
          if (savedTeam) {
            const localHue = getLocalTeamColor(svc.userId, savedTeam.roomId, savedTeam.color_hue != null ? savedTeam.color_hue : 260);
            setTeamMode({ roomId: savedTeam.roomId, name: savedTeam.name, color_hue: localHue });
          }
        }
      } catch {}
      // Detect existing team member DM rooms from scan
      const detectedDMs = [];
      for (const [rid, state] of Object.entries(scanned)) {
        const dmMeta = state[EVT.DM_META];
        if (dmMeta && (dmMeta.initiator === svc.userId || dmMeta.target === svc.userId)) {
          const peerId = dmMeta.initiator === svc.userId ? dmMeta.target : dmMeta.initiator;
          detectedDMs.push({
            roomId: rid,
            peerId,
            peerName: dmMeta.peer_names?.[peerId] || peerId,
            teamName: dmMeta.team_name || null,
            teamRoomId: dmMeta.team_room_id || null,
            orgName: dmMeta.org_name || null,
            peerType: dmMeta.peer_type || 'provider'
          });
        }
      }
      if (detectedDMs.length > 0) setTeamDMs(detectedDMs);
      // Load field definitions and crosswalks
      // Seed vault field defs if schema room exists and no defs stored yet
      if (schema && Object.keys(detectedFieldDefs).length === 0) {
        const seedDefs = {};
        for (const f of DOMAIN_CONFIG.vaultFields) {
          seedDefs[f.uri] = {
            uri: f.uri,
            key: f.key,
            label: f.label,
            version: 1,
            definition: f.definition || '',
            scope: f.scope || '',
            category: f.category,
            sensitive: f.sensitive,
            data_type: f.data_type || 'text',
            authority: f.authority || null,
            created_by: svc.userId,
            created_at: Date.now(),
            supersedes: null
          };
        }
        try {
          await svc.setState(schema, EVT.FIELD_DEF, {
            definitions: seedDefs
          });
        } catch (e) {
          console.debug('Field def seed:', e.message);
        }
        Object.assign(detectedFieldDefs, seedDefs);
      }
      setFieldDefs(detectedFieldDefs);
      setFieldCrosswalks(detectedCrosswalks);
      // Load field governance config from org or network room
      if (detectedOrg || network) {
        try {
          const govRoom = network || detectedOrg;
          const govConfig = await svc.getState(govRoom, EVT.FIELD_GOV_CONFIG);
          if (govConfig) setFieldGovernanceConfig(govConfig);
        } catch { /* no config yet */ }
      }
      // Load client records detected during scan
      if (detectedClientRecords.length > 0) {
        // Check room membership to determine status
        const enriched = [];
        for (const rec of detectedClientRecords) {
          let status = rec.status || 'created';
          // If the identity state already says 'claimed', respect that
          if (status === 'claimed') {
            enriched.push({
              ...rec,
              status
            });
            continue;
          }
          if (rec.client_matrix_id && svc.client) {
            try {
              const members = await svc.getRoomMembers(rec.roomId);
              const clientMember = members.find(m => m.userId === rec.client_matrix_id);
              if (clientMember) status = 'joined';else if (status === 'created' && rec.client_matrix_id) status = 'invited';
            } catch {}
          }
          enriched.push({
            ...rec,
            status
          });
        }
        setClientRecords(enriched);
      }
      // Process bridge data collected during scan (no second pass needed)
      await loadCasesFromScan(bridgeData, metricsR);
      await loadResources(detectedOrg, network, roster);
      // Auto-register bridges in org assignments if needed
      if (detectedOrg && bridgeData.length > 0) {
        const currentAssignments = {};
        try {
          const a = await svc.getState(detectedOrg, EVT.ROSTER_ASSIGN);
          if (a?.assignments) Object.assign(currentAssignments, a.assignments);
        } catch {}
        const casesForSync = bridgeData.map(({
          rid,
          meta,
          refs
        }) => ({
          bridgeRoomId: rid,
          meta,
          sharedData: {},
          clientUserId: meta.client,
          transferable: meta.transferable !== false,
          assigned_staff: meta.assigned_staff || [meta.provider]
        }));
        await syncAssignments(detectedOrg, casesForSync, currentAssignments);
      }
    } catch (e) {
      console.error('Provider init failed:', e);
      setInitError(e.message || 'Failed to initialize provider workspace.');
    }
    setLoading(false);
  };
  const loadCasesFromScan = async (bridgeData, mRoom) => {
    const found = [];
    for (const {
      rid,
      meta,
      refs
    } of bridgeData) {
      const decrypted = {};
      if (refs?.fields) {
        for (const [key, ref] of Object.entries(refs.fields)) {
          try {
            if (ref.key && ref.ciphertext && ref.iv) {
              const plain = await FieldCrypto.decrypt(ref.ciphertext, ref.iv, ref.key);
              if (plain !== null) decrypted[key] = plain;
            }
          } catch {/* skip undecryptable field */}
        }
      }
      // Backfill org_id on bridge meta if provider has an org and bridge doesn't have one yet
      if (orgRoom && !meta.org_id && meta.provider === svc.userId) {
        try {
          await svc.setState(rid, EVT.BRIDGE_META, {
            ...meta,
            org_id: orgRoom
          });
          meta.org_id = orgRoom;
        } catch {}
      }
      // Backfill team_id on bridge meta when the provider is operating in a team context.
      // This allows the scan to detect tombstoned bridges and update the team record index.
      if (activeTeamContext && !meta.team_id && meta.provider === svc.userId) {
        try {
          await svc.setState(rid, EVT.BRIDGE_META, {
            ...meta,
            team_id: activeTeamContext
          });
          meta.team_id = activeTeamContext;
        } catch {}
      }
      found.push({
        bridgeRoomId: rid,
        clientUserId: meta.client,
        meta,
        sharedData: decrypted,
        metricsRoom: mRoom || metricsRoom,
        transferable: meta.transferable !== false,
        org_id: meta.org_id || null,
        assigned_staff: meta.assigned_staff || [meta.provider]
      });
    }
    setCases(found);
    // Load data table extras (notes, allocations) in background
    loadDataTableExtras(found).catch(e => console.warn('DT extras load:', e.message));
  };
  const loadCases = async () => {
    const scanned = await svc.scanRooms();
    const bridgeData = [];
    for (const [rid, state] of Object.entries(scanned)) {
      const meta = state[EVT.BRIDGE_META];
      if (meta && meta.status !== 'tombstoned') {
        if (meta.provider === svc.userId || meta.assigned_staff?.includes(svc.userId)) {
          bridgeData.push({
            rid,
            meta,
            refs: state[EVT.BRIDGE_REFS]
          });
        }
      }
    }
    await loadCasesFromScan(bridgeData);
  };

  // Load notes and allocations for the data table view
  const loadDataTableExtras = async currentCases => {
    if (!svc.client) return;
    const notesMap = {};
    const allAllocs = [];
    for (const c of currentCases) {
      const room = svc.client.getRoom(c.bridgeRoomId);
      if (!room) continue;
      // Paginate backwards to capture historical observations, messages, and allocations
      try {
        for (let i = 0; i < 3; i++) {
          const canPaginate = room.getLiveTimeline().getPaginationToken('b');
          if (!canPaginate) break;
          await svc.client.scrollback(room, 100);
        }
      } catch (e) {/* pagination may fail — continue with available events */}
      const seenIds = new Set();
      const events = [];
      const timelineSets = room.getTimelineSets ? room.getTimelineSets() : [];
      if (timelineSets.length > 0) {
        for (const ts of timelineSets) {
          for (const tl of ts.getTimelines()) {
            for (const ev of tl.getEvents()) {
              if (!seenIds.has(ev.getId())) {
                seenIds.add(ev.getId());
                events.push(ev);
              }
            }
          }
        }
      } else {
        for (const ev of room.getLiveTimeline().getEvents()) events.push(ev);
      }
      // Extract observations as "shared notes"
      const obs = events.filter(e => e.getType() === EVT.OBSERVATION).map(e => {
        const content = e.getContent();
        return {
          id: e.getId(),
          indId: c.bridgeRoomId,
          type: 'shared',
          eo_op: 'INS',
          frame: content.frame || 'GIVEN',
          room: 'bridge',
          category: content.category || 'observation',
          author: (e.getSender() || '').split(':')[0]?.replace('@', '') || 'Unknown',
          at: content.ts || e.getTs(),
          text: content.notes || content.value || content.question || '(observation recorded)',
          tags: content.tags || []
        };
      });
      // Extract messages as shared notes
      const msgs = events.filter(e => e.getType() === 'm.room.message' && e.getContent().msgtype === 'm.text').slice(-10).map(e => ({
        id: e.getId(),
        indId: c.bridgeRoomId,
        type: 'shared',
        eo_op: 'INS',
        frame: 'GIVEN',
        room: 'bridge',
        category: 'message',
        author: (e.getSender() || '').split(':')[0]?.replace('@', '') || 'Unknown',
        at: e.getTs(),
        text: e.getContent().body || '',
        tags: []
      }));
      notesMap[c.bridgeRoomId] = [...obs, ...msgs].sort((a, b) => (b.at || 0) - (a.at || 0));
      // Extract allocations
      const allocEvts = events.filter(e => e.getType() === EVT.RESOURCE_ALLOC).map(e => {
        const content = e.getContent();
        return {
          id: content.id || e.getId(),
          indId: c.bridgeRoomId,
          resourceId: content.resource_type_id,
          eo_op: 'CON',
          frame: 'MEANT',
          resourceName: content.resource_name || content.resource_type_id || 'Resource',
          quantity: content.quantity || 1,
          unit: content.unit || 'unit',
          status: content.status || 'active',
          allocatedBy: (content.allocated_by || '').split(':')[0]?.replace('@', '') || T.staff_term,
          org: 'Organization',
          at: content.allocated_at || e.getTs(),
          expiresAt: content.expires_at || null,
          bridgeRoom: c.bridgeRoomId,
          vaultShadow: content.vault_shadow || null,
          events: content.events || [],
          constraintsChecked: content.constraints_checked || [],
          indName: c.sharedData.full_name || c.clientUserId || 'Unknown'
        };
      });
      allAllocs.push(...allocEvts);
    }
    setBridgeNotes(notesMap);
    setAllAllocations(allAllocs);

    // ─── Load structured notes (io.khora.note) from bridges + roster ───
    const allNotes = [];
    // Notes from bridge rooms (attached to individuals)
    for (const c of currentCases) {
      const room = svc.client.getRoom(c.bridgeRoomId);
      if (!room) continue;
      const events = room.getLiveTimeline().getEvents();
      events.filter(e => e.getType() === EVT.NOTE).forEach(e => {
        const content = e.getContent();
        allNotes.push({
          ...content,
          id: content.id || e.getId(),
          attached_to: content.attached_to || c.bridgeRoomId,
          author: content.author || e.getSender(),
          created: content.created || e.getTs(),
          _sourceRoom: c.bridgeRoomId
        });
      });
    }
    // Notes from roster room (standalone or references)
    if (rosterRoom) {
      const rRoom = svc.client.getRoom(rosterRoom);
      if (rRoom) {
        rRoom.getLiveTimeline().getEvents().filter(e => e.getType() === EVT.NOTE).forEach(e => {
          const content = e.getContent();
          allNotes.push({
            ...content,
            id: content.id || e.getId(),
            author: content.author || e.getSender(),
            created: content.created || e.getTs(),
            _sourceRoom: rosterRoom
          });
        });
      }
    }
    // ─── Collect NOTE_EDIT events and apply to notes ───
    const allEdits = [];
    for (const c of currentCases) {
      const room = svc.client.getRoom(c.bridgeRoomId);
      if (!room) continue;
      room.getLiveTimeline().getEvents().filter(e => e.getType() === EVT.NOTE_EDIT).forEach(e => {
        allEdits.push(e.getContent());
      });
    }
    if (rosterRoom) {
      const rRoom = svc.client.getRoom(rosterRoom);
      if (rRoom) {
        rRoom.getLiveTimeline().getEvents().filter(e => e.getType() === EVT.NOTE_EDIT).forEach(e => {
          allEdits.push(e.getContent());
        });
      }
    }
    // Group edits by note_id, sorted chronologically
    const editsByNote = {};
    allEdits.sort((a, b) => (a.edited_at || 0) - (b.edited_at || 0)).forEach(ed => {
      if (!ed.note_id) return;
      if (!editsByNote[ed.note_id]) editsByNote[ed.note_id] = [];
      editsByNote[ed.note_id].push(ed);
    });
    // Sort by created desc, deduplicate by id, apply edits
    const seenNoteIds = new Set();
    const dedupedNotes = allNotes.filter(n => {
      if (seenNoteIds.has(n.id)) return false;
      seenNoteIds.add(n.id);
      return true;
    }).map(n => {
      const edits = editsByNote[n.id];
      if (!edits || edits.length === 0) return { ...n, edit_history: [] };
      // Apply edits sequentially to get current state
      let current = { ...n, edit_history: edits };
      for (const ed of edits) {
        if (ed.title !== undefined) current.title = ed.title;
        if (ed.content !== undefined) current.content = ed.content;
        current.updated = ed.edited_at;
        current.last_edited_by = ed.edited_by;
      }
      return current;
    }).sort((a, b) => (b.created || 0) - (a.created || 0));
    setDbNotes(dedupedNotes);
  };

  // ─── Cell edit handler with debounced EO event tracking ───
  const handleDbCellEdit = (row, fieldKey, newValue) => {
    const oldValue = row[fieldKey] || row.fields && row.fields[fieldKey]?.value || '';
    if (newValue === oldValue) return;
    // Debounce: clear existing timer for this row+field, set a new one
    const timerKey = row.id + ':' + fieldKey;
    if (cellEditTimerRef.current[timerKey]) clearTimeout(cellEditTimerRef.current[timerKey]);
    cellEditTimerRef.current[timerKey] = setTimeout(async () => {
      try {
        const roomId = row.bridgeRoom || row.id;
        // Emit EO operation to track the edit
        await emitOp(roomId, oldValue ? 'ALT' : 'INS', dot('org', 'individuals', fieldKey), {
          from: oldValue || undefined,
          to: newValue,
          edit_source: 'database_view'
        }, {
          type: 'org',
          epistemic: 'MEANT',
          role: orgRole || 'provider'
        });
        // Persist the edit to Matrix state
        if (row._case) {
          if (fieldKey === 'name') {
            // Update full_name in bridge shared data
            const updatedData = {
              ...row._case.sharedData,
              full_name: newValue
            };
            await svc.setState(roomId, EVT.BRIDGE_REFS, {
              fields: updatedData
            });
            // Update client_name in ROSTER_ASSIGN for org room
            if (orgRoom && caseAssignments[roomId]) {
              const updatedAssignments = {
                ...caseAssignments
              };
              updatedAssignments[roomId] = {
                ...updatedAssignments[roomId],
                client_name: newValue
              };
              await svc.setState(orgRoom, EVT.ROSTER_ASSIGN, {
                assignments: updatedAssignments
              });
              setCaseAssignments(updatedAssignments);
            }
          } else if (fieldKey === 'priority') {
            // Update priority in ROSTER_ASSIGN
            if (orgRoom && caseAssignments[roomId]) {
              const updatedAssignments = {
                ...caseAssignments
              };
              updatedAssignments[roomId] = {
                ...updatedAssignments[roomId],
                priority: newValue
              };
              await svc.setState(orgRoom, EVT.ROSTER_ASSIGN, {
                assignments: updatedAssignments
              });
              setCaseAssignments(updatedAssignments);
            }
          } else {
            // Dynamic field — update shared data in bridge
            const updatedData = {
              ...row._case.sharedData,
              [fieldKey]: newValue
            };
            await svc.setState(roomId, EVT.BRIDGE_REFS, {
              fields: updatedData
            });
          }
        } else if (row._clientRecord) {
          // Client record rows — update identity state
          const updates = {
            ...row._clientRecord
          };
          if (fieldKey === 'name') updates.client_name = newValue;
          await svc.setState(row.id, EVT.IDENTITY, updates);
        }
      } catch (e) {
        console.warn('Cell edit event failed:', e.message);
      }
      delete cellEditTimerRef.current[timerKey];
    }, 300); // 300ms debounce
  };

  // ─── Note save handler ───
  const handleNoteSave = noteData => {
    setDbNotes(prev => [noteData, ...prev]);
  };

  // ─── Note edit handler (ALT operation) ───
  const handleNoteEdit = editData => {
    setDbNotes(prev => prev.map(n => {
      if (n.id !== editData.note_id) return n;
      const editEntry = {
        title: editData.title,
        content: editData.content,
        prev_title: editData.prev_title,
        prev_content: editData.prev_content,
        edited_by: editData.edited_by,
        edited_at: editData.edited_at
      };
      return {
        ...n,
        title: editData.title,
        content: editData.content,
        updated: editData.edited_at,
        last_edited_by: editData.edited_by,
        edit_history: [...(n.edit_history || []), editEntry]
      };
    }));
    // Update the detail modal if it's showing this note
    setNoteDetailModal(prev => {
      if (!prev || prev.id !== editData.note_id) return prev;
      const editEntry = {
        title: editData.title,
        content: editData.content,
        prev_title: editData.prev_title,
        prev_content: editData.prev_content,
        edited_by: editData.edited_by,
        edited_at: editData.edited_at
      };
      return {
        ...prev,
        title: editData.title,
        content: editData.content,
        updated: editData.edited_at,
        last_edited_by: editData.edited_by,
        edit_history: [...(prev.edit_history || []), editEntry]
      };
    });
  };

  // ─── Bulk action handler for database table ───
  const handleBulkAction = async (actionId, selectedRows) => {
    if (actionId === 'delete') {
      if (!window.confirm(`Move ${selectedRows.length} individual(s) to trash?`)) return;
      let newTrash = { ...trashedIndividuals };
      for (const rowId of selectedRows) {
        const c = cases.find(c => c.bridgeRoomId === rowId);
        const roomId = rowId;
        try {
          // EO: NUL(org.individuals.{roomId}, {from: 'active', to: 'deleted', reason: 'user_deleted'}) — individual_trash
          await emitOp(roomId, 'NUL', dot('org', 'individuals', roomId), {
            from: c ? 'active' : 'created',
            to: 'deleted',
            reason: 'user_deleted'
          }, {
            type: 'org',
            epistemic: 'MEANT',
            role: orgRole || 'provider'
          });
          newTrash[roomId] = {
            deletedBy: svc.userId,
            deletedAt: Date.now(),
            name: c?.sharedData?.full_name || c?.clientUserId || 'Unknown'
          };
        } catch (e) {
          console.warn('Bulk delete failed for', roomId, e.message);
        }
      }
      if (orgRoom) {
        try {
          await svc.setState(orgRoom, EVT.ORG_TRASH, newTrash);
        } catch (e) { console.warn('Trash persist failed:', e.message); }
      }
      setTrashedIndividuals(newTrash);
      showToast(`${selectedRows.length} individual(s) moved to trash`, 'warn');
    } else if (actionId === 'assign') {
      const staffList = (staff || []).map(s => s.display_name || s.userId?.split(':')[0]?.replace('@', '') || s.userId);
      const staffName = window.prompt('Assign to ' + T.staff_term.toLowerCase() + (staffList.length > 0 ? ' (' + staffList.join(', ') + ')' : '') + ':');
      if (!staffName) return;
      for (const rowId of selectedRows) {
        try {
          if (orgRoom && caseAssignments[rowId]) {
            const updatedAssignments = {
              ...caseAssignments
            };
            updatedAssignments[rowId] = {
              ...updatedAssignments[rowId],
              primary: staffName,
              staff: [staffName, ...(updatedAssignments[rowId].staff || []).filter(s => s !== staffName)]
            };
            await svc.setState(orgRoom, EVT.ROSTER_ASSIGN, {
              assignments: updatedAssignments
            });
            setCaseAssignments(updatedAssignments);
          }
          await emitOp(rowId, 'ALT', dot('org', 'individuals', 'assigned_to'), {
            to: staffName,
            edit_source: 'database_bulk'
          }, {
            type: 'org',
            epistemic: 'MEANT',
            role: orgRole || 'provider'
          });
        } catch (e) {
          console.warn('Bulk assign failed for', rowId, e.message);
        }
      }
      showToast(`${selectedRows.length} individual(s) assigned to ${staffName}`, 'success');
    } else if (actionId === 'tag') {
      showToast('Tagging is not yet implemented', 'info');
    }
  };

  // ─── Restore individual from trash ───
  const handleRestoreIndividual = async (roomId) => {
    try {
      // EO: INS(org.individuals.{roomId}, {from: 'deleted', to: 'active', reason: 'user_restored'}) — individual_restore
      await emitOp(roomId, 'INS', dot('org', 'individuals', roomId), {
        from: 'deleted',
        to: 'active',
        reason: 'user_restored'
      }, {
        type: 'org',
        epistemic: 'MEANT',
        role: orgRole || 'provider'
      });
      const newTrash = { ...trashedIndividuals };
      delete newTrash[roomId];
      if (orgRoom) {
        await svc.setState(orgRoom, EVT.ORG_TRASH, newTrash);
      }
      setTrashedIndividuals(newTrash);
      showToast('Individual restored', 'success');
    } catch (e) {
      showToast('Restore failed: ' + e.message, 'error');
    }
  };

  // ─── Row reorder handler for database table ───
  const handleReorder = (fromIdx, toIdx) => {
    setClientRecords(prev => {
      const updated = [...prev];
      const [moved] = updated.splice(fromIdx, 1);
      updated.splice(toIdx, 0, moved);
      return updated;
    });
    try {
      emitOp(orgRoom || rosterRoom, 'ALT', dot('org', 'individual_order', 'sort_order'), {
        from: fromIdx,
        to: toIdx,
        edit_source: 'database_drag'
      }, {
        type: 'org',
        epistemic: 'MEANT',
        role: orgRole || 'provider'
      });
    } catch (e) {/* silent */}
  };

  // Auto-register cases in org ROSTER_ASSIGN when they aren't tracked yet
  const syncAssignments = async (orgRoomId, currentCases, currentAssignments) => {
    if (!orgRoomId) return;
    let updated = false;
    const assignments = {
      ...currentAssignments
    };
    for (const c of currentCases) {
      if (!assignments[c.bridgeRoomId]) {
        assignments[c.bridgeRoomId] = {
          primary: c.meta.provider,
          staff: c.assigned_staff || [c.meta.provider],
          client_name: c.sharedData.full_name || c.clientUserId,
          transferable: c.transferable,
          added: Date.now()
        };
        updated = true;
      }
    }
    if (updated) {
      try {
        await svc.setState(orgRoomId, EVT.ROSTER_ASSIGN, {
          assignments
        });
        setCaseAssignments(assignments);
      } catch (e) {
        console.warn('Assignment sync failed:', e.message);
      }
    }
  };
  const loadNetworkMembers = async nRoom => {
    const members = await svc.getState(nRoom, EVT.NET_MEMBERS);
    setNetworkMembers(members?.organizations || []);
  };
  const loadResources = async (oRoom, nRoom, pRoom) => {
    const types = [];
    const relations = [];
    const inv = {};
    if (!svc.client) {
      setResourceTypes(types);
      setResourceRelations(relations);
      setResourceInventory(inv);
      return;
    }
    // Load resource types from org room
    if (oRoom) {
      const room = svc.client.getRoom(oRoom);
      if (room) {
        const stateEvents = room.currentState.getStateEvents(EVT.RESOURCE_TYPE);
        if (stateEvents) {
          const evArr = Array.isArray(stateEvents) ? stateEvents : [stateEvents];
          evArr.forEach(e => {
            const c = e.getContent ? e.getContent() : e;
            if (c && c.id) types.push({
              ...c,
              _source: 'org'
            });
          });
        }
        const relEvents = room.currentState.getStateEvents(EVT.RESOURCE_RELATION);
        if (relEvents) {
          const evArr = Array.isArray(relEvents) ? relEvents : [relEvents];
          evArr.forEach(e => {
            const c = e.getContent ? e.getContent() : e;
            if (c && c.id) relations.push(c);
          });
        }
        const invEvents = room.currentState.getStateEvents(EVT.RESOURCE_INVENTORY);
        if (invEvents) {
          const evArr = Array.isArray(invEvents) ? invEvents : [invEvents];
          evArr.forEach(e => {
            const c = e.getContent ? e.getContent() : e;
            if (c && c.relation_id) inv[c.relation_id] = c;
          });
        }
      }
    }
    // Load resource types from network room (if different)
    if (nRoom) {
      const room = svc.client.getRoom(nRoom);
      if (room) {
        const stateEvents = room.currentState.getStateEvents(EVT.RESOURCE_TYPE);
        if (stateEvents) {
          const evArr = Array.isArray(stateEvents) ? stateEvents : [stateEvents];
          evArr.forEach(e => {
            const c = e.getContent ? e.getContent() : e;
            if (c && c.id && !types.find(t => t.id === c.id)) types.push({
              ...c,
              _source: 'network'
            });
          });
        }
      }
    }
    // Load personal resource types from roster room
    if (pRoom) {
      const room = svc.client.getRoom(pRoom);
      if (room) {
        const stateEvents = room.currentState.getStateEvents(EVT.RESOURCE_TYPE);
        if (stateEvents) {
          const evArr = Array.isArray(stateEvents) ? stateEvents : [stateEvents];
          evArr.forEach(e => {
            const c = e.getContent ? e.getContent() : e;
            if (c && c.id && !types.find(t => t.id === c.id)) types.push({
              ...c,
              _source: 'personal'
            });
          });
        }
        const relEvents = room.currentState.getStateEvents(EVT.RESOURCE_RELATION);
        if (relEvents) {
          const evArr = Array.isArray(relEvents) ? relEvents : [relEvents];
          evArr.forEach(e => {
            const c = e.getContent ? e.getContent() : e;
            if (c && c.id) relations.push(c);
          });
        }
        const invEvents = room.currentState.getStateEvents(EVT.RESOURCE_INVENTORY);
        if (invEvents) {
          const evArr = Array.isArray(invEvents) ? invEvents : [invEvents];
          evArr.forEach(e => {
            const c = e.getContent ? e.getContent() : e;
            if (c && c.relation_id) inv[c.relation_id] = c;
          });
        }
      }
    }
    setResourceTypes(types);
    setResourceRelations(relations);
    setResourceInventory(inv);
  };
  const loadMessages = async bid => {
    setMessages(await svc.getMessages(bid));
  };
  const handleSendMsg = async () => {
    if (!msgText.trim() || !activeCase) return;
    const reply = caseReplyTo;
    await svc.sendMessage(activeCase, msgText, {
      [`${NS}.type`]: 'note'
    }, reply);
    await emitOp(activeCase, 'INS', dot('bridge', 'messages', 'provider_note'), {
      body: msgText
    }, bridgeFrame(activeCase));
    setMsgText('');
    setCaseReplyTo(null);
    setTimeout(() => loadMessages(activeCase), 500);
  };
  const handleSendRequest = async () => {
    if (!requestText.trim() || !activeCase) return;
    await svc.sendMessage(activeCase, `Information Request: ${requestText}`, {
      [`${NS}.type`]: 'request'
    });
    await emitOp(activeCase, 'DES', dot('bridge', 'case', 'information_request'), {
      request: requestText
    }, bridgeFrame(activeCase));
    setRequestText('');
    showToast('Request sent to client', 'success');
    setTimeout(() => loadMessages(activeCase), 500);
  };

  // Record structured provider observation in bridge room (MEANT frame)
  const handleProviderObservation = async () => {
    if (!provObsValue || !provObsModal || !activeCase) return;
    const obs = {
      id: genOpId(),
      prompt_id: provObsModal.id,
      prompt_key: provObsModal.key,
      value: provObsValue,
      notes: provObsNotes || undefined,
      schema_version: provObsModal.version || 1,
      author: svc.userId,
      ts: Date.now(),
      created_by: svc.userId,
      origin_server: extractHomeserver(svc.userId),
      ...(teamMode ? { team_id: teamMode.roomId, team_name: teamMode.name } : {})
    };
    await svc.sendEvent(activeCase, EVT.OBSERVATION, obs);
    await emitOp(activeCase, 'INS', dot('bridge', 'observations', provObsModal.key), {
      value: provObsValue,
      prompt: provObsModal.question,
      notes: provObsNotes || undefined,
      epistemic_crossing: provObsModal.category === 'assessment' ? 'GIVEN → MEANT' : undefined
    }, bridgeFrame(activeCase));
    setProvObservations(prev => [...prev, obs]);
    setProvObsModal(null);
    setProvObsValue('');
    setProvObsNotes('');
    showToast(`Observation recorded: ${provObsModal.question}`, 'success');
  };

  // Load provider observations from bridge (paginate to capture historical observations)
  const loadProviderObservations = async bid => {
    if (!svc.client) return;
    const room = svc.client.getRoom(bid);
    if (!room) return;
    // Paginate backwards to ensure we capture historical observations
    try {
      for (let i = 0; i < 3; i++) {
        const canPaginate = room.getLiveTimeline().getPaginationToken('b');
        if (!canPaginate) break;
        await svc.client.scrollback(room, 100);
      }
    } catch (e) {/* pagination may fail — continue with available events */}
    const seenIds = new Set();
    const allEvents = [];
    const timelineSets = room.getTimelineSets ? room.getTimelineSets() : [];
    if (timelineSets.length > 0) {
      for (const ts of timelineSets) {
        for (const tl of ts.getTimelines()) {
          for (const ev of tl.getEvents()) {
            if (!seenIds.has(ev.getId()) && ev.getType() === EVT.OBSERVATION) {
              seenIds.add(ev.getId());
              allEvents.push(ev);
            }
          }
        }
      }
    } else {
      for (const ev of room.getLiveTimeline().getEvents()) {
        if (ev.getType() === EVT.OBSERVATION) allEvents.push(ev);
      }
    }
    const obs = allEvents.map(e => e.getContent());
    setProvObservations(obs);
  };

  // ─── Case transfer between providers within org ───
  const handleTransferCase = async () => {
    if (!transferModal || !transferTarget.trim() || !orgRoom) return;
    const c = transferModal;
    // Check if client has allowed transfers
    if (!c.transferable) {
      showToast(`Transfer blocked — ${T.client_term.toLowerCase()} has disabled provider transfers for this bridge`, 'error');
      return;
    }
    // Don't transfer to the same provider
    if (transferTarget === c.meta.provider) {
      showToast('Case is already assigned to this provider', 'warn');
      return;
    }
    // Verify target is org staff
    const targetStaff = staff.find(s => s.userId === transferTarget);
    if (!targetStaff) {
      showToast('Target must be a member of your organization', 'error');
      return;
    }
    try {
      // Step 1: Invite new provider to the bridge room
      try {
        await svc.invite(c.bridgeRoomId, transferTarget);
      } catch (e) {
        // May fail if already a member or if we lack permissions
        console.warn('Invite during transfer:', e.message);
      }
      // Step 2: Update bridge meta — set new provider, update assigned_staff
      const updatedStaff = [...new Set([...(c.assigned_staff || []), transferTarget])];
      try {
        const currentMeta = await svc.getState(c.bridgeRoomId, EVT.BRIDGE_META);
        await svc.setState(c.bridgeRoomId, EVT.BRIDGE_META, {
          ...currentMeta,
          provider: transferTarget,
          assigned_staff: updatedStaff,
          transferred_from: c.meta.provider,
          transferred_at: Date.now(),
          transferred_by: svc.userId,
          last_modified_by: svc.userId,
          last_modified_at: Date.now(),
          origin_server: extractHomeserver(svc.userId)
        });
      } catch (e) {
        // Expected: provider may not have bridge state permission (client has PL 100).
        // Org-side ROSTER_ASSIGN is the authoritative record for case assignments.
        console.warn('Bridge meta update (expected if client controls bridge):', e.message);
      }
      // Step 3: Update ROSTER_ASSIGN in org room
      const updatedAssignments = {
        ...caseAssignments
      };
      updatedAssignments[c.bridgeRoomId] = {
        primary: transferTarget,
        staff: updatedStaff,
        client_name: c.sharedData?.full_name || c.clientUserId,
        transferable: c.transferable,
        transferred_from: c.meta.provider,
        transferred_at: Date.now(),
        transferred_by: svc.userId,
        added: caseAssignments[c.bridgeRoomId]?.added || Date.now()
      };
      await svc.setState(orgRoom, EVT.ROSTER_ASSIGN, {
        assignments: updatedAssignments
      });
      setCaseAssignments(updatedAssignments);
      // Step 4: Emit EO operation
      await emitOp(orgRoom, 'ALT', dot('org', 'case_assignment', 'provider'), {
        from: c.meta.provider,
        to: transferTarget,
        bridge_room: c.bridgeRoomId,
        client: c.clientUserId,
        reason: 'org_transfer',
        initiated_by: svc.userId
      }, orgFrame());
      // Step 5: Remove old provider from bridge room to revoke access
      if (c.meta.provider !== transferTarget) {
        try {
          await svc.kick(c.bridgeRoomId, c.meta.provider, 'Case transferred to new provider');
        } catch (e) {
          // May fail if we lack kick permission (client has PL 100) — log but don't block
          console.warn('Old provider kick during transfer:', e.message);
        }
      }
      setTransferModal(null);
      setTransferTarget('');
      showToast(`Case transferred to ${targetStaff.userId}`, 'success');
      // Refresh cases
      await loadCases();
    } catch (e) {
      showToast('Transfer failed: ' + e.message, 'error');
    }
  };

  // ─── Client record management ───
  const handleCreateClientRecord = async () => {
    if (!newClientName.trim()) return;
    try {
      const clientId = newClientMatrixId.trim() || null;
      const identityBase = {
        account_type: 'client_record',
        owner: svc.userId,
        created: Date.now(),
        client_name: newClientName,
        client_matrix_id: clientId,
        notes: newClientNotes || undefined,
        status: 'created',
        // Explicit team association — enables direct filtering without room-membership indirection
        team_id: activeTeamContext || null,
        team_name: activeTeamObj?.name || null
      };
      const roomId = await svc.createClientRoom(`[Client] ${newClientName}`, `${T.client_term} record for ${newClientName}`, [{
        type: EVT.IDENTITY,
        state_key: '',
        content: identityBase
      }], clientId);
      // If client Matrix ID provided, invite them and set them as admin
      if (clientId) {
        try {
          await svc.invite(roomId, clientId);
          await svc.setState(roomId, EVT.IDENTITY, {
            ...identityBase,
            status: 'invited'
          });
        } catch (e) {
          console.warn('Invite failed:', e.message);
        }
      }
      await emitOp(roomId, 'DES', dot('org', 'client_record', newClientName), {
        created_by: svc.userId,
        client_id: clientId || undefined,
        status: clientId ? 'invited' : 'created',
        team_id: activeTeamContext || undefined
      }, orgFrame());
      // Register this record in the team's record index so the team room has
      // a fast lookup without scanning every client_record room.
      // vault_access starts as 'none' until a bridge is established.
      if (activeTeamContext) {
        try {
          const currentIdx = await svc.getState(activeTeamContext, EVT.TEAM_RECORD_INDEX) || { records: [] };
          if (!currentIdx.records.some(r => r.room_id === roomId)) {
            await svc.setState(activeTeamContext, EVT.TEAM_RECORD_INDEX, {
              records: [...currentIdx.records, {
                room_id: roomId,
                bridge_room_id: null,
                created: Date.now(),
                vault_access: 'none'
              }]
            });
          }
        } catch (e) {
          console.warn('Team record index update failed:', e.message);
        }
      }
      const newRecord = {
        roomId,
        client_name: newClientName,
        client_matrix_id: clientId,
        notes: newClientNotes || undefined,
        owner: svc.userId,
        created: Date.now(),
        status: clientId ? 'invited' : 'created',
        team_id: activeTeamContext || null,
        team_name: activeTeamObj?.name || null
      };
      setClientRecords(prev => [...prev, newRecord]);
      setCreateClientModal(false);
      // Emit EO event to track individual creation
      try {
        await emitOp(roomId, 'INS', dot('org', 'individuals', newClientName), {
          designation: newClientName,
          client_name: newClientName,
          client_matrix_id: clientId || undefined,
          edit_source: 'client_creation'
        }, {
          type: 'org',
          epistemic: 'MEANT',
          role: orgRole || 'provider'
        });
      } catch (e) {
        console.warn('Creation event tracking failed:', e.message);
      }
      setNewClientName('');
      setNewClientMatrixId('');
      setNewClientNotes('');
      showToast(`${T.client_term} "${newClientName}" created${clientId ? ' — invite sent' : ''}`, 'success');
    } catch (e) {
      showToast('Failed: ' + e.message, 'error');
    }
  };
  // INS(claim.verification.code, {generated_by, expires}) — challenge_creation
  const handleGenerateClaimCode = async (record) => {
    try {
      const { challenge, plainCode } = await AccountVerification.createChallenge();
      await svc.setState(record.roomId, EVT.CLAIM_VERIFICATION, challenge);
      await emitOp(record.roomId, 'INS', dot('claim', 'verification', 'code'), {
        generated_by: svc.userId,
        expires: challenge.expires
      }, orgFrame());
      setVerifyCodeModal({ record, code: plainCode, expires: challenge.expires });
    } catch (e) {
      showToast('Failed to generate verification code: ' + e.message, 'error');
    }
  };
  const handleClientInvite = async () => {
    if (!clientInviteModal || !clientInviteMatrixId.trim()) return;
    if (!isValidMatrixId(clientInviteMatrixId)) {
      showToast('Invalid Matrix ID — use format @user:server', 'error');
      return;
    }
    try {
      const clientId = clientInviteMatrixId.trim();
      // Set client PL 100, invite, THEN demote self to PL 50.
      // Order matters: if invite fails after self-demotion, no one has admin.
      await svc.setPowerLevel(clientInviteModal.roomId, clientId, 100);
      await svc.invite(clientInviteModal.roomId, clientId);
      await svc.setPowerLevel(clientInviteModal.roomId, svc.userId, 50);
      // Update identity state with the client's Matrix ID
      await svc.setState(clientInviteModal.roomId, EVT.IDENTITY, {
        ...clientInviteModal,
        client_matrix_id: clientId,
        status: 'invited'
      });
      await emitOp(clientInviteModal.roomId, 'CON', dot('org', 'client_record', clientId), {
        invited_by: svc.userId,
        status: 'invited'
      }, orgFrame());
      setClientRecords(prev => prev.map(r => r.roomId === clientInviteModal.roomId ? {
        ...r,
        client_matrix_id: clientId,
        status: 'invited'
      } : r));
      showToast(`Invite sent to ${clientId} — they will have full room control`, 'success');
    } catch (e) {
      showToast('Invite failed: ' + e.message, 'error');
    }
  };

  // ─── Team CRUD ───
  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) return;
    try {
      const teamHue = distinctTeamHue(teams.length);
      const govMode = newTeamGovernance || 'lead_decides';
      const parentTeam = newTeamParentId ? teams.find(t => t.roomId === newTeamParentId) : null;
      // Default team schema: identity + contact fields from vault
      const defaultSchemaFields = DOMAIN_CONFIG.vaultFields.filter(f => f.category === 'identity' || f.category === 'contact').map(f => ({
        uri: f.uri,
        required: f.category === 'identity',
        added_version: 1
      }));
      const roomId = await svc.createRoom(`[Khora Team] ${newTeamName}`, newTeamDesc || `Team: ${newTeamName}`, [{
        type: EVT.IDENTITY,
        state_key: '',
        content: {
          account_type: 'team',
          owner: svc.userId,
          created: Date.now()
        }
      }, {
        type: EVT.TEAM_META,
        state_key: '',
        content: {
          name: newTeamName,
          description: newTeamDesc || '',
          color_hue: teamHue,
          created: Date.now(),
          created_by: svc.userId,
          org_id: orgRoom || null,
          org_name: orgMeta.name || null,
          parent_team_id: parentTeam?.roomId || null,
          parent_team_name: parentTeam?.name || null
        }
      }, {
        type: EVT.TEAM_MEMBERS,
        state_key: '',
        content: {
          members: [{
            userId: svc.userId,
            role: 'lead',
            joined: Date.now(),
            display_name: providerProfile.display_name || '',
            sharing_consent: 'shared'
          }]
        }
      }, {
        type: EVT.TEAM_SCHEMA,
        state_key: '',
        content: {
          version: 1,
          fields: defaultSchemaFields,
          pending_changes: [],
          change_log: [{
            version: 1,
            summary: 'Initial schema',
            by: svc.userId,
            ts: Date.now()
          }],
          last_modified: Date.now(),
          modified_by: svc.userId
        }
      }, {
        type: EVT.TEAM_SCHEMA_RULE,
        state_key: '',
        content: {
          mode: govMode,
          modified_by: svc.userId,
          modified_at: Date.now()
        }
      }, {
        type: EVT.TEAM_HIERARCHY,
        state_key: '',
        content: {
          parent_team_id: parentTeam?.roomId || null,
          parent_team_name: parentTeam?.name || null,
          child_teams: [],
          rollup_policy: parentTeam ? 'explicit' : 'none',
          created_by: svc.userId,
          created_at: Date.now()
        }
      }]);
      // If nested under a parent team, register this child on the parent's hierarchy
      if (parentTeam) {
        try {
          const parentHierarchy = await svc.getState(parentTeam.roomId, EVT.TEAM_HIERARCHY) || {};
          const updatedChildren = [...(parentHierarchy.child_teams || []), { roomId, name: newTeamName }];
          await svc.setState(parentTeam.roomId, EVT.TEAM_HIERARCHY, {
            ...parentHierarchy,
            child_teams: updatedChildren,
            modified_at: Date.now()
          });
          // Update local state for parent
          setTeams(prev => prev.map(t => t.roomId === parentTeam.roomId ? {
            ...t,
            hierarchy: { ...(t.hierarchy || {}), child_teams: updatedChildren }
          } : t));
        } catch (e) {
          console.warn('[Team] Failed to register child on parent hierarchy:', e.message);
        }
      }
      await emitOp(roomId, 'DES', dot('org', 'teams', newTeamName), {
        created_by: svc.userId,
        org: orgMeta.name || null,
        parent_team: parentTeam?.name || null,
        governance_mode: govMode
      }, orgFrame());
      const newTeam = {
        roomId,
        name: newTeamName,
        description: newTeamDesc || '',
        color_hue: teamHue,
        created: Date.now(),
        created_by: svc.userId,
        org_id: orgRoom || null,
        org_name: orgMeta.name || null,
        parent_team_id: parentTeam?.roomId || null,
        parent_team_name: parentTeam?.name || null,
        members: [{
          userId: svc.userId,
          role: 'lead',
          joined: Date.now(),
          display_name: providerProfile.display_name || '',
          sharing_consent: 'shared'
        }],
        owner: svc.userId,
        schema: {
          version: 1,
          fields: defaultSchemaFields,
          pending_changes: [],
          change_log: []
        },
        schemaRule: { mode: govMode },
        hierarchy: {
          parent_team_id: parentTeam?.roomId || null,
          parent_team_name: parentTeam?.name || null,
          child_teams: [],
          rollup_policy: parentTeam ? 'explicit' : 'none'
        },
        customTables: []
      };
      // Seed the default Individuals CRM table into every new team.
      // This gives teams a ready-to-use profile schema covering intake, demographics,
      // housing status, case tracking, and exit outcomes — all team-sovereign fields.
      try {
        const defaultTable = {
          ...DEFAULT_INDIVIDUAL_TABLE_SCHEMA,
          id: 'tbl_individuals_' + Date.now().toString(36),
          team_id: roomId,
          created_by: svc.userId,
          created_at: Date.now()
        };
        await svc.setState(roomId, EVT.TEAM_TABLE_DEF, defaultTable, defaultTable.id);
        newTeam.customTables = [defaultTable];
      } catch (e) {
        console.warn('[Team] Failed to seed default Individuals table:', e.message);
      }
      setLocalTeamColor(svc.userId, roomId, teamHue);
      setTeams(prev => [...prev, newTeam]);
      setCreateTeamModal(false);
      setNewTeamName('');
      setNewTeamDesc('');
      setNewTeamParentId('');
      setNewTeamGovernance('lead_decides');
      showToast(`Team "${newTeamName}" created${parentTeam ? ` under ${parentTeam.name}` : ''}`, 'success');
    } catch (e) {
      showToast('Failed to create team: ' + e.message, 'error');
    }
  };
  const handleTeamInvite = async () => {
    if (!teamInviteModal || !teamInviteUserId.trim()) return;
    if (!isValidMatrixId(teamInviteUserId)) {
      showToast('Invalid Matrix ID — use format @user:server', 'error');
      return;
    }
    try {
      const uid = teamInviteUserId.trim();
      // Warn if invitee is not an org member (cross-org teams are allowed but noteworthy)
      if (orgRoom && staff.length > 0 && !staff.find(s => s.userId === uid)) {
        showToast(`Note: ${uid} is not a member of your organization`, 'info');
      }
      // Invite user to the team room
      if (svc.client) await svc.client.invite(teamInviteModal.roomId, uid);else await svc._api('POST', `/rooms/${encodeURIComponent(teamInviteModal.roomId)}/invite`, {
        user_id: uid
      });
      // Update the members list — new members start with sharing_consent:'pending' so they must proactively choose
      const updatedMembers = [...(teamInviteModal.members || []), {
        userId: uid,
        role: 'member',
        joined: Date.now(),
        sharing_consent: 'pending'
      }];
      await svc.setState(teamInviteModal.roomId, EVT.TEAM_MEMBERS, {
        members: updatedMembers
      });
      await emitOp(teamInviteModal.roomId, 'CON', dot('org', 'teams', 'members', uid), {
        invited_by: svc.userId,
        role: 'member'
      }, orgFrame());
      setTeams(prev => prev.map(t => t.roomId === teamInviteModal.roomId ? {
        ...t,
        members: updatedMembers
      } : t));
      showToast(`Invited ${uid} to team`, 'success');
      setTeamInviteUserId('');
    } catch (e) {
      showToast('Team invite failed: ' + e.message, 'error');
    }
  };

  // Handle sharing consent response — team member proactively chooses whether to withhold content
  const handleSharingConsent = async (team, memberId, withhold) => {
    try {
      const consentValue = withhold ? 'withheld' : 'shared';
      const updatedMembers = (team.members || []).map(m => m.userId === memberId ? {
        ...m,
        sharing_consent: consentValue
      } : m);
      await svc.setState(team.roomId, EVT.TEAM_MEMBERS, {
        members: updatedMembers
      });
      await emitOp(team.roomId, 'REC', dot('org', 'consent', 'sharing', memberId), {
        consent: consentValue,
        decided_by: memberId
      }, orgFrame());
      setTeams(prev => prev.map(t => t.roomId === team.roomId ? {
        ...t,
        members: updatedMembers
      } : t));
      setSharingConsentModal(null);
      if (withhold) {
        showToast('Content about individuals will not be shared with you in this team', 'warn');
      } else {
        showToast('Content about individuals may be shared with you in this team', 'success');
      }
    } catch (e) {
      showToast('Failed to save sharing preference: ' + e.message, 'error');
    }
  };
  const copyToClipboard = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(label);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      showToast('Copy failed — please select and copy manually', 'warn');
    }
  };

  // ─── Share invite via email, SMS, or native share ───
  const getInviteShareText = roomId => {
    const link = getInviteUrl(roomId);
    return `You've been invited to securely manage your information on Khora.\n\nJoin here: ${link}\n\n${getSetupInstructions(roomId)}`;
  };

  const shareInviteViaEmail = roomId => {
    const subject = encodeURIComponent('You\'re invited to Khora');
    const body = encodeURIComponent(getInviteShareText(roomId));
    window.open(`mailto:?subject=${subject}&body=${body}`, '_self');
  };

  const shareInviteViaSMS = roomId => {
    const body = encodeURIComponent(getInviteShareText(roomId));
    // Use sms: URI — &body= works on most platforms, ;body= on some iOS versions
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    window.open(`sms:${isIOS ? '&' : '?'}body=${body}`, '_self');
  };

  const shareInviteNative = async roomId => {
    const text = getInviteShareText(roomId);
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Khora Invite',
          text,
          url: getInviteUrl(roomId)
        });
      } catch (e) {
        if (e.name !== 'AbortError') {
          showToast('Share failed: ' + e.message, 'warn');
        }
      }
    } else {
      // Fallback: copy to clipboard
      await copyToClipboard(text, 'share');
      showToast('Invite copied to clipboard (share not supported in this browser)', 'info');
    }
  };

  // ─── Contact sharing helpers ───
  const getContactText = (asOrg) => {
    const lines = [];
    const name = providerProfile.display_name || svc.userId?.split(':')[0]?.replace('@', '');
    if (name) lines.push(name);
    if (asOrg && providerProfile.title) lines.push(providerProfile.title);
    if (asOrg && orgMeta?.name) lines.push(orgMeta.name);
    if (asOrg && providerProfile.credentials) lines.push(providerProfile.credentials);
    if (asOrg && myVerification?.status === 'verified' && myVerification.email) {
      lines.push(myVerification.email);
    }
    lines.push('');
    lines.push('Khora ID: ' + svc.userId);
    return lines.join('\n');
  };
  const copyContact = async () => {
    try {
      await navigator.clipboard.writeText(getContactText(shareAsOrg));
      setCopiedField('contact');
      setTimeout(() => setCopiedField(null), 2000);
    } catch { showToast('Copy failed — please select and copy manually', 'warn'); }
  };
  const shareContactViaEmail = () => {
    const subject = encodeURIComponent('My contact details');
    const body = encodeURIComponent(getContactText(shareAsOrg));
    window.open('mailto:?subject=' + subject + '&body=' + body, '_self');
  };
  const shareContactViaSMS = () => {
    const body = encodeURIComponent(getContactText(shareAsOrg));
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    window.open('sms:' + (isIOS ? '&' : '?') + 'body=' + body, '_self');
  };

  // ─── Import completion handler ───
  const handleImportComplete = importResults => {
    const newRecords = importResults.created.map(r => ({
      roomId: r.roomId,
      client_name: r.displayName,
      client_matrix_id: null,
      notes: `Imported (${r.fieldCount} encrypted fields)`,
      owner: svc.userId,
      created: Date.now(),
      status: 'created',
      imported: true
    }));
    setClientRecords(prev => [...prev, ...newRecords]);
  };
  const getInviteUrl = roomId => `https://matrix.to/#/${roomId}`;
  const getSetupInstructions = roomId => {
    const hs = svc._baseUrl ? svc._baseUrl.replace(/^https?:\/\//, '') : 'hyphae.social';
    const link = getInviteUrl(roomId);
    return `You've been invited to securely manage your information on Khora.\n\nTo get started:\n\n1. Create a free Matrix account:\n   Go to https://${hs} and click "Create Account"\n   (Matrix is a secure, decentralized messaging protocol — your data stays on the server you choose)\n\n2. Download a Matrix client (optional):\n   Web: https://app.element.io\n   Mobile: Search "Element" in your app store\n   Or use any Matrix-compatible app\n\n3. Sign in with your new account\n\n4. Accept the room invitation:\n   The invite should appear automatically in your Matrix client.\n   You can also open this link: ${link}\n   (Note: this is a private room — the invite must be accepted from the account specified above)\n\n5. You will have full control of this room — you can remove anyone from it at any time.\n\nQuestions? Contact your provider for help getting set up.`;
  };

  // Discover client by Matrix ID
  const handleDiscoverClient = async () => {
    if (!discoverUserId.trim()) return;
    try {
      // Check if we already have a bridge with this client
      const existing = cases.find(c => c.clientUserId === discoverUserId);
      if (existing) {
        showToast('Already connected with this client', 'info');
        setDiscoverModal(false);
        return;
      }
      // We can't create the bridge — the client must initiate. But we can check if one exists.
      const scanned = await svc.scanRooms();
      let found = false;
      for (const [rid, state] of Object.entries(scanned)) {
        const meta = state[EVT.BRIDGE_META];
        if (meta && meta.client === discoverUserId && meta.provider === svc.userId) {
          found = true;
          break;
        }
      }
      if (found) {
        await loadCases();
        showToast('Bridge found — refreshing cases', 'success');
      } else {
        showToast(`No bridge found for ${discoverUserId}. The client must create a bridge and invite you.`, 'warn');
      }
      setDiscoverModal(false);
    } catch (e) {
      showToast('Error: ' + e.message, 'error');
    }
  };

  // INS(network.room, {identity, members}) — federation_creation + DES(network.schema_catalog, {forms, definitions}) — canonical_vocabulary + INS(network.seed_resources, {defaults}) — initial_catalog
  // Create a network — requires an org
  const handleCreateNetwork = async () => {
    if (!networkName.trim()) return;
    if (!orgRoom) {
      showToast('Create or join an organization before creating a network', 'warn');
      return;
    }
    try {
      const nRoom = await svc.createRoom(`[Khora Network] ${networkName}`, 'Network governance room', [{
        type: EVT.IDENTITY,
        state_key: '',
        content: {
          account_type: 'network',
          name: networkName,
          owner: svc.userId,
          created: Date.now()
        }
      }, {
        type: EVT.NET_MEMBERS,
        state_key: '',
        content: {
          organizations: [{
            id: orgRoom,
            name: orgMeta.name || '',
            joined: Date.now(),
            role: 'admin'
          }],
          governance: {
            schema_changes_require: 'admin_approval',
            admins: [orgRoom]
          }
        }
      }]);
      // Seed network schema — forms propagate to member orgs, then to clients through providers
      // Forms (GIVEN data collection) — propagate as standard (orgs can extend)
      for (const f of DEFAULT_FORMS) await svc.setState(nRoom, EVT.SCHEMA_FORM, {
        ...f,
        propagation: f.source?.propagation || 'standard',
        network: networkName
      }, `net:${f.id}`);
      for (const p of DEFAULT_PROMPTS) await svc.setState(nRoom, EVT.SCHEMA_PROMPT, {
        ...p,
        propagation: p.source?.propagation || 'standard',
        network: networkName
      }, `net:${p.key}`);
      // Interpretations — assessments propagate alongside forms
      for (const pp of DEFAULT_PROVIDER_PROMPTS) await svc.setState(nRoom, EVT.SCHEMA_ASSESSMENT, {
        ...pp,
        propagation: pp.source?.propagation || 'standard',
        network: networkName
      }, `net:${pp.key}`);
      // Definitions propagate as required (immutable at org level)
      for (const d of DEFAULT_DEFINITIONS) await svc.setState(nRoom, EVT.SCHEMA_DEF, {
        ...d,
        propagation: 'required',
        network: networkName
      }, `net:${d.key}`);
      // Seed default resource types into network catalog (draft maturity, optional propagation)
      try {
        await ResourceService.loadSeedResourceTypes(nRoom);
      } catch (e) {
        console.warn('Resource seed loading failed:', e.message);
      }
      await emitOp(nRoom, 'INS', dot('network', networkName), {
        created_by: svc.userId,
        org: orgMeta.name
      }, networkFrame(nRoom));
      setNetworkRoom(nRoom);
      await loadNetworkMembers(nRoom);
      setNetworkModal(false);
      setNetworkName('');
      showToast(`Network "${networkName}" created`, 'success');
    } catch (e) {
      showToast('Error: ' + e.message, 'error');
    }
  };

  // CON(network.org, {action: join}) — membership_link
  // Join existing network by room ID — requires an org
  const handleJoinNetwork = async () => {
    if (!joinNetworkId.trim()) return;
    if (!orgRoom) {
      showToast('Create or join an organization before joining a network', 'warn');
      return;
    }
    try {
      if (svc.client) {
        await svc.client.joinRoom(joinNetworkId);
      } else {
        await svc._api('POST', `/join/${encodeURIComponent(joinNetworkId)}`, {});
      }
      // Add this org to the network members list
      try {
        const currentMembers = await svc.getState(joinNetworkId, EVT.NET_MEMBERS);
        const orgs = currentMembers?.organizations || [];
        if (!orgs.find(o => o.id === orgRoom)) {
          orgs.push({ id: orgRoom, name: orgMeta.name || '', joined: Date.now(), role: 'member' });
          await svc.setState(joinNetworkId, EVT.NET_MEMBERS, { ...currentMembers, organizations: orgs });
        }
        await emitOp(joinNetworkId, 'CON', dot('network', 'org', orgRoom), {
          action: 'join',
          org_name: orgMeta.name || '',
          joined_by: svc.userId
        }, networkFrame(joinNetworkId));
      } catch (e) {
        console.warn('Network members update:', e.message);
      }
      setNetworkRoom(joinNetworkId);
      await loadNetworkMembers(joinNetworkId);
      setJoinNetworkModal(false);
      setJoinNetworkId('');
      showToast('Joined network', 'success');
    } catch (e) {
      if (e.message?.includes('forbidden') || e.message?.includes('not invited')) {
        showToast('Cannot join — you must be invited by a network admin first', 'error');
      } else {
        showToast('Failed to join: ' + e.message, 'error');
      }
    }
  };

  // ─── Organization management ───
  const handleCreateResourceType = async () => {
    if (!resourceDraft.name.trim()) return;
    const targetRoom = orgRoom || networkRoom || rosterRoom;
    if (!targetRoom) {
      showToast('No room available for resource creation', 'error');
      return;
    }
    try {
      const level = orgRoom ? 'org' : networkRoom ? 'network' : 'individual';
      const typeData = {
        name: resourceDraft.name.trim(),
        category: resourceDraft.category,
        unit: resourceDraft.unit.trim() || 'unit',
        fungible: resourceDraft.fungible,
        perishable: resourceDraft.perishable,
        ttl_days: resourceDraft.perishable && resourceDraft.ttl_days ? parseInt(resourceDraft.ttl_days) : null,
        infinite: resourceDraft.infinite,
        replenishes: resourceDraft.replenishes,
        replenish_cycle: resourceDraft.replenishes ? resourceDraft.replenish_cycle : null,
        tags: resourceDraft.tags ? resourceDraft.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        permissions: resourceDraft.permissions || buildDefaultResourcePermissions()
      };
      const created = await ResourceService.createResourceType(targetRoom, typeData, level);
      // Auto-establish relation + inventory if initial quantity or infinite
      const initQty = parseInt(resourceDraft.initial_quantity) || 0;
      if (created && created.id && (initQty > 0 || resourceDraft.infinite)) {
        const relationRoom = orgRoom || rosterRoom;
        if (relationRoom) {
          const cap = resourceDraft.infinite ? 999999 : initQty;
          await ResourceService.establishRelation(relationRoom, {
            resource_type_id: created.id,
            relation_type: 'operates',
            capacity: cap,
            available: cap
          });
        }
      }
      setCreateResourceModal(false);
      setResourceDraft({
        name: '',
        category: 'general',
        unit: 'unit',
        fungible: true,
        perishable: false,
        ttl_days: '',
        tags: '',
        infinite: false,
        initial_quantity: '',
        replenishes: false,
        replenish_cycle: '',
        permissions: buildDefaultResourcePermissions()
      });
      showToast(`Resource type "${typeData.name}" created`, 'success');
      // Optimistically add the new resource type to local state immediately,
      // since room.currentState won't reflect the new state event until the
      // next /sync response from the server.
      const optimisticType = created && created.id ? {
        ...created,
        _source: level === 'individual' ? 'personal' : level === 'network' ? 'network' : 'org'
      } : null;
      if (optimisticType) {
        setResourceTypes(prev => {
          if (prev.some(t => t.id === optimisticType.id)) return prev;
          return [...prev, optimisticType];
        });
      }
      // Delayed reload to reconcile with server state after sync.
      // Use longer delay + preserve optimistic type if sync hasn't delivered it yet.
      setTimeout(() => {
        loadResources(orgRoom, networkRoom, rosterRoom);
        // Re-add optimistic type if sync hasn't delivered it yet
        if (optimisticType) {
          setTimeout(() => {
            setResourceTypes(prev => {
              if (prev.some(t => t.id === optimisticType.id)) return prev;
              return [...prev, optimisticType];
            });
          }, 100);
        }
      }, 2500);
    } catch (e) {
      showToast('Error creating resource: ' + e.message, 'error');
    }
  };

  // ─── Promote personal resource to organization (move semantics) ───
  const handlePromoteResource = async rt => {
    if (!orgRoom || !rosterRoom) return;
    try {
      const {
        _source,
        ...typeData
      } = rt;
      await ResourceService.createResourceType(orgRoom, typeData, 'org');
      // Remove from roster room by writing empty content (Matrix tombstone pattern)
      await svc.setState(rosterRoom, EVT.RESOURCE_TYPE, {}, rt.id);
      await svc.setState(rosterRoom, EVT.RESOURCE_PERM, {}, rt.id);
      // If there was a personal relation, remove it too
      const personalRelation = resourceRelations.find(r => r.resource_type_id === rt.id && r.holder === rosterRoom);
      if (personalRelation) {
        await svc.setState(rosterRoom, EVT.RESOURCE_RELATION, {}, personalRelation.id);
      }
      showToast(`"${rt.name}" promoted to organization`, 'success');
      setTimeout(() => loadResources(orgRoom, networkRoom, rosterRoom), 800);
    } catch (e) {
      showToast('Error promoting resource: ' + e.message, 'error');
    }
  };

  // ─── Update resource permissions ───
  const handleSavePermissions = async () => {
    const targetRoom = orgRoom || rosterRoom;
    if (!permModal || !targetRoom) return;
    try {
      await ResourceService.updateResourcePermissions(targetRoom, permModal.id, permDraft, orgRole);
      setPermModal(null);
      showToast(`Permissions updated for "${permModal.name}"`, 'success');
      setTimeout(() => loadResources(orgRoom, networkRoom, rosterRoom), 800);
    } catch (e) {
      showToast('Error updating permissions: ' + e.message, 'error');
    }
  };
  const handleAddPermGrant = () => {
    if (!permGrantId) return;
    const grant = {
      type: permGrantType,
      id: permGrantId
    };
    // Avoid duplicates
    if (permDraft[permGrantAbility].some(g => g.type === grant.type && g.id === grant.id)) {
      showToast('This grant already exists', 'warn');
      return;
    }
    setPermDraft({
      ...permDraft,
      [permGrantAbility]: [...permDraft[permGrantAbility], grant]
    });
    setPermGrantId('');
  };
  const handleRemovePermGrant = (ability, index) => {
    setPermDraft({
      ...permDraft,
      [ability]: permDraft[ability].filter((_, i) => i !== index)
    });
  };
  const openPermModal = rt => {
    setPermDraft({
      controllers: rt.permissions?.controllers || [],
      allocators: rt.permissions?.allocators || [],
      viewers: rt.permissions?.viewers || []
    });
    setPermGrantAbility('controllers');
    setPermGrantType('role');
    setPermGrantId('');
    setPermModal(rt);
  };
  const handleEstablishRelation = async resourceTypeId => {
    const targetRoom = orgRoom || rosterRoom;
    if (!targetRoom) {
      showToast('No room available to establish resource relations', 'error');
      return;
    }
    try {
      await ResourceService.establishRelation(targetRoom, {
        resource_type_id: resourceTypeId,
        relation_type: 'operates',
        capacity: 0,
        available: 0
      });
      showToast('Resource relation established', 'success');
      setTimeout(() => loadResources(orgRoom, networkRoom, rosterRoom), 800);
    } catch (e) {
      showToast('Error: ' + e.message, 'error');
    }
  };

  // ─── Load allocations for active case (bridge room) ───
  const loadCaseAllocations = async bridgeRoomId => {
    if (!svc.client) return;
    const room = svc.client.getRoom(bridgeRoomId);
    if (!room) {
      setCaseAllocations([]);
      return;
    }
    const allocEvents = room.currentState.getStateEvents(EVT.RESOURCE_ALLOC);
    const allocs = [];
    if (allocEvents) {
      const evArr = Array.isArray(allocEvents) ? allocEvents : [allocEvents];
      for (const ev of evArr) {
        const c = ev.getContent ? ev.getContent() : ev;
        if (c && c.id) allocs.push(c);
      }
    }
    setCaseAllocations(allocs);
  };

  // ─── Allocate resource to client in active case ───
  const handleAllocateResource = async () => {
    if (!allocDraft.resource_type_id || !activeCase || !(orgRoom || rosterRoom)) return;
    const caseData = cases.find(c => c.bridgeRoomId === activeCase);
    if (!caseData) return;
    // Find vault room for client (from bridge meta)
    const bridgeMeta = caseData.meta;
    const clientId = bridgeMeta?.client;
    // Find client vault room from scanned state
    let vaultRoomId = null;
    if (svc.client) {
      for (const room of svc.client.getRooms()) {
        const idEv = room.currentState.getStateEvents(EVT.IDENTITY, '');
        if (idEv) {
          const content = idEv.getContent();
          if (content.account_type === 'client' && content.owner === clientId) {
            vaultRoomId = room.roomId;
            break;
          }
        }
      }
    }
    // Find the relation for this resource type
    const relation = resourceRelations.find(r => r.resource_type_id === allocDraft.resource_type_id);
    const holderRoom = orgRoom || rosterRoom;
    try {
      const result = await ResourceService.allocateResource(activeCase, {
        resource_type_id: allocDraft.resource_type_id,
        relation_id: relation?.id || null,
        quantity: parseInt(allocDraft.quantity) || 1,
        allocated_to: clientId,
        notes: allocDraft.notes || null
      }, holderRoom, vaultRoomId);
      if (!result.valid) {
        const msgs = result.violations.map(v => v.message).join('; ');
        showToast(`Allocation blocked: ${msgs}`, 'error');
        return;
      }
      setAllocModal(false);
      setAllocDraft({
        resource_type_id: '',
        quantity: 1,
        notes: ''
      });
      showToast('Resource allocated successfully', 'success');
      setTimeout(() => {
        loadCaseAllocations(activeCase);
        loadResources(orgRoom, networkRoom, rosterRoom);
      }, 800);
    } catch (e) {
      showToast('Error allocating resource: ' + e.message, 'error');
    }
  };

  // ─── Allocate resource from individual profile page ───
  const handleProfileAllocate = async (bridgeRoomId, allocData) => {
    if (!allocData.resource_type_id || !bridgeRoomId || !(orgRoom || rosterRoom)) return false;
    const caseData = cases.find(c => c.bridgeRoomId === bridgeRoomId);
    if (!caseData) {
      showToast('No case found for this individual', 'error');
      return false;
    }
    const bridgeMeta = caseData.meta;
    const clientId = bridgeMeta?.client;
    let vaultRoomId = null;
    if (svc.client) {
      for (const room of svc.client.getRooms()) {
        const idEv = room.currentState.getStateEvents(EVT.IDENTITY, '');
        if (idEv) {
          const content = idEv.getContent();
          if (content.account_type === 'client' && content.owner === clientId) {
            vaultRoomId = room.roomId;
            break;
          }
        }
      }
    }
    const relation = resourceRelations.find(r => r.resource_type_id === allocData.resource_type_id);
    const holderRoom = orgRoom || rosterRoom;
    try {
      const result = await ResourceService.allocateResource(bridgeRoomId, {
        resource_type_id: allocData.resource_type_id,
        relation_id: relation?.id || null,
        quantity: parseInt(allocData.quantity) || 1,
        allocated_to: clientId,
        notes: allocData.notes || null
      }, holderRoom, vaultRoomId);
      if (!result.valid) {
        const msgs = result.violations.map(v => v.message).join('; ');
        showToast(`Allocation blocked: ${msgs}`, 'error');
        return false;
      }
      showToast('Resource allocated successfully', 'success');
      setTimeout(() => {
        loadDataTableExtras(cases);
        loadResources(orgRoom, networkRoom, rosterRoom);
      }, 800);
      return true;
    } catch (e) {
      showToast('Error allocating resource: ' + e.message, 'error');
      return false;
    }
  };

  // ─── Record lifecycle event (consumed, revoked, returned) ───
  const handleResourceLifecycle = async (allocationId, eventType) => {
    if (!activeCase || !(orgRoom || rosterRoom)) return;
    const alloc = caseAllocations.find(a => a.id === allocationId);
    if (!alloc) return;
    const caseData = cases.find(c => c.bridgeRoomId === activeCase);
    const clientId = caseData?.meta?.client;
    let vaultRoomId = null;
    if (clientId && svc.client) {
      for (const room of svc.client.getRooms()) {
        const idEv = room.currentState.getStateEvents(EVT.IDENTITY, '');
        if (idEv) {
          const content = idEv.getContent();
          if (content.account_type === 'client' && content.owner === clientId) {
            vaultRoomId = room.roomId;
            break;
          }
        }
      }
    }
    const holderRoom = orgRoom || rosterRoom;
    try {
      await ResourceService.recordResourceEvent(activeCase, {
        allocation_id: allocationId,
        event: eventType,
        quantity: alloc.quantity
      }, holderRoom, vaultRoomId);
      showToast(`Resource marked as ${eventType}`, 'success');
      setTimeout(() => {
        loadCaseAllocations(activeCase);
        loadResources(orgRoom, networkRoom, rosterRoom);
      }, 800);
    } catch (e) {
      showToast('Error: ' + e.message, 'error');
    }
  };

  // ─── Restock inventory ───
  const handleRestock = async () => {
    const holderRoom = orgRoom || rosterRoom;
    if (!restockModal || !restockQty || !holderRoom) return;
    try {
      await ResourceService.restockInventory(holderRoom, restockModal.id, parseInt(restockQty), {
        note: restockNote || undefined,
        restocked_by: svc.userId
      });
      setRestockModal(null);
      setRestockQty('');
      setRestockNote('');
      showToast('Inventory restocked', 'success');
      setTimeout(() => loadResources(orgRoom, networkRoom, rosterRoom), 800);
    } catch (e) {
      showToast('Error restocking: ' + e.message, 'error');
    }
  };

  // INS(org.room, {identity, metadata, roster}) — organization_creation + DES(org.schema, {seeded_forms, definitions}) — local_vocabulary + INS(org.staff_roster, {creator_as_admin}) — initial_membership
  const handleCreateOrg = async () => {
    if (!setupData.name.trim()) return;
    try {
      const org = await svc.createRoom(`[Khora Org] ${setupData.name}`, `Organization: ${setupData.name}`, [{
        type: EVT.IDENTITY,
        state_key: '',
        content: {
          account_type: 'organization',
          owner: svc.userId,
          created: Date.now()
        }
      }, {
        type: EVT.ORG_METADATA,
        state_key: '',
        content: {
          name: setupData.name,
          type: setupData.type,
          service_area: setupData.service_area,
          languages: setupData.languages.split(',').map(s => s.trim()),
          created: Date.now()
        }
      }, {
        type: EVT.ORG_ROSTER,
        state_key: '',
        content: {
          staff: [{
            userId: svc.userId,
            role: 'admin',
            joined: Date.now()
          }]
        }
      }, {
        type: EVT.ORG_ROLES,
        state_key: '',
        content: {
          roles: DOMAIN_CONFIG.defaultOrgRoles
        }
      }, {
        type: EVT.ROSTER_ASSIGN,
        state_key: '',
        content: {}
      }, {
        type: EVT.ORG_OPACITY,
        state_key: '',
        content: {
          level: 'translucent',
          updated: Date.now(),
          updated_by: svc.userId
        }
      }, {
        type: EVT.ORG_MSG_ACCESS,
        state_key: '',
        content: {
          read: ['admin', 'case_manager'],
          respond: ['admin'],
          updated: Date.now()
        }
      }]);
      await emitOp(org, 'DES', dot('org', 'organization'), {
        designation: setupData.name,
        type: setupData.type,
        service_area: setupData.service_area
      }, orgFrame(org));
      await emitOp(org, 'INS', dot('org', 'staff', svc.userId), {
        role: 'admin',
        initiated_by: 'org_creation'
      }, orgFrame(org));
      setOrgRoom(org);
      setOrgRole('admin');
      setOrgMeta({
        name: setupData.name,
        type: setupData.type,
        service_area: setupData.service_area
      });
      setStaff([{
        userId: svc.userId,
        role: 'admin',
        joined: Date.now()
      }]);
      setCreateOrgModal(false);
      setSetupData({
        name: '',
        type: 'direct_service',
        service_area: '',
        languages: 'en'
      });
      showToast(`Organization "${setupData.name}" created`, 'success');
      // Create supporting rooms for org
      const orgMetricsR = await svc.createRoom('[Khora Metrics]', 'Org anonymized metrics', [{
        type: EVT.IDENTITY,
        state_key: '',
        content: {
          account_type: 'metrics',
          owner: svc.userId,
          created: Date.now()
        }
      }]);
      const orgSchema = await svc.createRoom('[Khora Schema]', 'Org schema definitions', [{
        type: EVT.IDENTITY,
        state_key: '',
        content: {
          account_type: 'schema',
          owner: svc.userId,
          created: Date.now()
        }
      }]);
      // Forms — GIVEN data collection (propagated to clients through providers)
      for (const f of DEFAULT_FORMS) await svc.setState(orgSchema, EVT.SCHEMA_FORM, f, f.id);
      for (const p of DEFAULT_PROMPTS) await svc.setState(orgSchema, EVT.SCHEMA_PROMPT, p, p.key);
      // Interpretations — MEANT assessments, definitions, authorities
      for (const pp of DEFAULT_PROVIDER_PROMPTS) await svc.setState(orgSchema, EVT.SCHEMA_ASSESSMENT, pp, pp.key);
      for (const d of DEFAULT_DEFINITIONS) await svc.setState(orgSchema, EVT.SCHEMA_DEF, d, d.key);
      for (const a of DEFAULT_AUTHORITIES) await svc.setState(orgSchema, EVT.SCHEMA_AUTHORITY, a, a.id);
      await svc.setState(orgSchema, EVT.SCHEMA_TRANSFORM, {
        id: 'transform_default',
        transforms: DEFAULT_TRANSFORMS
      }, 'default');
      // Link supporting room IDs back to the org so other members can discover them
      try {
        await svc.setState(org, EVT.ORG_METADATA, {
          name: setupData.name,
          type: setupData.type,
          service_area: setupData.service_area,
          languages: setupData.languages.split(',').map(s => s.trim()),
          created: Date.now(),
          metrics_room: orgMetricsR,
          schema_room: orgSchema
        });
      } catch (e) {
        console.warn('Org metadata linkage:', e.message);
      }
    } catch (e) {
      showToast('Error creating org: ' + e.message, 'error');
    }
  };
  const handleJoinOrg = async () => {
    if (!joinOrgId.trim()) return;
    try {
      if (svc.client) {
        await svc.client.joinRoom(joinOrgId);
      } else {
        await svc._api('POST', `/join/${encodeURIComponent(joinOrgId)}`, {});
      }
      // Load the org metadata
      const meta = await svc.getState(joinOrgId, EVT.ORG_METADATA);
      const roster = await svc.getState(joinOrgId, EVT.ORG_ROSTER);
      let entry = roster?.staff?.find(s => s.userId === svc.userId);
      // Add user to roster if not already present (pending admin role assignment)
      if (!entry) {
        const staffList = roster?.staff || [];
        entry = { userId: svc.userId, role: 'pending', joined: Date.now() };
        staffList.push(entry);
        try {
          await svc.setState(joinOrgId, EVT.ORG_ROSTER, { staff: staffList });
          await emitOp(joinOrgId, 'CON', dot('org', 'staff', svc.userId), {
            action: 'join_request',
            role: 'pending'
          }, orgFrame(joinOrgId));
        } catch (e) {
          console.warn('Roster self-add:', e.message);
        }
      }
      setOrgRoom(joinOrgId);
      setOrgRole(entry?.role || 'pending');
      if (meta) setOrgMeta(meta);
      const updatedRoster = await svc.getState(joinOrgId, EVT.ORG_ROSTER);
      if (updatedRoster?.staff) setStaff(updatedRoster.staff);
      setJoinOrgModal(false);
      setJoinOrgId('');
      showToast(`Joined organization${meta?.name ? ' "' + meta.name + '"' : ''}`, 'success');
    } catch (e) {
      if (e.message?.includes('forbidden') || e.message?.includes('not invited')) {
        showToast('Cannot join — you must be invited by an org admin first. Share your Matrix ID with them.', 'error');
      } else {
        showToast('Failed to join org: ' + e.message, 'error');
      }
    }
  };

  // CON(org.staff.{userId}, {invitation}) — staff_onboarding — invites user and adds to roster
  const handleInviteStaff = async () => {
    if (!inviteUserId.trim() || !orgRoom) return;
    if (!isValidMatrixId(inviteUserId)) {
      showToast('Invalid Matrix ID — use format @user:server', 'error');
      return;
    }
    try {
      await svc.invite(orgRoom, inviteUserId);
      const newStaff = [...staff, {
        userId: inviteUserId,
        role: inviteRole,
        joined: Date.now()
      }];
      await svc.setState(orgRoom, EVT.ORG_ROSTER, {
        staff: newStaff
      });
      await emitOp(orgRoom, 'CON', dot('org', 'staff', inviteUserId), {
        relationship: 'staff',
        role: inviteRole,
        invited_by: svc.userId
      }, orgFrame());
      setStaff(newStaff);
      setInviteModal(false);
      setInviteUserId('');
      showToast(`Invited ${inviteUserId} as ${activeOrgRoleLabels[inviteRole]}`, 'success');
    } catch (e) {
      showToast('Invite failed: ' + e.message, 'error');
    }
  };

  // NUL(org.staff_member, {reason: removed}) — membership_severance — kicks from room and removes from roster
  const handleRemoveStaff = async userId => {
    if (userId === svc.userId) {
      showToast('Cannot remove yourself', 'error');
      return;
    }
    try {
      await svc.kick(orgRoom, userId, 'Removed from organization');
      const newStaff = staff.filter(s => s.userId !== userId);
      await svc.setState(orgRoom, EVT.ORG_ROSTER, {
        staff: newStaff
      });
      await emitOp(orgRoom, 'NUL', dot('org', 'staff', userId), {
        reason: 'removed',
        removed_by: svc.userId
      }, orgFrame());
      setStaff(newStaff);
      showToast(`Removed ${userId}`, 'warn');
    } catch (e) {
      showToast('Error: ' + e.message, 'error');
    }
  };

  // ─── Email verification management ───
  const handleSaveEmailVerifyConfig = async () => {
    if (!orgRoom || orgRole !== 'admin') return;
    try {
      const config = {
        enabled: emailConfigDraft.enabled,
        required_domains: emailConfigDraft.required_domains.filter(d => d.trim()),
        require_for_roles: emailConfigDraft.require_for_roles,
        grace_period_hours: emailConfigDraft.grace_period_hours || 72
      };
      await svc.setState(orgRoom, EVT.ORG_EMAIL_CONFIG, config);
      setEmailVerifyConfig(config);
      await emitOp(orgRoom, 'ALT', dot('org', 'email_verification_config', 'enabled'), {
        value: config.enabled,
        domains: config.required_domains,
        roles: config.require_for_roles
      }, orgFrame());
      setEmailConfigModal(false);
      showToast(`Email verification ${config.enabled ? 'enabled' : 'disabled'}`, 'success');
    } catch (e) {
      showToast('Error saving config: ' + e.message, 'error');
    }
  };

  // INS(org.email_challenge, {hashed_code, webhook}) — verification_initiation → CON(org.email_code, {dest: email_inbox, via: webhook}) — out_of_band_delivery
  const handleStartEmailVerify = async () => {
    if (!verifyEmail.trim() || !orgRoom) return;
    setVerifyError('');
    if (!EmailVerification.isValidEmail(verifyEmail)) {
      setVerifyError('Please enter a valid email address');
      return;
    }
    if (emailVerifyConfig.required_domains?.length > 0 && !EmailVerification.domainMatches(verifyEmail, emailVerifyConfig.required_domains)) {
      setVerifyError(`Email must be from: ${emailVerifyConfig.required_domains.join(', ')}`);
      return;
    }
    setVerifyPending(true);
    try {
      const {
        challenge,
        plainCode
      } = await EmailVerification.createChallenge(svc.userId, verifyEmail);
      // Store challenge in org room state (hashed code only)
      await svc.setState(orgRoom, EVT.ORG_VERIFY_CHALLENGE, challenge, svc.userId);
      // Attempt to deliver via webhook; fall back to Matrix DM display
      const sent = await EmailVerification.sendCodeViaWebhook(verifyEmail, plainCode, orgMeta.name || 'Organization');
      if (!sent) {
        // Fallback: show code in-app for development/demo (in production, email infra handles this)
        showToast(`Verification code: ${plainCode} (demo mode — production sends via email)`, 'info', 12000);
      } else {
        showToast('Verification code sent to ' + verifyEmail, 'success');
      }
      await emitOp(orgRoom, 'INS', dot('org', 'email_verification', svc.userId), {
        email_domain: EmailVerification.extractDomain(verifyEmail),
        status: 'pending'
      }, orgFrame());
      setVerifyStep('code');
    } catch (e) {
      setVerifyError('Failed to start verification: ' + e.message);
    }
    setVerifyPending(false);
  };

  // DES(org.email_identity, {attestation: code_validated}) — verified_attestation on success | ALT(org.challenge.attempts, {increment: +1}) — lockout_progression on failure
  const handleSubmitVerifyCode = async () => {
    if (!verifyCode.trim() || verifyCode.length !== 6 || !orgRoom) return;
    setVerifyError('');
    setVerifyPending(true);
    try {
      // Fetch the stored challenge
      const challenge = await svc.getState(orgRoom, EVT.ORG_VERIFY_CHALLENGE, svc.userId);
      const result = await EmailVerification.validateChallenge(challenge, verifyCode);
      if (!result.valid) {
        // Update attempt count
        if (result.reason === 'incorrect_code') {
          const updated = {
            ...challenge,
            attempts: (challenge.attempts || 0) + 1
          };
          await svc.setState(orgRoom, EVT.ORG_VERIFY_CHALLENGE, updated, svc.userId);
          setVerifyError(`Incorrect code (${updated.attempts}/${challenge.max_attempts} attempts)`);
        } else if (result.reason === 'expired') {
          setVerifyError('Code expired. Please request a new one.');
          setVerifyStep('email');
        } else if (result.reason === 'max_attempts') {
          setVerifyError('Too many attempts. Please request a new code.');
          setVerifyStep('email');
        } else {
          setVerifyError('Verification failed. Please try again.');
        }
        setVerifyPending(false);
        return;
      }
      // Success — update roster with verified status
      const verifiedEntry = {
        status: 'verified',
        email: verifyEmail.trim().toLowerCase(),
        domain: EmailVerification.extractDomain(verifyEmail),
        verified_at: Date.now()
      };
      const newStaff = staff.map(s => s.userId === svc.userId ? {
        ...s,
        email_verification: verifiedEntry
      } : s);
      await svc.setState(orgRoom, EVT.ORG_ROSTER, {
        staff: newStaff
      });
      // Clear the challenge
      await svc.setState(orgRoom, EVT.ORG_VERIFY_CHALLENGE, {
        status: 'completed',
        verified_at: Date.now()
      }, svc.userId);
      await emitOp(orgRoom, 'ALT', dot('org', 'email_verification', svc.userId), {
        value: 'verified',
        email_domain: EmailVerification.extractDomain(verifyEmail),
        verified_at: Date.now()
      }, orgFrame());
      setStaff(newStaff);
      setMyVerification(verifiedEntry);
      setVerifyStep('done');
      showToast('Email verified successfully', 'success');
    } catch (e) {
      setVerifyError('Verification error: ' + e.message);
    }
    setVerifyPending(false);
  };

  // NUL(org.verification, {reason: admin_revoked}) — attestation_destruction — admin removes verified status
  const handleRevokeVerification = async userId => {
    if (!orgRoom || orgRole !== 'admin') return;
    try {
      const newStaff = staff.map(s => s.userId === userId ? {
        ...s,
        email_verification: {
          status: 'revoked',
          revoked_at: Date.now(),
          revoked_by: svc.userId
        }
      } : s);
      await svc.setState(orgRoom, EVT.ORG_ROSTER, {
        staff: newStaff
      });
      await emitOp(orgRoom, 'NUL', dot('org', 'email_verification', userId), {
        reason: 'admin_revoked',
        revoked_by: svc.userId
      }, orgFrame());
      setStaff(newStaff);
      if (userId === svc.userId) setMyVerification({
        status: 'revoked'
      });
      showToast(`Revoked verification for ${userId}`, 'warn');
    } catch (e) {
      showToast('Error revoking: ' + e.message, 'error');
    }
  };
  const openEmailVerifyModal = () => {
    setVerifyEmail('');
    setVerifyCode('');
    setVerifyStep('email');
    setVerifyError('');
    setVerifyPending(false);
    setEmailVerifyModal(true);
  };

  // ─── Provider profile management ───
  const handleSaveProfile = async () => {
    if (!rosterRoom) return;
    try {
      const profile = {
        display_name: profileDraft.display_name.trim(),
        title: profileDraft.title.trim(),
        credentials: profileDraft.credentials.trim(),
        bio: profileDraft.bio.trim(),
        service_types: profileDraft.service_types.trim(),
        org_membership: orgRoom ? {
          org_room_id: orgRoom,
          org_name: orgMeta.name || '',
          org_type: orgMeta.type || '',
          role: orgRole || '',
          verified: myVerification?.status === 'verified' || !emailVerifyConfig.enabled,
          email_verified: myVerification?.status === 'verified',
          verified_email: myVerification?.status === 'verified' ? myVerification.email : null,
          verified_domain: myVerification?.status === 'verified' ? myVerification.domain : null
        } : null,
        updated: Date.now()
      };
      await svc.setState(rosterRoom, EVT.PROVIDER_PROFILE, profile);
      await emitOp(rosterRoom, 'ALT', dot('org', 'provider_profile', 'profile'), {
        display_name: profile.display_name,
        title: profile.title,
        updated_by: svc.userId
      }, orgFrame());
      setProviderProfile(profile);
      setProfileModal(false);
      showToast('Profile saved', 'success');
      // Background sync to bridges — non-blocking
      for (const c of cases) {
        svc.setState(c.bridgeRoomId, EVT.PROVIDER_PROFILE, profile)
          .catch(e => console.warn('Profile sync to bridge failed', c.bridgeRoomId, e.message));
      }
    } catch (e) {
      showToast('Failed to save profile: ' + e.message, 'error');
    }
  };
  const openProfileModal = () => {
    setProfileDraft({
      display_name: providerProfile.display_name || '',
      title: providerProfile.title || '',
      credentials: providerProfile.credentials || '',
      bio: providerProfile.bio || '',
      service_types: providerProfile.service_types || ''
    });
    setProfileModal(true);
  };

  // ─── Inter-org messaging ───

  // Check if current user has permission for an org messaging action
  const hasOrgMsgPermission = useCallback(action => {
    // action: 'read' or 'respond'
    if (!orgRole) return false;
    const allowed = orgMsgAccess[action] || [];
    return allowed.includes(orgRole);
  }, [orgRole, orgMsgAccess]);

  // Build opacity-aware envelope for inter-org messages.
  // transparent: reveals org room ID, org name, sender ID, sender name
  // translucent: reveals org name only (not room ID or sender identity)
  // opaque: reveals nothing about the sender org
  const buildOpacityEnvelope = useCallback(() => ({
    [`${NS}.type`]: 'org_message',
    [`${NS}.envelope`]: {
      opacity: orgOpacity,
      org_room_id: orgOpacity === 'transparent' ? orgRoom : undefined,
      org_name: orgOpacity !== 'opaque' ? orgMeta.name || undefined : undefined,
      sender_id: orgOpacity === 'transparent' ? svc.userId : undefined,
      sender_name: orgOpacity === 'transparent' ? providerProfile.display_name || undefined : undefined,
      ts: Date.now()
    }
  }), [orgOpacity, orgRoom, orgMeta.name, providerProfile.display_name]);

  // Save opacity setting (admin only)
  const handleSaveOpacity = async level => {
    if (!orgRoom || orgRole !== 'admin') return;
    try {
      await svc.setState(orgRoom, EVT.ORG_OPACITY, {
        level,
        updated: Date.now(),
        updated_by: svc.userId
      });
      setOrgOpacity(level);
      await emitOp(orgRoom, 'ALT', dot('org', 'opacity', 'level'), {
        from: orgOpacity,
        to: level,
        changed_by: svc.userId
      }, orgFrame());
      showToast(`Opacity set to ${OPACITY_LABELS[level]}`, 'success');
    } catch (e) {
      showToast('Failed to update opacity: ' + e.message, 'error');
    }
  };

  // Save message access settings (admin only)
  const handleSaveMsgAccess = async () => {
    if (!orgRoom || orgRole !== 'admin') return;
    try {
      await svc.setState(orgRoom, EVT.ORG_MSG_ACCESS, {
        ...msgAccessDraft,
        updated: Date.now()
      });
      setOrgMsgAccess(msgAccessDraft);
      await emitOp(orgRoom, 'ALT', dot('org', 'msg_access', 'roles'), {
        read: msgAccessDraft.read,
        respond: msgAccessDraft.respond
      }, orgFrame());
      setMsgAccessModal(false);
      showToast('Message access roles updated', 'success');
    } catch (e) {
      showToast('Failed to update access: ' + e.message, 'error');
    }
  };

  // Save org terminology customization (admin only)
  const handleSaveTerminology = async () => {
    if (!orgRoom || orgRole !== 'admin') return;
    try {
      const payload = {
        ...terminologyDraft,
        updated: Date.now(),
        updated_by: svc.userId
      };
      await svc.setState(orgRoom, EVT.ORG_TERMINOLOGY, payload);
      setOrgTerminology({
        ...TERMINOLOGY_DEFAULTS,
        ...terminologyDraft
      });
      setTerminologyModal(false);
      await emitOp(orgRoom, 'ALT', dot('org', 'terminology', 'terms'), {
        client_term: terminologyDraft.client_term,
        provider_term: terminologyDraft.provider_term,
        staff_term: terminologyDraft.staff_term,
        changed_by: svc.userId
      }, orgFrame());
      showToast('Terminology updated', 'success');
    } catch (e) {
      showToast('Failed to update terminology: ' + e.message, 'error');
    }
  };

  // Reset terminology to defaults
  const handleResetTerminology = () => {
    setTerminologyDraft({
      ...TERMINOLOGY_DEFAULTS
    });
  };

  // Save org custom roles (admin only)
  const handleSaveOrgRoles = async (roles) => {
    if (!orgRoom || orgRole !== 'admin') return;
    try {
      await svc.setState(orgRoom, EVT.ORG_ROLES, { roles, updated: Date.now(), updated_by: svc.userId });
      setOrgRolesConfig(roles);
      await emitOp(orgRoom, 'ALT', dot('org', 'roles', 'config'), { role_count: roles.length, changed_by: svc.userId }, orgFrame());
      showToast('Roles updated', 'success');
    } catch (e) {
      showToast('Failed to update roles: ' + e.message, 'error');
    }
  };

  // Delete an org role (admin only, not the protected admin role)
  const handleDeleteRole = async (roleKey) => {
    if (!orgRoom || orgRole !== 'admin') return;
    const role = orgRolesConfig.find(r => r.key === roleKey);
    if (role?.protected) { showToast('Cannot delete the Admin role', 'warn'); return; }
    const usersWithRole = staff.filter(s => s.role === roleKey);
    if (usersWithRole.length > 0) {
      showToast(`Cannot delete role — ${usersWithRole.length} ${usersWithRole.length === 1 ? 'member has' : 'members have'} this role. Reassign them first.`, 'warn');
      return;
    }
    const updated = orgRolesConfig.filter(r => r.key !== roleKey);
    await handleSaveOrgRoles(updated);
  };

  // Add a new custom org role
  const handleAddRole = async () => {
    if (!newRoleDraft.label.trim()) return;
    let key = newRoleDraft.label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    // Ensure uniqueness
    while (orgRolesConfig.some(r => r.key === key)) { key += '_1'; }
    const updated = [...orgRolesConfig, { key, label: newRoleDraft.label.trim(), description: newRoleDraft.description.trim() || 'Custom role.' }];
    await handleSaveOrgRoles(updated);
    setNewRoleDraft({ label: '', description: '' });
    setAddRoleModal(false);
  };

  // Save edits to an existing role (label/description)
  const handleSaveRoleEdit = async () => {
    if (!editingRole) return;
    const updated = orgRolesConfig.map(r => r.key === editingRole.key ? { ...r, label: editingRole.label.trim(), description: editingRole.description.trim() } : r);
    await handleSaveOrgRoles(updated);
    setEditingRole(null);
  };

  // Create org-to-org messaging channel
  const handleCreateOrgChannel = async () => {
    if (!orgRoom || !composePeerOrgId.trim()) return;
    // Check for existing channel
    const existing = orgChannels.find(c => c.orgs?.includes(composePeerOrgId.trim()));
    if (existing) {
      setActiveChannel(existing.roomId);
      setView('org-inbox');
      setComposeOrgModal(false);
      showToast('Channel already exists — opened', 'info');
      return;
    }
    try {
      const peerOrgId = composePeerOrgId.trim();
      const channelRoom = await svc.createRoom(`[Khora Org Msg] ${orgMeta.name || 'Org'} ↔ ${composePeerOrgName || peerOrgId.slice(0, 12)}`, 'Inter-org messaging channel', [{
        type: EVT.IDENTITY,
        state_key: '',
        content: {
          account_type: 'org_msg_channel',
          created: Date.now()
        }
      }, {
        type: EVT.ORG_MSG_CHANNEL,
        state_key: '',
        content: {
          type: 'org_msg_channel',
          orgs: [orgRoom, peerOrgId],
          org_names: {
            [orgRoom]: orgMeta.name || '',
            [peerOrgId]: composePeerOrgName || ''
          },
          created: Date.now(),
          created_by: svc.userId
        }
      }]);
      // Invite eligible staff from the peer org (not the room ID — Matrix can't invite rooms)
      try {
        const peerRoster = await svc.getState(peerOrgId, EVT.ORG_ROSTER);
        const peerStaff = peerRoster?.staff || [];
        const peerMsgAccess = await svc.getState(peerOrgId, EVT.ORG_MSG_ACCESS);
        const readRoles = peerMsgAccess?.read || ['admin', 'case_manager'];
        let invited = 0;
        for (const s of peerStaff.filter(s => readRoles.includes(s.role))) {
          try { await svc.invite(channelRoom, s.userId); invited++; } catch {}
        }
        if (invited === 0 && peerStaff.length > 0) {
          // Fallback: invite all staff if no role-filtered matches
          for (const s of peerStaff) {
            try { await svc.invite(channelRoom, s.userId); invited++; } catch {}
          }
        }
        if (invited === 0) {
          showToast('Channel created but could not invite peer org staff — they may need to join manually', 'warn');
        }
      } catch (e) {
        console.warn('Peer org staff invite:', e.message);
        showToast('Channel created but peer org roster not readable — share the channel ID with them', 'warn');
      }
      await emitOp(channelRoom, 'INS', dot('org', 'channels', 'channel'), {
        from_org: orgRoom,
        to_org: peerOrgId
      }, orgFrame());
      const newChannel = {
        roomId: channelRoom,
        orgs: [orgRoom, peerOrgId],
        org_names: {
          [orgRoom]: orgMeta.name || '',
          [peerOrgId]: composePeerOrgName || ''
        },
        type: 'org_msg_channel',
        created: Date.now()
      };
      setOrgChannels(prev => [...prev, newChannel]);
      setActiveChannel(channelRoom);
      setView('org-inbox');
      setComposeOrgModal(false);
      setComposePeerOrgId('');
      setComposePeerOrgName('');
      showToast('Messaging channel created', 'success');
    } catch (e) {
      showToast('Failed to create channel: ' + e.message, 'error');
    }
  };

  // Load messages for an org channel
  const loadChannelMessages = async channelRoomId => {
    if (!channelRoomId) return;
    const msgs = await svc.getMessages(channelRoomId);
    setChannelMessages(msgs);
  };

  // Send a message in an org channel — applies opacity envelope
  const handleSendOrgMsg = async () => {
    if (!orgMsgText.trim() || !activeChannel) return;
    if (!hasOrgMsgPermission('respond')) {
      showToast('You do not have permission to send org messages', 'warn');
      return;
    }
    try {
      const envelope = buildOpacityEnvelope();
      await svc.sendMessage(activeChannel, orgMsgText, envelope);
      await emitOp(activeChannel, 'INS', dot('org', 'messages', 'org_message'), {
        opacity: orgOpacity,
        body_length: orgMsgText.length
      }, orgFrame());
      setOrgMsgText('');
      setTimeout(() => loadChannelMessages(activeChannel), 500);
    } catch (e) {
      showToast('Send failed: ' + e.message, 'error');
    }
  };

  // Open a channel
  const openChannel = channelRoomId => {
    setActiveChannel(channelRoomId);
    setView('org-inbox');
    loadChannelMessages(channelRoomId);
  };

  // Resolve display info for a message based on opacity
  const resolveMessageSender = useCallback(msg => {
    const env = msg.content?.[`${NS}.envelope`];
    if (!env) return {
      label: msg.sender === svc.userId ? 'You' : msg.sender,
      isOwn: msg.sender === svc.userId
    };
    const isOwn = msg.sender === svc.userId || env.org_room_id === orgRoom;
    switch (env.opacity) {
      case 'transparent':
        return {
          label: env.sender_name || env.sender_id || 'Unknown',
          org: env.org_name,
          isOwn
        };
      case 'translucent':
        return {
          label: env.org_name || 'Organization',
          org: env.org_name,
          isOwn
        };
      case 'opaque':
        return {
          label: 'An organization',
          org: null,
          isOwn
        };
      default:
        return {
          label: msg.sender,
          isOwn
        };
    }
  }, [orgRoom]);

  // ─── Inbox chat functions ───
  const loadInboxMessages = async roomId => {
    setInboxMessages(await svc.getMessages(roomId));
  };
  const openInboxConvo = roomId => {
    setInboxConvo(roomId);
    loadInboxMessages(roomId);
  };
  const handleSendInboxMsg = async () => {
    if (!inboxMsgText.trim() || !inboxConvo) return;
    const reply = inboxReplyTo;
    const isOrgChannel = orgChannels.some(ch => ch.roomId === inboxConvo);
    if (isOrgChannel) {
      if (!hasOrgMsgPermission('respond')) {
        showToast('You do not have permission to send org messages', 'warn');
        return;
      }
      const envelope = buildOpacityEnvelope();
      await svc.sendMessage(inboxConvo, inboxMsgText, envelope, reply);
      await emitOp(inboxConvo, 'INS', dot('org', 'messages', 'org_message'), {
        opacity: orgOpacity,
        body_length: inboxMsgText.length
      }, orgFrame());
    } else if (teamDMs.some(d => d.roomId === inboxConvo)) {
      await svc.sendMessage(inboxConvo, inboxMsgText, {
        [`${NS}.type`]: 'team_dm',
        [`${NS}.sender_name`]: providerProfile.display_name || svc.userId
      }, reply);
    } else {
      await svc.sendMessage(inboxConvo, inboxMsgText, {
        [`${NS}.type`]: 'note'
      }, reply);
      await emitOp(inboxConvo, 'INS', dot('bridge', 'messages', 'provider_note'), {
        body: inboxMsgText
      }, bridgeFrame(inboxConvo));
    }
    setInboxMsgText('');
    setInboxReplyTo(null);
    setTimeout(() => loadInboxMessages(inboxConvo), 500);
  };
  // ─── Message group (bucket) functions ───
  const saveMsgBuckets = nb => { setMsgBuckets(nb); try { localStorage.setItem('khora_msg_buckets', JSON.stringify(nb)); } catch {} };
  const createMsgBucket = label => { const b = { id: Date.now().toString(36), label: label.trim(), roomIds: [] }; saveMsgBuckets([...msgBuckets, b]); };
  const assignToBucket = (roomId, bucketId) => { saveMsgBuckets(msgBuckets.map(b => b.id === bucketId ? { ...b, roomIds: [...new Set([...b.roomIds, roomId])] } : { ...b, roomIds: b.roomIds.filter(r => r !== roomId) })); setAssignBucketTarget(null); };
  const removeFromBuckets = roomId => { saveMsgBuckets(msgBuckets.map(b => ({ ...b, roomIds: b.roomIds.filter(r => r !== roomId) }))); setAssignBucketTarget(null); };
  const deleteMsgBucket = id => saveMsgBuckets(msgBuckets.filter(b => b.id !== id));
  // ─── Team member DM functions ───
  const startTeamDM = async (peerId, peerName, teamName, teamRoomId) => {
    // Check if DM room already exists
    const existing = teamDMs.find(d => d.peerId === peerId);
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
          org_name: orgMeta?.name || null,
          peer_names: {
            [svc.userId]: providerProfile.display_name || svc.userId,
            [peerId]: peerName || peerId
          },
          peer_type: 'provider',
          created: Date.now()
        }
      }]);
      await svc.invite(roomId, peerId);
      const newDM = {
        roomId,
        peerId,
        peerName: peerName || peerId,
        teamName: teamName || null,
        teamRoomId: teamRoomId || null,
        orgName: orgMeta?.name || null,
        peerType: 'provider'
      };
      setTeamDMs(prev => [...prev, newDM]);
      setNewTeamDMModal(false);
      setNewDMTarget(null);
      setInboxTab('team');
      openInboxConvo(roomId);
      showToast(`DM created — invite sent to ${peerName || peerId}`, 'success');
    } catch (e) {
      showToast('Failed to create DM: ' + e.message, 'error');
    }
  };
  // Build list of all messageable contacts (team members + case/bridge contacts)
  const allContacts = useMemo(() => {
    const contacts = [];
    const seen = new Set();
    for (const team of teams) {
      for (const m of (team.members || [])) {
        if (m.userId === svc.userId || seen.has(m.userId)) continue;
        seen.add(m.userId);
        contacts.push({
          userId: m.userId,
          displayName: m.display_name || m.userId,
          teamName: team.name,
          teamRoomId: team.roomId,
          role: m.role,
          hasDM: teamDMs.some(d => d.peerId === m.userId)
        });
      }
    }
    for (const c of cases) {
      if (!c.clientUserId || c.clientUserId === svc.userId || seen.has(c.clientUserId)) continue;
      seen.add(c.clientUserId);
      contacts.push({
        userId: c.clientUserId,
        displayName: c.sharedData.full_name || c.clientUserId,
        teamName: null,
        teamRoomId: null,
        role: null,
        hasDM: teamDMs.some(d => d.peerId === c.clientUserId)
      });
    }
    return contacts;
  }, [teams, teamDMs, cases]);

  const getInboxConvoName = useCallback(roomId => {
    const c = cases.find(c => c.bridgeRoomId === roomId);
    if (c) return c.sharedData.full_name || c.clientUserId;
    const ch = orgChannels.find(ch => ch.roomId === roomId);
    if (ch) {
      const peerOrgId = ch.orgs?.find(o => o !== orgRoom);
      return ch.org_names?.[peerOrgId] || peerOrgId?.slice(0, 20) || 'Organization';
    }
    const dm = teamDMs.find(d => d.roomId === roomId);
    if (dm) return dm.peerName || dm.peerId;
    return roomId?.slice(0, 20) || 'Unknown';
  }, [cases, orgChannels, orgRoom, teamDMs]);
  const getInboxConvoType = useCallback(roomId => {
    if (cases.some(c => c.bridgeRoomId === roomId)) return 'case';
    if (orgChannels.some(ch => ch.roomId === roomId)) return 'channel';
    if (teamDMs.some(d => d.roomId === roomId)) return 'team_dm';
    return 'unknown';
  }, [cases, orgChannels, teamDMs]);

  // Determine network role based on org membership
  const networkRole = useMemo(() => {
    if (!networkRoom || !orgRoom) return null;
    const myOrg = networkMembers.find(m => m.id === orgRoom || m.id === svc.userId);
    return myOrg?.role || 'member';
  }, [networkRoom, orgRoom, networkMembers]);
  const openCase = bid => {
    setView('case');
    setActiveCase(bid);
    loadMessages(bid);
    loadProviderObservations(bid);
    loadCaseAllocations(bid);
  };
  const activeCaseData = cases.find(c => c.bridgeRoomId === activeCase);

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
  }, "Provider Setup Failed"), /*#__PURE__*/React.createElement("p", {
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
    onClick: initProvider,
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
  /* ─── Mobile Bottom Nav (provider) ─── */
  isMobile && /*#__PURE__*/React.createElement(MobileBottomNav, {
    tabs: [
      { id: 'dashboard', icon: 'briefcase', label: 'Home' },
      { id: 'database', icon: 'grid', label: 'Database' },
      { id: 'inbox', icon: 'msg', label: 'Messages', badge: cases.length + (orgChannels || []).length, badgeClass: 'nav-badge-gold' },
      { id: 'clients', icon: 'users', label: T.client_term_plural || 'Clients' }
    ],
    activeView: activeCase ? 'case' : view,
    onNavigate: id => { setView(id); setActiveCase(null); setActiveIndividual(null); setActiveResourceProfile(null); setActiveTeamDetail && setActiveTeamDetail(null); },
    moreItems: [
      { id: 'teams', icon: 'users', label: 'Teams' },
      { id: 'schema', icon: 'grid', label: 'Schema' },
      { id: 'hierarchy', icon: 'globe', label: 'My Network' },
      { id: 'activity', icon: 'layers', label: 'Activity Stream' },
      { id: 'transparency', icon: 'eye', label: 'Transparency' },
      { id: 'backup', icon: 'cloud', label: 'Backup' },
      ...(orgRoom ? [{ id: 'org-settings', icon: 'briefcase', label: 'Organization' }] : [])
    ],
    onMoreNavigate: id => { setView(id); setActiveCase(null); setActiveIndividual(null); setActiveResourceProfile(null); }
  },
    /*#__PURE__*/React.createElement("div", { style: { padding: '8px 0', borderTop: '1px solid var(--border-0)', marginTop: 4 } },
      /*#__PURE__*/React.createElement("div", { className: "team-ctx-pills" },
        /*#__PURE__*/React.createElement("button", {
          className: "team-ctx-pill",
          onClick: () => onSwitchContext('client')
        }, /*#__PURE__*/React.createElement(I, { n: "user", s: 10 }), "Personal"),
        teams.map(t => { const _tpActive = activeTeamContext === t.roomId; const _tpColor = `hsl(${t.color_hue || 260}, 60%, 55%)`; return /*#__PURE__*/React.createElement("button", {
          key: t.roomId,
          className: "team-ctx-pill" + (_tpActive ? " active" : ""),
          style: _tpActive ? { background: _tpColor, borderColor: _tpColor, color: '#fff' } : {},
          onClick: () => switchTeamContext(t.roomId)
        }, /*#__PURE__*/React.createElement("span", {
          className: "pill-dot",
          style: { background: _tpActive ? '#fff' : _tpColor }
        }), t.name || 'Unnamed Team'); })
      )
    ),
    /*#__PURE__*/React.createElement("div", { style: { padding: '8px 0', borderTop: '1px solid var(--border-0)', marginTop: 8, display: 'flex', gap: 8 } },
      /*#__PURE__*/React.createElement(ThemeToggle, { style: { flex: 1 } }),
      /*#__PURE__*/React.createElement("button", { onClick: onLogout, className: "b-gho b-sm", style: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 } },
        /*#__PURE__*/React.createElement(I, { n: "logout", s: 12 }), "Logout")
    )
  ),
  /* ─── Mobile FAB for quick note ─── */
  isMobile && /*#__PURE__*/React.createElement("button", {
    className: "mobile-fab",
    onClick: () => { setNewNoteAttachTo(null); setNewNoteModal(true); },
    "aria-label": "Quick note"
  }, /*#__PURE__*/React.createElement(I, { n: "plus", s: 24 })),
  /*#__PURE__*/React.createElement("div", {
    className: `app-sidebar${sidebarCollapsed ? ' collapsed' : ''}`,
    style: {
      width: sidebarCollapsed ? 0 : 260,
      minWidth: sidebarCollapsed ? 0 : 260,
      height: '100%',
      background: 'var(--bg-1)',
      borderRight: sidebarCollapsed ? 'none' : (teamMode ? `2px solid ${teamColorThemed(teamMode.color_hue, isLightTheme).primary}` : '1px solid var(--border-0)'),
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
      fontSize: 15,
      flex: 1
    }
  }, "Khora"), /*#__PURE__*/React.createElement("button", {
    className: "sidebar-collapse-btn",
    onClick: toggleSidebar,
    title: "Collapse sidebar"
  }, /*#__PURE__*/React.createElement(I, { n: "chevronLeft", s: 14 })), /*#__PURE__*/React.createElement(NotificationBell, {
    notifications: notifications,
    onNotifClick: handleNotifClick,
    onDismiss: n => setNotifications(prev => prev.filter(x => x.id !== n.id)),
    onDismissAll: handleDismissAllNotifs
  })), teamMode && /*#__PURE__*/React.createElement("div", {
    style: { display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, padding: '5px 8px', borderRadius: 'var(--r)', background: `hsla(${teamMode.color_hue || 260}, 60%, 55%, 0.1)` }
  }, /*#__PURE__*/React.createElement("span", {
    style: { width: 7, height: 7, borderRadius: '50%', background: `hsl(${teamMode.color_hue || 260}, 60%, 55%)`, flexShrink: 0 }
  }), /*#__PURE__*/React.createElement("span", {
    style: { fontSize: 10.5, fontWeight: 700, color: `hsl(${teamMode.color_hue || 260}, 60%, 50%)`, fontFamily: 'var(--mono)', letterSpacing: '0.05em', textTransform: 'uppercase', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
  }, teamMode.name)), /*#__PURE__*/React.createElement("div", {
    onClick: () => setShareContactModal(true),
    style: {
      marginTop: 10,
      padding: '10px 12px',
      background: 'var(--bg-2)',
      border: '1px solid var(--border-1)',
      borderRadius: 'var(--r-lg)',
      cursor: 'pointer',
      transition: 'border-color .2s'
    },
    onMouseEnter: e => e.currentTarget.style.borderColor = 'var(--gold)',
    onMouseLeave: e => e.currentTarget.style.borderColor = 'var(--border-1)'
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 32,
      height: 32,
      borderRadius: '50%',
      background: orgRoom ? 'var(--blue-dim)' : 'var(--gold-dim)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: orgRoom ? 'var(--blue)' : 'var(--gold)',
      border: orgRoom ? '2px solid var(--blue)' : '2px solid var(--gold)'
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: orgRoom ? 'shieldCheck' : 'user',
    s: 16
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      display: 'block',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      color: 'var(--tx-0)'
    }
  }, providerProfile.display_name || svc.userId?.split(':')[0]?.replace('@', '') || T.provider_term), providerProfile.title && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      color: 'var(--tx-2)',
      display: 'block',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, providerProfile.title))), orgRoom ? /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--blue-dim)',
      border: '1px solid rgba(91,156,245,.2)',
      borderRadius: 'var(--r)',
      padding: '6px 8px',
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "shieldCheck",
    s: 12,
    c: "var(--blue)"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10.5,
      fontWeight: 600,
      color: 'var(--blue)',
      display: 'block',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, orgMeta.name || 'Organization'), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 9,
      color: 'var(--tx-2)',
      fontFamily: 'var(--mono)'
    }
  }, activeOrgRoleLabels[orgRole] || orgRole, " \xB7 ", ORG_TYPE_LABELS[orgMeta.type] || orgMeta.type)), myVerification?.status === 'verified' ? /*#__PURE__*/React.createElement("span", {
    className: "tag tag-green",
    style: {
      fontSize: 7.5,
      padding: '1px 5px'
    }
  }, "VERIFIED") : emailVerifyConfig.enabled ? /*#__PURE__*/React.createElement("span", {
    className: "tag tag-gold",
    style: {
      fontSize: 7.5,
      padding: '1px 5px',
      cursor: 'pointer'
    },
    onClick: e => { e.stopPropagation(); openEmailVerifyModal(); }
  }, "UNVERIFIED") : /*#__PURE__*/React.createElement("span", {
    className: "tag tag-green",
    style: {
      fontSize: 7.5,
      padding: '1px 5px'
    }
  }, "VERIFIED"), allOrgs.length > 1 && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 8,
      color: 'var(--tx-3)',
      fontFamily: 'var(--mono)',
      marginLeft: 2
    }
  }, (allOrgs.findIndex(o => o.roomId === orgRoom) + 1) + "/" + allOrgs.length)) : /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      padding: '4px 0'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 9.5,
      color: 'var(--tx-3)',
      fontStyle: 'italic'
    }
  }, "No organization \u2014 unaffiliated")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      marginTop: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--mono)',
      fontSize: 8.5,
      color: 'var(--tx-3)',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      flex: 1
    }
  }, svc.userId), /*#__PURE__*/React.createElement("span", {
    className: "tag tag-gold",
    style: {
      fontSize: 8
    }
  }, T.provider_term.toUpperCase())), providerProfile.credentials && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 4
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 9,
      color: 'var(--tx-2)',
      fontFamily: 'var(--mono)',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      display: 'block'
    }
  }, providerProfile.credentials)))),
  /* ─── Unified Team / Personal Switcher (sidebar) ─── */
  /*#__PURE__*/React.createElement("div", {
    className: "team-ctx-wrap"
  }, /*#__PURE__*/React.createElement("div", { className: "team-ctx-pills" },
      /*#__PURE__*/React.createElement("button", {
        className: "team-ctx-pill",
        onClick: () => onSwitchContext('client')
      }, /*#__PURE__*/React.createElement(I, { n: "user", s: 10 }), "Personal"),
      teams.map(t => { const _tpActive = activeTeamContext === t.roomId; const _tpColor = `hsl(${t.color_hue || 260}, 60%, 55%)`; return /*#__PURE__*/React.createElement("button", {
        key: t.roomId,
        className: "team-ctx-pill" + (_tpActive ? " active" : ""),
        style: _tpActive ? { background: _tpColor, borderColor: _tpColor, color: '#fff' } : {},
        onClick: () => switchTeamContext(t.roomId)
      }, /*#__PURE__*/React.createElement("span", {
        className: "pill-dot",
        style: { background: _tpActive ? '#fff' : _tpColor }
      }), t.name || 'Unnamed Team'); })
    )
  ),
  /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflow: 'auto',
      padding: '6px 6px'
    }
  }, (() => {
    const schemaNotifCount = notifications.filter(n => (n.type === 'schema_update' || n.type === 'schema_new') && !n.read).length;
    const activityNotifCount = notifications.filter(n => n.type === 'data_change' && !n.read).length;
    return [{
      id: 'dashboard',
      icon: 'briefcase',
      label: 'Dashboard'
    }, {
      id: 'database',
      icon: 'grid',
      label: 'Database'
    }, {
      id: 'inbox',
      icon: 'msg',
      label: 'Messages'
    }, {
      id: 'teams',
      icon: 'users',
      label: `Teams${teams.length ? ` (${teams.length})` : ''}`
    }, {
      id: 'schema',
      icon: 'grid',
      label: 'Schema',
      badge: schemaNotifCount,
      badgeClass: 'nav-badge-teal'
    }, {
      id: 'hierarchy',
      icon: 'globe',
      label: 'My Network'
    }, {
      id: 'activity',
      icon: 'list',
      label: 'Action Log',
      badge: activityNotifCount,
      badgeClass: 'nav-badge-teal'
    }, {
      id: 'transparency',
      icon: 'eye',
      label: 'Transparency'
    }, {
      id: 'backup',
      icon: 'cloud',
      label: 'Backup'
    }].map(item => /*#__PURE__*/React.createElement("div", {
      key: item.id,
      onClick: () => {
        setView(item.id);
        setActiveCase(null);
        setActiveIndividual(null);
        setActiveResourceProfile(null);
        // When clicking Teams nav and a team is selected, open its detail view
        if (item.id === 'teams' && activeTeamContext) {
          const t = teams.find(t => t.roomId === activeTeamContext);
          setActiveTeamDetail(t || null);
        } else {
          setActiveTeamDetail(null);
        }
        if (item.id !== 'inbox') {
          setInboxConvo(null);
          setInboxMessages([]);
        }
      },
      style: {
        padding: '9px 10px',
        borderRadius: 'var(--r)',
        cursor: 'pointer',
        marginBottom: 1,
        background: (view === item.id || item.id === 'database' && (view === 'individual-profile' || view === 'resource-profile')) && !activeCase ? 'var(--bg-4)' : 'transparent',
        borderLeft: (view === item.id || item.id === 'database' && (view === 'individual-profile' || view === 'resource-profile')) && !activeCase ? `2px solid ${teamMode ? `hsl(${teamMode.color_hue || 260}, 60%, 55%)` : 'var(--gold)'}` : '2px solid transparent',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        transition: 'all .15s',
        color: (view === item.id || item.id === 'database' && (view === 'individual-profile' || view === 'resource-profile')) && !activeCase ? 'var(--tx-0)' : 'var(--tx-1)'
      },
      onMouseEnter: e => {
        if (!(view === item.id && !activeCase)) e.currentTarget.style.background = 'var(--bg-3)';
      },
      onMouseLeave: e => {
        if (!(view === item.id && !activeCase)) e.currentTarget.style.background = 'transparent';
      }
    }, /*#__PURE__*/React.createElement(I, {
      n: item.icon,
      s: 14
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12.5,
        fontWeight: view === item.id || item.id === 'database' && (view === 'individual-profile' || view === 'resource-profile') ? 600 : 400
      }
    }, item.label), item.id === 'inbox' && cases.length + orgChannels.length > 0 && /*#__PURE__*/React.createElement("span", {
      className: "nav-badge nav-badge-gold"
    }, cases.length + orgChannels.length), item.badge > 0 && /*#__PURE__*/React.createElement("span", {
      className: `nav-badge ${item.badgeClass}`
    }, item.badge)));
  })(), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '14px 10px 4px'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "ORGANIZATION")), orgRoom ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '6px 10px',
      marginBottom: 4
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 20,
      height: 20,
      borderRadius: 'var(--r)',
      background: 'var(--blue-dim)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--blue)'
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "users",
    s: 11
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11.5,
      fontWeight: 600,
      color: 'var(--tx-0)',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, orgMeta.name || 'Organization')), orgMeta.type && /*#__PURE__*/React.createElement("span", {
    className: "tag tag-teal",
    style: {
      fontSize: 8,
      marginTop: 4,
      marginLeft: 26
    }
  }, ORG_TYPE_LABELS[orgMeta.type] || orgMeta.type)), [{
    id: 'org-settings',
    icon: 'settings',
    label: 'Org Settings',
    reqRole: 'admin'
  }, {
    id: 'org-inbox',
    icon: 'msg',
    label: `Messages${orgChannels.length ? ` (${orgChannels.length})` : ''}`
  }, {
    id: 'staff',
    icon: 'users',
    label: T.staff_term_plural
  }, {
    id: 'network',
    icon: 'globe',
    label: 'Network'
  }].filter(item => !item.reqRole || orgRole === item.reqRole).filter(item => item.id !== 'org-inbox' || hasOrgMsgPermission('read')).map(item => /*#__PURE__*/React.createElement("div", {
    key: item.id,
    onClick: () => {
      setView(item.id);
      setActiveCase(null);
    },
    style: {
      padding: '9px 10px',
      borderRadius: 'var(--r)',
      cursor: 'pointer',
      marginBottom: 1,
      background: view === item.id && !activeCase ? 'var(--bg-4)' : 'transparent',
      borderLeft: view === item.id && !activeCase ? '2px solid var(--blue)' : '2px solid transparent',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      transition: 'all .15s',
      color: view === item.id && !activeCase ? 'var(--tx-0)' : 'var(--tx-1)'
    },
    onMouseEnter: e => {
      if (!(view === item.id && !activeCase)) e.currentTarget.style.background = 'var(--bg-3)';
    },
    onMouseLeave: e => {
      if (!(view === item.id && !activeCase)) e.currentTarget.style.background = 'transparent';
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: item.icon,
    s: 14
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12.5,
      fontWeight: view === item.id ? 600 : 400
    }
  }, item.label)))) : /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '4px 10px',
      display: 'flex',
      flexDirection: 'column',
      gap: 4
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setCreateOrgModal(true),
    className: "b-gho b-sm",
    style: {
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "plus",
    s: 12
  }), "Create Organization"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setJoinOrgModal(true),
    className: "b-gho b-xs",
    style: {
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "users",
    s: 10
  }), "Join Organization")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '14px 10px 4px'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, activeTeamObj ? "CASES \u2014 " + activeTeamObj.name + " (" + teamFilteredCases.length + ")" : "CASES (" + cases.length + ")")), teamFilteredCases.length === 0 && /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--tx-3)',
      fontSize: 11.5,
      padding: '12px 10px',
      textAlign: 'center'
    }
  }, activeTeamObj ? "No cases for this team" : "No clients shared with you yet"), teamFilteredCases.map((c, i) => {
    const assignment = caseAssignments[c.bridgeRoomId];
    const isPrimary = (assignment?.primary || c.meta?.provider) === svc.userId;
    return /*#__PURE__*/React.createElement("div", {
      key: c.bridgeRoomId,
      onClick: () => openCase(c.bridgeRoomId),
      style: {
        padding: '8px 10px',
        borderRadius: 'var(--r)',
        cursor: 'pointer',
        marginBottom: 1,
        background: activeCase === c.bridgeRoomId ? 'var(--bg-4)' : 'transparent',
        borderLeft: activeCase === c.bridgeRoomId ? '2px solid var(--gold)' : '2px solid transparent',
        transition: 'all .15s'
      },
      onMouseEnter: e => {
        if (activeCase !== c.bridgeRoomId) e.currentTarget.style.background = 'var(--bg-3)';
      },
      onMouseLeave: e => {
        if (activeCase !== c.bridgeRoomId) e.currentTarget.style.background = 'transparent';
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12,
        fontWeight: activeCase === c.bridgeRoomId ? 600 : 400,
        display: 'block'
      }
    }, c.sharedData.full_name || c.clientUserId), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        marginTop: 1
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 9.5,
        color: 'var(--tx-3)',
        fontFamily: 'var(--mono)'
      }
    }, Object.keys(c.sharedData).length, " fields"), c.transferable ? /*#__PURE__*/React.createElement(I, {
      n: "users",
      s: 8,
      c: "var(--teal)"
    }) : /*#__PURE__*/React.createElement(I, {
      n: "lock",
      s: 8,
      c: "var(--red)"
    }), !isPrimary && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 8,
        color: 'var(--gold)',
        fontFamily: 'var(--mono)'
      }
    }, (assignment?.primary || c.meta?.provider)?.split(':')[0]?.replace('@', ''))));
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '12px 10px',
      display: 'flex',
      flexDirection: 'column',
      gap: 4
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setDiscoverModal(true),
    className: "b-gho b-sm",
    style: {
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "search",
    s: 12
  }), "Find ", T?.client_term || 'Individual'), /*#__PURE__*/React.createElement("button", {
    onClick: () => loadCases(),
    className: "b-gho b-xs",
    style: {
      width: '100%'
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "search",
    s: 10
  }), "Refresh"))), /*#__PURE__*/React.createElement("div", {
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
    className: `app-main${sidebarCollapsed ? ' sidebar-collapsed-show' : ''}`,
    style: {
      flex: 1,
      overflow: 'auto',
      padding: 0,
      minWidth: 0,
      position: 'relative'
    }
  }, sidebarCollapsed && /*#__PURE__*/React.createElement("button", {
    className: "sidebar-toggle-btn",
    onClick: toggleSidebar,
    title: "Expand sidebar"
  }, /*#__PURE__*/React.createElement(I, { n: "chevronRight", s: 14 })), orgRoom && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '8px 20px',
      background: 'linear-gradient(var(--bg-1), var(--bg-1)), linear-gradient(var(--blue-dim), var(--blue-dim))',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      borderBottom: '1px solid rgba(91,156,245,.15)',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      minHeight: 40,
      position: 'sticky',
      top: 0,
      zIndex: 5
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "shieldCheck",
    s: 16,
    c: "var(--blue)"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 700,
      fontSize: 13.5,
      color: 'var(--blue)',
      fontFamily: 'var(--serif)'
    }
  }, orgMeta.name || 'Organization'), orgMeta.type && /*#__PURE__*/React.createElement("span", {
    className: "tag tag-teal",
    style: {
      fontSize: 8
    }
  }, ORG_TYPE_LABELS[orgMeta.type] || orgMeta.type), /*#__PURE__*/React.createElement("span", {
    className: "tag tag-blue",
    style: {
      fontSize: 8
    }
  }, activeOrgRoleLabels[orgRole] || orgRole), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), allOrgs.length > 1 && /*#__PURE__*/React.createElement("select", {
    value: orgRoom,
    onChange: e => switchOrg(e.target.value),
    style: {
      background: 'var(--bg-2)',
      color: 'var(--tx-0)',
      border: '1px solid var(--border-1)',
      borderRadius: 'var(--r)',
      padding: '4px 8px',
      fontSize: 11,
      fontFamily: 'var(--sans)',
      cursor: 'pointer',
      outline: 'none'
    }
  }, allOrgs.map(o => /*#__PURE__*/React.createElement("option", {
    key: o.roomId,
    value: o.roomId
  }, o.meta?.name || o.roomId)))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 24
    }
  }, view === 'dashboard' && !activeCase && /*#__PURE__*/React.createElement(React.Fragment, null,
    activeTeamObj && /*#__PURE__*/React.createElement("div", {
      style: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', marginBottom: 12, background: `hsla(${activeTeamObj.color_hue || 260}, 60%, 55%, 0.08)`, border: `1px solid hsla(${activeTeamObj.color_hue || 260}, 60%, 55%, 0.2)`, borderRadius: 'var(--r-lg)' }
    }, /*#__PURE__*/React.createElement(I, { n: "users", s: 14, c: `hsl(${activeTeamObj.color_hue || 260}, 60%, 55%)` }),
      /*#__PURE__*/React.createElement("span", { style: { fontSize: 12.5, fontWeight: 600 } }, "Viewing as: ", activeTeamObj.name),
      /*#__PURE__*/React.createElement("span", { style: { fontSize: 11, color: 'var(--tx-3)' } }, "\u00B7 ", (activeTeamObj.members || []).length, " members"),
      /*#__PURE__*/React.createElement("button", { onClick: () => switchTeamContext(null), className: "b-gho b-xs", style: { marginLeft: 'auto', fontSize: 10 } }, "Clear filter")
    ),
    /*#__PURE__*/React.createElement(DashboardOverview, {
      cases: activeTeamObj ? cases.filter(c => { const a = caseAssignments[c.bridgeRoomId]; return activeTeamMemberIds.includes(a?.primary || c.meta?.provider); }) : cases,
      clientRecords: teamFilteredClientRecords,
      staff: staff,
      T: T,
      notes: activeTeamObj ? dbNotes.filter(n => activeTeamMemberIds.includes(n.by || n.author)) : dbNotes,
      resourceTypes: resourceTypes,
      onGoToDatabase: () => {
        setView('database');
        setActiveCase(null);
      },
      onDiscover: () => setDiscoverModal(true),
      onCreateClient: openCreateClientModal
    })
  ), view === 'database' && !activeCase && /*#__PURE__*/React.createElement(React.Fragment, null,
    /*#__PURE__*/React.createElement(DatabaseView, {
    cases: teamFilteredCases,
    caseAssignments: caseAssignments,
    openCase: openCase,
    T: T,
    svc: svc,
    caseAllocations: caseAllocations,
    providerProfile: providerProfile,
    orgRoom: orgRoom,
    orgMeta: orgMeta,
    staff: staff,
    orgRole: orgRole,
    showToast: showToast,
    bridgeNotes: bridgeNotes,
    rosterNotes: rosterNotes,
    allAllocations: allAllocations,
    onCreateOrg: () => setCreateOrgModal(true),
    onEditProfile: openProfileModal,
    onDiscover: () => setDiscoverModal(true),
    myVerification: myVerification,
    emailVerifyConfig: emailVerifyConfig,
    openEmailVerifyModal: openEmailVerifyModal,
    orgChannels: orgChannels,
    ORG_TYPE_LABELS: ORG_TYPE_LABELS,
    ORG_ROLE_LABELS: activeOrgRoleLabels,
    notes: activeTeamObj ? dbNotes.filter(n => activeTeamMemberIds.includes(n.by || n.author)) : dbNotes,
    onNewNote: () => {
      setNewNoteAttachTo(null);
      setNewNoteModal(true);
    },
    onNoteClick: note => setNoteDetailModal(note),
    onOpenIndividual: row => {
      setActiveIndividual(row);
      setView('individual-profile');
    },
    onOpenResource: row => {
      setActiveResourceProfile(row);
      setView('resource-profile');
    },
    resourceTypes: resourceTypes,
    resourceRelations: resourceRelations,
    resourceInventory: resourceInventory,
    rosterRoom: rosterRoom,
    networkRoom: networkRoom,
    onCreateResource: () => {
      setResourceDraft({
        name: '',
        category: 'general',
        unit: 'unit',
        fungible: true,
        perishable: false,
        ttl_days: '',
        tags: '',
        infinite: false,
        initial_quantity: '',
        replenishes: false,
        replenish_cycle: '',
        permissions: buildDefaultResourcePermissions()
      });
      setCreateResourceModal(true);
    },
    onRefresh: () => loadResources(orgRoom, networkRoom, rosterRoom),
    onRestock: relation => {
      setRestockModal(relation);
      setRestockQty('');
      setRestockNote('');
    },
    onEstablishRelation: handleEstablishRelation,
    canViewResource: canViewResource,
    canControlResource: canControlResource,
    canAllocateResource: canAllocateResource,
    clientRecords: teamFilteredClientRecords,
    onCreateClient: openCreateClientModal,
    onCellEdit: handleDbCellEdit,
    onBulkAction: handleBulkAction,
    onReorder: handleReorder,
    onAddRow: openCreateClientModal,
    fieldDefs: fieldDefs,
    fieldCrosswalks: fieldCrosswalks,
    teams: teams,
    onSaveFieldDef: async def => {
      const schemaRoom = svc.client ? svc.client.getRooms().find(r => {
        const id = r.currentState.getStateEvents(EVT.IDENTITY, '');
        return id?.getContent()?.account_type === 'schema' && id.getContent().owner === svc.userId;
      })?.roomId : null;
      if (!schemaRoom) return;
      const updated = {
        ...fieldDefs,
        [def.uri]: def
      };
      await svc.setState(schemaRoom, EVT.FIELD_DEF, {
        definitions: updated
      });
      setFieldDefs(updated);
    },
    onSaveCrosswalk: async xw => {
      const schemaRoom = svc.client ? svc.client.getRooms().find(r => {
        const id = r.currentState.getStateEvents(EVT.IDENTITY, '');
        return id?.getContent()?.account_type === 'schema' && id.getContent().owner === svc.userId;
      })?.roomId : null;
      if (!schemaRoom) return;
      const updated = [...fieldCrosswalks, {
        ...xw,
        created_by: svc.userId
      }];
      await svc.setState(schemaRoom, EVT.FIELD_CROSSWALK, {
        crosswalks: updated
      });
      setFieldCrosswalks(updated);
    },
    fieldGovernanceConfig: fieldGovernanceConfig,
    onPropose: async (proposal, room) => { if (svc) await svc.setState(room, EVT.GOV_PROPOSAL, proposal, proposal.id); },
    teamMode: teamMode,
    activeTeamObj: activeTeamObj,
    sidebarCollapsed: sidebarCollapsed,
    linkedRecords: linkedRecords,
    onCreateLinkedRecord: (parentRecord) => setCreateLinkedRecordModal({ parentRecord }),
    onRemoveLinkedRecord: async (parentId, linkId) => {
      setLinkedRecords(prev => {
        const next = { ...prev };
        if (next[parentId]) next[parentId] = next[parentId].filter(l => l.id !== linkId);
        return next;
      });
      // Persist removal to Matrix
      const roomId = parentId;
      try {
        await emitOp(roomId, 'NUL', dot('org', 'linked_records', linkId), {
          link_id: linkId,
          edit_source: 'database_linked_record'
        }, { type: 'org', epistemic: 'MEANT', role: orgRole || 'provider' });
      } catch (e) { console.warn('Failed to emit unlink op:', e); }
      if (showToast) showToast('Linked record removed', 'info');
    },
    resourceTypes: resourceTypes,
    onCreateTable: team => setCreateTableModal({ teamId: team.roomId, teamName: team.name }),
    onOpenTable: (table, team) => setActiveCustomTable({ table, teamId: team.roomId }),
    trashedIndividuals: trashedIndividuals,
    onRestoreIndividual: handleRestoreIndividual,
    onRestoreField: async (row, fieldKey, pastValue) => {
      const currentValue = row.fields?.[fieldKey]?.value || row[fieldKey] || '';
      const roomId = row.bridgeRoom || row.id;
      try {
        // EO: ALT(org.individuals.{fieldKey}, {from: current, to: past, reason: 'history_restore'}) — field_restore
        await emitOp(roomId, 'ALT', dot('org', 'individuals', fieldKey), {
          from: currentValue,
          to: pastValue,
          reason: 'history_restore'
        }, { type: 'org', epistemic: 'MEANT', role: orgRole || 'provider' });
        // Persist via same path as handleDbCellEdit
        if (row._case) {
          const updatedData = { ...row._case.sharedData, [fieldKey]: pastValue };
          await svc.setState(roomId, EVT.BRIDGE_REFS, { fields: updatedData });
        } else if (row._clientRecord) {
          const updates = { ...row._clientRecord };
          if (fieldKey === 'name') updates.client_name = pastValue;
          await svc.setState(row.id, EVT.IDENTITY, updates);
        }
        showToast(`Field "${fieldKey.replace(/_/g,' ')}" restored`, 'success');
      } catch (e) {
        showToast('Restore failed: ' + e.message, 'error');
      }
    }
  }), /*#__PURE__*/React.createElement(NoteCreateModal, {
    open: newNoteModal,
    onClose: () => setNewNoteModal(false),
    individuals: cases.map(c => ({
      id: c.bridgeRoomId,
      name: c.sharedData.full_name || c.clientUserId || 'Unknown'
    })),
    staff: staff,
    svc: svc,
    rosterRoom: rosterRoom,
    onSave: handleNoteSave,
    showToast: showToast,
    T: T,
    initialAttachTo: newNoteAttachTo,
    teamContext: teamMode
  }), /*#__PURE__*/React.createElement(CreateLinkedRecordModal, {
    open: !!createLinkedRecordModal,
    onClose: () => setCreateLinkedRecordModal(null),
    parentRecord: createLinkedRecordModal?.parentRecord || null,
    individuals: cases.map(c => ({
      id: c.bridgeRoomId,
      name: c.sharedData?.full_name || c.clientUserId || 'Unknown',
      status: c.meta?.status === 'tombstoned' ? 'revoked' : c.sharedData?.full_name ? 'active' : 'imported'
    })).concat((teamFilteredClientRecords || []).filter(r => !cases.some(c => c.bridgeRoomId === r.roomId)).map(r => ({
      id: r.roomId,
      name: r.client_name || 'Unknown',
      status: r.status || 'created'
    }))),
    notes: dbNotes,
    resourceTypes: resourceTypes,
    cases: cases,
    svc: svc,
    orgRole: orgRole,
    orgRoom: orgRoom,
    teamMode: teamMode,
    activeTeamObj: activeTeamObj,
    showToast: showToast,
    linkedRecords: linkedRecords,
    onLinkCreated: async (parentId, linkRecord) => {
      // Update local state
      setLinkedRecords(prev => ({
        ...prev,
        [parentId]: [...(prev[parentId] || []), linkRecord]
      }));
      // Persist to Matrix via EO operation
      try {
        const roomId = parentId;
        await emitOp(roomId, 'INS', dot('org', 'linked_records', linkRecord.id), {
          ...linkRecord,
          edit_source: 'database_linked_record'
        }, { type: 'org', epistemic: 'MEANT', role: orgRole || 'provider' });
      } catch (e) { console.warn('Failed to emit linked record op:', e); }
    }
  }), /*#__PURE__*/React.createElement(NoteDetailModal, {
    note: noteDetailModal,
    open: !!noteDetailModal,
    onClose: () => setNoteDetailModal(null),
    onSave: handleNoteEdit,
    svc: svc,
    staff: staff,
    rosterRoom: rosterRoom,
    showToast: showToast,
    T: T
  })), view === 'individual-profile' && activeIndividual && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(IndividualProfilePage, {
    individual: activeIndividual,
    notes: dbNotes,
    allocations: allAllocations,
    onBack: () => {
      setView('database');
      setActiveIndividual(null);
    },
    onOpenCase: openCase,
    onAddNote: indId => {
      setNewNoteAttachTo(indId);
      setNewNoteModal(true);
    },
    svc: svc,
    T: T,
    showToast: showToast,
    resourceTypes: resourceTypes,
    resourceRelations: resourceRelations,
    resourceInventory: resourceInventory,
    orgRoom: orgRoom,
    orgRole: orgRole,
    canAllocateResource: canAllocateResource,
    onAllocate: handleProfileAllocate,
    fieldDefs: fieldDefs,
    onFieldEdit: handleDbCellEdit
  }), /*#__PURE__*/React.createElement(NoteCreateModal, {
    open: newNoteModal,
    onClose: () => setNewNoteModal(false),
    individuals: cases.map(c => ({
      id: c.bridgeRoomId,
      name: c.sharedData.full_name || c.clientUserId || 'Unknown'
    })),
    staff: staff,
    svc: svc,
    rosterRoom: rosterRoom,
    onSave: handleNoteSave,
    showToast: showToast,
    T: T,
    initialAttachTo: newNoteAttachTo,
    teamContext: teamMode
  })), view === 'resource-profile' && activeResourceProfile && /*#__PURE__*/React.createElement(ResourceProfilePage, {
    resource: activeResourceProfile,
    allocations: allAllocations,
    onBack: () => {
      setView('database');
      setActiveResourceProfile(null);
    },
    T: T
  }), view === 'inbox' && !activeCase && /*#__PURE__*/React.createElement("div", {
    className: "anim-up inbox-wrap"
  },
    activeTeamObj && /*#__PURE__*/React.createElement("div", {
      style: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', marginBottom: 12, background: `hsla(${activeTeamObj.color_hue || 260}, 60%, 55%, 0.08)`, border: `1px solid hsla(${activeTeamObj.color_hue || 260}, 60%, 55%, 0.2)`, borderRadius: 'var(--r-lg)' }
    }, /*#__PURE__*/React.createElement(I, { n: "users", s: 14, c: `hsl(${activeTeamObj.color_hue || 260}, 60%, 55%)` }),
      /*#__PURE__*/React.createElement("span", { style: { fontSize: 12.5, fontWeight: 600 } }, "Filtered to: ", activeTeamObj.name),
      /*#__PURE__*/React.createElement("button", { onClick: () => switchTeamContext(null), className: "b-gho b-xs", style: { marginLeft: 'auto', fontSize: 10 } }, "Clear filter")
    ),
    /*#__PURE__*/React.createElement("div", {
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
  }, "Encrypted conversations with ", T.client_term_plural.toLowerCase(), orgRoom ? ' and organizations' : '', " in one place."), /*#__PURE__*/React.createElement(StorageTransparencyBadge, {
    storageType: "matrix",
    roomId: inboxConvo,
    encrypted: true,
    encLabel: "Megolm E2EE",
    label: "Messages",
    extra: [{ label: 'Privacy model', value: 'Each conversation is a separate encrypted Matrix room (bridge). Direct messages are between you and one client. Org channels use opacity envelopes.' }, orgRoom ? { label: 'Org channel opacity', value: orgOpacity + ' \u2014 controls what receiving orgs see about message sender identity' } : null].filter(Boolean)
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setDiscoverModal(true),
    className: "b-gho b-sm",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "search",
    s: 14
  }), "Find ", T?.client_term || 'Individual'), orgRoom && hasOrgMsgPermission('read') && /*#__PURE__*/React.createElement("button", {
    onClick: () => setComposeOrgModal(true),
    className: "b-pri b-sm",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "plus",
    s: 14
  }), "New Channel"), allContacts.length > 0 && /*#__PURE__*/React.createElement("button", {
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
  }, `CONVERSATIONS (${teamFilteredCases.length + (orgRoom && hasOrgMsgPermission('read') ? orgChannels.length : 0) + teamFilteredTeamDMs.length})`), /*#__PURE__*/React.createElement("button", {
    onClick: () => setNewBucketModal(true),
    className: "b-gho",
    style: { display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', fontSize: 10.5 }
  }, /*#__PURE__*/React.createElement(I, { n: "plus", s: 10 }), "New Group")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflow: 'auto'
    }
  }, (() => {
    const { bucketSections, teamSections, otherConvos } = inboxGrouped;
    const totalCount = teamFilteredCases.length + (orgRoom && hasOrgMsgPermission('read') ? orgChannels.length : 0) + teamFilteredTeamDMs.length;
    if (totalCount === 0) return /*#__PURE__*/React.createElement("div", { style: { padding: '40px 16px', textAlign: 'center' } }, /*#__PURE__*/React.createElement(I, { n: "msg", s: 28, c: "var(--tx-3)" }), /*#__PURE__*/React.createElement("p", { style: { color: 'var(--tx-3)', fontSize: 11.5, marginTop: 10 } }, "No conversations yet"), /*#__PURE__*/React.createElement("p", { style: { color: 'var(--tx-3)', fontSize: 10.5, marginTop: 4 } }, T.client_term_plural, " must share a bridge, or create an org channel."));
    const convoTypeColor = t => t === 'case' ? 'teal' : t === 'channel' ? 'blue' : 'purple';
    const convoTypeLabel = t => t === 'case' ? 'Direct' : t === 'channel' ? 'Channel' : 'DM';
    const convoName = (type, data) => type === 'case' ? (data.sharedData.full_name || data.clientUserId) : type === 'channel' ? (() => { const pid = data.orgs?.find(o => o !== orgRoom); return data.org_names?.[pid] || pid?.slice(0, 20) || 'Organization'; })() : (data.peerName || data.peerId);
    const renderItem = convo => {
      const { type, id, data } = convo;
      const isActive = inboxConvo === id;
      const tc = convoTypeColor(type);
      const name = convoName(type, data);
      const inBucket = msgBuckets.some(b => b.roomIds.includes(id));
      return /*#__PURE__*/React.createElement("div", {
        key: id,
        onClick: () => openInboxConvo(id),
        style: { padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border-0)', background: isActive ? 'var(--bg-4)' : 'transparent', borderLeft: isActive ? `3px solid var(--${tc})` : '3px solid transparent', transition: 'all .15s' },
        onMouseEnter: e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-3)'; },
        onMouseLeave: e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }
      }, /*#__PURE__*/React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 8 } },
        /*#__PURE__*/React.createElement("div", {
          style: { width: 32, height: 32, borderRadius: '50%', background: `var(--${tc}-dim)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: `var(--${tc})`, border: `2px solid var(--${tc})`, flexShrink: 0 }
        }, /*#__PURE__*/React.createElement(I, { n: type === 'channel' ? 'users' : 'user', s: 14 })),
        /*#__PURE__*/React.createElement("div", { style: { flex: 1, minWidth: 0 } },
          /*#__PURE__*/React.createElement("span", { style: { fontSize: 12.5, fontWeight: isActive ? 700 : 500, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, name),
          /*#__PURE__*/React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 3, marginTop: 2, flexWrap: 'wrap' } },
            /*#__PURE__*/React.createElement("span", { style: { fontSize: 8, padding: '1px 5px', borderRadius: 10, background: `var(--${tc}-dim)`, color: `var(--${tc})`, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px' } }, convoTypeLabel(type)),
            type === 'case' && /*#__PURE__*/React.createElement("span", { className: svc.hasCrypto ? "tag tag-green" : "tag tag-gold", style: { fontSize: 7 } }, svc.hasCrypto && /*#__PURE__*/React.createElement(I, { n: "lock", s: 6 }), svc.hasCrypto ? "E2EE" : "No E2EE"),
            type === 'channel' && /*#__PURE__*/React.createElement("span", { className: `tag ${orgOpacity === 'opaque' ? 'tag-red' : orgOpacity === 'translucent' ? 'tag-gold' : 'tag-green'}`, style: { fontSize: 7 } }, orgOpacity),
            type === 'team_dm' && data.teamName && /*#__PURE__*/React.createElement("span", { style: { fontSize: 8, color: 'var(--tx-3)' } }, data.teamName)
          )
        ),
        msgBuckets.length > 0 && /*#__PURE__*/React.createElement("button", {
          onClick: e => { e.stopPropagation(); setAssignBucketTarget(assignBucketTarget === id ? null : id); },
          className: "b-gho", style: { padding: '2px 4px', opacity: .6, flexShrink: 0 }, title: "Move to group"
        }, /*#__PURE__*/React.createElement(I, { n: "more-horizontal", s: 11 }))
      ), assignBucketTarget === id && /*#__PURE__*/React.createElement("div", {
        style: { marginTop: 4, paddingLeft: 40, paddingBottom: 4, display: 'flex', flexDirection: 'column', gap: 2 }
      },
        /*#__PURE__*/React.createElement("span", { style: { fontSize: 9, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '.5px', padding: '2px 0' } }, "Move to group:"),
        ...msgBuckets.map(b => /*#__PURE__*/React.createElement("button", { key: b.id, onClick: e => { e.stopPropagation(); assignToBucket(id, b.id); }, className: "b-gho", style: { textAlign: 'left', fontSize: 10.5, padding: '2px 6px' } }, b.label)),
        inBucket && /*#__PURE__*/React.createElement("button", { onClick: e => { e.stopPropagation(); removeFromBuckets(id); }, className: "b-gho", style: { textAlign: 'left', fontSize: 10, padding: '2px 6px', color: 'var(--tx-3)' } }, "Remove from group")
      ));
    };
    const renderSection = (key, label, convos, iconName, iconColor, isCustom, bucketId) => convos.length === 0 ? null : /*#__PURE__*/React.createElement(React.Fragment, { key },
      /*#__PURE__*/React.createElement("div", { style: { padding: '6px 14px 4px', display: 'flex', alignItems: 'center', gap: 6, position: 'sticky', top: 0, background: 'var(--bg-1)', zIndex: 1, borderBottom: '1px solid var(--border-0)' } },
        iconName && /*#__PURE__*/React.createElement(I, { n: iconName, s: 11, c: iconColor }),
        /*#__PURE__*/React.createElement("span", { style: { fontSize: 9.5, fontWeight: 700, color: iconColor || 'var(--tx-2)', textTransform: 'uppercase', letterSpacing: '.5px', flex: 1 } }, label, " (", convos.length, ")"),
        isCustom && /*#__PURE__*/React.createElement("button", { onClick: e => { e.stopPropagation(); deleteMsgBucket(bucketId); }, className: "b-gho", style: { padding: '1px 4px', opacity: .5 }, title: "Delete group" }, /*#__PURE__*/React.createElement(I, { n: "x", s: 9 }))
      ),
      convos.map(renderItem)
    );
    const allSections = [
      ...bucketSections.map(s => renderSection(s.id, s.label, s.convos, "folder", "var(--gold)", true, s.id)),
      ...teamSections.map(s => renderSection(s.id, s.label, s.convos, "users", `hsl(${s.team?.color_hue || 260},55%,55%)`)),
      otherConvos.length > 0 ? renderSection('__other__', teamSections.length > 0 || bucketSections.length > 0 ? 'Other' : 'All', otherConvos, null, 'var(--tx-2)') : null
    ].filter(Boolean);
    return /*#__PURE__*/React.createElement(React.Fragment, null, ...allSections);
  })())), /*#__PURE__*/React.createElement("div", {
    className: "inbox-chat"
  }, inboxConvo ? (() => {
    const convoType = getInboxConvoType(inboxConvo);
    const convoName = getInboxConvoName(inboxConvo);
    const caseData = cases.find(c => c.bridgeRoomId === inboxConvo);
    const channelData = orgChannels.find(ch => ch.roomId === inboxConvo);
    const dmData = teamDMs.find(d => d.roomId === inboxConvo);
    const avatarColor = convoType === 'case' ? 'teal' : convoType === 'team_dm' ? 'purple' : 'blue';
    return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
      className: "inbox-chat-hdr"
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 32,
        height: 32,
        borderRadius: '50%',
        background: `var(--${avatarColor}-dim)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: `var(--${avatarColor})`,
        border: `2px solid var(--${avatarColor})`
      }
    }, /*#__PURE__*/React.createElement(I, {
      n: convoType === 'case' ? 'user' : convoType === 'team_dm' ? 'user' : 'users',
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
    }, convoName), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        flexWrap: 'wrap'
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: svc.hasCrypto ? "tag tag-green" : "tag tag-gold",
      style: {
        fontSize: 8
      }
    }, svc.hasCrypto && /*#__PURE__*/React.createElement(I, {
      n: "lock",
      s: 8
    }), svc.hasCrypto ? "E2EE" : "No E2EE"), convoType === 'case' && /*#__PURE__*/React.createElement(ConnectionBadges, {
      userType: "client",
      teamName: caseData ? (() => { const t = teams.find(t => (t.members || []).some(m => m.userId === caseData.clientUserId)); return t?.name || null; })() : null,
      teamColors: teamColorsList,
      size: "xs"
    }), convoType === 'case' && caseData && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 10,
        color: 'var(--tx-2)'
      }
    }, Object.keys(caseData.sharedData).length, " shared fields"), convoType === 'channel' && /*#__PURE__*/React.createElement("span", {
      className: `tag ${orgOpacity === 'opaque' ? 'tag-red' : orgOpacity === 'translucent' ? 'tag-gold' : 'tag-green'}`,
      style: {
        fontSize: 8
      }
    }, "OUTGOING: ", orgOpacity), convoType === 'team_dm' && dmData && /*#__PURE__*/React.createElement(ConnectionBadges, {
      userType: dmData.peerType || 'provider',
      orgName: dmData.orgName,
      teamName: dmData.teamName,
      teamColors: teamColorsList,
      size: "xs"
    }))), convoType === 'case' && /*#__PURE__*/React.createElement("button", {
      onClick: () => openCase(inboxConvo),
      className: "b-gho b-xs",
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 4
      }
    }, /*#__PURE__*/React.createElement(I, {
      n: "user",
      s: 11
    }), "View Profile"), convoType === 'channel' && /*#__PURE__*/React.createElement("button", {
      onClick: () => openChannel(inboxConvo),
      className: "b-gho b-xs",
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 4
      }
    }, /*#__PURE__*/React.createElement(I, {
      n: "msg",
      s: 11
    }), "Full Channel"), /*#__PURE__*/React.createElement("button", {
      onClick: () => loadInboxMessages(inboxConvo),
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
      const sender = convoType === 'channel' ? resolveMessageSender(msg) : {
        label: isOwn ? 'You' : T.client_term,
        isOwn
      };
      return /*#__PURE__*/React.createElement("div", {
        key: msg.id || i,
        style: {
          display: 'flex',
          flexDirection: 'column',
          alignItems: sender.isOwn ? 'flex-end' : 'flex-start',
          marginBottom: 4
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          maxWidth: '75%',
          padding: '10px 14px',
          borderRadius: sender.isOwn ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
          background: sender.isOwn ? 'var(--gold-dim)' : 'var(--bg-3)',
          border: `1px solid ${sender.isOwn ? 'rgba(201,163,82,.2)' : 'var(--border-0)'}`,
          transition: 'transform .1s'
        }
      }, /*#__PURE__*/React.createElement(ReplyQuote, { msg, allMessages: inboxMessages }), /*#__PURE__*/React.createElement("p", {
        style: {
          fontSize: 12.5,
          color: 'var(--tx-0)',
          lineHeight: 1.5,
          wordBreak: 'break-word'
        }
      }, getReplyBody(msg.content))), /*#__PURE__*/React.createElement("div", {
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
          color: sender.isOwn ? 'var(--gold)' : 'var(--teal)'
        }
      }, sender.isOwn ? 'You' + (sender.org ? ` (${sender.org})` : convoType === 'case' ? ` (${T.provider_term})` : '') : sender.label), /*#__PURE__*/React.createElement("span", {
        style: {
          fontFamily: 'var(--mono)',
          fontSize: 8,
          color: 'var(--tx-3)'
        }
      }, msg.ts ? new Date(msg.ts).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      }) : ''), /*#__PURE__*/React.createElement("button", {
        onClick: () => setInboxReplyTo({ id: msg.id, sender: msg.sender, body: getReplyBody(msg.content) }),
        style: { background: 'none', border: 'none', color: 'var(--tx-3)', cursor: 'pointer', fontSize: 9, fontFamily: 'var(--mono)', padding: '0 2px' }
      }, "\u21a9 reply")));
    })), /*#__PURE__*/React.createElement("div", {
      className: "inbox-compose"
    }, /*#__PURE__*/React.createElement(ReplyBanner, { replyTo: inboxReplyTo, onCancel: () => setInboxReplyTo(null) }), convoType === 'case' || convoType === 'team_dm' || hasOrgMsgPermission('respond') ? /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("input", {
      value: inboxMsgText,
      onChange: e => setInboxMsgText(e.target.value),
      placeholder: convoType === 'channel' ? `Message as ${orgOpacity === 'transparent' ? providerProfile.display_name || 'you' : orgOpacity === 'translucent' ? orgMeta.name || 'your org' : 'anonymous org'}...${svc.hasCrypto ? ' (E2EE)' : ''}` : (svc.hasCrypto ? 'Type a message (E2EE)...' : 'Type a message...'),
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
    }))) : /*#__PURE__*/React.createElement("div", {
      style: {
        padding: '10px 14px',
        background: 'var(--gold-dim)',
        borderRadius: 'var(--r)',
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement(I, {
      n: "lock",
      s: 13,
      c: "var(--gold)"
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11.5,
        color: 'var(--gold)'
      }
    }, "Your role (", orgRole, ") does not have permission to respond. Ask an organization admin to update your role to enable messaging."))));
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
      background: 'var(--gold-dim)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--gold)',
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
  }, T.provider_term, " Inbox"), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--tx-2)',
      fontSize: 12,
      maxWidth: 300,
      textAlign: 'center',
      lineHeight: 1.6
    }
  }, cases.length + orgChannels.length > 0 ? 'Select a conversation from the left to start chatting.' : `No conversations yet. ${T.client_term_plural} must share a bridge, or create an org channel.`))))), view === 'clients' && !activeCase && /*#__PURE__*/React.createElement("div", {
    className: "anim-up",
    style: {
      maxWidth: 960,
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
  }, T.client_term_plural), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--tx-1)',
      fontSize: 12.5,
      marginTop: 4
    }
  }, "Each ", T.client_term.toLowerCase(), " record is a private encrypted room. Invite ", T.client_term_plural.toLowerCase(), " to give them full control.")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setImportModal(true),
    className: "b-gho b-sm",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "upload",
    s: 14
  }), "Import Data"), teamFilteredClientRecords.length >= 2 && /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setDbMergeRecordA(null);
      setDbMergeRecordB(null);
      setDbMergeModal(true);
    },
    className: "b-gho b-sm",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "git-merge",
    s: 14
  }), "Merge Records"), /*#__PURE__*/React.createElement("button", {
    onClick: openCreateClientModal,
    className: "b-pri b-sm",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "plus",
    s: 14
  }), "New ", T.client_term))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))',
      gap: 10,
      marginBottom: 20
    }
  }, [{
    l: `Total ${T.client_term_plural}`,
    v: teamFilteredClientRecords.length,
    c: 'teal',
    i: 'users'
  }, {
    l: 'Imported',
    v: teamFilteredClientRecords.filter(r => r.imported).length,
    c: 'purple',
    i: 'upload'
  }, {
    l: 'Invited',
    v: teamFilteredClientRecords.filter(r => r.status === 'invited').length,
    c: 'gold',
    i: 'send'
  }, {
    l: 'Joined',
    v: teamFilteredClientRecords.filter(r => r.status === 'joined').length,
    c: 'green',
    i: 'check'
  }, {
    l: 'Claimed',
    v: teamFilteredClientRecords.filter(r => r.status === 'claimed').length,
    c: 'teal',
    i: 'shield'
  }, {
    l: 'Pending',
    v: teamFilteredClientRecords.filter(r => r.status === 'created' && !r.imported).length,
    c: 'orange',
    i: 'clock'
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
  })))))), teamFilteredClientRecords.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      textAlign: 'center',
      padding: '40px 20px',
      borderStyle: 'dashed'
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "users",
    s: 32
  }), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--tx-2)',
      marginTop: 10,
      fontSize: 13
    }
  }, "No ", T.client_term.toLowerCase(), " records yet"), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--tx-3)',
      fontSize: 11.5,
      marginTop: 4
    }
  }, "Click \"New ", T.client_term, "\" to create a record, or \"Import Data\" to upload a CSV/JSON. Each ", T.client_term.toLowerCase(), " gets their own encrypted room.")) : /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      padding: 0,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1.2fr',
      gap: 0,
      padding: '10px 16px',
      background: 'var(--bg-3)',
      borderBottom: '1px solid var(--border-1)'
    }
  }, ['NAME', 'MATRIX ID', 'STATUS', 'CREATED', 'ACTIONS'].map(h => /*#__PURE__*/React.createElement("span", {
    key: h,
    style: {
      fontSize: 10,
      fontFamily: 'var(--mono)',
      color: 'var(--tx-2)',
      letterSpacing: '.07em',
      fontWeight: 600
    }
  }, h))), teamFilteredClientRecords.map((rec, i) => {
    const statusColors = {
      created: 'orange',
      invited: 'gold',
      joined: 'green',
      claimed: 'teal'
    };
    const statusLabels = {
      created: 'Pending',
      invited: 'Invited',
      joined: 'Joined',
      claimed: 'Claimed'
    };
    return /*#__PURE__*/React.createElement("div", {
      key: rec.roomId,
      style: {
        display: 'grid',
        gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1.2fr',
        gap: 0,
        padding: '12px 16px',
        borderBottom: i < teamFilteredClientRecords.length - 1 ? '1px solid var(--border-0)' : 'none',
        alignItems: 'center',
        transition: 'background .15s'
      },
      onMouseEnter: e => e.currentTarget.style.background = 'var(--bg-3)',
      onMouseLeave: e => e.currentTarget.style.background = 'transparent'
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 6
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13,
        fontWeight: 600
      }
    }, rec.client_name), rec.imported && /*#__PURE__*/React.createElement("span", {
      className: "tag tag-purple",
      style: {
        fontSize: 8
      }
    }, /*#__PURE__*/React.createElement(I, {
      n: "lock",
      s: 8
    }), "Encrypted")), rec.notes && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 10,
        color: 'var(--tx-3)',
        display: 'block',
        marginTop: 2
      }
    }, rec.notes)), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--mono)',
        fontSize: 10.5,
        color: rec.client_matrix_id ? 'var(--tx-1)' : 'var(--tx-3)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
      }
    }, rec.client_matrix_id || '—'), /*#__PURE__*/React.createElement("span", {
      className: `tag tag-${statusColors[rec.status] || 'orange'}`,
      style: {
        fontSize: 9,
        justifySelf: 'start'
      }
    }, statusLabels[rec.status] || rec.status), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 10.5,
        color: 'var(--tx-2)',
        fontFamily: 'var(--mono)'
      }
    }, rec.created ? new Date(rec.created).toLocaleDateString() : '—'), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 4
      }
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => {
        setClientInviteModal(rec);
        setClientInviteMatrixId(rec.client_matrix_id || '');
        setCopiedField(null);
      },
      className: "b-gho b-xs",
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 3
      }
    }, /*#__PURE__*/React.createElement(I, {
      n: "userPlus",
      s: 11
    }), "Invite"), rec.status !== 'claimed' && /*#__PURE__*/React.createElement("button", {
      onClick: () => handleGenerateClaimCode(rec),
      className: "b-gho b-xs",
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 3
      }
    }, /*#__PURE__*/React.createElement(I, {
      n: "shieldCheck",
      s: 11
    }), "Code"), /*#__PURE__*/React.createElement("button", {
      onClick: () => openCase(rec.roomId),
      className: "b-gho b-xs",
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 3
      }
    }, /*#__PURE__*/React.createElement(I, {
      n: "chevR",
      s: 11
    }), "Open")));
  })), /*#__PURE__*/React.createElement("div", {
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
  }, T.client_term, " sovereignty:"), " When a ", T.client_term.toLowerCase(), " joins their room, they receive superadmin power level (100). When they claim the room, ownership transfers to them permanently. They can kick anyone \u2014 including you \u2014 from their room at any time. You cannot remove a joined or claimed ", T.client_term.toLowerCase(), "."))), view === 'teams' && !activeCase && !activeTeamDetail && /*#__PURE__*/React.createElement("div", {
    className: "anim-up",
    style: {
      maxWidth: 960,
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
  }, "Teams"), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--tx-1)',
      fontSize: 12.5,
      marginTop: 4
    }
  }, "Flexible groups of people for collaboration. Teams can span across organizations \u2014 anyone with a Matrix ID can be invited."), /*#__PURE__*/React.createElement(StorageTransparencyBadge, {
    storageType: "matrix",
    encrypted: true,
    encLabel: "Megolm E2EE",
    label: "Teams",
    extra: [{ label: 'Storage', value: 'Each team is a separate Matrix room. Team metadata, members, schema, and consent rules are stored as state events in that room. All team members can read the room; only the team owner/admin can modify it.' }, { label: 'Team rooms', value: teams.length + ' team room(s): ' + teams.map(t => t.name || 'Unnamed').join(', ') }]
  })), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setCreateTeamModal(true);
      setNewTeamName('');
      setNewTeamDesc('');
    },
    className: "b-pri b-sm",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "plus",
    s: 14
  }), "New Team")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))',
      gap: 10,
      marginBottom: 20
    }
  }, [{
    l: 'Total Teams',
    v: teams.length,
    c: 'purple',
    i: 'users'
  }, {
    l: 'My Teams',
    v: teams.filter(t => t.owner === svc.userId).length,
    c: 'gold',
    i: 'briefcase'
  }, {
    l: 'Total Members',
    v: teams.reduce((sum, t) => sum + (t.members?.length || 0), 0),
    c: 'teal',
    i: 'user'
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
  })))))), teams.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      textAlign: 'center',
      padding: '40px 20px',
      borderStyle: 'dashed'
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "users",
    s: 32
  }), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--tx-2)',
      marginTop: 10,
      fontSize: 13
    }
  }, "No teams yet"), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--tx-3)',
      fontSize: 11.5,
      marginTop: 4
    }
  }, "Create a team to collaborate with people across your organization or beyond.")) : /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))',
      gap: 10
    }
  }, teams.map(team => /*#__PURE__*/React.createElement("div", {
    key: team.roomId,
    className: "card",
    style: {
      padding: 0,
      overflow: 'hidden',
      cursor: 'pointer',
      borderLeft: team.color_hue != null ? `3px solid hsl(${team.color_hue}, 65%, 55%)` : undefined
    },
    onClick: () => { setActiveTeamDetail(team); setActiveTeamContext(team.roomId); try { localStorage.setItem('khora_active_team', team.roomId); } catch {} }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '14px 18px',
      borderBottom: team.color_hue != null ? `1px solid hsla(${team.color_hue}, 65%, 55%, 0.15)` : '1px solid var(--border-0)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 4
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      fontWeight: 700
    }
  }, team.name || 'Unnamed Team'), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 4
    }
  }, team.owner === svc.userId && /*#__PURE__*/React.createElement("span", {
    className: "tag tag-gold",
    style: {
      fontSize: 8
    }
  }, "LEAD"), team.org_name && /*#__PURE__*/React.createElement("span", {
    className: "tag tag-blue",
    style: {
      fontSize: 8
    }
  }, team.org_name), teamMode?.roomId === team.roomId && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 8,
      padding: '3px 10px',
      borderRadius: 14,
      fontWeight: 600,
      fontFamily: 'var(--mono)',
      letterSpacing: '.03em',
      background: `hsla(${team.color_hue || 260}, 65%, 55%, 0.10)`,
      color: `hsl(${team.color_hue || 260}, 65%, 55%)`
    }
  }, "ACTIVE"))), team.description && /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 11.5,
      color: 'var(--tx-2)',
      lineHeight: 1.5
    }
  }, team.description)), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '10px 18px'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      fontFamily: 'var(--mono)',
      color: 'var(--tx-3)',
      display: 'block',
      marginBottom: 6
    }
  }, "MEMBERS (", team.members?.length || 0, ")"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 3
    }
  }, (team.members || []).slice(0, 5).map((m, mi) => /*#__PURE__*/React.createElement("div", {
    key: mi,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 18,
      height: 18,
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
    s: 9
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: 'var(--tx-1)',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      flex: 1
    }
  }, m.display_name || m.userId), /*#__PURE__*/React.createElement("span", {
    className: `tag ${m.role === 'lead' ? 'tag-gold' : 'tag-blue'}`,
    style: {
      fontSize: 7.5
    }
  }, m.role?.toUpperCase()), m.sharing_consent === 'pending' && /*#__PURE__*/React.createElement("span", {
    className: "tag tag-gold",
    style: {
      fontSize: 7
    }
  }, "PENDING"), m.sharing_consent === 'withheld' && /*#__PURE__*/React.createElement("span", {
    className: "tag tag-red",
    style: {
      fontSize: 7
    }
  }, "WITHHELD"), m.sharing_consent === 'shared' && /*#__PURE__*/React.createElement("span", {
    className: "tag tag-green",
    style: {
      fontSize: 7
    }
  }, "SHARING"))), (team.members?.length || 0) > 5 && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      color: 'var(--tx-3)',
      fontStyle: 'italic'
    }
  }, "+", team.members.length - 5, " more"))), (() => {
    const myMembership = (team.members || []).find(m => m.userId === svc.userId);
    return myMembership && myMembership.sharing_consent === 'pending' ? /*#__PURE__*/React.createElement("div", {
      style: {
        padding: '10px 18px',
        background: 'var(--gold-dim)',
        borderTop: '1px solid rgba(218,165,32,.15)'
      }
    }, /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 11.5,
        color: 'var(--tx-1)',
        lineHeight: 1.6,
        marginBottom: 8
      }
    }, /*#__PURE__*/React.createElement("strong", null, "Content sharing decision required."), " Content about individuals served by this team will be shared with you by default. Would you like to withhold this content from being shared with you?"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 6
      }
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => setSharingConsentModal({
        team,
        memberId: svc.userId
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
    }), "Make My Choice"))) : null;
  })(), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '8px 18px 14px',
      display: 'flex',
      gap: 6,
      flexWrap: 'wrap'
    }
  }, team.owner === svc.userId && /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setTeamInviteModal(team);
      setTeamInviteUserId('');
    },
    className: "b-gho b-xs",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 3
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "userPlus",
    s: 11
  }), "Invite"), (() => {
    const myM = (team.members || []).find(m => m.userId === svc.userId);
    return myM && (myM.sharing_consent === 'shared' || myM.sharing_consent === 'withheld') ? /*#__PURE__*/React.createElement("button", {
      onClick: () => setSharingConsentModal({
        team,
        memberId: svc.userId
      }),
      className: "b-gho b-xs",
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 3
      }
    }, /*#__PURE__*/React.createElement(I, {
      n: "shield",
      s: 11
    }), "Change Sharing") : null;
  })(), /*#__PURE__*/React.createElement("button", {
    className: "b-gho b-xs",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 3
    },
    onClick: () => {
      if (navigator.clipboard) navigator.clipboard.writeText(team.roomId);
      showToast('Team room ID copied', 'success');
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "share",
    s: 11
  }), "Share ID"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      fontFamily: 'var(--mono)',
      color: 'var(--tx-3)',
      marginLeft: 'auto',
      display: 'flex',
      alignItems: 'center',
      gap: 3
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "grid",
    s: 9
  }), team.schema?.fields?.length || 0, " fields"))))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--purple-dim,var(--blue-dim))',
      border: '1px solid rgba(128,90,213,.15)',
      borderRadius: 'var(--r)',
      padding: '14px 18px',
      marginTop: 20,
      display: 'flex',
      gap: 10,
      alignItems: 'flex-start'
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "users",
    s: 16,
    c: "var(--purple,var(--blue))"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: 'var(--tx-1)',
      lineHeight: 1.6
    }
  }, /*#__PURE__*/React.createElement("strong", null, "Teams are flexible."), " They can include anyone \u2014 ", T.staff_term_plural.toLowerCase(), " from your org, people from other orgs, or unaffiliated individuals. Teams are now governed by their own schema \u2014 click a team to view and manage its data definitions."))), view === 'teams' && !activeCase && activeTeamDetail && /*#__PURE__*/React.createElement(TeamDetailView, {
    team: activeTeamDetail,
    teams: teams,
    svc: svc,
    fieldDefs: fieldDefs,
    fieldCrosswalks: fieldCrosswalks,
    showToast: showToast,
    teamMode: teamMode,
    onSwitchTeam: switchTeam,
    onBack: () => setActiveTeamDetail(null),
    onInvite: team => {
      setTeamInviteModal(team);
      setTeamInviteUserId('');
    },
    onUpdateTeam: updated => {
      setTeams(prev => prev.map(t => t.roomId === updated.roomId ? updated : t));
      setActiveTeamDetail(updated);
      setTeamMode(prev => prev && prev.roomId === updated.roomId ? { ...prev, name: updated.name, color_hue: updated.color_hue } : prev);
    },
    onSaveFieldDef: async def => {
      const schemaRoom = svc.client ? svc.client.getRooms().find(r => {
        const id = r.currentState.getStateEvents(EVT.IDENTITY, '');
        return id?.getContent()?.account_type === 'schema' && id.getContent().owner === svc.userId;
      })?.roomId : null;
      if (!schemaRoom) return;
      const updated = {
        ...fieldDefs,
        [def.uri]: def
      };
      await svc.setState(schemaRoom, EVT.FIELD_DEF, {
        definitions: updated
      });
      setFieldDefs(updated);
    },
    onSaveCrosswalk: async xw => {
      const schemaRoom = svc.client ? svc.client.getRooms().find(r => {
        const id = r.currentState.getStateEvents(EVT.IDENTITY, '');
        return id?.getContent()?.account_type === 'schema' && id.getContent().owner === svc.userId;
      })?.roomId : null;
      if (!schemaRoom) return;
      const updated = [...fieldCrosswalks, {
        ...xw,
        created_by: svc.userId
      }];
      await svc.setState(schemaRoom, EVT.FIELD_CROSSWALK, {
        crosswalks: updated
      });
      setFieldCrosswalks(updated);
    }
  }), view === 'case' && activeCaseData && /*#__PURE__*/React.createElement("div", {
    className: "anim-up",
    style: {
      maxWidth: 820,
      margin: '0 auto'
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setView('dashboard');
      setActiveCase(null);
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
  }), "All Cases"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", {
    style: {
      fontFamily: 'var(--serif)',
      fontSize: 20,
      fontWeight: 700
    }
  }, activeCaseData.sharedData.full_name || activeCaseData.clientUserId), /*#__PURE__*/React.createElement("div", {
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
  }), "Megolm + AES-GCM"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--mono)',
      fontSize: 9.5,
      color: 'var(--tx-3)'
    }
  }, "Client-owned bridge"), activeCaseData.transferable ? /*#__PURE__*/React.createElement("span", {
    className: "tag tag-teal"
  }, /*#__PURE__*/React.createElement(I, {
    n: "users",
    s: 9
  }), "Transferable") : /*#__PURE__*/React.createElement("span", {
    className: "tag tag-red"
  }, /*#__PURE__*/React.createElement(I, {
    n: "lock",
    s: 9
  }), "Transfer Locked")), /*#__PURE__*/React.createElement(StorageTransparencyBadge, {
    storageType: "matrix",
    roomId: activeCase,
    encrypted: true,
    encLabel: "Megolm E2EE + AES-256-GCM at rest",
    label: "Case / Bridge Room",
    members: [{ userId: activeCaseData.clientUserId, role: 'client (room owner)' }, { userId: activeCaseData.meta?.provider || svc.userId, role: 'provider' }, ...(activeCaseData.meta?.assigned_staff || []).filter(s => s !== activeCaseData.meta?.provider).map(s => ({ userId: s, role: 'assigned ' + T.staff_term.toLowerCase() }))],
    extra: [{ label: 'Ownership', value: 'The client owns this bridge room (power level 100). Shared data is encrypted and only visible to room members.' }, { label: 'Transfer status', value: activeCaseData.transferable ? 'Transferable \u2014 case can be reassigned to another ' + T.staff_term.toLowerCase() : 'Transfer locked \u2014 only the current provider can access' }]
  })), orgRoom && (orgRole === 'admin' || orgRole === 'case_manager') && staff.length > 1 && /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setTransferModal(activeCaseData);
      setTransferTarget('');
    },
    className: "b-gho b-sm",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 5
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "users",
    s: 12
  }), "Transfer")), (() => {
    const assignment = caseAssignments[activeCaseData.bridgeRoomId];
    if (!assignment || !orgRoom) return null;
    return /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 10,
        padding: '10px 14px',
        background: 'var(--bg-2)',
        border: '1px solid var(--border-0)',
        borderRadius: 'var(--r)',
        display: 'flex',
        alignItems: 'center',
        gap: 10
      }
    }, /*#__PURE__*/React.createElement(I, {
      n: "briefcase",
      s: 14,
      c: "var(--gold)"
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11.5,
        fontWeight: 600,
        display: 'block'
      }
    }, "Assigned to: ", assignment.primary?.split(':')[0]?.replace('@', '')), assignment.staff?.length > 1 && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 10,
        color: 'var(--tx-2)'
      }
    }, "+", assignment.staff.length - 1, " additional ", T.staff_term_plural.toLowerCase(), " with access"), assignment?.transferred_from && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 9.5,
        color: 'var(--tx-2)',
        fontFamily: 'var(--mono)',
        display: 'block',
        marginTop: 2
      }
    }, "Transferred from ", assignment.transferred_from.split(':')[0]?.replace('@', ''), assignment.transferred_at ? ` on ${new Date(assignment.transferred_at).toLocaleDateString()}` : '')), assignment.primary === svc.userId && /*#__PURE__*/React.createElement("span", {
      className: "tag tag-gold",
      style: {
        fontSize: 8
      }
    }, "YOU"));
  })()), /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "SHARED DATA \u2014 CLIENT CONTROLLED"), (() => {
    const allFwFields = getFrameworkFields(FRAMEWORK_FIELD_STANDARDS.map(fw => fw.id));
    const knownKeys = new Set([...VAULT_FIELDS.map(f => f.key), ...allFwFields.map(f => f.key)]);
    const fwFieldsByKey = {};
    allFwFields.forEach(f => {
      fwFieldsByKey[f.key] = f;
    });
    const customShared = Object.keys(activeCaseData.sharedData).filter(k => !knownKeys.has(k));
    const sharedFwFields = allFwFields.filter(f => activeCaseData.sharedData[f.key]);
    return /*#__PURE__*/React.createElement(React.Fragment, null, FIELD_CATEGORIES.map(cat => {
      const fields = VAULT_FIELDS.filter(f => f.category === cat && activeCaseData.sharedData[f.key]);
      if (!fields.length) return null;
      return /*#__PURE__*/React.createElement("div", {
        key: cat,
        style: {
          marginBottom: 10
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 6
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          color: `var(--${CAT_COLORS[cat]})`
        }
      }, /*#__PURE__*/React.createElement(I, {
        n: CAT_ICONS[cat],
        s: 12
      })), /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 10.5,
          fontFamily: 'var(--mono)',
          color: 'var(--tx-2)',
          letterSpacing: '.05em'
        }
      }, CAT_LABELS[cat].toUpperCase())), fields.map(f => {
        const provOpen = provenanceTarget?.entityKey === f.key && provenanceTarget?.roomId === activeCase;
        return /*#__PURE__*/React.createElement(React.Fragment, {
          key: f.key
        }, /*#__PURE__*/React.createElement("div", {
          style: {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '6px 0',
            borderBottom: '1px solid var(--border-0)'
          }
        }, /*#__PURE__*/React.createElement("span", {
          style: {
            fontSize: 12,
            color: 'var(--tx-1)'
          }
        }, f.label), /*#__PURE__*/React.createElement("div", {
          style: {
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }
        }, /*#__PURE__*/React.createElement("span", {
          style: {
            fontSize: 12.5,
            fontWeight: 500,
            maxWidth: 220,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }
        }, activeCaseData.sharedData[f.key]), /*#__PURE__*/React.createElement("span", {
          onClick: () => setProvenanceTarget(provOpen ? null : {
            entityKey: f.key,
            label: f.label,
            roomId: activeCase
          }),
          style: {
            cursor: 'pointer',
            color: provOpen ? 'var(--teal)' : 'var(--tx-3)',
            transition: 'color .15s',
            flexShrink: 0
          },
          title: "View provenance"
        }, /*#__PURE__*/React.createElement(I, {
          n: "git-commit",
          s: 11
        })))), provOpen && /*#__PURE__*/React.createElement("div", {
          style: {
            padding: '4px 0 8px'
          }
        }, /*#__PURE__*/React.createElement(RecordProvenance, {
          roomId: activeCase,
          entityKey: f.key,
          label: f.label,
          session: session
        })));
      }));
    }), sharedFwFields.length > 0 && /*#__PURE__*/React.createElement("div", {
      style: {
        marginBottom: 10
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        marginBottom: 6
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--blue)'
      }
    }, /*#__PURE__*/React.createElement(I, {
      n: "grid",
      s: 12
    })), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 10.5,
        fontFamily: 'var(--mono)',
        color: 'var(--tx-2)',
        letterSpacing: '.05em'
      }
    }, "FRAMEWORK FIELDS")), sharedFwFields.map(f => /*#__PURE__*/React.createElement("div", {
      key: f.key,
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '6px 0',
        borderBottom: '1px solid var(--border-0)'
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
        color: 'var(--tx-1)'
      }
    }, f.label), /*#__PURE__*/React.createElement("span", {
      className: `tag tag-${FRAMEWORK_BY_ID[f.framework]?.accent || 'blue'}`,
      style: {
        fontSize: 7.5,
        padding: '1px 5px'
      }
    }, f.frameworkName)), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12.5,
        fontWeight: 500,
        maxWidth: 220,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
      }
    }, activeCaseData.sharedData[f.key])))), customShared.length > 0 && /*#__PURE__*/React.createElement("div", {
      style: {
        marginBottom: 10
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        marginBottom: 6
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--purple)'
      }
    }, /*#__PURE__*/React.createElement(I, {
      n: "file",
      s: 12
    })), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 10.5,
        fontFamily: 'var(--mono)',
        color: 'var(--tx-2)',
        letterSpacing: '.05em'
      }
    }, "CLIENT CUSTOM FIELDS")), customShared.map(k => /*#__PURE__*/React.createElement("div", {
      key: k,
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        padding: '6px 0',
        borderBottom: '1px solid var(--border-0)'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12,
        color: 'var(--tx-1)'
      }
    }, k.replace(/^custom_/, '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12.5,
        fontWeight: 500,
        maxWidth: 260,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
      }
    }, activeCaseData.sharedData[k])))));
  })(), Object.keys(activeCaseData.sharedData).length === 0 && /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--tx-3)',
      fontSize: 12,
      padding: '10px 0'
    }
  }, "No fields shared yet")), provObservations.filter(obs => {
    const prompt = [...DEFAULT_PROMPTS, ...DEFAULT_PROVIDER_PROMPTS].find(p => p.id === obs.prompt_id || p.key === obs.prompt_key);
    return prompt && FRAMEWORK_BINDINGS[prompt.key]?.bindings?.[obs.value];
  }).length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 16
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
  }, "GIVEN / MEANT Divide"), /*#__PURE__*/React.createElement("span", {
    className: "gm-sup-badge"
  }, "SUP")), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 11,
      color: 'var(--tx-2)',
      marginBottom: 10
    }
  }, "Same observations, different institutional meanings. Each framework interprets the data according to its own rules."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, provObservations.filter(obs => {
    const prompt = [...DEFAULT_PROMPTS, ...DEFAULT_PROVIDER_PROMPTS].find(p => p.id === obs.prompt_id || p.key === obs.prompt_key);
    return prompt && FRAMEWORK_BINDINGS[prompt.key]?.bindings?.[obs.value];
  }).map((obs, i) => {
    const prompt = [...DEFAULT_PROMPTS, ...DEFAULT_PROVIDER_PROMPTS].find(p => p.id === obs.prompt_id || p.key === obs.prompt_key);
    return /*#__PURE__*/React.createElement(RecordGivenMeant, {
      key: obs.id || i,
      promptKey: prompt.key,
      value: obs.value,
      reporter: obs.author ? `${T.provider_term}: ${obs.author}` : `${T.provider_term} observation`,
      timestamp: obs.ts
    });
  }))), /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label",
    style: {
      marginBottom: 0
    }
  }, T.provider_term.toUpperCase(), " OBSERVATIONS (MEANT)"), /*#__PURE__*/React.createElement("span", {
    className: "tag tag-gold"
  }, "EPISTEMIC: MEANT")), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 11,
      color: 'var(--tx-2)',
      marginBottom: 10
    }
  }, "Structured assessments and case management observations. Each entry is an EO event in the bridge room with full provenance."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))',
      gap: 6,
      marginBottom: 12
    }
  }, DEFAULT_PROVIDER_PROMPTS.map(p => /*#__PURE__*/React.createElement("div", {
    key: p.id,
    className: "card-h",
    onClick: () => {
      setProvObsModal(p);
      setProvObsValue('');
      setProvObsNotes('');
    },
    style: {
      padding: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      marginBottom: 4,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: `tag tag-${OBS_CAT_COLORS[p.category] || 'purple'}`,
    style: {
      fontSize: 8.5
    }
  }, p.category), p.maturity && /*#__PURE__*/React.createElement(MaturityBadge, {
    maturity: p.maturity
  }), p.source && /*#__PURE__*/React.createElement(SourceBadge, {
    source: p.source
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11.5,
      fontWeight: 600,
      display: 'block'
    }
  }, p.question)))), provObservations.length > 0 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "RECORDED (", provObservations.length, ")"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 3,
      marginTop: 4
    }
  }, [...provObservations].reverse().map((obs, i) => {
    const prompt = DEFAULT_PROVIDER_PROMPTS.find(p => p.id === obs.prompt_id || p.key === obs.prompt_key);
    const optLabel = prompt?.options?.find(o => o.v === obs.value)?.l || obs.value;
    const obsProvKey = obs.prompt_key || prompt?.key || obs.prompt_id;
    const obsProvOpen = provenanceTarget?.entityKey === obsProvKey && provenanceTarget?.roomId === activeCase && provenanceTarget?._obsId === obs.id;
    return /*#__PURE__*/React.createElement(React.Fragment, {
      key: obs.id || i
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        padding: '8px 12px',
        background: 'var(--bg-3)',
        borderRadius: 'var(--r)',
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: `tag tag-${OBS_CAT_COLORS[prompt?.category] || 'purple'}`,
      style: {
        fontSize: 8.5
      }
    }, prompt?.category || 'obs'), /*#__PURE__*/React.createElement("span", {
      className: "tag tag-gold",
      style: {
        fontSize: 8
      }
    }, "MEANT"), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11.5,
        flex: 1
      }
    }, prompt?.question, ": ", /*#__PURE__*/React.createElement("strong", null, optLabel)), obs.created_by && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 8.5,
        color: 'var(--tx-3)',
        fontFamily: 'var(--mono)'
      },
      title: obs.created_by
    }, obs.created_by.split(':')[0]?.slice(1)), obs.origin_server && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 8,
        color: 'var(--tx-3)',
        fontFamily: 'var(--mono)'
      }
    }, obs.origin_server), obs.notes && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 10,
        color: 'var(--tx-2)',
        fontStyle: 'italic'
      }
    }, obs.notes), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 9,
        color: 'var(--tx-3)',
        fontFamily: 'var(--mono)'
      }
    }, obs.ts ? new Date(obs.ts).toLocaleTimeString() : ''), /*#__PURE__*/React.createElement("span", {
      onClick: () => setProvenanceTarget(obsProvOpen ? null : {
        entityKey: obsProvKey,
        label: `Observation: ${prompt?.category || 'obs'}`,
        roomId: activeCase,
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
      s: 10
    }))), obsProvOpen && /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 2,
        marginBottom: 4
      }
    }, /*#__PURE__*/React.createElement(RecordProvenance, {
      roomId: activeCase,
      entityKey: obsProvKey,
      label: `Observation: ${prompt?.category || 'obs'}`,
      session: session
    })));
  })))), /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label",
    style: {
      marginBottom: 0
    }
  }, "RESOURCES"), orgRoom && resourceTypes.length > 0 && /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setAllocDraft({
        resource_type_id: resourceTypes[0]?.id || '',
        quantity: 1,
        notes: ''
      });
      setAllocModal(true);
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
  }), "Allocate")), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 11,
      color: 'var(--tx-2)',
      marginBottom: 10
    }
  }, "Resources allocated to this ", T.client_term.toLowerCase(), " through this bridge. Each allocation is an EO event with full provenance."), caseAllocations.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      padding: '16px 0',
      color: 'var(--tx-3)',
      fontSize: 12
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "layers",
    s: 20
  }), /*#__PURE__*/React.createElement("p", {
    style: {
      marginTop: 6
    }
  }, "No resources allocated yet")) : /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6
    }
  }, [...caseAllocations].sort((a, b) => (b.allocated_at || 0) - (a.allocated_at || 0)).map(alloc => {
    const rt = resourceTypes.find(t => t.id === alloc.resource_type_id);
    const statusColors = {
      active: 'teal',
      consumed: 'blue',
      expired: 'orange',
      revoked: 'red'
    };
    const allocProvOpen = provenanceTarget?.entityKey === alloc.id && provenanceTarget?.roomId === activeCase;
    return /*#__PURE__*/React.createElement(React.Fragment, {
      key: alloc.id
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        padding: '10px 14px',
        background: 'var(--bg-3)',
        borderRadius: 'var(--r)',
        border: '1px solid var(--border-0)'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 4
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 6
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13,
        fontWeight: 600
      }
    }, rt?.name || alloc.resource_type_id), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11,
        color: 'var(--tx-2)',
        fontFamily: 'var(--mono)'
      }
    }, "x", alloc.quantity, " ", alloc.unit || rt?.unit || '')), /*#__PURE__*/React.createElement("div", {
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
    }, alloc.status?.toUpperCase()), /*#__PURE__*/React.createElement("span", {
      onClick: () => setProvenanceTarget(allocProvOpen ? null : {
        entityKey: alloc.id,
        label: `Resource: ${rt?.name || alloc.resource_type_id}`,
        roomId: activeCase
      }),
      style: {
        cursor: 'pointer',
        color: allocProvOpen ? 'var(--teal)' : 'var(--tx-3)',
        transition: 'color .15s'
      },
      title: "View provenance"
    }, /*#__PURE__*/React.createElement(I, {
      n: "git-commit",
      s: 11
    })))), alloc.created_by && /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        marginBottom: 4
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 9,
        color: 'var(--tx-3)',
        fontFamily: 'var(--mono)'
      },
      title: alloc.created_by
    }, "Allocated by: ", alloc.created_by.split(':')[0]?.slice(1)), alloc.origin_server && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 8.5,
        color: 'var(--tx-3)',
        fontFamily: 'var(--mono)'
      }
    }, alloc.origin_server)), alloc.notes && /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 11,
        color: 'var(--tx-2)',
        marginBottom: 4,
        fontStyle: 'italic'
      }
    }, alloc.notes), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 9.5,
        color: 'var(--tx-3)',
        fontFamily: 'var(--mono)'
      }
    }, alloc.allocated_at ? new Date(alloc.allocated_at).toLocaleDateString() : '', alloc.expires_at ? ` · expires ${new Date(alloc.expires_at).toLocaleDateString()}` : ''), alloc.status === 'active' && /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 4
      }
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => handleResourceLifecycle(alloc.id, 'consumed'),
      className: "b-gho b-xs",
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 3
      }
    }, /*#__PURE__*/React.createElement(I, {
      n: "check",
      s: 10
    }), "Used"), /*#__PURE__*/React.createElement("button", {
      onClick: () => handleResourceLifecycle(alloc.id, 'returned'),
      className: "b-gho b-xs",
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 3
      }
    }, /*#__PURE__*/React.createElement(I, {
      n: "refresh-cw",
      s: 10
    }), "Return"), /*#__PURE__*/React.createElement("button", {
      onClick: () => handleResourceLifecycle(alloc.id, 'revoked'),
      className: "b-gho b-xs",
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 3,
        color: 'var(--red)'
      }
    }, /*#__PURE__*/React.createElement(I, {
      n: "x",
      s: 10
    }), "Revoke")))), allocProvOpen && /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 2,
        marginBottom: 4
      }
    }, /*#__PURE__*/React.createElement(RecordProvenance, {
      roomId: activeCase,
      entityKey: alloc.id,
      label: `Resource: ${rt?.name || alloc.resource_type_id}`,
      session: session
    })));
  }))), /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "REQUEST INFORMATION"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("input", {
    value: requestText,
    onChange: e => setRequestText(e.target.value),
    placeholder: "e.g. Could you share employment docs?",
    onKeyDown: e => {
      if (e.key === 'Enter') handleSendRequest();
    }
  }), /*#__PURE__*/React.createElement("button", {
    onClick: handleSendRequest,
    className: "b-pri",
    style: {
      whiteSpace: 'nowrap'
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "send",
    s: 12
  }), "Request"))), /*#__PURE__*/React.createElement("div", {
    className: "card"
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "MESSAGES"), /*#__PURE__*/React.createElement("div", {
    style: {
      maxHeight: 260,
      overflow: 'auto',
      marginBottom: 12
    }
  }, messages.length === 0 ? /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--tx-3)',
      fontSize: 12,
      padding: '12px 0',
      textAlign: 'center'
    }
  }, "No messages") : messages.map((msg, i) => /*#__PURE__*/React.createElement("div", {
    key: msg.id || i,
    style: {
      padding: '8px 0',
      borderBottom: '1px solid var(--border-0)'
    }
  }, /*#__PURE__*/React.createElement(ReplyQuote, { msg, allMessages: messages }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      marginBottom: 3
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--mono)',
      fontSize: 10,
      color: msg.sender === svc.userId ? 'var(--gold)' : 'var(--teal)'
    }
  }, msg.sender === svc.userId ? `You (${T.provider_term})` : T.client_term), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--mono)',
      fontSize: 9,
      color: 'var(--tx-3)'
    }
  }, msg.ts ? new Date(msg.ts).toLocaleString() : ''), /*#__PURE__*/React.createElement("button", {
    onClick: () => setCaseReplyTo({ id: msg.id, sender: msg.sender, body: getReplyBody(msg.content) }),
    style: { background: 'none', border: 'none', color: 'var(--tx-3)', cursor: 'pointer', fontSize: 9, fontFamily: 'var(--mono)', padding: '0 2px' }
  }, "\u21a9 reply")), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12.5,
      color: 'var(--tx-1)'
    }
  }, getReplyBody(msg.content))))), /*#__PURE__*/React.createElement(ReplyBanner, { replyTo: caseReplyTo, onCancel: () => setCaseReplyTo(null) }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("input", {
    value: msgText,
    onChange: e => setMsgText(e.target.value),
    placeholder: svc.hasCrypto ? "Message (E2EE)..." : "Message...",
    onKeyDown: e => {
      if (e.key === 'Enter' && !e.shiftKey) handleSendMsg();
    },
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("button", {
    onClick: handleSendMsg,
    className: "b-pri"
  }, /*#__PURE__*/React.createElement(I, {
    n: "send",
    s: 13
  }))))), view === 'hierarchy' && /*#__PURE__*/React.createElement("div", {
    className: "anim-up",
    style: {
      maxWidth: 820,
      margin: '0 auto'
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      fontFamily: 'var(--serif)',
      fontSize: 22,
      fontWeight: 700,
      marginBottom: 4
    }
  }, "My Network"), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--tx-1)',
      fontSize: 12.5,
      marginBottom: 20
    }
  }, "Teams and organizations you\u2019re part of, shown as a hierarchy."), (() => {
    /* ─── Build hierarchy tree ─── */
    const rootTeams = teams.filter(t => !t.hierarchy?.parent_team_id);
    const renderTeamNode = (team, depth) => {
      const children = (team.hierarchy?.child_teams || []).map(c => teams.find(t => t.roomId === c.roomId)).filter(Boolean);
      const govMode = TEAM_CONSENT_MODES[team.schemaRule?.consent_mode || team.governance || 'lead_decides'] || TEAM_CONSENT_MODES.lead_decides;
      const teamColor = `hsl(${team.color_hue || 260}, 60%, 55%)`;
      return /*#__PURE__*/React.createElement("div", { key: team.roomId, style: { marginLeft: depth * 20 } },
        /*#__PURE__*/React.createElement("div", {
          style: {
            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
            borderRadius: 'var(--r)', cursor: 'pointer', transition: 'background .15s',
            borderLeft: `3px solid ${teamColor}`, marginBottom: 4, background: 'var(--bg-2)'
          },
          onClick: () => { switchTeamContext(team.roomId); setView('teams'); setActiveTeamDetail(team); },
          onMouseEnter: e => { e.currentTarget.style.background = 'var(--bg-3)'; },
          onMouseLeave: e => { e.currentTarget.style.background = 'var(--bg-2)'; }
        },
          /*#__PURE__*/React.createElement("span", { style: { width: 8, height: 8, borderRadius: '50%', background: teamColor, flexShrink: 0 } }),
          /*#__PURE__*/React.createElement("div", { style: { flex: 1, minWidth: 0 } },
            /*#__PURE__*/React.createElement("div", { style: { fontWeight: 600, fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, team.name || 'Unnamed Team'),
            /*#__PURE__*/React.createElement("div", { style: { fontSize: 10.5, color: 'var(--tx-2)', marginTop: 1, display: 'flex', gap: 8, flexWrap: 'wrap' } },
              /*#__PURE__*/React.createElement("span", null, (team.members || []).length, " member", (team.members || []).length !== 1 ? "s" : ""),
              (team.customTables || []).filter(t => t.status === 'active').length > 0 && /*#__PURE__*/React.createElement("span", null, (team.customTables || []).filter(t => t.status === 'active').length, " table", (team.customTables || []).filter(t => t.status === 'active').length !== 1 ? "s" : ""),
              children.length > 0 && /*#__PURE__*/React.createElement("span", null, children.length, " sub-team", children.length !== 1 ? "s" : "")
            )
          ),
          /*#__PURE__*/React.createElement("span", {
            className: `tag tag-${govMode.color}`,
            style: { fontSize: 8, flexShrink: 0 }
          }, /*#__PURE__*/React.createElement(I, { n: govMode.icon, s: 8 }), govMode.label)
        ),
        children.length > 0 && children.map(c => renderTeamNode(c, depth + 1))
      );
    };
    return /*#__PURE__*/React.createElement(React.Fragment, null,
      /* ─── Network level ─── */
      networkRoom && /*#__PURE__*/React.createElement("div", { className: "card", style: { marginBottom: 12 } },
        /*#__PURE__*/React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 } },
          /*#__PURE__*/React.createElement(I, { n: "globe", s: 16, c: "var(--blue)" }),
          /*#__PURE__*/React.createElement("span", { className: "section-label", style: { marginBottom: 0 } }, "NETWORK")
        ),
        networkMembers.length > 0 ? networkMembers.map((nm, i) => {
          const isOwnOrg = orgMeta && (nm.name === orgMeta.name || nm.id === orgRoom);
          return /*#__PURE__*/React.createElement("div", {
            key: nm.id || i,
            style: {
              display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', marginLeft: 20,
              borderLeft: '2px solid var(--border-1)', marginBottom: 2,
              borderRadius: '0 var(--r) var(--r) 0', background: isOwnOrg ? 'var(--blue-dim)' : 'transparent'
            }
          },
            /*#__PURE__*/React.createElement(I, { n: "briefcase", s: 12, c: isOwnOrg ? "var(--blue)" : "var(--tx-2)" }),
            /*#__PURE__*/React.createElement("span", { style: { fontSize: 12, fontWeight: isOwnOrg ? 600 : 400, flex: 1 } }, nm.name || nm.id || 'Unknown Org'),
            isOwnOrg && /*#__PURE__*/React.createElement("span", { className: "tag tag-blue", style: { fontSize: 8 } }, "YOU"),
            nm.role && nm.role !== 'member' && /*#__PURE__*/React.createElement("span", { className: "tag tag-gold", style: { fontSize: 8 } }, nm.role.toUpperCase())
          );
        }) : /*#__PURE__*/React.createElement("p", { style: { fontSize: 11, color: 'var(--tx-3)', marginLeft: 20, fontStyle: 'italic' } }, "No member organizations yet")
      ),
      /* ─── Organization level ─── */
      orgRoom && /*#__PURE__*/React.createElement("div", { className: "card", style: { marginBottom: 12 } },
        /*#__PURE__*/React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 } },
          /*#__PURE__*/React.createElement(I, { n: "briefcase", s: 16, c: "var(--gold)" }),
          /*#__PURE__*/React.createElement("span", { className: "section-label", style: { marginBottom: 0 } }, "ORGANIZATION"),
          /*#__PURE__*/React.createElement("span", { style: { fontSize: 12.5, fontWeight: 600, marginLeft: 4 } }, orgMeta?.name || 'My Organization')
        ),
        /*#__PURE__*/React.createElement("div", { style: { display: 'flex', gap: 10, marginBottom: 10, marginLeft: 24 } },
          /*#__PURE__*/React.createElement("span", { style: { fontSize: 11, color: 'var(--tx-2)' } }, (orgStaff || []).length, " staff member", (orgStaff || []).length !== 1 ? "s" : ""),
          teams.length > 0 && /*#__PURE__*/React.createElement("span", { style: { fontSize: 11, color: 'var(--tx-2)' } }, teams.length, " team", teams.length !== 1 ? "s" : ""),
          networkRoom && /*#__PURE__*/React.createElement("span", { style: { fontSize: 11, color: 'var(--tx-2)' } }, /*#__PURE__*/React.createElement(I, { n: "globe", s: 10 }), " In network")
        ),
        /* ─── Teams nested under org ─── */
        rootTeams.length > 0 ? /*#__PURE__*/React.createElement("div", { style: { marginLeft: 4 } },
          /*#__PURE__*/React.createElement("span", { className: "section-label", style: { fontSize: 9, marginBottom: 6, display: 'block', marginLeft: 20 } }, "TEAMS"),
          rootTeams.map(t => renderTeamNode(t, 1))
        ) : /*#__PURE__*/React.createElement("p", { style: { fontSize: 11, color: 'var(--tx-3)', marginLeft: 24, fontStyle: 'italic' } }, "No teams yet \u2014 create one from the Teams view")
      ),
      /* ─── No org fallback: just teams ─── */
      !orgRoom && /*#__PURE__*/React.createElement("div", { className: "card", style: { marginBottom: 12 } },
        /*#__PURE__*/React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 } },
          /*#__PURE__*/React.createElement(I, { n: "users", s: 16, c: "var(--gold)" }),
          /*#__PURE__*/React.createElement("span", { className: "section-label", style: { marginBottom: 0 } }, "YOUR TEAMS")
        ),
        rootTeams.length > 0 ? rootTeams.map(t => renderTeamNode(t, 0))
          : /*#__PURE__*/React.createElement("div", { style: { textAlign: 'center', padding: '20px', borderStyle: 'dashed', border: '1px dashed var(--border-1)', borderRadius: 'var(--r)' } },
            /*#__PURE__*/React.createElement(I, { n: "users", s: 28 }),
            /*#__PURE__*/React.createElement("p", { style: { color: 'var(--tx-3)', marginTop: 8 } }, "No teams yet. Create or join a team to see your hierarchy here.")
          )
      )
    );
  })()), view === 'schema' && /*#__PURE__*/React.createElement(SchemaWorkbench, {
    isOrg: !!orgRoom,
    orgMeta: orgMeta,
    networkMembers: networkMembers,
    fieldDefs: fieldDefs,
    catLabels: CAT_LABELS,
    catColors: CAT_COLORS,
    onSaveFieldDef: async def => {
      const schemaRoom = svc.client ? svc.client.getRooms().find(r => {
        const id = r.currentState.getStateEvents(EVT.IDENTITY, '');
        return id?.getContent()?.account_type === 'schema' && id.getContent().owner === svc.userId;
      })?.roomId : null;
      if (!schemaRoom) return;
      const updated = { ...fieldDefs, [def.uri]: def };
      await svc.setState(schemaRoom, EVT.FIELD_DEF, { definitions: updated });
      setFieldDefs(updated);
    }
  }), view === 'org-settings' && orgRoom && orgRole === 'admin' && /*#__PURE__*/React.createElement("div", {
    className: "anim-up",
    style: {
      maxWidth: 820,
      margin: '0 auto'
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      fontFamily: 'var(--serif)',
      fontSize: 22,
      fontWeight: 700,
      marginBottom: 4
    }
  }, "Organization Settings"), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--tx-1)',
      fontSize: 12.5,
      marginBottom: 24
    }
  }, "Manage your organization metadata, privacy, and inter-org messaging configuration."), /*#__PURE__*/React.createElement(StorageTransparencyBadge, {
    storageType: "matrix",
    roomId: orgRoom,
    encrypted: true,
    encLabel: "Megolm E2EE",
    label: "Org Settings",
    members: staff.map(s => ({ userId: s.userId, role: s.role })),
    extra: [{ label: 'Org room', value: 'Organization metadata, roster, opacity settings, terminology, and email verification config are stored as state events in this shared org room.' }, { label: 'Access', value: 'All org ' + T.staff_term_plural.toLowerCase() + ' can read. Only admins can modify settings.' }]
  }), /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "ORGANIZATION DETAILS"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 12,
      marginTop: 8
    }
  }, [{
    l: 'Name',
    v: orgMeta.name || '—'
  }, {
    l: 'Type',
    v: ORG_TYPE_LABELS[orgMeta.type] || orgMeta.type || '—'
  }, {
    l: 'Service Area',
    v: orgMeta.service_area || '—'
  }, {
    l: 'Languages',
    v: (orgMeta.languages || []).join(', ') || '—'
  }, {
    l: T.staff_term_plural,
    v: `${staff.length} members`
  }, {
    l: 'Room',
    v: orgRoom?.slice(0, 24) + '…'
  }].map((s, i) => /*#__PURE__*/React.createElement("div", {
    key: i
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, s.l.toUpperCase()), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      fontWeight: 500,
      display: 'block'
    }
  }, s.v))))), /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "settings",
    s: 16,
    c: "var(--gold)"
  }), /*#__PURE__*/React.createElement("span", {
    className: "section-label",
    style: {
      marginBottom: 0
    }
  }, "TERMINOLOGY"), (T.client_term !== 'Client' || T.provider_term !== 'Provider' || T.staff_term !== 'Team Member') && /*#__PURE__*/React.createElement("span", {
    className: "tag tag-gold",
    style: {
      fontSize: 8
    }
  }, "CUSTOMIZED")), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setTerminologyDraft({
        ...orgTerminology
      });
      setTerminologyModal(true);
    },
    className: "b-gho b-xs",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 4
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "settings",
    s: 11
  }), "Customize")), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 11.5,
      color: 'var(--tx-2)',
      marginBottom: 14,
      lineHeight: 1.6
    }
  }, "Customize what your organization calls its service recipients and service providers. These terms appear throughout the interface for all ", T.staff_term_plural.toLowerCase(), " in your organization."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '12px 14px',
      background: 'var(--bg-3)',
      borderRadius: 'var(--r)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      fontFamily: 'var(--mono)',
      color: 'var(--tx-3)',
      display: 'block',
      marginBottom: 6
    }
  }, "SERVICE RECIPIENT"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      fontWeight: 700,
      display: 'block'
    }
  }, T.client_term), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: 'var(--tx-2)'
    }
  }, "Plural: ", T.client_term_plural)), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '12px 14px',
      background: 'var(--bg-3)',
      borderRadius: 'var(--r)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      fontFamily: 'var(--mono)',
      color: 'var(--tx-3)',
      display: 'block',
      marginBottom: 6
    }
  }, "SERVICE PROVIDER"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      fontWeight: 700,
      display: 'block'
    }
  }, T.provider_term), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: 'var(--tx-2)'
    }
  }, "Plural: ", T.provider_term_plural))), (T.client_term !== 'Client' || T.provider_term !== 'Provider' || T.staff_term !== 'Team Member') && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10,
      padding: '8px 12px',
      background: 'var(--gold-dim)',
      borderRadius: 'var(--r)',
      fontSize: 11,
      color: 'var(--gold)',
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "alert",
    s: 12,
    c: "var(--gold)"
  }), "Custom terminology active \u2014 ", T.staff_term_plural.toLowerCase(), " will see \"", T.client_term, "\" and \"", T.provider_term, "\" instead of the defaults.")), /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "eyeOff",
    s: 16,
    c: "var(--purple)"
  }), /*#__PURE__*/React.createElement("span", {
    className: "section-label",
    style: {
      marginBottom: 0
    }
  }, "ORGANIZATION OPACITY"), /*#__PURE__*/React.createElement("span", {
    className: `tag ${orgOpacity === 'opaque' ? 'tag-red' : orgOpacity === 'translucent' ? 'tag-gold' : 'tag-green'}`,
    style: {
      fontSize: 9
    }
  }, OPACITY_LABELS[orgOpacity]?.toUpperCase())), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 11.5,
      color: 'var(--tx-2)',
      marginBottom: 14,
      lineHeight: 1.6
    }
  }, "Controls how much of your organization's identity is revealed when communicating with other organizations. This affects all outgoing inter-org messages."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, OPACITY_LEVELS.map(level => /*#__PURE__*/React.createElement("div", {
    key: level,
    onClick: () => handleSaveOpacity(level),
    style: {
      padding: '14px 16px',
      borderRadius: 'var(--r-lg)',
      cursor: 'pointer',
      border: `2px solid ${orgOpacity === level ? 'var(--gold)' : 'var(--border-1)'}`,
      background: orgOpacity === level ? 'var(--gold-dim)' : 'var(--bg-3)',
      transition: 'all .18s'
    },
    onMouseEnter: e => {
      if (orgOpacity !== level) e.currentTarget.style.borderColor = 'var(--border-2)';
    },
    onMouseLeave: e => {
      if (orgOpacity !== level) e.currentTarget.style.borderColor = 'var(--border-1)';
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 4
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 10,
      height: 10,
      borderRadius: '50%',
      border: `2px solid ${orgOpacity === level ? 'var(--gold)' : 'var(--tx-3)'}`,
      background: orgOpacity === level ? 'var(--gold)' : 'transparent',
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      fontWeight: 700,
      color: orgOpacity === level ? 'var(--gold)' : 'var(--tx-0)'
    }
  }, OPACITY_LABELS[level]), level === 'opaque' && /*#__PURE__*/React.createElement("span", {
    className: "tag tag-red",
    style: {
      fontSize: 8
    }
  }, "MAX PRIVACY"), level === 'translucent' && /*#__PURE__*/React.createElement("span", {
    className: "tag tag-gold",
    style: {
      fontSize: 8
    }
  }, "RECOMMENDED"), level === 'transparent' && /*#__PURE__*/React.createElement("span", {
    className: "tag tag-green",
    style: {
      fontSize: 8
    }
  }, "OPEN")), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 11.5,
      color: 'var(--tx-2)',
      lineHeight: 1.5,
      marginLeft: 18
    }
  }, (OPACITY_DESCRIPTIONS[level] || '').replace(/staff member/gi, T.staff_term.toLowerCase())), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8,
      marginLeft: 18,
      padding: '8px 12px',
      background: 'var(--bg-1)',
      borderRadius: 'var(--r)',
      border: '1px solid var(--border-0)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 9,
      fontFamily: 'var(--mono)',
      color: 'var(--tx-3)',
      display: 'block',
      marginBottom: 4
    }
  }, "EXTERNAL ORG SEES:"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: 'var(--tx-1)'
    }
  }, level === 'transparent' ? `"${providerProfile.display_name || 'Jamie R.'} from ${orgMeta.name || 'Your Org'}"` : level === 'translucent' ? `"${orgMeta.name || 'Your Org'}"` : '"An organization"')))))), /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "lock",
    s: 16,
    c: "var(--blue)"
  }), /*#__PURE__*/React.createElement("span", {
    className: "section-label",
    style: {
      marginBottom: 0
    }
  }, "INTER-ORG MESSAGE ACCESS")), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setMsgAccessDraft({
        ...orgMsgAccess
      });
      setMsgAccessModal(true);
    },
    className: "b-gho b-xs",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 4
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "settings",
    s: 11
  }), "Configure")), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 11.5,
      color: 'var(--tx-2)',
      marginBottom: 12,
      lineHeight: 1.6
    }
  }, "Control which ", T.staff_term_plural.toLowerCase(), " roles can read and respond to messages sent to your organization from other organizations."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '10px 14px',
      background: 'var(--bg-3)',
      borderRadius: 'var(--r)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      fontFamily: 'var(--mono)',
      color: 'var(--tx-3)',
      display: 'block',
      marginBottom: 6
    }
  }, "CAN READ"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 4,
      flexWrap: 'wrap'
    }
  }, orgMsgAccess.read?.map(r => /*#__PURE__*/React.createElement("span", {
    key: r,
    className: "tag tag-blue",
    style: {
      fontSize: 9
    }
  }, activeOrgRoleLabels[r] || r)), (!orgMsgAccess.read || orgMsgAccess.read.length === 0) && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      color: 'var(--tx-3)',
      fontStyle: 'italic'
    }
  }, "No roles assigned"))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '10px 14px',
      background: 'var(--bg-3)',
      borderRadius: 'var(--r)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      fontFamily: 'var(--mono)',
      color: 'var(--tx-3)',
      display: 'block',
      marginBottom: 6
    }
  }, "CAN RESPOND"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 4,
      flexWrap: 'wrap'
    }
  }, orgMsgAccess.respond?.map(r => /*#__PURE__*/React.createElement("span", {
    key: r,
    className: "tag tag-gold",
    style: {
      fontSize: 9
    }
  }, activeOrgRoleLabels[r] || r)), (!orgMsgAccess.respond || orgMsgAccess.respond.length === 0) && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      color: 'var(--tx-3)',
      fontStyle: 'italic'
    }
  }, "No roles assigned"))))), /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "msg",
    s: 16,
    c: "var(--teal)"
  }), /*#__PURE__*/React.createElement("span", {
    className: "section-label",
    style: {
      marginBottom: 0
    }
  }, "MESSAGING CHANNELS (", orgChannels.length, ")")), /*#__PURE__*/React.createElement("button", {
    onClick: () => setComposeOrgModal(true),
    className: "b-pri b-sm",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 4
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "plus",
    s: 12
  }), "New Channel")), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 11.5,
      color: 'var(--tx-2)',
      marginBottom: 10,
      lineHeight: 1.6
    }
  }, "Secure encrypted channels for org-to-org communication. Messages are governed by your opacity setting."), orgChannels.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      padding: '20px 0'
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "msg",
    s: 24
  }), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--tx-3)',
      fontSize: 11,
      marginTop: 6
    }
  }, "No messaging channels yet. Create one to start communicating with another organization.")) : /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 4
    }
  }, orgChannels.map(ch => {
    const peerOrgId = ch.orgs?.find(o => o !== orgRoom);
    const peerName = ch.org_names?.[peerOrgId] || peerOrgId?.slice(0, 20) || 'Unknown Org';
    return /*#__PURE__*/React.createElement("div", {
      key: ch.roomId,
      onClick: () => openChannel(ch.roomId),
      className: "card-h",
      style: {
        padding: '10px 14px'
      }
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
        background: 'var(--teal-dim)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--teal)'
      }
    }, /*#__PURE__*/React.createElement(I, {
      n: "msg",
      s: 14
    })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12.5,
        fontWeight: 600,
        display: 'block'
      }
    }, peerName), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 9.5,
        color: 'var(--tx-3)',
        fontFamily: 'var(--mono)'
      }
    }, ch.roomId?.slice(0, 20), "\u2026"))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 6
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: `tag ${orgOpacity === 'opaque' ? 'tag-red' : orgOpacity === 'translucent' ? 'tag-gold' : 'tag-green'}`,
      style: {
        fontSize: 8
      }
    }, OPACITY_LABELS[orgOpacity]), /*#__PURE__*/React.createElement(I, {
      n: "chevR",
      s: 13,
      c: "var(--tx-3)"
    }))));
  }))), /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "ORG ROOM ID"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--mono)',
      fontSize: 11,
      color: 'var(--tx-1)',
      background: 'var(--bg-3)',
      padding: '8px 12px',
      borderRadius: 'var(--r)',
      wordBreak: 'break-all',
      marginTop: 4
    }
  }, orgRoom), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 11,
      color: 'var(--tx-2)',
      marginTop: 8
    }
  }, "Share this room ID with providers who want to join your organization, or with other orgs to open a messaging channel.")), /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "shieldCheck",
    s: 16,
    c: emailVerifyConfig.enabled ? 'var(--green)' : 'var(--tx-3)'
  }), /*#__PURE__*/React.createElement("span", {
    className: "section-label",
    style: {
      margin: 0
    }
  }, "EMAIL VERIFICATION"), /*#__PURE__*/React.createElement("span", {
    className: `tag ${emailVerifyConfig.enabled ? 'tag-green' : 'tag-gold'}`,
    style: {
      fontSize: 8
    }
  }, emailVerifyConfig.enabled ? 'ENABLED' : 'DISABLED')), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setEmailConfigDraft({
        ...emailVerifyConfig
      });
      setEmailConfigModal(true);
    },
    className: "b-gho b-xs"
  }, /*#__PURE__*/React.createElement(I, {
    n: "settings",
    s: 11
  }), " Configure")), emailVerifyConfig.enabled ? /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 11.5,
      color: 'var(--tx-1)',
      lineHeight: 1.6,
      marginBottom: 8
    }
  }, T.staff_term_plural, " must verify their identity via email before accessing cases. Verification confirms they control an email address at an approved domain."), emailVerifyConfig.required_domains?.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      color: 'var(--tx-3)',
      display: 'block',
      marginBottom: 4
    }
  }, "APPROVED DOMAINS"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 4,
      flexWrap: 'wrap'
    }
  }, emailVerifyConfig.required_domains.map((d, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    className: "tag tag-blue",
    style: {
      fontSize: 9
    }
  }, "@", d)))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      color: 'var(--tx-3)',
      display: 'block',
      marginBottom: 4
    }
  }, "REQUIRED FOR ROLES"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 4,
      flexWrap: 'wrap'
    }
  }, emailVerifyConfig.require_for_roles?.map((r, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    className: "tag tag-gold",
    style: {
      fontSize: 9
    }
  }, activeOrgRoleLabels[r] || r)))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      color: 'var(--tx-3)'
    }
  }, "Grace period: ", emailVerifyConfig.grace_period_hours, "h \xB7 ", staff.filter(s => s.email_verification?.status === 'verified').length, "/", staff.length, " verified")) : /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 11.5,
      color: 'var(--tx-2)',
      lineHeight: 1.6
    }
  }, "Email verification is disabled. Enable it to require ", T.staff_term_plural.toLowerCase(), " to confirm their identity with an organization email address before accessing cases."))), view === 'staff' && orgRoom && /*#__PURE__*/React.createElement("div", {
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
  }, T.staff_term_plural, " Roster"), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--tx-1)',
      fontSize: 12.5,
      marginTop: 4
    }
  }, "Manage ", T.staff_term_plural.toLowerCase(), " membership and roles. Each role determines case access level."), /*#__PURE__*/React.createElement(StorageTransparencyBadge, {
    storageType: "matrix",
    roomId: orgRoom,
    encrypted: true,
    encLabel: "Megolm E2EE",
    label: T.staff_term_plural + ' Roster',
    members: staff.map(s => ({ userId: s.userId, role: s.role })),
    extra: [{ label: 'Storage', value: T.staff_term_plural + ' roster is stored as a state event in the shared organization room. All org members can read the roster; only admins can modify it.' }]
  })), orgRole === 'admin' && /*#__PURE__*/React.createElement("button", {
    onClick: () => setInviteModal(true),
    className: "b-pri b-sm",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "plus",
    s: 14
  }), "Invite ", T.staff_term)), /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "ROLE DEFINITIONS"), orgRole === 'admin' && /*#__PURE__*/React.createElement("button", {
    onClick: () => setAddRoleModal(true),
    className: "b-gho b-xs",
    style: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 10 }
  }, /*#__PURE__*/React.createElement(I, { n: "plus", s: 10 }), "Add Role")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 8,
      marginTop: 6
    }
  }, orgRolesConfig.map(rc => /*#__PURE__*/React.createElement("div", {
    key: rc.key,
    style: {
      padding: '8px 12px',
      background: 'var(--bg-3)',
      borderRadius: 'var(--r)',
      position: 'relative'
    }
  }, editingRole?.key === rc.key ? /*#__PURE__*/React.createElement("div", { style: { display: 'flex', flexDirection: 'column', gap: 6 } },
    /*#__PURE__*/React.createElement("input", {
      value: editingRole.label,
      onChange: e => setEditingRole({ ...editingRole, label: e.target.value }),
      style: { fontSize: 11, padding: '4px 6px' },
      placeholder: "Role name"
    }),
    /*#__PURE__*/React.createElement("input", {
      value: editingRole.description,
      onChange: e => setEditingRole({ ...editingRole, description: e.target.value }),
      style: { fontSize: 10, padding: '4px 6px' },
      placeholder: "Description"
    }),
    /*#__PURE__*/React.createElement("div", { style: { display: 'flex', gap: 4 } },
      /*#__PURE__*/React.createElement("button", {
        onClick: handleSaveRoleEdit,
        className: "b-pri b-xs",
        style: { fontSize: 9 }
      }, "Save"),
      /*#__PURE__*/React.createElement("button", {
        onClick: () => setEditingRole(null),
        className: "b-gho b-xs",
        style: { fontSize: 9 }
      }, "Cancel"))
  ) : /*#__PURE__*/React.createElement(React.Fragment, null,
    /*#__PURE__*/React.createElement("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
      /*#__PURE__*/React.createElement("span", {
        className: `tag ${rc.protected ? 'tag-gold' : 'tag-blue'}`,
        style: { fontSize: 9, marginBottom: 4 }
      }, rc.label),
      orgRole === 'admin' && /*#__PURE__*/React.createElement("div", { style: { display: 'flex', gap: 2 } },
        /*#__PURE__*/React.createElement("button", {
          onClick: () => setEditingRole({ key: rc.key, label: rc.label, description: rc.description }),
          className: "b-gho b-xs",
          title: "Edit role",
          style: { padding: 2, lineHeight: 1 }
        }, /*#__PURE__*/React.createElement(I, { n: "edit", s: 10 })),
        !rc.protected && /*#__PURE__*/React.createElement("button", {
          onClick: () => handleDeleteRole(rc.key),
          className: "b-gho b-xs",
          title: "Delete role",
          style: { padding: 2, lineHeight: 1, color: 'var(--red)' }
        }, /*#__PURE__*/React.createElement(I, { n: "trash", s: 10 })))),
    /*#__PURE__*/React.createElement("p", {
      style: { fontSize: 10.5, color: 'var(--tx-2)', marginTop: 2 }
    }, rc.description || 'Custom role.')))))), addRoleModal && /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: { marginBottom: 16 }
  }, /*#__PURE__*/React.createElement("span", { className: "section-label" }, "ADD NEW ROLE"), /*#__PURE__*/React.createElement("div", { style: { display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 } },
    /*#__PURE__*/React.createElement("input", {
      value: newRoleDraft.label,
      onChange: e => setNewRoleDraft({ ...newRoleDraft, label: e.target.value }),
      placeholder: "Role name (e.g. Volunteer, Intern)",
      style: { fontSize: 12 }
    }),
    /*#__PURE__*/React.createElement("input", {
      value: newRoleDraft.description,
      onChange: e => setNewRoleDraft({ ...newRoleDraft, description: e.target.value }),
      placeholder: "Description (e.g. Limited access for volunteers)",
      style: { fontSize: 12 }
    }),
    /*#__PURE__*/React.createElement("div", { style: { display: 'flex', gap: 8 } },
      /*#__PURE__*/React.createElement("button", {
        onClick: handleAddRole,
        disabled: !newRoleDraft.label.trim(),
        className: "b-pri b-xs",
        style: { fontSize: 11 }
      }, /*#__PURE__*/React.createElement(I, { n: "plus", s: 11 }), " Create Role"),
      /*#__PURE__*/React.createElement("button", {
        onClick: () => { setAddRoleModal(false); setNewRoleDraft({ label: '', description: '' }); },
        className: "b-gho b-xs",
        style: { fontSize: 11 }
      }, "Cancel")))), /*#__PURE__*/React.createElement("div", {
    className: "card"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "CURRENT ", T.staff_term_plural.toUpperCase(), " (", staff.length, ")"), emailVerifyConfig.enabled && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      color: 'var(--tx-3)'
    }
  }, staff.filter(s => s.email_verification?.status === 'verified').length, " of ", staff.length, " verified")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      marginTop: 6
    }
  }, staff.map(s => {
    const ev = s.email_verification;
    const needsVerify = emailVerifyConfig.enabled && EmailVerification.needsVerification(emailVerifyConfig, s);
    const isMe = s.userId === svc.userId;
    return /*#__PURE__*/React.createElement("div", {
      key: s.userId,
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 0',
        borderBottom: '1px solid var(--border-0)'
      }
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 6
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13,
        fontWeight: 500
      }
    }, s.userId), ev?.status === 'verified' && /*#__PURE__*/React.createElement("span", {
      className: "tag tag-green",
      style: {
        fontSize: 8
      }
    }, "VERIFIED"), needsVerify && !ev && /*#__PURE__*/React.createElement("span", {
      className: "tag tag-gold",
      style: {
        fontSize: 8
      }
    }, "UNVERIFIED"), ev?.status === 'pending' && /*#__PURE__*/React.createElement("span", {
      className: "tag tag-gold",
      style: {
        fontSize: 8
      }
    }, "PENDING"), ev?.status === 'revoked' && /*#__PURE__*/React.createElement("span", {
      className: "tag tag-red",
      style: {
        fontSize: 8
      }
    }, "REVOKED")), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 10,
        color: 'var(--tx-3)',
        fontFamily: 'var(--mono)'
      }
    }, "Joined ", s.joined ? new Date(s.joined).toLocaleDateString() : '—', ev?.status === 'verified' && ev.email && /*#__PURE__*/React.createElement(React.Fragment, null, " \xB7 ", ev.email))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 6,
        alignItems: 'center'
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: `tag ${s.role === 'admin' ? 'tag-gold' : 'tag-blue'}`,
      style: {
        fontSize: 9
      }
    }, activeOrgRoleLabels[s.role]), isMe && needsVerify && ev?.status !== 'verified' && /*#__PURE__*/React.createElement("button", {
      onClick: openEmailVerifyModal,
      className: "b-pri b-xs",
      style: {
        fontSize: 10
      }
    }, "Verify Email"), orgRole === 'admin' && ev?.status === 'verified' && s.userId !== svc.userId && /*#__PURE__*/React.createElement("button", {
      onClick: () => handleRevokeVerification(s.userId),
      className: "b-gho b-xs",
      title: "Revoke verification"
    }, /*#__PURE__*/React.createElement(I, {
      n: "x",
      s: 10
    })), orgRole === 'admin' && s.userId !== svc.userId && /*#__PURE__*/React.createElement("button", {
      onClick: () => handleRemoveStaff(s.userId),
      className: "b-gho b-xs",
      style: {
        color: 'var(--red)'
      }
    }, /*#__PURE__*/React.createElement(I, {
      n: "trash",
      s: 11
    }))));
  }))), emailVerifyConfig.enabled && myVerification?.status !== 'verified' && EmailVerification.needsVerification(emailVerifyConfig, {
    role: orgRole,
    email_verification: myVerification
  }) && /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--gold-dim)',
      border: '1px solid var(--gold-mid)',
      borderRadius: 'var(--r)',
      padding: '14px 18px',
      marginTop: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "alert",
    s: 16,
    c: "var(--gold)"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      color: 'var(--gold)'
    }
  }, "Email Verification Required")), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 11.5,
      color: 'var(--tx-1)',
      lineHeight: 1.6,
      marginBottom: 10
    }
  }, "Your organization requires email verification for your role (", activeOrgRoleLabels[orgRole], "). Verify your identity with an approved email address", emailVerifyConfig.required_domains?.length > 0 ? ` (${emailVerifyConfig.required_domains.map(d => '@' + d).join(', ')})` : '', "."), /*#__PURE__*/React.createElement("button", {
    onClick: openEmailVerifyModal,
    className: "b-pri",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "shieldCheck",
    s: 14
  }), " Verify My Email"))), view === 'network' && /*#__PURE__*/React.createElement("div", {
    className: "anim-up",
    style: {
      maxWidth: 820,
      margin: '0 auto'
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      fontFamily: 'var(--serif)',
      fontSize: 22,
      fontWeight: 700,
      marginBottom: 4
    }
  }, "Network"), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--tx-1)',
      fontSize: 12.5,
      marginBottom: 20
    }
  }, "Networks are org-to-org relationships. Organizations join voluntarily; the network defines shared vocabulary that propagates."), /*#__PURE__*/React.createElement(StorageTransparencyBadge, {
    storageType: "matrix",
    roomId: networkRoom,
    encrypted: true,
    encLabel: "Megolm E2EE",
    label: "Network",
    members: networkMembers.map(m => ({ userId: m.id || m.userId, role: m.role || 'member' })),
    extra: [{ label: 'Storage', value: 'Network metadata and shared schemas are stored as state events in the network room. All network members can read; only admins can modify network-level settings.' }]
  }), !orgRoom ? /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      textAlign: 'center',
      padding: '30px',
      borderStyle: 'dashed'
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "users",
    s: 32
  }), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--tx-2)',
      marginTop: 8,
      marginBottom: 8
    }
  }, "Create or join an organization to participate in networks"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 11,
      color: 'var(--tx-3)'
    }
  }, "Networks are org-to-org relationships. An independent provider who wants to join a network first needs to create an organization."))) : !networkRoom ? /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      textAlign: 'center',
      padding: '30px',
      borderStyle: 'dashed',
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "globe",
    s: 32
  }), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--tx-2)',
      marginTop: 8
    }
  }, "Not part of a network yet"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 11,
      color: 'var(--tx-3)',
      marginTop: 4
    }
  }, "Your org \"", orgMeta.name, "\" can create or join a network.")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setNetworkModal(true),
    className: "b-pri",
    style: {
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "plus",
    s: 14
  }), "Create Network"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setJoinNetworkModal(true),
    className: "b-gho",
    style: {
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "globe",
    s: 14
  }), "Join Network"))) : /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "tag tag-green"
  }, /*#__PURE__*/React.createElement(I, {
    n: "globe",
    s: 10
  }), "NETWORK"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      fontWeight: 700
    }
  }, "Connected"), /*#__PURE__*/React.createElement("span", {
    className: `tag ${networkRole === 'admin' ? 'tag-gold' : 'tag-blue'}`,
    style: {
      fontSize: 9
    }
  }, networkRole === 'admin' ? 'ADMIN' : 'MEMBER')), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--mono)',
      fontSize: 9.5,
      color: 'var(--tx-3)'
    }
  }, networkRoom.slice(0, 24), "\u2026")), networkRole === 'admin' && /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "NETWORK ADMINISTRATION"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 8,
      marginTop: 6
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '10px 14px',
      background: 'var(--gold-dim)',
      borderRadius: 'var(--r)',
      border: '1px solid var(--gold-mid)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      fontWeight: 600,
      color: 'var(--gold)',
      display: 'block',
      marginBottom: 2
    }
  }, "Invite Organization"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      color: 'var(--tx-2)'
    }
  }, "Invite orgs by room ID or token")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '10px 14px',
      background: 'var(--purple-dim)',
      borderRadius: 'var(--r)',
      border: '1px solid rgba(167,139,250,.15)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      fontWeight: 600,
      color: 'var(--purple)',
      display: 'block',
      marginBottom: 2
    }
  }, "Schema Proposals"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      color: 'var(--tx-2)'
    }
  }, "Review pending schema changes")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '10px 14px',
      background: 'var(--blue-dim)',
      borderRadius: 'var(--r)',
      border: '1px solid rgba(91,156,245,.15)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      fontWeight: 600,
      color: 'var(--blue)',
      display: 'block',
      marginBottom: 2
    }
  }, "Authority Catalog"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      color: 'var(--tx-2)'
    }
  }, "Shared external authorities")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '10px 14px',
      background: 'var(--teal-dim)',
      borderRadius: 'var(--r)',
      border: '1px solid rgba(62,201,176,.15)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      fontWeight: 600,
      color: 'var(--teal)',
      display: 'block',
      marginBottom: 2
    }
  }, "Metrics Aggregation"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      color: 'var(--tx-2)'
    }
  }, "Configure cross-org aggregation")))), /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "MEMBER ORGANIZATIONS (", networkMembers.length, ")"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 4
    }
  }, networkMembers.map((m, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '8px 0',
      borderBottom: '1px solid var(--border-0)'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      fontWeight: 500
    }
  }, m.name || m.id), m.name && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 9.5,
      color: 'var(--tx-3)',
      fontFamily: 'var(--mono)',
      display: 'block'
    }
  }, m.id)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: `tag ${m.role === 'admin' ? 'tag-gold' : 'tag-blue'}`,
    style: {
      fontSize: 9
    }
  }, m.role), networkRole === 'admin' && m.role !== 'admin' && /*#__PURE__*/React.createElement("button", {
    className: "b-gho b-xs",
    style: {
      color: 'var(--red)'
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "trash",
    s: 10
  }))))))), /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "SCHEMA COMMONS"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 11,
      color: 'var(--tx-2)',
      marginBottom: 10
    }
  }, "Network schema organized into forms (GIVEN data collection) and interpretations (MEANT frameworks). Forms propagate to member organizations and down to clients through providers."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      fontFamily: 'var(--mono)',
      color: 'var(--teal)',
      fontWeight: 600,
      letterSpacing: '.05em'
    }
  }, "FORMS"), /*#__PURE__*/React.createElement("span", {
    className: "tag tag-teal",
    style: {
      fontSize: 8
    }
  }, "GIVEN")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6
    }
  }, DEFAULT_FORMS.map(f => /*#__PURE__*/React.createElement("div", {
    key: f.id,
    style: {
      background: 'var(--bg-3)',
      borderRadius: 'var(--r)',
      border: '1px solid var(--border-0)',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '8px 12px',
      borderBottom: '1px solid var(--border-0)'
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
      fontWeight: 600
    }
  }, f.name), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      color: 'var(--tx-2)'
    }
  }, f.fields.length, " field", f.fields.length !== 1 ? 's' : '')), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(MaturityBadge, {
    maturity: f.maturity || 'normative'
  }), /*#__PURE__*/React.createElement(SourceBadge, {
    source: f.source || {
      level: 'network',
      propagation: 'standard'
    }
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '4px 12px'
    }
  }, f.fields.map(p => /*#__PURE__*/React.createElement("div", {
    key: p.key,
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '6px 0',
      borderBottom: '1px solid var(--border-0)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11.5,
      color: 'var(--tx-1)',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, p.question), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 9.5,
      color: 'var(--tx-3)',
      fontFamily: 'var(--mono)',
      flexShrink: 0,
      marginLeft: 8
    }
  }, p.type)))))))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      fontFamily: 'var(--mono)',
      color: 'var(--gold)',
      fontWeight: 600,
      letterSpacing: '.05em'
    }
  }, "INTERPRETATIONS"), /*#__PURE__*/React.createElement("span", {
    className: "tag tag-gold",
    style: {
      fontSize: 8
    }
  }, "MEANT")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 4
    }
  }, DEFAULT_PROVIDER_PROMPTS.map(p => /*#__PURE__*/React.createElement("div", {
    key: p.key,
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '8px 12px',
      background: 'var(--bg-3)',
      borderRadius: 'var(--r)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      fontWeight: 500,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, p.question), /*#__PURE__*/React.createElement("span", {
    className: "tag tag-gold",
    style: {
      fontSize: 8
    }
  }, "ASSESSMENT")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(MaturityBadge, {
    maturity: p.maturity || 'normative'
  }), /*#__PURE__*/React.createElement(SourceBadge, {
    source: p.source || {
      level: 'network',
      propagation: 'standard'
    }
  })))), DEFAULT_DEFINITIONS.map(d => /*#__PURE__*/React.createElement("div", {
    key: d.key,
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '8px 12px',
      background: 'var(--bg-3)',
      borderRadius: 'var(--r)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      fontWeight: 500,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, d.name), /*#__PURE__*/React.createElement("span", {
    className: "tag tag-purple",
    style: {
      fontSize: 8
    }
  }, "CLASSIFICATION")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(MaturityBadge, {
    maturity: d.maturity || 'normative'
  }), /*#__PURE__*/React.createElement(SourceBadge, {
    source: d.source || {
      level: 'network',
      propagation: 'required'
    }
  }))))))), /*#__PURE__*/React.createElement(AdoptionMetrics, {
    adopted: DEFAULT_FORMS.length + DEFAULT_DEFINITIONS.length + DEFAULT_PROVIDER_PROMPTS.length,
    total: DEFAULT_FORMS.length + DEFAULT_DEFINITIONS.length + DEFAULT_PROVIDER_PROMPTS.length + 2,
    extensions: 1,
    divergences: 0
  }), /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      marginBottom: 16,
      marginTop: 16
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "PROPAGATION MODEL (CON SEMANTICS)"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 8,
      marginTop: 6
    }
  }, Object.values(PROPAGATION_LEVELS).map(p => /*#__PURE__*/React.createElement("div", {
    key: p.id,
    style: {
      padding: '8px 12px',
      background: 'var(--bg-3)',
      borderRadius: 'var(--r)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: `tag tag-${p.color}`,
    style: {
      marginBottom: 4,
      fontSize: 9
    }
  }, p.label.toUpperCase()), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 11,
      color: 'var(--tx-2)',
      marginTop: 2
    }
  }, p.desc))))), /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "ACTIVE PROPOSALS"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 11,
      color: 'var(--tx-2)',
      marginBottom: 10
    }
  }, "Consent-based governance. Required/standard proposals trigger a consent round; recommended/optional use lazy consensus."), /*#__PURE__*/React.createElement(ProposalCard, {
    proposal: {
      proposal_id: 'prop_example_001',
      type: 'add_field',
      summary: 'Add "safe parking program" as a network-standard option for sleep location',
      detail: 'Multiple orgs already track this locally. Formalizing ensures consistent reporting across the network.',
      proposed_by: '@steward:khora.io',
      proposed_at: Date.now() - 86400000 * 3,
      target_propagation: 'standard',
      target_maturity: 'trial',
      governance_rhythm: 'monthly_review',
      deadline: Date.now() + 86400000 * 4,
      status: 'consent_round',
      positions: {
        '!org_a:khora.io': {
          position: 'adopt_as_is',
          at: Date.now() - 86400000 * 2
        },
        '!org_b:khora.io': {
          position: 'adopt_with_extension',
          at: Date.now() - 86400000,
          note: 'Will add "safe lot" sub-type'
        },
        '!org_c:khora.io': null,
        '!org_d:khora.io': null
      }
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      padding: '12px',
      fontSize: 11,
      color: 'var(--tx-3)'
    }
  }, "Active proposals from the network room will appear here. Proposals use consent-based governance \u2014 not majority voting.")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement(GovernanceCalendar, null)), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement(DeFactoAlert, {
    fieldName: "safe parking",
    orgCount: 4,
    totalOrgs: 5,
    onFormalize: () => showToast('Proposal creation flow coming in Phase 3', 'info'),
    onDismiss: () => showToast('Dismissed', 'info')
  })), networkRole !== 'admin' && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "b-gho",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "plus",
    s: 13
  }), "Propose Schema Change"), /*#__PURE__*/React.createElement("button", {
    className: "b-red b-sm",
    style: {
      marginLeft: 'auto'
    }
  }, "Leave Network")), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--green-dim)',
      border: '1px solid rgba(61,214,140,.15)',
      borderRadius: 'var(--r)',
      padding: '12px 16px',
      fontSize: 11.5,
      color: 'var(--tx-1)',
      lineHeight: 1.6,
      marginTop: 16
    }
  }, /*#__PURE__*/React.createElement("strong", {
    style: {
      color: 'var(--green)'
    }
  }, "Polycentric governance:"), " Shared prompts propagate Network \u2192 Org \u2192 Provider \u2192 Client. Observations vary locally; interpretations feeding into shared metrics use network-level definitions for consistency."))), view === 'org-inbox' && orgRoom && /*#__PURE__*/React.createElement("div", {
    className: "anim-up",
    style: {
      maxWidth: 860,
      margin: '0 auto'
    }
  }, !activeChannel ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
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
  }, "Organization Inbox"), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--tx-1)',
      fontSize: 12.5,
      marginTop: 4
    }
  }, "Encrypted org-to-org messaging. Your opacity is set to ", /*#__PURE__*/React.createElement("strong", {
    style: {
      color: orgOpacity === 'opaque' ? 'var(--red)' : orgOpacity === 'translucent' ? 'var(--gold)' : 'var(--green)'
    }
  }, OPACITY_LABELS[orgOpacity]), ".", orgRole === 'admin' && /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--tx-3)'
    }
  }, " \u2014 change in Org Settings"))), /*#__PURE__*/React.createElement("button", {
    onClick: () => setComposeOrgModal(true),
    className: "b-pri b-sm",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "plus",
    s: 14
  }), "New Channel")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))',
      gap: 10,
      marginBottom: 20
    }
  }, [{
    l: 'Channels',
    v: orgChannels.length,
    c: 'teal',
    i: 'msg'
  }, {
    l: 'Opacity',
    v: OPACITY_LABELS[orgOpacity],
    c: orgOpacity === 'opaque' ? 'red' : orgOpacity === 'translucent' ? 'gold' : 'green',
    i: 'eyeOff'
  }, {
    l: 'Your Role',
    v: activeOrgRoleLabels[orgRole] || orgRole,
    c: 'blue',
    i: 'user'
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
      fontSize: 16,
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
  })))))), orgChannels.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      textAlign: 'center',
      padding: '40px 20px',
      borderStyle: 'dashed'
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "msg",
    s: 32
  }), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--tx-2)',
      marginTop: 10,
      fontSize: 13
    }
  }, "No messaging channels"), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--tx-3)',
      fontSize: 11.5,
      marginTop: 4
    }
  }, "Create a channel to start communicating with another organization."), /*#__PURE__*/React.createElement("button", {
    onClick: () => setComposeOrgModal(true),
    className: "b-pri",
    style: {
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "plus",
    s: 14
  }), "New Channel")) : /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      padding: 0,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '10px 16px',
      background: 'var(--bg-3)',
      borderBottom: '1px solid var(--border-1)',
      display: 'grid',
      gridTemplateColumns: '2fr 1fr 1fr',
      gap: 0
    }
  }, ['ORGANIZATION', 'OPACITY', 'ACTIONS'].map(h => /*#__PURE__*/React.createElement("span", {
    key: h,
    style: {
      fontSize: 10,
      fontFamily: 'var(--mono)',
      color: 'var(--tx-2)',
      letterSpacing: '.07em',
      fontWeight: 600
    }
  }, h))), orgChannels.map((ch, i) => {
    const peerOrgId = ch.orgs?.find(o => o !== orgRoom);
    const peerName = ch.org_names?.[peerOrgId] || peerOrgId?.slice(0, 20) || 'Unknown Org';
    return /*#__PURE__*/React.createElement("div", {
      key: ch.roomId,
      style: {
        display: 'grid',
        gridTemplateColumns: '2fr 1fr 1fr',
        gap: 0,
        padding: '12px 16px',
        borderBottom: i < orgChannels.length - 1 ? '1px solid var(--border-0)' : 'none',
        alignItems: 'center',
        transition: 'background .15s'
      },
      onMouseEnter: e => e.currentTarget.style.background = 'var(--bg-3)',
      onMouseLeave: e => e.currentTarget.style.background = 'transparent'
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
        background: 'var(--teal-dim)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--teal)'
      }
    }, /*#__PURE__*/React.createElement(I, {
      n: "msg",
      s: 14
    })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13,
        fontWeight: 600,
        display: 'block'
      }
    }, peerName), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 9.5,
        color: 'var(--tx-3)',
        fontFamily: 'var(--mono)'
      }
    }, ch.roomId?.slice(0, 20), "\u2026"))), /*#__PURE__*/React.createElement("span", {
      className: `tag ${orgOpacity === 'opaque' ? 'tag-red' : orgOpacity === 'translucent' ? 'tag-gold' : 'tag-green'}`,
      style: {
        fontSize: 9,
        justifySelf: 'start'
      }
    }, OPACITY_LABELS[orgOpacity]), /*#__PURE__*/React.createElement("button", {
      onClick: () => openChannel(ch.roomId),
      className: "b-gho b-sm",
      style: {
        justifySelf: 'start',
        display: 'flex',
        alignItems: 'center',
        gap: 4
      }
    }, /*#__PURE__*/React.createElement(I, {
      n: "msg",
      s: 12
    }), "Open"));
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--purple-dim)',
      border: '1px solid rgba(167,139,250,.15)',
      borderRadius: 'var(--r)',
      padding: '14px 18px',
      marginTop: 20,
      display: 'flex',
      gap: 10,
      alignItems: 'flex-start'
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "eyeOff",
    s: 16,
    c: "var(--purple)"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: 'var(--tx-1)',
      lineHeight: 1.6
    }
  }, /*#__PURE__*/React.createElement("strong", {
    style: {
      color: 'var(--purple)'
    }
  }, "Opacity governs outgoing messages."), " When your org responds, the receiving org will see your identity according to your opacity setting (", OPACITY_LABELS[orgOpacity], "). Incoming messages are displayed according to the ", /*#__PURE__*/React.createElement("em", null, "sending"), " org's opacity setting \u2014 you cannot force another org to reveal more than they choose to."))) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setActiveChannel(null);
      setChannelMessages([]);
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
  }), "All Channels"), (() => {
    const ch = orgChannels.find(c => c.roomId === activeChannel);
    const peerOrgId = ch?.orgs?.find(o => o !== orgRoom);
    const peerName = ch?.org_names?.[peerOrgId] || peerOrgId?.slice(0, 20) || 'Unknown Org';
    return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
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
    }, peerName), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        marginTop: 4
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: svc.hasCrypto ? "tag tag-teal" : "tag tag-gold"
    }, svc.hasCrypto && /*#__PURE__*/React.createElement(I, {
      n: "lock",
      s: 9
    }), svc.hasCrypto ? "E2EE" : "No E2EE"), /*#__PURE__*/React.createElement("span", {
      className: `tag ${orgOpacity === 'opaque' ? 'tag-red' : orgOpacity === 'translucent' ? 'tag-gold' : 'tag-green'}`,
      style: {
        fontSize: 9
      }
    }, "OUTGOING: ", OPACITY_LABELS[orgOpacity]?.toUpperCase()), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--mono)',
        fontSize: 9.5,
        color: 'var(--tx-3)'
      }
    }, "org-to-org channel"))), /*#__PURE__*/React.createElement("button", {
      onClick: () => loadChannelMessages(activeChannel),
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
      className: "card",
      style: {
        marginBottom: 16
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "section-label"
    }, "MESSAGES"), /*#__PURE__*/React.createElement("div", {
      style: {
        maxHeight: 400,
        overflow: 'auto',
        marginBottom: 12
      }
    }, channelMessages.length === 0 ? /*#__PURE__*/React.createElement("p", {
      style: {
        color: 'var(--tx-3)',
        fontSize: 12,
        padding: '20px 0',
        textAlign: 'center'
      }
    }, "No messages yet. Start the conversation.") : channelMessages.map((msg, i) => {
      const sender = resolveMessageSender(msg);
      return /*#__PURE__*/React.createElement("div", {
        key: msg.id || i,
        style: {
          padding: '10px 0',
          borderBottom: '1px solid var(--border-0)'
        }
      }, /*#__PURE__*/React.createElement(ReplyQuote, { msg, allMessages: channelMessages }), /*#__PURE__*/React.createElement("div", {
        style: {
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 4
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: 6
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          fontFamily: 'var(--mono)',
          fontSize: 10.5,
          fontWeight: 600,
          color: sender.isOwn ? 'var(--gold)' : 'var(--teal)'
        }
      }, sender.isOwn ? 'You' + (sender.org ? ` (${sender.org})` : '') : sender.label), msg.content?.[`${NS}.envelope`] && /*#__PURE__*/React.createElement("span", {
        className: `tag ${msg.content[`${NS}.envelope`].opacity === 'opaque' ? 'tag-red' : msg.content[`${NS}.envelope`].opacity === 'translucent' ? 'tag-gold' : 'tag-green'}`,
        style: {
          fontSize: 7.5
        }
      }, msg.content[`${NS}.envelope`].opacity?.toUpperCase())), /*#__PURE__*/React.createElement("span", {
        style: {
          fontFamily: 'var(--mono)',
          fontSize: 9,
          color: 'var(--tx-3)'
        }
      }, msg.ts ? new Date(msg.ts).toLocaleString() : '')), /*#__PURE__*/React.createElement("p", {
        style: {
          fontSize: 12.5,
          color: 'var(--tx-1)',
          lineHeight: 1.5
        }
      }, getReplyBody(msg.content)));
    })), hasOrgMsgPermission('respond') ? /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 6
      }
    }, /*#__PURE__*/React.createElement("input", {
      value: orgMsgText,
      onChange: e => setOrgMsgText(e.target.value),
      placeholder: `Message as ${orgOpacity === 'transparent' ? providerProfile.display_name || 'you' : orgOpacity === 'translucent' ? orgMeta.name || 'your org' : 'anonymous org'}...${svc.hasCrypto ? ' (E2EE)' : ''}`,
      onKeyDown: e => {
        if (e.key === 'Enter' && !e.shiftKey) handleSendOrgMsg();
      },
      style: {
        flex: 1
      }
    }), /*#__PURE__*/React.createElement("button", {
      onClick: handleSendOrgMsg,
      className: "b-pri",
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 4
      }
    }, /*#__PURE__*/React.createElement(I, {
      n: "send",
      s: 13
    }), "Send")) : /*#__PURE__*/React.createElement("div", {
      style: {
        padding: '10px 14px',
        background: 'var(--gold-dim)',
        borderRadius: 'var(--r)',
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement(I, {
      n: "lock",
      s: 13,
      c: "var(--gold)"
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11.5,
        color: 'var(--gold)'
      }
    }, "Your role (", activeOrgRoleLabels[orgRole] || orgRole, ") does not have permission to respond to org messages. Ask an organization admin to update your role to enable messaging."))));
  })())), view === 'resources' && !activeCase && /*#__PURE__*/React.createElement(ResourcesTableView, {
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
    onCreateResource: () => {
      setResourceDraft({
        name: '',
        category: 'general',
        unit: 'unit',
        fungible: true,
        perishable: false,
        ttl_days: '',
        tags: '',
        infinite: false,
        initial_quantity: '',
        replenishes: false,
        replenish_cycle: '',
        permissions: buildDefaultResourcePermissions()
      });
      setCreateResourceModal(true);
    },
    onRefresh: () => loadResources(orgRoom, networkRoom, rosterRoom),
    onRestock: relation => {
      setRestockModal(relation);
      setRestockQty('');
      setRestockNote('');
    },
    onEstablishRelation: handleEstablishRelation,
    canViewResource: canViewResource,
    canControlResource: canControlResource,
    canAllocateResource: canAllocateResource,
    individuals: cases
  }), view === 'activity' && /*#__PURE__*/React.createElement(ActivityStream, {
    session: session
  }), view === 'transparency' && /*#__PURE__*/React.createElement(TransparencyPage, {
    onBack: () => setView('dashboard')
  }), view === 'backup' && /*#__PURE__*/React.createElement(BackupSettingsView, {
    showToast: showToast
  }))), /*#__PURE__*/React.createElement(Modal, {
    open: discoverModal,
    onClose: () => setDiscoverModal(false),
    title: "Find " + (T?.client_term || 'Individual')
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12,
      color: 'var(--tx-1)',
      marginBottom: 14,
      lineHeight: 1.6
    }
  }, "Look up ", aOrAn(T?.client_term || 'individual'), " ", (T?.client_term || 'individual').toLowerCase(), " by their Matrix ID. If they've created a bridge room and invited you, it will appear in your cases."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, (T?.client_term || 'INDIVIDUAL').toUpperCase(), " MATRIX ID"), /*#__PURE__*/React.createElement("input", {
    value: discoverUserId,
    onChange: e => setDiscoverUserId(e.target.value),
    placeholder: "@client:matrix.org"
  })), /*#__PURE__*/React.createElement("button", {
    onClick: handleDiscoverClient,
    className: "b-pri",
    style: {
      width: '100%'
    }
  }, "Search for Bridge")), /*#__PURE__*/React.createElement(Modal, {
    open: createResourceModal,
    onClose: () => setCreateResourceModal(false),
    title: "Create Resource Type",
    w: 480
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12,
      color: 'var(--tx-1)',
      marginBottom: 14,
      lineHeight: 1.6
    }
  }, "Define a new resource type for your catalog. Resource types describe the goods or services your organization can track and allocate to ", T.client_term_plural.toLowerCase(), "."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "NAME"), /*#__PURE__*/React.createElement("input", {
    value: resourceDraft.name,
    onChange: e => setResourceDraft({
      ...resourceDraft,
      name: e.target.value
    }),
    placeholder: "e.g. Bus Voucher, Shelter Bed Night"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "CATEGORY"), /*#__PURE__*/React.createElement("select", {
    value: resourceDraft.category,
    onChange: e => setResourceDraft({
      ...resourceDraft,
      category: e.target.value
    })
  }, RESOURCE_CATEGORIES.map(c => /*#__PURE__*/React.createElement("option", {
    key: c,
    value: c
  }, RESOURCE_CATEGORY_LABELS[c] || c)))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "UNIT OF MEASURE"), /*#__PURE__*/React.createElement("input", {
    value: resourceDraft.unit,
    onChange: e => setResourceDraft({
      ...resourceDraft,
      unit: e.target.value
    }),
    placeholder: "e.g. voucher, night, dollar, kit"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 10,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      fontSize: 12,
      color: 'var(--tx-1)',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: resourceDraft.fungible,
    onChange: e => setResourceDraft({
      ...resourceDraft,
      fungible: e.target.checked
    })
  }), "Fungible (interchangeable units)"), /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      fontSize: 12,
      color: 'var(--tx-1)',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: resourceDraft.perishable,
    onChange: e => setResourceDraft({
      ...resourceDraft,
      perishable: e.target.checked
    })
  }), "Perishable (expires)")), resourceDraft.perishable && /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "EXPIRY (DAYS)"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    value: resourceDraft.ttl_days,
    onChange: e => setResourceDraft({
      ...resourceDraft,
      ttl_days: e.target.value
    }),
    placeholder: "e.g. 30, 90"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: '1px solid var(--border-0)',
      paddingTop: 14,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "layers",
    s: 14,
    c: "var(--teal)"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      fontWeight: 600
    }
  }, "Supply & Replenishment")), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 11,
      color: 'var(--tx-2)',
      marginBottom: 12,
      lineHeight: 1.5
    }
  }, "Configure the initial stock level and whether this resource automatically replenishes."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 10,
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      fontSize: 12,
      color: 'var(--tx-1)',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: resourceDraft.infinite,
    onChange: e => setResourceDraft({
      ...resourceDraft,
      infinite: e.target.checked
    })
  }), "Infinite (unlimited supply)"), /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      fontSize: 12,
      color: 'var(--tx-1)',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: resourceDraft.replenishes,
    onChange: e => setResourceDraft({
      ...resourceDraft,
      replenishes: e.target.checked
    })
  }), "Replenishes (auto-refills)")), !resourceDraft.infinite && /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "INITIAL QUANTITY"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    min: "0",
    value: resourceDraft.initial_quantity,
    onChange: e => setResourceDraft({
      ...resourceDraft,
      initial_quantity: e.target.value
    }),
    placeholder: "e.g. 100, 500"
  })), resourceDraft.replenishes && /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "REPLENISH CYCLE"), /*#__PURE__*/React.createElement("select", {
    value: resourceDraft.replenish_cycle,
    onChange: e => setResourceDraft({
      ...resourceDraft,
      replenish_cycle: e.target.value
    })
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "Select cycle..."), /*#__PURE__*/React.createElement("option", {
    value: "daily"
  }, "Daily"), /*#__PURE__*/React.createElement("option", {
    value: "weekly"
  }, "Weekly"), /*#__PURE__*/React.createElement("option", {
    value: "monthly"
  }, "Monthly"), /*#__PURE__*/React.createElement("option", {
    value: "quarterly"
  }, "Quarterly"), /*#__PURE__*/React.createElement("option", {
    value: "annually"
  }, "Annually")))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "TAGS (comma-separated)"), /*#__PURE__*/React.createElement("input", {
    value: resourceDraft.tags,
    onChange: e => setResourceDraft({
      ...resourceDraft,
      tags: e.target.value
    }),
    placeholder: "e.g. transit, emergency, shelter"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: '1px solid var(--border-0)',
      paddingTop: 16,
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "shield",
    s: 14,
    c: "var(--gold)"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      fontWeight: 600
    }
  }, "Permissions")), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 11,
      color: 'var(--tx-2)',
      marginBottom: 12,
      lineHeight: 1.5
    }
  }, "Control who can manage, allocate, and see this resource. Defaults are pre-filled; adjust as needed."), RESOURCE_PERMISSION_ABILITIES.map(ability => {
    const grants = resourceDraft.permissions?.[ability] || [];
    return /*#__PURE__*/React.createElement("div", {
      key: ability,
      style: {
        marginBottom: 12
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        marginBottom: 4
      }
    }, /*#__PURE__*/React.createElement(I, {
      n: RESOURCE_PERMISSION_ICONS[ability],
      s: 11,
      c: `var(--${RESOURCE_PERMISSION_COLORS[ability]})`
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11,
        fontWeight: 600,
        color: `var(--${RESOURCE_PERMISSION_COLORS[ability]})`
      }
    }, RESOURCE_PERMISSION_LABELS[ability]), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 9.5,
        color: 'var(--tx-3)',
        fontStyle: 'italic'
      }
    }, RESOURCE_PERMISSION_DESCRIPTIONS[ability])), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: 4,
        marginBottom: 6
      }
    }, grants.length === 0 && ability === 'viewers' && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 10,
        color: 'var(--tx-3)',
        fontFamily: 'var(--mono)',
        padding: '2px 8px',
        background: 'var(--bg-3)',
        borderRadius: 10
      }
    }, "Everyone in org"), grants.map((g, gi) => /*#__PURE__*/React.createElement("span", {
      key: gi,
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 10,
        padding: '2px 8px',
        borderRadius: 10,
        background: `var(--${RESOURCE_PERMISSION_COLORS[ability]}-dim)`,
        color: `var(--${RESOURCE_PERMISSION_COLORS[ability]})`
      }
    }, /*#__PURE__*/React.createElement(I, {
      n: g.type === 'role' ? 'users' : 'user',
      s: 9
    }), g.type === 'role' ? activeOrgRoleLabels[g.id] || g.id : g.id, /*#__PURE__*/React.createElement("span", {
      onClick: () => {
        const updated = [...grants];
        updated.splice(gi, 1);
        setResourceDraft({
          ...resourceDraft,
          permissions: {
            ...resourceDraft.permissions,
            [ability]: updated
          }
        });
      },
      style: {
        cursor: 'pointer',
        marginLeft: 2,
        opacity: .7
      }
    }, "\xD7")))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 4
      }
    }, /*#__PURE__*/React.createElement("select", {
      style: {
        flex: '0 0 90px',
        fontSize: 11
      },
      value: "role",
      onChange: e => {
        const type = e.target.value;
        if (type === 'role') {
          // Show role picker
        } else {
          // Will use text input
        }
      }
    }, /*#__PURE__*/React.createElement("option", {
      value: "role"
    }, "Role"), /*#__PURE__*/React.createElement("option", {
      value: "user"
    }, "User")), /*#__PURE__*/React.createElement("select", {
      style: {
        flex: 1,
        fontSize: 11
      },
      onChange: e => {
        if (!e.target.value) return;
        const parts = e.target.value.split(':');
        const grant = {
          type: parts[0],
          id: parts[1]
        };
        if (!grants.some(g => g.type === grant.type && g.id === grant.id)) {
          setResourceDraft({
            ...resourceDraft,
            permissions: {
              ...resourceDraft.permissions,
              [ability]: [...grants, grant]
            }
          });
        }
        e.target.value = '';
      }
    }, /*#__PURE__*/React.createElement("option", {
      value: ""
    }, "Add..."), activeOrgRoles.map(r => /*#__PURE__*/React.createElement("option", {
      key: r,
      value: `role:${r}`
    }, activeOrgRoleLabels[r])), staff.filter(s => !grants.some(g => g.type === 'user' && g.id === s.userId)).map(s => /*#__PURE__*/React.createElement("option", {
      key: s.userId,
      value: `user:${s.userId}`
    }, s.userId)))));
  })), /*#__PURE__*/React.createElement("button", {
    onClick: handleCreateResourceType,
    className: "b-pri",
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
  }), "Create Resource Type")), /*#__PURE__*/React.createElement(Modal, {
    open: allocModal,
    onClose: () => setAllocModal(false),
    title: "Allocate Resource",
    w: 480
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12,
      color: 'var(--tx-1)',
      marginBottom: 14,
      lineHeight: 1.6
    }
  }, "Allocate a resource to this ", T.client_term.toLowerCase(), ". The allocation is recorded in the bridge room (visible to both parties) and updates org inventory."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "RESOURCE TYPE"), /*#__PURE__*/React.createElement("select", {
    value: allocDraft.resource_type_id,
    onChange: e => setAllocDraft({
      ...allocDraft,
      resource_type_id: e.target.value
    })
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "Select a resource..."), resourceTypes.filter(rt => canAllocateResource(rt, svc.userId, orgRole)).map(rt => {
    const relation = resourceRelations.find(r => r.resource_type_id === rt.id);
    const inv = relation ? resourceInventory[relation.id] : null;
    return /*#__PURE__*/React.createElement("option", {
      key: rt.id,
      value: rt.id
    }, rt.name, " (", rt.unit, ")", inv ? ` — ${inv.available || 0} available` : '');
  }))), allocDraft.resource_type_id && (() => {
    const rt = resourceTypes.find(t => t.id === allocDraft.resource_type_id);
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
    value: allocDraft.quantity,
    onChange: e => setAllocDraft({
      ...allocDraft,
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
    value: allocDraft.notes,
    onChange: e => setAllocDraft({
      ...allocDraft,
      notes: e.target.value
    }),
    placeholder: "e.g. For medical appointments this week"
  })), /*#__PURE__*/React.createElement("button", {
    onClick: handleAllocateResource,
    className: "b-pri",
    disabled: !allocDraft.resource_type_id,
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
  }), "Allocate Resource")), /*#__PURE__*/React.createElement(Modal, {
    open: restockModal !== null,
    onClose: () => {
      setRestockModal(null);
      setRestockQty('');
      setRestockNote('');
    },
    title: "Restock Inventory",
    w: 420
  }, restockModal && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12,
      color: 'var(--tx-1)',
      marginBottom: 14,
      lineHeight: 1.6
    }
  }, "Add inventory for ", /*#__PURE__*/React.createElement("strong", null, resourceTypes.find(t => t.id === restockModal.resource_type_id)?.name || restockModal.resource_type_id), "."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "QUANTITY TO ADD"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    min: "1",
    value: restockQty,
    onChange: e => setRestockQty(e.target.value),
    placeholder: "e.g. 100",
    autoFocus: true
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "NOTE (OPTIONAL)"), /*#__PURE__*/React.createElement("input", {
    value: restockNote,
    onChange: e => setRestockNote(e.target.value),
    placeholder: "e.g. Grant #2024-A quarterly restock"
  })), /*#__PURE__*/React.createElement("button", {
    onClick: handleRestock,
    className: "b-pri",
    disabled: !restockQty || parseInt(restockQty) <= 0,
    style: {
      width: '100%'
    }
  }, "Restock"))), /*#__PURE__*/React.createElement(Modal, {
    open: permModal !== null,
    onClose: () => setPermModal(null),
    title: "Resource Permissions",
    w: 520
  }, permModal && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      fontWeight: 700
    }
  }, permModal.name), /*#__PURE__*/React.createElement("span", {
    className: `tag tag-${RESOURCE_CATEGORY_COLORS[permModal.category] || 'teal'}`,
    style: {
      fontSize: 8.5
    }
  }, RESOURCE_CATEGORY_LABELS[permModal.category] || permModal.category)), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12,
      color: 'var(--tx-1)',
      marginBottom: 18,
      lineHeight: 1.6
    }
  }, "Control who can manage, allocate, and view this resource type. Changes apply immediately to all org members."), RESOURCE_PERMISSION_ABILITIES.map(ability => {
    const grants = permDraft[ability] || [];
    return /*#__PURE__*/React.createElement("div", {
      key: ability,
      style: {
        marginBottom: 18,
        padding: '12px 14px',
        background: 'var(--bg-2)',
        borderRadius: 'var(--r)',
        border: '1px solid var(--border-0)'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        marginBottom: 8
      }
    }, /*#__PURE__*/React.createElement(I, {
      n: RESOURCE_PERMISSION_ICONS[ability],
      s: 13,
      c: `var(--${RESOURCE_PERMISSION_COLORS[ability]})`
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12.5,
        fontWeight: 600,
        color: `var(--${RESOURCE_PERMISSION_COLORS[ability]})`
      }
    }, RESOURCE_PERMISSION_LABELS[ability])), /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 10.5,
        color: 'var(--tx-2)',
        marginBottom: 8,
        lineHeight: 1.4
      }
    }, RESOURCE_PERMISSION_DESCRIPTIONS[ability]), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: 4,
        marginBottom: 10
      }
    }, grants.length === 0 && ability === 'viewers' && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 10,
        color: 'var(--teal)',
        fontFamily: 'var(--mono)',
        padding: '3px 10px',
        background: 'var(--teal-dim)',
        borderRadius: 10
      }
    }, "Everyone in org (default)"), grants.length === 0 && ability !== 'viewers' && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 10,
        color: 'var(--tx-3)',
        fontFamily: 'var(--mono)',
        padding: '3px 10px',
        background: 'var(--bg-3)',
        borderRadius: 10
      }
    }, "Admin only (default)"), grants.map((g, gi) => /*#__PURE__*/React.createElement("span", {
      key: gi,
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 10.5,
        padding: '3px 10px',
        borderRadius: 10,
        background: `var(--${RESOURCE_PERMISSION_COLORS[ability]}-dim)`,
        color: `var(--${RESOURCE_PERMISSION_COLORS[ability]})`
      }
    }, /*#__PURE__*/React.createElement(I, {
      n: g.type === 'role' ? 'users' : 'user',
      s: 10
    }), g.type === 'role' ? activeOrgRoleLabels[g.id] || g.id : g.id, /*#__PURE__*/React.createElement("span", {
      onClick: () => handleRemovePermGrant(ability, gi),
      style: {
        cursor: 'pointer',
        marginLeft: 3,
        fontSize: 12,
        fontWeight: 700,
        opacity: .6,
        lineHeight: 1
      }
    }, "\xD7")))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 4
      }
    }, /*#__PURE__*/React.createElement("select", {
      style: {
        flex: 1,
        fontSize: 11
      },
      defaultValue: "",
      onChange: e => {
        if (!e.target.value) return;
        const parts = e.target.value.split(':');
        const grant = {
          type: parts[0],
          id: parts.slice(1).join(':')
        };
        if (!grants.some(g => g.type === grant.type && g.id === grant.id)) {
          setPermDraft({
            ...permDraft,
            [ability]: [...grants, grant]
          });
        }
        e.target.value = '';
      }
    }, /*#__PURE__*/React.createElement("option", {
      value: ""
    }, "Add role or user..."), /*#__PURE__*/React.createElement("optgroup", {
      label: "Roles"
    }, activeOrgRoles.map(r => /*#__PURE__*/React.createElement("option", {
      key: r,
      value: `role:${r}`,
      disabled: grants.some(g => g.type === 'role' && g.id === r)
    }, activeOrgRoleLabels[r]))), /*#__PURE__*/React.createElement("optgroup", {
      label: T.staff_term_plural
    }, staff.map(s => /*#__PURE__*/React.createElement("option", {
      key: s.userId,
      value: `user:${s.userId}`,
      disabled: grants.some(g => g.type === 'user' && g.id === s.userId)
    }, s.userId))))));
  }), /*#__PURE__*/React.createElement("button", {
    onClick: handleSavePermissions,
    className: "b-pri",
    style: {
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      padding: 12
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "check",
    s: 14
  }), "Save Permissions"))), /*#__PURE__*/React.createElement(Modal, {
    open: createOrgModal,
    onClose: () => setCreateOrgModal(false),
    title: "Create Organization",
    w: 520
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12,
      color: 'var(--tx-1)',
      marginBottom: 14,
      lineHeight: 1.6
    }
  }, "Create an organization to manage ", T.staff_term_plural.toLowerCase(), ", cases across your team, and participate in networks. You'll be the admin."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "ORGANIZATION NAME"), /*#__PURE__*/React.createElement("input", {
    value: setupData.name,
    onChange: e => setSetupData({
      ...setupData,
      name: e.target.value
    }),
    placeholder: "e.g. Metro Services Organization"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "ORGANIZATION TYPE"), /*#__PURE__*/React.createElement("select", {
    value: setupData.type,
    onChange: e => setSetupData({
      ...setupData,
      type: e.target.value
    })
  }, ORG_TYPES.map(t => /*#__PURE__*/React.createElement("option", {
    key: t,
    value: t
  }, ORG_TYPE_LABELS[t])))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "SERVICE AREA"), /*#__PURE__*/React.createElement("input", {
    value: setupData.service_area,
    onChange: e => setSetupData({
      ...setupData,
      service_area: e.target.value
    }),
    placeholder: "e.g. Davidson County, TN"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "LANGUAGES (comma-separated)"), /*#__PURE__*/React.createElement("input", {
    value: setupData.languages,
    onChange: e => setSetupData({
      ...setupData,
      languages: e.target.value
    }),
    placeholder: "en, es"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--blue-dim)',
      border: '1px solid rgba(91,156,245,.15)',
      borderRadius: 'var(--r)',
      padding: '10px 14px',
      marginBottom: 16,
      fontSize: 11.5,
      color: 'var(--tx-1)',
      lineHeight: 1.6
    }
  }, "This creates an encrypted Matrix room for your organization. You'll be the admin. ", T.staff_term_plural, " can be invited with specific roles. Your provider account gains org context \u2014 you can manage ", T.staff_term_plural.toLowerCase(), ", cases, and networks from your dashboard."), /*#__PURE__*/React.createElement("button", {
    onClick: handleCreateOrg,
    className: "b-pri",
    disabled: !setupData.name.trim(),
    style: {
      width: '100%',
      padding: 12,
      fontSize: 14
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "users",
    s: 16
  }), " Create Organization")), /*#__PURE__*/React.createElement(Modal, {
    open: joinOrgModal,
    onClose: () => setJoinOrgModal(false),
    title: "Join Organization"
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12,
      color: 'var(--tx-1)',
      marginBottom: 14,
      lineHeight: 1.6
    }
  }, "Enter the Matrix room ID of an existing Khora organization to join it. The org admin must have invited you."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "ORGANIZATION ROOM ID"), /*#__PURE__*/React.createElement("input", {
    value: joinOrgId,
    onChange: e => setJoinOrgId(e.target.value),
    placeholder: "!roomid:matrix.org"
  })), /*#__PURE__*/React.createElement("button", {
    onClick: handleJoinOrg,
    className: "b-pri",
    style: {
      width: '100%'
    }
  }, "Join Organization")), /*#__PURE__*/React.createElement(Modal, {
    open: inviteModal,
    onClose: () => setInviteModal(false),
    title: 'Invite ' + T.staff_term
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12,
      color: 'var(--tx-1)',
      marginBottom: 14,
      lineHeight: 1.6
    }
  }, "Invite a ", T.staff_term.toLowerCase(), " to your organization. They'll receive access to cases based on their assigned role."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "MATRIX ID"), /*#__PURE__*/React.createElement("input", {
    value: inviteUserId,
    onChange: e => setInviteUserId(e.target.value),
    placeholder: "@staff:matrix.org"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "ROLE"), /*#__PURE__*/React.createElement("select", {
    value: inviteRole,
    onChange: e => setInviteRole(e.target.value)
  }, activeOrgRoles.map(r => /*#__PURE__*/React.createElement("option", {
    key: r,
    value: r
  }, activeOrgRoleLabels[r])))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--blue-dim)',
      border: '1px solid rgba(91,156,245,.15)',
      borderRadius: 'var(--r)',
      padding: '10px 14px',
      marginBottom: 14,
      fontSize: 11.5,
      color: 'var(--tx-1)'
    }
  }, "Role determines which cases and data the ", T.staff_term.toLowerCase(), " can access. Admins see everything; read-only users see only aggregate dashboards."), /*#__PURE__*/React.createElement("button", {
    onClick: handleInviteStaff,
    className: "b-pri",
    style: {
      width: '100%'
    }
  }, "Send Invite")), /*#__PURE__*/React.createElement(Modal, {
    open: networkModal,
    onClose: () => setNetworkModal(false),
    title: "Create Network"
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12,
      color: 'var(--tx-1)',
      marginBottom: 14,
      lineHeight: 1.6
    }
  }, "Create a new governance network for your organization. Other organizations can join. Networks define shared vocabulary and schema propagation."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "NETWORK NAME"), /*#__PURE__*/React.createElement("input", {
    value: networkName,
    onChange: e => setNetworkName(e.target.value),
    placeholder: "e.g. Metro Partnership"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--green-dim)',
      border: '1px solid rgba(61,214,140,.15)',
      borderRadius: 'var(--r)',
      padding: '10px 14px',
      marginBottom: 14,
      fontSize: 11.5,
      color: 'var(--tx-1)'
    }
  }, "The network room will contain shared schema definitions that propagate to all member organizations. Your org \"", orgMeta.name, "\" will be the network admin."), /*#__PURE__*/React.createElement("button", {
    onClick: handleCreateNetwork,
    className: "b-pri",
    style: {
      width: '100%'
    }
  }, "Create Network")), /*#__PURE__*/React.createElement(Modal, {
    open: joinNetworkModal,
    onClose: () => setJoinNetworkModal(false),
    title: "Join Network"
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12,
      color: 'var(--tx-1)',
      marginBottom: 14,
      lineHeight: 1.6
    }
  }, "Enter the Matrix room ID of an existing Khora network to join as \"", orgMeta.name || 'your organization', "\"."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "NETWORK ROOM ID"), /*#__PURE__*/React.createElement("input", {
    value: joinNetworkId,
    onChange: e => setJoinNetworkId(e.target.value),
    placeholder: "!roomid:matrix.org"
  })), /*#__PURE__*/React.createElement("button", {
    onClick: handleJoinNetwork,
    className: "b-pri",
    style: {
      width: '100%'
    }
  }, "Join Network")), /*#__PURE__*/React.createElement(Modal, {
    open: !!provObsModal,
    onClose: () => setProvObsModal(null),
    title: provObsModal?.question || 'Record Observation',
    w: 500
  }, provObsModal && /*#__PURE__*/React.createElement(React.Fragment, null, provObsModal.eo?.trace && /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--purple-dim)',
      border: '1px solid rgba(167,139,250,.15)',
      borderRadius: 'var(--r)',
      padding: '8px 12px',
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      fontFamily: 'var(--mono)',
      color: 'var(--purple)'
    }
  }, provObsModal.eo.trace)), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "RESPONSE"), provObsModal.type === 'numeric' ? /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("input", {
    type: "number",
    value: provObsValue,
    onChange: e => setProvObsValue(e.target.value),
    placeholder: `${provObsModal.range?.min || 0} — ${provObsModal.range?.max || 100}`,
    min: provObsModal.range?.min,
    max: provObsModal.range?.max
  }), provObsModal.thresholds && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 4,
      flexWrap: 'wrap',
      marginTop: 6
    }
  }, provObsModal.thresholds.map((t, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    style: {
      fontSize: 9.5,
      padding: '2px 8px',
      background: provObsValue >= t.v && (i === provObsModal.thresholds.length - 1 || provObsValue < provObsModal.thresholds[i + 1]?.v) ? 'var(--gold-dim)' : 'var(--bg-3)',
      borderRadius: 10,
      color: provObsValue >= t.v && (i === provObsModal.thresholds.length - 1 || provObsValue < provObsModal.thresholds[i + 1]?.v) ? 'var(--gold)' : 'var(--tx-2)'
    }
  }, t.v, "+ ", t.l)))) : /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 4
    }
  }, provObsModal.options?.map(o => /*#__PURE__*/React.createElement("div", {
    key: o.v,
    onClick: () => setProvObsValue(o.v),
    style: {
      padding: '10px 14px',
      borderRadius: 'var(--r)',
      cursor: 'pointer',
      border: `1px solid ${provObsValue === o.v ? 'var(--gold)' : 'var(--border-1)'}`,
      background: provObsValue === o.v ? 'var(--gold-dim)' : 'var(--bg-3)',
      transition: 'all .15s'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12.5,
      color: provObsValue === o.v ? 'var(--gold)' : 'var(--tx-1)'
    }
  }, o.l))))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "CLINICAL NOTES (OPTIONAL)"), /*#__PURE__*/React.createElement("textarea", {
    value: provObsNotes,
    onChange: e => setProvObsNotes(e.target.value),
    placeholder: "Additional clinical context...",
    style: {
      minHeight: 50
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--gold-dim)',
      borderRadius: 'var(--r)',
      padding: '8px 12px',
      marginBottom: 14,
      fontSize: 11,
      color: 'var(--gold)'
    }
  }, "This observation is recorded as a MEANT event \u2014 a professional assessment with full EO provenance chain."), /*#__PURE__*/React.createElement("button", {
    onClick: handleProviderObservation,
    className: "b-pri",
    disabled: !provObsValue,
    style: {
      width: '100%'
    }
  }, "Record ", T.provider_term, " Observation"))), /*#__PURE__*/React.createElement(Modal, {
    open: shareContactModal,
    onClose: () => setShareContactModal(false),
    title: "Share My Details",
    w: 420
  },
  orgRoom && /*#__PURE__*/React.createElement("div", {
    style: { display: 'flex', gap: 0, marginBottom: 16, background: 'var(--bg-1)', borderRadius: 'var(--r-lg)', border: '1px solid var(--border-1)', padding: 3 }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setShareAsOrg(false),
    style: { flex: 1, padding: '8px 12px', borderRadius: 'var(--r)', cursor: 'pointer', fontSize: 12, fontWeight: 600, transition: 'all .2s', background: !shareAsOrg ? 'var(--gold-dim)' : 'transparent', color: !shareAsOrg ? 'var(--gold)' : 'var(--tx-2)', border: !shareAsOrg ? '1px solid var(--gold)' : '1px solid transparent' }
  }, /*#__PURE__*/React.createElement(I, { n: "user", s: 13, c: !shareAsOrg ? 'var(--gold)' : 'var(--tx-3)' }), " Individual"),
  /*#__PURE__*/React.createElement("button", {
    onClick: () => setShareAsOrg(true),
    style: { flex: 1, padding: '8px 12px', borderRadius: 'var(--r)', cursor: 'pointer', fontSize: 12, fontWeight: 600, transition: 'all .2s', background: shareAsOrg ? 'var(--blue-dim)' : 'transparent', color: shareAsOrg ? 'var(--blue)' : 'var(--tx-2)', border: shareAsOrg ? '1px solid var(--blue)' : '1px solid transparent' }
  }, /*#__PURE__*/React.createElement(I, { n: "shieldCheck", s: 13, c: shareAsOrg ? 'var(--blue)' : 'var(--tx-3)' }), " ", orgMeta?.name || 'Organization')),

  /*#__PURE__*/React.createElement("div", {
    style: { background: 'var(--bg-1)', border: '1px solid var(--border-1)', borderRadius: 'var(--r-lg)', padding: '14px 16px', marginBottom: 16 }
  }, /*#__PURE__*/React.createElement("div", {
    style: { fontSize: 15, fontWeight: 700, color: 'var(--tx-0)', marginBottom: 4 }
  }, providerProfile.display_name || svc.userId?.split(':')[0]?.replace('@', '') || T.provider_term),
  shareAsOrg && providerProfile.title && /*#__PURE__*/React.createElement("div", {
    style: { fontSize: 12, color: 'var(--tx-1)', marginBottom: 2 }
  }, providerProfile.title),
  shareAsOrg && orgMeta?.name && /*#__PURE__*/React.createElement("div", {
    style: { fontSize: 12, color: 'var(--blue)', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 6 }
  }, /*#__PURE__*/React.createElement(I, { n: "shieldCheck", s: 12, c: "var(--blue)" }), orgMeta.name),
  shareAsOrg && providerProfile.credentials && /*#__PURE__*/React.createElement("div", {
    style: { fontSize: 11, color: 'var(--tx-2)', marginBottom: 2 }
  }, providerProfile.credentials),
  shareAsOrg && myVerification?.status === 'verified' && myVerification.email && /*#__PURE__*/React.createElement("div", {
    style: { fontSize: 12, color: 'var(--tx-1)', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 6 }
  }, /*#__PURE__*/React.createElement(I, { n: "mail", s: 12, c: "var(--tx-2)" }), myVerification.email),
  /*#__PURE__*/React.createElement("div", {
    style: { fontSize: 10, color: 'var(--tx-3)', fontFamily: 'var(--mono)', marginTop: 6 }
  }, svc.userId)),

  /*#__PURE__*/React.createElement("div", {
    style: { display: 'flex', gap: 8, marginBottom: 16 }
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
  }, /*#__PURE__*/React.createElement(I, { n: "mail", s: 14 }), "Email")),

  /*#__PURE__*/React.createElement("button", {
    onClick: () => { setShareContactModal(false); openProfileModal(); },
    style: { width: '100%', background: 'transparent', border: 'none', color: 'var(--tx-2)', fontSize: 12, cursor: 'pointer', padding: '6px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'color .2s' },
    onMouseEnter: e => e.currentTarget.style.color = 'var(--gold)',
    onMouseLeave: e => e.currentTarget.style.color = 'var(--tx-2)'
  }, /*#__PURE__*/React.createElement(I, { n: "settings", s: 13 }), "Edit Profile")),

  /*#__PURE__*/React.createElement(Modal, {
    open: profileModal,
    onClose: () => setProfileModal(false),
    title: `${T.provider_term} Profile`,
    w: 520
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12,
      color: 'var(--tx-1)',
      marginBottom: 16,
      lineHeight: 1.6
    }
  }, "Your profile is stored in your roster room and synced to your bridge rooms. ", T.client_term_plural, " see your name, title, credentials, and organization membership."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "DISPLAY NAME"), /*#__PURE__*/React.createElement("input", {
    value: profileDraft.display_name,
    onChange: e => setProfileDraft({
      ...profileDraft,
      display_name: e.target.value
    }),
    placeholder: "e.g. Jamie Rivera"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "TITLE / ROLE"), /*#__PURE__*/React.createElement("input", {
    value: profileDraft.title,
    onChange: e => setProfileDraft({
      ...profileDraft,
      title: e.target.value
    }),
    placeholder: "e.g. Case Manager, Outreach Worker"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "CREDENTIALS / CERTIFICATIONS"), /*#__PURE__*/React.createElement("input", {
    value: profileDraft.credentials,
    onChange: e => setProfileDraft({
      ...profileDraft,
      credentials: e.target.value
    }),
    placeholder: "e.g. LCSW, CHW, CPM Certified"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "SERVICE TYPES"), /*#__PURE__*/React.createElement("input", {
    value: profileDraft.service_types,
    onChange: e => setProfileDraft({
      ...profileDraft,
      service_types: e.target.value
    }),
    placeholder: "e.g. Housing navigation, Benefits enrollment"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "BIO"), /*#__PURE__*/React.createElement("textarea", {
    value: profileDraft.bio,
    onChange: e => setProfileDraft({
      ...profileDraft,
      bio: e.target.value
    }),
    placeholder: "Brief description of your role and how you help clients...",
    style: {
      minHeight: 70
    }
  })), orgRoom ? /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--blue-dim)',
      border: '1px solid rgba(91,156,245,.2)',
      borderRadius: 'var(--r)',
      padding: '12px 14px',
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "shieldCheck",
    s: 16,
    c: "var(--blue)"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      color: 'var(--blue)'
    }
  }, "Organization Membership"), myVerification?.status === 'verified' ? /*#__PURE__*/React.createElement("span", {
    className: "tag tag-green",
    style: {
      fontSize: 8
    }
  }, "EMAIL VERIFIED") : emailVerifyConfig.enabled ? /*#__PURE__*/React.createElement("span", {
    className: "tag tag-gold",
    style: {
      fontSize: 8
    }
  }, "EMAIL UNVERIFIED") : /*#__PURE__*/React.createElement("span", {
    className: "tag tag-green",
    style: {
      fontSize: 8
    }
  }, "ROSTER VERIFIED")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: 'var(--tx-1)',
      lineHeight: 1.6
    }
  }, /*#__PURE__*/React.createElement("strong", null, orgMeta.name), " \xB7 ", ORG_TYPE_LABELS[orgMeta.type] || orgMeta.type, /*#__PURE__*/React.createElement("br", null), "Role: ", /*#__PURE__*/React.createElement("strong", null, activeOrgRoleLabels[orgRole] || orgRole), orgMeta.service_area && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("br", null), "Service Area: ", orgMeta.service_area), myVerification?.status === 'verified' && myVerification.email && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("br", null), "Verified email: ", /*#__PURE__*/React.createElement("strong", null, myVerification.email))), emailVerifyConfig.enabled && myVerification?.status !== 'verified' ? /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 10,
      color: 'var(--gold)',
      marginBottom: 6
    }
  }, "Your organization requires email verification. Verify your email to display a verified badge to clients."), /*#__PURE__*/React.createElement("button", {
    onClick: openEmailVerifyModal,
    className: "b-pri b-sm",
    style: {
      fontSize: 11
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "shieldCheck",
    s: 12
  }), " Verify Email Now")) : /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 10,
      color: 'var(--tx-2)',
      marginTop: 6
    }
  }, myVerification?.status === 'verified' ? 'Your identity is email-verified and visible to clients on all bridges.' : 'Your organization membership is verified through the Matrix room roster and will be visible to clients on all bridges.')) : /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--gold-dim)',
      border: '1px solid var(--gold-mid)',
      borderRadius: 'var(--r)',
      padding: '12px 14px',
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "alert",
    s: 14,
    c: "var(--gold)"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11.5,
      color: 'var(--gold)',
      fontWeight: 600
    }
  }, "No organization affiliation")), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 10.5,
      color: 'var(--tx-2)',
      marginTop: 4
    }
  }, "Clients will see you as an independent provider. Create or join an organization to display a verified affiliation badge on your profile.")), /*#__PURE__*/React.createElement("button", {
    onClick: handleSaveProfile,
    className: "b-pri",
    style: {
      width: '100%',
      padding: 12,
      fontSize: 14
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "check",
    s: 16
  }), " Save Profile & Broadcast")), /*#__PURE__*/React.createElement(Modal, {
    open: emailVerifyModal,
    onClose: () => setEmailVerifyModal(false),
    title: "Verify Your Email",
    w: 480
  }, verifyStep === 'email' && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12,
      color: 'var(--tx-1)',
      marginBottom: 14,
      lineHeight: 1.6
    }
  }, "Enter your organization email address to verify your identity. A 6-digit code will be sent to your email.", emailVerifyConfig.required_domains?.length > 0 && /*#__PURE__*/React.createElement(React.Fragment, null, " Your email must be from: ", /*#__PURE__*/React.createElement("strong", null, emailVerifyConfig.required_domains.map(d => '@' + d).join(', ')), ".")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "EMAIL ADDRESS"), /*#__PURE__*/React.createElement("input", {
    value: verifyEmail,
    onChange: e => {
      setVerifyEmail(e.target.value);
      setVerifyError('');
    },
    placeholder: emailVerifyConfig.required_domains?.[0] ? `you@${emailVerifyConfig.required_domains[0]}` : 'you@organization.org',
    type: "email"
  })), verifyError && /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--red-dim)',
      border: '1px solid rgba(239,68,68,.2)',
      borderRadius: 'var(--r)',
      padding: '8px 12px',
      marginBottom: 14,
      fontSize: 11.5,
      color: 'var(--red)'
    }
  }, verifyError), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--blue-dim)',
      border: '1px solid rgba(91,156,245,.15)',
      borderRadius: 'var(--r)',
      padding: '10px 14px',
      marginBottom: 14,
      fontSize: 11,
      color: 'var(--tx-1)',
      lineHeight: 1.6
    }
  }, /*#__PURE__*/React.createElement("strong", {
    style: {
      color: 'var(--blue)'
    }
  }, "How it works:"), " We'll send a one-time 6-digit code to this email. Enter it on the next screen to confirm you control this address. The code expires after 15 minutes."), /*#__PURE__*/React.createElement("button", {
    onClick: handleStartEmailVerify,
    disabled: verifyPending || !verifyEmail.trim(),
    className: "b-pri",
    style: {
      width: '100%',
      padding: 12,
      fontSize: 14
    }
  }, verifyPending ? 'Sending...' : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(I, {
    n: "msg",
    s: 14
  }), " Send Verification Code"))), verifyStep === 'code' && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12,
      color: 'var(--tx-1)',
      marginBottom: 14,
      lineHeight: 1.6
    }
  }, "A verification code was sent to ", /*#__PURE__*/React.createElement("strong", null, verifyEmail), ". Enter the 6-digit code below."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "VERIFICATION CODE"), /*#__PURE__*/React.createElement("input", {
    value: verifyCode,
    onChange: e => {
      setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6));
      setVerifyError('');
    },
    placeholder: "000000",
    maxLength: 6,
    style: {
      fontSize: 28,
      letterSpacing: '0.3em',
      textAlign: 'center',
      fontFamily: 'var(--mono)',
      fontWeight: 700
    }
  })), verifyError && /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--red-dim)',
      border: '1px solid rgba(239,68,68,.2)',
      borderRadius: 'var(--r)',
      padding: '8px 12px',
      marginBottom: 14,
      fontSize: 11.5,
      color: 'var(--red)'
    }
  }, verifyError), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setVerifyStep('email');
      setVerifyCode('');
      setVerifyError('');
    },
    className: "b-gho",
    style: {
      flex: 1
    }
  }, "Back"), /*#__PURE__*/React.createElement("button", {
    onClick: handleSubmitVerifyCode,
    disabled: verifyPending || verifyCode.length !== 6,
    className: "b-pri",
    style: {
      flex: 2,
      padding: 12,
      fontSize: 14
    }
  }, verifyPending ? 'Verifying...' : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(I, {
    n: "shieldCheck",
    s: 14
  }), " Verify")))), verifyStep === 'done' && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      padding: '20px 0'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 60,
      height: 60,
      borderRadius: '50%',
      background: 'var(--green-dim)',
      border: '2px solid var(--green)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      margin: '0 auto 16px'
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "check",
    s: 28,
    c: "var(--green)"
  })), /*#__PURE__*/React.createElement("h3", {
    style: {
      fontSize: 18,
      fontWeight: 700,
      color: 'var(--green)',
      marginBottom: 8
    }
  }, "Email Verified"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12,
      color: 'var(--tx-1)',
      lineHeight: 1.6,
      marginBottom: 4
    }
  }, "Your identity has been confirmed via ", /*#__PURE__*/React.createElement("strong", null, myVerification?.email)), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 11,
      color: 'var(--tx-2)'
    }
  }, "Your verified status is now visible to clients on all bridges and reflected in your provider profile.")), /*#__PURE__*/React.createElement("button", {
    onClick: () => setEmailVerifyModal(false),
    className: "b-pri",
    style: {
      width: '100%',
      padding: 12,
      fontSize: 14
    }
  }, "Done"))), /*#__PURE__*/React.createElement(Modal, {
    open: emailConfigModal,
    onClose: () => setEmailConfigModal(false),
    title: "Email Verification Settings",
    w: 520
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12,
      color: 'var(--tx-1)',
      marginBottom: 16,
      lineHeight: 1.6
    }
  }, "Configure email verification requirements for your organization. When enabled, ", T.staff_term_plural.toLowerCase(), " must verify they control an email at an approved domain before accessing cases."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      cursor: 'pointer',
      padding: '12px 14px',
      background: emailConfigDraft.enabled ? 'var(--green-dim)' : 'var(--bg-3)',
      border: `1px solid ${emailConfigDraft.enabled ? 'rgba(61,214,140,.2)' : 'var(--border-0)'}`,
      borderRadius: 'var(--r)'
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: emailConfigDraft.enabled,
    onChange: e => setEmailConfigDraft({
      ...emailConfigDraft,
      enabled: e.target.checked
    }),
    style: {
      width: 16,
      height: 16
    }
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      fontWeight: 600,
      display: 'block'
    }
  }, "Require Email Verification"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: 'var(--tx-2)'
    }
  }, T.staff_term_plural, " must verify their email before full access")))), emailConfigDraft.enabled && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "APPROVED EMAIL DOMAINS"), /*#__PURE__*/React.createElement("input", {
    value: (emailConfigDraft.required_domains || []).join(', '),
    onChange: e => setEmailConfigDraft({
      ...emailConfigDraft,
      required_domains: e.target.value.split(',').map(s => s.trim().replace(/^@/, ''))
    }),
    placeholder: "e.g. metroservices.org, metro-services.com"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      color: 'var(--tx-3)',
      display: 'block',
      marginTop: 4
    }
  }, "Comma-separated list of allowed email domains. Leave empty to allow any domain.")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "REQUIRED FOR ROLES"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 6,
      marginTop: 4
    }
  }, activeOrgRoles.map(r => {
    const active = (emailConfigDraft.require_for_roles || []).includes(r);
    return /*#__PURE__*/React.createElement("label", {
      key: r,
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        cursor: 'pointer',
        padding: '4px 8px',
        background: active ? 'var(--blue-dim)' : 'var(--bg-3)',
        border: `1px solid ${active ? 'rgba(91,156,245,.2)' : 'var(--border-0)'}`,
        borderRadius: 6,
        fontSize: 11
      }
    }, /*#__PURE__*/React.createElement("input", {
      type: "checkbox",
      checked: active,
      onChange: e => {
        const roles = e.target.checked ? [...(emailConfigDraft.require_for_roles || []), r] : (emailConfigDraft.require_for_roles || []).filter(x => x !== r);
        setEmailConfigDraft({
          ...emailConfigDraft,
          require_for_roles: roles
        });
      },
      style: {
        width: 12,
        height: 12
      }
    }), activeOrgRoleLabels[r]);
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "GRACE PERIOD (HOURS)"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    min: 0,
    max: 720,
    value: emailConfigDraft.grace_period_hours || 72,
    onChange: e => setEmailConfigDraft({
      ...emailConfigDraft,
      grace_period_hours: parseInt(e.target.value) || 72
    })
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      color: 'var(--tx-3)',
      display: 'block',
      marginTop: 4
    }
  }, "Time before unverified ", T.staff_term_plural.toLowerCase(), " lose access. 0 = immediate.")), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--gold-dim)',
      border: '1px solid var(--gold-mid)',
      borderRadius: 'var(--r)',
      padding: '10px 14px',
      marginBottom: 14,
      fontSize: 11,
      color: 'var(--tx-1)',
      lineHeight: 1.6
    }
  }, /*#__PURE__*/React.createElement("strong", {
    style: {
      color: 'var(--gold)'
    }
  }, "Note:"), " Enabling verification will prompt all existing ", T.staff_term_plural.toLowerCase(), " in the selected roles to verify their email. Currently ", staff.filter(s => s.email_verification?.status === 'verified').length, " of ", staff.length, " ", T.staff_term_plural.toLowerCase(), " are verified.")), /*#__PURE__*/React.createElement("button", {
    onClick: handleSaveEmailVerifyConfig,
    className: "b-pri",
    style: {
      width: '100%',
      padding: 12,
      fontSize: 14
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "shieldCheck",
    s: 16
  }), " Save Verification Settings")), /*#__PURE__*/React.createElement(Modal, {
    open: createTeamModal,
    onClose: () => setCreateTeamModal(false),
    title: "New Team",
    w: 520
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12,
      color: 'var(--tx-1)',
      marginBottom: 16,
      lineHeight: 1.6
    }
  }, "Create a team for collaboration. Teams are flexible \u2014 they can include people from your organization, other organizations, or individuals with no org affiliation. Anyone with a Matrix ID can be invited."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "TEAM NAME *"), /*#__PURE__*/React.createElement("input", {
    value: newTeamName,
    onChange: e => setNewTeamName(e.target.value),
    placeholder: "e.g. Outreach Unit, Housing Support Team"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "DESCRIPTION (OPTIONAL)"), /*#__PURE__*/React.createElement("textarea", {
    value: newTeamDesc,
    onChange: e => setNewTeamDesc(e.target.value),
    placeholder: "What is this team for?",
    style: {
      minHeight: 50
    }
  })),
  /* ── Parent team (nesting) ── */
  teams.length > 0 && React.createElement('div', { style: { marginBottom: 14 } },
    React.createElement('span', { className: 'section-label' }, 'PARENT TEAM (OPTIONAL — creates a sub-team)'),
    React.createElement('select', {
      value: newTeamParentId,
      onChange: e => setNewTeamParentId(e.target.value),
      style: { fontSize: 12 }
    },
      React.createElement('option', { value: '' }, '— None (top-level team) —'),
      teams.map(t => React.createElement('option', { key: t.roomId, value: t.roomId }, t.name))
    ),
    newTeamParentId && React.createElement('div', { style: { fontSize: 10.5, color: 'var(--teal)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 } },
      React.createElement(I, { n: 'arr-r', s: 9, c: 'var(--teal)' }),
      'This team will be nested under ', React.createElement('strong', null, teams.find(t => t.roomId === newTeamParentId)?.name || ''),
      '. Data can roll up if tables are configured to do so.'
    )
  ),
  /* ── Governance mode ── */
  React.createElement('div', { style: { marginBottom: 14 } },
    React.createElement('span', { className: 'section-label' }, 'GOVERNANCE MODE *'),
    Object.values(TEAM_CONSENT_MODES).map(m => {
      const govColor = m.color === 'gold' ? 'var(--gold)' : m.color === 'green' ? 'var(--green)' : 'var(--blue)';
      return React.createElement('label', {
        key: m.id,
        style: { display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 10px', borderRadius: 'var(--r)', border: '1px solid ' + (newTeamGovernance === m.id ? govColor : 'var(--border-0)'), background: newTeamGovernance === m.id ? 'var(--bg-3)' : 'transparent', cursor: 'pointer', marginBottom: 6 }
      },
        React.createElement('input', { type: 'radio', name: 'teamGov', value: m.id, checked: newTeamGovernance === m.id, onChange: () => setNewTeamGovernance(m.id), style: { marginTop: 2 } }),
        React.createElement('div', null,
          React.createElement('div', { style: { fontWeight: 600, fontSize: 12, color: newTeamGovernance === m.id ? govColor : 'var(--tx-0)' } },
            React.createElement(I, { n: m.icon, s: 10, c: govColor }), ' ', m.label),
          React.createElement('div', { style: { fontSize: 10.5, color: 'var(--tx-2)', marginTop: 2 } }, m.desc),
          m.id !== 'lead_decides' && React.createElement('div', { style: { fontSize: 10, color: 'var(--tx-3)', marginTop: 2, fontStyle: 'italic' } },
            'Schema and table changes require team votes to take effect.')
        )
      );
    })
  ),
  orgRoom && /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--blue-dim)',
      border: '1px solid rgba(91,156,245,.15)',
      borderRadius: 'var(--r)',
      padding: '10px 14px',
      marginBottom: 16,
      fontSize: 11.5,
      color: 'var(--tx-1)',
      lineHeight: 1.6
    }
  }, /*#__PURE__*/React.createElement("strong", {
    style: {
      color: 'var(--blue)'
    }
  }, "Org affiliation:"), " This team will be tagged with your org \"", orgMeta.name || 'Organization', "\" but is not restricted to org members."), /*#__PURE__*/React.createElement("button", {
    onClick: handleCreateTeam,
    className: "b-pri",
    disabled: !newTeamName.trim(),
    style: {
      width: '100%',
      padding: 12,
      fontSize: 14
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "users",
    s: 16
  }), " Create Team")), /*#__PURE__*/React.createElement(Modal, {
    open: !!teamInviteModal,
    onClose: () => {
      setTeamInviteModal(null);
      setTeamInviteUserId('');
    },
    title: `Invite to: ${teamInviteModal?.name || ''}`,
    w: 520
  }, teamInviteModal && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12,
      color: 'var(--tx-1)',
      marginBottom: 16,
      lineHeight: 1.6
    }
  }, "Invite someone to join this team. They'll be added as a member and will be asked whether they want to withhold content about individuals from being shared with them."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "MATRIX ID"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("input", {
    value: teamInviteUserId,
    onChange: e => setTeamInviteUserId(e.target.value),
    placeholder: "@user:matrix.org",
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("button", {
    onClick: handleTeamInvite,
    className: "b-pri",
    disabled: !teamInviteUserId.trim(),
    style: {
      whiteSpace: 'nowrap',
      display: 'flex',
      alignItems: 'center',
      gap: 4
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "send",
    s: 12
  }), "Invite"))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "CURRENT MEMBERS (", teamInviteModal.members?.length || 0, ")"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      marginTop: 6
    }
  }, (teamInviteModal.members || []).map((m, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '6px 10px',
      background: 'var(--bg-3)',
      borderRadius: 'var(--r)'
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: m.role === 'lead' ? 'briefcase' : 'user',
    s: 12,
    c: m.role === 'lead' ? 'var(--gold)' : 'var(--tx-2)'
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11.5,
      flex: 1,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, m.display_name || m.userId), /*#__PURE__*/React.createElement("span", {
    className: `tag ${m.role === 'lead' ? 'tag-gold' : 'tag-blue'}`,
    style: {
      fontSize: 8
    }
  }, m.role?.toUpperCase()), m.sharing_consent === 'pending' && /*#__PURE__*/React.createElement("span", {
    className: "tag tag-gold",
    style: {
      fontSize: 7
    }
  }, "PENDING"), m.sharing_consent === 'withheld' && /*#__PURE__*/React.createElement("span", {
    className: "tag tag-red",
    style: {
      fontSize: 7
    }
  }, "WITHHELD"), m.sharing_consent === 'shared' && /*#__PURE__*/React.createElement("span", {
    className: "tag tag-green",
    style: {
      fontSize: 7
    }
  }, "SHARING"))))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--bg-3)',
      borderRadius: 'var(--r)',
      padding: '10px 14px'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      fontFamily: 'var(--mono)',
      color: 'var(--tx-3)',
      display: 'block',
      marginBottom: 4
    }
  }, "TEAM ROOM ID"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10.5,
      fontFamily: 'var(--mono)',
      color: 'var(--tx-1)',
      wordBreak: 'break-all'
    }
  }, teamInviteModal.roomId)))), /*#__PURE__*/React.createElement(Modal, {
    open: !!sharingConsentModal,
    onClose: () => setSharingConsentModal(null),
    title: "Content Sharing Preference",
    w: 480
  }, sharingConsentModal && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
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
  }, "As a member of ", /*#__PURE__*/React.createElement("strong", null, sharingConsentModal.team?.name || 'this team'), ", content created about the individuals this team serves may be shared with you."))), /*#__PURE__*/React.createElement("p", {
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
    onClick: () => handleSharingConsent(sharingConsentModal.team, sharingConsentModal.memberId, false),
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
    onClick: () => handleSharingConsent(sharingConsentModal.team, sharingConsentModal.memberId, true),
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
  }, "You can change this preference at any time from the team view. This choice is recorded as an epistemic operation for full auditability.")))), /*#__PURE__*/React.createElement(Modal, {
    open: terminologyModal,
    onClose: () => setTerminologyModal(false),
    title: "Customize Terminology",
    w: 520
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12,
      color: 'var(--tx-1)',
      marginBottom: 16,
      lineHeight: 1.6
    }
  }, "Customize the terms your organization uses for service recipients and service providers. These labels will appear throughout the interface for all ", T.staff_term_plural.toLowerCase(), " at your organization."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "shield",
    s: 14,
    c: "var(--teal)"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      fontWeight: 700
    }
  }, "Service Recipient Term"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      color: 'var(--tx-3)'
    }
  }, "(default: Individual)")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "SINGULAR"), /*#__PURE__*/React.createElement("input", {
    value: terminologyDraft.client_term,
    onChange: e => setTerminologyDraft({
      ...terminologyDraft,
      client_term: e.target.value
    }),
    placeholder: "e.g. Patient, Participant, Member"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "PLURAL"), /*#__PURE__*/React.createElement("input", {
    value: terminologyDraft.client_term_plural,
    onChange: e => setTerminologyDraft({
      ...terminologyDraft,
      client_term_plural: e.target.value
    }),
    placeholder: "e.g. Patients, Participants, Members"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 4,
      flexWrap: 'wrap',
      marginTop: 8
    }
  }, ['Individual', 'Client', 'Patient', 'Participant', 'Member', 'Resident', 'Student', 'Guest'].map(t => /*#__PURE__*/React.createElement("span", {
    key: t,
    onClick: () => setTerminologyDraft({
      ...terminologyDraft,
      client_term: t,
      client_term_plural: t + 's'
    }),
    className: `tag ${terminologyDraft.client_term === t ? 'tag-teal' : 'tag-blue'}`,
    style: {
      fontSize: 9,
      cursor: 'pointer',
      transition: 'all .15s'
    }
  }, t)))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "briefcase",
    s: 14,
    c: "var(--gold)"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      fontWeight: 700
    }
  }, "Service Provider Term"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      color: 'var(--tx-3)'
    }
  }, "(default: Team Member)")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "SINGULAR"), /*#__PURE__*/React.createElement("input", {
    value: terminologyDraft.provider_term,
    onChange: e => setTerminologyDraft({
      ...terminologyDraft,
      provider_term: e.target.value
    }),
    placeholder: "e.g. Counselor, Therapist, Advocate"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "PLURAL"), /*#__PURE__*/React.createElement("input", {
    value: terminologyDraft.provider_term_plural,
    onChange: e => setTerminologyDraft({
      ...terminologyDraft,
      provider_term_plural: e.target.value
    }),
    placeholder: "e.g. Counselors, Therapists, Advocates"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 4,
      flexWrap: 'wrap',
      marginTop: 8
    }
  }, ['Team Member', 'Provider', 'Counselor', 'Therapist', 'Advocate', 'Case Worker', 'Coordinator', 'Staff'].map(t => /*#__PURE__*/React.createElement("span", {
    key: t,
    onClick: () => setTerminologyDraft({
      ...terminologyDraft,
      provider_term: t,
      provider_term_plural: t.endsWith('f') ? t.slice(0, -1) + 'ves' : t.endsWith('s') || t.endsWith('x') || t.endsWith('ch') || t.endsWith('sh') ? t + 'es' : t + 's'
    }),
    className: `tag ${terminologyDraft.provider_term === t ? 'tag-gold' : 'tag-blue'}`,
    style: {
      fontSize: 9,
      cursor: 'pointer',
      transition: 'all .15s'
    }
  }, t)))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "users",
    s: 14,
    c: "var(--blue)"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      fontWeight: 700
    }
  }, "Roster / Staff Term"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      color: 'var(--tx-3)'
    }
  }, "(default: Team Member)")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "SINGULAR"), /*#__PURE__*/React.createElement("input", {
    value: terminologyDraft.staff_term,
    onChange: e => setTerminologyDraft({
      ...terminologyDraft,
      staff_term: e.target.value
    }),
    placeholder: "e.g. Team Member, Staff, Employee"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "PLURAL"), /*#__PURE__*/React.createElement("input", {
    value: terminologyDraft.staff_term_plural,
    onChange: e => setTerminologyDraft({
      ...terminologyDraft,
      staff_term_plural: e.target.value
    }),
    placeholder: "e.g. Team Members, Staff, Employees"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 4,
      flexWrap: 'wrap',
      marginTop: 8
    }
  }, ['Team Member', 'Staff', 'Employee', 'Worker', 'Colleague', 'Personnel'].map(t => /*#__PURE__*/React.createElement("span", {
    key: t,
    onClick: () => setTerminologyDraft({
      ...terminologyDraft,
      staff_term: t,
      staff_term_plural: t.endsWith('f') ? t.slice(0, -1) + 'ves' : t.endsWith('s') || t.endsWith('x') || t.endsWith('ch') || t.endsWith('sh') ? t + 'es' : t + 's'
    }),
    className: `tag ${terminologyDraft.staff_term === t ? 'tag-blue' : 'tag-blue'}`,
    style: {
      fontSize: 9,
      cursor: 'pointer',
      transition: 'all .15s',
      opacity: terminologyDraft.staff_term === t ? 1 : 0.5
    }
  }, t)))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--bg-3)',
      borderRadius: 'var(--r)',
      padding: '12px 14px',
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      fontFamily: 'var(--mono)',
      color: 'var(--tx-3)',
      display: 'block',
      marginBottom: 8
    }
  }, "PREVIEW"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: 'var(--tx-1)',
      lineHeight: 1.8
    }
  }, /*#__PURE__*/React.createElement("span", null, "\"", terminologyDraft.provider_term || 'Provider', " Dashboard\" \xB7 \"My ", terminologyDraft.client_term_plural || 'Clients', "\" \xB7 \"New ", terminologyDraft.client_term || 'Client', " Record\""), /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("span", null, "\"", terminologyDraft.staff_term_plural || 'Team Members', " Roster\" \xB7 \"Invite ", terminologyDraft.staff_term || 'Team Member', "\" \xB7 \"Current ", terminologyDraft.staff_term_plural || 'Team Members', "\""))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: handleResetTerminology,
    className: "b-gho",
    style: {
      flex: 1,
      padding: 10
    }
  }, "Reset to Defaults"), /*#__PURE__*/React.createElement("button", {
    onClick: handleSaveTerminology,
    className: "b-pri",
    disabled: !terminologyDraft.client_term?.trim() || !terminologyDraft.client_term_plural?.trim() || !terminologyDraft.provider_term?.trim() || !terminologyDraft.provider_term_plural?.trim() || !terminologyDraft.staff_term?.trim() || !terminologyDraft.staff_term_plural?.trim(),
    style: {
      flex: 1,
      padding: 10,
      fontSize: 14
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "shieldCheck",
    s: 14
  }), " Save Terminology"))), /*#__PURE__*/React.createElement(Modal, {
    open: createClientModal,
    onClose: () => setCreateClientModal(false),
    title: `New ${T.client_term} Record`,
    w: 520
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12,
      color: 'var(--tx-1)',
      marginBottom: 14,
      lineHeight: 1.6
    }
  }, "Create ", aOrAn(T.client_term), " ", T.client_term.toLowerCase(), " record. This creates a private encrypted Matrix room. If you provide a Matrix ID, the ", T.client_term.toLowerCase(), " will be invited and given superadmin control (power level 100) \u2014 they can remove anyone from the room."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, T.client_term.toUpperCase(), " NAME *"), /*#__PURE__*/React.createElement("input", {
    value: newClientName,
    onChange: e => setNewClientName(e.target.value),
    placeholder: "e.g. John Doe"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, T.client_term.toUpperCase(), " MATRIX ID (OPTIONAL)"), /*#__PURE__*/React.createElement("input", {
    value: newClientMatrixId,
    onChange: e => setNewClientMatrixId(e.target.value),
    placeholder: "@user:matrix.org"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      color: 'var(--tx-3)',
      display: 'block',
      marginTop: 4
    }
  }, "If provided, the ", T.client_term.toLowerCase(), " will be invited immediately. You can also invite them later.")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "NOTES (OPTIONAL)"), /*#__PURE__*/React.createElement("textarea", {
    value: newClientNotes,
    onChange: e => setNewClientNotes(e.target.value),
    placeholder: `Any notes about this ${T.client_term.toLowerCase()}...`,
    style: {
      minHeight: 50
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--teal-dim)',
      border: '1px solid rgba(62,201,176,.15)',
      borderRadius: 'var(--r)',
      padding: '10px 14px',
      marginBottom: 16,
      fontSize: 11.5,
      color: 'var(--tx-1)',
      lineHeight: 1.6
    }
  }, /*#__PURE__*/React.createElement("strong", {
    style: {
      color: 'var(--teal)'
    }
  }, "Data sovereignty:"), " The ", T.client_term.toLowerCase(), " will receive power level 100 (superadmin). They can kick any member \u2014 including you \u2014 from their room at any time."), /*#__PURE__*/React.createElement("button", {
    onClick: handleCreateClientRecord,
    className: "b-pri",
    disabled: !newClientName.trim(),
    style: {
      width: '100%',
      padding: 12,
      fontSize: 14
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "plus",
    s: 16
  }), " Create ", T.client_term, " Record")), /*#__PURE__*/React.createElement(Modal, {
    open: !!verifyCodeModal,
    onClose: () => setVerifyCodeModal(null),
    title: "Claim Verification Code",
    w: 440
  }, verifyCodeModal && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12,
      color: 'var(--tx-1)',
      marginBottom: 16,
      lineHeight: 1.6
    }
  }, "Give this code to ", /*#__PURE__*/React.createElement("strong", null, verifyCodeModal.record.client_name || 'the individual'), " in person or via a trusted communication channel. They will need to enter it to claim their account."), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--bg-2)',
      border: '1px solid var(--bd)',
      borderRadius: 'var(--r)',
      padding: '24px 20px',
      textAlign: 'center',
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 36,
      fontFamily: 'var(--mono)',
      fontWeight: 700,
      letterSpacing: '0.3em',
      color: 'var(--teal)',
      marginBottom: 8
    }
  }, verifyCodeModal.code), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      navigator.clipboard.writeText(verifyCodeModal.code);
      setCopiedField('verify-code');
      setTimeout(() => setCopiedField(null), 2000);
    },
    className: "b-gho b-xs",
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      marginTop: 8
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: copiedField === 'verify-code' ? 'check' : 'copy',
    s: 12
  }), copiedField === 'verify-code' ? 'Copied!' : 'Copy Code')), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--gold-dim)',
      border: '1px solid rgba(218,165,32,.15)',
      borderRadius: 'var(--r)',
      padding: '10px 14px',
      fontSize: 11,
      color: 'var(--tx-1)',
      lineHeight: 1.6
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "clock",
    s: 12,
    c: "var(--gold)"
  }), " Expires in 15 minutes (", new Date(verifyCodeModal.expires).toLocaleTimeString(), "). ", /*#__PURE__*/React.createElement("br", null), "Maximum 3 attempts. You can generate a new code at any time."))), /*#__PURE__*/React.createElement(Modal, {
    open: !!clientInviteModal,
    onClose: () => {
      setClientInviteModal(null);
      setCopiedField(null);
    },
    title: `Invite: ${clientInviteModal?.client_name || ''}`,
    w: 600
  }, clientInviteModal && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12,
      color: 'var(--tx-1)',
      marginBottom: 16,
      lineHeight: 1.6
    }
  }, "Generate an invite link and setup instructions to share with this ", T.client_term.toLowerCase(), ". When they join, they'll have full control of their room."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, T.client_term.toUpperCase(), " MATRIX ID"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("input", {
    value: clientInviteMatrixId,
    onChange: e => setClientInviteMatrixId(e.target.value),
    placeholder: "@user:matrix.org",
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("button", {
    onClick: handleClientInvite,
    className: "b-pri",
    disabled: !clientInviteMatrixId.trim(),
    style: {
      whiteSpace: 'nowrap',
      display: 'flex',
      alignItems: 'center',
      gap: 4
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "send",
    s: 12
  }), "Send Invite")), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      color: 'var(--tx-3)',
      display: 'block',
      marginTop: 4
    }
  }, "Enter the client's Matrix ID to send a direct room invite and grant them superadmin (PL 100).")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "INVITE LINK"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      fontFamily: 'var(--mono)',
      fontSize: 11,
      color: 'var(--tx-1)',
      background: 'var(--bg-3)',
      padding: '10px 14px',
      borderRadius: 'var(--r)',
      border: '1px solid var(--border-1)',
      wordBreak: 'break-all',
      userSelect: 'all'
    }
  }, getInviteUrl(clientInviteModal.roomId)), /*#__PURE__*/React.createElement("button", {
    onClick: () => copyToClipboard(getInviteUrl(clientInviteModal.roomId), 'link'),
    className: "b-gho b-sm",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      whiteSpace: 'nowrap'
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: copiedField === 'link' ? 'check' : 'copy',
    s: 12
  }), copiedField === 'link' ? 'Copied' : 'Copy'))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label",
    style: {
      marginBottom: 0
    }
  }, "SETUP INSTRUCTIONS \u2014 SHARE WITH CLIENT"), /*#__PURE__*/React.createElement("button", {
    onClick: () => copyToClipboard(getSetupInstructions(clientInviteModal.roomId), 'instructions'),
    className: "b-gho b-xs",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 3
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: copiedField === 'instructions' ? 'check' : 'copy',
    s: 11
  }), copiedField === 'instructions' ? 'Copied' : 'Copy All')), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--mono)',
      fontSize: 10.5,
      color: 'var(--tx-1)',
      background: 'var(--bg-1)',
      border: '1px solid var(--border-1)',
      borderRadius: 'var(--r)',
      padding: '14px 16px',
      lineHeight: 1.7,
      whiteSpace: 'pre-wrap',
      maxHeight: 300,
      overflow: 'auto'
    }
  }, getSetupInstructions(clientInviteModal.roomId))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "SHARE INVITE"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => shareInviteViaEmail(clientInviteModal.roomId),
    className: "b-gho",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      flex: 1,
      justifyContent: 'center',
      minWidth: 120
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "mail",
    s: 14
  }), "Email"), /*#__PURE__*/React.createElement("button", {
    onClick: () => shareInviteViaSMS(clientInviteModal.roomId),
    className: "b-gho",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      flex: 1,
      justifyContent: 'center',
      minWidth: 120
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "messageSquare",
    s: 14
  }), "Text / SMS"), /*#__PURE__*/React.createElement("button", {
    onClick: () => shareInviteNative(clientInviteModal.roomId),
    className: "b-gho",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      flex: 1,
      justifyContent: 'center',
      minWidth: 120
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "share",
    s: 14
  }), "More..."))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--teal-dim)',
      border: '1px solid rgba(62,201,176,.15)',
      borderRadius: 'var(--r)',
      padding: '12px 16px',
      display: 'flex',
      gap: 10,
      alignItems: 'flex-start'
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "shield",
    s: 16,
    c: "var(--teal)"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: 'var(--tx-1)',
      lineHeight: 1.6
    }
  }, /*#__PURE__*/React.createElement("strong", {
    style: {
      color: 'var(--teal)'
    }
  }, "Client gets power level 100 (superadmin)."), " Once joined, they can remove anyone from this room \u2014 including you. This ensures the client always has sovereign control over who can access their space.")))), /*#__PURE__*/React.createElement(ImportDataModal, {
    open: importModal,
    onClose: () => setImportModal(false),
    showToast: showToast,
    metricsRoom: metricsRoom,
    onComplete: handleImportComplete,
    teamId: activeTeamContext || null,
    teamName: activeTeamObj?.name || null
  }),
  /* ── CreateTableModal ── */
  React.createElement(CreateTableModal, {
    open: !!createTableModal,
    onClose: newTable => {
      if (newTable) {
        // Add the newly created table to the active team's customTables in local state
        setTeams(prev => prev.map(t => t.roomId === createTableModal?.teamId ? {
          ...t,
          customTables: [...(t.customTables || []), newTable]
        } : t));
      }
      setCreateTableModal(null);
    },
    team: createTableModal ? (teams.find(t => t.roomId === createTableModal.teamId) || null) : null,
    teams: teams,
    svc: svc,
    showToast: showToast
  }),
  /* ── CustomTableView overlay ── */
  activeCustomTable && React.createElement('div', {
    style: { position: 'fixed', inset: 0, zIndex: 900, background: 'var(--bg-0)', overflowY: 'auto', padding: '24px 32px' }
  },
    React.createElement(CustomTableView, {
      table: activeCustomTable.table,
      team: teams.find(t => t.roomId === activeCustomTable.teamId) || null,
      svc: svc,
      showToast: showToast,
      onBack: () => setActiveCustomTable(null)
    })
  ),
  /*#__PURE__*/React.createElement(DatabaseMergeModal, {
    open: dbMergeModal,
    onClose: () => { setDbMergeModal(false); setDbMergeRecordA(null); setDbMergeRecordB(null); },
    recordA: dbMergeRecordA,
    recordB: dbMergeRecordB,
    allRecords: clientRecords.map(cr => ({
      roomId: cr.roomId,
      name: cr.client_name || cr.name || 'Record',
      fields: cr.fields || {},
      timestamps: cr.timestamps || {},
      ts: cr.created_at || cr.ts || 0
    })),
    targetRoomId: dbMergeRecordA?.roomId || (clientRecords[0] && clientRecords[0].roomId),
    showToast: showToast,
    onComplete: (res) => {
      if (showToast) showToast('Database merge completed: ' + res.ops_emitted + ' auditable EO operations');
    }
  }), /*#__PURE__*/React.createElement(Modal, {
    open: composeOrgModal,
    onClose: () => setComposeOrgModal(false),
    title: "New Org Messaging Channel",
    w: 520
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12,
      color: 'var(--tx-1)',
      marginBottom: 14,
      lineHeight: 1.6
    }
  }, "Create an encrypted messaging channel with another organization. Messages you send will be governed by your opacity setting (", /*#__PURE__*/React.createElement("strong", {
    style: {
      color: orgOpacity === 'opaque' ? 'var(--red)' : orgOpacity === 'translucent' ? 'var(--gold)' : 'var(--green)'
    }
  }, OPACITY_LABELS[orgOpacity]), ")."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "PEER ORGANIZATION ROOM ID"), /*#__PURE__*/React.createElement("input", {
    value: composePeerOrgId,
    onChange: e => setComposePeerOrgId(e.target.value),
    placeholder: "!orgroom:matrix.org"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      color: 'var(--tx-3)',
      display: 'block',
      marginTop: 4
    }
  }, "The Matrix room ID of the organization you want to message.")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "ORGANIZATION NAME (OPTIONAL)"), /*#__PURE__*/React.createElement("input", {
    value: composePeerOrgName,
    onChange: e => setComposePeerOrgName(e.target.value),
    placeholder: "e.g. Metro Housing Authority"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      color: 'var(--tx-3)',
      display: 'block',
      marginTop: 4
    }
  }, "A display name for the other org. Helps identify the channel.")), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--bg-3)',
      borderRadius: 'var(--r)',
      padding: '12px 14px',
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      fontFamily: 'var(--mono)',
      color: 'var(--tx-3)',
      display: 'block',
      marginBottom: 6
    }
  }, "OPACITY PREVIEW \u2014 THEY WILL SEE:"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: `tag ${orgOpacity === 'opaque' ? 'tag-red' : orgOpacity === 'translucent' ? 'tag-gold' : 'tag-green'}`,
    style: {
      fontSize: 9
    }
  }, OPACITY_LABELS[orgOpacity]?.toUpperCase()), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: 'var(--tx-1)'
    }
  }, orgOpacity === 'transparent' ? `${providerProfile.display_name || T.staff_term + ' Name'} from ${orgMeta.name || 'Your Org'}` : orgOpacity === 'translucent' ? orgMeta.name || 'Your Org' : 'An organization'))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--teal-dim)',
      border: '1px solid rgba(62,201,176,.15)',
      borderRadius: 'var(--r)',
      padding: '10px 14px',
      marginBottom: 16,
      fontSize: 11.5,
      color: 'var(--tx-1)',
      lineHeight: 1.6
    }
  }, "Both organizations maintain independent opacity settings. You control what they see about you; they control what you see about them."), /*#__PURE__*/React.createElement("button", {
    onClick: handleCreateOrgChannel,
    className: "b-pri",
    disabled: !composePeerOrgId.trim(),
    style: {
      width: '100%',
      padding: 12,
      fontSize: 14
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "msg",
    s: 16
  }), " Create Channel")), /*#__PURE__*/React.createElement(Modal, {
    open: newTeamDMModal,
    onClose: () => { setNewTeamDMModal(false); setNewDMTarget(null); },
    title: "New Direct Message",
    w: 480
  }, /*#__PURE__*/React.createElement("p", {
    style: { fontSize: 12, color: 'var(--tx-1)', marginBottom: 14, lineHeight: 1.6 }
  }, "Start an encrypted direct conversation. Select a contact below."),
  allContacts.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: { textAlign: 'center', padding: '20px 0', color: 'var(--tx-3)', fontSize: 12 }
  }, "No contacts found.") : /*#__PURE__*/React.createElement("div", {
    style: { display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflow: 'auto', marginBottom: 16 }
  }, allContacts.map(c => /*#__PURE__*/React.createElement("div", {
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
        /*#__PURE__*/React.createElement(ConnectionBadges, { userType: "provider", teamName: c.teamName, teamColors: teamColorsList, orgName: orgMeta?.name, role: c.role, size: "xs" }))),
    c.hasDM && /*#__PURE__*/React.createElement("span", { className: "tag tag-green", style: { fontSize: 8 } }, "DM exists"))))),
  newDMTarget && /*#__PURE__*/React.createElement("button", {
    onClick: () => startTeamDM(newDMTarget.userId, newDMTarget.displayName, newDMTarget.teamName, newDMTarget.teamRoomId),
    className: "b-pri",
    style: { width: '100%', padding: 12, fontSize: 14 }
  }, /*#__PURE__*/React.createElement(I, { n: "msg", s: 16 }), " Start Conversation with ", newDMTarget.displayName)), /*#__PURE__*/React.createElement(Modal, {
    open: newBucketModal,
    onClose: () => { setNewBucketModal(false); setNewBucketDraft(''); },
    title: "New Group",
    w: 400
  }, /*#__PURE__*/React.createElement("div", {
    style: { display: 'flex', flexDirection: 'column', gap: 14 }
  }, /*#__PURE__*/React.createElement("p", {
    style: { fontSize: 12, color: 'var(--tx-1)', lineHeight: 1.5 }
  }, "Create a named group to organize your conversations. You can move any conversation into a group from the messages sidebar."), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    style: { fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 6 }
  }, "Group Name"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    value: newBucketDraft,
    onChange: e => setNewBucketDraft(e.target.value),
    placeholder: "e.g. Priority, Intake, Follow-up...",
    onKeyDown: e => { if (e.key === 'Enter' && newBucketDraft.trim()) { createMsgBucket(newBucketDraft); setNewBucketModal(false); setNewBucketDraft(''); } },
    style: { width: '100%' },
    autoFocus: true
  })), /*#__PURE__*/React.createElement("div", {
    style: { display: 'flex', justifyContent: 'flex-end', gap: 8 }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => { setNewBucketModal(false); setNewBucketDraft(''); },
    className: "b-gho"
  }, "Cancel"), /*#__PURE__*/React.createElement("button", {
    onClick: () => { if (newBucketDraft.trim()) { createMsgBucket(newBucketDraft); setNewBucketModal(false); setNewBucketDraft(''); } },
    className: "b-pri",
    disabled: !newBucketDraft.trim()
  }, "Create Group")))), /*#__PURE__*/React.createElement(Modal, {
    open: msgAccessModal,
    onClose: () => setMsgAccessModal(false),
    title: "Configure Message Access",
    w: 560
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12,
      color: 'var(--tx-1)',
      marginBottom: 16,
      lineHeight: 1.6
    }
  }, "Control which roles in your organization can read and respond to inter-org messages. Only roles listed under \"Respond\" can send messages on behalf of your organization."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "CAN READ ORG MESSAGES"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 10.5,
      color: 'var(--tx-3)',
      marginBottom: 8
    }
  }, "Select roles that can view messages sent to your organization."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 4
    }
  }, activeOrgRoles.map(role => /*#__PURE__*/React.createElement("div", {
    key: role,
    onClick: () => {
      setMsgAccessDraft(prev => ({
        ...prev,
        read: prev.read.includes(role) ? prev.read.filter(r => r !== role) : [...prev.read, role]
      }));
    },
    style: {
      padding: '10px 14px',
      borderRadius: 'var(--r)',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      border: `1px solid ${msgAccessDraft.read?.includes(role) ? 'var(--blue)' : 'var(--border-1)'}`,
      background: msgAccessDraft.read?.includes(role) ? 'var(--blue-dim)' : 'var(--bg-3)',
      transition: 'all .15s'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 14,
      height: 14,
      borderRadius: 3,
      border: `2px solid ${msgAccessDraft.read?.includes(role) ? 'var(--blue)' : 'var(--tx-3)'}`,
      background: msgAccessDraft.read?.includes(role) ? 'var(--blue)' : 'transparent',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#fff',
      fontSize: 9,
      fontWeight: 800
    }
  }, msgAccessDraft.read?.includes(role) ? '✓' : ''), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12.5,
      fontWeight: msgAccessDraft.read?.includes(role) ? 600 : 400
    }
  }, activeOrgRoleLabels[role])), /*#__PURE__*/React.createElement("span", {
    className: "tag tag-blue",
    style: {
      fontSize: 8
    }
  }, "READ"))))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "CAN RESPOND TO ORG MESSAGES"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 10.5,
      color: 'var(--tx-3)',
      marginBottom: 8
    }
  }, "Select roles that can send messages on behalf of your organization. These roles can also read."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 4
    }
  }, activeOrgRoles.map(role => /*#__PURE__*/React.createElement("div", {
    key: role,
    onClick: () => {
      setMsgAccessDraft(prev => ({
        ...prev,
        respond: (prev.respond || []).includes(role) ? (prev.respond || []).filter(r => r !== role) : [...(prev.respond || []), role]
      }));
    },
    style: {
      padding: '10px 14px',
      borderRadius: 'var(--r)',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      border: `1px solid ${msgAccessDraft.respond?.includes(role) ? 'var(--gold)' : 'var(--border-1)'}`,
      background: msgAccessDraft.respond?.includes(role) ? 'var(--gold-dim)' : 'var(--bg-3)',
      transition: 'all .15s'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 14,
      height: 14,
      borderRadius: 3,
      border: `2px solid ${msgAccessDraft.respond?.includes(role) ? 'var(--gold)' : 'var(--tx-3)'}`,
      background: msgAccessDraft.respond?.includes(role) ? 'var(--gold)' : 'transparent',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--bg-0)',
      fontSize: 9,
      fontWeight: 800
    }
  }, msgAccessDraft.respond?.includes(role) ? '✓' : ''), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12.5,
      fontWeight: msgAccessDraft.respond?.includes(role) ? 600 : 400
    }
  }, activeOrgRoleLabels[role])), /*#__PURE__*/React.createElement("span", {
    className: "tag tag-gold",
    style: {
      fontSize: 8
    }
  }, "RESPOND"))))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--purple-dim)',
      border: '1px solid rgba(167,139,250,.15)',
      borderRadius: 'var(--r)',
      padding: '10px 14px',
      marginBottom: 16,
      fontSize: 11.5,
      color: 'var(--tx-1)',
      lineHeight: 1.6
    }
  }, /*#__PURE__*/React.createElement("strong", {
    style: {
      color: 'var(--purple)'
    }
  }, "Opacity + Access = Privacy."), " Opacity controls ", /*#__PURE__*/React.createElement("em", null, "what"), " external orgs see. Access controls ", /*#__PURE__*/React.createElement("em", null, "who inside your org"), " can participate. Together, they form your org's communication privacy posture."), /*#__PURE__*/React.createElement("button", {
    onClick: handleSaveMsgAccess,
    className: "b-pri",
    style: {
      width: '100%',
      padding: 12,
      fontSize: 14
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "check",
    s: 16
  }), " Save Access Settings")), /*#__PURE__*/React.createElement(Modal, {
    open: !!transferModal,
    onClose: () => {
      setTransferModal(null);
      setTransferTarget('');
    },
    title: "Transfer Case",
    w: 520
  }, transferModal && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12,
      color: 'var(--tx-1)',
      marginBottom: 16,
      lineHeight: 1.6
    }
  }, "Reassign this case to a different ", T.provider_term.toLowerCase(), " within your organization. The new ", T.provider_term.toLowerCase(), " will be invited to the encrypted bridge room."), /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      padding: 14,
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "CURRENT CASE"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      marginTop: 4
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 36,
      borderRadius: '50%',
      background: 'var(--teal-dim)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--teal)',
      border: '2px solid var(--teal)'
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "user",
    s: 16
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      fontWeight: 600,
      display: 'block'
    }
  }, transferModal.sharedData?.full_name || transferModal.clientUserId), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10.5,
      color: 'var(--tx-2)',
      fontFamily: 'var(--mono)'
    }
  }, "Currently: ", transferModal.meta?.provider?.split(':')[0]?.replace('@', ''))))), !transferModal.transferable && /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--red-dim)',
      border: '1px solid rgba(232,93,93,.18)',
      borderRadius: 'var(--r)',
      padding: '12px 16px',
      marginBottom: 16,
      display: 'flex',
      gap: 10,
      alignItems: 'flex-start'
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "lock",
    s: 16,
    c: "var(--red)"
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      fontWeight: 600,
      color: 'var(--red)',
      display: 'block'
    }
  }, "Transfer Blocked by ", T.client_term), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: 'var(--tx-1)'
    }
  }, "This ", T.client_term.toLowerCase(), " has disabled provider transfers. Only they can change this setting."))), transferModal.transferable && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "ASSIGN TO ", T.provider_term.toUpperCase()), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 4
    }
  }, staff.filter(s => s.userId !== transferModal.meta?.provider).map(s => {
    const isSelected = transferTarget === s.userId;
    return /*#__PURE__*/React.createElement("div", {
      key: s.userId,
      onClick: () => setTransferTarget(s.userId),
      style: {
        padding: '10px 14px',
        borderRadius: 'var(--r)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        border: `1px solid ${isSelected ? 'var(--gold)' : 'var(--border-1)'}`,
        background: isSelected ? 'var(--gold-dim)' : 'var(--bg-3)',
        transition: 'all .15s'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 14,
        height: 14,
        borderRadius: '50%',
        border: `2px solid ${isSelected ? 'var(--gold)' : 'var(--tx-3)'}`,
        background: isSelected ? 'var(--gold)' : 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--bg-0)',
        fontSize: 9,
        fontWeight: 800
      }
    }, isSelected ? '✓' : ''), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12.5,
        fontWeight: isSelected ? 600 : 400,
        display: 'block'
      }
    }, s.userId.split(':')[0]?.replace('@', '')), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 10,
        color: 'var(--tx-2)',
        fontFamily: 'var(--mono)'
      }
    }, activeOrgRoleLabels[s.role] || s.role)), /*#__PURE__*/React.createElement("span", {
      className: `tag tag-${s.role === 'admin' ? 'gold' : s.role === 'case_manager' ? 'blue' : 'teal'}`,
      style: {
        fontSize: 8
      }
    }, (activeOrgRoleLabels[s.role] || s.role).toUpperCase()));
  }), staff.filter(s => s.userId !== transferModal.meta?.provider).length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 16,
      textAlign: 'center',
      color: 'var(--tx-3)',
      fontSize: 12
    }
  }, "No other ", T.staff_term_plural.toLowerCase(), " available for transfer."))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--teal-dim)',
      border: '1px solid rgba(62,201,176,.15)',
      borderRadius: 'var(--r)',
      padding: '10px 14px',
      marginBottom: 16,
      fontSize: 11.5,
      color: 'var(--tx-1)',
      lineHeight: 1.6
    }
  }, /*#__PURE__*/React.createElement("strong", {
    style: {
      color: 'var(--teal)'
    }
  }, "The ", T.client_term.toLowerCase(), " retains full control."), " They can revoke access from the new ", T.provider_term.toLowerCase(), " at any time. Encrypted field keys remain ", T.client_term.toLowerCase(), "-owned."), /*#__PURE__*/React.createElement("button", {
    onClick: handleTransferCase,
    className: "b-pri",
    disabled: !transferTarget,
    style: {
      width: '100%',
      padding: 12,
      fontSize: 14
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "users",
    s: 16
  }), " Transfer Case")))));
};

/* ═══════════════════ TRANSPARENCY & PRIVACY ═══════════════════
 * Operator Manifest:
 *   DES(transparency.page, {purpose: trust_through_visibility}) — existence
 *   INS(transparency.source, {live_code_introspection}) — source viewer
 *   CON(transparency.eo_sections, {navigable_tree}) — structural navigation
 *   DES(transparency.privacy, {access_matrix, data_flow}) — privacy model
 *
 * Triad Summary:
 *   Existence:       DES (page purpose, privacy model designation)
 *   Structure:       CON (EO section linkage, navigable tree)
 *   Interpretation:  INS (live source introspection — code IS the documentation)
 *
 * This page exists so that anyone using Khora can verify exactly what the
 * software does, who has access to their data, and how the EO operation
 * layer governs all state transitions. The source code viewer reads the
 * live running code — it cannot be out of date.
 * ═══════════════════════════════════════════════════════════ */
const TransparencyPage = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [sourceCode, setSourceCode] = useState('');
  const [eoSections, setEoSections] = useState([]);
  const [activeSection, setActiveSection] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCards, setExpandedCards] = useState({});
  const codeRef = useRef(null);
  const [archLevel, setArchLevel] = useState(0);
  const [archPath, setArchPath] = useState([]);
  const [archSelected, setArchSelected] = useState(null);
  const [archHovered, setArchHovered] = useState(null);

  // Read the live source code from the running page
  useEffect(() => {
    const scripts = document.querySelectorAll('script:not([src]):not([type])');
    let code = '';
    scripts.forEach(s => { if (s.textContent.length > 1000) code = s.textContent; });
    if (!code) {
      const allScripts = document.querySelectorAll('script');
      allScripts.forEach(s => { if (!s.src && s.textContent.length > 1000) code = s.textContent; });
    }
    setSourceCode(code);

    // Parse EO section headers with full operator manifest extraction
    const lines = code.split('\n');
    const sections = [];
    const sectionRe = /\/\*\s*═{3,}\s*(.*?)\s*═{3,}\s*\*\//;
    lines.forEach((line, i) => {
      const m = line.match(sectionRe);
      if (m) {
        sections.push({ name: m[1].trim(), line: i + 1, operators: [], triad: {}, manifestLines: [], definitions: [], emitOpCalls: [] });
      }
    });
    // For each section, parse the Operator Manifest and Triad Summary from the header comment block
    const opLineRe = /^\s*\*\s+(NUL|DES|INS|SEG|CON|SYN|ALT|SUP|REC)\(([^)]*)\)\s*—\s*(.*)$/;
    const triadRe = /^\s*\*\s+(Existence|Structure|Interpretation):\s+(.*)$/;
    const fnRe = /^(?:async\s+)?function\s+(\w+)/;
    const constFnRe = /^const\s+(\w+)\s*=\s*(?:\([^)]*\)\s*=>|function|\(?\{)/;
    const constCompRe = /^const\s+(\w+)\s*=\s*\(\s*\{/;
    const emitOpRe = /emitOp\(\s*\S+,\s*'(NUL|DES|INS|SEG|CON|SYN|ALT|SUP|REC)',\s*dot\(([^)]*)\)/;
    for (let si = 0; si < sections.length; si++) {
      const sec = sections[si];
      const endLine = si < sections.length - 1 ? sections[si + 1].line - 1 : lines.length;
      // Scan the header comment block (first ~30 lines of section)
      const headerEnd = Math.min(sec.line + 30, endLine);
      for (let li = sec.line - 1; li < headerEnd; li++) {
        const raw = lines[li] || '';
        const opMatch = raw.match(opLineRe);
        if (opMatch) {
          sec.operators.push({ op: opMatch[1], target: opMatch[2].trim(), desc: opMatch[3].trim() });
          sec.manifestLines.push(raw.replace(/^\s*\*\s+/, '').trim());
        }
        const triadMatch = raw.match(triadRe);
        if (triadMatch) {
          sec.triad[triadMatch[1]] = triadMatch[2].replace(/^\s*/, '').trim();
        }
      }
      // Scan the section body for function/const definitions and emitOp calls
      for (let li = sec.line - 1; li < endLine; li++) {
        const raw = lines[li] || '';
        const fnMatch = raw.match(fnRe);
        if (fnMatch) sec.definitions.push({ name: fnMatch[1], line: li + 1, type: 'function' });
        else {
          const cfnMatch = raw.match(constFnRe);
          if (cfnMatch) sec.definitions.push({ name: cfnMatch[1], line: li + 1, type: raw.includes('=>') ? 'arrow' : 'component' });
        }
        const emitMatch = raw.match(emitOpRe);
        if (emitMatch) sec.emitOpCalls.push({ op: emitMatch[1], target: emitMatch[2].replace(/'/g, '').trim(), line: li + 1 });
      }
      // Deduplicate operators used
      const opSet = new Set(sec.operators.map(o => o.op));
      sec.emitOpCalls.forEach(c => opSet.add(c.op));
      sec.allOps = [...opSet];
    }
    setEoSections(sections);
    if (sections.length > 0) setActiveSection(sections[0]);
  }, []);

  const toggleCard = (id) => setExpandedCards(prev => ({ ...prev, [id]: !prev[id] }));

  const [sourceView, setSourceView] = useState('code'); // 'code' | 'eomap' | 'info'
  const [jumpToLine, setJumpToLine] = useState(null);

  // Get code for a specific section (no arbitrary cap)
  const getSectionCode = (section) => {
    if (!sourceCode || !section) return '';
    const lines = sourceCode.split('\n');
    const startLine = section.line - 1;
    const nextSection = eoSections.find(s => s.line > section.line);
    const endLine = nextSection ? nextSection.line - 2 : lines.length;
    return lines.slice(startLine, endLine).join('\n');
  };

  // Scroll code viewer to a specific line
  const scrollToLine = (lineNum) => {
    setSourceView('code');
    setJumpToLine(lineNum);
    setTimeout(() => {
      const el = codeRef.current;
      if (el) {
        const lineHeight = 20;
        const sectionStart = activeSection ? activeSection.line : 0;
        el.scrollTop = (lineNum - sectionStart) * lineHeight;
      }
    }, 50);
  };

  // Filter sections by search
  const filteredSections = searchQuery
    ? eoSections.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : eoSections;

  // Privacy model data
  const accessMatrix = [
    { entity: 'Your Vault Data', you: true, provider: false, org: false, network: false, server: false,
      detail: 'Encrypted in your private Matrix room. Only your session keys can decrypt. Not even the homeserver operator can read vault contents.' },
    { entity: 'Bridge Shared Fields', you: true, provider: true, org: false, network: false, server: false,
      detail: 'Only the specific fields you choose to share via a bridge are visible to the linked provider. You control which fields and can revoke at any time.' },
    { entity: 'Observations', you: true, provider: true, org: false, network: false, server: false,
      detail: 'Written by providers into the bridge room. Both you and the provider can read observations. They cannot be silently edited — EO provenance tracks all changes.' },
    { entity: 'Case Messages', you: true, provider: true, org: false, network: false, server: false,
      detail: 'Messages in a bridge room are visible to both parties. End-to-end encrypted via Matrix. The homeserver sees encrypted blobs only.' },
    { entity: 'Org Channel Messages', you: false, provider: true, org: true, network: false, server: false,
      detail: 'Organization-internal channels are visible to org members only. Not shared with individuals/clients.' },
    { entity: 'Anonymized Metrics', you: false, provider: true, org: true, network: true, server: false,
      detail: 'Aggregate, k-anonymized (k=5) demographic data. No PII — no names, DOB, SSN, addresses. Only statistical ranges and hashed identifiers.' },
    { entity: 'Schema Definitions', you: false, provider: true, org: true, network: true, server: false,
      detail: 'Field definitions, form structures, and data standards. Shared across the network for interoperability. Contains no personal data.' },
    { entity: 'EO Operation Log', you: true, provider: true, org: false, network: false, server: false,
      detail: 'Every state change is recorded as an EO operation with provenance chain. Both parties in a room can audit the full operation history.' },
    { entity: 'Matrix Homeserver', you: false, provider: false, org: false, network: false, server: true,
      detail: 'The homeserver stores encrypted event blobs and room membership. It cannot read encrypted content. It knows which rooms exist and who is in them.' },
  ];

  const dataFlows = [
    { from: 'You', to: 'Your Vault', description: 'All personal data starts in your encrypted vault room. Only your device keys can decrypt it.', icon: 'lock' },
    { from: 'You', to: 'Bridge Room', description: 'When you share fields with a provider, selected data is copied into a shared bridge room. You choose exactly which fields.', icon: 'shield' },
    { from: 'Provider', to: 'Bridge Room', description: 'Providers write observations, notes, and case data into the bridge. Both parties can read.', icon: 'clipboard' },
    { from: 'Bridge Room', to: 'Org Metrics', description: 'If you consent, anonymized aggregate statistics (k=5 anonymity) flow upward. No PII ever leaves the bridge.', icon: 'bar' },
    { from: 'Org', to: 'Network', description: 'Organizations can share anonymized metrics and schema definitions with the broader network. Never individual data.', icon: 'layers' },
  ];

  const eoExplainer = [
    { op: 'NUL', name: 'Null', desc: 'Empty state — no entity exists yet. The starting point before any data is created.', triad: 'Existence' },
    { op: 'DES', name: 'Designate', desc: 'Names or classifies an entity. Sets the frame for what something IS without creating data.', triad: 'Existence' },
    { op: 'INS', name: 'Instantiate', desc: 'Creates a new field or entity with a value. The moment data comes into being.', triad: 'Existence' },
    { op: 'SEG', name: 'Segment', desc: 'Partitions data into structural segments. Creates boundaries between logical groups.', triad: 'Structure' },
    { op: 'CON', name: 'Connect', desc: 'Links entities together — provenance chains, relationships, structural connections.', triad: 'Structure' },
    { op: 'SYN', name: 'Synthesize', desc: 'Combines multiple sources into a unified view. Parallel data hydration.', triad: 'Structure' },
    { op: 'ALT', name: 'Alter', desc: 'Changes a value within an existing frame. Every alteration is tracked with from/to provenance.', triad: 'Interpretation' },
    { op: 'SUP', name: 'Superpose', desc: 'Holds multiple valid values simultaneously. Represents uncertainty or competing interpretations.', triad: 'Interpretation' },
    { op: 'REC', name: 'Reconcile', desc: 'Resolves superposition into a single value. The final judgment that collapses alternatives.', triad: 'Interpretation' },
  ];

  const triadColors = { Existence: 'green', Structure: 'blue', Interpretation: 'purple' };

  const AccessDot = ({ yes }) => React.createElement('div', {
    style: {
      width: 10, height: 10, borderRadius: '50%',
      background: yes ? 'var(--green)' : 'var(--bg-4)',
      border: yes ? 'none' : '1px solid var(--border-1)',
      margin: '0 auto'
    }
  });

  // ── Overview Tab ──
  const renderOverview = () => React.createElement('div', { className: 'anim-up' },
    React.createElement('div', { className: 'card', style: { marginBottom: 16 } },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 } },
        React.createElement('div', { style: { width: 36, height: 36, borderRadius: 'var(--r)', background: 'var(--teal-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--teal)' } },
          React.createElement(I, { n: 'shield', s: 18 })),
        React.createElement('div', null,
          React.createElement('h3', { style: { fontSize: 15, fontWeight: 700 } }, 'How Khora Works'),
          React.createElement('p', { style: { fontSize: 11.5, color: 'var(--tx-2)' } }, 'Sovereign case management — you own your data'))),
      React.createElement('div', { style: { fontSize: 13, color: 'var(--tx-1)', lineHeight: 1.7 } },
        React.createElement('p', { style: { marginBottom: 10 } },
          'Khora is a case management system built on Matrix, an open federated protocol for encrypted communication. Your data lives in encrypted Matrix rooms — not in a proprietary database controlled by any single organization.'),
        React.createElement('p', { style: { marginBottom: 10 } },
          'Every state change in the system is governed by the EO (Epistemic Operations) layer — a formal ontological framework with 9 canonical operators organized into 3 triads (Existence, Structure, Interpretation). This means every data change is traceable and auditable.'),
        React.createElement('p', null,
          'The source code of this application is fully visible on this page. Nothing is hidden. You can inspect exactly what the software does, verify the privacy claims, and audit the EO operation logic yourself.'))),

    React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 } },
      [
        { icon: 'lock', color: 'green', title: 'End-to-End Encrypted', desc: 'All data in Matrix rooms is encrypted. Only participants with session keys can decrypt.' },
        { icon: 'shield', color: 'teal', title: 'You Own Your Rooms', desc: 'When you claim a room, you become superadmin (power level 100). You can kick anyone — including providers.' },
        { icon: 'eye', color: 'blue', title: 'Full Transparency', desc: 'This page lets you read the actual running source code. The code IS the documentation.' },
        { icon: 'users', color: 'gold', title: 'Explicit Consent', desc: 'Data only flows where you allow it. Every bridge share is opt-in. Metrics require consent.' },
      ].map((card, i) => React.createElement('div', { key: i, className: 'card', style: { display: 'flex', gap: 10, alignItems: 'flex-start' } },
        React.createElement('div', { style: { width: 30, height: 30, borderRadius: 'var(--r)', background: `var(--${card.color}-dim)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: `var(--${card.color})`, flexShrink: 0 } },
          React.createElement(I, { n: card.icon, s: 15 })),
        React.createElement('div', null,
          React.createElement('div', { style: { fontSize: 13, fontWeight: 700, marginBottom: 3 } }, card.title),
          React.createElement('div', { style: { fontSize: 12, color: 'var(--tx-2)', lineHeight: 1.5 } }, card.desc))))),

    // EO Operators
    React.createElement('div', { className: 'card', style: { marginBottom: 16 } },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 } },
        React.createElement('span', { className: 'section-label', style: { marginBottom: 0 } }, 'EO OPERATION VOCABULARY'),
        React.createElement('span', { style: { fontSize: 10, color: 'var(--tx-3)', fontFamily: 'var(--mono)' } }, '9 canonical operators × 3 triads')),
      React.createElement('div', { className: 'eo-vocab-grid', style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 } },
        eoExplainer.map(op => React.createElement('div', {
          key: op.op,
          style: { padding: '10px 12px', border: '1px solid var(--border-0)', borderRadius: 'var(--r)', background: 'var(--bg-1)' }
        },
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 } },
            React.createElement('span', { className: 'dt-eo', style: { fontWeight: 700 } }, op.op),
            React.createElement('span', { style: { fontSize: 12, fontWeight: 600 } }, op.name),
            React.createElement('span', { className: `tag tag-${triadColors[op.triad]}`, style: { fontSize: 8, padding: '1px 6px', marginLeft: 'auto' } }, op.triad)),
          React.createElement('p', { style: { fontSize: 11.5, color: 'var(--tx-2)', lineHeight: 1.5 } }, op.desc))))));

  // ── Privacy Tab ──
  const renderPrivacy = () => React.createElement('div', { className: 'anim-up' },
    // Access Matrix
    React.createElement('div', { className: 'card', style: { marginBottom: 16 } },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 } },
        React.createElement(I, { n: 'lock', s: 16, c: 'var(--green)' }),
        React.createElement('h3', { style: { fontSize: 15, fontWeight: 700 } }, 'Access Matrix'),
        React.createElement('span', { style: { fontSize: 11, color: 'var(--tx-2)', marginLeft: 'auto', fontFamily: 'var(--mono)' } }, 'who can see what')),
      React.createElement('div', { style: { overflowX: 'auto' } },
        React.createElement('table', { style: { width: '100%', borderCollapse: 'collapse', fontSize: 12 } },
          React.createElement('thead', null,
            React.createElement('tr', { style: { borderBottom: '2px solid var(--border-1)' } },
              React.createElement('th', { style: { padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: 'var(--tx-1)' } }, 'Data'),
              ['You', 'Provider', 'Org', 'Network', 'Server'].map(h =>
                React.createElement('th', { key: h, style: { padding: '8px 6px', textAlign: 'center', fontWeight: 600, color: 'var(--tx-2)', fontSize: 11 } }, h)))),
          React.createElement('tbody', null,
            accessMatrix.map((row, i) => React.createElement(React.Fragment, { key: i },
              React.createElement('tr', {
                style: { borderBottom: '1px solid var(--border-0)', cursor: 'pointer', transition: 'background .15s' },
                onClick: () => toggleCard('access-' + i),
                onMouseEnter: e => e.currentTarget.style.background = 'var(--bg-3)',
                onMouseLeave: e => e.currentTarget.style.background = 'transparent'
              },
                React.createElement('td', { style: { padding: '10px 10px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 } },
                  React.createElement(I, { n: expandedCards['access-' + i] ? 'chevronDown' : 'chevR', s: 10 }),
                  row.entity),
                [row.you, row.provider, row.org, row.network, row.server].map((v, j) =>
                  React.createElement('td', { key: j, style: { padding: '10px 6px', textAlign: 'center' } },
                    React.createElement(AccessDot, { yes: v })))),
              expandedCards['access-' + i] && React.createElement('tr', null,
                React.createElement('td', { colSpan: 6, style: { padding: '8px 10px 12px 28px', fontSize: 12, color: 'var(--tx-2)', lineHeight: 1.6, background: 'var(--bg-1)', borderBottom: '1px solid var(--border-0)' } }, row.detail))))))),

    // Data Flow
    React.createElement('div', { className: 'card', style: { marginBottom: 16 } },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 } },
        React.createElement(I, { n: 'layers', s: 16, c: 'var(--blue)' }),
        React.createElement('h3', { style: { fontSize: 15, fontWeight: 700 } }, 'Data Flow'),
        React.createElement('span', { style: { fontSize: 11, color: 'var(--tx-2)', marginLeft: 'auto', fontFamily: 'var(--mono)' } }, 'how data moves through the system')),
      dataFlows.map((flow, i) => React.createElement('div', {
        key: i,
        style: { display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 0', borderBottom: i < dataFlows.length - 1 ? '1px solid var(--border-0)' : 'none' }
      },
        React.createElement('div', { style: { width: 28, height: 28, borderRadius: 'var(--r)', background: 'var(--bg-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--tx-1)', flexShrink: 0, marginTop: 2 } },
          React.createElement(I, { n: flow.icon, s: 13 })),
        React.createElement('div', null,
          React.createElement('div', { style: { fontSize: 12.5, fontWeight: 600, marginBottom: 2 } },
            React.createElement('span', { style: { color: 'var(--teal)' } }, flow.from),
            React.createElement('span', { style: { color: 'var(--tx-3)', margin: '0 6px' } }, '→'),
            React.createElement('span', { style: { color: 'var(--gold)' } }, flow.to)),
          React.createElement('p', { style: { fontSize: 12, color: 'var(--tx-2)', lineHeight: 1.5 } }, flow.description))))),

    // Key Guarantees
    React.createElement('div', { className: 'card' },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 } },
        React.createElement(I, { n: 'shieldCheck', s: 16, c: 'var(--teal)' }),
        React.createElement('h3', { style: { fontSize: 15, fontWeight: 700 } }, 'Key Privacy Guarantees')),
      [
        { title: 'No hidden data collection', desc: 'There is no analytics, no telemetry, no tracking pixels, no third-party scripts that phone home. The only network calls are to Matrix homeservers you choose.' },
        { title: 'Encryption at rest', desc: 'Matrix rooms use end-to-end encryption. The homeserver stores encrypted blobs. Decryption keys never leave your device.' },
        { title: 'Sovereignty by default', desc: 'When you claim a room, you get power level 100 (superadmin). You can kick anyone — including the provider who created the room. Ownership cannot be revoked.' },
        { title: 'Consent-gated sharing', desc: 'Every bridge share is opt-in. Metrics aggregation requires explicit consent. You can revoke field sharing at any time from your vault.' },
        { title: 'Auditable operations', desc: 'Every state change emits an EO operation with a provenance chain linking it to the previous operation on that entity. The full history is inspectable.' },
        { title: 'K-anonymity for metrics', desc: 'Aggregate metrics use k-anonymity (k=5). Any demographic combination with fewer than 5 matching individuals is suppressed. PII fields are never included.' },
        { title: 'Open protocol, no lock-in', desc: 'Built on Matrix (open federated protocol). You can run your own homeserver, migrate to a different client, or export your data at any time.' },
      ].map((g, i) => React.createElement('div', {
        key: i, style: { padding: '10px 0', borderBottom: i < 6 ? '1px solid var(--border-0)' : 'none', display: 'flex', gap: 10, alignItems: 'flex-start' }
      },
        React.createElement('div', { style: { color: 'var(--green)', flexShrink: 0, marginTop: 2 } },
          React.createElement(I, { n: 'check', s: 14 })),
        React.createElement('div', null,
          React.createElement('div', { style: { fontSize: 13, fontWeight: 600, marginBottom: 2 } }, g.title),
          React.createElement('div', { style: { fontSize: 12, color: 'var(--tx-2)', lineHeight: 1.5 } }, g.desc)))))));

  // ── Source Code Tab ──
  const opBadgeColors = { NUL: 'var(--red, #e74c3c)', DES: 'var(--green)', INS: 'var(--teal)', SEG: 'var(--blue)', CON: 'var(--gold)', SYN: 'var(--purple, #9b59b6)', ALT: 'var(--gold)', SUP: 'var(--purple, #9b59b6)', REC: 'var(--red, #e74c3c)' };
  const triadForOp = { NUL: 'Existence', DES: 'Existence', INS: 'Existence', SEG: 'Structure', CON: 'Structure', SYN: 'Structure', ALT: 'Interpretation', SUP: 'Interpretation', REC: 'Interpretation' };

  // Build EO cross-reference: operator → sections that use it
  const eoXref = useMemo(() => {
    const xref = {};
    OPERATORS.forEach(op => { xref[op] = []; });
    eoSections.forEach(sec => {
      const ops = new Set((sec.operators || []).map(o => o.op));
      (sec.emitOpCalls || []).forEach(c => ops.add(c.op));
      ops.forEach(op => { if (xref[op]) xref[op].push(sec); });
    });
    return xref;
  }, [eoSections]);

  // Section info panel (above code, shows manifest + definitions + emitOp calls)
  const renderSectionInfo = (sec) => {
    if (!sec) return null;
    const hasManifest = sec.operators && sec.operators.length > 0;
    const hasDefs = sec.definitions && sec.definitions.length > 0;
    const hasEmitOps = sec.emitOpCalls && sec.emitOpCalls.length > 0;
    const hasTriad = sec.triad && Object.keys(sec.triad).length > 0;
    if (!hasManifest && !hasDefs && !hasEmitOps) return null;

    return React.createElement('div', { style: { borderBottom: '1px solid var(--border-0)', background: 'var(--bg-2)', maxHeight: 280, overflow: 'auto' } },
      // Operator Manifest
      hasManifest && React.createElement('div', { style: { padding: '8px 16px', borderBottom: '1px solid var(--border-0)' } },
        React.createElement('div', { style: { fontSize: 9, fontWeight: 700, color: 'var(--tx-3)', letterSpacing: '0.05em', marginBottom: 6 } }, 'OPERATOR MANIFEST'),
        sec.operators.map((o, i) => React.createElement('div', { key: i, style: { display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0', fontSize: 11, fontFamily: 'var(--mono)' } },
          React.createElement('span', { style: { display: 'inline-block', padding: '1px 5px', borderRadius: 3, fontSize: 9, fontWeight: 700, color: '#fff', background: opBadgeColors[o.op] || 'var(--tx-3)', minWidth: 28, textAlign: 'center' } }, o.op),
          React.createElement('span', { style: { color: 'var(--tx-1)' } }, o.target),
          React.createElement('span', { style: { color: 'var(--tx-3)', fontSize: 10 } }, '— ' + o.desc)))),
      // Triad Summary
      hasTriad && React.createElement('div', { style: { padding: '6px 16px', borderBottom: '1px solid var(--border-0)', display: 'flex', gap: 12, flexWrap: 'wrap' } },
        Object.entries(sec.triad).map(([triad, detail]) => React.createElement('div', { key: triad, style: { fontSize: 10, display: 'flex', alignItems: 'center', gap: 4 } },
          React.createElement('span', { className: `tag tag-${triadColors[triad]}`, style: { fontSize: 8, padding: '1px 5px' } }, triad),
          React.createElement('span', { style: { color: 'var(--tx-2)', fontFamily: 'var(--mono)' } }, detail)))),
      // Definitions index + emitOp calls side by side
      (hasDefs || hasEmitOps) && React.createElement('div', { style: { display: 'flex', gap: 0 } },
        // Definitions
        hasDefs && React.createElement('div', { style: { flex: 1, padding: '6px 16px', borderRight: hasEmitOps ? '1px solid var(--border-0)' : 'none' } },
          React.createElement('div', { style: { fontSize: 9, fontWeight: 700, color: 'var(--tx-3)', letterSpacing: '0.05em', marginBottom: 4 } },
            'DEFINITIONS (' + sec.definitions.length + ')'),
          React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 3 } },
            sec.definitions.slice(0, 20).map((d, i) => React.createElement('span', {
              key: i,
              onClick: () => scrollToLine(d.line),
              style: { fontSize: 10, fontFamily: 'var(--mono)', padding: '2px 6px', borderRadius: 3, background: 'var(--bg-3)', color: d.type === 'function' ? 'var(--blue)' : 'var(--teal)', cursor: 'pointer', whiteSpace: 'nowrap' },
              title: d.type + ' at line ' + d.line
            }, d.name)))),
        // emitOp calls
        hasEmitOps && React.createElement('div', { style: { flex: 1, padding: '6px 16px' } },
          React.createElement('div', { style: { fontSize: 9, fontWeight: 700, color: 'var(--tx-3)', letterSpacing: '0.05em', marginBottom: 4 } },
            'EO CALLS (' + sec.emitOpCalls.length + ')'),
          React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 3 } },
            sec.emitOpCalls.slice(0, 20).map((c, i) => React.createElement('span', {
              key: i,
              onClick: () => scrollToLine(c.line),
              style: { fontSize: 10, fontFamily: 'var(--mono)', padding: '2px 6px', borderRadius: 3, background: 'var(--bg-3)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }
            },
              React.createElement('span', { style: { color: opBadgeColors[c.op], fontWeight: 700 } }, c.op),
              React.createElement('span', { style: { color: 'var(--tx-2)' } }, c.target.split(', ').slice(0, 2).join('.'))))))));
  };

  // EO Map: cross-reference view showing how operators map to sections
  const renderEoMap = () => React.createElement('div', { style: { padding: 16, overflow: 'auto', flex: 1 } },
    React.createElement('div', { style: { fontSize: 13, fontWeight: 700, marginBottom: 4 } }, 'EO Operator → Section Map'),
    React.createElement('p', { style: { fontSize: 11, color: 'var(--tx-2)', marginBottom: 14, lineHeight: 1.5 } },
      'Shows which sections declare or invoke each EO operator. Click a section to navigate to its code.'),
    // Triads
    ['Existence', 'Structure', 'Interpretation'].map(triad => React.createElement('div', { key: triad, style: { marginBottom: 16 } },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 } },
        React.createElement('span', { className: `tag tag-${triadColors[triad]}`, style: { fontSize: 9, padding: '2px 8px' } }, triad)),
      OPERATORS.filter(op => triadForOp[op] === triad).map(op => React.createElement('div', { key: op, style: { marginBottom: 10, paddingLeft: 8 } },
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 } },
          React.createElement('span', { style: { display: 'inline-block', padding: '2px 6px', borderRadius: 3, fontSize: 10, fontWeight: 700, color: '#fff', background: opBadgeColors[op], minWidth: 32, textAlign: 'center' } }, op),
          React.createElement('span', { style: { fontSize: 11, fontWeight: 600, color: 'var(--tx-1)' } },
            eoExplainer.find(e => e.op === op)?.name || ''),
          React.createElement('span', { style: { fontSize: 10, color: 'var(--tx-3)', marginLeft: 4 } },
            (eoXref[op] || []).length + ' section' + ((eoXref[op] || []).length !== 1 ? 's' : ''))),
        React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 4, paddingLeft: 4 } },
          (eoXref[op] || []).map((sec, i) => React.createElement('span', {
            key: i,
            onClick: () => { setActiveSection(sec); setSourceView('code'); },
            style: { fontSize: 10, fontFamily: 'var(--mono)', padding: '3px 8px', borderRadius: 4, background: 'var(--bg-3)', color: 'var(--tx-1)', cursor: 'pointer', border: '1px solid var(--border-0)', whiteSpace: 'nowrap' },
            onMouseEnter: e => { e.currentTarget.style.background = 'var(--bg-4)'; },
            onMouseLeave: e => { e.currentTarget.style.background = 'var(--bg-3)'; }
          }, sec.name))))))));

  const renderSource = () => React.createElement('div', { className: 'anim-up', style: { display: 'flex', gap: 0, border: '1px solid var(--border-0)', borderRadius: 'var(--r-lg)', overflow: 'hidden', height: 'calc(100vh - 220px)', minHeight: 500 } },
    // Section navigator sidebar (enhanced with operator badges)
    React.createElement('div', { style: { width: 280, minWidth: 280, background: 'var(--bg-2)', borderRight: '1px solid var(--border-0)', display: 'flex', flexDirection: 'column' } },
      React.createElement('div', { style: { padding: '12px 10px', borderBottom: '1px solid var(--border-0)' } },
        React.createElement('input', {
          type: 'text', placeholder: 'Search sections…',
          value: searchQuery, onChange: e => setSearchQuery(e.target.value),
          style: { fontSize: 12, padding: '7px 10px' }
        })),
      React.createElement('div', { style: { padding: '6px 10px', fontSize: 10, color: 'var(--tx-3)', fontFamily: 'var(--mono)', textAlign: 'center', borderBottom: '1px solid var(--border-0)', display: 'flex', justifyContent: 'center', gap: 8 } },
        React.createElement('span', null, filteredSections.length + ' sections'),
        React.createElement('span', null, '·'),
        React.createElement('span', null, eoSections.reduce((n, s) => n + (s.emitOpCalls?.length || 0), 0) + ' EO calls')),
      React.createElement('div', { style: { flex: 1, overflow: 'auto', padding: '4px 0' } },
        filteredSections.map((sec, i) => React.createElement('div', {
          key: i,
          onClick: () => { setActiveSection(sec); setSourceView('code'); },
          style: {
            padding: '7px 10px', cursor: 'pointer', fontSize: 11,
            background: activeSection?.line === sec.line ? 'var(--bg-4)' : 'transparent',
            borderLeft: activeSection?.line === sec.line ? '2px solid var(--gold)' : '2px solid transparent',
            color: activeSection?.line === sec.line ? 'var(--tx-0)' : 'var(--tx-2)',
            transition: 'all .12s', lineHeight: 1.4
          },
          onMouseEnter: e => { if (activeSection?.line !== sec.line) e.currentTarget.style.background = 'var(--bg-3)'; },
          onMouseLeave: e => { if (activeSection?.line !== sec.line) e.currentTarget.style.background = 'transparent'; }
        },
          React.createElement('div', { style: { fontWeight: activeSection?.line === sec.line ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--mono)', fontSize: 10.5 } }, sec.name),
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 } },
            React.createElement('span', { style: { fontSize: 9, color: 'var(--tx-3)', fontFamily: 'var(--mono)' } }, 'L' + sec.line),
            (sec.allOps && sec.allOps.length > 0) && React.createElement('span', { style: { display: 'flex', gap: 2, marginLeft: 4 } },
              sec.allOps.slice(0, 5).map((op, j) => React.createElement('span', {
                key: j,
                style: { fontSize: 7, padding: '0px 3px', borderRadius: 2, fontWeight: 700, color: '#fff', background: opBadgeColors[op] || 'var(--tx-3)', lineHeight: '14px' }
              }, op))),
            sec.definitions && sec.definitions.length > 0 && React.createElement('span', { style: { fontSize: 9, color: 'var(--tx-3)', marginLeft: 'auto', fontFamily: 'var(--mono)' } },
              sec.definitions.length + ' fn')))))),
    // Main content area
    React.createElement('div', { style: { flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-1)', minWidth: 0 } },
      // Header with view toggle
      React.createElement('div', { style: { padding: '8px 16px', borderBottom: '1px solid var(--border-0)', display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-2)' } },
        React.createElement(I, { n: 'eye', s: 14, c: 'var(--gold)' }),
        React.createElement('span', { style: { fontSize: 13, fontWeight: 600 } }, activeSection?.name || 'Source Code'),
        // View toggle buttons
        React.createElement('div', { style: { display: 'flex', gap: 2, marginLeft: 'auto', background: 'var(--bg-3)', borderRadius: 'var(--r)', padding: 2 } },
          [{ id: 'code', label: 'Code' }, { id: 'eomap', label: 'EO Map' }].map(v => React.createElement('button', {
            key: v.id,
            onClick: () => setSourceView(v.id),
            style: { fontSize: 10, padding: '3px 10px', borderRadius: 3, border: 'none', cursor: 'pointer', fontWeight: sourceView === v.id ? 700 : 400, background: sourceView === v.id ? 'var(--bg-1)' : 'transparent', color: sourceView === v.id ? 'var(--tx-0)' : 'var(--tx-3)', transition: 'all .12s' }
          }, v.label))),
        React.createElement('span', { style: { fontSize: 9, color: 'var(--tx-3)', fontFamily: 'var(--mono)', background: 'var(--bg-3)', padding: '2px 6px', borderRadius: 'var(--r)' } }, 'LIVE · READ-ONLY')),
      // Section info panel (manifests, definitions, emitOp calls)
      sourceView === 'code' && renderSectionInfo(activeSection),
      // EO Map view
      sourceView === 'eomap' && renderEoMap(),
      // Code viewer with EO highlighting
      sourceView === 'code' && React.createElement('pre', {
        ref: codeRef,
        style: { flex: 1, overflow: 'auto', padding: '12px 0', margin: 0, fontFamily: 'var(--mono)', fontSize: 11.5, lineHeight: 1.6, color: 'var(--tx-1)', whiteSpace: 'pre', tabSize: 2 }
      },
        (activeSection ? getSectionCode(activeSection) : sourceCode.slice(0, 5000)).split('\n').map((line, i) => {
          const lineNum = activeSection ? activeSection.line + i : i + 1;
          const isEmitOp = line.includes('emitOp(');
          const isComment = line.trim().startsWith('/*') || line.trim().startsWith('*') || line.trim().startsWith('//');
          const isDef = line.match(/^(?:async\s+)?function\s+/) || line.match(/^const\s+\w+\s*=/);
          const isSectionHeader = line.includes('═══');
          return React.createElement('div', {
            key: i,
            style: {
              display: 'flex', paddingRight: 16, minHeight: 20,
              background: isEmitOp ? 'rgba(243, 156, 18, 0.06)' : isSectionHeader ? 'rgba(52, 152, 219, 0.04)' : 'transparent'
            }
          },
            React.createElement('span', { style: { width: 52, textAlign: 'right', paddingRight: 12, color: isEmitOp ? 'var(--gold)' : 'var(--tx-3)', userSelect: 'none', flexShrink: 0, fontSize: 10, fontWeight: isEmitOp ? 700 : 400 } }, lineNum),
            isEmitOp ? React.createElement('span', { style: { flex: 1, paddingLeft: 4 } },
              (() => {
                const parts = line.split(/(emitOp\([^,]+,\s*'(?:NUL|DES|INS|SEG|CON|SYN|ALT|SUP|REC)')/);
                return parts.map((part, pi) => {
                  const m = part.match(/emitOp\([^,]+,\s*'(NUL|DES|INS|SEG|CON|SYN|ALT|SUP|REC)'/);
                  if (m) return React.createElement('span', { key: pi },
                    React.createElement('span', { style: { color: 'var(--gold)', fontWeight: 600 } }, 'emitOp'),
                    React.createElement('span', { style: { color: 'var(--tx-1)' } }, part.slice(6, part.indexOf("'" + m[1] + "'"))),
                    React.createElement('span', { style: { display: 'inline-block', padding: '0 4px', borderRadius: 2, fontSize: 10, fontWeight: 700, color: '#fff', background: opBadgeColors[m[1]], margin: '0 1px' } }, m[1]),
                    React.createElement('span', { style: { color: 'var(--tx-1)' } }, "'"));
                  return React.createElement('span', { key: pi, style: { color: 'var(--tx-1)' } }, part);
                });
              })()
            ) : React.createElement('span', { style: {
              flex: 1, paddingLeft: 4,
              color: isComment ? 'var(--tx-3)' :
                     isSectionHeader ? 'var(--blue)' :
                     isDef ? 'var(--blue)' :
                     line.includes("'NUL'") || line.includes("'DES'") || line.includes("'INS'") || line.includes("'SEG'") || line.includes("'CON'") || line.includes("'SYN'") || line.includes("'ALT'") || line.includes("'SUP'") || line.includes("'REC'") ? 'var(--gold)' :
                     line.match(/['"`]/) ? 'var(--green)' : 'var(--tx-1)',
              fontWeight: isDef ? 600 : isSectionHeader ? 700 : 400
            } }, line || ' '));
        }))));

  // ── Architecture Tab ──
  const ARCH_NODES = [
    {
      id: 'vault', label: 'Your Vault', desc: 'Personal encrypted Matrix room that stores all your data. Only you hold the keys.',
      color: '#3ecf8e', dimColor: 'rgba(62,207,142,.15)', icon: 'lock',
      children: [
        { id: 'vault-fields', label: 'Vault Fields', desc: 'Encrypted personal data fields — name, DOB, identifiers, custom fields. Stored as Matrix state events.', color: '#3ecf8e', dimColor: 'rgba(62,207,142,.15)' },
        { id: 'vault-consent', label: 'Consent Settings', desc: 'Per-field consent flags controlling which data can be shared with providers via bridges.', color: '#3ecf8e', dimColor: 'rgba(62,207,142,.15)' },
        { id: 'vault-schemas', label: 'Field Schemas', desc: 'Schema definitions that describe the structure and validation rules for vault data fields.', color: '#3ecf8e', dimColor: 'rgba(62,207,142,.15)' },
        { id: 'vault-oplog', label: 'Operation Log', desc: 'Chronological log of every EO operation performed on vault data — fully auditable.', color: '#3ecf8e', dimColor: 'rgba(62,207,142,.15)' }
      ],
      childEdges: [
        { from: 0, to: 1, label: 'gates sharing' },
        { from: 2, to: 0, label: 'validates' },
        { from: 3, to: 0, label: 'records changes' }
      ]
    },
    {
      id: 'bridge', label: 'Bridge Room', desc: 'Shared encrypted room between you and a provider. Data only flows here with explicit consent.',
      color: '#5bc0be', dimColor: 'rgba(91,192,190,.15)', icon: 'link',
      children: [
        { id: 'bridge-fields', label: 'Shared Fields', desc: 'Vault fields you have explicitly consented to share with this provider.', color: '#5bc0be', dimColor: 'rgba(91,192,190,.15)' },
        { id: 'bridge-obs', label: 'Observations', desc: 'Clinical or service observations recorded by the provider about this case.', color: '#5bc0be', dimColor: 'rgba(91,192,190,.15)' },
        { id: 'bridge-msgs', label: 'Messages', desc: 'End-to-end encrypted messages between you and the provider within this bridge.', color: '#5bc0be', dimColor: 'rgba(91,192,190,.15)' },
        { id: 'bridge-settings', label: 'Bridge Settings', desc: 'Configuration for the bridge — consent state, power levels, room permissions.', color: '#5bc0be', dimColor: 'rgba(91,192,190,.15)' }
      ],
      childEdges: [
        { from: 0, to: 1, label: 'context for' },
        { from: 0, to: 2, label: 'referenced in' },
        { from: 3, to: 0, label: 'controls access' }
      ]
    },
    {
      id: 'provider', label: 'Provider', desc: 'Provider dashboard for managing cases, recording observations, and coordinating care.',
      color: '#5b9cf5', dimColor: 'rgba(91,156,245,.15)', icon: 'briefcase',
      children: [
        { id: 'prov-cases', label: 'Cases', desc: 'Active cases the provider manages — each linked to a bridge room with a client.', color: '#5b9cf5', dimColor: 'rgba(91,156,245,.15)' },
        { id: 'prov-individuals', label: 'Individuals', desc: 'Client profiles visible to the provider, built from consented shared data.', color: '#5b9cf5', dimColor: 'rgba(91,156,245,.15)' },
        { id: 'prov-resources', label: 'Resources', desc: 'Services, programs, and referral resources the provider can allocate to cases.', color: '#5b9cf5', dimColor: 'rgba(91,156,245,.15)' },
        { id: 'prov-metrics', label: 'Metrics', desc: 'Outcome and activity metrics tracked per case and per provider.', color: '#5b9cf5', dimColor: 'rgba(91,156,245,.15)' }
      ],
      childEdges: [
        { from: 0, to: 1, label: 'linked to' },
        { from: 2, to: 0, label: 'allocated to' },
        { from: 3, to: 0, label: 'measured from' }
      ]
    },
    {
      id: 'org', label: 'Organization', desc: 'Org-level coordination — teams, internal channels, schema management, and aggregated metrics.',
      color: '#e5a550', dimColor: 'rgba(229,165,80,.15)', icon: 'briefcase',
      children: [
        { id: 'org-teams', label: 'Teams', desc: 'Provider teams within the organization, with role-based access control.', color: '#e5a550', dimColor: 'rgba(229,165,80,.15)' },
        { id: 'org-channels', label: 'Channels', desc: 'Internal encrypted communication channels for org-wide coordination.', color: '#e5a550', dimColor: 'rgba(229,165,80,.15)' },
        { id: 'org-schema', label: 'Schema Registry', desc: 'Shared field schemas and observation templates used across the organization.', color: '#e5a550', dimColor: 'rgba(229,165,80,.15)' },
        { id: 'org-settings', label: 'Org Settings', desc: 'Organization configuration — branding, consent policies, governance rules.', color: '#e5a550', dimColor: 'rgba(229,165,80,.15)' }
      ],
      childEdges: [
        { from: 0, to: 1, label: 'communicate via' },
        { from: 2, to: 0, label: 'shared across' },
        { from: 3, to: 2, label: 'governs' }
      ]
    },
    {
      id: 'network', label: 'Network', desc: 'Cross-organization discovery and schema sharing. Enables interoperability between orgs.',
      color: '#b090d4', dimColor: 'rgba(176,144,212,.15)', icon: 'users',
      children: [
        { id: 'net-discovery', label: 'Discovery', desc: 'Find other organizations and their published service catalogs.', color: '#b090d4', dimColor: 'rgba(176,144,212,.15)' },
        { id: 'net-schemas', label: 'Schema Sharing', desc: 'Cross-org schema federation — publish and subscribe to field definitions.', color: '#b090d4', dimColor: 'rgba(176,144,212,.15)' },
        { id: 'net-resources', label: 'Resource Catalog', desc: 'Network-wide directory of available services and resources.', color: '#b090d4', dimColor: 'rgba(176,144,212,.15)' }
      ],
      childEdges: [
        { from: 0, to: 2, label: 'finds' },
        { from: 1, to: 0, label: 'enables' }
      ]
    },
    {
      id: 'matrix', label: 'Matrix Protocol', desc: 'The underlying open federation protocol. All rooms, events, and encryption happen here.',
      color: '#6b7385', dimColor: 'rgba(107,115,133,.15)', icon: 'layers',
      children: [
        { id: 'mx-rooms', label: 'Rooms', desc: 'Matrix rooms are the containers for all data — vaults, bridges, channels are all rooms.', color: '#6b7385', dimColor: 'rgba(107,115,133,.15)' },
        { id: 'mx-events', label: 'Events', desc: 'State events and timeline events — every data change is a Matrix event.', color: '#6b7385', dimColor: 'rgba(107,115,133,.15)' },
        { id: 'mx-e2ee', label: 'E2E Encryption', desc: 'Olm/Megolm encryption ensures only room members with session keys can read data.', color: '#6b7385', dimColor: 'rgba(107,115,133,.15)' },
        { id: 'mx-federation', label: 'Federation', desc: 'Homeservers federate — data is replicated but encrypted. No single point of control.', color: '#6b7385', dimColor: 'rgba(107,115,133,.15)' }
      ],
      childEdges: [
        { from: 0, to: 1, label: 'contain' },
        { from: 2, to: 1, label: 'encrypts' },
        { from: 3, to: 0, label: 'replicates' }
      ]
    },
    {
      id: 'eo', label: 'EO Layer', desc: 'Epistemic Operations — 9 canonical operators that track every state change with formal semantics.',
      color: '#e06c75', dimColor: 'rgba(224,108,117,.15)', icon: 'shield',
      children: [
        { id: 'eo-nul', label: '\u2205 NUL', desc: 'Null / Destroy — absence, void, revocation. When data or access is removed.', color: '#e06c75', dimColor: 'rgba(224,108,117,.15)', sublabel: 'Existence' },
        { id: 'eo-des', label: '\u225d DES', desc: 'Designate — names or classifies an entity. Sets the frame for what something IS.', color: '#3ecf8e', dimColor: 'rgba(62,207,142,.15)', sublabel: 'Existence' },
        { id: 'eo-ins', label: '\u25b3 INS', desc: 'Instantiate — creates a new entity with a value. The moment data comes into being.', color: '#5bc0be', dimColor: 'rgba(91,192,190,.15)', sublabel: 'Existence' },
        { id: 'eo-seg', label: '\u22a2 SEG', desc: 'Segment — partitions data into structural segments. Creates boundaries between groups.', color: '#5b9cf5', dimColor: 'rgba(91,156,245,.15)', sublabel: 'Structure' },
        { id: 'eo-con', label: '\u22c8 CON', desc: 'Connect — links entities together. Provenance chains, allocations, bridges.', color: '#e5a550', dimColor: 'rgba(229,165,80,.15)', sublabel: 'Structure' },
        { id: 'eo-syn', label: '\u2228 SYN', desc: 'Synthesize — merges multiple sources into a unified view. Parallel hydration.', color: '#b090d4', dimColor: 'rgba(176,144,212,.15)', sublabel: 'Structure' },
        { id: 'eo-alt', label: '\u223f ALT', desc: 'Alter — changes a value within an existing frame. Status transitions, field updates.', color: '#e5a550', dimColor: 'rgba(229,165,80,.15)', sublabel: 'Interpretation' },
        { id: 'eo-sup', label: '\u29a6 SUP', desc: 'Superpose — holds multiple valid values simultaneously. Competing interpretations.', color: '#b090d4', dimColor: 'rgba(176,144,212,.15)', sublabel: 'Interpretation' },
        { id: 'eo-rec', label: '\u21bb REC', desc: 'Reconcile — resolves superposition into a single value. The final judgment.', color: '#e06c75', dimColor: 'rgba(224,108,117,.15)', sublabel: 'Interpretation' }
      ],
      childEdges: [
        { from: 0, to: 1, label: 'precedes' },
        { from: 1, to: 2, label: 'precedes' },
        { from: 3, to: 4, label: 'precedes' },
        { from: 4, to: 5, label: 'precedes' },
        { from: 6, to: 7, label: 'precedes' },
        { from: 7, to: 8, label: 'resolves' }
      ]
    }
  ];

  const ARCH_EDGES = [
    { from: 0, to: 1, label: 'opt-in sharing' },
    { from: 1, to: 2, label: 'shared observations' },
    { from: 2, to: 3, label: 'anonymized metrics' },
    { from: 3, to: 4, label: 'schema sharing' },
    { from: 5, to: 0, label: 'encrypted sync' },
    { from: 5, to: 1, label: 'encrypted sync', dashed: true },
    { from: 6, to: 0, label: 'tracks changes', dashed: true },
    { from: 6, to: 1, label: 'tracks changes', dashed: true }
  ];

  // Map sub-components to source code sections for Level 2 drill-down
  const SECTION_MAP = {
    'vault-fields': ['VAULT', 'FIELD', 'CLAIM'],
    'vault-consent': ['CONSENT', 'BRIDGE'],
    'vault-schemas': ['SCHEMA', 'FIELD'],
    'vault-oplog': ['EO FRAMEWORK', 'OPERATION'],
    'bridge-fields': ['BRIDGE', 'FIELD'],
    'bridge-obs': ['OBSERVATION'],
    'bridge-msgs': ['BRIDGE', 'MESSAGE', 'INBOX'],
    'bridge-settings': ['BRIDGE', 'CONSENT'],
    'prov-cases': ['CASE', 'PROVIDER'],
    'prov-individuals': ['INDIVIDUAL', 'CLIENT'],
    'prov-metrics': ['METRIC', 'DASHBOARD'],
    'prov-resources': ['RESOURCE'],
    'org-teams': ['TEAM'],
    'org-channels': ['CHANNEL', 'ORG'],
    'org-schema': ['SCHEMA', 'REGISTRY'],
    'org-settings': ['ORG', 'SETTINGS'],
    'net-discovery': ['NETWORK', 'DISCOVER'],
    'net-schemas': ['SCHEMA', 'NETWORK'],
    'net-resources': ['RESOURCE', 'CATALOG'],
    'mx-rooms': ['MATRIX', 'ROOM'],
    'mx-events': ['EVENT', 'STATE'],
    'mx-e2ee': ['ENCRYPT', 'CRYPTO'],
    'mx-federation': ['FEDERATION', 'HOMESERVER'],
    'eo-nul': ['NUL'], 'eo-des': ['DES'], 'eo-ins': ['INS'],
    'eo-seg': ['SEG'], 'eo-con': ['CON'], 'eo-syn': ['SYN'],
    'eo-alt': ['ALT'], 'eo-sup': ['SUP'], 'eo-rec': ['REC']
  };

  const getArchNodes = () => {
    if (archLevel === 0) {
      return ARCH_NODES.map(n => ({
        id: n.id, label: n.label, desc: n.desc, color: n.color, dimColor: n.dimColor,
        childCount: n.children.length, sublabel: n.children.length + ' components', type: 'system'
      }));
    }
    if (archLevel === 1) {
      const parent = ARCH_NODES.find(n => n.id === archPath[0]?.id);
      if (!parent) return [];
      return parent.children.map(c => ({
        id: c.id, label: c.label, desc: c.desc, color: c.color, dimColor: c.dimColor,
        sublabel: c.sublabel || '', type: 'component',
        childCount: (SECTION_MAP[c.id] || []).length > 0 ? 1 : 0
      }));
    }
    if (archLevel === 2) {
      const parentNode = ARCH_NODES.find(n => n.id === archPath[0]?.id);
      const child = parentNode?.children.find(c => c.id === archPath[1]?.id);
      if (!child) return [];
      const keywords = SECTION_MAP[child.id] || [];
      const matched = eoSections.filter(s => keywords.some(k => s.name.toUpperCase().includes(k)));
      if (matched.length === 0) return [];
      return matched.map((s, i) => ({
        id: 'sec-' + i, label: s.name.length > 28 ? s.name.slice(0, 26) + '\u2026' : s.name,
        fullLabel: s.name,
        desc: 'Line ' + s.line + ' \xb7 ' + s.definitions.length + ' definitions \xb7 ' + s.allOps.length + ' operators',
        color: child.color, dimColor: child.dimColor,
        childCount: 0, sublabel: s.definitions.length + ' funcs',
        allOps: s.allOps, operators: s.operators, definitions: s.definitions, type: 'section'
      }));
    }
    return [];
  };

  const getArchEdges = (nodes) => {
    if (archLevel === 0) return ARCH_EDGES;
    if (archLevel === 1) {
      const parent = ARCH_NODES.find(n => n.id === archPath[0]?.id);
      return parent?.childEdges || [];
    }
    if (archLevel === 2) {
      const edges = [];
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const shared = (nodes[i].allOps || []).filter(o => (nodes[j].allOps || []).includes(o));
          if (shared.length > 0) edges.push({ from: i, to: j, label: shared.slice(0, 3).join(','), dashed: shared.length === 1 });
        }
      }
      return edges.slice(0, 20);
    }
    return [];
  };

  const archDrillDown = (node) => {
    if (node.type === 'section') { setArchSelected(node); return; }
    if (node.childCount === 0) { setArchSelected(node); return; }
    setArchPath(prev => [...prev, node]);
    setArchLevel(prev => prev + 1);
    setArchSelected(null);
  };

  const archNavigateTo = (depth) => {
    if (depth < 0) { setArchLevel(0); setArchPath([]); setArchSelected(null); }
    else { setArchPath(prev => prev.slice(0, depth + 1)); setArchLevel(depth + 1); setArchSelected(null); }
  };

  const archComputeLayout = (nodes, edges) => {
    const count = nodes.length;
    if (count === 0) return { positions: [], edgePaths: [] };
    const W = 900, H = Math.max(600, Math.ceil(count / 5) * 120 + 200);
    const positions = [];
    if (count <= 3) {
      if (count === 1) positions.push({ x: W / 2, y: H / 2 });
      else if (count === 2) { positions.push({ x: W / 3, y: H / 2 }); positions.push({ x: 2 * W / 3, y: H / 2 }); }
      else { positions.push({ x: W / 2, y: 130 }); positions.push({ x: 180, y: H - 150 }); positions.push({ x: W - 180, y: H - 150 }); }
    } else if (count <= 9) {
      const cols = Math.ceil(Math.sqrt(count));
      const rows = Math.ceil(count / cols);
      const gapX = W / (cols + 1), gapY = H / (rows + 1);
      for (let i = 0; i < count; i++) positions.push({ x: gapX * ((i % cols) + 1), y: gapY * (Math.floor(i / cols) + 1) });
    } else {
      const cols = Math.min(5, count);
      const gapX = W / (cols + 1), gapY = Math.min(110, (H - 60) / (Math.ceil(count / cols) + 1));
      for (let i = 0; i < count; i++) positions.push({ x: gapX * ((i % cols) + 1), y: 80 + gapY * (Math.floor(i / cols) + 1) });
    }
    const edgePaths = edges.map(e => {
      const from = positions[e.from], to = positions[e.to];
      if (!from || !to) return null;
      const dx = to.x - from.x, dy = to.y - from.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const nx = dx / dist, ny = dy / dist;
      const x1 = from.x + nx * 45, y1 = from.y + ny * 35;
      const x2 = to.x - nx * 45, y2 = to.y - ny * 35;
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      const cx = mx - (y2 - y1) * 0.12, cy = my + (x2 - x1) * 0.12;
      return { ...e, path: 'M' + x1 + ',' + y1 + ' Q' + cx + ',' + cy + ' ' + x2 + ',' + y2, x1, y1, x2, y2, cx, cy };
    }).filter(Boolean);
    return { positions, edgePaths };
  };

  const levelLabels = ['System', 'Component', 'Sub-component', 'Source'];

  const renderArchitecture = () => {
    const nodes = getArchNodes();
    const edges = getArchEdges(nodes);
    const { positions, edgePaths } = archComputeLayout(nodes, edges);
    const svgH = Math.max(600, Math.ceil(nodes.length / 5) * 120 + 200);

    return React.createElement('div', { className: 'eo-graph-wrap', style: { height: 'calc(100vh - 220px)', minHeight: 500 } },
      // Header + breadcrumb
      React.createElement('div', { className: 'eo-graph-header' },
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
          React.createElement(I, { n: 'graphNodes', s: 18, c: 'var(--teal)' }),
          React.createElement('h3', { style: { fontSize: 16, fontWeight: 700 } }, 'How Khora Works')),
        React.createElement('div', { style: { flex: 1 } }),
        React.createElement('div', { className: 'eo-graph-breadcrumb' },
          React.createElement('span', { className: 'bc-seg', onClick: () => { setArchLevel(0); setArchPath([]); setArchSelected(null); } }, 'System'),
          archPath.map((p, i) => React.createElement(React.Fragment, { key: i },
            React.createElement('span', { className: 'bc-sep' }, ' \u203a '),
            i < archPath.length - 1
              ? React.createElement('span', { className: 'bc-seg', onClick: () => archNavigateTo(i) }, p.label)
              : React.createElement('span', { className: 'bc-cur' }, p.label)
          ))
        ),
        React.createElement('span', {
          style: { fontSize: 10, color: 'var(--tx-3)', fontFamily: 'var(--mono)', padding: '3px 8px', background: 'var(--bg-3)', borderRadius: 'var(--r)' }
        }, 'L' + archLevel + ' \xb7 ' + (levelLabels[archLevel] || 'Detail'))
      ),
      // SVG canvas
      React.createElement('div', { className: 'eo-graph-canvas' },
        React.createElement('svg', {
          className: 'eo-graph-svg', viewBox: '0 0 900 ' + svgH, preserveAspectRatio: 'xMidYMid meet'
        },
          React.createElement('defs', null,
            React.createElement('marker', { id: 'arch-arrow', markerWidth: '8', markerHeight: '6', refX: '8', refY: '3', orient: 'auto' },
              React.createElement('polygon', { points: '0 0, 8 3, 0 6', className: 'eo-edge-arrow' })),
            React.createElement('filter', { id: 'arch-glow' },
              React.createElement('feGaussianBlur', { stdDeviation: '3', result: 'coloredBlur' }),
              React.createElement('feMerge', null,
                React.createElement('feMergeNode', { in: 'coloredBlur' }),
                React.createElement('feMergeNode', { in: 'SourceGraphic' })))
          ),
          // Edges
          edgePaths.map((e, i) => React.createElement('g', { key: 'e' + i },
            React.createElement('path', { d: e.path, className: 'eo-edge', markerEnd: 'url(#arch-arrow)', strokeDasharray: e.dashed ? '6,4' : 'none' }),
            e.label && React.createElement('text', {
              x: e.cx || (e.x1 + e.x2) / 2, y: (e.cy || (e.y1 + e.y2) / 2) - 8,
              textAnchor: 'middle', style: { fontSize: 9, fill: 'var(--tx-3)', fontFamily: 'var(--mono)' }
            }, e.label)
          )),
          // Nodes
          nodes.map((node, i) => {
            const pos = positions[i];
            if (!pos) return null;
            const isHov = archHovered === node.id;
            const isSel = archSelected?.id === node.id;
            const nW = archLevel === 0 ? 160 : (archLevel === 2 ? 180 : 160);
            const nH = archLevel === 0 ? 80 : (archLevel === 2 ? 80 : 70);
            return React.createElement('g', {
              key: node.id, className: 'eo-node',
              transform: 'translate(' + (pos.x - nW / 2) + ',' + (pos.y - nH / 2) + ')',
              onClick: () => archDrillDown(node),
              onMouseEnter: () => setArchHovered(node.id),
              onMouseLeave: () => setArchHovered(null)
            },
              React.createElement('rect', {
                className: 'eo-node-bg', width: nW, height: nH,
                fill: node.dimColor || 'var(--bg-2)',
                stroke: isSel ? node.color : (isHov ? node.color : 'var(--border-1)'),
                strokeWidth: isSel ? 2.5 : (isHov ? 2 : 1),
                filter: isHov ? 'url(#arch-glow)' : 'none'
              }),
              React.createElement('text', {
                x: nW / 2, y: nH / 2 - 8, textAnchor: 'middle',
                style: { fontSize: archLevel === 0 ? 14 : 12, fontWeight: 700, fill: node.color || 'var(--tx-0)' }
              }, node.label),
              React.createElement('text', {
                x: nW / 2, y: nH / 2 + 8, textAnchor: 'middle',
                style: { fontSize: 9, fill: 'var(--tx-2)', fontFamily: 'var(--mono)' }
              }, node.sublabel),
              node.childCount > 0 && React.createElement('text', {
                x: nW / 2, y: nH - 6, textAnchor: 'middle', style: { fontSize: 8, fill: 'var(--tx-3)' }
              }, 'click to expand \u203a')
            );
          })
        ),
        // Detail panel
        archSelected && React.createElement('div', { className: 'eo-graph-detail' },
          React.createElement('div', { className: 'detail-head' },
            React.createElement('div', {
              style: { width: 28, height: 28, borderRadius: 'var(--r)', background: archSelected.dimColor || 'var(--bg-3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: archSelected.color || 'var(--tx-0)', fontWeight: 700, fontSize: 11, fontFamily: 'var(--mono)' }
            }, (archSelected.label || '').slice(0, 3)),
            React.createElement('div', { style: { flex: 1 } },
              React.createElement('div', { style: { fontSize: 14, fontWeight: 700 } }, archSelected.fullLabel || archSelected.label),
              React.createElement('div', { style: { fontSize: 10, color: 'var(--tx-2)', fontFamily: 'var(--mono)' } }, archSelected.sublabel)),
            React.createElement('div', { onClick: () => setArchSelected(null), style: { cursor: 'pointer', padding: 4 } },
              React.createElement(I, { n: 'x', s: 14 }))
          ),
          React.createElement('div', { className: 'detail-body' },
            React.createElement('p', null, archSelected.desc),
            archSelected.allOps && archSelected.allOps.length > 0 && React.createElement('div', null,
              React.createElement('div', { style: { fontSize: 10, fontWeight: 600, color: 'var(--tx-2)', marginTop: 10, marginBottom: 4 } }, 'OPERATORS USED'),
              React.createElement('div', { className: 'detail-ops' },
                (archSelected.allOps || []).map(op => React.createElement('span', { key: op,
                  style: { padding: '2px 8px', borderRadius: 'var(--r)', fontSize: 10, fontWeight: 700, fontFamily: 'var(--mono)',
                    background: 'var(--bg-3)', color: 'var(--tx-1)' }
                }, op)))),
            archSelected.definitions && archSelected.definitions.length > 0 && React.createElement('div', null,
              React.createElement('div', { style: { fontSize: 10, fontWeight: 600, color: 'var(--tx-2)', marginTop: 10, marginBottom: 4 } }, 'FUNCTIONS'),
              archSelected.definitions.map((d, di) => React.createElement('div', { key: di,
                style: { padding: '4px 8px', marginBottom: 2, fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--tx-1)', background: 'var(--bg-3)', borderRadius: 'var(--r)' }
              }, d.name + ' (line ' + d.line + ')')))
          )
        )
      ),
      // Legend
      React.createElement('div', { className: 'eo-graph-legend' },
        React.createElement(I, { n: 'graphNodes', s: 13 }),
        React.createElement('span', { style: { fontWeight: 600 } }, 'Architecture:'),
        ARCH_NODES.slice(0, 4).map(n => React.createElement('div', { key: n.id, style: { display: 'flex', alignItems: 'center', gap: 5 } },
          React.createElement('div', { className: 'leg-dot', style: { background: n.color } }),
          React.createElement('span', null, n.label))),
        React.createElement('div', { style: { marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 } },
          React.createElement('span', null, 'Level ' + archLevel),
          React.createElement('span', null, nodes.length + ' nodes'),
          React.createElement('span', null, edgePaths.length + ' edges'))
      )
    );
  };

  return React.createElement('div', { className: 'anim-up', style: { maxWidth: activeTab === 'source' || activeTab === 'architecture' ? 1400 : 1000, margin: '0 auto', transition: 'max-width .3s' } },
    // Header
    React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 } },
      onBack && React.createElement('button', { onClick: onBack, className: 'b-gho b-sm', style: { display: 'flex', alignItems: 'center', gap: 4 } },
        React.createElement(I, { n: 'back', s: 13 }), 'Back'),
      React.createElement('div', null,
        React.createElement('h2', { style: { fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 700 } }, 'Transparency & Privacy'),
        React.createElement('p', { style: { color: 'var(--tx-1)', fontSize: 12.5, marginTop: 2 } },
          'How Khora works, who has access, and the full source code — nothing hidden'))),
    // Tabs
    React.createElement('div', { className: 'tabs' },
      [{ id: 'overview', label: 'How It Works' }, { id: 'privacy', label: 'Privacy & Access' }, { id: 'source', label: 'Source Code' }, { id: 'architecture', label: 'Architecture' }].map(t =>
        React.createElement('div', {
          key: t.id,
          className: 'tab' + (activeTab === t.id ? ' active' : ''),
          onClick: () => setActiveTab(t.id)
        }, t.label))),
    // Content
    activeTab === 'overview' && renderOverview(),
    activeTab === 'privacy' && renderPrivacy(),
    activeTab === 'source' && renderSource(),
    activeTab === 'architecture' && renderArchitecture());
};

/* ═══════════════════ MAIN APP ═══════════════════ */
