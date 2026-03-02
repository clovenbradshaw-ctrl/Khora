# Khora Pre-Ship Critical Reliability & Security Framework

This framework defines release-blocking checks for the **actual app contracts** that keep Khora secure and usable.

## P0 Areas (Ship Blockers)

1. **Auth/session safety**
   - Session data must be persisted in `sessionStorage` (not durable local auth by default).
   - Restore path must validate token via Matrix `whoami`.
   - Expired vs transient network failures must be distinguishable in UI handling.

2. **Encrypted transport guarantees**
   - Sending into encrypted rooms must fail closed when crypto is unavailable.
   - No plaintext REST fallback is allowed for encrypted room sends.

3. **Data lifecycle integrity**
   - Client vault data must be written to Matrix state (`EVT.VAULT_SNAPSHOT`).
   - After save, local React state must be updated to reflect persisted snapshot.

4. **Render integrity**
   - App must mount to root and include event rendering paths for core user-visible records (notes/resources/activity).

5. **Schema/event contract stability**
   - Core event constants used by create/save/render flows must remain defined.

## Executable Release Gate

Run:

```bash
npm run test:critical
```

This suite (`scripts/critical-smoke.test.mjs`) validates contracts directly against:
- `app/auth.js`
- `app/service.js`
- `app/client.js`
- `app/app.js`
- `app/constants.js`

## Required Pre-Release Evidence

For each critical entity (vault profile, observation, case note):
1. **Create** in UI.
2. **Save** and verify Matrix state event exists.
3. **Reload** session.
4. **Render** value appears in relevant view.
5. **Edit** value and verify updated render.

If any step fails for any P0 entity, release is blocked.

## Operating Cadence

- **Every commit:** run `npm run test:critical`.
- **Every PR:** include command output and any known limitations.
- **Before release tag:** run critical test suite + manual create/save/reload/render walkthrough.
