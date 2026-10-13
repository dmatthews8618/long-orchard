#!/usr/bin/env node
// Long runs on many test worlds, looking for the failure patterns the brief
// lists: collapse, runaway growth, one species always winning, stasis,
// pollinators without food, seed banks that never decay.
//
//   node tools/validate.mjs --seeds 101,102,103 --years 25 --out docs/validation.md
//
// These seeds are development worlds only. The shared orchard's seed is
// drawn blind at founding and is never run here.
import fs from 'node:fs';
import { createWorld, advance, DAYS_PER_YEAR } from '../engine/index.js';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const seeds = opt('seeds', '101,102,103,104,105,106').split(',').map(Number);
const years = Number(opt('years', 20));
const out = opt('out', null);

const POPS = [
  ['Bellfruit (living)', (m) => m.bell.seedling + m.bell.juvenile + m.bell.adult],
  ['Bellfruit adults', (m) => m.bell.adult],
  ['Lantern Pear (living)', (m) => m.lantern.seedling + m.lantern.juvenile + m.lantern.adult],
  ['Lantern Pear adults', (m) => m.lantern.adult],
  ['Copper Mason (adults+brood)', (m) => m.masonAdults + m.masonBrood],
  ['Dusk Moth (all stages)', (m) => m.mothAdults + m.mothLarvae + m.mothPupae],
  ['Thimble Mouse', (m) => m.mice],
  ['Mossback Snail', (m) => m.snails],
  ['Needle Wren', (m) => m.wrens],
  ['Stitchgrass kg', (m) => m.stitchKg],
  ['Velvet Clover kg', (m) => m.cloverKg],
  ['Threadcap index', (m) => m.fungus],
  ['Bellfruit seed bank', (m) => m.seedsBell],
  ['Lantern Pear seed bank', (m) => m.seedsLantern],
  ['Mean nutrients', (m) => m.nutrMean],
  ['Deadwood kg', (m) => m.woodHard + m.woodSoft],
];

function runSeed(seed) {
  const w = createWorld({ seed, foundedAt: '2026-01-01T00:00:00Z', worldId: `val-${seed}`, name: `validation ${seed}` });
  const yearly = [];
  const notes = [];
  let eventsTotal = 0;
  const t0 = Date.now();
  for (let y = 1; y <= years; y++) {
    const { metrics, events } = advance(w, y * DAYS_PER_YEAR);
    eventsTotal += events.length;
    for (const e of events) if (['extinct', 'returned', 'fall', 'established', 'first', 'low', 'recovered'].includes(e.type)) notes.push(`Y${y}: ${e.text}`);
    const row = {};
    for (const [name, f] of POPS) {
      const vals = metrics.map(f);
      row[name] = { max: Math.max(...vals), min: Math.min(...vals), end: vals[vals.length - 1] };
    }
    row.germinated = metrics.reduce((a, m) => a + m.germinated, 0);
    row.newBrood = metrics.reduce((a, m) => a + m.newBrood, 0);
    yearly.push(row);
  }
  const established = w.trees.filter((t) => t.origin !== 'founding' && (t.stage === 'juvenile' || t.stage === 'adult'));
  return {
    seed, yearly, notes, eventsTotal, ms: Date.now() - t0,
    end: {
      trees: w.trees.length,
      bornEstablished: { bellfruit: established.filter((t) => t.sp === 'bellfruit').length, lantern: established.filter((t) => t.sp === 'lantern').length },
      maxGen: Math.max(0, ...w.trees.map((t) => t.gen)),
      cohorts: w.seeds.length,
      ledger: w.ledger,
      bytes: JSON.stringify(w).length,
    },
  };
}

function judge(r) {
  const flags = [];
  const last = r.yearly[r.yearly.length - 1];
  for (const [name] of POPS) {
    const series = r.yearly.map((y) => y[name].max);
    const lost = r.yearly.findIndex((y) => y[name].max < 0.05);
    if (lost >= 0 && lost < 3) flags.push(`${name} lost within ${lost + 1} year(s): possible founding imbalance`);
    else if (lost >= 0) flags.push(`${name} lost in year ${lost + 1}`);
    // Runaway: the last five yearly peaks each higher than the one before and the final peak 3x the first
    const tail = series.slice(-6);
    if (tail.length >= 6 && tail.every((v, k) => k === 0 || v > tail[k - 1] * 1.02) && series[series.length - 1] > 3 * Math.max(series[0], 1e-6)) {
      flags.push(`${name} still rising steeply (${series[0].toFixed(1)} -> ${series[series.length - 1].toFixed(1)})`);
    }
  }
  const germ = r.yearly.slice(-5).reduce((a, y) => a + y.germinated, 0);
  if (germ === 0) flags.push('No germination in the last five years: stasis in the seed bank');
  const bank = r.yearly.map((y) => y['Lantern Pear seed bank'].max + y['Bellfruit seed bank'].max);
  if (bank.length > 8 && bank.slice(-4).every((v, k, a) => k === 0 || v > a[k - 1] * 1.05)) flags.push('Seed bank still growing every year');
  if (last['Copper Mason (adults+brood)'].max > 0 && r.yearly.every((y) => y.newBrood === 0)) flags.push('Copper Mason present but never provisions brood');
  return flags;
}

const fmt = (v) => (v >= 100 ? Math.round(v).toString() : v >= 10 ? v.toFixed(1) : v.toFixed(2));
const results = [];
for (const s of seeds) {
  const r = runSeed(s);
  r.flags = judge(r);
  results.push(r);
  console.log(`seed ${s}: ${years} years in ${(r.ms / 1000).toFixed(0)} s, ${r.flags.length} flag(s)`);
  for (const f of r.flags) console.log(`   ! ${f}`);
}

if (out) {
  const lines = [];
  lines.push(`# Engine validation`);
  lines.push('');
  lines.push(`Generated by \`node tools/validate.mjs\` on ${new Date().toISOString().slice(0, 10)}, engine ${results.length ? '' : ''}${(await import('../engine/params.js')).ENGINE_VERSION}.`);
  lines.push(`${seeds.length} development worlds (seeds ${seeds.join(', ')}), ${years} orchard years each. None of these is the shared orchard.`);
  lines.push('');
  lines.push('Each cell shows the lowest and highest value seen in that year range (min–max).');
  lines.push('');
  const bands = [[1, 1], [2, 5], [6, 10], [11, 15], [16, 20], [21, 25], [26, 30]].filter(([a]) => a <= years);
  for (const r of results) {
    lines.push(`## Seed ${r.seed}`);
    lines.push('');
    lines.push(`| | ${bands.map(([a, b]) => `Y${a}${b > a ? `–${Math.min(b, years)}` : ''}`).join(' | ')} |`);
    lines.push(`|---|${bands.map(() => '---').join('|')}|`);
    for (const [name] of POPS) {
      const cells = bands.map(([a, b]) => {
        const ys = r.yearly.slice(a - 1, Math.min(b, years));
        return `${fmt(Math.min(...ys.map((y) => y[name].min)))}–${fmt(Math.max(...ys.map((y) => y[name].max)))}`;
      });
      lines.push(`| ${name} | ${cells.join(' | ')} |`);
    }
    lines.push('');
    lines.push(`Trees born after founding that established: Bellfruit ${r.end.bornEstablished.bellfruit}, Lantern Pear ${r.end.bornEstablished.lantern}. Deepest generation: ${r.end.maxGen}. Seed cohorts at end: ${r.end.cohorts}.`);
    lines.push('');
    lines.push(`Flags: ${r.flags.length ? r.flags.join('; ') : 'none'}.`);
    lines.push('');
    const keyNotes = r.notes.filter((n) => !n.includes('established at')).slice(0, 25);
    if (keyNotes.length) {
      lines.push('<details><summary>Notable events</summary>');
      lines.push('');
      for (const n of keyNotes) lines.push(`- ${n}`);
      lines.push('');
      lines.push('</details>');
      lines.push('');
    }
  }
  fs.writeFileSync(out, `${lines.join('\n')}\n`);
  console.log(`wrote ${out}`);
}
