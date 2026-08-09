/**
 * Built-in fixture library.
 *
 * A small set of generic, real-world-shaped fixtures so the app is usable before
 * any OFL/GDTF import. These will sit alongside imported fixtures, not replace
 * them. Once Alex provides the Tartanga rig, we add those exact models here (or
 * pull them from OFL/GDTF).
 */
import type { FixtureDefinition } from './types'

export const BUILTIN_FIXTURES: FixtureDefinition[] = [
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
]

/** Index the built-in library by definition id for O(1) lookup. */
export function libraryById(
  defs: FixtureDefinition[] = BUILTIN_FIXTURES,
): Record<string, FixtureDefinition> {
  return Object.fromEntries(defs.map((d) => [d.id, d]))
}
