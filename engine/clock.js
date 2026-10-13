// Orchard time.
//
// One orchard year = 336 orchard days = 7 real days.
// One orchard day = 30 real minutes (one simulation step).
// Four equal seasons of 84 days each.
// 48 steps happen per real day.

export const DAYS_PER_YEAR = 336;
export const DAYS_PER_SEASON = 84;
export const STEP_SECONDS = 1800; // 30 real minutes per orchard day

export const SEASONS = [
  {
    name: 'Thaw',
    plain: 'Early spring. Cold nights ease, soil warms, seeds that have had their winter chill begin to germinate, leaves open late in the season.',
  },
  {
    name: 'Blossom',
    plain: 'Late spring and early summer. Trees flower, pollinators are busiest, fruit sets, ground plants grow fastest.',
  },
  {
    name: 'Fruitfall',
    plain: 'Late summer and autumn. Fruit ripens and drops, mice gather and cache seeds, leaves fall at the end of the season.',
  },
  {
    name: 'Still',
    plain: 'Winter. Trees are bare, growth stops, seeds collect the chilling some of them need, deadwood keeps slowly rotting.',
  },
];

export function orchardTime(step) {
  const year = Math.floor(step / DAYS_PER_YEAR) + 1;
  const dayOfYear = step % DAYS_PER_YEAR; // 0..335
  const seasonIndex = Math.floor(dayOfYear / DAYS_PER_SEASON);
  const dayOfSeason = dayOfYear % DAYS_PER_SEASON; // 0..83
  return {
    step,
    year,
    dayOfYear,
    seasonIndex,
    season: SEASONS[seasonIndex].name,
    dayOfSeason,
    label: `Year ${year}, ${SEASONS[seasonIndex].name} day ${dayOfSeason + 1}`,
  };
}

// The step the world should have reached at a real moment.
export function stepAt(foundedAtIso, nowMs) {
  const founded = Date.parse(foundedAtIso);
  const elapsed = Math.floor((nowMs - founded) / 1000);
  if (elapsed < 0) return 0;
  return Math.floor(elapsed / STEP_SECONDS);
}

export function realTimeOfStep(foundedAtIso, step) {
  return new Date(Date.parse(foundedAtIso) + step * STEP_SECONDS * 1000).toISOString();
}
