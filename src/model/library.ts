/**
 * Built-in fixture library.
 *
 * A small set of generic, real-world-shaped fixtures so the app is usable before
 * any OFL/GDTF import. These will sit alongside imported fixtures, not replace
 * them. Once Alex provides the Tartanga rig, we add those exact models here (or
 * pull them from OFL/GDTF).
 */
import type { FixtureDefinition } from './types'
import { COMMON_FIXTURES } from './fixtures-common'

// Colour-wheel slots shared by both Phantom modes (from the MKII manual).
const PHANTOM_COLOR_CAPS = [
  { rangeStart: 0, rangeEnd: 6, label: 'Open / White' },
  { rangeStart: 7, rangeEnd: 13, label: 'Yellow' },
  { rangeStart: 14, rangeEnd: 20, label: 'Purple' },
  { rangeStart: 21, rangeEnd: 27, label: 'Green' },
  { rangeStart: 28, rangeEnd: 34, label: 'Red' },
  { rangeStart: 35, rangeEnd: 41, label: 'Cyan' },
  { rangeStart: 42, rangeEnd: 48, label: 'Light Green' },
  { rangeStart: 49, rangeEnd: 55, label: 'Orange' },
  { rangeStart: 56, rangeEnd: 64, label: 'Dark Blue' },
  { rangeStart: 128, rangeEnd: 191, label: 'Rainbow CW slow→fast' },
  { rangeStart: 192, rangeEnd: 255, label: 'Rainbow CCW slow→fast' },
]

const PHANTOM_GOBO_CAPS = [
  { rangeStart: 0, rangeEnd: 7, label: 'Open / White' },
  { rangeStart: 8, rangeEnd: 15, label: 'Gobo 1' },
  { rangeStart: 16, rangeEnd: 23, label: 'Gobo 2' },
  { rangeStart: 24, rangeEnd: 31, label: 'Gobo 3' },
  { rangeStart: 32, rangeEnd: 39, label: 'Gobo 4' },
  { rangeStart: 40, rangeEnd: 47, label: 'Gobo 5' },
  { rangeStart: 48, rangeEnd: 55, label: 'Gobo 6' },
  { rangeStart: 56, rangeEnd: 63, label: 'Gobo 7' },
  { rangeStart: 64, rangeEnd: 119, label: 'Gobo shake slow→fast' },
  { rangeStart: 120, rangeEnd: 127, label: 'Open / White' },
  { rangeStart: 128, rangeEnd: 191, label: 'Rotation CW slow→fast' },
  { rangeStart: 192, rangeEnd: 255, label: 'Rotation CCW slow→fast' },
]

const PHANTOM_SHUTTER_CAPS = [
  { rangeStart: 0, rangeEnd: 3, label: 'Closed' },
  { rangeStart: 4, rangeEnd: 7, label: 'Open' },
  { rangeStart: 8, rangeEnd: 215, label: 'Strobe slow→fast' },
  { rangeStart: 216, rangeEnd: 255, label: 'Open' },
]

const PHANTOM_PRISM_CAPS = [
  { rangeStart: 0, rangeEnd: 15, label: 'Open' },
  { rangeStart: 16, rangeEnd: 255, label: '3-facet prism' },
]

export const BUILTIN_FIXTURES: FixtureDefinition[] = [
  {
    // Alex's main rig fixture at Tartanga. Chart from the Phantom 50 LED Spot
    // MKII manual (Highlite ordercode 40200). 13-channel is the console mode.
    id: 'showtec-phantom-50-led-spot-mkii',
    manufacturer: 'Showtec',
    model: 'Phantom 50 LED Spot MKII',
    category: 'movingHead',
    source: 'builtin',
    modes: [
      {
        name: '13-channel',
        channels: [
          { name: 'Pan', function: 'pan', defaultValue: 128, highlightValue: 128 },
          { name: 'Tilt', function: 'tilt', defaultValue: 128, highlightValue: 128 },
          { name: 'Pan Fine', function: 'panFine', defaultValue: 0, fine: true },
          { name: 'Tilt Fine', function: 'tiltFine', defaultValue: 0, fine: true },
          { name: 'Pan/Tilt Speed', function: 'control', defaultValue: 0 },
          { name: 'Color Wheel', function: 'colorWheel', defaultValue: 0, capabilities: PHANTOM_COLOR_CAPS },
          { name: 'Shutter/Strobe', function: 'shutter', defaultValue: 255, highlightValue: 255, capabilities: PHANTOM_SHUTTER_CAPS },
          { name: 'Dimmer', function: 'dimmer', defaultValue: 0, highlightValue: 255 },
          { name: 'Gobo Wheel', function: 'gobo', defaultValue: 0, capabilities: PHANTOM_GOBO_CAPS },
          { name: 'Gobo Rotation', function: 'goboRotation', defaultValue: 0 },
          { name: 'Prism', function: 'prism', defaultValue: 0, capabilities: PHANTOM_PRISM_CAPS },
          { name: 'Function', function: 'control', defaultValue: 0 },
          { name: 'Programs', function: 'control', defaultValue: 0 },
        ],
      },
      {
        name: '8-channel',
        channels: [
          { name: 'Pan', function: 'pan', defaultValue: 128, highlightValue: 128 },
          { name: 'Tilt', function: 'tilt', defaultValue: 128, highlightValue: 128 },
          { name: 'Color Wheel', function: 'colorWheel', defaultValue: 0, capabilities: PHANTOM_COLOR_CAPS },
          { name: 'Shutter/Strobe', function: 'shutter', defaultValue: 255, highlightValue: 255, capabilities: PHANTOM_SHUTTER_CAPS },
          { name: 'Dimmer', function: 'dimmer', defaultValue: 0, highlightValue: 255 },
          { name: 'Gobo Wheel', function: 'gobo', defaultValue: 0, capabilities: PHANTOM_GOBO_CAPS },
          { name: 'Gobo Rotation', function: 'goboRotation', defaultValue: 0 },
          { name: 'Prism', function: 'prism', defaultValue: 0, capabilities: PHANTOM_PRISM_CAPS },
        ],
      },
    ],
  },
  {
    id: 'generic-dimmer-1ch',
    manufacturer: 'Generic',
    model: 'Dimmer',
    category: 'dimmer',
    source: 'builtin',
    modes: [
      {
        name: '1-channel',
        channels: [
          { name: 'Intensity', function: 'dimmer', defaultValue: 0, highlightValue: 255 },
        ],
      },
    ],
  },
  {
    id: 'generic-rgb-par',
    manufacturer: 'Generic',
    model: 'RGB PAR',
    category: 'par',
    source: 'builtin',
    modes: [
      {
        name: '3-channel (RGB)',
        channels: [
          { name: 'Red', function: 'red', defaultValue: 0, highlightValue: 255 },
          { name: 'Green', function: 'green', defaultValue: 0, highlightValue: 255 },
          { name: 'Blue', function: 'blue', defaultValue: 0, highlightValue: 255 },
        ],
      },
      {
        name: '4-channel (Dimmer + RGB)',
        channels: [
          { name: 'Dimmer', function: 'dimmer', defaultValue: 0, highlightValue: 255 },
          { name: 'Red', function: 'red', defaultValue: 0, highlightValue: 255 },
          { name: 'Green', function: 'green', defaultValue: 0, highlightValue: 255 },
          { name: 'Blue', function: 'blue', defaultValue: 0, highlightValue: 255 },
        ],
      },
    ],
  },
  {
    id: 'generic-rgbw-par',
    manufacturer: 'Generic',
    model: 'RGBW PAR',
    category: 'par',
    source: 'builtin',
    modes: [
      {
        name: '5-channel (Dimmer + RGBW)',
        channels: [
          { name: 'Dimmer', function: 'dimmer', defaultValue: 0, highlightValue: 255 },
          { name: 'Red', function: 'red', defaultValue: 0, highlightValue: 255 },
          { name: 'Green', function: 'green', defaultValue: 0, highlightValue: 255 },
          { name: 'Blue', function: 'blue', defaultValue: 0, highlightValue: 255 },
          { name: 'White', function: 'white', defaultValue: 0, highlightValue: 255 },
        ],
      },
    ],
  },
  {
    id: 'generic-moving-wash',
    manufacturer: 'Generic',
    model: 'Moving Wash',
    category: 'movingHead',
    source: 'builtin',
    modes: [
      {
        // A compact but realistic wash layout with 16-bit pan/tilt.
        name: '11-channel',
        channels: [
          { name: 'Pan', function: 'pan', defaultValue: 128, highlightValue: 128 },
          { name: 'Pan Fine', function: 'panFine', defaultValue: 0, fine: true },
          { name: 'Tilt', function: 'tilt', defaultValue: 128, highlightValue: 128 },
          { name: 'Tilt Fine', function: 'tiltFine', defaultValue: 0, fine: true },
          {
            name: 'Shutter',
            function: 'shutter',
            defaultValue: 255,
            highlightValue: 255,
            capabilities: [
              { rangeStart: 0, rangeEnd: 31, label: 'Closed' },
              { rangeStart: 32, rangeEnd: 63, label: 'Open' },
              { rangeStart: 64, rangeEnd: 223, label: 'Strobe slow→fast' },
              { rangeStart: 224, rangeEnd: 255, label: 'Open' },
            ],
          },
          { name: 'Dimmer', function: 'dimmer', defaultValue: 0, highlightValue: 255 },
          { name: 'Red', function: 'red', defaultValue: 0, highlightValue: 255 },
          { name: 'Green', function: 'green', defaultValue: 0, highlightValue: 255 },
          { name: 'Blue', function: 'blue', defaultValue: 0, highlightValue: 255 },
          { name: 'White', function: 'white', defaultValue: 0, highlightValue: 255 },
          { name: 'Zoom', function: 'zoom', defaultValue: 128 },
        ],
      },
    ],
  },
  {
    id: 'generic-strobe',
    manufacturer: 'Generic',
    model: 'Strobe',
    category: 'strobe',
    source: 'builtin',
    modes: [
      {
        name: '2-channel',
        channels: [
          { name: 'Intensity', function: 'dimmer', defaultValue: 0, highlightValue: 255 },
          {
            name: 'Rate',
            function: 'strobe',
            defaultValue: 0,
            capabilities: [
              { rangeStart: 0, rangeEnd: 7, label: 'Off' },
              { rangeStart: 8, rangeEnd: 255, label: 'Slow→fast' },
            ],
          },
        ],
      },
    ],
  },
  ...COMMON_FIXTURES,
]

/** Index the built-in library by definition id for O(1) lookup. */
export function libraryById(
  defs: FixtureDefinition[] = BUILTIN_FIXTURES,
): Record<string, FixtureDefinition> {
  return Object.fromEntries(defs.map((d) => [d.id, d]))
}
