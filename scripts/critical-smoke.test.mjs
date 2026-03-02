import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

const authSource = read('app/auth.js');
const constantsSource = read('app/constants.js');
const clientSource = read('app/client.js');
const appSource = read('app/app.js');
const serviceSource = read('app/service.js');

// These tests are intentionally app-contract based: they gate that the real
// Khora source preserves critical security/reliability paths before shipping.

test('critical/auth: session persistence writes to sessionStorage and removes legacy localStorage token', () => {
  assert.match(authSource, /sessionStorage\.setItem\('khora_session',\s*JSON\.stringify\(/);
  assert.match(authSource, /localStorage\.removeItem\('khora_session'\)/);
});

test('critical/auth: restoreSession validates token + handles expired and network failures', () => {
  assert.match(authSource, /\/account\/whoami/);
  assert.match(authSource, /return \{ expired: true \}/);
  assert.match(authSource, /return \{ networkError: true, message:/);
});

test('critical/security: encrypted-room send path refuses plaintext fallback', () => {
  assert.match(serviceSource, /Cannot send to encrypted room — E2EE is not initialized/);
  assert.match(serviceSource, /NEVER fall back to the REST API — that bypasses Megolm and sends plaintext/);
});

test('critical/data-lifecycle: vault snapshot save writes Matrix state and updates local UI state', () => {
  assert.match(clientSource, /const saveSnapshot = async \(fields, obs, mc, cfd, ef\) => \{/);
  assert.match(clientSource, /await svc\.setState\(vaultRoom, EVT\.VAULT_SNAPSHOT, snapshot\);/);

  for (const stateSetter of [
    'setVaultData\\(snapshot\\.fields\\);',
    'setObservations\\(snapshot\\.observations\\);',
    'setMetricsConsent\\(snapshot\\.metrics_consent\\);',
    'setCustomFieldDefs\\(snapshot\\.custom_field_defs\\);',
    'setEnabledFrameworks\\(snapshot\\.enabled_frameworks\\);',
  ]) {
    assert.match(clientSource, new RegExp(stateSetter), `missing state update: ${stateSetter}`);
  }
});

test('critical/rendering: app renders root and includes dashboard activity rendering paths', () => {
  assert.match(appSource, /ReactDOM\.createRoot\(document\.getElementById\('root'\)\)\.render\(/);
  assert.match(clientSource, /allEvents\.push\(\{[\s\S]*category: 'notes'/);
  assert.match(clientSource, /allEvents\.push\(\{[\s\S]*category: 'resources'/);
});

test('critical/schema-contract: core event constants required for create/save/render remain defined', () => {
  const requiredEventLines = [
    "VAULT_SNAPSHOT: `${NS}.vault.snapshot`",
    "VAULT_PROVIDERS: `${NS}.vault.providers`",
    "OBSERVATION: `${NS}.observation`",
    "RESOURCE_ALLOC: `${NS}.resource.allocation`",
    "RESOURCE_VAULT: `${NS}.resource.vault_record`",
    "NOTE: `${NS}.note`",
  ];

  for (const expectedLine of requiredEventLines) {
    assert.ok(constantsSource.includes(expectedLine), `missing constants contract line: ${expectedLine}`);
  }
});
