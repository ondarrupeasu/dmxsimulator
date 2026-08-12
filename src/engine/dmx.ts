/**
 * DMX output engine.
 *
 * Pure functions that turn the patch + the programmer state into the 512 raw
 * channel values of a universe. This is the didactic core: the same numbers a
 * real console hides, made visible. Cues/playback (phase 2) will feed the same
 * merge, so keep this side-effect free.
 */
import type { FixtureDefinition, Show } from '../model/types'
import type { LiveCue } from '../model/cue'

export const UNIVERSE_SIZE = 512

/** Programmer edits: instanceId → (channel index within the mode → 0–255). */
export type ProgrammerValues = Record<string, Record<number, number>>

/** A decoded per-fixture view of the output, handy for the visualizer. */
export interface FixtureOutput {
  instanceId: string
  /** Resolved value per channel index of the active mode (0–255). */
  values: number[]
}

function clampByte(v: number): number {
  if (v < 0) return 0
  if (v > 255) return 255
  return Math.round(v)
}

/**
 * Merge two programmer maps: `top` overrides `base` per instance+channel.
 * Used to lay the live programmer on top of the active playback cue.
 */
export function mergeProgrammer(base: ProgrammerValues, top: ProgrammerValues): ProgrammerValues {
  const out: ProgrammerValues = {}
  for (const id in base) out[id] = { ...base[id] }
  for (const id in top) out[id] = { ...out[id], ...top[id] }
  return out
}

/** An in-progress crossfade of a playback level (0–255) over `dur` seconds. */
export interface Fade {
  from: number
  to: number
  start: number // clock time (store `now`) when the fade began
  dur: number // seconds
}

/** The live level of one playback, interpolating an in-progress fade against `now`. */
export function resolveLevel(id: string, levels: Record<string, number>, fades: Record<string, Fade>, now: number): number {
  const f = fades[id]
  if (!f) return levels[id] ?? 0
  const t = f.dur <= 0 ? 1 : Math.min(1, Math.max(0, (now - f.start) / f.dur))
  return Math.round(f.from + (f.to - f.from) * t)
}

/** The live level of every playback (settled levels + any in-progress fades). */
export function resolveLevels(levels: Record<string, number>, fades: Record<string, Fade>, now: number): Record<string, number> {
  const out: Record<string, number> = { ...levels }
  for (const id in fades) out[id] = resolveLevel(id, levels, fades, now)
  return out
}

/** The output master per playback = HTP(manual fader, fired level). The manual fader is never
 *  animated (the desk's faders aren't motorised); the fired level is what Go / flash / executor
 *  / audio triggers bring up (and it may be mid-fade). */
export function effectivePlaybackLevels(
  manual: Record<string, number>,
  fired: Record<string, number>,
  fades: Record<string, Fade>,
  now: number,
  flashId?: string | null,
  swopId?: string | null,
): Record<string, number> {
  // Swop solos one playback: it's full and every other playback's output is muted.
  if (swopId) return { [swopId]: 255 }
  const out: Record<string, number> = { ...manual }
  const resolved = resolveLevels(fired, fades, now)
  for (const id in resolved) out[id] = Math.max(out[id] ?? 0, resolved[id])
  // Flash adds a playback into the output at full (HTP).
  if (flashId) out[flashId] = 255
  return out
}

/**
 * Merge every playback that is up (its fader level > 0) into one base layer:
 * intensity (dimmer) is scaled by the fader level and combined HTP (highest wins);
 * other attributes are asserted LTP (the last raised playback, in list order, wins).
 * This is what the faders on the desk actually control.
 */
export function computePlaybackBase(
  cues: LiveCue[],
  levels: Record<string, number>,
  show: Show,
  defsById: Record<string, FixtureDefinition>,
): ProgrammerValues {
  const out: ProgrammerValues = {}
  // Which channel indices are the dimmer of each patched fixture.
  const dimmerIdx = new Map<string, Set<number>>()
  for (const pf of show.fixtures) {
    const mode = defsById[pf.definitionId]?.modes[pf.modeIndex]
    if (!mode) continue
    const s = new Set<number>()
    mode.channels.forEach((ch, i) => {
      if (ch.function === 'dimmer') s.add(i)
    })
    dimmerIdx.set(pf.id, s)
  }
  for (const cue of cues) {
    const level = levels[cue.id] ?? 0
    if (level <= 0) continue
    const frac = level / 255
    for (const inst in cue.values) {
      const dims = dimmerIdx.get(inst)
      const edits = cue.values[inst]
      const dst = (out[inst] ??= {})
      for (const kStr in edits) {
        const k = Number(kStr)
        const v = edits[k]
        if (dims?.has(k)) dst[k] = Math.max(dst[k] ?? 0, Math.round(v * frac)) // HTP intensity
        else dst[k] = v // LTP for everything else
      }
    }
  }
  return out
}

/**
 * Compute the 512 raw values for one universe.
 * Programmer values override the fixture's channel defaults; unpatched channels
 * stay 0. Overlapping addresses (a patch error) resolve last-fixture-wins.
 */
export function computeUniverse(
  show: Show,
  defsById: Record<string, FixtureDefinition>,
  programmer: ProgrammerValues,
  universe: number,
): Uint8Array {
  const out = new Uint8Array(UNIVERSE_SIZE)
  for (const pf of show.fixtures) {
    if (pf.universe !== universe) continue
    const def = defsById[pf.definitionId]
    const mode = def?.modes[pf.modeIndex]
    if (!mode) continue
    const edits = programmer[pf.id]
    mode.channels.forEach((ch, i) => {
      const addr = pf.address + i // 1-based
      if (addr < 1 || addr > UNIVERSE_SIZE) return
      const value = edits?.[i]
      out[addr - 1] = clampByte(value ?? ch.defaultValue)
    })
  }
  return out
}

/** Decode the resolved value of each channel per fixture (for the visualizer). */
export function computeFixtureOutputs(
  show: Show,
  defsById: Record<string, FixtureDefinition>,
  programmer: ProgrammerValues,
): FixtureOutput[] {
  return show.fixtures.map((pf) => {
    const def = defsById[pf.definitionId]
    const mode = def?.modes[pf.modeIndex]
    const edits = programmer[pf.id]
    const values = (mode?.channels ?? []).map((ch, i) =>
      clampByte(edits?.[i] ?? ch.defaultValue),
    )
    return { instanceId: pf.id, values }
  })
}
