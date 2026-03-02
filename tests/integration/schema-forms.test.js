/**
 * Schema Forms — Form definition lifecycle
 * Tests form creation, storage, retrieval, and structural integrity.
 *
 * Tier 2: Data Integrity — forms define how providers collect client data.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MockMatrixClient } from '../setup.js';

describe('Schema Forms — Form Lifecycle', () => {
  let svc;
  let mockClient;

  beforeEach(() => {
    mockClient = new MockMatrixClient();
    svc = new KhoraService();
    KhoraAuth._client = mockClient;
    KhoraAuth._userId = '@provider:test.local';
  });

  it('form definition: create → store → retrieve → structure intact', async () => {
    const roomId = (await mockClient.createRoom({ name: 'org' })).room_id;

    const form = {
      id: 'form_intake_v1',
      title: 'Client Intake Form',
      version: 1,
      created_by: '@admin:test.local',
      created_at: Date.now(),
      sections: [
        {
          id: 'sec_demographics',
          title: 'Demographics',
          questions: [
            { id: 'q_name', label: 'Full Name', type: 'text', required: true },
            { id: 'q_dob', label: 'Date of Birth', type: 'date', required: true },
            { id: 'q_gender', label: 'Gender', type: 'select', options: ['male', 'female', 'non-binary', 'other'], required: false },
          ],
        },
        {
          id: 'sec_housing',
          title: 'Housing Status',
          questions: [
            { id: 'q_housing', label: 'Current Housing', type: 'select', options: ['housed', 'unhoused', 'at_risk'], required: true },
            { id: 'q_housing_notes', label: 'Notes', type: 'textarea', required: false },
          ],
        },
      ],
    };

    await svc.setState(roomId, EVT.SCHEMA_FORM, form, form.id);
    const saved = await svc.getState(roomId, EVT.SCHEMA_FORM, form.id);

    expect(saved.id).toBe('form_intake_v1');
    expect(saved.title).toBe('Client Intake Form');
    expect(saved.sections).toHaveLength(2);
    expect(saved.sections[0].questions).toHaveLength(3);
    expect(saved.sections[1].questions).toHaveLength(2);
    expect(saved.sections[0].questions[0].label).toBe('Full Name');
    expect(saved.sections[0].questions[2].options).toContain('non-binary');
  });

  it('form with nested data preserves all levels on round-trip', async () => {
    const roomId = (await mockClient.createRoom({ name: 'org' })).room_id;

    const form = {
      id: 'form_assessment_v1',
      title: 'SDOH Assessment',
      sections: [{
        id: 'sec_1',
        title: 'Social Determinants',
        questions: [{
          id: 'q_1',
          label: 'Housing Stability',
          type: 'likert',
          scale: { min: 1, max: 5, labels: { 1: 'Very Unstable', 5: 'Very Stable' } },
          scoring: { weight: 2.0, domain: 'housing' },
          conditional: { show_if: { field: 'q_has_housing', value: 'yes' } },
        }],
      }],
    };

    await svc.setState(roomId, EVT.SCHEMA_FORM, form, form.id);
    const saved = await svc.getState(roomId, EVT.SCHEMA_FORM, form.id);

    const q = saved.sections[0].questions[0];
    expect(q.scale.min).toBe(1);
    expect(q.scale.max).toBe(5);
    expect(q.scale.labels['1']).toBe('Very Unstable');
    expect(q.scoring.weight).toBe(2.0);
    expect(q.scoring.domain).toBe('housing');
    expect(q.conditional.show_if.field).toBe('q_has_housing');
  });

  it('multiple forms in same room stored under different state keys', async () => {
    const roomId = (await mockClient.createRoom({ name: 'org' })).room_id;

    const form1 = { id: 'form_intake', title: 'Intake Form', sections: [] };
    const form2 = { id: 'form_exit', title: 'Exit Form', sections: [] };

    await svc.setState(roomId, EVT.SCHEMA_FORM, form1, form1.id);
    await svc.setState(roomId, EVT.SCHEMA_FORM, form2, form2.id);

    const saved1 = await svc.getState(roomId, EVT.SCHEMA_FORM, form1.id);
    const saved2 = await svc.getState(roomId, EVT.SCHEMA_FORM, form2.id);

    expect(saved1.title).toBe('Intake Form');
    expect(saved2.title).toBe('Exit Form');
  });

  it('form prompt (SCHEMA_PROMPT) stores and retrieves correctly', async () => {
    const roomId = (await mockClient.createRoom({ name: 'org' })).room_id;

    const prompt = {
      id: 'prompt_housing_check',
      form_id: 'form_intake_v1',
      title: 'Monthly Housing Check',
      assigned_to: ['@worker1:test', '@worker2:test'],
      frequency: 'monthly',
      created_at: Date.now(),
    };

    await svc.setState(roomId, EVT.SCHEMA_PROMPT, prompt, prompt.id);
    const saved = await svc.getState(roomId, EVT.SCHEMA_PROMPT, prompt.id);

    expect(saved.title).toBe('Monthly Housing Check');
    expect(saved.form_id).toBe('form_intake_v1');
    expect(saved.assigned_to).toHaveLength(2);
  });

  it('schema assessment saves scoring framework intact', async () => {
    const roomId = (await mockClient.createRoom({ name: 'org' })).room_id;

    const assessment = {
      id: 'assess_sdoh_v1',
      title: 'SDOH Assessment Framework',
      domains: ['housing', 'food', 'transportation', 'health'],
      scoring: {
        method: 'weighted_sum',
        max_score: 100,
        thresholds: { low: 0, medium: 40, high: 70 },
      },
      created_by: '@admin:test',
    };

    await svc.setState(roomId, EVT.SCHEMA_ASSESSMENT, assessment, assessment.id);
    const saved = await svc.getState(roomId, EVT.SCHEMA_ASSESSMENT, assessment.id);

    expect(saved.domains).toEqual(['housing', 'food', 'transportation', 'health']);
    expect(saved.scoring.method).toBe('weighted_sum');
    expect(saved.scoring.thresholds.high).toBe(70);
  });
});
