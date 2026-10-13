# Engine validation

Six development worlds (seeds 101 to 106), each run for 30 orchard years (30 real weeks of orchard time) on engine 0.1.0. None of these is the shared orchard; its seed will be drawn blind at founding and never run here. Regenerate with `node tools/validate.mjs --seeds 101,102,103,104,105,106 --years 30 --out docs/validation.md`.

## What the runs show

**Guarantees.** All ten engine tests pass: identical maths on every platform, identical history from the same seed, saving and loading changes nothing, catching up in pieces equals running straight through, inspecting changes nothing, stores stay finite and non-negative, traits stay in bounds, nutrients enter only through logged routes, and a world folder recovers from an interrupted save.

**No automated flags.** No founding collapse, no runaway growth, no permanent stasis, and no seed bank growing without limit. Copper Mason only provisions brood when flowers are within reach.

**Every species persists for 30 years in every world.** Animal numbers swing from year to year; mice in particular boom in Fruitfall and crash by late winter. Populations end the 30 years at different levels in different worlds. For example, Copper Mason ends between about 70 and 600, depending on which flowering trees stay within reach of the nests.

**A tendency to review: Lantern Pear colonises, Bellfruit rarely recruits.** In every world Lantern Pear spreads from about 7 to between 13 and 45 flowering trees over 15 to 25 years. It then levels off or falls back as the first wave ages. Bellfruit keeps most of its old stand (ending at 5 to 8 adults from 7 to 9) but establishes only 0 to 6 young trees in 30 years. Snails, shade under its own crown, frost and mice eat into almost every attempt. That is close to the brief's intent (Bellfruit's successful adults make poor conditions for their own children, and its long life means it needs few replacements), but it happens in every seed. Over a century it would likely leave Bellfruit dependent on gaps from fallen trees and forgotten mouse caches. The parameters that matter most are in `engine/params.js`: Bellfruit's `readyShare`, `germRate` and `seedlingMass`, the mouse's `cacheFindShare`, and `snailSeedlingHazard`. Worth deciding with the keepers before founding whether this is the orchard we want.

**Other things to know.**
- Deadwood accumulates for decades (about 550 kg at founding to 2,500 to 4,500 kg after 30 years) because hard wood barely rots until Threadcap reaches it. Fallen trees stay in the landscape a long time.
- Soil nutrients settle at about 14 to 15 nu per patch, close to the founding level.
- Needle Wren stays small: about 1 to 6 birds.
- The first seedling after the founding appears within the first Thaw in every world, from founding stock.

## Seed 101

| | Y1 | Y2–5 | Y6–10 | Y11–15 | Y16–20 | Y21–25 | Y26–30 |
|---|---|---|---|---|---|---|---|
| Bellfruit (living) | 13.0–26.0 | 18.0–49.0 | 13.0–71.0 | 7.00–13.0 | 6.00–10.0 | 6.00–11.0 | 6.00–7.00 |
| Bellfruit adults | 9.00–9.00 | 8.00–10.0 | 9.00–10.0 | 7.00–9.00 | 6.00–7.00 | 6.00–6.00 | 6.00–6.00 |
| Lantern Pear (living) | 8.00–34.0 | 31.0–242 | 141–418 | 292–515 | 289–562 | 203–448 | 146–411 |
| Lantern Pear adults | 7.00–7.00 | 7.00–8.00 | 6.00–10.0 | 10.0–33.0 | 32.0–38.0 | 17.0–33.0 | 16.0–20.0 |
| Copper Mason (adults+brood) | 349–1005 | 136–1113 | 96.1–357 | 179–414 | 180–419 | 169–451 | 222–493 |
| Dusk Moth (all stages) | 2124–15764 | 1220–11859 | 683–8672 | 681–5884 | 889–6656 | 647–6332 | 583–5355 |
| Thimble Mouse | 13.1–77.8 | 13.1–97.1 | 14.7–72.8 | 15.0–74.4 | 16.5–97.1 | 15.2–85.2 | 17.9–106 |
| Mossback Snail | 80.6–847 | 78.5–1455 | 60.4–1620 | 164–1395 | 303–1651 | 286–1599 | 28.0–1357 |
| Needle Wren | 0.69–4.30 | 0.58–2.77 | 0.71–3.44 | 0.83–3.76 | 0.93–4.57 | 1.24–5.22 | 1.43–6.00 |
| Stitchgrass kg | 806–2230 | 753–2497 | 772–2484 | 751–2416 | 731–2393 | 743–2384 | 721–2383 |
| Velvet Clover kg | 160–400 | 40.1–192 | 53.7–181 | 64.7–200 | 59.0–238 | 63.5–224 | 80.5–253 |
| Threadcap index | 4.34–9.09 | 7.09–10.3 | 6.57–10.1 | 4.72–8.47 | 3.48–7.75 | 5.86–12.1 | 8.49–16.7 |
| Bellfruit seed bank | 85.4–1914 | 58.1–3390 | 70.1–2742 | 20.4–2113 | 0.06–2069 | 17.0–1968 | 0.00–1670 |
| Lantern Pear seed bank | 49.0–2455 | 75.5–7140 | 1800–8258 | 2000–7645 | 2240–9356 | 2086–9716 | 1474–10368 |
| Mean nutrients | 15.0–15.9 | 14.6–15.9 | 14.5–15.2 | 14.5–15.9 | 13.7–15.4 | 13.6–14.4 | 13.9–15.0 |
| Deadwood kg | 550–600 | 412–720 | 654–1319 | 1285–1309 | 1308–2887 | 2874–3059 | 3035–3125 |

Trees born after founding that established: Bellfruit 0, Lantern Pear 93. Deepest generation: 2. Seed cohorts at end: 426.

Flags: none.

<details><summary>Notable events</summary>

- Y1: First seedling born after the founding: Lantern Pear T22 at (11,5), from seed cohort S9.
- Y4: Bellfruit T2 fell; 309 kg of wood now lies across 4 patches from (15,8).
- Y6: Bellfruit T12 fell; 38 kg of wood now lies across 2 patches from (9,8).
- Y6: Bellfruit T5 fell; 279 kg of wood now lies across 4 patches from (15,12).
- Y6: Old Lantern was brought down in wind (100/100); 208 kg of wood now lies across 4 patches from (12,4).
- Y7: Mossback Snail had a lean year: peak 250 against 1565 the year before.
- Y8: Bellfruit T36 fell; 8 kg of wood now lies across 2 patches from (10,14).
- Y9: Lantern Pear T45 fell; 7 kg of wood now lies across 2 patches from (3,7).
- Y9: Lantern Pear T19 fell; 164 kg of wood now lies across 3 patches from (2,9).
- Y9: Lantern Pear T26 fell; 11 kg of wood now lies across 2 patches from (4,16).
- Y10: Bellfruit T10 fell; 77 kg of wood now lies across 2 patches from (9,16).
- Y10: Bellfruit T29 fell; 9 kg of wood now lies across 2 patches from (6,12).
- Y10: Mossback Snail has recovered: this year's peak 1620 is back near the 1565 before its low.
- Y11: Bellfruit T95 fell; 15 kg of wood now lies across 2 patches from (15,11).
- Y13: Lantern Pear T123 fell; 9 kg of wood now lies across 2 patches from (1,8).
- Y15: Lantern Pear T67 fell; 5 kg of wood now lies across 2 patches from (1,6).
- Y16: Lantern Pear T1085 fell; 5 kg of wood now lies across 2 patches from (12,4).
- Y16: Lantern Pear T898 fell; 13 kg of wood now lies across 2 patches from (3,8).
- Y16: Lantern Pear T122 fell; 11 kg of wood now lies across 2 patches from (1,9).
- Y17: Bellfruit T4 fell; 302 kg of wood now lies across 4 patches from (11,11).
- Y17: Lantern Pear T850 fell; 6 kg of wood now lies across 2 patches from (11,3).
- Y17: Lantern Pear T848 fell; 7 kg of wood now lies across 2 patches from (13,3).
- Y17: Lantern Pear T581 fell; 7 kg of wood now lies across 2 patches from (11,5).
- Y17: The Leaning Bell was brought down in wind (86/100); 741 kg of wood now lies across 6 patches from (22,11).
- Y17: Lantern Pear T171 fell; 5 kg of wood now lies across 2 patches from (2,19).

</details>


## Seed 102

| | Y1 | Y2–5 | Y6–10 | Y11–15 | Y16–20 | Y21–25 | Y26–30 |
|---|---|---|---|---|---|---|---|
| Bellfruit (living) | 13.0–21.0 | 20.0–75.0 | 18.0–111 | 12.0–33.0 | 9.00–16.0 | 8.00–13.0 | 7.00–8.00 |
| Bellfruit adults | 8.00–9.00 | 8.00–12.0 | 12.0–12.0 | 11.0–12.0 | 8.00–11.0 | 8.00–8.00 | 7.00–8.00 |
| Lantern Pear (living) | 8.00–31.0 | 25.0–335 | 231–539 | 332–536 | 262–447 | 207–415 | 117–338 |
| Lantern Pear adults | 7.00–7.00 | 7.00–8.00 | 7.00–13.0 | 12.0–28.0 | 26.0–45.0 | 38.0–47.0 | 36.0–44.0 |
| Copper Mason (adults+brood) | 356–1116 | 207–1128 | 111–451 | 149–448 | 153–401 | 176–496 | 127–306 |
| Dusk Moth (all stages) | 1972–13725 | 1286–11361 | 789–8179 | 837–6894 | 925–7367 | 1017–7975 | 365–8489 |
| Thimble Mouse | 12.9–75.8 | 15.0–97.9 | 16.4–66.7 | 18.0–77.9 | 15.2–86.8 | 15.8–92.7 | 13.8–86.2 |
| Mossback Snail | 117–851 | 111–1236 | 207–1605 | 15.3–1043 | 82.6–1472 | 51.7–1396 | 81.8–1145 |
| Needle Wren | 0.66–4.30 | 0.56–2.76 | 0.70–3.05 | 0.70–3.34 | 0.90–4.64 | 1.31–5.76 | 1.57–6.69 |
| Stitchgrass kg | 800–2239 | 756–2456 | 748–2434 | 709–2332 | 729–2353 | 752–2350 | 724–2362 |
| Velvet Clover kg | 152–393 | 43.1–186 | 50.8–156 | 59.5–194 | 69.8–226 | 73.2–220 | 64.1–239 |
| Threadcap index | 4.30–9.10 | 7.16–10.3 | 6.47–10.1 | 4.45–9.23 | 2.25–5.87 | 0.60–2.92 | 0.06–0.59 |
| Bellfruit seed bank | 93.5–2241 | 40.3–5544 | 392–4513 | 70.3–3538 | 3.46–2525 | 4.49–2252 | 2.30–2117 |
| Lantern Pear seed bank | 53.7–2038 | 39.5–7179 | 1724–8909 | 989–8533 | 1329–6257 | 1233–6828 | 483–5964 |
| Mean nutrients | 15.2–15.8 | 14.5–15.6 | 13.7–15.0 | 13.8–14.7 | 14.2–15.0 | 14.5–15.4 | 14.5–15.2 |
| Deadwood kg | 550–600 | 397–798 | 657–863 | 811–1451 | 1451–3734 | 3731–4865 | 4865–5954 |

Trees born after founding that established: Bellfruit 0, Lantern Pear 80. Deepest generation: 2. Seed cohorts at end: 482.

Flags: none.

<details><summary>Notable events</summary>

- Y1: First seedling born after the founding: Bellfruit T22 at (16,11), from seed cohort S2.
- Y4: Bellfruit T7 fell; 401 kg of wood now lies across 5 patches from (14,15).
- Y7: Bellfruit T45 fell; 10 kg of wood now lies across 2 patches from (6,12).
- Y8: Lantern Pear T18 fell; 206 kg of wood now lies across 3 patches from (2,5).
- Y9: Bellfruit T33 fell; 13 kg of wood now lies across 2 patches from (6,12).
- Y12: Lantern Pear T186 fell; 7 kg of wood now lies across 2 patches from (2,5).
- Y12: Lantern Pear T36 fell; 11 kg of wood now lies across 2 patches from (3,7).
- Y14: Lantern Pear T135 fell; 5 kg of wood now lies across 2 patches from (1,9).
- Y14: Lantern Pear T44 fell; 15 kg of wood now lies across 2 patches from (20,7).
- Y14: Lantern Pear T51 fell; 20 kg of wood now lies across 2 patches from (20,7).
- Y14: Lantern Pear T271 fell; 6 kg of wood now lies across 2 patches from (2,4).
- Y14: Lantern Pear T15 fell; 256 kg of wood now lies across 4 patches from (15,2).
- Y14: Lantern Pear T184 fell; 9 kg of wood now lies across 2 patches from (1,5).
- Y14: Lantern Pear T20 fell; 253 kg of wood now lies across 4 patches from (3,18).
- Y14: Lantern Pear T385 fell; 5 kg of wood now lies across 2 patches from (3,4).
- Y14: Mossback Snail had a lean year: peak 135 against 926 the year before.
- Y15: Lantern Pear T154 fell; 4 kg of wood now lies across 2 patches from (4,16).
- Y16: The Leaning Bell fell; 590 kg of wood now lies across 5 patches from (22,11).
- Y16: Bellfruit T5 fell; 535 kg of wood now lies across 5 patches from (15,12).
- Y16: Lantern Pear T138 fell; 18 kg of wood now lies across 2 patches from (3,6).
- Y17: Lantern Pear T109 fell; 15 kg of wood now lies across 2 patches from (3,5).
- Y17: Bellfruit T1 fell; 741 kg of wood now lies across 6 patches from (12,9).
- Y17: Mossback Snail has recovered: this year's peak 1232 is back near the 926 before its low.
- Y18: Lantern Pear T63 fell; 15 kg of wood now lies across 2 patches from (2,4).
- Y18: Lantern Pear T60 fell; 16 kg of wood now lies across 2 patches from (2,5).

</details>


## Seed 103

| | Y1 | Y2–5 | Y6–10 | Y11–15 | Y16–20 | Y21–25 | Y26–30 |
|---|---|---|---|---|---|---|---|
| Bellfruit (living) | 13.0–30.0 | 17.0–49.0 | 20.0–55.0 | 18.0–35.0 | 10.0–20.0 | 15.0–55.0 | 14.0–27.0 |
| Bellfruit adults | 7.00–9.00 | 6.00–9.00 | 7.00–9.00 | 5.00–7.00 | 5.00–5.00 | 5.00–6.00 | 5.00–7.00 |
| Lantern Pear (living) | 8.00–35.0 | 29.0–304 | 219–510 | 310–594 | 328–592 | 350–571 | 212–486 |
| Lantern Pear adults | 7.00–7.00 | 7.00–8.00 | 8.00–13.0 | 12.0–13.0 | 11.0–21.0 | 21.0–40.0 | 38.0–45.0 |
| Copper Mason (adults+brood) | 342–1096 | 271–1059 | 191–591 | 114–375 | 84.6–314 | 86.5–382 | 209–598 |
| Dusk Moth (all stages) | 2113–16582 | 1457–14927 | 1162–8920 | 1357–13449 | 1401–10965 | 657–7951 | 259–3579 |
| Thimble Mouse | 13.0–79.0 | 13.6–105 | 13.9–74.4 | 15.1–72.9 | 12.2–63.0 | 11.9–59.2 | 12.6–63.6 |
| Mossback Snail | 306–855 | 69.8–1483 | 38.7–1249 | 217–1719 | 202–1591 | 134–1213 | 53.5–1491 |
| Needle Wren | 0.72–4.33 | 0.61–3.15 | 0.81–3.34 | 0.85–3.60 | 1.07–4.13 | 1.21–4.90 | 1.47–5.51 |
| Stitchgrass kg | 802–2225 | 731–2554 | 768–2527 | 734–2497 | 786–2483 | 780–2449 | 774–2442 |
| Velvet Clover kg | 155–399 | 31.7–188 | 57.4–175 | 58.9–180 | 52.6–138 | 55.5–165 | 67.1–181 |
| Threadcap index | 4.33–9.59 | 7.29–10.4 | 5.84–9.72 | 6.34–10.2 | 4.18–8.19 | 2.17–5.28 | 0.74–2.53 |
| Bellfruit seed bank | 94.5–3081 | 70.3–3889 | 103–2533 | 6.70–2088 | 2.77–1931 | 56.9–2144 | 21.3–1967 |
| Lantern Pear seed bank | 46.3–2667 | 41.8–8702 | 1738–11028 | 2576–12962 | 3205–12805 | 3616–13231 | 859–7211 |
| Mean nutrients | 15.0–15.6 | 14.9–15.5 | 14.2–15.3 | 14.1–14.9 | 14.2–15.0 | 14.4–15.1 | 13.9–15.1 |
| Deadwood kg | 546–943 | 883–2081 | 1807–1948 | 1925–2808 | 2768–3379 | 3379–4362 | 4361–4724 |

Trees born after founding that established: Bellfruit 6, Lantern Pear 102. Deepest generation: 2. Seed cohorts at end: 423.

Flags: none.

<details><summary>Notable events</summary>

- Y1: First seedling born after the founding: Lantern Pear T22 at (11,5), from seed cohort S9.
- Y1: Bellfruit T1 was brought down in wind (89/100); 397 kg of wood now lies across 5 patches from (12,8).
- Y2: Bellfruit T5 fell; 238 kg of wood now lies across 4 patches from (14,12).
- Y3: The Leaning Bell was brought down in wind (84/100); 615 kg of wood now lies across 5 patches from (22,11).
- Y3: Bellfruit T3 fell; 360 kg of wood now lies across 4 patches from (18,10).
- Y9: Bellfruit T62 fell; 13 kg of wood now lies across 2 patches from (10,14).
- Y10: Bellfruit T11 fell; 118 kg of wood now lies across 3 patches from (20,15).
- Y10: Mossback Snail had a lean year: peak 326 against 1124 the year before.
- Y11: Bellfruit T64 fell; 13 kg of wood now lies across 2 patches from (10,14).
- Y11: Bellfruit T48 fell; 16 kg of wood now lies across 2 patches from (6,12).
- Y11: Bellfruit T10 fell; 78 kg of wood now lies across 2 patches from (9,16).
- Y11: Mossback Snail has recovered: this year's peak 1098 is back near the 1124 before its low.
- Y12: Bellfruit T4 was brought down in wind (95/100); 645 kg of wood now lies across 6 patches from (12,12).
- Y12: Bellfruit T12 fell; 157 kg of wood now lies across 3 patches from (8,8).
- Y13: Lantern Pear T49 fell; 13 kg of wood now lies across 2 patches from (3,7).
- Y16: Bellfruit T1808 fell; 11 kg of wood now lies across 2 patches from (9,16).
- Y17: Bellfruit T1757 fell; 6 kg of wood now lies across 2 patches from (7,8).
- Y17: Bellfruit T1039 fell; 7 kg of wood now lies across 2 patches from (8,8).
- Y17: Lantern Pear T199 fell; 8 kg of wood now lies across 2 patches from (2,17).
- Y17: Bellfruit T1532 fell; 9 kg of wood now lies across 2 patches from (9,17).
- Y18: Lantern Pear T17 fell; 291 kg of wood now lies across 4 patches from (19,4).
- Y18: Bellfruit T1690 fell; 9 kg of wood now lies across 2 patches from (8,16).
- Y19: Bellfruit T1662 fell; 9 kg of wood now lies across 2 patches from (9,15).
- Y19: Bellfruit T1948 fell; 5 kg of wood now lies across 2 patches from (9,17).
- Y20: Lantern Pear T556 fell; 8 kg of wood now lies across 2 patches from (3,6).

</details>


## Seed 104

| | Y1 | Y2–5 | Y6–10 | Y11–15 | Y16–20 | Y21–25 | Y26–30 |
|---|---|---|---|---|---|---|---|
| Bellfruit (living) | 13.0–31.0 | 23.0–55.0 | 15.0–36.0 | 13.0–35.0 | 10.0–24.0 | 9.00–19.0 | 8.00–16.0 |
| Bellfruit adults | 9.00–9.00 | 8.00–12.0 | 9.00–11.0 | 9.00–9.00 | 8.00–9.00 | 7.00–8.00 | 7.00–7.00 |
| Lantern Pear (living) | 8.00–34.0 | 28.0–320 | 173–451 | 289–522 | 165–467 | 197–455 | 121–339 |
| Lantern Pear adults | 7.00–7.00 | 6.00–8.00 | 6.00–11.0 | 11.0–39.0 | 29.0–36.0 | 23.0–33.0 | 22.0–29.0 |
| Copper Mason (adults+brood) | 372–1071 | 106–1144 | 122–388 | 156–385 | 133–419 | 173–460 | 144–471 |
| Dusk Moth (all stages) | 2146–16124 | 1675–13535 | 1789–13243 | 1694–16580 | 1416–14630 | 1186–11273 | 1308–9941 |
| Thimble Mouse | 13.2–74.8 | 13.2–87.1 | 13.8–71.0 | 16.1–79.9 | 18.7–91.1 | 15.9–84.1 | 15.3–75.5 |
| Mossback Snail | 381–862 | 156–1565 | 149–1302 | 112–1629 | 249–1643 | 33.7–906 | 178–1596 |
| Needle Wren | 0.69–4.33 | 0.58–2.83 | 0.69–3.03 | 0.76–3.95 | 0.99–4.59 | 1.22–5.46 | 1.47–6.09 |
| Stitchgrass kg | 803–2223 | 749–2452 | 774–2454 | 727–2397 | 740–2386 | 757–2394 | 747–2399 |
| Velvet Clover kg | 138–391 | 43.6–169 | 53.4–179 | 71.6–221 | 74.5–220 | 80.1–228 | 89.8–252 |
| Threadcap index | 4.43–9.13 | 7.28–10.4 | 6.76–11.2 | 8.06–15.6 | 8.29–14.7 | 4.45–10.2 | 2.41–5.89 |
| Bellfruit seed bank | 86.7–2070 | 109–4047 | 139–3638 | 24.4–3950 | 58.3–3731 | 121–3445 | 121–3253 |
| Lantern Pear seed bank | 46.0–1909 | 33.9–6616 | 1301–6213 | 1300–9928 | 2523–9457 | 1493–8708 | 1025–6935 |
| Mean nutrients | 15.0–15.6 | 14.9–15.7 | 14.7–15.7 | 14.5–15.3 | 14.5–15.5 | 15.0–16.1 | 14.6–15.6 |
| Deadwood kg | 546–600 | 527–757 | 578–930 | 863–1883 | 1878–2595 | 2572–3528 | 3527–4269 |

Trees born after founding that established: Bellfruit 1, Lantern Pear 62. Deepest generation: 2. Seed cohorts at end: 659.

Flags: none.

<details><summary>Notable events</summary>

- Y1: First seedling born after the founding: Lantern Pear T22 at (14,3), from seed cohort S10.
- Y2: Bellfruit T1 fell; 230 kg of wood now lies across 4 patches from (12,9).
- Y5: Bellfruit T49 fell; 4 kg of wood now lies across 2 patches from (10,14).
- Y6: Lantern Pear T19 fell; 179 kg of wood now lies across 3 patches from (2,9).
- Y6: Lantern Pear T18 fell; 191 kg of wood now lies across 2 patches from (2,5).
- Y6: Mossback Snail had a lean year: peak 528 against 1565 the year before.
- Y8: Bellfruit T11 fell; 57 kg of wood now lies across 2 patches from (21,15).
- Y8: Mossback Snail has recovered: this year's peak 1302 is back near the 1565 before its low.
- Y9: Bellfruit T55 fell; 12 kg of wood now lies across 2 patches from (6,12).
- Y11: Bellfruit T6 fell; 278 kg of wood now lies across 4 patches from (17,13).
- Y11: Bellfruit T47 fell; 7 kg of wood now lies across 2 patches from (15,16).
- Y12: Bellfruit T5 fell; 403 kg of wood now lies across 5 patches from (15,11).
- Y12: Bellfruit T64 fell; 16 kg of wood now lies across 2 patches from (15,16).
- Y12: Mossback Snail had a lean year: peak 438 against 1426 the year before.
- Y13: Bellfruit T37 fell; 17 kg of wood now lies across 2 patches from (6,12).
- Y13: Lantern Pear T175 fell; 6 kg of wood now lies across 2 patches from (1,5).
- Y13: Lantern Pear T475 fell; 5 kg of wood now lies across 2 patches from (2,8).
- Y13: Lantern Pear T127 fell; 10 kg of wood now lies across 2 patches from (1,4).
- Y13: Bellfruit T66 fell; 13 kg of wood now lies across 2 patches from (15,16).
- Y14: Lantern Pear T118 fell; 5 kg of wood now lies across 2 patches from (3,7).
- Y14: Lantern Pear T16 fell; 275 kg of wood now lies across 4 patches from (7,4).
- Y14: Mossback Snail has recovered: this year's peak 1500 is back near the 1426 before its low.
- Y15: Lantern Pear T125 fell; 19 kg of wood now lies across 2 patches from (1,6).
- Y15: Lantern Pear T88 fell; 4 kg of wood now lies across 2 patches from (3,7).
- Y15: Lantern Pear T27 fell; 4 kg of wood now lies across 2 patches from (14,3).

</details>


## Seed 105

| | Y1 | Y2–5 | Y6–10 | Y11–15 | Y16–20 | Y21–25 | Y26–30 |
|---|---|---|---|---|---|---|---|
| Bellfruit (living) | 13.0–33.0 | 24.0–86.0 | 16.0–54.0 | 15.0–33.0 | 20.0–42.0 | 23.0–61.0 | 16.0–57.0 |
| Bellfruit adults | 9.00–9.00 | 8.00–10.0 | 10.0–11.0 | 10.0–11.0 | 9.00–10.0 | 8.00–9.00 | 7.00–8.00 |
| Lantern Pear (living) | 8.00–38.0 | 32.0–291 | 191–367 | 216–491 | 354–570 | 333–580 | 229–501 |
| Lantern Pear adults | 8.00–8.00 | 7.00–8.00 | 7.00–10.0 | 9.00–21.0 | 17.0–21.0 | 17.0–21.0 | 19.0–33.0 |
| Copper Mason (adults+brood) | 346–1078 | 95.9–1076 | 165–462 | 150–460 | 99.2–502 | 94.8–182 | 71.8–184 |
| Dusk Moth (all stages) | 2097–17646 | 2371–18252 | 1217–13253 | 1166–9059 | 885–7780 | 450–4882 | 231–3062 |
| Thimble Mouse | 13.3–78.5 | 13.8–101 | 16.8–85.8 | 19.5–93.9 | 16.4–78.0 | 13.9–66.7 | 11.9–66.3 |
| Mossback Snail | 366–880 | 81.2–1535 | 75.4–1412 | 153–1829 | 141–1648 | 34.1–1527 | 77.2–1408 |
| Needle Wren | 0.68–4.33 | 0.56–2.64 | 0.63–3.18 | 0.77–4.01 | 0.95–4.07 | 1.02–4.54 | 1.24–5.52 |
| Stitchgrass kg | 789–2177 | 720–2432 | 748–2432 | 784–2389 | 760–2383 | 771–2391 | 775–2385 |
| Velvet Clover kg | 155–402 | 48.9–173 | 54.9–183 | 62.6–198 | 65.9–180 | 61.2–177 | 66.4–194 |
| Threadcap index | 4.18–9.27 | 7.01–10.0 | 6.50–9.95 | 4.95–8.49 | 2.61–6.36 | 0.54–2.66 | 0.08–0.54 |
| Bellfruit seed bank | 90.9–3032 | 198–3860 | 84.7–4189 | 41.6–3145 | 71.5–2935 | 246–2361 | 274–1592 |
| Lantern Pear seed bank | 48.8–2719 | 87.0–6647 | 1329–7271 | 1724–10145 | 2722–13641 | 4488–13881 | 2235–11190 |
| Mean nutrients | 15.0–15.6 | 14.5–15.3 | 14.4–15.5 | 13.9–14.5 | 13.8–14.5 | 14.0–15.4 | 14.3–15.7 |
| Deadwood kg | 547–600 | 355–547 | 311–798 | 720–1637 | 1635–1733 | 1732–3110 | 3110–4409 |

Trees born after founding that established: Bellfruit 3, Lantern Pear 126. Deepest generation: 2. Seed cohorts at end: 458.

Flags: none.

<details><summary>Notable events</summary>

- Y1: First seedling born after the founding: Bellfruit T22 at (10,14), from seed cohort S3.
- Y6: Mossback Snail had a lean year: peak 322 against 1389 the year before.
- Y7: Lantern Pear T15 fell; 142 kg of wood now lies across 3 patches from (15,2).
- Y8: Bellfruit T4 fell; 379 kg of wood now lies across 5 patches from (11,12).
- Y9: Lantern Pear T37 fell; 6 kg of wood now lies across 2 patches from (4,16).
- Y9: Bellfruit T66 fell; 11 kg of wood now lies across 2 patches from (6,12).
- Y10: Bellfruit T51 fell; 8 kg of wood now lies across 2 patches from (10,14).
- Y10: Mossback Snail has recovered: this year's peak 1412 is back near the 1389 before its low.
- Y12: Bellfruit T3 fell; 356 kg of wood now lies across 5 patches from (19,10).
- Y12: Bellfruit T50 fell; 9 kg of wood now lies across 2 patches from (6,12).
- Y13: Bellfruit T6 was brought down in wind (86/100); 556 kg of wood now lies across 5 patches from (18,12).
- Y14: Lantern Pear T41 fell; 14 kg of wood now lies across 2 patches from (3,7).
- Y15: Lantern Pear T578 fell; 5 kg of wood now lies across 2 patches from (14,2).
- Y15: Lantern Pear T281 fell; 5 kg of wood now lies across 2 patches from (14,1).
- Y15: Lantern Pear T286 fell; 9 kg of wood now lies across 2 patches from (14,3).
- Y16: Lantern Pear T520 fell; 9 kg of wood now lies across 2 patches from (14,2).
- Y16: Lantern Pear T307 fell; 9 kg of wood now lies across 2 patches from (15,2).
- Y17: Lantern Pear T538 fell; 7 kg of wood now lies across 1 patch from (1,5).
- Y18: Lantern Pear T708 fell; 7 kg of wood now lies across 2 patches from (15,3).
- Y18: Lantern Pear T759 fell; 7 kg of wood now lies across 2 patches from (2,3).
- Y18: Lantern Pear T91 fell; 14 kg of wood now lies across 2 patches from (16,2).
- Y18: Lantern Pear T533 fell; 6 kg of wood now lies across 2 patches from (15,3).
- Y18: Lantern Pear T300 fell; 17 kg of wood now lies across 2 patches from (14,2).
- Y20: Lantern Pear T355 fell; 13 kg of wood now lies across 2 patches from (15,2).
- Y20: Lantern Pear T1193 fell; 5 kg of wood now lies across 2 patches from (3,4).

</details>


## Seed 106

| | Y1 | Y2–5 | Y6–10 | Y11–15 | Y16–20 | Y21–25 | Y26–30 |
|---|---|---|---|---|---|---|---|
| Bellfruit (living) | 11.0–22.0 | 14.0–39.0 | 11.0–20.0 | 11.0–17.0 | 9.00–15.0 | 7.00–12.0 | 7.00–11.0 |
| Bellfruit adults | 9.00–9.00 | 8.00–10.0 | 9.00–10.0 | 8.00–9.00 | 7.00–8.00 | 7.00–8.00 | 7.00–7.00 |
| Lantern Pear (living) | 8.00–32.0 | 24.0–182 | 132–277 | 188–306 | 196–346 | 124–260 | 70.0–190 |
| Lantern Pear adults | 7.00–7.00 | 4.00–8.00 | 4.00–7.00 | 7.00–25.0 | 25.0–37.0 | 19.0–37.0 | 13.0–19.0 |
| Copper Mason (adults+brood) | 354–1081 | 225–1085 | 205–491 | 172–461 | 197–496 | 231–537 | 284–611 |
| Dusk Moth (all stages) | 2079–14576 | 1170–11160 | 1010–7988 | 954–7574 | 532–4166 | 457–4298 | 292–3580 |
| Thimble Mouse | 12.6–70.4 | 16.8–99.2 | 16.9–84.0 | 14.9–69.1 | 14.8–73.3 | 11.3–76.7 | 10.9–73.5 |
| Mossback Snail | 332–866 | 42.9–1385 | 140–1326 | 131–1555 | 87.2–1300 | 148–1182 | 26.1–1009 |
| Needle Wren | 0.68–4.33 | 0.57–2.64 | 0.70–2.82 | 0.84–3.30 | 0.91–4.06 | 1.09–4.33 | 1.21–4.88 |
| Stitchgrass kg | 792–2227 | 702–2435 | 779–2440 | 777–2484 | 775–2477 | 730–2419 | 743–2408 |
| Velvet Clover kg | 152–386 | 59.9–187 | 64.9–215 | 58.6–171 | 61.4–198 | 68.9–223 | 82.7–239 |
| Threadcap index | 4.22–9.30 | 7.00–10.4 | 6.39–10.2 | 4.47–8.72 | 2.38–5.66 | 0.41–2.69 | 0.04–0.48 |
| Bellfruit seed bank | 108–3585 | 87.4–3373 | 14.4–2833 | 14.7–2507 | 10.4–2289 | 5.78–2194 | 3.62–1263 |
| Lantern Pear seed bank | 48.7–2154 | 41.4–5359 | 569–4835 | 970–6122 | 1164–7494 | 330–4578 | 72.7–2417 |
| Mean nutrients | 15.0–15.6 | 14.6–15.3 | 14.2–15.4 | 13.9–14.9 | 13.6–14.5 | 13.8–15.2 | 14.6–15.5 |
| Deadwood kg | 568–613 | 424–808 | 779–1673 | 1650–1838 | 1826–2857 | 2855–3260 | 3260–3675 |

Trees born after founding that established: Bellfruit 0, Lantern Pear 52. Deepest generation: 2. Seed cohorts at end: 175.

Flags: none.

<details><summary>Notable events</summary>

- Y1: First seedling born after the founding: Lantern Pear T22 at (8,6), from seed cohort S13.
- Y1: Bellfruit T10 fell; 20 kg of wood now lies across 2 patches from (10,16).
- Y4: Bellfruit T3 fell; 281 kg of wood now lies across 4 patches from (18,9).
- Y5: Bellfruit T13 fell; 11 kg of wood now lies across 2 patches from (19,6).
- Y5: Lantern Pear T20 fell; 147 kg of wood now lies across 3 patches from (3,18).
- Y5: Mossback Snail had a lean year: peak 277 against 1149 the year before.
- Y6: Lantern Pear T21 fell; 19 kg of wood now lies across 2 patches from (5,6).
- Y6: Lantern Pear T15 fell; 130 kg of wood now lies across 3 patches from (15,2).
- Y8: Lantern Pear T18 fell; 186 kg of wood now lies across 3 patches from (2,5).
- Y9: Bellfruit T125 fell; 5 kg of wood now lies across 2 patches from (6,12).
- Y9: The Leaning Bell was brought down in wind (85/100); 670 kg of wood now lies across 6 patches from (22,11).
- Y9: Mossback Snail has recovered: this year's peak 1326 is back near the 1149 before its low.
- Y10: Bellfruit T54 fell; 6 kg of wood now lies across 2 patches from (6,12).
- Y11: Lantern Pear T19 fell; 188 kg of wood now lies across 3 patches from (2,9).
- Y12: Lantern Pear T27 fell; 14 kg of wood now lies across 2 patches from (4,16).
- Y14: Lantern Pear T90 fell; 15 kg of wood now lies across 2 patches from (2,4).
- Y14: Lantern Pear T31 fell; 16 kg of wood now lies across 2 patches from (4,16).
- Y15: Lantern Pear T245 fell; 5 kg of wood now lies across 2 patches from (1,9).
- Y16: Bellfruit T7 fell; 646 kg of wood now lies across 6 patches from (13,15).
- Y16: Lantern Pear T809 fell; 7 kg of wood now lies across 2 patches from (1,10).
- Y17: Lantern Pear T542 fell; 7 kg of wood now lies across 2 patches from (2,19).
- Y18: Lantern Pear T460 fell; 5 kg of wood now lies across 2 patches from (16,1).
- Y18: Bellfruit T1 fell; 315 kg of wood now lies across 4 patches from (13,9).
- Y18: Lantern Pear T252 fell; 21 kg of wood now lies across 2 patches from (2,19).
- Y18: Lantern Pear T572 fell; 4 kg of wood now lies across 2 patches from (1,8).

</details>

