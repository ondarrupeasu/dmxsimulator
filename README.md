# DMXSimulatoR

Educational DMX lighting simulator — **learn by doing**. Patch a DMX universe,
program fixtures on an Avolites-inspired surface, and see the result in a
visualizer. A pure simulator: no real hardware output (no Art-Net/sACN/USB-DMX)
in v1 — the visualizer *is* the output.

> Sibling product (later phase): **LightDesignR**, the desktop line with real
> Art-Net/sACN control. This PWA is the educational simulator.

## Stack

- React + Vite + TypeScript, PWA (installable, offline), deployable to GitHub Pages.
- Zustand for show state (patch + programmer), persisted to localStorage.
- Brand-neutral fixture model fed by two importers: **Open Fixture Library** (JSON)
  and **GDTF** (`description.xml`). 2D top-view visualizer now; **Three.js 3D** later.

## Layout

```
src/
  model/       domain types + built-in fixture library
  engine/      DMX merge (patch+programmer → 512 values) + visual-state derivation
  importers/   ofl.ts (JSON→FixtureDefinition), gdtf.ts (description.xml→FixtureDefinition)
  store/       Zustand show store
  i18n/        en / es / eu (UI ships in English)
  ui/          AppShell + patch / program / visualizer views
```

## Develop

```bash
npm install
npm run dev
npm run build
```

## Status (phase 1)

Done: scaffold, domain model, DMX engine, live 512-channel monitor, patch
(built-in library), a working programmer (select → intensity/color → Locate/Clear),
2D top-view visualizer reflecting live DMX, i18n, house theme, PWA config.

Next: import UI for OFL/GDTF files, groups & palettes, cue list & playback (Run
mode), then the Three.js 3D visualizer. Pending from Alex: the Tartanga rig
(fixtures) and the reference Avolites console model.
```
