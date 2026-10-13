# How the Orchard Works

This is a plain account of the rules the engine actually runs. Every number mentioned lives in `engine/params.js`, with its unit beside it. Where something is simplified, it says so.

## Time

One orchard year passes every seven real days. A year has 336 orchard days, so each orchard day is 30 real minutes, and 48 orchard days pass in a real day.

The four seasons are equal, 84 days each:

- **Thaw** is early spring. Soil warms, chilled seeds can wake, and leaves open from about day 29.
- **Blossom** is late spring into summer. Bellfruit flowers from about Blossom day 11. Bees and moths are busiest, fruit sets, and ground plants grow fastest.
- **Fruitfall** is late summer and autumn. Fruit ripens and drops, mice gather and cache seeds, and leaves fall in the last month.
- **Still** is winter. Trees are bare, ground plants die back to their roots, seeds collect the cold they need, and deadwood keeps rotting.

Lantern Pear flowers late in Thaw, before Bellfruit, so the two trees rarely share pollinators at the same moment.

The engine advances one orchard day at a time. It never skips days, even after a long absence, so frosts, storms and seed deaths during an absence still happen.

## Persistence

The world's state lives in the GitHub repository, in `worlds/<id>/world.json`. Once a day a scheduled GitHub job runs the engine up to the present, appends the day-by-day measurements and events, and commits the result. That job is the only thing that writes the world.

When you open the page, your browser loads the saved state and runs the same engine forward to the present. The engine uses only arithmetic that every computer performs identically. It also gives every day its own random numbers, generated from the world's seed and the day number. So your browser's version of today is exactly what the saved record will say after the next daily save. The page tells you how many days it brought forward.

Looking at the orchard never changes it. Inspecting, drawing and reading draw no random numbers and alter nothing.

The fixed ground (walls, soils and slopes) is rebuilt from the world's seed each time the world is loaded, so it is not stored in every save.

## The ground

The map is 32 × 24 patches, each 3 m × 3 m. The Glasshouse floor is in the north, the West Wall runs down the west side, the land falls gently to the South Opening, and East Hollow is a shallow basin that collects water.

Each patch has fixed properties: elevation, soil depth, how much water the soil can hold, drainage, exposure to wind and cold, shelter warmth, baseline fertility, and cracks where Copper Mason can nest. It also has changing stores: soil water, standing water, available nutrients, leaf litter, hard and softened deadwood, Threadcap, Stitchgrass, Velvet Clover, fallen fruit, other invertebrates, and the animals present.

## Water

Rain soaks in. The broken glasshouse roof lets in about half of it. Water beyond what the soil can hold runs to the lowest neighbouring patch or stands on the surface; the open south and east edges let surface water out. Plants take water in proportion to their leaf area and the day's evaporative demand. As soil dries, extraction gets harder and plants are stressed. Bare, wet soil also loses water to evaporation; ground cover, litter and shade reduce that. Water above a patch's field capacity drains away over the following days.

## Nutrients

Available nutrients are a single pool per patch, an index rather than a named chemical. They enter only through three logged routes: a small daily input from rain and dust, nitrogen fixed by Velvet Clover, and nutrients released by decomposition. They leave by leaching in drainage and by plant uptake. A keeper intervention that added nutrients would be logged too. The world's ledger records every input and output. A test checks that the pool never grows beyond what the logged inputs allow.

Richer ground grows plants faster even when the supply is not running out. Poor ground slows them.

## Trees

Bellfruit and Lantern Pear trees are individuals. Each has wood, leaves and a reserve of stored food.

Each day a tree produces new growth from its leaves, in proportion to the light reaching its crown, warmth, soil water and nutrients. It pays upkeep on its wood and leaves; upkeep rises with temperature. Leaves are grown in spring from reserves and dropped in autumn as litter. Fruit is paid for before anything else. Surplus fills the reserve, and once the reserve is full, the rest becomes new wood.

Shade comes from clearly taller trees whose crowns overlap. Trees of nearly equal height share the light. Bellfruit casts dense shade (that is its central tension: its own seedlings struggle beneath it). Lantern Pear's crown is more open.

A tree's condition is how full its reserve is, smoothed over time. Trees in poor condition flower less and are more likely to die. A tree that keeps running out of reserves dies standing. Dead trees stand as snags until they fall. Storms can bring down large, exposed, weak or ailing trees. A fallen tree becomes hard deadwood along the line of its fall, which changes that ground for years.

Seedlings are vulnerable: snails graze them, frost kills them, drought and shade starve them, and dense Stitchgrass takes their water. A seedling still alive and large enough after a year becomes an established young tree. It flowers once it is old enough (an inherited trait) and large enough.

Every living tree carries a diagnosis of what is limiting it today: light, water, nutrients or warmth. Light is judged against open sky on the same day, so cloud and season are not mistaken for shade. The patch and tree views show this.

## Flowers and pollination

Adult trees open flowers over about two and a half weeks, starting on a day set by the species and shifted by the tree's inherited flowering time. Open flowers fade after a few days and a hard frost kills them.

Copper Mason bees fly in warm, dry weather from nests in the wall and the glasshouse frame. They spread their visits over flowers within about eight patches (24 m), favouring nearer and richer patches. A Bellfruit outside their reach can flower well and set little seed. Dusk Moths fly on cooler days, start earlier in the year, and pollinate less per visit.

Each visit may pollinate an open flower. Some pollen comes from the same tree. Bellfruit sets almost no seed from its own pollen, while Lantern Pear sets some, and even a little from unvisited fading flowers. Pollen from other trees is credited to those trees in proportion to their nearby open flowers, so every seed cohort carries a record of its likely fathers.

## Fruit and seeds

Pollinated flowers become developing fruit. If the tree cannot pay for all of it, some is shed. Ripe fruit falls under the crown during Fruitfall, carrying seeds. Underfilled fruit carries fewer viable seeds.

Seeds are tracked in cohorts. A cohort is a group of seeds sharing a place, a mother, a route there (fell, cached by mice, founding stock, planted by a keeper), a year and an origin. Each cohort records its mother, the shares of its likely fathers (the four largest, plus "other"), and how many viable seeds remain. Seeds lose viability every day, faster on the surface than buried. Surface seeds are buried by litter within about two months. Once a season, fractions of a seed left in a patch are pooled into that patch's largest cohort of the same species; their exact parentage is given up.

Dormancy works through winter chilling. A seed must spend enough days below 5 °C over winter (Bellfruit about 55 days, Lantern Pear about 35). Even then only a share of chilled seeds wakes each spring: about a third for Bellfruit and three fifths for Lantern Pear. The rest stay dormant until a later winter. Woken seeds can germinate from Thaw day 22 to Blossom day 16, depending on soil moisture, warmth, light at the ground and the seedbed. Softened deadwood and bare soil make good seedbeds; dense Stitchgrass, thick litter and hard wood make poor ones. Seeds that are awake but don't germinate by Blossom day 16 go back to sleep.

Failing to germinate, germinating and dying, and establishing are separate outcomes, and each is counted. If too many seedlings already crowd a patch, a germinating seed dies within days; that is counted as "germinated, crowded out".

## Inheritance

Each tree has eight inherited traits: flowering time, fruit investment, seed size, shade tolerance, drought tolerance, cold tolerance, mature size, and age at first flowering. Each has a cost:

- More fruit means less growth and less in reserve.
- Bigger seeds make sturdier seedlings with more stored food, but fewer seeds per fruit.
- Shade tolerance lets a tree grow in less light but lowers its growth in full sun.
- Drought tolerance softens water stress but lowers growth when water is plentiful.
- Cold tolerance resists frost and winter damage but raises upkeep.
- A larger mature size catches more light but needs more water and upkeep.
- Flowering younger diverts effort from growth sooner.

A seedling's traits are the average of its mother and its father (drawn from the cohort's pollen record), plus a small random variation within fixed bounds. Self-pollinated seedlings vary less and germinate less well. Traits cannot drift beyond their bounds, and no direction is favoured in general. Whatever is favoured comes from where and how trees live.

Recognising new varieties, rather than individual variation, is not built yet.

## Ground plants

Stitchgrass and Velvet Clover are tracked as biomass per patch (up to 4 kg at full cover). Stitchgrass grows fast in sun and on fertile ground and spreads quickly into open ground. Clover tolerates shade, fixes its own nitrogen (so poor soil slows it less), and dies back less in winter, but snails, moth larvae and mice prefer to eat it. Both die back in Still and regrow from their roots in spring. Dense Stitchgrass shades and out-competes tree seedlings for water.

## Animals

Animals are local populations: estimated numbers per patch that move between neighbouring patches. They are not individuals.

- **Copper Mason**: brood overwinters in nest cracks and emerges once spring warmth has added up (or by Blossom day 32 at the latest). Adults live a few weeks. The pollen they gather provisions next year's brood, limited by nest cracks. A bad season of flowers within reach means fewer bees next year.
- **Dusk Moth**: pupae overwinter in litter (better sheltered in thick litter) and adults fly from early Thaw. Eggs are laid on ground plants and larvae eat them, preferring clover. All larvae pupate at the start of Fruitfall.
- **Thimble Mouse**: eats fallen fruit first, then seeds, clover and invertebrates. In Fruitfall and early Still it gathers surface seeds, eating some and caching most in covered ground nearby; it avoids crossing bare ground. In lean months it digs up caches but finds only a small share of a cache each day, so many caches are forgotten, and forgotten caches can germinate. Numbers rise with food and are capped by shelter.
- **Mossback Snail**: active on damp, mild days. It eats ground plants (preferring clover) and small seedlings, and helps break down litter. It dies in dry spells unless sheltered by litter and deadwood, so East Hollow and deadwood-rich ground suit it.
- **Needle Wren**: forages over its patch and the eight around it for moth larvae and other invertebrates. Its numbers are capped by woody cover (canopy and deadwood) and it breeds when well fed.
- **Other invertebrates**: a visible food index per patch, produced by ground plants, leaves, litter and deadwood. Litter and deadwood keep some available in cold weather. Wrens and mice eat it. It is not an invisible subsidy: it appears in the patch view and the records.

## Decomposition and Threadcap

Leaf litter rots slowly by itself and much faster where Threadcap is established. Hard deadwood barely changes without Threadcap; with it, wood softens, and softened wood then rots away. Rotting releases nutrients in proportion to what was consumed, so nothing is created from nothing. Decay runs fastest when the ground is moist but not waterlogged, and when it is warm.

Threadcap grows where there is litter and wood to consume, dies back where there isn't, and creeps into neighbouring patches that hold suitable material. A fallen tree therefore changes its ground in stages: shade gone at once, hard wood for years, softening wood that becomes a nursery for seedlings, and then a pulse of nutrients.

## Weather

Temperature follows a seasonal curve, with anomalies that carry over from day to day, so warm and cold spells last. Wet and dry days come in runs. Day length follows the season, and cloud dims the light.

Occasionally an episode bends the weather for a few days: a late frost in early Blossom, a dry spell, a long rain, a warm spell, or a windstorm. An episode changes only the weather. Its effects come from the ordinary rules: frost kills open flowers and small seedlings, a dry spell stresses thin soils, wind tests weak trees. When an episode ends, the record notes the damage it caused.

The engine keeps no forecast. Future weather is not decided until its day is simulated.

## The record

The event record notes things worth knowing, not every mouthful: named or large trees dying or falling, the first seedling after the founding, seeds germinating after two or more winters, trees establishing, a species establishing in a named place for the first time, a tree born after the founding reaching flowering age, a population disappearing or reappearing, a lean year and a recovery, and weather episodes with their damage. These are recorded mechanisms. Explanations of why something happened belong in keepers' notes unless the engine's own diagnostics show it.

Measurements are written for every orchard day in `history/` (the columns and their units are listed in `engine/records.js`). A light map snapshot is written at the start of every season, and the season slider on the map uses these.

## Units

- Trees are individuals.
- Seeds are cohort totals of viable seeds (fractions allowed).
- Animals are estimated numbers per patch, summed for the whole orchard.
- Stitchgrass, clover, litter, deadwood and fruit are kg of dry biomass.
- Soil water is mm, or a share of what the soil can hold.
- Nutrients are "nu", an index.
- Threadcap and other invertebrates are indices.

## Known simplifications

- Animals are population estimates, not individuals.
- Nutrients are one combined pool, not separate chemicals.
- Ground plants have no seed bank; they spread from neighbouring patches and regrow from roots.
- Pollination is estimated each day from visits and open flowers, not followed flower by flower.
- Fathers beyond the four largest in a cohort are pooled as "other".
- Roots are assumed to sit under each tree's crown.
- There are no people, fungal diseases, or animals beyond the six named.

## What is not built yet

This is the first stage of the build. The engine, the map, the records and the test world are in place. Still to come: keeper identities, visits, letters, structured predictions, the copy-able keeper briefing, recognised varieties, keeper interventions, the experiment sandbox, and the founding of the shared orchard itself. The founding seed will be drawn blind at that point and never run in advance.
