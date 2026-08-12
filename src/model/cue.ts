/** A cue = a named snapshot of programmer values + shapes, fired from a playback. */
import type { ProgrammerValues } from '../engine/dmx'
import type { Effect } from '../engine/effects'

export interface Cue {
  id: string
  name: string
  /** Snapshot of the programmer at record time (instanceId → channel → 0–255). */
  values: ProgrammerValues
  /** Shapes (effects) that were running in the programmer when recorded. */
  effects?: Effect[]
}
