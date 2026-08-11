/**
 * Show templates — ready-made rigs (some with a programmed look) so a student can
 * load something that already works instead of starting from an empty universe.
 */
import type { FixtureDefinition, PatchedFixture, Show } from './types'
import { fixtureFootprint } from './types'
import type { ProgrammerValues } from '../engine/dmx'
import type { Effect } from '../engine/effects'

export interface ShowTemplate {
  id: string
  name: string
  description: string
  build: (defsById: Record<string, FixtureDefinition>) => {
    show: Show
    programmer: ProgrammerValues
    effects?: Effect[]
  }
}

/** Small helper to add fixtures with auto-addressing and an optional look. */
function builder(defsById: Record<string, FixtureDefinition>, showName: string) {
  const fixtures: PatchedFixture[] = []
  const programmer: ProgrammerValues = {}
  let address = 1
  let n = 0
  function add(
    definitionId: string,
    modeIndex: number,
    name: string,
    x: number,
    look?: Record<number, number>,
    truss = 1,
    addr?: number,
  ): string {
    const def = defsById[definitionId]
    if (!def) return ''
    const id = `tmpl-${n++}`
    if (addr !== undefined) address = addr
    fixtures.push({
      id,
      definitionId,
      modeIndex,
      name,
      universe: 1,
      address,
      position: { x, y: 0.6, z: 0 },
      truss,
    })
    address += fixtureFootprint(def, modeIndex)
    if (look) programmer[id] = look
    return id
  }
  return {
    add,
    done: (): { show: Show; programmer: ProgrammerValues } => ({
      show: { name: showName, universeCount: 1, fixtures },
      programmer,
    }),
  }
}

const PHANTOM = 'showtec-phantom-50-led-spot-mkii'
const PAR = 'generic-rgbw-par'
const STROBE = 'generic-strobe'
const ROGUE = 'chauvet-rogue-r2-wash'
const AURA = 'martin-mac-aura-xb'
const PROFILE = 'generic-profile-spot'
const BLINDER = 'generic-blinder-2'
// Real Tartanga models (see model/fixtures-tartanga.ts).
const DIMMER = 'generic-dimmer'
const CPAR = 'cameo-par64-can-rgb-3w'
const FOCUSFLEX = 'adj-focus-flex'
const ML56 = 'eurolite-ml-56-rgba'
const AURO = 'cameo-auro-spot-z300'
const BLINDER2L = 'mark-blinder-2l'
const HAZER = 'cameo-phantom-h2'

// Truss indices (see model/venue.ts): 0 Front, 1 Mid, 2 Back, 3 FOH.
const FRONT = 0, MID = 1, BACK = 2, FOH = 3

// RGBW PAR channel indices: 0 Dimmer, 1 R, 2 G, 3 B, 4 W.
const parLook = (r: number, g: number, b: number, w = 0) => ({ 0: 255, 1: r, 2: g, 3: b, 4: w })
// Phantom 13-ch indices: 0 Pan, 1 Tilt, 5 ColorWheel, 6 Shutter, 7 Dimmer.
const phantomLook = (tilt: number, colorSlot: number) => ({ 1: tilt, 5: colorSlot, 6: 255, 7: 255 })
// Chauvet Rogue R2 Wash: 2 Tilt, 4 Dimmer, 5 Shutter, 6 R, 7 G, 8 B.
const rogueLook = (tilt: number, r: number, g: number, b: number) => ({ 2: tilt, 4: 255, 5: 255, 6: r, 7: g, 8: b })
// Martin MAC Aura XB: 2 Tilt, 4 Shutter, 5 Dimmer, 6 R, 7 G, 8 B, 9 W.
const auraLook = (tilt: number, r: number, g: number, b: number, w = 0) => ({ 2: tilt, 4: 255, 5: 255, 6: r, 7: g, 8: b, 9: w })
// Single-channel conventional (profile / fresnel): 0 Intensity.
const dim = () => ({ 0: 255 })

export const TEMPLATES: ShowTemplate[] = [
  {
    id: 'empty',
    name: 'Empty universe',
    description: 'Start from scratch — one truss; add more in Patch.',
    build: (defs) => {
      const r = builder(defs, 'Untitled show').done()
      return { ...r, show: { ...r.show, trusses: [{ id: 0, name: 'Truss 1', z: 0, y: 5 }] } }
    },
  },
  {
    id: 'tartanga',
    name: 'Tartanga (real)',
    description: 'The actual CIFP Tartanga rig from their Quartz patch: 20 dimmers, 7 Cameo PAR 64, 5 ADJ Focus Flex, 4 Eurolite ML-56, 2 Cameo Auro Spot Z300, a MARK Blinder 2L and a Cameo Phantom H2 hazer — exact DMX addresses.',
    build: (defs) => {
      const b = builder(defs, 'pae')
      // Layout across the trusses (physical positions are ours — the patch only
      // carried DMX addresses). Addresses below are exactly Miren's patch export.
      const spread = (i: number, n: number) => -0.85 + (1.7 * i) / (n - 1)
      // 20 generic dimmers → front light on the FRONT truss, addr 1–20.
      for (let i = 0; i < 20; i++) b.add(DIMMER, 0, `Dim ${i + 1}`, spread(i, 20), undefined, FRONT, i + 1)
      // 5 ADJ Focus Flex movers → MID truss.
      const ffAddr = [49, 75, 100, 400, 425]
      ffAddr.forEach((a, i) => b.add(FOCUSFLEX, 0, `Focus Flex ${i + 1}`, spread(i, 5), undefined, MID, a))
      // 7 Cameo PAR 64 RGB → BACK truss colour wash (addresses are scattered).
      const parAddr = [126, 132, 138, 144, 216, 222, 208]
      parAddr.forEach((a, i) => b.add(CPAR, 0, `PAR 64 · ${i + 1}`, spread(i, 7), undefined, BACK, a))
      // 4 Eurolite ML-56 RGBA → BACK truss too (lower row), addr 150–168.
      const mlAddr = [150, 156, 162, 168]
      mlAddr.forEach((a, i) => b.add(ML56, 0, `ML-56 · ${i + 1}`, spread(i, 4), undefined, BACK, a))
      // 2 Cameo Auro Spot Z300 → FOH truss (front-of-house spots), addr 174 & 191.
      b.add(AURO, 0, 'Auro Spot 1', -0.35, undefined, FOH, 174)
      b.add(AURO, 0, 'Auro Spot 2', 0.35, undefined, FOH, 191)
      // MARK Blinder 2L → FRONT truss centre, addr 502.
      b.add(BLINDER2L, 0, 'Blinder 2L', 0, undefined, FRONT, 502)
      // Cameo Phantom H2 hazer → stage floor, stage-right, addr 214.
      b.add(HAZER, 0, 'Phantom H2', 0.85, undefined, MID, 214)
      return b.done()
    },
  },
  {
    id: 'club-look',
    name: 'Club look (programmed)',
    description: '4 Phantoms + 4 colour PARs + strobe, with a look already on.',
    build: (defs) => {
      const b = builder(defs, 'Club look')
      // Phantoms tilted out, alternating colour-wheel slots (red / dark blue).
      b.add(PHANTOM, 0, 'Phantom 1', -0.6, phantomLook(90, 28))
      b.add(PHANTOM, 0, 'Phantom 2', -0.2, phantomLook(90, 56))
      b.add(PHANTOM, 0, 'Phantom 3', 0.2, phantomLook(90, 28))
      b.add(PHANTOM, 0, 'Phantom 4', 0.6, phantomLook(90, 56))
      // PAR wash in a warm→cool spread.
      b.add(PAR, 0, 'PAR 1', -0.7, parLook(255, 0, 0))
      b.add(PAR, 0, 'PAR 2', -0.25, parLook(255, 60, 0))
      b.add(PAR, 0, 'PAR 3', 0.25, parLook(0, 80, 255))
      b.add(PAR, 0, 'PAR 4', 0.7, parLook(120, 0, 255))
      b.add(STROBE, 0, 'Strobe', 0)
      return b.done()
    },
  },
  {
    id: 'movers',
    name: 'Movers show (animated)',
    description: 'Phantoms sweeping in a fan + colour-cycling PARs. Load and watch it move.',
    build: (defs) => {
      const b = builder(defs, 'Movers show')
      // Phantoms: dimmer full + shutter open; movement comes from the effect.
      const phantomIds = [
        b.add(PHANTOM, 0, 'Phantom 1', -0.6, { 6: 255, 7: 255 }),
        b.add(PHANTOM, 0, 'Phantom 2', -0.2, { 6: 255, 7: 255 }),
        b.add(PHANTOM, 0, 'Phantom 3', 0.2, { 6: 255, 7: 255 }),
        b.add(PHANTOM, 0, 'Phantom 4', 0.6, { 6: 255, 7: 255 }),
      ]
      // PARs at full; colour comes from the cycle effect.
      const parIds = [
        b.add(PAR, 0, 'PAR 1', -0.7, { 0: 255 }),
        b.add(PAR, 0, 'PAR 2', -0.25, { 0: 255 }),
        b.add(PAR, 0, 'PAR 3', 0.25, { 0: 255 }),
        b.add(PAR, 0, 'PAR 4', 0.7, { 0: 255 }),
      ]
      const { show, programmer } = b.done()
      const effects: Effect[] = [
        { id: 'fx-move', type: 'circle', fixtureIds: phantomIds, speed: 0.12, size: 75, spread: 1.3 },
        { id: 'fx-colour', type: 'colourCycle', fixtureIds: parIds, speed: 0.08, size: 0, spread: 1.6 },
      ]
      return { show, programmer, effects }
    },
  },
  {
    id: 'theatre',
    name: 'Theatre (three trusses)',
    description: 'Front-light profiles, mid spots and a blue back-truss cyc — a classic theatre wash.',
    build: (defs) => {
      const b = builder(defs, 'Theatre')
      // Front truss — warm front light.
      b.add(PROFILE, 0, 'Front 1', -0.6, dim(), FRONT)
      b.add(PROFILE, 0, 'Front 2', -0.2, dim(), FRONT)
      b.add(PROFILE, 0, 'Front 3', 0.2, dim(), FRONT)
      b.add(PROFILE, 0, 'Front 4', 0.6, dim(), FRONT)
      // Mid truss — spots (open white).
      b.add(PHANTOM, 0, 'Spot 1', -0.4, phantomLook(120, 0), MID)
      b.add(PHANTOM, 0, 'Spot 2', 0, phantomLook(120, 0), MID)
      b.add(PHANTOM, 0, 'Spot 3', 0.4, phantomLook(120, 0), MID)
      // Back truss — blue cyc wash.
      b.add(PAR, 0, 'Cyc 1', -0.6, parLook(0, 40, 255), BACK)
      b.add(PAR, 0, 'Cyc 2', -0.2, parLook(0, 40, 255), BACK)
      b.add(PAR, 0, 'Cyc 3', 0.2, parLook(0, 40, 255), BACK)
      b.add(PAR, 0, 'Cyc 4', 0.6, parLook(0, 40, 255), BACK)
      return b.done()
    },
  },
  {
    id: 'concert',
    name: 'Concert (multi-truss)',
    description: 'Aura washes on the back truss, spots mid, FOH front-light and blinders — coloured look on.',
    build: (defs) => {
      const b = builder(defs, 'Concert')
      // Back truss — colour washes, amber / blue alternating.
      b.add(AURA, 0, 'Wash 1', -0.6, auraLook(128, 255, 120, 0), BACK)
      b.add(AURA, 0, 'Wash 2', -0.2, auraLook(128, 0, 80, 255), BACK)
      b.add(AURA, 0, 'Wash 3', 0.2, auraLook(128, 255, 120, 0), BACK)
      b.add(AURA, 0, 'Wash 4', 0.6, auraLook(128, 0, 80, 255), BACK)
      // Mid truss — spots tilted out, alternating colour-wheel slots.
      b.add(PHANTOM, 0, 'Spot 1', -0.5, phantomLook(90, 28), MID)
      b.add(PHANTOM, 0, 'Spot 2', -0.17, phantomLook(90, 56), MID)
      b.add(PHANTOM, 0, 'Spot 3', 0.17, phantomLook(90, 28), MID)
      b.add(PHANTOM, 0, 'Spot 4', 0.5, phantomLook(90, 56), MID)
      // FOH truss — front light.
      b.add(PROFILE, 0, 'FOH 1', -0.3, dim(), FOH)
      b.add(PROFILE, 0, 'FOH 2', 0.3, dim(), FOH)
      // Front truss — blinders (both lamps up).
      b.add(BLINDER, 0, 'Blinder L', -0.4, { 0: 255, 1: 255 }, FRONT)
      b.add(BLINDER, 0, 'Blinder R', 0.4, { 0: 255, 1: 255 }, FRONT)
      return b.done()
    },
  },
  {
    id: 'movers-xl',
    name: 'Movers XL (animated)',
    description: 'Moving heads on all three stage trusses sweeping in a fan — load and watch.',
    build: (defs) => {
      const b = builder(defs, 'Movers XL')
      const ids = [
        b.add(PHANTOM, 0, 'Mid 1', -0.5, { 6: 255, 7: 255 }, MID),
        b.add(PHANTOM, 0, 'Mid 2', -0.17, { 6: 255, 7: 255 }, MID),
        b.add(PHANTOM, 0, 'Mid 3', 0.17, { 6: 255, 7: 255 }, MID),
        b.add(PHANTOM, 0, 'Mid 4', 0.5, { 6: 255, 7: 255 }, MID),
        b.add(ROGUE, 0, 'Back 1', -0.5, rogueLook(80, 0, 120, 255), BACK),
        b.add(ROGUE, 0, 'Back 2', 0, rogueLook(80, 255, 0, 120), BACK),
        b.add(ROGUE, 0, 'Back 3', 0.5, rogueLook(80, 0, 120, 255), BACK),
      ]
      const { show, programmer } = b.done()
      const effects: Effect[] = [
        { id: 'fx-fan', type: 'circle', fixtureIds: ids, speed: 0.12, size: 80, spread: 1.5 },
      ]
      return { show, programmer, effects }
    },
  },
]

export function templateById(id: string): ShowTemplate | undefined {
  return TEMPLATES.find((t) => t.id === id)
}
