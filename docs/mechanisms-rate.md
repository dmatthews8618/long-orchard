# Bellfruit renewal: how many caches should mice forget?

Four development worlds (seeds 101, 102, 103, 104), each run for 140 orchard years under four conditions on the same engine (0.2.0-dev): neither change, forgotten caches only, the sapling bank only, and both. No seed numbers were changed, and the shared orchard's seed was not run.

- **Forgotten caches**: when a mouse makes a cache, its fate is decided once. About 22% of caches are forgotten for good; mice never dig them up. The rest are found as before, more readily where mice are dense. Forgotten seed still rots and still has to meet the ordinary germination conditions.
- **Sapling bank**: a seedling or young tree in deep shade (less than half the light it would get in the open) idles. Its upkeep falls in proportion to its shade tolerance and to how deep the shade is, and it carries a smaller crown, so it grows very little. It also carries an extra risk of death, about 13% a year in the deepest shade. When light returns, it grows by the ordinary rules. A tree counts as released if it waited at least a year and later stood in good light.

## What the comparison shows

- **5% is enough.** Bellfruit renews in all four worlds: 58 to 93 orchard-born trees reach flowering over 140 years, and 13 to 19 are flowering at the end (from 9 at founding). Without forgotten caches it dies out.
- **Lantern Pear keeps its place at 5%.** It ends with 15 to 30 flowering trees, close to the 20 to 34 without the change, and the orchard still runs four to six generations deep. At 22% Lantern falls to 10 to 21. At 10% the outcome is lopsided: one world ends with only 6 Lantern Pear.
- **The gaps now do their job.** At 5%, young Bellfruit that start in gaps or on deadwood are the best route to flowering (149 of 1,936 germinated there reached flowering, against 84 of 14,756 under their parents).
- **The renewal is steady rather than rare.** Worlds differ by year 70 (7 to 14 orchard-born Bellfruit flowering), but every world renews. If the keepers want renewal rarer and more uneven, the next step would be a rate below 5%, not a different mechanism.

Recommendation: adopt forgotten caches at 5%, drop the sapling bank, and found.

## Bellfruit flowering trees

Founding trees still standing / trees born in the orchard, at year 70 and at the end.

| Condition | World 101 | World 102 | World 103 | World 104 |
|---|---|---|---|---|
| Neither (engine as before) | Y70: 1 / 1; Y140: 0 / 0 | Y70: 0 / 0; Y140: 0 / 0 | Y70: 0 / 2; Y140: 0 / 1 | Y70: 2 / 1; Y140: 0 / 0 |
| Forgotten caches 22% | Y70: 1 / 20; Y140: 0 / 27 | Y70: 0 / 18; Y140: 0 / 27 | Y70: 0 / 31; Y140: 0 / 33 | Y70: 3 / 18; Y140: 0 / 26 |
| Forgotten caches 5% | Y70: 1 / 10; Y140: 0 / 16 | Y70: 1 / 7; Y140: 0 / 13 | Y70: 0 / 14; Y140: 0 / 15 | Y70: 2 / 12; Y140: 0 / 19 |
| Forgotten caches 10% | Y70: 1 / 13; Y140: 0 / 21 | Y70: 0 / 15; Y140: 0 / 24 | Y70: 0 / 17; Y140: 0 / 26 | Y70: 3 / 18; Y140: 0 / 29 |

## Orchard-born Bellfruit that reached flowering, over the whole run

| Condition | World 101 | World 102 | World 103 | World 104 | Total | Deepest Bellfruit-bearing generation alive at end |
|---|---|---|---|---|---|---|
| Neither (engine as before) | 0 | 0 | 9 | 1 | 10 | 4, 5, 5, 5 (whole orchard) |
| Forgotten caches 22% | 122 | 125 | 170 | 129 | 546 | 5, 5, 5, 6 (whole orchard) |
| Forgotten caches 5% | 62 | 58 | 93 | 72 | 285 | 4, 5, 6, 5 (whole orchard) |
| Forgotten caches 10% | 102 | 98 | 116 | 115 | 431 | 5, 5, 4, 5 (whole orchard) |

## Where young Bellfruit got through (all four worlds together)

Orchard-born seed only. Germinated → established → reached flowering.

| Condition | under Bellfruit | under Lantern Pear | gap or deadwood | open |
|---|---|---|---|---|
| Neither (engine as before) | 1971 → 184 → 7 | 34 → 12 → 2 | 25 → 11 → 1 | 4 → 3 → 0 |
| Forgotten caches 22% | 81607 → 16009 → 241 | 4566 → 1901 → 102 | 4517 → 2382 → 170 | 712 → 399 → 33 |
| Forgotten caches 5% | 14756 → 2439 → 84 | 1128 → 482 → 36 | 1936 → 1041 → 149 | 296 → 177 → 16 |
| Forgotten caches 10% | 33703 → 6361 → 146 | 2368 → 998 → 66 | 3374 → 1832 → 199 | 456 → 247 → 20 |

## Bellfruit seed

| Condition | Seeds made | Eaten by mice | Germinated |
|---|---|---|---|
| Neither (engine as before) | 636277 | 94% | 2034 (0.32%) |
| Forgotten caches 22% | 2402963 | 82% | 91402 (3.80%) |
| Forgotten caches 5% | 1748351 | 91% | 18116 (1.04%) |
| Forgotten caches 10% | 2111994 | 89% | 39901 (1.89%) |

## The sapling bank: did waiting work?

Young trees that spent at least half a year suppressed. Carbon is summed over suppressed days only: production against upkeep and new leaves.

| Condition | Species | Suppressed trees | Waited a year or more | Died waiting | Released | Released, then flowered | Still waiting at end | Net carbon while waiting (kg per tree-year) |
|---|---|---|---|---|---|---|---|---|

## Lantern Pear for comparison

| Condition | World 101 | World 102 | World 103 | World 104 |
|---|---|---|---|---|
| Neither (engine as before) | 20 flowering | 34 flowering | 31 flowering | 29 flowering |
| Forgotten caches 22% | 13 flowering | 11 flowering | 10 flowering | 21 flowering |
| Forgotten caches 5% | 30 flowering | 20 flowering | 15 flowering | 24 flowering |
| Forgotten caches 10% | 22 flowering | 24 flowering | 33 flowering | 6 flowering |

