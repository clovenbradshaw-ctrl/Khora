# Any-Data Mini-Site Builder: Ingestion & Architecture Guide

A "mini site" here means: point at a data source, get back a small living page (dashboard, table, map, or feed) that stays current on a schedule. Two hard problems drive the whole architecture: **getting the data in**, and **where you ask the user for it**. Everything below is stack-agnostic — the patterns matter more than the language.

This is a reference document only — nothing in this repo currently implements it. See `public-api-catalog.json` in this same directory for the seed catalog the "search your catalog" intake path below is meant to load.

## Where the user gives you the data

Put data-source selection **first in the wizard, before template or theme.** The shape of the data determines which templates are even valid — you can't offer a map template for a single scalar value, or a single-stat template for a 40,000-row dataset — so "what does this look like?" has to be answered before "how should it look?"

One step, one field, four accepted input shapes, offered in this order:

1. **Paste a link** (default, lowest-effort). One text input. Accept anything: a REST/JSON endpoint, a raw CSV/JSON/XLSX/GeoJSON file, an RSS/Atom feed, a Socrata or CKAN dataset *page* (resolve it — don't require the raw API URL), a public Google Sheet link, or an ArcGIS Feature/MapServer layer URL.
2. **Upload a file** — CSV, JSON, XLSX, GeoJSON. For anything that isn't already sitting at a URL.
3. **Search your catalog** — a pre-vetted, pre-classified registry inside the app itself. This is what makes "any data source" survivable for non-technical users: they type "weather" or "my city's crime data," never see a URL, and land on something you've already verified works.
4. **Connect an account** — offered last, only when 1–3 can't satisfy the request (their own Notion, their own Analytics). This is the only path that needs OAuth — hand it to a managed-auth broker rather than building a token vault (see Lane 3 below).

The moment something is submitted, kick off classification and show a live preview *before* asking for a site name or theme. Confirm you understood their data before asking them to invest in styling it.

## Classifying whatever they hand you

A cheap, ordered sniff — not a single content-type check:

1. Probe with `?f=json`. If the response has `fields` / `geometryType` keys, it's an **ArcGIS** Feature/MapServer layer. Pull with `/query?where=1=1&outFields=*&f=geojson`.
2. URL matches `/resource/{id}.json`, or the response envelope looks like Socrata → **Socrata/SODA**.
3. Response envelope is `{"success":true,"result":{...}}` or the URL contains `/api/3/action/` → **CKAN**.
4. Content-Type is `text/csv` → **CSV**. `application/json` → generic JSON; inspect further for `FeatureCollection` (GeoJSON) vs. array-of-objects (table) vs. single object (a "stat" site).
5. Root element is `<rss>` or `<feed>`, or Content-Type is `application/*+xml` → **feed**.
6. Google Sheets share link → rewrite to its `/gviz/tq?tqx=out:json` export endpoint.
7. Anything else: show the raw response and let the user point-and-click the fields that matter. This manual picker is your escape hatch — you will never auto-classify 100% of "any data source."

```js
async function classify(input) {
  if (input.file) return classifyFile(input.file);
  const probe = await lightFetch(input.url); // small, fast request — don't pull the whole payload yet
  if (looksLikeArcGIS(probe))       return { kind: 'arcgis',  ...arcgisMeta(probe) };
  if (looksLikeSocrata(input.url))  return { kind: 'socrata', ...socrataMeta(probe) };
  if (looksLikeCKAN(probe))         return { kind: 'ckan',    ...ckanMeta(probe) };
  if (isFeed(probe))                return { kind: 'feed' };
  if (isCSV(probe))                 return { kind: 'csv' };
  if (isJSON(probe))                return { kind: 'json', shape: inferShape(probe) };
  return { kind: 'unknown', raw: probe }; // hand off to the manual picker
}
```

## Normalize before you render

Whatever came in, convert it to one internal shape so the renderer never has to know where it originated:

```json
{
  "meta": { "source_kind": "socrata", "source_url": "...", "fetched_at": "...", "refresh_interval": 3600 },
  "shape": "table",
  "fields": [{ "name": "case_number", "type": "string" }],
  "rows": [{ "case_number": "..." }],
  "geometry": null
}
```

A new source type later means one new adapter that outputs this shape. The renderer, the templates, and the refresh logic never have to change.

## The three-lane fetch model

- **Lane 1 — No-auth.** Call it directly, server-side, cache aggressively. Most government, science, and reference data lives here.
- **Lane 2 — Instant free key.** Two real options, pick by expected volume:
  - *Pooled*: one app-wide key behind a global rate budget and a queue. Fine at low scale.
  - *User-owned*: prompt once for their own free key via an in-app "get a key" deep link, store it encrypted, scoped to their account.

  Flag this to whoever builds it: **a shared pooled key is the single most common way these apps fall over in production.** A few hundred mini-sites all polling the same free-tier key on independent schedules will exhaust it fast. Decide which model you're using before launch, not after the first rate-limit incident.
- **Lane 3 — Per-user identity (OAuth).** Don't build a token vault. Route through a managed-auth layer (Pipedream Connect, Composio, Nango) and store only the reference token they hand back.

## Security — "fetch whatever URL a stranger gives you" is a real attack surface

- **SSRF.** Your server is about to fetch arbitrary user-supplied URLs. Resolve DNS yourself before connecting and reject private/link-local ranges — `127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, and especially `169.254.169.254` (the cloud-metadata address that's the actual target in most real-world SSRF incidents). Re-validate the resolved IP after every redirect — checking only the original hostname is the classic DNS-rebinding bypass. Simplest fix: run the fetcher as its own network-isolated service, not inside your main app.
- **Output encoding.** Every field pulled from a user's data source is untrusted text the moment it reaches your renderer. Escape before interpolating into HTML, or a data value that happens to contain a script tag will run one.
- **Credential storage.** Encrypt Lane 2/3 secrets at rest, scope OAuth grants to the minimum the provider allows, never log them.
- **If any part of classification is LLM-assisted** (matching a natural-language request to a catalog entry, auto-picking a template from a schema): treat fetched content as data, never as instructions. Real example from testing this exact pattern days ago — a vendor's page contained text addressed directly to AI agents, instructing them to sign themselves up for an account without asking a human first. It's a live preview of what a scraped field can try to smuggle into a prompt if your pipeline concatenates fetched text into the instruction portion rather than keeping it in a clearly delimited data slot.

## Keeping it fresh

- Set `refresh_interval` per source by volatility, not a global default — a sensor feed and a monthly government release shouldn't poll on the same clock.
- Snapshot every fetch to cheap storage (a blob plus a row per fetch) instead of overwriting in place. This is the same git-scraping logic used in data journalism, and it buys you "updated 3 hours ago," a real change history, and the ability to show drift over time — for free.
- Prefer webhooks over polling wherever a source offers them; rare, but some Socrata and ArcGIS Hub items support it.

## What to ship on day one

| Source kind | Why it's worth the adapter |
|---|---|
| Generic CSV / JSON / GeoJSON URL | Covers a surprising majority with the least code |
| RSS / Atom | Cheap, covers every news- or blog-style mini-site |
| Socrata | One adapter, hundreds of city/state portals |
| CKAN | One adapter, data.gov plus most state portals |
| ArcGIS REST (Feature/MapServer) | One adapter, nearly every US local-government GIS layer |
| Google Sheets (public) | The "my aunt's spreadsheet" case — don't skip it |

Leave OAuth-gated sources (Lane 3) for v2. They're the smallest share of real "any data source" requests and by far the most expensive to build and maintain.

---

**Checklist:** data-source field before template selection · four intake paths in that priority order · sniff-then-normalize into one internal shape · three-lane fetch with the pooled-key trap flagged explicitly · SSRF-hardened, network-isolated fetcher · encoded output · snapshot-based refresh with real change history.
