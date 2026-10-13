#!/usr/bin/env node
// Found a new world in a folder.
//
//   node tools/found.mjs worlds/test-3 --id test-3 --name "Test world 3" --seed 3
//   node tools/found.mjs worlds/orchard --id orchard --name "The Long Orchard" --kind orchard --blind-seed
//
// --blind-seed draws the seed from the operating system's random source and
// never prints or tests it, so nobody has seen the world's future before founding.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createWorld } from '../engine/index.js';
import { saveWorld, writeSnapshot } from './worldfs.mjs';

const args = process.argv.slice(2);
const dir = args.find((a) => !a.startsWith('--') && !args[args.indexOf(a) - 1]?.startsWith('--'));
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
if (!dir) { console.error('Usage: node tools/found.mjs <folder> --id <id> --name <name> [--seed N | --blind-seed] [--kind test|orchard] [--at ISO-time]'); process.exit(1); }
if (fs.existsSync(path.join(dir, 'world.json'))) {
  console.error(`${dir} already holds a world. A world is never refounded in place.`);
  process.exit(1);
}
const kind = opt('kind', 'test');
let seed;
if (args.includes('--blind-seed')) seed = crypto.randomBytes(4).readUInt32LE(0);
else seed = Number(opt('seed', NaN));
if (!Number.isFinite(seed)) { console.error('Give --seed N or --blind-seed'); process.exit(1); }
const foundedAt = opt('at', new Date(Math.floor(Date.now() / 60000) * 60000).toISOString());
const world = createWorld({ seed: seed >>> 0, foundedAt, worldId: opt('id', path.basename(dir)), name: opt('name', path.basename(dir)), kind });
const status = saveWorld(dir, world, 'founded');
writeSnapshot(dir, world);
console.log(`Founded ${status.name} (${kind}) at ${foundedAt}. Snapshot ${status.snapshotId}.`);
