// The "search your catalog" intake path from docs/data/mini-site-builder-guide.md:
// a non-technical user types "weather" or "my city's crime data" and never
// sees a URL. This is the matching logic that path needs, factored out so
// it composes with src/surfaces/table.js's read({ filter }) rather than
// requiring a bespoke surface — a catalog row is just a table row.

function normalize(value) {
  return String(value ?? '').toLowerCase();
}

// True if a catalog row's name/category/id/notes contains the query
// (case-insensitive substring match — cheap, no index, fine for ~35 rows).
export function matchesCatalogQuery(row, query) {
  const needle = normalize(query).trim();
  if (!needle) return true;
  const source = row?.operand ?? row;
  const haystack = [source?.name, source?.category, source?.id, source?.notes].map(normalize).join(' | ');
  return haystack.includes(needle);
}

// A ready-to-use `query.filter` for Table's read(), e.g.
// tableSurface.read({ filter: catalogFilter('weather') }).
export function catalogFilter(query) {
  return (entry) => matchesCatalogQuery(entry, query);
}

export function searchCatalog(rows, query) {
  return rows.filter((row) => matchesCatalogQuery(row, query));
}
