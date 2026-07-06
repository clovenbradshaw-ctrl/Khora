// Canonicalization: a stable byte string for an entry, identical across
// serializations of the same logical content. The publishability predicate
// and CON-grounding checks (Part 3) rest on this — a hash that shifts with
// key order makes those references flaky.

function sortDeep(value) {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = sortDeep(value[key]);
        return acc;
      }, {});
  }
  return value;
}

export function canonicalize(entry) {
  return JSON.stringify(sortDeep(entry));
}

export async function canonicalHash(entry) {
  const bytes = new TextEncoder().encode(canonicalize(entry));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
