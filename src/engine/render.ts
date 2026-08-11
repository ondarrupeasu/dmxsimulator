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
  /** True while a shutter/strobe channel is in its strobing range. */
  strobing: boolean
}

/** Combine a 16-bit MSB/LSB pair into 0–1. */
function combine16(msb: number, lsb: number): number {
  return (msb * 256 + lsb) / 65535
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
  // A pure dimmer emits warm white; a colour fixture with no colour picked yet also
  // shows open white, so raising intensity alone lights it (beginner-friendly).
  if (!hasColor || cr + cg + cb === 0) {
    cr = 255
    cg = 245
    cb = 220
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

  return {
    intensity,
    color: { r: cr, g: cg, b: cb },
    pan,
    tilt,
    strobing,
  }
}
