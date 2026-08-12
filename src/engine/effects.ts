/**
 * Effects ("shapes" in Avolites) — time-based movement layered on top of the
 * static look. Pure function of (base values, effects, time) so both the 2D/
 * monitor (via a store clock) and the 3D loop (via its own clock) can evaluate
 * them consistently.
 */
import type { FixtureDefinition, Show } from '../model/types'
import type { LiveCue } from '../model/cue'
import type { Fade } from './dmx'
import { resolveLevel } from './dmx'
import type { ProgrammerValues } from './dmx'

export type EffectType = 'circle' | 'colourCycle' | 'dimmerWave'

export interface Effect {
  id: string
  type: EffectType
  /** Instance ids the effect runs on. */
  fixtureIds: string[]
  /** Cycles per second. */
  speed: number
  /** Amplitude for pan/tilt (0–127). */
  size: number
  /** Phase offset per fixture (radians) — makes the effect "fan" across a group. */
  spread: number
}

function clampByte(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : Math.round(v)
}

/** Minimal HSV→RGB (h,s,v in 0..1) → 0–255 triplet. */
function hsv(h: number, s: number, v: number): [number, number, number] {
  const i = Math.floor(h * 6)
  const f = h * 6 - i
  const p = v * (1 - s)
  const q = v * (1 - f * s)
  const t = v * (1 - (1 - f) * s)
  const [r, g, b] = [
    [v, t, p],
    [q, v, p],
    [p, v, t],
    [p, q, v],
    [t, p, v],
    [v, p, q],
  ][i % 6]
  return [r * 255, g * 255, b * 255]
}

/** The shapes to run right now = the live programmer shapes + those of any cue that
 *  is currently up (level > 0), so playing a cue reproduces the shapes it was recorded
 *  with. Live shapes come last so they win while you're building a look. */
export function activeEffects(
  cues: LiveCue[],
  levels: Record<string, number>,
  fades: Record<string, Fade>,
  now: number,
  live: Effect[],
): Effect[] {
  const out: Effect[] = []
  for (const c of cues) {
    if (c.effects?.length && resolveLevel(c.id, levels, fades, now) > 0) out.push(...c.effects)
  }
  out.push(...live)
  return out
}

export function applyEffects(
  base: ProgrammerValues,
  effects: Effect[],
  show: Show,
  defsById: Record<string, FixtureDefinition>,
  timeSec: number,
): ProgrammerValues {
  if (effects.length === 0) return base
  const out: ProgrammerValues = {}
  for (const id in base) out[id] = { ...base[id] }
  const fixById = new Map(show.fixtures.map((f) => [f.id, f]))

  for (const eff of effects) {
    eff.fixtureIds.forEach((fid, k) => {
      const pf = fixById.get(fid)
      const channels = pf && defsById[pf.definitionId]?.modes[pf.modeIndex]?.channels
      if (!channels) return
      const phase = timeSec * eff.speed * Math.PI * 2 + k * eff.spread
      const setFn = (fn: string, val: number) => {
        const idx = channels.findIndex((c) => c.function === fn)
        if (idx >= 0) out[fid] = { ...out[fid], [idx]: clampByte(val) }
      }
      // Read the fixture's current (base) value for a function, so shapes are OFFSETS
      // added to the programmed position/level — like Titan: a circle orbits wherever
      // the head is pointing, not a forced centre.
      const baseOf = (fn: string, fallback: number) => {
        const idx = channels.findIndex((c) => c.function === fn)
        return idx >= 0 ? (out[fid]?.[idx] ?? channels[idx].defaultValue ?? fallback) : fallback
      }
      if (eff.type === 'circle') {
        setFn('pan', baseOf('pan', 128) + Math.sin(phase) * eff.size)
        setFn('tilt', baseOf('tilt', 128) + Math.cos(phase) * eff.size)
      } else if (eff.type === 'colourCycle') {
        const [r, g, b] = hsv(((phase / (Math.PI * 2)) % 1 + 1) % 1, 1, 1)
        setFn('red', r)
        setFn('green', g)
        setFn('blue', b)
      } else if (eff.type === 'dimmerWave') {
        setFn('dimmer', baseOf('dimmer', 255) - (0.5 - 0.5 * Math.sin(phase)) * 255)
      }
    })
  }
  return out
}
