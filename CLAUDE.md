# CTA Dex

Personal Pokédex tracker modeled on CTA Dex. Static web app (HTML/CSS/JS), later a PWA for Windows PC and Android.

## Stack
- Plain HTML, CSS, vanilla JS — no framework, no build step
- Data: PokéAPI (species list cached in localStorage), sprites from PokeAPI/sprites on GitHub
- Storage: IndexedDB via `js/db.js` (`getAllStatus`, `setStatus`)
- Local server: `python -m http.server 8000`
- Shell: Windows PowerShell

## Files
- `index.html` — loads `js/db.js` before `js/app.js` (order matters)
- `js/db.js` — all storage code; only file to change for sync (step 8)
- `js/app.js` — load, render, click handling
- `css/style.css` — styling

## Card states
`none → caught → shiny → none`. Shiny counts as caught. `none` is deleted from the DB. Each record has an `updated` timestamp for sync later.

Marks are per game. DB key is `<dex>:<speciesId>` (e.g. `national:25`, `paldea:25`), where `<dex>` is the PokéAPI pokedex name. DB v2 migrated v1 numeric ids to `national:<id>`.

## Roadmap
1. Setup ✅
2. Grid from PokéAPI ✅
3. Caught/shiny + IndexedDB ✅
4. Dex per game ✅
5. Filters + search + progress counter
6. PWA
7. Deploy to GitHub Pages
8. Sync between devices

## How to work with me
- One step at a time. Show the step, then wait for me to reply **y** before the next one.
- Explain what each extra part does and why the step is needed (short tables are fine).
- Keep text minimal and structured.
- Ask before running git commit or push.
