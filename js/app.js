const API = 'https://pokeapi.co/api/v2/pokemon-species?limit=2000';
const SPRITE_BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon';
const STATES = ['none', 'caught', 'shiny'];

const spriteFor = (id, state) =>
  state === 'shiny' ? `${SPRITE_BASE}/shiny/${id}.png` : `${SPRITE_BASE}/${id}.png`;

const dexEl = document.getElementById('dex');
let status = {};

async function loadPokemon() {
  const cached = localStorage.getItem('species');
  if (cached) return JSON.parse(cached);

  const res = await fetch(API);
  if (!res.ok) throw new Error('PokéAPI error ' + res.status);
  const data = await res.json();

  const list = data.results.map(p => ({
    id: Number(p.url.split('/').filter(Boolean).pop()),
    name: p.name
  }));

  localStorage.setItem('species', JSON.stringify(list));
  return list;
}

function render(list) {
  dexEl.innerHTML = list.map(p => {
    const state = status[p.id] || 'none';
    return `
    <div class="card ${state}" data-id="${p.id}" data-state="${state}">
      <img src="${spriteFor(p.id, state)}" alt="${p.name}" loading="lazy">
      <span class="num">#${String(p.id).padStart(4, '0')}</span>
      <span class="name">${p.name}</span>
    </div>`;
  }).join('');
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

  applyState(card, next);
  if (next === 'none') delete status[id];
  else status[id] = next;

  try {
    await setStatus(id, next);
  } catch (err) {
    applyState(card, prev);
    if (prev === 'none') delete status[id];
    else status[id] = prev;
    alert('Could not save: ' + err.message);
  }
});

Promise.all([loadPokemon(), getAllStatus()])
  .then(([list, saved]) => {
    status = saved;
    render(list);
  })
  .catch(err => (dexEl.textContent = 'Could not load: ' + err.message));