/**
 * DMX output engine.
 *
 * Pure functions that turn the patch + the programmer state into the 512 raw
 * channel values of a universe. This is the didactic core: the same numbers a
 * real console hides, made visible. Cues/playback (phase 2) will feed the same
 * merge, so keep this side-effect free.
 */
import type { FixtureDefinition, Show } from '../model/types'

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
