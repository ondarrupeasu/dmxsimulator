/** The rig's trusses, shared by the patch UI and the 3D visualiser so a fixture's
 *  `truss` id means the same thing everywhere. Trusses now live on the show (so they
 *  can be added/moved/removed); this module holds the default set + helpers. */
import type { Show, TrussDef } from './types'

export type { TrussDef }

/** Default Tartanga-style layout: three trusses over the stage (front → back) plus a
 *  front-of-house truss over the audience aimed back at the stage. */
export const DEFAULT_TRUSSES: TrussDef[] = [
  { id: 0, name: 'Front', z: 4, y: 5 },
  { id: 1, name: 'Mid', z: 0, y: 5 },
  { id: 2, name: 'Back', z: -4, y: 5 },
  { id: 3, name: 'FOH', z: 9, y: 7, foh: true },
]

/** Kept for older references — the middle stage truss. */
export const DEFAULT_TRUSS = 1

/** A show's trusses, falling back to the default set when the show has none. */
export const getTrusses = (show: Show): TrussDef[] => show.trusses ?? DEFAULT_TRUSSES

export const trussById = (trusses: TrussDef[], id: number | undefined): TrussDef =>
  trusses.find((t) => t.id === id) ?? trusses[0] ?? DEFAULT_TRUSSES[DEFAULT_TRUSS]

/** Next free truss id for a list. */
export const nextTrussId = (trusses: TrussDef[]): number =>
  trusses.reduce((m, t) => Math.max(m, t.id), -1) + 1

/** Stage deck (tarima) height above the floor, in metres. */
export const STAGE_TOP = 1
