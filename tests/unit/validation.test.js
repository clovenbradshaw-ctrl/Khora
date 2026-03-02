/**
 * Resource Allocation Validation — ported from test-resources.html
 * Source: app/constants.js (validateAllocation, buildResourceSource, etc.)
 *
 * Tier 2: Data Integrity — constraint enforcement on resource allocation.
 * These tests were originally in test-resources.html (browser-based);
 * now ported to Vitest for automated CI execution.
 */
import { describe, it, expect } from 'vitest';

// ── Helper factories (mirror test-resources.html) ──

const baseResourceType = {
  id: 'rtype_bus_voucher',
  name: 'Bus Voucher',
  category: 'transportation',
  unit: 'voucher',
  fungible: true,
  perishable: true,
  ttl_days: 90,
  constraints: null,
};

const baseAllocation = {
  resource_type_id: 'rtype_bus_voucher',
  allocated_to: '@client:matrix.org',
  quantity: 1,
};

// ── Constants ──

describe('Resource Constants', () => {
  it('RESOURCE_CATEGORIES contains all 9 categories', () => {
    expect(RESOURCE_CATEGORIES.length).toBe(9);
    for (const cat of ['housing', 'financial', 'transportation', 'food', 'health', 'employment', 'legal', 'education', 'general']) {
      expect(RESOURCE_CATEGORIES).toContain(cat);
    }
  });

  it('RESOURCE_OPACITY has correct levels', () => {
    expect(RESOURCE_OPACITY.SOVEREIGN).toBe(0);
    expect(RESOURCE_OPACITY.ATTESTED).toBe(1);
    expect(RESOURCE_OPACITY.CONTRIBUTED).toBe(2);
    expect(RESOURCE_OPACITY.PUBLISHED).toBe(3);
  });

  it('RESOURCE_RELATION_TYPES contains all 5 types', () => {
    expect(RESOURCE_RELATION_TYPES.length).toBe(5);
    for (const t of ['operates', 'funds', 'refers_to', 'contributes_to', 'transfers']) {
      expect(RESOURCE_RELATION_TYPES).toContain(t);
    }
  });

  it('RESOURCE_ALLOC_STATUSES has 4 statuses', () => {
    expect(RESOURCE_ALLOC_STATUSES).toEqual(['active', 'consumed', 'expired', 'revoked']);
  });

  it('RESOURCE_LIFECYCLE_EVENTS has 5 events including returned', () => {
    expect(RESOURCE_LIFECYCLE_EVENTS.length).toBe(5);
    expect(RESOURCE_LIFECYCLE_EVENTS).toContain('returned');
  });

  it('RESOURCE_DEDUP_STATUSES has 3 statuses', () => {
    expect(RESOURCE_DEDUP_STATUSES).toEqual(['confirmed', 'attested_non_additive', 'unresolved']);
  });

  it('RESOURCE_DEDUP_LINK_TYPES has 3 types', () => {
    expect(RESOURCE_DEDUP_LINK_TYPES).toEqual(['subset', 'same', 'overlaps']);
  });

  it('opacity levels are ordered correctly', () => {
    expect(RESOURCE_OPACITY.SOVEREIGN).toBeLessThan(RESOURCE_OPACITY.ATTESTED);
    expect(RESOURCE_OPACITY.ATTESTED).toBeLessThan(RESOURCE_OPACITY.CONTRIBUTED);
    expect(RESOURCE_OPACITY.CONTRIBUTED).toBeLessThan(RESOURCE_OPACITY.PUBLISHED);
  });
});

// ── ID Generation ──

describe('genResourceId', () => {
  it('produces unique IDs with correct prefix', () => {
    const id1 = genResourceId('rtype');
    const id2 = genResourceId('rtype');
    expect(id1).toMatch(/^rtype_/);
    expect(id2).toMatch(/^rtype_/);
    expect(id1).not.toBe(id2);
  });

  it('works with various prefixes', () => {
    expect(genResourceId('ralloc')).toMatch(/^ralloc_/);
    expect(genResourceId('rrel')).toMatch(/^rrel_/);
    expect(genResourceId('prop')).toMatch(/^prop_/);
  });
});

// ── Source & Provenance ──

describe('buildResourceSource', () => {
  it('sets level correctly', () => {
    const src = buildResourceSource('org');
    expect(src.level).toBe('org');
    expect(src.adopted_at).toBeGreaterThan(0);
  });

  it('includes propagation for network level', () => {
    const src = buildResourceSource('network', 'required');
    expect(src.level).toBe('network');
    expect(src.propagation).toBe('required');
  });

  it('omits propagation for org level', () => {
    const src = buildResourceSource('org', 'standard');
    expect(src.propagation).toBeUndefined();
  });

  it('includes optional fields when provided', () => {
    const src = buildResourceSource('network', 'optional', 'CR-2024-01', '@admin:matrix.org', '!org:matrix.org');
    expect(src.adopted_via).toBe('CR-2024-01');
    expect(src.proposed_by).toBe('@admin:matrix.org');
    expect(src.origin_org).toBe('!org:matrix.org');
  });

  it('omits optional fields when not provided', () => {
    const src = buildResourceSource('org');
    expect(src.adopted_via).toBeUndefined();
    expect(src.proposed_by).toBeUndefined();
    expect(src.origin_org).toBeUndefined();
  });
});

// ── Constraint Governance ──

describe('buildConstraintGovernance', () => {
  it('returns correct defaults', () => {
    const gov = buildConstraintGovernance();
    expect(gov.propagation).toBe('optional');
    expect(gov.adopted_via).toBeNull();
    expect(gov.source_level).toBe('org');
    expect(gov.divergence_allowed).toBe(true);
  });

  it('respects all parameters', () => {
    const gov = buildConstraintGovernance('network', 'required', 'CR-2024-05', false);
    expect(gov.propagation).toBe('required');
    expect(gov.adopted_via).toBe('CR-2024-05');
    expect(gov.source_level).toBe('network');
    expect(gov.divergence_allowed).toBe(false);
  });

  it('divergence_allowed defaults true even with explicit undefined', () => {
    const gov = buildConstraintGovernance('org', 'standard', null, undefined);
    expect(gov.divergence_allowed).toBe(true);
  });
});

// ── Validate Allocation ──

describe('validateAllocation — Basic', () => {
  it('passes with no constraints', () => {
    const result = validateAllocation(baseAllocation, baseResourceType, [], [], 'provider');
    expect(result.valid).toBe(true);
    expect(result.violations.length).toBe(0);
  });

  it('passes with null policies/allocations', () => {
    const result = validateAllocation(baseAllocation, baseResourceType, null, null, 'provider');
    expect(result.valid).toBe(true);
  });
});

describe('validateAllocation — Eligible Roles', () => {
  it('rejects unauthorized role', () => {
    const rt = { ...baseResourceType, constraints: { eligible_roles: ['admin', 'case_manager'], governance: buildConstraintGovernance('network', 'required', 'CR-2024-01') } };
    const result = validateAllocation(baseAllocation, rt, [], [], 'read_only');
    expect(result.valid).toBe(false);
    expect(result.violations[0].check).toBe('eligible_roles');
    expect(result.violations[0].message).toContain('read_only');
    expect(result.violations[0].governance).not.toBeNull();
  });

  it('accepts authorized role', () => {
    const rt = { ...baseResourceType, constraints: { eligible_roles: ['admin', 'provider'] } };
    const result = validateAllocation(baseAllocation, rt, [], [], 'provider');
    expect(result.valid).toBe(true);
  });

  it('skips role check when eligible_roles is empty', () => {
    const rt = { ...baseResourceType, constraints: { eligible_roles: [] } };
    const result = validateAllocation(baseAllocation, rt, [], [], 'read_only');
    expect(result.valid).toBe(true);
  });
});

describe('validateAllocation — Max Per Client', () => {
  it('enforces max_per_client cap', () => {
    const rt = { ...baseResourceType, constraints: { max_per_client: 2, period_days: 30, governance: buildConstraintGovernance('network', 'standard', 'CR-2024-03') } };
    const existing = [
      { resource_type_id: 'rtype_bus_voucher', allocated_to: '@client:matrix.org', status: 'active', allocated_at: Date.now() - 1000 },
      { resource_type_id: 'rtype_bus_voucher', allocated_to: '@client:matrix.org', status: 'active', allocated_at: Date.now() - 2000 },
    ];
    const result = validateAllocation(baseAllocation, rt, [], existing, 'provider');
    expect(result.valid).toBe(false);
    expect(result.violations[0].check).toBe('max_per_client');
  });

  it('allows allocation within cap', () => {
    const rt = { ...baseResourceType, constraints: { max_per_client: 3, period_days: 30 } };
    const existing = [
      { resource_type_id: 'rtype_bus_voucher', allocated_to: '@client:matrix.org', status: 'active', allocated_at: Date.now() - 1000 },
    ];
    const result = validateAllocation(baseAllocation, rt, [], existing, 'provider');
    expect(result.valid).toBe(true);
  });

  it('ignores consumed/expired allocations', () => {
    const rt = { ...baseResourceType, constraints: { max_per_client: 1, period_days: 30 } };
    const existing = [
      { resource_type_id: 'rtype_bus_voucher', allocated_to: '@client:matrix.org', status: 'consumed', allocated_at: Date.now() - 1000 },
      { resource_type_id: 'rtype_bus_voucher', allocated_to: '@client:matrix.org', status: 'expired', allocated_at: Date.now() - 2000 },
    ];
    const result = validateAllocation(baseAllocation, rt, [], existing, 'provider');
    expect(result.valid).toBe(true);
  });

  it('ignores allocations outside period window', () => {
    const rt = { ...baseResourceType, constraints: { max_per_client: 1, period_days: 30 } };
    const existing = [
      { resource_type_id: 'rtype_bus_voucher', allocated_to: '@client:matrix.org', status: 'active', allocated_at: Date.now() - (31 * 86400000) },
    ];
    const result = validateAllocation(baseAllocation, rt, [], existing, 'provider');
    expect(result.valid).toBe(true);
  });

  it('ignores allocations for other clients', () => {
    const rt = { ...baseResourceType, constraints: { max_per_client: 1, period_days: 30 } };
    const existing = [
      { resource_type_id: 'rtype_bus_voucher', allocated_to: '@other:matrix.org', status: 'active', allocated_at: Date.now() - 1000 },
    ];
    const result = validateAllocation(baseAllocation, rt, [], existing, 'provider');
    expect(result.valid).toBe(true);
  });

  it('uses 365-day default period when period_days not set', () => {
    const rt = { ...baseResourceType, constraints: { max_per_client: 1 } };
    const existing = [
      { resource_type_id: 'rtype_bus_voucher', allocated_to: '@client:matrix.org', status: 'active', allocated_at: Date.now() - (200 * 86400000) },
    ];
    const result = validateAllocation(baseAllocation, rt, [], existing, 'provider');
    expect(result.valid).toBe(false);
  });
});

describe('validateAllocation — Approval', () => {
  it('rejects unapproved allocation', () => {
    const rt = { ...baseResourceType, constraints: { requires_approval: true, approver_roles: ['admin', 'case_manager'] } };
    const result = validateAllocation(baseAllocation, rt, [], [], 'provider');
    expect(result.valid).toBe(false);
    expect(result.violations[0].check).toBe('requires_approval');
    expect(result.violations[0].message).toContain('admin');
  });

  it('accepts approved allocation', () => {
    const rt = { ...baseResourceType, constraints: { requires_approval: true } };
    const alloc = { ...baseAllocation, approval: { approved_by: '@admin:matrix.org', approved_at: Date.now() } };
    const result = validateAllocation(alloc, rt, [], [], 'provider');
    expect(result.valid).toBe(true);
  });

  it('approval_threshold — below threshold passes', () => {
    const rt = { ...baseResourceType, constraints: { requires_approval: true, approval_threshold: 100 } };
    const alloc = { ...baseAllocation, quantity: 50 };
    const result = validateAllocation(alloc, rt, [], [], 'provider');
    expect(result.valid).toBe(true);
  });

  it('approval_threshold — above threshold fails without approval', () => {
    const rt = { ...baseResourceType, constraints: { requires_approval: true, approval_threshold: 100 } };
    const alloc = { ...baseAllocation, quantity: 150 };
    const result = validateAllocation(alloc, rt, [], [], 'provider');
    expect(result.valid).toBe(false);
    expect(result.violations[0].message).toContain('threshold');
  });

  it('approval_threshold — above threshold passes with approval', () => {
    const rt = { ...baseResourceType, constraints: { requires_approval: true, approval_threshold: 100 } };
    const alloc = { ...baseAllocation, quantity: 150, approval: { approved_by: '@admin:matrix.org', approved_at: Date.now() } };
    const result = validateAllocation(alloc, rt, [], [], 'provider');
    expect(result.valid).toBe(true);
  });
});

describe('validateAllocation — Policy Merging', () => {
  it('merges standalone policies with type constraints', () => {
    const rt = { ...baseResourceType, constraints: { max_per_client: 10 } };
    const policies = [{ resource_type_id: 'rtype_bus_voucher', constraints: { max_per_client: 2, period_days: 7, governance: buildConstraintGovernance('network', 'required', 'CR-2024-06') } }];
    const existing = [
      { resource_type_id: 'rtype_bus_voucher', allocated_to: '@client:matrix.org', status: 'active', allocated_at: Date.now() - 1000 },
      { resource_type_id: 'rtype_bus_voucher', allocated_to: '@client:matrix.org', status: 'active', allocated_at: Date.now() - 2000 },
    ];
    const result = validateAllocation(baseAllocation, rt, policies, existing, 'provider');
    expect(result.valid).toBe(false);
    expect(result.violations[0].check).toBe('max_per_client');
  });

  it('ignores policies for other resource types', () => {
    const rt = { ...baseResourceType, constraints: null };
    const policies = [{ resource_type_id: 'rtype_OTHER', constraints: { eligible_roles: ['admin'] } }];
    const result = validateAllocation(baseAllocation, rt, policies, [], 'provider');
    expect(result.valid).toBe(true);
  });
});

describe('validateAllocation — Multiple Violations', () => {
  it('reports all violations, not just first', () => {
    const rt = { ...baseResourceType, constraints: { eligible_roles: ['admin'], max_per_client: 0, requires_approval: true } };
    const result = validateAllocation(baseAllocation, rt, [], [], 'provider');
    expect(result.valid).toBe(false);
    expect(result.violations.length).toBeGreaterThanOrEqual(2);
    const checks = result.violations.map(v => v.check);
    expect(checks).toContain('eligible_roles');
    expect(checks).toContain('requires_approval');
  });
});

describe('validateAllocation — Governance Provenance', () => {
  it('violations include governance metadata', () => {
    const gov = buildConstraintGovernance('network', 'required', 'CR-2024-03', false);
    const rt = { ...baseResourceType, constraints: { eligible_roles: ['admin'], governance: gov } };
    const result = validateAllocation(baseAllocation, rt, [], [], 'provider');
    expect(result.valid).toBe(false);
    const v = result.violations[0];
    expect(v.governance.propagation).toBe('required');
    expect(v.governance.adopted_via).toBe('CR-2024-03');
    expect(v.governance.source_level).toBe('network');
    expect(v.governance.divergence_allowed).toBe(false);
  });

  it('violations include null governance when none set', () => {
    const rt = { ...baseResourceType, constraints: { eligible_roles: ['admin'] } };
    const result = validateAllocation(baseAllocation, rt, [], [], 'provider');
    expect(result.violations[0].governance).toBeNull();
  });
});

// ── Data Structure Shapes ──

describe('Data Structure Shapes', () => {
  it('ResourceInventory capacity arithmetic is consistent', () => {
    const inv = { total_capacity: 100, available: 70, allocated: 25, reserved: 5 };
    expect(inv.available + inv.allocated + inv.reserved).toBe(inv.total_capacity);
  });
});
