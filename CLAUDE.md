# CTA Dex

Personal Pokédex tracker modeled on CTA Dex. Static web app (HTML/CSS/JS), later a PWA for Windows PC and Android.

## Stack
- Plain HTML, CSS, vanilla JS — no framework, no build step
- Data: PokéAPI (species list cached in localStorage), sprites from PokeAPI/sprites on GitHub
- Storage: IndexedDB via `js/db.js` (`getAllStatus`, `setStatus`)
- Local server: `python -m http.server 8000`
- Live: https://xaelsx.github.io/CTA-DEX/ (GitHub Pages, deploys from `main` / root on push). Keep all paths relative — the site lives under `/CTA-DEX/`
- Shell: Windows PowerShell

## Files
- `index.html` — loads `js/db.js`, then `js/sync.js`, then `js/app.js` (order matters)
- `js/db.js` — all IndexedDB code (`getAllStatus`, `setStatus`, `getAllRecords`, `putRecords`)
- `js/sync.js` — Gist sync + export/import; merge per record, newer `updated` wins. Fires `dex-synced` when local data changed
- `js/app.js` — load, render, click handling
- View modes (`list`, `grid3`, `grid6`, `box`) saved in localStorage `view`; Box = groups of 30, collapsed boxes saved per game in `boxes:<game>`
- `ref/` — design screenshots, git-ignored (not published)
- `css/style.css` — styling
- `sw.js` — service worker: app files network-first, sprites cache-first. Bump `SHELL_CACHE` when the file list changes
- `manifest.webmanifest`, `icons/` — PWA install data

## Card states
`none → caught → shiny → none`. Shiny counts as caught. `none` is stored as a tombstone record (not deleted) so un-marking syncs too; `getAllStatus` hides it. Each record has an `updated` timestamp for sync later.

Marks are per game. DB key is `<dex>:<speciesId>` (e.g. `national:25`, `paldea:25`), where `<dex>` is the PokéAPI pokedex name. DB v2 migrated v1 numeric ids to `national:<id>`.

## Roadmap
1. Setup ✅
2. Grid from PokéAPI ✅
3. Caught/shiny + IndexedDB ✅
4. Dex per game ✅
5. Filters + search + progress counter ✅
6. PWA ✅
7. Deploy to GitHub Pages ✅
8. Sync between devices ✅

## How to work with me
- One step at a time. Show the step, then wait for me to reply **y** before the next one.
- Explain what each extra part does and why the step is needed (short tables are fine).
- Keep text minimal and structured.
- Ask before running git commit or push.
