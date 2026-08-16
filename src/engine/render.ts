/**
 * Turn a fixture's resolved DMX values into visual attributes the visualizer
 * (2D now, 3D later) can draw: emitted colour, intensity and pan/tilt angles.
 * Kept separate from dmx.ts so both visualizers share one interpretation.
 */
import type { FixtureDefinition } from '../model/types'

export interface FixtureVisualState {
  /** 0–1 overall brightness (dimmer if present, else max of colour channels). */
  intensity: number
  /** Emitted colour at full intensity, sRGB 0–255. */
  color: { r: number; g: number; b: number }
  /** Pan angle in degrees, -270..270 (0 = centre), if the fixture pans. */
  pan?: number
  /** Tilt angle in degrees, -135..135 (0 = centre), if the fixture tilts. */
  tilt?: number
  /** Beam width 0..1 (zoom): 0 = tight, 1 = wide. Undefined if the fixture has no zoom. */
  zoom?: number
  /** Iris aperture 0..1: 1 = fully open, 0 = pinched to a pinspot. Undefined if no iris. */
  iris?: number
  /** Edge focus 0..1: 0 = soft/hazy, 1 = crisp. Undefined if no focus. */
  focus?: number
  /** Prism engaged 0..1 (splits the beam into facets). Undefined if no prism. */
  prism?: number
  /** Gobo slot value 0..255 (which pattern is in the beam). Undefined if no gobo. */
  gobo?: number
  /** True while a shutter/strobe channel is in its strobing range. */
  strobing: boolean
}

/** Combine a 16-bit MSB/LSB pair into 0–1. */
function combine16(msb: number, lsb: number): number {
  return (msb * 256 + lsb) / 65535
}

/** A generic colour-wheel slot table (open + 7 gels) so a colour-wheel fixture shows
 *  a visible colour as its wheel channel moves. Not the exact per-fixture gels, but it
 *  lets the beam change colour like the real thing. */
const COLOUR_WHEEL: [number, number, number][] = [
  [255, 245, 220], // open / white
  [255, 40, 40], // red
  [255, 130, 0], // orange
  [255, 225, 60], // yellow
  [40, 220, 90], // green
  [40, 200, 235], // cyan
  [50, 90, 255], // blue
  [220, 60, 230], // magenta
]
function colourWheelSlot(v: number): [number, number, number] {
  const i = Math.min(COLOUR_WHEEL.length - 1, Math.floor((v / 256) * COLOUR_WHEEL.length))
  return COLOUR_WHEEL[i]
}

export function computeVisualState(
  def: FixtureDefinition,
  modeIndex: number,
  values: number[],
): FixtureVisualState {
  const channels = def.modes[modeIndex]?.channels ?? []
  const get = (fn: string): number | undefined => {
    const idx = channels.findIndex((c) => c.function === fn)
    return idx >= 0 ? values[idx] : undefined
  }

  const r = get('red') ?? 0
  const g = get('green') ?? 0
  const b = get('blue') ?? 0
  const w = get('white') ?? 0
  const amber = get('amber') ?? 0

  // Additive mix: white lifts all channels, amber pushes red+green.
  let cr = Math.min(255, r + w + amber)
  let cg = Math.min(255, g + w + Math.round(amber * 0.75))
  let cb = Math.min(255, b + w)

  const hasColor = ['red', 'green', 'blue', 'white', 'amber'].some(
    (fn) => channels.some((c) => c.function === fn),
  )
  // A colour-wheel spot (no RGB mixing): map its wheel value to a slot colour so the beam
  // actually changes colour when you turn the Colour wheel (slot 0 = open white).
  const wheelVal = get('colorWheel')
  if (cr + cg + cb === 0) {
    if (wheelVal !== undefined) {
      ;[cr, cg, cb] = colourWheelSlot(wheelVal)
    } else if (!hasColor) {
      // A pure dimmer emits warm white (a tungsten/white fixture with no colour control).
      cr = 255
      cg = 245
      cb = 220
    }
    // else: an RGB/RGBW fixture with every colour channel at 0 emits nothing → stays black.
  }

  const dimmer = get('dimmer')
  const colorMax = Math.max(cr, cg, cb)
  let intensity = dimmer !== undefined ? dimmer / 255 : colorMax / 255

  // A closed mechanical shutter blacks the fixture out regardless of dimmer.
  const shutterVal = get('shutter') ?? get('strobe')
  if (shutterVal !== undefined && shutterVal < 4) intensity = 0

  // 16-bit pan/tilt when a fine channel exists, else 8-bit.
  let pan: number | undefined
  const panMsb = get('pan')
  if (panMsb !== undefined) {
    const frac = combine16(panMsb, get('panFine') ?? 0)
    pan = (frac - 0.5) * 540 // ±270°
  }
  let tilt: number | undefined
  const tiltMsb = get('tilt')
  if (tiltMsb !== undefined) {
    const frac = combine16(tiltMsb, get('tiltFine') ?? 0)
    tilt = (frac - 0.5) * 270 // ±135°
  }

  const shutter = get('shutter') ?? get('strobe')
  const strobing = shutter !== undefined && shutter >= 64 && shutter <= 223

  // Beam-shaping attributes (approximate DMX conventions — a teaching sim, not a fixture's
  // exact profile). Undefined when the fixture doesn't have that channel.
  const zoomV = get('zoom')
  const irisV = get('iris')
  const focusV = get('focus')
  const prismV = get('prism')
  const goboV = get('gobo')

  return {
    intensity,
    color: { r: cr, g: cg, b: cb },
    pan,
    tilt,
    zoom: zoomV !== undefined ? zoomV / 255 : undefined,
    iris: irisV !== undefined ? 1 - irisV / 255 : undefined, // 0 DMX = open
    focus: focusV !== undefined ? focusV / 255 : undefined,
    prism: prismV !== undefined ? prismV / 255 : undefined,
    gobo: goboV,
    strobing,
  }
}
