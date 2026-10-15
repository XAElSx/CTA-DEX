const API = 'https://pokeapi.co/api/v2/pokedex/';
const SPRITE_BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon';
const STATES = ['none', 'caught', 'shiny'];
const BOX_SIZE = 30;

// value = PokéAPI pokedex name (also the DB key prefix)
const GAMES = [
  ['national', 'National'],
  ['kanto', 'Red / Blue / Yellow / FireRed / LeafGreen'],
  ['original-johto', 'Gold / Silver / Crystal'],
  ['hoenn', 'Ruby / Sapphire / Emerald'],
  ['original-sinnoh', 'Diamond / Pearl'],
  ['extended-sinnoh', 'Platinum'],
  ['updated-johto', 'HeartGold / SoulSilver'],
  ['original-unova', 'Black / White'],
  ['updated-unova', 'Black 2 / White 2'],
  ['kalos-central', 'X / Y — Central'],
  ['kalos-coastal', 'X / Y — Coastal'],
  ['kalos-mountain', 'X / Y — Mountain'],
  ['original-alola', 'Sun / Moon'],
  ['updated-alola', 'Ultra Sun / Ultra Moon'],
  ['letsgo-kanto', "Let's Go Pikachu / Eevee"],
  ['galar', 'Sword / Shield'],
  ['isle-of-armor', 'Sword / Shield — Isle of Armor'],
  ['crown-tundra', 'Sword / Shield — Crown Tundra'],
  ['hisui', 'Legends: Arceus'],
  ['paldea', 'Scarlet / Violet'],
  ['kitakami', 'Scarlet / Violet — Kitakami'],
  ['blueberry', 'Scarlet / Violet — Blueberry']
];

const svg = d => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
const ICONS = {
  list: svg('M3 5h4v3H3zm6 0h12v3H9zm-6 5.5h4v3H3zm6 0h12v3H9zM3 16h4v3H3zm6 0h12v3H9z'),
  grid3: svg('M3 3h5v5H3zm6.5 0h5v5h-5zM16 3h5v5h-5zM3 9.5h5v5H3zm6.5 0h5v5h-5zm6.5 0h5v5h-5zM3 16h5v5H3zm6.5 0h5v5h-5zm6.5 0h5v5h-5z'),
  grid6: svg('M3 4h2.5v2.5H3zm5.2 0h2.5v2.5H8.2zm5.1 0h2.5v2.5h-2.5zm5.2 0H21v2.5h-2.5zM3 10.75h2.5v2.5H3zm5.2 0h2.5v2.5H8.2zm5.1 0h2.5v2.5h-2.5zm5.2 0H21v2.5h-2.5zM3 17.5h2.5V20H3zm5.2 0h2.5V20H8.2zm5.1 0h2.5V20h-2.5zm5.2 0H21V20h-2.5z'),
  box: svg('M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm0 12h-4a3 3 0 0 1-6 0H5V5h14z'),
  check: svg('M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z'),
  chevron: svg('M7.41 15.41 12 10.83l4.59 4.58L18 14l-6-6-6 6z')
};

const VIEWS = {
  list: 'List',
  grid3: 'Grid · 3 columns',
  grid6: 'Grid · 6 columns',
  box: 'Box'
};

const FILTERS = {
  all: () => true,
  caught: s => s !== 'none', // shiny counts as caught
  missing: s => s === 'none',
  shiny: s => s === 'shiny'
};

const spriteFor = (id, state) =>
  state === 'shiny' ? `${SPRITE_BASE}/shiny/${id}.png` : `${SPRITE_BASE}/${id}.png`;

const dexEl = document.getElementById('dex');
const gameEl = document.getElementById('game');
const searchEl = document.getElementById('search');
const tabsEl = document.getElementById('tabs');
const viewBtn = document.getElementById('view-btn');
const viewMenu = document.getElementById('view-menu');
const progressEl = document.getElementById('progress');

let game = localStorage.getItem('game') || 'national';
let filter = localStorage.getItem('filter');
if (!FILTERS[filter]) filter = 'all';
let view = localStorage.getItem('view');
if (!VIEWS[view]) view = 'box';
let status = {};
let list = [];

localStorage.removeItem('species'); // old step-2 cache, replaced by dex:<name>

async function loadDex(name) {
  const cached = localStorage.getItem('dex:' + name);
  if (cached) return JSON.parse(cached);

  const res = await fetch(API + name);
  if (!res.ok) throw new Error('PokéAPI error ' + res.status);
  const data = await res.json();

  const list = data.pokemon_entries.map(e => ({
    num: e.entry_number,
    id: Number(e.pokemon_species.url.split('/').filter(Boolean).pop()),
    name: e.pokemon_species.name
  }));

  localStorage.setItem('dex:' + name, JSON.stringify(list));
  return list;
}

/* ---------- Render ---------- */

function cardHTML(p, pad) {
  const state = status[p.id] || 'none';
  return `
    <div class="card ${state}" data-id="${p.id}" data-state="${state}"
         data-num="${p.num}" data-name="${p.name.replace(/-/g, ' ')}">
      <img src="${spriteFor(p.id, state)}" alt="${p.name}" loading="lazy" crossorigin="anonymous">
      <span class="num">#${String(p.num).padStart(pad, '0')}</span>
      <span class="name">${p.name}</span>
    </div>`;
}

// Collapsed boxes are stored per game: boxes:<game> = [0, 3, ...]
const collapsedKey = () => 'boxes:' + game;
function getCollapsed() {
  try { return new Set(JSON.parse(localStorage.getItem(collapsedKey())) || []); }
  catch { return new Set(); }
}

function boxHTML(chunk, index, pad, collapsed) {
  const closed = collapsed.has(index);
  return `
    <section class="box${closed ? ' collapsed' : ''}" data-box="${index}">
      <button class="box-head" aria-expanded="${!closed}">
        <span class="box-label">${chunk[0].num}-${chunk[chunk.length - 1].num}</span>
        <span class="bar"><span class="bar-fill"></span></span>
        <span class="box-count"></span>
        <span class="chevron">${ICONS.chevron}</span>
      </button>
      <div class="box-grid">${chunk.map(p => cardHTML(p, pad)).join('')}</div>
    </section>`;
}

function render() {
  const pad = list.length >= 1000 ? 4 : 3;
  dexEl.className = 'view-' + view;

  if (view === 'box') {
    const collapsed = getCollapsed();
    const boxes = [];
    for (let i = 0; i < list.length; i += BOX_SIZE) {
      boxes.push(boxHTML(list.slice(i, i + BOX_SIZE), i / BOX_SIZE, pad, collapsed));
    }
    dexEl.innerHTML = boxes.join('');
  } else {
    dexEl.innerHTML = list.map(p => cardHTML(p, pad)).join('');
  }
  applyFilters();
  updateProgress();
}

function applyFilters() {
  const q = searchEl.value.trim().toLowerCase().replace(/^#/, '').replace(/-/g, ' ');
  const isNum = /^\d+$/.test(q);
  const keep = FILTERS[filter];

  dexEl.querySelectorAll('.card').forEach(card => {
    const match = !q ||
      (isNum ? Number(q) === Number(card.dataset.num) : card.dataset.name.includes(q));
    card.hidden = !(match && keep(card.dataset.state));
  });

  // Box view: hide boxes with no visible cards; open all boxes while searching
  dexEl.classList.toggle('searching', !!q);
  dexEl.querySelectorAll('.box').forEach(box => {
    box.hidden = !box.querySelector('.card:not([hidden])');
  });
}

function updateProgress() {
  const total = list.length;
  const caught = list.filter(p => status[p.id]).length;
  const shiny = list.filter(p => status[p.id] === 'shiny').length;
  const pct = total ? Math.floor((caught / total) * 100) : 0;
  progressEl.querySelector('#progress-count').innerHTML =
    `<b>${caught}</b> / ${total}${shiny ? ` <span class="shiny-count">★ ${shiny}</span>` : ''}`;
  progressEl.querySelector('.bar-fill').style.width = pct + '%';
  progressEl.querySelector('#progress-pct').textContent = pct + '%';

  // Box counts use every card in the box, not just the visible ones
  dexEl.querySelectorAll('.box').forEach(box => {
    const cards = box.querySelectorAll('.card');
    const done = [...cards].filter(c => c.dataset.state !== 'none').length;
    box.querySelector('.box-count').textContent = `${done}/${cards.length}`;
    box.querySelector('.bar-fill').style.width = (done / cards.length) * 100 + '%';
  });
}

// After a sync/import: update only the cards whose state changed.
document.addEventListener('dex-synced', async () => {
  const name = game;
  const saved = await getAllStatus(name);
  if (game !== name) return;
  status = saved;
  dexEl.querySelectorAll('.card').forEach(card => {
    const state = status[card.dataset.id] || 'none';
    if (card.dataset.state !== state) applyState(card, state);
  });
  applyFilters();
  updateProgress();
});

function applyState(card, state) {
  card.classList.remove(...STATES);
  card.classList.add(state);
  card.dataset.state = state;
  card.querySelector('img').src = spriteFor(card.dataset.id, state);
}

/* ---------- Tap handling ---------- */

dexEl.addEventListener('click', async e => {
  const head = e.target.closest('.box-head');
  if (head) return toggleBox(head.parentElement);

  const card = e.target.closest('.card');
  if (!card) return;

  const id = Number(card.dataset.id);
  const prev = card.dataset.state;
  const next = STATES[(STATES.indexOf(prev) + 1) % STATES.length];

  setCard(card, id, next);

  try {
    await setStatus(game, id, next);
    scheduleSync();
  } catch (err) {
    setCard(card, id, prev);
    alert('Could not save: ' + err.message);
  }
});

function toggleBox(box) {
  const index = Number(box.dataset.box);
  const closed = box.classList.toggle('collapsed');
  box.querySelector('.box-head').setAttribute('aria-expanded', !closed);

  const collapsed = getCollapsed();
  if (closed) collapsed.add(index);
  else collapsed.delete(index);
  localStorage.setItem(collapsedKey(), JSON.stringify([...collapsed]));
}

function setCard(card, id, state) {
  applyState(card, state);
  if (state === 'none') delete status[id];
  else status[id] = state;
  applyFilters();
  updateProgress();
}

/* ---------- Game, tabs, view menu ---------- */

async function showGame(name) {
  game = name;
  localStorage.setItem('game', name);
  dexEl.className = '';
  dexEl.textContent = 'Loading…';
  try {
    const [entries, saved] = await Promise.all([loadDex(name), getAllStatus(name)]);
    if (game !== name) return; // user switched again while loading
    list = entries;
    status = saved;
    searchEl.value = '';
    render();
  } catch (err) {
    if (game === name) dexEl.textContent = 'Could not load: ' + err.message;
  }
}

gameEl.innerHTML = GAMES.map(([value, label]) =>
  `<option value="${value}">${label}</option>`).join('');
if (!GAMES.some(([value]) => value === game)) game = 'national';
gameEl.value = game;
gameEl.addEventListener('change', () => showGame(gameEl.value));

function showTabs() {
  tabsEl.querySelectorAll('.tab').forEach(tab =>
    tab.setAttribute('aria-selected', tab.dataset.filter === filter));
}

tabsEl.addEventListener('click', e => {
  const tab = e.target.closest('.tab');
  if (!tab) return;
  filter = tab.dataset.filter;
  localStorage.setItem('filter', filter);
  showTabs();
  applyFilters();
});

searchEl.addEventListener('input', applyFilters);

function showViewMenu() {
  viewBtn.innerHTML = ICONS[view];
  viewMenu.innerHTML = Object.entries(VIEWS).map(([key, label]) => `
    <button class="view-opt" role="menuitemradio" data-view="${key}" aria-checked="${key === view}">
      ${ICONS[key]}<span>${label}</span><span class="check">${ICONS.check}</span>
    </button>`).join('');
}

function openMenu(open) {
  viewMenu.hidden = !open;
  viewBtn.setAttribute('aria-expanded', open);
  if (open) viewMenu.querySelector('[aria-checked="true"]').focus();
}

viewBtn.addEventListener('click', e => {
  e.stopPropagation();
  openMenu(viewMenu.hidden);
});

viewMenu.addEventListener('click', e => {
  const opt = e.target.closest('.view-opt');
  if (!opt) return;
  openMenu(false);
  if (opt.dataset.view === view) return;
  view = opt.dataset.view;
  localStorage.setItem('view', view);
  showViewMenu();
  if (list.length) render();
});

document.addEventListener('click', e => {
  if (!viewMenu.hidden && !e.target.closest('.view-wrap')) openMenu(false);
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !viewMenu.hidden) {
    openMenu(false);
    viewBtn.focus();
  }
});

showTabs();
showViewMenu();
showGame(game);

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
