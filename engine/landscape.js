// The physical ground of the orchard: walls, glasshouse, slopes, soils.
// x runs west (0) to east (31); y runs north (0) to south (23).
//
// The shape of the place is fixed by design. The world seed adds small
// irregularities (soil depth, fertility, tiny bumps) so no two test
// worlds are identical, but every orchard has the same landmarks.

import { MAP } from './params.js';
import { clamp } from './dmath.js';
import { streamFor } from './rng.js';

export const W = MAP.W;
export const H = MAP.H;
export const N = W * H;
export const idx = (x, y) => y * W + x;
export const xOf = (i) => i % W;
export const yOf = (i) => Math.floor(i / W);

export const PLACES = [
  { id: 'glasshouse', name: 'The Glasshouse', cx: 13, cy: 1.5, r: 6 },
  { id: 'west-wall', name: 'West Wall', cx: 1, cy: 12, r: 3.2 },
  { id: 'old-stand', name: 'Old Stand', cx: 14.5, cy: 11, r: 5.5 },
  { id: 'east-hollow', name: 'East Hollow', cx: 26.5, cy: 11.5, r: 4.5 },
  { id: 'south-opening', name: 'South Opening', cx: 16, cy: 21, r: 6.5 },
  { id: 'fallen-bough', name: 'The Fallen Bough', cx: 22.5, cy: 17, r: 3 },
];

// Fallen trunk present at founding: from (20,15) running south-east.
export const FOUNDING_BOUGH = [[20, 15], [21, 16], [22, 16], [23, 17], [24, 17], [25, 18]];

export function placeAt(x, y) {
  let best = -1;
  let bestD = Infinity;
  for (let k = 0; k < PLACES.length; k++) {
    const p = PLACES[k];
    const d = Math.sqrt((x - p.cx) ** 2 + (y - p.cy) ** 2) / p.r;
    if (d <= 1 && d < bestD) { best = k; bestD = d; }
  }
  return best;
}

function isGlassFloor(x, y) { return x >= 8 && x <= 18 && y >= 0 && y <= 3; }

export function buildLandscape(seed) {
  const rng = streamFor(seed, 0, 'landscape');
  const P = {
    kind: new Array(N), // 'soil' | 'wall' | 'glass'
    elev: new Array(N), // metres, relative
    depth: new Array(N), // soil depth, metres
    cap: new Array(N), // water the root zone can hold, mm
    drain: new Array(N), // share of excess water draining per day
    exposure: new Array(N), // 0 sheltered .. 1 fully exposed to wind and cold
    shelter: new Array(N), // warmth bonus from walls and glass, C
    fert: new Array(N), // baseline fertility
    nestCap: new Array(N), // Copper Mason nest cells available
    place: new Array(N),
  };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = idx(x, y);
      const kind = x === 0 ? 'wall' : isGlassFloor(x, y) ? 'glass' : 'soil';
      P.kind[i] = kind;
      // Gentle fall from north to south, a basin in the east.
      const bx = (x - 26.5) / 4.5;
      const by = (y - 11.5) / 4;
      const basin = clamp(1 - (bx * bx + by * by), 0, 1);
      P.elev[i] = 2.0 - 0.035 * y - 0.01 * x - 0.6 * basin + rng.range(-0.012, 0.012);
      // Soils: deeper in the old stand and the hollow, thin by the wall and on the glass floor.
      const dOld = Math.sqrt((x - 14.5) ** 2 + (y - 11) ** 2);
      let depth = 0.45 + 0.25 * clamp(1 - dOld / 9, 0, 1) + 0.2 * basin + rng.range(-0.06, 0.06);
      if (kind === 'glass') depth = 0.22 + rng.range(-0.03, 0.03);
      if (x === 1) depth *= 0.7;
      if (y >= 19) depth *= 0.85; // the rough strip by the entrance
      if (kind === 'wall') depth = 0.05;
      P.depth[i] = clamp(depth, 0.05, 1.2);
      const whc = 0.17 + 0.05 * basin; // water held per metre of soil
      P.cap[i] = Math.round(P.depth[i] * whc * 1000 * 10) / 10;
      P.drain[i] = clamp(0.45 - 0.33 * basin + rng.range(-0.04, 0.04), 0.06, 0.6);
      // Exposure: open to the south and east, sheltered by wall and glass.
      let exposure = 0.35 + 0.025 * y + 0.012 * x;
      exposure -= 0.35 * clamp(1 - (x - 1) / 4, 0, 1); // wall shelter
      if (kind === 'glass') exposure = 0.12;
      if (y <= 5 && x >= 6 && x <= 20) exposure -= 0.15;
      P.exposure[i] = clamp(exposure, 0.05, 1);
      let shelter = 0;
      if (kind === 'glass') shelter = 2.2;
      else if (y <= 5 && x >= 7 && x <= 19) shelter = 0.8;
      shelter += 1.0 * clamp(1 - (x - 1) / 3, 0, 1);
      P.shelter[i] = Math.round(shelter * 100) / 100;
      P.fert[i] = clamp(0.8 + 0.25 * clamp(1 - dOld / 10, 0, 1) + 0.15 * basin + rng.range(-0.08, 0.08), 0.3, 1.4);
      if (kind === 'wall') P.fert[i] = 0;
      // Nest cracks: in the wall and in the glasshouse frame.
      let nest = 0;
      if (kind === 'wall') nest = 26 + rng.int(14);
      else if (kind === 'glass' && (y === 0 || x === 8 || x === 18)) nest = 10 + rng.int(8);
      P.nestCap[i] = nest;
      P.place[i] = placeAt(x, y);
      for (const k of ['elev', 'depth', 'drain', 'exposure', 'fert']) P[k][i] = Math.round(P[k][i] * 1000) / 1000;
    }
  }
  return P;
}

// Neighbour lists (4-connected and 8-connected), built once.
export const N4 = [];
export const N8 = [];
for (let i = 0; i < N; i++) {
  const x = xOf(i);
  const y = yOf(i);
  const n4 = [];
  const n8 = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      n8.push(idx(nx, ny));
      if (!dx || !dy) n4.push(idx(nx, ny));
    }
  }
  N4.push(n4);
  N8.push(n8);
}

// Patches within a radius (in patches) of a centre, with distances.
const discCache = new Map();
export function disc(cx, cy, r) {
  const key = `${cx},${cy},${Math.round(r * 4)}`;
  const hit = discCache.get(key);
  if (hit) return hit;
  const out = [];
  const R = Math.ceil(r);
  for (let dy = -R; dy <= R; dy++) {
    for (let dx = -R; dx <= R; dx++) {
      const x = cx + dx;
      const y = cy + dy;
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d <= r + 1e-9) out.push({ i: idx(x, y), d });
    }
  }
  if (discCache.size > 20000) discCache.clear();
  discCache.set(key, out);
  return out;
}

// Flat, precomputed neighbourhoods with distance weights exp(-d/k), for
// fast foraging calculations. hood(r, k) gives, for every patch i, the
// cells start[i]..start[i+1]-1 of cell[] with weights wt[].
const hoodCache = new Map();
export function hood(r, k, expFn) {
  const key = `${r}|${k}`;
  const hit = hoodCache.get(key);
  if (hit) return hit;
  const start = new Int32Array(N + 1);
  const cells = [];
  const wts = [];
  for (let i = 0; i < N; i++) {
    start[i] = cells.length;
    for (const c of disc(xOf(i), yOf(i), r)) {
      cells.push(c.i);
      wts.push(k > 0 ? expFn(-c.d / k) : 1);
    }
  }
  start[N] = cells.length;
  const out = { start, cell: Int32Array.from(cells), wt: Float64Array.from(wts) };
  hoodCache.set(key, out);
  return out;
}
