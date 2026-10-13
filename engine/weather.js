// Weather with memory: temperature anomalies carry over from day to day,
// wet and dry days come in runs, and occasional episodes (late frost, dry
// spell, long rain, warm spell, windstorm) bend the ordinary rules for a few
// days. Episodes only change the weather; their effects on living things
// come entirely from the ordinary ecological rules reacting to it.

import { WEATHER } from './params.js';
import { cos, log, TWO_PI, clamp, q } from './dmath.js';
import { streamFor } from './rng.js';
import { orchardTime, DAYS_PER_YEAR } from './clock.js';

export function initialWeather() {
  return { anomaly: 0, wet: false, episode: null, today: null, warmthSum: 0 };
}

export function seasonalMeanTemp(dayOfYear) {
  return WEATHER.meanTemp + WEATHER.tempAmp * cos((TWO_PI * (dayOfYear - WEATHER.warmestDay)) / DAYS_PER_YEAR);
}

export function dayLight(dayOfYear) {
  const mid = (WEATHER.lightMax + WEATHER.lightMin) / 2;
  const amp = (WEATHER.lightMax - WEATHER.lightMin) / 2;
  return mid + amp * cos((TWO_PI * (dayOfYear - WEATHER.brightestDay)) / DAYS_PER_YEAR);
}

export const EPISODE_LABELS = {
  lateFrost: 'Late frost',
  drySpell: 'Dry spell',
  longRain: 'Prolonged rain',
  warmSpell: 'Warm spell',
  windstorm: 'Windstorm',
};

// Advance the weather by one day. Mutates and returns world.weather.
export function stepWeather(world, step, events) {
  const w = world.weather;
  const t = orchardTime(step);
  const rng = streamFor(world.meta.seed, step, 'weather');
  const si = t.seasonIndex;

  // Episodes
  if (w.episode && w.episode.left <= 0) w.episode = null;
  if (!w.episode) {
    for (const [type, spec] of Object.entries(WEATHER.episodes)) {
      const p = spec.seasons[t.season] || 0;
      if (!p) continue;
      if (spec.firstDays !== undefined && t.dayOfSeason >= spec.firstDays) continue;
      if (rng.chance(p)) {
        const days = spec.days[0] + rng.int(spec.days[1] - spec.days[0] + 1);
        w.episode = { type, left: days, started: step, days };
        events.push({ type: 'weather', kind: type, text: `${EPISODE_LABELS[type]} began (${days} day${days > 1 ? 's' : ''}).` });
        break;
      }
    }
  }
  const ep = w.episode ? w.episode.type : null;

  // Temperature
  let anomaly = WEATHER.anomalyPersist * w.anomaly + rng.normal(0, WEATHER.anomalySd);
  if (ep === 'warmSpell') anomaly = Math.max(anomaly, 3.5 + rng.range(0, 2));
  if (ep === 'lateFrost') anomaly = Math.min(anomaly, -seasonalMeanTemp(t.dayOfYear) - 3 + rng.range(-1.5, 0.5));
  anomaly = clamp(anomaly, -14, 9);
  const temp = seasonalMeanTemp(t.dayOfYear) + anomaly;

  // Rain: a two-state chain, pushed by episodes
  let pWet = w.wet ? WEATHER.wetAfterWet[si] : WEATHER.wetAfterDry[si];
  if (ep === 'drySpell' || ep === 'lateFrost') pWet = 0.03;
  if (ep === 'warmSpell') pWet *= 0.4;
  if (ep === 'longRain') pWet = 0.92;
  if (ep === 'windstorm') pWet = 0.8;
  const wet = rng.chance(pWet);
  let rain = 0;
  if (wet) {
    let u = rng.next();
    if (u < 1e-9) u = 1e-9;
    rain = -WEATHER.rainMeanMm[si] * log(u);
    if (ep === 'longRain') rain *= 1.3;
    rain = Math.min(rain, 45);
  }

  // Wind
  let wind = clamp(WEATHER.windMean + rng.normal(0, 0.1) + (si === 3 ? 0.08 : 0), 0, 0.7);
  if (ep === 'windstorm') wind = 0.8 + rng.range(0, 0.2);

  const light = dayLight(t.dayOfYear) * (wet ? 0.7 : 1);

  // Warmth accumulated since the start of the year (for bee emergence)
  if (t.dayOfYear === 0) w.warmthSum = 0;
  w.warmthSum = q(w.warmthSum + Math.max(0, temp - 4));

  w.anomaly = q(anomaly);
  w.wet = wet;
  if (w.episode) w.episode.left -= 1;
  w.today = { step, temp: q(temp), rain: q(rain), wind: q(wind), light: q(light), episode: ep };
  return w.today;
}
