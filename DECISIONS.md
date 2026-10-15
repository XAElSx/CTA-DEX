# Decisions

Choices made where the spec was unclear or conflicted with the existing app.

## Name change
- IndexedDB renamed `cta-dex` → `mydex`. On first start, records from the old database are copied once, newest `updated` wins (flag: localStorage `dbMigrated`). The old database is not deleted, so it stays as a backup.
- Kept as `cta-dex` on purpose: the gist file `cta-dex.json` and the `app` field in sync/export files. The existing gist and devices still on an older version look for these names. Import accepts both `cta-dex` and `mydex`.
- No localStorage key contained the old name, so none were renamed.
