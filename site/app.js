// The Long Orchard viewer.
//
// Loads a saved world, brings it up to the present in the browser (the
// engine is deterministic, so this projection is exactly what the saved
// record will say once the daily job next runs), and draws it.
// Nothing here writes to the shared world.

import {
  deserialise, advanceAsync, stepAt, orchardTime, realTimeOfStep, SEASONS, DAYS_PER_YEAR,
  inspectPatch, inspectTree, W, H, idx, PLACES, speciesName,
} from '../engine/index.js';
import { displaySnapshot, parseHistory, COLUMNS, pad, metricsRow, CSV_HEADER } from '../engine/records.js';
import { DAYS_PER_SEASON } from '../engine/clock.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = (v, d = 1) => (v === null || v === undefined ? '–' : Math.abs(v) >= 100 ? Math.round(v).toLocaleString('en-GB') : (Math.round(v * 10 ** d) / 10 ** d).toString());

const COLORS = {
  paper: '#E9E8DB', soil: '#D8CBAA', stitch: '#B3C19C', clover: '#6C7E52', leaf: '#5E7550', leafDark: '#3F5537',
  lantern: '#869A5B', amber: '#C08A2E', water: '#6F8794', stone: '#9A968A', ink: '#232B26', loss: '#9E3B2E',
  bark: '#6B5640', soft: '#A57B4E', glass: '#B9C6C9',
};

const LAYERS = [
  { id: 'map', label: 'Illustrated' },
  { id: 'light', label: 'Light' },
  { id: 'moisture', label: 'Moisture' },
  { id: 'ground', label: 'Ground plants' },
  { id: 'seeds', label: 'Seed bank' },
  { id: 'pollinators', label: 'Pollinators' },
  { id: 'deadwood', label: 'Deadwood' },
  { id: 'lineage', label: 'Named trees' },
];

const state = {
  worldDir: null, status: null, world: null, savedStep: 0,
  events: [], history: [], projectedFrom: null,
  layer: 'map', selected: idx(14, 11), snap: null, viewStep: null, tree: null,
};

async function getJSON(url) { const r = await fetch(url, { cache: 'no-cache' }); if (!r.ok) throw new Error(`${url}: ${r.status}`); return r.json(); }
async function getText(url) { const r = await fetch(url, { cache: 'no-cache' }); if (!r.ok) return null; return r.text(); }

// --- Loading -------------------------------------------------------------------

async function load() {
  const params = new URLSearchParams(location.search);
  let index;
  try { index = await getJSON('worlds/index.json'); } catch { index = { worlds: [{ id: 'preview', dir: 'worlds/preview' }], default: 'preview' }; }
  const id = params.get('world') || index.default || index.worlds[0].id;
  const entry = index.worlds.find((w) => w.id === id) || index.worlds[0];
  state.worldDir = entry.dir;
  try {
    state.status = await getJSON(`${entry.dir}/status.json`);
    const text = await getText(`${entry.dir}/world.json`);
    state.world = deserialise(text);
  } catch (e) {
    $('clock').textContent = 'The saved world could not be loaded.';
    $('persistence').textContent = `${e.message}. Check that ${entry.dir}/world.json exists in the repository.`;
    return;
  }
  state.savedStep = state.world.meta.step;
  $('world-name').textContent = state.world.meta.name;
  $('test-banner').hidden = state.world.meta.kind !== 'test';
  document.title = state.world.meta.name;

  // Saved records: this year and last year
  const y = Math.floor(Math.max(0, state.savedStep - 1) / DAYS_PER_YEAR) + 1;
  for (const year of [y - 1, y]) {
    if (year < 1) continue;
    const ev = await getText(`${entry.dir}/events/year-${pad(year)}.jsonl`);
    if (ev) for (const l of ev.trim().split('\n')) if (l) state.events.push(JSON.parse(l));
    const hi = await getText(`${entry.dir}/history/year-${pad(year)}.csv`);
    if (hi) state.history.push(...parseHistory(hi));
  }

  buildLayerBar();
  setupMap();
  renderAll();
  await catchUp();
  setInterval(catchUp, 60 * 1000); // keep pace with the orchard while the page is open
}

async function catchUp() {
  const w = state.world;
  const target = stepAt(w.meta.foundedAt, Date.now());
  if (target <= w.meta.step) { renderPersistence(); return; }
  if (state.projectedFrom === null) state.projectedFrom = w.meta.step;
  const bar = document.createElement('div');
  bar.className = 'progress';
  bar.innerHTML = '<div></div>';
  const long = target - w.meta.step > 60;
  if (long) { $('persistence').textContent = `Bringing the orchard up to the present: ${target - w.meta.step} orchard days since the last save…`; $('persistence').append(bar); }
  const { events, metrics } = await advanceAsync(w, target, {
    chunk: 12,
    onProgress: (p) => { bar.firstChild.style.width = `${Math.round(p * 100)}%`; },
  });
  for (const e of events) { e.projected = true; state.events.push(e); }
  if (metrics.length) {
    const rows = parseHistory(`${CSV_HEADER}\n${metrics.map(metricsRow).join('\n')}`);
    for (const r of rows) r.projected = true;
    state.history.push(...rows);
  }
  renderAll();
}

// --- Header ------------------------------------------------------------------------

function renderClock() {
  const t = orchardTime(state.world.meta.step);
  const wx = state.world.weather.today;
  const ep = state.world.weather.episode;
  let weather = '';
  if (wx) weather = ` ${Math.round(wx.temp)}°C${wx.rain > 0.5 ? `, ${fmt(wx.rain)} mm of rain` : ', dry'}${ep && ep.left >= 0 ? `, ${epLabel(ep.type).toLowerCase()}` : ''}.`;
  $('clock').textContent = `${t.label}.${weather}`;
}
const epLabel = (k) => ({ lateFrost: 'Late frost', drySpell: 'Dry spell', longRain: 'Prolonged rain', warmSpell: 'Warm spell', windstorm: 'Windstorm' }[k] || k);

function renderPersistence() {
  const s = state.status;
  const saved = new Date(s.savedAt);
  const ago = Math.round((Date.now() - saved) / 3600000);
  const projected = state.world.meta.step - state.savedStep;
  const stale = ago > 30;
  $('persistence').innerHTML = `Saved in the GitHub repository at ${esc(saved.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }))} (${ago < 1 ? 'within the hour' : `${ago} h ago`}), ${esc(s.orchardTime)}. `
    + (projected > 0
      ? `<span class="live">Shown: brought forward ${projected} orchard day${projected > 1 ? 's' : ''} to now by your browser, using the same rules; the saved record will match when it next updates.</span>`
      : '<span class="live">Shown: the saved state, which is current.</span>')
    + (stale ? ' <span class="stale">The daily save is overdue; check the repository’s Actions tab.</span>' : '');
}

// --- Map ---------------------------------------------------------------------------

let canvas;
let ctx;
let cell = 20;

function setupMap() {
  canvas = $('map');
  ctx = canvas.getContext('2d');
  const resize = () => {
    const w = canvas.closest('.map-pane').clientWidth - 2;
    cell = Math.max(9, Math.floor(w / W));
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * cell * dpr;
    canvas.height = H * cell * dpr;
    canvas.style.width = `${W * cell}px`;
    canvas.style.height = `${H * cell}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawMap();
  };
  window.addEventListener('resize', resize);
  resize();
  canvas.addEventListener('click', (e) => {
    const r = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - r.left) / cell);
    const y = Math.floor((e.clientY - r.top) / cell);
    if (x >= 0 && y >= 0 && x < W && y < H) select(idx(x, y), true);
  });
  canvas.addEventListener('keydown', (e) => {
    const x = state.selected % W;
    const y = Math.floor(state.selected / W);
    const moves = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const m = moves[e.key];
    if (m) {
      e.preventDefault();
      const nx = Math.min(W - 1, Math.max(0, x + m[0]));
      const ny = Math.min(H - 1, Math.max(0, y + m[1]));
      select(idx(nx, ny), false);
    }
    if (e.key === 'Enter') showTab('patch');
  });
  const slider = $('season-slider');
  slider.addEventListener('input', async () => {
    const seasons = Number(slider.max);
    const v = Number(slider.value);
    if (v === seasons) { state.viewStep = null; state.snap = null; drawMap(); renderPast(); return; }
    const step = v * DAYS_PER_SEASON;
    try {
      state.snap = await getJSON(`${state.worldDir}/snapshots/step-${pad(step, 6)}.json`);
      state.viewStep = step;
    } catch { state.snap = null; state.viewStep = null; }
    drawMap();
    renderPast();
  });
}

function renderPast() {
  const b = $('past-banner');
  const slider = $('season-slider');
  if (state.viewStep === null) {
    b.hidden = true;
    $('slider-label').textContent = 'now';
  } else {
    b.hidden = false;
    b.textContent = `Looking back: start of ${orchardTime(state.viewStep).label.replace(' day 1', '')}`;
    $('slider-label').textContent = orchardTime(state.viewStep).label.replace(' day 1', '');
  }
  slider.setAttribute('aria-valuetext', $('slider-label').textContent);
}

function select(i, open) {
  state.selected = i;
  state.tree = null;
  drawMap();
  renderPatch();
  if (open) showTab('patch');
}

function buildLayerBar() {
  const bar = $('layers');
  bar.innerHTML = '';
  for (const L of LAYERS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(L.id === state.layer));
    b.textContent = L.label;
    b.onclick = () => {
      state.layer = L.id;
      for (const x of bar.children) x.setAttribute('aria-checked', String(x === b));
      drawMap();
    };
    bar.append(b);
  }
}

function currentSnap() { return state.snap || displaySnapshot(state.world); }

// Colours are mixed as hex strings; results stay hex so mixes can nest.
function mix(a, b, t) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const tt = Math.max(0, Math.min(1, Number.isFinite(t) ? t : 0));
  const c = [16, 8, 0].map((sh) => Math.round(((pa >> sh) & 255) * (1 - tt) + ((pb >> sh) & 255) * tt));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}
const clamp01 = (v) => Math.max(0, Math.min(1, v));

function shadeMap(snap) {
  const shade = new Array(W * H).fill(0);
  for (const t of snap.trees) {
    if (!['seedling', 'juvenile', 'adult'].includes(t.stage) || t.leaf <= 0) continue;
    const R = Math.ceil(t.r);
    const cells = [];
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      const x = t.x + dx; const y = t.y + dy;
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      if (Math.sqrt(dx * dx + dy * dy) <= Math.max(t.r, 0.01)) cells.push(idx(x, y));
    }
    const k = t.sp === 'bellfruit' ? 0.65 : 0.45;
    const lai = (t.leaf * 15) / (cells.length * 9);
    for (const c of cells) shade[c] += lai * k;
  }
  return shade.map((s) => Math.exp(-s)); // display only
}

function drawMap() {
  if (!ctx || !state.world) return;
  const snap = currentSnap();
  const L = snap.layers;
  const P = state.world.patches;
  const layer = state.layer;
  const light = layer === 'light' ? shadeMap(snap) : null;
  ctx.clearRect(0, 0, W * cell, H * cell);
  const legend = [];

  // Ground
  for (let i = 0; i < W * H; i++) {
    const x = (i % W) * cell;
    const y = Math.floor(i / W) * cell;
    const kind = P.kind[i];
    let col;
    if (kind === 'wall') col = COLORS.stone;
    else if (layer === 'moisture') col = mix('#E8E1CC', '#3F6E86', clamp01(L.moist[i]));
    else if (layer === 'light') col = mix('#2E3A30', '#F1E6B8', clamp01(light[i]));
    else if (layer === 'ground') {
      const s = clamp01(L.stitch[i] / 4);
      const c = clamp01(L.clover[i] / 4);
      col = mix(mix(COLORS.soil, '#B9C6A4', s), '#7C5E8C', c / Math.max(0.0001, s + c) * Math.min(1, c * 2));
    } else if (layer === 'seeds') col = mix('#E9E5D5', '#E9E5D5', 0);
    else if (layer === 'deadwood') col = mix('#E9E5D5', '#C9BFA6', clamp01(L.litter[i] / 10));
    else {
      const s = clamp01(L.stitch[i] / 4);
      const c = clamp01(L.clover[i] / 4);
      col = mix(mix(COLORS.soil, COLORS.stitch, s), COLORS.clover, c * 0.8);
      if (kind === 'glass') col = mix(col, COLORS.glass, 0.45);
    }
    ctx.fillStyle = col;
    ctx.fillRect(x, y, cell, cell);
    if (kind === 'wall') {
      ctx.strokeStyle = 'rgba(40,40,35,0.35)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 1.5, y + (i % 2 ? 2 : 0.5) + 0.5, cell - 3, cell / 2 - 1);
    }
    if (L.pond[i] > 3 && layer !== 'light') {
      ctx.fillStyle = `rgba(80,115,135,${Math.min(0.7, 0.15 + L.pond[i] / 30)})`;
      ctx.fillRect(x + 1, y + 1, cell - 2, cell - 2);
    }
  }
  // Glasshouse frame
  ctx.strokeStyle = 'rgba(70,90,100,0.55)';
  ctx.lineWidth = 1;
  for (let gx = 8; gx <= 19; gx++) { ctx.beginPath(); ctx.moveTo(gx * cell, 0); ctx.lineTo(gx * cell, 4 * cell); ctx.stroke(); }
  ctx.strokeRect(8 * cell + 0.5, 0.5, 11 * cell, 4 * cell);

  // Layer overlays
  if (layer === 'moisture') legend.push(['ramp', 'Dry soil to saturated', 'linear-gradient(90deg,#E8E1CC,#3F6E86)'], ['swatch', 'Standing water', 'rgba(80,115,135,0.7)']);
  if (layer === 'light') legend.push(['ramp', 'Deep shade to full light at ground level', 'linear-gradient(90deg,#2E3A30,#F1E6B8)']);
  if (layer === 'ground') legend.push(['swatch', 'Stitchgrass', '#B9C6A4'], ['swatch', 'Velvet Clover', '#7C5E8C'], ['swatch', 'Bare ground', COLORS.soil]);
  if (layer === 'seeds') {
    for (let i = 0; i < W * H; i++) {
      const b = L.seedsBell[i];
      const l = L.seedsLantern[i];
      const cx = (i % W) * cell + cell / 2;
      const cy = Math.floor(i / W) * cell + cell / 2;
      if (b > 0.05) { ctx.fillStyle = 'rgba(63,85,55,0.8)'; ctx.beginPath(); ctx.arc(cx - cell * 0.15, cy, Math.min(cell * 0.45, 1.5 + Math.sqrt(b) * cell * 0.08), 0, 7); ctx.fill(); }
      if (l > 0.05) { ctx.fillStyle = 'rgba(192,138,46,0.8)'; ctx.beginPath(); ctx.arc(cx + cell * 0.15, cy, Math.min(cell * 0.45, 1.5 + Math.sqrt(l) * cell * 0.08), 0, 7); ctx.fill(); }
    }
    legend.push(['dot', 'Bellfruit seeds (size = number)', 'rgba(63,85,55,0.8)'], ['dot', 'Lantern Pear seeds', 'rgba(192,138,46,0.8)']);
  }
  if (layer === 'pollinators') {
    // Reach of Copper Mason from nests with brood or adults
    const reach = new Array(W * H).fill(0);
    for (let i = 0; i < W * H; i++) {
      const pop = L.masonAdults[i] + L.masonBrood[i];
      if (pop <= 0.05) continue;
      const x0 = i % W; const y0 = Math.floor(i / W);
      for (let y = Math.max(0, y0 - 8); y <= Math.min(H - 1, y0 + 8); y++) for (let x = Math.max(0, x0 - 8); x <= Math.min(W - 1, x0 + 8); x++) {
        const d = Math.hypot(x - x0, y - y0);
        if (d <= 8) reach[idx(x, y)] += pop * Math.exp(-d / 2.8);
      }
    }
    const mx = Math.max(1e-6, ...reach);
    for (let i = 0; i < W * H; i++) {
      if (reach[i] <= 0) continue;
      ctx.fillStyle = `rgba(192,138,46,${0.08 + 0.5 * clamp01(reach[i] / mx)})`;
      ctx.fillRect((i % W) * cell, Math.floor(i / W) * cell, cell, cell);
      if (L.nestCap[i] > 0 && L.masonBrood[i] + L.masonAdults[i] > 0.05) {
        ctx.fillStyle = COLORS.ink;
        ctx.fillRect((i % W) * cell + cell * 0.35, Math.floor(i / W) * cell + cell * 0.35, cell * 0.3, cell * 0.3);
      }
      if (L.mothAdults[i] > 0.5) { ctx.fillStyle = 'rgba(70,80,120,0.55)'; ctx.beginPath(); ctx.arc((i % W) * cell + cell * 0.75, Math.floor(i / W) * cell + cell * 0.25, Math.min(cell * 0.2, 1 + L.mothAdults[i] / 4), 0, 7); ctx.fill(); }
    }
    legend.push(['swatch', 'Copper Mason foraging reach', 'rgba(192,138,46,0.45)'], ['swatch', 'Occupied nest cracks', COLORS.ink], ['dot', 'Dusk Moth adults', 'rgba(70,80,120,0.55)']);
  }
  if (layer === 'deadwood') {
    for (let i = 0; i < W * H; i++) {
      const x = (i % W) * cell; const y = Math.floor(i / W) * cell;
      const h = L.woodHard[i]; const s = L.woodSoft[i];
      if (h + s > 1) {
        ctx.fillStyle = mix('#E9E5D5', COLORS.bark, clamp01(h / 80));
        ctx.fillRect(x + 1, y + 1, cell - 2, (cell - 2) / 2);
        ctx.fillStyle = mix('#E9E5D5', COLORS.soft, clamp01(s / 50));
        ctx.fillRect(x + 1, y + cell / 2, cell - 2, (cell - 2) / 2);
      }
      if (L.fungus[i] > 0.05) {
        ctx.fillStyle = `rgba(240,236,220,${0.4 + 0.5 * clamp01(L.fungus[i])})`;
        ctx.strokeStyle = 'rgba(60,50,40,0.6)';
        ctx.beginPath(); ctx.arc(x + cell * 0.78, y + cell * 0.22, Math.max(2, cell * 0.16 * Math.min(1, L.fungus[i])), Math.PI, 0); ctx.fill(); ctx.stroke();
      }
    }
    legend.push(['ramp', 'Leaf litter', 'linear-gradient(90deg,#E9E5D5,#C9BFA6)'], ['swatch', 'Hard deadwood (top half)', COLORS.bark], ['swatch', 'Softened deadwood (bottom half)', COLORS.soft], ['dot', 'Threadcap', 'rgba(240,236,220,1)']);
  }

  // Fallen trunks, snags, trees
  const trees = snap.trees.slice().sort((a, b) => b.r - a.r);
  for (const t of trees) {
    if (t.stage === 'fallen' && t.fall) {
      ctx.strokeStyle = COLORS.bark;
      ctx.lineWidth = Math.max(3, cell * 0.35);
      ctx.lineCap = 'round';
      ctx.beginPath();
      t.fall.forEach((c, k) => {
        const px = (c % W) * cell + cell / 2; const py = Math.floor(c / W) * cell + cell / 2;
        if (k) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      });
      ctx.stroke();
      ctx.lineWidth = 1;
    }
  }
  const showTrees = layer !== 'light';
  const dim = layer !== 'map' && layer !== 'lineage';
  for (const t of trees) {
    const cx = t.x * cell + cell / 2;
    const cy = t.y * cell + cell / 2;
    if (t.stage === 'snag') {
      ctx.strokeStyle = 'rgba(80,70,60,0.8)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, cell * 0.3, 0, 7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - cell * 0.2, cy - cell * 0.2); ctx.lineTo(cx + cell * 0.2, cy + cell * 0.2); ctx.stroke();
      continue;
    }
    if (t.stage === 'fallen') {
      ctx.fillStyle = COLORS.bark; ctx.beginPath(); ctx.arc(cx, cy, cell * 0.22, 0, 7); ctx.fill();
      continue;
    }
    if (!showTrees && t.stage !== 'seedling') {
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy, Math.max(cell * 0.3, t.r * cell), 0, 7); ctx.stroke();
      continue;
    }
    if (t.stage === 'seedling') {
      // Seedlings: a small leaf-green mark; Lantern Pear seedlings are hollow
      ctx.globalAlpha = dim ? 0.5 : 1;
      if (t.sp === 'bellfruit') { ctx.fillStyle = COLORS.leafDark; ctx.beginPath(); ctx.arc(cx, cy, Math.max(1.8, cell * 0.13), 0, 7); ctx.fill(); }
      else { ctx.strokeStyle = '#4D5B2A'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(cx, cy, Math.max(1.8, cell * 0.13), 0, 7); ctx.stroke(); }
      ctx.globalAlpha = 1;
      continue;
    }
    const rad = Math.max(cell * 0.35, t.r * cell);
    const full = t.sp === 'bellfruit' ? 0.45 * (Math.max(t.leaf, 0) + 1) : 0;
    const leafy = clamp01(t.leaf / Math.max(1, 0.3 * Math.pow(Math.max(t.r, 0.5), 3) * 3));
    const base = t.sp === 'bellfruit' ? COLORS.leaf : COLORS.lantern;
    void full;
    ctx.globalAlpha = dim ? 0.35 : 1;
    if (t.leaf > 0.05) {
      ctx.fillStyle = base;
      ctx.globalAlpha *= 0.35 + 0.5 * Math.max(leafy, 0.4);
      ctx.beginPath(); ctx.arc(cx, cy, rad, 0, 7); ctx.fill();
      ctx.globalAlpha = dim ? 0.35 : 1;
    }
    // Crown outline: solid for Bellfruit, broken for the open Lantern Pear crown
    ctx.strokeStyle = t.sp === 'bellfruit' ? COLORS.leafDark : '#5F6E3C';
    ctx.lineWidth = 1.2;
    ctx.setLineDash(t.sp === 'lantern' ? [3, 2] : []);
    ctx.beginPath(); ctx.arc(cx, cy, rad, 0, 7); ctx.stroke();
    ctx.setLineDash([]);
    // Trunk
    ctx.fillStyle = COLORS.bark;
    ctx.beginPath(); ctx.arc(cx, cy, Math.max(1.5, cell * 0.12), 0, 7); ctx.fill();
    // Flowers and fruit, scattered deterministically within the crown
    const dots = (n, color, size, salt) => {
      ctx.fillStyle = color;
      for (let k = 0; k < n; k++) {
        const a = ((k * 137.5 + salt) * Math.PI) / 180;
        const rr = rad * 0.75 * Math.sqrt(((k * 0.618 + salt / 100) % 1));
        ctx.beginPath(); ctx.arc(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, size, 0, 7); ctx.fill();
      }
    };
    if (t.flowers > 0) dots(Math.min(18, Math.ceil(t.flowers / 15)), '#F7F4EA', Math.max(1, cell * 0.07), 11);
    if (t.fruit > 0) dots(Math.min(14, Math.ceil(t.fruit / 20)), t.sp === 'bellfruit' ? '#E6DFC4' : COLORS.amber, Math.max(1.2, cell * 0.09), 47);
    ctx.globalAlpha = 1;
  }
  // Fallen fruit
  if (layer === 'map') {
    for (let i = 0; i < W * H; i++) {
      if (L.fruit[i] > 0.1) {
        ctx.fillStyle = COLORS.amber;
        const n = Math.min(4, Math.ceil(L.fruit[i]));
        for (let k = 0; k < n; k++) { ctx.beginPath(); ctx.arc((i % W) * cell + cell * (0.25 + 0.17 * k), Math.floor(i / W) * cell + cell * 0.82, Math.max(1, cell * 0.06), 0, 7); ctx.fill(); }
      }
    }
    legend.push(['dot', 'Bellfruit crown', COLORS.leaf], ['dot', 'Lantern Pear crown (open)', COLORS.lantern], ['dot', 'Seedling (Lantern Pear hollow)', COLORS.leafDark], ['dot', 'Fruit', COLORS.amber], ['swatch', 'Fallen trunk', COLORS.bark], ['swatch', 'Stitchgrass', COLORS.stitch], ['swatch', 'Velvet Clover', COLORS.clover]);
  }
  // Names
  if (layer === 'map' || layer === 'lineage') {
    ctx.font = `${Math.max(10, Math.round(cell * 0.55))}px Literata, Georgia, serif`;
    ctx.fillStyle = COLORS.ink;
    ctx.textBaseline = 'bottom';
    for (const t of snap.trees) {
      if (!t.name) continue;
      const label = t.stage === 'fallen' || t.stage === 'snag' ? `site of ${t.name}` : t.name;
      ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(238,238,228,0.9)';
      ctx.strokeText(label, t.x * cell + cell * 0.7, t.y * cell + cell * 0.1);
      ctx.fillText(label, t.x * cell + cell * 0.7, t.y * cell + cell * 0.1);
    }
  }
  if (layer === 'lineage') {
    const byId = new Map(snap.trees.map((t) => [t.id, t]));
    ctx.strokeStyle = COLORS.loss; ctx.lineWidth = 1.2;
    for (const t of snap.trees) {
      const m = t.mother && byId.get(t.mother);
      if (!m || t.stage === 'seedling') continue;
      ctx.beginPath(); ctx.moveTo(m.x * cell + cell / 2, m.y * cell + cell / 2); ctx.lineTo(t.x * cell + cell / 2, t.y * cell + cell / 2); ctx.stroke();
    }
    legend.push(['swatch', 'Line from mother tree to an established offspring', COLORS.loss]);
  }
  // Place names (faint)
  if (layer === 'map') {
    ctx.font = `italic ${Math.max(10, Math.round(cell * 0.6))}px Literata, Georgia, serif`;
    ctx.fillStyle = 'rgba(35,43,38,0.5)';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    for (const p of state.world.places) {
      if (p.id === 'old-stand' || p.id === 'fallen-bough') continue;
      if (p.id === 'west-wall') {
        ctx.save();
        ctx.translate(1.15 * cell + cell / 2, 20.5 * cell);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(p.name, 0, 0);
        ctx.restore();
        continue;
      }
      const y = p.id === 'glasshouse' ? 0.15 : Math.min(H - 1.2, p.cy);
      ctx.fillText(p.name, p.cx * cell + cell / 2, y * cell + cell / 2);
    }
    ctx.textAlign = 'start';
  }
  // Selection
  const sx = (state.selected % W) * cell;
  const sy = Math.floor(state.selected / W) * cell;
  ctx.strokeStyle = COLORS.ink; ctx.lineWidth = 2;
  ctx.strokeRect(sx + 1, sy + 1, cell - 2, cell - 2);
  ctx.strokeStyle = '#EEEEE4'; ctx.lineWidth = 1;
  ctx.strokeRect(sx + 3, sy + 3, cell - 6, cell - 6);

  $('legend').innerHTML = legend.map(([kind, label, col]) => (kind === 'ramp'
    ? `<span><i class="ramp" style="background:${col}"></i>${esc(label)}</span>`
    : `<span><i style="background:${col};${kind === 'dot' ? 'border-radius:50%' : ''}"></i>${esc(label)}</span>`)).join('');

  const slider = $('season-slider');
  const seasons = Math.floor(state.world.meta.step / DAYS_PER_SEASON);
  if (Number(slider.max) !== seasons) { slider.max = seasons; if (state.viewStep === null) slider.value = seasons; }
}

// --- Notebook pages ------------------------------------------------------------------

function showTab(name) {
  for (const b of document.querySelectorAll('.tabs button')) b.setAttribute('aria-selected', String(b.dataset.tab === name));
  for (const p of document.querySelectorAll('.page')) p.hidden = p.id !== `page-${name}`;
}
for (const b of document.querySelectorAll('.tabs button')) b.onclick = () => showTab(b.dataset.tab);

const SKIP_ROUTINE = new Set(['weather']);

function eventItem(e) {
  const loss = ['death', 'fall', 'extinct', 'low', 'damage'].includes(e.type);
  return `<li class="${loss ? 'loss' : ''} ${e.type === 'weather' ? 'weather' : ''}"><span class="when">${esc(e.when)}${e.projected ? ' (since the last save)' : ''}</span>${esc(e.text)}</li>`;
}

// Fold runs of routine events (several trees establishing in one season) into one line
function groupEvents(list) {
  const out = [];
  const groups = new Map();
  for (const e of list) {
    if (e.type !== 'established') { out.push(e); continue; }
    const sp = e.text.split(' T')[0];
    const season = e.when.replace(/ day \d+$/, '');
    const key = `${sp}|${season}`;
    let g = groups.get(key);
    if (!g) { g = { ...e, items: [] }; groups.set(key, g); out.push(g); }
    g.items.push(e);
  }
  for (const g of groups.values()) {
    if (g.items.length < 3) continue;
    const sp = g.items[0].text.split(' T')[0];
    g.when = g.items[0].when.replace(/ day \d+$/, '');
    g.text = `${g.items.length} ${sp} trees established: ${g.items.map((e) => e.text.match(/T\d+ established at \([^)]+\)/)?.[0].replace(' established at', '')).join(', ')}.`;
  }
  return out.flatMap((e) => (e.items && e.items.length < 3 ? e.items : [e]));
}

function renderNow() {
  const w = state.world;
  const t = orchardTime(w.meta.step);
  const m = state.history[state.history.length - 1] || {};
  const living = (sp, st) => w.trees.filter((x) => x.sp === sp && x.stage === st).length;
  const recent = groupEvents(state.events.filter((e) => !SKIP_ROUTINE.has(e.type)).slice().reverse()).slice(0, 12);
  const weather = state.events.filter((e) => e.type === 'weather').slice(-3).reverse();
  const named = w.trees.filter((x) => x.name);
  const suggestions = whatNext();
  $('page-now').innerHTML = `
    <h2>${esc(t.season)}</h2>
    <p class="prose">${esc(SEASONS[t.seasonIndex].plain)}</p>
    <h2>Worth a look</h2>
    <ul class="note-list">${suggestions.map((s) => `<li>${s}</li>`).join('') || '<li>Nothing stands out today. Try the seed bank layer.</li>'}</ul>
    <h2>Recent in the orchard</h2>
    <ul class="events">${recent.map(eventItem).join('') || '<li>No events recorded yet.</li>'}</ul>
    ${weather.length ? `<h3>Weather episodes</h3><ul class="events">${weather.map(eventItem).join('')}</ul>` : ''}
    <h2>The named trees</h2>
    <ul class="events">${named.map((x) => `<li><button class="tree-link" data-tree="${x.id}">${esc(x.name)}</button>: ${esc(stageWords(x))}, condition ${Math.round(x.cond * 100)}%.</li>`).join('')}</ul>
    <h2>Counts today</h2>
    <dl class="figures">
      ${fig('Bellfruit', `${living('bellfruit', 'adult')} adult`, `${living('bellfruit', 'juvenile')} young, ${living('bellfruit', 'seedling')} seedlings`)}
      ${fig('Lantern Pear', `${living('lantern', 'adult')} adult`, `${living('lantern', 'juvenile')} young, ${living('lantern', 'seedling')} seedlings`)}
      ${fig('Seeds waiting', fmt((m.seedsBell || 0) + (m.seedsLantern || 0), 0), `${fmt(m.seedsBell, 0)} Bellfruit, ${fmt(m.seedsLantern, 0)} Lantern`)}
      ${fig('Copper Mason', fmt(m.masonAdults, 0), `flying; ${fmt(m.masonBrood, 0)} brood cells`)}
      ${fig('Dusk Moth', fmt(m.mothAdults, 0), `adults; ${fmt(m.mothLarvae, 0)} larvae, ${fmt(m.mothPupae, 0)} pupae`)}
      ${fig('Thimble Mouse', fmt(m.mice, 1), 'estimated')}
      ${fig('Mossback Snail', fmt(m.snails, 0), 'estimated')}
      ${fig('Needle Wren', fmt(m.wrens, 1), 'estimated')}
      ${fig('Stitchgrass', `${fmt(m.stitchKg, 0)} kg`, '')}
      ${fig('Velvet Clover', `${fmt(m.cloverKg, 0)} kg`, '')}
      ${fig('Deadwood', `${fmt((m.woodHard || 0) + (m.woodSoft || 0), 0)} kg`, `${fmt(m.woodSoft, 0)} kg softened`)}
      ${fig('Soil water', `${Math.round((m.moistRel || 0) * 100)}%`, 'of capacity, mean')}
    </dl>
    <p class="quiet">Animal numbers are estimates from local population groups, not counted individuals. Trees are individuals.</p>`;
  for (const b of $('page-now').querySelectorAll('[data-tree]')) b.onclick = () => openTree(b.dataset.tree);
}
const fig = (label, value, sub) => `<div><dt>${esc(label)}</dt><dd>${esc(value)} ${sub ? `<small>${esc(sub)}</small>` : ''}</dd></div>`;

function stageWords(t) {
  return { seedling: 'a seedling', juvenile: 'young, not yet flowering', adult: 'flowering age', snag: 'dead, still standing', fallen: 'fallen' }[t.stage] || t.stage;
}

// Suggestions for what a keeper might inspect next, drawn from the record
function whatNext() {
  const w = state.world;
  const out = [];
  const lastFall = [...state.events].reverse().find((e) => e.type === 'fall');
  if (lastFall) out.push(`${patchLink(lastFall.at)} where ${esc(lastFall.text.split(' was ')[0].split(' fell')[0])} came down: watch the gap and the new deadwood.`);
  const late = [...state.events].reverse().find((e) => e.type === 'dormancy');
  if (late) out.push(`${patchLink(late.at)}: seeds there woke after several winters underground.`);
  const weak = w.trees.filter((t) => t.name && ['adult', 'juvenile'].includes(t.stage)).sort((a, b) => a.cond - b.cond)[0];
  if (weak && weak.cond < 0.5) out.push(`${esc(weak.name)} is in poor condition (${Math.round(weak.cond * 100)}%).`);
  const young = w.trees.filter((t) => t.origin !== 'founding' && t.stage === 'juvenile');
  if (young.length) out.push(`${young.length} tree${young.length > 1 ? 's' : ''} born since the founding ${young.length > 1 ? 'have' : 'has'} established. The oldest is at ${patchLink(idx(young[0].x, young[0].y))}.`);
  const ready = w.seeds.filter((c) => c.ready > 0.5).length;
  if (ready) out.push(`${ready} seed cohort${ready > 1 ? 's are' : ' is'} awake and could germinate this spring.`);
  return out.slice(0, 5);
}
function patchLink(i) {
  if (i === undefined || i === null) return 'Somewhere';
  const x = i % W; const y = Math.floor(i / W);
  return `<button class="tree-link" data-patch="${i}">(${x},${y})</button>`;
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-patch]');
  if (b) select(Number(b.dataset.patch), true);
});

function renderPatch() {
  if (!state.world) return;
  if (state.tree) { renderTree(); return; }
  const i = state.selected;
  if (state.snap) {
    const L = state.snap.layers;
    $('page-patch').innerHTML = `<h2>(${i % W},${Math.floor(i / W)}) as it was</h2><p class="quiet">Looking back at the start of ${esc(orchardTime(state.viewStep).label.replace(' day 1', ''))}. Move the season slider to the right end to return to now.</p>
      <table class="facts">${[['Soil water (share of capacity)', L.moist[i]], ['Nutrients (nu)', L.nutr[i]], ['Leaf litter (kg)', L.litter[i]], ['Hard deadwood (kg)', L.woodHard[i]], ['Softened deadwood (kg)', L.woodSoft[i]], ['Threadcap (index)', L.fungus[i]], ['Stitchgrass (kg)', L.stitch[i]], ['Velvet Clover (kg)', L.clover[i]], ['Bellfruit seeds', L.seedsBell[i]], ['Lantern Pear seeds', L.seedsLantern[i]], ['Mossback Snails', L.snail[i]], ['Thimble Mice', L.mouse[i]]].map(([k, v]) => `<tr><th>${k}</th><td>${fmt(v, 2)}</td></tr>`).join('')}</table>`;
    return;
  }
  const p = inspectPatch(state.world, i, { events: state.events });
  const rows = (o, labels) => Object.entries(o).map(([k, v]) => `<tr><th>${esc(labels[k] || k)}</th><td>${typeof v === 'number' ? fmt(v, 2) : esc(v)}</td></tr>`).join('');
  $('page-patch').innerHTML = `
    <h2>(${p.x},${p.y})${p.place ? `, ${esc(p.place)}` : ''}</h2>
    ${p.notes.length ? `<ul class="note-list">${p.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
    ${p.trunks.length ? `<h3>Trees rooted here</h3><ul class="events">${p.trunks.map((t) => `<li><button class="tree-link" data-tree="${t.id}">${esc(t.name || `${t.species} ${t.id}`)}</button>, ${esc(stageWords(t))}, ${fmt(t.wood)} kg of wood.${t.limits ? `<br><span class="limits">${esc(t.limits)}</span>` : ''}</li>`).join('')}</ul>` : ''}
    ${p.underCrownsOf.length ? `<p>Under the crown${p.underCrownsOf.length > 1 ? 's' : ''} of ${p.underCrownsOf.map((id) => { const t = state.world.trees.find((o) => o.id === id); return `<button class="tree-link" data-tree="${id}">${esc(t.name || t.id)}</button>`; }).join(', ')}.</p>` : ''}
    <h3>Ground and soil now</h3>
    <table class="facts">${rows(p.now, {
    soilWater_mm: 'Soil water (mm)', soilWater_share: 'Soil water (share of capacity)', standingWater_mm: 'Standing water (mm)', nutrients_nu: 'Available nutrients (nu)', leafLitter_kg: 'Leaf litter (kg)', deadwoodHard_kg: 'Hard deadwood (kg)', deadwoodSoft_kg: 'Softened deadwood (kg)', threadcap_index: 'Threadcap (index)', canopyLAI: 'Leaf area overhead (m² per m²)', groundLight_share: 'Light at ground today (share of bright midsummer sun)', stitchgrass_kg: 'Stitchgrass (kg)', velvetClover_kg: 'Velvet Clover (kg)', fallenFruit_kg: 'Fallen fruit (kg)', invertebrates_index: 'Other invertebrates (index)',
  })}</table>
    <h3>Animals here (estimates)</h3>
    <table class="facts">${rows(p.animals, { copperMason_adults: 'Copper Mason adults', copperMason_brood: 'Copper Mason brood cells', duskMoth_adults: 'Dusk Moth adults', duskMoth_larvae: 'Dusk Moth larvae', duskMoth_pupae: 'Dusk Moth pupae', thimbleMouse: 'Thimble Mice', mossbackSnail: 'Mossback Snails', needleWren: 'Needle Wrens' })}</table>
    <h3>Seeds waiting here</h3>
    ${p.seedsWaiting.length ? `<table class="facts"><tr><th>Cohort</th><td>Viable seeds, origin</td></tr>${p.seedsWaiting.map((c) => `<tr><th>${esc(c.cohort)} ${esc(c.species)}</th><td>${fmt(c.viable)}${c.wakingThisSpring > 0.1 ? ` (${fmt(c.wakingThisSpring)} awake)` : ''}; ${esc(c.origin === 'founding' ? 'founding stock, parentage unknown' : `mother ${c.mother}`)}; ${esc(c.route)}${c.buried ? ', buried' : ', on the surface'}; since ${esc(c.since)}</td></tr>`).join('')}</table>` : '<p class="quiet">No viable seeds recorded here.</p>'}
    <h3>Fixed ground</h3>
    <table class="facts">${rows(p.ground, { elevation_m: 'Elevation (m)', soilDepth_m: 'Soil depth (m)', waterCapacity_mm: 'Water the soil can hold (mm)', drainage: 'Drainage (share of excess per day)', exposure: 'Exposure to wind and cold (0–1)', shelter_C: 'Warmth from shelter (°C)', baselineFertility: 'Baseline fertility', nestCracks: 'Nest cracks' })}</table>
    ${p.recentEvents.length ? `<h3>Recorded here</h3><ul class="events">${p.recentEvents.map(eventItem).join('')}</ul>` : ''}`;
  for (const b of $('page-patch').querySelectorAll('[data-tree]')) b.onclick = () => openTree(b.dataset.tree);
}

function openTree(id) {
  state.tree = id;
  const t = state.world.trees.find((o) => o.id === id);
  if (t) { state.selected = idx(t.x, t.y); drawMap(); }
  renderTree();
  showTab('patch');
}

function renderTree() {
  const d = inspectTree(state.world, state.tree, { events: state.events });
  if (!d) { state.tree = null; renderPatch(); return; }
  const traitRows = Object.entries(d.traits).map(([k, v]) => `<tr><th>${esc(v.meaning)}</th><td>${fmt(v.value, 2)} <span class="quiet">(typical ${fmt(v.speciesTypical, 2)})</span></td></tr>`).join('');
  const hist = d.history.slice(-6).reverse().map((h) => `<tr><th>Year ${h.year}</th><td>${h.flowers} flowers, ${h.pollinated} pollinated${h.frosted ? `, ${h.frosted} frosted` : ''}; ${h.fruit} fruit, about ${h.seeds} seeds${h.selfShare > 0.1 ? `; ${Math.round(h.selfShare * 100)}% self-pollinated` : ''}</td></tr>`).join('');
  const link = (id) => { if (!id) return 'not recorded'; const t = state.world.trees.find((o) => o.id === id); return t ? `<button class="tree-link" data-tree="${id}">${esc(t.name || id)}</button>` : esc(id); };
  $('page-patch').innerHTML = `
    <p><button class="tree-link" id="back-to-patch">Back to the patch</button></p>
    <h2>${esc(d.name || `${d.species} ${d.id}`)}</h2>
    <p class="quiet">${esc(d.species)}, ${esc(d.id)}. ${esc(d.at.place || '')} (${d.at.x},${d.at.y}). Born ${esc(d.born)}${d.origin === 'founding' ? ' (founding tree)' : ''}.</p>
    <table class="facts">
      <tr><th>Stage</th><td>${esc(stageWords(d))}</td></tr>
      <tr><th>Age</th><td>${d.origin === 'founding' ? `at least ${fmt(d.ageYears, 0)} orchard years` : `${fmt(d.ageYears)} orchard years`}</td></tr>
      <tr><th>Condition (reserves held, 0–100%)</th><td>${Math.round(d.condition * 100)}%</td></tr>
      <tr><th>Structural weakness (0–1)</th><td>${fmt(d.structuralWeakness, 2)}</td></tr>
      <tr><th>Wood / leaf / reserve (kg)</th><td>${fmt(d.size.wood_kg)} / ${fmt(d.size.leaf_kg)} / ${fmt(d.size.reserve_kg)}</td></tr>
      <tr><th>Height, crown radius</th><td>${fmt(d.size.height_m)} m, ${fmt(d.size.crownRadius_patches * 3)} m</td></tr>
      <tr><th>Mother, father</th><td>${link(d.mother)}, ${link(d.father)}</td></tr>
      ${d.death ? `<tr><th>Died</th><td>${esc(orchardTime(d.death.step).label)}: ${esc(d.death.cause)}</td></tr>` : ''}
    </table>
    ${d.today && d.today.explanation ? `<h3>Today</h3><p class="limits">${esc(d.today.explanation)}</p>` : ''}
    ${d.flowering ? `<p>This year so far: ${d.flowering.thisYear.flowers} flowers, ${d.flowering.thisYear.pollinated} pollinated, ${d.flowering.thisYear.developingFruit} fruit developing.</p>` : ''}
    ${hist ? `<h3>Flowering and fruit</h3><table class="facts">${hist}</table>` : ''}
    <h3>Inherited traits</h3>
    <table class="facts">${traitRows}</table>
    <h3>Known offspring</h3>
    ${d.descendants.length ? `<ul class="events">${d.descendants.slice(0, 30).map((o) => `<li>${link(o.id)}: ${esc(o.species)}, ${esc(stageWords(o))}</li>`).join('')}</ul>${d.descendants.length > 30 ? `<p class="quiet">and ${d.descendants.length - 30} more.</p>` : ''}` : '<p class="quiet">None recorded yet. Seedlings are listed once they germinate; most do not survive.</p>'}
    ${d.events.length ? `<h3>Recorded events</h3><ul class="events">${d.events.map(eventItem).join('')}</ul>` : ''}`;
  $('back-to-patch').onclick = () => { state.tree = null; renderPatch(); };
  for (const b of $('page-patch').querySelectorAll('[data-tree]')) b.onclick = () => openTree(b.dataset.tree);
}

// Records: one chart at a time, absolute values
let chartKey = 'seedsLantern';
function renderRecords() {
  const rows = state.history;
  const col = COLUMNS.find(([k]) => k === chartKey) || COLUMNS[1];
  const opts = COLUMNS.filter(([k]) => k !== 'step').map(([k, label, unit]) => `<option value="${k}" ${k === chartKey ? 'selected' : ''}>${esc(label)} (${esc(unit)})</option>`).join('');
  let svg = '<p class="quiet">No measurements recorded yet.</p>';
  if (rows.length > 1) {
    const Wd = 560; const Ht = 220; const pl = 48; const pb = 26; const pt = 10;
    const xs = rows.map((r) => r.step);
    const ys = rows.map((r) => r[col[0]] ?? 0);
    const x0 = Math.min(...xs); const x1 = Math.max(...xs);
    const yMax = Math.max(...ys) || 1;
    const X = (v) => pl + ((v - x0) / Math.max(1, x1 - x0)) * (Wd - pl - 8);
    const Y = (v) => pt + (1 - v / yMax) * (Ht - pt - pb);
    const pts = rows.map((r) => `${X(r.step).toFixed(1)},${Y(r[col[0]] ?? 0).toFixed(1)}`).join(' ');
    const projStart = rows.findIndex((r) => r.projected);
    let marks = '';
    for (let s = Math.ceil(x0 / DAYS_PER_SEASON) * DAYS_PER_SEASON; s <= x1; s += DAYS_PER_SEASON) {
      const t = orchardTime(s);
      marks += `<line x1="${X(s)}" x2="${X(s)}" y1="${pt}" y2="${Ht - pb}" stroke="#C7C8B8" stroke-dasharray="${t.seasonIndex === 0 ? '0' : '2 3'}"/><text x="${X(s) + 3}" y="${Ht - 8}">${t.seasonIndex === 0 ? `Y${t.year}` : t.season.slice(0, 1)}</text>`;
    }
    svg = `<svg class="chart" viewBox="0 0 ${Wd} ${Ht}" role="img" aria-label="${esc(col[1])} over time">
      ${marks}
      <line x1="${pl}" x2="${Wd - 8}" y1="${Ht - pb}" y2="${Ht - pb}" stroke="#232B26"/>
      <text x="${pl - 6}" y="${pt + 8}" text-anchor="end">${fmt(yMax)}</text><text x="${pl - 6}" y="${Ht - pb}" text-anchor="end">0</text>
      ${projStart > 0 ? `<rect x="${X(rows[projStart].step)}" y="${pt}" width="${Wd - 8 - X(rows[projStart].step)}" height="${Ht - pt - pb}" fill="rgba(185,127,37,0.08)"/>` : ''}
      <polyline points="${pts}" fill="none" stroke="#3F5537" stroke-width="1.6"/>
    </svg>
    <p class="quiet">Absolute values from zero. Dashed lines mark seasons. ${projStart > 0 ? 'The tinted end was worked out by your browser since the last save.' : ''}</p>`;
  }
  const evs = groupEvents(state.events.filter((e) => e.type !== 'weather').slice().reverse());
  $('page-records').innerHTML = `
    <div class="chart-pick"><label>Show <select id="metric">${opts}</select></label></div>
    ${svg}
    <h2>Event record</h2>
    <ul class="events">${evs.map(eventItem).join('') || '<li>Nothing recorded yet.</li>'}</ul>
    <p class="quiet">This page shows the current and previous orchard year. Full records are in the repository under <code>${esc(state.worldDir)}/</code>.</p>`;
  $('metric').onchange = (e) => { chartKey = e.target.value; renderRecords(); };
}

async function renderHow() {
  const md = await getText('docs/HOW-IT-WORKS.md');
  $('page-how').innerHTML = md ? `<div class="prose">${markdown(md)}</div>` : '<p>See docs/HOW-IT-WORKS.md in the repository.</p>';
}
function markdown(md) {
  const out = [];
  let list = false;
  for (const raw of md.split('\n')) {
    const line = raw.trimEnd();
    const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/`(.+?)`/g, '<code>$1</code>').replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');
    if (/^- /.test(line)) { if (!list) { out.push('<ul>'); list = true; } out.push(`<li>${inline(line.slice(2))}</li>`); continue; }
    if (list) { out.push('</ul>'); list = false; }
    if (/^### /.test(line)) out.push(`<h3>${inline(line.slice(4))}</h3>`);
    else if (/^## /.test(line)) out.push(`<h2>${inline(line.slice(3))}</h2>`);
    else if (/^# /.test(line)) continue;
    else if (line.startsWith('|')) out.push(`<p class="quiet">${inline(line)}</p>`);
    else if (line) out.push(`<p>${inline(line)}</p>`);
  }
  if (list) out.push('</ul>');
  return out.join('\n');
}

function renderAll() {
  renderClock();
  renderPersistence();
  drawMap();
  renderNow();
  renderPatch();
  renderRecords();
}

load();
renderHow();
void realTimeOfStep; void PLACES; void speciesName;
