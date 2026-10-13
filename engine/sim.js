// One orchard day.
//
// Order of a day:
//   1. weather
//   2. canopy and light (from the trees as they stand this morning)
//   3. water: rain, runoff, demand, evaporation, drainage
//   4. plant production: nutrient demand first, then growth scaled by supply
//   5. flowers and pollination (Copper Mason, Dusk Moth)
//   6. fruit development and fall
//   7. animals: mice, snails, moth larvae, wrens, other invertebrates
//   8. decomposition and Threadcap
//   9. the seed bank: chilling, losses, germination
//  10. tree deaths, storms, life stages
//  11. bookkeeping: metrics, events, quantisation
//
// Every random draw comes from a generator unique to (world, day, purpose),
// so nothing outside this function can change what happens.

import {
  TREES, TRAITS, TREE_LIFE, WATER, NUTRIENTS, GROUND, DECAY, ANIMALS, MECHANISMS,
} from './params.js';
import { exp, pow, clamp, sat, q } from './dmath.js';
import { streamFor } from './rng.js';
import { orchardTime, DAYS_PER_YEAR } from './clock.js';
import { stepWeather } from './weather.js';
import { N, W, idx, N8, disc, hood, PLACES } from './landscape.js';
import { newTree } from './world.js';

const SLA = 15; // m2 leaf per kg leaf
const N9 = N8.map((l, i) => [i].concat(l));
const PATCH_AREA = 9; // m2
const LIVING = new Set(['seedling', 'juvenile', 'adult']);
const vdayCache = new Map();
const VDAY = (perYear) => {
  let v = vdayCache.get(perYear);
  if (v === undefined) { v = 1 - pow(1 - perYear, 1 / DAYS_PER_YEAR); vdayCache.set(perYear, v); }
  return v;
};
// exp(-d / k) for the few distances that occur on the grid, remembered
const kernelCache = new Map();
function kernel(d, k) {
  const key = d * 1000 + k;
  let v = kernelCache.get(key);
  if (v === undefined) { v = exp(-d / k); kernelCache.set(key, v); }
  return v;
}

export function treeHeight(t) {
  return 0.3 + 15 * (1 - exp(-t.wood / 350)) * pow(t.traits.matureSize, 0.3);
}
export function crownRadius(t) {
  return 0.3 + TREES[t.sp].crownCoef * pow(Math.max(t.wood, 0.001), 1 / 3) * pow(t.traits.matureSize, 0.2);
}
function leafTargetFull(t) {
  return TREES[t.sp].leafCoef * pow(Math.max(t.wood, 0.001), 0.75) * pow(t.traits.matureSize, 0.25);
}
// Share of full leaf a deciduous tree carries on this day of the year.
export function leafPhase(doy) {
  if (doy < 28) return 0;
  if (doy < 70) return (doy - 28) / 42;
  if (doy < 214) return 1;
  if (doy < 250) return 1 - (doy - 214) / 36;
  return 0;
}
function ageYears(t, step) { return (step - t.born) / DAYS_PER_YEAR; }

function groundCoverFrac(P, i) {
  return clamp((P.stitch[i] + P.clover[i]) / GROUND.maxKg, 0, 1);
}

export function shelterCover(P, i, lai) {
  // How much hiding cover a patch offers small animals (0..~1.2)
  return clamp(0.5 * groundCoverFrac(P, i) + 0.25 * clamp(lai / 3, 0, 1)
    + 0.35 * clamp((P.woodHard[i] + P.woodSoft[i]) / 50, 0, 1) + 0.15 * clamp(P.litter[i] / 8, 0, 1), 0, 1.2);
}

export function stepWorld(world) {
  const step = world.meta.step; // the day being simulated
  const t = orchardTime(step);
  const doy = t.dayOfYear;
  // A fresh object with the same arrays: keeps property lookups fast in the hot loops
  const P = { ...world.patches };
  const seed = world.meta.seed;
  const events = [];
  const tally = {
    germinated: 0, germDied: 0, seedlingDeaths: 0, seedsEaten: 0, seedsCached: 0,
    flowersFrosted: 0, seedlingsFrosted: 0, newBrood: 0, fruitDropped: 0,
  };

  const c = { world, step, t, doy, P, seed, events, tally };
  stage1(c);
  stage2(c);
  stage3(c);
  stage4(c);
  stage4a(c);
  stage4b(c);
  stage5(c);
  stage6(c);
  stage7(c);
  stage8(c);
  stage9(c);
  stage10(c);
  const { wx, laiTotal } = c;
  // 11. Bookkeeping -----------------------------------------------------------------
  if (world.weather.episode) {
    const d = world.weather.episode.damage || (world.weather.episode.damage = { flowers: 0, seedlings: 0, fallen: 0 });
    d.flowers = q(d.flowers + tally.flowersFrosted);
    d.seedlings += tally.seedlingsFrosted;
  }
  if (world.weather.episode && world.weather.episode.left <= 0) {
    const ep = world.weather.episode;
    const dmg = ep.damage || {};
    const parts = [];
    if (dmg.flowers >= 1) parts.push(`${Math.round(dmg.flowers)} open flowers killed by frost`);
    if (dmg.seedlings >= 1) parts.push(`${dmg.seedlings} seedling${dmg.seedlings > 1 ? 's' : ''} killed by frost`);
    if (dmg.fallen) parts.push(`${dmg.fallen} tree${dmg.fallen > 1 ? 's' : ''} brought down`);
    if (parts.length) events.push({ type: 'damage', kind: ep.type, text: `${capital(ep.type)} ended: ${parts.join('; ')}.` });
  }
  const metrics = measure(world, step, wx, laiTotal, tally);
  watchPopulations(world, step, metrics, events);
  quantise(world);
  world.meta.step = step + 1;
  for (const e of events) {
    e.id = `E${++world.counters.event}`;
    e.step = step;
    e.when = t.label;
  }
  return { events, metrics };
}


function stage1(c) {
  const { world, step, P, events } = c;
  // 1. Weather ----------------------------------------------------------------
  const wx = stepWeather(world, step, events);
  const temp = new Array(N);
  for (let i = 0; i < N; i++) temp[i] = wx.temp + P.shelter[i] - 1.1 * P.exposure[i] + 0.5;
  Object.assign(c, { wx, temp });
}

function stage2(c) {
  const { world, doy, wx } = c;
  // 2. Canopy and light --------------------------------------------------------
  const living = world.trees.filter((tr) => LIVING.has(tr.stage));
  const phase = leafPhase(doy);
  const layers = Array.from({ length: N }, () => []);
  const crown = new Map();
  for (const tr of living) {
    const r = crownRadius(tr);
    const cells = disc(tr.x, tr.y, Math.max(r, 0.01));
    const h = treeHeight(tr);
    const lai = (tr.leaf * SLA) / (cells.length * PATCH_AREA);
    crown.set(tr.id, { cells, h, lai, r });
    const k = TREES[tr.sp].lightK;
    for (const c of cells) layers[c.i].push({ h, kl: lai * k, id: tr.id });
  }
  const laiTotal = new Array(N).fill(0);
  const groundLight = new Array(N);
  for (let i = 0; i < N; i++) {
    let s = 0;
    let l = 0;
    for (const L of layers[i]) { s += L.kl; l += L.kl; }
    laiTotal[i] = l;
    groundLight[i] = wx.light * exp(-s);
  }
  Object.assign(c, { living, phase, layers, crown, laiTotal, groundLight });
}

function stage3(c) {
  const { world, doy, P, wx, temp, living, crown, laiTotal } = c;
  // 3. Water -------------------------------------------------------------------
  const pet = (WATER.petBase + WATER.petPerDeg * Math.max(wx.temp, 0)) * wx.light;
  // Rain and ponded water soak in; excess runs downhill.
  if (!world._order) {
    world._order = Array.from({ length: N }, (_, i) => i).sort((a, b) => P.elev[b] - P.elev[a] || a - b);
  }
  for (let i = 0; i < N; i++) {
    if (P.kind[i] === 'wall') continue;
    const rain = wx.rain * (P.kind[i] === 'glass' ? WATER.glassRainShare : 1);
    P.moist[i] += rain + P.pond[i];
    P.pond[i] = 0;
  }
  for (const i of world._order) {
    if (P.kind[i] === 'wall') continue;
    const excess = P.moist[i] - P.cap[i];
    if (excess <= 0) continue;
    P.moist[i] = P.cap[i];
    let low = -1;
    let lowE = P.elev[i];
    for (const j of N8[i]) {
      if (P.kind[j] !== 'wall' && P.elev[j] < lowE) { lowE = P.elev[j]; low = j; }
    }
    const x = i % W;
    const y = Math.floor(i / W);
    if (low >= 0) {
      P.moist[low] += excess * WATER.runoffShare;
      P.pond[i] += excess * (1 - WATER.runoffShare);
    } else if (y === world.H - 1 || x === W - 1) {
      // The open south and east boundaries let surface water run out of the orchard
      P.pond[i] += excess * (1 - WATER.runoffShare);
    } else {
      P.pond[i] += excess;
    }
  }
  // Demand
  const demand = new Array(N).fill(0);
  const treeDemand = new Map();
  for (const tr of living) {
    const cr = crown.get(tr.id);
    const litres = WATER.treeTranspPerLeafKg * tr.leaf * pet;
    const perCell = litres / (PATCH_AREA * cr.cells.length);
    treeDemand.set(tr.id, perCell);
    for (const c of cr.cells) demand[c.i] += perCell;
  }
  const groundDemand = new Array(N);
  for (let i = 0; i < N; i++) {
    groundDemand[i] = pet * WATER.groundTranspFrac * groundCoverFrac(P, i) * (doy >= 252 ? 0.2 : 1);
    demand[i] += groundDemand[i];
  }
  const waterRatio = new Array(N).fill(1);
  for (let i = 0; i < N; i++) {
    if (P.kind[i] === 'wall') { waterRatio[i] = 0; continue; }
    const cap = P.cap[i];
    const avail = Math.max(0, P.moist[i] - WATER.wiltFrac * cap);
    const rel = P.moist[i] / cap;
    const ease = clamp((rel - WATER.wiltFrac) / (0.5 - WATER.wiltFrac), 0, 1);
    const ratio = demand[i] > 0 ? Math.min(1, (0.5 * avail) / demand[i]) * ease : ease;
    waterRatio[i] = ratio;
    P.moist[i] -= demand[i] * Math.min(ratio, 1);
    // Soil evaporation, reduced by plant cover and litter
    const cover = groundCoverFrac(P, i);
    const shield = (1 - 0.75 * cover) * (1 - 0.4 * clamp(P.litter[i] / 8, 0, 1)) * (0.3 + 0.7 * exp(-laiTotal[i]));
    const evap = pet * WATER.soilEvapFrac * shield * clamp(P.moist[i] / cap, 0, 1);
    P.moist[i] = Math.max(0, P.moist[i] - evap);
    // Drainage and leaching
    const field = WATER.fieldFrac * cap;
    if (P.moist[i] > field) {
      const drained = (P.moist[i] - field) * P.drain[i];
      P.moist[i] -= drained;
      const leach = P.nutr[i] * NUTRIENTS.leachShare * (drained / cap);
      P.nutr[i] -= leach;
      world.ledger.leached += leach;
    }
    if (P.pond[i] > 0) P.pond[i] = Math.max(0, P.pond[i] - pet * WATER.pondEvapFrac);
  }
  Object.assign(c, { pet, demand, treeDemand, groundDemand, waterRatio });
}

function stage4(c) {
  const {  } = c;
  // 4. Plant production ---------------------------------------------------------
}

function stage4a(c) {
  const { doy, P, seed, wx, temp, living, phase, layers, crown, groundLight, demand, waterRatio } = c;
  // 4a. Potential production of every tree, and its nutrient demand.
  const nDemand = new Array(N).fill(0);
  const pot = new Map();
  const isSeedlingCompeting = (tr) => tr.stage === 'seedling' || tr.wood < 2;
  for (const tr of living) {
    const S = TREES[tr.sp];
    const T = tr.traits;
    const cr = crown.get(tr.id);
    // Light reaching this crown (shade from taller trees), averaged over its cells
    let shade = 0;
    // Only trees clearly taller cast full shade; near-equals share the light
    for (const c of cr.cells) {
      for (const L of layers[c.i]) if (L.h > cr.h) shade += L.kl * clamp((L.h - cr.h) / (0.2 * cr.h + 0.3), 0, 1);
    }
    shade /= cr.cells.length;
    let light = wx.light * exp(-shade);
    let wr = 0;
    for (const c of cr.cells) wr += waterRatio[c.i];
    wr /= cr.cells.length;
    const ti = idx(tr.x, tr.y);
    if (isSeedlingCompeting(tr)) {
      const sc = P.stitch[ti] / GROUND.maxKg;
      light *= 1 - 0.3 * clamp(sc, 0, 1);
      wr *= 1 - 0.55 * clamp(sc, 0, 1);
    }
    const half = 0.32 * (1 - 0.75 * T.shadeTol);
    const lr = (light / (light + half)) * (1 + half);
    const fw = wr <= 0 ? 0 : pow(clamp(wr, 0, 1), 1 - 0.6 * T.droughtTol);
    const ft = clamp((temp[ti] - 3) / 12, 0, 1);
    const kl = S.lightK * cr.lai;
    const selfEff = kl > 0.01 ? (1 - exp(-kl)) / kl : 1;
    const epsMult = (1 - 0.18 * T.shadeTol) * (1 - 0.15 * T.droughtTol);
    const P0 = S.eps * epsMult * tr.leaf * selfEff * lr * ft * fw;
    const tc = clamp(temp[ti], -5, 25);
    const q10 = pow(2, (tc - 10) / 10);
    let R = (S.maintWood * tr.wood * (1 + 0.25 * T.coldTol) + S.maintLeaf * tr.leaf) * q10;
    // Sapling bank: a young tree in deep shade idles, paying less upkeep the more shade-tolerant it is
    let sup = 0;
    if (MECHANISMS.saplingBank && (tr.stage === 'seedling' || tr.stage === 'juvenile') && phase > 0) {
      const lightFrac = (lr / Math.max((wx.light / (wx.light + half)) * (1 + half), 1e-9));
      sup = clamp(1 - lightFrac / 0.5, 0, 1);
      R *= 1 - TREE_LIFE.saplingBank.upkeepCut * T.shadeTol * sup;
    }
    // Nutrients needed if this production became growth: wood content on the surplus
    const nd = Math.max(0, P0 - R) * NUTRIENTS.woodContent * 2;
    const lrOpen = (wx.light / (wx.light + half)) * (1 + half);
    pot.set(tr.id, { P0, R, light, fw, ft, lr, lrOpen, shade, sup });
    for (const c of cr.cells) nDemand[c.i] += nd / cr.cells.length;
  }
  // Ground plants: potential growth
  const gPot = new Array(N);
  const ft_g = new Array(N);
  for (let i = 0; i < N; i++) {
    if (P.kind[i] === 'wall') { gPot[i] = null; continue; }
    const Lg = groundLight[i];
    const f = clamp((temp[i] - 3) / 9, 0, 1.3);
    ft_g[i] = f;
    const s = GROUND.stitch;
    const c = GROUND.clover;
    const lrS = (Lg / (Lg + s.lightHalf)) * (1 + s.lightHalf);
    const lrC = (Lg / (Lg + c.lightHalf)) * (1 + c.lightHalf);
    const B = GROUND.maxKg;
    const S = P.stitch[i];
    const C = P.clover[i];
    const season = doy >= 252 ? 0 : 1;
    const wr = waterRatio[i];
    let gS = s.r * S * lrS * f * wr * (1 - (S + c.compOnOther * C) / B) * season;
    let gC = c.r * C * lrC * f * wr * (1 - (C + s.compOnOther * S) / B) * season;
    // Colonisation from neighbours (short-range seed and runners)
    let nS = 0;
    let nC = 0;
    for (const j of N8[i]) { nS += P.stitch[j]; nC += P.clover[j]; }
    const free = clamp(1 - (S + C) / B, 0, 1);
    gS += s.spread * nS * free * lrS * f * season;
    gC += c.spread * nC * free * lrC * f * season;
    gPot[i] = { gS, gC };
    if (gS > 0) nDemand[i] += gS * NUTRIENTS.groundContent;
    if (gC > 0) nDemand[i] += gC * NUTRIENTS.groundContent * 0.3;
  }
  Object.assign(c, { nDemand, pot, isSeedlingCompeting, gPot, ft_g });
}

function stage4b(c) {
  const { world, step, t, doy, P, temp, living, phase, crown, nDemand, pot, gPot, ft_g } = c;
  // 4b. Nutrient supply ratio per patch, then actual growth.
  const nRatio = new Array(N).fill(1);
  for (let i = 0; i < N; i++) {
    const avail = P.nutr[i] * NUTRIENTS.availableShare;
    const supply = nDemand[i] > avail ? avail / nDemand[i] : 1;
    // Richer ground grows faster even when supply is not running out
    const conc = clamp(sat(P.nutr[i], NUTRIENTS.halfSat) / sat(NUTRIENTS.richRef, NUTRIENTS.halfSat), 0, 1);
    nRatio[i] = Math.min(supply, conc);
  }
  const flowersToday = [];
  for (const tr of living) {
    const S = TREES[tr.sp];
    const T = tr.traits;
    const cr = crown.get(tr.id);
    const p = pot.get(tr.id);
    let nr = 0;
    for (const c of cr.cells) nr += nRatio[c.i];
    nr /= cr.cells.length;
    const fn = 0.35 + 0.65 * nr; // stored nutrients buffer short shortages
    const prod = p.P0 * fn;
    let net = prod - p.R;
    // In their first year seedlings still hold the seed's stored food
    const reserveCap = S.reserveCap * tr.wood * (tr.stage === 'seedling' && step - tr.born < DAYS_PER_YEAR ? 3 : 1);

    // Leaves: flush in Thaw from reserves, fall in Fruitfall to litter
    const target = leafTargetFull(tr) * phase * (1 - TREE_LIFE.saplingBank.leafCut * p.sup);
    // Book-keeping for suppressed young trees: time waiting, carbon in and out, release
    if (MECHANISMS.saplingBank && (tr.stage === 'seedling' || tr.stage === 'juvenile')) {
      const sp_ = tr.sup || (tr.sup = { days: 0, P: 0, R: 0, flush: 0, released: null });
      if (p.sup > 0.2) { sp_.days += 1; sp_.P = q(sp_.P + p.P0 * (0.35 + 0.65 * nr)); sp_.R = q(sp_.R + p.R); }
      else if (sp_.days >= DAYS_PER_YEAR && sp_.released === null && p.lr / Math.max(p.lrOpen, 1e-9) > 0.8 && phase > 0.5) {
        sp_.released = step;
        if (world._observe) world._observe('released', { tree: tr, step });
      }
    }
    if (tr.leaf < target) {
      const want = Math.min(target - tr.leaf, Math.max(0.02 * target, (target - tr.leaf) * 0.12));
      const afford = Math.max(0, tr.reserve + Math.max(net, 0));
      const grow = Math.min(want, afford);
      tr.leaf += grow;
      tr.reserve -= grow;
      if (tr.sup && p.sup > 0.2) tr.sup.flush = q(tr.sup.flush + grow);
      takeNutrients(P, cr.cells, grow * NUTRIENTS.litterContent);
    } else if (tr.leaf > target) {
      const drop = target <= 0 ? tr.leaf : Math.min(tr.leaf - target, Math.max(0.03 * tr.leaf, (tr.leaf - target) * 0.15));
      tr.leaf -= drop;
      for (const c of cr.cells) P.litter[c.i] += (drop * 0.9) / cr.cells.length;
    }

    // Fruit development draws on production before anything else
    if (tr.repro && tr.repro.fruitlets > 0 && doy < S.fruitDropStart && tr.repro.devStart !== null && doy >= tr.repro.devStart) {
      const r = tr.repro;
      const daysLeft = Math.max(1, S.fruitDropStart - doy);
      const need = Math.max(0, r.fruitlets * S.fruitMass - r.fruitKg) / daysLeft;
      const fromNet = Math.max(0, Math.min(need, net));
      let paid = fromNet;
      net -= fromNet;
      if (paid < need) {
        const fromRes = Math.min(need - paid, Math.max(0, tr.reserve - 0.3 * reserveCap));
        tr.reserve -= fromRes;
        paid += fromRes;
      }
      r.fruitKg += paid;
      takeNutrients(P, cr.cells, paid * NUTRIENTS.woodContent);
      if (paid < need * 0.999) {
        const abort = r.fruitlets * 0.12 * (1 - paid / need);
        r.fruitlets -= abort;
        r.aborted += abort;
      }
    }

    tr.reserve += net;
    if (tr.reserve > reserveCap) {
      const surplus = tr.reserve - reserveCap;
      tr.reserve = reserveCap;
      const grow = surplus * 0.85 * nr + surplus * 0.85 * (1 - nr) * 0.2;
      tr.wood += grow;
      takeNutrients(P, cr.cells, grow * NUTRIENTS.woodContent);
    }
    let starving = false;
    if (tr.reserve < 0) {
      starving = true;
      // Running down: eat into leaves and condition
      tr.leaf = Math.max(0, tr.leaf + tr.reserve * 0.5);
      tr.reserve = 0;
    }
    const resFrac = clamp(tr.reserve / Math.max(reserveCap, 1e-6), 0, 1);
    tr.cond = clamp(tr.cond + 0.02 * (resFrac - tr.cond) - (starving ? 0.01 : 0), 0, 1);
    tr.starving = starving;
    // Diagnostics: what is holding this tree back today
    // Light is judged against open sky on the same day, so cloud and season are not called shade
    const limits = { light: clamp(p.lr / Math.max(p.lrOpen, 1e-9), 0, 1), water: p.fw, nutrients: fn, warmth: p.ft };
    tr.diag = {
      light: q(limits.light), water: q(limits.water), nutrients: q(limits.nutrients), warmth: q(limits.warmth),
      production: q(prod), upkeep: q(p.R), shadeAbove: q(p.shade),
    };

    // Winter cold on exposed, cold-sensitive trees
    const ti = idx(tr.x, tr.y);
    if (temp[ti] < -3 && phase === 0) {
      const harm = 0.003 * S.coldSens * (1 - 0.8 * T.coldTol) * P.exposure[ti] * clamp((-temp[ti] - 3) / 3, 0, 2);
      tr.reserve = Math.max(0, tr.reserve - harm * tr.wood);
      tr.cond = Math.max(0, tr.cond - harm * 2);
    }

    // Flowering: begins on the tree's own flowering day
    const fstart = S.floweringStart + Math.round(T.flowerShift);
    if (doy === fstart && tr.stage === 'adult' && tr.cond > 0.2) {
      const full = leafTargetFull(tr);
      const flowers = S.flowersPerLeafKg * full * (T.fruitInvest / 0.25) * clamp(tr.cond * 1.3, 0.2, 1);
      tr.repro = {
        year: t.year, flowers: q(flowers), toOpen: q(flowers), open: 0, pollinated: 0, selfed: 0,
        frosted: 0, donors: {}, fruitlets: 0, aborted: 0, fruitKg: 0, dropped: 0, seedsDropped: 0,
        windowEnd: fstart + S.floweringDays, devStart: null,
      };
    }
    if (tr.repro && tr.repro.year === t.year && doy < tr.repro.windowEnd && tr.repro.toOpen > 0) {
      const r = tr.repro;
      const opening = Math.min(r.toOpen, r.flowers / S.floweringDays);
      r.toOpen -= opening;
      r.open += opening;
    }
    if (tr.repro && tr.repro.open > 0.01) flowersToday.push(tr);
  }
  // Ground plants: apply growth
  for (let i = 0; i < N; i++) {
    const g = gPot[i];
    if (!g) continue;
    const nr = nRatio[i];
    const gS = g.gS > 0 ? g.gS * nr : g.gS;
    const gC = g.gC > 0 ? g.gC * (0.7 + 0.3 * nr) : g.gC;
    P.stitch[i] = Math.max(0, P.stitch[i] + gS);
    P.clover[i] = Math.max(0, P.clover[i] + gC);
    if (gS > 0) takeNutrients(P, [{ i }], gS * NUTRIENTS.groundContent);
    if (gC > 0) takeNutrients(P, [{ i }], gC * NUTRIENTS.groundContent * 0.3);
    if (gS < 0) P.litter[i] -= gS;
    if (gC < 0) P.litter[i] -= gC;
    // Clover fixes nitrogen from the air: an explicit input, logged
    const fix = GROUND.clover.fixPerKg * P.clover[i] * ft_g[i] * (doy < 252 ? 1 : 0);
    P.nutr[i] += fix;
    world.ledger.fixation += fix;
    // Turnover and winter dieback to litter
    const still = doy >= 252;
    const ls = P.stitch[i] * (still ? GROUND.stillDieback * GROUND.stitch.dieback : GROUND.turnover);
    const lc = P.clover[i] * (still ? GROUND.stillDieback * GROUND.clover.dieback : GROUND.turnover * 1.2);
    P.stitch[i] -= ls;
    P.clover[i] -= lc;
    P.litter[i] += ls + lc;
    // Keep a little ground vegetation alive everywhere it has ever been, roots persist
    if (P.stitch[i] < 0.001) P.stitch[i] = 0;
    if (P.clover[i] < 0.001) P.clover[i] = 0;
    // Atmospheric deposition, logged
    P.nutr[i] += NUTRIENTS.deposition;
    world.ledger.deposition += NUTRIENTS.deposition;
  }
  Object.assign(c, { nRatio, flowersToday });
}

function stage5(c) {
  const { world, step, t, doy, P, seed, tally, wx, temp, living, crown, flowersToday } = c;
  // 5. Flowers and pollination ---------------------------------------------------
  const flowerMap = new Array(N).fill(0);
  const treeFlowerCells = new Map();
  for (const tr of flowersToday) {
    const cells = crown.get(tr.id).cells;
    const per = tr.repro.open / cells.length;
    treeFlowerCells.set(tr.id, per);
    for (const c of cells) flowerMap[c.i] += per;
  }
  const cloverPhase = doy >= 50 && doy < 210 ? 1 : 0;
  for (let i = 0; i < N; i++) flowerMap[i] += P.clover[i] * GROUND.flowersPerKgClover * cloverPhase;
  const effVisits = new Array(N).fill(0);
  const visitsRaw = new Array(N).fill(0);
  const masonDemand = [];
  const A = ANIMALS;
  // Copper Mason: emergence
  if (doy === 0) {
    for (let i = 0; i < N; i++) { P.masonCells[i] += P.masonFed[i]; P.masonFed[i] = 0; }
  }
  if (doy < 140 && (world.weather.warmthSum >= A.mason.emergeDegreeDays || doy >= A.mason.lateEmergeDay)) {
    for (let i = 0; i < N; i++) {
      if (P.masonCells[i] > 0) {
        const e = P.masonCells[i] * 0.12;
        P.masonCells[i] -= e;
        P.masonAdults[i] += e;
      }
    }
  }
  if (doy >= 140) for (let i = 0; i < N; i++) { P.masonCells[i] = 0; }
  const masonActive = wx.temp >= A.mason.minTemp && wx.rain < 3;
  if (masonActive) {
    const H = hood(A.mason.rangePatches, A.mason.kernel, exp);
    for (let i = 0; i < N; i++) {
      const a = P.masonAdults[i];
      if (a <= 0.01) continue;
      let tw = 0;
      for (let k = H.start[i]; k < H.start[i + 1]; k++) tw += flowerMap[H.cell[k]] * H.wt[k];
      if (tw <= 0) continue;
      const V = a * A.mason.visitsPerDay;
      const share = [];
      for (let k = H.start[i]; k < H.start[i + 1]; k++) {
        const j = H.cell[k];
        const w = flowerMap[j] * H.wt[k];
        if (w <= 0) continue;
        const v = (V * w) / tw;
        visitsRaw[j] += v;
        effVisits[j] += v * A.mason.efficiency;
        share.push(j, v);
      }
      masonDemand.push([i, a, share]);
    }
  }
  // Dusk Moth: emergence, flight, pollination, eggs
  if (doy >= A.moth.emergeDay && doy < A.moth.flightEnd) {
    for (let i = 0; i < N; i++) {
      if (P.mothPupae[i] > 0 && temp[i] > A.moth.tempMin) {
        const e = P.mothPupae[i] * 0.05;
        P.mothPupae[i] -= e;
        P.mothAdults[i] += e;
      }
    }
  }
  const mothActive = wx.temp >= A.moth.tempMin && wx.temp <= A.moth.tempMax && wx.rain < 6;
  if (mothActive) {
    const H = hood(A.moth.rangePatches, A.moth.kernel, exp);
    const E = hood(2, 0, exp);
    for (let i = 0; i < N; i++) {
      const a = P.mothAdults[i];
      if (a <= 0.01) continue;
      let tw = 0;
      for (let k = H.start[i]; k < H.start[i + 1]; k++) tw += flowerMap[H.cell[k]] * H.wt[k];
      const V = a * A.moth.visitsPerDay;
      if (tw > 0) {
        for (let k = H.start[i]; k < H.start[i + 1]; k++) {
          const j = H.cell[k];
          const w = flowerMap[j] * H.wt[k];
          if (w <= 0) continue;
          const v = (V * w) / tw;
          visitsRaw[j] += v;
          effVisits[j] += v * A.moth.efficiency;
        }
      }
      // Eggs onto nearby ground vegetation, more when nectar is plentiful
      const fed = 0.5 + 0.5 * clamp(tw / (a * 40 + 1), 0, 1);
      const eggs = a * A.moth.femaleShare * (A.moth.eggsPerFemale / 25) * fed;
      if (eggs > 0) {
        let gw = 0;
        for (let k = E.start[i]; k < E.start[i + 1]; k++) { const j = E.cell[k]; gw += P.stitch[j] + 2 * P.clover[j]; }
        if (gw > 0) {
          for (let k = E.start[i]; k < E.start[i + 1]; k++) {
            const j = E.cell[k];
            P.mothLarvae[j] += (eggs * (P.stitch[j] + 2 * P.clover[j])) / gw;
          }
        }
      }
    }
  }
  // Mason food and brood provisioning
  const loadRatio = new Array(N).fill(1);
  for (let i = 0; i < N; i++) {
    if (visitsRaw[i] > 0) loadRatio[i] = Math.min(1, (flowerMap[i] * 1.2) / visitsRaw[i]);
  }
  for (const [i, a, share] of masonDemand) {
    let loads = 0;
    for (let k = 0; k < share.length; k += 2) loads += share[k + 1] * loadRatio[share[k]];
    const cells = (loads * A.mason.femaleShare) / A.mason.loadsPerCell;
    const room = Math.max(0, P.nestCap[i] - P.masonFed[i]);
    const add = Math.min(cells, room);
    P.masonFed[i] += add;
    tally.newBrood += add;
  }
  // Pollination of each flowering tree
  const pollRng = streamFor(seed, step, 'pollination');
  for (const tr of flowersToday) {
    const S = TREES[tr.sp];
    const r = tr.repro;
    const cells = crown.get(tr.id).cells;
    const per = treeFlowerCells.get(tr.id);
    let ev = 0;
    for (const c of cells) if (flowerMap[c.i] > 0) ev += (effVisits[c.i] * per) / flowerMap[c.i];
    const pollinated = r.open * (1 - exp(-ev / Math.max(r.open, 1e-9)));
    // Part of each visit's pollen comes from the same tree
    const selfShare = 0.4;
    const out = pollinated * (1 - selfShare);
    const selfP = pollinated * selfShare;
    // Donors: conspecific trees with open flowers, nearer ones more likely
    const donors = [];
    let dw = 0;
    for (const o of flowersToday) {
      if (o === tr || o.sp !== tr.sp) continue;
      const d = Math.sqrt((o.x - tr.x) ** 2 + (o.y - tr.y) ** 2);
      if (d > 14) continue;
      const w = o.repro.open * kernel(d, 4);
      donors.push([o.id, w]);
      dw += w;
    }
    let setOut = 0;
    if (dw > 0) {
      setOut = out;
      for (const [id, w] of donors) r.donors[id] = (r.donors[id] || 0) + (out * w) / dw;
    }
    const selfSet = (selfP + (dw > 0 ? 0 : out)) * S.selfCompat;
    r.donors.self = (r.donors.self || 0) + selfSet;
    r.pollinated += setOut + selfSet;
    r.fruitlets += setOut + selfSet;
    r.open -= pollinated;
    // Flowers fade after a few days; frost kills open flowers
    const fade = r.open * 0.25;
    r.open -= fade;
    if (S.selfCompat > 0.1) { // Lantern Pear sets a little fruit from fading flowers by itself
      const auto = fade * S.selfCompat * 0.3;
      r.donors.self += auto;
      r.fruitlets += auto;
      r.selfed += auto;
    }
    const ti = idx(tr.x, tr.y);
    if (temp[ti] < -1) {
      const lost = r.open * S.frostSens * (1 - 0.7 * tr.traits.coldTol) * clamp((-temp[ti] - 1) / 3, 0.3, 1);
      r.open -= lost;
      r.frosted += lost;
      tally.flowersFrosted += lost;
    }
    void pollRng;
  }
  // Close flowering windows, start fruit development
  for (const tr of living) {
    const r = tr.repro;
    if (!r || r.year !== t.year) continue;
    if (doy === r.windowEnd) {
      r.open = 0;
      r.toOpen = 0;
      r.devStart = doy;
    }
  }
  Object.assign(c, { flowerMap, treeFlowerCells, cloverPhase, effVisits, visitsRaw, masonDemand, A, masonActive, mothActive, loadRatio, pollRng });
}

function stage6(c) {
  const { world, step, t, doy, P, seed, tally, living, crown } = c;
  // 6. Fruit fall ----------------------------------------------------------------
  const fruitRng = streamFor(seed, step, 'fruit');
  for (const tr of living) {
    const r = tr.repro;
    if (!r || r.year !== t.year || r.fruitlets < 0.5) continue;
    const S = TREES[tr.sp];
    const end = S.fruitDropStart + S.fruitDropDays;
    if (doy < S.fruitDropStart || doy >= end) continue;
    const remaining = end - doy;
    const nFruit = fruitRng.round(r.fruitlets / remaining);
    if (nFruit <= 0) continue;
    const fill = clamp(r.fruitKg / Math.max(r.fruitlets * S.fruitMass, 1e-9), 0, 1);
    const kg = Math.min(r.fruitKg, nFruit * S.fruitMass * fill);
    r.fruitKg -= kg;
    r.fruitlets = Math.max(0, r.fruitlets - nFruit);
    r.dropped += nFruit;
    tally.fruitDropped += nFruit;
    // Underfilled fruit carries fewer viable seeds
    const seeds = nFruit * (S.seedsPerFruit / tr.traits.seedSize) * clamp(fill * 1.2 - 0.2, 0, 1);
    r.seedsDropped += seeds;
    if (world._observe) world._observe('seedsDropped', { sp: tr.sp, n: seeds, mother: tr.id, step });
    const cells = crown.get(tr.id).cells;
    const c = cells[fruitRng.int(cells.length)];
    P.fruit[c.i] += kg;
    if (seeds >= 0.05) {
      // Seeds carry the tree's pollen record: each father's share of this year's pollination
      let tot = 0;
      for (const k of Object.keys(r.donors)) tot += r.donors[k];
      const fathers = {};
      for (const k of Object.keys(r.donors).sort()) if (r.donors[k] > 0) fathers[k === 'self' ? tr.id : k] = q((seeds * r.donors[k]) / Math.max(tot, 1e-9));
      addSeeds(world, step, { sp: tr.sp, i: c.i, n: seeds, mother: tr.id, fathers, disp: 'fell', buried: false, gen: tr.gen + 1 });
    }
  }
  Object.assign(c, { fruitRng });
}

function stage7(c) {
  const { world, step, doy, P, tally, temp, living, laiTotal, ft_g, A } = c;
  // 7. Animals --------------------------------------------------------------------
  const seedIndex = indexSeeds(world);
  const cover = new Array(N);
  for (let i = 0; i < N; i++) cover[i] = P.kind[i] === 'wall' ? 0 : shelterCover(P, i, laiTotal[i]);
  stepMice(world, step, doy, P, cover, seedIndex, tally);
  stepSnails(world, doy, P, temp, tally);
  stepMothLarvae(doy, P, temp, tally);
  stepWrens(doy, P, laiTotal, temp);
  // Other invertebrates: produced from living plants and litter, eaten by wrens
  for (let i = 0; i < N; i++) {
    if (P.kind[i] === 'wall') continue;
    const prodI = A.insects.produce * ((groundCoverFrac(P, i) + clamp(laiTotal[i] / 4, 0, 1)) * ft_g[i]
      + clamp(P.litter[i] / 10, 0, 1) * Math.max(ft_g[i], A.insects.coldFloor) + 0.6 * clamp((P.woodHard[i] + P.woodSoft[i]) / 60, 0, 1) * A.insects.coldFloor);
    P.insects[i] = Math.max(0, P.insects[i] * (1 - A.insects.decay) + prodI);
  }
  // Fallen fruit rots into litter
  for (let i = 0; i < N; i++) {
    if (P.fruit[i] > 0) {
      const rot = P.fruit[i] * (0.02 + 0.02 * clamp(temp[i] / 15, 0, 1));
      P.fruit[i] -= rot;
      P.litter[i] += rot;
      if (P.fruit[i] < 1e-4) { P.litter[i] += P.fruit[i]; P.fruit[i] = 0; }
    }
  }
  Object.assign(c, { seedIndex, cover });
}

function stage8(c) {
  const { world, P, temp } = c;
  // 8. Decomposition ----------------------------------------------------------------
  const fungusNext = P.fungus.slice();
  for (let i = 0; i < N; i++) {
    if (P.kind[i] === 'wall') continue;
    const rel = P.moist[i] / P.cap[i];
    const mf = clamp(1 - Math.abs(rel - 0.65) / 0.55, 0.08, 1);
    const tf = clamp((temp[i] + 2) / 16, 0, 1.2);
    const mt = mf * tf;
    const F = P.fungus[i];
    const fs = F / (F + 0.4);
    const d1 = P.litter[i] * (DECAY.litterBase + DECAY.litterFungus * fs) * mt;
    const hs = P.woodHard[i] * (DECAY.hardBase + DECAY.hardToSoft * fs) * mt;
    const d2 = P.woodSoft[i] * (DECAY.softBase + DECAY.softDecay * fs) * mt;
    P.litter[i] -= d1;
    P.woodHard[i] -= hs;
    P.woodSoft[i] += hs - d2;
    const ret = d1 * NUTRIENTS.litterContent + d2 * NUTRIENTS.woodContent;
    P.nutr[i] += ret;
    world.ledger.decayReturn += ret;
    const sub = P.litter[i] * 0.4 + P.woodHard[i] * 0.6 + P.woodSoft[i];
    const subSat = sat(sub, DECAY.fungusSubstrateHalf);
    fungusNext[i] += DECAY.fungusGrow * F * subSat * mt * (1 - F / 2) - DECAY.fungusDie * F * (1.3 - subSat);
    if (F > 0.05) {
      for (const j of N8[i]) {
        if (P.kind[j] === 'wall') continue;
        const sj = P.litter[j] * 0.4 + P.woodHard[j] * 0.6 + P.woodSoft[j];
        fungusNext[j] += DECAY.fungusSpread * F * sat(sj, DECAY.fungusSubstrateHalf) * mt / 8;
      }
    }
  }
  for (let i = 0; i < N; i++) P.fungus[i] = clamp(fungusNext[i], 0, 2);
  Object.assign(c, { fungusNext });
}

function stage9(c) {
  const { world, step, t, P, events, tally, temp, groundLight, seedIndex } = c;
  // 9. Seed bank --------------------------------------------------------------------
  stepSeeds(world, step, t, P, temp, groundLight, seedIndex, tally, events);
}

function stage10(c) {
  const { world, step, t, doy, P, events, tally, wx, temp, crown, A } = c;
  // 10. Tree deaths, storms, stages -------------------------------------------------
  stepTreeLife(world, step, t, P, temp, wx, crown, tally, events);

  // Animal deaths and survival through the year (bees and moths)
  for (let i = 0; i < N; i++) {
    if (P.masonAdults[i] > 0) {
      P.masonAdults[i] *= doy >= 168 ? 0 : 1 - A.mason.adultHazard;
    }
    if (P.masonFed[i] > 0 && doy >= 168) P.masonFed[i] *= 1 - VDAY(1 - A.mason.overwinterSurvival) * (DAYS_PER_YEAR / 168);
    if (P.mothAdults[i] > 0) P.mothAdults[i] *= doy >= A.moth.flightEnd ? 0 : 1 - A.moth.adultHazard;
    if (P.mothPupae[i] > 0) {
      const shelter = clamp(P.litter[i] / 5, 0, 1);
      P.mothPupae[i] *= 1 - A.moth.pupaWinterHazard * (1 - 0.8 * shelter);
    }
    if (doy === A.moth.pupateDay) { P.mothPupae[i] += P.mothLarvae[i]; P.mothLarvae[i] = 0; }
  }
}

function capital(type) {
  const labels = { lateFrost: 'The late frost', drySpell: 'The dry spell', longRain: 'The long rain', warmSpell: 'The warm spell', windstorm: 'The windstorm' };
  return labels[type] || type;
}

function takeNutrients(P, cells, amount) {
  if (amount <= 0) return;
  const per = amount / cells.length;
  for (const c of cells) P.nutr[c.i] = Math.max(0, P.nutr[c.i] - per);
}

// --- Seeds ------------------------------------------------------------------------

function seedKey(c, year) {
  return `${c.i}|${c.sp}|${c.mother}|${c.disp}|${c.buried ? 1 : 0}|${year}|${c.origin}|${c.forgotten ? 1 : 0}`;
}

// Add seeds to the bank, merging with an existing cohort that shares place,
// mother, route, year and origin. Fathers are kept as a record of shares.
export function addSeeds(world, step, s) {
  const year = Math.floor(step / DAYS_PER_YEAR);
  const origin = s.origin || 'orchard';
  const probe = { i: s.i, sp: s.sp, mother: s.mother, disp: s.disp, buried: !!s.buried, origin, forgotten: !!s.forgotten };
  if (!world._seedKeys || world._seedKeysStep !== step) {
    world._seedKeys = new Map();
    world._seedKeysStep = step;
    for (const c of world.seeds) if (c.chill === 0 && Math.floor(c.born / DAYS_PER_YEAR) === year) world._seedKeys.set(seedKey(c, year), c);
  }
  const key = seedKey(probe, year);
  const fathers = s.fathers || null;
  const hit = world._seedKeys.get(key);
  if (hit && hit.chill === 0 && hit.n > 0) {
    hit.n += s.n;
    if (fathers) {
      hit.fathers = hit.fathers || {};
      for (const k of Object.keys(fathers)) hit.fathers[k] = q((hit.fathers[k] || 0) + fathers[k]);
      hit.fathers = trimFathers(hit.fathers);
    }
    return hit;
  }
  const c = {
    id: `S${++world.counters.seed}`, sp: s.sp, i: s.i, n: s.n, born: step,
    mother: s.mother, fathers: trimFathers(fathers), origin, disp: s.disp,
    chill: 0, ready: 0, gen: s.gen, buried: !!s.buried,
  };
  if (s.traits) c.traits = s.traits;
  if (s.from) c.from = s.from;
  if (s.forgotten) c.forgotten = true;
  world.seeds.push(c);
  world._seedKeys.set(key, c);
  return c;
}

// Keep a fathers record small: the four largest shares, the rest pooled as 'other'.
function trimFathers(f) {
  if (!f) return f;
  const keys = Object.keys(f);
  if (keys.length <= 5) return f;
  const sorted = keys.filter((k) => k !== 'other').sort((a, b) => f[b] - f[a] || (a < b ? -1 : 1));
  const out = {};
  let other = f.other || 0;
  sorted.forEach((k, n) => { if (n < 4) out[k] = f[k]; else other += f[k]; });
  out.other = q(other);
  return out;
}

// Scale a fathers record to follow seeds moved or lost.
function scaleFathers(fathers, share) {
  if (!fathers) return null;
  const out = {};
  for (const k of Object.keys(fathers)) out[k] = q(fathers[k] * share);
  return out;
}

function indexSeeds(world) {
  const idxs = new Map();
  for (const c of world.seeds) {
    let l = idxs.get(c.i);
    if (!l) { l = []; idxs.set(c.i, l); }
    l.push(c);
  }
  return idxs;
}

function pickFather(cohort, rng) {
  if (!cohort.fathers) return null;
  const keys = Object.keys(cohort.fathers).sort();
  const k = rng.weighted(keys.map((x) => cohort.fathers[x]));
  return k < 0 || keys[k] === 'other' ? null : keys[k];
}

function inheritTraits(world, cohort, fatherId, rng) {
  const byId = world._byId;
  const mom = cohort.mother ? byId.get(cohort.mother) : null;
  const dad = fatherId ? byId.get(fatherId) : null;
  const base = cohort.traits || null;
  const out = {};
  for (const [k, spec] of Object.entries(TRAITS)) {
    let m;
    let sd = spec.sd;
    if (mom && dad && mom !== dad) m = (mom.traits[k] + dad.traits[k]) / 2;
    else if (mom && dad === mom) { m = mom.traits[k]; sd *= 0.8; } // selfed: less new variation
    else if (mom) { m = (mom.traits[k] + TREES[cohort.sp].traitMeans[k]) / 2; sd *= 1.2; } // father not recorded
    else if (base) m = base[k];
    else m = TREES[cohort.sp].traitMeans[k];
    out[k] = q(clamp(rng.normal(m, sd), spec.min, spec.max));
  }
  return out;
}

function germinationSubstrate(P, i, buried) {
  if (P.kind[i] === 'wall') return 0;
  const sc = clamp(P.stitch[i] / GROUND.maxKg, 0, 1);
  const cc = clamp(P.clover[i] / GROUND.maxKg, 0, 1);
  let s = (1 - 0.75 * sc) * (1 - 0.3 * cc) * (1 - 0.45 * clamp(P.litter[i] / 10, 0, 1)) * (1 - 0.6 * clamp(P.woodHard[i] / 80, 0, 1));
  s += 0.55 * clamp(P.woodSoft[i] / 40, 0, 1); // softened wood is a nursery
  if (buried) s += 0.15;
  if (P.kind[i] === 'glass') s *= 0.6; // cracked floor, little soil
  return clamp(s, 0, 1);
}

function stepSeeds(world, step, t, P, temp, groundLight, seedIndex, tally, events) {
  const doy = t.dayOfYear;
  const rng = streamFor(world.meta.seed, step, 'seeds');
  world._byId = world._byId && world._byIdStep === step ? world._byId : new Map(world.trees.map((tr) => [tr.id, tr]));
  world._byIdStep = step;
  const seedlingsAt = new Map();
  for (const tr of world.trees) {
    if (tr.stage !== 'seedling') continue;
    const i = idx(tr.x, tr.y);
    seedlingsAt.set(i, (seedlingsAt.get(i) || 0) + 1);
  }
  const lateGermByCohort = new Map();
  for (const c of world.seeds) {
    const S = TREES[c.sp];
    const i = c.i;
    // Winter chilling
    if (temp[i] < 5 && (doy >= 200 || doy < 20)) c.chill = Math.min(c.chill + 1, 400);
    // A share of chilled seeds wakes each spring; the rest stay dormant another year
    if (doy === 20) {
      if (c.chill >= S.chillDays) c.ready = c.n * S.readyShare;
      c.chill = 0;
    }
    // Losses: rot, decay, age. Seeds on the surface go faster than buried ones.
    const v = VDAY(S.seedLossPerYear) * (c.buried ? 1 : 2.2);
    if (world._observe) world._observe('seedDecay', { sp: c.sp, n: c.n * v, origin: c.origin, step });
    c.n *= 1 - v;
    c.ready *= 1 - v;
    // Germination in Thaw and the first days of Blossom
    if (c.ready > 0 && doy >= 21 && doy < 100) {
      const rel = P.moist[i] / P.cap[i];
      const gm = clamp((rel - 0.3) / 0.3, 0, 1);
      const gt = clamp((temp[i] - 4) / 6, 0, 1);
      const L = groundLight[i];
      const gl = L / (L + S.germLightNeed) * (1 + S.germLightNeed);
      const sub = germinationSubstrate(P, i, c.buried);
      let selfShare = 0;
      if (c.fathers && c.mother) {
        let tot = 0;
        for (const k of Object.keys(c.fathers)) tot += c.fathers[k];
        selfShare = tot > 0 ? (c.fathers[c.mother] || 0) / tot : 0;
      }
      const g = S.germRate * sub * clamp(gl, 0, 1) * gm * gt * (1 - 0.5 * selfShare);
      const k = rng.round(c.ready * g);
      if (k > 0) {
        const n = Math.min(k, Math.floor(c.n));
        for (let j = 0; j < n; j++) {
          c.n -= 1;
          c.ready = Math.max(0, c.ready - 1);
          tally.germinated += 1;
          const here = seedlingsAt.get(i) || 0;
          if (here >= TREE_LIFE.maxSeedlingsPerPatch || P.kind[i] === 'wall') {
            tally.germDied += 1; // germinated, then crowded out within days
            if (world._observe) world._observe('crowded', { cohort: c, step });
            continue;
          }
          seedlingsAt.set(i, here + 1);
          const father = pickFather(c, rng);
          const traits = inheritTraits(world, c, father, rng);
          const m = S.seedlingMass * traits.seedSize;
          const tr = newTree(world, {
            sp: c.sp, x: i % W, y: Math.floor(i / W), born: step, wood: m, leaf: m * 0.15,
            reserve: m * 0.6, cond: 0.7, traits, mother: c.mother, father,
            origin: c.origin === 'keeper' ? 'keeper' : 'seed', gen: c.gen, stage: 'seedling',
          });
          tr.cohort = c.id;
          world._byId.set(tr.id, tr);
          if (world._observe) world._observe('germinated', { tree: tr, cohort: c, step });
          if (!world.records.firstBirth) {
            world.records.firstBirth = tr.id;
            events.push({ type: 'first', at: i, refs: [tr.id, c.id], text: `First seedling born after the founding: ${speciesName(c.sp)} ${tr.id} at ${where(i)}, from seed cohort ${c.id}.` });
          }
          const winters = Math.floor((step - c.born) / DAYS_PER_YEAR);
          if (winters >= 2 && c.lastGermYear !== t.year) {
            const mom = c.mother ? world._byId.get(c.mother) : null;
            const goneParent = mom && !LIVING.has(mom.stage);
            const entry = lateGermByCohort.get(c.id) || { c, n: 0, winters, goneParent, mom };
            entry.n += 1;
            lateGermByCohort.set(c.id, entry);
          }
        }
      }
    }
    if (doy === 100) c.ready = 0;
  }
  for (const { c, winters, goneParent, mom } of lateGermByCohort.values()) {
    c.lastGermYear = t.year;
    const parent = mom ? `${mom.name || mom.id}${goneParent ? ', which is no longer living,' : ''}` : (c.origin === 'founding' ? 'founding stock' : 'unknown parents');
    events.push({
      type: 'dormancy', at: c.i, refs: [c.id].concat(mom ? [mom.id] : []),
      text: `${speciesName(c.sp)} seeds from ${parent} began germinating at ${where(c.i)} after ${winters} winters underground (cohort ${c.id}).`,
    });
  }
  // Drop exhausted cohorts; note the end of founding cohorts
  const keep = [];
  for (const c of world.seeds) {
    // Surface seeds are covered by litter and soil within a season
    if (!c.buried && step - c.born > 60) c.buried = true;
    if (c.n >= 0.05) { keep.push(c); continue; }
    if (c.origin === 'founding') events.push({ type: 'cohort', at: c.i, refs: [c.id], text: `Founding seed cohort ${c.id} (${speciesName(c.sp)}, ${where(c.i)}) has no viable seeds left.` });
  }
  world.seeds = keep;
  // Yearly tidy: merge cohorts that have become indistinguishable
  if (doy % 84 === 1) mergeCohorts(world);
}

function mergeCohorts(world) {
  // Fractions of a seed left in a patch are pooled into that patch's largest
  // cohort of the same species (their exact parentage is given up).
  // Founding stock is never pooled with seed made in the orchard, so its story stays its own.
  const cls = (c) => `${(c.origin || '').startsWith('founding') ? 'founding' : 'orchard'}${c.forgotten ? '-forgotten' : ''}`;
  const largest = new Map();
  for (const c of world.seeds) {
    const key = `${c.i}|${c.sp}|${cls(c)}`;
    const l = largest.get(key);
    if (!l || c.n > l.n) largest.set(key, c);
  }
  const pooled = [];
  for (const c of world.seeds) {
    const l = largest.get(`${c.i}|${c.sp}|${cls(c)}`);
    if (c !== l && c.n < 2 && c.origin !== 'founding') {
      l.n += c.n;
      l.ready += c.ready;
      l.pooled = (l.pooled || 0) + c.n;
    } else pooled.push(c);
  }
  world.seeds = pooled;
  const map = new Map();
  const out = [];
  for (const c of world.seeds) {
    const key = [c.i, c.sp, c.mother, c.disp, c.buried, Math.floor(c.born / DAYS_PER_YEAR), c.origin, !!c.forgotten].join('|');
    const hit = map.get(key);
    if (hit && c.origin !== 'founding') {
      hit.n += c.n;
      hit.ready += c.ready;
      if (c.fathers) {
        hit.fathers = hit.fathers || {};
        for (const k of Object.keys(c.fathers)) hit.fathers[k] = q((hit.fathers[k] || 0) + c.fathers[k]);
        hit.fathers = trimFathers(hit.fathers);
      }
    } else {
      map.set(key, c);
      out.push(c);
    }
  }
  world.seeds = out;
}

// --- Mice -------------------------------------------------------------------------

function stepMice(world, step, doy, P, cover, seedIndex, tally) {
  const M = ANIMALS.mouse;
  const rng = streamFor(world.meta.seed, step, 'mice');
  const seedSeason = doy >= 168 && doy < 290;
  const cacheSeason = doy >= 252 || doy < 100;
  const fedArr = new Array(N).fill(1);
  for (let i = 0; i < N; i++) {
    const m = P.mouse[i];
    if (m <= 0.0005) continue;
    const need = m * M.needFood;
    let food = 0;
    // Fallen fruit first
    if (P.fruit[i] > 0) {
      const e = Math.min(P.fruit[i], need * 1.2);
      P.fruit[i] -= e;
      food += e;
    }
    const here = seedIndex.get(i) || [];
    // Seed handling: in Fruitfall and early Still mice gather surface seeds and cache many
    let handle = m * (seedSeason ? M.seedsHandledPerDay : 4);
    for (const c of here) {
      if (handle <= 0) break;
      if (c.buried || c.n <= 0) continue;
      const take = Math.min(c.n, handle * 0.5);
      if (take <= 0) continue;
      handle -= take;
      c.n -= take;
      c.ready = Math.min(c.ready, c.n);
      const cached = seedSeason ? take * M.cacheShare : 0;
      const eaten = take - cached;
      food += eaten * TREES[c.sp].seedFood;
      tally.seedsEaten += eaten;
      if (world._observe) world._observe('seedEaten', { sp: c.sp, n: eaten, origin: c.origin, step });
      if (cached > 0) {
        // Carry to a covered spot nearby; bare ground is avoided
        const area = disc(i % W, Math.floor(i / W), M.cacheRadius);
        const ws = area.map((a) => (cover[a.i] < 0.2 ? 0.02 : cover[a.i] * cover[a.i]) * kernel(a.d, 2) * (P.kind[a.i] === 'wall' ? 0 : 1));
        const k = rng.weighted(ws);
        if (k >= 0) {
          // With forgottenCaches on, each cache's fate is set once, when it is made
          const forgotten = MECHANISMS.forgottenCaches && rng.chance(M.forgetShare);
          addSeeds(world, step, {
            sp: c.sp, i: area[k].i, n: cached, mother: c.mother, fathers: scaleFathers(c.fathers, cached / Math.max(c.n + take, 1e-9)),
            disp: 'cached', buried: true, gen: c.gen, origin: c.origin === 'founding' ? 'founding-moved' : c.origin,
            traits: c.traits, from: c.id, forgotten,
          });
          tally.seedsCached += cached;
        }
      }
    }
    // Retrieving caches in lean months, here and in neighbouring patches
    if (cacheSeason && food < need) {
      let want = (need - food) / 0.0012;
      want = Math.min(want, m * M.retrieveSeedsPerDay);
      const reach = here.slice();
      for (const j of N8[i]) { const l = seedIndex.get(j); if (l) for (const c of l) reach.push(c); }
      for (const c of reach) {
        if (want <= 0) break;
        if (!c.buried || c.n <= 0 || c.forgotten) continue;
        // Mice find their own caches more easily than seeds deep in the soil,
        // but only a share of a cache can be found on any day; the rest is forgotten for now
        const take = Math.min(c.n * (c.disp === 'cached' ? ANIMALS.mouse.cacheFindShare : ANIMALS.mouse.soilFindShare), want);
        c.n -= take;
        c.ready = Math.min(c.ready, c.n);
        want -= take;
        food += take * TREES[c.sp].seedFood;
        tally.seedsEaten += take;
        if (world._observe) world._observe('seedEaten', { sp: c.sp, n: take, origin: c.origin, step });
      }
    }
    // Clover leaves when still hungry
    if (food < need && P.clover[i] > 0) {
      const e = Math.min(P.clover[i] * 0.02, (need - food) / M.cloverFood);
      P.clover[i] -= e;
      food += e * M.cloverFood;
    }
    // Other invertebrates, a small part of the diet
    if (food < need && P.insects[i] > 0) {
      const e = Math.min(P.insects[i] * 0.05, (need - food) / 0.002);
      P.insects[i] -= e;
      food += e * 0.002;
    }
    const fed = clamp(food / need, 0, 1);
    fedArr[i] = fed;
    const cap = M.capacityPerCover * cover[i] + 0.01;
    const breeding = doy >= 84 && doy < 260;
    const births = breeding ? m * M.birth * clamp((fed - 0.55) * 2.2, 0, 1) * clamp(1 - m / cap, 0, 1) : 0;
    const winter = doy >= 252 ? 0.002 : 0;
    const deaths = m * (M.hazard + winter + M.starveHazard * (1 - fed) + (m > cap ? M.crowdHazard * (m / cap - 1) : 0));
    P.mouse[i] = Math.max(0, m + births - Math.min(deaths, m));
  }
  diffuse(P.mouse, M.moveShare, (j) => (P.kind[j] === 'wall' ? 0 : 0.05 + cover[j] * (0.5 + 0.5 * clamp(P.fruit[j], 0, 1))), 0.25, cover);
  void fedArr;
}

// --- Snails ---------------------------------------------------------------------

function stepSnails(world, doy, P, temp, tally) {
  const Sn = ANIMALS.snail;
  const shelterOf = (i) => clamp(P.litter[i] / 6 + (P.woodHard[i] + P.woodSoft[i]) / 40, 0, 1);
  for (let i = 0; i < N; i++) {
    const s = P.snail[i];
    if (s <= 0.0005) continue;
    const rel = P.moist[i] / P.cap[i];
    const sh = shelterOf(i);
    const active = rel > 0.45 && temp[i] > 4 && doy < 252;
    let fed = 0.4;
    if (active) {
      const need = s * Sn.eatKg;
      const cl = P.clover[i];
      const st = P.stitch[i];
      const wsum = 3 * cl + st;
      let got = 0;
      if (wsum > 0) {
        const eC = Math.min(cl * 0.03, (need * 3 * cl) / wsum);
        const eS = Math.min(st * 0.03, (need * st) / wsum);
        P.clover[i] -= eC;
        P.stitch[i] -= eS;
        got += eC + eS;
      }
      // Litter: snails help decomposition
      const eL = Math.min(P.litter[i] * 0.02, s * Sn.litterKg);
      P.litter[i] -= eL;
      const ret = eL * NUTRIENTS.litterContent * 0.6;
      P.nutr[i] += ret;
      world.ledger.decayReturn += ret;
      fed = clamp((got + eL * 0.5) / Math.max(need, 1e-9), 0, 1);
    }
    const damp = clamp((rel - 0.45) / 0.45, 0, 1);
    const cap = Sn.capacity * damp * (0.3 + 0.7 * sh) + 0.01;
    const births = active && doy < 168 ? s * Sn.birth * fed * clamp(1 - s / cap, 0, 1) : 0;
    const dry = rel < 0.35 ? (0.35 - rel) / 0.35 : 0;
    const cold = temp[i] < 0 ? 0.004 * (1 - 0.8 * sh) : 0;
    const deaths = s * (Sn.hazard + Sn.dryHazard * dry * (1 - 0.7 * sh) + cold + (s > cap ? 0.01 * (s / cap - 1) : 0));
    P.snail[i] = Math.max(0, s + births - Math.min(deaths, s));
  }
  diffuse(P.snail, Sn.moveShare, (j) => (P.kind[j] === 'wall' ? 0 : 0.1 + (P.moist[j] / P.cap[j]) * (0.3 + shelterOf(j))), 0, null);
  void tally;
}

// --- Moth larvae -----------------------------------------------------------------

function stepMothLarvae(doy, P, temp, tally) {
  const Mo = ANIMALS.moth;
  for (let i = 0; i < N; i++) {
    const l = P.mothLarvae[i];
    if (l <= 0.0005) continue;
    const need = l * Mo.larvalEatKg * clamp((temp[i] - 2) / 10, 0.1, 1);
    const cl = P.clover[i];
    const st = P.stitch[i];
    const wsum = 2 * cl + st;
    let got = 0;
    if (wsum > 0) {
      const eC = Math.min(cl * 0.04, (need * 2 * cl) / wsum);
      const eS = Math.min(st * 0.04, (need * st) / wsum);
      P.clover[i] -= eC;
      P.stitch[i] -= eS;
      got = eC + eS;
    }
    const fed = need > 0 ? clamp(got / need, 0, 1) : 1;
    P.mothLarvae[i] = l * (1 - Mo.larvalHazard - Mo.larvalStarveHazard * (1 - fed));
  }
  void doy; void tally;
}

// --- Wrens -----------------------------------------------------------------------

function stepWrens(doy, P, laiTotal, temp) {
  const Wr = ANIMALS.wren;
  const woody = (i) => clamp(laiTotal[i] / 2, 0, 1) + 0.6 * clamp((P.woodHard[i] + P.woodSoft[i]) / 60, 0, 1);
  for (let i = 0; i < N; i++) {
    const w = P.wren[i];
    if (w <= 0.0002) continue;
    const need = w * Wr.needFood;
    // Forage over this patch and its neighbours
    const area = N9[i];
    let avail = 0;
    for (const j of area) avail += P.insects[j] * 0.3 + P.mothLarvae[j] * Wr.larvaFood * 0.3;
    const share = avail > 0 ? Math.min(1, need / avail) : 0;
    let got = 0;
    for (const j of area) {
      const ei = P.insects[j] * 0.3 * share;
      const el = P.mothLarvae[j] * 0.3 * share;
      P.insects[j] -= ei;
      P.mothLarvae[j] -= el;
      got += ei + el * Wr.larvaFood;
    }
    const fed = clamp(got / need, 0, 1);
    let cap = 0;
    for (const j of area) cap += woody(j);
    cap = (Wr.capacityPerWoody * cap) / area.length + 0.001;
    const breeding = doy >= 90 && doy < 200;
    const births = breeding ? w * Wr.birth * clamp((fed - 0.6) * 2.5, 0, 1) * clamp(1 - w / cap, 0, 1) : 0;
    const cold = temp[i] < -2 ? 0.004 : 0;
    const deaths = w * (Wr.hazard + Wr.starveHazard * (1 - fed) + cold + (w > cap ? 0.01 * (w / cap - 1) : 0));
    P.wren[i] = Math.max(0, w + births - Math.min(deaths, w));
  }
  diffuse(P.wren, Wr.moveShare, (j) => 0.05 + woody(j) + clamp(P.insects[j] / 20, 0, 1), 0, null);
}

// Move a share of a population to neighbouring patches, weighted by attraction.
// Movement into low-cover patches is resisted (avoidBare) for animals that shun open ground.
function diffuse(arr, share, attract, avoidBare, cover) {
  const N_ = arr.length;
  const att = new Float64Array(N_);
  for (let j = 0; j < N_; j++) {
    let w = attract(j);
    if (avoidBare > 0 && cover && cover[j] < avoidBare) w *= 0.15;
    att[j] = w;
  }
  const next = Float64Array.from(arr);
  for (let i = 0; i < N_; i++) {
    const v = arr[i];
    if (v <= 0) continue;
    const nb = N8[i];
    let tw = 0;
    for (let k = 0; k < nb.length; k++) tw += att[nb[k]];
    if (tw <= 0) continue;
    const move = (v * share * clamp(tw / (8 * Math.max(attract(i), 0.05)), 0, 1.5)) / 1.5;
    next[i] -= move;
    for (let k = 0; k < nb.length; k++) next[nb[k]] += (move * att[nb[k]]) / tw;
  }
  for (let i = 0; i < N_; i++) arr[i] = next[i] > 0 ? next[i] : 0;
}

// --- Tree life -------------------------------------------------------------------

function stepTreeLife(world, step, t, P, temp, wx, crown, tally, events) {
  const rng = streamFor(world.meta.seed, step, 'trees');
  const storm = wx.wind >= 0.75;
  const removed = new Set();
  for (const tr of world.trees) {
    const S = TREES[tr.sp];
    const T = tr.traits;
    const i = idx(tr.x, tr.y);
    const age = ageYears(tr, step);
    if (tr.stage === 'fallen') continue;
    if (tr.stage === 'snag') {
      let pf = TREE_LIFE.snagFallPerDay;
      if (storm) pf += 0.05 * P.exposure[i];
      if (rng.chance(pf)) fellTree(world, step, tr, P, rng, events, 'fell', wx);
      continue;
    }
    // Weakness creeps in with age
    if (age > S.lifespanYears * 0.5) tr.weak = Math.min(1, tr.weak + TREE_LIFE.weaknessGrowth * (1 + 2 * (1 - tr.cond)));
    // Hazards
    let hz;
    let cause = 'decline';
    let parts = null;
    if (tr.stage === 'seedling') {
      const vul = 1 / (1 + tr.wood / 0.15); // bigger seedlings are much less vulnerable
      const sn = P.snail[i];
      const snailActive = P.moist[i] / P.cap[i] > 0.45 && temp[i] > 4 && t.dayOfYear < 252;
      const hSn = snailActive ? TREE_LIFE.snailSeedlingHazard * sn * vul * (P.protectUntil[i] > step ? 0 : 1) : 0;
      const hFr = temp[i] < -2 && tr.leaf > 0 ? TREE_LIFE.frostSeedlingHazard * S.frostSens * (1 - 0.7 * T.coldTol) * vul * (0.4 + P.exposure[i]) : 0;
      const hDr = tr.diag && tr.diag.water < 0.3 ? TREE_LIFE.droughtSeedlingHazard * (1 - 0.6 * T.droughtTol) * (1 - tr.diag.water / 0.3) : 0;
      const hSt = tr.starving ? 0.012 : 0;
      const hSup = MECHANISMS.saplingBank && tr.sup && tr.diag ? TREE_LIFE.saplingBank.hazard * clamp(1 - tr.diag.light / 0.5, 0, 1) : 0;
      hz = TREE_LIFE.seedlingHazard + hSn + hFr + hDr + hSt + hSup;
      // One draw for the day. If the seedling dies, the cause is chosen in
      // proportion to each pressure, so the record says what actually killed it.
      parts = [['grazed by snails', hSn], ['frost', hFr], ['drought', hDr],
        [tr.diag && tr.diag.water < tr.diag.light ? 'starved (drought)' : 'starved of light', hSt], ['other causes', TREE_LIFE.seedlingHazard], ['died suppressed in shade', hSup]];
    } else {
      const senesce = age > S.lifespanYears ? 0.0004 * (age - S.lifespanYears) / 10 : 0;
      const hSt = tr.starving ? TREE_LIFE.starveHazard * (1 + 3 * (1 - tr.cond)) : 0;
      const hSup = MECHANISMS.saplingBank && tr.stage === 'juvenile' && tr.diag ? TREE_LIFE.saplingBank.hazard * clamp(1 - tr.diag.light / 0.5, 0, 1) : 0;
      hz = TREE_LIFE.backgroundHazard + senesce + hSt + 0.002 * pow(1 - tr.cond, 4) + hSup;
      cause = senesce > hSt ? 'old age' : hSt > 0 ? 'exhausted reserves' : hSup > 0.0001 ? 'died suppressed in shade' : 'decline';
    }
    if (rng.chance(hz)) {
      if (parts) {
        const k = rng.weighted(parts.map((x) => x[1]));
        cause = parts[k < 0 ? parts.length - 1 : k][0];
        if (cause === 'frost') tally.seedlingsFrosted += 1;
      }
      if (tr.stage === 'seedling') tally.seedlingDeaths += 1;
      killTree(world, step, tr, cause, P, events, removed);
      continue;
    }
    // Windthrow
    if (storm && tr.wood > 15) {
      const pw = TREE_LIFE.windFallBase * pow(wx.wind / 0.8, 2) * P.exposure[i] * (0.3 + tr.wood / 500)
        * (1 + 6 * tr.weak) * (1.6 - tr.cond);
      if (rng.chance(pw)) {
        fellTree(world, step, tr, P, rng, events, 'windthrow', wx);
        if (world.weather.episode && world.weather.episode.damage) world.weather.episode.damage.fallen += 1;
        continue;
      }
    }
    // Life stages
    if (tr.stage === 'seedling' && step - tr.born >= DAYS_PER_YEAR && tr.wood >= S.juvenileMass) {
      tr.stage = 'juvenile';
      tr.established = step;
      if (world._observe) world._observe('established', { tree: tr, step });
      const pl = world.patches.place[i];
      const placeName = pl >= 0 ? PLACES[pl].name : null;
      events.push({
        type: 'established', at: i, refs: [tr.id].concat(tr.mother ? [tr.mother] : []),
        text: `${speciesName(tr.sp)} ${tr.id} established at ${where(i)}${tr.mother ? `; mother ${nameOf(world, tr.mother)}` : ''}.`,
      });
      if (placeName) {
        const key = `${tr.sp}@${placeName}`;
        const present = world.trees.some((o) => o !== tr && o.sp === tr.sp && (o.stage === 'juvenile' || o.stage === 'adult') && world.patches.place[idx(o.x, o.y)] === pl);
        if (!present && !world.records.presentIn[key]) {
          events.push({ type: 'new-area', at: i, refs: [tr.id], text: `First established ${speciesName(tr.sp)} in ${placeName} since the founding.` });
        }
        world.records.presentIn[key] = true;
      }
    }
    if (tr.stage === 'juvenile' && age >= T.firstReproYears && tr.wood >= S.minReproMass * T.matureSize) {
      tr.stage = 'adult';
      if (world._observe) world._observe('adult', { tree: tr, step });
      if (tr.origin !== 'founding') {
        events.push({ type: 'maturity', at: i, refs: [tr.id], text: `${speciesName(tr.sp)} ${nameOf(world, tr.id)}, born after the founding, is now old enough and large enough to flower.` });
      }
    }
    // Year-end flowering record
    if (t.dayOfYear === DAYS_PER_YEAR - 1 && tr.repro && tr.repro.year === t.year) {
      const r = tr.repro;
      tr.history.push({
        year: t.year, flowers: Math.round(r.flowers), pollinated: Math.round(r.pollinated), frosted: Math.round(r.frosted),
        aborted: Math.round(r.aborted), fruit: Math.round(r.dropped), seeds: Math.round(r.seedsDropped),
        selfShare: r.pollinated > 0 ? q((r.donors.self || 0) / r.pollinated) : 0,
      });
      if (tr.history.length > 60) tr.history.shift();
      tr.repro = null;
    }
  }
  if (removed.size) world.trees = world.trees.filter((tr) => !removed.has(tr.id));
  void crown;
}

function killTree(world, step, tr, cause, P, events, removed) {
  if (world._observe) world._observe('death', { tree: tr, cause, step });
  const i = idx(tr.x, tr.y);
  tr.death = { step, cause };
  if (tr.stage === 'seedling' && !tr.name) {
    P.litter[i] += tr.wood + tr.leaf;
    removed.add(tr.id);
    return;
  }
  P.litter[i] += tr.leaf;
  tr.leaf = 0;
  tr.repro = null;
  tr.stage = 'snag';
  if (tr.name || tr.wood > 30) {
    events.push({ type: 'death', at: i, refs: [tr.id], text: `${tr.name || `${speciesName(tr.sp)} ${tr.id}`} died standing (${cause}).` });
  }
}

function fellTree(world, step, tr, P, rng, events, cause, wx) {
  const notable = tr.name || tr.wood >= 5;
  const wasAlive = LIVING.has(tr.stage);
  if (wasAlive) tr.death = { step, cause };
  if (world._observe) world._observe('fell', { tree: tr, wasAlive, cause, step });
  const h = treeHeight(tr);
  const len = Math.max(1, Math.round(h / 3));
  // Fall downwind: mostly towards the east and south-east, sometimes elsewhere
  const dirs = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [1, -1], [0, -1], [-1, -1]];
  const k = rng.weighted([5, 4, 2, 1, 0.5, 2, 0.5, 0.3]);
  const [dx, dy] = dirs[k];
  const cells = [];
  for (let s = 0; s <= len; s++) {
    const x = tr.x + dx * s;
    const y = tr.y + dy * s;
    if (x < 1 || y < 0 || x >= W || y >= world.H) break;
    cells.push(idx(x, y));
  }
  const woodShare = (tr.wood * 0.85) / cells.length;
  for (const c of cells) P.woodHard[c] += woodShare;
  const crownEnd = cells[cells.length - 1];
  P.litter[crownEnd] += tr.leaf + tr.wood * 0.15;
  tr.leaf = 0;
  tr.repro = null;
  tr.stage = 'fallen';
  tr.fall = { step, cells, cause };
  const who = tr.name || `${speciesName(tr.sp)} ${tr.id}`;
  if (notable) events.push({
    type: 'fall', at: cells[0], cells, refs: [tr.id],
    text: `${who} ${wasAlive ? 'was brought down' : 'fell'}${cause === 'windthrow' ? ` in wind (${Math.round(wx.wind * 100)}/100)` : ''}; ${Math.round(tr.wood * 0.85)} kg of wood now lies across ${cells.length} patch${cells.length > 1 ? 'es' : ''} from ${where(cells[0])}.`,
  });
}

// --- Measurements and records -----------------------------------------------------

export function speciesName(sp) { return TREES[sp].name; }
export function where(i) {
  const x = i % W;
  const y = Math.floor(i / W);
  return `(${x},${y})`;
}
function nameOf(world, id) {
  const tr = world._byId ? world._byId.get(id) : world.trees.find((o) => o.id === id);
  return tr ? (tr.name || tr.id) : id;
}

function measure(world, step, wx, laiTotal, tally) {
  const P = world.patches;
  const m = {
    step, temp: wx.temp, rain: wx.rain,
    bell: { seedling: 0, juvenile: 0, adult: 0, snag: 0 },
    lantern: { seedling: 0, juvenile: 0, adult: 0, snag: 0 },
  };
  let openFlowers = 0;
  for (const tr of world.trees) {
    const k = tr.sp === 'bellfruit' ? 'bell' : 'lantern';
    if (m[k][tr.stage] !== undefined) m[k][tr.stage] += 1;
    if (tr.repro) openFlowers += tr.repro.open;
  }
  let soil = 0;
  const sum = {};
  let canopy = 0;
  let relMoist = 0;
  for (let i = 0; i < N; i++) {
    if (P.kind[i] === 'wall') continue;
    soil += 1;
    relMoist += P.moist[i] / P.cap[i];
    if (laiTotal[i] > 1) canopy += 1;
  }
  for (const f of ['nutr', 'litter', 'woodHard', 'woodSoft', 'stitch', 'clover', 'fruit', 'masonAdults', 'masonCells', 'masonFed', 'mothAdults', 'mothLarvae', 'mothPupae', 'mouse', 'snail', 'wren', 'insects', 'fungus', 'pond']) {
    const a = P[f];
    let t = 0;
    for (let i = 0; i < N; i++) t += a[i];
    sum[f] = t;
  }
  const seeds = { bellfruit: 0, lantern: 0 };
  for (const c of world.seeds) seeds[c.sp] += c.n;
  Object.assign(m, {
    moistRel: relMoist / soil,
    nutrMean: sum.nutr / soil,
    litter: sum.litter,
    woodHard: sum.woodHard,
    woodSoft: sum.woodSoft,
    stitchKg: sum.stitch,
    cloverKg: sum.clover,
    fruitKg: sum.fruit,
    openFlowers,
    masonAdults: sum.masonAdults,
    masonBrood: sum.masonCells + sum.masonFed,
    mothAdults: sum.mothAdults,
    mothLarvae: sum.mothLarvae,
    mothPupae: sum.mothPupae,
    mice: sum.mouse,
    snails: sum.snail,
    wrens: sum.wren,
    insects: sum.insects,
    fungus: sum.fungus,
    pond: sum.pond,
    canopyCover: canopy / soil,
    seedsBell: seeds.bellfruit,
    seedsLantern: seeds.lantern,
    cohorts: world.seeds.length,
    ...tally,
  });
  for (const k of Object.keys(m)) if (typeof m[k] === 'number') m[k] = Math.round(m[k] * 1000) / 1000;
  return m;
}

const WATCHED = [
  ['Bellfruit', (m) => m.bell.seedling + m.bell.juvenile + m.bell.adult],
  ['Lantern Pear', (m) => m.lantern.seedling + m.lantern.juvenile + m.lantern.adult],
  ['Copper Mason', (m) => m.masonAdults + m.masonBrood],
  ['Dusk Moth', (m) => m.mothAdults + m.mothLarvae + m.mothPupae],
  ['Thimble Mouse', (m) => m.mice],
  ['Mossback Snail', (m) => m.snails],
  ['Needle Wren', (m) => m.wrens],
  ['Stitchgrass', (m) => m.stitchKg],
  ['Velvet Clover', (m) => m.cloverKg],
  ['Threadcap', (m) => m.fungus],
];

function watchPopulations(world, step, m, events) {
  const rec = world.records.lows;
  const doy = step % DAYS_PER_YEAR;
  for (const [name, f] of WATCHED) {
    const v = f(m);
    const r = rec[name] || (rec[name] = { present: true, yearMax: v, prevYearMax: v, yearMin: v, low: null });
    const present = v > 0.05;
    if (r.present && !present) events.push({ type: 'extinct', text: `${name} has disappeared from the orchard.` });
    if (!r.present && present) events.push({ type: 'returned', text: `${name} has reappeared in the orchard.` });
    r.present = present;
    r.yearMax = Math.max(r.yearMax, v);
    r.yearMin = Math.min(r.yearMin, v);
    // A documented low: the yearly peak fell below 40% of the previous year's
    if (doy === DAYS_PER_YEAR - 1) {
      if (r.prevYearMax > 0 && r.yearMax < 0.4 * r.prevYearMax && !r.low) {
        r.low = { step, peak: r.yearMax, before: r.prevYearMax };
        events.push({ type: 'low', text: `${name} had a lean year: peak ${fmt(r.yearMax)} against ${fmt(r.prevYearMax)} the year before.` });
      } else if (r.low && r.yearMax >= 0.8 * r.low.before) {
        events.push({ type: 'recovered', text: `${name} has recovered: this year's peak ${fmt(r.yearMax)} is back near the ${fmt(r.low.before)} before its low.` });
        r.low = null;
      }
      r.prevYearMax = r.yearMax;
      r.yearMax = v;
      r.yearMin = v;
    }
  }
}
const fmt = (v) => (v >= 100 ? Math.round(v).toString() : (Math.round(v * 10) / 10).toString());

// Hold every stored number to 1e-6 so saving and loading change nothing.
export function quantise(world) {
  const P = world.patches;
  for (const f of ['moist', 'pond', 'nutr', 'litter', 'woodHard', 'woodSoft', 'fungus', 'stitch', 'clover', 'insects', 'fruit',
    'masonCells', 'masonAdults', 'masonFed', 'mothAdults', 'mothLarvae', 'mothPupae', 'mouse', 'snail', 'wren']) {
    const a = P[f];
    for (let i = 0; i < N; i++) a[i] = q(a[i]);
  }
  for (const tr of world.trees) {
    tr.wood = q(tr.wood); tr.leaf = q(tr.leaf); tr.reserve = q(tr.reserve); tr.cond = q(tr.cond); tr.weak = q(tr.weak);
    if (tr.repro) for (const k of ['flowers', 'toOpen', 'open', 'pollinated', 'selfed', 'frosted', 'fruitlets', 'aborted', 'fruitKg', 'seedsDropped']) tr.repro[k] = q(tr.repro[k]);
    if (tr.repro) for (const k of Object.keys(tr.repro.donors)) tr.repro.donors[k] = q(tr.repro.donors[k]);
  }
  for (const c of world.seeds) { c.n = q(c.n); c.ready = q(c.ready); }
  for (const k of Object.keys(world.ledger)) world.ledger[k] = q(world.ledger[k]);
  world.weather.warmthSum = q(world.weather.warmthSum);
}
