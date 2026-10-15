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

## Part B
- **B1 Origin.** Stored as `origin` on the existing per-dex record (a short game code such as `SV`, shown as the tag). Saving uses read-modify-write, so tapping a card keeps its origin and the other way round; it syncs like any other change. The tag stays when a card is un-caught (the origin is not deleted by accident). The sheet is a native `<dialog>`: a bottom sheet on phones, centred on wide screens. The "i" button is 44 px in List view, 28 px in Grid · 3, but only 15 px in the 6-column views (Grid · 6, Box): a cell there is about 50 px wide at 360 px, so a 44 px button would cover the sprite. Use List view for easier tapping. Game list is main-series games plus GO and "Other".
- **B2 Box view** already existed (boxes of 30, 6 columns, collapsible, per-box progress). Only added the "Box N" header; the number range stays next to it.
- **B3 Compact view** already exists as the view menu (List, Grid · 3, Grid · 6, Box), remembered in localStorage. Kept as a 4-way switch instead of 3-way: it already includes Grid, Box and List. Not changed.
- **B4 Missing only** already exists as the "Missing" tab (All / Caught / Missing / Shiny). Not changed.
- **B5 Version exclusives.** `data/exclusives.json` covers Red/Blue, X/Y, Sun/Moon, Sword/Shield and Scarlet/Violet (base games). JSON has no comments, so the source note is in a `"_source"` field. Lists are from Serebii's exclusives pages; Red/Blue are the international lists. Left out: species whose *form* differs per version (Tauros in SV, Basculin and Indeedee in SwSh) and Mega Evolutions, since marks are per species. Dex → pair: `kanto` → Red/Blue (the dropdown also covers Yellow/FRLG, whose exclusives differ), `kalos-*` → X/Y, `original-alola` → Sun/Moon, `galar` → Sword/Shield, `paldea` → Scarlet/Violet. DLC dexes and other games get no badges. If the file fails to load, cards simply show no badges.
- **B6 Display names.** `js/names.js` title-cases API names and has a map only for names that need more than that (hyphens kept, punctuation, ♀/♂, accents). Paradox Pokémon and Tapus need no map entry: "great-tusk" → "Great Tusk". Search ignores case, accents and punctuation and matches both the display name and the API name, so "flabebe", "mr mime" and "farfetchd" all work.
