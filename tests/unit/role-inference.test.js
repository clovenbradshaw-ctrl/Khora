/**
 * inferRolesFromRooms — Context detection & role inference
 * Source: app/constants.js (line 779)
 *
 * Tier 3: Reliability — determines which dashboard a user sees.
 * Tests that the correct roles are inferred from various room configurations.
 */
import { describe, it, expect } from 'vitest';

const USER = '@alice:test.local';

describe('inferRolesFromRooms', () => {
  it('empty room set returns empty roles', () => {
    const roles = inferRolesFromRooms({}, USER);
    expect(roles).toEqual([]);
  });

  it('client vault room → detects client role', () => {
    const scanned = {
      '!vault:test': {
        [EVT.IDENTITY]: { account_type: 'client', owner: USER },
      },
    };
    const roles = inferRolesFromRooms(scanned, USER);
    expect(roles).toContain('client');
  });

  it('client vault owned by another user → no role', () => {
    const scanned = {
      '!vault:test': {
        [EVT.IDENTITY]: { account_type: 'client', owner: '@bob:test.local' },
      },
    };
    const roles = inferRolesFromRooms(scanned, USER);
    expect(roles).not.toContain('client');
  });

  it('provider roster room → detects provider role', () => {
    const scanned = {
      '!roster:test': {
        [EVT.IDENTITY]: { account_type: 'provider', owner: USER },
      },
    };
    const roles = inferRolesFromRooms(scanned, USER);
    expect(roles).toContain('provider');
  });

  it('organization room → detects provider role', () => {
    const scanned = {
      '!org:test': {
        [EVT.IDENTITY]: { account_type: 'organization' },
      },
    };
    const roles = inferRolesFromRooms(scanned, USER);
    expect(roles).toContain('provider');
  });

  it('network room → detects provider role', () => {
    const scanned = {
      '!net:test': {
        [EVT.IDENTITY]: { account_type: 'network' },
      },
    };
    const roles = inferRolesFromRooms(scanned, USER);
    expect(roles).toContain('provider');
  });

  it('bridge room with user as provider side → provider role', () => {
    const scanned = {
      '!bridge:test': {
        [EVT.IDENTITY]: { account_type: 'bridge' },
        [EVT.BRIDGE_META]: { provider: USER, client: '@bob:test.local' },
      },
    };
    const roles = inferRolesFromRooms(scanned, USER);
    expect(roles).toContain('provider');
  });

  it('bridge room with user as client side → client role', () => {
    const scanned = {
      '!bridge:test': {
        [EVT.IDENTITY]: { account_type: 'bridge' },
        [EVT.BRIDGE_META]: { provider: '@bob:test.local', client: USER },
      },
    };
    const roles = inferRolesFromRooms(scanned, USER);
    expect(roles).toContain('client');
  });

  it('user with both client vault and provider roster → detects both roles', () => {
    const scanned = {
      '!vault:test': {
        [EVT.IDENTITY]: { account_type: 'client', owner: USER },
      },
      '!roster:test': {
        [EVT.IDENTITY]: { account_type: 'provider', owner: USER },
      },
    };
    const roles = inferRolesFromRooms(scanned, USER);
    expect(roles).toContain('client');
    expect(roles).toContain('provider');
  });

  it('org admin role detected from staff roster', () => {
    const scanned = {
      '!org:test': {
        [EVT.IDENTITY]: { account_type: 'organization' },
        [EVT.ORG_ROSTER]: {
          staff: [
            { userId: USER, role: 'admin' },
            { userId: '@bob:test.local', role: 'case_manager' },
          ],
        },
      },
    };
    const roles = inferRolesFromRooms(scanned, USER);
    expect(roles).toContain('org_admin');
    expect(roles).toContain('provider');
  });

  it('non-admin staff member does not get org_admin role', () => {
    const scanned = {
      '!org:test': {
        [EVT.IDENTITY]: { account_type: 'organization' },
        [EVT.ORG_ROSTER]: {
          staff: [
            { userId: USER, role: 'case_manager' },
          ],
        },
      },
    };
    const roles = inferRolesFromRooms(scanned, USER);
    expect(roles).toContain('provider');
    expect(roles).not.toContain('org_admin');
  });

  it('room with no identity event is skipped', () => {
    const scanned = {
      '!unknown:test': {
        // No EVT.IDENTITY
        [EVT.BRIDGE_META]: { provider: '@bob:test.local', client: USER },
      },
    };
    // Bridge check still runs because it's separate from identity check
    // But identity loop skips rooms without identity
    const roles = inferRolesFromRooms(scanned, USER);
    // The bridge check in the identity loop won't fire (continue'd),
    // but the separate loop for org_admin also won't match
    expect(roles).toEqual([]);
  });
});
