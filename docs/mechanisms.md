# Bellfruit renewal: testing two mechanisms

Four development worlds (seeds 101, 102, 103, 104), each run for 140 orchard years under four conditions on the same engine (0.2.0-dev): neither change, forgotten caches only, the sapling bank only, and both. No seed numbers were changed, and the shared orchard's seed was not run.

- **Forgotten caches**: when a mouse makes a cache, its fate is decided once. About 22% of caches are forgotten for good; mice never dig them up. The rest are found as before, more readily where mice are dense. Forgotten seed still rots and still has to meet the ordinary germination conditions.
- **Sapling bank**: a seedling or young tree in deep shade (less than half the light it would get in the open) idles. Its upkeep falls in proportion to its shade tolerance and to how deep the shade is, and it carries a smaller crown, so it grows very little. It also carries an extra risk of death, about 13% a year in the deepest shade. When light returns, it grows by the ordinary rules. A tree counts as released if it waited at least a year and later stood in good light.

## What the comparison shows

All four worlds tell the same story.

- **Forgotten caches are the mechanism that matters.** Without them, Bellfruit leaves 0 to 1 flowering trees by year 140 in every world. With them, 26 to 34 orchard-born Bellfruit are flowering at year 140, and about 550 reached flowering over the four runs, against 10 without. Mice still eat 82% of Bellfruit seed (94% before), but forgotten caches lift germination from about 0.3% to nearly 4% of seed made, and they put seed into gaps, deadwood and open ground, where young trees do well.
- **The sapling bank adds almost nothing.** On its own it changes nothing (8 orchard-born Bellfruit flower in four worlds, against 10 without it). With forgotten caches it changes very little. Suppressed trees do gain a little carbon while they wait, so this is not delayed starvation. But 96 to 99% still die before light returns; with both changes on, 52 of 31,244 suppressed Bellfruit were released and went on to flower.
- **At 22% forgotten, the balance reverses.** Bellfruit becomes the dominant tree, and Lantern Pear falls from 20 to 34 flowering trees to 6 to 21. That is a rescue, not the rare and uneven renewal asked for.

Suggested next test: forgotten caches only, at lower forgetting rates (for example 5% and 10%), with the sapling bank left off. We would look for a rate where Bellfruit renews occasionally and unevenly between worlds without crowding out Lantern Pear.

## Bellfruit flowering trees

Founding trees still standing / trees born in the orchard, at year 70 and at the end.

| Condition | World 101 | World 102 | World 103 | World 104 |
|---|---|---|---|---|
| Neither (engine as before) | Y70: 1 / 1; Y140: 0 / 0 | Y70: 0 / 0; Y140: 0 / 0 | Y70: 0 / 2; Y140: 0 / 1 | Y70: 2 / 1; Y140: 0 / 0 |
| Forgotten caches only | Y70: 1 / 20; Y140: 0 / 27 | Y70: 0 / 18; Y140: 0 / 27 | Y70: 0 / 31; Y140: 0 / 33 | Y70: 3 / 18; Y140: 0 / 26 |
| Sapling bank only | Y70: 1 / 1; Y140: 0 / 0 | Y70: 0 / 1; Y140: 0 / 0 | Y70: 0 / 2; Y140: 0 / 0 | Y70: 2 / 0; Y140: 0 / 0 |
| Both | Y70: 1 / 19; Y140: 0 / 32 | Y70: 0 / 15; Y140: 0 / 26 | Y70: 0 / 32; Y140: 0 / 34 | Y70: 2 / 21; Y140: 0 / 27 |

## Orchard-born Bellfruit that reached flowering, over the whole run

| Condition | World 101 | World 102 | World 103 | World 104 | Total | Deepest Bellfruit-bearing generation alive at end |
|---|---|---|---|---|---|---|
| Neither (engine as before) | 0 | 0 | 9 | 1 | 10 | 4, 5, 5, 5 (whole orchard) |
| Forgotten caches only | 122 | 125 | 170 | 129 | 546 | 5, 5, 5, 6 (whole orchard) |
| Sapling bank only | 0 | 1 | 7 | 0 | 8 | 4, 5, 5, 5 (whole orchard) |
| Both | 131 | 120 | 157 | 142 | 550 | 5, 4, 5, 6 (whole orchard) |

## Where young Bellfruit got through (all four worlds together)

Orchard-born seed only. Germinated → established → reached flowering.

| Condition | under Bellfruit | under Lantern Pear | gap or deadwood | open |
|---|---|---|---|---|
| Neither (engine as before) | 1971 → 184 → 7 | 34 → 12 → 2 | 25 → 11 → 1 | 4 → 3 → 0 |
| Forgotten caches only | 81607 → 16009 → 241 | 4566 → 1901 → 102 | 4517 → 2382 → 170 | 712 → 399 → 33 |
| Sapling bank only | 2314 → 65 → 4 | 27 → 9 → 1 | 22 → 14 → 3 | 4 → 1 → 0 |
| Both | 80705 → 10841 → 228 | 4724 → 1680 → 92 | 5426 → 2855 → 197 | 749 → 436 → 33 |

## Bellfruit seed

| Condition | Seeds made | Eaten by mice | Germinated |
|---|---|---|---|
| Neither (engine as before) | 636277 | 94% | 2034 (0.32%) |
| Forgotten caches only | 2402963 | 82% | 91402 (3.80%) |
| Sapling bank only | 631384 | 94% | 2367 (0.37%) |
| Both | 2326268 | 82% | 91604 (3.94%) |

## The sapling bank: did waiting work?

Young trees that spent at least half a year suppressed. Carbon is summed over suppressed days only: production against upkeep and new leaves.

| Condition | Species | Suppressed trees | Waited a year or more | Died waiting | Released | Released, then flowered | Still waiting at end | Net carbon while waiting (kg per tree-year) |
|---|---|---|---|---|---|---|---|---|
| Sapling bank only | Bellfruit | 1034 | 337 | 1023 | 11 | 0 | 0 | 0.0451 |
| Sapling bank only | Lantern Pear | 11219 | 3558 | 11055 | 104 | 7 | 60 | 0.0407 |
| Both | Bellfruit | 31244 | 11513 | 30131 | 669 | 52 | 444 | 0.2525 |
| Both | Lantern Pear | 25528 | 8165 | 25209 | 247 | 16 | 72 | 0.0530 |

## Lantern Pear for comparison

| Condition | World 101 | World 102 | World 103 | World 104 |
|---|---|---|---|---|
| Neither (engine as before) | 20 flowering | 34 flowering | 31 flowering | 29 flowering |
| Forgotten caches only | 13 flowering | 11 flowering | 10 flowering | 21 flowering |
| Sapling bank only | 22 flowering | 19 flowering | 24 flowering | 34 flowering |
| Both | 12 flowering | 6 flowering | 9 flowering | 9 flowering |

