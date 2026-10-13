// Read-only views of a world. Nothing here changes the world or draws
// randomness, so inspecting can never alter what happens next.

import { TREES, TRAITS, GROUND, WATER } from './params.js';
import { exp, clamp } from './dmath.js';
import { W, N, idx, PLACES, disc } from './landscape.js';
import { orchardTime, DAYS_PER_YEAR, SEASONS } from './clock.js';
import { crownRadius, treeHeight, leafPhase, speciesName } from './sim.js';

const LIVING = new Set(['seedling', 'juvenile', 'adult']);
const r2 = (x) => Math.round(x * 100) / 100;
const r1 = (x) => Math.round(x * 10) / 10;

export function placeName(world, i) {
  const k = world.patches.place[i];
  return k >= 0 ? (world.places[k] || PLACES[k]).name : null;
}

// Canopy over every patch right now (leaf area index), computed from the trees.
export function canopyMap(world) {
  const lai = new Array(N).fill(0);
  const shade = new Array(N).fill(0); // sum of extinction x leaf area, as the engine uses
  const cover = Array.from({ length: N }, () => []);
  for (const tr of world.trees) {
    if (!LIVING.has(tr.stage)) continue;
    const cells = disc(tr.x, tr.y, Math.max(crownRadius(tr), 0.01));
    const l = (tr.leaf * 15) / (cells.length * 9);
    for (const c of cells) {
      lai[c.i] += l;
      shade[c.i] += l * TREES[tr.sp].lightK;
      cover[c.i].push(tr.id);
    }
  }
  return { lai, shade, cover };
}

function describeLimits(d) {
  if (!d) return null;
  const names = { light: 'light (shade)', water: 'soil moisture', nutrients: 'nutrients', warmth: 'warmth' };
  const plain = { light: 'shade from trees or grass above', water: 'dry soil', nutrients: 'poor soil nutrients', warmth: 'cold' };
  const f = ['light', 'water', 'nutrients', 'warmth'].map((k) => [k, d[k]]).sort((a, b) => a[1] - b[1]);
  const [worstK, worstV] = f[0];
  if (worstV >= 0.85) return 'Nothing is strongly limiting growth today.';
  const ok = f.filter(([, v]) => v >= 0.85).map(([k]) => names[k]);
  const list = ok.length > 1 ? `${ok.slice(0, -1).join(', ')} and ${ok[ok.length - 1]}` : ok[0];
  return `Growth is limited mainly by ${plain[worstK]} (${Math.round(worstV * 100)}% of full)${ok.length ? `; ${list} ${ok.length > 1 ? 'are' : 'is'} adequate` : ''}.`;
}

export function inspectPatch(world, i, { events = [] } = {}) {
  const P = world.patches;
  const x = i % W;
  const y = Math.floor(i / W);
  const { lai, shade, cover } = canopyMap(world);
  const today = world.weather.today || { light: 1 };
  const groundLight = today.light * exp(-shade[i]);
  const rel = P.cap[i] > 0 ? P.moist[i] / P.cap[i] : 0;
  const trunks = world.trees.filter((t) => t.x === x && t.y === y);
  const seeds = world.seeds.filter((c) => c.i === i).sort((a, b) => b.n - a.n);
  const plants = trunks.map((t) => ({
    id: t.id, name: t.name, species: speciesName(t.sp), stage: t.stage,
    wood: r1(t.wood), condition: r2(t.cond), limits: LIVING.has(t.stage) ? describeLimits(t.diag) : null,
  }));
  // Ground plant limits from conditions here
  const sc = P.stitch[i] / GROUND.maxKg;
  const cc = P.clover[i] / GROUND.maxKg;
  const notes = [];
  if (P.kind[i] === 'wall') notes.push('Dry stone wall: nest cracks for Copper Mason, no soil.');
  if (P.kind[i] === 'glass') notes.push('Glasshouse floor: warm and sheltered, thin soil, about half the rain gets through the broken roof.');
  if (exp(-shade[i]) < 0.25) notes.push('Deep shade under the canopy limits ground plants and seedlings.');
  else if (cover[i].length && lai[i] < 0.2) notes.push('Under bare branches now; it will be shaded once leaves open.');
  if (rel < 0.35) notes.push('The soil is dry.');
  if (rel > 0.95 || P.pond[i] > 0.5) notes.push('The ground is waterlogged.');
  if (sc > 0.6) notes.push('Dense Stitchgrass makes it hard for seedlings to establish.');
  if (P.woodSoft[i] > 15) notes.push('Softened deadwood here is a good seedbed.');
  return {
    patch: i, x, y, place: placeName(world, i), kind: P.kind[i],
    ground: {
      elevation_m: P.elev[i], soilDepth_m: P.depth[i], waterCapacity_mm: P.cap[i], drainage: P.drain[i],
      exposure: P.exposure[i], shelter_C: P.shelter[i], baselineFertility: P.fert[i], nestCracks: P.nestCap[i],
    },
    now: {
      soilWater_mm: r1(P.moist[i]), soilWater_share: r2(rel), standingWater_mm: r1(P.pond[i]),
      nutrients_nu: r2(P.nutr[i]), leafLitter_kg: r1(P.litter[i]),
      deadwoodHard_kg: r1(P.woodHard[i]), deadwoodSoft_kg: r1(P.woodSoft[i]), threadcap_index: r2(P.fungus[i]),
      canopyLAI: r2(lai[i]), groundLight_share: r2(groundLight),
      stitchgrass_kg: r2(P.stitch[i]), velvetClover_kg: r2(P.clover[i]), fallenFruit_kg: r2(P.fruit[i]),
      invertebrates_index: r1(P.insects[i]),
    },
    animals: {
      copperMason_adults: r1(P.masonAdults[i]), copperMason_brood: r1(P.masonCells[i] + P.masonFed[i]),
      duskMoth_adults: r1(P.mothAdults[i]), duskMoth_larvae: r1(P.mothLarvae[i]), duskMoth_pupae: r1(P.mothPupae[i]),
      thimbleMouse: r2(P.mouse[i]), mossbackSnail: r1(P.snail[i]), needleWren: r2(P.wren[i]),
    },
    trunks: plants,
    underCrownsOf: cover[i].filter((id) => !trunks.some((t) => t.id === id)),
    seedsWaiting: seeds.map((c) => ({
      cohort: c.id, species: speciesName(c.sp), viable: r1(c.n), wakingThisSpring: r1(c.ready),
      mother: c.mother, origin: c.origin, route: c.disp, buried: c.buried, since: orchardTime(Math.max(0, c.born)).label,
    })),
    notes,
    recentEvents: events.filter((e) => e.at === i || (e.cells && e.cells.includes(i))).slice(-8),
  };
}

export function inspectTree(world, id, { events = [] } = {}) {
  const t = world.trees.find((o) => o.id === id);
  if (!t) return null;
  const step = world.meta.step;
  const S = TREES[t.sp];
  const traits = {};
  for (const [k, spec] of Object.entries(TRAITS)) {
    const v = t.traits[k];
    const mean = S.traitMeans[k];
    traits[k] = { value: v, speciesTypical: mean, meaning: spec.plain };
  }
  const descendants = world.trees.filter((o) => o.mother === id || o.father === id);
  return {
    id: t.id, name: t.name, nameHistory: t.nameHistory, species: speciesName(t.sp),
    at: { x: t.x, y: t.y, place: placeName(world, idx(t.x, t.y)) },
    origin: t.origin, generation: t.gen,
    born: t.born <= 0 && t.origin === 'founding' ? 'before the founding' : orchardTime(t.born).label,
    ageYears: r1((step - t.born) / DAYS_PER_YEAR), stage: t.stage,
    condition: r2(t.cond), structuralWeakness: r2(t.weak),
    size: { wood_kg: r1(t.wood), leaf_kg: r1(t.leaf), reserve_kg: r1(t.reserve), height_m: r1(treeHeight(t)), crownRadius_patches: r1(crownRadius(t)) },
    today: t.diag ? { ...t.diag, explanation: describeLimits(t.diag) } : null,
    traits,
    flowering: t.repro ? { thisYear: { flowers: Math.round(t.repro.flowers), open: Math.round(t.repro.open), pollinated: Math.round(t.repro.pollinated), developingFruit: Math.round(t.repro.fruitlets) } } : null,
    history: t.history,
    mother: t.mother, father: t.father,
    descendants: descendants.map((o) => ({ id: o.id, name: o.name, stage: o.stage, species: speciesName(o.sp) })),
    death: t.death, fall: t.fall,
    events: events.filter((e) => e.refs && e.refs.includes(id)).slice(-20),
  };
}

export function worldSummary(world, metrics) {
  const t = orchardTime(world.meta.step);
  const m = metrics || {};
  const named = world.trees.filter((o) => o.name).map((o) => ({ id: o.id, name: o.name, stage: o.stage, condition: r2(o.cond) }));
  return {
    world: world.meta.name, worldId: world.meta.worldId, kind: world.meta.kind, engine: world.meta.engineVersion,
    step: world.meta.step,
    time: t.label, season: t.season, seasonMeaning: SEASONS[t.seasonIndex].plain,
    weather: world.weather.today, episode: world.weather.episode,
    named,
    metrics: m,
  };
}

export { describeLimits, leafPhase, WATER, clamp };
