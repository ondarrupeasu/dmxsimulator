/**
 * The real Tartanga rig, patched exactly as on their Avolites Quartz (QTZ-04160,
 * Titan 16.0.670.5, show "pae"). Charts taken from each manufacturer's manual so a
 * student practises on the same personalities they'll meet on the desk. Mode names
 * mirror the Titan "Mode" column so an exported patch report matches Miren's.
 *
 * Note on combined "Strobe/Programs" channels (cheap RGB/RGBA pars): value 0 means
 * "steady, no effect", so they're typed 'control' rather than 'shutter' — a 'shutter'
 * near 0 is read as a closed mechanical shutter and would black the fixture out.
 */
import type { FixtureDefinition, ChannelDefinition } from './types'

const pan = (): ChannelDefinition => ({ name: 'Pan', function: 'pan', defaultValue: 128, highlightValue: 128 })
const panF = (): ChannelDefinition => ({ name: 'Pan Fine', function: 'panFine', defaultValue: 0, fine: true })
const tilt = (): ChannelDefinition => ({ name: 'Tilt', function: 'tilt', defaultValue: 128, highlightValue: 128 })
const tiltF = (): ChannelDefinition => ({ name: 'Tilt Fine', function: 'tiltFine', defaultValue: 0, fine: true })
const dimmer = (): ChannelDefinition => ({ name: 'Dimmer', function: 'dimmer', defaultValue: 0, highlightValue: 255 })
const red = (): ChannelDefinition => ({ name: 'Red', function: 'red', defaultValue: 0, highlightValue: 255 })
const green = (): ChannelDefinition => ({ name: 'Green', function: 'green', defaultValue: 0, highlightValue: 255 })
const blue = (): ChannelDefinition => ({ name: 'Blue', function: 'blue', defaultValue: 0, highlightValue: 255 })
const white = (): ChannelDefinition => ({ name: 'White', function: 'white', defaultValue: 0, highlightValue: 255 })
const ctrl = (name: string, defaultValue = 0): ChannelDefinition => ({ name, function: 'control', defaultValue })
/** A real mechanical shutter/strobe: open by default (255 sits in the "open" band). */
const shutter = (): ChannelDefinition => ({
  name: 'Shutter/Strobe',
  function: 'shutter',
  defaultValue: 255,
  highlightValue: 255,
  capabilities: [
    { rangeStart: 0, rangeEnd: 31, label: 'Closed' },
    { rangeStart: 32, rangeEnd: 63, label: 'Open' },
    { rangeStart: 64, rangeEnd: 95, label: 'Strobe slow→fast' },
    { rangeStart: 96, rangeEnd: 255, label: 'Open / pulse / random' },
  ],
})

export const TARTANGA_FIXTURES: FixtureDefinition[] = [
  // Plain 1-channel dimmer channel (a conventional lantern on a dimmer).
  {
    id: 'generic-dimmer',
    manufacturer: 'Generic',
    model: 'Dimmer',
    category: 'dimmer',
    source: 'builtin',
    modes: [{ name: 'Dimmer', channels: [{ name: 'Intensity', function: 'dimmer', defaultValue: 0, highlightValue: 255 }] }],
  },
  // Cameo PAR 64 CAN RGB 3W — code CLP64RGB3WPS. Order R,G,B,Dim,Speed,Program.
  {
    id: 'cameo-par64-can-rgb-3w',
    manufacturer: 'Cameo',
    model: 'PAR 64 CAN RGB 3W',
    category: 'par',
    source: 'builtin',
    modes: [
      {
        name: '6 DMX',
        channels: [
          red(), green(), blue(), dimmer(),
          ctrl('Speed'),
          ctrl('Mode / Programs'),
        ],
      },
    ],
  },
  // ADJ Focus Flex — "Standard" 25-channel personality (single-colour engine; the
  // per-pixel cell control only exists in the 34/42/50-ch modes, not here).
  {
    id: 'adj-focus-flex',
    manufacturer: 'ADJ',
    model: 'Focus Flex',
    category: 'movingHead',
    source: 'builtin',
    modes: [
      {
        name: 'Standard, 25 DMX',
        channels: [
          pan(), panF(), tilt(), tiltF(),
          red(), green(), blue(), white(),
          { name: 'Colour Temperature', function: 'colorTemp', defaultValue: 128 },
          ctrl('CCT Presets'),
          { name: 'Virtual Colour Wheel (FG)', function: 'colorWheel', defaultValue: 0 },
          ctrl('Virtual Colour Wheel (BG)'),
          ctrl('Colour Macros'),
          shutter(),
          dimmer(),
          { name: 'Dimmer Fine', function: 'control', defaultValue: 0, fine: true },
          { name: 'Zoom', function: 'zoom', defaultValue: 128 },
          { name: 'Zoom Fine', function: 'control', defaultValue: 0, fine: true },
          ctrl('Dim Modes / Speed'),
          ctrl('Dim Curves'),
          ctrl('Internal Programs'),
          ctrl('Program Speed'),
          ctrl('Program Fade'),
          ctrl('Pan/Tilt Speed'),
          ctrl('LED Refresh / Function'),
        ],
      },
    ],
  },
  // Eurolite LED ML-56 RGBA — order R,G,B,A,Dim,Strobe(=Ch6 combined, 0 = steady).
  {
    id: 'eurolite-ml-56-rgba',
    manufacturer: 'Eurolite',
    model: 'LED ML-56 RGBA',
    category: 'par',
    source: 'builtin',
    modes: [
      {
        name: '6 DMX',
        channels: [
          red(), green(), blue(),
          { name: 'Amber', function: 'amber', defaultValue: 0, highlightValue: 255 },
          dimmer(),
          ctrl('Strobe / Programs'),
        ],
      },
    ],
  },
  // Cameo AURO SPOT Z300 — 200 W spot, 17-channel full-function mode.
  {
    id: 'cameo-auro-spot-z300',
    manufacturer: 'Cameo',
    model: 'AURO Spot Z300',
    category: 'movingHead',
    source: 'builtin',
    modes: [
      {
        name: '17 DMX',
        channels: [
          pan(), panF(), tilt(), tiltF(),
          dimmer(), shutter(),
          { name: 'Colour Wheel', function: 'colorWheel', defaultValue: 0 },
          { name: 'Gobo Wheel 1', function: 'gobo', defaultValue: 0 },
          { name: 'Gobo 1 Rotation', function: 'goboRotation', defaultValue: 0 },
          { name: 'Gobo Wheel 2', function: 'gobo', defaultValue: 0 },
          { name: 'Zoom', function: 'zoom', defaultValue: 128 },
          { name: 'Focus', function: 'focus', defaultValue: 128 },
          { name: 'Prism', function: 'prism', defaultValue: 0 },
          ctrl('Prism Rotation'),
          { name: 'Frost', function: 'iris', defaultValue: 0 },
          ctrl('Pan/Tilt Macro'),
          ctrl('Macro Speed'),
        ],
      },
    ],
  },
  // MARK (Equipson) BLINDER 2L — 2-eye COB blinder, each eye split warm/cold white.
  {
    id: 'mark-blinder-2l',
    manufacturer: 'MARK',
    model: 'Blinder 2L',
    category: 'dimmer',
    source: 'builtin',
    modes: [
      {
        name: '7 DMX',
        channels: [
          { name: 'Master Dimmer', function: 'dimmer', defaultValue: 0, highlightValue: 255 },
          { name: 'Eye 1 Warm White', function: 'amber', defaultValue: 0, highlightValue: 255 },
          { name: 'Eye 1 Cold White', function: 'white', defaultValue: 0, highlightValue: 255 },
          { name: 'Eye 2 Warm White', function: 'amber', defaultValue: 0, highlightValue: 255 },
          { name: 'Eye 2 Cold White', function: 'white', defaultValue: 0, highlightValue: 255 },
          ctrl('Strobe'),
          ctrl('Modes'),
        ],
      },
    ],
  },
  // Cameo PHANTOM H2 — compact hazer, code CPHANTOMH2. Ch1 haze, Ch2 fan.
  {
    id: 'cameo-phantom-h2',
    manufacturer: 'Cameo',
    model: 'PHANTOM H2',
    category: 'hazer',
    source: 'builtin',
    modes: [
      {
        name: '2 DMX',
        channels: [
          { name: 'Haze', function: 'haze', defaultValue: 0, highlightValue: 255 },
          { name: 'Fan', function: 'control', defaultValue: 128 },
        ],
      },
    ],
  },
]
