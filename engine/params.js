// Every tunable number the orchard runs on, in one readable place.
//
// Units used throughout:
//   mass      kg (dry biomass)            per tree, per patch pool
//   water     mm of water in a patch's root zone (1 mm over a 3 m x 3 m patch = 9 litres)
//   nutrients "nu", an index of plant-available nutrients per patch
//   animals   estimated number of animals in a patch (fractional = a share of a group's time)
//   fungus    Threadcap colony index (0 = absent, ~1 = well established in a patch)
//   insects   invertebrate food index per patch (wren food that is not moth larvae)
//   time      one step = one orchard day
//
// A patch is 3 m x 3 m of ground. The map is 32 x 24 patches (96 m x 72 m).

export const ENGINE_VERSION = '0.1.1';

export const MAP = { W: 32, H: 24, PATCH_M: 3 };

export const WEATHER = {
  meanTemp: 8.5, // C, annual mean
  tempAmp: 8.0, // C, seasonal swing either side of the mean
  warmestDay: 175, // day of year with the warmest mean (start of Fruitfall)
  anomalyPersist: 0.8, // day-to-day carry-over of temperature anomaly
  anomalySd: 1.6, // C, daily random part of the anomaly
  // Chance tomorrow is wet, given today dry / wet, by season [Thaw, Blossom, Fruitfall, Still]
  wetAfterDry: [0.38, 0.32, 0.4, 0.45],
  wetAfterWet: [0.62, 0.55, 0.65, 0.7],
  rainMeanMm: [4.5, 5.0, 6.0, 5.5], // mm on a wet day, exponential
  lightMin: 0.25, // relative day length in midwinter
  lightMax: 1.0, // at midsummer
  brightestDay: 140,
  windMean: 0.25, // index 0..1
  // Episodes: daily chance of starting, by season, and how long they last
  episodes: {
    lateFrost: { seasons: { Blossom: 0.012 }, days: [1, 3], firstDays: 35 },
    drySpell: { seasons: { Blossom: 0.006, Fruitfall: 0.005, Thaw: 0.003 }, days: [10, 22] },
    longRain: { seasons: { Thaw: 0.004, Fruitfall: 0.006, Still: 0.006, Blossom: 0.003 }, days: [6, 14] },
    warmSpell: { seasons: { Blossom: 0.007, Thaw: 0.003 }, days: [4, 9] },
    windstorm: { seasons: { Still: 0.005, Fruitfall: 0.004, Thaw: 0.003 }, days: [1, 2] },
  },
};

export const WATER = {
  wiltFrac: 0.15, // fraction of capacity plants cannot extract
  fieldFrac: 0.8, // above this fraction water drains downward
  petBase: 0.4, // mm/day potential evaporation at 0 C in full daylight
  petPerDeg: 0.17, // extra mm/day per degree above 0
  soilEvapFrac: 0.55, // bare wet soil loses this share of PET
  treeTranspPerLeafKg: 0.5, // litres per kg of leaf per mm of PET, drawn from the crown patches
  groundTranspFrac: 0.55, // full ground cover transpires this share of PET
  glassRainShare: 0.45, // broken glasshouse roof lets this share of rain through
  runoffShare: 0.85, // share of surface excess that flows to the lowest neighbour
  pondEvapFrac: 1.0,
};

export const NUTRIENTS = {
  startPerFertility: 18, // nu at founding = fertility x this
  deposition: 0.005, // nu per patch per day arriving from outside (rain, dust). Logged.
  availableShare: 0.06, // share of the pool plants can draw in a day
  halfSat: 10, // pool size at which growth runs at half the rate it would on rich ground
  richRef: 15, // pool size treated as fully fertile
  leachShare: 0.015, // share of the pool lost per full-capacity of drainage
  woodContent: 0.002, // nu per kg in wood, fruit, seeds
  leafContent: 0.016, // nu per kg in living leaves
  litterContent: 0.009, // nu per kg in leaf litter (some withdrawn before leaf fall)
  groundContent: 0.014, // nu per kg in ground plants
};

// Tree species. Trait ranges are what inheritance is bounded by.
export const TREES = {
  bellfruit: {
    name: 'Bellfruit',
    eps: 0.1, // kg production per kg leaf per day at full light, warmth, water
    maintWood: 0.0003, // kg per kg wood per day at 10 C (includes twig and root turnover)
    maintLeaf: 0.002,
    leafCoef: 0.45, // target leaf kg = leafCoef x wood^0.75
    crownCoef: 0.29, // crown radius (patches) = 0.3 + crownCoef x wood^(1/3)
    lightK: 0.65, // dense crown: strong shade beneath
    reserveCap: 0.22, // reserve store as a share of wood
    seedlingMass: 0.06, // kg, scaled by seed size: a large seed gives a sturdy seedling
    fruitMass: 0.22, // kg per fruit
    seedsPerFruit: 4, // divided by seed size
    seedFood: 0.0016, // food value per seed to a mouse
    flowersPerLeafKg: 10,
    floweringStart: 94, // day of year (Blossom day 11) before trait shift
    floweringDays: 18,
    fruitDropStart: 186, // Fruitfall day 19
    fruitDropDays: 40,
    selfCompat: 0.02, // share of self pollen that can set seed
    pollinatorDependence: 1.0,
    frostSens: 0.7, // open flowers lost to a hard frost before cold tolerance
    coldSens: 0.2, // winter cold damage on exposed ground before cold tolerance
    lifespanYears: 140,
    minReproMass: 60,
    juvenileMass: 0.15,
    chillDays: 55, // days below 5 C a seed needs before it can wake
    readyShare: 0.35, // share of chilled seeds that wake in a given spring
    germRate: 0.05,
    seedLossPerYear: 0.18, // share of viable seeds lost per year underground
    germLightNeed: 0.15, // germination light response half-point (lower = more shade-tolerant)
    traitMeans: { flowerShift: 0, fruitInvest: 0.25, seedSize: 1.0, shadeTol: 0.5, droughtTol: 0.4, coldTol: 0.5, matureSize: 1.0, firstReproYears: 11 },
  },
  lantern: {
    name: 'Lantern Pear',
    eps: 0.1,
    maintWood: 0.0006,
    maintLeaf: 0.002,
    leafCoef: 0.3,
    crownCoef: 0.27,
    lightK: 0.45, // open crown
    reserveCap: 0.22,
    seedlingMass: 0.02,
    fruitMass: 0.11,
    seedsPerFruit: 7,
    seedFood: 0.0009,
    flowersPerLeafKg: 12,
    floweringStart: 72, // Thaw day 73
    floweringDays: 16,
    fruitDropStart: 168, // first day of Fruitfall
    fruitDropDays: 34,
    selfCompat: 0.35,
    pollinatorDependence: 0.75,
    frostSens: 0.85,
    coldSens: 0.75,
    lifespanYears: 60,
    minReproMass: 15,
    juvenileMass: 0.12,
    chillDays: 35,
    readyShare: 0.6,
    germRate: 0.06,
    seedLossPerYear: 0.3,
    germLightNeed: 0.35,
    traitMeans: { flowerShift: 0, fruitInvest: 0.3, seedSize: 1.0, shadeTol: 0.3, droughtTol: 0.35, coldTol: 0.3, matureSize: 1.0, firstReproYears: 5 },
  },
};

// Bounds and spread for inherited traits (same scale for both trees).
export const TRAITS = {
  flowerShift: { min: -10, max: 10, sd: 2.2, plain: 'Days earlier (-) or later (+) than the species usually flowers.' },
  fruitInvest: { min: 0.1, max: 0.45, sd: 0.03, plain: 'Share of effort put into flowers and fruit. More fruit, less growth and less in reserve.' },
  seedSize: { min: 0.6, max: 1.6, sd: 0.08, plain: 'Seed size relative to the species norm. Bigger seeds make sturdier seedlings but fewer seeds per fruit.' },
  shadeTol: { min: 0, max: 1, sd: 0.07, plain: 'Ability to keep growing in shade. Costs some growth in full light.' },
  droughtTol: { min: 0, max: 1, sd: 0.07, plain: 'Ability to keep working when soil dries. Costs some growth when water is plentiful.' },
  coldTol: { min: 0, max: 1, sd: 0.07, plain: 'Resistance to frost and winter cold. Costs extra upkeep.' },
  matureSize: { min: 0.6, max: 1.4, sd: 0.06, plain: 'How large the tree grows. Bigger crowns catch more light but need more water and upkeep.' },
  firstReproYears: { min: 3, max: 20, sd: 0.9, plain: 'Age (orchard years) before the tree will flower. Earlier flowering diverts effort from growth sooner.' },
};

export const TREE_LIFE = {
  maxSeedlingsPerPatch: 5,
  backgroundHazard: 0.000012, // per day for established trees (about 0.4% a year)
  seedlingHazard: 0.0006,
  starveHazard: 0.004, // extra per day while reserves are empty, scaled by stress
  frostSeedlingHazard: 0.12,
  droughtSeedlingHazard: 0.015,
  snailSeedlingHazard: 0.0022, // per snail per day for the smallest seedlings
  snagFallPerDay: 0.0015,
  windFallBase: 0.004, // per storm day for a large, sound, exposed tree
  weaknessGrowth: 0.00002, // per day once a tree is old
};

export const GROUND = {
  maxKg: 4.0, // kg per patch at full cover
  stitch: { r: 0.055, lightHalf: 0.35, compOnOther: 1.15, spread: 0.0025, eatPref: 1, dieback: 1 },
  clover: { r: 0.042, lightHalf: 0.06, compOnOther: 0.8, spread: 0.0015, eatPref: 3, fixPerKg: 0.0016, dieback: 0.5 },
  turnover: 0.003, // per day in the growing seasons, to litter
  stillDieback: 0.012, // per day in Still, down to the root floor
  rootFloor: 0.25, // share of biomass that survives Still underground and can regrow
  flowersPerKgClover: 120,
};

export const DECAY = {
  litterBase: 0.008, // other soil life, without Threadcap
  litterFungus: 0.006,
  hardToSoft: 0.0018, // per day with a full Threadcap colony
  hardBase: 0.00004,
  softDecay: 0.0016,
  softBase: 0.0001,
  fungusGrow: 0.025,
  fungusDie: 0.008,
  fungusSpread: 0.004,
  fungusSubstrateHalf: 6, // kg of litter/wood at which growth is half speed
};

export const ANIMALS = {
  mason: {
    visitsPerDay: 110,
    efficiency: 0.55, // chance a visit to an open flower pollinates it
    rangePatches: 8,
    kernel: 2.8,
    emergeDegreeDays: 110, // warmth above 4 C, summed from the start of Thaw
    lateEmergeDay: 115, // by this day the remaining brood emerges regardless
    adultHazard: 0.03,
    loadsPerCell: 260,
    femaleShare: 0.5,
    overwinterSurvival: 0.62,
    minTemp: 9,
  },
  moth: {
    visitsPerDay: 35,
    efficiency: 0.22,
    rangePatches: 5,
    kernel: 2,
    flightStart: 30, // day of year
    flightEnd: 110,
    tempMin: 2,
    tempMax: 15,
    adultHazard: 0.035,
    eggsPerFemale: 40,
    femaleShare: 0.5,
    larvalEatKg: 0.00006,
    larvalHazard: 0.02,
    larvalStarveHazard: 0.06,
    pupateDay: 175,
    emergeDay: 32,
    pupaWinterHazard: 0.006, // per day, reduced by litter shelter
  },
  mouse: {
    needFood: 0.0045, // food units per day (1 unit = 1 kg fruit flesh)
    cloverFood: 0.35, // food value per kg clover eaten
    birth: 0.02,
    hazard: 0.0035,
    starveHazard: 0.03,
    crowdHazard: 0.02,
    capacityPerCover: 3.5,
    seedsHandledPerDay: 22,
    cacheShare: 0.65,
    cacheRadius: 4,
    retrieveSeedsPerDay: 9,
    cacheFindShare: 0.009, // share of a cache found per day when a hungry mouse is nearby
    soilFindShare: 0.0006, // the same for seeds already in the soil seed bank
    moveShare: 0.08,
  },
  snail: {
    eatKg: 0.0004,
    litterKg: 0.00025,
    birth: 0.03,
    hazard: 0.0018,
    dryHazard: 0.025,
    capacity: 4, // snails per patch on wet, sheltered ground
    moveShare: 0.02,
  },
  wren: {
    needFood: 1.0, // insect index units per day
    larvaFood: 0.02, // per moth larva
    birth: 0.018,
    hazard: 0.0012,
    starveHazard: 0.04,
    capacityPerWoody: 0.09,
    moveShare: 0.12,
    radius: 3,
  },
  insects: { produce: 0.035, decay: 0.03, coldFloor: 0.35 }, // litter-dwelling invertebrates stay available in cold weather
};
