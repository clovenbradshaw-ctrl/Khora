import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { InMemoryLog } from '../../src/kernel/log.js';
import { createTableSurface } from '../../src/surfaces/table.js';
import { ingestCatalog } from '../../src/data-sources/ingest.js';
import { matchesCatalogQuery, catalogFilter, searchCatalog } from '../../src/data-sources/search.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const catalogPath = path.resolve(here, '../../docs/data/public-api-catalog.json');
const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'));

const provenance = { agent: 'system:catalog-loader', mode_of_givenness: 'catalog-import', context: 'public-api-catalog' };

describe('matchesCatalogQuery', () => {
  it('matches by name, category, id, or notes, case-insensitively', () => {
    const row = { operand: { name: 'USGS Earthquake Feed', category: 'earth', id: 'usgs-earthquakes', notes: 'Real-time GeoJSON.' } };
    expect(matchesCatalogQuery(row, 'earthquake')).toBe(true);
    expect(matchesCatalogQuery(row, 'EARTH')).toBe(true);
    expect(matchesCatalogQuery(row, 'geojson')).toBe(true);
    expect(matchesCatalogQuery(row, 'usgs-earthquakes')).toBe(true);
    expect(matchesCatalogQuery(row, 'weather')).toBe(false);
  });

  it('an empty query matches everything', () => {
    expect(matchesCatalogQuery({ operand: { name: 'x' } }, '')).toBe(true);
    expect(matchesCatalogQuery({ operand: { name: 'x' } }, undefined)).toBe(true);
  });
});

describe('searchCatalog + catalogFilter against the real catalog loaded into a Table surface', () => {
  it('"weather" finds the weather sources without seeing a URL', async () => {
    const log = new InMemoryLog();
    const surface = createTableSurface({ log });
    await ingestCatalog(catalog.sources, surface, provenance);

    const rows = await surface.read({ filter: catalogFilter('weather') });
    const ids = rows.map((r) => r.operand.id).sort();
    expect(ids).toEqual(['nws-weather', 'open-meteo']);
  });

  it('"legal" finds every source tagged with the legal category', async () => {
    const log = new InMemoryLog();
    const surface = createTableSurface({ log });
    await ingestCatalog(catalog.sources, surface, provenance);

    const rows = await surface.read({ filter: catalogFilter('legal') });
    expect(rows.length).toBeGreaterThanOrEqual(4);
    expect(rows.every((r) => r.operand.category === 'legal')).toBe(true);
  });

  it('searchCatalog is a plain in-memory equivalent for already-fetched rows', async () => {
    const log = new InMemoryLog();
    const surface = createTableSurface({ log });
    await ingestCatalog(catalog.sources, surface, provenance);
    const rows = await surface.read();

    const found = searchCatalog(rows, 'museum');
    expect(found).toHaveLength(1);
    expect(found[0].operand.id).toBe('met-museum');
  });
});
