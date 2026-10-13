#!/usr/bin/env node
// Advance a saved world to the present (or to a given step) and save it.
//
//   node tools/advance.mjs worlds/preview            advance to now
//   node tools/advance.mjs worlds/preview --to 500   advance to step 500
//
// Only the scheduled GitHub job should run this on the shared orchard and
// commit the result. Keepers may run it on a copy to look at the present.
import { advanceFolder } from './worldfs.mjs';

const args = process.argv.slice(2);
const dir = args.find((a) => !a.startsWith('--'));
if (!dir) {
  console.error('Usage: node tools/advance.mjs <world folder> [--to <step>]');
  process.exit(1);
}
const toIdx = args.indexOf('--to');
const toStep = toIdx >= 0 ? Number(args[toIdx + 1]) : undefined;
const t0 = Date.now();
const r = advanceFolder(dir, { toStep, note: process.env.GITHUB_ACTIONS ? 'scheduled GitHub job' : 'advance script' });
console.log(`${r.status.name}: step ${r.from} -> ${r.to} (${r.status.orchardTime}), ${r.events} events, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
console.log(`snapshot ${r.status.snapshotId}`);
