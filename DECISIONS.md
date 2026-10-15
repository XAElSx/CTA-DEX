# Decisions

Choices made where the spec was unclear or conflicted with the existing app.

## Name change
- IndexedDB renamed `cta-dex` → `mydex`. On first start, records from the old database are copied once, newest `updated` wins (flag: localStorage `dbMigrated`). The old database is not deleted, so it stays as a backup.
- Kept as `cta-dex` on purpose: the gist file `cta-dex.json` and the `app` field in sync/export files. The existing gist and devices still on an older version look for these names. Import accepts both `cta-dex` and `mydex`.
- No localStorage key contained the old name, so none were renamed.

## Part A
- **Record shape kept.** Records stay `{ id: '<dex>:<speciesId>', state: 'none'|'caught'|'shiny', updated }` instead of `{ id, caught, shiny, origin, updatedAt }` keyed by species id. Per-dex marks, tombstones and Gist sync already depend on it; changing it would split data across devices. `state` covers caught + shiny (shiny implies caught). `origin` is added as an extra field (Part B1).
- **Tap / long press.** Tap toggles caught (a shiny card goes back to not caught). Long press (500 ms, touch and mouse) toggles shiny (shiny → caught). Moving the finger more than 10 px cancels the long press, so scrolling still works. The old tap cycle (caught → shiny → none) is replaced.
- **ES modules.** The constraints ask for `db.js`, `api.js`, `ui.js`, `app.js` as ES modules, so the classic scripts were converted. `sync.js` stays its own module. Behaviour of existing code is unchanged.
- **API cache.** PokéAPI responses are stored in IndexedDB store `api` (keyed by URL). The old localStorage `dex:<name>` lists are moved there once and removed. Preferences (`game`, `view`, `filter`, `boxes:*`, gist settings) stay in localStorage.
- **Existing, left alone:** dex selector (22 dexes, remembered), search by name or number, import with merge, lazy-loaded sprites.
- **Export** file is now `mydex-backup-YYYY-MM-DD.json` (local date); the time of the last export is stored in localStorage `lastExport`.
