#!/usr/bin/env node
// Follows tree recruitment from seed to flowering on a development world,
// without changing it (it only listens through the engine's observer).
//
//   node tools/recruitment.mjs --seed 101 --years 140 --json out.json
//
// For each species it counts the seed funnel (made, eaten, rotted, germinated,
// crowded out) and the seedling funnel (germinated, died by cause,
// established, reached flowering), split by where the seed germinated and by
// whether it came from founding stock or was produced in the orchard.
import fs from 'node:fs';
import { createWorld, advance, DAYS_PER_YEAR, crownRadius, params } from '../engine/index.js';
import { disc, W } from '../engine/landscape.js';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const seed = Number(opt('seed', 101));
const years = Number(opt('years', 140));
const out = opt('json', null);
params.MECHANISMS.forgottenCaches = args.includes('--caches');
params.MECHANISMS.saplingBank = args.includes('--saplings');
if (opt('forget', null) !== null) params.ANIMALS.mouse.forgetShare = Number(opt('forget'));
const condition = `${params.MECHANISMS.forgottenCaches ? `caches ${Math.round(params.ANIMALS.mouse.forgetShare * 100)}%` : ''}${params.MECHANISMS.forgottenCaches && params.MECHANISMS.saplingBank ? '+' : ''}${params.MECHANISMS.saplingBank ? 'saplings' : ''}` || 'neither';

const w = createWorld({ seed, foundedAt: '2026-01-01T00:00:00Z', worldId: `rec-${seed}`, name: `recruitment ${seed}` });
const LIVING = new Set(['juvenile', 'adult']);
const formerCrown = new Set(); // patches once under a crown that has since died
let canopyStep = -1;
let canopy = null;
function canopyNow(step) {
  if (canopyStep === step) return canopy;
  canopy = { bellfruit: new Set(), lantern: new Set() };
  for (const t of w.trees) {
    if (!LIVING.has(t.stage)) continue;
    for (const c of disc(t.x, t.y, crownRadius(t))) canopy[t.sp].add(c.i);
  }
  canopyStep = step;
  return canopy;
}
function siteOf(i, step) {
  const c = canopyNow(step);
  if (c.bellfruit.has(i)) return 'under Bellfruit';
  if (c.lantern.has(i)) return 'under Lantern Pear';
  if (formerCrown.has(i) || w.patches.woodHard[i] + w.patches.woodSoft[i] > 5) return 'gap or deadwood';
  return 'open';
}

const seedFunnel = {}; // sp|origin -> counts
const sf = (sp, origin) => {
  const k = `${sp}|${origin === 'founding' || origin === 'founding-moved' ? 'founding stock' : 'orchard-born'}`;
  return seedFunnel[k] || (seedFunnel[k] = { made: 0, eaten: 0, rotted: 0, germinated: 0, crowded: 0 });
};
for (const c of w.seeds) sf(c.sp, 'founding').made += c.n;
const plants = new Map(); // tree id -> record
const byDecade = [];

w._observe = (type, p) => {
  if (type === 'seedsDropped') sf(p.sp, 'orchard').made += p.n;
  else if (type === 'seedEaten') sf(p.sp, p.origin).eaten += p.n;
  else if (type === 'seedDecay') sf(p.sp, p.origin).rotted += p.n;
  else if (type === 'crowded') sf(p.cohort.sp, p.cohort.origin).crowded += 1;
  else if (type === 'germinated') {
    const t = p.tree;
    sf(t.sp, p.cohort.origin).germinated += 1;
    plants.set(t.id, {
      sp: t.sp, site: siteOf(t.y * W + t.x, p.step), origin: (p.cohort.origin || '').startsWith('founding') ? 'founding stock' : 'orchard-born',
      route: p.cohort.disp, born: p.step, fate: 'alive', establishedAt: null, adultAt: null,
    });
  } else if (type === 'released') {
    const r = plants.get(p.tree.id);
    if (r) r.releasedAt = p.step;
  } else if (type === 'death') {
    const r = plants.get(p.tree.id);
    if (r) r.sup = p.tree.sup ? { ...p.tree.sup } : null;
    if (r && r.fate === 'alive') { r.fate = p.cause; r.diedAt = p.step; r.diedStage = p.tree.stage; }
    if (LIVING.has(p.tree.stage)) for (const c of disc(p.tree.x, p.tree.y, crownRadius(p.tree))) formerCrown.add(c.i);
  } else if (type === 'fell') {
    const r = plants.get(p.tree.id);
    if (r && r.fate === 'alive' && p.wasAlive) { r.fate = `fell (${p.cause})`; r.diedAt = p.step; }
    for (const c of disc(p.tree.x, p.tree.y, Math.max(1, crownRadius(p.tree)))) formerCrown.add(c.i);
  } else if (type === 'established') {
    const r = plants.get(p.tree.id);
    if (r) r.establishedAt = p.step;
  } else if (type === 'adult') {
    const r = plants.get(p.tree.id);
    if (r) r.adultAt = p.step;
  }
};

const t0 = Date.now();
for (let y = 1; y <= years; y++) {
  advance(w, y * DAYS_PER_YEAR);
  if (y % 10 === 0 || y === 1) {
    const count = (sp, st, born) => w.trees.filter((t) => t.sp === sp && t.stage === st && (born === undefined || (born ? t.origin !== 'founding' : t.origin === 'founding'))).length;
    byDecade.push({
      year: y,
      bellAdultsFounding: count('bellfruit', 'adult', false),
      bellAdultsBorn: count('bellfruit', 'adult', true),
      bellJuveniles: count('bellfruit', 'juvenile'),
      lanternAdultsFounding: count('lantern', 'adult', false),
      lanternAdultsBorn: count('lantern', 'adult', true),
      lanternJuveniles: count('lantern', 'juvenile'),
      maxGen: Math.max(0, ...w.trees.filter((t) => LIVING.has(t.stage)).map((t) => t.gen)),
      seedsBell: Math.round(w.seeds.filter((c) => c.sp === 'bellfruit').reduce((a, c) => a + c.n, 0)),
      seedsLantern: Math.round(w.seeds.filter((c) => c.sp === 'lantern').reduce((a, c) => a + c.n, 0)),
    });
    process.stderr.write(`seed ${seed}: year ${y} (${Math.round((Date.now() - t0) / 1000)} s)\n`);
  }
}

// Suppressed young trees: how long they waited, their carbon while waiting, what became of them
for (const t of w.trees) { const r = plants.get(t.id); if (r && r.fate === 'alive') r.sup = t.sup ? { ...t.sup } : null; }
const suppressed = {};
for (const r of plants.values()) {
  if (!r.sup || r.sup.days < DAYS_PER_YEAR / 2) continue;
  const s0 = suppressed[r.sp] || (suppressed[r.sp] = { trees: 0, waitedYearPlus: 0, released: 0, releasedThenFlowered: 0, diedWaiting: 0, stillWaiting: 0, days: 0, P: 0, R: 0, flush: 0 });
  s0.trees += 1;
  if (r.sup.days >= DAYS_PER_YEAR) s0.waitedYearPlus += 1;
  if (r.releasedAt) { s0.released += 1; if (r.adultAt) s0.releasedThenFlowered += 1; }
  else if (r.fate === 'alive') s0.stillWaiting += 1;
  else s0.diedWaiting += 1;
  s0.days += r.sup.days; s0.P += r.sup.P; s0.R += r.sup.R; s0.flush += r.sup.flush;
}

// Seedling funnel by species, site and origin
const funnel = {};
for (const r of plants.values()) {
  const k = `${r.sp}|${r.site}|${r.origin}`;
  const f = funnel[k] || (funnel[k] = { germinated: 0, diedAsSeedling: 0, causes: {}, established: 0, flowered: 0, aliveNow: 0 });
  f.germinated += 1;
  if (r.establishedAt !== null) f.established += 1;
  if (r.adultAt !== null) f.flowered += 1;
  if (r.fate === 'alive') f.aliveNow += 1;
  else if (r.establishedAt === null) { f.diedAsSeedling += 1; f.causes[r.fate] = (f.causes[r.fate] || 0) + 1; }
}
for (const v of Object.values(seedFunnel)) for (const k of Object.keys(v)) v[k] = Math.round(v[k]);
const result = { seed, condition, suppressed, years, seconds: Math.round((Date.now() - t0) / 1000), seedFunnel, funnel, byDecade, finalTrees: w.trees.length };
if (out) fs.writeFileSync(out, JSON.stringify(result, null, 1));
else console.log(JSON.stringify(result, null, 1));
