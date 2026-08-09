/** A cue = a named snapshot of programmer values, fired from a playback. */
import type { ProgrammerValues } from '../engine/dmx'

export interface Cue {
  id: string
  name: string
  /** Snapshot of the programmer at record time (instanceId → channel → 0–255). */
  values: ProgrammerValues
}
