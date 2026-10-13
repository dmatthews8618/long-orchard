// Deterministic maths.
//
// The orchard must produce the same history whether it is advanced by
// GitHub's servers (Node), a keeper's sandbox, or a phone browser. Built-in
// functions such as Math.exp, Math.log and Math.cos are allowed to differ in
// their last bits between JavaScript engines, which would make histories
// drift apart. Everything here is built only from +, -, *, / and Math.sqrt,
// which IEEE-754 requires to be exactly rounded on every engine.
//
// The engine must not call Math.exp / log / pow / sin / cos / tan / atan /
// hypot / cbrt / expm1 / log1p directly. A test enforces this.

const LN2_HI = 0.6931471803691238; // high part of ln(2)
const LN2_LO = 1.9082149292705877e-10; // low part
const INV_LN2 = 1.4426950408889634;
const TWO_PI = 6.283185307179586;
const PI = 3.141592653589793;

// Exact powers of two from 2^-1074 to 2^1023, built by repeated halving/doubling.
const POW2 = new Float64Array(2098);
{
  let v = 1;
  for (let k = 0; k <= 1023; k++) { POW2[k + 1074] = v; v *= 2; }
  v = 1;
  for (let k = 0; k >= -1074; k--) { POW2[k + 1074] = v; v *= 0.5; }
}
function pow2int(k) {
  if (k > 1023) return Infinity;
  if (k < -1074) return 0;
  return POW2[k + 1074];
}

// 1/n! for the Taylor series, from exact divisions done once.
const INV_FACT = new Float64Array(18);
{
  let f = 1;
  for (let n = 0; n < 18; n++) { if (n > 0) f /= n; INV_FACT[n] = f; }
}

export function exp(x) {
  if (x !== x) return NaN;
  if (x > 709) return Infinity;
  if (x < -745) return 0;
  if (x === 0) return 1;
  // x = k ln2 + r, |r| <= ln2/2
  const k = Math.round(x * INV_LN2);
  const r = (x - k * LN2_HI) - k * LN2_LO;
  // Horner evaluation of the Taylor series for e^r, degree 15
  let sum = INV_FACT[15];
  for (let n = 14; n >= 0; n--) sum = sum * r + INV_FACT[n];
  if (k >= -1022 && k <= 1023) return sum * POW2[k + 1074];
  const k1 = Math.trunc(k / 2);
  return sum * pow2int(k1) * pow2int(k - k1);
}

export function log(x) {
  if (x !== x || x < 0) return NaN;
  if (x === 0) return -Infinity;
  if (x === Infinity) return Infinity;
  // x = m * 2^e with m in [sqrt(1/2), sqrt(2))
  let m = x;
  let e = 0;
  while (m >= 1.4142135623730951) { m *= 0.5; e++; }
  while (m < 0.7071067811865476) { m *= 2; e--; }
  // ln m = 2 atanh(s), s = (m-1)/(m+1), |s| <= 0.1716
  const s = (m - 1) / (m + 1);
  const s2 = s * s;
  let term = s;
  let sum = s;
  for (let n = 3; n <= 41; n += 2) {
    term *= s2;
    sum += term / n;
  }
  return 2 * sum + e * LN2_HI + e * LN2_LO;
}

export function pow(a, b) {
  if (b === 0) return 1;
  if (a === 0) return b > 0 ? 0 : Infinity;
  if (a < 0) {
    if (Number.isInteger(b)) {
      const r = exp(b * log(-a));
      return b % 2 === 0 ? r : -r;
    }
    return NaN;
  }
  if (b === 1) return a;
  if (b === 0.5) return Math.sqrt(a);
  if (b === 2) return a * a;
  return exp(b * log(a));
}

export function sin(x) {
  // Reduce to [-pi, pi]
  let y = x - TWO_PI * Math.floor((x + PI) / TWO_PI);
  // Further reduce to [-pi/2, pi/2] using sin(pi - y) = sin(y)
  if (y > PI / 2) y = PI - y;
  else if (y < -PI / 2) y = -PI - y;
  const y2 = y * y;
  let term = y;
  let sum = y;
  for (let n = 1; n <= 12; n++) {
    term *= -y2 / ((2 * n) * (2 * n + 1));
    sum += term;
  }
  return sum;
}

export function cos(x) {
  return sin(x + PI / 2);
}

export const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);

// Saturating response x / (x + k), 0 for x <= 0.
export const sat = (x, k) => (x <= 0 ? 0 : x / (x + k));

// Smooth logistic step, centre c, width w.
export const logistic = (x, c, w) => 1 / (1 + exp(-(x - c) / w));

// Quantise a stored value so that saving and loading are exact and every
// engine agrees: values are held to 1e-6 after every step.
export const q = (x) => Math.round(x * 1e6) / 1e6;

export { PI, TWO_PI };
