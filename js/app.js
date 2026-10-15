import { getDexRecords, updateRecord } from './db.js';
import { loadDex, moveLocalCache } from './api.js';
import { ICONS, VIEWS, ORIGINS, originTag, spriteFor, cardHTML, boxHTML } from './ui.js';
import { scheduleSync } from './sync.js';

const STATES = ['none', 'caught', 'shiny'];
const BOX_SIZE = 30;
const LONG_PRESS = 500; // ms
const MOVE_SLOP = 10;   // px a finger may move before a long press is cancelled

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

const FILTERS = {
  all: () => true,
  caught: s => s !== 'none', // shiny counts as caught
  missing: s => s === 'none',
  shiny: s => s === 'shiny'
};

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
let records = {}; // speciesId -> { state, origin } for the current dex
let list = [];

const NO_RECORD = { state: 'none', origin: null };
const recordOf = id => records[id] || NO_RECORD;
const stateOf = id => recordOf(id).state;

/* ---------- Render ---------- */

// Collapsed boxes are stored per game: boxes:<game> = [0, 3, ...]
const collapsedKey = () => 'boxes:' + game;
function getCollapsed() {
  try { return new Set(JSON.parse(localStorage.getItem(collapsedKey())) || []); }
  catch { return new Set(); }
}

function render() {
  const pad = list.length >= 1000 ? 4 : 3;
  dexEl.className = 'view-' + view;

  if (view === 'box') {
    const collapsed = getCollapsed();
    const boxes = [];
    for (let i = 0; i < list.length; i += BOX_SIZE) {
      const index = i / BOX_SIZE;
      boxes.push(boxHTML(list.slice(i, i + BOX_SIZE), index, pad, collapsed.has(index), recordOf));
    }
    dexEl.innerHTML = boxes.join('');
  } else {
    dexEl.innerHTML = list.map(p => cardHTML(p, pad, recordOf(p.id))).join('');
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
  const caught = list.filter(p => stateOf(p.id) !== 'none').length;
  const shiny = list.filter(p => stateOf(p.id) === 'shiny').length;
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

// After a sync/import: update only the cards that changed.
document.addEventListener('dex-synced', async () => {
  const name = game;
  const saved = await getDexRecords(name);
  if (game !== name) return;
  records = saved;
  dexEl.querySelectorAll('.card').forEach(card => {
    const { state, origin } = recordOf(card.dataset.id);
    if (card.dataset.state !== state) applyState(card, state);
    applyOrigin(card, origin);
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

function applyOrigin(card, origin) {
  const tag = card.querySelector('.origin-tag');
  if ((tag?.textContent || null) === origin) return;
  tag?.remove();
  if (origin) card.querySelector('.info').insertAdjacentHTML('beforebegin', originTag(origin));
}

/* ---------- Tap = caught on/off, long press = shiny on/off ---------- */

let press = null;      // { card, x, y, timer } while a finger/mouse is down
let longPressed = null; // card whose long press just fired; its click is ignored

dexEl.addEventListener('pointerdown', e => {
  const card = e.target.closest('.card');
  if (!card || e.target.closest('.info') || (e.pointerType === 'mouse' && e.button !== 0)) return;
  cancelPress();
  longPressed = null; // Android may not send a click after a long press
  press = {
    card, x: e.clientX, y: e.clientY,
    timer: setTimeout(() => {
      press = null;
      longPressed = card;
      navigator.vibrate?.(15);
      const state = card.dataset.state === 'shiny' ? 'caught' : 'shiny';
      saveState(card, state);
    }, LONG_PRESS)
  };
});

dexEl.addEventListener('pointermove', e => {
  if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > MOVE_SLOP) cancelPress();
});
['pointerup', 'pointercancel', 'pointerleave'].forEach(type =>
  dexEl.addEventListener(type, cancelPress));

function cancelPress() {
  if (press) clearTimeout(press.timer);
  press = null;
}

// Stop the browser's own long-press menu (Android) and right-click menu on cards.
dexEl.addEventListener('contextmenu', e => {
  if (e.target.closest('.card')) e.preventDefault();
});

dexEl.addEventListener('click', e => {
  const head = e.target.closest('.box-head');
  if (head) return toggleBox(head.parentElement);

  const info = e.target.closest('.info');
  if (info) return openOrigin(info.closest('.card'));

  const card = e.target.closest('.card');
  if (!card) return;
  if (longPressed) {
    longPressed = null; // this click ends the long press
    return;
  }
  saveState(card, card.dataset.state === 'none' ? 'caught' : 'none');
});

async function saveState(card, next) {
  const id = Number(card.dataset.id);
  const prev = card.dataset.state;
  setCard(card, id, next);
  try {
    await updateRecord(game, id, { state: next });
    scheduleSync();
  } catch (err) {
    setCard(card, id, prev);
    alert('Could not save: ' + err.message);
  }
}

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
  records[id] = { ...recordOf(id), state };
  applyFilters();
  updateProgress();
}

/* ---------- Origin sheet (the "i" button on a card) ---------- */

const sheet = document.getElementById('origin-sheet');
const originEl = document.getElementById('origin');
originEl.innerHTML = '<option value="">Not set</option>' +
  ORIGINS.map(([code, label]) => `<option value="${code}">${label}</option>`).join('');
let sheetCard = null;

function openOrigin(card) {
  sheetCard = card;
  document.getElementById('origin-title').textContent =
    card.querySelector('.name').textContent + ' — caught in';
  originEl.value = recordOf(card.dataset.id).origin || '';
  sheet.showModal();
}

sheet.addEventListener('close', async () => {
  const card = sheetCard;
  sheetCard = null;
  if (!card || !['save', 'clear'].includes(sheet.returnValue)) return;
  const id = Number(card.dataset.id);
  const origin = sheet.returnValue === 'clear' ? null : originEl.value || null;
  const prev = recordOf(id).origin;
  if (origin === prev) return;
  records[id] = { ...recordOf(id), origin };
  applyOrigin(card, origin);
  try {
    await updateRecord(game, id, { origin });
    scheduleSync();
  } catch (err) {
    records[id] = { ...recordOf(id), origin: prev };
    applyOrigin(card, prev);
    alert('Could not save: ' + err.message);
  }
});

// Tap on the dimmed backdrop closes the sheet
sheet.addEventListener('click', e => {
  if (e.target === sheet) sheet.close('cancel');
});

/* ---------- Game, tabs, view menu ---------- */

async function showGame(name) {
  game = name;
  localStorage.setItem('game', name);
  dexEl.className = '';
  dexEl.innerHTML = '<p class="message">Loading…</p>';
  try {
    const [entries, saved] = await Promise.all([loadDex(name), getDexRecords(name)]);
    if (game !== name) return; // user switched again while loading
    list = entries;
    records = saved;
    searchEl.value = '';
    render();
  } catch (err) {
    if (game !== name) return;
    dexEl.innerHTML = `<div class="message error"><p>Could not load this Pokédex.</p>
      <p>${err.message}</p><button id="retry">Try again</button></div>`;
    document.getElementById('retry').addEventListener('click', () => showGame(name));
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
moveLocalCache().finally(() => showGame(game));

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
