// Engine guarantees. Run with: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  createWorld, advance, serialise, deserialise, snapshotId, inspectPatch, inspectTree, worldSummary,
  orchardTime, stepAt, params,
} from '../engine/index.js';
import * as dm from '../engine/dmath.js';
import { advanceFolder, loadWorld, saveWorld, writeSnapshot } from '../tools/worldfs.mjs';

const FOUNDED = '2026-01-01T00:00:00Z';
const make = (seed) => createWorld({ seed, foundedAt: FOUNDED, worldId: `t${seed}`, name: `test ${seed}` });

test('engine code never calls engine-dependent maths', () => {
  const dir = new URL('../engine/', import.meta.url);
  const banned = /Math\.(exp|log|log2|log10|log1p|expm1|pow|sin|cos|tan|atan|atan2|asin|acos|sinh|cosh|tanh|hypot|cbrt)\b/;
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.js')) continue;
    const src = fs.readFileSync(new URL(f, dir), 'utf8').split('\n')
      .filter((l) => !l.trim().startsWith('//')).join('\n');
    assert.ok(!banned.test(src), `${f} uses a banned Math function`);
  }
});

test('deterministic maths agrees with the platform to rounding error', () => {
  for (let x = -30; x <= 30; x += 0.37) {
    assert.ok(Math.abs(dm.exp(x) / Math.exp(x) - 1) < 1e-14);
    assert.ok(Math.abs(dm.sin(x) - Math.sin(x)) < 1e-13);
  }
  for (let x = 1e-6; x < 1e6; x *= 3.3) assert.ok(Math.abs(dm.log(x) - Math.log(x)) < 1e-13);
});

test('the clock: 336 orchard days a year, 30 real minutes each', () => {
  assert.equal(orchardTime(0).label, 'Year 1, Thaw day 1');
  assert.equal(orchardTime(84).season, 'Blossom');
  assert.equal(orchardTime(335).label, 'Year 1, Still day 84');
  assert.equal(orchardTime(336).label, 'Year 2, Thaw day 1');
  assert.equal(stepAt(FOUNDED, Date.parse(FOUNDED) + 7 * 24 * 3600 * 1000), 336);
  assert.equal(stepAt(FOUNDED, Date.parse(FOUNDED) - 1000), 0);
});

test('same seed, same history; different seed, different history', () => {
  const a = make(11);
  const b = make(11);
  const c = make(12);
  advance(a, 200);
  advance(b, 200);
  advance(c, 200);
  assert.equal(snapshotId(a), snapshotId(b));
  assert.notEqual(snapshotId(a).split('-')[1], snapshotId(c).split('-')[1]);
});

test('saving and loading changes nothing', () => {
  const a = make(21);
  const b = make(21);
  advance(a, 150);
  const reloaded = deserialise(serialise(a));
  advance(reloaded, 400);
  advance(b, 400);
  assert.equal(serialise(reloaded), serialise(b));
});

test('catching up in pieces equals running straight through', () => {
  const a = make(31);
  const b = make(31);
  advance(a, 500);
  for (const stop of [3, 50, 51, 200, 337, 500]) {
    const copy = deserialise(serialise(b));
    advance(copy, stop);
    b.meta = copy.meta; // keep stepping the reloaded copy
    Object.assign(b, copy);
  }
  assert.equal(serialise(a), serialise(b));
});

test('looking does not change the world', () => {
  const w = make(41);
  advance(w, 250);
  const before = serialise(w);
  for (let i = 0; i < 768; i += 37) inspectPatch(w, i);
  for (const t of w.trees) inspectTree(w, t.id);
  worldSummary(w);
  assert.equal(serialise(w), before);
});

test('stores stay finite and non-negative, traits stay in bounds, ancestry is valid', () => {
  const w = make(51);
  advance(w, 336 * 3);
  for (const [k, arr] of Object.entries(w.patches)) {
    if (!Array.isArray(arr) || typeof arr[0] !== 'number') continue;
    for (const v of arr) {
      assert.ok(Number.isFinite(v), `${k} not finite`);
      if (k !== 'elev' && k !== 'place') assert.ok(v >= 0, `${k} negative: ${v}`);
    }
  }
  const ids = new Set(w.trees.map((t) => t.id));
  for (const t of w.trees) {
    for (const k of ['wood', 'leaf', 'reserve', 'cond']) assert.ok(Number.isFinite(t[k]) && t[k] >= 0, `${t.id}.${k}`);
    for (const [k, spec] of Object.entries(params.TRAITS)) {
      assert.ok(t.traits[k] >= spec.min && t.traits[k] <= spec.max, `${t.id} trait ${k}`);
    }
    // A recorded mother must exist unless she was a seedling that has since died and been cleared
    if (t.mother && !ids.has(t.mother)) assert.ok(t.stage === 'seedling' || t.origin !== 'founding');
  }
  for (const c of w.seeds) assert.ok(c.n >= 0 && Number.isFinite(c.n) && c.ready <= c.n + 1e-6);
});

test('nutrients only enter through logged inputs', () => {
  const w = make(61);
  const total = () => w.patches.nutr.reduce((a, b) => a + b, 0);
  const start = total();
  advance(w, 336);
  // Everything that entered is in the ledger; the pool cannot exceed start + inputs
  const inputs = w.ledger.deposition + w.ledger.fixation + w.ledger.decayReturn + w.ledger.keeper;
  assert.ok(total() <= start + inputs + 1e-6);
  assert.ok(w.ledger.decayReturn > 0 && w.ledger.deposition > 0);
});

test('a world folder advances to the present and recovers from an interrupted run', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'orchard-'));
  const w = make(71);
  saveWorld(dir, w, 'founded');
  writeSnapshot(dir, w);
  const now = Date.parse(FOUNDED) + 120 * 1800 * 1000;
  const r1 = advanceFolder(dir, { now });
  assert.equal(r1.to, 120);
  const again = advanceFolder(dir, { now });
  assert.equal(again.to, 120);
  // Simulate an interrupted run: history written past the saved step
  fs.appendFileSync(path.join(dir, 'history', 'year-0001.csv'), '120,1,1\n121,1,1\n');
  const r2 = advanceFolder(dir, { toStep: 130 });
  assert.equal(r2.to, 130);
  const rows = fs.readFileSync(path.join(dir, 'history', 'year-0001.csv'), 'utf8').trim().split('\n').slice(1);
  const steps = rows.map((l) => Number(l.split(',')[0]));
  assert.deepEqual(steps, Array.from({ length: 130 }, (_, k) => k));
  // Matches a world advanced in memory
  const mem = make(71);
  advance(mem, 130);
  assert.equal(serialise(loadWorld(dir)), serialise(mem));
});
