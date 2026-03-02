/**
 * CRM Functionality Tests — End-to-End Workflows
 *
 * Tests the complete CRM experience: creating individuals, managing profiles,
 * assigning cases, recording notes, allocating resources, merging records,
 * importing data, and bulk operations.
 *
 * Uses MockMatrixClient to simulate the Matrix protocol layer without
 * needing a real homeserver.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MockMatrixClient, loadModule } from '../setup.js';

// Load services.js (ResourceService, DatabaseMergeService, importClientRecords)
loadModule('services.js');

/* ════════════════════════════════════════════════════════════════════════════
 * 1. INDIVIDUAL / CLIENT RECORD LIFECYCLE
 * ════════════════════════════════════════════════════════════════════════════ */
describe('Individual / Client Record Lifecycle', () => {
  let mockClient;

  beforeEach(() => {
    mockClient = new MockMatrixClient();
    KhoraAuth._client = mockClient;
    KhoraAuth._userId = '@provider:test.local';
    globalThis.svc = new KhoraService();
  });

  it('create a client record room with identity and encrypted fields', async () => {
    const recordKey = await FieldCrypto.generateKey();
    const { ciphertext, iv } = await FieldCrypto.encrypt('Alice Johnson', recordKey);

    const roomId = await svc.createRoom('[Client] Alice J', 'Imported client record', [
      {
        type: EVT.IDENTITY,
        state_key: '',
        content: {
          account_type: 'client_record',
          owner: '@provider:test.local',
          created: Date.now(),
          imported: false,
          client_name: 'Client #1',
          status: 'created',
          team_id: null,
        },
      },
      {
        type: EVT.CLIENT_RECORD,
        state_key: '',
        content: {
          record_key: recordKey,
          encrypted_fields: { full_name: { ciphertext, iv } },
          demographics: {},
          field_count: 1,
        },
      },
    ]);

    expect(roomId).toBeTruthy();

    // Verify identity state was persisted
    const identity = await svc.getState(roomId, EVT.IDENTITY);
    expect(identity.account_type).toBe('client_record');
    expect(identity.owner).toBe('@provider:test.local');

    // Verify client record with encrypted fields
    const record = await svc.getState(roomId, EVT.CLIENT_RECORD);
    expect(record.record_key).toBe(recordKey);
    expect(record.encrypted_fields.full_name).toBeDefined();

    // Decrypt and verify
    const decrypted = await FieldCrypto.decrypt(
      record.encrypted_fields.full_name.ciphertext,
      record.encrypted_fields.full_name.iv,
      record.record_key
    );
    expect(decrypted).toBe('Alice Johnson');
  });

  it('create bridge room linking client to provider', async () => {
    const clientId = '@alice:test.local';
    const providerId = '@provider:test.local';

    const bridgeRoomId = await svc.createClientRoom(
      'Bridge: Alice ↔ Provider',
      'Encrypted bridge',
      [
        {
          type: EVT.BRIDGE_META,
          state_key: '',
          content: {
            client: clientId,
            provider: providerId,
            created: Date.now(),
            status: 'active',
          },
        },
      ],
      clientId
    );

    expect(bridgeRoomId).toBeTruthy();

    // Verify bridge metadata
    const meta = await svc.getState(bridgeRoomId, EVT.BRIDGE_META);
    expect(meta.client).toBe(clientId);
    expect(meta.provider).toBe(providerId);
    expect(meta.status).toBe('active');

    // Verify power levels — client should be admin (PL 100), provider PL 50
    const room = mockClient.getRoom(bridgeRoomId);
    const pl = room.currentState.getStateEvents('m.room.power_levels', '');
    expect(pl.getContent().users[clientId]).toBe(100);
    expect(pl.getContent().users[providerId]).toBe(50);
  });

  it('share vault fields via bridge with per-provider encryption', async () => {
    // Set up bridge room
    const bridgeRoomId = await svc.createRoom('Bridge', 'bridge');

    // Generate a unique key for this provider's field access
    const providerKey = await FieldCrypto.generateKey();

    // Encrypt fields for this provider
    const fieldData = {
      full_name: 'Alice Johnson',
      phone: '555-0100',
      email: 'alice@example.com',
    };

    const encryptedRefs = {};
    for (const [key, value] of Object.entries(fieldData)) {
      const { ciphertext, iv } = await FieldCrypto.encrypt(value, providerKey);
      encryptedRefs[key] = { ciphertext, iv, key: providerKey };
    }

    // Store encrypted references in bridge
    await svc.setState(bridgeRoomId, EVT.BRIDGE_REFS, {
      shared_fields: encryptedRefs,
      shared_at: Date.now(),
    });

    // Provider reads and decrypts
    const refs = await svc.getState(bridgeRoomId, EVT.BRIDGE_REFS);
    expect(Object.keys(refs.shared_fields)).toEqual(['full_name', 'phone', 'email']);

    for (const [key, ref] of Object.entries(refs.shared_fields)) {
      const plain = await FieldCrypto.decrypt(ref.ciphertext, ref.iv, ref.key);
      expect(plain).toBe(fieldData[key]);
    }
  });

  it('update shared field → re-encrypt → provider sees new value', async () => {
    const bridgeRoomId = await svc.createRoom('Bridge', 'bridge');
    const providerKey = await FieldCrypto.generateKey();

    // Initial share
    const { ciphertext: c1, iv: iv1 } = await FieldCrypto.encrypt('555-0100', providerKey);
    await svc.setState(bridgeRoomId, EVT.BRIDGE_REFS, {
      shared_fields: { phone: { ciphertext: c1, iv: iv1, key: providerKey } },
    });

    // Update phone number
    const { ciphertext: c2, iv: iv2 } = await FieldCrypto.encrypt('555-0200', providerKey);
    await svc.setState(bridgeRoomId, EVT.BRIDGE_REFS, {
      shared_fields: { phone: { ciphertext: c2, iv: iv2, key: providerKey } },
    });

    // Provider reads updated value
    const refs = await svc.getState(bridgeRoomId, EVT.BRIDGE_REFS);
    const phone = await FieldCrypto.decrypt(
      refs.shared_fields.phone.ciphertext,
      refs.shared_fields.phone.iv,
      refs.shared_fields.phone.key
    );
    expect(phone).toBe('555-0200');
  });

  it('revoke field sharing — remove field from bridge refs', async () => {
    const bridgeRoomId = await svc.createRoom('Bridge', 'bridge');
    const providerKey = await FieldCrypto.generateKey();

    // Share two fields
    const enc1 = await FieldCrypto.encrypt('Alice', providerKey);
    const enc2 = await FieldCrypto.encrypt('555-0100', providerKey);
    await svc.setState(bridgeRoomId, EVT.BRIDGE_REFS, {
      shared_fields: {
        full_name: { ciphertext: enc1.ciphertext, iv: enc1.iv, key: providerKey },
        phone: { ciphertext: enc2.ciphertext, iv: enc2.iv, key: providerKey },
      },
    });

    // Revoke phone — re-write refs without it
    const refs = await svc.getState(bridgeRoomId, EVT.BRIDGE_REFS);
    delete refs.shared_fields.phone;
    await svc.setState(bridgeRoomId, EVT.BRIDGE_REFS, refs);

    // Verify phone is gone
    const updated = await svc.getState(bridgeRoomId, EVT.BRIDGE_REFS);
    expect(updated.shared_fields.full_name).toBeDefined();
    expect(updated.shared_fields.phone).toBeUndefined();
  });
});

/* ════════════════════════════════════════════════════════════════════════════
 * 2. CRM PROFILE FIELD MANAGEMENT
 * ════════════════════════════════════════════════════════════════════════════ */

// CRM_PROFILE_SECTIONS and CRM_STANDARD_KEYS live in data.js which requires
// React/DOM. We define them here from the same source data to test the schema.
const TEST_CRM_PROFILE_SECTIONS = [
  { id: 'case_management', label: 'Case Management', fields: [
    { key: 'intake_date', label: 'Intake Date', data_type: 'date', source: 'crm', required: true },
    { key: 'status', label: 'Case Status', data_type: 'single_select', source: 'crm', required: true, options: ['active', 'pending', 'inactive', 'closed', 'waitlist'] },
    { key: 'assigned_to', label: 'Assigned Case Manager', data_type: 'text', source: 'crm' },
    { key: 'referral_source', label: 'Referral Source', data_type: 'text', source: 'crm' },
    { key: 'priority', label: 'Priority', data_type: 'single_select', source: 'crm', options: ['urgent', 'high', 'medium', 'low'] },
    { key: 'program', label: 'Program / Service', data_type: 'text', source: 'crm' },
  ]},
  { id: 'identity', label: 'Identity', fields: [
    { key: 'full_name', label: 'Full Name', data_type: 'text', source: 'vault' },
    { key: 'dob', label: 'Date of Birth', data_type: 'date', source: 'vault', sensitive: true },
    { key: 'id_number', label: 'ID Number', data_type: 'text', source: 'vault', sensitive: true },
  ]},
  { id: 'contact', label: 'Contact', fields: [
    { key: 'email', label: 'Email', data_type: 'email', source: 'vault' },
    { key: 'phone', label: 'Phone', data_type: 'phone', source: 'vault' },
    { key: 'address', label: 'Address', data_type: 'text', source: 'vault', sensitive: true },
    { key: 'fhir_emergency_contact', label: 'Emergency Contact', data_type: 'text', source: 'vault', sensitive: true },
  ]},
  { id: 'demographics', label: 'Demographics', fields: [
    { key: 'gender_identity', label: 'Gender Identity', data_type: 'text', source: 'crm', sensitive: true },
    { key: 'race_ethnicity', label: 'Race / Ethnicity', data_type: 'multi_select', source: 'crm', sensitive: true, options: ['American Indian or Alaska Native', 'Asian', 'Black or African American', 'Hispanic or Latino', 'Native Hawaiian or Pacific Islander', 'White', 'Multiracial', 'Other', 'Unknown', 'Prefer not to say'] },
    { key: 'veteran_status', label: 'Veteran Status', data_type: 'single_select', source: 'crm', options: ['Yes', 'No', 'Unknown'] },
    { key: 'household_size', label: 'Household Size', data_type: 'number', source: 'crm' },
    { key: 'disability', label: 'Disability Status', data_type: 'multi_select', source: 'crm', sensitive: true, options: ['Physical', 'Cognitive', 'Mental Health', 'Substance Use Disorder', 'Chronic Health Condition', 'None', 'Unknown', 'Prefer not to say'] },
    { key: 'income_source', label: 'Primary Income Source', data_type: 'multi_select', source: 'crm', options: ['Employment', 'SSI', 'SSDI', 'TANF', 'General Assistance', 'VA Benefits', 'Child Support', 'No Income', 'Other', 'Unknown'] },
  ]},
  { id: 'housing', label: 'Housing', fields: [
    { key: 'housing_status', label: 'Housing Status', data_type: 'single_select', source: 'crm', options: ['Unsheltered', 'Emergency Shelter', 'Safe Haven', 'Transitional Housing', 'Doubled Up', 'Hotel or Motel', 'Permanent Housing', 'Unknown'] },
    { key: 'chronic_homeless', label: 'Chronic Homelessness', data_type: 'single_select', source: 'crm', options: ['Yes', 'No', 'Unknown'] },
    { key: 'living_situation', label: 'Living Situation Detail', data_type: 'text', source: 'crm' },
  ]},
  { id: 'case_tracking', label: 'Case Tracking', fields: [
    { key: 'presenting_situation', label: 'Presenting Situation', data_type: 'text_long', source: 'crm' },
    { key: 'goals', label: 'Goals', data_type: 'text_long', source: 'crm' },
    { key: 'barriers', label: 'Barriers', data_type: 'text_long', source: 'crm' },
    { key: 'last_contact_date', label: 'Last Contact Date', data_type: 'date', source: 'crm' },
    { key: 'next_appointment', label: 'Next Appointment', data_type: 'date', source: 'crm' },
  ]},
  { id: 'exit_outcome', label: 'Exit & Outcome', fields: [
    { key: 'exit_date', label: 'Exit Date', data_type: 'date', source: 'crm' },
    { key: 'exit_destination', label: 'Exit Destination', data_type: 'single_select', source: 'crm', options: ['Permanent Housing', 'Transitional Housing', 'Family or Friends', 'Emergency Shelter', 'Another Provider', 'Institutional Setting', 'No Contact / Left', 'Deceased', 'Unknown', 'Other'] },
    { key: 'outcome', label: 'Outcome Notes', data_type: 'text_long', source: 'crm' },
  ]},
  { id: 'details', label: 'Details', fields: [
    { key: 'affiliation', label: 'Organization / Affiliation', data_type: 'text', source: 'vault' },
    { key: 'case_notes', label: 'Case Notes', data_type: 'text_long', source: 'vault' },
    { key: 'documents', label: 'Documents', data_type: 'text', source: 'vault', sensitive: true },
    { key: 'history', label: 'Case History', data_type: 'text_long', source: 'vault' },
  ]},
  { id: 'sensitive', label: 'Sensitive', fields: [
    { key: 'restricted_notes', label: 'Restricted Notes', data_type: 'text_long', source: 'vault', sensitive: true },
  ]},
];
const TEST_CRM_STANDARD_KEYS = new Set(TEST_CRM_PROFILE_SECTIONS.flatMap(s => s.fields.map(f => f.key)));

describe('CRM Profile Field Management', () => {
  let mockClient;

  beforeEach(() => {
    mockClient = new MockMatrixClient();
    KhoraAuth._client = mockClient;
    KhoraAuth._userId = '@provider:test.local';
    globalThis.svc = new KhoraService();
  });

  it('CRM profile schema contains all required sections', () => {
    const sectionIds = TEST_CRM_PROFILE_SECTIONS.map(s => s.id);
    expect(sectionIds).toContain('case_management');
    expect(sectionIds).toContain('identity');
    expect(sectionIds).toContain('contact');
    expect(sectionIds).toContain('demographics');
    expect(sectionIds).toContain('housing');
    expect(sectionIds).toContain('case_tracking');
    expect(sectionIds).toContain('exit_outcome');
    expect(sectionIds).toContain('details');
    expect(sectionIds).toContain('sensitive');
  });

  it('case management fields have correct data types', () => {
    const cm = TEST_CRM_PROFILE_SECTIONS.find(s => s.id === 'case_management');
    expect(cm).toBeDefined();

    const status = cm.fields.find(f => f.key === 'status');
    expect(status.data_type).toBe('single_select');
    expect(status.options).toContain('active');
    expect(status.options).toContain('closed');
    expect(status.required).toBe(true);

    const intake = cm.fields.find(f => f.key === 'intake_date');
    expect(intake.data_type).toBe('date');
    expect(intake.required).toBe(true);

    const priority = cm.fields.find(f => f.key === 'priority');
    expect(priority.options).toEqual(['urgent', 'high', 'medium', 'low']);
  });

  it('sensitive fields are correctly marked', () => {
    const allFields = TEST_CRM_PROFILE_SECTIONS.flatMap(s => s.fields);
    const sensitiveFields = allFields.filter(f => f.sensitive);

    const sensitiveKeys = sensitiveFields.map(f => f.key);
    expect(sensitiveKeys).toContain('dob');
    expect(sensitiveKeys).toContain('id_number');
    expect(sensitiveKeys).toContain('address');
    expect(sensitiveKeys).toContain('restricted_notes');
  });

  it('save and retrieve CRM fields via vault snapshot', async () => {
    const roomId = await svc.createRoom('Vault', 'vault');

    const snapshot = {
      fields: {
        full_name: 'Alice Johnson',
        status: 'active',
        intake_date: '2024-03-15',
        priority: 'high',
        assigned_to: 'Dr. Smith',
        housing_status: 'Emergency Shelter',
        goals: 'Find permanent housing within 90 days',
      },
      last_modified_by: '@provider:test.local',
      last_modified_at: Date.now(),
    };

    await svc.setState(roomId, EVT.VAULT_SNAPSHOT, snapshot);
    const saved = await svc.getState(roomId, EVT.VAULT_SNAPSHOT);

    expect(saved.fields.status).toBe('active');
    expect(saved.fields.priority).toBe('high');
    expect(saved.fields.housing_status).toBe('Emergency Shelter');
    expect(saved.fields.goals).toBe('Find permanent housing within 90 days');
  });

  it('update individual CRM fields without overwriting others', async () => {
    const roomId = await svc.createRoom('Vault', 'vault');

    // Initial save with multiple fields
    const initial = {
      fields: {
        full_name: 'Alice Johnson',
        status: 'active',
        priority: 'medium',
        intake_date: '2024-03-15',
      },
      last_modified_at: Date.now(),
    };
    await svc.setState(roomId, EVT.VAULT_SNAPSHOT, initial);

    // Update priority only
    const current = await svc.getState(roomId, EVT.VAULT_SNAPSHOT);
    current.fields.priority = 'urgent';
    current.last_modified_at = Date.now();
    await svc.setState(roomId, EVT.VAULT_SNAPSHOT, current);

    const result = await svc.getState(roomId, EVT.VAULT_SNAPSHOT);
    expect(result.fields.full_name).toBe('Alice Johnson');
    expect(result.fields.status).toBe('active');
    expect(result.fields.priority).toBe('urgent');
    expect(result.fields.intake_date).toBe('2024-03-15');
  });

  it('standard CRM field keys are recognized', () => {
    expect(TEST_CRM_STANDARD_KEYS.has('status')).toBe(true);
    expect(TEST_CRM_STANDARD_KEYS.has('intake_date')).toBe(true);
    expect(TEST_CRM_STANDARD_KEYS.has('full_name')).toBe(true);
    expect(TEST_CRM_STANDARD_KEYS.has('housing_status')).toBe(true);
    expect(TEST_CRM_STANDARD_KEYS.has('exit_date')).toBe(true);
    expect(TEST_CRM_STANDARD_KEYS.has('restricted_notes')).toBe(true);

    // Custom fields should NOT be in the standard set
    expect(TEST_CRM_STANDARD_KEYS.has('custom_field_xyz')).toBe(false);
  });

  it('emit EO operation when updating a CRM field', async () => {
    const roomId = await svc.createRoom('Bridge', 'bridge');

    const op = await emitOp(roomId, 'ALT', dot('org', 'individuals', 'status'), {
      from: 'pending',
      to: 'active',
      edit_source: 'profile_edit',
    }, {
      type: 'org',
      epistemic: 'MEANT',
      role: 'provider',
    });

    expect(op).toBeDefined();
    expect(op.op).toBe('ALT');
    expect(op.operand.from).toBe('pending');
    expect(op.operand.to).toBe('active');
    expect(op.frame.type).toBe('org');
  });

  it('demographics fields support multi_select data types', () => {
    const demo = TEST_CRM_PROFILE_SECTIONS.find(s => s.id === 'demographics');
    const raceField = demo.fields.find(f => f.key === 'race_ethnicity');
    expect(raceField.data_type).toBe('multi_select');
    expect(raceField.options.length).toBeGreaterThan(5);
    expect(raceField.sensitive).toBe(true);

    const disabilityField = demo.fields.find(f => f.key === 'disability');
    expect(disabilityField.data_type).toBe('multi_select');
  });
});

/* ════════════════════════════════════════════════════════════════════════════
 * 3. ORGANIZATION ROSTER & TEAM MANAGEMENT
 * ════════════════════════════════════════════════════════════════════════════ */
describe('Organization Roster & Team Management', () => {
  let mockClient;

  beforeEach(() => {
    mockClient = new MockMatrixClient();
    KhoraAuth._client = mockClient;
    KhoraAuth._userId = '@admin:test.local';
    globalThis.svc = new KhoraService();
  });

  it('create org room with roster and metadata', async () => {
    const orgRoomId = await svc.createRoom('Metro Services', 'Organization', [
      {
        type: EVT.IDENTITY,
        state_key: '',
        content: { account_type: 'organization', owner: '@admin:test.local' },
      },
      {
        type: EVT.ORG_METADATA,
        state_key: '',
        content: { name: 'Metro Services', type: 'direct_service', service_area: 'Housing' },
      },
      {
        type: EVT.ORG_ROSTER,
        state_key: '',
        content: {
          staff: [
            { userId: '@admin:test.local', role: 'admin', display_name: 'Admin User' },
            { userId: '@case_mgr:test.local', role: 'case_manager', display_name: 'Case Manager' },
            { userId: '@field:test.local', role: 'field_worker', display_name: 'Field Worker' },
          ],
        },
      },
    ]);

    const identity = await svc.getState(orgRoomId, EVT.IDENTITY);
    expect(identity.account_type).toBe('organization');

    const roster = await svc.getState(orgRoomId, EVT.ORG_ROSTER);
    expect(roster.staff).toHaveLength(3);
    expect(roster.staff[0].role).toBe('admin');
    expect(roster.staff[1].role).toBe('case_manager');
  });

  it('add staff member to roster', async () => {
    const orgRoomId = await svc.createRoom('Org', 'Organization');
    await svc.setState(orgRoomId, EVT.ORG_ROSTER, {
      staff: [{ userId: '@admin:test.local', role: 'admin', display_name: 'Admin' }],
    });

    // Add new staff
    const roster = await svc.getState(orgRoomId, EVT.ORG_ROSTER);
    roster.staff.push({
      userId: '@newstaff:test.local',
      role: 'provider',
      display_name: 'New Staff',
    });
    await svc.setState(orgRoomId, EVT.ORG_ROSTER, roster);

    const updated = await svc.getState(orgRoomId, EVT.ORG_ROSTER);
    expect(updated.staff).toHaveLength(2);
    expect(updated.staff[1].userId).toBe('@newstaff:test.local');
  });

  it('case assignment — assign individual to staff member', async () => {
    const orgRoomId = await svc.createRoom('Org', 'Organization');

    const assignments = {
      '!bridge1:test.local': {
        primary: '@case_mgr:test.local',
        staff: ['@case_mgr:test.local'],
        client_name: 'Alice Johnson',
        transferable: true,
        added: Date.now(),
      },
      '!bridge2:test.local': {
        primary: '@field:test.local',
        staff: ['@field:test.local'],
        client_name: 'Bob Smith',
        transferable: true,
        added: Date.now(),
      },
    };

    await svc.setState(orgRoomId, EVT.ROSTER_ASSIGN, { assignments });

    const saved = await svc.getState(orgRoomId, EVT.ROSTER_ASSIGN);
    expect(Object.keys(saved.assignments)).toHaveLength(2);
    expect(saved.assignments['!bridge1:test.local'].primary).toBe('@case_mgr:test.local');
    expect(saved.assignments['!bridge2:test.local'].client_name).toBe('Bob Smith');
  });

  it('reassign case — transfer from one staff to another', async () => {
    const orgRoomId = await svc.createRoom('Org', 'Organization');

    // Initial assignment
    await svc.setState(orgRoomId, EVT.ROSTER_ASSIGN, {
      assignments: {
        '!bridge1:test.local': {
          primary: '@old_cm:test.local',
          staff: ['@old_cm:test.local'],
          client_name: 'Alice',
        },
      },
    });

    // Transfer to new case manager
    const current = await svc.getState(orgRoomId, EVT.ROSTER_ASSIGN);
    current.assignments['!bridge1:test.local'].primary = '@new_cm:test.local';
    current.assignments['!bridge1:test.local'].staff = ['@new_cm:test.local', '@old_cm:test.local'];
    await svc.setState(orgRoomId, EVT.ROSTER_ASSIGN, current);

    const result = await svc.getState(orgRoomId, EVT.ROSTER_ASSIGN);
    expect(result.assignments['!bridge1:test.local'].primary).toBe('@new_cm:test.local');
    expect(result.assignments['!bridge1:test.local'].staff).toContain('@old_cm:test.local');
  });

  it('create team with members and schema', async () => {
    const teamRoomId = await svc.createRoom('Housing Team', 'Team room');

    await svc.setState(teamRoomId, EVT.TEAM_META, {
      name: 'Housing Outreach',
      description: 'Field housing assessment team',
      created_by: '@admin:test.local',
      created_at: Date.now(),
    });

    await svc.setState(teamRoomId, EVT.TEAM_MEMBERS, {
      members: [
        { userId: '@cm1:test.local', role: 'lead', joined: Date.now() },
        { userId: '@cm2:test.local', role: 'member', joined: Date.now() },
      ],
    });

    // Team-specific schema
    await svc.setState(teamRoomId, EVT.TEAM_SCHEMA, {
      form_ids: ['form_housing_stability'],
      visible_fields: ['housing_status', 'chronic_homeless', 'living_situation'],
    });

    const meta = await svc.getState(teamRoomId, EVT.TEAM_META);
    expect(meta.name).toBe('Housing Outreach');

    const members = await svc.getState(teamRoomId, EVT.TEAM_MEMBERS);
    expect(members.members).toHaveLength(2);
    expect(members.members[0].role).toBe('lead');

    const schema = await svc.getState(teamRoomId, EVT.TEAM_SCHEMA);
    expect(schema.visible_fields).toContain('housing_status');
  });

  it('org terminology customization', async () => {
    const orgRoomId = await svc.createRoom('Org', 'Organization');

    await svc.setState(orgRoomId, EVT.ORG_TERMINOLOGY, {
      individual_term: 'Participant',
      individuals_term: 'Participants',
      staff_term: 'Advocate',
      case_term: 'Enrollment',
    });

    const terms = await svc.getState(orgRoomId, EVT.ORG_TERMINOLOGY);
    expect(terms.individual_term).toBe('Participant');
    expect(terms.staff_term).toBe('Advocate');
  });

  it('role inference detects org admin from roster', () => {
    const scanned = {
      '!org:test.local': {
        [EVT.IDENTITY]: { account_type: 'organization' },
        [EVT.ORG_ROSTER]: {
          staff: [
            { userId: '@admin:test.local', role: 'admin' },
            { userId: '@cm:test.local', role: 'case_manager' },
          ],
        },
      },
    };

    const adminRoles = inferRolesFromRooms(scanned, '@admin:test.local');
    expect(adminRoles).toContain('org_admin');
    expect(adminRoles).toContain('provider');

    const cmRoles = inferRolesFromRooms(scanned, '@cm:test.local');
    expect(cmRoles).toContain('provider');
    expect(cmRoles).not.toContain('org_admin');
  });
});

/* ════════════════════════════════════════════════════════════════════════════
 * 4. NOTES CREATION & MANAGEMENT
 * ════════════════════════════════════════════════════════════════════════════ */
describe('Notes Creation & Management', () => {
  let mockClient;

  beforeEach(() => {
    mockClient = new MockMatrixClient();
    KhoraAuth._client = mockClient;
    KhoraAuth._userId = '@provider:test.local';
    globalThis.svc = new KhoraService();
  });

  it('create a shared note attached to an individual', async () => {
    const orgRoomId = await svc.createRoom('Org', 'org');
    const noteId = `note_${Date.now()}`;

    const noteContent = {
      id: noteId,
      type: 'shared',
      title: 'Initial Assessment',
      content: 'Client presented with housing instability. Referred to shelter program.',
      created_by: '@provider:test.local',
      created_at: Date.now(),
      indId: '!bridge1:test.local',
      tags: [{ userId: '@cm:test.local', displayName: 'Case Manager' }],
    };

    await svc.setState(orgRoomId, EVT.NOTE, noteContent, noteId);

    const saved = await svc.getState(orgRoomId, EVT.NOTE, noteId);
    expect(saved.title).toBe('Initial Assessment');
    expect(saved.content).toContain('housing instability');
    expect(saved.type).toBe('shared');
    expect(saved.tags).toHaveLength(1);
    expect(saved.indId).toBe('!bridge1:test.local');
  });

  it('create an internal (staff-only) note', async () => {
    const orgRoomId = await svc.createRoom('Org', 'org');
    const noteId = `note_${Date.now()}`;

    await svc.setState(orgRoomId, EVT.NOTE, {
      id: noteId,
      type: 'internal',
      title: 'Staff Discussion',
      content: 'Need to coordinate with legal aid for documentation assistance.',
      created_by: '@provider:test.local',
      created_at: Date.now(),
    }, noteId);

    const saved = await svc.getState(orgRoomId, EVT.NOTE, noteId);
    expect(saved.type).toBe('internal');
    expect(saved.title).toBe('Staff Discussion');
  });

  it('edit a note — preserves edit history', async () => {
    const orgRoomId = await svc.createRoom('Org', 'org');
    const noteId = `note_${Date.now()}`;

    // Create original note
    await svc.setState(orgRoomId, EVT.NOTE, {
      id: noteId,
      title: 'Case Note',
      content: 'Original content',
      created_by: '@provider:test.local',
      created_at: Date.now(),
      edit_history: [],
    }, noteId);

    // Edit the note
    const note = await svc.getState(orgRoomId, EVT.NOTE, noteId);
    const editEntry = {
      prev_title: note.title,
      prev_content: note.content,
      edited_by: '@provider:test.local',
      edited_at: Date.now(),
    };
    note.title = 'Updated Case Note';
    note.content = 'Updated content with more details';
    note.edit_history = [...(note.edit_history || []), editEntry];
    note.last_edited_by = '@provider:test.local';

    await svc.setState(orgRoomId, EVT.NOTE, note, noteId);

    // Emit EO edit operation
    await svc.setState(orgRoomId, EVT.NOTE_EDIT, {
      note_id: noteId,
      title: 'Updated Case Note',
      content: 'Updated content with more details',
      prev_title: 'Case Note',
      prev_content: 'Original content',
      edited_by: '@provider:test.local',
      edited_at: Date.now(),
    }, noteId);

    const saved = await svc.getState(orgRoomId, EVT.NOTE, noteId);
    expect(saved.title).toBe('Updated Case Note');
    expect(saved.edit_history).toHaveLength(1);
    expect(saved.edit_history[0].prev_content).toBe('Original content');

    const editRecord = await svc.getState(orgRoomId, EVT.NOTE_EDIT, noteId);
    expect(editRecord.prev_title).toBe('Case Note');
  });

  it('create a bridge-level note (attached to client room)', async () => {
    const bridgeRoomId = await svc.createRoom('Bridge', 'bridge');
    const orgRoomId = await svc.createRoom('Org', 'org');
    const noteId = `note_${Date.now()}`;

    // Create note that references the bridge room
    await svc.setState(orgRoomId, EVT.NOTE, {
      id: noteId,
      type: 'shared',
      title: 'Follow-up Required',
      content: 'Schedule housing inspection by end of week.',
      created_by: '@provider:test.local',
      created_at: Date.now(),
      bridgeRoomId: bridgeRoomId,
    }, noteId);

    // Also write a reference in the bridge room
    await svc.setState(bridgeRoomId, EVT.NOTE_REF, {
      note_id: noteId,
      org_room: orgRoomId,
      created_at: Date.now(),
    }, noteId);

    const noteRef = await svc.getState(bridgeRoomId, EVT.NOTE_REF, noteId);
    expect(noteRef.note_id).toBe(noteId);
    expect(noteRef.org_room).toBe(orgRoomId);
  });
});

/* ════════════════════════════════════════════════════════════════════════════
 * 5. RESOURCE ALLOCATION WORKFLOW
 * ════════════════════════════════════════════════════════════════════════════ */
describe('Resource Allocation Workflow', () => {
  let mockClient;
  let orgRoomId;

  beforeEach(async () => {
    mockClient = new MockMatrixClient();
    KhoraAuth._client = mockClient;
    KhoraAuth._userId = '@provider:test.local';
    globalThis.svc = new KhoraService();

    // Set up org room with roster
    orgRoomId = await svc.createRoom('Org', 'Organization');
    await svc.setState(orgRoomId, EVT.ORG_ROSTER, {
      staff: [
        { userId: '@provider:test.local', role: 'case_manager' },
        { userId: '@admin:test.local', role: 'admin' },
      ],
    });
  });

  it('create a resource type in the org catalog', async () => {
    const rt = await ResourceService.createResourceType(orgRoomId, {
      name: 'Emergency Shelter Bed',
      category: 'housing',
      unit: 'bed-night',
      fungible: true,
      perishable: true,
      ttl_days: 1,
    }, 'org');

    expect(rt.id).toMatch(/^rtype_/);
    expect(rt.name).toBe('Emergency Shelter Bed');
    expect(rt.category).toBe('housing');
    expect(rt.unit).toBe('bed-night');
    expect(rt.fungible).toBe(true);
    expect(rt.perishable).toBe(true);

    // Verify persisted to room state
    const saved = await svc.getState(orgRoomId, EVT.RESOURCE_TYPE, rt.id);
    expect(saved.name).toBe('Emergency Shelter Bed');
  });

  it('create resource type → establish relation → restock inventory', async () => {
    const rt = await ResourceService.createResourceType(orgRoomId, {
      name: 'Bus Pass',
      category: 'transportation',
      unit: 'pass',
    }, 'org');

    // Establish org's relation to this resource
    const relation = await ResourceService.establishRelation(orgRoomId, {
      resource_type_id: rt.id,
      relation_type: 'operates',
      capacity: 50,
    });

    expect(relation.id).toMatch(/^rrel_/);
    expect(relation.capacity).toBe(50);
    expect(relation.available).toBe(50);

    // Verify inventory was initialized
    const inv = await svc.getState(orgRoomId, EVT.RESOURCE_INVENTORY, relation.id);
    expect(inv.total_capacity).toBe(50);
    expect(inv.available).toBe(50);
    expect(inv.allocated).toBe(0);

    // Restock
    const updated = await ResourceService.restockInventory(orgRoomId, relation.id, 25, { reason: 'Monthly restock' });
    expect(updated.total_capacity).toBe(75);
    expect(updated.available).toBe(75);
  });

  it('allocate resource to client → inventory decrements', async () => {
    // Set up resource
    const rt = await ResourceService.createResourceType(orgRoomId, {
      name: 'Grocery Card',
      category: 'food',
      unit: 'card',
    }, 'org');

    const relation = await ResourceService.establishRelation(orgRoomId, {
      resource_type_id: rt.id,
      relation_type: 'operates',
      capacity: 20,
    });

    // Create bridge and vault rooms
    const bridgeRoomId = await svc.createRoom('Bridge', 'bridge');
    const vaultRoomId = await svc.createRoom('Vault', 'vault');

    // Allocate 3 cards
    const result = await ResourceService.allocateResource(bridgeRoomId, {
      resource_type_id: rt.id,
      relation_id: relation.id,
      quantity: 3,
      allocated_to: '@client:test.local',
    }, orgRoomId, vaultRoomId);

    expect(result.valid).toBe(true);
    expect(result.allocation.quantity).toBe(3);
    expect(result.allocation.status).toBe('active');

    // Verify inventory decremented
    const inv = await svc.getState(orgRoomId, EVT.RESOURCE_INVENTORY, relation.id);
    expect(inv.available).toBe(17);
    expect(inv.allocated).toBe(3);

    // Verify vault shadow record
    const vaultRecord = await svc.getState(vaultRoomId, EVT.RESOURCE_VAULT, result.allocation.id);
    expect(vaultRecord.resource_name).toBe('Grocery Card');
    expect(vaultRecord.quantity).toBe(3);
    expect(vaultRecord.status).toBe('active');
  });

  it('reject allocation when resource category is invalid', async () => {
    await expect(ResourceService.createResourceType(orgRoomId, {
      name: 'Invalid Resource',
      category: 'nonexistent_category',
      unit: 'item',
    }, 'org')).rejects.toThrow('Invalid resource category');
  });

  it('permission check — case manager can allocate, field worker cannot', () => {
    const rt = {
      permissions: {
        controllers: [{ type: 'role', id: 'admin' }],
        allocators: [{ type: 'role', id: 'admin' }, { type: 'role', id: 'case_manager' }],
        viewers: [],
      },
    };

    expect(canAllocateResource(rt, '@cm:test', 'case_manager')).toBe(true);
    expect(canAllocateResource(rt, '@admin:test', 'admin')).toBe(true);
    expect(canAllocateResource(rt, '@fw:test', 'field_worker')).toBe(false);
    expect(canControlResource(rt, '@admin:test', 'admin')).toBe(true);
    expect(canControlResource(rt, '@cm:test', 'case_manager')).toBe(false);
  });

  it('constraint validation — max_per_client limit', () => {
    const resourceType = {
      id: 'rt_1',
      name: 'Bus Pass',
      constraints: { max_per_client: 2, period_days: 30 },
    };

    // First allocation should pass
    const result1 = validateAllocation(
      { resource_type_id: 'rt_1', quantity: 1, allocated_to: '@c:test' },
      resourceType, [], [], 'admin'
    );
    expect(result1.valid).toBe(true);

    // Third allocation for same client should fail
    const existing = [
      { resource_type_id: 'rt_1', allocated_to: '@c:test', status: 'active', allocated_at: Date.now() },
      { resource_type_id: 'rt_1', allocated_to: '@c:test', status: 'active', allocated_at: Date.now() },
    ];
    const result2 = validateAllocation(
      { resource_type_id: 'rt_1', quantity: 1, allocated_to: '@c:test' },
      resourceType, [], existing, 'admin'
    );
    expect(result2.valid).toBe(false);
    expect(result2.violations[0].check).toBe('max_per_client');
  });

  it('adjust inventory — manual correction', async () => {
    const rt = await ResourceService.createResourceType(orgRoomId, {
      name: 'Hygiene Kit',
      category: 'health',
      unit: 'kit',
    }, 'org');

    const relation = await ResourceService.establishRelation(orgRoomId, {
      resource_type_id: rt.id,
      relation_type: 'operates',
      capacity: 100,
    });

    // Adjust down (expired stock)
    const adjusted = await ResourceService.adjustInventory(orgRoomId, relation.id, -10, 'Expired kits removed');
    expect(adjusted.available).toBe(90);
    expect(adjusted.total_capacity).toBe(90);
  });

  it('opacity controls on resource relations', async () => {
    const rt = await ResourceService.createResourceType(orgRoomId, {
      name: 'Housing Voucher',
      category: 'housing',
      unit: 'voucher',
    }, 'org');

    const relation = await ResourceService.establishRelation(orgRoomId, {
      resource_type_id: rt.id,
      relation_type: 'operates',
      capacity: 10,
    });

    // Default should be SOVEREIGN
    expect(relation.opacity).toBe(RESOURCE_OPACITY.SOVEREIGN);

    // Upgrade to ATTESTED
    const updated = await ResourceService.updateRelationOpacity(
      orgRoomId, relation.id, RESOURCE_OPACITY.ATTESTED,
      null, ['!bridge1:test', '!bridge2:test']
    );
    expect(updated.opacity).toBe(RESOURCE_OPACITY.ATTESTED);
    expect(updated.attested_to).toEqual(['!bridge1:test', '!bridge2:test']);

    // Verify opacity state event
    const opacityState = await svc.getState(orgRoomId, EVT.RESOURCE_OPACITY, relation.id);
    expect(opacityState.opacity).toBe(RESOURCE_OPACITY.ATTESTED);
    expect(opacityState.previous_opacity).toBe(RESOURCE_OPACITY.SOVEREIGN);
  });
});

/* ════════════════════════════════════════════════════════════════════════════
 * 6. SEARCH, FILTER, AND BULK OPERATIONS
 * ════════════════════════════════════════════════════════════════════════════ */
describe('Search, Filter, and Bulk Operations', () => {
  let mockClient;

  beforeEach(() => {
    mockClient = new MockMatrixClient();
    KhoraAuth._client = mockClient;
    KhoraAuth._userId = '@provider:test.local';
    globalThis.svc = new KhoraService();
  });

  it('scan rooms classifies different room types correctly', async () => {
    // Create various room types
    const vaultRoom = await svc.createRoom('Vault', 'vault', [
      { type: EVT.IDENTITY, state_key: '', content: { account_type: 'client', owner: '@alice:test' } },
    ]);
    const bridgeRoom = await svc.createRoom('Bridge', 'bridge', [
      { type: EVT.IDENTITY, state_key: '', content: { account_type: 'bridge' } },
      { type: EVT.BRIDGE_META, state_key: '', content: { client: '@alice:test', provider: '@provider:test.local' } },
    ]);
    const orgRoom = await svc.createRoom('Org', 'org', [
      { type: EVT.IDENTITY, state_key: '', content: { account_type: 'organization' } },
    ]);

    const scanned = await svc.scanRooms([]);

    // All rooms should appear in scan with their identity events
    expect(scanned[vaultRoom][EVT.IDENTITY].account_type).toBe('client');
    expect(scanned[bridgeRoom][EVT.IDENTITY].account_type).toBe('bridge');
    expect(scanned[bridgeRoom][EVT.BRIDGE_META].client).toBe('@alice:test');
    expect(scanned[orgRoom][EVT.IDENTITY].account_type).toBe('organization');
  });

  it('trash and restore individual', async () => {
    const orgRoomId = await svc.createRoom('Org', 'org');

    // Move individual to trash
    const trashState = {
      '!bridge1:test.local': {
        deletedBy: '@provider:test.local',
        deletedAt: Date.now(),
        name: 'Alice Johnson',
      },
    };
    await svc.setState(orgRoomId, EVT.ORG_TRASH, trashState);

    let trash = await svc.getState(orgRoomId, EVT.ORG_TRASH);
    expect(trash['!bridge1:test.local']).toBeDefined();
    expect(trash['!bridge1:test.local'].name).toBe('Alice Johnson');

    // Restore from trash
    delete trash['!bridge1:test.local'];
    await svc.setState(orgRoomId, EVT.ORG_TRASH, trash);

    trash = await svc.getState(orgRoomId, EVT.ORG_TRASH);
    expect(trash['!bridge1:test.local']).toBeUndefined();
  });

  it('bulk trash multiple individuals', async () => {
    const orgRoomId = await svc.createRoom('Org', 'org');
    const bridgeIds = ['!b1:test', '!b2:test', '!b3:test'];

    // Bulk trash
    const trashState = {};
    for (const id of bridgeIds) {
      trashState[id] = {
        deletedBy: '@provider:test.local',
        deletedAt: Date.now(),
        name: `Client for ${id}`,
      };
    }
    await svc.setState(orgRoomId, EVT.ORG_TRASH, trashState);

    const trash = await svc.getState(orgRoomId, EVT.ORG_TRASH);
    expect(Object.keys(trash)).toHaveLength(3);

    // Restore one
    delete trash['!b2:test'];
    await svc.setState(orgRoomId, EVT.ORG_TRASH, trash);

    const updated = await svc.getState(orgRoomId, EVT.ORG_TRASH);
    expect(Object.keys(updated)).toHaveLength(2);
    expect(updated['!b2:test']).toBeUndefined();
  });

  it('bulk assign cases to staff member', async () => {
    const orgRoomId = await svc.createRoom('Org', 'org');

    const assignments = {};
    const bridgeIds = ['!b1:test', '!b2:test', '!b3:test'];
    for (const id of bridgeIds) {
      assignments[id] = {
        primary: '@old_cm:test.local',
        staff: ['@old_cm:test.local'],
        client_name: `Client ${id}`,
      };
    }
    await svc.setState(orgRoomId, EVT.ROSTER_ASSIGN, { assignments });

    // Bulk reassign first two to new case manager
    const current = await svc.getState(orgRoomId, EVT.ROSTER_ASSIGN);
    for (const id of ['!b1:test', '!b2:test']) {
      current.assignments[id].primary = '@new_cm:test.local';
      current.assignments[id].staff = ['@new_cm:test.local'];
    }
    await svc.setState(orgRoomId, EVT.ROSTER_ASSIGN, current);

    const result = await svc.getState(orgRoomId, EVT.ROSTER_ASSIGN);
    expect(result.assignments['!b1:test'].primary).toBe('@new_cm:test.local');
    expect(result.assignments['!b2:test'].primary).toBe('@new_cm:test.local');
    expect(result.assignments['!b3:test'].primary).toBe('@old_cm:test.local');
  });

  it('EO operations for trash and restore emit correct operators', async () => {
    const roomId = await svc.createRoom('Bridge', 'bridge');

    // Trash: NUL operation
    const trashOp = await emitOp(roomId, 'NUL', dot('org', 'individuals', roomId), {
      from: 'active',
      to: 'deleted',
      reason: 'user_deleted',
    }, { type: 'org', epistemic: 'MEANT', role: 'provider' });

    expect(trashOp.op).toBe('NUL');
    expect(trashOp.operand.reason).toBe('user_deleted');

    // Restore: INS operation
    const restoreOp = await emitOp(roomId, 'INS', dot('org', 'individuals', roomId), {
      from: 'deleted',
      to: 'active',
      reason: 'user_restored',
    }, { type: 'org', epistemic: 'MEANT', role: 'provider' });

    expect(restoreOp.op).toBe('INS');
    expect(restoreOp.operand.reason).toBe('user_restored');
  });
});

/* ════════════════════════════════════════════════════════════════════════════
 * 7. RECORD MERGE & DEDUPLICATION
 * ════════════════════════════════════════════════════════════════════════════ */
describe('Record Merge & Deduplication', () => {
  let mockClient;

  beforeEach(() => {
    mockClient = new MockMatrixClient();
    KhoraAuth._client = mockClient;
    KhoraAuth._userId = '@provider:test.local';
    globalThis.svc = new KhoraService();
  });

  it('compare two records — detect conflicts and matches', () => {
    const recordA = {
      roomId: '!a:test',
      name: 'Alice Johnson',
      fields: { full_name: 'Alice Johnson', phone: '555-0100', email: 'alice@example.com', dob: '1990-01-15' },
      ts: 1000,
    };
    const recordB = {
      roomId: '!b:test',
      name: 'Alice J.',
      fields: { full_name: 'Alice J.', phone: '555-0100', status: 'active' },
      ts: 2000,
    };

    const comparison = DatabaseMergeService.compareRecords(recordA, recordB);

    expect(comparison.summary.conflicts).toBe(1); // full_name differs
    expect(comparison.summary.matches).toBe(1);   // phone matches
    expect(comparison.summary.onlyA).toBe(2);     // email, dob
    expect(comparison.summary.onlyB).toBe(1);     // status

    const nameField = comparison.fields.find(f => f.key === 'full_name');
    expect(nameField.conflict).toBe(true);
    expect(nameField.value_a).toBe('Alice Johnson');
    expect(nameField.value_b).toBe('Alice J.');
  });

  it('auto-resolve with "newest" strategy picks newer values', () => {
    const recordA = {
      fields: { full_name: 'Alice Johnson', phone: '555-0100' },
      ts: 1000,
    };
    const recordB = {
      fields: { full_name: 'Alice J.', phone: '555-0200' },
      ts: 2000,
    };
    const comparison = DatabaseMergeService.compareRecords(recordA, recordB);
    const resolutions = DatabaseMergeService.autoResolve(comparison, 'newest');

    // B is newer (ts: 2000), so conflicts resolve to B's values
    expect(resolutions.full_name.value).toBe('Alice J.');
    expect(resolutions.full_name.source).toBe('b');
    expect(resolutions.phone.value).toBe('555-0200');
    expect(resolutions.phone.source).toBe('b');
  });

  it('auto-resolve with "source_a" strategy always picks A', () => {
    const recordA = {
      fields: { full_name: 'Alice Johnson', phone: '555-0100' },
      ts: 1000,
    };
    const recordB = {
      fields: { full_name: 'Alice J.', phone: '555-0200' },
      ts: 2000,
    };
    const comparison = DatabaseMergeService.compareRecords(recordA, recordB);
    const resolutions = DatabaseMergeService.autoResolve(comparison, 'source_a');

    expect(resolutions.full_name.value).toBe('Alice Johnson');
    expect(resolutions.full_name.source).toBe('a');
  });

  it('auto-resolve with "manual" leaves conflicts unresolved', () => {
    const recordA = { fields: { full_name: 'Alice Johnson' }, ts: 1000 };
    const recordB = { fields: { full_name: 'Alice J.' }, ts: 2000 };
    const comparison = DatabaseMergeService.compareRecords(recordA, recordB);
    const resolutions = DatabaseMergeService.autoResolve(comparison, 'manual');

    expect(resolutions.full_name.source).toBe('unresolved');
    expect(resolutions.full_name.value).toBeNull();
  });

  it('auto-resolve fills non-conflicting fields from available source', () => {
    const recordA = { fields: { full_name: 'Alice', email: 'alice@test.com' }, ts: 1000 };
    const recordB = { fields: { full_name: 'Alice', phone: '555-0100' }, ts: 2000 };
    const comparison = DatabaseMergeService.compareRecords(recordA, recordB);
    const resolutions = DatabaseMergeService.autoResolve(comparison, 'manual');

    // Matching field
    expect(resolutions.full_name.source).toBe('both');
    expect(resolutions.full_name.value).toBe('Alice');

    // Only in A
    expect(resolutions.email.source).toBe('a');
    expect(resolutions.email.value).toBe('alice@test.com');

    // Only in B
    expect(resolutions.phone.source).toBe('b');
    expect(resolutions.phone.value).toBe('555-0100');
  });

  it('execute merge — emits SYN operations and creates audit record', async () => {
    const targetRoomId = await svc.createRoom('Target', 'target');
    const recordA = {
      roomId: '!a:test',
      name: 'Alice Johnson',
      fields: { full_name: 'Alice Johnson', phone: '555-0100', email: 'alice@test.com' },
      ts: 1000,
    };
    const recordB = {
      roomId: '!b:test',
      name: 'Alice J.',
      fields: { full_name: 'Alice J.', phone: '555-0100', status: 'active' },
      ts: 2000,
    };

    const resolutions = {
      full_name: { value: 'Alice Johnson', source: 'a' },
      phone: { value: '555-0100', source: 'both' },
      email: { value: 'alice@test.com', source: 'a' },
      status: { value: 'active', source: 'b' },
    };

    const result = await DatabaseMergeService.executeMerge(
      targetRoomId, recordA, recordB, resolutions, '2024-03-15', 'manual', 'org'
    );

    expect(result.merge_id).toMatch(/^merge_/);
    expect(result.ops_emitted).toBeGreaterThan(0);
    expect(result.merged_fields.full_name).toBe('Alice Johnson');
    expect(result.merged_fields.status).toBe('active');

    // Verify audit record was persisted
    const audit = await svc.getState(targetRoomId, EVT.MERGE_AUDIT, result.merge_id);
    expect(audit.source_a.roomId).toBe('!a:test');
    expect(audit.source_b.roomId).toBe('!b:test');
    expect(audit.strategy).toBe('manual');
    expect(audit.field_resolutions).toHaveLength(4);
  });

  it('merge history retrieval', async () => {
    const targetRoomId = await svc.createRoom('Target', 'target');

    // Execute two merges
    await DatabaseMergeService.executeMerge(
      targetRoomId,
      { roomId: '!a:test', name: 'A', fields: { name: 'A' }, ts: 1000 },
      { roomId: '!b:test', name: 'B', fields: { name: 'B' }, ts: 2000 },
      { name: { value: 'A', source: 'a' } },
      '2024-01-01', 'source_a', 'org'
    );
    await DatabaseMergeService.executeMerge(
      targetRoomId,
      { roomId: '!c:test', name: 'C', fields: { name: 'C' }, ts: 3000 },
      { roomId: '!d:test', name: 'D', fields: { name: 'D' }, ts: 4000 },
      { name: { value: 'D', source: 'b' } },
      '2024-02-01', 'source_b', 'org'
    );

    const history = await DatabaseMergeService.getMergeHistory(targetRoomId);
    expect(history).toHaveLength(2);
    // Most recent first
    expect(history[0].completed_at).toBeGreaterThanOrEqual(history[1].completed_at);
  });
});

/* ════════════════════════════════════════════════════════════════════════════
 * 8. IMPORT WORKFLOW
 * ════════════════════════════════════════════════════════════════════════════ */
describe('Import Workflow', () => {
  let mockClient;

  beforeEach(() => {
    mockClient = new MockMatrixClient();
    KhoraAuth._client = mockClient;
    KhoraAuth._userId = '@provider:test.local';
    globalThis.svc = new KhoraService();
  });

  it('import multiple client records with field mapping', async () => {
    const records = [
      { 'First Name': 'Alice', 'Last Name': 'Johnson', 'Email': 'alice@test.com', 'Phone': '555-0100' },
      { 'First Name': 'Bob', 'Last Name': 'Smith', 'Email': 'bob@test.com', 'Phone': '555-0200' },
      { 'First Name': 'Carol', 'Last Name': 'Williams', 'Email': 'carol@test.com', 'Phone': '555-0300' },
    ];

    const mapping = {
      'First Name': '_first_name',
      'Last Name': '_last_name',
      'Email': 'email',
      'Phone': 'phone',
    };

    const progress = [];
    const results = await importClientRecords(records, mapping, null, (p) => {
      progress.push(p);
    });

    expect(results.created).toHaveLength(3);
    expect(results.errors).toHaveLength(0);
    expect(results.totalFields).toBeGreaterThan(0);

    // Progress should have been called for each record
    expect(progress).toHaveLength(3);
    expect(progress[2].current).toBe(3);
    expect(progress[2].total).toBe(3);

    // Each created record should have a room ID
    for (const record of results.created) {
      expect(record.roomId).toBeTruthy();
      expect(record.fieldCount).toBeGreaterThan(0);
    }
  });

  it('import record with empty fields produces error for that row', async () => {
    const records = [
      { 'Name': '', 'Email': '' }, // all empty
      { 'Name': 'Alice', 'Email': 'alice@test.com' }, // valid
    ];

    const mapping = {
      'Name': 'full_name',
      'Email': 'email',
    };

    const results = await importClientRecords(records, mapping, null, () => {});

    // First row should be an error (no mapped fields with values)
    expect(results.errors).toHaveLength(1);
    expect(results.errors[0].row).toBe(1);
    expect(results.errors[0].error).toContain('No mapped fields');

    // Second row should succeed
    expect(results.created).toHaveLength(1);
  });

  it('imported records have encrypted fields', async () => {
    const records = [{ 'Name': 'Alice Johnson', 'Email': 'alice@test.com' }];
    const mapping = { 'Name': 'full_name', 'Email': 'email' };

    const results = await importClientRecords(records, mapping, null, () => {});
    expect(results.created).toHaveLength(1);

    // Read the client record from the room
    const roomId = results.created[0].roomId;
    const clientRecord = await svc.getState(roomId, EVT.CLIENT_RECORD);

    expect(clientRecord.encrypted_fields).toBeDefined();
    expect(clientRecord.encrypted_fields.full_name).toBeDefined();
    expect(clientRecord.encrypted_fields.full_name.ciphertext).toBeDefined();
    expect(clientRecord.encrypted_fields.full_name.iv).toBeDefined();

    // Decrypt and verify
    const decrypted = await FieldCrypto.decrypt(
      clientRecord.encrypted_fields.full_name.ciphertext,
      clientRecord.encrypted_fields.full_name.iv,
      clientRecord.record_key
    );
    expect(decrypted).toBe('Alice Johnson');
  });

  it('import concatenates first + last name fields', async () => {
    const records = [
      { 'first': 'Alice', 'last': 'Johnson', 'email': 'a@test.com' },
    ];
    const mapping = { 'first': '_first_name', 'last': '_last_name', 'email': 'email' };

    const results = await importClientRecords(records, mapping, null, () => {});
    expect(results.created).toHaveLength(1);

    // Verify full_name was constructed from first + last
    const roomId = results.created[0].roomId;
    const clientRecord = await svc.getState(roomId, EVT.CLIENT_RECORD);
    const decryptedName = await FieldCrypto.decrypt(
      clientRecord.encrypted_fields.full_name.ciphertext,
      clientRecord.encrypted_fields.full_name.iv,
      clientRecord.record_key
    );
    expect(decryptedName).toBe('Alice Johnson');
  });

  it('import identity state marks records as imported', async () => {
    const records = [{ 'Name': 'Test User' }];
    const mapping = { 'Name': 'full_name' };

    const results = await importClientRecords(records, mapping, null, () => {});
    const roomId = results.created[0].roomId;

    const identity = await svc.getState(roomId, EVT.IDENTITY);
    expect(identity.account_type).toBe('client_record');
    expect(identity.imported).toBe(true);
    expect(identity.import_batch).toBeTruthy();
    expect(identity.owner).toBe('@provider:test.local');
  });

  it('import with team assignment', async () => {
    const records = [{ 'Name': 'Alice' }];
    const mapping = { 'Name': 'full_name' };

    const results = await importClientRecords(
      records, mapping, null, () => {},
      'team_housing', 'Housing Outreach'
    );

    const roomId = results.created[0].roomId;
    const identity = await svc.getState(roomId, EVT.IDENTITY);
    expect(identity.team_id).toBe('team_housing');
    expect(identity.team_name).toBe('Housing Outreach');
  });
});

/* ════════════════════════════════════════════════════════════════════════════
 * 9. ANONYMIZATION & PRIVACY
 * ════════════════════════════════════════════════════════════════════════════ */
describe('Anonymization & Privacy', () => {
  it('anonymizeField blocks PII fields', () => {
    // full_name, id_number, phone, email are blocked (return null)
    expect(anonymizeField('full_name', 'Alice Johnson')).toBeNull();
    expect(anonymizeField('id_number', 'A123456')).toBeNull();
    expect(anonymizeField('phone', '555-0100')).toBeNull();
    expect(anonymizeField('email', 'alice@test.com')).toBeNull();
  });

  it('anonymizeField converts DOB to age range', () => {
    // Use a date that would make the person ~30 years old
    const thirtyYearsAgo = new Date();
    thirtyYearsAgo.setFullYear(thirtyYearsAgo.getFullYear() - 30);
    const result = anonymizeField('dob', thirtyYearsAgo.toISOString());
    expect(result.key).toBe('age_range');
    expect(result.value).toMatch(/\d+-\d+/);
  });

  it('anonymizeField passes through non-PII fields', () => {
    const result = anonymizeField('housing_status', 'Emergency Shelter');
    expect(result.key).toBe('housing_status');
    expect(result.value).toBe('Emergency Shelter');
  });

  it('FieldCrypto round-trip: generate key → encrypt → decrypt', async () => {
    const key = await FieldCrypto.generateKey();
    expect(key).toBeTruthy();

    const plaintext = 'Sensitive client information - SSN: 123-45-6789';
    const { ciphertext, iv } = await FieldCrypto.encrypt(plaintext, key);

    expect(ciphertext).not.toBe(plaintext);
    expect(iv).toBeTruthy();

    const decrypted = await FieldCrypto.decrypt(ciphertext, iv, key);
    expect(decrypted).toBe(plaintext);
  });

  it('different keys produce different ciphertexts', async () => {
    const key1 = await FieldCrypto.generateKey();
    const key2 = await FieldCrypto.generateKey();
    expect(key1).not.toBe(key2);

    const plaintext = 'Same data, different keys';
    const enc1 = await FieldCrypto.encrypt(plaintext, key1);
    const enc2 = await FieldCrypto.encrypt(plaintext, key2);

    expect(enc1.ciphertext).not.toBe(enc2.ciphertext);
  });
});

/* ════════════════════════════════════════════════════════════════════════════
 * 10. END-TO-END CRM WORKFLOW SCENARIOS
 * ════════════════════════════════════════════════════════════════════════════ */
describe('End-to-End CRM Workflow Scenarios', () => {
  let mockClient;

  beforeEach(() => {
    mockClient = new MockMatrixClient();
    KhoraAuth._client = mockClient;
    KhoraAuth._userId = '@cm:metro.local';
    globalThis.svc = new KhoraService();
  });

  it('full intake workflow: create org → import individuals → assign → add notes → allocate resource', async () => {
    // 1. Create organization room
    const orgRoomId = await svc.createRoom('Metro Shelter', 'Organization', [
      { type: EVT.IDENTITY, state_key: '', content: { account_type: 'organization' } },
      { type: EVT.ORG_METADATA, state_key: '', content: { name: 'Metro Shelter', type: 'direct_service' } },
      { type: EVT.ORG_ROSTER, state_key: '', content: {
        staff: [
          { userId: '@cm:metro.local', role: 'case_manager', display_name: 'Case Manager' },
          { userId: '@admin:metro.local', role: 'admin', display_name: 'Admin' },
        ],
      }},
    ]);

    // 2. Import individuals
    const records = [
      { 'Name': 'Alice Johnson', 'Email': 'alice@test.com', 'Phone': '555-0100' },
      { 'Name': 'Bob Smith', 'Phone': '555-0200' },
    ];
    const mapping = { 'Name': 'full_name', 'Email': 'email', 'Phone': 'phone' };
    const importResults = await importClientRecords(records, mapping, null, () => {});
    expect(importResults.created).toHaveLength(2);

    // 3. Set up case assignments
    const assignments = {};
    for (const rec of importResults.created) {
      assignments[rec.roomId] = {
        primary: '@cm:metro.local',
        staff: ['@cm:metro.local'],
        client_name: rec.displayName,
        added: Date.now(),
      };
    }
    await svc.setState(orgRoomId, EVT.ROSTER_ASSIGN, { assignments });

    const savedAssignments = await svc.getState(orgRoomId, EVT.ROSTER_ASSIGN);
    expect(Object.keys(savedAssignments.assignments)).toHaveLength(2);

    // 4. Add notes to first individual
    const noteId = `note_${Date.now()}`;
    await svc.setState(orgRoomId, EVT.NOTE, {
      id: noteId,
      type: 'shared',
      title: 'Intake Assessment',
      content: 'Client needs emergency housing. Referred to bed program.',
      created_by: '@cm:metro.local',
      created_at: Date.now(),
      indId: importResults.created[0].roomId,
    }, noteId);

    const note = await svc.getState(orgRoomId, EVT.NOTE, noteId);
    expect(note.content).toContain('emergency housing');

    // 5. Create and allocate resource
    const rt = await ResourceService.createResourceType(orgRoomId, {
      name: 'Emergency Bed',
      category: 'housing',
      unit: 'bed-night',
    }, 'org');

    const relation = await ResourceService.establishRelation(orgRoomId, {
      resource_type_id: rt.id,
      relation_type: 'operates',
      capacity: 30,
    });

    const bridgeRoomId = await svc.createRoom('Bridge', 'bridge');
    const vaultRoomId = await svc.createRoom('Vault', 'vault');

    const allocResult = await ResourceService.allocateResource(bridgeRoomId, {
      resource_type_id: rt.id,
      relation_id: relation.id,
      quantity: 1,
      allocated_to: '@alice:test.local',
    }, orgRoomId, vaultRoomId);

    expect(allocResult.valid).toBe(true);
    expect(allocResult.allocation.quantity).toBe(1);

    // 6. Verify inventory was updated
    const inv = await svc.getState(orgRoomId, EVT.RESOURCE_INVENTORY, relation.id);
    expect(inv.available).toBe(29);
    expect(inv.allocated).toBe(1);
  });

  it('case lifecycle: active → notes → exit → close', async () => {
    const bridgeRoomId = await svc.createRoom('Bridge', 'bridge');
    const orgRoomId = await svc.createRoom('Org', 'org');

    // 1. Active case
    await svc.setState(bridgeRoomId, EVT.BRIDGE_META, {
      client: '@client:test',
      provider: '@cm:metro.local',
      status: 'active',
      created: Date.now(),
    });

    // 2. CRM fields set to active status
    const vaultRoomId = await svc.createRoom('Vault', 'vault');
    await svc.setState(vaultRoomId, EVT.VAULT_SNAPSHOT, {
      fields: {
        full_name: 'Alice Johnson',
        status: 'active',
        intake_date: '2024-01-15',
        assigned_to: 'Case Manager',
        goals: 'Secure permanent housing',
      },
      last_modified_at: Date.now(),
    });

    // 3. Add progress notes over time
    for (let i = 0; i < 3; i++) {
      await svc.setState(orgRoomId, EVT.NOTE, {
        id: `note_${i}`,
        type: 'shared',
        title: `Progress Note ${i + 1}`,
        content: `Week ${i + 1} progress update`,
        created_by: '@cm:metro.local',
        created_at: Date.now() + i * 604800000, // weekly
      }, `note_${i}`);
    }

    // 4. Update to exit
    const snapshot = await svc.getState(vaultRoomId, EVT.VAULT_SNAPSHOT);
    snapshot.fields.status = 'closed';
    snapshot.fields.exit_date = '2024-06-15';
    snapshot.fields.exit_destination = 'Permanent Housing';
    snapshot.fields.outcome = 'Successfully housed with ongoing support plan.';
    snapshot.last_modified_at = Date.now();
    await svc.setState(vaultRoomId, EVT.VAULT_SNAPSHOT, snapshot);

    // 5. Emit exit EO operation
    const exitOp = await emitOp(bridgeRoomId, 'ALT', dot('org', 'individuals', 'status'), {
      from: 'active',
      to: 'closed',
      exit_destination: 'Permanent Housing',
    }, { type: 'org', epistemic: 'MEANT', role: 'case_manager' });

    expect(exitOp.op).toBe('ALT');

    // 6. Verify final state
    const final = await svc.getState(vaultRoomId, EVT.VAULT_SNAPSHOT);
    expect(final.fields.status).toBe('closed');
    expect(final.fields.exit_destination).toBe('Permanent Housing');
    expect(final.fields.outcome).toContain('Successfully housed');
  });

  it('multi-team record sharing via team record index', async () => {
    // Create two team rooms
    const team1Room = await svc.createRoom('Team 1', 'team');
    const team2Room = await svc.createRoom('Team 2', 'team');

    await svc.setState(team1Room, EVT.TEAM_META, { name: 'Housing Team' });
    await svc.setState(team2Room, EVT.TEAM_META, { name: 'Health Team' });

    // Create a client record
    const clientRoom = await svc.createRoom('Client', 'client_record');

    // Both teams reference the same client record
    await svc.setState(team1Room, EVT.TEAM_RECORD_INDEX, {
      records: { [clientRoom]: { added: Date.now(), added_by: '@cm:metro.local' } },
    });
    await svc.setState(team2Room, EVT.TEAM_RECORD_INDEX, {
      records: { [clientRoom]: { added: Date.now(), added_by: '@nurse:metro.local' } },
    });

    const team1Records = await svc.getState(team1Room, EVT.TEAM_RECORD_INDEX);
    const team2Records = await svc.getState(team2Room, EVT.TEAM_RECORD_INDEX);

    // Same client record accessible from both teams
    expect(team1Records.records[clientRoom]).toBeDefined();
    expect(team2Records.records[clientRoom]).toBeDefined();
  });

  it('custom field definitions at org level', async () => {
    const orgRoomId = await svc.createRoom('Org', 'org');

    // Define a custom field
    const fieldDef = {
      id: 'field_pets',
      key: 'num_pets',
      label: 'Number of Pets',
      data_type: 'number',
      category: 'housing',
      source: 'org',
      created_by: '@admin:metro.local',
      created_at: Date.now(),
    };

    await svc.setState(orgRoomId, EVT.FIELD_DEF, fieldDef, fieldDef.id);

    const saved = await svc.getState(orgRoomId, EVT.FIELD_DEF, fieldDef.id);
    expect(saved.key).toBe('num_pets');
    expect(saved.data_type).toBe('number');
    expect(saved.label).toBe('Number of Pets');

    // Custom field should NOT be in standard keys
    expect(TEST_CRM_STANDARD_KEYS.has('num_pets')).toBe(false);
  });

  it('linked records between individuals', async () => {
    const orgRoomId = await svc.createRoom('Org', 'org');

    // Link two client records (e.g. family members)
    const link = {
      id: 'link_1',
      source_record: '!client_a:test',
      target_record: '!client_b:test',
      relationship: 'family_member',
      label: 'Spouse',
      created_by: '@cm:metro.local',
      created_at: Date.now(),
    };

    await svc.setState(orgRoomId, EVT.LINKED_RECORD, link, link.id);

    // Index for fast lookups
    await svc.setState(orgRoomId, EVT.LINKED_RECORD_INDEX, {
      '!client_a:test': [{ link_id: 'link_1', target: '!client_b:test', relationship: 'family_member' }],
      '!client_b:test': [{ link_id: 'link_1', target: '!client_a:test', relationship: 'family_member' }],
    });

    const savedLink = await svc.getState(orgRoomId, EVT.LINKED_RECORD, 'link_1');
    expect(savedLink.relationship).toBe('family_member');

    const index = await svc.getState(orgRoomId, EVT.LINKED_RECORD_INDEX);
    expect(index['!client_a:test']).toHaveLength(1);
    expect(index['!client_b:test'][0].target).toBe('!client_a:test');
  });
});
