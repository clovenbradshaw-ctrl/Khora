// App Builder bootstrap. No bundler, no framework: plain ES modules loaded
// straight from the repo's own src/, same "no build" approach the rest of
// this project uses (see README's Layout section). Open this page through a
// static file server (e.g. `npx serve .` from the repo root) — the browser's
// module loader needs http(s), not file://, to resolve these imports.

import {
  createBuilderState,
  setSite,
  addSurface,
  removeSurface,
  addBinding,
  removeBinding,
  validateBuilderState,
  surfaceFieldRequirements,
  KNOWN_SURFACE_TYPES,
} from '../../src/builder/appspec-builder.js';
import { OPERATOR_CODES } from '../../src/kernel/operators.js';
import { InMemoryLog } from '../../src/kernel/log.js';
import { generate } from '../../src/generator/generate.js';
import { instantiateSurfaces } from '../../src/builder/instantiate.js';
import { mountPreview } from '../../src/builder/preview.js';

let state = createBuilderState();

const $ = (id) => document.getElementById(id);

function fillOptions(select, values) {
  select.innerHTML = values.map((v) => `<option value="${v}">${v}</option>`).join('');
}
fillOptions($('surface-type'), KNOWN_SURFACE_TYPES);
fillOptions($('binding-op'), OPERATOR_CODES);

function renderSurfaceExtra() {
  const type = $('surface-type').value;
  const extraFields = surfaceFieldRequirements(type).filter((f) => f !== 'class');
  $('surface-extra').innerHTML = extraFields
    .map(
      (field) =>
        `<label>${field}</label><input id="surface-extra-${field}" placeholder="${
          field === 'operator' ? 'INS or DEF' : field
        }">`,
    )
    .join('');
}
$('surface-type').addEventListener('change', renderSurfaceExtra);
renderSurfaceExtra();

function renderLists() {
  $('surface-list').innerHTML = state.surfaces
    .map(
      (s, i) =>
        `<li><span>${s.type} — ${s.room}</span><button data-remove-surface="${i}">✕</button></li>`,
    )
    .join('');
  $('binding-list').innerHTML = state.bindings
    .map(
      (b, i) => `<li><span>${b.on} → ${b.op}</span><button data-remove-binding="${i}">✕</button></li>`,
    )
    .join('');

  $('surface-list').querySelectorAll('[data-remove-surface]').forEach((btn) =>
    btn.addEventListener('click', () => {
      state = removeSurface(state, Number(btn.dataset.removeSurface));
      renderLists();
    }),
  );
  $('binding-list').querySelectorAll('[data-remove-binding]').forEach((btn) =>
    btn.addEventListener('click', () => {
      state = removeBinding(state, Number(btn.dataset.removeBinding));
      renderLists();
    }),
  );
}
renderLists();

$('site-save').addEventListener('click', () => {
  state = setSite(state, {
    space_or_room: $('site-room').value,
    visibility: $('site-visibility').value,
    power_template: $('site-power-template').value,
  });
});

$('surface-add').addEventListener('click', () => {
  const type = $('surface-type').value;
  const surface = { type, room: $('surface-room').value, class: $('surface-class').value };
  for (const field of surfaceFieldRequirements(type).filter((f) => f !== 'class')) {
    const input = $(`surface-extra-${field}`);
    if (input) surface[field] = input.value;
  }
  state = addSurface(state, surface);
  renderLists();
});

// A target field may be a literal string or a `payload => ...` expression —
// evaluated once, here, at binding-definition time, never against untrusted
// remote input, so a Function constructor is an acceptable authoring
// convenience for this local builder page rather than a security boundary.
function parseTarget(raw) {
  const trimmed = raw.trim();
  if (trimmed.includes('=>')) {
    // eslint-disable-next-line no-new-func
    return new Function('return (' + trimmed + ')')();
  }
  return trimmed;
}

$('binding-add').addEventListener('click', () => {
  state = addBinding(state, {
    on: $('binding-on').value,
    op: $('binding-op').value,
    address: {
      mode: Number($('binding-mode').value),
      domain: Number($('binding-domain').value),
      object: Number($('binding-object').value),
    },
    target: parseTarget($('binding-target').value || ''),
    mode_of_givenness: $('binding-mog').value,
    context: $('binding-context').value,
  });
  renderLists();
});

$('build-app').addEventListener('click', async () => {
  const { valid, errors, residue, spec } = validateBuilderState(state);
  $('spec-json').textContent = JSON.stringify(spec, null, 2);

  if (!valid) {
    $('build-status').innerHTML = `<div class="errors">${errors.map((e) => `• ${e}`).join('<br>')}</div>`;
    $('preview-root').innerHTML = '';
    return;
  }

  const log = new InMemoryLog();
  const result = generate(spec, { log });
  if (!result.ok) {
    $('build-status').innerHTML = `<div class="errors">generate() rejected: ${result.errors.join('; ')}</div>`;
    return;
  }
  $('build-status').innerHTML = '<div class="ok">Built. Preview is live below — actions really append to the log.</div>';

  const instances = instantiateSurfaces(result, log);
  await mountPreview(
    instances,
    $('preview-root'),
    { agent: 'builder-preview-user', mode_of_givenness: 'direct-entry', context: 'app-builder-preview' },
    spec.cells[0]?.address,
  );
});
