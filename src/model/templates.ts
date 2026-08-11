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
  ): string {
    const def = defsById[definitionId]
    if (!def) return ''
    const id = `tmpl-${n++}`
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
    description: 'Start from scratch.',
    build: (defs) => builder(defs, 'Untitled show').done(),
  },
  {
    id: 'tartanga',
    name: 'Tartanga rig',
    description: '4 Phantom spots + 2 PAR fills, no look programmed.',
    build: (defs) => {
      const b = builder(defs, 'Tartanga rig')
      b.add(PHANTOM, 0, 'Phantom 1', -0.6)
      b.add(PHANTOM, 0, 'Phantom 2', -0.2)
      b.add(PHANTOM, 0, 'Phantom 3', 0.2)
      b.add(PHANTOM, 0, 'Phantom 4', 0.6)
      b.add(PAR, 0, 'PAR 1', -0.4)
      b.add(PAR, 0, 'PAR 2', 0.4)
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
