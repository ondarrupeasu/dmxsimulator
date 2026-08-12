/** Playbacks & cues — the show's playback stack, faithful to Titan.
 *
 *  On a real desk a **playback** is what sits on one fader/handle. It holds an ordered list
 *  of **steps (cues)**: one step = a single cue; several steps = a **cue list** (stepped by
 *  the central Go/Prev of the connected playback) or a **chase** (auto-timed by a BPM). The
 *  playbacks are *sparse*: a playback can live on any slot, leaving gaps.
 */
import type { ProgrammerValues } from '../engine/dmx'
import type { Effect } from '../engine/effects'

/** One step (cue) inside a playback: a named snapshot of the programmer + the shapes that
 *  were running when it was recorded, with its own fade timing. */
export interface CueStep {
  id: string
  /** Display/order number (1, 2, 3…). */
  number: number
  name: string
  /** Snapshot of the programmer at record time (instanceId → channel → 0–255). */
  values: ProgrammerValues
  /** Shapes (effects) that were running in the programmer when recorded. */
  effects?: Effect[]
  /** Fade in time (s) for this step; undefined → use the desk's default fade. */
  fadeIn?: number
  fadeOut?: number
  delay?: number
}

/** A playback (one fader). Sparse `slot`; ordered `steps`; `current` = the live step. */
export interface Playback {
  id: string
  /** Playback position (0-based global fader index). Sparse: gaps allowed, like the desk. */
  slot: number
  name: string
  steps: CueStep[]
  /** Index of the live step, or -1 when the playback hasn't been fired. */
  current: number
  /** How the steps advance: 'list' = manually by Go; 'chase' = auto-timed by `bpm`. */
  mode: 'list' | 'chase'
  /** Chase tempo in beats per minute (used when mode === 'chase'). */
  bpm?: number
}

/** Legacy pre-cue-lists shape (a cue was one fader). Kept only for persist/import migration. */
export interface LegacyCue {
  id: string
  name: string
  values: ProgrammerValues
  effects?: Effect[]
  slot?: number
}

/** The engine's minimal view of a live playback: its active step as {id, values, effects}
 *  with id === the playback id (so playbackLevels/fades key by playback). */
export interface LiveCue {
  id: string
  values: ProgrammerValues
  effects?: Effect[]
}

/** Playbacks arranged by slot (sparse). Explicit slots keep their place; any negative/unset
 *  slot fills the first free ones so nothing overlaps. Index = fader index. */
export function playbacksBySlot(pbs: Playback[]): (Playback | undefined)[] {
  const bySlot: (Playback | undefined)[] = []
  const loose: Playback[] = []
  for (const p of pbs) {
    if (typeof p.slot === 'number' && p.slot >= 0) bySlot[p.slot] = p
    else loose.push(p)
  }
  let i = 0
  for (const p of loose) {
    while (bySlot[i]) i++
    bySlot[i] = p
  }
  return bySlot
}

/** The lowest free playback slot (for a plain Record with no chosen destination). */
export function firstFreePlaybackSlot(pbs: Playback[]): number {
  const bySlot = playbacksBySlot(pbs)
  let i = 0
  while (bySlot[i]) i++
  return i
}

/** The step that a playback currently outputs: the fired step, or step 0 when a fader is
 *  simply raised (current still -1). Undefined only if the playback has no steps. */
export function activeStep(pb: Playback): CueStep | undefined {
  if (!pb.steps.length) return undefined
  const i = pb.current >= 0 ? pb.current : 0
  return pb.steps[Math.min(i, pb.steps.length - 1)]
}

/** The engine's view of all playbacks: each one's active step as a LiveCue (id = playback id). */
export function liveCues(pbs: Playback[]): LiveCue[] {
  const out: LiveCue[] = []
  for (const pb of pbs) {
    const st = activeStep(pb)
    if (st) out.push({ id: pb.id, values: st.values, effects: st.effects })
  }
  return out
}

/** Migrate legacy single cues → one-step playbacks. Reuses each cue's id as the PLAYBACK id
 *  so persisted playbackLevels / fades / executorCues (keyed by that id) stay valid. */
export function migrateLegacyCues(cues: LegacyCue[]): Playback[] {
  const withSlot = cues.map((c, i) => ({ c, slot: typeof c.slot === 'number' && c.slot >= 0 ? c.slot : i }))
  return withSlot.map(({ c, slot }) => ({
    id: c.id,
    slot,
    name: c.name,
    current: -1,
    mode: 'list' as const,
    steps: [{ id: `${c.id}-s1`, number: 1, name: c.name, values: c.values, effects: c.effects }],
  }))
}
