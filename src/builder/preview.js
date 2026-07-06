// Real, working DOM previews for the App Builder — deliberately not another
// "browser-only stub" like src/surfaces/*.js's render() functions (those are
// documented intentions for a future framework mount). This module exists so
// a person building an app in the browser sees it actually run: add a row,
// submit a form, watch the entry land through the real validateBinding /
// log.append path used by generate(). Only Table and Form get a real mount
// here — Chart/Map/Feed/Tier2 fall back to an explicit "no preview yet"
// notice rather than pretending to render something they don't.

function assertBrowser(fnName) {
  if (typeof document === 'undefined') {
    throw new Error(`${fnName} requires a browser DOM; there is none in this environment`);
  }
}

const PREVIEWABLE_TYPES = Object.freeze(['Table', 'Form']);

export function isPreviewable(surfaceType) {
  return PREVIEWABLE_TYPES.includes(surfaceType);
}

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === 'text') node.textContent = value;
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value);
  }
  for (const child of children) node.appendChild(child);
  return node;
}

// Mounts a Table surface: a live grid of already-appended rows plus an
// "add row" form that calls `surface.bindings.addRow` with a provenance
// envelope, exactly the payload shape src/surfaces/table.js expects.
// `address` is the legal EO address this surface's writes are cataloged
// under (one of the AppSpec's `cells` — see src/builder/appspec-builder.js's
// `cellsFromBindings`) since a write can't be validated without one and
// there is no existing row to infer it from before the first write.
export async function renderTablePreview(surface, container, provenance, address) {
  assertBrowser('renderTablePreview');
  container.innerHTML = '';

  const rows = await surface.read();
  const table = el('table', { class: 'eo-preview-table' });
  const header = el('tr', {}, [el('th', { text: 'id' }), el('th', { text: 'target' }), el('th', { text: 'operand' })]);
  table.appendChild(header);
  for (const row of rows) {
    table.appendChild(
      el('tr', {}, [
        el('td', { text: String(row.id) }),
        el('td', { text: String(row.target ?? '') }),
        el('td', { text: JSON.stringify(row.operand ?? null) }),
      ]),
    );
  }
  container.appendChild(table);

  const targetInput = el('input', { placeholder: 'row id (e.g. p-1)' });
  const operandInput = el('input', { placeholder: 'operand JSON, e.g. {"note":"x"}' });
  const status = el('div', { class: 'eo-preview-status' });
  const addButton = el('button', {
    text: 'Add row',
    onclick: async () => {
      let operand = null;
      try {
        operand = operandInput.value ? JSON.parse(operandInput.value) : null;
      } catch {
        status.textContent = 'operand must be valid JSON';
        return;
      }
      const result = await surface.bindings.addRow(
        { address, target: targetInput.value, operand },
        provenance,
      );
      status.textContent = result.appended ? 'added' : `rejected: ${result.errors?.join('; ')}`;
      if (result.appended) await renderTablePreview(surface, container, provenance, address);
    },
  });
  container.appendChild(el('div', { class: 'eo-preview-form' }, [targetInput, operandInput, addButton, status]));
}

// Mounts a Form surface: a minimal target/operand intake that calls
// `surface.bindings.submit`, and a list of what's already landed. `address`
// is the write address, same rationale as `renderTablePreview`'s.
export async function renderFormPreview(surface, container, provenance, address) {
  assertBrowser('renderFormPreview');
  container.innerHTML = '';

  const submissions = await surface.read();
  const list = el(
    'ul',
    { class: 'eo-preview-list' },
    submissions.map((s) => el('li', { text: `${s.id}: ${s.target} -> ${JSON.stringify(s.operand ?? null)}` })),
  );
  container.appendChild(list);

  const targetInput = el('input', { placeholder: 'target (e.g. tip:1)' });
  const operandInput = el('input', { placeholder: 'operand JSON' });
  const status = el('div', { class: 'eo-preview-status' });
  const submitButton = el('button', {
    text: 'Submit',
    onclick: async () => {
      let operand = null;
      try {
        operand = operandInput.value ? JSON.parse(operandInput.value) : null;
      } catch {
        status.textContent = 'operand must be valid JSON';
        return;
      }
      const result = await surface.bindings.submit({ address, target: targetInput.value, operand }, provenance);
      status.textContent = result.appended ? 'submitted' : `rejected: ${result.errors?.join('; ')}`;
      if (result.appended) await renderFormPreview(surface, container, provenance, address);
    },
  });
  container.appendChild(el('div', { class: 'eo-preview-form' }, [targetInput, operandInput, submitButton, status]));
}

// Mounts every previewable surface from a `generate()` result into a
// container, one labeled section per surface; anything not in
// PREVIEWABLE_TYPES gets an explicit "no preview yet" notice instead of
// silence. `defaultAddress` is the AppSpec's first cell address (see
// src/builder/appspec-builder.js), used as every previewed surface's write
// address — good enough for a single-address demo app; a multi-cell app
// would need a per-surface address, which this builder doesn't collect yet.
export async function mountPreview(surfaceInstances, container, provenance, defaultAddress) {
  assertBrowser('mountPreview');
  container.innerHTML = '';
  for (const { type, spec, instance } of surfaceInstances) {
    const section = el('section', { class: 'eo-preview-surface' }, [
      el('h3', { text: `${type} — ${spec.room}` }),
    ]);
    const body = el('div');
    section.appendChild(body);
    container.appendChild(section);

    if (type === 'Table') await renderTablePreview(instance, body, provenance, defaultAddress);
    else if (type === 'Form') await renderFormPreview(instance, body, provenance, defaultAddress);
    else body.appendChild(el('p', { class: 'eo-preview-unsupported', text: `No live preview for ${type} yet.` }));
  }
}
