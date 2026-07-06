import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { InMemoryLog } from '../../src/kernel/log.js';
import { createTableSurface } from '../../src/surfaces/table.js';
import { catalogEntryToRow, ingestCatalog, CATALOG_GROUNDING } from '../../src/data-sources/ingest.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const catalogPath = path.resolve(here, '../../docs/data/public-api-catalog.json');
const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'));

const provenance = { agent: 'system:catalog-loader', mode_of_givenness: 'catalog-import', context: 'public-api-catalog' };

describe('catalogEntryToRow', () => {
  it('maps a source to a legal, non-desert INS row carrying its grounding', () => {
    const [source] = catalog.sources;
    const row = catalogEntryToRow(source);
    expect(row.target).toBe(`catalog:${source.id}`);
    expect(row.operand).toBe(source);
    expect(row.grounding).toEqual(CATALOG_GROUNDING);
    expect(row.address).toEqual({ mode: 2, domain: 0, object: 1 }); // INS x Figure
  });

  it('throws on a source with no id', () => {
    expect(() => catalogEntryToRow({ name: 'no id here' })).toThrow(TypeError);
  });
});

describe('ingestCatalog', () => {
  it('requires an array and a Table surface', async () => {
    const surface = createTableSurface({ log: new InMemoryLog() });
    await expect(ingestCatalog(null, surface, provenance)).rejects.toThrow(TypeError);
    await expect(ingestCatalog(catalog.sources, {}, provenance)).rejects.toThrow(TypeError);
  });

  it('loads every entry in the real public-api-catalog.json as a Table row', async () => {
    const log = new InMemoryLog();
    const surface = createTableSurface({ log });
    const results = await ingestCatalog(catalog.sources, surface, provenance);

    expect(results).toHaveLength(catalog.sources.length);
    expect(results.every((r) => r.appended)).toBe(true);

    const rows = await surface.read();
    expect(rows).toHaveLength(catalog.sources.length);
    expect(rows.map((r) => r.target)).toContain('catalog:nasa-open-apis');
    const nasaRow = rows.find((r) => r.target === 'catalog:nasa-open-apis');
    expect(nasaRow.operand.category).toBe('space');
    expect(nasaRow.given).toEqual({ mode_of_givenness: 'catalog-import', context: 'public-api-catalog' });
    expect(nasaRow.grounding).toEqual(CATALOG_GROUNDING);
  });

  it('re-running ingestion against an already-loaded log skips duplicates', async () => {
    const log = new InMemoryLog();
    const surface = createTableSurface({ log });
    await ingestCatalog(catalog.sources, surface, provenance);

    const second = await ingestCatalog(catalog.sources, surface, provenance);
    expect(second.every((r) => r.skipped)).toBe(true);

    const rows = await surface.read();
    expect(rows).toHaveLength(catalog.sources.length); // not doubled
  });

  it('a desert-bound row would be refused, not silently accepted (sanity check on the write path)', async () => {
    const log = new InMemoryLog();
    const surface = createTableSurface({ log });
    const outcome = await surface.bindings.addRow(
      { address: { mode: 2, domain: 1, object: 0 }, target: 'catalog:bad', operand: {} }, // SYN x Ground
      provenance,
    );
    expect(outcome.appended).toBe(false);
  });
});
