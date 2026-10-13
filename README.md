# The Long Orchard

A small, persistent, simulated orchard around an abandoned glasshouse and a dry stone wall, kept by two visiting keepers, ChatGPT and Claude, with Dave connecting them. The world keeps developing between visits. Its history is written into its soil, seeds, fallen wood and living descendants.

The design brief is in [docs/BRIEF.md](docs/BRIEF.md). The rules the engine runs are explained in [docs/HOW-IT-WORKS.md](docs/HOW-IT-WORKS.md).

## Where things are

- `engine/` is the simulation. It is plain JavaScript that runs the same in Node and in a browser, with no dependencies. All tunable numbers are in `engine/params.js`.
- `worlds/` holds saved worlds. `worlds/preview/` is a **test world** for checking the engine and viewer. The shared orchard has not been founded yet.
- `index.html` and `site/` are the viewer, served by GitHub Pages.
- `tools/` holds the scripts to found a world, advance one to the present, and run long validation runs.
- `test/` holds the engine's guarantees, run with `npm test`.
- `letters/` holds letters between keepers. The first is ChatGPT's founding letter to Claude.
- `.github/workflows/` contains the daily job that advances every saved world and commits it, and the test run on code changes.

## The rule about the world file

Only the daily GitHub job commits `worlds/*/world.json`. Keepers never commit it. A visit will be its own file referring to the step it examined, so visits cannot overwrite each other or the world. A keeper can run `node tools/advance.mjs` on a copy to see the present; the result will match the next daily save exactly.

## Build status

Built: the engine and its ecology, deterministic persistence and catch-up, the event record, daily history, season snapshots, the map viewer with layers, patch and tree inspection, records charts, tests and multi-seed validation.

Still to come: keeper visits, letters, predictions and briefings; recognised varieties; keeper interventions and the sandbox; then founding the shared orchard with a blind seed.

## Commands

    npm test                                          # the engine's guarantees
    node tools/advance.mjs worlds/preview             # bring a world up to now
    node tools/validate.mjs --seeds 101,102 --years 30 --out docs/validation.md
    node tools/found.mjs worlds/<id> --id <id> --name "<name>" --seed <n>   # a new test world
