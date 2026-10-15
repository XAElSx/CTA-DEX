const API = 'https://pokeapi.co/api/v2/pokemon-species?limit=2000';
const SPRITE = id =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;

const dexEl = document.getElementById('dex');

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
  dexEl.innerHTML = list.map(p => `
    <div class="card" data-id="${p.id}">
      <img src="${SPRITE(p.id)}" alt="${p.name}" loading="lazy">