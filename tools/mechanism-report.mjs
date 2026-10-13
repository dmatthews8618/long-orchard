#!/usr/bin/env node
// Compares recruitment runs under different mechanism switches.
//   node tools/mechanism-report.mjs out.md <run.json ...>
import fs from 'node:fs';

const [outFile, ...files] = process.argv.slice(2);
const runs = files.map((f) => JSON.parse(fs.readFileSync(f, 'utf8')));
const CONDS = ['neither', 'caches', 'saplings', 'caches+saplings'];
const LABEL = { neither: 'Neither (engine as before)', caches: 'Forgotten caches only', saplings: 'Sapling bank only', 'caches+saplings': 'Both' };
const seeds = [...new Set(runs.map((r) => r.seed))].sort();
const get = (seed, cond) => runs.find((r) => r.seed === seed && r.condition === cond);
const at = (r, year) => r.byDecade.find((d) => d.year === year) || r.byDecade[r.byDecade.length - 1];
const pct = (a, b) => (b > 0 ? `${Math.round((100 * a) / b)}%` : '–');
const L = [];

L.push('# Bellfruit renewal: testing two mechanisms');
L.push('');
L.push(`Four development worlds (seeds ${seeds.join(', ')}), each run for ${runs[0].years} orchard years under four conditions on the same engine (0.2.0-dev): neither change, forgotten caches only, the sapling bank only, and both. No seed numbers were changed, and the shared orchard's seed was not run.`);
L.push('');
L.push('- **Forgotten caches**: when a mouse makes a cache, its fate is decided once. About 22% of caches are forgotten for good; mice never dig them up. The rest are found as before, more readily where mice are dense. Forgotten seed still rots and still has to meet the ordinary germination conditions.');
L.push('- **Sapling bank**: a seedling or young tree in deep shade (less than half the light it would get in the open) idles. Its upkeep falls in proportion to its shade tolerance and to how deep the shade is, and it carries a smaller crown, so it grows very little. It also carries an extra risk of death, about 13% a year in the deepest shade. When light returns, it grows by the ordinary rules. A tree counts as released if it waited at least a year and later stood in good light.');
L.push('');

L.push('## Bellfruit flowering trees');
L.push('');
L.push('Founding trees still standing / trees born in the orchard, at year 70 and at the end.');
L.push('');
L.push(`| Condition | ${seeds.map((s) => `World ${s}`).join(' | ')} |`);
L.push(`|---|${seeds.map(() => '---').join('|')}|`);
for (const c of CONDS) {
  const cells = seeds.map((s) => {
    const r = get(s, c);
    if (!r) return '–';
    const a = at(r, 70);
    const b = at(r, r.years);
    return `Y70: ${a.bellAdultsFounding} / ${a.bellAdultsBorn}; Y${r.years}: ${b.bellAdultsFounding} / ${b.bellAdultsBorn}`;
  });
  L.push(`| ${LABEL[c]} | ${cells.join(' | ')} |`);
}
L.push('');

L.push('## Orchard-born Bellfruit that reached flowering, over the whole run');
L.push('');
L.push(`| Condition | ${seeds.map((s) => `World ${s}`).join(' | ')} | Total | Deepest Bellfruit-bearing generation alive at end |`);
L.push(`|---|${seeds.map(() => '---').join('|')}|---|---|`);
for (const c of CONDS) {
  let total = 0;
  const cells = seeds.map((s) => {
    const r = get(s, c);
    if (!r) return '–';
    let n = 0;
    for (const [k, f] of Object.entries(r.funnel)) if (k.startsWith('bellfruit|') && k.endsWith('orchard-born')) n += f.flowered;
    total += n;
    return String(n);
  });
  const gens = seeds.map((s) => { const r = get(s, c); return r ? at(r, r.years).maxGen : '–'; }).join(', ');
  L.push(`| ${LABEL[c]} | ${cells.join(' | ')} | ${total} | ${gens} (whole orchard) |`);
}
L.push('');

L.push('## Where young Bellfruit got through (all four worlds together)');
L.push('');
L.push('Orchard-born seed only. Germinated → established → reached flowering.');
L.push('');
const SITES = ['under Bellfruit', 'under Lantern Pear', 'gap or deadwood', 'open'];
L.push(`| Condition | ${SITES.join(' | ')} |`);
L.push(`|---|${SITES.map(() => '---').join('|')}|`);
for (const c of CONDS) {
  const cells = SITES.map((site) => {
    let g = 0; let e = 0; let fl = 0;
    for (const s of seeds) {
      const r = get(s, c);
      const f = r && r.funnel[`bellfruit|${site}|orchard-born`];
      if (f) { g += f.germinated; e += f.established; fl += f.flowered; }
    }
    return `${g} → ${e} → ${fl}`;
  });
  L.push(`| ${LABEL[c]} | ${cells.join(' | ')} |`);
}
L.push('');

L.push('## Bellfruit seed');
L.push('');
L.push('| Condition | Seeds made | Eaten by mice | Germinated |');
L.push('|---|---|---|---|');
for (const c of CONDS) {
  let made = 0; let eaten = 0; let germ = 0;
  for (const s of seeds) {
    const f = get(s, c)?.seedFunnel['bellfruit|orchard-born'];
    if (f) { made += f.made; eaten += f.eaten; germ += f.germinated; }
  }
  L.push(`| ${LABEL[c]} | ${made} | ${pct(eaten, made)} | ${germ} (${(100 * germ / Math.max(made, 1)).toFixed(2)}%) |`);
}
L.push('');

L.push('## The sapling bank: did waiting work?');
L.push('');
L.push('Young trees that spent at least half a year suppressed. Carbon is summed over suppressed days only: production against upkeep and new leaves.');
L.push('');
L.push('| Condition | Species | Suppressed trees | Waited a year or more | Died waiting | Released | Released, then flowered | Still waiting at end | Net carbon while waiting (kg per tree-year) |');
L.push('|---|---|---|---|---|---|---|---|---|');
for (const c of ['saplings', 'caches+saplings']) {
  for (const sp of ['bellfruit', 'lantern']) {
    const a = { trees: 0, waitedYearPlus: 0, released: 0, releasedThenFlowered: 0, diedWaiting: 0, stillWaiting: 0, days: 0, P: 0, R: 0, flush: 0 };
    for (const s of seeds) {
      const v = get(s, c)?.suppressed?.[sp];
      if (v) for (const k of Object.keys(a)) a[k] += v[k];
    }
    const net = a.days > 0 ? ((a.P - a.R - a.flush) / a.days) * 336 : 0;
    L.push(`| ${LABEL[c]} | ${sp === 'bellfruit' ? 'Bellfruit' : 'Lantern Pear'} | ${a.trees} | ${a.waitedYearPlus} | ${a.diedWaiting} | ${a.released} | ${a.releasedThenFlowered} | ${a.stillWaiting} | ${net.toFixed(4)} |`);
  }
}
L.push('');

L.push('## Lantern Pear for comparison');
L.push('');
L.push(`| Condition | ${seeds.map((s) => `World ${s}`).join(' | ')} |`);
L.push(`|---|${seeds.map(() => '---').join('|')}|`);
for (const c of CONDS) {
  L.push(`| ${LABEL[c]} | ${seeds.map((s) => { const r = get(s, c); if (!r) return '–'; const b = at(r, r.years); return `${b.lanternAdultsFounding + b.lanternAdultsBorn} flowering`; }).join(' | ')} |`);
}
L.push('');
fs.writeFileSync(outFile, `${L.join('\n')}\n`);
console.log(`wrote ${outFile}`);
