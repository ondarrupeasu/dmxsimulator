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
  /** Playback position (0-based global fader index). Real desks are sparse: a cue can
   *  sit on any fader, leaving gaps. Older cues without a slot fill the first free ones. */
  slot?: number
}

/** Cues arranged by their playback slot (sparse). Cues with an explicit slot keep it;
 *  any without one fill the first free slots so nothing overlaps. Index = fader index. */
export function cuesBySlot(cues: Cue[]): (Cue | undefined)[] {
  const bySlot: (Cue | undefined)[] = []
  const loose: Cue[] = []
  for (const c of cues) {
    if (typeof c.slot === 'number' && c.slot >= 0) bySlot[c.slot] = c
    else loose.push(c)
  }
  let i = 0
  for (const c of loose) {
    while (bySlot[i]) i++
    bySlot[i] = c
  }
  return bySlot
}

/** The lowest free playback slot (for a plain Record with no chosen destination). */
export function firstFreeSlot(cues: Cue[]): number {
  const bySlot = cuesBySlot(cues)
  let i = 0
  while (bySlot[i]) i++
  return i
}
