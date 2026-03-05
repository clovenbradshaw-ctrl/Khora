const NS = 'io.khora';
const EVT = {
  IDENTITY: `${NS}.identity`,
  OP: `${NS}.op`,
  // Vault
  VAULT_SNAPSHOT: `${NS}.vault.snapshot`,
  VAULT_PROVIDERS: `${NS}.vault.providers`,
  // Vault — partitioned fields + observations
  VAULT_FIELDS: `${NS}.vault.fields`,             // state_key partitioned by category (identity, contact, ids, settings)
  VAULT_OBSERVATION: `${NS}.vault.observation`,    // timeline event per observation
  // Bridge
  BRIDGE_META: `${NS}.bridge.meta`,
  BRIDGE_REFS: `${NS}.bridge.refs`,
  BRIDGE_KEYS: `${NS}.bridge.keys`,               // encryption keys, separate from ciphertext
  // Roster
  ROSTER_INDEX: `${NS}.roster.index`,
  ROSTER_ASSIGN: `${NS}.roster.assignment`,
  // Organization
  ORG_ROSTER: `${NS}.org.roster`,
  ORG_METADATA: `${NS}.org.metadata`,
  ORG_INVITE: `${NS}.org.invite`,
  ORG_OPACITY: `${NS}.org.opacity`,
  ORG_MSG_ACCESS: `${NS}.org.msg_access`,
  // Inter-org messaging
  ORG_MSG_CHANNEL: `${NS}.org.msg.channel`,
  ORG_MSG_ENVELOPE: `${NS}.org.msg.envelope`,
  // Schema — Forms (GIVEN data collection)
  SCHEMA_FORM: `${NS}.schema.form`,
  SCHEMA_PROMPT: `${NS}.schema.prompt`,
  // individual form field (backward compat)
  // Schema — Interpretations (MEANT frameworks)
  SCHEMA_ASSESSMENT: `${NS}.schema.assessment`,
  // provider-side MEANT instruments
  SCHEMA_DEF: `${NS}.schema.definition`,
  SCHEMA_TRANSFORM: `${NS}.schema.transform`,
  SCHEMA_SUB: `${NS}.schema.subscription`,
  SCHEMA_AUTHORITY: `${NS}.schema.authority`,
  SCHEMA_PROP: `${NS}.schema.propagation`,
  // Provider observations
  OBSERVATION: `${NS}.observation`,
  // Metrics
  METRIC: `${NS}.metric`,
  METRIC_AGG: `${NS}.metric.aggregate`,
  METRIC_SUPPRESS: `${NS}.metric.suppression`,
  // Network
  NET_MEMBERS: `${NS}.network.members`,
  NET_HASH_SALT: `${NS}.network.hash_salt`,
  // Discovery
  INVITE_TOKEN: `${NS}.invite.token`,
  ENCOUNTER_PROV: `${NS}.encounter.provisional`,
  // Email verification
  ORG_EMAIL_CONFIG: `${NS}.org.email_verification`,
  ORG_VERIFY_CHALLENGE: `${NS}.org.verification_challenge`,
  // Organization terminology customization
  ORG_TERMINOLOGY: `${NS}.org.terminology`,
  // Organization custom roles
  ORG_ROLES: `${NS}.org.roles`,
  // Teams (flexible groups of people, not tied to a single org)
  TEAM_META: `${NS}.team.metadata`,
  TEAM_MEMBERS: `${NS}.team.members`,
  TEAM_SCHEMA: `${NS}.team.schema`,
  TEAM_SCHEMA_RULE: `${NS}.team.schema_rule`,
  // Team hierarchy and custom tables
  TEAM_HIERARCHY: `${NS}.team.hierarchy`,         // parent/child nesting + rollup policy
  TEAM_TABLE_DEF: `${NS}.team.table.definition`,  // custom table definition (state_key = table.id)
  TEAM_TABLE_RECORD: `${NS}.team.table.record`,   // record in custom table (state_key = tableId+':'+recordId)
  // Field definitions & crosswalks
  FIELD_DEF: `${NS}.field.definition`,
  FIELD_CROSSWALK: `${NS}.field.crosswalk`,
  FIELD_GOV_CONFIG: `${NS}.field.governance_config`,
  // Matching / dedup
  MATCH_TOKEN: `${NS}.match.token`,
  MATCH_HIT: `${NS}.match.hit`,
  MATCH_RESOLVE: `${NS}.match.resolve`,
  // Notes (standalone or attached to individuals)
  NOTE: `${NS}.note`,
  NOTE_REF: `${NS}.note.ref`,
  // org-side reference pointing to bridge note
  NOTE_EDIT: `${NS}.note.edit`,
  // auditable note edit (ALT operation)
  // Client records (provider-created rooms representing clients)
  CLIENT_RECORD: `${NS}.client.record`,
  // Import
  IMPORT_MANIFEST: `${NS}.import.manifest`,
  // Provider profile (self-reported identity & credentials)
  PROVIDER_PROFILE: `${NS}.provider.profile`,
  // Governance (MVP §Screen 5)
  GOV_PROPOSAL: `${NS}.governance.proposal`,
  GOV_RHYTHM: `${NS}.governance.rhythm`,
  // Schema field & binding (MVP event schema)
  SCHEMA_FIELD: `${NS}.schema.field`,
  SCHEMA_BINDING: `${NS}.schema.binding`,
  // Resource tracking (§Resource Build)
  RESOURCE_TYPE: `${NS}.resource.type`,
  // catalog entry (network or org)
  RESOURCE_INVENTORY: `${NS}.resource.inventory`,
  // org stock levels per relation
  RESOURCE_RELATION: `${NS}.resource.relation`,
  // relational position between holder and resource
  RESOURCE_ALLOC: `${NS}.resource.allocation`,
  // individual allocation (bridge room)
  RESOURCE_EVENT: `${NS}.resource.event`,
  // lifecycle event (timeline, not state)
  RESOURCE_POLICY: `${NS}.resource.policy`,
  // allocation rules / constraints
  RESOURCE_OPACITY: `${NS}.resource.opacity`,
  // per-relation visibility controls
  RESOURCE_VAULT: `${NS}.resource.vault_record`,
  // client vault shadow record
  RESOURCE_PERM: `${NS}.resource.permissions`, // per-type permission grants
  // Direct messaging between connected users
  DM_META: `${NS}.dm.meta`,
  // Database merge (auditable SYN-based record merging)
  MERGE_RECORD: `${NS}.merge.record`,
  MERGE_AUDIT: `${NS}.merge.audit`,
  // Linked records (sub-records linked across record types, Airtable-style)
  LINKED_RECORD: `${NS}.linked.record`,
  LINKED_RECORD_INDEX: `${NS}.linked.record.index`,
  // Trash bin — soft-deleted individuals pending permanent removal
  ORG_TRASH: `${NS}.org.trash`,
  // Team record index — maps team rooms to their owned CLIENT_RECORD rooms, tracks vault access state
  TEAM_RECORD_INDEX: `${NS}.team.record.index`,
  // Account claim verification (6-digit code for identity confirmation before room claim)
  CLAIM_VERIFICATION: `${NS}.claim.verification`,
  // Filen backup credentials (encrypted email + password, stored in user's owned room)
  BACKUP_CREDS: `${NS}.backup.credentials`
};

/* ═══════════════════ VAULT FIELD CATEGORIES ═══════════════════ */
// Maps field keys to vault partition categories for state_key-partitioned storage.
// Fields not listed here default to 'identity'.
const VAULT_CATEGORIES = {
  identity: ['first_name', 'last_name', 'dob', 'gender', 'race_ethnicity', 'veteran_status', 'disability_status'],
  contact: ['phone', 'email', 'address'],
  ids: ['ssn_last4', 'hmis_id'],
};
const _fieldCatMap = {};
for (const [cat, keys] of Object.entries(VAULT_CATEGORIES)) {
  for (const k of keys) _fieldCatMap[k] = cat;
}
/** Return the vault partition category for a given field key */
function fieldCategory(key) { return _fieldCatMap[key] || 'identity'; }

/* ═══════════════════ MATURITY LEVELS (MVP §Screen 4) ═══════════════════ */
// DES(schema.lifecycle_states, {values: [draft, trial, normative, de_facto, deprecated]}) — schema_governance
const MATURITY_LEVELS = {
  draft: {
    id: 'draft',
    label: 'Draft',
    color: 'blue',
    icon: '🔵',
    desc: 'This question is proposed \u2014 it hasn\u2019t been formally reviewed yet and may change'
  },
  trial: {
    id: 'trial',
    label: 'Trial',
    color: 'gold',
    icon: '🟡',
    desc: 'This question is approved for use but still being tested \u2014 it could be updated'
  },
  normative: {
    id: 'normative',
    label: 'Normative',
    color: 'green',
    icon: '🟢',
    desc: 'This question is finalized \u2014 it\u2019s the agreed-upon standard across the network'
  },
  de_facto: {
    id: 'de_facto',
    label: 'De facto',
    color: 'purple',
    icon: '⚪',
    desc: 'Widely used, never formally proposed'
  },
  deprecated: {
    id: 'deprecated',
    label: 'Deprecated',
    color: 'red',
    icon: '🔴',
    desc: 'Being phased out'
  }
};

/* ═══════════════════ UX HELPERS ═══════════════════ */
const aOrAn = (word) => /^[aeiou]/i.test(word) ? 'an' : 'a';
const hueToColorName = (hue) => {
  if (hue < 15) return 'Red';
  if (hue < 45) return 'Orange';
  if (hue < 70) return 'Yellow';
  if (hue < 150) return 'Green';
  if (hue < 190) return 'Cyan';
  if (hue < 260) return 'Blue';
  if (hue < 310) return 'Purple';
  if (hue < 345) return 'Pink';
  return 'Red';
};

/* ═══════════════════ TEAM COLOR UTILITIES ═══════════════════ */
const randomTeamHue = () => Math.floor(Math.random() * 360);
// Golden-angle spacing ensures team colors are meaningfully distinct per user account
const distinctTeamHue = (index) => Math.round((index * 137.508) % 360);
// Per-user localStorage helpers — colors are local, not synced to Matrix
const _tcKey = (userId, roomId) => `khora_tc_${userId}_${roomId}`;
const getLocalTeamColor = (userId, roomId, fallback) => {
  try { const v = localStorage.getItem(_tcKey(userId, roomId)); if (v !== null) return parseInt(v); } catch {}
  return fallback;
};
const setLocalTeamColor = (userId, roomId, hue) => {
  try { localStorage.setItem(_tcKey(userId, roomId), String(hue)); } catch {}
};
const teamColorThemed = (hue, isLight) => {
  if (hue == null) hue = 260;
  const l = isLight ? 38 : 55;
  const s = isLight ? 55 : 65;
  return {
    primary: `hsl(${hue}, ${s}%, ${l}%)`,
    dim: `hsla(${hue}, ${s}%, ${l}%, 0.10)`,
    border: `hsla(${hue}, ${s}%, ${l}%, 0.15)`,
    mid: `hsla(${hue}, ${s}%, ${l}%, 0.22)`
  };
};

/* ═══════════════════ PROPAGATION LEVELS (MVP §CON Semantics) ═══════════════════ */
// DES(schema.coupling_strengths, {values: [required, standard, recommended, optional]}) — network_governance
const PROPAGATION_LEVELS = {
  required: {
    id: 'required',
    label: 'Required',
    color: 'red',
    desc: 'All teams in the network must use this form \u2014 it can\u2019t be changed locally'
  },
  standard: {
    id: 'standard',
    label: 'Standard',
    color: 'gold',
    desc: 'Used by default across the network \u2014 teams are notified if they diverge'
  },
  recommended: {
    id: 'recommended',
    label: 'Recommended',
    color: 'blue',
    desc: 'Suggested by the network \u2014 each team decides whether to adopt it'
  },
  optional: {
    id: 'optional',
    label: 'Optional',
    color: 'teal',
    desc: 'Loose coupling — available, no expectation'
  }
};

/* ═══════════════════ GOVERNANCE CONSTANTS (MVP §Screen 5) ═══════════════════ */
// DES(governance.vocabulary, {consent, proposals, rhythms}) — polycentric_governance
const CONSENT_POSITIONS = {
  adopt_as_is: {
    id: 'adopt_as_is',
    label: 'Adopt as-is',
    icon: '✅',
    color: 'green'
  },
  adopt_with_extension: {
    id: 'adopt_with_extension',
    label: 'Adopt with extension',
    icon: '🔄',
    color: 'blue'
  },
  needs_modification: {
    id: 'needs_modification',
    label: 'Needs modification',
    icon: '⚠️',
    color: 'gold'
  },
  cannot_adopt: {
    id: 'cannot_adopt',
    label: 'Cannot adopt (block)',
    icon: '🚫',
    color: 'red'
  }
};
const PROPOSAL_STATUSES = {
  submitted: {
    id: 'submitted',
    label: 'Submitted',
    color: 'blue'
  },
  discussion: {
    id: 'discussion',
    label: 'Discussion',
    color: 'gold'
  },
  consent_round: {
    id: 'consent_round',
    label: 'Consent Round',
    color: 'orange'
  },
  resolved: {
    id: 'resolved',
    label: 'Resolved',
    color: 'green'
  },
  adopted: {
    id: 'adopted',
    label: 'Adopted',
    color: 'green'
  },
  blocked: {
    id: 'blocked',
    label: 'Blocked',
    color: 'red'
  }
};
const GOV_RHYTHMS = {
  monthly_review: {
    id: 'monthly_review',
    name: 'Monthly Schema Review',
    frequency: 'monthly',
    anchor_day: 'first_monday',
    duration_days: 5,
    participants: 'org_admins'
  },
  quarterly_alignment: {
    id: 'quarterly_alignment',
    name: 'Quarterly Framework Alignment',
    frequency: 'quarterly',
    anchor_day: 'first_monday',
    duration_days: 5,
    participants: 'network_steward_plus_affected'
  },
  annual_constitutional: {
    id: 'annual_constitutional',
    name: 'Annual Constitutional Review',
    frequency: 'annual',
    anchor_day: 'first_monday',
    duration_days: 14,
    participants: 'all_members_supermajority'
  }
};

/* ═══════════════════ TEAM CONSENT MODES (§Team Schema Governance) ═══════════════════ */
const TEAM_CONSENT_MODES = {
  lead_decides: {
    id: 'lead_decides',
    label: 'Lead Decides',
    icon: 'briefcase',
    color: 'gold',
    desc: 'Team lead can change the schema directly. Members are notified.'
  },
  majority: {
    id: 'majority',
    label: 'Majority',
    icon: 'users',
    color: 'blue',
    desc: 'Schema changes require approval from more than half of team members.'
  },
  unanimous: {
    id: 'unanimous',
    label: 'Unanimous',
    icon: 'shieldCheck',
    color: 'green',
    desc: 'All team members must approve schema changes. Any member can block.'
  }
};

/* ═══════════════════ CROSSWALK RELATIONSHIP TYPES (§Field Definitions) ═══════════════════ */
const CROSSWALK_TYPES = {
  equivalent: {
    id: 'equivalent',
    label: 'Equivalent',
    symbol: '\u2261',
    color: 'green',
    desc: 'Same concept, different name'
  },
  narrower: {
    id: 'narrower',
    label: 'Narrower',
    symbol: '\u2282',
    color: 'blue',
    desc: 'Target is a subset of source'
  },
  broader: {
    id: 'broader',
    label: 'Broader',
    symbol: '\u2283',
    color: 'teal',
    desc: 'Target is a superset of source'
  },
  related: {
    id: 'related',
    label: 'Related',
    symbol: '~',
    color: 'gold',
    desc: 'Conceptually linked but distinct'
  },
  conflicting: {
    id: 'conflicting',
    label: 'Conflicting',
    symbol: '\u2260',
    color: 'red',
    desc: 'Same name, different meaning'
  }
};

/* ═══════════════════ URI LIBRARIES (§Searchable Definitions) ═══════════════════
 * DES(uri_libraries, {standard_vocabularies}) — semantic_interoperability
 *
 * Curated libraries of standard URIs from established vocabularies.
 * Used throughout the app to let users attach well-known definitions to
 * their fields, forms, and observations. Each library entry provides:
 *   - uri: the canonical URI for the concept
 *   - label: human-readable name
 *   - definition: what this concept means
 *   - data_type: expected data type (text, date, select, etc.)
 *   - category: grouping within the library
 *   - tags: searchable keywords
 * ════════════════════════════════════════════════════════════════════════ */
const URI_LIBRARIES = [
  {
    id: 'schema_org',
    name: 'Schema.org',
    prefix: 'https://schema.org/',
    description: 'Structured data vocabulary maintained by Google, Microsoft, Yahoo, and Yandex. Widely used for web-standard person, organization, and event descriptions.',
    color: 'blue',
    icon: 'globe',
    entries: [
      { uri: 'https://schema.org/givenName', label: 'Given Name', definition: 'The given (first) name of a person.', data_type: 'text', category: 'identity', tags: ['name', 'first name', 'person'] },
      { uri: 'https://schema.org/familyName', label: 'Family Name', definition: 'The family (last) name of a person.', data_type: 'text', category: 'identity', tags: ['name', 'last name', 'surname', 'person'] },
      { uri: 'https://schema.org/name', label: 'Name', definition: 'The full name of the thing (person, org, place, etc.).', data_type: 'text', category: 'identity', tags: ['name', 'full name'] },
      { uri: 'https://schema.org/email', label: 'Email', definition: 'An email address.', data_type: 'email', category: 'contact', tags: ['email', 'address', 'electronic'] },
      { uri: 'https://schema.org/telephone', label: 'Telephone', definition: 'A telephone number.', data_type: 'phone', category: 'contact', tags: ['phone', 'telephone', 'mobile', 'cell'] },
      { uri: 'https://schema.org/birthDate', label: 'Birth Date', definition: 'Date of birth.', data_type: 'date', category: 'identity', tags: ['dob', 'birthday', 'born', 'age'] },
      { uri: 'https://schema.org/gender', label: 'Gender', definition: 'Gender of the person.', data_type: 'single_select', category: 'identity', tags: ['gender', 'sex', 'identity'] },
      { uri: 'https://schema.org/address', label: 'Postal Address', definition: 'Physical address of the item.', data_type: 'address', category: 'contact', tags: ['address', 'street', 'postal', 'mailing'] },
      { uri: 'https://schema.org/nationality', label: 'Nationality', definition: 'Nationality of the person.', data_type: 'text', category: 'identity', tags: ['nationality', 'country', 'citizen'] },
      { uri: 'https://schema.org/knows', label: 'Knows', definition: 'The most generic bi-directional social relationship.', data_type: 'text', category: 'social', tags: ['relationship', 'contact', 'knows'] },
      { uri: 'https://schema.org/memberOf', label: 'Member Of', definition: 'An organization to which the person belongs.', data_type: 'text', category: 'social', tags: ['member', 'organization', 'affiliation'] },
      { uri: 'https://schema.org/jobTitle', label: 'Job Title', definition: 'The job title of the person.', data_type: 'text', category: 'employment', tags: ['job', 'title', 'role', 'position'] },
      { uri: 'https://schema.org/worksFor', label: 'Works For', definition: 'Organizations the person works for.', data_type: 'text', category: 'employment', tags: ['employer', 'organization', 'work'] },
      { uri: 'https://schema.org/healthCondition', label: 'Health Condition', definition: 'A health condition relevant to the person.', data_type: 'text', category: 'health', tags: ['health', 'condition', 'medical', 'diagnosis'] },
      { uri: 'https://schema.org/identifier', label: 'Identifier', definition: 'A unique identifier for the thing.', data_type: 'text', category: 'identity', tags: ['id', 'identifier', 'number', 'code'] },
      { uri: 'https://schema.org/description', label: 'Description', definition: 'A free-text description of the item.', data_type: 'text_long', category: 'general', tags: ['description', 'notes', 'text'] },
      { uri: 'https://schema.org/image', label: 'Image', definition: 'An image of the item.', data_type: 'document', category: 'general', tags: ['image', 'photo', 'picture'] },
      { uri: 'https://schema.org/Organization', label: 'Organization', definition: 'An organization such as a school, NGO, corporation, club, etc.', data_type: 'text', category: 'social', tags: ['organization', 'org', 'company', 'institution'] },
      { uri: 'https://schema.org/Place', label: 'Place', definition: 'Entities that have a somewhat fixed, physical extension.', data_type: 'text', category: 'location', tags: ['place', 'location', 'address', 'geo'] },
      { uri: 'https://schema.org/Event', label: 'Event', definition: 'An event happening at a certain time and location.', data_type: 'text', category: 'general', tags: ['event', 'appointment', 'meeting', 'occurrence'] }
    ]
  },
  {
    id: 'dublin_core',
    name: 'Dublin Core',
    prefix: 'http://purl.org/dc/terms/',
    description: 'ISO 15836 metadata standard for describing resources. Foundational vocabulary for document and record metadata across libraries, archives, and information systems.',
    color: 'teal',
    icon: 'book',
    entries: [
      { uri: 'http://purl.org/dc/terms/title', label: 'Title', definition: 'A name given to the resource.', data_type: 'text', category: 'general', tags: ['title', 'name', 'label'] },
      { uri: 'http://purl.org/dc/terms/description', label: 'Description', definition: 'An account of the resource content.', data_type: 'text_long', category: 'general', tags: ['description', 'summary', 'abstract'] },
      { uri: 'http://purl.org/dc/terms/subject', label: 'Subject', definition: 'The topic or subject matter of the resource.', data_type: 'text', category: 'general', tags: ['subject', 'topic', 'keyword', 'tag'] },
      { uri: 'http://purl.org/dc/terms/creator', label: 'Creator', definition: 'An entity primarily responsible for making the resource.', data_type: 'text', category: 'provenance', tags: ['creator', 'author', 'made by'] },
      { uri: 'http://purl.org/dc/terms/date', label: 'Date', definition: 'A point or period of time associated with an event in the lifecycle of the resource.', data_type: 'date', category: 'provenance', tags: ['date', 'when', 'time'] },
      { uri: 'http://purl.org/dc/terms/created', label: 'Date Created', definition: 'Date of creation of the resource.', data_type: 'date', category: 'provenance', tags: ['created', 'creation date', 'started'] },
      { uri: 'http://purl.org/dc/terms/modified', label: 'Date Modified', definition: 'Date on which the resource was changed.', data_type: 'date', category: 'provenance', tags: ['modified', 'updated', 'changed'] },
      { uri: 'http://purl.org/dc/terms/identifier', label: 'Identifier', definition: 'An unambiguous reference to the resource within a given context.', data_type: 'text', category: 'identity', tags: ['id', 'identifier', 'reference'] },
      { uri: 'http://purl.org/dc/terms/language', label: 'Language', definition: 'A language of the resource.', data_type: 'text', category: 'general', tags: ['language', 'locale', 'lang'] },
      { uri: 'http://purl.org/dc/terms/type', label: 'Type', definition: 'The nature or genre of the resource.', data_type: 'single_select', category: 'general', tags: ['type', 'kind', 'genre', 'category'] },
      { uri: 'http://purl.org/dc/terms/format', label: 'Format', definition: 'The file format, physical medium, or dimensions of the resource.', data_type: 'text', category: 'general', tags: ['format', 'file type', 'mime'] },
      { uri: 'http://purl.org/dc/terms/rights', label: 'Rights', definition: 'Information about rights held in and over the resource.', data_type: 'text', category: 'governance', tags: ['rights', 'license', 'permission', 'copyright'] },
      { uri: 'http://purl.org/dc/terms/source', label: 'Source', definition: 'A related resource from which the described resource is derived.', data_type: 'text', category: 'provenance', tags: ['source', 'origin', 'derived from'] },
      { uri: 'http://purl.org/dc/terms/coverage', label: 'Coverage', definition: 'The spatial or temporal topic of the resource.', data_type: 'text', category: 'general', tags: ['coverage', 'scope', 'jurisdiction', 'geography'] },
      { uri: 'http://purl.org/dc/terms/relation', label: 'Relation', definition: 'A related resource.', data_type: 'text', category: 'general', tags: ['relation', 'related to', 'see also'] }
    ]
  },
  {
    id: 'foaf',
    name: 'FOAF',
    prefix: 'http://xmlns.com/foaf/0.1/',
    description: 'Friend of a Friend — RDF vocabulary for describing persons, social networks, and online accounts. Standard in linked data and social web applications.',
    color: 'purple',
    icon: 'users',
    entries: [
      { uri: 'http://xmlns.com/foaf/0.1/name', label: 'Name', definition: 'A name for some thing (person, org, etc.).', data_type: 'text', category: 'identity', tags: ['name', 'full name'] },
      { uri: 'http://xmlns.com/foaf/0.1/firstName', label: 'First Name', definition: 'The first name of a person.', data_type: 'text', category: 'identity', tags: ['first name', 'given name'] },
      { uri: 'http://xmlns.com/foaf/0.1/lastName', label: 'Last Name', definition: 'The last name of a person.', data_type: 'text', category: 'identity', tags: ['last name', 'family name', 'surname'] },
      { uri: 'http://xmlns.com/foaf/0.1/mbox', label: 'Email (Mailbox)', definition: 'A personal mailbox, i.e., an Internet mailbox associated with exactly one owner.', data_type: 'email', category: 'contact', tags: ['email', 'mailbox'] },
      { uri: 'http://xmlns.com/foaf/0.1/phone', label: 'Phone', definition: 'A phone number associated with the person.', data_type: 'phone', category: 'contact', tags: ['phone', 'telephone'] },
      { uri: 'http://xmlns.com/foaf/0.1/age', label: 'Age', definition: 'The age of the agent.', data_type: 'number', category: 'identity', tags: ['age', 'years old'] },
      { uri: 'http://xmlns.com/foaf/0.1/gender', label: 'Gender', definition: 'The gender of this Agent (typically but not necessarily \'male\' or \'female\').', data_type: 'single_select', category: 'identity', tags: ['gender', 'sex'] },
      { uri: 'http://xmlns.com/foaf/0.1/knows', label: 'Knows', definition: 'A person known by this person (indicates some level of reciprocated interaction).', data_type: 'text', category: 'social', tags: ['knows', 'relationship', 'contact'] },
      { uri: 'http://xmlns.com/foaf/0.1/based_near', label: 'Based Near', definition: 'A location that something is based near, for loose geographic associations.', data_type: 'text', category: 'location', tags: ['location', 'near', 'based', 'geography'] },
      { uri: 'http://xmlns.com/foaf/0.1/Organization', label: 'Organization', definition: 'An organization.', data_type: 'text', category: 'social', tags: ['organization', 'org', 'company'] },
      { uri: 'http://xmlns.com/foaf/0.1/Group', label: 'Group', definition: 'A class of Agents representing a collection of individuals.', data_type: 'text', category: 'social', tags: ['group', 'team', 'collection'] },
      { uri: 'http://xmlns.com/foaf/0.1/homepage', label: 'Homepage', definition: 'A homepage for some thing.', data_type: 'text', category: 'contact', tags: ['homepage', 'website', 'url'] },
      { uri: 'http://xmlns.com/foaf/0.1/depiction', label: 'Depiction', definition: 'An image that depicts some thing.', data_type: 'document', category: 'general', tags: ['image', 'photo', 'depiction'] }
    ]
  },
  {
    id: 'vcard',
    name: 'vCard',
    prefix: 'http://www.w3.org/2006/vcard/ns#',
    description: 'W3C vCard ontology for contact and address information. Maps to the widely-deployed vCard standard (RFC 6350) used in phone contacts and email clients.',
    color: 'green',
    icon: 'contact',
    entries: [
      { uri: 'http://www.w3.org/2006/vcard/ns#fn', label: 'Formatted Name', definition: 'The formatted name string associated with the vCard object.', data_type: 'text', category: 'identity', tags: ['name', 'full name', 'formatted'] },
      { uri: 'http://www.w3.org/2006/vcard/ns#hasEmail', label: 'Email', definition: 'An email address associated with the object.', data_type: 'email', category: 'contact', tags: ['email', 'address'] },
      { uri: 'http://www.w3.org/2006/vcard/ns#hasTelephone', label: 'Telephone', definition: 'A telephone number associated with the object.', data_type: 'phone', category: 'contact', tags: ['phone', 'telephone'] },
      { uri: 'http://www.w3.org/2006/vcard/ns#hasAddress', label: 'Address', definition: 'A postal address associated with the object.', data_type: 'address', category: 'contact', tags: ['address', 'postal', 'mailing'] },
      { uri: 'http://www.w3.org/2006/vcard/ns#bday', label: 'Birthday', definition: 'Date of birth of the individual.', data_type: 'date', category: 'identity', tags: ['birthday', 'dob', 'birth date'] },
      { uri: 'http://www.w3.org/2006/vcard/ns#hasGeo', label: 'Geographic Location', definition: 'Geographic coordinates associated with the object.', data_type: 'text', category: 'location', tags: ['geo', 'coordinates', 'location', 'lat', 'lng'] },
      { uri: 'http://www.w3.org/2006/vcard/ns#role', label: 'Role', definition: 'The role associated with the individual within an organization.', data_type: 'text', category: 'employment', tags: ['role', 'job', 'position', 'title'] },
      { uri: 'http://www.w3.org/2006/vcard/ns#org', label: 'Organization Name', definition: 'The organization name associated with the object.', data_type: 'text', category: 'social', tags: ['organization', 'org', 'company'] },
      { uri: 'http://www.w3.org/2006/vcard/ns#note', label: 'Note', definition: 'A note associated with the object.', data_type: 'text_long', category: 'general', tags: ['note', 'comment', 'text'] },
      { uri: 'http://www.w3.org/2006/vcard/ns#hasLanguage', label: 'Language', definition: 'Language(s) associated with the object.', data_type: 'text', category: 'general', tags: ['language', 'spoken', 'preferred'] }
    ]
  },
  {
    id: 'hl7_fhir',
    name: 'HL7 FHIR',
    prefix: 'http://hl7.org/fhir/',
    description: 'Fast Healthcare Interoperability Resources — the modern standard for exchanging healthcare information electronically. Used in clinical systems, EHRs, and health information exchanges.',
    color: 'orange',
    icon: 'heart',
    entries: [
      { uri: 'http://hl7.org/fhir/Patient', label: 'Patient', definition: 'Demographics and administrative information about an individual receiving care.', data_type: 'text', category: 'identity', tags: ['patient', 'client', 'individual'] },
      { uri: 'http://hl7.org/fhir/Patient.name', label: 'Patient Name', definition: 'A name associated with the patient.', data_type: 'text', category: 'identity', tags: ['name', 'patient name'] },
      { uri: 'http://hl7.org/fhir/Patient.birthDate', label: 'Birth Date', definition: 'The date of birth for the individual.', data_type: 'date', category: 'identity', tags: ['birth date', 'dob'] },
      { uri: 'http://hl7.org/fhir/Patient.gender', label: 'Administrative Gender', definition: 'Administrative gender — the gender the patient is considered to have for administration purposes.', data_type: 'single_select', category: 'demographics', tags: ['gender', 'sex', 'administrative'] },
      { uri: 'http://hl7.org/fhir/Patient.address', label: 'Patient Address', definition: 'An address for the individual.', data_type: 'address', category: 'contact', tags: ['address', 'home', 'postal'] },
      { uri: 'http://hl7.org/fhir/Patient.telecom', label: 'Contact Point', definition: 'A contact detail (phone, email, etc.) for the individual.', data_type: 'text', category: 'contact', tags: ['phone', 'email', 'contact', 'telecom'] },
      { uri: 'http://hl7.org/fhir/Patient.maritalStatus', label: 'Marital Status', definition: 'The patient\'s most recent marital (civil) status.', data_type: 'single_select', category: 'demographics', tags: ['marital', 'married', 'single', 'status'] },
      { uri: 'http://hl7.org/fhir/Patient.communication', label: 'Communication Language', definition: 'A language which may be used to communicate with the patient about their health.', data_type: 'text', category: 'demographics', tags: ['language', 'communication', 'spoken'] },
      { uri: 'http://hl7.org/fhir/Condition', label: 'Condition', definition: 'A clinical condition, problem, diagnosis, or other event/situation.', data_type: 'text', category: 'health', tags: ['condition', 'diagnosis', 'problem', 'health'] },
      { uri: 'http://hl7.org/fhir/Observation', label: 'Observation', definition: 'Measurements and simple assertions made about a patient or other subject.', data_type: 'text', category: 'health', tags: ['observation', 'measurement', 'vital sign', 'lab'] },
      { uri: 'http://hl7.org/fhir/Encounter', label: 'Encounter', definition: 'An interaction between a patient and healthcare provider for the purpose of providing services.', data_type: 'text', category: 'service', tags: ['encounter', 'visit', 'appointment', 'session'] },
      { uri: 'http://hl7.org/fhir/ServiceRequest', label: 'Service Request', definition: 'A record of a request for a procedure or diagnostic or other service to be planned, proposed, or performed.', data_type: 'text', category: 'service', tags: ['service', 'request', 'referral', 'order'] },
      { uri: 'http://hl7.org/fhir/Consent', label: 'Consent', definition: 'A record of a healthcare consumer\'s choices regarding sharing of information.', data_type: 'text', category: 'governance', tags: ['consent', 'permission', 'authorization', 'sharing'] },
      { uri: 'http://hl7.org/fhir/RelatedPerson', label: 'Related Person', definition: 'Information about a person that is involved in the care for a patient but is not the target of healthcare.', data_type: 'text', category: 'social', tags: ['related', 'family', 'caregiver', 'emergency contact'] },
      { uri: 'http://hl7.org/fhir/MedicationStatement', label: 'Medication Statement', definition: 'A record of a medication being taken by a patient.', data_type: 'text', category: 'health', tags: ['medication', 'prescription', 'drug', 'medicine'] }
    ]
  }
];

/* Helper: flatten all URI library entries into a searchable index */
const URI_LIBRARY_INDEX = (() => {
  const index = [];
  URI_LIBRARIES.forEach(lib => {
    (lib.entries || []).forEach(entry => {
      index.push({
        ...entry,
        library_id: lib.id,
        library_name: lib.name,
        library_color: lib.color,
        library_prefix: lib.prefix,
        _searchText: [entry.label, entry.definition, entry.uri, ...(entry.tags || [])].join(' ').toLowerCase()
      });
    });
  });
  return index;
})();

/* Search across all URI libraries */
const searchUriLibraries = (query, options = {}) => {
  const { libraryId, category, limit = 50 } = options;
  if (!query || query.length < 2) {
    let pool = URI_LIBRARY_INDEX;
    if (libraryId) pool = pool.filter(e => e.library_id === libraryId);
    if (category && category !== 'all') pool = pool.filter(e => e.category === category);
    return pool.slice(0, limit);
  }
  const q = query.toLowerCase();
  const terms = q.split(/\s+/).filter(t => t.length >= 2);
  let pool = URI_LIBRARY_INDEX;
  if (libraryId) pool = pool.filter(e => e.library_id === libraryId);
  if (category && category !== 'all') pool = pool.filter(e => e.category === category);
  const scored = pool.map(entry => {
    let score = 0;
    const st = entry._searchText;
    // Exact URI match
    if (st.includes(q)) score += 10;
    // All terms present
    const allHit = terms.every(t => st.includes(t));
    if (allHit) score += 5;
    // Individual term hits
    terms.forEach(t => { if (st.includes(t)) score += 2; });
    // Label starts with query
    if (entry.label.toLowerCase().startsWith(q)) score += 8;
    // Tag exact match
    if ((entry.tags || []).some(t => t === q)) score += 6;
    return { ...entry, _score: score };
  }).filter(e => e._score > 0);
  scored.sort((a, b) => b._score - a._score);
  return scored.slice(0, limit);
};

/* ═══════════════════ RESOURCE TRACKING CONSTANTS (§Resource Build) ═══════════════════ */
// DES(resources.vocabulary, {categories, opacity, relations, permissions}) — resource_tracking

/** Resource categories — the top-level classification for resource types */
const RESOURCE_CATEGORIES = ['housing',
// beds, units, vouchers, rental assistance
'financial',
// emergency funds, deposits, stipends
'transportation',
// bus passes, ride vouchers, gas cards
'food',
// meals, pantry bags, grocery cards
'health',
// medical supplies, prescriptions, hygiene kits
'employment',
// job training slots, interview clothing, tools
'legal',
// legal aid hours, document preparation
'education',
// tutoring hours, school supplies, enrollment slots
'general' // catch-all for org-specific items
];
const RESOURCE_CATEGORY_LABELS = {
  housing: 'Housing',
  financial: 'Financial',
  transportation: 'Transportation',
  food: 'Food',
  health: 'Health',
  employment: 'Employment',
  legal: 'Legal',
  education: 'Education',
  general: 'General'
};
const RESOURCE_CATEGORY_COLORS = {
  housing: 'blue',
  financial: 'green',
  transportation: 'teal',
  food: 'orange',
  health: 'red',
  employment: 'gold',
  legal: 'purple',
  education: 'blue',
  general: 'teal'
};

/**
 * Opacity levels control resource visibility. Defaults to SOVEREIGN (holder-only).
 * The holder controls disclosure — not the network admin.
 */
const RESOURCE_OPACITY = {
  SOVEREIGN: 0,
  // holder-only, no one else sees it
  ATTESTED: 1,
  // shared with specific partners via bridge
  CONTRIBUTED: 2,
  // visible in network resource commons
  PUBLISHED: 3 // externally visible (API, 211 feed, directory)
};
const RESOURCE_OPACITY_LABELS = {
  0: 'Sovereign',
  1: 'Attested',
  2: 'Contributed',
  3: 'Published'
};
const RESOURCE_OPACITY_DESCRIPTIONS = {
  0: 'Only visible to the holding org',
  1: 'Shared with specific partners via bridge',
  2: 'Visible in network resource commons',
  3: 'Externally visible (API, directory)'
};

/** Relation types describe how a holder relates to a resource */
const RESOURCE_RELATION_TYPES = ['operates',
// org runs/owns the resource directly
'funds',
// org provides funding for the resource
'refers_to',
// org can refer clients to this resource
'contributes_to',
// org contributes inventory to a shared pool
'transfers' // one-time transfer between orgs
];
const RESOURCE_RELATION_LABELS = {
  operates: 'Operates',
  funds: 'Funds',
  refers_to: 'Refers to',
  contributes_to: 'Contributes to',
  transfers: 'Transfers'
};

/** Allocation statuses */
const RESOURCE_ALLOC_STATUSES = ['active', 'consumed', 'expired', 'revoked'];

/** Lifecycle event types */
const RESOURCE_LIFECYCLE_EVENTS = ['allocated', 'consumed', 'expired', 'revoked', 'returned'];

/** Dedup link statuses */
const RESOURCE_DEDUP_STATUSES = ['confirmed', 'attested_non_additive', 'unresolved'];

/** Dedup link types */
const RESOURCE_DEDUP_LINK_TYPES = ['subset', 'same', 'overlaps'];

/**
 * Resource permission abilities. Each resource type carries a `permissions` object
 * mapping these abilities to arrays of grants (role-based or user-specific).
 *
 * Grant shape: { type: 'role'|'user', id: string }
 *   type:'role'  → id is an ORG_ROLE (e.g. 'admin', 'case_manager')
 *   type:'user'  → id is a Matrix user ID (e.g. '@alice:matrix.org')
 *
 * Abilities:
 *   controllers — can edit, delete, and configure the resource type
 *   allocators  — can allocate this resource to clients
 *   viewers     — can see this resource in the catalog (empty array = everyone)
 */
const RESOURCE_PERMISSION_ABILITIES = ['controllers', 'allocators', 'viewers'];
const RESOURCE_PERMISSION_LABELS = {
  controllers: 'Controllers',
  allocators: 'Allocators',
  viewers: 'Viewers'
};
const RESOURCE_PERMISSION_DESCRIPTIONS = {
  controllers: 'Can edit, configure, and delete this resource type',
  allocators: 'Can allocate this resource to clients',
  viewers: 'Can see this resource in the catalog (empty = everyone)'
};
const RESOURCE_PERMISSION_ICONS = {
  controllers: 'settings',
  allocators: 'send',
  viewers: 'eye'
};
const RESOURCE_PERMISSION_COLORS = {
  controllers: 'gold',
  allocators: 'blue',
  viewers: 'teal'
};

/** Default permissions for a newly created resource type (creator is admin → full control) */
function buildDefaultResourcePermissions() {
  return {
    controllers: [{
      type: 'role',
      id: 'admin'
    }],
    allocators: [{
      type: 'role',
      id: 'admin'
    }, {
      type: 'role',
      id: 'case_manager'
    }, {
      type: 'role',
      id: 'provider'
    }],
    viewers: [] // empty = everyone in the org
  };
}

/* ═══════════════════ ROLE INFERENCE (MVP §Screen 1) ═══════════════════
 * Operator Manifest:
 *   DES(identity.user_roles, {via: room_membership_scan}) — identity_classification
 *
 * Triad Summary:
 *   Existence:       DES (classify user into roles)
 *   Structure:       —
 *   Interpretation:  —
 *   No mutations — read-only scan. No REC — role frame is stable.
 *
 * Roles are detected from room memberships — no account-type selector.
 * A user can have multiple roles simultaneously.
 * ═══════════════════════════════════════════════════════════ */
const ROLES = {
  client: {
    id: 'client',
    label: 'Personal',
    icon: 'shield',
    color: 'teal',
    desc: 'Data owner with a Personal account and vault'
  },
  provider: {
    id: 'provider',
    label: 'Team Member',
    icon: 'briefcase',
    color: 'gold',
    desc: 'Case manager or outreach worker'
  },
  org_admin: {
    id: 'org_admin',
    label: 'Org Admin',
    icon: 'users',
    color: 'blue',
    desc: 'Team administrator'
  },
  network: {
    id: 'network',
    label: 'Network Coordinator',
    icon: 'globe',
    color: 'green',
    desc: 'Network governance steward'
  }
};

// DES(identity.user_roles, {via: room_membership_scan}) — identity_classification
// Scans all rooms to determine user's active roles via structural evidence
function inferRolesFromRooms(scannedState, userId) {
  const roles = new Set();
  for (const [roomId, state] of Object.entries(scannedState)) {
    const id = state[EVT.IDENTITY];
    if (!id) continue;
    // Client vault owned by this user → client role
    if (id.account_type === 'client' && id.owner === userId) roles.add('client');
    // Provider roster owned by this user → provider role
    if (id.account_type === 'provider' && id.owner === userId) roles.add('provider');
    // Org room where user is in staff roster → provider role
    if (id.account_type === 'organization') roles.add('provider');
    // Network room → network coordinator role (checked via power levels separately)
    if (id.account_type === 'network') roles.add('provider');
    // Bridge room where user is the provider side → provider role
    const bridge = state[EVT.BRIDGE_META];
    if (bridge && bridge.provider === userId) roles.add('provider');
    // Bridge room where user is the client side → client role
    if (bridge && bridge.client === userId) roles.add('client');
  }
  // Check for org admin role by examining org rosters
  for (const [roomId, state] of Object.entries(scannedState)) {
    const id = state[EVT.IDENTITY];
    const roster = state[EVT.ORG_ROSTER];
    if (id?.account_type === 'organization' && roster?.staff) {
      const staffEntry = roster.staff.find(s => s.userId === userId);
      if (staffEntry?.role === 'admin') roles.add('org_admin');
    }
  }
  return [...roles];
}

/* ═══════════════════ MATRIX SERVICE ═══════════════════
 * Operator Manifest:
 *   INS(matrix.session, {credentials}) — authentication                — login
 *   INS(crypto.vault_key, {via: hkdf}) — at_rest_encryption           — login key derivation
 *   NUL(matrix.legacy_stores, {reason: purge}) — security_cleanup     — login cleanup
 *   DES(matrix.session, {check: whoami}) — token_validation           — restoreSession
 *   INS(matrix.room, {e2ee, state}) — room_creation                   — createRoom
 *   INS(matrix.bridge_room, {power_levels}) — client_sovereign_creation — createClientRoom
 *   ALT(matrix.room_state, {state_event}) — protocol_mutation         — setState
 *   INS(matrix.timeline_event, {room}) — event_emission               — sendEvent
 *   DES(matrix.room_topology, {via: sync_state}) — room_classification — scanRooms
 *   NUL(matrix.session+keys+cache, {reason: logout}) — full_teardown  — logout
 *
 * Triad Summary:
 *   Existence:       INS (sessions, rooms, events), NUL (logout, purge)
 *   Structure:       CON (bridge creation links client ↔ provider)
 *   Interpretation:  ALT (state events), DES (room classification)
 *   No REC — KhoraService is a transport layer; it never reinterprets data.
 * ═══════════════════════════════════════════════════════════ */
