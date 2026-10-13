// How history is written down: one row of measurements per orchard day,
// and a map snapshot at the start of every season. Shared by the Node
// tools and the browser so both read and write the same format.

import { N } from './landscape.js';
import { DAYS_PER_YEAR, DAYS_PER_SEASON } from './clock.js';
import { crownRadius, treeHeight } from './sim.js';

// Columns in the daily history files. Each has a unit and what it counts.
export const COLUMNS = [
  ['step', 'orchard day number since the founding', 'day'],
  ['temp', 'mean air temperature', 'C'],
  ['rain', 'rainfall', 'mm'],
  ['moistRel', 'mean soil water as a share of what the soil can hold', 'share'],
  ['nutrMean', 'mean available nutrients per patch', 'nu'],
  ['canopyCover', 'share of ground under substantial canopy', 'share'],
  ['bellSeedling', 'Bellfruit seedlings', 'trees'],
  ['bellJuvenile', 'Bellfruit established young trees', 'trees'],
  ['bellAdult', 'Bellfruit trees old and large enough to flower', 'trees'],
  ['lanternSeedling', 'Lantern Pear seedlings', 'trees'],
  ['lanternJuvenile', 'Lantern Pear established young trees', 'trees'],
  ['lanternAdult', 'Lantern Pear trees old and large enough to flower', 'trees'],
  ['openFlowers', 'open tree flowers', 'flowers'],
  ['fruitKg', 'fallen fruit lying on the ground', 'kg'],
  ['seedsBell', 'viable Bellfruit seeds in the seed bank', 'seeds'],
  ['seedsLantern', 'viable Lantern Pear seeds in the seed bank', 'seeds'],
  ['stitchKg', 'Stitchgrass biomass', 'kg'],
  ['cloverKg', 'Velvet Clover biomass', 'kg'],
  ['masonAdults', 'Copper Mason adults flying (estimate)', 'bees'],
  ['masonBrood', 'Copper Mason brood cells in nests (estimate)', 'cells'],
  ['mothAdults', 'Dusk Moth adults (estimate)', 'moths'],
  ['mothLarvae', 'Dusk Moth larvae (estimate)', 'larvae'],
  ['mothPupae', 'Dusk Moth pupae overwintering (estimate)', 'pupae'],
  ['mice', 'Thimble Mice (estimate)', 'mice'],
  ['snails', 'Mossback Snails (estimate)', 'snails'],
  ['wrens', 'Needle Wrens (estimate)', 'birds'],
  ['insects', 'other invertebrate food (index, summed over patches)', 'index'],
  ['litter', 'leaf litter', 'kg'],
  ['woodHard', 'hard deadwood', 'kg'],
  ['woodSoft', 'softened deadwood', 'kg'],
  ['fungus', 'Threadcap (index, summed over patches)', 'index'],
  ['germinated', 'seeds that germinated today', 'seeds'],
  ['germDied', 'germinated seeds crowded out within days', 'seeds'],
  ['seedlingDeaths', 'seedlings that died today', 'trees'],
  ['seedsEaten', 'seeds eaten by mice today', 'seeds'],
  ['seedsCached', 'seeds cached by mice today', 'seeds'],
  ['newBrood', 'Copper Mason brood cells provisioned today', 'cells'],
];

export function metricsRow(m) {
  const flat = {
    ...m,
    bellSeedling: m.bell.seedling, bellJuvenile: m.bell.juvenile, bellAdult: m.bell.adult,
    lanternSeedling: m.lantern.seedling, lanternJuvenile: m.lantern.juvenile, lanternAdult: m.lantern.adult,
  };
  return COLUMNS.map(([k]) => {
    const v = flat[k];
    return typeof v === 'number' ? Math.round(v * 100) / 100 : '';
  }).join(',');
}

export const CSV_HEADER = COLUMNS.map(([k]) => k).join(',');

export function parseHistory(text) {
  const lines = text.trim().split('\n');
  const head = lines[0].split(',');
  return lines.slice(1).map((l) => {
    const v = l.split(',');
    const o = {};
    head.forEach((h, k) => { o[h] = v[k] === '' ? null : Number(v[k]); });
    return o;
  });
}

export const yearOfStep = (step) => Math.floor(step / DAYS_PER_YEAR) + 1;
export const isSeasonStart = (step) => step % DAYS_PER_SEASON === 0;
export const pad = (n, w = 4) => String(n).padStart(w, '0');

// A light snapshot for drawing the map in the past: enough to show what
// grew where, without the full simulation state.
export function displaySnapshot(world) {
  const P = world.patches;
  const r = (a, k = 10) => Array.from(a, (v) => Math.round(v * k) / k);
  return {
    step: world.meta.step,
    layers: {
      moist: Array.from({ length: N }, (_, i) => (P.cap[i] ? Math.round((P.moist[i] / P.cap[i]) * 100) / 100 : 0)),
      pond: r(P.pond),
      nutr: r(P.nutr),
      litter: r(P.litter),
      woodHard: r(P.woodHard),
      woodSoft: r(P.woodSoft),
      fungus: r(P.fungus, 100),
      stitch: r(P.stitch, 100),
      clover: r(P.clover, 100),
      snail: r(P.snail),
      mouse: r(P.mouse, 100),
      fruit: r(P.fruit),
      masonAdults: r(P.masonAdults),
      masonBrood: Array.from({ length: N }, (_, i) => Math.round((P.masonCells[i] + P.masonFed[i]) * 10) / 10),
      mothAdults: r(P.mothAdults),
      nestCap: Array.from(P.nestCap),
      seedsBell: seedLayer(world, 'bellfruit'),
      seedsLantern: seedLayer(world, 'lantern'),
    },
    trees: world.trees.map((t) => ({
      id: t.id, sp: t.sp, x: t.x, y: t.y, stage: t.stage, name: t.name,
      r: Math.round(crownRadius(t) * 100) / 100, h: Math.round(treeHeight(t) * 10) / 10,
      leaf: Math.round(t.leaf * 10) / 10, cond: Math.round(t.cond * 100) / 100,
      fall: t.fall ? t.fall.cells : undefined,
      mother: t.mother || undefined,
      flowers: t.repro ? Math.round(t.repro.open) : 0,
      fruit: t.repro ? Math.round(t.repro.fruitlets) : 0,
    })),
  };
}

export function seedLayer(world, sp) {
  const a = new Array(N).fill(0);
  for (const c of world.seeds) if (c.sp === sp) a[c.i] += c.n;
  return a.map((v) => Math.round(v * 10) / 10);
}
