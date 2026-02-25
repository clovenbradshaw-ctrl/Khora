const MEANT_SIGNAL_WORDS = ['category', 'classification', 'level', 'status', 'type', 'code', 'score', 'rating', 'rank', 'tier', 'class', 'grade', 'priority', 'eligibility', 'determination', 'assessment'];
const checkGivenTest = text => {
  const lower = text.toLowerCase();
  const found = MEANT_SIGNAL_WORDS.filter(w => lower.includes(w));
  return found.length > 0 ? found : null;
};
const suggestGivenRephrasing = text => {
  const lower = text.toLowerCase();
  if (lower.includes('homeless') && lower.includes('category')) return ['Where did you sleep last night?', 'Describe your current living situation.'];
  if (lower.includes('status')) return ['What is happening right now?', 'Describe the current situation.'];
  if (lower.includes('priority') || lower.includes('level')) return ['What did you observe?', 'Describe what you see.'];
  if (lower.includes('eligibility') || lower.includes('determination')) return ['What information was provided?', 'What was reported?'];
  if (lower.includes('assessment') || lower.includes('score')) return ['What did you observe during the interaction?', 'Describe the person\'s current condition.'];
  return ['Rephrase as something a person could answer from their own experience.'];
};
let _fbId = 5000;
const fbUid = () => `fb_${_fbId++}`;

/* ── Form key generation — creates a stable snake_case key from a name ── */
const formNameToKey = name => name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 48) || 'unnamed_form';

/* ── Version diff — compares two form versions and returns structural changes ── */
const diffFormVersions = (oldForm, newForm) => {
  const changes = {
    added: [],
    removed: [],
    renamed: [],
    typeChanged: []
  };
  const oldQs = (oldForm?.sections || []).flatMap(s => s.questions || []);
  const newQs = (newForm?.sections || []).flatMap(s => s.questions || []);
  const oldById = Object.fromEntries(oldQs.map(q => [q.id, q]));
  const newById = Object.fromEntries(newQs.map(q => [q.id, q]));
  // Removed questions
  oldQs.forEach(oq => {
    if (!newById[oq.id]) changes.removed.push(oq);
  });
  // Added questions
  newQs.forEach(nq => {
    if (!oldById[nq.id]) changes.added.push(nq);
  });
  // Modified questions
  newQs.forEach(nq => {
    const oq = oldById[nq.id];
    if (!oq) return;
    if (oq.prompt !== nq.prompt) changes.renamed.push({
      old: oq,
      new: nq
    });
    if (oq.type !== nq.type) changes.typeChanged.push({
      old: oq,
      new: nq
    });
  });
  // Option-level changes
  const oldOpts = oldQs.flatMap(q => (q.options || []).map(o => ({
    ...o,
    questionId: q.id,
    questionPrompt: q.prompt
  })));
  const newOpts = newQs.flatMap(q => (q.options || []).map(o => ({
    ...o,
    questionId: q.id,
    questionPrompt: q.prompt
  })));
  const oldOptIds = new Set(oldOpts.map(o => o.id));
  const newOptIds = new Set(newOpts.map(o => o.id));
  changes.addedOptions = newOpts.filter(o => !oldOptIds.has(o.id));
  changes.removedOptions = oldOpts.filter(o => !newOptIds.has(o.id));
  return changes;
};

/* ── Progress Steps — visual workflow indicator ── */
const FB_STEPS = [
  { num: 1, label: 'Add questions', key: 'compose' },
  { num: 2, label: 'Wire to frameworks', key: 'wire' },
  { num: 3, label: 'Publish', key: 'preview' },
];
const ProgressSteps = ({ activeStep }) => /*#__PURE__*/React.createElement("div", {
  className: "fb-progress"
}, FB_STEPS.map((step, i) => /*#__PURE__*/React.createElement(React.Fragment, { key: step.key },
  /*#__PURE__*/React.createElement("div", {
    className: `fb-step${activeStep === step.key ? ' active' : ''}`
  }, /*#__PURE__*/React.createElement("span", { className: "fb-step-num" }, step.num),
  /*#__PURE__*/React.createElement("span", { className: "fb-step-label" }, step.label)),
  i < FB_STEPS.length - 1 && /*#__PURE__*/React.createElement("div", { className: "fb-step-line" })
)));

const FormBuilder = ({
  isOrg = false,
  fieldDefs: fbFieldDefs,
  catLabels: fbCatLabels,
  catColors: fbCatColors,
  onSaveFieldDef: fbOnSaveFieldDef,
  activeForm: fbActiveForm
}) => {
  SWC = useSWC();
  const [mode, setMode] = useState('compose'); // compose | wire | preview
  const [fieldPickerOpen, setFieldPickerOpen] = useState(false);
  const [fieldPickerSection, setFieldPickerSection] = useState(null); // section ID to add to
  const [forms, setForms] = useState([{
    id: fbUid(),
    name: 'New Form',
    key: 'new_form',
    description: '',
    status: 'draft',
    version: 1,
    versionHistory: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    maturity: 'draft',
    source: {
      level: isOrg ? 'org' : 'local',
      propagation: 'optional'
    },
    sections: [{
      id: fbUid(),
      title: 'General',
      questions: []
    }]
  }]);
  const [activeFormIdx, setActiveFormIdx] = useState(0);
  const [frameworks, setFrameworks] = useState([]);
  const [bindings, setBindings] = useState({}); // `${valueId}__${codeId}` → {t, method, confidence, notes}
  const [crosswalks, setCrosswalks] = useState([]);

  // ── Saved forms library ──
  const [savedForms, setSavedForms] = useState([]); // [{id, name, key, version, maturity, savedAt, form, frameworks, bindings, crosswalks}]
  const [showFormList, setShowFormList] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── Versioning state ──
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showVersionBump, setShowVersionBump] = useState(false);
  const [versionNotes, setVersionNotes] = useState('');

  // ── Answer crosswalk state ──
  const [showAnswerCrosswalk, setShowAnswerCrosswalk] = useState(false);
  const [crosswalkSource, setCrosswalkSource] = useState(null); // saved form (old version) to map from
  const [answerMappings, setAnswerMappings] = useState({}); // oldOptionId → newOptionId

  // UI state
  const [editingFormName, setEditingFormName] = useState(false);
  const [addingSection, setAddingSection] = useState(false);
  const [addingQuestion, setAddingQuestion] = useState(null); // sectionId
  const [addingAnswer, setAddingAnswer] = useState(null); // questionId
  const [addingFw, setAddingFw] = useState(false);
  const [addingCode, setAddingCode] = useState(null); // frameworkId
  const [wiringValue, setWiringValue] = useState(null); // {question, value, sectionIdx}
  const [adoptingFw, setAdoptingFw] = useState(false);
  const [addingXW, setAddingXW] = useState(false);
  const [givenNudge, setGivenNudge] = useState(null); // {questionId, signals, suggestions}
  const [draft, setDraft] = useState('');
  const [draft2, setDraft2] = useState('');
  const [draft3, setDraft3] = useState('');
  const [expandedSections, setExpandedSections] = useState(new Set(['all']));
  const [xwFrom, setXwFrom] = useState('');
  const [xwTo, setXwTo] = useState('');
  const [xwType, setXwType] = useState('equivalent');
  const [xwNotes, setXwNotes] = useState('');
  const form = forms[activeFormIdx];

  // ── Derived data ──
  const allQuestions = form.sections.flatMap(s => s.questions);
  const allValues = allQuestions.flatMap(q => (q.options || []).map(o => ({
    ...o,
    questionId: q.id,
    questionPrompt: q.prompt
  })));
  const allCodes = frameworks.flatMap((f, fi) => f.codes.map(c => ({
    ...c,
    frameworkId: f.id,
    frameworkName: f.name,
    fwIdx: fi
  })));

  // ── Binding helpers ──
  const getBindingCode = (valId, fwId) => {
    const fw = frameworks.find(f => f.id === fwId);
    if (!fw) return null;
    for (const c of fw.codes) if (bindings[`${valId}__${c.id}`]) return c;
    return null;
  };
  const getBindingsForValue = valId => frameworks.map((f, fi) => {
    const c = getBindingCode(valId, f.id);
    return c ? {
      ...c,
      fwIdx: fi,
      frameworkName: f.name,
      frameworkId: f.id
    } : null;
  }).filter(Boolean);
  const getUnboundFrameworks = valId => frameworks.filter(f => !getBindingCode(valId, f.id));
  const hasConflict = valId => {
    const cs = getBindingsForValue(valId);
    return cs.length >= 2 && new Set(cs.map(c => c.label)).size > 1;
  };
  const getProvDotState = valId => {
    if (frameworks.length === 0) return 'none';
    const bound = getBindingsForValue(valId);
    if (bound.length === 0) return 'unbound';
    if (hasConflict(valId)) return 'conflict';
    return 'bound';
  };
  const doSetBind = (valId, codeId, fwId) => {
    const nb = {
      ...bindings
    };
    const fw = frameworks.find(f => f.id === fwId);
    if (fw) fw.codes.forEach(c => {
      delete nb[`${valId}__${c.id}`];
    });
    nb[`${valId}__${codeId}`] = {
      t: Date.now(),
      method: 'manual',
      confidence: 1.0
    };
    setBindings(nb);
  };
  const doClearBind = (valId, fwId) => {
    const nb = {
      ...bindings
    };
    const fw = frameworks.find(f => f.id === fwId);
    if (fw) fw.codes.forEach(c => {
      delete nb[`${valId}__${c.id}`];
    });
    setBindings(nb);
  };

  // ── Form mutation helpers ──
  const updateForm = fn => setForms(fs => fs.map((f, i) => i === activeFormIdx ? fn(f) : f));
  const updateSection = (secId, fn) => updateForm(f => ({
    ...f,
    sections: f.sections.map(s => s.id === secId ? fn(s) : s)
  }));
  const updateQuestion = (secId, qId, fn) => updateSection(secId, s => ({
    ...s,
    questions: s.questions.map(q => q.id === qId ? fn(q) : q)
  }));
  const doAddSection = () => {
    if (!draft.trim()) return;
    updateForm(f => ({
      ...f,
      sections: [...f.sections, {
        id: fbUid(),
        title: draft.trim(),
        questions: []
      }]
    }));
    setDraft('');
    setAddingSection(false);
  };
  const doAddQuestion = secId => {
    if (!draft.trim()) return;
    const prompt = draft.trim();
    const qId = fbUid();
    const signals = checkGivenTest(prompt);
    if (signals) {
      setGivenNudge({
        questionId: qId,
        signals,
        suggestions: suggestGivenRephrasing(prompt),
        originalPrompt: prompt,
        sectionId: secId
      });
    }
    updateSection(secId, s => ({
      ...s,
      questions: [...s.questions, {
        id: qId,
        prompt,
        type: draft2 || 'single_select',
        options: [],
        origin: isOrg ? 'org' : 'local',
        givenTestPassed: !signals,
        helpText: ''
      }]
    }));
    setDraft('');
    setDraft2('');
    setAddingQuestion(null);
  };

  // Insert a question from the field dictionary
  const doInsertFromDictionary = (fieldDef, secId) => {
    const qId = fbUid();
    const typeMap = { text: 'text', text_long: 'text', date: 'text', email: 'text', phone: 'text', address: 'text', number: 'numeric', single_select: 'single_select', multi_select: 'multi_select', boolean: 'single_select', document: 'text' };
    const qType = typeMap[fieldDef.data_type] || 'single_select';
    const options = qType === 'single_select' && fieldDef.data_type === 'boolean'
      ? [{ id: fbUid(), label: 'Yes' }, { id: fbUid(), label: 'No' }]
      : [];
    updateSection(secId, s => ({
      ...s,
      questions: [...s.questions, {
        id: qId,
        key: fieldDef.key,
        prompt: fieldDef.label,
        type: qType,
        options,
        origin: isOrg ? 'org' : 'local',
        givenTestPassed: true,
        helpText: fieldDef.definition || '',
        field_uri: fieldDef.uri
      }]
    }));
    setFieldPickerOpen(false);
    setFieldPickerSection(null);
  };
  const doAddAnswer = (secId, qId) => {
    if (!draft.trim()) return;
    updateQuestion(secId, qId, q => ({
      ...q,
      options: [...q.options, {
        id: fbUid(),
        label: draft.trim(),
        origin: isOrg ? 'org' : 'local'
      }]
    }));
    setDraft('');
  };
  const doRemoveQuestion = (secId, qId) => {
    updateSection(secId, s => ({
      ...s,
      questions: s.questions.filter(q => q.id !== qId)
    }));
  };
  const doRemoveAnswer = (secId, qId, valId) => {
    updateQuestion(secId, qId, q => ({
      ...q,
      options: q.options.filter(o => o.id !== valId)
    }));
    // Clean up bindings for removed value
    const nb = {
      ...bindings
    };
    Object.keys(nb).forEach(k => {
      if (k.startsWith(`${valId}__`)) delete nb[k];
    });
    setBindings(nb);
  };
  const doMoveQuestion = (secId, qIdx, dir) => {
    updateSection(secId, s => {
      const qs = [...s.questions];
      const newIdx = qIdx + dir;
      if (newIdx < 0 || newIdx >= qs.length) return s;
      [qs[qIdx], qs[newIdx]] = [qs[newIdx], qs[qIdx]];
      return {
        ...s,
        questions: qs
      };
    });
  };

  // ── Framework helpers ──
  const doAddFramework = () => {
    if (!draft.trim()) return;
    setFrameworks(fs => [...fs, {
      id: fbUid(),
      name: draft.trim(),
      fullName: draft2.trim() || null,
      authority: draft3.trim() || null,
      type: 'local',
      codes: [],
      adoptedAt: new Date().toISOString()
    }]);
    setDraft('');
    setDraft2('');
    setDraft3('');
    setAddingFw(false);
  };
  const doAddCode = fwId => {
    if (!draft.trim() || !draft2.trim()) return;
    setFrameworks(fs => fs.map(f => f.id === fwId ? {
      ...f,
      codes: [...f.codes, {
        id: fbUid(),
        code: draft.trim(),
        label: draft2.trim(),
        definition: draft3.trim() || null
      }]
    } : f));
    setDraft('');
    setDraft2('');
    setDraft3('');
  };

  // ── Auto-suggest bindings ──
  const autoSuggestBindings = fwId => {
    const fw = frameworks.find(f => f.id === fwId);
    if (!fw || fw.codes.length === 0) return [];
    const suggestions = [];
    allValues.forEach(val => {
      const valLower = val.label.toLowerCase();
      fw.codes.forEach(code => {
        const codeLower = code.label.toLowerCase();
        // Simple label similarity: check if they share significant words
        const valWords = valLower.split(/\s+/).filter(w => w.length > 2);
        const codeWords = codeLower.split(/\s+/).filter(w => w.length > 2);
        const shared = valWords.filter(w => codeWords.some(cw => cw.includes(w) || w.includes(cw)));
        if (shared.length > 0 || valLower.includes(codeLower) || codeLower.includes(valLower)) {
          const confidence = Math.min(0.95, 0.5 + shared.length * 0.15);
          if (!bindings[`${val.id}__${code.id}`]) {
            suggestions.push({
              valueId: val.id,
              valueLabel: val.label,
              codeId: code.id,
              codeLabel: code.label,
              codeValue: code.code,
              fwId,
              confidence
            });
          }
        }
      });
    });
    return suggestions;
  };
  const doAcceptSuggestion = suggestion => {
    const nb = {
      ...bindings
    };
    const fw = frameworks.find(f => f.id === suggestion.fwId);
    if (fw) fw.codes.forEach(c => {
      delete nb[`${suggestion.valueId}__${c.id}`];
    });
    nb[`${suggestion.valueId}__${suggestion.codeId}`] = {
      t: Date.now(),
      method: 'auto_suggested',
      confidence: suggestion.confidence
    };
    setBindings(nb);
  };
  const doAcceptAllSuggestions = suggestions => {
    const nb = {
      ...bindings
    };
    suggestions.forEach(s => {
      const fw = frameworks.find(f => f.id === s.fwId);
      if (fw) fw.codes.forEach(c => {
        delete nb[`${s.valueId}__${c.id}`];
      });
      nb[`${s.valueId}__${s.codeId}`] = {
        t: Date.now(),
        method: 'auto_suggested',
        confidence: s.confidence
      };
    });
    setBindings(nb);
  };

  // ── Crosswalk helpers ──
  const doAddXW = () => {
    if (!xwFrom || !xwTo) return;
    setCrosswalks(xws => [...xws, {
      id: fbUid(),
      fromCodeId: xwFrom,
      toCodeId: xwTo,
      type: xwType,
      notes: xwNotes
    }]);
    setAddingXW(false);
    setXwFrom('');
    setXwTo('');
    setXwType('equivalent');
    setXwNotes('');
  };

  // ── Form naming helpers ──
  const doRenameForm = newName => {
    const key = formNameToKey(newName);
    updateForm(f => ({
      ...f,
      name: newName.trim(),
      key,
      updatedAt: new Date().toISOString()
    }));
    setEditingFormName(false);
    setDraft('');
  };
  const doSetDescription = desc => {
    updateForm(f => ({
      ...f,
      description: desc,
      updatedAt: new Date().toISOString()
    }));
  };
  const doSetMaturity = maturity => {
    updateForm(f => ({
      ...f,
      maturity,
      updatedAt: new Date().toISOString()
    }));
  };
  const doSetPropagation = propagation => {
    updateForm(f => ({
      ...f,
      source: {
        ...(f.source || {}),
        propagation
      },
      updatedAt: new Date().toISOString()
    }));
  };

  // ── Save form to library ──
  const doSaveForm = () => {
    setSaving(true);
    const snapshot = {
      id: form.key + '_v' + form.version,
      formId: form.id,
      name: form.name,
      key: form.key,
      version: form.version,
      maturity: form.maturity,
      description: form.description,
      source: form.source,
      savedAt: new Date().toISOString(),
      form: JSON.parse(JSON.stringify(form)),
      frameworks: JSON.parse(JSON.stringify(frameworks)),
      bindings: JSON.parse(JSON.stringify(bindings)),
      crosswalks: JSON.parse(JSON.stringify(crosswalks))
    };
    // Replace existing save for same key+version, or append
    setSavedForms(prev => {
      const idx = prev.findIndex(s => s.key === snapshot.key && s.version === snapshot.version);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = snapshot;
        return next;
      }
      return [...prev, snapshot];
    });
    updateForm(f => ({
      ...f,
      updatedAt: new Date().toISOString(),
      status: 'saved'
    }));
    // Auto-register form fields into field dictionary
    if (fbOnSaveFieldDef && fbFieldDefs) {
      const allQs = form.sections.flatMap(s => s.questions || []);
      for (const q of allQs) {
        const fieldKey = q.key || formNameToKey(q.prompt);
        const uri = q.field_uri || `khora:form/${form.key}/${fieldKey}`;
        if (!fbFieldDefs[uri]) {
          const typeMap = { single_select: 'single_select', multi_select: 'multi_select', numeric: 'number', text: 'text' };
          const def = {
            uri,
            key: fieldKey,
            label: q.prompt,
            category: 'case',
            data_type: typeMap[q.type] || 'text',
            definition: q.helpText || `Data collected via form "${form.name}" — ${q.prompt}`,
            scope: null,
            sensitive: false,
            authority: null,
            version: 1,
            version_history: [],
            migration_rules: [],
            supersedes: null,
            superseded_by: null,
            created_by: 'form_builder',
            created_at: Date.now()
          };
          try { fbOnSaveFieldDef(def); } catch (e) { console.debug('Auto-register field:', e.message); }
        }
      }
    }
    setTimeout(() => setSaving(false), 600);
  };

  // ── Load form from library ──
  const doLoadForm = saved => {
    // Restore form into active slot
    setForms(fs => fs.map((f, i) => i === activeFormIdx ? {
      ...saved.form
    } : f));
    setFrameworks(saved.frameworks || []);
    setBindings(saved.bindings || {});
    setCrosswalks(saved.crosswalks || []);
    setShowFormList(false);
  };

  // ── New blank form ──
  const doNewForm = () => {
    const newForm = {
      id: fbUid(),
      name: 'Untitled Form',
      key: 'untitled_form',
      description: '',
      status: 'draft',
      version: 1,
      versionHistory: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      maturity: 'draft',
      source: {
        level: isOrg ? 'org' : 'local',
        propagation: 'optional'
      },
      sections: [{
        id: fbUid(),
        title: 'General',
        questions: []
      }]
    };
    setForms(fs => [...fs, newForm]);
    setActiveFormIdx(forms.length);
    setFrameworks([]);
    setBindings({});
    setCrosswalks([]);
    setShowFormList(false);
  };

  // ── Delete saved form ──
  const doDeleteSaved = savedId => {
    setSavedForms(prev => prev.filter(s => s.id !== savedId));
  };

  // ── Version bump ──
  const doVersionBump = bumpType => {
    // Save current as history entry before bumping
    const historyEntry = {
      version: form.version,
      name: form.name,
      snapshot: JSON.parse(JSON.stringify(form)),
      frameworks: JSON.parse(JSON.stringify(frameworks)),
      bindings: JSON.parse(JSON.stringify(bindings)),
      crosswalks: JSON.parse(JSON.stringify(crosswalks)),
      bumpedAt: new Date().toISOString(),
      notes: versionNotes || 'Version ' + form.version + ' snapshot'
    };
    const nextVersion = bumpType === 'major' ? Math.floor(form.version) + 1 : +(form.version + 0.1).toFixed(1);
    updateForm(f => ({
      ...f,
      version: nextVersion,
      versionHistory: [...(f.versionHistory || []), historyEntry],
      updatedAt: new Date().toISOString(),
      status: 'draft'
    }));
    setShowVersionBump(false);
    setVersionNotes('');
  };

  // ── Answer crosswalk — build mappings from old version to current ──
  const doStartAnswerCrosswalk = sourceVersion => {
    // sourceVersion is a history entry or a saved form
    const sourceForm = sourceVersion.snapshot || sourceVersion.form;
    setCrosswalkSource({
      ...sourceVersion,
      form: sourceForm
    });
    setAnswerMappings({});
    setShowAnswerCrosswalk(true);
  };
  const doSetAnswerMapping = (oldOptId, newOptId) => {
    setAnswerMappings(prev => {
      if (!newOptId) {
        const next = {
          ...prev
        };
        delete next[oldOptId];
        return next;
      }
      return {
        ...prev,
        [oldOptId]: newOptId
      };
    });
  };
  const doSaveAnswerCrosswalk = () => {
    // Save the mapping as a form-level crosswalk record
    const xwRecord = {
      id: fbUid(),
      type: 'answer_version_crosswalk',
      fromFormKey: form.key,
      fromVersion: crosswalkSource.version,
      toVersion: form.version,
      mappings: {
        ...answerMappings
      },
      createdAt: new Date().toISOString()
    };
    updateForm(f => ({
      ...f,
      answerCrosswalks: [...(f.answerCrosswalks || []), xwRecord],
      updatedAt: new Date().toISOString()
    }));
    setShowAnswerCrosswalk(false);
    setCrosswalkSource(null);
    setAnswerMappings({});
  };

  // ── Persist to Matrix schema room (if svc is available) ──
  const doPersistToSchema = async () => {
    if (!svc || !svc.userId) return;
    setSaving(true);
    try {
      // Find schema room from scanned rooms
      const rooms = svc._client?.getRooms?.() || [];
      let schemaRoomId = null;
      for (const r of rooms) {
        try {
          const idEvt = r.currentState?.getStateEvents?.(EVT.IDENTITY, '');
          if (idEvt && idEvt.getContent?.()?.account_type === 'schema') {
            schemaRoomId = r.roomId;
            break;
          }
        } catch (e) {/* skip */}
      }
      if (!schemaRoomId) {
        setSaving(false);
        return;
      }
      // Build the schema-compatible form object
      const schemaForm = {
        id: form.key || form.id,
        name: form.name,
        version: form.version,
        description: form.description || '',
        maturity: form.maturity || 'draft',
        source: form.source || {
          level: isOrg ? 'org' : 'local',
          propagation: 'optional'
        },
        versionHistory: (form.versionHistory || []).map(h => ({
          version: h.version,
          bumpedAt: h.bumpedAt,
          notes: h.notes
        })),
        answerCrosswalks: form.answerCrosswalks || [],
        fields: form.sections.flatMap(sec => sec.questions.map(q => ({
          id: q.id,
          key: formNameToKey(q.prompt),
          question: q.prompt,
          type: q.type,
          version: form.version,
          maturity: form.maturity || 'draft',
          section: sec.title,
          options: (q.options || []).map(o => ({
            v: formNameToKey(o.label),
            l: o.label,
            id: o.id
          })),
          category: formNameToKey(sec.title),
          sensitive: false,
          metrics: true
        }))),
        eo: {
          chain: [{
            op: 'DES',
            target: {
              entity: form.key,
              designation: form.name + ' Form'
            },
            frame: {
              type: 'schema',
              epistemic: 'GIVEN',
              role: isOrg ? 'org' : 'local'
            }
          }],
          trace: `${form.key} = DES (${isOrg ? 'org' : 'local'}-authored, ${form.source?.propagation || 'optional'} propagation)`
        },
        savedAt: new Date().toISOString()
      };
      await svc.setState(schemaRoomId, EVT.SCHEMA_FORM, schemaForm, schemaForm.id);
      updateForm(f => ({
        ...f,
        status: 'persisted',
        updatedAt: new Date().toISOString()
      }));
    } catch (e) {
      console.error('Failed to persist form to schema room:', e);
    }
    setSaving(false);
  };

  // ── Stats ──
  const totalBindings = Object.keys(bindings).length;
  const totalPossible = allValues.length * frameworks.length;
  const boundCount = allValues.filter(v => getBindingsForValue(v.id).length > 0).length;
  const conflictCount = allValues.filter(v => hasConflict(v.id)).length;
  const toggleSection = secId => {
    const next = new Set(expandedSections);
    if (next.has(secId) || next.has('all')) {
      next.delete(secId);
      next.delete('all');
    } else next.add(secId);
    setExpandedSections(next);
  };
  const isSectionExpanded = secId => expandedSections.has('all') || expandedSections.has(secId);
  return /*#__PURE__*/React.createElement("div", {
    className: "anim-up",
    style: {
      maxWidth: 960,
      margin: '0 auto'
    }
  },

  /* ── Row 1: Form name + badges + actions ── */
  /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: { flex: 1, minWidth: 0 }
  }, editingFormName ? /*#__PURE__*/React.createElement("input", {
    className: "fb-form-name",
    autoFocus: true,
    value: draft,
    onChange: e => setDraft(e.target.value),
    placeholder: "Form name...",
    onKeyDown: e => {
      if (e.key === 'Enter' && draft.trim()) doRenameForm(draft);
      if (e.key === 'Escape') { setEditingFormName(false); setDraft(''); }
    },
    onBlur: () => { if (draft.trim()) doRenameForm(draft); else { setEditingFormName(false); setDraft(''); } }
  }) : /*#__PURE__*/React.createElement("span", {
    className: "fb-form-name",
    style: { cursor: 'pointer', display: 'inline-block' },
    onClick: () => { setDraft(form.name); setEditingFormName(true); },
    title: "Click to rename"
  }, form.name),
  /*#__PURE__*/React.createElement("div", {
    style: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }
  }, /*#__PURE__*/React.createElement(SwTag, {
    color: MATURITY_LEVELS[form.maturity]?.color === 'green' ? SWC.given : MATURITY_LEVELS[form.maturity]?.color === 'red' ? SWC.red : SWC.meant,
    sm: true
  }, MATURITY_LEVELS[form.maturity]?.label || 'Draft'), /*#__PURE__*/React.createElement("span", {
    style: { fontSize: 11, color: SWC.dim, fontFamily: 'var(--mono)', cursor: 'pointer', borderBottom: `1px dashed ${SWC.dim}` },
    onClick: () => setShowVersionBump(true),
    title: "Click to bump version"
  }, "v", form.version), form.status === 'persisted' && /*#__PURE__*/React.createElement(SwTag, {
    color: SWC.given, sm: true
  }, "Saved"), /*#__PURE__*/React.createElement("span", {
    style: { fontSize: 11, color: SWC.dim, fontFamily: 'var(--mono)' }
  }, allQuestions.length, " question", allQuestions.length !== 1 ? 's' : '', " \xB7 ", allValues.length, " option", allValues.length !== 1 ? 's' : '', frameworks.length > 0 && /*#__PURE__*/React.createElement(React.Fragment, null, " \xB7 ", frameworks.length, " fw"), totalBindings > 0 && /*#__PURE__*/React.createElement(React.Fragment, null, " \xB7 ", totalBindings, " binding", totalBindings !== 1 ? 's' : ''), conflictCount > 0 && /*#__PURE__*/React.createElement("span", { style: { color: SWC.sup } }, " \xB7 ", conflictCount, " conflict", conflictCount !== 1 ? 's' : '')))),

  /*#__PURE__*/React.createElement("div", {
    style: { display: 'flex', gap: 5, alignItems: 'center', flexShrink: 0 }
  }, /*#__PURE__*/React.createElement(SwBtn, {
    ghost: true, accent: SWC.muted, onClick: () => setShowFormList(true),
    style: { padding: '5px 10px', fontSize: 11 }
  }, /*#__PURE__*/React.createElement(I, { n: "folder", s: 11 }), " Library", savedForms.length > 0 && /*#__PURE__*/React.createElement("span", {
    style: { marginLeft: 4, fontFamily: 'var(--mono)', fontSize: 10 }
  }, savedForms.length)), /*#__PURE__*/React.createElement(SwBtn, {
    ghost: true, accent: SWC.given, onClick: doSaveForm, disabled: saving,
    style: { padding: '5px 10px', fontSize: 11 }
  }, saving ? '...' : 'Save draft'), (form.versionHistory || []).length > 0 && /*#__PURE__*/React.createElement(SwBtn, {
    ghost: true, accent: SWC.dim, onClick: () => setShowVersionHistory(true),
    style: { padding: '5px 10px', fontSize: 11 }
  }, "History"), /*#__PURE__*/React.createElement(SwBtn, {
    ghost: true, accent: SWC.sup, onClick: doPersistToSchema, disabled: saving,
    style: { padding: '5px 10px', fontSize: 11 }, title: "Save to Matrix schema room"
  }, "Publish"))),

  /* ── Row 2: Progress steps + mode toggle ── */
  /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
      padding: '10px 0',
      borderBottom: `1px solid ${SWC.border}`
    }
  }, /*#__PURE__*/React.createElement(ProgressSteps, { activeStep: mode }),
  /*#__PURE__*/React.createElement("div", {
    className: "fb-mode-toggle"
  }, /*#__PURE__*/React.createElement("button", {
    className: `fb-mode-btn ${mode === 'compose' ? 'active' : ''}`,
    onClick: () => setMode('compose')
  }, "\u270E Compose"), /*#__PURE__*/React.createElement("button", {
    className: `fb-mode-btn ${mode === 'wire' ? 'active' : ''}`,
    onClick: () => setMode('wire')
  }, "\u26A1 Wire", frameworks.length > 0 && totalPossible > 0 && /*#__PURE__*/React.createElement("span", {
    style: { fontSize: 10, color: totalBindings === totalPossible ? SWC.given : SWC.dim, fontFamily: 'var(--mono)' }
  }, totalBindings, "/", totalPossible)), /*#__PURE__*/React.createElement("button", {
    className: `fb-mode-btn ${mode === 'preview' ? 'active' : ''}`,
    onClick: () => setMode('preview')
  }, "\u25CE Preview"))), mode === 'compose' && /*#__PURE__*/React.createElement("div", {
    style: { maxWidth: 640, margin: '0 auto' }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      alignItems: 'center',
      marginBottom: 14,
      fontSize: 12
    }
  }, /*#__PURE__*/React.createElement("select", {
    value: form.maturity || 'draft',
    onChange: e => doSetMaturity(e.target.value),
    style: {
      padding: '5px 10px',
      borderRadius: 5,
      border: `1px solid ${SWC.border}`,
      background: SWC.surface,
      color: SWC.white,
      fontSize: 11,
      fontFamily: 'inherit'
    }
  }, Object.entries(MATURITY_LEVELS).map(([k, v]) => /*#__PURE__*/React.createElement("option", {
    key: k,
    value: k
  }, v.label))), /*#__PURE__*/React.createElement("select", {
    value: form.source?.propagation || 'optional',
    onChange: e => doSetPropagation(e.target.value),
    style: {
      padding: '5px 10px',
      borderRadius: 5,
      border: `1px solid ${SWC.border}`,
      background: SWC.surface,
      color: SWC.white,
      fontSize: 11,
      fontFamily: 'inherit'
    }
  }, Object.entries(PROPAGATION_LEVELS).map(([k, v]) => /*#__PURE__*/React.createElement("option", {
    key: k,
    value: k
  }, v.label))), /*#__PURE__*/React.createElement("input", {
    value: form.description || '',
    onChange: e => doSetDescription(e.target.value),
    placeholder: "Form description...",
    style: {
      flex: 1,
      padding: '5px 10px',
      borderRadius: 5,
      border: `1px solid ${SWC.border}`,
      background: SWC.surface,
      color: SWC.white,
      fontSize: 11,
      fontFamily: 'inherit'
    }
  })), form.sections.map((sec, secIdx) => /*#__PURE__*/React.createElement("div", {
    key: sec.id,
    className: "fb-section"
  }, /*#__PURE__*/React.createElement("div", {
    className: "fb-section-header",
    onClick: () => toggleSection(sec.id)
  }, /*#__PURE__*/React.createElement("div", {
    className: "fb-section-title"
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: SWC.dim,
      transform: isSectionExpanded(sec.id) ? 'rotate(90deg)' : 'rotate(0)',
      transition: 'transform .15s',
      display: 'inline-block'
    }
  }, "\u25B6"), sec.title, /*#__PURE__*/React.createElement("span", {
    className: "fb-section-count"
  }, sec.questions.length, " question", sec.questions.length !== 1 ? 's' : '')), sec.origin === 'network' && /*#__PURE__*/React.createElement("span", {
    className: "fb-inherit-lock"
  }, "\uD83D\uDD12 Network"), sec.origin === 'local' && sec.questions.some(q => q.origin === 'local') && /*#__PURE__*/React.createElement("span", {
    className: "fb-inherit-local"
  }, "\uD83C\uDFE0 Local")), isSectionExpanded(sec.id) && /*#__PURE__*/React.createElement("div", null, sec.questions.map((q, qIdx) => /*#__PURE__*/React.createElement("div", {
    key: q.id,
    className: "fb-question"
  },
  /* ── Meta line: section · type · origin ── */
  /*#__PURE__*/React.createElement("div", {
    className: "fb-question-meta"
  }, /*#__PURE__*/React.createElement("span", null, sec.title), " \xB7 ", /*#__PURE__*/React.createElement("span", null,
    q.type === 'single_select' ? 'Single choice' : q.type === 'multi_select' ? 'Multi choice' : q.type === 'text' ? 'Free text' : q.type),
    q.origin === 'network' && /*#__PURE__*/React.createElement(SwTag, {
      color: SWC.given, sm: true,
      style: { marginLeft: 4, padding: '0 5px', fontSize: 9 }
    }, "Network"),
    q.origin === 'org' && /*#__PURE__*/React.createElement(SwTag, {
      color: SWC.meant, sm: true,
      style: { marginLeft: 4, padding: '0 5px', fontSize: 9 }
    }, "Org"),
    !q.givenTestPassed && /*#__PURE__*/React.createElement("span", {
      style: { fontSize: 11, color: SWC.sup, marginLeft: 4 },
      title: "This question may embed institutional interpretation"
    }, "\u26A0")),

  /* ── Question prompt ── */
  /*#__PURE__*/React.createElement("div", {
    className: "fb-question-prompt"
  }, /*#__PURE__*/React.createElement("span", null, q.prompt),
    q.field_uri && React.createElement("span", {
      className: "tag tag-teal", style: { fontSize: 8, marginLeft: 4 }, title: q.field_uri
    }, React.createElement(I, { n: 'grid', s: 8 }), ' Linked'),
    q.options?.some(o => hasConflict(o.id)) && /*#__PURE__*/React.createElement("span", {
      style: { fontSize: 11 }, title: "Framework conflict"
    }, "\u26A1")),

  /* ── Hover actions (move/delete) ── */
  /*#__PURE__*/React.createElement("div", {
    className: "fb-question-actions"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => doMoveQuestion(sec.id, qIdx, -1),
    disabled: qIdx === 0,
    style: { background: 'none', border: '1px solid ' + SWC.border, borderRadius: 4, color: SWC.dim,
      cursor: qIdx === 0 ? 'default' : 'pointer', padding: '2px 6px', fontSize: 11, opacity: qIdx === 0 ? 0.3 : 1 }
  }, "\u2191"), /*#__PURE__*/React.createElement("button", {
    onClick: () => doMoveQuestion(sec.id, qIdx, 1),
    disabled: qIdx === sec.questions.length - 1,
    style: { background: 'none', border: '1px solid ' + SWC.border, borderRadius: 4, color: SWC.dim,
      cursor: qIdx === sec.questions.length - 1 ? 'default' : 'pointer', padding: '2px 6px', fontSize: 11, opacity: qIdx === sec.questions.length - 1 ? 0.3 : 1 }
  }, "\u2193"), /*#__PURE__*/React.createElement("button", {
    onClick: () => doRemoveQuestion(sec.id, q.id),
    style: { background: 'none', border: '1px solid ' + SWC.border, borderRadius: 4, color: SWC.dim, cursor: 'pointer', padding: '2px 6px', fontSize: 11 },
    onMouseEnter: e => e.currentTarget.style.color = SWC.red,
    onMouseLeave: e => e.currentTarget.style.color = SWC.dim
  }, "\xD7")),

  /* ── Answer options ── */
  (q.type === 'single_select' || q.type === 'multi_select') && /*#__PURE__*/React.createElement("div", {
    className: "fb-answer-list"
  }, (q.options || []).map(opt => {
    const dotState = getProvDotState(opt.id);
    return /*#__PURE__*/React.createElement("div", {
      key: opt.id,
      className: "fb-answer",
      onClick: () => {
        if (frameworks.length > 0) {
          setWiringValue({ question: q, value: opt, sectionIdx: secIdx });
          setMode('wire');
        }
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: q.type === 'single_select' ? 'fb-answer-radio' : 'fb-answer-check'
    }), /*#__PURE__*/React.createElement("span", {
      className: "fb-answer-label"
    }, opt.label), /*#__PURE__*/React.createElement("div", {
      className: "fb-answer-dots"
    }, frameworks.map((fw, fi) => {
      const code = getBindingCode(opt.id, fw.id);
      const isConflict = hasConflict(opt.id);
      return /*#__PURE__*/React.createElement("span", {
        key: fw.id,
        className: `fb-prov-dot ${code ? isConflict ? 'conflict' : 'bound' : 'unbound'}`,
        title: code ? `${fw.name}: ${code.code} — ${code.label}${isConflict ? ' (conflict)' : ''}` : `${fw.name}: not bound`,
        style: code ? { background: SWC.fw[fi % 5] } : {}
      });
    })), /*#__PURE__*/React.createElement("button", {
      onClick: e => { e.stopPropagation(); doRemoveAnswer(sec.id, q.id, opt.id); },
      style: { background: 'none', border: 'none', color: SWC.dim, cursor: 'pointer', fontSize: 14, padding: '2px 4px', opacity: 0.5, transition: 'opacity .15s' },
      onMouseEnter: e => e.currentTarget.style.opacity = '1',
      onMouseLeave: e => e.currentTarget.style.opacity = '0.5'
    }, "\xD7"));
  }), addingAnswer === q.id ? /*#__PURE__*/React.createElement("div", {
    style: { display: 'flex', gap: 6, padding: '4px 10px', alignItems: 'center' }
  }, /*#__PURE__*/React.createElement(SwInput, {
    autoFocus: true, value: draft, onChange: setDraft,
    placeholder: "Answer option...",
    onKeyDown: e => {
      if (e.key === 'Enter') doAddAnswer(sec.id, q.id);
      if (e.key === 'Escape') { setAddingAnswer(null); setDraft(''); }
    },
    style: { padding: '6px 10px', fontSize: 13 }
  }), /*#__PURE__*/React.createElement(SwBtn, {
    onClick: () => doAddAnswer(sec.id, q.id), disabled: !draft.trim(),
    style: { padding: '5px 12px', fontSize: 11 }
  }, "Add"), /*#__PURE__*/React.createElement(SwBtn, {
    ghost: true, accent: SWC.muted,
    onClick: () => { setAddingAnswer(null); setDraft(''); },
    style: { padding: '5px 8px', fontSize: 11 }
  }, "\xD7")) : /*#__PURE__*/React.createElement("button", {
    className: "fb-add-btn",
    onClick: () => { setAddingAnswer(q.id); setDraft(''); }
  }, "+ Add answer option")),

  /* ── Bottom bar: source + wire link ── */
  /*#__PURE__*/React.createElement("div", {
    style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }
  }, /*#__PURE__*/React.createElement("div", {
    className: "fb-source-tag"
  }, q.origin === 'network' ? 'Source: Network (required)' : q.origin === 'org' ? 'Source: Organization' : 'Source: Local', !q.givenTestPassed && /*#__PURE__*/React.createElement("span", {
    style: { color: SWC.sup, fontSize: 10 }
  }, "MEANT-origin")), frameworks.length > 0 && q.options?.length > 0 && /*#__PURE__*/React.createElement("button", {
    className: "fb-wire-btn",
    onClick: () => { setWiringValue({ question: q, value: q.options[0], sectionIdx: secIdx }); setMode('wire'); }
  }, "Wire to frameworks \u2192"))))), addingQuestion === sec.id ? /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '14px 18px',
      borderTop: sec.questions.length > 0 ? `1px solid ${SWC.border}` : 'none'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 600,
      color: SWC.given,
      marginBottom: 8
    }
  }, "New Question"), /*#__PURE__*/React.createElement(SwInput, {
    autoFocus: true,
    value: draft,
    onChange: v => {
      setDraft(v);
      setGivenNudge(null);
    },
    placeholder: "Type your question...",
    onKeyDown: e => {
      if (e.key === 'Enter' && draft.trim()) {
        doAddQuestion(sec.id);
      }
      if (e.key === 'Escape') {
        setAddingQuestion(null);
        setDraft('');
        setDraft2('');
        setGivenNudge(null);
      }
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      marginTop: 8,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("select", {
    value: draft2 || 'single_select',
    onChange: e => setDraft2(e.target.value),
    style: {
      padding: '7px 10px',
      borderRadius: 6,
      border: `1px solid ${SWC.border}`,
      background: SWC.surface,
      color: SWC.white,
      fontSize: 12,
      fontFamily: 'inherit'
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: "single_select"
  }, "Single select"), /*#__PURE__*/React.createElement("option", {
    value: "multi_select"
  }, "Multi select"), /*#__PURE__*/React.createElement("option", {
    value: "text"
  }, "Text"), /*#__PURE__*/React.createElement("option", {
    value: "number"
  }, "Number"), /*#__PURE__*/React.createElement("option", {
    value: "date"
  }, "Date"), /*#__PURE__*/React.createElement("option", {
    value: "duration"
  }, "Duration"), /*#__PURE__*/React.createElement("option", {
    value: "boolean"
  }, "Yes/No"), /*#__PURE__*/React.createElement("option", {
    value: "scale"
  }, "Scale")), /*#__PURE__*/React.createElement(SwBtn, {
    onClick: () => doAddQuestion(sec.id),
    disabled: !draft.trim()
  }, "Create"), /*#__PURE__*/React.createElement(SwBtn, {
    ghost: true,
    accent: SWC.muted,
    onClick: () => {
      setAddingQuestion(null);
      setDraft('');
      setDraft2('');
      setGivenNudge(null);
    }
  }, "Cancel")), draft.trim() && checkGivenTest(draft) && /*#__PURE__*/React.createElement("div", {
    className: "fb-nudge"
  }, /*#__PURE__*/React.createElement("div", {
    className: "fb-nudge-title"
  }, /*#__PURE__*/React.createElement(I, {
    n: "alert",
    s: 12,
    c: SWC.fw[0]
  }), "This question may embed institutional interpretation"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 6
    }
  }, "Detected signal words: ", checkGivenTest(draft).map(w => /*#__PURE__*/React.createElement(SwTag, {
    key: w,
    color: SWC.sup,
    sm: true,
    style: {
      marginRight: 4
    }
  }, w))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: SWC.dim,
      marginBottom: 6
    }
  }, "Consider rephrasing as something a person could answer without institutional knowledge:"), suggestGivenRephrasing(draft).map((sug, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "fb-nudge-suggestion",
    onClick: () => setDraft(sug)
  }, sug)), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8,
      fontSize: 12,
      color: SWC.dim
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      cursor: 'pointer',
      textDecoration: 'underline'
    },
    onClick: () => setGivenNudge(null)
  }, "Keep as-is"), " \u2014 the question will be tagged as MEANT-origin."))) : /*#__PURE__*/React.createElement("button", {
    className: "fb-add-btn",
    style: {
      borderTop: sec.questions.length > 0 ? `1px solid ${SWC.border}` : 'none'
    },
    onClick: () => {
      setAddingQuestion(sec.id);
      setDraft('');
      setDraft2('');
    }
  }, "+ Add question"),
    fbFieldDefs && Object.keys(fbFieldDefs).length > 0 && React.createElement('button', {
      className: 'fb-add-btn',
      style: { color: 'var(--teal)', fontSize: 12, borderTop: 'none', paddingTop: 0 },
      onClick: () => { setFieldPickerSection(sec.id); setFieldPickerOpen(true); }
    }, React.createElement(I, { n: 'grid', s: 11, c: 'var(--teal)' }), ' Insert from field dictionary'),
    fieldPickerOpen && fieldPickerSection === sec.id && React.createElement(FieldPicker, {
      open: true,
      onClose: () => { setFieldPickerOpen(false); setFieldPickerSection(null); },
      onSelect: fd => doInsertFromDictionary(fd, sec.id),
      fieldDefs: fbFieldDefs,
      catLabels: fbCatLabels,
      catColors: fbCatColors
    })
  ))), addingSection ? /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 16,
      border: `1px solid ${SWC.border}`,
      borderRadius: 8,
      background: SWC.surface,
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 600,
      color: SWC.white,
      marginBottom: 8
    }
  }, "New Section"), /*#__PURE__*/React.createElement(SwInput, {
    autoFocus: true,
    value: draft,
    onChange: setDraft,
    placeholder: "Section title...",
    onKeyDown: e => {
      if (e.key === 'Enter') doAddSection();
      if (e.key === 'Escape') {
        setAddingSection(false);
        setDraft('');
      }
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      marginTop: 8
    }
  }, /*#__PURE__*/React.createElement(SwBtn, {
    onClick: doAddSection,
    disabled: !draft.trim()
  }, "Create"), /*#__PURE__*/React.createElement(SwBtn, {
    ghost: true,
    accent: SWC.muted,
    onClick: () => {
      setAddingSection(false);
      setDraft('');
    }
  }, "Cancel"))) : /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "fb-add-btn",
    style: {
      border: `1px dashed ${SWC.border}`,
      borderRadius: 8,
      justifyContent: 'center'
    },
    onClick: () => {
      setAddingSection(true);
      setDraft('');
    }
  }, "+ Add section")), frameworks.length > 0 && allValues.length > 0 && (() => {
    const unboundCount = allValues.filter(v => getBindingsForValue(v.id).length === 0).length;
    return unboundCount > 0 ? /*#__PURE__*/React.createElement("div", {
      style: {
        padding: '12px 16px',
        borderRadius: 8,
        border: `1px solid ${SWC.meantBorder}`,
        background: 'rgba(167,139,250,0.04)',
        fontSize: 13,
        color: SWC.muted,
        lineHeight: 1.6,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }
    }, /*#__PURE__*/React.createElement("span", null, unboundCount, " answer option", unboundCount !== 1 ? 's aren\'t' : ' isn\'t', " connected to any framework yet."), /*#__PURE__*/React.createElement("button", {
      className: "fb-wire-btn",
      onClick: () => setMode('wire')
    }, "Wire them \u2192")) : null;
  })(), frameworks.length === 0 && allValues.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '14px 18px',
      borderRadius: 8,
      border: `1px solid ${SWC.border}`,
      background: SWC.surface,
      fontSize: 13,
      color: SWC.muted,
      lineHeight: 1.6
    }
  }, "This form collects observations without connecting them to any reporting framework. You can add framework bindings anytime.", /*#__PURE__*/React.createElement("button", {
    className: "fb-wire-btn",
    style: {
      marginLeft: 8
    },
    onClick: () => {
      setMode('wire');
      setAddingFw(true);
      setDraft('');
      setDraft2('');
      setDraft3('');
    }
  }, "+ Add a framework"))), givenNudge && mode === 'compose' && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'fixed',
      bottom: 24,
      right: 24,
      zIndex: 45,
      width: 380,
      background: SWC.surface,
      border: `1px solid ${SWC.fw[0]}40`,
      borderRadius: 10,
      padding: 16,
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 600,
      color: SWC.fw[0],
      marginBottom: 6
    }
  }, "GIVEN Test Result"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: SWC.text,
      marginBottom: 8
    }
  }, "\"", givenNudge.originalPrompt, "\" contains interpretation-language: ", givenNudge.signals.join(', ')), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: SWC.dim,
      marginBottom: 8
    }
  }, "The question was created but tagged as MEANT-origin. You can rephrase it anytime."), /*#__PURE__*/React.createElement(SwBtn, {
    ghost: true,
    accent: SWC.muted,
    onClick: () => setGivenNudge(null),
    style: {
      fontSize: 12,
      padding: '5px 12px'
    }
  }, "Dismiss")), mode === 'wire' && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      alignItems: 'center',
      flexWrap: 'wrap'
    }
  }, frameworks.map((fw, fi) => /*#__PURE__*/React.createElement("div", {
    key: fw.id,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      padding: '4px 10px',
      borderRadius: 5,
      border: `1px solid ${SWC.fw[fi % 5]}40`,
      background: `${SWC.fw[fi % 5]}10`,
      fontSize: 12,
      fontWeight: 600,
      color: SWC.fw[fi % 5]
    }
  }, /*#__PURE__*/React.createElement(SwDot, {
    color: SWC.fw[fi % 5],
    size: 6
  }), " ", fw.name, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      color: SWC.dim,
      marginLeft: 4
    }
  }, fw.codes.length, "c"))), frameworks.length === 0 && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: SWC.dim
    }
  }, "No frameworks adopted yet.")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(SwBtn, {
    ghost: true,
    accent: SWC.meant,
    onClick: () => {
      setAddingFw(true);
      setDraft('');
      setDraft2('');
      setDraft3('');
    }
  }, "+ Add framework"), allValues.length > 0 && frameworks.length > 0 && /*#__PURE__*/React.createElement(SwBtn, {
    ghost: true,
    accent: SWC.given,
    onClick: () => setAdoptingFw(true)
  }, "Auto-suggest bindings"))), addingFw && /*#__PURE__*/React.createElement("div", {
    style: {
      border: `1px solid ${SWC.meantBorder}`,
      borderRadius: 10,
      background: SWC.surface,
      padding: 16,
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 600,
      color: SWC.meant,
      marginBottom: 12
    }
  }, "Adopt a Reporting Framework"), /*#__PURE__*/React.createElement(SwInput, {
    autoFocus: true,
    value: draft,
    onChange: setDraft,
    placeholder: "Short name (e.g. HUD HMIS, CoC Priority)",
    onKeyDown: e => {
      if (e.key === 'Enter' && draft.trim()) doAddFramework();
      if (e.key === 'Escape') {
        setAddingFw(false);
        setDraft('');
        setDraft2('');
        setDraft3('');
      }
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8
    }
  }, /*#__PURE__*/React.createElement(SwInput, {
    value: draft2,
    onChange: setDraft2,
    placeholder: "Full name (optional)",
    onKeyDown: e => {
      if (e.key === 'Enter' && draft.trim()) doAddFramework();
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8
    }
  }, /*#__PURE__*/React.createElement(SwInput, {
    value: draft3,
    onChange: setDraft3,
    placeholder: "Governing authority (optional)",
    onKeyDown: e => {
      if (e.key === 'Enter' && draft.trim()) doAddFramework();
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: SWC.dim,
      marginTop: 8,
      lineHeight: 1.55
    }
  }, "A framework defines institutional categories (MEANT). Add its codes after creation."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      marginTop: 12
    }
  }, /*#__PURE__*/React.createElement(SwBtn, {
    accent: SWC.meant,
    onClick: doAddFramework,
    disabled: !draft.trim()
  }, "Adopt"), /*#__PURE__*/React.createElement(SwBtn, {
    ghost: true,
    accent: SWC.muted,
    onClick: () => {
      setAddingFw(false);
      setDraft('');
      setDraft2('');
      setDraft3('');
    }
  }, "Cancel"))), allValues.length > 0 && frameworks.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      color: SWC.muted
    }
  }, "Binding Matrix"), /*#__PURE__*/React.createElement(SwTag, {
    color: SWC.meant,
    sm: true
  }, "GIVEN \u2192 MEANT")), form.sections.map(sec => sec.questions.filter(q => q.options && q.options.length > 0).map(q => /*#__PURE__*/React.createElement("div", {
    key: q.id,
    style: {
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 600,
      color: SWC.white,
      marginBottom: 6,
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, q.prompt, q.options.some(o => hasConflict(o.id)) && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11
    }
  }, "\u26A1")), /*#__PURE__*/React.createElement("div", {
    style: {
      border: `1px solid ${SWC.border}`,
      borderRadius: 8,
      overflow: 'hidden',
      background: SWC.surface
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: `minmax(140px,200px) repeat(${frameworks.length}, 1fr)`,
      borderBottom: `1px solid ${SWC.border}`,
      background: SWC.raised
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '8px 12px',
      fontSize: 11,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      color: SWC.dim
    }
  }, "Value"), frameworks.map((fw, fi) => /*#__PURE__*/React.createElement("div", {
    key: fw.id,
    style: {
      padding: '8px 10px',
      fontSize: 11,
      fontWeight: 600,
      color: SWC.fw[fi % 5],
      textAlign: 'center',
      borderLeft: `1px solid ${SWC.border}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4
    }
  }, /*#__PURE__*/React.createElement(SwDot, {
    color: SWC.fw[fi % 5],
    size: 5
  }), fw.name))), q.options.map((opt, oi) => /*#__PURE__*/React.createElement(SwMRow, {
    key: opt.id,
    opt: opt,
    frameworks: frameworks,
    getBindingCode: getBindingCode,
    setBind: doSetBind,
    clearBind: doClearBind,
    hasConflict: o => hasConflict(o.id),
    isLast: oi === q.options.length - 1
  }))))))), frameworks.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      color: SWC.muted,
      marginBottom: 10
    }
  }, "Framework Codes"), frameworks.map((fw, fi) => /*#__PURE__*/React.createElement("div", {
    key: fw.id,
    style: {
      border: `1px solid ${SWC.border}`,
      borderRadius: 8,
      background: SWC.surface,
      marginBottom: 8,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '10px 14px',
      borderBottom: `1px solid ${SWC.border}`,
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(SwDot, {
    color: SWC.fw[fi % 5],
    size: 8
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      fontWeight: 600,
      color: SWC.fw[fi % 5]
    }
  }, fw.name), fw.fullName && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: SWC.dim
    }
  }, "\u2014 ", fw.fullName), fw.authority && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: SWC.dim,
      marginLeft: 'auto'
    }
  }, "Authority: ", fw.authority), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: SWC.dim,
      marginLeft: fw.authority ? 8 : 'auto'
    }
  }, fw.codes.length, " code", fw.codes.length !== 1 ? 's' : '')), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '4px 6px'
    }
  }, fw.codes.map(c => /*#__PURE__*/React.createElement("div", {
    key: c.id,
    style: {
      padding: '5px 10px',
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(SwTag, {
    color: SWC.fw[fi % 5],
    sm: true,
    mono: true
  }, c.code), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: SWC.text
    }
  }, c.label), c.definition && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: SWC.dim,
      marginLeft: 'auto'
    }
  }, c.definition))), addingCode === fw.id ? /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '4px 8px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      marginBottom: 4
    }
  }, /*#__PURE__*/React.createElement(SwInput, {
    autoFocus: true,
    value: draft,
    onChange: setDraft,
    placeholder: "Code (e.g. Cat-1)",
    onKeyDown: e => {
      if (e.key === 'Escape') {
        setAddingCode(null);
        setDraft('');
        setDraft2('');
        setDraft3('');
      }
    },
    style: {
      padding: '5px 10px',
      fontSize: 12,
      width: 100,
      flex: 'none'
    }
  }), /*#__PURE__*/React.createElement(SwInput, {
    value: draft2,
    onChange: setDraft2,
    placeholder: "Label",
    onKeyDown: e => {
      if (e.key === 'Enter' && draft.trim() && draft2.trim()) {
        doAddCode(fw.id);
      } else if (e.key === 'Escape') {
        setAddingCode(null);
        setDraft('');
        setDraft2('');
        setDraft3('');
      }
    },
    style: {
      padding: '5px 10px',
      fontSize: 12
    }
  })), /*#__PURE__*/React.createElement(SwInput, {
    value: draft3,
    onChange: setDraft3,
    placeholder: "Definition (optional)",
    style: {
      padding: '5px 10px',
      fontSize: 12,
      marginBottom: 6
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(SwBtn, {
    accent: SWC.meant,
    onClick: () => doAddCode(fw.id),
    disabled: !draft.trim() || !draft2.trim(),
    style: {
      padding: '5px 12px',
      fontSize: 11
    }
  }, "Add"), /*#__PURE__*/React.createElement(SwBtn, {
    ghost: true,
    accent: SWC.muted,
    onClick: () => {
      setAddingCode(null);
      setDraft('');
      setDraft2('');
      setDraft3('');
    },
    style: {
      padding: '5px 8px',
      fontSize: 11
    }
  }, "\xD7"))) : /*#__PURE__*/React.createElement("div", {
    onClick: () => {
      setAddingCode(fw.id);
      setDraft('');
      setDraft2('');
      setDraft3('');
    },
    style: {
      padding: '8px 12px',
      fontSize: 13,
      color: SWC.fw[fi % 5],
      cursor: 'pointer'
    }
  }, "+ Add code"))))), frameworks.length >= 2 && /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10
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
      color: SWC.muted
    }
  }, "Crosswalks"), /*#__PURE__*/React.createElement(SwTag, {
    color: SWC.meant,
    sm: true
  }, "MEANT \u2194 MEANT")), allCodes.length >= 2 && /*#__PURE__*/React.createElement(SwBtn, {
    ghost: true,
    accent: SWC.meant,
    onClick: () => setAddingXW(true)
  }, "+ Add crosswalk")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: SWC.dim,
      marginBottom: 10,
      lineHeight: 1.55
    }
  }, "Crosswalks translate between frameworks \u2014 how one institution's codes map to another's."), addingXW && /*#__PURE__*/React.createElement("div", {
    style: {
      border: `1px solid ${SWC.meantBorder}`,
      borderRadius: 10,
      background: SWC.surface,
      padding: 16,
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 600,
      color: SWC.meant,
      marginBottom: 12
    }
  }, "New Crosswalk"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("select", {
    value: xwFrom,
    onChange: e => setXwFrom(e.target.value),
    style: {
      flex: 1,
      padding: '7px 10px',
      borderRadius: 6,
      border: `1px solid ${SWC.border}`,
      background: SWC.surface,
      color: SWC.white,
      fontSize: 12,
      fontFamily: 'inherit'
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "From code..."), allCodes.map(c => /*#__PURE__*/React.createElement("option", {
    key: c.id,
    value: c.id
  }, c.frameworkName, ": ", c.code, " \u2014 ", c.label))), /*#__PURE__*/React.createElement("select", {
    value: xwTo,
    onChange: e => setXwTo(e.target.value),
    style: {
      flex: 1,
      padding: '7px 10px',
      borderRadius: 6,
      border: `1px solid ${SWC.border}`,
      background: SWC.surface,
      color: SWC.white,
      fontSize: 12,
      fontFamily: 'inherit'
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "To code..."), allCodes.filter(c => c.id !== xwFrom).map(c => /*#__PURE__*/React.createElement("option", {
    key: c.id,
    value: c.id
  }, c.frameworkName, ": ", c.code, " \u2014 ", c.label)))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      marginBottom: 8
    }
  }, ['equivalent', 'implies', 'overlaps', 'conflicts'].map(t => /*#__PURE__*/React.createElement(SwTag, {
    key: t,
    color: xwType === t ? t === 'conflicts' ? SWC.sup : t === 'equivalent' ? SWC.given : SWC.meant : SWC.dim,
    onClick: () => setXwType(t),
    sm: true,
    style: {
      cursor: 'pointer',
      padding: '3px 8px',
      fontSize: 11
    }
  }, t))), /*#__PURE__*/React.createElement(SwInput, {
    value: xwNotes,
    onChange: setXwNotes,
    placeholder: "Notes (optional)",
    style: {
      marginBottom: 10
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(SwBtn, {
    accent: SWC.meant,
    onClick: doAddXW,
    disabled: !xwFrom || !xwTo
  }, "Create"), /*#__PURE__*/React.createElement(SwBtn, {
    ghost: true,
    accent: SWC.muted,
    onClick: () => {
      setAddingXW(false);
      setXwFrom('');
      setXwTo('');
      setXwNotes('');
    }
  }, "Cancel"))), crosswalks.length === 0 && !addingXW ? /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 20,
      border: `1px dashed ${SWC.border}`,
      borderRadius: 8,
      textAlign: 'center',
      color: SWC.dim,
      fontSize: 13
    }
  }, allCodes.length < 2 ? 'Need codes in at least two frameworks.' : 'No crosswalks yet.') : crosswalks.map(xw => {
    const from = allCodes.find(c => c.id === xw.fromCodeId);
    const to = allCodes.find(c => c.id === xw.toCodeId);
    if (!from || !to) return null;
    return /*#__PURE__*/React.createElement("div", {
      key: xw.id,
      style: {
        border: `1px solid ${SWC.border}`,
        borderRadius: 8,
        background: SWC.surface,
        padding: '10px 14px',
        marginBottom: 6
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        flexWrap: 'wrap',
        marginBottom: xw.notes ? 6 : 0
      }
    }, /*#__PURE__*/React.createElement(SwDot, {
      color: SWC.fw[from.fwIdx % 5],
      size: 6
    }), /*#__PURE__*/React.createElement(SwTag, {
      color: SWC.fw[from.fwIdx % 5],
      sm: true
    }, from.frameworkName, ": ", from.code), /*#__PURE__*/React.createElement("span", {
      style: {
        color: SWC.dim,
        fontSize: 13
      }
    }, xw.type === 'equivalent' ? '=' : xw.type === 'implies' ? '→' : xw.type === 'overlaps' ? '↔' : '⚡'), /*#__PURE__*/React.createElement(SwDot, {
      color: SWC.fw[to.fwIdx % 5],
      size: 6
    }), /*#__PURE__*/React.createElement(SwTag, {
      color: SWC.fw[to.fwIdx % 5],
      sm: true
    }, to.frameworkName, ": ", to.code), /*#__PURE__*/React.createElement(SwTag, {
      color: xw.type === 'conflicts' ? SWC.sup : xw.type === 'equivalent' ? SWC.given : SWC.meant,
      sm: true
    }, xw.type)), xw.notes && /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        color: SWC.text,
        lineHeight: 1.55
      }
    }, xw.notes));
  })), allValues.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 32,
      border: `1px dashed ${SWC.border}`,
      borderRadius: 8,
      textAlign: 'center',
      color: SWC.dim,
      fontSize: 14
    }
  }, "Add questions with answer options first, then wire them to frameworks here.", /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 12
    }
  }, /*#__PURE__*/React.createElement(SwBtn, {
    ghost: true,
    accent: SWC.given,
    onClick: () => setMode('compose')
  }, "\u2190 Back to Compose")))), wiringValue && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'fixed',
      inset: 0,
      zIndex: 39
    },
    onClick: () => setWiringValue(null)
  }, /*#__PURE__*/React.createElement("div", {
    className: "fb-wire-panel",
    onClick: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement("div", {
    className: "fb-wire-panel-header"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(SwTag, {
    color: SWC.given,
    sm: true
  }, "GIVEN"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: SWC.muted,
      marginTop: 6
    }
  }, wiringValue.question.prompt), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 20,
      fontWeight: 700,
      color: SWC.white,
      marginTop: 3
    }
  }, wiringValue.value.label)), /*#__PURE__*/React.createElement("button", {
    onClick: () => setWiringValue(null),
    style: {
      background: 'none',
      border: 'none',
      color: SWC.muted,
      cursor: 'pointer',
      fontSize: 20,
      padding: 4
    }
  }, "\xD7")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8,
      fontSize: 12,
      color: SWC.dim
    }
  }, "This is an observation (GIVEN). Below are its interpretations across active frameworks (MEANT).")), /*#__PURE__*/React.createElement("div", {
    className: "fb-wire-panel-body"
  }, frameworks.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 24,
      textAlign: 'center',
      color: SWC.dim,
      fontSize: 13
    }
  }, "No frameworks adopted yet.", /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement(SwBtn, {
    accent: SWC.meant,
    onClick: () => {
      setAddingFw(true);
      setDraft('');
      setDraft2('');
      setDraft3('');
    }
  }, "+ Adopt a framework"))) : /*#__PURE__*/React.createElement(React.Fragment, null, frameworks.map((fw, fi) => {
    const code = getBindingCode(wiringValue.value.id, fw.id);
    const binding = code ? bindings[`${wiringValue.value.id}__${code.id}`] : null;
    return /*#__PURE__*/React.createElement("div", {
      key: fw.id,
      className: "fb-wire-fw-card",
      style: {
        borderColor: code ? `${SWC.fw[fi % 5]}40` : undefined
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "fb-wire-fw-card-header"
    }, /*#__PURE__*/React.createElement(SwDot, {
      color: SWC.fw[fi % 5],
      size: 10
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 14,
        fontWeight: 600,
        color: SWC.fw[fi % 5]
      }
    }, fw.name), fw.fullName && /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11,
        color: SWC.dim
      }
    }, fw.fullName)), code ? /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 6
      }
    }, /*#__PURE__*/React.createElement(SwTag, {
      color: SWC.fw[fi % 5],
      mono: true
    }, code.code), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13,
        fontWeight: 500,
        color: SWC.white
      }
    }, code.label), /*#__PURE__*/React.createElement("span", {
      className: `fb-prov-dot ${hasConflict(wiringValue.value.id) ? 'conflict' : 'bound'}`,
      style: {
        background: hasConflict(wiringValue.value.id) ? undefined : SWC.fw[fi % 5]
      }
    })) : /*#__PURE__*/React.createElement("span", {
      className: "fb-prov-dot unbound"
    })), /*#__PURE__*/React.createElement("div", {
      className: "fb-wire-fw-card-body"
    }, code && binding && /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12,
        color: SWC.dim,
        marginBottom: 8
      }
    }, "Bound via: ", binding.method === 'auto_suggested' ? 'auto-suggested' : 'manual', " \xB7 Confidence: ", Math.round((binding.confidence || 1) * 100), "% \xB7 ", new Date(binding.t).toLocaleDateString()), code && code.definition && /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12,
        color: SWC.text,
        marginBottom: 8,
        padding: '6px 10px',
        background: SWC.raised,
        borderRadius: 4
      }
    }, code.definition), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12,
        color: SWC.muted,
        marginBottom: 6,
        fontWeight: 600
      }
    }, "Select a code:"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 4
      }
    }, fw.codes.map(c => {
      const isActive = code?.id === c.id;
      return /*#__PURE__*/React.createElement("div", {
        key: c.id,
        className: `fb-wire-code-option ${isActive ? 'selected' : ''}`,
        onClick: () => {
          if (isActive) doClearBind(wiringValue.value.id, fw.id);else doSetBind(wiringValue.value.id, c.id, fw.id);
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          width: 16,
          height: 16,
          borderRadius: 8,
          border: `2px solid ${isActive ? SWC.fw[fi % 5] : SWC.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }
      }, isActive && /*#__PURE__*/React.createElement("div", {
        style: {
          width: 8,
          height: 8,
          borderRadius: 4,
          background: SWC.fw[fi % 5]
        }
      })), /*#__PURE__*/React.createElement(SwTag, {
        color: SWC.fw[fi % 5],
        mono: true,
        sm: true
      }, c.code), /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 13,
          color: isActive ? SWC.white : SWC.text
        }
      }, c.label), isActive && /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 11,
          color: SWC.fw[fi % 5],
          marginLeft: 'auto'
        }
      }, "\u2713 bound"));
    })), fw.codes.length === 0 && /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12,
        color: SWC.dim,
        padding: '8px 0'
      }
    }, "No codes yet."), code && /*#__PURE__*/React.createElement("div", {
      onClick: () => doClearBind(wiringValue.value.id, fw.id),
      style: {
        fontSize: 12,
        color: SWC.dim,
        cursor: 'pointer',
        marginTop: 8
      },
      onMouseEnter: e => e.currentTarget.style.color = SWC.red,
      onMouseLeave: e => e.currentTarget.style.color = SWC.dim
    }, "Clear binding")));
  }), hasConflict(wiringValue.value.id) && /*#__PURE__*/React.createElement("div", {
    className: "fb-wire-conflict"
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: SWC.sup,
      fontWeight: 600
    }
  }, "\u26A1 Superposition \u2014 "), "Frameworks disagree about what \"", wiringValue.value.label, "\" means. This isn't an error \u2014 it's data about how institutions see differently.", /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8,
      display: 'flex',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: SWC.muted,
      cursor: 'pointer'
    },
    onClick: () => {
      setWiringValue(null);
      setAddingXW(true);
    }
  }, "Document in crosswalks \u2192"))), /*#__PURE__*/React.createElement("div", {
    className: "fb-wire-ground-truth"
  }, /*#__PURE__*/React.createElement("strong", {
    style: {
      color: SWC.given
    }
  }, "Ground truth reminder:"), /*#__PURE__*/React.createElement("br", null), "\"", wiringValue.value.label, "\" is what the person said. Everything above is what institutions decided it means. The observation stands regardless."))))), adoptingFw && /*#__PURE__*/React.createElement("div", {
    className: "fb-adopt-modal",
    onClick: () => setAdoptingFw(false)
  }, /*#__PURE__*/React.createElement("div", {
    className: "fb-adopt-panel",
    onClick: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 18,
      fontWeight: 700,
      color: SWC.white
    }
  }, "Auto-Suggest Bindings"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: SWC.muted,
      marginTop: 4
    }
  }, "The system proposes matches based on label similarity. Review and confirm.")), /*#__PURE__*/React.createElement("button", {
    onClick: () => setAdoptingFw(false),
    style: {
      background: 'none',
      border: 'none',
      color: SWC.muted,
      cursor: 'pointer',
      fontSize: 20
    }
  }, "\xD7")), frameworks.map((fw, fi) => {
    const suggestions = autoSuggestBindings(fw.id);
    if (suggestions.length === 0) return /*#__PURE__*/React.createElement("div", {
      key: fw.id,
      style: {
        padding: '10px 14px',
        border: `1px solid ${SWC.border}`,
        borderRadius: 8,
        marginBottom: 8,
        color: SWC.dim,
        fontSize: 13
      }
    }, /*#__PURE__*/React.createElement(SwDot, {
      color: SWC.fw[fi % 5],
      size: 6
    }), " ", /*#__PURE__*/React.createElement("span", {
      style: {
        color: SWC.fw[fi % 5],
        fontWeight: 600
      }
    }, fw.name), " \u2014 no suggestions (all bound or no matches)");
    return /*#__PURE__*/React.createElement("div", {
      key: fw.id,
      style: {
        border: `1px solid ${SWC.fw[fi % 5]}40`,
        borderRadius: 8,
        marginBottom: 12,
        overflow: 'hidden'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        padding: '10px 14px',
        background: `${SWC.fw[fi % 5]}10`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 6
      }
    }, /*#__PURE__*/React.createElement(SwDot, {
      color: SWC.fw[fi % 5],
      size: 8
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 14,
        fontWeight: 600,
        color: SWC.fw[fi % 5]
      }
    }, fw.name), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12,
        color: SWC.dim
      }
    }, suggestions.length, " suggestion", suggestions.length !== 1 ? 's' : '')), /*#__PURE__*/React.createElement(SwBtn, {
      accent: SWC.fw[fi % 5],
      onClick: () => doAcceptAllSuggestions(suggestions),
      style: {
        padding: '5px 12px',
        fontSize: 11
      }
    }, "Accept all")), /*#__PURE__*/React.createElement("div", {
      style: {
        padding: '6px 8px'
      }
    }, suggestions.map(s => /*#__PURE__*/React.createElement("div", {
      key: `${s.valueId}_${s.codeId}`,
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 10px',
        borderBottom: `1px solid ${SWC.border}`
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13,
        color: SWC.white,
        flex: 1
      }
    }, s.valueLabel), /*#__PURE__*/React.createElement("span", {
      style: {
        color: SWC.dim,
        fontSize: 12
      }
    }, "\u2192"), /*#__PURE__*/React.createElement(SwTag, {
      color: SWC.fw[fi % 5],
      mono: true,
      sm: true
    }, s.codeValue), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12,
        color: SWC.text,
        flex: 1
      }
    }, s.codeLabel), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11,
        color: SWC.dim,
        fontFamily: 'var(--mono)'
      }
    }, Math.round(s.confidence * 100), "%"), /*#__PURE__*/React.createElement(SwBtn, {
      accent: SWC.fw[fi % 5],
      onClick: () => doAcceptSuggestion(s),
      style: {
        padding: '3px 10px',
        fontSize: 10
      }
    }, "Accept")))));
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 12,
      textAlign: 'right'
    }
  }, /*#__PURE__*/React.createElement(SwBtn, {
    ghost: true,
    accent: SWC.muted,
    onClick: () => setAdoptingFw(false)
  }, "Done")))), mode === 'preview' && /*#__PURE__*/React.createElement("div", {
    className: "fb-preview"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 20,
      padding: '12px 16px',
      borderRadius: 8,
      border: `1px solid ${SWC.border}`,
      background: SWC.surface,
      fontSize: 13,
      color: SWC.muted,
      lineHeight: 1.6
    }
  }, /*#__PURE__*/React.createElement("strong", {
    style: {
      color: SWC.white
    }
  }, "Preview:"), " This is how the form appears to a person filling it out. No framework information is visible \u2014 only the questions and answer options."), form.sections.map(sec => /*#__PURE__*/React.createElement("div", {
    key: sec.id,
    style: {
      marginBottom: 24
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      fontWeight: 600,
      color: SWC.white,
      marginBottom: 12,
      padding: '8px 0',
      borderBottom: `1px solid ${SWC.border}`
    }
  }, sec.title), sec.questions.map(q => /*#__PURE__*/React.createElement("div", {
    key: q.id,
    className: "fb-preview-question"
  }, /*#__PURE__*/React.createElement("div", {
    className: "fb-preview-prompt"
  }, q.prompt), (q.type === 'single_select' || q.type === 'multi_select') && (q.options || []).map(opt => /*#__PURE__*/React.createElement("div", {
    key: opt.id,
    className: "fb-preview-option"
  }, /*#__PURE__*/React.createElement("div", {
    className: q.type === 'single_select' ? 'fb-answer-radio' : 'fb-answer-check'
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14
    }
  }, opt.label))), q.type === 'text' && /*#__PURE__*/React.createElement("input", {
    placeholder: "Type your answer...",
    style: {
      width: '100%',
      padding: '10px 14px',
      borderRadius: 6,
      border: `1px solid ${SWC.border}`,
      background: SWC.surface,
      color: SWC.white,
      fontSize: 14,
      fontFamily: 'inherit'
    },
    readOnly: true
  }), q.type === 'number' && /*#__PURE__*/React.createElement("input", {
    type: "number",
    placeholder: "0",
    style: {
      width: 120,
      padding: '10px 14px',
      borderRadius: 6,
      border: `1px solid ${SWC.border}`,
      background: SWC.surface,
      color: SWC.white,
      fontSize: 14,
      fontFamily: 'inherit'
    },
    readOnly: true
  }), q.type === 'date' && /*#__PURE__*/React.createElement("input", {
    type: "date",
    style: {
      width: 200,
      padding: '10px 14px',
      borderRadius: 6,
      border: `1px solid ${SWC.border}`,
      background: SWC.surface,
      color: SWC.white,
      fontSize: 14,
      fontFamily: 'inherit'
    },
    readOnly: true
  }), q.type === 'boolean' && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "fb-preview-option",
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "fb-answer-radio"
  }), /*#__PURE__*/React.createElement("span", null, "Yes")), /*#__PURE__*/React.createElement("div", {
    className: "fb-preview-option",
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "fb-answer-radio"
  }), /*#__PURE__*/React.createElement("span", null, "No"))), q.type === 'duration' && /*#__PURE__*/React.createElement("input", {
    placeholder: "e.g. 3 months",
    style: {
      width: 200,
      padding: '10px 14px',
      borderRadius: 6,
      border: `1px solid ${SWC.border}`,
      background: SWC.surface,
      color: SWC.white,
      fontSize: 14,
      fontFamily: 'inherit'
    },
    readOnly: true
  }))), sec.questions.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      color: SWC.dim,
      fontSize: 13,
      fontStyle: 'italic'
    }
  }, "No questions in this section yet.")))), showFormList && /*#__PURE__*/React.createElement("div", {
    className: "fb-adopt-modal",
    onClick: () => setShowFormList(false)
  }, /*#__PURE__*/React.createElement("div", {
    className: "fb-adopt-panel",
    onClick: e => e.stopPropagation(),
    style: {
      maxWidth: 560
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 18,
      fontWeight: 700,
      fontFamily: 'var(--serif)',
      color: SWC.white
    }
  }, "Form Library"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: SWC.dim,
      marginTop: 4
    }
  }, "Saved forms and their versions.")), /*#__PURE__*/React.createElement("button", {
    onClick: () => setShowFormList(false),
    style: {
      background: 'none',
      border: 'none',
      color: SWC.muted,
      cursor: 'pointer',
      fontSize: 18,
      padding: '2px 6px',
      lineHeight: 1
    }
  }, "\xD7")), /*#__PURE__*/React.createElement(SwBtn, {
    accent: SWC.given,
    onClick: doNewForm,
    style: {
      marginBottom: 20,
      width: '100%'
    }
  }, "+ New blank form"), savedForms.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 32,
      textAlign: 'center',
      color: SWC.dim,
      fontSize: 13,
      border: `1px dashed ${SWC.border}`,
      borderRadius: 8
    }
  }, "No saved forms yet. Use \"Save\" to save the current form to your library.") : /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, Object.entries(savedForms.reduce((acc, sf) => {
    (acc[sf.key] = acc[sf.key] || []).push(sf);
    return acc;
  }, {})).map(([key, versions]) => /*#__PURE__*/React.createElement("div", {
    key: key,
    style: {
      border: `1px solid ${SWC.border}`,
      borderRadius: 8,
      background: SWC.surface,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '12px 16px',
      borderBottom: `1px solid ${SWC.border}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      fontWeight: 600,
      color: SWC.white
    }
  }, versions[0].name), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: SWC.dim,
      fontFamily: 'var(--mono)'
    }
  }, versions.length, " version", versions.length !== 1 ? 's' : '')), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '6px 0'
    }
  }, versions.sort((a, b) => b.version - a.version).map(sv => /*#__PURE__*/React.createElement("div", {
    key: sv.id,
    style: {
      padding: '8px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      transition: 'background 0.1s',
      cursor: 'pointer'
    },
    onClick: () => doLoadForm(sv),
    onMouseEnter: e => e.currentTarget.style.background = SWC.hover || SWC.raised,
    onMouseLeave: e => e.currentTarget.style.background = 'transparent'
  }, /*#__PURE__*/React.createElement(SwTag, {
    color: SWC.meant,
    sm: true,
    mono: true
  }, "v", sv.version), /*#__PURE__*/React.createElement(SwTag, {
    color: MATURITY_LEVELS[sv.maturity]?.color === 'green' ? SWC.given : SWC.dim,
    sm: true
  }, sv.maturity), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: SWC.muted,
      flex: 1,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, sv.description || '—'), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      color: SWC.dim,
      fontFamily: 'var(--mono)',
      flexShrink: 0
    }
  }, new Date(sv.savedAt).toLocaleDateString()), /*#__PURE__*/React.createElement("button", {
    onClick: e => {
      e.stopPropagation();
      doDeleteSaved(sv.id);
    },
    style: {
      background: 'none',
      border: 'none',
      color: SWC.dim,
      cursor: 'pointer',
      fontSize: 14,
      padding: '2px 4px',
      flexShrink: 0
    },
    onMouseEnter: e => e.currentTarget.style.color = SWC.red,
    onMouseLeave: e => e.currentTarget.style.color = SWC.dim
  }, "\xD7"))))))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 16,
      textAlign: 'right'
    }
  }, /*#__PURE__*/React.createElement(SwBtn, {
    ghost: true,
    accent: SWC.muted,
    onClick: () => setShowFormList(false)
  }, "Done")))), showVersionBump && /*#__PURE__*/React.createElement("div", {
    className: "fb-adopt-modal",
    onClick: () => setShowVersionBump(false)
  }, /*#__PURE__*/React.createElement("div", {
    className: "fb-adopt-panel",
    onClick: e => e.stopPropagation(),
    style: {
      maxWidth: 480
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 18,
      fontWeight: 700,
      color: SWC.white
    }
  }, "Bump Version"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: SWC.muted,
      marginTop: 4
    }
  }, "Create a new version of ", /*#__PURE__*/React.createElement("strong", {
    style: {
      color: SWC.white
    }
  }, form.name), ". Current version: ", /*#__PURE__*/React.createElement("strong", {
    style: {
      color: SWC.meant
    }
  }, "v", form.version))), /*#__PURE__*/React.createElement("button", {
    onClick: () => setShowVersionBump(false),
    style: {
      background: 'none',
      border: 'none',
      color: SWC.muted,
      cursor: 'pointer',
      fontSize: 20
    }
  }, "\xD7")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: SWC.dim,
      marginBottom: 6
    }
  }, "Version notes (what changed):"), /*#__PURE__*/React.createElement(SwInput, {
    value: versionNotes,
    onChange: setVersionNotes,
    placeholder: "Describe what changed in this version...",
    onKeyDown: e => {
      if (e.key === 'Escape') setShowVersionBump(false);
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: SWC.dim,
      marginBottom: 12,
      lineHeight: 1.6
    }
  }, "The current form state will be saved as v", form.version, " in the version history before bumping. Prior answers remain linked to the version they were recorded against."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(SwBtn, {
    accent: SWC.meant,
    onClick: () => doVersionBump('minor'),
    style: {
      flex: 1
    }
  }, "Minor bump \u2192 v", +(form.version + 0.1).toFixed(1), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      fontWeight: 400,
      marginTop: 2
    }
  }, "Additive changes, compatible")), /*#__PURE__*/React.createElement(SwBtn, {
    accent: SWC.sup,
    onClick: () => doVersionBump('major'),
    style: {
      flex: 1
    }
  }, "Major bump \u2192 v", Math.floor(form.version) + 1, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      fontWeight: 400,
      marginTop: 2
    }
  }, "Breaking changes, crosswalk needed"))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 12,
      textAlign: 'right'
    }
  }, /*#__PURE__*/React.createElement(SwBtn, {
    ghost: true,
    accent: SWC.muted,
    onClick: () => setShowVersionBump(false)
  }, "Cancel")))), showVersionHistory && /*#__PURE__*/React.createElement("div", {
    className: "fb-adopt-modal",
    onClick: () => setShowVersionHistory(false)
  }, /*#__PURE__*/React.createElement("div", {
    className: "fb-adopt-panel",
    onClick: e => e.stopPropagation(),
    style: {
      maxWidth: 640
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 18,
      fontWeight: 700,
      color: SWC.white
    }
  }, "Version History \u2014 ", form.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: SWC.muted,
      marginTop: 4
    }
  }, "Current: v", form.version, " \xB7 ", (form.versionHistory || []).length, " prior version", (form.versionHistory || []).length !== 1 ? 's' : '')), /*#__PURE__*/React.createElement("button", {
    onClick: () => setShowVersionHistory(false),
    style: {
      background: 'none',
      border: 'none',
      color: SWC.muted,
      cursor: 'pointer',
      fontSize: 20
    }
  }, "\xD7")), /*#__PURE__*/React.createElement("div", {
    style: {
      border: `1px solid ${SWC.givenBorder}`,
      borderRadius: 8,
      background: 'rgba(45,212,160,0.04)',
      padding: '10px 14px',
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(SwTag, {
    color: SWC.given,
    sm: true,
    mono: true
  }, "v", form.version), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      fontWeight: 600,
      color: SWC.white
    }
  }, "Current (working)"), /*#__PURE__*/React.createElement(SwTag, {
    color: SWC.given,
    sm: true
  }, form.maturity), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: SWC.dim,
      marginLeft: 'auto'
    }
  }, allQuestions.length, " questions \xB7 ", allValues.length, " options"))), (form.versionHistory || []).slice().reverse().map((h, i) => {
    const hQuestions = (h.snapshot?.sections || []).flatMap(s => s.questions || []);
    const hValues = hQuestions.flatMap(q => (q.options || []).map(o => o));
    const diff = diffFormVersions(h.snapshot, form);
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        border: `1px solid ${SWC.border}`,
        borderRadius: 8,
        background: SWC.surface,
        padding: '10px 14px',
        marginBottom: 6
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: h.notes ? 6 : 0
      }
    }, /*#__PURE__*/React.createElement(SwTag, {
      color: SWC.meant,
      sm: true,
      mono: true
    }, "v", h.version), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13,
        color: SWC.text,
        flex: 1
      }
    }, h.notes || 'No notes'), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11,
        color: SWC.dim,
        fontFamily: 'var(--mono)'
      }
    }, new Date(h.bumpedAt).toLocaleDateString()), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11,
        color: SWC.dim
      }
    }, hQuestions.length, "q \xB7 ", hValues.length, "o")), (diff.added.length > 0 || diff.removed.length > 0 || diff.addedOptions.length > 0 || diff.removedOptions.length > 0) && /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11,
        color: SWC.dim,
        marginTop: 4,
        display: 'flex',
        gap: 8,
        flexWrap: 'wrap'
      }
    }, diff.added.length > 0 && /*#__PURE__*/React.createElement("span", {
      style: {
        color: SWC.given
      }
    }, "+", diff.added.length, " question", diff.added.length !== 1 ? 's' : ''), diff.removed.length > 0 && /*#__PURE__*/React.createElement("span", {
      style: {
        color: SWC.red
      }
    }, "-", diff.removed.length, " question", diff.removed.length !== 1 ? 's' : ''), diff.addedOptions.length > 0 && /*#__PURE__*/React.createElement("span", {
      style: {
        color: SWC.given
      }
    }, "+", diff.addedOptions.length, " option", diff.addedOptions.length !== 1 ? 's' : ''), diff.removedOptions.length > 0 && /*#__PURE__*/React.createElement("span", {
      style: {
        color: SWC.red
      }
    }, "-", diff.removedOptions.length, " option", diff.removedOptions.length !== 1 ? 's' : ''), diff.renamed.length > 0 && /*#__PURE__*/React.createElement("span", {
      style: {
        color: SWC.sup
      }
    }, diff.renamed.length, " renamed")), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 6,
        marginTop: 8
      }
    }, /*#__PURE__*/React.createElement(SwBtn, {
      ghost: true,
      accent: SWC.meant,
      onClick: () => {
        setShowVersionHistory(false);
        doStartAnswerCrosswalk(h);
      },
      style: {
        padding: '3px 10px',
        fontSize: 10
      }
    }, "Crosswalk answers from v", h.version)));
  }), (form.versionHistory || []).length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 24,
      textAlign: 'center',
      color: SWC.dim,
      fontSize: 13,
      border: `1px dashed ${SWC.border}`,
      borderRadius: 8
    }
  }, "No prior versions. Use \"Version\" to create a version snapshot."), (form.answerCrosswalks || []).length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      color: SWC.muted,
      marginBottom: 8
    }
  }, "Answer Crosswalks"), form.answerCrosswalks.map(xw => /*#__PURE__*/React.createElement("div", {
    key: xw.id,
    style: {
      border: `1px solid ${SWC.border}`,
      borderRadius: 6,
      background: SWC.surface,
      padding: '8px 12px',
      marginBottom: 4,
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(SwTag, {
    color: SWC.meant,
    sm: true,
    mono: true
  }, "v", xw.fromVersion), /*#__PURE__*/React.createElement("span", {
    style: {
      color: SWC.dim,
      fontSize: 12
    }
  }, "\u2192"), /*#__PURE__*/React.createElement(SwTag, {
    color: SWC.given,
    sm: true,
    mono: true
  }, "v", xw.toVersion), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: SWC.text
    }
  }, Object.keys(xw.mappings).length, " mapping", Object.keys(xw.mappings).length !== 1 ? 's' : ''), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: SWC.dim,
      marginLeft: 'auto',
      fontFamily: 'var(--mono)'
    }
  }, new Date(xw.createdAt).toLocaleDateString())))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 12,
      textAlign: 'right'
    }
  }, /*#__PURE__*/React.createElement(SwBtn, {
    ghost: true,
    accent: SWC.muted,
    onClick: () => setShowVersionHistory(false)
  }, "Done")))), showAnswerCrosswalk && crosswalkSource && /*#__PURE__*/React.createElement("div", {
    className: "fb-adopt-modal",
    onClick: () => {
      setShowAnswerCrosswalk(false);
      setCrosswalkSource(null);
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "fb-adopt-panel",
    onClick: e => e.stopPropagation(),
    style: {
      maxWidth: 760
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 18,
      fontWeight: 700,
      color: SWC.white
    }
  }, "Answer Crosswalk"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: SWC.muted,
      marginTop: 4
    }
  }, "Map answers from ", /*#__PURE__*/React.createElement(SwTag, {
    color: SWC.meant,
    sm: true,
    mono: true
  }, "v", crosswalkSource.version), " to the current form ", /*#__PURE__*/React.createElement(SwTag, {
    color: SWC.given,
    sm: true,
    mono: true
  }, "v", form.version), ". Past answers recorded against v", crosswalkSource.version, " will be translated using these mappings.")), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setShowAnswerCrosswalk(false);
      setCrosswalkSource(null);
    },
    style: {
      background: 'none',
      border: 'none',
      color: SWC.muted,
      cursor: 'pointer',
      fontSize: 20
    }
  }, "\xD7")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: SWC.dim,
      marginBottom: 12,
      padding: '8px 12px',
      background: SWC.raised,
      borderRadius: 6,
      lineHeight: 1.6
    }
  }, "For each old answer option on the left, select the equivalent current answer option on the right. Unmapped answers will be preserved as-is with their original value."), (() => {
    const oldSections = crosswalkSource.form?.sections || [];
    const newAllQs = form.sections.flatMap(s => s.questions);
    const newAllOpts = newAllQs.flatMap(q => (q.options || []).map(o => ({
      ...o,
      questionPrompt: q.prompt,
      questionId: q.id
    })));
    return oldSections.map(oldSec => /*#__PURE__*/React.createElement("div", {
      key: oldSec.id,
      style: {
        marginBottom: 12
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        fontWeight: 600,
        color: SWC.muted,
        marginBottom: 6,
        borderBottom: `1px solid ${SWC.border}`,
        paddingBottom: 4
      }
    }, oldSec.title), (oldSec.questions || []).filter(q => q.options && q.options.length > 0).map(oldQ => {
      // Try to find matching new question by id or prompt similarity
      const matchingNewQ = newAllQs.find(nq => nq.id === oldQ.id) || newAllQs.find(nq => nq.prompt === oldQ.prompt);
      const targetOpts = matchingNewQ ? matchingNewQ.options || [] : newAllOpts;
      return /*#__PURE__*/React.createElement("div", {
        key: oldQ.id,
        style: {
          marginBottom: 8
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          fontSize: 13,
          color: SWC.white,
          marginBottom: 4,
          display: 'flex',
          alignItems: 'center',
          gap: 6
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          color: SWC.meant
        }
      }, "OLD:"), " ", oldQ.prompt, matchingNewQ && /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 11,
          color: SWC.given
        }
      }, "\u2192 matched"), !matchingNewQ && /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 11,
          color: SWC.sup
        }
      }, "\u2192 no exact match (showing all options)")), /*#__PURE__*/React.createElement("div", {
        style: {
          border: `1px solid ${SWC.border}`,
          borderRadius: 8,
          overflow: 'hidden',
          background: SWC.surface
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          display: 'grid',
          gridTemplateColumns: '1fr 40px 1fr',
          borderBottom: `1px solid ${SWC.border}`,
          background: SWC.raised
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          padding: '6px 10px',
          fontSize: 11,
          fontWeight: 700,
          textTransform: 'uppercase',
          color: SWC.meant
        }
      }, "Old answer (v", crosswalkSource.version, ")"), /*#__PURE__*/React.createElement("div", {
        style: {
          padding: '6px 4px',
          fontSize: 11,
          color: SWC.dim,
          textAlign: 'center'
        }
      }, "\u2192"), /*#__PURE__*/React.createElement("div", {
        style: {
          padding: '6px 10px',
          fontSize: 11,
          fontWeight: 700,
          textTransform: 'uppercase',
          color: SWC.given
        }
      }, "Current answer (v", form.version, ")")), oldQ.options.map(oldOpt => /*#__PURE__*/React.createElement("div", {
        key: oldOpt.id,
        style: {
          display: 'grid',
          gridTemplateColumns: '1fr 40px 1fr',
          borderBottom: `1px solid ${SWC.border}`,
          alignItems: 'center'
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          padding: '6px 10px',
          fontSize: 13,
          color: SWC.text
        }
      }, oldOpt.label), /*#__PURE__*/React.createElement("div", {
        style: {
          padding: '6px 4px',
          fontSize: 11,
          color: SWC.dim,
          textAlign: 'center'
        }
      }, "\u2192"), /*#__PURE__*/React.createElement("div", {
        style: {
          padding: '4px 6px'
        }
      }, /*#__PURE__*/React.createElement("select", {
        value: answerMappings[oldOpt.id] || '',
        onChange: e => doSetAnswerMapping(oldOpt.id, e.target.value || null),
        style: {
          width: '100%',
          padding: '5px 8px',
          borderRadius: 4,
          border: `1px solid ${answerMappings[oldOpt.id] ? SWC.givenBorder : SWC.border}`,
          background: answerMappings[oldOpt.id] ? 'rgba(45,212,160,0.06)' : SWC.surface,
          color: SWC.white,
          fontSize: 12,
          fontFamily: 'inherit'
        }
      }, /*#__PURE__*/React.createElement("option", {
        value: ""
      }, "\u2014 unmapped (keep original) \u2014"), targetOpts.map(nOpt => /*#__PURE__*/React.createElement("option", {
        key: nOpt.id,
        value: nOpt.id
      }, nOpt.label))))))));
    })));
  })(), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: SWC.dim
    }
  }, Object.keys(answerMappings).length, " mapping", Object.keys(answerMappings).length !== 1 ? 's' : '', " defined"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(SwBtn, {
    ghost: true,
    accent: SWC.muted,
    onClick: () => {
      setShowAnswerCrosswalk(false);
      setCrosswalkSource(null);
    }
  }, "Cancel"), /*#__PURE__*/React.createElement(SwBtn, {
    accent: SWC.given,
    onClick: doSaveAnswerCrosswalk,
    disabled: Object.keys(answerMappings).length === 0
  }, "Save Answer Crosswalk")))));
};

/* ═══════════════════ NOTIFICATION CENTER ═══════════════════ */

/* Notification types: schema_update, schema_new, message, data_change, org_event */
const NotificationBell = ({
  notifications,
  onNotifClick,
  onDismiss,
  onDismissAll
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const unreadCount = notifications.filter(n => !n.read).length;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = e => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);
  const iconForType = type => {
    switch (type) {
      case 'schema_update':
        return {
          icon: 'layers',
          color: 'var(--gold)',
          bg: 'rgba(201,163,82,.12)'
        };
      case 'schema_new':
        return {
          icon: 'layers',
          color: 'var(--teal)',
          bg: 'rgba(62,201,176,.12)'
        };
      case 'message':
        return {
          icon: 'msg',
          color: 'var(--blue)',
          bg: 'rgba(91,156,245,.12)'
        };
      case 'data_change':
        return {
          icon: 'zap',
          color: 'var(--orange)',
          bg: 'rgba(224,150,72,.12)'
        };
      case 'org_event':
        return {
          icon: 'shieldCheck',
          color: 'var(--blue)',
          bg: 'rgba(91,156,245,.12)'
        };
      default:
        return {
          icon: 'bell',
          color: 'var(--tx-2)',
          bg: 'var(--bg-3)'
        };
    }
  };
  const timeAgo = ts => {
    const diff = Date.now() - ts;
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };
  return /*#__PURE__*/React.createElement("div", {
    ref: ref,
    style: {
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "notif-bell",
    onClick: () => setOpen(prev => !prev),
    title: "Notifications"
  }, /*#__PURE__*/React.createElement(I, {
    n: "bell",
    s: 16
  }), unreadCount > 0 && /*#__PURE__*/React.createElement("span", {
    className: "notif-badge"
  }, unreadCount > 9 ? '9+' : unreadCount)), open && /*#__PURE__*/React.createElement("div", {
    className: "notif-dropdown"
  }, /*#__PURE__*/React.createElement("div", {
    className: "notif-dropdown-hdr"
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      fontWeight: 600,
      color: 'var(--tx-0)'
    }
  }, "Notifications"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      alignItems: 'center'
    }
  }, unreadCount > 0 && /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      onDismissAll();
    },
    style: {
      fontSize: 10,
      color: 'var(--teal)',
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      fontFamily: 'var(--mono)'
    }
  }, "Mark all read"))), /*#__PURE__*/React.createElement("div", {
    className: "notif-dropdown-list"
  }, notifications.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "notif-empty"
  }, /*#__PURE__*/React.createElement(I, {
    n: "check",
    s: 18,
    c: "var(--teal)"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 6
    }
  }, "No notifications")) : notifications.map((n, i) => {
    const {
      icon,
      color,
      bg
    } = iconForType(n.type);
    return /*#__PURE__*/React.createElement("div", {
      key: n.id || i,
      className: `notif-item${!n.read ? ' unread' : ''}`,
      onClick: () => {
        onNotifClick(n);
        setOpen(false);
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "notif-icon",
      style: {
        background: bg
      }
    }, /*#__PURE__*/React.createElement(I, {
      n: icon,
      s: 14,
      c: color
    })), /*#__PURE__*/React.createElement("div", {
      className: "notif-body"
    }, /*#__PURE__*/React.createElement("div", {
      className: "notif-title"
    }, n.title), n.description && /*#__PURE__*/React.createElement("div", {
      className: "notif-desc"
    }, n.description), /*#__PURE__*/React.createElement("div", {
      className: "notif-time"
    }, timeAgo(n.timestamp))), !n.read && /*#__PURE__*/React.createElement("div", {
      style: {
        width: 6,
        height: 6,
        borderRadius: 3,
        background: 'var(--teal)',
        flexShrink: 0,
        marginTop: 6
      }
    }));
  }))));
};

/* ═══════════════════ SCHEMA BUILDER ═══════════════════ */

/* ── Sidebar form list item ── */
const SiFormItem = ({
  form,
  isActive,
  onClick,
  sourceType
}) => {
  const dotClass = isActive ? 'current' : form._unread ? 'unread' : 'read';
  const maturity = form.maturity || 'draft';
  const matLabel = { draft: 'Draft', trial: 'Trial', normative: 'Adopted', de_facto: 'De facto', deprecated: 'Deprecated' }[maturity] || maturity;
  return /*#__PURE__*/React.createElement("div", {
    className: `si-form-item${isActive ? ' active' : ''}`,
    onClick: onClick
  }, /*#__PURE__*/React.createElement("div", {
    className: `si-dot ${dotClass}`
  }), /*#__PURE__*/React.createElement("div", {
    style: { flex: 1, minWidth: 0 }
  }, /*#__PURE__*/React.createElement("div", {
    className: "si-form-name"
  }, form.name), /*#__PURE__*/React.createElement("div", {
    className: "si-form-meta"
  }, /*#__PURE__*/React.createElement("span", {
    className: `si-form-status ${maturity}`,
    title: MATURITY_LEVELS[maturity]?.desc || ''
  }, matLabel), /*#__PURE__*/React.createElement("span", null, "v", form.version)), form._hasUpdate && /*#__PURE__*/React.createElement("div", {
    className: "si-form-update"
  }, "\u25B2 new")));
};

/* ── Sidebar group header ── */
const SiGroupHeader = ({
  label,
  icon,
  count,
  expanded,
  onToggle,
  alert
}) => /*#__PURE__*/React.createElement("div", {
  className: "si-group-header",
  onClick: onToggle
}, /*#__PURE__*/React.createElement("span", {
  className: "si-group-label"
}, /*#__PURE__*/React.createElement(I, {
  n: expanded ? "chevronDown" : "chevronRight",
  s: 10
}), /*#__PURE__*/React.createElement(I, {
  n: icon,
  s: 11
}), label), /*#__PURE__*/React.createElement("span", {
  className: `si-group-count${alert ? ' alert' : ''}`
}, count));

/* ── Context panel: version timeline ── */
const SiVersionTimeline = ({
  form,
  onClickVersion
}) => {
  const history = (form.versionHistory || []).slice().reverse();
  return /*#__PURE__*/React.createElement("div", {
    className: "si-vt"
  }, /*#__PURE__*/React.createElement("div", {
    className: "si-vt-node"
  }, /*#__PURE__*/React.createElement("div", {
    className: "si-vt-dot current"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      fontFamily: 'var(--mono)',
      fontWeight: 600,
      color: 'var(--tx-0)'
    }
  }, "v", form.version), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      color: 'var(--tx-3)',
      fontFamily: 'var(--mono)'
    }
  }, "current")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      color: 'var(--tx-2)',
      marginTop: 2,
      fontFamily: 'var(--mono)'
    }
  }, form.sections?.length || 0, " sections \xB7 ", (form.sections || []).flatMap(s => s.questions || []).length, " questions")), history.map((h, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "si-vt-node",
    onClick: () => onClickVersion && onClickVersion(h),
    style: {
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "si-vt-dot past"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      fontFamily: 'var(--mono)',
      fontWeight: 600,
      color: 'var(--tx-1)'
    }
  }, "v", h.version), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      color: 'var(--tx-3)',
      fontFamily: 'var(--mono)'
    }
  }, h.bumpedAt ? new Date(h.bumpedAt).toLocaleDateString() : '')), h.notes && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10.5,
      color: 'var(--tx-2)',
      marginTop: 1,
      lineHeight: 1.4,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, h.notes))), history.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10.5,
      color: 'var(--tx-3)',
      padding: '4px 0 0 16px'
    }
  }, "No prior versions"));
};

/* ── Context panel: lineage ── */
const SiLineage = ({
  form,
  orgMeta,
  networkMembers,
  isOrg
}) => {
  const isNetwork = form.source?.level === 'network' || form._sourceType === 'network';
  const isOrgForm = form.source?.level === 'org' || form._sourceType === 'org';
  return /*#__PURE__*/React.createElement("div", null, isNetwork && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "si-lineage-node",
    style: {
      background: 'rgba(62,201,176,.06)',
      border: '1px solid rgba(62,201,176,.15)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "globe",
    s: 12,
    c: "var(--teal)"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      fontWeight: 600,
      color: 'var(--teal)'
    }
  }, "Network")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      color: 'var(--tx-2)',
      fontFamily: 'var(--mono)',
      marginTop: 2
    }
  }, form.source?.propagation || 'standard')), /*#__PURE__*/React.createElement("div", {
    className: "si-lineage-connector"
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 9,
      color: 'var(--tx-3)',
      fontFamily: 'var(--mono)'
    }
  }, form.source?.propagation || 'standard'))), (isNetwork || isOrgForm) && orgMeta?.name && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "si-lineage-node",
    style: {
      background: 'rgba(91,156,245,.06)',
      border: '1px solid rgba(91,156,245,.15)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "shieldCheck",
    s: 12,
    c: "var(--blue)"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      fontWeight: 600,
      color: 'var(--blue)'
    }
  }, orgMeta.name))), /*#__PURE__*/React.createElement("div", {
    className: "si-lineage-connector"
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 9,
      color: 'var(--tx-3)',
      fontFamily: 'var(--mono)'
    }
  }, "active"))), /*#__PURE__*/React.createElement("div", {
    className: "si-lineage-node",
    style: {
      background: 'rgba(230,233,240,.06)',
      border: '1px solid var(--border-1)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "user",
    s: 12,
    c: "var(--tx-0)"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      fontWeight: 600,
      color: 'var(--tx-0)'
    }
  }, "You ", isOrg ? '(provider)' : '(local)'))));
};

/* ── Context panel: related forms ── */
const SiRelatedForms = ({
  currentForm,
  allForms,
  onNavigate
}) => {
  const currentFieldKeys = new Set((currentForm.sections || []).flatMap(s => (s.questions || []).map(q => q.key || q.id)));
  const related = allForms.filter(f => {
    if (f.id === currentForm.id || f.key === currentForm.key) return false;
    const fKeys = new Set((f.sections || []).flatMap(s => (s.questions || []).map(q => q.key || q.id)));
    let shared = 0;
    for (const k of currentFieldKeys) if (fKeys.has(k)) shared++;
    return shared > 0;
  }).map(f => {
    const fKeys = new Set((f.sections || []).flatMap(s => (s.questions || []).map(q => q.key || q.id)));
    let shared = 0;
    for (const k of currentFieldKeys) if (fKeys.has(k)) shared++;
    return {
      ...f,
      _sharedCount: shared
    };
  });
  if (related.length === 0) return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 12,
      border: '1px dashed var(--border-1)',
      borderRadius: 6,
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: 'var(--tx-3)',
      lineHeight: 1.5
    }
  }, "No related forms detected. Forms sharing field keys will appear here."));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6
    }
  }, related.map(f => /*#__PURE__*/React.createElement("div", {
    key: f.id,
    onClick: () => onNavigate && onNavigate(f),
    style: {
      padding: '8px 12px',
      borderRadius: 6,
      border: '1px solid var(--border-0)',
      background: 'var(--bg-0)',
      cursor: 'pointer',
      transition: 'all 150ms'
    },
    onMouseEnter: e => e.currentTarget.style.borderColor = 'var(--border-2)',
    onMouseLeave: e => e.currentTarget.style.borderColor = 'var(--border-0)'
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "link",
    s: 11,
    c: "var(--tx-3)"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      fontWeight: 600,
      color: 'var(--tx-0)'
    }
  }, f.name)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      fontFamily: 'var(--mono)',
      color: 'var(--tx-2)',
      marginTop: 2
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--teal)'
    }
  }, f._sharedCount), " shared field", f._sharedCount !== 1 ? 's' : ''))));
};

/* ── Context panel (right side) ── */
const SiContextPanel = ({
  form,
  collapsed,
  onToggle,
  orgMeta,
  networkMembers,
  isOrg,
  allForms,
  onNavigateForm,
  onClickVersion
}) => {
  if (collapsed) return /*#__PURE__*/React.createElement("div", {
    className: "si-context collapsed"
  }, /*#__PURE__*/React.createElement("div", {
    className: "si-ctx-strip"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onToggle,
    title: "Expand context"
  }, /*#__PURE__*/React.createElement(I, {
    n: "chevronLeft",
    s: 13
  })), /*#__PURE__*/React.createElement("button", {
    onClick: onToggle,
    title: "Lineage"
  }, /*#__PURE__*/React.createElement(I, {
    n: "gitBranch",
    s: 14
  })), /*#__PURE__*/React.createElement("button", {
    onClick: onToggle,
    title: "Versions"
  }, /*#__PURE__*/React.createElement(I, {
    n: "clock",
    s: 14
  })), /*#__PURE__*/React.createElement("button", {
    onClick: onToggle,
    title: "Related"
  }, /*#__PURE__*/React.createElement(I, {
    n: "link",
    s: 14
  })), /*#__PURE__*/React.createElement("button", {
    onClick: onToggle,
    title: "Activity"
  }, /*#__PURE__*/React.createElement(I, {
    n: "activity",
    s: 14
  }))));
  if (!form) return /*#__PURE__*/React.createElement("div", {
    className: "si-context"
  }, /*#__PURE__*/React.createElement("div", {
    className: "si-ctx-section"
  }, /*#__PURE__*/React.createElement("span", {
    className: "si-ctx-label"
  }, "No form selected")));
  return /*#__PURE__*/React.createElement("div", {
    className: "si-context"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '12px 14px 8px',
      borderBottom: '1px solid var(--border-0)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "si-ctx-label",
    style: {
      marginBottom: 0
    }
  }, "CONTEXT"), /*#__PURE__*/React.createElement("button", {
    onClick: onToggle,
    style: {
      background: 'none',
      border: 'none',
      color: 'var(--tx-3)',
      cursor: 'pointer',
      padding: 2
    },
    title: "Collapse"
  }, /*#__PURE__*/React.createElement(I, {
    n: "chevronRight",
    s: 12
  }))), /*#__PURE__*/React.createElement("div", {
    className: "si-ctx-section"
  }, /*#__PURE__*/React.createElement("span", {
    className: "si-ctx-label"
  }, "LINEAGE"), /*#__PURE__*/React.createElement(SiLineage, {
    form: form,
    orgMeta: orgMeta,
    networkMembers: networkMembers,
    isOrg: isOrg
  })), /*#__PURE__*/React.createElement("div", {
    className: "si-ctx-section"
  }, /*#__PURE__*/React.createElement("span", {
    className: "si-ctx-label"
  }, "VERSION TIMELINE"), /*#__PURE__*/React.createElement(SiVersionTimeline, {
    form: form,
    onClickVersion: onClickVersion
  })), /*#__PURE__*/React.createElement("div", {
    className: "si-ctx-section"
  }, /*#__PURE__*/React.createElement("span", {
    className: "si-ctx-label"
  }, "RELATED FORMS"), /*#__PURE__*/React.createElement(SiRelatedForms, {
    currentForm: form,
    allForms: allForms,
    onNavigate: onNavigateForm
  })), /*#__PURE__*/React.createElement("div", {
    className: "si-ctx-section"
  }, /*#__PURE__*/React.createElement("span", {
    className: "si-ctx-label"
  }, "ACTIVITY"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10.5,
      color: 'var(--tx-3)'
    }
  }, form.updatedAt && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      marginBottom: 4
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 5,
      height: 5,
      borderRadius: '50%',
      background: 'var(--teal)',
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--mono)'
    }
  }, new Date(form.updatedAt).toLocaleDateString()), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--tx-2)'
    }
  }, "Last edited")), form.createdAt && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 5,
      height: 5,
      borderRadius: '50%',
      background: 'var(--tx-3)',
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--mono)'
    }
  }, new Date(form.createdAt).toLocaleDateString()), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--tx-2)'
    }
  }, "Created")), !form.updatedAt && !form.createdAt && /*#__PURE__*/React.createElement("span", null, "No activity recorded"))));
};

/* ── Forms sidebar (left side) ── */
const SiFormsSidebar = ({
  myForms,
  networkForms,
  orgForms,
  activeFormId,
  onSelectForm,
  onNewForm,
  searchQuery,
  onSearchChange,
  sidebarOpen,
  onToggleSidebar
}) => {
  const [expanded, setExpanded] = useState({
    my: true,
    org: false,
    network: true
  });
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'attention'
  const toggle = g => setExpanded(prev => ({
    ...prev,
    [g]: !prev[g]
  }));
  const filterForms = forms => {
    let result = forms;
    if (searchQuery && searchQuery.length >= 2) {
      const q = searchQuery.toLowerCase();
      result = result.filter(f => f.name.toLowerCase().includes(q) || (f.key || '').toLowerCase().includes(q) || (f.description || '').toLowerCase().includes(q) || (f.sections || []).some(s => s.title.toLowerCase().includes(q) || (s.questions || []).some(qn => (qn.prompt || '').toLowerCase().includes(q))));
    }
    if (filterMode === 'attention') {
      result = result.filter(f => f._unread || f._hasUpdate);
    }
    return result;
  };
  const filtMy = filterForms(myForms);
  const filtOrg = filterForms(orgForms);
  const filtNet = filterForms(networkForms);

  // Count items needing attention across all groups
  const attentionCount = [...myForms, ...orgForms, ...networkForms].filter(f => f._unread || f._hasUpdate).length;
  return /*#__PURE__*/React.createElement("div", {
    className: `si-sidebar${sidebarOpen ? ' open' : ''}`
  }, /*#__PURE__*/React.createElement("div", {
    className: "si-header"
  }, /*#__PURE__*/React.createElement("span", {
    className: "si-group-label",
    style: {
      fontSize: 11
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "layers",
    s: 13,
    c: "var(--teal)"
  }), " SCHEMA"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 4
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onNewForm,
    style: {
      width: 24,
      height: 24,
      borderRadius: 6,
      background: 'transparent',
      border: '1px solid var(--border-0)',
      color: 'var(--tx-1)',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'all .15s'
    },
    onMouseEnter: e => {
      e.currentTarget.style.background = 'var(--bg-3)';
      e.currentTarget.style.color = 'var(--tx-0)';
    },
    onMouseLeave: e => {
      e.currentTarget.style.background = 'transparent';
      e.currentTarget.style.color = 'var(--tx-1)';
    },
    title: "New form"
  }, /*#__PURE__*/React.createElement(I, {
    n: "plus",
    s: 12
  })))), /*#__PURE__*/React.createElement("div", {
    className: "si-search"
  }, /*#__PURE__*/React.createElement("span", {
    className: "si-search-icon"
  }, /*#__PURE__*/React.createElement(I, {
    n: "search",
    s: 12,
    c: "var(--tx-3)"
  })), /*#__PURE__*/React.createElement("input", {
    value: searchQuery,
    onChange: e => onSearchChange(e.target.value),
    placeholder: "Search forms..."
  })), /*#__PURE__*/React.createElement("div", {
    className: "si-filter-bar"
  }, /*#__PURE__*/React.createElement("button", {
    className: `si-filter-btn${filterMode === 'all' ? ' active' : ''}`,
    onClick: () => setFilterMode('all')
  }, "All"), /*#__PURE__*/React.createElement("button", {
    className: `si-filter-btn${filterMode === 'attention' ? ' active' : ''}`,
    onClick: () => setFilterMode('attention')
  }, "Needs attention", attentionCount > 0 ? ` (${attentionCount})` : '')), /*#__PURE__*/React.createElement("div", {
    className: "si-sidebar-scroll"
  }, /*#__PURE__*/React.createElement(SiGroupHeader, {
    label: "MY FORMS",
    icon: "folder",
    count: filtMy.length,
    expanded: expanded.my,
    onToggle: () => toggle('my')
  }), expanded.my && (filtMy.length > 0 ? filtMy.map(f => /*#__PURE__*/React.createElement(SiFormItem, {
    key: f.id,
    form: f,
    isActive: f.id === activeFormId,
    onClick: () => onSelectForm(f),
    sourceType: "local"
  })) : /*#__PURE__*/React.createElement("div", {
    className: "si-empty"
  }, /*#__PURE__*/React.createElement("div", {
    className: "si-empty-title"
  }, filterMode === 'attention' ? 'Nothing needs attention' : 'No saved forms'), /*#__PURE__*/React.createElement("div", {
    className: "si-empty-desc"
  }, filterMode === 'attention' ? 'All local forms are up to date.' : 'Use "Save" to save a form here.'))), /*#__PURE__*/React.createElement(SiGroupHeader, {
    label: "ORG FORMS",
    icon: "shieldCheck",
    count: filtOrg.length,
    expanded: expanded.org,
    onToggle: () => toggle('org'),
    alert: filtOrg.some(f => f._unread || f._hasUpdate)
  }), expanded.org && (filtOrg.length > 0 ? filtOrg.map(f => /*#__PURE__*/React.createElement(SiFormItem, {
    key: f.id,
    form: f,
    isActive: f.id === activeFormId,
    onClick: () => onSelectForm(f),
    sourceType: "org"
  })) : /*#__PURE__*/React.createElement("div", {
    className: "si-empty"
  }, /*#__PURE__*/React.createElement("div", {
    className: "si-empty-desc"
  }, filterMode === 'attention' ? 'No org form updates.' : 'No org forms available.'))), /*#__PURE__*/React.createElement(SiGroupHeader, {
    label: "NETWORK",
    icon: "globe",
    count: filtNet.length,
    expanded: expanded.network,
    onToggle: () => toggle('network'),
    alert: filtNet.some(f => f._unread || f._hasUpdate)
  }), expanded.network && (filtNet.length > 0 ? filtNet.map(f => /*#__PURE__*/React.createElement(SiFormItem, {
    key: f.id,
    form: f,
    isActive: f.id === activeFormId,
    onClick: () => onSelectForm(f),
    sourceType: "network"
  })) : /*#__PURE__*/React.createElement("div", {
    className: "si-empty"
  }, /*#__PURE__*/React.createElement("div", {
    className: "si-empty-desc"
  }, filterMode === 'attention' ? 'No network updates.' : 'No network schema available.'))), filterMode === 'attention' && filtMy.length === 0 && filtOrg.length === 0 && filtNet.length === 0 && /*#__PURE__*/React.createElement("div", {
    className: "si-empty",
    style: {
      paddingTop: 40
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "si-empty-icon"
  }, /*#__PURE__*/React.createElement(I, {
    n: "check",
    s: 22,
    c: "var(--teal)"
  })), /*#__PURE__*/React.createElement("div", {
    className: "si-empty-title"
  }, "All caught up"), /*#__PURE__*/React.createElement("div", {
    className: "si-empty-desc"
  }, "No forms need your attention right now."))));
};

/* ── SchemaView — Three-zone layout wrapping FormBuilder ── */
const SchemaView = ({
  isOrg,
  orgMeta,
  networkMembers,
  fieldDefs,
  catLabels,
  catColors,
  onSaveFieldDef
}) => {
  SWC = useSWC();
  const [contextOpen, setContextOpen] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false); // for mobile overlay
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarSelectedId, setSidebarSelectedId] = useState(null);
  const [sidebarForms, setSidebarForms] = useState([]); // all forms in sidebar across all groups

  // Build sidebar form lists from DEFAULT_FORMS (network commons)
  const networkForms = useMemo(() => DEFAULT_FORMS.map(f => ({
    ...f,
    _sourceType: 'network',
    _unread: false,
    _hasUpdate: false,
    sections: [{
      id: 'sec_' + f.id,
      title: f.name,
      questions: f.fields.map(fld => ({
        id: fld.id || fld.key,
        key: fld.key,
        prompt: fld.question,
        type: fld.type,
        options: (fld.options || []).map((o, oi) => ({
          id: `${fld.key}_opt_${oi}`,
          label: o
        }))
      }))
    }]
  })), []);

  // Currently active form from FormBuilder (read from formBuilder's own state)
  // We track which form is selected; FormBuilder manages its own full state
  const activeForm = useMemo(() => {
    if (sidebarSelectedId) {
      const found = [...networkForms, ...sidebarForms].find(f => f.id === sidebarSelectedId);
      if (found) return found;
    }
    return null;
  }, [sidebarSelectedId, networkForms, sidebarForms]);
  const allKnownForms = useMemo(() => [...networkForms, ...sidebarForms], [networkForms, sidebarForms]);

  // Breadcrumb
  const breadcrumbGroup = activeForm?._sourceType === 'network' ? 'Network' : activeForm?._sourceType === 'org' ? 'Org Forms' : 'My Forms';
  return /*#__PURE__*/React.createElement("div", {
    className: "si-wrap anim-up"
  }, /*#__PURE__*/React.createElement(SiFormsSidebar, {
    myForms: sidebarForms.filter(f => f._sourceType === 'local'),
    networkForms: networkForms,
    orgForms: sidebarForms.filter(f => f._sourceType === 'org'),
    activeFormId: sidebarSelectedId,
    onSelectForm: f => setSidebarSelectedId(f.id),
    onNewForm: () => setSidebarSelectedId(null),
    searchQuery: searchQuery,
    onSearchChange: setSearchQuery,
    sidebarOpen: sidebarOpen,
    onToggleSidebar: () => setSidebarOpen(prev => !prev)
  }), /*#__PURE__*/React.createElement("div", {
    className: "si-canvas"
  }, /*#__PURE__*/React.createElement(StorageTransparencyBadge, {
    storageType: "matrix",
    encrypted: true,
    encLabel: "Megolm E2EE",
    label: "Schema",
    extra: [{ label: 'Storage', value: 'Schema definitions (forms, assessments, field definitions, crosswalks) are stored as state events in your personal Schema room. Network-level schemas are shared via the network room.' }]
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "si-breadcrumb"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setSidebarOpen(true),
    style: {
      background: 'none',
      border: 'none',
      color: 'var(--tx-1)',
      cursor: 'pointer',
      padding: '2px 8px 2px 0',
      display: 'none'
    },
    className: "si-mobile-menu"
  }, /*#__PURE__*/React.createElement(I, {
    n: "menu",
    s: 16
  })), /*#__PURE__*/React.createElement(I, {
    n: "layers",
    s: 13,
    c: "var(--teal)"
  }), /*#__PURE__*/React.createElement("span", {
    className: "sep"
  }, "/"), /*#__PURE__*/React.createElement("span", null, breadcrumbGroup), activeForm && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
    className: "sep"
  }, "/"), /*#__PURE__*/React.createElement("span", {
    className: "current"
  }, activeForm.name), /*#__PURE__*/React.createElement("span", {
    className: "sep"
  }, "/"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--mono)',
      fontSize: 10
    }
  }, "v", activeForm.version)))), /*#__PURE__*/React.createElement(FormBuilder, {
    isOrg: isOrg,
    fieldDefs: fieldDefs,
    catLabels: catLabels,
    catColors: catColors,
    onSaveFieldDef: onSaveFieldDef,
    activeForm: activeForm
  })), /*#__PURE__*/React.createElement(SiContextPanel, {
    form: activeForm,
    collapsed: !contextOpen,
    onToggle: () => setContextOpen(prev => !prev),
    orgMeta: orgMeta,
    networkMembers: networkMembers,
    isOrg: isOrg,
    allForms: allKnownForms,
    onNavigateForm: f => setSidebarSelectedId(f.id)
  }), sidebarOpen && /*#__PURE__*/React.createElement("div", {
    onClick: () => setSidebarOpen(false),
    style: {
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,.5)',
      zIndex: 39
    }
  }));
};

/* ═══════════════════ SCHEMA WORKBENCH (Redesigned) ═══════════════════ */

/* ── DictionaryTab — unified field catalog ── */
const DictionaryTab = ({ fieldDefs, allForms, catLabels, catColors, catIcons, onSaveFieldDef }) => {
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('all');
  const [expandedUri, setExpandedUri] = useState(null);
  const [editDraft, setEditDraft] = useState({});
  const [uriBrowserOpen, setUriBrowserOpen] = useState(false);
  const [uriBrowserMode, setUriBrowserMode] = useState('import'); // 'import' or 'link'
  const [linkTargetUri, setLinkTargetUri] = useState(null);

  // Collect ALL field definitions: vault fields + fieldDefs dictionary + form-generated
  const allFieldEntries = useMemo(() => {
    const map = {};
    // Start with vault fields
    VAULT_FIELDS.forEach(vf => {
      map[vf.uri] = { ...vf, source: 'vault' };
    });
    // Merge fieldDefs (may override/extend vault)
    if (fieldDefs) {
      Object.entries(fieldDefs).forEach(([uri, def]) => {
        if (map[uri]) {
          map[uri] = { ...map[uri], ...def, source: map[uri].source || 'custom' };
        } else {
          map[uri] = { ...def, uri, source: 'custom' };
        }
      });
    }
    // Auto-register fields from forms
    (allForms || []).forEach(f => {
      (f.fields || []).forEach(field => {
        const uri = field.field_uri || `khora:form/${f.id}/${field.key}`;
        if (!map[uri]) {
          map[uri] = {
            uri,
            key: field.key,
            label: field.question || field.key,
            category: field.category || 'case',
            data_type: field.type === 'single_select' ? 'select' : field.type || 'text',
            definition: field.helpText || '',
            scope: '',
            sensitive: field.sensitive || false,
            source: 'form',
            form_name: f.name,
            form_id: f.id
          };
        }
      });
    });
    return Object.values(map);
  }, [fieldDefs, allForms]);

  // Which forms use each field
  const fieldUsage = useMemo(() => {
    const usage = {};
    (allForms || []).forEach(f => {
      (f.fields || []).forEach(field => {
        const uri = field.field_uri || `khora:form/${f.id}/${field.key}`;
        if (!usage[uri]) usage[uri] = [];
        usage[uri].push({ id: f.id, name: f.name });
      });
    });
    return usage;
  }, [allForms]);

  const categories = useMemo(() => [...new Set(allFieldEntries.map(f => f.category).filter(Boolean))], [allFieldEntries]);

  const filtered = useMemo(() => {
    let list = allFieldEntries;
    if (filterCat !== 'all') list = list.filter(f => f.category === filterCat);
    if (search.length >= 2) {
      const q = search.toLowerCase();
      list = list.filter(f =>
        (f.label || '').toLowerCase().includes(q) ||
        (f.key || '').toLowerCase().includes(q) ||
        (f.definition || '').toLowerCase().includes(q) ||
        (f.uri || '').toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => (a.label || '').localeCompare(b.label || ''));
  }, [allFieldEntries, filterCat, search]);

  const toggleExpand = (uri) => {
    if (expandedUri === uri) {
      setExpandedUri(null);
      setEditDraft({});
    } else {
      const f = allFieldEntries.find(x => x.uri === uri);
      setExpandedUri(uri);
      setEditDraft(f ? { definition: f.definition || '', scope: f.scope || '' } : {});
    }
  };

  const doSave = () => {
    if (!expandedUri || !onSaveFieldDef) return;
    const f = allFieldEntries.find(x => x.uri === expandedUri);
    if (f) {
      onSaveFieldDef({ ...f, ...editDraft });
    }
    setExpandedUri(null);
  };

  // Import a URI library entry as a new field definition
  const doImportFromUri = entry => {
    if (!onSaveFieldDef) return;
    onSaveFieldDef({
      uri: entry.uri,
      key: entry.key,
      label: entry.label,
      definition: entry.definition,
      data_type: entry.data_type || 'text',
      category: entry.category || 'general',
      sensitive: false,
      scope: null,
      authority: entry.source_library || null,
      source_library: entry.source_library,
      source_library_id: entry.source_library_id,
      version: 1,
      version_history: [],
      migration_rules: [],
      supersedes: null,
      superseded_by: null,
      created_by: 'uri_library',
      created_at: Date.now()
    });
    setUriBrowserOpen(false);
  };

  // Link an existing field to a standard URI
  const doLinkToUri = entry => {
    if (!onSaveFieldDef || !linkTargetUri) return;
    const existing = allFieldEntries.find(f => f.uri === linkTargetUri);
    if (existing) {
      onSaveFieldDef({
        ...existing,
        standard_uri: entry.uri,
        standard_label: entry.label,
        standard_library: entry.source_library,
        standard_library_id: entry.source_library_id
      });
    }
    setUriBrowserOpen(false);
    setLinkTargetUri(null);
  };

  const typeColor = (dt) => {
    const m = { text: 'blue', select: 'teal', date: 'gold', number: 'orange', boolean: 'green',
      email: 'blue', phone: 'blue', address: 'gold', text_long: 'purple', document: 'orange',
      single_select: 'teal', multi_select: 'teal', duration: 'gold' };
    return m[dt] || 'blue';
  };

  return React.createElement('div', null,
    // Stats row + import button
    React.createElement('div', { className: 'sw-dict-stats', style: { justifyContent: 'space-between', alignItems: 'center' } },
      React.createElement('div', { style: { display: 'flex', gap: 16, flexWrap: 'wrap' } },
        React.createElement('span', { className: 'sw-dict-stat' }, React.createElement('strong', null, allFieldEntries.length), ' total fields'),
        React.createElement('span', { className: 'sw-dict-stat' }, React.createElement('strong', null, allFieldEntries.filter(f => f.source === 'vault').length), ' vault'),
        React.createElement('span', { className: 'sw-dict-stat' }, React.createElement('strong', null, allFieldEntries.filter(f => f.sensitive).length), ' sensitive')
      ),
      onSaveFieldDef && React.createElement('button', {
        className: 'b-gho b-sm',
        style: { display: 'flex', alignItems: 'center', gap: 6, color: 'var(--teal)', borderColor: 'var(--teal)' },
        onClick: () => { setUriBrowserMode('import'); setUriBrowserOpen(true); }
      },
        React.createElement(I, { n: 'globe', s: 12, c: 'var(--teal)' }),
        'Import from URI Library'
      )
    ),
    // Toolbar
    React.createElement('div', { className: 'sw-dict-toolbar' },
      React.createElement('div', { className: 'sw-dict-search' },
        React.createElement('span', { className: 'sw-dict-search-icon' }, React.createElement(I, { n: 'search', s: 13, c: 'var(--tx-3)' })),
        React.createElement('input', { value: search, onChange: e => setSearch(e.target.value), placeholder: 'Search fields by name, key, or definition...' })
      ),
      React.createElement('div', { className: 'sw-dict-filters' },
        React.createElement('button', { className: `sw-dict-filter${filterCat === 'all' ? ' active' : ''}`, onClick: () => setFilterCat('all') }, 'All'),
        categories.map(c => React.createElement('button', {
          key: c,
          className: `sw-dict-filter${filterCat === c ? ' active' : ''}`,
          onClick: () => setFilterCat(c)
        }, (catLabels || {})[c] || c))
      )
    ),
    // Grid
    filtered.length === 0
      ? React.createElement('div', { className: 'sw-dict-empty' }, search ? `No fields matching "${search}"` : 'No fields in this category.')
      : React.createElement('div', { className: 'sw-dict-grid' },
          filtered.map(f => {
            const isExpanded = expandedUri === f.uri;
            const uses = fieldUsage[f.uri] || [];
            const catColor = (catColors || {})[f.category] || 'blue';
            return React.createElement('div', {
              key: f.uri,
              className: `sw-dict-card${isExpanded ? ' expanded' : ''}`,
              onClick: () => toggleExpand(f.uri)
            },
              React.createElement('div', { className: 'sw-dict-card-header' },
                React.createElement('div', null,
                  React.createElement('div', { className: 'sw-dict-card-name' }, f.label || f.key),
                  React.createElement('div', { className: 'sw-dict-card-uri' }, f.uri)
                ),
                React.createElement('div', { className: 'sw-dict-card-badges' },
                  f.sensitive && React.createElement('span', { className: 'tag tag-orange', style: { fontSize: 8 } }, 'SENSITIVE'),
                  React.createElement('span', { className: `tag tag-${catColor}`, style: { fontSize: 8 } }, (catLabels || {})[f.category] || f.category),
                  React.createElement('span', { className: `tag tag-${typeColor(f.data_type)}`, style: { fontSize: 8 } }, (f.data_type || 'text').toUpperCase())
                )
              ),
              React.createElement('div', { className: 'sw-dict-card-def' }, f.definition || 'No definition yet.'),
              // Usage tags
              uses.length > 0 && React.createElement('div', { className: 'sw-dict-card-usage' },
                React.createElement('span', { style: { fontSize: 10, color: 'var(--tx-3)', fontFamily: 'var(--mono)' } }, 'Used in:'),
                uses.map(u => React.createElement('span', { key: u.id, className: 'sw-dict-card-form-tag' }, u.name))
              ),
              // Expanded: scope + editor
              isExpanded && React.createElement('div', null,
                f.scope && React.createElement('div', { className: 'sw-dict-card-scope' },
                  React.createElement('strong', { style: { color: 'var(--tx-2)', fontSize: 10 } }, 'SCOPE: '), f.scope
                ),
                // Standard URI link display
                f.standard_uri && React.createElement('div', {
                  className: 'uri-browser-selected-badge',
                  style: { marginBottom: 8 }
                },
                  React.createElement(I, { n: 'globe', s: 10, c: 'var(--teal)' }),
                  'Linked: ', f.standard_uri,
                  f.standard_library && React.createElement('span', {
                    style: { opacity: .7, marginLeft: 4 }
                  }, '(', f.standard_library, ')')
                ),
                onSaveFieldDef && React.createElement('div', { className: 'sw-dict-card-editor', onClick: e => e.stopPropagation() },
                  React.createElement('label', null, 'Definition'),
                  React.createElement('textarea', {
                    value: editDraft.definition || '',
                    onChange: e => setEditDraft(d => ({ ...d, definition: e.target.value })),
                    placeholder: 'What this field means...'
                  }),
                  React.createElement('label', null, 'Scope'),
                  React.createElement('textarea', {
                    value: editDraft.scope || '',
                    onChange: e => setEditDraft(d => ({ ...d, scope: e.target.value })),
                    placeholder: 'What is included and excluded...'
                  }),
                  // Link to Standard URI button
                  React.createElement('button', {
                    className: 'b-gho b-xs',
                    style: { display: 'flex', alignItems: 'center', gap: 5, color: 'var(--teal)', borderColor: 'var(--teal)', alignSelf: 'flex-start', fontSize: 11 },
                    onClick: e => { e.stopPropagation(); setLinkTargetUri(f.uri); setUriBrowserMode('link'); setUriBrowserOpen(true); }
                  },
                    React.createElement(I, { n: 'globe', s: 10, c: 'var(--teal)' }),
                    f.standard_uri ? 'Change Linked URI' : 'Link to Standard URI'
                  ),
                  React.createElement('div', { style: { display: 'flex', gap: 6, justifyContent: 'flex-end' } },
                    React.createElement(SwBtn, { ghost: true, onClick: (e) => { e.stopPropagation(); setExpandedUri(null); } }, 'Cancel'),
                    React.createElement(SwBtn, { accent: SWC.given, onClick: (e) => { e.stopPropagation(); doSave(); } }, 'Save')
                  )
                )
              )
            );
          })
        ),
    // URI Library Browser modal
    uriBrowserOpen && React.createElement(UriLibraryBrowser, {
      open: true,
      onClose: () => { setUriBrowserOpen(false); setLinkTargetUri(null); },
      onSelect: uriBrowserMode === 'link' ? doLinkToUri : doImportFromUri,
      mode: uriBrowserMode === 'link' ? 'link' : 'select'
    })
  );
};

/* ── ColumnsTab — field × form matrix ── */
const ColumnsTab = ({ allForms, fieldDefs, onNavigateToForm }) => {
  const [filterCat, setFilterCat] = useState('all');
  const [sortBy, setSortBy] = useState('name'); // name | usage | category

  // Build the matrix data
  const matrixData = useMemo(() => {
    const fieldMap = {};
    // Collect all unique fields across all forms
    (allForms || []).forEach(f => {
      (f.fields || []).forEach(field => {
        const key = field.key;
        if (!fieldMap[key]) {
          fieldMap[key] = {
            key,
            label: field.question || field.key,
            category: field.category || field.section || 'general',
            uri: field.field_uri || `khora:form/${f.id}/${key}`,
            forms: {},
            usageCount: 0
          };
        }
        fieldMap[key].forms[f.id] = {
          present: true,
          bound: !!(field.eo && field.eo.chain && field.eo.chain.some(c => c.op === 'CON')),
          type: field.type
        };
        fieldMap[key].usageCount++;
      });
    });
    return Object.values(fieldMap);
  }, [allForms]);

  const categories = useMemo(() => [...new Set(matrixData.map(f => f.category).filter(Boolean))], [matrixData]);
  const forms = allForms || [];

  const filtered = useMemo(() => {
    let list = matrixData;
    if (filterCat !== 'all') list = list.filter(f => f.category === filterCat);
    if (sortBy === 'usage') list = [...list].sort((a, b) => b.usageCount - a.usageCount);
    else if (sortBy === 'category') list = [...list].sort((a, b) => (a.category || '').localeCompare(b.category || ''));
    else list = [...list].sort((a, b) => (a.label || '').localeCompare(b.label || ''));
    return list;
  }, [matrixData, filterCat, sortBy]);

  const totalFields = matrixData.length;
  const multiFormFields = matrixData.filter(f => f.usageCount >= 2).length;
  const singleFormFields = matrixData.filter(f => f.usageCount === 1).length;

  return React.createElement('div', null,
    // Stats
    React.createElement('div', { className: 'sw-cols-stats' },
      React.createElement('span', { className: 'sw-cols-stat' }, React.createElement('strong', null, totalFields), ' total fields'),
      React.createElement('span', { className: 'sw-cols-stat' }, React.createElement('strong', null, multiFormFields), ' shared across forms'),
      React.createElement('span', { className: 'sw-cols-stat' }, React.createElement('strong', null, singleFormFields), ' unique to one form')
    ),
    // Toolbar
    React.createElement('div', { className: 'sw-cols-toolbar' },
      React.createElement('div', { className: 'sw-dict-filters' },
        React.createElement('button', { className: `sw-dict-filter${filterCat === 'all' ? ' active' : ''}`, onClick: () => setFilterCat('all') }, 'All'),
        categories.map(c => React.createElement('button', {
          key: c,
          className: `sw-dict-filter${filterCat === c ? ' active' : ''}`,
          onClick: () => setFilterCat(c)
        }, c))
      ),
      React.createElement('div', { style: { display: 'flex', gap: 4, marginLeft: 'auto' } },
        ['name', 'usage', 'category'].map(s => React.createElement('button', {
          key: s,
          className: `sw-dict-filter${sortBy === s ? ' active' : ''}`,
          onClick: () => setSortBy(s)
        }, s === 'name' ? 'A-Z' : s === 'usage' ? 'Usage' : 'Category'))
      )
    ),
    // Table
    forms.length === 0 || filtered.length === 0
      ? React.createElement('div', { className: 'sw-dict-empty' }, 'No fields to show. Create forms with fields to see the column mapping.')
      : React.createElement('div', { className: 'sw-cols-table-wrap' },
          React.createElement('table', { className: 'sw-cols-table' },
            React.createElement('thead', null,
              React.createElement('tr', null,
                React.createElement('th', { style: { minWidth: 180 } }, 'Field'),
                React.createElement('th', { style: { width: 70 } }, 'Category'),
                React.createElement('th', { style: { width: 50 } }, 'Usage'),
                forms.map(f => React.createElement('th', { key: f.id, className: 'sw-cols-form-th', title: f.name }, f.name))
              )
            ),
            React.createElement('tbody', null,
              filtered.map(field => React.createElement('tr', { key: field.key },
                React.createElement('td', null,
                  React.createElement('span', { className: 'sw-cols-field-name' }, field.label),
                  React.createElement('div', { style: { fontSize: 9, fontFamily: 'var(--mono)', color: 'var(--tx-3)', marginTop: 1 } }, field.key)
                ),
                React.createElement('td', null,
                  React.createElement('span', {
                    className: 'sw-cols-field-cat',
                    style: { background: `var(--${OBS_CAT_COLORS[field.category] || 'blue'}-dim)`, color: `var(--${OBS_CAT_COLORS[field.category] || 'blue'})` }
                  }, field.category)
                ),
                React.createElement('td', null,
                  React.createElement('span', { style: { fontFamily: 'var(--mono)', fontSize: 11 } }, field.usageCount),
                  React.createElement('span', { className: 'sw-cols-usage-bar' },
                    React.createElement('span', { className: 'sw-cols-usage-fill', style: { width: `${Math.min(100, (field.usageCount / Math.max(forms.length, 1)) * 100)}%` } })
                  )
                ),
                forms.map(f => {
                  const cell = field.forms[f.id];
                  return React.createElement('td', {
                    key: f.id,
                    className: 'sw-cols-cell',
                    onClick: () => cell && onNavigateToForm && onNavigateToForm(f.id, field.key),
                    title: cell ? (cell.bound ? 'Present + bound to framework' : 'Present') : 'Not in this form'
                  },
                    cell
                      ? React.createElement('span', { className: cell.bound ? 'sw-cols-cell-bound' : 'sw-cols-cell-present' }, cell.bound ? '\u25CF' : '\u2713')
                      : React.createElement('span', { className: 'sw-cols-cell-absent' }, '\u2013')
                  );
                })
              ))
            )
          )
        )
  );
};

/* ── GovernanceTab — maturity pipeline, propagation, adoption, activity ── */
const GovernanceTab = ({ allForms, onNavigateToForm }) => {
  // Group forms by maturity for the pipeline
  const pipeline = useMemo(() => {
    const lanes = { draft: [], trial: [], normative: [], de_facto: [], deprecated: [] };
    (allForms || []).forEach(f => {
      const m = f.maturity || 'draft';
      if (lanes[m]) lanes[m].push(f);
    });
    return lanes;
  }, [allForms]);

  // Propagation data
  const propagationData = useMemo(() => {
    return (allForms || []).filter(f => f.source && f.source.level === 'network').map(f => ({
      id: f.id,
      name: f.name,
      propagation: f.source.propagation || 'optional',
      maturity: f.maturity || 'draft'
    }));
  }, [allForms]);

  // Version timeline — combine all forms' versions
  const timeline = useMemo(() => {
    const entries = [];
    (allForms || []).forEach(f => {
      entries.push({
        form_id: f.id,
        form_name: f.name,
        version: f.version || 1,
        maturity: f.maturity || 'draft',
        date: f.savedAt || Date.now(),
        type: 'version'
      });
    });
    return entries.sort((a, b) => b.date - a.date).slice(0, 20);
  }, [allForms]);

  const laneConfig = {
    draft: { label: 'Draft', color: 'var(--blue)', bg: 'var(--blue-dim)' },
    trial: { label: 'Trial', color: 'var(--orange)', bg: 'rgba(224,148,58,.1)' },
    normative: { label: 'Normative', color: 'var(--green)', bg: 'var(--green-dim)' },
    de_facto: { label: 'De facto', color: 'var(--purple)', bg: 'rgba(167,139,250,.1)' },
    deprecated: { label: 'Deprecated', color: 'var(--red)', bg: 'var(--red-dim)' }
  };

  const propConfig = {
    required: { label: 'Required', color: 'var(--red)' },
    standard: { label: 'Standard', color: 'var(--gold)' },
    recommended: { label: 'Recommended', color: 'var(--blue)' },
    optional: { label: 'Optional', color: 'var(--tx-3)' }
  };

  return React.createElement('div', null,
    // Top grid: pipeline + propagation
    React.createElement('div', { className: 'sw-gov-grid' },
      // Maturity Pipeline
      React.createElement('div', { className: 'sw-gov-card', style: { gridColumn: '1 / -1' } },
        React.createElement('div', { className: 'sw-gov-card-title' },
          React.createElement(I, { n: 'layers', s: 13 }), 'Maturity Pipeline'
        ),
        React.createElement('div', { className: 'sw-gov-pipeline' },
          ['draft', 'trial', 'normative', 'de_facto', 'deprecated'].map(stage => {
            const cfg = laneConfig[stage];
            const items = pipeline[stage] || [];
            return React.createElement('div', { key: stage, className: 'sw-gov-lane' },
              React.createElement('div', { className: 'sw-gov-lane-header', style: { color: cfg.color } },
                React.createElement('span', null, cfg.label),
                React.createElement('span', { style: { fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--tx-3)' } }, items.length)
              ),
              React.createElement('div', { className: 'sw-gov-lane-items' },
                items.length === 0
                  ? React.createElement('div', { style: { fontSize: 10, color: 'var(--tx-3)', fontStyle: 'italic', padding: 8 } }, 'None')
                  : items.map(f => React.createElement('div', {
                      key: f.id,
                      className: 'sw-gov-lane-item',
                      onClick: () => onNavigateToForm && onNavigateToForm(f.id)
                    },
                    React.createElement('span', { style: { width: 6, height: 6, borderRadius: '50%', background: cfg.color, flexShrink: 0 } }),
                    React.createElement('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, f.name),
                    React.createElement('span', { style: { fontSize: 9, fontFamily: 'var(--mono)', color: 'var(--tx-3)', marginLeft: 'auto' } }, `v${f.version || 1}`)
                  ))
              )
            );
          })
        )
      ),

      // Propagation Map
      React.createElement('div', { className: 'sw-gov-card' },
        React.createElement('div', { className: 'sw-gov-card-title' },
          React.createElement(I, { n: 'globe', s: 13 }), 'Network Propagation'
        ),
        propagationData.length === 0
          ? React.createElement('div', { className: 'sw-gov-empty' }, 'No network forms. Forms authored at the network level will show their propagation rules here.')
          : React.createElement('div', { className: 'sw-gov-propagation' },
              propagationData.map(f => {
                const pcfg = propConfig[f.propagation] || propConfig.optional;
                return React.createElement('div', { key: f.id, className: 'sw-gov-prop-row' },
                  React.createElement('span', { style: { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--tx-0)' } }, f.name),
                  React.createElement('span', { className: 'sw-gov-prop-arrow' }, '\u2192'),
                  React.createElement('span', {
                    className: 'tag',
                    style: { fontSize: 8, color: pcfg.color, background: `${pcfg.color}18`, border: `1px solid ${pcfg.color}30` }
                  }, pcfg.label)
                );
              })
            )
      ),

      // Version Timeline
      React.createElement('div', { className: 'sw-gov-card' },
        React.createElement('div', { className: 'sw-gov-card-title' },
          React.createElement(I, { n: 'clock', s: 13 }), 'Recent Versions'
        ),
        timeline.length === 0
          ? React.createElement('div', { className: 'sw-gov-empty' }, 'No version history yet.')
          : React.createElement('div', { className: 'sw-gov-timeline' },
              timeline.slice(0, 10).map((entry, i) => {
                const mcfg = laneConfig[entry.maturity] || laneConfig.draft;
                return React.createElement('div', { key: `${entry.form_id}-${i}`, className: 'sw-gov-tl-node' },
                  React.createElement('div', { className: `sw-gov-tl-dot ${i === 0 ? 'current' : 'past'}` }),
                  React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 6 } },
                    React.createElement('span', { style: { fontSize: 11, fontFamily: 'var(--mono)', fontWeight: 600, color: mcfg.color } }, `v${entry.version}`),
                    React.createElement('span', { style: { fontSize: 11, color: 'var(--tx-0)', fontWeight: 500 } }, entry.form_name)
                  ),
                  React.createElement('div', { style: { fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--tx-3)', marginTop: 2 } },
                    new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                  )
                );
              })
            )
      )
    ),

    // Activity Feed
    React.createElement('div', { className: 'sw-gov-card' },
      React.createElement('div', { className: 'sw-gov-card-title' },
        React.createElement(I, { n: 'activity', s: 13 }), 'Schema Activity'
      ),
      React.createElement('div', { className: 'sw-gov-activity' },
        (allForms || []).length === 0
          ? React.createElement('div', { className: 'sw-gov-empty' }, 'No schema activity yet. Create and save forms to see activity here.')
          : (allForms || []).slice(0, 8).map((f, i) => React.createElement('div', { key: f.id, className: 'sw-gov-activity-item' },
              React.createElement('span', { className: 'sw-gov-activity-time' }, f.savedAt ? new Date(f.savedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Recent'),
              React.createElement('span', { style: { width: 5, height: 5, borderRadius: '50%', background: i === 0 ? 'var(--teal)' : 'var(--tx-3)', flexShrink: 0, marginTop: 4 } }),
              React.createElement('span', null,
                React.createElement('span', { style: { color: 'var(--tx-0)', fontWeight: 500 } }, f.name),
                React.createElement('span', { style: { color: 'var(--tx-3)' } }, ` \u2014 v${f.version || 1} \u00B7 ${(MATURITY_LEVELS[f.maturity] || MATURITY_LEVELS.draft).label}`)
              )
            ))
      )
    )
  );
};

/* ── FormsTab — restructured form builder with split panel ── */
const FormsTab = ({
  allForms,
  savedForms,
  form, setForm,
  frameworks, bindings, crosswalks,
  setFrameworks, setBindings, setCrosswalks,
  fieldDefs, catLabels, catColors,
  onSaveFieldDef,
  onSave, onLoad, onNewForm, onVersionBump,
  showToast,
  isOrg, orgMeta, networkMembers
}) => {
  const [selectedFormId, setSelectedFormId] = useState(null);
  const [formSearch, setFormSearch] = useState('');
  const [expandedGroups, setExpandedGroups] = useState(new Set(['my', 'network']));
  const [showPreview, setShowPreview] = useState(false);
  const [expandedSections, setExpandedSections] = useState(new Set());
  const [showFwBar, setShowFwBar] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [fieldPickerOpen, setFieldPickerOpen] = useState(false);
  const [fieldPickerSection, setFieldPickerSection] = useState(null);

  // Categorize forms
  const myForms = useMemo(() => (savedForms || []).filter(f => !f.sourceType || f.sourceType === 'local'), [savedForms]);
  const orgForms = useMemo(() => (savedForms || []).filter(f => f.sourceType === 'org'), [savedForms]);
  const networkForms = useMemo(() => {
    const saved = (savedForms || []).filter(f => f.sourceType === 'network');
    // Also include DEFAULT_FORMS that aren't in savedForms
    const savedIds = new Set(saved.map(f => f.id));
    const defaults = (DEFAULT_FORMS || []).filter(f => !savedIds.has(f.id)).map(f => ({
      id: f.id,
      name: f.name,
      version: f.version,
      maturity: f.maturity,
      sourceType: 'network',
      source: f.source,
      form: f
    }));
    return [...saved, ...defaults];
  }, [savedForms]);

  const toggleGroup = g => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      next.has(g) ? next.delete(g) : next.add(g);
      return next;
    });
  };

  const doLoadForm = (formData) => {
    if (onLoad && formData) {
      onLoad(formData);
      setSelectedFormId(formData.id);
    }
  };

  const doLoadNetworkForm = (nf) => {
    // For network forms that haven't been saved locally, load from DEFAULT_FORMS
    if (nf.form) {
      // Build form structure compatible with FormBuilder
      const loaded = {
        name: nf.form.name || nf.name,
        key: nf.form.key || formNameToKey(nf.name),
        version: nf.form.version || nf.version || 1,
        maturity: nf.form.maturity || nf.maturity || 'draft',
        description: nf.form.description || '',
        source: nf.form.source || nf.source,
        sections: []
      };
      // Convert fields to sections/questions format
      if (nf.form.fields) {
        const sectionMap = {};
        nf.form.fields.forEach(field => {
          const secKey = field.section || 'general';
          if (!sectionMap[secKey]) {
            sectionMap[secKey] = {
              id: `sec_${secKey}`,
              title: (OBS_CAT_LABELS[secKey] || secKey).charAt(0).toUpperCase() + (OBS_CAT_LABELS[secKey] || secKey).slice(1),
              questions: []
            };
          }
          sectionMap[secKey].questions.push({
            id: field.id,
            key: field.key,
            prompt: field.question,
            type: field.type || 'single_select',
            options: (field.options || []).map((opt, oi) => ({
              id: `${field.id}_opt_${oi}`,
              value: opt.v,
              label: opt.l
            })),
            helpText: field.helpText || '',
            field_uri: field.field_uri || `khora:form/${nf.id}/${field.key}`,
            maturity: field.maturity,
            sensitive: field.sensitive,
            eo: field.eo
          });
        });
        loaded.sections = Object.values(sectionMap);
      }
      if (setForm) setForm(loaded);
      setSelectedFormId(nf.id);
    }
  };

  // Filter forms by search
  const filterForms = (list) => {
    if (!formSearch || formSearch.length < 2) return list;
    const q = formSearch.toLowerCase();
    return list.filter(f => (f.name || '').toLowerCase().includes(q));
  };

  // Toggle section collapse
  const toggleSection = (secId) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      next.has(secId) ? next.delete(secId) : next.add(secId);
      return next;
    });
  };

  // Form mutations (delegated to parent FormBuilder logic)
  const updateFormName = (name) => {
    if (setForm) setForm(prev => ({ ...prev, name }));
  };

  const updateFormDescription = (description) => {
    if (setForm) setForm(prev => ({ ...prev, description }));
  };

  const updateFormMaturity = (maturity) => {
    if (setForm) setForm(prev => ({ ...prev, maturity }));
  };

  const addSection = () => {
    if (!setForm) return;
    setForm(prev => ({
      ...prev,
      sections: [...(prev.sections || []), {
        id: `sec_${Date.now()}`,
        title: 'New Section',
        questions: []
      }]
    }));
  };

  const addQuestion = (secId) => {
    if (!setForm) return;
    setForm(prev => ({
      ...prev,
      sections: (prev.sections || []).map(s => s.id === secId ? {
        ...s,
        questions: [...s.questions, {
          id: `q_${Date.now()}`,
          prompt: 'New question',
          type: 'single_select',
          options: [],
          key: `field_${Date.now()}`
        }]
      } : s)
    }));
  };

  const addOption = (secId, qId) => {
    if (!setForm) return;
    setForm(prev => ({
      ...prev,
      sections: (prev.sections || []).map(s => s.id === secId ? {
        ...s,
        questions: s.questions.map(q => q.id === qId ? {
          ...q,
          options: [...(q.options || []), {
            id: `opt_${Date.now()}`,
            value: `option_${(q.options || []).length + 1}`,
            label: 'New option'
          }]
        } : q)
      } : s)
    }));
  };

  const updateQuestion = (secId, qId, updates) => {
    if (!setForm) return;
    setForm(prev => ({
      ...prev,
      sections: (prev.sections || []).map(s => s.id === secId ? {
        ...s,
        questions: s.questions.map(q => q.id === qId ? { ...q, ...updates } : q)
      } : s)
    }));
  };

  const updateOption = (secId, qId, optId, updates) => {
    if (!setForm) return;
    setForm(prev => ({
      ...prev,
      sections: (prev.sections || []).map(s => s.id === secId ? {
        ...s,
        questions: s.questions.map(q => q.id === qId ? {
          ...q,
          options: (q.options || []).map(o => o.id === optId ? { ...o, ...updates } : o)
        } : q)
      } : s)
    }));
  };

  const removeQuestion = (secId, qId) => {
    if (!setForm) return;
    setForm(prev => ({
      ...prev,
      sections: (prev.sections || []).map(s => s.id === secId ? {
        ...s,
        questions: s.questions.filter(q => q.id !== qId)
      } : s)
    }));
  };

  const removeOption = (secId, qId, optId) => {
    if (!setForm) return;
    setForm(prev => ({
      ...prev,
      sections: (prev.sections || []).map(s => s.id === secId ? {
        ...s,
        questions: s.questions.map(q => q.id === qId ? {
          ...q,
          options: (q.options || []).filter(o => o.id !== optId)
        } : q)
      } : s)
    }));
  };

  const removeSection = (secId) => {
    if (!setForm) return;
    setForm(prev => ({
      ...prev,
      sections: (prev.sections || []).filter(s => s.id !== secId)
    }));
  };

  const updateSectionTitle = (secId, title) => {
    if (!setForm) return;
    setForm(prev => ({
      ...prev,
      sections: (prev.sections || []).map(s => s.id === secId ? { ...s, title } : s)
    }));
  };

  // Duplicate a question within a section
  const duplicateQuestion = (secId, qId) => {
    if (!setForm) return;
    setForm(prev => ({
      ...prev,
      sections: (prev.sections || []).map(s => {
        if (s.id !== secId) return s;
        const srcIdx = s.questions.findIndex(q => q.id === qId);
        if (srcIdx < 0) return s;
        const src = s.questions[srcIdx];
        const clone = {
          ...src,
          id: `q_${Date.now()}`,
          key: `${src.key || 'field'}_copy_${Date.now()}`,
          prompt: src.prompt + ' (copy)',
          options: (src.options || []).map((o, i) => ({ ...o, id: `opt_${Date.now()}_${i}` }))
        };
        const qs = [...s.questions];
        qs.splice(srcIdx + 1, 0, clone);
        return { ...s, questions: qs };
      })
    }));
  };

  // Toggle required flag on a question
  const toggleRequired = (secId, qId) => {
    if (!setForm) return;
    setForm(prev => ({
      ...prev,
      sections: (prev.sections || []).map(s => s.id === secId ? {
        ...s,
        questions: s.questions.map(q => q.id === qId ? { ...q, required: !q.required } : q)
      } : s)
    }));
  };

  // Move section up or down
  const moveSection = (secId, dir) => {
    if (!setForm) return;
    setForm(prev => {
      const secs = [...(prev.sections || [])];
      const idx = secs.findIndex(s => s.id === secId);
      if (idx < 0) return prev;
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= secs.length) return prev;
      [secs[idx], secs[newIdx]] = [secs[newIdx], secs[idx]];
      return { ...prev, sections: secs };
    });
  };

  // Move question up or down within a section
  const moveQuestion = (secId, qId, dir) => {
    if (!setForm) return;
    setForm(prev => ({
      ...prev,
      sections: (prev.sections || []).map(s => {
        if (s.id !== secId) return s;
        const qs = [...s.questions];
        const idx = qs.findIndex(q => q.id === qId);
        if (idx < 0) return s;
        const newIdx = idx + dir;
        if (newIdx < 0 || newIdx >= qs.length) return s;
        [qs[idx], qs[newIdx]] = [qs[newIdx], qs[idx]];
        return { ...s, questions: qs };
      })
    }));
  };

  // Expand all / Collapse all sections
  const toggleAllSections = () => {
    const allIds = sections.map(s => s.id);
    const allCollapsed = allIds.every(id => expandedSections.has(id));
    if (allCollapsed) {
      setExpandedSections(new Set());
    } else {
      setExpandedSections(new Set(allIds));
    }
  };

  // Insert from dictionary
  const doInsertFromDictionary = (fieldDef, secId) => {
    const typeMap = { text: 'text', text_long: 'text', number: 'number', date: 'date', boolean: 'boolean', email: 'text', phone: 'text', address: 'text', document: 'text', select: 'single_select' };
    const qType = typeMap[fieldDef.data_type] || 'single_select';
    const options = qType === 'single_select' && fieldDef.data_type === 'boolean'
      ? [{ id: `opt_y_${Date.now()}`, value: 'yes', label: 'Yes' }, { id: `opt_n_${Date.now()}`, value: 'no', label: 'No' }]
      : [];
    if (!setForm) return;
    setForm(prev => ({
      ...prev,
      sections: (prev.sections || []).map(s => s.id === secId ? {
        ...s,
        questions: [...s.questions, {
          id: `q_${Date.now()}`,
          key: fieldDef.key,
          prompt: fieldDef.label,
          type: qType,
          options,
          helpText: fieldDef.definition || '',
          field_uri: fieldDef.uri
        }]
      } : s)
    }));
    setFieldPickerOpen(false);
    setFieldPickerSection(null);
  };

  // Render form list group
  const renderFormGroup = (label, items, groupKey, icon) => {
    const isOpen = expandedGroups.has(groupKey);
    const filteredItems = filterForms(items);
    return React.createElement('div', { key: groupKey },
      React.createElement('div', {
        className: 'sw-forms-group-header',
        onClick: () => toggleGroup(groupKey)
      },
        React.createElement('span', { className: 'sw-forms-group-label' },
          React.createElement(I, { n: isOpen ? 'chevronDown' : 'chevronRight', s: 10 }),
          React.createElement(I, { n: icon, s: 11 }),
          label
        ),
        React.createElement('span', { className: 'sw-forms-group-count' }, items.length)
      ),
      isOpen && filteredItems.map(f => React.createElement('div', {
        key: f.id,
        className: `sw-forms-item${selectedFormId === f.id ? ' active' : ''}`,
        onClick: () => f.form ? doLoadNetworkForm(f) : doLoadForm(f)
      },
        React.createElement('div', { className: `sw-forms-item-dot${selectedFormId === f.id ? ' active' : ''}` }),
        React.createElement('div', { style: { flex: 1, minWidth: 0 } },
          React.createElement('div', { className: 'sw-forms-item-name' }, f.name),
          React.createElement('div', { className: 'sw-forms-item-meta' },
            React.createElement('span', null, `v${f.version || 1}`),
            React.createElement('span', null, '\u00B7'),
            React.createElement('span', {
              className: `sw-forms-item-status ${f.maturity || 'draft'}`,
              title: (MATURITY_LEVELS[f.maturity] || MATURITY_LEVELS.draft).desc
            }, (MATURITY_LEVELS[f.maturity] || MATURITY_LEVELS.draft).label)
          )
        )
      )),
      isOpen && filteredItems.length === 0 && React.createElement('div', {
        style: { padding: '12px 16px', fontSize: 11, color: 'var(--tx-3)', fontStyle: 'italic' }
      }, formSearch ? 'No matches' : 'No forms yet')
    );
  };

  // Maturity color
  const matColor = (m) => {
    const mc = { draft: 'blue', trial: 'orange', normative: 'green', de_facto: 'purple', deprecated: 'red' };
    return mc[m] || 'blue';
  };

  const sections = (form && form.sections) || [];

  return React.createElement('div', { className: 'sw-forms-split' },
    // LEFT: Form list
    React.createElement('div', { className: 'sw-forms-list' },
      React.createElement('div', { className: 'sw-forms-list-header' },
        React.createElement('span', { style: { fontSize: 11, fontWeight: 600, fontFamily: 'var(--mono)', color: 'var(--tx-2)', letterSpacing: '.06em' } }, 'FORMS'),
        React.createElement('button', {
          className: 'b-gho b-xs',
          onClick: onNewForm,
          style: { fontSize: 12, padding: '3px 10px' }
        }, '+ New')
      ),
      React.createElement('div', { className: 'sw-forms-list-search' },
        React.createElement('span', { className: 'sw-forms-list-search-icon' }, React.createElement(I, { n: 'search', s: 12, c: 'var(--tx-3)' })),
        React.createElement('input', { value: formSearch, onChange: e => setFormSearch(e.target.value), placeholder: 'Search forms...' })
      ),
      React.createElement('div', { className: 'sw-forms-list-scroll' },
        renderFormGroup('MY FORMS', myForms, 'my', 'folder'),
        renderFormGroup('ORG FORMS', orgForms, 'org', 'shieldCheck'),
        renderFormGroup('NETWORK', networkForms, 'network', 'globe')
      )
    ),

    // RIGHT: Form editor
    React.createElement('div', { className: 'sw-forms-editor', style: { position: 'relative' } },
      !form
        ? React.createElement('div', { style: { padding: 40, textAlign: 'center' } },
            React.createElement('div', { style: { fontSize: 40, opacity: .3, marginBottom: 12 } }, '\u25C7'),
            React.createElement('div', { style: { fontSize: 14, color: 'var(--tx-2)', marginBottom: 8 } }, 'Select a form from the list or create a new one'),
            React.createElement(SwBtn, { accent: SWC.given, onClick: onNewForm }, '+ New form')
          )
        : React.createElement('div', null,
            // Form header
            React.createElement('div', { className: 'sw-forms-editor-header' },
              React.createElement('div', { style: { flex: 1 } },
                React.createElement('input', {
                  className: 'sw-forms-editor-name',
                  value: form.name || '',
                  onChange: e => updateFormName(e.target.value),
                  placeholder: 'Form name...'
                }),
                React.createElement('div', { className: 'sw-forms-editor-badges' },
                  React.createElement('span', {
                    className: `tag tag-${matColor(form.maturity)}`,
                    style: { fontSize: 9, cursor: 'pointer' },
                    onClick: () => {
                      const mats = Object.keys(MATURITY_LEVELS);
                      const idx = mats.indexOf(form.maturity || 'draft');
                      updateFormMaturity(mats[(idx + 1) % mats.length]);
                    },
                    title: 'Click to cycle maturity'
                  }, (MATURITY_LEVELS[form.maturity] || MATURITY_LEVELS.draft).label),
                  React.createElement('span', {
                    className: 'tag tag-blue',
                    style: { fontSize: 9 }
                  }, `v${form.version || 1}`),
                  form.key && React.createElement('span', {
                    style: { fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--tx-3)' }
                  }, form.key),
                  form.source && form.source.propagation && React.createElement('span', {
                    className: `tag tag-${form.source.propagation === 'required' ? 'red' : form.source.propagation === 'standard' ? 'gold' : 'blue'}`,
                    style: { fontSize: 8 }
                  }, (PROPAGATION_LEVELS[form.source.propagation] || {}).label || form.source.propagation)
                )
              ),
              React.createElement('div', { className: 'sw-forms-editor-actions' },
                React.createElement(SwBtn, { ghost: true, onClick: () => setShowPreview(!showPreview) },
                  React.createElement(I, { n: showPreview ? 'x' : 'eye', s: 13 }),
                  showPreview ? 'Edit' : 'Preview'
                ),
                onSave && React.createElement(SwBtn, { accent: SWC.given, onClick: onSave },
                  React.createElement(I, { n: 'save', s: 13 }),
                  'Save'
                )
              )
            ),

            // Description
            React.createElement('textarea', {
              className: 'sw-forms-editor-desc',
              value: form.description || '',
              onChange: e => updateFormDescription(e.target.value),
              placeholder: 'Form description...',
              rows: 2
            }),

            // Stats summary bar
            !showPreview && sections.length > 0 && (() => {
              const totalQ = sections.reduce((sum, s) => sum + (s.questions || []).length, 0);
              const linkedQ = sections.reduce((sum, s) => sum + (s.questions || []).filter(q => q.field_uri).length, 0);
              const reqQ = sections.reduce((sum, s) => sum + (s.questions || []).filter(q => q.required).length, 0);
              const allCollapsed = sections.every(s => expandedSections.has(s.id));
              return React.createElement('div', { className: 'sw-f-stats' },
                React.createElement('div', { className: 'sw-f-stat' },
                  React.createElement(I, { n: 'layers', s: 12, c: 'var(--teal)' }),
                  React.createElement('strong', null, sections.length),
                  sections.length === 1 ? 'section' : 'sections'
                ),
                React.createElement('div', { className: 'sw-f-stats-divider' }),
                React.createElement('div', { className: 'sw-f-stat' },
                  React.createElement(I, { n: 'messageSquare', s: 12, c: 'var(--blue)' }),
                  React.createElement('strong', null, totalQ),
                  totalQ === 1 ? 'question' : 'questions'
                ),
                React.createElement('div', { className: 'sw-f-stats-divider' }),
                React.createElement('div', { className: 'sw-f-stat' },
                  React.createElement(I, { n: 'link', s: 12, c: 'var(--purple)' }),
                  React.createElement('strong', null, linkedQ),
                  'linked'
                ),
                reqQ > 0 && React.createElement('div', { className: 'sw-f-stats-divider' }),
                reqQ > 0 && React.createElement('div', { className: 'sw-f-stat' },
                  React.createElement(I, { n: 'shieldCheck', s: 12, c: 'var(--red)' }),
                  React.createElement('strong', null, reqQ),
                  'required'
                ),
                React.createElement('div', { style: { marginLeft: 'auto' } }),
                React.createElement('button', {
                  className: 'sw-f-expand-all',
                  onClick: toggleAllSections
                },
                  React.createElement(I, { n: allCollapsed ? 'chevronDown' : 'chevronRight', s: 10 }),
                  allCollapsed ? 'Expand all' : 'Collapse all'
                )
              );
            })(),

            // Preview overlay
            showPreview && React.createElement('div', { className: 'sw-f-preview-overlay' },
              React.createElement('div', { className: 'sw-f-preview-close' },
                React.createElement(SwBtn, { ghost: true, onClick: () => setShowPreview(false) }, '\u2715 Close preview')
              ),
              React.createElement('div', { style: { maxWidth: 640, margin: '0 auto' } },
                React.createElement('div', {
                  style: { marginBottom: 16, padding: 12, borderRadius: 8, border: '1px solid var(--border-0)', background: 'var(--bg-2)', fontSize: 12, color: 'var(--tx-2)' }
                }, React.createElement('strong', { style: { color: 'var(--tx-0)' } }, 'Preview:'), ' This is how the form appears to a person filling it out.'),
                sections.map(sec => React.createElement('div', { key: sec.id, style: { marginBottom: 20 } },
                  React.createElement('div', { style: { fontSize: 15, fontWeight: 600, color: 'var(--tx-0)', marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid var(--border-0)' } }, sec.title),
                  sec.questions.map(q => React.createElement('div', { key: q.id, className: 'sw-f-preview-q' },
                    React.createElement('div', { className: 'sw-f-preview-prompt' },
                      q.prompt,
                      q.required && React.createElement('span', { style: { color: 'var(--red)', marginLeft: 4, fontSize: 14 } }, '*')
                    ),
                    (q.type === 'single_select' || q.type === 'multi_select') && (q.options || []).map(opt => React.createElement('div', {
                      key: opt.id, className: 'sw-f-preview-opt'
                    },
                      React.createElement('div', { className: q.type === 'single_select' ? 'sw-f-opt-radio' : 'sw-f-opt-check' }),
                      React.createElement('span', { style: { fontSize: 13 } }, opt.label)
                    )),
                    q.type === 'text' && React.createElement('input', {
                      placeholder: 'Type your answer...', readOnly: true,
                      style: { width: '100%', padding: '10px 14px', borderRadius: 6, border: '1px solid var(--border-0)', background: 'var(--bg-2)', color: 'var(--tx-0)', fontSize: 13, fontFamily: 'inherit' }
                    }),
                    (q.type === 'number' || q.type === 'date' || q.type === 'boolean' || q.type === 'duration') && React.createElement('input', {
                      placeholder: q.type === 'number' ? '0' : q.type === 'date' ? 'yyyy-mm-dd' : q.type === 'boolean' ? 'Yes / No' : 'e.g. 3 months',
                      readOnly: true,
                      style: { width: q.type === 'number' ? 120 : 200, padding: '10px 14px', borderRadius: 6, border: '1px solid var(--border-0)', background: 'var(--bg-2)', color: 'var(--tx-0)', fontSize: 13, fontFamily: 'inherit' }
                    })
                  ))
                ))
              )
            ),

            // Sections + Questions (compose view)
            !showPreview && sections.map((sec, secIdx) => {
              const isSecOpen = !expandedSections.has(sec.id); // open by default
              return React.createElement('div', { key: sec.id, className: 'sw-f-section' },
                React.createElement('div', {
                  className: 'sw-f-section-header',
                  onClick: () => toggleSection(sec.id)
                },
                  React.createElement('span', { className: 'sw-f-section-title' },
                    React.createElement(I, { n: isSecOpen ? 'chevronDown' : 'chevronRight', s: 10 }),
                    React.createElement('input', {
                      value: sec.title,
                      onChange: e => { e.stopPropagation(); updateSectionTitle(sec.id, e.target.value); },
                      onClick: e => e.stopPropagation(),
                      style: { background: 'transparent', border: 'none', color: 'var(--tx-2)', fontSize: 11, fontWeight: 600, fontFamily: 'var(--mono)', letterSpacing: '.04em', textTransform: 'uppercase', outline: 'none', width: '100%' }
                    })
                  ),
                  React.createElement('div', { style: { display: 'flex', gap: 4, alignItems: 'center' } },
                    React.createElement('span', { className: 'sw-f-section-count' }, `${sec.questions.length}q`),
                    React.createElement('div', { className: 'sw-f-sec-reorder' },
                      React.createElement('button', {
                        className: 'sw-f-sec-reorder-btn',
                        disabled: secIdx === 0,
                        onClick: e => { e.stopPropagation(); moveSection(sec.id, -1); },
                        title: 'Move section up'
                      }, '\u25B2'),
                      React.createElement('button', {
                        className: 'sw-f-sec-reorder-btn',
                        disabled: secIdx === sections.length - 1,
                        onClick: e => { e.stopPropagation(); moveSection(sec.id, 1); },
                        title: 'Move section down'
                      }, '\u25BC')
                    ),
                    React.createElement('button', {
                      className: 'b-gho b-xs',
                      onClick: e => { e.stopPropagation(); removeSection(sec.id); },
                      style: { fontSize: 11, padding: '1px 6px', color: 'var(--tx-3)' }
                    }, '\u2715')
                  )
                ),
                isSecOpen && React.createElement('div', null,
                  sec.questions.map((q, qi) => React.createElement('div', { key: q.id, className: 'sw-f-q', style: { display: 'flex', gap: 0 } },
                    // Reorder buttons (left gutter)
                    React.createElement('div', { className: 'sw-f-reorder', style: { paddingTop: 14 } },
                      React.createElement('button', {
                        className: 'sw-f-reorder-btn',
                        disabled: qi === 0,
                        onClick: () => moveQuestion(sec.id, q.id, -1),
                        title: 'Move up'
                      }, '\u25B2'),
                      React.createElement('button', {
                        className: 'sw-f-reorder-btn',
                        disabled: qi === sec.questions.length - 1,
                        onClick: () => moveQuestion(sec.id, q.id, 1),
                        title: 'Move down'
                      }, '\u25BC')
                    ),
                    // Question content
                    React.createElement('div', { style: { flex: 1, minWidth: 0 } },
                    // Meta line
                    React.createElement('div', { className: 'sw-f-q-meta' },
                      React.createElement('span', null, `Q${qi + 1}`),
                      React.createElement('span', {
                        style: { padding: '1px 6px', borderRadius: 3, background: 'var(--bg-3)', fontFamily: 'var(--mono)', fontSize: 10 }
                      }, q.type),
                      React.createElement('span', {
                        className: `sw-f-q-required ${q.required ? 'on' : 'off'}`,
                        onClick: () => toggleRequired(sec.id, q.id),
                        title: q.required ? 'Click to make optional' : 'Click to make required'
                      }, q.required ? 'Required' : 'Optional'),
                      q.field_uri && React.createElement('span', {
                        className: 'sw-f-q-field-link',
                        title: q.field_uri
                      }, React.createElement(I, { n: 'link', s: 9 }), q.field_uri.split('/').pop()),
                      q.maturity && React.createElement('span', {
                        className: `tag tag-${matColor(q.maturity)}`,
                        style: { fontSize: 7 }
                      }, q.maturity)
                    ),
                    // Prompt (editable)
                    React.createElement('div', { className: 'sw-f-q-prompt' },
                      editingQuestion === q.id
                        ? React.createElement('input', {
                            value: q.prompt,
                            onChange: e => updateQuestion(sec.id, q.id, { prompt: e.target.value }),
                            onBlur: () => setEditingQuestion(null),
                            onKeyDown: e => e.key === 'Enter' && setEditingQuestion(null),
                            autoFocus: true,
                            style: { flex: 1, fontSize: 14, fontWeight: 500, background: 'transparent', border: 'none', borderBottom: '1px solid var(--teal)', color: 'var(--tx-0)', outline: 'none', fontFamily: 'inherit' }
                          })
                        : React.createElement('span', {
                            onClick: () => setEditingQuestion(q.id),
                            style: { cursor: 'text', flex: 1 }
                          }, q.prompt)
                    ),
                    // Actions (hover)
                    React.createElement('div', { className: 'sw-f-q-actions' },
                      React.createElement('button', {
                        className: 'b-gho b-xs',
                        onClick: () => setEditingQuestion(q.id),
                        style: { fontSize: 10, padding: '2px 6px' },
                        title: 'Edit question'
                      }, React.createElement(I, { n: 'edit', s: 10 })),
                      React.createElement('button', {
                        className: 'b-gho b-xs',
                        onClick: () => duplicateQuestion(sec.id, q.id),
                        style: { fontSize: 10, padding: '2px 6px' },
                        title: 'Duplicate question'
                      }, React.createElement(I, { n: 'copy', s: 10 })),
                      React.createElement('button', {
                        className: 'b-gho b-xs',
                        onClick: () => removeQuestion(sec.id, q.id),
                        style: { fontSize: 10, padding: '2px 6px', color: 'var(--red)' },
                        title: 'Delete question'
                      }, React.createElement(I, { n: 'trash', s: 10 }))
                    ),
                    // Type selector
                    React.createElement('select', {
                      value: q.type,
                      onChange: e => updateQuestion(sec.id, q.id, { type: e.target.value }),
                      style: { fontSize: 10, padding: '3px 8px', borderRadius: 4, border: '1px solid var(--border-0)', background: 'var(--bg-2)', color: 'var(--tx-2)', outline: 'none', marginBottom: 6, fontFamily: 'var(--mono)' }
                    },
                      ['single_select', 'multi_select', 'text', 'number', 'date', 'boolean', 'duration'].map(t =>
                        React.createElement('option', { key: t, value: t }, t)
                      )
                    ),
                    // Answer options (with inline binding dots)
                    (q.type === 'single_select' || q.type === 'multi_select') && React.createElement('div', { style: { marginTop: 4 } },
                      (q.options || []).map(opt => React.createElement('div', { key: opt.id, className: 'sw-f-opt' },
                        React.createElement('div', { className: q.type === 'single_select' ? 'sw-f-opt-radio' : 'sw-f-opt-check' }),
                        React.createElement('input', {
                          className: 'sw-f-opt-label',
                          value: opt.label,
                          onChange: e => updateOption(sec.id, q.id, opt.id, { label: e.target.value }),
                          style: { background: 'transparent', border: 'none', color: 'var(--tx-0)', fontSize: 13, outline: 'none', fontFamily: 'inherit', flex: 1, minWidth: 0 }
                        }),
                        // Inline binding dots (show framework connection status)
                        React.createElement('div', { className: 'sw-f-opt-bindings' },
                          (frameworks || []).map(fw => {
                            const isBound = (bindings || []).some(b => b.optionId === opt.id && b.frameworkId === fw.id);
                            return React.createElement('div', {
                              key: fw.id,
                              className: `sw-f-opt-dot ${isBound ? 'bound' : 'unbound'}`,
                              style: isBound ? { background: fw.color || 'var(--green)' } : {},
                              title: `${fw.name}: ${isBound ? 'Bound' : 'Unbound'}`
                            });
                          })
                        ),
                        React.createElement('button', {
                          className: 'sw-f-opt-rm',
                          onClick: () => removeOption(sec.id, q.id, opt.id)
                        }, '\u2715')
                      )),
                      React.createElement('button', {
                        className: 'sw-f-add',
                        onClick: () => addOption(sec.id, q.id)
                      }, React.createElement(I, { n: 'plus', s: 11 }), 'Add option')
                    ),
                    // Help text
                    q.helpText && React.createElement('div', {
                      style: { fontSize: 11, color: 'var(--tx-3)', marginTop: 4, fontStyle: 'italic' }
                    }, q.helpText)
                  ) /* close question content wrapper div */
                  )),
                  // Add question / insert from dictionary
                  React.createElement('div', { style: { display: 'flex', gap: 4 } },
                    React.createElement('button', {
                      className: 'sw-f-add',
                      onClick: () => addQuestion(sec.id)
                    }, React.createElement(I, { n: 'plus', s: 11 }), 'Add question'),
                    fieldDefs && Object.keys(fieldDefs).length > 0 && React.createElement('button', {
                      className: 'sw-f-add',
                      onClick: () => { setFieldPickerSection(sec.id); setFieldPickerOpen(true); },
                      style: { color: 'var(--teal)' }
                    }, React.createElement(I, { n: 'book', s: 11 }), 'From dictionary')
                  ),
                  fieldPickerOpen && fieldPickerSection === sec.id && React.createElement(FieldPicker, {
                    open: true,
                    onClose: () => { setFieldPickerOpen(false); setFieldPickerSection(null); },
                    onSelect: def => doInsertFromDictionary(def, sec.id),
                    fieldDefs: fieldDefs,
                    catLabels: catLabels,
                    catColors: catColors
                  })
                )
              );
            }),

            // Add section button
            !showPreview && React.createElement('button', {
              className: 'sw-f-add sw-f-add-section',
              onClick: addSection
            }, React.createElement(I, { n: 'plus', s: 13 }), 'Add section'),

            // Framework bar (collapsed by default)
            !showPreview && (frameworks || []).length > 0 && React.createElement('div', { className: 'sw-f-fw-bar' },
              React.createElement('div', {
                className: 'sw-f-fw-bar-header',
                onClick: () => setShowFwBar(!showFwBar)
              },
                React.createElement('span', { className: 'sw-f-fw-bar-label' },
                  React.createElement(I, { n: showFwBar ? 'chevronDown' : 'chevronRight', s: 10 }),
                  `Frameworks (${(frameworks || []).length})`
                )
              ),
              showFwBar && React.createElement('div', { className: 'sw-f-fw-list' },
                (frameworks || []).map(fw => React.createElement('div', { key: fw.id, className: 'sw-f-fw-card' },
                  React.createElement('div', { className: 'sw-f-fw-card-header' },
                    React.createElement('span', { style: { width: 8, height: 8, borderRadius: '50%', background: fw.color || 'var(--teal)', flexShrink: 0 } }),
                    React.createElement('span', { className: 'sw-f-fw-card-name', style: { color: 'var(--tx-0)' } }, fw.name)
                  ),
                  fw.codes && React.createElement('div', { className: 'sw-f-fw-card-codes' },
                    fw.codes.slice(0, 5).map((code, ci) => React.createElement('div', {
                      key: ci, className: 'sw-f-fw-code', style: { color: 'var(--tx-2)' }
                    },
                      React.createElement('span', { style: { fontFamily: 'var(--mono)', fontSize: 10, color: fw.color || 'var(--teal)' } }, code.code || code.id),
                      React.createElement('span', null, code.label || code.name)
                    ))
                  )
                ))
              )
            )
          )
    )
  );
};

/* ── UriLibrariesTab — inline browsable view of all URI libraries ── */
const UriLibrariesTab = ({ onImport, fieldDefs }) => {
  const [search, setSearch] = useState('');
  const [selectedLib, setSelectedLib] = useState('all');
  const [selectedCat, setSelectedCat] = useState('all');
  const [expandedUri, setExpandedUri] = useState(null);

  const results = searchUriLibraries(search, {
    libraryId: selectedLib !== 'all' ? selectedLib : undefined,
    category: selectedCat !== 'all' ? selectedCat : undefined,
    limit: 100
  });

  const pool = selectedLib !== 'all'
    ? URI_LIBRARY_INDEX.filter(e => e.library_id === selectedLib)
    : URI_LIBRARY_INDEX;
  const categories = [...new Set(pool.map(e => e.category).filter(Boolean))].sort();

  const activeLib = selectedLib !== 'all' ? URI_LIBRARIES.find(l => l.id === selectedLib) : null;
  const existingUris = new Set(Object.keys(fieldDefs || {}));

  const typeColor = dt => {
    const m = { text: 'blue', select: 'teal', date: 'gold', number: 'orange', boolean: 'green',
      email: 'blue', phone: 'blue', address: 'gold', text_long: 'purple', document: 'orange',
      single_select: 'teal', multi_select: 'teal', duration: 'gold' };
    return m[dt] || 'blue';
  };

  return React.createElement('div', null,
    // Stats
    React.createElement('div', { className: 'sw-dict-stats' },
      React.createElement('span', { className: 'sw-dict-stat' },
        React.createElement('strong', null, URI_LIBRARIES.length), ' libraries'
      ),
      React.createElement('span', { className: 'sw-dict-stat' },
        React.createElement('strong', null, URI_LIBRARY_INDEX.length), ' total definitions'
      ),
      React.createElement('span', { className: 'sw-dict-stat' },
        React.createElement('strong', null, URI_LIBRARY_INDEX.filter(e => existingUris.has(e.uri)).length), ' already imported'
      )
    ),
    // Library cards row
    React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8, marginBottom: 16 } },
      URI_LIBRARIES.map(lib => React.createElement('div', {
        key: lib.id,
        className: `card-h`,
        style: {
          padding: '12px 16px',
          cursor: 'pointer',
          borderColor: selectedLib === lib.id ? `var(--${lib.color})` : undefined,
          background: selectedLib === lib.id ? `var(--${lib.color}-dim)` : undefined
        },
        onClick: () => { setSelectedLib(selectedLib === lib.id ? 'all' : lib.id); setSelectedCat('all'); }
      },
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 } },
          React.createElement('span', { style: { width: 8, height: 8, borderRadius: '50%', background: `var(--${lib.color})` } }),
          React.createElement('span', { style: { fontSize: 13, fontWeight: 700 } }, lib.name),
          React.createElement('span', { style: { fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--tx-3)', marginLeft: 'auto' } }, lib.entries.length)
        ),
        React.createElement('div', { style: { fontSize: 11, color: 'var(--tx-2)', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } },
          lib.description
        )
      ))
    ),
    // Search + filters
    React.createElement('div', { className: 'sw-dict-toolbar' },
      React.createElement('div', { className: 'sw-dict-search' },
        React.createElement('span', { className: 'sw-dict-search-icon' }, React.createElement(I, { n: 'search', s: 13, c: 'var(--tx-3)' })),
        React.createElement('input', {
          value: search,
          onChange: e => setSearch(e.target.value),
          placeholder: 'Search URI definitions by name, keyword, or URI\u2026'
        })
      ),
      categories.length > 1 && React.createElement('div', { className: 'sw-dict-filters' },
        React.createElement('button', { className: `sw-dict-filter${selectedCat === 'all' ? ' active' : ''}`, onClick: () => setSelectedCat('all') }, 'All'),
        categories.map(c => React.createElement('button', {
          key: c,
          className: `sw-dict-filter${selectedCat === c ? ' active' : ''}`,
          onClick: () => setSelectedCat(c)
        }, c))
      )
    ),
    // Active library description
    activeLib && React.createElement('div', { className: 'uri-browser-lib-info', style: { marginBottom: 14 } },
      React.createElement('div', null,
        React.createElement('div', { className: 'uri-browser-lib-info-name' }, activeLib.name),
        React.createElement('div', null, activeLib.description),
        React.createElement('div', { style: { marginTop: 4, fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--teal)' } }, 'Prefix: ', activeLib.prefix)
      )
    ),
    // Results count
    React.createElement('div', { style: { fontSize: 11, color: 'var(--tx-3)', fontFamily: 'var(--mono)', marginBottom: 10 } },
      results.length, ' ', results.length === 1 ? 'definition' : 'definitions',
      search && React.createElement('span', null, ' matching "', search, '"')
    ),
    // Results grid
    results.length === 0
      ? React.createElement('div', { className: 'sw-dict-empty' },
          search ? `No URI definitions matching "${search}"` : 'No definitions in this category.'
        )
      : React.createElement('div', { className: 'sw-dict-grid' },
          results.map(entry => {
            const isExpanded = expandedUri === entry.uri;
            const alreadyImported = existingUris.has(entry.uri);
            return React.createElement('div', {
              key: entry.uri,
              className: `sw-dict-card${isExpanded ? ' expanded' : ''}`,
              onClick: () => setExpandedUri(isExpanded ? null : entry.uri)
            },
              React.createElement('div', { className: 'sw-dict-card-header' },
                React.createElement('div', null,
                  React.createElement('div', { className: 'sw-dict-card-name' }, entry.label),
                  React.createElement('div', { className: 'sw-dict-card-uri' }, entry.uri)
                ),
                React.createElement('div', { className: 'sw-dict-card-badges' },
                  alreadyImported && React.createElement('span', { className: 'tag tag-green', style: { fontSize: 8 } }, 'IMPORTED'),
                  React.createElement('span', {
                    className: `tag tag-${entry.library_color}`,
                    style: { fontSize: 8 }
                  }, entry.library_name),
                  React.createElement('span', {
                    className: `tag tag-${typeColor(entry.data_type)}`,
                    style: { fontSize: 8 }
                  }, (entry.data_type || 'text').toUpperCase())
                )
              ),
              React.createElement('div', { className: 'sw-dict-card-def' }, entry.definition),
              // Tags
              (entry.tags || []).length > 0 && React.createElement('div', { className: 'sw-dict-card-usage', style: { marginTop: 6 } },
                (entry.tags || []).map(t => React.createElement('span', {
                  key: t,
                  className: 'sw-dict-card-form-tag'
                }, t))
              ),
              // Expanded: full details + import button
              isExpanded && React.createElement('div', { style: { marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border-0)' } },
                React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 } },
                  React.createElement('div', null,
                    React.createElement('div', { style: { fontSize: 10, fontWeight: 600, color: 'var(--tx-2)', marginBottom: 2 } }, 'LIBRARY'),
                    React.createElement('div', { style: { fontSize: 12 } }, entry.library_name)
                  ),
                  React.createElement('div', null,
                    React.createElement('div', { style: { fontSize: 10, fontWeight: 600, color: 'var(--tx-2)', marginBottom: 2 } }, 'CATEGORY'),
                    React.createElement('div', { style: { fontSize: 12 } }, entry.category)
                  ),
                  React.createElement('div', null,
                    React.createElement('div', { style: { fontSize: 10, fontWeight: 600, color: 'var(--tx-2)', marginBottom: 2 } }, 'DATA TYPE'),
                    React.createElement('div', { style: { fontSize: 12 } }, entry.data_type || 'text')
                  ),
                  React.createElement('div', null,
                    React.createElement('div', { style: { fontSize: 10, fontWeight: 600, color: 'var(--tx-2)', marginBottom: 2 } }, 'FULL URI'),
                    React.createElement('div', { style: { fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--teal)', wordBreak: 'break-all' } }, entry.uri)
                  )
                ),
                onImport && React.createElement('div', { style: { display: 'flex', gap: 6, justifyContent: 'flex-end' }, onClick: e => e.stopPropagation() },
                  alreadyImported
                    ? React.createElement('span', { style: { fontSize: 11, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 4 } },
                        React.createElement(I, { n: 'check', s: 12, c: 'var(--green)' }), 'Already in dictionary'
                      )
                    : React.createElement('button', {
                        className: 'b-pri b-sm',
                        onClick: e => {
                          e.stopPropagation();
                          onImport({
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
                      }, 'Import to Dictionary')
                )
              )
            );
          })
        )
  );
};

/* ── SchemaWorkbench — top-level tab orchestrator ── */
const SchemaWorkbench = ({
  isOrg,
  orgMeta,
  networkMembers,
  fieldDefs,
  catLabels,
  catColors,
  onSaveFieldDef
}) => {
  const [activeTab, setActiveTab] = useState('forms');
  const [form, setForm] = useState(null);
  const [savedForms, setSavedForms] = useState([]);
  const [frameworks, setFrameworks] = useState([]);
  const [bindings, setBindings] = useState([]);
  const [crosswalks, setCrosswalks] = useState([]);
  const [toastMsg, setToastMsg] = useState(null);

  const showToast = msg => { setToastMsg(msg); setTimeout(() => setToastMsg(null), 3000); };

  // All forms: savedForms + DEFAULT_FORMS (network)
  const allForms = useMemo(() => {
    const savedIds = new Set((savedForms || []).map(f => f.id));
    const networkDefaults = (DEFAULT_FORMS || []).filter(f => !savedIds.has(f.id));
    return [...(savedForms || []).map(sf => sf.form || sf), ...networkDefaults];
  }, [savedForms]);

  const handleNewForm = () => {
    const newForm = {
      name: 'Untitled Form',
      key: 'untitled_form',
      version: 1,
      maturity: 'draft',
      description: '',
      sections: [{
        id: `sec_${Date.now()}`,
        title: 'General',
        questions: []
      }]
    };
    setForm(newForm);
  };

  const handleSave = () => {
    if (!form) return;
    const saveEntry = {
      id: form.id || `form_${Date.now()}`,
      name: form.name,
      version: form.version || 1,
      maturity: form.maturity || 'draft',
      savedAt: Date.now(),
      sourceType: 'local',
      form: form
    };
    setSavedForms(prev => {
      const idx = prev.findIndex(f => f.id === saveEntry.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saveEntry;
        return next;
      }
      return [...prev, saveEntry];
    });
    if (!form.id) setForm(prev => ({ ...prev, id: saveEntry.id }));
    showToast('Form saved');
  };

  const handleLoad = (formData) => {
    setForm(formData.form || formData);
  };

  const navigateToForm = (formId, fieldKey) => {
    setActiveTab('forms');
    // Find and load the form
    const found = allForms.find(f => f.id === formId);
    if (found) setForm(found);
  };

  const tabs = [
    { id: 'dictionary', label: 'Dictionary', icon: 'book', count: Object.keys(fieldDefs || {}).length + VAULT_FIELDS.length },
    { id: 'uri_libraries', label: 'URI Libraries', icon: 'globe', count: URI_LIBRARIES.length },
    { id: 'forms', label: 'Forms', icon: 'layers', count: allForms.length },
    { id: 'columns', label: 'Columns', icon: 'grid', count: null },
    { id: 'governance', label: 'Governance', icon: 'shieldCheck', count: null }
  ];

  return React.createElement('div', { className: 'sw-wrap' },
    // Header
    React.createElement('div', { className: 'sw-header' },
      React.createElement('div', { className: 'sw-title' },
        React.createElement(I, { n: 'layers', s: 18, c: SWC.given }),
        'Schema Workbench'
      )
    ),
    // Tabs
    React.createElement('div', { className: 'sw-tabs' },
      tabs.map(tab => React.createElement('button', {
        key: tab.id,
        className: `sw-tab${activeTab === tab.id ? ' active' : ''}`,
        onClick: () => setActiveTab(tab.id)
      },
        React.createElement(I, { n: tab.icon, s: 13 }),
        tab.label,
        tab.count != null && React.createElement('span', { className: 'sw-tab-count' }, tab.count)
      ))
    ),
    // Canvas
    React.createElement('div', { className: 'sw-canvas' },
      activeTab === 'dictionary' && React.createElement('div', { className: 'sw-canvas-inner' },
        React.createElement(DictionaryTab, {
          fieldDefs: fieldDefs,
          allForms: allForms,
          catLabels: catLabels || CAT_LABELS,
          catColors: catColors || CAT_COLORS,
          catIcons: CAT_ICONS,
          onSaveFieldDef: onSaveFieldDef
        })
      ),
      activeTab === 'uri_libraries' && React.createElement('div', { className: 'sw-canvas-inner' },
        React.createElement(UriLibrariesTab, {
          onImport: onSaveFieldDef ? entry => {
            onSaveFieldDef({
              uri: entry.uri,
              key: entry.key,
              label: entry.label,
              definition: entry.definition,
              data_type: entry.data_type || 'text',
              category: entry.category || 'general',
              sensitive: false,
              scope: null,
              authority: entry.source_library || null,
              source_library: entry.source_library,
              source_library_id: entry.source_library_id,
              version: 1,
              version_history: [],
              migration_rules: [],
              supersedes: null,
              superseded_by: null,
              created_by: 'uri_library',
              created_at: Date.now()
            });
            showToast('Imported: ' + entry.label);
          } : null,
          fieldDefs: fieldDefs
        })
      ),
      activeTab === 'forms' && React.createElement('div', { className: 'sw-canvas-inner', style: { padding: 0 } },
        React.createElement(FormsTab, {
          allForms: allForms,
          savedForms: savedForms,
          form: form,
          setForm: setForm,
          frameworks: frameworks,
          bindings: bindings,
          crosswalks: crosswalks,
          setFrameworks: setFrameworks,
          setBindings: setBindings,
          setCrosswalks: setCrosswalks,
          fieldDefs: fieldDefs,
          catLabels: catLabels || CAT_LABELS,
          catColors: catColors || CAT_COLORS,
          onSaveFieldDef: onSaveFieldDef,
          onSave: handleSave,
          onLoad: handleLoad,
          onNewForm: handleNewForm,
          showToast: showToast,
          isOrg: isOrg,
          orgMeta: orgMeta,
          networkMembers: networkMembers
        })
      ),
      activeTab === 'columns' && React.createElement('div', { className: 'sw-canvas-inner' },
        React.createElement(ColumnsTab, {
          allForms: allForms,
          fieldDefs: fieldDefs,
          onNavigateToForm: navigateToForm
        })
      ),
      activeTab === 'governance' && React.createElement('div', { className: 'sw-canvas-inner' },
        React.createElement(GovernanceTab, {
          allForms: allForms,
          onNavigateToForm: navigateToForm
        })
      )
    ),
    // Toast
    toastMsg && React.createElement('div', {
      style: {
        position: 'fixed', bottom: 20, right: 20, background: SWC.given, color: SWC.bg,
        padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
        boxShadow: '0 4px 16px rgba(0,0,0,.3)', zIndex: 100, animation: 'fadeUp .2s ease both'
      }
    }, toastMsg)
  );
};

/* ═══════════════════ ACTION LOG + HELPERS ═══════════════════ */
