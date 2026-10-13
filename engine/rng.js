// Reproducible randomness.
//
// Randomness is never "consumed" from a shared running stream. Instead every
// (world seed, step, purpose) gets its own generator, made by hashing those
// three things together. Consequences:
//   - Viewing, rendering or inspecting the world can never change its future.
//   - Advancing in one long run or many short runs gives identical results.
//   - Saving and loading need no random-state bookkeeping.
// Only integer operations (Math.imul, shifts) are used, which every
// JavaScript engine performs identically.

import { log, cos, TWO_PI } from './dmath.js';

function hashString(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function mix(a, b) {
  let h = (a ^ Math.imul(b, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

export class Rng {
  constructor(seedInt) {
    // sfc32 state from a single 32-bit seed via splitmix-style expansion
    let s = seedInt >>> 0;
    const next = () => {
      s = (s + 0x9e3779b9) >>> 0;
      let z = s;
      z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
      z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
      return (z ^ (z >>> 16)) >>> 0;
    };
    this.a = next(); this.b = next(); this.c = next(); this.d = next();
    for (let i = 0; i < 12; i++) this.u32();
  }
  u32() {
    const t = (((this.a + this.b) >>> 0) + this.d) >>> 0;
    this.d = (this.d + 1) >>> 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) >>> 0;
    this.c = ((this.c << 21) | (this.c >>> 11)) >>> 0;
    this.c = (this.c + t) >>> 0;
    return t >>> 0;
  }
  // Uniform in [0, 1)
  next() { return this.u32() / 4294967296; }
  range(lo, hi) { return lo + (hi - lo) * this.next(); }
  int(n) { return Math.floor(this.next() * n); }
  chance(p) { return this.next() < p; }
  normal(mean = 0, sd = 1) {
    let u = this.next();
    if (u < 1e-12) u = 1e-12;
    const v = this.next();
    return mean + sd * Math.sqrt(-2 * log(u)) * cos(TWO_PI * v);
  }
  // Round an expected (non-negative) count to an integer without bias:
  // floor(x) plus one more with probability equal to the fraction.
  round(x) {
    if (!(x > 0)) return 0;
    const f = Math.floor(x);
    return f + (this.next() < x - f ? 1 : 0);
  }
  pick(arr) { return arr[this.int(arr.length)]; }
  // Index chosen with probability proportional to weights.
  weighted(weights) {
    let total = 0;
    for (const w of weights) total += w > 0 ? w : 0;
    if (total <= 0) return -1;
    let r = this.next() * total;
    for (let i = 0; i < weights.length; i++) {
      const w = weights[i] > 0 ? weights[i] : 0;
      if (r < w) return i;
      r -= w;
    }
    return weights.length - 1;
  }
}

// A generator unique to this world, this step and this purpose.
export function streamFor(worldSeed, step, purpose) {
  return new Rng(mix(mix(worldSeed >>> 0, step >>> 0), hashString(purpose)));
}

export function seedFromText(text) {
  return mix(hashString(text), 0x2545f491);
}

export { hashString };
