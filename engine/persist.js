// Saving, loading and identifying world states.

import { hashString } from './rng.js';
import { buildLandscape } from './landscape.js';

// The fixed ground (walls, soils, slopes) is rebuilt from the world seed on
// loading rather than stored with every save.
export const STATIC_FIELDS = ['kind', 'elev', 'depth', 'cap', 'drain', 'exposure', 'shelter', 'fert', 'nestCap', 'place'];
import { stepWorld } from './sim.js';
import { ENGINE_VERSION } from './params.js';

// Working caches on the world object start with "_" and are never saved.
export function serialise(world) {
  const patches = {};
  for (const [k, v] of Object.entries(world.patches)) if (!STATIC_FIELDS.includes(k)) patches[k] = v;
  return JSON.stringify({ ...world, patches }, (k, v) => (k.startsWith('_') ? undefined : v));
}

export function deserialise(text) {
  const world = typeof text === 'string' ? JSON.parse(text) : JSON.parse(JSON.stringify(text));
  const ground = buildLandscape(world.meta.seed);
  for (const k of STATIC_FIELDS) if (!world.patches[k]) world.patches[k] = ground[k];
  if (world.meta.engineVersion !== ENGINE_VERSION) {
    world._versionWarning = `Saved with engine ${world.meta.engineVersion}; running ${ENGINE_VERSION}.`;
  }
  return world;
}

// A short fingerprint of a state. Two states with the same snapshot id are identical.
export function snapshotId(world) {
  const s = serialise(world);
  // Two independent 32-bit hashes give a 16-hex-digit id
  const a = hashString(s).toString(16).padStart(8, '0');
  const b = hashString(s.split('').reverse().join('')).toString(16).padStart(8, '0');
  return `${world.meta.worldId}@${world.meta.step}-${a}${b}`;
}

// Advance a world until it has simulated every step below targetStep.
// Returns the events and per-step metrics produced along the way.
export function advance(world, targetStep, { onStep } = {}) {
  const events = [];
  const metrics = [];
  while (world.meta.step < targetStep) {
    const r = stepWorld(world);
    for (const e of r.events) events.push(e);
    metrics.push(r.metrics);
    if (onStep) onStep(r);
  }
  return { events, metrics };
}

// Same as advance, but yields to the browser between chunks so a long
// absence never freezes the page.
export async function advanceAsync(world, targetStep, { chunk = 24, onProgress } = {}) {
  const events = [];
  const metrics = [];
  const start = world.meta.step;
  while (world.meta.step < targetStep) {
    const stop = Math.min(targetStep, world.meta.step + chunk);
    const r = advance(world, stop);
    events.push(...r.events);
    metrics.push(...r.metrics);
    if (onProgress) onProgress((world.meta.step - start) / Math.max(1, targetStep - start));
    await new Promise((res) => setTimeout(res, 0));
  }
  return { events, metrics };
}
