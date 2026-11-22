'use strict';
/* Macro Log — offline nutrition tracker (PWA). All data lives in localStorage on the device. */

const STORE_KEY = 'macrolog.v1';
const COLOR = { kcal: '#4f6ef7', protein: '#1fa463', carbs: '#f5921e', fat: '#e0218a' };
const NUTR = ['kcal', 'protein', 'carbs', 'fat', 'fiber', 'sugar', 'polyols', 'poly', 'mono', 'sat', 'salt'];
const MACROS = ['kcal', 'protein', 'carbs', 'fat'];

const ICON = {
  left: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
  right: '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>',
  back: '<svg viewBox="0 0 24 24" style="width:28px;height:28px"><path d="M15 4l-8 8 8 8"/></svg>',
  gear: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  note: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9h10M7 13h10M7 17h6"/></svg>',
  copy: '<svg viewBox="0 0 24 24"><rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14M10 11v6M14 11v6"/></svg>',
  barcode: '<svg viewBox="0 0 24 24"><path d="M3 7V4h3M18 4h3v3M21 17v3h-3M6 20H3v-3M7 8v8M10 8v8M12 8v8M15 8v8M17 8v8"/></svg>',
  search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>',
};

/* ---------- storage ---------- */
function defaults() {
  return { version: 1, goals: { kcal: 2400, protein: 180, carbs: 250, fat: 70 }, myFoods: [], recent: [], days: {} };
}
function load() {
  try {
    const d = JSON.parse(localStorage.getItem(STORE_KEY));
    if (d && typeof d === 'object' && d.days) return Object.assign(defaults(), d);
  } catch (e) { /* fall through */ }
  return defaults();
}
let db = load();
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(db)); }
  catch (e) { toast('Could not save — phone storage may be full'); }
}
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

/* ---------- helpers ---------- */
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-5);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = v => { const x = parseFloat(String(v ?? '').replace(',', '.')); return isFinite(x) ? x : 0; };
function fmt(n) { n = +n || 0; const r = Math.round(n * 10) / 10; return Number.isInteger(r) ? String(r) : r.toFixed(1); }
const kc = n => String(Math.round(+n || 0));
const pad = n => String(n).padStart(2, '0');
const keyOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dateOf = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (k, n) => { const d = dateOf(k); d.setDate(d.getDate() + n); return keyOf(d); };
const todayKey = () => keyOf(new Date());
function dayLabel(k) {
  const t = todayKey();
  if (k === t) return 'Today';
  if (k === addDays(t, -1)) return 'Yesterday';
  if (k === addDays(t, 1)) return 'Tomorrow';
  return dateOf(k).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}
function getDay(k, create) {
  if (!db.days[k] && create) db.days[k] = { meals: [], completed: false, note: '' };
  return db.days[k];
}
const findMeal = (k, id) => (db.days[k]?.meals || []).find(m => m.id === id);
function itemNut(it) {
  const f = it.food, r = f.servingSize ? it.amount / f.servingSize : 0, o = {};
  NUTR.forEach(n => { o[n] = (+f[n] || 0) * r; });
  return o;
}
function sum(list) {
  const o = {}; NUTR.forEach(n => { o[n] = 0; });
  list.forEach(x => NUTR.forEach(n => { o[n] += x[n] || 0; }));
  return o;
}
const mealNut = m => sum(m.items.map(itemNut));
const cloneMeal = m => ({ ...JSON.parse(JSON.stringify(m)), id: uid(), completed: false, items: m.items.map(i => ({ ...JSON.parse(JSON.stringify(i)), id: uid() })) });
function nextMealName(day) {
  let n = 1; const names = new Set(day.meals.map(m => m.name));
  while (names.has('Meal ' + n)) n++;
  return 'Meal ' + n;
}

/* ---------- app state ---------- */
const state = {
  view: 'log', day: todayKey(), page: 0,
  mealId: null, tab: 'all', query: '', online: [], searching: false, onlineErr: '',
  lists: {}, createCtx: null, logScroll: 0,
};

/* ---------- rendering ---------- */
const $app = document.getElementById('app');
function render() {
  const main = $app.querySelector('.scroll');
  const keep = main && main.dataset.view === state.view ? main.scrollTop : null;
  if (state.view === 'log') $app.innerHTML = renderLog();
  else if (state.view === 'add') $app.innerHTML = renderAdd();
  else if (state.view === 'create') $app.innerHTML = renderCreate();
  else if (state.view === 'settings') $app.innerHTML = renderSettings();
  const m2 = $app.querySelector('.scroll');
  if (m2) {
    m2.dataset.view = state.view;
    if (keep != null) m2.scrollTop = keep;
    else if (state.view === 'log') m2.scrollTop = state.logScroll;
  }
  if (state.view === 'log') bindPages();
  if (state.view === 'add') renderList();
}
function go(view) {
  if (state.view === 'log') { const m = $app.querySelector('.scroll'); state.logScroll = m ? m.scrollTop : 0; }
  state.view = view;
  const m = $app.querySelector('.scroll'); if (m) m.dataset.view = '';
  render();
  if (view !== 'log') { const s = $app.querySelector('.scroll'); if (s) s.scrollTop = 0; }
}

function ringsSVG(t, g) {
  const R = [100, 77, 54, 31], W = 21;
  return `<svg viewBox="0 0 220 220" aria-hidden="true">${MACROS.map((k, i) => {
    const r = R[i], c = 2 * Math.PI * r, goal = +g[k] || 0;
    const p = goal > 0 ? Math.min(1, t[k] / goal) : (t[k] > 0 ? 1 : 0);
    return `<circle cx="110" cy="110" r="${r}" stroke="${COLOR[k]}" stroke-opacity=".22" stroke-width="${W}" fill="none"/>
      ${p > 0 ? `<circle cx="110" cy="110" r="${r}" stroke="${COLOR[k]}" stroke-width="${W}" fill="none" stroke-linecap="${p >= 1 ? 'butt' : 'round'}"
        stroke-dasharray="${(c * p).toFixed(2)} ${c.toFixed(2)}" transform="rotate(-90 110 110)"/>` : ''}`;
  }).join('')}</svg>`;
}

function renderLog() {
  const day = db.days[state.day];
  const meals = day ? day.meals : [];
  const t = sum(meals.map(mealNut)), g = db.goals;
  const rem = k => (+g[k] || 0) - t[k];
  return `
  <header class="top"><span></span><h1>Nutrition Log</h1>
    <button class="icon-btn r" data-act="settings" aria-label="Settings">${ICON.gear}</button></header>
  <main class="scroll">
    <section class="summary">
      <div class="daynav">
        <button class="sq" data-act="prev" aria-label="Previous day">${ICON.left}</button>
        <button class="daylabel" data-act="today">${esc(dayLabel(state.day))}</button>
        <button class="sq" data-act="next" aria-label="Next day">${ICON.right}</button>
      </div>
      <div class="pages" id="pages">
        <div class="page">
          <div class="stats">
            <div>Kcal<b style="color:${COLOR.kcal}">${kc(t.kcal)}/${kc(g.kcal)}kcal</b></div>
            <div>Protein<b style="color:${COLOR.protein}">${fmt(t.protein)}/${fmt(g.protein)}g</b></div>
            <div>Carbs<b style="color:${COLOR.carbs}">${fmt(t.carbs)}/${fmt(g.carbs)}g</b></div>
            <div>Fat<b style="color:${COLOR.fat}">${fmt(t.fat)}/${fmt(g.fat)}g</b></div>
          </div>
          <div class="rings">${ringsSVG(t, g)}</div>
        </div>
        <div class="page p2">
          <h4>Remaining</h4>
          <div class="kv">
            <div><span>Kcal</span><span style="color:${COLOR.kcal}">${kc(rem('kcal'))}</span></div>
            <div><span>Protein</span><span style="color:${COLOR.protein}">${fmt(rem('protein'))}g</span></div>
            <div><span>Carbs</span><span style="color:${COLOR.carbs}">${fmt(rem('carbs'))}g</span></div>
            <div><span>Fat</span><span style="color:${COLOR.fat}">${fmt(rem('fat'))}g</span></div>
          </div>
          <h4>Other nutrients</h4>
          <div class="kv">
            <div><span>Fiber</span><span>${fmt(t.fiber)}g</span></div>
            <div><span>Sugar</span><span>${fmt(t.sugar)}g</span></div>
            <div><span>Saturated</span><span>${fmt(t.sat)}g</span></div>
            <div><span>Mono</span><span>${fmt(t.mono)}g</span></div>
            <div><span>Poly</span><span>${fmt(t.poly)}g</span></div>
            <div><span>Salt</span><span>${fmt(t.salt)}g</span></div>
          </div>
        </div>
      </div>
      <div class="dots"><i class="${state.page === 0 ? 'on' : ''}"></i><i class="${state.page === 1 ? 'on' : ''}"></i></div>
    </section>
    ${day && day.note ? `<p class="dnote">📝 ${esc(day.note)}</p>` : ''}
    ${meals.length ? meals.map(mealCard).join('') : `<p class="empty">No meals logged for this day yet.</p>`}
    <div class="addmeal">
      <button class="link" data-act="add-meal">+ Add Meal</button>
      <span class="micons">
        <button class="icon-btn gold" data-act="day-note" aria-label="Day note">${ICON.note}</button>
        <button class="icon-btn gold" data-act="copy-day" aria-label="Copy meals">${ICON.copy}</button>
      </span>
    </div>
    ${meals.length ? `<button class="big primary ${day.completed ? 'isdone' : ''}" data-act="complete-day">${day.completed ? 'Day Completed ✓' : 'Complete Day'}</button>` : ''}
  </main>`;
}

function mealCard(m) {
  const t = mealNut(m);
  return `<section class="meal ${m.completed ? 'done' : ''}">
    <div class="mhead">
      <button class="mname" data-act="rename-meal" data-id="${m.id}">${esc(m.name)}</button>
      <div class="micons">
        <button class="icon-btn gold" data-act="meal-note" data-id="${m.id}" aria-label="Note">${ICON.note}</button>
        <button class="icon-btn gold" data-act="copy-meal" data-id="${m.id}" aria-label="Copy meal">${ICON.copy}</button>
        <button class="icon-btn red" data-act="delete-meal" data-id="${m.id}" aria-label="Delete meal">${ICON.trash}</button>
      </div>
    </div>
    ${m.note ? `<p class="mnote">${esc(m.note)}</p>` : ''}
    <div class="grid totals"><span></span>
      <span>${kc(t.kcal)}kcal<u style="background:${COLOR.kcal}"></u></span>
      <span>${fmt(t.protein)}g<u style="background:${COLOR.protein}"></u></span>
      <span>${fmt(t.carbs)}g<u style="background:${COLOR.carbs}"></u></span>
      <span>${fmt(t.fat)}g<u style="background:${COLOR.fat}"></u></span>
    </div>
    ${m.items.map(it => {
      const n = itemNut(it);
      return `<button class="grid item" data-act="edit-item" data-meal="${m.id}" data-item="${it.id}">
        <span class="nm">${esc(it.food.name)}<small>${fmt(it.amount)} ${esc(it.food.unit)}</small></span>
        <span>${kc(n.kcal)}</span><span>${fmt(n.protein)}g</span><span>${fmt(n.carbs)}g</span><span>${fmt(n.fat)}g</span>
      </button>`;
    }).join('')}
    <div class="mfoot">
      <button class="link" data-act="add-food" data-id="${m.id}">+ Add Food</button>
      <button class="link" data-act="complete-meal" data-id="${m.id}">${m.completed ? 'Completed' : 'Complete'}</button>
    </div>
  </section>`;
}

function bindPages() {
  const p = document.getElementById('pages');
  if (!p) return;
  if (state.page) p.scrollLeft = p.clientWidth * state.page;
  p.addEventListener('scroll', () => {
    const i = Math.round(p.scrollLeft / p.clientWidth);
    if (i !== state.page) {
      state.page = i;
      document.querySelectorAll('.dots i').forEach((d, j) => d.classList.toggle('on', j === i));
    }
  }, { passive: true });
}

/* ---------- add food view ---------- */
function renderAdd() {
  return `
  <header class="top"><button class="back" data-act="back" aria-label="Back">${ICON.back}</button><h1>Add Food</h1>
    <button class="link r" data-act="create-new">+ Create New</button></header>
  <form class="searchbar" id="searchform" autocomplete="off">
    ${ICON.search}<input id="q" type="search" placeholder="Search" value="${esc(state.query)}" enterkeyhint="search">
    <button type="button" class="scan" data-act="scan" aria-label="Scan barcode">${ICON.barcode}</button>
  </form>
  <nav class="tabs">
    ${[['all', 'All'], ['recent', 'Recent'], ['my', 'My Food']].map(([k, l]) =>
      `<button class="${state.tab === k ? 'on' : ''}" data-act="tab" data-tab="${k}">${l}</button>`).join('')}
  </nav>
  <main class="scroll"><div class="list" id="list"></div></main>`;
}

function matches(f, q) {
  if (!q) return true;
  const hay = (f.name + ' ' + (f.brand || '')).toLowerCase();
  return q.toLowerCase().split(/\s+/).filter(Boolean).every(w => hay.includes(w));
}
const HEAD = `<div class="grid lhead"><span>Title</span><span>Kcal</span><span>Protein</span><span>Carbs</span><span>Fat</span></div>`;
function foodRow(f, i, src) {
  return `<button class="grid frow" data-act="pick" data-src="${src}" data-i="${i}">
    <span class="nm">${esc(f.name)}<small>${f.brand ? esc(f.brand) + ' · ' : ''}${fmt(f.servingSize)} ${esc(f.unit)}</small></span>
    <span>${kc(f.kcal)}</span><span>${fmt(f.protein)}g</span><span>${fmt(f.carbs)}g</span><span>${fmt(f.fat)}g</span></button>`;
}
function renderList() {
  const el = document.getElementById('list');
  if (!el) return;
  const q = state.query.trim();
  let html = '';
  if (state.tab === 'my') {
    const list = state.lists.my = db.myFoods.filter(f => matches(f, q)).sort((a, b) => a.name.localeCompare(b.name));
    html = list.length ? HEAD + list.map((f, i) => foodRow(f, i, 'my')).join('')
      : `<p class="hint">${q ? 'No saved foods match.' : 'Foods you create are saved here.<br>Tap <b>+ Create New</b> to add one.'}</p>`;
  } else if (state.tab === 'recent') {
    const list = state.lists.recent = db.recent.filter(f => matches(f, q));
    html = list.length ? HEAD + list.map((f, i) => foodRow(f, i, 'recent')).join('')
      : `<p class="hint">Foods you log will show up here.</p>`;
  } else {
    if (!q) {
      html = `<p class="hint">Search for a food, or tap the barcode<br>button to scan a package.</p>`;
    } else {
      const seen = new Set(), local = [];
      [...db.myFoods, ...db.recent].forEach(f => {
        const key = f.name.toLowerCase() + '|' + f.servingSize + f.unit;
        if (!seen.has(key) && matches(f, q)) { seen.add(key); local.push(f); }
      });
      state.lists.local = local;
      state.lists.online = state.online;
      if (local.length) html += `<div class="section">Your foods</div>` + HEAD + local.map((f, i) => foodRow(f, i, 'local')).join('');
      html += `<div class="section">Online database</div>`;
      if (state.searching) html += `<div class="spin"></div>`;
      else if (state.onlineErr) html += `<p class="hint">${esc(state.onlineErr)}</p>`;
      else if (state.online.length) html += HEAD + state.online.map((f, i) => foodRow(f, i, 'online')).join('');
      else if (q.length < 2) html += `<p class="hint">Keep typing…</p>`;
      else html += `<p class="hint">No results. Try different words, or tap <b>+ Create New</b>.</p>`;
    }
  }
  el.innerHTML = html;
}

/* ---------- Open Food Facts ---------- */
const OFF_FIELDS = 'code,product_name,brands,nutriments,serving_quantity,serving_size,quantity';
function mapOFF(p) {
  const n = p.nutriments || {};
  let kcal = n['energy-kcal_100g'];
  if (kcal == null && n['energy_100g'] != null) kcal = n['energy_100g'] / 4.184;
  const liquid = /ml|cl|\bl\b/i.test(p.serving_size || p.quantity || '');
  const sq = num(p.serving_quantity);
  return {
    id: 'off_' + p.code, name: String(p.product_name || 'Unnamed product').trim(),
    brand: String(p.brands || '').split(',')[0].trim(), barcode: p.code || '',
    kcal: num(kcal), protein: num(n.proteins_100g), carbs: num(n.carbohydrates_100g), fat: num(n.fat_100g),
    fiber: num(n.fiber_100g), sugar: num(n.sugars_100g), polyols: num(n.polyols_100g),
    poly: num(n['polyunsaturated-fat_100g']), mono: num(n['monounsaturated-fat_100g']), sat: num(n['saturated-fat_100g']),
    salt: num(n.salt_100g), servingSize: 100, unit: liquid ? 'ml' : 'g', defaultAmount: sq > 0 ? sq : 100, source: 'off',
  };
}
let searchCtl = null, searchTimer = null;
function onSearchInput(q) {
  state.query = q;
  clearTimeout(searchTimer);
  if (state.tab === 'all' && q.trim().length >= 2) {
    state.searching = true; state.onlineErr = '';
    searchTimer = setTimeout(() => searchOnline(q.trim()), 700);
  } else { state.searching = false; state.online = []; }
  renderList();
}
async function searchOnline(q) {
  if (searchCtl) searchCtl.abort();
  const ctl = searchCtl = new AbortController();
  state.searching = true; state.onlineErr = ''; renderList();
  const urls = [
    `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=30&fields=${OFF_FIELDS}`,
    `https://search.openfoodfacts.org/search?q=${encodeURIComponent(q)}&page_size=30&fields=${OFF_FIELDS}`,
  ];
  let products = null;
  for (const url of urls) {
    try {
      const r = await fetch(url, { signal: ctl.signal });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json();
      products = j.products || j.hits || [];
      break;
    } catch (e) { if (e.name === 'AbortError') return; }
  }
  if (ctl !== searchCtl || state.query.trim() !== q) return;
  state.searching = false;
  if (products == null) {
    state.online = [];
    state.onlineErr = navigator.onLine ? 'Online search is busy right now. Try again in a moment.' : "You're offline, so online search is unavailable.";
  } else {
    state.online = products.filter(p => p.product_name && p.nutriments).map(mapOFF);
  }
  renderList();
}
async function lookupBarcode(code) {
  code = String(code).trim();
  const mine = db.myFoods.find(f => f.barcode && f.barcode === code);
  if (mine) return openAmountSheet(mine);
  toast('Looking up ' + code + '…');
  try {
    const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${OFF_FIELDS}`);
    const j = await r.json();
    if (j.status === 1 && j.product) { hideToast(); return openAmountSheet(mapOFF({ ...j.product, code })); }
  } catch (e) {
    if (!navigator.onLine) { toast("You're offline — can't look up barcodes"); return; }
  }
  hideToast();
  openSheet(`<h3>Product not found</h3><p class="muted">Barcode ${esc(code)} isn't in the online database.</p>
    <div class="btns"><button class="secondary" data-close>Cancel</button><button class="primary" id="mk">Create it</button></div>`,
    p => p.querySelector('#mk').onclick = () => { closeSheet(); openCreate({ barcode: code }); });
}

/* ---------- barcode scanner ---------- */
let scanControls = null;
function loadScript(src) {
  return new Promise((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) return res();
    const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Could not load scanner'));
    document.head.appendChild(s);
  });
}
async function openScanner() {
  openSheet(`<h3>Scan barcode</h3>
    <div class="scanbox"><video id="scanvid" playsinline muted autoplay></video><div class="reticle"></div></div>
    <p class="muted small">Point the camera at the barcode. Or type it in:</p>
    <div class="amtrow"><input type="text" id="manual" inputmode="numeric" placeholder="Barcode number"><button class="chip" id="go">Look up</button></div>
    <div class="btns one"><button class="secondary" data-close>Cancel</button></div>`, p => {
    p.querySelector('#go').onclick = () => { const v = p.querySelector('#manual').value.trim(); if (v) { closeSheet(); lookupBarcode(v); } };
  });
  try {
    await loadScript('vendor/zxing-browser.min.js');
    const video = document.getElementById('scanvid');
    if (!video) return;
    const reader = new ZXingBrowser.BrowserMultiFormatReader();
    const controls = await reader.decodeFromConstraints({ audio: false, video: { facingMode: { ideal: 'environment' } } }, video, (res, err, ctl) => {
      if (res) { ctl.stop(); scanControls = null; if (navigator.vibrate) navigator.vibrate(40); closeSheet(); lookupBarcode(res.getText()); }
    });
    if (!document.getElementById('scanvid')) controls.stop(); else scanControls = controls;
  } catch (e) {
    const box = document.querySelector('.scanbox');
    if (box) box.outerHTML = `<p class="err">Camera unavailable (${esc(e.message || e.name)}). Allow camera access in Settings, or type the barcode below.</p>`;
  }
}

/* ---------- sheets / toast ---------- */
const $sheet = document.getElementById('sheet'), $panel = document.getElementById('panel');
function openSheet(html, bind) {
  $panel.innerHTML = html;
  $sheet.hidden = false;
  $panel.querySelectorAll('[data-close]').forEach(b => b.onclick = closeSheet);
  if (bind) bind($panel);
}
function closeSheet() {
  if (scanControls) { try { scanControls.stop(); } catch (e) {} scanControls = null; }
  $sheet.hidden = true; $panel.innerHTML = '';
}
let toastT;
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.hidden = false; clearTimeout(toastT);
  toastT = setTimeout(() => { t.hidden = true; }, 2200);
}
function hideToast() { document.getElementById('toast').hidden = true; }

function textSheet(title, value, { multiline, placeholder, okLabel = 'Save' } = {}, onOk) {
  openSheet(`<h3>${esc(title)}</h3>
    ${multiline ? `<textarea id="tx" rows="4" placeholder="${esc(placeholder || '')}" style="margin-top:12px">${esc(value)}</textarea>`
      : `<input type="text" id="tx" value="${esc(value)}" placeholder="${esc(placeholder || '')}" style="margin-top:12px">`}
    <div class="btns"><button class="secondary" data-close>Cancel</button><button class="primary" id="ok">${esc(okLabel)}</button></div>`, p => {
    const tx = p.querySelector('#tx'); setTimeout(() => tx.focus(), 50);
    p.querySelector('#ok').onclick = () => { onOk(tx.value.trim()); closeSheet(); };
    if (!multiline) tx.onkeydown = e => { if (e.key === 'Enter') p.querySelector('#ok').click(); };
  });
}
function confirmSheet(title, msg, okLabel, onOk) {
  openSheet(`<h3>${esc(title)}</h3><p class="muted">${esc(msg)}</p>
    <div class="btns"><button class="secondary" data-close>Cancel</button><button class="primary" id="ok" style="background:var(--red);color:#fff">${esc(okLabel)}</button></div>`,
    p => p.querySelector('#ok').onclick = () => { closeSheet(); onOk(); });
}

/* ---------- amount sheet ---------- */
function openAmountSheet(food, { mealId = state.mealId, itemId = null, amount = null } = {}) {
  const editing = !!itemId;
  const start = amount ?? food.defaultAmount ?? food.servingSize;
  openSheet(`<h3>${esc(food.name)}</h3>
    ${food.brand ? `<p class="muted">${esc(food.brand)}</p>` : ''}
    <p class="muted small">Per ${fmt(food.servingSize)} ${esc(food.unit)}: ${kc(food.kcal)} kcal · P ${fmt(food.protein)}g · C ${fmt(food.carbs)}g · F ${fmt(food.fat)}g</p>
    <label class="fl" for="amt">Amount</label>
    <div class="amtrow"><input type="text" id="amt" inputmode="decimal" value="${fmt(start)}"><span class="unit">${esc(food.unit)}</span></div>
    <div class="chips">${[[0.5, '½ serving'], [1, '1 serving'], [1.5, '1½ servings'], [2, '2 servings']]
      .map(([x, l]) => `<button class="chip" data-x="${x}">${l}</button>`).join('')}</div>
    <div class="preview" id="pv"></div>
    <div class="btns"><button class="secondary" data-close>Cancel</button><button class="primary blue" id="ok">${editing ? 'Save' : 'Add Food'}</button></div>
    ${editing ? `<button class="danger-link" id="rm">Remove from meal</button>` : ''}
    ${!editing && food.source === 'my' ? `<div class="rowlinks"><button class="link" id="ef">Edit food</button><button class="danger-link" id="df">Delete from My Food</button></div>` : ''}`,
  p => {
    const inp = p.querySelector('#amt'), pv = p.querySelector('#pv');
    const upd = () => {
      const n = itemNut({ food, amount: num(inp.value) });
      pv.innerHTML = MACROS.map(k => `<div><b style="color:${COLOR[k]}">${k === 'kcal' ? kc(n[k]) : fmt(n[k]) + 'g'}</b><span>${k === 'kcal' ? 'Kcal' : k[0].toUpperCase() + k.slice(1)}</span></div>`).join('');
    };
    inp.oninput = upd; upd();
    inp.onfocus = () => inp.select();
    p.querySelectorAll('.chip[data-x]').forEach(c => c.onclick = () => { inp.value = fmt(food.servingSize * +c.dataset.x); upd(); });
    p.querySelector('#ok').onclick = () => {
      const a = num(inp.value);
      if (a <= 0) { toast('Enter an amount'); return; }
      if (editing) {
        const it = findMeal(state.day, mealId)?.items.find(i => i.id === itemId);
        if (it) it.amount = a;
        save(); closeSheet(); render();
      } else {
        addToMeal(food, a, mealId);
      }
    };
    if (editing) p.querySelector('#rm').onclick = () => {
      const m = findMeal(state.day, mealId);
      if (m) m.items = m.items.filter(i => i.id !== itemId);
      save(); closeSheet(); render();
    };
    if (!editing && food.source === 'my') {
      p.querySelector('#ef').onclick = () => { closeSheet(); openCreate({ foodId: food.id, mealId }); };
      p.querySelector('#df').onclick = () => confirmSheet('Delete food?', `Remove "${food.name}" from My Food? Meals already logged keep it.`, 'Delete', () => {
        db.myFoods = db.myFoods.filter(f => f.id !== food.id); save(); render();
      });
    }
  });
}
function snapshot(food) {
  const s = { id: food.id, name: food.name, brand: food.brand || '', barcode: food.barcode || '', servingSize: num(food.servingSize) || 100, unit: food.unit || 'g', source: food.source };
  NUTR.forEach(n => { s[n] = num(food[n]); });
  if (food.defaultAmount) s.defaultAmount = food.defaultAmount;
  return s;
}
function addToMeal(food, amount, mealId) {
  const m = findMeal(state.day, mealId);
  if (!m) { closeSheet(); toast('Meal not found'); return; }
  const snap = snapshot(food);
  m.items.push({ id: uid(), food: snap, amount });
  const key = f => f.name.toLowerCase() + '|' + f.servingSize + f.unit;
  db.recent = [{ ...snap, source: snap.source === 'my' ? 'my' : (snap.source || 'off') }, ...db.recent.filter(f => key(f) !== key(snap))].slice(0, 60);
  save(); closeSheet();
  state.query = ''; state.online = [];
  go('log');
  toast(`Added ${food.name}`);
}

/* ---------- create / edit food ---------- */
function openCreate(ctx = {}) {
  state.createCtx = { returnTo: state.view, mealId: state.mealId, ...ctx };
  go('create');
}
function renderCreate() {
  const ctx = state.createCtx || {};
  const f = ctx.foodId ? db.myFoods.find(x => x.id === ctx.foodId) || {} : {};
  const editing = !!ctx.foodId;
  const v = k => (f[k] != null && f[k] !== 0 ? fmt(f[k]) : '');
  const box = (k, label, sfx = 'g') => `<div class="field"><label for="f_${k}">${label}</label>
    <div class="inp suf"><input id="f_${k}" name="${k}" inputmode="decimal" value="${v(k)}"><span class="sfx">${sfx}</span></div></div>`;
  return `
  <header class="top"><button class="back" data-act="create-cancel" aria-label="Back">${ICON.back}</button>
    <h1>${editing ? 'Edit Food' : 'Add Food'}</h1><span></span></header>
  <main class="scroll"><form class="form" id="foodform" autocomplete="off">
    <div class="fgrid">
      <div class="field full"><label for="f_name">Name</label><div class="inp"><input id="f_name" name="name" type="text" value="${esc(f.name || '')}"></div></div>
      ${box('kcal', 'Kcal', 'kcal')}${box('protein', 'Protein')}
      ${box('carbs', 'Carbs')}${box('fat', 'Fat')}
      ${box('fiber', 'Fiber')}${box('poly', 'Polyunsaturated')}
      ${box('sugar', 'Sugar')}${box('mono', 'Monounsaturated')}
      ${box('polyols', 'Polyols')}${box('sat', 'Saturated')}
      ${box('salt', 'Salt')}<div></div>
      <div class="field"><label for="f_ss">Serving Size</label><div class="inp"><input id="f_ss" name="servingSize" inputmode="decimal" value="${f.servingSize ? fmt(f.servingSize) : ''}" placeholder="e.g. 100"></div></div>
      <div class="field"><label for="f_unit">Serving Description</label><div class="inp"><input id="f_unit" name="unit" type="text" list="units" value="${esc(f.unit || 'g')}"></div></div>
      <datalist id="units"><option value="g"><option value="oz"><option value="ml"><option value="serving"><option value="cup"><option value="tbsp"><option value="slice"><option value="piece"></datalist>
      ${!editing && ctx.mealId ? `<div class="field full"><label for="f_amt">Amount</label><div class="inp suf"><input id="f_amt" name="amount" inputmode="decimal" placeholder="same as serving size"><span class="sfx" id="amtsfx">${esc(f.unit || 'g')}</span></div></div>` : ''}
      <div class="field full"><label for="f_bc">Barcode (optional)</label><div class="inp"><input id="f_bc" name="barcode" type="text" inputmode="numeric" value="${esc(f.barcode || ctx.barcode || '')}"></div></div>
    </div>
    <p class="err" id="ferr" hidden></p>
    <div class="formbtns"><button type="button" class="secondary" data-act="create-cancel">Cancel</button>
      <button type="submit" class="primary blue">${editing ? 'Save' : ctx.mealId ? 'Add Food' : 'Save Food'}</button></div>
    ${editing ? `<button type="button" class="danger-link" data-act="delete-food" style="margin-top:18px">Delete food</button>` : ''}
  </form></main>`;
}
function submitFood(form) {
  const ctx = state.createCtx || {};
  const fd = new FormData(form);
  const name = String(fd.get('name') || '').trim();
  const ss = num(fd.get('servingSize'));
  const err = document.getElementById('ferr');
  const fail = m => { err.textContent = m; err.hidden = false; };
  if (!name) return fail('Give the food a name.');
  if (ss <= 0) return fail('Enter a serving size (the amount the nutrition numbers are for).');
  const food = ctx.foodId ? db.myFoods.find(x => x.id === ctx.foodId) : { id: uid(), source: 'my' };
  food.name = name; food.servingSize = ss; food.unit = String(fd.get('unit') || 'g').trim() || 'g';
  food.barcode = String(fd.get('barcode') || '').trim();
  NUTR.forEach(n => { food[n] = num(fd.get(n)); });
  if (!ctx.foodId) db.myFoods.push(food);
  save();
  if (!ctx.foodId && ctx.mealId) {
    const a = num(fd.get('amount')) || ss;
    addToMeal(food, a, ctx.mealId);
  } else {
    toast(ctx.foodId ? 'Food updated' : 'Saved to My Food');
    if (ctx.returnTo === 'add') state.tab = 'my';
    go(ctx.returnTo || 'log');
  }
}

/* ---------- settings ---------- */
function renderSettings() {
  const g = db.goals;
  const goal = (k, label, sfx) => `<div class="field"><label for="g_${k}">${label}</label>
    <div class="inp suf"><input id="g_${k}" data-goal="${k}" inputmode="decimal" value="${fmt(g[k])}"><span class="sfx">${sfx}</span></div></div>`;
  const macroKcal = Math.round(g.protein * 4 + g.carbs * 4 + g.fat * 9);
  return `
  <header class="top"><button class="back" data-act="back" aria-label="Back">${ICON.back}</button><h1>Settings</h1><span></span></header>
  <main class="scroll">
    <section class="sec"><h3>Daily goals</h3>
      <div class="fgrid">${goal('kcal', 'Kcal', 'kcal')}${goal('protein', 'Protein', 'g')}${goal('carbs', 'Carbs', 'g')}${goal('fat', 'Fat', 'g')}</div>
      <p id="mk">Your macros add up to ${macroKcal} kcal.</p>
      <button class="sbtn" data-act="kcal-from-macros">Set kcal goal from macros</button>
    </section>
    <section class="sec"><h3>My Food (${db.myFoods.length})</h3>
      ${db.myFoods.length ? db.myFoods.slice().sort((a, b) => a.name.localeCompare(b.name)).map(f =>
        `<button class="sbtn" data-act="edit-food" data-id="${f.id}" style="color:var(--text)">${esc(f.name)} <span class="muted small">· ${fmt(f.servingSize)} ${esc(f.unit)} · ${kc(f.kcal)} kcal</span></button>`).join('')
        : '<p>No saved foods yet.</p>'}
      <button class="sbtn" data-act="new-food">+ Create New Food</button>
    </section>
    <section class="sec"><h3>Backup</h3>
      <button class="sbtn" data-act="export">Export backup</button>
      <button class="sbtn" data-act="import">Restore from backup</button>
      <button class="sbtn red" data-act="erase">Erase all data</button>
      <p>Your log is stored only on this phone. If you delete the app from your Home Screen, the data goes with it, so export a backup now and then (save it to Files or AirDrop it).</p>
    </section>
    <section class="sec"><p>Food search & barcode data from Open Food Facts (openfoodfacts.org), available under the Open Database License.</p></section>
    <input type="file" id="importfile" accept="application/json,.json" hidden>
  </main>`;
}
async function exportData() {
  const name = `macro-log-backup-${todayKey()}.json`;
  const file = new File([JSON.stringify(db, null, 1)], name, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Macro Log backup' }); return; }
    catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file); a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}
function importData(file) {
  const r = new FileReader();
  r.onload = () => {
    let d;
    try { d = JSON.parse(r.result); } catch (e) { toast("That file isn't a valid backup"); return; }
    if (!d || typeof d !== 'object' || !d.days || !Array.isArray(d.myFoods)) { toast("That file isn't a Macro Log backup"); return; }
    confirmSheet('Restore backup?', `This replaces everything on this phone with the backup (${Object.keys(d.days).length} days, ${d.myFoods.length} saved foods).`, 'Restore', () => {
      db = Object.assign(defaults(), d); save(); toast('Backup restored'); render();
    });
  };
  r.readAsText(file);
}

/* ---------- actions ---------- */
const ACT = {
  prev() { state.day = addDays(state.day, -1); state.logScroll = 0; render(); },
  next() { state.day = addDays(state.day, 1); state.logScroll = 0; render(); },
  today() { if (state.day !== todayKey()) { state.day = todayKey(); state.logScroll = 0; render(); } },
  settings() { go('settings'); },
  back() { state.query = ''; state.online = []; state.searching = false; go('log'); },
  'add-meal'() {
    const d = getDay(state.day, true);
    d.meals.push({ id: uid(), name: nextMealName(d), note: '', completed: false, items: [] });
    d.completed = false; save(); render();
    const s = $app.querySelector('.scroll'); if (s) s.scrollTop = s.scrollHeight;
  },
  'rename-meal'({ id }) {
    const m = findMeal(state.day, id); if (!m) return;
    textSheet('Rename meal', m.name, { placeholder: 'e.g. Breakfast' }, v => { if (v) { m.name = v; save(); render(); } });
  },
  'meal-note'({ id }) {
    const m = findMeal(state.day, id); if (!m) return;
    textSheet(m.name + ' note', m.note || '', { multiline: true, placeholder: 'Add a note…' }, v => { m.note = v; save(); render(); });
  },
  'day-note'() {
    const d = getDay(state.day, false);
    textSheet('Note for ' + dayLabel(state.day), d ? d.note || '' : '', { multiline: true, placeholder: 'How did the day go?' }, v => {
      getDay(state.day, true).note = v; save(); render();
    });
  },
  'copy-meal'({ id }) {
    const m = findMeal(state.day, id); if (!m) return;
    const t = todayKey(), nx = addDays(state.day, 1);
    const opts = [['here', 'Duplicate in this day'], ['next', `Copy to ${dayLabel(nx)}`]];
    if (state.day !== t && nx !== t) opts.push(['today', 'Copy to Today']);
    openSheet(`<h3>Copy ${esc(m.name)}</h3>${opts.map(([k, l]) => `<button class="opt" data-k="${k}">${esc(l)}</button>`).join('')}
      <div class="btns one"><button class="secondary" data-close>Cancel</button></div>`, p => {
      p.querySelectorAll('.opt').forEach(b => b.onclick = () => {
        const target = { here: state.day, next: nx, today: t }[b.dataset.k];
        const d = getDay(target, true), c = cloneMeal(m);
        if (target === state.day) c.name = nextMealName(d);
        else if (d.meals.some(x => x.name === c.name)) c.name = nextMealName(d);
        d.meals.push(c); d.completed = false; save(); closeSheet(); render();
        toast(target === state.day ? 'Meal duplicated' : `Copied to ${dayLabel(target)}`);
      });
    });
  },
  'copy-day'() {
    const prevK = addDays(state.day, -1), prev = db.days[prevK];
    const cur = db.days[state.day], t = todayKey();
    const opts = [];
    if (prev && prev.meals.length) opts.push(['from-prev', `Copy all meals from ${dayLabel(prevK)}`]);
    if (cur && cur.meals.length && state.day !== t) opts.push(['to-today', 'Copy this day’s meals to Today']);
    if (cur && cur.meals.length) opts.push(['to-next', `Copy this day’s meals to ${dayLabel(addDays(state.day, 1))}`]);
    if (!opts.length) { toast('Nothing to copy yet'); return; }
    openSheet(`<h3>Copy meals</h3>${opts.map(([k, l]) => `<button class="opt" data-k="${k}">${esc(l)}</button>`).join('')}
      <div class="btns one"><button class="secondary" data-close>Cancel</button></div>`, p => {
      p.querySelectorAll('.opt').forEach(b => b.onclick = () => {
        const k = b.dataset.k;
        const src = k === 'from-prev' ? prev : cur;
        const target = k === 'from-prev' ? state.day : k === 'to-today' ? t : addDays(state.day, 1);
        const d = getDay(target, true);
        src.meals.forEach(m => { const c = cloneMeal(m); if (d.meals.some(x => x.name === c.name)) c.name = nextMealName(d); d.meals.push(c); });
        d.completed = false; save(); closeSheet(); render();
        toast(`Copied ${src.meals.length} meal${src.meals.length > 1 ? 's' : ''}`);
      });
    });
  },
  'delete-meal'({ id }) {
    const m = findMeal(state.day, id); if (!m) return;
    confirmSheet(`Delete ${m.name}?`, m.items.length ? `This removes ${m.items.length} food${m.items.length > 1 ? 's' : ''} from the log.` : 'This meal is empty.', 'Delete', () => {
      const d = db.days[state.day]; d.meals = d.meals.filter(x => x.id !== id);
      if (!d.meals.length && !d.note) delete db.days[state.day];
      save(); render();
    });
  },
  'complete-meal'({ id }) { const m = findMeal(state.day, id); if (m) { m.completed = !m.completed; save(); render(); } },
  'complete-day'() {
    const d = db.days[state.day]; if (!d) return;
    d.completed = !d.completed;
    if (d.completed) d.meals.forEach(m => { m.completed = true; });
    save(); render(); if (d.completed) toast('Day completed 👍');
  },
  'add-food'({ id }) { state.mealId = id; state.tab = 'all'; state.query = ''; state.online = []; state.searching = false; go('add'); },
  'edit-item'({ meal, item }) {
    const it = findMeal(state.day, meal)?.items.find(i => i.id === item);
    if (it) openAmountSheet(it.food, { mealId: meal, itemId: item, amount: it.amount });
  },
  tab({ tab }) {
    state.tab = tab;
    document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
    if (tab === 'all' && state.query.trim().length >= 2 && !state.online.length) searchOnline(state.query.trim());
    renderList();
  },
  pick({ src, i }) {
    const f = (state.lists[src] || [])[+i]; if (!f) return;
    const live = f.source === 'my' ? db.myFoods.find(x => x.id === f.id) : null;
    openAmountSheet(live || f);
  },
  scan() { openScanner(); },
  'create-new'() { openCreate({ mealId: state.mealId }); },
  'create-cancel'() { go((state.createCtx && state.createCtx.returnTo) || 'log'); },
  'delete-food'() {
    const ctx = state.createCtx; const f = db.myFoods.find(x => x.id === ctx.foodId); if (!f) return;
    confirmSheet('Delete food?', `Remove "${f.name}" from My Food? Meals already logged keep it.`, 'Delete', () => {
      db.myFoods = db.myFoods.filter(x => x.id !== f.id); save(); go(ctx.returnTo || 'log');
    });
  },
  'edit-food'({ id }) { openCreate({ foodId: id, mealId: null }); },
  'new-food'() { openCreate({ mealId: null }); },
  'kcal-from-macros'() {
    const g = db.goals; g.kcal = Math.round(g.protein * 4 + g.carbs * 4 + g.fat * 9); save(); render(); toast('Kcal goal updated');
  },
  export() { exportData(); },
  import() { document.getElementById('importfile').click(); },
  erase() {
    confirmSheet('Erase everything?', 'This deletes all logged days, saved foods and goals on this phone. Export a backup first if you might want it back.', 'Erase', () => {
      db = defaults(); save(); toast('All data erased'); go('log');
    });
  },
  'close-sheet'() { closeSheet(); },
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const fn = ACT[el.dataset.act];
  if (fn) { e.preventDefault(); fn(el.dataset, el); }
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'q') onSearchInput(t.value);
  else if (t.dataset && t.dataset.goal) {
    db.goals[t.dataset.goal] = num(t.value); save();
    const g = db.goals, mk = document.getElementById('mk');
    if (mk) mk.textContent = `Your macros add up to ${Math.round(g.protein * 4 + g.carbs * 4 + g.fat * 9)} kcal.`;
  } else if (t.id === 'f_unit') {
    const s = document.getElementById('amtsfx'); if (s) s.textContent = t.value || 'g';
  }
});
document.addEventListener('submit', e => {
  e.preventDefault();
  if (e.target.id === 'searchform') {
    const q = document.getElementById('q'); q.blur();
    if (state.tab === 'all' && q.value.trim().length >= 1) { clearTimeout(searchTimer); state.query = q.value; searchOnline(q.value.trim()); }
  } else if (e.target.id === 'foodform') submitFood(e.target);
});
document.addEventListener('change', e => {
  if (e.target.id === 'importfile' && e.target.files[0]) { importData(e.target.files[0]); e.target.value = ''; }
});
document.addEventListener('focusin', e => { if (e.target.matches('.inp input[inputmode=decimal]')) setTimeout(() => e.target.select(), 0); });

// If the app stays open past midnight, jump to the new "Today" when it comes back to the foreground.
let lastToday = todayKey();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && todayKey() !== lastToday) {
    if (state.day === lastToday) state.day = todayKey();
    lastToday = todayKey(); if (state.view === 'log') render();
  }
});

render();

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
