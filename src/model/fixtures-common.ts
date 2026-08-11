/**
 * A spread of common, real-world fixtures (major brands + generic types) so the
 * library is useful out of the box. Channel charts are representative "console"
 * layouts kept simple for teaching — not a substitute for the manufacturer's
 * GDTF/personality when patching a real rig. Tartanga's exact models get added
 * once Alex sends the list.
 */
import type { FixtureDefinition, ChannelDefinition } from './types'

const shutter16 = (): ChannelDefinition => ({
  name: 'Shutter/Strobe',
  function: 'shutter',
  defaultValue: 255,
  highlightValue: 255,
  capabilities: [
    { rangeStart: 0, rangeEnd: 31, label: 'Closed' },
    { rangeStart: 32, rangeEnd: 63, label: 'Open' },
    { rangeStart: 64, rangeEnd: 223, label: 'Strobe slow→fast' },
    { rangeStart: 224, rangeEnd: 255, label: 'Open' },
  ],
})
const pan = (): ChannelDefinition => ({ name: 'Pan', function: 'pan', defaultValue: 128, highlightValue: 128 })
const panF = (): ChannelDefinition => ({ name: 'Pan Fine', function: 'panFine', defaultValue: 0, fine: true })
const tilt = (): ChannelDefinition => ({ name: 'Tilt', function: 'tilt', defaultValue: 128, highlightValue: 128 })
const tiltF = (): ChannelDefinition => ({ name: 'Tilt Fine', function: 'tiltFine', defaultValue: 0, fine: true })
const dimmer = (): ChannelDefinition => ({ name: 'Dimmer', function: 'dimmer', defaultValue: 0, highlightValue: 255 })
const rgb = (): ChannelDefinition[] => [
  { name: 'Red', function: 'red', defaultValue: 0, highlightValue: 255 },
  { name: 'Green', function: 'green', defaultValue: 0, highlightValue: 255 },
  { name: 'Blue', function: 'blue', defaultValue: 0, highlightValue: 255 },
]

export const COMMON_FIXTURES: FixtureDefinition[] = [
  // ---- Moving heads ----
  {
    id: 'martin-mac-aura-xb',
    manufacturer: 'Martin',
    model: 'MAC Aura XB',
    category: 'movingHead',
    source: 'builtin',
    modes: [
      {
        name: 'Basic 14-channel',
        channels: [
          pan(), panF(), tilt(), tiltF(), shutter16(), dimmer(),
          ...rgb(),
          { name: 'White', function: 'white', defaultValue: 0, highlightValue: 255 },
          { name: 'Colour Temp', function: 'colorTemp', defaultValue: 128 },
          { name: 'Zoom', function: 'zoom', defaultValue: 128 },
          { name: 'Function', function: 'control', defaultValue: 0 },
        ],
      },
    ],
  },
  {
    id: 'robe-pointe',
    manufacturer: 'Robe',
    model: 'Pointe',
    category: 'movingHead',
    source: 'builtin',
    modes: [
      {
        name: 'Mode 1 (16-channel)',
        channels: [
          pan(), panF(), tilt(), tiltF(),
          { name: 'Colour Wheel', function: 'colorWheel', defaultValue: 0 },
          shutter16(), dimmer(),
          { name: 'Gobo Wheel', function: 'gobo', defaultValue: 0 },
          { name: 'Gobo Rotation', function: 'goboRotation', defaultValue: 0 },
          { name: 'Prism', function: 'prism', defaultValue: 0 },
          { name: 'Prism Rotation', function: 'goboRotation', defaultValue: 0 },
          { name: 'Focus', function: 'focus', defaultValue: 128 },
          { name: 'Zoom', function: 'zoom', defaultValue: 128 },
          { name: 'Frost', function: 'iris', defaultValue: 0 },
          { name: 'Pan/Tilt Speed', function: 'control', defaultValue: 0 },
          { name: 'Control', function: 'control', defaultValue: 0 },
        ],
      },
    ],
  },
  {
    id: 'chauvet-rogue-r2-wash',
    manufacturer: 'Chauvet',
    model: 'Rogue R2 Wash',
    category: 'movingHead',
    source: 'builtin',
    modes: [
      {
        name: '16-channel',
        channels: [
          pan(), panF(), tilt(), tiltF(), dimmer(), shutter16(),
          ...rgb(),
          { name: 'White', function: 'white', defaultValue: 0, highlightValue: 255 },
          { name: 'Colour Macro', function: 'colorWheel', defaultValue: 0 },
          { name: 'Colour Temp', function: 'colorTemp', defaultValue: 128 },
          { name: 'Zoom', function: 'zoom', defaultValue: 128 },
          { name: 'Pan/Tilt Speed', function: 'control', defaultValue: 0 },
          { name: 'Control', function: 'control', defaultValue: 0 },
        ],
      },
    ],
  },
  {
    id: 'adj-focus-spot-4z',
    manufacturer: 'ADJ',
    model: 'Focus Spot 4Z',
    category: 'movingHead',
    source: 'builtin',
    modes: [
      {
        name: '15-channel',
        channels: [
          pan(), panF(), tilt(), tiltF(), dimmer(), shutter16(),
          { name: 'Colour Wheel', function: 'colorWheel', defaultValue: 0 },
          { name: 'Gobo Wheel', function: 'gobo', defaultValue: 0 },
          { name: 'Gobo Rotation', function: 'goboRotation', defaultValue: 0 },
          { name: 'Prism', function: 'prism', defaultValue: 0 },
          { name: 'Focus', function: 'focus', defaultValue: 128 },
          { name: 'Zoom', function: 'zoom', defaultValue: 128 },
          { name: 'Colour Temp', function: 'colorTemp', defaultValue: 128 },
          { name: 'Control', function: 'control', defaultValue: 0 },
        ],
      },
    ],
  },
  // ---- Pars / LED ----
  {
    id: 'chauvet-slimpar-pro-h',
    manufacturer: 'Chauvet',
    model: 'SlimPAR Pro H USB',
    category: 'par',
    source: 'builtin',
    modes: [
      {
        name: '8-channel (Dimmer + RGBAW+UV)',
        channels: [
          dimmer(), shutter16(),
          ...rgb(),
          { name: 'Amber', function: 'amber', defaultValue: 0, highlightValue: 255 },
          { name: 'White', function: 'white', defaultValue: 0, highlightValue: 255 },
          { name: 'UV', function: 'uv', defaultValue: 0 },
        ],
      },
    ],
  },
  {
    id: 'generic-led-batten',
    manufacturer: 'Generic',
    model: 'LED Batten (RGB)',
    category: 'par',
    source: 'builtin',
    modes: [
      { name: '4-channel (Dimmer + RGB)', channels: [dimmer(), ...rgb()] },
    ],
  },
  {
    id: 'generic-blinder-2',
    manufacturer: 'Generic',
    model: 'Blinder (2-lite)',
    category: 'dimmer',
    source: 'builtin',
    modes: [
      {
        name: '2-channel',
        channels: [
          { name: 'Lamp A', function: 'dimmer', defaultValue: 0, highlightValue: 255 },
          { name: 'Lamp B', function: 'dimmer', defaultValue: 0, highlightValue: 255 },
        ],
      },
    ],
  },
  // ---- Conventionals (dimmer-controlled) ----
  {
    id: 'generic-profile-spot',
    manufacturer: 'Generic',
    model: 'Profile Spot',
    category: 'other',
    source: 'builtin',
    modes: [{ name: '1-channel', channels: [{ name: 'Intensity', function: 'dimmer', defaultValue: 0, highlightValue: 255 }] }],
  },
  {
    id: 'generic-fresnel',
    manufacturer: 'Generic',
    model: 'Fresnel',
    category: 'other',
    source: 'builtin',
    modes: [{ name: '1-channel', channels: [{ name: 'Intensity', function: 'dimmer', defaultValue: 0, highlightValue: 255 }] }],
  },
  // ---- Effects ----
  {
    id: 'martin-atomic-3000',
    manufacturer: 'Martin',
    model: 'Atomic 3000 Strobe',
    category: 'strobe',
    source: 'builtin',
    modes: [
      {
        name: '4-channel',
        channels: [
          { name: 'Rate', function: 'strobe', defaultValue: 0 },
          { name: 'Intensity', function: 'dimmer', defaultValue: 0, highlightValue: 255 },
          { name: 'Duration', function: 'control', defaultValue: 0 },
          { name: 'Effects', function: 'control', defaultValue: 0 },
        ],
      },
    ],
  },
  {
    id: 'generic-hazer',
    manufacturer: 'Generic',
    model: 'Hazer',
    category: 'hazer',
    source: 'builtin',
    modes: [
      {
        name: '2-channel',
        channels: [
          { name: 'Haze', function: 'generic', defaultValue: 0 },
          { name: 'Fan', function: 'generic', defaultValue: 0 },
        ],
      },
    ],
  },
]
