// Creating a world: the founding state at the first day of Thaw.

import { ENGINE_VERSION, TREES, TRAITS, NUTRIENTS } from './params.js';
import { buildLandscape, N, W, H, idx, FOUNDING_BOUGH, PLACES } from './landscape.js';
import { streamFor } from './rng.js';
import { initialWeather } from './weather.js';
import { clamp, q, pow } from './dmath.js';
import { DAYS_PER_YEAR } from './clock.js';

export const DYNAMIC_FIELDS = [
  'moist', 'pond', 'nutr', 'litter', 'woodHard', 'woodSoft', 'fungus',
  'stitch', 'clover', 'insects', 'fruit',
  'masonCells', 'masonAdults', 'masonFed', 'mothAdults', 'mothLarvae', 'mothPupae',
  'mouse', 'snail', 'wren', 'protectUntil',
];

export function randomTraits(sp, rng, spread = 1) {
  const means = TREES[sp].traitMeans;
  const t = {};
  for (const [k, spec] of Object.entries(TRAITS)) {
    t[k] = q(clamp(rng.normal(means[k], spec.sd * 1.6 * spread), spec.min, spec.max));
  }
  return t;
}

export function newTree(world, props) {
  const id = `T${++world.counters.tree}`;
  const sp = props.sp;
  const tree = {
    id,
    sp,
    x: props.x,
    y: props.y,
    born: props.born,
    wood: q(props.wood),
    leaf: q(props.leaf || 0),
    reserve: q(props.reserve !== undefined ? props.reserve : props.wood * 0.15),
    cond: props.cond !== undefined ? props.cond : 0.8,
    weak: props.weak || 0,
    traits: props.traits,
    mother: props.mother || null,
    father: props.father || null,
    origin: props.origin || 'seed', // 'founding' | 'seed' | 'keeper'
    gen: props.gen || 0,
    name: props.name || null,
    nameHistory: props.name ? [{ name: props.name, by: 'brief', step: 0 }] : [],
    stage: props.stage || 'seedling',
    death: null,
    fall: null,
    repro: null,
    history: [],
    diag: null,
  };
  world.trees.push(tree);
  return tree;
}

function plantFounder(world, rng, sp, x, y, wood, ageYears, extra = {}) {
  const traits = randomTraits(sp, rng);
  const stage = wood >= TREES[sp].minReproMass && ageYears >= traits.firstReproYears ? 'adult' : 'juvenile';
  return newTree(world, {
    sp, x, y, wood,
    born: -Math.round(ageYears * DAYS_PER_YEAR),
    traits,
    origin: 'founding',
    stage,
    reserve: wood * 0.16,
    cond: extra.cond ?? 0.8,
    weak: extra.weak ?? 0.03,
    name: extra.name,
    gen: 0,
  });
}

export function createWorld({ seed, foundedAt, worldId, name, kind = 'test' }) {
  const rng = streamFor(seed, 0, 'founding');
  const patches = buildLandscape(seed);
  const world = {
    meta: {
      worldId,
      name,
      kind, // 'test' worlds are for development; 'orchard' is the shared world
      engineVersion: ENGINE_VERSION,
      seed,
      foundedAt,
      step: 0,
    },
    W, H,
    places: PLACES.map((p) => ({ ...p, by: 'brief' })),
    patches,
    trees: [],
    seeds: [],
    weather: initialWeather(),
    counters: { tree: 0, seed: 0, event: 0 },
    ledger: { deposition: 0, fixation: 0, leached: 0, decayReturn: 0, keeper: 0 },
    records: { lows: {}, presentIn: {} },
  };
  for (const f of DYNAMIC_FIELDS) patches[f] = new Array(N).fill(0);

  // --- Trees ---------------------------------------------------------------
  // Old Stand: mature Bellfruit
  const standSpots = [[12, 9], [15, 8], [18, 10], [11, 12], [14, 12], [17, 13], [13, 15]];
  for (const [x0, y0] of standSpots) {
    const x = x0 + rng.int(2);
    const y = y0 + rng.int(2) - 1;
    const age = 35 + rng.int(55);
    const wood = 260 + rng.int(420);
    plantFounder(world, rng, 'bellfruit', x, y, wood, age, { cond: 0.6 + rng.range(0, 0.3) });
  }
  plantFounder(world, rng, 'bellfruit', 22, 11, 690, 96, { name: 'The Leaning Bell', weak: 0.55, cond: 0.55 });
  plantFounder(world, rng, 'bellfruit', 3, 13, 430, 58, { name: 'Wallkeeper', cond: 0.85 });
  // Bellfruit juveniles at the brighter edges of the stand
  for (const [x, y] of [[9, 16], [20, 15], [8, 8], [19, 6]]) {
    plantFounder(world, rng, 'bellfruit', x + rng.int(2), y, 6 + rng.int(30), 6 + rng.int(8), { cond: 0.7 });
  }
  // Lantern Pear near the Glasshouse and West Wall
  plantFounder(world, rng, 'lantern', 12, 4, 230, 44, { name: 'Old Lantern', cond: 0.75 });
  for (const [x, y, wood, age] of [[15, 2, 110, 20], [7, 4, 140, 26], [19, 4, 70, 14], [2, 5, 160, 30], [2, 9, 95, 18], [3, 18, 120, 22], [5, 6, 9, 4]]) {
    plantFounder(world, rng, 'lantern', x, y, wood + rng.int(30), age, { cond: 0.65 + rng.range(0, 0.25) });
  }

  // --- Ground, water, soil -------------------------------------------------
  const P = patches;
  const near = (i, list, r) => {
    const x = i % W;
    const y = Math.floor(i / W);
    return list.some((t) => (t.x - x) ** 2 + (t.y - y) ** 2 <= r * r);
  };
  for (let i = 0; i < N; i++) {
    const x = i % W;
    const y = Math.floor(i / W);
    if (P.kind[i] === 'wall') continue;
    P.moist[i] = q(P.cap[i] * 0.72);
    P.nutr[i] = q(P.fert[i] * NUTRIENTS.startPerFertility);
    const underTree = near(i, world.trees.filter((t) => t.wood > 50), 2.5);
    P.litter[i] = q((underTree ? 4 : 1.2) + rng.range(0, 1));
    // Stitchgrass: dense in South Opening, patchy on open ground, thin under trees
    let stitch = underTree ? 0.05 : 0.3;
    if (y >= 18) stitch = 0.8;
    if (P.kind[i] === 'glass') stitch = 0.15;
    // Velvet Clover: a broken band between the wall and the central trees
    let clover = underTree ? 0.05 : 0.08;
    if (x >= 2 && x <= 8 && y >= 6 && y <= 19 && rng.chance(0.65)) clover = 0.35 + rng.range(0, 0.25);
    P.stitch[i] = q(stitch * 4 * rng.range(0.8, 1.1));
    P.clover[i] = q(clover * 4 * rng.range(0.8, 1.1));
    P.insects[i] = q(2 + rng.range(0, 1));
    // Mossback Snails concentrated near East Hollow
    const dh = Math.sqrt((x - 26.5) ** 2 + (y - 11.5) ** 2);
    if (dh < 6) P.snail[i] = q(18 * (1 - dh / 6) + rng.range(0, 3));
    else if (rng.chance(0.08)) P.snail[i] = q(rng.range(0, 3));
    // Dusk Moth overwintering as pupae in sheltered litter
    P.mothPupae[i] = q(P.litter[i] * 1.3 * rng.range(0.6, 1.2));
    // Thimble Mice through the connected cover of the centre
    const dc = Math.sqrt((x - 14.5) ** 2 + (y - 11.5) ** 2);
    if (dc < 8) P.mouse[i] = q(0.22 * (1 - dc / 8) + rng.range(0, 0.05));
    // Needle Wren: a few birds in the woody centre
    if (dc < 9) P.wren[i] = q(0.09 * (1 - dc / 9));
  }
  // Copper Mason brood waiting in the wall and glasshouse cracks
  for (let i = 0; i < N; i++) {
    if (P.nestCap[i] > 0) P.masonCells[i] = q(P.nestCap[i] * rng.range(0.25, 0.45));
  }
  // The Fallen Bough: hard and softening wood, with Threadcap
  FOUNDING_BOUGH.forEach(([x, y], k) => {
    const i = idx(x, y);
    P.woodHard[i] = q(70 - k * 6);
    P.woodSoft[i] = q(25 + k * 8);
    P.fungus[i] = q(0.9 - k * 0.05);
    P.litter[i] = q(P.litter[i] + 3);
    P.snail[i] = q(P.snail[i] + 4);
    P.mothPupae[i] = q(P.mothPupae[i] + 4);
  });

  // --- Founding seed bank --------------------------------------------------
  // Founding stock of unknown parentage. Seeds have already had one winter.
  const seedSpots = [
    ['bellfruit', 13, 10], ['bellfruit', 16, 11], ['bellfruit', 10, 14], ['bellfruit', 19, 12],
    ['bellfruit', 21, 13], ['bellfruit', 24, 12], ['bellfruit', 15, 16], ['bellfruit', 6, 12],
    ['lantern', 11, 5], ['lantern', 14, 3], ['lantern', 3, 7], ['lantern', 4, 16], ['lantern', 8, 6], ['lantern', 20, 7],
  ];
  for (const [sp, x, y] of seedSpots) {
    const traits = randomTraits(sp, rng, 1.2);
    world.seeds.push({
      id: `S${++world.counters.seed}`,
      sp,
      i: idx(x, y),
      n: q(8 + rng.int(28)),
      born: 0, // founding stock: age unknown, counted from the founding
      mother: null,
      father: null,
      origin: 'founding',
      disp: 'founding',
      chill: TREES[sp].chillDays,
      ready: 0,
      gen: 0,
      traits, // founding stock: one representative trait set per cohort
      buried: true,
    });
  }
  return world;
}

export { pow };
