// Reading and writing a world folder on disk.
//
// worlds/<id>/
//   world.json              the saved state (checkpoint)
//   status.json             where and when it was saved, and its snapshot id
//   history/year-NNNN.csv   one row of measurements per orchard day
//   events/year-NNNN.jsonl  the orchard's event record
//   snapshots/step-NNNNNN.json   a light map snapshot at the start of every season

import fs from 'node:fs';
import path from 'node:path';
import {
  serialise, deserialise, snapshotId, advance, orchardTime, stepAt, realTimeOfStep,
} from '../engine/index.js';
import { metricsRow, CSV_HEADER, yearOfStep, isSeasonStart, pad, displaySnapshot } from '../engine/records.js';
import { stepWorld } from '../engine/sim.js';

export function loadWorld(dir) {
  return deserialise(fs.readFileSync(path.join(dir, 'world.json'), 'utf8'));
}

function appendLine(file, line) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (!fs.existsSync(file) && file.endsWith('.csv')) fs.writeFileSync(file, `${CSV_HEADER}\n`);
  fs.appendFileSync(file, `${line}\n`);
}

export function writeSnapshot(dir, world) {
  const f = path.join(dir, 'snapshots', `step-${pad(world.meta.step, 6)}.json`);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify(displaySnapshot(world)));
}

export function saveWorld(dir, world, note = '') {
  fs.mkdirSync(dir, { recursive: true });
  const text = serialise(world);
  const tmp = path.join(dir, 'world.json.tmp');
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, path.join(dir, 'world.json'));
  const status = {
    worldId: world.meta.worldId,
    name: world.meta.name,
    kind: world.meta.kind,
    engineVersion: world.meta.engineVersion,
    foundedAt: world.meta.foundedAt,
    step: world.meta.step,
    orchardTime: orchardTime(world.meta.step).label,
    stateCoversUpTo: realTimeOfStep(world.meta.foundedAt, world.meta.step),
    savedAt: new Date().toISOString(),
    snapshotId: snapshotId(world),
    savedBy: note || 'advance script',
  };
  fs.writeFileSync(path.join(dir, 'status.json'), `${JSON.stringify(status, null, 2)}\n`);
  return status;
}

// Advance a saved world to a target step (default: now), writing history,
// events and season snapshots as it goes, then save it.
export function advanceFolder(dir, { toStep, now = Date.now(), note } = {}) {
  const world = loadWorld(dir);
  const target = toStep !== undefined ? toStep : stepAt(world.meta.foundedAt, now);
  const from = world.meta.step;
  trimAfter(dir, from); // if an earlier run stopped before saving, forget what it wrote past the saved state
  let nEvents = 0;
  while (world.meta.step < target) {
    if (isSeasonStart(world.meta.step)) writeSnapshot(dir, world);
    const { events, metrics } = stepWorld(world);
    const year = yearOfStep(metrics.step);
    appendLine(path.join(dir, 'history', `year-${pad(year)}.csv`), metricsRow(metrics));
    for (const e of events) {
      appendLine(path.join(dir, 'events', `year-${pad(year)}.jsonl`), JSON.stringify(e));
      nEvents++;
    }
  }
  const status = saveWorld(dir, world, note);
  return { from, to: world.meta.step, events: nEvents, status };
}

// Remove history rows and events at or after a step (they belong to an unsaved run).
export function trimAfter(dir, step) {
  const year = yearOfStep(step);
  for (const [sub, ext] of [['history', 'csv'], ['events', 'jsonl']]) {
    const d = path.join(dir, sub);
    if (!fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d)) {
      const m = f.match(/year-(\d+)\./);
      if (!m) continue;
      const y = Number(m[1]);
      const file = path.join(d, f);
      if (y > year) { fs.unlinkSync(file); continue; }
      if (y < year) continue;
      const lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
      const keep = lines.filter((l, k) => {
        if (ext === 'csv') return k === 0 || Number(l.split(',')[0]) < step;
        return JSON.parse(l).step < step;
      });
      if (keep.length !== lines.length) fs.writeFileSync(file, keep.length ? `${keep.join('\n')}\n` : '');
    }
  }
}

export { advance };
