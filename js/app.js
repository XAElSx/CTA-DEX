const API = 'https://pokeapi.co/api/v2/pokedex/';
const SPRITE_BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon';
const STATES = ['none', 'caught', 'shiny'];

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

const spriteFor = (id, state) =>
  state === 'shiny' ? `${SPRITE_BASE}/shiny/${id}.png` : `${SPRITE_BASE}/${id}.png`;

const dexEl = document.getElementById('dex');
const gameEl = document.getElementById('game');
const searchEl = document.getElementById('search');
const filterEl = document.getElementById('filter');
const progressEl = document.getElementById('progress');
let game = localStorage.getItem('game') || 'national';
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

function render() {
  const pad = list.length >= 1000 ? 4 : 3;
  dexEl.innerHTML = list.map(p => {
    const state = status[p.id] || 'none';
    return `
    <div class="card ${state}" data-id="${p.id}" data-state="${state}"
         data-num="${p.num}" data-name="${p.name.replace(/-/g, ' ')}">
      <img src="${spriteFor(p.id, state)}" alt="${p.name}" loading="lazy" crossorigin="anonymous">
      <span class="num">#${String(p.num).padStart(pad, '0')}</span>
      <span class="name">${p.name}</span>
    </div>`;
  }).join('');
  applyFilters();
  updateProgress();
}

const FILTERS = {
  all: () => true,
  caught: s => s !== 'none', // shiny counts as caught
  missing: s => s === 'none',
  shiny: s => s === 'shiny'
};

function applyFilters() {
  const q = searchEl.value.trim().toLowerCase().replace(/^#/, '').replace(/-/g, ' ');
  const isNum = /^\d+$/.test(q);
  const keep = FILTERS[filterEl.value] || FILTERS.all;

  dexEl.querySelectorAll('.card').forEach(card => {
    const match = !q ||
      (isNum ? Number(q) === Number(card.dataset.num) : card.dataset.name.includes(q));
    card.hidden = !(match && keep(card.dataset.state));
  });
}

function updateProgress() {
  const total = list.length;
  const caught = list.filter(p => status[p.id]).length;
  const shiny = list.filter(p => status[p.id] === 'shiny').length;
  const pct = total ? Math.floor((caught / total) * 100) : 0;
  progressEl.textContent = `Caught ${caught} / ${total} (${pct}%) · ★ ${shiny}`;
}

function applyState(card, state) {
  card.classList.remove(...STATES);
  card.classList.add(state);
  card.dataset.state = state;
  card.querySelector('img').src = spriteFor(card.dataset.id, state);
}

dexEl.addEventListener('click', async e => {
  const card = e.target.closest('.card');
  if (!card) return;

  const id = Number(card.dataset.id);
  const prev = card.dataset.state;
  const next = STATES[(STATES.indexOf(prev) + 1) % STATES.length];

  setCard(card, id, next);

  try {
    await setStatus(game, id, next);
  } catch (err) {
    setCard(card, id, prev);
    alert('Could not save: ' + err.message);
  }
});

function setCard(card, id, state) {
  applyState(card, state);
  if (state === 'none') delete status[id];
  else status[id] = state;
  applyFilters();
  updateProgress();
}

async function showGame(name) {
  game = name;
  localStorage.setItem('game', name);
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

filterEl.value = localStorage.getItem('filter') || 'all';
if (!filterEl.value) filterEl.value = 'all';
filterEl.addEventListener('change', () => {
  localStorage.setItem('filter', filterEl.value);
  applyFilters();
});
searchEl.addEventListener('input', applyFilters);

showGame(game);

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
